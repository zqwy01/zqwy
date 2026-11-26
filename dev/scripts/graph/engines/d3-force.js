/* Engine 2: D3 force simulation with an SVG scene graph.
 * The physics is D3's; the rendering stays under our own CSS hooks. */
import { loadVendorScripts } from "../vendor.js";
import {
  svgEl, observeResize, categoryColors, nodeColor, nodeRadius,
  edgeWidth, shorten, hash01,
} from "../shared.js";

const idOf = (value) => (typeof value === "object" ? value?.id : value);

export async function createEngine({ host, palette, categories, reducedMotion, callbacks, vendorBase }) {
  await loadVendorScripts(vendorBase, [
    "d3-dispatch.min.js", "d3-quadtree.min.js", "d3-timer.min.js", "d3-force.min.js",
  ], (progress) => callbacks.onLoadProgress?.(progress));
  const d3 = window.d3;
  if (!d3?.forceSimulation) throw new Error("D3 force не загрузился");

  const svg = svgEl("svg", { class: "graph-svg", role: "img", "aria-label": "Граф заметок (D3)" });
  const viewport = svgEl("g", { class: "graph-viewport" });
  const linkLayer = svgEl("g", { class: "graph-links" });
  const nodeLayer = svgEl("g", { class: "graph-nodes" });
  viewport.append(linkLayer, nodeLayer);
  svg.append(viewport);
  host.appendChild(svg);

  const colors = categoryColors(categories, palette);
  let theme = palette;
  let width = 1; let height = 1;
  let nodes = []; let links = [];
  let simulation = null;
  const nodeEls = new Map(); const linkEls = new Map();
  let view = { x: 0, y: 0, k: 1 };
  let selected = null; let hovered = null; let walking = null;
  let matched = new Set(); let paused = false;
  const drag = { node: null, pointerId: null };
  let disconnected = null;

  function resize() {
    const rect = host.getBoundingClientRect();
    width = Math.max(1, rect.width); height = Math.max(1, rect.height);
    svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
    applyView();
  }
  function applyView() {
    viewport.setAttribute("transform", `translate(${view.x},${view.y}) scale(${view.k})`);
  }
  function localPoint(event) {
    const rect = host.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }
  function screenOf(node) {
    return { x: node.x * view.k + view.x, y: node.y * view.k + view.y };
  }

  function seed(node, index) {
    if (Number.isFinite(node.x) && Number.isFinite(node.y)) return;
    const group = Math.max(0, (categories || []).findIndex((c) => c.id === node.category));
    const angle = (group / Math.max(1, categories.length)) * Math.PI * 2 - Math.PI / 2;
    node.x = width / 2 + Math.cos(angle) * (180 + index * 0.6);
    node.y = height / 2 + Math.sin(angle) * (180 + index * 0.6);
  }

  function renderTick() {
    for (const { el, link } of linkEls.values()) {
      const a = link.source; const b = link.target;
      if (!a || !b) continue;
      el.setAttribute("x1", a.x); el.setAttribute("y1", a.y);
      el.setAttribute("x2", b.x); el.setAttribute("y2", b.y);
    }
    for (const { el, node } of nodeEls.values()) {
      el.setAttribute("transform", `translate(${node.x},${node.y})`);
    }
  }

  function paintStyles() {
    for (const { el, link } of linkEls.values()) {
      el.style.setProperty("--edge-color", theme.edge[link.kind] || theme.muted);
      el.style.setProperty("--edge-width", edgeWidth(link.kind, link.weight));
    }
    for (const { el, node } of nodeEls.values()) {
      el.style.setProperty("--node-color", nodeColor(node, colors));
    }
  }

  function applyHighlight() {
    const anchor = walking || hovered || selected;
    const lit = new Set();
    const add = (id) => {
      if (!id) return;
      lit.add(id);
      for (const link of links) {
        const a = idOf(link.source); const b = idOf(link.target);
        if (a === id) lit.add(b);
        if (b === id) lit.add(a);
      }
    };
    add(selected); add(hovered); add(walking);
    for (const id of matched) lit.add(id);
    const hasFocus = Boolean(anchor || matched.size);

    for (const [id, { el }] of nodeEls) {
      el.classList.toggle("is-selected", id === selected);
      el.classList.toggle("is-hovered", id === hovered);
      el.classList.toggle("is-match", matched.has(id));
      el.classList.toggle("is-dim", hasFocus && !lit.has(id));
      if (id === walking) {
        el.classList.remove("is-walking");
        void el.getBoundingClientRect();
        el.classList.add("is-walking");
      } else el.classList.remove("is-walking");
    }
    for (const { el, link } of linkEls.values()) {
      const a = idOf(link.source); const b = idOf(link.target);
      const isLit = anchor ? a === anchor || b === anchor : matched.has(a) && matched.has(b);
      el.classList.toggle("is-lit", Boolean(isLit));
      el.classList.toggle("is-dim", hasFocus && !isLit);
    }
  }

  function buildScene() {
    linkLayer.replaceChildren();
    nodeLayer.replaceChildren();
    nodeEls.clear(); linkEls.clear();

    for (const link of links) {
      const copy = { ...link };
      const kind = copy.kind;
      const el = svgEl("line", { class: "ng-link", "data-kind": kind });
      el.style.setProperty("--edge-color", theme.edge[kind] || theme.muted);
      el.style.setProperty("--edge-width", edgeWidth(kind, copy.weight));
      el.style.setProperty("--edge-opacity", kind === "similar" ? 0.3 : 0.5);
      linkLayer.append(el);
      linkEls.set(`${idOf(copy.source)}>${idOf(copy.target)}`, { el, link: copy });
    }

    for (const node of nodes) {
      const radius = nodeRadius(node);
      const group = svgEl("g", {
        class: `ng-node${(node.degree || 0) >= 9 ? " is-major" : ""}`,
        "data-id": node.id,
        tabindex: "0",
        role: "button",
        "aria-label": node.title,
      });
      group.style.setProperty("--node-color", nodeColor(node, colors));
      group.style.setProperty("--label-opacity", (node.degree || 0) >= 9 ? "0.72" : "0");
      group.append(
        svgEl("circle", { class: "ng-halo", r: radius + 7 }),
        svgEl("circle", { r: radius }),
      );
      const label = svgEl("text", { class: "ng-label", x: radius + 6, y: 3 });
      label.textContent = shorten(node.title, 28);
      group.append(label);

      group.addEventListener("pointerdown", (event) => {
        event.stopPropagation();
        drag.node = node; drag.pointerId = event.pointerId;
        if (simulation) simulation.alphaTarget(0.25).restart();
        node.fx = node.x; node.fy = node.y;
        group.setPointerCapture?.(event.pointerId);
      });
      group.addEventListener("pointermove", (event) => {
        if (drag.node !== node) return;
        const point = localPoint(event);
        node.fx = (point.x - view.x) / view.k;
        node.fy = (point.y - view.y) / view.k;
        renderTick();
      });
      const endDrag = (event) => {
        if (drag.node !== node) return;
        drag.node = null; drag.pointerId = null;
        if (simulation) simulation.alphaTarget(0);
        group.releasePointerCapture?.(event.pointerId);
      };
      group.addEventListener("pointerup", endDrag);
      group.addEventListener("pointercancel", endDrag);
      group.addEventListener("mouseenter", () => {
        hovered = node.id; applyHighlight(); callbacks.onHover?.(node.id, screenOf(node));
      });
      group.addEventListener("mouseleave", () => {
        if (hovered === node.id) { hovered = null; applyHighlight(); callbacks.onHover?.(null, null); }
      });
      group.addEventListener("click", (event) => {
        event.stopPropagation(); callbacks.onSelect?.(node.id);
      });
      group.addEventListener("dblclick", (event) => {
        event.stopPropagation(); callbacks.onActivate?.(node.id);
      });
      group.addEventListener("keydown", (event) => {
        if (event.key === "Enter") { event.preventDefault(); callbacks.onSelect?.(node.id); }
      });
      nodeLayer.append(group);
      nodeEls.set(node.id, { el: group, node });
    }
  }

  function startSimulation() {
    simulation?.stop();
    const simLinks = [...linkEls.values()].map((entry) => entry.link);
    simulation = d3.forceSimulation(nodes)
      .force("link", d3.forceLink(simLinks).id((node) => node.id)
        .distance((link) => link.kind === "similar" ? 165 : link.kind === "series" ? 95 : 120)
        .strength((link) => 0.08 + (Number(link.weight) || 0) * 0.18))
      .force("charge", d3.forceManyBody().strength(-260).distanceMax(650))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collide", d3.forceCollide((node) => nodeRadius(node) + 8).iterations(2))
      .alphaDecay(0.035)
      .on("tick", renderTick);

    if (reducedMotion) {
      simulation.stop();
      for (let i = 0; i < 220; i += 1) simulation.tick();
      paused = true;
      renderTick();
    } else if (paused) simulation.stop();
    applyHighlight();
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
    applyView();
  }

  function onBackgroundDown(event) {
    if (event.target !== svg && event.target !== viewport && event.target !== linkLayer) return;
    const point = localPoint(event);
    const start = { ...view };
    svg.setPointerCapture?.(event.pointerId);
    const move = (moveEvent) => {
      const current = localPoint(moveEvent);
      view.x = start.x + current.x - point.x;
      view.y = start.y + current.y - point.y;
      applyView();
    };
    const up = () => {
      svg.removeEventListener("pointermove", move);
      svg.removeEventListener("pointerup", up);
      svg.removeEventListener("pointercancel", up);
    };
    svg.addEventListener("pointermove", move);
    svg.addEventListener("pointerup", up);
    svg.addEventListener("pointercancel", up);
  }
  function onWheel(event) {
    event.preventDefault();
    const point = localPoint(event);
    const next = Math.max(0.2, Math.min(3.5, view.k * Math.exp(-event.deltaY * 0.0014)));
    view.x = point.x - ((point.x - view.x) / view.k) * next;
    view.y = point.y - ((point.y - view.y) / view.k) * next;
    view.k = next;
    applyView();
  }
  svg.addEventListener("pointerdown", onBackgroundDown);
  svg.addEventListener("wheel", onWheel, { passive: false });
  disconnected = observeResize(host, resize);
  resize();

  return {
    id: "d3",
    setData(payload) {
      nodes = payload.nodes || [];
      links = (payload.links || []).map((link) => ({ ...link }));
      nodes.forEach(seed);
      buildScene();
      startSimulation();
    },
    setHighlight(state) {
      selected = state.selected || null;
      hovered = state.hovered || null;
      walking = state.walking || null;
      matched = state.matched || new Set();
      applyHighlight();
    },
    focus(id) {
      const node = nodes.find((item) => item.id === id);
      if (!node) return;
      view.k = Math.max(view.k, 1.15);
      view.x = width / 2 - node.x * view.k;
      view.y = height / 2 - node.y * view.k;
      applyView();
    },
    fit,
    reheat() {
      for (const node of nodes) { node.fx = null; node.fy = null; }
      paused = false;
      simulation?.alpha(1).restart();
    },
    setPaused(value) {
      paused = Boolean(value);
      if (!simulation) return;
      if (paused) simulation.stop();
      else simulation.alpha(0.35).restart();
    },
    refreshTheme(next) {
      theme = next; paintStyles();
    },
    destroy() {
      simulation?.stop();
      svg.removeEventListener("pointerdown", onBackgroundDown);
      svg.removeEventListener("wheel", onWheel);
      disconnected?.();
      svg.remove();
    },
  };
}
