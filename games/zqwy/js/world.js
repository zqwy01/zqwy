/* Генератор Лабиринта по чанкам.
   Мир больше не является фиксированной сеткой 5×5: чанки создаются лениво,
   когда игрок подходит к ним. Каждый чанк детерминирован для выбранного seed,
   но новый запуск получает новый seed и, значит, другой Лабиринт.
   Сюжетные комнаты закреплены только в стартовом чанке. */
(function () {
  'use strict';

  const C = window.CONFIG;
  const W = C.world;
  const CHUNK = W.CHUNK || W.GRID || 5;

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

  function cellKey(cx, cy) {
    return `${cx},${cy}`;
  }

  function chunkKey(ccx, ccy) {
    return `${ccx},${ccy}`;
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

  function shuffle(list, random) {
    for (let i = list.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      const tmp = list[i];
      list[i] = list[j];
      list[j] = tmp;
    }
    return list;
  }

  function generate(seed) {
    const ROOM_W_MIN = Math.max(5, Math.round(W.ROOM_W_MIN || 7));
    const ROOM_H_MIN = Math.max(5, Math.round(W.ROOM_H_MIN || 6));
    const ROOM_W_MAX = Math.max(ROOM_W_MIN, Math.round(W.ROOM_W_MAX || W.ROOM_W || 21));
    const ROOM_H_MAX = Math.max(ROOM_H_MIN, Math.round(W.ROOM_H_MAX || W.ROOM_H || 17));
    const stepX = ROOM_W_MAX + W.GAP;
    const stepY = ROOM_H_MAX + W.GAP;
    const chunkW = CHUNK * stepX;
    const chunkH = CHUNK * stepY;

    /* Минимальные размеры сюжетных комнат: в них должны помещаться
       Скрижаль, круг, полки и входы. Остальные комнаты свободно
       гуляют от крошечных до огромных. */
    const ROLE_MIN = {
      tablet: [19, 15],
      hazard: [15, 13],
      low: [11, 9],
      trial: [19, 15],
      storage: [15, 13],
      crossroad: [13, 11],
      beetle: [19, 15],
      umbrella: [21, 17]
    };
    for (const kind of Object.keys(C.fauna || {})) {
      const def = C.fauna[kind];
      ROLE_MIN[kind] = [
        Math.max(ROLE_MIN.tablet[0], Math.round(def.minW || 13)),
        Math.max(ROLE_MIN.tablet[1], Math.round(def.minH || 11))
      ];
    }

    const fixedByCell = new Map();
    for (const role of Object.keys(C.fixedRooms)) {
      const f = C.fixedRooms[role];
      fixedByCell.set(cellKey(f.cx, f.cy), role);
    }

    /* Роль клетки вычисляется детерминированно и до создания комнаты:
       roomBox() соседнего чанка должен видеть те же размеры, что и
       комната, которую материализуют позже. Поэтому шанс фауны тоже
       считается от seed и координат, а не от порядка генерации. */
    function roleAt(cx, cy) {
      const fixed = fixedByCell.get(cellKey(cx, cy));
      if (fixed) return fixed;
      const chance = Number.isFinite(W.faunaChance) ? W.faunaChance : 0.18;
      if (chance <= 0) return 'procedural';
      const roll = hashString(`${seed}:fauna:${cx}:${cy}`) / 4294967296;
      if (roll >= chance) return 'procedural';
      const kinds = Object.keys(C.fauna || {});
      if (!kinds.length) return 'procedural';
      const pick = hashString(`${seed}:faunapick:${cx}:${cy}`) % kinds.length;
      return kinds[pick];
    }

    /* Размер детерминирован для клетки и seed, поэтому соседние чанки
       и прорезание дверей видят одну и ту же комнату, даже если она
       ещё не материализована. */
    function roomDims(cx, cy, role) {
      const roleMin = ROLE_MIN[role] || [ROOM_W_MIN, ROOM_H_MIN];
      const rangeW = ROOM_W_MAX - ROOM_W_MIN + 1;
      const rangeH = ROOM_H_MAX - ROOM_H_MIN + 1;
      const wRoll = hashString(`${seed}:roomw:${cx}:${cy}`) % rangeW;
      const hRoll = hashString(`${seed}:roomh:${cx}:${cy}`) % rangeH;
      const w = Math.min(ROOM_W_MAX, Math.max(ROOM_W_MIN, roleMin[0], ROOM_W_MIN + wRoll));
      const h = Math.min(ROOM_H_MAX, Math.max(ROOM_H_MIN, roleMin[1], ROOM_H_MIN + hRoll));
      return { w, h };
    }

    function roomBox(cx, cy, role) {
      const dims = roomDims(cx, cy, role || roleAt(cx, cy));
      const cellX = cx * stepX;
      const cellY = cy * stepY;
      const ox = cellX + Math.floor((ROOM_W_MAX - dims.w) / 2);
      const oy = cellY + Math.floor((ROOM_H_MAX - dims.h) / 2);
      return {
        cx,
        cy,
        w: dims.w,
        h: dims.h,
        ox,
        oy,
        x1: ox + 1,
        y1: oy + 1,
        x2: ox + dims.w - 2,
        y2: oy + dims.h - 2,
        centerX: ox + Math.floor(dims.w / 2),
        centerY: oy + Math.floor(dims.h / 2)
      };
    }


    const tabletCell = C.fixedRooms.tablet;
    const trialCell = C.fixedRooms.trial;
    const lowCell = C.fixedRooms.low;
    const hazardCell = C.fixedRooms.hazard;
    const trialPairKey = edgeKey(lowCell.cx, lowCell.cy, trialCell.cx, trialCell.cy);

    const rooms = [];
    const roomsByCell = new Map();
    const roomsById = new Map();
    const chunks = new Map();
    const edgeData = new Map();
    const edgesByCell = new Map();
    const itemPickups = [];
    const usedNames = new Map();
    const dirs = [[0, -1], [1, 0], [0, 1], [-1, 0]];
    let proceduralStoryCount = 0;

    function cellInChunk(cx, cy, ccx, ccy) {
      return Math.floor(cx / CHUNK) === ccx && Math.floor(cy / CHUNK) === ccy;
    }

    function linkRooms(a, b) {
      if (!a || !b || a === b) return;
      if (!a.links.includes(b.id)) a.links.push(b.id);
      if (!b.links.includes(a.id)) b.links.push(a.id);
    }

    function createRoom(cx, cy) {
      const key = cellKey(cx, cy);
      const existing = roomsByCell.get(key);
      if (existing) return existing;

      const ccx = Math.floor(cx / CHUNK);
      const ccy = Math.floor(cy / CHUNK);
      const startChunk = ccx === 0 && ccy === 0;
      const role = roleAt(cx, cy);
      const faunaMeta = C.fauna && C.fauna[role] ? C.fauna[role] : null;
      let storyIndex = null;
      if (role === 'procedural' && !startChunk) {
        const chance = proceduralStoryCount === 0
          ? (Number.isFinite(W.storyFirstChance) ? W.storyFirstChance : 0.25)
          : (Number.isFinite(W.storyNextChance) ? W.storyNextChance : 0.08);
        const roll = hashString(`${seed}:story:${cx}:${cy}`) / 4294967296;
        if (roll < chance) {
          storyIndex = hashString(`${seed}:storypick:${cx}:${cy}`) % C.proceduralStories.length;
          proceduralStoryCount++;
        }
      }
      const meta = C.roomMeta[role];
      let name;

      if (meta) {
        name = meta.name;
      } else if (faunaMeta) {
        name = faunaMeta.name;
      } else {
        const idx = hashString(`${seed}:name:${cx}:${cy}`) % C.proceduralNames.length;
        name = C.proceduralNames[idx];
        const seen = usedNames.get(name) || 0;
        usedNames.set(name, seen + 1);
        if (seen > 0) name += ' · повтор';
      }

      const box = roomBox(cx, cy, role);
      const room = {
        id: `r${cx}_${cy}`,
        cx,
        cy,
        chunkX: ccx,
        chunkY: ccy,
        ox: box.ox,
        oy: box.oy,
        w: box.w,
        h: box.h,
        role,
        faunaKind: faunaMeta ? role : null,
        storyIndex,
        name,
        tag: meta ? meta.tag : (faunaMeta ? faunaMeta.tag : ''),
        music: meta ? meta.music : 'labyrinth',
        x1: box.x1,
        y1: box.y1,
        x2: box.x2,
        y2: box.y2,
        centerX: box.centerX,
        centerY: box.centerY,
        depth: 0,
        links: []
      };

      rooms.push(room);
      roomsByCell.set(key, room);
      roomsById.set(room.id, room);

      /* Если соседняя комната уже существует, материализуем заранее
         вычисленные коридоры в двусторонние ссылки. */
      const touched = edgesByCell.get(key);
      if (touched) {
        for (const ek of touched) {
          const e = edgeData.get(ek);
          if (!e) continue;
          const other = (e.ax === cx && e.ay === cy)
            ? roomsByCell.get(cellKey(e.bx, e.by))
            : roomsByCell.get(cellKey(e.ax, e.ay));
          if (other) linkRooms(room, other);
        }
      }

      return room;
    }

    function addEdge(ax, ay, bx, by) {
      const key = edgeKey(ax, ay, bx, by);
      if (edgeData.has(key)) return;
      const touchesTrial =
        (ax === trialCell.cx && ay === trialCell.cy) ||
        (bx === trialCell.cx && by === trialCell.cy);
      if (touchesTrial && key !== trialPairKey) return;

      const edge = { key, ax, ay, bx, by };
      edgeData.set(key, edge);

      const aKey = cellKey(ax, ay);
      const bKey = cellKey(bx, by);
      if (!edgesByCell.has(aKey)) edgesByCell.set(aKey, new Set());
      if (!edgesByCell.has(bKey)) edgesByCell.set(bKey, new Set());
      edgesByCell.get(aKey).add(key);
      edgesByCell.get(bKey).add(key);

      const a = roomsByCell.get(aKey);
      const b = roomsByCell.get(bKey);
      if (a && b) linkRooms(a, b);
    }

    function edgeExists(ax, ay, bx, by) {
      return edgeData.has(edgeKey(ax, ay, bx, by));
    }

    function localTile(chunk, x, y) {
      const lx = x - chunk.ox;
      const ly = y - chunk.oy;
      if (lx < 0 || ly < 0 || lx >= chunkW || ly >= chunkH) return -1;
      return ly * chunkW + lx;
    }

    function setTileInChunk(chunk, x, y, value) {
      const index = localTile(chunk, x, y);
      if (index < 0) return;
      chunk.tiles[index] = value;
    }

    function corridorWidth(edge) {
      const min = Math.max(1, Math.round(W.corridorMin || 1));
      const max = Math.max(min, Math.round(W.corridorMax || min));
      const span = max - min + 1;
      const value = hashString(
        `${seed}:corridor:${edge.ax}:${edge.ay}:${edge.bx}:${edge.by}`
      ) % span;
      return min + value;
    }

    /* Проход входит в комнату не по центру стены, а в произвольном
       месте её внутреннего отрезка. Позиция двери детерминирована для
       ребра, поэтому соседние чанки прорезают одну и ту же стену. */
    function doorStart(edge, from, to, width) {
      const span = Math.max(0, to - from + 1 - width);
      const offset = hashString(
        `${seed}:door:${edge.ax}:${edge.ay}:${edge.bx}:${edge.by}:${width}`
      ) % (span + 1);
      return from + offset;
    }

    function carveEdge(chunk, edge) {
      const width = corridorWidth(edge);
      if (edge.ay === edge.by) {
        /* Горизонтальный коридор: комнаты стоят слева и справа.
           Комнаты разной высоты и смещены внутри клетки, поэтому
           проход ищет пересечение их внутренних отрезков. */
        const leftCell = edge.ax < edge.bx ? [edge.ax, edge.ay] : [edge.bx, edge.by];
        const rightCell = edge.ax < edge.bx ? [edge.bx, edge.by] : [edge.ax, edge.ay];
        const leftBox = roomBox(leftCell[0], leftCell[1]);
        const rightBox = roomBox(rightCell[0], rightCell[1]);
        const innerTop = Math.max(leftBox.y1, rightBox.y1);
        const innerBottom = Math.min(leftBox.y2, rightBox.y2);
        const span = Math.max(1, innerBottom - innerTop + 1);
        const doorWidth = Math.min(width, span);
        const y1 = doorStart(edge, innerTop, innerBottom, doorWidth);
        const y2 = y1 + doorWidth - 1;
        const xStart = leftBox.ox + leftBox.w - 1;
        const xEnd = rightBox.ox;
        for (let x = xStart; x <= xEnd; x++) {
          for (let y = y1; y <= y2; y++) {
            setTileInChunk(chunk, x, y, 1);
          }
        }
        for (let y = y1; y <= y2; y++) {
          setTileInChunk(chunk, xStart, y, 5);
          setTileInChunk(chunk, xEnd, y, 5);
        }
      } else {
        /* Вертикальный коридор: комнаты стоят сверху и снизу. */
        const topCell = edge.ay < edge.by ? [edge.ax, edge.ay] : [edge.bx, edge.by];
        const bottomCell = edge.ay < edge.by ? [edge.bx, edge.by] : [edge.ax, edge.ay];
        const topBox = roomBox(topCell[0], topCell[1]);
        const bottomBox = roomBox(bottomCell[0], bottomCell[1]);
        const innerLeft = Math.max(topBox.x1, bottomBox.x1);
        const innerRight = Math.min(topBox.x2, bottomBox.x2);
        const span = Math.max(1, innerRight - innerLeft + 1);
        const doorWidth = Math.min(width, span);
        const x1 = doorStart(edge, innerLeft, innerRight, doorWidth);
        const x2 = x1 + doorWidth - 1;
        const yStart = topBox.oy + topBox.h - 1;
        const yEnd = bottomBox.oy;
        for (let y = yStart; y <= yEnd; y++) {
          for (let x = x1; x <= x2; x++) {
            setTileInChunk(chunk, x, y, 1);
          }
        }
        for (let x = x1; x <= x2; x++) {
          setTileInChunk(chunk, x, yStart, 5);
          setTileInChunk(chunk, x, yEnd, 5);
        }
      }
    }

    function recomputeDepths() {
      const start = roomsByCell.get(cellKey(tabletCell.cx, tabletCell.cy));
      for (const room of rooms) room.depth = 0;
      if (!start) return;
      const seen = new Set([start.id]);
      const queue = [start];
      while (queue.length) {
        const room = queue.shift();
        for (const id of room.links) {
          const next = roomsById.get(id);
          if (!next || seen.has(id)) continue;
          next.depth = room.depth + 1;
          seen.add(id);
          queue.push(next);
        }
      }
    }

    function addVerticalBoundary(leftChunkCx, ccy, leftCx, rightCx, cellY0) {
      const base = hashString(`${seed}:v:${leftChunkCx}:${ccy}`) % CHUNK;
      for (let i = 0; i < CHUNK; i++) {
        const y = cellY0 + i;
        if (roleAt(leftCx, y) === 'trial' || roleAt(rightCx, y) === 'trial') continue;
        const chance = hashString(`${seed}:ve:${leftCx}:${y}`) / 4294967296;
        if (i === base || chance < 0.3) addEdge(leftCx, y, rightCx, y);
      }
    }

    function addHorizontalBoundary(ccx, bottomChunkCy, cellX0, topCy, bottomCy) {
      const base = hashString(`${seed}:h:${ccx}:${bottomChunkCy}`) % CHUNK;
      for (let i = 0; i < CHUNK; i++) {
        const x = cellX0 + i;
        if (roleAt(x, topCy) === 'trial' || roleAt(x, bottomCy) === 'trial') continue;
        const chance = hashString(`${seed}:he:${x}:${topCy}`) / 4294967296;
        if (i === base || chance < 0.3) addEdge(x, topCy, x, bottomCy);
      }
    }

    function addBoundaryEdges(ccx, ccy) {
      const cellX0 = ccx * CHUNK;
      const cellY0 = ccy * CHUNK;
      /* Западная граница — это восточная граница соседнего чанка слева. */
      addVerticalBoundary(ccx - 1, ccy, cellX0 - 1, cellX0, cellY0);
      /* Восточная граница — левый чанк текущий. */
      addVerticalBoundary(ccx, ccy, cellX0 + CHUNK - 1, cellX0 + CHUNK, cellY0);
      /* Северная граница — нижний чанк текущий. */
      addHorizontalBoundary(ccx, ccy, cellX0, cellY0 - 1, cellY0);
      /* Южная граница — нижний чанк следующий. */
      addHorizontalBoundary(ccx, ccy + 1, cellX0, cellY0 + CHUNK - 1, cellY0 + CHUNK);
    }

    function decorateRoom(room, chunk) {
      const ox = room.ox;
      const oy = room.oy;
      const centerX = room.centerX;
      const centerY = room.centerY;
      const dxWide = Math.max(2, Math.min(5, Math.floor(room.w / 4)));
      const dyTall = Math.max(2, Math.min(4, Math.floor(room.h / 4)));

      if (room.role === 'tablet') {
        for (const [dx, dy] of [[-dxWide, -dyTall], [dxWide, -dyTall], [-dxWide, dyTall], [dxWide, dyTall]]) {
          setTileInChunk(chunk, centerX + dx, centerY + dy, 3);
        }
      } else if (room.role === 'hazard') {
        for (const [dx, dy] of [[-dxWide, -dyTall], [dxWide, -dyTall], [-dxWide, dyTall], [dxWide, dyTall], [-dxWide + 1, -2], [dxWide - 1, 2]]) {
          setTileInChunk(chunk, centerX + dx, centerY + dy, 3);
        }
      } else if (room.role === 'storage') {
        for (let x = room.x1 + 2; x <= room.x2 - 2; x++) {
          if (x === room.x1 + Math.floor(room.w * 0.45) ||
              x === room.x1 + Math.floor(room.w * 0.72)) continue;
          /* Центральная колонна остаётся свободной: через неё проходит
             вертикальный коридор и вход в комнату. */
          if (Math.abs(x - centerX) <= 1) continue;
          setTileInChunk(chunk, x, oy + 2, 4);
          setTileInChunk(chunk, x, oy + 3, 4);
        }
        if (!itemPickups.some((p) => p.itemId === 'map_fragment')) {
          itemPickups.push({ itemId: 'map_fragment', x: room.x1 + 2.5, y: oy + Math.min(room.h - 2, 6) + 0.5, roomId: room.id });
          itemPickups.push({ itemId: 'chalk', x: room.x2 - 1.5, y: oy + Math.min(room.h - 2, 6) + 0.5, roomId: room.id });
        }
      } else if (room.role === 'crossroad') {
        if (!itemPickups.some((p) => p.itemId === 'bead')) {
          itemPickups.push({ itemId: 'bead', x: centerX + 0.5, y: centerY + 0.5, roomId: room.id });
        }
      } else if (room.role === 'procedural') {
        const pillarRandom = mulberry32(hashString(`${seed}:pillars:${room.cx}:${room.cy}`));
        const count = 2 + Math.floor(pillarRandom() * 4);
        let placed = 0;
        let attempts = 0;
        while (placed < count && attempts < 90) {
          attempts++;
          const px = room.x1 + 2 + Math.floor(pillarRandom() * Math.max(1, room.w - 4));
          const py = room.y1 + 1 + Math.floor(pillarRandom() * Math.max(1, room.h - 3));
          if (Math.abs(px - centerX) <= 1 || Math.abs(py - centerY) <= 1) continue;
          const index = localTile(chunk, px, py);
          if (index < 0 || chunk.tiles[index] !== 1) continue;
          setTileInChunk(chunk, px, py, 3);
          placed++;
        }
      }
    }

    function ensureChunk(ccx, ccy) {
      const key = chunkKey(ccx, ccy);
      const existing = chunks.get(key);
      if (existing) return existing;

      const chunk = {
        ccx,
        ccy,
        ox: ccx * chunkW,
        oy: ccy * chunkH,
        tiles: new Uint8Array(chunkW * chunkH)
      };
      /* Кладём чанк в карту до генерации: getTile не должен рекурсивно
         пытаться создать его снова. */
      chunks.set(key, chunk);

      const cellX0 = ccx * CHUNK;
      const cellY0 = ccy * CHUNK;
      const random = mulberry32(hashString(`chunk:${seed}:${ccx}:${ccy}`));

      for (let iy = 0; iy < CHUNK; iy++) {
        for (let ix = 0; ix < CHUNK; ix++) {
          createRoom(cellX0 + ix, cellY0 + iy);
        }
      }

      /* Сюжетная цепь: Скрижаль → Слепой зал → Низкий свод → Круг. */
      if (ccx === 0 && ccy === 0) {
        addEdge(tabletCell.cx, tabletCell.cy, hazardCell.cx, hazardCell.cy);
        addEdge(hazardCell.cx, hazardCell.cy, lowCell.cx, lowCell.cy);
        addEdge(lowCell.cx, lowCell.cy, trialCell.cx, trialCell.cy);
        const beetleCell = C.fixedRooms.beetle;
        if (beetleCell) {
          addEdge(tabletCell.cx, tabletCell.cy, beetleCell.cx, beetleCell.cy);
        }
        const umbrellaCell = C.fixedRooms.umbrella;
        if (umbrellaCell) {
          addEdge(beetleCell.cx, beetleCell.cy, umbrellaCell.cx, umbrellaCell.cy);
          addEdge(C.fixedRooms.crossroad.cx, C.fixedRooms.crossroad.cy, umbrellaCell.cx, umbrellaCell.cy);
        }
      }

      /* Случайный остовный обход внутри чанка. */
      const visited = new Set();
      const start = [cellX0, cellY0];
      const stack = [start];
      visited.add(cellKey(start[0], start[1]));
      while (stack.length) {
        const [cx, cy] = stack[stack.length - 1];
        const options = dirs
          .map(([dx, dy]) => [cx + dx, cy + dy])
          .filter(([nx, ny]) => cellInChunk(nx, ny, ccx, ccy))
          .filter(([nx, ny]) => !visited.has(cellKey(nx, ny)))
          .filter(([nx, ny]) => !edgeExists(cx, cy, nx, ny))
          .filter(([nx, ny]) => {
            const touchesTrial =
              (cx === trialCell.cx && cy === trialCell.cy) ||
              (nx === trialCell.cx && ny === trialCell.cy);
            return !touchesTrial ||
              edgeKey(cx, cy, nx, ny) === trialPairKey;
          });
        if (!options.length) {
          stack.pop();
          continue;
        }
        const pick = options[Math.floor(random() * options.length)];
        addEdge(cx, cy, pick[0], pick[1]);
        visited.add(cellKey(pick[0], pick[1]));
        stack.push(pick);
      }

      /* Добавляем петли, чтобы мир не превращался в длинное дерево. */
      const loopCandidates = [];
      for (let iy = 0; iy < CHUNK; iy++) {
        for (let ix = 0; ix < CHUNK; ix++) {
          const cx = cellX0 + ix;
          const cy = cellY0 + iy;
          for (const [dx, dy] of [[1, 0], [0, 1]]) {
            const nx = cx + dx;
            const ny = cy + dy;
            if (!cellInChunk(nx, ny, ccx, ccy)) continue;
            if (edgeExists(cx, cy, nx, ny)) continue;
            const touchesTrial =
              (cx === trialCell.cx && cy === trialCell.cy) ||
              (nx === trialCell.cx && ny === trialCell.cy);
            if (touchesTrial) continue;
            loopCandidates.push([cx, cy, nx, ny]);
          }
        }
      }
      shuffle(loopCandidates, random);
      const loops = Math.max(4, Math.round(loopCandidates.length * 0.58));
      for (let i = 0; i < Math.min(loops, loopCandidates.length); i++) {
        const [ax, ay, bx, by] = loopCandidates[i];
        addEdge(ax, ay, bx, by);
      }

      /* Двери на границах чанков. Они детерминированы для обеих сторон,
         поэтому соседние чанки соединяются без общих глобальных координат. */
      addBoundaryEdges(ccx, ccy);

      /* Вытравливаем тупики: у каждой комнаты, кроме Круга, должно быть
         минимум два выхода. */
      let guard = 0;
      let braided = true;
      while (braided && guard < CHUNK * CHUNK * 4) {
        guard++;
        braided = false;
        for (let iy = 0; iy < CHUNK && !braided; iy++) {
          for (let ix = 0; ix < CHUNK; ix++) {
            const cx = cellX0 + ix;
            const cy = cellY0 + iy;
            const room = roomsByCell.get(cellKey(cx, cy));
            if (!room || room.role === 'trial' || room.links.length >= 2) continue;
            const options = shuffle(dirs
              .map(([dx, dy]) => [cx + dx, cy + dy])
              .filter(([nx, ny]) => !edgeExists(cx, cy, nx, ny))
              .filter(([nx, ny]) => {
                const touchesTrial =
                  (cx === trialCell.cx && cy === trialCell.cy) ||
                  (nx === trialCell.cx && ny === trialCell.cy);
                if (touchesTrial) return false;
                return true;
              }), random);
            if (!options.length) continue;
            addEdge(cx, cy, options[0][0], options[0][1]);
            braided = true;
            break;
          }
        }
      }

      /* Сначала комнаты, затем коридоры: двери должны прорезать стены. */
      for (let iy = 0; iy < CHUNK; iy++) {
        for (let ix = 0; ix < CHUNK; ix++) {
          const room = roomsByCell.get(cellKey(cellX0 + ix, cellY0 + iy));
          if (!room) continue;
          for (let y = room.oy; y < room.oy + room.h; y++) {
            for (let x = room.ox; x < room.ox + room.w; x++) {
              setTileInChunk(chunk, x, y, 2);
            }
          }
          for (let y = room.y1; y <= room.y2; y++) {
            for (let x = room.x1; x <= room.x2; x++) {
              setTileInChunk(chunk, x, y, 1);
            }
          }
        }
      }

      /* Украшения ставим до коридоров: смещённый проход должен
         прорезать и стену, и случайно оказавшуюся на его пути
         колонну, а не упираться в неё. */
      for (let iy = 0; iy < CHUNK; iy++) {
        for (let ix = 0; ix < CHUNK; ix++) {
          const room = roomsByCell.get(cellKey(cellX0 + ix, cellY0 + iy));
          if (room) decorateRoom(room, chunk);
        }
      }

      for (const edge of edgeData.values()) {
        const touchesChunk =
          cellInChunk(edge.ax, edge.ay, ccx, ccy) ||
          cellInChunk(edge.bx, edge.by, ccx, ccy);
        if (touchesChunk) carveEdge(chunk, edge);
      }

      recomputeDepths();
      return chunk;
    }

    function getTile(x, y) {
      const chunk = ensureChunk(Math.floor(x / chunkW), Math.floor(y / chunkH));
      const index = localTile(chunk, x, y);
      return index < 0 ? 0 : chunk.tiles[index];
    }

    function isWalkable(tx, ty) {
      const tile = getTile(tx, ty);
      return tile === 1 || tile === 5 || tile === 6;
    }

    function roomAtTile(tx, ty) {
      const cx = Math.floor(tx / stepX);
      const cy = Math.floor(ty / stepY);
      const room = roomsByCell.get(cellKey(cx, cy));
      if (!room) return null;
      if (tx >= room.ox && tx < room.ox + room.w &&
          ty >= room.oy && ty < room.oy + room.h) {
        return room;
      }
      return null;
    }

    function roomById(id) {
      return roomsById.get(id) || null;
    }

    function materializedEdges() {
      const list = [];
      for (const e of edgeData.values()) {
        const a = roomsByCell.get(cellKey(e.ax, e.ay));
        const b = roomsByCell.get(cellKey(e.bx, e.by));
        if (a && b) list.push({ key: e.key, a, b });
      }
      return list;
    }

    function ensureAround(x, y, margin) {
      const m = margin || 0;
      ensureChunk(Math.floor((x - m) / chunkW), Math.floor((y - m) / chunkH));
      ensureChunk(Math.floor((x + m) / chunkW), Math.floor((y + m) / chunkH));
    }

    /* Обеспечивает все чанки, покрывающие прямоугольник в тайлах.
       Нужно отрисовке и карте: камера может стоять на стыке чанков. */
    function ensureRange(x0, y0, x1, y1) {
      const cx0 = Math.floor(Math.min(x0, x1) / chunkW);
      const cy0 = Math.floor(Math.min(y0, y1) / chunkH);
      const cx1 = Math.floor(Math.max(x0, x1) / chunkW);
      const cy1 = Math.floor(Math.max(y0, y1) / chunkH);
      for (let cy = cy0; cy <= cy1; cy++) {
        for (let cx = cx0; cx <= cx1; cx++) ensureChunk(cx, cy);
      }
      return { cx0, cy0, cx1, cy1 };
    }

    /* Стартовый чанк создаётся сразу: в нём Скрижаль, сюжетные комнаты
       и место появления. Остальные чанки — по мере приближения. */
    ensureChunk(0, 0);

    const tabletRoom = roomsByCell.get(cellKey(tabletCell.cx, tabletCell.cy));
    const spawn = {
      x: tabletRoom.centerX + 0.5,
      y: tabletRoom.centerY + 3.1,
      roomId: tabletRoom.id
    };

    const api = {
      seed,
      CHUNK,
      chunkW,
      chunkH,
      stepX,
      stepY,
      rooms,
      getTile,
      isWalkable,
      roomAtTile,
      roomById,
      getEdges: materializedEdges,
      ensureChunk,
      ensureAround,
      ensureRange,
      get chunkCount() { return chunks.size; },
      spawn,
      tablet: {
        x: tabletRoom.centerX + 0.5,
        y: tabletRoom.centerY + 0.5,
        roomId: tabletRoom.id
      },
      trialRoom: roomsByCell.get(cellKey(trialCell.cx, trialCell.cy)),
      hazardRoom: roomsByCell.get(cellKey(hazardCell.cx, hazardCell.cy)),
      storageRoom: roomsByCell.get(cellKey(C.fixedRooms.storage.cx, C.fixedRooms.storage.cy)),
      crossroadRoom: roomsByCell.get(cellKey(C.fixedRooms.crossroad.cx, C.fixedRooms.crossroad.cy)),
      beetleRoom: roomsByCell.get(cellKey(C.fixedRooms.beetle.cx, C.fixedRooms.beetle.cy)),
      umbrellaRoom: roomsByCell.get(cellKey(C.fixedRooms.umbrella.cx, C.fixedRooms.umbrella.cy)),
      itemPickups
    };

    Object.defineProperty(api, 'faunaRooms', {
      enumerable: true,
      get() {
        return rooms.filter((room) => Boolean(room.faunaKind));
      }
    });

    Object.defineProperty(api, 'edges', {
      enumerable: true,
      get: materializedEdges
    });

    return api;
  }

  window.World = {
    generate,
    hashString,
    mulberry32
  };
})();
