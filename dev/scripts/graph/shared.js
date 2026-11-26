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

/** Deterministic starting positions grouped by category. Engines with their
  * own physics use these as seeds; purely manual engines render them as-is. */
export function seedPositions(nodes, categories, width, height) {
  const groups = new Map();
  for (const node of nodes || []) {
    if (!groups.has(node.category)) groups.set(node.category, []);
    groups.get(node.category).push(node);
  }
  const entries = [...groups.entries()];
  entries.forEach(([category, list], index) => {
    const center = -Math.PI / 2 + (index / Math.max(1, entries.length)) * Math.PI * 2;
    list.forEach((node, position) => {
      const ring = Math.floor(position / 9);
      const slot = position % 9;
      const angle = center + (slot - 4) * 0.13 + (hash01(`${category}${position}`) - 0.5) * 0.06;
      const radius = 150 + ring * 70 + hash01(node.id) * 25;
      node.x = width / 2 + Math.cos(angle) * radius;
      node.y = height / 2 + Math.sin(angle) * radius;
    });
  });
  separateNodes(nodes || [], 8, 3);
}

/** Push overlapping balls apart so nodes never sit on top of each other.
  * Fixed (dragged/pinned) nodes stay put and absorb no displacement. */
export function separateNodes(nodes, padding = 7, iterations = 2) {
  for (let pass = 0; pass < iterations; pass += 1) {
    for (let i = 0; i < nodes.length; i += 1) {
      for (let j = i + 1; j < nodes.length; j += 1) {
        const a = nodes[i]; const b = nodes[j];
        const min = (Number(a.radius) || nodeRadius(a)) + (Number(b.radius) || nodeRadius(b)) + padding;
        let dx = b.x - a.x; let dy = b.y - a.y;
        let distance = Math.sqrt(dx * dx + dy * dy);
        if (distance >= min) continue;
        if (distance < 0.001) {
          const angle = (hash01(a.id) - hash01(b.id)) * Math.PI * 2;
          dx = Math.cos(angle) * 0.001;
          dy = Math.sin(angle) * 0.001;
          distance = 0.001;
        }
        const shift = (min - distance) / distance;
        const aFixed = a.fx != null; const bFixed = b.fx != null;
        if (aFixed && bFixed) continue;
        const aPart = aFixed ? 0 : bFixed ? 1 : 0.5;
        const bPart = bFixed ? 0 : aFixed ? 1 : 0.5;
        a.x -= dx * shift * aPart; a.y -= dy * shift * aPart;
        b.x += dx * shift * bPart; b.y += dy * shift * bPart;
      }
    }
  }
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

/** Guard a network-dependent promise so a stalled request cannot leave the
 *  graph spinner or the walk UI waiting forever. Timeouts are marked transient
 *  so an engine is not permanently disabled for a slow connection. */
export function withTimeout(promise, ms, message = "Operation timed out") {
  let timer = 0;
  const deadline = new Promise((_, reject) => {
    timer = window.setTimeout(() => {
      const error = new Error(message);
      error.name = "TimeoutError";
      error.transient = true;
      reject(error);
    }, ms);
  });
  return Promise.race([Promise.resolve(promise), deadline])
    .finally(() => window.clearTimeout(timer));
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

/** Smooth camera interpolation for the hand-rolled SVG/Canvas engines.
 *  `target` may be a function so a moving node stays centred while the camera
 *  glides towards it. The returned callback cancels an in-flight transition. */
export function tweenView(read, target, apply, { duration = 460, reducedMotion = false } = {}) {
  const from = { ...read() };
  const resolve = () => (typeof target === "function" ? target() : target);
  const paint = (value) => apply(value);

  if (reducedMotion || duration <= 0) {
    paint({ ...from, ...resolve() });
    return () => {};
  }

  let frame = 0;
  let cancelled = false;
  const start = performance.now();
  const step = (now) => {
    if (cancelled) return;
    const t = Math.min(1, (now - start) / duration);
    // Cubic in/out: slow at both ends, confident in the middle. This keeps a
    // walk from feeling like a hard camera cut between neighbouring notes.
    const eased = t < 0.5 ? 4 * t * t * t : 1 - ((-2 * t + 2) ** 3) / 2;
    const to = resolve();
    paint({
      x: from.x + (to.x - from.x) * eased,
      y: from.y + (to.y - from.y) * eased,
      k: from.k + (to.k - from.k) * eased,
    });
    if (t < 1) frame = requestAnimationFrame(step);
    else frame = 0;
  };
  frame = requestAnimationFrame(step);
  return () => {
    cancelled = true;
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
  };
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
