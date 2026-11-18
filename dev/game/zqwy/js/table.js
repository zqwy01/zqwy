/* Стол: элементы, клавиши-векторы и живая схема управления.
   Клавиша — самостоятельный элемент. Она хранит код и список целей:
   A -> помоги, A -> инвентарь. Одна клавиша может запускать несколько целей. */
(function () {
  'use strict';

  const ZQ = window.ZQ;
  const C = ZQ.C;
  const rt = ZQ.rt;
  const dom = ZQ.dom;

  function tl(ru, en, de) {
    const code = window.ZQI18N && window.ZQI18N.lang ? window.ZQI18N.lang : 'ru';
    if (code === 'de') return de || en || ru;
    return code === 'en' ? (en || ru) : ru;
  }

  function keyLabel(code) {
    if (!code) return '—';
    const names = {
      ArrowUp: '↑',
      ArrowDown: '↓',
      ArrowLeft: '←',
      ArrowRight: '→',
      Space: 'ПРОБЕЛ',
      Enter: 'ENTER',
      Escape: 'ESC',
      Tab: 'TAB',
      CapsLock: 'CAPS',
      ShiftLeft: 'SHIFT',
      ShiftRight: 'SHIFT',
      ControlLeft: 'CTRL',
      ControlRight: 'CTRL',
      AltLeft: 'ALT',
      AltRight: 'ALT',
      MetaLeft: 'META',
      MetaRight: 'META',
      Backspace: 'BACKSPACE',
      Backquote: '`',
      Minus: '-',
      Equal: '=',
      BracketLeft: '[',
      BracketRight: ']',
      Backslash: '\\',
      Semicolon: ';',
      Quote: "'",
      Comma: ',',
      Period: '.',
      Slash: '/'
    };
    if (names[code]) return names[code];
    if (code.startsWith('Key')) return code.slice(3);
    if (code.startsWith('Digit')) return code.slice(5);
    if (code.startsWith('Numpad')) return `NUM ${code.slice(6)}`;
    if (code.startsWith('F') && Number(code.slice(1)) > 0) return code;
    return code.toUpperCase();
  }

  function hasItem(itemId) {
    return Boolean(rt.state && rt.state.items.includes(itemId));
  }

  function elementAvailable(element) {
    if (!element) return false;
    if (element.kind === 'key') return true;
    if (element.kind === 'control' && !actionUnlocked(element.action)) return false;
    if (element.itemId) return hasItem(element.itemId);
    if (element.requires && element.requires.length) {
      return element.requires.every((id) => hasItem(id));
    }
    return true;
  }

  function elementLabel(element) {
    if (!element) return 'элемент';
    if (element.kind === 'key') return keyLabel(element.code);
    return element.label || element.command || 'элемент';
  }

  function nextCanvasSpot() {
    const count = rt.state.canvasElements.length;
    const columns = 3;
    const col = count % columns;
    const row = Math.floor(count / columns) % 3;
    return {
      nx: 0.24 + col * 0.26 + (Math.random() - 0.5) * 0.04,
      ny: 0.23 + row * 0.24 + (Math.random() - 0.5) * 0.04
    };
  }

  function createKeyElement(code) {
    return {
      id: ZQ.makeId('cv'),
      kind: 'key',
      itemId: null,
      command: null,
      label: 'клавиша',
      sub: 'клавиша',
      action: null,
      code: typeof code === 'string' && code ? code : null,
      links: [],
      legacyKey: null,
      nx: 0.5,
      ny: 0.5,
      commands: null,
      requires: []
    };
  }

  function keyElements() {
    return rt.state.canvasElements.filter((element) => element.kind === 'key');
  }

  function keyForCode(code) {
    return rt.state.canvasElements.find((element) =>
      element.kind === 'key' && element.code === code
    ) || null;
  }

  function linkedKeys(elementId) {
    return rt.state.canvasElements.filter((element) =>
      element.kind === 'key' && Array.isArray(element.links) && element.links.includes(elementId)
    );
  }

  function clearKeyCode(code, exceptId) {
    if (!code) return;
    for (const element of rt.state.canvasElements) {
      if (element.kind === 'key' && element.code === code && element.id !== exceptId) {
        element.code = null;
      }
    }
  }

  const CONTROL_UNLOCKS = {
    inventory: 'backpack',
    map: 'map',
    canvas: 'table'
  };

  function actionUnlocked(action) {
    const lock = CONTROL_UNLOCKS[action];
    return !lock || ZQ.hasUnlock(lock);
  }

  /* Настоящие линии связи: SVG лежит в системе координат стола,
     поэтому линии масштабируются вместе с элементами. */
  function canvasNodeFor(id) {
    if (!dom.canvasElements) return null;
    return dom.canvasElements.querySelector(`.cv-el[data-id="${id}"]`);
  }

  function rayToBox(cx, cy, halfW, halfH, dx, dy) {
    const tx = Math.abs(dx) < 0.0001 ? Infinity : halfW / Math.abs(dx);
    const ty = Math.abs(dy) < 0.0001 ? Infinity : halfH / Math.abs(dy);
    const scale = Math.min(tx, ty);
    if (!Number.isFinite(scale)) return { x: cx, y: cy };
    return { x: cx + dx * scale, y: cy + dy * scale };
  }

  function renderCanvasLinks() {
    const svg = dom.canvasLinks;
    const stage = dom.canvasStage;
    if (!svg || !stage) return;
    svg.textContent = '';

    const width = Math.max(1, stage.clientWidth || dom.canvasWorkspace.clientWidth || 1);
    const height = Math.max(1, stage.clientHeight || dom.canvasWorkspace.clientHeight || 1);
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    svg.setAttribute('width', String(width));
    svg.setAttribute('height', String(height));

    for (const key of keyElements()) {
      if (!Array.isArray(key.links) || !key.links.length) continue;
      const sourceNode = canvasNodeFor(key.id);
      const sx = key.nx * width;
      const sy = key.ny * height;
      const shw = (sourceNode ? sourceNode.offsetWidth : 46) / 2;
      const shh = (sourceNode ? sourceNode.offsetHeight : 34) / 2;

      for (const targetId of key.links) {
        const target = rt.state.canvasElements.find((element) => element.id === targetId);
        if (!target) continue;
        const targetNode = canvasNodeFor(target.id);
        const tx = target.nx * width;
        const ty = target.ny * height;
        const dx = tx - sx;
        const dy = ty - sy;
        const length = Math.hypot(dx, dy);
        if (length < 1) continue;
        const ux = dx / length;
        const uy = dy / length;
        const thw = (targetNode ? targetNode.offsetWidth : 96) / 2;
        const thh = (targetNode ? targetNode.offsetHeight : 42) / 2;
        const start = rayToBox(sx, sy, shw, shh, ux, uy);
        const end = rayToBox(tx, ty, thw, thh, -ux, -uy);

        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('x1', start.x.toFixed(1));
        line.setAttribute('y1', start.y.toFixed(1));
        line.setAttribute('x2', end.x.toFixed(1));
        line.setAttribute('y2', end.y.toFixed(1));
        line.setAttribute('class', `link-arrow${key.id === rt.linkFirstId ? ' selected' : ''}`);
        svg.appendChild(line);

        const angle = Math.atan2(uy, ux);
        const size = 6;
        const backX = end.x - Math.cos(angle) * size;
        const backY = end.y - Math.sin(angle) * size;
        const spread = 0.48;
        const head = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
        head.setAttribute('points', [
          `${end.x.toFixed(1)},${end.y.toFixed(1)}`,
          `${(backX + Math.cos(angle + spread) * size).toFixed(1)},${(backY + Math.sin(angle + spread) * size).toFixed(1)}`,
          `${(backX + Math.cos(angle - spread) * size).toFixed(1)},${(backY + Math.sin(angle - spread) * size).toFixed(1)}`
        ].join(' '));
        head.setAttribute('class', `link-head${key.id === rt.linkFirstId ? ' selected' : ''}`);
        svg.appendChild(head);

        const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        dot.setAttribute('cx', start.x.toFixed(1));
        dot.setAttribute('cy', start.y.toFixed(1));
        dot.setAttribute('r', '2.4');
        dot.setAttribute('class', 'link-dot');
        svg.appendChild(dot);

        const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        label.setAttribute('x', ((start.x + end.x) / 2).toFixed(1));
        label.setAttribute('y', (((start.y + end.y) / 2) - 4).toFixed(1));
        label.setAttribute('text-anchor', 'middle');
        label.setAttribute('class', 'link-key');
        label.textContent = keyLabel(key.code);
        svg.appendChild(label);
      }
    }
  }

  /* Старые сохранения держали клавишу на каждом элементе. При загрузке
     такая клавиша становится отдельным элементом, а бывший владелец —
     целью ссылки. */
  function normalizeTableBindings() {
    if (!rt.state || !Array.isArray(rt.state.canvasElements)) return;
    const elements = rt.state.canvasElements;

    for (const element of elements) {
      if (element.kind !== 'key') {
        delete element.key;
      }
    }

    const legacy = [];
    for (const element of elements) {
      if (element.kind === 'key') {
        if (!element.code && element.legacyKey) element.code = element.legacyKey;
        element.legacyKey = null;
        continue;
      }
      if (element.legacyKey) {
        legacy.push({ element, code: element.legacyKey });
        element.legacyKey = null;
      }
    }

    for (const entry of legacy) {
      let key = elements.find((element) =>
        element.kind === 'key' && element.code === entry.code
      );
      if (!key) {
        key = createKeyElement(entry.code);
        const spot = nextCanvasSpot();
        key.nx = spot.nx;
        key.ny = spot.ny;
        elements.push(key);
      }
      if (!Array.isArray(key.links)) key.links = [];
      if (!key.links.includes(entry.element.id)) key.links.push(entry.element.id);
    }

    const byId = new Map(elements.map((element) => [element.id, element]));
    const usedCodes = new Set();
    for (const element of elements) {
      if (element.kind !== 'key') {
        delete element.code;
        delete element.links;
        continue;
      }
      element.label = element.label || 'клавиша';
      element.sub = 'клавиша';
      element.command = null;
      element.itemId = null;
      element.requires = [];
      if (!Array.isArray(element.links)) element.links = [];
      element.links = Array.from(new Set(element.links)).filter((id) =>
        id !== element.id && byId.has(id) && byId.get(id).kind !== 'key'
      );
      if (typeof element.code !== 'string' || !element.code) {
        element.code = null;
      } else if (usedCodes.has(element.code)) {
        element.code = null;
      } else {
        usedCodes.add(element.code);
      }
    }
  }

  function setCanvasReply(command, reply) {
    dom.canvasResponseCommand.textContent = command || 'готово';
    dom.canvasResponseReply.textContent = reply || '';
  }

  function canvasKindForItem(item) {
    if (item.kind === 'card' && item.art) return 'card';
    if (item.kind === 'map') return 'map';
    return 'command';
  }

  function makeElementForItem(item) {
    const kind = canvasKindForItem(item);
    let sub = 'команда';
    if (kind === 'card') sub = 'способность';
    else if (kind === 'map') sub = 'карта';
    else if (item.kind === 'tool') sub = 'инструмент';
    return {
      id: ZQ.makeId('cv'),
      kind,
      itemId: item.id,
      command: item.command || null,
      label: item.name,
      sub,
      action: null,
      code: null,
      links: [],
      legacyKey: null,
      nx: 0.5,
      ny: 0.5,
      commands: null,
      requires: [item.id]
    };
  }

  function makeElementForCommand(command) {
    return {
      id: ZQ.makeId('cv'),
      kind: 'command',
      itemId: null,
      command,
      label: command,
      sub: 'команда',
      action: null,
      code: null,
      links: [],
      legacyKey: null,
      nx: 0.5,
      ny: 0.5,
      commands: null,
      requires: []
    };
  }

  function makeElementForControl(action) {
    const meta = C.controlActions && C.controlActions[action];
    if (!meta) return null;
    return {
      id: ZQ.makeId('cv'),
      kind: 'control',
      itemId: null,
      command: meta.command || null,
      label: meta.label,
      sub: 'кнопка управления',
      action,
      code: null,
      links: [],
      legacyKey: null,
      nx: 0.5,
      ny: 0.5,
      commands: null,
      requires: []
    };
  }

  function commandsForElement(element) {
    if (!element) return [];
    if (element.kind === 'seq') return (element.commands || []).slice();
    if (element.command) return [element.command];
    if (element.itemId && C.items[element.itemId] && C.items[element.itemId].command) {
      return [C.items[element.itemId].command];
    }
    return [];
  }

  function requiresForElement(element) {
    const result = new Set(element.requires || []);
    if (element.itemId) result.add(element.itemId);
    return Array.from(result);
  }

  function runControlElement(element) {
    if (!element || element.kind !== 'control') return 'Это не кнопка управления.';
    const meta = C.controlActions && C.controlActions[element.action];
    if (!meta) return 'Кнопка управления не настроена.';
    if (!actionUnlocked(element.action)) {
      return ZQ.denyLocked(CONTROL_UNLOCKS[element.action]);
    }

    if (element.action === 'inventory') {
      closeCanvas();
      ZQ.handleCommand('инвентарь', 'terminal');
      return 'Инвентарь открыт.';
    }
    if (element.action === 'map') {
      closeCanvas();
      ZQ.handleCommand('карта', 'terminal');
      return 'Карта открыта.';
    }
    if (element.action === 'canvas') {
      closeCanvas();
      return 'Ты выходишь из-за стола.';
    }
    return ZQ.handleCommand(meta.command, 'canvas') || 'Готово.';
  }

  function executeTarget(element, source) {
    if (!element) return '';
    if (!elementAvailable(element)) {
      return 'Недоступно: предмет остался в рюкзаке на месте смерти.';
    }
    if (element.kind === 'control') return runControlElement(element);
    const commands = commandsForElement(element);
    if (!commands.length) return 'У этого элемента нет команды.';
    const replies = [];
    for (const command of commands) {
      const reply = ZQ.handleCommand(command, source || 'canvas');
      if (reply) replies.push(reply);
    }
    return replies.filter(Boolean).join(' ');
  }

  function executeKeyElement(element) {
    if (!element || element.kind !== 'key') return '';
    const targets = element.links
      .map((id) => rt.state.canvasElements.find((el) => el.id === id))
      .filter(Boolean);
    const name = keyLabel(element.code);
    if (!targets.length) {
      setCanvasReply(name, 'Клавиша пока ни с чем не связана. Включи «связать» и выбери цели.');
      return '';
    }
    /* Клавиша — это не клик по столу: она должна открывать и закрывать
       разделы так же, как команда из терминала. Поэтому источник
       помечается как терминал, а ответ всё равно остаётся на столе. */
    const replies = targets.map((target) => executeTarget(target, 'terminal')).filter(Boolean);
    setCanvasReply(
      `${name} → ${targets.map(elementLabel).join(', ')}`,
      replies.join(' ') || 'Готово.'
    );
    return replies.join(' ');
  }

  function runElement(element) {
    if (!element) return;
    if (rt.canvasLinkMode) {
      handleLinkClick(element);
      return;
    }
    if (element.kind === 'key') {
      executeKeyElement(element);
      return;
    }
    const reply = executeTarget(element);
    setCanvasReply(elementLabel(element), reply || 'Готово.');
  }

  function addItemElement(itemId, openAfter) {
    const item = C.items[itemId];
    if (!item) return null;
    const existing = rt.state.canvasElements.find((element) => element.itemId === itemId);
    if (existing) {
      ZQ.appendLog(`«${item.name}» уже на столе`, 'sys', true);
      if (openAfter) openCanvas();
      return existing;
    }
    const element = makeElementForItem(item);
    const spot = nextCanvasSpot();
    element.nx = spot.nx;
    element.ny = spot.ny;
    rt.state.canvasElements.push(element);
    ZQ.saveGame();
    if (openAfter) {
      openCanvas();
    } else {
      renderCanvasElements();
      renderCanvasDrawer();
    }
    setCanvasReply(item.name, 'Элемент добавлен. Свяжи его с клавишей или нажми на него.');
    return element;
  }

  function addCommandElement(command) {
    const element = makeElementForCommand(command);
    const spot = nextCanvasSpot();
    element.nx = spot.nx;
    element.ny = spot.ny;
    rt.state.canvasElements.push(element);
    ZQ.saveGame();
    renderCanvasElements();
    renderCanvasDrawer();
    setCanvasReply(command, 'Команда размещена. Свяжи её с клавишей или нажми на неё.');
    return element;
  }

  function addControlElement(action) {
    const element = makeElementForControl(action);
    if (!element) return null;
    const duplicate = rt.state.canvasElements.find((el) =>
      el.kind === 'control' && el.action === action
    );
    if (duplicate) {
      setCanvasReply(element.label, 'Кнопка уже на столе.');
      renderCanvasDrawer();
      return duplicate;
    }
    const spot = nextCanvasSpot();
    element.nx = spot.nx;
    element.ny = spot.ny;
    rt.state.canvasElements.push(element);
    ZQ.saveGame();
    renderCanvasElements();
    renderCanvasDrawer();
    setCanvasReply(
      element.label,
      'Кнопка добавлена без клавиши. Добавь клавишу и свяжи её с этой кнопкой.'
    );
    return element;
  }

  function addKeyElement(code) {
    const element = createKeyElement(typeof code === 'string' ? code : null);
    const spot = nextCanvasSpot();
    element.nx = spot.nx;
    element.ny = spot.ny;
    if (element.code) clearKeyCode(element.code, element.id);
    rt.state.canvasElements.push(element);
    ZQ.saveGame();
    renderCanvasElements();
    renderCanvasDrawer();
    renderKeyScheme();
    if (element.code) {
      setCanvasReply(
        keyLabel(element.code),
        'Клавиша добавлена. Включи «связать», выбери её, затем выбери цели.'
      );
    } else {
      startKeyBinding(element);
    }
    return element;
  }

  function removeCanvasElement(id) {
    rt.state.canvasElements = rt.state.canvasElements.filter((element) => element.id !== id);
    for (const element of rt.state.canvasElements) {
      if (element.kind === 'key' && Array.isArray(element.links)) {
        element.links = element.links.filter((targetId) => targetId !== id);
      }
    }
    if (rt.linkFirstId === id) rt.linkFirstId = null;
    if (rt.keyBindingId === id) rt.keyBindingId = null;
    ZQ.saveGame();
    renderCanvasElements();
    renderCanvasDrawer();
    renderKeyScheme();
  }

  function startKeyBinding(element) {
    if (!element || element.kind !== 'key') return;
    rt.keyBindingId = element.id;
    renderCanvasElements();
    renderKeyScheme();
    dom.canvasHint.textContent = 'Нажми нужную клавишу. Esc — отмена.';
    setCanvasReply(keyLabel(element.code), 'Выбери клавишу для этого элемента.');
  }

  function assignKeyCode(element, code) {
    if (!element || element.kind !== 'key') return false;
    if (code === 'Escape') {
      rt.keyBindingId = null;
      renderCanvasElements();
      renderKeyScheme();
      setCanvasReply('клавиша', 'Назначение отменено.');
      return false;
    }
    clearKeyCode(code, element.id);
    element.code = code;
    rt.keyBindingId = null;
    ZQ.saveGame();
    renderCanvasElements();
    renderCanvasDrawer();
    renderKeyScheme();
    setCanvasReply(
      keyLabel(code),
      'Клавиша назначена. Теперь свяжи её с командами: «связать» → клавиша → цели.'
    );
    return true;
  }

  function handleLinkClick(element) {
    if (!element) return;
    if (element.kind === 'key') {
      if (rt.linkFirstId === element.id) {
        rt.linkFirstId = null;
        setCanvasReply('связать', 'Клавиша отпущена. Выбери другую клавишу.');
      } else {
        rt.linkFirstId = element.id;
        setCanvasReply(
          keyLabel(element.code),
          element.links.length
            ? `Уже связано: ${element.links.length}. Нажимай на цели, чтобы добавить или убрать связь.`
            : 'Теперь нажимай на элементы, которые должна запускать эта клавиша.'
        );
      }
      renderCanvasElements();
      return;
    }

    if (!rt.linkFirstId) {
      setCanvasReply('связать', 'Сначала выбери клавишу в режиме связи.');
      return;
    }
    const key = rt.state.canvasElements.find((el) =>
      el.kind === 'key' && el.id === rt.linkFirstId
    );
    if (!key) {
      rt.linkFirstId = null;
      renderCanvasElements();
      return;
    }
    if (!Array.isArray(key.links)) key.links = [];
    const index = key.links.indexOf(element.id);
    if (index === -1) {
      key.links.push(element.id);
      setCanvasReply(
        `${keyLabel(key.code)} → ${elementLabel(element)}`,
        'Связь добавлена. Можно выбрать ещё одну цель.'
      );
    } else {
      key.links.splice(index, 1);
      setCanvasReply(
        keyLabel(key.code),
        `Связь с «${elementLabel(element)}» убрана.`
      );
    }
    ZQ.saveGame();
    renderCanvasElements();
    renderCanvasDrawer();
    renderKeyScheme();
  }

  function setLinkMode(enabled) {
    rt.canvasLinkMode = Boolean(enabled);
    rt.linkFirstId = null;
    dom.canvasLinkToggle.classList.toggle('active', rt.canvasLinkMode);
    dom.canvasHint.textContent = rt.canvasLinkMode
      ? 'Режим связи: выбери клавишу, затем одну или несколько целей.'
      : 'Перетаскивай элементы. Нажми, чтобы выполнить. Свяжи клавишу с целями, чтобы запускать их одной кнопкой.';
    renderCanvasElements();
    setCanvasReply(
      'связать',
      rt.canvasLinkMode
        ? 'Выбери клавишу, затем цели. Повторное нажатие на цель убирает связь.'
        : 'Режим связи выключен.'
    );
  }

  function buildCanvasNode(element) {
    const node = document.createElement('div');
    node.className = `cv-el ${element.kind}`;
    if (!elementAvailable(element)) node.classList.add('disabled');
    if (element.id === rt.linkFirstId) node.classList.add('selected');
    node.style.left = `${element.nx * 100}%`;
    node.style.top = `${element.ny * 100}%`;
    node.style.transform = 'translate(-50%, -50%)';
    node.dataset.id = element.id;
    node.dataset.kind = element.kind;
    if (element.kind === 'key' && element.code) node.dataset.code = element.code;

    if (element.kind === 'key') {
      const cap = document.createElement('button');
      cap.type = 'button';
      cap.className = 'el-key';
      cap.textContent = element.code ? keyLabel(element.code) : '—';
      cap.title = 'Назначить клавишу';
      cap.setAttribute(
        'aria-label',
        `Назначить клавишу для элемента «${elementLabel(element)}»`
      );
      if (element.id === rt.keyBindingId) cap.classList.add('listening');
      cap.addEventListener('pointerdown', (event) => event.stopPropagation());
      cap.addEventListener('click', (event) => {
        event.stopPropagation();
        if (rt.canvasLinkMode) {
          /* В режиме связи клик по клавише выбирает её, а не запускает
             переназначение. */
          handleLinkClick(element);
          return;
        }
        startKeyBinding(element);
      });
      node.appendChild(cap);

      const title = document.createElement('div');
      title.className = 'el-title';
      title.textContent = element.code ? 'клавиша' : 'без клавиши';
      node.appendChild(title);

      const sub = document.createElement('div');
      sub.className = 'el-sub';
      const targets = element.links
        .map((id) => rt.state.canvasElements.find((el) => el.id === id))
        .filter(Boolean);
      sub.textContent = targets.length
        ? `→ ${targets.map(elementLabel).join(' · ')}`
        : 'ни с чем не связана';
      node.appendChild(sub);
    } else if (element.kind === 'card') {
      const item = element.itemId ? C.items[element.itemId] : null;
      if (item && item.art) {
        const img = document.createElement('img');
        img.src = item.art;
        img.alt = item.name;
        node.appendChild(img);
      }
      const title = document.createElement('div');
      title.className = 'el-title';
      title.textContent = element.label || 'карта';
      node.appendChild(title);
      const sub = document.createElement('div');
      sub.className = 'el-sub';
      sub.textContent = element.sub || 'способность';
      node.appendChild(sub);
    } else if (element.kind === 'map') {
      const preview = document.createElement('div');
      preview.className = 'map-preview';
      node.appendChild(preview);
      const title = document.createElement('div');
      title.className = 'el-title';
      title.textContent = element.label || 'карта';
      node.appendChild(title);
      const sub = document.createElement('div');
      sub.className = 'el-sub';
      sub.textContent = element.sub || 'развернуть';
      node.appendChild(sub);
    } else if (element.kind === 'seq') {
      const title = document.createElement('div');
      title.className = 'el-title';
      title.textContent = element.label || 'связка';
      node.appendChild(title);
      const sub = document.createElement('div');
      sub.className = 'el-sub';
      sub.textContent = (element.commands || []).join(' → ');
      node.appendChild(sub);
    } else if (element.kind === 'control') {
      const title = document.createElement('div');
      title.className = 'el-title';
      title.textContent = element.label || 'кнопка';
      node.appendChild(title);
      const sub = document.createElement('div');
      sub.className = 'el-sub';
      sub.textContent = 'кнопка управления';
      node.appendChild(sub);
    } else {
      const title = document.createElement('div');
      title.className = 'el-title';
      title.textContent = element.label || element.command || 'команда';
      node.appendChild(title);
      const sub = document.createElement('div');
      sub.className = 'el-sub';
      sub.textContent = element.sub || 'команда';
      node.appendChild(sub);
    }

    /* У цели показываем, какие клавиши на неё ссылаются: вектор
       читается прямо на столе. */
    if (element.kind !== 'key') {
      const keys = linkedKeys(element.id);
      if (keys.length) {
        const refs = document.createElement('div');
        refs.className = 'el-keyrefs';
        for (const key of keys) {
          const chip = document.createElement('span');
          chip.className = 'el-keyref';
          chip.textContent = keyLabel(key.code);
          chip.title = `Клавиша ${keyLabel(key.code)} → ${elementLabel(element)}`;
          refs.appendChild(chip);
        }
        node.appendChild(refs);
      }
    }

    if (element.kind === 'card' && element.itemId) {
      const open = document.createElement('button');
      open.type = 'button';
      open.className = 'el-open';
      open.textContent = 'открыть';
      open.addEventListener('pointerdown', (event) => event.stopPropagation());
      open.addEventListener('click', (event) => {
        event.stopPropagation();
        if (!elementAvailable(element)) {
          setCanvasReply('недоступно', 'Карта осталась в рюкзаке на месте смерти.');
          return;
        }
        openCardDetail(element.itemId, 'canvas');
      });
      node.appendChild(open);
    }

    const run = document.createElement('button');
    run.type = 'button';
    run.className = 'el-run';
    run.textContent = element.kind === 'card'
      ? 'произнести'
      : element.kind === 'map'
        ? 'развернуть'
        : 'нажать';
    run.addEventListener('pointerdown', (event) => event.stopPropagation());
    run.addEventListener('click', (event) => {
      event.stopPropagation();
      runElement(element);
    });
    node.appendChild(run);

    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'el-remove';
    remove.setAttribute('aria-label', 'Убрать со стола');
    remove.textContent = '×';
    remove.addEventListener('pointerdown', (event) => event.stopPropagation());
    remove.addEventListener('click', (event) => {
      event.stopPropagation();
      removeCanvasElement(element.id);
      setCanvasReply('убрано', 'Элемент снят со стола.');
    });
    node.appendChild(remove);

    bindCanvasDrag(node, element);
    return node;
  }

  let tableCanvas = null;

  function getTableCanvas() {
    if (tableCanvas || !ZQ.Canvas) return tableCanvas;
    tableCanvas = ZQ.Canvas.create({
      surface: dom.canvasWorkspace,
      stage: dom.canvasStage,
      grid: dom.canvasGrid,
      links: dom.canvasLinks,
      elements: dom.canvasElements,
      get: () => ({
        zoom: rt.canvasZoom,
        panX: rt.canvasPanX,
        panY: rt.canvasPanY
      }),
      set: (view) => {
        rt.canvasZoom = ZQ.Canvas.clampZoom(view.zoom);
        rt.canvasPanX = view.panX;
        rt.canvasPanY = view.panY;
      },
      onChange: () => {
        if (dom.canvasZoomLabel) {
          dom.canvasZoomLabel.textContent = `${Math.round(rt.canvasZoom * 100)}%`;
        }
      },
      canStart: (event) => {
        if (event.target.closest('.cv-el')) return false;
        if (dom.canvasDrawer && dom.canvasDrawer.contains(event.target)) return false;
        if (dom.canvasKeys && dom.canvasKeys.contains(event.target)) return false;
        return true;
      }
    });
    return tableCanvas;
  }

  function bindCanvasDrag(node, element) {
    const canvas = getTableCanvas();
    if (!canvas) return;
    canvas.bindNodeDrag(node, element, {
      threshold: 4,
      ignore: '.el-remove',
      onMove: () => renderCanvasLinks(),
      onEnd: (moved) => {
        if (moved) {
          ZQ.saveGame();
          renderCanvasLinks();
          return;
        }
        if (element.kind === 'key' && rt.canvasLinkMode) return;
        runElement(element);
      }
    });
  }

  function renderCanvasElements() {
    dom.canvasElements.textContent = '';
    for (const element of rt.state.canvasElements) {
      dom.canvasElements.appendChild(buildCanvasNode(element));
    }
    dom.canvasEmpty.classList.toggle('hidden', rt.state.canvasElements.length > 0);
    renderCanvasLinks();
  }

  function renderCanvasDrawer() {
    dom.canvasAddList.textContent = '';

    function addGroupLabel(title, locked) {
      const label = document.createElement('span');
      label.className = `drawer-group-label${locked ? ' locked' : ''}`;
      label.textContent = title;
      dom.canvasAddList.appendChild(label);
    }

    const placeableItems = rt.state.items
      .map((itemId) => C.items[itemId])
      .filter((item) => item && (item.command || item.art));
    if (placeableItems.length) {
      addGroupLabel('ПРЕДМЕТЫ', false);
      for (const item of placeableItems) {
        const chip = document.createElement('button');
        chip.type = 'button';
        chip.className = 'add-chip item';
        chip.textContent = item.name;
        const already = rt.state.canvasElements.some((element) => element.itemId === item.id);
        chip.disabled = already;
        if (already) chip.textContent += ' · уже на столе';
        chip.addEventListener('click', () => {
          addItemElement(item.id, false);
          closeCanvasDrawer();
        });
        dom.canvasAddList.appendChild(chip);
      }
    }

    for (const group of C.terminal.helpGroups) {
      const unlocked = ZQ.groupUnlocked(group);
      if (!unlocked) continue;
      addGroupLabel(group.title, false);
      for (const entry of group.commands) {
        if (entry.bindable === false) continue;
        const chip = document.createElement('button');
        chip.type = 'button';
        chip.className = 'add-chip';
        chip.textContent = entry.command;
        chip.title = entry.description;
        const already = rt.state.canvasElements.some((element) =>
          element.kind === 'command' && element.command === entry.command
        );
        chip.disabled = already;
        if (already) chip.textContent += ' · уже на столе';
        chip.addEventListener('click', () => {
          addCommandElement(entry.command);
          closeCanvasDrawer();
        });
        dom.canvasAddList.appendChild(chip);
      }
    }

    addGroupLabel('УПРАВЛЕНИЕ', false);
    for (const action of Object.keys(C.controlActions || {})) {
      if (!actionUnlocked(action)) continue;
      const meta = C.controlActions[action];
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'add-chip control';
      chip.textContent = meta.label;
      chip.title = 'Кнопка без клавиши: свяжи её с клавишей';
      const already = rt.state.canvasElements.some((element) =>
        element.kind === 'control' && element.action === action
      );
      chip.disabled = already;
      if (already) chip.textContent += ' · уже на столе';
      chip.addEventListener('click', () => {
        addControlElement(action);
        closeCanvasDrawer();
      });
      dom.canvasAddList.appendChild(chip);
    }

    addGroupLabel('КЛАВИШИ', false);
    const addKey = document.createElement('button');
    addKey.type = 'button';
    addKey.className = 'add-chip key';
    addKey.textContent = '+ клавиша';
    addKey.title = 'Добавить клавишу и связать её с элементами';
    addKey.addEventListener('click', () => {
      addKeyElement(null);
      closeCanvasDrawer();
    });
    dom.canvasAddList.appendChild(addKey);

    const keys = keyElements();
    if (keys.length) {
      const tip = document.createElement('span');
      tip.className = 'canvas-tip key-tip';
      tip.textContent = keys.map((key) =>
        `${keyLabel(key.code)} → ${key.links.length || '—'}`
      ).join(' · ');
      dom.canvasAddList.appendChild(tip);
    }

    if (!placeableItems.length && !rt.state.canvasElements.length) {
      const note = document.createElement('span');
      note.className = 'canvas-tip';
      note.textContent = 'Пока нечего добавить. Найди предметы в Лабиринте.';
      dom.canvasAddList.appendChild(note);
    }
  }

  function openCanvasDrawer() {
    renderCanvasDrawer();
    dom.canvasDrawer.classList.remove('hidden');
    dom.canvasAddToggle.setAttribute('aria-expanded', 'true');
  }

  function closeCanvasDrawer() {
    dom.canvasDrawer.classList.add('hidden');
    dom.canvasAddToggle.setAttribute('aria-expanded', 'false');
  }

  function applyCanvasTransform() {
    if (!dom.canvasStage) return;
    if (ZQ.Canvas) {
      ZQ.Canvas.applyTransform(
        dom.canvasWorkspace,
        dom.canvasStage,
        dom.canvasGrid,
        { zoom: rt.canvasZoom, panX: rt.canvasPanX, panY: rt.canvasPanY }
      );
      return;
    }
    dom.canvasStage.style.transform =
      `translate(${rt.canvasPanX.toFixed(1)}px, ${rt.canvasPanY.toFixed(1)}px) scale(${rt.canvasZoom.toFixed(4)})`;
  }

  function setCanvasPan(x, y) {
    rt.canvasPanX = x;
    rt.canvasPanY = y;
    applyCanvasTransform();
  }

  function updateCanvasZoomLabel() {
    if (dom.canvasZoomLabel) {
      dom.canvasZoomLabel.textContent = `${Math.round(rt.canvasZoom * 100)}%`;
    }
  }

  function setCanvasZoom(value, announce) {
    rt.canvasZoom = ZQ.clamp(value, 0.18, 3.2);
    applyCanvasTransform();
    updateCanvasZoomLabel();
    if (announce) {
      setCanvasReply(
        'масштаб',
        `${Math.round(rt.canvasZoom * 100)}%. Колесо или щипок тоже меняют масштаб.`
      );
    }
  }

  function resetCanvasView(announce) {
    rt.canvasZoom = 1;
    rt.canvasPanX = 0;
    rt.canvasPanY = 0;
    applyCanvasTransform();
    updateCanvasZoomLabel();
    if (announce) {
      setCanvasReply('масштаб', 'Масштаб и положение стола сброшены.');
    }
  }

  /* Те же действия канвы, что в инвентаре и сюжете: вписать все
     элементы в окно и выровнять их по шагу сетки. */
  function fitCanvasView() {
    const canvas = getTableCanvas();
    if (!canvas) return;
    canvas.fitToNodes('.cv-el', { pad: 30, maxZoom: 1.35 });
  }

  function gridCanvasElements() {
    const canvas = getTableCanvas();
    if (!canvas || !dom.canvasStage) return;
    const width = Math.max(1, dom.canvasStage.clientWidth || 1);
    const height = Math.max(1, dom.canvasStage.clientHeight || 1);
    canvas.alignToGrid('.cv-el', 22, {
      anchor: 'center',
      apply: (rows) => {
        for (const row of rows) {
          const id = row.node.dataset.id;
          const element = rt.state.canvasElements.find((candidate) => candidate.id === id);
          if (!element) continue;
          element.nx = row.x / width;
          element.ny = row.y / height;
        }
      }
    });
    renderCanvasElements();
    applyCanvasTransform();
    renderCanvasLinks();
    ZQ.saveGame();
  }

  /* --------------------------- Макеты ------------------------------- */

  function snapshotCanvasLayout() {
    return {
      zoom: rt.canvasZoom,
      panX: rt.canvasPanX,
      panY: rt.canvasPanY,
      elements: rt.state.canvasElements.map((element) => ({
        id: element.id,
        nx: element.nx,
        ny: element.ny
      })),
      savedAt: Date.now()
    };
  }

  function saveCanvasLayout(name) {
    const clean = String(name || '').trim().slice(0, 48);
    if (!clean) {
      return tl(
        'Укажи имя макета: «макет сохранить бой».',
        'Name the layout: “layout save fight”.'
      );
    }
    rt.state.canvasLayouts[clean] = snapshotCanvasLayout();
    ZQ.saveGame();
    const text = tl(
      `Макет «${clean}» сохранён: ${rt.state.canvasElements.length} элементов, масштаб ${Math.round(rt.canvasZoom * 100)}%.`,
      `Layout “${clean}” saved: ${rt.state.canvasElements.length} elements, scale ${Math.round(rt.canvasZoom * 100)}%.`
    );
    if (rt.termView === 'canvas') setCanvasReply(`макет сохранить ${clean}`, text);
    return text;
  }

  function loadCanvasLayout(name) {
    const clean = String(name || '').trim();
    if (!clean) return listCanvasLayouts();
    const layout = rt.state.canvasLayouts[clean];
    if (!layout) {
      const names = Object.keys(rt.state.canvasLayouts);
      const suffix = names.length
        ? tl(` Сохранены: ${names.join(', ')}.`, ` Saved: ${names.join(', ')}.`)
        : tl(' Сохранённых макетов пока нет.', ' There are no saved layouts yet.');
      return tl(`Макет «${clean}» не найден.`, `Layout “${clean}” was not found.`) + suffix;
    }
    if (Number.isFinite(layout.zoom)) {
      rt.canvasZoom = ZQ.clamp(layout.zoom, 0.18, 3.2);
    }
    if (Number.isFinite(layout.panX)) rt.canvasPanX = layout.panX;
    if (Number.isFinite(layout.panY)) rt.canvasPanY = layout.panY;
    if (Array.isArray(layout.elements)) {
      for (const entry of layout.elements) {
        if (!entry || !entry.id) continue;
        const element = rt.state.canvasElements.find((candidate) => candidate.id === entry.id);
        if (!element) continue;
        if (Number.isFinite(entry.nx)) element.nx = entry.nx;
        if (Number.isFinite(entry.ny)) element.ny = entry.ny;
      }
    }
    if (rt.termView !== 'canvas') openCanvas();
    renderCanvasElements();
    applyCanvasTransform();
    renderCanvasLinks();
    updateCanvasZoomLabel();
    ZQ.saveGame();
    return tl(
      `Макет «${clean}» развёрнут: ${rt.state.canvasElements.length} элементов, масштаб ${Math.round(rt.canvasZoom * 100)}%.`,
      `Layout “${clean}” restored: ${rt.state.canvasElements.length} elements, scale ${Math.round(rt.canvasZoom * 100)}%.`
    );
  }

  function listCanvasLayouts() {
    const names = Object.keys(rt.state.canvasLayouts || {});
    if (!names.length) {
      return tl('Макеты пока не сохранялись.', 'No layouts have been saved yet.');
    }
    const lines = [tl(`Макеты стола (${names.length}):`, `Table layouts (${names.length}):`)];
    for (const name of names) {
      const layout = rt.state.canvasLayouts[name] || {};
      const count = Array.isArray(layout.elements) ? layout.elements.length : 0;
      const zoom = Number.isFinite(layout.zoom) ? `${Math.round(layout.zoom * 100)}%` : '—';
      const when = Number.isFinite(layout.savedAt)
        ? new Date(layout.savedAt).toLocaleString()
        : '';
      lines.push(`• ${name} — ${count} ${tl('элементов', 'elements')}, ${zoom}${when ? ` · ${when}` : ''}`);
    }
    lines.push(tl(
      'Загрузить: «макет имя». Сохранить: «макет сохранить имя».',
      'Load: “layout name”. Save: “layout save name”.'
    ));
    return lines.join('\n');
  }

  /* ----------------------- Схема -------------------------------- */

  function renderBoundScheme(body) {
    const scheme = document.createElement('div');
    scheme.className = 'bound-scheme';

    const intro = document.createElement('p');
    intro.className = 'scheme-intro';
    intro.textContent = 'Нажми на клавишу в схеме — она выполнит все связанные цели. На клавиатуре связанные клавиши работают, пока открыт стол.';
    scheme.appendChild(intro);

    const keys = keyElements();
    if (!keys.length) {
      const empty = document.createElement('div');
      empty.className = 'scheme-empty';
      empty.textContent = 'Связанных клавиш пока нет. Добавь клавишу на стол через «+ элемент» → «+ клавиша».';
      scheme.appendChild(empty);
    } else {
      const list = document.createElement('div');
      list.className = 'bound-list';
      for (const key of keys) {
        const row = document.createElement('div');
        row.className = 'bound-row';
        if (!key.code) row.classList.add('unbound');

        const cap = document.createElement('button');
        cap.type = 'button';
        cap.className = 'scheme-keycap keycap';
        cap.textContent = keyLabel(key.code);
        cap.title = key.code
          ? `Нажать ${keyLabel(key.code)}`
          : 'Назначить клавишу';
        cap.dataset.key = key.code || '';
        cap.dataset.code = key.code || '';
        cap.addEventListener('click', () => {
          if (!key.code) {
            startKeyBinding(key);
          } else {
            executeKeyElement(key);
          }
        });
        row.appendChild(cap);

        const arrow = document.createElement('span');
        arrow.className = 'scheme-arrow';
        arrow.textContent = '→';
        row.appendChild(arrow);

        const targets = key.links
          .map((id) => rt.state.canvasElements.find((el) => el.id === id))
          .filter(Boolean);
        const copy = document.createElement('div');
        copy.className = 'scheme-targets';
        if (targets.length) {
          for (const target of targets) {
            const chip = document.createElement('span');
            chip.className = 'scheme-target';
            chip.textContent = elementLabel(target);
            copy.appendChild(chip);
          }
        } else {
          const empty = document.createElement('span');
          empty.className = 'scheme-target empty';
          empty.textContent = 'ни с чем не связана';
          copy.appendChild(empty);
        }
        row.appendChild(copy);
        list.appendChild(row);
      }
      scheme.appendChild(list);
    }

    body.appendChild(scheme);
  }

  function deviceCaption(text) {
    const caption = document.createElement('p');
    caption.className = 'device-caption';
    caption.textContent = text;
    return caption;
  }

  function renderGamepadScheme(body) {
    const scheme = document.createElement('div');
    scheme.className = 'scheme-reference';
    const title = document.createElement('p');
    title.className = 'scheme-intro';
    title.textContent = tl(
      'Геймпад остаётся для движения и действия. Клавиши стола настраиваются на клавиатуре и запускают связанные цели.',
      'The gamepad stays for movement and action. Table keys are configured on the keyboard and run linked targets.',
      'Der Gamepad bleibt für Bewegung und Aktion. Tisch-Tasten werden auf der Tastatur belegt und lösen verknüpfte Ziele aus.'
    );
    scheme.appendChild(title);

    const visual = document.createElement('div');
    visual.className = 'device-visual device-gamepad';
    const shell = document.createElement('div');
    shell.className = 'gamepad-body';
    const dpad = document.createElement('div');
    dpad.className = 'gamepad-dpad';
    for (const [cls, label] of [['up', '▲'], ['left', '◀'], ['right', '▶'], ['down', '▼']]) {
      const key = document.createElement('span');
      key.className = `gamepad-dir ${cls}`;
      key.textContent = label;
      dpad.appendChild(key);
    }
    shell.appendChild(dpad);
    const face = document.createElement('div');
    face.className = 'gamepad-face';
    for (const [cls, label] of [['a', 'A'], ['b', 'B'], ['x', 'X'], ['start', 'START']]) {
      const key = document.createElement('span');
      key.className = `gamepad-btn ${cls}`;
      key.textContent = label;
      face.appendChild(key);
    }
    shell.appendChild(face);
    visual.appendChild(shell);
    visual.appendChild(deviceCaption(tl(
      'D-pad и левый стик — движение, A — действие, B — стоп, START — настройки.',
      'D-pad and left stick move, A acts, B stops, START opens settings.',
      'D-pad und linker Stick bewegen, A handelt, B stoppt, START öffnet Einstellungen.'
    )));
    scheme.appendChild(visual);

    const grid = document.createElement('div');
    grid.className = 'scheme-reference-grid';
    const rows = [
      [tl('D-pad / левый стик', 'D-pad / left stick', 'D-pad / linker Stick'), tl('движение', 'movement', 'Bewegung')],
      [tl('A', 'A', 'A'), tl('действие', 'action', 'Aktion')],
      [tl('B / SELECT', 'B / SELECT', 'B / SELECT'), tl('стоп', 'stop', 'Stopp')],
      [tl('START', 'START', 'START'), tl('настройки', 'settings', 'Einstellungen')]
    ];
    for (const [control, action] of rows) {
      const item = document.createElement('div');
      item.className = 'scheme-reference-item';
      const name = document.createElement('b');
      name.textContent = control;
      item.appendChild(name);
      const value = document.createElement('span');
      value.textContent = action;
      item.appendChild(value);
      grid.appendChild(item);
    }
    scheme.appendChild(grid);
    body.appendChild(scheme);
  }

  function renderMouseScheme(body) {
    const scheme = document.createElement('div');
    scheme.className = 'scheme-reference';
    const title = document.createElement('p');
    title.className = 'scheme-intro';
    title.textContent = tl(
      'Мышь работает на столе и в мире: перетаскивай элементы, двигай полотно, меняй масштаб и переключай режим курсора.',
      'The mouse works on the table and in the world: drag elements, pan the canvas, zoom and switch cursor modes.',
      'Die Maus funktioniert am Tisch und in der Welt: Elemente ziehen, Fläche bewegen, zoomen und den Cursormodus wechseln.'
    );
    scheme.appendChild(title);

    const visual = document.createElement('div');
    visual.className = 'device-visual device-mouse';
    const mouse = document.createElement('div');
    mouse.className = 'mouse-body';
    const left = document.createElement('span');
    left.className = 'mouse-button left';
    left.textContent = tl('ЛКМ', 'LMB', 'LMB');
    const right = document.createElement('span');
    right.className = 'mouse-button right';
    right.textContent = tl('ПКМ', 'RMB', 'RMB');
    const wheel = document.createElement('span');
    wheel.className = 'mouse-wheel';
    mouse.appendChild(left);
    mouse.appendChild(right);
    mouse.appendChild(wheel);
    visual.appendChild(mouse);
    visual.appendChild(deviceCaption(tl(
      'ЛКМ — цель или перетаскивание, ПКМ — режим курсора, колесо — масштаб.',
      'LMB — target or drag, RMB — cursor mode, wheel — zoom.',
      'LMB — Ziel oder Ziehen, RMB — Cursormodus, Rad — Zoom.'
    )));
    scheme.appendChild(visual);

    const grid = document.createElement('div');
    grid.className = 'scheme-reference-grid';
    for (const [control, action] of [
      [tl('ЛКМ', 'LMB', 'LMB'), tl('выбрать, перетащить или задать цель', 'select, drag or set a target', 'auswählen, ziehen oder Ziel setzen')],
      [tl('ПКМ / двойной клик', 'RMB / double click', 'RMB / Doppelklick'), tl('сменить режим курсора', 'switch cursor mode', 'Cursormodus wechseln')],
      [tl('Колесо', 'Wheel', 'Rad'), tl('масштаб вокруг курсора', 'zoom around the cursor', 'rund um den Cursor zoomen')],
      [tl('ЛКМ по пустому месту', 'LMB on empty space', 'LMB auf leerer Fläche'), tl('двигать полотно', 'pan the canvas', 'Fläche verschieben')]
    ]) {
      const item = document.createElement('div');
      item.className = 'scheme-reference-item';
      const name = document.createElement('b');
      name.textContent = control;
      item.appendChild(name);
      const value = document.createElement('span');
      value.textContent = action;
      item.appendChild(value);
      grid.appendChild(item);
    }
    scheme.appendChild(grid);
    body.appendChild(scheme);
  }

  function renderPhoneScheme(body) {
    const scheme = document.createElement('div');
    scheme.className = 'scheme-reference';
    const title = document.createElement('p');
    title.className = 'scheme-intro';
    title.textContent = tl(
      'На телефоне движение и действие остаются на экранных кнопках. Двойной тап по миру меняет режим курсора.',
      'On a phone, movement and action stay on the on-screen buttons. Double-tap the world to change the cursor mode.',
      'Auf dem Telefon bleiben Bewegung und Aktion auf den Bildschirmtasten. Doppeltippen auf die Welt wechselt den Cursormodus.'
    );
    scheme.appendChild(title);

    const visual = document.createElement('div');
    visual.className = 'device-visual device-phone';
    const phone = document.createElement('div');
    phone.className = 'phone-body';
    const screen = document.createElement('div');
    screen.className = 'phone-screen';
    const miniDpad = document.createElement('div');
    miniDpad.className = 'phone-dpad';
    for (const [cls, label] of [['up', '▲'], ['left', '◀'], ['right', '▶'], ['down', '▼']]) {
      const key = document.createElement('span');
      key.className = `gamepad-dir ${cls}`;
      key.textContent = label;
      miniDpad.appendChild(key);
    }
    screen.appendChild(miniDpad);
    const action = document.createElement('span');
    action.className = 'phone-action';
    action.textContent = '✦';
    screen.appendChild(action);
    const tap = document.createElement('span');
    tap.className = 'phone-tap';
    tap.textContent = '×2';
    screen.appendChild(tap);
    phone.appendChild(screen);
    visual.appendChild(phone);
    visual.appendChild(deviceCaption(tl(
      'D-pad — движение, ✦ — действие, двойной тап — режим курсора.',
      'D-pad moves, ✦ acts, double-tap changes the cursor mode.',
      'D-pad bewegt, ✦ handelt, Doppeltippen wechselt den Cursormodus.'
    )));
    scheme.appendChild(visual);

    const grid = document.createElement('div');
    grid.className = 'scheme-reference-grid';
    for (const [control, action] of [
      [tl('D-pad', 'D-pad', 'D-pad'), tl('движение', 'movement', 'Bewegung')],
      [tl('✦', '✦', '✦'), tl('действие', 'action', 'Aktion')],
      [tl('двойной тап', 'double-tap', 'Doppeltippen'), tl('режим курсора', 'cursor mode', 'Cursormodus')],
      [tl('Escape', 'Escape', 'Escape'), tl('закрыть раздел', 'close a section', 'Bereich schließen')]
    ]) {
      const item = document.createElement('div');
      item.className = 'scheme-reference-item';
      const name = document.createElement('b');
      name.textContent = control;
      item.appendChild(name);
      const value = document.createElement('span');
      value.textContent = action;
      item.appendChild(value);
      grid.appendChild(item);
    }
    scheme.appendChild(grid);
    body.appendChild(scheme);
  }

  function renderKeyboardScheme() {
    if (!dom.canvasKeyboard) return;
    dom.canvasKeyboard.textContent = '';
    const rows = [
      [
        ['Backquote', '`'], ['Digit1', '1'], ['Digit2', '2'], ['Digit3', '3'],
        ['Digit4', '4'], ['Digit5', '5'], ['Digit6', '6'], ['Digit7', '7'],
        ['Digit8', '8'], ['Digit9', '9'], ['Digit0', '0'], ['Minus', '−'],
        ['Equal', '='], ['Backspace', '⌫', 'wide-2']
      ],
      [
        ['Tab', 'TAB', 'wide-2'], ['KeyQ', 'Q'], ['KeyW', 'W'], ['KeyE', 'E'],
        ['KeyR', 'R'], ['KeyT', 'T'], ['KeyY', 'Y'], ['KeyU', 'U'],
        ['KeyI', 'I'], ['KeyO', 'O'], ['KeyP', 'P'], ['BracketLeft', '['],
        ['BracketRight', ']'], ['Backslash', '\\', 'wide-2']
      ],
      [
        ['CapsLock', 'CAPS', 'wide-2'], ['KeyA', 'A'], ['KeyS', 'S'],
        ['KeyD', 'D'], ['KeyF', 'F'], ['KeyG', 'G'], ['KeyH', 'H'],
        ['KeyJ', 'J'], ['KeyK', 'K'], ['KeyL', 'L'], ['Semicolon', ';'],
        ['Quote', "'"], ['Enter', 'ENTER', 'wide-2']
      ],
      [
        ['ShiftLeft', 'SHIFT', 'wide-2'], ['KeyZ', 'Z'], ['KeyX', 'X'],
        ['KeyC', 'C'], ['KeyV', 'V'], ['KeyB', 'B'], ['KeyN', 'N'],
        ['KeyM', 'M'], ['Comma', ','], ['Period', '.'], ['Slash', '/'],
        ['ShiftRight', 'SHIFT', 'wide-2']
      ],
      [
        ['ControlLeft', 'CTRL', 'wide-2'], ['MetaLeft', 'META'],
        ['AltLeft', 'ALT', 'wide-2'], ['Space', '␣', 'space'],
        ['AltRight', 'ALT', 'wide-2'], ['MetaRight', 'META'],
        ['ContextMenu', 'MENU'], ['ControlRight', 'CTRL', 'wide-2']
      ]
    ];

    for (const row of rows) {
      const line = document.createElement('div');
      line.className = 'kb-row';
      for (const item of row) {
        const code = item[0];
        const label = item[1] || keyLabel(code);
        const widthClass = item[2] || '';
        const button = document.createElement('button');
        button.type = 'button';
        button.className = `kb-key ${widthClass}`.trim();
        button.textContent = label;
        button.dataset.code = code;
        const existing = keyForCode(code);
        if (existing) button.classList.add('placed');
        button.title = existing
          ? `${keyLabel(code)} уже на столе · целей: ${existing.links.length}`
          : `Добавить клавишу ${keyLabel(code)} на стол`;
        button.setAttribute('aria-label', button.title);
        button.addEventListener('click', () => {
          const key = keyForCode(code);
          if (key) {
            if (rt.canvasLinkMode) {
              rt.linkFirstId = key.id;
              renderCanvasElements();
              renderCanvasLinks();
            }
            setCanvasReply(
              keyLabel(code),
              key.links.length
                ? `Клавиша уже на столе. Связано целей: ${key.links.length}.`
                : 'Клавиша уже на столе, но пока ни с чем не связана.'
            );
            return;
          }
          addKeyElement(code);
          renderKeyboardScheme();
        });
        line.appendChild(button);
      }
      dom.canvasKeyboard.appendChild(line);
    }
  }

  function renderKeyScheme() {
    if (!dom.canvasKeysBody) return;
    dom.canvasKeysBody.textContent = '';
    if (dom.canvasKeysTabs) {
      dom.canvasKeysTabs.querySelectorAll('[data-device]').forEach((button) => {
        const active = button.dataset.device === rt.canvasDevice;
        button.classList.toggle('active', active);
        button.setAttribute('aria-selected', active ? 'true' : 'false');
      });
    }
    if (rt.canvasDevice === 'gamepad') renderGamepadScheme(dom.canvasKeysBody);
    else if (rt.canvasDevice === 'phone') renderPhoneScheme(dom.canvasKeysBody);
    else if (rt.canvasDevice === 'mouse') renderMouseScheme(dom.canvasKeysBody);
    else {
      renderKeyboardScheme();
      renderBoundScheme(dom.canvasKeysBody);
    }
    const keyboardTab = rt.canvasDevice === 'keyboard';
    if (dom.canvasKeyboard) dom.canvasKeyboard.classList.toggle('hidden', !keyboardTab);
    if (dom.canvasKeyboardHint) dom.canvasKeyboardHint.classList.toggle('hidden', !keyboardTab);
  }

  /* --------------------------- Карточка ----------------------------- */

  function openCardDetail(itemId, origin) {
    const item = C.items[itemId];
    if (!item || item.kind !== 'card' || !item.art) return;
    if (!rt.state.items.includes(itemId)) return;
    rt.cardOrigin = origin === 'inventory' ? 'inventory' : 'canvas';
    ZQ.ensureTerminalShare(0.55);
    dom.cardTitle.textContent = item.name;
    dom.cardArt.src = item.art;
    dom.cardArt.alt = item.name;
    dom.cardCommand.textContent = item.command ? `> ${item.command}` : '';
    dom.cardDescription.textContent = item.description;
    dom.cardState.textContent = rt.cardOrigin === 'inventory'
      ? 'состояние: в рюкзаке'
      : 'состояние: размещена на столе';
    dom.cardRun.dataset.itemId = itemId;
    dom.cardRun.disabled = !item.command;
    dom.cardPlace.dataset.itemId = itemId;
    dom.cardBack.textContent = rt.cardOrigin === 'inventory' ? '← к рюкзаку' : '← к столу';
    dom.cardClose.setAttribute(
      'aria-label',
      rt.cardOrigin === 'inventory' ? 'Вернуться к рюкзаку' : 'Вернуться к столу'
    );
    ZQ.setTerminalView('card');
  }

  function closeCardDetail() {
    if (rt.cardOrigin === 'inventory') ZQ.openInventory();
    else openCanvas();
  }

  /* --------------------------- Стол --------------------------------- */

  function openCanvas() {
    if (ZQ.isTrialBlocking()) return;
    if (!ZQ.hasUnlock('table')) {
      ZQ.appendLog(ZQ.denyLocked('table'), 'sys', true);
      return;
    }
    ZQ.ensureTerminalShare(0.46);
    rt.keyBindingId = null;
    rt.linkFirstId = null;
    renderCanvasElements();
    renderCanvasDrawer();
    renderKeyScheme();
    ZQ.setTerminalView('canvas');
    applyCanvasTransform();
    renderCanvasLinks();
    setCanvasReply(
      'готово',
      'Перетаскивай элементы. Нажми на элемент, чтобы выполнить. Клавиша запускает все связанные с ней цели.'
    );
  }

  function closeCanvas() {
    if (rt.canvasLinkMode) {
      rt.canvasLinkMode = false;
      rt.linkFirstId = null;
      dom.canvasLinkToggle.classList.remove('active');
    }
    rt.keyBindingId = null;
    dom.canvasHint.textContent = 'Перетаскивай элементы. Нажми, чтобы выполнить. Свяжи клавишу с целями, чтобы запускать их одной кнопкой.';
    closeCanvasDrawer();
    ZQ.setTerminalView('main');
    ZQ.saveGame();
    ZQ.updatePrompt();
  }

  /* Панель канвы живёт внутри рабочей поверхности. Базовые кнопки
     (масштаб, «развернуть», «сетка») одинаковы для стола, инвентаря
     и сюжета, а действия стола добавляются как дополнительные. */
  const tableSurface = getTableCanvas();
  if (tableSurface) {
    tableSurface.attachViewport();
    const controls = ZQ.Canvas.mountControls({
      canvas: tableSurface,
      container: dom.canvasWorkspace,
      idPrefix: 'canvas',
      ids: { fit: 'canvas-fit', grid: 'canvas-align-grid' },
      fit: fitCanvasView,
      grid: gridCanvasElements,
      extras: [
        {
          id: 'canvas-add-toggle',
          label: '+',
          title: 'Добавить элемент',
          ariaLabel: 'Добавить элемент'
        },
        {
          id: 'canvas-link-toggle',
          label: '→',
          title: 'Связать',
          ariaLabel: 'Связать'
        },
        {
          id: 'canvas-keys-toggle',
          label: 'клавиши',
          title: 'Схема управления',
          ariaLabel: 'Схема управления'
        },
        {
          id: 'canvas-layout-save',
          label: 'макет',
          title: 'Сохранить макет стола',
          ariaLabel: 'Сохранить макет стола'
        }
      ]
    });
    if (controls) {
      dom.canvasAddToggle = controls.buttons['canvas-add-toggle'];
      dom.canvasLinkToggle = controls.buttons['canvas-link-toggle'];
      dom.canvasKeysToggle = controls.buttons['canvas-keys-toggle'];
      dom.canvasLayoutSave = controls.buttons['canvas-layout-save'];
      dom.canvasZoomLabel = controls.label;
    }
  }

  dom.canvasExit.addEventListener('click', closeCanvas);
  if (dom.canvasLayoutSave) {
    dom.canvasLayoutSave.addEventListener('click', () => {
      const name = window.prompt(
        tl('Имя макета', 'Layout name'),
        `макет ${Object.keys(rt.state.canvasLayouts || {}).length + 1}`
      );
      if (name === null) return;
      const clean = String(name).trim();
      if (!clean) {
        setCanvasReply('макет сохранить', tl('Имя не задано. Макет не сохранён.', 'No name given. Layout not saved.'));
        return;
      }
      saveCanvasLayout(clean);
    });
  }
  dom.cardBack.addEventListener('click', closeCardDetail);
  dom.cardClose.addEventListener('click', closeCardDetail);
  dom.cardRun.addEventListener('click', () => {
    const itemId = dom.cardRun.dataset.itemId;
    const item = itemId ? C.items[itemId] : null;
    if (!item || !item.command || !rt.state.items.includes(itemId)) return;
    ZQ.handleCommand(item.command, 'canvas');
    openCanvas();
  });
  dom.cardPlace.addEventListener('click', () => {
    const itemId = dom.cardPlace.dataset.itemId;
    if (!itemId || !rt.state.items.includes(itemId)) return;
    addItemElement(itemId, true);
  });
  dom.canvasAddToggle.addEventListener('click', () => {
    if (dom.canvasDrawer.classList.contains('hidden')) openCanvasDrawer();
    else closeCanvasDrawer();
  });
  dom.canvasDrawerClose.addEventListener('click', closeCanvasDrawer);
  dom.canvasKeysToggle.addEventListener('click', () => {
    const willOpen = dom.canvasKeys.classList.contains('hidden');
    dom.canvasKeys.classList.toggle('hidden', !willOpen);
    dom.canvasKeysToggle.classList.toggle('active', willOpen);
    dom.canvasKeysToggle.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
    if (willOpen) renderKeyScheme();
  });
  dom.canvasKeysTabs.addEventListener('click', (event) => {
    const button = event.target.closest('[data-device]');
    if (!button) return;
    rt.canvasDevice = button.dataset.device;
    renderKeyScheme();
  });
  dom.canvasLinkToggle.addEventListener('click', () => {
    setLinkMode(!rt.canvasLinkMode);
  });

  window.addEventListener('resize', () => {
    if (rt.termView === 'canvas') applyCanvasTransform();
    renderCanvasLinks();
  });


  ZQ.keyLabel = keyLabel;
  ZQ.elementLabel = elementLabel;
  ZQ.elementAvailable = elementAvailable;
  ZQ.commandsForElement = commandsForElement;
  ZQ.requiresForElement = requiresForElement;
  ZQ.normalizeTableBindings = normalizeTableBindings;
  ZQ.keyElements = keyElements;
  ZQ.keyForCode = keyForCode;
  ZQ.linkedKeys = linkedKeys;
  ZQ.addItemElement = addItemElement;
  ZQ.addCommandElement = addCommandElement;
  ZQ.addControlElement = addControlElement;
  ZQ.addKeyElement = addKeyElement;
  ZQ.removeCanvasElement = removeCanvasElement;
  ZQ.startKeyBinding = startKeyBinding;
  ZQ.assignKeyCode = assignKeyCode;
  ZQ.executeKeyElement = executeKeyElement;
  ZQ.runElement = runElement;
  ZQ.setCanvasReply = setCanvasReply;
  ZQ.renderCanvasElements = renderCanvasElements;
  ZQ.renderCanvasLinks = renderCanvasLinks;
  ZQ.renderCanvasDrawer = renderCanvasDrawer;
  ZQ.openCanvasDrawer = openCanvasDrawer;
  ZQ.closeCanvasDrawer = closeCanvasDrawer;
  ZQ.applyCanvasTransform = applyCanvasTransform;
  ZQ.setCanvasPan = setCanvasPan;
  ZQ.setCanvasZoom = setCanvasZoom;
  ZQ.resetCanvasView = resetCanvasView;
  ZQ.saveCanvasLayout = saveCanvasLayout;
  ZQ.loadCanvasLayout = loadCanvasLayout;
  ZQ.listCanvasLayouts = listCanvasLayouts;
  ZQ.renderKeyScheme = renderKeyScheme;
  ZQ.renderKeyboardScheme = renderKeyboardScheme;
  ZQ.openCardDetail = openCardDetail;
  ZQ.closeCardDetail = closeCardDetail;
  ZQ.openCanvas = openCanvas;
  ZQ.closeCanvas = closeCanvas;
})();
