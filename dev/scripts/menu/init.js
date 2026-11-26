/* menu/init.js — модуль скрипта menu.js. */
export function install(P) {
  Object.assign(P, { initPage });


  /* ---------- page lifecycle ---------- */

  function initPage() {
    P.refresh();
    // transition.js replaces document.title and <meta> come from the fetched
    // document; re-apply the data-i18n keys copied onto them before pagechange.
    P.translateStatic();
    P.loadSettings();
    P.loadBuildInfo();

    document.querySelectorAll(".menu-catalog > .site-menu-item").forEach((el, i) => {
      el.style.setProperty("--i", String(i));
    });

    P.updateSearchLayout();
    document.fonts?.ready.then(P.updateSearchLayout);

    const params = new URLSearchParams(window.location.search);
    const initialQuery = params.get("q");
    if (initialQuery && P.els.status && P.els.results && P.els.input) {
      P.els.input.value = initialQuery;
      P.performSearch(initialQuery);
    } else if (params.get("catalog") === "1") {
      // Empty search from a secondary page lands on the home catalog.
      window.setTimeout(() => {
        P.openMenu();
        const url = new URL(window.location.href);
        url.searchParams.delete("catalog");
        window.history.replaceState({}, "", url);
      }, 80);
    }
  }}
