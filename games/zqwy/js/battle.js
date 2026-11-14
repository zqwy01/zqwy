/* Схватка идёт прямо в Лабиринте: Zemic становится аксолотлем, но
   продолжает двигаться по настоящим клеткам мира. Снаряды, рывок и
   раскрытый зонт живут в тех же координатах, что и игрок. Отдельной
   арены, второго канваса и отдельной вкладки терминала больше нет. */
(function () {
  'use strict';

  const ZQ = window.ZQ;
  const C = ZQ.C;
  const rt = ZQ.rt;
  const dom = ZQ.dom;

  function baseConfig() {
    return C.battle || {};
  }

  function configFor(kind) {
    const base = Object.assign({}, baseConfig());
    const encounters = base.encounters || {};
    const encounter = encounters[kind] || encounters.beetle || {};
    delete base.encounters;
    return Object.assign(base, encounter);
  }

  function battleConfig() {
    return configFor(rt.battle ? rt.battle.kind : 'beetle');
  }

  function genreFor(config) {
    const genres = baseConfig().genres || {};
    const id = config.genre || 'calm';
    return Object.assign({
      title: id,
      intensity: 1,
      waveScale: 1,
      speedScale: 1,
      enemySpeed: 0
    }, genres[id] || {});
  }

  function hasDash() {
    return typeof ZQ.hasDashAbility === 'function' ? ZQ.hasDashAbility() : true;
  }

  function audioState() {
    return ZQ.audio && typeof ZQ.audio.state === 'function' ? ZQ.audio.state() : null;
  }

  /* Длительность трека боя: сначала справочное значение кассеты, затем
     живые метаданные плеера. Нужна, чтобы схватка длилась ровно столько,
     сколько звучит музыка. */
  function trackSeconds(cue) {
    const meta = C.musicCues && C.musicCues[cue];
    const trackId = meta && meta.track ? meta.track : null;
    const track = trackId && C.music && C.music.tracks ? C.music.tracks[trackId] : null;
    if (track && Number.isFinite(track.duration) && track.duration > 0) {
      return track.duration;
    }
    const state = audioState();
    if (state && Number.isFinite(state.rawDuration) && state.rawDuration > 0) {
      return state.rawDuration;
    }
    return null;
  }

  function hasUmbrella() {
    return Boolean(rt.state && Array.isArray(rt.state.items) &&
      rt.state.items.includes('umbrella'));
  }

  function lang() {
    return window.ZQI18N && window.ZQI18N.lang ? window.ZQI18N.lang : 'ru';
  }

  function t(ru, en, de) {
    const code = lang();
    if (code === 'de') return de || en || ru;
    return code === 'en' ? (en || ru) : ru;
  }

  function survivalProgress(battle) {
    const duration = Number.isFinite(battle.survivalTime) ? battle.survivalTime : 1;
    return ZQ.clamp(battle.elapsed / Math.max(0.001, duration), 0, 1);
  }

  /* Прогресс боя: в режиме track он идёт по самой записи, поэтому
     полоса и плотность залпов совпадают с музыкой. */
  function battleProgress(battle) {
    if (battle.durationMode === 'track') {
      const state = audioState();
      if (state && state.playing && state.rawDuration > 0) {
        return ZQ.clamp(state.rawCurrent / state.rawDuration, 0, 1);
      }
    }
    return survivalProgress(battle);
  }

  function battleRemaining(battle) {
    if (battle.durationMode === 'track') {
      const state = audioState();
      if (state && state.playing && state.rawDuration > 0) {
        const rate = state.rate > 0 ? state.rate : 1;
        return Math.max(0, (state.rawDuration - state.rawCurrent) / rate);
      }
    }
    return Math.max(0, battle.survivalTime - battle.elapsed);
  }

  function formatClock(seconds) {
    const total = Math.max(0, Math.ceil(seconds));
    const minutes = Math.floor(total / 60);
    const rest = total % 60;
    return `${minutes}:${String(rest).padStart(2, '0')}`;
  }

  /* Громкость и атака текущего места волны трека: peaks — 720 отсчётов
     на всю запись. Залпы идут за музыкой, а не за ровным таймером. */
  function musicEnergy(battle) {
    const peaks = ZQ.audio && ZQ.audio.peaks;
    if (!peaks || !peaks.length) return null;
    const progress = battleProgress(battle);
    const index = ZQ.clamp(
      Math.floor(progress * peaks.length),
      0,
      peaks.length - 1
    );
    const level = peaks[index];
    const prev = peaks[Math.max(0, index - 2)] || level;
    const onset = Math.max(0, level - prev);
    let sum = 0;
    let count = 0;
    for (let i = Math.max(0, index - 6); i <= Math.min(peaks.length - 1, index + 6); i += 1) {
      sum += peaks[i];
      count += 1;
    }
    const avg = count ? sum / count : level;
    return { level, onset, avg, index, progress };
  }

  function refreshRoom(battle) {
    if (!rt.world || !rt.state) return;
    const under = rt.world.roomAtTile(
      Math.floor(rt.state.player.x),
      Math.floor(rt.state.player.y)
    );
    if (under) battle.room = under;
  }

  function updateHud() {
    const battle = rt.battle;
    if (!battle) return;
    const config = battleConfig();
    const playerMax = Number.isFinite(battle.playerMaxHp) ? battle.playerMaxHp : 6;
    const playerHp = Math.max(0, battle.playerHp);
    const left = battleRemaining(battle);
    const progress = battleProgress(battle);

    if (dom.battlePlayerHp) dom.battlePlayerHp.textContent = String(playerHp);
    if (dom.battleBeetleHp) dom.battleBeetleHp.textContent = formatClock(left);
    if (dom.battleEnemyName) {
      dom.battleEnemyName.textContent = config.hudLabel ||
        t('продержаться', 'hold out', 'durchhalten');
    }
    if (dom.battleEyebrow) {
      const title = config.title ||
        t('Выживание · аксолотль', 'Survival · axolotl', 'Überleben · Axolotl');
      dom.battleEyebrow.textContent = String(title).toUpperCase();
    }
    if (dom.battlePlayerBar) {
      dom.battlePlayerBar.style.width = `${(playerHp / Math.max(1, playerMax)) * 100}%`;
    }
    if (dom.battleBeetleBar) {
      dom.battleBeetleBar.style.width = `${progress * 100}%`;
    }
    if (dom.battleReflectState) {
      let text = t('зонт: —', 'umbrella: —', 'Schirm: —');
      if (battle.hasUmbrella) {
        text = battle.rhythmMode
          ? (battle.beatWindow > 0
            ? t('зонт: в долю', 'umbrella: on beat', 'Schirm: im Takt')
            : t('зонт: жди долю', 'umbrella: wait for the beat', 'Schirm: warte auf den Schlag'))
          : battle.reflectCooldown > 0
            ? t(
              `зонт: ${Math.ceil(battle.reflectCooldown)} с`,
              `umbrella: ${Math.ceil(battle.reflectCooldown)} s`,
              `Schirm: ${Math.ceil(battle.reflectCooldown)} s`
            )
            : t('зонт: готов', 'umbrella: ready', 'Schirm: bereit');
      }
      dom.battleReflectState.textContent = text;
      dom.battleReflectState.classList.toggle(
        'ready',
        battle.hasUmbrella && (battle.rhythmMode ? battle.beatWindow > 0 : battle.reflectCooldown <= 0)
      );
    }
    if (dom.battleDashState) {
      if (!hasDash()) {
        dom.battleDashState.textContent = t('рывок: закрыт', 'dash: locked', 'Ausweichen: gesperrt');
        dom.battleDashState.classList.remove('ready');
      } else {
        dom.battleDashState.textContent = battle.dashCooldown > 0
          ? t(
            `рывок: ${Math.ceil(battle.dashCooldown)} с`,
            `dash: ${Math.ceil(battle.dashCooldown)} s`,
            `Ausweichen: ${Math.ceil(battle.dashCooldown)} s`
          )
          : t('рывок: готов', 'dash: ready', 'Ausweichen: bereit');
        dom.battleDashState.classList.toggle('ready', battle.dashCooldown <= 0);
      }
    }
    if (dom.battleReflect) {
      dom.battleReflect.disabled = !battle.hasUmbrella ||
        (battle.reflectCooldown > 0 && !battle.rhythmMode);
    }
    if (dom.battleReflectTouch) {
      dom.battleReflectTouch.disabled = !battle.hasUmbrella ||
        (battle.reflectCooldown > 0 && !battle.rhythmMode);
    }
    const dashLocked = !hasDash();
    if (dom.battleDash) dom.battleDash.disabled = dashLocked || battle.dashCooldown > 0;
    if (dom.battleDashTouch) dom.battleDashTouch.disabled = dashLocked || battle.dashCooldown > 0;

    if (dom.battleRhythm) {
      dom.battleRhythm.classList.toggle('hidden', !battle.rhythmMode);
      if (battle.rhythmMode) {
        const beat = Number.isFinite(battle.beat) ? battle.beat : 0;
        const interval = Math.max(0.2, battle.beatInterval || 0.65);
        const phase = 1 - ZQ.clamp((battle.beatTimer || 0) / interval, 0, 1);
        if (dom.battleRhythmBeat) {
          dom.battleRhythmBeat.style.left = `${(phase * 100).toFixed(2)}%`;
          dom.battleRhythmBeat.classList.toggle('hot', battle.beatWindow > 0);
        }
        if (dom.battleRhythmCombo) {
          dom.battleRhythmCombo.textContent = t(
            `ритм ×${battle.combo || 0} · доля ${beat + 1}`,
            `rhythm ×${battle.combo || 0} · beat ${beat + 1}`,
            `Rhythmus ×${battle.combo || 0} · Schlag ${beat + 1}`
          );
        }
      }
    }
  }

  function pushHint(text, time) {
    const battle = rt.battle;
    if (!battle) return;
    battle.hint = text;
    battle.hintUntil = battle.elapsed + (time || 2.2);
    if (dom.battleHint) dom.battleHint.textContent = text;
  }

  function resetHint() {
    if (!dom.battleHint) return;
    const battle = rt.battle;
    const config = battleConfig();
    const parts = [];
    if (battle && battle.durationMode === 'track') {
      parts.push(t(
        'Схватка длится ровно столько, сколько звучит трек. Враг идёт за тобой по всему Лабиринту.',
        'The fight lasts exactly as long as the track. The enemy follows you through the whole labyrinth.',
        'Der Kampf dauert genau so lang wie der Track. Der Gegner folgt dir durch das ganze Labyrinth.'
      ));
    } else {
      const seconds = Math.round(battle ? battle.survivalTime : config.survivalTime || 18);
      parts.push(t(
        `Продержись ${seconds} секунд. Враг идёт за тобой по всему Лабиринту.`,
        `Hold out for ${seconds} seconds. The enemy follows you through the whole labyrinth.`,
        `Halte ${seconds} Sekunden durch. Der Gegner folgt dir durch das ganze Labyrinth.`
      ));
    }
    if (hasDash()) {
      parts.push(t(
        'Shift, ПРОБЕЛ или E — рывок.',
        'Shift, SPACE or E — dash.',
        'Shift, LEERTASTE oder E — Ausweichen.'
      ));
    } else {
      parts.push(t(
        'Рывок ещё закрыт: беги между залпами без ускорения.',
        'Dash is still locked: run between the volleys without it.',
        'Ausweichen ist noch gesperrt: lauf ohne Sprint zwischen den Salven.'
      ));
    }
    if (battle && battle.rhythmMode) {
      parts.push(t(
        'Жми F или «зонт» в долю: попадание в ритм продлевает зонт и копит комбо.',
        'Press F or the umbrella button on the beat: timing extends the umbrella and builds combo.',
        'Drücke F oder die Schirmtaste im Takt: Timing verlängert den Schirm und baut Combo auf.'
      ));
    } else if (battle && battle.hasUmbrella) {
      parts.push(t(
        'F или кнопка «зонт» отводит снаряды (перезарядка 15 с).',
        'F or the umbrella button turns projectiles aside (15 s cooldown).',
        'F oder die Schirmtaste lenkt Geschosse ab (15 s Abklingzeit).'
      ));
    } else {
      parts.push(t(
        'Двигайся между волнами и ныряй в разрывы.',
        'Move between waves and slip through the gaps.',
        'Bewege dich zwischen den Wellen und gleite durch die Lücken.'
      ));
    }
    dom.battleHint.textContent = parts.join(' ');
  }

  function inputVector() {
    let mx = 0;
    let my = 0;
    if (rt.keys.up || rt.gamepadKeys.up) my -= 1;
    if (rt.keys.down || rt.gamepadKeys.down) my += 1;
    if (rt.keys.left || rt.gamepadKeys.left) mx -= 1;
    if (rt.keys.right || rt.gamepadKeys.right) mx += 1;
    if (mx || my) {
      const length = Math.hypot(mx, my);
      mx /= length;
      my /= length;
    }
    return { x: mx, y: my };
  }

  function attemptDash() {
    const battle = rt.battle;
    if (!battle || !battle.active) return false;
    if (!hasDash()) {
      pushHint(t(
        'Рывок ещё не открыт.',
        'Dash is not unlocked yet.',
        'Ausweichen ist noch nicht freigeschaltet.'
      ), 1.6);
      return false;
    }
    if (battle.dashCooldown > 0) return false;
    const config = battleConfig();
    const input = inputVector();
    let dx = input.x;
    let dy = input.y;
    if (!dx && !dy) {
      dx = rt.state.player.facingX || 0;
      dy = rt.state.player.facingY || -1;
    }
    const length = Math.hypot(dx, dy) || 1;
    battle.dashVX = dx / length;
    battle.dashVY = dy / length;
    battle.dashSpeed = Number.isFinite(config.dashSpeed) ? config.dashSpeed : 12.5;
    battle.dashTimer = Number.isFinite(config.dashDuration) ? config.dashDuration : 0.2;
    battle.dashCooldown = Number.isFinite(config.dashCooldown) ? config.dashCooldown : 2.4;
    battle.playerInvuln = Math.max(
      battle.playerInvuln,
      Number.isFinite(config.dashInvuln) ? config.dashInvuln : 0.3
    );
    battle.dashFlash = 1;
    pushHint(t(
      'Рывок. На мгновение ты неуязвим.',
      'Dash. For a moment you are untouchable.',
      'Ausweichen. Für einen Moment bist du unverwundbar.'
    ), 0.9);
    updateHud();
    return true;
  }

  function attemptReflect() {
    const battle = rt.battle;
    if (!battle || !battle.active) return false;
    if (!battle.hasUmbrella) {
      pushHint(t(
        'Зонтика нет. Его ещё нужно забрать в комнате с зонтиком.',
        'No umbrella yet. You still have to earn it in the umbrella hall.',
        'Noch kein Schirm. Du musst ihn erst in der Regenschirmhalle verdienen.'
      ), 1.8);
      return false;
    }
    const onBeat = battle.rhythmMode && battle.beatWindow > 0;
    if (battle.reflectCooldown > 0 && !onBeat) {
      pushHint(t(
        `Зонтик перезаряжается: ${Math.ceil(battle.reflectCooldown)} с.`,
        `The umbrella is recharging: ${Math.ceil(battle.reflectCooldown)} s.`,
        `Der Schirm lädt nach: ${Math.ceil(battle.reflectCooldown)} s.`
      ), 1.2);
      return false;
    }
    const config = battleConfig();
    battle.reflectDuration = Number.isFinite(config.reflectDuration) ? config.reflectDuration : 1.1;
    if (battle.rhythmMode) {
      battle.reflectDuration = Math.max(
        battle.reflectDuration,
        onBeat ? 0.9 : 0.42
      );
      battle.reflectCooldown = onBeat
        ? Math.min(battle.reflectCooldown, 0.12)
        : (Number.isFinite(config.reflectCooldown) ? config.reflectCooldown : 2.4);
      if (onBeat) {
        battle.combo = (battle.combo || 0) + 1;
        battle.beatWindow = 0;
        battle.lastBeatScore = 'perfect';
      } else {
        battle.combo = 0;
        battle.lastBeatScore = 'miss';
      }
    } else {
      battle.reflectCooldown = Number.isFinite(config.reflectCooldown)
        ? config.reflectCooldown
        : 12;
    }
    battle.reflectTimer = battle.reflectDuration;
    battle.reflectFlash = 1;
    pushHint(onBeat
      ? t(
        `В долю. Ритм ×${battle.combo}.`,
        `On the beat. Rhythm ×${battle.combo}.`,
        `Im Takt. Rhythmus ×${battle.combo}.`
      )
      : t(
        'Зонтик раскрыт: снаряды уходят в стороны.',
        'The umbrella is open: projectiles are turned aside.',
        'Der Schirm ist offen: Geschosse werden abgelenkt.'
      ), 1.2);
    updateHud();
    return true;
  }

  function spawnBullet(battle, x, y, angle, speed, radius, homing) {
    /* Вязкие выстрелы жука не гаснут: когда их накопится слишком
       много, самый старый прилипший снаряд уступает место новому. */
    const cap = Number.isFinite(battle.stickyBulletCap) ? battle.stickyBulletCap : 260;
    if (battle.stickyBullets && battle.bullets.length >= cap) {
      const idx = battle.bullets.findIndex((b) => b.stuck);
      battle.bullets.splice(idx >= 0 ? idx : 0, 1);
    }
    battle.bullets.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      r: radius,
      reflected: false,
      homing: Number.isFinite(homing) ? homing : 0,
      life: battle.bulletLife,
      age: 0,
      stuck: false
    });
  }

  function angleTo(battle, x, y) {
    return Math.atan2(battle.player.y - y, battle.player.x - x);
  }

  /* Центр залпа — всегда сам враг. Раньше точка появления выбиралась
     случайно, и снаряды будто возникали из пустоты. Теперь источник
     один: преследователь, которого игрок видит и за которым следит. */
  function roomCenter(battle) {
    const source = emitter(battle);
    if (source) return source;
    const room = battle.room;
    if (room) return { x: room.centerX + 0.5, y: room.centerY + 0.5 };
    return { x: rt.state.player.x, y: rt.state.player.y };
  }

  /* ---------------------- Преследующий враг ------------------------ */
  /* Враг не стоит в центре зала: он ползёт по настоящим клеткам вслед
     за аксолотлем и стреляет на ходу. Шаги пути те же, что у
     титанобоа, поэтому никто не застревает в тупиках и не отстаёт.
     Вид врага (жаба, жук, зонт) задаётся в encounter.enemy. */
  function spawnEnemy(battle, config) {
    const player = rt.state.player;
    const origin = {
      x: Math.floor(player.x),
      y: Math.floor(player.y)
    };
    const minDist = Number.isFinite(config.enemySpawnDistance)
      ? config.enemySpawnDistance
      : 8;
    let spot = origin;
    let found = false;
    for (let radius = minDist; radius <= minDist + 8 && !found; radius += 1) {
      const candidates = [];
      for (let dx = -radius; dx <= radius; dx += 1) {
        for (let dy = -radius; dy <= radius; dy += 1) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== radius) continue;
          const x = origin.x + dx;
          const y = origin.y + dy;
          if (!rt.world || !rt.world.isWalkable(x, y)) continue;
          candidates.push({ x, y });
        }
      }
      if (candidates.length) {
        spot = candidates[Math.floor(Math.random() * candidates.length)];
        found = true;
      }
    }
    const genre = battle.genre || {};
    const speed = Number.isFinite(config.enemySpeed)
      ? config.enemySpeed
      : (Number.isFinite(genre.enemySpeed) ? genre.enemySpeed : 0);
    battle.enemy = {
      kind: config.enemy || 'belzebufo',
      x: spot.x + 0.5,
      y: spot.y + 0.5,
      radius: Number.isFinite(config.enemyRadius) ? config.enemyRadius : 0.55,
      speed,
      target: null,
      flash: 0,
      facingX: 0,
      facingY: 1,
      /* «Подкоп»: жук уходит в камень и выныривает рядом с игроком,
         если отстал. Настройка приходит из encounter.dig. */
      dig: config.dig ? Object.assign({}, config.dig) : null,
      digging: false,
      digTimer: 0,
      /* Жук готов рыть с первой секунды: иначе он успевает отстать
         ещё до первого подкопа и плетётся следом. */
      digCooldown: 0,
      /* Жаба не ползёт — она прыгает: разбег, дуга, приземление. */
      hop: config.hop ? Object.assign({}, config.hop) : null,
      hopState: 'idle',
      hopTimer: 0,
      hopCooldown: 0,
      hopDuration: 0,
      hopFrom: { x: spot.x + 0.5, y: spot.y + 0.5 },
      hopTo: { x: spot.x + 0.5, y: spot.y + 0.5 },
      hopProgress: 0,
      hopHeight: 0,
      landFlash: 0,
      /* Длинный язык: достаёт аксолотля и подтягивает его к жабе. */
      tongue: config.tongue ? Object.assign({}, config.tongue) : null,
      tongueState: 'idle',
      tongueTimer: 0,
      tongueCooldown: Number.isFinite(config.tongueCooldown) ? config.tongueCooldown : 1.2,
      tongueReach: 0,
      tongueHit: false
    };
    return battle.enemy;
  }

  /* Проходимая клетка на кольце вокруг игрока: нужна подкопу, чтобы
     жук выныривал рядом, но не прямо под ногами. */
  function digSpot(minRadius, maxRadius) {
    if (!rt.world) return null;
    const player = rt.state.player;
    const cx = Math.floor(player.x);
    const cy = Math.floor(player.y);
    const from = Math.max(3, Math.round(Number.isFinite(minRadius) ? minRadius : 4));
    const to = Math.max(from, Math.round(Number.isFinite(maxRadius) ? maxRadius : from + 8));
    for (let radius = from; radius <= to; radius += 1) {
      const candidates = [];
      for (let dx = -radius; dx <= radius; dx += 1) {
        for (let dy = -radius; dy <= radius; dy += 1) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== radius) continue;
          if (!rt.world.isWalkable(cx + dx, cy + dy)) continue;
          candidates.push({ x: cx + dx, y: cy + dy });
        }
      }
      if (candidates.length) {
        return candidates[Math.floor(Math.random() * candidates.length)];
      }
    }
    return null;
  }

  /* Жук роет к аксолотлю: выныривает не где попало, а впереди него —
     на пути движения. Так он перекрывает дорогу, а не плетётся сзади. */
  function digSpotAhead(enemy) {
    if (!rt.world) return null;
    const player = rt.state.player;
    let dx = Number.isFinite(player.facingX) ? player.facingX : 0;
    let dy = Number.isFinite(player.facingY) ? player.facingY : 0;
    if (!dx && !dy) {
      dx = player.x - enemy.x;
      dy = player.y - enemy.y;
    }
    const length = Math.hypot(dx, dy) || 1;
    dx /= length;
    dy /= length;
    const arrive = enemy.dig && Number.isFinite(enemy.dig.arrive) ? enemy.dig.arrive : 3;
    const targetX = Math.floor(player.x + dx * arrive);
    const targetY = Math.floor(player.y + dy * arrive);
    const minGap = Math.max(2.2, arrive - 1.4);
    for (let radius = 0; radius <= 10; radius += 1) {
      const candidates = [];
      for (let ox = -radius; ox <= radius; ox += 1) {
        for (let oy = -radius; oy <= radius; oy += 1) {
          if (Math.max(Math.abs(ox), Math.abs(oy)) !== radius) continue;
          const x = targetX + ox;
          const y = targetY + oy;
          if (!rt.world.isWalkable(x, y)) continue;
          if (Math.hypot(x + 0.5 - player.x, y + 0.5 - player.y) < minGap) continue;
          candidates.push({ x, y });
        }
      }
      if (candidates.length) {
        return candidates[Math.floor(Math.random() * candidates.length)];
      }
    }
    return digSpot(Math.max(2, arrive), arrive + 6);
  }

  function stepEnemy(battle) {
    const enemy = battle.enemy;
    if (!enemy || !rt.world) return;
    const player = rt.state.player;
    const goal = { x: Math.floor(player.x), y: Math.floor(player.y) };
    const start = { x: Math.floor(enemy.x), y: Math.floor(enemy.y) };
    if (start.x === goal.x && start.y === goal.y) {
      enemy.target = null;
      return;
    }
    let next = typeof ZQ.chasePathStep === 'function'
      ? ZQ.chasePathStep(start, goal, null)
      : null;
    if (!next && typeof ZQ.chaseGreedyStep === 'function') {
      next = ZQ.chaseGreedyStep(start, goal, null);
    }
    enemy.target = next
      ? { x: next.x + 0.5, y: next.y + 0.5 }
      : { x: player.x, y: player.y };
  }

  /* Прямая линия между клетками свободна: жаба не должна перелетать
     сквозь стену на повороте. */
  function straightClear(from, to) {
    if (!rt.world) return false;
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const steps = Math.max(Math.abs(dx), Math.abs(dy));
    if (steps <= 1) return true;
    for (let i = 1; i < steps; i += 1) {
      const x = Math.round(from.x + (dx * i) / steps);
      const y = Math.round(from.y + (dy * i) / steps);
      if (!rt.world.isWalkable(x, y)) return false;
    }
    return true;
  }

  /* Точка приземления прыжка: идём по найденному пути на hop.distance
     клеток, но не дальше места, куда ведёт прямая без стены. */
  function hopTarget(enemy) {
    if (!rt.world) return null;
    const player = rt.state.player;
    const goal = { x: Math.floor(player.x), y: Math.floor(player.y) };
    const start = { x: Math.floor(enemy.x), y: Math.floor(enemy.y) };
    if (start.x === goal.x && start.y === goal.y) return null;
    const cfg = enemy.hop || {};
    const steps = Math.max(1, Math.round(Number.isFinite(cfg.distance) ? cfg.distance : 3));
    const path = typeof ZQ.chasePathFind === 'function'
      ? ZQ.chasePathFind(start, goal, null)
      : null;
    if (path && path.length >= 2) {
      const maxIndex = Math.min(steps, path.length - 1);
      for (let k = maxIndex; k >= 1; k -= 1) {
        if (straightClear(start, path[k])) return path[k];
      }
    }
    let next = typeof ZQ.chasePathStep === 'function'
      ? ZQ.chasePathStep(start, goal, null)
      : null;
    if (!next && typeof ZQ.chaseGreedyStep === 'function') {
      next = ZQ.chaseGreedyStep(start, goal, null);
    }
    return next;
  }

  /* Прыжки жабы: разбег, полёт по дуге, приземление с брызгами слизи. */
  function updateHopEnemy(battle, enemy, dt) {
    const cfg = enemy.hop || {};
    if (enemy.hopCooldown > 0) enemy.hopCooldown = Math.max(0, enemy.hopCooldown - dt);
    const state = enemy.hopState || 'idle';

    if (state === 'idle') {
      enemy.hopHeight = 0;
      if (enemy.hopCooldown > 0) return;
      const target = hopTarget(enemy);
      if (!target) {
        enemy.hopCooldown = 0.25;
        return;
      }
      enemy.hopFrom = { x: enemy.x, y: enemy.y };
      enemy.hopTo = { x: target.x + 0.5, y: target.y + 0.5 };
      const dx = enemy.hopTo.x - enemy.x;
      const dy = enemy.hopTo.y - enemy.y;
      const length = Math.hypot(dx, dy) || 1;
      enemy.facingX = dx / length;
      enemy.facingY = dy / length;
      enemy.hopState = 'crouch';
      enemy.hopTimer = Number.isFinite(cfg.windup) ? cfg.windup : 0.16;
      return;
    }

    if (state === 'crouch') {
      enemy.hopTimer -= dt;
      if (enemy.hopTimer <= 0) {
        const duration = Number.isFinite(cfg.duration) ? cfg.duration : 0.3;
        enemy.hopState = 'air';
        enemy.hopTimer = duration;
        enemy.hopDuration = duration;
        enemy.hopProgress = 0;
      }
      return;
    }

    if (state === 'air') {
      enemy.hopTimer -= dt;
      const duration = enemy.hopDuration || (Number.isFinite(cfg.duration) ? cfg.duration : 0.3);
      const progress = ZQ.clamp(1 - enemy.hopTimer / Math.max(0.001, duration), 0, 1);
      enemy.hopProgress = progress;
      enemy.x = enemy.hopFrom.x + (enemy.hopTo.x - enemy.hopFrom.x) * progress;
      enemy.y = enemy.hopFrom.y + (enemy.hopTo.y - enemy.hopFrom.y) * progress;
      const height = Number.isFinite(cfg.height) ? cfg.height : 1.05;
      enemy.hopHeight = Math.sin(progress * Math.PI) * height;
      if (enemy.hopTimer <= 0) {
        enemy.x = enemy.hopTo.x;
        enemy.y = enemy.hopTo.y;
        enemy.hopHeight = 0;
        enemy.hopState = 'idle';
        enemy.hopCooldown = Number.isFinite(cfg.cooldown) ? cfg.cooldown : 0.12;
        enemy.landFlash = 1;
        dropSlime(
          battle,
          enemy.x,
          enemy.y,
          Number.isFinite(cfg.slimeBurst) ? cfg.slimeBurst : 4,
          0.9
        );
      }
    }
  }

  /* Язык: выбрасывается к аксолотлю и, если достал, подтягивает его к
     жабе. Поэтому далеко от неё не убежать. */
  function updateTongue(battle, enemy, dt) {
    const cfg = enemy.tongue;
    if (!cfg) return;
    if (enemy.tongueCooldown > 0) enemy.tongueCooldown = Math.max(0, enemy.tongueCooldown - dt);
    const player = rt.state.player;
    const state = enemy.tongueState || 'idle';
    const range = Number.isFinite(cfg.range) ? cfg.range : 7;
    const outTime = Number.isFinite(cfg.outTime) ? cfg.outTime : 0.16;
    const pullTime = Number.isFinite(cfg.pullTime) ? cfg.pullTime : 0.5;
    const retractTime = Number.isFinite(cfg.retractTime) ? cfg.retractTime : 0.14;

    if (state === 'idle') {
      enemy.tongueReach = 0;
      if (enemy.hopState === 'air') return;
      const distance = Math.hypot(player.x - enemy.x, player.y - enemy.y);
      const clear = straightClear(
        { x: Math.floor(enemy.x), y: Math.floor(enemy.y) },
        { x: Math.floor(player.x), y: Math.floor(player.y) }
      );
      if (enemy.tongueCooldown <= 0 && distance > 0.9 && distance <= range && clear) {
        enemy.tongueState = 'out';
        enemy.tongueTimer = outTime;
        enemy.tongueHit = false;
        pushHint(t(
          'Бельзебуфо выбрасывает язык — он подтянет тебя ближе.',
          'The belzebufo flicks out its tongue — it will reel you in.',
          'Der Belzebufo schleudert die Zunge aus — sie zieht dich heran.'
        ), 1.0);
      }
      return;
    }

    if (state === 'out') {
      enemy.tongueTimer -= dt;
      enemy.tongueReach = ZQ.clamp(1 - enemy.tongueTimer / Math.max(0.001, outTime), 0, 1);
      if (enemy.tongueTimer <= 0) {
        const distance = Math.hypot(player.x - enemy.x, player.y - enemy.y);
        enemy.tongueHit = distance <= range + 0.8;
        enemy.tongueState = 'pull';
        enemy.tongueTimer = pullTime;
        enemy.tongueReach = 1;
        enemy.tongueCooldown = Number.isFinite(cfg.cooldown) ? cfg.cooldown : 4.2;
        if (enemy.tongueHit && battle.playerInvuln <= 0) {
          battle.playerHp -= Number.isFinite(cfg.damage) ? cfg.damage : 1;
          battle.playerInvuln = 0.6;
          battle.flash = 1;
          pushHint(t(
            'Язык обхватил аксолотля и тянет к жабе.',
            'The tongue wraps the axolotl and drags it toward the frog.',
            'Die Zunge umschlingt den Axolotl und zieht ihn zur Kröte.'
          ), 1.1);
          updateHud();
          if (battle.playerHp <= 0) {
            finishBattle('death');
            return;
          }
        }
      }
      return;
    }

    if (state === 'pull') {
      enemy.tongueTimer -= dt;
      enemy.tongueReach = 1;
      if (enemy.tongueHit) {
        const dx = player.x - enemy.x;
        const dy = player.y - enemy.y;
        const distance = Math.hypot(dx, dy) || 1;
        const pull = (Number.isFinite(cfg.pullSpeed) ? cfg.pullSpeed : 5.5) * dt;
        const move = Math.min(pull, Math.max(0, distance - 0.6));
        const nx = player.x - (dx / distance) * move;
        const ny = player.y - (dy / distance) * move;
        if (ZQ.canStandAt(nx, ny)) {
          player.x = nx;
          player.y = ny;
        } else {
          if (ZQ.canStandAt(nx, player.y)) player.x = nx;
          if (ZQ.canStandAt(player.x, ny)) player.y = ny;
        }
      }
      if (enemy.tongueTimer <= 0) {
        enemy.tongueState = 'retract';
        enemy.tongueTimer = retractTime;
      }
      return;
    }

    if (state === 'retract') {
      enemy.tongueTimer -= dt;
      enemy.tongueReach = ZQ.clamp(enemy.tongueTimer / Math.max(0.001, retractTime), 0, 1);
      if (enemy.tongueTimer <= 0) {
        enemy.tongueState = 'idle';
        enemy.tongueReach = 0;
        enemy.tongueHit = false;
      }
    }
  }

  function updateEnemy(battle, dt) {
    const enemy = battle.enemy;
    if (!enemy) return;
    if (enemy.flash > 0) enemy.flash = Math.max(0, enemy.flash - dt * 3);
    if (enemy.landFlash > 0) enemy.landFlash = Math.max(0, enemy.landFlash - dt * 3);
    if (enemy.digCooldown > 0) enemy.digCooldown = Math.max(0, enemy.digCooldown - dt);

    /* Подкоп: пока жук в норе, он не движется; на выходе оказывается
       рядом с игроком. Так преследователь не теряется за поворотами. */
    if (enemy.digging) {
      enemy.digTimer -= dt;
      if (enemy.digTimer <= 0) {
        enemy.digging = false;
        enemy.digTimer = 0;
        enemy.digCooldown = enemy.dig && Number.isFinite(enemy.dig.cooldown)
          ? enemy.dig.cooldown
          : 6;
        const arrive = enemy.dig && Number.isFinite(enemy.dig.arrive)
          ? enemy.dig.arrive
          : 5;
        const spot = digSpotAhead(enemy) || digSpot(arrive, arrive + 6);
        if (spot) {
          enemy.x = spot.x + 0.5;
          enemy.y = spot.y + 0.5;
        }
        enemy.target = null;
        enemy.flash = 1;
        pushHint(t(
          `${enemyName(enemy.kind)} выныривает рядом.`,
          `The ${enemyName(enemy.kind).toLowerCase()} bursts out nearby.`,
          `${enemyName(enemy.kind)} bricht neben dir hervor.`
        ), 1.2);
      }
      return;
    }

    /* Жаба не ползёт: она прыгает, а длинным языком подтягивает
       аксолотля к себе. Это отдельная логика движения. */
    if (enemy.hop) {
      updateHopEnemy(battle, enemy, dt);
      updateTongue(battle, enemy, dt);
      return;
    }

    const speed = Number.isFinite(enemy.speed) ? enemy.speed : 0;
    if (speed <= 0) return;

    /* Жук теряется, если аксолотль убегает по длинным коридорам:
       тогда он уходит в камень и роет к игроку. */
    if (enemy.dig && enemy.digCooldown <= 0) {
      const player = rt.state.player;
      const distance = Math.hypot(player.x - enemy.x, player.y - enemy.y);
      const trigger = Number.isFinite(enemy.dig.distance) ? enemy.dig.distance : 15;
      if (distance > trigger) {
        enemy.digging = true;
        enemy.digTimer = Number.isFinite(enemy.dig.duration) ? enemy.dig.duration : 0.8;
        enemy.target = null;
        pushHint(t(
          `${enemyName(enemy.kind)} уходит в камень — он уже роет к тебе.`,
          `The ${enemyName(enemy.kind).toLowerCase()} sinks into the stone — it is digging toward you.`,
          `${enemyName(enemy.kind)} geht in den Stein — er gräbt zu dir.`
        ), 1.2);
        return;
      }
    }

    if (!enemy.target) stepEnemy(battle);
    if (!enemy.target) return;
    const dx = enemy.target.x - enemy.x;
    const dy = enemy.target.y - enemy.y;
    const distance = Math.hypot(dx, dy);
    if (distance > 0.001) {
      enemy.facingX = dx / distance;
      enemy.facingY = dy / distance;
    }
    const step = speed * dt;
    if (distance <= step || distance < 0.02) {
      enemy.x = enemy.target.x;
      enemy.y = enemy.target.y;
      enemy.target = null;
      stepEnemy(battle);
      return;
    }
    enemy.x += (dx / distance) * step;
    enemy.y += (dy / distance) * step;
  }

  function checkEnemyContact(battle) {
    const enemy = battle.enemy;
    if (!enemy || battle.playerInvuln > 0) return;
    const config = battleConfig();
    const player = rt.state.player;
    const reach = (Number.isFinite(enemy.radius) ? enemy.radius : 0.55) +
      (Number.isFinite(battle.playerRadius) ? battle.playerRadius : 0.34);
    if (Math.hypot(player.x - enemy.x, player.y - enemy.y) > reach) return;
    enemy.flash = 1;
    battle.flash = 1;
    battle.playerHp -= Number.isFinite(config.bulletDamage) ? config.bulletDamage : 1;
    battle.playerInvuln = Number.isFinite(config.playerInvuln) ? config.playerInvuln : 0.9;
    const name = enemyName(enemy.kind);
    pushHint(t(
      `${name} достаёт тебя. Уходи из-под удара и не давай прижать себя.`,
      `The ${name.toLowerCase()} reaches you. Break away and do not let it pin you.`,
      `${name} erreicht dich. Löse dich und lass dich nicht bedrängen.`
    ), 1.3);
    updateHud();
    if (battle.playerHp <= 0) finishBattle('death');
  }

  /* Капля слизи в точке. Жук оставляет её под собой, а жаба — ещё и
     брызгами после прыжка. */
  function dropSlime(battle, x, y, count, spread) {
    const cfg = battle.slimeConfig;
    if (!cfg) return;
    const cap = Number.isFinite(cfg.cap) ? cfg.cap : 260;
    const radius = Number.isFinite(cfg.radius) ? cfg.radius : 0.72;
    const n = Math.max(1, Math.round(count || 1));
    const reach = Number.isFinite(spread) ? spread : 0;
    for (let i = 0; i < n; i += 1) {
      const angle = Math.random() * Math.PI * 2;
      const distance = Math.random() * reach;
      battle.slime.push({
        x: x + Math.cos(angle) * distance,
        y: y + Math.sin(angle) * distance,
        r: radius * (0.82 + Math.random() * 0.36),
        phase: Math.random() * Math.PI * 2
      });
    }
    while (battle.slime.length > cap) battle.slime.shift();
  }

  /* Зелёная жижа. Капает под врагом, остаётся до конца боя, наносит
     урон и замедляет аксолотля, пока он по ней идёт. */
  function updateSlime(battle, dt) {
    const cfg = battle.slimeConfig;
    if (!cfg) {
      battle.playerSpeedScale = 1;
      return;
    }
    if (battle.slimeCooldown > 0) battle.slimeCooldown = Math.max(0, battle.slimeCooldown - dt);

    const enemy = battle.enemy;
    battle.slimeTimer -= dt;
    if (enemy && !enemy.digging && battle.slimeTimer <= 0) {
      const interval = Number.isFinite(cfg.interval) ? cfg.interval : 0.45;
      battle.slimeTimer = Math.max(0.12, interval);
      dropSlime(battle, enemy.x, enemy.y, 1, 0.3);
    }

    const player = rt.state.player;
    let inSlime = false;
    for (const pool of battle.slime) {
      const dx = player.x - pool.x;
      const dy = player.y - pool.y;
      if (dx * dx + dy * dy <= pool.r * pool.r) { inSlime = true; break; }
    }
    battle.playerSpeedScale = inSlime
      ? (Number.isFinite(cfg.slow) && cfg.slow > 0 ? cfg.slow : 0.55)
      : 1;
    if (inSlime && battle.slimeCooldown <= 0 && battle.playerInvuln <= 0) {
      battle.slimeCooldown = 0.9;
      battle.playerHp -= Number.isFinite(cfg.damage) ? cfg.damage : 1;
      battle.flash = 1;
      pushHint(t(
        'Зелёная жижа разъедает и держит на месте. Обойди её.',
        'The green slime burns and holds you. Go around it.',
        'Der grüne Schleim ätzt und hält dich. Geh außen herum.'
      ), 1.3);
      updateHud();
      if (battle.playerHp <= 0) finishBattle('death');
    }
  }

  /* Имя преследующего врага для подсказок и лога. */
  function enemyName(kind) {
    if (kind === 'beetle') return t('Жук', 'beetle', 'Käfer');
    if (kind === 'umbrella') return t('Тёмный зонт', 'dark umbrella', 'dunkler Schirm');
    return t('Бельзебуфо', 'belzebufo', 'Belzebufo');
  }

  /* Отрисовка врага: спрайт берётся у Renderer, вид — из encounter.enemy. */
  function drawEnemySprite(ctx, kind, sx, sy, ts, now, enemy) {
    const R = window.Renderer;
    if (!R) return;
    if (kind === 'beetle' && typeof R.drawArenaBeetle === 'function') {
      R.drawArenaBeetle(ctx, sx, sy, ts, now);
      return;
    }
    if (kind === 'umbrella' && typeof R.drawUmbrellaEnemy === 'function') {
      R.drawUmbrellaEnemy(ctx, sx, sy, ts, now);
      return;
    }
    if (typeof R.drawBelzebufo === 'function') {
      R.drawBelzebufo(ctx, sx, sy, ts, now, enemy);
    }
  }

  /* Язык жабы: тянется из пасти к аксолотлю. Пока жаба подтягивает
     игрока, кончик языка приклеен к нему. */
  function drawTongue(ctx, enemy, ex, ey, ts, params) {
    const player = rt.state.player;
    const reach = ZQ.clamp(enemy.tongueReach || 0, 0, 1);
    if (reach <= 0.01) return;
    const tipX = params.toScreenX(enemy.x + (player.x - enemy.x) * reach);
    const tipY = params.toScreenY(enemy.y + (player.y - enemy.y) * reach);
    const lift = Number.isFinite(enemy.hopHeight) ? enemy.hopHeight * ts : 0;
    ctx.save();
    ctx.strokeStyle = 'rgba(226, 108, 140, 0.9)';
    ctx.lineWidth = Math.max(2, ts * 0.15);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(ex, ey - lift);
    ctx.lineTo(tipX, tipY);
    ctx.stroke();
    ctx.fillStyle = 'rgba(240, 156, 176, 0.95)';
    ctx.beginPath();
    ctx.arc(tipX, tipY, Math.max(2, ts * 0.15), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  /* Источник залпов — сам преследователь. Снаряды выходят из его
     позиции, а не из случайной точки зала, поэтому игрок всегда видит,
     откуда идёт волна. */
  function emitter(battle) {
    const enemy = battle.enemy;
    if (!enemy) return null;
    return { x: enemy.x, y: enemy.y };
  }

  function waveScale(battle) {
    return Number.isFinite(battle.waveScale) && battle.waveScale > 0 ? battle.waveScale : 1;
  }

  function aimedFan(battle, speed, radius, progress) {
    const config = battleConfig();
    const count = Math.max(2, Math.round(
      ((Number.isFinite(config.waveCount) ? config.waveCount : 5) + progress * 2) *
      waveScale(battle)
    ));
    const spread = Number.isFinite(config.spread) ? config.spread : 0.5;
    const origin = emitter(battle);
    if (!origin) return;
    const base = angleTo(battle, origin.x, origin.y);
    for (let i = 0; i < count; i += 1) {
      const part = count > 1 ? i / (count - 1) - 0.5 : 0;
      spawnBullet(battle, origin.x, origin.y, base + part * spread, speed, radius);
    }
  }

  /* «Дождь» стал широким веером из врага: тот же плотный поток, но
     теперь видно, кто его выпустил. */
  function rainWave(battle, speed, radius, progress) {
    const config = battleConfig();
    const count = Math.max(4, Math.round(
      ((Number.isFinite(config.waveCount) ? config.waveCount : 5) + 3 + progress * 4) *
      waveScale(battle)
    ));
    const origin = emitter(battle);
    if (!origin) return;
    const base = angleTo(battle, origin.x, origin.y);
    const spread = Math.PI * 0.9;
    for (let i = 0; i < count; i += 1) {
      const part = count > 1 ? i / (count - 1) - 0.5 : 0;
      const jitter = (Math.random() - 0.5) * 0.08;
      spawnBullet(battle, origin.x, origin.y, base + part * spread + jitter, speed * 0.86, radius);
    }
  }

  function ringWave(battle, speed, radius, progress) {
    const config = battleConfig();
    const count = Math.round(
      ((Number.isFinite(config.ringCount) ? config.ringCount : 16) + progress * 6) *
      waveScale(battle)
    );
    const center = roomCenter(battle);
    if (!center) return;
    const gapAngle = Math.atan2(
      battle.player.y - center.y,
      battle.player.x - center.x
    );
    const offset = battle.volley * 0.23;
    const gap = 0.5;
    for (let i = 0; i < count; i += 1) {
      const angle = (i / count) * Math.PI * 2 + offset;
      const diff = Math.atan2(Math.sin(angle - gapAngle), Math.cos(angle - gapAngle));
      if (Math.abs(diff) < gap) continue;
      spawnBullet(
        battle,
        center.x + Math.cos(angle) * 0.85,
        center.y + Math.sin(angle) * 0.85,
        angle,
        speed * 0.92,
        radius
      );
    }
  }

  function spiralWave(battle, speed, radius) {
    const arms = 3;
    const base = battle.volley * 0.55;
    const center = roomCenter(battle);
    if (!center) return;
    for (let arm = 0; arm < arms; arm += 1) {
      const angle = base + (arm / arms) * Math.PI * 2;
      spawnBullet(
        battle,
        center.x + Math.cos(angle) * 0.7,
        center.y + Math.sin(angle) * 0.7,
        angle,
        speed * 0.84,
        radius
      );
    }
  }

  /* Перекрёстный огонь: вращающийся крест из четырёх лучей, выходящих
     из врага. Раньше снаряды возникали вокруг игрока. */
  function crossfireWave(battle, speed, radius) {
    const origin = emitter(battle);
    if (!origin) return;
    const base = angleTo(battle, origin.x, origin.y) + battle.volley * 0.4;
    for (let i = 0; i < 4; i += 1) {
      const angle = base + (i / 4) * Math.PI * 2;
      spawnBullet(battle, origin.x, origin.y, angle, speed * 0.9, radius);
    }
  }

  function homingWave(battle, speed, radius, progress) {
    const count = Math.max(1, Math.round((2 + progress * 2) * waveScale(battle)));
    const origin = emitter(battle);
    if (!origin) return;
    const base = angleTo(battle, origin.x, origin.y);
    for (let i = 0; i < count; i += 1) {
      spawnBullet(
        battle,
        origin.x,
        origin.y,
        base,
        speed * 0.66,
        radius * 1.15,
        1.1 + progress * 0.9
      );
    }
  }

  /* Сама волна: считается один раз, когда телеграф досчитал до нуля. */
  function fireVolley(battle, config, genre) {
    /* Интенсивность залпов идёт за музыкой: громкие доли и атаки
       сгущают снаряды, тихие проходы дают передышку. Жанр задаёт
       общий уровень поверх этого. */
    const progress = battleProgress(battle);
    const energy = musicEnergy(battle);
    const loud = energy ? ZQ.clamp((energy.level - 0.32) / 0.68, 0, 1) : 0;
    const onset = energy ? ZQ.clamp(energy.onset * 4.5, 0, 1) : 0;
    const punch = Math.max(loud, onset);
    const intensity = (Number.isFinite(genre.intensity) ? genre.intensity : 1) *
      (1 + punch * 0.45);
    battle.waveScale = (Number.isFinite(genre.waveScale) ? genre.waveScale : 1) *
      (1 + loud * 0.35 + onset * 0.2);
    battle.energy = energy ? energy.level : 0;

    const baseInterval = Number.isFinite(config.waveInterval) ? config.waveInterval : 1.6;
    let interval = baseInterval * (1 - progress * 0.42) / Math.max(0.4, intensity);
    interval *= 1 - 0.38 * punch;
    battle.waveCooldown = Math.max(0.34, interval);
    battle.volley += 1;

    const speed = (Number.isFinite(config.waveSpeed) ? config.waveSpeed : 3.4) *
      (1 + progress * 0.32) *
      (Number.isFinite(genre.speedScale) ? genre.speedScale : 1);
    const radius = Number.isFinite(config.bulletRadius) ? config.bulletRadius : 0.13;

    switch ((battle.volley - 1) % 6) {
      case 0: aimedFan(battle, speed, radius, progress); break;
      case 1: rainWave(battle, speed, radius, progress); break;
      case 2: ringWave(battle, speed, radius, progress); break;
      case 3: crossfireWave(battle, speed, radius); break;
      case 4: spiralWave(battle, speed, radius); break;
      default: homingWave(battle, speed, radius, progress); break;
    }
  }

  function emitWave(dt) {
    const battle = rt.battle;
    if (!battle || !battle.active) return;
    const config = battleConfig();
    const genre = battle.genre || genreFor(config);

    /* Телеграф: враг на мгновение «заряжается» на виду, и только потом
       выходит волна из его позиции. Никаких снарядов из пустоты. */
    if (battle.telegraph > 0) {
      battle.telegraph = Math.max(0, battle.telegraph - dt);
      if (battle.telegraph > 0) return;
      fireVolley(battle, config, genre);
      return;
    }

    battle.waveCooldown -= dt;
    if (battle.waveCooldown > 0) return;

    const telegraph = Number.isFinite(config.telegraph) ? config.telegraph : 0.32;
    if (telegraph > 0) {
      battle.telegraph = telegraph;
      battle.telegraphTotal = telegraph;
      return;
    }
    fireVolley(battle, config, genre);
  }

  /* Прилипший выстрел больше не летит: он остаётся висеть на стене или
     на другом снаряде до конца боя, образуя опасную стенку. */
  function stickBullet(bullet, x, y) {
    bullet.stuck = true;
    bullet.x = x;
    bullet.y = y;
    bullet.vx = 0;
    bullet.vy = 0;
    bullet.homing = 0;
    bullet.life = Infinity;
  }

  function updateBullets(dt) {
    const battle = rt.battle;
    if (!battle || !battle.active || !rt.world) return;
    const config = battleConfig();
    const playerRadius = Number.isFinite(battle.playerRadius)
      ? battle.playerRadius
      : (Number.isFinite(C.battle && C.battle.playerRadius) ? C.battle.playerRadius : 0.34);
    const reflectRadius = Number.isFinite(config.reflectRadius) ? config.reflectRadius : 1.55;
    const stickyEnabled = Boolean(battle.stickyBullets);
    const stickDelay = Number.isFinite(battle.bulletStickDelay) ? battle.bulletStickDelay : 0.22;
    const bullets = battle.bullets;

    for (let i = bullets.length - 1; i >= 0; i -= 1) {
      const bullet = bullets[i];
      const sticky = stickyEnabled && !bullet.reflected;

      if (!bullet.stuck) {
        if (!bullet.reflected && bullet.homing > 0) {
          const speed = Math.hypot(bullet.vx, bullet.vy);
          const current = Math.atan2(bullet.vy, bullet.vx);
          const desired = Math.atan2(
            battle.player.y - bullet.y,
            battle.player.x - bullet.x
          );
          const diff = Math.atan2(Math.sin(desired - current), Math.cos(desired - current));
          const turn = Math.max(-bullet.homing * dt, Math.min(bullet.homing * dt, diff));
          const next = current + turn;
          bullet.vx = Math.cos(next) * speed;
          bullet.vy = Math.sin(next) * speed;
        }

        const prevX = bullet.x;
        const prevY = bullet.y;
        bullet.age = (bullet.age || 0) + dt;
        bullet.x += bullet.vx * dt;
        bullet.y += bullet.vy * dt;
        bullet.life -= dt;

        /* Снаряд упирается в стену настоящего Лабиринта. Вязкий выстрел
           жука не гаснет, а приклеивается к ней; обычный — исчезает. */
        const tileX = Math.floor(bullet.x);
        const tileY = Math.floor(bullet.y);
        if (!rt.world.isWalkable(tileX, tileY)) {
          if (sticky && bullet.age >= stickDelay) {
            stickBullet(bullet, prevX, prevY);
          } else {
            bullets.splice(i, 1);
            continue;
          }
        } else if (bullet.life <= 0) {
          bullets.splice(i, 1);
          continue;
        } else if (sticky && bullet.age >= stickDelay) {
          /* Слипание: выстрел, коснувшийся уже прилипшего, тоже
             застывает — так снаряды собираются в единую массу. */
          let contact = false;
          for (let j = 0; j < bullets.length; j += 1) {
            if (j === i) continue;
            const other = bullets[j];
            if (!other.stuck) continue;
            const dx = bullet.x - other.x;
            const dy = bullet.y - other.y;
            if (dx * dx + dy * dy <= (bullet.r + other.r + 0.04) ** 2) {
              contact = true;
              break;
            }
          }
          if (contact) stickBullet(bullet, prevX, prevY);
        }
      }

      const pdx = bullet.x - battle.player.x;
      const pdy = bullet.y - battle.player.y;
      const playerDistance = Math.hypot(pdx, pdy);

      if (!bullet.reflected && !bullet.stuck && battle.reflectTimer > 0 &&
          playerDistance <= reflectRadius + bullet.r) {
        const speed = Math.max(1.6, Math.hypot(bullet.vx, bullet.vy) * 1.25);
        const angle = playerDistance > 0.001
          ? Math.atan2(pdy, pdx)
          : Math.atan2(bullet.vy, bullet.vx);
        bullet.vx = Math.cos(angle) * speed;
        bullet.vy = Math.sin(angle) * speed;
        bullet.reflected = true;
        bullet.homing = 0;
        bullet.life = Math.min(bullet.life, 2.4);
        battle.reflectFlash = 1;
        continue;
      }

      if (!bullet.reflected && battle.playerInvuln <= 0 &&
          playerDistance <= playerRadius + bullet.r) {
        /* Прилипший снаряд — часть опасной стенки: он ранит, но не
           исчезает, поэтому такие стены приходится обходить. */
        if (!bullet.stuck) bullets.splice(i, 1);
        battle.playerHp -= Number.isFinite(config.bulletDamage) ? config.bulletDamage : 1;
        battle.playerInvuln = Number.isFinite(config.playerInvuln) ? config.playerInvuln : 0.9;
        battle.flash = 1;
        pushHint(t(
          'Снаряд задел аксолотля. Двигайся и ныряй в разрывы.',
          'A projectile grazed the axolotl. Move and slip through the gaps.',
          'Ein Geschoss hat den Axolotl gestreift. Bewege dich und gleite durch die Lücken.'
        ), 1.3);
        updateHud();
        if (battle.playerHp <= 0) {
          finishBattle('death');
          return;
        }
        continue;
      }
    }
  }

  /* Конец боя: в режиме track он заканчивается вместе с записью, а не
     на половине. durationCap остаётся предохранителем, elapsed — запас
     на случай, если музыка выключена и трек не играет. */
  function battleComplete(battle) {
    if (battle.durationMode === 'track') {
      const state = audioState();
      if (state && state.playing && state.rawDuration > 0 &&
          state.rawCurrent >= state.rawDuration - 0.12) {
        return true;
      }
    }
    if (Number.isFinite(battle.durationCap) && battle.elapsed >= battle.durationCap) {
      return true;
    }
    return battle.elapsed >= battle.survivalTime;
  }

  function updateBattle(dt) {
    const battle = rt.battle;
    if (!battle || !battle.active) return;
    battle.elapsed += dt;

    if (battle.dashCooldown > 0) battle.dashCooldown = Math.max(0, battle.dashCooldown - dt);
    if (battle.dashTimer > 0) battle.dashTimer = Math.max(0, battle.dashTimer - dt);
    if (battle.playerInvuln > 0) battle.playerInvuln = Math.max(0, battle.playerInvuln - dt);
    if (battle.reflectTimer > 0) battle.reflectTimer = Math.max(0, battle.reflectTimer - dt);
    if (battle.reflectCooldown > 0) battle.reflectCooldown = Math.max(0, battle.reflectCooldown - dt);
    if (battle.dashFlash > 0) battle.dashFlash = Math.max(0, battle.dashFlash - dt * 4);
    if (battle.reflectFlash > 0) battle.reflectFlash = Math.max(0, battle.reflectFlash - dt * 3);
    if (battle.flash > 0) battle.flash = Math.max(0, battle.flash - dt * 2.8);

    if (battle.rhythmMode) {
      battle.beatTimer = Math.max(0, (battle.beatTimer || 0) - dt);
      if (battle.beatWindow > 0) battle.beatWindow = Math.max(0, battle.beatWindow - dt);
      if (battle.beatTimer <= 0) {
        battle.beatTimer = battle.beatInterval;
        battle.beat = (battle.beat || 0) + 1;
        battle.beatWindow = battle.beatWindowLength;
        battle.beatPulse = 1;
      }
      if (battle.beatPulse > 0) battle.beatPulse = Math.max(0, battle.beatPulse - dt * 3.4);
    }

    for (let i = battle.trail.length - 1; i >= 0; i -= 1) {
      battle.trail[i].life -= dt;
      if (battle.trail[i].life <= 0) battle.trail.splice(i, 1);
    }
    if (battle.dashTimer > 0 && rt.state && rt.state.player) {
      battle.trail.push({
        x: rt.state.player.x,
        y: rt.state.player.y,
        life: 0.32,
        max: 0.32
      });
      if (battle.trail.length > 90) battle.trail.shift();
    }

    refreshRoom(battle);
    updateEnemy(battle, dt);
    checkEnemyContact(battle);
    if (!rt.battle || !rt.battle.active) return;
    updateSlime(battle, dt);
    if (!rt.battle || !rt.battle.active) return;
    emitWave(dt);
    updateBullets(dt);
    if (!rt.battle || !rt.battle.active) return;

    if (battleComplete(battle)) {
      finishBattle('success');
      return;
    }

    if (battle.hintUntil && battle.elapsed > battle.hintUntil) {
      battle.hintUntil = 0;
      resetHint();
    }
    updateHud();
  }

  function dropRewardPickup(itemId, roomId) {
    if (!rt.world || !Array.isArray(rt.world.itemPickups)) return false;
    if (rt.world.itemPickups.some((pickup) => pickup.itemId === itemId)) return false;
    const room = roomId && rt.world.roomById ? rt.world.roomById(roomId) : null;
    let x = room ? room.centerX + 0.5 : rt.state.player.x;
    let y = room ? room.centerY + 0.5 : rt.state.player.y;
    if (!ZQ.canStandAt(x, y)) {
      let found = null;
      for (let radius = 1; radius <= 12 && !found; radius += 1) {
        for (let dy = -radius; dy <= radius && !found; dy += 1) {
          for (let dx = -radius; dx <= radius && !found; dx += 1) {
            const nx = Math.floor(x) + dx + 0.5;
            const ny = Math.floor(y) + dy + 0.5;
            if (ZQ.canStandAt(nx, ny)) found = { x: nx, y: ny };
          }
        }
      }
      if (found) {
        x = found.x;
        y = found.y;
      }
    }
    rt.world.itemPickups.push({
      itemId,
      x,
      y,
      roomId: roomId || null,
      dropped: true
    });
    rt.state.flags[`taken_${itemId}`] = false;
    return true;
  }

  function finishBattle(outcome) {
    const battle = rt.battle;
    if (!battle) return;
    const config = battleConfig();
    const kind = battle.kind || 'beetle';
    const roomId = battle.roomId || rt.state.currentRoomId || null;
    const roomCue = battle.roomCue ||
      (battle.room && battle.room.music) || 'labyrinth';
    battle.active = false;
    ZQ.resetKeys();
    hideBattleHud();
    rt.battle = null;

    /* Схватка шла на своём треке: возвращаем кассету комнаты и снова
       зацикливаем её. */
    if (ZQ.audio && typeof ZQ.audio.endBattleTrack === 'function') {
      ZQ.audio.endBattleTrack(roomCue);
    }

    if (outcome === 'success') {
      const flag = config.flag || `${kind}Done`;
      if (config.perRoom && roomId) {
        rt.state.flags[`${kind}_${roomId}`] = true;
      } else {
        rt.state.flags[flag] = true;
      }
      rt.state.flags[`${kind}Attempted`] = true;
      const rewardId = config.rewardItem;
      const reward = rewardId ? C.items[rewardId] : null;
      const floorReward = rewardId === 'umbrella';
      const added = rewardId && !floorReward
        ? ZQ.addInventoryItem(rewardId, { force: true })
        : { ok: false };
      if (floorReward && rewardId) {
        dropRewardPickup(rewardId, roomId);
      }
      ZQ.unlock('backpack', true);
      ZQ.ensureTerminalShare(0.46);
      ZQ.setTerminalView('main');
      ZQ.appendLog(t(
        'Вода стихает. Ты выжил — и снова становишься собой.',
        'The water falls still. You survived — and become yourself again.',
        'Das Wasser wird still. Du hast überlebt — und wirst wieder du selbst.'
      ), 'sys', true);
      if (floorReward && reward) {
        ZQ.appendLog(t(
          `На полу лежит «${reward.name}». Подойди и подбери его.`,
          `“${reward.name}” lies on the floor. Walk over and pick it up.`,
          `„${reward.name}“ liegt auf dem Boden. Geh hin und heb ihn auf.`
        ), 'sys', true);
      }
      if (added.ok && reward) {
        const bonus = Number.isFinite(reward.slotBonus)
          ? t(`: +${reward.slotBonus} ячеек`, `: +${reward.slotBonus} slots`, `: +${reward.slotBonus} Plätze`)
          : '';
        ZQ.appendLog(t(
          `На дне остаётся предмет «${reward.name}»${bonus}.`,
          `An item remains on the bottom: “${reward.name}”${bonus}.`,
          `Am Grund bleibt ein Gegenstand zurück: „${reward.name}“${bonus}.`
        ), 'sys', true);
      }
      if (config.successStory) {
        ZQ.queueStory(config.successStory, () => ZQ.updatePrompt());
      }
      ZQ.saveGame();
      ZQ.updatePrompt();
      return;
    }

    if (outcome === 'death') {
      ZQ.setTerminalView('main');
      ZQ.appendLog(t(
        'Вода смыкается над аксолотлем. Zemic просыпается у Скрижали.',
        'The water closes over the axolotl. Zemic wakes by the Tablet.',
        'Das Wasser schließt sich über dem Axolotl. Zemic erwacht an der Tafel.'
      ), 'sys', true);
      ZQ.die(config.deathCause || t('глубина', 'the deep', 'die Tiefe'));
      return;
    }

    rt.survivalBlockedRoom = rt.state.currentRoomId || null;
    ZQ.ensureTerminalShare(0.46);
    ZQ.setTerminalView('main');
    ZQ.appendLog(t(
      'Ты выбираешься из воды. Комната отпускает не сразу.',
      'You climb out of the water. The room does not let go at once.',
      'Du steigst aus dem Wasser. Der Raum lässt nicht sofort los.'
    ), 'sys', true);
    ZQ.appendLog(t(
      'Можно вернуться и попробовать снова.',
      'You can come back and try again.',
      'Du kannst zurückkehren und es erneut versuchen.'
    ), 'reply', true);
    ZQ.saveGame();
    ZQ.updatePrompt();
  }

  function showBattleHud() {
    if (dom.battleStage) dom.battleStage.classList.remove('hidden');
  }

  function hideBattleHud() {
    if (dom.battleStage) dom.battleStage.classList.add('hidden');
  }

  function startBattle(kind) {
    const encounters = (C.battle && C.battle.encounters) || {};
    if (!Object.prototype.hasOwnProperty.call(encounters, kind)) kind = 'beetle';
    if (!rt.state || rt.battle) return false;
    const config = configFor(kind);
    const flag = config.flag || `${kind}Done`;
    const roomId = rt.state.currentRoomId || null;
    const perRoomFlag = config.perRoom && roomId ? `${kind}_${roomId}` : '';
    if (!config.repeatable && rt.state.flags[flag]) return false;
    if (perRoomFlag && rt.state.flags[perRoomFlag]) return false;
    if (rt.trial) return false;
    if (rt.chase) return false;

    const genre = genreFor(config);
    const durationMode = config.durationMode || 'time';
    let survivalTime = Number.isFinite(config.survivalTime) ? config.survivalTime : 18;
    if (durationMode === 'track' && config.trackCue) {
      const trackLength = trackSeconds(config.trackCue);
      if (trackLength) {
        const rate = ZQ.audio && typeof ZQ.audio.rateForCue === 'function'
          ? ZQ.audio.rateForCue(config.trackCue)
          : 1;
        survivalTime = trackLength / (rate > 0 ? rate : 1);
      }
    }
    if (Number.isFinite(config.durationCap)) {
      survivalTime = Math.min(survivalTime, config.durationCap);
    }

    const rhythmMode = config.mode === 'rhythm';
    const bpm = Number.isFinite(config.bpm) ? config.bpm : 92;
    const beatInterval = 60 / Math.max(30, bpm);
    const beatWindowLength = Number.isFinite(config.beatWindow) ? config.beatWindow : 0.34;
    const player = rt.state.player;
    const room = rt.world && rt.world.roomAtTile
      ? rt.world.roomAtTile(Math.floor(player.x), Math.floor(player.y))
      : null;

    rt.state.flags[`${kind}Attempted`] = true;
    ZQ.resetKeys();

    rt.battle = {
      active: true,
      kind,
      roomId,
      room,
      world: rt.world,
      elapsed: 0,
      survivalTime,
      durationMode,
      durationCap: Number.isFinite(config.durationCap) ? config.durationCap : null,
      genre,
      waveScale: Number.isFinite(genre.waveScale) ? genre.waveScale : 1,
      energy: 0,
      enemy: null,
      player,
      playerRadius: Number.isFinite(config.playerRadius)
        ? config.playerRadius
        : (Number.isFinite(C.player && C.player.radius) ? C.player.radius : 0.34),
      playerSpeed: Number.isFinite(config.playerSpeed) ? config.playerSpeed : 4.9,
      dashSpeed: Number.isFinite(config.dashSpeed) ? config.dashSpeed : 12.5,
      playerHp: Number.isFinite(config.playerHp) ? config.playerHp : 6,
      playerMaxHp: Number.isFinite(config.playerHp) ? config.playerHp : 6,
      playerInvuln: 0.9,
      dashTimer: 0,
      dashCooldown: 0,
      dashVX: 0,
      dashVY: -1,
      dashFlash: 0,
      trail: [],
      bullets: [],
      /* Вязкие выстрелы жука: параметры берём из encounter. */
      stickyBullets: Boolean(config.stickyBullets),
      bulletStickDelay: Number.isFinite(config.bulletStickDelay) ? config.bulletStickDelay : 0.22,
      stickyBulletCap: Number.isFinite(config.stickyBulletCap) ? config.stickyBulletCap : 260,
      /* Зелёная жижа под жуком: держится до конца боя. */
      slime: [],
      slimeConfig: config.slime ? Object.assign({}, config.slime) : null,
      slimeTimer: 0,
      slimeCooldown: 0,
      playerSpeedScale: 1,
      bulletLife: Number.isFinite(config.bulletLife) ? config.bulletLife : 8,
      waveCooldown: 1.1,
      volley: 0,
      telegraph: 0,
      telegraphTotal: 0,
      hasUmbrella: hasUmbrella() || Boolean(config.borrowUmbrella),
      reflectTimer: 0,
      reflectCooldown: 0,
      reflectDuration: Number.isFinite(config.reflectDuration) ? config.reflectDuration : 1.1,
      reflectFlash: 0,
      flash: 0,
      hint: '',
      hintUntil: 0,
      rhythmMode,
      beatInterval,
      beatWindowLength,
      beatTimer: beatInterval,
      beatWindow: 0,
      beat: 0,
      beatPulse: 0,
      combo: 0
    };

    if (config.trackCue && ZQ.audio) {
      if (typeof ZQ.audio.startBattleTrack === 'function') {
        ZQ.audio.startBattleTrack(config.trackCue);
      } else {
        ZQ.audio.setCue(config.trackCue);
      }
    }

    const roomCue = (room && room.music) || 'labyrinth';
    rt.battle.roomCue = roomCue;
    if (config.enemy) spawnEnemy(rt.battle, config);

    ZQ.ensureTerminalShare(0.4);
    showBattleHud();
    ZQ.setTerminalView('main');
    updateHud();
    resetHint();
    if (config.intro) {
      ZQ.appendLog(config.intro, 'story', true, config.introSpeaker || 'ГЛУБИНА');
    }
    ZQ.logEvent('actions', t(
      `выживание: ${config.title || kind}`,
      `survival: ${config.title || kind}`,
      `Überleben: ${config.title || kind}`
    ), t('вода', 'water', 'Wasser'));
    ZQ.saveGame();
    return true;
  }

  /* Отрисовка поверх мира. Функция получает уже готовые координаты
     экрана, поэтому снаряды, зонт и след не расходятся с Zemic. */
  function drawBattleWorld(ctx, params) {
    const battle = rt.battle;
    if (!battle || !battle.active) return;
    const ts = params.ts;
    const player = rt.state.player;

    /* Зелёная жижа: стелется под ногами, держится до конца боя. */
    if (battle.slime && battle.slime.length) {
      const now = params.now || 0;
      ctx.save();
      for (const pool of battle.slime) {
        const px0 = params.toScreenX(pool.x);
        const py0 = params.toScreenY(pool.y);
        if (px0 < -ts * 3 || px0 > params.view.w + ts * 3 ||
            py0 < -ts * 3 || py0 > params.view.h + ts * 3) continue;
        const bubble = 0.5 + 0.5 * Math.sin(now * 0.003 + (pool.phase || 0));
        ctx.fillStyle = `rgba(96, 168, 62, ${0.42 + bubble * 0.12})`;
        ctx.beginPath();
        ctx.ellipse(px0, py0, ts * pool.r, ts * pool.r * 0.86, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = `rgba(160, 220, 96, ${0.35 + bubble * 0.25})`;
        ctx.beginPath();
        ctx.ellipse(
          px0 - ts * 0.12,
          py0 - ts * 0.1,
          ts * pool.r * 0.32,
          ts * pool.r * 0.26,
          0.4,
          0,
          Math.PI * 2
        );
        ctx.fill();
      }
      ctx.restore();
    }

    if (battle.trail.length) {
      for (const point of battle.trail) {
        const alpha = ZQ.clamp(point.life / (point.max || 0.32), 0, 1) * 0.32;
        ctx.fillStyle = `rgba(255, 188, 152, ${alpha})`;
        ctx.beginPath();
        ctx.arc(params.toScreenX(point.x), params.toScreenY(point.y), ts * 0.24, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    /* Вода вокруг аксолотля: тонкие кольца, а не отдельный кадр. */
    const px = params.toScreenX(player.x);
    const py = params.toScreenY(player.y);
    ctx.save();
    ctx.strokeStyle = `rgba(150, 220, 214, ${0.12 + (battle.beatPulse || 0) * 0.2})`;
    ctx.lineWidth = Math.max(1, ts * 0.06);
    ctx.beginPath();
    ctx.arc(px, py, ts * (0.7 + (1 - (battle.beatPulse || 0)) * 0.3), 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    if (battle.reflectTimer > 0) {
      const config = battleConfig();
      const radius = (Number.isFinite(config.reflectRadius) ? config.reflectRadius : 1.55) * ts;
      ctx.save();
      ctx.strokeStyle = `rgba(186, 236, 226, ${0.4 + battle.reflectFlash * 0.3})`;
      ctx.fillStyle = 'rgba(150, 214, 206, 0.10)';
      ctx.lineWidth = Math.max(1.5, ts * 0.09);
      ctx.beginPath();
      ctx.arc(px, py, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }

    for (const bullet of battle.bullets) {
      const bx = params.toScreenX(bullet.x);
      const by = params.toScreenY(bullet.y);
      const radius = Math.max(2, bullet.r * ts);
      ctx.save();
      if (bullet.stuck) {
        /* Прилипший снаряд — часть опасной стенки: он плотный, без
           пульсирующего ореола, но всё ещё светится по краю. */
        const tint = battle.kind === 'beetle' ? '118, 176, 74' : '138, 216, 220';
        ctx.fillStyle = `rgba(${tint}, 0.95)`;
        ctx.beginPath();
        ctx.ellipse(bx, by, radius * 1.05, radius * 0.9, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(226, 250, 214, 0.55)';
        ctx.lineWidth = Math.max(1, radius * 0.3);
        ctx.stroke();
        ctx.fillStyle = 'rgba(24, 34, 18, 0.55)';
        ctx.beginPath();
        ctx.arc(bx, by, radius * 0.42, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        continue;
      }
      const glow = ctx.createRadialGradient(bx, by, radius * 0.2, bx, by, radius * 2.6);
      const tint = bullet.reflected
        ? '236, 198, 118'
        : (battle.kind === 'belzebufo' ? '142, 210, 118' : '138, 216, 220');
      glow.addColorStop(0, `rgba(${tint}, 0.95)`);
      glow.addColorStop(0.45, `rgba(${tint}, 0.35)`);
      glow.addColorStop(1, `rgba(${tint}, 0)`);
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(bx, by, radius * 2.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = bullet.reflected ? '#ffe0a6' : '#d9fbf4';
      ctx.beginPath();
      ctx.arc(bx, by, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    /* Преследующий враг: рисуется поверх пола, под снарядами. */
    if (battle.enemy && window.Renderer) {
      const ex = params.toScreenX(battle.enemy.x);
      const ey = params.toScreenY(battle.enemy.y);

      /* Телеграф залпа: кольцо сжимается к врагу перед волной, чтобы
         игрок успел увидеть атаку и уйти. */
      if (battle.telegraph > 0) {
        const total = battle.telegraphTotal > 0 ? battle.telegraphTotal : 0.32;
        const k = 1 - ZQ.clamp(battle.telegraph / total, 0, 1);
        ctx.save();
        ctx.strokeStyle = `rgba(236, 92, 60, ${0.2 + k * 0.55})`;
        ctx.lineWidth = Math.max(1.5, ts * 0.08);
        ctx.beginPath();
        ctx.arc(ex, ey, ts * (1.7 - k * 0.9), 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = `rgba(236, 92, 60, ${0.1 + k * 0.18})`;
        ctx.beginPath();
        ctx.arc(ex, ey, ts * 0.62, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      /* Подкоп: пока жук в норе, видно только разлетающийся камень. */
      if (battle.enemy.digging) {
        const total = battle.enemy.dig && Number.isFinite(battle.enemy.dig.duration)
          ? battle.enemy.dig.duration
          : 0.8;
        const k = 1 - ZQ.clamp(battle.enemy.digTimer / total, 0, 1);
        ctx.save();
        ctx.fillStyle = 'rgba(24, 20, 14, 0.85)';
        ctx.beginPath();
        ctx.arc(ex, ey, ts * (0.2 + k * 0.5), 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = `rgba(120, 104, 74, ${0.5 - k * 0.3})`;
        ctx.lineWidth = Math.max(1, ts * 0.05);
        ctx.beginPath();
        ctx.arc(ex, ey, ts * (0.5 + k * 1.1), 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      } else {
        if (battle.enemy.tongue && battle.enemy.tongueState !== 'idle') {
          drawTongue(ctx, battle.enemy, ex, ey, ts, params);
        }
        drawEnemySprite(ctx, battle.enemy.kind, ex, ey, ts, params.now || 0, battle.enemy);
      }

      if (battle.enemy.flash > 0) {
        ctx.save();
        ctx.strokeStyle = `rgba(236, 92, 60, ${battle.enemy.flash * 0.7})`;
        ctx.lineWidth = Math.max(1.5, ts * 0.1);
        ctx.beginPath();
        ctx.arc(ex, ey, ts * 0.62, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
    }

    if (battle.flash > 0 && battle.playerInvuln > 0) {
      ctx.save();
      ctx.fillStyle = `rgba(190, 40, 24, ${battle.flash * 0.16})`;
      ctx.fillRect(0, 0, params.view.w, params.view.h);
      ctx.restore();
    }
  }

  function layoutBattle() {
    if (rt.battle && rt.battle.active) updateHud();
  }

  function resizeBattle() {
    layoutBattle();
  }

  if (dom.battleAbort) {
    dom.battleAbort.addEventListener('click', () => {
      if (!rt.battle || !rt.battle.active) return;
      finishBattle('abort');
    });
  }

  if (dom.battleDash) dom.battleDash.addEventListener('click', attemptDash);
  if (dom.battleDashTouch) dom.battleDashTouch.addEventListener('click', attemptDash);
  if (dom.battleReflect) dom.battleReflect.addEventListener('click', attemptReflect);
  if (dom.battleReflectTouch) dom.battleReflectTouch.addEventListener('click', attemptReflect);

  ZQ.resetBattleHint = resetHint;
  ZQ.layoutBattle = layoutBattle;
  ZQ.updateBattleHud = updateHud;
  ZQ.pushBattleHint = pushHint;
  ZQ.attemptDash = attemptDash;
  ZQ.attemptReflect = attemptReflect;
  ZQ.finishBattle = finishBattle;
  ZQ.showBattleStage = showBattleHud;
  ZQ.hideBattleStage = hideBattleHud;
  ZQ.startBattle = startBattle;
  ZQ.resizeBattle = resizeBattle;
  ZQ.updateBattle = updateBattle;
  ZQ.drawBattleWorld = drawBattleWorld;
})();
