import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DIRS,
  SAVE_VERSION,
  addInventoryItem,
  canvasPalette,
  createInitialState,
  currentRoom,
  dangerPosition,
  dropBackpack,
  elementAvailable,
  exitAt,
  generateLabyrinth,
  hasItem,
  makeCanvasElement,
  markRoomVisited,
  nearestInteractable,
  nearestPack,
  normalizeState,
  pickupBackpack,
  spawnPointForEntry,
} from '../east-core.js';
import { BUILTIN_COMMANDS, ITEM_DEFS, TRIAL } from '../east-data.js';

const OPPOSITE = Object.fromEntries(DIRS.map((dir) => [dir.id, dir.opposite]));

const DEFINITIONS = { builtinCommands: BUILTIN_COMMANDS, items: ITEM_DEFS };

test('generation is deterministic per seed and satisfies the story layout', () => {
  for (const seed of [1, 7, 42, 2026, 'east']) {
    const first = generateLabyrinth(seed);
    const second = generateLabyrinth(seed);
    assert.equal(first.seed, second.seed);
    assert.deepEqual(Object.keys(first.rooms).sort(), Object.keys(second.rooms).sort());

    const rooms = Object.values(first.rooms);
    assert.ok(rooms.length >= 7, `seed ${seed} produced ${rooms.length} rooms`);
    assert.ok(first.rooms[first.startId], 'tablet room must exist');
    assert.equal(first.rooms[first.startId].kind, 'tablet');
    assert.ok(first.rooms[first.storyId], 'story room must exist');
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
      }
    }
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
  for (const room of Object.values(state.rooms)) delete room.visited;

  const repaired = normalizeState(state);
  assert.ok(repaired);
  assert.deepEqual(repaired.inventory, []);
  assert.deepEqual(repaired.packs, []);
  assert.equal(repaired.settings.sound, true);
  assert.equal(repaired.flags.trialCleared, false);
  for (const room of Object.values(repaired.rooms)) {
    assert.equal(room.visited, false);
    assert.equal(room.chalkMarked, false);
  }
});

test('danger shadow stays in the playable corridor', () => {
  const labyrinth = generateLabyrinth(321);
  const danger = labyrinth.rooms[labyrinth.dangerId];
  for (let time = 0; time < 30; time += 0.4) {
    const position = dangerPosition(danger, time);
    assert.ok(position.x > 0 && position.x < 1);
    assert.ok(position.y > 0.1 && position.y < 0.9);
    assert.ok(position.radius > 0);
  }
});

test('canvas palette reflects inventory and elements stay addressable', () => {
  const state = createInitialState(17);
  const emptyPalette = canvasPalette(state, DEFINITIONS);
  assert.equal(emptyPalette.length, BUILTIN_COMMANDS.length);

  addInventoryItem(state, 'chalk');
  addInventoryItem(state, 'charm');
  const palette = canvasPalette(state, DEFINITIONS);
  assert.equal(palette.length, BUILTIN_COMMANDS.length + 2);
  const charm = palette.find((item) => item.sourceId === 'charm');
  assert.equal(charm.sourceType, 'card');

  const look = palette.find((item) => item.id === 'look');
  const element = makeCanvasElement(state, look, { x: 0.4, y: 0.6 });
  const card = makeCanvasElement(state, charm);
  assert.equal(element.id, 'canvas_0');
  assert.equal(card.id, 'canvas_1');
  assert.deepEqual([element.x, element.y], [0.4, 0.6]);
  assert.equal(elementAvailable(state, element), true);
  assert.equal(elementAvailable(state, card), true);

  state.inventory = [];
  assert.equal(elementAvailable(state, card), false);
});

test('interactions and exits use coherent coordinates', () => {
  const state = createInitialState(5);
  state.player = { x: 0.5, y: 0.5, facing: 'up' };
  const tablet = nearestInteractable(state, { radius: 0.2 });
  assert.equal(tablet.kind, 'tablet');

  state.player = { x: 0.5, y: 0.01, facing: 'up' };
  const north = state.rooms[state.currentRoomId].exits.north;
  if (north) {
    assert.equal(exitAt(state, 0.03).side, 'north');
  }
  const spawn = spawnPointForEntry('north');
  assert.deepEqual(spawn, { x: 0.5, y: 0.9, facing: 'up' });
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
  assert.ok(charm.note.toLowerCase().includes('заглушка'));
  assert.equal(hasItem({ inventory: ['charm'] }, 'charm'), true);
});
