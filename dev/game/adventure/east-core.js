// Core state, generation and canvas model for the “To East” prototype.
// The module stays dependency-free so it can run in the browser and in Node tests.

export const SAVE_VERSION = 1;
export const FIRST_STORY_CHANCE = 0.25;
export const WALL_TILES = 16;

export const DIRS = Object.freeze([
  { id: 'north', label: 'север', labelKey: 'dir.north', short: 'С', dx: 0, dy: -1, opposite: 'south' },
  { id: 'south', label: 'юг', labelKey: 'dir.south', short: 'Ю', dx: 0, dy: 1, opposite: 'north' },
  { id: 'east', label: 'восток', labelKey: 'dir.east', short: 'В', dx: 1, dy: 0, opposite: 'west' },
  { id: 'west', label: 'запад', labelKey: 'dir.west', short: 'З', dx: -1, dy: 0, opposite: 'east' },
]);

const OPPOSITE_SIDE = Object.fromEntries(DIRS.map((d) => [d.id, d.opposite]));
const SIDE_BY_VECTOR = new Map(DIRS.map((d) => [`${d.dx},${d.dy}`, d.id]));

const GENERIC_TITLES = [
  { ru: 'Коридор без конца', en: 'Corridor without an end' },
  { ru: 'Комната слуха', en: 'Room of hearing' },
  { ru: 'Зал повторений', en: 'Hall of repetitions' },
  { ru: 'Низкий свод', en: 'Low vault' },
  { ru: 'Поворот, которого не было', en: 'The turn that was not there' },
  { ru: 'Тихая развилка', en: 'Quiet fork' },
  { ru: 'Слепой карман', en: 'Blind pocket' },
  { ru: 'Петля', en: 'Loop' },
  { ru: 'Место, где стены близко', en: 'Where the walls are close' },
  { ru: 'Коридор с двойным дном', en: 'Corridor with a false bottom' },
  { ru: 'Комната без углов', en: 'Room without corners' },
  { ru: 'Свод, который слушает', en: 'Vault that listens' },
];

const GENERIC_SUBTITLES = [
  { ru: 'переход', en: 'passage' },
  { ru: 'глубже', en: 'deeper' },
  { ru: 'ответвление', en: 'branch' },
  { ru: 'тупик?', en: 'dead end?' },
];

const MOTIFS = ['loops', 'teeth', 'columns', 'stairs', 'eyes', 'spiral', 'echo'];

// ---------------------------------------------------------------------------
// Small utilities

export function roomIdFor(x, y) {
  return `r_${x}_${y}`;
}

export function hashString(text) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < String(text).length; i += 1) {
    h ^= String(text).charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function random() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffled(items, random) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function bfs(rooms, startId) {
  const distance = new Map([[startId, 0]]);
  const parent = new Map([[startId, null]]);
  const queue = [startId];
  for (let head = 0; head < queue.length; head += 1) {
    const id = queue[head];
    const room = rooms[id];
    for (const side of Object.keys(room.exits)) {
      const next = room.exits[side];
      if (!next || distance.has(next)) continue;
      distance.set(next, distance.get(id) + 1);
      parent.set(next, { id, side });
      queue.push(next);
    }
  }
  return { distance, parent };
}

function pathTo(parent, startId, targetId) {
  const path = [];
  let cursor = targetId;
  while (cursor && cursor !== startId) {
    path.push(cursor);
    const step = parent.get(cursor);
    if (!step) break;
    cursor = step.id;
  }
  if (cursor !== startId) return [];
  path.push(startId);
  return path.reverse();
}

function makeRoom(x, y, kind = 'generic') {
  return {
    id: roomIdFor(x, y),
    x,
    y,
    kind,
    title: { ru: 'Комната', en: 'Room' },
    subtitle: { ru: '', en: '' },
    manual: false,
    motif: 'loops',
    musicId: 'labyrinth',
    exits: {},
    doors: {},
    visited: false,
    threat: null,
    take: null,
    trial: false,
    chalkMarked: false,
    depth: 0,
  };
}

function defaultDoor() {
  const tiles = 4;
  const offsetTiles = Math.floor((WALL_TILES - tiles) / 2);
  return { offset: offsetTiles / WALL_TILES, width: tiles / WALL_TILES, tiles };
}

// A door is stored on both linked rooms with identical offset/width so the
// opening lines up on both sides of the wall. Offset and width are fractions
// of the 16-tile wall; `tiles` is the readable width in tiles (1..12).
function makeDoor(random = Math.random) {
  const tiles = clamp(1 + Math.floor(random() * 12), 1, 12);
  const span = WALL_TILES - tiles;
  const offsetTiles = span <= 0 ? 0 : Math.floor(random() * (span + 1));
  return {
    offset: offsetTiles / WALL_TILES,
    width: tiles / WALL_TILES,
    tiles,
  };
}

function link(a, b, side, random) {
  if (!a || !b || !side || a.exits[side]) return false;
  const door = makeDoor(random);
  a.exits[side] = b.id;
  b.exits[OPPOSITE_SIDE[side]] = a.id;
  a.doors[side] = { ...door };
  b.doors[OPPOSITE_SIDE[side]] = { ...door };
  return true;
}

// ---------------------------------------------------------------------------
// Generation

function buildGraph(seed, maxRooms = 12) {
  const random = mulberry32(seed);
  const rooms = {};
  const start = makeRoom(0, 0, 'tablet');
  rooms[start.id] = start;
  const stack = [start];

  while (Object.keys(rooms).length < maxRooms && stack.length > 0) {
    const current = stack[stack.length - 1];
    const candidates = shuffled(DIRS, random).filter((dir) => {
      const nx = current.x + dir.dx;
      const ny = current.y + dir.dy;
      if (Math.abs(nx) > 3 || Math.abs(ny) > 3) return false;
      if (Math.abs(nx) + Math.abs(ny) > 5) return false;
      return !rooms[roomIdFor(nx, ny)];
    });

    if (candidates.length === 0) {
      stack.pop();
      continue;
    }

    // Prefer directions that are not straight continuations of the previous
    // step. This keeps the layout from turning into a single long corridor.
    const previous = stack.length > 1 ? stack[stack.length - 2] : null;
    const forward = previous
      ? { x: Math.sign(current.x - previous.x), y: Math.sign(current.y - previous.y) }
      : { x: 0, y: 0 };
    const ranked = candidates.slice().sort((a, b) => {
      const straightA = a.dx === forward.x && a.dy === forward.y ? 1 : 0;
      const straightB = b.dx === forward.x && b.dy === forward.y ? 1 : 0;
      return straightA - straightB;
    });
    const dir = ranked[0];
    const next = makeRoom(current.x + dir.dx, current.y + dir.dy);
    next.motif = MOTIFS[Math.floor(random() * MOTIFS.length)];
    rooms[next.id] = next;
    link(current, next, dir.id, random);
    stack.push(next);
  }

  // Add a couple of loops/branches between neighbouring rooms.
  const all = Object.values(rooms);
  const pairs = [];
  for (const room of all) {
    for (const dir of DIRS) {
      if (room.exits[dir.id]) continue;
      const other = rooms[roomIdFor(room.x + dir.dx, room.y + dir.dy)];
      if (other) pairs.push({ room, other, side: dir.id });
    }
  }
  let extras = 0;
  for (const pair of shuffled(pairs, random)) {
    if (extras >= 3) break;
    if (random() > 0.42) continue;
    if (link(pair.room, pair.other, pair.side, random)) extras += 1;
  }

  return { rooms, startId: start.id, random, extras };
}

function attachGeneratedDetails(rooms, startId, random, options = {}) {
  const { distance, parent } = bfs(rooms, startId);
  const all = Object.values(rooms);
  const maxDepth = Math.max(...distance.values());
  if (maxDepth < 3 || all.length < 6) return null;

  const storyEnabled = options.forceStory === true
    ? true
    : options.forceStory === false
      ? false
      : random() < (Number.isFinite(options.storyChance) ? options.storyChance : FIRST_STORY_CHANCE);

  const byDepth = all
    .filter((room) => room.id !== startId)
    .sort((a, b) => (distance.get(b.id) || 0) - (distance.get(a.id) || 0));

  let story = null;
  if (storyEnabled) {
    const candidates = byDepth.filter((room) => (distance.get(room.id) || 0) >= 3);
    const pool = candidates.length ? candidates : byDepth;
    story = pool[Math.floor(random() * pool.length)] || null;
  }

  const storyPath = story ? pathTo(parent, startId, story.id) : [];
  let danger = null;
  if (storyPath.length >= 4) {
    danger = rooms[storyPath[Math.min(2, storyPath.length - 2)]];
  } else {
    const pool = byDepth.filter((room) => room.id !== story?.id);
    danger = pool[Math.floor(random() * pool.length)] || null;
  }

  const findCandidates = all.filter((room) => (
    room.id !== startId &&
    room.id !== story?.id &&
    room.id !== danger?.id
  ));
  const find = findCandidates.sort((a, b) => {
    const da = distance.get(a.id) || 0;
    const db = distance.get(b.id) || 0;
    return da - db || hashString(a.id) - hashString(b.id);
  })[Math.floor(random() * Math.max(1, Math.min(3, findCandidates.length)))] || null;

  const titles = shuffled(GENERIC_TITLES, random);
  const subtitles = shuffled(GENERIC_SUBTITLES, random);
  let titleIndex = 0;

  for (const room of all) {
    room.depth = distance.get(room.id) ?? 0;
    room.musicId = 'labyrinth';
    if (room.id === startId) {
      room.kind = 'tablet';
      room.title = { ru: 'Скрижаль', en: 'Tablet' };
      room.subtitle = { ru: 'точка возвращения', en: 'return point' };
      room.manual = true;
      room.musicId = 'tablet';
      room.visited = true;
      room.motif = 'tablet';
    }
  }

  if (story) {
    story.kind = 'story';
    story.title = { ru: 'Комната дрожащего света', en: 'Room of shivering light' };
    story.subtitle = { ru: 'сюжетная комната', en: 'story room' };
    story.manual = true;
    story.musicId = 'trial';
    story.motif = 'trial';
    story.trial = true;
  }

  if (danger) {
    danger.kind = 'danger';
    danger.title = { ru: 'Коридор, который дышит', en: 'Breathing corridor' };
    danger.subtitle = { ru: 'опасный переход', en: 'dangerous passage' };
    danger.manual = true;
    danger.musicId = 'labyrinth';
    danger.motif = 'breath';
    danger.threat = {
      type: 'sweep',
      period: 6.4 + random() * 2.4,
      radius: 0.085 + random() * 0.035,
      phase: (hashString(danger.id) % 1000) / 1000,
    };
  }

  if (find) {
    find.kind = 'find';
    find.title = { ru: 'Кладовая пыли', en: 'Dust pantry' };
    find.subtitle = { ru: 'находка', en: 'find' };
    find.motif = 'columns';
    find.take = { itemId: 'chalk', taken: false };
  }

  for (const room of shuffled(all, random)) {
    if (room.kind !== 'generic') continue;
    room.title = titles[titleIndex % titles.length];
    room.subtitle = subtitles[titleIndex % subtitles.length];
    titleIndex += 1;
    room.musicId = (distance.get(room.id) || 0) > 2 ? 'deep' : 'labyrinth';
  }

  return {
    rooms,
    startId,
    storyId: story?.id ?? null,
    dangerId: danger?.id ?? null,
    findId: find?.id ?? null,
  };
}

function fallbackLabyrinth(seed, options = {}) {
  const layout = [
    [0, 0, 'tablet'],
    [0, -1, 'generic'],
    [1, -1, 'generic'],
    [1, 0, 'generic'],
    [1, 1, 'generic'],
    [0, 1, 'generic'],
    [-1, 1, 'generic'],
    [-1, 0, 'generic'],
    [-1, -1, 'generic'],
    [2, -1, 'generic'],
    [0, -2, 'generic'],
  ];
  const random = mulberry32(hashString(`fallback-${seed}`));
  const rooms = {};
  for (const [x, y, kind] of layout) {
    const room = makeRoom(x, y, kind);
    rooms[room.id] = room;
  }
  for (const room of Object.values(rooms)) {
    for (const dir of DIRS) {
      const other = rooms[roomIdFor(room.x + dir.dx, room.y + dir.dy)];
      if (other) link(room, other, dir.id, random);
    }
  }
  const generated = attachGeneratedDetails(rooms, roomIdFor(0, 0), random, {
    ...options,
    forceStory: options.forceStory === true,
  });
  if (generated) return generated;

  const startId = roomIdFor(0, 0);
  const dangerId = roomIdFor(0, -1);
  const findId = roomIdFor(1, 1);
  const storyId = options.forceStory === true ? roomIdFor(-1, 1) : null;
  const danger = rooms[dangerId];
  danger.kind = 'danger';
  danger.title = { ru: 'Коридор, который дышит', en: 'Breathing corridor' };
  danger.manual = true;
  danger.motif = 'breath';
  danger.threat = { type: 'sweep', period: 7.2, radius: 0.1, phase: 0.31 };
  const find = rooms[findId];
  find.kind = 'find';
  find.title = { ru: 'Кладовая пыли', en: 'Dust pantry' };
  find.take = { itemId: 'chalk', taken: false };
  if (storyId) {
    const story = rooms[storyId];
    story.kind = 'story';
    story.title = { ru: 'Комната дрожащего света', en: 'Room of shivering light' };
    story.manual = true;
    story.trial = true;
    story.motif = 'trial';
    story.musicId = 'trial';
  }
  const start = rooms[startId];
  start.kind = 'tablet';
  start.title = { ru: 'Скрижаль', en: 'Tablet' };
  start.manual = true;
  start.motif = 'tablet';
  start.musicId = 'tablet';
  const { distance } = bfs(rooms, startId);
  for (const room of Object.values(rooms)) room.depth = distance.get(room.id) || 0;
  return { rooms, startId, storyId, dangerId, findId };
}

export function generateLabyrinth(seed, options = {}) {
  const numericSeed = Number.isFinite(Number(seed)) ? Number(seed) >>> 0 : hashString(String(seed));
  for (let attempt = 0; attempt < 48; attempt += 1) {
    const attemptSeed = (numericSeed + attempt * 104729) >>> 0;
    const graph = buildGraph(attemptSeed);
    const detailed = attachGeneratedDetails(graph.rooms, graph.startId, graph.random, options);
    if (detailed) {
      return { ...detailed, seed: attemptSeed };
    }
  }
  return { ...fallbackLabyrinth(numericSeed, options), seed: numericSeed };
}

// ---------------------------------------------------------------------------
// State

export function createInitialState(seed = Date.now(), options = {}) {
  const labyrinth = generateLabyrinth(seed, options);
  const start = labyrinth.rooms[labyrinth.startId];
  start.visited = true;
  return normalizeState({
    version: SAVE_VERSION,
    seed: labyrinth.seed,
    map: {
      startId: labyrinth.startId,
      storyId: labyrinth.storyId,
      dangerId: labyrinth.dangerId,
      findId: labyrinth.findId,
    },
    rooms: labyrinth.rooms,
    currentRoomId: labyrinth.startId,
    player: { x: 0.5, y: 0.58, facing: 'down' },
    inventory: [],
    packs: [],
    packSeq: 0,
    canvasSeq: 0,
    canvasLinkSeq: 0,
    canvas: { elements: [], links: [], view: { x: 0, y: 0, zoom: 1 } },
    flags: {
      introSeen: false,
      trialCleared: false,
      charmUsed: false,
      seenCard: false,
    },
    stats: { deaths: 0, steps: 0 },
    settings: { sound: true },
    savedAt: Date.now(),
  });
}

const DEFAULT_LOG_SOURCES = Object.freeze({
  command: true,
  terminal: true,
  system: true,
  world: true,
  action: true,
  error: true,
  echo: true,
});

export function normalizeSettings(candidate = {}) {
  const logSources = {};
  for (const key of Object.keys(DEFAULT_LOG_SOURCES)) {
    logSources[key] = candidate?.logSources?.[key] !== false;
  }
  return {
    sound: candidate?.sound !== false,
    language: candidate?.language === 'en' ? 'en' : 'ru',
    autocomplete: candidate?.autocomplete !== false,
    walkSeconds: Number.isFinite(Number(candidate?.walkSeconds))
      ? clamp(Number(candidate.walkSeconds), 0.2, 30)
      : 1,
    cursorControl: candidate?.cursorControl !== false,
    musicVolume: Number.isFinite(Number(candidate?.musicVolume))
      ? clamp(Number(candidate.musicVolume), 0, 1)
      : 0.8,
    logSources,
  };
}

function normalizeCanvas(candidate, canvasSeq) {
  const raw = candidate && typeof candidate === 'object' ? candidate : {};
  const rawElements = Array.isArray(raw.elements) ? raw.elements : [];
  const elements = [];
  const idMap = new Map();

  for (let index = 0; index < rawElements.length; index += 1) {
    const item = rawElements[index];
    if (!item || typeof item !== 'object') continue;
    let x = Number.isFinite(Number(item.x)) ? Number(item.x) : 80 + (index % 4) * 160;
    let y = Number.isFinite(Number(item.y)) ? Number(item.y) : 70 + Math.floor(index / 4) * 130;
    // Old saves stored normalized viewport coordinates in 0..1. Migrate them
    // into the unbounded world so both formats remain loadable.
    if (x >= 0 && x <= 1 && y >= 0 && y <= 1) {
      x = 60 + x * 720;
      y = 50 + y * 520;
    }
    const id = item.id || `canvas_${canvasSeq + index}`;
    idMap.set(item.id || id, id);
    elements.push({ ...item, id, x, y });
  }

  const links = [];
  const rawLinks = Array.isArray(raw.links) ? raw.links : [];
  for (const link of rawLinks) {
    if (!link || typeof link !== 'object') continue;
    const from = idMap.get(link.from) || link.from;
    const to = idMap.get(link.to) || link.to;
    if (!elements.some((item) => item.id === from) || !elements.some((item) => item.id === to)) continue;
    links.push({
      id: link.id || `link_${links.length}`,
      from,
      to,
    });
  }

  const view = {
    x: Number.isFinite(Number(raw.view?.x)) ? Number(raw.view.x) : 0,
    y: Number.isFinite(Number(raw.view?.y)) ? Number(raw.view.y) : 0,
    zoom: Number.isFinite(Number(raw.view?.zoom)) ? clamp(Number(raw.view.zoom), 0.35, 2.6) : 1,
  };

  return {
    elements,
    links,
    view,
    seq: Math.max(
      Number.isInteger(raw.seq) ? raw.seq : 0,
      Number.isInteger(canvasSeq) ? canvasSeq : 0,
      elements.length,
    ),
    linkSeq: Array.isArray(raw.links) ? raw.links.length : 0,
  };
}

export function normalizeState(candidate) {
  if (!candidate || typeof candidate !== 'object') return null;
  if (candidate.version !== SAVE_VERSION) return null;
  if (!candidate.rooms || typeof candidate.rooms !== 'object') return null;
  if (!candidate.currentRoomId || !candidate.rooms[candidate.currentRoomId]) return null;
  if (!candidate.map?.startId || !candidate.rooms[candidate.map.startId]) return null;

  const state = candidate;
  state.player = {
    x: Number.isFinite(state.player?.x) ? state.player.x : 0.5,
    y: Number.isFinite(state.player?.y) ? state.player.y : 0.58,
    facing: state.player?.facing || 'down',
  };
  state.inventory = Array.isArray(state.inventory) ? state.inventory : [];
  state.packs = Array.isArray(state.packs) ? state.packs : [];
  state.packSeq = Number.isInteger(state.packSeq) ? state.packSeq : state.packs.length;
  state.canvasSeq = Number.isInteger(state.canvasSeq) ? state.canvasSeq : 0;
  state.canvas = normalizeCanvas(state.canvas, state.canvasSeq);
  state.canvasSeq = state.canvas.seq;

  state.flags = {
    introSeen: Boolean(state.flags?.introSeen),
    trialCleared: Boolean(state.flags?.trialCleared),
    charmUsed: Boolean(state.flags?.charmUsed),
    seenCard: Boolean(state.flags?.seenCard),
  };
  state.stats = {
    deaths: Number.isInteger(state.stats?.deaths) ? state.stats.deaths : 0,
    steps: Number.isInteger(state.stats?.steps) ? state.stats.steps : 0,
  };
  state.settings = normalizeSettings(state.settings);
  state.map = state.map || {};

  for (const room of Object.values(state.rooms)) {
    room.exits = room.exits && typeof room.exits === 'object' ? room.exits : {};
    room.doors = room.doors && typeof room.doors === 'object' ? room.doors : {};
    for (const side of Object.keys(room.exits)) {
      if (!room.doors[side]) room.doors[side] = defaultDoor();
    }
    room.visited = Boolean(room.visited);
    room.chalkMarked = Boolean(room.chalkMarked);
    if (room.take && typeof room.take.taken !== 'boolean') room.take.taken = false;
    if (room.kind === 'story' && state.flags.trialCleared) room.trial = false;
  }

  return state;
}

export function currentRoom(state) {
  return state.rooms[state.currentRoomId];
}

export function getRoom(state, roomId) {
  return state.rooms[roomId] || null;
}

export function addInventoryItem(state, itemId) {
  if (!itemId) return false;
  if (state.inventory.includes(itemId)) return false;
  state.inventory.push(itemId);
  return true;
}

export function hasItem(state, itemId) {
  return state.inventory.includes(itemId);
}

export function packsInRoom(state, roomId = state.currentRoomId) {
  return state.packs.filter((pack) => pack.roomId === roomId);
}

export function dropBackpack(state, { roomId, x, y, cause = 'death' }) {
  const pack = {
    id: `pack_${state.packSeq}`,
    roomId,
    x: Number.isFinite(x) ? x : 0.5,
    y: Number.isFinite(y) ? y : 0.5,
    items: [...state.inventory],
    cause,
    createdAt: Date.now(),
  };
  state.packSeq += 1;
  state.packs.push(pack);
  state.inventory = [];
  state.stats.deaths += 1;
  return pack;
}

export function pickupBackpack(state, packId) {
  const index = state.packs.findIndex((pack) => pack.id === packId);
  if (index < 0) return { ok: false, items: [] };
  const [pack] = state.packs.splice(index, 1);
  for (const itemId of pack.items) addInventoryItem(state, itemId);
  return { ok: true, items: pack.items, pack };
}

export function nearestPack(state, x, y, radius = 0.18) {
  let best = null;
  let bestDistance = Infinity;
  for (const pack of packsInRoom(state)) {
    const distance = Math.hypot(pack.x - x, pack.y - y);
    if (distance <= radius && distance < bestDistance) {
      best = pack;
      bestDistance = distance;
    }
  }
  return best;
}

export function dangerPosition(room, time) {
  if (!room?.threat) return null;
  const period = room.threat.period || 7.2;
  const phase = room.threat.phase || 0;
  const t = ((time / period + phase) % 1 + 1) % 1;
  const x = 0.11 + 0.78 * t;
  const y = 0.5 + 0.27 * Math.sin(t * Math.PI * 2 + 0.85);
  return { x, y, radius: room.threat.radius || 0.1, t };
}

export function exitsOf(room) {
  return DIRS.filter((dir) => Boolean(room.exits[dir.id]));
}

export function sideForVector(dx, dy) {
  if (Math.abs(dx) < 0.01 && Math.abs(dy) < 0.01) return null;
  const sx = Math.abs(dx) > Math.abs(dy) ? Math.sign(dx) : 0;
  const sy = Math.abs(dy) >= Math.abs(dx) ? Math.sign(dy) : 0;
  return SIDE_BY_VECTOR.get(`${sx},${sy}`) || null;
}

export function markRoomVisited(state, roomId) {
  const room = state.rooms[roomId];
  if (!room) return false;
  const first = !room.visited;
  room.visited = true;
  return first;
}

// ---------------------------------------------------------------------------
// Unlocks and commands

export function commandUnlocked(state, command) {
  if (!command) return false;
  const unlock = command.unlock;
  if (!unlock) return true;
  if (unlock === 'introSeen') return Boolean(state.flags?.introSeen);
  if (unlock === 'trialCleared') return Boolean(state.flags?.trialCleared);
  if (unlock === 'seenCard') return Boolean(state.flags?.seenCard);
  if (unlock.startsWith('has:')) return hasItem(state, unlock.slice(4));
  return true;
}

export function availableCommands(state, commands) {
  return (commands || []).filter((command) => commandUnlocked(state, command));
}

// ---------------------------------------------------------------------------
// Canvas palette and elements

export function canvasPalette(state, definitions) {
  const source = [];
  const builtin = definitions?.builtinCommands || [];
  for (const command of builtin) {
    if (!commandUnlocked(state, command)) continue;
    source.push({
      sourceType: 'command',
      sourceId: command.id,
      ...command,
    });
  }
  for (const itemId of state.inventory) {
    const item = definitions?.items?.[itemId];
    if (!item) continue;
    source.push({
      sourceType: item.card ? 'card' : 'item',
      sourceId: itemId,
      ...item,
    });
  }
  return source;
}

export function makeCanvasElement(state, descriptor, overrides = {}) {
  const index = state.canvas.elements.length;
  const element = {
    id: `canvas_${state.canvasSeq}`,
    sourceType: descriptor.sourceType || 'command',
    sourceId: descriptor.sourceId || descriptor.id || descriptor.command,
    title: descriptor.title,
    command: descriptor.command,
    actionLabel: descriptor.actionLabel || { ru: 'Выполнить', en: 'Run' },
    icon: descriptor.icon || '·',
    unlock: descriptor.unlock || null,
    keyCode: descriptor.keyCode || null,
    keyLabel: descriptor.keyLabel || null,
    steps: Array.isArray(descriptor.steps) && descriptor.steps.length
      ? [...descriptor.steps]
      : descriptor.command
        ? [descriptor.command]
        : [],
    x: Number.isFinite(overrides.x) ? overrides.x : 80 + (index % 4) * 160,
    y: Number.isFinite(overrides.y) ? overrides.y : 70 + Math.floor(index / 4) % 3 * 130,
    ...overrides,
  };
  state.canvasSeq += 1;
  state.canvas.seq = state.canvasSeq;
  state.canvas.elements.push(element);
  return element;
}

export function addCanvasLink(state, fromId, toId) {
  if (!fromId || !toId || fromId === toId) return null;
  const elements = state.canvas.elements;
  if (!elements.some((item) => item.id === fromId) || !elements.some((item) => item.id === toId)) return null;
  if (state.canvas.links.some((link) => link.from === fromId && link.to === toId)) return null;
  const link = {
    id: `link_${state.canvas.linkSeq || 0}`,
    from: fromId,
    to: toId,
  };
  state.canvas.linkSeq = (state.canvas.linkSeq || 0) + 1;
  state.canvas.links.push(link);
  return link;
}

export function removeCanvasElement(state, elementId) {
  const index = state.canvas.elements.findIndex((entry) => entry.id === elementId);
  if (index < 0) return null;
  const [removed] = state.canvas.elements.splice(index, 1);
  state.canvas.links = state.canvas.links.filter(
    (link) => link.from !== elementId && link.to !== elementId,
  );
  return removed;
}

export function elementAvailable(state, element) {
  if (!element) return false;
  if (element.sourceType === 'item' || element.sourceType === 'card') {
    return hasItem(state, element.sourceId);
  }
  if (element.unlock) {
    return commandUnlocked(state, { unlock: element.unlock });
  }
  return true;
}

export function estimateDepth(state) {
  const room = currentRoom(state);
  return room?.depth ?? 0;
}

export function nearestInteractable(state, options = {}) {
  const radius = options.radius ?? 0.18;
  const room = currentRoom(state);
  if (!room) return null;
  const pack = nearestPack(state, state.player.x, state.player.y, radius);
  if (pack) {
    return {
      kind: 'pack',
      id: pack.id,
      x: pack.x,
      y: pack.y,
      title: { ru: 'Рюкзак', en: 'Backpack' },
      pack,
    };
  }
  if (room.kind === 'find' && room.take && !room.take.taken) {
    return {
      kind: 'item',
      id: room.take.itemId,
      x: 0.5,
      y: 0.5,
      title: { ru: 'Обломок мела', en: 'Chalk shard' },
    };
  }
  if (room.kind === 'story' && !state.flags.trialCleared) {
    return {
      kind: 'trial',
      id: 'trial',
      x: 0.5,
      y: 0.5,
      title: { ru: 'Дрожащий свет', en: 'Shivering light' },
    };
  }
  if (room.kind === 'tablet' && Math.hypot(state.player.x - 0.5, state.player.y - 0.5) < radius) {
    return {
      kind: 'tablet',
      id: 'tablet',
      x: 0.5,
      y: 0.5,
      title: { ru: 'Скрижаль', en: 'Tablet' },
    };
  }
  return null;
}

// ---------------------------------------------------------------------------
// Doors and movement

export function doorCenter(door) {
  if (!door) return 0.5;
  return door.offset + door.width / 2;
}

export function doorContains(door, coordinate, tolerance = 0.028) {
  if (!door) return Math.abs(coordinate - 0.5) <= 0.11 + tolerance;
  return coordinate >= door.offset - tolerance && coordinate <= door.offset + door.width + tolerance;
}

export function doorSpanFor(room, side) {
  const door = room?.doors?.[side];
  if (!door) return defaultDoor();
  return door;
}

export function exitAt(state, margin = 0.025) {
  const room = currentRoom(state);
  if (!room) return null;
  const { x, y } = state.player;
  if (y <= margin && room.exits.north && doorContains(room.doors.north, x)) {
    return { side: 'north', roomId: room.exits.north };
  }
  if (y >= 1 - margin && room.exits.south && doorContains(room.doors.south, x)) {
    return { side: 'south', roomId: room.exits.south };
  }
  if (x <= margin && room.exits.west && doorContains(room.doors.west, y)) {
    return { side: 'west', roomId: room.exits.west };
  }
  if (x >= 1 - margin && room.exits.east && doorContains(room.doors.east, y)) {
    return { side: 'east', roomId: room.exits.east };
  }
  return null;
}

export function spawnPointForEntry(side, room = null) {
  const entrySide = OPPOSITE_SIDE[side] || side;
  const door = doorSpanFor(room, entrySide);
  const center = doorCenter(door);
  switch (side) {
    case 'north':
      return { x: center, y: 0.9, facing: 'up' };
    case 'south':
      return { x: center, y: 0.1, facing: 'down' };
    case 'east':
      return { x: 0.1, y: center, facing: 'right' };
    case 'west':
      return { x: 0.9, y: center, facing: 'left' };
    default:
      return { x: 0.5, y: 0.58, facing: 'down' };
  }
}
