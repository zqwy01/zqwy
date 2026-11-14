/* Живые диметродоны: пассивные мобы Лабиринта. Они не нападают —
   просто ползают по настоящим клеткам мира, расползаются из своих
   залов и понемногу размножаются. Состояние хранится в rt.state.fauna
   и сохраняется вместе с игрой, поэтому популяция переживает загрузку. */
(function () {
  'use strict';

  const ZQ = window.ZQ;
  const C = ZQ.C;
  const rt = ZQ.rt;

  const DIRS = [
    { x: 1, y: 0 },
    { x: -1, y: 0 },
    { x: 0, y: 1 },
    { x: 0, y: -1 }
  ];

  /* Частицы трапезы: зелёные травинки и капли воды разлетаются, когда
     диметродон ест или пьёт. Живут доли секунды и не сохраняются. */
  const particles = [];
  const PARTICLE_GRAVITY = 3.4;

  function config() {
    return Object.assign({
      speed: 1.05,
      cap: 28,
      roomStart: 5,
      growthInterval: 22,
      simulateRadius: 52,
      /* Аксолотль может подталкивать диметродонов: мобы мягко
         уступают дорогу, а не превращаются в стену. */
      pushStrength: 1.6,
      /* В зале диметродонов есть вода и растения: без них звери
         просто не могли бы тут обитать. Лужи большие — зверь в них
         плавает, а не просто стоит. */
      waterPools: [2, 3],
      waterBlob: [1, 2],
      plantPatches: [2, 3],
      /* Болото бельзебуфо. */
      swampPools: [3, 5],
      swampBlob: [2, 3],
      swampReeds: [6, 10],
      swampLily: [3, 7],
      needMin: 8,
      needMax: 22,
      collisionRadius: 0.52,
      callRadius: 9,
      callInterval: [9, 20],
      courtshipDistance: 2.4,
      courtshipChance: 0.5,
      courtshipDuration: 2.6,
      swimSpeedScale: 0.55,
      packs: []
    }, C.faunaDynamics || {});
  }

  /* Стая без палитры (если конфиг почему-то пуст). */
  function defaultPack() {
    return { index: -1, size: 1, sailScale: 1, speedScale: 1 };
  }

  function walkable(x, y) {
    return Boolean(rt.world && rt.world.isWalkable(x, y));
  }

  /* Состояние живёт в сохранении. Если его ещё нет (старый сейв или
     первый запуск), создаём пустое. */
  function ensureState() {
    if (!rt.state) return null;
    let fauna = rt.state.fauna;
    if (!fauna || typeof fauna !== 'object') {
      fauna = { dimetrodons: [], seeded: {}, features: {}, growthTimer: 0, births: 0 };
      rt.state.fauna = fauna;
    }
    if (!Array.isArray(fauna.dimetrodons)) fauna.dimetrodons = [];
    if (!fauna.seeded || typeof fauna.seeded !== 'object') fauna.seeded = {};
    if (!fauna.features || typeof fauna.features !== 'object') fauna.features = {};
    if (!fauna.packs || typeof fauna.packs !== 'object') fauna.packs = {};
    if (!fauna.packComms || typeof fauna.packComms !== 'object') fauna.packComms = {};
    if (!Number.isFinite(fauna.growthTimer)) fauna.growthTimer = 0;
    if (!Number.isFinite(fauna.births)) fauna.births = 0;
    return fauna;
  }

  /* Стая привязана к залу и детерминирована seed'ом: в каждом зале
     свой окрас, рисунок паруса и пропорции тела. Одна комната — одна
     стая, разные комнаты — разные стаи. */
  function packFor(roomId) {
    const fauna = ensureState();
    if (!fauna || !rt.state) return defaultPack();
    const key = roomId || 'wild';
    const existing = fauna.packs[key];
    if (existing && typeof existing === 'object') return existing;
    const cfg = config();
    const palettes = Array.isArray(cfg.packs) && cfg.packs.length ? cfg.packs : null;
    const hasWorld = window.World && typeof window.World.mulberry32 === 'function' &&
      typeof window.World.hashString === 'function';
    const rand = hasWorld
      ? window.World.mulberry32(window.World.hashString(`${rt.state.seed}:pack:${key}`))
      : Math.random;
    const count = palettes ? palettes.length : 0;
    const index = count ? Math.floor(rand() * count) % count : -1;
    const pack = {
      index,
      size: 0.9 + rand() * 0.45,
      sailScale: 0.9 + rand() * 0.5,
      speedScale: 0.85 + rand() * 0.3
    };
    fauna.packs[key] = pack;
    return pack;
  }

  function makeDimetrodon(x, y, roomId) {
    const cfg = config();
    const pack = packFor(roomId);
    return {
      x,
      y,
      tx: x,
      ty: y,
      speed: cfg.speed * pack.speedScale * (0.85 + Math.random() * 0.35),
      angle: Math.random() * Math.PI * 2,
      phase: Math.random() * Math.PI * 2,
      roomId: roomId || null,
      /* Стайная принадлежность: сохраняется, даже если зверь уползёт
         из зала в проход. */
      packId: roomId || null,
      packIndex: pack.index,
      size: pack.size * (0.94 + Math.random() * 0.12),
      sailScale: pack.sailScale,
      rest: 0,
      /* Голод и жажда: зверь время от времени идёт к воде или к
         растениям в своём зале. */
      need: cfg.needMin + Math.random() * (cfg.needMax - cfg.needMin),
      seek: null,
      /* Трапеза: 'eat' у травы, 'drink' у воды. Пока таймер тикает,
         голова опускается к земле и летят частицы. */
      action: null,
      actionTimer: 0,
      actionDuration: 0,
      /* Общение внутри стаи: зов и брачная демонстрация парусов. */
      call: 0,
      callDur: 0,
      display: 0,
      displayDur: 0,
      loveCooldown: 2 + Math.random() * 6,
      swimming: false
    };
  }

  /* Детерминированные источники воды и зелени в зале: считаются один
     раз на комнату и хранятся в сохранении. Залы диметродонов — с
     прудами и травой; залы бельзебуфо — настоящее болото: широкие
     цельные плёсы, камыш по берегам и кувшинки на воде. */
  function roomFeatures(room) {
    const fauna = ensureState();
    if (!fauna || !room) return null;
    const existing = fauna.features[room.id];
    if (existing) return existing;
    const cells = walkableCellsInRoom(room);
    if (!cells.length) return null;
    const cfg = config();
    const swamp = room.faunaKind === 'belzebufo';
    const hasWorld = window.World && typeof window.World.mulberry32 === 'function' &&
      typeof window.World.hashString === 'function';
    const rand = hasWorld
      ? window.World.mulberry32(window.World.hashString(`${rt.state.seed}:feat:${room.id}`))
      : Math.random;
    const pick = () => cells[Math.floor(rand() * cells.length)];
    const range = (pair) => {
      const lo = pair[0];
      const hi = Math.max(lo, pair[1]);
      return lo + Math.floor(rand() * (hi - lo + 1));
    };
    const water = [];
    const pools = [];
    const plants = [];
    const lily = [];
    const taken = new Set();
    const cellKey = (x, y) => `${x},${y}`;

    /* Плёс — цельная круглая лужа, а не россыпь клеток: рисуется
       одним блобом, поэтому вода выглядит сплошной, и в ней можно
       плавать. Границы клеток запоминаются для логики плавания. */
    const blobRange = swamp
      ? (Array.isArray(cfg.swampBlob) ? cfg.swampBlob : [2, 3])
      : (Array.isArray(cfg.waterBlob) ? cfg.waterBlob : [1, 2]);
    const waterCount = range(swamp
      ? (Array.isArray(cfg.swampPools) ? cfg.swampPools : [3, 5])
      : (Array.isArray(cfg.waterPools) ? cfg.waterPools : [2, 3]));
    for (let i = 0; i < waterCount; i += 1) {
      const c = pick();
      const radius = range(blobRange);
      const radiusSq = radius * radius + 0.5;
      let added = 0;
      for (let dx = -radius; dx <= radius; dx += 1) {
        for (let dy = -radius; dy <= radius; dy += 1) {
          if (dx * dx + dy * dy > radiusSq) continue;
          const wx = c.x + dx;
          const wy = c.y + dy;
          if (!walkable(wx, wy)) continue;
          if (taken.has(cellKey(wx, wy))) continue;
          taken.add(cellKey(wx, wy));
          water.push({ x: wx, y: wy });
          added += 1;
        }
      }
      if (added) pools.push({ x: c.x + 0.5, y: c.y + 0.5, r: radius + 0.35 });
    }

    /* Кувшинки плавают по поверхности воды. */
    if (swamp && water.length) {
      const lilyCount = range(Array.isArray(cfg.swampLily) ? cfg.swampLily : [3, 7]);
      for (let i = 0; i < lilyCount; i += 1) {
        const c = water[Math.floor(rand() * water.length)];
        if (!c) continue;
        lily.push({ x: c.x, y: c.y, phase: rand() * Math.PI * 2 });
      }
    }

    /* Зелень не растёт в воде. В болоте камыш жмётся к берегам. */
    const plantCount = range(swamp
      ? (Array.isArray(cfg.swampReeds) ? cfg.swampReeds : [6, 10])
      : (Array.isArray(cfg.plantPatches) ? cfg.plantPatches : [2, 3]));
    const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]];
    for (let i = 0; i < plantCount; i += 1) {
      let c = null;
      if (swamp && water.length) {
        for (let attempt = 0; attempt < 8 && !c; attempt += 1) {
          const w = water[Math.floor(rand() * water.length)];
          if (!w) break;
          const d = dirs[Math.floor(rand() * dirs.length)];
          const nx = w.x + d[0];
          const ny = w.y + d[1];
          if (walkable(nx, ny) && !taken.has(cellKey(nx, ny))) {
            c = { x: nx, y: ny };
          }
        }
      }
      if (!c) {
        c = pick();
        let guard = 0;
        while (taken.has(cellKey(c.x, c.y)) && guard < 12) {
          c = pick();
          guard += 1;
        }
      }
      if (!c || taken.has(cellKey(c.x, c.y))) continue;
      taken.add(cellKey(c.x, c.y));
      plants.push({ x: c.x, y: c.y });
      if (!swamp && rand() < 0.5 && walkable(c.x + 1, c.y) && !taken.has(cellKey(c.x + 1, c.y))) {
        taken.add(cellKey(c.x + 1, c.y));
        plants.push({ x: c.x + 1, y: c.y });
      }
    }
    const feature = { water, pools, plants, lily, swamp };
    fauna.features[room.id] = feature;
    return feature;
  }

  /* Ближайшая вода или растение в зале зверя. */
  function nearestFeature(mon) {
    let room = rt.world && rt.world.roomAtTile
      ? rt.world.roomAtTile(Math.floor(mon.x), Math.floor(mon.y))
      : null;
    if (!room && mon.roomId && rt.world && rt.world.roomById) {
      room = rt.world.roomById(mon.roomId);
    }
    if (!room || room.faunaKind !== 'dimetrodon') return null;
    const feature = roomFeatures(room);
    if (!feature) return null;
    let best = null;
    let bestDistance = Infinity;
    for (const c of feature.water) {
      const d = (c.x + 0.5 - mon.x) ** 2 + (c.y + 0.5 - mon.y) ** 2;
      if (d < bestDistance) { bestDistance = d; best = { x: c.x, y: c.y, type: 'water' }; }
    }
    for (const c of feature.plants) {
      const d = (c.x + 0.5 - mon.x) ** 2 + (c.y + 0.5 - mon.y) ** 2;
      if (d < bestDistance) { bestDistance = d; best = { x: c.x, y: c.y, type: 'plant' }; }
    }
    return best;
  }

  /* Находится ли зверь в воде своего зала. Набор водных клеток
     кэшируется: feature пересоздаётся редко, поэтому сравнение по
     ссылке достаточно. */
  const waterCache = new Map();
  function isSwimming(mon) {
    if (!mon.packId || !rt.world || !rt.world.roomById) return false;
    const room = rt.world.roomById(mon.packId);
    if (!room || room.faunaKind !== 'dimetrodon') return false;
    const fauna = rt.state && rt.state.fauna;
    const feature = fauna && fauna.features ? fauna.features[room.id] : null;
    if (!feature || !Array.isArray(feature.water) || !feature.water.length) return false;
    let entry = waterCache.get(room.id);
    if (!entry || entry.ref !== feature) {
      const set = new Set();
      for (const c of feature.water) set.add(`${c.x},${c.y}`);
      entry = { ref: feature, set };
      waterCache.set(room.id, entry);
    }
    return entry.set.has(`${Math.floor(mon.x)},${Math.floor(mon.y)}`);
  }

  function walkableCellsInRoom(room) {
    const cells = [];
    if (!room) return cells;
    for (let y = room.oy + 1; y < room.oy + room.h - 1; y += 1) {
      for (let x = room.ox + 1; x < room.ox + room.w - 1; x += 1) {
        if (walkable(x, y)) cells.push({ x, y });
      }
    }
    return cells;
  }

  function spawnInRoom(room, count) {
    const fauna = ensureState();
    if (!fauna || !room) return;
    const cells = walkableCellsInRoom(room);
    if (!cells.length) return;
    /* Вместе с жильцами зал получает воду и зелень. */
    roomFeatures(room);
    const cap = config().cap;
    for (let i = 0; i < count; i += 1) {
      if (fauna.dimetrodons.length >= cap) return;
      const cell = cells[Math.floor(Math.random() * cells.length)];
      fauna.dimetrodons.push(makeDimetrodon(cell.x + 0.5, cell.y + 0.5, room.id));
    }
  }

  /* Посев залов: в каждом зале диметродонов живёт небольшая группа,
     а зал бельзебуфо зарастает болотом. Делается один раз на зал и
     только когда зал попал в радиус симуляции вокруг игрока. */
  function seedRooms() {
    const fauna = ensureState();
    if (!fauna || !rt.world || !rt.world.faunaRooms || !rt.state.player) return;
    const player = rt.state.player;
    const radius = config().simulateRadius;
    for (const room of rt.world.faunaRooms) {
      if (room.faunaKind === 'belzebufo') {
        /* Болото жабы: вода, камыш и кувшинки. */
        const distance = Math.hypot(room.centerX - player.x, room.centerY - player.y);
        if (distance <= radius) roomFeatures(room);
        continue;
      }
      if (room.faunaKind !== 'dimetrodon') continue;
      if (fauna.seeded[room.id]) continue;
      const distance = Math.hypot(room.centerX - player.x, room.centerY - player.y);
      if (distance > radius) continue;
      fauna.seeded[room.id] = true;
      spawnInRoom(room, config().roomStart);
    }
  }

  function shuffledDirs() {
    const dirs = DIRS.slice();
    for (let i = dirs.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = dirs[i];
      dirs[i] = dirs[j];
      dirs[j] = tmp;
    }
    return dirs;
  }

  function occupiedByOther(mon, x, y) {
    const fauna = rt.state && rt.state.fauna;
    if (!fauna || !Array.isArray(fauna.dimetrodons)) return false;
    for (const other of fauna.dimetrodons) {
      if (other === mon) continue;
      if (Math.floor(other.x) === x && Math.floor(other.y) === y) return true;
    }
    return false;
  }

  function nextTarget(mon) {
    const cx = Math.floor(mon.x);
    const cy = Math.floor(mon.y);
    /* Сначала — вода или растение: зверь идёт к ближайшей цели. */
    if (mon.seek) {
      let best = null;
      let bestDistance = Infinity;
      for (const dir of shuffledDirs()) {
        const nx = cx + dir.x;
        const ny = cy + dir.y;
        if (!walkable(nx, ny)) continue;
        if (occupiedByOther(mon, nx, ny)) continue;
        const d = Math.abs(mon.seek.x - nx) + Math.abs(mon.seek.y - ny);
        if (d < bestDistance) { bestDistance = d; best = { x: nx, y: ny }; }
      }
      if (best) return best;
    }
    let fallback = null;
    for (const dir of shuffledDirs()) {
      const nx = cx + dir.x;
      const ny = cy + dir.y;
      if (!walkable(nx, ny)) continue;
      if (occupiedByOther(mon, nx, ny)) {
        if (!fallback) fallback = { x: nx, y: ny };
        continue;
      }
      return { x: nx, y: ny };
    }
    return fallback || { x: cx, y: cy };
  }

  function spawnMealParticles(x, y, kind) {
    const count = 8 + Math.floor(Math.random() * 5);
    for (let i = 0; i < count; i += 1) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 0.6 + Math.random() * 1.5;
      particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 0.5,
        life: 0.5 + Math.random() * 0.5,
        maxLife: 1,
        kind
      });
    }
    if (particles.length > 240) particles.splice(0, particles.length - 240);
  }

  function updateParticles(dt) {
    for (let i = particles.length - 1; i >= 0; i -= 1) {
      const p = particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        particles.splice(i, 1);
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += PARTICLE_GRAVITY * dt;
      p.vx *= 0.94;
    }
  }

  function updateOne(mon, dt) {
    const cfg = config();
    if (mon.actionTimer > 0) {
      mon.actionTimer = Math.max(0, mon.actionTimer - dt);
      if (mon.actionTimer <= 0) mon.action = null;
    }
    /* Зов и брачная демонстрация тикают всегда, даже во время
       передышки. Демонстрация приковывает зверя к месту. */
    if (mon.call > 0) mon.call = Math.max(0, mon.call - dt);
    if (mon.loveCooldown > 0) mon.loveCooldown = Math.max(0, mon.loveCooldown - dt);
    if (mon.display > 0) {
      mon.display = Math.max(0, mon.display - dt);
      mon.angle += dt * 1.5;
      mon.swimming = isSwimming(mon);
      return;
    }
    if (mon.rest > 0) {
      mon.rest -= dt;
      return;
    }
    /* Жажда и голод: когда приходит время, зверь направляется к воде
       или к растениям своего зала. */
    if (!Number.isFinite(mon.need)) {
      mon.need = cfg.needMin + Math.random() * (cfg.needMax - cfg.needMin);
    }
    if (!mon.seek) {
      mon.need -= dt;
      if (mon.need <= 0) {
        const feature = nearestFeature(mon);
        if (feature) {
          mon.seek = feature;
        }
        mon.need = cfg.needMin + Math.random() * (cfg.needMax - cfg.needMin);
      }
    }
    const dx = mon.tx - mon.x;
    const dy = mon.ty - mon.y;
    const distance = Math.hypot(dx, dy);
    if (distance < 0.08) {
      mon.x = mon.tx;
      mon.y = mon.ty;
      if (mon.seek &&
          Math.hypot(mon.x - (mon.seek.x + 0.5), mon.y - (mon.seek.y + 0.5)) < 0.95) {
        /* Напился или наелся: короткая передышка у воды, а голова
           опускается к земле и разлетаются частицы. */
        const drinking = mon.seek.type === 'water';
        mon.action = drinking ? 'drink' : 'eat';
        mon.actionDuration = drinking ? 1.6 : 1.9;
        mon.actionTimer = mon.actionDuration;
        spawnMealParticles(mon.seek.x + 0.5, mon.seek.y + 0.5, mon.seek.type);
        mon.seek = null;
        mon.rest = 1.2 + Math.random() * 1.8;
      } else if (!mon.seek && Math.random() < 0.22) {
        mon.rest = 0.4 + Math.random() * 1.6;
      }
      const next = nextTarget(mon);
      mon.tx = next.x + 0.5;
      mon.ty = next.y + 0.5;
      mon.angle = Math.atan2(mon.ty - mon.y, mon.tx - mon.x);
      return;
    }
    /* В воде зверь гребёт медленнее и заметно погружается. */
    const swimming = isSwimming(mon);
    mon.swimming = swimming;
    const swimScale = swimming && Number.isFinite(cfg.swimSpeedScale)
      ? cfg.swimSpeedScale
      : 1;
    const step = Math.max(0.05, mon.speed * swimScale) * dt;
    if (distance <= step) {
      mon.x = mon.tx;
      mon.y = mon.ty;
      return;
    }
    mon.x += (dx / distance) * step;
    mon.y += (dy / distance) * step;
    mon.angle = Math.atan2(dy, dx);
  }

  /* ----------------------- Общение в стае ------------------------- */
  /* Зов: зверь подаёт голос, а сородичи в радиусе отвечают и
     поворачиваются к нему. Демонстрация: оказавшиеся рядом двое
     поднимают паруса и кружат друг перед другом. */
  function startCall(mon, dur) {
    mon.callDur = dur;
    mon.call = dur;
  }

  function startDisplay(mon, dur) {
    mon.displayDur = dur;
    mon.display = dur;
    mon.callDur = Math.max(mon.callDur, dur);
    mon.call = Math.max(mon.call, dur);
    mon.rest = 0;
  }

  function tryCourtship(list, cfg) {
    const distance = Number.isFinite(cfg.courtshipDistance) ? cfg.courtshipDistance : 2.4;
    const distanceSq = distance * distance;
    const chance = Number.isFinite(cfg.courtshipChance) ? cfg.courtshipChance : 0.5;
    const duration = Number.isFinite(cfg.courtshipDuration) ? cfg.courtshipDuration : 2.6;
    for (let i = 0; i < list.length; i += 1) {
      const a = list[i];
      if (a.display > 0 || a.loveCooldown > 0) continue;
      for (let j = i + 1; j < list.length; j += 1) {
        const b = list[j];
        if (b.display > 0 || b.loveCooldown > 0) continue;
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        if (dx * dx + dy * dy > distanceSq) continue;
        if (Math.random() > chance) continue;
        startDisplay(a, duration);
        startDisplay(b, duration);
        a.loveCooldown = 8 + Math.random() * 10;
        b.loveCooldown = 8 + Math.random() * 10;
        return;
      }
    }
  }

  function updateCommunication(dt, active) {
    const fauna = ensureState();
    if (!fauna || active.length < 2) return;
    const cfg = config();
    const callRadius = Number.isFinite(cfg.callRadius) ? cfg.callRadius : 9;
    const callRadiusSq = callRadius * callRadius;
    const groups = new Map();
    for (const mon of active) {
      const key = mon.packId || 'wild';
      let list = groups.get(key);
      if (!list) { list = []; groups.set(key, list); }
      list.push(mon);
    }
    for (const [key, list] of groups) {
      if (list.length < 2) continue;
      let timer = Number.isFinite(fauna.packComms[key]) ? fauna.packComms[key] : 4 + Math.random() * 6;
      timer -= dt;
      if (timer > 0) {
        fauna.packComms[key] = timer;
        continue;
      }
      const interval = Array.isArray(cfg.callInterval) ? cfg.callInterval : [9, 20];
      const lo = interval[0];
      const hi = Math.max(lo, interval[1]);
      fauna.packComms[key] = lo + Math.random() * (hi - lo);
      const caller = list[Math.floor(Math.random() * list.length)];
      startCall(caller, 1.0);
      for (const other of list) {
        if (other === caller) continue;
        const dx = caller.x - other.x;
        const dy = caller.y - other.y;
        const d2 = dx * dx + dy * dy;
        if (d2 > callRadiusSq) continue;
        startCall(other, 0.6 + Math.random() * 0.3);
        if (d2 > 0.0001) other.angle = Math.atan2(dy, dx);
      }
      tryCourtship(list, cfg);
    }
  }

  /* Новый детёныш появляется в ближайшем зале диметродонов, а если
     такого рядом нет — рядом с уже живущим собратом. */
  function grow() {
    const fauna = ensureState();
    if (!fauna) return;
    const cfg = config();
    if (fauna.dimetrodons.length >= cfg.cap) return;
    const player = rt.state.player;
    const rooms = (rt.world && rt.world.faunaRooms) || [];
    const candidates = rooms.filter((room) => room.faunaKind === 'dimetrodon' &&
      Math.hypot(room.centerX - player.x, room.centerY - player.y) <= cfg.simulateRadius);
    if (candidates.length) {
      const room = candidates[Math.floor(Math.random() * candidates.length)];
      spawnInRoom(room, 1);
      fauna.births += 1;
      return;
    }
    const alive = fauna.dimetrodons;
    if (!alive.length) return;
    const parent = alive[Math.floor(Math.random() * alive.length)];
    const cx = Math.floor(parent.x);
    const cy = Math.floor(parent.y);
    for (const dir of shuffledDirs()) {
      if (walkable(cx + dir.x, cy + dir.y)) {
        fauna.dimetrodons.push(makeDimetrodon(
          cx + dir.x + 0.5,
          cy + dir.y + 0.5,
          parent.packId || parent.roomId
        ));
        fauna.births += 1;
        return;
      }
    }
  }

  function updateFauna(dt) {
    const fauna = ensureState();
    if (!fauna || !rt.world || !rt.state || !rt.state.player) return;
    if (!Number.isFinite(dt) || dt <= 0) return;
    seedRooms();
    updateParticles(dt);

    const player = rt.state.player;
    const cfg = config();
    const radiusSq = cfg.simulateRadius * cfg.simulateRadius;
    const active = [];
    for (const mon of fauna.dimetrodons) {
      const ddx = mon.x - player.x;
      const ddy = mon.y - player.y;
      if (ddx * ddx + ddy * ddy > radiusSq) continue;
      updateOne(mon, dt);
      active.push(mon);
    }
    /* Общение считается только между теми, кто рядом с игроком:
       далёкие залы не тратят кадры. */
    updateCommunication(dt, active);

    if (fauna.dimetrodons.length < cfg.cap) {
      fauna.growthTimer += dt;
      if (fauna.growthTimer >= cfg.growthInterval) {
        fauna.growthTimer = 0;
        grow();
      }
    } else {
      fauna.growthTimer = 0;
    }
  }

  /* Вода и зелень зала. Рисуются под зверями: это часть комнаты, а
     не отдельные объекты. Плёс рисуется цельным блобом, поэтому вода
     выглядит сплошной, а не набором отдельных клеток. */
  function drawFeatures(ctx, params) {
    const fauna = ensureState();
    if (!fauna || !fauna.features) return;
    const world = params.world;
    if (!world || !Array.isArray(world.faunaRooms)) return;
    const view = params.view;
    const ts = params.ts;
    const sx = params.toScreenX;
    const sy = params.toScreenY;
    const now = params.now || 0;
    for (const room of world.faunaRooms) {
      if (room.faunaKind !== 'dimetrodon' && room.faunaKind !== 'belzebufo') continue;
      const feature = fauna.features[room.id];
      if (!feature) continue;
      const swamp = Boolean(feature.swamp);
      /* Плёсы: если блобов нет (старый сейв) — собираем из клеток. */
      const pools = Array.isArray(feature.pools) && feature.pools.length
        ? feature.pools
        : (feature.water || []).map((c) => ({ x: c.x + 0.5, y: c.y + 0.5, r: 0.75 }));
      for (const pool of pools) {
        const x = sx(pool.x);
        const y = sy(pool.y);
        const pr = pool.r * ts;
        if (x < -pr * 2 || x > view.w + pr * 2 || y < -pr * 2 || y > view.h + pr * 2) continue;
        const ripple = 0.5 + 0.5 * Math.sin(now * 0.002 + pool.x * 0.7 + pool.y * 0.4);
        ctx.save();
        if (swamp) {
          const grad = ctx.createRadialGradient(x, y, pr * 0.15, x, y, pr);
          grad.addColorStop(0, `rgba(52, 88, 56, ${0.78 + ripple * 0.06})`);
          grad.addColorStop(0.68, `rgba(62, 98, 60, ${0.72 + ripple * 0.06})`);
          grad.addColorStop(1, 'rgba(80, 112, 66, 0.5)');
          ctx.fillStyle = grad;
        } else {
          ctx.fillStyle = `rgba(74, 128, 132, ${0.5 + ripple * 0.12})`;
        }
        ctx.beginPath();
        ctx.ellipse(x, y, pr, pr * 0.86, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = swamp
          ? `rgba(126, 162, 96, ${0.26 + ripple * 0.16})`
          : `rgba(168, 224, 220, ${0.25 + ripple * 0.2})`;
        ctx.lineWidth = Math.max(1, ts * 0.06);
        ctx.beginPath();
        ctx.ellipse(x, y, pr * 0.74, pr * 0.62, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
      /* Кувшинки покачиваются на воде. */
      for (const pad of feature.lily || []) {
        const x = sx(pad.x + 0.5);
        const y = sy(pad.y + 0.5);
        if (x < -ts * 2 || x > view.w + ts * 2 || y < -ts * 2 || y > view.h + ts * 2) continue;
        const bob = Math.sin(now * 0.0016 + (pad.phase || 0)) * ts * 0.03;
        ctx.save();
        ctx.fillStyle = 'rgba(78, 126, 66, 0.92)';
        ctx.beginPath();
        ctx.ellipse(x, y + bob, ts * 0.3, ts * 0.24, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(104, 158, 84, 0.9)';
        ctx.beginPath();
        ctx.moveTo(x, y + bob);
        ctx.arc(x, y + bob, ts * 0.3, -0.6, 0.6);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = 'rgba(232, 160, 190, 0.9)';
        ctx.beginPath();
        ctx.arc(x + ts * 0.07, y + bob - ts * 0.02, Math.max(1, ts * 0.05), 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
      /* Зелень: в болоте — высокий камыш, в зале диметродонов — трава. */
      for (const cell of feature.plants) {
        const x = sx(cell.x + 0.5);
        const y = sy(cell.y + 0.5);
        if (x < -ts * 2 || x > view.w + ts * 2 || y < -ts * 2 || y > view.h + ts * 2) continue;
        const sway = Math.sin(now * 0.0016 + cell.x * 1.3 + cell.y * 0.6) * ts * 0.08;
        ctx.save();
        ctx.strokeStyle = swamp ? 'rgba(116, 160, 80, 0.92)' : 'rgba(96, 148, 78, 0.9)';
        ctx.lineWidth = Math.max(1.2, ts * 0.065);
        ctx.lineCap = 'round';
        const blades = swamp ? 4 : 3;
        const height = swamp ? 0.62 : 0.32;
        for (let i = 0; i < blades; i += 1) {
          const off = (i - (blades - 1) / 2) * ts * 0.12;
          ctx.beginPath();
          ctx.moveTo(x + off, y + ts * 0.3);
          ctx.quadraticCurveTo(
            x + off + sway,
            y - ts * height * 0.4,
            x + off * 1.6 + sway,
            y - ts * height
          );
          ctx.stroke();
        }
        if (swamp) {
          ctx.fillStyle = 'rgba(126, 108, 58, 0.92)';
          ctx.beginPath();
          ctx.ellipse(x + sway, y - ts * 0.64, ts * 0.06, ts * 0.14, 0, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.fillStyle = 'rgba(196, 156, 84, 0.85)';
          ctx.beginPath();
          ctx.arc(x + sway, y - ts * 0.34, Math.max(1, ts * 0.06), 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }
    }
  }

  function drawFaunaWorld(ctx, params) {
    const fauna = ensureState();
    if (!fauna || !fauna.dimetrodons.length) return;
    if (!window.Renderer || typeof window.Renderer.drawDimetrodon !== 'function') return;
    const view = params.view;
    const ts = params.ts;
    const sx = params.toScreenX;
    const sy = params.toScreenY;
    const now = params.now || 0;
    const cfg = config();
    const palettes = Array.isArray(cfg.packs) ? cfg.packs : [];
    for (const mon of fauna.dimetrodons) {
      const x = sx(mon.x);
      const y = sy(mon.y);
      if (x < -ts * 2 || x > view.w + ts * 2 || y < -ts * 2 || y > view.h + ts * 2) continue;
      const moving = !(mon.rest > 0) && !(mon.display > 0);
      const actionPhase = mon.actionDuration > 0
        ? 1 - mon.actionTimer / mon.actionDuration
        : 1;
      const callPhase = mon.callDur > 0
        ? ZQ.clamp(1 - mon.call / mon.callDur, 0, 1)
        : 1;
      const displayPhase = mon.displayDur > 0
        ? ZQ.clamp(1 - mon.display / mon.displayDur, 0, 1)
        : 1;
      window.Renderer.drawDimetrodon(
        ctx, x, y, ts, now, mon.phase, mon.angle, moving, mon.action, actionPhase,
        {
          pack: palettes[mon.packIndex] || palettes[0] || null,
          size: Number.isFinite(mon.size) ? mon.size : 1,
          sailScale: Number.isFinite(mon.sailScale) ? mon.sailScale : 1,
          call: mon.call > 0 ? callPhase : 0,
          display: mon.display > 0 ? displayPhase : 0,
          swimming: Boolean(mon.swimming)
        }
      );
    }
    drawParticles(ctx, params);
  }

  /* Частицы трапезы рисуются поверх зверей: травинки и капли летят из
     пасти, когда диметродон ест или пьёт. */
  function drawParticles(ctx, params) {
    if (!particles.length) return;
    const ts = params.ts;
    const sx = params.toScreenX;
    const sy = params.toScreenY;
    const view = params.view;
    ctx.save();
    for (const p of particles) {
      const x = sx(p.x);
      const y = sy(p.y);
      if (x < -ts * 2 || x > view.w + ts * 2 || y < -ts * 2 || y > view.h + ts * 2) continue;
      const alpha = ZQ.clamp(p.life / p.maxLife, 0, 1);
      if (p.kind === 'water') {
        ctx.fillStyle = `rgba(150, 214, 222, ${0.5 + alpha * 0.4})`;
        ctx.beginPath();
        ctx.arc(x, y, Math.max(1, ts * 0.06 * (0.6 + alpha)), 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.strokeStyle = `rgba(120, 178, 96, ${0.5 + alpha * 0.4})`;
        ctx.lineWidth = Math.max(1, ts * 0.05);
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + p.vx * ts * 0.05, y + p.vy * ts * 0.05);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  function faunaCount() {
    const fauna = ensureState();
    return fauna ? fauna.dimetrodons.length : 0;
  }

  /* Коллизия с живыми диметродонами: аксолотль не проходит сквозь них.
     Радиус — радиус игрока плюс половина клетки моба, причём у
     крупных стай хитбокс крупнее. */
  function faunaBlockedAt(x, y, radius) {
    const fauna = rt.state && rt.state.fauna;
    if (!fauna || !Array.isArray(fauna.dimetrodons)) return false;
    const cfg = config();
    const base = Number.isFinite(cfg.collisionRadius) ? cfg.collisionRadius : 0.52;
    const playerRadius = Number.isFinite(radius)
      ? radius
      : (Number.isFinite(C.player && C.player.radius) ? C.player.radius : 0.34);
    for (const mon of fauna.dimetrodons) {
      const reach = playerRadius + base * (Number.isFinite(mon.size) ? mon.size : 1);
      const dx = mon.x - x;
      const dy = mon.y - y;
      if (dx * dx + dy * dy < reach * reach) return true;
    }
    return false;
  }

  /* Аксолотль подталкивает диметродонов: те мягко уходят в сторону
     движения. Если за мобом стена или другой зверь, толчок не
     проходит и герой упирается — но обычно дорога открывается. */
  function faunaPush(x, y, dx, dy, dist) {
    const fauna = rt.state && rt.state.fauna;
    if (!fauna || !Array.isArray(fauna.dimetrodons)) return false;
    const length = Math.hypot(dx, dy);
    if (!(length > 0)) return false;
    const nx = dx / length;
    const ny = dy / length;
    const cfg = config();
    const push = Math.max(0.06, (Number.isFinite(dist) ? dist : 0.08) * cfg.pushStrength);
    const radius = Number.isFinite(C.player && C.player.radius) ? C.player.radius : 0.34;
    const base = Number.isFinite(cfg.collisionRadius) ? cfg.collisionRadius : 0.52;
    let pushed = false;
    for (const mon of fauna.dimetrodons) {
      const reach = base * (Number.isFinite(mon.size) ? mon.size : 1) + radius + 0.08;
      const ox = mon.x - x;
      const oy = mon.y - y;
      if (ox * ox + oy * oy > reach * reach) continue;
      const tx = mon.x + nx * push;
      const ty = mon.y + ny * push;
      const tileX = Math.floor(tx);
      const tileY = Math.floor(ty);
      if (!walkable(tileX, tileY)) continue;
      if (occupiedByOther(mon, tileX, tileY)) continue;
      mon.x = tx;
      mon.y = ty;
      mon.tx = tx;
      mon.ty = ty;
      mon.rest = 0;
      mon.angle = Math.atan2(ny, nx);
      pushed = true;
    }
    return pushed;
  }

  ZQ.updateFauna = updateFauna;
  ZQ.drawFaunaWorld = drawFaunaWorld;
  ZQ.drawFaunaFeatures = drawFeatures;
  ZQ.faunaCount = faunaCount;
  ZQ.faunaParticleCount = () => particles.length;
  ZQ.faunaBlockedAt = faunaBlockedAt;
  ZQ.faunaPush = faunaPush;
  ZQ.faunaPackFor = packFor;
})();
