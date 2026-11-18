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
      mirror: [17, 13],
      beetle: [19, 15],
      umbrella: [21, 17],
      eared: [15, 13]
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
      const kinds = Object.keys(C.fauna || {}).filter((kind) => kind !== 'titanoboa');
      if (!kinds.length) return 'procedural';
      /* Титанобоа существует ровно одна на весь мир и только в
         закреплённой комнате стартового чанка. Остальная фауна
         выбирается с перевесом бельзебуфо: она встречается чаще. */
      const share = Number.isFinite(W.belzebufoShare) ? W.belzebufoShare : 0.62;
      const pickRoll = hashString(`${seed}:faunapick:${cx}:${cy}`) / 4294967296;
      if (kinds.includes('belzebufo') && pickRoll < share) return 'belzebufo';
      const others = kinds.filter((kind) => kind !== 'belzebufo');
      const pool = others.length ? others : kinds;
      return pool[hashString(`${seed}:faunapick2:${cx}:${cy}`) % pool.length];
    }

    /* Размер детерминирован для клетки и seed, поэтому соседние чанки
       и прорезание дверей видят одну и ту же комнату, даже если она
       ещё не материализована. */
    function roomDims(cx, cy, role) {
      const roleMin = ROLE_MIN[role] || [ROOM_W_MIN, ROOM_H_MIN];
      const rangeW = Math.max(0, ROOM_W_MAX - ROOM_W_MIN);
      const rangeH = Math.max(0, ROOM_H_MAX - ROOM_H_MIN);
      /* Мир — граф из множества небольших залов. Размер выбирается
         детерминированной корзиной: большинство комнат маленькие,
         часть средние, и лишь немногие огромные. Сюжетные и фаунные
         комнаты остаются не меньше своего минимума. */
      const small = Number.isFinite(W.smallRoomBias) ? W.smallRoomBias : 0.72;
      const mid = Number.isFinite(W.midRoomBias) ? W.midRoomBias : 0.23;
      const bucket = hashString(`${seed}:roomsize:${cx}:${cy}`) / 4294967296;
      let low;
      let high;
      if (bucket < small) {
        low = 0.04;
        high = 0.28;
      } else if (bucket < small + mid) {
        low = 0.34;
        high = 0.6;
      } else {
        low = 0.68;
        high = 1;
      }
      const wNoise = hashString(`${seed}:roomw:${cx}:${cy}`) / 4294967296;
      const hNoise = hashString(`${seed}:roomh:${cx}:${cy}`) / 4294967296;
      const wFrac = low + (high - low) * wNoise;
      const hFrac = low + (high - low) * hNoise;
      const w = Math.min(ROOM_W_MAX, Math.max(ROOM_W_MIN, roleMin[0], ROOM_W_MIN + Math.round(rangeW * wFrac)));
      const h = Math.min(ROOM_H_MAX, Math.max(ROOM_H_MIN, roleMin[1], ROOM_H_MIN + Math.round(rangeH * hFrac)));
      return { w, h };
    }

    /* ---------------- Формы залов ---------------- */
    /* Сюжетные залы остаются прямоугольными: в них стоят Скрижаль,
       круг испытания и полки, и случайная ниша может сломать сцену.
       Процедурные и фаунные залы получают детерминированный силуэт,
       поэтому один и тот же seed всегда даёт ту же комнату, а двери
       соседних чанков прорезают именно её. */
    const STORY_ROLES = {
      tablet: true, hazard: true, low: true, trial: true,
      storage: true, crossroad: true, mirror: true,
      beetle: true, umbrella: true, eared: true
    };
    const SHAPE_KINDS = ['rect', 'chamfer', 'ellipse', 'hourglass', 'cross', 'lshape', 'cave'];

    function roomShape(cx, cy, role) {
      const kind = role || roleAt(cx, cy);
      if (STORY_ROLES[kind]) return 'rect';
      /* Зал титанобоа — намеренно огромная неровная пещера. */
      if (kind === 'titanoboa') return 'cave';
      const roll = hashString(`${seed}:roomshape:${cx}:${cy}`) / 4294967296;
      /* Больше половины залов всё же прямоугольные: разнообразие не
         должно превращать Лабиринт в набор одинаковых овалов. */
      const weights = Array.isArray(W.shapeWeights) && W.shapeWeights.length
        ? W.shapeWeights
        : [
          { kind: 'rect', weight: 46 },
          { kind: 'chamfer', weight: 12 },
          { kind: 'ellipse', weight: 12 },
          { kind: 'hourglass', weight: 7 },
          { kind: 'cross', weight: 7 },
          { kind: 'lshape', weight: 8 },
          { kind: 'cave', weight: 8 }
        ];
      let total = 0;
      for (const entry of weights) total += Math.max(0, Number(entry.weight) || 0);
      if (!(total > 0)) {
        return SHAPE_KINDS[Math.floor(roll * SHAPE_KINDS.length) % SHAPE_KINDS.length];
      }
      let cursor = roll * total;
      for (const entry of weights) {
        cursor -= Math.max(0, Number(entry.weight) || 0);
        if (cursor <= 0) {
          const candidate = String(entry.kind || 'rect');
          return SHAPE_KINDS.includes(candidate) ? candidate : 'rect';
        }
      }
      return 'rect';
    }

    /* Маска задаётся в координатах внутреннего прямоугольника зала
       (0…w-3, 0…h-3): внешняя стена толщиной в тайл остаётся целой,
       а всё, что снаружи маски, автоматически становится стеной. */
    function shapeContains(shape, lx, ly, iw, ih, cx, cy) {
      if (shape === 'rect' || !shape) return true;
      const u = (lx + 0.5) / Math.max(1, iw) - 0.5;
      const v = (ly + 0.5) / Math.max(1, ih) - 0.5;
      const au = Math.abs(u);
      const av = Math.abs(v);
      const seedRoll = hashString(`${seed}:shape:${shape}:${cx}:${cy}`) / 4294967296;
      if (shape === 'chamfer') {
        const cut = Math.max(1, Math.round(Math.min(iw, ih) * (0.14 + seedRoll * 0.12)));
        const edge = Math.min(
          lx + ly,
          (iw - 1 - lx) + ly,
          lx + (ih - 1 - ly),
          (iw - 1 - lx) + (ih - 1 - ly)
        );
        return edge >= cut;
      }
      if (shape === 'ellipse') {
        const wobble = 0.055 * Math.sin(
          Math.atan2(v, u) * 5 + seedRoll * Math.PI * 2
        );
        return (u * u) / 0.25 + (v * v) / 0.25 <= 1 + wobble;
      }
      if (shape === 'hourglass') {
        /* Узкая середина и широкие концы: зал будто перетянут. */
        return au <= 0.14 + 0.7 * av;
      }
      if (shape === 'cross') {
        const band = 0.16 + seedRoll * 0.06;
        return av <= band || au <= band;
      }
      if (shape === 'lshape') {
        /* Вырезаем один верхний угол, но не задеваем центр. */
        const side = seedRoll < 0.5 ? 1 : -1;
        return !(u * side > 0.05 && v < -0.05);
      }
      if (shape === 'cave') {
        const angle = Math.atan2(v, u);
        const radius = Math.hypot(u / 0.5, v / 0.5);
        const wobble = 0.12 * Math.sin(angle * 3 + seedRoll * 6.283) +
          0.07 * Math.sin(angle * 5 - seedRoll * 9.1);
        return radius <= 0.86 + wobble;
      }
      return true;
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
    const arcades = [];
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
      const musicCue = C.musicCues && C.musicCues[role] ? role : 'labyrinth';
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
        shape: roomShape(cx, cy, role),
        faunaKind: faunaMeta ? role : null,
        storyIndex,
        name,
        tag: meta ? meta.tag : (faunaMeta ? faunaMeta.tag : ''),
        music: meta ? meta.music : musicCue,
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

    /* Дверь всегда доходит до пола, даже если форма зала скошена и
       у стены нет ни одной проходимой клетки. Прорезаем «горловину»
       вглубь зала до первого пола; для прямоугольных залов она пустая. */
    function carveThroat(chunk, startX, startY, dirX, dirY, width, depthLimit) {
      const rows = Math.max(1, Math.round(width));
      /* Каждая линия двери прорезается до первого пола отдельно:
         иначе у скошенной стены половина проёма оставалась бы в стене. */
      for (let w = 0; w < rows; w += 1) {
        for (let d = 1; d <= depthLimit; d += 1) {
          const x = startX + dirX * d + (dirX ? 0 : w);
          const y = startY + dirY * d + (dirY ? 0 : w);
          const index = localTile(chunk, x, y);
          /* Комната целиком в другом чанке: её сторону прорежет
             соседний проход, здесь трогать нечего. */
          if (index < 0) break;
          const tile = chunk.tiles[index];
          if (tile === 1 || tile === 6) break;
          chunk.tiles[index] = 1;
        }
      }
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
        /* Если у стены нет пола из-за формы зала, дверь прорезает
           горловину вглубь, пока не встретит пол. */
        const depthLeft = Math.max(4, Math.min(18,
          Math.floor(Math.min(leftBox.w, leftBox.h) * 0.6)));
        const depthRight = Math.max(4, Math.min(18,
          Math.floor(Math.min(rightBox.w, rightBox.h) * 0.6)));
        carveThroat(chunk, xStart, y1, -1, 0, doorWidth, depthLeft);
        carveThroat(chunk, xEnd, y1, 1, 0, doorWidth, depthRight);
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
        const depthTop = Math.max(4, Math.min(18,
          Math.floor(Math.min(topBox.w, topBox.h) * 0.6)));
        const depthBottom = Math.max(4, Math.min(18,
          Math.floor(Math.min(bottomBox.w, bottomBox.h) * 0.6)));
        carveThroat(chunk, x1, yStart, 0, -1, doorWidth, depthTop);
        carveThroat(chunk, x1, yEnd, 0, 1, doorWidth, depthBottom);
      }
    }

    function addVerticalBoundary(leftChunkCx, ccy, leftCx, rightCx, cellY0) {
      const base = hashString(`${seed}:v:${leftChunkCx}:${ccy}`) % CHUNK;
      for (let i = 0; i < CHUNK; i++) {
        const y = cellY0 + i;
        if (roleAt(leftCx, y) === 'trial' || roleAt(rightCx, y) === 'trial') continue;
        const chance = hashString(`${seed}:ve:${leftCx}:${y}`) / 4294967296;
        const edgeChance = Number.isFinite(W.boundaryChance) ? W.boundaryChance : 0.42;
        if (i === base || chance < edgeChance) addEdge(leftCx, y, rightCx, y);
      }
    }

    function addHorizontalBoundary(ccx, bottomChunkCy, cellX0, topCy, bottomCy) {
      const base = hashString(`${seed}:h:${ccx}:${bottomChunkCy}`) % CHUNK;
      for (let i = 0; i < CHUNK; i++) {
        const x = cellX0 + i;
        if (roleAt(x, topCy) === 'trial' || roleAt(x, bottomCy) === 'trial') continue;
        const chance = hashString(`${seed}:he:${x}:${topCy}`) / 4294967296;
        const edgeChance = Number.isFinite(W.boundaryChance) ? W.boundaryChance : 0.42;
        if (i === base || chance < edgeChance) addEdge(x, topCy, x, bottomCy);
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

      /* Аркадный автомат: редкая находка процедурных залов. Место
         выбирается детерминированно от seed и комнаты, поэтому один и
         тот же мир всегда показывает автомат в одном и том же углу.
         Автомат не занимает клетку пола: к нему можно подойти вплотную. */
      if (room.role === 'procedural' && !room.arcade) {
        const chance = Number.isFinite(W.arcadeChance) ? W.arcadeChance : 0.16;
        const roll = hashString(`${seed}:arcade:${room.cx}:${room.cy}`) / 4294967296;
        if (roll < chance) {
          const rand = mulberry32(hashString(`${seed}:arcadeplace:${room.cx}:${room.cy}`));
          const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
          for (let attempt = 0; attempt < 56; attempt++) {
            const x = room.x1 + 1 + Math.floor(rand() * Math.max(1, room.w - 2));
            const y = room.y1 + 1 + Math.floor(rand() * Math.max(1, room.h - 2));
            if (Math.hypot(x - centerX, y - centerY) < 2.5) continue;
            const index = localTile(chunk, x, y);
            if (index < 0 || chunk.tiles[index] !== 1) continue;
            let approach = false;
            for (const [dx, dy] of dirs) {
              const near = localTile(chunk, x + dx, y + dy);
              if (near >= 0 && chunk.tiles[near] === 1) { approach = true; break; }
            }
            if (!approach) continue;
            room.arcade = { x, y, roomId: room.id };
            arcades.push(room.arcade);
            break;
          }
        }
      }
    }

    /* Колонны и узкие места маски иногда оставляют клетку пола,
       отрезанную от центра зала. Такая клетка недостижима и читается
       как дыра в стене, поэтому сначала пробуем убрать замкнувшую её
       колонну, а если виновата сама маска — закладываем клетку стеной.
       Зал целиком помещается в один чанк, так что правка локальна. */
    function repairRoomFloor(room, chunk) {
      const width = room.x2 - room.x1 + 1;
      const height = room.y2 - room.y1 + 1;
      if (width <= 0 || height <= 0) return;
      const total = width * height;
      const isFloor = (x, y) => {
        const index = localTile(chunk, x, y);
        if (index < 0) return false;
        const tile = chunk.tiles[index];
        return tile === 1 || tile === 6;
      };
      const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
      for (let pass = 0; pass < 24; pass++) {
        const seen = new Uint8Array(total);
        const queue = [];
        if (isFloor(room.centerX, room.centerY)) {
          const start = (room.centerY - room.y1) * width + (room.centerX - room.x1);
          seen[start] = 1;
          queue.push(start);
        }
        while (queue.length) {
          const at = queue.pop();
          const x = room.x1 + (at % width);
          const y = room.y1 + Math.floor(at / width);
          for (const [dx, dy] of dirs) {
            const nx = x + dx;
            const ny = y + dy;
            if (nx < room.x1 || nx > room.x2 || ny < room.y1 || ny > room.y2) continue;
            const key = (ny - room.y1) * width + (nx - room.x1);
            if (seen[key] || !isFloor(nx, ny)) continue;
            seen[key] = 1;
            queue.push(key);
          }
        }
        const lost = [];
        for (let y = room.y1; y <= room.y2; y++) {
          for (let x = room.x1; x <= room.x2; x++) {
            if (!isFloor(x, y)) continue;
            if (!seen[(y - room.y1) * width + (x - room.x1)]) lost.push({ x, y });
          }
        }
        if (!lost.length) return;
        let opened = false;
        for (const cell of lost) {
          for (const [dx, dy] of dirs) {
            const px = cell.x + dx;
            const py = cell.y + dy;
            const index = localTile(chunk, px, py);
            if (index < 0 || chunk.tiles[index] !== 3) continue;
            /* Вскрываем только колонну, которая примыкает к главному
               полу: иначе отрезанная клетка останется отрезанной. */
            let touchesMain = false;
            for (const [mx, my] of dirs) {
              const nx = px + mx;
              const ny = py + my;
              if (nx < room.x1 || nx > room.x2 || ny < room.y1 || ny > room.y2) continue;
              if (seen[(ny - room.y1) * width + (nx - room.x1)] && isFloor(nx, ny)) {
                touchesMain = true;
                break;
              }
            }
            if (!touchesMain) continue;
            chunk.tiles[index] = 1;
            opened = true;
            break;
          }
          if (opened) break;
        }
        if (!opened) {
          for (const cell of lost) setTileInChunk(chunk, cell.x, cell.y, 2);
          return;
        }
      }
    }

    /* После прорезания дверей в зале может остаться карман пола,
       связанный только с коридором. Ищем его и соединяем с центром
       зала сквозь стену или колонну. Если путь не находится, карман
       закладывается стеной, чтобы не оставлять недостижимый пол. */
    function connectRoomFloor(room, chunk) {
      const width = room.x2 - room.x1 + 1;
      const height = room.y2 - room.y1 + 1;
      if (width <= 0 || height <= 0) return;
      const total = width * height;
      const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
      const indexAt = (x, y) => (y - room.y1) * width + (x - room.x1);
      const inside = (x, y) => x >= room.x1 && x <= room.x2 && y >= room.y1 && y <= room.y2;
      const floorAt = (x, y) => {
        const index = localTile(chunk, x, y);
        return index >= 0 && chunk.tiles[index] === 1;
      };
      const collectMainFloor = () => {
        const seen = new Uint8Array(total);
        if (!floorAt(room.centerX, room.centerY)) return seen;
        const stack = [indexAt(room.centerX, room.centerY)];
        seen[stack[0]] = 1;
        while (stack.length) {
          const at = stack.pop();
          const x = room.x1 + (at % width);
          const y = room.y1 + Math.floor(at / width);
          for (const [dx, dy] of dirs) {
            const nx = x + dx;
            const ny = y + dy;
            if (!inside(nx, ny) || !floorAt(nx, ny)) continue;
            const key = indexAt(nx, ny);
            if (seen[key]) continue;
            seen[key] = 1;
            stack.push(key);
          }
        }
        return seen;
      };

      for (let pass = 0; pass < 24; pass++) {
        const main = collectMainFloor();
        const lost = [];
        for (let y = room.y1; y <= room.y2; y++) {
          for (let x = room.x1; x <= room.x2; x++) {
            if (floorAt(x, y) && !main[indexAt(x, y)]) lost.push({ x, y });
          }
        }
        if (!lost.length) return;

        const start = lost[0];
        const from = indexAt(start.x, start.y);
        const parent = new Int32Array(total).fill(-2);
        const queue = [from];
        parent[from] = -1;
        let target = -1;
        for (let head = 0; head < queue.length && target < 0; head++) {
          const at = queue[head];
          const x = room.x1 + (at % width);
          const y = room.y1 + Math.floor(at / width);
          for (const [dx, dy] of dirs) {
            const nx = x + dx;
            const ny = y + dy;
            if (!inside(nx, ny)) continue;
            const key = indexAt(nx, ny);
            if (parent[key] !== -2) continue;
            if (main[key] && floorAt(nx, ny)) { target = key; parent[key] = at; break; }
            parent[key] = at;
            queue.push(key);
          }
        }

        if (target < 0) {
          /* До главного пола не добраться: убираем карман целиком. */
          for (const cell of lost) setTileInChunk(chunk, cell.x, cell.y, 2);
          return;
        }

        let at = parent[target];
        while (at >= 0) {
          const x = room.x1 + (at % width);
          const y = room.y1 + Math.floor(at / width);
          setTileInChunk(chunk, x, y, 1);
          at = parent[at];
        }
      }
    }

    /* ------------------------------ Болото ------------------------- */
    /* Болото — часть ландшафта. Пятна не хранятся в объекте жабы и не
       зависят от того, видна ли она: это те же тайлы, что пол и стены.
       Считаются от seed и мировых координат, поэтому бесшовно
       продолжаются через границы ленивых чанков. */
    function swampSettings() {
      const cfg = W.swamp || {};
      const cell = Math.max(8, Math.round(Number.isFinite(cfg.cell) ? cfg.cell : 13));
      const chance = Number.isFinite(cfg.chance) ? Math.max(0, Math.min(1, cfg.chance)) : 0.22;
      const pair = Array.isArray(cfg.radius) ? cfg.radius : [4, 7];
      const lo = Math.max(1.5, Number.isFinite(pair[0]) ? pair[0] : 4);
      const hi = Math.max(lo, Number.isFinite(pair[1]) ? pair[1] : 7);
      const roomFloor = Number.isFinite(cfg.roomRadius)
        ? Math.max(0.2, Math.min(0.9, cfg.roomRadius))
        : 0.52;
      return { cell, chance, lo, hi, roomFloor };
    }

    /* Болото заливает только пол. Сюжетные и чужие фаунные залы
       остаются сухими; зал бельзебуфо — наоборот, целиком болото. */
    function swampRoomAllows(x, y) {
      const cx = Math.floor(x / stepX);
      const cy = Math.floor(y / stepY);
      const room = roomsByCell.get(cellKey(cx, cy));
      if (!room) return true;
      if (room.faunaKind === 'belzebufo') return true;
      if (room.faunaKind) return false;
      return room.role === 'procedural' && room.storyIndex === null;
    }

    function paintSwampBlob(chunk, centerX, centerY, radius) {
      const r = Math.max(1.5, radius);
      const rSq = r * r;
      const x0 = Math.ceil(centerX - r);
      const x1 = Math.floor(centerX + r);
      const y0 = Math.ceil(centerY - r);
      const y1 = Math.floor(centerY + r);
      for (let y = y0; y <= y1; y += 1) {
        for (let x = x0; x <= x1; x += 1) {
          const dx = x + 0.5 - centerX;
          const dy = y + 0.5 - centerY;
          if (dx * dx + dy * dy > rSq) continue;
          const index = localTile(chunk, x, y);
          if (index < 0) continue;
          const tile = chunk.tiles[index];
          if (tile !== 1 && tile !== 5) continue;
          if (!swampRoomAllows(x, y)) continue;
          chunk.tiles[index] = 6;
        }
      }
    }

    function applySwamp(chunk) {
      const spec = swampSettings();
      if (spec.chance <= 0) return;
      const cellX0 = chunk.ccx * CHUNK;
      const cellY0 = chunk.ccy * CHUNK;
      /* Крупные пятна по всему лабиринту: проходы и обычные комнаты
         получают настоящие плёсы, через которые можно пройти. */
      const gx0 = Math.floor((chunk.ox - spec.hi) / spec.cell);
      const gx1 = Math.floor((chunk.ox + chunkW + spec.hi) / spec.cell);
      const gy0 = Math.floor((chunk.oy - spec.hi) / spec.cell);
      const gy1 = Math.floor((chunk.oy + chunkH + spec.hi) / spec.cell);
      for (let gy = gy0; gy <= gy1; gy += 1) {
        for (let gx = gx0; gx <= gx1; gx += 1) {
          const roll = hashString(`${seed}:swamp:${gx}:${gy}`) / 4294967296;
          if (roll >= spec.chance) continue;
          const rand = mulberry32(hashString(`${seed}:swampblob:${gx}:${gy}`));
          const centerX = gx * spec.cell + spec.cell * (0.22 + rand() * 0.56);
          const centerY = gy * spec.cell + spec.cell * (0.22 + rand() * 0.56);
          const radius = spec.lo + rand() * (spec.hi - spec.lo);
          paintSwampBlob(chunk, centerX, centerY, radius);
          /* Второй лепесток делает берег неровным, а не идеальным
             кругом. Он смещён от центра и меньше основного плёса. */
          const angle = rand() * Math.PI * 2;
          const away = radius * (0.35 + rand() * 0.3);
          paintSwampBlob(
            chunk,
            centerX + Math.cos(angle) * away,
            centerY + Math.sin(angle) * away,
            radius * (0.55 + rand() * 0.3)
          );
        }
      }

      /* Зал бельзебуфо — её ареал: болото занимает почти всю комнату,
         а не маленькую лужицу в углу. */
      for (let iy = 0; iy < CHUNK; iy += 1) {
        for (let ix = 0; ix < CHUNK; ix += 1) {
          const room = roomsByCell.get(cellKey(cellX0 + ix, cellY0 + iy));
          if (!room || room.faunaKind !== 'belzebufo') continue;
          const rand = mulberry32(hashString(`${seed}:swamproom:${room.cx}:${room.cy}`));
          const radius = Math.max(
            spec.lo,
            Math.min(spec.hi, Math.min(room.w, room.h) * spec.roomFloor)
          );
          const centerX = room.centerX + 0.5 + (rand() - 0.5) * room.w * 0.16;
          const centerY = room.centerY + 0.5 + (rand() - 0.5) * room.h * 0.16;
          paintSwampBlob(chunk, centerX, centerY, radius);
          const angle = rand() * Math.PI * 2;
          const away = radius * (0.3 + rand() * 0.25);
          paintSwampBlob(
            chunk,
            centerX + Math.cos(angle) * away,
            centerY + Math.sin(angle) * away,
            radius * (0.6 + rand() * 0.25)
          );
          /* Зал бельзебуфо — сплошное болото: жаба сливается с водой
             и мхом, а не сидит на сухом полу посреди лужи. */
          for (let y = room.y1; y <= room.y2; y += 1) {
            for (let x = room.x1; x <= room.x2; x += 1) {
              const index = localTile(chunk, x, y);
              if (index < 0) continue;
              if (chunk.tiles[index] === 1 || chunk.tiles[index] === 5) {
                chunk.tiles[index] = 6;
              }
            }
          }
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
        /* Скрижаль ведёт к зеркалам раньше остальных ветвей: путь идёт
           через Слепой зал, потому что клетки Скрижали и зеркал стоят
           по диагонали и прямой коридор между ними невозможен. */
        const mirrorCell = C.fixedRooms.mirror;
        if (mirrorCell) {
          addEdge(hazardCell.cx, hazardCell.cy, mirrorCell.cx, mirrorCell.cy);
        }
        const beetleCell = C.fixedRooms.beetle;
        if (beetleCell) {
          addEdge(tabletCell.cx, tabletCell.cy, beetleCell.cx, beetleCell.cy);
        }
        /* Ушастый зал стоит вплотную к Скрижали: до него можно дойти,
           не углубляясь в сюжетную цепь. */
        const earedCell = C.fixedRooms.eared;
        if (earedCell) {
          addEdge(tabletCell.cx, tabletCell.cy, earedCell.cx, earedCell.cy);
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
      const loopFactor = Number.isFinite(W.loopFactor) ? W.loopFactor : 0.82;
      const loops = Math.max(6, Math.round(loopCandidates.length * loopFactor));
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

      /* Сначала комнаты, затем коридоры: двери должны прорезать стены.
         Коробка зала целиком становится стеной, а пол вырезается по
         маске формы. Центр всегда остаётся полом, поэтому в зале есть
         точка, куда можно поставить сцену или врага. */
      for (let iy = 0; iy < CHUNK; iy++) {
        for (let ix = 0; ix < CHUNK; ix++) {
          const room = roomsByCell.get(cellKey(cellX0 + ix, cellY0 + iy));
          if (!room) continue;
          for (let y = room.oy; y < room.oy + room.h; y++) {
            for (let x = room.ox; x < room.ox + room.w; x++) {
              setTileInChunk(chunk, x, y, 2);
            }
          }
          if (room.shape === 'rect') {
            for (let y = room.y1; y <= room.y2; y++) {
              for (let x = room.x1; x <= room.x2; x++) {
                setTileInChunk(chunk, x, y, 1);
              }
            }
          } else {
            const iw = room.w - 2;
            const ih = room.h - 2;
            for (let ly = 0; ly < ih; ly++) {
              for (let lx = 0; lx < iw; lx++) {
                if (!shapeContains(room.shape, lx, ly, iw, ih, room.cx, room.cy)) continue;
                setTileInChunk(chunk, room.x1 + lx, room.y1 + ly, 1);
              }
            }
            /* Центр не может оказаться стеной: в нём стоят сцены,
               жаба и точка появления змеи. */
            setTileInChunk(chunk, room.centerX, room.centerY, 1);
          }
        }
      }

      /* Украшения ставим до коридоров: смещённый проход должен
         прорезать и стену, и случайно оказавшуюся на его пути
         колонну, а не упираться в неё. */
      for (let iy = 0; iy < CHUNK; iy++) {
        for (let ix = 0; ix < CHUNK; ix++) {
          const room = roomsByCell.get(cellKey(cellX0 + ix, cellY0 + iy));
          if (!room) continue;
          decorateRoom(room, chunk);
          /* Колонны не должны запирать кусок пола: проверяем связность
             зала сразу после декора, до прорезания дверей. */
          repairRoomFloor(room, chunk);
        }
      }

      /* Раньше здесь сканировались все рёбра мира, и каждый новый чанк
         стоил тем дороже, чем больше был исследован мир. Берём только
         рёбра, касающиеся клеток этого чанка. */
      const localEdges = new Set();
      for (let iy = 0; iy < CHUNK; iy++) {
        for (let ix = 0; ix < CHUNK; ix++) {
          const touched = edgesByCell.get(cellKey(cellX0 + ix, cellY0 + iy));
          if (!touched) continue;
          for (const ek of touched) localEdges.add(ek);
        }
      }
      for (const ek of localEdges) {
        const edge = edgeData.get(ek);
        if (edge) carveEdge(chunk, edge);
      }

      /* Проход, прорезанный в косой стене, иногда упирается в маску
         и заканчивается тупиком: карман соединён с коридором, но не с
         залом. Прорезаем короткий путь сквозь стену до основного пола,
         чтобы дверь действительно вела внутрь. */
      for (let iy = 0; iy < CHUNK; iy++) {
        for (let ix = 0; ix < CHUNK; ix++) {
          const room = roomsByCell.get(cellKey(cellX0 + ix, cellY0 + iy));
          if (room) connectRoomFloor(room, chunk);
        }
      }

      /* Болото кладём после коридоров: оно заливает готовый пол, не
         перекрывая проходы. */
      applySwamp(chunk);

      /* Глубина комнат нигде не читается, а пересчёт на каждый новый
         чанк обходил весь граф — убираем лишнюю работу при входе в чанк. */
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

    /* Болотный тайл: по нему можно идти, но это не сухой пол. */
    function isSwamp(tx, ty) {
      return getTile(tx, ty) === 6;
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
      /* Бесконечная граница превращает счётчик цикла в Infinity, и цикл
         никогда не завершается. Такие значения сюда не должны попадать,
         но на всякий случай возвращаем стартовый чанк. */
      if (!Number.isFinite(x0) || !Number.isFinite(y0) ||
          !Number.isFinite(x1) || !Number.isFinite(y1)) {
        ensureChunk(0, 0);
        return { cx0: 0, cy0: 0, cx1: 0, cy1: 0 };
      }
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
      arcades,
      getTile,
      isWalkable,
      isSwamp,
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

