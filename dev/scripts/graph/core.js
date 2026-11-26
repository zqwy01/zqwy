/* Page controller: data, filters, selection, engine lifecycle. */
import { readPalette } from "./shared.js";

const DEFAULT_ENGINE = "d3";
const FALLBACK_ENGINE = "canvas";
const SITE_SETTINGS_KEY = "zqwy.site.settings.v1";
const KIND_IDS = ["reference", "series", "similar"];

export function install(P) {
  const prefetched = new Set();
  const runtimeDisabled = new Set();

  Object.assign(P, {
    init, destroy, retry, selectEngine, setSelection, applyFilters, stopWalk, syncUrl,
    availableEngines,
  });

  function isGraphPage() {
    const path = window.location.pathname.replace(/\/index\.html$/, "/");
    return /\/wiki\/graph\/?$/.test(path);
  }

  function availableEngines() {
    let disabled = {};
    try {
      const site = JSON.parse(localStorage.getItem(SITE_SETTINGS_KEY) || "null") || {};
      if (site.graphEngines && typeof site.graphEngines === "object") disabled = site.graphEngines;
    } catch { /* broken site settings: keep every engine available */ }
    // Canvas stays available as the permanent fallback even if all others
    // (including the preferred d3 engine) are removed in site settings.
    return P.ENGINES.filter((engine) => engine.id === FALLBACK_ENGINE
      || (disabled[engine.id] !== false && !runtimeDisabled.has(engine.id)));
  }

  function readSiteSettings() {
    try {
      const parsed = JSON.parse(localStorage.getItem(SITE_SETTINGS_KEY) || "null");
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch { return {}; }
  }

  function preferredEngine() {
    return availableEngines().some((engine) => engine.id === DEFAULT_ENGINE)
      ? DEFAULT_ENGINE : FALLBACK_ENGINE;
  }

  // A broken engine must not be retried on every visit. Reuse the existing
  // site-settings flag: the user can re-check the box to give it another try.
  function disableEngine(id, error) {
    if (!id || id === FALLBACK_ENGINE) return;
    runtimeDisabled.add(id);
    const site = readSiteSettings();
    const previous = site.graphEngines && typeof site.graphEngines === "object" ? site.graphEngines : {};
    if (previous[id] === false) return;
    try {
      localStorage.setItem(SITE_SETTINGS_KEY, JSON.stringify({
        ...site, graphEngines: { ...previous, [id]: false },
      }));
    } catch { /* private mode: disable for this session only */ }
    console.warn(`Graph engine "${id}" disabled after a failure:`, error);
    P.state.notice = P.t("engineDisabled", { engine: P.t(`engine.${id}`) });
    P.renderEngines?.();
    P.updateStatus?.();
  }

  function loadSettings() {
    try {
      const saved = JSON.parse(localStorage.getItem(P.SETTINGS_KEY) || "null") || {};
      const available = availableEngines();
      P.settings.engine = available.some((engine) => engine.id === saved.engine)
        ? saved.engine : preferredEngine();
      P.settings.section = typeof saved.section === "string" ? saved.section : "";
      P.settings.paused = Boolean(saved.paused);
      for (const kind of KIND_IDS) {
        P.settings.kinds[kind] = saved.kinds?.[kind] !== false;
      }
    } catch { /* private mode / broken settings: keep defaults */ }
  }
  function saveSettings() {
    try { localStorage.setItem(P.SETTINGS_KEY, JSON.stringify(P.settings)); } catch {}
  }

  function applyUrl() {
    const params = new URLSearchParams(window.location.search);
    const engine = params.get("engine");
    if (engine && availableEngines().some((item) => item.id === engine)) P.settings.engine = engine;
    if (params.has("section")) P.settings.section = params.get("section") || "";
    P.state.pendingFocus = params.get("note") || null;
    const query = params.get("gq") || "";
    P.state.query = query;
    if (P.els.search) P.els.search.value = query;
  }

  // The inline bootstrap paints the picker before ES modules execute. If the
  // visitor picked an engine during that window, honour it now.
  function applyPendingEngine() {
    const pending = window.__zqwyGraphPendingEngine;
    window.__zqwyGraphPendingEngine = null;
    if (!pending) return;
    if (availableEngines().some((engine) => engine.id === pending)) P.settings.engine = pending;
  }

  function setParam(url, key, value) {
    if (value) url.searchParams.set(key, value);
    else url.searchParams.delete(key);
  }
  function syncUrl() {
    try {
      const url = new URL(window.location.href);
      setParam(url, "engine", P.settings.engine === DEFAULT_ENGINE ? "" : P.settings.engine);
      setParam(url, "section", P.settings.section);
      setParam(url, "note", P.state.selected);
      setParam(url, "gq", P.state.query.trim());
      window.history.replaceState(window.history.state, "", url.href);
    } catch {}
  }

  async function fetchData() {
    P.els.status.textContent = P.t("loading");
    P.setLoading?.(P.t("loading"), "", 12);
    // The page <head> starts this request before the module graph is parsed;
    // reusing it removes a second round trip on the first, cold load.
    const early = window.__zqwyGraphDataPromise;
    window.__zqwyGraphDataPromise = null;
    const response = early ? await early : await fetch(P.DATA_URL, { cache: "no-cache" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    if (!Array.isArray(data.nodes) || !Array.isArray(data.links)) throw new Error("bad graph data");
    P.state.graph = data;
    P.state.allNodes = data.nodes;
    P.state.nodeById = new Map(data.nodes.map((node) => [node.id, node]));
    P.els.empty.hidden = data.nodes.length > 0;
  }

  function syncKindInputs() {
    if (!P.els.kinds) return;
    P.els.kinds.querySelectorAll("input[type=checkbox]").forEach((input) => {
      input.checked = P.settings.kinds[input.value] !== false;
    });
  }

  function matchQuery(node, query) {
    if (!query) return true;
    return `${node.title} ${node.section} ${node.categoryLabel} ${node.excerpt || ""}`
      .toLowerCase().includes(query);
  }

  function highlight() {
    P.state.engine?.setHighlight({
      selected: P.state.selected,
      hovered: P.state.hovered,
      walking: P.state.walking,
      matched: P.state.matched,
    });
  }

  function applyFilters() {
    const state = P.state;
    if (!state.graph || !state.engine) return;
    const nodes = state.allNodes.filter((node) =>
      !P.settings.section || node.category === P.settings.section);
    const ids = new Set(nodes.map((node) => node.id));
    const links = state.graph.links.filter((link) =>
      P.settings.kinds[link.kind] !== false && ids.has(link.source) && ids.has(link.target));
    if (state.selected && !ids.has(state.selected)) state.selected = null;

    const query = state.query.trim().toLowerCase();
    state.matched = new Set(query ? nodes.filter((node) => matchQuery(node, query)).map((node) => node.id) : []);
    state.nodes = nodes;
    state.links = links;

    const signature = `${nodes.map((node) => node.id).join(",")}|${links
      .map((link) => `${link.source}>${link.target}:${link.kind}`).join(",")}`;
    if (signature !== state.signature) {
      state.signature = signature;
      state.engine.setData({
        nodes,
        links,
        allNodes: state.allNodes,
        categories: state.graph.categories || [],
      });
    }
    highlight();
    P.renderDetails();
    P.updateStatus();
    P.updateActions();
  }

  // Import one engine module while the JSON is still arriving. Dynamic imports
  // are cached by URL, so selectEngine() below reuses this in-flight module.
  function warmEngine(id) {
    const meta = availableEngines().find((engine) => engine.id === id);
    if (!meta) return Promise.resolve();
    return Promise.resolve()
      .then(() => meta.load())
      .catch((error) => { disableEngine(meta.id, error); });
  }

  // The graph is interactive already: bring in the remaining engine modules
  // one at a time, strictly during idle time. Disabled engines are never touched.
  function prefetchEngines() {
    if (!P.state.owner) return;
    const queue = availableEngines()
      .filter((engine) => engine.id !== P.settings.engine && !prefetched.has(engine.id));
    const loadNext = () => {
      if (!P.state.owner || !queue.length) return;
      const meta = queue.shift();
      prefetched.add(meta.id);
      void warmEngine(meta.id);
      schedule(loadNext);
    };
    const schedule = (callback) => {
      if (window.requestIdleCallback) window.requestIdleCallback(callback, { timeout: 2500 });
      else window.setTimeout(callback, 1400);
    };
    schedule(loadNext);
  }

  async function selectEngine(id) {
    if (!P.state.owner || !availableEngines().some((engine) => engine.id === id)) return false;
    if (P.settings.engine === id && P.state.engine) return true;
    const sequence = ++P.engineSeq;
    stopWalk();
    P.state.engine?.destroy();
    P.state.engine = null;
    P.state.signature = "";
    P.els.host.replaceChildren();
    P.els.status.textContent = P.t("loadingEngine");
    P.setLoading?.(P.t("loadingEngine"), P.t(`engine.${id}`), 52);

    try {
      const meta = P.ENGINES.find((engine) => engine.id === id);
      const module = await meta.load();
      if (sequence !== P.engineSeq || !P.state.owner) return false;
      const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches || false;
      const engine = await module.createEngine({
        host: P.els.host,
        palette: readPalette(),
        categories: P.state.graph?.categories || [],
        reducedMotion,
        callbacks: {
          onSelect: (nodeId) => P.setSelection(nodeId),
          onHover: (nodeId, point) => {
            P.state.hovered = nodeId || null;
            P.showTooltip(nodeId, point);
            highlight();
          },
          onActivate: (nodeId) => P.openNote(nodeId),
          onLoadProgress: (info = {}) => {
            const label = info.file
              ? P.t("loadingScript", { file: info.file })
              : P.t("loadingEngine");
            const fraction = (info.index || 0) / Math.max(1, info.total || 1);
            P.setLoading?.(label, P.t(`engine.${id}`), 52 + Math.round(38 * fraction));
          },
        },
        vendorBase: P.VENDOR_BASE,
      });
      if (sequence !== P.engineSeq || !P.state.owner) { engine.destroy?.(); return false; }
      P.state.engine = engine;
      P.settings.engine = id;
      engine.start?.();
      engine.setPaused?.(P.settings.paused);
      applyFilters();
      if (P.state.pendingFocus) {
        engine.focus?.(P.state.pendingFocus);
        P.state.pendingFocus = null;
      }
      window.setTimeout(() => {
        if (sequence === P.engineSeq && !P.state.selected && !P.state.walking) engine.fit?.();
      }, reducedMotion ? 0 : 900);
      P.renderEngines();
      P.updateStatus();
      P.hideLoading?.();
      prefetched.add(id);
      prefetchEngines();
      saveSettings();
      syncUrl();
      return true;
    } catch (error) {
      console.error("Graph engine error:", error);
      disableEngine(id, error);
      // Try d3 first, then the canvas fallback; never retry the failed engine.
      const fallback = [DEFAULT_ENGINE, FALLBACK_ENGINE].find((candidate) =>
        candidate !== id && availableEngines().some((engine) => engine.id === candidate));
      if (fallback && P.state.owner) {
        P.settings.engine = fallback;
        return selectEngine(fallback);
      }
      P.els.status.textContent = P.t("error");
      P.showLoadingError?.(error.message);
      return false;
    }
  }

  function setSelection(id, options = {}) {
    const nodeId = id && P.state.nodeById.has(id) ? id : null;
    if (!options.keepWalk) stopWalk();
    P.state.selected = nodeId;
    if (nodeId && options.focus) P.state.engine?.focus?.(nodeId);
    highlight();
    P.renderDetails();
    P.updateStatus();
    P.showTooltip(null, null);
    syncUrl();
  }

  P.openNote = (id) => {
    const node = P.state.nodeById.get(id);
    if (!node) return;
    const link = document.createElement("a");
    link.href = new URL(node.path, P.SITE_ROOT).href;
    document.body.append(link);
    link.click();
    link.remove();
  };

  function stopWalk() {
    if (P.timers.walk) { window.clearInterval(P.timers.walk); P.timers.walk = 0; }
    if (P.state.walking) {
      P.state.walking = null;
      highlight();
    }
    P.updateActions();
    P.updateStatus();
  }

  function walkStep() {
    const state = P.state;
    if (!state.nodes.length) { stopWalk(); return; }
    const current = state.walking;
    const neighbours = state.links
      .filter((link) => link.source === current || link.target === current)
      .map((link) => (link.source === current ? link.target : link.source));
    const next = neighbours.length
      ? neighbours[Math.floor(Math.random() * neighbours.length)]
      : state.nodes[Math.floor(Math.random() * state.nodes.length)].id;
    state.walking = next;
    state.selected = next;
    state.engine?.focus?.(next);
    highlight();
    P.renderDetails();
    P.updateStatus();
    P.updateActions();
    syncUrl();
  }

  function toggleWalk() {
    if (P.timers.walk) { stopWalk(); return; }
    if (!P.state.nodes.length) return;
    const start = P.state.selected && P.state.nodeById.has(P.state.selected)
      ? P.state.selected
      : P.state.nodes[Math.floor(Math.random() * P.state.nodes.length)].id;
    P.state.walking = start;
    P.state.selected = start;
    P.state.engine?.focus?.(start);
    highlight();
    P.renderDetails();
    P.updateStatus();
    P.updateActions();
    P.timers.walk = window.setInterval(walkStep, 1900);
  }

  function reset() {
    stopWalk();
    P.settings.section = "";
    P.settings.paused = false;
    for (const kind of KIND_IDS) P.settings.kinds[kind] = true;
    P.state.query = "";
    P.state.selected = null;
    P.state.hovered = null;
    if (P.els.search) P.els.search.value = "";
    P.state.engine?.setPaused?.(false);
    P.state.engine?.reheat?.();
    renderSectionsSafe();
    syncKindInputs();
    applyFilters();
    P.showTooltip(null, null);
    P.state.engine?.fit?.();
    saveSettings();
    syncUrl();
  }
  function renderSectionsSafe() { P.renderSections?.(); }

  function retry() {
    destroy();
    P.state.graph = null;
    P.state.allNodes = [];
    P.state.nodeById = new Map();
    P.state.nodes = [];
    P.state.links = [];
    P.state.matched = new Set();
    P.state.signature = "";
    P.state.query = "";
    P.state.selected = null;
    P.state.hovered = null;
    if (P.els.search) P.els.search.value = "";
    if (P.els.empty) P.els.empty.hidden = true;
    P.init();
  }

  function toggleFullscreen() {
    const stage = P.els.stage;
    if (!stage?.requestFullscreen || !document.exitFullscreen) {
      P.els.status.textContent = P.t("fullscreenUnsupported");
      return;
    }
    if (document.fullscreenElement === stage) {
      void document.exitFullscreen();
      return;
    }
    // Only the scene goes fullscreen; the rest of the page stays as it was.
    void stage.requestFullscreen().catch(() => {
      P.els.status.textContent = P.t("fullscreenUnsupported");
    });
  }

  function bindPageEvents() {
    if (!P.els.actions || P.els.actions.dataset.bound === "1") return;
    P.els.actions.dataset.bound = "1";

    P.els.actions.addEventListener("click", (event) => {
      const button = event.target.closest("[data-action]");
      if (!button) return;
      const action = button.dataset.action;
      if (action === "fit") P.state.engine?.fit?.();
      else if (action === "motion") {
        P.settings.paused = !P.settings.paused;
        P.state.engine?.setPaused?.(P.settings.paused);
        P.updateActions();
        saveSettings();
      } else if (action === "walk") toggleWalk();
      else if (action === "reset") reset();
      else if (action === "fullscreen") toggleFullscreen();
    });

    P.els.kinds?.addEventListener("change", (event) => {
      const input = event.target.closest("input[type=checkbox]");
      if (!input) return;
      P.settings.kinds[input.value] = input.checked;
      applyFilters();
      saveSettings();
    });
    P.els.section?.addEventListener("change", (event) => {
      P.settings.section = event.target.value || "";
      applyFilters();
      P.state.engine?.fit?.();
      saveSettings();
      syncUrl();
    });
    P.els.search?.addEventListener("input", (event) => {
      if (P.timers.search) window.clearTimeout(P.timers.search);
      const value = event.target.value;
      P.timers.search = window.setTimeout(() => {
        P.state.query = value;
        applyFilters();
        syncUrl();
      }, 140);
    });
    P.els.detailsClose?.addEventListener("click", () => P.setSelection(null));
    P.els.stageExit?.addEventListener("click", () => toggleFullscreen());
    P.els.loadingRetry?.addEventListener("click", () => P.retry?.());
  }

  function bindGlobalEvents() {
    if (P.listenersBound) return;
    P.listenersBound = true;

    document.addEventListener("keydown", (event) => {
      if (!P.state.owner) return;
      const target = event.target;
      const typing = target instanceof Element
        && (target.matches("input, textarea, select") || target.isContentEditable);
      if (event.key === "/" && !typing) {
        event.preventDefault();
        P.els.search?.focus();
        return;
      }
      if (event.key === "Escape" && !typing) {
        // Let the browser handle fullscreen exit on the first Escape press.
        if (!document.fullscreenElement) P.setSelection(null);
        return;
      }
      if (typing || event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.key === " ") {
        const button = P.els.actions?.querySelector('[data-action="motion"]');
        button?.click();
        event.preventDefault();
      } else if (event.key.toLowerCase() === "f") {
        P.state.engine?.fit?.();
      }
    });

    window.addEventListener("zqwy:pagechange", (event) => {
      const path = String(event.detail?.path || window.location.pathname);
      if (/\/wiki\/graph\/?$/.test(path.replace(/\/index\.html$/, "/"))) P.init();
      else P.destroy();
    });

    window.addEventListener("zqwy:languagechange", () => {
      if (!P.state.owner) return;
      P.renderEngines();
      P.renderSections();
      P.renderDetails();
      P.updateActions();
      P.updateStatus();
    });

    document.addEventListener("fullscreenchange", () => {
      if (!P.state.owner) return;
      P.updateActions();
      if (document.fullscreenElement === P.els.stage) P.state.engine?.fit?.();
    });

    P.themeObserver = new MutationObserver(() => {
      if (P.state.owner && P.state.engine) P.state.engine.refreshTheme?.(readPalette());
    });
    P.themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  }
  P.bindGlobalEvents = bindGlobalEvents;

  async function init() {
    if (!isGraphPage() || !P.bindGraphElements()) return;
    P.decorateActions?.();
    if (P.state.owner || P.state.starting) return;
    P.state.starting = true;
    P.state.owner = true;
    bindGlobalEvents();
    loadSettings();
    applyUrl();
    applyPendingEngine();
    // The dropdown must exist before any network or module work: with a cold
    // cache the data request used to delay the engine choice until reload.
    P.renderEngines?.();
    if (P.els.empty) P.els.empty.hidden = true;
    // Bind controls before loading: the retry button must work even when the
    // very first data request fails.
    bindPageEvents();
    try {
      // Data and exactly one engine module travel in parallel; neither waits
      // for the other. Other engines are prefetched later, during idle time.
      const jobs = [];
      if (!P.state.graph) jobs.push(fetchData());
      jobs.push(warmEngine(P.settings.engine));
      await Promise.all(jobs);
      // A preload may have disabled the selected engine while data arrived.
      if (!availableEngines().some((engine) => engine.id === P.settings.engine)) {
        P.settings.engine = preferredEngine();
      }
      P.setLoading?.(P.t("preparing"), P.t(`engine.${P.settings.engine}`), 46);
      P.renderEngines();
      P.renderSections();
      syncKindInputs();
      const ready = await selectEngine(P.settings.engine);
      if (!ready) throw new Error("engine not ready");
      P.hideLoading?.();
    } catch (error) {
      console.error("Graph data error:", error);
      P.els.status.textContent = P.t("error");
      if (P.els.empty) P.els.empty.hidden = false;
      P.showLoadingError?.(error.message);
    } finally {
      P.state.starting = false;
    }
  }

  function destroy() {
    if (!P.state.owner) return;
    stopWalk();
    if (P.timers.search) { window.clearTimeout(P.timers.search); P.timers.search = 0; }
    P.state.engine?.destroy?.();
    if (document.fullscreenElement === P.els.stage) void document.exitFullscreen();
    P.state.engine = null;
    P.state.signature = "";
    P.state.owner = false;
    P.engineSeq += 1;
    P.showTooltip(null, null);
  }
}
