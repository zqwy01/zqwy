/* Лабиринт сознаний — игровая логика прототипа.
   Мир, рюкзаки, терминал, canvas и испытание связаны здесь. */
(function () {
  'use strict';

  const C = window.CONFIG;
  const $ = (id) => document.getElementById(id);

  /* ------------------------------------------------------------------ */
  /* Мелкие помощники                                                    */
  /* ------------------------------------------------------------------ */

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function lerp(from, to, amount) {
    return from + (to - from) * amount;
  }

  function now() {
    return (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
  }

  function plural(n, forms) {
    const abs = Math.abs(n) % 100;
    const last = abs % 10;
    if (abs > 10 && abs < 20) return forms[2];
    if (last > 1 && last < 5) return forms[1];
    if (last === 1) return forms[0];
    return forms[2];
  }

  function makeId(prefix) {
    return `${prefix}_${Date.now().toString(36)}_${Math.floor(Math.random() * 1e6).toString(36)}`;
  }

  /* ------------------------------------------------------------------ */
  /* DOM                                                                 */
  /* ------------------------------------------------------------------ */

  const dom = {
    app: $('app'),
    stage: $('stage'),
    worldCanvas: $('world-canvas'),
    btnAction: $('btn-action'),
    divider: $('divider'),

    log: $('log'),
    termContext: $('term-context'),
    commandForm: $('command-form'),
    commandInput: $('command-input'),
    viewMain: $('view-main'),

    deathView: $('view-death'),
    deathText: $('death-text'),
    deathContinue: $('death-continue'),

    storyView: $('view-story'),
    storySpeaker: $('story-speaker'),
    storyTitle: $('story-title'),
    storyLines: $('story-lines'),
    storyContinue: $('story-continue'),

    trialView: $('view-trial'),
    trialStage: $('trial-stage'),
    trialCanvas: $('trial-canvas'),
    trialConsole: $('trial-console'),
    trialSeals: $('trial-seals'),
    trialSparks: $('trial-sparks'),
    trialTime: $('trial-time'),
    trialHint: $('trial-hint'),
    trialAbort: $('trial-abort'),
    trialResult: $('trial-result'),
    trialResultEyebrow: $('trial-result-eyebrow'),
    trialResultTitle: $('trial-result-title'),
    trialResultText: $('trial-result-text'),
    trialResultBtn: $('trial-result-btn'),
    trialSealBtn: $('trial-seal'),

    inventoryView: $('view-inventory'),
    inventoryList: $('inventory-list'),
    inventoryClose: $('inventory-close'),
    inventoryNote: $('inventory-note'),

    mapView: $('view-map'),
    mapCanvas: $('map-canvas'),
    mapNote: $('map-note'),
    mapClose: $('map-close'),

    canvasView: $('view-canvas'),
    canvasExit: $('canvas-exit'),
    canvasAddToggle: $('canvas-add-toggle'),
    canvasLinkToggle: $('canvas-link-toggle'),
    canvasHint: $('canvas-hint'),
    canvasWorkspace: $('canvas-workspace'),
    canvasStage: $('canvas-stage'),
    canvasElements: $('canvas-elements'),
    canvasEmpty: $('canvas-empty'),
    canvasDrawer: $('canvas-drawer'),
    canvasDrawerClose: $('canvas-drawer-close'),
    canvasAddList: $('canvas-add-list'),
    canvasResponseCommand: $('canvas-response-command'),
    canvasResponseReply: $('canvas-response-reply'),
    canvasZoomIn: $('canvas-zoom-in'),
    canvasZoomOut: $('canvas-zoom-out'),
    canvasZoomReset: $('canvas-zoom-reset'),
    canvasZoomLabel: $('canvas-zoom-label'),

    cardView: $('view-card'),
    cardTitle: $('card-title'),
    cardArt: $('card-art'),
    cardCommand: $('card-command'),
    cardDescription: $('card-description'),
    cardState: $('card-state'),
    cardRun: $('card-run'),
    cardPlace: $('card-place'),
    cardBack: $('card-back'),
    cardClose: $('card-close')
  };

  const VIEWS = {
    main: dom.viewMain,
    inventory: dom.inventoryView,
    map: dom.mapView,
    canvas: dom.canvasView,
    card: dom.cardView,
    story: dom.storyView,
    death: dom.deathView,
    trial: dom.trialView
  };

  /* ------------------------------------------------------------------ */
  /* Состояние                                                           */
  /* ------------------------------------------------------------------ */

  const DEFAULT_SEED = 'zqwy-labyrinth-01';
  const SAVE_VERSION = 1;

  let world = null;
  let state = null;
  let images = null;
  let worldCtx = null;
  let lastFrame = 0;
  let keys = Object.create(null);
  let invulnUntil = 0;
  let promptLabel = '';
  let activePrompt = null;
  let audio = null;

  let termView = 'main';
  let cardOrigin = 'canvas';

  let storyActive = false;
  const storyQueue = [];

  let canvasLinkMode = false;
  let linkFirstId = null;
  let canvasDrag = null;
  let canvasZoom = 1;
  let canvasPinch = null;

  let splitRatio = 0.56;
  let splitDrag = null;
  const SPLIT_KEY = 'zqwy.labyrinth.split.v1';
  const DIVIDER_H = 10;

  let trial = null;
  let trialRaf = 0;

  let logBusy = false;
  let logToken = 0;
  const logQueue = [];

  /* ------------------------------------------------------------------ */
  /* Сохранение                                                          */
  /* ------------------------------------------------------------------ */

  function defaultState(seed) {
    return {
      version: SAVE_VERSION,
      seed,
      player: { x: 0, y: 0, facingX: 0, facingY: -1, moving: false },
      camera: { x: 0, y: 0 },
      animTime: 0,
      currentRoomId: null,
      flags: {},
      visited: {},
      items: [],
      backpacks: [],
      mapMarks: [],
      canvasElements: [],
      storySeen: {},
      deaths: 0
    };
  }

  function readSave() {
    try {
      const raw = window.localStorage.getItem(C.saveKey);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : null;
    } catch (error) {
      return null;
    }
  }

  function saveGame() {
    if (!state || !state.player) return;
    try {
      const data = {
        version: SAVE_VERSION,
        seed: state.seed,
        player: {
          x: state.player.x,
          y: state.player.y,
          facingX: state.player.facingX,
          facingY: state.player.facingY
        },
        flags: state.flags,
        visited: state.visited,
        items: state.items,
        backpacks: state.backpacks,
        mapMarks: state.mapMarks,
        canvasElements: state.canvasElements,
        storySeen: state.storySeen,
        deaths: state.deaths
      };
      window.localStorage.setItem(C.saveKey, JSON.stringify(data));
    } catch (error) {
      /* Приватный режим или переполнение — игра продолжает работать. */
    }
  }

  function knownItemId(id) {
    return Object.prototype.hasOwnProperty.call(C.items, id);
  }

  function normalizeCanvasElement(raw) {
    if (!raw || typeof raw !== 'object') return null;
    if (!['command', 'card', 'map', 'seq'].includes(raw.kind)) return null;
    const element = {
      id: typeof raw.id === 'string' ? raw.id : makeId('cv'),
      kind: raw.kind,
      itemId: typeof raw.itemId === 'string' && knownItemId(raw.itemId) ? raw.itemId : null,
      command: typeof raw.command === 'string' ? raw.command : null,
      label: typeof raw.label === 'string' ? raw.label : '',
      sub: typeof raw.sub === 'string' ? raw.sub : '',
      nx: Number.isFinite(raw.nx) ? clamp(raw.nx, 0.04, 0.96) : 0.5,
      ny: Number.isFinite(raw.ny) ? clamp(raw.ny, 0.04, 0.96) : 0.5,
      commands: Array.isArray(raw.commands) ? raw.commands.filter((c) => typeof c === 'string') : null,
      requires: Array.isArray(raw.requires) ? raw.requires.filter((id) => knownItemId(id)) : []
    };
    if (element.kind === 'seq' && (!element.commands || !element.commands.length)) return null;
    if (element.kind !== 'seq' && element.itemId) {
      const item = C.items[element.itemId];
      if (!element.command) element.command = item.command || null;
      if (!element.label) element.label = item.name;
    }
    return element;
  }

  function hydrateState(saved) {
    if (!saved) return;
    if (saved.player &&
        Number.isFinite(saved.player.x) &&
        Number.isFinite(saved.player.y)) {
      state.player.x = saved.player.x;
      state.player.y = saved.player.y;
      state.player.facingX = Number.isFinite(saved.player.facingX) ? saved.player.facingX : 0;
      state.player.facingY = Number.isFinite(saved.player.facingY) ? saved.player.facingY : -1;
    }
    if (saved.flags && typeof saved.flags === 'object') state.flags = saved.flags;
    if (saved.visited && typeof saved.visited === 'object') state.visited = saved.visited;
    if (Array.isArray(saved.items)) {
      state.items = saved.items.filter((id) => typeof id === 'string' && knownItemId(id));
    }
    if (Array.isArray(saved.backpacks)) {
      state.backpacks = saved.backpacks
        .filter((bp) => bp && Number.isFinite(bp.x) && Number.isFinite(bp.y))
        .map((bp) => ({
          id: typeof bp.id === 'string' ? bp.id : makeId('bp'),
          x: bp.x,
          y: bp.y,
          roomId: typeof bp.roomId === 'string' ? bp.roomId : null,
          items: Array.isArray(bp.items) ? bp.items.filter((id) => knownItemId(id)) : [],
          cause: typeof bp.cause === 'string' ? bp.cause : 'unknown',
          createdAt: Number.isFinite(bp.createdAt) ? bp.createdAt : Date.now()
        }));
    }
    if (Array.isArray(saved.mapMarks)) {
      state.mapMarks = saved.mapMarks.filter((id) => typeof id === 'string');
    }
    if (Array.isArray(saved.canvasElements)) {
      state.canvasElements = saved.canvasElements
        .map(normalizeCanvasElement)
        .filter(Boolean);
    }
    if (saved.storySeen && typeof saved.storySeen === 'object') state.storySeen = saved.storySeen;
    if (Number.isFinite(saved.deaths)) state.deaths = saved.deaths;
  }

  /* ------------------------------------------------------------------ */
  /* Области интерфейса: игра, терминал, разделитель                     */
  /* ------------------------------------------------------------------ */

  function setTerminalView(name) {
    if (!VIEWS[name]) name = 'main';
    termView = name;
    for (const key of Object.keys(VIEWS)) {
      VIEWS[key].classList.toggle('hidden', key !== name);
    }
    if (name === 'inventory') renderInventory();
    if (name === 'map') {
      window.requestAnimationFrame(() => {
        drawMapNow();
        window.requestAnimationFrame(drawMapNow);
      });
    }
    if (name === 'canvas') renderCanvasElements();
    if (name === 'main') updatePrompt();
  }

  function ensureTerminalShare(minShare) {
    if (1 - splitRatio < minShare) applySplit(1 - minShare, true);
  }

  function readSplitPreference() {
    try {
      const raw = window.localStorage.getItem(SPLIT_KEY);
      const value = raw === null ? NaN : Number(raw);
      return Number.isFinite(value) ? value : null;
    } catch (error) {
      return null;
    }
  }

  function splitBounds() {
    const height = Math.max(1, dom.app.clientHeight - DIVIDER_H);
    const minPlay = Math.min(170, height * 0.5);
    const minTerminal = Math.min(150, height * 0.5);
    let low = Math.max(0.18, minPlay / height);
    let high = Math.min(0.82, 1 - minTerminal / height);
    if (low > high) {
      low = 0.42;
      high = 0.58;
    }
    return { low, high, height };
  }

  function applySplit(value, persist) {
    const bounds = splitBounds();
    splitRatio = clamp(value, bounds.low, bounds.high);
    dom.app.style.gridTemplateRows = `minmax(0, ${splitRatio}fr) ${DIVIDER_H}px minmax(0, ${1 - splitRatio}fr)`;
    const percent = Math.round(splitRatio * 100);
    dom.divider.setAttribute('aria-valuenow', String(percent));
    if (persist) {
      try {
        window.localStorage.setItem(SPLIT_KEY, String(splitRatio));
      } catch (error) {
        /* Приватный режим: размер просто не сохранится. */
      }
    }
  }

  function splitFromPointer(clientY) {
    const rect = dom.app.getBoundingClientRect();
    const height = Math.max(1, rect.height - DIVIDER_H);
    applySplit((clientY - rect.top) / height, true);
  }

  function initDivider() {
    const saved = readSplitPreference();
    applySplit(Number.isFinite(saved) ? saved : splitRatio, false);

    dom.divider.addEventListener('pointerdown', (event) => {
      if (event.button !== undefined && event.button !== 0) return;
      event.preventDefault();
      splitDrag = event.pointerId;
      dom.divider.classList.add('dragging');
      document.body.classList.add('split-dragging');
      try {
        dom.divider.setPointerCapture(event.pointerId);
      } catch (error) {
        /* ignored */
      }
      splitFromPointer(event.clientY);
    });

    dom.divider.addEventListener('pointermove', (event) => {
      if (splitDrag !== event.pointerId) return;
      event.preventDefault();
      splitFromPointer(event.clientY);
    });

    const finish = (event) => {
      if (splitDrag !== event.pointerId) return;
      splitDrag = null;
      dom.divider.classList.remove('dragging');
      document.body.classList.remove('split-dragging');
      try {
        dom.divider.releasePointerCapture(event.pointerId);
      } catch (error) {
        /* ignored */
      }
      applySplit(splitRatio, true);
    };
    dom.divider.addEventListener('pointerup', finish);
    dom.divider.addEventListener('pointercancel', finish);

    dom.divider.addEventListener('keydown', (event) => {
      if (event.code === 'ArrowUp') {
        event.preventDefault();
        applySplit(splitRatio - 0.03, true);
      } else if (event.code === 'ArrowDown') {
        event.preventDefault();
        applySplit(splitRatio + 0.03, true);
      } else if (event.code === 'Home') {
        event.preventDefault();
        applySplit(0.56, true);
      }
    });

    window.addEventListener('resize', () => {
      applySplit(splitRatio, false);
      if (termView === 'map') drawMapNow();
    });
  }

  /* ------------------------------------------------------------------ */
  /* Мир: движение, комнаты, рюкзаки                                     */
  /* ------------------------------------------------------------------ */

  function canStandAt(x, y) {
    const r = C.player.radius;
    const points = [
      [x, y],
      [x - r, y - r], [x + r, y - r],
      [x - r, y + r], [x + r, y + r],
      [x - r, y], [x + r, y],
      [x, y - r], [x, y + r]
    ];
    for (const point of points) {
      if (!world.isWalkable(Math.floor(point[0]), Math.floor(point[1]))) return false;
    }
    return true;
  }

  function roomUnderPlayer() {
    return world.roomAtTile(Math.floor(state.player.x), Math.floor(state.player.y));
  }

  function currentRoom() {
    const under = roomUnderPlayer();
    if (under) return under;
    return state.currentRoomId ? world.roomById(state.currentRoomId) : null;
  }

  function roomIdForPosition() {
    const under = roomUnderPlayer();
    if (under) return under.id;
    if (state.currentRoomId) return state.currentRoomId;
    let best = null;
    let bestDistance = Infinity;
    for (const room of world.rooms) {
      const dx = room.centerX + 0.5 - state.player.x;
      const dy = room.centerY + 0.5 - state.player.y;
      const d = dx * dx + dy * dy;
      if (d < bestDistance) {
        bestDistance = d;
        best = room;
      }
    }
    return best ? best.id : null;
  }

  function snapCamera() {
    state.camera.x = state.player.x;
    state.camera.y = state.player.y;
  }

  function respawnAtTablet() {
    state.player.x = world.spawn.x;
    state.player.y = world.spawn.y;
    state.player.facingX = 0;
    state.player.facingY = -1;
    state.player.moving = false;
    state.currentRoomId = null;
    snapCamera();
  }

  function updateMovement(dt) {
    let mx = 0;
    let my = 0;
    if (keys.up) my -= 1;
    if (keys.down) my += 1;
    if (keys.left) mx -= 1;
    if (keys.right) mx += 1;

    if (!mx && !my) {
      state.player.moving = false;
      return;
    }

    const length = Math.hypot(mx, my);
    mx /= length;
    my /= length;
    state.player.facingX = mx;
    state.player.facingY = my;
    state.player.moving = true;
    state.animTime += dt;

    const step = C.player.speed * dt;
    const nx = state.player.x + mx * step;
    if (canStandAt(nx, state.player.y)) state.player.x = nx;
    const ny = state.player.y + my * step;
    if (canStandAt(state.player.x, ny)) state.player.y = ny;
  }

  function updateCamera() {
    /* Камера без сглаживания и без прижатия к краям мира:
       Zemic всегда остаётся ровно в центре видимой области. */
    state.camera.x = state.player.x;
    state.camera.y = state.player.y;
  }

  function enterRoom(room) {
    if (!room) return;
    const firstVisit = !state.visited[room.id];
    state.currentRoomId = room.id;
    state.visited[room.id] = true;
    if (audio) audio.setCue(room.music);

    if (!firstVisit) return;

    saveGame();
    appendLog(`— ${room.name} —`, 'sys', true);

    if (room.role === 'trial') {
      queueStory('trial', () => {
        if (!state.flags.trialDone && !trial) {
          state.flags.trialAttempted = true;
          startTrial();
        }
      });
      return;
    }

    if (C.story[room.role]) {
      queueStory(room.role);
      return;
    }

    const ambient = C.ambientRoomLines[
      window.World.hashString(`${state.seed}:ambient:${room.id}`) % C.ambientRoomLines.length
    ];
    appendLog(ambient, 'story', true);
  }

  function updateRoomDetection() {
    const room = roomUnderPlayer();
    if (room && state.currentRoomId !== room.id) enterRoom(room);
  }

  function checkHazardDamage(time) {
    if (time < invulnUntil) return;
    if (isTyping()) return;
    const room = roomUnderPlayer();
    if (!room || room.role !== 'hazard') return;
    for (const shadow of world.shadows) {
      const angle = time * 0.001 * shadow.speed + shadow.phase;
      const px = shadow.cx + Math.cos(angle) * shadow.rx;
      const py = shadow.cy + Math.sin(angle * 1.13) * shadow.ry;
      const dx = state.player.x - px;
      const dy = state.player.y - py;
      if (dx * dx + dy * dy < 0.62 * 0.62) {
        die('shadow');
        return;
      }
    }
  }

  function die(cause) {
    if (!state) return;
    const roomId = roomIdForPosition();
    const backpack = {
      id: makeId('bp'),
      x: state.player.x,
      y: state.player.y,
      roomId,
      items: state.items.slice(),
      cause,
      createdAt: Date.now()
    };
    state.backpacks.push(backpack);
    state.items = [];
    state.deaths = (state.deaths || 0) + 1;
    respawnAtTablet();
    invulnUntil = now() + 2600;

    const room = roomId ? world.roomById(roomId) : null;
    const roomPhrase = room ? `в комнате «${room.name}»` : 'в переходе между комнатами';
    const count = backpack.items.length;
    dom.deathText.textContent = count
      ? `Ты снова у Скрижали. Рюкзак остался ${roomPhrase}: ${count} ${plural(count, ['предмет', 'предмета', 'предметов'])}. Он никуда не денется.`
      : `Ты снова у Скрижали. Рюкзак остался ${roomPhrase} — пустой, но никуда не денется.`;

    setTerminalView('death');
    dom.btnAction.classList.add('hidden');
    appendLog(C.story.death.lines[1], 'story', true);
    saveGame();
  }

  function collectItemPickup(pickup) {
    if (state.flags[`taken_${pickup.itemId}`]) return;
    state.flags[`taken_${pickup.itemId}`] = true;
    if (!state.items.includes(pickup.itemId)) state.items.push(pickup.itemId);
    const item = C.items[pickup.itemId];
    toast(`В рюкзаке: ${item ? item.name : pickup.itemId}`);
    appendLog(`Взято: ${item ? item.name : pickup.itemId}.`, 'reply', true);
    saveGame();
    updatePrompt();
  }

  function takeCard() {
    if (state.flags.cardTaken) return;
    state.flags.cardTaken = true;
    if (!state.items.includes('card_angel')) state.items.push('card_angel');
    toast('Получена карта «Очарование»');
    appendLog('Карта «Очарование» лежит в рюкзаке. Её можно вынести на canvas.', 'reply');
    saveGame();
    updatePrompt();
  }

  function retrieveBackpack(backpack) {
    const restored = [];
    for (const itemId of backpack.items) {
      if (!state.items.includes(itemId)) {
        state.items.push(itemId);
        const item = C.items[itemId];
        restored.push(item ? item.name : itemId);
      }
    }
    state.backpacks = state.backpacks.filter((bp) => bp.id !== backpack.id);
    if (restored.length) {
      toast(`Рюкзак возвращён: ${restored.join(', ')}`);
      appendLog(`Рюкзак возвращён. Внутри: ${restored.join(', ')}.`, 'reply');
    } else {
      toast('Пустой рюкзак возвращён');
      appendLog('Рюкзак возвращён. Внутри ничего не было.', 'reply');
    }
    saveGame();
    updatePrompt();
    if (termView === 'inventory') renderInventory();
    if (termView === 'canvas' || termView === 'card') renderCanvasElements();
  }

  function findInteractable() {
    const px = state.player.x;
    const py = state.player.y;
    let best = null;
    let bestDistance = Infinity;

    function consider(target, distance) {
      if (distance < bestDistance && distance <= 1.22) {
        bestDistance = distance;
        best = target;
      }
    }

    for (const pickup of world.itemPickups) {
      if (state.flags[`taken_${pickup.itemId}`]) continue;
      consider({ type: 'item', pickup }, Math.hypot(px - pickup.x, py - pickup.y));
    }

    for (const backpack of state.backpacks) {
      consider({ type: 'backpack', backpack }, Math.hypot(px - backpack.x, py - backpack.y));
    }

    const tabletDistance = Math.hypot(px - world.tablet.x, py - world.tablet.y);
    if (tabletDistance <= 1.65 && tabletDistance < bestDistance) {
      bestDistance = tabletDistance;
      best = { type: 'tablet' };
    }

    if (state.flags.trialDone && !state.flags.cardTaken && world.trialRoom) {
      const distance = Math.hypot(
        px - (world.trialRoom.centerX + 0.5),
        py - (world.trialRoom.centerY + 0.5)
      );
      if (distance <= 1.55 && distance < bestDistance) {
        bestDistance = distance;
        best = { type: 'card' };
      }
    }

    if (!state.flags.trialDone && world.trialRoom) {
      const distance = Math.hypot(
        px - (world.trialRoom.centerX + 0.5),
        py - (world.trialRoom.centerY + 0.5)
      );
      if (distance <= 1.55 && distance < bestDistance) {
        bestDistance = distance;
        best = { type: 'trial' };
      }
    }

    return best;
  }

  function promptFor(target) {
    if (!target) return '';
    if (target.type === 'item') {
      const item = C.items[target.pickup.itemId];
      return `взять «${item ? item.name : 'находка'}»`;
    }
    if (target.type === 'backpack') {
      const count = target.backpack.items.length;
      return count ? `подобрать рюкзак (${count})` : 'подобрать пустой рюкзак';
    }
    if (target.type === 'tablet') return 'коснуться Скрижали';
    if (target.type === 'card') return 'взять карту';
    if (target.type === 'trial') return 'войти в круг';
    return '';
  }

  function updatePrompt() {
    if (isPaused() || isTyping()) {
      activePrompt = null;
      promptLabel = '';
      dom.termContext.textContent = '';
      dom.btnAction.classList.add('hidden');
      return;
    }
    const target = findInteractable();
    activePrompt = target;
    const label = promptFor(target);
    if (!label) {
      promptLabel = '';
      dom.termContext.textContent = '';
      dom.btnAction.classList.add('hidden');
      return;
    }
    if (label !== promptLabel) {
      promptLabel = label;
      dom.btnAction.setAttribute('aria-label', label);
      dom.btnAction.textContent = '✦';
    }
    dom.termContext.textContent = `рядом: ${label} · E`;
    dom.btnAction.classList.remove('hidden');
  }

  function interact() {
    if (isPaused() || isTyping()) return;
    const target = findInteractable();
    if (!target) return;
    if (target.type === 'item') {
      collectItemPickup(target.pickup);
    } else if (target.type === 'backpack') {
      retrieveBackpack(target.backpack);
    } else if (target.type === 'tablet') {
      queueStory('tablet', null, true);
    } else if (target.type === 'card') {
      takeCard();
    } else if (target.type === 'trial') {
      startTrial();
    }
  }

  /* ------------------------------------------------------------------ */
  /* Сюжетные карточки                                                   */
  /* ------------------------------------------------------------------ */

  function queueStory(key, onClose, force) {
    const story = C.story[key];
    if (!story) {
      if (onClose) onClose();
      return;
    }
    if (!force && state.storySeen[key]) {
      if (onClose) onClose();
      return;
    }
    storyQueue.push({ key, onClose });
    pumpStory();
  }

  function pumpStory() {
    if (storyActive || !storyQueue.length) return;
    const entry = storyQueue.shift();
    const story = C.story[entry.key];
    storyActive = true;
    state.storySeen[entry.key] = true;
    saveGame();

    dom.storySpeaker.textContent = story.speaker || 'ЛАБИРИНТ';
    dom.storyTitle.textContent = story.title || '';
    dom.storyLines.textContent = '';
    for (const line of story.lines) {
      const p = document.createElement('p');
      p.textContent = line;
      dom.storyLines.appendChild(p);
    }

    setTerminalView('story');
    dom.btnAction.classList.add('hidden');
    keys = Object.create(null);

    dom.storyContinue.onclick = () => {
      setTerminalView('main');
      storyActive = false;
      saveGame();
      if (entry.onClose) {
        try {
          entry.onClose();
        } catch (error) {
          console.error(error);
        }
      }
      pumpStory();
    };
  }

  /* ------------------------------------------------------------------ */
  /* Смерть                                                              */
  /* ------------------------------------------------------------------ */

  dom.deathContinue.addEventListener('click', () => {
    setTerminalView('main');
    lastFrame = now();
    updatePrompt();
    appendLog('Ты у Скрижали.', 'sys', true);
  });

  /* ------------------------------------------------------------------ */
  /* Терминал                                                            */
  /* ------------------------------------------------------------------ */

  function appendLog(text, type, instant) {
    if (text === null || text === undefined || text === '') return;
    logQueue.push({ text: String(text), type: type || 'sys', instant: Boolean(instant) });
    pumpLog();
  }

  function clearLog() {
    logQueue.length = 0;
    logToken++;
    logBusy = false;
    dom.log.textContent = '';
  }

  function pumpLog() {
    if (logBusy) return;
    const entry = logQueue.shift();
    if (!entry) return;
    logBusy = true;

    const line = document.createElement('div');
    line.className = `log-line ${entry.type}`;
    dom.log.appendChild(line);
    dom.log.scrollTop = dom.log.scrollHeight;

    const finish = () => {
      logBusy = false;
      dom.log.scrollTop = dom.log.scrollHeight;
      pumpLog();
    };

    if (entry.instant || entry.text.length < 3) {
      line.textContent = entry.text;
      finish();
      return;
    }

    const token = ++logToken;
    const cursor = document.createElement('span');
    cursor.className = 'cursor';
    line.appendChild(cursor);
    let index = 0;

    const step = () => {
      if (token !== logToken) {
        line.textContent = entry.text;
        finish();
        return;
      }
      index = Math.min(entry.text.length, index + 2);
      line.textContent = entry.text.slice(0, index);
      if (index >= entry.text.length) {
        finish();
        return;
      }
      line.appendChild(cursor);
      dom.log.scrollTop = dom.log.scrollHeight;
      window.setTimeout(step, 16);
    };
    step();
  }

  function isTyping() {
    return document.activeElement === dom.commandInput;
  }

  function currentRoomDescription() {
    const room = currentRoom();
    if (!room) return 'Ты в переходе между комнатами. Здесь только камень и твоё дыхание.';
    let text;
    if (room.role === 'tablet') {
      text = 'Плоский камень теплее воздуха. Скрижаль не укрытие — просто место, где ты снова становишься собой.';
    } else if (room.role === 'hazard') {
      text = 'Тени не гонятся. Они оказываются там, куда ты собирался шагнуть. Смотри на просветы между ними.';
    } else if (room.role === 'low') {
      text = 'Низкий свод заставляет согнуться. Здесь легко потерять направление.';
    } else if (room.role === 'trial') {
      text = state.flags.trialDone
        ? 'Круг молчит. Печати погасли, и в центре больше ничего нет.'
        : 'Круг проступает на полу. Он не объясняет правил.';
    } else if (room.role === 'storage') {
      text = 'Сухая бумага, пыль, чьи-то аккуратные полки. Здесь что-то оставили до тебя.';
    } else if (room.role === 'crossroad') {
      text = 'На стене четыре чёрточки: три длинные, одна короткая. Под ними — стёртая фраза.';
    } else {
      const index = window.World.hashString(`${state.seed}:look:${room.id}`) % C.ambientRoomLines.length;
      text = C.ambientRoomLines[index];
    }

    const details = [];
    if (room.links && room.links.length) {
      details.push(`выходов: ${room.links.length}`);
    }
    const hasPickup = world.itemPickups.some((p) =>
      !state.flags[`taken_${p.itemId}`] && p.roomId === room.id
    );
    if (hasPickup) details.push('рядом что-то лежит');
    const hasBackpack = state.backpacks.some((bp) => bp.roomId === room.id);
    if (hasBackpack) details.push('здесь оставлен рюкзак');
    if (details.length) text += ` (${details.join('; ')}).`;
    return text;
  }

  function inventorySummary() {
    if (!state.items.length) return 'Рюкзак пуст.';
    const names = state.items.map((id) => (C.items[id] ? C.items[id].name : id));
    return `Рюкзак: ${names.join(', ')}. Предметов: ${state.items.length}.`;
  }

  function mapMark() {
    if (!state.items.includes('chalk')) {
      return 'У тебя нет угольного мелка. Метку не поставить.';
    }
    const room = currentRoom();
    if (!room) return 'Здесь не на что поставить метку.';
    if (state.mapMarks.includes(room.id)) return `Комната «${room.name}» уже отмечена.`;
    state.mapMarks.push(room.id);
    saveGame();
    toast(`Метка: ${room.name}`);
    return `Метка поставлена: «${room.name}».`;
  }

  function nudgePlayer(dx, dy, directionName) {
    const distance = 0.86;
    const nx = state.player.x + dx * distance;
    const ny = state.player.y + dy * distance;
    if (!canStandAt(nx, ny)) return `Дальше стена. В ${directionName} не пройти.`;
    state.player.x = nx;
    state.player.y = ny;
    state.player.facingX = dx;
    state.player.facingY = dy;
    state.player.moving = false;
    state.animTime += 0.18;
    updateRoomDetection();
    updatePrompt();
    return `Шаг ${directionName}. Камень отзывается глухо.`;
  }

  function handleCommand(raw, source) {
    source = source || 'terminal';
    const text = String(raw === null || raw === undefined ? '' : raw).trim();
    const cmd = text.toLowerCase().replace(/\s+/g, ' ');
    let reply = '';

    if (!text) return '';

    if (cmd === 'помоги' || cmd === 'помощь') {
      reply = C.terminal.help;
    } else if (cmd === 'привет') {
      reply = 'Терминал отвечает с задержкой, будто подбирает слова. Привет.';
    } else if (cmd === 'ты куда пропал') {
      reply = 'Я не уходил. Я ждал, пока ты снова наберёшь команду.';
    } else if (cmd === 'подойди') {
      const distance = Math.hypot(
        state.player.x - world.tablet.x,
        state.player.y - world.tablet.y
      );
      reply = distance <= 1.7
        ? 'Скрижаль уже под ладонью. Терминал остаётся там, где был.'
        : 'Терминал не двигается. Это ты можешь подойти к Скрижали сам.';
    } else if (cmd === 'вверх') {
      reply = nudgePlayer(0, -1, 'вверх');
    } else if (cmd === 'вниз') {
      reply = nudgePlayer(0, 1, 'вниз');
    } else if (cmd === 'влево') {
      reply = nudgePlayer(-1, 0, 'влево');
    } else if (cmd === 'вправо') {
      reply = nudgePlayer(1, 0, 'вправо');
    } else if (cmd === 'стоп') {
      keys = Object.create(null);
      state.player.moving = false;
      reply = 'Движение остановлено.';
    } else if (cmd === 'осмотреться') {
      reply = currentRoomDescription();
    } else if (cmd === 'рюкзак') {
      reply = inventorySummary();
      if (source === 'terminal') openInventory();
    } else if (cmd === 'карта') {
      if (state.items.includes('map_fragment')) {
        reply = 'Обрывок карты разворачивается. Виден весь участок и твои метки.';
        if (source === 'terminal') openMap();
      } else {
        reply = 'У тебя нет обрывка карты. Дорогу пока приходится помнить самому.';
      }
    } else if (cmd === 'canvas') {
      reply = source === 'terminal'
        ? 'Рабочая поверхность открыта. Предметы и команды можно разложить самому.'
        : 'Ты уже на canvas.';
      if (source === 'terminal') openCanvas();
    } else if (cmd === 'пометить') {
      reply = mapMark();
    } else if (cmd === 'очаровать') {
      reply = 'Очарование: способность ещё не подключена. Это временная нейтральная заглушка — эффект появится позже.';
    } else if (cmd === 'очисти') {
      if (source === 'terminal') {
        clearLog();
        C.terminal.greeting.forEach((line) => appendLog(line, 'sys', true));
      }
      return '';
    } else {
      reply = `${C.terminal.unknown}«${text}»`;
    }

    if (reply) {
      if (source === 'canvas') {
        setCanvasReply(text, reply);
        appendLog(text, 'cmd', true);
        appendLog(reply, 'reply', true);
      } else {
        appendLog(reply, 'reply');
      }
    }
    return reply;
  }

  dom.commandForm.addEventListener('submit', (event) => {
    event.preventDefault();
    if (isPaused()) {
      appendLog('Сейчас не до команд.', 'sys', true);
      return;
    }
    const value = dom.commandInput.value.trim();
    if (!value) return;
    dom.commandInput.value = '';
    appendLog(value, 'cmd', true);
    handleCommand(value, 'terminal');
  });

  dom.commandInput.addEventListener('focus', () => {
    dom.termContext.textContent = '';
    dom.btnAction.classList.add('hidden');
  });

  dom.commandInput.addEventListener('blur', () => {
    updatePrompt();
  });

  /* ------------------------------------------------------------------ */
  /* Рюкзак                                                              */
  /* ------------------------------------------------------------------ */

  function itemThumb(item) {
    if (item.kind === 'card' && item.art) {
      const thumb = document.createElement('div');
      thumb.className = 'inv-thumb';
      const img = document.createElement('img');
      img.src = item.art;
      img.alt = '';
      thumb.appendChild(img);
      return thumb;
    }
    const thumb = document.createElement('div');
    thumb.className = 'inv-thumb';
    if (item.kind === 'map') thumb.classList.add('map-thumb');
    else if (item.id === 'chalk') thumb.classList.add('chalk-thumb');
    else if (item.id === 'bead') thumb.classList.add('bead-thumb');
    return thumb;
  }

  function renderInventory() {
    dom.inventoryList.textContent = '';
    if (!state.items.length) {
      const empty = document.createElement('div');
      empty.className = 'inv-empty';
      empty.textContent = 'Пусто. Всё, что было, осталось на месте смерти — или ещё не найдено.';
      dom.inventoryList.appendChild(empty);
    }

    for (const itemId of state.items) {
      const item = C.items[itemId];
      if (!item) continue;
      const row = document.createElement('div');
      row.className = 'inv-item';

      row.appendChild(itemThumb(item));

      const copy = document.createElement('div');
      copy.className = 'inv-copy';
      const name = document.createElement('div');
      name.className = 'inv-name';
      name.textContent = item.name;
      copy.appendChild(name);
      if (item.command) {
        const cmd = document.createElement('div');
        cmd.className = 'inv-command';
        cmd.textContent = `> ${item.command}`;
        copy.appendChild(cmd);
      }
      const desc = document.createElement('div');
      desc.className = 'inv-desc';
      desc.textContent = item.description;
      copy.appendChild(desc);
      row.appendChild(copy);

      const actions = document.createElement('div');
      actions.className = 'inv-actions';

      if (item.kind === 'card' && item.art) {
        const open = document.createElement('button');
        open.type = 'button';
        open.className = 'inv-btn';
        open.textContent = 'открыть';
        open.addEventListener('click', () => {
          openCardDetail(item.id, 'inventory');
        });
        actions.appendChild(open);
      }

      if (item.command) {
        const run = document.createElement('button');
        run.type = 'button';
        run.className = 'inv-btn accent';
        run.textContent = item.action || 'выполнить';
        run.addEventListener('click', () => {
          closeInventory();
          handleCommand(item.command, 'terminal');
        });
        actions.appendChild(run);
      }

      if (item.command || item.art) {
        const place = document.createElement('button');
        place.type = 'button';
        place.className = 'inv-btn';
        place.textContent = 'на canvas';
        place.addEventListener('click', () => {
          closeInventory();
          addItemElement(item.id, true);
        });
        actions.appendChild(place);
      }

      row.appendChild(actions);
      dom.inventoryList.appendChild(row);
    }

    if (dom.inventoryNote) {
      const backpacks = state.backpacks.length;
      dom.inventoryNote.textContent = backpacks
        ? `В Лабиринте осталось рюкзаков: ${backpacks}. Предметы на canvas остаются на месте, но недоступны, пока рюкзак не возвращён.`
        : 'Предметы можно вынести на canvas и запускать их команды быстрым нажатием.';
    }
  }

  function openInventory() {
    if (isStoryOrDeathOrTrial()) return;
    ensureTerminalShare(0.42);
    renderInventory();
    setTerminalView('inventory');
    keys = Object.create(null);
  }

  function closeInventory() {
    setTerminalView('main');
    updatePrompt();
  }

  dom.inventoryClose.addEventListener('click', closeInventory);

  /* ------------------------------------------------------------------ */
  /* Карта                                                               */
  /* ------------------------------------------------------------------ */

  function updateMapNote() {
    if (state.items.includes('map_fragment')) {
      dom.mapNote.textContent = 'Обрывок карты разворачивается целиком: видны все комнаты участка и оставленные рюкзаки.';
    } else {
      dom.mapNote.textContent = 'Пока это только память о пройденном и о соседних комнатах.';
    }
  }

  function drawMapNow() {
    try {
      window.Renderer.drawMap(dom.mapCanvas, state, world);
    } catch (error) {
      console.error(error);
    }
  }

  function openMap() {
    if (isStoryOrDeathOrTrial()) return;
    ensureTerminalShare(0.42);
    updateMapNote();
    setTerminalView('map');
    window.requestAnimationFrame(() => {
      drawMapNow();
      window.requestAnimationFrame(drawMapNow);
    });
    keys = Object.create(null);
  }

  function closeMap() {
    setTerminalView('main');
    updatePrompt();
  }

  dom.mapClose.addEventListener('click', closeMap);

  /* ------------------------------------------------------------------ */
  /* Canvas                                                              */
  /* ------------------------------------------------------------------ */

  function hasItem(itemId) {
    return state.items.includes(itemId);
  }

  function elementAvailable(element) {
    if (element.itemId) return hasItem(element.itemId);
    if (element.requires && element.requires.length) {
      return element.requires.every((id) => hasItem(id));
    }
    return true;
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
      id: makeId('cv'),
      kind,
      itemId: item.id,
      command: item.command || null,
      label: item.name,
      sub,
      nx: 0.5,
      ny: 0.5,
      commands: null,
      requires: [item.id]
    };
  }

  function makeElementForCommand(command) {
    return {
      id: makeId('cv'),
      kind: 'command',
      itemId: null,
      command,
      label: command,
      sub: 'команда',
      nx: 0.5,
      ny: 0.5,
      commands: null,
      requires: []
    };
  }

  function nextCanvasSpot() {
    const count = state.canvasElements.length;
    const columns = 3;
    const col = count % columns;
    const row = Math.floor(count / columns) % 3;
    return {
      nx: 0.24 + col * 0.26 + (Math.random() - 0.5) * 0.04,
      ny: 0.23 + row * 0.24 + (Math.random() - 0.5) * 0.04
    };
  }

  function addItemElement(itemId, openAfter) {
    const item = C.items[itemId];
    if (!item) return;
    const existing = state.canvasElements.find((element) => element.itemId === itemId);
    if (existing) {
      toast(`«${item.name}» уже на canvas`);
      if (openAfter) openCanvas();
      return;
    }
    const element = makeElementForItem(item);
    const spot = nextCanvasSpot();
    element.nx = spot.nx;
    element.ny = spot.ny;
    state.canvasElements.push(element);
    saveGame();
    if (openAfter) {
      openCanvas();
    } else {
      renderCanvasElements();
      renderCanvasDrawer();
    }
    setCanvasReply(item.name, 'Элемент добавлен. Нажми на него, чтобы выполнить команду.');
    toast(`На canvas: ${item.name}`);
  }

  function addCommandElement(command) {
    const element = makeElementForCommand(command);
    const spot = nextCanvasSpot();
    element.nx = spot.nx;
    element.ny = spot.ny;
    state.canvasElements.push(element);
    saveGame();
    renderCanvasElements();
    renderCanvasDrawer();
    setCanvasReply(command, 'Команда размещена. Нажми на неё, чтобы выполнить.');
  }

  function removeCanvasElement(id) {
    state.canvasElements = state.canvasElements.filter((element) => element.id !== id);
    if (linkFirstId === id) linkFirstId = null;
    saveGame();
    renderCanvasElements();
    renderCanvasDrawer();
  }

  function buildCanvasNode(element) {
    const node = document.createElement('div');
    node.className = `cv-el ${element.kind}`;
    if (!elementAvailable(element)) node.classList.add('disabled');
    if (element.id === linkFirstId) node.classList.add('selected');
    node.style.left = `${element.nx * 100}%`;
    node.style.top = `${element.ny * 100}%`;
    node.style.transform = 'translate(-50%, -50%)';
    node.dataset.id = element.id;

    if (element.kind === 'card') {
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

    if (element.kind === 'card' && element.itemId) {
      const open = document.createElement('button');
      open.type = 'button';
      open.className = 'el-open';
      open.textContent = 'открыть';
      open.addEventListener('pointerdown', (event) => {
        event.stopPropagation();
      });
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
        : 'выполнить';
    node.appendChild(run);

    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'el-remove';
    remove.setAttribute('aria-label', 'Убрать с canvas');
    remove.textContent = '×';
    remove.addEventListener('pointerdown', (event) => {
      event.stopPropagation();
    });
    remove.addEventListener('click', (event) => {
      event.stopPropagation();
      removeCanvasElement(element.id);
      setCanvasReply('убрано', 'Элемент снят с рабочей поверхности.');
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
      canvasDrag = {
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
      if (!canvasDrag || canvasDrag.pointerId !== event.pointerId || canvasDrag.node !== node) return;
      const dx = event.clientX - canvasDrag.startX;
      const dy = event.clientY - canvasDrag.startY;
      if (Math.hypot(dx, dy) > 4) canvasDrag.moved = true;
      if (!canvasDrag.moved) return;
      const nx = clamp(canvasDrag.startNx + dx / canvasDrag.rect.width, 0.06, 0.94);
      const ny = clamp(canvasDrag.startNy + dy / canvasDrag.rect.height, 0.06, 0.94);
      element.nx = nx;
      element.ny = ny;
      node.style.left = `${nx * 100}%`;
      node.style.top = `${ny * 100}%`;
    });

    const finish = (event) => {
      if (!canvasDrag || canvasDrag.pointerId !== event.pointerId || canvasDrag.node !== node) return;
      const moved = canvasDrag.moved;
      canvasDrag = null;
      node.classList.remove('dragging');
      try {
        node.releasePointerCapture(event.pointerId);
      } catch (error) {
        /* ignored */
      }
      if (moved) {
        saveGame();
        return;
      }
      if (event.target.closest('.el-remove')) return;
      if (canvasLinkMode) {
        chooseLinkTarget(element);
      } else {
        executeCanvasElement(element);
      }
    };

    node.addEventListener('pointerup', finish);
    node.addEventListener('pointercancel', (event) => {
      if (!canvasDrag || canvasDrag.pointerId !== event.pointerId || canvasDrag.node !== node) return;
      canvasDrag = null;
      node.classList.remove('dragging');
      saveGame();
    });
  }

  function renderCanvasElements() {
    dom.canvasElements.textContent = '';
    for (const element of state.canvasElements) {
      dom.canvasElements.appendChild(buildCanvasNode(element));
    }
    dom.canvasEmpty.classList.toggle('hidden', state.canvasElements.length > 0);
  }

  function renderCanvasDrawer() {
    dom.canvasAddList.textContent = '';

    for (const itemId of state.items) {
      const item = C.items[itemId];
      if (!item) continue;
      if (!item.command && !item.art) continue;
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'add-chip item';
      chip.textContent = item.name;
      const already = state.canvasElements.some((element) => element.itemId === itemId);
      chip.disabled = already;
      if (already) chip.textContent += ' · уже здесь';
      chip.addEventListener('click', () => {
        addItemElement(itemId, false);
        closeCanvasDrawer();
      });
      dom.canvasAddList.appendChild(chip);
    }

    const baseCommands = ['осмотреться', 'рюкзак', 'привет'];
    for (const command of baseCommands) {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'add-chip';
      chip.textContent = command;
      const already = state.canvasElements.some((element) =>
        element.kind === 'command' && element.command === command
      );
      chip.disabled = already;
      if (already) chip.textContent += ' · уже здесь';
      chip.addEventListener('click', () => {
        addCommandElement(command);
        closeCanvasDrawer();
      });
      dom.canvasAddList.appendChild(chip);
    }

    if (!dom.canvasAddList.children.length) {
      const note = document.createElement('span');
      note.className = 'canvas-tip';
      note.textContent = 'Пока нечего добавить. Найди предметы в Лабиринте.';
      dom.canvasAddList.appendChild(note);
    }
  }

  function commandsForElement(element) {
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

  function executeCanvasElement(element) {
    if (!elementAvailable(element)) {
      setCanvasReply(element.label || element.command || 'элемент', 'Недоступно: предмет остался в рюкзаке на месте смерти.');
      return;
    }
    const commands = commandsForElement(element);
    if (!commands.length) {
      setCanvasReply(element.label || 'элемент', 'У этого элемента нет команды.');
      return;
    }

    const replies = [];
    for (const command of commands) {
      const reply = handleCommand(command, 'canvas');
      if (reply) replies.push(reply);
    }
    setCanvasReply(commands.join(' · '), replies.filter(Boolean).join(' '));
  }

  function chooseLinkTarget(element) {
    if (!linkFirstId) {
      linkFirstId = element.id;
      renderCanvasElements();
      setCanvasReply('связать', 'Выбери второй элемент для связки.');
      return;
    }
    if (linkFirstId === element.id) {
      linkFirstId = null;
      renderCanvasElements();
      setCanvasReply('связать', 'Выбор снят.');
      return;
    }

    const first = state.canvasElements.find((el) => el.id === linkFirstId);
    const second = element;
    linkFirstId = null;
    if (!first) {
      renderCanvasElements();
      return;
    }

    const firstCommands = commandsForElement(first);
    const secondCommands = commandsForElement(second);
    if (!firstCommands.length || !secondCommands.length) {
      renderCanvasElements();
      setCanvasReply('связать', 'В связку можно взять только элементы с командами.');
      return;
    }

    const commands = [firstCommands[0], secondCommands[0]];
    const requires = Array.from(new Set([
      ...requiresForElement(first),
      ...requiresForElement(second)
    ]));
    const sequence = {
      id: makeId('cv'),
      kind: 'seq',
      itemId: null,
      command: null,
      label: 'связка',
      sub: commands.join(' → '),
      commands,
      requires,
      nx: (first.nx + second.nx) / 2,
      ny: (first.ny + second.ny) / 2
    };
    state.canvasElements.push(sequence);
    canvasLinkMode = false;
    dom.canvasLinkToggle.classList.remove('active');
    dom.canvasHint.textContent = 'Перетаскивай элементы. Нажми, чтобы выполнить команду.';
    setCanvasReply('связка', `${commands.join(' → ')}. Нажми на связку, чтобы выполнить обе команды.`);
    saveGame();
    renderCanvasElements();
    renderCanvasDrawer();
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

  function setCanvasZoom(value, announce) {
    canvasZoom = clamp(value, 0.55, 2.4);
    dom.canvasStage.style.transform = `scale(${canvasZoom.toFixed(4)})`;
    dom.canvasZoomLabel.textContent = `${Math.round(canvasZoom * 100)}%`;
    if (announce) {
      setCanvasReply('масштаб', `${Math.round(canvasZoom * 100)}%. Колесо или щипок тоже меняют масштаб.`);
    }
  }

  function openCardDetail(itemId, origin) {
    const item = C.items[itemId];
    if (!item || item.kind !== 'card' || !item.art) return;
    if (!state.items.includes(itemId)) return;
    cardOrigin = origin === 'inventory' ? 'inventory' : 'canvas';
    ensureTerminalShare(0.55);
    dom.cardTitle.textContent = item.name;
    dom.cardArt.src = item.art;
    dom.cardArt.alt = item.name;
    dom.cardCommand.textContent = item.command ? `> ${item.command}` : '';
    dom.cardDescription.textContent = item.description;
    dom.cardState.textContent = cardOrigin === 'inventory'
      ? 'состояние: в рюкзаке'
      : 'состояние: размещена на canvas';
    dom.cardRun.dataset.itemId = itemId;
    dom.cardRun.disabled = !item.command;
    dom.cardPlace.dataset.itemId = itemId;
    dom.cardBack.textContent = cardOrigin === 'inventory' ? '← к рюкзаку' : '← к canvas';
    dom.cardClose.setAttribute('aria-label', cardOrigin === 'inventory' ? 'Вернуться к рюкзаку' : 'Вернуться к canvas');
    setTerminalView('card');
    keys = Object.create(null);
  }

  function closeCardDetail() {
    if (cardOrigin === 'inventory') openInventory();
    else openCanvas();
  }

  function openCanvas() {
    if (isStoryOrDeathOrTrial()) return;
    ensureTerminalShare(0.46);
    renderCanvasElements();
    setTerminalView('canvas');
    setCanvasZoom(canvasZoom, false);
    setCanvasReply('готово', 'Перетаскивай элементы. Нажми на элемент, чтобы выполнить его команду.');
    keys = Object.create(null);
  }

  function closeCanvas() {
    if (canvasLinkMode) {
      canvasLinkMode = false;
      linkFirstId = null;
      dom.canvasLinkToggle.classList.remove('active');
    }
    closeCanvasDrawer();
    setTerminalView('main');
    saveGame();
    updatePrompt();
  }

  dom.canvasExit.addEventListener('click', closeCanvas);
  dom.cardBack.addEventListener('click', closeCardDetail);
  dom.cardClose.addEventListener('click', closeCardDetail);
  dom.cardRun.addEventListener('click', () => {
    const itemId = dom.cardRun.dataset.itemId;
    const item = itemId ? C.items[itemId] : null;
    if (!item || !item.command || !state.items.includes(itemId)) return;
    handleCommand(item.command, 'canvas');
    openCanvas();
  });
  dom.cardPlace.addEventListener('click', () => {
    const itemId = dom.cardPlace.dataset.itemId;
    if (!itemId || !state.items.includes(itemId)) return;
    addItemElement(itemId, true);
  });
  dom.canvasZoomIn.addEventListener('click', () => setCanvasZoom(canvasZoom + 0.15, true));
  dom.canvasZoomOut.addEventListener('click', () => setCanvasZoom(canvasZoom - 0.15, true));
  dom.canvasZoomReset.addEventListener('click', () => setCanvasZoom(1, true));
  dom.canvasAddToggle.addEventListener('click', () => {
    if (dom.canvasDrawer.classList.contains('hidden')) openCanvasDrawer();
    else closeCanvasDrawer();
  });
  dom.canvasDrawerClose.addEventListener('click', closeCanvasDrawer);
  dom.canvasLinkToggle.addEventListener('click', () => {
    canvasLinkMode = !canvasLinkMode;
    linkFirstId = null;
    dom.canvasLinkToggle.classList.toggle('active', canvasLinkMode);
    dom.canvasHint.textContent = canvasLinkMode
      ? 'Выбери два элемента с командами, чтобы получить связку.'
      : 'Перетаскивай элементы. Нажми, чтобы выполнить команду.';
    renderCanvasElements();
    setCanvasReply('связать', canvasLinkMode
      ? 'Выбери первый элемент.'
      : 'Режим связки выключен.');
  });

  /* Масштаб canvas: колесо и сенсорный щипок. */
  dom.canvasWorkspace.addEventListener('wheel', (event) => {
    if (event.deltaY === 0) return;
    event.preventDefault();
    const factor = event.deltaY < 0 ? 1.1 : 1 / 1.1;
    setCanvasZoom(canvasZoom * factor, true);
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
      canvasDrag = null;
      dom.canvasElements.querySelectorAll('.cv-el.dragging').forEach((node) => {
        node.classList.remove('dragging');
      });
      canvasPinch = {
        distance: pinchingDistance(),
        zoom: canvasZoom
      };
    }
  }, { capture: true });

  window.addEventListener('pointermove', (event) => {
    if (!canvasPointers.has(event.pointerId)) return;
    canvasPointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (!canvasPinch || canvasPointers.size < 2) return;
    event.preventDefault();
    const distance = pinchingDistance();
    if (canvasPinch.distance > 0 && distance > 0) {
      setCanvasZoom(canvasPinch.zoom * (distance / canvasPinch.distance), false);
    }
  }, { passive: false });

  const clearCanvasPointer = (event) => {
    canvasPointers.delete(event.pointerId);
    if (canvasPointers.size < 2) canvasPinch = null;
  };
  window.addEventListener('pointerup', clearCanvasPointer);
  window.addEventListener('pointercancel', clearCanvasPointer);

  /* ------------------------------------------------------------------ */
  /* Испытание Круга Очарования                                          */
  /* ------------------------------------------------------------------ */

  function resetTrialHint() {
    dom.trialHint.textContent = 'Двигайся. Печать закроется — нажми ПРОБЕЛ.';
  }

  function layoutTrial() {
    const size = window.Renderer.makeCanvasSize(dom.trialCanvas);
    trial.w = size.w;
    trial.h = size.h;
    trial.center.x = size.w / 2;
    trial.center.y = size.h / 2;
    trial.radius = Math.min(size.w, size.h) * 0.44;
    return size;
  }

  function updateTrialHud() {
    dom.trialSeals.textContent = `${trial.sealsClosed} / ${C.trial.sealsRequired}`;
    dom.trialSparks.textContent = String(trial.sparksLeft);
    dom.trialTime.textContent = Math.max(0, C.trial.duration - trial.elapsed).toFixed(1);
  }

  function pushTrialHint(text) {
    trial.hint = text;
    trial.hintUntil = trial.elapsed + 1.8;
    dom.trialHint.textContent = text;
  }

  function spawnSpark() {
    const angle = Math.random() * Math.PI * 2;
    const edge = {
      x: trial.center.x + Math.cos(angle) * trial.radius * 0.98,
      y: trial.center.y + Math.sin(angle) * trial.radius * 0.98
    };
    const aim = Math.atan2(
      trial.player.y - edge.y,
      trial.player.x - edge.x
    ) + (Math.random() - 0.5) * 0.42;
    const speed = 118 + Math.random() * 56 + trial.elapsed * 1.6;
    trial.projectiles.push({
      x: edge.x,
      y: edge.y,
      vx: Math.cos(aim) * speed,
      vy: Math.sin(aim) * speed,
      r: 3.2 + Math.random() * 1.5,
      life: 7
    });
  }

  function spawnBurst() {
    const count = 9;
    const offset = Math.random() * Math.PI * 2;
    for (let i = 0; i < count; i++) {
      const angle = offset + (i / count) * Math.PI * 2;
      const speed = 106 + Math.random() * 22;
      trial.projectiles.push({
        x: trial.center.x,
        y: trial.center.y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        r: 3.4,
        life: 6
      });
    }
    pushTrialHint('Круг выдохнул искры. Не стой на месте.');
  }

  function spawnSeal() {
    const angle = Math.random() * Math.PI * 2;
    const distance = trial.radius * 0.58 * Math.sqrt(Math.random());
    trial.activeSeal = {
      x: trial.center.x + Math.cos(angle) * distance,
      y: trial.center.y + Math.sin(angle) * distance,
      r: Math.max(24, trial.radius * 0.14),
      until: trial.elapsed + C.trial.sealWindow,
      born: trial.elapsed
    };
    pushTrialHint('Печать проступила. Встань в неё и нажми ПРОБЕЛ.');
  }

  function clampTrialPlayer() {
    const dx = trial.player.x - trial.center.x;
    const dy = trial.player.y - trial.center.y;
    const distance = Math.hypot(dx, dy);
    const limit = trial.radius - trial.playerRadius;
    if (distance > limit && distance > 0.001) {
      trial.player.x = trial.center.x + (dx / distance) * limit;
      trial.player.y = trial.center.y + (dy / distance) * limit;
    }
  }

  function finishTrial(outcome) {
    if (!trial) return;
    trial.active = false;
    if (trialRaf) {
      window.cancelAnimationFrame(trialRaf);
      trialRaf = 0;
    }
    keys = Object.create(null);

    if (outcome === 'death') {
      hideTrialStage();
      dom.trialResult.classList.add('hidden');
      trial = null;
      die('spark');
      return;
    }

    if (outcome === 'success') {
      state.flags.trialDone = true;
      state.flags.trialAttempted = true;
      saveGame();
      hideTrialStage();
      trial.resultKind = 'success';
      ensureTerminalShare(0.5);
      dom.trialResultEyebrow.textContent = 'КРУГ';
      dom.trialResultTitle.textContent = 'Круг принял';
      dom.trialResultText.textContent = `Печати сомкнулись. Искры остались позади. В центре круга проступает карта.`;
      dom.trialResultBtn.textContent = 'Забрать';
      setTerminalView('trial');
      dom.trialResult.classList.remove('hidden');
      return;
    }

    if (outcome === 'fail') {
      state.flags.trialAttempted = true;
      saveGame();
      hideTrialStage();
      trial.resultKind = 'fail';
      ensureTerminalShare(0.5);
      dom.trialResultEyebrow.textContent = 'КРУГ';
      dom.trialResultTitle.textContent = 'Круг не принял';
      dom.trialResultText.textContent = `Печатей закрыто: ${trial.sealsClosed}. Нужно не меньше ${C.trial.sealsRequired}. Ты можешь войти в круг снова — ничего не потеряно.`;
      dom.trialResultBtn.textContent = 'Выйти';
      setTerminalView('trial');
      dom.trialResult.classList.remove('hidden');
      return;
    }

    hideTrialStage();
    dom.trialResult.classList.add('hidden');
    trial = null;
    setTerminalView('main');
    toast('Круг остыл. Можно войти снова');
    appendLog('Ты покидаешь круг. Печати гаснут, но остаются на месте.', 'reply', true);
    updatePrompt();
    saveGame();
  }

  function showTrialStage() {
    dom.trialStage.classList.remove('hidden');
  }

  function hideTrialStage() {
    dom.trialStage.classList.add('hidden');
  }

  function attemptSeal() {
    if (!trial || !trial.active) return;
    if (!trial.activeSeal) {
      pushTrialHint('Печать ещё не проступила. Жди и двигайся.');
      return;
    }
    const seal = trial.activeSeal;
    const distance = Math.hypot(trial.player.x - seal.x, trial.player.y - seal.y);
    if (distance <= seal.r + trial.playerRadius) {
      trial.sealsClosed++;
      trial.activeSeal = null;
      trial.sealFlash = 1;
      if (trial.sealsClosed >= C.trial.sealsRequired) {
        pushTrialHint('Печати сомкнуты. Додержись до конца круга.');
      } else {
        pushTrialHint(`Печать закрыта (${trial.sealsClosed} / ${C.trial.sealsRequired}).`);
      }
      updateTrialHud();
    } else {
      pushTrialHint('Ты не внутри печати.');
    }
  }

  function updateTrial(dt) {
    const config = C.trial;
    trial.elapsed += dt;

    if (trial.nextSeal < config.sealTimes.length &&
        trial.elapsed >= config.sealTimes[trial.nextSeal]) {
      trial.nextSeal++;
      spawnSeal();
    }

    if (trial.activeSeal && trial.elapsed > trial.activeSeal.until) {
      trial.activeSeal = null;
      pushTrialHint('Печать погасла. Следующая будет позже.');
    }

    let mx = 0;
    let my = 0;
    if (keys.up) my -= 1;
    if (keys.down) my += 1;
    if (keys.left) mx -= 1;
    if (keys.right) mx += 1;
    if (mx || my) {
      const length = Math.hypot(mx, my);
      mx /= length;
      my /= length;
      const speed = Math.min(trial.w, trial.h) * 0.46;
      trial.player.x += mx * speed * dt;
      trial.player.y += my * speed * dt;
      trial.facingX = mx;
      trial.facingY = my;
      clampTrialPlayer();
    }

    trial.spawnTimer -= dt;
    if (trial.spawnTimer <= 0) {
      spawnSpark();
      trial.spawnTimer = Math.max(0.24, 0.58 - trial.elapsed * 0.007);
    }

    trial.burstTimer -= dt;
    if (trial.burstTimer <= 0) {
      spawnBurst();
      trial.burstTimer = 6.7;
    }

    if (trial.invuln > 0) trial.invuln -= dt;
    if (trial.flash > 0) trial.flash = Math.max(0, trial.flash - dt * 2.6);
    if (trial.sealFlash > 0) trial.sealFlash = Math.max(0, trial.sealFlash - dt * 2.2);

    for (let i = trial.projectiles.length - 1; i >= 0; i--) {
      const spark = trial.projectiles[i];
      spark.x += spark.vx * dt;
      spark.y += spark.vy * dt;
      spark.life -= dt;
      const outside = spark.x < -80 || spark.x > trial.w + 80 ||
        spark.y < -80 || spark.y > trial.h + 80;
      if (spark.life <= 0 || outside) {
        trial.projectiles.splice(i, 1);
        continue;
      }
      if (trial.invuln <= 0) {
        const dx = trial.player.x - spark.x;
        const dy = trial.player.y - spark.y;
        const hit = trial.playerRadius + spark.r;
        if (dx * dx + dy * dy <= hit * hit) {
          trial.projectiles.splice(i, 1);
          trial.sparksLeft--;
          trial.invuln = 1.05;
          trial.flash = 1;
          pushTrialHint('Искра обожгла. Осталось искр: ' + trial.sparksLeft + '.');
          updateTrialHud();
          if (trial.sparksLeft <= 0) {
            finishTrial('death');
            return;
          }
        }
      }
    }

    if (trial.elapsed >= config.duration) {
      if (trial.sealsClosed >= config.sealsRequired) finishTrial('success');
      else finishTrial('fail');
      return;
    }

    if (trial.hintUntil && trial.elapsed > trial.hintUntil) {
      trial.hintUntil = 0;
      if (trial.sealsClosed >= config.sealsRequired) {
        dom.trialHint.textContent = 'Круг принял печати. Додержись.';
      } else if (trial.activeSeal) {
        dom.trialHint.textContent = 'Встань в печать и нажми ПРОБЕЛ.';
      } else {
        dom.trialHint.textContent = 'Двигайся. Печать закроется — нажми ПРОБЕЛ.';
      }
    }

    updateTrialHud();
  }

  function drawTrial(time) {
    const size = layoutTrial();
    clampTrialPlayer();
    const ctx = size.ctx;
    const w = trial.w;
    const h = trial.h;
    const cx = trial.center.x;
    const cy = trial.center.y;
    const radius = trial.radius;

    ctx.clearRect(0, 0, w, h);
    const background = ctx.createRadialGradient(cx, cy, radius * 0.12, cx, cy, Math.max(w, h) * 0.76);
    background.addColorStop(0, '#121515');
    background.addColorStop(0.65, '#080b0c');
    background.addColorStop(1, '#040506');
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, w, h);

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(time * 0.00008);
    for (let i = 0; i < 3; i++) {
      ctx.strokeStyle = `rgba(199, 111, 57, ${0.14 + i * 0.035})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(0, 0, radius * (0.42 + i * 0.27), 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(199, 111, 57, 0.24)';
    for (let i = 0; i < 18; i++) {
      ctx.rotate(Math.PI / 9);
      ctx.beginPath();
      ctx.moveTo(radius * 0.68, 0);
      ctx.lineTo(radius * 0.76, 0);
      ctx.stroke();
    }
    ctx.restore();

    ctx.save();
    ctx.strokeStyle = 'rgba(220, 128, 70, 0.3)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([3, 9]);
    ctx.beginPath();
    ctx.arc(cx, cy, radius - 8, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();

    if (trial.activeSeal) {
      const seal = trial.activeSeal;
      const pulse = 0.5 + 0.5 * Math.sin(time * 0.008);
      const inside = Math.hypot(trial.player.x - seal.x, trial.player.y - seal.y) <= seal.r + trial.playerRadius;
      const fill = ctx.createRadialGradient(seal.x, seal.y, 1, seal.x, seal.y, seal.r);
      fill.addColorStop(0, inside ? 'rgba(235, 182, 118, 0.34)' : 'rgba(208, 118, 60, 0.16)');
      fill.addColorStop(1, 'rgba(208, 118, 60, 0)');
      ctx.fillStyle = fill;
      ctx.beginPath();
      ctx.arc(seal.x, seal.y, seal.r, 0, Math.PI * 2);
      ctx.fill();

      ctx.save();
      ctx.strokeStyle = inside ? '#f1c997' : `rgba(229, 161, 104, ${0.45 + pulse * 0.35})`;
      ctx.lineWidth = inside ? 2.5 : 1.6;
      ctx.beginPath();
      ctx.arc(seal.x, seal.y, seal.r * (0.82 + pulse * 0.1), 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([2, 6]);
      ctx.beginPath();
      ctx.arc(seal.x, seal.y, seal.r * 1.18, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    }

    for (const spark of trial.projectiles) {
      ctx.save();
      ctx.shadowColor = 'rgba(235, 130, 64, 0.9)';
      ctx.shadowBlur = 12;
      const speed = Math.hypot(spark.vx, spark.vy) || 1;
      const tx = spark.x - (spark.vx / speed) * 11;
      const ty = spark.y - (spark.vy / speed) * 11;
      const trail = ctx.createLinearGradient(tx, ty, spark.x, spark.y);
      trail.addColorStop(0, 'rgba(208, 118, 60, 0)');
      trail.addColorStop(1, 'rgba(240, 165, 98, 0.8)');
      ctx.strokeStyle = trail;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(tx, ty);
      ctx.lineTo(spark.x, spark.y);
      ctx.stroke();
      ctx.fillStyle = '#f2b271';
      ctx.beginPath();
      ctx.arc(spark.x, spark.y, spark.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fff0d0';
      ctx.beginPath();
      ctx.arc(spark.x - spark.r * 0.3, spark.y - spark.r * 0.3, spark.r * 0.36, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    const playerGlow = ctx.createRadialGradient(
      trial.player.x, trial.player.y, 1,
      trial.player.x, trial.player.y, trial.playerRadius * 3
    );
    playerGlow.addColorStop(0, 'rgba(236, 239, 225, 0.3)');
    playerGlow.addColorStop(1, 'rgba(236, 239, 225, 0)');
    ctx.fillStyle = playerGlow;
    ctx.beginPath();
    ctx.arc(trial.player.x, trial.player.y, trial.playerRadius * 3, 0, Math.PI * 2);
    ctx.fill();

    ctx.save();
    ctx.strokeStyle = trial.invuln > 0 ? 'rgba(237, 178, 116, 0.9)' : 'rgba(240, 240, 225, 0.9)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(trial.player.x, trial.player.y, trial.playerRadius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = trial.invuln > 0 ? 'rgba(233, 170, 107, 0.23)' : 'rgba(236, 239, 225, 0.15)';
    ctx.fill();
    ctx.restore();

    if (trial.flash > 0) {
      ctx.fillStyle = `rgba(208, 74, 38, ${trial.flash * 0.24})`;
      ctx.fillRect(0, 0, w, h);
    }
    if (trial.sealFlash > 0) {
      ctx.fillStyle = `rgba(235, 200, 148, ${trial.sealFlash * 0.13})`;
      ctx.fillRect(0, 0, w, h);
    }
  }

  function trialLoop(time) {
    if (!trial || !trial.active) return;
    const dt = Math.min(0.05, (time - trial.lastT) / 1000 || 0);
    trial.lastT = time;
    if (dt > 0) updateTrial(dt);
    if (!trial || !trial.active) return;
    drawTrial(time);
    trialRaf = window.requestAnimationFrame(trialLoop);
  }

  function startTrial() {
    if (state.flags.trialDone) return;
    if (trial && trial.active) return;
    if (isStoryOrDeathOrTrial()) return;
    state.flags.trialAttempted = true;
    keys = Object.create(null);

    trial = {
      active: true,
      elapsed: 0,
      lastT: now(),
      w: 0,
      h: 0,
      center: { x: 0, y: 0 },
      radius: 200,
      player: { x: 0, y: 0, facingX: 0, facingY: -1 },
      playerRadius: 9,
      sparksLeft: C.trial.sparks,
      sealsClosed: 0,
      activeSeal: null,
      nextSeal: 0,
      projectiles: [],
      spawnTimer: 0.7,
      burstTimer: 6.5,
      invuln: 0.8,
      flash: 0,
      sealFlash: 0,
      hint: '',
      hintUntil: 0,
      resultKind: null
    };

    dom.trialResult.classList.add('hidden');
    ensureTerminalShare(0.36);
    showTrialStage();
    setTerminalView('trial');
    resetTrialHint();
    const size = layoutTrial();
    trial.player.x = size.w / 2;
    trial.player.y = size.h / 2 + trial.radius * 0.54;
    clampTrialPlayer();
    updateTrialHud();
    saveGame();
    trialRaf = window.requestAnimationFrame(trialLoop);
  }

  dom.trialAbort.addEventListener('click', () => {
    if (!trial || !trial.active) return;
    finishTrial('abort');
  });

  dom.trialSealBtn.addEventListener('click', attemptSeal);

  dom.trialResultBtn.addEventListener('click', () => {
    if (!trial) return;
    const result = trial.resultKind;
    dom.trialResult.classList.add('hidden');
    hideTrialStage();
    trial = null;
    setTerminalView('main');
    updatePrompt();
    if (result === 'success') {
      appendLog('Печати погасли. В центре круга осталась карта.', 'story', true);
      queueStory('trialSuccess', () => {
        toast('В центре круга лежит карта');
        updatePrompt();
      });
    } else {
      toast('Круг остыл. Можно войти снова');
      appendLog('Круг не принял печать. Можно попробовать снова.', 'reply', true);
    }
    saveGame();
  });

  /* ------------------------------------------------------------------ */
  /* Публичные проверки состояния                                        */
  /* ------------------------------------------------------------------ */

  function isStoryOrDeathOrTrial() {
    return termView === 'story' || termView === 'death' || termView === 'trial';
  }

  function isPaused() {
    if (document.hidden) return true;
    return termView !== 'main';
  }

  /* ------------------------------------------------------------------ */
  /* Уведомления                                                         */
  /* ------------------------------------------------------------------ */

  function toast(text) {
    /* В новом интерфейсе уведомление живёт только в терминале. */
    appendLog(text, 'sys', true);
  }

  /* ------------------------------------------------------------------ */
  /* Звук: процедурный эмбиент, без внешних файлов                       */
  /* ------------------------------------------------------------------ */

  const AudioEngine = {
    ctx: null,
    master: null,
    oscA: null,
    oscB: null,
    filter: null,
    cue: 'tablet',
    frequencies: {
      tablet: 110,
      hazard: 88,
      low: 78,
      trial: 131,
      storage: 98,
      crossroad: 104,
      labyrinth: 84
    },
    ensure() {
      if (this.ctx) {
        if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
        return;
      }
      try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) return;
        this.ctx = new AudioContext();
        this.master = this.ctx.createGain();
        this.master.gain.value = 0.012;
        this.filter = this.ctx.createBiquadFilter();
        this.filter.type = 'lowpass';
        this.filter.frequency.value = 520;
        this.filter.Q.value = 0.7;
        this.oscA = this.ctx.createOscillator();
        this.oscA.type = 'sine';
        this.oscB = this.ctx.createOscillator();
        this.oscB.type = 'triangle';
        this.oscA.frequency.value = this.frequencies[this.cue] || 96;
        this.oscB.frequency.value = (this.frequencies[this.cue] || 96) * 1.5;
        const gainB = this.ctx.createGain();
        gainB.gain.value = 0.18;
        this.oscA.connect(this.filter);
        this.oscB.connect(gainB);
        gainB.connect(this.filter);
        this.filter.connect(this.master);
        this.master.connect(this.ctx.destination);
        this.oscA.start();
        this.oscB.start();
        this.master.gain.setTargetAtTime(0.014, this.ctx.currentTime, 1.4);
      } catch (error) {
        this.ctx = null;
      }
    },
    setCue(cue) {
      this.cue = cue || 'labyrinth';
      if (!this.ctx) return;
      const base = this.frequencies[this.cue] || 90;
      const t = this.ctx.currentTime;
      try {
        this.oscA.frequency.setTargetAtTime(base, t, 1.2);
        this.oscB.frequency.setTargetAtTime(base * 1.5, t, 1.2);
        this.filter.frequency.setTargetAtTime(420 + base * 0.8, t, 1.2);
      } catch (error) {
        /* ignored */
      }
    }
  };
  audio = AudioEngine;

  function unlockAudio() {
    AudioEngine.ensure();
    AudioEngine.setCue(AudioEngine.cue);
  }
  document.addEventListener('pointerdown', unlockAudio, { once: true });
  document.addEventListener('keydown', unlockAudio, { once: true });

  /* ------------------------------------------------------------------ */
  /* Ввод                                                                */
  /* ------------------------------------------------------------------ */

  const MOVE_KEYS = {
    ArrowUp: 'up', KeyW: 'up',
    ArrowDown: 'down', KeyS: 'down',
    ArrowLeft: 'left', KeyA: 'left',
    ArrowRight: 'right', KeyD: 'right'
  };

  window.addEventListener('keydown', (event) => {
    const move = MOVE_KEYS[event.code];
    if (move) {
      if (!isTyping()) {
        keys[move] = true;
        event.preventDefault();
      }
      return;
    }

    if (event.code === 'Space') {
      if (trial && trial.active) {
        event.preventDefault();
        attemptSeal();
      }
      return;
    }

    if (event.code === 'Escape') {
      if (termView === 'card') closeCardDetail();
      else if (termView === 'canvas') closeCanvas();
      else if (termView === 'inventory') closeInventory();
      else if (termView === 'map') closeMap();
      else if (termView === 'trial' && trial && trial.resultKind) {
        dom.trialResultBtn.click();
      }
      return;
    }

    if (isTyping() || event.ctrlKey || event.metaKey || event.altKey) return;

    if (event.code === 'KeyE') {
      event.preventDefault();
      interact();
    } else if (event.code === 'KeyB') {
      if (isStoryOrDeathOrTrial()) return;
      if (termView === 'inventory') closeInventory();
      else if (termView === 'main') openInventory();
    } else if (event.code === 'KeyM') {
      if (isStoryOrDeathOrTrial()) return;
      if (termView === 'map') closeMap();
      else if (termView === 'main') openMap();
    } else if (event.code === 'KeyC') {
      if (isStoryOrDeathOrTrial()) return;
      if (termView === 'card') closeCardDetail();
      else if (termView === 'canvas') closeCanvas();
      else if (termView === 'main') openCanvas();
    } else if (event.code === 'KeyF' && trial && trial.active) {
      attemptSeal();
    }
  });

  window.addEventListener('keyup', (event) => {
    const move = MOVE_KEYS[event.code];
    if (move) {
      keys[move] = false;
      if (!isTyping()) event.preventDefault();
    }
  });

  window.addEventListener('blur', () => {
    keys = Object.create(null);
  });

  function bindDirectionPad(root) {
    if (!root) return;
    root.querySelectorAll('[data-dir]').forEach((button) => {
      const direction = button.dataset.dir;
      const press = (event) => {
        event.preventDefault();
        keys[direction] = true;
        try {
          button.setPointerCapture(event.pointerId);
        } catch (error) {
          /* ignored */
        }
      };
      const release = (event) => {
        event.preventDefault();
        keys[direction] = false;
      };
      button.addEventListener('pointerdown', press);
      button.addEventListener('pointerup', release);
      button.addEventListener('pointercancel', release);
      button.addEventListener('lostpointercapture', release);
    });
  }

  bindDirectionPad(document.querySelector('.touch-ui .dpad'));
  bindDirectionPad(document.querySelector('.trial-touch .dpad'));

  dom.btnAction.addEventListener('click', interact);

  window.addEventListener('resize', () => {
    if (termView === 'map') drawMapNow();
    if (trial && trial.active) {
      layoutTrial();
      clampTrialPlayer();
    }
  });

  window.addEventListener('beforeunload', saveGame);

  /* ------------------------------------------------------------------ */
  /* Главный цикл                                                        */
  /* ------------------------------------------------------------------ */

  function loop(time) {
    const dt = Math.min(0.05, (time - lastFrame) / 1000 || 0);
    lastFrame = time;

    if (!isPaused()) {
      updateMovement(dt);
      updateRoomDetection();
      checkHazardDamage(time);
      updateCamera();
      if (!trial) updatePrompt();
    }

    if (images) {
      try {
        const view = window.Renderer.makeCanvasSize(dom.worldCanvas);
        worldCtx = view.ctx;
        window.Renderer.drawWorld(worldCtx, {
          state,
          world,
          images,
          view,
          now: time
        });
      } catch (error) {
        console.error(error);
      }
    }

    window.requestAnimationFrame(loop);
  }

  /* ------------------------------------------------------------------ */
  /* Запуск                                                              */
  /* ------------------------------------------------------------------ */

  function installDebugApi() {
    let enabled = false;
    try {
      enabled = new URLSearchParams(window.location.search).has('debug');
    } catch (error) {
      enabled = false;
    }
    if (!enabled) return;

    window.__zqwy = {
      snapshot() {
        return JSON.parse(JSON.stringify({
          player: state.player,
          camera: state.camera,
          currentRoomId: state.currentRoomId,
          flags: state.flags,
          items: state.items,
          backpacks: state.backpacks,
          visited: state.visited,
          mapMarks: state.mapMarks,
          storySeen: state.storySeen,
          canvasElements: state.canvasElements,
          trial: trial ? {
            active: trial.active,
            elapsed: trial.elapsed,
            sparksLeft: trial.sparksLeft,
            sealsClosed: trial.sealsClosed,
            activeSeal: trial.activeSeal,
            resultKind: trial.resultKind
          } : null,
          overlays: {
            termView,
            cardOrigin,
            story: termView === 'story',
            death: termView === 'death',
            trial: termView === 'trial',
            inventory: termView === 'inventory',
            map: termView === 'map',
            canvas: termView === 'canvas' || termView === 'card',
            card: termView === 'card',
            trialStage: !dom.trialStage.classList.contains('hidden')
          },
          terminal: {
            view: termView,
            split: readSplitPreference(),
            gameRows: dom.app.style.gridTemplateRows,
            zoom: canvasZoom
          }
        }));
      },
      teleport(x, y) {
        state.player.x = x;
        state.player.y = y;
        state.player.moving = false;
        snapCamera();
        state.currentRoomId = null;
        updateRoomDetection();
        updatePrompt();
      },
      goRoom(role) {
        const room = world.rooms.find((r) => r.role === role);
        if (!room) return null;
        state.player.x = room.centerX + 0.5;
        state.player.y = room.centerY + 0.5;
        state.player.moving = false;
        snapCamera();
        state.currentRoomId = null;
        updateRoomDetection();
        updatePrompt();
        return room.id;
      },
      give(itemId) {
        if (!knownItemId(itemId) || state.items.includes(itemId)) return false;
        state.items.push(itemId);
        if (termView === 'inventory') renderInventory();
        if (termView === 'canvas') renderCanvasElements();
        saveGame();
        return true;
      },
      die(cause) {
        die(cause || 'debug');
      },
      startTrial() {
        startTrial();
      },
      trialInfo() {
        return trial ? {
          player: { x: trial.player.x, y: trial.player.y },
          center: { x: trial.center.x, y: trial.center.y },
          radius: trial.radius,
          activeSeal: trial.activeSeal ? JSON.parse(JSON.stringify(trial.activeSeal)) : null,
          elapsed: trial.elapsed,
          sealsClosed: trial.sealsClosed,
          sparksLeft: trial.sparksLeft
        } : null;
      },
      finishTrialNow(kind) {
        if (!trial) return false;
        if (kind === 'success') {
          trial.elapsed = C.trial.duration;
          trial.sealsClosed = C.trial.sealsRequired;
        } else if (kind === 'fail') {
          trial.elapsed = C.trial.duration;
          trial.sealsClosed = 0;
        }
        return true;
      },
      closeAll() {
        dom.trialResult.classList.add('hidden');
        hideTrialStage();
        setTerminalView('main');
        storyActive = false;
        storyQueue.length = 0;
        if (trialRaf) window.cancelAnimationFrame(trialRaf);
        trialRaf = 0;
        trial = null;
        updatePrompt();
      },
      save: saveGame
    };
  }

  function boot() {
    const saved = readSave();
    const seed = saved && typeof saved.seed === 'string' ? saved.seed : DEFAULT_SEED;
    world = window.World.generate(seed);
    state = defaultState(seed);
    if (saved) hydrateState(saved);

    if (!canStandAt(state.player.x, state.player.y)) {
      respawnAtTablet();
    }
    snapCamera();
    images = window.Renderer.prepareImages();

    C.terminal.greeting.forEach((line) => appendLog(line, 'sys', true));
    initDivider();
    setCanvasZoom(1, false);
    renderCanvasElements();
    setTerminalView('main');
    installDebugApi();

    lastFrame = now();
    window.requestAnimationFrame(loop);
  }

  boot();
})();
