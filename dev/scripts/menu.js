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
  // SPA navigation changes document.baseURI. Resolve the index once, while the
  // script still runs on its original page, so suggestions keep working after
  // moving to /music/, /links/ and every other section.
  const INDEX_URL = new URL(INDEX_FILE, document.baseURI).href;
  // Build info is only rendered in the home settings panel, but this script
  // also runs on secondary pages. Anchor it to the script itself so a direct
  // load of /music/ still points at the site-wide /data/ folder.
  const SCRIPT_URL = document.currentScript?.src || new URL("./scripts/menu.js", document.baseURI).href;
  const BUILD_INFO_URL = new URL("../data/build-info.json", SCRIPT_URL).href;
  const systemQuery = window.matchMedia ? window.matchMedia("(prefers-color-scheme: light)") : null;

  /* Site chrome is bilingual. Search data stays bilingual regardless of this
     setting — the switch only translates the interface, not the index. */
  const I18N = {
    ru: {
      menuOpen: "Открыть меню", menuClose: "Закрыть меню",
      siteSearch: "Поиск", siteSearchLabel: "Общий поиск сайта",
      searchPlaceholder: "Поиск", searchTitle: "Общий поиск сайта (Ctrl+F)",
      homeHeading: "Поиск по моим данным. Откройте меню (логотип) для каталога и настроек.",
      searchResults: "Результаты поиска", suggestions: "Подсказки поиска",
      siteMenu: "Меню сайта", mainMenu: "Основное меню",
      catalog: "Каталог", back: "Назад",
      catalogWiki: "вики", catalogGame: "игры", catalogMusic: "музыка",
      catalogPhoto: "фото", catalogLinks: "ссылки", catalogSettings: "настройки",
      homeGame: "игры", homeMusic: "музыка", homeLinks: "ссылки",
      notesHeading: "Заметки в формате markdown, собранные из src/notes/.",
      notesBack: "Назад к заметкам",
      blogHeading: "Блог · хронология",
      blogHint: "Записи расположены по датам — от новых к старым.",
      linksHeading: "Все мои ссылки в одном месте.",
      linksNavSections: "Разделы ссылок",
      linksNavSocial: "Соцсети и контент", linksNavMusic: "Музыкальные площадки",
      linksNavStocks: "Стоки",
      linksSectionSocial: "Соцсети и контент", linksSectionMusic: "Музыкальные площадки",
      linksSectionStocks: "Стоки",
      notesEmpty: "Заметки пока не добавлены. Положите .md-файлы в src/notes/.",
      wikiHint: "Хранение текстовой информации. Формат: markdown (преобразуется в HTML выбранным движком).",
      settingsHint: "Настройки касаются всего веб-сайта.",
      playerSettings: "Настройки плеера",
      theme: "Тема", themeDark: "Тёмная", themeLight: "Светлая", themeSystem: "Системная",
      search: "Поиск", rememberQuery: "Запоминать последний запрос",
      language: "Язык", languageRu: "Русский", languageEn: "English",
      reset: "Сбросить", save: "Сохранить",
      searching: "Поиск: «{query}»…", found: "Найдено: {count}",
      matchProgress: "Совпадение {current} из {total} · Enter — дальше",
      enterNext: "Enter — перейти к совпадениям",
      noResults: "Ничего не найдено. Попробуйте слово на другом языке.",
      onPage: "На странице",
      indexUnavailable: "Индекс поиска недоступен (data/search-index.json).",
      build: "Версия сборки", buildNumber: "сборка", buildUnavailable: "недоступна",
      themePreview: "Предпросмотр темы — нажмите «Сохранить».",
      languagePreview: "Предпросмотр языка — нажмите «Сохранить».",
      saved: "Сохранено.", resetDone: "Сброшено.", enterQuery: "Введите запрос для поиска.",
    },
    en: {
      menuOpen: "Open menu", menuClose: "Close menu",
      siteSearch: "Search", siteSearchLabel: "Site-wide search",
      searchPlaceholder: "Search", searchTitle: "Site-wide search (Ctrl+F)",
      homeHeading: "Search across my data. Open the menu (logo) for the catalog and settings.",
      searchResults: "Search results", suggestions: "Search suggestions",
      siteMenu: "Site menu", mainMenu: "Main menu",
      catalog: "Catalog", back: "Back",
      catalogWiki: "wiki", catalogGame: "games", catalogMusic: "music",
      catalogPhoto: "photo", catalogLinks: "links", catalogSettings: "settings",
      homeGame: "games", homeMusic: "music", homeLinks: "links",
      notesHeading: "Markdown notes collected from src/notes/.",
      notesBack: "Back to notes",
      blogHeading: "Blog · timeline",
      blogHint: "Entries follow dates — newest first.",
      linksHeading: "All my links in one place.",
      linksNavSections: "Link sections",
      linksNavSocial: "Social & content", linksNavMusic: "Music platforms",
      linksNavStocks: "Stocks",
      linksSectionSocial: "Social & content", linksSectionMusic: "Music platforms",
      linksSectionStocks: "Stocks",
      notesEmpty: "No notes yet. Put .md files into src/notes/.",
      wikiHint: "Text storage. Format: markdown (converted to HTML by the selected engine).",
      settingsHint: "Settings apply to the whole site.",
      playerSettings: "Player settings",
      theme: "Theme", themeDark: "Dark", themeLight: "Light", themeSystem: "System",
      search: "Search", rememberQuery: "Remember last query",
      language: "Language", languageRu: "Russian", languageEn: "English",
      reset: "Reset", save: "Save",
      searching: "Searching: “{query}”…", found: "Found: {count}",
      matchProgress: "Match {current} of {total} · Enter — next",
      enterNext: "Enter — jump to matches",
      noResults: "Nothing found. Try a word in another language.",
      onPage: "On this page",
      indexUnavailable: "Search index unavailable (data/search-index.json).",
      build: "Build version", buildNumber: "build", buildUnavailable: "unavailable",
      themePreview: "Theme preview — click “Save” to keep it.",
      languagePreview: "Language preview — click “Save” to keep it.",
      saved: "Saved.", resetDone: "Reset.", enterQuery: "Enter a query to search.",
    },
  };
  let language = "ru";
  // A theme chosen in the settings form is only a preview until Save is pressed.
  // It lives in memory so a reload falls back to the last saved choice.
  let previewTheme = null;
  let previewLanguage = null;
  let themeAnimTimer = 0;
  let langAnimTimer = 0;
  let savedTimer = 0;
  let buildInfoCache = null;

  function t(key, vars) {
    const value = I18N[language]?.[key] ?? I18N.ru[key] ?? key;
    if (!vars) return value;
    return value.replace(/\{(\w+)\}/g, (match, name) =>
      Object.prototype.hasOwnProperty.call(vars, name) ? String(vars[name]) : match);
  }

  function applyLanguage(next, animate = false) {
    const resolved = next === "en" ? "en" : "ru";
    language = resolved; // keep t() and aria labels in sync immediately
    document.documentElement.lang = resolved;
    if (langAnimTimer) { window.clearTimeout(langAnimTimer); langAnimTimer = 0; }

    const commit = () => {
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
      els.suggestions?.setAttribute("aria-label", t("suggestions"));
      if (els.logo && els.hasMenu) {
        els.logo.setAttribute("aria-label", t(els.menu.classList.contains("is-open") ? "menuClose" : "menuOpen"));
      }
      updateSearchLayout();
      loadBuildInfo();
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
    langAnimTimer = window.setTimeout(() => {
      commit();
      nodes.forEach((el) => el.classList.remove("lang-out"));
      langAnimTimer = window.setTimeout(() => {
        root.classList.remove("zqwy-lang-changing");
        langAnimTimer = 0;
      }, 180);
    }, 140);
  }

  let els = {};
  let closing = false;
  let closeTimer = null;
  let lastFocus = null;
  let prevOverflow = "";
  let indexCache = null;
  let suggestionCache = null;
  let currentSuggestions = [];
  let activeSuggestion = -1;
  let suggestionSeq = 0;
  let suggestionBlurTimer = 0;
  let pageMatches = [];
  // Word-level marks survive until the next search so Enter can walk through
  // every match instead of re-running the same query.
  let wordHighlights = [];
  let activeWordIndex = -1;
  let lastSearchQuery = "";
  let lastResultCount = 0;
  let lastIndexError = false;
  let blockGlowTimer = 0;
  let activeGlowTimer = 0;
  const MAX_WORD_HIGHLIGHTS = 200;

  function refresh() {
    // A SPA page swap throws away the old DOM; drop marks and counters that
    // belonged to it before wiring the fresh elements.
    clearWordHighlights();
    const container = document.querySelector("#menuButtonContainer");
    const menu = document.querySelector("#siteMenu");

    // A page swap destroys the old DOM: drop any in-flight close state before
    // the new elements are wired up (transition.js may then click the logo to
    // reopen the catalog on a "back" link).
    closing = false;
    if (closeTimer) { window.clearTimeout(closeTimer); closeTimer = null; }
    menu?.classList.remove("is-closing");

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

    // The dropdown lives inside the form so it follows search to every page;
    // creating it here also covers pages fetched by the SPA navigator.
    if (els.form && els.input && !document.getElementById("searchSuggestions")) {
      const list = document.createElement("div");
      list.className = "search-suggestions";
      list.id = "searchSuggestions";
      list.setAttribute("role", "listbox");
      list.setAttribute("aria-label", t("suggestions"));
      list.hidden = true;
      els.form.appendChild(list);

      els.input.setAttribute("role", "combobox");
      els.input.setAttribute("aria-autocomplete", "list");
      els.input.setAttribute("aria-controls", "searchSuggestions");
      els.input.setAttribute("aria-expanded", "false");
    }
    els.suggestions = document.getElementById("searchSuggestions");
    currentSuggestions = [];
    activeSuggestion = -1;
    els.hasMenu = !!(els.menu && els.panel && els.logo && els.logo.tagName === "BUTTON");
    updateMenuOrigin();
  }

  /* The catalog is a full-screen overlay, but the logo/search row is NEVER
     moved into it. Moving the row made it inherit the panel's opening
     transform (it jumped down and shrank) and, on mobile, changed its width
     and padding between the two modes. The row now stays in the page at one
     fixed coordinate; the overlay is revealed from that point instead.

     These variables are the centre of the logo button in viewport pixels and
     are used by base.css as the origin of the clip-path reveal. */
  function updateMenuOrigin() {
    if (!els.menu || !els.logo) return;
    const rect = els.logo.getBoundingClientRect();
    els.menu.style.setProperty("--menu-origin-x", `${Math.round(rect.left + rect.width / 2)}px`);
    els.menu.style.setProperty("--menu-origin-y", `${Math.round(rect.top + rect.height / 2)}px`);
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
    if (!els.hasMenu || els.menu.classList.contains("is-open")) return;
    // A second click on the logo during the closing animation must reopen the
    // catalog immediately instead of being swallowed by the `closing` guard.
    if (closing) {
      if (closeTimer) { window.clearTimeout(closeTimer); closeTimer = null; }
      closing = false;
      els.menu.classList.remove("is-closing");
    }
    lastFocus = document.activeElement;
    prevOverflow = document.body.style.overflow;
    els.menu.classList.add("is-open");
    els.menu.setAttribute("aria-hidden", "false");
    els.logo.setAttribute("aria-expanded", "true");
    els.logo.setAttribute("aria-label", t("menuClose"));
    document.body.classList.add("menu-is-open");
    document.body.style.overflow = "hidden";
    // Refresh the reveal origin in case the viewport changed while closed.
    updateMenuOrigin();
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
    // The logo is anchored to the centre of the row and the search field grows
    // to its RIGHT, so only the space from the logo's right edge to the row's
    // right edge is available. Using the whole row width here used to push the
    // pair off-centre and move the logo as the query grew.
    const maxSearch = Math.max(0, rowW / 2 - logoW / 2 - gap - 8);
    els.row.style.setProperty("--search-width", `${Math.round(Math.min(wanted, maxSearch))}px`);
    updateMenuOrigin();
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
    // Synthetic on-page results use a private link target; it must not leak
    // into the searchable text as extra "page match" words.
    const values = item._onPage
      ? [item.title, item.text]
      : [item.title, item.text, item.category, item.path, item.alias];
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

  /* Bounded Levenshtein distance: a typo or a small inflection should not hide
     a word. The bound keeps this cheap even on long note pages. */
  function editDistanceWithin(a, b, max) {
    if (Math.abs(a.length - b.length) > max) return false;
    let previous = new Array(b.length + 1);
    let current = new Array(b.length + 1);
    for (let j = 0; j <= b.length; j++) previous[j] = j;
    for (let i = 1; i <= a.length; i++) {
      current[0] = i;
      let rowMin = current[0];
      for (let j = 1; j <= b.length; j++) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        current[j] = Math.min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + cost);
        if (current[j] < rowMin) rowMin = current[j];
      }
      if (rowMin > max) return false;
      [previous, current] = [current, previous];
    }
    return previous[b.length] <= max;
  }

  function hayWordMatches(hay, word) {
    if (!word) return false;
    if (hay.includes(word)) return true;
    if (word.length < 3) return false;
    const words = hay.split(" ");
    // A shorter word in the text can still be the beginning of the query word
    // ("кот" → "котик"), and vice versa.
    for (const candidate of words) {
      if (candidate.length >= 3 && word.startsWith(candidate)) return true;
    }
    const maxDist = word.length >= 8 ? 2 : word.length >= 4 ? 1 : 0;
    if (!maxDist) return false;
    for (const candidate of words) {
      if (Math.abs(candidate.length - word.length) > maxDist) continue;
      if (editDistanceWithin(word, candidate, maxDist)) return true;
    }
    return false;
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
        // Follow synonyms one more hop (RU → EN → another spelling) instead of
        // stopping at the first equivalent found.
        for (const word of [...variants]) {
          const more = map.get(word);
          if (more) more.forEach((item) => variants.add(item));
        }
        return [...variants].some((word) => hayWordMatches(hay, word));
      });
    });
  }

  function runSearch(data, query) {
    const results = [];
    const seen = new Set();
    for (const candidate of phraseQueries(data, query)) {
      for (const item of searchTokens(data, candidate)) {
        // On-page blocks share a type/path/title (the nearest heading), so
        // without a unique key every match but the first was thrown away.
        const key = item._href || `${item.type || ""}:${item.path || ""}:${item.title || ""}`;
        if (seen.has(key)) continue;
        seen.add(key);
        results.push(item);
      }
      if (results.length) break;
    }
    return results.slice(0, 50);
  }

  /* The index covers catalog entries, but a visitor may also be looking for a
     word they can see on the current screen. Walk the visible page text and
     feed those blocks through the same synonym/phrase matcher. */
  function findPageMatches(query, index) {
    const scope = document.querySelector(".page-content") || document.querySelector("main") || document.body;
    if (!scope || !scope.querySelectorAll) return [];
    const excluded = "script, style, noscript, [hidden], .site-menu, .site-search, .search-results, .home-search-area, #search-status, .player-bar, .player-settings, .player-queue, .menu-open-button";
    const walker = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        if (!node.nodeValue || !node.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
        const parent = node.parentElement;
        if (!parent || parent.closest(excluded)) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      },
    });
    const blocks = [];
    let node;
    while ((node = walker.nextNode())) {
      const raw = String(node.nodeValue).replace(/\s+/g, " ").trim();
      if (raw.length < 2) continue;
      const heading = node.parentElement?.closest("h1, h2, h3, h4, h5, h6");
      const label = heading?.textContent.replace(/\s+/g, " ").trim().slice(0, 60) || t("onPage");
      blocks.push({
        type: "onpage",
        title: label,
        text: raw,
        path: "",
        category: t("onPage"),
        _onPage: true,
        _node: node,
        _href: `#page-match-${blocks.length}`,
      });
    }
    if (!blocks.length) return [];
    const data = {
      items: blocks,
      phrases: index?.phrases || [],
      synonyms: index?.synonyms || [],
      synonymGroups: index?.synonymGroups || [],
    };
    return runSearch(data, query).slice(0, 24);
  }

  /* Mark every found block on the page, not only the first one, so a visitor
     can see all the similar words the search picked up. */
  function highlightPageHits(matches) {
    const nodes = (matches || [])
      .map((item) => {
        const direct = item._node?.parentElement;
        if (direct && document.contains(direct)) return direct;
        // The original text node is replaced by <mark> elements, so fall back
        // to the mark created from it.
        return wordHighlights.find((mark) => mark._sourceNode === item._node)?.parentElement || null;
      })
      .filter((el) => el && document.contains(el));
    nodes.forEach((el) => el.classList.add("zqwy-search-hit"));
    if (blockGlowTimer) window.clearTimeout(blockGlowTimer);
    if (nodes.length) {
      blockGlowTimer = window.setTimeout(() => {
        nodes.forEach((el) => el.classList.remove("zqwy-search-hit"));
        blockGlowTimer = 0;
      }, 3200);
    }
    return nodes;
  }

  /* Same normalisation as normalize(), but keeps a map back to the original
     text offsets so each found word can be wrapped in <mark> precisely. */
  function normalizeWithMap(value) {
    const src = String(value || "");
    let text = "";
    const map = [];
    let pendingSpace = -1;
    for (let i = 0; i < src.length; i++) {
      let ch = src[i].toLowerCase();
      if (ch === "ё") ch = "е";
      if (/[a-zа-я0-9]/.test(ch)) {
        if (pendingSpace >= 0) { text += " "; map.push(pendingSpace); pendingSpace = -1; }
        text += ch;
        map.push(i);
      } else if (pendingSpace < 0) {
        // '_' and '-' act like spaces; runs of separators collapse to one.
        pendingSpace = i;
      }
    }
    return { text, map };
  }

  function wordTokens(text) {
    const tokens = [];
    const re = /[a-zа-я0-9]+/gi;
    let match;
    while ((match = re.exec(text))) {
      tokens.push({ word: match[0], start: match.index, end: match.index + match[0].length });
    }
    return tokens;
  }

  /* All spellings the visitor might accept for the query, including two hops
     through the synonym groups (RU → EN → alternate spelling). */
  function buildSearchVariants(index, query) {
    const data = index || {};
    const map = synonymMap(data.synonyms || data.synonymGroups || []);
    const phrases = new Set();
    const words = new Set();
    const base = normalize(query);
    if (base) {
      phrases.add(base);
      base.split(" ").forEach((word) => words.add(word));
    }
    for (const phrase of phraseQueries(data, query)) {
      const normalized = normalize(phrase);
      if (!normalized) continue;
      phrases.add(normalized);
      normalized.split(" ").forEach((word) => words.add(word));
    }
    for (let hop = 0; hop < 2; hop++) {
      for (const word of [...words]) {
        map.get(word)?.forEach((item) => words.add(item));
        for (const [key, forms] of map) {
          if (key.split(" ").includes(word)) forms.forEach((item) => words.add(item));
        }
      }
    }
    return { phrases: [...phrases].filter(Boolean), words: [...words].filter(Boolean) };
  }

  function textMatchRanges(text, variants) {
    const ranges = [];
    const isWordChar = (ch) => !!ch && /[a-zа-я0-9]/i.test(ch);
    for (const phrase of variants.phrases) {
      if (phrase.length < 2) continue;
      let from = 0;
      while (from <= text.length - phrase.length) {
        const at = text.indexOf(phrase, from);
        if (at < 0) break;
        const before = at > 0 ? text[at - 1] : "";
        const after = text[at + phrase.length] || "";
        if (!isWordChar(before) && !isWordChar(after)) {
          ranges.push({ start: at, end: at + phrase.length, len: phrase.length });
        }
        from = at + Math.max(1, phrase.length);
      }
    }
    for (const token of wordTokens(text)) {
      if (variants.words.some((word) => hayWordMatches(token.word, word))) {
        ranges.push({ start: token.start, end: token.end, len: token.end - token.start });
      }
    }
    // A recognised phrase and its individual words overlap; keep the longest
    // span so the whole phrase is highlighted once.
    ranges.sort((a, b) => b.len - a.len || a.start - b.start);
    const chosen = [];
    for (const range of ranges) {
      if (chosen.some((c) => range.start < c.end && c.start < range.end)) continue;
      chosen.push(range);
    }
    return chosen.sort((a, b) => a.start - b.start);
  }

  function clearWordHighlights() {
    for (const mark of wordHighlights) {
      if (!mark.isConnected || !mark.parentNode) continue;
      const parent = mark.parentNode;
      parent.replaceChild(document.createTextNode(mark.textContent), mark);
      parent.normalize();
    }
    wordHighlights = [];
    activeWordIndex = -1;
    if (blockGlowTimer) { window.clearTimeout(blockGlowTimer); blockGlowTimer = 0; }
    if (activeGlowTimer) { window.clearTimeout(activeGlowTimer); activeGlowTimer = 0; }
    document.querySelectorAll(".zqwy-search-hit").forEach((el) => el.classList.remove("zqwy-search-hit"));
  }

  /* Wrap every matching word on the open page in a persistent <mark>. Unlike
     the block glow these marks stay until the next search, so Enter has a
     stable list of positions to walk through. */
  function markTextMatches(query, index) {
    clearWordHighlights();
    const variants = buildSearchVariants(index, query);
    if (!variants.phrases.length && !variants.words.length) return 0;
    const scope = document.querySelector(".page-content") || document.querySelector("main") || document.body;
    if (!scope?.querySelectorAll) return 0;
    const excluded = "script, style, noscript, [hidden], .site-menu, .site-search, .search-results, .home-search-area, #search-status, .player-bar, .player-settings, .player-queue, .menu-open-button, mark.zqwy-search-word";
    const walker = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        if (!node.nodeValue || !node.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
        const parent = node.parentElement;
        if (!parent || parent.closest(excluded)) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      },
    });
    const nodes = [];
    let node;
    while ((node = walker.nextNode())) nodes.push(node);

    for (const source of nodes) {
      if (wordHighlights.length >= MAX_WORD_HIGHLIGHTS) break;
      if (!source.isConnected || !source.parentNode) continue;
      const original = source.nodeValue;
      const { text, map } = normalizeWithMap(original);
      if (!text) continue;
      const ranges = textMatchRanges(text, variants);
      if (!ranges.length) continue;
      const frag = document.createDocumentFragment();
      let cursor = 0;
      for (const range of ranges) {
        if (wordHighlights.length >= MAX_WORD_HIGHLIGHTS) break;
        const start = map[range.start];
        const end = (map[range.end - 1] ?? (range.end - 1)) + 1;
        if (start == null || end <= start || start < cursor) continue;
        if (start > cursor) frag.appendChild(document.createTextNode(original.slice(cursor, start)));
        const mark = document.createElement("mark");
        mark.className = "zqwy-search-word";
        mark.textContent = original.slice(start, end);
        mark._sourceNode = source;
        frag.appendChild(mark);
        wordHighlights.push(mark);
        cursor = end;
      }
      if (cursor > 0) {
        if (cursor < original.length) frag.appendChild(document.createTextNode(original.slice(cursor)));
        source.parentNode.replaceChild(frag, source);
      }
    }
    return wordHighlights.length;
  }

  function updateSearchStatus() {
    if (!els.status) return;
    if (!lastSearchQuery) { els.status.textContent = ""; return; }
    if (wordHighlights.length && activeWordIndex >= 0) {
      els.status.textContent = t("matchProgress", {
        current: activeWordIndex + 1,
        total: wordHighlights.length,
      });
    } else if (lastResultCount) {
      els.status.textContent = `${t("found", { count: lastResultCount })}${wordHighlights.length ? ` · ${t("enterNext")}` : ""}`;
    } else {
      els.status.textContent = lastIndexError ? t("indexUnavailable") : t("noResults");
    }
  }

  /* Move the active mark (Shift+Enter walks backwards) and keep the counter
     in the search status in sync with the visible position. */
  function activateWordHighlight(index, scroll = true) {
    if (!wordHighlights.length) return false;
    if (activeWordIndex >= 0) wordHighlights[activeWordIndex]?.classList.remove("is-active");
    activeWordIndex = ((index % wordHighlights.length) + wordHighlights.length) % wordHighlights.length;
    const mark = wordHighlights[activeWordIndex];
    mark.classList.add("is-active");
    if (scroll) {
      mark.scrollIntoView({ behavior: "smooth", block: "center" });
      const block = mark.closest("p, li, h1, h2, h3, h4, h5, h6, blockquote, td, th") || mark.parentElement;
      if (block) {
        document.querySelectorAll(".zqwy-search-hit").forEach((el) => el.classList.remove("zqwy-search-hit"));
        block.classList.add("zqwy-search-hit");
        if (activeGlowTimer) window.clearTimeout(activeGlowTimer);
        activeGlowTimer = window.setTimeout(() => {
          block.classList.remove("zqwy-search-hit");
          activeGlowTimer = 0;
        }, 2200);
      }
    }
    updateSearchStatus();
    return true;
  }

  /* ---------- suggestions for the search field ----------
   * Prefix matches come first ("pervye bukvy"); when they run out, similar
   * words (inflections and typos) are offered from the same corpus. Full-text
   * fuzzy matching is also run on submit. */
  function buildSuggestionCorpus(data) {
    const byKey = new Map();
    const add = (value, type) => {
      const label = String(value || "").trim();
      if (!label) return;
      const key = normalize(label);
      if (!key || byKey.has(key)) return;
      byKey.set(key, { label, type: type || "page" });
    };
    const items = Array.isArray(data) ? data : (data && data.items) || [];
    for (const item of items) {
      const type = item.type || "page";
      add(item.title, type);
      add(item.alias, type);
      add(item.category, type);
      if (Array.isArray(item.tags)) item.tags.forEach((tag) => add(tag, type));
      else add(item.tags, type);
      if (Array.isArray(item.keywords)) item.keywords.forEach((word) => add(word, type));
      else add(item.keywords, type);
      if (typeof item.text === "string" && item.text.length <= 60) add(item.text, type);
    }
    const groups = Array.isArray(data) ? [] : [
      ...((data && data.phrases) || []),
      ...((data && data.synonyms) || []),
    ];
    for (const group of groups) {
      const forms = (Array.isArray(group) ? group : (group && group.phrases) || []);
      forms.forEach((form) => add(form, "page"));
    }
    return [...byKey.values()].sort((a, b) =>
      a.label.localeCompare(b.label, "ru", { sensitivity: "base" }));
  }

  function suggestionMatches(data, value) {
    if (!suggestionCache) suggestionCache = buildSuggestionCorpus(data);
    const query = normalize(value);
    if (!query) return [];
    const tokens = query.split(" ").filter(Boolean);
    const last = tokens[tokens.length - 1];
    const head = tokens.slice(0, -1);
    const starts = [];
    const words = [];
    const similar = [];

    for (const entry of suggestionCache) {
      const normalized = normalize(entry.label);
      if (!normalized) continue;
      const parts = normalized.split(" ");
      if (head.length && !head.every((word) => parts.includes(word))) continue;
      let pushed = false;
      if (normalized.startsWith(query)) {
        starts.push(entry);
        pushed = true;
      }
      if (!pushed && parts.some((word) => word.startsWith(last))) words.push(entry);
      if (!pushed && parts.some((word) => hayWordMatches(word, last))) similar.push(entry);
    }
    return [...starts, ...words, ...similar].slice(0, 8);
  }

  function hideSuggestions() {
    if (!els.suggestions) return;
    els.suggestions.hidden = true;
    els.suggestions.replaceChildren();
    els.input?.setAttribute("aria-expanded", "false");
    els.input?.removeAttribute("aria-activedescendant");
    currentSuggestions = [];
    activeSuggestion = -1;
  }

  function setActiveSuggestion(index) {
    if (!els.suggestions || !currentSuggestions.length) return;
    activeSuggestion = Math.max(0, Math.min(index, currentSuggestions.length - 1));
    [...els.suggestions.querySelectorAll("[data-suggestion]")].forEach((node, i) => {
      const active = i === activeSuggestion;
      node.classList.toggle("is-active", active);
      node.setAttribute("aria-selected", String(active));
    });
    els.suggestions.querySelector(`[data-suggestion="${activeSuggestion}"]`)
      ?.scrollIntoView({ block: "nearest" });
    els.input?.setAttribute("aria-activedescendant", `search-suggestion-${activeSuggestion}`);
  }

  function renderSuggestions(matches) {
    if (!els.suggestions || !els.input) return;
    hideSuggestions();
    if (!matches.length) return;
    currentSuggestions = matches;
    const frag = document.createDocumentFragment();
    matches.forEach((entry, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "search-suggestion";
      button.id = `search-suggestion-${index}`;
      button.dataset.suggestion = String(index);
      button.setAttribute("role", "option");
      button.setAttribute("aria-selected", "false");

      const icon = document.createElement("span");
      icon.className = "search-suggestion-icon";
      icon.setAttribute("aria-hidden", "true");
      icon.textContent = TYPE_ICON[entry.type] || "⌕";

      const label = document.createElement("span");
      label.className = "search-suggestion-label";
      label.textContent = entry.label;

      button.append(icon, label);
      frag.appendChild(button);
    });
    els.suggestions.appendChild(frag);
    els.suggestions.hidden = false;
    els.input.setAttribute("aria-expanded", "true");
  }

  async function updateSuggestions() {
    if (!els.input || !els.suggestions) return;
    const value = els.input.value.trim();
    const seq = ++suggestionSeq;
    if (!value) { hideSuggestions(); return; }
    try {
      const index = await loadIndex();
      if (seq !== suggestionSeq) return;
      renderSuggestions(suggestionMatches(index, value));
    } catch {
      if (seq === suggestionSeq) hideSuggestions();
    }
  }

  function chooseSuggestion(index) {
    const entry = currentSuggestions[index];
    if (!entry || !els.input) return;
    if (suggestionBlurTimer) { window.clearTimeout(suggestionBlurTimer); suggestionBlurTimer = 0; }
    els.input.value = entry.label;
    hideSuggestions();
    updateSearchLayout();
    els.form?.requestSubmit?.();
  }

  const TYPE_ICON = {
    link: "🔗",
    track: "♪",
    album: "▣",
    game: "🎮",
    page: "▤",
    onpage: "⌕",
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
      link.setAttribute("href", item._href || String(item.path || "#"));
      if (!item._onPage && /^https?:\/\//i.test(item.path || "")) {
        link.target = "_blank";
        link.rel = "noopener noreferrer";
      }
      if (item._node) {
        link.addEventListener("click", (ev) => {
          ev.preventDefault();
          // The text node was split into marks; jump to the first mark that
          // came from it so the click and Enter use the same positions.
          const markIndex = wordHighlights.findIndex((mark) => mark._sourceNode === item._node);
          if (markIndex >= 0) { activateWordHighlight(markIndex); return; }
          const target = item._node.parentElement;
          if (!target || !document.contains(target)) return;
          highlightPageHits(items);
          target.scrollIntoView({ behavior: "smooth", block: "center" });
        });
      }
      // A page hit needs its text snippet: several hits can share one heading.
      link.textContent = item._onPage
        ? `${item.title} — ${item.text.length > 80 ? `${item.text.slice(0, 80)}…` : item.text}`
        : (item.title || item.path || "Без названия");

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
    const response = await fetch(INDEX_URL, { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    indexCache = await response.json();
    return indexCache;
  }

  async function performSearch(query) {
    hideSuggestions();
    if (!els.results || !els.status) return;
    els.results.replaceChildren();
    if (!query) {
      // An empty submit is a deliberate "show me the catalog" action.
      clearWordHighlights();
      lastSearchQuery = "";
      lastResultCount = 0;
      lastIndexError = false;
      els.status.textContent = "";
      openMenu();
      return;
    }
    if ((readSettings() || {}).rememberQuery) saveSettings({ lastQuery: query }, true);
    els.status.textContent = t("searching", { query });
    let index = null;
    let indexError = false;
    try {
      index = await loadIndex();
    } catch {
      indexError = true;
    }
    pageMatches = findPageMatches(query, index);
    const indexMatches = index ? runSearch(index, query) : [];
    // Page hits come first: they point at text the visitor is looking at right
    // now, while index results remain the broader site-wide fallback.
    const matches = [...pageMatches, ...indexMatches].slice(0, 50);
    lastSearchQuery = query;
    lastResultCount = matches.length;
    lastIndexError = indexError && !matches.length;
    // Persistent word marks are what Enter walks through; the block glow is
    // only a short hint and is applied after the marks are created.
    markTextMatches(query, index);
    renderResults(els.results, matches);
    highlightPageHits(pageMatches);
    updateSearchStatus();
    if (els.hasMenu && els.menu.classList.contains("is-open")) {
      // Keep the caret in the search field: closing the menu focuses the logo
      // by default, which would swallow the next Enter instead of moving to
      // the next highlighted word.
      lastFocus = els.input;
      closeMenu();
    }
    els.input?.focus({ preventScroll: true });
    els.resultsArea?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  /* ---------- settings (site-wide) ---------- */

  function setSavedMessage(message, timeout = 2000) {
    if (!els.saved) return;
    if (savedTimer) { window.clearTimeout(savedTimer); savedTimer = 0; }
    els.saved.textContent = message;
    if (timeout > 0) {
      savedTimer = window.setTimeout(() => {
        if (els.saved) els.saved.textContent = "";
        savedTimer = 0;
      }, timeout);
    }
  }

  function applyTheme(theme, animate = false) {
    let resolved = theme;
    if (theme === "system") resolved = systemQuery && systemQuery.matches ? "light" : "dark";
    const root = document.documentElement;
    if (animate) {
      // The class enables the CSS colour transitions for one switch. It is
      // never added on first paint, so the stored theme appears without motion.
      root.classList.add("zqwy-theme-changing");
      root.setAttribute("data-theme-change-to", resolved);
      // Force a style flush: without it the browser batches the class and the
      // new data-theme into one frame and the transition silently never runs.
      void root.offsetWidth;
      if (themeAnimTimer) window.clearTimeout(themeAnimTimer);
      themeAnimTimer = window.setTimeout(() => {
        root.classList.remove("zqwy-theme-changing");
        root.removeAttribute("data-theme-change-to");
        themeAnimTimer = 0;
      }, 560);
    } else if (!themeAnimTimer) {
      root.classList.remove("zqwy-theme-changing");
      root.removeAttribute("data-theme-change-to");
    }
    root.dataset.theme = resolved === "light" ? "light" : "dark";
    window.dispatchEvent(new CustomEvent("zqwy:themechange", { detail: { theme: resolved } }));
  }

  function previewThemeChoice(theme) {
    if (!["dark", "light", "system"].includes(theme)) return;
    previewTheme = theme;
    applyTheme(theme, true);
    setSavedMessage(t("themePreview"), 0);
  }

  function previewLanguageChoice(next) {
    if (!["ru", "en"].includes(next)) return;
    previewLanguage = next;
    applyLanguage(next, true);
    setSavedMessage(t("languagePreview"), 0);
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
    loadBuildInfo();
    if (!silent) setSavedMessage(t("saved"));
  }

  function loadSettings() {
    const settings = readSettings() || { theme: "dark", rememberQuery: false, language: "ru" };
    const effectiveTheme = previewTheme || settings.theme || "dark";
    const effectiveLanguage = previewLanguage || settings.language || "ru";
    applyTheme(effectiveTheme);
    applyLanguage(effectiveLanguage);
    if (els.settingsForm) {
      const radio = els.settingsForm.querySelector(`input[name="theme"][value="${effectiveTheme}"]`);
      if (radio) radio.checked = true;
      const remember = els.settingsForm.querySelector('input[name="rememberQuery"]');
      if (remember) remember.checked = !!settings.rememberQuery;
      const langRadio = els.settingsForm.querySelector(`input[name="language"][value="${effectiveLanguage}"]`);
      if (langRadio) langRadio.checked = true;
      if (els.input && settings.rememberQuery && settings.lastQuery) els.input.value = settings.lastQuery;
    }
  }

  /* ---------- one delegated listener set for the whole site ---------- */

  // A link inside the catalog navigates with the SPA. Close first, in the
  // capture phase, so the logo/search block is back in the page before
  // transition.js replaces .page-content with the next document.
  document.addEventListener("click", (ev) => {
    const target = ev.target instanceof Element ? ev.target : null;
    if (!target || !els.hasMenu || !els.menu?.classList.contains("is-open")) return;
    if (target.closest("#menuOpenButton") || target.closest("[data-menu-close]")) return;
    if (target.closest("a[href]")) closeMenu();
  }, true);

  document.addEventListener("click", (ev) => {
    const target = ev.target instanceof Element ? ev.target : null;
    if (!target) return;

    const suggestion = target.closest("[data-suggestion]");
    if (suggestion && els.suggestions?.contains(suggestion)) {
      chooseSuggestion(Number(suggestion.dataset.suggestion));
      return;
    }

    if (target.closest("#menuOpenButton") && els.hasMenu) {
      els.menu.classList.contains("is-open") ? closeMenu() : openMenu();
      return;
    }
    if (target.closest("[data-menu-close]")) { closeMenu(); return; }

    if (target.closest("#settings-reset")) {
      localStorage.removeItem(SETTINGS_KEY);
      previewTheme = null;
      previewLanguage = null;
      els.settingsForm?.reset();
      if (els.input) els.input.value = "";
      applyTheme("dark", true);
      applyLanguage("ru", true);
      loadBuildInfo();
      if (els.settingsForm) {
        const langRadio = els.settingsForm.querySelector('input[name="language"][value="ru"]');
        if (langRadio) langRadio.checked = true;
      }
      updateSearchLayout();
      setSavedMessage(t("resetDone"));
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
    if (!target || !els.settingsForm?.contains(target)) return;
    if (target.matches('input[name="theme"]')) previewThemeChoice(target.value);
    if (target.matches('input[name="language"]')) previewLanguageChoice(target.value);
  });

  document.addEventListener("input", (ev) => {
    if (ev.target === els.input) {
      updateSearchLayout();
      updateSuggestions();
    }
  });

  // Keep focus in the field when a suggestion is pressed: the delayed blur
  // below would otherwise close the list before the click is delivered.
  document.addEventListener("mousedown", (ev) => {
    if (ev.target instanceof Element && ev.target.closest(".search-suggestions")) ev.preventDefault();
  });
  document.addEventListener("focusout", (ev) => {
    if (ev.target !== els.input) return;
    if (suggestionBlurTimer) window.clearTimeout(suggestionBlurTimer);
    suggestionBlurTimer = window.setTimeout(() => {
      hideSuggestions();
      suggestionBlurTimer = 0;
    }, 140);
  });

  document.addEventListener("submit", async (ev) => {
    if (ev.target === els.settingsForm) {
      ev.preventDefault();
      saveSettings();
      previewTheme = null;
      previewLanguage = null;
      return;
    }
    if (ev.target !== els.form) return;
    ev.preventDefault();
    const query = (els.input?.value || "").trim();
    if (!query) {
      clearWordHighlights();
      lastSearchQuery = "";
      lastResultCount = 0;
      lastIndexError = false;
    }
    if (els.status && els.results) {
      performSearch(query);
      return;
    }
    // No results area on this page: first look right here. Mark every matching
    // word and jump to the first one instead of leaving the page.
    let localIndex = null;
    try { localIndex = await loadIndex(); } catch { /* page search still works */ }
    const localMatches = findPageMatches(query, localIndex);
    if (localMatches.length) {
      lastSearchQuery = query;
      lastResultCount = localMatches.length;
      lastIndexError = false;
      markTextMatches(query, localIndex);
      activateWordHighlight(0);
      els.input?.blur();
      return;
    }
    // Otherwise hand the query to the home page.
    const target = new URL(els.form?.getAttribute("action") || "../", window.location.href);
    target.hash = "";
    if (query) target.searchParams.set("q", query);
    else target.searchParams.set("catalog", "1");
    if (typeof window.zqwyNavigate === "function") window.zqwyNavigate(target.href);
    else window.location.assign(target.href);
  });

  document.addEventListener("keydown", (ev) => {
    // Navigate the prefix list while the search field has focus.
    if (els.input && ev.target === els.input && els.suggestions && !els.suggestions.hidden) {
      if (ev.key === "ArrowDown") {
        ev.preventDefault();
        setActiveSuggestion(activeSuggestion + 1);
        return;
      }
      if (ev.key === "ArrowUp") {
        ev.preventDefault();
        setActiveSuggestion(activeSuggestion - 1);
        return;
      }
      if (ev.key === "Enter" && currentSuggestions.length) {
        ev.preventDefault();
        chooseSuggestion(activeSuggestion >= 0 ? activeSuggestion : 0);
        return;
      }
      if (ev.key === "Escape") {
        ev.preventDefault();
        hideSuggestions();
        return;
      }
    }

    // Enter on an unchanged query walks through every highlighted word.
    // A changed query falls through to the normal form submit (new search).
    if (ev.key === "Enter" && els.input && ev.target === els.input &&
        lastSearchQuery && normalize(els.input.value) === normalize(lastSearchQuery) &&
        wordHighlights.length) {
      ev.preventDefault();
      activateWordHighlight(activeWordIndex + (ev.shiftKey ? -1 : 1));
      return;
    }

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
    const theme = previewTheme || (readSettings() || {}).theme;
    if (theme === "system") applyTheme("system", true);
  });

  /* ---------- build version shown in the settings panel ---------- */

  function renderBuildInfo(element, info) {
    if (!element || !info) return;
    // The build counter is data, not text: keep the wording translated in the UI
    // instead of baking "сборка/build" into build-info.json.
    const parts = [];
    if (info.version) parts.push(`v${info.version}`);
    if (info.build) parts.push(`${t("buildNumber")} ${info.build}`);
    if (info.commit) parts.push(info.commit);
    const label = parts.join(" · ") || info.label || "";
    element.textContent = label || t("buildUnavailable");
    const when = info.builtAt ? new Date(info.builtAt) : null;
    if (when && !Number.isNaN(when.getTime())) {
      element.title = `${label} · ${when.toLocaleString(language === "en" ? "en-GB" : "ru-RU", {
        dateStyle: "short", timeStyle: "short",
      })}`;
    } else if (info.commit) {
      element.title = `${label} · ${info.commit}`;
    }
  }

  async function loadBuildInfo() {
    const element = document.getElementById("build-version");
    if (!element) return;
    if (buildInfoCache) { renderBuildInfo(element, buildInfoCache); return; }
    try {
      const response = await fetch(BUILD_INFO_URL, { cache: "no-store" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      buildInfoCache = await response.json();
      renderBuildInfo(element, buildInfoCache);
    } catch {
      element.textContent = t("buildUnavailable");
    }
  }

  /* ---------- page lifecycle ---------- */

  function initPage() {
    refresh();
    loadSettings();
    loadBuildInfo();

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
