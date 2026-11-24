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

  /* Единая точка перевода для модулей, которые не хотят знать,
     подключён ли i18n. До загрузки словаря текст остаётся русским. */
  function tr(text) {
    return window.ZQ_TR ? window.ZQ_TR(text) : text;
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
    swampVeil: $('swamp-veil'),
    btnAction: $('btn-action'),
    divider: $('divider'),

    log: $('log'),
    termContext: $('term-context'),
    commandForm: $('command-form'),
    commandInput: $('command-input'),
    commandGhost: $('command-ghost'),
    viewMain: $('view-main'),
    terminal: $('terminal'),

    btnSave: $('btn-save'),
    btnLoad: $('btn-load'),
    btnExport: $('btn-export'),
    btnSettings: $('btn-settings'),

    settingsView: $('view-settings'),
    settingsClose: $('settings-close'),
    termSettingsView: $('view-term-settings'),
    termSettingsClose: $('term-settings-close'),
    termSettingsBack: $('term-settings-back'),
    openTermSettings: $('open-term-settings'),
    fontSettingsView: $('view-font-settings'),
    fontSettingsClose: $('font-settings-close'),
    fontSettingsBack: $('font-settings-back'),
    openFontSettings: $('open-font-settings'),
    settingFontCurrent: $('setting-font-current'),
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
    settingLogTerminal: $('setting-log-terminal'),
    settingLogScenes: $('setting-log-scenes'),
    settingLogSystem: $('setting-log-system'),
    settingLogWorld: $('setting-log-world'),
    settingLogMovement: $('setting-log-movement'),
    settingLogActions: $('setting-log-actions'),
    settingLogCommands: $('setting-log-commands'),
    settingLogState: $('setting-log-state'),
    settingLanguageState: $('setting-language-state'),

    musicView: $('view-music'),
    arcadeView: $('view-arcade'),
    musicClose: $('music-close'),
    musicBack: $('music-back'),
    openMusic: $('open-music'),
    musicToggle: $('music-toggle'),
    musicStop: $('music-stop'),
    musicSeek: $('music-seek'),
    musicTime: $('music-time'),
    musicCue: $('music-cue'),
    musicVolume: $('music-volume'),
    musicVolumeValue: $('music-volume-value'),
    musicMute: $('music-mute'),
    musicRate: $('music-rate'),
    musicRateValue: $('music-rate-value'),
    musicRateNote: $('music-rate-note'),
    musicAlgorithmPresets: $('music-algorithm-presets'),
    musicAlgorithmCurrent: $('music-algorithm-current'),
    musicWave: $('music-wave'),
    musicAlbum: $('music-album'),
    musicTrack: $('music-track'),
    musicQueueAdd: $('music-queue-add'),
    musicQueueList: $('music-queue-list'),
    musicQueueCount: $('music-queue-count'),
    musicQueueEmpty: $('music-queue-empty'),
    musicQueuePlay: $('music-queue-play'),
    musicQueueNext: $('music-queue-next'),
    musicQueueClear: $('music-queue-clear'),
    musicLibraryCount: $('music-library-count'),
    musicState: $('music-state'),
    musicPlayerState: $('music-player-state'),
    dataSave: $('data-save'),
    dataLoad: $('data-load'),
    dataExport: $('data-export'),
    dataImport: $('data-import'),
    dataImportFile: $('data-import-file'),
    saveSlotSelect: $('save-slot-select'),
    saveSlotName: $('save-slot-name'),
    saveSlotCount: $('save-slot-count'),
    saveSlotSave: $('save-slot-save'),
    saveSlotLoad: $('save-slot-load'),
    saveSlotRename: $('save-slot-rename'),
    saveSlotDelete: $('save-slot-delete'),
    saveSlotStatus: $('save-slot-status'),

    gameCursor: $('game-cursor'),

    storyView: $('view-story'),
    storyClose: $('story-close'),
    storyTree: $('story-tree'),
    storyStage: $('story-stage'),
    storyNodes: $('story-nodes'),
    storyLinks: $('story-links'),
    storyCanvasGrid: $('story-canvas-grid'),

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

    battleStage: $('battle-stage'),
    battlePlayerBar: $('battle-player-bar'),
    battleBeetleBar: $('battle-beetle-bar'),
    battlePlayerHp: $('battle-player-hp'),
    battleBeetleHp: $('battle-beetle-hp'),
    battleEnemyName: $('battle-enemy-name'),
    battleEyebrow: $('battle-eyebrow'),
    battleHint: $('battle-hint'),
    battleAbort: $('battle-abort'),
    battleDash: $('battle-dash'),
    battleDashState: $('battle-dash-state'),
    battleDashTouch: $('battle-dash-touch'),
    battleReflect: $('battle-reflect'),
    battleReflectTouch: $('battle-reflect-touch'),
    battleReflectState: $('battle-reflect-state'),
    battleRhythm: $('battle-rhythm'),
    battleRhythmBeat: $('battle-rhythm-beat'),
    battleRhythmCombo: $('battle-rhythm-combo'),

    chaseStage: $('chase-stage'),
    chaseBreaths: $('chase-breaths'),
    chaseTime: $('chase-time'),
    chaseHint: $('chase-hint'),
    chaseStaminaBar: $('chase-stamina-bar'),
    chaseAbort: $('chase-abort'),
    chaseDashTouch: $('chase-dash-touch'),

    inventoryView: $('view-inventory'),
    inventoryGraph: $('inventory-graph'),
    inventoryGrid: $('inventory-grid'),
    inventoryStage: $('inventory-stage'),
    inventoryNodes: $('inventory-nodes'),
    inventoryLinks: $('inventory-links'),
    inventorySlots: $('inventory-slots'),
    inventoryCapacity: $('inventory-capacity'),
    inventoryZoomIn: $('inventory-zoom-in'),
    inventoryZoomOut: $('inventory-zoom-out'),
    inventoryZoomReset: $('inventory-zoom-reset'),
    inventoryZoomLabel: $('inventory-zoom-label'),
    inventoryDetail: $('inventory-detail'),
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
    canvasGrid: $('canvas-grid'),
    canvasStage: $('canvas-stage'),
    canvasElements: $('canvas-elements'),
    canvasLinks: $('canvas-links'),
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
    canvasLayoutSave: $('canvas-layout-save'),
    canvasKeys: $('canvas-keys'),
    canvasKeysToggle: $('canvas-keys-toggle'),
    canvasKeysTabs: $('canvas-keys-tabs'),
    canvasKeysBody: $('canvas-keys-body'),
    canvasKeyboard: $('canvas-keyboard'),
    canvasKeyboardHint: $('canvas-keyboard-hint'),

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

    soundtrack: $('soundtrack'),
    soundtrackB: $('soundtrack-b')
  };

  const VIEWS = {
    main: dom.viewMain,
    inventory: dom.inventoryView,
    map: dom.mapView,
    canvas: dom.canvasView,
    card: dom.cardView,
    story: dom.storyView,
    settings: dom.settingsView,
    termSettings: dom.termSettingsView,
    fontSettings: dom.fontSettingsView,
    music: dom.musicView,
    arcade: dom.arcadeView,
    trial: dom.trialView
  };

  const SAVE_VERSION = 1;
  const SAVE_SLOTS_KEY = 'zqwy.labyrinth.slots.v1';
  const TERM_SETTINGS_KEY = 'zqwy.labyrinth.terminal.v1';
  const SPLIT_KEY = 'zqwy.labyrinth.split.v1';
  const DIVIDER_H = 10;
  const SPEED_MIN = 12;
  const SPEED_MAX = 220;
  const FONT_MIN = 10;
  const FONT_MAX = 24;
  const FONT_BASE = 14;
  const OVERRIDE_MAX = 28;
  const UNLOCK_IDS = ['backpack', 'map', 'table', 'cards'];
  const LOG_KEYS = ['terminal', 'scenes', 'system', 'world', 'movement', 'actions', 'commands'];

  function loggingDefaults() {
    const source = (C.terminal && C.terminal.logging) || {};
    const result = { enabled: Boolean(source.enabled) };
    for (const key of LOG_KEYS) {
      result[key] = source[key] !== false;
    }
    return result;
  }

  const DEFAULT_TERM_SETTINGS = {
    speed: 70,
    fontSize: 14,
    fontOverrides: { terminal: 0, table: 0 },
    logging: loggingDefaults(),
    music: C.music ? C.music.enabled !== false : true,
    musicVolume: C.music && Number.isFinite(C.music.volume) ? C.music.volume : 0.55,
    musicRate: C.music && Number.isFinite(C.music.rate) ? C.music.rate : 1,
    musicAlgorithm: C.music && Array.isArray(C.music.rateAlgorithms) &&
      C.music.rateAlgorithms[0] ? C.music.rateAlgorithms[0].id : 'tempo'
  };

  const rt = {
    world: null,
    state: null,
    images: null,
    worldCtx: null,
    lastFrame: 0,
    keys: Object.create(null),
    invulnUntil: 0,
    /* Не сохраняется: короткая анимация гибели живёт только в кадре. */
    deathFx: null,
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
    battle: null,
    battleRaf: 0,
    chase: null,
    chaseRaf: 0,
    cursorMode: 'vector',
    cursorHover: null,
    cursorPath: null,
    musicFadeTimer: 0,

    termSettings: {
      speed: DEFAULT_TERM_SETTINGS.speed,
      fontSize: DEFAULT_TERM_SETTINGS.fontSize,
      fontOverrides: { ...DEFAULT_TERM_SETTINGS.fontOverrides },
      logging: { ...DEFAULT_TERM_SETTINGS.logging },
      music: DEFAULT_TERM_SETTINGS.music,
      musicVolume: DEFAULT_TERM_SETTINGS.musicVolume,
      musicRate: DEFAULT_TERM_SETTINGS.musicRate,
      musicAlgorithm: DEFAULT_TERM_SETTINGS.musicAlgorithm
    },
    logBusy: false,
    logToken: 0,
    logSkip: false,
    logQueue: [],
    logIdleCallbacks: [],

    commandHistory: [],
    commandHistoryIndex: -1,
    commandDraft: '',
    commandSuggestions: [],
    commandSuggestIndex: -1,
    moveLogAt: 0,
    moveLogDir: '',

    timedMove: null,
    cursorMove: null,
    cursorHold: false,
    cursorPointer: null,
    cursorPos: { x: 0, y: 0, inside: false, down: false },
    storyPositions: Object.create(null),
    storyPan: null,
    storyZoom: 1,
    storyPanX: 0,
    storyPanY: 0,
    /* Закреплённый узел ветви и компактный режим карточек. */
    storyPinnedId: null,
    storySelectedId: null,
    storyCompact: false,
    inventoryPositions: Object.create(null),
    inventorySelected: null,
    inventoryZoom: 1,
    inventoryPanX: 0,
    inventoryPanY: 0,
    inventoryDrag: null,
    /* Наличие автомата в графе инвентаря: перерисовываем только при
       смене состояния, а не каждый кадр. */
    inventoryCabinetPresent: false,
    arcadePushSaveAt: 0,
    loadMs: 0,
    aspectRatio: 0,
    aspectWarned: false,
    musicTimer: 0
  };

  function defaultState(seed) {
    return {
      version: SAVE_VERSION,
      seed,
      player: { x: 0, y: 0, facingX: 0, facingY: -1, moving: false },
      camera: { x: 0, y: 0 },
      animTime: 0,
      /* Счётчик шагов за всю игру: клетки, которые Zemic прошёл. */
      steps: 0,
      currentRoomId: null,
      flags: {},
      visited: {},
      /* Проигрыватель — такой же предмет в инвентаре, как рюкзак.
         Кассеты лежат внутри него и не занимают отдельные ячейки. */
      items: ['music_player'],
      backpacks: [],
      cassettes: Object.keys((C.music && C.music.tracks) || {}),
      activeCassette: 'forest',
      cassetteQueue: [],
      /* Последняя кассета, дорожка и результат аркадного автомата.
         Прогресс аркады — только записи и терминальный лог. */
      arcade: { cassette: null, album: null, track: null, plays: 0, last: null },
      /* Смещения аркадных автоматов от центра их клетки: корпус можно
         толкать, но он не проходит сквозь стены. Ключ — roomId. */
      arcadePositions: {},
      /* Читы сюжета: какие узлы ветви принудительно считаются
         пройденными и показывать ли закрытые узлы. */
      cheatStory: {},
      cheatStoryVisible: false,
      mapMarks: [],
      inventoryPositions: {},
      inventoryLayout: 0,
      canvasElements: [],
      canvasLayouts: {},
      storySeen: {},
      unlocks: { backpack: false, map: false, table: false, cards: false },
      deaths: 0,
      /* Живые диметродоны: пассивные мобы, которые ползают по миру и
         размножаются. Состояние переживает сохранение. */
      fauna: { dimetrodons: [], seeded: {}, features: {}, growthTimer: 0, births: 0 }
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

  /* Инвентарь ограничен числом ячеек. Базовое число задано в данных,
     а предметы-контейнеры (например, рюкзак) добавляют ячейки своим
     полем slotBonus. */
  function inventoryCapacity() {
    const base = C.inventory && Number.isFinite(C.inventory.baseSlots)
      ? C.inventory.baseSlots
      : 4;
    let bonus = 0;
    if (rt.state && Array.isArray(rt.state.items)) {
      for (const id of rt.state.items) {
        const item = C.items[id];
        if (item && Number.isFinite(item.slotBonus)) bonus += item.slotBonus;
      }
    }
    return base + bonus;
  }

  function inventoryUsed() {
    return rt.state && Array.isArray(rt.state.items) ? rt.state.items.length : 0;
  }

  function inventoryFree() {
    return Math.max(0, inventoryCapacity() - inventoryUsed());
  }

  function addInventoryItem(itemId, options) {
    if (!rt.state || !Array.isArray(rt.state.items)) {
      return { ok: false, reason: 'no-state' };
    }
    if (!knownItemId(itemId)) return { ok: false, reason: 'unknown' };
    if (rt.state.items.includes(itemId)) {
      return { ok: true, duplicate: true };
    }
    const force = Boolean(options && options.force);
    if (!force && inventoryUsed() >= inventoryCapacity()) {
      return { ok: false, reason: 'full', capacity: inventoryCapacity() };
    }
    rt.state.items.push(itemId);
    return { ok: true };
  }

  function removeInventoryItem(itemId) {
    if (!rt.state || !Array.isArray(rt.state.items)) return false;
    const index = rt.state.items.indexOf(itemId);
    if (index < 0) return false;
    rt.state.items.splice(index, 1);
    return true;
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
      nx: Number.isFinite(raw.nx) ? raw.nx : 0.5,
      ny: Number.isFinite(raw.ny) ? raw.ny : 0.5,
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

  function serializeState() {
    const state = rt.state;
    return {
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
      steps: Number.isFinite(state.steps) ? Math.max(0, Math.floor(state.steps)) : 0,
      items: state.items,
      backpacks: state.backpacks,
      cassettes: Array.isArray(state.cassettes) ? state.cassettes : [],
      activeCassette: state.activeCassette || 'forest',
      cassetteQueue: Array.isArray(state.cassetteQueue) ? state.cassetteQueue : [],
      arcade: state.arcade ? {
        cassette: state.arcade.cassette || null,
        album: state.arcade.album || null,
        track: state.arcade.track || null,
        plays: Number.isFinite(state.arcade.plays) ? state.arcade.plays : 0,
        last: state.arcade.last || null
      } : undefined,
      mapMarks: state.mapMarks,
      inventoryPositions: state.inventoryPositions || {},
      inventoryLayout: Number.isFinite(state.inventoryLayout) ? state.inventoryLayout : 0,
      arcadePositions: state.arcadePositions || {},
      cheatStory: state.cheatStory || {},
      cheatStoryVisible: Boolean(state.cheatStoryVisible),
      canvasElements: state.canvasElements,
      canvasLayouts: state.canvasLayouts || {},
      storySeen: state.storySeen,
      unlocks: state.unlocks,
      deaths: state.deaths,
      fauna: state.fauna ? {
        dimetrodons: Array.isArray(state.fauna.dimetrodons) ? state.fauna.dimetrodons : [],
        seeded: state.fauna.seeded || {},
        features: state.fauna.features || {},
        growthTimer: Number.isFinite(state.fauna.growthTimer) ? state.fauna.growthTimer : 0,
        births: Number.isFinite(state.fauna.births) ? state.fauna.births : 0
      } : undefined,
      savedAt: Date.now()
    };
  }

  function saveGame() {
    if (!rt.state || !rt.state.player) return false;
    try {
      window.localStorage.setItem(C.saveKey, JSON.stringify(serializeState()));
      return true;
    } catch (error) {
      /* Приватный режим или переполнение — игра продолжает работать. */
      return false;
    }
  }

  function resetTransientMotion() {
    rt.keys = Object.create(null);
    for (const key of Object.keys(rt.gamepadKeys)) rt.gamepadKeys[key] = false;
    rt.timedMove = null;
    rt.cursorMove = null;
    rt.cursorHold = false;
    rt.cursorPointer = null;
    if (rt.state && rt.state.player) rt.state.player.moving = false;
  }

  function closeAllOverlays() {
    rt.storyQueue.length = 0;
    rt.storyActive = false;
    if (rt.trialRaf) window.cancelAnimationFrame(rt.trialRaf);
    rt.trialRaf = 0;
    rt.trial = null;
    if (typeof ZQ.hideTrialStage === 'function') ZQ.hideTrialStage();
    if (rt.battleRaf) window.cancelAnimationFrame(rt.battleRaf);
    rt.battleRaf = 0;
    rt.battle = null;
    if (typeof ZQ.hideBattleStage === 'function') ZQ.hideBattleStage();
    if (rt.chaseRaf) window.cancelAnimationFrame(rt.chaseRaf);
    rt.chaseRaf = 0;
    rt.chase = null;
    if (typeof ZQ.hideChaseStage === 'function') ZQ.hideChaseStage();
    /* Засады бельзебуфо в проходах привязаны к миру: новый мир —
       новые засады, старые не должны оставаться. */
    rt.roam = null;
    rt.canvasLinkMode = false;
    rt.linkFirstId = null;
    rt.keyBindingId = null;
    rt.canvasDrag = null;
    rt.canvasPinch = null;
    rt.workspacePan = null;
    if (dom.canvasLinkToggle) dom.canvasLinkToggle.classList.remove('active');
    if (typeof ZQ.closeCanvasDrawer === 'function') ZQ.closeCanvasDrawer();
  }

  function applySaveData(saved) {
    if (!saved || typeof saved !== 'object') return { ok: false, reason: 'empty' };

    const started = now();
    const seed = typeof saved.seed === 'string' && saved.seed ? saved.seed : newSeed();
    closeAllOverlays();
    resetTransientMotion();

    rt.state = defaultState(seed);
    rt.world = window.World.generate(seed);
    hydrateState(saved);
    if (!ZQ.canStandAt(rt.state.player.x, rt.state.player.y)) respawnPlayerAtSpawn();
    if (typeof ZQ.resetStepTracker === 'function') ZQ.resetStepTracker();
    rt.state.currentRoomId = null;
    ZQ.snapCamera();
    rt.state.currentRoomId = ZQ.roomIdForPosition ? ZQ.roomIdForPosition() : rt.world.spawn.roomId;
    rt.loadMs = Math.max(0, Math.round(now() - started));

    ZQ.applyCanvasTransform();
    ZQ.renderCanvasElements();
    ZQ.renderCanvasDrawer();
    ZQ.renderKeyScheme();
    ZQ.setTerminalView('main');
    ZQ.updatePrompt();
    if (rt.state.currentRoomId) rt.state.visited[rt.state.currentRoomId] = true;
    ZQ.saveGame();
    return {
      ok: true,
      seed,
      savedAt: saved.savedAt || 0,
      source: saved.slotName || saved.source || 'save',
      slotName: saved.slotName || ''
    };
  }

  function loadGame() {
    const saved = readSave();
    if (!saved) return { ok: false, reason: 'empty' };
    return applySaveData(saved);
  }

  /* ------------------------ Именованные слоты ----------------------- */

  function normalizeSlotName(name) {
    const text = String(name == null ? '' : name)
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 40);
    return text;
  }

  function readSlotStore() {
    try {
      const raw = window.localStorage.getItem(SAVE_SLOTS_KEY);
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    } catch (error) {
      return {};
    }
  }

  function writeSlotStore(store) {
    try {
      window.localStorage.setItem(SAVE_SLOTS_KEY, JSON.stringify(store));
      return true;
    } catch (error) {
      return false;
    }
  }

  function listSaveSlots() {
    const store = readSlotStore();
    return Object.keys(store)
      .map((name) => {
        const data = store[name] || {};
        return {
          name,
          seed: typeof data.seed === 'string' ? data.seed : '',
          savedAt: Number.isFinite(data.savedAt) ? data.savedAt : 0,
          deaths: Number.isFinite(data.deaths) ? data.deaths : 0,
          items: Array.isArray(data.items) ? data.items.length : 0,
          rooms: data.visited && typeof data.visited === 'object'
            ? Object.keys(data.visited).length
            : 0
        };
      })
      .sort((a, b) => b.savedAt - a.savedAt);
  }

  function saveToSlot(name) {
    if (!rt.state || !rt.state.player) return { ok: false, reason: 'no-state' };
    const key = normalizeSlotName(name);
    if (!key) return { ok: false, reason: 'name' };
    const store = readSlotStore();
    const data = serializeState();
    data.slotName = key;
    data.savedAt = Date.now();
    store[key] = data;
    if (!writeSlotStore(store)) return { ok: false, reason: 'storage' };
    return { ok: true, name: key, savedAt: data.savedAt };
  }

  function loadFromSlot(name) {
    const key = normalizeSlotName(name);
    if (!key) return { ok: false, reason: 'name' };
    const store = readSlotStore();
    const data = store[key];
    if (!data) return { ok: false, reason: 'empty' };
    data.slotName = data.slotName || key;
    return applySaveData(data);
  }

  function renameSaveSlot(from, to) {
    const key = normalizeSlotName(from);
    const next = normalizeSlotName(to);
    if (!key || !next) return { ok: false, reason: 'name' };
    if (key === next) return { ok: true, name: next, unchanged: true };
    const store = readSlotStore();
    if (!store[key]) return { ok: false, reason: 'empty' };
    if (store[next]) return { ok: false, reason: 'exists' };
    store[next] = Object.assign({}, store[key], { slotName: next });
    delete store[key];
    if (!writeSlotStore(store)) return { ok: false, reason: 'storage' };
    return { ok: true, name: next, from: key };
  }

  function deleteSaveSlot(name) {
    const key = normalizeSlotName(name);
    if (!key) return { ok: false, reason: 'name' };
    const store = readSlotStore();
    if (!store[key]) return { ok: false, reason: 'empty' };
    delete store[key];
    if (!writeSlotStore(store)) return { ok: false, reason: 'storage' };
    return { ok: true, name: key };
  }

  /* Импорт мира принимает JSON из экспорта или из именованного слота. */
  function importGame(input) {
    let data = input;
    if (typeof input === 'string') {
      try {
        data = JSON.parse(input);
      } catch (error) {
        return { ok: false, reason: 'json' };
      }
    }
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      return { ok: false, reason: 'format' };
    }
    if (typeof data.seed !== 'string' || !data.seed.trim()) {
      return { ok: false, reason: 'seed' };
    }
    if (data.kind && data.kind !== 'zqwy-world' && data.kind !== 'zqwy-slot') {
      return { ok: false, reason: 'format' };
    }
    return applySaveData(data);
  }

  function respawnPlayerAtSpawn() {
    rt.state.player.x = rt.world.spawn.x;
    rt.state.player.y = rt.world.spawn.y;
    rt.state.player.facingX = 0;
    rt.state.player.facingY = -1;
    rt.state.player.moving = false;
    if (typeof ZQ.resetStepTracker === 'function') ZQ.resetStepTracker();
    if (typeof ZQ.snapCamera === 'function') ZQ.snapCamera();
  }

  function exportGame() {
    if (!rt.state || !rt.state.player) return false;
    const data = serializeState();
    data.exportedAt = new Date().toISOString();
    data.title = C.title;
    data.kind = 'zqwy-world';
    data.world = {
      seed: rt.state.seed,
      chunkSize: rt.world ? rt.world.CHUNK : null,
      rooms: rt.world ? rt.world.rooms.length : 0
    };
    const text = JSON.stringify(data, null, 2);

    try {
      const blob = new Blob([text], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `zqwy-world-${rt.state.seed || 'seed'}.json`;
      anchor.style.display = 'none';
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1500);
      return true;
    } catch (error) {
      return false;
    }
  }

  function coreVersion() {
    const build = window.ZQ_BUILD || {};
    const version = build.version || C.version || '0.0.0';
    const number = Number.isFinite(Number(build.build)) ? Number(build.build) : 0;
    return `${version} · ${tr('сборка')} ${number}`;
  }

  function bootMessage(seed, options) {
    const opts = options || {};
    const rooms = rt.world && Array.isArray(rt.world.rooms) ? rt.world.rooms.length : 0;
    const chunks = rt.world && Number.isFinite(rt.world.chunkCount) ? rt.world.chunkCount : 0;
    const loadMs = Math.max(0, Math.round(rt.loadMs || 0));
    const value = seed || (rt.state ? rt.state.seed : '');
    const slot = String(opts.slotName || '').trim();
    let head;
    if (opts.kind === 'load') {
      head = slot
        ? `${tr('Загружен мир:')} «${slot}» · seed: ${value}`
        : `${tr('Загружен сохранённый мир:')} ${value}`;
    } else {
      head = `${tr('Создан новый мир:')} ${value}`;
    }
    return [
      head,
      `${tr('Версия ядра:')} ${coreVersion()}`,
      `${tr('Мир готов:')} ${tr('за')} ${loadMs} ${tr('мс')} · ${tr('комнат:')} ${rooms} · ${tr('чанков:')} ${chunks} · seed: ${value}`,
      tr('Управление: W/A/S/D или стрелки — идти; E — действие; Enter — отправить команду; ↑/↓ — история команд.'),
      tr('ЛКМ по миру — идти к точке; удержание ЛКМ — следовать за курсором. ПКМ — сменить режим курсора.'),
      tr('Введи «помоги», чтобы увидеть команды. Команды открываются по мере истории. Настройки — «настройки», сюжет — «сюжет», запись действий — «логгирование».')
    ].join('\n');
  }

  function worldLoadMessage(seed, options) {
    return bootMessage(seed, options);
  }

  function aspectInfo() {
    const width = Math.max(1, window.innerWidth || 1);
    const height = Math.max(1, window.innerHeight || 1);
    const ratio = width / height;
    const limits = C.display || {};
    const min = Number.isFinite(limits.minAspect) ? limits.minAspect : 0.4;
    const max = Number.isFinite(limits.maxAspect) ? limits.maxAspect : 3.4;
    return {
      width,
      height,
      ratio,
      min,
      max,
      ok: ratio >= min && ratio <= max,
      ideal: Number.isFinite(limits.ideal) ? limits.ideal : 16 / 9,
      portrait: ratio < 1,
      landscape: ratio >= 1
    };
  }

  /* Кадр больше не обрезается. Сцена всегда занимает весь экран, а
     достаточная игровая дистанция обеспечивается размером тайла
     (см. Renderer.tilePxFor): в портрете видно больше клеток по
     вертикали, в ландшафте — по горизонтали. */
  function applyAspectLayout() {
    const info = aspectInfo();
    const stage = dom.stage || $('stage');
    const app = dom.app || $('app');
    if (stage) {
      stage.style.position = '';
      stage.style.left = '';
      stage.style.top = '';
      stage.style.width = '';
      stage.style.height = '';
      stage.classList.remove('cropped', 'aspect-cropped');
      stage.classList.toggle('portrait', info.portrait);
      stage.classList.toggle('landscape', !info.portrait);
      stage.dataset.aspect = info.portrait ? 'portrait' : 'landscape';
      stage.style.setProperty('--view-ratio', info.ratio.toFixed(4));
      stage.style.setProperty('--view-w', `${info.width}px`);
      stage.style.setProperty('--view-h', `${info.height}px`);
    }
    if (app) {
      app.classList.toggle('portrait', info.portrait);
      app.classList.toggle('landscape', !info.portrait);
    }
    return info;
  }

  function checkAspectRatio() {
    const info = applyAspectLayout();
    const changed = Math.abs(info.ratio - rt.aspectRatio) >= 0.01;
    rt.aspectRatio = info.ratio;
    if (!changed) return info;
    /* Пропорция больше не является ошибкой: сцена заполняет экран.
       Сообщение остаётся только для совсем необычных окон. */
    if (info.ok) {
      rt.aspectWarned = false;
      return info;
    }
    if (!rt.aspectWarned) {
      const text = `Пропорции экрана ${info.ratio.toFixed(2)}:1 вне рамок ${info.min.toFixed(2)}–${info.max.toFixed(2)}:1. Сцена не обрезана: видны все клетки, но раскладка может быть тесной.`;
      ZQ.appendLog(tr(text), 'sys', true);
      rt.aspectWarned = true;
    }
    return info;
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
    if (Number.isFinite(saved.steps)) {
      state.steps = Math.max(0, Math.floor(saved.steps));
    }
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
    /* Проигрыватель — стартовый предмет. Старые сохранения его не
       знали, а после смерти он может лежать в рюкзаке: в этом случае
       не выдаём второй, пока рюкзак не возвращён. */
    if (!state.items.includes('music_player') &&
        !state.backpacks.some((bp) => bp.items.includes('music_player'))) {
      state.items.unshift('music_player');
    }
    if (Array.isArray(saved.mapMarks)) {
      state.mapMarks = saved.mapMarks.filter((id) => typeof id === 'string');
    }
    if (Array.isArray(saved.cassettes)) {
      const tracks = (C.music && C.music.tracks) || {};
      state.cassettes = saved.cassettes.filter((id) =>
        typeof id === 'string' && Object.prototype.hasOwnProperty.call(tracks, id)
      );
    }
    /* Каталог треков подключается целиком: новые альбомы и дорожки,
       найденные сканером, становятся доступны в плеере без правки
       сохранения вручную. */
    const knownTracks = Object.keys((C.music && C.music.tracks) || {});
    for (const trackId of knownTracks) {
      if (!state.cassettes.includes(trackId)) state.cassettes.push(trackId);
    }
    if (!state.cassettes.includes('forest')) state.cassettes.unshift('forest');
    state.activeCassette = typeof saved.activeCassette === 'string' &&
      state.cassettes.includes(saved.activeCassette)
      ? saved.activeCassette
      : 'forest';
    if (Array.isArray(saved.cassetteQueue)) {
      state.cassetteQueue = saved.cassetteQueue
        .filter((id) => typeof id === 'string' && state.cassettes.includes(id))
        .slice(0, 64);
    }
    if (saved.arcade && typeof saved.arcade === 'object') {
      const arcade = saved.arcade;
      const last = arcade.last && typeof arcade.last === 'object' ? arcade.last : null;
      state.arcade = {
        cassette: typeof arcade.cassette === 'string' ? arcade.cassette : null,
        album: typeof arcade.album === 'string' ? arcade.album : null,
        track: typeof arcade.track === 'string' ? arcade.track : null,
        plays: Number.isFinite(arcade.plays) ? Math.max(0, Math.floor(arcade.plays)) : 0,
        last: last ? {
          track: typeof last.track === 'string' ? last.track : '',
          album: typeof last.album === 'string' ? last.album : '',
          title: typeof last.title === 'string' ? last.title : '',
          score: Number.isFinite(last.score) ? last.score : 0,
          acc: Number.isFinite(last.acc) ? last.acc : 0,
          rank: typeof last.rank === 'string' ? last.rank : '',
          rankName: typeof last.rankName === 'string' ? last.rankName : '',
          at: Number.isFinite(last.at) ? last.at : 0
        } : null
      };
    }
    if (saved.inventoryPositions && typeof saved.inventoryPositions === 'object') {
      for (const id of Object.keys(saved.inventoryPositions)) {
        const entry = saved.inventoryPositions[id];
        if (!entry || !Number.isFinite(entry.nx) || !Number.isFinite(entry.ny)) continue;
        state.inventoryPositions[id] = {
          nx: entry.nx,
          ny: entry.ny
        };
      }
    }
    state.inventoryLayout = Number.isFinite(saved.inventoryLayout)
      ? saved.inventoryLayout
      : 0;
    if (saved.arcadePositions && typeof saved.arcadePositions === 'object') {
      for (const key of Object.keys(saved.arcadePositions)) {
        const entry = saved.arcadePositions[key];
        if (!entry || !Number.isFinite(entry.ox) || !Number.isFinite(entry.oy)) continue;
        state.arcadePositions[key] = { ox: entry.ox, oy: entry.oy };
      }
    }
    if (saved.cheatStory && typeof saved.cheatStory === 'object') {
      for (const id of Object.keys(saved.cheatStory)) {
        if (saved.cheatStory[id]) state.cheatStory[id] = true;
      }
    }
    state.cheatStoryVisible = Boolean(saved.cheatStoryVisible);
    if (Array.isArray(saved.canvasElements)) {
      state.canvasElements = saved.canvasElements
        .map(normalizeCanvasElement)
        .filter(Boolean);
      if (typeof ZQ.normalizeTableBindings === 'function') ZQ.normalizeTableBindings();
    }
    if (saved.canvasLayouts && typeof saved.canvasLayouts === 'object') {
      for (const name of Object.keys(saved.canvasLayouts)) {
        const layout = saved.canvasLayouts[name];
        if (!layout || typeof layout !== 'object') continue;
        state.canvasLayouts[name] = {
          zoom: Number.isFinite(layout.zoom) ? layout.zoom : 1,
          panX: Number.isFinite(layout.panX) ? layout.panX : 0,
          panY: Number.isFinite(layout.panY) ? layout.panY : 0,
          elements: Array.isArray(layout.elements)
            ? layout.elements
              .filter((entry) => entry && typeof entry.id === 'string' &&
                Number.isFinite(entry.nx) && Number.isFinite(entry.ny))
              .map((entry) => ({ id: entry.id, nx: entry.nx, ny: entry.ny }))
            : [],
          savedAt: Number.isFinite(layout.savedAt) ? layout.savedAt : 0
        };
      }
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
    if (saved.fauna && typeof saved.fauna === 'object') {
      const fauna = state.fauna || (state.fauna = {});
      fauna.dimetrodons = Array.isArray(saved.fauna.dimetrodons)
        ? saved.fauna.dimetrodons
          .filter((mon) => mon && Number.isFinite(mon.x) && Number.isFinite(mon.y))
          .map((mon) => ({
            x: mon.x,
            y: mon.y,
            tx: Number.isFinite(mon.tx) ? mon.tx : mon.x,
            ty: Number.isFinite(mon.ty) ? mon.ty : mon.y,
            speed: Number.isFinite(mon.speed) ? mon.speed : 1,
            angle: Number.isFinite(mon.angle) ? mon.angle : 0,
            phase: Number.isFinite(mon.phase) ? mon.phase : 0,
            roomId: typeof mon.roomId === 'string' ? mon.roomId : null,
            rest: Number.isFinite(mon.rest) ? mon.rest : 0
          }))
        : [];
      fauna.seeded = (saved.fauna.seeded && typeof saved.fauna.seeded === 'object')
        ? saved.fauna.seeded
        : {};
      fauna.features = (saved.fauna.features && typeof saved.fauna.features === 'object')
        ? saved.fauna.features
        : {};
      fauna.growthTimer = Number.isFinite(saved.fauna.growthTimer) ? saved.fauna.growthTimer : 0;
      fauna.births = Number.isFinite(saved.fauna.births) ? saved.fauna.births : 0;
    }
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
    if (meta) return meta.hint;
    return tr('Это откроется позже.');
  }

  function denyLocked(id) {
    return `${tr('Пока недоступно. ')}${unlockHint(id)}`;
  }

  /* Рывок закрыт способностью, пока Zemic её не открыл. Порог задан в
     C.battle.dash: enabled=false снимает гейт целиком, flag/item
     задают условие открытия. Триггер легко поменять позже — достаточно
     выставить флаг (или выдать предмет) в нужный момент. */
  function hasDashAbility() {
    const gate = (C.battle && C.battle.dash) || {};
    if (gate.enabled === false) return true;
    const state = rt.state;
    if (!state) return false;
    if (gate.flag && state.flags && state.flags[gate.flag]) return true;
    if (gate.item && Array.isArray(state.items) && state.items.includes(gate.item)) return true;
    return false;
  }

  function setDashAbility(open, quiet) {
    const gate = (C.battle && C.battle.dash) || {};
    if (!gate.flag || !rt.state) return false;
    if (!rt.state.flags) rt.state.flags = {};
    rt.state.flags[gate.flag] = Boolean(open);
    if (!quiet) {
      ZQ.appendLog(open
        ? tr('Рывок открыт: теперь Shift, ПРОБЕЛ или E дают ускорение.')
        : tr('Рывок снова закрыт.'), 'sys', true);
    }
    saveGame();
    return true;
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
    /* В портрете Лабиринт получает большую долю высоты: так в кадр
       помещается больше проходов, а терминал остаётся читаемым. */
    const portrait = window.innerHeight > window.innerWidth;
    const fallback = portrait ? 0.6 : 0.56;
    applySplit(Number.isFinite(saved) ? saved : fallback, false);

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
      checkAspectRatio();
    });
    window.addEventListener('orientationchange', () => {
      window.setTimeout(() => {
        applySplit(rt.splitRatio, false);
        checkAspectRatio();
      }, 120);
    });
  }

  function startNewGame() {
    const started = now();
    const seed = newSeed();
    try {
      window.localStorage.removeItem(C.saveKey);
    } catch (error) {
      /* Приватный режим: сохранение просто не было создано. */
    }

    rt.storyQueue.length = 0;
    rt.storyActive = false;
    rt.storyPositions = Object.create(null);
    rt.storyPan = null;
    rt.storyPinnedId = null;
    rt.storySelectedId = null;
    rt.storyCompact = false;
    if (rt.trialRaf) window.cancelAnimationFrame(rt.trialRaf);
    rt.trialRaf = 0;
    rt.trial = null;
    ZQ.hideTrialStage();
    if (rt.battleRaf) window.cancelAnimationFrame(rt.battleRaf);
    rt.battleRaf = 0;
    rt.battle = null;
    if (typeof ZQ.hideBattleStage === 'function') ZQ.hideBattleStage();
    if (rt.chaseRaf) window.cancelAnimationFrame(rt.chaseRaf);
    rt.chaseRaf = 0;
    rt.chase = null;
    if (typeof ZQ.hideChaseStage === 'function') ZQ.hideChaseStage();

    rt.state = defaultState(seed);
    rt.world = window.World.generate(seed);
    rt.state.player.x = rt.world.spawn.x;
    rt.state.player.y = rt.world.spawn.y;
    rt.state.player.facingX = 0;
    rt.state.player.facingY = -1;
    rt.state.player.moving = false;
    rt.state.currentRoomId = rt.world.spawn.roomId;
    rt.state.visited[rt.world.spawn.roomId] = true;
    if (typeof ZQ.resetStepTracker === 'function') ZQ.resetStepTracker();

    resetTransientMotion();
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
    rt.loadMs = Math.max(0, Math.round(now() - started));
    ZQ.clearLog();
    ZQ.appendLog(bootMessage(seed), 'sys', true);
    setTerminalView('main');
    ZQ.applyCanvasTransform();
    ZQ.renderCanvasElements();
    ZQ.updatePrompt();
    saveGame();
  }

  /* Зеркальная загадка — первый сюжетный порог. Пока Роза не получила
     ответ, Лабиринт молчит: болото не замедляет шаг, звери не сеются,
     жабы и змея не начинают сцен. Мир при этом уже сгенерирован —
     гейт только скрывает и оживляет его. */
  function cheatStoryHas(id) {
    const cheat = rt.state && rt.state.cheatStory;
    return Boolean(cheat && typeof cheat === 'object' && cheat[id]);
  }

  function mirrorSolved() {
    return Boolean(rt.state && rt.state.flags && rt.state.flags.mirrorAnswer) ||
      cheatStoryHas('mirror');
  }

  function storyGateOpen() {
    return mirrorSolved();
  }

  const ZQ = {
    C,
    $,
    dom,
    VIEWS,
    rt,
    constants: {
      SAVE_VERSION,
      SAVE_SLOTS_KEY,
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
    LOG_KEYS,
    clamp,
    lerp,
    now,
    tr,
    plural,
    makeId,
    defaultState,
    newSeed,
    readSave,
    saveGame,
    loadGame,
    exportGame,
    applySaveData,
    importGame,
    normalizeSlotName,
    listSaveSlots,
    saveToSlot,
    loadFromSlot,
    renameSaveSlot,
    deleteSaveSlot,
    serializeState,
    coreVersion,
    bootMessage,
    worldLoadMessage,
    aspectInfo,
    applyAspectLayout,
    /* Старое имя оставлено как совместимый псевдоним: обрезки больше нет. */
    applyAspectCrop: applyAspectLayout,
    checkAspectRatio,
    resetTransientMotion,
    isDeathAnimating() { return Boolean(rt.deathFx && rt.deathFx.active); },
    knownItemId,
    inventoryCapacity,
    inventoryUsed,
    inventoryFree,
    addInventoryItem,
    removeInventoryItem,
    normalizeCanvasElement,
    hydrateState,
    hasUnlock,
    unlock,
    unlockHint,
    denyLocked,
    mirrorSolved,
    storyGateOpen,
    cheatStoryHas,
    hasDashAbility,
    setDashAbility,
    setTerminalView,
    ensureTerminalShare,
    applySplit,
    initDivider,
    startNewGame,
    isTrialBlocking() {
      return rt.termView === 'trial' || Boolean(rt.trial && rt.trial.active);
    },
    isBattleBlocking() {
      /* Схватка и погоня идут прямо в мире и не блокируют вкладки. */
      return false;
    },
    isPaused() {
      if (document.hidden) return true;
      /* Пока Zemic падает после смерти, мир стоит: возврат к Скрижали
         произойдёт из updateDeathFx() в конце анимации. */
      if (rt.deathFx && rt.deathFx.active) return true;
      /* Вкладки терминала — читаемые представления, а не модальные окна:
         инвентарь, карта, сюжет, настройки, музыка и стол не должны отбирать
         управление у Zemic. Схватка и погоня тоже живут в мире, поэтому
         останавливает игру только испытание, аркадный автомат или
         скрытая вкладка. */
      return rt.termView === 'trial' || rt.termView === 'arcade';
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
