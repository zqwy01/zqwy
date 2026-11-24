/* Audio engine: buffer playback, precise song clock, analyser, vinyl stop. */
(function () {
  'use strict';

  const TRACKS = [
    'assets/drill_to_the_neighbor.mp3',
    'assets/drill_to_the_neighbor.ogg'
  ];

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

  class DrillAudio {
    constructor() {
      this.ctx = null;
      this.master = null;
      this.musicGain = null;
      this.sfxGain = null;
      this.analyser = null;
      this.mode = null;
      this.buffer = null;
      this.element = null;
      this.mediaNode = null;
      this.source = null;
      this.ready = false;
      this.loading = null;
      this.playing = false;
      this.ended = false;
      this.pausedAt = 0;
      this.startOffset = 0;
      this.startCtx = 0;
      this._duration = 0;
      this._stopRequested = false;
      this._levels = { bass: 0, mid: 0, high: 0, level: 0 };
      this.volume = 0.86;
      this.muted = false;
      this.onEnded = null;
      this.error = null;
    }

    async _ensureContext() {
      if (this.ctx) return;
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) throw new Error('Web Audio API недоступен в этом браузере');
      this.ctx = new AC({ latencyHint: 'interactive' });
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : this.volume;
      this.master.connect(this.ctx.destination);
      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = 1;
      this.musicGain.connect(this.master);
      this.analyser = this.ctx.createAnalyser();
      this.analyser.fftSize = 512;
      this.analyser.smoothingTimeConstant = 0.78;
      this.analyser.connect(this.musicGain);
      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.value = 0.42;
      this.sfxGain.connect(this.master);
    }

    async unlock() {
      await this._ensureContext();
      if (this.ctx.state === 'suspended') await this.ctx.resume();
    }

    async load(onProgress) {
      if (this.ready) { if (onProgress) onProgress(1); return this; }
      if (this.loading) return this.loading;
      this.loading = this._load(onProgress);
      try {
        await this.loading;
      } finally {
        this.loading = null;
      }
      return this;
    }

    async _load(onProgress) {
      await this._ensureContext();
      let loaded = false;
      for (const url of TRACKS) {
        try {
          const buf = await this._fetchDecode(url, onProgress);
          this.buffer = buf;
          this._duration = buf.duration;
          this.mode = 'buffer';
          loaded = true;
          break;
        } catch (e) { /* next */ }
      }
      if (!loaded) {
        for (const url of TRACKS) {
          try {
            await this._setupElement(url, onProgress);
            this.mode = 'element';
            loaded = true;
            break;
          } catch (e) { /* next */ }
        }
      }
      if (!loaded) {
        this.error = new Error('Не удалось загрузить трек');
        throw this.error;
      }
      this.ready = true;
      if (onProgress) onProgress(1);
      return this;
    }

    async _fetchDecode(url, onProgress) {
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      let data;
      if (res.body && res.body.getReader) {
        const reader = res.body.getReader();
        const chunks = [];
        let got = 0;
        const total = Number(res.headers.get('content-length') || 0);
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          chunks.push(value);
          got += value.length;
          if (onProgress && total) onProgress(clamp(got / total, 0, 0.95));
        }
        const arr = new Uint8Array(got);
        let off = 0;
        for (const c of chunks) { arr.set(c, off); off += c.length; }
        data = arr.buffer;
      } else {
        data = await res.arrayBuffer();
      }
      return await this.ctx.decodeAudioData(data.slice(0));
    }

    _setupElement(url, onProgress) {
      return new Promise((resolve, reject) => {
        const el = document.createElement('audio');
        el.preload = 'auto';
        el.src = url;
        el.setAttribute('playsinline', '');
        el.style.display = 'none';
        document.body.appendChild(el);
        let done = false;
        const to = setTimeout(() => {
          if (done) return;
          done = true;
          cleanup();
          try { el.remove(); } catch (e) {}
          reject(new Error('timeout'));
        }, 20000);
        const cleanup = () => {
          clearTimeout(to);
          el.removeEventListener('loadedmetadata', meta);
          el.removeEventListener('canplay', ok);
          el.removeEventListener('error', fail);
        };
        const meta = () => {
          if (Number.isFinite(el.duration) && el.duration > 0) {
            this._duration = el.duration;
            if (onProgress) onProgress(0.75);
          }
        };
        const ok = () => {
          if (done) return;
          done = true;
          cleanup();
          this.element = el;
          try {
            this.mediaNode = this.ctx.createMediaElementSource(el);
            this.mediaNode.connect(this.analyser);
          } catch (e) { /* analyser is optional */ }
          el.addEventListener('ended', () => {
            if (this.mode !== 'element') return;
            this.playing = false;
            this.ended = true;
            this.pausedAt = this._duration;
            if (this.onEnded) this.onEnded();
          });
          if (Number.isFinite(el.duration)) this._duration = el.duration;
          resolve();
        };
        const fail = () => {
          if (done) return;
          done = true;
          cleanup();
          try { el.remove(); } catch (e) {}
          reject(new Error('audio element error'));
        };
        el.addEventListener('loadedmetadata', meta);
        el.addEventListener('canplay', ok);
        el.addEventListener('error', fail);
        if (onProgress) onProgress(0.2);
        el.load();
      });
    }

    get duration() { return this._duration || 0; }

    get latency() {
      if (!this.ctx) return 0;
      const out = this.ctx.outputLatency;
      if (Number.isFinite(out) && out > 0) return out;
      const base = this.ctx.baseLatency;
      return Number.isFinite(base) ? base : 0;
    }

    get time() {
      if (!this.ready) return 0;
      if (this.mode === 'element') {
        if (!this.playing || !this.element) return this.pausedAt;
        return clamp(this.element.currentTime - this.latency, 0, this._duration);
      }
      if (!this.playing || !this.ctx) return this.pausedAt;
      return clamp(this.startOffset + (this.ctx.currentTime - this.startCtx) - this.latency, 0, this._duration);
    }

    async start(from) {
      if (!this.ready) throw new Error('Трек ещё не загружен');
      await this.unlock();
      const offset = clamp(Number(from) || 0, 0, Math.max(0, this._duration - 0.02));
      this._stopRequested = true;
      if (this.source) {
        try { this.source.stop(); } catch (e) {}
        this.source = null;
      }
      this._stopRequested = false;
      this.ended = false;
      this.pausedAt = offset;
      this.musicGain.gain.cancelScheduledValues(this.ctx.currentTime);
      this.musicGain.gain.setValueAtTime(1, this.ctx.currentTime);

      if (this.mode === 'buffer') {
        const src = this.ctx.createBufferSource();
        src.buffer = this.buffer;
        src.connect(this.analyser);
        const when = this.ctx.currentTime + 0.06;
        this.source = src;
        this.startOffset = offset;
        this.startCtx = when;
        this.playing = true;
        src.onended = () => {
          if (this.source !== src) return;
          if (this._stopRequested) return;
          this.playing = false;
          this.ended = true;
          this.pausedAt = this._duration;
          this.source = null;
          if (this.onEnded) this.onEnded();
        };
        src.start(when, offset);
      } else {
        this.startOffset = offset;
        this.element.currentTime = offset;
        this.playing = true;
        try { await this.element.play(); } catch (e) { this.playing = false; throw e; }
      }
      return this;
    }

    pause() {
      if (!this.playing) return;
      const at = this.time;
      this.pausedAt = at;
      if (this.mode === 'buffer') {
        this._stopRequested = true;
        if (this.source) {
          try { this.source.stop(); } catch (e) {}
          this.source = null;
        }
        this.playing = false;
      } else if (this.element) {
        this.element.pause();
        this.playing = false;
      }
    }

    async resume() {
      if (!this.ready) return;
      await this.start(this.pausedAt);
    }

    stopNow() {
      this.pausedAt = this.time;
      this._stopRequested = true;
      if (this.mode === 'buffer') {
        if (this.source) {
          try { this.source.stop(); } catch (e) {}
          this.source = null;
        }
      } else if (this.element) {
        try { this.element.pause(); } catch (e) {}
      }
      this.playing = false;
    }

    stopVinyl() {
      if (!this.ready) return;
      const at = this.time;
      this.pausedAt = at;
      if (this.mode === 'buffer' && this.source && this.ctx) {
        const src = this.source;
        const now = this.ctx.currentTime;
        this._stopRequested = true;
        try {
          const rate = src.playbackRate;
          rate.cancelScheduledValues(now);
          rate.setValueAtTime(1, now);
          rate.exponentialRampToValueAtTime(0.015, now + 0.42);
          this.musicGain.gain.cancelScheduledValues(now);
          this.musicGain.gain.setValueAtTime(this.musicGain.gain.value || 1, now);
          this.musicGain.gain.linearRampToValueAtTime(0, now + 0.42);
          src.stop(now + 0.44);
        } catch (e) {}
        this.source = null;
        this.playing = false;
      } else {
        this.stopNow();
      }
      this.sfx('vinyl');
    }

    toggleMute() {
      this.muted = !this.muted;
      if (this.master) this.master.gain.value = this.muted ? 0 : this.volume;
      return this.muted;
    }

    levels() {
      if (!this.analyser) return this._levels;
      const bins = this.analyser.frequencyBinCount;
      const data = new Uint8Array(bins);
      this.analyser.getByteFrequencyData(data);
      let b = 0, m = 0, h = 0, all = 0;
      const bassEnd = Math.max(1, Math.floor(bins * 0.09));
      const midEnd = Math.floor(bins * 0.55);
      for (let i = 0; i < bins; i++) {
        const v = data[i] / 255;
        all += v;
        if (i < bassEnd) b += v;
        else if (i < midEnd) m += v;
        else h += v;
      }
      this._levels.bass = b / bassEnd;
      this._levels.mid = m / Math.max(1, midEnd - bassEnd);
      this._levels.high = h / Math.max(1, bins - midEnd);
      this._levels.level = all / bins;
      return this._levels;
    }

    sfx(type, extra) {
      if (!this.ctx || this.muted) return;
      const now = this.ctx.currentTime;
      const g = this.ctx.createGain();
      g.connect(this.sfxGain);
      const tone = (freq, endFreq, dur, gain, wave) => {
        const o = this.ctx.createOscillator();
        o.type = wave || 'sine';
        o.frequency.setValueAtTime(freq, now);
        if (endFreq) o.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), now + dur);
        g.gain.setValueAtTime(0.0001, now);
        g.gain.exponentialRampToValueAtTime(gain, now + 0.008);
        g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
        o.connect(g);
        o.start(now);
        o.stop(now + dur + 0.02);
      };
      if (type === 'hit') {
        tone(extra ? 920 : 760, 230, extra ? 0.14 : 0.1, 0.24, 'triangle');
        tone(extra ? 1380 : 1120, 420, 0.08, 0.08, 'square');
      } else if (type === 'perfect') {
        tone(640, 1280, 0.16, 0.16, 'triangle');
        tone(960, 1900, 0.12, 0.09, 'sine');
      } else if (type === 'fizzle') {
        tone(150, 70, 0.14, 0.18, 'sawtooth');
      } else if (type === 'hurt') {
        tone(95, 38, 0.3, 0.3, 'sawtooth');
      } else if (type === 'warn') {
        tone(330, 280, 0.08, 0.05, 'sine');
      } else if (type === 'heal') {
        tone(520, 1040, 0.28, 0.12, 'sine');
        tone(780, 1560, 0.22, 0.07, 'triangle');
      } else if (type === 'win') {
        tone(392, 392, 0.5, 0.12, 'triangle');
        tone(523, 523, 0.5, 0.09, 'sine');
        tone(784, 784, 0.65, 0.07, 'sine');
      } else if (type === 'vinyl') {
        // Short filtered noise scrape, plus a falling tone.
        const len = Math.floor(this.ctx.sampleRate * 0.42);
        const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
        const d = buf.getChannelData(0);
        for (let i = 0; i < len; i++) {
          const k = 1 - i / len;
          d[i] = (Math.random() * 2 - 1) * k * k * 0.5;
        }
        const src = this.ctx.createBufferSource();
        src.buffer = buf;
        const filt = this.ctx.createBiquadFilter();
        filt.type = 'bandpass';
        filt.frequency.setValueAtTime(1800, now);
        filt.frequency.exponentialRampToValueAtTime(180, now + 0.4);
        const ng = this.ctx.createGain();
        ng.gain.setValueAtTime(0.18, now);
        ng.gain.linearRampToValueAtTime(0.0001, now + 0.45);
        src.connect(filt).connect(ng).connect(this.sfxGain);
        src.start(now);
        src.stop(now + 0.46);
        tone(210, 40, 0.4, 0.12, 'sawtooth');
      }
    }
  }

  window.DrillAudio = DrillAudio;
})();
