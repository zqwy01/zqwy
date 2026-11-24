'use strict';

/* Проверка патчей на живой игре.
   Запуск: node scripts/tests/run.js
   Нужен Chrome с --remote-debugging-port=9222 (или CDP_PORT).
   Статическая раздача поднимается автоматически на 127.0.0.1:8011
   из корня files/, чтобы работали и rhythm_catalog, и src/tracks. */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { Page, sleep } = require('./cdp');

const ROOT = path.resolve(__dirname, '..', '..');
/* Сервер поднимается над корнем files/, как при обычной публикации:
   так zqwy видит ../rhythm_catalog/, а ритм-каталог — общий архив
   ../../src/tracks/ со звуком. */
const FILES_ROOT = path.resolve(ROOT, '..', '..');
const PORT = Number(process.env.TEST_PORT || 8011);
const BASE_URL = process.env.BASE_URL || `http://127.0.0.1:${PORT}/games/zqwy/`;
const STATUS_PATH = path.join(ROOT, 'PATCH_STATUS.md');
const JSON_PATH = path.join(__dirname, 'last-run.json');

function log(message) {
  process.stdout.write(`${message}\n`);
}

async function waitForHttp(url, timeout) {
  const deadline = Date.now() + (timeout || 10000);
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url, { method: 'HEAD' });
      if (res.ok) return true;
    } catch (error) {
      /* сервер ещё не поднялся */
    }
    await sleep(200);
  }
  return false;
}

async function startServer() {
  if (await waitForHttp(BASE_URL, 800)) return null;
  const child = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], {
    cwd: FILES_ROOT,
    stdio: 'ignore'
  });
  const ok = await waitForHttp(BASE_URL, 8000);
  if (!ok) {
    child.kill();
    throw new Error(`Не удалось поднять статический сервер на ${BASE_URL}`);
  }
  return child;
}

async function reset(page) {
  await page.eval(`(() => {
    /* Язык хранится в localStorage профиля Chrome, поэтому прогон
       принудительно возвращается к русскому: иначе проверки строк
       зависят от того, что осталось после ручной проверки. */
    if (window.ZQI18N && typeof window.ZQI18N.apply === 'function') {
      window.ZQI18N.apply('ru');
    }
    ZQ.startNewGame();
    ZQ.setTerminalView('main');
    return true;
  })()`);
  await sleep(150);
}

async function openInventory(page) {
  await page.eval(`(() => {
    const state = ZQ.rt.state;
    state.items = ['music_player', 'backpack', 'map_fragment', 'chalk', 'bead', 'card_angel', 'umbrella'];
    state.itemLocations = {};
    state.unlocks = { backpack: true, map: true, table: true, cards: true };
    if (typeof ZQ.rebalanceItemLocations === 'function') ZQ.rebalanceItemLocations();
    ZQ.renderInventory();
    ZQ.openInventory();
    return true;
  })()`);
  await sleep(300);
}

function check(ok, detail, metrics) {
  return {
    status: ok ? 'pass' : 'fail',
    detail,
    metrics: metrics || null
  };
}

const TESTS = [];

function test(id, patch, title, run) {
  TESTS.push({ id, patch, title, run });
}

/* ----------------------------- Патч 1 ----------------------------- */

test('patch1.camera-centered', 1, 'Камера строго центрирована на игроке', async (page) => {
  await page.setViewport(1600, 900);
  await reset(page);
  const out = await page.eval(`(() => {
    const p = ZQ.rt.state.player;
    p.x += 3.25;
    p.y -= 2.75;
    ZQ.updateCamera();
    const c = ZQ.rt.state.camera;
    return { px: p.x, py: p.y, cx: c.x, cy: c.y, dx: Math.abs(p.x - c.x), dy: Math.abs(p.y - c.y) };
  })()`);
  return check(out.dx < 1e-9 && out.dy < 1e-9,
    `камера (${out.cx.toFixed(3)}, ${out.cy.toFixed(3)}) против игрока (${out.px.toFixed(3)}, ${out.py.toFixed(3)})`,
    out);
});

test('patch1.divider-drag', 1, 'Разделитель игры и терминала двигается', async (page) => {
  await page.setViewport(1600, 900);
  await reset(page);
  const before = await page.eval(`(() => {
    const d = document.querySelector('#divider');
    const r = d.getBoundingClientRect();
    return { ratio: ZQ.rt.splitRatio, x: r.left + r.width / 2, y: r.top + r.height / 2 };
  })()`);
  await page.drag(before.x, before.y, before.x, before.y + 140);
  const after = await page.eval(`({ ratio: ZQ.rt.splitRatio, rows: getComputedStyle(document.querySelector('#app')).gridTemplateRows })`);
  const delta = Math.abs(after.ratio - before.ratio);
  return check(delta > 0.02,
    `доля терминала ${before.ratio.toFixed(3)} → ${after.ratio.toFixed(3)}; строки: ${after.rows}`,
    { before: before.ratio, after: after.ratio, delta });
});

test('patch1.battle-hud-in-upper-area', 1, 'Во время боя в верхней области нет текста и кнопок', async (page) => {
  await page.setViewport(1600, 900);
  await reset(page);
  const out = await page.eval(`(() => {
    const started = ZQ.startBattle('beetle');
    const el = document.querySelector('#battle-stage');
    const result = {
      started,
      visible: Boolean(el && !el.classList.contains('hidden')),
      text: el ? el.innerText.replace(/\\s+/g, ' ').trim() : '',
      buttons: el ? [...el.querySelectorAll('button')].map((b) => b.textContent.trim()).filter(Boolean) : []
    };
    ZQ.rt.battle = null;
    ZQ.hideBattleStage();
    return result;
  })()`);
  const ok = out.started && out.visible && out.text === '' && out.buttons.length === 0;
  return check(ok,
    out.started
      ? `видимый HUD: «${out.text.slice(0, 120)}»; кнопки: ${out.buttons.join(' / ') || 'нет'}`
      : 'не удалось начать бой',
    out);
});

test('patch1.chase-hud-in-upper-area', 1, 'Во время погони в верхней области нет текста и кнопок', async (page) => {
  await page.setViewport(1600, 900);
  await reset(page);
  const out = await page.eval(`(() => {
    const w = ZQ.rt.world;
    for (let cy = -1; cy <= 1; cy += 1) {
      for (let cx = 0; cx <= 5; cx += 1) {
        try { w.ensureChunk(cx, cy); } catch (error) { /* край мира */ }
      }
    }
    const room = (w.rooms || []).find((r) => r.role === 'titanoboa');
    if (!room) return { error: 'no room' };
    ZQ.rt.state.player.x = room.centerX + 0.5;
    ZQ.rt.state.player.y = room.centerY + 0.5;
    ZQ.rt.state.currentRoomId = room.id;
    const started = ZQ.startChase(room);
    const el = document.querySelector('#chase-stage');
    const result = {
      started,
      visible: Boolean(el && !el.classList.contains('hidden')),
      text: el ? el.innerText.replace(/\\s+/g, ' ').trim() : '',
      buttons: el ? [...el.querySelectorAll('button')].map((b) => b.textContent.trim()).filter(Boolean) : []
    };
    ZQ.rt.chase = null;
    ZQ.hideChaseStage();
    return result;
  })()`);
  if (out.error) return check(false, `не удалось начать погоню: ${out.error}`, out);
  const ok = out.started && out.visible && out.text === '' && out.buttons.length === 0;
  return check(ok,
    `видимый HUD: «${out.text.slice(0, 120)}»; кнопки: ${out.buttons.join(' / ') || 'нет'}`,
    out);
});

/* ----------------------------- Патч 4 ----------------------------- */

test('patch4.dust-world-space', 4, 'Пылинки живут в мировых координатах, а не приклеены к камере', async (page) => {
  await page.setViewport(1600, 900);
  await reset(page);
  const out = await page.eval(`(() => {
    const a = Renderer.dustMotes({ view: { w: 800, h: 600 }, now: 0, cam: { x: 0, y: 0 }, ts: 30 });
    const b = Renderer.dustMotes({ view: { w: 800, h: 600 }, now: 0, cam: { x: 2, y: 0 }, ts: 30 });
    const mote = a.find((m) => m.wx > 3);
    if (!mote) return { error: 'no mote' };
    const same = b.find((m) => Math.abs(m.wx - mote.wx) < 1e-6 && Math.abs(m.wy - mote.wy) < 1e-6);
    if (!same) return { error: 'no overlapping mote' };
    const screenA = 400 + (mote.wx - 0) * 30;
    const screenB = 400 + (same.wx - 2) * 30;
    return { wx: mote.wx, wy: mote.wy, screenA, screenB, delta: screenB - screenA };
  })()`);
  if (out.error) return check(false, out.error, out);
  const ok = Math.abs(out.delta + 60) < 1e-6;
  return check(ok,
    `мировая точка (${out.wx.toFixed(2)}, ${out.wy.toFixed(2)}) сместилась по экрану на ${out.delta.toFixed(2)} px при сдвиге камеры на 2 тайла`,
    out);
});

/* ----------------------------- Патч 5 ----------------------------- */

test('patch5.corridor-width-max', 5, 'Проходы генерируются шириной до 12 тайлов', async (page) => {
  const out = await page.eval(`({
    min: ZQ.C.world.corridorMin,
    max: ZQ.C.world.corridorMax,
    comment: 'Ширина прохода в тайлах'
  })`);
  const ok = out.min === 1 && out.max >= 12;
  return check(ok, `фактически corridorMin=${out.min}, corridorMax=${out.max}, требуется 1…12`, out);
});

test('patch5.table-key-click-adds', 5, 'Клик по клавише на столе добавляет её на стол', async (page) => {
  await page.setViewport(1600, 900);
  await reset(page);
  await page.eval(`ZQ.openCanvas()`);
  await sleep(250);
  const out = await page.eval(`(() => {
    const key = [...document.querySelectorAll('.kb-key')].find((b) => !b.classList.contains('placed'));
    if (!key) return { error: 'no unplaced key' };
    const before = document.querySelectorAll('#canvas-elements .cv-el').length;
    key.click();
    const after = document.querySelectorAll('#canvas-elements .cv-el').length;
    return { code: key.dataset.code, label: key.textContent.trim(), before, after };
  })()`);
  if (out.error) return check(false, out.error, out);
  const ok = out.after === out.before + 1;
  return check(ok, `клавиша ${out.label} (${out.code}): элементов стола ${out.before} → ${out.after}`, out);
});

/* ----------------------------- Патч 7 ----------------------------- */

test('patch7.terminal-one-font-size', 7, 'В терминале один размер шрифта для системных и обычных строк', async (page) => {
  await page.setViewport(1600, 900);
  await reset(page);
  const out = await page.eval(`(() => {
    ZQ.setTerminalView('main');
    ZQ.appendLog('SYS-FONT-TEST', 'sys', true);
    ZQ.appendLog('REPLY-FONT-TEST', 'reply', true);
    const lines = [...document.querySelectorAll('.log-line')].slice(-2).map((line) => ({
      cls: line.className,
      text: line.textContent.trim(),
      size: getComputedStyle(line).fontSize
    }));
    return lines;
  })()`);
  const sizes = [...new Set(out.map((line) => line.size))];
  const ok = out.length === 2 && sizes.length === 1;
  return check(ok,
    out.map((line) => `${line.cls}: ${line.size}`).join('; '),
    { lines: out, sizes });
});

test('patch7.umbrella-cooldown-15', 7, 'Перезарядка зонта 15 секунд', async (page) => {
  const out = await page.eval(`({
    battle: ZQ.C.battle.reflectCooldown,
    item: ZQ.C.items.umbrella ? ZQ.C.items.umbrella.reflectCooldown : null
  })`);
  const ok = out.battle === 15 && out.item === 15;
  return check(ok, `C.battle.reflectCooldown=${out.battle}, C.items.umbrella.reflectCooldown=${out.item}, требуется 15`, out);
});

/* ----------------------------- Патч 8 ----------------------------- */

test('patch8.battle-in-world', 8, 'Бой идёт в мире и реально обновляется', async (page) => {
  await page.setViewport(1600, 900);
  await reset(page);
  const out = await page.eval(`(() => {
    const started = ZQ.startBattle('beetle');
    if (!started) return { error: 'startBattle false' };
    const battle = ZQ.rt.battle;
    const inWorld = battle.world === ZQ.rt.world;
    const samePlayer = battle.player === ZQ.rt.state.player;
    const hud = document.querySelector('#battle-stage');
    for (let i = 0; i < 180; i += 1) ZQ.updateBattle(1 / 60);
    const result = {
      started,
      inWorld,
      samePlayer,
      active: battle.active,
      elapsed: battle.elapsed,
      bullets: battle.bullets.length,
      hudVisible: Boolean(hud && !hud.classList.contains('hidden')),
      scale: battle.world === ZQ.rt.world ? 'world' : 'other'
    };
    battle.active = false;
    ZQ.rt.battle = null;
    ZQ.hideBattleStage();
    return result;
  })()`);
  if (out.error) return check(false, out.error, out);
  const ok = out.started && out.inWorld && out.samePlayer && out.active && out.elapsed > 1 && out.bullets > 0;
  return check(ok,
    `мир=${out.inWorld}, тот же игрок=${out.samePlayer}, прошло ${out.elapsed.toFixed(2)} с, снарядов ${out.bullets}, HUD=${out.hudVisible}`,
    out);
});

/* ----------------------------- Патч 9 ----------------------------- */

test('patch9.inventory-capacity-icons', 9, 'Ёмкость инвентаря показана иконками, а не текстом', async (page) => {
  await page.setViewport(1600, 900);
  await reset(page);
  await openInventory(page);
  const out = await page.eval(`(() => {
    const cap = document.querySelector('#inventory-capacity');
    const text = cap ? cap.textContent.trim() : '';
    return {
      text,
      isTextFraction: /\\d+\\s*\\/\\s*\\d+/.test(text),
      capacityIcons: document.querySelectorAll('.capacity-icon, .inventory-capacity-icon').length,
      slots: document.querySelectorAll('#inventory-slots .inventory-slot').length
    };
  })()`);
  const ok = !out.isTextFraction && out.capacityIcons >= 2;
  return check(ok,
    `текст ёмкости: «${out.text}»; иконок ёмкости: ${out.capacityIcons}; слотов: ${out.slots}`,
    out);
});

/* ----------------------------- Патч 11 ---------------------------- */

test('patch11.titanoboa-chase-moves', 11, 'Титанобоа реально ползёт за игроком, а не стоит на месте', async (page) => {
  await page.setViewport(1600, 900);
  await reset(page);
  const out = await page.eval(`(() => {
    const w = ZQ.rt.world;
    for (let cy = -1; cy <= 1; cy += 1) {
      for (let cx = 0; cx <= 5; cx += 1) {
        try { w.ensureChunk(cx, cy); } catch (error) { /* край мира */ }
      }
    }
    const room = (w.rooms || []).find((r) => r.role === 'titanoboa');
    if (!room) return { error: 'no room' };
    ZQ.rt.state.player.x = room.centerX + 0.5;
    ZQ.rt.state.player.y = room.centerY + 0.5;
    ZQ.rt.state.currentRoomId = room.id;
    if (!ZQ.startChase(room)) return { error: 'startChase false' };
    const chase = ZQ.rt.chase;
    chase.invuln = 999;
    const startHead = { ...chase.body[0] };
    const startBodyLength = chase.body.length;
    const player = { x: ZQ.rt.state.player.x, y: ZQ.rt.state.player.y };
    const distance = (head) => Math.hypot(head.x + 0.5 - player.x, head.y + 0.5 - player.y);
    const startDistance = distance(startHead);
    let minDistance = startDistance;
    const positions = [];
    const headTiles = new Set();
    let maxFromStart = 0;
    for (let i = 0; i < 420; i += 1) {
      ZQ.updateChase(1 / 60);
      const head = chase.body[0];
      const d = distance(head);
      if (d < minDistance) minDistance = d;
      headTiles.add(head.x + ',' + head.y);
      maxFromStart = Math.max(maxFromStart, Math.hypot(head.x - startHead.x, head.y - startHead.y));
      if (i % 60 === 0) positions.push({ t: +(i / 60).toFixed(2), x: head.x, y: head.y, d: +d.toFixed(3) });
    }
    const endHead = { ...chase.body[0] };
    const moved = Math.hypot(endHead.x - startHead.x, endHead.y - startHead.y);
    const uniqueBody = new Set(chase.body.map((cell) => cell.x + ',' + cell.y)).size;
    const result = {
      room: { id: room.id, w: room.w, h: room.h },
      started: true,
      startHead,
      endHead,
      moved,
      startDistance,
      minDistance,
      endDistance: distance(endHead),
      startBodyLength,
      endBodyLength: chase.body.length,
      uniqueBody,
      headTiles: headTiles.size,
      maxFromStart,
      elapsed: chase.elapsed,
      active: chase.active,
      positions
    };
    chase.active = false;
    ZQ.rt.chase = null;
    ZQ.hideChaseStage();
    return result;
  })()`);
  if (out.error) return check(false, `не удалось проверить погоню: ${out.error}`, out);
  const ok = out.moved >= 2 &&
    out.headTiles >= 5 &&
    out.maxFromStart >= 3 &&
    out.minDistance <= out.startDistance - 1 &&
    out.uniqueBody >= 10 &&
    out.endBodyLength >= out.startBodyLength;
  return check(ok,
    `голова (${out.startHead.x},${out.startHead.y}) → (${out.endHead.x},${out.endHead.y}), прошла ${out.moved.toFixed(2)} тайла; ` +
    `разных клеток головы ${out.headTiles}, максимум от старта ${out.maxFromStart.toFixed(2)}; ` +
    `дистанция ${out.startDistance.toFixed(2)} → минимум ${out.minDistance.toFixed(2)}; тело ${out.endBodyLength} клеток, уникальных ${out.uniqueBody}`,
    out);
});

test('patch11.titanoboa-once-per-world', 11, 'В мире ровно одна комната титанобоа', async (page) => {
  await page.setViewport(1600, 900);
  await reset(page);
  const out = await page.eval(`(() => {
    const w = ZQ.rt.world;
    for (let cy = -3; cy <= 3; cy += 1) {
      for (let cx = -3; cx <= 3; cx += 1) {
        try { w.ensureChunk(cx, cy); } catch (error) { /* край мира */ }
      }
    }
    const rooms = (w.rooms || []).filter((r) => r.role === 'titanoboa');
    return { chunks: w.chunkCount, count: rooms.length, rooms: rooms.map((r) => ({ id: r.id, w: r.w, h: r.h })) };
  })()`);
  const ok = out.count === 1;
  return check(ok, `чанков ${out.chunks}, комнат титанобоа ${out.count}`, out);
});

test('patch11.titanoboa-room-huge', 11, 'Комната титанобоа действительно огромная', async (page) => {
  await page.setViewport(1600, 900);
  await reset(page);
  const out = await page.eval(`(() => {
    const w = ZQ.rt.world;
    for (let cy = -3; cy <= 3; cy += 1) {
      for (let cx = -3; cx <= 3; cx += 1) {
        try { w.ensureChunk(cx, cy); } catch (error) { /* край мира */ }
      }
    }
    const rooms = (w.rooms || []).filter((r) => r.role === 'titanoboa');
    const room = rooms[0];
    if (!room) return { error: 'no room' };
    const procedural = (w.rooms || []).filter((r) => r.role === 'procedural');
    const maxArea = procedural.reduce((best, r) => Math.max(best, r.w * r.h), 0);
    const maxRoom = procedural.reduce((best, r) => (r.w * r.h > best.w * best.h ? r : best), { w: 0, h: 0 });
    return {
      room: { w: room.w, h: room.h, area: room.w * room.h },
      maxProcedural: { w: maxRoom.w, h: maxRoom.h, area: maxArea },
      globalMax: { w: ZQ.C.world.ROOM_W_MAX, h: ZQ.C.world.ROOM_H_MAX }
    };
  })()`);
  if (out.error) return check(false, out.error, out);
  const ok = out.room.w >= 36 && out.room.h >= 28 && out.room.area >= out.maxProcedural.area;
  return check(ok,
    `титанобоа ${out.room.w}×${out.room.h} (${out.room.area}); максимум процедурных ${out.maxProcedural.w}×${out.maxProcedural.h}; ` +
    `глобальный максимум ${out.globalMax.w}×${out.globalMax.h}`,
    out);
});

test('patch11.keypress-highlight', 11, 'Нажатая клавиша подсвечивается на схеме стола', async (page) => {
  await page.setViewport(1600, 900);
  await reset(page);
  await page.eval(`ZQ.openCanvas()`);
  await sleep(250);
  const out = await page.eval(`(() => {
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW', key: 'w', bubbles: true }));
    const during = [...document.querySelectorAll('.kb-key')].filter((key) => /pressed|active|down/.test(key.className));
    const result = {
      totalKeys: document.querySelectorAll('.kb-key').length,
      pressed: during.length,
      codes: during.map((key) => key.dataset.code),
      classes: [...new Set(during.map((key) => key.className))]
    };
    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyW', key: 'w', bubbles: true }));
    return result;
  })()`);
  const ok = out.pressed >= 1;
  return check(ok,
    `keydown W: подсвечено ${out.pressed} из ${out.totalKeys} клавиш; классы: ${out.classes.join(', ') || 'нет'}`,
    out);
});

test('patch11.cursor-label-removed', 11, 'Надпись «курсор: … · ПКМ» убрана', async (page) => {
  await page.setViewport(1600, 900);
  await reset(page);
  const out = await page.eval(`(() => {
    ZQ.setTerminalView('main');
    ZQ.updatePrompt();
    const context = document.querySelector('#term-context');
    return { text: context ? context.textContent.trim() : '', hasCursor: /курсор\\s*:/i.test(context ? context.textContent : '') };
  })()`);
  const ok = !out.hasCursor;
  return check(ok, `строка контекста: «${out.text}»`, out);
});

test('patch11.autocomplete-second-word', 11, 'Автодополнение подсказывает второе слово и для алиаса «помощь»', async (page) => {
  await page.setViewport(1600, 900);
  await reset(page);
  const out = await page.eval(`(() => {
    ZQ.setTerminalView('main');
    const input = document.querySelector('#command-input');
    const ghost = document.querySelector('#command-ghost');
    function probe(value) {
      input.focus();
      input.value = value;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      return {
        value,
        ghost: ghost ? ghost.textContent.trim() : '',
        hidden: ghost ? ghost.classList.contains('hidden') : true,
        suggestions: (ZQ.rt.commandSuggestions || []).slice(0, 4)
      };
    }
    const alias = probe('помощь ');
    const canonical = probe('помоги ');
    input.value = '';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    return { alias, canonical };
  })()`);
  const ok = !out.alias.hidden && (out.alias.ghost !== '' || out.alias.suggestions.length > 0) &&
    !out.canonical.hidden && (out.canonical.ghost !== '' || out.canonical.suggestions.length > 0);
  return check(ok,
    `«помощь »: ghost=«${out.alias.ghost}», скрыт=${out.alias.hidden}; ` +
    `«помоги »: ghost=«${out.canonical.ghost}», скрыт=${out.canonical.hidden}`,
    out);
});

/* ----------------------------- Патч 12 ---------------------------- */

test('patch12.inventory-names-not-clipped', 12, 'Названия предметов в инвентаре не обрезаются', async (page) => {
  await page.setViewport(1600, 900);
  await reset(page);
  await openInventory(page);
  const out = await page.eval(`(() => {
    const names = [...document.querySelectorAll('#inventory-nodes .inv-node-name')];
    const clipped = names.filter((name) => name.scrollWidth > name.clientWidth + 1);
    return {
      names: names.length,
      clipped: clipped.length,
      examples: clipped.slice(0, 3).map((name) => name.textContent.trim())
    };
  })()`);
  const ok = out.clipped === 0;
  return check(ok, `имён ${out.names}, обрезано ${out.clipped}${out.examples.length ? ': ' + out.examples.join(', ') : ''}`, out);
});

test('patch12.inventory-all-visible', 12, 'Все предметы и связи видны в начальном кадре инвентаря', async (page) => {
  await page.setViewport(1600, 900);
  await reset(page);
  await openInventory(page);
  const out = await page.eval(`(() => {
    const surface = document.querySelector('#inventory-graph');
    const rect = surface.getBoundingClientRect();
    const nodes = [...document.querySelectorAll('#inventory-nodes .inv-node')];
    const visible = nodes.filter((node) => {
      const r = node.getBoundingClientRect();
      return r.right > rect.left && r.left < rect.right && r.bottom > rect.top && r.top < rect.bottom;
    });
    const edges = [...document.querySelectorAll('#inventory-links line')];
    const inside = edges.filter((line) =>
      ['x1', 'y1', 'x2', 'y2'].every((attr) => {
        const value = Number(line.getAttribute(attr));
        return Number.isFinite(value) && value >= 0 && value <= 100;
      })
    );
    return {
      nodes: nodes.length,
      visibleNodes: visible.length,
      visibleRatio: nodes.length ? visible.length / nodes.length : 0,
      edges: edges.length,
      edgesInside: inside.length,
      edgesRatio: edges.length ? inside.length / edges.length : 0
    };
  })()`);
  const ok = out.visibleRatio >= 0.9 && out.edgesRatio >= 0.9;
  return check(ok,
    `узлов ${out.visibleNodes}/${out.nodes} (${Math.round(out.visibleRatio * 100)}%), ` +
    `рёбер внутри viewBox ${out.edgesInside}/${out.edges} (${Math.round(out.edgesRatio * 100)}%)`,
    out);
});

test('patch12.inventory-small-viewport', 12, 'При 800×600 детали и заметка инвентаря доступны и не срезаны', async (page) => {
  await page.setViewport(800, 600);
  await reset(page);
  await openInventory(page);
  const out = await page.eval(`(() => {
    const view = document.querySelector('#view-inventory');
    const box = (selector) => {
      const el = document.querySelector(selector);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { top: Math.round(r.top), bottom: Math.round(r.bottom), height: Math.round(r.height) };
    };
    const before = {
      view: box('#view-inventory'),
      graph: box('#inventory-graph'),
      detail: box('#inventory-detail'),
      note: box('#inventory-note')
    };
    view.scrollTop = view.scrollHeight;
    const after = {
      view: box('#view-inventory'),
      detail: box('#inventory-detail'),
      note: box('#inventory-note'),
      scrollTop: Math.round(view.scrollTop),
      scrollHeight: view.scrollHeight,
      clientHeight: view.clientHeight
    };
    return {
      before,
      after,
      overflowY: getComputedStyle(view).overflowY
    };
  })()`);
  const { view, detail, note, scrollTop, scrollHeight, clientHeight } = out.after;
  const ok = Boolean(view && detail && note &&
    (scrollHeight <= clientHeight || scrollTop > 0) &&
    detail.bottom <= view.bottom && note.bottom <= view.bottom);
  return check(ok,
    `прокрутка ${scrollTop}/${scrollHeight - clientHeight}px, overflow-y=${out.overflowY}; ` +
    `после прокрутки detail ${detail ? detail.top + '…' + detail.bottom : '?'}, ` +
    `note ${note ? note.top + '…' + note.bottom : '?'}, view до ${view ? view.bottom : '?'}`,
    out);
});

test('patch12.player-wheel-scroll', 12, 'Колесо мыши прокручивает плеер', async (page) => {
  await page.setViewport(800, 600);
  await reset(page);
  await page.eval(`(() => {
    ZQ.setTerminalView('main');
    ZQ.handleCommand('плеер', 'terminal');
    return true;
  })()`);
  await sleep(350);
  const info = await page.eval(`(() => {
    const view = document.querySelector('#view-music');
    const r = view.getBoundingClientRect();
    return {
      visible: !view.classList.contains('hidden'),
      scrollTop: view.scrollTop,
      scrollHeight: view.scrollHeight,
      clientHeight: view.clientHeight,
      x: r.left + r.width / 2,
      y: r.top + r.height / 2
    };
  })()`);
  if (!info.visible) return check(false, 'плеер не открылся', info);
  await page.wheel(info.x, info.y, 240);
  const after = await page.eval(`(() => {
    const view = document.querySelector('#view-music');
    return { scrollTop: view.scrollTop };
  })()`);
  await page.setViewport(1600, 900);
  const ok = info.scrollHeight > info.clientHeight && after.scrollTop > 0;
  return check(ok,
    `scrollHeight=${info.scrollHeight}, clientHeight=${info.clientHeight}, scrollTop ${info.scrollTop} → ${after.scrollTop}`,
    { info, after });
});

/* --------------------- Дополнительные проверки -------------------- */

test('patch8.battle-charm-freezes', 8, '«Очарование» в бою замораживает снаряды и останавливает волны', async (page) => {
  await page.setViewport(1600, 900);
  await reset(page);
  const out = await page.eval(`(() => {
    if (!ZQ.startBattle('beetle')) return { error: 'startBattle false' };
    const battle = ZQ.rt.battle;
    battle.playerHp = 99;
    battle.playerInvuln = 999;
    for (let i = 0; i < 240; i += 1) ZQ.updateBattle(1 / 60);
    const snapshot = () => battle.bullets.map((b) => ({ x: +b.x.toFixed(4), y: +b.y.toFixed(4) }));
    const before = snapshot();
    const beforeWave = battle.waveCooldown;
    const used = ZQ.battleCharm();
    const cooldown = battle.charmCooldown;
    for (let i = 0; i < 30; i += 1) ZQ.updateBattle(1 / 60);
    const during = snapshot();
    const duringWave = battle.waveCooldown;
    const timerMid = battle.charmTimer;
    const frozen = before.length === during.length &&
      before.every((b, i) => b.x === during[i].x && b.y === during[i].y);
    for (let i = 0; i < 300; i += 1) ZQ.updateBattle(1 / 60);
    const after = snapshot();
    const resumed = after.length !== during.length ||
      after.some((b, i) => !during[i] || b.x !== during[i].x || b.y !== during[i].y);
    const result = {
      used,
      cooldown,
      timerMid,
      before: before.length,
      during: during.length,
      after: after.length,
      frozen,
      wavesPaused: beforeWave === duringWave,
      resumed,
      charmDuration: battle.config ? battle.config.charmDuration : null
    };
    battle.active = false;
    ZQ.rt.battle = null;
    ZQ.hideBattleStage();
    return result;
  })()`);
  if (out.error) return check(false, out.error, out);
  const ok = out.used && out.frozen && out.wavesPaused && out.resumed &&
    out.cooldown > 10 && out.timerMid > 0;
  return check(ok,
    `очарование=${out.used}, снарядов ${out.before}→${out.during}→${out.after}, ` +
    `заморожены=${out.frozen}, волны на паузе=${out.wavesPaused}, движение возобновилось=${out.resumed}, ` +
    `перезарядка ${out.cooldown.toFixed(1)} с, таймер после 0.5 с ${out.timerMid.toFixed(2)} с`,
    out);
});

test('patch11.titanoboa-charm-freezes', 11, '«Очарование» останавливает титанобоа, а не двигает её на месте', async (page) => {
  await page.setViewport(1600, 900);
  await reset(page);
  const out = await page.eval(`(() => {
    const w = ZQ.rt.world;
    for (let cy = -1; cy <= 1; cy += 1) {
      for (let cx = 0; cx <= 5; cx += 1) {
        try { w.ensureChunk(cx, cy); } catch (error) { /* край мира */ }
      }
    }
    const room = (w.rooms || []).find((r) => r.role === 'titanoboa');
    if (!room) return { error: 'no room' };
    ZQ.rt.state.player.x = room.centerX + 0.5;
    ZQ.rt.state.player.y = room.centerY + 0.5;
    ZQ.rt.state.currentRoomId = room.id;
    if (!ZQ.startChase(room)) return { error: 'startChase false' };
    const chase = ZQ.rt.chase;
    chase.invuln = 999;
    const tiles = new Set();
    for (let i = 0; i < 150; i += 1) {
      ZQ.updateChase(1 / 60);
      const head = chase.body[0];
      tiles.add(head.x + ',' + head.y);
    }
    const bodyBefore = chase.body.map((cell) => cell.x + ',' + cell.y).join('|');
    const used = ZQ.chaseCharm();
    const cooldown = chase.charmCooldown;
    /* Держим очарование почти до конца окна (3 с при 60 Гц — 180
       тиков). Проверяем тело в двух точках внутри окна, не переходя
       границу: на самом последнем тике таймер обнуляется и змея
       делает первый шаг — это уже не «заморожена». */
    for (let i = 0; i < 170; i += 1) ZQ.updateChase(1 / 60);
    const bodyDuring = chase.body.map((cell) => cell.x + ',' + cell.y).join('|');
    const timerMid = chase.charmTimer;
    for (let i = 0; i < 9; i += 1) ZQ.updateChase(1 / 60);
    const bodyStillCharmed = chase.body.map((cell) => cell.x + ',' + cell.y).join('|');
    const timerNearEnd = chase.charmTimer;
    for (let i = 0; i < 120; i += 1) ZQ.updateChase(1 / 60);
    const bodyLater = chase.body.map((cell) => cell.x + ',' + cell.y).join('|');
    const result = {
      used,
      cooldown,
      timerMid,
      timerNearEnd,
      tilesBefore: tiles.size,
      frozenDuringCharm: bodyBefore === bodyDuring,
      fixedWhileCharmed: bodyBefore === bodyDuring && bodyDuring === bodyStillCharmed,
      movedAfterCharm: bodyStillCharmed !== bodyLater
    };
    chase.active = false;
    ZQ.rt.chase = null;
    ZQ.hideChaseStage();
    return result;
  })()`);
  if (out.error) return check(false, out.error, out);
  const ok = out.used && out.tilesBefore >= 4 && out.frozenDuringCharm &&
    out.fixedWhileCharmed && out.movedAfterCharm && out.cooldown > 10;
  return check(ok,
    `до очарования голова прошла ${out.tilesBefore} разных клеток; ` +
    `тело неподвижно всю заморозку=${out.fixedWhileCharmed} (таймер ${out.timerMid.toFixed(2)} → ${out.timerNearEnd.toFixed(2)} с), ` +
    `после неё снова ползёт=${out.movedAfterCharm}, перезарядка ${out.cooldown.toFixed(1)} с`,
    out);
});

test('patch8.terminal-dash-surrender', 8, 'Команды «рывок» и «сдаться» работают в бою и погоне', async (page) => {
  await page.setViewport(1600, 900);
  await reset(page);
  const out = await page.eval(`(() => {
    const help = (ZQ.C.terminal.helpGroups || []).flatMap((group) =>
      (group.commands || []).map((entry) => entry.command)
    );
    /* Рывок теперь закрыт способностью: сначала открываем его. */
    const dashLockedBefore = typeof ZQ.hasDashAbility === 'function' && !ZQ.hasDashAbility();
    ZQ.handleCommand('рывок открыть', 'terminal');
    const dashOpen = typeof ZQ.hasDashAbility === 'function' && ZQ.hasDashAbility();
    const battleStarted = ZQ.startBattle('beetle');
    const battle = ZQ.rt.battle;
    if (battle) {
      battle.playerInvuln = 999;
      battle.playerHp = 99;
    }
    ZQ.handleCommand('рывок', 'terminal');
    const battleDash = battle ? { timer: battle.dashTimer, cooldown: battle.dashCooldown } : null;
    ZQ.handleCommand('сдаться', 'terminal');
    const battleClosed = !ZQ.rt.battle;

    const w = ZQ.rt.world;
    for (let cy = -1; cy <= 1; cy += 1) {
      for (let cx = 0; cx <= 5; cx += 1) {
        try { w.ensureChunk(cx, cy); } catch (error) { /* край мира */ }
      }
    }
    const room = (w.rooms || []).find((r) => r.role === 'titanoboa');
    const chaseStarted = room ? ZQ.startChase(room) : false;
    const chase = ZQ.rt.chase;
    if (chase) chase.invuln = 999;
    ZQ.handleCommand('рывок', 'terminal');
    const chaseDash = chase ? { timer: chase.dashTimer, cooldown: chase.dashCooldown, stamina: chase.stamina } : null;
    ZQ.handleCommand('сдаться', 'terminal');
    const chaseClosed = !ZQ.rt.chase;
    return {
      helpHasDash: help.includes('рывок'),
      helpHasSurrender: help.includes('сдаться'),
      dashLockedBefore,
      dashOpen,
      battleStarted,
      battleDash,
      battleClosed,
      chaseStarted,
      chaseDash,
      chaseClosed
    };
  })()`);
  const ok = out.helpHasDash && out.helpHasSurrender && out.dashLockedBefore && out.dashOpen &&
    out.battleStarted && out.battleDash && out.battleDash.timer > 0 && out.battleClosed &&
    out.chaseStarted && out.chaseDash && out.chaseDash.timer > 0 && out.chaseClosed;
  return check(ok,
    `справка: рывок=${out.helpHasDash}, сдаться=${out.helpHasSurrender}; ` +
    `гейт: закрыт=${out.dashLockedBefore}, открыт=${out.dashOpen}; ` +
    `бой: рывок ${out.battleDash ? out.battleDash.timer.toFixed(2) : '—'} с, закрыт=${out.battleClosed}; ` +
    `погоня: рывок ${out.chaseDash ? out.chaseDash.timer.toFixed(2) : '—'} с, закрыта=${out.chaseClosed}`,
    out);
});

test('patch12.cards-unlock-on-pickup', 12, 'Группа «карты» открывается вместе с картой «Очарование»', async (page) => {
  await page.setViewport(1600, 900);
  await reset(page);
  const out = await page.eval(`(() => {
    const before = ZQ.hasUnlock('cards');
    const taken = ZQ.takeCard();
    return {
      before,
      taken,
      after: ZQ.hasUnlock('cards'),
      hasCard: ZQ.rt.state.items.includes('card_angel'),
      cardFlag: Boolean(ZQ.rt.state.flags.cardTaken)
    };
  })()`);
  const ok = out.before === false && out.taken && out.hasCard && out.cardFlag && out.after === true;
  return check(ok,
    `до=${out.before}, карта взята=${out.taken}, в инвентаре=${out.hasCard}, после=${out.after}`,
    out);
});

test('patch12.inventory-no-overlaps', 12, 'Узлы инвентаря не накладываются друг на друга и целиком видны', async (page) => {
  const results = [];
  for (const [width, height] of [[1600, 900], [800, 600]]) {
    await page.setViewport(width, height);
    await reset(page);
    await openInventory(page);
    const out = await page.eval(`(() => {
      const graph = document.querySelector('#inventory-graph').getBoundingClientRect();
      const nodes = [...document.querySelectorAll('#inventory-nodes .inv-node')].map((node) => {
        const r = node.getBoundingClientRect();
        return { id: node.dataset.item, x: r.left, y: r.top, w: r.width, h: r.height };
      });
      let overlaps = 0;
      for (let i = 0; i < nodes.length; i += 1) {
        for (let j = i + 1; j < nodes.length; j += 1) {
          const a = nodes[i];
          const b = nodes[j];
          if (a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y) overlaps += 1;
        }
      }
      const outside = nodes.filter((node) =>
        node.x < graph.left - 1 || node.y < graph.top - 1 ||
        node.x + node.w > graph.right + 1 || node.y + node.h > graph.bottom + 1
      ).length;
      const edges = [...document.querySelectorAll('#inventory-links line')];
      const edgesInside = edges.filter((line) =>
        ['x1', 'y1', 'x2', 'y2'].every((attr) => {
          const value = Number(line.getAttribute(attr));
          return Number.isFinite(value) && value >= 0 && value <= 100;
        })
      ).length;
      return { nodes: nodes.length, overlaps, outside, edges: edges.length, edgesInside };
    })()`);
    results.push({ width, height, ...out });
  }
  await page.setViewport(1600, 900);
  const ok = results.every((r) => r.nodes >= 50 && r.overlaps === 0 && r.outside === 0 &&
    r.edges === r.edgesInside);
  return check(ok,
    results.map((r) => `${r.width}×${r.height}: узлов ${r.nodes}, наложений ${r.overlaps}, вне кадра ${r.outside}, рёбер ${r.edgesInside}/${r.edges}`).join('; '),
    { results });
});

test('patch11.tile-pixel-snap', 11, 'Тайлы и камера выравниваются по физическим пикселям без мерцания швов', async (page) => {
  const sizes = [[1600, 900], [1366, 768], [1280, 720], [800, 600], [390, 844]];
  const results = [];
  for (const [width, height] of sizes) {
    await page.setViewport(width, height);
    await reset(page);
    await sleep(120);
    const out = await page.eval(`(() => {
      const canvas = document.querySelector('#world-canvas');
      const rect = canvas.getBoundingClientRect();
      const view = { w: rect.width, h: rect.height };
      const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
      const ts = window.Renderer.tilePxFor(view);
      const cam = ZQ.rt.state.camera;
      const offsetX = view.w / 2 - cam.x * ts;
      const offsetY = view.h / 2 - cam.y * ts;
      const snap = (value) => Math.round(value * dpr) / dpr;
      const aligned = (value) => Math.abs(value * dpr - Math.round(value * dpr)) < 1e-6;
      const meta = ZQ.C.display || {};
      const snappedX = window.Renderer.snapPx(offsetX);
      const snappedY = window.Renderer.snapPx(offsetY);
      return {
        view,
        dpr,
        ts,
        tsDevice: ts * dpr,
        cols: view.w / ts,
        rows: view.h / ts,
        minCols: Number.isFinite(meta.minViewCols) ? meta.minViewCols : 14.5,
        minRows: Number.isFinite(meta.minViewRows) ? meta.minViewRows : 13.2,
        offsetX,
        offsetY,
        snappedX,
        snappedY,
        tsAligned: aligned(ts),
        snapMatches: Math.abs(snappedX - snap(offsetX)) < 1e-9 &&
          Math.abs(snappedY - snap(offsetY)) < 1e-9,
        snappedDeviceX: aligned(snappedX),
        snappedDeviceY: aligned(snappedY)
      };
    })()`);
    results.push({ width, height, ...out });
  }
  await page.setViewport(1600, 900);
  const ok = results.every((r) =>
    r.tsAligned && r.snapMatches &&
    Math.abs(r.tsDevice - Math.round(r.tsDevice)) < 1e-6 &&
    r.ts >= 11 && r.ts <= 46 &&
    r.cols >= r.minCols - 0.06 && r.rows >= r.minRows - 0.06 &&
    r.snappedDeviceX && r.snappedDeviceY
  );
  return check(ok,
    results.map((r) =>
      `${r.width}×${r.height}: тайл ${r.ts.toFixed(3)} CSS / ${r.tsDevice.toFixed(3)} px, кадр ${r.cols.toFixed(2)}×${r.rows.toFixed(2)} клеток`
    ).join('; '),
    { results });
});

test('patch11.diagonal-speed', 11, 'Диагональная ходьба не быстрее прямой и не даёт двойного шага', async (page) => {
  await page.setViewport(1600, 900);
  await reset(page);
  const out = await page.eval(`(() => {
    const w = ZQ.rt.world;
    const spawn = w.spawn;
    let spot = null;
    for (let ty = Math.floor(spawn.y) - 18; ty <= Math.floor(spawn.y) + 18 && !spot; ty += 1) {
      for (let tx = Math.floor(spawn.x) - 18; tx <= Math.floor(spawn.x) + 18; tx += 1) {
        let clear = true;
        for (let oy = -2; oy <= 2 && clear; oy += 1) {
          for (let ox = -2; ox <= 2; ox += 1) {
            if (!ZQ.canStandAt(tx + 0.5 + ox, ty + 0.5 + oy)) {
              clear = false;
              break;
            }
          }
        }
        if (clear) { spot = { x: tx + 0.5, y: ty + 0.5 }; break; }
      }
    }
    if (!spot) return { error: 'no open area' };
    const measure = (keys) => {
      ZQ.rt.keys = Object.create(null);
      ZQ.rt.timedMove = null;
      ZQ.rt.cursorMove = null;
      ZQ.rt.battle = null;
      ZQ.rt.chase = null;
      ZQ.rt.state.player.x = spot.x;
      ZQ.rt.state.player.y = spot.y;
      for (const key of keys) ZQ.rt.keys[key] = true;
      for (let i = 0; i < 30; i += 1) ZQ.updateMovement(1 / 60);
      ZQ.rt.keys = Object.create(null);
      return {
        dx: ZQ.rt.state.player.x - spot.x,
        dy: ZQ.rt.state.player.y - spot.y
      };
    };
    const straight = measure(['right']);
    const diagonal = measure(['right', 'down']);
    const straightDistance = Math.hypot(straight.dx, straight.dy);
    const diagonalDistance = Math.hypot(diagonal.dx, diagonal.dy);
    return {
      spot,
      straight,
      diagonal,
      straightDistance,
      diagonalDistance,
      ratio: straightDistance > 0 ? diagonalDistance / straightDistance : 0,
      speed: ZQ.C.player.speed
    };
  })()`);
  if (out.error) return check(false, out.error, out);
  const ok = out.straightDistance > 0.5 &&
    Math.abs(out.ratio - 1) < 0.03 &&
    Math.abs(Math.abs(out.diagonal.dx) - Math.abs(out.diagonal.dy)) < 0.05;
  return check(ok,
    `прямо ${out.straightDistance.toFixed(3)} тайла (${out.straight.dx.toFixed(3)}, ${out.straight.dy.toFixed(3)}), ` +
    `по диагонали ${out.diagonalDistance.toFixed(3)} тайла (${out.diagonal.dx.toFixed(3)}, ${out.diagonal.dy.toFixed(3)}), ` +
    `отношение ${out.ratio.toFixed(3)}`,
    out);
});

test('patch12.settings-heading-hierarchy', 12, 'Заголовки настроек крупнее заголовков разделов', async (page) => {
  await page.setViewport(1600, 900);
  await reset(page);
  const views = ['settings', 'term-settings', 'font-settings', 'music'];
  const results = [];
  for (const view of views) {
    await page.eval(`ZQ.setTerminalView('${view}')`);
    await sleep(80);
    const out = await page.eval(`(() => {
      const root = document.querySelector('#view-${view}');
      const title = root ? root.querySelector('.settings-title') : null;
      const head = root ? root.querySelector('.setting-head span') : null;
      const body = root ? root.querySelector('.setting-note-inline, .setting-toggle span, .setting-override-name') : null;
      const px = (el) => el ? parseFloat(getComputedStyle(el).fontSize) : 0;
      return {
        view: '${view}',
        title: px(title),
        head: px(head),
        body: px(body),
        titleTag: title ? title.tagName : '',
        headTag: head ? head.tagName : ''
      };
    })()`);
    results.push(out);
  }
  await page.eval(`ZQ.setTerminalView('main')`);
  const ok = results.every((r) => r.title > r.head && r.head > 0 &&
    (!r.body || r.head > r.body));
  return check(ok,
    results.map((r) =>
      `${r.view}: h1=${r.title.toFixed(1)}px (${r.titleTag}), h2=${r.head.toFixed(1)}px, текст=${r.body.toFixed(1)}px`
    ).join('; '),
    { results });
});

test('patch9.inventory-two-locations', 9, 'Инвентарь и рюкзак — два места хранения, рюкзак остаётся предметом', async (page) => {
  await page.setViewport(1600, 900);
  await reset(page);
  const out = await page.eval(`(() => {
    const state = ZQ.rt.state;
    state.items = ['music_player'];
    state.itemLocations = {};
    const added = [];
    for (const id of ['backpack', 'map_fragment', 'chalk', 'bead', 'card_angel', 'umbrella']) {
      added.push({ id, result: ZQ.addInventoryItem(id) });
    }
    const base = ZQ.C.inventory.baseSlots;
    const bonus = ZQ.inventoryCapacity() - base;
    const countAt = (location) => state.items.filter((id) =>
      ZQ.itemLocation(id) === location).length;
    const autoBaseCount = countAt('inventory');
    const autoPackCount = countAt('backpack');
    /* Берём именно переносимую вещь: проигрыватель и рюкзак
       закреплены в инвентаре и не должны переезжать. */
    const movableInBase = state.items.filter((id) =>
      ZQ.itemLocation(id) === 'inventory' &&
      id !== 'backpack' && id !== 'music_player');
    const moveToPack = ZQ.moveInventoryItem(movableInBase[0], 'backpack');
    const packAfterMove = countAt('backpack');
    const stillInBase = state.items.filter((id) =>
      ZQ.itemLocation(id) === 'inventory' &&
      id !== 'backpack' && id !== 'music_player');
    const fullAttempt = ZQ.moveInventoryItem(stillInBase[0], 'backpack');
    const moveOut = ZQ.moveInventoryItem(movableInBase[0], 'inventory');
    const moveBack = ZQ.moveInventoryItem(movableInBase[0], 'backpack');
    ZQ.renderInventory();
    const icons = {
      inventory: document.querySelectorAll('#inventory-capacity .inventory-capacity-icon').length,
      backpack: document.querySelectorAll('#inventory-capacity .backpack-capacity-icon').length,
      filledInventory: document.querySelectorAll('#inventory-capacity .inventory-capacity-icon.filled').length,
      filledBackpack: document.querySelectorAll('#inventory-capacity .backpack-capacity-icon.filled').length
    };
    const slots = [...document.querySelectorAll('#inventory-slots .inventory-slot')].map((slot) => ({
      location: slot.dataset.location,
      item: slot.dataset.item || null,
      filled: slot.classList.contains('filled')
    }));
    const table = ZQ.inventoryTable();
    return {
      added,
      base,
      bonus,
      autoBaseCount,
      autoPackCount,
      moveToPack,
      packAfterMove,
      fullAttempt,
      moveOut,
      moveBack,
      finalBaseCount: countAt('inventory'),
      finalPackCount: countAt('backpack'),
      backpackIsItem: state.items.includes('backpack') && ZQ.itemLocation('backpack') === 'inventory',
      icons,
      slots,
      tableHasPlace: table.includes('место'),
      tableHasBackpack: table.includes('рюкзак')
    };
  })()`);
  const ok = out.added.every((entry) => entry.result && entry.result.ok) &&
    out.backpackIsItem &&
    out.autoBaseCount === out.base &&
    out.autoPackCount === out.bonus - 1 &&
    out.moveToPack && out.moveToPack.ok && out.packAfterMove === out.bonus &&
    out.fullAttempt && out.fullAttempt.ok === false &&
    out.fullAttempt.reason === 'backpack-full' &&
    out.moveOut && out.moveOut.ok && out.moveBack && out.moveBack.ok &&
    out.finalBaseCount === out.base - 1 &&
    out.finalPackCount === out.bonus &&
    out.icons.inventory === out.base && out.icons.backpack === out.bonus &&
    out.icons.filledInventory === out.finalBaseCount &&
    out.icons.filledBackpack === out.finalPackCount &&
    out.slots.filter((slot) => slot.location === 'inventory').length === out.base &&
    out.slots.filter((slot) => slot.location === 'backpack').length === out.bonus &&
    out.tableHasPlace && out.tableHasBackpack;
  return check(ok,
    `авто-раскладка: инвентарь ${out.autoBaseCount}/${out.base}, рюкзак ${out.autoPackCount}/${out.bonus}; ` +
    `перенос в рюкзак=${out.moveToPack.ok} → ${out.packAfterMove}/${out.bonus}; ` +
    `переполненный рюкзак=${out.fullAttempt.reason || out.fullAttempt.ok}; ` +
    `обратно в инвентарь=${out.moveOut.ok}, снова в рюкзак=${out.moveBack.ok}; ` +
    `итог: инвентарь ${out.finalBaseCount}/${out.base}, рюкзак ${out.finalPackCount}/${out.bonus}; ` +
    `иконки ${out.icons.filledInventory}/${out.icons.inventory} + ${out.icons.filledBackpack}/${out.icons.backpack}; ` +
    `таблица: место=${out.tableHasPlace}, рюкзак=${out.tableHasBackpack}`,
    out);
});

/* ---------------------------- Аркада ------------------------------ */

test('patch13.arcade-spawn-prompt', 13, 'Автомат появляется в зале и даёт подсказку', async (page) => {
  await page.setViewport(1600, 900);
  await reset(page);
  const out = await page.eval(`(() => {
    ZQ.C.world.arcadeChance = 1;
    ZQ.rt.world = World.generate(ZQ.rt.state.seed);
    const world = ZQ.rt.world;
    const arcade = world.arcades.find((item) => {
      const room = world.roomById(item.roomId);
      return room && !room.faunaKind;
    }) || world.arcades[0];
    if (!arcade) return { error: 'no arcade spawned' };
    const center = ZQ.arcadeCenter(arcade);
    let spot = null;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const x = center.x + dx;
      const y = center.y + dy;
      if (ZQ.canStandAt(x, y)) { spot = { x, y }; break; }
    }
    if (!spot) return { error: 'no standable tile next to arcade' };
    const player = ZQ.rt.state.player;
    player.x = spot.x;
    player.y = spot.y;
    player.moving = false;
    ZQ.rt.state.currentRoomId = arcade.roomId;
    ZQ.updatePrompt();
    const description = ZQ.currentRoomDescription();
    ZQ.C.world.arcadeChance = 0.16;
    return {
      count: world.arcades.length,
      roomId: arcade.roomId,
      prompt: ZQ.rt.promptLabel,
      actionVisible: !ZQ.dom.btnAction.classList.contains('hidden'),
      description,
      hasDescription: description.includes('аркадный автомат'),
      canStand: ZQ.canStandAt(player.x, player.y),
      canStandCenter: ZQ.canStandAt(center.x, center.y)
    };
  })()`);
  if (out.error) return check(false, out.error, out);
  const ok = out.count > 0 &&
    out.prompt === 'сыграть на автомате' &&
    out.actionVisible &&
    out.hasDescription &&
    out.canStand &&
    !out.canStandCenter;
  return check(ok,
    `автоматов в мире: ${out.count}; комната ${out.roomId}; подсказка «${out.prompt}»; ` +
    `кнопка действия=${out.actionVisible}; описание=${out.hasDescription}; ` +
    `пол рядом=${out.canStand}; пол на автомате=${out.canStandCenter}`,
    out);
});

test('patch13.arcade-cassettes', 13, 'Аркада показывает кассеты игрока и дорожки ритм-каталога', async (page) => {
  await page.setViewport(1600, 900);
  await reset(page);
  await page.eval(`ZQ.handleCommand('автомат', 'terminal')`);
  await page.waitFor(`document.querySelectorAll('#arcade-cassettes .arcade-track').length > 0`, 10000);
  const out = await page.eval(`(() => {
    const view = document.querySelector('#view-arcade');
    const groups = [...document.querySelectorAll('#arcade-cassettes .arcade-cassette')];
    const tracks = [...document.querySelectorAll('#arcade-cassettes .arcade-track')];
    return {
      termView: ZQ.rt.termView,
      visible: !view.classList.contains('hidden'),
      paused: ZQ.isPaused(),
      groups: groups.length,
      tracks: tracks.length,
      countLabel: document.querySelector('#arcade-count').textContent,
      firstCassette: groups[0] ? groups[0].querySelector('.arcade-cassette-title').textContent : '',
      firstTrack: tracks[0] ? tracks[0].querySelector('.arcade-track-title').textContent : '',
      emptyHidden: document.querySelector('#arcade-empty').classList.contains('hidden')
    };
  })()`);
  const ok = out.termView === 'arcade' &&
    out.visible &&
    out.paused &&
    out.groups > 0 &&
    out.tracks > 0 &&
    out.emptyHidden &&
    /кассет/.test(out.countLabel);
  return check(ok,
    `вкладка=${out.termView}, видима=${out.visible}, пауза=${out.paused}; ` +
    `кассет=${out.groups}, дорожек=${out.tracks}; счётчик «${out.countLabel}»; ` +
    `первая «${out.firstCassette}» → «${out.firstTrack}»`,
    out);
});

test('patch13.arcade-play-result-exit', 13, 'Дорожка запускается в iframe, результат пишется в лог, автомат закрывается', async (page) => {
  await page.setViewport(1600, 900);
  await reset(page);
  await page.eval(`ZQ.handleCommand('автомат', 'terminal')`);
  await page.waitFor(`document.querySelectorAll('#arcade-cassettes .arcade-track').length > 0`, 10000);
  const picked = await page.eval(`(() => {
    const button = document.querySelector('#arcade-cassettes .arcade-track');
    const title = button.querySelector('.arcade-track-title').textContent;
    button.click();
    return {
      title,
      screenVisible: !document.querySelector('#arcade-screen-wrap').classList.contains('hidden'),
      src: document.querySelector('#arcade-frame').getAttribute('src') || ''
    };
  })()`);
  await page.waitFor(`(() => {
    const frame = document.getElementById('arcade-frame');
    const debug = frame && frame.contentWindow && frame.contentWindow.RhythmDebug;
    return Boolean(debug && debug.state.track && debug.state.phase !== 'boot' && debug.state.phase !== 'embed');
  })()`, 20000);
  const started = await page.eval(`(() => {
    const frame = document.getElementById('arcade-frame');
    const state = frame.contentWindow.RhythmDebug.state;
    return {
      album: state.album ? state.album.id : '',
      track: state.track ? state.track.id : '',
      title: state.track ? state.track.title : '',
      phase: state.phase
    };
  })()`);
  await page.eval(`(() => {
    const frame = document.getElementById('arcade-frame');
    const debug = frame.contentWindow.RhythmDebug;
    if (debug.state.phase !== 'end') debug.endGame();
    return debug.state.phase;
  })()`);
  await page.waitFor(`ZQ.rt.state.arcade && ZQ.rt.state.arcade.plays === 1`, 8000);
  const result = await page.eval(`(() => {
    const state = ZQ.rt.state.arcade;
    const lines = [...document.querySelectorAll('#log .log-line')];
    const last = lines[lines.length - 1];
    return {
      plays: state.plays,
      lastTrack: state.last ? state.last.track : '',
      lastScore: state.last ? state.last.score : null,
      lastRank: state.last ? state.last.rankName : '',
      logText: last ? last.dataset.rawText : '',
      termView: ZQ.rt.termView
    };
  })()`);
  await page.eval(`ZQ.handleCommand('аркада', 'terminal')`);
  await sleep(200);
  const closed = await page.eval(`({
    termView: ZQ.rt.termView,
    paused: ZQ.isPaused(),
    viewHidden: document.querySelector('#view-arcade').classList.contains('hidden')
  })`);
  const ok = picked.screenVisible &&
    picked.src.includes('embed=zqwy') &&
    started.track === result.lastTrack &&
    result.plays === 1 &&
    /Аркада/.test(result.logText) &&
    result.termView === 'arcade' &&
    closed.termView === 'main' &&
    !closed.paused &&
    closed.viewHidden;
  return check(ok,
    `дорожка «${picked.title}» (${started.track}, ${started.phase}) в кадре ${picked.src}; ` +
    `результат: очков=${result.lastScore}, ранг=${result.lastRank}, лог «${result.logText}»; ` +
    `после выхода вкладка=${closed.termView}, пауза=${closed.paused}`,
    { picked, started, result, closed });
});

test('patch13.story-hidden-cheats', 13, 'Будущие узлы сюжета скрыты, а читы открывают и закрывают ветвь', async (page) => {
  await page.setViewport(1600, 900);
  await reset(page);
  const out = await page.eval(`(() => {
    ZQ.openStory();
    const count = () => document.querySelectorAll('#story-tree .story-node').length;
    const initial = count();
    const buttons = ['story-expand', 'story-pin', 'story-sort', 'story-grid']
      .every((id) => Boolean(document.getElementById(id)));
    ZQ.handleCommand('чит сюжет открыть *', 'terminal');
    ZQ.renderStory();
    const opened = count();
    ZQ.handleCommand('чит сюжет закрыть *', 'terminal');
    ZQ.renderStory();
    const closed = count();
    ZQ.handleCommand('чит кот', 'terminal');
    ZQ.renderStory();
    const catOn = count();
    ZQ.handleCommand('чит кот', 'terminal');
    ZQ.renderStory();
    const catOff = count();
    const mirrorDone = ZQ.storyNodeState('mirror').done;
    ZQ.closeStory();
    return { initial, opened, closed, catOn, catOff, buttons, mirrorDone,
      visible: ZQ.rt.state.cheatStoryVisible };
  })()`);
  const ok = out.initial > 0 &&
    out.opened > out.initial &&
    out.closed === out.initial &&
    out.catOn === out.opened &&
    out.catOff === out.initial &&
    out.buttons &&
    !out.mirrorDone &&
    !out.visible;
  return check(ok,
    `узлов сразу=${out.initial}, после «чит сюжет открыть *»=${out.opened}, ` +
    `после закрытия=${out.closed}; «чит кот»=${out.catOn} → ${out.catOff}; ` +
    `кнопки инструментов=${out.buttons}; зеркало пройдено=${out.mirrorDone}`,
    out);
});

test('patch13.arcade-solid-push', 13, 'Автомат нельзя обойти насквозь, но можно толкать', async (page) => {
  await page.setViewport(1600, 900);
  await reset(page);
  const out = await page.eval(`(() => {
    ZQ.C.world.arcadeChance = 1;
    ZQ.rt.world = World.generate(ZQ.rt.state.seed);
    const world = ZQ.rt.world;
    const arcade = world.arcades.find((item) => {
      const room = world.roomById(item.roomId);
      return room && !room.faunaKind;
    }) || world.arcades[0];
    if (!arcade) return { error: 'no arcade spawned' };
    const center = ZQ.arcadeCenter(arcade);
    const centerStand = ZQ.canStandAt(center.x, center.y);
    let adjacent = false;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      if (ZQ.canStandAt(center.x + dx, center.y + dy)) { adjacent = true; break; }
    }
    let pushed = false;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      if (ZQ.arcadePush(arcade, 0, 0, dx, dy, 0.12)) { pushed = true; break; }
    }
    const after = ZQ.arcadeCenter(arcade);
    const key = Object.keys(ZQ.rt.state.arcadePositions || {})[0] || '';
    const saved = key ? ZQ.rt.state.arcadePositions[key] : null;
    ZQ.C.world.arcadeChance = 0.16;
    return {
      count: world.arcades.length,
      centerStand,
      adjacent,
      pushed,
      moved: Math.hypot(after.x - center.x, after.y - center.y),
      saved: Boolean(saved)
    };
  })()`);
  if (out.error) return check(false, out.error, out);
  const ok = out.count > 0 && !out.centerStand && out.adjacent &&
    out.pushed && out.moved > 0.01 && out.saved;
  return check(ok,
    `автоматов=${out.count}; пол на корпусе=${out.centerStand}; пол рядом=${out.adjacent}; ` +
    `толчок=${out.pushed}; сдвиг=${out.moved.toFixed(3)}; позиция сохранена=${out.saved}`,
    out);
});

test('patch13.arcade-inventory-focus-drop', 13, 'E открывает инвентарь на автомате, а кассета запускает аркаду', async (page) => {
  await page.setViewport(1600, 900);
  await reset(page);
  const prep = await page.eval(`(() => {
    const state = ZQ.rt.state;
    state.unlocks = { backpack: true, map: true, table: true, cards: true };
    if (!state.items.includes('backpack')) state.items.push('backpack');
    ZQ.C.world.arcadeChance = 1;
    ZQ.rt.world = World.generate(state.seed);
    ZQ.C.world.arcadeChance = 0.16;
    const world = ZQ.rt.world;
    const arcade = world.arcades.find((item) => {
      const room = world.roomById(item.roomId);
      return room && !room.faunaKind;
    }) || world.arcades[0];
    if (!arcade) return { error: 'no arcade spawned' };
    const center = ZQ.arcadeCenter(arcade);
    let spot = null;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      if (ZQ.canStandAt(center.x + dx, center.y + dy)) {
        spot = { x: center.x + dx, y: center.y + dy };
        break;
      }
    }
    if (!spot) return { error: 'no standable tile next to arcade' };
    state.player.x = spot.x;
    state.player.y = spot.y;
    state.currentRoomId = arcade.roomId;
    ZQ.updatePrompt();
    const focused = ZQ.focusInventoryItem('arcade_cabinet');
    const node = document.querySelector('#inventory-nodes .inv-node[data-item="arcade_cabinet"]');
    const rect = node ? node.getBoundingClientRect() : null;
    const graph = ZQ.dom.inventoryGraph.getBoundingClientRect();
    const centered = rect
      ? Math.abs((rect.left + rect.width / 2) - (graph.left + graph.width / 2)) < graph.width * 0.2
      : false;
    const selected = Boolean(node && node.classList.contains('selected'));
    state.player.x = center.x + 30;
    state.player.y = center.y + 30;
    ZQ.updatePrompt();
    const gone = !document.querySelector('#inventory-nodes .inv-node[data-item="arcade_cabinet"]');
    return {
      focused,
      selected,
      centered,
      gone,
      view: ZQ.rt.termView,
      prompt: ZQ.rt.promptLabel
    };
  })()`);
  if (prep.error) return check(false, prep.error, prep);
  const launched = await page.eval(`(() => {
    ZQ.closeInventory();
    return ZQ.arcadePlayCassette('cassette_runner');
  })()`);
  await page.waitFor(`Boolean(ZQ.arcadeState() && ZQ.arcadeState().track)`, 15000);
  const out = await page.eval(`(() => ({
    view: ZQ.rt.termView,
    inserted: ZQ.arcadeInserted(),
    track: ZQ.arcadeState().track,
    cassette: ZQ.arcadeState().cassette
  }))()`);
  const ok = prep.focused && prep.selected && prep.centered && prep.gone &&
    launched && out.view === 'arcade' &&
    out.inserted === 'cassette_runner' &&
    out.cassette === 'cassette_runner' &&
    Boolean(out.track);
  return check(ok,
    `фокус=${prep.focused}, выбран=${prep.selected}, в центре=${prep.centered}, ` +
    `узел исчез после ухода=${prep.gone}; запуск=${launched}; вкладка=${out.view}; ` +
    `гнездо=${out.inserted}; дорожка=${out.track}`,
    { prep, launched, out });
});

/* --------------------------- Запуск ------------------------------- */

function escapeCell(value) {
  return String(value === null || value === undefined ? '' : value)
    .replace(/\|/g, '\\|')
    .replace(/\n+/g, ' ');
}

function writeStatus(results, startedAt, finishedAt) {
  const byPatch = new Map();
  for (const result of results) {
    if (!byPatch.has(result.patch)) byPatch.set(result.patch, []);
    byPatch.get(result.patch).push(result);
  }
  const passed = results.filter((r) => r.status === 'pass').length;
  const failed = results.filter((r) => r.status === 'fail').length;
  const lines = [];
  lines.push('# Состояние проверки патчей');
  lines.push('');
  lines.push(`Проверка выполнена: ${startedAt} — ${finishedAt}.`);
  lines.push('');
  lines.push(`Всего проверок: **${results.length}**. PASS: **${passed}**. FAIL: **${failed}**.`);
  lines.push('');
  lines.push('Проверки идут на живой игре в headless Chrome через CDP, а не по README. ' +
    'PASS означает, что требование выполнено в текущем коде; FAIL — что требование не выполнено или выполнено не полностью.');
  lines.push('');
  lines.push('## Сводка по патчам');
  lines.push('');
  lines.push('| Патч | Проверок | PASS | FAIL |');
  lines.push('|---|---:|---:|---:|');
  for (const patch of [...byPatch.keys()].sort((a, b) => a - b)) {
    const list = byPatch.get(patch);
    const p = list.filter((r) => r.status === 'pass').length;
    const f = list.filter((r) => r.status === 'fail').length;
    lines.push(`| ${patch} | ${list.length} | ${p} | ${f} |`);
  }
  lines.push('');
  for (const patch of [...byPatch.keys()].sort((a, b) => a - b)) {
    lines.push(`## Патч ${patch}`);
    lines.push('');
    lines.push('| Проверка | Статус | Факт |');
    lines.push('|---|---|---|');
    for (const result of byPatch.get(patch)) {
      lines.push(`| ${escapeCell(result.title)} | ${result.status === 'pass' ? '✅ PASS' : '❌ FAIL'} | ${escapeCell(result.detail)} |`);
    }
    lines.push('');
  }
  lines.push('## Что не покрыто этим прогоном');
  lines.push('');
  lines.push('- Сохранения, слоты, импорт/экспорт и переименование мира.');
  lines.push('- Переключение языков, немецкий и английский тексты.');
  lines.push('- Алгоритмы скорости плеера, волновая форма и перемотка мышью.');
  lines.push('- Сохранение и загрузка макетов стола.');
  lines.push('- Полное прохождение сюжета, награды и открытия.');
  lines.push('- Визуальное качество спрайтов и звук.');
  lines.push('');
  lines.push('## Как повторить');
  lines.push('');
  lines.push('```bash');
  lines.push('node scripts/tests/run.js');
  lines.push('```');
  lines.push('');
  lines.push('Нужен Chrome с `--remote-debugging-port=9222` (порт можно задать через `CDP_PORT`). Статическая раздача поднимается на `127.0.0.1:8011` из корня `files/` автоматически.');
  lines.push('');
  fs.writeFileSync(STATUS_PATH, lines.join('\n'), 'utf8');
}

/* ----------------------------- Патч 14 ---------------------------- */

test('patch14.unified-canvas-controls', 14, 'Стол, инвентарь и сюжет используют одну панель управления внутри канвы', async (page) => {
  await page.setViewport(1600, 900);
  await reset(page);
  await openInventory(page);
  const inventory = await page.eval(`(() => {
    const workspace = document.getElementById('inventory-graph');
    const controls = workspace && workspace.querySelector(':scope > .canvas-controls');
    const ids = ['inventory-zoom-out', 'inventory-zoom-reset', 'inventory-zoom-in', 'inventory-fit', 'inventory-align-grid'];
    const buttons = ids.map((id) => Boolean(document.getElementById(id)));
    const labels = controls ? controls.textContent : '';
    const start = { zoom: ZQ.rt.inventoryZoom, panX: ZQ.rt.inventoryPanX, panY: ZQ.rt.inventoryPanY };
    document.getElementById('inventory-fit').click();
    const fitted = { zoom: ZQ.rt.inventoryZoom, panX: ZQ.rt.inventoryPanX, panY: ZQ.rt.inventoryPanY };
    document.getElementById('inventory-align-grid').click();
    const snapped = Object.keys(ZQ.rt.state.inventoryPositions || {}).length;
    document.getElementById('inventory-zoom-reset').click();
    const reset = { zoom: ZQ.rt.inventoryZoom, panX: ZQ.rt.inventoryPanX, panY: ZQ.rt.inventoryPanY };
    ZQ.closeInventory();
    return {
      inside: Boolean(controls && workspace.contains(controls)),
      buttons,
      hasFit: /развернуть/.test(labels),
      hasGrid: /сетка/.test(labels),
      start,
      fitted,
      snapped,
      reset
    };
  })()`);

  const table = await page.eval(`(() => {
    ZQ.rt.state.unlocks = { backpack: true, table: true, map: true, cards: true };
    ZQ.openCanvas();
    ZQ.addItemElement('chalk', true);
    ZQ.addItemElement('bead', true);
    const workspace = document.getElementById('canvas-workspace');
    const controls = workspace && workspace.querySelector(':scope > .canvas-controls');
    const ids = ['canvas-zoom-out', 'canvas-zoom-reset', 'canvas-zoom-in', 'canvas-fit', 'canvas-align-grid',
      'canvas-add-toggle', 'canvas-link-toggle', 'canvas-keys-toggle', 'canvas-layout-save'];
    const buttons = ids.map((id) => Boolean(document.getElementById(id)));
    const labels = controls ? controls.textContent : '';
    const nodes = document.querySelectorAll('#canvas-elements .cv-el').length;
    document.getElementById('canvas-fit').click();
    const fitted = { zoom: ZQ.rt.canvasZoom, panX: ZQ.rt.canvasPanX, panY: ZQ.rt.canvasPanY };
    document.getElementById('canvas-align-grid').click();
    const snapped = ZQ.rt.state.canvasElements.length;
    document.getElementById('canvas-zoom-reset').click();
    const reset = { zoom: ZQ.rt.canvasZoom, panX: ZQ.rt.canvasPanX, panY: ZQ.rt.canvasPanY };
    ZQ.closeCanvas();
    return {
      inside: Boolean(controls && workspace.contains(controls)),
      buttons,
      hasFit: /развернуть/.test(labels),
      hasGrid: /сетка/.test(labels),
      nodes,
      fitted,
      snapped,
      reset
    };
  })()`);

  const story = await page.eval(`(() => {
    ZQ.openStory();
    ZQ.handleCommand('чит сюжет открыть *', 'terminal');
    ZQ.renderStory();
    const workspace = document.getElementById('story-tree');
    const controls = workspace && workspace.querySelector(':scope > .canvas-controls');
    const ids = ['story-zoom-out', 'story-zoom-reset', 'story-zoom-in', 'story-expand', 'story-grid',
      'story-pin', 'story-sort'];
    const buttons = ids.map((id) => Boolean(document.getElementById(id)));
    const labels = controls ? controls.textContent : '';
    const structure = {
      stage: Boolean(workspace.querySelector(':scope > #story-stage')),
      grid: Boolean(workspace.querySelector(':scope > #story-canvas-grid')),
      links: Boolean(workspace.querySelector('#story-stage > #story-links')),
      nodes: Boolean(workspace.querySelector('#story-stage > #story-nodes'))
    };
    const nodes = document.querySelectorAll('#story-nodes .story-node').length;
    document.getElementById('story-expand').click();
    const fitted = { zoom: ZQ.rt.storyZoom, panX: ZQ.rt.storyPanX, panY: ZQ.rt.storyPanY };
    document.getElementById('story-grid').click();
    const snapped = Object.keys(ZQ.rt.storyPositions || {}).length;
    document.getElementById('story-sort').click();
    const sorted = document.querySelectorAll('#story-nodes .story-node').length;
    document.getElementById('story-zoom-reset').click();
    const reset = { zoom: ZQ.rt.storyZoom, panX: ZQ.rt.storyPanX, panY: ZQ.rt.storyPanY };
    ZQ.closeStory();
    return {
      inside: Boolean(controls && workspace.contains(controls)),
      buttons,
      hasFit: /развернуть/.test(labels),
      hasGrid: /сетка/.test(labels),
      structure,
      nodes,
      fitted,
      snapped,
      sorted,
      reset
    };
  })()`);

  const dupes = await page.eval(`(() => {
    const ids = [...document.querySelectorAll('[id]')].map((node) => node.id);
    return [...new Set(ids.filter((id, index) => ids.indexOf(id) !== index))];
  })()`);

  const panes = [inventory, table, story];
  const ok = dupes.length === 0 &&
    panes.every((pane) =>
      pane.inside &&
      pane.hasFit &&
      pane.hasGrid &&
      pane.buttons.every(Boolean) &&
      pane.fitted.zoom > 0 &&
      pane.snapped > 0 &&
      pane.reset.zoom === 1 &&
      pane.reset.panX === 0 &&
      pane.reset.panY === 0
    ) &&
    story.structure.stage && story.structure.grid &&
    story.structure.links && story.structure.nodes &&
    table.nodes === 2 && story.sorted === story.nodes;

  return check(ok,
    `дубликаты id: ${dupes.length ? dupes.join(', ') : 'нет'}; ` +
    `инвентарь: внутри=${inventory.inside}, кнопки=${inventory.buttons.filter(Boolean).length}/5, ` +
    `fit=${inventory.fitted.zoom.toFixed(2)}, сетка=${inventory.snapped}, сброс=${inventory.reset.zoom}; ` +
    `стол: внутри=${table.inside}, кнопки=${table.buttons.filter(Boolean).length}/9, ` +
    `элементов=${table.nodes}, fit=${table.fitted.zoom.toFixed(2)}, сетка=${table.snapped}, сброс=${table.reset.zoom}; ` +
    `сюжет: внутри=${story.inside}, кнопки=${story.buttons.filter(Boolean).length}/7, ` +
    `узлов=${story.nodes}, fit=${story.fitted.zoom.toFixed(2)}, сетка=${story.snapped}, сортировка=${story.sorted}, сброс=${story.reset.zoom}; ` +
    `структура сцены=${story.structure.stage && story.structure.grid && story.structure.links && story.structure.nodes}`,
    { inventory, table, story, dupes });
});

async function main() {
  const startedAt = new Date().toISOString();
  const server = await startServer();
  let page = null;
  const results = [];
  try {
    log(`Открываю ${BASE_URL}`);
    page = await Page.open(BASE_URL, { width: 1600, height: 900 });
    /* TEST_FILTER позволяет прогнать только нужные проверки, например
       TEST_FILTER=arcade node scripts/tests/run.js. */
    const filter = String(process.env.TEST_FILTER || '').trim();
    const selected = filter
      ? TESTS.filter((item) => item.id.includes(filter) || item.title.includes(filter))
      : TESTS;
    for (const item of selected) {
      let result;
      try {
        const value = await item.run(page);
        result = {
          id: item.id,
          patch: item.patch,
          title: item.title,
          status: value.status,
          detail: value.detail,
          metrics: value.metrics
        };
      } catch (error) {
        result = {
          id: item.id,
          patch: item.patch,
          title: item.title,
          status: 'fail',
          detail: `Исключение: ${error.message}`,
          metrics: null
        };
      }
      results.push(result);
      const mark = result.status === 'pass' ? 'PASS' : 'FAIL';
      log(`[${mark}] Патч ${result.patch} · ${result.title} — ${result.detail}`);
    }
  } finally {
    if (page) await page.close();
    if (server) server.kill();
  }

  const finishedAt = new Date().toISOString();
  const passed = results.filter((r) => r.status === 'pass').length;
  const failed = results.filter((r) => r.status === 'fail').length;
  const payload = {
    startedAt,
    finishedAt,
    baseUrl: BASE_URL,
    passed,
    failed,
    total: results.length,
    results
  };
  fs.mkdirSync(path.dirname(JSON_PATH), { recursive: true });
  fs.writeFileSync(JSON_PATH, JSON.stringify(payload, null, 2), 'utf8');
  writeStatus(results, startedAt, finishedAt);
  log('');
  log(`Итого: ${passed} PASS, ${failed} FAIL, ${results.length} проверок.`);
  log(`Статус: ${path.relative(ROOT, STATUS_PATH)}`);
  log(`JSON: ${path.relative(ROOT, JSON_PATH)}`);
  if (failed > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
