/* ОСТАВШИЙСЯ — audio engine.
   Streams the original Opus files with an <audio> element (no copies, no giant
   decoded buffers), routes them through Web Audio for the analyser, and keeps
   a latency-compensated song clock for the rhythm chart. */
(function () {
  'use strict';

  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;

  class TROAudio {
    constructor() {
      this.ctx = null;
      this.master = null;
      this.analyser = null;
      this.sfxGain = null;
      this.element = null;
      this.mediaNode = null;
      this.connected = false;
      this.playing = false;
      this.ended = false;
      this.ready = false;
      this.error = null;
      this.src = '';
      this.slug = '';
      this._duration = 0;
      this._baseSong = 0;
      this._basePerf = 0;
      this._pausedAt = 0;
      this._latency = 0;
      this._offset = 0;
      this._volume = 0.9;
      this._muted = false;
      this.sfxOn = true;
      this._freq = null;
      this._levels = { bass: 0, mid: 0, high: 0, level: 0 };
      this._lastSync = 0;
      this._lastTime = 0;
      this._key = 'G';
      this._onEnded = null;
      this._loadGen = 0;
      this._progressHandlers = null;
    }

    async ensure() {
      if (this.ctx) {
        if (this.ctx.state === 'suspended') {
          try { await this.ctx.resume(); } catch (e) {}
        }
        return;
      }
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) throw new Error('Web Audio API недоступен');
      this.ctx = new AC({ latencyHint: 'interactive' });
      this.master = this.ctx.createGain();
      this.master.gain.value = this._muted ? 0 : this._volume;
      this.analyser = this.ctx.createAnalyser();
      this.analyser.fftSize = 1024;
      this.analyser.smoothingTimeConstant = 0.78;
      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.value = 0.9;
      this.analyser.connect(this.master);
      this.master.connect(this.ctx.destination);
      // SFX go through the master too, so mute and volume apply to everything.
      this.sfxGain.connect(this.master);
      if (this.ctx.state === 'suspended') {
        try { await this.ctx.resume(); } catch (e) {}
      }
      this._updateLatency();
    }

    _updateLatency() {
      if (!this.ctx) { this._latency = 0; return; }
      const out = this.ctx.outputLatency;
      const base = this.ctx.baseLatency;
      this._latency = Number.isFinite(out) && out > 0 ? out : (Number.isFinite(base) ? base : 0);
    }

    get duration() { return this._duration || 0; }
    get latency() { return this._latency; }
    get offset() { return this._offset; }

    setVolume(v) {
      this._volume = clamp(v, 0, 1);
      this._applyVolume();
    }
    setMuted(m) {
      this._muted = !!m;
      this._applyVolume();
    }
    get muted() { return this._muted; }
    _applyVolume() {
      if (!this.master) return;
      const target = this._muted ? 0 : this._volume;
      const now = this.ctx ? this.ctx.currentTime : 0;
      try {
        this.master.gain.cancelScheduledValues(now);
        this.master.gain.setTargetAtTime(target, now, 0.02);
      } catch (e) { this.master.gain.value = target; }
    }
    setOffsetMs(ms) { this._offset = clamp(ms, -250, 250) / 1000; }
    setKey(key) { this._key = key || 'G'; }

    async _makeElement() {
      if (this.element) return this.element;
      const el = document.createElement('audio');
      el.preload = 'auto';
      el.playsInline = true;
      el.setAttribute('playsinline', '');
      el.setAttribute('webkit-playsinline', '');
      // A crossorigin request over file:// breaks playback in most browsers.
      if (/^https?:/i.test(window.location.protocol)) el.crossOrigin = 'anonymous';
      el.style.display = 'none';
      document.body.appendChild(el);
      this.element = el;

      if (this.ctx) {
        try {
          this.mediaNode = this.ctx.createMediaElementSource(el);
          this.mediaNode.connect(this.analyser);
          this.connected = true;
        } catch (e) {
          // file:// or a browser without MediaElementSource: play directly.
          this.connected = false;
          this.mediaNode = null;
          try { el.volume = this._muted ? 0 : this._volume; } catch (err) {}
        }
      }

      el.addEventListener('ended', () => {
        this.playing = false;
        this.ended = true;
        this._pausedAt = this._duration;
        if (this._onEnded) this._onEnded();
      });
      return el;
    }

    /** Load a chapter's audio source. Resolves when metadata + enough data is ready. */
    async load(chapter, onProgress) {
      const gen = ++this._loadGen;
      this.error = null;
      this.ready = false;
      this.ended = false;
      this.playing = false;
      this.slug = chapter.slug;
      this.src = chapter.file;
      this._pausedAt = 0;
      this._baseSong = 0;
      this._basePerf = 0;
      this._duration = 0;
      this.setKey(chapter.key);
      try {
        await this.ensure();
        const el = await this._makeElement();
        if (gen !== this._loadGen) throw new Error('Загрузка отменена');
        el.pause();
        el.src = this.src;
        el.load();
        this._attachProgress(el, onProgress);

        await new Promise((resolve, reject) => {
          let done = false;
          const timeout = setTimeout(() => {
            if (done) return;
            done = true;
            cleanup();
            reject(new Error('Не удалось дождаться загрузки трека'));
          }, 30000);
          const ok = () => {
            if (done) return;
            // Wait for real metadata: duration is what the song clock and the
            // ending check need. A stale readyState from the previous track is
            // not enough.
            const dur = Number(el.duration);
            if (Number.isFinite(dur) && dur > 0 && el.readyState >= 2) {
              done = true;
              cleanup();
              resolve();
            }
          };
          const err = () => {
            if (done) return;
            done = true;
            cleanup();
            reject(new Error('Браузер не смог открыть Opus-трек'));
          };
          const cleanup = () => {
            clearTimeout(timeout);
            el.removeEventListener('canplay', ok);
            el.removeEventListener('loadeddata', ok);
            el.removeEventListener('loadedmetadata', ok);
            el.removeEventListener('durationchange', ok);
            el.removeEventListener('error', err);
          };
          el.addEventListener('canplay', ok);
          el.addEventListener('loadeddata', ok);
          el.addEventListener('loadedmetadata', ok);
          el.addEventListener('durationchange', ok);
          el.addEventListener('error', err);
          ok();
        });

        if (gen !== this._loadGen) throw new Error('Загрузка отменена');
        this._duration = Number.isFinite(el.duration) && el.duration > 0 ? el.duration : 0;
        this.ready = true;
        if (onProgress) onProgress(1, this._duration);
        return true;
      } catch (e) {
        if (gen === this._loadGen) {
          this.error = e;
          this.ready = false;
          if (onProgress) onProgress(0, 0, e);
        }
        throw e;
      }
    }

    _attachProgress(el, onProgress) {
      if (this._progressHandlers) {
        el.removeEventListener('progress', this._progressHandlers.read);
        el.removeEventListener('loadedmetadata', this._progressHandlers.read);
        this._progressHandlers = null;
      }
      if (!onProgress) return;
      const read = () => {
        let p = 0;
        try {
          if (el.buffered && el.buffered.length && el.duration > 0) {
            p = el.buffered.end(el.buffered.length - 1) / el.duration;
          }
        } catch (e) {}
        if (!p && el.readyState >= 2) p = 0.55;
        if (el.duration > 0 && el.readyState >= 4) p = Math.max(p, 0.9);
        onProgress(clamp(p, 0, 0.98), el.duration || 0);
      };
      this._progressHandlers = { read };
      el.addEventListener('progress', read);
      el.addEventListener('loadedmetadata', read);
      read();
    }

    get _rawTime() {
      if (!this.ready) return 0;
      if (!this.playing) return this._pausedAt;
      let t = this._baseSong + (performance.now() - this._basePerf) / 1000 - this._latency;
      const now = performance.now();
      if (this.element && !this.element.paused && now - this._lastSync > 220) {
        this._lastSync = now;
        const mt = this.element.currentTime - this._latency;
        if (Number.isFinite(mt) && Math.abs(t - mt) > 0.09) {
          this._baseSong = mt;
          this._basePerf = now;
          t = mt;
        }
      }
      return clamp(t, 0, this._duration || 1e9);
    }

    /** Clock used for note movement. */
    get time() {
      const t = this._rawTime;
      this._lastTime = t;
      return t;
    }

    /** Clock used for judgement: manual calibration shifts the input. */
    get judgeTime() {
      return clamp(this._rawTime - this._offset, 0, this._duration || 1e9);
    }

    get progress() {
      return this._duration ? clamp(this.time / this._duration, 0, 1) : 0;
    }

    get finished() {
      if (!this.ready) return false;
      return this.ended || (this._duration > 0 && this._rawTime >= this._duration - 0.08);
    }

    async play(from) {
      await this.ensure();
      const el = await this._makeElement();
      if (this.ctx && this.ctx.state === 'suspended') {
        try { await this.ctx.resume(); } catch (e) {}
      }
      this._updateLatency();
      from = clamp(from || 0, 0, Math.max(0, this._duration - 0.03));
      this.ended = false;
      this.playing = true;
      this._pausedAt = from;
      this._baseSong = from;
      this._basePerf = performance.now();
      this._lastSync = this._basePerf;
      try {
        if (Math.abs(el.currentTime - from) > 0.04) el.currentTime = from;
      } catch (e) {}
      try {
        await el.play();
      } catch (e) {
        this.playing = false;
        throw e;
      }
      // Re-anchor once the element really started: the first frame after a
      // user gesture can be a few tens of milliseconds late.
      this._updateLatency();
      this._basePerf = performance.now();
      this._lastSync = this._basePerf;
      try {
        const ct = el.currentTime;
        if (Number.isFinite(ct)) this._baseSong = ct;
      } catch (e) {}
    }

    pause() {
      if (!this.playing) return;
      const t = this._rawTime;
      this._pausedAt = clamp(t, 0, this._duration || t);
      this.playing = false;
      if (this.element) {
        try { this.element.pause(); } catch (e) {}
      }
    }

    async resume() {
      if (this.playing) return;
      await this.play(this._pausedAt);
    }

    async restart() {
      if (this.element) {
        try { this.element.pause(); } catch (e) {}
      }
      await this.play(0);
    }

    stop() {
      this.playing = false;
      this.ended = false;
      this._pausedAt = 0;
      this._baseSong = 0;
      this._basePerf = 0;
      if (this.element) {
        try { this.element.pause(); this.element.currentTime = 0; } catch (e) {}
      }
    }

    suspend() {
      if (this.ctx && this.ctx.state === 'running') {
        try { this.ctx.suspend(); } catch (e) {}
      }
    }
    async wake() {
      if (this.ctx && this.ctx.state === 'suspended') {
        try { await this.ctx.resume(); } catch (e) {}
      }
    }

    getLevels() {
      if (!this.analyser || !this.ready || !this.connected) {
        return this._levels;
      }
      const n = this.analyser.frequencyBinCount;
      if (!this._freq || this._freq.length !== n) this._freq = new Uint8Array(n);
      this.analyser.getByteFrequencyData(this._freq);
      const sr = this.ctx.sampleRate;
      const hz = sr / this.analyser.fftSize;
      const avg = (lo, hi) => {
        const a = Math.max(0, Math.floor(lo / hz));
        const b = Math.min(n - 1, Math.ceil(hi / hz));
        let s = 0, c = 0;
        for (let i = a; i <= b; i++) { s += this._freq[i]; c++; }
        return c ? s / c / 255 : 0;
      };
      const bass = avg(24, 160);
      const mid = avg(220, 2200);
      const high = avg(2600, 10500);
      this._levels.bass = bass;
      this._levels.mid = mid;
      this._levels.high = high;
      this._levels.level = clamp((bass * 1.1 + mid + high * 0.8) / 2.4, 0, 1);
      return this._levels;
    }

    // ------------------------------------------------------------ tiny SFX
    _tone(freq, dur, vol, type, when, pan) {
      if (!this.sfxOn || !this.ctx || this.ctx.state !== 'running') return;
      const t0 = (when || this.ctx.currentTime) + 0.002;
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = type || 'sine';
      o.frequency.setValueAtTime(freq, t0);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.linearRampToValueAtTime(vol, t0 + 0.006);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      if (this.ctx.createStereoPanner && pan !== undefined) {
        const p = this.ctx.createStereoPanner();
        p.pan.value = pan;
        o.connect(g); g.connect(p); p.connect(this.sfxGain);
      } else {
        o.connect(g); g.connect(this.sfxGain);
      }
      o.start(t0);
      o.stop(t0 + dur + 0.05);
    }

    tick(kind, lane) {
      const roots = { G: 196.0, Em: 164.81, Fm: 174.61, Am: 220.0, Dm: 146.83 };
      const root = roots[this._key] || 196;
      const scale = [1, 1.2, 1.5, 2, 2.4];
      const f = root * scale[LaneClamp(lane)] * (kind === 'perfect' ? 1.5 : 1);
      const pan = (lane - 1.5) * 0.26;
      if (kind === 'miss') {
        this._tone(root * 0.5, 0.16, 0.012, 'sine', undefined, pan);
        return;
      }
      const vol = kind === 'perfect' ? 0.028 : kind === 'good' ? 0.020 : 0.014;
      this._tone(f, kind === 'perfect' ? 0.18 : 0.12, vol, kind === 'perfect' ? 'triangle' : 'sine', undefined, pan);
      if (kind === 'perfect') {
        this._tone(f * 2, 0.12, 0.008, 'sine', this.ctx.currentTime + 0.035, pan);
      }
    }

    chime() {
      if (!this.sfxOn || !this.ctx) return;
      const base = { G: 392, Em: 329.63, Fm: 349.23, Am: 440, Dm: 293.66 }[this._key] || 392;
      const notes = [1, 1.25, 1.5, 2];
      notes.forEach((m, i) => {
        this._tone(base * m, 0.9, 0.018, 'sine', this.ctx.currentTime + i * 0.055, (i - 1.5) * 0.1);
      });
    }

    pluck() {
      this._tone(130, 0.08, 0.012, 'triangle');
    }
  }

  function LaneClamp(l) { return Math.max(0, Math.min(4, l | 0)); }

  window.TRO_AUDIO = TROAudio;
})();
