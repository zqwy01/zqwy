/* Engine 5: vasturiano/force-graph — canvas renderer with D3 physics.
 * One local script, loaded only when the engine is selected. */
import { loadVendorScripts } from "../vendor.js";
import {
  categoryColors, nodeColor, nodeRadius, edgeWidth,
  withAlpha, seedPositions, observeResize,
} from "../shared.js";

export async function createEngine({ host, palette, categories, reducedMotion, callbacks, vendorBase }) {
  await loadVendorScripts(vendorBase, ["force-graph.min.js"], (progress) => {
    callbacks.onLoadProgress?.(progress);
  });
  const factory = window.ForceGraph;
  if (typeof factory !== "function") throw new Error("ForceGraph failed to load");

  const container = document.createElement("div");
  container.className = "graph-forcegraph";
  container.style.cssText = "position:absolute;inset:0;";
  host.appendChild(container);

  const colors = categoryColors(categories, palette);
  let theme = palette;
  let nodes = []; let links = [];
  let selected = null; let hovered = null; let walking = null; let matched = new Set();
  let lastClick = { id: null, at: 0 };
  let pointer = { x: 0, y: 0 };
  let graph;

  // force-graph replaces string endpoints with node objects in graphData().
  const endId = (value) => (value && typeof value === "object" ? value.id : value);
  const ends = (link) => [endId(link.source), endId(link.target)];

  function litSet() {
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
    return lit;
  }

  function applyHighlight() {
    if (!graph) return;
    const lit = litSet();
    const anchor = walking || hovered || selected;
    const hasFocus = Boolean(anchor || matched.size);
    const isLit = (id) => lit.has(id) || !hasFocus;
    graph.nodeColor((node) => {
      const color = nodeColor(node, colors);
      return isLit(node.id) ? withAlpha(color, 0.82) : withAlpha(color, 0.14);
    });
    graph.linkColor((link) => {
      const color = theme.edge[link.kind] || theme.muted;
      const [source, target] = ends(link);
      const on = anchor ? source === anchor || target === anchor
        : matched.has(source) && matched.has(target);
      return withAlpha(color, on ? 1 : hasFocus ? 0.08 : 0.36);
    });
  }

  function tint() {
    if (!graph) return;
    graph.backgroundColor(theme.bg);
    applyHighlight();
  }

  container.addEventListener("pointermove", (event) => {
    const rect = container.getBoundingClientRect();
    pointer = { x: event.clientX - rect.left, y: event.clientY - rect.top };
  });

  graph = factory()(container)
    .nodeId("id")
    .nodeLabel((node) => node.title)
    .nodeVal((node) => (nodeRadius(node) ** 2) * 1.15)
    .linkWidth((link) => edgeWidth(link.kind, link.weight) * 1.5)
    .linkDirectionalParticles(0)
    .backgroundColor(theme.bg)
    .onNodeClick((node, event) => {
      const now = performance.now();
      const double = event?.detail >= 2 || (lastClick.id === node.id && now - lastClick.at < 340);
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

  const disconnect = observeResize(host, () => {
    graph.width(host.clientWidth || 1).height(host.clientHeight || 1);
  });

  return {
    id: "force-graph",
    setData(payload) {
      nodes = (payload.nodes || []).map((node) => ({ ...node }));
      links = (payload.links || []).map((link) => ({ ...link }));
      seedPositions(nodes, categories, host.clientWidth || 800, host.clientHeight || 600);
      graph.width(host.clientWidth || 800).height(host.clientHeight || 600)
        .graphData({ nodes, links });
      try {
        const collide = graph.d3Force("collide");
        collide?.radius((node) => nodeRadius(node) + 9).iterations(2);
        const charge = graph.d3Force("charge");
        charge?.strength(-180);
      } catch { /* physics tweaks are optional */ }
      if (reducedMotion) {
        graph.cooldownTicks(0).warmupTicks(180);
        graph.d3ReheatSimulation?.();
        graph.pauseAnimation?.();
      }
      applyHighlight();
      graph.zoomToFit(reducedMotion ? 0 : 420, 55);
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
      graph.centerAt(node.x, node.y, reducedMotion ? 0 : 420);
      graph.zoom(Math.max(graph.zoom(), 2), reducedMotion ? 0 : 420);
    },
    fit() { graph.zoomToFit(reducedMotion ? 0 : 420, 55); },
    reheat() { graph.resumeAnimation?.(); graph.d3ReheatSimulation?.(); },
    setPaused(value) {
      if (value) graph.pauseAnimation?.();
      else { graph.resumeAnimation?.(); graph.d3ReheatSimulation?.(); }
    },
    refreshTheme(next) { theme = next; tint(); },
    destroy() {
      disconnect?.();
      try { graph._destructor?.(); } catch { /* already gone */ }
      container.remove();
    },
    start() { graph.resumeAnimation?.(); },
  };
}
