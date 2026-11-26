/* music/utils.js — модуль скрипта music.js. */
export function install(P) {
  Object.assign(P, { player, assetUrl, formatTime, plural });


  function player() {
    return window.zqwyPlayer || null;
  }

  /* ---------- helpers ---------- */

  function assetUrl(relative) {
    const segments = String(relative).split("/").filter(Boolean);
    const tail = segments.map(encodeURIComponent).join("/");
    // Anchor to this module: document.baseURI changes on SPA navigation and
    // points at the server root on direct /music/ loads, losing a Pages subpath.
    return new URL(`../../../${tail}`, import.meta.url).href;
  }

  function formatTime(seconds) {
    if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
    const total = Math.floor(seconds);
    return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
  }

  function plural(count, one, few, many) {
    const mod10 = count % 10;
    const mod100 = count % 100;
    if (mod10 === 1 && mod100 !== 11) return one;
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
    return many;
  }}
