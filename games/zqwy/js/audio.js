/* Музыка Лабиринта: не один файл, а кассеты.
   Плеер — предмет инвентаря, кассеты лежат внутри него, а каждая
   комната включает свою запись. Модуль даёт настройкам API
   play/pause/stop, перемотку, громкость, скорость и алгоритмы:
   tempo (без изменения высоты), pitch (вместе с высотой) и drift
   (медленное дыхание скорости). */
(function () {
  'use strict';

  const ZQ = window.ZQ;
  const C = ZQ.C;
  const rt = ZQ.rt;
  const dom = ZQ.dom;

  const FADE_MS = 520;

  function tracks() {
    return (C.music && C.music.tracks) || {};
  }

  function cueMeta(cue) {
    return (C.musicCues && C.musicCues[cue]) || null;
  }

  /* Выбор дорожки для сцены. Обычно это одно имя, но у некоторых
     сцен (залы диметродонов) задан целый альбом: тогда дорожка
     выбирается детерминированно по seed'у комнаты, чтобы каждая стая
     слышала свою песню. */
  function trackForCue(cue, seed) {
    const meta = cueMeta(cue);
    let id = meta && meta.track ? meta.track : 'forest';
    if (Array.isArray(id)) {
      const list = id.filter((entry) => tracks()[entry]);
      if (!list.length) return 'forest';
      const key = `${cue}:${seed === undefined || seed === null ? '' : seed}`;
      let h = 2166136261;
      for (let i = 0; i < key.length; i += 1) {
        h ^= key.charCodeAt(i);
        h = Math.imul(h, 16777619);
      }
      id = list[(h >>> 0) % list.length];
    }
    return tracks()[id] ? id : 'forest';
  }

  const audio = {
    cue: 'tablet',
    trackId: 'forest',
    started: false,
    context: null,
    analyser: null,
    source: null,
    waveData: null,
    peaks: null,
    peakSamples: 720,
    peakPromise: null,
    peakFile: '',
    fadeTimer: 0,
    driftTimer: 0,
    driftPhase: 0,
    switching: false,
    /* Кассета комнаты зацикливается, а боевой трек должен доиграть до
       конца: схватка длится ровно столько, сколько звучит запись. */
    loop: true,

    element() {
      return dom.soundtrack || null;
    },

    baseRate() {
      const value = Number(rt.termSettings && rt.termSettings.musicRate);
      return Number.isFinite(value) ? ZQ.clamp(value, 0.5, 2) : 1;
    },

    /* Темп задаёт только игрок. Сцена больше не подкручивает скорость:
       замедление на схватке с титанобоа звучало неприятно, поэтому
       автоматического изменения темпа нет нигде. Поля slow/hard в
       каталоге кассет остаются, но влияют только на смену источника
       (hard), а не на playbackRate. */
    rateForCue(cue) {
      return ZQ.clamp(this.baseRate(), 0.5, 2);
    },

    sceneRate() {
      return this.rateForCue(this.cue);
    },

    algorithm() {
      const value = rt.termSettings && rt.termSettings.musicAlgorithm;
      const algorithms = C.music && Array.isArray(C.music.rateAlgorithms)
        ? C.music.rateAlgorithms
        : [];
      const ids = algorithms.map((entry) => entry.id);
      return ids.includes(value) ? value : (ids[0] || 'tempo');
    },

    /* Фактическая скорость звука в данный момент. Дрейф меняет её
       плавно, поэтому длительность в плеере считается именно отсюда,
       а не из скорости сцены. */
    effectiveRate() {
      const el = this.element();
      if (el && Number.isFinite(el.playbackRate) && el.playbackRate > 0) {
        return el.playbackRate;
      }
      return this.sceneRate();
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
      const track = tracks()[this.trackId];
      if (!el || !track || !track.file) return Promise.resolve(null);
      const src = el.getAttribute('src') || track.file;
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

    applyRate() {
      const el = this.element();
      if (!el) return;
      const algorithm = this.algorithm();
      const preserved = algorithm !== 'pitch';
      if ('preservesPitch' in el) el.preservesPitch = preserved;
      if ('webkitPreservesPitch' in el) el.webkitPreservesPitch = preserved;
      if ('mozPreservesPitch' in el) el.mozPreservesPitch = preserved;
      el.playbackRate = this.sceneRate();
    },

    stopDrift() {
      if (!this.driftTimer) return;
      window.clearInterval(this.driftTimer);
      this.driftTimer = 0;
      this.driftPhase = 0;
      const el = this.element();
      if (el) el.playbackRate = this.sceneRate();
    },

    startDrift() {
      this.stopDrift();
      if (this.algorithm() !== 'drift') return;
      this.driftTimer = window.setInterval(() => {
        const el = this.element();
        if (!el || rt.termSettings.music === false) return;
        this.driftPhase += 0.42;
        const breath = 1 + Math.sin(this.driftPhase) * 0.055;
        el.playbackRate = ZQ.clamp(this.sceneRate() * breath, 0.5, 2);
      }, 420);
    },

    setAlgorithm(value) {
      const algorithms = C.music && Array.isArray(C.music.rateAlgorithms)
        ? C.music.rateAlgorithms
        : [];
      const ids = algorithms.map((entry) => entry.id);
      rt.termSettings.musicAlgorithm = ids.includes(value)
        ? value
        : (ids[0] || 'tempo');
      this.applyRate();
      this.startDrift();
      if (typeof ZQ.updateMusicUI === 'function') ZQ.updateMusicUI();
      return rt.termSettings.musicAlgorithm;
    },

    /* Мягкое переключение: старый трек гаснет, новый появляется.
       Жёсткое (hard) меняет источник сразу, чтобы погоня не ждала. */
    switchTrack(trackId, hard) {
      const el = this.element();
      const track = tracks()[trackId];
      if (!el || !track || !track.file) return false;
      const targetSrc = track.file;
      const current = el.getAttribute('src') || '';
      if (current.endsWith(track.file) && this.trackId === trackId) {
        this.applyRate();
        this.startDrift();
        return true;
      }
      const finish = () => {
        this.trackId = trackId;
        this.peaks = null;
        this.peakPromise = null;
        this.peakFile = '';
        el.setAttribute('src', targetSrc);
        el.loop = this.loop;
        try {
          el.load();
        } catch (error) {
          /* источник всё равно применится */
        }
        this.applyRate();
        this.startDrift();
        el.volume = 0;
        const fadeIn = () => {
          this.fadeTo(this.volume(), FADE_MS);
        };
        if (!rt.termSettings.music) {
          if (this.decodePeaks) this.decodePeaks();
          return;
        }
        this.ensureAnalyser();
        if (this.decodePeaks) this.decodePeaks();
        const play = el.play();
        if (play && typeof play.catch === 'function') {
          play.then(() => {
            this.started = true;
            fadeIn();
          }).catch(() => {
            /* Браузер ждёт жеста — следующий жест запустит. */
          });
        } else {
          fadeIn();
        }
      };
      this.stopDrift();
      this.switching = true;
      if (hard || !this.started) {
        finish();
        this.switching = false;
        return true;
      }
      this.fadeTo(0, FADE_MS, () => {
        finish();
        this.switching = false;
      });
      return true;
    },

    fadeTo(target, duration, done) {
      const el = this.element();
      if (!el) return;
      if (this.fadeTimer) {
        window.clearInterval(this.fadeTimer);
        this.fadeTimer = 0;
      }
      const from = Number.isFinite(el.volume) ? el.volume : 0;
      const to = ZQ.clamp(target, 0, 1);
      const steps = Math.max(1, Math.round(duration / 40));
      let step = 0;
      this.fadeTimer = window.setInterval(() => {
        step += 1;
        el.volume = ZQ.clamp(from + (to - from) * (step / steps), 0, 1);
        if (step >= steps) {
          window.clearInterval(this.fadeTimer);
          this.fadeTimer = 0;
          if (typeof done === 'function') done();
        }
      }, 40);
    },

    ensure() {
      const el = this.element();
      if (!el) return;
      const track = tracks()[this.trackId] || tracks().forest;
      if (!track || !track.file) return;
      if (!el.getAttribute('src')) el.setAttribute('src', track.file);
      el.loop = this.loop;
      el.volume = this.volume();
      this.applyRate();
      this.startDrift();
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
      const track = tracks()[this.trackId] || null;
      const rate = this.effectiveRate();
      const rawCurrent = el && Number.isFinite(el.currentTime) ? el.currentTime : 0;
      const rawDuration = el && Number.isFinite(el.duration) && el.duration > 0
        ? el.duration
        : 0;
      return {
        enabled: Boolean(rt.termSettings.music),
        playing: Boolean(el && !el.paused && !el.ended),
        /* Плеер показывает длительность так, как её слышно: при 2×
           трек заканчивается вдвое быстрее. Перемотка при этом
           остаётся в сырых долях файла. */
        current: rate > 0 ? rawCurrent / rate : rawCurrent,
        duration: rate > 0 ? rawDuration / rate : rawDuration,
        rawCurrent,
        rawDuration,
        stopped: Boolean(el && el.paused && rawCurrent <= 0.05),
        volume: this.volume(),
        rate,
        cue: this.cue || 'labyrinth',
        track: this.trackId,
        trackTitle: track ? track.title : '',
        cassette: track ? track.cassette : '',
        algorithm: this.algorithm()
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
        this.stopDrift();
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
      rt.termSettings.musicRate = ZQ.clamp(Number(value) || 1, 0.5, 2);
      this.applyRate();
      this.startDrift();
      if (typeof ZQ.updateMusicUI === 'function') ZQ.updateMusicUI();
      return rt.termSettings.musicRate;
    },

    /* Открыть кассету для комнаты: запись добавляется в плеер, а
       активной становится именно она. options.hard меняет источник
       сразу, options.restart перематывает запись в начало. */
    setCue(cue, options) {
      const opts = options || {};
      this.cue = cue || 'labyrinth';
      const trackId = trackForCue(this.cue, opts.seed);
      const meta = cueMeta(this.cue);
      const track = tracks()[trackId];
      if (!track) return;
      if (rt.state) {
        if (!Array.isArray(rt.state.cassettes)) rt.state.cassettes = ['forest'];
        if (!rt.state.cassettes.includes(trackId)) {
          rt.state.cassettes.push(trackId);
          if (track.cassette && C.items[track.cassette]) {
            ZQ.appendLog(
              `Найдена кассета: «${track.title}». Она лежит в проигрывателе.`,
              'sys',
              true
            );
          }
        }
        rt.state.activeCassette = trackId;
      }
      const hard = opts.hard === undefined
        ? Boolean(meta && meta.hard)
        : Boolean(opts.hard);
      this.switchTrack(trackId, hard);
      if (opts.restart) this.rewind();
    },

    /* Зацикливание трека. Комнаты зацикливаются, схватка — нет:
       она должна закончиться вместе с записью. */
    setLoop(value) {
      this.loop = Boolean(value);
      const el = this.element();
      if (el) el.loop = this.loop;
      return this.loop;
    },

    rewind() {
      const el = this.element();
      if (!el) return false;
      try {
        el.currentTime = 0;
        return true;
      } catch (error) {
        return false;
      }
    },

    /* Боевой трек: жёсткое переключение, без зацикливания, с начала. */
    startBattleTrack(cue) {
      this.setLoop(false);
      this.setCue(cue, { hard: true, restart: true });
      const el = this.element();
      if (el) el.loop = false;
      return true;
    },

    /* Возврат к музыке комнаты после схватки. */
    endBattleTrack(cue, seed) {
      this.setLoop(true);
      this.setCue(cue || 'labyrinth', { hard: true, seed });
      return true;
    },

    playCassette(trackId) {
      const track = tracks()[trackId];
      if (!track) return false;
      if (rt.state) {
        if (!Array.isArray(rt.state.cassettes)) rt.state.cassettes = ['forest'];
        if (!rt.state.cassettes.includes(trackId)) rt.state.cassettes.push(trackId);
        rt.state.activeCassette = trackId;
      }
      this.cue = trackId;
      rt.termSettings.music = true;
      const switched = this.switchTrack(trackId, false);
      if (!switched) this.ensure();
      if (typeof ZQ.updateMusicUI === 'function') ZQ.updateMusicUI();
      return switched;
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
