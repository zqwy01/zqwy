/* Общий контекст transition.js: бывшие верхнеуровневые
 * переменные. Инициализируется до обработчиков событий. */
export const P = {};

export function initContext(P) {

  "use strict";

  P.root = document.documentElement;
  P.CONTENT = ".page-content";
  P.reduced = window.matchMedia
    ? window.matchMedia("(prefers-reduced-motion: reduce)")
    : null;
  P.durationFor = () => (P.reduced && P.reduced.matches ? 200 : 420);
  // Must match --catalog-open-duration in base.css so the outgoing page uses
  // the same motion as the catalog overlay opened by the logo.
  P.leaveMs = P.durationFor();
  // Let the leaving animation play out before an overlay can cover it.
  P.loaderDelay = P.leaveMs + 60;

  /* ---------- delayed loading overlay ---------- */

  P.LOADER_CSS = `
.zqwy-page-loader{position:fixed;inset:0;z-index:1000010;display:flex;align-items:center;justify-content:center;box-sizing:border-box;background:var(--bg,#000);color:var(--text,#fff);opacity:0;visibility:hidden;pointer-events:none;transition:opacity .1s ease,visibility 0s linear .1s}
.zqwy-page-loader.is-visible{opacity:1;visibility:visible;pointer-events:auto;transition:opacity .18s ease,visibility 0s}
.zqwy-page-loader-card{display:flex;flex-direction:column;align-items:center;gap:12px;padding:22px 28px;border:1px solid var(--border,#2a2a2a);border-radius:14px;background:var(--bg-elevated,#0b0b0b)}
.zqwy-page-loader-spinner{width:28px;height:28px;border:2px solid var(--border,#2a2a2a);border-top-color:var(--text,#fff);border-radius:50%;animation:zqwy-loader-spin .8s linear infinite}
.zqwy-page-loader-text{font-family:var(--font,system-ui,sans-serif);font-size:.92rem;letter-spacing:.03em}
@keyframes zqwy-loader-spin{to{transform:rotate(360deg)}}
@media (prefers-reduced-motion:reduce){.zqwy-page-loader-spinner{animation:none}}
`;

  P.loader = null;
  P.initialLoaderTimer = 0;
  P.loaderActive = false;

  P.navigating = false;
  // The URL whose content is actually on screen. location can change first
  // (history.back() → popstate), so comparing against location alone skips the
  // content swap and leaves the previous page rendered under the new URL.
  P.renderedUrl = window.location.href;

  P.sleep = (ms) => new Promise((resolve) => window.setTimeout(resolve, ms));}
