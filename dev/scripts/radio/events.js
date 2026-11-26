/* radio/events.js — модуль скрипта radio.js. */
export function bindEvents(P) {
  Object.assign(P, { bind });


  function bind() {
    P.captureUi();
    document.addEventListener("click", (ev) => {
      const target = ev.target instanceof Element ? ev.target : null;
      if (!target) return;
      if (target.closest("#radioPlay") && P.ui.play?.contains(target)) {
        if (P.state.active) P.stop();
        else P.start();
        return;
      }
      if (target.closest("#radioSyncNow")) P.syncNow();
      else if (target.closest("#radioProgramPrev")) P.jumpProgram(-1);
      else if (target.closest("#radioProgramNext")) P.jumpProgram(1);
      else if (target.closest("#radioProgramNow")) P.jumpProgram(0);
    });

    document.addEventListener("change", (ev) => {
      const target = ev.target instanceof HTMLInputElement ? ev.target : null;
      if (!target) return;
      const key = target.dataset.radioSetting;
      if (key === "autoSync") P.state.autoSync = target.checked;
      else if (key === "thresholdSec") P.state.resyncMs = P.clampSetting(Number(target.value) * 1000, P.DEFAULT_RESYNC_MS, 5000, 120000);
      else if (key === "intervalSec") P.state.resyncIntervalMs = P.clampSetting(Number(target.value) * 1000, P.DEFAULT_RESYNC_INTERVAL_MS, 10000, 180000);
      else return;
      P.saveSettings();
      P.syncSettingsUi();
    });

    // A wheel/touch gesture on the program means the visitor is browsing the
    // day themselves. Stop yanking the list back to the live track.
    ["wheel", "touchstart", "pointerdown"].forEach((eventName) => {
      P.ui.program?.addEventListener(eventName, () => { P.state.followCurrent = false; }, { passive: true });
    });
    P.ui.program?.addEventListener("keydown", (ev) => {
      if (["ArrowUp", "ArrowDown", "PageUp", "PageDown", "Home", "End"].includes(ev.key)) P.state.followCurrent = false;
    });

    window.addEventListener("zqwy:playerstate", () => {
      const api = P.player();
      const current = api ? api.getState().current : null;
      // Closing the global player ends the broadcast instead of fighting it.
      if (P.state.active && !P.state.switching && !current) {
        P.state.active = false;
        try { localStorage.setItem(P.STORAGE_ACTIVE, "0"); } catch {}
        api?.setProgramLock(false);
      }
      P.render(P.state.position || P.positionAt(Date.now()));
    });

    window.addEventListener("zqwy:languagechange", () => {
      P.state.lastListKey = "";
      P.syncSettingsUi();
      P.render(P.state.position || P.positionAt(Date.now()));
    });
  }

  P.bind();
  P.init();
  // The player survives SPA navigation. When the visitor leaves the radio
  // page, end the broadcast so no invisible lock can block the music player.
  window.addEventListener("zqwy:pagechange", () => {
    if (!/\/radio(?:\/|$)/.test(window.location.pathname)) {
      if (P.state.active) P.stop();
      return;
    }
    P.init();
  });}
