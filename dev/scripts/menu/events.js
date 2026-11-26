/* menu/events.js — модуль скрипта menu.js. */
export function bindEvents(P) {


  /* ---------- one delegated listener set for the whole site ---------- */

  // A link inside the catalog navigates with the SPA. Close first, in the
  // capture phase, so the logo/search block is back in the page before
  // transition.js replaces .page-content with the next document.
  document.addEventListener("click", (ev) => {
    const target = ev.target instanceof Element ? ev.target : null;
    if (!target || !P.els.hasMenu || !P.els.menu?.classList.contains("is-open")) return;
    if (target.closest("#menuOpenButton") || target.closest("[data-menu-close]")) return;
    if (target.closest("a[href]")) P.closeMenu();
  }, true);

  document.addEventListener("click", (ev) => {
    const target = ev.target instanceof Element ? ev.target : null;
    if (!target) return;

    const suggestion = target.closest("[data-suggestion]");
    if (suggestion && P.els.suggestions?.contains(suggestion)) {
      P.chooseSuggestion(Number(suggestion.dataset.suggestion));
      return;
    }

    if (target.closest("#menuOpenButton") && P.els.hasMenu) {
      P.els.menu.classList.contains("is-open") ? P.closeMenu() : P.openMenu();
      return;
    }
    if (target.closest("[data-menu-close]")) { P.closeMenu(); return; }

    if (target.closest("#settings-reset")) {
      localStorage.removeItem(P.SETTINGS_KEY);
      P.previewTheme = null;
      P.previewLanguage = null;
      P.els.settingsForm?.reset();
      if (P.els.input) P.els.input.value = "";
      P.applyTheme("dark", true);
      P.applyLanguage("ru", true);
      P.loadBuildInfo();
      if (P.els.settingsForm) {
        const langRadio = P.els.settingsForm.querySelector('input[name="language"][value="ru"]');
        if (langRadio) langRadio.checked = true;
      }
      P.updateSearchLayout();
      P.setSavedMessage(P.t("resetDone"));
      return;
    }

    const toggle = target.closest("[data-toggle]");
    if (toggle) {
      const panel = document.getElementById(toggle.getAttribute("data-toggle"));
      if (!panel) return;
      const isOpen = toggle.getAttribute("aria-expanded") === "true";
      if (isOpen) {
        panel.style.maxHeight = `${panel.scrollHeight}px`;
        void panel.offsetHeight;
        panel.classList.remove("is-open");
        panel.style.maxHeight = "0px";
        toggle.setAttribute("aria-expanded", "false");
        panel.addEventListener("transitionend", function done(event) {
          if (event.propertyName !== "max-height") return;
          panel.style.maxHeight = "";
          panel.removeEventListener("transitionend", done);
        });
      } else {
        panel.style.maxHeight = "0px";
        void panel.offsetHeight;
        panel.classList.add("is-open");
        panel.style.maxHeight = `${panel.scrollHeight}px`;
        toggle.setAttribute("aria-expanded", "true");
        panel.addEventListener("transitionend", function done(event) {
          if (event.propertyName !== "max-height") return;
          panel.style.maxHeight = "none";
          panel.removeEventListener("transitionend", done);
          panel.scrollIntoView({ block: "nearest", behavior: "smooth" });
        });
      }
    }
  });

  // Theme radios preview immediately; only the Save button writes them to
  // localStorage. Other settings keep their existing save-time behaviour.
  document.addEventListener("change", (ev) => {
    const target = ev.target instanceof Element ? ev.target : null;
    if (!target || !P.els.settingsForm?.contains(target)) return;
    if (target.matches('input[name="theme"]')) P.previewThemeChoice(target.value);
    if (target.matches('input[name="language"]')) P.previewLanguageChoice(target.value);
  });

  document.addEventListener("input", (ev) => {
    if (ev.target === P.els.input) {
      P.updateSearchLayout();
      // One shared index load is in flight at a time; render suggestions only
      // after the visitor pauses so typing does not queue a dozen renders.
      if (P.suggestionTimer) window.clearTimeout(P.suggestionTimer);
      P.suggestionTimer = window.setTimeout(() => {
        P.suggestionTimer = 0;
        P.updateSuggestions();
      }, 140);
    }
  });

  // Keep focus in the field when a suggestion is pressed: the delayed blur
  // below would otherwise close the list before the click is delivered.
  document.addEventListener("mousedown", (ev) => {
    if (ev.target instanceof Element && ev.target.closest(".search-suggestions")) ev.preventDefault();
  });
  document.addEventListener("focusout", (ev) => {
    if (ev.target !== P.els.input) return;
    if (P.suggestionBlurTimer) window.clearTimeout(P.suggestionBlurTimer);
    P.suggestionBlurTimer = window.setTimeout(() => {
      P.hideSuggestions();
      P.suggestionBlurTimer = 0;
    }, 140);
  });

  document.addEventListener("submit", async (ev) => {
    if (ev.target === P.els.settingsForm) {
      ev.preventDefault();
      P.saveSettings();
      P.previewTheme = null;
      P.previewLanguage = null;
      return;
    }
    if (ev.target !== P.els.form) return;
    ev.preventDefault();
    if (P.suggestionTimer) { window.clearTimeout(P.suggestionTimer); P.suggestionTimer = 0; }
    const query = (P.els.input?.value || "").trim();
    if (!query) {
      P.clearWordHighlights();
      P.lastSearchQuery = "";
      P.lastResultCount = 0;
      P.lastIndexError = false;
    }
    if (P.els.status && P.els.results) {
      P.performSearch(query);
      return;
    }
    // No results area on this page: first look right here. Mark every matching
    // word and jump to the first one instead of leaving the page.
    let localIndex = null;
    P.els.input?.setAttribute("aria-busy", "true");
    try { localIndex = await P.loadIndex(); } catch { /* page search still works */ }
    finally { P.els.input?.removeAttribute("aria-busy"); }
    const localMatches = P.findPageMatches(query, localIndex);
    if (localMatches.length) {
      P.lastSearchQuery = query;
      P.lastResultCount = localMatches.length;
      P.lastIndexError = false;
      P.markTextMatches(query, localIndex);
      P.activateWordHighlight(0);
      P.els.input?.blur();
      return;
    }
    // Otherwise hand the query to the home page.
    const target = new URL(P.els.form?.getAttribute("action") || "../", window.location.href);
    target.hash = "";
    if (query) target.searchParams.set("q", query);
    else target.searchParams.set("catalog", "1");
    if (typeof window.zqwyNavigate === "function") window.zqwyNavigate(target.href);
    else window.location.assign(target.href);
  });

  document.addEventListener("keydown", (ev) => {
    // Navigate the prefix list while the search field has focus.
    if (P.els.input && ev.target === P.els.input && P.els.suggestions && !P.els.suggestions.hidden) {
      if (ev.key === "ArrowDown") {
        ev.preventDefault();
        P.setActiveSuggestion(P.activeSuggestion + 1);
        return;
      }
      if (ev.key === "ArrowUp") {
        ev.preventDefault();
        P.setActiveSuggestion(P.activeSuggestion - 1);
        return;
      }
      if (ev.key === "Enter" && P.currentSuggestions.length) {
        ev.preventDefault();
        P.chooseSuggestion(P.activeSuggestion >= 0 ? P.activeSuggestion : 0);
        return;
      }
      if (ev.key === "Escape") {
        ev.preventDefault();
        P.hideSuggestions();
        return;
      }
    }

    // Enter on an unchanged query walks through every highlighted word.
    // A changed query falls through to the normal form submit (new search).
    if (ev.key === "Enter" && P.els.input && ev.target === P.els.input &&
        P.lastSearchQuery && P.normalize(P.els.input.value) === P.normalize(P.lastSearchQuery) &&
        P.wordHighlights.length) {
      ev.preventDefault();
      P.activateWordHighlight(P.activeWordIndex + (ev.shiftKey ? -1 : 1));
      return;
    }

    // Ctrl/Cmd+F focuses the site's own search instead of the browser's find.
    if ((ev.ctrlKey || ev.metaKey) && (ev.key === "f" || ev.key === "F" || ev.code === "KeyF")) {
      const input = P.els.input || document.getElementById("siteSearchInput");
      if (input) {
        ev.preventDefault();
        if (P.els.hasMenu && P.els.menu.classList.contains("is-open")) P.closeMenu();
        input.scrollIntoView({ block: "center", behavior: "smooth" });
        input.focus({ preventScroll: true });
        input.select();
      }
      return;
    }
    if (ev.key === "Escape" && P.els.hasMenu && P.els.menu.classList.contains("is-open")) P.closeMenu();
  });

  P.systemQuery?.addEventListener?.("change", () => {
    const theme = P.previewTheme || (P.readSettings() || {}).theme;
    if (theme === "system") P.applyTheme("system", true);
  });

  P.initPage();
  window.addEventListener("resize", P.updateSearchLayout);
  window.addEventListener("zqwy:pagechange", P.initPage);}
