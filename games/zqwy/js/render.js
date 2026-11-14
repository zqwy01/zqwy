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
    const d = C.display || {};
    const minCols = Number.isFinite(d.minViewCols) ? d.minViewCols : 14.5;
    const minRows = Number.isFinite(d.minViewRows) ? d.minViewRows : 13.2;
    const raw = Math.min(view.w / minCols, view.h / minRows);
    const lo = Number.isFinite(d.tileMin) ? d.tileMin : 11;
    const hi = Number.isFinite(d.tileMax) ? d.tileMax : 46;
    /* Никакого высокого пола: на узком экране тайл уменьшается, но
       кадр сохраняет обещанное число клеток по каждой оси. */
    return Math.max(lo, Math.min(hi, raw));
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

  /* Маршрут и выбранная клетка: курсор показывает не только точку,
     но и режим — куда ведёт путь и какой тайл сейчас выбран. */
  function drawCursorPlan(ctx, params) {
    const {
      cursorPath, cursorTile, cursorMode, cursorPathGoal,
      toScreenX, toScreenY, ts, now
    } = params;
    if (!cursorPath && !cursorTile) return;
    ctx.save();
    if (Array.isArray(cursorPath) && cursorPath.length > 1) {
      const pulse = 0.5 + 0.5 * Math.sin(now * 0.005);
      ctx.strokeStyle = `rgba(138, 204, 190, ${0.35 + pulse * 0.22})`;
      ctx.lineWidth = Math.max(1.1, ts * 0.055);
      ctx.setLineDash([ts * 0.22, ts * 0.16]);
      ctx.lineDashOffset = -(now * 0.02) % (ts * 0.38);
      ctx.beginPath();
      for (let i = 0; i < cursorPath.length; i += 1) {
        const point = cursorPath[i];
        const px = toScreenX(point.x);
        const py = toScreenY(point.y);
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
      ctx.setLineDash([]);
      const goal = cursorPath[cursorPath.length - 1];
      const gx = toScreenX(goal.x);
      const gy = toScreenY(goal.y);
      ctx.strokeStyle = `rgba(138, 204, 190, ${0.45 + pulse * 0.3})`;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.arc(gx, gy, ts * (0.22 + pulse * 0.05), 0, Math.PI * 2);
      ctx.stroke();
      if (cursorPathGoal) {
        const [gxTile, gyTile] = String(cursorPathGoal).split(',').map(Number);
        ctx.strokeStyle = 'rgba(138, 204, 190, 0.3)';
        ctx.strokeRect(
          toScreenX(gxTile) - ts * 0.02,
          toScreenY(gyTile) - ts * 0.02,
          ts * 1.04,
          ts * 1.04
        );
      }
    }
    if (cursorTile) {
      const [tx, ty] = String(cursorTile).split(',').map(Number);
      if (Number.isFinite(tx) && Number.isFinite(ty)) {
        const pulse = 0.5 + 0.5 * Math.sin(now * 0.006);
        const x = toScreenX(tx);
        const y = toScreenY(ty);
        ctx.fillStyle = `rgba(229, 161, 104, ${0.08 + pulse * 0.06})`;
        ctx.fillRect(x, y, ts, ts);
        ctx.strokeStyle = `rgba(229, 161, 104, ${0.65 + pulse * 0.25})`;
        ctx.lineWidth = 1.6;
        ctx.strokeRect(x + 1, y + 1, ts - 2, ts - 2);
        const modeLabel = cursorMode === 'inspect'
          ? 'осмотр'
          : cursorMode === 'path' ? 'путь' : 'клетка';
        ctx.fillStyle = 'rgba(229, 161, 104, 0.82)';
        ctx.font = `${Math.max(9, Math.round(ts * 0.26))}px sans-serif`;
        ctx.fillText(modeLabel, x + ts * 0.14, y + ts * 0.34);
      }
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

  /* Окрас и габарит конкретной жабы. Стаи не однородны между собой:
     у каждой особи свой узор и размер, но выбор детерминирован по
     месту обитания, поэтому жаба в зале всегда одна и та же. */
  function belzebufoLook(seed) {
    const meta = (C.fauna && C.fauna.belzebufo) || {};
    const palettes = Array.isArray(meta.palettes) && meta.palettes.length ? meta.palettes : null;
    const sizeRange = Array.isArray(meta.size) ? meta.size : [1, 1];
    const key = String(seed === undefined || seed === null ? '' : seed);
    let h = 2166136261;
    for (let i = 0; i < key.length; i += 1) {
      h ^= key.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    h >>>= 0;
    const index = palettes ? h % palettes.length : 0;
    const lo = Number.isFinite(sizeRange[0]) ? sizeRange[0] : 1;
    const hi = Number.isFinite(sizeRange[1]) ? sizeRange[1] : lo;
    const size = lo + (((h >>> 8) % 1000) / 1000) * (hi - lo);
    return { index, size, palette: palettes ? palettes[index] : null };
  }

  /* Бельзебуфо — полноценная жаба: тельце, брюшко, широкий рот,
     выпуклые глаза, согнутые задние лапы с перепонками и тонкие
     передние. Окрас и размер у каждой особи свои. */
  function drawBelzebufo(ctx, sx, sy, ts, now, enemy) {
    const look = (enemy && enemy.look) ? enemy.look : belzebufoLook(enemy && enemy.seed);
    const pal = look.palette || {
      body: '#7d9c2e', belly: '#e6e08a', spots: '#4a3a12',
      legs: '#5f7d22', eye: '#f2d64a', mouth: '#8a2f2f'
    };
    const size = Number.isFinite(look.size) ? look.size : 1;
    const r = ts * 0.54 * size;
    const pulse = 0.5 + 0.5 * Math.sin(now * 0.0022);
    const lift = enemy && Number.isFinite(enemy.hopHeight) ? enemy.hopHeight : 0;
    const charge = enemy && Number.isFinite(enemy.charge)
      ? Math.max(0, Math.min(1, enemy.charge))
      : 0;

    /* Присед, полёт и приземление меняют силуэт: жаба сжимается и
       вытягивается, как живая. */
    let scaleX = 1;
    let scaleY = 1;
    if (enemy) {
      if (enemy.hopState === 'crouch') {
        scaleX = 1.16;
        scaleY = 0.8;
      } else if (enemy.hopState === 'air') {
        const p = Number.isFinite(enemy.hopProgress)
          ? Math.max(0, Math.min(1, enemy.hopProgress))
          : 0;
        const stretch = Math.sin(p * Math.PI);
        scaleY = 1 + stretch * 0.2;
        scaleX = 1 - stretch * 0.12;
      } else if (enemy.landFlash > 0) {
        scaleX = 1 + enemy.landFlash * 0.26;
        scaleY = 1 - enemy.landFlash * 0.22;
      }
    }

    /* Жаба чуть поворачивается к цели, но остаётся узнаваемой анфас. */
    const face = enemy && Number.isFinite(enemy.facing)
      ? enemy.facing
      : (enemy && (enemy.facingX || enemy.facingY)
        ? Math.atan2(enemy.facingY || 0, enemy.facingX || 0)
        : Math.PI / 2);
    const flip = Math.cos(face) < 0 ? -1 : 1;

    /* Тень остаётся на земле и уменьшается, пока жаба в воздухе. */
    const shadowK = 1 / (1 + lift * 0.8);
    ctx.save();
    ctx.translate(sx, sy);
    ctx.fillStyle = `rgba(0, 0, 0, ${0.42 * shadowK})`;
    ctx.beginPath();
    ctx.ellipse(0, r * 0.72, r * 1.15 * shadowK, r * 0.34 * shadowK, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.translate(sx, sy - lift * ts);
    ctx.scale(scaleX * flip, scaleY);

    /* Задние лапы: согнутые, с широкими перепончатыми ступнями. */
    const hindLeg = (side) => {
      ctx.save();
      ctx.scale(side, 1);
      ctx.fillStyle = pal.legs;
      ctx.beginPath();
      ctx.ellipse(r * 0.62, r * 0.34, r * 0.42, r * 0.3, -0.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = pal.legs;
      ctx.lineWidth = Math.max(2, r * 0.26);
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(r * 0.72, r * 0.3);
      ctx.quadraticCurveTo(r * 1.05, r * 0.5, r * 0.82, r * 0.78);
      ctx.stroke();
      ctx.fillStyle = pal.legs;
      ctx.beginPath();
      ctx.ellipse(r * 0.82, r * 0.86, r * 0.34, r * 0.16, 0.1, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(20, 26, 12, 0.5)';
      ctx.lineWidth = Math.max(1, r * 0.04);
      for (let i = -1; i <= 1; i += 1) {
        ctx.beginPath();
        ctx.moveTo(r * 0.82 + i * r * 0.12, r * 0.78);
        ctx.lineTo(r * 0.82 + i * r * 0.2, r * 0.98);
        ctx.stroke();
      }
      ctx.restore();
    };
    hindLeg(-1);
    hindLeg(1);

    /* Тело. */
    const body = ctx.createRadialGradient(-r * 0.25, -r * 0.4, r * 0.12, 0, 0, r * 1.25);
    body.addColorStop(0, pal.belly);
    body.addColorStop(0.5, pal.body);
    body.addColorStop(1, pal.spots);
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.ellipse(0, 0, r, r * 0.86, 0, 0, Math.PI * 2);
    ctx.fill();

    /* Брюшко. */
    ctx.fillStyle = pal.belly;
    ctx.beginPath();
    ctx.ellipse(0, r * 0.22, r * 0.7, r * 0.5, 0, 0, Math.PI * 2);
    ctx.fill();

    /* Бородавки и пятна на спине. */
    ctx.fillStyle = pal.spots;
    for (const [px, py, pr] of [
      [-0.42, -0.16, 0.16], [0.36, -0.2, 0.18], [-0.1, -0.44, 0.12],
      [0.14, 0.06, 0.1], [-0.28, 0.16, 0.1]
    ]) {
      ctx.beginPath();
      ctx.arc(px * r, py * r, pr * r, 0, Math.PI * 2);
      ctx.fill();
    }

    /* Передние лапы: тонкие, опираются на землю. */
    const foreLeg = (side) => {
      ctx.save();
      ctx.scale(side, 1);
      ctx.strokeStyle = pal.body;
      ctx.lineWidth = Math.max(1.6, r * 0.12);
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(r * 0.22, r * 0.2);
      ctx.quadraticCurveTo(r * 0.34, r * 0.56, r * 0.2, r * 0.86);
      ctx.stroke();
      ctx.fillStyle = pal.legs;
      ctx.beginPath();
      ctx.ellipse(r * 0.2, r * 0.9, r * 0.14, r * 0.08, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    };
    foreLeg(-1);
    foreLeg(1);

    /* Горловой мешок: раздувается, когда жаба набирает яд. */
    const throat = 1 + charge * 0.35 + pulse * 0.06;
    ctx.fillStyle = pal.belly;
    ctx.beginPath();
    ctx.ellipse(0, r * 0.42, r * 0.42 * throat, r * 0.3 * throat, 0, 0, Math.PI * 2);
    ctx.fill();

    /* Голова. */
    ctx.fillStyle = pal.body;
    ctx.beginPath();
    ctx.ellipse(0, -r * 0.46, r * 0.72, r * 0.5, 0, 0, Math.PI * 2);
    ctx.fill();

    /* Широкий рот. */
    ctx.strokeStyle = pal.mouth;
    ctx.lineWidth = Math.max(1.5, r * 0.07);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-r * 0.62, -r * 0.34);
    ctx.quadraticCurveTo(0, -r * 0.1 - charge * r * 0.06, r * 0.62, -r * 0.34);
    ctx.stroke();

    /* Ноздри. */
    ctx.fillStyle = pal.spots;
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(side * r * 0.16, -r * 0.72, Math.max(1, r * 0.045), 0, Math.PI * 2);
      ctx.fill();
    }

    /* Выпуклые глаза сверху. */
    for (const side of [-1, 1]) {
      const ex = side * r * 0.5;
      const ey = -r * 0.78;
      ctx.fillStyle = pal.body;
      ctx.beginPath();
      ctx.arc(ex, ey, r * 0.26, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#f2efd6';
      ctx.beginPath();
      ctx.arc(ex, ey - r * 0.02, r * 0.19, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#14140c';
      ctx.beginPath();
      ctx.arc(ex + side * r * 0.02, ey, r * 0.1, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
      ctx.beginPath();
      ctx.arc(ex - side * r * 0.05, ey - r * 0.06, r * 0.04, 0, Math.PI * 2);
      ctx.fill();
    }

    /* Едва заметный ядовитый ореол и свечение пасти при заряде залпа. */
    ctx.strokeStyle = `rgba(196, 214, 74, ${0.08 + pulse * 0.1 + charge * 0.25})`;
    ctx.lineWidth = Math.max(1, ts * 0.05);
    ctx.beginPath();
    ctx.arc(0, 0, r * (1.25 + pulse * 0.18 + charge * 0.1), 0, Math.PI * 2);
    ctx.stroke();
    if (charge > 0.02) {
      const glow = ctx.createRadialGradient(0, -r * 0.2, r * 0.05, 0, -r * 0.2, r * 0.7);
      glow.addColorStop(0, `rgba(236, 250, 150, ${0.55 * charge})`);
      glow.addColorStop(1, 'rgba(180, 230, 90, 0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(0, -r * 0.2, r * 0.7, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawTitanoboa(ctx, sx, sy, ts, now, room) {
    const roomW = Math.max(6, room ? room.w : 10);
    const roomH = Math.max(5, room ? room.h : 8);
    const spanX = Math.max(ts * 3, roomW * ts * 0.62);
    const spanY = Math.max(ts * 2, roomH * ts * 0.6);
    const thickness = Math.max(ts * 0.34, Math.min(roomW, roomH) * ts * 0.11);
    const t = now * 0.00028;
    const segments = 20;
    const points = [];
    for (let i = 0; i < segments; i += 1) {
      const u = i / (segments - 1);
      /* Змея не лежит кольцами: она медленно перетекает по залу,
         оставляя длинное тело в проходах. */
      const x = (u - 0.5) * spanX * 1.08 +
        Math.sin(u * 5.4 + t * 2.1) * spanX * 0.07;
      const y = Math.sin(u * 4.2 - t * 1.3) * spanY * 0.44 +
        Math.cos(u * 2.2 + t) * spanY * 0.09;
      points.push({ x: x, y: y, r: thickness * (1 - u * 0.46) });
    }

    ctx.save();
    ctx.translate(sx, sy);

    /* Тень лежит на полу и смещена вправо-вниз: она не «висит» над
       змеёй, а повторяет её тело с естественным сдвигом. */
    ctx.save();
    ctx.translate(ts * 0.42, ts * 0.66);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.28)';
    for (const point of points) {
      ctx.beginPath();
      ctx.ellipse(point.x, point.y + ts * 0.12, point.r * 1.28, point.r * 0.7, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    /* Тело: тёмные и светлые сегменты, без резких «колец». */
    for (let i = points.length - 1; i >= 0; i -= 1) {
      const point = points[i];
      const body = ctx.createRadialGradient(
        point.x - point.r * 0.3,
        point.y - point.r * 0.35,
        point.r * 0.1,
        point.x,
        point.y,
        point.r * 1.2
      );
      body.addColorStop(0, i % 2 === 0 ? '#a39b63' : '#948c59');
      body.addColorStop(0.55, '#6f6b46');
      body.addColorStop(1, '#3d3b29');
      ctx.fillStyle = body;
      ctx.beginPath();
      ctx.ellipse(point.x, point.y, point.r * 1.12, point.r, 0, 0, Math.PI * 2);
      ctx.fill();
      if (i % 3 === 0) {
        ctx.strokeStyle = 'rgba(32, 30, 20, 0.42)';
        ctx.lineWidth = Math.max(1, point.r * 0.2);
        ctx.beginPath();
        ctx.ellipse(point.x, point.y, point.r * 0.68, point.r * 0.54, 0.35, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    /* Голова тянется к проходу и покачивается. */
    const head = points[0];
    const neck = points[1] || head;
    const angle = Math.atan2(head.y - neck.y, head.x - neck.x);
    ctx.save();
    ctx.translate(head.x, head.y);
    ctx.rotate(angle);
    const headR = thickness * 1.18;
    const headFill = ctx.createRadialGradient(-headR * 0.3, -headR * 0.35, headR * 0.12, 0, 0, headR);
    headFill.addColorStop(0, '#b4ab70');
    headFill.addColorStop(0.6, '#7d764d');
    headFill.addColorStop(1, '#453f2b');
    ctx.fillStyle = headFill;
    ctx.beginPath();
    ctx.ellipse(0, 0, headR * 1.2, headR * 0.78, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(232, 176, 82, 0.9)';
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(headR * 0.26, side * headR * 0.34, headR * 0.12, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.strokeStyle = 'rgba(132, 42, 30, 0.86)';
    ctx.lineWidth = Math.max(1, headR * 0.07);
    ctx.beginPath();
    ctx.moveTo(headR * 0.55, 0);
    ctx.lineTo(headR * 1.16, 0);
    ctx.stroke();
    ctx.restore();
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

  /* Рисунок на парусе. Координаты локальные: парус уже нарисован и
     обрезан по контуру, поэтому рисунок не вылезает за него. */
  function drawSailPattern(ctx, pattern, r, sailH) {
    if (pattern === 'bands') {
      for (let i = 0; i < 4; i += 1) {
        const y = -sailH * (0.15 + i * 0.22);
        ctx.beginPath();
        ctx.moveTo(-r * 0.5, y);
        ctx.quadraticCurveTo(0, y + r * 0.08, r * 0.5, y);
        ctx.stroke();
      }
      return;
    }
    if (pattern === 'spots') {
      for (const [px, py, pr] of [
        [-0.28, -0.5, 0.11], [0.05, -0.78, 0.09], [0.26, -0.4, 0.1],
        [-0.05, -0.28, 0.08], [0.12, -0.15, 0.07]
      ]) {
        ctx.beginPath();
        ctx.arc(px * r, py * sailH, Math.max(1, pr * r), 0, Math.PI * 2);
        ctx.fill();
      }
      return;
    }
    if (pattern === 'eyes') {
      for (const [px, py, pr] of [[-0.18, -0.55, 0.16], [0.18, -0.4, 0.13]]) {
        const cx = px * r;
        const cy = py * sailH;
        const rad = Math.max(1.5, pr * r);
        ctx.beginPath();
        ctx.arc(cx, cy, rad, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(cx, cy, rad * 0.45, 0, Math.PI * 2);
        ctx.fill();
      }
      return;
    }
    if (pattern === 'stripes') {
      for (let i = -2; i <= 2; i += 1) {
        ctx.beginPath();
        ctx.moveTo(-r * 0.5 + i * r * 0.2, r * 0.05);
        ctx.lineTo(-r * 0.1 + i * r * 0.2, -sailH * 0.95);
        ctx.stroke();
      }
      return;
    }
    if (pattern === 'diamond') {
      for (let i = 0; i < 3; i += 1) {
        const cx = (-0.25 + i * 0.28) * r;
        const cy = -sailH * (0.35 + (i % 2) * 0.2);
        const s = r * 0.14;
        ctx.beginPath();
        ctx.moveTo(cx, cy - s);
        ctx.lineTo(cx + s, cy);
        ctx.lineTo(cx, cy + s);
        ctx.lineTo(cx - s, cy);
        ctx.closePath();
        ctx.stroke();
      }
      return;
    }
    /* 'rays' и всё остальное: лучи расходятся от основания паруса. */
    for (let i = 0; i < 5; i += 1) {
      const t = i / 4;
      ctx.beginPath();
      ctx.moveTo(-r * 0.5 + t * r * 0.9, r * 0.05);
      ctx.lineTo(-r * 0.35 + t * r * 0.8, -sailH * (0.55 + 0.35 * Math.sin(t * Math.PI)));
      ctx.stroke();
    }
  }

  /* Зов: расходящиеся дуги у головы, когда зверь подаёт голос. */
  function drawDimetrodonCall(ctx, sx, sy, r, facing, call) {
    const headX = sx + Math.cos(facing) * r * 0.9;
    const headY = sy + Math.sin(facing) * r * 0.9;
    ctx.save();
    ctx.lineCap = 'round';
    for (let i = 0; i < 3; i += 1) {
      const phase = (call * 1.6 + i * 0.3) % 1;
      const radius = r * (0.35 + phase * 0.7);
      const alpha = (1 - phase) * (0.3 + call * 0.45);
      ctx.strokeStyle = `rgba(255, 244, 200, ${alpha})`;
      ctx.lineWidth = Math.max(1, r * 0.06 * (1 - phase * 0.5));
      ctx.beginPath();
      ctx.arc(headX, headY, radius, -0.9, 0.9);
      ctx.stroke();
    }
    ctx.restore();
  }

  /* Брачная демонстрация: парус горит, вокруг зверя идут кольца. */
  function drawDimetrodonDisplay(ctx, sx, sy, r, display) {
    const pulse = Math.sin(display * Math.PI);
    ctx.save();
    ctx.strokeStyle = `rgba(255, 240, 180, ${0.15 + pulse * 0.4})`;
    ctx.lineWidth = Math.max(1, r * 0.08);
    for (let i = 0; i < 2; i += 1) {
      const phase = (display * 1.2 + i * 0.5) % 1;
      ctx.beginPath();
      ctx.arc(sx, sy - r * 0.2, r * (0.6 + phase * 1.1), 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  /* Круги на воде: зверь гребёт, по поверхности идут волны. */
  function drawDimetrodonRipples(ctx, sx, sy, r, now, ph) {
    ctx.save();
    ctx.strokeStyle = 'rgba(180, 230, 232, 0.4)';
    ctx.lineWidth = Math.max(1, r * 0.05);
    for (let i = 0; i < 2; i += 1) {
      const phase = (now * 0.0012 + i * 0.5 + ph) % 1;
      ctx.globalAlpha = (1 - phase) * 0.5;
      ctx.beginPath();
      ctx.ellipse(
        sx, sy + r * 0.2,
        r * (0.7 + phase * 0.9), r * (0.3 + phase * 0.4),
        0, 0, Math.PI * 2
      );
      ctx.stroke();
    }
    ctx.restore();
  }

  /* Диметродон теперь живой: fauna.js передаёт направление (angle),
     фазу шага и признак движения. Облик стаи (look) задаёт палитру,
     размер, парус и состояния общения: зов и демонстрацию. */
  function drawDimetrodon(ctx, sx, sy, ts, now, phase, angle, moving, action, actionPhase, look) {
    const L = look || {};
    const pack = L.pack || null;
    const size = Number.isFinite(L.size) ? L.size : 1;
    const sailScale = Number.isFinite(L.sailScale) ? L.sailScale : 1;
    const bodyColor = pack && pack.body ? pack.body : '#5a5a3c';
    const bellyColor = pack && pack.belly ? pack.belly : '#6c6844';
    const sailColor = pack && pack.sail ? pack.sail : '#b45c36';
    const sailHi = pack && pack.sailHi ? pack.sailHi : '#ffd27a';
    const ridgeColor = pack && pack.ridge ? pack.ridge : '#432711';
    const pattern = pack && pack.pattern ? pack.pattern : 'rays';
    const call = Number.isFinite(L.call) ? L.call : 0;
    const display = Number.isFinite(L.display) ? L.display : 0;
    const swimming = Boolean(L.swimming);

    const r = Math.max(ts * 0.5, ts * 0.48) * size;
    const ph = Number.isFinite(phase) ? phase : 0;
    const walk = moving === false ? 0.25 : 1;
    const sway = Math.sin(now * 0.0016 * (1 + walk) + ph * 1.7) * 0.05 * walk;
    const facing = Number.isFinite(angle) ? angle : ph * 1.9;
    const feeding = action === 'eat' || action === 'drink';
    const feedPhase = Number.isFinite(actionPhase) ? Math.max(0, Math.min(1, actionPhase)) : 1;
    const dip = feeding ? Math.sin(feedPhase * Math.PI) : 0;
    const rise = display > 0 ? Math.sin(display * Math.PI) : 0;
    const bob = swimming ? Math.sin(now * 0.004 + ph) * r * 0.06 : 0;
    const sink = swimming ? r * 0.16 : 0;
    /* Корпус покачивается в такт шагу — зверь не скользит, а идёт. */
    const bodyBob = moving === false ? 0 : Math.sin(now * 0.012 * walk + ph) * r * 0.03;

    ctx.save();
    ctx.translate(sx, sy + sink + bob + bodyBob);
    ctx.rotate(facing + sway);

    /* Тень. */
    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
    ctx.beginPath();
    ctx.ellipse(0, r * 0.6, r * 1.1, r * 0.3, 0, 0, Math.PI * 2);
    ctx.fill();

    /* Тело. */
    ctx.strokeStyle = bodyColor;
    ctx.lineWidth = Math.max(2, r * 0.34);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-r * 1.1, r * 0.1);
    ctx.quadraticCurveTo(-r * 0.4, -r * 0.05, r * 0.7, r * 0.16);
    ctx.stroke();
    /* Хвост виляет из стороны в сторону в такт шагу: тонкий, живой. */
    const tailSway = Math.sin(now * 0.006 * walk + ph) * r * 0.26 * walk;
    ctx.strokeStyle = bodyColor;
    ctx.lineWidth = Math.max(1.6, r * 0.24);
    ctx.beginPath();
    ctx.moveTo(-r * 1.1, r * 0.1);
    ctx.quadraticCurveTo(-r * 1.5, r * 0.05 + tailSway * 0.4, -r * 1.98, r * 0.16 + tailSway);
    ctx.stroke();
    /* Светлое брюхо вдоль тела. */
    ctx.save();
    ctx.globalAlpha = 0.5;
    ctx.strokeStyle = bellyColor;
    ctx.lineWidth = Math.max(1, r * 0.1);
    ctx.beginPath();
    ctx.moveTo(-r * 0.9, r * 0.22);
    ctx.quadraticCurveTo(-r * 0.2, r * 0.14, r * 0.6, r * 0.26);
    ctx.stroke();
    ctx.restore();

    /* Парус на спине: яркий, с рисунком стаи. У демонстрации он
       разгорается особенно сильно. */
    const sailH = r * sailScale;
    const glow = display > 0 ? Math.sin(display * Math.PI) : 0;
    const sailGrad = ctx.createLinearGradient(0, -sailH * 1.1, 0, r * 0.1);
    sailGrad.addColorStop(0, sailHi);
    sailGrad.addColorStop(0.55, sailColor);
    sailGrad.addColorStop(1, ridgeColor);
    const sailPath = () => {
      ctx.beginPath();
      ctx.moveTo(-r * 0.58, r * 0.02);
      ctx.quadraticCurveTo(-r * 0.2, -sailH * 1.05, r * 0.3, -sailH * 0.72);
      ctx.quadraticCurveTo(r * 0.52, -sailH * 0.3, r * 0.52, r * 0.06);
      ctx.closePath();
    };
    if (glow > 0) {
      ctx.save();
      ctx.globalAlpha = 0.45 * glow;
      ctx.fillStyle = sailHi;
      sailPath();
      ctx.fill();
      ctx.restore();
    }
    sailPath();
    ctx.fillStyle = sailGrad;
    ctx.fill();
    ctx.save();
    ctx.clip();
    ctx.globalAlpha = 0.6;
    ctx.strokeStyle = sailHi;
    ctx.fillStyle = sailHi;
    ctx.lineWidth = Math.max(1, r * 0.045);
    drawSailPattern(ctx, pattern, r, sailH);
    ctx.restore();
    ctx.strokeStyle = `rgba(255, 255, 255, ${0.2 + glow * 0.5})`;
    ctx.lineWidth = Math.max(1, r * 0.03);
    sailPath();
    ctx.stroke();

    /* Голова. При трапезе она опускается к земле и открывает пасть,
       при демонстрации — вскидывается вверх. В покое чуть покачивается. */
    const headBob = moving === false ? Math.sin(now * 0.0022 + ph) * r * 0.02 : 0;
    const headX = r * 0.82 - dip * r * 0.18;
    const headY = r * 0.08 + dip * r * 0.42 - rise * r * 0.12 + headBob;
    ctx.fillStyle = bodyColor;
    ctx.beginPath();
    ctx.ellipse(headX, headY, r * 0.3, r * 0.2, 0.1, 0, Math.PI * 2);
    ctx.fill();
    if (dip > 0.02) {
      ctx.strokeStyle = 'rgba(30, 24, 16, 0.75)';
      ctx.lineWidth = Math.max(1, r * 0.05);
      ctx.beginPath();
      ctx.moveTo(headX + r * 0.05, headY + r * 0.04);
      ctx.lineTo(headX + r * 0.3, headY + r * 0.1 * dip);
      ctx.stroke();
    }
    /* Глаз мигает время от времени. */
    const blinkCycle = (now * 0.0006 + ph * 0.37) % 1;
    const blinking = blinkCycle > 0.955;
    if (blinking) {
      ctx.strokeStyle = ridgeColor;
      ctx.lineWidth = Math.max(1, r * 0.03);
      ctx.beginPath();
      ctx.moveTo(headX + r * 0.02, headY - r * 0.03);
      ctx.lineTo(headX + r * 0.14, headY - r * 0.03);
      ctx.stroke();
    } else {
      ctx.fillStyle = `rgba(255, 236, 170, ${0.7 + 0.3 * Math.sin(now * 0.004 + ph)})`;
      ctx.beginPath();
      ctx.arc(headX + r * 0.08, headY - r * 0.03, r * 0.055, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#1a140c';
      ctx.beginPath();
      ctx.arc(headX + r * 0.085, headY - r * 0.03, r * 0.026, 0, Math.PI * 2);
      ctx.fill();
    }

    /* Лапы: полноценный шаг — бедро, ступня, подъём в фазе переноса. */
    ctx.strokeStyle = ridgeColor;
    ctx.lineWidth = Math.max(1.4, r * 0.09);
    ctx.lineCap = 'round';
    const legPairs = [[-0.42, 0], [0.42, Math.PI]];
    for (const side of [-1, 1]) {
      for (const leg of legPairs) {
        const dx = leg[0];
        const cyc = now * 0.006 * walk + ph + leg[1];
        const step = Math.sin(cyc);
        const lift = Math.max(0, Math.cos(cyc)) * r * 0.13 * walk;
        const hipX = dx * r;
        const hipY = r * 0.12;
        const footX = dx * r + side * r * 0.18 + step * r * 0.2 * walk;
        const footY = r * 0.44 - lift;
        ctx.beginPath();
        ctx.moveTo(hipX, hipY);
        ctx.quadraticCurveTo(hipX + side * r * 0.22, (hipY + footY) * 0.5, footX, footY);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(footX, footY);
        ctx.lineTo(footX + side * r * 0.12, footY + r * 0.05);
        ctx.stroke();
      }
    }
    ctx.restore();

    /* Общение и вода рисуются в экранных координатах поверх тела. */
    if (call > 0) drawDimetrodonCall(ctx, sx, sy, r, facing, call);
    if (display > 0) drawDimetrodonDisplay(ctx, sx, sy, r, display);
    if (swimming) drawDimetrodonRipples(ctx, sx, sy, r, now, ph);
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
    if (room.faunaKind === 'belzebufo') drawBelzebufo(ctx, sx, sy, ts, now, { seed: room.id });
    else if (room.faunaKind === 'titanoboa') drawTitanoboa(ctx, sx, sy, ts, now, room);
    /* Диметродоны больше не статичная сцена зала: это живые мобы,
       которых ведёт fauna.js и рисует ZQ.drawFaunaWorld. */
  }

  /* Вид активной схватки: нужен, чтобы статичная сцена уступала место
     преследующей сущности. */
  function activeBattleKind() {
    const zq = window.ZQ;
    const battle = zq && zq.rt && zq.rt.battle;
    return battle && battle.active ? battle.kind : null;
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

    /* Вода, камыш и кувшинки залов: рисуются под всеми сценами, чтобы
       жаба и звери стояли поверх собственного болота или пруда. */
    if (typeof window.ZQ !== 'undefined' && typeof window.ZQ.drawFaunaFeatures === 'function') {
      window.ZQ.drawFaunaFeatures(ctx, {
        state,
        world,
        view,
        ts,
        toScreenX,
        toScreenY,
        now
      });
    }

    /* Фауна живёт в своих комнатах и не мешает проходу: это сцена,
       а не противник. Комната человека-жука остаётся ареной. */
    for (const room of world.faunaRooms) {
      if (toScreenX(room.ox) > view.w + ts * 8 || toScreenX(room.ox + room.w) < -ts * 8) continue;
      if (toScreenY(room.oy) > view.h + ts * 8 || toScreenY(room.oy + room.h) < -ts * 8) continue;
      if (room.faunaKind === 'titanoboa' && state.flags.titanoboaCalm) continue;
      /* Пока бельзебуфо гонится за аксолотлем, статичная жаба в центре
         зала не рисуется: её ведёт боевая система. */
      if (room.faunaKind === 'belzebufo' && activeBattleKind() === 'belzebufo') continue;
      drawFauna(
        ctx,
        room,
        toScreenX(room.centerX + 0.5),
        toScreenY(room.centerY + 0.5),
        ts,
        now
      );
    }

    /* Живые диметродоны ползают по настоящим клеткам мира. Рисуются
       поверх пола, но под змеёй и аксолотлем. */
    if (typeof window.ZQ !== 'undefined' && typeof window.ZQ.drawFaunaWorld === 'function') {
      window.ZQ.drawFaunaWorld(ctx, {
        state,
        world,
        view,
        ts,
        toScreenX,
        toScreenY,
        now
      });
    }

    /* Бельзебуфо, поджидающие в проходах: они не в комнатах, поэтому
       рисуются отдельно от статичных сцен залов. */
    const zq = window.ZQ;
    const roam = zq && zq.rt && zq.rt.roam;
    if (roam && Array.isArray(roam.belzebufos) && roam.belzebufos.length) {
      for (const frog of roam.belzebufos) {
        const x = toScreenX(frog.x);
        const y = toScreenY(frog.y);
        if (x < -ts * 2 || x > view.w + ts * 2 || y < -ts * 2 || y > view.h + ts * 2) continue;
        drawBelzebufo(ctx, x, y, ts, now, frog);
      }
    }

    const arena = world.beetleRoom;
    if (arena && !state.flags.beetleDone && activeBattleKind() !== 'beetle') {
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
    if (umbrellaRoom && !state.flags.umbrellaDone && activeBattleKind() !== 'umbrella') {
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

    /* Титанобоа ползёт по настоящим клеткам мира. Тело рисуется под
       аксолотлем, но поверх пола, стен и предметов. */
    if (typeof window.ZQ !== 'undefined' && typeof window.ZQ.drawChaseWorld === 'function') {
      window.ZQ.drawChaseWorld(ctx, {
        state,
        world,
        view,
        ts,
        toScreenX,
        toScreenY,
        now
      });
    }

    drawCursorPlan(ctx, {
      cursorPath: params.cursorPath,
      cursorTile: params.cursorTile,
      cursorMode: params.cursorMode,
      cursorPathGoal: params.cursorPathGoal,
      toScreenX,
      toScreenY,
      ts,
      now
    });

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

    /* Снаряды, след рывка и раскрытый зонт живут в тех же мировых
       координатах, что и Zemic. */
    if (typeof window.ZQ !== 'undefined' && typeof window.ZQ.drawBattleWorld === 'function') {
      window.ZQ.drawBattleWorld(ctx, {
        state,
        world,
        view,
        ts,
        toScreenX,
        toScreenY,
        now
      });
    }

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
    drawCursorTarget,
    drawBelzebufo,
    belzebufoLook,
    drawArenaBeetle,
    drawUmbrellaEnemy,
    drawDimetrodon
  };
})();
