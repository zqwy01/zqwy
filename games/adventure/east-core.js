export const SAVE_VERSION = 1;

export const DIRS = Object.freeze([
  { id: 'north', label: 'север', short: 'С', dx: 0, dy: -1, opposite: 'south' },
  { id: 'south', label: 'юг', short: 'Ю', dx: 0, dy: 1, opposite: 'north' },
  { id: 'east', label: 'восток', short: 'В', dx: 1, dy: 0, opposite: 'west' },
  { id: 'west', label: 'запад', short: 'З', dx: -1, dy: 0, opposite: 'east' },
]);

const GENERIC_TITLES = [
  'Коридор без конца',
  'Комната слуха',
  'Зал повторений',
  'Низкий свод',
  'Поворот, которого не было',
  'Тихая развилка',
  'Слепой карман',
  'Петля',
  'Место, где стены близко',
  'Коридор с двойным дном',
];

const MOTIFS = ['loops', 'teeth', 'columns', 'stairs', 'eyes', 'spiral', 'echo'];

const OPPOSITE_SIDE = Object.fromEntries(DIRS.map((d) => [d.id, d.opposite]));
const SIDE_BY_VECTOR = new Map(DIRS.map((d) => [`${d.dx},${d.dy}`, d.id]));

export function roomIdFor(x, y) {
  return `r_${x}_${y}`;
}

export function hashString(text) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
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
    title: 'Комната',
    subtitle: '',
    manual: false,
    motif: 'loops',
    musicId: 'labyrinth',
    exits: {},
    visited: false,
    threat: null,
    take: null,
    trial: false,
    chalkMarked: false,
    depth: 0,
  };
}

function link(a, b, side) {
  a.exits[side] = b.id;
  b.exits[OPPOSITE_SIDE[side]] = a.id;
}

function buildGraph(seed, maxRooms = 8) {
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
      if (Math.abs(nx) > 2 || Math.abs(ny) > 2) return false;
      if (Math.abs(nx) + Math.abs(ny) > 3) return false;
      return !rooms[roomIdFor(nx, ny)];
    });

    if (candidates.length === 0) {
      stack.pop();
      continue;
    }

    const dir = candidates[0];
    const next = makeRoom(current.x + dir.dx, current.y + dir.dy);
    next.motif = MOTIFS[Math.floor(random() * MOTIFS.length)];
    rooms[next.id] = next;
    link(current, next, dir.id);
    stack.push(next);
  }

  return { rooms, startId: start.id, random };
}

function attachGeneratedDetails(rooms, startId, random) {
  const { distance, parent } = bfs(rooms, startId);
  const maxDepth = Math.max(...distance.values());
  if (maxDepth < 3) return null;

  const all = Object.values(rooms);
  const deepRooms = all.filter((room) => distance.get(room.id) === 3);
  const story = (deepRooms.length > 0 ? deepRooms : all)
    .slice()
    .sort((a, b) => distance.get(b.id) - distance.get(a.id))[0];
  if (!story) return null;

  const path = pathTo(parent, startId, story.id);
  if (path.length < 4) return null;

  const dangerId = path[Math.min(1, path.length - 2)];
  const findCandidates = all
    .filter((room) => room.id !== startId && room.id !== story.id && room.id !== dangerId)
    .sort((a, b) => distance.get(b.id) - distance.get(a.id));
  const find = findCandidates[0] || null;

  const generic = shuffled(all.filter((room) => room.id !== startId), random);
  const titles = shuffled(GENERIC_TITLES, random);
  let titleIndex = 0;

  for (const room of all) {
    room.depth = distance.get(room.id) ?? 0;
    room.musicId = 'labyrinth';
    if (room.id === startId) {
      room.kind = 'tablet';
      room.title = 'Скрижаль';
      room.subtitle = 'точка возвращения';
      room.manual = true;
      room.musicId = 'tablet';
      room.visited = true;
      room.motif = 'tablet';
    }
  }

  story.kind = 'story';
  story.title = 'Комната дрожащего света';
  story.subtitle = 'сюжетная комната';
  story.manual = true;
  story.musicId = 'trial';
  story.motif = 'trial';
  story.trial = true;

  const danger = rooms[dangerId];
  danger.kind = 'danger';
  danger.title = 'Коридор, который дышит';
  danger.subtitle = 'опасный переход';
  danger.manual = true;
  danger.musicId = 'labyrinth';
  danger.motif = 'breath';
  danger.threat = {
    type: 'sweep',
    period: 7.2,
    radius: 0.1,
    phase: (hashString(danger.id) % 1000) / 1000,
  };

  if (find) {
    find.kind = 'find';
    find.title = 'Кладовая пыли';
    find.subtitle = 'находка';
    find.motif = 'columns';
    find.take = { itemId: 'chalk', taken: false };
  }

  for (const room of generic) {
    if (room.kind !== 'generic') continue;
    room.title = titles[titleIndex % titles.length];
    titleIndex += 1;
    room.subtitle = distance.get(room.id) > 2 ? 'глубже' : 'переход';
    room.musicId = distance.get(room.id) > 2 ? 'deep' : 'labyrinth';
  }

  return { rooms, startId, storyId: story.id, dangerId, findId: find?.id ?? null };
}

function fallbackLabyrinth(seed) {
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
  ];
  const rooms = {};
  for (const [x, y, kind] of layout) {
    const room = makeRoom(x, y, kind);
    rooms[room.id] = room;
  }
  for (const room of Object.values(rooms)) {
    for (const dir of DIRS) {
      const other = rooms[roomIdFor(room.x + dir.dx, room.y + dir.dy)];
      if (other) room.exits[dir.id] = other.id;
    }
  }
  const startId = roomIdFor(0, 0);
  const story = rooms[roomIdFor(-1, 1)];
  story.kind = 'story';
  story.title = 'Комната дрожащего света';
  story.manual = true;
  story.trial = true;
  story.motif = 'trial';
  story.musicId = 'trial';
  const danger = rooms[roomIdFor(0, 1)];
  danger.kind = 'danger';
  danger.title = 'Коридор, который дышит';
  danger.manual = true;
  danger.motif = 'breath';
  danger.threat = { type: 'sweep', period: 7.2, radius: 0.1, phase: 0.31 };
  const find = rooms[roomIdFor(0, -1)];
  find.kind = 'find';
  find.title = 'Кладовая пыли';
  find.take = { itemId: 'chalk', taken: false };
  const generated = attachGeneratedDetails(rooms, startId, mulberry32(seed));
  return generated || {
    rooms,
    startId,
    storyId: story.id,
    dangerId: danger.id,
    findId: find.id,
  };
}

export function generateLabyrinth(seed) {
  const numericSeed = Number.isFinite(Number(seed)) ? Number(seed) >>> 0 : hashString(String(seed));
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const attemptSeed = (numericSeed + attempt * 104729) >>> 0;
    const graph = buildGraph(attemptSeed);
    const detailed = attachGeneratedDetails(graph.rooms, graph.startId, graph.random);
    if (detailed) {
      return { ...detailed, seed: attemptSeed };
    }
  }
  return { ...fallbackLabyrinth(numericSeed), seed: numericSeed };
}

export function createInitialState(seed = Date.now()) {
  const labyrinth = generateLabyrinth(seed);
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
    canvas: { elements: [] },
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
  state.canvas = state.canvas && Array.isArray(state.canvas.elements)
    ? state.canvas
    : { elements: [] };
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
  state.settings = { sound: state.settings?.sound !== false };
  state.map = state.map || {};

  for (const room of Object.values(state.rooms)) {
    room.exits = room.exits && typeof room.exits === 'object' ? room.exits : {};
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

export function canvasPalette(state, definitions) {
  const source = [];
  for (const command of definitions.builtinCommands) {
    source.push({ sourceType: 'command', ...command });
  }
  for (const itemId of state.inventory) {
    const item = definitions.items[itemId];
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
    sourceType: descriptor.sourceType,
    sourceId: descriptor.sourceId || descriptor.id || descriptor.command,
    title: descriptor.title,
    command: descriptor.command,
    actionLabel: descriptor.actionLabel || 'Выполнить',
    icon: descriptor.icon || '·',
    steps: Array.isArray(descriptor.steps) && descriptor.steps.length
      ? [...descriptor.steps]
      : [descriptor.command],
    x: 0.12 + (index % 4) * 0.2,
    y: 0.12 + (index % 3) * 0.2,
    ...overrides,
  };
  state.canvasSeq += 1;
  state.canvas.elements.push(element);
  return element;
}

export function elementAvailable(state, element) {
  if (!element) return false;
  if (element.sourceType === 'item' || element.sourceType === 'card') {
    return hasItem(state, element.sourceId);
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
    return { kind: 'pack', id: pack.id, x: pack.x, y: pack.y, title: 'Рюкзак', pack };
  }
  if (room.kind === 'find' && room.take && !room.take.taken) {
    return { kind: 'item', id: room.take.itemId, x: 0.5, y: 0.5, title: 'Обломок мела' };
  }
  if (room.kind === 'story' && !state.flags.trialCleared) {
    return { kind: 'trial', id: 'trial', x: 0.5, y: 0.5, title: 'Дрожащий свет' };
  }
  if (room.kind === 'tablet' && Math.hypot(state.player.x - 0.5, state.player.y - 0.5) < radius) {
    return { kind: 'tablet', id: 'tablet', x: 0.5, y: 0.5, title: 'Скрижаль' };
  }
  return null;
}

export function exitAt(state, margin = 0.025) {
  const room = currentRoom(state);
  if (!room) return null;
  const { x, y } = state.player;
  if (y <= margin && room.exits.north) return { side: 'north', roomId: room.exits.north };
  if (y >= 1 - margin && room.exits.south) return { side: 'south', roomId: room.exits.south };
  if (x <= margin && room.exits.west) return { side: 'west', roomId: room.exits.west };
  if (x >= 1 - margin && room.exits.east) return { side: 'east', roomId: room.exits.east };
  return null;
}

export function spawnPointForEntry(side) {
  switch (side) {
    case 'north':
      return { x: 0.5, y: 0.9, facing: 'up' };
    case 'south':
      return { x: 0.5, y: 0.1, facing: 'down' };
    case 'east':
      return { x: 0.1, y: 0.5, facing: 'right' };
    case 'west':
      return { x: 0.9, y: 0.5, facing: 'left' };
    default:
      return { x: 0.5, y: 0.58, facing: 'down' };
  }
}
