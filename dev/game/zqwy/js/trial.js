/* Испытание Круга Очарования. */
(function () {
  'use strict';

  const ZQ = window.ZQ;
  const C = ZQ.C;
  const rt = ZQ.rt;
  const dom = ZQ.dom;

  function resetTrialHint() {
    dom.trialHint.textContent = 'Двигайся. Печать закроется — нажми ПРОБЕЛ.';
  }

  function layoutTrial() {
    if (!rt.trial) return null;
    const size = window.Renderer.makeCanvasSize(dom.trialCanvas);
    rt.trial.w = size.w;
    rt.trial.h = size.h;
    rt.trial.center.x = size.w / 2;
    rt.trial.center.y = size.h / 2;
    rt.trial.radius = Math.min(size.w, size.h) * 0.44;
    return size;
  }

  function updateTrialHud() {
    const trial = rt.trial;
    if (!trial) return;
    dom.trialSeals.textContent = `${trial.sealsClosed} / ${C.trial.sealsRequired}`;
    dom.trialSparks.textContent = String(trial.sparksLeft);
    dom.trialTime.textContent = Math.max(0, C.trial.duration - trial.elapsed).toFixed(1);
  }

  function pushTrialHint(text) {
    if (!rt.trial) return;
    rt.trial.hint = text;
    rt.trial.hintUntil = rt.trial.elapsed + 1.8;
    dom.trialHint.textContent = text;
  }

  function spawnSpark() {
    const trial = rt.trial;
    const angle = Math.random() * Math.PI * 2;
    const edge = {
      x: trial.center.x + Math.cos(angle) * trial.radius * 0.98,
      y: trial.center.y + Math.sin(angle) * trial.radius * 0.98
    };
    const aim = Math.atan2(
      trial.player.y - edge.y,
      trial.player.x - edge.x
    ) + (Math.random() - 0.5) * 0.42;
    const speed = 118 + Math.random() * 56 + trial.elapsed * 1.6;
    trial.projectiles.push({
      x: edge.x,
      y: edge.y,
      vx: Math.cos(aim) * speed,
      vy: Math.sin(aim) * speed,
      r: 3.2 + Math.random() * 1.5,
      life: 7
    });
  }

  function spawnBurst() {
    const trial = rt.trial;
    const count = 9;
    const offset = Math.random() * Math.PI * 2;
    for (let i = 0; i < count; i++) {
      const angle = offset + (i / count) * Math.PI * 2;
      const speed = 106 + Math.random() * 22;
      trial.projectiles.push({
        x: trial.center.x,
        y: trial.center.y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        r: 3.4,
        life: 6
      });
    }
    pushTrialHint('Круг выдохнул искры. Не стой на месте.');
  }

  function spawnSeal() {
    const trial = rt.trial;
    const angle = Math.random() * Math.PI * 2;
    const distance = trial.radius * 0.58 * Math.sqrt(Math.random());
    trial.activeSeal = {
      x: trial.center.x + Math.cos(angle) * distance,
      y: trial.center.y + Math.sin(angle) * distance,
      r: Math.max(24, trial.radius * 0.14),
      until: trial.elapsed + C.trial.sealWindow,
      born: trial.elapsed
    };
    pushTrialHint('Печать проступила. Встань в неё и нажми ПРОБЕЛ.');
  }

  function clampTrialPlayer() {
    const trial = rt.trial;
    if (!trial) return;
    const dx = trial.player.x - trial.center.x;
    const dy = trial.player.y - trial.center.y;
    const distance = Math.hypot(dx, dy);
    const limit = trial.radius - trial.playerRadius;
    if (distance > limit && distance > 0.001) {
      trial.player.x = trial.center.x + (dx / distance) * limit;
      trial.player.y = trial.center.y + (dy / distance) * limit;
    }
  }

  function finishTrial(outcome) {
    const trial = rt.trial;
    if (!trial) return;
    trial.active = false;
    if (rt.trialRaf) {
      window.cancelAnimationFrame(rt.trialRaf);
      rt.trialRaf = 0;
    }
    ZQ.resetKeys();

    if (outcome === 'death') {
      hideTrialStage();
      rt.trial = null;
      ZQ.die('spark');
      return;
    }

    if (outcome === 'success') {
      rt.state.flags.trialDone = true;
      rt.state.flags.trialAttempted = true;
      ZQ.saveGame();
      hideTrialStage();
      const closed = trial.sealsClosed;
      rt.trial = null;
      ZQ.ensureTerminalShare(0.46);
      ZQ.setTerminalView('main');
      ZQ.appendLog(
        `Печатей закрыто: ${closed}. Круг принял. В центре проступает карта.`,
        'sys',
        true
      );
      ZQ.queueStory('trialSuccess', () => {
        ZQ.appendLog('В центре круга лежит карта', 'sys', true);
        ZQ.updatePrompt();
      });
      ZQ.saveGame();
      ZQ.updatePrompt();
      return;
    }

    if (outcome === 'fail') {
      rt.state.flags.trialAttempted = true;
      ZQ.saveGame();
      hideTrialStage();
      const closed = trial.sealsClosed;
      rt.trial = null;
      ZQ.ensureTerminalShare(0.46);
      ZQ.setTerminalView('main');
      ZQ.appendLog(
        `Печатей закрыто: ${closed}. Нужно не меньше ${C.trial.sealsRequired}. Круг не принял, но можно войти снова — ничего не потеряно.`,
        'sys',
        true
      );
      ZQ.updatePrompt();
      return;
    }

    hideTrialStage();
    rt.trial = null;
    ZQ.setTerminalView('main');
    ZQ.appendLog('Круг остыл. Можно войти снова', 'sys', true);
    ZQ.appendLog('Ты покидаешь круг. Печати гаснут, но остаются на месте.', 'reply', true);
    ZQ.updatePrompt();
    ZQ.saveGame();
  }

  function showTrialStage() {
    dom.trialStage.classList.remove('hidden');
  }

  function hideTrialStage() {
    if (dom.trialStage) dom.trialStage.classList.add('hidden');
  }

  function attemptSeal() {
    const trial = rt.trial;
    if (!trial || !trial.active) return;
    if (!trial.activeSeal) {
      pushTrialHint('Печать ещё не проступила. Жди и двигайся.');
      return;
    }
    const seal = trial.activeSeal;
    const distance = Math.hypot(trial.player.x - seal.x, trial.player.y - seal.y);
    if (distance <= seal.r + trial.playerRadius) {
      trial.sealsClosed++;
      trial.activeSeal = null;
      trial.sealFlash = 1;
      if (trial.sealsClosed >= C.trial.sealsRequired) {
        pushTrialHint('Печати сомкнуты. Додержись до конца круга.');
      } else {
        pushTrialHint(`Печать закрыта (${trial.sealsClosed} / ${C.trial.sealsRequired}).`);
      }
      updateTrialHud();
    } else {
      pushTrialHint('Ты не внутри печати.');
    }
  }

  function updateTrial(dt) {
    const trial = rt.trial;
    if (!trial) return;
    const config = C.trial;
    trial.elapsed += dt;

    if (trial.nextSeal < config.sealTimes.length &&
        trial.elapsed >= config.sealTimes[trial.nextSeal]) {
      trial.nextSeal++;
      spawnSeal();
    }

    if (trial.activeSeal && trial.elapsed > trial.activeSeal.until) {
      trial.activeSeal = null;
      pushTrialHint('Печать погасла. Следующая будет позже.');
    }

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
      const speed = Math.min(trial.w, trial.h) * 0.46;
      trial.player.x += mx * speed * dt;
      trial.player.y += my * speed * dt;
      trial.facingX = mx;
      trial.facingY = my;
      clampTrialPlayer();
    }

    trial.spawnTimer -= dt;
    if (trial.spawnTimer <= 0) {
      spawnSpark();
      trial.spawnTimer = Math.max(0.24, 0.58 - trial.elapsed * 0.007);
    }

    trial.burstTimer -= dt;
    if (trial.burstTimer <= 0) {
      spawnBurst();
      trial.burstTimer = 6.7;
    }

    if (trial.invuln > 0) trial.invuln -= dt;
    if (trial.flash > 0) trial.flash = Math.max(0, trial.flash - dt * 2.6);
    if (trial.sealFlash > 0) trial.sealFlash = Math.max(0, trial.sealFlash - dt * 2.2);

    for (let i = trial.projectiles.length - 1; i >= 0; i--) {
      const spark = trial.projectiles[i];
      spark.x += spark.vx * dt;
      spark.y += spark.vy * dt;
      spark.life -= dt;
      const outside = spark.x < -80 || spark.x > trial.w + 80 ||
        spark.y < -80 || spark.y > trial.h + 80;
      if (spark.life <= 0 || outside) {
        trial.projectiles.splice(i, 1);
        continue;
      }
      if (trial.invuln <= 0) {
        const dx = trial.player.x - spark.x;
        const dy = trial.player.y - spark.y;
        const hit = trial.playerRadius + spark.r;
        if (dx * dx + dy * dy <= hit * hit) {
          trial.projectiles.splice(i, 1);
          trial.sparksLeft--;
          trial.invuln = 1.05;
          trial.flash = 1;
          pushTrialHint('Искра обожгла. Осталось искр: ' + trial.sparksLeft + '.');
          updateTrialHud();
          if (trial.sparksLeft <= 0) {
            finishTrial('death');
            return;
          }
        }
      }
    }

    if (trial.elapsed >= config.duration) {
      if (trial.sealsClosed >= config.sealsRequired) finishTrial('success');
      else finishTrial('fail');
      return;
    }

    if (trial.hintUntil && trial.elapsed > trial.hintUntil) {
      trial.hintUntil = 0;
      if (trial.sealsClosed >= config.sealsRequired) {
        dom.trialHint.textContent = 'Круг принял печати. Додержись.';
      } else if (trial.activeSeal) {
        dom.trialHint.textContent = 'Встань в печать и нажми ПРОБЕЛ.';
      } else {
        dom.trialHint.textContent = 'Двигайся. Печать закроется — нажми ПРОБЕЛ.';
      }
    }

    updateTrialHud();
  }

  function drawTrial(time) {
    const trial = rt.trial;
    const size = layoutTrial();
    if (!trial || !size) return;
    clampTrialPlayer();
    const ctx = size.ctx;
    const w = trial.w;
    const h = trial.h;
    const cx = trial.center.x;
    const cy = trial.center.y;
    const radius = trial.radius;

    ctx.clearRect(0, 0, w, h);
    const background = ctx.createRadialGradient(cx, cy, radius * 0.12, cx, cy, Math.max(w, h) * 0.76);
    background.addColorStop(0, '#121515');
    background.addColorStop(0.65, '#080b0c');
    background.addColorStop(1, '#040506');
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, w, h);

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(time * 0.00008);
    for (let i = 0; i < 3; i++) {
      ctx.strokeStyle = `rgba(199, 111, 57, ${0.14 + i * 0.035})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(0, 0, radius * (0.42 + i * 0.27), 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(199, 111, 57, 0.24)';
    for (let i = 0; i < 18; i++) {
      ctx.rotate(Math.PI / 9);
      ctx.beginPath();
      ctx.moveTo(radius * 0.68, 0);
      ctx.lineTo(radius * 0.76, 0);
      ctx.stroke();
    }
    ctx.restore();

    ctx.save();
    ctx.strokeStyle = 'rgba(220, 128, 70, 0.3)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([3, 9]);
    ctx.beginPath();
    ctx.arc(cx, cy, radius - 8, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();

    if (trial.activeSeal) {
      const seal = trial.activeSeal;
      const pulse = 0.5 + 0.5 * Math.sin(time * 0.008);
      const inside = Math.hypot(trial.player.x - seal.x, trial.player.y - seal.y) <= seal.r + trial.playerRadius;
      const fill = ctx.createRadialGradient(seal.x, seal.y, 1, seal.x, seal.y, seal.r);
      fill.addColorStop(0, inside ? 'rgba(235, 182, 118, 0.34)' : 'rgba(208, 118, 60, 0.16)');
      fill.addColorStop(1, 'rgba(208, 118, 60, 0)');
      ctx.fillStyle = fill;
      ctx.beginPath();
      ctx.arc(seal.x, seal.y, seal.r, 0, Math.PI * 2);
      ctx.fill();

      ctx.save();
      ctx.strokeStyle = inside ? '#f1c997' : `rgba(229, 161, 104, ${0.45 + pulse * 0.35})`;
      ctx.lineWidth = inside ? 2.5 : 1.6;
      ctx.beginPath();
      ctx.arc(seal.x, seal.y, seal.r * (0.82 + pulse * 0.1), 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([2, 6]);
      ctx.beginPath();
      ctx.arc(seal.x, seal.y, seal.r * 1.18, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    }

    for (const spark of trial.projectiles) {
      ctx.save();
      ctx.shadowColor = 'rgba(235, 130, 64, 0.9)';
      ctx.shadowBlur = 12;
      const speed = Math.hypot(spark.vx, spark.vy) || 1;
      const tx = spark.x - (spark.vx / speed) * 11;
      const ty = spark.y - (spark.vy / speed) * 11;
      const trail = ctx.createLinearGradient(tx, ty, spark.x, spark.y);
      trail.addColorStop(0, 'rgba(208, 118, 60, 0)');
      trail.addColorStop(1, 'rgba(240, 165, 98, 0.8)');
      ctx.strokeStyle = trail;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(tx, ty);
      ctx.lineTo(spark.x, spark.y);
      ctx.stroke();
      ctx.fillStyle = '#f2b271';
      ctx.beginPath();
      ctx.arc(spark.x, spark.y, spark.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fff0d0';
      ctx.beginPath();
      ctx.arc(spark.x - spark.r * 0.3, spark.y - spark.r * 0.3, spark.r * 0.36, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    const playerGlow = ctx.createRadialGradient(
      trial.player.x, trial.player.y, 1,
      trial.player.x, trial.player.y, trial.playerRadius * 3
    );
    playerGlow.addColorStop(0, 'rgba(236, 239, 225, 0.3)');
    playerGlow.addColorStop(1, 'rgba(236, 239, 225, 0)');
    ctx.fillStyle = playerGlow;
    ctx.beginPath();
    ctx.arc(trial.player.x, trial.player.y, trial.playerRadius * 3, 0, Math.PI * 2);
    ctx.fill();

    ctx.save();
    ctx.strokeStyle = trial.invuln > 0 ? 'rgba(237, 178, 116, 0.9)' : 'rgba(240, 240, 225, 0.9)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(trial.player.x, trial.player.y, trial.playerRadius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = trial.invuln > 0 ? 'rgba(233, 170, 107, 0.23)' : 'rgba(236, 239, 225, 0.15)';
    ctx.fill();
    ctx.restore();

    if (trial.flash > 0) {
      const damage = Math.min(1, trial.flash);
      ctx.fillStyle = `rgba(208, 74, 38, ${damage * 0.24})`;
      ctx.fillRect(0, 0, w, h);
      // Same ZEMIC damage effect as in battles, scaled to the trial arena.
      if (typeof ZQ.drawDamageFx === 'function') {
        ZQ.drawDamageFx(ctx, {
          x: trial.player.x,
          y: trial.player.y,
          radius: trial.playerRadius * 2.2,
          flash: damage,
          w,
          h,
          now: ZQ.now(),
          seed: 19
        });
      }
    }
    if (trial.sealFlash > 0) {
      ctx.fillStyle = `rgba(235, 200, 148, ${trial.sealFlash * 0.13})`;
      ctx.fillRect(0, 0, w, h);
    }
  }

  function trialLoop(time) {
    const trial = rt.trial;
    if (!trial || !trial.active) return;
    const dt = Math.min(0.05, (time - trial.lastT) / 1000 || 0);
    trial.lastT = time;
    if (dt > 0) updateTrial(dt);
    if (!rt.trial || !rt.trial.active) return;
    drawTrial(time);
    rt.trialRaf = window.requestAnimationFrame(trialLoop);
  }

  function startTrial() {
    if (!rt.state) return;
    if (rt.state.flags.trialDone) return;
    if (rt.trial && rt.trial.active) return;
    if (ZQ.isTrialBlocking()) return;
    rt.state.flags.trialAttempted = true;
    ZQ.resetKeys();

    rt.trial = {
      active: true,
      elapsed: 0,
      lastT: ZQ.now(),
      w: 0,
      h: 0,
      center: { x: 0, y: 0 },
      radius: 200,
      player: { x: 0, y: 0, facingX: 0, facingY: -1 },
      playerRadius: 9,
      sparksLeft: C.trial.sparks,
      sealsClosed: 0,
      activeSeal: null,
      nextSeal: 0,
      projectiles: [],
      spawnTimer: 0.7,
      burstTimer: 6.5,
      invuln: 0.8,
      flash: 0,
      sealFlash: 0,
      hint: '',
      hintUntil: 0,
      resultKind: null
    };

    ZQ.ensureTerminalShare(0.36);
    showTrialStage();
    ZQ.setTerminalView('trial');
    resetTrialHint();
    const size = layoutTrial();
    rt.trial.player.x = size.w / 2;
    rt.trial.player.y = size.h / 2 + rt.trial.radius * 0.54;
    clampTrialPlayer();
    updateTrialHud();
    ZQ.saveGame();
    rt.trialRaf = window.requestAnimationFrame(trialLoop);
  }

  dom.trialAbort.addEventListener('click', () => {
    if (!rt.trial || !rt.trial.active) return;
    finishTrial('abort');
  });

  dom.trialSealBtn.addEventListener('click', attemptSeal);

  function resizeTrial() {
    if (!rt.trial || !rt.trial.active) return;
    layoutTrial();
    clampTrialPlayer();
  }

  ZQ.resetTrialHint = resetTrialHint;
  ZQ.layoutTrial = layoutTrial;
  ZQ.updateTrialHud = updateTrialHud;
  ZQ.pushTrialHint = pushTrialHint;
  ZQ.finishTrial = finishTrial;
  ZQ.showTrialStage = showTrialStage;
  ZQ.hideTrialStage = hideTrialStage;
  ZQ.attemptSeal = attemptSeal;
  ZQ.startTrial = startTrial;
  ZQ.resizeTrial = resizeTrial;
})();
