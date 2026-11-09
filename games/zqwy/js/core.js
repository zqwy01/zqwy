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
    musicRate: $('music-rate'),
    musicRateValue: $('music-rate-value'),
    musicWave: $('music-wave'),
    musicState: $('music-state'),
    musicPlayerState: $('music-player-state'),
    dataSave: $('data-save'),
    dataLoad: $('data-load'),
    dataExport: $('data-export'),

    gameCursor: $('game-cursor'),

    storyView: $('view-story'),
    storyClose: $('story-close'),
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
    canvasKeys: $('canvas-keys'),
    canvasKeysToggle: $('canvas-keys-toggle'),
    canvasKeysTabs: $('canvas-keys-tabs'),
    canvasKeysBody: $('canvas-keys-body'),
    canvasKeyboard: $('canvas-keyboard'),
    canvasKeyboardHint: $('canvas-keyboard-hint'),
    canvasMoveSeconds: $('canvas-move-seconds'),
    canvasMoveNote: $('canvas-move-note'),
    canvasMoveStop: $('canvas-move-stop'),

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
    termSettings: dom.termSettingsView,
    fontSettings: dom.fontSettingsView,
    music: dom.musicView,
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
    musicRate: C.music && Number.isFinite(C.music.rate) ? C.music.rate : 1
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
      music: DEFAULT_TERM_SETTINGS.music,
      musicVolume: DEFAULT_TERM_SETTINGS.musicVolume,
      musicRate: DEFAULT_TERM_SETTINGS.musicRate
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
      currentRoomId: null,
      flags: {},
      visited: {},
      items: [],
      backpacks: [],
      mapMarks: [],
      canvasElements: [],
      storySeen: {},
      unlocks: { backpack: false, map: false, table: false, cards: false },
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
      items: state.items,
      backpacks: state.backpacks,
      mapMarks: state.mapMarks,
      canvasElements: state.canvasElements,
      storySeen: state.storySeen,
      unlocks: state.unlocks,
      deaths: state.deaths,
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
    rt.canvasLinkMode = false;
    rt.linkFirstId = null;
    rt.keyBindingId = null;
    rt.canvasDrag = null;
    rt.canvasPinch = null;
    rt.workspacePan = null;
    if (dom.canvasLinkToggle) dom.canvasLinkToggle.classList.remove('active');
    if (typeof ZQ.closeCanvasDrawer === 'function') ZQ.closeCanvasDrawer();
  }

  function loadGame() {
    const saved = readSave();
    if (!saved) return { ok: false, reason: 'empty' };

    const started = now();
    const seed = typeof saved.seed === 'string' && saved.seed ? saved.seed : newSeed();
    closeAllOverlays();
    resetTransientMotion();

    rt.state = defaultState(seed);
    rt.world = window.World.generate(seed);
    hydrateState(saved);
    if (!ZQ.canStandAt(rt.state.player.x, rt.state.player.y)) respawnPlayerAtSpawn();
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
    return { ok: true, seed, savedAt: saved.savedAt || 0 };
  }

  function respawnPlayerAtSpawn() {
    rt.state.player.x = rt.world.spawn.x;
    rt.state.player.y = rt.world.spawn.y;
    rt.state.player.facingX = 0;
    rt.state.player.facingY = -1;
    rt.state.player.moving = false;
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

  function bootMessage(seed) {
    const rooms = rt.world && Array.isArray(rt.world.rooms) ? rt.world.rooms.length : 0;
    const chunks = rt.world && Number.isFinite(rt.world.chunkCount) ? rt.world.chunkCount : 0;
    const loadMs = Math.max(0, Math.round(rt.loadMs || 0));
    const value = seed || (rt.state ? rt.state.seed : '');
    return [
      `${tr('Версия ядра:')} ${coreVersion()}`,
      `${tr('Мир загружен:')} ${tr('за')} ${loadMs} ${tr('мс')} · ${tr('комнат:')} ${rooms} · ${tr('чанков:')} ${chunks} · seed: ${value}`,
      tr('Управление: W/A/S/D или стрелки — идти; E — действие; Enter — отправить команду; ↑/↓ — история команд.'),
      tr('ЛКМ по миру — идти к точке; удержание ЛКМ — следовать за курсором.'),
      tr('Введи «помоги», чтобы увидеть команды. Команды открываются по мере истории. Настройки — «настройки», сюжет — «сюжет», запись действий — «логгирование».')
    ].join('\n');
  }

  function worldLoadMessage(seed) {
    return bootMessage(seed);
  }

  function aspectInfo() {
    const width = Math.max(1, window.innerWidth || 1);
    const height = Math.max(1, window.innerHeight || 1);
    const ratio = width / height;
    const limits = C.display || { minAspect: 1.32, maxAspect: 2.4, ideal: 16 / 9 };
    const min = Number.isFinite(limits.minAspect) ? limits.minAspect : 1.32;
    const max = Number.isFinite(limits.maxAspect) ? limits.maxAspect : 2.4;
    return {
      width,
      height,
      ratio,
      min,
      max,
      ok: ratio >= min && ratio <= max,
      ideal: Number.isFinite(limits.ideal) ? limits.ideal : 16 / 9
    };
  }

  function checkAspectRatio() {
    const info = aspectInfo();
    const changed = Math.abs(info.ratio - rt.aspectRatio) >= 0.01;
    rt.aspectRatio = info.ratio;
    if (!changed) return info;
    /* Предупреждение живёт только в терминале: отдельного визуального
       баннера нет. Проверка срабатывает на каждое изменение пропорций,
       но текст выводится один раз при выходе за диапазон. */
    if (info.ok) {
      rt.aspectWarned = false;
      return info;
    }
    if (!rt.aspectWarned) {
      const text = `Пропорции экрана ${info.ratio.toFixed(2)}:1 вне рекомендуемого диапазона ${info.min.toFixed(2)}–${info.max.toFixed(2)}:1 (≈16:9). Возможны визуальные дефекты.`;
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
    if (meta) return meta.hint;
    return tr('Это откроется позже.');
  }

  function denyLocked(id) {
    return `${tr('Пока недоступно. ')}${unlockHint(id)}`;
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
    serializeState,
    coreVersion,
    bootMessage,
    worldLoadMessage,
    aspectInfo,
    checkAspectRatio,
    resetTransientMotion,
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
      return rt.termView !== 'main' && rt.termView !== 'canvas';
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
