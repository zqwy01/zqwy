/* Shared state for the notes graph. Mirrors the player's "engines lab":
 * the page owns filters and selection, engines only draw and report hits. */
export const P = {};

export function initContext(P) {
  P.SETTINGS_KEY = "zqwy.note-graph.settings.v1";
  P.SITE_ROOT = new URL("../../", import.meta.url).href;
  P.DATA_URL = new URL("../../data/note-graph.json", import.meta.url).href;
  P.VENDOR_BASE = new URL("../../vendor/", import.meta.url).href;

  P.ENGINES = [
    { id: "canvas", mark: "◉", load: () => import("./engines/canvas-force.js") },
    { id: "d3", mark: "⌁", load: () => import("./engines/d3-force.js") },
    { id: "cytoscape", mark: "◈", load: () => import("./engines/cytoscape.js") },
    { id: "orbit", mark: "✧", load: () => import("./engines/orbit.js") },
    { id: "sigma", mark: "⬡", load: () => import("./engines/sigma.js") },
    { id: "vis", mark: "◇", load: () => import("./engines/vis.js") },
    { id: "joint", mark: "▣", load: () => import("./engines/jointjs.js") },
    { id: "force-graph", mark: "◍", load: () => import("./engines/force-graph.js") },
    { id: "springy", mark: "∿", load: () => import("./engines/springy.js") },
    { id: "force3d", mark: "✦", load: () => import("./engines/3d-force-graph.js") },
  ];

  // Small inline SVG glyphs: [tag, attributes]. No external icon font or CDN.
  P.ENGINE_ICONS = {
    canvas: [
      ["path", { d: "M6.5 7.5 9.7 10.4M17.5 7.8 14.5 10.6M8 16.9l2.3-2.2M16 17.2l-2.2-2.4" }],
      ["circle", { cx: 12, cy: 12, r: 3 }],
      ["circle", { cx: 5, cy: 6, r: 2.2 }],
      ["circle", { cx: 19, cy: 6.5, r: 2.2 }],
      ["circle", { cx: 6, cy: 19, r: 2.2 }],
      ["circle", { cx: 18.5, cy: 19, r: 2.2 }],
    ],
    d3: [
      ["path", { d: "M12 7.5v3.2M10.2 14.1 6.5 16.2M13.8 14.1l3.7 2.1" }],
      ["circle", { cx: 12, cy: 5, r: 2.6 }],
      ["circle", { cx: 5, cy: 18, r: 2.6 }],
      ["circle", { cx: 19, cy: 18, r: 2.6 }],
      ["circle", { cx: 12, cy: 13, r: 2.2 }],
    ],
    cytoscape: [
      ["path", { d: "M12 2.8 20 7.4v9.2L12 21.2 4 16.6V7.4z" }],
      ["path", { d: "M12 2.8v6.9M20 7.4l-5.4 2.8M20 16.6l-5.4-2.9M12 21.2v-6.8M4 16.6l5.4-2.9M4 7.4l5.4 2.8" }],
      ["circle", { cx: 12, cy: 12, r: 2.6 }],
    ],
    orbit: [
      ["ellipse", { cx: 12, cy: 12, rx: 9, ry: 4.4, transform: "rotate(-28 12 12)" }],
      ["ellipse", { cx: 12, cy: 12, rx: 9, ry: 4.4, transform: "rotate(62 12 12)" }],
      ["circle", { cx: 12, cy: 12, r: 2.1 }],
      ["circle", { cx: 4.1, cy: 15.5, r: 1.7 }],
      ["circle", { cx: 19.4, cy: 8.2, r: 1.7 }],
    ],
    sigma: [
      ["path", { d: "M6 3.5h12L10.5 12 18 20.5H6l7.5-8.5z" }],
      ["circle", { cx: 6, cy: 20.5, r: 1.6, fill: "currentColor", stroke: "none" }],
    ],
    vis: [
      ["circle", { cx: 5, cy: 6, r: 2.1 }],
      ["circle", { cx: 19, cy: 7, r: 2.1 }],
      ["circle", { cx: 8, cy: 19, r: 2.1 }],
      ["circle", { cx: 18, cy: 17.5, r: 2.1 }],
      ["path", { d: "M6.8 6.7 17.2 6.9M6.1 7.7 7.6 17.2M10 18.4l6.2-1M17.1 9v6.6" }],
    ],
    joint: [
      ["rect", { x: 3.5, y: 3.5, width: 7, height: 7, rx: 1.2 }],
      ["rect", { x: 13.5, y: 13.5, width: 7, height: 7, rx: 1.2 }],
      ["path", { d: "M10.5 7h4a2 2 0 0 1 2 2v4.5" }],
      ["circle", { cx: 7, cy: 7, r: 1.4, fill: "currentColor", stroke: "none" }],
      ["circle", { cx: 17, cy: 17, r: 1.4, fill: "currentColor", stroke: "none" }],
    ],
    "force-graph": [
      ["circle", { cx: 12, cy: 12, r: 2.8 }],
      ["circle", { cx: 5, cy: 5.5, r: 2 }],
      ["circle", { cx: 19.5, cy: 6.5, r: 2 }],
      ["circle", { cx: 6.5, cy: 19.5, r: 2 }],
      ["circle", { cx: 18.5, cy: 18.5, r: 2 }],
      ["path", { d: "M6.6 6.9 10 10M14 10l3.7-2.4M10 14l-2.4 3.7M14 14l2.8 2.8" }],
    ],
    springy: [
      ["path", { d: "M3 13c2.2-6 4.4 6 6.6 0s4.4 6 6.6 0 3.4 2.6 4.8 0" }],
      ["circle", { cx: 3, cy: 13, r: 1.4, fill: "currentColor", stroke: "none" }],
      ["circle", { cx: 21, cy: 13, r: 1.4, fill: "currentColor", stroke: "none" }],
    ],
    force3d: [
      ["circle", { cx: 12, cy: 12, r: 3 }],
      ["ellipse", { cx: 12, cy: 12, rx: 9.5, ry: 4.2, transform: "rotate(-24 12 12)" }],
      ["ellipse", { cx: 12, cy: 12, rx: 9.5, ry: 4.2, transform: "rotate(62 12 12)" }],
      ["circle", { cx: 4.3, cy: 15.6, r: 1.5, fill: "currentColor", stroke: "none" }],
      ["circle", { cx: 19.2, cy: 7.8, r: 1.5, fill: "currentColor", stroke: "none" }],
    ],
  };

  // Icons for the action buttons. The motion/fullscreen icons are swapped by
  // updateActions() when their state changes.
  P.ACTION_ICONS = {
    fit: [["path", { d: "M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" }]],
    pause: [["path", { d: "M9 5v14M15 5v14" }]],
    motion: [["path", { d: "M8 5l11 7-11 7z", "fill": "currentColor", "stroke": "none" }]],
    walk: [
      ["circle", { cx: 13, cy: 4.2, r: 1.8 }],
      ["path", { d: "m9.5 21 2.1-5.2-2.3-3.1-2.4 2.1M14.2 8.2l-3.1 4.6 3.9 3 2 5.2M11.1 10l3.1-2.4 2.4 1.2" }],
    ],
    stopWalk: [["rect", { x: 6, y: 6, width: 12, height: 12, rx: 2 }]],
    reset: [["path", { d: "M4.5 12a7.5 7.5 0 1 0 2.2-5.3M4.5 4.5v4.2h4.2" }]],
    details: [
      ["path", { d: "M5 4.5h10L19 8v11.5H5zM15 4.5V8h4M8 12h8M8 16h6" }],
    ],
    fullscreen: [["path", { d: "M8 3H3v5M16 3h5v5M8 21H3v-5M16 21h5v-5" }]],
    exitFullscreen: [["path", { d: "M3 8h5V3M21 8h-5V3M3 16h5v5M21 16h-5v5" }]],
  };

  P.TEXT = {
    ru: {
      "engine.canvas": "Canvas · физика",
      "engine.d3": "D3 · force",
      "engine.cytoscape": "Cytoscape",
      "engine.orbit": "Орбиты",
      "engine.sigma": "Sigma.js",
      "engine.vis": "vis.js · Network",
      "engine.joint": "JointJS",
      "engine.force-graph": "force-graph",
      "engine.springy": "Springy",
      "engine.force3d": "3d-force-graph",
      graphEngines: "Движок", graphFilter: "Раздел", noEngines: "нет доступных движков",
      engineDisabled: "Движок {engine} отключён после ошибки загрузки",
      allSections: "— все разделы —",
      sectionFilterPlaceholder: "Найти раздел…",
      sectionFilterEmpty: "Разделы не найдены",
      "tip.fit": "Вписать весь граф в окно сцены",
      "tip.pause": "Остановить движение узлов",
      "tip.motion": "Продолжить движение узлов",
      "tip.walk": "Автоматически переходить между связанными заметками",
      "tip.stopWalk": "Остановить автоматическую прогулку",
      "tip.reset": "Сбросить поиск, фильтры и выделение",
      "tip.details": "Показать или скрыть карточку выбранной заметки",
      "tip.fullscreen": "Развернуть сцену графа на весь экран",
      "tip.exitFullscreen": "Выйти из полноэкранного режима",
      "tip.closeDetails": "Закрыть карточку заметки",
      loading: "Загрузка данных графа…",
      loadingEngine: "Загрузка движка…",
      loadingScript: "Загрузка скрипта: {file}",
      fullscreen: "Полный экран",
      exitFullscreen: "Свернуть",
      fullscreenUnsupported: "Полный экран не поддерживается",
      preparing: "Подготовка графа…",
      error: "Граф недоступен: данные не загрузились.",
      errorTitle: "Граф недоступен",
      errorHint: "Проверьте npm run build (или npm run notes) и файл data/note-graph.json",
      retry: "Повторить",
      ready: "узлов", links: "связей", selected: "выбрано", engine: "движок",
      reference: "ссылки", series: "серии", similar: "похожие",
      open: "Открыть заметку →", neighbours: "Связанные заметки",
      noNeighbours: "Пока нет связей", walking: "прогулка",
      pause: "Пауза", motion: "Движение", walk: "Прогулка", stopWalk: "Остановить",
      fit: "Вписать", reset: "Сброс", details: "Карточка",
    },
    en: {
      "engine.canvas": "Canvas · physics",
      "engine.d3": "D3 · force",
      "engine.cytoscape": "Cytoscape",
      "engine.orbit": "Orbits",
      "engine.sigma": "Sigma.js",
      "engine.vis": "vis.js · Network",
      "engine.joint": "JointJS",
      "engine.force-graph": "force-graph",
      "engine.springy": "Springy",
      "engine.force3d": "3d-force-graph",
      graphEngines: "Engine", graphFilter: "Section", noEngines: "no engines available",
      engineDisabled: "Engine {engine} disabled after a load error",
      allSections: "— all sections —",
      sectionFilterPlaceholder: "Find a section…",
      sectionFilterEmpty: "No sections found",
      "tip.fit": "Fit the whole graph into the scene",
      "tip.pause": "Stop the nodes from moving",
      "tip.motion": "Resume node motion",
      "tip.walk": "Move automatically between connected notes",
      "tip.stopWalk": "Stop the automatic walk",
      "tip.reset": "Clear search, filters and selection",
      "tip.details": "Show or hide the selected note card",
      "tip.fullscreen": "Expand the graph scene to full screen",
      "tip.exitFullscreen": "Leave full screen",
      "tip.closeDetails": "Close the note card",
      loading: "Loading graph data…",
      loadingEngine: "Loading engine…",
      loadingScript: "Loading script: {file}",
      fullscreen: "Full screen",
      exitFullscreen: "Exit full screen",
      fullscreenUnsupported: "Full screen is not supported",
      preparing: "Preparing graph…",
      error: "Graph unavailable: data could not be loaded.",
      errorTitle: "Graph unavailable",
      errorHint: "Check npm run build (or npm run notes) and data/note-graph.json",
      retry: "Retry",
      ready: "nodes", links: "links", selected: "selected", engine: "engine",
      reference: "references", series: "series", similar: "similar",
      open: "Open note →", neighbours: "Connected notes",
      noNeighbours: "No connections yet", walking: "strolling",
      pause: "Pause", motion: "Motion", walk: "Stroll", stopWalk: "Stop",
      fit: "Fit", reset: "Reset", details: "Note card",
    },
  };
  P.t = (key, vars) => {
    const lang = document.documentElement.lang === "en" ? "en" : "ru";
    let text = P.TEXT[lang][key] || P.TEXT.ru[key] || key;
    if (vars) {
      for (const [name, value] of Object.entries(vars)) {
        text = text.replaceAll(`{${name}}`, String(value));
      }
    }
    return text;
  };

  P.settings = {
    engine: "d3",
    section: "",
    kinds: { reference: true, series: true, similar: true },
    paused: false,
  };
  P.state = {
    graph: null,
    allNodes: [],
    nodeById: new Map(),
    nodes: [],
    links: [],
    matched: new Set(),
    query: "",
    selected: null,
    hovered: null,
    walking: null,
    engine: null,
    engineId: "",
    notice: "",
    signature: "",
    owner: false,
    starting: false,
  };
  P.els = {};
  P.timers = { walk: 0, search: 0 };
  P.engineSeq = 0;
  P.listenersBound = false;
  P.themeObserver = null;
}
