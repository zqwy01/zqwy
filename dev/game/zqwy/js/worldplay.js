/* Мир: движение Zemic, комнаты, предметы и взаимодействия. */
(function () {
  'use strict';

  const ZQ = window.ZQ;
  const C = ZQ.C;
  const rt = ZQ.rt;
  const dom = ZQ.dom;

  function t(ru, en, de) {
    const code = window.ZQI18N && window.ZQI18N.lang ? window.ZQI18N.lang : 'ru';
    if (code === 'de') return de || en || ru;
    return code === 'en' ? (en || ru) : ru;
  }

  function storyGateOpen() {
    return typeof ZQ.storyGateOpen !== 'function' || ZQ.storyGateOpen();
  }

  /* Сцена зала звучит только тогда, когда её узел ветви уже доступен
     или пройден. Иначе игрок увидел бы будущее раньше времени. */
  function storyRoomOpen(role) {
    if (!role || typeof ZQ.storyNodeState !== 'function') return true;
    const tree = C.storyTree;
    if (!tree || !tree.nodes) return true;
    const direct = ZQ.storyNodeState(role);
    if (direct && (direct.available || direct.done)) return true;
    for (const id of Object.keys(tree.nodes)) {
      const node = tree.nodes[id];
      if (!node || !node.complete || node.complete.story !== role) continue;
      const state = ZQ.storyNodeState(id);
      if (state && (state.available || state.done)) return true;
    }
    return false;
  }

  /* Аркадный автомат — твёрдый и тяжёлый корпус. Круглый радиус не
     давал встать вплотную к соседней клетке, поэтому корпус описан
     прямоугольным следом: он накрывает свою клетку и половину
     соседней, но оставляет центры соседних клеток проходимыми. */
  const ARCADE_RADIUS = 0.62;
  const ARCADE_HALF = 0.56;
  const ARCADE_FOOT = 0.52;

  function arcadeStore() {
    if (!rt.state) return null;
    if (!rt.state.arcadePositions || typeof rt.state.arcadePositions !== 'object') {
      rt.state.arcadePositions = Object.create(null);
    }
    return rt.state.arcadePositions;
  }

  function arcadeKey(arcade) {
    if (!arcade) return '';
    return arcade.roomId || `${arcade.x},${arcade.y}`;
  }

  /* Центр корпуса: клетка автомата плюс сохранённое смещение. */
  function arcadeCenter(arcade) {
    if (!arcade) return { x: 0, y: 0 };
    const store = arcadeStore();
    const saved = store && store[arcadeKey(arcade)];
    const ox = saved && Number.isFinite(saved.ox) ? saved.ox : 0;
    const oy = saved && Number.isFinite(saved.oy) ? saved.oy : 0;
    return { x: arcade.x + 0.5 + ox, y: arcade.y + 0.5 + oy };
  }

  /* Возвращает автомат, в который упирается точка, или null. */
  function arcadeBlockedAt(x, y, radius) {
    if (!rt.world || !Array.isArray(rt.world.arcades)) return null;
    const r = Number.isFinite(radius) ? radius : C.player.radius;
    const limit = r + ARCADE_RADIUS;
    const half = r + ARCADE_HALF;
    for (const arcade of rt.world.arcades) {
      const center = arcadeCenter(arcade);
      const dx = x - center.x;
      const dy = y - center.y;
      /* Круг ловит диагональные касания, прямоугольник — попытку
         встать на клетку корпуса или залезть на его переднюю грань. */
      if (dx * dx + dy * dy < limit * limit) return arcade;
      if (Math.abs(dx) < half && Math.abs(dy) < half) return arcade;
    }
    return null;
  }

  /* Корпус помещается на пол: центр и четыре точки по краю клетки. */
  function arcadeFitsAt(x, y) {
    if (!rt.world) return false;
    const points = [
      [x, y],
      [x - ARCADE_FOOT, y], [x + ARCADE_FOOT, y],
      [x, y - ARCADE_FOOT], [x, y + ARCADE_FOOT]
    ];
    for (const point of points) {
      if (!rt.world.isWalkable(Math.floor(point[0]), Math.floor(point[1]))) {
        return false;
      }
    }
    return true;
  }

  /* Толкаем корпус в направлении шага. Если за ним стена, он остаётся
     на месте, и игрок упирается. Сохранение пишем не каждый кадр. */
  function arcadePush(arcade, targetX, targetY, pushX, pushY, amount) {
    if (!arcade || !rt.world) return false;
    const dx = Number(pushX) || 0;
    const dy = Number(pushY) || 0;
    const length = Math.hypot(dx, dy);
    if (!length) return false;
    const step = Number.isFinite(amount) ? amount : 0.05;
    const center = arcadeCenter(arcade);
    const nx = center.x + (dx / length) * step;
    const ny = center.y + (dy / length) * step;
    if (!arcadeFitsAt(nx, ny)) return false;
    const store = arcadeStore();
    if (!store) return false;
    store[arcadeKey(arcade)] = {
      ox: nx - (arcade.x + 0.5),
      oy: ny - (arcade.y + 0.5)
    };
    const time = ZQ.now();
    if (time - (rt.arcadePushSaveAt || 0) > 900) {
      rt.arcadePushSaveAt = time;
      if (typeof ZQ.saveGame === 'function') ZQ.saveGame();
    }
    return true;
  }

  /* Счётчик шагов: клетка меняется — шаг засчитан. Телепорт и возврат
     к Скрижали сбрасывают отметку, чтобы дорога не считалась шагом. */
  function trackStep() {
    if (!rt.state || !rt.state.player) return;
    const key = `${Math.floor(rt.state.player.x)},${Math.floor(rt.state.player.y)}`;
    if (!rt.lastStepTile) {
      rt.lastStepTile = key;
      return;
    }
    if (key === rt.lastStepTile) return;
    rt.lastStepTile = key;
    rt.state.steps = (Number.isFinite(rt.state.steps) ? rt.state.steps : 0) + 1;
  }

  function resetStepTracker() {
    rt.lastStepTile = null;
  }

  function setSwampVeil(active) {
    const value = Boolean(active);
    if (rt.swampActive === value) return;
    rt.swampActive = value;
    if (dom.swampVeil) dom.swampVeil.classList.toggle('active', value);
  }

  function inSwampNow() {
    if (!rt.world || !rt.state || !rt.state.player) return false;
    if (typeof rt.world.isSwamp !== 'function') return false;
    return rt.world.isSwamp(
      Math.floor(rt.state.player.x),
      Math.floor(rt.state.player.y)
    );
  }

  function canStandWalls(x, y) {
    const world = rt.world;
    if (!world) return false;
    const r = C.player.radius;
    const points = [
      [x, y],
      [x - r, y - r], [x + r, y - r],
      [x - r, y + r], [x + r, y + r],
      [x - r, y], [x + r, y],
      [x, y - r], [x, y + r]
    ];
    for (const point of points) {
      if (!world.isWalkable(Math.floor(point[0]), Math.floor(point[1]))) return false;
    }
    return true;
  }

  function doorState(door) {
    const value = rt.state && rt.state.flags ? rt.state.flags[door.flag] : 'open';
    return value === 'closed' || value === 'locked' ? value : 'open';
  }

  function doorBlockedAt(x, y, radius) {
    if (!rt.world || !Array.isArray(rt.world.doors)) return null;
    const r = Number.isFinite(radius) ? radius : C.player.radius;
    for (const door of rt.world.doors) {
      if (doorState(door) === 'open') continue;
      for (const tile of door.tiles) {
        const nearX = ZQ.clamp(x, tile.x, tile.x + tile.w);
        const nearY = ZQ.clamp(y, tile.y, tile.y + tile.h);
        if (Math.hypot(x - nearX, y - nearY) < r * 0.85) return door;
      }
    }
    return null;
  }

  function canStandAt(x, y) {
    if (!canStandWalls(x, y)) return false;
    if (doorBlockedAt(x, y, C.player.radius)) return false;
    if (arcadeBlockedAt(x, y, C.player.radius)) return false;
    if (typeof ZQ.mirrorBlockedAt === 'function' &&
        ZQ.mirrorBlockedAt(x, y, C.player.radius)) return false;
    if (typeof ZQ.belzebufoBlockedAt === 'function' &&
        ZQ.belzebufoBlockedAt(x, y, C.player.radius)) return false;
    return true;
  }

  function roomUnderPlayer() {
    if (!rt.world || !rt.state) return null;
    return rt.world.roomAtTile(
      Math.floor(rt.state.player.x),
      Math.floor(rt.state.player.y)
    );
  }

  function currentRoom() {
    const under = roomUnderPlayer();
    if (under) return under;
    return rt.state.currentRoomId ? rt.world.roomById(rt.state.currentRoomId) : null;
  }

  function roomIdForPosition() {
    const under = roomUnderPlayer();
    if (under) return under.id;
    if (rt.state.currentRoomId) return rt.state.currentRoomId;
    let best = null;
    let bestDistance = Infinity;
    for (const room of rt.world.rooms) {
      const dx = room.centerX + 0.5 - rt.state.player.x;
      const dy = room.centerY + 0.5 - rt.state.player.y;
      const d = dx * dx + dy * dy;
      if (d < bestDistance) {
        bestDistance = d;
        best = room;
      }
    }
    return best ? best.id : null;
  }

  function snapCamera() {
    rt.state.camera.x = rt.state.player.x;
    rt.state.camera.y = rt.state.player.y;
  }

  function respawnAtTablet() {
    rt.state.player.x = rt.world.spawn.x;
    rt.state.player.y = rt.world.spawn.y;
    rt.state.player.facingX = 0;
    rt.state.player.facingY = -1;
    rt.state.player.moving = false;
    rt.state.currentRoomId = null;
    resetStepTracker();
    setSwampVeil(false);
    snapCamera();
  }

  function directionName(vx, vy) {
    const horizontal = Math.abs(vx) > 0.25;
    const vertical = Math.abs(vy) > 0.25;
    if (horizontal && vertical) {
      return `${vy < 0 ? 'вверх' : 'вниз'}-${vx < 0 ? 'влево' : 'вправо'}`;
    }
    if (horizontal) return vx < 0 ? 'влево' : 'вправо';
    return vy < 0 ? 'вверх' : 'вниз';
  }

  /* --------------------- Поиск пути по тайлам ---------------------- */
  /* ЛКМ ведёт Zemic не напрямик через стены, а по проходимым клеткам.
     A* работает по центрам тайлов; путь упрощается по прямой видимости. */

  function tileStandable(tx, ty) {
    return canStandAt(tx + 0.5, ty + 0.5);
  }

  function nearestStandableTile(tx, ty) {
    if (tileStandable(tx, ty)) return { x: tx, y: ty };
    for (let radius = 1; radius <= 28; radius += 1) {
      let best = null;
      let bestDistance = Infinity;
      for (let dy = -radius; dy <= radius; dy += 1) {
        for (let dx = -radius; dx <= radius; dx += 1) {
          if (Math.abs(dx) !== radius && Math.abs(dy) !== radius) continue;
          const x = tx + dx;
          const y = ty + dy;
          if (!tileStandable(x, y)) continue;
          const distance = dx * dx + dy * dy;
          if (distance < bestDistance) {
            bestDistance = distance;
            best = { x, y };
          }
        }
      }
      if (best) return best;
    }
    return null;
  }

  function lineWalkable(ax, ay, bx, by) {
    const distance = Math.hypot(bx - ax, by - ay);
    const steps = Math.max(1, Math.ceil(distance / 0.22));
    for (let i = 1; i <= steps; i += 1) {
      const t = i / steps;
      if (!canStandAt(ax + (bx - ax) * t, ay + (by - ay) * t)) return false;
    }
    return true;
  }

  function smoothPath(points) {
    if (points.length <= 2) return points;
    const result = [points[0]];
    let index = 0;
    while (index < points.length - 1) {
      let next = points.length - 1;
      for (; next > index + 1; next -= 1) {
        if (lineWalkable(points[index].x, points[index].y, points[next].x, points[next].y)) {
          break;
        }
      }
      result.push(points[next]);
      index = next;
    }
    return result;
  }

  function findPath(fromX, fromY, toX, toY) {
    const startTile = nearestStandableTile(Math.floor(fromX), Math.floor(fromY));
    const goalTile = nearestStandableTile(Math.floor(toX), Math.floor(toY));
    if (!startTile || !goalTile) return null;
    if (startTile.x === goalTile.x && startTile.y === goalTile.y) {
      if (canStandAt(toX, toY) && lineWalkable(fromX, fromY, toX, toY)) {
        return [{ x: toX, y: toY }];
      }
      return [{ x: goalTile.x + 0.5, y: goalTile.y + 0.5 }];
    }

    const key = (x, y) => `${x},${y}`;
    const startKey = key(startTile.x, startTile.y);
    const goalKey = key(goalTile.x, goalTile.y);
    const open = [{ x: startTile.x, y: startTile.y, g: 0, f: 0 }];
    const openKeys = new Set([startKey]);
    const cameFrom = new Map();
    const cost = new Map([[startKey, 0]]);
    const directions = [
      [1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1],
      [1, 1, Math.SQRT2], [1, -1, Math.SQRT2], [-1, 1, Math.SQRT2], [-1, -1, Math.SQRT2]
    ];
    const heuristic = (x, y) => {
      const dx = Math.abs(x - goalTile.x);
      const dy = Math.abs(y - goalTile.y);
      return Math.max(dx, dy) + (Math.SQRT2 - 1) * Math.min(dx, dy);
    };
    let visited = 0;

    while (open.length && visited < 12000) {
      let bestIndex = 0;
      for (let i = 1; i < open.length; i += 1) {
        if (open[i].f < open[bestIndex].f) bestIndex = i;
      }
      const current = open.splice(bestIndex, 1)[0];
      const currentKey = key(current.x, current.y);
      openKeys.delete(currentKey);
      visited += 1;

      if (currentKey === goalKey) {
        const tiles = [{ x: goalTile.x, y: goalTile.y }];
        let cursorKey = goalKey;
        while (cameFrom.has(cursorKey)) {
          const previous = cameFrom.get(cursorKey);
          tiles.push({ x: previous.x, y: previous.y });
          cursorKey = key(previous.x, previous.y);
        }
        tiles.reverse();
        const centers = tiles.map((tile) => ({ x: tile.x + 0.5, y: tile.y + 0.5 }));

        /* Путь начинается в точной позиции игрока, а не в центре его
           тайла. Иначе при каждом пересчёте (удержание ЛКМ) Zemic
           сначала шагал назад к центру клетки — отсюда рывки. */
        const points = [{ x: fromX, y: fromY }];
        if (lineWalkable(fromX, fromY, centers[0].x, centers[0].y)) {
          points.push(...centers.slice(1));
        } else {
          points.push(...centers);
        }

        /* Финальная точка — сам курсор, если до него можно дойти по
           прямой. Так цель не «прилипает» к центру тайла. */
        const lastCenter = centers[centers.length - 1];
        if (canStandAt(toX, toY) && lineWalkable(lastCenter.x, lastCenter.y, toX, toY)) {
          if (points.length > 1) {
            points[points.length - 1] = { x: toX, y: toY };
          } else {
            points.push({ x: toX, y: toY });
          }
        }
        return smoothPath(points);
      }

      for (const [dx, dy, step] of directions) {
        const nx = current.x + dx;
        const ny = current.y + dy;
        if (!tileStandable(nx, ny)) continue;
        /* Диагональ не должна срезать угол стены. */
        if (dx !== 0 && dy !== 0) {
          if (!tileStandable(current.x + dx, current.y) ||
              !tileStandable(current.x, current.y + dy)) continue;
        }
        const neighbourKey = key(nx, ny);
        const nextCost = current.g + step;
        if (nextCost >= (cost.get(neighbourKey) ?? Infinity)) continue;
        cost.set(neighbourKey, nextCost);
        cameFrom.set(neighbourKey, { x: current.x, y: current.y });
        const f = nextCost + heuristic(nx, ny);
        if (openKeys.has(neighbourKey)) {
          const existing = open.find((node) => node.x === nx && node.y === ny);
          if (existing) {
            existing.g = nextCost;
            existing.f = f;
          }
        } else {
          open.push({ x: nx, y: ny, g: nextCost, f });
          openKeys.add(neighbourKey);
        }
      }
    }
    return null;
  }

  function pathLength(points) {
    let total = 0;
    for (let i = 1; i < points.length; i += 1) {
      total += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
    }
    return total;
  }

  function cursorWaypoint(cursor) {
    if (!cursor) return null;
    if (!Array.isArray(cursor.path) || !cursor.path.length) {
      return { x: cursor.x, y: cursor.y };
    }
    const index = Math.min(cursor.pathIndex || 0, cursor.path.length - 1);
    return cursor.path[index];
  }

  function updateMovement(dt) {
    let mx = 0;
    let my = 0;
    let mode = 'keys';
    if (rt.keys.up || rt.gamepadKeys.up) my -= 1;
    if (rt.keys.down || rt.gamepadKeys.down) my += 1;
    if (rt.keys.left || rt.gamepadKeys.left) mx -= 1;
    if (rt.keys.right || rt.gamepadKeys.right) mx += 1;

    if (mx || my) {
      /* Ручное управление всегда важнее команды и цели курсора. */
      rt.timedMove = null;
      rt.cursorMove = null;
      mode = 'keys';
    } else if (rt.timedMove) {
      const move = rt.timedMove;
      move.remaining = Math.max(0, move.remaining - dt);
      mx = move.vx;
      my = move.vy;
      mode = 'timed';
      if (move.remaining <= 0) {
        rt.timedMove = null;
        mx = 0;
        my = 0;
      }
    } else if (rt.cursorMove) {
      const cursor = rt.cursorMove;
      let waypoint = cursorWaypoint(cursor);
      let dx = waypoint.x - rt.state.player.x;
      let dy = waypoint.y - rt.state.player.y;
      let distance = Math.hypot(dx, dy);
      if (distance <= 0.16 && Array.isArray(cursor.path) &&
          (cursor.pathIndex || 0) < cursor.path.length - 1) {
        cursor.pathIndex = (cursor.pathIndex || 0) + 1;
        waypoint = cursorWaypoint(cursor);
        dx = waypoint.x - rt.state.player.x;
        dy = waypoint.y - rt.state.player.y;
        distance = Math.hypot(dx, dy);
      }
      if (distance <= 0.09) {
        rt.cursorMove = null;
      } else {
        mx = dx / distance;
        my = dy / distance;
        mode = 'cursor';
      }
    }

    /* Схватка и погоня задают собственный темп и рывок, но двигают
       настоящего Zemic через ту же коллизию, что и обычный шаг. */
    const boost = (rt.battle && rt.battle.active)
      ? rt.battle
      : ((rt.chase && rt.chase.active) ? rt.chase : null);
    if (boost && boost.dashTimer > 0) {
      mx = boost.dashVX || 0;
      my = boost.dashVY || 0;
      mode = 'dash';
    }

    if (!mx && !my) {
      rt.state.player.moving = false;
      rt.moveLogDir = '';
      setSwampVeil(false);
      return;
    }

    const length = Math.hypot(mx, my);
    mx /= length;
    my /= length;
    rt.state.player.facingX = mx;
    rt.state.player.facingY = my;
    rt.state.player.moving = true;
    rt.state.animTime += dt;

    const name = directionName(mx, my);
    const time = ZQ.now();
    if (rt.moveLogDir !== name || time - rt.moveLogAt > 1200) {
      rt.moveLogDir = name;
      rt.moveLogAt = time;
      const suffix = mode === 'dash'
        ? ' (рывок)'
        : mode === 'timed' && rt.timedMove
          ? ` (${rt.timedMove.remaining.toFixed(1)} с)`
          : mode === 'cursor' ? ' (к курсору)' : '';
      ZQ.logEvent('movement', `шаг ${name}${suffix}`, 'шаг');
    }

    let step = (boost && Number.isFinite(boost.playerSpeed)
      ? boost.playerSpeed
      : C.player.speed) * dt;
    /* Жижа жука замедляет аксолотля, пока он по ней идёт. */
    if (boost && Number.isFinite(boost.playerSpeedScale) && boost.playerSpeedScale > 0) {
      step *= boost.playerSpeedScale;
    }
    /* Сапоги ускоряют обычный шаг. Рывок задаётся отдельной скоростью
       и намеренно не зависит от экипировки. */
    if (rt.state.items.includes('boots') && C.items.boots &&
        Number.isFinite(C.items.boots.speedMultiplier)) {
      step *= C.items.boots.speedMultiplier;
    }
    if (mode === 'dash') {
      step = (Number.isFinite(boost.dashSpeed) ? boost.dashSpeed : 12.5) * dt;
    }
    if (mode === 'cursor' && rt.cursorMove) {
      const waypoint = cursorWaypoint(rt.cursorMove);
      const remaining = Math.hypot(
        waypoint.x - rt.state.player.x,
        waypoint.y - rt.state.player.y
      );
      step = Math.min(step, remaining);
      /* Для шага со стола задаём длительность: одна клетка проходится
         ровно за указанное время, без рывка. */
      if (Number.isFinite(rt.cursorMove.speed) && rt.cursorMove.speed > 0) {
        step = Math.min(step, rt.cursorMove.speed * dt);
      }
    }
    /* Болото замедляет шаг, пока Лабиринт уже проснулся. До ответа
       Розе вода не считается: мир ещё спит. */
    const slowedBySwamp = mode !== 'dash' && inSwampNow() && storyGateOpen();
    if (slowedBySwamp && Number.isFinite(C.player.swampSpeedScale)) {
      step *= ZQ.clamp(C.player.swampSpeedScale, 0.1, 1);
    }
    setSwampVeil(slowedBySwamp);
    /* Живые существа (диметродоны) не пропускают сквозь себя, но их
       можно подталкивать: если моб мешает, он мягко уходит в сторону
       движения, и дорога открывается. Если за ним стена — герой
       упирается. Если моб уже накрыл аксолотля, даём выйти. */
    const mobStuck = typeof ZQ.faunaBlockedAt === 'function' &&
      ZQ.faunaBlockedAt(rt.state.player.x, rt.state.player.y, C.player.radius);
    const freeOfMobs = (x, y) => mobStuck ||
      typeof ZQ.faunaBlockedAt !== 'function' ||
      !ZQ.faunaBlockedAt(x, y, C.player.radius);
    /* Засадная бельзебуфо — твёрдая, пока сидит в своём болотце. Если
       она уже накрыла игрока, даём выйти: иначе прыжок в упор запирал
       бы аксолотля внутри жабы. */
    const frogStuck = typeof ZQ.belzebufoBlockedAt === 'function' &&
      ZQ.belzebufoBlockedAt(rt.state.player.x, rt.state.player.y, C.player.radius);
    const freeOfFrogs = (x, y) => frogStuck ||
      typeof ZQ.belzebufoBlockedAt !== 'function' ||
      !ZQ.belzebufoBlockedAt(x, y, C.player.radius);
    const tryAxis = (targetX, targetY, pushX, pushY) => {
      if (!canStandWalls(targetX, targetY)) return false;
      if (doorBlockedAt(targetX, targetY, C.player.radius)) return false;
      /* Корпус автомата твёрдый и тяжёлый: шаг в него толкает автомат
         лишь чуть-чуть, поэтому сдвинуть его можно только упором. */
      let arcade = arcadeBlockedAt(targetX, targetY, C.player.radius);
      if (arcade) {
        arcadePush(arcade, targetX, targetY, pushX, pushY, step * 0.35 + 0.005);
        arcade = arcadeBlockedAt(targetX, targetY, C.player.radius);
        if (arcade) return false;
      }
      /* Рамы зеркал твёрдые: в Зеркальном зале сквозь них не пройти. */
      if (typeof ZQ.mirrorBlockedAt === 'function' &&
          ZQ.mirrorBlockedAt(targetX, targetY, C.player.radius)) {
        return false;
      }
      if (!freeOfFrogs(targetX, targetY)) return false;
      if (freeOfMobs(targetX, targetY)) return true;
      if (typeof ZQ.faunaPush === 'function') {
        ZQ.faunaPush(targetX, targetY, pushX, pushY, step * 1.4 + 0.05);
      }
      return freeOfMobs(targetX, targetY);
    };
    const nx = rt.state.player.x + mx * step;
    if (tryAxis(nx, rt.state.player.y, mx, my)) {
      rt.state.player.x = nx;
    }
    const ny = rt.state.player.y + my * step;
    if (tryAxis(rt.state.player.x, ny, mx, my)) {
      rt.state.player.y = ny;
    }

    if (mode === 'cursor' && rt.cursorMove) {
      const waypoint = cursorWaypoint(rt.cursorMove);
      const distance = Math.hypot(
        waypoint.x - rt.state.player.x,
        waypoint.y - rt.state.player.y
      );
      const last = !Array.isArray(rt.cursorMove.path) ||
        (rt.cursorMove.pathIndex || 0) >= rt.cursorMove.path.length - 1;
      if (distance <= 0.1 && last) rt.cursorMove = null;
    }
    trackStep();
  }

  function startTimedMove(direction, seconds) {
    const dirs = {
      up: [0, -1, 'вверх'],
      down: [0, 1, 'вниз'],
      left: [-1, 0, 'влево'],
      right: [1, 0, 'вправо'],
      вверх: [0, -1, 'вверх'],
      вниз: [0, 1, 'вниз'],
      влево: [-1, 0, 'влево'],
      вправо: [1, 0, 'вправо']
    };
    const dir = dirs[String(direction || '').toLowerCase()];
    if (!dir) return '';
    const duration = ZQ.clamp(Number(seconds) || 1, 0.2, 120);
    rt.cursorMove = null;
    rt.timedMove = {
      vx: dir[0],
      vy: dir[1],
      remaining: duration,
      total: duration,
      direction: dir[2]
    };
    rt.state.player.facingX = dir[0];
    rt.state.player.facingY = dir[1];
    rt.state.player.moving = true;
    updateRoomDetection();
    updatePrompt();
    return ZQ.tr(`Иду ${dir[2]} ${duration} с.`);
  }

  function stopMovement() {
    ZQ.resetKeys();
    rt.state.player.moving = false;
    rt.timedMove = null;
    rt.cursorMove = null;
    rt.moveLogDir = '';
    return ZQ.tr('Движение остановлено.');
  }

  function setCursorDestination(x, y, hold, duration) {
    if (!rt.state || !rt.world) return false;
    const tx = Number(x);
    const ty = Number(y);
    if (!Number.isFinite(tx) || !Number.isFinite(ty)) return false;
    const goalTile = `${Math.floor(tx)},${Math.floor(ty)}`;
    const existing = rt.cursorMove;
    if (existing && existing.hold && hold &&
        existing.goalTile === goalTile &&
        Array.isArray(existing.path) && existing.path.length) {
      /* Пока курсор в той же клетке, путь остаётся прежним: не
         пересчитываем A* на каждый пиксель удержания. Но финальную
         точку двигаем за курсором, если до неё есть прямая видимость. */
      const path = existing.path;
      const last = path[path.length - 1];
      const base = path.length > 1
        ? path[path.length - 2]
        : { x: rt.state.player.x, y: rt.state.player.y };
      if (canStandAt(tx, ty) && lineWalkable(base.x, base.y, tx, ty)) {
        last.x = tx;
        last.y = ty;
        existing.x = tx;
        existing.y = ty;
      } else {
        existing.x = last.x;
        existing.y = last.y;
      }
      return true;
    }
    rt.timedMove = null;
    const fromX = rt.state.player.x;
    const fromY = rt.state.player.y;
    const path = findPath(fromX, fromY, tx, ty);
    if (!path || !path.length) return false;
    const distance = pathLength(path) || Math.hypot(tx - fromX, ty - fromY);
    const seconds = Number(duration);
    const speed = Number.isFinite(seconds) && seconds > 0 && distance > 0
      ? distance / seconds
      : 0;
    const last = path[path.length - 1];
    rt.cursorMove = {
      x: last.x,
      y: last.y,
      hold: Boolean(hold),
      speed,
      duration: speed > 0 ? seconds : 0,
      path,
      pathIndex: 0,
      goalTile
    };
    return true;
  }

  function updateCamera() {
    /* Камера без сглаживания и без прижатия к краям мира:
       Zemic всегда остаётся ровно в центре видимой области. */
    rt.state.camera.x = rt.state.player.x;
    rt.state.camera.y = rt.state.player.y;
  }

  /* -------------------------- Режимы курсора ----------------------- */
  /* ПКМ или двойной клик переключают режим. Вектор — привычная цель,
     клетка — выбор тайла, осмотр — описание без движения, путь —
     предпросмотр маршрута перед шагом. */
  function cursorModes() {
    return C.cursor && Array.isArray(C.cursor.modes) ? C.cursor.modes : [];
  }

  function cursorMode() {
    const modes = cursorModes();
    const fallback = modes[0] ? modes[0].id : 'vector';
    return modes.some((mode) => mode.id === rt.cursorMode) ? rt.cursorMode : fallback;
  }

  function cursorModeMeta(id) {
    return cursorModes().find((mode) => mode.id === id) || null;
  }

  function setCursorMode(id, announce) {
    const meta = cursorModeMeta(id);
    if (!meta) return false;
    rt.cursorMode = meta.id;
    rt.cursorPath = null;
    rt.cursorTile = null;
    rt.cursorPathGoal = null;
    if (announce) {
      ZQ.appendLog(
        `Курсор: ${meta.title}. ${meta.note}.`,
        'reply',
        true
      );
    }
    ZQ.logEvent('actions', `режим курсора: ${meta.title}`, 'курсор');
    return true;
  }

  function cycleCursorMode() {
    const modes = cursorModes();
    if (!modes.length) return null;
    const current = cursorMode();
    const index = modes.findIndex((mode) => mode.id === current);
    const next = modes[(index + 1) % modes.length];
    setCursorMode(next.id, true);
    if (ZQ.updatePrompt) ZQ.updatePrompt();
    return next;
  }

  function cursorModeCommand(arg) {
    const value = String(arg || '').trim().toLowerCase();
    const modes = cursorModes();
    if (!modes.length) return 'Режимы курсора не настроены.';
    if (!value) {
      const current = cursorModeMeta(cursorMode());
      const lines = [
        `Режим курсора: ${current ? current.title : 'вектор'}.`,
        'Режимы:'
      ];
      for (const mode of modes) {
        lines.push(`• ${mode.title} — ${mode.note}`);
      }
      lines.push('Переключение: «курсор клетка», «курсор осмотр», ПКМ или двойной клик по миру.');
      return lines.join('\n');
    }
    const meta = modes.find((mode) =>
      mode.id === value || String(mode.title).toLowerCase() === value
    );
    if (!meta) return `Нет режима «${arg}». ${cursorModeCommand('')}`;
    setCursorMode(meta.id, false);
    return `Курсор: ${meta.title}. ${meta.note}.`;
  }

  function tileDescription(tx, ty) {
    if (!rt.world) return 'Мир ещё не создан.';
    const room = rt.world.roomAtTile(tx, ty);
    const walkable = rt.world.isWalkable(tx, ty);
    const parts = [`Клетка ${tx}, ${ty}.`];
    parts.push(walkable ? 'Проходима.' : 'Стена или край.');
    if (room) {
      parts.push(`Комната «${room.name}», роль: ${room.role}.`);
    } else {
      parts.push('Это переход между комнатами.');
    }
    return parts.join(' ');
  }

  function applyCursorClick(x, y, options) {
    if (!rt.state || !rt.world) return false;
    const tx = Number(x);
    const ty = Number(y);
    if (!Number.isFinite(tx) || !Number.isFinite(ty)) return false;
    const opts = options || {};
    const mode = cursorMode();
    if (mode === 'inspect') {
      const text = tileDescription(Math.floor(tx), Math.floor(ty));
      ZQ.appendLog(text, 'reply', true);
      rt.cursorMove = null;
      rt.cursorPath = null;
      return true;
    }
    if (mode === 'tile') {
      const key = `${Math.floor(tx)},${Math.floor(ty)}`;
      if (rt.cursorTile === key) {
        rt.cursorTile = null;
        return setCursorDestination(tx, ty, Boolean(opts.hold), opts.duration);
      }
      rt.cursorTile = key;
      rt.cursorPath = null;
      ZQ.appendLog(`Клетка выбрана: ${key}. Повторный клик ведёт туда.`, 'reply', true);
      return true;
    }
    if (mode === 'path') {
      const key = `${Math.floor(tx)},${Math.floor(ty)}`;
      if (rt.cursorPathGoal === key) {
        rt.cursorPath = null;
        rt.cursorPathGoal = null;
        return setCursorDestination(tx, ty, Boolean(opts.hold), opts.duration);
      }
      const path = findPath(rt.state.player.x, rt.state.player.y, tx, ty);
      if (!path || !path.length) {
        ZQ.appendLog('Путь не найден: клетка недоступна.', 'reply', true);
        return false;
      }
      rt.cursorPath = path;
      rt.cursorPathGoal = key;
      const length = pathLength(path);
      ZQ.appendLog(
        `Маршрут: ${Math.round(length * 10) / 10} кл. Второй клик — идти.`,
        'reply',
        true
      );
      rt.timedMove = null;
      rt.cursorMove = null;
      return true;
    }
    rt.cursorPath = null;
    rt.cursorPathGoal = null;
    return setCursorDestination(tx, ty, Boolean(opts.hold), opts.duration);
  }

  function enterRoom(room) {
    if (!room) return;
    const firstVisit = !rt.state.visited[room.id];
    rt.state.currentRoomId = room.id;
    rt.state.visited[room.id] = true;
    if (rt.survivalBlockedRoom && rt.survivalBlockedRoom !== room.id) {
      rt.survivalBlockedRoom = null;
    }
    /* Музыка схватки и погони закреплена за сценой: переходя между
       залами, не переключаем кассету, иначе трек боя оборвётся. */
    const sceneLocked = Boolean(
      (rt.battle && rt.battle.active) || (rt.chase && rt.chase.active)
    );
    if (ZQ.audio && !sceneLocked) ZQ.audio.setCue(room.music, { seed: room.id });

    if (firstVisit) {
      ZQ.saveGame();
      ZQ.appendLog(`— ${room.name} —`, 'sys', true);
      ZQ.logEvent('actions', `вошёл в комнату «${room.name}»`, 'комната');
    }

    /* Пока схватка или погоня не закончилась, новых врагов не ищем:
       ни вода, ни жаба, ни змея не начинаются поверх текущего боя.
       Иначе длинная схватка превращается в цепочку врагов. */
    if ((rt.battle && rt.battle.active) || (rt.chase && rt.chase.active)) return;

    /* До ответа Розе Лабиринт ещё спит: никаких схваток, погонь и
       засад. Сюжетные реплики при этом остаются — они и ведут к
       зеркальному залу. */
    const gateOpen = storyGateOpen();

    /* Вода приходит без разрешения: комната сама запускает выживание,
       как только Zemic оказывается внутри. */
    const survivalKind = room.role === 'beetle' || room.role === 'umbrella'
      ? room.role
      : null;
    if (gateOpen && survivalKind) {
      const flag = `${survivalKind}Done`;
      if (!rt.state.flags[flag] && rt.survivalBlockedRoom !== room.id) {
        ZQ.startBattle(survivalKind);
        return;
      }
    }

    /* Бельзебуфо не бросается с порога: она сидит в болоте и ждёт,
       пока Zemic подойдёт к её плёсу. Проверка дистанции живёт в
       updateBelzebufoAmbush(). */

    /* Титанобоа ровно одна на мир. Погоня начинается при входе, пока
       змея не успокоилась. */
    if (gateOpen && room.faunaKind === 'titanoboa' && !rt.state.flags.titanoboaCalm && !rt.chase &&
        typeof ZQ.startChase === 'function') {
      ZQ.startChase(room);
      return;
    }

    if (!firstVisit) return;

    if (gateOpen && room.role === 'trial') {
      ZQ.queueStory('trial', () => {
        if (!rt.state.flags.trialDone && !rt.trial) {
          rt.state.flags.trialAttempted = true;
          ZQ.startTrial();
        }
      });
      return;
    }

    if (C.story[room.role]) {
      /* До зеркал Лабиринт говорит только о Скрижали и о Розе. */
      if (!gateOpen && room.role !== 'tablet' && room.role !== 'mirror') return;
      /* И даже открытая сцена не играет, пока её узел закрыт. */
      if (!storyRoomOpen(room.role)) return;
      if (room.role === 'tablet') {
        ZQ.queueStory(room.role, () => {
          ZQ.unlock('backpack');
          ZQ.unlock('table');
        });
      } else {
        ZQ.queueStory(room.role, () => ZQ.updatePrompt());
      }
      return;
    }

    if (room.faunaKind && C.fauna[room.faunaKind]) {
      const fauna = C.fauna[room.faunaKind];
      const speaker = String(room.name || fauna.name).toUpperCase();
      for (const line of fauna.lines) {
        ZQ.appendLog(line, 'story', false, speaker);
      }
      return;
    }

    if (gateOpen && room.storyIndex !== null && room.storyIndex !== undefined &&
        C.proceduralStories[room.storyIndex]) {
      if (ZQ.queueProceduralStory(room)) return;
    }

    const ambient = C.ambientRoomLines[
      window.World.hashString(`${rt.state.seed}:ambient:${room.id}`) % C.ambientRoomLines.length
    ];
    ZQ.appendLog(ambient, 'story', true, 'ЛАБИРИНТ');
  }

  function updateRoomDetection() {
    if (!rt.world || !rt.state) return;
    const room = roomUnderPlayer();
    if (room && rt.state.currentRoomId !== room.id) enterRoom(room);
    updateBelzebufoAmbush(room);
  }

  /* Жаба зала прячется в болоте. Бой начинается не на входе, а когда
     аксолотль подходит к её плёсу: spawnAt держит жабу в центре зала,
     где она и сидела всё это время. */
  function updateBelzebufoAmbush(room) {
    if (!storyGateOpen()) return;
    if (!room || room.faunaKind !== 'belzebufo') return;
    if (!rt.state || !rt.state.player) return;
    if ((rt.battle && rt.battle.active) || (rt.chase && rt.chase.active) || rt.trial) return;
    if (rt.state.flags[`belzebufo_${room.id}`]) return;
    if (rt.survivalBlockedRoom === room.id) return;
    const cfg = C.faunaDynamics || {};
    const trigger = Number.isFinite(cfg.roomTrigger) ? cfg.roomTrigger : 4.2;
    const player = rt.state.player;
    const dx = player.x - (room.centerX + 0.5);
    const dy = player.y - (room.centerY + 0.5);
    if (dx * dx + dy * dy > trigger * trigger) return;
    if (typeof ZQ.startBattle !== 'function') return;
    ZQ.startBattle('belzebufo', {
      roomId: room.id,
      spawnAt: { x: room.centerX + 0.5, y: room.centerY + 0.5 }
    });
  }

  /* ------------------- Засады бельзебуфо в проходах ---------------- */
  /* Жаба встречается не только в своих залах: часть жаб поджидает в
     проходах и обычных комнатах. Такая жаба не мигрирует по миру — она
     патрулирует крохотный участок вокруг своего болотца, перепрыгивая
     с кочки на кочку, и нападает, когда аксолотль подходит вплотную. */
  function ensureRoam() {
    if (!rt.roam || typeof rt.roam !== 'object') {
      rt.roam = { belzebufos: [], seeded: {}, cooldown: 0 };
    }
    const roam = rt.roam;
    if (!Array.isArray(roam.belzebufos)) roam.belzebufos = [];
    if (!roam.seeded || typeof roam.seeded !== 'object') roam.seeded = {};
    if (!Number.isFinite(roam.cooldown)) roam.cooldown = 0;
    return roam;
  }

  /* Сидящая засадная бельзебуфо — твёрдая. В активном бою её здесь
     уже нет: жаба снимается из патруля в момент нападения, поэтому
     столкновение не мешает урону от касания и рывку языка. */
  function belzebufoBlockedAt(x, y, radius) {
    const roam = ensureRoam();
    if (!roam.belzebufos.length) return null;
    const cfg = C.faunaDynamics || {};
    const base = Number.isFinite(cfg.roamCollisionRadius) ? cfg.roamCollisionRadius : 0.5;
    const playerRadius = Number.isFinite(radius)
      ? radius
      : (Number.isFinite(C.player && C.player.radius) ? C.player.radius : 0.34);
    const reach = playerRadius + base;
    const reachSq = reach * reach;
    for (const frog of roam.belzebufos) {
      const dx = frog.x - x;
      const dy = frog.y - y;
      if (dx * dx + dy * dy < reachSq) return frog;
    }
    return null;
  }

  /* Болотце засадной жабы: маленький плёс с камышом и кувшинкой.
     Параметры детерминированы клеткой, поэтому одна и та же жаба
     всегда сидит в одном и том же месте. */
  function makeRoamSwamp(x, y, h) {
    const cfg = C.faunaDynamics || {};
    const spec = cfg.roamSwamp || {};
    const radii = Array.isArray(spec.radius) ? spec.radius : [1.25, 1.55];
    const reedRange = Array.isArray(spec.reeds) ? spec.reeds : [2, 5];
    const mix = (salt) => {
      const key = `${rt.state && rt.state.seed ? rt.state.seed : ''}:frogswamp:${x}:${y}:${salt}`;
      return window.World && typeof window.World.hashString === 'function'
        ? window.World.hashString(key) / 4294967296
        : h;
    };
    const lo = Number.isFinite(radii[0]) ? radii[0] : 1.25;
    const hi = Math.max(lo, Number.isFinite(radii[1]) ? radii[1] : 1.55);
    const reedLo = Math.max(0, Math.round(Number.isFinite(reedRange[0]) ? reedRange[0] : 2));
    const reedHi = Math.max(reedLo, Math.round(Number.isFinite(reedRange[1]) ? reedRange[1] : 5));
    const reedCount = reedLo + Math.floor(mix('reeds') * (reedHi - reedLo + 1));
    return {
      radius: lo + mix('radius') * (hi - lo),
      reeds: reedCount,
      lily: mix('lily') < (Number.isFinite(spec.lilyChance) ? spec.lilyChance : 0.55),
      phase: h * 6.283
    };
  }

  /* Засадная жаба: свой окрас и размер (детерминированы клеткой),
     своё болотце и короткие прыжки вокруг него вместо ползания. */
  function makeRoamFrog(x, y, h) {
    const homeX = x + 0.5;
    const homeY = y + 0.5;
    return {
      x: homeX,
      y: homeY,
      homeX,
      homeY,
      tx: homeX,
      ty: homeY,
      seed: `${x},${y}`,
      phase: h * 6.283,
      facing: Math.PI / 2,
      moving: false,
      pause: 1.5 + h * 6,
      /* Прыжок патруля: присед, полёт по дуге, приземление. */
      hopState: 'idle',
      hopTimer: 0,
      hopCooldown: 0,
      hopDuration: 0,
      hopFrom: { x: homeX, y: homeY },
      hopTo: { x: homeX, y: homeY },
      hopProgress: 0,
      hopHeight: 0,
      landFlash: 0,
      stride: 0,
      /* Сколько жаба неподвижна: пока она сидит и игрок далеко, она
         сливается с болотом. Прыжок выдаёт её. */
      still: 1.5,
      swamp: makeRoamSwamp(x, y, h)
    };
  }

  /* Клетка годится для засады: болотный тайл в проходе или обычной
     комнате, но не сюжетный зал и не чужая арена. */
  function roamCellAllowed(x, y) {
    if (!rt.world || !rt.world.isWalkable(x, y)) return false;
    /* Жаба сидит именно в болоте, а не на любом полу: тайл 6 — её
       настоящий ареал, который остаётся на карте навсегда. */
    if (typeof rt.world.isSwamp === 'function' && !rt.world.isSwamp(x, y)) return false;
    const room = rt.world.roomAtTile(x, y);
    if (!room) return true;
    if (room.faunaKind === 'belzebufo') return false;
    if (room.role !== 'procedural' || room.storyIndex !== null) return false;
    return true;
  }

  /* Прямая между клетками свободна: короткий прыжок патруля не должен
     проходить сквозь стену. */
  function roamLineClear(fromX, fromY, toX, toY) {
    if (!rt.world) return false;
    const steps = Math.max(Math.abs(toX - fromX), Math.abs(toY - fromY));
    for (let i = 1; i < steps; i += 1) {
      const x = Math.round(fromX + ((toX - fromX) * i) / steps);
      const y = Math.round(fromY + ((toY - fromY) * i) / steps);
      if (!rt.world.isWalkable(x, y)) return false;
    }
    return true;
  }

  /* Куда прыгнуть на патруле: болотная клетка своего участка, куда
     ведёт прямая без стены. Прыжок длиннее одной клетки — жаба
     перемахивает через кочку, а не переползает. */
  function roamHopTarget(frog, radius, maxJump) {
    const hx = Math.floor(frog.homeX);
    const hy = Math.floor(frog.homeY);
    const cx = Math.floor(frog.x);
    const cy = Math.floor(frog.y);
    const jumpLimit = Math.max(1, Math.round(Number.isFinite(maxJump) ? maxJump : 2));
    for (let attempt = 0; attempt < 12; attempt += 1) {
      const ox = hx + Math.floor((Math.random() * 2 - 1) * radius);
      const oy = hy + Math.floor((Math.random() * 2 - 1) * radius);
      if (ox === cx && oy === cy) continue;
      /* Держим жабу в пределах плёса: прыжок не длиннее пары клеток. */
      const jump = Math.abs(ox - cx) + Math.abs(oy - cy);
      if (jump < 1 || jump > jumpLimit) continue;
      if (!roamCellAllowed(ox, oy)) continue;
      if (!roamLineClear(cx, cy, ox, oy)) continue;
      return { x: ox + 0.5, y: oy + 0.5 };
    }
    return null;
  }

  /* Патруль: жаба не стоит камнем, но и не рыщет — она перепрыгивает
     на соседнюю клетку своего болотца, потом надолго замирает. */
  function updateRoamFrogs(dt) {
    const roam = ensureRoam();
    if (!roam.belzebufos.length || !rt.world) return;
    const cfg = C.faunaDynamics || {};
    const hopCfg = cfg.roamHop || {};
    const windup = Number.isFinite(hopCfg.windup) ? hopCfg.windup : 0.2;
    const duration = Number.isFinite(hopCfg.duration) ? hopCfg.duration : 0.34;
    const height = Number.isFinite(hopCfg.height) ? hopCfg.height : 0.72;
    const hopCooldown = Number.isFinite(hopCfg.cooldown) ? hopCfg.cooldown : 0.15;
    const radius = Math.max(1, Math.round(
      Number.isFinite(cfg.roamPatrolRadius) ? cfg.roamPatrolRadius : 3
    ));
    const maxJump = Math.max(1, Math.round(
      Number.isFinite(cfg.roamPatrolJump) ? cfg.roamPatrolJump : 2
    ));
    const pauseRange = Array.isArray(cfg.roamPatrolPause) ? cfg.roamPatrolPause : [3.5, 9];
    const pauseLo = Number.isFinite(pauseRange[0]) ? pauseRange[0] : 3.5;
    const pauseHi = Math.max(pauseLo, Number.isFinite(pauseRange[1]) ? pauseRange[1] : 9);
    for (const frog of roam.belzebufos) {
      if (frog.landFlash > 0) frog.landFlash = Math.max(0, frog.landFlash - dt * 3);
      const state = frog.hopState || 'idle';
      if (state === 'crouch' || state === 'air') frog.still = 0;
      else frog.still = (Number.isFinite(frog.still) ? frog.still : 0) + dt;
      if (state === 'crouch') {
        frog.moving = true;
        frog.hopTimer -= dt;
        if (frog.hopTimer <= 0) {
          frog.hopState = 'air';
          frog.hopTimer = duration;
          frog.hopDuration = duration;
          frog.hopProgress = 0;
        }
        continue;
      }
      if (state === 'air') {
        frog.moving = true;
        frog.hopTimer -= dt;
        const total = frog.hopDuration || duration;
        const progress = ZQ.clamp(1 - frog.hopTimer / Math.max(0.001, total), 0, 1);
        frog.hopProgress = progress;
        frog.x = frog.hopFrom.x + (frog.hopTo.x - frog.hopFrom.x) * progress;
        frog.y = frog.hopFrom.y + (frog.hopTo.y - frog.hopFrom.y) * progress;
        frog.hopHeight = Math.sin(progress * Math.PI) * height;
        frog.stride += dt * 16;
        if (frog.hopTimer <= 0) {
          frog.x = frog.hopTo.x;
          frog.y = frog.hopTo.y;
          frog.tx = frog.hopTo.x;
          frog.ty = frog.hopTo.y;
          frog.hopHeight = 0;
          frog.hopProgress = 0;
          frog.hopState = 'idle';
          frog.hopCooldown = hopCooldown;
          frog.landFlash = 1;
          frog.moving = false;
          frog.stride = 0;
          frog.pause = pauseLo + Math.random() * (pauseHi - pauseLo);
        }
        continue;
      }
      if (frog.hopCooldown > 0) frog.hopCooldown = Math.max(0, frog.hopCooldown - dt);
      frog.moving = false;
      frog.hopHeight = 0;
      frog.pause = (Number.isFinite(frog.pause) ? frog.pause : 0) - dt;
      if (frog.pause > 0) continue;
      const target = roamHopTarget(frog, radius, maxJump);
      if (!target) {
        frog.pause = 1.5 + Math.random() * 2;
        continue;
      }
      frog.hopFrom = { x: frog.x, y: frog.y };
      frog.hopTo = { x: target.x, y: target.y };
      frog.tx = target.x;
      frog.ty = target.y;
      const dx = target.x - frog.x;
      const dy = target.y - frog.y;
      const length = Math.hypot(dx, dy) || 1;
      frog.facing = Math.atan2(dy, dx);
      frog.facingX = dx / length;
      frog.facingY = dy / length;
      frog.hopState = 'crouch';
      frog.hopTimer = windup;
      frog.moving = true;
      frog.stride = 0;
    }
  }

  /* Возврат врага на ареал обитания: после любого боя жаба не исчезает,
     а снова сидит в своём болотце. После победы она «остывает» дольше,
     чтобы игрок успел уйти, а не получал новую схватку на том же месте. */
  function restoreRoamFrog(frog, opts) {
    if (!frog || typeof frog !== 'object') return false;
    const options = opts || {};
    const roam = ensureRoam();
    if (roam.belzebufos.includes(frog)) return false;
    const homeX = Number.isFinite(frog.homeX) ? frog.homeX : frog.x;
    const homeY = Number.isFinite(frog.homeY) ? frog.homeY : frog.y;
    frog.homeX = homeX;
    frog.homeY = homeY;
    frog.x = homeX;
    frog.y = homeY;
    frog.tx = homeX;
    frog.ty = homeY;
    frog.hopFrom = { x: homeX, y: homeY };
    frog.hopTo = { x: homeX, y: homeY };
    frog.hopState = 'idle';
    frog.hopTimer = 0;
    frog.hopCooldown = 0;
    frog.hopProgress = 0;
    frog.hopHeight = 0;
    frog.landFlash = 0;
    frog.stride = 0;
    frog.pause = 4 + Math.random() * 4;
    frog.moving = false;
    frog.still = 0;
    if (!frog.swamp) {
      const x = Math.floor(homeX);
      const y = Math.floor(homeY);
      const h = window.World && typeof window.World.hashString === 'function'
        ? window.World.hashString(`frog:${x}:${y}`) / 4294967296
        : 0.5;
      frog.swamp = makeRoamSwamp(x, y, h);
    }
    roam.belzebufos.push(frog);
    const cfg = C.faunaDynamics || {};
    const cooldown = options.afterVictory
      ? (Number.isFinite(cfg.roamVictoryCooldown) ? cfg.roamVictoryCooldown : 55)
      : (Number.isFinite(cfg.roamReturnCooldown) ? cfg.roamReturnCooldown : 18);
    roam.cooldown = Math.max(Number.isFinite(roam.cooldown) ? roam.cooldown : 0, cooldown);
    return true;
  }

  function updateRoam(dt) {
    if (!storyGateOpen()) return;
    if (!rt.world || !rt.state || !rt.state.player) return;
    if (!Number.isFinite(dt) || dt <= 0) return;
    if ((rt.battle && rt.battle.active) || (rt.chase && rt.chase.active) || rt.trial) return;
    const cfg = C.faunaDynamics || {};
    const roam = ensureRoam();
    if (roam.cooldown > 0) roam.cooldown = Math.max(0, roam.cooldown - dt);

    const player = rt.state.player;
    /* Невалидные координаты игрока превращают границы цикла в Infinity,
       и перебор клеток никогда не заканчивается. */
    if (!Number.isFinite(player.x) || !Number.isFinite(player.y)) return;
    const seedRadius = Number.isFinite(cfg.roamSeedRadius) ? cfg.roamSeedRadius : 13;
    const chance = Number.isFinite(cfg.roamChance) ? cfg.roamChance : 0.0025;
    const maxFrogs = Math.max(1, Math.round(
      Number.isFinite(cfg.roamMaxFrogs) ? cfg.roamMaxFrogs : 1
    ));
    /* На участок довольно одной жабы: пока она жива, новые не сеются. */
    if (roam.belzebufos.length > maxFrogs) {
      roam.belzebufos.splice(0, roam.belzebufos.length - maxFrogs);
    }
    const R = Math.max(1, Math.round(seedRadius));
    const cx = Math.floor(player.x);
    const cy = Math.floor(player.y);
    for (let y = cy - R; y <= cy + R && roam.belzebufos.length < maxFrogs; y += 1) {
      for (let x = cx - R; x <= cx + R; x += 1) {
        const key = `${x},${y}`;
        if (roam.seeded[key]) continue;
        roam.seeded[key] = 1;
        /* Жабы сидят в болотце: в проходе или обычной комнате, но не
           в сюжетном зале и не в чужой фаунной арене. */
        if (!roamCellAllowed(x, y)) continue;
        const h = window.World.hashString(`${rt.state.seed}:roam:${x}:${y}`) / 4294967296;
        if (h >= chance) continue;
        roam.belzebufos.push(makeRoamFrog(x, y, h));
        if (roam.belzebufos.length >= maxFrogs) break;
      }
    }
    /* Кэш посещённых клеток растёт по мере исследования: иногда чистим. */
    let seededCount = 0;
    for (const _key in roam.seeded) seededCount += 1;
    if (seededCount > 12000) roam.seeded = {};

    /* Патруль идёт всегда: жабы прыгают даже пока засада «остывает». */
    updateRoamFrogs(dt);

    if (roam.cooldown > 0) return;
    const trigger = Number.isFinite(cfg.roamTrigger) ? cfg.roamTrigger : 2.2;
    const triggerSq = trigger * trigger;
    for (let i = roam.belzebufos.length - 1; i >= 0; i -= 1) {
      const frog = roam.belzebufos[i];
      const dx = frog.x - player.x;
      const dy = frog.y - player.y;
      if (dx * dx + dy * dy > triggerSq) continue;
      roam.belzebufos.splice(i, 1);
      roam.cooldown = Number.isFinite(cfg.roamCooldown) ? cfg.roamCooldown : 34;
      const started = typeof ZQ.startBattle === 'function'
        ? ZQ.startBattle('belzebufo', {
          roam: true,
          spawnAt: { x: frog.x, y: frog.y },
          frog
        })
        : false;
      /* Если бой не начался (занят другой сценой, сработал флаг),
         жаба не пропадает: она просто возвращается в своё болотце. */
      if (!started) restoreRoamFrog(frog);
      return;
    }
  }

  const DEATH_FX_DURATION = 1250;

  function die(cause) {
    if (!rt.state || (rt.deathFx && rt.deathFx.active)) return;
    const roomId = roomIdForPosition();
    const now = ZQ.now();
    const deathX = rt.state.player.x;
    const deathY = rt.state.player.y;
    const backpack = {
      id: ZQ.makeId('bp'),
      x: deathX,
      y: deathY,
      roomId,
      items: rt.state.items.slice(),
      cause,
      createdAt: Date.now()
    };
    rt.state.backpacks.push(backpack);
    rt.state.items = [];
    rt.state.deaths = (rt.state.deaths || 0) + 1;
    /* Анимация идёт на месте гибели; возврат к Скрижали произойдёт,
       когда она закончится. */
    rt.deathFx = {
      active: true,
      startedAt: now,
      duration: DEATH_FX_DURATION,
      x: deathX,
      y: deathY,
      facingX: rt.state.player.facingX || 0,
      facingY: rt.state.player.facingY || -1,
      roomId,
      cause
    };
    rt.invulnUntil = now + DEATH_FX_DURATION + 2600;

    const room = roomId ? rt.world.roomById(roomId) : null;
    const roomPhrase = room ? `в комнате «${room.name}»` : 'в переходе между комнатами';
    const count = backpack.items.length;
    const deathText = count
      ? `Ты снова у Скрижали. Рюкзак остался ${roomPhrase}: ${count} ${ZQ.plural(count, ['предмет', 'предмета', 'предметов'])}. Он никуда не денется.`
      : `Ты снова у Скрижали. Рюкзак остался ${roomPhrase} — пустой, но никуда не денется.`;

    ZQ.setTerminalView('main');
    dom.btnAction.classList.add('hidden');
    ZQ.resetKeys();
    ZQ.appendLog(C.story.death.lines[0], 'story', true, C.story.death.speaker || 'СКРИЖАЛЬ');
    ZQ.appendLog(deathText, 'sys', false, 'система');
    ZQ.logEvent('actions', `смерть: ${cause || 'неизвестно'}`, 'смерть');
    rt.lastFrame = ZQ.now();
    ZQ.saveGame();
    updatePrompt();
  }

  function finishDeath() {
    if (!rt.deathFx || !rt.deathFx.active) return false;
    rt.deathFx = null;
    respawnAtTablet();
    ZQ.resetKeys();
    updateRoomDetection();
    ZQ.saveGame();
    updatePrompt();
    return true;
  }

  function updateDeathFx() {
    const fx = rt.deathFx;
    if (!fx || !fx.active) return false;
    if (ZQ.now() - fx.startedAt < fx.duration) return false;
    return finishDeath();
  }

  function collectItemPickup(pickup) {
    if (rt.state.flags[`taken_${pickup.itemId}`]) return false;
    const item = C.items[pickup.itemId];
    const name = item ? item.name : pickup.itemId;
    const added = ZQ.addInventoryItem(pickup.itemId);
    if (!added.ok) {
      ZQ.appendLog(
        `Инвентарь заполнен: ${ZQ.inventoryUsed()} из ${ZQ.inventoryCapacity()} ячеек. «${name}» остаётся на месте.`,
        'sys',
        true
      );
      updatePrompt();
      return false;
    }
    rt.state.flags[`taken_${pickup.itemId}`] = true;
    ZQ.appendLog(`В инвентаре: ${name}`, 'sys', true);
    ZQ.appendLog(`Взято: ${name}.`, 'reply', true);
    ZQ.logEvent('actions', `взял «${name}»`, 'находка');
    ZQ.unlock('backpack');
    if (pickup.itemId === 'map_fragment') ZQ.unlock('map');
    ZQ.saveGame();
    updatePrompt();
    return true;
  }

  function takeCard() {
    if (rt.state.flags.cardTaken) return false;
    const added = ZQ.addInventoryItem('card_angel');
    if (!added.ok) {
      ZQ.appendLog(
        `Инвентарь заполнен: ${ZQ.inventoryUsed()} из ${ZQ.inventoryCapacity()} ячеек. Карта остаётся в круге.`,
        'sys',
        true
      );
      updatePrompt();
      return false;
    }
    rt.state.flags.cardTaken = true;
    ZQ.appendLog('Получена карта «Очарование»', 'sys', true);
    ZQ.appendLog('Карта «Очарование» лежит в инвентаре. Её можно вынести на стол.', 'reply');
    ZQ.logEvent('actions', 'взял карту «Очарование»', 'находка');
    ZQ.saveGame();
    updatePrompt();
    return true;
  }

  function retrieveBackpack(backpack) {
    const restored = [];
    const leftover = [];
    /* Сначала предметы-контейнеры: рюкзак внутри рюкзака должен успеть
       расширить инвентарь до того, как в него вернут остальное. */
    const ordered = backpack.items.slice().sort((a, b) => {
      const aBonus = C.items[a] && Number.isFinite(C.items[a].slotBonus) ? 0 : 1;
      const bBonus = C.items[b] && Number.isFinite(C.items[b].slotBonus) ? 0 : 1;
      return aBonus - bBonus;
    });
    for (const itemId of ordered) {
      if (rt.state.items.includes(itemId)) continue;
      const result = ZQ.addInventoryItem(itemId);
      const item = C.items[itemId];
      const name = item ? item.name : itemId;
      if (result.ok) restored.push(name);
      else leftover.push(itemId);
    }
    rt.state.backpacks = rt.state.backpacks.filter((bp) => bp.id !== backpack.id);
    if (leftover.length) {
      rt.state.backpacks.push({
        id: ZQ.makeId('bp'),
        x: backpack.x,
        y: backpack.y,
        roomId: backpack.roomId,
        items: leftover,
        cause: backpack.cause,
        createdAt: Date.now()
      });
    }
    if (restored.length) {
      ZQ.appendLog(`Рюкзак возвращён: ${restored.join(', ')}`, 'sys', true);
      ZQ.appendLog(`Рюкзак возвращён. Внутри: ${restored.join(', ')}.`, 'reply');
      ZQ.logEvent('actions', `вернул рюкзак: ${restored.join(', ')}`, 'рюкзак');
    } else {
      ZQ.appendLog('Пустой рюкзак возвращён', 'sys', true);
      ZQ.appendLog('Рюкзак возвращён. Внутри ничего не было.', 'reply');
      ZQ.logEvent('actions', 'вернул пустой рюкзак', 'рюкзак');
    }
    if (leftover.length) {
      const names = leftover.map((id) => (C.items[id] ? C.items[id].name : id));
      ZQ.appendLog(
        `Инвентарь полон: ${names.join(', ')} остаются в рюкзаке на месте.`,
        'sys',
        true
      );
    }
    ZQ.saveGame();
    updatePrompt();
    if (rt.termView === 'inventory') ZQ.renderInventory();
    if (rt.termView === 'canvas' || rt.termView === 'card') ZQ.renderCanvasElements();
  }

  function findInteractable() {
    if (!rt.world || !rt.state) return null;
    const px = rt.state.player.x;
    const py = rt.state.player.y;
    let best = null;
    let bestDistance = Infinity;

    function consider(target, distance, limit) {
      const cap = Number.isFinite(limit) ? limit : 1.22;
      if (distance < bestDistance && distance <= cap) {
        bestDistance = distance;
        best = target;
      }
    }

    for (const pickup of rt.world.itemPickups) {
      if (rt.state.flags[`taken_${pickup.itemId}`]) continue;
      consider({ type: 'item', pickup }, Math.hypot(px - pickup.x, py - pickup.y));
    }

    for (const backpack of rt.state.backpacks) {
      consider({ type: 'backpack', backpack }, Math.hypot(px - backpack.x, py - backpack.y));
    }

    for (const door of rt.world.doors || []) {
      for (const approach of door.approaches) {
        consider(
          { type: 'door', door },
          Math.hypot(px - approach.x, py - approach.y),
          1.3
        );
      }
    }

    /* Аркадный автомат стоит на клетке пола, поэтому подойти можно
       вплотную или встать рядом. Радиус чуть больше обычного: корпус
       выше Zemic, и подсказка должна появляться до касания. */
    for (const arcade of rt.world.arcades || []) {
      const center = arcadeCenter(arcade);
      const distance = Math.hypot(px - center.x, py - center.y);
      if (distance <= 1.35 && distance < bestDistance) {
        bestDistance = distance;
        best = { type: 'arcade', arcade };
      }
    }

    const tabletDistance = Math.hypot(px - rt.world.tablet.x, py - rt.world.tablet.y);
    if (tabletDistance <= 1.65 && tabletDistance < bestDistance) {
      bestDistance = tabletDistance;
      best = { type: 'tablet' };
    }

    if (rt.state.flags.trialDone && !rt.state.flags.cardTaken && rt.world.trialRoom) {
      const distance = Math.hypot(
        px - (rt.world.trialRoom.centerX + 0.5),
        py - (rt.world.trialRoom.centerY + 0.5)
      );
      if (distance <= 1.55 && distance < bestDistance) {
        bestDistance = distance;
        best = { type: 'card' };
      }
    }

    if (!rt.state.flags.trialDone && rt.world.trialRoom) {
      const distance = Math.hypot(
        px - (rt.world.trialRoom.centerX + 0.5),
        py - (rt.world.trialRoom.centerY + 0.5)
      );
      if (distance <= 1.55 && distance < bestDistance) {
        bestDistance = distance;
        best = { type: 'trial' };
      }
    }

    /* Роза и три рамы Зеркального зала живут в собственном модуле:
       он сам решает, что находится в пределах шага. */
    if (typeof ZQ.mirrorTarget === 'function') {
      const mirror = ZQ.mirrorTarget(px, py);
      if (mirror) consider(mirror, mirror.distance, 1.9);
    }

    /* Мордастик живёт в собственном зале: модуль сам решает,
       находится ли игрок в пределах разговора. */
    if (typeof ZQ.earedTarget === 'function') {
      const eared = ZQ.earedTarget(px, py);
      if (eared) consider(eared, eared.distance, 2.0);
    }

    return best;
  }

  function promptFor(target) {
    if (!target) return '';
    if (target.type === 'item') {
      const item = C.items[target.pickup.itemId];
      return `взять «${item ? item.name : 'находка'}»`;
    }
    if (target.type === 'backpack') {
      const count = target.backpack.items.length;
      return count ? `подобрать рюкзак (${count})` : 'подобрать пустой рюкзак';
    }
    if (target.type === 'tablet') return 'коснуться Скрижали';
    if (target.type === 'door') {
      const status = doorState(target.door);
      if (status === 'locked') return 'отпереть замок некрополя';
      if (status === 'closed') return 'закрыть дверь некрополя на замок';
      return 'закрыть дверь некрополя';
    }
    if (target.type === 'card') return 'взять карту';
    if (target.type === 'trial') return 'войти в круг';
    if (target.type === 'arcade') return 'сыграть на автомате';
    if (target.type === 'vishnya') return 'заговорить с Розой';
    if (target.type === 'mirror') return `посмотреть в ${target.mirror.label}`;
    if (target.type === 'eared') return 'заговорить с Мордастиком';
    return '';
  }

  function updatePrompt() {
    /* Инвентарь не ставит игру на паузу: пока он открыт, узел автомата
       должен исчезать, как только Zemic отходит от корпуса. */
    if (rt.termView === 'inventory' && typeof ZQ.syncInventoryCabinet === 'function') {
      ZQ.syncInventoryCabinet();
    }
    if (ZQ.isPaused() || ZQ.isTyping()) {
      rt.activePrompt = null;
      rt.promptLabel = '';
      dom.termContext.textContent = '';
      dom.termContext.classList.remove('tablet');
      dom.btnAction.classList.add('hidden');
      return;
    }
    const target = findInteractable();
    rt.activePrompt = target;
    const label = promptFor(target);
    if (!label) {
      rt.promptLabel = '';
      dom.termContext.textContent = '';
      dom.termContext.classList.remove('tablet');
      dom.btnAction.classList.add('hidden');
      return;
    }
    if (label !== rt.promptLabel) {
      rt.promptLabel = label;
      dom.btnAction.setAttribute('aria-label', label);
      dom.btnAction.textContent = '✦';
    }
    /* Вся текстовая информация о мире живёт в терминале: счётчик шагов
       доступен командой «шаги», а здесь остаётся только действие. */
    dom.termContext.textContent = `${t('рядом', 'nearby', 'in der Nähe')}: ${label} · E`;
    dom.termContext.classList.toggle('tablet', target.type === 'tablet');
    dom.btnAction.classList.remove('hidden');
  }

  function toggleDoor(door) {
    const current = doorState(door);
    const next = current === 'open' ? 'closed' : (current === 'closed' ? 'locked' : 'open');
    rt.state.flags[door.flag] = next;
    const message = next === 'closed'
      ? t('Дверь некрополя закрыта.', 'The necropolis door is closed.', 'Die Tür zum Nekropolf ist geschlossen.')
      : next === 'locked'
        ? t('Замок щёлкает. Дверь некрополя заперта.', 'The lock clicks. The necropolis door is locked.', 'Das Schloss schnappt. Die Tür zum Nekropolf ist verschlossen.')
        : t('Замок открыт. Дверь некрополя снова проходима.', 'The lock opens. The necropolis door is passable again.', 'Das Schloss ist offen. Die Tür zum Nekropolf ist wieder passierbar.');
    ZQ.appendLog(message, 'sys', true);
    ZQ.logEvent('actions', `дверь ${door.id}: ${next}`, 'дверь');
    ZQ.saveGame();
    updatePrompt();
  }

  function interact(force) {
    if ((!force && ZQ.isPaused()) || ZQ.isTyping()) return;
    const target = findInteractable();
    if (!target) return;
    ZQ.logEvent('actions', `действие: ${promptFor(target)}`, 'действие');
    if (target.type === 'item') {
      collectItemPickup(target.pickup);
    } else if (target.type === 'backpack') {
      retrieveBackpack(target.backpack);
    } else if (target.type === 'tablet') {
      ZQ.queueStory('tablet', () => {
        ZQ.unlock('backpack');
        ZQ.unlock('table');
      }, true);
    } else if (target.type === 'door') {
      toggleDoor(target.door);
    } else if (target.type === 'card') {
      takeCard();
    } else if (target.type === 'trial') {
      ZQ.startTrial();
    } else if (target.type === 'arcade') {
      /* Сначала открываем инвентарь на узле автомата: оттуда кассету
         можно перетащить в гнездо, а щелчок по узлу открывает экран. */
      if (typeof ZQ.focusInventoryItem === 'function') {
        ZQ.focusInventoryItem('arcade_cabinet');
      } else if (typeof ZQ.openArcade === 'function') {
        ZQ.openArcade();
      }
    } else if (target.type === 'vishnya' || target.type === 'mirror') {
      if (typeof ZQ.mirrorInteract === 'function') ZQ.mirrorInteract(target);
    } else if (target.type === 'eared') {
      if (typeof ZQ.earedInteract === 'function') ZQ.earedInteract();
    }
  }

  function currentRoomDescription() {
    const room = currentRoom();
    if (!room) return 'Ты в переходе между комнатами. Здесь только камень и твоё дыхание.';
    let text;
    if (room.role === 'tablet') {
      text = 'Плоский камень теплее воздуха. Скрижаль не укрытие — просто место, где ты снова становишься собой.';
    } else if (room.role === 'hazard') {
      text = 'Слепой зал молчит. Ни теней, ни преследователей — только стены и твоя память о направлении.';
    } else if (room.role === 'low') {
      text = 'Низкий свод заставляет согнуться. Здесь легко потерять направление.';
    } else if (room.role === 'trial') {
      text = rt.state.flags.trialDone
        ? 'Круг молчит. Печати погасли, и в центре больше ничего нет.'
        : 'Круг проступает на полу. Он не объясняет правил.';
    } else if (room.role === 'storage') {
      text = 'Сухая бумага, пыль, чьи-то аккуратные полки. Здесь что-то оставили до тебя.';
    } else if (room.role === 'crossroad') {
      text = 'На стене четыре чёрточки: три длинные, одна короткая. Под ними — стёртая фраза.';
    } else if (room.role === 'beetle') {
      text = rt.state.flags.beetleDone
        ? 'Арена опустела. Хитиновый панцирь больше не поднимается, и только царапины на камне помнят бой.'
        : 'Низкий свод арены. В центре ждёт хитиновая фигура — человек-жук. Он не говорит, но уже примеряет твой вес.';
    } else if (room.role === 'umbrella') {
      text = rt.state.flags.umbrellaDone
        ? 'Зал притих. На камне лежит сложенный зонт, и воздух больше не свистит от снарядов.'
        : 'Зал кажется пустым. Под потолком медленно раскрывается огромный зонт, и спицы уже дрожат перед залпом.';
    } else if (room.role === 'mirror') {
      text = typeof ZQ.mirrorRoomDescription === 'function'
        ? ZQ.mirrorRoomDescription()
        : 'Три высоких зеркала стоят у стены. В каждом — ты, но ни в одном ты не один.';
    } else if (room.role === 'eared') {
      text = typeof ZQ.earedRoomDescription === 'function'
        ? ZQ.earedRoomDescription()
        : 'На подушках сидит кто-то ушастый и мордастый. Лицо спрятано под шарфом, а на столе ждут бутерброды.';
    } else if (room.role === 'necropolis') {
      text = t(
        'Каменные гробницы стоят ровными рядами. Сюжета здесь пока нет — только тишина, пыль и чьи-то сапоги.',
        'Stone tombs stand in even rows. There is no story here yet — only silence, dust and someone’s boots.',
        'Steinene Grabstätten stehen in ordentlichen Reihen. Eine Geschichte gibt es hier noch nicht — nur Stille, Staub und jemandes Stiefel.'
      );
    } else if (room.faunaKind && C.fauna[room.faunaKind]) {
      text = C.fauna[room.faunaKind].lines.join(' ');
    } else {
      const index = window.World.hashString(`${rt.state.seed}:look:${room.id}`) % C.ambientRoomLines.length;
      text = C.ambientRoomLines[index];
    }

    const details = [];
    if (room.links && room.links.length) details.push(`выходов: ${room.links.length}`);
    const hasPickup = rt.world.itemPickups.some((p) =>
      !rt.state.flags[`taken_${p.itemId}`] && p.roomId === room.id
    );
    if (hasPickup) details.push('рядом что-то лежит');
    const hasBackpack = rt.state.backpacks.some((bp) => bp.roomId === room.id);
    if (hasBackpack) details.push('здесь оставлен рюкзак');
    if (room.arcade) details.push('здесь стоит аркадный автомат');
    if (details.length) text += ` (${details.join('; ')}).`;
    return text;
  }

  function inventorySummary() {
    const used = ZQ.inventoryUsed();
    const capacity = ZQ.inventoryCapacity();
    if (!rt.state.items.length) {
      return `Инвентарь пуст. Ячеек: 0 из ${capacity}.`;
    }
    const names = rt.state.items.map((id) => (C.items[id] ? C.items[id].name : id));
    return `Инвентарь: ${names.join(', ')}. Занято ${used} из ${capacity} ячеек.`;
  }

  function mapMark() {
    if (!rt.state.items.includes('chalk')) {
      return 'У тебя нет угольного мелка. Метку не поставить.';
    }
    const room = currentRoom();
    if (!room) return 'Здесь не на что поставить метку.';
    if (rt.state.mapMarks.includes(room.id)) return `Комната «${room.name}» уже отмечена.`;
    rt.state.mapMarks.push(room.id);
    ZQ.saveGame();
    ZQ.appendLog(`Метка: ${room.name}`, 'sys', true);
    ZQ.logEvent('actions', `поставил метку: «${room.name}»`, 'карта');
    return `Метка поставлена: «${room.name}».`;
  }

  function nudgePlayer(dx, dy, directionNameText) {
    const distance = 0.86;
    const nx = rt.state.player.x + dx * distance;
    const ny = rt.state.player.y + dy * distance;
    if (!canStandAt(nx, ny)) return `Дальше стена. В ${directionNameText} не пройти.`;
    rt.state.player.x = nx;
    rt.state.player.y = ny;
    rt.state.player.facingX = dx;
    rt.state.player.facingY = dy;
    rt.state.player.moving = false;
    rt.state.animTime += 0.18;
    trackStep();
    ZQ.logEvent('movement', `шаг ${directionNameText}`, 'шаг');
    updateRoomDetection();
    updatePrompt();
    return `Шаг ${directionNameText}. Камень отзывается глухо.`;
  }

  ZQ.canStandAt = canStandAt;
  ZQ.canStandWalls = canStandWalls;
  ZQ.arcadeCenter = arcadeCenter;
  ZQ.arcadeBlockedAt = arcadeBlockedAt;
  ZQ.arcadePush = arcadePush;
  ZQ.roomUnderPlayer = roomUnderPlayer;
  ZQ.currentRoom = currentRoom;
  ZQ.roomIdForPosition = roomIdForPosition;
  ZQ.snapCamera = snapCamera;
  ZQ.respawnAtTablet = respawnAtTablet;
  ZQ.resetStepTracker = resetStepTracker;
  ZQ.updateMovement = updateMovement;
  ZQ.updateCamera = updateCamera;
  ZQ.enterRoom = enterRoom;
  ZQ.updateRoomDetection = updateRoomDetection;
  ZQ.updateRoam = updateRoam;
  ZQ.roamBelzebufos = () => ensureRoam().belzebufos;
  ZQ.belzebufoBlockedAt = belzebufoBlockedAt;
  ZQ.restoreRoamFrog = restoreRoamFrog;
  ZQ.die = die;
  ZQ.deathFxDuration = DEATH_FX_DURATION;
  ZQ.isDeathAnimating = () => Boolean(rt.deathFx && rt.deathFx.active);
  ZQ.updateDeathFx = updateDeathFx;
  ZQ.finishDeath = finishDeath;
  ZQ.doorState = doorState;
  ZQ.doorBlockedAt = doorBlockedAt;
  ZQ.toggleDoor = toggleDoor;
  ZQ.collectItemPickup = collectItemPickup;
  ZQ.takeCard = takeCard;
  ZQ.retrieveBackpack = retrieveBackpack;
  ZQ.findInteractable = findInteractable;
  ZQ.promptFor = promptFor;
  ZQ.updatePrompt = updatePrompt;
  ZQ.interact = interact;
  ZQ.currentRoomDescription = currentRoomDescription;
  ZQ.inventorySummary = inventorySummary;
  ZQ.mapMark = mapMark;
  ZQ.nudgePlayer = nudgePlayer;
  ZQ.startTimedMove = startTimedMove;
  ZQ.stopMovement = stopMovement;
  ZQ.setCursorDestination = setCursorDestination;
  ZQ.cursorModes = cursorModes;
  ZQ.cursorMode = cursorMode;
  ZQ.cursorModeMeta = cursorModeMeta;
  ZQ.setCursorMode = setCursorMode;
  ZQ.cycleCursorMode = cycleCursorMode;
  ZQ.cursorModeCommand = cursorModeCommand;
  ZQ.tileDescription = tileDescription;
  ZQ.applyCursorClick = applyCursorClick;

  function takeUmbrellaNearby() {
    if (!rt.state || !rt.world) return 'Мир ещё не создан.';
    let best = null;
    let bestDistance = Infinity;
    for (const pickup of rt.world.itemPickups) {
      if (pickup.itemId !== 'umbrella') continue;
      if (rt.state.flags[`taken_${pickup.itemId}`]) continue;
      const distance = Math.hypot(
        rt.state.player.x - pickup.x,
        rt.state.player.y - pickup.y
      );
      if (distance < bestDistance) {
        bestDistance = distance;
        best = pickup;
      }
    }
    if (!best || bestDistance > 2.4) {
      return 'Рядом нет зонта. Он лежит там, где закончился зал с зонтиком.';
    }
    if (collectItemPickup(best)) {
      return 'Зонт в инвентаре. В бою он раскрывается по F или командой «зонт».';
    }
    return 'Зонт пока не помещается в инвентарь.';
  }

  ZQ.takeUmbrellaNearby = takeUmbrellaNearby;
})();
