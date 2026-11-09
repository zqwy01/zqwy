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

    element() {
      return dom.soundtrack || null;
    },

    volume() {
      const value = Number(rt.termSettings && rt.termSettings.musicVolume);
      if (Number.isFinite(value)) return ZQ.clamp(value, 0, 1);
      const fallback = C.music && Number.isFinite(C.music.volume) ? C.music.volume : 0.55;
      return ZQ.clamp(fallback, 0, 1);
    },

    ensure() {
      const el = this.element();
      if (!el) return;
      if (!C.music || !C.music.file) return;
      if (!el.getAttribute('src')) el.setAttribute('src', C.music.file);
      el.loop = true;
      el.volume = this.volume();
      if (!rt.termSettings.music) {
        el.pause();
        return;
      }
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
