/* Внезапное выживание: Zemic на время становится аксолотлем.
   Это не бой с противником и не требует согласия игрока: комната
   сама включает воду, а цель одна — продержаться до конца.
   Управление: движение, рывок и зонтик, который отводит снаряды. */
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

  function layoutBattle() {
    const battle = rt.battle;
    if (!battle) return null;
    const size = window.Renderer.makeCanvasSize(dom.battleCanvas);
    const config = battleConfig();
    const arenaW = Number.isFinite(config.arenaW) ? config.arenaW : 640;
    const arenaH = Number.isFinite(config.arenaH) ? config.arenaH : 400;
    battle.w = size.w;
    battle.h = size.h;
    battle.arenaW = arenaW;
    battle.arenaH = arenaH;
    battle.scale = Math.max(0.05, Math.min(size.w / arenaW, size.h / arenaH));
    battle.offsetX = (size.w - arenaW * battle.scale) / 2;
    battle.offsetY = (size.h - arenaH * battle.scale) / 2;
    return size;
  }

  function clampFighter(fighter, radius, battle) {
    fighter.x = ZQ.clamp(fighter.x, radius + 4, battle.arenaW - radius - 4);
    fighter.y = ZQ.clamp(fighter.y, radius + 4, battle.arenaH - radius - 4);
  }

  function survivalProgress(battle) {
    const duration = Number.isFinite(battle.survivalTime) ? battle.survivalTime : 1;
    return ZQ.clamp(battle.elapsed / Math.max(0.001, duration), 0, 1);
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
    if (dom.battleEnemyBar) {
      dom.battleEnemyBar.style.width = `${progress * 100}%`;
    }
    if (dom.battleReflectState) {
      let text = t('зонт: —', 'umbrella: —', 'Schirm: —');
      if (battle.hasUmbrella) {
        text = battle.reflectCooldown > 0
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
        battle.hasUmbrella && battle.reflectCooldown <= 0
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
      dom.battleReflect.disabled = !battle.hasUmbrella || battle.reflectCooldown > 0;
    }
    if (dom.battleReflectTouch) {
      dom.battleReflectTouch.disabled = !battle.hasUmbrella || battle.reflectCooldown > 0;
    }
    if (dom.battleDash) dom.battleDash.disabled = battle.dashCooldown > 0;
    if (dom.battleDashTouch) dom.battleDashTouch.disabled = battle.dashCooldown > 0;
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
        `Продержись ${seconds} секунд под водой.`,
        `Hold out for ${seconds} seconds underwater.`,
        `Halte ${seconds} Sekunden unter Wasser durch.`
      ),
      t(
        'Shift, ПРОБЕЛ или E — рывок.',
        'Shift, SPACE or E — dash.',
        'Shift, LEERTASTE oder E — Ausweichen.'
      )
    ];
    if (battle && battle.hasUmbrella) {
      parts.push(t(
        'F или кнопка «зонт» отводит снаряды (перезарядка 12 с).',
        'F or the umbrella button turns projectiles aside (12 s cooldown).',
        'F oder die Schirmtaste lenkt Geschosse ab (12 s Abklingzeit).'
      ));
    } else {
      parts.push(t(
        'Снаряды идут волнами: двигайся и ныряй в разрывы.',
        'Projectiles come in waves: move and slip through the gaps.',
        'Die Geschosse kommen in Wellen: bewege dich und gleite durch die Lücken.'
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
      dx = battle.player.facingX || 0;
      dy = battle.player.facingY || -1;
    }
    const length = Math.hypot(dx, dy) || 1;
    battle.dashVX = dx / length;
    battle.dashVY = dy / length;
    battle.player.facingX = battle.dashVX;
    battle.player.facingY = battle.dashVY;
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
    if (battle.reflectCooldown > 0) {
      pushHint(t(
        `Зонтик перезаряжается: ${Math.ceil(battle.reflectCooldown)} с.`,
        `The umbrella is recharging: ${Math.ceil(battle.reflectCooldown)} s.`,
        `Der Schirm lädt nach: ${Math.ceil(battle.reflectCooldown)} s.`
      ), 1.2);
      return false;
    }
    const config = battleConfig();
    battle.reflectDuration = Number.isFinite(config.reflectDuration) ? config.reflectDuration : 1.1;
    battle.reflectTimer = battle.reflectDuration;
    battle.reflectCooldown = Number.isFinite(config.reflectCooldown)
      ? config.reflectCooldown
      : 12;
    battle.reflectFlash = 1;
    pushHint(t(
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
      life: 7
    });
  }

  function edgePoint(pad) {
    const battle = rt.battle;
    const margin = pad || 18;
    const side = Math.floor(Math.random() * 4);
    if (side === 0) {
      return { x: margin + Math.random() * (battle.arenaW - margin * 2), y: margin };
    }
    if (side === 1) {
      return { x: battle.arenaW - margin, y: margin + Math.random() * (battle.arenaH - margin * 2) };
    }
    if (side === 2) {
      return { x: margin + Math.random() * (battle.arenaW - margin * 2), y: battle.arenaH - margin };
    }
    return { x: margin, y: margin + Math.random() * (battle.arenaH - margin * 2) };
  }

  function angleTo(battle, x, y) {
    return Math.atan2(battle.player.y - y, battle.player.x - x);
  }

  function aimedFan(battle, speed, radius, progress) {
    const config = battleConfig();
    const count = Math.max(2, Math.round(
      (Number.isFinite(config.waveCount) ? config.waveCount : 5) + progress * 2
    ));
    const spread = Number.isFinite(config.spread) ? config.spread : 0.5;
    const origin = edgePoint(20);
    const base = angleTo(battle, origin.x, origin.y);
    for (let i = 0; i < count; i++) {
      const t = count > 1 ? i / (count - 1) - 0.5 : 0;
      spawnBullet(battle, origin.x, origin.y, base + t * spread, speed, radius);
    }
  }

  function ringWave(battle, speed, radius, progress) {
    const config = battleConfig();
    const count = Math.round(
      (Number.isFinite(config.ringCount) ? config.ringCount : 16) + progress * 6
    );
    const cx = battle.arenaW / 2;
    const cy = battle.arenaH / 2;
    const gapAngle = Math.atan2(battle.player.y - cy, battle.player.x - cx);
    const offset = battle.volley * 0.23;
    const gap = 0.5;
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 + offset;
      let diff = Math.atan2(Math.sin(angle - gapAngle), Math.cos(angle - gapAngle));
      if (Math.abs(diff) < gap) continue;
      spawnBullet(
        battle,
        cx + Math.cos(angle) * 14,
        cy + Math.sin(angle) * 14,
        angle,
        speed * 0.92,
        radius
      );
    }
  }

  function spiralWave(battle, speed, radius) {
    const arms = 3;
    const base = battle.volley * 0.55;
    const cx = battle.arenaW / 2;
    const cy = battle.arenaH / 2;
    for (let arm = 0; arm < arms; arm++) {
      const angle = base + (arm / arms) * Math.PI * 2;
      spawnBullet(
        battle,
        cx + Math.cos(angle) * 12,
        cy + Math.sin(angle) * 12,
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
    const gapWidth = 62;
    const gapX = 70 + Math.random() * Math.max(1, battle.arenaW - 140);
    for (let i = 0; i < count; i++) {
      const x = 40 + (i / Math.max(1, count - 1)) * (battle.arenaW - 80);
      if (Math.abs(x - gapX) < gapWidth * 0.5) continue;
      const drift = (x - gapX) / battle.arenaW * 0.45;
      spawnBullet(battle, x, -12, Math.PI / 2 + drift, speed * 0.86, radius);
    }
  }

  function crossfireWave(battle, speed, radius) {
    const points = [
      { x: 24, y: battle.arenaH / 2 },
      { x: battle.arenaW - 24, y: battle.arenaH / 2 },
      { x: battle.arenaW / 2, y: 24 },
      { x: battle.arenaW / 2, y: battle.arenaH - 24 }
    ];
    for (const point of points) {
      const base = angleTo(battle, point.x, point.y);
      for (let i = -1; i <= 1; i++) {
        spawnBullet(battle, point.x, point.y, base + i * 0.14, speed * 0.9, radius);
      }
    }
  }

  function homingWave(battle, speed, radius, progress) {
    const count = 2 + Math.round(progress * 2);
    for (let i = 0; i < count; i++) {
      const origin = edgePoint(30);
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

    const speed = (Number.isFinite(config.waveSpeed) ? config.waveSpeed : 118) *
      (1 + progress * 0.32);
    const radius = Number.isFinite(config.bulletRadius) ? config.bulletRadius : 4.5;

    /* Волны чередуются, чтобы игрок читал рисунок и не стоял на месте. */
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
    if (!battle || !battle.active) return;
    const config = battleConfig();
    const playerRadius = battle.playerRadius;
    const reflectRadius = Number.isFinite(config.reflectRadius) ? config.reflectRadius : 48;
    const bullets = battle.bullets;

    for (let i = bullets.length - 1; i >= 0; i--) {
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

      if (bullet.life <= 0 ||
          bullet.x < -40 || bullet.x > battle.arenaW + 40 ||
          bullet.y < -40 || bullet.y > battle.arenaH + 40) {
        bullets.splice(i, 1);
        continue;
      }

      const pdx = bullet.x - battle.player.x;
      const pdy = bullet.y - battle.player.y;
      const playerDistance = Math.hypot(pdx, pdy);

      /* Раскрытый зонтик разворачивает снаряды в стороны. */
      if (!bullet.reflected && battle.reflectTimer > 0 &&
          playerDistance <= reflectRadius + bullet.r) {
        const speed = Math.max(60, Math.hypot(bullet.vx, bullet.vy) * 1.25);
        const angle = playerDistance > 0.001
          ? Math.atan2(pdy, pdx)
          : Math.atan2(bullet.vy, bullet.vx);
        bullet.vx = Math.cos(angle) * speed;
        bullet.vy = Math.sin(angle) * speed;
        bullet.reflected = true;
        bullet.homing = 0;
        bullet.life = 2.4;
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
    if (battle.playerInvuln > 0) battle.playerInvuln = Math.max(0, battle.playerInvuln - dt);
    if (battle.reflectTimer > 0) battle.reflectTimer = Math.max(0, battle.reflectTimer - dt);
    if (battle.reflectCooldown > 0) battle.reflectCooldown = Math.max(0, battle.reflectCooldown - dt);
    if (battle.dashFlash > 0) battle.dashFlash = Math.max(0, battle.dashFlash - dt * 4);
    if (battle.reflectFlash > 0) battle.reflectFlash = Math.max(0, battle.reflectFlash - dt * 3);
    if (battle.flash > 0) battle.flash = Math.max(0, battle.flash - dt * 2.8);

    for (let i = battle.trail.length - 1; i >= 0; i--) {
      battle.trail[i].life -= dt;
      if (battle.trail[i].life <= 0) battle.trail.splice(i, 1);
    }

    const config = battleConfig();
    const speed = Number.isFinite(config.playerSpeed) ? config.playerSpeed : 170;

    if (battle.dashTimer > 0) {
      battle.dashTimer = Math.max(0, battle.dashTimer - dt);
      const dashSpeed = Number.isFinite(config.dashSpeed) ? config.dashSpeed : 460;
      battle.player.x += battle.dashVX * dashSpeed * dt;
      battle.player.y += battle.dashVY * dashSpeed * dt;
      battle.player.facingX = battle.dashVX;
      battle.player.facingY = battle.dashVY;
      if (Math.random() < 0.75) {
        battle.trail.push({
          x: battle.player.x,
          y: battle.player.y,
          life: 0.32,
          max: 0.32
        });
      }
    } else {
      const input = inputVector();
      if (input.x || input.y) {
        battle.player.x += input.x * speed * dt;
        battle.player.y += input.y * speed * dt;
        battle.player.facingX = input.x;
        battle.player.facingY = input.y;
      }
    }
    clampFighter(battle.player, battle.playerRadius, battle);

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

  function drawWater(ctx, w, h, time) {
    const bg = ctx.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, '#0a262b');
    bg.addColorStop(0.52, '#061a1e');
    bg.addColorStop(1, '#03100f');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    ctx.save();
    ctx.strokeStyle = 'rgba(126, 211, 205, 0.09)';
    ctx.lineWidth = 1.4;
    for (let band = 0; band < 6; band++) {
      ctx.beginPath();
      const baseY = h * (0.16 + band * 0.14);
      for (let x = -20; x <= w + 20; x += 18) {
        const y = baseY +
          Math.sin(x * 0.018 + time * 0.0007 + band * 1.7) * (9 + band * 2) +
          Math.sin(x * 0.041 - time * 0.0011) * 4;
        if (x === -20) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    ctx.restore();

    /* Пузыри и пыль, поднимающиеся со дна. */
    for (let i = 0; i < 26; i++) {
      const x = ((i * 173) % 997) / 997 * w;
      const drift = Math.sin(time * 0.0009 + i) * 8;
      const y = h - ((time * 0.018 + i * 61) % (h + 50)) + 20;
      const radius = 1 + ((i * 7) % 5) * 0.7;
      ctx.fillStyle = `rgba(170, 235, 226, ${0.05 + (i % 4) * 0.02})`;
      ctx.beginPath();
      ctx.arc(x + drift, y, radius, 0, Math.PI * 2);
      ctx.fill();
    }

    const vignette = ctx.createRadialGradient(w / 2, h / 2, h * 0.2, w / 2, h / 2, Math.max(w, h) * 0.74);
    vignette.addColorStop(0, 'rgba(0, 0, 0, 0)');
    vignette.addColorStop(0.72, 'rgba(0, 8, 9, 0.24)');
    vignette.addColorStop(1, 'rgba(0, 4, 5, 0.72)');
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, w, h);
  }

  function drawAxolotl(ctx, x, y, radius, battle, time) {
    const angle = Math.atan2(battle.player.facingY || -1, battle.player.facingX || 0) + Math.PI / 2;
    const hurt = battle.playerInvuln > 0 &&
      battle.dashTimer <= 0 &&
      Math.floor(battle.elapsed * 14) % 2 === 0;
    const pulse = 0.5 + 0.5 * Math.sin(time * 0.004);

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);

    const glow = ctx.createRadialGradient(0, 0, radius * 0.2, 0, 0, radius * 3.2);
    glow.addColorStop(0, 'rgba(255, 176, 156, 0.3)');
    glow.addColorStop(1, 'rgba(255, 148, 128, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(0, 0, radius * 3.2, 0, Math.PI * 2);
    ctx.fill();

    /* Хвост. */
    ctx.fillStyle = hurt ? 'rgba(255, 132, 104, 0.9)' : 'rgba(238, 142, 128, 0.92)';
    ctx.beginPath();
    ctx.moveTo(0, radius * 0.62);
    ctx.quadraticCurveTo(radius * 0.62, radius * 1.36, 0, radius * 2.1);
    ctx.quadraticCurveTo(-radius * 0.62, radius * 1.36, 0, radius * 0.62);
    ctx.fill();

    /* Тело. */
    const body = ctx.createLinearGradient(0, -radius, 0, radius);
    body.addColorStop(0, hurt ? '#ffb49a' : '#ffad9b');
    body.addColorStop(0.55, hurt ? '#f08a78' : '#eb8c80');
    body.addColorStop(1, '#c9625f');
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.ellipse(0, 0, radius * 0.8, radius * 1.02, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = `rgba(255, 214, 198, ${0.35 + pulse * 0.25})`;
    ctx.lineWidth = Math.max(1, radius * 0.07);
    ctx.stroke();

    /* Голова. */
    ctx.fillStyle = hurt ? '#ffc1a8' : '#ffbca8';
    ctx.beginPath();
    ctx.ellipse(0, -radius * 0.62, radius * 0.72, radius * 0.6, 0, 0, Math.PI * 2);
    ctx.fill();

    /* Жабры: три перистые ветви с каждой стороны. */
    ctx.strokeStyle = hurt ? 'rgba(255, 160, 140, 0.95)' : 'rgba(255, 176, 158, 0.9)';
    ctx.lineWidth = Math.max(1.2, radius * 0.08);
    for (let side = -1; side <= 1; side += 2) {
      for (let i = 0; i < 3; i++) {
        const sy = -radius * (0.78 - i * 0.18);
        const sx = side * radius * 0.52;
        const ex = side * radius * (1.2 + i * 0.05);
        const ey = sy - radius * (0.28 - i * 0.12);
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.quadraticCurveTo(side * radius * 0.92, sy - radius * 0.12, ex, ey);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(side * radius * 0.86, sy - radius * 0.1);
        ctx.lineTo(side * radius * (0.98 + i * 0.04), sy + radius * (0.06 - i * 0.03));
        ctx.stroke();
      }
    }

    /* Глаза и улыбка. */
    ctx.fillStyle = '#25201f';
    ctx.beginPath();
    ctx.arc(-radius * 0.27, -radius * 0.72, radius * 0.1, 0, Math.PI * 2);
    ctx.arc(radius * 0.27, -radius * 0.72, radius * 0.1, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.beginPath();
    ctx.arc(-radius * 0.24, -radius * 0.75, radius * 0.035, 0, Math.PI * 2);
    ctx.arc(radius * 0.3, -radius * 0.75, radius * 0.035, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(90, 48, 46, 0.7)';
    ctx.lineWidth = Math.max(1, radius * 0.055);
    ctx.beginPath();
    ctx.arc(0, -radius * 0.46, radius * 0.18, 0.2, Math.PI - 0.2);
    ctx.stroke();

    ctx.restore();
  }

  function drawBullets(ctx, battle, sx, sy, scale) {
    for (const bullet of battle.bullets) {
      const bx = sx(bullet.x);
      const by = sy(bullet.y);
      const br = Math.max(2, bullet.r * scale);
      const glow = ctx.createRadialGradient(bx, by, br * 0.2, bx, by, br * 3);
      if (bullet.reflected) {
        glow.addColorStop(0, 'rgba(255, 242, 206, 0.95)');
        glow.addColorStop(0.42, 'rgba(245, 211, 146, 0.58)');
        glow.addColorStop(1, 'rgba(245, 211, 146, 0)');
      } else if (bullet.homing > 0) {
        glow.addColorStop(0, 'rgba(196, 244, 255, 0.95)');
        glow.addColorStop(0.42, 'rgba(96, 196, 214, 0.55)');
        glow.addColorStop(1, 'rgba(96, 196, 214, 0)');
      } else {
        glow.addColorStop(0, 'rgba(255, 196, 132, 0.95)');
        glow.addColorStop(0.42, 'rgba(236, 122, 58, 0.55)');
        glow.addColorStop(1, 'rgba(236, 122, 58, 0)');
      }
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(bx, by, br * 3, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = bullet.reflected
        ? '#fff1cf'
        : bullet.homing > 0 ? '#c8f4ff' : '#f0a45e';
      ctx.beginPath();
      ctx.arc(bx, by, br, 0, Math.PI * 2);
      ctx.fill();

      if (bullet.homing > 0) {
        ctx.strokeStyle = 'rgba(200, 244, 255, 0.75)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(bx, by, br * 1.7, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
  }

  function drawBattle(time) {
    const battle = rt.battle;
    const size = layoutBattle();
    if (!battle || !size) return;
    const ctx = size.ctx;
    const config = battleConfig();
    const w = size.w;
    const h = size.h;
    const scale = battle.scale;
    const sx = (x) => battle.offsetX + x * scale;
    const sy = (y) => battle.offsetY + y * scale;

    drawWater(ctx, w, h, time);

    const playerSx = sx(battle.player.x);
    const playerSy = sy(battle.player.y);
    const playerR = battle.playerRadius * scale;

    /* Остаток времени — тонкая дуга вокруг аксолотля. */
    const progress = survivalProgress(battle);
    ctx.save();
    ctx.strokeStyle = 'rgba(126, 211, 205, 0.16)';
    ctx.lineWidth = Math.max(2, scale * 2.2);
    ctx.beginPath();
    ctx.arc(playerSx, playerSy, playerR * 2.5, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = progress > 0.78
      ? `rgba(255, 148, 112, ${0.6 + 0.3 * Math.sin(time * 0.008)})`
      : 'rgba(140, 226, 214, 0.72)';
    ctx.beginPath();
    ctx.arc(
      playerSx,
      playerSy,
      playerR * 2.5,
      -Math.PI / 2,
      -Math.PI / 2 + Math.PI * 2 * (1 - progress)
    );
    ctx.stroke();
    ctx.restore();

    for (const point of battle.trail) {
      const px = sx(point.x);
      const py = sy(point.y);
      const alpha = point.life / point.max;
      ctx.fillStyle = `rgba(255, 176, 156, ${alpha * 0.24})`;
      ctx.beginPath();
      ctx.arc(px, py, playerR * (0.8 + alpha * 0.5), 0, Math.PI * 2);
      ctx.fill();
    }

    drawAxolotl(ctx, playerSx, playerSy, playerR, battle, time);
    drawBullets(ctx, battle, sx, sy, scale);

    /* Раскрытый зонтик: временное поле, отводящее снаряды. */
    if (battle.reflectTimer > 0) {
      const duration = battle.reflectDuration || 1.1;
      const reflectProgress = 1 - battle.reflectTimer / duration;
      const radius = (config.reflectRadius || 48) * scale * (0.72 + reflectProgress * 0.5);
      ctx.save();
      ctx.strokeStyle = `rgba(245, 211, 146, ${0.78 - reflectProgress * 0.36})`;
      ctx.lineWidth = Math.max(2, scale * 2.2);
      ctx.beginPath();
      ctx.arc(playerSx, playerSy, radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([5, 7]);
      ctx.strokeStyle = 'rgba(236, 224, 184, 0.42)';
      ctx.beginPath();
      ctx.arc(playerSx, playerSy, radius * 0.72, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    if (battle.flash > 0) {
      ctx.fillStyle = `rgba(214, 74, 58, ${battle.flash * 0.22})`;
      ctx.fillRect(0, 0, w, h);
    }
  }

  function battleLoop(time) {
    const battle = rt.battle;
    if (!battle || !battle.active) return;
    const dt = Math.min(0.05, (time - battle.lastT) / 1000 || 0);
    battle.lastT = time;
    if (dt > 0) updateBattle(dt);
    if (!rt.battle || !rt.battle.active) return;
    drawBattle(time);
    rt.battleRaf = window.requestAnimationFrame(battleLoop);
  }

  function finishBattle(outcome) {
    const battle = rt.battle;
    if (!battle) return;
    const config = battleConfig();
    const kind = battle.kind || 'beetle';
    battle.active = false;
    if (rt.battleRaf) {
      window.cancelAnimationFrame(rt.battleRaf);
      rt.battleRaf = 0;
    }
    ZQ.resetKeys();
    hideBattleStage();
    rt.battle = null;

    if (outcome === 'success') {
      const flag = config.flag || `${kind}Done`;
      rt.state.flags[flag] = true;
      rt.state.flags[`${kind}Attempted`] = true;
      const rewardId = config.rewardItem;
      const reward = rewardId ? C.items[rewardId] : null;
      const added = rewardId ? ZQ.addInventoryItem(rewardId, { force: true }) : { ok: false };
      ZQ.unlock('backpack', true);
      ZQ.ensureTerminalShare(0.46);
      ZQ.setTerminalView('main');
      ZQ.appendLog(t(
        'Вода стихает. Ты выжил — и снова становишься собой.',
        'The water falls still. You survived — and become yourself again.',
        'Das Wasser wird still. Du hast überlebt — und wirst wieder du selbst.'
      ), 'sys', true);
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

    /* Игрок сам выбрал выбраться. В комнату можно войти снова. */
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

  function showBattleStage() {
    if (dom.battleStage) dom.battleStage.classList.remove('hidden');
  }

  function hideBattleStage() {
    if (dom.battleStage) dom.battleStage.classList.add('hidden');
  }

  function startBattle(kind) {
    kind = kind === 'umbrella' ? 'umbrella' : 'beetle';
    if (!rt.state || rt.battle) return false;
    const config = configFor(kind);
    const flag = config.flag || `${kind}Done`;
    if (rt.state.flags[flag]) return false;
    if (rt.trial || rt.termView === 'trial') return false;

    rt.state.flags[`${kind}Attempted`] = true;
    ZQ.resetKeys();

    const arenaW = Number.isFinite(config.arenaW) ? config.arenaW : 640;
    const arenaH = Number.isFinite(config.arenaH) ? config.arenaH : 400;
    const playerRadius = Number.isFinite(config.playerRadius) ? config.playerRadius : 12;
    const playerHp = Number.isFinite(config.playerHp) ? config.playerHp : 6;
    const survivalTime = Number.isFinite(config.survivalTime) ? config.survivalTime : 18;

    rt.battle = {
      active: true,
      kind,
      elapsed: 0,
      lastT: ZQ.now(),
      w: 0,
      h: 0,
      arenaW,
      arenaH,
      scale: 1,
      offsetX: 0,
      offsetY: 0,
      survivalTime,
      player: {
        x: arenaW / 2,
        y: arenaH * 0.74,
        facingX: 0,
        facingY: -1
      },
      playerRadius,
      playerHp,
      playerMaxHp: playerHp,
      playerInvuln: 0.9,
      dashTimer: 0,
      dashCooldown: 0,
      dashVX: 0,
      dashVY: -1,
      dashFlash: 0,
      trail: [],
      bullets: [],
      waveCooldown: 1.1,
      volley: 0,
      hasUmbrella: hasUmbrella(),
      reflectTimer: 0,
      reflectCooldown: 0,
      reflectDuration: Number.isFinite(config.reflectDuration) ? config.reflectDuration : 1.1,
      reflectFlash: 0,
      flash: 0,
      hint: '',
      hintUntil: 0
    };

    ZQ.ensureTerminalShare(0.4);
    showBattleStage();
    ZQ.setTerminalView('battle');
    updateHud();
    resetHint();
    layoutBattle();
    if (config.intro) {
      ZQ.appendLog(config.intro, 'story', true, config.introSpeaker || 'ГЛУБИНА');
    }
    ZQ.logEvent('actions', t(
      `выживание: ${config.title || kind}`,
      `survival: ${config.title || kind}`,
      `Überleben: ${config.title || kind}`
    ), t('вода', 'water', 'Wasser'));
    ZQ.saveGame();
    rt.battleRaf = window.requestAnimationFrame(battleLoop);
    return true;
  }

  function resizeBattle() {
    if (!rt.battle || !rt.battle.active) return;
    layoutBattle();
  }

  dom.battleAbort.addEventListener('click', () => {
    if (!rt.battle || !rt.battle.active) return;
    finishBattle('abort');
  });

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
  ZQ.showBattleStage = showBattleStage;
  ZQ.hideBattleStage = hideBattleStage;
  ZQ.startBattle = startBattle;
  ZQ.resizeBattle = resizeBattle;
})();
