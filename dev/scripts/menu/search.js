/* menu/search.js — модуль скрипта menu.js. */
export function install(P) {
  Object.assign(P, { normalize, synonymMap, haystack, phraseQueries, editDistanceWithin, hayWordMatches, searchTokens, runSearch, findPageMatches, highlightPageHits, normalizeWithMap, wordTokens, buildSearchVariants, textMatchRanges, clearWordHighlights, markTextMatches, updateSearchStatus, activateWordHighlight, buildSuggestionCorpus, suggestionMatches, hideSuggestions, setActiveSuggestion, renderSuggestions, updateSuggestions, chooseSuggestion, renderResults, loadIndex, performSearch });


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
      const forms = group.map(P.normalize).filter(Boolean);
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
    return P.normalize(values.join(" "));
  }

  /* Multi-word aliases from the index let a whole phrase be found even when
     the visitor types it inside a longer sentence. The normal token search
     runs first; only if it finds nothing do we retry with the recognised
     phrase forms, so existing results keep their order. */
  function phraseQueries(data, query) {
    const queries = [query];
    const normalized = P.normalize(query);
    const seen = new Set([normalized]);
    const groups = Array.isArray(data) ? [] : (data && data.phrases) || [];
    for (const group of groups) {
      const forms = (Array.isArray(group) ? group : (group && group.phrases) || [])
        .map(P.normalize)
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
      if (P.editDistanceWithin(word, candidate, maxDist)) return true;
    }
    return false;
  }

  function searchTokens(data, query) {
    const items = Array.isArray(data) ? data : (data && data.items) || [];
    const groups = Array.isArray(data) ? [] : (data && data.synonyms) || (data && data.synonymGroups) || [];
    const map = P.synonymMap(groups);
    const tokens = P.normalize(query).split(" ").filter(Boolean);
    if (!tokens.length) return [];

    return items.filter((item) => {
      const hay = P.haystack(item);
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
        return [...variants].some((word) => P.hayWordMatches(hay, word));
      });
    });
  }

  function runSearch(data, query) {
    const results = [];
    const seen = new Set();
    for (const candidate of P.phraseQueries(data, query)) {
      for (const item of P.searchTokens(data, candidate)) {
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
    const excluded = "script, style, noscript, [hidden], .site-menu, .site-search, .search-results, .home-search-area, #search-status, .player-bar, .player-settings, .player-queue, .menu-open-button, .graph-host";
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
      const label = heading?.textContent.replace(/\s+/g, " ").trim().slice(0, 60) || P.t("onPage");
      blocks.push({
        type: "onpage",
        title: label,
        text: raw,
        path: "",
        category: P.t("onPage"),
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
    return P.runSearch(data, query).slice(0, 24);
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
        return P.wordHighlights.find((mark) => mark._sourceNode === item._node)?.parentElement || null;
      })
      .filter((el) => el && document.contains(el));
    nodes.forEach((el) => el.classList.add("zqwy-search-hit"));
    if (P.blockGlowTimer) window.clearTimeout(P.blockGlowTimer);
    if (nodes.length) {
      P.blockGlowTimer = window.setTimeout(() => {
        nodes.forEach((el) => el.classList.remove("zqwy-search-hit"));
        P.blockGlowTimer = 0;
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
    const map = P.synonymMap(data.synonyms || data.synonymGroups || []);
    const phrases = new Set();
    const words = new Set();
    const base = P.normalize(query);
    if (base) {
      phrases.add(base);
      base.split(" ").forEach((word) => words.add(word));
    }
    for (const phrase of P.phraseQueries(data, query)) {
      const normalized = P.normalize(phrase);
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
    for (const token of P.wordTokens(text)) {
      if (variants.words.some((word) => P.hayWordMatches(token.word, word))) {
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
    for (const mark of P.wordHighlights) {
      if (!mark.isConnected || !mark.parentNode) continue;
      const parent = mark.parentNode;
      parent.replaceChild(document.createTextNode(mark.textContent), mark);
      parent.normalize();
    }
    P.wordHighlights = [];
    P.activeWordIndex = -1;
    if (P.blockGlowTimer) { window.clearTimeout(P.blockGlowTimer); P.blockGlowTimer = 0; }
    if (P.activeGlowTimer) { window.clearTimeout(P.activeGlowTimer); P.activeGlowTimer = 0; }
    document.querySelectorAll(".zqwy-search-hit").forEach((el) => el.classList.remove("zqwy-search-hit"));
  }

  /* Wrap every matching word on the open page in a persistent <mark>. Unlike
     the block glow these marks stay until the next search, so Enter has a
     stable list of positions to walk through. */
  function markTextMatches(query, index) {
    P.clearWordHighlights();
    const variants = P.buildSearchVariants(index, query);
    if (!variants.phrases.length && !variants.words.length) return 0;
    const scope = document.querySelector(".page-content") || document.querySelector("main") || document.body;
    if (!scope?.querySelectorAll) return 0;
    const excluded = "script, style, noscript, [hidden], .site-menu, .site-search, .search-results, .home-search-area, #search-status, .player-bar, .player-settings, .player-queue, .menu-open-button, .graph-host, mark.zqwy-search-word";
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
      if (P.wordHighlights.length >= P.MAX_WORD_HIGHLIGHTS) break;
      if (!source.isConnected || !source.parentNode) continue;
      const original = source.nodeValue;
      const { text, map } = P.normalizeWithMap(original);
      if (!text) continue;
      const ranges = P.textMatchRanges(text, variants);
      if (!ranges.length) continue;
      const frag = document.createDocumentFragment();
      let cursor = 0;
      for (const range of ranges) {
        if (P.wordHighlights.length >= P.MAX_WORD_HIGHLIGHTS) break;
        const start = map[range.start];
        const end = (map[range.end - 1] ?? (range.end - 1)) + 1;
        if (start == null || end <= start || start < cursor) continue;
        if (start > cursor) frag.appendChild(document.createTextNode(original.slice(cursor, start)));
        const mark = document.createElement("mark");
        mark.className = "zqwy-search-word";
        mark.textContent = original.slice(start, end);
        mark._sourceNode = source;
        frag.appendChild(mark);
        P.wordHighlights.push(mark);
        cursor = end;
      }
      if (cursor > 0) {
        if (cursor < original.length) frag.appendChild(document.createTextNode(original.slice(cursor)));
        source.parentNode.replaceChild(frag, source);
      }
    }
    return P.wordHighlights.length;
  }

  function updateSearchStatus() {
    if (!P.els.status) return;
    if (!P.lastSearchQuery) { P.els.status.textContent = ""; return; }
    if (P.wordHighlights.length && P.activeWordIndex >= 0) {
      P.els.status.textContent = P.t("matchProgress", {
        current: P.activeWordIndex + 1,
        total: P.wordHighlights.length,
      });
    } else if (P.lastResultCount) {
      P.els.status.textContent = `${P.t("found", { count: P.lastResultCount })}${P.wordHighlights.length ? ` · ${P.t("enterNext")}` : ""}`;
    } else {
      P.els.status.textContent = P.lastIndexError ? P.t("indexUnavailable") : P.t("noResults");
    }
  }

  /* Move the active mark (Shift+Enter walks backwards) and keep the counter
     in the search status in sync with the visible position. */
  function activateWordHighlight(index, scroll = true) {
    if (!P.wordHighlights.length) return false;
    if (P.activeWordIndex >= 0) P.wordHighlights[P.activeWordIndex]?.classList.remove("is-active");
    P.activeWordIndex = ((index % P.wordHighlights.length) + P.wordHighlights.length) % P.wordHighlights.length;
    const mark = P.wordHighlights[P.activeWordIndex];
    mark.classList.add("is-active");
    if (scroll) {
      mark.scrollIntoView({ behavior: "smooth", block: "center" });
      const block = mark.closest("p, li, h1, h2, h3, h4, h5, h6, blockquote, td, th") || mark.parentElement;
      if (block) {
        document.querySelectorAll(".zqwy-search-hit").forEach((el) => el.classList.remove("zqwy-search-hit"));
        block.classList.add("zqwy-search-hit");
        if (P.activeGlowTimer) window.clearTimeout(P.activeGlowTimer);
        P.activeGlowTimer = window.setTimeout(() => {
          block.classList.remove("zqwy-search-hit");
          P.activeGlowTimer = 0;
        }, 2200);
      }
    }
    P.updateSearchStatus();
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
      const key = P.normalize(label);
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
    if (!P.suggestionCache) P.suggestionCache = P.buildSuggestionCorpus(data);
    const query = P.normalize(value);
    if (!query) return [];
    const tokens = query.split(" ").filter(Boolean);
    const last = tokens[tokens.length - 1];
    const head = tokens.slice(0, -1);
    const starts = [];
    const words = [];
    const similar = [];

    for (const entry of P.suggestionCache) {
      const normalized = P.normalize(entry.label);
      if (!normalized) continue;
      const parts = normalized.split(" ");
      if (head.length && !head.every((word) => parts.includes(word))) continue;
      let pushed = false;
      if (normalized.startsWith(query)) {
        starts.push(entry);
        pushed = true;
      }
      if (!pushed && parts.some((word) => word.startsWith(last))) words.push(entry);
      if (!pushed && parts.some((word) => P.hayWordMatches(word, last))) similar.push(entry);
    }
    return [...starts, ...words, ...similar].slice(0, 8);
  }

  function hideSuggestions() {
    if (!P.els.suggestions) return;
    P.els.suggestions.hidden = true;
    P.els.suggestions.replaceChildren();
    P.els.input?.setAttribute("aria-expanded", "false");
    P.els.input?.removeAttribute("aria-activedescendant");
    P.currentSuggestions = [];
    P.activeSuggestion = -1;
  }

  function setActiveSuggestion(index) {
    if (!P.els.suggestions || !P.currentSuggestions.length) return;
    P.activeSuggestion = Math.max(0, Math.min(index, P.currentSuggestions.length - 1));
    [...P.els.suggestions.querySelectorAll("[data-suggestion]")].forEach((node, i) => {
      const active = i === P.activeSuggestion;
      node.classList.toggle("is-active", active);
      node.setAttribute("aria-selected", String(active));
    });
    P.els.suggestions.querySelector(`[data-suggestion="${P.activeSuggestion}"]`)
      ?.scrollIntoView({ block: "nearest" });
    P.els.input?.setAttribute("aria-activedescendant", `search-suggestion-${P.activeSuggestion}`);
  }

  function renderSuggestions(matches) {
    if (!P.els.suggestions || !P.els.input) return;
    P.hideSuggestions();
    if (!matches.length) return;
    P.currentSuggestions = matches;
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
      icon.textContent = P.TYPE_ICON[entry.type] || "⌕";

      const label = document.createElement("span");
      label.className = "search-suggestion-label";
      label.textContent = entry.label;

      button.append(icon, label);
      frag.appendChild(button);
    });
    P.els.suggestions.appendChild(frag);
    P.els.suggestions.hidden = false;
    P.els.input.setAttribute("aria-expanded", "true");
  }

  async function updateSuggestions() {
    if (!P.els.input || !P.els.suggestions) return;
    const value = P.els.input.value.trim();
    const seq = ++P.suggestionSeq;
    if (!value) { P.hideSuggestions(); return; }
    try {
      const index = await P.loadIndex();
      if (seq !== P.suggestionSeq) return;
      P.renderSuggestions(P.suggestionMatches(index, value));
    } catch {
      if (seq === P.suggestionSeq) P.hideSuggestions();
    }
  }

  function chooseSuggestion(index) {
    const entry = P.currentSuggestions[index];
    if (!entry || !P.els.input) return;
    if (P.suggestionBlurTimer) { window.clearTimeout(P.suggestionBlurTimer); P.suggestionBlurTimer = 0; }
    P.els.input.value = entry.label;
    P.hideSuggestions();
    P.updateSearchLayout();
    P.els.form?.requestSubmit?.();
  }

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
          const markIndex = P.wordHighlights.findIndex((mark) => mark._sourceNode === item._node);
          if (markIndex >= 0) { P.activateWordHighlight(markIndex); return; }
          const target = item._node.parentElement;
          if (!target || !document.contains(target)) return;
          P.highlightPageHits(items);
          target.scrollIntoView({ behavior: "smooth", block: "center" });
        });
      }
      // A page hit needs its text snippet: several hits can share one heading.
      link.textContent = item._onPage
        ? `${item.title} — ${item.text.length > 80 ? `${item.text.slice(0, 80)}…` : item.text}`
        : (item.title || item.path || P.t("untitled"));

      const icon = document.createElement("span");
      icon.className = "search-result-icon";
      icon.setAttribute("aria-hidden", "true");
      icon.textContent = P.TYPE_ICON[item.type] || "▤";

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

  function loadIndex() {
    if (P.indexCache) return Promise.resolve(P.indexCache);
    // Typing must not start a new 350 KB download for every keystroke, and a
    // single stalled request must not keep "Searching…" on screen forever.
    if (!P.indexPromise) {
      const controller = new AbortController();
      const timer = window.setTimeout(() => controller.abort(), 12000);
      P.indexPromise = fetch(P.INDEX_URL, { cache: "force-cache", signal: controller.signal })
        .then(async (response) => {
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          P.indexCache = await response.json();
          return P.indexCache;
        })
        .finally(() => {
          window.clearTimeout(timer);
          P.indexPromise = null;
        });
    }
    return P.indexPromise;
  }

  async function performSearch(query) {
    P.hideSuggestions();
    if (!P.els.results || !P.els.status) return;
    P.els.results.replaceChildren();
    if (!query) {
      // An empty submit is a deliberate "show me the catalog" action.
      P.clearWordHighlights();
      P.lastSearchQuery = "";
      P.lastResultCount = 0;
      P.lastIndexError = false;
      P.els.status.textContent = "";
      P.openMenu();
      return;
    }
    if ((P.readSettings() || {}).rememberQuery) P.saveSettings({ lastQuery: query }, true);
    P.els.status.textContent = P.t("searching", { query });
    let index = null;
    let indexError = false;
    try {
      index = await P.loadIndex();
    } catch {
      indexError = true;
    }
    P.pageMatches = P.findPageMatches(query, index);
    const indexMatches = index ? P.runSearch(index, query) : [];
    // Page hits come first: they point at text the visitor is looking at right
    // now, while index results remain the broader site-wide fallback.
    const matches = [...P.pageMatches, ...indexMatches].slice(0, 50);
    P.lastSearchQuery = query;
    P.lastResultCount = matches.length;
    P.lastIndexError = indexError && !matches.length;
    // Persistent word marks are what Enter walks through; the block glow is
    // only a short hint and is applied after the marks are created.
    P.markTextMatches(query, index);
    P.renderResults(P.els.results, matches);
    P.highlightPageHits(P.pageMatches);
    P.updateSearchStatus();
    if (P.els.hasMenu && P.els.menu.classList.contains("is-open")) {
      // Keep the caret in the search field: closing the menu focuses the logo
      // by default, which would swallow the next Enter instead of moving to
      // the next highlighted word.
      P.lastFocus = P.els.input;
      P.closeMenu();
    }
    P.els.input?.focus({ preventScroll: true });
    P.els.resultsArea?.scrollIntoView({ behavior: "smooth", block: "start" });
  }}
