/* Сюжет: карточки-сцены и читаемая ветвь истории (команда «сюжет»). */
(function () {
  'use strict';

  const ZQ = window.ZQ;
  const C = ZQ.C;
  const rt = ZQ.rt;
  const dom = ZQ.dom;

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

  function pumpStory() {
    if (rt.storyActive || !rt.storyQueue.length) return;
    const entry = rt.storyQueue.shift();
    const story = C.story[entry.key];
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

  function stageOrder() {
    const order = [];
    for (const node of Object.values(C.storyTree.nodes)) {
      if (!order.includes(node.stage)) order.push(node.stage);
    }
    return order;
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

  /* Раскладка графа: колонка на глубину ветви, карточки по центру
     колонки. Линии рисуются после измерения реальной высоты карточек. */
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

    const padX = 24;
    const padY = 20;
    const columnGap = 232;
    const rowGap = 18;
    const nodeWidth = 176;
    const levels = Array.from(columns.keys()).sort((a, b) => a - b);
    const maxDepth = levels.length ? levels[levels.length - 1] : 0;
    const positions = new Map();

    for (const level of levels) {
      const ids = columns.get(level);
      const entries = [];
      for (const id of ids) {
        const node = tree.nodes[id];
        const state = states.get(id);
        const card = createStoryCard(id, node, state);
        card.style.left = `${padX + level * columnGap}px`;
        card.style.top = '0px';
        board.appendChild(card);
        const height = card.offsetHeight || Math.max(86, 58 + (node.summary ? 24 : 0) +
          (node.finds ? 20 : 0) + (node.seeking ? 18 : 0) + (node.hint ? 22 : 0));
        entries.push({ id, card, height });
      }
      columns.set(level, entries);
    }

    let tallest = 0;
    for (const entries of columns.values()) {
      const total = entries.reduce((sum, entry) => sum + entry.height, 0) +
        rowGap * Math.max(0, entries.length - 1);
      tallest = Math.max(tallest, total);
    }

    for (const [level, entries] of columns) {
      const total = entries.reduce((sum, entry) => sum + entry.height, 0) +
        rowGap * Math.max(0, entries.length - 1);
      let y = padY + (tallest - total) / 2;
      for (const entry of entries) {
        entry.card.style.top = `${y}px`;
        positions.set(entry.id, {
          x: padX + level * columnGap,
          y,
          width: nodeWidth,
          height: entry.height
        });
        y += entry.height + rowGap;
      }
    }

    const boardWidth = Math.max(padX * 2 + maxDepth * columnGap + nodeWidth, 680);
    const boardHeight = Math.max(padY * 2 + tallest, 340);
    board.style.width = `${boardWidth}px`;
    board.style.height = `${boardHeight}px`;
    svg.setAttribute('width', String(boardWidth));
    svg.setAttribute('height', String(boardHeight));
    svg.setAttribute('viewBox', `0 0 ${boardWidth} ${boardHeight}`);

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
        const x1 = parentPos.x + parentPos.width;
        const y1 = parentPos.y + parentPos.height / 2;
        const x2 = childPos.x - 2;
        const y2 = childPos.y + childPos.height / 2;
        const curve = Math.max(28, (x2 - x1) * 0.42);
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d',
          `M ${x1.toFixed(1)} ${y1.toFixed(1)} ` +
          `C ${(x1 + curve).toFixed(1)} ${y1.toFixed(1)}, ` +
          `${(x2 - curve).toFixed(1)} ${y2.toFixed(1)}, ` +
          `${x2.toFixed(1)} ${y2.toFixed(1)}`);
        path.setAttribute('class', `story-edge${cls ? ` ${cls}` : ''}`);
        svg.appendChild(path);

        const arrow = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
        arrow.setAttribute('points',
          `${x2.toFixed(1)},${y2.toFixed(1)} ` +
          `${(x2 - 8).toFixed(1)},${(y2 - 4).toFixed(1)} ` +
          `${(x2 - 8).toFixed(1)},${(y2 + 4).toFixed(1)}`);
        arrow.setAttribute('class', `story-edge-arrow${cls ? ` ${cls}` : ''}`);
        svg.appendChild(arrow);
      }
    }

    return board;
  }

  function renderStory() {
    if (!dom.storyTree || !dom.storyNow) return;
    dom.storyTree.textContent = '';
    dom.storyNow.textContent = '';

    const tree = C.storyTree;
    const states = nodeStates();
    const order = stageOrder();
    const available = [];
    let lastDoneStage = '';
    for (const id of Object.keys(tree.nodes)) {
      const node = tree.nodes[id];
      const state = states.get(id);
      if (state.available && !node.optional) available.push(node);
      if (state.done) {
        const index = order.indexOf(node.stage);
        if (index > order.indexOf(lastDoneStage)) lastDoneStage = node.stage;
      }
    }

    const currentStage = available.length
      ? available.reduce((best, node) =>
        order.indexOf(node.stage) > order.indexOf(best) ? node.stage : best,
      available[0].stage)
      : (lastDoneStage || order[0]);

    const summary = document.createElement('div');
    summary.className = 'story-summary';

    const top = document.createElement('div');
    top.className = 'story-summary-top';
    const stage = document.createElement('div');
    stage.className = 'story-current-stage';
    const stageLabel = document.createElement('span');
    stageLabel.className = 'story-summary-label';
    stageLabel.textContent = ZQ.tr('текущий этап');
    const stageValue = document.createElement('b');
    stageValue.textContent = currentStage;
    stage.appendChild(stageLabel);
    stage.appendChild(stageValue);
    top.appendChild(stage);

    const stateLabel = document.createElement('div');
    stateLabel.className = 'story-current-state';
    stateLabel.textContent = available.length
      ? `${ZQ.tr('доступно узлов')}: ${available.length}`
      : ZQ.tr('все доступные узлы пройдены');
    top.appendChild(stateLabel);
    summary.appendChild(top);

    const goal = document.createElement('div');
    goal.className = 'story-goal';
    const goalLabel = document.createElement('span');
    goalLabel.className = 'story-summary-label';
    goalLabel.textContent = ZQ.tr('что ищешь');
    goal.appendChild(goalLabel);
    const goals = [];
    for (const node of available) {
      for (const item of node.seeking || []) {
        if (!goals.includes(item)) goals.push(item);
      }
    }
    const goalText = document.createElement('div');
    goalText.className = 'story-goal-text';
    goalText.textContent = goals.length
      ? goals.join(' · ')
      : ZQ.tr('Ветвь пройдена. Можно перечитать её или начать новый Лабиринт.');
    goal.appendChild(goalText);
    summary.appendChild(goal);

    const finds = document.createElement('div');
    finds.className = 'story-finds';
    const findsLabel = document.createElement('span');
    findsLabel.className = 'story-summary-label';
    findsLabel.textContent = ZQ.tr('доступные находки');
    finds.appendChild(findsLabel);
    const findList = [];
    for (const node of available) {
      for (const item of node.finds || []) {
        if (!findList.includes(item)) findList.push(item);
      }
    }
    const findWrap = document.createElement('div');
    findWrap.className = 'story-find-chips';
    if (findList.length) {
      for (const find of findList) {
        const chip = document.createElement('span');
        chip.className = 'story-find-chip';
        chip.textContent = find;
        findWrap.appendChild(chip);
      }
    } else {
      const empty = document.createElement('span');
      empty.className = 'story-empty';
      empty.textContent = ZQ.tr('новых находок не осталось');
      findWrap.appendChild(empty);
    }
    finds.appendChild(findWrap);
    summary.appendChild(finds);

    dom.storyNow.appendChild(summary);

    layoutStoryGraph(tree, states, dom.storyTree);
  }

  function openStory() {
    if (ZQ.isTrialBlocking()) return;
    ZQ.ensureTerminalShare(0.56);
    ZQ.setTerminalView('story');
    ZQ.resetKeys();
  }

  function closeStory() {
    ZQ.setTerminalView('main');
    ZQ.updatePrompt();
  }

  dom.storyClose.addEventListener('click', closeStory);

  window.addEventListener('resize', () => {
    if (rt.termView === 'story') renderStory();
  });

  ZQ.queueStory = queueStory;
  ZQ.clearStoryQueue = clearStoryQueue;
  ZQ.renderStory = renderStory;
  ZQ.openStory = openStory;
  ZQ.closeStory = closeStory;
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
