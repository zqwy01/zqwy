/* Побег от титанобоа идёт прямо в Лабиринте. Змея не побеждается —
   она ползёт по настоящим клеткам мира, повторяет тело за головой,
   пропихивается сквозь узкие проходы и пытается замкнуть кольцо.
   Игрок — аксолотль: бежит, ускоряется рывком и тратит дыхание. */
(function () {
  'use strict';

  const ZQ = window.ZQ;
  const C = ZQ.C;
  const rt = ZQ.rt;
  const dom = ZQ.dom;

  const DIRS = [
    { x: 0, y: -1 },
    { x: 1, y: 0 },
    { x: 0, y: 1 },
    { x: -1, y: 0 }
  ];

  function config() {
    return Object.assign({
      duration: 44,
      bodyLength: 26,
      playerSpeed: 4.8,
      dashSpeed: 12.5,
      dashDuration: 0.24,
      dashCooldown: 0.34,
      staminaDrain: 0.26,
      staminaRegen: 0.24,
      baseSpeed: 3.0,
      maxSpeed: 5.6,
      squeezeSpeed: 4.4,
      squeezeChance: 0.16,
      bodyGrowth: 30,
      maxBodyCells: 70,
      spreadHalfWidth: 3
    }, C.chase || {});
  }

  function lang() {
    return window.ZQI18N && window.ZQI18N.lang ? window.ZQI18N.lang : 'ru';
  }

  function t(ru, en, de) {
    const code = lang();
    if (code === 'de') return de || en || ru;
    return code === 'en' ? (en || ru) : ru;
  }

  /* Длительность трека погони: справочное значение из конфига, затем
     живые метаданные плеера. Нужна, чтобы победа наступала ровно в
     конце записи. */
  function trackSeconds(cue) {
    const meta = C.musicCues && C.musicCues[cue];
    const trackId = meta && meta.track ? meta.track : null;
    const track = trackId && C.music && C.music.tracks ? C.music.tracks[trackId] : null;
    if (track && Number.isFinite(track.duration) && track.duration > 0) {
      return track.duration;
    }
    const state = ZQ.audio && typeof ZQ.audio.state === 'function' ? ZQ.audio.state() : null;
    if (state && Number.isFinite(state.rawDuration) && state.rawDuration > 0) {
      return state.rawDuration;
    }
    return null;
  }

  function audioState() {
    return ZQ.audio && typeof ZQ.audio.state === 'function' ? ZQ.audio.state() : null;
  }

  function keyOf(x, y) {
    return `${x},${y}`;
  }

  function playerTile() {
    return {
      x: Math.floor(rt.state.player.x),
      y: Math.floor(rt.state.player.y)
    };
  }

  function world() {
    return rt.world;
  }

  function walkable(x, y) {
    return Boolean(world() && world().isWalkable(x, y));
  }

  /* -------------------------- Поиск пути --------------------------- */
  /* BFS ограничен по глубине и числу узлов: змея не должна
     просчитывать весь бесконечный мир на каждом шаге. Лимиты берутся
     из конфига погони, поэтому змея видит весь зал и выбирает
     действительно короткий маршрут, а не идёт вдоль стены. */
  function bfsPath(start, goal, blocked, limits) {
    const depthLimit = limits && Number.isFinite(limits.depth) ? limits.depth : 46;
    const nodeLimit = limits && Number.isFinite(limits.nodes) ? limits.nodes : 6500;
    const parents = new Map();
    const depths = new Map();
    const queue = [start];
    const startKey = keyOf(start.x, start.y);
    parents.set(startKey, null);
    depths.set(startKey, 0);
    let head = 0;
    let found = null;

    while (head < queue.length && parents.size < nodeLimit) {
      const cur = queue[head];
      head += 1;
      if (cur.x === goal.x && cur.y === goal.y) {
        found = cur;
        break;
      }
      const curKey = keyOf(cur.x, cur.y);
      const depth = depths.get(curKey) || 0;
      if (depth >= depthLimit) continue;
      for (const dir of DIRS) {
        const nx = cur.x + dir.x;
        const ny = cur.y + dir.y;
        const key = keyOf(nx, ny);
        if (parents.has(key)) continue;
        if (!walkable(nx, ny)) continue;
        const isGoal = nx === goal.x && ny === goal.y;
        if (!isGoal && blocked && blocked.has(key)) continue;
        parents.set(key, cur);
        depths.set(key, depth + 1);
        queue.push({ x: nx, y: ny });
      }
    }

    if (!found) return null;
    const path = [];
    let node = found;
    while (node) {
      path.push(node);
      node = parents.get(keyOf(node.x, node.y));
    }
    path.reverse();
    return path;
  }

  /* Поле расстояний от цели по проходимым клеткам. Нужно, чтобы шаг
     змеи лежал на кратчайшем маршруте: сосед с меньшим расстоянием до
     аксолотля всегда ближе к нему. */
  function distanceField(goal, blocked, limits) {
    const depthLimit = limits && Number.isFinite(limits.depth) ? limits.depth : 46;
    const nodeLimit = limits && Number.isFinite(limits.nodes) ? limits.nodes : 6500;
    const distances = new Map();
    const queue = [goal];
    distances.set(keyOf(goal.x, goal.y), 0);
    let head = 0;
    while (head < queue.length && distances.size < nodeLimit) {
      const cur = queue[head];
      head += 1;
      const curKey = keyOf(cur.x, cur.y);
      const depth = distances.get(curKey) || 0;
      if (depth >= depthLimit) continue;
      for (const dir of DIRS) {
        const nx = cur.x + dir.x;
        const ny = cur.y + dir.y;
        const key = keyOf(nx, ny);
        if (distances.has(key)) continue;
        if (!walkable(nx, ny)) continue;
        if (blocked && blocked.has(key)) continue;
        distances.set(key, depth + 1);
        queue.push({ x: nx, y: ny });
      }
    }
    return distances;
  }

  function nextStep(start, goal, blocked, limits) {
    /* Поле расстояний от цели: каждый узел знает, сколько шагов до
       аксолотля. Шаг выбирается среди соседей, лежащих на кратчайшем
       маршруте, а из равных по длине — тот, что закрывает большую ось
       разрыва. Так змея идёт на игрока по прямой, а не параллельно ему. */
    const field = distanceField(goal, blocked, limits);
    const startKey = keyOf(start.x, start.y);
    const startDist = field.get(startKey);
    if (!Number.isFinite(startDist)) {
      const path = bfsPath(start, goal, blocked, limits);
      if (!path || !path.length) return null;
      return path[1] || path[0];
    }
    const gapX = Math.abs(goal.x - start.x);
    const gapY = Math.abs(goal.y - start.y);
    const preferX = gapX > gapY;
    let best = null;
    let bestDist = Infinity;
    let bestPenalty = Infinity;
    for (const dir of DIRS) {
      const nx = start.x + dir.x;
      const ny = start.y + dir.y;
      const key = keyOf(nx, ny);
      const distance = field.get(key);
      if (!Number.isFinite(distance)) continue;
      const isGoal = nx === goal.x && ny === goal.y;
      if (blocked && blocked.has(key) && !isGoal) continue;
      const align = preferX ? Math.abs(dir.x) : Math.abs(dir.y);
      const penalty = align > 0 ? 0 : 1;
      if (distance < bestDist || (distance === bestDist && penalty < bestPenalty)) {
        bestDist = distance;
        bestPenalty = penalty;
        best = { x: nx, y: ny };
      }
    }
    if (best) return best;
    const path = bfsPath(start, goal, blocked, limits);
    return path ? (path[1] || path[0]) : null;
  }

  /* Лимиты поиска пути из конфига погони. */
  function limitsFor(cfg) {
    return {
      depth: cfg && Number.isFinite(cfg.pathDepth) ? cfg.pathDepth : 120,
      nodes: cfg && Number.isFinite(cfg.pathNodes) ? cfg.pathNodes : 20000
    };
  }

  function greedyStep(start, goal, blocked) {
    const gapX = Math.abs(goal.x - start.x);
    const gapY = Math.abs(goal.y - start.y);
    const preferX = gapX > gapY;
    let best = null;
    let bestDistance = Infinity;
    let bestPenalty = Infinity;
    for (const dir of DIRS) {
      const nx = start.x + dir.x;
      const ny = start.y + dir.y;
      const key = keyOf(nx, ny);
      if (!walkable(nx, ny)) continue;
      if (blocked && blocked.has(key)) continue;
      const distance = Math.abs(nx - goal.x) + Math.abs(ny - goal.y);
      const align = preferX ? Math.abs(dir.x) : Math.abs(dir.y);
      const penalty = align > 0 ? 0 : 1;
      if (distance < bestDistance || (distance === bestDistance && penalty < bestPenalty)) {
        bestDistance = distance;
        bestPenalty = penalty;
        best = { x: nx, y: ny };
      }
    }
    return best;
  }

  function squeezeStep(chase, start, goal) {
    const neck = chase.body[1];
    const dx = goal.x - start.x;
    const dy = goal.y - start.y;
    const options = Math.abs(dx) >= Math.abs(dy)
      ? [{ x: Math.sign(dx) || 1, y: 0 }, { x: 0, y: Math.sign(dy) || 1 }]
      : [{ x: 0, y: Math.sign(dy) || 1 }, { x: Math.sign(dx) || 1, y: 0 }];
    for (const dir of options) {
      if (!dir.x && !dir.y) continue;
      const nx = start.x + dir.x;
      const ny = start.y + dir.y;
      if (neck && nx === neck.x && ny === neck.y) continue;
      return { x: nx, y: ny };
    }
    return null;
  }

  /* Самый дальний проходимый узел: для безопасного места и для
     начального длинного тела. */
  function farthestNode(start, maxDepth, maxNodes) {
    const depthLimit = Number.isFinite(maxDepth) ? maxDepth : 120;
    const nodeLimit = Number.isFinite(maxNodes) ? maxNodes : 20000;
    const queue = [start];
    const seen = new Map();
    seen.set(keyOf(start.x, start.y), 0);
    let head = 0;
    let best = start;
    let bestDepth = 0;
    while (head < queue.length && seen.size < nodeLimit) {
      const cur = queue[head];
      head += 1;
      const curKey = keyOf(cur.x, cur.y);
      const depth = seen.get(curKey) || 0;
      if (depth > bestDepth) {
        bestDepth = depth;
        best = cur;
      }
      if (depth >= depthLimit) continue;
      for (const dir of DIRS) {
        const nx = cur.x + dir.x;
        const ny = cur.y + dir.y;
        const key = keyOf(nx, ny);
        if (seen.has(key)) continue;
        if (!walkable(nx, ny)) continue;
        seen.set(key, depth + 1);
        queue.push({ x: nx, y: ny });
      }
    }
    return { node: best, depth: bestDepth };
  }

  function ringCandidates(cx, cy, minRadius, maxRadius) {
    const list = [];
    for (let radius = minRadius; radius <= maxRadius; radius += 1) {
      for (let dx = -radius; dx <= radius; dx += 1) {
        for (let dy = -radius; dy <= radius; dy += 1) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== radius) continue;
          list.push({ x: cx + dx, y: cy + dy, radius });
        }
      }
    }
    return list;
  }

  function apex(chase, head, length) {
    const cfg = (chase && chase.config) || config();
    const far = farthestNode(head, cfg.pathDepth, cfg.pathNodes);
    /* Путь до дальней точки может быть длиннее обычного лимита BFS:
       для начального тела поднимаем глубину ровно под найденный узел. */
    const path = far.depth > 0
      ? bfsPath(head, far.node, null, { depth: far.depth + 2, nodes: cfg.pathNodes })
      : null;
    if (!path || path.length < 2) return [{ x: head.x, y: head.y }];
    const body = path.slice(0, Math.max(2, length));
    /* Если коридор короче тела, змея всё равно должна быть длинной:
       добавляем клетки назад по уже найденному пути. */
    while (body.length < length && body.length > 1) {
      const last = body[body.length - 1];
      body.push({ x: last.x, y: last.y });
      if (body.length > 300) break;
    }
    return body;
  }

  /* Копия тела перед шагом: нужна для плавной отрисовки, чтобы змея
     ползла векторно, а не прыгала по клеткам. */
  function syncPrevBody(chase) {
    chase.prevBody = chase.body.map((cell) => ({ x: cell.x, y: cell.y }));
  }

  function placeSnakeNear(chase, cx, cy, distance) {
    const minRadius = Number.isFinite(distance) ? distance : 7;
    const candidates = ringCandidates(cx, cy, minRadius, minRadius + 8)
      .filter((cell) => walkable(cell.x, cell.y));
    let head = null;
    if (candidates.length) {
      const pick = candidates[Math.floor(Math.random() * candidates.length)];
      head = { x: pick.x, y: pick.y };
    } else {
      head = { x: cx, y: cy };
    }
    chase.body = apex(chase, head, chase.bodyCells);
    chase.squeezing = false;
    chase.squeezeTimer = 0;
    chase.stepTimer = 0;
    computeMass(chase);
    syncPrevBody(chase);
  }

  /* Точка в дальней от аксолотля части зала. Змея уже лежит там,
     когда игрок входит: она не материализуется у него под ногами, а
     поднимается с другого конца комнаты. */
  function roomSpawnTile(room) {
    if (!room || !Number.isFinite(room.x1)) return null;
    const player = playerTile();
    let best = null;
    let bestDistance = -1;
    for (let y = room.y1; y <= room.y2; y += 1) {
      for (let x = room.x1; x <= room.x2; x += 1) {
        if (!walkable(x, y)) continue;
        const distance = Math.hypot(x + 0.5 - player.x, y + 0.5 - player.y);
        if (distance > bestDistance) {
          bestDistance = distance;
          best = { x, y };
        }
      }
    }
    return best;
  }

  function placeSnakeInRoom(chase, room) {
    const spot = roomSpawnTile(room);
    if (!spot) {
      const fallback = playerTile();
      placeSnakeNear(chase, fallback.x, fallback.y, 7);
      return;
    }
    chase.body = apex(chase, spot, chase.bodyCells);
    chase.squeezing = false;
    chase.squeezeTimer = 0;
    chase.stepTimer = 0;
    computeMass(chase);
    syncPrevBody(chase);
  }

  function safeSpot(chase) {
    const head = chase.body[0] || playerTile();
    const far = farthestNode(head, 44, 8500);
    if (far.depth >= 8 && ZQ.canStandAt(far.node.x + 0.5, far.node.y + 0.5)) {
      return far.node;
    }
    const player = playerTile();
    const candidates = ringCandidates(player.x, player.y, 9, 20)
      .filter((cell) => walkable(cell.x, cell.y));
    if (candidates.length) {
      return candidates[Math.floor(Math.random() * candidates.length)];
    }
    return player;
  }

  /* Насколько голова змеи далека от аксолотля. */
  function headDistance(chase) {
    const head = chase.body[0];
    if (!head) return Infinity;
    const player = rt.state.player;
    return Math.hypot(player.x - (head.x + 0.5), player.y - (head.y + 0.5));
  }

  /* Проходимая клетка рядом с точкой. */
  function walkableNear(cx, cy, maxRadius) {
    if (walkable(cx, cy)) return { x: cx, y: cy };
    const limit = Number.isFinite(maxRadius) ? maxRadius : 12;
    for (let radius = 1; radius <= limit; radius += 1) {
      const candidates = ringCandidates(cx, cy, radius, radius)
        .filter((cell) => walkable(cell.x, cell.y));
      if (candidates.length) {
        return candidates[Math.floor(Math.random() * candidates.length)];
      }
    }
    return null;
  }

  /* Аксолотль сильно оторвался: змея уходит в следующий прогруженный
     чанк и встречает героя на его пути. Точка выхода держится на
     расстоянии: одно касание убивает, поэтому змея не должна возникать
     прямо под ногами. */
  function teleportSnakeAhead(chase, cfg) {
    const player = rt.state.player;
    let dx = Number.isFinite(player.facingX) ? player.facingX : 0;
    let dy = Number.isFinite(player.facingY) ? player.facingY : 0;
    if (!dx && !dy) {
      const head = chase.body[0];
      if (head) {
        dx = player.x - (head.x + 0.5);
        dy = player.y - (head.y + 0.5);
      }
    }
    const length = Math.hypot(dx, dy) || 1;
    dx /= length;
    dy /= length;
    const arrive = Number.isFinite(cfg.teleportArrive) ? cfg.teleportArrive : 9;
    const targetX = Math.floor(player.x + dx * arrive);
    const targetY = Math.floor(player.y + dy * arrive);
    const minGap = Math.max(5, arrive - 2);
    let spot = null;
    for (let radius = 0; radius <= 12 && !spot; radius += 1) {
      const candidates = ringCandidates(targetX, targetY, radius, radius)
        .filter((cell) => walkable(cell.x, cell.y))
        .filter((cell) => Math.hypot(
          cell.x + 0.5 - player.x,
          cell.y + 0.5 - player.y
        ) >= minGap);
      if (candidates.length) {
        spot = candidates[Math.floor(Math.random() * candidates.length)];
      }
    }
    if (!spot) {
      spot = walkableNear(targetX, targetY, 12) ||
        { x: Math.floor(player.x), y: Math.floor(player.y) };
    }
    chase.body = apex(chase, spot, chase.bodyCells);
    chase.squeezing = false;
    chase.squeezeTimer = 0;
    chase.stepTimer = 0;
    chase.teleportCooldown = Number.isFinite(cfg.teleportCooldown) ? cfg.teleportCooldown : 5;
    computeMass(chase);
    syncPrevBody(chase);
    ZQ.appendLog(t(
      'Пол вздрагивает впереди: титанобоа уже ждёт на твоём пути.',
      'The floor shudders ahead: the titanoboa is already waiting on your path.',
      'Der Boden bebt voraus: Die Titanoboa wartet schon auf deinem Weg.'
    ), 'sys', true);
  }

  /* ------------------------- Шаги змеи ----------------------------- */
  function stepSnake(chase) {
    if (!chase.active || !chase.body.length) return;
    const head = chase.body[0];
    const target = playerTile();
    if (head.x === target.x && head.y === target.y) return;

    const blocked = new Set();
    for (let i = 0; i < chase.body.length - 1; i += 1) {
      blocked.add(keyOf(chase.body[i].x, chase.body[i].y));
    }

    let next = nextStep(head, target, blocked, chase.config);
    let squeezed = false;
    if (!next) {
      next = greedyStep(head, target, blocked);
    }
    /* Если путь закрыт собственным телом или стеной, змея пропихивается
       сквозь узкое место. Так она не зависает в тупике и продолжает
       давить на аксолотля. */
    if (!next) {
      next = squeezeStep(chase, head, target);
      squeezed = Boolean(next);
    } else if (!walkable(next.x, next.y)) {
      squeezed = true;
    }

    if (!next) return;
    if (squeezed || Math.random() < (chase.config.squeezeChance || 0.05) * 0.12) {
      chase.squeezing = true;
      chase.squeezeTimer = Math.max(chase.squeezeTimer || 0, 0.7);
    }

    syncPrevBody(chase);
    chase.body.unshift({ x: next.x, y: next.y });
    while (chase.body.length > chase.bodyCells) chase.body.pop();
    computeMass(chase);
  }

  /* Тело расползается поперёк спины: к клеткам позвоночника
     добавляются перпендикулярные соседи, пока путь не упрётся в стену
     или не кончится halfWidth. Так титанобоа заполняет комнату или
     проход собственной массой. */
  function computeMass(chase) {
    const body = chase.body;
    const half = Number.isFinite(chase.halfWidth) ? chase.halfWidth : 0;
    const cells = [];
    const seen = new Set();
    const add = (x, y) => {
      const key = keyOf(x, y);
      if (seen.has(key)) return;
      seen.add(key);
      cells.push({ x, y });
    };
    for (let i = 0; i < body.length; i += 1) {
      const cell = body[i];
      const a = body[i - 1] || cell;
      const b = body[i + 1] || cell;
      let dx = a.x - b.x;
      let dy = a.y - b.y;
      if (!dx && !dy) { dx = 1; dy = 0; }
      /* На повороте касательная диагональна: берём доминирующую ось,
         иначе перпендикуляр режет угол и масса лезет в стену. */
      if (dx && dy) {
        if (Math.abs(dx) >= Math.abs(dy)) dy = 0;
        else dx = 0;
      }
      const len = Math.hypot(dx, dy) || 1;
      const px = -dy / len;
      const py = dx / len;
      add(cell.x, cell.y);
      for (const sign of [1, -1]) {
        for (let d = 1; d <= half; d += 1) {
          const tx = Math.round(cell.x + px * d * sign);
          const ty = Math.round(cell.y + py * d * sign);
          if (!walkable(tx, ty)) break;
          add(tx, ty);
        }
      }
    }
    chase.mass = cells;
  }

  function checkContact(chase) {
    if (chase.invuln > 0 || !chase.active) return;
    const player = rt.state.player;
    const head = chase.body[0];
    const cells = (chase.mass && chase.mass.length) ? chase.mass : chase.body;
    for (let i = 0; i < cells.length; i += 1) {
      const cell = cells[i];
      const isHead = Boolean(head && cell.x === head.x && cell.y === head.y);
      const radius = isHead ? 0.62 : 0.52;
      if (Math.hypot(player.x - (cell.x + 0.5), player.y - (cell.y + 0.5)) < radius) {
        catchPlayer(chase, isHead ? 'кольца титанобоа' : 'тело титанобоа');
        return;
      }
    }
  }

  /* Одно касание — смерть. Титанобоа не бьёт по частям: если кольца
     сомкнулись, погоня окончена. */
  function catchPlayer(chase, cause) {
    if (!chase.active) return;
    chase.hits += 1;
    finishChase('death', cause);
  }

  function finishChase(outcome, cause) {
    const chase = rt.chase;
    if (!chase) return;
    chase.active = false;
    ZQ.resetKeys();
    hideChaseHud();
    rt.chase = null;

    /* Возвращаем кассету комнаты: трек погони доиграл (или оборвался),
       и фоновая музыка зала снова зацикливается. */
    if (ZQ.audio && typeof ZQ.audio.endBattleTrack === 'function') {
      ZQ.audio.endBattleTrack(chase.roomCue || 'labyrinth');
    }

    if (outcome === 'calm') {
      rt.state.flags.titanoboaCalm = true;
      rt.state.flags.titanoboaAttempted = true;
      if (chase.roomId) rt.state.flags[`titanoboa_${chase.roomId}`] = true;
      ZQ.ensureTerminalShare(0.5);
      ZQ.setTerminalView('main');
      ZQ.appendLog(t(
        'Пол перестаёт вздрагивать. Титанобоа медленно опускает голову, и кольца расходятся, освобождая проход.',
        'The floor stops trembling. The titanoboa slowly lowers its head, and the coils part to free the way.',
        'Der Boden bebt nicht mehr. Die Titanoboa senkt langsam den Kopf, und die Ringe öffnen den Weg.'
      ), 'sys', true);
      const key = (C.chase && C.chase.calmDialogue) || 'titanoboaCalm';
      if (C.story && C.story[key]) {
        ZQ.queueStory(key, () => ZQ.updatePrompt(), true);
      }
      ZQ.logEvent('actions', 'титанобоа успокоилась', 'погоня');
      ZQ.saveGame();
      ZQ.updatePrompt();
      return;
    }

    if (outcome === 'death') {
      ZQ.ensureTerminalShare(0.46);
      ZQ.setTerminalView('main');
      ZQ.appendLog(t(
        'Кольца смыкаются мгновенно. Титанобоа не оставляет второго шанса.',
        'The coils close in an instant. The titanoboa leaves no second chance.',
        'Die Ringe schließen sich im Nu. Die Titanoboa lässt keine zweite Chance.'
      ), 'sys', true);
      ZQ.die(cause || t('титанобоа', 'the titanoboa', 'die Titanoboa'));
      return;
    }

    ZQ.ensureTerminalShare(0.46);
    ZQ.setTerminalView('main');
    ZQ.appendLog(t(
      'Ты опускаешься на камень. Титанобоа не убивает — она просто отпускает тебя назад, к Скрижали.',
      'You sink onto the stone. The titanoboa does not kill — it simply lets you go back to the Tablet.',
      'Du sinkst auf den Stein. Die Titanoboa tötet nicht — sie lässt dich zur Tafel zurück.'
    ), 'sys', true);
    ZQ.die(t('титанобоа: сдался', 'the titanoboa: gave up', 'die Titanoboa: aufgegeben'));
  }

  function chaseDash() {
    const chase = rt.chase;
    if (!chase || !chase.active) return false;
    if (typeof ZQ.hasDashAbility === 'function' && !ZQ.hasDashAbility()) {
      chase.hint = t(
        'Рывок ещё не открыт.',
        'Dash is not unlocked yet.',
        'Ausweichen ist noch nicht freigeschaltet.'
      );
      chase.hintUntil = chase.elapsed + 1.6;
      updateHud();
      return false;
    }
    if (chase.dashCooldown > 0 || chase.stamina < 0.18) {
      chase.hint = t('Дыхание сбито. Переведи дух.', 'Out of breath. Catch it.', 'Außer Atem. Hol Luft.');
      chase.hintUntil = chase.elapsed + 1.2;
      return false;
    }
    let dx = 0;
    let dy = 0;
    if (rt.keys.up || rt.gamepadKeys.up) dy -= 1;
    if (rt.keys.down || rt.gamepadKeys.down) dy += 1;
    if (rt.keys.left || rt.gamepadKeys.left) dx -= 1;
    if (rt.keys.right || rt.gamepadKeys.right) dx += 1;
    if (!dx && !dy) {
      dx = rt.state.player.facingX || 0;
      dy = rt.state.player.facingY || -1;
    }
    const length = Math.hypot(dx, dy) || 1;
    const dirX = dx / length;
    const dirY = dy / length;
    chase.dashVX = dirX;
    chase.dashVY = dirY;
    chase.dashTimer = chase.config.dashDuration || 0.24;
    chase.dashCooldown = chase.config.dashCooldown || 0.34;
    chase.dashSpeed = chase.config.dashSpeed || 12.5;
    chase.stamina = Math.max(0, chase.stamina - (chase.config.staminaDrain || 0.26));
    chase.dashFlash = 1;
    chase.invuln = Math.max(chase.invuln, 0.12);
    chase.player.facingX = dirX;
    chase.player.facingY = dirY;
    updateHud();
    return true;
  }

  /* --------------------------- HUD --------------------------------- */
  function updateHud() {
    const chase = rt.chase;
    if (!chase) return;
    const pressure = ZQ.clamp(chase.elapsed / Math.max(1, chase.duration), 0, 1);
    /* Вдохов больше нет: одно касание — смерть. Вместо них показываем,
       насколько доигран трек: победа приходит в его конце. */
    if (dom.chaseBreaths) {
      dom.chaseBreaths.textContent = `${Math.round(pressure * 100)}%`;
    }
    if (dom.chaseTime) {
      const meters = Math.max(0, Math.round(chase.distance * 2));
      dom.chaseTime.textContent = `${meters} м`;
    }
    if (dom.chaseStaminaBar) {
      dom.chaseStaminaBar.style.width = `${Math.round(chase.stamina * 100)}%`;
    }
    if (dom.chaseHint) {
      let hint;
      if (chase.hint && chase.elapsed < chase.hintUntil) {
        hint = chase.hint;
      } else if (chase.squeezing) {
        hint = t(
          'Она пропихивается сквозь камень. Не давай прижать себя к стене.',
          'It is squeezing through the stone. Do not let it pin you to a wall.',
          'Sie zwängt sich durch den Stein. Lass dich nicht an die Wand drängen.'
        );
      } else if (pressure < 0.18) {
        hint = t(
          'Уходи. Одно касание — и тебя нет. Shift — рывок.',
          'Run. One touch and you are gone. Shift to dash.',
          'Lauf. Eine Berührung — und du bist fort. Shift für den Sprint.'
        );
      } else if (pressure < 0.5) {
        hint = t(
          'Кольца ускоряются. Не давай прижать себя к стене.',
          'The coils are speeding up. Do not let them pin you to a wall.',
          'Die Ringe werden schneller. Lass dich nicht an die Wand drängen.'
        );
      } else if (pressure < 0.82) {
        hint = t(
          'Она пропихивается сквозь проходы. Держись до конца трека.',
          'It squeezes through the passages. Hold on until the track ends.',
          'Sie zwängt sich durch die Gänge. Halte bis zum Ende des Tracks durch.'
        );
      } else {
        hint = t(
          'Трек почти доигран. Ещё немного.',
          'The track is almost over. A little longer.',
          'Der Track ist fast vorbei. Nur noch ein wenig.'
        );
      }
      dom.chaseHint.textContent = hint;
    }
  }

  /* ------------------------- Запуск -------------------------------- */
  function showChaseHud() {
    if (dom.chaseStage) dom.chaseStage.classList.remove('hidden');
  }

  function hideChaseHud() {
    if (dom.chaseStage) dom.chaseStage.classList.add('hidden');
  }

  function startChase(room) {
    if (!rt.state || rt.chase) return false;
    if (rt.battle || rt.trial) return false;
    const cfg = config();
    const player = rt.state.player;
    const start = playerTile();
    const bodyCells = Math.max(10, Math.round(cfg.bodyLength));

    /* Победа — дослушать трек до конца. duration — запас на случай,
       если музыка выключена и запись не играет. */
    let duration = Number.isFinite(cfg.duration) ? cfg.duration : 44;
    if (cfg.durationMode === 'track' && cfg.trackCue) {
      const length = trackSeconds(cfg.trackCue);
      if (length) {
        const rate = ZQ.audio && typeof ZQ.audio.rateForCue === 'function'
          ? ZQ.audio.rateForCue(cfg.trackCue)
          : 1;
        duration = length / (rate > 0 ? rate : 1);
      }
    }
    if (Number.isFinite(cfg.durationCap)) duration = Math.min(duration, cfg.durationCap);

    const chase = {
      active: true,
      roomId: room ? room.id : null,
      roomCue: (room && room.music) || 'labyrinth',
      elapsed: 0,
      duration,
      durationMode: cfg.durationMode || 'time',
      durationCap: Number.isFinite(cfg.durationCap) ? cfg.durationCap : null,
      distance: 0,
      lastX: player.x,
      lastY: player.y,
      breaths: 1,
      hits: 0,
      invuln: 1.1,
      hint: '',
      hintUntil: 0,
      bodyCells,
      baseBodyCells: bodyCells,
      halfWidth: 0,
      spread: 0,
      widthPulse: 1,
      mass: [],
      body: [],
      trail: [],
      squeezeTimer: 0,
      squeezing: false,
      stepTimer: 0,
      interval: 0.3,
      prevBody: [],
      dashTimer: 0,
      dashCooldown: 0,
      dashVX: 0,
      dashVY: -1,
      dashSpeed: cfg.dashSpeed || 12.5,
      dashFlash: 0,
      stamina: 1,
      teleportCooldown: 0,
      /* Пробуждение: короткая пауза, пока змея ещё лежит в зале. */
      wakeTime: Number.isFinite(cfg.wakeTime) ? Math.max(0, cfg.wakeTime) : 1.8,
      wakeTimer: Number.isFinite(cfg.wakeTime) ? Math.max(0, cfg.wakeTime) : 1.8,
      woke: false,
      spawnRoomId: room ? room.id : null,
      config: cfg,
      player,
      playerSpeed: Number.isFinite(cfg.playerSpeed) ? cfg.playerSpeed : 4.8
    };

    /* В зале голова стоит в дальней от входа части комнаты. Без
       комнаты (например, при отладке) работает старый безопасный
       вариант — кольцо вокруг игрока. */
    if (room) placeSnakeInRoom(chase, room);
    else placeSnakeNear(chase, start.x, start.y, 7);
    chase.lastX = player.x;
    chase.lastY = player.y;

    showChaseHud();
    ZQ.ensureTerminalShare(0.4);
    ZQ.setTerminalView('main');
    ZQ.resetKeys();
    /* Погоня идёт под свой трек, и он должен доиграть до конца: без
       зацикливания, с начала. */
    if (cfg.trackCue && ZQ.audio) {
      if (typeof ZQ.audio.startBattleTrack === 'function') {
        ZQ.audio.startBattleTrack(cfg.trackCue);
      } else {
        ZQ.audio.setCue(cfg.trackCue);
      }
    }
    ZQ.appendLog(cfg.intro || t(
      'Пол вздрагивает. Титанобоа приходит в движение.',
      'The floor shudders. The titanoboa begins to move.',
      'Der Boden bebt. Die Titanoboa setzt sich in Bewegung.'
    ), 'story', true, cfg.introSpeaker || 'ТИТАНОБОА');
    ZQ.appendLog(t(
      'Это не бой. Одно касание — и тебя нет. Беги и слушай трек до конца. Shift или ПРОБЕЛ — рывок.',
      'This is not a fight. One touch and you are gone. Run and listen to the track to the end. Shift or SPACE to dash.',
      'Das ist kein Kampf. Eine Berührung — und du bist fort. Lauf und höre den Track bis zum Ende. Shift oder LEERTASTE für den Sprint.'
    ), 'sys', true);
    ZQ.logEvent('actions', 'погоня: титанобоа', 'погоня');
    ZQ.saveGame();
    rt.chase = chase;
    updateHud();
    return true;
  }

  /* Победа: трек доигран до конца. Если музыка выключена, работает
     запасное значение elapsed/duration. */
  function chaseComplete(chase) {
    if (chase.durationMode === 'track') {
      const state = audioState();
      /* Когда запись доходит до конца, el.ended гасит playing, поэтому
         проверяем сам факт «доиграно», а не только playing. */
      if (state && state.rawDuration > 0 &&
          state.rawCurrent >= state.rawDuration - 0.15) {
        return true;
      }
    }
    if (Number.isFinite(chase.durationCap) && chase.elapsed >= chase.durationCap) {
      return true;
    }
    return chase.elapsed >= chase.duration;
  }

  function updateChase(dt) {
    const chase = rt.chase;
    if (!chase || !chase.active) return;
    const cfg = chase.config;
    chase.elapsed += dt;
    chase.invuln = Math.max(0, chase.invuln - dt);
    chase.dashCooldown = Math.max(0, chase.dashCooldown - dt);
    chase.dashTimer = Math.max(0, chase.dashTimer - dt);
    chase.dashFlash = Math.max(0, chase.dashFlash - dt * 3);
    chase.squeezeTimer = Math.max(0, chase.squeezeTimer - dt);
    if (chase.squeezeTimer <= 0) chase.squeezing = false;
    chase.teleportCooldown = Math.max(0, (chase.teleportCooldown || 0) - dt);

    /* Первые мгновения змея ещё лежит в дальнем конце зала: игрок
       успевает увидеть её до того, как кольца придут в движение. */
    const wakeLeft = Number.isFinite(chase.wakeTimer) ? chase.wakeTimer : 0;
    if (wakeLeft > 0) {
      chase.wakeTimer = Math.max(0, wakeLeft - dt);
      if (rt.state && rt.state.player) {
        chase.lastX = rt.state.player.x;
        chase.lastY = rt.state.player.y;
      }
      chase.stepTimer = 0;
      if (chase.wakeTimer <= 0 && !chase.woke) {
        chase.woke = true;
        ZQ.appendLog(cfg.wakeLine || t(
          'Из дальнего конца зала поднимается голова. Титанобоа просыпается.',
          'A head rises at the far end of the hall. The titanoboa is awake.',
          'Am fernen Ende der Halle hebt sich ein Kopf. Die Titanoboa ist erwacht.'
        ), 'story', true, cfg.introSpeaker || 'ТИТАНОБОА');
      }
      updateHud();
      return;
    }

    const pressure = ZQ.clamp(chase.elapsed / Math.max(1, chase.duration), 0, 1);
    const regen = (cfg.staminaRegen || 0.24) - pressure * 0.1;
    chase.stamina = ZQ.clamp(chase.stamina + regen * dt, 0, 1);

    /* Чем дольше погоня, тем длиннее змея и тем шире она расползается
       поперёк прохода. Обе величины растут вместе с давлением. */
    const baseCells = Number.isFinite(chase.baseBodyCells)
      ? chase.baseBodyCells
      : chase.bodyCells;
    const growth = Number.isFinite(cfg.bodyGrowth) ? cfg.bodyGrowth : 0;
    const maxCells = Number.isFinite(cfg.maxBodyCells)
      ? Math.max(baseCells, cfg.maxBodyCells)
      : baseCells + growth;
    chase.bodyCells = Math.min(maxCells, Math.round(baseCells + growth * pressure));
    const maxHalf = Number.isFinite(cfg.spreadHalfWidth) ? cfg.spreadHalfWidth : 0;
    /* Тело не просто расползается: оно дышит — расширяется и сужается.
       widthPulse плавно меняет и число клеток массы, и радиус отрисовки. */
    chase.spread = maxHalf * pressure;
    const breathe = 0.5 + 0.5 * Math.sin(
      chase.elapsed * (Number.isFinite(cfg.breatheSpeed) ? cfg.breatheSpeed : 1.4)
    );
    chase.widthPulse = 0.82 + 0.36 * breathe;
    chase.halfWidth = chase.spread * chase.widthPulse;
    computeMass(chase);

    /* Дистанция считается по реальному смещению Zemic: бег по
       коридорам, а не по отдельной арене. */
    if (rt.state && rt.state.player) {
      const moved = Math.hypot(
        rt.state.player.x - chase.lastX,
        rt.state.player.y - chase.lastY
      );
      chase.distance += moved;
      chase.lastX = rt.state.player.x;
      chase.lastY = rt.state.player.y;
      if (chase.dashTimer > 0) {
        chase.trail.push({
          x: rt.state.player.x,
          y: rt.state.player.y,
          life: 0.3
        });
        if (chase.trail.length > 90) chase.trail.shift();
      }
    }
    for (const point of chase.trail) {
      point.life -= dt;
    }
    chase.trail = chase.trail.filter((point) => point.life > 0);

    /* Отрыв: чем дальше аксолотль, тем сильнее змея ускоряется к его
       полю зрения. При огромном отрыве она переносится в следующий
       прогруженный чанк навстречу герою. */
    const gap = headDistance(chase);
    const farDistance = Number.isFinite(cfg.farDistance) ? cfg.farDistance : 18;
    const teleportDistance = Number.isFinite(cfg.teleportDistance) ? cfg.teleportDistance : 34;
    let speedBoost = 1;
    if (gap > teleportDistance && chase.teleportCooldown <= 0) {
      teleportSnakeAhead(chase, cfg);
      if (!rt.chase || !rt.chase.active) return;
    } else if (gap > farDistance) {
      const k = ZQ.clamp((gap - farDistance) / Math.max(1, teleportDistance - farDistance), 0, 1);
      speedBoost = 1 + k * (Number.isFinite(cfg.farSpeedBoost) ? cfg.farSpeedBoost : 1.7);
    }

    /* Скорость змеи растёт к концу погони и при большом отрыве. */
    const snakeSpeed = (cfg.baseSpeed + (cfg.maxSpeed - cfg.baseSpeed) * pressure) * speedBoost;
    const interval = 1 / Math.max(0.45, chase.squeezing
      ? Math.min(cfg.squeezeSpeed || 4.4, snakeSpeed + 0.6)
      : snakeSpeed);
    chase.interval = interval;
    chase.stepTimer += dt;
    let guard = 0;
    while (chase.stepTimer >= interval && guard < 3) {
      chase.stepTimer -= interval;
      stepSnake(chase);
      guard += 1;
      checkContact(chase);
      if (!rt.chase || !rt.chase.active) return;
    }

    checkContact(chase);
    if (!rt.chase || !rt.chase.active) return;

    if (chaseComplete(chase)) {
      finishChase('calm');
      return;
    }
    updateHud();
  }

  /* ------------------------ Отрисовка ------------------------------ */
  /* Плавная отрисовка: тело ползёт векторно между клетками, а не
     прыгает по тайлам. stepTimer/interval даёт долю пути между двумя
     шагами, prevBody — прошлые клетки позвоночника. */
  function spineAt(chase, t) {
    const body = chase.body;
    const prev = (chase.prevBody && chase.prevBody.length) ? chase.prevBody : body;
    const out = new Array(body.length);
    for (let i = 0; i < body.length; i += 1) {
      const b = body[i];
      /* При росте тело длиннее прошлого: у новых хвостовых клеток нет
         пары, поэтому они просто остаются на месте — без рывка. */
      const a = prev[i] || b;
      out[i] = {
        x: a.x + (b.x - a.x) * t + 0.5,
        y: a.y + (b.y - a.y) * t + 0.5
      };
    }
    return out;
  }

  /* Масса для отрисовки считается по интерполированному позвоночнику,
     поэтому расползающееся тело тоже движется без рывков. Каждая клетка
     получает коэффициент ширины: у самой кромки он меньше, чтобы тело не
     вылезало за стену, а в узком месте масса сжимается в позвоночник. */
  function renderMass(spine, half) {
    const cells = [];
    if (!(half > 0)) return cells;
    const seen = new Set();
    const add = (x, y, w) => {
      const key = keyOf(Math.round(x), Math.round(y));
      if (seen.has(key)) return;
      seen.add(key);
      cells.push({ x, y, w });
    };
    for (let i = 0; i < spine.length; i += 1) {
      const cell = spine[i];
      const a = spine[i - 1] || cell;
      const b = spine[i + 1] || cell;
      let dx = a.x - b.x;
      let dy = a.y - b.y;
      if (!dx && !dy) { dx = 1; dy = 0; }
      if (dx && dy) {
        if (Math.abs(dx) >= Math.abs(dy)) dy = 0;
        else dx = 0;
      }
      const len = Math.hypot(dx, dy) || 1;
      const px = -dy / len;
      const py = dx / len;
      add(cell.x, cell.y, 1);
      for (const sign of [1, -1]) {
        for (let d = 1; d <= half; d += 1) {
          const tx = Math.round(cell.x + px * d * sign);
          const ty = Math.round(cell.y + py * d * sign);
          if (!walkable(tx, ty)) break;
          const w = 1 - 0.2 * (d / Math.max(1, half));
          add(cell.x + px * d * sign, cell.y + py * d * sign, w);
        }
      }
    }
    return cells;
  }

  function drawChaseWorld(ctx, params) {
    const chase = rt.chase;
    if (!chase || !chase.active || !chase.body.length) return;
    const ts = params.ts;
    const view = params.view;
    const sx = params.toScreenX;
    const sy = params.toScreenY;
    const t = chase.interval > 0
      ? ZQ.clamp(chase.stepTimer / chase.interval, 0, 1)
      : 1;
    const spine = spineAt(chase, t);

    /* След рывка. */
    for (const point of chase.trail) {
      const alpha = ZQ.clamp(point.life / 0.3, 0, 1) * 0.32;
      ctx.fillStyle = `rgba(255, 196, 170, ${alpha})`;
      ctx.beginPath();
      ctx.arc(sx(point.x), sy(point.y), ts * (0.12 + alpha * 0.3), 0, Math.PI * 2);
      ctx.fill();
    }

    if (chase.squeezing) {
      ctx.save();
      ctx.fillStyle = 'rgba(196, 168, 116, 0.16)';
      for (const cell of spine.slice(0, 6)) {
        ctx.beginPath();
        ctx.arc(sx(cell.x), sy(cell.y), ts * 0.7, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    /* Масса: расползшееся поперёк спины тело. Рисуется под спиной,
       поэтому змея выглядит толще и заполняет проход целиком. Радиус
       ограничен половиной клетки, поэтому тело не выходит за стену, а в
       узком проходе сжимается в позвоночник. */
    if (chase.halfWidth > 0) {
      const mass = renderMass(spine, chase.halfWidth);
      if (mass.length) {
        const pulse = Number.isFinite(chase.widthPulse) ? chase.widthPulse : 1;
        ctx.save();
        ctx.fillStyle = 'rgba(88, 84, 56, 0.92)';
        for (const cell of mass) {
          const cx = sx(cell.x);
          const cy = sy(cell.y);
          if (cx < -ts * 2 || cx > view.w + ts * 2 || cy < -ts * 2 || cy > view.h + ts * 2) continue;
          const scale = Math.min(0.5, 0.5 * (cell.w || 1) * pulse);
          ctx.beginPath();
          ctx.ellipse(cx, cy, ts * scale, ts * scale, 0, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }
    }

    /* Тень и тело. Хвост рисуется первым, голова — последней. */
    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.34)';
    for (let i = spine.length - 1; i >= 0; i -= 1) {
      const cell = spine[i];
      const cx = sx(cell.x) + ts * 0.12;
      const cy = sy(cell.y) + ts * 0.18;
      const ratio = i / Math.max(1, spine.length);
      const radius = (i === 0 ? ts * 0.52 : ts * 0.44) * (1 - ratio * 0.32);
      ctx.beginPath();
      ctx.ellipse(cx, cy, radius * 1.2, radius * 0.8, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    for (let i = spine.length - 1; i >= 0; i -= 1) {
      const cell = spine[i];
      const cx = sx(cell.x);
      const cy = sy(cell.y);
      if (cx < -ts * 2 || cx > view.w + ts * 2 || cy < -ts * 2 || cy > view.h + ts * 2) continue;
      const ratio = i / Math.max(1, spine.length);
      const radius = (i === 0 ? ts * 0.56 : ts * 0.47) * (1 - ratio * 0.3);
      const body = ctx.createRadialGradient(
        cx - radius * 0.35, cy - radius * 0.4, radius * 0.2,
        cx, cy, radius * 1.25
      );
      body.addColorStop(0, i % 2 === 0 ? '#a7a06a' : '#9a925f');
      body.addColorStop(0.55, '#77724a');
      body.addColorStop(1, '#43402c');
      ctx.fillStyle = body;
      ctx.beginPath();
      ctx.ellipse(cx, cy, radius * 1.1, radius, 0, 0, Math.PI * 2);
      ctx.fill();
      if (i % 3 === 0) {
        ctx.strokeStyle = 'rgba(34, 32, 20, 0.55)';
        ctx.lineWidth = Math.max(1, radius * 0.22);
        ctx.beginPath();
        ctx.ellipse(cx, cy, radius * 0.72, radius * 0.62, 0.4, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    const headCell = spine[0];
    if (headCell) {
      const cx = sx(headCell.x);
      const cy = sy(headCell.y);
      const next = spine[1] || headCell;
      const angle = Math.atan2(headCell.y - next.y, headCell.x - next.x);
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(angle);
      const head = ctx.createRadialGradient(
        -ts * 0.2, -ts * 0.2, ts * 0.1,
        0, 0, ts * 0.72
      );
      head.addColorStop(0, '#bdb47a');
      head.addColorStop(0.6, '#847d50');
      head.addColorStop(1, '#4a462d');
      ctx.fillStyle = head;
      ctx.beginPath();
      ctx.ellipse(0, 0, ts * 0.72, ts * 0.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(236, 179, 82, 0.92)';
      for (const side of [-1, 1]) {
        ctx.beginPath();
        ctx.arc(ts * 0.12, side * ts * 0.19, Math.max(1, ts * 0.075), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.strokeStyle = 'rgba(130, 40, 30, 0.85)';
      ctx.lineWidth = Math.max(1, ts * 0.045);
      ctx.beginPath();
      ctx.moveTo(ts * 0.3, 0);
      ctx.lineTo(ts * 0.72, 0);
      ctx.stroke();
      ctx.restore();
    }
  }

  function layoutChase() {
    if (rt.chase && rt.chase.active) updateHud();
  }

  function resizeChase() {
    layoutChase();
  }

  if (dom.chaseAbort) {
    dom.chaseAbort.addEventListener('click', () => {
      if (!rt.chase || !rt.chase.active) return;
      finishChase('abort');
    });
  }
  if (dom.chaseDashTouch) {
    dom.chaseDashTouch.addEventListener('click', chaseDash);
  }

  ZQ.startChase = startChase;
  ZQ.finishChase = finishChase;
  ZQ.chaseDash = chaseDash;
  /* Шаги пути змеи переиспользует бельзебуфо: жаба тоже ползёт по
     настоящим клеткам Лабиринта. */
  ZQ.chasePathStep = nextStep;
  ZQ.chaseGreedyStep = greedyStep;
  /* Полный путь до цели: жаба берёт по нему точку приземления прыжка. */
  ZQ.chasePathFind = bfsPath;
  ZQ.resizeChase = resizeChase;
  ZQ.showChaseStage = showChaseHud;
  ZQ.hideChaseStage = hideChaseHud;
  ZQ.updateChase = updateChase;
  ZQ.drawChaseWorld = drawChaseWorld;
})();
