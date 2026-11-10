/* Сюжет: карточки-сцены и читаемая ветвь истории (команда «сюжет»). */
(function () {
  'use strict';

  const ZQ = window.ZQ;
  const C = ZQ.C;
  const rt = ZQ.rt;
  const dom = ZQ.dom;

  const ZOOM_MIN = 0.22;
  const ZOOM_MAX = 3.2;
  const NODE_WIDTH = 176;

  function queueStory(key, onClose, force) {
    const story = C.story[key];
    if (!story) {
      if (onClose) onClose();
      return;
    }
    if (!force && rt.state.storySeen[key]) {
      if (onClose) onClose();
      return;
    }
    rt.storyQueue.push({ key, onClose });
    pumpStory();
  }

  /* Процедурные сюжетные комнаты не входят в C.story: генератор
     выбирает сцену по индексу, а не по имени роли. Показываем каждую
     такую сцену один раз, как и обычные сюжетные комнаты. */
  function queueProceduralStory(room) {
    if (!room || !Array.isArray(C.proceduralStories)) return false;
    const story = C.proceduralStories[room.storyIndex];
    if (!story) return false;
    const key = `procedural:${room.storyIndex}`;
    if (rt.state.storySeen[key]) return false;
    rt.storyQueue.push({ key, story });
    pumpStory();
    return true;
  }

  function pumpStory() {
    if (rt.storyActive || !rt.storyQueue.length) return;
    const entry = rt.storyQueue.shift();
    const story = entry.story || C.story[entry.key];
    if (!story) {
      if (entry.onClose) entry.onClose();
      pumpStory();
      return;
    }
    rt.storyActive = true;
    rt.state.storySeen[entry.key] = true;
    ZQ.saveGame();

    ZQ.appendLog(story.title, 'sys', true, 'сцена');
    const speaker = story.speaker || 'ЛАБИРИНТ';
    for (const line of story.lines) {
      ZQ.appendLog(line, 'story', false, speaker);
    }

    ZQ.whenLogsIdle(() => {
      rt.storyActive = false;
      if (entry.onClose) {
        try {
          entry.onClose();
        } catch (error) {
          console.error(error);
        }
      }
      pumpStory();
    });
  }

  function clearStoryQueue() {
    rt.storyQueue.length = 0;
    rt.storyActive = false;
  }

  function conditionMet(condition) {
    if (!condition) return false;
    const state = rt.state;
    if (condition.story) return Boolean(state.storySeen[condition.story]);
    if (condition.flag) return Boolean(state.flags[condition.flag]);
    if (condition.item) return state.items.includes(condition.item);
    if (condition.visited) return Boolean(state.visited[condition.visited]);
    if (condition.unlock) return ZQ.hasUnlock(condition.unlock);
    if (condition.binding) {
      return state.canvasElements.some((element) =>
        element.kind === 'key' && Array.isArray(element.links) && element.links.length > 0
      );
    }
    if (condition.death) return (state.deaths || 0) > 0;
    return false;
  }

  function nodeStates() {
    const tree = C.storyTree;
    const states = new Map();
    for (const id of Object.keys(tree.nodes)) {
      const node = tree.nodes[id];
      const done = conditionMet(node.complete);
      const parents = node.parents || [];
      let unlocked = parents.length === 0;
      if (parents.length) {
        const met = parents.map((parent) => {
          const parentNode = tree.nodes[parent];
          return parentNode ? conditionMet(parentNode.complete) : false;
        });
        unlocked = node.parentMode === 'any' ? met.some(Boolean) : met.every(Boolean);
      }
      states.set(id, {
        done,
        available: !done && unlocked,
        locked: !done && !unlocked
      });
    }
    return states;
  }

  function createStoryCard(id, node, state) {
    const card = document.createElement('article');
    card.className = 'story-node';
    card.dataset.node = id;
    if (state.done) card.classList.add('done');
    else if (state.available) card.classList.add('available');
    else card.classList.add('locked');
    if (node.optional) card.classList.add('optional');

    const head = document.createElement('header');
    head.className = 'story-node-head';
    const dot = document.createElement('span');
    dot.className = 'story-node-dot';
    dot.setAttribute('aria-hidden', 'true');
    head.appendChild(dot);

    const heading = document.createElement('div');
    heading.className = 'story-node-heading';
    const title = document.createElement('h3');
    title.textContent = node.title;
    heading.appendChild(title);
    const stage = document.createElement('span');
    stage.className = 'story-node-stage';
    stage.textContent = node.stage;
    heading.appendChild(stage);
    head.appendChild(heading);

    const flag = document.createElement('span');
    flag.className = 'story-node-flag';
    flag.textContent = state.done
      ? ZQ.tr('пройдено')
      : state.available ? ZQ.tr('сейчас') : ZQ.tr('закрыто');
    head.appendChild(flag);
    card.appendChild(head);

    const summary = document.createElement('p');
    summary.className = 'story-node-summary';
    summary.textContent = node.summary || '';
    card.appendChild(summary);

    if (node.finds && node.finds.length) {
      const row = document.createElement('div');
      row.className = 'story-node-row';
      const label = document.createElement('span');
      label.className = 'story-node-label';
      label.textContent = ZQ.tr('находки');
      row.appendChild(label);
      for (const find of node.finds) {
        const chip = document.createElement('span');
        chip.className = 'story-chip';
        chip.textContent = find;
        row.appendChild(chip);
      }
      card.appendChild(row);
    }

    if (node.seeking && node.seeking.length) {
      const row = document.createElement('div');
      row.className = 'story-node-row seeking';
      const label = document.createElement('span');
      label.className = 'story-node-label';
      label.textContent = ZQ.tr('ищешь');
      row.appendChild(label);
      const text = document.createElement('span');
      text.className = 'story-seeking';
      text.textContent = node.seeking.join(' · ');
      row.appendChild(text);
      card.appendChild(row);
    }

    if (node.hint && (state.available || (!state.done && !node.optional))) {
      const hint = document.createElement('p');
      hint.className = 'story-node-hint';
      hint.textContent = node.hint;
      card.appendChild(hint);
    }
    return card;
  }

  function drawStoryEdges(svg, order, tree, states, positions) {
    svg.textContent = '';
    for (const parentId of order) {
      const parent = tree.nodes[parentId];
      const parentPos = positions.get(parentId);
      if (!parentPos) continue;
      const parentState = states.get(parentId);
      for (const childId of parent.children || []) {
        const childPos = positions.get(childId);
        if (!childPos) continue;
        const childState = states.get(childId);
        const cls = childState.done && parentState.done
          ? 'done'
          : childState.available ? 'available' : '';

        /* Карточки можно свободно перетаскивать, поэтому связь сама
           выбирает сторону: если ребёнок левее родителя, стрелка идёт
           влево, иначе — вправо. */
        const rightward = (childPos.x + childPos.width / 2) >=
          (parentPos.x + parentPos.width / 2);
        const x1 = rightward ? parentPos.x + parentPos.width : parentPos.x;
        const x2 = rightward ? childPos.x : childPos.x + childPos.width;
        const y1 = parentPos.y + parentPos.height / 2;
        const y2 = childPos.y + childPos.height / 2;
        const curve = Math.max(30, Math.abs(x2 - x1) * 0.42);

        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d',
          `M ${x1.toFixed(1)} ${y1.toFixed(1)} ` +
          `C ${(x1 + (rightward ? curve : -curve)).toFixed(1)} ${y1.toFixed(1)}, ` +
          `${(x2 + (rightward ? -curve : curve)).toFixed(1)} ${y2.toFixed(1)}, ` +
          `${x2.toFixed(1)} ${y2.toFixed(1)}`);
        path.setAttribute('class', `story-edge${cls ? ` ${cls}` : ''}`);
        svg.appendChild(path);

        const arrow = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
        const dir = rightward ? -1 : 1;
        arrow.setAttribute('points',
          `${x2.toFixed(1)},${y2.toFixed(1)} ` +
          `${(x2 + 8 * dir).toFixed(1)},${(y2 - 4).toFixed(1)} ` +
          `${(x2 + 8 * dir).toFixed(1)},${(y2 + 4).toFixed(1)}`);
        arrow.setAttribute('class', `story-edge-arrow${cls ? ` ${cls}` : ''}`);
        svg.appendChild(arrow);
      }
    }
  }

  function applyStoryView() {
    const board = rt.storyBoard;
    if (!board) return;
    board.style.transform =
      `translate(${rt.storyPanX.toFixed(2)}px, ${rt.storyPanY.toFixed(2)}px) ` +
      `scale(${rt.storyZoom.toFixed(4)})`;
  }

  /* Раскладка графа: колонка на глубину ветви, карточки по центру
     колонки. Карточки можно перетаскивать без ограничений, а пустое
     полотно — двигать левой кнопкой мыши. Колесо мыши приближает ту
     точку, над которой находится курсор. Позиции и вид живут в rt. */
  function layoutStoryGraph(tree, states, container) {
    const depth = new Map();
    const order = [];

    function visit(id, level) {
      if (!tree.nodes[id] || depth.has(id)) return;
      depth.set(id, level);
      order.push(id);
      const node = tree.nodes[id];
      for (const child of node.children || []) visit(child, level + 1);
    }
    for (const root of tree.roots) visit(root, 0);
    for (const id of Object.keys(tree.nodes)) visit(id, 0);

    const columns = new Map();
    for (const id of order) {
      const level = depth.get(id);
      if (!columns.has(level)) columns.set(level, []);
      columns.get(level).push(id);
    }

    const board = document.createElement('div');
    board.className = 'story-board';
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'story-edges');
    svg.setAttribute('aria-hidden', 'true');
    board.appendChild(svg);
    container.appendChild(board);
    rt.storyBoard = board;

    const padX = 24;
    const padY = 20;
    const columnGap = 232;
    const rowGap = 18;
    const levels = Array.from(columns.keys()).sort((a, b) => a - b);
    const entries = [];

    for (const level of levels) {
      const ids = columns.get(level);
      const columnEntries = [];
      for (const id of ids) {
        const node = tree.nodes[id];
        const state = states.get(id);
        const card = createStoryCard(id, node, state);
        card.style.left = `${padX + level * columnGap}px`;
        card.style.top = '0px';
        board.appendChild(card);
        const height = card.offsetHeight || Math.max(86, 58 + (node.summary ? 24 : 0) +
          (node.finds ? 20 : 0) + (node.seeking ? 18 : 0) + (node.hint ? 22 : 0));
        const entry = { id, card, height, level };
        columnEntries.push(entry);
        entries.push(entry);
      }
      columns.set(level, columnEntries);
    }

    let tallest = 0;
    for (const columnEntries of columns.values()) {
      const total = columnEntries.reduce((sum, entry) => sum + entry.height, 0) +
        rowGap * Math.max(0, columnEntries.length - 1);
      tallest = Math.max(tallest, total);
    }

    const defaults = new Map();
    for (const [level, columnEntries] of columns) {
      const total = columnEntries.reduce((sum, entry) => sum + entry.height, 0) +
        rowGap * Math.max(0, columnEntries.length - 1);
      let y = padY + (tallest - total) / 2;
      for (const entry of columnEntries) {
        defaults.set(entry.id, {
          x: padX + level * columnGap,
          y
        });
        y += entry.height + rowGap;
      }
    }

    const positions = new Map();
    for (const entry of entries) {
      const saved = rt.storyPositions[entry.id];
      const fallback = defaults.get(entry.id);
      const x = saved && Number.isFinite(saved.x) ? saved.x : fallback.x;
      const y = saved && Number.isFinite(saved.y) ? saved.y : fallback.y;
      entry.card.style.left = `${x}px`;
      entry.card.style.top = `${y}px`;
      positions.set(entry.id, {
        x,
        y,
        width: NODE_WIDTH,
        height: entry.height
      });
    }

    const redraw = () => drawStoryEdges(svg, order, tree, states, positions);

    for (const entry of entries) {
      entry.card.addEventListener('pointerdown', (event) => {
        if (event.button !== undefined && event.button !== 0) return;
        event.preventDefault();
        event.stopPropagation();
        if (window.getSelection) {
          const selection = window.getSelection();
          if (selection && selection.removeAllRanges) selection.removeAllRanges();
        }
        const start = positions.get(entry.id);
        if (!start) return;
        const drag = {
          id: entry.id,
          pointerId: event.pointerId,
          startX: event.clientX,
          startY: event.clientY,
          originX: start.x,
          originY: start.y
        };
        rt.storyDrag = drag;
        entry.card.classList.add('dragging');
        try {
          entry.card.setPointerCapture(event.pointerId);
        } catch (error) {
          /* capture не обязателен */
        }
        const move = (moveEvent) => {
          if (rt.storyDrag !== drag || moveEvent.pointerId !== drag.pointerId) return;
          moveEvent.preventDefault();
          /* Никаких рамок: карточку можно унести сколько угодно далеко. */
          const x = drag.originX + moveEvent.clientX - drag.startX;
          const y = drag.originY + moveEvent.clientY - drag.startY;
          entry.card.style.left = `${x}px`;
          entry.card.style.top = `${y}px`;
          positions.set(entry.id, {
            x,
            y,
            width: NODE_WIDTH,
            height: entry.height
          });
          redraw();
        };
        const finish = (finishEvent) => {
          if (finishEvent.pointerId !== drag.pointerId) return;
          entry.card.removeEventListener('pointermove', move);
          entry.card.removeEventListener('pointerup', finish);
          entry.card.removeEventListener('pointercancel', finish);
          entry.card.classList.remove('dragging');
          if (rt.storyDrag === drag) rt.storyDrag = null;
          const pos = positions.get(entry.id);
          if (pos) rt.storyPositions[entry.id] = { x: pos.x, y: pos.y };
          try {
            entry.card.releasePointerCapture(finishEvent.pointerId);
          } catch (error) {
            /* ignored */
          }
        };
        entry.card.addEventListener('pointermove', move);
        entry.card.addEventListener('pointerup', finish);
        entry.card.addEventListener('pointercancel', finish);
      });
    }

    redraw();
    applyStoryView();
    return board;
  }

  function renderStory() {
    if (!dom.storyTree) return;
    const tree = C.storyTree;
    const states = nodeStates();
    dom.storyTree.textContent = '';
    rt.storyBoard = null;
    layoutStoryGraph(tree, states, dom.storyTree);
  }

  function openStory() {
    if (ZQ.isTrialBlocking()) return;
    ZQ.ensureTerminalShare(0.56);
    if (!Number.isFinite(rt.storyZoom) || rt.storyZoom <= 0) rt.storyZoom = 1;
    if (!Number.isFinite(rt.storyPanX)) rt.storyPanX = 0;
    if (!Number.isFinite(rt.storyPanY)) rt.storyPanY = 0;
    ZQ.setTerminalView('story');
    applyStoryView();
  }

  function closeStory() {
    ZQ.setTerminalView('main');
    ZQ.updatePrompt();
  }

  /* Сюжетный граф использует тот же Viewport, что стол и инвентарь:
     колесо приближает точку под курсором, фон двигается, двойной
     клик сбрасывает вид, щипок работает на телефоне. */
  function resetStoryView() {
    rt.storyZoom = 1;
    rt.storyPanX = 0;
    rt.storyPanY = 0;
    applyStoryView();
  }

  function bindStoryViewport() {
    if (!dom.storyTree) return;
    dom.storyTree.addEventListener('selectstart', (event) => {
      if (rt.termView === 'story') event.preventDefault();
    });
    dom.storyTree.addEventListener('dragstart', (event) => {
      if (rt.termView === 'story') event.preventDefault();
    });
    if (!ZQ.Viewport) return;
    ZQ.Viewport.attach({
      surface: dom.storyTree,
      content: () => rt.storyBoard || dom.storyTree,
      origin: '0 0',
      min: ZOOM_MIN,
      max: ZOOM_MAX,
      get: () => ({
        zoom: rt.storyZoom,
        panX: rt.storyPanX,
        panY: rt.storyPanY
      }),
      set: (state) => {
        rt.storyZoom = state.zoom;
        rt.storyPanX = state.panX;
        rt.storyPanY = state.panY;
      },
      onChange: () => applyStoryView(),
      onReset: resetStoryView,
      canStart: (event) => {
        if (!event.target.closest) return true;
        return !event.target.closest('.story-node');
      }
    });
  }

  dom.storyClose.addEventListener('click', closeStory);
  bindStoryViewport();

  window.addEventListener('resize', () => {
    if (rt.termView === 'story') renderStory();
  });

  ZQ.queueStory = queueStory;
  ZQ.queueProceduralStory = queueProceduralStory;
  ZQ.clearStoryQueue = clearStoryQueue;
  ZQ.renderStory = renderStory;
  ZQ.openStory = openStory;
  ZQ.closeStory = closeStory;
  ZQ.applyStoryView = applyStoryView;
  ZQ.storyInfo = function () {
    const states = nodeStates();
    return Array.from(states.entries()).map(([id, value]) => ({
      id,
      title: C.storyTree.nodes[id].title,
      stage: C.storyTree.nodes[id].stage,
      done: value.done,
      available: value.available,
      locked: value.locked
    }));
  };
})();
