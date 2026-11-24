/* Инвентарь как граф: предметы — узлы, связи между ними — рёбра.
   Визуализация на канве (DOM-позиционирование), позволяет видеть,
   какие предметы связаны через рюкзак и другие контейнеры. */
(function () {
  'use strict';

  const ZQ = window.ZQ;
  const C = ZQ.C;
  const rt = ZQ.rt;
  const dom = ZQ.dom;

  const GRAPH_RADIUS = 120;
  const NODE_SIZE = 150;

  function buildInventoryGraph() {
    const nodes = [];
    const edges = [];

    /* Рюкзак — корневой узел графа. */
    const backpack = C.items.backpack;
    if (backpack) {
      nodes.push({
        id: 'backpack',
        label: backpack.name || 'Рюкзак',
        kind: 'container',
        isRoot: true,
        nx: 0.5,
        ny: 0.5,
        color: '--rust'
      });
    }

    /* Предметы игрока — узлы. */
    for (const itemId of rt.state.items) {
      const item = C.items[itemId];
      if (!item) continue;
      if (item.id === 'backpack') continue;

      nodes.push({
        id: item.id,
        label: item.name,
        kind: item.kind || 'item',
        isRoot: false,
        nx: 0.5,
        ny: 0.5,
        color: item.kind === 'card' ? '--green' : '--text'
      });

      /* Связь предмета с рюкзаком. */
      if (backpack) {
        edges.push({ from: 'backpack', to: item.id, label: 'в рюкзаке' });
      }
    }

    /* Связи между предметами: например, карта «Очарование» — способность. */
    const angelIdx = nodes.findIndex((n) => n.id === 'card_angel');
    const chalkIdx = nodes.findIndex((n) => n.id === 'chalk');
    if (angelIdx >= 0 && chalkIdx >= 0) {
      edges.push({ from: 'card_angel', to: 'chalk', label: 'синергия' });
    }

    return { nodes, edges };
  }

  function positionGraph(graph) {
    const { nodes, edges } = graph;
    const root = nodes.find((n) => n.isRoot);
    if (!root) return;

    /* Располагаем корень в центре, остальные по кругу вокруг него. */
    const outer = nodes.filter((n) => !n.isRoot);
    const count = outer.length;
    if (count === 0) return;

    const step = (2 * Math.PI) / Math.max(1, count);
    for (let i = 0; i < count; i++) {
      const angle = i * step - Math.PI / 2;
      const nx = 0.5 + Math.cos(angle) * 0.35;
      const ny = 0.5 + Math.sin(angle) * 0.35;
      outer[i].nx = ZQ.clamp(nx, 0.1, 0.9);
      outer[i].ny = ZQ.clamp(ny, 0.1, 0.9);
    }
  }

  function renderInventoryGraph() {
    const container = dom.inventoryGraph;
    if (!container) return;
    container.textContent = '';

    const graph = buildInventoryGraph();
    positionGraph(graph);
    rt.state.inventoryGraph = graph;

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.className = 'inv-graph-svg';
    svg.setAttribute('width', '100%');
    svg.setAttribute('height', '100%');
    container.appendChild(svg);

    /* Рисуем рёбра. */
    for (const edge of graph.edges) {
      const fromNode = graph.nodes.find((n) => n.id === edge.from);
      const toNode = graph.nodes.find((n) => n.id === edge.to);
      if (!fromNode || !toNode) continue;

      const x1 = fromNode.nx * 100;
      const y1 = fromNode.ny * 100;
      const x2 = toNode.nx * 100;
      const y2 = toNode.ny * 100;

      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', `${x1}%`);
      line.setAttribute('y1', `${y1}%`);
      line.setAttribute('x2', `${x2}%`);
      line.setAttribute('y2', `${y2}%`);
      line.setAttribute('stroke', 'rgba(196, 204, 193, 0.35)');
      line.setAttribute('stroke-width', '2');
      svg.appendChild(line);
    }

    /* Рисуем узлы. */
    for (const node of graph.nodes) {
      const el = document.createElement('div');
      el.className = 'inv-graph-node';
      el.style.left = `${node.nx * 100}%`;
      el.style.top = `${node.ny * 100}%`;
      el.style.transform = 'translate(-50%, -50%)';
      el.style.setProperty('--node-color', `var(${node.color || '--text'})`);

      const dot = document.createElement('div');
      dot.className = 'inv-graph-dot';
      el.appendChild(dot);

      const label = document.createElement('div');
      label.className = 'inv-graph-label';
      label.textContent = node.label;
      el.appendChild(label);

      if (node.kind === 'card' && C.items[node.id] && C.items[node.id].art) {
        const img = document.createElement('img');
        img.src = C.items[node.id].art;
        img.alt = '';
        img.className = 'inv-graph-art';
        el.appendChild(img);
      }

      el.addEventListener('click', (event) => {
        event.stopPropagation();
        if (node.id === 'backpack') {
          ZQ.appendLog('Рюкзак — главный контейнер инвентаря.', 'sys', true);
          return;
        }
        const item = C.items[node.id];
        if (!item) return;
        ZQ.appendLog(`${item.name}: ${item.description}`, 'sys', true);
        if (item.command) {
          ZQ.appendLog(`Команда: «${item.command}»`, 'reply', true);
        }
      });

      container.appendChild(el);
    }

    const note = document.createElement('div');
    note.className = 'inv-graph-note';
    const total = rt.state.items.length;
    note.textContent = total
      ? `Предметов в инвентаре: ${total}. Узлы — предметы, рёбра — связи.`
      : 'Инвентарь пуст. Найди рюкзак, чтобы начать собирать предметы.';
    container.appendChild(note);
  }

  function openInventory() {
    if (ZQ.isTrialBlocking()) return;
    if (!ZQ.hasUnlock('backpack')) {
      ZQ.appendLog(ZQ.denyLocked('backpack'), 'sys', true);
      return;
    }
    ZQ.ensureTerminalShare(0.42);
    renderInventoryGraph();
    ZQ.setTerminalView('inventory');
  }

  function closeInventory() {
    ZQ.setTerminalView('main');
    ZQ.updatePrompt();
  }

  dom.inventoryClose.addEventListener('click', closeInventory);

  ZQ.renderInventoryGraph = renderInventoryGraph;
  ZQ.renderInventory = renderInventoryGraph;
  ZQ.openInventory = openInventory;
  ZQ.closeInventory = closeInventory;
  ZQ.buildInventoryGraph = buildInventoryGraph;
})();
