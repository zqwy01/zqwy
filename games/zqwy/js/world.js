/* Генератор связного участка Лабиринта.
   Структура: сетка 5×5 комнат, коридоры между соседями, петли.
   Сюжетные комнаты закреплены вручную, остальные получают процедурную планировку. */
(function () {
  'use strict';

  const C = window.CONFIG;
  const W = C.world;

  function hashString(str) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  function mulberry32(a) {
    return function () {
      a |= 0;
      a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function edgeKey(ax, ay, bx, by) {
    if (ax > bx || (ax === bx && ay > by)) {
      return `${bx},${by}|${ax},${ay}`;
    }
    return `${ax},${ay}|${bx},${by}`;
  }

  function parseKey(key) {
    const [a, b] = key.split('|');
    const [ax, ay] = a.split(',').map(Number);
    const [bx, by] = b.split(',').map(Number);
    return { ax, ay, bx, by };
  }

  function generate(seed) {
    const random = mulberry32(hashString(`labyrinth:${seed}`));
    const grid = W.GRID;
    const stepX = W.ROOM_W + W.GAP;
    const stepY = W.ROOM_H + W.GAP;
    const worldW = grid * stepX - W.GAP;
    const worldH = grid * stepY - W.GAP;

    const tabletCell = C.fixedRooms.tablet;
    const trialCell = C.fixedRooms.trial;
    const hazardCell = C.fixedRooms.hazard;
    const lowCell = C.fixedRooms.low;

    /* --- Граф комнат: случайный остовный обход + принудительная цепь к Кругу --- */
    const edges = new Set();
    const visited = new Set();
    const startKey = `${tabletCell.cx},${tabletCell.cy}`;
    const stack = [[tabletCell.cx, tabletCell.cy]];
    visited.add(startKey);

    const dirs = [[0, -1], [1, 0], [0, 1], [-1, 0]];
    while (stack.length) {
      const [cx, cy] = stack[stack.length - 1];
      const options = dirs
        .map(([dx, dy]) => [cx + dx, cy + dy])
        .filter(([nx, ny]) => nx >= 0 && ny >= 0 && nx < grid && ny < grid)
        .filter(([nx, ny]) => !visited.has(`${nx},${ny}`));
      if (!options.length) {
        stack.pop();
        continue;
      }
      const pick = options[Math.floor(random() * options.length)];
      const [nx, ny] = pick;
      edges.add(edgeKey(cx, cy, nx, ny));
      visited.add(`${nx},${ny}`);
      stack.push([nx, ny]);
    }

    function forceEdge(a, b) {
      edges.add(edgeKey(a.cx, a.cy, b.cx, b.cy));
    }
    forceEdge(tabletCell, hazardCell);
    forceEdge(hazardCell, lowCell);
    forceEdge(lowCell, trialCell);

    /* У Круга только один вход — через Слепой зал и Низкий свод. */
    const trialKey = edgeKey(lowCell.cx, lowCell.cy, trialCell.cx, trialCell.cy);
    for (const key of Array.from(edges)) {
      const e = parseKey(key);
      const touchesTrial =
        (e.ax === trialCell.cx && e.ay === trialCell.cy) ||
        (e.bx === trialCell.cx && e.by === trialCell.cy);
      if (touchesTrial && key !== trialKey) edges.delete(key);
    }

    /* Сначала добавляем заметную часть петель, чтобы мир не был голым
       деревом с длинными тупиковыми ветвями. */
    const loopCandidates = [];
    for (let cy = 0; cy < grid; cy++) {
      for (let cx = 0; cx < grid; cx++) {
        for (const [dx, dy] of [[1, 0], [0, 1]]) {
          const nx = cx + dx;
          const ny = cy + dy;
          if (nx >= grid || ny >= grid) continue;
          if (nx === trialCell.cx && ny === trialCell.cy) continue;
          if (cx === trialCell.cx && cy === trialCell.cy) continue;
          const key = edgeKey(cx, cy, nx, ny);
          if (!edges.has(key)) loopCandidates.push({ cx, cy, nx, ny, key });
        }
      }
    }
    for (let i = loopCandidates.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      const tmp = loopCandidates[i];
      loopCandidates[i] = loopCandidates[j];
      loopCandidates[j] = tmp;
    }
    const extraLoops = Math.max(8, Math.round(loopCandidates.length * 0.6));
    for (let i = 0; i < Math.min(extraLoops, loopCandidates.length); i++) {
      edges.add(loopCandidates[i].key);
    }

    /* Вытравливаем оставшиеся тупики: у каждой комнаты, кроме Круга,
       должно быть не меньше двух выходов. Это превращает редкие
       ответвления в проходные петли и сохраняет единственный вход
       в комнату испытания. */
    function degreeAt(cx, cy) {
      let count = 0;
      for (const key of edges) {
        const e = parseKey(key);
        if ((e.ax === cx && e.ay === cy) || (e.bx === cx && e.by === cy)) count++;
      }
      return count;
    }

    function openDeadEnd(cx, cy) {
      const options = dirs
        .map(([dx, dy]) => [cx + dx, cy + dy])
        .filter(([nx, ny]) => nx >= 0 && ny >= 0 && nx < grid && ny < grid)
        .filter(([nx, ny]) => !(nx === trialCell.cx && ny === trialCell.cy))
        .filter(([nx, ny]) => !(cx === trialCell.cx && cy === trialCell.cy))
        .map(([nx, ny]) => ({ nx, ny, key: edgeKey(cx, cy, nx, ny) }))
        .filter((option) => !edges.has(option.key));
      if (!options.length) return false;
      const pick = options[Math.floor(random() * options.length)];
      edges.add(pick.key);
      return true;
    }

    let braidGuard = 0;
    let braided = true;
    while (braided && braidGuard < grid * grid * 3) {
      braidGuard++;
      braided = false;
      for (let cy = 0; cy < grid && !braided; cy++) {
        for (let cx = 0; cx < grid; cx++) {
          if (cx === trialCell.cx && cy === trialCell.cy) continue;
          if (degreeAt(cx, cy) >= 2) continue;
          braided = openDeadEnd(cx, cy);
          if (braided) break;
        }
      }
    }

    /* --- Комнаты --- */
    const fixedByCell = new Map();
    for (const role of Object.keys(C.fixedRooms)) {
      const f = C.fixedRooms[role];
      fixedByCell.set(`${f.cx},${f.cy}`, role);
    }

    const rooms = [];
    const roomByCell = new Map();
    const usedNames = new Map();

    for (let cy = 0; cy < grid; cy++) {
      for (let cx = 0; cx < grid; cx++) {
        const role = fixedByCell.get(`${cx},${cy}`) || 'procedural';
        const meta = C.roomMeta[role];
        let name;
        if (meta) {
          name = meta.name;
        } else {
          const idx = hashString(`${seed}:name:${cx}:${cy}`) % C.proceduralNames.length;
          name = C.proceduralNames[idx];
          const seen = usedNames.get(name) || 0;
          usedNames.set(name, seen + 1);
          if (seen > 0) name += ' · повтор';
        }
        const ox = cx * stepX;
        const oy = cy * stepY;
        const room = {
          id: `r${cx}_${cy}`,
          cx,
          cy,
          ox,
          oy,
          role,
          name,
          tag: meta ? meta.tag : '',
          music: meta ? meta.music : 'labyrinth',
          x1: ox + 1,
          y1: oy + 1,
          x2: ox + W.ROOM_W - 2,
          y2: oy + W.ROOM_H - 2,
          centerX: ox + Math.floor(W.ROOM_W / 2),
          centerY: oy + Math.floor(W.ROOM_H / 2),
          depth: 0,
          links: []
        };
        rooms.push(room);
        roomByCell.set(`${cx},${cy}`, room);
      }
    }

    const edgeList = Array.from(edges).map((key) => {
      const e = parseKey(key);
      const roomA = roomByCell.get(`${e.ax},${e.ay}`);
      const roomB = roomByCell.get(`${e.bx},${e.by}`);
      if (roomA && roomB) {
        roomA.links.push(roomB.id);
        roomB.links.push(roomA.id);
      }
      return { key, a: roomA, b: roomB };
    });

    /* Глубина считается от Скрижали по графу. */
    const startRoom = roomByCell.get(`${tabletCell.cx},${tabletCell.cy}`);
    const queue = [startRoom];
    const seen = new Set([startRoom.id]);
    while (queue.length) {
      const room = queue.shift();
      for (const id of room.links) {
        const next = rooms.find((r) => r.id === id);
        if (!next || seen.has(id)) continue;
        next.depth = room.depth + 1;
        seen.add(id);
        queue.push(next);
      }
    }

    /* --- Тайловая карта --- */
    const tiles = new Uint8Array(worldW * worldH);
    const idx = (x, y) => y * worldW + x;
    const inBounds = (x, y) => x >= 0 && y >= 0 && x < worldW && y < worldH;
    const setTile = (x, y, v) => {
      if (inBounds(x, y)) tiles[idx(x, y)] = v;
    };
    const getTile = (x, y) => (inBounds(x, y) ? tiles[idx(x, y)] : 0);

    for (const room of rooms) {
      for (let y = room.oy; y < room.oy + W.ROOM_H; y++) {
        for (let x = room.ox; x < room.ox + W.ROOM_W; x++) {
          setTile(x, y, 2);
        }
      }
      for (let y = room.y1; y <= room.y2; y++) {
        for (let x = room.x1; x <= room.x2; x++) {
          setTile(x, y, 1);
        }
      }
    }

    for (const edge of edgeList) {
      const a = edge.a;
      const b = edge.b;
      if (!a || !b) continue;
      if (a.cy === b.cy) {
        const left = a.cx < b.cx ? a : b;
        const right = a.cx < b.cx ? b : a;
        const y0 = left.oy + Math.floor(W.ROOM_H / 2);
        for (let x = left.ox + W.ROOM_W - 1; x <= right.ox; x++) {
          for (let y = y0 - 1; y <= y0 + 1; y++) {
            setTile(x, y, 1);
          }
        }
        for (let y = y0 - 1; y <= y0 + 1; y++) {
          setTile(left.ox + W.ROOM_W - 1, y, 5);
          setTile(right.ox, y, 5);
        }
      } else {
        const top = a.cy < b.cy ? a : b;
        const bottom = a.cy < b.cy ? b : a;
        const x0 = top.ox + Math.floor(W.ROOM_W / 2);
        for (let y = top.oy + W.ROOM_H - 1; y <= bottom.oy; y++) {
          for (let x = x0 - 1; x <= x0 + 1; x++) {
            setTile(x, y, 1);
          }
        }
        for (let x = x0 - 1; x <= x0 + 1; x++) {
          setTile(top.oy + W.ROOM_H - 1, x, 5);
          setTile(bottom.oy, x, 5);
        }
      }
    }

    /* --- Вручную заданные детали комнат --- */
    const itemPickups = [];
    const shadows = [];

    function addItem(itemId, x, y, roomId) {
      itemPickups.push({ itemId, x: x + 0.5, y: y + 0.5, roomId });
    }

    for (const room of rooms) {
      const ox = room.ox;
      const oy = room.oy;
      const centerX = room.centerX;
      const centerY = room.centerY;

      if (room.role === 'tablet') {
        for (const [dx, dy] of [[-5, -4], [5, -4], [-5, 4], [5, 4]]) {
          setTile(centerX + dx, centerY + dy, 3);
        }
      } else if (room.role === 'hazard') {
        for (const [dx, dy] of [[-5, -4], [5, -4], [-5, 4], [5, 4], [-4, 0], [4, 0]]) {
          setTile(centerX + dx, centerY + dy, 3);
        }
        shadows.push(
          { cx: ox + 6.5, cy: oy + 5, rx: 3.6, ry: 2.1, speed: 0.62, phase: 0.4 },
          { cx: ox + 14.5, cy: oy + 11.5, rx: 3.2, ry: 2.4, speed: -0.51, phase: 2.3 },
          { cx: ox + 10.5, cy: oy + 8.5, rx: 4.2, ry: 1.7, speed: 0.37, phase: 4.1 }
        );
      } else if (room.role === 'storage') {
        for (let x = ox + 4; x <= ox + 16; x++) {
          if (x === ox + 8 || x === ox + 13) continue;
          setTile(x, oy + 2, 4);
          setTile(x, oy + 3, 4);
        }
        addItem('map_fragment', ox + 4, oy + 6, room.id);
        addItem('chalk', ox + 16, oy + 6, room.id);
      } else if (room.role === 'crossroad') {
        addItem('bead', centerX, centerY, room.id);
      } else if (room.role === 'procedural') {
        const pillarRandom = mulberry32(hashString(`${seed}:pillars:${room.cx}:${room.cy}`));
        const count = 2 + Math.floor(pillarRandom() * 4);
        const doorY = centerY;
        const doorX = centerX;
        let placed = 0;
        let attempts = 0;
        while (placed < count && attempts < 80) {
          attempts++;
          const px = room.x1 + 2 + Math.floor(pillarRandom() * (W.ROOM_W - 6));
          const py = room.y1 + 1 + Math.floor(pillarRandom() * (W.ROOM_H - 4));
          if (Math.abs(px - doorX) <= 2) continue;
          if (Math.abs(py - doorY) <= 2) continue;
          if (Math.abs(px - centerX) <= 2 && Math.abs(py - centerY) <= 2) continue;
          if (getTile(px, py) !== 1) continue;
          setTile(px, py, 3);
          placed++;
        }
      }
    }

    const tabletRoom = roomByCell.get(`${tabletCell.cx},${tabletCell.cy}`);
    const spawn = {
      x: tabletRoom.centerX + 0.5,
      y: tabletRoom.centerY + 3.1,
      roomId: tabletRoom.id
    };

    function roomAtTile(tx, ty) {
      for (const room of rooms) {
        if (tx >= room.ox && tx < room.ox + W.ROOM_W &&
            ty >= room.oy && ty < room.oy + W.ROOM_H) {
          return room;
        }
      }
      return null;
    }

    function roomById(id) {
      return rooms.find((r) => r.id === id) || null;
    }

    function isWalkable(tx, ty) {
      const t = getTile(tx, ty);
      return t === 1 || t === 5 || t === 6;
    }

    return {
      seed,
      width: worldW,
      height: worldH,
      stepX,
      stepY,
      tiles,
      getTile,
      setTile,
      isWalkable,
      rooms,
      roomAtTile,
      roomById,
      edges: edgeList,
      spawn,
      tablet: {
        x: tabletRoom.centerX + 0.5,
        y: tabletRoom.centerY + 0.5,
        roomId: tabletRoom.id
      },
      trialRoom: roomByCell.get(`${trialCell.cx},${trialCell.cy}`),
      hazardRoom: roomByCell.get(`${hazardCell.cx},${hazardCell.cy}`),
      storageRoom: roomByCell.get(`${C.fixedRooms.storage.cx},${C.fixedRooms.storage.cy}`),
      crossroadRoom: roomByCell.get(`${C.fixedRooms.crossroad.cx},${C.fixedRooms.crossroad.cy}`),
      itemPickups,
      shadows,
      cells: { worldW, worldH }
    };
  }

  window.World = {
    generate,
    hashString,
    mulberry32
  };
})();
