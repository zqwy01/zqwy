// Runtime wiring for the “To East” browser prototype.
// The module connects the dependency-free core, data, rendering and UI layers.

import {
  DIRS,
  SAVE_VERSION,
  addCanvasLink,
  addInventoryItem,
  canvasPalette,
  commandUnlocked,
  createInitialState,
  currentRoom,
  dangerPosition,
  doorCenter,
  doorSpanFor,
  dropBackpack,
  elementAvailable,
  exitAt,
  hasItem,
  makeCanvasElement,
  markRoomVisited,
  mulberry32,
  nearestInteractable,
  normalizeSettings,
  normalizeState,
  pickupBackpack,
  removeCanvasElement,
  spawnPointForEntry,
} from './east-core.js';
import {
  CARD_ORDER,
  COMMANDS,
  COMMAND_BY_ID,
  ITEM_DEFS,
  KEYBOARD_ROWS,
  KEY_ACTIONS,
  MUSIC_MAP,
  PROLOGUE,
  ROOM_COPY,
  STORY_PLOT,
  TRIAL,
  TUTORIAL_LINES,
  WALK_COMMAND_LIST,
  commandForAlias,
} from './east-data.js';
import {
  languageName,
  pick,
  setLanguage,
  t,
  translateDocument,
} from './east-i18n.js';
import { AudioManager } from './east-audio.js';
import { Renderer } from './east-render.js';
import { createUI } from './east-ui.js';

const SAVE_KEY = 'toEast.save.v1';
const PLAYER_SPEED = 152;
const CURSOR_SPEED = 176;
const TRIAL_SPEED = 186;
const DASH_SPEED = 520;
const DASH_COOLDOWN = 1.05;
const TRIAL_DASH_COOLDOWN = 1.05;
const ACTION_RADIUS = 0.17;
const WALK_SPEED = 0.235;
const WALK_CLAMP = 0.02;
const TRIAL_MAX_BULLETS = 260;

const DEFINITIONS = {
  builtinCommands: COMMANDS,
  items: ITEM_DEFS,
};

const params = new URLSearchParams(window.location.search);
const bootStartedAt = performance.now();
let state = loadState();
setLanguage(state.settings.language);

const runtime = {
  clock: 0,
  walkClock: 0,
  lastFrame: 0,
  keys: new Set(),
  virtual: new Set(),
  moving: false,
  facing: state.player.facing || 'up',
  lastMove: null,
  walk: null,
  commandTarget: null,
  cursorTarget: null,
  cursorHeld: false,
  autoExit: null,
  flash: 0,
  shake: 0,
  promptLabel: null,
  trial: null,
  trialUiClock: 0,
  dashCooldown: 0,
  dashTimer: 0,
  dashDirection: { x: 0, y: 0 },
  dashInvulnerable: 0,
  dashTrail: [],
  deathLock: false,
  dying: false,
  stepAccumulator: 0,
  introShown: false,
};

let ui;
let renderer;
let audio;
let saveTimer = 0;
let lastAspectOk = null;
let aspectState = { ratio: '9:16', ok: true, label: '9:16' };
let resizeTimer = 0;

// ---------------------------------------------------------------------------
// Persistence

function generationOptions() {
  const story = params.get('story');
  if (story === '1') return { forceStory: true };
  if (story === '0') return { forceStory: false };
  return {};
}

function loadState() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (raw) {
      const parsed = normalizeState(JSON.parse(raw));
      if (parsed) return parsed;
    }
  } catch {
    // A broken or unavailable localStorage must not stop the prototype.
  }
  const seed = params.get('seed');
  return createInitialState(seed || Date.now(), generationOptions());
}

function saveNow() {
  clearTimeout(saveTimer);
  saveTimer = 0;
  state.savedAt = Date.now();
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(state));
  } catch {
    // Saving is best effort. The game keeps running if storage is unavailable.
  }
}

function scheduleSave() {
  if (saveTimer) return;
  saveTimer = window.setTimeout(saveNow, 140);
}

function adoptState(next, options = {}) {
  if (!next) return;
  state = next;
  setLanguage(state.settings.language);
  runtime.facing = state.player.facing || 'down';
  runtime.trial = null;
  runtime.walk = null;
  runtime.commandTarget = null;
  runtime.cursorTarget = null;
  runtime.cursorHeld = false;
  runtime.autoExit = null;
  runtime.dying = false;
  runtime.deathLock = false;
  runtime.promptLabel = null;
  runtime.dashTimer = 0;
  runtime.dashInvulnerable = 0;
  runtime.dashTrail = [];
  runtime.keys.clear();
  runtime.virtual.clear();

  translateDocument(document);
  ui.setSettings(state.settings);
  ui.setAspect(aspectState);
  ui.setSound(state.settings.sound);
  ui.setTrial(false);
  ui.setPrompt(null);
  ui.setRoom(state, currentRoom(state), { banner: Boolean(options.banner) });
  ui.setCanvasData(state, buildPalette());
  audio.setEnabled(state.settings.sound);
  audio.setVolume(state.settings.musicVolume);
  playRoomMusic();
  saveNow();
}

function resetGame() {
  const next = createInitialState(Date.now(), generationOptions());
  next.settings = normalizeSettings({ ...state.settings });
  ui.clearTerminal();
  ui.clearHistory();
  runtime.introShown = false;
  adoptState(next, { banner: true });
  ui.showToast(t('banner.newLabyrinth'), { tone: 'info' });
  log(t('reset.done'), 'system');
  log(t(TUTORIAL_LINES[0]), 'system');
  if (!next.flags.introSeen) showPrologue();
  requestAnimationFrame(() => renderer.resize());
}

// ---------------------------------------------------------------------------
// Helpers

function log(text, tone = 'world', options = {}) {
  ui.log(text, tone, options);
}

function afterStateChange() {
  ui.setRoom(state, currentRoom(state));
  if (ui.isCanvasOpen()) ui.setCanvasData(state, buildPalette());
  scheduleSave();
}

function buildPalette() {
  return canvasPalette(state, DEFINITIONS).map((descriptor) => ({
    ...descriptor,
    key: `${descriptor.sourceType}:${descriptor.sourceId || descriptor.id || descriptor.command}`,
    available: true,
  }));
}

function facingFromVector(vx, vy) {
  if (Math.abs(vx) < 0.12 && Math.abs(vy) < 0.12) return runtime.facing;
  const horizontal = Math.abs(vx) > 0.18 ? (vx < 0 ? 'left' : 'right') : '';
  const vertical = Math.abs(vy) > 0.18 ? (vy < 0 ? 'up' : 'down') : '';
  if (horizontal && vertical) return `${vertical}-${horizontal}`;
  return horizontal || vertical || runtime.facing;
}

function directionFromFacing(facing) {
  switch (facing) {
    case 'up': return { x: 0, y: -1 };
    case 'down': return { x: 0, y: 1 };
    case 'left': return { x: -1, y: 0 };
    case 'right': return { x: 1, y: 0 };
    case 'up-left': return { x: -0.7071, y: -0.7071 };
    case 'up-right': return { x: 0.7071, y: -0.7071 };
    case 'down-left': return { x: -0.7071, y: 0.7071 };
    case 'down-right': return { x: 0.7071, y: 0.7071 };
    default: return { x: 0, y: 0 };
  }
}

function roomMetrics() {
  return renderer?.metrics().roomRect || { x: 0, y: 0, w: 320, h: 426 };
}

function movePlayerByPixels(player, px, py, clampBounds = true) {
  const rr = roomMetrics();
  player.x += px / rr.w;
  player.y += py / rr.h;
  if (clampBounds) {
    player.x = Math.max(WALK_CLAMP, Math.min(1 - WALK_CLAMP, player.x));
    player.y = Math.max(WALK_CLAMP, Math.min(1 - WALK_CLAMP, player.y));
  }
}

function getInputVector() {
  let x = 0;
  let y = 0;
  if (runtime.keys.has('left') || runtime.virtual.has('left')) x -= 1;
  if (runtime.keys.has('right') || runtime.virtual.has('right')) x += 1;
  if (runtime.keys.has('up') || runtime.virtual.has('up')) y -= 1;
  if (runtime.keys.has('down') || runtime.virtual.has('down')) y += 1;
  if (x !== 0 && y !== 0) {
    x *= 0.7071;
    y *= 0.7071;
  }
  return { x, y };
}

function interactionLabel(interaction) {
  if (!interaction) return null;
  switch (interaction.kind) {
    case 'pack': return t('prompt.pack');
    case 'item': return pick(ROOM_COPY.find.interact);
    case 'trial': return pick(ROOM_COPY.story.interact);
    case 'tablet': return t('prompt.tablet');
    default: return t('prompt.action');
  }
}

function getInteraction(radius = ACTION_RADIUS) {
  const room = currentRoom(state);
  if (!room) return null;
  const candidate = nearestInteractable(state, { radius });
  if (!candidate) return null;
  if (candidate.kind === 'pack') return candidate;
  const distance = Math.hypot(candidate.x - state.player.x, candidate.y - state.player.y);
  if (distance <= radius) return candidate;
  return null;
}

function packItemsText(pack) {
  if (!pack.items.length) return t('command.packEmpty');
  return pack.items.map((id) => pick(ITEM_DEFS[id]?.title) || id).join(', ');
}

function formatSeconds(seconds) {
  const value = Math.max(0, Number(seconds) || 0);
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

// ---------------------------------------------------------------------------
// Music

function roomMusicId() {
  const room = currentRoom(state);
  return room?.musicId && MUSIC_MAP[room.musicId] ? room.musicId : 'labyrinth';
}

function playRoomMusic() {
  if (!audio) return;
  if (runtime.trial?.active) {
    audio.playTrack('trial');
    return;
  }
  audio.playTrack(roomMusicId());
}

function toggleSound() {
  state.settings.sound = !state.settings.sound;
  audio.setEnabled(state.settings.sound);
  ui.setSound(state.settings.sound);
  if (state.settings.sound) {
    audio.unlock();
    playRoomMusic();
    log(t('sound.onMessage'), 'system');
  } else {
    log(t('sound.offMessage'), 'system');
  }
  saveNow();
}

function musicAction(action, value) {
  if (!audio) return;
  switch (action) {
    case 'play':
      audio.playTrack(audio.currentId || roomMusicId(), { force: true });
      break;
    case 'pause':
      audio.pause();
      break;
    case 'stop':
      audio.stop();
      break;
    case 'track':
      audio.playTrack(value, { force: true });
      break;
    case 'seek':
      audio.seek(value);
      break;
    case 'volume':
      applySettings({ musicVolume: value });
      break;
    default:
      break;
  }
  ui.setMusic(audio.snapshot());
}

// ---------------------------------------------------------------------------
// Room descriptions and actions

function describeRoom() {
  const room = currentRoom(state);
  if (!room) return;
  const copy = ROOM_COPY[room.kind] || ROOM_COPY.generic;
  let text = copy.look || ROOM_COPY.generic.look;
  if (room.kind === 'story' && state.flags.trialCleared) {
    text = copy.cleared || text;
  }
  if (room.kind === 'find' && room.take?.taken) {
    text = copy.taken || text;
  }
  log(text, 'world');

  if (copy.whisper) log(copy.whisper, 'echo');
  if (room.chalkMarked) log(t('command.chalkMark'), 'system');
  const packs = state.packs.filter((pack) => pack.roomId === room.id);
  if (packs.length > 0) {
    log(t('command.roomPacks', { count: packs.length }), 'system');
  }
  if (room.threat && !runtime.trial?.active) {
    log(t('room.dangerShadow'), 'system');
  }
}

function describePack() {
  if (!state.inventory.length) {
    log(t('command.packEmpty'), 'system');
  } else {
    log(t('command.packHas', {
      items: state.inventory.map((id) => pick(ITEM_DEFS[id]?.title) || id).join(', '),
    }), 'world');
  }
  if (!state.packs.length) {
    log(t('command.packsNone'), 'system');
    return;
  }
  log(t('command.packsTotal', { count: state.packs.length }), 'system');
  for (const pack of state.packs) {
    const room = state.rooms[pack.roomId];
    const here = pack.roomId === state.currentRoomId ? t('command.packHere') : '';
    log(t('command.packLine', {
      room: pick(room?.title) || t('room.fallback'),
      items: pack.items.map((id) => pick(ITEM_DEFS[id]?.title) || id).join(', ') || t('command.packEmpty'),
      here,
    }), 'system');
  }
}

function goToExit(side) {
  const room = currentRoom(state);
  if (!room.exits[side]) {
    log(t('command.wall'), 'world');
    return;
  }
  const door = doorSpanFor(room, side);
  const center = doorCenter(door);
  const target = side === 'north'
    ? { x: center, y: 0.018 }
    : side === 'south'
      ? { x: center, y: 0.982 }
      : side === 'west'
        ? { x: 0.018, y: center }
        : { x: 0.982, y: center };
  runtime.cursorTarget = target;
  runtime.commandTarget = { ...target, exit: side };
  runtime.autoExit = side;
  runtime.walk = null;
  runtime.cursorHeld = false;
  log(t('command.goExit', { direction: t(`dir.${side}`) }), 'action');
}

function startWalk(command, seconds) {
  const dir = command.walk;
  if (!dir) return;
  const duration = Math.max(0.1, Math.min(60, Number.isFinite(seconds) ? seconds : state.settings.walkSeconds));
  runtime.walk = {
    x: dir.x,
    y: dir.y,
    direction: dir.direction,
    remaining: duration,
  };
  runtime.commandTarget = null;
  runtime.cursorTarget = null;
  runtime.cursorHeld = false;
  runtime.autoExit = null;
  runtime.facing = dir.direction;
  state.player.facing = dir.direction;
  log(t('command.walkStarted', {
    direction: t(`dir.${dir.direction}`),
    seconds: formatSeconds(duration),
  }), 'action');
}

function approachNearest() {
  const target = nearestInteractable(state, { radius: 1 });
  if (!target) {
    log(t('command.noTarget'), 'world');
    return;
  }
  runtime.cursorTarget = { x: target.x, y: target.y };
  runtime.commandTarget = null;
  runtime.autoExit = null;
  runtime.walk = null;
  log(t('command.approach', { target: pick(target.title) }), 'action');
}

function performAction() {
  if (runtime.trial?.active) return;
  const interaction = getInteraction();
  if (!interaction) {
    log(t('command.noTarget'), 'system');
    return;
  }

  const room = currentRoom(state);
  if (interaction.kind === 'pack') {
    const result = pickupBackpack(state, interaction.id);
    if (result.ok) {
      audio.pickup();
      log(t('command.packPicked', { items: packItemsText(result.pack) }), 'good');
      ui.showToast(t('banner.backpack'), { tone: 'info' });
      afterStateChange();
    }
    return;
  }

  if (interaction.kind === 'item') {
    if (room.take && !room.take.taken) {
      room.take.taken = true;
      addInventoryItem(state, room.take.itemId);
      audio.pickup();
      const item = ITEM_DEFS[room.take.itemId];
      log(t('command.itemInPack', { item: pick(item?.title) || room.take.itemId }), 'good');
      log(t('command.itemOnCanvas'), 'system');
      afterStateChange();
    }
    return;
  }

  if (interaction.kind === 'trial') {
    openTrialIntro();
    return;
  }

  if (interaction.kind === 'tablet') {
    audio.tone(392, 0.4, 'sine', 0.02);
    log(ROOM_COPY.tablet.whisper, 'echo');
  }
}

function useItem(itemId) {
  if (!hasItem(state, itemId)) {
    log(t('command.noItem'), 'error');
    return;
  }
  const item = ITEM_DEFS[itemId];
  const room = currentRoom(state);

  if (itemId === 'chalk') {
    if (room.chalkMarked) {
      log(t('command.chalkAlready'), 'system');
      return;
    }
    room.chalkMarked = true;
    audio.tone(640, 0.14, 'triangle', 0.025);
    log(t('command.chalk', { room: pick(room.title) }), 'good');
    afterStateChange();
    return;
  }

  if (itemId === 'charm') {
    state.flags.charmUsed = true;
    log(t('command.charm'), 'echo');
    scheduleSave();
    return;
  }

  log(t('command.itemNoAction', { item: pick(item?.title) || itemId }), 'system');
}

function showCards() {
  if (!state.flags.seenCard) {
    log(t('command.unknown', { command: 'карта' }), 'error');
    return;
  }
  const cards = CARD_ORDER.filter((id) => hasItem(state, id));
  if (!cards.length) {
    log(t('command.noItem'), 'system');
    return;
  }
  for (const id of cards) {
    const card = ITEM_DEFS[id];
    log(`${pick(card.title)} · ${pick(card.description)}`, 'world');
  }
}

// ---------------------------------------------------------------------------
// Trial

function openTrialIntro() {
  if (state.flags.trialCleared) {
    log(ROOM_COPY.story.cleared, 'world');
    return;
  }
  if (runtime.trial?.active) return;
  ui.showModal({
    kicker: TRIAL.intro.kicker,
    title: TRIAL.title,
    paragraphs: TRIAL.intro.paragraphs,
    note: TRIAL.intro.note,
    buttons: [
      {
        label: t('trial.cancelButton'),
        variant: 'quiet',
        onClick: () => log(t('trial.cancel'), 'system'),
      },
      {
        label: t('trial.start'),
        variant: 'primary',
        onClick: startTrial,
      },
    ],
    dismissible: true,
    onDismiss: () => log(t('trial.cancel'), 'system'),
  });
}

function startTrial() {
  if (runtime.trial?.active || state.flags.trialCleared) return;
  const room = currentRoom(state);
  if (room.kind !== 'story') return;
  const seed = (state.seed ^ (state.stats.deaths * 2654435761) ^ 0x8f3a2b1c) >>> 0;
  runtime.trial = {
    active: true,
    elapsed: 0,
    duration: TRIAL.duration,
    beatSeconds: TRIAL.beatSeconds,
    bullets: [],
    nextBeat: TRIAL.beatSeconds * 2,
    beatIndex: 0,
    player: { x: 0.5, y: 0.77, facing: 'up' },
    dashCooldown: 0,
    dashTimer: 0,
    dashInvulnerable: 0,
    dashDirection: { x: 0, y: -1 },
    trail: [],
    hitPulse: 0,
    random: mulberry32(seed),
  };
  runtime.moving = false;
  runtime.walk = null;
  runtime.cursorTarget = null;
  runtime.promptLabel = null;
  ui.setPrompt(null);
  ui.setTrial(true, TRIAL.duration, TRIAL.duration);
  ui.setTerminalState(t('terminal.state.trial'));
  audio.playTrack('trial');
  log(TRIAL.intro.paragraphs[0], 'echo');
  log(t('trial.hint'), 'system');
}

function addBullet(trial, x, y, vx, vy, radius = TRIAL.bulletRadius, color = '232, 198, 139') {
  trial.bullets.push({ x, y, vx, vy, r: radius, color, age: 0 });
}

function spawnTrialPattern(trial) {
  const beat = trial.beatIndex;
  const elapsed = trial.elapsed;

  if (elapsed < 5.5) {
    const gap = 0.5 + Math.sin(elapsed * 1.15) * 0.29;
    for (let i = 0; i < 11; i += 1) {
      const x = 0.08 + i * 0.084;
      if (Math.abs(x - gap) < 0.115) continue;
      addBullet(trial, x, -0.05, (x - 0.5) * 0.045, 0.29, TRIAL.bulletRadius, '232, 198, 139');
    }
    if (beat % 3 === 0) {
      const gap2 = 0.5 - Math.sin(elapsed * 0.82) * 0.22;
      for (let i = 0; i < 7; i += 1) {
        const x = 0.14 + i * 0.12;
        if (Math.abs(x - gap2) < 0.09) continue;
        addBullet(trial, x, -0.12, 0, 0.22, TRIAL.bulletRadius * 0.9, '159, 216, 200');
      }
    }
    return;
  }

  if (elapsed < 11) {
    const fromLeft = beat % 2 === 0;
    const gap = 0.5 + Math.sin(elapsed * 1.35 + (fromLeft ? 0 : Math.PI)) * 0.29;
    for (let i = 0; i < 9; i += 1) {
      const y = 0.1 + i * 0.09;
      if (Math.abs(y - gap) < 0.105) continue;
      addBullet(
        trial,
        fromLeft ? -0.05 : 1.05,
        y,
        fromLeft ? 0.31 : -0.31,
        (y - 0.5) * 0.035,
        TRIAL.bulletRadius,
        fromLeft ? '219, 150, 128' : '232, 198, 139',
      );
    }
    if (beat % 4 === 0) {
      const gapAngle = Math.sin(elapsed * 0.9) * 0.8;
      const count = 18;
      for (let i = 0; i < count; i += 1) {
        const angle = (i / count) * Math.PI * 2;
        if (Math.abs(Math.atan2(Math.sin(angle - gapAngle), Math.cos(angle - gapAngle))) < 0.2) continue;
        addBullet(
          trial,
          0.5 + Math.cos(angle) * 0.72,
          0.5 + Math.sin(angle) * 0.72,
          -Math.cos(angle) * 0.185,
          -Math.sin(angle) * 0.185,
          TRIAL.bulletRadius * 0.9,
          '159, 216, 200',
        );
      }
    }
    return;
  }

  if (beat % 2 === 0) {
    const gapAngle = elapsed * 0.85;
    const count = 20;
    for (let i = 0; i < count; i += 1) {
      const angle = (i / count) * Math.PI * 2;
      const relative = Math.atan2(Math.sin(angle - gapAngle), Math.cos(angle - gapAngle));
      if (Math.abs(relative) < 0.28) continue;
      addBullet(
        trial,
        0.5 + Math.cos(angle) * 0.76,
        0.5 + Math.sin(angle) * 0.76,
        -Math.cos(angle) * 0.19,
        -Math.sin(angle) * 0.19,
        TRIAL.bulletRadius * 0.92,
        i % 2 ? '232, 198, 139' : '219, 150, 128',
      );
    }
  }
  if (beat % 2 === 1) {
    const dx = trial.player.x - 0.5;
    const dy = trial.player.y - 0.5;
    const len = Math.hypot(dx, dy) || 1;
    for (let i = -1; i <= 1; i += 1) {
      const angle = Math.atan2(dy, dx) + i * 0.13;
      addBullet(
        trial,
        0.5 + Math.cos(angle) * 0.04,
        0.5 + Math.sin(angle) * 0.04,
        Math.cos(angle) * 0.25,
        Math.sin(angle) * 0.25,
        TRIAL.bulletRadius * 0.75,
        '219, 150, 128',
      );
    }
    void len;
  }
}

function updateTrial(dt) {
  const trial = runtime.trial;
  if (!trial?.active) return;
  trial.elapsed += dt;
  trial.dashCooldown = Math.max(0, trial.dashCooldown - dt);
  trial.dashInvulnerable = Math.max(0, trial.dashInvulnerable - dt);
  trial.hitPulse = Math.max(0, trial.hitPulse - dt * 2.2);
  trial.trail = trial.trail
    .map((ghost) => ({ ...ghost, alpha: ghost.alpha - dt * 2.4 }))
    .filter((ghost) => ghost.alpha > 0.03);

  const input = getInputVector();
  if (input.x !== 0 || input.y !== 0) {
    trial.player.facing = facingFromVector(input.x, input.y);
    runtime.facing = trial.player.facing;
    runtime.moving = true;
  } else {
    runtime.moving = trial.dashTimer > 0;
  }

  if (trial.dashTimer > 0) {
    trial.dashTimer = Math.max(0, trial.dashTimer - dt);
    const dir = trial.dashDirection;
    movePlayerByPixels(trial.player, dir.x * DASH_SPEED * dt, dir.y * DASH_SPEED * dt, false);
    trial.player.x = Math.max(0.075, Math.min(0.925, trial.player.x));
    trial.player.y = Math.max(0.1, Math.min(0.9, trial.player.y));
    if (Math.random() < 0.8) {
      trial.trail.push({ x: trial.player.x, y: trial.player.y, facing: trial.player.facing, alpha: 0.42 });
    }
  } else {
    movePlayerByPixels(trial.player, input.x * TRIAL_SPEED * dt, input.y * TRIAL_SPEED * dt, false);
    trial.player.x = Math.max(0.075, Math.min(0.925, trial.player.x));
    trial.player.y = Math.max(0.1, Math.min(0.9, trial.player.y));
  }

  while (trial.elapsed >= trial.nextBeat) {
    spawnTrialPattern(trial);
    audio.beat(trial.beatIndex % 4 === 0);
    trial.beatIndex += 1;
    trial.nextBeat += trial.beatSeconds;
    if (trial.bullets.length > TRIAL_MAX_BULLETS) {
      trial.bullets.splice(0, trial.bullets.length - TRIAL_MAX_BULLETS);
    }
  }

  for (const bullet of trial.bullets) {
    bullet.x += bullet.vx * dt;
    bullet.y += bullet.vy * dt;
    bullet.age += dt;
  }
  trial.bullets = trial.bullets.filter(
    (bullet) => bullet.x > -0.18 && bullet.x < 1.18 && bullet.y > -0.18 && bullet.y < 1.18,
  );

  const rr = roomMetrics();
  const px = trial.player.x * rr.w;
  const py = trial.player.y * rr.h;
  const hitRadius = Math.min(rr.w, rr.h) * (TRIAL.playerRadius + TRIAL.bulletRadius);
  if (trial.dashInvulnerable <= 0) {
    for (const bullet of trial.bullets) {
      const bx = bullet.x * rr.w;
      const by = bullet.y * rr.h;
      if (Math.hypot(px - bx, py - by) < hitRadius + Math.min(rr.w, rr.h) * bullet.r * 0.35) {
        trial.hitPulse = 1;
        die('trial', { x: trial.player.x, y: trial.player.y, roomId: currentRoom(state).id });
        return;
      }
    }
  }

  runtime.trialUiClock += dt;
  if (runtime.trialUiClock > 0.06) {
    runtime.trialUiClock = 0;
    ui.setTrial(true, Math.max(0, trial.duration - trial.elapsed), trial.duration);
  }

  if (trial.elapsed >= trial.duration) {
    winTrial();
  }
}

function winTrial() {
  const trial = runtime.trial;
  if (!trial?.active) return;
  const room = currentRoom(state);
  trial.active = false;
  runtime.trial = null;
  runtime.moving = false;
  runtime.promptLabel = null;
  ui.setTrial(false);
  ui.setPrompt(null);
  ui.setTerminalState(t('terminal.state.open'));

  state.flags.trialCleared = true;
  state.flags.seenCard = true;
  room.trial = false;
  room.musicId = 'labyrinth';
  addInventoryItem(state, 'charm');
  state.player = { x: 0.5, y: 0.63, facing: 'up' };
  runtime.facing = 'up';
  saveNow();
  ui.setRoom(state, room);
  ui.setCanvasData(state, buildPalette());
  ui.showBanner(t('banner.trialDone'), t('trial.title'));
  audio.chime();
  audio.playTrack('labyrinth');
  log(TRIAL.win.paragraphs[0], 'good');
  log(t('trial.charmInPack'), 'system');

  ui.showModal({
    kicker: TRIAL.win.kicker,
    title: t('trial.title'),
    art: ITEM_DEFS.charm.art,
    artAlt: ITEM_DEFS.charm.artAlt,
    paragraphs: TRIAL.win.paragraphs,
    note: TRIAL.win.note,
    buttons: [
      {
        label: TRIAL.win.button,
        variant: 'primary',
        onClick: () => {
          log(t('trial.charmNote'), 'system');
          ui.focusTerminal();
        },
      },
    ],
    dismissible: false,
  });
}

// ---------------------------------------------------------------------------
// Death and travel

function die(cause, position = null) {
  if (runtime.dying) return;
  runtime.dying = true;
  const room = currentRoom(state);
  const drop = {
    roomId: position?.roomId || room.id,
    x: Number.isFinite(position?.x) ? position.x : state.player.x,
    y: Number.isFinite(position?.y) ? position.y : state.player.y,
    cause,
  };

  const dropRoom = state.rooms[drop.roomId] || room;
  dropBackpack(state, drop);
  runtime.trial = null;
  runtime.walk = null;
  runtime.commandTarget = null;
  runtime.cursorTarget = null;
  runtime.autoExit = null;
  runtime.moving = false;
  runtime.keys.clear();
  runtime.virtual.clear();
  runtime.dashTimer = 0;
  runtime.dashInvulnerable = 0;
  runtime.dashTrail = [];
  runtime.promptLabel = null;
  ui.setTrial(false);
  ui.setPrompt(null);
  ui.flashDeath();
  audio.death();

  const message = cause === 'trial'
    ? t('death.trial')
    : t('death.danger', { room: pick(dropRoom.title) || t('room.fallback') });
  ui.showToast(message, { ms: 3600 });
  log(message, 'error');
  log(t('death.return'), 'system');

  state.currentRoomId = state.map.startId;
  const startRoom = state.rooms[state.map.startId];
  state.player = { x: 0.5, y: 0.69, facing: 'up' };
  runtime.facing = 'up';
  markRoomVisited(state, startRoom.id);
  saveNow();
  ui.setRoom(state, startRoom, { banner: true });
  ui.setTerminalState(t('terminal.state.open'));
  audio.playTrack(startRoom.musicId || 'tablet');
  if (ui.isCanvasOpen()) ui.setCanvasData(state, buildPalette());

  window.setTimeout(() => {
    runtime.dying = false;
  }, 650);
}

function changeRoom(direction, options = {}) {
  const room = currentRoom(state);
  const nextId = room?.exits?.[direction];
  if (!nextId || !state.rooms[nextId]) return;
  const next = state.rooms[nextId];
  state.currentRoomId = next.id;
  state.player = spawnPointForEntry(direction, next);
  runtime.facing = state.player.facing;
  runtime.flash = 0.5;
  runtime.promptLabel = null;
  if (!options.continueWalk) {
    runtime.walk = null;
    runtime.commandTarget = null;
    runtime.cursorTarget = null;
    runtime.autoExit = null;
    runtime.moving = false;
  } else if (runtime.walk) {
    runtime.facing = runtime.walk.direction;
    state.player.facing = runtime.walk.direction;
  }

  const firstVisit = markRoomVisited(state, next.id);
  ui.setRoom(state, next, { banner: true });
  ui.setPrompt(null);
  audio.playTrack(next.musicId || 'labyrinth');
  saveNow();

  if (firstVisit && next.kind === 'danger') {
    log(t('room.dangerFirst'), 'system');
  }
  if (firstVisit && next.kind === 'story' && !state.flags.trialCleared) {
    log(t('room.storyFirst'), 'system');
  }
  if (next.kind === 'find' && next.take && !next.take.taken) {
    log(t('room.findFirst'), 'system');
  }
}

// ---------------------------------------------------------------------------
// Room update

function clampPlayer() {
  state.player.x = Math.max(WALK_CLAMP, Math.min(1 - WALK_CLAMP, state.player.x));
  state.player.y = Math.max(WALK_CLAMP, Math.min(1 - WALK_CLAMP, state.player.y));
}

function updateRoom(dt) {
  const room = currentRoom(state);
  if (!room) return;

  runtime.dashCooldown = Math.max(0, runtime.dashCooldown - dt);
  runtime.dashInvulnerable = Math.max(0, runtime.dashInvulnerable - dt);
  runtime.dashTrail = runtime.dashTrail
    .map((ghost) => ({ ...ghost, alpha: ghost.alpha - dt * 2.6 }))
    .filter((ghost) => ghost.alpha > 0.03);

  const input = getInputVector();
  let blockedWalk = false;
  if (input.x !== 0 || input.y !== 0) {
    runtime.walk = null;
    runtime.commandTarget = null;
    runtime.cursorTarget = null;
    runtime.autoExit = null;
    runtime.facing = facingFromVector(input.x, input.y);
    state.player.facing = runtime.facing;
    runtime.moving = true;
    runtime.lastMove = { x: input.x, y: input.y };
  }

  if (runtime.dashTimer > 0) {
    runtime.dashTimer = Math.max(0, runtime.dashTimer - dt);
    movePlayerByPixels(
      state.player,
      runtime.dashDirection.x * DASH_SPEED * dt,
      runtime.dashDirection.y * DASH_SPEED * dt,
    );
    runtime.moving = true;
    if (Math.random() < 0.72) {
      runtime.dashTrail.push({
        x: state.player.x,
        y: state.player.y,
        facing: runtime.facing,
        alpha: 0.38,
      });
    }
  } else if (input.x !== 0 || input.y !== 0) {
    movePlayerByPixels(state.player, input.x * PLAYER_SPEED * dt, input.y * PLAYER_SPEED * dt);
  } else if (runtime.walk) {
    const beforeX = state.player.x;
    const beforeY = state.player.y;
    runtime.walk.remaining -= dt;
    state.player.x += runtime.walk.x * WALK_SPEED * dt;
    state.player.y += runtime.walk.y * WALK_SPEED * dt;
    clampPlayer();
    runtime.facing = runtime.walk.direction;
    state.player.facing = runtime.facing;
    runtime.moving = true;
    const expectedX = Math.abs(runtime.walk.x * WALK_SPEED * dt);
    const expectedY = Math.abs(runtime.walk.y * WALK_SPEED * dt);
    const movedX = Math.abs(state.player.x - beforeX);
    const movedY = Math.abs(state.player.y - beforeY);
    blockedWalk = (expectedX > 0.0001 && movedX < expectedX * 0.2)
      || (expectedY > 0.0001 && movedY < expectedY * 0.2);
    if (runtime.walk.remaining <= 0) runtime.walk = null;
  } else if (runtime.commandTarget) {
    const rr = roomMetrics();
    const dx = (runtime.commandTarget.x - state.player.x) * rr.w;
    const dy = (runtime.commandTarget.y - state.player.y) * rr.h;
    const distance = Math.hypot(dx, dy);
    if (distance < 2.4) {
      state.player.x = runtime.commandTarget.x;
      state.player.y = runtime.commandTarget.y;
      const side = runtime.commandTarget.exit || runtime.autoExit;
      runtime.commandTarget = null;
      runtime.autoExit = null;
      runtime.moving = false;
      if (side && room.exits[side]) {
        changeRoom(side);
        return;
      }
    } else {
      const step = Math.min(distance, PLAYER_SPEED * dt);
      runtime.moving = true;
      runtime.facing = facingFromVector(dx / distance, dy / distance);
      movePlayerByPixels(state.player, (dx / distance) * step, (dy / distance) * step);
    }
  } else if (runtime.cursorTarget && state.settings.cursorControl) {
    const rr = roomMetrics();
    const dx = (runtime.cursorTarget.x - state.player.x) * rr.w;
    const dy = (runtime.cursorTarget.y - state.player.y) * rr.h;
    const distance = Math.hypot(dx, dy);
    if (distance < 2) {
      state.player.x = runtime.cursorTarget.x;
      state.player.y = runtime.cursorTarget.y;
      runtime.cursorTarget = null;
      runtime.moving = false;
    } else {
      const step = Math.min(distance, CURSOR_SPEED * dt);
      runtime.moving = true;
      runtime.facing = facingFromVector(dx / distance, dy / distance);
      state.player.facing = runtime.facing;
      runtime.lastMove = { x: dx / distance, y: dy / distance };
      movePlayerByPixels(state.player, (dx / distance) * step, (dy / distance) * step);
    }
  } else {
    runtime.moving = false;
  }

  runtime.walkClock += dt * (runtime.moving ? 1 : 0.28);
  runtime.stepAccumulator += runtime.moving ? dt : 0;
  if (runtime.stepAccumulator >= 1.2) {
    runtime.stepAccumulator = 0;
    state.stats.steps += 1;
  }

  const exit = exitAt(state, 0.03);
  if (exit) {
    changeRoom(exit.side, { continueWalk: Boolean(runtime.walk) });
    return;
  }

  if (blockedWalk) {
    runtime.walk = null;
    runtime.moving = false;
    log(t('command.walkBlocked'), 'world');
  }

  if (room.threat && runtime.dashInvulnerable <= 0 && !runtime.dying) {
    const shadow = dangerPosition(room, runtime.clock);
    if (shadow) {
      const rr = roomMetrics();
      const distance = Math.hypot(
        (state.player.x - shadow.x) * rr.w,
        (state.player.y - shadow.y) * rr.h,
      );
      const reach = Math.min(rr.w, rr.h) * shadow.radius * 0.92;
      runtime.shake = Math.max(runtime.shake, Math.max(0, 1 - distance / (reach * 3.2)) * 3.4);
      if (distance < reach) {
        die('danger', { x: state.player.x, y: state.player.y, roomId: room.id });
        return;
      }
    }
  }

  const label = interactionLabel(getInteraction());
  if (label !== runtime.promptLabel) {
    runtime.promptLabel = label;
    ui.setPrompt(label);
  }
}

// ---------------------------------------------------------------------------
// Dash and input

function requestDash() {
  if (runtime.trial?.active) {
    const trial = runtime.trial;
    if (trial.dashCooldown > 0) return;
    const fallback = directionFromFacing(trial.player.facing);
    const move = runtime.lastMove || fallback;
    const len = Math.hypot(move.x, move.y) || 1;
    trial.dashDirection = { x: move.x / len, y: move.y / len };
    trial.dashTimer = 0.115;
    trial.dashCooldown = TRIAL_DASH_COOLDOWN;
    trial.dashInvulnerable = 0.32;
    audio.tone(220, 0.08, 'sawtooth', 0.025);
    return;
  }

  if (runtime.dashCooldown > 0) return;
  const fallback = directionFromFacing(runtime.facing);
  const move = runtime.lastMove || fallback;
  const len = Math.hypot(move.x, move.y) || 1;
  runtime.dashDirection = { x: move.x / len, y: move.y / len };
  runtime.dashTimer = 0.12;
  runtime.dashCooldown = DASH_COOLDOWN;
  runtime.dashInvulnerable = 0.3;
  audio.tone(180, 0.07, 'triangle', 0.018);
}

function onKeyDown(event) {
  if (ui.isTypingTarget(event.target)) return;
  if (ui.isPaused()) return;

  const movementMap = {
    KeyW: 'up', ArrowUp: 'up',
    KeyS: 'down', ArrowDown: 'down',
    KeyA: 'left', ArrowLeft: 'left',
    KeyD: 'right', ArrowRight: 'right',
  };

  if (movementMap[event.code]) {
    event.preventDefault();
    runtime.keys.add(movementMap[event.code]);
    runtime.walk = null;
    runtime.cursorTarget = null;
    runtime.commandTarget = null;
    runtime.autoExit = null;
    return;
  }
  if (event.code === 'KeyE') {
    if (event.repeat) return;
    event.preventDefault();
    performAction();
    return;
  }
  if (event.code === 'KeyO') {
    if (event.repeat) return;
    event.preventDefault();
    openSettings();
    return;
  }
  if (event.code === 'ShiftLeft' || event.code === 'ShiftRight' || event.code === 'Space') {
    if (event.repeat) return;
    event.preventDefault();
    requestDash();
  }
}

function onKeyUp(event) {
  const movementMap = {
    KeyW: 'up', ArrowUp: 'up',
    KeyS: 'down', ArrowDown: 'down',
    KeyA: 'left', ArrowLeft: 'left',
    KeyD: 'right', ArrowRight: 'right',
  };
  if (movementMap[event.code]) {
    runtime.keys.delete(movementMap[event.code]);
  }
}

// ---------------------------------------------------------------------------
// Cursor control

function stagePoint(clientX, clientY) {
  const stage = ui.stageElement;
  const rect = stage.getBoundingClientRect();
  return renderer.toRoom(clientX - rect.left, clientY - rect.top);
}

function onCursorDown(clientX, clientY) {
  if (!state.settings.cursorControl || ui.isPaused()) return;
  runtime.cursorTarget = stagePoint(clientX, clientY);
  runtime.cursorHeld = true;
  runtime.commandTarget = null;
  runtime.autoExit = null;
  runtime.walk = null;
}

function onCursorMove(clientX, clientY) {
  if (!runtime.cursorHeld || !state.settings.cursorControl) return;
  runtime.cursorTarget = stagePoint(clientX, clientY);
}

function onCursorUp() {
  runtime.cursorHeld = false;
}

// ---------------------------------------------------------------------------
// Commands

function showHelp() {
  log(t('help.header'), 'system');
  log(t('help.movement'), 'system');
  for (const command of COMMANDS) {
    if (!commandUnlocked(state, command)) continue;
    log(pick(command.help), 'system');
  }
  for (const command of WALK_COMMAND_LIST) {
    log(pick(command.help), 'system');
  }
  log(t('help.exits'), 'system');
  log(t('help.history'), 'system');
  log(t('help.language'), 'system');
  log(t('help.lockedHint'), 'echo');
}

function showHistory() {
  const used = ui.getHistory();
  if (!used.length) {
    log(t('history.empty'), 'system');
    return;
  }
  log(t('history.header', { count: used.length }), 'system');
  used.forEach((entry, index) => {
    log(`${index + 1}. ${entry}`, 'terminal');
  });
  log(t('history.usage'), 'echo');
}

function parseWalkCommand(text) {
  const normalized = String(text || '').trim().toLowerCase().replace(/\s+/g, ' ');
  if (!normalized) return null;
  const defaultSeconds = state.settings.walkSeconds ?? 1;
  for (const command of WALK_COMMAND_LIST) {
    for (const alias of command.aliases) {
      if (normalized === alias) {
        return { command, seconds: defaultSeconds };
      }
      if (normalized.startsWith(`${alias} `)) {
        const rest = normalized.slice(alias.length + 1).trim().replace(/[сs]+$/i, '');
        const value = Number(rest.replace(',', '.'));
        if (Number.isFinite(value)) return { command, seconds: value };
      }
    }
  }
  return null;
}

function switchLanguage(next) {
  const language = next || (state.settings.language === 'en' ? 'ru' : 'en');
  setLanguage(language);
  state.settings.language = language;
  translateDocument(document);
  ui.refreshAll(state, currentRoom(state), buildPalette(), state.settings);
  ui.setSound(state.settings.sound);
  saveNow();
  log(t('language.current'), 'system');
}

function applySettings(partial) {
  const merged = { ...state.settings, ...partial };
  if (partial.logSources) {
    merged.logSources = { ...state.settings.logSources, ...partial.logSources };
  }
  state.settings = normalizeSettings(merged);
  if (state.settings.language !== (document.documentElement.lang === 'en' ? 'en' : 'ru')) {
    setLanguage(state.settings.language);
    translateDocument(document);
  }
  if (audio) {
    audio.setVolume(state.settings.musicVolume);
  }
  ui.setSettings(state.settings);
  ui.setMusic(audio?.snapshot());
  scheduleSave();
}

function openSettings() {
  ui.setSettings(state.settings);
  ui.setMusic(audio?.snapshot());
  ui.setAspect(aspectState);
  ui.openSettings();
}

function storyModel() {
  const unlocked = (requires) => {
    if (!requires) return true;
    return commandUnlocked(state, { unlock: requires });
  };
  const room = currentRoom(state);
  const currentId = runtime.trial?.active
    ? 'trial'
    : room?.kind === 'tablet'
      ? 'tablet'
      : room?.kind === 'story'
        ? 'story'
        : room?.kind === 'danger'
          ? 'danger'
          : room?.kind === 'find'
            ? 'find'
            : 'walk';
  return {
    nodes: STORY_PLOT.nodes.map((node) => ({
      ...node,
      locked: !unlocked(node.requires),
      current: node.id === currentId,
    })),
    edges: STORY_PLOT.edges,
  };
}

function openStory() {
  ui.openStory(storyModel());
}

function dispatchCommand(raw, source = 'terminal') {
  const command = String(raw || '').trim().replace(/[.!?]+$/g, '').replace(/\s+/g, ' ').toLowerCase();
  if (!command) return;
  log(source === 'canvas' ? `${t('canvas.labelCommand')} › ${command}` : `› ${command}`, 'command');

  if (runtime.trial?.active) {
    log(t('command.trialBusy'), 'system');
    return;
  }

  if (command === 'привет' || command === 'hello' || command === 'hi') {
    log(t('command.hello'), 'world');
    return;
  }
  if (command === 'ты куда пропал' || command === 'where did you go') {
    log(t('command.where'), 'world');
    return;
  }

  const walk = parseWalkCommand(command);
  if (walk) {
    startWalk(walk.command, walk.seconds);
    return;
  }

  const exit = DIRS.find((dir) => (
    command === dir.label
    || command === dir.id
    || command === t(`dir.${dir.id}`)
  ));
  if (exit) {
    goToExit(exit.id);
    return;
  }

  const definition = commandForAlias(command);
  if (!definition) {
    log(t('command.unknown', { command }), 'error');
    return;
  }
  if (!commandUnlocked(state, definition)) {
    log(t('command.unknown', { command }), 'error');
    return;
  }

  switch (definition.id) {
    case 'look': describeRoom(); break;
    case 'pack': describePack(); break;
    case 'canvas': openCanvas(); break;
    case 'story': openStory(); break;
    case 'history': showHistory(); break;
    case 'help': showHelp(); break;
    case 'take': performAction(); break;
    case 'approach': approachNearest(); break;
    case 'stop':
      runtime.walk = null;
      runtime.commandTarget = null;
      runtime.cursorTarget = null;
      runtime.cursorHeld = false;
      runtime.autoExit = null;
      runtime.moving = false;
      runtime.keys.clear();
      runtime.virtual.clear();
      log(t('command.stopped'), 'system');
      break;
    case 'dash': requestDash(); break;
    case 'clear': ui.clearTerminal(); break;
    case 'sound': toggleSound(); break;
    case 'language': switchLanguage(); break;
    case 'settings': openSettings(); break;
    case 'reset': confirmReset(); break;
    case 'charm': useItem('charm'); break;
    case 'chalk': useItem('chalk'); break;
    case 'card': showCards(); break;
    default:
      log(t('command.unknown', { command }), 'error');
      break;
  }
}

function confirmReset() {
  ui.showModal({
    kicker: t('reset.kicker'),
    title: t('reset.title'),
    paragraphs: [t('reset.paragraphs.0'), t('reset.paragraphs.1')],
    note: t('reset.note'),
    buttons: [
      { label: t('reset.stay'), variant: 'quiet' },
      { label: t('reset.confirm'), variant: 'primary', onClick: resetGame },
    ],
    dismissible: true,
  });
}

// ---------------------------------------------------------------------------
// Canvas actions

function nextCanvasPosition() {
  const center = ui.canvasCenter?.() || { x: 120, y: 100 };
  const index = state.canvas.elements.length;
  return {
    x: center.x - 70 + (index % 3) * 158,
    y: center.y - 46 + (Math.floor(index / 3) % 3) * 124,
  };
}

function openCanvas() {
  if (runtime.trial?.active) {
    log(t('canvas.story') + ': ' + t('terminal.state.trial'), 'system');
    return;
  }
  ui.setCanvasData(state, buildPalette());
  ui.clearCanvasLog();
  ui.openCanvas();
  log(t('canvas.opened.0'), 'system');
  log(t('canvas.opened.1'), 'system');
  scheduleSave();
}

function closeCanvas() {
  ui.closeCanvas();
  scheduleSave();
}

function canvasAdd(descriptor, x, y) {
  const spot = Number.isFinite(x) && Number.isFinite(y) ? { x, y } : nextCanvasPosition();
  const element = makeCanvasElement(state, descriptor, spot);
  scheduleSave();
  ui.setCanvasData(state, buildPalette());
  ui.addCanvasLog(t('canvas.added', { title: pick(element.title) }), 'action');
}

function canvasAddKey(code) {
  const action = KEY_ACTIONS[code];
  if (!action) return;
  const command = COMMAND_BY_ID[action.commandId];
  const base = nextCanvasPosition();
  const keyElement = makeCanvasElement(state, {
    sourceType: 'key',
    sourceId: `key:${code}`,
    title: { ru: `Клавиша ${action.key}`, en: `Key ${action.key}` },
    actionLabel: { ru: 'Нажать', en: 'Press' },
    icon: action.key,
    command: command?.command || null,
    keyCode: code,
    keyLabel: action.key,
  }, base);
  if (command) {
    const commandElement = makeCanvasElement(state, command, {
      x: base.x + 162,
      y: base.y,
    });
    addCanvasLink(state, keyElement.id, commandElement.id);
  }
  scheduleSave();
  ui.setCanvasData(state, buildPalette());
  ui.addCanvasLog(t('canvas.keyboardLinked', {
    key: action.key,
    command: pick(command?.title) || action.key,
  }), 'action');
}

function canvasLinkCreate(fromId, toId) {
  const link = addCanvasLink(state, fromId, toId);
  if (!link) return;
  const from = state.canvas.elements.find((entry) => entry.id === fromId);
  const to = state.canvas.elements.find((entry) => entry.id === toId);
  scheduleSave();
  ui.setCanvasData(state, buildPalette());
  ui.addCanvasLog(t('canvas.linkCreated', {
    from: pick(from?.title) || fromId,
    to: pick(to?.title) || toId,
  }), 'action');
}

function canvasExecute(element) {
  if (!elementAvailable(state, element)) {
    log(t('command.noItem'), 'error');
    if (ui.isCanvasOpen()) ui.addCanvasLog(t('command.noItem'), 'error');
    return;
  }
  if (element.command === 'холст') {
    log(t('command.canvasOpen'), 'system');
    return;
  }
  if (element.command) dispatchCommand(element.command, 'canvas');
}

function canvasMove(id, x, y) {
  const element = state.canvas.elements.find((entry) => entry.id === id);
  if (!element) return;
  element.x = Number(x) || 0;
  element.y = Number(y) || 0;
  scheduleSave();
}

function canvasRemove(id) {
  const removed = removeCanvasElement(state, id);
  if (!removed) return;
  scheduleSave();
  ui.setCanvasData(state, buildPalette());
  ui.addCanvasLog(t('canvas.removed', { title: pick(removed.title) }), 'system');
}

function canvasClear() {
  if (!state.canvas.elements.length) {
    ui.addCanvasLog(t('canvas.clearedEmpty'), 'system');
    return;
  }
  ui.showModal({
    kicker: t('canvas.kicker'),
    title: t('canvas.clearTitle'),
    paragraphs: [t('canvas.clearBody')],
    buttons: [
      { label: t('canvas.keep'), variant: 'quiet' },
      {
        label: t('canvas.clearConfirm'),
        variant: 'primary',
        onClick: () => {
          state.canvas.elements = [];
          state.canvas.links = [];
          state.canvas.linkSeq = 0;
          scheduleSave();
          ui.setCanvasData(state, buildPalette());
          ui.addCanvasLog(t('canvas.cleared'), 'system');
        },
      },
    ],
    dismissible: true,
  });
}

function canvasQuick(value) {
  dispatchCommand(value, 'canvas');
}

function canvasViewChange(view) {
  state.canvas.view = { ...view };
  scheduleSave();
}

// ---------------------------------------------------------------------------
// Save / load / export / import

function saveAction(action, file = null) {
  switch (action) {
    case 'save':
      saveNow();
      ui.setSettingsStatus(t('settings.save.saved'));
      ui.showToast(t('settings.save.saved'), { tone: 'info' });
      break;
    case 'load': {
      let loaded = null;
      try {
        const raw = window.localStorage.getItem(SAVE_KEY);
        if (raw) loaded = normalizeState(JSON.parse(raw));
      } catch {
        loaded = null;
      }
      if (!loaded) {
        ui.setSettingsStatus(t('settings.save.noSave'));
        ui.showToast(t('settings.save.noSave'), { ms: 3000 });
        return;
      }
      adoptState(loaded, { banner: true });
      ui.setSettingsStatus(t('settings.save.loaded'));
      log(t('settings.save.loaded'), 'system');
      break;
    }
    case 'export':
      exportWorld();
      ui.setSettingsStatus(t('settings.save.exported'));
      break;
    case 'import':
      importWorld(file);
      break;
    case 'reset':
      ui.showModal({
        kicker: t('reset.kicker'),
        title: t('settings.save.resetTitle'),
        paragraphs: [t('settings.save.resetBody')],
        note: t('reset.note'),
        buttons: [
          { label: t('settings.save.cancel'), variant: 'quiet' },
          { label: t('settings.save.confirmReset'), variant: 'primary', onClick: resetGame },
        ],
        dismissible: true,
      });
      break;
    default:
      break;
  }
}

function exportWorld() {
  try {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `to-east-world-${state.seed}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1200);
    ui.showToast(t('settings.save.exported'), { tone: 'info' });
  } catch {
    ui.setSettingsStatus(t('settings.save.importError'));
  }
}

async function importWorld(file) {
  if (!file) return;
  try {
    const text = await file.text();
    const loaded = normalizeState(JSON.parse(text));
    if (!loaded) {
      ui.setSettingsStatus(t('settings.save.importError'));
      return;
    }
    adoptState(loaded, { banner: true });
    ui.setSettingsStatus(t('settings.save.imported'));
    log(t('settings.save.imported'), 'system');
  } catch {
    ui.setSettingsStatus(t('settings.save.importError'));
    ui.showToast(t('settings.save.importError'), { ms: 3200 });
  }
}

// ---------------------------------------------------------------------------
// Suggestions

function suggest(value) {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) return [];
  const entries = [];
  const push = (command) => {
    if (!command) return;
    if (!commandUnlocked(state, command)) return;
    if (entries.some((entry) => entry.value === command.command)) return;
    const haystack = [command.command, ...(command.aliases || [])].map((item) => item.toLowerCase());
    if (!haystack.some((item) => item.startsWith(normalized) || item.includes(` ${normalized}`))) return;
    entries.push({
      value: command.command,
      label: pick(command.title),
      hint: pick(command.description),
    });
  };
  for (const command of COMMANDS) push(command);
  for (const command of WALK_COMMAND_LIST) push(command);
  if ('история'.startsWith(normalized)) {
    entries.push({ value: 'история', label: t('history.header', { count: '' }).replace(':', ''), hint: t('history.usage') });
  }
  if ('настройки'.startsWith(normalized)) {
    entries.push({ value: 'настройки', label: t('settings.title'), hint: t('settings.general.copy') });
  }
  if ('язык'.startsWith(normalized)) {
    entries.push({ value: 'язык', label: languageName(), hint: t('settings.language.copy') });
  }
  return entries.slice(0, 6);
}

// ---------------------------------------------------------------------------
// Aspect

function aspectLabel(width, height) {
  if (Math.abs(width / height - 9 / 16) <= 0.08) return '9:16';
  return `${Math.round(width)}:${Math.round(height)}`;
}

function updateAspect(announce = false) {
  const width = Math.max(1, window.innerWidth);
  const height = Math.max(1, window.innerHeight);
  const ratio = width / height;
  const ok = Math.abs(ratio - 9 / 16) <= 0.08;
  const label = aspectLabel(width, height);
  aspectState = { ratio: ratio.toFixed(2), ok, label };
  ui.setAspect(aspectState);
  if (announce && ok !== lastAspectOk) {
    if (!ok) {
      log(t('aspect.warning', { ratio: label }), 'system');
    } else if (lastAspectOk === false) {
      log(t('aspect.ok', { ratio: label }), 'system');
    }
    lastAspectOk = ok;
  } else if (lastAspectOk == null) {
    lastAspectOk = ok;
  }
}

// ---------------------------------------------------------------------------
// Boot and loop

function showPrologue() {
  runtime.introShown = true;
  ui.showModal({
    kicker: PROLOGUE.kicker,
    title: PROLOGUE.title,
    paragraphs: PROLOGUE.paragraphs,
    note: PROLOGUE.hint,
    buttons: [
      {
        label: PROLOGUE.button,
        variant: 'primary',
        onClick: () => {
          state.flags.introSeen = true;
          saveNow();
          for (const line of TUTORIAL_LINES) log(t(line), 'system');
          ui.focusTerminal();
          audio.unlock();
          playRoomMusic();
        },
      },
    ],
    dismissible: false,
  });
}

function buildUI() {
  audio = new AudioManager(MUSIC_MAP);
  audio.setEnabled(state.settings.sound);
  audio.setVolume(state.settings.musicVolume);
  audio.subscribe((snapshot) => {
    if (ui?.isSettingsOpen()) ui.setMusic(snapshot);
  });

  ui = createUI({
    itemDefs: ITEM_DEFS,
    keyboardRows: KEYBOARD_ROWS,
    keyActions: KEY_ACTIONS,
    musicTracks: Object.values(MUSIC_MAP),
    callbacks: {
      command: dispatchCommand,
      action: performAction,
      dash: requestDash,
      soundToggle: toggleSound,
      settingsChange: applySettings,
      settingsOpen: openSettings,
      settingsClose: () => ui.closeSettings(),
      settingsOpenCanvas: () => {
        ui.closeSettings();
        openCanvas();
      },
      settingsOpenStory: () => {
        ui.closeSettings();
        openStory();
      },
      storyOpen: openStory,
      storyClose: () => ui.closeStory(),
      languageChange: switchLanguage,
      suggest,
      virtualMove: (direction, pressed) => {
        if (pressed) runtime.virtual.add(direction);
        else runtime.virtual.delete(direction);
      },
      canvasOpen: openCanvas,
      canvasClose: closeCanvas,
      canvasAdd,
      canvasAddKey,
      canvasExecute,
      canvasMove,
      canvasRemove,
      canvasClear,
      canvasQuick,
      canvasLinkCreate,
      canvasViewChange,
      cursorDown: onCursorDown,
      cursorMove: onCursorMove,
      cursorUp: onCursorUp,
      musicAction,
      musicSnapshot: () => audio.snapshot(),
      saveAction,
    },
  });
}

function attachInput() {
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', () => {
    runtime.keys.clear();
    runtime.virtual.clear();
    runtime.walk = null;
    runtime.cursorHeld = false;
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      runtime.keys.clear();
      runtime.virtual.clear();
      runtime.walk = null;
      runtime.cursorHeld = false;
      saveNow();
    }
  });
  window.addEventListener('pagehide', saveNow);
  window.addEventListener('resize', () => {
    renderer.resize();
    clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(() => updateAspect(true), 260);
  });
  if ('ResizeObserver' in window) {
    const observer = new ResizeObserver(() => renderer.resize());
    observer.observe(document.getElementById('stage-wrap'));
  }

  let audioUnlocked = false;
  const unlock = () => {
    if (audioUnlocked) return;
    audioUnlocked = true;
    audio.unlock().then(() => {
      if (state.settings.sound) playRoomMusic();
    }).catch(() => {});
  };
  window.addEventListener('pointerdown', unlock, { once: true, passive: true });
  window.addEventListener('keydown', unlock, { once: true });
}

function frame(timestamp) {
  if (!runtime.lastFrame) runtime.lastFrame = timestamp;
  const dt = Math.min(0.05, Math.max(0, (timestamp - runtime.lastFrame) / 1000));
  runtime.lastFrame = timestamp;

  if (!ui.isPaused() && !document.hidden) {
    runtime.clock += dt;
    if (runtime.trial?.active) updateTrial(dt);
    else updateRoom(dt);
  }

  runtime.flash = Math.max(0, runtime.flash - dt * 2.4);
  runtime.shake = Math.max(0, runtime.shake - dt * 16);

  renderer.render({
    state,
    now: runtime.clock,
    trial: runtime.trial,
    moving: runtime.moving,
    walkClock: runtime.walkClock,
    dashTrail: runtime.trial?.active ? runtime.trial.trail : runtime.dashTrail,
    invulnerable: runtime.trial?.active
      ? runtime.trial.dashInvulnerable > 0
      : runtime.dashInvulnerable > 0,
    flash: runtime.flash,
    shake: runtime.shake,
  });

  requestAnimationFrame(frame);
}

async function boot() {
  const canvas = document.getElementById('stage');
  const walk = await loadImage('assets/east/zemic-walk.png');
  const tablet = await loadImage('assets/east/tablet.png');
  try {
    if (document.fonts?.load) await document.fonts.load('16px Zqwy');
  } catch {
    // The canvas falls back to a system font.
  }

  renderer = new Renderer(canvas, { walk, tablet });
  buildUI();
  attachInput();

  translateDocument(document);
  ui.setSettings(state.settings);
  ui.setSound(state.settings.sound);
  ui.setMusic(audio.snapshot());
  ui.setRoom(state, currentRoom(state));
  ui.setPrompt(null);
  ui.setCanvasView(state.canvas.view);
  ui.setCanvasData(state, buildPalette());
  updateAspect(true);

  const bootMs = Math.round(performance.now() - bootStartedAt);
  log(t('boot.loaded', { ms: bootMs }), 'system');
  log(t('boot.ready'), 'system');
  log(t('boot.help'), 'system');
  if (state.flags.introSeen) {
    for (const line of TUTORIAL_LINES) log(t(line), 'system');
  }
  if (state.packs.length) {
    log(t('boot.packs'), 'system');
  }

  playRoomMusic();
  requestAnimationFrame(frame);
  requestAnimationFrame(() => renderer.resize());

  if (!state.flags.introSeen && !runtime.introShown) showPrologue();
  else ui.setTerminalState(t('terminal.state.open'));

  window.setTimeout(() => {
    if (state.rooms[state.currentRoomId]) ui.setRoom(state, currentRoom(state));
  }, 250);
}

function loadImage(src) {
  return new Promise((resolve) => {
    const image = new Image();
    image.decoding = 'async';
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = src;
  });
}

// Expose a tiny diagnostic surface for local tests and debugging. It does not
// mutate game state on its own.
window.__toEast = {
  get state() { return state; },
  get runtime() { return runtime; },
  saveNow,
  version: SAVE_VERSION,
};

boot().catch((error) => {
  console.error(error);
  const logNode = document.getElementById('terminal-log');
  if (logNode) {
    const line = document.createElement('p');
    line.className = 'log-line error';
    line.textContent = `Ошибка запуска: ${error?.message || error}`;
    logNode.appendChild(line);
  }
});
