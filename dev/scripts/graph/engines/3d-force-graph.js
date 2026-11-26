/* Engine 10: vasturiano/3d-force-graph — WebGL spheres with orbit controls.
 * The Three.js runtime is bundled into the local UMD file. */
import { loadVendorScripts } from "../vendor.js";
import {
  categoryColors, nodeColor, nodeRadius, edgeWidth,
  withAlpha, seedPositions, observeResize,
} from "../shared.js";

export async function createEngine({ host, palette, categories, reducedMotion, callbacks, vendorBase }) {
  await loadVendorScripts(vendorBase, ["3d-force-graph.min.js"], (progress) => {
    callbacks.onLoadProgress?.(progress);
  });
  const factory = window.ForceGraph3D;
  if (typeof factory !== "function") throw new Error("ForceGraph3D не загрузился");

  const container = document.createElement("div");
  container.className = "graph-force3d";
  container.style.cssText = "position:absolute;inset:0;";
  host.appendChild(container);

  const colors = categoryColors(categories, palette);
  let theme = palette;
  let nodes = []; let links = [];
  let selected = null; let hovered = null; let walking = null; let matched = new Set();
  let pointer = { x: 0, y: 0 };
  let lastClick = { id: null, at: 0 };
  let graph;

  const endId = (value) => (value && typeof value === "object" ? value.id : value);
  const ends = (link) => [endId(link.source), endId(link.target)];

  function applyHighlight() {
    if (!graph) return;
    const lit = new Set();
    const add = (id) => {
      if (!id) return;
      lit.add(id);
      for (const link of links) {
        const [source, target] = ends(link);
        if (source === id) lit.add(target);
        else if (target === id) lit.add(source);
      }
    };
    add(selected); add(hovered); add(walking);
    for (const id of matched) lit.add(id);
    const anchor = walking || hovered || selected;
    const hasFocus = Boolean(anchor || matched.size);
    graph.nodeColor((node) => {
      const color = nodeColor(node, colors);
      return withAlpha(color, lit.has(node.id) || !hasFocus ? 0.9 : 0.18);
    });
    graph.linkColor((link) => {
      const color = theme.edge[link.kind] || theme.muted;
      const [source, target] = ends(link);
      const on = anchor ? source === anchor || target === anchor
        : matched.has(source) && matched.has(target);
      return withAlpha(color, on ? 1 : hasFocus ? 0.06 : 0.32);
    });
  }

  container.addEventListener("pointermove", (event) => {
    const rect = container.getBoundingClientRect();
    pointer = { x: event.clientX - rect.left, y: event.clientY - rect.top };
  });

  graph = factory()(container)
    .showNavInfo(false)
    .backgroundColor(theme.bg)
    .nodeId("id")
    .nodeLabel((node) => node.title)
    .nodeVal((node) => Math.pow(nodeRadius(node) * 1.5, 2))
    .linkWidth((link) => edgeWidth(link.kind, link.weight) * 1.8)
    .onNodeClick((node) => {
      const now = performance.now();
      const double = lastClick.id === node.id && now - lastClick.at < 360;
      lastClick = { id: node.id, at: now };
      if (double) callbacks.onActivate?.(node.id);
      else callbacks.onSelect?.(node.id);
    })
    .onNodeRightClick((node) => callbacks.onActivate?.(node.id))
    .onNodeHover((node) => {
      hovered = node?.id || null;
      callbacks.onHover?.(hovered, hovered ? pointer : null);
      applyHighlight();
    })
    .onBackgroundClick(() => callbacks.onSelect?.(null));

  if (reducedMotion) graph.cooldownTicks(0).warmupTicks(160);
  const disconnect = observeResize(host, () => {
    graph.width(host.clientWidth || 1).height(host.clientHeight || 1);
  });

  return {
    id: "force3d",
    setData(payload) {
      nodes = (payload.nodes || []).map((node) => ({ ...node }));
      links = (payload.links || []).map((link) => ({ ...link }));
      seedPositions(nodes, categories, host.clientWidth || 800, host.clientHeight || 600);
      graph.width(host.clientWidth || 800).height(host.clientHeight || 600)
        .graphData({ nodes, links });
      try {
        graph.d3Force("collide")?.radius((node) => nodeRadius(node) + 10).iterations(2);
        graph.d3Force("charge")?.strength(-190);
        graph.d3Force("link")?.distance((link) =>
          link.kind === "similar" ? 165 : link.kind === "series" ? 95 : 120);
      } catch { /* physics tweaks are optional */ }
      applyHighlight();
      graph.zoomToFit(reducedMotion ? 0 : 420, 60);
      if (reducedMotion) graph.pauseAnimation?.();
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
      graph.cameraPosition({ x: node.x, y: node.y, z: node.z || 120 }, null, reducedMotion ? 0 : 430);
    },
    fit() { graph.zoomToFit(reducedMotion ? 0 : 420, 60); },
    reheat() { graph.resumeAnimation?.(); graph.d3ReheatSimulation?.(); },
    setPaused(value) {
      if (value) graph.pauseAnimation?.();
      else { graph.resumeAnimation?.(); graph.d3ReheatSimulation?.(); }
    },
    refreshTheme(next) {
      theme = next;
      graph.backgroundColor(theme.bg);
      applyHighlight();
    },
    destroy() {
      disconnect?.();
      try { graph._destructor?.(); } catch { /* already gone */ }
      container.remove();
    },
    start() { graph.resumeAnimation?.(); },
  };
}
