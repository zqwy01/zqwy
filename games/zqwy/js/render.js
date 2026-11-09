/* Отрисовка Лабиринта и карты. Никаких внешних библиотек. */
(function () {
  'use strict';

  const C = window.CONFIG;

  function tileNoise(x, y, salt) {
    let h = (x * 374761393 + y * 668265263 + (salt || 0) * 2246822519) >>> 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }

  function roundedRect(ctx, x, y, w, h, r) {
    const rr = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y, x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x, y + h, rr);
    ctx.arcTo(x, y + h, x, y, rr);
    ctx.arcTo(x, y, x + w, y, rr);
    ctx.closePath();
  }

  function tinted(img, color) {
    if (!img || !img.complete || !img.naturalWidth) return null;
    const cv = document.createElement('canvas');
    cv.width = img.naturalWidth;
    cv.height = img.naturalHeight;
    const c = cv.getContext('2d');
    c.drawImage(img, 0, 0);
    c.globalCompositeOperation = 'source-in';
    c.fillStyle = color;
    c.fillRect(0, 0, cv.width, cv.height);
    return cv;
  }

  function makeCanvasSize(canvas) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    const w = Math.max(1, Math.round(canvas.clientWidth));
    const h = Math.max(1, Math.round(canvas.clientHeight));
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
    }
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { ctx, w, h };
  }

  function tilePxFor(view) {
    return Math.max(20, Math.min(42, Math.min(view.w / 14.5, view.h / 13.2)));
  }

  function drawFloor(ctx, sx, sy, ts, x, y, kind) {
    const n = tileNoise(x, y, 3);
    let base;
    if (kind === 5) {
      base = `rgb(${30 + n * 8}, ${26 + n * 6}, ${20 + n * 4})`;
    } else {
      base = `rgb(${18 + n * 5}, ${23 + n * 5}, ${24 + n * 4})`;
    }
    ctx.fillStyle = base;
    ctx.fillRect(sx, sy, ts + 0.6, ts + 0.6);

    ctx.strokeStyle = 'rgba(126, 146, 148, 0.055)';
    ctx.lineWidth = 1;
    ctx.strokeRect(sx + 0.5, sy + 0.5, ts - 1, ts - 1);

    if (kind === 5) {
      ctx.strokeStyle = 'rgba(197, 101, 42, 0.18)';
      ctx.beginPath();
      ctx.moveTo(sx + ts * 0.18, sy + 1);
      ctx.lineTo(sx + ts * 0.82, sy + 1);
      ctx.stroke();
    }

    if (n > 0.87) {
      ctx.strokeStyle = 'rgba(0,0,0,0.35)';
      ctx.beginPath();
      const a = tileNoise(x, y, 8);
      ctx.moveTo(sx + ts * 0.2, sy + ts * (0.2 + a * 0.5));
      ctx.lineTo(sx + ts * (0.35 + a * 0.2), sy + ts * 0.62);
      ctx.stroke();
    }
  }

  function drawWall(ctx, sx, sy, ts, x, y, world) {
    const n = tileNoise(x, y, 11);
    ctx.fillStyle = `rgb(${28 + n * 8}, ${34 + n * 8}, ${35 + n * 7})`;
    ctx.fillRect(sx, sy, ts + 0.6, ts + 0.6);

    ctx.fillStyle = 'rgba(6, 8, 9, 0.55)';
    ctx.fillRect(sx, sy + ts * 0.68, ts, ts * 0.32);
    ctx.fillStyle = 'rgba(164, 177, 174, 0.10)';
    ctx.fillRect(sx, sy, ts, Math.max(1, ts * 0.09));

    if (n > 0.55) {
      ctx.strokeStyle = 'rgba(0,0,0,0.25)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(sx + ts * 0.2, sy + ts * 0.52);
      ctx.lineTo(sx + ts * 0.2, sy + ts * 0.92);
      ctx.moveTo(sx + ts * 0.52, sy + ts * 0.3);
      ctx.lineTo(sx + ts * 0.52, sy + ts * 0.7);
      ctx.stroke();
    }
  }

  function drawPillar(ctx, sx, sy, ts, x, y) {
    const cx = sx + ts / 2;
    const cy = sy + ts / 2;
    const n = tileNoise(x, y, 17);
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.beginPath();
    ctx.ellipse(cx + ts * 0.12, cy + ts * 0.2, ts * 0.42, ts * 0.34, 0.2, 0, Math.PI * 2);
    ctx.fill();
    const g = ctx.createRadialGradient(cx - ts * 0.15, cy - ts * 0.2, ts * 0.05, cx, cy, ts * 0.55);
    g.addColorStop(0, `rgb(${70 + n * 20}, ${79 + n * 20}, ${79 + n * 16})`);
    g.addColorStop(0.7, '#343d3e');
    g.addColorStop(1, '#1b2223');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(cx, cy, ts * 0.38, ts * 0.44, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(210, 222, 216, 0.12)';
    ctx.beginPath();
    ctx.ellipse(cx, cy, ts * 0.38, ts * 0.44, 0, Math.PI * 0.8, Math.PI * 1.55);
    ctx.stroke();
  }

  function drawShelf(ctx, sx, sy, ts, x, y) {
    ctx.fillStyle = '#1c2020';
    ctx.fillRect(sx, sy, ts + 0.5, ts + 0.5);
    ctx.fillStyle = '#2e3432';
    ctx.fillRect(sx + 1, sy + ts * 0.55, ts - 2, ts * 0.22);
    const colors = ['#5b4633', '#3e4a44', '#594c3b', '#373f45'];
    for (let i = 0; i < 4; i++) {
      const n = tileNoise(x, y, 21 + i);
      ctx.fillStyle = colors[Math.floor(n * colors.length)];
      ctx.fillRect(sx + 2 + i * (ts - 4) / 4, sy + ts * 0.2, (ts - 5) / 5, ts * 0.34);
    }
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(sx, sy + ts * 0.78, ts, ts * 0.22);
  }

  function drawSigil(ctx, room, toScreenX, toScreenY, ts, now) {
    const cx = toScreenX(room.centerX + 0.5);
    const cy = toScreenY(room.centerY + 0.5);
    const r = ts * 4.7;
    const pulse = 0.5 + 0.5 * Math.sin(now * 0.0015);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.strokeStyle = `rgba(196, 98, 40, ${0.16 + pulse * 0.08})`;
    ctx.lineWidth = 1.2;
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.arc(0, 0, r * (0.42 + i * 0.28), 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.rotate(now * 0.00012);
    for (let i = 0; i < 12; i++) {
      ctx.rotate(Math.PI / 6);
      ctx.beginPath();
      ctx.moveTo(r * 0.72, 0);
      ctx.lineTo(r * 0.85, 0);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawTablet(ctx, sx, sy, ts, images, now) {
    const pulse = 0.65 + 0.35 * Math.sin(now * 0.0022);
    const halo = ctx.createRadialGradient(sx, sy, 1, sx, sy, ts * 2.8);
    halo.addColorStop(0, `rgba(220, 105, 40, ${0.25 * pulse})`);
    halo.addColorStop(0.55, `rgba(190, 78, 26, 0.10)`);
    halo.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(sx, sy, ts * 2.8, 0, Math.PI * 2);
    ctx.fill();

    const img = images.tabletTint || images.tablet;
    const size = ts * 2.2;
    if (img && img.complete && img.naturalWidth) {
      ctx.save();
      ctx.imageSmoothingEnabled = false;
      ctx.globalAlpha = 0.92;
      ctx.drawImage(img, sx - size / 2, sy - size / 2, size, size);
      ctx.restore();
    } else {
      ctx.fillStyle = '#c8642c';
      ctx.fillRect(sx - size / 2, sy - size * 0.35, size, size * 0.7);
    }

    ctx.strokeStyle = `rgba(236, 149, 88, ${0.35 + pulse * 0.35})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(sx, sy, ts * (1.5 + pulse * 0.18), 0, Math.PI * 2);
    ctx.stroke();
  }

  function drawPickup(ctx, p, sx, sy, ts, now) {
    const bob = Math.sin(now * 0.003 + p.x * 2.1) * ts * 0.08;
    const y = sy + bob;
    ctx.save();
    ctx.shadowColor = 'rgba(226, 154, 92, 0.75)';
    ctx.shadowBlur = ts * 0.9;
    if (p.itemId === 'map_fragment') {
      ctx.fillStyle = '#d9c9a4';
      ctx.beginPath();
      ctx.moveTo(sx - ts * 0.28, y - ts * 0.2);
      ctx.lineTo(sx + ts * 0.25, y - ts * 0.28);
      ctx.lineTo(sx + ts * 0.32, y + ts * 0.18);
      ctx.lineTo(sx - ts * 0.2, y + ts * 0.26);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = 'rgba(76, 58, 38, 0.8)';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(sx - ts * 0.18, y);
      ctx.lineTo(sx + ts * 0.2, y - ts * 0.05);
      ctx.stroke();
    } else if (p.itemId === 'chalk') {
      ctx.fillStyle = '#e8e2d2';
      ctx.fillRect(sx - ts * 0.09, y - ts * 0.26, ts * 0.18, ts * 0.52);
      ctx.fillStyle = '#b9b2a2';
      ctx.fillRect(sx - ts * 0.09, y + ts * 0.17, ts * 0.18, ts * 0.08);
    } else {
      ctx.fillStyle = 'rgba(174, 213, 205, 0.9)';
      ctx.beginPath();
      ctx.arc(sx, y, ts * 0.16, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.5)';
      ctx.beginPath();
      ctx.arc(sx - ts * 0.04, y - ts * 0.04, ts * 0.04, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawBackpack(ctx, b, sx, sy, ts, now) {
    const pulse = 0.5 + 0.5 * Math.sin(now * 0.0035 + b.x);
    ctx.save();
    ctx.shadowColor = `rgba(211, 103, 42, ${0.35 + pulse * 0.3})`;
    ctx.shadowBlur = ts * 1.3;
    ctx.fillStyle = '#6c4a2f';
    roundedRect(ctx, sx - ts * 0.34, sy - ts * 0.34, ts * 0.68, ts * 0.72, ts * 0.13);
    ctx.fill();
    ctx.fillStyle = '#8b603b';
    roundedRect(ctx, sx - ts * 0.27, sy - ts * 0.22, ts * 0.54, ts * 0.48, ts * 0.08);
    ctx.fill();
    ctx.strokeStyle = '#d19a5c';
    ctx.lineWidth = Math.max(1, ts * 0.045);
    ctx.beginPath();
    ctx.moveTo(sx - ts * 0.2, sy - ts * 0.05);
    ctx.lineTo(sx + ts * 0.2, sy - ts * 0.05);
    ctx.stroke();
    ctx.fillStyle = 'rgba(238, 184, 112, 0.9)';
    ctx.beginPath();
    ctx.arc(sx, sy + ts * 0.05, ts * 0.055, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawCardPedestal(ctx, sx, sy, ts, images, now) {
    const bob = Math.sin(now * 0.0025) * ts * 0.1;
    const pulse = 0.5 + 0.5 * Math.sin(now * 0.002);
    const halo = ctx.createRadialGradient(sx, sy + bob, ts * 0.1, sx, sy + bob, ts * 1.8);
    halo.addColorStop(0, `rgba(232, 150, 90, ${0.25 + pulse * 0.16})`);
    halo.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(sx, sy + bob, ts * 1.8, 0, Math.PI * 2);
    ctx.fill();

    const cw = ts * 1.18;
    const ch = cw * (16 / 9);
    ctx.save();
    ctx.translate(sx, sy + bob);
    ctx.rotate(Math.sin(now * 0.0013) * 0.035);
    ctx.fillStyle = '#e6dcc7';
    ctx.fillRect(-cw / 2, -ch / 2, cw, ch);
    if (images.angel && images.angel.complete && images.angel.naturalWidth) {
      ctx.drawImage(images.angel, -cw / 2 + 1, -ch / 2 + 1, cw - 2, ch - 2);
    } else {
      ctx.fillStyle = '#8b7c63';
      ctx.beginPath();
      ctx.arc(0, -ch * 0.12, cw * 0.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#8b7c63';
      ctx.beginPath();
      ctx.moveTo(0, -ch * 0.02);
      ctx.lineTo(-cw * 0.3, ch * 0.25);
      ctx.lineTo(cw * 0.3, ch * 0.25);
      ctx.closePath();
      ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(101, 74, 43, 0.85)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(-cw / 2, -ch / 2, cw, ch);
    ctx.restore();
  }

  /* Восемь групп кадров: вниз, вверх, влево, вправо, вниз-влево,
     вниз-вправо, вверх-влево, вверх-вправо. В каждой группе 4 кадра. */
  function frameForPlayer(state) {
    const p = state.player;
    const vx = p.facingX || 0;
    const vy = p.facingY || 0;
    const horizontal = Math.abs(vx) > 0.3;
    const vertical = Math.abs(vy) > 0.3;
    let group = 0;
    if (horizontal && vertical) {
      if (vy > 0) group = vx < 0 ? 4 : 5;
      else group = vx < 0 ? 6 : 7;
    } else if (horizontal) {
      group = vx < 0 ? 2 : 3;
    } else if (vertical) {
      group = vy < 0 ? 1 : 0;
    }
    const base = group * 4;
    if (!p.moving) return base;
    return base + (Math.floor(state.animTime * 10) % 4);
  }

  function drawPlayer(ctx, state, sx, sy, ts, images) {
    const frame = frameForPlayer(state);
    const fw = C.player.spriteFrameW;
    const fh = C.player.spriteFrameH;
    const srcX = (frame % C.player.spriteFrames) * fw;
    const h = ts * 2.05;
    const w = h * (fw / fh);

    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.beginPath();
    ctx.ellipse(sx, sy + ts * 0.48, ts * 0.28, ts * 0.11, 0, 0, Math.PI * 2);
    ctx.fill();

    const glow = ctx.createRadialGradient(sx, sy, ts * 0.1, sx, sy, ts * 1.35);
    glow.addColorStop(0, 'rgba(235, 239, 228, 0.20)');
    glow.addColorStop(1, 'rgba(235, 239, 228, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(sx, sy, ts * 1.35, 0, Math.PI * 2);
    ctx.fill();

    if (images.zemic && images.zemic.complete && images.zemic.naturalWidth) {
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(
        images.zemic,
        srcX, 0, fw, fh,
        sx - w / 2, sy - h * 0.78, w, h
      );
    } else {
      ctx.fillStyle = '#e7e6dc';
      ctx.beginPath();
      ctx.arc(sx, sy - h * 0.2, ts * 0.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(sx - ts * 0.22, sy - ts * 0.05, ts * 0.44, ts * 0.6);
    }
    ctx.restore();
  }

  /* Пыль живёт в координатах мира. Она не приклеена к экрану: при
     движении камеры одни пылинки уходят, другие появляются. Индексы
     сетки берутся от абсолютных координат, поэтому при ходьбе пыль
     не пересоздаётся заново на каждом кадре. */
  function dustMotes(params) {
    const { view, now, cam, ts } = params;
    const spanX = view.w / ts + 8;
    const spanY = view.h / ts + 8;
    const step = 2.4;
    const firstX = Math.floor((cam.x - spanX / 2) / step);
    const firstY = Math.floor((cam.y - spanY / 2) / step);
    const cols = Math.ceil(spanX / step) + 2;
    const rows = Math.ceil(spanY / step) + 2;
    const motes = [];
    for (let gy = 0; gy < rows; gy++) {
      for (let gx = 0; gx < cols; gx++) {
        const cellX = firstX + gx;
        const cellY = firstY + gy;
        const n = tileNoise(cellX, cellY, 31);
        if (n < 0.74) continue;
        const wx = cellX * step + Math.sin(now * 0.00012 + n * 20) * 0.8;
        const wy = cellY * step + Math.cos(now * 0.00009 + n * 13) * 0.65;
        motes.push({
          wx,
          wy,
          r: 0.6 + n * 0.7,
          a: 0.05 + 0.11 * (0.5 + 0.5 * Math.sin(now * 0.001 + n * 8))
        });
      }
    }
    return motes;
  }

  function drawDust(ctx, params) {
    const { view, toScreenX, toScreenY } = params;
    ctx.save();
    for (const mote of dustMotes(params)) {
      const px = toScreenX(mote.wx);
      const py = toScreenY(mote.wy);
      if (px < -8 || px > view.w + 8 || py < -8 || py > view.h + 8) continue;
      ctx.fillStyle = `rgba(220, 226, 216, ${mote.a})`;
      ctx.beginPath();
      ctx.arc(px, py, mote.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  /* Точка назначения курсора: видно, куда именно идёт Zemic. */
  function drawCursorTarget(ctx, params) {
    const { cursor, toScreenX, toScreenY, ts, now } = params;
    if (!cursor) return;
    const px = toScreenX(cursor.x);
    const py = toScreenY(cursor.y);
    const pulse = 0.5 + 0.5 * Math.sin(now * 0.006);
    ctx.save();
    ctx.strokeStyle = `rgba(229, 161, 104, ${0.5 + pulse * 0.32})`;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.arc(px, py, ts * (0.16 + pulse * 0.05), 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = 'rgba(229, 161, 104, 0.28)';
    ctx.beginPath();
    ctx.arc(px, py, ts * 0.055, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(229, 161, 104, 0.22)';
    ctx.beginPath();
    ctx.moveTo(px - ts * 0.28, py);
    ctx.lineTo(px + ts * 0.28, py);
    ctx.moveTo(px, py - ts * 0.28);
    ctx.lineTo(px, py + ts * 0.28);
    ctx.stroke();
    ctx.restore();
  }

  function drawBelzebufo(ctx, sx, sy, ts, now) {
    const r = ts * 0.52;
    const pulse = 0.5 + 0.5 * Math.sin(now * 0.0022);
    ctx.save();
    ctx.translate(sx, sy);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.42)';
    ctx.beginPath();
    ctx.ellipse(0, r * 0.62, r * 1.05, r * 0.32, 0, 0, Math.PI * 2);
    ctx.fill();

    /* Яркий апосематический окрас: предупреждение, а не маскировка. */
    const body = ctx.createRadialGradient(-r * 0.25, -r * 0.35, r * 0.12, 0, 0, r * 1.2);
    body.addColorStop(0, '#d8c63a');
    body.addColorStop(0.55, '#9c8a1e');
    body.addColorStop(1, '#3c3a12');
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.ellipse(0, 0, r, r * 0.82, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = 'rgba(178, 48, 32, 0.85)';
    for (const [px, py, pr] of [
      [-0.34, -0.1, 0.18], [0.28, 0.08, 0.22], [0.05, -0.4, 0.14],
      [-0.12, 0.36, 0.16]
    ]) {
      ctx.beginPath();
      ctx.arc(px * r, py * r, pr * r, 0, Math.PI * 2);
      ctx.fill();
    }

    /* Глаза навыкате. */
    for (const side of [-1, 1]) {
      ctx.fillStyle = '#e8dfa0';
      ctx.beginPath();
      ctx.arc(side * r * 0.46, -r * 0.52, r * 0.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#14140c';
      ctx.beginPath();
      ctx.arc(side * r * 0.48, -r * 0.54, r * 0.09, 0, Math.PI * 2);
      ctx.fill();
    }

    /* Едва заметный ядовитый ореол. */
    ctx.strokeStyle = `rgba(168, 196, 74, ${0.08 + pulse * 0.1})`;
    ctx.lineWidth = Math.max(1, ts * 0.05);
    ctx.beginPath();
    ctx.arc(0, 0, r * (1.25 + pulse * 0.18), 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  function drawTitanoboa(ctx, sx, sy, ts, now, room) {
    const r = Math.max(ts * 0.9, Math.min(room ? room.w : 8, 10) * ts * 0.28);
    const sway = Math.sin(now * 0.0011) * 0.1;
    ctx.save();
    ctx.translate(sx, sy);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
    ctx.beginPath();
    ctx.ellipse(0, r * 0.5, r * 1.5, r * 0.34, 0, 0, Math.PI * 2);
    ctx.fill();

    /* Кольца: змея занимает весь зал. */
    ctx.lineCap = 'round';
    for (let i = 0; i < 4; i++) {
      const rr = r * (1.25 - i * 0.2);
      ctx.strokeStyle = i % 2 === 0 ? 'rgba(116, 122, 78, 0.85)' : 'rgba(78, 84, 52, 0.9)';
      ctx.lineWidth = Math.max(2, r * 0.26);
      ctx.beginPath();
      ctx.ellipse(
        Math.sin(sway + i) * r * 0.18,
        Math.cos(sway + i * 0.7) * r * 0.14,
        rr,
        rr * 0.58,
        0.35 + i * 0.18,
        0,
        Math.PI * 2
      );
      ctx.stroke();
    }

    /* Голова поднимается над кольцами. */
    ctx.translate(Math.sin(sway * 2) * r * 0.2, -r * 0.46);
    ctx.fillStyle = '#6e7448';
    ctx.beginPath();
    ctx.ellipse(0, 0, r * 0.34, r * 0.24, -0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(224, 168, 74, 0.75)';
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(side * r * 0.12, -r * 0.05, r * 0.045, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.strokeStyle = 'rgba(196, 70, 44, 0.8)';
    ctx.lineWidth = Math.max(1, r * 0.035);
    ctx.beginPath();
    ctx.moveTo(-r * 0.24, r * 0.1);
    ctx.lineTo(r * 0.24, r * 0.1);
    ctx.stroke();
    ctx.restore();
  }

  function drawArenaBeetle(ctx, sx, sy, ts, now) {
    const r = ts * 0.7;
    const pulse = 0.5 + 0.5 * Math.sin(now * 0.003);
    ctx.save();
    ctx.translate(sx, sy);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
    ctx.beginPath();
    ctx.ellipse(0, r * 0.55, r * 1.02, r * 0.3, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#4b4a35';
    ctx.lineWidth = Math.max(1.2, r * 0.08);
    for (const side of [-1, 1]) {
      for (let i = 0; i < 3; i++) {
        const yOff = (i - 1) * r * 0.36;
        ctx.beginPath();
        ctx.moveTo(side * r * 0.4, yOff);
        ctx.lineTo(side * r * (0.92 + i * 0.06), yOff + r * 0.26);
        ctx.stroke();
      }
    }

    const shell = ctx.createRadialGradient(-r * 0.25, -r * 0.3, r * 0.1, 0, 0, r);
    shell.addColorStop(0, '#8c8a52');
    shell.addColorStop(0.6, '#545a35');
    shell.addColorStop(1, '#2e3320');
    ctx.fillStyle = shell;
    ctx.beginPath();
    ctx.ellipse(0, 0, r * 0.9, r, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(224, 214, 164, 0.22)';
    ctx.lineWidth = Math.max(1, r * 0.05);
    ctx.beginPath();
    ctx.moveTo(0, -r * 0.8);
    ctx.lineTo(0, r * 0.8);
    ctx.stroke();

    ctx.fillStyle = '#6c683c';
    ctx.beginPath();
    ctx.ellipse(0, -r * 0.9, r * 0.48, r * 0.4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = `rgba(236, 122, 58, ${0.55 + pulse * 0.35})`;
    ctx.beginPath();
    ctx.arc(-r * 0.17, -r * 0.96, r * 0.07, 0, Math.PI * 2);
    ctx.arc(r * 0.17, -r * 0.96, r * 0.07, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawDimetrodon(ctx, sx, sy, ts, now, index) {
    const r = Math.max(ts * 0.5, ts * 0.48);
    const sway = Math.sin(now * 0.0016 + index * 1.7) * 0.08;
    ctx.save();
    ctx.translate(sx, sy);
    ctx.rotate(sway + index * 1.9);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
    ctx.beginPath();
    ctx.ellipse(0, r * 0.6, r * 1.1, r * 0.3, 0, 0, Math.PI * 2);
    ctx.fill();

    /* Тело и хвост. */
    ctx.strokeStyle = '#5a5a3c';
    ctx.lineWidth = Math.max(2, r * 0.34);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-r * 1.1, r * 0.1);
    ctx.quadraticCurveTo(-r * 0.4, -r * 0.05, r * 0.7, r * 0.16);
    ctx.stroke();

    /* Парус на спине. */
    const sail = ctx.createLinearGradient(0, -r * 0.9, 0, r * 0.1);
    sail.addColorStop(0, 'rgba(180, 92, 54, 0.9)');
    sail.addColorStop(1, 'rgba(96, 54, 38, 0.85)');
    ctx.fillStyle = sail;
    ctx.beginPath();
    ctx.moveTo(-r * 0.58, r * 0.02);
    ctx.quadraticCurveTo(-r * 0.2, -r * 1.05, r * 0.3, -r * 0.72);
    ctx.quadraticCurveTo(r * 0.52, -r * 0.3, r * 0.52, r * 0.06);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(232, 182, 132, 0.35)';
    ctx.lineWidth = Math.max(1, r * 0.035);
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.moveTo(-r * 0.4 + i * r * 0.26, r * 0.02);
      ctx.lineTo(-r * 0.24 + i * r * 0.22, -r * 0.6 + i * r * 0.08);
      ctx.stroke();
    }

    /* Голова. */
    ctx.fillStyle = '#6c6844';
    ctx.beginPath();
    ctx.ellipse(r * 0.82, r * 0.08, r * 0.3, r * 0.2, 0.1, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = `rgba(230, 176, 90, ${0.6 + 0.3 * Math.sin(now * 0.004 + index)})`;
    ctx.beginPath();
    ctx.arc(r * 0.9, -r * 0.02, r * 0.055, 0, Math.PI * 2);
    ctx.fill();

    /* Лапы. */
    ctx.strokeStyle = '#4e4c34';
    ctx.lineWidth = Math.max(1.4, r * 0.09);
    for (const side of [-1, 1]) {
      for (const dx of [-0.42, 0.42]) {
        ctx.beginPath();
        ctx.moveTo(dx * r, r * 0.12);
        ctx.lineTo(dx * r + side * r * 0.24, r * 0.44);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  function drawUmbrellaEnemy(ctx, sx, sy, ts, now) {
    const r = Math.max(ts * 0.9, ts * 0.72);
    const pulse = 0.5 + 0.5 * Math.sin(now * 0.004);
    ctx.save();
    ctx.translate(sx, sy);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.46)';
    ctx.beginPath();
    ctx.ellipse(0, r * 0.95, r * 0.9, r * 0.26, 0, 0, Math.PI * 2);
    ctx.fill();

    /* Купол. */
    const dome = ctx.createLinearGradient(0, -r * 0.9, 0, r * 0.25);
    dome.addColorStop(0, '#3c3f36');
    dome.addColorStop(0.6, '#22251f');
    dome.addColorStop(1, '#141611');
    ctx.fillStyle = dome;
    ctx.beginPath();
    ctx.moveTo(-r, r * 0.12);
    ctx.quadraticCurveTo(0, -r * 1.2, r, r * 0.12);
    ctx.quadraticCurveTo(r * 0.5, -r * 0.12, 0, -r * 0.12);
    ctx.quadraticCurveTo(-r * 0.5, -r * 0.12, -r, r * 0.12);
    ctx.fill();
    ctx.strokeStyle = `rgba(236, 154, 84, ${0.35 + pulse * 0.35})`;
    ctx.lineWidth = Math.max(1, r * 0.045);
    ctx.stroke();

    /* Спицы и рукоять. */
    ctx.strokeStyle = 'rgba(210, 190, 154, 0.7)';
    ctx.lineWidth = Math.max(1, r * 0.035);
    for (let i = 0; i <= 6; i++) {
      const t = i / 6;
      const x = -r + t * 2 * r;
      ctx.beginPath();
      ctx.moveTo(0, -r * 0.56);
      ctx.lineTo(x, r * 0.12 + Math.sin(t * Math.PI) * r * 0.04);
      ctx.stroke();
    }
    ctx.strokeStyle = '#8c6a44';
    ctx.lineWidth = Math.max(2, r * 0.08);
    ctx.beginPath();
    ctx.moveTo(0, -r * 0.12);
    ctx.lineTo(0, r * 0.95);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, r * 1.02, r * 0.12, 0, Math.PI * 2);
    ctx.stroke();

    /* Глаз под куполом. */
    ctx.fillStyle = `rgba(236, 122, 58, ${0.55 + pulse * 0.35})`;
    ctx.beginPath();
    ctx.arc(0, -r * 0.42, r * 0.09, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawFauna(ctx, room, sx, sy, ts, now) {
    if (room.faunaKind === 'belzebufo') drawBelzebufo(ctx, sx, sy, ts, now);
    else if (room.faunaKind === 'titanoboa') drawTitanoboa(ctx, sx, sy, ts, now, room);
    else if (room.faunaKind === 'dimetrodon') {
      const count = Math.max(2, Math.min(4, Math.floor(room.w / 8)));
      for (let i = 0; i < count; i++) {
        const angle = (i / count) * Math.PI * 2 + 0.4;
        const orbit = Math.min(room.w, room.h) * 0.18 * ts;
        drawDimetrodon(
          ctx,
          sx + Math.cos(angle) * orbit,
          sy + Math.sin(angle) * orbit * 0.7,
          ts,
          now,
          i
        );
      }
    }
  }

  function drawWorld(ctx, params) {
    const { state, world, images, view, now } = params;
    const ts = tilePxFor(view);
    const cam = state.camera;

    ctx.clearRect(0, 0, view.w, view.h);
    const bg = ctx.createRadialGradient(view.w * 0.5, view.h * 0.48, view.h * 0.08, view.w * 0.5, view.h * 0.5, Math.max(view.w, view.h) * 0.72);
    bg.addColorStop(0, '#0d1112');
    bg.addColorStop(0.7, '#080b0c');
    bg.addColorStop(1, '#040506');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, view.w, view.h);

    /* Камера строго по центру Zemic, без прижатия к краям мира. */
    const cx = cam.x;
    const cy = cam.y;

    const offsetX = view.w / 2 - cx * ts;
    const offsetY = view.h / 2 - cy * ts;
    const toScreenX = (tx) => offsetX + tx * ts;
    const toScreenY = (ty) => offsetY + ty * ts;

    const startX = Math.floor(-offsetX / ts) - 1;
    const endX = Math.ceil((view.w - offsetX) / ts) + 1;
    const startY = Math.floor(-offsetY / ts) - 1;
    const endY = Math.ceil((view.h - offsetY) / ts) + 1;

    /* Мир не ограничен сеткой: видимые тайлы могут лежать в любом
       чанке. ensureRange создаёт их до отрисовки. */
    world.ensureRange(startX, startY, endX, endY);

    for (let y = startY; y <= endY; y++) {
      for (let x = startX; x <= endX; x++) {
        const t = world.getTile(x, y);
        if (t === 0) continue;
        const sx = toScreenX(x);
        const sy = toScreenY(y);
        if (t === 2) drawWall(ctx, sx, sy, ts, x, y, world);
        else if (t === 3) drawPillar(ctx, sx, sy, ts, x, y);
        else if (t === 4) drawShelf(ctx, sx, sy, ts, x, y);
        else drawFloor(ctx, sx, sy, ts, x, y, t);
      }
    }

    for (const room of world.rooms) {
      if (room.role !== 'trial') continue;
      if (toScreenX(room.ox) > view.w + ts * 6 || toScreenX(room.ox + room.w) < -ts * 6) continue;
      if (toScreenY(room.oy) > view.h + ts * 6 || toScreenY(room.oy + room.h) < -ts * 6) continue;
      drawSigil(ctx, room, toScreenX, toScreenY, ts, now);
    }

    for (const p of world.itemPickups) {
      if (state.flags[`taken_${p.itemId}`]) continue;
      drawPickup(ctx, p, toScreenX(p.x), toScreenY(p.y), ts, now);
    }

    const tablet = world.tablet;
    drawTablet(
      ctx,
      toScreenX(tablet.x),
      toScreenY(tablet.y) - ts * 0.1,
      ts,
      images,
      now
    );

    /* Фауна живёт в своих комнатах и не мешает проходу: это сцена,
       а не противник. Комната человека-жука остаётся ареной. */
    for (const room of world.faunaRooms) {
      if (toScreenX(room.ox) > view.w + ts * 8 || toScreenX(room.ox + room.w) < -ts * 8) continue;
      if (toScreenY(room.oy) > view.h + ts * 8 || toScreenY(room.oy + room.h) < -ts * 8) continue;
      drawFauna(
        ctx,
        room,
        toScreenX(room.centerX + 0.5),
        toScreenY(room.centerY + 0.5),
        ts,
        now
      );
    }

    const arena = world.beetleRoom;
    if (arena && !state.flags.beetleDone) {
      if (toScreenX(arena.ox) < view.w + ts * 8 && toScreenX(arena.ox + arena.w) > -ts * 8 &&
          toScreenY(arena.oy) < view.h + ts * 8 && toScreenY(arena.oy + arena.h) > -ts * 8) {
        drawArenaBeetle(
          ctx,
          toScreenX(arena.centerX + 0.5),
          toScreenY(arena.centerY + 0.5),
          ts,
          now
        );
      }
    }

    const umbrellaRoom = world.umbrellaRoom;
    if (umbrellaRoom && !state.flags.umbrellaDone) {
      if (toScreenX(umbrellaRoom.ox) < view.w + ts * 8 && toScreenX(umbrellaRoom.ox + umbrellaRoom.w) > -ts * 8 &&
          toScreenY(umbrellaRoom.oy) < view.h + ts * 8 && toScreenY(umbrellaRoom.oy + umbrellaRoom.h) > -ts * 8) {
        drawUmbrellaEnemy(
          ctx,
          toScreenX(umbrellaRoom.centerX + 0.5),
          toScreenY(umbrellaRoom.centerY + 0.5),
          ts,
          now
        );
      }
    }

    if (world.hazardRoom) {
      const room = world.hazardRoom;
      const visible = toScreenX(room.ox) < view.w + ts * 8 && toScreenX(room.ox + room.w) > -ts * 8;
      /* «Слепой зал» остался атмосферной комнатой, но без теней и урона. */
      if (visible) {
        ctx.save();
        ctx.fillStyle = 'rgba(0, 0, 0, 0.18)';
        ctx.fillRect(
          toScreenX(room.ox),
          toScreenY(room.oy),
          room.w * ts,
          room.h * ts
        );
        ctx.restore();
      }
    }

    for (const b of state.backpacks) {
      drawBackpack(ctx, b, toScreenX(b.x), toScreenY(b.y), ts, now);
    }

    if (state.flags.trialDone && !state.flags.cardTaken && world.trialRoom) {
      const r = world.trialRoom;
      drawCardPedestal(
        ctx,
        toScreenX(r.centerX + 0.5),
        toScreenY(r.centerY + 0.5) - ts * 0.25,
        ts,
        images,
        now
      );
    }

    drawCursorTarget(ctx, {
      cursor: params.cursor,
      toScreenX,
      toScreenY,
      ts,
      now
    });

    drawPlayer(
      ctx,
      state,
      toScreenX(state.player.x),
      toScreenY(state.player.y),
      ts,
      images
    );

    drawDust(ctx, { view, now, toScreenX, toScreenY, cam, ts });
  }

  function drawMap(canvas, state, world) {
    const { ctx, w, h } = makeCanvasSize(canvas);
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#0b0e0f';
    ctx.fillRect(0, 0, w, h);

    const hasMap = state.items.includes('map_fragment');
    const current = world.roomAtTile(Math.floor(state.player.x), Math.floor(state.player.y)) ||
      world.roomById(world.spawn.roomId);

    /* Карта показывает окрестности текущей комнаты. Мир бесконечен,
       поэтому окно всегда переезжает вместе с игроком. */
    const cols = 7;
    const rows = 5;
    const anchorX = current ? current.cx : 0;
    const anchorY = current ? current.cy : 0;
    const cellX0 = anchorX - Math.floor(cols / 2);
    const cellY0 = anchorY - Math.floor(rows / 2);

    world.ensureRange(
      cellX0 * world.stepX,
      cellY0 * world.stepY,
      (cellX0 + cols) * world.stepX - 1,
      (cellY0 + rows) * world.stepY - 1
    );

    const marginX = w * 0.06;
    const marginTop = Math.max(18, h * 0.09);
    const marginBottom = h * 0.16;
    const cellW = (w - marginX * 2) / cols;
    const cellH = (h - marginTop - marginBottom) / rows;
    const boxW = Math.min(cellW * 0.72, 52);
    const boxH = Math.min(cellH * 0.64, 34);

    const pos = (cx, cy) => ({
      x: marginX + (cx - cellX0 + 0.5) * cellW,
      y: marginTop + (cy - cellY0 + 0.5) * cellH
    });

    const inWindow = (room) => room &&
      room.cx >= cellX0 && room.cx < cellX0 + cols &&
      room.cy >= cellY0 && room.cy < cellY0 + rows;

    const cellRooms = new Map();
    for (const room of world.rooms) {
      if (inWindow(room)) cellRooms.set(`${room.cx},${room.cy}`, room);
    }
    const roomAtCell = (cx, cy) => cellRooms.get(`${cx},${cy}`) || null;

    const revealed = (room) => {
      if (!room) return false;
      if (hasMap) return true;
      if (state.visited[room.id]) return true;
      return room.links.some((id) => state.visited[id]);
    };

    /* Лёгкая сетка помогает читать окно даже там, где комнат ещё нет. */
    ctx.strokeStyle = 'rgba(160, 170, 160, 0.055)';
    ctx.lineWidth = 1;
    for (let cx = cellX0; cx < cellX0 + cols; cx++) {
      for (let cy = cellY0; cy < cellY0 + rows; cy++) {
        const p = pos(cx, cy);
        ctx.strokeRect(p.x - boxW / 2, p.y - boxH / 2, boxW, boxH);
      }
    }

    for (const edge of world.getEdges()) {
      if (!inWindow(edge.a) || !inWindow(edge.b)) continue;
      const A = pos(edge.a.cx, edge.a.cy);
      const B = pos(edge.b.cx, edge.b.cy);
      const ok = revealed(edge.a) && revealed(edge.b);
      if (!ok) continue;
      ctx.strokeStyle = 'rgba(186, 194, 184, 0.35)';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(A.x, A.y);
      ctx.lineTo(B.x, B.y);
      ctx.stroke();
    }

    for (let cy = cellY0; cy < cellY0 + rows; cy++) {
      for (let cx = cellX0; cx < cellX0 + cols; cx++) {
        const room = roomAtCell(cx, cy);
        if (!room) continue;
        const p = pos(cx, cy);
        const seen = Boolean(state.visited[room.id]);
        const rev = revealed(room);
        const isCurrent = current && current.id === room.id;
        const x = p.x - boxW / 2;
        const y = p.y - boxH / 2;

        if (rev) {
          ctx.fillStyle = seen ? 'rgba(49, 59, 58, 0.92)' : 'rgba(29, 36, 36, 0.7)';
          if (room.role === 'tablet') ctx.fillStyle = 'rgba(92, 55, 33, 0.92)';
          if (room.role === 'trial') ctx.fillStyle = 'rgba(77, 55, 34, 0.9)';
          roundedRect(ctx, x, y, boxW, boxH, 3);
          ctx.fill();
          ctx.strokeStyle = isCurrent
            ? '#d78345'
            : (seen ? 'rgba(203, 209, 194, 0.55)' : 'rgba(203, 209, 194, 0.18)');
          ctx.lineWidth = isCurrent ? 2 : 1;
          ctx.stroke();
        } else {
          ctx.fillStyle = 'rgba(22, 27, 27, 0.35)';
          roundedRect(ctx, x, y, boxW, boxH, 3);
          ctx.fill();
        }

        if (rev && (seen || hasMap || isCurrent)) {
          ctx.fillStyle = isCurrent ? '#f0d7b8' : 'rgba(218, 222, 208, 0.75)';
          ctx.font = `600 ${Math.max(7, Math.min(10, boxW / 3.4))}px Andika, sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          const words = room.name.split(' ');
          let line = '';
          let lineY = p.y - (words.length > 1 ? boxH * 0.18 : 0);
          for (let i = 0; i < words.length; i++) {
            const test = line ? `${line} ${words[i]}` : words[i];
            if (ctx.measureText(test).width > boxW - 4 && line) {
              ctx.fillText(line, p.x, lineY);
              line = words[i];
              lineY += Math.max(7, boxW / 3.4);
            } else {
              line = test;
            }
          }
          if (line) ctx.fillText(line, p.x, lineY);
        }

        if (room.role === 'tablet' && rev) {
          ctx.fillStyle = '#e08a4e';
          ctx.beginPath();
          ctx.arc(p.x + boxW * 0.31, p.y - boxH * 0.31, 2.6, 0, Math.PI * 2);
          ctx.fill();
        }
        if (room.role === 'trial' && rev) {
          ctx.strokeStyle = 'rgba(224, 138, 78, 0.8)';
          ctx.beginPath();
          ctx.arc(p.x - boxW * 0.31, p.y - boxH * 0.31, 2.8, 0, Math.PI * 2);
          ctx.stroke();
        }
        if (rev && state.mapMarks && state.mapMarks.includes(room.id)) {
          ctx.fillStyle = '#e8dfcf';
          ctx.beginPath();
          ctx.arc(p.x, p.y + boxH * 0.32, 2.2, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    for (const b of state.backpacks) {
      const room = world.roomById(b.roomId);
      if (!inWindow(room) || !revealed(room)) continue;
      const p = pos(room.cx, room.cy);
      ctx.fillStyle = '#c4763d';
      roundedRect(ctx, p.x - 4, p.y + boxH * 0.5 - 4, 8, 9, 2);
      ctx.fill();
      ctx.strokeStyle = '#e8bd8b';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(p.x - 2.5, p.y + boxH * 0.5 - 0.5);
      ctx.lineTo(p.x + 2.5, p.y + boxH * 0.5 - 0.5);
      ctx.stroke();
    }

    if (current) {
      const p = pos(current.cx, current.cy);
      ctx.strokeStyle = 'rgba(232, 230, 214, 0.9)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(p.x + boxW * 0.3, p.y + boxH * 0.3, 2.2, 0, Math.PI * 2);
      ctx.fillStyle = '#e8e6d6';
      ctx.fill();
    }

    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = 'rgba(213, 211, 196, 0.68)';
    ctx.font = `10px Andika, sans-serif`;
    ctx.fillText(
      hasMap ? 'ОБРЫВОК КАРТЫ · видны окрестности целиком' : 'ПАМЯТЬ · пройденное и соседние комнаты',
      marginX,
      h - marginBottom * 0.55
    );
    ctx.fillStyle = 'rgba(213, 211, 196, 0.4)';
    ctx.fillText('● ты   ▪ рюкзак   ○ метка', marginX, h - marginBottom * 0.2);
    if (current) {
      ctx.textAlign = 'right';
      ctx.fillStyle = 'rgba(222, 205, 178, 0.72)';
      ctx.fillText(current.name, w - marginX, h - marginBottom * 0.55);
    }

    return { w, h };
  }

  function prepareImages() {
    const images = {
      zemic: new Image(),
      tablet: new Image(),
      angel: new Image(),
      tabletTint: null
    };
    images.zemic.src = C.player.sprite;
    images.tablet.src = 'assets/img/tablet.png';
    images.angel.src = 'assets/img/angel.webp';
    images.tablet.onload = () => {
      images.tabletTint = tinted(images.tablet, '#d4773a');
    };
    return images;
  }

  window.Renderer = {
    drawWorld,
    drawMap,
    prepareImages,
    makeCanvasSize,
    tilePxFor,
    tileNoise,
    frameForPlayer,
    dustMotes,
    drawDust,
    drawCursorTarget
  };
})();
