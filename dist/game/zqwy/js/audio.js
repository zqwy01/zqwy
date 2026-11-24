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

  /* Комнаты сменяются длинным крестовым затуханием, а бой и погоня
     вступают быстрее — но всё равно плавно, без щелчка. */
  const FADE_MS = 900;
  const HARD_FADE_MS = 200;

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
    faders: new Map(),
    driftTimer: 0,
    driftPhase: 0,
    switching: false,
    switchToken: 0,
    activeEl: null,
    /* Очередь кассет: игрок ставит дорожки в плеер, и они играют одна
       за другой. Режим очереди отключает зацикливание на время
       проигрывания, а прежнее значение loop восстанавливается, когда
       очередь заканчивается. */
    queueMode: false,
    queueLoopRestore: true,
    /* Кассета комнаты зацикливается, а боевой трек должен доиграть до
       конца: схватка длится ровно столько, сколько звучит запись. */
    loop: true,

    /* Два независимых проигрывателя: пока один трек гаснет, второй уже
       играет. Раньше источник был один, и смена записи всегда давала
       провал тишины между кассетами. */
    deckEls() {
      return [dom.soundtrack, dom.soundtrackB].filter(Boolean);
    },

    element() {
      return this.activeEl || dom.soundtrack || null;
    },

    otherElement() {
      const active = this.element();
      for (const el of this.deckEls()) {
        if (el !== active) return el;
      }
      return null;
    },

    setActive(el) {
      if (el) this.activeEl = el;
      return this.element();
    },

    /* --------------------------- Очередь ---------------------------- */

    queueList() {
      if (!rt.state) return [];
      if (!Array.isArray(rt.state.cassetteQueue)) rt.state.cassetteQueue = [];
      return rt.state.cassetteQueue;
    },

    queue() {
      return this.queueList().map((id) => {
        const track = tracks()[id];
        return { id, title: track ? track.title : id };
      });
    },

    queueAdd(trackId) {
      const track = tracks()[trackId];
      if (!track) return { ok: false, reason: 'unknown' };
      const list = this.queueList();
      if (list.includes(trackId)) return { ok: false, reason: 'queued', track };
      list.push(trackId);
      if (typeof ZQ.updateMusicUI === 'function') ZQ.updateMusicUI();
      return { ok: true, track };
    },

    queueRemove(trackId) {
      const list = this.queueList();
      const index = typeof trackId === 'number'
        ? trackId
        : list.indexOf(trackId);
      if (index < 0 || index >= list.length) return false;
      const [removed] = list.splice(index, 1);
      if (removed === this.currentQueueId) this.currentQueueId = null;
      if (typeof ZQ.updateMusicUI === 'function') ZQ.updateMusicUI();
      return true;
    },

    queueClear() {
      if (!rt.state) return false;
      rt.state.cassetteQueue = [];
      this.currentQueueId = null;
      this.queueMode = false;
      if (typeof ZQ.updateMusicUI === 'function') ZQ.updateMusicUI();
      return true;
    },

    /* Начать проигрывание очереди с первой дорожки. Зацикливание
       выключается, чтобы записи сменяли друг друга. */
    startQueue() {
      const list = this.queueList();
      if (!list.length) return false;
      this.queueLoopRestore = this.loop;
      this.queueMode = true;
      this.loop = false;
      if (!this.advanceQueue()) {
        this.queueMode = false;
        this.loop = this.queueLoopRestore;
        return false;
      }
      return true;
    },

    /* Следующая дорожка из очереди. Возвращает true, если что-то
       зазвучало. */
    advanceQueue() {
      const list = this.queueList();
      while (list.length) {
        const trackId = list.shift();
        const track = tracks()[trackId];
        if (!track) continue;
        this.currentQueueId = trackId;
        if (rt.state) rt.state.activeCassette = trackId;
        const switched = this.switchTrack(trackId, false);
        if (!switched) this.ensure();
        if (typeof ZQ.updateMusicUI === 'function') ZQ.updateMusicUI();
        return true;
      }
      /* Очередь опустела: комнатная запись снова зацикливается. */
      this.currentQueueId = null;
      if (this.queueMode) {
        this.queueMode = false;
        this.loop = this.queueLoopRestore;
        const el = this.element();
        if (el) el.loop = this.loop;
        if (this.loop && el && el.paused) {
          const play = el.play();
          if (play && typeof play.catch === 'function') play.catch(() => {});
        }
      }
      if (typeof ZQ.updateMusicUI === 'function') ZQ.updateMusicUI();
      return false;
    },

    nextQueued() {
      if (!this.queueMode) {
        this.queueLoopRestore = this.loop;
        this.queueMode = true;
        this.loop = false;
      }
      return this.advanceQueue();
    },

    /* Событие ended приходит только у незацикленной записи. Если
       играет очередь, сразу включаем следующую кассету. */
    handleEnded(el) {
      if (el && el !== this.element()) return;
      if (this.queueMode) {
        this.advanceQueue();
        return;
      }
      if (typeof ZQ.updateMusicUI === 'function') ZQ.updateMusicUI();
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
      const els = this.deckEls();
      if (!els.length) return;
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
        if (!this.analyser) {
          this.analyser = this.context.createAnalyser();
          this.analyser.fftSize = 512;
          this.analyser.smoothingTimeConstant = 0.82;
          this.waveData = new Uint8Array(this.analyser.fftSize);
          this.analyser.connect(this.context.destination);
        }
        if (!this.sources) this.sources = new Map();
        for (const el of els) {
          let source = this.sources.get(el);
          if (!source) {
            source = this.context.createMediaElementSource(el);
            this.sources.set(el, source);
          }
          if (!source.__zqConnected) {
            source.connect(this.analyser);
            source.__zqConnected = true;
          }
        }
      } catch (error) {
        this.analyser = null;
        this.waveData = null;
      }
    },

    /* Полная волна трека: файл декодируется целиком один раз, а не
       берётся из живого анализатора. Так плеер показывает весь трек,
       а не только последние доли секунды. */
    decodePeaks() {
      const track = tracks()[this.trackId];
      if (!track || !track.file) return Promise.resolve(null);
      const src = track.file;
      if (this.peaks && this.peaks.length && this.peakFile === src) {
        return Promise.resolve(this.peaks);
      }
      if (this.peakPromise && this.peakFile === src) return this.peakPromise;
      if (this.peakFile !== src) {
        this.peaks = null;
        this.peakPromise = null;
        this.peakFile = src;
      }
      this.ensureAnalyser();
      const ctx = this.context;
      if (!ctx || typeof window.fetch !== 'function') return Promise.resolve(null);
      /* Декодирование длинной кассеты идёт в фоне, а тяжёлый проход по
         PCM-буферу всё равно выполняется в главном потоке. Если за это
         время сменилась дорожка, результат больше не нужен. */
      const token = this.switchToken;

      const finish = (buffer) => {
        if (token !== this.switchToken) return null;
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

      const promise = window.fetch(src, { cache: 'force-cache' })
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
          if (token !== this.switchToken) return null;
          if (!result) this.peakPromise = null;
          return result;
        });
      this.peakPromise = promise;
      return promise;
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

    /* Мягкое переключение: старый трек гаснет, пока новый уже
       появляется. Два элемента играют одновременно, поэтому между
       кассетами нет тишины. Жёсткое (hard) лишь сокращает перекрытие. */
    switchTrack(trackId, hard) {
      const track = tracks()[trackId];
      if (!track || !track.file) return false;
      const currentEl = this.element();
      const nextEl = this.otherElement() || currentEl;
      if (!nextEl) return false;
      const targetSrc = track.file;
      const current = currentEl ? (currentEl.getAttribute('src') || '') : '';
      if (current.endsWith(track.file) && this.trackId === trackId) {
        this.applyRate();
        this.startDrift();
        return true;
      }

      const token = ++this.switchToken;
      const cross = Boolean(
        this.started && currentEl && currentEl !== nextEl && !currentEl.paused &&
        Number.isFinite(currentEl.currentTime) && currentEl.currentTime > 0.02
      );
      const duration = hard ? HARD_FADE_MS : FADE_MS;

      this.stopDrift();
      this.switching = true;
      this.setActive(nextEl);
      this.trackId = trackId;
      /* Пики нужны только плееру. Не сбрасываем кэш, если дорожка уже
         декодирована: повторный вход в комнату не должен снова грузить
         и разбирать многоминутный файл. */
      if (this.peakFile !== targetSrc) {
        this.peaks = null;
        this.peakPromise = null;
        this.peakFile = '';
      }
      nextEl.setAttribute('src', targetSrc);
      nextEl.loop = this.loop;
      nextEl.volume = 0;
      try {
        nextEl.load();
      } catch (error) {
        /* источник всё равно применится */
      }
      this.applyRate();

      const fadeIn = () => {
        if (token !== this.switchToken) return;
        this.started = true;
        this.startDrift();
        if (cross) {
          this.fadeElement(currentEl, 0, duration, () => {
            try {
              currentEl.pause();
              currentEl.volume = 0;
            } catch (error) {
              /* элемент уже мог быть переиспользован */
            }
          });
        } else if (currentEl && currentEl !== nextEl) {
          try {
            currentEl.pause();
            currentEl.volume = 0;
          } catch (error) {
            /* старый элемент уже остановлен */
          }
        }
        this.fadeElement(nextEl, this.volume(), duration, () => {
          if (token === this.switchToken) this.switching = false;
        });
      };

      if (!rt.termSettings.music) {
        this.switching = false;
        return true;
      }
      this.ensureAnalyser();
      const play = nextEl.play();
      if (play && typeof play.catch === 'function') {
        play.then(fadeIn).catch(() => {
          /* Браузер ждёт жеста — следующий жест запустит. */
          if (token === this.switchToken) this.switching = false;
        });
      } else {
        fadeIn();
      }
      return true;
    },

    /* Затухание по гладкой кривой: linear-объём звучит как рывок на
       тихих участках, поэтому используем ease-in-out. Каждый элемент
       ведёт собственный фейдер — иначе крестовое затухание обрывало бы
       одну из двух записей. */
    fadeElement(el, target, duration, done) {
      if (!el) return;
      const prior = this.faders.get(el);
      if (prior && prior.raf) {
        window.cancelAnimationFrame(prior.raf);
        this.faders.delete(el);
      }
      const from = Number.isFinite(el.volume) ? el.volume : 0;
      const to = ZQ.clamp(target, 0, 1);
      const total = Math.max(0, Number(duration) || 0);
      const ease = (t) => (t < 0.5
        ? 4 * t * t * t
        : 1 - Math.pow(-2 * t + 2, 3) / 2);
      const finish = () => {
        this.faders.delete(el);
        if (typeof done === 'function') done();
      };
      if (total <= 0 || typeof window.requestAnimationFrame !== 'function') {
        el.volume = to;
        finish();
        return;
      }
      const start = window.performance && window.performance.now
        ? window.performance.now()
        : Date.now();
      const fader = { raf: 0 };
      this.faders.set(el, fader);
      const tick = (now) => {
        const time = Number.isFinite(now) ? now : Date.now();
        const progress = ZQ.clamp((time - start) / total, 0, 1);
        el.volume = ZQ.clamp(from + (to - from) * ease(progress), 0, 1);
        if (progress >= 1) {
          fader.raf = 0;
          finish();
          return;
        }
        fader.raf = window.requestAnimationFrame(tick);
      };
      fader.raf = window.requestAnimationFrame(tick);
    },

    fadeTo(target, duration, done) {
      this.fadeElement(this.element(), target, duration, done);
    },

    ensure() {
      const el = this.element();
      if (!el) return;
      const track = tracks()[this.trackId] || tracks().forest;
      if (!track || !track.file) return;
      if (!el.getAttribute('src')) el.setAttribute('src', track.file);
      for (const other of this.deckEls()) {
        if (other !== el) {
          try {
            other.pause();
            other.volume = 0;
          } catch (error) {
            /* второй проигрыватель мог быть ещё не готов */
          }
        }
      }
      el.loop = this.loop;
      el.volume = this.volume();
      this.applyRate();
      this.startDrift();
      if (!rt.termSettings.music) {
        el.pause();
        return;
      }
      this.ensureAnalyser();
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
        algorithm: this.algorithm(),
        queue: this.queue(),
        queueMode: this.queueMode
      };
    },

    setEnabled(enabled) {
      rt.termSettings.music = Boolean(enabled);
      if (!enabled) {
        for (const el of this.deckEls()) {
          try {
            el.pause();
          } catch (error) {
            /* элемент мог быть ещё не готов */
          }
        }
        this.stopDrift();
        return;
      }
      this.ensure();
    },

    play() {
      rt.termSettings.music = true;
      if (typeof ZQ.applyTermSettings === 'function') ZQ.applyTermSettings(true);
      else this.ensure();
      return this.state();
    },

    pause() {
      for (const el of this.deckEls()) {
        try {
          el.pause();
        } catch (error) {
          /* необязательная пауза второго проигрывателя */
        }
      }
      return this.state();
    },

    stop() {
      const el = this.element();
      for (const deck of this.deckEls()) {
        try {
          deck.pause();
          deck.currentTime = 0;
        } catch (error) {
          /* Некоторые браузеры не дают перемотать до загрузки метаданных. */
        }
      }
      if (!el) return this.state();
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
      const active = this.element();
      for (const el of this.deckEls()) {
        if (el === active) el.volume = volume;
        else if (!this.faders.has(el)) el.volume = 0;
      }
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
      /* Новая сцена выключает очередь: комната снова ведёт свою
         запись и зацикливается. */
      if (this.queueMode) {
        this.queueMode = false;
        this.currentQueueId = null;
        if (!hard) this.loop = this.queueLoopRestore;
      }
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
      /* Ручной выбор одной дорожки выходит из режима очереди. */
      this.queueMode = false;
      this.currentQueueId = null;
      this.loop = this.queueLoopRestore;
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

  /* Оба проигрывателя участвуют в крестовом затухании, поэтому
     окончание записи слушаем у каждого: очередь переключается только
     тогда, когда закончилась активная кассета. */
  for (const deck of audio.deckEls()) {
    deck.addEventListener('ended', () => audio.handleEnded(deck));
  }

  function unlock() {
    audio.ensure();
  }

  document.addEventListener('pointerdown', unlock, { once: true });
  document.addEventListener('keydown', unlock, { once: true });
})();
