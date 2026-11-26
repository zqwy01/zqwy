/* radio/init.js — модуль скрипта radio.js. */
export function install(P) {
  Object.assign(P, { init });


  async function init() {
    P.captureUi();
    P.loadSettings();
    if (!P.state.timer) {
      P.state.timer = window.setInterval(() => P.tick(), P.TICK_MS);
    }
    if (P.state.catalog) {
      P.render(P.state.position || P.positionAt(Date.now()));
      return;
    }
    try {
      const response = await fetch(P.CATALOG_URL, { cache: "force-cache", credentials: "same-origin" });
      if (!response.ok) throw new Error(String(response.status));
      P.state.catalog = await response.json();
    } catch {
      P.state.catalog = null;
      P.render(null);
      return;
    }
    P.buildPool();
    P.tick();
    let resume = false;
    try { resume = localStorage.getItem(P.STORAGE_ACTIVE) === "1"; } catch {}
    if (resume) P.start();
  }}
