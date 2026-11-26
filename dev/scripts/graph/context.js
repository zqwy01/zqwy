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
    fullscreen: [["path", { d: "M8 3H3v5M16 3h5v5M8 21H3v-5M16 21h5v-5" }]],
    exitFullscreen: [["path", { d: "M3 8h5V3M21 8h-5V3M3 16h5v5M21 16h-5v5" }]],
  };

  P.TEXT = {
    ru: {
      "engine.canvas": "Canvas · физика",
      "engine.d3": "D3 · force",
      "engine.cytoscape": "Cytoscape",
      "engine.orbit": "Орбиты",
      allSections: "— все разделы —",
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
      fit: "Вписать", reset: "Сброс",
    },
    en: {
      "engine.canvas": "Canvas · physics",
      "engine.d3": "D3 · force",
      "engine.cytoscape": "Cytoscape",
      "engine.orbit": "Orbits",
      allSections: "— all sections —",
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
      fit: "Fit", reset: "Reset",
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
    engine: "canvas",
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
