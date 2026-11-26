/* menu/i18n.js — модуль скрипта menu.js. */
export function install(P) {
  Object.assign(P, { t, translateStatic, applyLanguage });


  function t(key, vars) {
    const value = P.I18N[P.language]?.[key] ?? P.I18N.ru[key] ?? key;
    if (!vars) return value;
    return value.replace(/\{(\w+)\}/g, (match, name) =>
      Object.prototype.hasOwnProperty.call(vars, name) ? String(vars[name]) : match);
  }

  // Markup translated on every language change (and after an SPA page swap).
  // `data-i18n-content` is used for <meta name="description">; the other three
  // cover text nodes, placeholders, titles and ARIA labels.
  const I18N_SELECTOR = [
    "[data-i18n]",
    "[data-i18n-placeholder], [data-i18n-title], [data-i18n-aria-label], [data-i18n-content], [data-i18n-alt], [data-i18n-html]",
  ].join(", ");

  function translateStatic() {
    document.querySelectorAll("[data-i18n]").forEach((el) => {
      const value = P.t(el.dataset.i18n);
      if (value) el.textContent = value;
    });
    document.querySelectorAll("[data-i18n-placeholder], [data-i18n-title], [data-i18n-aria-label], [data-i18n-content], [data-i18n-alt], [data-i18n-html]").forEach((el) => {
      for (const attr of ["placeholder", "title", "aria-label", "content", "alt"]) {
        const key = el.getAttribute(`data-i18n-${attr}`);
        if (key) el.setAttribute(attr, P.t(key));
      }
      // Only for our own trusted dictionary entries: keeps inline <b>/<code>.
      const htmlKey = el.getAttribute("data-i18n-html");
      if (htmlKey) el.innerHTML = P.t(htmlKey);
    });
    P.els.suggestions?.setAttribute("aria-label", P.t("suggestions"));
    if (P.els.logo && P.els.hasMenu) {
      P.els.logo.setAttribute("aria-label", P.t(P.els.menu.classList.contains("is-open") ? "menuClose" : "menuOpen"));
    }
    // Expose the site translator to modules with their own context (music page).
    window.zqwyT = P.t;
  }

  function applyLanguage(next, animate = false) {
    const resolved = P.LANGUAGES.includes(next) ? next : "ru";
    P.language = resolved; // keep t() and aria labels in sync immediately
    document.documentElement.lang = resolved;
    if (P.langAnimTimer) { window.clearTimeout(P.langAnimTimer); P.langAnimTimer = 0; }

    const commit = () => {
      translateStatic();
      P.updateSearchLayout();
      P.loadBuildInfo();
      // The player is injected outside [data-i18n] and translates itself.
      window.dispatchEvent(new CustomEvent("zqwy:languagechange", { detail: { language: resolved } }));
    };

    const root = document.documentElement;
    const reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const nodes = animate && !reduceMotion ? [...document.querySelectorAll(I18N_SELECTOR)] : [];
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