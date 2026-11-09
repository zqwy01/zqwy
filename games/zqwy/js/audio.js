/* Фоновый трек: один зацикленный файл на весь Лабиринт.
   Модуль также даёт настройкам небольшой API проигрывателя:
   play/pause/stop, перемотка и громкость. */
(function () {
  'use strict';

  const ZQ = window.ZQ;
  const C = ZQ.C;
  const rt = ZQ.rt;
  const dom = ZQ.dom;

  const audio = {
    cue: 'tablet',
    started: false,
    context: null,
    analyser: null,
    source: null,
    waveData: null,
    peaks: null,
    peakSamples: 720,
    peakPromise: null,
    peakFile: '',

    element() {
      return dom.soundtrack || null;
    },

    rate() {
      const value = Number(rt.termSettings && rt.termSettings.musicRate);
      return Number.isFinite(value) ? ZQ.clamp(value, 0.5, 2) : 1;
    },

    volume() {
      const value = Number(rt.termSettings && rt.termSettings.musicVolume);
      if (Number.isFinite(value)) return ZQ.clamp(value, 0, 1);
      const fallback = C.music && Number.isFinite(C.music.volume) ? C.music.volume : 0.55;
      return ZQ.clamp(fallback, 0, 1);
    },

    ensureAnalyser() {
      const el = this.element();
      if (!el) return;
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      try {
        if (!this.context) this.context = new Ctx();
        /* Контекст мог быть создан для декодирования волны до жеста
           пользователя. Если он остался suspended, звук пойдёт в
           анализатор, но не в колонки — поэтому будим его при каждом
           обращении, а не только при первом создании. */
        if (this.context.state === 'suspended') {
          const resumed = this.context.resume();
          if (resumed && typeof resumed.catch === 'function') resumed.catch(() => {});
        }
        if (this.analyser) return;
        if (!this.source) this.source = this.context.createMediaElementSource(el);
        this.analyser = this.context.createAnalyser();
        this.analyser.fftSize = 512;
        this.analyser.smoothingTimeConstant = 0.82;
        this.waveData = new Uint8Array(this.analyser.fftSize);
        this.source.connect(this.analyser);
        this.analyser.connect(this.context.destination);
      } catch (error) {
        this.analyser = null;
        this.waveData = null;
      }
    },

    /* Полная волна трека: файл декодируется целиком один раз, а не
       берётся из живого анализатора. Так плеер показывает весь трек,
       а не только последние доли секунды. */
    decodePeaks() {
      if (this.peaks && this.peaks.length) return Promise.resolve(this.peaks);
      if (this.peakPromise) return this.peakPromise;
      const el = this.element();
      if (!el || !C.music || !C.music.file) return Promise.resolve(null);
      const src = el.getAttribute('src') || C.music.file;
      if (this.peakFile && this.peakFile !== src) {
        this.peaks = null;
        this.peakPromise = null;
      }
      this.peakFile = src;
      this.ensureAnalyser();
      const ctx = this.context;
      if (!ctx || typeof window.fetch !== 'function') return Promise.resolve(null);

      const finish = (buffer) => {
        const count = this.peakSamples;
        const channels = Math.max(1, buffer.numberOfChannels || 1);
        const length = Math.max(1, buffer.length || 1);
        const data = [];
        for (let c = 0; c < channels; c += 1) {
          try {
            data.push(buffer.getChannelData(c));
          } catch (error) {
            /* пропускаем недоступный канал */
          }
        }
        if (!data.length) return null;
        const bucket = Math.max(1, Math.floor(length / count));
        const raw = new Array(count).fill(0);
        let global = 0;
        for (let i = 0; i < count; i += 1) {
          const start = i * bucket;
          const end = Math.min(length, start + bucket);
          let peak = 0;
          for (let c = 0; c < data.length; c += 1) {
            const channel = data[c];
            for (let j = start; j < end; j += 1) {
              const value = Math.abs(channel[j] || 0);
              if (value > peak) peak = value;
            }
          }
          raw[i] = peak;
          if (peak > global) global = peak;
        }
        this.peaks = raw.map((value) =>
          Math.max(0.035, Math.min(1, Math.pow(global > 0 ? value / global : 0, 0.72)))
        );
        if (typeof ZQ.drawMusicWave === 'function') ZQ.drawMusicWave();
        return this.peaks;
      };

      this.peakPromise = window.fetch(src, { cache: 'force-cache' })
        .then((response) => (response.ok ? response.arrayBuffer() : null))
        .then((buffer) => {
          if (!buffer) return null;
          const decoded = ctx.decodeAudioData(buffer);
          if (decoded && typeof decoded.then === 'function') {
            return decoded.then(finish);
          }
          return new Promise((resolve, reject) => {
            ctx.decodeAudioData(buffer, (result) => resolve(finish(result)), reject);
          });
        })
        .catch(() => null)
        .then((result) => {
          if (!result) this.peakPromise = null;
          return result;
        });
      return this.peakPromise;
    },

    waveform(bars) {
      const count = Math.max(8, Math.min(160, Math.round(bars || 64)));
      if (this.peaks && this.peaks.length) {
        const result = [];
        const total = this.peaks.length;
        for (let i = 0; i < count; i += 1) {
          const start = Math.floor((i / count) * total);
          const end = Math.max(start + 1, Math.floor(((i + 1) / count) * total));
          let peak = 0;
          for (let j = start; j < end && j < total; j += 1) {
            if (this.peaks[j] > peak) peak = this.peaks[j];
          }
          result.push(Math.max(0.035, peak));
        }
        return result;
      }
      const result = [];
      if (this.analyser && this.waveData) {
        try {
          this.analyser.getByteTimeDomainData(this.waveData);
          const step = Math.max(1, Math.floor(this.waveData.length / count));
          for (let i = 0; i < count; i += 1) {
            let peak = 0;
            for (let j = 0; j < step; j += 1) {
              peak = Math.max(peak, Math.abs(this.waveData[i * step + j] - 128) / 128);
            }
            result.push(Math.max(0.04, peak));
          }
          return result;
        } catch (error) {
          /* fall through to the synthetic shape */
        }
      }
      const el = this.element();
      const time = el && Number.isFinite(el.currentTime) ? el.currentTime : 0;
      const total = el && Number.isFinite(el.duration) && el.duration > 0 ? el.duration : 1;
      const progress = time / total;
      for (let i = 0; i < count; i += 1) {
        const x = i / count;
        const wave = Math.abs(Math.sin((x * 11 + progress * 17) * Math.PI));
        const beat = Math.abs(Math.sin((x * 47 + progress * 31) * Math.PI));
        result.push(Math.max(0.04, 0.18 + wave * 0.55 + beat * 0.22));
      }
      return result;
    },

    progress() {
      const el = this.element();
      if (!el || !Number.isFinite(el.duration) || el.duration <= 0) return 0;
      return ZQ.clamp(el.currentTime / el.duration, 0, 1);
    },

    ensure() {
      const el = this.element();
      if (!el) return;
      if (!C.music || !C.music.file) return;
      if (!el.getAttribute('src')) el.setAttribute('src', C.music.file);
      el.loop = true;
      el.volume = this.volume();
      el.playbackRate = this.rate();
      if (!rt.termSettings.music) {
        el.pause();
        if (this.decodePeaks) this.decodePeaks();
        return;
      }
      this.ensureAnalyser();
      if (this.decodePeaks) this.decodePeaks();
      const play = el.play();
      if (play && typeof play.catch === 'function') {
        play.then(() => {
          this.started = true;
        }).catch(() => {
          /* Браузер ждёт жеста — следующая попытка будет на нём. */
        });
      }
    },

    state() {
      const el = this.element();
      return {
        enabled: Boolean(rt.termSettings.music),
        playing: Boolean(el && !el.paused && !el.ended),
        current: el && Number.isFinite(el.currentTime) ? el.currentTime : 0,
        duration: el && Number.isFinite(el.duration) ? el.duration : 0,
        volume: this.volume(),
        rate: el && Number.isFinite(el.playbackRate) ? el.playbackRate : this.rate(),
        cue: this.cue || 'labyrinth'
      };
    },

    setEnabled(enabled) {
      rt.termSettings.music = Boolean(enabled);
      const el = this.element();
      if (!el) return;
      if (enabled) {
        this.ensure();
      } else {
        el.pause();
      }
    },

    play() {
      rt.termSettings.music = true;
      if (typeof ZQ.applyTermSettings === 'function') ZQ.applyTermSettings(true);
      else this.ensure();
      return this.state();
    },

    pause() {
      const el = this.element();
      if (el) el.pause();
      return this.state();
    },

    stop() {
      const el = this.element();
      if (!el) return this.state();
      el.pause();
      try {
        el.currentTime = 0;
      } catch (error) {
        /* Некоторые браузеры не дают перемотать до загрузки метаданных. */
      }
      return this.state();
    },

    seekFraction(fraction) {
      const el = this.element();
      if (!el) return false;
      const value = ZQ.clamp(Number(fraction) || 0, 0, 1);
      if (!Number.isFinite(el.duration) || el.duration <= 0) return false;
      try {
        el.currentTime = el.duration * value;
        return true;
      } catch (error) {
        return false;
      }
    },

    setVolume(value) {
      const volume = ZQ.clamp(Number(value) || 0, 0, 1);
      rt.termSettings.musicVolume = volume;
      const el = this.element();
      if (el) el.volume = volume;
      return volume;
    },

    setRate(value) {
      const rate = ZQ.clamp(Number(value) || 1, 0.5, 2);
      rt.termSettings.musicRate = rate;
      const el = this.element();
      if (el) el.playbackRate = rate;
      return rate;
    },

    setCue(cue) {
      this.cue = cue || 'labyrinth';
      if (!C.music || !C.music.file) return;
      const el = this.element();
      if (!el) return;
      if (!el.getAttribute('src')) el.setAttribute('src', C.music.file);
    },

    toggle() {
      this.setEnabled(!rt.termSettings.music);
      return rt.termSettings.music;
    }
  };

  ZQ.audio = audio;

  function unlock() {
    audio.ensure();
  }

  document.addEventListener('pointerdown', unlock, { once: true });
  document.addEventListener('keydown', unlock, { once: true });
})();
