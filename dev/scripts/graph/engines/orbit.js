/* Engine 4: static "constellation" layout drawn in SVG.
 * No physics, no jitter — the same notes always sit in the same place,
 * grouped by folder. Nice for screenshots, low-power devices and calm mode. */
import {
  svgEl, observeResize, categoryColors, nodeColor, nodeRadius,
  edgeWidth, shorten, separateNodes, tweenView,
} from "../shared.js";

export function createEngine({ host, palette, categories, reducedMotion, callbacks }) {
  const svg = svgEl("svg", { class: "graph-svg", role: "img", "aria-label": "Граф заметок (орбиты)" });
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
  const nodeEls = new Map(); const linkEls = new Map();
  const positions = new Map();
  let view = { x: 0, y: 0, k: 1 };
  let cancelFocus = null;
  let selected = null; let hovered = null; let walking = null; let matched = new Set();
  let disconnected = null;

  function applyView() {
    viewport.setAttribute("transform", `translate(${view.x},${view.y}) scale(${view.k})`);
  }
  function stopFocus() {
    if (!cancelFocus) return;
    cancelFocus();
    cancelFocus = null;
  }
  function setView(next) {
    Object.assign(view, next);
    applyView();
  }
  function localPoint(event) {
    const rect = host.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }
  function resize() {
    const rect = host.getBoundingClientRect();
    width = Math.max(1, rect.width); height = Math.max(1, rect.height);
    svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
    applyView();
  }

  function layout(allNodes) {
    positions.clear();
    const groups = new Map((categories || []).map((category) => [category.id, []]));
    for (const node of allNodes || []) {
      if (!groups.has(node.category)) groups.set(node.category, []);
      groups.get(node.category).push(node);
    }
    const entries = [...groups.entries()].filter(([, list]) => list.length);
    const total = Math.max(1, entries.length);
    entries.forEach(([category, list], index) => {
      list.sort((a, b) => String(a.date || "").localeCompare(String(b.date || "")) || a.title.localeCompare(b.title, "ru"));
      const centerAngle = -Math.PI / 2 + (index / total) * Math.PI * 2;
      const spread = (Math.PI * 2 / total) * 0.86;
      const baseRadius = 150 + Math.min(190, list.length * 11);
      list.forEach((node, position) => {
        const ring = Math.floor(position / 8);
        const inRing = Math.min(8, list.length - ring * 8);
        const slot = position % 8;
        const ratio = inRing > 1 ? slot / (inRing - 1) : 0.5;
        const angle = centerAngle + (ratio - 0.5) * spread;
        const radius = baseRadius + ring * 58;
        const point = {
          x: width / 2 + Math.cos(angle) * radius,
          y: height / 2 + Math.sin(angle) * radius,
        };
        positions.set(node.id, point);
        point.id = node.id;
        node.x = point.x; node.y = point.y;
      });
    });
    // Static rings still need breathing room: nudge touching balls apart.
    const points = [...positions.values()];
    if (points.length) {
      separateNodes(points, 7, 3);
      for (const point of points) {
        const node = (allNodes || []).find((item) => item.id === point.id);
        if (node) { node.x = point.x; node.y = point.y; }
      }
    }
  }

  function applyHighlight() {
    const anchor = walking || hovered || selected;
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
    const hasFocus = Boolean(anchor || matched.size);

    for (const [id, element] of nodeEls) {
      element.classList.toggle("is-selected", id === selected);
      element.classList.toggle("is-hovered", id === hovered);
      element.classList.toggle("is-match", matched.has(id));
      element.classList.toggle("is-dim", hasFocus && !lit.has(id));
      element.classList.toggle("is-walking", id === walking);
    }
    for (const { el, link } of linkEls.values()) {
      const isLit = anchor ? link.source === anchor || link.target === anchor
        : matched.has(link.source) && matched.has(link.target);
      el.classList.toggle("is-lit", Boolean(isLit));
      el.classList.toggle("is-dim", hasFocus && !isLit);
    }
  }

  function build() {
    linkLayer.replaceChildren();
    nodeLayer.replaceChildren();
    nodeEls.clear(); linkEls.clear();

    for (const link of links) {
      const a = positions.get(link.source); const b = positions.get(link.target);
      if (!a || !b) continue;
      const path = svgEl("path", { class: "ng-link", "data-kind": link.kind });
      path.style.setProperty("--edge-color", theme.edge[link.kind] || theme.muted);
      path.style.setProperty("--edge-width", edgeWidth(link.kind, link.weight));
      path.style.setProperty("--edge-opacity", link.kind === "similar" ? 0.3 : 0.52);
      const mx = (a.x + b.x) / 2; const my = (a.y + b.y) / 2;
      const cx = width / 2 + (mx - width / 2) * 0.6;
      const cy = height / 2 + (my - height / 2) * 0.6;
      path.setAttribute("d", `M ${a.x} ${a.y} Q ${cx} ${cy} ${b.x} ${b.y}`);
      linkLayer.append(path);
      linkEls.set(`${link.source}>${link.target}`, { el: path, link });
    }

    for (const node of nodes) {
      const point = positions.get(node.id);
      if (!point) continue;
      const radius = nodeRadius(node);
      const group = svgEl("g", {
        class: `ng-node${(node.degree || 0) >= 9 ? " is-major" : ""}`,
        transform: `translate(${point.x},${point.y})`,
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
      group.addEventListener("mouseenter", () => {
        hovered = node.id; applyHighlight(); callbacks.onHover?.(node.id, point);
      });
      group.addEventListener("mouseleave", () => {
        if (hovered !== node.id) return;
        hovered = null; applyHighlight(); callbacks.onHover?.(null, null);
      });
      group.addEventListener("click", (event) => { event.stopPropagation(); callbacks.onSelect?.(node.id); });
      group.addEventListener("dblclick", (event) => { event.stopPropagation(); callbacks.onActivate?.(node.id); });
      group.addEventListener("keydown", (event) => {
        if (event.key === "Enter") { event.preventDefault(); callbacks.onSelect?.(node.id); }
      });
      nodeLayer.append(group);
      nodeEls.set(node.id, group);
    }
    applyHighlight();
  }

  function fit() {
    if (!nodes.length) return;
    stopFocus();
    let minX = Infinity; let minY = Infinity; let maxX = -Infinity; let maxY = -Infinity;
    for (const node of nodes) {
      const point = positions.get(node.id);
      if (!point) continue;
      minX = Math.min(minX, point.x); maxX = Math.max(maxX, point.x);
      minY = Math.min(minY, point.y); maxY = Math.max(maxY, point.y);
    }
    if (!Number.isFinite(minX)) return;
    const spanX = Math.max(1, maxX - minX); const spanY = Math.max(1, maxY - minY);
    view.k = Math.max(0.2, Math.min(1.8, Math.min((width - 90) / spanX, (height - 90) / spanY)));
    view.x = width / 2 - ((minX + maxX) / 2) * view.k;
    view.y = height / 2 - ((minY + maxY) / 2) * view.k;
    applyView();
  }

  function onBackgroundDown(event) {
    if (event.target !== svg && event.target !== viewport && event.target !== linkLayer) return;
    stopFocus();
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
    stopFocus();
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
    id: "orbit",
    setData(payload) {
      stopFocus();
      nodes = payload.nodes || [];
      links = payload.links || [];
      layout(payload.allNodes || nodes);
      build();
      fit();
    },
    setHighlight(state) {
      selected = state.selected || null;
      hovered = state.hovered || null;
      walking = state.walking || null;
      matched = state.matched || new Set();
      applyHighlight();
    },
    focus(id) {
      const point = positions.get(id);
      if (!point) return;
      stopFocus();
      const scale = Math.max(view.k, 1.15);
      cancelFocus = tweenView(
        () => view,
        () => ({ x: width / 2 - point.x * scale, y: height / 2 - point.y * scale, k: scale }),
        setView,
        { duration: 460, reducedMotion },
      );
    },
    fit,
    reheat() { fit(); },
    setPaused() { /* the constellation is deliberately still */ },
    refreshTheme(next) {
      theme = next;
      for (const { el, link } of linkEls.values()) {
        el.style.setProperty("--edge-color", theme.edge[link.kind] || theme.muted);
      }
      for (const [id, element] of nodeEls) {
        const node = nodes.find((item) => item.id === id);
        if (node) element.style.setProperty("--node-color", nodeColor(node, colors));
      }
    },
    destroy() {
      stopFocus();
      svg.removeEventListener("pointerdown", onBackgroundDown);
      svg.removeEventListener("wheel", onWheel);
      disconnected?.();
      svg.remove();
    },
  };
}
