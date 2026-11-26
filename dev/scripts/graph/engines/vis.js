/* Engine 6: vis-network — interactive graph canvas with built-in physics.
 * Standalone UMD build from the local vendor directory. */
import { loadVendorScripts } from "../vendor.js";
import {
  categoryColors, nodeColor, nodeRadius, edgeWidth, shorten,
  withAlpha, seedPositions,
} from "../shared.js";

export async function createEngine({ host, palette, categories, reducedMotion, callbacks, vendorBase }) {
  await loadVendorScripts(vendorBase, ["vis-network.min.js"], (progress) => {
    callbacks.onLoadProgress?.(progress);
  });
  const vis = window.vis;
  if (!vis?.Network || !vis.DataSet) throw new Error("vis-network не загрузился");

  const container = document.createElement("div");
  container.className = "graph-vis";
  container.style.cssText = "position:absolute;inset:0;";
  host.appendChild(container);

  const colors = categoryColors(categories, palette);
  let theme = palette;
  let nodes = []; let links = [];
  let selected = null; let hovered = null; let walking = null; let matched = new Set();
  let paused = false;
  let nodeSet; let edgeSet; let network;

  function options() {
    return {
      autoResize: true,
      nodes: {
        shape: "dot",
        size: 14,
        scaling: { min: 8, max: 24, label: { enabled: false } },
        font: { color: theme.text, size: 11, face: "system-ui, sans-serif", strokeWidth: 3, strokeColor: theme.bg },
        borderWidth: 1.5,
      },
      edges: { smooth: false, selectionWidth: 0, hoverWidth: 0 },
      physics: {
        enabled: !paused,
        solver: "forceAtlas2Based",
        forceAtlas2Based: {
          gravitationalConstant: -85,
          centralGravity: 0.012,
          springLength: 118,
          springConstant: 0.055,
          avoidOverlap: 1,
        },
        stabilization: { enabled: true, iterations: reducedMotion ? 240 : 130, fit: true },
        timestep: 0.6,
      },
      interaction: {
        dragNodes: true, zoomView: true, dragView: true, hover: true,
        multiselect: false, tooltipDelay: 140,
      },
    };
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

  function applyHighlight() {
    if (!nodeSet || !edgeSet) return;
    const lit = litSet();
    const anchor = walking || hovered || selected;
    const hasFocus = Boolean(anchor || matched.size);
    nodeSet.update(nodes.map((node) => {
      const color = nodeColor(node, colors);
      const bright = lit.has(node.id) || !hasFocus;
      return {
        id: node.id,
        color: {
          background: withAlpha(color, bright ? 0.85 : 0.16),
          border: withAlpha(theme.bg, 0.9),
          highlight: { background: color, border: theme.focus },
          hover: { background: color, border: theme.focus },
        },
        font: { color: bright ? theme.text : withAlpha(theme.text, 0.25) },
      };
    }));
    edgeSet.update(links.map((link, index) => {
      const color = theme.edge[link.kind] || theme.muted;
      const on = anchor ? link.source === anchor || link.target === anchor
        : matched.has(link.source) && matched.has(link.target);
      return {
        id: `edge-${index}`,
        color: { color: withAlpha(color, on ? 1 : hasFocus ? 0.08 : 0.4) },
      };
    }));
  }

  const animation = (duration) => (reducedMotion ? false : {
    duration, easingFunction: "easeInOutQuad",
  });

  return {
    id: "vis",
    setData(payload) {
      nodes = (payload.nodes || []).map((node) => ({ ...node }));
      links = (payload.links || []).map((link) => ({ ...link }));
      seedPositions(nodes, categories, host.clientWidth || 800, host.clientHeight || 600);
      nodeSet = new vis.DataSet(nodes.map((node) => ({
        id: node.id,
        label: shorten(node.title, 24),
        size: Math.max(6, nodeRadius(node) * 1.2),
        title: node.title,
        x: node.x, y: node.y,
      })));
      edgeSet = new vis.DataSet(links.map((link, index) => ({
        id: `edge-${index}`,
        from: link.source,
        to: link.target,
        width: edgeWidth(link.kind, link.weight) * 1.4,
        dashes: link.kind !== "reference",
      })));
      const opts = options();
      if (network) {
        network.setOptions(opts);
        network.setData({ nodes: nodeSet, edges: edgeSet });
      } else {
        network = new vis.Network(container, { nodes: nodeSet, edges: edgeSet }, opts);
        network.on("click", (params) => {
          if (params.nodes?.length) {
            selected = String(params.nodes[0]);
            callbacks.onSelect?.(selected);
          } else callbacks.onSelect?.(null);
        });
        network.on("doubleClick", (params) => {
          if (params.nodes?.length) callbacks.onActivate?.(String(params.nodes[0]));
        });
        network.on("hoverNode", (params) => {
          hovered = String(params.node);
          const canvas = params.pointer?.canvas;
          callbacks.onHover?.(hovered, canvas ? { x: canvas.x, y: canvas.y } : null);
          applyHighlight();
        });
        network.on("blurNode", () => {
          hovered = null;
          callbacks.onHover?.(null, null);
          applyHighlight();
        });
        network.on("dragEnd", (params) => {
          for (const id of params.nodes || []) {
            const position = network.getPositions([id])?.[id];
            const node = nodes.find((item) => item.id === id);
            if (node && position) { node.x = position.x; node.y = position.y; }
          }
        });
      }
      if (reducedMotion) {
        network.stabilize(240);
        paused = true;
        network.setOptions({ physics: { enabled: false } });
      }
      applyHighlight();
      network.fit({ animation: false });
    },
    setHighlight(state) {
      selected = state.selected || null;
      hovered = state.hovered || null;
      walking = state.walking || null;
      matched = state.matched || new Set();
      applyHighlight();
    },
    focus(id) {
      if (!nodes.some((node) => node.id === id)) return;
      network.focus(id, { scale: 1.5, animation: animation(420) });
    },
    fit() { network.fit({ animation: animation(420) }); },
    reheat() { paused = false; network.setOptions({ physics: { enabled: true } }); network.stabilize(140); },
    setPaused(value) {
      paused = Boolean(value);
      network?.setOptions({ physics: { enabled: !paused } });
    },
    refreshTheme(next) {
      theme = next;
      network.setOptions(options());
      applyHighlight();
    },
    destroy() {
      network?.destroy();
      container.remove();
    },
    start() {},
  };
}
