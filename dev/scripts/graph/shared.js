/* Palette, geometry and DOM helpers shared by all graph engines. */

const CATEGORY_PALETTE = [
  "#8ab4f8", "#81c995", "#f0a77a", "#c58af9", "#f2c14e",
  "#78d9ec", "#e79bb2", "#9aa0f8", "#b6c86e", "#d3a1e6",
  "#f28c8c", "#7ed0b8",
];

const SVG_NS = "http://www.w3.org/2000/svg";

export function cssVar(name, fallback = "") {
  try {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
  } catch { return fallback; }
}

/** All colours are read from the active site theme at engine creation time. */
export function readPalette() {
  const categories = CATEGORY_PALETTE;
  return {
    bg: cssVar("--bg", "#000000"),
    elevated: cssVar("--bg-elevated", "#0b0b0b"),
    elevated2: cssVar("--bg-elevated-2", "#141414"),
    text: cssVar("--text", "#ffffff"),
    muted: cssVar("--muted", "#a3a3a3"),
    border: cssVar("--border", "#2a2a2a"),
    focus: cssVar("--focus-border", "#ffffff"),
    edge: {
      reference: cssVar("--focus-border", "#ffffff"),
      series: "#f2c14e",
      similar: cssVar("--muted", "#a3a3a3"),
    },
    categories,
  };
}

const RGB_CACHE = new Map();

/** Colour strings are parsed once, not once per node per animation frame. */
function parseRgb(color) {
  const value = String(color || "").trim();
  const key = value || "default";
  const cached = RGB_CACHE.get(key);
  if (cached) return cached;

  let r = 160; let g = 160; let b = 160;
  const short = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/i.exec(value);
  const long = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(value);
  if (short) {
    r = parseInt(short[1] + short[1], 16);
    g = parseInt(short[2] + short[2], 16);
    b = parseInt(short[3] + short[3], 16);
  } else if (long) {
    r = parseInt(long[1], 16); g = parseInt(long[2], 16); b = parseInt(long[3], 16);
  } else {
    const rgb = /rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/i.exec(value);
    if (rgb) { r = Number(rgb[1]); g = Number(rgb[2]); b = Number(rgb[3]); }
  }
  const result = [r, g, b];
  RGB_CACHE.set(key, result);
  return result;
}

export function withAlpha(color, alpha) {
  const [r, g, b] = parseRgb(color);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function categoryColors(categories, palette) {
  const map = new Map();
  (categories || []).forEach((category, index) => {
    map.set(category.id, palette.categories[index % palette.categories.length]);
  });
  return map;
}

export function nodeColor(node, colors) {
  return colors.get(node.category) || paletteFallback();
}

function paletteFallback() { return "#8ab4f8"; }

export function nodeRadius(node) {
  const degree = Number(node?.degree) || 0;
  return Math.round((5.5 + Math.min(11, Math.sqrt(degree) * 2.4)) * 10) / 10;
}

export function edgeWidth(kind, weight) {
  if (kind === "reference") return 1.4;
  if (kind === "series") return 1.2;
  return 0.7 + Math.min(0.8, Number(weight) || 0);
}

export function shorten(value, max = 26) {
  const text = String(value || "");
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

export function svgEl(tag, attrs = {}) {
  const element = document.createElementNS(SVG_NS, tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value == null) continue;
    element.setAttribute(key, String(value));
  }
  return element;
}

export function observeResize(host, callback) {
  if (typeof ResizeObserver === "undefined") {
    window.addEventListener("resize", callback);
    return () => window.removeEventListener("resize", callback);
  }
  const observer = new ResizeObserver(callback);
  observer.observe(host);
  return () => observer.disconnect();
}

/** Deterministic pseudo-random jitter so each rebuild looks the same. */
export function hash01(value) {
  let hash = 2166136261;
  for (const char of String(value || "")) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return ((hash >>> 0) % 10000) / 10000;
}
