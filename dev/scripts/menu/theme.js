/* menu/theme.js — модуль скрипта menu.js. */
export function install(P) {
  Object.assign(P, { applyTheme, previewThemeChoice, previewLanguageChoice });


  function applyTheme(theme, animate = false) {
    let resolved = theme;
    if (theme === "system") resolved = P.systemQuery && P.systemQuery.matches ? "light" : "dark";
    const root = document.documentElement;
    if (animate) {
      // The class enables the CSS colour transitions for one switch. It is
      // never added on first paint, so the stored theme appears without motion.
      root.classList.add("zqwy-theme-changing");
      root.setAttribute("data-theme-change-to", resolved);
      // Force a style flush: without it the browser batches the class and the
      // new data-theme into one frame and the transition silently never runs.
      void root.offsetWidth;
      if (P.themeAnimTimer) window.clearTimeout(P.themeAnimTimer);
      P.themeAnimTimer = window.setTimeout(() => {
        root.classList.remove("zqwy-theme-changing");
        root.removeAttribute("data-theme-change-to");
        P.themeAnimTimer = 0;
      }, 560);
    } else if (!P.themeAnimTimer) {
      root.classList.remove("zqwy-theme-changing");
      root.removeAttribute("data-theme-change-to");
    }
    root.dataset.theme = resolved === "light" ? "light" : "dark";
    window.dispatchEvent(new CustomEvent("zqwy:themechange", { detail: { theme: resolved } }));
  }

  function previewThemeChoice(theme) {
    if (!["dark", "light", "system"].includes(theme)) return;
    P.previewTheme = theme;
    P.applyTheme(theme, true);
    P.setSavedMessage(P.t("themePreview"), 0);
  }

  function previewLanguageChoice(next) {
    if (!["ru", "en"].includes(next)) return;
    P.previewLanguage = next;
    P.applyLanguage(next, true);
    P.setSavedMessage(P.t("languagePreview"), 0);
  }}
