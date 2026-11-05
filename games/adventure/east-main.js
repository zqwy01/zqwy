import {
  DIRS,
  SAVE_VERSION,
  addInventoryItem,
  canvasPalette,
  createInitialState,
  currentRoom,
  dangerPosition,
  elementAvailable,
  hashString,
  hasItem,
  makeCanvasElement,
  markRoomVisited,
  mulberry32,
  nearestInteractable,
  nearestPack,
  normalizeState,
  pickupBackpack,
  dropBackpack,
  spawnPointForEntry,
  exitAt,
} from './east-core.js';
import {
  BUILTIN_COMMANDS,
  ITEM_DEFS,
  HELP,
  MUSIC_MAP,
  PROLOGUE,
  ROOM_COPY,
  TRIAL,
  TUTORIAL_LINES,
  UI_TEXT,
  WORLD_RESPONSES,
} from './east-data.js';
import { AudioManager } from './east-audio.js';
import { Renderer } from './east-render.js';
import { createUI } from './east-ui.js';

const SAVE_KEY = 'toEast.save.v1';
const PLAYER_SPEED = 152;
const TRIAL_SPEED = 186;
const DASH_SPEED = 520;
const DASH_COOLDOWN = 1.05;
const TRIAL_DASH_COOLDOWN = 1.05;
const ACTION_RADIUS = 0.17;

const DEFINITIONS = {
  builtinCommands: BUILTIN_COMMANDS,
  items: ITEM_DEFS,
};

const params = new URLSearchParams(window.location.search);
const state = loadState();
const runtime = {
  clock: 0,
  walkClock: 0,
  lastFrame: 0,
  keys: new Set(),
  virtual: new Set(),
  moving: false,
  facing: state.player.facing || 'up',
  commandTarget: null,
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

// ---------------------------------------------------------------------------
// Persistence

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
  return createInitialState(seed || Date.now());
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
  saveTimer = window.setTimeout(saveNow, 120);
}

function resetGame() {
  const fresh = createInitialState(Date.now());
  for (const key of Object.keys(state)) delete state[key];
  Object.assign(state, fresh);
  runtime.trial = null;
  runtime.commandTarget = null;
  runtime.autoExit = null;
  runtime.dying = false;
  runtime.deathLock = false;
  runtime.promptLabel = null;
  ui.setTrial(false);
  ui.closeCanvas();
  ui.clearTerminal();
  ui.setCanvasData(state, buildPalette());
  ui.setRoom(state, currentRoom(state), { banner: true });
  ui.setPrompt(null);
  ui.setSound(state.settings.sound);
  audio.setEnabled(state.settings.sound);
  playRoomMusic();
  saveNow();
  ui.log('Лабиринт перестроился. Скрижаль снова в центре.', 'system');
  ui.log(TUTORIAL_LINES[0], 'system');
  ui.showToast('Новый лабиринт создан', { tone: 'info' });
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
    player.x = Math.max(0.022, Math.min(0.978, player.x));
    player.y = Math.max(0.022, Math.min(0.978, player.y));
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
    case 'pack': return 'Взять рюкзак';
    case 'item': return ROOM_COPY.find.interact;
    case 'trial': return ROOM_COPY.story.interact;
    case 'tablet': return 'Коснуться Скрижали';
    default: return 'Действие';
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
  if (!pack.items.length) return 'пусто';
  return pack.items.map((id) => ITEM_DEFS[id]?.title || id).join(', ');
}

// ---------------------------------------------------------------------------
// Music

function playRoomMusic() {
  if (runtime.trial?.active) {
    audio.playTrack('trial');
    return;
  }
  const room = currentRoom(state);
  const id = room?.musicId && MUSIC_MAP[room.musicId] ? room.musicId : 'labyrinth';
  audio.playTrack(id);
}

function toggleSound() {
  state.settings.sound = !state.settings.sound;
  audio.setEnabled(state.settings.sound);
  ui.setSound(state.settings.sound);
  if (state.settings.sound) {
    audio.unlock();
    playRoomMusic();
    log('Звук включён.', 'system');
  } else {
    log('Звук выключен.', 'system');
  }
  saveNow();
}

// ---------------------------------------------------------------------------
// Room descriptions and commands

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
  if (room.chalkMarked) log('На полу осталась твоя черта.', 'system');
  const packs = state.packs.filter((pack) => pack.roomId === room.id);
  if (packs.length > 0) {
    log(`В комнате рюкзаков: ${packs.length}. Подойди и нажми E, чтобы поднять.`, 'system');
  }
  if (room.threat && !runtime.trial?.active) {
    log('Тень движется по полу. Её не нужно побеждать — её нужно обойти.', 'system');
  }
}

function describePack() {
  if (!state.inventory.length) {
    log('Рюкзак пуст.', 'system');
  } else {
    log(`При тебе: ${state.inventory.map((id) => ITEM_DEFS[id]?.title || id).join(', ')}.`, 'world');
  }
  if (!state.packs.length) {
    log('Потерянных рюкзаков нет.', 'system');
    return;
  }
  log(`Всего оставленных рюкзаков: ${state.packs.length}.`, 'system');
  for (const pack of state.packs) {
    const room = state.rooms[pack.roomId];
    const here = pack.roomId === state.currentRoomId ? ' · здесь' : '';
    log(`▣ «${room?.title || 'неизвестная комната'}» · ${packItemsText(pack)}${here}`, 'system');
  }
}

function nearestExitDirection(side) {
  switch (side) {
    case 'north': return { x: 0.5, y: 0.035 };
    case 'south': return { x: 0.5, y: 0.965 };
    case 'west': return { x: 0.035, y: 0.5 };
    case 'east': return { x: 0.965, y: 0.5 };
    default: return { x: 0.5, y: 0.5 };
  }
}

function goToExit(side) {
  const room = currentRoom(state);
  if (!room.exits[side]) {
    log(WORLD_RESPONSES.wall, 'world');
    return;
  }
  runtime.commandTarget = nearestExitDirection(side);
  runtime.autoExit = side;
  log(`Иду на ${DIRS.find((dir) => dir.id === side)?.label || side}.`, 'system');
}

function stepDirection(dx, dy, label) {
  runtime.commandTarget = {
    x: Math.max(0.03, Math.min(0.97, state.player.x + dx * 0.17)),
    y: Math.max(0.03, Math.min(0.97, state.player.y + dy * 0.13)),
  };
  runtime.autoExit = null;
  log(`Я иду ${label}.`, 'system');
}

function approachNearest() {
  const target = nearestInteractable(state, { radius: 1 });
  if (!target) {
    log(WORLD_RESPONSES.noTarget, 'world');
    return;
  }
  runtime.commandTarget = { x: target.x, y: target.y };
  runtime.autoExit = null;
  log(`Подхожу ближе: ${target.title}.`, 'system');
}

function performAction() {
  if (runtime.trial?.active) return;
  const interaction = getInteraction();
  if (!interaction) {
    log('Рядом нет ничего, что требует действия.', 'system');
    return;
  }

  const room = currentRoom(state);
  if (interaction.kind === 'pack') {
    const result = pickupBackpack(state, interaction.id);
    if (result.ok) {
      audio.pickup();
      log(`Рюкзак поднят. Внутри: ${packItemsText(result.pack)}.`, 'good');
      ui.showToast('Рюкзак снова при тебе', { tone: 'info' });
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
      log(`${item?.title || 'Предмет'} теперь в рюкзаке.`, 'good');
      log('Его можно добавить на холст: команда «холст».', 'system');
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
    log(WORLD_RESPONSES.noItem, 'error');
    return;
  }
  const item = ITEM_DEFS[itemId];
  const room = currentRoom(state);

  if (itemId === 'chalk') {
    if (room.chalkMarked) {
      log(WORLD_RESPONSES.chalkAlready, 'system');
      return;
    }
    room.chalkMarked = true;
    audio.tone(640, 0.14, 'triangle', 0.025);
    log(WORLD_RESPONSES.chalk(room.title), 'good');
    afterStateChange();
    return;
  }

  if (itemId === 'charm') {
    state.flags.charmUsed = true;
    log(WORLD_RESPONSES.charm, 'echo');
    scheduleSave();
    return;
  }

  log(`${item?.title || itemId}: пока без отдельного действия.`, 'system');
}

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
    note: 'Это не бой: у света нет здоровья, а у тебя нет оружия. Только движение и ритм.',
    buttons: [
      {
        label: TRIAL.intro.cancel,
        variant: 'quiet',
        onClick: () => log('Ты отступаешь от света. Он ждёт.', 'system'),
      },
      {
        label: TRIAL.intro.start,
        variant: 'primary',
        onClick: startTrial,
      },
    ],
    dismissible: true,
    onDismiss: () => log('Ты отступаешь от света. Он ждёт.', 'system'),
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
  runtime.promptLabel = null;
  ui.setPrompt(null);
  ui.setTrial(true, TRIAL.duration, TRIAL.duration);
  ui.setTerminalState('испытание · дрожащий свет');
  audio.playTrack('trial');
  log(TRIAL.intro.paragraphs[0], 'echo');
  log('Двигайся. Рывок — Shift, Space или кнопка «рывок».', 'system');
}

function addBullet(trial, x, y, vx, vy, radius = TRIAL.bulletRadius, color = '232, 198, 139') {
  trial.bullets.push({ x, y, vx, vy, r: radius, color, age: 0 });
}

function spawnTrialPattern(trial) {
  const beat = trial.beatIndex;
  const elapsed = trial.elapsed;

  if (elapsed < 5.5) {
    // Rows of slow rain with a moving gap.
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
    // Side sweeps, alternating direction, plus an occasional slow ring.
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

  // Final phase: a rotating inward ring with a single gap and aimed shots.
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
    const strong = trial.beatIndex % 4 === 0;
    audio.beat(strong);
    trial.beatIndex += 1;
    trial.nextBeat += trial.beatSeconds;
    if (trial.bullets.length > 260) trial.bullets.splice(0, trial.bullets.length - 260);
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
  ui.setTerminalState('канал открыт');

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
  ui.showBanner('испытание пройдено', 'Очарование');
  audio.chime();
  audio.playTrack('labyrinth');
  log(TRIAL.win.paragraphs[0], 'good');
  log('Карта «Очарование» лежит в рюкзаке. Её можно добавить на холст.', 'system');

  ui.showModal({
    kicker: TRIAL.win.kicker,
    title: 'Очарование',
    art: ITEM_DEFS.charm.art,
    artAlt: ITEM_DEFS.charm.artAlt,
    paragraphs: TRIAL.win.paragraphs,
    note: TRIAL.win.note,
    buttons: [
      {
        label: TRIAL.win.button,
        variant: 'primary',
        onClick: () => {
          log('Карта «Очарование»: временная техническая заглушка, конкретный эффект пока не подключён.', 'system');
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
  runtime.commandTarget = null;
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
    ? TRIAL.death
    : `Тьма смыкается. Рюкзак остаётся в комнате «${dropRoom.title}».`;
  ui.showToast(message, { ms: 3600 });
  log(message, 'error');
  log('Душа возвращается к Скрижали. Рюкзак можно найти там, где оборвался путь.', 'system');

  state.currentRoomId = state.map.startId;
  const startRoom = state.rooms[state.map.startId];
  state.player = { x: 0.5, y: 0.69, facing: 'up' };
  runtime.facing = 'up';
  markRoomVisited(state, startRoom.id);
  saveNow();
  ui.setRoom(state, startRoom, { banner: true });
  ui.setTerminalState('канал открыт');
  audio.playTrack(startRoom.musicId || 'tablet');
  if (ui.isCanvasOpen()) ui.setCanvasData(state, buildPalette());

  window.setTimeout(() => {
    runtime.dying = false;
  }, 650);
}

function changeRoom(direction) {
  const room = currentRoom(state);
  const nextId = room?.exits?.[direction];
  if (!nextId || !state.rooms[nextId]) return;
  const next = state.rooms[nextId];
  state.currentRoomId = next.id;
  state.player = spawnPointForEntry(direction);
  runtime.facing = state.player.facing;
  runtime.commandTarget = null;
  runtime.autoExit = null;
  runtime.moving = false;
  runtime.flash = 0.5;
  runtime.promptLabel = null;

  const firstVisit = markRoomVisited(state, next.id);
  ui.setRoom(state, next, { banner: true });
  ui.setPrompt(null);
  audio.playTrack(next.musicId || 'labyrinth');
  saveNow();

  if (firstVisit && next.kind === 'danger') {
    log('Коридор дышит. Тень скользит по полу, и стены на миг теряют линии.', 'system');
  }
  if (firstVisit && next.kind === 'story' && !state.flags.trialCleared) {
    log('В центре комнаты собирается тёплый дрожащий свет.', 'system');
  }
  if (next.kind === 'find' && next.take && !next.take.taken) {
    log('На низком выступе что-то светится. Подойди и нажми E.', 'system');
  }
}

// ---------------------------------------------------------------------------
// Rooms update

function updateRoom(dt) {
  const room = currentRoom(state);
  if (!room) return;

  runtime.dashCooldown = Math.max(0, runtime.dashCooldown - dt);
  runtime.dashInvulnerable = Math.max(0, runtime.dashInvulnerable - dt);
  runtime.dashTrail = runtime.dashTrail
    .map((ghost) => ({ ...ghost, alpha: ghost.alpha - dt * 2.6 }))
    .filter((ghost) => ghost.alpha > 0.03);

  const input = getInputVector();
  const hadCommand = Boolean(runtime.commandTarget);
  if (input.x !== 0 || input.y !== 0) {
    runtime.commandTarget = null;
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
    movePlayerByPixels(
      state.player,
      input.x * PLAYER_SPEED * dt,
      input.y * PLAYER_SPEED * dt,
    );
  } else if (runtime.commandTarget) {
    const rr = roomMetrics();
    const dx = (runtime.commandTarget.x - state.player.x) * rr.w;
    const dy = (runtime.commandTarget.y - state.player.y) * rr.h;
    const distance = Math.hypot(dx, dy);
    if (distance < 2.4) {
      state.player.x = runtime.commandTarget.x;
      state.player.y = runtime.commandTarget.y;
      const side = runtime.autoExit;
      runtime.commandTarget = null;
      runtime.autoExit = null;
      runtime.moving = false;
      if (side && room.exits[side]) changeRoom(side);
      return;
    }
    const step = Math.min(distance, PLAYER_SPEED * dt);
    runtime.moving = true;
    runtime.facing = facingFromVector(dx / distance, dy / distance);
    movePlayerByPixels(state.player, (dx / distance) * step, (dy / distance) * step);
  } else {
    runtime.moving = false;
  }

  runtime.walkClock += dt * (runtime.moving ? 1 : 0.28);
  runtime.stepAccumulator += runtime.moving ? dt : 0;
  if (runtime.stepAccumulator >= 1.2) {
    runtime.stepAccumulator = 0;
    state.stats.steps += 1;
  }

  const exit = exitAt(state, 0.026);
  if (exit) {
    changeRoom(exit.side);
    return;
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
  void hadCommand;
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
  const typing = ui.isTypingTarget(event.target);
  const inModal = ui.isPaused();

  if (typing && event.code !== 'Escape') {
    const movement = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];
    if (movement.includes(event.code) && !event.target.value) {
      event.target.blur();
    } else {
      return;
    }
  }

  if (inModal) return;
  const movementMap = {
    KeyW: 'up', ArrowUp: 'up',
    KeyS: 'down', ArrowDown: 'down',
    KeyA: 'left', ArrowLeft: 'left',
    KeyD: 'right', ArrowRight: 'right',
  };

  if (movementMap[event.code]) {
    event.preventDefault();
    runtime.keys.add(movementMap[event.code]);
    return;
  }
  if (event.code === 'KeyE') {
    if (event.repeat) return;
    event.preventDefault();
    performAction();
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
// Command dispatcher

function dispatchCommand(raw, source = 'terminal') {
  const command = String(raw || '').trim().replace(/[.!?]+$/g, '').toLowerCase();
  if (!command) return;
  log(source === 'canvas' ? `холст › ${command}` : `> ${command}`, 'command');

  if (runtime.trial?.active) {
    log('Сейчас не до команд: свет не ждёт.', 'system');
    return;
  }

  if (command === 'помоги' || command === 'команды') {
    for (const line of HELP) log(line, 'system');
    return;
  }
  if (command === 'привет') {
    log('Привет!', 'world');
    return;
  }
  if (command === 'ты куда пропал') {
    log('Теперь я тут... Да уж. Местечко сомнительное.', 'world');
    return;
  }
  if (command === 'осмотреться' || command === 'осмотреться.' || command === 'look') {
    describeRoom();
    return;
  }
  if (command === 'рюкзак' || command === 'инвентарь') {
    describePack();
    return;
  }
  if (command === 'холст' || command === 'canvas') {
    if (ui.isCanvasOpen()) {
      log('Холст уже открыт.', 'system');
    } else {
      openCanvas();
    }
    return;
  }
  if (command === 'взять' || command === 'поднять') {
    performAction();
    return;
  }
  if (command === 'подойди') {
    approachNearest();
    return;
  }
  if (command === 'стоп') {
    runtime.commandTarget = null;
    runtime.autoExit = null;
    runtime.moving = false;
    runtime.keys.clear();
    runtime.virtual.clear();
    log('Я остановился.', 'system');
    return;
  }
  if (command === 'очисти' || command === 'clear') {
    ui.clearTerminal();
    return;
  }
  if (command === 'вверх') {
    stepDirection(0, -1, 'вверх');
    return;
  }
  if (command === 'вниз') {
    stepDirection(0, 1, 'вниз');
    return;
  }
  if (command === 'влево') {
    stepDirection(-1, 0, 'влево');
    return;
  }
  if (command === 'вправо') {
    stepDirection(1, 0, 'вправо');
    return;
  }
  if (command === 'север') {
    goToExit('north');
    return;
  }
  if (command === 'юг') {
    goToExit('south');
    return;
  }
  if (command === 'запад') {
    goToExit('west');
    return;
  }
  if (command === 'восток') {
    goToExit('east');
    return;
  }
  if (command === 'мел' || command === 'chalk') {
    useItem('chalk');
    return;
  }
  if (command === 'очарование' || command === 'charm') {
    useItem('charm');
    return;
  }
  if (command === 'звук') {
    toggleSound();
    return;
  }
  if (command === 'сброс' || command === 'reset') {
    confirmReset();
    return;
  }

  log(WORLD_RESPONSES.unknown(command), 'error');
}

function confirmReset() {
  ui.showModal({
    kicker: 'сброс',
    title: 'Начать заново?',
    paragraphs: [
      'Текущий лабиринт, рюкзаки на полу и отметки на холсте будут потеряны.',
      'Скрижаль останется, но карта комнат станет другой.',
    ],
    note: 'Это действие нельзя отменить.',
    buttons: [
      { label: 'Остаться', variant: 'quiet' },
      { label: 'Сбросить', variant: 'primary', onClick: resetGame },
    ],
    dismissible: true,
  });
}

// ---------------------------------------------------------------------------
// Canvas actions

function openCanvas() {
  if (runtime.trial?.active) {
    log('Холст недоступен, пока свет не отпустит.', 'system');
    return;
  }
  ui.setCanvasData(state, buildPalette());
  ui.clearCanvasLog();
  ui.openCanvas();
  ui.addCanvasLog('Холст открыт. Симуляция комнаты на паузе.', 'system');
  ui.addCanvasLog('Добавь команду или карту, нажми на элемент, чтобы выполнить. Выход — «Выйти» или Esc.', 'system');
  scheduleSave();
}

function closeCanvas() {
  ui.closeCanvas();
  scheduleSave();
}

function canvasAdd(descriptor, x, y) {
  const overrides = Number.isFinite(x) && Number.isFinite(y) ? { x, y } : {};
  const element = makeCanvasElement(state, descriptor, overrides);
  scheduleSave();
  ui.setCanvasData(state, buildPalette());
  ui.addCanvasLog(`на холст: ${element.title}`, 'good');
}

function canvasExecute(element) {
  if (!elementAvailable(state, element)) {
    const message = WORLD_RESPONSES.noItem;
    log(message, 'error');
    if (ui.isCanvasOpen()) ui.addCanvasLog(message, 'error');
    return;
  }
  if (element.command === 'холст') {
    log('Холст уже открыт.', 'system');
    return;
  }
  dispatchCommand(element.command, 'canvas');
}

function canvasMove(id, x, y) {
  const element = state.canvas.elements.find((entry) => entry.id === id);
  if (!element) return;
  element.x = Math.max(0.08, Math.min(0.92, x));
  element.y = Math.max(0.1, Math.min(0.9, y));
  scheduleSave();
  ui.setCanvasData(state, buildPalette());
}

function canvasRemove(id) {
  const index = state.canvas.elements.findIndex((entry) => entry.id === id);
  if (index < 0) return;
  const [removed] = state.canvas.elements.splice(index, 1);
  scheduleSave();
  ui.setCanvasData(state, buildPalette());
  ui.addCanvasLog(`убрано: ${removed.title}`, 'system');
}

function canvasClear() {
  if (!state.canvas.elements.length) {
    ui.addCanvasLog('Холст уже пуст.', 'system');
    return;
  }
  ui.showModal({
    kicker: 'холст',
    title: 'Очистить холст?',
    paragraphs: ['Все элементы с холста будут убраны. Команды и предметы останутся в терминале и рюкзаке.'],
    buttons: [
      { label: 'Оставить', variant: 'quiet' },
      {
        label: 'Очистить',
        variant: 'primary',
        onClick: () => {
          state.canvas.elements = [];
          scheduleSave();
          ui.setCanvasData(state, buildPalette());
          ui.addCanvasLog('Холст очищен.', 'system');
        },
      },
    ],
    dismissible: true,
  });
}

function canvasQuick(value) {
  dispatchCommand(value, 'canvas');
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
          for (const line of TUTORIAL_LINES) log(line, 'system');
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
  ui = createUI({
    itemDefs: ITEM_DEFS,
    callbacks: {
      command: dispatchCommand,
      action: performAction,
      dash: requestDash,
      soundToggle: toggleSound,
      virtualMove: (direction, pressed) => {
        if (pressed) runtime.virtual.add(direction);
        else runtime.virtual.delete(direction);
      },
      canvasOpen: openCanvas,
      canvasClose: closeCanvas,
      canvasAdd,
      canvasExecute,
      canvasMove,
      canvasRemove,
      canvasClear,
      canvasQuick,
    },
  });
}

function attachInput() {
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', () => {
    runtime.keys.clear();
    runtime.virtual.clear();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      runtime.keys.clear();
      runtime.virtual.clear();
      saveNow();
    }
  });
  window.addEventListener('pagehide', saveNow);
  window.addEventListener('resize', () => renderer.resize());
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
  audio = new AudioManager(MUSIC_MAP);
  audio.setEnabled(state.settings.sound);
  ui.setSound(state.settings.sound);
  ui.setRoom(state, currentRoom(state));
  ui.setPrompt(null);
  ui.setCanvasData(state, buildPalette());
  attachInput();

  log('Скрижаль молчит. Терминал ждёт команду.', 'system');
  log('«помоги» — список команд. «холст» — рабочее пространство.', 'system');
  if (state.flags.introSeen) {
    for (const line of TUTORIAL_LINES) log(line, 'system');
  }
  if (state.packs.length) {
    log('В лабиринте остались рюкзаки. Команда «рюкзак» покажет, где они.', 'system');
  }

  playRoomMusic();
  requestAnimationFrame(frame);
  requestAnimationFrame(() => renderer.resize());

  if (!state.flags.introSeen && !runtime.introShown) showPrologue();
  else ui.setTerminalState('канал открыт');

  // Keep the navigation state honest after a browser restore with a stale tab.
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
