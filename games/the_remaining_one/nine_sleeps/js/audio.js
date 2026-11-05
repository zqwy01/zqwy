/* КЕРН · ДЕВЯТЬ СНОВ — audio engine.
   Streams the original .opus files (with .m4a fallback for iOS), keeps their
   perceived loudness close, adds a generated WebAudio dream ambience and
   small procedural SFX. No audio file is copied into the game folder. */
(function () {
  'use strict';

  const TRO = window.TRO || { TRACKS: [] };
  const TARGET_LUFS = -15.5;

  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;

  function dbToGain(db) { return Math.pow(10, db / 20); }

  function byId(id) { return document.getElementById(id); }

  function AudioEngine() {
    this.ctx = null;
    this.audio = null;
    this.master = null;
    this.norm = null;
    this.fade = null;
    this.analyser = null;
    this.sfxBus = null;
    this.direct = false;

    this.volume = 0.78;
    this.muted = false;
    this.sfxEnabled = true;
    this.duck = 1;
    this.energy = 0;
    this.bands = new Array(12).fill(0);

    this.mode = null;            // 'chapter' | 'album' | null
    this.index = -1;
    this.format = 'opus';
    this.opusOK = true;
    this.unlocked = false;
    this.wantAmbience = false;
    this._amb = null;
    this._loadToken = 0;
    this._fadeTimer = 0;
    this._lastError = null;
    this._fakeTime = 0;

    this.onError = null;
    this.onTrack = null;
    this.onAlbumEnd = null;
    this.onState = null;

    try {
      const probe = document.createElement('audio');
      this.opusOK = !!probe.canPlayType('audio/ogg; codecs="opus"');
    } catch (e) {
      this.opusOK = false;
    }
    if (!this.opusOK) this.format = 'm4a';
  }

  AudioEngine.prototype._ensure = function () {
    if (this.ctx) return !!this.ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    try {
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : this.volume;
      this.master.connect(this.ctx.destination);

      this.analyser = this.ctx.createAnalyser();
      this.analyser.fftSize = 128;
      this.analyser.smoothingTimeConstant = 0.82;
      this.analyser.connect(this.master);

      this.sfxBus = this.ctx.createGain();
      this.sfxBus.gain.value = this.sfxEnabled ? 0.5 : 0;
      this.sfxBus.connect(this.analyser);

      this.fade = this.ctx.createGain();
      this.fade.gain.value = 0;
      this.norm = this.ctx.createGain();
      this.norm.gain.value = 0.8;
      this.norm.connect(this.fade);
      this.fade.connect(this.analyser);

      this.audio = new Audio();
      this.audio.preload = 'auto';
      this.audio.setAttribute('playsinline', '');
      this.audio.setAttribute('webkit-playsinline', '');
      this.audio.loop = false;

      try {
        const src = this.ctx.createMediaElementSource(this.audio);
        src.connect(this.norm);
      } catch (e) {
        this.direct = true;
      }

      this.audio.addEventListener('ended', () => this._onEnded());
      this.audio.addEventListener('error', () => this._onMediaError());
      this.audio.addEventListener('play', () => this._emitState());
      this.audio.addEventListener('pause', () => this._emitState());
      return true;
    } catch (e) {
      this.ctx = null;
      return false;
    }
  };

  AudioEngine.prototype.unlock = function () {
    const ok = this._ensure();
    if (!ok) return false;
    this.unlocked = true;
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(function () {});
    }
    if (this.wantAmbience && !this.isPlaying()) this.startAmbience();
    return true;
  };

  AudioEngine.prototype._emitState = function () {
    if (typeof this.onState === 'function') {
      this.onState({ playing: this.isPlaying(), mode: this.mode, index: this.index });
    }
  };

  AudioEngine.prototype._normFor = function (track) {
    const lufs = typeof track.lufs === 'number' ? track.lufs : -10;
    return clamp(dbToGain(TARGET_LUFS - lufs), 0.12, 1.0);
  };

  AudioEngine.prototype._applyVolume = function () {
    if (!this.ctx) return;
    const v = this.muted ? 0 : clamp(this.volume, 0, 1);
    const now = this.ctx.currentTime;
    this.master.gain.cancelScheduledValues(now);
    this.master.gain.setTargetAtTime(v, now, 0.03);
    if (this.sfxBus) this.sfxBus.gain.setTargetAtTime(this.sfxEnabled ? 0.5 : 0, now, 0.03);
    if (this.direct && this.audio) this.audio.volume = clamp(v * 0.75, 0, 1);
  };

  AudioEngine.prototype._rampFade = function (value, seconds) {
    if (!this.ctx || !this.fade) return;
    const now = this.ctx.currentTime;
    this.fade.gain.cancelScheduledValues(now);
    this.fade.gain.setValueAtTime(this.fade.gain.value, now);
    this.fade.gain.linearRampToValueAtTime(value, now + Math.max(0.02, seconds));
  };

  AudioEngine.prototype._setDuck = function (v) {
    this.duck = v;
    if (this.mode && this.fade && this.ctx) {
      // ducking is folded into the fade target on the next ramp
    }
  };

  AudioEngine.prototype.setDuck = function (v) {
    this.duck = clamp(v, 0.15, 1);
    if (this.isPlaying()) this._rampFade(this.duck, 0.35);
  };

  AudioEngine.prototype.setVolume = function (v) {
    this.volume = clamp(v, 0, 1);
    this._applyVolume();
  };

  AudioEngine.prototype.setMuted = function (v) {
    this.muted = !!v;
    this._applyVolume();
  };

  AudioEngine.prototype.toggleMuted = function () {
    this.setMuted(!this.muted);
    return this.muted;
  };

  AudioEngine.prototype.setSfxEnabled = function (v) {
    this.sfxEnabled = !!v;
    this._applyVolume();
  };

  AudioEngine.prototype._sourceFor = function (track) {
    if (this.format === 'opus' && this.opusOK) return track.opus;
    return track.m4a || track.opus;
  };

  AudioEngine.prototype._start = function (index, mode, restart) {
    if (!this._ensure()) return;
    const track = TRO.TRACKS[index];
    if (!track) return;
    if (!restart && this.index === index && this.mode === mode && this.audio && this.audio.src) {
      this.audio.loop = mode === 'chapter';
      this._rampFade(this.duck, 0.35);
      if (this.audio.paused) this._playCurrent();
      return;
    }
    this.index = index;
    this.mode = mode;
    this.wantAmbience = false;
    this.stopAmbience(0.5);
    const token = ++this._loadToken;
    this._lastError = null;

    if (this.audio) {
      try { this.audio.pause(); } catch (e) {}
      this.audio.loop = mode === 'chapter';
      this.audio.src = this._sourceFor(track);
      try { this.audio.load(); } catch (e) {}
    }
    if (this.norm) {
      const now = this.ctx.currentTime;
      this.norm.gain.cancelScheduledValues(now);
      this.norm.gain.setValueAtTime(this._normFor(track), now);
    }
    if (this.fade) this.fade.gain.value = 0;
    this._playCurrent(token, mode);
    if (typeof this.onTrack === 'function') this.onTrack(index, mode, track);
  };

  AudioEngine.prototype._playCurrent = function (token, mode) {
    if (!this.audio) return;
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume().catch(function () {});
    const p = this.audio.play();
    if (this.fade) this._rampFade(this.duck, 0.85);
    if (p && typeof p.catch === 'function') {
      p.catch((err) => {
        if (!err || err.name === 'AbortError') return;
        if (err.name === 'NotAllowedError') {
          this._autoplayBlocked = true;
          this._emitState();
          return;
        }
        if (token != null && token !== this._loadToken) return;
        this._onMediaError();
      });
    }
    this._emitState();
  };

  AudioEngine.prototype._onMediaError = function () {
    if (this.mode === 'album' && this.format === 'opus') {
      // Album preview can also fall back silently.
    }
    if (this.format === 'opus') {
      this.format = 'm4a';
      const track = TRO.TRACKS[this.index];
      if (!track) return this._fail();
      if (!this.audio) return this._fail();
      try {
        this.audio.pause();
        this.audio.src = track.m4a;
        this.audio.load();
        this._playCurrent(this._loadToken, this.mode);
        return;
      } catch (e) {
        return this._fail();
      }
    }
    this._fail();
  };

  AudioEngine.prototype._fail = function () {
    const track = TRO.TRACKS[this.index] || {};
    this._lastError = track;
    this._emitState();
    if (typeof this.onError === 'function') {
      this.onError({
        index: this.index,
        title: track.title || 'трек',
        message: 'Браузер не смог прочитать ' + (this.format === 'opus' ? 'Opus' : 'M4A') +
          '-файл трека «' + (track.ru || track.title || '?') + '». Игра продолжится без музыки, если закрыть это окно.'
      });
    }
  };

  AudioEngine.prototype.retry = function () {
    if (this.index < 0) return;
    this.format = this.opusOK ? 'opus' : 'm4a';
    this._start(this.index, this.mode || 'chapter', true);
  };

  AudioEngine.prototype.playChapter = function (index) {
    this._start(index, 'chapter', false);
  };

  AudioEngine.prototype.playAlbum = function (index) {
    this._start(index, 'album', false);
    if (typeof this.onTrack === 'function') this.onTrack(index, 'album', TRO.TRACKS[index]);
  };

  AudioEngine.prototype._onEnded = function () {
    if (this.mode === 'album') {
      const next = this.index + 1;
      if (next < TRO.TRACKS.length) {
        this.playAlbum(next);
      } else {
        this.stop(0.8);
        if (typeof this.onAlbumEnd === 'function') this.onAlbumEnd();
      }
    } else {
      this._emitState();
    }
  };

  AudioEngine.prototype.pause = function () {
    if (!this.audio) return;
    this._fadeTimer++;
    const token = this._fadeTimer;
    this._rampFade(0, 0.25);
    setTimeout(() => {
      if (token !== this._fadeTimer) return;
      if (this.audio) { try { this.audio.pause(); } catch (e) {} }
      this._emitState();
    }, 260);
  };

  AudioEngine.prototype.resume = function () {
    if (!this.audio || !this.audio.src) return;
    this._fadeTimer++;
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume().catch(function () {});
    if (this.audio.paused) {
      this._playCurrent(this._loadToken, this.mode);
      this._rampFade(this.duck, 0.4);
    }
  };

  AudioEngine.prototype.stop = function (fade) {
    fade = fade == null ? 0.6 : fade;
    this._fadeTimer++;
    const token = this._fadeTimer;
    this._rampFade(0, fade);
    setTimeout(() => {
      if (token !== this._fadeTimer) return;
      if (this.audio) {
        try { this.audio.pause(); this.audio.currentTime = 0; } catch (e) {}
      }
      this.mode = null;
      this.index = -1;
      this._emitState();
    }, Math.max(30, fade * 1000 + 40));
  };

  AudioEngine.prototype.stopImmediate = function () {
    this._fadeTimer++;
    if (this.audio) {
      try { this.audio.pause(); this.audio.currentTime = 0; } catch (e) {}
    }
    if (this.fade) this.fade.gain.value = 0;
    this.mode = null;
    this.index = -1;
    this._emitState();
  };

  AudioEngine.prototype.isPlaying = function () {
    return !!(this.audio && this.audio.src && !this.audio.paused && !this.audio.ended);
  };

  AudioEngine.prototype.currentTrack = function () {
    return this.index >= 0 ? TRO.TRACKS[this.index] : null;
  };

  AudioEngine.prototype.getTime = function () {
    return this.audio ? (this.audio.currentTime || 0) : 0;
  };

  AudioEngine.prototype.getDuration = function () {
    if (!this.audio || !isFinite(this.audio.duration)) return 0;
    return this.audio.duration || 0;
  };

  AudioEngine.prototype.getProgress = function () {
    const d = this.getDuration();
    return d > 0 ? clamp(this.getTime() / d, 0, 1) : 0;
  };

  // ─────────────────────────────────────────────────────── generated ambience
  AudioEngine.prototype.startAmbience = function () {
    this.wantAmbience = true;
    if (!this._ensure()) return;
    if (this.isPlaying()) return;
    if (!this._amb) this._createAmbience();
    if (!this._amb) return;
    const now = this.ctx.currentTime;
    this._amb.bus.gain.cancelScheduledValues(now);
    this._amb.bus.gain.setTargetAtTime(0.052, now, 1.4);
  };

  AudioEngine.prototype.stopAmbience = function (seconds) {
    this.wantAmbience = false;
    if (!this._amb || !this.ctx) return;
    const now = this.ctx.currentTime;
    this._amb.bus.gain.cancelScheduledValues(now);
    this._amb.bus.gain.setTargetAtTime(0, now, Math.max(0.05, (seconds || 0.8) / 3));
  };

  AudioEngine.prototype._createAmbience = function () {
    if (!this.ctx || !this.analyser || this._amb) return;
    try {
      const ctx = this.ctx;
      const bus = ctx.createGain();
      bus.gain.value = 0;
      bus.connect(this.analyser);

      const o1 = ctx.createOscillator();
      o1.type = 'sine';
      o1.frequency.value = 55;
      const g1 = ctx.createGain();
      g1.gain.value = 0.22;
      o1.connect(g1).connect(bus);

      const o2 = ctx.createOscillator();
      o2.type = 'triangle';
      o2.frequency.value = 82.4;
      const g2 = ctx.createGain();
      g2.gain.value = 0.075;
      o2.connect(g2).connect(bus);

      const o3 = ctx.createOscillator();
      o3.type = 'sine';
      o3.frequency.value = 110;
      const g3 = ctx.createGain();
      g3.gain.value = 0.04;
      o3.connect(g3).connect(bus);

      // breathing LFO
      const lfo = ctx.createOscillator();
      lfo.type = 'sine';
      lfo.frequency.value = 0.075;
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = 0.018;
      lfo.connect(lfoGain).connect(bus.gain);

      // filtered wind
      const len = Math.floor(ctx.sampleRate * 3);
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = buf.getChannelData(0);
      let last = 0;
      for (let i = 0; i < len; i++) {
        const white = Math.random() * 2 - 1;
        last = last * 0.985 + white * 0.015;
        data[i] = last * 2.2;
      }
      const noise = ctx.createBufferSource();
      noise.buffer = buf;
      noise.loop = true;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 260;
      filter.Q.value = 0.6;
      const ng = ctx.createGain();
      ng.gain.value = 0.22;
      noise.connect(filter).connect(ng).connect(bus);

      o1.start(); o2.start(); o3.start(); lfo.start(); noise.start();
      this._amb = { bus, o1, o2, o3, lfo, noise };
    } catch (e) {
      this._amb = null;
    }
  };

  // ─────────────────────────────────────────────────────── analyser / visuals
  AudioEngine.prototype.tick = function (dt) {
    this._fakeTime += dt || 0.016;
    if (this.analyser) {
      const data = new Uint8Array(this.analyser.frequencyBinCount);
      this.analyser.getByteFrequencyData(data);
      let sum = 0;
      let n = 0;
      for (let i = 2; i < data.length; i++) { sum += data[i]; n++; }
      const raw = n ? (sum / n) / 255 : 0;
      this.energy += (raw - this.energy) * 0.18;
      for (let b = 0; b < this.bands.length; b++) {
        const t = b / this.bands.length;
        const idx = Math.min(data.length - 1, Math.floor(Math.pow(t, 1.7) * (data.length - 1)) + 1);
        const v = data[idx] / 255;
        this.bands[b] += (v - this.bands[b]) * 0.24;
      }
    } else {
      const playing = this.isPlaying();
      const v = playing ? 0.25 + 0.12 * Math.sin(this._fakeTime * 2.1) + 0.08 * Math.sin(this._fakeTime * 5.3) : 0.04;
      this.energy += (v - this.energy) * 0.1;
      for (let b = 0; b < this.bands.length; b++) {
        const v2 = playing ? Math.max(0.04, v * (0.55 + 0.45 * Math.sin(this._fakeTime * (1.6 + b * 0.17) + b))) : 0.02;
        this.bands[b] += (v2 - this.bands[b]) * 0.15;
      }
    }
  };

  AudioEngine.prototype.getEnergy = function () { return this.energy; };
  AudioEngine.prototype.getBands = function () { return this.bands; };

  // ─────────────────────────────────────────────────────── SFX
  AudioEngine.prototype._tone = function (freq, dur, type, gain, slideTo, delay) {
    if (!this.ctx || !this.sfxBus) return;
    const t0 = this.ctx.currentTime + (delay || 0);
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type || 'sine';
    o.frequency.setValueAtTime(freq, t0);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), t0 + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g).connect(this.sfxBus);
    o.start(t0);
    o.stop(t0 + dur + 0.03);
  };

  AudioEngine.prototype._noise = function (dur, gain, freq, delay) {
    if (!this.ctx || !this.sfxBus) return;
    const t0 = this.ctx.currentTime + (delay || 0);
    const len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(freq || 1200, t0);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(filter).connect(g).connect(this.sfxBus);
    src.start(t0);
  };

  AudioEngine.prototype.sfx = function (name) {
    if (!this.sfxEnabled || this.muted) return;
    if (!this._ensure() || !this.ctx) return;
    if (this.ctx.state === 'suspended') this.ctx.resume().catch(function () {});
    switch (name) {
      case 'click':
        this._tone(420, 0.05, 'square', 0.035, 260);
        break;
      case 'step':
        this._noise(0.055, 0.05, 380);
        break;
      case 'rune':
        this._tone(660, 0.22, 'sine', 0.05);
        this._tone(990, 0.3, 'sine', 0.026, null, 0.03);
        break;
      case 'echo':
        this._tone(528, 0.8, 'sine', 0.055);
        this._tone(792, 1.1, 'sine', 0.028, null, 0.06);
        this._noise(1.1, 0.018, 900);
        break;
      case 'success':
        [392, 523, 659, 784].forEach((f, i) => this._tone(f, 0.38, 'triangle', 0.04, null, i * 0.09));
        this._noise(0.8, 0.022, 1600);
        break;
      case 'error':
        this._tone(150, 0.28, 'sawtooth', 0.028, 92);
        break;
      case 'choice':
        this._tone(196, 0.45, 'triangle', 0.038);
        this._tone(294, 0.5, 'sine', 0.02, null, 0.05);
        break;
      case 'listen':
        this._noise(0.9, 0.035, 520);
        this._tone(176, 0.7, 'sine', 0.022);
        break;
      case 'ending':
        [130.8, 196, 261.6, 392].forEach((f, i) => this._tone(f, 3.4, 'sine', 0.032, null, i * 0.18));
        this._noise(2.8, 0.018, 700);
        break;
      case 'page':
        this._noise(0.28, 0.025, 2200);
        break;
      default:
        this._tone(440, 0.08, 'sine', 0.02);
    }
  };

  window.Sound = new AudioEngine();
})();
