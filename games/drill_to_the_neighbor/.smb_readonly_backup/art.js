/* Procedural pixel art for DRILL TO THE NEIGHBOR.
   Palette sampled from the Agonia design reference: ember orange, deep umber,
   bone white and a little muted mauve. */
(function () {
  'use strict';

  const W = 400, H = 400, CX = 200, CY = 200;
  const TAU = Math.PI * 2;
  const P = {
    ink: '#140807',
    night: '#1e0c0a',
    soil: '#2e110f',
    soil2: '#3d1712',
    soil3: '#581a15',
    rust: '#a23d29',
    ember: '#cc3515',
    flame: '#f76032',
    gold: '#fe7844',
    peach: '#f7824d',
    cream: '#faf1ef',
    bone: '#dcafa6',
    mauve: '#69474e',
    lilac: '#a07891',
    pale: '#b38476'
  };

  let bg = null;
  let embers = [];
  let motes = [];
  let lastTime = 0;

  function rnd(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function px(c, x, y, w, h, color) {
    c.fillStyle = color;
    c.fillRect(Math.round(x), Math.round(y), Math.max(1, Math.round(w)), Math.max(1, Math.round(h)));
  }

  function fillCirclePixels(c, cx, cy, r, color) {
    cx = Math.round(cx); cy = Math.round(cy); r = Math.round(r);
    c.fillStyle = color;
    for (let dy = -r; dy <= r; dy++) {
      const dx = Math.floor(Math.sqrt(Math.max(0, r * r - dy * dy)));
      c.fillRect(cx - dx, cy + dy, dx * 2 + 1, 1);
    }
  }

  function ringPixels(c, cx, cy, r, thickness, color) {
    cx = Math.round(cx); cy = Math.round(cy); r = Math.round(r);
    thickness = Math.max(1, Math.round(thickness));
    const inner = Math.max(0, r - thickness);
    c.fillStyle = color;
    for (let dy = -r; dy <= r; dy++) {
      const yo = Math.floor(Math.sqrt(Math.max(0, r * r - dy * dy)));
      const yi = Math.floor(Math.sqrt(Math.max(0, inner * inner - dy * dy)));
      if (yo > yi) {
        c.fillRect(cx - yo, cy + dy, yo - yi, 1);
        c.fillRect(cx + yi + 1, cy + dy, yo - yi, 1);
      }
    }
  }

  function line(c, x0, y0, x1, y1, color, size) {
    size = size || 1;
    x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0), sx = x0 < x1 ? 1 : -1;
    const dy = -Math.abs(y1 - y0), sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    c.fillStyle = color;
    for (let guard = 0; guard < 2000; guard++) {
      c.fillRect(x0, y0, size, size);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
  }

  function seededSpecks(c, cx, cy, r, count, color, seed) {
    const rng = rnd(seed);
    c.fillStyle = color;
    for (let i = 0; i < count; i++) {
      const a = rng() * TAU;
      const d = Math.sqrt(rng()) * r;
      c.fillRect(Math.round(cx + Math.cos(a) * d), Math.round(cy + Math.sin(a) * d), rng() > 0.75 ? 2 : 1, 1);
    }
  }

  function makeBackground() {
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const g = c.getContext('2d');
    g.imageSmoothingEnabled = false;
    const rng = rnd(0xa60a);

    // Outer dark soil, with a dither field.
    px(g, 0, 0, W, H, P.ink);
    for (let i = 0; i < 1800; i++) {
      const x = rng() * W, y = rng() * H;
      const d = Math.hypot(x - CX, y - CY);
      if (d > 168) {
        const k = rng();
        px(g, x, y, 1, 1, k > 0.82 ? P.soil : k > 0.55 ? P.night : P.ink);
      }
    }

    // Stepped circular floor with strata.
    fillCirclePixels(g, CX, CY, 172, P.soil);
    fillCirclePixels(g, CX, CY, 160, P.soil2);
    fillCirclePixels(g, CX, CY, 116, P.soil);
    fillCirclePixels(g, CX, CY, 78, P.soil2);
    fillCirclePixels(g, CX, CY, 48, P.soil);

    // Worn strata rings.
    ringPixels(g, CX, CY, 166, 4, P.soil3);
    ringPixels(g, CX, CY, 158, 1, P.rust);
    ringPixels(g, CX, CY, 126, 2, P.soil3);
    ringPixels(g, CX, CY, 118, 1, P.mauve);
    ringPixels(g, CX, CY, 84, 2, P.soil3);
    ringPixels(g, CX, CY, 52, 2, P.rust);
    seededSpecks(g, CX, CY, 158, 700, P.soil3, 0x1313);
    seededSpecks(g, CX, CY, 150, 420, P.night, 0x4242);
    seededSpecks(g, CX, CY, 118, 420, P.mauve, 0x7777);
    seededSpecks(g, CX, CY, 74, 130, P.rust, 0x9191);

    // Roots creeping in from the rim.
    for (let i = 0; i < 15; i++) {
      const a = (i / 15) * TAU + rng() * 0.2;
      let x = CX + Math.cos(a) * 170;
      let y = CY + Math.sin(a) * 170;
      let dir = a + Math.PI + (rng() - 0.5) * 0.8;
      for (let j = 0; j < 7; j++) {
        const nx = x + Math.cos(dir) * (7 + rng() * 7);
        const ny = y + Math.sin(dir) * (7 + rng() * 7);
        line(g, x, y, nx, ny, j % 3 === 0 ? P.soil3 : P.night, j < 4 ? 2 : 1);
        if (rng() > 0.55) {
          const ba = dir + (rng() > 0.5 ? 1 : -1) * (0.7 + rng() * 0.6);
          line(g, nx, ny, nx + Math.cos(ba) * (5 + rng() * 6), ny + Math.sin(ba) * (5 + rng() * 6), P.soil3, 1);
        }
        x = nx; y = ny; dir += (rng() - 0.5) * 0.55;
      }
    }

    // A dark hollow on the right, echoing the reference's negative space.
    for (let i = 0; i < 8; i++) {
      const r = 50 - i * 5;
      fillCirclePixels(g, 362 - i * 3, 206, r, i % 2 ? P.ink : P.night);
    }
    line(g, 340, 145, 318, 190, P.mauve, 1);
    line(g, 318, 190, 342, 236, P.mauve, 1);

    // Rune circle: ogham-like notches, deliberately simple and hand-cut.
    const runes = 28;
    for (let i = 0; i < runes; i++) {
      const a = (i / runes) * TAU;
      const x = CX + Math.cos(a) * 142;
      const y = CY + Math.sin(a) * 142;
      const nx = Math.cos(a), ny = Math.sin(a);
      const tx = -ny, ty = nx;
      const col = i % 5 === 0 ? P.cream : i % 3 === 0 ? P.gold : P.bone;
      line(g, x - tx * 2, y - ty * 2, x + tx * 2, y + ty * 2, col, 1);
      if (i % 2 === 0) line(g, x - nx * 3, y - ny * 3, x + nx * 3, y + ny * 3, col, 1);
      if (i % 4 === 0) line(g, x + tx * 3, y + ty * 3, x + nx * 3, y + ny * 3, col, 1);
    }

    // Stone rim. Horizontal blocks with pale caps.
    const stones = 21;
    for (let i = 0; i < stones; i++) {
      const a = (i / stones) * TAU + 0.08;
      const rr = 181 + (rng() - 0.5) * 4;
      const x = CX + Math.cos(a) * rr;
      const y = CY + Math.sin(a) * rr;
      const w = 10 + Math.floor(rng() * 7);
      const h = 7 + Math.floor(rng() * 6);
      px(g, x - w / 2, y - h / 2 + 2, w, h, P.ink);
      px(g, x - w / 2, y - h / 2, w, h - 2, i % 4 === 0 ? P.mauve : P.soil3);
      px(g, x - w / 2 + 1, y - h / 2 + 1, w - 4, 2, i % 5 === 0 ? P.bone : P.lilac);
      px(g, x + w / 2 - 3, y - h / 2 + 3, 2, h - 5, P.night);
      if (i % 3 === 0) line(g, x - 2, y - 2, x + 2, y + 2, P.rust, 1);
    }

    // Central bore: the drill shaft toward the neighbour.
    fillCirclePixels(g, CX, CY, 38, P.ink);
    ringPixels(g, CX, CY, 38, 3, P.ember);
    ringPixels(g, CX, CY, 31, 2, P.soil3);
    fillCirclePixels(g, CX, CY, 25, P.night);
    ringPixels(g, CX, CY, 19, 2, P.gold);
    fillCirclePixels(g, CX, CY, 13, P.ink);
    // Spiral cut.
    for (let a = 0; a < 9.5; a += 0.12) {
      const r = 2 + a * 2.6;
      const x = CX + Math.cos(a * 1.9) * r;
      const y = CY + Math.sin(a * 1.9) * r;
      px(g, x, y, 1, 1, a > 7 ? P.cream : P.gold);
    }
    seededSpecks(g, CX, CY, 44, 90, P.gold, 0x5555);
    seededSpecks(g, CX, CY, 70, 50, P.ember, 0x6666);

    // Cracked floor leading outward.
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU + rng() * 0.3;
      let x = CX + Math.cos(a) * 42;
      let y = CY + Math.sin(a) * 42;
      let d = a;
      for (let j = 0; j < 5; j++) {
        const nx = x + Math.cos(d) * (10 + rng() * 12);
        const ny = y + Math.sin(d) * (10 + rng() * 12);
        line(g, x, y, nx, ny, j === 0 ? P.ember : P.soil3, 1);
        x = nx; y = ny; d += (rng() - 0.5) * 0.7;
      }
    }

    // A few pale bone shards in the soil, no gore, just ancient debris.
    for (let i = 0; i < 18; i++) {
      const a = rng() * TAU, r = 60 + rng() * 92;
      const x = CX + Math.cos(a) * r, y = CY + Math.sin(a) * r;
      line(g, x, y, x + (rng() - 0.5) * 6, y + (rng() - 0.5) * 6, i % 3 ? P.pale : P.bone, 1);
    }

    return c;
  }

  function init() {
    if (!bg) bg = makeBackground();
    embers = [];
    motes = [];
    const rng = rnd(0x7e57);
    for (let i = 0; i < 64; i++) {
      embers.push({
        a: rng() * TAU,
        r: 14 + rng() * 150,
        y: rng() * 240,
        sp: 3 + rng() * 10,
        drift: (rng() - 0.5) * 6,
        size: rng() > 0.82 ? 2 : 1,
        col: rng() > 0.62 ? P.cream : rng() > 0.3 ? P.gold : P.flame,
        ph: rng() * TAU
      });
    }
    for (let i = 0; i < 24; i++) {
      motes.push({
        x: rng() * W, y: rng() * H, sp: 1 + rng() * 4,
        ph: rng() * TAU, size: rng() > 0.7 ? 2 : 1,
        col: rng() > 0.5 ? P.mauve : P.rust
      });
    }
    lastTime = 0;
  }

  function updateAmbient(dt, time, levels, state) {
    const bass = levels ? levels.bass : 0;
    for (const e of embers) {
      e.r += (e.drift + Math.sin(time * 0.9 + e.ph) * 2) * dt;
      e.y -= (e.sp + bass * 12) * dt;
      if (e.y < -10) {
        e.y = 220;
        e.r = 8 + Math.random() * 150;
      }
      if (e.r > 172) e.r = 8 + Math.random() * 40;
    }
    for (const m of motes) {
      m.y -= m.sp * dt;
      m.x += Math.sin(time * 0.5 + m.ph) * 2 * dt;
      if (m.y < -4) { m.y = H + 4; m.x = Math.random() * W; }
    }
  }

  function drawAmbient(c, G, time, levels) {
    const bass = levels ? levels.bass : 0;
    const drill = (G.drill || 0) / 100;
    c.save();
    c.globalAlpha = 0.5;
    seededDots(c, CX, CY, 30 + drill * 18, 18 + Math.round(bass * 20), P.gold, time * 0.1);
    c.restore();

    // Embers rise from the bore.
    for (const e of embers) {
      const slow = 1 + bass * 0.6;
      const x = CX + Math.cos(e.a + time * 0.18 * slow) * e.r;
      const y = CY + e.y - 120;
      if (y < -4 || y > H + 4) continue;
      c.globalAlpha = 0.35 + 0.45 * (0.5 + 0.5 * Math.sin(time * 2 + e.ph));
      px(c, x, y, e.size, e.size, e.col);
    }
    c.globalAlpha = 1;

    for (const m of motes) {
      c.globalAlpha = 0.2 + 0.3 * (0.5 + 0.5 * Math.sin(time * 1.7 + m.ph));
      px(c, m.x, m.y, m.size, 1, m.col);
    }
    c.globalAlpha = 1;
    lastTime = time;
  }

  function seededDots(c, cx, cy, r, count, color, t) {
    const rng = rnd(0x1122 + Math.floor(t));
    c.fillStyle = color;
    for (let i = 0; i < count; i++) {
      const a = rng() * TAU;
      const d = Math.sqrt(rng()) * r;
      c.fillRect(Math.round(cx + Math.cos(a) * d), Math.round(cy + Math.sin(a) * d), 1, 1);
    }
  }

  function drawRim(c, G, time, levels) {
    const beat = G.beatPulse || 0;
    const bar = G.barPulse || 0;
    const bass = levels ? levels.bass : 0;
    if (beat > 0.01) {
      c.globalAlpha = beat * 0.45;
      ringPixels(c, CX, CY, 179, 3, P.flame);
      c.globalAlpha = 1;
    }
    if (bar > 0.01) {
      c.globalAlpha = bar * 0.32;
      ringPixels(c, CX, CY, 186, 2, P.cream);
      c.globalAlpha = 1;
    }
    if (bass > 0.25) {
      // Music-reactive scattered light on the outer stones.
      const rng = rnd(0x91a3 + Math.floor(time * 4));
      c.globalAlpha = Math.min(0.45, bass * 0.5);
      for (let i = 0; i < 18; i++) {
        const a = rng() * TAU;
        const rr = 174 + rng() * 12;
        px(c, CX + Math.cos(a) * rr, CY + Math.sin(a) * rr, rng() > 0.8 ? 2 : 1, 1, rng() > 0.5 ? P.gold : P.cream);
      }
      c.globalAlpha = 1;
    }
    // Central progress halo.
    const drill = (G.drill || 0) / 100;
    if (drill > 0.03) {
      c.globalAlpha = 0.12 + drill * 0.28;
      ringPixels(c, CX, CY, 44 + Math.sin(time * 1.4) * 2, 2, drill >= 0.65 ? P.cream : P.gold);
      c.globalAlpha = 1;
    }
  }

  function drawWarnings(c, G, time) {
    for (const w of G.warnings) {
      const pulse = 0.5 + 0.5 * Math.sin(time * 13 + w.seed);
      const col = w.kind === 'stone' ? P.bone : P.flame;
      c.globalAlpha = 0.28 + pulse * 0.35;
      ringPixels(c, w.x, w.y, 12 + pulse * 2, 1, col);
      ringPixels(c, w.x, w.y, 17 + pulse * 3, 1, col);
      c.globalAlpha = 0.55;
      // A short dotted warning ray toward the centre.
      const a = Math.atan2(CY - w.y, CX - w.x);
      for (let i = 1; i <= 4; i++) {
        px(c, w.x + Math.cos(a) * (7 + i * 5), w.y + Math.sin(a) * (7 + i * 5), 1, 1, col);
      }
      c.globalAlpha = 1;
      drawHazardShape(c, { x: w.x, y: w.y, kind: w.kind, seed: w.seed, r: w.kind === 'stone' ? 8 : 6 }, time, 0.42);
    }
  }

  function drawHazardShape(c, h, time, alpha) {
    const x = Math.round(h.x), y = Math.round(h.y);
    const kind = h.kind || 'thorn';
    const seed = h.seed || 0;
    c.save();
    c.globalAlpha = alpha == null ? 1 : alpha;
    // shadow
    fillCirclePixels(c, x + 1, y + 6, kind === 'stone' ? 9 : 6, 'rgba(20,8,7,0.55)');
    if (kind === 'stone') {
      const w = 14, hh = 12;
      px(c, x - w / 2, y - hh / 2 + 2, w, hh, P.ink);
      px(c, x - w / 2, y - hh / 2, w, hh - 2, P.mauve);
      px(c, x - w / 2 + 1, y - hh / 2 + 1, w - 3, 2, P.lilac);
      px(c, x - w / 2 + 2, y - hh / 2 + 3, 2, hh - 5, P.soil3);
      px(c, x + 1, y - 2, 4, 4, P.ember);
      px(c, x + 2, y - 1, 2, 2, P.cream);
      line(c, x - 5, y - 4, x - 2, y + 2, P.night, 1);
      line(c, x - 2, y + 2, x + 3, y + 4, P.night, 1);
    } else {
      const rot = time * 2.4 + seed;
      for (let i = 0; i < 6; i++) {
        const a = rot + (i / 6) * TAU;
        line(c, x, y, x + Math.cos(a) * 9, y + Math.sin(a) * 9, i % 2 ? P.rust : P.ember, 1);
      }
      fillCirclePixels(c, x, y, 6, P.soil3);
      fillCirclePixels(c, x, y, 4, P.rust);
      px(c, x - 1, y - 1, 3, 3, P.gold);
      px(c, x, y, 1, 1, P.cream);
    }
    c.restore();
  }

  function drawHazards(c, G, time) {
    for (const h of G.hazards) {
      drawHazardShape(c, h, time, 1);
      // A faint pulse that grows as it gets closer to the player.
      if (G.player) {
        const d = Math.hypot(h.x - G.player.x, h.y - G.player.y);
        if (d < 52) {
          c.globalAlpha = (1 - d / 52) * 0.42;
          ringPixels(c, h.x, h.y, 13 + Math.sin(time * 8 + h.seed) * 2, 1, P.cream);
          c.globalAlpha = 1;
        }
      }
    }
  }

  function drawPlayer(c, G, time) {
    const p = G.player;
    if (!p) return;
    if (p.invuln > 0 && Math.floor(time * 14) % 2 === 0) return;
    const moving = p.moving;
    const bob = moving ? Math.round(Math.sin(time * 14) * 1) : 0;
    const x = Math.round(p.x), y = Math.round(p.y) + bob;
    fillCirclePixels(c, x + 1, y + 8, 7, 'rgba(20,8,7,0.6)');

    // Cloak and hood.
    px(c, x - 5, y - 3, 10, 10, P.soil2);
    px(c, x - 4, y - 5, 8, 6, P.soil3);
    px(c, x - 6, y + 1, 2, 5, P.soil2);
    px(c, x + 4, y + 1, 2, 5, P.soil2);
    px(c, x - 3, y + 4, 6, 4, P.rust);
    px(c, x - 2, y - 5, 5, 4, P.mauve);
    px(c, x - 1, y - 4, 3, 3, P.bone);
    px(c, x - 1, y - 3, 1, 1, P.ink);
    px(c, x + 1, y - 3, 1, 1, P.ink);
    px(c, x - 5, y - 2, 1, 3, P.gold);
    px(c, x + 5, y + 2, 1, 4, P.ember);

    // Drill staff, aimed by movement direction.
    const ang = p.dir == null ? Math.PI / 2 : p.dir;
    const sx = x + Math.cos(ang) * 7;
    const sy = y + Math.sin(ang) * 7;
    const ex = x + Math.cos(ang) * 16;
    const ey = y + Math.sin(ang) * 16;
    line(c, sx, sy, ex, ey, P.bone, 1);
    const px1 = x + Math.cos(ang) * 17, py1 = y + Math.sin(ang) * 17;
    px(c, px1 - 1, py1 - 1, 3, 3, P.gold);
    px(c, px1, py1, 1, 1, P.cream);
    c.globalAlpha = 0.22 + 0.18 * Math.sin(time * 6);
    ringPixels(c, px1, py1, 5, 1, P.gold);
    c.globalAlpha = 1;

    // Combo aura: small orbit lights.
    if (G.combo >= 16) {
      for (let i = 0; i < 3; i++) {
        const a = time * 1.9 + i * TAU / 3;
        px(c, x + Math.cos(a) * 13, y + 2 + Math.sin(a) * 6, 1, 1, i === 0 ? P.cream : P.gold);
      }
    }
    if (p.hitFlash > 0) {
      c.globalAlpha = p.hitFlash * 0.5;
      ringPixels(c, x, y, 13, 2, P.cream);
      c.globalAlpha = 1;
    }
  }

  function drawPulses(c, G) {
    for (const p of G.pulses) {
      const f = 1 - Math.max(0, p.life) / p.maxLife;
      const r = 8 + f * (p.maxR - 8);
      const alpha = (1 - f) * (p.fizzle ? 0.3 : 0.7);
      c.globalAlpha = alpha;
      ringPixels(c, p.x, p.y, r, p.fizzle ? 1 : (p.perfect ? 3 : 2), p.fizzle ? P.mauve : p.perfect ? P.cream : P.gold);
      if (p.perfect) {
        c.globalAlpha = alpha * 0.5;
        ringPixels(c, p.x, p.y, r - 4, 1, P.gold);
      }
      c.globalAlpha = 1;
    }
  }

  function drawBeatCue(c, G, time) {
    if (!G.nextBeat || G.state !== 'playing') return;
    const until = G.nextBeat.t - time;
    if (until < -0.2 || until > 1.35) return;
    const f = Math.max(0, 1 - until / 1.35);
    const r = 14 + (1 - f) * 96;
    c.globalAlpha = 0.16 + f * 0.5;
    ringPixels(c, G.player.x, G.player.y, r, 1, P.cream);
    c.globalAlpha = 0.2 + f * 0.35;
    for (let i = 0; i < 4; i++) {
      const a = i * TAU / 4;
      px(c, G.player.x + Math.cos(a) * 18, G.player.y + Math.sin(a) * 18, 1, 1, P.gold);
    }
    c.globalAlpha = 1;
  }

  function drawParticles(c, G) {
    for (const p of G.particles) {
      const a = Math.max(0, p.life / p.maxLife);
      c.globalAlpha = a;
      px(c, p.x, p.y, p.size, p.size, p.color);
    }
    c.globalAlpha = 1;
  }

  function drawPortal(c, G, time) {
    if (G.state !== 'won') return;
    const r = 30 + Math.sin(time * 2) * 3;
    c.globalAlpha = 0.65;
    ringPixels(c, CX, CY, r, 3, P.cream);
    ringPixels(c, CX, CY, r + 8, 2, P.gold);
    ringPixels(c, CX, CY, r + 16, 1, P.ember);
    c.globalAlpha = 1;
  }

  function render(c, G, time, dt, levels) {
    if (!bg) init();
    updateAmbient(dt || 0, time, levels, G.state);
    const shake = G.shake || 0;
    c.save();
    if (shake > 0.01) {
      c.translate((Math.random() - 0.5) * 6 * shake, (Math.random() - 0.5) * 6 * shake);
    }
    c.drawImage(bg, 0, 0);
    drawAmbient(c, G, time, levels);
    drawRim(c, G, time, levels);
    drawWarnings(c, G, time);
    drawHazards(c, G, time);
    drawPortal(c, G, time);
    drawPulses(c, G);
    if (G.state !== 'menu' && G.state !== 'loading') drawPlayer(c, G, time);
    drawBeatCue(c, G, time);
    drawParticles(c, G);
    if (G.hitFlash > 0) {
      c.globalAlpha = G.hitFlash * 0.22;
      c.fillStyle = P.flame;
      c.fillRect(0, 0, W, H);
      c.globalAlpha = 1;
    }
    c.restore();
  }

  window.DrillArt = {
    W, H, CX, CY, P,
    init, render,
    _makeBackground: makeBackground
  };
})();
