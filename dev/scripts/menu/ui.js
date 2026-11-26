/* menu/ui.js — модуль скрипта menu.js. */
export function install(P) {
  Object.assign(P, { refresh, updateMenuOrigin, finishClose, openMenu, closeMenu, updateSearchLayout });


  function refresh() {
    // A SPA page swap throws away the old DOM; drop marks and counters that
    // belonged to it before wiring the fresh elements.
    P.clearWordHighlights();
    const container = document.querySelector("#menuButtonContainer");
    const menu = document.querySelector("#siteMenu");

    // A page swap destroys the old DOM: drop any in-flight close state before
    // the new elements are wired up (transition.js may then click the logo to
    // reopen the catalog on a "back" link).
    P.closing = false;
    if (P.closeTimer) { window.clearTimeout(P.closeTimer); P.closeTimer = null; }
    menu?.classList.remove("is-closing");

    P.els = {
      container,
      menu,
      panel: menu?.querySelector(".site-menu") || null,
      logo: container?.querySelector(".menu-open-button") || null,
      row: container?.querySelector(".menu-trigger-row") || null,
      form: document.querySelector("#siteSearch"),
      input: document.querySelector("#siteSearchInput"),
      status: document.getElementById("search-status"),
      results: document.getElementById("search-results"),
      resultsArea: document.querySelector(".home-search-area"),
      settingsForm: document.getElementById("site-settings-form"),
      saved: document.getElementById("settings-saved"),
      reset: document.getElementById("settings-reset"),
    };

    // The dropdown lives inside the form so it follows search to every page;
    // creating it here also covers pages fetched by the SPA navigator.
    if (P.els.form && P.els.input && !document.getElementById("searchSuggestions")) {
      const list = document.createElement("div");
      list.className = "search-suggestions";
      list.id = "searchSuggestions";
      list.setAttribute("role", "listbox");
      list.setAttribute("aria-label", P.t("suggestions"));
      list.hidden = true;
      P.els.form.appendChild(list);

      P.els.input.setAttribute("role", "combobox");
      P.els.input.setAttribute("aria-autocomplete", "list");
      P.els.input.setAttribute("aria-controls", "searchSuggestions");
      P.els.input.setAttribute("aria-expanded", "false");
    }
    P.els.suggestions = document.getElementById("searchSuggestions");
    P.currentSuggestions = [];
    P.activeSuggestion = -1;
    P.els.hasMenu = !!(P.els.menu && P.els.panel && P.els.logo && P.els.logo.tagName === "BUTTON");
    P.updateMenuOrigin();
  }

  /* The catalog is a full-screen overlay, but the logo/search row is NEVER
     moved into it. Moving the row made it inherit the panel's opening
     transform (it jumped down and shrank) and, on mobile, changed its width
     and padding between the two modes. The row now stays in the page at one
     fixed coordinate; the overlay is revealed from that point instead.

     These variables are the centre of the logo button in viewport pixels and
     are used by base.css as the origin of the clip-path reveal. */
  function updateMenuOrigin() {
    if (!P.els.menu || !P.els.logo) return;
    const rect = P.els.logo.getBoundingClientRect();
    P.els.menu.style.setProperty("--menu-origin-x", `${Math.round(rect.left + rect.width / 2)}px`);
    P.els.menu.style.setProperty("--menu-origin-y", `${Math.round(rect.top + rect.height / 2)}px`);
  }

  /* ---------- menu overlay (home page only) ---------- */

  function finishClose() {
    P.closing = false;
    if (P.closeTimer) { window.clearTimeout(P.closeTimer); P.closeTimer = null; }
    P.els.menu?.classList.remove("is-closing");
    if (P.lastFocus && typeof P.lastFocus.focus === "function" && document.contains(P.lastFocus)) P.lastFocus.focus();
    else P.els.logo?.focus();
    P.lastFocus = null;
  }

  function openMenu() {
    if (!P.els.hasMenu || P.els.menu.classList.contains("is-open")) return;
    // A second click on the logo during the closing animation must reopen the
    // catalog immediately instead of being swallowed by the `closing` guard.
    if (P.closing) {
      if (P.closeTimer) { window.clearTimeout(P.closeTimer); P.closeTimer = null; }
      P.closing = false;
      P.els.menu.classList.remove("is-closing");
    }
    P.lastFocus = document.activeElement;
    P.prevOverflow = document.body.style.overflow;
    P.els.menu.classList.add("is-open");
    P.els.menu.setAttribute("aria-hidden", "false");
    P.els.logo.setAttribute("aria-expanded", "true");
    P.els.logo.setAttribute("aria-label", P.t("menuClose"));
    document.body.classList.add("menu-is-open");
    document.body.style.overflow = "hidden";
    // Refresh the reveal origin in case the viewport changed while closed.
    P.updateMenuOrigin();
    P.els.panel.scrollTop = 0;
  }

  function closeMenu() {
    if (!P.els.hasMenu || !P.els.menu.classList.contains("is-open") || P.closing) return;
    P.closing = true;
    P.els.menu.classList.remove("is-open");
    P.els.menu.classList.add("is-closing");
    P.els.menu.setAttribute("aria-hidden", "true");
    P.els.logo.setAttribute("aria-expanded", "false");
    P.els.logo.setAttribute("aria-label", P.t("menuOpen"));
    document.body.classList.remove("menu-is-open");
    document.body.style.overflow = P.prevOverflow;
    P.els.logo.focus();
    P.closeTimer = window.setTimeout(P.finishClose, 450);
  }

  /* ---------- compact search that grows with its text ---------- */

  function updateSearchLayout() {
    if (!P.els.row || !P.els.logo || !P.els.input) return;
    const rowW = P.els.row.getBoundingClientRect().width;
    const logoW = P.els.logo.getBoundingClientRect().width;
    if (!rowW || !logoW) return;

    const rowStyle = window.getComputedStyle(P.els.row);
    const gap = parseFloat(rowStyle.getPropertyValue("--menu-row-gap")) || 8;
    const inputStyle = window.getComputedStyle(P.els.input);

    let wanted = 120;
    const ctx = document.createElement("canvas").getContext("2d");
    if (ctx) {
      ctx.font = [
        inputStyle.fontStyle, inputStyle.fontVariant, inputStyle.fontWeight,
        inputStyle.fontSize, inputStyle.fontFamily,
      ].join(" ");
      const sample = P.els.input.value || P.els.input.placeholder || "Поиск";
      wanted = ctx.measureText(sample).width + 34;
    }
    wanted = Math.max(120, wanted);
    // The logo is anchored to the centre of the row and the search field grows
    // to its RIGHT, so only the space from the logo's right edge to the row's
    // right edge is available. Using the whole row width here used to push the
    // pair off-centre and move the logo as the query grew.
    const maxSearch = Math.max(0, rowW / 2 - logoW / 2 - gap - 8);
    P.els.row.style.setProperty("--search-width", `${Math.round(Math.min(wanted, maxSearch))}px`);
    P.updateMenuOrigin();
  }}
