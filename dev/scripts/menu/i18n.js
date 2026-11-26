/* menu/i18n.js — модуль скрипта menu.js. */
export function install(P) {
  Object.assign(P, { t, applyLanguage });


  function t(key, vars) {
    const value = P.I18N[P.language]?.[key] ?? P.I18N.ru[key] ?? key;
    if (!vars) return value;
    return value.replace(/\{(\w+)\}/g, (match, name) =>
      Object.prototype.hasOwnProperty.call(vars, name) ? String(vars[name]) : match);
  }

  function applyLanguage(next, animate = false) {
    const resolved = next === "en" ? "en" : "ru";
    P.language = resolved; // keep t() and aria labels in sync immediately
    document.documentElement.lang = resolved;
    if (P.langAnimTimer) { window.clearTimeout(P.langAnimTimer); P.langAnimTimer = 0; }

    const commit = () => {
      document.querySelectorAll("[data-i18n]").forEach((el) => {
        const value = P.t(el.dataset.i18n);
        if (value) el.textContent = value;
      });
      document.querySelectorAll("[data-i18n-placeholder], [data-i18n-title], [data-i18n-aria-label]").forEach((el) => {
        for (const attr of ["placeholder", "title", "aria-label"]) {
          const key = el.getAttribute(`data-i18n-${attr}`);
          if (key) el.setAttribute(attr, P.t(key));
        }
      });
      P.els.suggestions?.setAttribute("aria-label", P.t("suggestions"));
      if (P.els.logo && P.els.hasMenu) {
        P.els.logo.setAttribute("aria-label", P.t(P.els.menu.classList.contains("is-open") ? "menuClose" : "menuOpen"));
      }
      P.updateSearchLayout();
      P.loadBuildInfo();
      // The player is injected outside [data-i18n] and translates itself.
      window.dispatchEvent(new CustomEvent("zqwy:languagechange", { detail: { language: resolved } }));
    };

    const root = document.documentElement;
    const reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const selector = "[data-i18n], [data-i18n-placeholder], [data-i18n-title], [data-i18n-aria-label]";
    const nodes = animate && !reduceMotion ? [...document.querySelectorAll(selector)] : [];
    if (!nodes.length) { commit(); return; }

    // Fade the old wording out, swap it while invisible, then fade the new
    // wording in. Rapid clicks reuse the same timer, so only the last choice
    // is ever committed.
    root.classList.add("zqwy-lang-changing");
    nodes.forEach((el) => el.classList.add("lang-out"));
    P.langAnimTimer = window.setTimeout(() => {
      commit();
      nodes.forEach((el) => el.classList.remove("lang-out"));
      P.langAnimTimer = window.setTimeout(() => {
        root.classList.remove("zqwy-lang-changing");
        P.langAnimTimer = 0;
      }, 180);
    }, 140);
  }}
