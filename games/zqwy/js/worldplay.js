/* Мир: движение Zemic, комнаты, предметы и взаимодействия. */
(function () {
  'use strict';

  const ZQ = window.ZQ;
  const C = ZQ.C;
  const rt = ZQ.rt;
  const dom = ZQ.dom;

  function canStandAt(x, y) {
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
    /* Живые существа (диметродоны) не пропускают сквозь себя, но их
       можно подталкивать: если моб мешает, он мягко уходит в сторону
       движения, и дорога открывается. Если за ним стена — герой
       упирается. Если моб уже накрыл аксолотля, даём выйти. */
    const mobStuck = typeof ZQ.faunaBlockedAt === 'function' &&
      ZQ.faunaBlockedAt(rt.state.player.x, rt.state.player.y, C.player.radius);
    const freeOfMobs = (x, y) => mobStuck ||
      typeof ZQ.faunaBlockedAt !== 'function' ||
      !ZQ.faunaBlockedAt(x, y, C.player.radius);
    const tryAxis = (targetX, targetY, pushX, pushY) => {
      if (!canStandAt(targetX, targetY)) return false;
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
    if (ZQ.audio && !sceneLocked) ZQ.audio.setCue(room.music);

    if (firstVisit) {
      ZQ.saveGame();
      ZQ.appendLog(`— ${room.name} —`, 'sys', true);
      ZQ.logEvent('actions', `вошёл в комнату «${room.name}»`, 'комната');
    }

    /* Пока схватка или погоня не закончилась, новых врагов не ищем:
       ни вода, ни жаба, ни змея не начинаются поверх текущего боя.
       Иначе длинная схватка превращается в цепочку врагов. */
    if ((rt.battle && rt.battle.active) || (rt.chase && rt.chase.active)) return;

    /* Вода приходит без разрешения: комната сама запускает выживание,
       как только Zemic оказывается внутри. */
    const survivalKind = room.role === 'beetle' || room.role === 'umbrella'
      ? room.role
      : null;
    if (survivalKind) {
      const flag = `${survivalKind}Done`;
      if (!rt.state.flags[flag] && rt.survivalBlockedRoom !== room.id) {
        ZQ.startBattle(survivalKind);
        return;
      }
    }

    /* Бельзебуфо — повторяемая встреча. Шанс детерминирован для
       комнаты: один и тот же зал либо предлагает жабу, либо нет.
       После успеха в этой комнате она больше не появляется. */
    if (room.faunaKind === 'belzebufo' && !rt.state.flags[`belzebufo_${room.id}`] &&
        rt.survivalBlockedRoom !== room.id) {
      const chance = C.fauna && C.fauna.belzebufo &&
        Number.isFinite(C.fauna.belzebufo.chance)
        ? C.fauna.belzebufo.chance
        : 0.62;
      const roll = window.World.hashString(`${rt.state.seed}:belzebufo:${room.id}`) /
        4294967296;
      if (roll < chance) {
        ZQ.startBattle('belzebufo');
        return;
      }
    }

    /* Титанобоа ровно одна на мир. Погоня начинается при входе, пока
       змея не успокоилась. */
    if (room.faunaKind === 'titanoboa' && !rt.state.flags.titanoboaCalm && !rt.chase &&
        typeof ZQ.startChase === 'function') {
      ZQ.startChase(room);
      return;
    }

    if (!firstVisit) return;

    if (room.role === 'trial') {
      ZQ.queueStory('trial', () => {
        if (!rt.state.flags.trialDone && !rt.trial) {
          rt.state.flags.trialAttempted = true;
          ZQ.startTrial();
        }
      });
      return;
    }

    if (C.story[room.role]) {
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

    if (room.storyIndex !== null && room.storyIndex !== undefined &&
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
  }

  function die(cause) {
    if (!rt.state) return;
    const roomId = roomIdForPosition();
    const backpack = {
      id: ZQ.makeId('bp'),
      x: rt.state.player.x,
      y: rt.state.player.y,
      roomId,
      items: rt.state.items.slice(),
      cause,
      createdAt: Date.now()
    };
    rt.state.backpacks.push(backpack);
    rt.state.items = [];
    rt.state.deaths = (rt.state.deaths || 0) + 1;
    respawnAtTablet();
    rt.invulnUntil = ZQ.now() + 2600;

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

    function consider(target, distance) {
      if (distance < bestDistance && distance <= 1.22) {
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
    if (target.type === 'card') return 'взять карту';
    if (target.type === 'trial') return 'войти в круг';
    return '';
  }

  function updatePrompt() {
    if (ZQ.isPaused() || ZQ.isTyping()) {
      rt.activePrompt = null;
      rt.promptLabel = '';
      dom.termContext.textContent = '';
      dom.termContext.classList.remove('tablet');
      dom.btnAction.classList.add('hidden');
      return;
    }
    const modeMeta = typeof cursorModeMeta === 'function' ? cursorModeMeta(cursorMode()) : null;
    const modeHint = modeMeta ? `курсор: ${modeMeta.title} · ПКМ` : '';
    const target = findInteractable();
    rt.activePrompt = target;
    const label = promptFor(target);
    if (!label) {
      rt.promptLabel = '';
      dom.termContext.textContent = modeHint;
      dom.termContext.classList.remove('tablet');
      dom.btnAction.classList.add('hidden');
      return;
    }
    if (label !== rt.promptLabel) {
      rt.promptLabel = label;
      dom.btnAction.setAttribute('aria-label', label);
      dom.btnAction.textContent = '✦';
    }
    dom.termContext.textContent = modeHint
      ? `рядом: ${label} · E · ${modeHint}`
      : `рядом: ${label} · E`;
    dom.termContext.classList.toggle('tablet', target.type === 'tablet');
    dom.btnAction.classList.remove('hidden');
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
    } else if (target.type === 'card') {
      takeCard();
    } else if (target.type === 'trial') {
      ZQ.startTrial();
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
    ZQ.logEvent('movement', `шаг ${directionNameText}`, 'шаг');
    updateRoomDetection();
    updatePrompt();
    return `Шаг ${directionNameText}. Камень отзывается глухо.`;
  }

  ZQ.canStandAt = canStandAt;
  ZQ.roomUnderPlayer = roomUnderPlayer;
  ZQ.currentRoom = currentRoom;
  ZQ.roomIdForPosition = roomIdForPosition;
  ZQ.snapCamera = snapCamera;
  ZQ.respawnAtTablet = respawnAtTablet;
  ZQ.updateMovement = updateMovement;
  ZQ.updateCamera = updateCamera;
  ZQ.enterRoom = enterRoom;
  ZQ.updateRoomDetection = updateRoomDetection;
  ZQ.die = die;
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
