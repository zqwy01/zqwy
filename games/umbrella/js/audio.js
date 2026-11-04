/* НЕМЕТОН — audio engine: precise clock, analyser and tiny ritual ticks. */
(function () {
  'use strict';

  const TRACK = 'assets/umbrella.wav';
  const TRACK_ALT = 'assets/umbrella.ogg';

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

  class NemetonAudio {
    constructor() {
      this.ctx = null;
      this.master = null;
      this.sfxGain = null;
      this.analyser = null;
      this.mode = null;
      this.buffer = null;
      this.element = null;
      this.source = null;
      this.mediaNode = null;
      this.ready = false;
      this.error = null;
      this.playing = false;
      this.ended = false;
      this.pausedAt = 0;
      this.startOffset = 0;
      this.startCtx = 0;
      this.baseSong = 0;
      this.basePerf = 0;
      this._duration = 0;
      this._stopRequested = false;
      this.offset = 0;
      this.volume = 0.9;
      this.sfxOn = true;
      this._freq = null;
      this._levels = { bass: 0, mid: 0, high: 0 };
    }

    async _ensureContext() {
      if (this.ctx) return;
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) throw new Error('Web Audio API недоступен в этом браузере');
      this.ctx = new AC({ latencyHint: 'interactive' });
      this.master = this.ctx.createGain();
      this.master.gain.value = this.volume;
      this.analyser = this.ctx.createAnalyser();
      this.analyser.fftSize = 1024;
      this.analyser.smoothingTimeConstant = 0.72;
      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.value = 0.9;
      this.analyser.connect(this.master);
      this.master.connect(this.ctx.destination);
      this.sfxGain.connect(this.ctx.destination);
    }

    async load(onProgress) {
      try {
        await this._ensureContext();
        const urls = [TRACK, TRACK_ALT];
        let loaded = false;
        for (const url of urls) {
          try {
            const buf = await this._fetchDecode(url, onProgress);
            this.buffer = buf;
            this._duration = buf.duration;
            this.mode = 'buffer';
            loaded = true;
            break;
          } catch (e) {
            // try next source
          }
        }
        if (!loaded) {
          // file:// fallback: <audio> element
          for (const url of urls) {
            try {
              await this._setupElement(url, onProgress);
              this.mode = 'element';
              loaded = true;
              break;
            } catch (e) { /* next */ }
          }
        }
        if (!loaded) throw new Error('Не удалось загрузить трек');
        this.ready = true;
        if (onProgress) onProgress(1, this._duration);
        return true;
      } catch (e) {
        this.error = e;
        this.ready = false;
        if (onProgress) onProgress(0, 0, e);
        throw e;
      }
    }

    async _fetchDecode(url, onProgress) {
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      let arr;
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
          if (onProgress && total) onProgress(clamp(got / total, 0, 0.92), 0);
        }
        arr = new Uint8Array(got);
        let off = 0;
        for (const c of chunks) { arr.set(c, off); off += c.length; }
        arr = arr.buffer;
      } else {
        arr = await res.arrayBuffer();
      }
      const buf = await this.ctx.decodeAudioData(arr.slice(0));
      return buf;
    }

    _setupElement(url, onProgress) {
      return new Promise((resolve, reject) => {
        const el = document.createElement('audio');
        el.preload = 'auto';
        el.src = url;
        el.style.display = 'none';
        el.setAttribute('playsinline', '');
        document.body.appendChild(el);
        let done = false;
        const to = setTimeout(() => {
          if (!done) { done = true; cleanup(); reject(new Error('timeout')); }
        }, 20000);
        const cleanup = () => {
          clearTimeout(to);
          el.removeEventListener('canplaythrough', ok);
          el.removeEventListener('loadedmetadata', meta);
          el.removeEventListener('error', fail);
        };
        const meta = () => {
          if (Number.isFinite(el.duration) && el.duration > 0) {
            this._duration = el.duration;
            if (onProgress) onProgress(0.6, 0);
          }
        };
        const ok = () => {
          if (done) return;
          done = true;
          cleanup();
          this.element = el;
          this.mediaNode = this.ctx.createMediaElementSource(el);
          this.mediaNode.connect(this.analyser);
          el.addEventListener('ended', () => {
            this.playing = false;
            this.ended = true;
            this.pausedAt = this._duration;
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
        el.addEventListener('canplaythrough', ok, { once: true });
        el.addEventListener('error', fail, { once: true });
        el.load();
        if (onProgress) onProgress(0.2, 0);
      });
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
      let t;
      if (this.mode === 'buffer') {
        if (!this.playing) return this.pausedAt;
        t = this.startOffset + (this.ctx.currentTime - this.startCtx) - this.latency;
      } else if (this.mode === 'element') {
        if (!this.playing) return this.pausedAt;
        const now = performance.now();
        t = this.baseSong + (now - this.basePerf) / 1000 - this.latency;
        if (this.element && !this.element.paused) {
          const mt = this.element.currentTime - this.latency;
          if (Number.isFinite(mt) && Math.abs(t - mt) > 0.11) {
            this.baseSong = mt;
            this.basePerf = now;
            t = mt;
          }
        }
      } else {
        return 0;
      }
      return clamp(t, 0, this._duration || 1e9);
    }

    get time() {
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
      this.ended = false;
      this._stopRequested = false;
      from = clamp(from || 0, 0, Math.max(0, this._duration - 0.05));
      if (this.mode === 'buffer') {
        this._stopSource();
        const src = this.ctx.createBufferSource();
        src.buffer = this.buffer;
        src.connect(this.analyser);
        const when = this.ctx.currentTime + 0.045;
        this.source = src;
        this.startOffset = from;
        this.startCtx = when;
        this.playing = true;
        this.pausedAt = from;
        src.onended = () => {
          if (this._stopRequested) return;
          this.playing = false;
          this.ended = true;
          this.pausedAt = this._duration;
        };
        try { src.start(when, from); } catch (e) {
          // some browsers dislike offset beyond duration
          this.playing = false;
          throw e;
        }
      } else if (this.mode === 'element') {
        this.element.currentTime = from;
        this.baseSong = from;
        this.basePerf = performance.now();
        this.playing = true;
        this.pausedAt = from;
        try {
          await this.element.play();
        } catch (e) {
          this.playing = false;
          throw e;
        }
      }
    }

    pause() {
      if (!this.playing) return;
      const t = this._rawTime;
      this.pausedAt = clamp(t, 0, this._duration);
      this.playing = false;
      if (this.mode === 'buffer') {
        this._stopSource();
      } else if (this.mode === 'element' && this.element) {
        try { this.element.pause(); } catch (e) {}
      }
    }

    async resume() {
      if (this.playing) return;
      await this.play(this.pausedAt);
    }

    async restart() {
      if (this.mode === 'element' && this.element) {
        try { this.element.pause(); } catch (e) {}
      }
      this.pausedAt = 0;
      await this.play(0);
    }

    _stopSource() {
      if (this.source) {
        this._stopRequested = true;
        try { this.source.onended = null; this.source.stop(); } catch (e) {}
        try { this.source.disconnect(); } catch (e) {}
        this.source = null;
      }
    }

    stop() {
      this.playing = false;
      this.pausedAt = 0;
      if (this.mode === 'buffer') this._stopSource();
      if (this.mode === 'element' && this.element) {
        try { this.element.pause(); this.element.currentTime = 0; } catch (e) {}
      }
    }

    get finished() {
      if (!this.ready) return false;
      return this.ended || (this._duration > 0 && this._rawTime >= this._duration - 0.06);
    }

    setVolume(v) {
      this.volume = clamp(v, 0, 1);
      if (this.master) this.master.gain.value = this.volume;
    }

    setOffsetMs(ms) {
      this.offset = clamp(ms, -250, 250) / 1000;
    }

    getLevels() {
      if (!this.analyser || !this.ready) return this._levels;
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
      return this._levels;
    }

    tick(kind, lane, ins) {
      if (!this.sfxOn || !this.ctx || this.ctx.state !== 'running') return;
      const now = this.ctx.currentTime + 0.002;
      const CFG = {
        kick:    { f: 86,   type: 'sine',     dur: 0.16, vol: 0.052 },
        snare:   { f: 330,  type: 'triangle', dur: 0.10, vol: 0.030 },
        snare_rev:   { f: 300, type: 'triangle', dur: 0.15, vol: 0.026 },
        snare_rev2:  { f: 300, type: 'triangle', dur: 0.15, vol: 0.026 },
        perc:    { f: 520,  type: 'triangle', dur: 0.09, vol: 0.024 },
        perc3:   { f: 640,  type: 'triangle', dur: 0.08, vol: 0.018 },
        hhat:    { f: 2100, type: 'square',   dur: 0.045, vol: 0.007 },
        ohat:    { f: 1700, type: 'square',   dur: 0.075, vol: 0.008 },
        cowbell: { f: 870,  type: 'square',   dur: 0.10, vol: 0.012 },
        crash:   { f: 1460, type: 'triangle', dur: 0.16, vol: 0.015 },
        violin:  { f: 660,  type: 'triangle', dur: 0.13, vol: 0.022 },
        flute:   { f: 1046, type: 'sine',     dur: 0.14, vol: 0.021 },
        piano:   { f: 523,  type: 'sine',     dur: 0.13, vol: 0.020 },
        harpa:   { f: 784,  type: 'sine',     dur: 0.15, vol: 0.020 }
      };
      const c = CFG[ins] || { f: 760, type: 'triangle', dur: 0.11, vol: 0.020 };
      const qMul = kind === 'perfect' ? 1.12 : kind === 'good' ? 1 : kind === 'ok' ? 0.9 : 0.55;
      const base = c.f * qMul;
      const vol = c.vol * (kind === 'perfect' ? 1.15 : kind === 'good' ? 0.9 : kind === 'ok' ? 0.7 : 0.55);
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      if (this.ctx.createStereoPanner) {
        const pan = this.ctx.createStereoPanner();
        pan.pan.value = (lane - 1.5) * -0.22;
        g.connect(pan);
        pan.connect(this.sfxGain);
      } else {
        g.connect(this.sfxGain);
      }
      osc.type = kind === 'miss' ? 'sine' : c.type;
      osc.frequency.setValueAtTime(base, now);
      if (ins === 'kick') {
        osc.frequency.exponentialRampToValueAtTime(base * 0.52, now + 0.095);
      } else if (kind === 'perfect') {
        osc.frequency.exponentialRampToValueAtTime(base * (ins === 'flute' ? 1.35 : 1.22), now + 0.07);
      } else if (kind !== 'miss') {
        osc.frequency.exponentialRampToValueAtTime(base * 0.94, now + 0.05);
      }
      const dur = c.dur * (kind === 'miss' ? 1.4 : 1);
      g.gain.setValueAtTime(0.0001, now);
      g.gain.linearRampToValueAtTime(vol, now + 0.004);
      g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
      osc.connect(g);
      osc.start(now);
      osc.stop(now + dur + 0.04);
    }

    blessingChime() {
      if (!this.sfxOn || !this.ctx || this.ctx.state !== 'running') return;
      const now = this.ctx.currentTime + 0.01;
      const notes = [523.25, 659.25, 783.99, 1046.5];
      notes.forEach((f, i) => {
        const o = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        o.type = 'sine';
        o.frequency.value = f;
        g.gain.setValueAtTime(0.0001, now + i * 0.03);
        g.gain.linearRampToValueAtTime(0.022, now + i * 0.03 + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, now + 0.90 + i * 0.05);
        o.connect(g);
        g.connect(this.sfxGain);
        o.start(now + i * 0.03);
        o.stop(now + 1.05);
      });
    }
  }

  window.NemetonAudio = NemetonAudio;
})();
