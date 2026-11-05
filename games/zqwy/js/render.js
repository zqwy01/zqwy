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

  function drawShadow(ctx, sx, sy, ts, now, phase) {
    const wob = Math.sin(now * 0.003 + phase) * 0.12;
    const r = ts * (0.48 + wob);
    ctx.save();
    ctx.translate(sx, sy);
    const g = ctx.createRadialGradient(0, 0, r * 0.1, 0, 0, r * 1.25);
    g.addColorStop(0, 'rgba(4, 6, 7, 0.96)');
    g.addColorStop(0.55, 'rgba(7, 10, 11, 0.9)');
    g.addColorStop(1, 'rgba(10, 13, 14, 0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2;
      const rr = r * (1 + Math.sin(a * 3 + now * 0.004 + phase) * 0.13);
      const px = Math.cos(a) * rr;
      const py = Math.sin(a) * rr * 0.72;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = `rgba(197, 93, 38, ${0.18 + 0.08 * Math.sin(now * 0.005 + phase)})`;
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.12, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function frameForPlayer(state) {
    const p = state.player;
    const vx = p.facingX;
    const vy = p.facingY;
    let base = 0;
    const horizontal = Math.abs(vx) > 0.3;
    const vertical = Math.abs(vy) > 0.3;
    if (horizontal && vertical) {
      if (vy > 0) base = vx < 0 ? 8 : 12;
      else base = vx < 0 ? 24 : 28;
    } else if (horizontal) {
      base = vx < 0 ? 16 : 20;
    } else {
      base = vy < 0 ? 4 : 0;
    }
    if (!p.moving) return base;
    const frame = Math.floor(state.animTime * 8) % 3 + 1;
    return base + frame;
  }

  function drawPlayer(ctx, state, sx, sy, ts, images) {
    const frame = frameForPlayer(state);
    const fw = C.player.spriteFrameW;
    const fh = C.player.spriteFrameH;
    const srcX = (frame % 40) * fw;
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

  function drawDust(ctx, view, now) {
    ctx.save();
    for (let i = 0; i < 26; i++) {
      const seed = i * 91.17;
      const x = ((seed * 13.3 + now * 0.003 * (0.3 + (i % 5) * 0.08)) % (view.w + 40)) - 20;
      const y = ((Math.sin(seed) * 0.5 + 0.5) * view.h + now * 0.004 * ((i % 3) + 1)) % (view.h + 20);
      const a = 0.04 + 0.09 * (0.5 + 0.5 * Math.sin(now * 0.001 + i));
      ctx.fillStyle = `rgba(220, 226, 216, ${a})`;
      ctx.beginPath();
      ctx.arc(x, y, (i % 3) * 0.5 + 0.7, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
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

    const halfW = view.w / (2 * ts);
    const halfH = view.h / (2 * ts);
    let cx = cam.x;
    let cy = cam.y;
    if (world.width <= halfW * 2) cx = world.width / 2;
    else cx = Math.max(halfW, Math.min(world.width - halfW, cx));
    if (world.height <= halfH * 2) cy = world.height / 2;
    else cy = Math.max(halfH, Math.min(world.height - halfH, cy));

    const offsetX = view.w / 2 - cx * ts;
    const offsetY = view.h / 2 - cy * ts;
    const toScreenX = (tx) => offsetX + tx * ts;
    const toScreenY = (ty) => offsetY + ty * ts;

    const startX = Math.max(0, Math.floor(-offsetX / ts) - 1);
    const endX = Math.min(world.width - 1, Math.ceil((view.w - offsetX) / ts) + 1);
    const startY = Math.max(0, Math.floor(-offsetY / ts) - 1);
    const endY = Math.min(world.height - 1, Math.ceil((view.h - offsetY) / ts) + 1);

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
      if (toScreenX(room.ox) > view.w + ts * 6 || toScreenX(room.ox + C.world.ROOM_W) < -ts * 6) continue;
      if (toScreenY(room.oy) > view.h + ts * 6 || toScreenY(room.oy + C.world.ROOM_H) < -ts * 6) continue;
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

    if (world.hazardRoom) {
      const room = world.hazardRoom;
      const visible = toScreenX(room.ox) < view.w + ts * 8 && toScreenX(room.ox + C.world.ROOM_W) > -ts * 8;
      if (visible) {
        for (const shadow of world.shadows) {
          const angle = now * 0.001 * shadow.speed + shadow.phase;
          const px = shadow.cx + Math.cos(angle) * shadow.rx;
          const py = shadow.cy + Math.sin(angle * 1.13) * shadow.ry;
          drawShadow(ctx, toScreenX(px), toScreenY(py), ts, now, shadow.phase);
        }
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

    drawPlayer(
      ctx,
      state,
      toScreenX(state.player.x),
      toScreenY(state.player.y),
      ts,
      images
    );

    drawDust(ctx, view, now);
  }

  function drawMap(canvas, state, world) {
    const { ctx, w, h } = makeCanvasSize(canvas);
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#0b0e0f';
    ctx.fillRect(0, 0, w, h);

    const hasMap = state.items.includes('map_fragment');
    const grid = C.world.GRID;
    const marginX = w * 0.08;
    const marginTop = h * 0.07;
    const marginBottom = h * 0.13;
    const cellW = (w - marginX * 2) / grid;
    const cellH = (h - marginTop - marginBottom) / grid;
    const boxW = cellW * 0.64;
    const boxH = cellH * 0.58;

    const pos = (cx, cy) => ({
      x: marginX + (cx + 0.5) * cellW,
      y: marginTop + (cy + 0.5) * cellH
    });

    const revealed = (room) => {
      if (!room) return false;
      if (hasMap) return true;
      if (state.visited[room.id]) return true;
      return room.links.some((id) => state.visited[id]);
    };

    for (const edge of world.edges) {
      if (!edge.a || !edge.b) continue;
      const A = pos(edge.a.cx, edge.a.cy);
      const B = pos(edge.b.cx, edge.b.cy);
      const ok = revealed(edge.a) && revealed(edge.b);
      ctx.strokeStyle = ok ? 'rgba(186, 194, 184, 0.35)' : 'rgba(186, 194, 184, 0.08)';
      ctx.lineWidth = ok ? 1.4 : 1;
      ctx.setLineDash(ok ? [] : [3, 5]);
      ctx.beginPath();
      ctx.moveTo(A.x, A.y);
      ctx.lineTo(B.x, B.y);
      ctx.stroke();
    }
    ctx.setLineDash([]);

    const roomById = (id) => world.roomById(id);
    const current = world.roomAtTile(Math.floor(state.player.x), Math.floor(state.player.y));
    const depthOf = (room) => (room ? room.depth : 0);

    for (const room of world.rooms) {
      const p = pos(room.cx, room.cy);
      const seen = state.visited[room.id];
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
        ctx.strokeStyle = isCurrent ? '#d78345' : (seen ? 'rgba(203, 209, 194, 0.55)' : 'rgba(203, 209, 194, 0.18)');
        ctx.lineWidth = isCurrent ? 2 : 1;
        ctx.stroke();
      } else {
        ctx.fillStyle = 'rgba(22, 27, 27, 0.45)';
        roundedRect(ctx, x, y, boxW, boxH, 3);
        ctx.fill();
        ctx.strokeStyle = 'rgba(160, 170, 160, 0.08)';
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      if (rev && (seen || hasMap)) {
        ctx.fillStyle = isCurrent ? '#f0d7b8' : 'rgba(218, 222, 208, 0.75)';
        ctx.font = `600 ${Math.max(7.5, Math.min(10, w / 45))}px Andika, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const words = room.name.split(' ');
        let line = '';
        let lineY = p.y - (words.length > 1 ? 5 : 0);
        for (let i = 0; i < words.length; i++) {
          const test = line ? line + ' ' + words[i] : words[i];
          if (ctx.measureText(test).width > boxW - 5 && line) {
            ctx.fillText(line, p.x, lineY);
            line = words[i];
            lineY += 9;
          } else {
            line = test;
          }
        }
        if (line) ctx.fillText(line, p.x, lineY);
        ctx.font = `7px Andika, sans-serif`;
        ctx.fillStyle = 'rgba(207, 190, 164, 0.55)';
        ctx.fillText(`глубина ${depthOf(room)}`, p.x, y + boxH - 7);
      }

      if (room.role === 'tablet' && rev) {
        ctx.fillStyle = '#e08a4e';
        ctx.beginPath();
        ctx.arc(p.x + boxW * 0.29, p.y - boxH * 0.29, 3, 0, Math.PI * 2);
        ctx.fill();
      }
      if (room.role === 'trial' && rev) {
        ctx.strokeStyle = 'rgba(224, 138, 78, 0.8)';
        ctx.beginPath();
        ctx.arc(p.x - boxW * 0.29, p.y - boxH * 0.29, 3.2, 0, Math.PI * 2);
        ctx.stroke();
      }
      if (rev && state.mapMarks && state.mapMarks.includes(room.id)) {
        ctx.fillStyle = '#e8dfcf';
        ctx.beginPath();
        ctx.arc(p.x, p.y + boxH * 0.28, 2.4, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    for (const b of state.backpacks) {
      const room = roomById(b.roomId);
      if (!room || !revealed(room)) continue;
      const p = pos(room.cx, room.cy);
      ctx.fillStyle = '#c4763d';
      roundedRect(ctx, p.x - 4, p.y - 5, 8, 9, 2);
      ctx.fill();
      ctx.strokeStyle = '#e8bd8b';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(p.x - 2.5, p.y - 1);
      ctx.lineTo(p.x + 2.5, p.y - 1);
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
    ctx.fillText(hasMap ? 'ОБРЫВОК КАРТЫ · виден весь участок' : 'ПАМЯТЬ · только пройденное и соседнее', marginX, h - marginBottom * 0.55);
    ctx.fillStyle = 'rgba(213, 211, 196, 0.4)';
    ctx.fillText('● ты   ▪ рюкзак   ○ метка', marginX, h - marginBottom * 0.2);

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
    tileNoise
  };
})();
