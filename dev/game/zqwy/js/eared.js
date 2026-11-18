/* Ушастый зал и Мордастик — тот, кто спрятал своё имя.
   В зале живёт ушастое и мордастое существо: оно не показывает лица
   целиком, не называет себя и кормит Zemic бутербродами с клубничным
   джемом. Девушка, которая сорвала с него шарф и назвала имя вслух,
   теперь летает мухой под абажуром. Состояние хранится во флагах. */
(function () {
  'use strict';

  const ZQ = window.ZQ;
  const C = ZQ.C;
  const rt = ZQ.rt;

  const META = {
    title: 'Ушастый зал',
    speaker: 'МОРДАСТИК'
  };

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function flags() {
    if (!rt.state) return {};
    if (!rt.state.flags || typeof rt.state.flags !== 'object') rt.state.flags = {};
    return rt.state.flags;
  }

  function room() {
    if (!rt.world || !Array.isArray(rt.world.rooms)) return null;
    return rt.world.rooms.find((entry) => entry && entry.role === 'eared') || null;
  }

  function inRoom(target, x, y) {
    if (!target) return false;
    return x >= target.x1 - 0.6 && x <= target.x2 + 0.6 &&
      y >= target.y1 - 0.6 && y <= target.y2 + 0.6;
  }

  function home(target) {
    return {
      x: target.centerX + 0.5,
      y: target.centerY + 0.1
    };
  }

  function tableSpot(target) {
    return {
      x: target.centerX + 0.5,
      y: target.centerY + 1.35
    };
  }

  function npcRuntime(target) {
    if (!rt.eared || typeof rt.eared !== 'object') rt.eared = {};
    const npc = rt.eared.npc || (rt.eared.npc = {});
    if (npc.roomId !== target.id || !Number.isFinite(npc.x) || !Number.isFinite(npc.y)) {
      const spot = home(target);
      npc.roomId = target.id;
      npc.x = spot.x;
      npc.y = spot.y;
      npc.phase = (target.cx * 1.7 + target.cy * 2.3) % (Math.PI * 2);
      npc.earTwitch = 0;
    }
    return npc;
  }

  function met() {
    return Boolean(flags().earedMet);
  }

  function playStory(key) {
    const story = C.story && C.story[key];
    if (!story) return;
    ZQ.appendLog(story.title, 'sys', true, 'сцена');
    const speaker = story.speaker || META.speaker;
    for (const line of story.lines) {
      ZQ.appendLog(line, 'story', false, speaker);
    }
  }

  function earedTarget(px, py) {
    const target = room();
    if (!target || !rt.state) return null;
    if (!inRoom(target, px, py)) return null;
    const npc = npcRuntime(target);
    const distance = Math.hypot(px - npc.x, py - npc.y);
    if (distance <= 2.05) return { type: 'eared', distance };
    return null;
  }

  function interact() {
    const target = room();
    if (!target) return false;
    const npc = npcRuntime(target);
    if (Math.hypot(rt.state.player.x - npc.x, rt.state.player.y - npc.y) > 2.05) {
      ZQ.appendLog('Мордастик слишком далеко. Подойди ближе.', 'sys', true);
      return false;
    }

    if (!flags().earedMet) {
      flags().earedMet = true;
      playStory('eared');
      ZQ.logEvent('actions', 'познакомился с Мордастиком', 'ушастый зал');
      ZQ.saveGame();
    } else if (!flags().earedAfter) {
      flags().earedAfter = true;
      playStory('earedAfter');
      ZQ.logEvent('actions', 'услышал продолжение истории Мордастика', 'ушастый зал');
      ZQ.saveGame();
    } else {
      ZQ.appendLog(
        '«Бутерброды закончились, — говорит Мордастик. — Но муха ещё жива. Это считается».',
        'reply',
        true,
        'МОРДАСТИК'
      );
    }
    if (ZQ.updatePrompt) ZQ.updatePrompt();
    return true;
  }

  function updateEared(dt) {
    if (!rt.world || !rt.state || !rt.state.player) return;
    if (!Number.isFinite(dt) || dt <= 0) return;
    const target = room();
    if (!target) return;
    const npc = npcRuntime(target);
    npc.earTwitch = (npc.earTwitch || 0) + dt;
    /* Он не ходит: сидит на подушках у стола и только поворачивает
       голову к игроку, когда тот рядом. */
    const dx = rt.state.player.x - npc.x;
    const dy = rt.state.player.y - npc.y;
    const distance = Math.hypot(dx, dy);
    npc.alert = distance < 4.5;
    if (npc.alert) npc.facing = Math.atan2(dy, dx);
    /* Подсказку обновляет основной цикл один раз за кадр. */
  }

  function roomDescription() {
    if (!met()) {
      return 'На подушках сидит кто-то ушастый и мордастый. Лицо спрятано под шарфом и низкой шляпой, а на столе ждут бутерброды с клубничным джемом.';
    }
    if (!flags().earedAfter) {
      return 'Мордастик молча жуёт бутерброд. Муха кружит у абажура и не решается сесть ему на плечо.';
    }
    return 'Мордастик накрыл муху стаканом и смотрит на неё без злости. На столе остались крошки и запах клубничного джема.';
  }

  function pointInView(x, y, view, ts) {
    return x > -ts * 3 && x < view.w + ts * 3 && y > -ts * 4 && y < view.h + ts * 3;
  }

  function drawTable(ctx, sx, sy, ts, now) {
    ctx.save();
    ctx.translate(sx, sy);

    ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
    ctx.beginPath();
    ctx.ellipse(0, ts * 0.16, ts * 0.68, ts * 0.18, 0, 0, Math.PI * 2);
    ctx.fill();

    /* Низкий стол. */
    ctx.fillStyle = '#2c211b';
    ctx.beginPath();
    ctx.moveTo(-ts * 0.58, -ts * 0.28);
    ctx.lineTo(ts * 0.58, -ts * 0.28);
    ctx.lineTo(ts * 0.48, -ts * 0.06);
    ctx.lineTo(-ts * 0.48, -ts * 0.06);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#433126';
    ctx.beginPath();
    ctx.ellipse(0, -ts * 0.3, ts * 0.58, ts * 0.15, 0, 0, Math.PI * 2);
    ctx.fill();

    /* Тарелка и бутерброды с клубничным джемом. */
    ctx.fillStyle = '#cfc3ad';
    ctx.beginPath();
    ctx.ellipse(0, -ts * 0.32, ts * 0.3, ts * 0.09, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#d9b06d';
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(side * ts * 0.15, -ts * 0.35);
      ctx.lineTo(side * ts * 0.02, -ts * 0.47);
      ctx.lineTo(side * ts * 0.28, -ts * 0.42);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#b21f45';
      ctx.beginPath();
      ctx.ellipse(side * ts * 0.15, -ts * 0.4, ts * 0.075, ts * 0.035, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#d9b06d';
    }

    /* Абажур и муха над ним. */
    const flicker = 0.5 + 0.5 * Math.sin(now * 0.0032);
    const lampX = ts * 0.42;
    const lampY = -ts * 0.72;
    const glow = ctx.createRadialGradient(lampX, lampY, 0, lampX, lampY, ts * 0.7);
    glow.addColorStop(0, `rgba(255, 211, 132, ${0.2 + flicker * 0.12})`);
    glow.addColorStop(1, 'rgba(255, 211, 132, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(lampX, lampY, ts * 0.7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#231b17';
    ctx.beginPath();
    ctx.moveTo(lampX + ts * 0.16, lampY + ts * 0.1);
    ctx.lineTo(lampX - ts * 0.16, lampY + ts * 0.1);
    ctx.lineTo(lampX - ts * 0.1, lampY - ts * 0.16);
    ctx.lineTo(lampX + ts * 0.1, lampY - ts * 0.16);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = `rgba(255, 218, 144, ${0.5 + flicker * 0.25})`;
    ctx.beginPath();
    ctx.ellipse(lampX, lampY + ts * 0.1, ts * 0.12, ts * 0.03, 0, 0, Math.PI * 2);
    ctx.fill();

    const angle = now * 0.004;
    const flyX = lampX + Math.cos(angle) * ts * 0.17;
    const flyY = lampY - ts * 0.22 + Math.sin(angle * 1.4) * ts * 0.07;
    ctx.fillStyle = 'rgba(32, 28, 26, 0.9)';
    ctx.beginPath();
    ctx.arc(flyX, flyY, Math.max(1, ts * 0.026), 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(210, 210, 200, 0.35)';
    ctx.lineWidth = Math.max(1, ts * 0.012);
    ctx.beginPath();
    ctx.moveTo(flyX - ts * 0.03, flyY - ts * 0.02);
    ctx.lineTo(flyX + ts * 0.03, flyY + ts * 0.02);
    ctx.stroke();

    ctx.restore();
  }

  function drawCushions(ctx, sx, sy, ts) {
    ctx.save();
    ctx.translate(sx, sy);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
    ctx.beginPath();
    ctx.ellipse(0, ts * 0.18, ts * 0.62, ts * 0.16, 0, 0, Math.PI * 2);
    ctx.fill();
    const colors = ['#4a2b32', '#3b2c3f', '#55392f'];
    for (let i = 0; i < 3; i += 1) {
      const x = (i - 1) * ts * 0.34;
      ctx.fillStyle = colors[i];
      ctx.beginPath();
      ctx.ellipse(x, ts * 0.08, ts * 0.3, ts * 0.12, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawMordastik(ctx, sx, sy, ts, now, npc) {
    const h = ts * 1.82;
    const bob = Math.sin(now * 0.0019 + (npc.phase || 0)) * ts * 0.018;
    const twitch = Math.sin((npc.earTwitch || 0) * 5.5) * 0.08;

    ctx.save();
    ctx.translate(sx, sy + bob);

    ctx.fillStyle = 'rgba(0, 0, 0, 0.48)';
    ctx.beginPath();
    ctx.ellipse(0, ts * 0.1, h * 0.24, ts * 0.11, 0, 0, Math.PI * 2);
    ctx.fill();

    /* Ноги и плащ. */
    ctx.strokeStyle = '#241a17';
    ctx.lineWidth = h * 0.045;
    ctx.lineCap = 'round';
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(side * h * 0.07, -h * 0.62);
      ctx.lineTo(side * h * 0.08, -h * 0.06);
      ctx.stroke();
    }
    ctx.fillStyle = '#3a2a24';
    ctx.beginPath();
    ctx.moveTo(-h * 0.2, -h * 0.7);
    ctx.quadraticCurveTo(-h * 0.3, -h * 0.36, -h * 0.26, -h * 0.5);
    ctx.lineTo(h * 0.26, -h * 0.5);
    ctx.quadraticCurveTo(h * 0.3, -h * 0.36, h * 0.2, -h * 0.7);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#523b30';
    ctx.beginPath();
    ctx.moveTo(-h * 0.18, -h * 1.08);
    ctx.quadraticCurveTo(-h * 0.26, -h * 0.8, -h * 0.2, -h * 0.62);
    ctx.lineTo(h * 0.2, -h * 0.62);
    ctx.quadraticCurveTo(h * 0.26, -h * 0.8, h * 0.18, -h * 1.08);
    ctx.closePath();
    ctx.fill();

    /* Руки на столе. */
    ctx.strokeStyle = '#7a5440';
    ctx.lineWidth = h * 0.052;
    ctx.beginPath();
    ctx.moveTo(-h * 0.17, -h * 1.0);
    ctx.lineTo(-h * 0.05, -h * 0.7);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(h * 0.17, -h * 1.0);
    ctx.lineTo(h * 0.05, -h * 0.7);
    ctx.stroke();

    /* Голова: мохнатые уши и вытянутая морда. */
    const headY = -h * 1.24;
    const headR = h * 0.095;

    ctx.save();
    ctx.translate(0, headY);
    ctx.rotate(twitch * 0.4);
    ctx.fillStyle = '#6b4835';
    for (const side of [-1, 1]) {
      ctx.save();
      ctx.rotate(side * (0.22 + twitch));
      ctx.beginPath();
      ctx.ellipse(side * headR * 1.6, -headR * 0.45, headR * 0.62, headR * 1.05, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#a97a5d';
      ctx.beginPath();
      ctx.ellipse(side * headR * 1.62, -headR * 0.45, headR * 0.32, headR * 0.68, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#6b4835';
      ctx.restore();
    }
    ctx.restore();

    ctx.fillStyle = '#7a5440';
    ctx.beginPath();
    ctx.ellipse(0, headY, headR * 1.28, headR * 1.18, 0, 0, Math.PI * 2);
    ctx.fill();

    /* Морда. */
    ctx.fillStyle = '#a97a5d';
    ctx.beginPath();
    ctx.ellipse(0, headY + headR * 0.45, headR * 0.82, headR * 0.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#241a17';
    ctx.beginPath();
    ctx.ellipse(0, headY + headR * 0.28, headR * 0.24, headR * 0.16, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#241a17';
    ctx.lineWidth = Math.max(1, h * 0.008);
    ctx.beginPath();
    ctx.moveTo(0, headY + headR * 0.4);
    ctx.lineTo(0, headY + headR * 0.55);
    ctx.stroke();

    /* Глаза под низкой шляпой. */
    ctx.fillStyle = '#f2e6cf';
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(side * headR * 0.46, headY - headR * 0.12, headR * 0.2, headR * 0.14, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#241a17';
      ctx.beginPath();
      ctx.arc(side * headR * 0.46, headY - headR * 0.12, headR * 0.08, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#f2e6cf';
    }

    /* Шляпа с широкими полями: тень на глаза. */
    ctx.fillStyle = '#1e1917';
    ctx.beginPath();
    ctx.ellipse(0, headY - headR * 0.52, headR * 1.55, headR * 0.28, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#2b2320';
    ctx.beginPath();
    ctx.ellipse(0, headY - headR * 0.72, headR * 0.82, headR * 0.42, 0, 0, Math.PI * 2);
    ctx.fill();

    /* Шарф у горла. */
    ctx.fillStyle = '#8f2440';
    ctx.beginPath();
    ctx.ellipse(0, -h * 1.08, h * 0.1, h * 0.045, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#b42d4f';
    ctx.beginPath();
    ctx.moveTo(h * 0.03, -h * 1.06);
    ctx.lineTo(h * 0.12, -h * 0.86);
    ctx.lineTo(h * 0.04, -h * 0.88);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  }

  function drawEaredWorld(ctx, params) {
    const { state, view, ts, toScreenX, toScreenY, now } = params;
    if (!state || !rt.state) return;
    const target = room();
    if (!target) return;

    const table = tableSpot(target);
    const tx = toScreenX(table.x);
    const ty = toScreenY(table.y);
    if (pointInView(tx, ty, view, ts)) drawTable(ctx, tx, ty, ts, now);

    const npc = npcRuntime(target);
    const sx = toScreenX(npc.x);
    const sy = toScreenY(npc.y);
    if (pointInView(sx, sy, view, ts)) {
      drawCushions(ctx, sx, sy, ts);
      drawMordastik(ctx, sx, sy, ts, now, npc);
    }
  }

  ZQ.earedRoom = room;
  ZQ.earedTarget = earedTarget;
  ZQ.earedInteract = interact;
  ZQ.earedRoomDescription = roomDescription;
  ZQ.updateEared = updateEared;
  ZQ.drawEaredWorld = drawEaredWorld;
})();
