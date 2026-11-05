/* Лабиринт сознаний — ядро прототипа.
   Общее состояние, сохранение, разметка и области интерфейса.
   Остальные модули получают это состояние через window.ZQ. */
(function () {
  'use strict';

  const C = window.CONFIG;
  const $ = (id) => document.getElementById(id);

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function lerp(from, to, amount) {
    return from + (to - from) * amount;
  }

  function now() {
    return (typeof performance !== 'undefined' && performance.now)
      ? performance.now()
      : Date.now();
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
    return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
  }

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
    terminal: $('terminal'),

    settingsView: $('view-settings'),
    settingsClose: $('settings-close'),
    settingSpeed: $('setting-speed'),
    settingSpeedNumber: $('setting-speed-number'),
    settingSpeedValue: $('setting-speed-value'),
    settingSpeedPresets: $('setting-speed-presets'),
    settingFont: $('setting-font'),
    settingFontNumber: $('setting-font-number'),
    settingFontValue: $('setting-font-value'),
    settingFontPresets: $('setting-font-presets'),
    settingFontTerminal: $('setting-font-terminal'),
    settingFontTerminalNumber: $('setting-font-terminal-number'),
    settingFontTable: $('setting-font-table'),
    settingFontTableNumber: $('setting-font-table-number'),
    settingsReset: $('settings-reset'),
    settingLogEnabled: $('setting-log-enabled'),
    settingLogMovement: $('setting-log-movement'),
    settingLogActions: $('setting-log-actions'),
    settingLogCommands: $('setting-log-commands'),
    settingLogState: $('setting-log-state'),

    storyView: $('view-story'),
    storyClose: $('story-close'),
    storyNow: $('story-now'),
    storyTree: $('story-tree'),

    trialView: $('view-trial'),
    trialStage: $('trial-stage'),
    trialCanvas: $('trial-canvas'),
    trialConsole: $('trial-console'),
    trialSeals: $('trial-seals'),
    trialSparks: $('trial-sparks'),
    trialTime: $('trial-time'),
    trialHint: $('trial-hint'),
    trialAbort: $('trial-abort'),
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
    canvasKeys: $('canvas-keys'),
    canvasKeysToggle: $('canvas-keys-toggle'),
    canvasKeysTabs: $('canvas-keys-tabs'),
    canvasKeysBody: $('canvas-keys-body'),

    cardView: $('view-card'),
    cardTitle: $('card-title'),
    cardArt: $('card-art'),
    cardCommand: $('card-command'),
    cardDescription: $('card-description'),
    cardState: $('card-state'),
    cardRun: $('card-run'),
    cardPlace: $('card-place'),
    cardBack: $('card-back'),
    cardClose: $('card-close'),

    soundtrack: $('soundtrack')
  };

  const VIEWS = {
    main: dom.viewMain,
    inventory: dom.inventoryView,
    map: dom.mapView,
    canvas: dom.canvasView,
    card: dom.cardView,
    story: dom.storyView,
    settings: dom.settingsView,
    trial: dom.trialView
  };

  const SAVE_VERSION = 1;
  const TERM_SETTINGS_KEY = 'zqwy.labyrinth.terminal.v1';
  const SPLIT_KEY = 'zqwy.labyrinth.split.v1';
  const DIVIDER_H = 10;
  const SPEED_MIN = 12;
  const SPEED_MAX = 220;
  const FONT_MIN = 10;
  const FONT_MAX = 24;
  const FONT_BASE = 14;
  const OVERRIDE_MAX = 28;
  const UNLOCK_IDS = ['backpack', 'map', 'table'];

  const DEFAULT_TERM_SETTINGS = {
    speed: 70,
    fontSize: 14,
    fontOverrides: { terminal: 0, table: 0 },
    logging: {
      enabled: Boolean(C.terminal.logging && C.terminal.logging.enabled),
      movement: !C.terminal.logging || C.terminal.logging.movement !== false,
      actions: !C.terminal.logging || C.terminal.logging.actions !== false,
      commands: !C.terminal.logging || C.terminal.logging.commands !== false
    },
    music: C.music ? C.music.enabled !== false : true
  };

  const rt = {
    world: null,
    state: null,
    images: null,
    worldCtx: null,
    lastFrame: 0,
    keys: Object.create(null),
    invulnUntil: 0,
    promptLabel: '',
    activePrompt: null,
    audio: null,

    termView: 'main',
    cardOrigin: 'canvas',

    storyActive: false,
    storyQueue: [],

    canvasLinkMode: false,
    linkFirstId: null,
    canvasDrag: null,
    canvasZoom: 1,
    canvasPanX: 0,
    canvasPanY: 0,
    canvasPinch: null,
    workspacePan: null,
    keyBindingId: null,
    canvasDevice: 'keyboard',
    gamepadKeys: Object.create(null),
    gamepadPrev: [],
    gamepadIndex: null,

    splitRatio: 0.56,
    splitDrag: null,

    trial: null,
    trialRaf: 0,

    termSettings: {
      speed: DEFAULT_TERM_SETTINGS.speed,
      fontSize: DEFAULT_TERM_SETTINGS.fontSize,
      fontOverrides: { ...DEFAULT_TERM_SETTINGS.fontOverrides },
      logging: { ...DEFAULT_TERM_SETTINGS.logging },
      music: DEFAULT_TERM_SETTINGS.music
    },
    logBusy: false,
    logToken: 0,
    logSkip: false,
    logQueue: [],
    logIdleCallbacks: [],

    commandHistory: [],
    commandHistoryIndex: -1,
    commandDraft: '',
    moveLogAt: 0,
    moveLogDir: ''
  };

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
      unlocks: { backpack: false, map: false, table: false },
      deaths: 0
    };
  }

  function newSeed() {
    const stamp = Date.now().toString(36);
    const noise = Math.random().toString(36).slice(2, 9);
    return `zqwy-${stamp}-${noise}`;
  }

  function knownItemId(id) {
    return Object.prototype.hasOwnProperty.call(C.items, id);
  }

  function normalizeCanvasElement(raw) {
    if (!raw || typeof raw !== 'object') return null;
    const allowed = ['command', 'card', 'map', 'seq', 'control', 'key'];
    if (!allowed.includes(raw.kind)) return null;

    const element = {
      id: typeof raw.id === 'string' ? raw.id : makeId('cv'),
      kind: raw.kind,
      itemId: typeof raw.itemId === 'string' && knownItemId(raw.itemId) ? raw.itemId : null,
      command: typeof raw.command === 'string' ? raw.command : null,
      label: typeof raw.label === 'string' ? raw.label : '',
      sub: typeof raw.sub === 'string' ? raw.sub : '',
      action: typeof raw.action === 'string' ? raw.action : null,
      code: typeof raw.code === 'string' ? raw.code : null,
      links: Array.isArray(raw.links)
        ? raw.links.filter((id) => typeof id === 'string')
        : [],
      /* Старые сохранения хранили клавишу на самом элементе. Поле
         переносится в отдельный элемент-клавишу при загрузке. */
      legacyKey: typeof raw.key === 'string' ? raw.key : null,
      nx: Number.isFinite(raw.nx) ? clamp(raw.nx, 0.04, 0.96) : 0.5,
      ny: Number.isFinite(raw.ny) ? clamp(raw.ny, 0.04, 0.96) : 0.5,
      commands: Array.isArray(raw.commands)
        ? raw.commands.filter((c) => typeof c === 'string')
        : null,
      requires: Array.isArray(raw.requires)
        ? raw.requires.filter((id) => knownItemId(id))
        : []
    };

    if (element.kind === 'seq' && (!element.commands || !element.commands.length)) return null;
    if (element.kind === 'control') {
      const meta = C.controlActions && C.controlActions[element.action];
      if (!meta) return null;
      element.label = meta.label;
      element.command = meta.command || null;
      element.sub = 'кнопка управления';
      element.requires = [];
    }
    if (element.kind === 'key') {
      element.label = typeof raw.label === 'string' && raw.label ? raw.label : 'клавиша';
      element.sub = 'клавиша';
      element.command = null;
      element.itemId = null;
      element.requires = [];
    }
    if (element.kind !== 'seq' && element.kind !== 'control' && element.kind !== 'key' && element.itemId) {
      const item = C.items[element.itemId];
      if (!item) return null;
      if (!element.command) element.command = item.command || null;
      if (!element.label) element.label = item.name;
    }
    return element;
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
    if (!rt.state || !rt.state.player) return;
    try {
      const state = rt.state;
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
        unlocks: state.unlocks,
        deaths: state.deaths
      };
      window.localStorage.setItem(C.saveKey, JSON.stringify(data));
    } catch (error) {
      /* Приватный режим или переполнение — игра продолжает работать. */
    }
  }

  function hydrateState(saved) {
    if (!saved) return;
    const state = rt.state;
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
      if (typeof ZQ.normalizeTableBindings === 'function') ZQ.normalizeTableBindings();
    }
    if (saved.storySeen && typeof saved.storySeen === 'object') state.storySeen = saved.storySeen;
    if (saved.unlocks && typeof saved.unlocks === 'object') {
      for (const id of UNLOCK_IDS) {
        if (saved.unlocks[id]) state.unlocks[id] = true;
      }
    }
    /* Мягкая миграция старых сохранений: полученное не отбираем,
       но и не открываем всё заранее. */
    if (state.storySeen.tablet) {
      state.unlocks.backpack = true;
      state.unlocks.table = true;
    }
    if (state.items.length) state.unlocks.backpack = true;
    if (state.items.includes('map_fragment')) state.unlocks.map = true;
    if (state.canvasElements.length) state.unlocks.table = true;
    if (Number.isFinite(saved.deaths)) state.deaths = saved.deaths;
  }

  function hasUnlock(id) {
    return Boolean(rt.state && rt.state.unlocks && rt.state.unlocks[id]);
  }

  function unlock(id, quiet) {
    if (!rt.state || !rt.state.unlocks || rt.state.unlocks[id]) return false;
    if (!UNLOCK_IDS.includes(id)) return false;
    rt.state.unlocks[id] = true;
    const meta = C.terminal.unlocks[id];
    if (!quiet) {
      ZQ.appendLog(`Открыто: ${meta ? meta.title : id}.`, 'sys', true);
    }
    saveGame();
    if (rt.termView === 'inventory') ZQ.renderInventory();
    if (rt.termView === 'canvas') {
      ZQ.renderCanvasElements();
      ZQ.renderCanvasDrawer();
    }
    return true;
  }

  function unlockHint(id) {
    const meta = C.terminal.unlocks[id];
    return meta ? meta.hint : 'Это откроется позже.';
  }

  function denyLocked(id) {
    return `Пока недоступно. ${unlockHint(id)}`;
  }

  function setTerminalView(name) {
    if (!VIEWS[name]) name = 'main';
    rt.termView = name;
    if (name !== 'main' && document.activeElement === dom.commandInput) {
      dom.commandInput.blur();
    }
    for (const key of Object.keys(VIEWS)) {
      VIEWS[key].classList.toggle('hidden', key !== name);
    }
    if (name === 'inventory') ZQ.renderInventory();
    if (name === 'map') {
      window.requestAnimationFrame(() => {
        ZQ.drawMapNow();
        window.requestAnimationFrame(ZQ.drawMapNow);
      });
    }
    if (name === 'canvas') ZQ.renderCanvasElements();
    if (name === 'story') ZQ.renderStory();
    if (name === 'main') ZQ.updatePrompt();
  }

  function ensureTerminalShare(minShare) {
    if (1 - rt.splitRatio < minShare) applySplit(1 - minShare, true);
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
    rt.splitRatio = clamp(value, bounds.low, bounds.high);
    dom.app.style.gridTemplateRows =
      `minmax(0, ${rt.splitRatio}fr) ${DIVIDER_H}px minmax(0, ${1 - rt.splitRatio}fr)`;
    const percent = Math.round(rt.splitRatio * 100);
    dom.divider.setAttribute('aria-valuenow', String(percent));
    if (persist) {
      try {
        window.localStorage.setItem(SPLIT_KEY, String(rt.splitRatio));
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
    applySplit(Number.isFinite(saved) ? saved : rt.splitRatio, false);

    dom.divider.addEventListener('pointerdown', (event) => {
      if (event.button !== undefined && event.button !== 0) return;
      event.preventDefault();
      rt.splitDrag = event.pointerId;
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
      if (rt.splitDrag !== event.pointerId) return;
      event.preventDefault();
      splitFromPointer(event.clientY);
    });

    const finish = (event) => {
      if (rt.splitDrag !== event.pointerId) return;
      rt.splitDrag = null;
      dom.divider.classList.remove('dragging');
      document.body.classList.remove('split-dragging');
      try {
        dom.divider.releasePointerCapture(event.pointerId);
      } catch (error) {
        /* ignored */
      }
      applySplit(rt.splitRatio, true);
    };
    dom.divider.addEventListener('pointerup', finish);
    dom.divider.addEventListener('pointercancel', finish);

    dom.divider.addEventListener('keydown', (event) => {
      if (event.code === 'ArrowUp') {
        event.preventDefault();
        applySplit(rt.splitRatio - 0.03, true);
      } else if (event.code === 'ArrowDown') {
        event.preventDefault();
        applySplit(rt.splitRatio + 0.03, true);
      } else if (event.code === 'Home') {
        event.preventDefault();
        applySplit(0.56, true);
      }
    });

    window.addEventListener('resize', () => {
      applySplit(rt.splitRatio, false);
      if (rt.termView === 'map') ZQ.drawMapNow();
    });
  }

  function startNewGame() {
    const seed = newSeed();
    try {
      window.localStorage.removeItem(C.saveKey);
    } catch (error) {
      /* Приватный режим: сохранение просто не было создано. */
    }

    rt.storyQueue.length = 0;
    rt.storyActive = false;
    if (rt.trialRaf) window.cancelAnimationFrame(rt.trialRaf);
    rt.trialRaf = 0;
    rt.trial = null;
    ZQ.hideTrialStage();

    rt.state = defaultState(seed);
    rt.world = window.World.generate(seed);
    rt.state.player.x = rt.world.spawn.x;
    rt.state.player.y = rt.world.spawn.y;
    rt.state.player.facingX = 0;
    rt.state.player.facingY = -1;
    rt.state.player.moving = false;
    rt.state.currentRoomId = rt.world.spawn.roomId;
    rt.state.visited[rt.world.spawn.roomId] = true;

    rt.keys = Object.create(null);
    for (const key of Object.keys(rt.gamepadKeys)) rt.gamepadKeys[key] = false;
    rt.canvasLinkMode = false;
    rt.linkFirstId = null;
    rt.keyBindingId = null;
    rt.canvasDrag = null;
    rt.canvasPinch = null;
    rt.workspacePan = null;
    rt.canvasZoom = 1;
    rt.canvasPanX = 0;
    rt.canvasPanY = 0;
    dom.canvasLinkToggle.classList.remove('active');
    ZQ.closeCanvasDrawer();

    ZQ.snapCamera();
    ZQ.clearLog();
    C.terminal.greeting.forEach((line) => ZQ.appendLog(line, 'sys', true));
    C.terminal.controls.forEach((line) => ZQ.appendLog(line, 'sys', true));
    ZQ.appendLog(`Новый Лабиринт. Seed: ${seed}`, 'sys', true);
    setTerminalView('main');
    ZQ.applyCanvasTransform();
    ZQ.renderCanvasElements();
    ZQ.updatePrompt();
    saveGame();
  }

  const ZQ = {
    C,
    $,
    dom,
    VIEWS,
    rt,
    constants: {
      SAVE_VERSION,
      TERM_SETTINGS_KEY,
      SPLIT_KEY,
      DIVIDER_H,
      SPEED_MIN,
      SPEED_MAX,
      FONT_MIN,
      FONT_MAX,
      FONT_BASE,
      OVERRIDE_MAX,
      UNLOCK_IDS
    },
    DEFAULT_TERM_SETTINGS,
    clamp,
    lerp,
    now,
    plural,
    makeId,
    defaultState,
    newSeed,
    readSave,
    saveGame,
    knownItemId,
    normalizeCanvasElement,
    hydrateState,
    hasUnlock,
    unlock,
    unlockHint,
    denyLocked,
    setTerminalView,
    ensureTerminalShare,
    applySplit,
    initDivider,
    startNewGame,
    isTrialBlocking() {
      return rt.termView === 'trial';
    },
    isPaused() {
      if (document.hidden) return true;
      return rt.termView !== 'main';
    },
    resetKeys() {
      rt.keys = Object.create(null);
    },
    tabletDistance() {
      if (!rt.world) return Infinity;
      return Math.hypot(
        rt.state.player.x - rt.world.tablet.x,
        rt.state.player.y - rt.world.tablet.y
      );
    }
  };

  window.ZQ = ZQ;
})();
