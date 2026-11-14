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
         просто не могли бы тут обитать. */
      waterPools: [1, 2],
      plantPatches: [2, 3],
      needMin: 8,
      needMax: 22
    }, C.faunaDynamics || {});
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
    if (!Number.isFinite(fauna.growthTimer)) fauna.growthTimer = 0;
    if (!Number.isFinite(fauna.births)) fauna.births = 0;
    return fauna;
  }

  function makeDimetrodon(x, y, roomId) {
    const cfg = config();
    return {
      x,
      y,
      tx: x,
      ty: y,
      speed: cfg.speed * (0.85 + Math.random() * 0.35),
      angle: Math.random() * Math.PI * 2,
      phase: Math.random() * Math.PI * 2,
      roomId: roomId || null,
      rest: 0,
      /* Голод и жажда: зверь время от времени идёт к воде или к
         растениям в своём зале. */
      need: cfg.needMin + Math.random() * (cfg.needMax - cfg.needMin),
      seek: null,
      /* Трапеза: 'eat' у травы, 'drink' у воды. Пока таймер тикает,
         голова опускается к земле и летят частицы. */
      action: null,
      actionTimer: 0,
      actionDuration: 0
    };
  }

  /* Детерминированные источники воды и зелени в зале: считаются один
     раз на комнату и хранятся в сохранении. */
  function roomFeatures(room) {
    const fauna = ensureState();
    if (!fauna || !room) return null;
    const existing = fauna.features[room.id];
    if (existing) return existing;
    const cells = walkableCellsInRoom(room);
    if (!cells.length) return null;
    const cfg = config();
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
    const plants = [];
    const taken = new Set();
    const cellKey = (x, y) => `${x},${y}`;
    const waterCount = range(cfg.waterPools);
    for (let i = 0; i < waterCount; i += 1) {
      const c = pick();
      for (let dx = 0; dx <= 1; dx += 1) {
        for (let dy = 0; dy <= 1; dy += 1) {
          if (!walkable(c.x + dx, c.y + dy)) continue;
          if (taken.has(cellKey(c.x + dx, c.y + dy))) continue;
          taken.add(cellKey(c.x + dx, c.y + dy));
          water.push({ x: c.x + dx, y: c.y + dy });
        }
      }
    }
    /* Зелень не растёт в воде: вода и растения не пересекаются. */
    const plantCount = range(cfg.plantPatches);
    for (let i = 0; i < plantCount; i += 1) {
      let c = pick();
      let guard = 0;
      while (taken.has(cellKey(c.x, c.y)) && guard < 12) {
        c = pick();
        guard += 1;
      }
      if (taken.has(cellKey(c.x, c.y))) continue;
      taken.add(cellKey(c.x, c.y));
      plants.push({ x: c.x, y: c.y });
      const nx = c.x + 1;
      if (rand() < 0.5 && walkable(nx, c.y) && !taken.has(cellKey(nx, c.y))) {
        taken.add(cellKey(nx, c.y));
        plants.push({ x: nx, y: c.y });
      }
    }
    const feature = { water, plants };
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

  /* Посев залов диметродонов: в каждом таком зале живёт небольшая
     группа. Делается один раз на зал и только когда зал попал в
     радиус симуляции вокруг игрока. */
  function seedRooms() {
    const fauna = ensureState();
    if (!fauna || !rt.world || !rt.world.faunaRooms || !rt.state.player) return;
    const player = rt.state.player;
    const radius = config().simulateRadius;
    for (const room of rt.world.faunaRooms) {
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
    const step = Math.max(0.05, mon.speed) * dt;
    if (distance <= step) {
      mon.x = mon.tx;
      mon.y = mon.ty;
      return;
    }
    mon.x += (dx / distance) * step;
    mon.y += (dy / distance) * step;
    mon.angle = Math.atan2(dy, dx);
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
        fauna.dimetrodons.push(makeDimetrodon(cx + dir.x + 0.5, cy + dir.y + 0.5, parent.roomId));
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
    for (const mon of fauna.dimetrodons) {
      const ddx = mon.x - player.x;
      const ddy = mon.y - player.y;
      if (ddx * ddx + ddy * ddy > radiusSq) continue;
      updateOne(mon, dt);
    }

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

  /* Вода и зелень зала диметродонов. Рисуются под зверями: это часть
     комнаты, а не отдельные объекты. */
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
      if (room.faunaKind !== 'dimetrodon') continue;
      const feature = fauna.features[room.id];
      if (!feature) continue;
      for (const cell of feature.water) {
        const x = sx(cell.x + 0.5);
        const y = sy(cell.y + 0.5);
        if (x < -ts * 2 || x > view.w + ts * 2 || y < -ts * 2 || y > view.h + ts * 2) continue;
        const ripple = 0.5 + 0.5 * Math.sin(now * 0.002 + cell.x * 0.7 + cell.y * 0.4);
        ctx.save();
        ctx.fillStyle = `rgba(74, 128, 132, ${0.5 + ripple * 0.12})`;
        ctx.beginPath();
        ctx.ellipse(x, y, ts * 0.52, ts * 0.46, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = `rgba(168, 224, 220, ${0.25 + ripple * 0.2})`;
        ctx.lineWidth = Math.max(1, ts * 0.05);
        ctx.beginPath();
        ctx.ellipse(x, y, ts * (0.28 + ripple * 0.12), ts * (0.22 + ripple * 0.1), 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
      for (const cell of feature.plants) {
        const x = sx(cell.x + 0.5);
        const y = sy(cell.y + 0.5);
        if (x < -ts * 2 || x > view.w + ts * 2 || y < -ts * 2 || y > view.h + ts * 2) continue;
        const sway = Math.sin(now * 0.0016 + cell.x * 1.3 + cell.y * 0.6) * ts * 0.08;
        ctx.save();
        ctx.strokeStyle = 'rgba(96, 148, 78, 0.9)';
        ctx.lineWidth = Math.max(1.2, ts * 0.07);
        ctx.lineCap = 'round';
        for (let i = -1; i <= 1; i += 1) {
          ctx.beginPath();
          ctx.moveTo(x + i * ts * 0.14, y + ts * 0.3);
          ctx.quadraticCurveTo(
            x + i * ts * 0.2 + sway,
            y - ts * 0.05,
            x + i * ts * 0.34 + sway,
            y - ts * 0.32
          );
          ctx.stroke();
        }
        ctx.fillStyle = 'rgba(196, 156, 84, 0.85)';
        ctx.beginPath();
        ctx.arc(x + sway, y - ts * 0.34, Math.max(1, ts * 0.06), 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }
  }

  function drawFaunaWorld(ctx, params) {
    const fauna = ensureState();
    if (!fauna || !fauna.dimetrodons.length) return;
    if (!window.Renderer || typeof window.Renderer.drawDimetrodon !== 'function') return;
    drawFeatures(ctx, params);
    const view = params.view;
    const ts = params.ts;
    const sx = params.toScreenX;
    const sy = params.toScreenY;
    const now = params.now || 0;
    for (const mon of fauna.dimetrodons) {
      const x = sx(mon.x);
      const y = sy(mon.y);
      if (x < -ts * 2 || x > view.w + ts * 2 || y < -ts * 2 || y > view.h + ts * 2) continue;
      const moving = !(mon.rest > 0);
      const actionPhase = mon.actionDuration > 0
        ? 1 - mon.actionTimer / mon.actionDuration
        : 1;
      window.Renderer.drawDimetrodon(
        ctx, x, y, ts, now, mon.phase, mon.angle, moving, mon.action, actionPhase
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
     Радиус — радиус игрока плюс половина клетки моба. */
  function faunaBlockedAt(x, y, radius) {
    const fauna = rt.state && rt.state.fauna;
    if (!fauna || !Array.isArray(fauna.dimetrodons)) return false;
    const reach = (Number.isFinite(radius) ? radius : 0.34) + 0.42;
    const reachSq = reach * reach;
    for (const mon of fauna.dimetrodons) {
      const dx = mon.x - x;
      const dy = mon.y - y;
      if (dx * dx + dy * dy < reachSq) return true;
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
    const reach = 0.42 + radius + 0.08;
    const reachSq = reach * reach;
    let pushed = false;
    for (const mon of fauna.dimetrodons) {
      const ox = mon.x - x;
      const oy = mon.y - y;
      if (ox * ox + oy * oy > reachSq) continue;
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
  ZQ.faunaCount = faunaCount;
  ZQ.faunaParticleCount = () => particles.length;
  ZQ.faunaBlockedAt = faunaBlockedAt;
  ZQ.faunaPush = faunaPush;
})();
