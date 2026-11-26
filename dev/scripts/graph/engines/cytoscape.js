/* Engine 3: Cytoscape.js — a mature graph library with its own layouts,
 * hit-testing and gestures. Loaded from the local vendor directory only. */
import { loadVendorScripts } from "../vendor.js";
import { categoryColors, nodeColor, nodeRadius, edgeWidth, shorten } from "../shared.js";

export async function createEngine({ host, palette, categories, reducedMotion, callbacks, vendorBase }) {
  await loadVendorScripts(vendorBase, ["cytoscape.min.js"], (progress) => {
    callbacks.onLoadProgress?.(progress);
  });
  const cytoscape = window.cytoscape;
  if (!cytoscape) throw new Error("Cytoscape.js failed to load");

  const container = document.createElement("div");
  container.className = "graph-cytoscape";
  container.style.cssText = "position:absolute;inset:0;";
  host.appendChild(container);
  const colors = categoryColors(categories, palette);
  let theme = palette;
  let nodes = []; let links = []; let cy = null; let layout = null; let paused = false;
  let selected = null; let hovered = null; let walking = null; let matched = new Set();

  function styleSheet() {
    return [
      {
        selector: "node",
        style: {
          "background-color": "data(color)",
          "background-opacity": 0.82,
          "border-width": 1.5,
          "border-color": theme.bg,
          "label": "data(label)",
          "color": theme.text,
          "font-family": "system-ui, sans-serif",
          "font-size": 10,
          "text-valign": "bottom",
          "text-halign": "center",
          "text-margin-y": 4,
          "max-width": "140px",
          "text-wrap": "ellipsis",
          "text-background-color": theme.bg,
          "text-background-opacity": 0.75,
          "text-background-padding": "2px",
          "width": "data(size)",
          "height": "data(size)",
          "overlay-opacity": 0,
          "transition-property": "opacity, border-width, border-color",
          "transition-duration": 180,
        },
      },
      {
        selector: "edge",
        style: {
          "width": "data(width)",
          "line-color": "data(color)",
          "line-style": "data(style)",
          "curve-style": "bezier",
          "opacity": 0.45,
          "overlay-opacity": 0,
        },
      },
      { selector: "node.dimmed", style: { opacity: 0.14 } },
      { selector: "edge.dimmed", style: { opacity: 0.05 } },
      { selector: "node.lit", style: { "border-width": 2.5, "border-color": theme.focus } },
      { selector: "node.selected", style: { "border-width": 3.5, "border-color": theme.focus } },
      { selector: "node.walking", style: { "border-width": 5, "border-color": theme.focus } },
      { selector: "edge.lit", style: { width: 2.4, opacity: 1 } },
    ];
  }

  function rememberPositions() {
    if (!cy) return;
    for (const node of nodes) {
      const element = cy.getElementById(node.id);
      if (element?.length) { node.x = element.position("x"); node.y = element.position("y"); }
    }
  }

  function buildElements() {
    const elements = nodes.map((node) => ({
      group: "nodes",
      data: {
        id: node.id,
        label: shorten(node.title, 26),
        color: nodeColor(node, colors),
        size: nodeRadius(node) * 2,
      },
      position: { x: Number.isFinite(node.x) ? node.x : 0, y: Number.isFinite(node.y) ? node.y : 0 },
    }));
    links.forEach((link, index) => {
      elements.push({
        group: "edges",
        data: {
          id: `link-${index}`,
          source: link.source,
          target: link.target,
          kind: link.kind,
          color: theme.edge[link.kind] || theme.muted,
          width: edgeWidth(link.kind, link.weight),
          style: link.kind === "series" ? "dashed" : link.kind === "similar" ? "dotted" : "solid",
        },
      });
    });
    return elements;
  }

  function runLayout(animate = !reducedMotion) {
    if (!cy || !nodes.length) return;
    layout?.stop();
    layout = cy.layout({
      name: "cose",
      animate,
      animationDuration: 650,
      animationEasing: "ease-out-cubic",
      nodeRepulsion: 9000,
      idealEdgeLength: (edge) => (edge.data("kind") === "similar" ? 170 : 115),
      edgeElasticity: 90,
      nestingFactor: 0.08,
      gravity: 0.3,
      gravityRange: 3.8,
      numIter: 700,
      initialTemp: 180,
      coolingFactor: 0.95,
      minTemp: 1.0,
      randomize: !nodes.some((node) => Number.isFinite(node.x)),
      fit: true,
      padding: 45,
    });
    layout.run();
    if (paused) layout.stop();
  }

  function applyHighlight() {
    if (!cy) return;
    const anchor = walking || hovered || selected;
    const lit = new Set();
    const add = (id) => {
      if (!id) return;
      lit.add(id);
      cy.getElementById(id).connectedEdges().forEach((edge) => {
        lit.add(edge.source().id());
        lit.add(edge.target().id());
      });
    };
    add(selected); add(hovered); add(walking);
    for (const id of matched) lit.add(id);
    const hasFocus = Boolean(anchor || matched.size);

    cy.batch(() => {
      cy.nodes().forEach((node) => {
        const id = node.id();
        const classes = [];
        if (hasFocus && !lit.has(id)) classes.push("dimmed");
        if (lit.has(id)) classes.push("lit");
        if (id === selected) classes.push("selected");
        if (id === hovered) classes.push("hovered");
        if (id === walking) classes.push("walking");
        node.classes(classes.join(" "));
      });
      cy.edges().forEach((edge) => {
        const a = edge.source().id(); const b = edge.target().id();
        const isLit = anchor ? a === anchor || b === anchor : matched.has(a) && matched.has(b);
        edge.classes([hasFocus && !isLit ? "dimmed" : "", isLit ? "lit" : ""].filter(Boolean).join(" "));
      });
    });
  }

  cy = cytoscape({
    container,
    elements: [],
    style: styleSheet(),
    layout: { name: "preset" },
    minZoom: 0.15,
    maxZoom: 4,
    wheelSensitivity: 0.25,
    boxSelectionEnabled: false,
    autounselectify: true,
  });

  cy.on("tap", "node", (event) => callbacks.onSelect?.(event.target.id()));
  cy.on("dbltap", "node", (event) => callbacks.onActivate?.(event.target.id()));
  cy.on("mouseover", "node", (event) => {
    const position = event.renderedPosition || { x: 0, y: 0 };
    hovered = event.target.id();
    callbacks.onHover?.(hovered, { x: position.x, y: position.y });
    applyHighlight();
  });
  cy.on("mouseout", "node", () => {
    if (!hovered) return;
    hovered = null;
    callbacks.onHover?.(null, null);
    applyHighlight();
  });
  cy.on("tap", (event) => { if (event.target === cy) callbacks.onSelect?.(null); });
  cy.on("dragfree", "node", (event) => {
    const node = nodes.find((item) => item.id === event.target.id());
    if (node) { node.x = event.target.position("x"); node.y = event.target.position("y"); }
  });

  return {
    id: "cytoscape",
    setData(payload) {
      rememberPositions();
      nodes = payload.nodes || [];
      links = payload.links || [];
      cy.elements().remove();
      cy.add(buildElements());
      if (reducedMotion) { layout?.stop(); cy.fit(undefined, 45); }
      else runLayout();
      applyHighlight();
    },
    setHighlight(state) {
      selected = state.selected || null;
      hovered = state.hovered || null;
      walking = state.walking || null;
      matched = state.matched || new Set();
      applyHighlight();
    },
    focus(id) {
      const node = cy.getElementById(id);
      if (!node?.length) return;
      cy.animate({ center: { eles: node }, zoom: Math.max(cy.zoom(), 1.15) }, { duration: reducedMotion ? 0 : 320 });
    },
    fit() { cy.fit(undefined, 45); },
    reheat() { paused = false; runLayout(); },
    setPaused(value) {
      paused = Boolean(value);
      if (paused) layout?.stop();
      else runLayout(false);
    },
    refreshTheme(next) {
      theme = next;
      cy.style().fromJson(styleSheet()).update();
      cy.edges().forEach((edge) => {
        const kind = edge.data("kind");
        edge.data("color", theme.edge[kind] || theme.muted);
      });
    },
    destroy() {
      layout?.stop();
      cy.destroy();
      container.remove();
    },
  };
}
