/* РИТМ-КАТАЛОГ — streaming audio engine.
   The collection is far too large to decode into memory, so tracks are played
   through an <audio> element and analysed through a MediaElementSource. */
(function () {
  'use strict';

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

  class CatalogAudio {
    constructor() {
      this.ctx = null;
      this.master = null;
      this.sfxGain = null;
      this.analyser = null;
      this.element = null;
      this.source = null;
      this.ready = false;
      this.error = null;
      this.playing = false;
      this._duration = 0;
      this._pausedAt = 0;
      this._baseSong = 0;
      this._basePerf = 0;
      this._stopRequested = false;
      this.offset = 0;
      this.volume = 0.85;
      this.sfxOn = true;
      this._freq = null;
      this._levels = { bass: 0, mid: 0, high: 0, all: 0 };
      this._url = '';
      this._listenStarted = 0;
      this.listenSeconds = 0;
    }

    async unlock() {
      await this._ensureContext();
      if (this.ctx.state === 'suspended') {
        try { await this.ctx.resume(); } catch (e) { /* user will click again */ }
      }
    }

    async _ensureContext() {
      if (this.ctx) return;
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) throw new Error('Браузер не поддерживает Web Audio API');
      this.ctx = new AC({ latencyHint: 'interactive' });
      this.master = this.ctx.createGain();
      this.master.gain.value = this.volume;
      this.analyser = this.ctx.createAnalyser();
      this.analyser.fftSize = 1024;
      this.analyser.smoothingTimeConstant = 0.74;
      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.value = 0.62;
      this.analyser.connect(this.master);
      this.master.connect(this.ctx.destination);
      this.sfxGain.connect(this.ctx.destination);
      this._createElement();
    }

    _createElement() {
      if (this.element) return;
      const el = document.createElement('audio');
      el.preload = 'auto';
      el.crossOrigin = 'anonymous';
      el.setAttribute('playsinline', '');
      el.style.display = 'none';
      document.body.appendChild(el);
      this.element = el;
      try {
        this.source = this.ctx.createMediaElementSource(el);
        this.source.connect(this.analyser);
      } catch (e) {
        this.source = null;
      }
      el.addEventListener('ended', () => {
        this.playing = false;
      });
    }

    async loadTrack(track, onProgress) {
      await this._ensureContext();
      if (this.ctx.state === 'suspended') {
        try { await this.ctx.resume(); } catch (e) {}
      }
      this.stop();
      this.ready = false;
      this.error = null;
      this._duration = Number(track.duration) || 0;
      this._url = track.path;
      this.listenSeconds = 0;
      this._listenStarted = 0;

      const el = this.element;
      el.src = track.path;
      el.load();

      await new Promise((resolve, reject) => {
        let settled = false;
        const timeout = setTimeout(() => finish(new Error('Трек не открылся за 30 секунд')), 30000);

        const cleanup = () => {
          clearTimeout(timeout);
          el.removeEventListener('loadedmetadata', meta);
          el.removeEventListener('canplay', ok);
          el.removeEventListener('error', fail);
          el.removeEventListener('progress', progress);
        };
        const finish = (err) => {
          if (settled) return;
          settled = true;
          cleanup();
          err ? reject(err) : resolve();
        };
        const meta = () => {
          if (Number.isFinite(el.duration) && el.duration > 0) this._duration = el.duration;
          if (onProgress) onProgress(0.25);
        };
        const progress = () => {
          if (!onProgress) return;
          try {
            if (el.buffered.length) {
              const end = el.buffered.end(el.buffered.length - 1);
              if (this._duration) onProgress(clamp(0.25 + end / this._duration * 0.65, 0.25, 0.9));
            }
          } catch (e) {}
        };
        const ok = () => {
          if (Number.isFinite(el.duration) && el.duration > 0) this._duration = el.duration;
          if (onProgress) onProgress(1);
          finish(null);
        };
        const fail = () => finish(new Error('Не удалось открыть аудиофайл'));

        el.addEventListener('loadedmetadata', meta);
        el.addEventListener('canplay', ok);
        el.addEventListener('error', fail);
        el.addEventListener('progress', progress);
        if (el.readyState >= 3) ok();
      });

      this.ready = true;
      return this._duration;
    }

    get duration() { return this._duration || 0; }

    get latency() {
      if (!this.ctx) return 0;
      const l = this.ctx.outputLatency;
      if (Number.isFinite(l) && l > 0) return l;
      const b = this.ctx.baseLatency;
      return Number.isFinite(b) ? b : 0;
    }

    get _rawTime() {
      if (!this.element || !this.ready) return this._pausedAt;
      if (!this.playing) {
        const ct = this.element.currentTime;
        return Number.isFinite(ct) ? ct : this._pausedAt;
      }
      const now = performance.now();
      let t = this._baseSong + (now - this._basePerf) / 1000 - this.latency;
      const mt = this.element.currentTime - this.latency;
      if (Number.isFinite(mt) && Math.abs(t - mt) > 0.12) {
        this._baseSong = mt;
        this._basePerf = now;
        t = mt;
      }
      return clamp(t, 0, this._duration || 1e9);
    }

    get time() {
      if (this.ready && this.playing) {
        if (this._listenStarted <= 0) this._listenStarted = this._rawTime;
        this.listenSeconds = Math.max(0, this._rawTime - this._listenStarted);
      }
      return clamp(this._rawTime - this.offset, 0, this._duration || 1e9);
    }

    get progress() {
      return this._duration ? clamp(this.time / this._duration, 0, 1) : 0;
    }

    async play(from) {
      await this._ensureContext();
      if (this.ctx.state === 'suspended') {
        try { await this.ctx.resume(); } catch (e) {}
      }
      if (!this.element) throw new Error('Аудио не готово');
      const el = this.element;
      const at = clamp(from || 0, 0, Math.max(0, this._duration - 0.05));
      try { el.currentTime = at; } catch (e) {}
      this._baseSong = at;
      this._basePerf = performance.now();
      this._pausedAt = at;
      this._listenStarted = at;
      this.playing = true;
      try {
        await el.play();
      } catch (e) {
        this.playing = false;
        throw e;
      }
    }

    pause() {
      if (!this.playing) return;
      const t = this._rawTime;
      this._pausedAt = clamp(t, 0, this._duration);
      this.playing = false;
      if (this.element) {
        try { this.element.pause(); } catch (e) {}
      }
    }

    async resume() {
      if (this.playing) return;
      await this.play(this._pausedAt);
    }

    stop() {
      this.playing = false;
      this._pausedAt = 0;
      if (this.element) {
        try { this.element.pause(); this.element.currentTime = 0; } catch (e) {}
      }
      this._levels.bass = this._levels.mid = this._levels.high = this._levels.all = 0;
    }

    get finished() {
      if (!this.ready || !this.element) return false;
      return this.element.ended || (this._duration > 0 && this.element.currentTime >= this._duration - 0.08);
    }

    setVolume(v) {
      this.volume = clamp(v, 0, 1);
      if (this.master) this.master.gain.value = this.volume;
    }

    setOffsetMs(ms) {
      this.offset = clamp(ms, -250, 250) / 1000;
    }

    getLevels() {
      if (!this.analyser || !this.ready) {
        const k = 0.86;
        this._levels.bass *= k; this._levels.mid *= k; this._levels.high *= k; this._levels.all *= k;
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
      this._levels.bass = avg(28, 160);
      this._levels.mid = avg(300, 2200);
      this._levels.high = avg(3800, 10500);
      this._levels.all = avg(40, 12000);
      return this._levels;
    }

    tick(kind, lane) {
      if (!this.sfxOn || !this.ctx || this.ctx.state !== 'running') return;
      const now = this.ctx.currentTime + 0.002;
      const baseFreq = [523.25, 659.25, 783.99, 1046.5][lane] || 660;
      const perfect = kind === 'perfect';
      const good = kind === 'good';
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      if (this.ctx.createStereoPanner) {
        const pan = this.ctx.createStereoPanner();
        pan.pan.value = (lane - 1.5) * 0.24;
        g.connect(pan);
        pan.connect(this.sfxGain);
      } else {
        g.connect(this.sfxGain);
      }
      osc.type = perfect ? 'sine' : good ? 'triangle' : 'sine';
      osc.frequency.setValueAtTime(perfect ? baseFreq * 1.5 : baseFreq, now);
      osc.frequency.exponentialRampToValueAtTime(
        perfect ? baseFreq * 2 : baseFreq * (good ? 1.1 : 0.92), now + 0.06
      );
      const vol = perfect ? 0.055 : good ? 0.038 : 0.026;
      const dur = perfect ? 0.16 : good ? 0.12 : 0.09;
      g.gain.setValueAtTime(0.0001, now);
      g.gain.linearRampToValueAtTime(vol, now + 0.005);
      g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
      osc.connect(g);
      osc.start(now);
      osc.stop(now + dur + 0.03);
    }

    missTick() {
      if (!this.sfxOn || !this.ctx || this.ctx.state !== 'running') return;
      const now = this.ctx.currentTime + 0.002;
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(160, now);
      osc.frequency.exponentialRampToValueAtTime(90, now + 0.14);
      g.gain.setValueAtTime(0.0001, now);
      g.gain.linearRampToValueAtTime(0.02, now + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);
      osc.connect(g);
      g.connect(this.sfxGain);
      osc.start(now);
      osc.stop(now + 0.2);
    }

    feverChime() {
      if (!this.sfxOn || !this.ctx || this.ctx.state !== 'running') return;
      const now = this.ctx.currentTime + 0.01;
      [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((f, i) => {
        const o = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        o.type = 'triangle';
        o.frequency.value = f;
        g.gain.setValueAtTime(0.0001, now + i * 0.035);
        g.gain.linearRampToValueAtTime(0.024, now + i * 0.035 + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, now + 0.9 + i * 0.05);
        o.connect(g);
        g.connect(this.sfxGain);
        o.start(now + i * 0.035);
        o.stop(now + 1.1);
      });
    }
  }

  window.CatalogAudio = CatalogAudio;
})();
