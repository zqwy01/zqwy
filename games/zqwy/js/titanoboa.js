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
      squeezeChance: 0.16
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
     просчитывать весь бесконечный мир на каждом шаге. */
  function bfsPath(start, goal, blocked, maxDepth, maxNodes) {
    const depthLimit = Number.isFinite(maxDepth) ? maxDepth : 46;
    const nodeLimit = Number.isFinite(maxNodes) ? maxNodes : 6500;
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

  function nextStep(start, goal, blocked) {
    const path = bfsPath(start, goal, blocked);
    if (!path || !path.length) return null;
    return path[1] || path[0];
  }

  function greedyStep(start, goal, blocked) {
    let best = null;
    let bestDistance = Infinity;
    for (const dir of DIRS) {
      const nx = start.x + dir.x;
      const ny = start.y + dir.y;
      const key = keyOf(nx, ny);
      if (!walkable(nx, ny)) continue;
      if (blocked && blocked.has(key)) continue;
      const distance = Math.abs(nx - goal.x) + Math.abs(ny - goal.y);
      if (distance < bestDistance) {
        bestDistance = distance;
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
    const depthLimit = Number.isFinite(maxDepth) ? maxDepth : 40;
    const nodeLimit = Number.isFinite(maxNodes) ? maxNodes : 7500;
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
    const far = farthestNode(head, 48, 9000);
    /* Путь до дальней точки может быть длиннее обычного лимита BFS:
       для начального тела поднимаем глубину ровно под найденный узел. */
    const path = far.depth > 0
      ? bfsPath(head, far.node, null, far.depth + 2, 12000)
      : null;
    if (!path || path.length < 2) return [{ x: head.x, y: head.y }];
    const body = path.slice(0, Math.max(2, length));
    /* Если коридор короче тела, змея всё равно должна быть длинной:
       добавляем клетки назад по уже найденному пути. */
    while (body.length < length && body.length > 1) {
      const last = body[body.length - 1];
      body.push({ x: last.x, y: last.y });
      if (body.length > 80) break;
    }
    return body;
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

    let next = nextStep(head, target, blocked);
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

    chase.body.unshift({ x: next.x, y: next.y });
    while (chase.body.length > chase.bodyCells) chase.body.pop();
  }

  function checkContact(chase) {
    if (chase.invuln > 0 || !chase.active) return;
    const player = rt.state.player;
    for (let i = 0; i < chase.body.length; i += 1) {
      const cell = chase.body[i];
      const radius = i === 0 ? 0.62 : 0.54;
      if (Math.hypot(player.x - (cell.x + 0.5), player.y - (cell.y + 0.5)) < radius) {
        catchPlayer(chase, i === 0 ? 'кольца титанобоа' : 'тело титанобоа');
        return;
      }
    }
  }

  function catchPlayer(chase, cause) {
    if (chase.invuln > 0 || !chase.active) return;
    chase.breaths = Math.max(0, chase.breaths - 1);
    chase.hits += 1;
    chase.invuln = 1.9;
    chase.dashTimer = 0;
    chase.stamina = 0.55;
    if (chase.breaths <= 0) {
      finishChase('death', cause);
      return;
    }
    const spot = safeSpot(chase);
    rt.state.player.x = spot.x + 0.5;
    rt.state.player.y = spot.y + 0.5;
    rt.state.player.facingX = 0;
    rt.state.player.facingY = -1;
    rt.cursorMove = null;
    rt.timedMove = null;
    chase.trail.length = 0;
    chase.lastX = rt.state.player.x;
    chase.lastY = rt.state.player.y;
    placeSnakeNear(chase, spot.x, spot.y, 8);
    chase.invuln = 1.9;
    ZQ.appendLog(t(
      `Кольца достают. Ты вырываешься, но дыхание становится короче. Осталось вдохов: ${chase.breaths}.`,
      `The coils catch you. You tear free, but your breath is shorter now. Breaths left: ${chase.breaths}.`,
      `Die Ringe erwischen dich. Du reißt dich los, doch dein Atem wird kürzer. Atemzüge: ${chase.breaths}.`
    ), 'sys', true);
  }

  function finishChase(outcome, cause) {
    const chase = rt.chase;
    if (!chase) return;
    chase.active = false;
    ZQ.resetKeys();
    hideChaseHud();
    rt.chase = null;

    if (outcome === 'calm') {
      rt.state.flags.titanoboaCalm = true;
      rt.state.flags.titanoboaAttempted = true;
      if (chase.roomId) rt.state.flags[`titanoboa_${chase.roomId}`] = true;
      ZQ.ensureTerminalShare(0.5);
      ZQ.setTerminalView('main');
      if (ZQ.audio) ZQ.audio.setCue('labyrinth');
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
        'Кольца смыкаются. Последний вдох остаётся в зале титанобоа.',
        'The coils close. Your last breath stays in the titanoboa hall.',
        'Die Ringe schließen sich. Der letzte Atemzug bleibt in der Halle der Titanoboa.'
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
    if (dom.chaseBreaths) dom.chaseBreaths.textContent = String(chase.breaths);
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
      } else if (chase.elapsed < 8) {
        hint = t(
          'Уходи. Змея не устанет — устанешь ты. Shift — рывок.',
          'Run. The snake will not tire — you will. Shift to dash.',
          'Lauf. Die Schlange ermüdet nicht — du. Shift für den Sprint.'
        );
      } else if (chase.elapsed < 20) {
        hint = t(
          'Кольца ускоряются. Не давай прижать себя к стене.',
          'The coils are speeding up. Do not let them pin you to a wall.',
          'Die Ringe werden schneller. Lass dich nicht an die Wand drängen.'
        );
      } else if (chase.elapsed < 34) {
        hint = t(
          'Она пропихивается сквозь проходы. Дыши ровнее.',
          'It squeezes through the passages. Keep your breathing even.',
          'Sie zwängt sich durch die Gänge. Atme gleichmäßig.'
        );
      } else {
        hint = t(
          'Ещё немного. Она уже начинает уставать.',
          'A little longer. It is beginning to tire.',
          'Nur noch ein wenig. Sie beginnt bereits zu ermüden.'
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

    const chase = {
      active: true,
      roomId: room ? room.id : null,
      elapsed: 0,
      duration: Number.isFinite(cfg.duration) ? cfg.duration : 44,
      distance: 0,
      lastX: player.x,
      lastY: player.y,
      breaths: 3,
      hits: 0,
      invuln: 1.1,
      hint: '',
      hintUntil: 0,
      bodyCells,
      body: [],
      trail: [],
      squeezeTimer: 0,
      squeezing: false,
      stepTimer: 0,
      dashTimer: 0,
      dashCooldown: 0,
      dashVX: 0,
      dashVY: -1,
      dashSpeed: cfg.dashSpeed || 12.5,
      dashFlash: 0,
      stamina: 1,
      config: cfg,
      player,
      playerSpeed: Number.isFinite(cfg.playerSpeed) ? cfg.playerSpeed : 4.8
    };

    placeSnakeNear(chase, start.x, start.y, 7);
    chase.lastX = player.x;
    chase.lastY = player.y;

    showChaseHud();
    ZQ.ensureTerminalShare(0.4);
    ZQ.setTerminalView('main');
    ZQ.resetKeys();
    if (cfg.trackCue && ZQ.audio) ZQ.audio.setCue(cfg.trackCue);
    ZQ.appendLog(cfg.intro || t(
      'Пол вздрагивает. Титанобоа приходит в движение.',
      'The floor shudders. The titanoboa begins to move.',
      'Der Boden bebt. Die Titanoboa setzt sich in Bewegung.'
    ), 'story', true, cfg.introSpeaker || 'ТИТАНОБОА');
    ZQ.appendLog(t(
      'Это не бой. Продержись, пока змея не успокоится. Shift или ПРОБЕЛ — рывок.',
      'This is not a fight. Hold out until the snake calms. Shift or SPACE to dash.',
      'Das ist kein Kampf. Halte durch, bis die Schlange sich beruhigt. Shift oder LEERTASTE für den Sprint.'
    ), 'sys', true);
    ZQ.logEvent('actions', 'погоня: титанобоа', 'погоня');
    ZQ.saveGame();
    rt.chase = chase;
    updateHud();
    return true;
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

    const pressure = ZQ.clamp(chase.elapsed / Math.max(1, chase.duration), 0, 1);
    const regen = (cfg.staminaRegen || 0.24) - pressure * 0.1;
    chase.stamina = ZQ.clamp(chase.stamina + regen * dt, 0, 1);

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

    /* Скорость змеи растёт к концу погони. */
    const snakeSpeed = cfg.baseSpeed + (cfg.maxSpeed - cfg.baseSpeed) * pressure;
    const interval = 1 / Math.max(0.45, chase.squeezing
      ? Math.min(cfg.squeezeSpeed || 4.4, snakeSpeed + 0.6)
      : snakeSpeed);
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

    if (chase.elapsed >= chase.duration) {
      finishChase('calm');
      return;
    }
    updateHud();
  }

  /* ------------------------ Отрисовка ------------------------------ */
  function drawChaseWorld(ctx, params) {
    const chase = rt.chase;
    if (!chase || !chase.active || !chase.body.length) return;
    const ts = params.ts;
    const view = params.view;
    const sx = params.toScreenX;
    const sy = params.toScreenY;

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
      for (const cell of chase.body.slice(0, 6)) {
        ctx.beginPath();
        ctx.arc(sx(cell.x + 0.5), sy(cell.y + 0.5), ts * 0.7, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    /* Тень и тело. Хвост рисуется первым, голова — последней. */
    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.34)';
    for (let i = chase.body.length - 1; i >= 0; i -= 1) {
      const cell = chase.body[i];
      const cx = sx(cell.x + 0.5) + ts * 0.12;
      const cy = sy(cell.y + 0.5) + ts * 0.18;
      const ratio = i / Math.max(1, chase.body.length);
      const radius = (i === 0 ? ts * 0.52 : ts * 0.44) * (1 - ratio * 0.32);
      ctx.beginPath();
      ctx.ellipse(cx, cy, radius * 1.2, radius * 0.8, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    for (let i = chase.body.length - 1; i >= 0; i -= 1) {
      const cell = chase.body[i];
      const cx = sx(cell.x + 0.5);
      const cy = sy(cell.y + 0.5);
      if (cx < -ts * 2 || cx > view.w + ts * 2 || cy < -ts * 2 || cy > view.h + ts * 2) continue;
      const ratio = i / Math.max(1, chase.body.length);
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

    const headCell = chase.body[0];
    if (headCell) {
      const cx = sx(headCell.x + 0.5);
      const cy = sy(headCell.y + 0.5);
      const next = chase.body[1] || headCell;
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
  ZQ.resizeChase = resizeChase;
  ZQ.showChaseStage = showChaseHud;
  ZQ.hideChaseStage = hideChaseHud;
  ZQ.updateChase = updateChase;
  ZQ.drawChaseWorld = drawChaseWorld;
})();
