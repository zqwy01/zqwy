/* Общий контекст music.js: бывшие верхнеуровневые
 * переменные. Инициализируется до обработчиков событий. */
export const P = {};

export function initContext(P) {

  "use strict";

  P.STORAGE_ALBUM = "zqwy.player.album.v1";
  P.STORAGE_VIEW = "zqwy.music.view.v1";
  P.VIEW_MODES = new Set(["list", "cards", "large"]);
  P.state = {
    catalog: null,
    album: null,
    durations: new Map(),
    view: "list", // "list", "cards" or "large"
    fullscreen: false, // releases fill the screen until one is chosen
    collapsed: false, // releases hidden so the selected album's tracks fill the page
  };

  P.ui = {};
  P.measureCanvas = document.createElement("canvas");
  P.measureCtx = P.measureCanvas.getContext ? P.measureCanvas.getContext("2d") : null;

  /* ---------- fullscreen cover preview ---------- */

  P.lightboxTimer = 0;

  /* ---------- init (runs on first load and after SPA navigation) ---------- */

  // The same page can initialise twice in a row: once when transition.js
  // injects this script and again on zqwy:pagechange. Share the in-flight load
  // so the catalog is fetched and rendered only once.
  P.inFlight = null;}
