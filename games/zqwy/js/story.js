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

  function createNode(id, depth, seen, states, order) {
    const node = C.storyTree.nodes[id];
    if (!node) return null;
    if (seen.has(id)) {
      const ref = document.createElement('div');
      ref.className = 'story-ref';
      ref.textContent = `↳ ${node.title} · общий узел`;
      return ref;
    }
    seen.add(id);
    const state = states.get(id);
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
    flag.textContent = state.done ? 'пройдено' : state.available ? 'сейчас' : 'закрыто';
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
      label.textContent = 'находки';
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
      label.textContent = 'ищешь';
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

    if (node.children && node.children.length) {
      const children = document.createElement('div');
      children.className = 'story-children';
      for (const child of node.children) {
        const childNode = createNode(child, depth + 1, seen, states, order);
        if (childNode) children.appendChild(childNode);
      }
      card.appendChild(children);
    }
    return card;
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
    stageLabel.textContent = 'текущий этап';
    const stageValue = document.createElement('b');
    stageValue.textContent = currentStage;
    stage.appendChild(stageLabel);
    stage.appendChild(stageValue);
    top.appendChild(stage);

    const stateLabel = document.createElement('div');
    stateLabel.className = 'story-current-state';
    stateLabel.textContent = available.length
      ? `доступно узлов: ${available.length}`
      : 'все доступные узлы пройдены';
    top.appendChild(stateLabel);
    summary.appendChild(top);

    const goal = document.createElement('div');
    goal.className = 'story-goal';
    const goalLabel = document.createElement('span');
    goalLabel.className = 'story-summary-label';
    goalLabel.textContent = 'что ищешь';
    goal.appendChild(goalLabel);
    const goals = [];
    for (const node of available) {
      for (const item of node.seeking || []) {
        if (!goals.includes(item)) goals.push(item);
      }
    }
    const goalText = document.createElement('div');
    goalText.className = 'story-goal-text';
    goalText.textContent = goals.length ? goals.join(' · ') : 'Ветвь пройдена. Можно перечитать её или начать новый Лабиринт.';
    goal.appendChild(goalText);
    summary.appendChild(goal);

    const finds = document.createElement('div');
    finds.className = 'story-finds';
    const findsLabel = document.createElement('span');
    findsLabel.className = 'story-summary-label';
    findsLabel.textContent = 'доступные находки';
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
      empty.textContent = 'новых находок не осталось';
      findWrap.appendChild(empty);
    }
    finds.appendChild(findWrap);
    summary.appendChild(finds);

    dom.storyNow.appendChild(summary);

    const trail = document.createElement('div');
    trail.className = 'story-trail';
    const seen = new Set();
    for (const root of tree.roots) {
      const node = createNode(root, 0, seen, states, order);
      if (node) trail.appendChild(node);
    }
    dom.storyTree.appendChild(trail);
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
