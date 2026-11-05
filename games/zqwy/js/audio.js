/* Фоновый трек: один зацикленный файл на весь Лабиринт. */
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

    ensure() {
      const el = this.element();
      if (!el) return;
      if (!C.music || !C.music.file) return;
      if (!el.getAttribute('src')) el.setAttribute('src', C.music.file);
      el.loop = true;
      const volume = Number.isFinite(C.music.volume) ? C.music.volume : 0.55;
      el.volume = ZQ.clamp(volume, 0, 1);
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
    },

    stop() {
      const el = this.element();
      if (el) el.pause();
    }
  };

  ZQ.audio = audio;

  function unlock() {
    audio.ensure();
  }

  document.addEventListener('pointerdown', unlock, { once: true });
  document.addEventListener('keydown', unlock, { once: true });
})();
