/* ОСТАВШИЙСЯ — procedural pixel art.
   A 480×300 canvas, nearest-neighbour scaled. No image assets are needed for
   the world: layers, runes and the druid are drawn from pixels. */
(function () {
  'use strict';

  const W = 480;
  const H = 300;
  const HIT_Y = 254;
  const LANE_X = [132, 204, 276, 348];
  const LANE_W = 58;
  const SPAWN_Y = -14;
  const TRAVEL = 1.72;
  const SPEED = (HIT_Y - SPAWN_Y) / TRAVEL;

  const P = {
    ink: '#07070b',
    black: '#030305',
    white: '#f5f0de',
    bone: '#dcd6bd',
    bone2: '#b9b39a',
    gold: '#d7be4e',
    gold2: '#f0d878',
    ember: '#fc5214',
    ember2: '#ff8a3d',
    rust: '#a33a1e',
    moss: '#7fa86a',
    moss2: '#3f6b4a',
    moss3: '#254534',
    sky: '#85c8e3',
    sky2: '#4f9fbe',
    teal: '#4b8f8a',
    violet: '#6b4b8a',
    violet2: '#a476c4',
    red: '#c8462e',
    green: '#7ec96b',
    acid: '#b7e85a',
    water: '#326b78',
    water2: '#5fa8a0',
    lane: ['#d7be4e', '#7fa86a', '#dcd6bd', '#85c8e3']
  };

  const BAYER = [
    [0, 8, 2, 10],
    [12, 4, 14, 6],
    [3, 11, 1, 9],
    [15, 7, 13, 5]
  ];

  const SCENES = {
    menu: {
      sky: ['#05060d', '#090d1c', '#111a30', '#1e2438', '#3a2b32'],
      far: '#18202f', mid: '#111827', near: '#0a0f18',
      ground: ['#0b0f14', '#111820', '#18241f', '#213026'],
      accent: P.gold, glow: P.gold2, mist: '#5f6f78', stars: 120, bright: 0.4
    },
    barchans: {
      sky: ['#070a1a', '#111a36', '#2a2346', '#5a3345', '#9a4a3a'],
      far: '#2a2233', mid: '#3b2a33', near: '#5a3530',
      ground: ['#241a20', '#332226', '#4a2d29', '#6b3a2c'],
      accent: P.gold, glow: P.ember2, mist: '#a07a88', stars: 95, bright: 0.3
    },
    'shiny-sand': {
      sky: ['#9ad7e8', '#b8e7ee', '#d8f2ef', '#f2ead2', '#e7c37a'],
      far: '#7db9c1', mid: '#4b8d92', near: '#2d6269',
      ground: ['#183a3d', '#225256', '#2f6b6d', '#3d8580'],
      accent: P.gold, glow: P.white, mist: '#c9eef0', stars: 8, bright: 1.0
    },
    adaptation: {
      sky: ['#040a08', '#071410', '#0b2119', '#103024', '#183d2c'],
      far: '#0b1d16', mid: '#102b20', near: '#173828',
      ground: ['#0c1d15', '#122a1e', '#1b3a27', '#28543a'],
      accent: P.moss, glow: '#b7e85a', mist: '#6f9a7c', stars: 60, bright: 0.25
    },
    noah: {
      sky: ['#080d18', '#0d1828', '#14283d', '#1e3d54', '#2e5a68'],
      far: '#122534', mid: '#183445', near: '#224a56',
      ground: ['#0a1a22', '#102a34', '#163b44', '#1f5058'],
      accent: P.gold, glow: P.water2, mist: '#78a7ad', stars: 35, bright: 0.35
    },
    'time-shifting': {
      sky: ['#0b0618', '#1a0d2c', '#2d1548', '#4a1d5e', '#7a2d66'],
      far: '#28133d', mid: '#3b1a4e', near: '#57285f',
      ground: ['#160b24', '#231334', '#341b48', '#4a2758'],
      accent: P.violet2, glow: P.sky, mist: '#a476c4', stars: 110, bright: 0.4
    },
    aleppo: {
      sky: ['#0a0705', '#170d08', '#2b140b', '#4a220f', '#7a3a16'],
      far: '#24110a', mid: '#35170c', near: '#4f2410',
      ground: ['#120906', '#1e0e08', '#2e170c', '#472311'],
      accent: P.gold, glow: P.ember2, mist: '#b98a5a', stars: 30, bright: 0.3
    },
    shhhhhh: {
      sky: ['#030304', '#060507', '#0a080b', '#100c10', '#1a1014'],
      far: '#0b0a0d', mid: '#111015', near: '#18151a',
      ground: ['#070608', '#0d0b0e', '#151116', '#211a20'],
      accent: P.red, glow: P.ember, mist: '#5f4a50', stars: 12, bright: 0.15
    },
    atomic: {
      sky: ['#050806', '#0a120c', '#121e12', '#1d2c19', '#3d3d20'],
      far: '#121d13', mid: '#1a2a1a', near: '#283a22',
      ground: ['#0a100b', '#111a10', '#1a2916', '#2c3e1e'],
      accent: P.acid, glow: '#b7e85a', mist: '#8aa46a', stars: 40, bright: 0.25
    },
    neverborne: {
      sky: ['#05040c', '#0c0a1c', '#17132f', '#2a1e45', '#4a2c55'],
      far: '#1b1733', mid: '#282041', near: '#3a2d52',
      ground: ['#0c0a16', '#151121', '#221a30', '#332643'],
      accent: P.gold2, glow: P.white, mist: '#b9a7d4', stars: 150, bright: 0.45
    }
  };

  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const lerp = (a, b, t) => a + (b - a) * t;

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

  function px(ctx, x, y, c, a) {
    if (a !== undefined) ctx.globalAlpha = a;
    ctx.fillStyle = c;
    ctx.fillRect(x | 0, y | 0, 1, 1);
    if (a !== undefined) ctx.globalAlpha = 1;
  }

  function rect(ctx, x, y, w, h, c, a) {
    if (a !== undefined) ctx.globalAlpha = a;
    ctx.fillStyle = c;
    ctx.fillRect(x | 0, y | 0, w | 0, h | 0);
    if (a !== undefined) ctx.globalAlpha = 1;
  }

  function circle(ctx, cx, cy, r, c, a) {
    if (a !== undefined) ctx.globalAlpha = a;
    ctx.fillStyle = c;
    cx = Math.round(cx); cy = Math.round(cy);
    const rr = Math.max(0, Math.round(r));
    for (let y = -rr; y <= rr; y++) {
      const w = Math.floor(Math.sqrt(rr * rr - y * y));
      ctx.fillRect(cx - w, cy + y, w * 2 + 1, 1);
    }
    if (a !== undefined) ctx.globalAlpha = 1;
  }

  function ring(ctx, cx, cy, r, c, a) {
    if (a !== undefined) ctx.globalAlpha = a;
    ctx.fillStyle = c;
    cx = Math.round(cx); cy = Math.round(cy);
    const steps = Math.max(12, Math.round(r * 6));
    for (let i = 0; i < steps; i++) {
      const ang = (i / steps) * Math.PI * 2;
      ctx.fillRect(Math.round(cx + Math.cos(ang) * r), Math.round(cy + Math.sin(ang) * r), 1, 1);
    }
    if (a !== undefined) ctx.globalAlpha = 1;
  }

  function line(ctx, x0, y0, x1, y1, c, a, thick) {
    if (a !== undefined) ctx.globalAlpha = a;
    ctx.fillStyle = c;
    x0 = Math.round(x0); y0 = Math.round(y0);
    x1 = Math.round(x1); y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0), sx = x0 < x1 ? 1 : -1;
    const dy = -Math.abs(y1 - y0), sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    const t = Math.max(1, thick || 1);
    for (;;) {
      ctx.fillRect(x0, y0, t, t);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
    if (a !== undefined) ctx.globalAlpha = 1;
  }

  function dither(ctx, x, y, w, h, c1, c2, level) {
    // level 0..16: how much of c2 is mixed in
    for (let yy = 0; yy < h; yy++) {
      for (let xx = 0; xx < w; xx++) {
        const on = BAYER[(x + xx) & 3][(y + yy) & 3] < level;
        ctx.fillStyle = on ? c2 : c1;
        ctx.fillRect(x + xx, y + yy, 1, 1);
      }
    }
  }

  function ridge(ctx, baseY, amp1, freq1, amp2, freq2, phase, color, alpha) {
    if (alpha !== undefined) ctx.globalAlpha = alpha;
    ctx.fillStyle = color;
    for (let x = 0; x < W; x++) {
      const y = Math.round(
        baseY + Math.sin(x * freq1 + phase) * amp1 + Math.sin(x * freq2 - phase * 1.7) * amp2
      );
      ctx.fillRect(x, y, 1, H - y);
    }
    if (alpha !== undefined) ctx.globalAlpha = 1;
  }

  // ---------------------------------------------------------------- builders
  let sceneSlug = 'menu';
  let scene = SCENES.menu;
  let skyCanvas = null;
  let stars = [];
  let motes = [];
  let dust = [];
  let branches = [];
  let shards = [];
  let pages = [];
  let rocks = [];
  let shelves = [];
  let rain = [];
  let fireflies = [];
  let words = [];
  let seed = 1;

  function buildSky(pal) {
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const g = c.getContext('2d');
    const img = g.createImageData(W, H);
    const data = img.data;
    const cols = pal.sky.map(hex => {
      const n = parseInt(hex.slice(1), 16);
      return [n >> 16 & 255, n >> 8 & 255, n & 255];
    });
    const horizon = 196;
    for (let y = 0; y < H; y++) {
      let f;
      if (y < horizon) {
        f = (y / horizon) * (cols.length - 1);
      } else {
        f = cols.length - 1;
      }
      const i0 = clamp(Math.floor(f), 0, cols.length - 1);
      const i1 = clamp(i0 + 1, 0, cols.length - 1);
      const frac = f - i0;
      for (let x = 0; x < W; x++) {
        const d = BAYER[x & 3][y & 3] / 16;
        const col = frac > d ? cols[i1] : cols[i0];
        const p = (y * W + x) * 4;
        data[p] = col[0]; data[p + 1] = col[1]; data[p + 2] = col[2]; data[p + 3] = 255;
      }
    }
    g.putImageData(img, 0, 0);
    return c;
  }

  function buildCommon(pal, s) {
    const rnd = mulberry32(s * 7919 + 13);
    stars = [];
    for (let i = 0; i < pal.stars; i++) {
      const x = rnd() * W;
      const y = 8 + rnd() * 150;
      const z = rnd();
      stars.push({
        x, y,
        c: z < 0.15 ? P.white : z < 0.55 ? P.bone : pal.accent,
        p: rnd() * 6.28,
        s: z > 0.9 ? 2 : 1,
        a: 0.25 + rnd() * 0.7
      });
    }
    motes = [];
    for (let i = 0; i < 52; i++) {
      motes.push({
        x: rnd() * W,
        y: 40 + rnd() * 230,
        vx: -4 - rnd() * 12,
        vy: (rnd() - 0.5) * 4,
        c: rnd() < 0.28 ? pal.accent : (rnd() < 0.55 ? pal.glow : P.bone),
        p: rnd() * 6.28,
        a: 0.08 + rnd() * 0.22,
        s: rnd() < 0.18 ? 2 : 1
      });
    }
    dust = [];
    for (let i = 0; i < 36; i++) {
      dust.push({
        x: rnd() * W,
        y: 120 + rnd() * 150,
        p: rnd() * 6.28,
        sp: 0.4 + rnd() * 1.7,
        a: 0.06 + rnd() * 0.18
      });
    }
    rain = [];
    for (let i = 0; i < 90; i++) {
      rain.push({
        x: rnd() * (W + 80) - 40,
        y: rnd() * H,
        sp: 120 + rnd() * 190,
        len: 3 + Math.floor(rnd() * 6)
      });
    }
    fireflies = [];
    for (let i = 0; i < 44; i++) {
      fireflies.push({
        x: 20 + rnd() * (W - 40),
        y: 90 + rnd() * 150,
        p: rnd() * 6.28,
        sp: 0.25 + rnd() * 0.8,
        amp: 3 + rnd() * 13,
        c: rnd() < 0.3 ? P.bone : (rnd() < 0.55 ? pal.accent : pal.glow)
      });
    }
    branches = [];
    rocks = [];
    shards = [];
    pages = [];
    shelves = [];
    words = [];
  }

  function buildBranches() {
    branches = [];
    const rnd = mulberry32(0xBEEF);
    function branch(x, y, ang, len, wid, depth) {
      const x2 = x + Math.cos(ang) * len;
      const y2 = y + Math.sin(ang) * len;
      branches.push({ x0: x, y0: y, x1: x2, y1: y2, w: wid, depth });
      if (depth <= 0) return;
      const spread = 0.32 + rnd() * 0.24;
      branch(x2, y2, ang - spread, len * (0.66 + rnd() * 0.12), Math.max(1, wid * 0.62), depth - 1);
      branch(x2, y2, ang + spread * (0.7 + rnd() * 0.5), len * (0.62 + rnd() * 0.14), Math.max(1, wid * 0.58), depth - 1);
      if (depth > 2 && rnd() < 0.3) {
        branch(x2, y2, ang + (rnd() - 0.5) * 1.1, len * 0.52, Math.max(1, wid * 0.4), depth - 2);
      }
    }
    branch(78, 246, -Math.PI / 2 + 0.08, 30, 6, 5);
    branch(408, 248, -Math.PI / 2 - 0.12, 27, 5, 5);
    branch(360, 248, -Math.PI / 2 + 0.22, 22, 4, 4);
  }

  function buildScene(slug) {
    sceneSlug = slug;
    scene = SCENES[slug] || SCENES.menu;
    seed = slug.split('').reduce((a, ch) => a + ch.charCodeAt(0), 0);
    skyCanvas = buildSky(scene);
    buildCommon(scene, seed);
    const rnd = mulberry32(seed * 104729 + 7);

    if (slug === 'barchans') {
      rocks = [];
      for (let i = 0; i < 8; i++) {
        rocks.push({ x: rnd() * W, y: 212 + rnd() * 50, w: 2 + rnd() * 7, h: 1 + rnd() * 2 });
      }
    }
    if (slug === 'shiny-sand') {
      shards = [];
      for (let i = 0; i < 44; i++) {
        shards.push({
          x: rnd() * W, y: 196 + rnd() * 90,
          w: 3 + rnd() * 13, h: 1 + rnd() * 2,
          p: rnd() * 6.28, c: rnd() < 0.4 ? P.white : (rnd() < 0.6 ? P.sky : P.gold)
        });
      }
    }
    if (slug === 'adaptation') buildBranches();
    if (slug === 'time-shifting') {
      rocks = [];
      for (let i = 0; i < 16; i++) {
        rocks.push({
          x: 30 + rnd() * (W - 60), y: 35 + rnd() * 120,
          w: 8 + rnd() * 26, h: 5 + rnd() * 16,
          p: rnd() * 6.28, sp: 0.15 + rnd() * 0.5
        });
      }
    }
    if (slug === 'aleppo') {
      shelves = [];
      for (let i = 0; i < 8; i++) {
        shelves.push({ x: 20 + i * 58 + rnd() * 18, y: 70 + rnd() * 35, w: 30 + rnd() * 28, h: 90 + rnd() * 55 });
      }
      pages = [];
      for (let i = 0; i < 34; i++) {
        pages.push({
          x: rnd() * W, y: 60 + rnd() * 150,
          p: rnd() * 6.28, sp: 2 + rnd() * 8, rot: rnd() < 0.5 ? 1 : 0
        });
      }
      words = ['имя', 'огонь', 'пепел', 'сон', 'дом', 'море', 'кость', 'свет'];
    }
    if (slug === 'neverborne') {
      rocks = [];
      for (let i = 0; i < 10; i++) {
        rocks.push({ x: rnd() * W, y: 190 + rnd() * 80, w: 6 + rnd() * 26, h: 2 + rnd() * 5 });
      }
    }
    if (slug === 'atomic') buildBranches();
  }

  // ---------------------------------------------------------------- helpers
  function drawStars(ctx, t, L, alpha) {
    for (const s of stars) {
      const tw = 0.4 + 0.6 * (0.5 + 0.5 * Math.sin(t * 1.4 + s.p));
      const a = s.a * tw * alpha;
      if (a < 0.05) continue;
      px(ctx, s.x, s.y, s.c, a);
      if (s.s === 2) {
        px(ctx, s.x - 1, s.y, s.c, a * 0.3);
        px(ctx, s.x + 1, s.y, s.c, a * 0.3);
        px(ctx, s.x, s.y - 1, s.c, a * 0.3);
        px(ctx, s.x, s.y + 1, s.c, a * 0.3);
      }
    }
  }

  function drawMoon(ctx, x, y, r, col, t, L) {
    circle(ctx, x, y, r + 11, col, 0.02 + L.high * 0.02);
    circle(ctx, x, y, r + 5, col, 0.035 + L.high * 0.02);
    circle(ctx, x, y, r, col, 0.92);
    circle(ctx, x - r * 0.22, y - r * 0.15, r * 0.78, P.white, 0.22);
    for (let i = 0; i < 5; i++) {
      const a = t * 0.04 + i * 1.9;
      circle(ctx, x + Math.cos(a) * r * 0.5, y + Math.sin(a * 1.3) * r * 0.45, 1 + (i % 2), P.bone2, 0.16);
    }
    ring(ctx, x, y, r + 4, col, 0.045);
  }

  function drawMotes(ctx, t, L, colOverride) {
    for (const m of motes) {
      const x = ((m.x + t * m.vx) % (W + 40) + W + 40) % (W + 40) - 20;
      const y = m.y + Math.sin(t * 0.7 + m.p) * 3 + m.vy * t * 0.2;
      const a = m.a * (0.5 + 0.5 * Math.sin(t * 1.2 + m.p)) * (0.6 + L.mid * 0.8);
      if (a < 0.02) continue;
      px(ctx, x, y, colOverride || m.c, a);
      if (m.s === 2) px(ctx, x + 1, y, colOverride || m.c, a * 0.5);
    }
  }

  function drawRain(ctx, t, L, alpha) {
    const off = (t * 220) % 20;
    for (const r of rain) {
      const y = (r.y + t * r.sp) % (H + 20) - 10;
      const x = r.x - t * 16;
      line(ctx, x, y, x - 1, y + r.len, P.sky, clamp(alpha * (0.25 + L.high * 0.35), 0, 0.6));
    }
  }

  function drawFireflies(ctx, t, L, pal) {
    for (const f of fireflies) {
      const x = f.x + Math.sin(t * f.sp + f.p) * f.amp;
      const y = f.y + Math.cos(t * f.sp * 1.3 + f.p) * f.amp * 0.6;
      const a = 0.18 + 0.55 * (0.5 + 0.5 * Math.sin(t * 2.2 + f.p)) * (0.5 + L.mid * 0.9);
      px(ctx, x, y, f.c, a);
      px(ctx, x, y - 1, f.c, a * 0.25);
      px(ctx, x - 1, y, f.c, a * 0.25);
    }
  }

  function drawDunes(ctx, t, L, pal) {
    const bass = L.bass;
    ridge(ctx, 154 + Math.sin(t * 0.12) * 2, 7, 0.012, 3, 0.031, 1.2 + t * 0.02, pal.far, 0.95);
    // distant whale ribs
    const rx = 340, ry = 158;
    for (let i = 0; i < 6; i++) {
      const r = 26 + i * 7;
      ctx.globalAlpha = 0.22 - i * 0.02;
      ctx.strokeStyle = P.bone2;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(rx, ry, r, Math.PI * 1.08, Math.PI * 1.92);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
    ridge(ctx, 174 + Math.sin(t * 0.2 + 1) * 3, 10, 0.017, 4, 0.043, 3.1, pal.mid, 0.95);
    // wind streaks
    for (let i = 0; i < 8; i++) {
      const y = 160 + i * 8 + Math.sin(t * 0.4 + i) * 2;
      const x = ((t * (14 + i * 2) + i * 61) % (W + 100)) - 50;
      rect(ctx, x, y, 16 + i * 3, 1, P.bone, 0.05 + L.high * 0.04);
    }
    // foreground dune with bass ripple
    const base = 206;
    for (let x = 0; x < W; x++) {
      const y = Math.round(
        base + Math.sin(x * 0.011 + 4.2) * 13 + Math.sin(x * 0.029 + 1.4) * 5 +
        Math.sin(x * 0.045 + t * 1.7) * bass * 2.2
      );
      rect(ctx, x, y, 1, H - y, pal.ground[x % 3 === 0 ? 1 : 0]);
      if (x % 7 === 0) px(ctx, x, y, pal.accent, 0.18 + L.high * 0.22);
    }
    // salt bones
    for (const r of rocks) {
      rect(ctx, r.x, r.y, r.w, r.h, P.bone2, 0.22);
      rect(ctx, r.x, r.y, r.w, 1, P.white, 0.2);
    }
  }

  function drawShinySand(ctx, t, L, pal) {
    // hot horizon
    rect(ctx, 0, 0, W, H, pal.sky[2], 0.08);
    drawMoon(ctx, 382, 58, 23, P.white, t, L);
    circle(ctx, 382, 58, 34, P.gold, 0.02 + L.high * 0.03);
    ridge(ctx, 160, 4, 0.02, 2, 0.06, 0.4, pal.far, 0.55);
    // glass field
    rect(ctx, 0, 186, W, H - 186, pal.ground[1]);
    for (let i = 0; i < 26; i++) {
      const y = 194 + i * 4;
      rect(ctx, 0, y, W, 1, pal.ground[i % 2 ? 2 : 0], 0.35);
    }
    // shards
    for (const s of shards) {
      const glint = Math.max(0, Math.sin(t * 2.2 + s.p)) * (0.3 + L.high);
      rect(ctx, s.x, s.y, s.w, s.h, s.c, 0.18 + glint * 0.22);
      if (glint > 0.6) px(ctx, s.x + 1, s.y, P.white, glint * 0.8);
    }
    // cracks / reflected sun
    for (let i = 0; i < 12; i++) {
      const x = 30 + i * 37;
      line(ctx, x, 210, x + Math.sin(i) * 20, 246, P.white, 0.05 + L.high * 0.04);
    }
    // green sprout
    const sx = 348, sy = 252;
    rect(ctx, sx, sy - 7, 1, 8, P.moss, 0.9);
    rect(ctx, sx - 4, sy - 7, 4, 1, P.green, 0.85);
    rect(ctx, sx + 1, sy - 5, 3, 1, P.green, 0.7);
    circle(ctx, sx, sy - 6, 5, P.green, 0.06 + L.mid * 0.05);
  }

  function drawAdaptation(ctx, t, L, pal) {
    // canopy shadows
    for (let i = 0; i < 7; i++) {
      const x = i * 78 - 10 + Math.sin(t * 0.1 + i) * 4;
      ridge(ctx, 28 + i * 5, 13, 0.015, 5, 0.05, i * 2.3, pal.far, 0.24);
    }
    // trunks
    for (let i = 0; i < 5; i++) {
      const x = 18 + i * 113;
      const w = 10 + (i % 3) * 5;
      rect(ctx, x, 40, w, 180, pal.far, 0.85);
      rect(ctx, x + 2, 40, 2, 180, pal.mid, 0.7);
      for (let k = 0; k < 8; k++) {
        rect(ctx, x - 6 - (k % 2) * 3, 70 + k * 19, 12, 2, pal.near, 0.55);
      }
    }
    // branches
    for (const b of branches) {
      line(ctx, b.x0, b.y0, b.x1, b.y1, pal.far, 0.95, Math.max(1, Math.round(b.w / 2)));
    }
    // ruined columns
    rect(ctx, 66, 158, 14, 82, P.stone0 || '#28322e', 0.8);
    rect(ctx, 72, 166, 2, 66, P.bone2, 0.12);
    rect(ctx, 372, 170, 11, 70, '#28322e', 0.75);
    // ground
    rect(ctx, 0, 224, W, H - 224, pal.ground[0]);
    for (let i = 0; i < 20; i++) {
      const x = (i * 53 + 11) % W;
      rect(ctx, x, 228 + (i % 5) * 12, 18 + (i % 4) * 9, 1, pal.ground[2], 0.35);
    }
    // glowing fungi
    for (let i = 0; i < 15; i++) {
      const x = 24 + i * 31;
      const y = 238 + (i % 3) * 12;
      const gl = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(t * 1.8 + i));
      circle(ctx, x, y, 2 + (i % 2), P.moss, 0.08 + L.mid * 0.06);
      rect(ctx, x - 2, y, 5, 1, P.moss, gl * 0.7);
      rect(ctx, x, y + 1, 1, 2, P.bone, 0.35);
    }
    drawFireflies(ctx, t, L, pal);
    drawMotes(ctx, t, L, P.moss);
  }

  function drawNoah(ctx, t, L, pal) {
    drawRain(ctx, t, L, 0.5 + L.high * 0.2);
    // lightning
    const flash = Math.max(0, Math.sin(t * 0.7) * Math.sin(t * 0.23));
    if (flash > 0.94) {
      for (let i = 0; i < 7; i++) {
        const x = 80 + i * 18;
        line(ctx, x, 20, x + (i % 2 ? -8 : 9), 70 + (i % 3) * 18, P.white, 0.18);
      }
    }
    ridge(ctx, 158, 3, 0.02, 4, 0.05, 1.1, pal.far, 0.7);
    // ark hull
    const ax = 300, ay = 214;
    ctx.globalAlpha = 0.9;
    ctx.fillStyle = '#2b1a12';
    ctx.beginPath();
    ctx.moveTo(ax - 130, ay + 30);
    ctx.lineTo(ax - 96, ay - 30);
    ctx.lineTo(ax + 42, ay - 52);
    ctx.lineTo(ax + 116, ay + 4);
    ctx.lineTo(ax + 148, ay + 28);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;
    for (let i = 0; i < 9; i++) {
      const x = ax - 96 + i * 22;
      line(ctx, x, ay - 30 + i * 1.5, x - 8, ay + 28, '#6b3a24', 0.55);
    }
    // ark ribs
    for (let i = 0; i < 5; i++) {
      ctx.globalAlpha = 0.55;
      ctx.strokeStyle = '#a0653a';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(ax - 40, ay - 10, 26 + i * 10, Math.PI * 1.05, Math.PI * 1.55);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
    // warm egg light inside
    const ex = 254, ey = 196;
    circle(ctx, ex, ey, 8 + Math.sin(t * 2) * 1, P.gold, 0.1 + L.mid * 0.08);
    rect(ctx, ex - 2, ey - 3, 5, 6, P.gold2, 0.75);
    // water
    rect(ctx, 0, 230, W, H - 230, pal.ground[1]);
    for (let i = 0; i < 9; i++) {
      const y = 234 + i * 7;
      const off = Math.sin(t * 0.8 + i * 0.5) * 8;
      rect(ctx, off, y, W, 1, pal.ground[i % 2 ? 2 : 0], 0.5);
    }
    for (let i = 0; i < 14; i++) {
      const x = (i * 41 + t * 9) % W;
      rect(ctx, x, 240 + (i % 4) * 10, 12, 1, P.water2, 0.2 + L.high * 0.2);
    }
    drawMotes(ctx, t, L, P.sky);
  }

  function drawTimeShifting(ctx, t, L, pal) {
    // fractured sky shards
    for (let i = 0; i < 9; i++) {
      const x = (i * 67 + 18) % W;
      const y = 30 + (i % 4) * 24;
      const w = 30 + (i % 3) * 22;
      ctx.globalAlpha = 0.12;
      ctx.fillStyle = i % 2 ? P.sky : P.violet2;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + w, y + 8);
      ctx.lineTo(x + w - 12, y + 30);
      ctx.lineTo(x + 8, y + 22);
      ctx.closePath();
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    // clock rings
    const cx = 382, cy = 62;
    for (let i = 0; i < 4; i++) {
      ring(ctx, cx, cy, 20 + i * 13, i % 2 ? P.sky : P.violet2, 0.12 + L.mid * 0.1);
      const a = t * (0.4 + i * 0.17) + i;
      px(ctx, cx + Math.cos(a) * (20 + i * 13), cy + Math.sin(a) * (20 + i * 13), P.gold2, 0.7);
    }
    // floating rocks
    for (const r of rocks) {
      const y = r.y + Math.sin(t * r.sp + r.p) * 5;
      ctx.globalAlpha = 0.75;
      ctx.fillStyle = pal.near;
      ctx.beginPath();
      ctx.moveTo(r.x, y);
      ctx.lineTo(r.x + r.w * 0.7, y - r.h * 0.3);
      ctx.lineTo(r.x + r.w, y + r.h * 0.4);
      ctx.lineTo(r.x + r.w * 0.2, y + r.h);
      ctx.closePath();
      ctx.fill();
      ctx.globalAlpha = 1;
      rect(ctx, r.x + 2, y - 1, Math.max(1, r.w * 0.4), 1, P.sky, 0.18 + L.high * 0.18);
    }
    // ground
    rect(ctx, 0, 226, W, H - 226, pal.ground[0]);
    for (let i = 0; i < 7; i++) {
      const x = 20 + i * 67;
      line(ctx, x, 230, x + 30, 296, P.violet2, 0.08);
    }
    // afterimage druids
    for (let i = 0; i < 3; i++) {
      const ox = -58 - i * 26 + Math.sin(t * 0.5 + i) * 8;
      ctx.globalAlpha = 0.07 + i * 0.025;
      ctx.fillStyle = P.sky;
      ctx.fillRect(240 + ox, 196, 16, 42);
      ctx.fillRect(236 + ox, 188, 24, 5);
      ctx.fillStyle = P.violet2;
      ctx.fillRect(248 + ox, 190, 3, 3);
      ctx.globalAlpha = 1;
    }
    drawMotes(ctx, t, L, P.violet2);
  }

  function drawAleppo(ctx, t, L, pal) {
    // shelves
    for (const s of shelves) {
      rect(ctx, s.x, s.y, s.w, s.h, '#2a140b', 0.88);
      for (let i = 0; i < 4; i++) {
        rect(ctx, s.x, s.y + 14 + i * 19, s.w, 2, '#6b3a1c', 0.55);
        for (let k = 0; k < 5; k++) {
          if (hash(s.x + i * 13 + k * 7) > 0.45) {
            rect(ctx, s.x + 3 + k * 5, s.y + 8 + i * 19, 3, 10, k % 2 ? P.gold : P.rust, 0.25 + L.mid * 0.2);
          }
        }
      }
      rect(ctx, s.x + s.w - 2, s.y, 2, s.h, P.ember, 0.08);
    }
    // arches
    for (let i = 0; i < 3; i++) {
      const x = 60 + i * 150;
      ctx.globalAlpha = 0.42;
      ctx.strokeStyle = '#6b3a1c';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(x, 168, 42, Math.PI, 0);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
    // floor
    rect(ctx, 0, 234, W, H - 234, pal.ground[0]);
    for (let i = 0; i < 18; i++) {
      rect(ctx, (i * 37) % W, 240 + (i % 4) * 11, 22, 1, pal.ground[2], 0.35);
    }
    // fire glow
    const glow = 0.12 + L.bass * 0.18;
    circle(ctx, 240, 250, 70, P.ember, glow * 0.16);
    circle(ctx, 240, 250, 36, P.ember2, glow * 0.22);
    // floating pages
    for (const p of pages) {
      const y = p.y + Math.sin(t * 0.7 + p.p) * 9;
      const x = (p.x + t * p.sp) % (W + 30) - 15;
      rect(ctx, x, y, p.rot ? 5 : 3, p.rot ? 2 : 4, P.bone, 0.25 + L.high * 0.3);
      px(ctx, x, y, P.gold2, 0.3);
    }
    // words drifting
    for (let i = 0; i < words.length; i++) {
      const y = 96 + i * 17 + Math.sin(t * 0.4 + i) * 4;
      const x = (t * (2 + i * 0.4) + i * 47) % (W + 60) - 30;
      rect(ctx, x, y, 2, 1, P.gold, 0.12 + L.mid * 0.16);
      rect(ctx, x + 4, y, 1, 1, P.gold, 0.1);
    }
    drawMotes(ctx, t, L, P.ember2);
  }

  function drawShhhhhh(ctx, t, L, pal) {
    // industrial pillars
    for (let i = 0; i < 6; i++) {
      const x = 24 + i * 80;
      rect(ctx, x, 84 + (i % 3) * 12, 13 + (i % 2) * 6, 160, pal.far, 0.85);
      rect(ctx, x + 2, 84 + (i % 3) * 12, 1, 160, P.red, 0.08);
    }
    // giant eye
    const ex = 240, ey = 118;
    const open = clamp(0.12 + L.mid * 0.1 + L.bass * 0.08, 0, 0.55);
    ctx.globalAlpha = 0.8;
    ctx.fillStyle = P.bone2;
    ctx.beginPath();
    ctx.ellipse(ex, ey, 86, 30, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    circle(ctx, ex, ey, 27, P.black, 1);
    circle(ctx, ex, ey, 25, P.red, 0.32 + L.bass * 0.2);
    circle(ctx, ex, ey, 11, P.black, 1);
    // lid
    const lid = 1 - open;
    rect(ctx, ex - 90, ey - 32, 180, Math.max(2, 34 * lid), P.black, 1);
    rect(ctx, ex - 90, ey + 30 - Math.max(2, 34 * lid), 180, Math.max(2, 34 * lid), P.black, 1);
    ring(ctx, ex, ey, 62, P.red, 0.06 + L.bass * 0.05);
    // scanlines
    for (let y = 0; y < H; y += 3) {
      rect(ctx, 0, y, W, 1, P.black, 0.22);
    }
    // static blocks
    for (let i = 0; i < 9; i++) {
      const x = (hash(i * 17 + Math.floor(t * 8)) * W) | 0;
      const y = (hash(i * 31 + Math.floor(t * 7)) * H) | 0;
      rect(ctx, x, y, 2 + (i % 5) * 4, 1, i % 3 ? P.bone2 : P.red, 0.12 + L.high * 0.15);
    }
    rect(ctx, 0, 232, W, H - 232, pal.ground[0]);
    for (let i = 0; i < 8; i++) {
      rect(ctx, 0, 238 + i * 6, W, 1, P.black, 0.4);
    }
    // little shhh marks
    const letters = 'ш ш ш ш ш';
    for (let i = 0; i < 5; i++) {
      const x = 56 + i * 92;
      const y = 206 + Math.sin(t * 0.8 + i) * 3;
      rect(ctx, x, y, 7, 1, P.bone2, 0.08 + L.mid * 0.12);
      rect(ctx, x + 2, y + 3, 1, 5, P.bone2, 0.08 + L.mid * 0.12);
    }
  }

  function drawAtomic(ctx, t, L, pal) {
    // black sun
    const sx = 382, sy = 62;
    circle(ctx, sx, sy, 32, P.acid, 0.04 + L.bass * 0.04);
    circle(ctx, sx, sy, 22, P.black, 1);
    ring(ctx, sx, sy, 27, P.acid, 0.3 + L.high * 0.2);
    ring(ctx, sx, sy, 34, P.gold, 0.08);
    // crater rim
    ridge(ctx, 166, 5, 0.013, 3, 0.038, 2.2, pal.far, 0.9);
    // dead trees
    for (const b of branches) {
      line(ctx, b.x0, b.y0, b.x1, b.y1, '#1a2416', 0.9, Math.max(1, Math.round(b.w / 2)));
    }
    // crater bowl
    const cw = 168, cx = 240, cy = 232;
    ctx.globalAlpha = 0.95;
    ctx.fillStyle = pal.ground[0];
    ctx.beginPath();
    ctx.ellipse(cx, cy, cw, 66, 0, 0, Math.PI);
    ctx.fill();
    ctx.globalAlpha = 1;
    // glowing pool
    for (let i = 0; i < 6; i++) {
      const w = 54 - i * 7;
      const y = 238 + i * 5;
      rect(ctx, cx - w, y, w * 2, 2, i % 2 ? P.acid : '#6f9c36', 0.18 + L.bass * 0.16);
    }
    circle(ctx, cx, 248, 38, P.acid, 0.06 + L.bass * 0.05);
    // dead ground
    rect(ctx, 0, 268, W, H - 268, pal.ground[0]);
    // radiation motes
    drawMotes(ctx, t, L, P.acid);
    for (let i = 0; i < 18; i++) {
      const x = (i * 47 + 13) % W;
      const y = 210 + (i % 5) * 10;
      const a = 0.2 + 0.5 * (0.5 + 0.5 * Math.sin(t * 2 + i)) * (0.4 + L.high);
      px(ctx, x, y, P.acid, a);
    }
    // two-shadow fish
    const fx = cx + 30 + Math.sin(t * 0.4) * 16;
    const fy = 250 + Math.sin(t * 0.7) * 3;
    rect(ctx, fx - 4, fy, 8, 2, P.bone, 0.65);
    rect(ctx, fx + 4, fy - 1, 2, 4, P.bone, 0.5);
    rect(ctx, fx - 8, fy + 3, 9, 1, P.black, 0.35);
    rect(ctx, fx - 12, fy + 2, 8, 1, P.black, 0.2);
  }

  function drawNeverborne(ctx, t, L, pal) {
    // cosmic rings
    const cx = 240, cy = 118;
    for (let i = 0; i < 5; i++) {
      ring(ctx, cx, cy, 44 + i * 22 + Math.sin(t * 0.3 + i) * 2, i % 2 ? P.gold : P.violet2, 0.07 + L.high * 0.05);
    }
    // sleeping shape under sand
    ctx.globalAlpha = 0.16;
    ctx.fillStyle = P.bone;
    ctx.beginPath();
    ctx.ellipse(240, 206, 150, 58, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.globalAlpha = 0.1;
    ctx.fillStyle = P.gold2;
    ctx.beginPath();
    ctx.ellipse(232, 198, 92, 38, -0.1, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    // sand ground
    rect(ctx, 0, 226, W, H - 226, pal.ground[0]);
    for (let i = 0; i < 14; i++) {
      rect(ctx, 0, 232 + i * 5, W, 1, pal.ground[i % 2 ? 2 : 0], 0.3);
    }
    // well opening
    const wy = 262;
    for (let i = 0; i < 6; i++) {
      const w = 60 - i * 7;
      rect(ctx, 240 - w, wy + i * 3, w * 2, 2, i % 2 ? P.gold2 : P.gold, 0.12 + L.bass * 0.12);
    }
    circle(ctx, 240, wy + 8, 38, P.white, 0.06 + L.mid * 0.06);
    // rising light motes
    for (let i = 0; i < 22; i++) {
      const x = 240 + Math.sin(i * 7.3 + t * 0.2) * (20 + (i % 9) * 8);
      const y = 290 - ((t * (12 + (i % 5) * 6) + i * 17) % 150);
      px(ctx, x, y, i % 3 ? P.gold2 : P.white, 0.2 + L.high * 0.3);
    }
    for (const r of rocks) {
      rect(ctx, r.x, r.y, r.w, r.h, pal.ground[2], 0.5);
    }
    drawMotes(ctx, t, L, P.gold2);
  }

  // ---------------------------------------------------------------- druid
  function drawDruid(ctx, st) {
    const x = 240;
    const ground = 246;
    const bob = Math.round(Math.sin(st.t * 2.1) * 0.7);
    const cast = st.cast || 0;
    const sway = Math.sin(st.t * 1.1) * 0.5;
    const s = 2;

    // shadow
    rect(ctx, x - 16, ground + 1, 32, 2, P.black, 0.35);
    rect(ctx, x - 10, ground + 3, 20, 1, P.black, 0.2);

    ctx.save();
    ctx.translate(x, ground + bob);
    ctx.scale(s, s);

    const cloak0 = '#180e0c';
    const cloak1 = '#251411';
    const cloak2 = '#3a1c14';
    const trim = P.ember;

    // staff behind body
    line(ctx, 11, -43, 10, 3, '#3a2418', 1);
    line(ctx, 11, -43, 9, -52, '#5a3a22', 1);
    line(ctx, 9, -52, 12, -58, '#5a3a22', 1);
    line(ctx, 12, -58, 15, -55, '#5a3a22', 1);
    // staff glow
    const pulse = 0.35 + (st.levels ? st.levels.bass : 0) * 0.5 + cast * 0.4;
    circle(ctx, 13, -60, 7, P.ember, 0.06 * pulse);
    circle(ctx, 13, -60, 4, P.ember2, 0.12 * pulse);
    rect(ctx, 11, -63, 4, 5, P.gold2, 0.8);
    rect(ctx, 12, -62, 2, 3, P.white, 0.8);

    // cloak / body
    rect(ctx, -7, -28, 15, 25, cloak0);
    rect(ctx, -8, -22, 17, 18, cloak1);
    rect(ctx, -6, -30, 13, 6, cloak2);
    // cloak hem, wind
    rect(ctx, -9 + sway, -5, 19, 2, cloak1);
    rect(ctx, -11 + sway, -3, 23, 1, cloak0);
    rect(ctx, -10, -8, 2, 4, trim, 0.55);
    rect(ctx, 7, -8, 2, 4, trim, 0.45);
    // belt / ogham rune
    rect(ctx, -7, -17, 15, 1, '#5a3a22');
    rect(ctx, -1, -18, 2, 3, P.gold, 0.8);
    // arm holding staff
    line(ctx, 6, -24, 10, -18, cloak2, 1, 2);
    line(ctx, 10, -18, 11, -14, cloak2, 1, 2);
    rect(ctx, 10, -15, 2, 3, P.bone, 0.7);
    // other arm
    line(ctx, -6, -24, -10, -18, cloak2, 1, 2);
    rect(ctx, -11, -19, 2, 3, P.bone, 0.6);

    // head / mask
    rect(ctx, -5, -35, 10, 8, cloak0);
    rect(ctx, -4, -34, 8, 6, P.bone, 0.95);
    rect(ctx, -4, -34, 8, 1, P.white, 0.9);
    rect(ctx, -3, -32, 2, 2, P.black, 0.95);
    rect(ctx, 1, -32, 2, 2, P.black, 0.95);
    rect(ctx, -1, -29, 2, 1, P.bone2, 0.8);
    // ember sigil on forehead
    rect(ctx, -1, -35, 2, 1, trim, 0.9);
    // hat brim + crown (wide woven hat from the character sheet)
    rect(ctx, -11, -39, 22, 2, P.bone2);
    rect(ctx, -10, -41, 20, 2, P.bone);
    rect(ctx, -7, -47, 14, 7, P.bone);
    rect(ctx, -6, -48, 12, 1, P.white);
    rect(ctx, -7, -43, 14, 1, P.ember, 0.8);
    rect(ctx, -7, -41, 14, 1, P.bone2, 0.8);
    rect(ctx, 3, -47, 2, 2, P.gold, 0.8);
    // hood shadow under brim
    rect(ctx, -5, -37, 10, 1, P.black, 0.55);

    // cast arm / lantern gesture
    if (cast > 0.05) {
      ctx.globalAlpha = cast;
      line(ctx, -6, -24, -12, -34, P.bone, 0.8, 1);
      circle(ctx, -13, -35, 3, P.gold2, 0.5 * cast);
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  }

  // ---------------------------------------------------------------- lanes/notes
  function drawLanes(ctx, st) {
    const t = st.t;
    const L = st.levels;
    const top = 196;
    for (let i = 0; i < 4; i++) {
      const x = LANE_X[i];
      const col = P.lane[i];
      const flash = st.laneFlash ? st.laneFlash[i] : 0;
      // channel
      const grad = ctx.createLinearGradient(0, top, 0, HIT_Y + 18);
      grad.addColorStop(0, 'rgba(0,0,0,0)');
      grad.addColorStop(1, col);
      ctx.globalAlpha = 0.06 + flash * 0.16 + L.bass * 0.03;
      ctx.fillStyle = grad;
      ctx.fillRect(x - LANE_W / 2, top, LANE_W, HIT_Y + 18 - top);
      ctx.globalAlpha = 1;
      // lane rails
      rect(ctx, x - LANE_W / 2, top, 1, HIT_Y + 18 - top, col, 0.08);
      rect(ctx, x + LANE_W / 2 - 1, top, 1, HIT_Y + 18 - top, col, 0.08);
      // hit rune
      const hit = flash;
      const r = 7 + hit * 3;
      ring(ctx, x, HIT_Y + 12, r, col, 0.2 + hit * 0.5);
      circle(ctx, x, HIT_Y + 12, 2 + hit * 2, col, 0.5 + hit * 0.4);
      // glyph above hit line
      drawGlyph(ctx, x, HIT_Y + 12, i, col, 0.4 + hit * 0.5);
    }
    // hit line
    const x0 = LANE_X[0] - LANE_W / 2 - 8;
    const x1 = LANE_X[3] + LANE_W / 2 + 8;
    rect(ctx, x0, HIT_Y, x1 - x0, 1, P.white, 0.18 + L.high * 0.12);
    rect(ctx, x0, HIT_Y + 1, x1 - x0, 1, P.black, 0.4);
    // little ogham marks along the line
    for (let x = x0; x < x1; x += 11) {
      px(ctx, x, HIT_Y - 1, P.white, 0.12);
    }
  }

  function drawGlyph(ctx, x, y, lane, col, a) {
    // four tiny ogham-ish marks: one to four strokes
    const n = lane + 1;
    for (let i = 0; i < n; i++) {
      const oy = -((n - 1) * 1) + i * 2;
      rect(ctx, x - 4, y + oy, 8, 1, col, a);
    }
    if (lane === 3) {
      rect(ctx, x, y - 1, 1, 9, col, a);
    }
  }

  function drawNotes(ctx, st) {
    const t = st.t;
    const speed = st.speed || SPEED;
    for (const n of st.notes) {
      if (n.judged && !n.hit) continue;
      const y = HIT_Y - (n.t - t) * speed;
      if (y < -18 || y > HIT_Y + 22) continue;
      const x = LANE_X[n.l];
      const col = P.lane[n.l];
      const appear = clamp((y + 18) / 40, 0, 1);
      const strength = 0.55 + (n.s || 50) / 140;
      // trail
      if (y < HIT_Y) {
        rect(ctx, x - 1, y - 12, 2, 12, col, 0.08 * appear);
      }
      // glow
      circle(ctx, x, y, 8, col, 0.05 * appear * strength);
      // rune body
      ctx.globalAlpha = appear;
      rect(ctx, x - 5, y - 3, 10, 6, P.black, 0.55);
      rect(ctx, x - 4, y - 4, 8, 8, col, 0.9);
      rect(ctx, x - 3, y - 3, 6, 6, P.ink, 0.55);
      drawGlyph(ctx, x, y, n.l, P.white, 0.85);
      rect(ctx, x - 6, y - 1, 1, 2, col, 0.8);
      rect(ctx, x + 5, y - 1, 1, 2, col, 0.8);
      ctx.globalAlpha = 1;
    }
  }

  function drawEcho(ctx, st) {
    if (!st.echo) return;
    const pulse = 0.5 + 0.5 * Math.sin(st.t * 3);
    const x = 240, y = 116 + Math.sin(st.t * 1.4) * 4;
    circle(ctx, x, y, 22 + pulse * 4, P.gold2, 0.04);
    circle(ctx, x, y, 14, P.gold, 0.12 + pulse * 0.08);
    // eye shape
    ctx.globalAlpha = 0.9;
    ctx.fillStyle = P.bone;
    ctx.beginPath();
    ctx.ellipse(x, y, 15, 8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    circle(ctx, x, y, 5, P.ink, 1);
    circle(ctx, x, y, 3, P.gold2, 0.9);
    px(ctx, x + 1, y - 1, P.white, 0.9);
    // rays
    for (let i = 0; i < 8; i++) {
      const a = st.t * 0.7 + i * Math.PI / 4;
      px(ctx, x + Math.cos(a) * 20, y + Math.sin(a) * 12, P.gold2, 0.25 + pulse * 0.25);
    }
  }

  function drawParticles(ctx, st) {
    const parts = st.particles || [];
    const rings = st.rings || [];
    for (const p of parts) {
      const a = clamp(p.life / p.max, 0, 1);
      px(ctx, p.x, p.y, p.c, a * 0.9);
      if (p.s > 1) {
        px(ctx, p.x + 1, p.y, p.c, a * 0.4);
        px(ctx, p.x, p.y + 1, p.c, a * 0.4);
      }
    }
    for (const r of rings) {
      const a = clamp(r.life / r.max, 0, 1);
      ring(ctx, r.x, r.y, r.r, r.c, a * 0.55);
      if (r.r > 10) ring(ctx, r.x, r.y, r.r - 3, r.c, a * 0.2);
    }
  }

  function drawVignette(ctx) {
    const grad = ctx.createRadialGradient(W / 2, H / 2, H * 0.34, W / 2, H / 2, H * 0.82);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(0.75, 'rgba(0,0,0,0.18)');
    grad.addColorStop(1, 'rgba(0,0,0,0.55)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);
  }

  // ---------------------------------------------------------------- main draw
  function draw(ctx, st) {
    const L = st.levels || { bass: 0, mid: 0, high: 0 };
    const t = st.t || 0;
    const pal = scene;

    ctx.save();
    if (st.shake) {
      const sx = Math.round(Math.sin(t * 81) * st.shake);
      const sy = Math.round(Math.cos(t * 67) * st.shake * 0.7);
      ctx.translate(sx, sy);
    }

    // sky
    if (skyCanvas) ctx.drawImage(skyCanvas, 0, 0);
    else { ctx.fillStyle = pal.sky[0]; ctx.fillRect(0, 0, W, H); }
    drawStars(ctx, t, L, sceneSlug === 'shiny-sand' ? 0.12 : 0.85);

    // scene-specific layers
    switch (sceneSlug) {
      case 'barchans': drawDunes(ctx, t, L, pal); break;
      case 'shiny-sand': drawShinySand(ctx, t, L, pal); break;
      case 'adaptation': drawAdaptation(ctx, t, L, pal); break;
      case 'noah': drawNoah(ctx, t, L, pal); break;
      case 'time-shifting': drawTimeShifting(ctx, t, L, pal); break;
      case 'aleppo': drawAleppo(ctx, t, L, pal); break;
      case 'shhhhhh': drawShhhhhh(ctx, t, L, pal); break;
      case 'atomic': drawAtomic(ctx, t, L, pal); break;
      case 'neverborne': drawNeverborne(ctx, t, L, pal); break;
      default: drawMenuGrove(ctx, t, L, pal); break;
    }

    // ambient dust
    if (sceneSlug !== 'shhhhhh') drawMotes(ctx, t, L);

    // druid + echo + lanes + notes
    if (st.showDruid !== false) drawDruid(ctx, st);
    if (st.echo) drawEcho(ctx, st);
    if (st.particles || st.rings) drawParticles(ctx, st);
    if (st.showLanes !== false) drawLanes(ctx, st);
    if (st.showNotes !== false && st.notes) drawNotes(ctx, st);

    // atmosphere overlays
    if (sceneSlug === 'shiny-sand') {
      rect(ctx, 0, 0, W, H, P.white, 0.03 + L.high * 0.04);
    }
    if (sceneSlug === 'atomic') {
      rect(ctx, 0, 0, W, H, P.acid, 0.018 + L.bass * 0.02);
    }
    if (st.flash > 0.01) {
      rect(ctx, 0, 0, W, H, st.flashColor || P.white, st.flash * 0.12);
    }
    drawVignette(ctx);
    ctx.restore();
  }

  function drawMenuGrove(ctx, t, L, pal) {
    // a still sacred grove for the title backdrop
    ridge(ctx, 168, 8, 0.014, 4, 0.04, 0.8, pal.far, 0.9);
    // great tree
    const cx = 240, base = 246;
    line(ctx, cx, base, cx - 4, 150, '#2a1a12', 1, 9);
    line(ctx, cx - 2, 190, cx - 46, 142, '#2a1a12', 0.9, 3);
    line(ctx, cx + 1, 190, cx + 50, 136, '#2a1a12', 0.9, 3);
    line(ctx, cx - 4, 168, cx - 76, 122, '#2a1a12', 0.8, 2);
    line(ctx, cx + 2, 170, cx + 82, 118, '#2a1a12', 0.8, 2);
    for (let i = 0; i < 18; i++) {
      const a = i * 2.1;
      const x = cx + Math.cos(a) * (30 + (i % 5) * 21);
      const y = 120 + Math.sin(a * 1.3) * (18 + (i % 4) * 9);
      circle(ctx, x, y, 8 + (i % 4) * 4, P.moss2, 0.16);
      circle(ctx, x - 2, y - 2, 5 + (i % 3) * 3, P.moss, 0.12);
    }
    // stones
    for (let i = 0; i < 6; i++) {
      const x = 52 + i * 74;
      const h = 16 + (i % 3) * 9;
      rect(ctx, x - 5, base - h, 11, h, '#202a22', 0.9);
      rect(ctx, x - 5, base - h, 11, 2, '#35453a', 0.5);
    }
    // fireflies
    drawFireflies(ctx, t, L, pal);
    // ground
    rect(ctx, 0, 246, W, H - 246, pal.ground[0]);
  }

  window.TRO_ART = {
    W, H, HIT_Y, LANE_X, LANE_W, TRAVEL, SPEED, P,
    buildScene,
    draw,
    drawDruid,
    // small helpers exposed for the engine / debug
    clamp, lerp, hash, mulberry32, circle, rect
  };
})();
