/* Engine 8: JointJS — a diagramming toolkit. It has no force layout of its
 * own, so this wrapper runs a small canvas-style simulation and feeds the
 * resulting positions into JointJS cells. */
import { loadVendorScripts } from "../vendor.js";
import {
  categoryColors, nodeColor, nodeRadius, edgeWidth, shorten,
  withAlpha, seedPositions, separateNodes, observeResize, tweenView,
} from "../shared.js";

export async function createEngine({ host, palette, categories, reducedMotion, callbacks, vendorBase }) {
  await loadVendorScripts(vendorBase, [
    "jquery.min.js", "underscore-min.js", "backbone-min.js", "joint.min.js",
  ], (progress) => callbacks.onLoadProgress?.(progress));
  const joint = window.joint;
  if (!joint?.dia?.Graph || !joint?.shapes?.standard?.Circle) {
    throw new Error("JointJS не загрузился");
  }

  const container = document.createElement("div");
  container.className = "graph-joint";
  container.style.cssText = "position:absolute;inset:0;";
  host.appendChild(container);

  const colors = categoryColors(categories, palette);
  let theme = palette;
  let nodes = []; let links = []; let byId = new Map();
  let graph; let paper;
  const cells = new Map(); const linkCells = [];
  let width = 1; let height = 1;
  let energy = 1; let paused = false; let raf = 0; let cancelFocus = null;
  let selected = null; let hovered = null; let walking = null; let matched = new Set();
  let disconnected = null;

  function wake() { if (!raf) raf = requestAnimationFrame(frame); }
  function invalidate() { wake(); }
  function stopFocus() {
    if (!cancelFocus) return;
    cancelFocus();
    cancelFocus = null;
  }
  function paperView() {
    const translation = paper.translate();
    return { x: translation.tx, y: translation.ty, k: paper.scale().sx };
  }
  function setPaperView(next) {
    paper.scale(next.k);
    paper.translate(next.x, next.y);
  }

  function resize() {
    width = Math.max(1, host.clientWidth); height = Math.max(1, host.clientHeight);
    paper.setDimensions(width, height);
    invalidate();
  }

  function build() {
    graph.clear();
    cells.clear(); linkCells.length = 0;
    nodes.forEach((node) => {
      const radius = nodeRadius(node);
      const cell = new joint.shapes.standard.Circle({
        id: `node-${node.id}`,
        position: { x: node.x - radius, y: node.y - radius },
        size: { width: radius * 2, height: radius * 2 },
        attrs: {
          body: { fill: nodeColor(node, colors), stroke: theme.bg, strokeWidth: 1.5 },
          label: { text: "", fill: theme.text, fontSize: 10, fontFamily: "system-ui, sans-serif" },
        },
      });
      cells.set(node.id, cell);
    });
    links.forEach((link, index) => {
      const cell = new joint.shapes.standard.Link({
        id: `link-${index}`,
        source: { id: `node-${link.source}` },
        target: { id: `node-${link.target}` },
        z: -1,
        attrs: {
          line: {
            stroke: theme.edge[link.kind] || theme.muted,
            strokeWidth: edgeWidth(link.kind, link.weight) * 1.3,
            strokeDasharray: link.kind === "series" ? "5 4" : link.kind === "similar" ? "1 5" : "",
            targetMarker: null,
          },
        },
      });
      linkCells.push({ cell, link });
    });
    graph.addCells([...cells.values(), ...linkCells.map((entry) => entry.cell)]);
    applyHighlight();
  }

  function step() {
    if (!nodes.length) return;
    for (const node of nodes) { node.ax = 0; node.ay = 0; }
    for (let i = 0; i < nodes.length; i += 1) {
      for (let j = i + 1; j < nodes.length; j += 1) {
        const a = nodes[i]; const b = nodes[j];
        const dx = b.x - a.x; const dy = b.y - a.y;
        const force = (energy * 480) / (dx * dx + dy * dy + 36);
        a.ax -= dx * force; a.ay -= dy * force;
        b.ax += dx * force; b.ay += dy * force;
      }
    }
    for (const link of links) {
      const a = byId.get(link.source); const b = byId.get(link.target);
      if (!a || !b) continue;
      const dx = b.x - a.x; const dy = b.y - a.y;
      const distance = Math.sqrt(dx * dx + dy * dy) || 1;
      const target = link.kind === "similar" ? 170 : link.kind === "series" ? 100 : 125;
      // Use the unit vector. Multiplying by dx as well makes far-apart nodes
      // accelerate without bound and sends JointJS non-finite coordinates.
      const force = energy * 0.016 * (distance - target) * (0.55 + Number(link.weight || 0));
      const nx = dx / distance; const ny = dy / distance;
      a.ax += nx * force; a.ay += ny * force;
      b.ax -= nx * force; b.ay -= ny * force;
    }
    for (const node of nodes) {
      node.ax += (width / 2 - node.x) * energy * 0.0015;
      node.ay += (height / 2 - node.y) * energy * 0.0015;
      node.vx = ((node.vx || 0) + node.ax) * 0.84;
      node.vy = ((node.vy || 0) + node.ay) * 0.84;
      const speed = Math.hypot(node.vx, node.vy);
      if (speed > 12) { node.vx *= 12 / speed; node.vy *= 12 / speed; }
      node.x += node.vx; node.y += node.vy;
    }
    separateNodes(nodes, 6, 2);
    for (const node of nodes) {
      const radius = nodeRadius(node);
      cells.get(node.id)?.position(node.x - radius, node.y - radius);
    }
    energy *= 0.99;
  }

  function applyHighlight() {
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
    const anchor = walking || hovered || selected;
    const hasFocus = Boolean(anchor || matched.size);
    for (const node of nodes) {
      const cell = cells.get(node.id);
      if (!cell) continue;
      const color = nodeColor(node, colors);
      const bright = lit.has(node.id) || !hasFocus;
      const isSelected = node.id === selected || node.id === hovered || node.id === walking;
      cell.attr("body/fill", withAlpha(color, bright ? 0.85 : 0.16));
      cell.attr("body/stroke", isSelected ? theme.focus : theme.bg);
      cell.attr("body/strokeWidth", isSelected ? 3 : 1.5);
      cell.attr("label/text", bright && (isSelected || matched.has(node.id) || (node.degree || 0) >= 9)
        ? shorten(node.title, 24) : "");
    }
    for (const { cell, link } of linkCells) {
      const color = theme.edge[link.kind] || theme.muted;
      const on = anchor ? link.source === anchor || link.target === anchor
        : matched.has(link.source) && matched.has(link.target);
      cell.attr("line/stroke", withAlpha(color, on ? 1 : hasFocus ? 0.08 : 0.4));
      cell.attr("line/strokeWidth", on ? 2.4 : edgeWidth(link.kind, link.weight) * 1.3);
    }
  }

  function frame() {
    raf = 0;
    const moving = !paused && energy > 0.02;
    if (moving) step();
    if (moving) wake();
  }

  function fit(duration = 0) {
    if (!nodes.length) return;
    stopFocus();
    let minX = Infinity; let minY = Infinity; let maxX = -Infinity; let maxY = -Infinity;
    for (const node of nodes) {
      minX = Math.min(minX, node.x); maxX = Math.max(maxX, node.x);
      minY = Math.min(minY, node.y); maxY = Math.max(maxY, node.y);
    }
    if (!Number.isFinite(minX)) return;
    const spanX = Math.max(1, maxX - minX); const spanY = Math.max(1, maxY - minY);
    const scale = Math.max(0.2, Math.min(2, Math.min((width - 90) / spanX, (height - 90) / spanY)));
    if (reducedMotion || !duration) {
      paper.scale(scale);
      paper.translate(width / 2 - ((minX + maxX) / 2) * scale, height / 2 - ((minY + maxY) / 2) * scale);
      return;
    }
    const from = { ...paper.translate(), s: paper.scale().sx };
    const start = performance.now();
    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - (1 - t) ** 3;
      const next = from.s + (scale - from.s) * eased;
      paper.scale(next);
      paper.translate(
        from.tx + ((width / 2 - ((minX + maxX) / 2) * next) - from.tx) * eased,
        from.ty + ((height / 2 - ((minY + maxY) / 2) * next) - from.ty) * eased,
      );
      if (t < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  graph = new joint.dia.Graph({}, { cellNamespace: joint.shapes });
  paper = new joint.dia.Paper({
    el: container,
    model: graph,
    width: 1, height: 1,
    background: { color: theme.bg },
    gridSize: 1,
    async: false,
    cellViewNamespace: joint.shapes,
    interactive: { linkMove: false, labelMove: false, arrowheadMove: false },
  });

  const localPointer = (event) => {
    const rect = container.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };
  paper.on("element:pointerclick", (view) => callbacks.onSelect?.(String(view.model.id).replace(/^node-/, "")));
  paper.on("element:pointerdblclick", (view) => callbacks.onActivate?.(String(view.model.id).replace(/^node-/, "")));
  paper.on("element:mouseenter", (view, event) => {
    const id = String(view.model.id).replace(/^node-/, "");
    hovered = id;
    callbacks.onHover?.(id, localPointer(event));
    applyHighlight();
  });
  paper.on("element:mouseleave", () => {
    if (!hovered) return;
    hovered = null;
    callbacks.onHover?.(null, null);
    applyHighlight();
  });
  paper.on("blank:pointerclick", () => callbacks.onSelect?.(null));
  paper.on("element:pointermove", (view) => {
    const id = String(view.model.id).replace(/^node-/, "");
    const node = byId.get(id);
    if (!node) return;
    const position = view.model.position();
    const radius = nodeRadius(node);
    node.x = position.x + radius; node.y = position.y + radius;
    separateNodes(nodes, 6, 2);
    for (const item of nodes) {
      const r = nodeRadius(item);
      cells.get(item.id)?.position(item.x - r, item.y - r);
    }
  });
  paper.on("blank:pointerdown", (event) => {
    stopFocus();
    const start = localPointer(event);
    const startTranslate = paper.translate();
    const move = (moveEvent) => {
      const point = localPointer(moveEvent);
      paper.translate(startTranslate.tx + point.x - start.x, startTranslate.ty + point.y - start.y);
    };
    const up = () => {
      document.removeEventListener("pointermove", move);
      document.removeEventListener("pointerup", up);
    };
    document.addEventListener("pointermove", move);
    document.addEventListener("pointerup", up);
  });
  container.addEventListener("wheel", (event) => {
    event.preventDefault();
    stopFocus();
    const scale = paper.scale().sx * (event.deltaY > 0 ? 0.92 : 1.08);
    if (scale >= 0.2 && scale <= 3) paper.scale(scale);
  }, { passive: false });

  disconnected = observeResize(host, resize);
  resize();

  return {
    id: "joint",
    setData(payload) {
      stopFocus();
      nodes = (payload.nodes || []).map((node) => ({ ...node }));
      links = (payload.links || []).map((link) => ({ ...link }));
      byId = new Map(nodes.map((node) => [node.id, node]));
      seedPositions(nodes, categories, width, height);
      build();
      energy = 1; paused = reducedMotion;
      if (reducedMotion) for (let i = 0; i < 140; i += 1) step();
      fit();
      invalidate();
    },
    setHighlight(state) {
      selected = state.selected || null;
      hovered = state.hovered || null;
      walking = state.walking || null;
      matched = state.matched || new Set();
      applyHighlight();
    },
    focus(id) {
      const node = byId.get(id);
      if (!node) return;
      stopFocus();
      const scale = Math.max(paper.scale().sx, 1.2);
      cancelFocus = tweenView(
        paperView,
        () => ({ x: width / 2 - node.x * scale, y: height / 2 - node.y * scale, k: scale }),
        setPaperView,
        { duration: 460, reducedMotion },
      );
    },
    fit() { fit(reducedMotion ? 0 : 360); },
    reheat() {
      for (const node of nodes) { node.vx = 0; node.vy = 0; }
      energy = 1; paused = false; invalidate();
    },
    setPaused(value) { paused = Boolean(value); if (!paused) { energy = Math.max(energy, 0.3); invalidate(); } },
    refreshTheme(next) {
      theme = next;
      paper.drawBackground?.({ color: theme.bg });
      container.style.background = theme.bg;
      applyHighlight();
    },
    destroy() {
      stopFocus();
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      disconnected?.();
      paper.remove();
      container.remove();
    },
    start() { wake(); },
  };
}
