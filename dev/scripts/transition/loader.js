/* transition/loader.js — модуль скрипта transition.js. */
export function install(P) {
  Object.assign(P, { ensureLoader, showLoader, hideLoader });


  function ensureLoader() {
    if (P.loader) return P.loader;
    const style = document.createElement("style");
    style.id = "zqwyPageLoaderStyle";
    style.textContent = P.LOADER_CSS;
    document.head.appendChild(style);

    P.loader = document.createElement("div");
    P.loader.className = "zqwy-page-loader";
    P.loader.id = "zqwyPageLoader";
    P.loader.setAttribute("aria-hidden", "true");
    P.loader.innerHTML =
      '<div class="zqwy-page-loader-card">' +
      '<span class="zqwy-page-loader-spinner" aria-hidden="true"></span>' +
      '<span class="zqwy-page-loader-text">Загрузка…</span>' +
      "</div>";
    document.body.appendChild(P.loader);
    return P.loader;
  }

  function showLoader() {
    P.ensureLoader();
    P.loaderActive = true;
    P.loader.classList.add("is-visible");
  }

  function hideLoader() {
    if (P.initialLoaderTimer) {
      window.clearTimeout(P.initialLoaderTimer);
      P.initialLoaderTimer = 0;
    }
    P.loaderActive = false;
    P.loader?.classList.remove("is-visible");
  }}
