/*
 * Base element of every page: logo + growing search.
 *
 * The handler set is installed once on `document` and only the element
 * references are refreshed on `zqwy:pagechange`. That keeps the code working
 * with the SPA navigation in transition.js: no listeners are left behind on
 * DOM nodes that were swapped out.
 */
(() => {
  "use strict";

  const SETTINGS_KEY = "zqwy.site.settings.v1";
  const INDEX_FILE = "./data/search-index.json";
  const systemQuery = window.matchMedia ? window.matchMedia("(prefers-color-scheme: light)") : null;

  /* Site chrome is bilingual. Search data stays bilingual regardless of this
     setting — the switch only translates the interface, not the index. */
  const I18N = {
    ru: {
      menuOpen: "Открыть меню", menuClose: "Закрыть меню",
      siteSearch: "Поиск", siteSearchLabel: "Общий поиск сайта",
      searchPlaceholder: "Поиск", searchTitle: "Общий поиск сайта (Ctrl+F)",
      homeHeading: "Поиск по моим данным. Откройте меню (логотип) для каталога и настроек.",
      searchResults: "Результаты поиска", siteMenu: "Меню сайта", mainMenu: "Основное меню",
      catalog: "Каталог", back: "Назад",
      notesHeading: "Заметки в формате markdown, собранные из src/notes/.",
      notesEmpty: "Заметки пока не добавлены. Положите .md-файлы в src/notes/.",
      wikiHint: "Хранение текстовой информации. Формат: markdown (преобразуется в HTML выбранным движком).",
      settingsHint: "Настройки касаются всего веб-сайта.",
      theme: "Тема", themeDark: "Тёмная", themeLight: "Светлая", themeSystem: "Системная",
      search: "Поиск", rememberQuery: "Запоминать последний запрос",
      language: "Язык", languageRu: "Русский", languageEn: "English",
      reset: "Сбросить", save: "Сохранить",
      searching: "Поиск: «{query}»…", found: "Найдено: {count}",
      noResults: "Ничего не найдено. Попробуйте слово на другом языке.",
      indexUnavailable: "Индекс поиска недоступен (data/search-index.json).",
      saved: "Сохранено.", resetDone: "Сброшено.", enterQuery: "Введите запрос для поиска.",
    },
    en: {
      menuOpen: "Open menu", menuClose: "Close menu",
      siteSearch: "Search", siteSearchLabel: "Site-wide search",
      searchPlaceholder: "Search", searchTitle: "Site-wide search (Ctrl+F)",
      homeHeading: "Search across my data. Open the menu (logo) for the catalog and settings.",
      searchResults: "Search results", siteMenu: "Site menu", mainMenu: "Main menu",
      catalog: "Catalog", back: "Back",
      notesHeading: "Markdown notes collected from src/notes/.",
      notesEmpty: "No notes yet. Put .md files into src/notes/.",
      wikiHint: "Text storage. Format: markdown (converted to HTML by the selected engine).",
      settingsHint: "Settings apply to the whole site.",
      theme: "Theme", themeDark: "Dark", themeLight: "Light", themeSystem: "System",
      search: "Search", rememberQuery: "Remember last query",
      language: "Language", languageRu: "Russian", languageEn: "English",
      reset: "Reset", save: "Save",
      searching: "Searching: “{query}”…", found: "Found: {count}",
      noResults: "Nothing found. Try a word in another language.",
      indexUnavailable: "Search index unavailable (data/search-index.json).",
      saved: "Saved.", resetDone: "Reset.", enterQuery: "Enter a query to search.",
    },
  };
  let language = "ru";

  function t(key, vars) {
    const value = I18N[language]?.[key] ?? I18N.ru[key] ?? key;
    if (!vars) return value;
    return value.replace(/\{(\w+)\}/g, (match, name) =>
      Object.prototype.hasOwnProperty.call(vars, name) ? String(vars[name]) : match);
  }

  function applyLanguage(next) {
    language = next === "en" ? "en" : "ru";
    document.documentElement.lang = language;
    document.querySelectorAll("[data-i18n]").forEach((el) => {
      const value = t(el.dataset.i18n);
      if (value) el.textContent = value;
    });
    document.querySelectorAll("[data-i18n-placeholder], [data-i18n-title], [data-i18n-aria-label]").forEach((el) => {
      for (const attr of ["placeholder", "title", "aria-label"]) {
        const key = el.getAttribute(`data-i18n-${attr}`);
        if (key) el.setAttribute(attr, t(key));
      }
    });
    if (els.logo && els.hasMenu) {
      els.logo.setAttribute("aria-label", t(els.menu.classList.contains("is-open") ? "menuClose" : "menuOpen"));
    }
    updateSearchLayout();
  }

  let els = {};
  let closing = false;
  let closeTimer = null;
  let lastFocus = null;
  let prevOverflow = "";
  let indexCache = null;

  function refresh() {
    const container = document.querySelector("#menuButtonContainer");
    const menu = document.querySelector("#siteMenu");
    els = {
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
    els.hasMenu = !!(els.menu && els.panel && els.logo && els.logo.tagName === "BUTTON");
  }

  /* ---------- menu overlay (home page only) ---------- */

  function finishClose() {
    closing = false;
    if (closeTimer) { window.clearTimeout(closeTimer); closeTimer = null; }
    els.menu?.classList.remove("is-closing");
    if (lastFocus && typeof lastFocus.focus === "function" && document.contains(lastFocus)) lastFocus.focus();
    else els.logo?.focus();
    lastFocus = null;
  }

  function openMenu() {
    if (!els.hasMenu || closing || els.menu.classList.contains("is-open")) return;
    lastFocus = document.activeElement;
    prevOverflow = document.body.style.overflow;
    els.menu.classList.add("is-open");
    els.menu.setAttribute("aria-hidden", "false");
    els.logo.setAttribute("aria-expanded", "true");
    els.logo.setAttribute("aria-label", t("menuClose"));
    document.body.classList.add("menu-is-open");
    document.body.style.overflow = "hidden";
    els.panel.scrollTop = 0;
  }

  function closeMenu() {
    if (!els.hasMenu || !els.menu.classList.contains("is-open") || closing) return;
    closing = true;
    els.menu.classList.remove("is-open");
    els.menu.classList.add("is-closing");
    els.menu.setAttribute("aria-hidden", "true");
    els.logo.setAttribute("aria-expanded", "false");
    els.logo.setAttribute("aria-label", t("menuOpen"));
    document.body.classList.remove("menu-is-open");
    document.body.style.overflow = prevOverflow;
    els.logo.focus();
    closeTimer = window.setTimeout(finishClose, 450);
  }

  /* ---------- compact search that grows with its text ---------- */

  function updateSearchLayout() {
    if (!els.row || !els.logo || !els.input) return;
    const rowW = els.row.getBoundingClientRect().width;
    const logoW = els.logo.getBoundingClientRect().width;
    if (!rowW || !logoW) return;

    const rowStyle = window.getComputedStyle(els.row);
    const gap = parseFloat(rowStyle.getPropertyValue("--menu-row-gap")) || 8;
    const inputStyle = window.getComputedStyle(els.input);

    let wanted = 120;
    const ctx = document.createElement("canvas").getContext("2d");
    if (ctx) {
      ctx.font = [
        inputStyle.fontStyle, inputStyle.fontVariant, inputStyle.fontWeight,
        inputStyle.fontSize, inputStyle.fontFamily,
      ].join(" ");
      const sample = els.input.value || els.input.placeholder || "Поиск";
      wanted = ctx.measureText(sample).width + 34;
    }
    wanted = Math.max(120, wanted);
    const maxSearch = Math.max(0, rowW - logoW - gap - 8);
    els.row.style.setProperty("--search-width", `${Math.round(Math.min(wanted, maxSearch))}px`);
  }

  /* ---------- search: keywords + RU/EN synonyms + tracks ---------- */

  function normalize(value) {
    return String(value || "")
      .toLowerCase()
      .replace(/ё/g, "е")
      .replace(/[_-]+/g, " ")
      .replace(/[^a-zа-я0-9\s]/gi, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function synonymMap(groups) {
    const map = new Map();
    for (const group of groups || []) {
      const forms = group.map(normalize).filter(Boolean);
      for (const form of forms) {
        const set = map.get(form) || new Set();
        forms.forEach((item) => set.add(item));
        map.set(form, set);
      }
    }
    return map;
  }

  function haystack(item) {
    const values = [item.title, item.text, item.category, item.path, item.alias];
    values.push(Array.isArray(item.tags) ? item.tags.join(" ") : item.tags);
    values.push(Array.isArray(item.keywords) ? item.keywords.join(" ") : item.keywords);
    return normalize(values.join(" "));
  }

  /* Multi-word aliases from the index let a whole phrase be found even when
     the visitor types it inside a longer sentence. The normal token search
     runs first; only if it finds nothing do we retry with the recognised
     phrase forms, so existing results keep their order. */
  function phraseQueries(data, query) {
    const queries = [query];
    const normalized = normalize(query);
    const seen = new Set([normalized]);
    const groups = Array.isArray(data) ? [] : (data && data.phrases) || [];
    for (const group of groups) {
      const forms = (Array.isArray(group) ? group : (group && group.phrases) || [])
        .map(normalize)
        .filter(Boolean);
      if (!forms.length) continue;
      if (!forms.some((form) => ` ${normalized} `.includes(` ${form} `))) continue;
      for (const form of forms) {
        if (seen.has(form)) continue;
        seen.add(form);
        queries.push(form);
      }
    }
    return queries;
  }

  function searchTokens(data, query) {
    const items = Array.isArray(data) ? data : (data && data.items) || [];
    const groups = Array.isArray(data) ? [] : (data && data.synonyms) || (data && data.synonymGroups) || [];
    const map = synonymMap(groups);
    const tokens = normalize(query).split(" ").filter(Boolean);
    if (!tokens.length) return [];

    return items.filter((item) => {
      const hay = haystack(item);
      // Every word of the query must be found, either directly or through
      // a synonym from another language (e.g. "tiktok" → "тикток").
      return tokens.every((token) => {
        const variants = new Set([token]);
        const related = map.get(token);
        if (related) related.forEach((word) => variants.add(word));
        // Also allow a token that is part of a multi-word synonym group.
        for (const [key, words] of map) {
          if (key.split(" ").includes(token)) words.forEach((word) => variants.add(word));
        }
        return [...variants].some((word) => word && hay.includes(word));
      });
    });
  }

  function runSearch(data, query) {
    const results = [];
    const seen = new Set();
    for (const candidate of phraseQueries(data, query)) {
      for (const item of searchTokens(data, candidate)) {
        const key = `${item.type || ""}:${item.path || ""}:${item.title || ""}`;
        if (seen.has(key)) continue;
        seen.add(key);
        results.push(item);
      }
      if (results.length) break;
    }
    return results.slice(0, 50);
  }

  const TYPE_ICON = {
    link: "🔗",
    track: "♪",
    album: "▣",
    game: "🎮",
    page: "▤",
  };

  function renderResults(container, items) {
    if (!items.length) return;
    const frag = document.createDocumentFragment();
    for (const item of items) {
      const el = document.createElement("article");
      el.className = "search-result-item";
      el.dataset.type = item.type || "page";

      const link = document.createElement("a");
      // setAttribute keeps the literal '&' in query strings; assigning the
      // href property with pre-escaped HTML would create a param named
      // 'amp;track' instead of 'track'.
      link.setAttribute("href", String(item.path || "#"));
      if (/^https?:\/\//i.test(item.path || "")) {
        link.target = "_blank";
        link.rel = "noopener noreferrer";
      }
      link.textContent = item.title || item.path || "Без названия";

      const icon = document.createElement("span");
      icon.className = "search-result-icon";
      icon.setAttribute("aria-hidden", "true");
      icon.textContent = TYPE_ICON[item.type] || "▤";

      const head = document.createElement("div");
      head.className = "search-result-head";
      head.append(icon, link);
      el.appendChild(head);

      const metaText = [item.category, item.text]
        .filter(Boolean).join(" · ");
      if (metaText) {
        const meta = document.createElement("div");
        meta.className = "search-result-meta";
        meta.textContent = metaText;
        el.appendChild(meta);
      }
      frag.appendChild(el);
    }
    container.appendChild(frag);
  }

  async function loadIndex() {
    if (indexCache) return indexCache;
    const response = await fetch(INDEX_FILE, { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    indexCache = await response.json();
    return indexCache;
  }

  async function performSearch(query) {
    if (!els.results || !els.status) return;
    els.results.replaceChildren();
    if (!query) {
      // An empty submit is a deliberate "show me the catalog" action.
      els.status.textContent = "";
      openMenu();
      return;
    }
    try {
      if ((readSettings() || {}).rememberQuery) saveSettings({ lastQuery: query }, true);
      els.status.textContent = t("searching", { query });
      const index = await loadIndex();
      const matches = runSearch(index, query);
      renderResults(els.results, matches);
      els.status.textContent = matches.length
        ? t("found", { count: matches.length })
        : t("noResults");
      if (els.hasMenu && els.menu.classList.contains("is-open")) closeMenu();
      els.resultsArea?.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch {
      els.status.textContent = t("indexUnavailable");
    }
  }

  /* ---------- settings (site-wide) ---------- */

  function applyTheme(theme) {
    let resolved = theme;
    if (theme === "system") resolved = systemQuery && systemQuery.matches ? "light" : "dark";
    document.documentElement.dataset.theme = resolved === "light" ? "light" : "dark";
    window.dispatchEvent(new CustomEvent("zqwy:themechange", { detail: { theme: resolved } }));
  }

  function readSettings() {
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  }

  function saveSettings(extra = {}, silent = false) {
    const base = readSettings() || {};
    const settings = {
      ...base,
      theme: els.settingsForm?.querySelector('input[name="theme"]:checked')?.value || base.theme || "dark",
      rememberQuery: els.settingsForm
        ? !!els.settingsForm.querySelector('input[name="rememberQuery"]')?.checked
        : !!base.rememberQuery,
      language: els.settingsForm?.querySelector('input[name="language"]:checked')?.value || base.language || "ru",
      ...extra,
    };
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch {}
    applyTheme(settings.theme);
    applyLanguage(settings.language);
    if (els.saved && !silent) {
      els.saved.textContent = t("saved");
      window.setTimeout(() => { if (els.saved) els.saved.textContent = ""; }, 2000);
    }
  }

  function loadSettings() {
    const settings = readSettings() || { theme: "dark", rememberQuery: false, language: "ru" };
    applyTheme(settings.theme || "dark");
    applyLanguage(settings.language);
    if (els.settingsForm) {
      const radio = els.settingsForm.querySelector(`input[name="theme"][value="${settings.theme || "dark"}"]`);
      if (radio) radio.checked = true;
      const remember = els.settingsForm.querySelector('input[name="rememberQuery"]');
      if (remember) remember.checked = !!settings.rememberQuery;
      const langRadio = els.settingsForm.querySelector(`input[name="language"][value="${language}"]`);
      if (langRadio) langRadio.checked = true;
      if (els.input && settings.rememberQuery && settings.lastQuery) els.input.value = settings.lastQuery;
    }
  }

  /* ---------- one delegated listener set for the whole site ---------- */

  document.addEventListener("click", (ev) => {
    const target = ev.target instanceof Element ? ev.target : null;
    if (!target) return;

    if (target.closest("#menuOpenButton") && els.hasMenu) {
      els.menu.classList.contains("is-open") ? closeMenu() : openMenu();
      return;
    }
    if (target.closest("[data-menu-close]")) { closeMenu(); return; }

    if (target.closest("#settings-reset")) {
      localStorage.removeItem(SETTINGS_KEY);
      els.settingsForm?.reset();
      if (els.input) els.input.value = "";
      applyTheme("dark");
      applyLanguage("ru");
      if (els.settingsForm) {
        const langRadio = els.settingsForm.querySelector('input[name="language"][value="ru"]');
        if (langRadio) langRadio.checked = true;
      }
      updateSearchLayout();
      if (els.saved) { els.saved.textContent = t("resetDone"); window.setTimeout(() => { els.saved.textContent = ""; }, 2000); }
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

  document.addEventListener("input", (ev) => {
    if (ev.target === els.input) updateSearchLayout();
  });

  document.addEventListener("submit", (ev) => {
    if (ev.target === els.settingsForm) {
      ev.preventDefault();
      saveSettings();
      return;
    }
    if (ev.target !== els.form) return;
    ev.preventDefault();
    const query = (els.input?.value || "").trim();
    if (els.status && els.results) {
      performSearch(query);
      return;
    }
    // No results area on this page: hand the query to the home page.
    const target = new URL(els.form?.getAttribute("action") || "../", window.location.href);
    target.hash = "";
    if (query) target.searchParams.set("q", query);
    else target.searchParams.set("catalog", "1");
    if (typeof window.zqwyNavigate === "function") window.zqwyNavigate(target.href);
    else window.location.assign(target.href);
  });

  document.addEventListener("keydown", (ev) => {
    // Ctrl/Cmd+F focuses the site's own search instead of the browser's find.
    if ((ev.ctrlKey || ev.metaKey) && (ev.key === "f" || ev.key === "F" || ev.code === "KeyF")) {
      const input = els.input || document.getElementById("siteSearchInput");
      if (input) {
        ev.preventDefault();
        if (els.hasMenu && els.menu.classList.contains("is-open")) closeMenu();
        input.scrollIntoView({ block: "center", behavior: "smooth" });
        input.focus({ preventScroll: true });
        input.select();
      }
      return;
    }
    if (ev.key === "Escape" && els.hasMenu && els.menu.classList.contains("is-open")) closeMenu();
  });

  systemQuery?.addEventListener?.("change", () => {
    if ((readSettings() || {}).theme === "system") applyTheme("system");
  });

  /* ---------- page lifecycle ---------- */

  function initPage() {
    refresh();
    loadSettings();

    document.querySelectorAll(".menu-catalog > .site-menu-item").forEach((el, i) => {
      el.style.setProperty("--i", String(i));
    });

    updateSearchLayout();
    document.fonts?.ready.then(updateSearchLayout);

    const params = new URLSearchParams(window.location.search);
    const initialQuery = params.get("q");
    if (initialQuery && els.status && els.results && els.input) {
      els.input.value = initialQuery;
      performSearch(initialQuery);
    } else if (params.get("catalog") === "1") {
      // Empty search from a secondary page lands on the home catalog.
      window.setTimeout(() => {
        openMenu();
        const url = new URL(window.location.href);
        url.searchParams.delete("catalog");
        window.history.replaceState({}, "", url);
      }, 80);
    }
  }

  initPage();
  window.addEventListener("resize", updateSearchLayout);
  window.addEventListener("zqwy:pagechange", initPage);
})();
