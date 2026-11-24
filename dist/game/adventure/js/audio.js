/* «Клетчатый лист» — музыка и звуки.
   Музыка: три зацикленных трека из mice_inside (ogg + mp3) с кроссфейдом.
   Звуковые эффекты: процедурный Web Audio (шаг, сердце, бумага, клики). */
(function () {
  'use strict';

  const GROUPS = [
    {
      id: 'awakening',
      title: 'пробуждение',
      gain: 0.72,
      sources: ['assets/music/awakening.ogg', 'assets/music/awakening.mp3']
    },
    {
      id: 'exploration',
      title: 'исследование',
      gain: 0.66,
      sources: ['assets/music/exploration.ogg', 'assets/music/exploration.mp3']
    },
    {
      id: 'final',
      title: 'финал',
      gain: 0.60,
      sources: ['assets/music/final.ogg', 'assets/music/final.mp3']
    }
  ];

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

  class PaperAudio {
    constructor() {
      this.ctx = null;
      this.master = null;
      this.unlocked = false;
      this.muted = false;
      this.volume = 0.7;
      this.group = -1;
      this.started = false;
      this.elements = [];
      this.fadeTimer = 0;
      this.noiseBuffer = null;
      this.error = null;
      this._buildElements();
    }

    _buildElements() {
      for (let i = 0; i < GROUPS.length; i++) {
        const g = GROUPS[i];
        const a = document.createElement('audio');
        a.loop = true;
        a.preload = 'none';
        a.volume = 0;
        a.setAttribute('playsinline', '');
        a.setAttribute('aria-hidden', 'true');
        g.sources.forEach(src => {
          const s = document.createElement('source');
          s.src = src;
          s.type = /\.ogg$/i.test(src) ? 'audio/ogg' : 'audio/mpeg';
          a.appendChild(s);
        });
        a.addEventListener('error', () => { this.error = 'Не удалось загрузить музыку: ' + g.id; });
        this.elements.push(a);
      }
    }

    async unlock() {
      try {
        if (!this.ctx) {
          const AC = window.AudioContext || window.webkitAudioContext;
          if (AC) {
            this.ctx = new AC({ latencyHint: 'interactive' });
            this.master = this.ctx.createGain();
            this.master.gain.value = 0.9;
            this.master.connect(this.ctx.destination);
            this._makeNoise();
          }
        }
        if (this.ctx && this.ctx.state === 'suspended') await this.ctx.resume();
      } catch (e) {
        this.ctx = null;
      }
      this.unlocked = true;
      if (this.group >= 0) this._startElement(this.group);
    }

    _startElement(n) {
      const a = this.elements[n];
      if (!a) return;
      // Если браузер ещё не разрешил звук — попытка не страшна: play() вернёт reject.
      try {
        if (a.preload === 'none') {
          a.preload = 'auto';
          a.load();
        }
        const p = a.play();
        if (p && p.catch) {
          p.catch(() => {
            if (!this.unlocked) this.group = n;
          });
        }
      } catch (e) { /* без музыки игра остаётся играбельной */ }
    }

    preloadGroup(n) {
      const a = this.elements[n];
      if (!a || n === this.group) return;
      if (a.preload !== 'auto') {
        a.preload = 'auto';
        a.load();
      }
    }

    playGroup(n) {
      if (!GROUPS[n]) return;
      if (this.group === n && this.started) return;
      this.group = n;
      this.started = true;
      const target = this.elements[n];
      if (!target) return;
      const targetVol = this.muted ? 0 : clamp(this.volume * GROUPS[n].gain, 0, 1);

      // стартуем новый трек с нулевой громкости и плавно поднимаем
      target.volume = 0;
      this._startElement(n);
      this._fade(target, targetVol, 1400);

      // предзагружаем соседнюю группу заранее
      const next = this.elements[n + 1] ? n + 1 : 0;
      if (next !== n) setTimeout(() => this.preloadGroup(next), 2500);
    }

    _fade(target, targetVol, ms) {
      if (this.fadeTimer) clearInterval(this.fadeTimer);
      const start = performance.now();
      const from = new Map();
      this.elements.forEach(a => from.set(a, a.volume));
      this.fadeTimer = setInterval(() => {
        const t = clamp((performance.now() - start) / ms, 0, 1);
        const e = t * t * (3 - 2 * t);
        this.elements.forEach(a => {
          const to = a === target ? targetVol : 0;
          const v = from.get(a) + (to - from.get(a)) * e;
          a.volume = clamp(v, 0, 1);
        });
        if (t >= 1) {
          clearInterval(this.fadeTimer);
          this.fadeTimer = 0;
          this.elements.forEach(a => {
            if (a !== target) {
              try { a.pause(); } catch (err) {}
              a.volume = 0;
            }
          });
        }
      }, 40);
    }

    setVolume(v) {
      this.volume = clamp(v, 0, 1);
      if (this.fadeTimer) return; // не мешаем кроссфейду
      this.elements.forEach((a, i) => {
        if (i === this.group) a.volume = this.muted ? 0 : clamp(this.volume * GROUPS[i].gain, 0, 1);
      });
    }

    setMuted(m) {
      this.muted = !!m;
      if (this.fadeTimer) {
        clearInterval(this.fadeTimer);
        this.fadeTimer = 0;
      }
      this.elements.forEach((a, i) => {
        if (i === this.group) a.volume = this.muted ? 0 : clamp(this.volume * GROUPS[i].gain, 0, 1);
      });
    }

    toggleMuted() {
      this.setMuted(!this.muted);
      return this.muted;
    }

    // ---------- SFX ----------
    _makeNoise() {
      if (!this.ctx) return;
      const len = Math.floor(this.ctx.sampleRate * 0.35);
      const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
      this.noiseBuffer = buf;
    }

    _tone(freq, dur, type, gain, delay, slideTo) {
      if (!this.ctx || this.muted) return;
      const t0 = this.ctx.currentTime + (delay || 0);
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = type || 'sine';
      osc.frequency.setValueAtTime(freq, t0);
      if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(30, slideTo), t0 + dur);
      g.gain.setValueAtTime(0, t0);
      g.gain.linearRampToValueAtTime(gain, t0 + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      osc.connect(g);
      g.connect(this.master);
      osc.start(t0);
      osc.stop(t0 + dur + 0.02);
    }

    _noise(dur, freq, gain, delay, q) {
      if (!this.ctx || this.muted || !this.noiseBuffer) return;
      const t0 = this.ctx.currentTime + (delay || 0);
      const src = this.ctx.createBufferSource();
      src.buffer = this.noiseBuffer;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = freq;
      filter.Q.value = q || 1.2;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0, t0);
      g.gain.linearRampToValueAtTime(gain, t0 + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      src.connect(filter);
      filter.connect(g);
      g.connect(this.master);
      src.start(t0);
      src.stop(t0 + dur + 0.02);
    }

    step() {
      this._noise(0.075, 1500, 0.055, 0, 0.9);
      this._tone(190, 0.06, 'triangle', 0.018);
    }

    bump() {
      this._tone(120, 0.10, 'sine', 0.035);
    }

    heart() {
      const notes = [523.25, 659.25, 783.99, 1046.5];
      notes.forEach((f, i) => this._tone(f, 0.62, 'triangle', 0.055, i * 0.085));
      this._tone(1567.98, 0.9, 'sine', 0.022, 0.28);
      this._noise(0.35, 5000, 0.025, 0.05, 0.7);
    }

    openPage() {
      this._noise(0.24, 900, 0.035, 0, 0.6);
      this._tone(392, 0.28, 'sine', 0.035);
      this._tone(587.33, 0.3, 'sine', 0.026, 0.05);
    }

    click() {
      this._tone(660, 0.05, 'square', 0.012);
      this._noise(0.04, 2200, 0.018, 0, 1.4);
    }

    pause() {
      this._tone(440, 0.16, 'sine', 0.03);
      this._tone(330, 0.22, 'sine', 0.024, 0.06);
    }

    chirp() {
      this._tone(1200, 0.07, 'sine', 0.035, 0, 1700);
      this._tone(1500, 0.06, 'sine', 0.028, 0.09, 2000);
    }

    pageTurn() {
      this._noise(0.45, 1200, 0.04, 0, 0.5);
      this._tone(293.66, 0.5, 'sine', 0.026);
      this._tone(440, 0.55, 'sine', 0.02, 0.08);
    }
  }

  PaperAudio.GROUPS = GROUPS;
  window.PaperAudio = PaperAudio;
})();
