/* Engine 7: Sigma.js 1.x — lightweight WebGL/canvas renderer.
 * Sigma does not compute layouts: stable, collision-free positions come from
 * our shared helpers, and the camera is animated by the wrapper. */
import { loadVendorScripts } from "../vendor.js";
import {
  categoryColors, nodeColor, nodeRadius, edgeWidth, shorten,
  withAlpha, seedPositions, observeResize,
} from "../shared.js";

export async function createEngine({ host, palette, categories, reducedMotion, callbacks, vendorBase }) {
  await loadVendorScripts(vendorBase, ["sigma.min.js"], (progress) => {
    callbacks.onLoadProgress?.(progress);
  });
  const Sigma = window.sigma;
  if (typeof Sigma !== "function") throw new Error("Sigma.js failed to load");

  const container = document.createElement("div");
  container.className = "graph-sigma";
  container.style.cssText = "position:absolute;inset:0;";
  host.appendChild(container);

  const colors = categoryColors(categories, palette);
  let theme = palette;
  let nodes = []; let links = [];
  let selected = null; let hovered = null; let walking = null; let matched = new Set();
  let pointer = { x: 0, y: 0 };
  let cameraRaf = 0;

  const sigma = new Sigma({
    graph: { nodes: [], edges: [] },
    container,
    settings: {
      drawLabels: true,
      labelColor: "node",
      defaultLabelColor: theme.text,
      labelSize: 11,
      defaultNodeColor: theme.focus,
      defaultEdgeColor: theme.muted,
      minNodeSize: 6,
      maxNodeSize: 22,
      borderSize: 1,
      zoomMin: 0.15,
      zoomMax: 3,
    },
  });

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

  function applyHighlight() {
    const lit = litSet();
    const anchor = walking || hovered || selected;
    const hasFocus = Boolean(anchor || matched.size);
    for (const node of sigma.graph.nodes()) {
      const color = nodeColor(node, colors);
      const bright = lit.has(node.id) || !hasFocus;
      node.color = withAlpha(color, bright ? 0.88 : 0.16);
      node.label = bright ? shorten(node.title, 24) : "";
    }
    for (const edge of sigma.graph.edges()) {
      const kind = edge.kind || "reference";
      const color = theme.edge[kind] || theme.muted;
      const on = anchor ? edge.source === anchor || edge.target === anchor
        : matched.has(edge.source) && matched.has(edge.target);
      edge.color = withAlpha(color, on ? 1 : hasFocus ? 0.08 : 0.4);
    }
    sigma.refresh();
  }

  function moveCamera(target, duration = 0) {
    if (cameraRaf) cancelAnimationFrame(cameraRaf);
    if (!duration || reducedMotion) {
      Object.assign(sigma.camera, target);
      sigma.refresh();
      return;
    }
    const from = { ...sigma.camera };
    const start = performance.now();
    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - (1 - t) ** 3;
      sigma.camera.x = from.x + (target.x - from.x) * eased;
      sigma.camera.y = from.y + (target.y - from.y) * eased;
      sigma.camera.ratio = from.ratio + (target.ratio - from.ratio) * eased;
      sigma.refresh();
      if (t < 1) cameraRaf = requestAnimationFrame(tick);
      else cameraRaf = 0;
    };
    cameraRaf = requestAnimationFrame(tick);
  }

  function fit(duration = 0) {
    if (!nodes.length) return;
    let minX = Infinity; let minY = Infinity; let maxX = -Infinity; let maxY = -Infinity;
    for (const node of nodes) {
      minX = Math.min(minX, node.x); maxX = Math.max(maxX, node.x);
      minY = Math.min(minY, node.y); maxY = Math.max(maxY, node.y);
    }
    if (!Number.isFinite(minX)) return;
    const spanX = Math.max(1, maxX - minX); const spanY = Math.max(1, maxY - minY);
    const ratio = Math.max(0.2, Math.min(2.5, Math.min(
      (host.clientWidth || 800) / (spanX + 120),
      (host.clientHeight || 600) / (spanY + 120),
    )));
    moveCamera({ x: (minX + maxX) / 2, y: (minY + maxY) / 2, ratio }, duration);
  }

  container.addEventListener("pointermove", (event) => {
    const rect = container.getBoundingClientRect();
    pointer = { x: event.clientX - rect.left, y: event.clientY - rect.top };
  });
  sigma.bind("clickNode", (event) => callbacks.onSelect?.(String(event.data.node.id)));
  sigma.bind("doubleClickNode", (event) => callbacks.onActivate?.(String(event.data.node.id)));
  sigma.bind("rightClickNode", (event) => callbacks.onActivate?.(String(event.data.node.id)));
  sigma.bind("overNode", (event) => {
    hovered = String(event.data.node.id);
    callbacks.onHover?.(hovered, pointer);
    applyHighlight();
  });
  sigma.bind("outNode", () => {
    if (!hovered) return;
    hovered = null;
    callbacks.onHover?.(null, null);
    applyHighlight();
  });
  sigma.bind("clickStage", () => callbacks.onSelect?.(null));

  const disconnect = observeResize(host, () => {
    container.style.width = `${host.clientWidth}px`;
    container.style.height = `${host.clientHeight}px`;
    sigma.refresh();
  });

  return {
    id: "sigma",
    setData(payload) {
      nodes = (payload.nodes || []).map((node) => ({ ...node }));
      links = (payload.links || []).map((link) => ({ ...link }));
      seedPositions(nodes, categories, host.clientWidth || 800, host.clientHeight || 600);
      sigma.graph.clear();
      for (const node of nodes) {
        sigma.graph.addNode({
          id: node.id,
          title: node.title,
          category: node.category,
          degree: node.degree,
          label: shorten(node.title, 24),
          x: node.x, y: node.y,
          size: nodeRadius(node) * 2.1,
          color: nodeColor(node, colors),
        });
      }
      links.forEach((link, index) => {
        sigma.graph.addEdge({
          id: `edge-${index}`,
          source: link.source,
          target: link.target,
          kind: link.kind,
          size: edgeWidth(link.kind, link.weight) * 1.3,
          color: theme.edge[link.kind] || theme.muted,
        });
      });
      applyHighlight();
      fit(reducedMotion ? 0 : 320);
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
      moveCamera({ x: node.x, y: node.y, ratio: Math.max(sigma.camera.ratio, 1.6) }, reducedMotion ? 0 : 380);
    },
    fit() { fit(reducedMotion ? 0 : 380); },
    reheat() { fit(reducedMotion ? 0 : 380); },
    setPaused() { /* Sigma is a renderer: there is no simulation to pause. */ },
    refreshTheme(next) {
      theme = next;
      sigma.settings("defaultLabelColor", theme.text);
      sigma.settings("defaultEdgeColor", theme.muted);
      applyHighlight();
    },
    destroy() {
      if (cameraRaf) cancelAnimationFrame(cameraRaf);
      disconnect?.();
      sigma.kill();
      container.remove();
    },
    start() { sigma.refresh(); },
  };
}
