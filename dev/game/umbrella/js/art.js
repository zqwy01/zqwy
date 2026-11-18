/* НЕМЕТОН — procedural pixel art for the sacred grove. */
(function () {
  'use strict';

  const W = 480;
  const H = 270;
  const HIT_Y = 226;
  const LANE_X = [144, 208, 272, 336];

  const P = {
    ink: '#050a08',
    void: '#030706',
    night0: '#07100d',
    night1: '#0a1814',
    night2: '#10241d',
    sky0: '#08161a',
    sky1: '#0d2727',
    sky2: '#163b34',
    sky3: '#1f4a3d',
    hill0: '#0d201a',
    hill1: '#142c23',
    hill2: '#1b382a',
    ground0: '#15271e',
    ground1: '#1c3326',
    moss0: '#274630',
    moss1: '#355c3c',
    moss2: '#4b774a',
    leaf0: '#5f8a4f',
    leaf1: '#86a85e',
    leaf2: '#b6c47e',
    bark0: '#241f16',
    bark1: '#382f20',
    bark2: '#51452b',
    gold0: '#7a5c28',
    gold1: '#bf9440',
    gold2: '#f0d078',
    bone0: '#a8a68c',
    bone1: '#d8d4b4',
    white: '#f4efd8',
    stone0: '#28322e',
    stone1: '#3d4a42',
    stone2: '#5b6757',
    stone3: '#7b846c',
    mist0: '#35544b',
    mist1: '#5d7d6e',
    mist2: '#93b09a',
    uiDim: '#9db8a7',
    uiFaint: '#7f9d8c',
    uiGold: '#d8b35e',
    fire0: '#6d2519',
    fire1: '#b84824',
    fire2: '#ed8f3b',
    fire3: '#ffd67c',
    water: '#3d8a86',
    water2: '#7cc0b4',
    air: '#a3c47a',
    lane: ['#d5aa4c', '#56a8a2', '#a3c47a', '#dd7a45']
  };

  const BAYER = [
    [0, 8, 2, 10],
    [12, 4, 14, 6],
    [3, 11, 1, 9],
    [15, 7, 13, 5]
  ];

  // ---------- tiny helpers ----------
  function hash(n) {
    n = (n << 13) ^ n;
    return ((n * (n * n * 15731 + 789221) + 1376312589) & 0x7fffffff) / 0x7fffffff;
  }

  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const lerp = (a, b, t) => a + (b - a) * t;

  function px(ctx, x, y, color, a) {
    if (a !== undefined) ctx.globalAlpha = a;
    ctx.fillStyle = color;
    ctx.fillRect(x | 0, y | 0, 1, 1);
    if (a !== undefined) ctx.globalAlpha = 1;
  }

  function rect(ctx, x, y, w, h, color, a) {
    if (a !== undefined) ctx.globalAlpha = a;
    ctx.fillStyle = color;
    ctx.fillRect(x | 0, y | 0, w | 0, h | 0);
    if (a !== undefined) ctx.globalAlpha = 1;
  }

  function circle(ctx, cx, cy, r, color, a) {
    if (a !== undefined) ctx.globalAlpha = a;
    ctx.fillStyle = color;
    cx = Math.round(cx); cy = Math.round(cy);
    const rr = Math.round(r);
    for (let y = -rr; y <= rr; y++) {
      const w = Math.floor(Math.sqrt(rr * rr - y * y));
      ctx.fillRect(cx - w, cy + y, w * 2 + 1, 1);
    }
    if (a !== undefined) ctx.globalAlpha = 1;
  }

  function circleOutline(ctx, cx, cy, r, color, a) {
    if (a !== undefined) ctx.globalAlpha = a;
    ctx.fillStyle = color;
    cx = Math.round(cx); cy = Math.round(cy);
    const steps = Math.max(10, Math.round(r * 5));
    for (let i = 0; i < steps; i++) {
      const ang = (i / steps) * Math.PI * 2;
      ctx.fillRect(Math.round(cx + Math.cos(ang) * r), Math.round(cy + Math.sin(ang) * r), 1, 1);
    }
    if (a !== undefined) ctx.globalAlpha = 1;
  }

  function line(ctx, x0, y0, x1, y1, color, a) {
    if (a !== undefined) ctx.globalAlpha = a;
    ctx.fillStyle = color;
    x0 = Math.round(x0); y0 = Math.round(y0);
    x1 = Math.round(x1); y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0), sx = x0 < x1 ? 1 : -1;
    const dy = -Math.abs(y1 - y0), sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      ctx.fillRect(x0, y0, 1, 1);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
    if (a !== undefined) ctx.globalAlpha = 1;
  }

  function thickLine(ctx, x0, y0, x1, y1, w, color) {
    ctx.fillStyle = color;
    const steps = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0)));
    const ww = Math.max(1, Math.round(w));
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const x = Math.round(lerp(x0, x1, t));
      const y = Math.round(lerp(y0, y1, t));
      ctx.fillRect(x - (ww >> 1), y, ww, 1);
    }
  }

  function dither(ctx, x, y, w, h, c1, c2, threshold) {
    ctx.fillStyle = c1;
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = c2;
    for (let yy = 0; yy < h; yy++) {
      for (let xx = 0; xx < w; xx++) {
        if (BAYER[yy & 3][xx & 3] < threshold) ctx.fillRect(x + xx, y + yy, 1, 1);
      }
    }
  }

  function ogham(ctx, x, y, count, stemColor, notchColor) {
    ctx.fillStyle = stemColor;
    ctx.fillRect(x, y - 5, 1, 11);
    ctx.fillStyle = notchColor;
    const n = clamp(count, 1, 5);
    const gap = n > 1 ? 7 / (n - 1) : 0;
    for (let i = 0; i < n; i++) {
      const yy = Math.round(y + 4 - i * gap);
      ctx.fillRect(x + 1, yy, 4, 1);
    }
  }

  // ---------- precomputed art ----------
  let sky = null;
  let vignette = null;
  let stars = [];
  let farTrees = [];
  let grass = [];
  let mushrooms = [];
  let groundStones = [];
  let mistPuffs = [];
  let fireflies = [];
  let treeSegs = [];
  let leaves = [];
  let mistletoe = [];
  let stones = [];

  function buildSky() {
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const g = c.getContext('2d');
    const img = g.createImageData(W, H);
    const stops = [
      [0, [7, 16, 18]],
      [0.34, [9, 24, 24]],
      [0.58, [14, 44, 40]],
      [0.76, [27, 66, 55]],
      [1, [13, 30, 24]]
    ];
    for (let y = 0; y < H; y++) {
      const p = y / H;
      let i = 0;
      while (i < stops.length - 2 && p > stops[i + 1][0]) i++;
      const t = clamp((p - stops[i][0]) / (stops[i + 1][0] - stops[i][0]), 0, 1);
      const a = stops[i][1], b = stops[i + 1][1];
      const d = (BAYER[y & 3][(y * 7) & 3] + 0.5) / 16;
      const k = t > d ? 1 : 0;
      const col = k ? b : a;
      for (let x = 0; x < W; x++) {
        const o = (y * W + x) * 4;
        img.data[o] = col[0];
        img.data[o + 1] = col[1];
        img.data[o + 2] = col[2];
        img.data[o + 3] = 255;
      }
    }
    g.putImageData(img, 0, 0);
    sky = c;
  }

  function buildVignette() {
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const g = c.getContext('2d');
    const img = g.createImageData(W, H);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const dx = (x / W - 0.5) * 1.22;
        const dy = (y / H - 0.53) * 1.06;
        const d = Math.sqrt(dx * dx + dy * dy);
        const a = clamp((d - 0.46) / 0.5, 0, 1);
        const o = (y * W + x) * 4;
        img.data[o] = 2;
        img.data[o + 1] = 6;
        img.data[o + 2] = 4;
        img.data[o + 3] = Math.round(a * a * 180);
      }
    }
    g.putImageData(img, 0, 0);
    vignette = c;
  }

  function buildWorld() {
    const rnd = mulberry32(0xC3A7);
    stars = [];
    for (let i = 0; i < 86; i++) {
      stars.push({
        x: rnd() * W,
        y: 6 + rnd() * 138,
        p: rnd() * Math.PI * 2,
        s: rnd() < 0.13 ? 2 : 1,
        c: rnd() < 0.2 ? P.bone1 : P.bone0
      });
    }
    farTrees = [];
    for (let i = 0; i < 19; i++) {
      farTrees.push({
        x: 8 + i * 26 + rnd() * 12,
        y: 141 + rnd() * 18,
        h: 8 + rnd() * 17,
        w: 5 + rnd() * 6
      });
    }
    grass = [];
    for (let i = 0; i < 130; i++) {
      grass.push({
        x: rnd() * W,
        y: 196 + rnd() * 66,
        h: 1 + Math.floor(rnd() * 4),
        lean: rnd() < 0.5 ? -1 : 1,
        c: rnd() < 0.5 ? P.moss1 : (rnd() < 0.6 ? P.moss0 : P.leaf0)
      });
    }
    mushrooms = [];
    for (let i = 0; i < 7; i++) {
      mushrooms.push({
        x: 20 + rnd() * (W - 40),
        y: 214 + rnd() * 46,
        r: 1 + Math.floor(rnd() * 2),
        c: rnd() < 0.55 ? P.fire1 : P.gold1
      });
    }
    groundStones = [];
    for (let i = 0; i < 26; i++) {
      groundStones.push({
        x: rnd() * W,
        y: 202 + rnd() * 60,
        w: 2 + Math.floor(rnd() * 6),
        h: 1 + Math.floor(rnd() * 3),
        c: rnd() < 0.5 ? P.stone0 : P.stone1
      });
    }
    mistPuffs = [];
    for (let band = 0; band < 4; band++) {
      for (let i = 0; i < 34; i++) {
        mistPuffs.push({
          x: rnd() * (W + 100),
          y: 132 + band * 16 + rnd() * 10,
          w: 8 + rnd() * 34,
          h: rnd() < 0.65 ? 1 : 2,
          sp: 1.2 + rnd() * 4.2,
          a: 0.06 + rnd() * 0.16,
          ph: rnd() * 6.28,
          band
        });
      }
    }
    fireflies = [];
    for (let i = 0; i < 58; i++) {
      fireflies.push({
        x: 24 + rnd() * (W - 48),
        y: 80 + rnd() * 136,
        p: rnd() * Math.PI * 2,
        sp: 0.4 + rnd() * 1.2,
        amp: 5 + rnd() * 17,
        c: rnd() < 0.24 ? P.bone1 : (rnd() < 0.5 ? P.gold2 : P.leaf2)
      });
    }
  }

  function buildTree() {
    treeSegs = [];
    leaves = [];
    mistletoe = [];
    const rnd = mulberry32(0x51D0);
    function branch(x, y, ang, len, wid, depth) {
      const x2 = x + Math.cos(ang) * len;
      const y2 = y + Math.sin(ang) * len;
      treeSegs.push({ x0: x, y0: y, x1: x2, y1: y2, w: wid, depth });
      if (depth <= 0) {
        const n = 3 + Math.floor(rnd() * 4);
        for (let i = 0; i < n; i++) {
          leaves.push({
            x: x2 + (rnd() - 0.5) * 26,
            y: y2 + (rnd() - 0.5) * 20,
            r: rnd() < 0.3 ? 2 : 1,
            c: rnd() < 0.2 ? P.leaf2 : (rnd() < 0.55 ? P.leaf1 : P.leaf0),
            reveal: 0.18 + rnd() * 0.82,
            ph: rnd() * 6.28
          });
        }
        if (rnd() < 0.30) {
          mistletoe.push({
            x: x2, y: y2,
            c: rnd() < 0.5 ? P.gold1 : P.gold2,
            reveal: 0.42 + rnd() * 0.5,
            ph: rnd() * 6.28
          });
        }
        return;
      }
      const spread = 0.28 + rnd() * 0.20;
      branch(x2, y2, ang - spread, len * (0.68 + rnd() * 0.10), Math.max(1, wid * 0.62), depth - 1);
      branch(x2, y2, ang + spread * (0.72 + rnd() * 0.4), len * (0.64 + rnd() * 0.12), Math.max(1, wid * 0.58), depth - 1);
      if (depth > 3 && rnd() < 0.32) {
        branch(x2, y2, ang + (rnd() - 0.5) * 0.9, len * 0.55, Math.max(1, wid * 0.42), depth - 2);
      }
    }
    branch(240, 219, -Math.PI / 2, 39, 8, 6);
    // second trunk for a broad oak
    branch(240, 211, -Math.PI / 2 - 0.24, 31, 6, 5);
    branch(240, 211, -Math.PI / 2 + 0.26, 30, 6, 5);
  }

  function buildStones() {
    const rnd = mulberry32(0x9A11);
    stones = [];
    const defs = [
      [52, 185, 42, 15, -2], [92, 191, 33, 11, 2], [122, 196, 22, 9, -1],
      [368, 195, 24, 9, 1], [404, 190, 35, 12, -2], [444, 182, 46, 16, 3]
    ];
    for (const [x, base, h, w, tilt] of defs) {
      const marks = [];
      const n = 2 + Math.floor(rnd() * 4);
      for (let i = 0; i < n; i++) marks.push({ y: -6 - i * 5, c: rnd() });
      stones.push({ x, base, h, w, tilt, marks, spiral: rnd() < 0.3 });
    }
  }

  function init() {
    buildSky();
    buildVignette();
    buildWorld();
    buildTree();
    buildStones();
  }

  // ---------- drawing ----------
  function drawStars(ctx, t, level, storm) {
    for (const s of stars) {
      const tw = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(t * 1.3 + s.p));
      const a = tw * clamp(0.9 - storm * 0.6, 0, 1);
      if (a < 0.08) continue;
      px(ctx, s.x, s.y, s.c, a);
      if (s.s === 2) {
        px(ctx, s.x - 1, s.y, s.c, a * 0.35);
        px(ctx, s.x + 1, s.y, s.c, a * 0.35);
        px(ctx, s.x, s.y - 1, s.c, a * 0.35);
        px(ctx, s.x, s.y + 1, s.c, a * 0.35);
      }
    }
  }

  function drawMoon(ctx, t, level, highP, storm) {
    const mx = 404, my = 48, r = 21;
    circle(ctx, mx, my, r + 12, P.bone0, 0.025 + highP * 0.02);
    circle(ctx, mx, my, r + 6, P.bone0, 0.035 + highP * 0.025);
    circle(ctx, mx, my, r, P.bone0, 0.92);
    circle(ctx, mx - 3, my - 2, r - 1, P.bone1, 0.55);
    // crescent shadow
    circle(ctx, mx + 7, my - 3, r - 2, P.sky1, 0.96);
    // craters
    circle(ctx, mx - 7, my + 4, 3, P.stone1, 0.35);
    circle(ctx, mx - 2, my - 6, 2, P.stone1, 0.28);
    circle(ctx, mx - 10, my - 2, 1, P.stone1, 0.3);
    // thin halo ring
    circleOutline(ctx, mx, my, r + 3, P.bone1, 0.08 + highP * 0.05);
  }

  function drawAurora(ctx, t, level, midP, highP, tag) {
    const bloom = (tag === 'fire' || tag === 'sparks' || tag === 'storm' || tag === 'climax') ? 1 : 0.32;
    if (level < 0.25 && bloom < 0.5) return;
    const cols = [P.water2, P.leaf2, P.gold2];
    for (let b = 0; b < 3; b++) {
      const a = (0.035 + level * 0.045 + midP * 0.05) * bloom * (b === 1 ? 1.25 : 0.8);
      if (a < 0.012) continue;
      const baseY = 48 + b * 17;
      for (let x = 0; x <= W; x += 2) {
        const y = baseY +
          Math.sin(x * 0.019 + t * 0.33 + b * 1.7) * 11 +
          Math.sin(x * 0.047 - t * 0.21 + b) * 5;
        const h = 1 + (Math.sin(x * 0.08 + t * 0.5 + b) > 0.55 ? 1 : 0);
        rect(ctx, x, y, 2, h, cols[b], a);
      }
    }
  }

  function drawHills(ctx, t, level, storm) {
    // distant ridge
    ctx.fillStyle = P.hill0;
    ctx.beginPath();
    ctx.moveTo(0, 169);
    const pts1 = [[0, 169], [38, 156], [74, 162], [118, 149], [168, 159], [212, 146], [262, 156], [308, 147], [352, 158], [398, 148], [440, 158], [480, 151]];
    for (const [x, y] of pts1) ctx.lineTo(x, y);
    ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.closePath(); ctx.fill();

    // tiny trees on the ridge
    for (const tr of farTrees) {
      rect(ctx, tr.x - 1, tr.y - tr.h * 0.4, 1, tr.h * 0.5, P.hill0);
      for (let i = 0; i < tr.h; i += 2) {
        const w = Math.max(1, Math.round(tr.w * (1 - i / tr.h)));
        rect(ctx, tr.x - (w >> 1), tr.y - tr.h + i, w, 1, P.hill0);
      }
    }

    // middle ridge
    ctx.fillStyle = P.hill1;
    ctx.beginPath();
    const pts2 = [[0, 188], [42, 176], [82, 182], [126, 169], [174, 179], [226, 171], [274, 180], [326, 170], [376, 180], [426, 172], [480, 180]];
    ctx.moveTo(0, 188);
    for (const [x, y] of pts2) ctx.lineTo(x, y);
    ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.closePath(); ctx.fill();

    // ridge highlight
    ctx.fillStyle = P.moss0;
    for (let i = 0; i < pts2.length - 1; i++) {
      const [x0, y0] = pts2[i], [x1, y1] = pts2[i + 1];
      const steps = Math.max(1, Math.round(x1 - x0));
      for (let s = 0; s < steps; s += 2) {
        const x = x0 + s;
        const y = Math.round(lerp(y0, y1, s / steps));
        ctx.fillRect(x, y, 2, 1);
      }
    }
  }

  function drawGround(ctx, t, level, beatPulse) {
    rect(ctx, 0, 196, W, H - 196, P.ground0);
    // moss patches
    const rnd = mulberry32(0x22AA);
    for (let i = 0; i < 28; i++) {
      const x = rnd() * W, y = 200 + rnd() * 62, w = 8 + rnd() * 28;
      rect(ctx, x, y, w, 1, rnd() < 0.5 ? P.ground1 : P.moss0, 0.7);
      if (rnd() < 0.4) rect(ctx, x + 2, y + 1, w - 4, 1, P.moss0, 0.35);
    }
    // grass
    for (const g of grass) {
      px(ctx, g.x, g.y, g.c, 0.55);
      for (let i = 1; i <= g.h; i++) {
        px(ctx, g.x + (i > 1 ? g.lean : 0), g.y - i, g.c, 0.65);
      }
    }
    // mushrooms
    for (const m of mushrooms) {
      rect(ctx, m.x - m.r, m.y, m.r * 2 + 1, 1, m.c, 0.8);
      rect(ctx, m.x, m.y + 1, 1, 2, P.bone0, 0.55);
    }
    // stones
    for (const s of groundStones) {
      rect(ctx, s.x, s.y, s.w, s.h, s.c, 0.6);
      rect(ctx, s.x, s.y, s.w, 1, P.stone2, 0.25);
    }
    // path to the altar
    dither(ctx, 176, 232, 128, 26, P.ground1, P.ground0, 7);
    // a few glowing spores
    const n = 8;
    for (let i = 0; i < n; i++) {
      const ph = i * 1.7;
      const x = 120 + ((i * 67 + t * 9) % 240);
      const y = 232 + Math.sin(t * 0.8 + ph) * 5;
      px(ctx, x, y, P.gold2, 0.25 + 0.5 * beatPulse * (0.5 + 0.5 * Math.sin(t + ph)));
    }
  }

  function drawStones(ctx, t, level, beatPulse, aura) {
    for (const s of stones) {
      const x = s.x, b = s.base, h = s.h, w = s.w;
      const tilt = s.tilt;
      // shadow
      rect(ctx, x - w / 2 - 2, b + 1, w + 4, 2, P.void, 0.35);
      // body
      ctx.fillStyle = P.stone0;
      ctx.beginPath();
      ctx.moveTo(x - w / 2 + tilt, b - h);
      ctx.lineTo(x + w / 2 + tilt * 0.4, b - h + 4);
      ctx.lineTo(x + w / 2, b);
      ctx.lineTo(x - w / 2, b);
      ctx.closePath();
      ctx.fill();
      // lit left face
      ctx.fillStyle = P.stone1;
      ctx.beginPath();
      ctx.moveTo(x - w / 2 + tilt, b - h);
      ctx.lineTo(x - w / 2 + tilt + 3, b - h + 3);
      ctx.lineTo(x - w / 2 + 3, b);
      ctx.lineTo(x - w / 2, b);
      ctx.closePath();
      ctx.fill();
      // dark right edge
      rect(ctx, x + w / 2 - 2, b - h + 4, 2, h - 4, P.ink, 0.35);
      // cracks
      line(ctx, x - 1, b - h + 7, x + 2, b - h + 16, P.ink, 0.35);
      // ogham marks
      const glow = 0.18 + beatPulse * 0.65 + aura * 0.15;
      for (let i = 0; i < s.marks.length; i++) {
        const my = b - h + 11 + i * 5;
        rect(ctx, x - 2, my, 5, 1, P.gold1, glow * (s.marks[i].c * 0.5 + 0.5));
      }
      // spiral carving
      if (s.spiral) {
        const cx = x, cy = b - h + 18;
        for (let i = 0; i < 14; i++) {
          const a = i * 0.56 + t * 0.12;
          const r = 1 + i * 0.33;
          px(ctx, cx + Math.cos(a) * r, cy + Math.sin(a) * r * 0.82, P.gold1, 0.25 + beatPulse * 0.4);
        }
      }
      // moss on top
      if (h > 30) {
        rect(ctx, x - w / 2 + 2, b - h + 2, 3, 1, P.moss1, 0.55);
        rect(ctx, x + 1, b - h + 4, 2, 1, P.moss0, 0.5);
      }
    }
  }

  function treeSway(y, t) {
    return Math.sin(t * 0.52 + y * 0.028) * 1.6 * clamp((220 - y) / 130, 0.1, 1);
  }

  function drawTree(ctx, t, level, bloom, aura, blessing, bassP) {
    const glow = blessing > 0 ? 0.5 : 0.16 + aura * 0.12;
    // aura behind canopy
    circle(ctx, 240, 120, 62 + bassP * 10, P.gold1, 0.018 + blessing * 0.02);
    // roots
    ctx.fillStyle = P.bark0;
    for (let i = 0; i < 7; i++) {
      const a = -Math.PI + (i / 6) * Math.PI;
      const x = 240 + Math.cos(a) * (14 + i * 2);
      thickLine(ctx, 240, 219, x, 222 + (i % 2), 2, P.bark0);
    }
    // branches
    for (const s of treeSegs) {
      const x0 = s.x0 + treeSway(s.y0, t);
      const x1 = s.x1 + treeSway(s.y1, t);
      const y0 = s.y0, y1 = s.y1;
      const w = Math.max(1, Math.round(s.w));
      thickLine(ctx, x0, y0, x1, y1, w, s.depth > 3 ? P.bark0 : P.bark1);
      if (s.depth <= 3) {
        // thin warm rim light
        thickLine(ctx, x0 - 1, y0, x1 - 1, y1, 1, P.bark2);
      }
    }
    // trunk moss
    const rnd = mulberry32(0x77AF);
    for (let i = 0; i < 16; i++) {
      const yy = 160 + rnd() * 56;
      const xx = 233 + (rnd() - 0.5) * (10 + (220 - yy) * 0.12);
      px(ctx, xx, yy, P.moss0, 0.4 + rnd() * 0.3);
    }
    // leaves
    const sway = Math.sin(t * 0.9) * 1.1;
    for (const l of leaves) {
      if (l.reveal > bloom) continue;
      const x = l.x + treeSway(l.y, t) + Math.sin(t * 1.1 + l.ph) * 0.8;
      const y = l.y + Math.sin(t * 0.8 + l.ph) * 0.7;
      if (l.r === 2) {
        rect(ctx, x, y, 2, 2, l.c, 0.85);
        px(ctx, x, y, P.leaf2, 0.5);
      } else {
        px(ctx, x, y, l.c, 0.9);
      }
    }
    // mistletoe
    for (const m of mistletoe) {
      if (m.reveal > bloom) continue;
      const x = m.x + treeSway(m.y, t);
      const y = m.y + Math.sin(t * 0.9 + m.ph) * 1.2;
      rect(ctx, x - 1, y, 3, 1, m.c, 0.7);
      px(ctx, x, y - 1, P.bone1, 0.6);
    }
    // carved ogham on the trunk
    const stemY = 168;
    rect(ctx, 239, stemY, 2, 30, P.gold1, glow * (0.6 + bassP * 0.4));
    for (let i = 0; i < 4; i++) {
      rect(ctx, 241, stemY + 3 + i * 7, 5, 1, P.gold2, glow * (0.5 + bassP * 0.5));
    }
    // heartwood glow when blessed
    if (blessing > 0) {
      circle(ctx, 240, 178, 5 + Math.sin(t * 4) * 1.5, P.gold2, 0.18 * blessing);
      circle(ctx, 240, 178, 2, P.white, 0.25 * blessing);
    }
  }

  function drawMist(ctx, t, level, tag, front) {
    let dens = 1;
    if (tag === 'intro' || tag === 'earth' || tag === 'outro') dens = 1.25;
    if (tag === 'storm' || tag === 'climax') dens = 0.55;
    if (tag === 'fire' || tag === 'sparks') dens = 0.8;
    const alphaMul = dens * (0.5 + level * 0.5);
    for (const p of mistPuffs) {
      if ((p.band >= 2) !== front) continue;
      const x = ((p.x + t * p.sp) % (W + 120)) - 60;
      const y = p.y + Math.sin(t * 0.35 + p.ph) * 2;
      rect(ctx, x, y, p.w, p.h, p.band < 2 ? P.mist1 : P.mist2, p.a * alphaMul);
      if (p.w > 20) rect(ctx, x + 4, y + 2, p.w - 8, 1, P.mist0, p.a * alphaMul * 0.7);
    }
  }

  function drawFireflies(ctx, t, level, midP, highP, tag) {
    const active = clamp(0.22 + level * 0.8 + midP * 0.2, 0, 1.2);
    const boost = (tag === 'climax' || tag === 'sparks' || tag === 'fire') ? 1.35 : 1;
    for (let i = 0; i < fireflies.length; i++) {
      if ((i / fireflies.length) > active) continue;
      const f = fireflies[i];
      const x = f.x + Math.sin(t * f.sp + f.p) * f.amp;
      const y = f.y + Math.cos(t * f.sp * 0.63 + f.p * 1.7) * f.amp * 0.42;
      const tw = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(t * 2.1 + f.p * 3));
      const a = tw * (0.28 + highP * 0.45) * boost;
      if (a < 0.08) continue;
      px(ctx, x, y, f.c, Math.min(1, a));
      px(ctx, x - 1, y, f.c, a * 0.16);
      px(ctx, x + 1, y, f.c, a * 0.16);
      if (i % 5 === 0) px(ctx, x, y - 1, f.c, a * 0.22);
    }
  }

  function drawLaneChannels(ctx, t, level, beatPulse, blessing, pulse) {
    for (let i = 0; i < 4; i++) {
      const x = LANE_X[i];
      const col = P.lane[i];
      const ip = pulse ? (pulse[i] || 0) : 0;
      // dark corridor for note contrast
      rect(ctx, x - 14, 0, 28, HIT_Y, P.void, 0.16 + level * 0.04);
      // soft edge dither
      for (let y = 0; y < HIT_Y; y += 2) {
        px(ctx, x - 15 + (y % 4 === 0 ? 0 : 1), y, P.void, 0.10);
        px(ctx, x + 15 - (y % 4 === 0 ? 0 : 1), y, P.void, 0.10);
      }
      // beam
      const a = 0.035 + beatPulse * 0.055 + (blessing > 0 ? 0.03 : 0) + ip * 0.11;
      rect(ctx, x, 18, 1, HIT_Y - 18, col, a);
      if (ip > 0.02) {
        rect(ctx, x - 1, 18, 3, HIT_Y - 18, col, ip * 0.045);
        rect(ctx, x - 15, HIT_Y - 1, 31, 1, col, ip * 0.18);
      }
      // dashed rune marks
      const off = (t * 19 + i * 31) % 18;
      for (let y = -18 + off; y < HIT_Y; y += 18) {
        if (y < 12) continue;
        rect(ctx, x - 2, y, 5, 1, col, 0.09 + beatPulse * 0.06 + ip * 0.06);
      }
      // rising sparks
      for (let k = 0; k < 5; k++) {
        const yy = HIT_Y - ((t * (24 + k * 7) + k * 47 + i * 19) % (HIT_Y - 18));
        const xx = x + Math.sin(t * 0.6 + k * 2 + i) * 5;
        px(ctx, xx, yy, col, 0.16 + level * 0.22 + ip * 0.2);
      }
    }
  }

  function drawAltar(ctx, t, level, beatPulse, aura, blessing, bassP, pulse) {
    const ip0 = pulse ? (pulse[0] || 0) : 0;
    // sacred slab
    rect(ctx, 92, 236, 296, 4, P.stone1);
    rect(ctx, 96, 240, 288, 13, P.stone0);
    rect(ctx, 96, 253, 288, 2, P.ink, 0.55);
    // slab cracks and moss
    line(ctx, 120, 241, 140, 245, P.ink, 0.35);
    line(ctx, 348, 242, 332, 248, P.ink, 0.3);
    rect(ctx, 116, 237, 18, 1, P.moss1, 0.5);
    rect(ctx, 352, 237, 22, 1, P.moss0, 0.45);
    // base shadow
    rect(ctx, 104, 255, 272, 4, P.void, 0.4);

    // central flame
    const fx = 240;
    const fh = 6 + level * 7 + beatPulse * 5 + blessing * 4 + ip0 * 5;
    for (let i = 0; i < fh; i++) {
      const p = i / fh;
      const w = Math.max(1, Math.round((1 - p) * (5 + Math.sin(t * 6 + i * 0.7) * 1.4)));
      const yy = 238 - i;
      rect(ctx, fx - w, yy, w * 2 + 1, 1, p < 0.45 ? P.fire1 : (p < 0.75 ? P.fire2 : P.fire3), 0.75);
    }
    rect(ctx, fx - 1, 236 - fh * 0.55, 2, 3, P.white, 0.55);
    // rising embers
    for (let i = 0; i < 8; i++) {
      const ph = i * 1.9;
      const yy = 236 - ((t * (14 + i * 2) + ph * 20) % 40);
      const xx = fx + Math.sin(t * 1.1 + ph) * (5 + i);
      px(ctx, xx, yy, i % 2 ? P.fire2 : P.gold2, 0.35 + beatPulse * 0.35);
    }

    // triskele on the slab
    const rot = t * 0.35;
    for (let arm = 0; arm < 3; arm++) {
      for (let i = 0; i < 18; i++) {
        const a = rot + arm * 2.094 + i * 0.26;
        const r = 1 + i * 0.42;
        px(ctx, 240 + Math.cos(a) * r, 248 + Math.sin(a) * r * 0.55,
          blessing > 0 ? P.gold2 : P.gold1, 0.18 + aura * 0.3 + beatPulse * 0.25);
      }
    }

    // four hit stones
    for (let i = 0; i < 4; i++) {
      const x = LANE_X[i];
      const col = P.lane[i];
      const ip = pulse ? (pulse[i] || 0) : 0;
      // socket glow
      circle(ctx, x, HIT_Y, 8 + beatPulse * 4 + ip * 4, col, 0.08 + beatPulse * 0.08 + ip * 0.10);
      circle(ctx, x, HIT_Y, 3, col, 0.25 + beatPulse * 0.35 + ip * 0.2);
      // stone
      ctx.fillStyle = P.stone0;
      ctx.beginPath();
      ctx.moveTo(x - 10, 242);
      ctx.lineTo(x - 7, 227);
      ctx.lineTo(x + 7, 226);
      ctx.lineTo(x + 10, 242);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = P.stone1;
      ctx.beginPath();
      ctx.moveTo(x - 7, 227);
      ctx.lineTo(x - 1, 226);
      ctx.lineTo(x - 2, 242);
      ctx.lineTo(x - 10, 242);
      ctx.closePath();
      ctx.fill();
      rect(ctx, x + 6, 229, 2, 13, P.ink, 0.35);
      // ogham face
      ogham(ctx, x, 234, i + 1, P.bone0, col);
      // horizontal glow line at hit height
      rect(ctx, x - 12, HIT_Y, 24, 1, col, 0.20 + beatPulse * 0.35 + ip * 0.22);
    }
    // connecting line
    rect(ctx, LANE_X[0] - 18, HIT_Y, LANE_X[3] - LANE_X[0] + 36, 1, P.bone0, 0.07 + beatPulse * 0.08);
  }

  function drawNote(ctx, n, t) {
    const x = Math.round(n.x);
    const y = Math.round(n.y + (n.h || 0));
    const col = P.lane[n.lane];
    const s = n.s || 0.5;
    const g = n.g || 'rune';
    // trail
    for (let i = 1; i <= 4; i++) {
      const a = 0.11 * (1 - i / 5);
      rect(ctx, x - 1, y + i * 3, 2, 2, col, a);
    }
    // glow
    circle(ctx, x, y, 7 + Math.round(s * 3), col, 0.07 + s * 0.05);
    circle(ctx, x, y, 4, col, 0.08);

    const rows = g === 'string'
      ? [1, 3, 5, 7, 9, 9, 11, 9, 9, 7, 5, 3, 1]
      : [3, 5, 7, 9, 11, 11, 13, 11, 11, 9, 7, 5, 3];

    // diamond body
    for (let i = 0; i < rows.length; i++) {
      const w = rows[i];
      const yy = y - 6 + i;
      rect(ctx, x - (w >> 1), yy, w, 1, col);
    }
    for (let i = 1; i < rows.length - 1; i++) {
      const w = Math.max(1, rows[i] - 2);
      const yy = y - 6 + i;
      rect(ctx, x - (w >> 1), yy, w, 1, P.ink);
    }

    if (g === 'drum') {
      // skin + two drumsticks
      rect(ctx, x - 4, y - 1, 9, 2, P.bone1, 0.75);
      rect(ctx, x - 3, y, 7, 1, col, 0.9);
      line(ctx, x - 6, y - 6, x - 2, y - 2, P.gold2, 0.85);
      line(ctx, x + 6, y - 6, x + 2, y - 2, P.gold2, 0.85);
      px(ctx, x - 6, y - 7, P.white, 0.5);
      px(ctx, x + 6, y - 7, P.white, 0.5);
    } else if (g === 'rune') {
      ogham(ctx, x, y, n.runes || (n.lane + 1), P.white, col);
      rect(ctx, x - 3, y - 3, 7, 1, P.gold2, 0.45);
    } else if (g === 'string') {
      // a taut string and a small leaf
      rect(ctx, x, y - 6, 1, 13, P.white, 0.72);
      rect(ctx, x - 1, y - 1, 3, 1, P.gold2, 0.7);
      px(ctx, x + 4, y - 3, P.leaf2, 0.8);
      px(ctx, x + 5, y - 4, P.leaf2, 0.55);
      px(ctx, x - 4, y + 2, P.leaf1, 0.6);
    } else if (g === 'wind') {
      // three curling air strokes
      for (let i = 0; i < 3; i++) {
        const yy = y - 3 + i * 3;
        rect(ctx, x - 3, yy, 7, 1, i === 1 ? P.bone1 : P.water2, 0.8);
        px(ctx, x + 4, yy - 1, P.bone1, 0.55);
      }
      px(ctx, x, y - 6, P.white, 0.5);
    } else {
      // bell: side ticks and a clapper
      line(ctx, x - 6, y - 4, x - 8, y - 6, col, 0.6);
      line(ctx, x + 6, y - 4, x + 8, y - 6, col, 0.6);
      rect(ctx, x - 1, y + 4, 3, 1, P.gold2, 0.85);
    }

    // sparkle
    const sp = 0.55 + 0.45 * Math.sin(t * 7 + n.t * 3);
    px(ctx, x - 7, y - 4, P.white, 0.25 * sp);
    px(ctx, x + 7, y + 3, P.white, 0.2 * sp);
  }

  function drawLaneGlyph(ctx, x, y, kind, col, a) {
    if (a !== undefined) ctx.globalAlpha = a;
    if (kind === 'drum') {
      rect(ctx, x - 3, y - 1, 7, 1, col);
      rect(ctx, x - 2, y, 5, 1, col);
      line(ctx, x - 4, y - 4, x - 1, y - 2, P.gold2, 0.85);
      line(ctx, x + 4, y - 4, x + 1, y - 2, P.gold2, 0.85);
    } else if (kind === 'rune') {
      rect(ctx, x, y - 3, 1, 7, col);
      for (let i = 0; i < 3; i++) rect(ctx, x + 1, y - 2 + i * 2, 3, 1, col);
    } else if (kind === 'bell') {
      px(ctx, x, y - 4, col);
      rect(ctx, x - 1, y - 3, 3, 1, col);
      rect(ctx, x - 2, y - 2, 5, 2, col);
      rect(ctx, x - 3, y, 7, 1, col);
      rect(ctx, x - 1, y + 2, 3, 1, P.gold2, 0.85);
    } else if (kind === 'string') {
      rect(ctx, x - 3, y - 3, 1, 7, col);
      rect(ctx, x + 3, y - 3, 1, 7, col);
      for (let i = 0; i < 3; i++) rect(ctx, x - 2 + i * 2, y - 2, 1, 5, P.gold2, 0.75);
      rect(ctx, x - 2, y - 4, 5, 1, col);
    } else {
      for (let i = 0; i < 3; i++) {
        rect(ctx, x - 2, y - 2 + i * 2, 5, 1, col);
        px(ctx, x + 3, y - 3 + i * 2, col, 0.65);
      }
    }
    if (a !== undefined) ctx.globalAlpha = 1;
  }

  function drawInstrumentSigils(ctx, t, pulse, flash, glyphs) {
    for (let i = 0; i < 4; i++) {
      const x = LANE_X[i], y = 248;
      const p = pulse[i] || 0;
      const f = flash[i] || 0;
      const col = P.lane[i];
      if (p > 0.01 || f > 0.01) {
        circle(ctx, x, y, 7 + Math.round(p * 5), col, 0.04 + p * 0.10 + f * 0.05);
        circleOutline(ctx, x, y, 8 + Math.round(p * 4), col, 0.10 + p * 0.22);
      }
      drawLaneGlyph(ctx, x, y, (glyphs && glyphs[i]) || 'rune', col, 0.32 + p * 0.6);
    }
  }

  function drawBird(ctx, b) {
    const dir = b.vx >= 0 ? 1 : -1;
    const s = b.size || 1;
    const x = Math.round(b.x), y = Math.round(b.y);
    const near = (b.layer || 0) >= 1;
    const body = near ? P.night1 : P.hill1;
    const rim = b.gold ? P.gold2 : (near ? P.mist2 : P.mist1);
    const a = near ? 0.98 : 0.62;
    const fl = Math.sin(b.wing);
    ctx.globalAlpha = a;
    if (b.gold) {
      circle(ctx, x, y, 6 + s * 2, P.gold2, 0.035 + 0.022 * (0.5 + 0.5 * fl));
    }
    // fading wake
    for (let i = 1; i <= 5; i++) {
      px(ctx, x - dir * i * 3 * s, y + Math.round(Math.sin(b.wing - i * 0.7) * 1.5), rim, 0.10 * (6 - i) / 5);
    }
    // body, head, beak, tail
    rect(ctx, x - 2 * s, y - s, 5 * s, 2 * s, body);
    rect(ctx, x - s, y - 2 * s, 3 * s, s, body);
    px(ctx, x + dir * 3 * s, y - 2 * s, body);
    px(ctx, x + dir * 4 * s, y - 2 * s, rim);
    px(ctx, x - dir * 3 * s, y, body);
    px(ctx, x - dir * 4 * s, y - s, body);
    // wings: one clear M-shaped silhouette
    const spread = 2 + Math.round(Math.abs(fl) * 3);
    const wy = fl >= 0 ? -1 : 1;
    for (let k = 1; k <= spread * s; k += s) {
      const dx = Math.round(k * 0.9);
      const dy = Math.round(k * 0.55) * wy;
      px(ctx, x - s - dx, y + dy, body);
      px(ctx, x + s + dx, y + dy, body);
      if (k >= spread * s - s) {
        px(ctx, x - s - dx, y + dy - wy, rim, 0.65);
        px(ctx, x + s + dx, y + dy - wy, rim, 0.65);
      }
    }
    if (b.react > 0) {
      px(ctx, x + dir * 3 * s, y - 4 * s, P.gold2, 0.8);
      px(ctx, x + dir * 5 * s, y - 5 * s, P.bone1, 0.55);
    }
    ctx.globalAlpha = 1;
  }

  function drawBirds(ctx, birds) {
    if (!birds || !birds.length) return;
    for (const b of birds) {
      if ((b.layer || 0) === 0) drawBird(ctx, b);
    }
    for (const b of birds) {
      if ((b.layer || 0) !== 0) drawBird(ctx, b);
    }
  }

  function drawParticles(ctx, particles) {
    for (const p of particles) {
      const a = clamp(p.life / p.maxLife, 0, 1);
      if (p.kind === 'leaf') {
        rect(ctx, p.x, p.y, 2, 1, p.color, a * 0.9);
        px(ctx, p.x + 1, p.y - 1, p.color, a * 0.6);
      } else if (p.kind === 'ash') {
        rect(ctx, p.x, p.y, p.size, p.size, p.color, a * 0.6);
      } else if (p.kind === 'glyph') {
        drawLaneGlyph(ctx, p.x, p.y, p.glyph || 'rune', p.color, a * 0.85);
      } else {
        rect(ctx, p.x, p.y, p.size, p.size, p.color, a);
      }
    }
  }

  function drawRings(ctx, rings) {
    for (const r of rings) {
      const a = clamp(r.life / r.maxLife, 0, 1);
      circleOutline(ctx, r.x, r.y, r.r, r.color, a * 0.75);
      if (r.wide) circleOutline(ctx, r.x, r.y, r.r * 0.72, r.color, a * 0.3);
    }
  }

  function drawSwellAndFlash(ctx, state) {
    if (state.swell > 0.001) {
      rect(ctx, 0, 0, W, H, P.mist2, state.swell * 0.55);
      rect(ctx, 0, 0, W, H, P.bone1, state.swell * state.swell * 0.25);
      // slowly drifting fog bars
      for (let i = 0; i < 10; i++) {
        const y = (i * 29 + state.t * 12) % H;
        rect(ctx, 0, y, W, 2, P.mist2, state.swell * 0.10);
      }
    }
    if (state.flash > 0.001) {
      rect(ctx, 0, 0, W, H, P.gold2, state.flash * 0.34);
      rect(ctx, 0, 0, W, H, P.white, state.flash * 0.18);
    }
    if (state.fade > 0.001) {
      rect(ctx, 0, 0, W, H, P.void, state.fade * 0.72);
    }
  }

  function drawWorld(ctx, state) {
    const t = state.t;
    const level = state.level || 0;
    const beatPulse = state.beatPulse || 0;
    const aura = clamp((state.aura || 0) / 100, 0, 1);
    const blessing = state.blessing > 0 ? 1 : 0;
    const storm = state.section && (state.section.tag === 'storm' || state.section.tag === 'climax') ? 1 : 0;
    const instrPulse = state.instrPulse || [0, 0, 0, 0];
    const instrFlash = state.instrFlash || [0, 0, 0, 0];
    const shake = state.shake || 0;

    ctx.imageSmoothingEnabled = false;
    ctx.globalAlpha = 1;
    ctx.drawImage(sky, 0, 0);

    // section tint
    const tag = state.section ? state.section.tag : 'intro';
    if (tag === 'fire' || tag === 'sparks' || tag === 'climax') {
      rect(ctx, 0, 0, W, H, P.fire1, 0.035 + level * 0.02);
    } else if (tag === 'storm') {
      rect(ctx, 0, 0, W, H, P.water, 0.045);
    } else if (tag === 'outro') {
      rect(ctx, 0, 0, W, H, P.void, 0.18);
    }

    drawStars(ctx, t, level, storm);
    drawAurora(ctx, t, level, state.midP || 0, state.highP || 0, tag);
    drawMoon(ctx, t, level, state.highP || 0, storm);
    drawHills(ctx, t, level, storm);
    drawMist(ctx, t, level, tag, false);
    const shx = shake > 0.01 ? Math.round(Math.sin(t * 73) * shake * 2) : 0;
    const shy = shake > 0.01 ? Math.round(Math.cos(t * 67) * shake * 1.4) : 0;
    ctx.save();
    if (shx || shy) ctx.translate(shx, shy);
    drawStones(ctx, t, level, beatPulse, aura);
    drawTree(ctx, t, level, state.bloom || 0, aura, blessing, state.bassP || 0);
    drawGround(ctx, t, level, beatPulse);
    ctx.restore();
    drawMist(ctx, t, level, tag, true);
    drawBirds(ctx, state.birds);
    drawLaneChannels(ctx, t, level, beatPulse, blessing, instrPulse);
    drawAltar(ctx, t, level, beatPulse, aura, blessing, state.bassP || 0, instrPulse);
    drawInstrumentSigils(ctx, t, instrPulse, instrFlash, state.laneGlyphs);

    // notes
    if (state.notes) {
      for (const n of state.notes) {
        if (n.y < -18 || n.y > HIT_Y + 10) continue;
        drawNote(ctx, n, t);
      }
    }

    drawParticles(ctx, state.particles || []);
    drawRings(ctx, state.rings || []);
    drawFireflies(ctx, t, level, state.midP || 0, state.highP || 0, tag);

    // foreground vignette
    ctx.drawImage(vignette, 0, 0);
    drawSwellAndFlash(ctx, state);
  }

  window.NemetonArt = {
    W, H, HIT_Y, LANE_X, P, init, drawWorld,
    ogham, circle, circleOutline, rect, px, line, clamp
  };
})();
