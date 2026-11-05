/* «Клетчатый лист» — DOM-интерфейс: HUD, баннеры, оверлеи.
   Экраны собираются из данных levels.js, а не зашиты в разметку. */
(function () {
  'use strict';

  const L = window.PaperLevels;
  const UI = L.UI;
  const COLORS = L.COLORS;

  const ICON_SOUND_ON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9H4z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>';
  const ICON_SOUND_OFF = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9H4z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M16 9l5 6M21 9l-5 6" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>';

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function heartsRow(collected, total, extraClass) {
    let out = '<span class="heart-row ' + (extraClass || '') + '" aria-hidden="true">';
    for (let i = 0; i < total; i++) {
      out += '<span class="heart' + (collected[i] ? ' on' : '') + '"></span>';
    }
    out += '</span>';
    return out;
  }

  class PaperUI {
    constructor() {
      this.onAction = function () {};
      this.onVolume = function () {};
      this.lastFocus = null;
      this.bannerTimer = 0;
      this.hintTimer = 0;
      this.hearts = [];
      this._build();
    }

    _build() {
      this.hud = document.getElementById('hud');
      this.fragLabel = document.getElementById('frag-label');
      this.fragCount = document.getElementById('frag-count');
      this.heartsEl = document.getElementById('hearts');
      this.zoneKicker = document.getElementById('zone-kicker');
      this.zoneTitle = document.getElementById('zone-title');
      this.btnPause = document.getElementById('btn-pause');
      this.btnSound = document.getElementById('btn-sound');
      this.overlay = document.getElementById('overlay');
      this.bannerEl = document.getElementById('banner');
      this.hintEl = document.getElementById('hint');

      this.fragLabel.textContent = UI.fragments;
      this.btnPause.setAttribute('aria-label', UI.pause);
      this.btnPause.title = UI.pause + ' (Esc)';
      this.btnSound.setAttribute('aria-label', UI.sound);
      this.btnSound.title = UI.sound + ' (M)';
      this.hintEl.setAttribute('role', 'status');

      for (let i = 0; i < L.ZONES.length; i++) {
        const h = document.createElement('span');
        h.className = 'heart';
        this.heartsEl.appendChild(h);
        this.hearts.push(h);
      }

      this.btnPause.addEventListener('click', () => this._emit('pause'));
      this.btnSound.addEventListener('click', () => this._emit('toggle-sound'));

      this.overlay.addEventListener('click', (e) => {
        const el = e.target.closest('[data-action]');
        if (!el || el.disabled) return;
        this._emit(el.getAttribute('data-action'));
      });
      this.overlay.addEventListener('input', (e) => {
        if (e.target && e.target.matches('input[type="range"][data-volume]')) {
          this.onVolume(Number(e.target.value) / 100);
        }
      });
      this.overlay.addEventListener('keydown', (e) => this._trapFocus(e));
    }

    _emit(action) {
      try { this.onAction(action); } catch (e) { /* keep the game alive */ }
    }

    _trapFocus(e) {
      if (e.key !== 'Tab') return;
      const nodes = Array.from(this.overlay.querySelectorAll('button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])'))
        .filter(n => n.offsetParent !== null);
      if (!nodes.length) return;
      const first = nodes[0], last = nodes[nodes.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }

    setHud(zone, zoneIndex, collected) {
      this.hud.hidden = false;
      this.zoneKicker.textContent = UI.zone + ' ' + (zoneIndex + 1) + ' / ' + L.ZONES.length;
      this.zoneTitle.textContent = zone.title;
      const total = L.ZONES.length;
      let n = 0;
      for (let i = 0; i < total; i++) {
        if (collected[i]) n++;
        if (this.hearts[i]) this.hearts[i].classList.toggle('on', !!collected[i]);
      }
      this.fragCount.textContent = n + ' / ' + total;
      this.fragCount.setAttribute('aria-label', UI.fragments + ': ' + n + ' ' + UI.ofSeven);
    }

    setHudVisible(v) {
      this.hud.hidden = !v;
    }

    setSound(muted) {
      this.btnSound.innerHTML = muted ? ICON_SOUND_OFF : ICON_SOUND_ON;
      this.btnSound.setAttribute('aria-pressed', muted ? 'true' : 'false');
      this.btnSound.setAttribute('aria-label', muted ? UI.soundOff : UI.soundOn);
      this.btnSound.title = (muted ? UI.soundOff : UI.soundOn) + ' (M)';
      this.btnSound.classList.toggle('is-off', !!muted);
    }

    setPauseEnabled(v) {
      this.btnPause.disabled = !v;
    }

    banner(kicker, title, subtitle) {
      if (this.bannerTimer) clearTimeout(this.bannerTimer);
      this.bannerEl.innerHTML =
        '<span class="banner-kicker">' + esc(kicker) + '</span>' +
        '<strong>' + esc(title) + '</strong>' +
        (subtitle ? '<span class="banner-sub">' + esc(subtitle) + '</span>' : '');
      this.bannerEl.hidden = false;
      this.bannerEl.classList.remove('show');
      // reflow, чтобы анимация запустилась заново
      void this.bannerEl.offsetWidth;
      this.bannerEl.classList.add('show');
      this.bannerTimer = setTimeout(() => {
        this.bannerEl.classList.remove('show');
        this.bannerTimer = setTimeout(() => { this.bannerEl.hidden = true; }, 500);
      }, 3600);
    }

    hint(text, ms) {
      if (this.hintTimer) clearTimeout(this.hintTimer);
      this.hintEl.textContent = text;
      this.hintEl.hidden = false;
      this.hintEl.classList.add('show');
      if (ms) {
        this.hintTimer = setTimeout(() => this.hideHint(), ms);
      }
    }

    hideHint() {
      if (this.hintTimer) clearTimeout(this.hintTimer);
      this.hintTimer = 0;
      this.hintEl.classList.remove('show');
      setTimeout(() => { if (!this.hintEl.classList.contains('show')) this.hintEl.hidden = true; }, 300);
    }

    _open(html, focusSelector) {
      this.lastFocus = document.activeElement;
      this.overlay.innerHTML = html;
      this.overlay.hidden = false;
      this.overlay.classList.add('is-open');
      const target = this.overlay.querySelector(focusSelector || 'button:not([disabled]), input');
      if (target) setTimeout(() => target.focus({ preventScroll: true }), 60);
    }

    hide() {
      this.overlay.classList.remove('is-open');
      this.overlay.hidden = true;
      this.overlay.innerHTML = '';
      if (this.lastFocus && this.lastFocus.focus) {
        try { this.lastFocus.focus({ preventScroll: true }); } catch (e) {}
      }
      this.lastFocus = null;
    }

    showTitle(opts) {
      opts = opts || {};
      const total = L.ZONES.length;
      const empty = [];
      for (let i = 0; i < total; i++) empty.push(false);
      let actions = '';
      if (opts.hasSave) {
        actions += '<button class="btn primary" data-action="continue">' + esc(UI.continue) +
          '<span class="btn-sub">' + esc(UI.continueZone) + ' ' + (opts.zone + 1) + '</span></button>';
        actions += '<button class="btn ghost" data-action="start">' + esc(UI.start) + '</button>';
      } else {
        actions += '<button class="btn primary" data-action="start">' + esc(UI.start) + '</button>';
      }
      this._open(
        '<section class="screen" aria-labelledby="title-heading">' +
          '<div class="card title-card">' +
            '<div class="eyebrow">карандашная история</div>' +
            '<h1 id="title-heading" class="game-title">' + esc(UI.title) + '</h1>' +
            '<p class="subtitle">' + esc(UI.subtitle) + '</p>' +
            '<p class="lead">' + esc(UI.description) + '</p>' +
            heartsRow(empty, total, 'title-hearts') +
            '<div class="actions">' + actions + '</div>' +
            '<p class="fine">' + esc(opts.completed ? 'Этот лист уже дописан. Можно начать новый.' : UI.titleHint) + '</p>' +
          '</div>' +
        '</section>',
        '.actions .btn'
      );
    }

    showMemory(memory, index, total) {
      this._open(
        '<section class="screen" aria-labelledby="memory-heading">' +
          '<div class="card memory-card">' +
            '<div class="eyebrow">' + esc(UI.memory) + ' ' + (index + 1) + ' ' + esc(UI.memoryOf) + '</div>' +
            '<h2 id="memory-heading">' + esc(memory.title) + '</h2>' +
            '<p class="memory-text">' + esc(memory.text) + '</p>' +
            '<blockquote class="companion">' +
              '<span class="companion-mark" aria-hidden="true"></span>' +
              '<div><span class="companion-name">' + esc(UI.companion) + '</span>' +
              '<p>' + esc(memory.companion) + '</p></div>' +
            '</blockquote>' +
            '<div class="actions">' +
              '<button class="btn primary" data-action="next-memory">' + esc(UI.next) + '</button>' +
            '</div>' +
            '<p class="fine">' + (index < total - 1 ? esc(UI.nextZone) : esc(UI.credits)) + '</p>' +
          '</div>' +
        '</section>',
        '.btn'
      );
    }

    showPause(muted, volume) {
      this._open(
        '<section class="screen" aria-labelledby="pause-heading">' +
          '<div class="card pause-card">' +
            '<div class="eyebrow">' + esc(UI.pause) + '</div>' +
            '<h2 id="pause-heading">' + esc(UI.pauseTitle) + '</h2>' +
            '<p class="lead">' + esc(UI.pauseText) + '</p>' +
            '<div class="actions">' +
              '<button class="btn primary" data-action="resume">' + esc(UI.resume) + '</button>' +
              '<button class="btn" data-action="toggle-sound">' + esc(muted ? UI.soundOff : UI.soundOn) + '</button>' +
              '<label class="volume-row">' + esc(UI.volume) +
                '<input type="range" min="0" max="100" step="1" value="' + Math.round(volume * 100) + '" data-volume aria-label="' + esc(UI.volume) + '">' +
              '</label>' +
              '<button class="btn ghost" data-action="menu">' + esc(UI.toMenu) + '</button>' +
              '<button class="btn danger" data-action="restart">' + esc(UI.restart) + '</button>' +
            '</div>' +
            '<p class="fine">' + esc(UI.pauseHint) + '</p>' +
          '</div>' +
        '</section>',
        '.btn'
      );
    }

    showRestartConfirm() {
      this._open(
        '<section class="screen" aria-labelledby="confirm-heading">' +
          '<div class="card pause-card">' +
            '<div class="eyebrow">' + esc(UI.restart) + '</div>' +
            '<h2 id="confirm-heading">' + esc(UI.restart) + '?</h2>' +
            '<p class="lead">' + esc(UI.restartConfirm) + '</p>' +
            '<div class="actions">' +
              '<button class="btn danger" data-action="restart-confirm">' + esc(UI.restart) + '</button>' +
              '<button class="btn primary" data-action="cancel-restart">' + esc(UI.resume) + '</button>' +
            '</div>' +
          '</div>' +
        '</section>',
        '.btn.danger'
      );
    }

    showCredits() {
      const rows = L.CREDITS.rows.map(r =>
        '<div class="credit-row"><dt>' + esc(r[0]) + '</dt><dd>' + esc(r[1]) + '</dd></div>'
      ).join('');
      this._open(
        '<section class="screen" aria-labelledby="credits-heading">' +
          '<div class="card credits-card">' +
            '<div class="eyebrow">' + esc(L.CREDITS.subtitle) + '</div>' +
            '<h2 id="credits-heading">' + esc(L.CREDITS.title) + '</h2>' +
            '<dl class="credits">' + rows + '</dl>' +
            '<div class="actions">' +
              '<button class="btn primary" data-action="to-final">' + esc(L.CREDITS.button) + '</button>' +
            '</div>' +
          '</div>' +
        '</section>',
        '.btn'
      );
    }

    showEnding(collected, total) {
      const paras = L.FINAL.paragraphs.map(p => '<p class="lead">' + esc(p) + '</p>').join('');
      this._open(
        '<section class="screen" aria-labelledby="ending-heading">' +
          '<div class="card ending-card">' +
            '<div class="eyebrow">' + esc(UI.ending) + '</div>' +
            '<h2 id="ending-heading">' + esc(L.FINAL.title) + '</h2>' +
            paras +
            heartsRow(collected, total, 'ending-hearts') +
            '<div class="actions">' +
              '<button class="btn primary" data-action="restart-from-ending">' + esc(L.FINAL.button) + '</button>' +
            '</div>' +
          '</div>' +
        '</section>',
        '.btn'
      );
    }
  }

  window.PaperUI = PaperUI;
})();
