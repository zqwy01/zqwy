/* Стол: элементы, клавиши-векторы и живая схема управления.
   Клавиша — самостоятельный элемент. Она хранит код и список целей:
   A -> помоги, A -> рюкзак. Одна клавиша может запускать несколько целей. */
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
      ZQ.handleCommand('рюкзак', 'terminal');
      return 'Рюкзак открыт.';
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

  function executeTarget(element) {
    if (!element) return '';
    if (!elementAvailable(element)) {
      return 'Недоступно: предмет остался в рюкзаке на месте смерти.';
    }
    if (element.kind === 'control') return runControlElement(element);
    const commands = commandsForElement(element);
    if (!commands.length) return 'У этого элемента нет команды.';
    const replies = [];
    for (const command of commands) {
      const reply = ZQ.handleCommand(command, 'canvas');
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
    const replies = targets.map((target) => executeTarget(target)).filter(Boolean);
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

  function bindCanvasDrag(node, element) {
    node.addEventListener('pointerdown', (event) => {
      if (event.button !== undefined && event.button !== 0) return;
      if (event.target.closest('.el-remove')) return;
      event.preventDefault();
      event.stopPropagation();
      const rect = dom.canvasStage.getBoundingClientRect();
      rt.canvasDrag = {
        pointerId: event.pointerId,
        element,
        node,
        startX: event.clientX,
        startY: event.clientY,
        startNx: element.nx,
        startNy: element.ny,
        rect,
        moved: false
      };
      node.classList.add('dragging');
      try {
        node.setPointerCapture(event.pointerId);
      } catch (error) {
        /* Старые браузеры могут не поддерживать capture. */
      }
    });

    node.addEventListener('pointermove', (event) => {
      if (!rt.canvasDrag ||
          rt.canvasDrag.pointerId !== event.pointerId ||
          rt.canvasDrag.node !== node) return;
      const dx = event.clientX - rt.canvasDrag.startX;
      const dy = event.clientY - rt.canvasDrag.startY;
      if (Math.hypot(dx, dy) > 4) rt.canvasDrag.moved = true;
      if (!rt.canvasDrag.moved) return;
      const nx = ZQ.clamp(rt.canvasDrag.startNx + dx / rt.canvasDrag.rect.width, 0.06, 0.94);
      const ny = ZQ.clamp(rt.canvasDrag.startNy + dy / rt.canvasDrag.rect.height, 0.06, 0.94);
      element.nx = nx;
      element.ny = ny;
      node.style.left = `${nx * 100}%`;
      node.style.top = `${ny * 100}%`;
      renderCanvasLinks();
    });

    const finish = (event) => {
      if (!rt.canvasDrag ||
          rt.canvasDrag.pointerId !== event.pointerId ||
          rt.canvasDrag.node !== node) return;
      const moved = rt.canvasDrag.moved;
      rt.canvasDrag = null;
      node.classList.remove('dragging');
      try {
        node.releasePointerCapture(event.pointerId);
      } catch (error) {
        /* ignored */
      }
      if (moved) {
        ZQ.saveGame();
        renderCanvasLinks();
        return;
      }
      if (event.target.closest('.el-remove')) return;
      if (event.target.closest('.el-key') && element.kind === 'key') return;
      runElement(element);
    };

    node.addEventListener('pointerup', finish);
    node.addEventListener('pointercancel', (event) => {
      if (!rt.canvasDrag ||
          rt.canvasDrag.pointerId !== event.pointerId ||
          rt.canvasDrag.node !== node) return;
      rt.canvasDrag = null;
      node.classList.remove('dragging');
      ZQ.saveGame();
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
    dom.canvasStage.style.transform =
      `translate(${rt.canvasPanX.toFixed(1)}px, ${rt.canvasPanY.toFixed(1)}px) scale(${rt.canvasZoom.toFixed(4)})`;

    /* Сетка живёт вне сцены, поэтому её нужно двигать и масштабировать
       вручную. Так она остаётся непрерывной при любом сдвиге стола. */
    if (dom.canvasGrid) {
      const workspace = dom.canvasWorkspace;
      const width = Math.max(1, workspace.clientWidth || 1);
      const height = Math.max(1, workspace.clientHeight || 1);
      const zoom = rt.canvasZoom;
      const size = 22 * zoom;
      const originX = width / 2 + rt.canvasPanX - (width / 2) * zoom;
      const originY = height / 2 + rt.canvasPanY - (height / 2) * zoom;
      const offsetX = ((originX % size) + size) % size;
      const offsetY = ((originY % size) + size) % size;
      dom.canvasGrid.style.backgroundSize = `${size.toFixed(2)}px ${size.toFixed(2)}px`;
      dom.canvasGrid.style.backgroundPosition = `${offsetX.toFixed(2)}px ${offsetY.toFixed(2)}px`;
    }
  }

  function setCanvasPan(x, y) {
    rt.canvasPanX = x;
    rt.canvasPanY = y;
    applyCanvasTransform();
  }

  function setCanvasZoom(value, announce) {
    rt.canvasZoom = ZQ.clamp(value, 0.55, 2.4);
    applyCanvasTransform();
    dom.canvasZoomLabel.textContent = `${Math.round(rt.canvasZoom * 100)}%`;
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
    dom.canvasZoomLabel.textContent = '100%';
    if (announce) {
      setCanvasReply('масштаб', 'Масштаб и положение стола сброшены.');
    }
  }

  /* --------------------------- Схема -------------------------------- */

  function appendCoreControls(body) {
    const core = document.createElement('div');
    core.className = 'scheme-core';
    const label = document.createElement('span');
    label.className = 'scheme-core-label';
    label.textContent = 'ядро управления';
    core.appendChild(label);
    const text = document.createElement('span');
    text.className = 'scheme-core-text';
    text.textContent = 'WASD или стрелки — идти · E — действие · Enter — команда · Space — печать';
    core.appendChild(text);
    body.appendChild(core);
  }

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

    appendCoreControls(scheme);
    body.appendChild(scheme);
  }

  function renderGamepadScheme(body) {
    const scheme = document.createElement('div');
    scheme.className = 'scheme-reference';
    const title = document.createElement('p');
    title.className = 'scheme-intro';
    title.textContent = 'Геймпад остаётся для движения и действия. Клавиши стола настраиваются на клавиатуре и запускают связанные цели.';
    scheme.appendChild(title);

    const grid = document.createElement('div');
    grid.className = 'scheme-reference-grid';
    const rows = [
      ['D-pad / левый стик', 'движение'],
      ['A', 'действие'],
      ['B / SELECT', 'стоп'],
      ['START', 'настройки']
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
    appendCoreControls(scheme);
    body.appendChild(scheme);
  }

  function renderMouseScheme(body) {
    const scheme = document.createElement('div');
    scheme.className = 'scheme-reference';
    const title = document.createElement('p');
    title.className = 'scheme-intro';
    title.textContent = tl(
      'Мышь работает на столе: перетаскивай элементы, двигай полотно и меняй масштаб.',
      'The mouse works on the table: drag elements, move the canvas and change the scale.',
      'Die Maus funktioniert am Tisch: Elemente ziehen, Fläche bewegen und Maßstab ändern.'
    );
    scheme.appendChild(title);

    const grid = document.createElement('div');
    grid.className = 'scheme-reference-grid';
    for (const [control, action] of [
      [tl('ЛКМ', 'LMB', 'LMB'), tl('выбрать или перетащить элемент', 'select or drag an element', 'Element auswählen oder ziehen')],
      [tl('ЛКМ по пустому месту', 'LMB on empty space', 'LMB auf leerer Fläche'), tl('двигать полотно стола', 'pan the table canvas', 'Tischfläche verschieben')],
      [tl('Колесо', 'Wheel', 'Rad'), tl('масштаб', 'scale', 'Maßstab')]
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
    appendCoreControls(scheme);
    body.appendChild(scheme);
  }

  function renderPhoneScheme(body) {
    const scheme = document.createElement('div');
    scheme.className = 'scheme-reference';
    const title = document.createElement('p');
    title.className = 'scheme-intro';
    title.textContent = 'На телефоне движение и действие остаются на экранных кнопках. Клавиши стола — для клавиатуры.';
    scheme.appendChild(title);

    const grid = document.createElement('div');
    grid.className = 'scheme-reference-grid';
    for (const [control, action] of [
      ['D-pad', 'движение'],
      ['✦', 'действие'],
      ['Escape', 'закрыть раздел']
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
    appendCoreControls(scheme);
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
        if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyE', 'Space', 'Enter', 'Escape'].includes(code)) {
          button.classList.add('core');
        }
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
    ZQ.resetKeys();
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
    ZQ.resetKeys();
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

  dom.canvasExit.addEventListener('click', closeCanvas);
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
  dom.canvasZoomIn.addEventListener('click', () => setCanvasZoom(rt.canvasZoom + 0.15, true));
  dom.canvasZoomOut.addEventListener('click', () => setCanvasZoom(rt.canvasZoom - 0.15, true));
  dom.canvasZoomReset.addEventListener('click', () => resetCanvasView(true));
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

  /* Движение со стола: ровно одна клетка, плавно, за выбранное время. */
  const TILE_DIRECTIONS = {
    up: [0, -1, 'вверх'],
    down: [0, 1, 'вниз'],
    left: [-1, 0, 'влево'],
    right: [1, 0, 'вправо']
  };

  function moveTableTile(direction, seconds) {
    const dir = TILE_DIRECTIONS[direction];
    if (!dir || !rt.state || !rt.state.player) return false;
    const duration = ZQ.clamp(Number(seconds) || 1, 0.2, 60);
    const player = rt.state.player;
    const ok = ZQ.setCursorDestination(
      player.x + dir[0],
      player.y + dir[1],
      false,
      duration
    );
    if (ok) {
      setCanvasReply(
        `шаг ${dir[2]}`,
        `Ровно одна клетка за ${duration.toFixed(duration < 10 ? 1 : 0)} с.`
      );
    }
    return ok;
  }

  document.querySelectorAll('[data-canvas-move]').forEach((button) => {
    button.addEventListener('click', () => {
      const seconds = dom.canvasMoveSeconds
        ? Number(dom.canvasMoveSeconds.value) || 1
        : 1;
      moveTableTile(button.dataset.canvasMove, seconds);
    });
  });

  if (dom.canvasMoveStop) {
    dom.canvasMoveStop.addEventListener('click', () => {
      ZQ.stopMovement();
      setCanvasReply('стоп', 'Движение остановлено.');
    });
  }

  window.addEventListener('resize', () => {
    if (rt.termView === 'canvas') applyCanvasTransform();
    renderCanvasLinks();
  });

  /* Масштаб и панорамирование стола: колесо, щипок и ЛКМ по пустому месту. */
  dom.canvasWorkspace.addEventListener('wheel', (event) => {
    if (event.deltaY === 0) return;
    event.preventDefault();
    const factor = event.deltaY < 0 ? 1.1 : 1 / 1.1;
    setCanvasZoom(rt.canvasZoom * factor, true);
  }, { passive: false });

  const canvasPointers = new Map();

  function pinchingDistance() {
    const points = Array.from(canvasPointers.values());
    if (points.length < 2) return 0;
    return Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y);
  }

  dom.canvasWorkspace.addEventListener('pointerdown', (event) => {
    canvasPointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (canvasPointers.size === 2) {
      event.stopPropagation();
      rt.canvasDrag = null;
      rt.workspacePan = null;
      dom.canvasWorkspace.classList.remove('panning');
      dom.canvasElements.querySelectorAll('.cv-el.dragging').forEach((node) => {
        node.classList.remove('dragging');
      });
      rt.canvasPinch = {
        distance: pinchingDistance(),
        zoom: rt.canvasZoom
      };
      return;
    }
    if (event.button !== undefined && event.button !== 0) return;
    if (event.target.closest('.cv-el')) return;
    if (dom.canvasDrawer && dom.canvasDrawer.contains(event.target)) return;
    if (dom.canvasKeys && dom.canvasKeys.contains(event.target)) return;
    rt.workspacePan = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      panX: rt.canvasPanX,
      panY: rt.canvasPanY
    };
    dom.canvasWorkspace.classList.add('panning');
    event.preventDefault();
  }, { capture: true });

  window.addEventListener('pointermove', (event) => {
    if (rt.workspacePan && rt.workspacePan.pointerId === event.pointerId) {
      event.preventDefault();
      setCanvasPan(
        rt.workspacePan.panX + (event.clientX - rt.workspacePan.startX),
        rt.workspacePan.panY + (event.clientY - rt.workspacePan.startY)
      );
      return;
    }
    if (!canvasPointers.has(event.pointerId)) return;
    canvasPointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (!rt.canvasPinch || canvasPointers.size < 2) return;
    event.preventDefault();
    const distance = pinchingDistance();
    if (rt.canvasPinch.distance > 0 && distance > 0) {
      setCanvasZoom(rt.canvasPinch.zoom * (distance / rt.canvasPinch.distance), false);
    }
  }, { passive: false });

  const clearCanvasPointer = (event) => {
    canvasPointers.delete(event.pointerId);
    if (canvasPointers.size < 2) rt.canvasPinch = null;
    if (rt.workspacePan && rt.workspacePan.pointerId === event.pointerId) {
      rt.workspacePan = null;
      dom.canvasWorkspace.classList.remove('panning');
    }
  };
  window.addEventListener('pointerup', clearCanvasPointer);
  window.addEventListener('pointercancel', clearCanvasPointer);

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
  ZQ.renderKeyScheme = renderKeyScheme;
  ZQ.renderKeyboardScheme = renderKeyboardScheme;
  ZQ.moveTableTile = moveTableTile;
  ZQ.openCardDetail = openCardDetail;
  ZQ.closeCardDetail = closeCardDetail;
  ZQ.openCanvas = openCanvas;
  ZQ.closeCanvas = closeCanvas;
})();
