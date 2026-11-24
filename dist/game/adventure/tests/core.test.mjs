import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DIRS,
  FIRST_STORY_CHANCE,
  SAVE_VERSION,
  WALL_TILES,
  addCanvasLink,
  addInventoryItem,
  availableCommands,
  canvasPalette,
  commandUnlocked,
  createInitialState,
  currentRoom,
  dangerPosition,
  doorCenter,
  dropBackpack,
  elementAvailable,
  exitAt,
  generateLabyrinth,
  hasItem,
  makeCanvasElement,
  markRoomVisited,
  nearestInteractable,
  nearestPack,
  normalizeSettings,
  normalizeState,
  pickupBackpack,
  removeCanvasElement,
  spawnPointForEntry,
} from '../east-core.js';
import { BUILTIN_COMMANDS, COMMANDS, ITEM_DEFS, TRIAL } from '../east-data.js';
import { pick, setLanguage, t } from '../east-i18n.js';

const OPPOSITE = Object.fromEntries(DIRS.map((dir) => [dir.id, dir.opposite]));

const DEFINITIONS = { builtinCommands: BUILTIN_COMMANDS, items: ITEM_DEFS };

test('generation is deterministic per seed and satisfies the story layout', () => {
  for (const seed of [1, 7, 42, 2026, 'east']) {
    const options = { forceStory: true };
    const first = generateLabyrinth(seed, options);
    const second = generateLabyrinth(seed, options);
    assert.equal(first.seed, second.seed);
    assert.deepEqual(Object.keys(first.rooms).sort(), Object.keys(second.rooms).sort());

    const rooms = Object.values(first.rooms);
    assert.ok(rooms.length >= 7, `seed ${seed} produced ${rooms.length} rooms`);
    assert.ok(first.rooms[first.startId], 'tablet room must exist');
    assert.equal(first.rooms[first.startId].kind, 'tablet');
    assert.ok(first.rooms[first.storyId], 'story room must exist when forced');
    assert.equal(first.rooms[first.storyId].kind, 'story');
    assert.equal(first.rooms[first.storyId].trial, true);
    assert.ok(first.rooms[first.dangerId], 'danger room must exist');
    assert.equal(first.rooms[first.dangerId].kind, 'danger');
    assert.ok(first.rooms[first.dangerId].threat, 'danger room needs a hazard');
    assert.ok(first.rooms[first.findId], 'find room must exist');
    assert.equal(first.rooms[first.findId].take.itemId, 'chalk');
    assert.ok(first.rooms[first.storyId].depth >= 3, 'story must be at depth 3 or deeper');

    for (const room of rooms) {
      for (const [side, targetId] of Object.entries(room.exits)) {
        const target = first.rooms[targetId];
        assert.ok(target, `${room.id}.${side} points to a missing room`);
        assert.equal(target.exits[OPPOSITE[side]], room.id, 'exits must be symmetric');

        const door = room.doors[side];
        const mirrored = target.doors[OPPOSITE[side]];
        assert.ok(door, `${room.id}.${side} needs door metadata`);
        assert.deepEqual(mirrored, door, 'both sides of a door must match');
        assert.equal(door.width, door.tiles / WALL_TILES);
        assert.ok(door.tiles >= 1 && door.tiles <= 12, 'door width spans 1..12 tiles');
        assert.ok(door.offset >= 0 && door.offset + door.width <= 1 + 1e-9);
      }
    }
  }
});

test('the first story room appears with a 25% generation chance', () => {
  assert.equal(FIRST_STORY_CHANCE, 0.25);

  for (const seed of [1, 7, 42, 2026, 'east']) {
    const withoutStory = generateLabyrinth(seed, { forceStory: false });
    assert.equal(withoutStory.storyId, null);
    assert.equal(
      Object.values(withoutStory.rooms).some((room) => room.kind === 'story'),
      false,
    );

    const forced = generateLabyrinth(seed, { forceStory: true, storyChance: 0 });
    assert.ok(forced.storyId);
  }

  // A chance of 0 must never place a story room; 1 must always place one.
  for (const seed of [3, 11, 29]) {
    assert.equal(generateLabyrinth(seed, { storyChance: 0 }).storyId, null);
    assert.ok(generateLabyrinth(seed, { storyChance: 1 }).storyId);
  }
});

test('initial state starts Zemic at the tablet with an empty backpack', () => {
  const state = createInitialState(12345);
  assert.equal(state.version, SAVE_VERSION);
  assert.equal(state.currentRoomId, state.map.startId);
  assert.equal(currentRoom(state).kind, 'tablet');
  assert.deepEqual(state.inventory, []);
  assert.deepEqual(state.packs, []);
  assert.equal(state.flags.trialCleared, false);
  assert.equal(state.flags.introSeen, false);
  assert.equal(state.settings.sound, true);
  assert.equal(state.settings.language, 'ru');
  assert.equal(state.settings.autocomplete, true);
  assert.equal(state.settings.walkSeconds, 1);
  assert.equal(state.settings.cursorControl, true);
  assert.equal(state.settings.musicVolume, 0.8);
  for (const source of ['command', 'terminal', 'system', 'world', 'action', 'error', 'echo']) {
    assert.equal(state.settings.logSources[source], true);
  }
});

test('death drops a new backpack and never deletes older ones', () => {
  const state = createInitialState(99);
  const room = currentRoom(state);
  addInventoryItem(state, 'chalk');
  const first = dropBackpack(state, { roomId: room.id, x: 0.2, y: 0.3, cause: 'danger' });
  assert.deepEqual(first.items, ['chalk']);
  assert.deepEqual(state.inventory, []);
  assert.equal(state.packs.length, 1);
  assert.equal(state.stats.deaths, 1);

  addInventoryItem(state, 'chalk');
  const second = dropBackpack(state, { roomId: room.id, x: 0.6, y: 0.7, cause: 'trial' });
  assert.equal(state.packs.length, 2);
  assert.equal(state.packs[0].id, first.id);
  assert.equal(state.packs[1].id, second.id);
  assert.equal(state.stats.deaths, 2);
  assert.equal(new Set(state.packs.map((pack) => pack.id)).size, 2);

  const near = nearestPack(state, 0.21, 0.29, 0.1);
  assert.equal(near.id, first.id);
  const picked = pickupBackpack(state, first.id);
  assert.equal(picked.ok, true);
  assert.deepEqual(state.inventory, ['chalk']);
  assert.equal(state.packs.length, 1);
  assert.equal(state.packs[0].id, second.id);
});

test('normalizeState rejects foreign saves and repairs optional fields', () => {
  assert.equal(normalizeState(null), null);
  assert.equal(normalizeState({ version: 2 }), null);

  const state = createInitialState(8);
  state.version = SAVE_VERSION;
  delete state.inventory;
  delete state.packs;
  delete state.flags;
  delete state.settings;
  state.canvas = {
    elements: [{ id: 'old', title: { ru: 'Старая нода', en: 'Old node' }, x: 0.25, y: 0.5 }],
    links: [],
  };
  for (const room of Object.values(state.rooms)) delete room.visited;

  const repaired = normalizeState(state);
  assert.ok(repaired);
  assert.deepEqual(repaired.inventory, []);
  assert.deepEqual(repaired.packs, []);
  assert.equal(repaired.settings.sound, true);
  assert.equal(repaired.settings.language, 'ru');
  assert.equal(repaired.flags.trialCleared, false);
  for (const room of Object.values(repaired.rooms)) {
    assert.equal(room.visited, false);
    assert.equal(room.chalkMarked, false);
  }
  // Legacy 0..1 canvas coordinates migrate into the unbounded world.
  assert.equal(repaired.canvas.elements[0].x, 60 + 0.25 * 720);
  assert.equal(repaired.canvas.elements[0].y, 50 + 0.5 * 520);
});

test('normalizeSettings clamps values and preserves log source opt-outs', () => {
  assert.deepEqual(normalizeSettings({}), {
    sound: true,
    language: 'ru',
    autocomplete: true,
    walkSeconds: 1,
    cursorControl: true,
    musicVolume: 0.8,
    logSources: {
      command: true,
      terminal: true,
      system: true,
      world: true,
      action: true,
      error: true,
      echo: true,
    },
  });

  const custom = normalizeSettings({
    sound: false,
    language: 'en',
    autocomplete: false,
    walkSeconds: 999,
    cursorControl: false,
    musicVolume: -5,
    logSources: { system: false, error: false },
  });
  assert.equal(custom.sound, false);
  assert.equal(custom.language, 'en');
  assert.equal(custom.autocomplete, false);
  assert.equal(custom.walkSeconds, 30);
  assert.equal(custom.cursorControl, false);
  assert.equal(custom.musicVolume, 0);
  assert.equal(custom.logSources.command, true);
  assert.equal(custom.logSources.system, false);
  assert.equal(custom.logSources.error, false);
});

test('danger shadow stays in the playable corridor', () => {
  const labyrinth = generateLabyrinth(321, { forceStory: true });
  const danger = labyrinth.rooms[labyrinth.dangerId];
  for (let time = 0; time < 30; time += 0.4) {
    const position = dangerPosition(danger, time);
    assert.ok(position.x > 0 && position.x < 1);
    assert.ok(position.y > 0.1 && position.y < 0.9);
    assert.ok(position.radius > 0);
  }
});

test('locked commands stay out of help and the canvas palette', () => {
  const state = createInitialState(17);
  const initial = canvasPalette(state, DEFINITIONS);
  const initialIds = initial.map((item) => item.id);
  assert.equal(initialIds.includes('pack'), false, 'backpack stays hidden before introSeen');
  assert.equal(initialIds.includes('story'), false, 'story stays hidden before introSeen');
  assert.equal(
    initial.length,
    availableCommands(state, BUILTIN_COMMANDS).length,
  );

  state.flags.introSeen = true;
  const unlocked = canvasPalette(state, DEFINITIONS);
  const unlockedIds = unlocked.map((item) => item.id);
  assert.equal(unlockedIds.includes('pack'), true);
  assert.equal(unlockedIds.includes('story'), true);

  // Items and cards appear only once they are in the backpack.
  const chalk = COMMANDS.find((command) => command.id === 'chalk');
  const card = COMMANDS.find((command) => command.id === 'card');
  state.flags.seenCard = false;
  assert.equal(commandUnlocked(state, chalk), false);
  assert.equal(commandUnlocked(state, card), false);
  assert.equal(commandUnlocked(state, { unlock: 'has:charm' }), false);

  addInventoryItem(state, 'chalk');
  assert.equal(commandUnlocked(state, chalk), true);
  addInventoryItem(state, 'charm');
  state.flags.trialCleared = true;
  state.flags.seenCard = true;
  assert.equal(commandUnlocked(state, card), true);

  const withItems = canvasPalette(state, DEFINITIONS);
  const charm = withItems.find((item) => item.sourceId === 'charm');
  assert.equal(charm.sourceType, 'card');
});

test('canvas elements, links and availability stay addressable', () => {
  const state = createInitialState(17);
  state.flags.introSeen = true;
  addInventoryItem(state, 'chalk');
  addInventoryItem(state, 'charm');

  const palette = canvasPalette(state, DEFINITIONS);
  const look = palette.find((item) => item.id === 'look');
  const charm = palette.find((item) => item.sourceId === 'charm');
  const element = makeCanvasElement(state, look, { x: 0.4, y: 0.6 });
  const card = makeCanvasElement(state, charm);
  const first = makeCanvasElement(state, look, { x: 220, y: 180 });

  assert.equal(element.id, 'canvas_0');
  assert.equal(card.id, 'canvas_1');
  assert.deepEqual([element.x, element.y], [0.4, 0.6]);
  assert.equal(elementAvailable(state, element), true);
  assert.equal(elementAvailable(state, card), true);

  const link = addCanvasLink(state, element.id, card.id);
  assert.ok(link);
  assert.equal(addCanvasLink(state, element.id, card.id), null, 'duplicate links are rejected');

  state.inventory = [];
  assert.equal(elementAvailable(state, card), false);

  const removed = removeCanvasElement(state, card.id);
  assert.equal(removed.id, card.id);
  assert.equal(state.canvas.elements.includes(removed), false);
  assert.deepEqual(state.canvas.links, []);
  assert.ok(first.id);
});

test('interactions and doors use coherent coordinates', () => {
  const state = createInitialState(5);
  state.player = { x: 0.5, y: 0.5, facing: 'up' };
  const tablet = nearestInteractable(state, { radius: 0.2 });
  assert.equal(tablet.kind, 'tablet');

  const room = currentRoom(state);
  const side = Object.keys(room.exits).find((entry) => entry === 'north' || entry === 'south');
  if (side) {
    const door = room.doors[side];
    state.player = {
      x: doorCenter(door),
      y: side === 'north' ? 0.01 : 0.99,
      facing: side === 'north' ? 'up' : 'down',
    };
    assert.equal(exitAt(state, 0.03).side, side);
  }

  // Default door (no room given) is centred on the wall.
  assert.deepEqual(spawnPointForEntry('north'), { x: 0.5, y: 0.9, facing: 'up' });
  const offsetRoom = {
    exits: { south: 'x' },
    doors: { south: { offset: 0.5, width: 0.25, tiles: 4 } },
  };
  assert.deepEqual(spawnPointForEntry('north', offsetRoom), { x: 0.625, y: 0.9, facing: 'up' });
  assert.equal(markRoomVisited(state, state.currentRoomId), false);
});

test('trial config is a short rhythm pattern with fair hitboxes', () => {
  assert.ok(TRIAL.duration >= 12 && TRIAL.duration <= 30);
  assert.equal(TRIAL.beatSeconds, 60 / TRIAL.bpm);
  assert.ok(TRIAL.playerRadius > 0 && TRIAL.playerRadius < 0.03);
  assert.ok(TRIAL.bulletRadius > 0 && TRIAL.bulletRadius < 0.03);
  assert.ok(TRIAL.intro.paragraphs.length > 0);
  assert.ok(TRIAL.win.paragraphs.length > 0);
});

test('charm is exposed as a card with the read-only art route', () => {
  const charm = ITEM_DEFS.charm;
  assert.equal(charm.card, true);
  assert.equal(charm.art, '/asset/angel.webp');
  assert.ok(charm.artAlt.ru && charm.artAlt.en);
  assert.ok(charm.note.ru.toLowerCase().includes('заглушка'));
  assert.ok(charm.note.en.toLowerCase().includes('placeholder'));
  assert.equal(hasItem({ inventory: ['charm'] }, 'charm'), true);
});

test('bilingual content resolves through the i18n pick helper', () => {
  const value = { ru: 'Скрижаль', en: 'Tablet' };
  setLanguage('ru');
  assert.equal(pick(value), 'Скрижаль');
  assert.equal(t('boot.loaded', { ms: 12 }), 'Мир загружен за 12 мс.');

  setLanguage('en');
  assert.equal(pick(value), 'Tablet');
  assert.equal(t('terminal.placeholder'), 'Type a command and press send');
  assert.ok(t('history.header', { count: 2 }).includes('2'));

  setLanguage('ru');
  assert.equal(pick(value), 'Скрижаль');
});
