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
    const left = Math.max(0, battle.survivalTime - battle.elapsed);
    const progress = survivalProgress(battle);

    if (dom.battlePlayerHp) dom.battlePlayerHp.textContent = String(playerHp);
    if (dom.battleBeetleHp) dom.battleBeetleHp.textContent = String(Math.ceil(left));
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
      dom.battleDashState.textContent = battle.dashCooldown > 0
        ? t(
          `рывок: ${Math.ceil(battle.dashCooldown)} с`,
          `dash: ${Math.ceil(battle.dashCooldown)} s`,
          `Ausweichen: ${Math.ceil(battle.dashCooldown)} s`
        )
        : t('рывок: готов', 'dash: ready', 'Ausweichen: bereit');
      dom.battleDashState.classList.toggle('ready', battle.dashCooldown <= 0);
    }
    if (dom.battleReflect) {
      dom.battleReflect.disabled = !battle.hasUmbrella ||
        (battle.reflectCooldown > 0 && !battle.rhythmMode);
    }
    if (dom.battleReflectTouch) {
      dom.battleReflectTouch.disabled = !battle.hasUmbrella ||
        (battle.reflectCooldown > 0 && !battle.rhythmMode);
    }
    if (dom.battleDash) dom.battleDash.disabled = battle.dashCooldown > 0;
    if (dom.battleDashTouch) dom.battleDashTouch.disabled = battle.dashCooldown > 0;

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
    const seconds = Math.round(battle ? battle.survivalTime : config.survivalTime || 18);
    const parts = [
      t(
        `Продержись ${seconds} секунд. Снаряды идут по настоящему Лабиринту.`,
        `Hold out for ${seconds} seconds. Projectiles move through the real labyrinth.`,
        `Halte ${seconds} Sekunden durch. Die Geschosse fliegen durch das echte Labyrinth.`
      ),
      t(
        'Shift, ПРОБЕЛ или E — рывок.',
        'Shift, SPACE or E — dash.',
        'Shift, LEERTASTE oder E — Ausweichen.'
      )
    ];
    if (battle && battle.rhythmMode) {
      parts.push(t(
        'Жми F или «зонт» в долю: попадание в ритм продлевает зонт и копит комбо.',
        'Press F or the umbrella button on the beat: timing extends the umbrella and builds combo.',
        'Drücke F oder die Schirmtaste im Takt: Timing verlängert den Schirm und baut Combo auf.'
      ));
    } else if (battle && battle.hasUmbrella) {
      parts.push(t(
        'F или кнопка «зонт» отводит снаряды (перезарядка 12 с).',
        'F or the umbrella button turns projectiles aside (12 s cooldown).',
        'F oder die Schirmtaste lenkt Geschosse ab (12 s Abklingzeit).'
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
    battle.bullets.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      r: radius,
      reflected: false,
      homing: Number.isFinite(homing) ? homing : 0,
      life: battle.bulletLife
    });
  }

  /* Точка появления выбирается на полу текущего зала: снаряд не
     возникает внутри стены и не гаснет в первом же кадре. */
  function pickSpawn(battle, minDist) {
    const player = rt.state.player;
    const room = battle.room;
    const min = Number.isFinite(minDist) ? minDist : 4;
    for (let i = 0; i < 48; i += 1) {
      let x;
      let y;
      if (room) {
        x = room.ox + 0.5 + Math.random() * Math.max(0.5, room.w - 1);
        y = room.oy + 0.5 + Math.random() * Math.max(0.5, room.h - 1);
      } else {
        const angle = Math.random() * Math.PI * 2;
        const distance = min + Math.random() * 3;
        x = player.x + Math.cos(angle) * distance;
        y = player.y + Math.sin(angle) * distance;
      }
      if (Math.hypot(x - player.x, y - player.y) < min) continue;
      if (!rt.world || !rt.world.isWalkable(Math.floor(x), Math.floor(y))) continue;
      return { x, y };
    }
    const angle = Math.random() * Math.PI * 2;
    return {
      x: player.x + Math.cos(angle) * min,
      y: player.y + Math.sin(angle) * min
    };
  }

  function angleTo(battle, x, y) {
    return Math.atan2(battle.player.y - y, battle.player.x - x);
  }

  function roomCenter(battle) {
    const room = battle.room;
    if (room) return { x: room.centerX + 0.5, y: room.centerY + 0.5 };
    return { x: rt.state.player.x, y: rt.state.player.y };
  }

  function aimedFan(battle, speed, radius, progress) {
    const config = battleConfig();
    const count = Math.max(2, Math.round(
      (Number.isFinite(config.waveCount) ? config.waveCount : 5) + progress * 2
    ));
    const spread = Number.isFinite(config.spread) ? config.spread : 0.5;
    const origin = pickSpawn(battle, Number.isFinite(config.spawnDistance) ? config.spawnDistance : 6);
    const base = angleTo(battle, origin.x, origin.y);
    for (let i = 0; i < count; i += 1) {
      const part = count > 1 ? i / (count - 1) - 0.5 : 0;
      spawnBullet(battle, origin.x, origin.y, base + part * spread, speed, radius);
    }
  }

  function ringWave(battle, speed, radius, progress) {
    const config = battleConfig();
    const count = Math.round(
      (Number.isFinite(config.ringCount) ? config.ringCount : 16) + progress * 6
    );
    const center = roomCenter(battle);
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

  function rainWave(battle, speed, radius, progress) {
    const config = battleConfig();
    const count = Math.max(4, Math.round(
      (Number.isFinite(config.waveCount) ? config.waveCount : 5) + 3 + progress * 4
    ));
    const room = battle.room;
    const player = rt.state.player;
    const span = room ? Math.max(4, room.w - 2) : 9;
    const startX = room ? room.ox + 1 : player.x - span / 2;
    const topY = room ? room.oy + 1 : player.y - 6;
    const gapX = player.x + (Math.random() - 0.5) * 1.6;
    const gapWidth = 1.6;
    for (let i = 0; i < count; i += 1) {
      const x = startX + (i / Math.max(1, count - 1)) * span;
      if (Math.abs(x - gapX) < gapWidth * 0.5) continue;
      if (!rt.world.isWalkable(Math.floor(x), Math.floor(topY))) continue;
      const drift = (x - gapX) / Math.max(1, span) * 0.35;
      spawnBullet(battle, x, topY, Math.PI / 2 + drift, speed * 0.86, radius);
    }
  }

  function crossfireWave(battle, speed, radius) {
    const player = rt.state.player;
    const distance = 5.5;
    const points = [
      { x: player.x, y: player.y - distance },
      { x: player.x, y: player.y + distance },
      { x: player.x - distance, y: player.y },
      { x: player.x + distance, y: player.y }
    ];
    for (const point of points) {
      if (!rt.world.isWalkable(Math.floor(point.x), Math.floor(point.y))) continue;
      const base = angleTo(battle, point.x, point.y);
      for (let i = -1; i <= 1; i += 1) {
        spawnBullet(battle, point.x, point.y, base + i * 0.14, speed * 0.9, radius);
      }
    }
  }

  function homingWave(battle, speed, radius, progress) {
    const count = 2 + Math.round(progress * 2);
    for (let i = 0; i < count; i += 1) {
      const origin = pickSpawn(battle, 6.5);
      const base = angleTo(battle, origin.x, origin.y);
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

  function emitWave(dt) {
    const battle = rt.battle;
    if (!battle || !battle.active) return;
    const config = battleConfig();
    battle.waveCooldown -= dt;
    if (battle.waveCooldown > 0) return;

    const progress = survivalProgress(battle);
    const baseInterval = Number.isFinite(config.waveInterval) ? config.waveInterval : 1.6;
    battle.waveCooldown = Math.max(0.5, baseInterval * (1 - progress * 0.42));
    battle.volley += 1;

    const speed = (Number.isFinite(config.waveSpeed) ? config.waveSpeed : 3.4) *
      (1 + progress * 0.32);
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

  function updateBullets(dt) {
    const battle = rt.battle;
    if (!battle || !battle.active || !rt.world) return;
    const config = battleConfig();
    const playerRadius = Number.isFinite(battle.playerRadius)
      ? battle.playerRadius
      : (Number.isFinite(C.battle && C.battle.playerRadius) ? C.battle.playerRadius : 0.34);
    const reflectRadius = Number.isFinite(config.reflectRadius) ? config.reflectRadius : 1.55;
    const bullets = battle.bullets;

    for (let i = bullets.length - 1; i >= 0; i -= 1) {
      const bullet = bullets[i];

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

      bullet.x += bullet.vx * dt;
      bullet.y += bullet.vy * dt;
      bullet.life -= dt;

      /* Снаряд гаснет о стены настоящего Лабиринта. */
      const tileX = Math.floor(bullet.x);
      const tileY = Math.floor(bullet.y);
      if (bullet.life <= 0 || !rt.world.isWalkable(tileX, tileY)) {
        bullets.splice(i, 1);
        continue;
      }

      const pdx = bullet.x - battle.player.x;
      const pdy = bullet.y - battle.player.y;
      const playerDistance = Math.hypot(pdx, pdy);

      if (!bullet.reflected && battle.reflectTimer > 0 &&
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
        bullets.splice(i, 1);
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
    emitWave(dt);
    updateBullets(dt);
    if (!rt.battle || !rt.battle.active) return;

    if (battle.elapsed >= battle.survivalTime) {
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
    battle.active = false;
    ZQ.resetKeys();
    hideBattleHud();
    rt.battle = null;

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
      survivalTime: Number.isFinite(config.survivalTime) ? config.survivalTime : 18,
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
      bulletLife: Number.isFinite(config.bulletLife) ? config.bulletLife : 8,
      waveCooldown: 1.1,
      volley: 0,
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

    if (config.trackCue && ZQ.audio) ZQ.audio.setCue(config.trackCue);

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
