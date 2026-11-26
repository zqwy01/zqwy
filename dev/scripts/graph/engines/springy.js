/* Engine 9: Springy — the original little force-layout library.
 * Springy only computes positions; this wrapper draws them on Canvas 2D and
 * adds hard collision separation so the balls never overlap. */
import { loadVendorScripts } from "../vendor.js";
import {
  categoryColors, nodeColor, nodeRadius, edgeWidth, shorten,
  withAlpha, seedPositions, separateNodes, observeResize, tweenView,
} from "../shared.js";

const SCALE = 100;

export async function createEngine({ host, palette, categories, reducedMotion, callbacks, vendorBase }) {
  await loadVendorScripts(vendorBase, ["springy.js"], (progress) => {
    callbacks.onLoadProgress?.(progress);
  });
  const Springy = window.Springy;
  if (!Springy?.Layout?.ForceDirected) throw new Error("Springy failed to load");

  const canvas = document.createElement("canvas");
  canvas.setAttribute("aria-hidden", "true");
  host.appendChild(canvas);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D is unavailable");

  const colors = categoryColors(categories, palette);
  let theme = palette;
  let nodes = []; let links = [];
  let graph; let layout; let byId = new Map();
  let width = 1; let height = 1; let dpr = 1;
  let view = { x: 0, y: 0, k: 1 };
  let cancelFocus = null;
  let energy = 1; let paused = false; let raf = 0;
  let selected = null; let hovered = null; let walking = null; let matched = new Set();
  const pointer = { down: false, mode: "", node: null, x: 0, y: 0, moved: false };
  let disconnected = null;

  function wake() { if (!raf) raf = requestAnimationFrame(frame); }
  function invalidate() { wake(); }

  function resize() {
    const rect = host.getBoundingClientRect();
    width = Math.max(1, rect.width); height = Math.max(1, rect.height);
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    invalidate();
  }

  function world(node) { return layout?.point(node)?.p; }
  function screenX(point) { return point.x * SCALE * view.k + view.x; }
  function screenY(point) { return point.y * SCALE * view.k + view.y; }
  function localPoint(event) {
    const rect = host.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }
  function stopFocus() {
    if (!cancelFocus) return;
    cancelFocus();
    cancelFocus = null;
  }
  function setView(next) {
    Object.assign(view, next);
    wake();
  }

  function collide() {
    if (!layout || !nodes.length) return;
    const items = nodes.map((node) => ({
      id: node.id,
      x: world(node).x,
      y: world(node).y,
      radius: nodeRadius(node) / SCALE,
      fx: pointer.down && pointer.node === node ? world(node).x : null,
    }));
    separateNodes(items, 6 / SCALE, 2);
    for (const item of items) {
      const point = world(byId.get(item.id));
      point.x = item.x; point.y = item.y;
    }
  }

  function step() {
    if (!layout || !nodes.length) return;
    layout.tick(0.035);
    if (pointer.down && pointer.node) {
      const point = world(pointer.node);
      point.x = (pointer.x - view.x) / (SCALE * view.k);
      point.y = (pointer.y - view.y) / (SCALE * view.k);
      point.v = new Springy.Vector(0, 0);
    }
    collide();
    energy *= 0.995;
  }

  function litSet() {
    const lit = new Set();
    const add = (id) => {
      if (!id) return;
      lit.add(id);
      for (const link of links) {
        if (link.source === id) lit.add(link.target);
        else if (link.target === id) lit.add(link.source);
      }
    };
    add(selected); add(hovered); add(walking);
    for (const id of matched) lit.add(id);
    return lit;
  }

  function draw() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = theme.bg;
    ctx.fillRect(0, 0, width, height);
    if (!layout || !nodes.length) return;
    const lit = litSet();
    const anchor = walking || hovered || selected;
    const hasFocus = Boolean(anchor || matched.size);

    ctx.lineCap = "round";
    for (const link of links) {
      const a = byId.get(link.source); const b = byId.get(link.target);
      if (!a || !b || !world(a) || !world(b)) continue;
      const color = theme.edge[link.kind] || theme.muted;
      const on = anchor ? link.source === anchor || link.target === anchor
        : matched.has(link.source) && matched.has(link.target);
      ctx.strokeStyle = withAlpha(color, on ? 0.95 : hasFocus ? 0.08 : 0.36);
      ctx.lineWidth = (on ? 2.1 : edgeWidth(link.kind, link.weight)) / Math.max(0.5, view.k);
      ctx.setLineDash(link.kind === "series" ? [5, 4] : link.kind === "similar" ? [1, 5] : []);
      ctx.beginPath();
      ctx.moveTo(screenX(world(a)), screenY(world(a)));
      ctx.lineTo(screenX(world(b)), screenY(world(b)));
      ctx.stroke();
    }
    ctx.setLineDash([]);

    for (const node of nodes) {
      const point = world(node);
      if (!point) continue;
      const x = screenX(point); const y = screenY(point);
      if (x < -80 || y < -80 || x > width + 80 || y > height + 80) continue;
      const radius = nodeRadius(node) * Math.max(0.8, Math.min(1.35, view.k));
      const color = nodeColor(node, colors);
      const bright = lit.has(node.id) || !hasFocus;
      const isSelected = node.id === selected || node.id === hovered || node.id === walking;
      ctx.globalAlpha = bright ? 1 : 0.16;
      ctx.fillStyle = withAlpha(color, isSelected ? 1 : 0.82);
      ctx.beginPath(); ctx.arc(x, y, radius, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = isSelected ? theme.text : withAlpha(theme.bg, 0.9);
      ctx.lineWidth = isSelected ? 2 : 1.4;
      ctx.stroke();
      if (isSelected || matched.has(node.id)) {
        ctx.strokeStyle = withAlpha(color, 0.85);
        ctx.lineWidth = 1.4;
        ctx.beginPath(); ctx.arc(x, y, radius + 5, 0, Math.PI * 2); ctx.stroke();
      }
      if (bright && (isSelected || matched.has(node.id) || (node.degree || 0) >= 9)) {
        ctx.font = "11px system-ui, sans-serif";
        ctx.lineJoin = "round";
        ctx.strokeStyle = theme.bg; ctx.lineWidth = 3;
        const label = shorten(node.title, 28);
        ctx.strokeText(label, x + radius + 5, y + 4);
        ctx.fillStyle = theme.text; ctx.fillText(label, x + radius + 5, y + 4);
      }
      ctx.globalAlpha = 1;
    }
  }

  function frame() {
    raf = 0;
    const dragging = pointer.down && pointer.mode === "node";
    const moving = (!paused && energy > 0.02) || dragging;
    if (moving) step();
    draw();
    if (moving) wake();
  }

  function hitTest(point) {
    let best = null; let distance = Infinity;
    for (const node of nodes) {
      const p = world(node);
      if (!p) continue;
      const d = Math.hypot(screenX(p) - point.x, screenY(p) - point.y);
      if (d <= nodeRadius(node) * Math.max(0.8, view.k) + 5 && d < distance) {
        best = node; distance = d;
      }
    }
    return best;
  }

  function onPointerDown(event) {
    if (event.button !== 0 && event.pointerType === "mouse") return;
    stopFocus();
    const point = localPoint(event);
    const node = hitTest(point);
    pointer.down = true; pointer.moved = false; pointer.x = point.x; pointer.y = point.y;
    pointer.node = node; pointer.mode = node ? "node" : "pan";
    if (node) {
      const p = world(node);
      p.v = new Springy.Vector(0, 0);
      energy = Math.max(energy, 0.2);
    }
    canvas.setPointerCapture?.(event.pointerId);
    wake();
  }
  function onPointerMove(event) {
    const point = localPoint(event);
    if (pointer.down) {
      if (pointer.mode === "pan") {
        view.x += point.x - pointer.x; view.y += point.y - pointer.y;
      }
      pointer.moved = true; wake();
    } else {
      const node = hitTest(point);
      const id = node?.id || null;
      if (id !== hovered) {
        hovered = id;
        callbacks.onHover?.(id, id ? point : null);
        wake();
      }
    }
    pointer.x = point.x; pointer.y = point.y;
  }
  function onPointerUp(event) {
    pointer.down = false; pointer.node = null; pointer.mode = "";
    canvas.releasePointerCapture?.(event.pointerId);
    wake();
  }
  function onClick(event) {
    const node = hitTest(localPoint(event));
    callbacks.onSelect?.(node?.id || null);
  }
  function onDoubleClick(event) {
    const node = hitTest(localPoint(event));
    if (node) callbacks.onActivate?.(node.id);
  }
  function onWheel(event) {
    event.preventDefault();
    stopFocus();
    const point = localPoint(event);
    const next = Math.max(0.25, Math.min(3, view.k * (event.deltaY > 0 ? 0.9 : 1.1)));
    view.x = point.x - ((point.x - view.x) / view.k) * next;
    view.y = point.y - ((point.y - view.y) / view.k) * next;
    view.k = next;
    wake();
  }

  function fit() {
    if (!layout || !nodes.length) return;
    stopFocus();
    let minX = Infinity; let minY = Infinity; let maxX = -Infinity; let maxY = -Infinity;
    for (const node of nodes) {
      const p = world(node);
      if (!p) continue;
      minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
      minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
    }
    if (!Number.isFinite(minX)) return;
    const spanX = Math.max(0.01, maxX - minX) * SCALE;
    const spanY = Math.max(0.01, maxY - minY) * SCALE;
    view.k = Math.max(0.2, Math.min(2.2, Math.min((width - 90) / spanX, (height - 90) / spanY)));
    view.x = width / 2 - ((minX + maxX) / 2) * SCALE * view.k;
    view.y = height / 2 - ((minY + maxY) / 2) * SCALE * view.k;
    wake();
  }

  canvas.addEventListener("pointerdown", onPointerDown);
  canvas.addEventListener("pointermove", onPointerMove);
  canvas.addEventListener("pointerup", onPointerUp);
  canvas.addEventListener("pointercancel", onPointerUp);
  canvas.addEventListener("click", onClick);
  canvas.addEventListener("dblclick", onDoubleClick);
  canvas.addEventListener("wheel", onWheel, { passive: false });
  disconnected = observeResize(host, resize);
  resize();

  return {
    id: "springy",
    setData(payload) {
      stopFocus();
      nodes = (payload.nodes || []).map((node) => ({ ...node }));
      links = (payload.links || []).map((link) => ({ ...link }));
      byId = new Map(nodes.map((node) => [node.id, node]));
      graph = new Springy.Graph();
      const springyNodes = new Map();
      for (const node of nodes) {
        springyNodes.set(node.id, new Springy.Node(node.id, { label: node.title }));
      }
      for (const node of springyNodes.values()) graph.addNode(node);
      links.forEach((link, index) => {
        const a = springyNodes.get(link.source); const b = springyNodes.get(link.target);
        if (!a || !b) return;
        graph.addEdge(new Springy.Edge(`e${index}`, a, b, {
          length: link.kind === "similar" ? 1.6 : link.kind === "series" ? 1 : 1.2,
        }));
      });
      layout = new Springy.Layout.ForceDirected(graph, 180, 340, 0.5, 0.01, 0.06);
      // Seeded, separated positions replace Springy's random starting points.
      const seeded = nodes.map((node) => ({ ...node }));
      seedPositions(seeded, categories, width, height);
      for (const node of seeded) {
        const point = layout.point(springyNodes.get(node.id));
        point.p.x = node.x / SCALE; point.p.y = node.y / SCALE;
      }
      energy = 1; paused = reducedMotion;
      if (reducedMotion) {
        for (let i = 0; i < 200; i += 1) step();
      }
      fit();
      invalidate();
    },
    setHighlight(state) {
      selected = state.selected || null;
      hovered = state.hovered || null;
      walking = state.walking || null;
      matched = state.matched || new Set();
      invalidate();
    },
    focus(id) {
      const node = byId.get(id);
      if (!node || !world(node)) return;
      stopFocus();
      const scale = Math.max(view.k, 1.2);
      cancelFocus = tweenView(
        () => view,
        () => {
          const point = world(node);
          if (!point) return { ...view };
          return {
            x: width / 2 - point.x * SCALE * scale,
            y: height / 2 - point.y * SCALE * scale,
            k: scale,
          };
        },
        setView,
        { duration: 460, reducedMotion },
      );
    },
    fit,
    reheat() {
      for (const node of nodes) world(node).v = new Springy.Vector(0, 0);
      energy = 1; paused = false; invalidate();
    },
    setPaused(value) { paused = Boolean(value); if (!paused) { energy = Math.max(energy, 0.3); invalidate(); } },
    refreshTheme(next) { theme = next; invalidate(); },
    destroy() {
      stopFocus();
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerup", onPointerUp);
      canvas.removeEventListener("pointercancel", onPointerUp);
      canvas.removeEventListener("click", onClick);
      canvas.removeEventListener("dblclick", onDoubleClick);
      canvas.removeEventListener("wheel", onWheel);
      disconnected?.();
      canvas.remove();
    },
    start() { wake(); },
  };
}
