/* radio/settings.js — модуль скрипта radio.js. */
export function install(P) {
  Object.assign(P, { clampSetting, loadSettings, saveSettings });


  function clampSetting(value, fallback, min, max) {
    const n = Number(value);
    return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
  }

  function loadSettings() {
    let saved = null;
    try { saved = JSON.parse(localStorage.getItem(P.STORAGE_SETTINGS) || "null"); } catch {}
    if (!saved || typeof saved !== "object") saved = {};
    P.state.autoSync = saved.autoSync !== false;
    P.state.resyncMs = P.clampSetting(saved.resyncMs, P.DEFAULT_RESYNC_MS, 5000, 120000);
    P.state.resyncIntervalMs = P.clampSetting(saved.resyncIntervalMs, P.DEFAULT_RESYNC_INTERVAL_MS, 10000, 180000);
    P.syncSettingsUi();
  }

  function saveSettings() {
    try {
      localStorage.setItem(P.STORAGE_SETTINGS, JSON.stringify({
        autoSync: P.state.autoSync,
        resyncMs: P.state.resyncMs,
        resyncIntervalMs: P.state.resyncIntervalMs,
      }));
    } catch {}
  }}
