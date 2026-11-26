/* Engine 1: dependency-free force layout on Canvas 2D.
 * Fast, glowy, and the default. Nodes can be dragged and pinned. */
import {
  observeResize, withAlpha, categoryColors, nodeColor, nodeRadius,
  edgeWidth, shorten, hash01,
} from "../shared.js";

export function createEngine({ host, palette, categories, reducedMotion, callbacks }) {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D недоступен");
  canvas.setAttribute("aria-hidden", "true");
  host.appendChild(canvas);

  const colors = categoryColors(categories, palette);
  let theme = palette;
  let width = 1; let height = 1; let dpr = 1;
  let nodes = []; let links = []; let byId = new Map();
  let view = { x: 0, y: 0, k: 1 };
  let alpha = 1; let paused = false; let raf = 0; let dirty = true;
  let selected = null; let hovered = null; let walking = null;
  let matched = new Set(); let litNodes = new Set(); let focusAt = 0;
  const pointer = { down: false, mode: "", node: null, x: 0, y: 0, moved: false };
  let disconnected = null;

  // The old loop ran requestAnimationFrame forever, even after the layout had
  // settled. Now frames are scheduled only while something actually changes.
  function wake() {
    if (!raf) raf = requestAnimationFrame(frame);
  }
  function invalidate() {
    dirty = true;
    wake();
  }
  function needsAnimation() {
    return !reducedMotion && Boolean(walking || selected);
  }

  function resize() {
    const rect = host.getBoundingClientRect();
    width = Math.max(1, rect.width);
    height = Math.max(1, rect.height);
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    invalidate();
  }

  function screenX(node) { return node.x * view.k + view.x; }
  function screenY(node) { return node.y * view.k + view.y; }
  function toWorld(x, y) { return { x: (x - view.x) / view.k, y: (y - view.y) / view.k }; }
  function localPoint(event) {
    const rect = host.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  function seed(node, index) {
    if (Number.isFinite(node.x) && Number.isFinite(node.y)) return;
    const group = Math.max(0, (categories || []).findIndex((c) => c.id === node.category));
    const total = Math.max(1, (categories || []).length);
    const angle = (group / total) * Math.PI * 2 - Math.PI / 2 + (hash01(node.id) - 0.5) * 0.5;
    const radius = 170 + (group % 3) * 70 + hash01(`${node.id}x`) * 60;
    node.x = width / 2 + Math.cos(angle) * radius + index * 0.4;
    node.y = height / 2 + Math.sin(angle) * radius + index * 0.4;
    node.vx = 0; node.vy = 0;
  }

  function step() {
    if (!nodes.length) return;
    const boost = alpha;
    for (const node of nodes) { node.ax = 0; node.ay = 0; }

    for (let i = 0; i < nodes.length; i += 1) {
      for (let j = i + 1; j < nodes.length; j += 1) {
        const a = nodes[i]; const b = nodes[j];
        const dx = b.x - a.x; const dy = b.y - a.y;
        const distanceSq = dx * dx + dy * dy + 36;
        const force = (boost * 520) / distanceSq;
        a.ax -= dx * force; a.ay -= dy * force;
        b.ax += dx * force; b.ay += dy * force;
      }
    }

    for (const link of links) {
      const a = byId.get(link.source); const b = byId.get(link.target);
      if (!a || !b) continue;
      const dx = b.x - a.x; const dy = b.y - a.y;
      const distance = Math.sqrt(dx * dx + dy * dy) || 1;
      const target = link.kind === "series" ? 95 : link.kind === "similar" ? 165 : 120;
      const force = boost * 0.018 * (distance - target) * (0.55 + Number(link.weight || 0));
      a.ax += dx * force; a.ay += dy * force;
      b.ax -= dx * force; b.ay -= dy * force;
    }

    // Gentle category gravity makes clusters visible without hard containers.
    const groups = new Map();
    for (const node of nodes) {
      if (!groups.has(node.category)) groups.set(node.category, { x: 0, y: 0, n: 0 });
      const group = groups.get(node.category);
      group.x += node.x; group.y += node.y; group.n += 1;
    }
    for (const group of groups.values()) { group.x /= group.n; group.y /= group.n; }
    for (const node of nodes) {
      const group = groups.get(node.category);
      node.ax += (group.x - node.x) * boost * 0.0025;
      node.ay += (group.y - node.y) * boost * 0.0025;
      node.ax += (width / 2 - node.x) * boost * 0.0012;
      node.ay += (height / 2 - node.y) * boost * 0.0012;
    }

    for (const node of nodes) {
      if (node.fx == null) {
        node.vx = (node.vx + node.ax) * 0.84;
        node.vy = (node.vy + node.ay) * 0.84;
        node.x += node.vx; node.y += node.vy;
      } else {
        node.x = node.fx; node.y = node.fy;
        node.vx = 0; node.vy = 0;
      }
    }
    alpha *= 0.986;
  }

  function computeHighlights() {
    litNodes = new Set();
    const addWithNeighbours = (id) => {
      if (!id || !byId.has(id)) return;
      litNodes.add(id);
      for (const link of links) {
        if (link.source === id) litNodes.add(link.target);
        else if (link.target === id) litNodes.add(link.source);
      }
    };
    addWithNeighbours(selected);
    addWithNeighbours(hovered);
    addWithNeighbours(walking);
    for (const id of matched) litNodes.add(id);
  }

  function edgeLit(link) {
    const anchor = walking || hovered || selected;
    if (anchor) return link.source === anchor || link.target === anchor;
    if (matched.size) return matched.has(link.source) && matched.has(link.target);
    return false;
  }

  function draw(time) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = theme.bg;
    ctx.fillRect(0, 0, width, height);
    if (!nodes.length) return;

    const hasFocus = Boolean(walking || hovered || selected || matched.size);
    ctx.lineCap = "round";
    for (const link of links) {
      const a = byId.get(link.source); const b = byId.get(link.target);
      if (!a || !b) continue;
      const lit = edgeLit(link);
      const color = theme.edge[link.kind] || theme.muted;
      ctx.strokeStyle = withAlpha(color, lit ? 0.95 : hasFocus ? 0.08 : 0.28 + (link.weight || 0) * 0.25);
      ctx.lineWidth = (lit ? 2.1 : edgeWidth(link.kind, link.weight)) / Math.max(0.5, view.k);
      ctx.setLineDash(link.kind === "series" ? [5, 4] : link.kind === "similar" ? [1, 5] : []);
      ctx.beginPath();
      const ax = screenX(a); const ay = screenY(a); const bx = screenX(b); const by = screenY(b);
      const bend = link.kind === "similar" ? 0 : (hash01(link.source + link.target) - 0.5) * 16;
      const mx = (ax + bx) / 2 - (by - ay) * bend * 0.01;
      const my = (ay + by) / 2 + (bx - ax) * bend * 0.01;
      ctx.moveTo(ax, ay);
      ctx.quadraticCurveTo(mx, my, bx, by);
      ctx.stroke();
    }
    ctx.setLineDash([]);

    for (const node of nodes) {
      const x = screenX(node); const y = screenY(node);
      if (x < -80 || y < -80 || x > width + 80 || y > height + 80) continue;
      const r = nodeRadius(node) * Math.max(0.8, Math.min(1.35, view.k));
      const color = nodeColor(node, colors);
      const dim = hasFocus && !litNodes.has(node.id);
      const isSelected = node.id === selected || node.id === hovered || node.id === walking;
      const isMatch = matched.has(node.id);

      ctx.globalAlpha = dim ? 0.16 : 1;
      // Canvas shadow blur is expensive: only focused nodes get a glow.
      if (isSelected) {
        ctx.shadowColor = withAlpha(color, 0.9);
        ctx.shadowBlur = 20;
      } else {
        ctx.shadowBlur = 0;
      }
      ctx.fillStyle = withAlpha(color, isSelected ? 1 : 0.78);
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = isSelected ? theme.text : withAlpha(theme.bg, 0.9);
      ctx.lineWidth = isSelected ? 2 : 1.4;
      ctx.stroke();

      if (isSelected || isMatch) {
        const pulse = isSelected && !reducedMotion ? Math.sin(time / 260) * 2 : 0;
        ctx.strokeStyle = withAlpha(color, isMatch ? 0.75 : 0.95);
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.arc(x, y, r + 5 + pulse, 0, Math.PI * 2);
        ctx.stroke();
      }
      if (walking === node.id && !reducedMotion) {
        const age = Math.min(1, (time - focusAt) / 900);
        ctx.strokeStyle = withAlpha(color, (1 - age) * 0.8);
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(x, y, r + 8 + age * 28, 0, Math.PI * 2);
        ctx.stroke();
      }

      const showLabel = isSelected || isMatch || ((node.degree || 0) >= 9 && view.k > 0.72);
      if (showLabel && !dim) {
        ctx.font = "11px system-ui, sans-serif";
        ctx.lineJoin = "round";
        ctx.strokeStyle = theme.bg;
        ctx.lineWidth = 3;
        const label = shorten(node.title, 28);
        ctx.strokeText(label, x + r + 5, y + 4);
        ctx.fillStyle = theme.text;
        ctx.fillText(label, x + r + 5, y + 4);
      }
      ctx.globalAlpha = 1;
    }
    dirty = false;
  }

  function frame(time) {
    raf = 0;
    const moving = !paused && alpha > 0.02;
    if (moving) { step(); dirty = true; }
    const animating = needsAnimation();
    if (dirty || animating) draw(time);
    if (moving || animating || dirty) wake();
  }

  function hitTest(x, y) {
    let best = null; let bestDistance = Infinity;
    for (const node of nodes) {
      const dx = screenX(node) - x; const dy = screenY(node) - y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      const radius = nodeRadius(node) * Math.max(0.8, Math.min(1.35, view.k)) + 5;
      if (distance <= radius && distance < bestDistance) { best = node; bestDistance = distance; }
    }
    return best;
  }

  function onPointerDown(event) {
    if (event.button !== 0 && event.pointerType === "mouse") return;
    const point = localPoint(event);
    const node = hitTest(point.x, point.y);
    pointer.down = true; pointer.moved = false; pointer.x = point.x; pointer.y = point.y;
    pointer.node = node;
    pointer.mode = node ? "node" : "pan";
    if (node) { node.fx = node.x; node.fy = node.y; }
    host.classList.add("is-dragging");
    canvas.setPointerCapture?.(event.pointerId);
  }

  function onPointerMove(event) {
    const point = localPoint(event);
    if (pointer.down) {
      const dx = point.x - pointer.x; const dy = point.y - pointer.y;
      if (Math.abs(dx) + Math.abs(dy) > 2) pointer.moved = true;
      if (pointer.mode === "node" && pointer.node) {
        const world = toWorld(point.x, point.y);
        pointer.node.fx = world.x; pointer.node.fy = world.y;
      } else if (pointer.mode === "pan") {
        view.x += dx; view.y += dy;
      }
      pointer.x = point.x; pointer.y = point.y;
      invalidate();
      return;
    }
    const node = hitTest(point.x, point.y);
    const id = node ? node.id : null;
    if (id !== hovered) { hovered = id; computeHighlights(); callbacks.onHover?.(id, point); invalidate(); }
    else if (id) callbacks.onHover?.(id, point);
  }

  function onPointerUp(event) {
    if (!pointer.down) return;
    if (!pointer.moved) callbacks.onSelect?.(pointer.node ? pointer.node.id : null);
    if (pointer.mode === "node" && pointer.node) {
      // Keep the node pinned where the user dropped it; "reheat" unpins.
      pointer.node.fx = pointer.node.x; pointer.node.fy = pointer.node.y;
    }
    pointer.down = false; pointer.mode = ""; pointer.node = null;
    host.classList.remove("is-dragging");
    canvas.releasePointerCapture?.(event.pointerId);
    invalidate();
  }

  function onDoubleClick(event) {
    const point = localPoint(event);
    const node = hitTest(point.x, point.y);
    if (node) callbacks.onActivate?.(node.id);
  }

  function onWheel(event) {
    event.preventDefault();
    const point = localPoint(event);
    const factor = Math.exp(-event.deltaY * 0.0014);
    const next = Math.max(0.2, Math.min(3.5, view.k * factor));
    const world = toWorld(point.x, point.y);
    view.k = next;
    view.x = point.x - world.x * next;
    view.y = point.y - world.y * next;
    invalidate();
  }

  function fit() {
    if (!nodes.length) return;
    let minX = Infinity; let minY = Infinity; let maxX = -Infinity; let maxY = -Infinity;
    for (const node of nodes) {
      minX = Math.min(minX, node.x); maxX = Math.max(maxX, node.x);
      minY = Math.min(minY, node.y); maxY = Math.max(maxY, node.y);
    }
    const spanX = Math.max(1, maxX - minX); const spanY = Math.max(1, maxY - minY);
    view.k = Math.max(0.2, Math.min(2.2, Math.min((width - 90) / spanX, (height - 90) / spanY)));
    view.x = width / 2 - ((minX + maxX) / 2) * view.k;
    view.y = height / 2 - ((minY + maxY) / 2) * view.k;
    invalidate();
  }

  canvas.addEventListener("pointerdown", onPointerDown);
  canvas.addEventListener("pointermove", onPointerMove);
  canvas.addEventListener("pointerup", onPointerUp);
  canvas.addEventListener("pointercancel", onPointerUp);
  canvas.addEventListener("dblclick", onDoubleClick);
  canvas.addEventListener("wheel", onWheel, { passive: false });
  disconnected = observeResize(host, resize);
  resize();

  return {
    id: "canvas",
    setData(payload) {
      nodes = payload.nodes || [];
      links = payload.links || [];
      byId = new Map(nodes.map((node) => [node.id, node]));
      nodes.forEach(seed);
      computeHighlights();
      alpha = 1;
      if (reducedMotion) {
        for (let i = 0; i < 140; i += 1) step();
        paused = true;
      }
      invalidate();
    },
    setHighlight(state) {
      selected = state.selected || null;
      hovered = state.hovered || null;
      walking = state.walking || null;
      matched = state.matched || new Set();
      focusAt = performance.now();
      computeHighlights();
      invalidate();
    },
    focus(id) {
      const node = byId.get(id);
      if (!node) return;
      view.k = Math.max(view.k, 1.15);
      view.x = width / 2 - node.x * view.k;
      view.y = height / 2 - node.y * view.k;
      focusAt = performance.now();
      invalidate();
    },
    fit,
    reheat() {
      for (const node of nodes) { node.fx = null; node.fy = null; }
      alpha = 1; paused = false;
      invalidate();
    },
    setPaused(value) {
      paused = Boolean(value);
      if (!paused) { alpha = Math.max(alpha, 0.25); invalidate(); }
    },
    refreshTheme(next) { theme = next; invalidate(); },
    destroy() {
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerup", onPointerUp);
      canvas.removeEventListener("pointercancel", onPointerUp);
      canvas.removeEventListener("dblclick", onDoubleClick);
      canvas.removeEventListener("wheel", onWheel);
      disconnected?.();
      canvas.remove();
    },
    start() { wake(); },
  };
}
