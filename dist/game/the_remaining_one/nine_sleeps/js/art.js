/* КЕРН · ДЕВЯТЬ СНОВ — procedural pixel art.
   Everything is drawn at 480x270 and scaled by CSS with nearest-neighbour.
   No external sprites: the nine dreams are generated from a small palette,
   seeded particles and the supplied character silhouette. */
(function () {
  'use strict';

  const TRO = window.TRO || { RUNES: {} };
  const W = 480;
  const H = 270;
  const GROUND = 218;

  let canvas = null;
  let ctx = null;
  let time = 0;
  let scene = 'dunes';
  let particles = [];
  let energy = 0;
  let spectrum = null;
  let stars = [];
  let lastSpawn = 0;
  let lightning = 0;
  let lightningTimer = 4;

  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const lerp = (a, b, t) => a + (b - a) * t;

  function seeded(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function makeStars(seed, count) {
    const r = seeded(seed);
    const out = [];
    for (let i = 0; i < count; i++) {
      out.push({
        x: Math.floor(r() * W),
        y: Math.floor(r() * (GROUND - 52)),
        s: r() > 0.86 ? 2 : 1,
        p: r() * Math.PI * 2,
        a: 0.25 + r() * 0.65
      });
    }
    return out;
  }

  function init(cv) {
    canvas = cv;
    ctx = cv.getContext('2d', { alpha: false });
    ctx.imageSmoothingEnabled = false;
    stars = makeStars(7, 86);
    resetParticles();
  }

  function setScene(name) {
    if (!name) return;
    scene = name;
    particles = [];
    time = 0;
    lightning = 0;
    lightningTimer = 4;
    const seeds = {
      dunes: 11, glass: 23, forest: 31, ark: 43, time: 59,
      library: 67, silence: 73, crater: 83, threshold: 97
    };
    stars = makeStars(seeds[name] || 7, name === 'glass' ? 18 : 86);
    resetParticles();
  }

  function resetParticles() {
    particles = [];
    const r = seeded(121);
    for (let i = 0; i < 60; i++) {
      particles.push(spawnParticle(r, true));
    }
  }

  function spawnParticle(rand, initial) {
    const r = rand || Math.random;
    const type = scene;
    const p = {
      x: r() * W,
      y: initial ? r() * H : -6,
      vx: 0, vy: 0, life: 1, max: 1,
      size: 1, color: '#ffb347', kind: 'dot', sway: r() * 6.28
    };
    if (type === 'dunes') {
      p.y = initial ? r() * H : GROUND - 30;
      p.x = initial ? r() * W : -10;
      p.vx = 8 + r() * 20;
      p.vy = -1 - r() * 4;
      p.size = r() > 0.8 ? 2 : 1;
      p.color = r() > 0.5 ? '#ffcf8a' : '#d9a06a';
    } else if (type === 'glass') {
      p.y = initial ? r() * H : r() * H;
      p.x = initial ? r() * W : -8;
      p.vx = 2 + r() * 8;
      p.vy = (r() - 0.5) * 3;
      p.size = r() > 0.75 ? 2 : 1;
      p.color = r() > 0.5 ? '#fff4c8' : '#ffd27a';
      p.kind = 'glint';
    } else if (type === 'forest') {
      p.y = 80 + r() * 130;
      p.x = initial ? r() * W : r() * W;
      p.vx = (r() - 0.5) * 6;
      p.vy = (r() - 0.5) * 4;
      p.size = r() > 0.7 ? 2 : 1;
      p.color = r() > 0.45 ? '#d8e88a' : '#9fc07a';
      p.kind = 'firefly';
      p.max = 2 + r() * 4;
      p.life = initial ? r() * p.max : p.max;
    } else if (type === 'ark') {
      p.x = initial ? r() * W : r() * (W + 80) - 20;
      p.y = initial ? r() * H : -10;
      p.vx = 30 + r() * 36;
      p.vy = 110 + r() * 120;
      p.size = 1;
      p.color = r() > 0.65 ? '#8fb2ba' : '#5f8189';
      p.kind = 'rain';
      p.max = 2.4;
      p.life = p.max;
    } else if (type === 'time') {
      p.y = initial ? r() * GROUND : GROUND + 8;
      p.x = initial ? r() * W : 60 + r() * 360;
      p.vx = (r() - 0.5) * 5;
      p.vy = -5 - r() * 12;
      p.size = r() > 0.82 ? 2 : 1;
      p.color = r() > 0.5 ? '#c58be8' : '#8a6a9a';
      p.max = 3 + r() * 4;
      p.life = initial ? r() * p.max : p.max;
    } else if (type === 'library') {
      p.y = initial ? r() * GROUND : GROUND + 8;
      p.x = initial ? r() * W : r() * W;
      p.vx = (r() - 0.5) * 8;
      p.vy = -10 - r() * 24;
      p.size = r() > 0.88 ? 2 : 1;
      p.color = r() > 0.7 ? '#ffd27a' : (r() > 0.4 ? '#ff8a3d' : '#d4553a');
      if (r() > 0.9) { p.kind = 'page'; p.size = 3; p.color = '#e8dcc8'; p.max = 5; p.life = p.max; }
      else { p.max = 2 + r() * 4; p.life = initial ? r() * p.max : p.max; }
    } else if (type === 'silence') {
      p.y = initial ? r() * H : -4;
      p.x = initial ? r() * W : r() * W;
      p.vx = (r() - 0.5) * 3;
      p.vy = 2 + r() * 5;
      p.size = 1;
      p.color = r() > 0.5 ? '#5a5360' : '#8a8490';
      p.max = 4 + r() * 5;
      p.life = initial ? r() * p.max : p.max;
    } else if (type === 'crater') {
      p.y = initial ? r() * GROUND : GROUND + 6;
      p.x = initial ? r() * W : 140 + r() * 200;
      p.vx = (r() - 0.5) * 7;
      p.vy = -12 - r() * 20;
      p.size = r() > 0.82 ? 2 : 1;
      p.color = r() > 0.55 ? '#d7f06a' : '#8ea84a';
      p.max = 3 + r() * 4;
      p.life = initial ? r() * p.max : p.max;
    } else {
      p.y = initial ? r() * H : -6;
      p.x = initial ? r() * W : r() * W;
      p.vx = (r() - 0.5) * 4;
      p.vy = 3 + r() * 7;
      p.size = r() > 0.85 ? 2 : 1;
      p.color = r() > 0.6 ? '#f0d878' : (r() > 0.4 ? '#ffb347' : '#8a8490');
      p.max = 4 + r() * 6;
      p.life = initial ? r() * p.max : p.max;
    }
    return p;
  }

  function spawnRate() {
    if (scene === 'ark') return 44;
    if (scene === 'library') return 24;
    if (scene === 'dunes') return 16;
    if (scene === 'crater') return 15;
    if (scene === 'forest') return 8;
    if (scene === 'time') return 10;
    if (scene === 'threshold') return 15;
    if (scene === 'silence') return 5;
    return 6;
  }

  function updateParticles(dt, reduce) {
    const motion = reduce ? 0.35 : 1;
    if (particles.length < 90) {
      let n = Math.min(3, spawnRate() * dt * 2);
      while (n > 0) {
        if (Math.random() < n) particles.push(spawnParticle());
        n -= 1;
      }
    }
    const max = scene === 'ark' ? 150 : 110;
    if (particles.length > max) particles.splice(0, particles.length - max);
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        if (particles.length > 45 || scene === 'ark' || scene === 'library') {
          particles[i] = spawnParticle();
          continue;
        }
        particles.splice(i, 1);
        continue;
      }
      if (p.kind === 'firefly') {
        p.sway += dt * 2;
        p.x += (p.vx + Math.sin(p.sway) * 3) * dt * motion;
        p.y += (p.vy + Math.cos(p.sway * 0.7) * 2) * dt * motion;
        if (p.x < 10 || p.x > W - 10) p.vx *= -1;
        if (p.y < 70 || p.y > GROUND - 20) p.vy *= -1;
      } else {
        p.x += p.vx * dt * motion;
        p.y += p.vy * dt * motion;
      }
      if (p.x < -12 || p.x > W + 12 || p.y < -12 || p.y > H + 12) {
        if (particles.length > 45) particles[i] = spawnParticle();
        else particles.splice(i, 1);
      }
    }
  }

  // ───────────────────────────────────────────────────────────── primitives
  function rect(x, y, w, h, c) {
    ctx.fillStyle = c;
    ctx.fillRect(Math.round(x), Math.round(y), Math.max(1, Math.round(w)), Math.max(1, Math.round(h)));
  }

  function px(x, y, c) { rect(x, y, 1, 1, c); }

  function line(x1, y1, x2, y2, c, w) {
    ctx.strokeStyle = c;
    ctx.lineWidth = w || 1;
    ctx.beginPath();
    ctx.moveTo(Math.round(x1) + 0.5, Math.round(y1) + 0.5);
    ctx.lineTo(Math.round(x2) + 0.5, Math.round(y2) + 0.5);
    ctx.stroke();
  }

  function circle(x, y, r, c) {
    ctx.fillStyle = c;
    ctx.beginPath();
    ctx.arc(Math.round(x), Math.round(y), r, 0, Math.PI * 2);
    ctx.fill();
  }

  function poly(points, c) {
    ctx.fillStyle = c;
    ctx.beginPath();
    ctx.moveTo(points[0][0], points[0][1]);
    for (let i = 1; i < points.length; i++) ctx.lineTo(points[i][0], points[i][1]);
    ctx.closePath();
    ctx.fill();
  }

  function ditherRect(x, y, w, h, c, alpha, step, seed) {
    const r = seeded(seed || 1);
    ctx.fillStyle = c;
    ctx.globalAlpha = alpha;
    step = step || 2;
    for (let yy = Math.floor(y); yy < y + h; yy += step) {
      for (let xx = Math.floor(x) + ((yy / step) % 2 ? step / 2 : 0); xx < x + w; xx += step) {
        if (r() > 0.42) ctx.fillRect(xx, yy, 1, 1);
      }
    }
    ctx.globalAlpha = 1;
  }

  function sky(top, mid, bottom, horizon) {
    const bands = 16;
    for (let i = 0; i < bands; i++) {
      const t = i / (bands - 1);
      let c;
      if (t < 0.55) c = mix(top, mid, t / 0.55);
      else c = mix(mid, bottom, (t - 0.55) / 0.45);
      rect(0, (H * i) / bands, W, H / bands + 1, c);
    }
    if (horizon) {
      ditherRect(0, 120, W, 90, horizon, 0.12, 2, 5);
    }
  }

  function mix(a, b, t) {
    const pa = hex(a), pb = hex(b);
    const r = Math.round(lerp(pa[0], pb[0], t));
    const g = Math.round(lerp(pa[1], pb[1], t));
    const bl = Math.round(lerp(pa[2], pb[2], t));
    return '#' + ((1 << 24) + (r << 16) + (g << 8) + bl).toString(16).slice(1);
  }

  function hex(c) {
    c = c.replace('#', '');
    if (c.length === 3) c = c[0] + c[0] + c[1] + c[1] + c[2] + c[2];
    return [parseInt(c.slice(0, 2), 16), parseInt(c.slice(2, 4), 16), parseInt(c.slice(4, 6), 16)];
  }

  function glow(x, y, r, c, alpha) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, c);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalAlpha = alpha == null ? 0.6 : alpha;
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  function drawStars(t) {
    for (const s of stars) {
      const a = s.a * (0.55 + 0.45 * Math.sin(t + s.p));
      ctx.globalAlpha = a;
      rect(s.x, s.y, s.s, s.s, '#e8dcc8');
    }
    ctx.globalAlpha = 1;
  }

  function silhouette() {
    const base = GROUND;
    poly([
      [0, base], [0, base - 14], [20, base - 20], [48, base - 15], [70, base - 26],
      [104, base - 18], [134, base - 24], [160, base - 16], [190, base - 22],
      [222, base - 14], [252, base - 20], [284, base - 13], [312, base - 18],
      [344, base - 12], [376, base - 21], [410, base - 14], [446, base - 18],
      [480, base - 12], [480, base]
    ], '#070504');
  }

  function ground(y, top, bottom, accent) {
    rect(0, y, W, H - y, top);
    ditherRect(0, y, W, H - y, bottom, 0.35, 3, 17);
    if (accent) {
      ditherRect(0, y + 2, W, 7, accent, 0.28, 2, 23);
      line(0, y, W, y, accent, 1);
    }
  }

  function ridge(y, points, color) {
    const p = [[0, y]];
    for (const pt of points) p.push(pt);
    p.push([W, y], [W, H], [0, H]);
    poly(p, color);
  }

  // ───────────────────────────────────────────────────────────── runes
  const RUNE_CACHE = {};

  function runeSVG(id, opts) {
    const r = TRO.RUNES && TRO.RUNES[id];
    if (!r) return '';
    const o = opts || {};
    const color = o.color || r.color || '#f0d878';
    const key = id + '|' + color;
    if (RUNE_CACHE[key]) return RUNE_CACHE[key];
    const st = r.strokes || { side: 'right', count: 1 };
    const cx = 15;
    let marks = '';
    const n = st.count || 1;
    const top = 9;
    const gap = n > 1 ? 26 / (n - 1) : 0;
    for (let i = 0; i < n; i++) {
      const y = top + gap * i;
      if (st.side === 'right') marks += `<path d="M${cx} ${y} H24" />`;
      else if (st.side === 'left') marks += `<path d="M${cx} ${y} H6" />`;
      else if (st.side === 'slant') marks += `<path d="M8 ${y + 3} L22 ${y - 2}" />`;
      else marks += `<path d="M6 ${y + (i % 2 ? 2 : 0)} L24 ${y - (i % 2 ? 2 : 0)}" />`;
    }
    const svg = '<svg viewBox="0 0 30 44" role="img" aria-label="' + r.name + '" xmlns="http://www.w3.org/2000/svg">' +
      `<path d="M${cx} 4 V40" stroke="#080605" stroke-width="7" stroke-linecap="square" opacity=".75" />` +
      `<path d="M${cx} 4 V40" stroke="${color}" stroke-width="2" stroke-linecap="square" />` +
      `<g fill="none" stroke="#080605" stroke-width="6" stroke-linecap="square" opacity=".75">${marks}</g>` +
      `<g fill="none" stroke="${color}" stroke-width="2.2" stroke-linecap="square">${marks}</g>` +
      '</svg>';
    RUNE_CACHE[key] = svg;
    return svg;
  }

  function drawRune(x, y, h, id, color, alpha) {
    const r = TRO.RUNES && TRO.RUNES[id];
    if (!r) return;
    const st = r.strokes || { side: 'right', count: 1 };
    const cx = Math.round(x);
    const top = Math.round(y - h / 2);
    const bot = Math.round(y + h / 2);
    const n = st.count || 1;
    const gap = n > 1 ? (h - 10) / (n - 1) : 0;
    ctx.globalAlpha = alpha == null ? 1 : alpha;
    ctx.strokeStyle = color || r.color || '#f0d878';
    ctx.lineWidth = 2;
    ctx.shadowColor = 'rgba(0,0,0,.8)';
    ctx.shadowBlur = 0;
    line(cx, top, cx, bot, color || r.color, 2);
    for (let i = 0; i < n; i++) {
      const yy = top + 5 + gap * i;
      if (st.side === 'right') line(cx, yy, cx + 8, yy, color || r.color, 2);
      else if (st.side === 'left') line(cx, yy, cx - 8, yy, color || r.color, 2);
      else if (st.side === 'slant') line(cx - 7, yy + 3, cx + 7, yy - 2, color || r.color, 2);
      else line(cx - 8, yy + (i % 2 ? 2 : 0), cx + 8, yy - (i % 2 ? 2 : 0), color || r.color, 2);
    }
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
  }

  // ───────────────────────────────────────────────────────────── scenes
  const SCENE_META = {
    dunes: { sky: ['#1a0807', '#5c1b10', '#c64214'], moon: '#ffd27a', ground: '#241009' },
    glass: { sky: ['#2a1408', '#8c4d18', '#f4bb61'], moon: '#fff4c8', ground: '#6b4520' },
    forest: { sky: ['#050b0a', '#122019', '#2f4027'], moon: '#d8e8b0', ground: '#111a10' },
    ark: { sky: ['#050a0e', '#152730', '#3f5a62'], moon: '#c8e0e4', ground: '#1b262a' },
    time: { sky: ['#080510', '#21102e', '#4b2858'], moon: '#d8b0f0', ground: '#160c1d' },
    library: { sky: ['#0c0504', '#351008', '#7d2b0d'], moon: '#ffd27a', ground: '#170b07' },
    silence: { sky: ['#040304', '#0a080a', '#141016'], moon: '#6b6570', ground: '#090709' },
    crater: { sky: ['#080b05', '#1d270e', '#52601a'], moon: '#d7f06a', ground: '#121608' },
    threshold: { sky: ['#06050a', '#1a1328', '#6b3a3a'], moon: '#f0d878', ground: '#0b0810' }
  };

  function drawSkyFor(name) {
    const m = SCENE_META[name] || SCENE_META.dunes;
    sky(m.sky[0], m.sky[1], m.sky[2], m.moon);
  }

  function drawDunes(s) {
    drawSkyFor('dunes');
    drawStars(time * 0.8);
    // low sun
    glow(356, 152, 74, 'rgba(255,138,61,.28)', 0.9);
    circle(356, 152, 25, '#ffb347');
    circle(356, 152, 20, '#ffd27a');
    circle(356, 152, 13, '#fff0bf');

    // far sea shimmer
    ditherRect(0, 168, W, 10, '#ffb347', 0.2, 2, 3);

    // dune bands
    ridge(192, [[34, 178], [86, 186], [128, 176], [180, 188], [228, 180]], '#5b1b10');
    ridge(204, [[0, 190], [54, 198], [112, 188], [164, 201], [220, 190], [280, 199], [336, 189], [400, 200], [450, 190], [480, 196]], '#37120c');
    ground(218, '#28110b', '#160a07', '#c64214');
    ditherRect(0, 215, W, 8, '#8f2c14', 0.18, 3, 9);

    // salt pillar at 88
    poly([[78, 214], [82, 176], [79, 150], [88, 140], [96, 154], [94, 184], [100, 214]], '#d8cbb8');
    poly([[78, 214], [82, 176], [79, 150], [88, 140], [90, 155], [86, 186], [91, 214]], '#a99d8b');
    ditherRect(80, 150, 15, 60, '#fffaf0', 0.22, 2, 4);
    line(88, 162, 95, 162, '#7a6f60', 1);
    line(86, 190, 97, 190, '#7a6f60', 1);

    // whale rib at 238
    for (let i = 0; i < 5; i++) {
      const ox = i * 7;
      ctx.strokeStyle = i % 2 ? '#bfae98' : '#e8dcc8';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(230 + ox, 214);
      ctx.quadraticCurveTo(224 + ox, 172, 242 + ox, 150);
      ctx.stroke();
    }
    line(228, 210, 268, 208, '#a99d8b', 2);
    // red berries
    for (const p of [[233, 190], [238, 193], [244, 188], [250, 192], [256, 189]]) {
      px(p[0], p[1], '#d4553a'); px(p[0] + 1, p[1], '#ff8a3d');
    }

    // footprint at 392
    ctx.globalAlpha = 0.5;
    poly([[386, 211], [390, 205], [397, 204], [401, 210], [399, 216], [391, 216]], '#0d0605');
    ctx.globalAlpha = 1;
    for (let i = 0; i < 6; i++) px(380 + i * 4, 205 + (i % 3), '#3a1a10');

    // sparse dune grass
    for (let i = 0; i < 30; i++) {
      const x = (i * 83 + 17) % W;
      const y = 219 + (i * 37) % 45;
      line(x, y, x + (i % 3) - 1, y - 3 - (i % 4), '#5a3a20', 1);
    }

    if (s.nearAnchor === 'salt') glow(88, 170, 24, 'rgba(255,179,71,.22)', 0.8);
    if (s.nearAnchor === 'rib') glow(244, 182, 24, 'rgba(255,179,71,.2)', 0.8);
    if (s.nearAnchor === 'footprint') glow(392, 196, 22, 'rgba(255,179,71,.2)', 0.8);
  }

  function drawGlass(s) {
    drawSkyFor('glass');
    // white hot sun
    glow(118, 58, 80, 'rgba(255,244,200,.34)', 0.75);
    circle(118, 58, 16, '#fff4c8');
    circle(118, 58, 9, '#ffffff');

    // heat haze bands
    for (let i = 0; i < 7; i++) {
      const y = 100 + i * 15;
      ditherRect(0, y, W, 4, '#fff4c8', 0.09 + (i % 2) * 0.03, 2, 11 + i);
    }

    // glass field
    ground(214, '#b98a45', '#6b4520', '#ffd27a');
    for (let i = 0; i < 30; i++) {
      const x = (i * 67 + 13) % W;
      const y = 216 + (i * 29) % 50;
      poly([[x, y + 8], [x + 6, y - 3 - (i % 5)], [x + 12, y + 8]], i % 3 ? 'rgba(255,244,200,.32)' : 'rgba(120,167,173,.22)');
    }

    // shard / willow leaf at 88
    poly([[81, 214], [86, 168], [92, 158], [99, 170], [96, 214]], 'rgba(220,245,235,.62)');
    poly([[84, 210], [87, 172], [91, 164], [94, 174], [91, 210]], 'rgba(158,216,196,.25)');
    line(89, 208, 91, 166, '#6fa88e', 1);
    line(90, 196, 94, 191, '#9ed8c4', 1);
    line(90, 186, 95, 181, '#9ed8c4', 1);
    px(90, 178, '#fafbf3'); px(91, 178, '#fafbf3');

    // sprout under glass at 238
    rect(224, 198, 32, 16, 'rgba(200,235,225,.34)');
    line(238, 208, 238, 188, '#9fc07a', 2);
    line(238, 196, 230, 188, '#9fc07a', 2);
    line(238, 192, 247, 184, '#9fc07a', 2);
    px(230, 186, '#d8e88a'); px(246, 182, '#d8e88a'); px(237, 185, '#d8e88a');
    poly([[224, 214], [230, 196], [244, 194], [252, 214]], 'rgba(255,244,200,.16)');

    // mirror at 392
    poly([[373, 214], [378, 152], [391, 128], [408, 158], [406, 214]], 'rgba(230,248,245,.68)');
    poly([[380, 210], [383, 158], [392, 138], [402, 162], [399, 210]], 'rgba(120,167,173,.32)');
    line(392, 142, 392, 206, 'rgba(255,255,255,.5)', 1);
    // horned reflection
    ctx.globalAlpha = 0.45;
    rect(388, 176, 7, 16, '#1a1210');
    rect(389, 169, 5, 6, '#cfc4b1');
    line(387, 168, 384, 157, '#cfc4b1', 1);
    line(395, 168, 399, 157, '#cfc4b1', 1);
    ctx.globalAlpha = 1;

    // glare slashes
    for (let i = 0; i < 7; i++) {
      const x = 20 + i * 71;
      line(x, 30 + (i % 3) * 13, x + 22, 12 + (i % 3) * 13, 'rgba(255,250,230,.24)', 1);
    }

    if (s.nearAnchor === 'shard') glow(88, 184, 24, 'rgba(158,216,196,.24)', 0.8);
    if (s.nearAnchor === 'sprout') glow(238, 196, 24, 'rgba(216,232,138,.2)', 0.8);
    if (s.nearAnchor === 'reflection') glow(392, 180, 24, 'rgba(255,244,200,.2)', 0.8);
  }

  function drawForest(s) {
    drawSkyFor('forest');
    drawStars(time * 0.5);
    // moon
    glow(402, 48, 48, 'rgba(216,232,176,.16)', 0.7);
    circle(402, 48, 13, '#d8e8b0');
    circle(406, 45, 11, '#162018');

    // light shafts
    for (let i = 0; i < 4; i++) {
      ctx.globalAlpha = 0.07;
      poly([[50 + i * 44, 0], [92 + i * 44, 0], [160 + i * 36, GROUND], [110 + i * 36, GROUND]], '#d8e8b0');
      ctx.globalAlpha = 1;
    }

    // distant trunks
    for (let i = 0; i < 14; i++) {
      const x = 8 + i * 36 + (i % 3) * 7;
      rect(x, 92, 6 + (i % 3), GROUND - 92, i % 2 ? '#101a12' : '#162116');
      line(x + 3, 92, x + 3 - 14, 70 + (i % 4) * 6, '#101a12', 2);
      line(x + 4, 100, x + 4 + 16, 80 + (i % 4) * 5, '#101a12', 2);
    }

    // ruined wall at 238
    poly([[196, GROUND], [196, 128], [218, 120], [223, 138], [240, 132], [248, 148], [270, 140], [276, GROUND]], '#3a352b');
    ditherRect(198, 130, 76, 84, '#5a5242', 0.25, 3, 8);
    // windows
    rect(208, 148, 12, 20, '#080c0a'); rect(252, 154, 12, 18, '#080c0a');
    // moss and names
    ditherRect(198, 132, 76, 28, '#5f7a3a', 0.32, 2, 12);
    line(230, 150, 230, 184, '#7a8a56', 2);
    for (let i = 0; i < 8; i++) px(228 + (i % 3) * 3, 154 + i * 4, '#8a9a66');

    // root at 88
    ctx.strokeStyle = '#5a3a20';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(66, GROUND);
    ctx.quadraticCurveTo(78, 206, 88, 192);
    ctx.quadraticCurveTo(98, 180, 92, 162);
    ctx.stroke();
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(86, 194);
    ctx.quadraticCurveTo(106, 188, 112, 176);
    ctx.stroke();
    ditherRect(74, 186, 30, 18, '#9fc07a', 0.2, 2, 3);

    // canopy blobs
    for (let i = 0; i < 26; i++) {
      const r = seeded(90 + i);
      const x = r() * W;
      const y = 16 + r() * 74;
      const rad = 14 + r() * 22;
      ctx.globalAlpha = 0.5;
      circle(x, y, rad, i % 3 ? '#0e1a11' : '#142216');
      ctx.globalAlpha = 1;
    }

    // eyes at 392
    for (let i = 0; i < 7; i++) {
      const ex = 378 + (i % 3) * 11 + (i > 2 ? 3 : 0);
      const ey = 172 + Math.floor(i / 3) * 10;
      const blink = Math.sin(time * 1.3 + i) > -0.9;
      if (blink) {
        rect(ex, ey, 3, 2, '#d8e88a');
        px(ex + 1, ey, '#080605');
      }
    }

    ground(218, '#151f13', '#0a1009', '#3e5a2a');
    for (let i = 0; i < 38; i++) {
      const x = (i * 71 + 9) % W;
      line(x, 222 + (i * 17) % 44, x - 2, 216 + (i * 17) % 40, i % 2 ? '#4d6a30' : '#2c421f', 1);
    }

    if (s.nearAnchor === 'root') glow(88, 194, 24, 'rgba(159,192,122,.22)', 0.8);
    if (s.nearAnchor === 'name') glow(238, 170, 24, 'rgba(240,216,120,.16)', 0.8);
    if (s.nearAnchor === 'eyes') glow(392, 178, 24, 'rgba(216,232,138,.2)', 0.8);
  }

  function drawArk(s) {
    drawSkyFor('ark');
    // storm clouds
    for (let i = 0; i < 14; i++) {
      const x = (i * 57 + time * 2) % (W + 80) - 40;
      const y = 12 + (i % 4) * 15;
      ctx.globalAlpha = 0.5;
      circle(x, y, 24 + (i % 3) * 8, i % 2 ? '#1a2a30' : '#22363c');
      ctx.globalAlpha = 1;
    }
    // lightning
    if (lightning > 0) {
      ctx.globalAlpha = lightning;
      poly([[354, 0], [340, 58], [354, 54], [338, 108], [370, 44], [356, 48], [374, 0]], '#dff0f4');
      ctx.globalAlpha = 1;
    }

    // sea
    rect(0, 190, W, 80, '#14262b');
    for (let i = 0; i < 12; i++) {
      const y = 196 + i * 6;
      const off = Math.sin(time * 1.4 + i) * 8;
      line(0 + off, y, W, y, i % 2 ? '#28434a' : '#1d343a', 1);
    }

    // hull
    poly([[104, 205], [128, 124], [356, 118], [390, 202], [360, 218], [132, 218]], '#2a1b14');
    poly([[122, 198], [140, 132], [348, 126], [378, 198], [354, 210], [148, 210]], '#3d281c');
    // deck
    rect(142, 202, 232, 8, '#5a3a24');
    for (let x = 146; x < 372; x += 14) line(x, 202, x - 4, 210, '#332115', 1);
    // ribs
    for (let i = 0; i < 8; i++) {
      const x = 152 + i * 27;
      line(x, 128, x - 4, 200, '#241710', 2);
    }
    // cells / windows
    for (let i = 0; i < 5; i++) {
      rect(168 + i * 40, 142, 18, 24, '#121b1e');
      line(177 + i * 40, 142, 177 + i * 40, 166, '#3c4a4c', 1);
    }
    // list at 88
    poly([[76, 164], [100, 158], [104, 194], [80, 200]], '#d8cbb8');
    poly([[80, 166], [98, 162], [100, 190], [82, 194]], '#e8dcc8');
    for (let i = 0; i < 7; i++) line(84, 169 + i * 3, 96, 167 + i * 3, i % 3 ? '#6b5a48' : '#d4553a', 1);

    // egg at 238
    glow(238, 194, 30, 'rgba(255,179,71,.24)', 0.8);
    ctx.fillStyle = '#e8dcc8';
    ctx.beginPath();
    ctx.ellipse(238, 194, 10, 13, 0, 0, Math.PI * 2);
    ctx.fill();
    ditherRect(231, 186, 15, 14, '#bfae98', 0.25, 2, 4);
    line(236, 188, 238, 200, '#a49580', 1);

    // door at 392
    poly([[376, 208], [376, 158], [390, 142], [406, 158], [406, 208]], '#2b1c14');
    poly([[381, 205], [381, 160], [391, 149], [401, 160], [401, 205]], '#5a3a24');
    line(391, 150, 391, 205, '#241710', 1);
    px(396, 182, '#f0d878'); px(396, 183, '#f0d878');

    // rain in front of hull
    ctx.globalAlpha = 0.42;
    for (let i = 0; i < 40; i++) {
      const x = (i * 53 + time * 60) % (W + 40) - 20;
      const y = (i * 37 + time * 150) % (H + 30) - 15;
      line(x, y, x + 4, y + 10, '#9fc3ca', 1);
    }
    ctx.globalAlpha = 1;

    if (s.nearAnchor === 'list') glow(90, 180, 22, 'rgba(232,220,200,.16)', 0.8);
    if (s.nearAnchor === 'egg') glow(238, 192, 26, 'rgba(255,179,71,.2)', 0.8);
    if (s.nearAnchor === 'door') glow(392, 180, 26, 'rgba(240,216,120,.2)', 0.8);
  }

  function drawTime(s) {
    drawSkyFor('time');
    drawStars(time * 0.35);
    // rings
    for (let i = 0; i < 4; i++) {
      ctx.globalAlpha = 0.15;
      ctx.strokeStyle = '#c58be8';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.ellipse(240, 118, 90 + i * 26, 26 + i * 8, -0.22, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    // floating rocks
    const rocks = [
      [58, 84, 26, 10], [122, 120, 20, 8], [186, 68, 30, 12], [286, 92, 24, 9],
      [344, 58, 34, 13], [414, 118, 22, 8], [74, 164, 18, 7], [300, 158, 26, 8]
    ];
    for (let i = 0; i < rocks.length; i++) {
      const r = rocks[i];
      const bob = Math.sin(time * 0.5 + i) * 3;
      poly([[r[0] - r[2], r[1] + bob], [r[0] - r[2] * 0.5, r[1] - r[3] + bob], [r[0] + r[2] * 0.6, r[1] - r[3] + 2 + bob], [r[0] + r[2], r[1] + bob], [r[0] + r[2] * 0.4, r[1] + 6 + bob], [r[0] - r[2] * 0.6, r[1] + 5 + bob]], i % 2 ? '#24142e' : '#1b0f24');
      ditherRect(r[0] - r[2] * 0.6, r[1] - r[3] * 0.4 + bob, r[2] * 1.2, r[3] * 0.7, '#c58be8', 0.12, 2, 5 + i);
    }

    // crack at 88
    glow(88, 170, 30, 'rgba(197,139,232,.22)', 0.8);
    poly([[88, 126], [84, 156], [91, 178], [86, 206], [88, 218], [94, 202], [89, 180], [96, 158], [92, 128]], '#d8b0f0');
    poly([[88, 132], [87, 158], [92, 180], [89, 206], [91, 214], [93, 198], [91, 180], [94, 158], [92, 136]], '#4b2858');

    // doppelganger at 238
    ctx.globalAlpha = 0.55;
    drawKernShape(238, GROUND, 1, 0, '#2a1538', '#c58be8', true);
    ctx.globalAlpha = 1;

    // stone circle at 392
    for (let i = 0; i < 7; i++) {
      const a = -0.2 + i * 0.38;
      const x = 392 + Math.cos(a) * 34;
      const y = 202 + Math.sin(a) * 7;
      rect(x - 4, y - 14, 8, 16, i % 2 ? '#3a2a44' : '#2a1e32');
      line(x, y - 13, x, y - 3, '#c58be8', 1);
    }

    ground(218, '#1b0e23', '#0c0611', '#8a5aa0');
    // floating shards below
    for (let i = 0; i < 12; i++) {
      const x = (i * 61 + 20) % W;
      const y = 224 + (i * 23) % 40;
      line(x, y, x + 8, y - 4, i % 2 ? '#2a1538' : '#3a2248', 2);
    }

    if (s.nearAnchor === 'crack') glow(88, 174, 24, 'rgba(216,176,240,.24)', 0.8);
    if (s.nearAnchor === 'double') glow(238, 178, 26, 'rgba(197,139,232,.18)', 0.8);
    if (s.nearAnchor === 'circle') glow(392, 192, 26, 'rgba(197,139,232,.2)', 0.8);
  }

  function drawLibrary(s) {
    drawSkyFor('library');
    // smoke / fire glow at top
    glow(250, 30, 200, 'rgba(252,82,20,.18)', 0.9);
    for (let i = 0; i < 12; i++) {
      const x = (i * 47 + 12) % W;
      const y = 8 + (i * 19) % 60;
      ctx.globalAlpha = 0.22;
      circle(x, y, 18 + (i % 4) * 7, i % 2 ? '#5a1d0d' : '#7a2a0d');
      ctx.globalAlpha = 1;
    }

    // tall shelves
    for (let i = 0; i < 8; i++) {
      const x = 18 + i * 61;
      rect(x, 56, 32, 162, i % 2 ? '#24120b' : '#1b0d08');
      for (let r = 0; r < 7; r++) {
        const yy = 62 + r * 22;
        line(x, yy + 20, x + 32, yy + 20, '#3d1d10', 1);
        for (let b = 0; b < 5; b++) {
          const bh = 6 + ((i + r + b) % 5) * 2;
          rect(x + 3 + b * 6, yy + 20 - bh, 3, bh, ['#6d1d0d', '#7a4a1d', '#3d3a2a', '#5a1d0d'][(i + b + r) % 4]);
        }
      }
    }
    // charred columns
    for (let i = 0; i < 4; i++) {
      const x = 32 + i * 136;
      rect(x, 40, 12, 180, '#120907');
      for (let y = 44; y < 214; y += 12) line(x, y, x + 12, y + 4, '#2b130b', 1);
    }

    // floating pages
    for (let i = 0; i < 12; i++) {
      const x = (i * 59 + time * 9) % (W + 40) - 20;
      const y = 40 + (i * 31 + Math.sin(time + i) * 10) % 150;
      ctx.globalAlpha = 0.5;
      poly([[x, y], [x + 7, y - 4], [x + 9, y + 2], [x + 2, y + 5]], '#d8cbb8');
      ctx.globalAlpha = 1;
    }

    // page at 88
    glow(88, 178, 26, 'rgba(240,216,120,.2)', 0.8);
    poly([[76, 190], [80, 160], [98, 156], [102, 186], [94, 196]], '#f0e6d2');
    for (let i = 0; i < 6; i++) line(82, 165 + i * 4, 96, 164 + i * 4, '#8a7a66', 1);
    px(84, 162, '#f0d878'); px(85, 162, '#f0d878');

    // ash at 238
    glow(238, 188, 24, 'rgba(255,138,61,.16)', 0.8);
    for (let i = 0; i < 16; i++) {
      const x = 224 + (i * 13) % 30;
      const y = 204 - (i * 7) % 30;
      px(x, y, i % 2 ? '#bfae98' : '#6b5a48');
    }

    // empty shelf at 392
    rect(366, 158, 54, 52, '#1b0d08');
    line(366, 178, 420, 178, '#3d1d10', 1);
    line(366, 198, 420, 198, '#3d1d10', 1);
    poly([[382, 196], [384, 178], [398, 176], [402, 196]], '#d8cbb8');
    line(392, 178, 392, 195, '#8a7a66', 1);

    ground(218, '#1b0d08', '#0b0503', '#7a2a0d');
    ditherRect(0, 216, W, 12, '#d4553a', 0.14, 2, 14);

    if (s.nearAnchor === 'page') glow(88, 178, 24, 'rgba(240,216,120,.2)', 0.8);
    if (s.nearAnchor === 'ash') glow(238, 190, 24, 'rgba(255,138,61,.18)', 0.8);
    if (s.nearAnchor === 'shelf') glow(392, 182, 24, 'rgba(232,220,200,.14)', 0.8);
  }

  function drawSilence(s) {
    drawSkyFor('silence');
    // almost no stars
    for (let i = 0; i < 18; i++) {
      const st = stars[i];
      ctx.globalAlpha = 0.15;
      px(st.x, st.y, '#6b6570');
      ctx.globalAlpha = 1;
    }

    // giant closed eye
    glow(386, 106, 92, 'rgba(90,83,96,.12)', 0.6);
    ctx.fillStyle = '#1c181e';
    ctx.beginPath();
    ctx.ellipse(386, 104, 70, 34, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#4a444e';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(386, 104, 62, 26, 0, 0, Math.PI * 2);
    ctx.stroke();
    // lid
    ctx.strokeStyle = '#6b6570';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(322, 104);
    ctx.quadraticCurveTo(386, 128, 450, 104);
    ctx.stroke();
    ctx.strokeStyle = '#2b272e';
    ctx.lineWidth = 1;
    for (let i = 0; i < 8; i++) {
      const x = 334 + i * 14;
      line(x, 104 + Math.sin((i / 7) * Math.PI) * 15, x + 2, 104 + Math.sin((i / 7) * Math.PI) * 18, '#2b272e', 1);
    }

    // wall pillars
    for (let i = 0; i < 5; i++) {
      const x = 12 + i * 112;
      rect(x, 30, 18, 190, '#0e0b10');
      line(x + 18, 30, x + 18, 220, '#1a161c', 1);
    }

    // pause / heartbeat line at 88
    ctx.strokeStyle = '#4a444e';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 62; x < 116; x += 2) {
      const y = 180 + (x === 88 ? -9 : x === 90 ? 7 : 0) + Math.sin(time * 1.2) * 1.5;
      if (x === 62) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
    px(88, 172, '#9ed8c4');

    // heart at 238
    const beat = Math.pow(Math.max(0, Math.sin(time * 2.4)), 8);
    glow(238, 196, 26 + beat * 10, 'rgba(212,85,58,' + (0.18 + beat * 0.18) + ')', 0.9);
    rect(234, 192, 9, 9, '#6d1d0d');
    rect(232, 190, 13, 5, '#a42b10');
    px(236, 194, '#ff8a3d'); px(240, 194, '#ff8a3d');

    // eye anchor ground marker
    glow(392, 190, 22, 'rgba(158,216,196,.12)', 0.8);

    ground(218, '#090709', '#040304', '#2b272e');
    for (let i = 0; i < 20; i++) {
      const x = (i * 83 + 11) % W;
      const y = 220 + (i * 41) % 44;
      line(x, y, x + 3, y, '#1a161c', 1);
    }

    if (s.nearAnchor === 'pause') glow(88, 180, 22, 'rgba(158,216,196,.16)', 0.8);
    if (s.nearAnchor === 'heart') glow(238, 194, 24, 'rgba(212,85,58,.2)', 0.8);
    if (s.nearAnchor === 'eye') glow(392, 180, 24, 'rgba(158,216,196,.14)', 0.8);
  }

  function drawCrater(s) {
    drawSkyFor('crater');
    drawStars(time * 0.4);
    // sickly sun
    glow(238, 88, 84, 'rgba(215,240,106,.16)', 0.8);
    circle(238, 88, 22, '#d7f06a');
    circle(238, 88, 15, '#f0ffb0');

    // distant rim
    ridge(168, [[24, 154], [70, 160], [120, 150], [176, 166], [238, 152], [292, 162], [348, 150], [404, 164], [456, 154]], '#1d270e');
    // crater mouth
    poly([[114, 218], [150, 186], [190, 176], [238, 170], [286, 176], [330, 188], [366, 218]], '#080b05');
    glow(238, 202, 90, 'rgba(183,232,90,.2)', 0.9);
    for (let i = 0; i < 9; i++) {
      const x = 160 + i * 20;
      const y = 202 - Math.sin((i / 8) * Math.PI) * 12;
      line(x, y, x, 218, i % 2 ? '#3a4a1c' : '#2b3814', 2);
    }
    // inner light
    ditherRect(200, 190, 80, 20, '#d7f06a', 0.35, 2, 7);

    // atom at 88
    glow(88, 180, 32, 'rgba(215,240,106,.16)', 0.8);
    circle(88, 178, 7, '#d7f06a');
    circle(88, 178, 3, '#f0ffb0');
    ctx.strokeStyle = 'rgba(215,240,106,.6)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(88, 178, 18, 7, Math.sin(time * 0.4) * 0.4, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(88, 178, 18, 7, Math.sin(time * 0.4 + 1.2) * 0.4, 0, Math.PI * 2);
    ctx.stroke();

    // light column at 238
    ctx.globalAlpha = 0.18;
    poly([[228, 218], [234, 120], [242, 120], [248, 218]], '#d7f06a');
    ctx.globalAlpha = 1;
    for (let i = 0; i < 7; i++) {
      const y = 128 + i * 12;
      line(232 + (i % 3), y, 244 - (i % 2), y - 4, 'rgba(240,255,176,.35)', 1);
    }

    // seed at 392
    glow(392, 198, 24, 'rgba(255,179,71,.16)', 0.8);
    rect(388, 196, 9, 7, '#3a2a18');
    ditherRect(386, 202, 14, 12, '#bfae98', 0.3, 2, 6);
    line(392, 194, 392, 184, '#d7f06a', 1);
    px(391, 183, '#f0ffb0');

    // bones
    for (let i = 0; i < 8; i++) {
      const x = 30 + i * 58;
      line(x, 214, x + 14, 208, i % 2 ? '#bfae98' : '#8a7a66', 2);
    }

    ground(218, '#121608', '#080b05', '#52601a');
    ditherRect(0, 220, W, 20, '#d7f06a', 0.06, 3, 12);

    if (s.nearAnchor === 'atom') glow(88, 178, 26, 'rgba(215,240,106,.2)', 0.8);
    if (s.nearAnchor === 'light') glow(238, 180, 28, 'rgba(240,255,176,.16)', 0.8);
    if (s.nearAnchor === 'seed') glow(392, 196, 24, 'rgba(215,240,106,.16)', 0.8);
  }

  function drawThreshold(s) {
    drawSkyFor('threshold');
    drawStars(time * 0.4);
    // dawn crack
    glow(238, 176, 150, 'rgba(217,138,82,.16)', 0.8);
    const g = ctx.createLinearGradient(0, 140, 0, 220);
    g.addColorStop(0, 'rgba(240,216,120,0)');
    g.addColorStop(0.55, 'rgba(217,138,82,.22)');
    g.addColorStop(1, 'rgba(240,216,120,.08)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 140, W, 80);

    // sleeping god: huge horns and head across horizon
    ctx.globalAlpha = 0.75;
    poly([[0, 218], [0, 196], [40, 180], [84, 186], [118, 172], [150, 182], [190, 168], [226, 178], [246, 160], [262, 178], [300, 168], [342, 182], [380, 170], [420, 184], [464, 176], [480, 190], [480, 218]], '#0b0810');
    // antlers
    ctx.strokeStyle = '#0b0810';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(210, 178); ctx.quadraticCurveTo(180, 140, 142, 120);
    ctx.moveTo(180, 148); ctx.quadraticCurveTo(166, 132, 158, 112);
    ctx.moveTo(196, 158); ctx.quadraticCurveTo(202, 132, 194, 116);
    ctx.moveTo(264, 178); ctx.quadraticCurveTo(296, 138, 336, 118);
    ctx.moveTo(298, 146); ctx.quadraticCurveTo(312, 130, 322, 108);
    ctx.moveTo(280, 158); ctx.quadraticCurveTo(274, 132, 282, 114);
    ctx.stroke();
    // head
    ctx.fillStyle = '#0b0810';
    ctx.beginPath();
    ctx.ellipse(238, 186, 34, 18, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    // stone with name at 88
    poly([[76, 214], [80, 178], [88, 170], [97, 180], [100, 214]], '#3a332e');
    ditherRect(80, 180, 17, 32, '#6b6570', 0.2, 2, 3);
    drawRune(90, 194, 20, 'beith', '#f0d878', 0.8);

    // Sen at 238 (anchor)
    // child at 392 (anchor + actor)
    drawAshChild(392, GROUND);

    // doorway / threshold arch at right? subtle
    ctx.globalAlpha = 0.25;
    line(352, 214, 352, 150, '#f0d878', 1);
    line(432, 214, 432, 150, '#f0d878', 1);
    ctx.globalAlpha = 1;

    ground(218, '#0b0810', '#050308', '#3a2a28');
    // tiny sprouts
    for (let i = 0; i < 10; i++) {
      const x = 120 + i * 26;
      line(x, 220, x, 215, i % 2 ? '#52601a' : '#3a4a1c', 1);
      px(x - 1, 214, '#d7f06a');
    }

    if (s.nearAnchor === 'name') glow(88, 192, 24, 'rgba(240,216,120,.2)', 0.8);
    if (s.nearAnchor === 'fox') glow(238, 194, 24, 'rgba(255,138,61,.2)', 0.8);
    if (s.nearAnchor === 'child') glow(392, 196, 24, 'rgba(240,216,120,.18)', 0.8);
  }

  const SCENES = {
    dunes: drawDunes,
    glass: drawGlass,
    forest: drawForest,
    ark: drawArk,
    time: drawTime,
    library: drawLibrary,
    silence: drawSilence,
    crater: drawCrater,
    threshold: drawThreshold
  };

  // ───────────────────────────────────────────────────────────── actors
  function drawKernShape(x, y, facing, phase, cloak, accent, ghost) {
    const bob = ghost ? 0 : Math.sin(phase * 2) * 1;
    const f = facing < 0 ? -1 : 1;
    ctx.save();
    ctx.translate(Math.round(x), Math.round(y + bob));
    ctx.scale(f, 1);

    // shadow
    if (!ghost) {
      ctx.globalAlpha = 0.45;
      ctx.fillStyle = '#000';
      ctx.beginPath();
      ctx.ellipse(0, 1, 12, 3, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    // staff
    if (!ghost) {
      line(-11, -1, -11, -34, '#5a3a20', 2);
      drawRune(-11, -38, 10, 'beith', accent || '#ffb347', 0.9);
      glow(-11, -38, 9, 'rgba(255,179,71,.2)', 0.7);
    }

    // legs
    const step = Math.sin(phase * 2) > 0 ? 1 : -1;
    rect(-6, -10, 4, 10, cloak || '#1b0f0b');
    rect(2, -10, 4, 10, cloak || '#1b0f0b');
    if (step > 0) rect(-7, -2, 5, 2, '#0d0705');
    else rect(2, -2, 5, 2, '#0d0705');

    // cloak
    poly([[-9, -31], [9, -31], [12, -8], [7, -4], [0, -7], [-7, -4], [-12, -8]], cloak || '#2a1710');
    ditherRect(-9, -28, 18, 22, accent || '#ff8a3d', ghost ? 0.08 : 0.16, 3, 9);
    // fur trim
    for (let i = 0; i < 7; i++) px(-8 + i * 2.6, -6 + (i % 2), '#bfae98');

    // arms
    rect(-9, -28, 3, 13, cloak || '#2a1710');
    rect(6, -28, 3, 13, cloak || '#2a1710');
    rect(6, -18, 3, 4, '#cfc4b1');

    // neck / head
    rect(-3, -35, 6, 5, '#cfc4b1');
    rect(-6, -43, 12, 10, '#e8dcc8');
    rect(-5, -41, 10, 5, '#cfc4b1');
    // beard
    poly([[-5, -37], [5, -37], [3, -30], [0, -28], [-3, -30]], '#d8cbb8');
    // eyes
    px(-3, -40, '#080605'); px(2, -40, accent || '#ffb347');
    // ears
    rect(-7, -41, 2, 3, '#bfae98'); rect(6, -41, 2, 3, '#bfae98');

    // horns
    line(-4, -43, -9, -50, '#e8dcc8', 2);
    line(-9, -50, -13, -54, '#e8dcc8', 1);
    line(4, -43, 9, -50, '#e8dcc8', 2);
    line(9, -50, 13, -54, '#e8dcc8', 1);
    px(-13, -55, '#f0d878'); px(13, -55, '#f0d878');

    ctx.restore();
  }

  function drawKern(x, y, facing, phase, accent) {
    drawKernShape(x, y, facing, phase, '#2a1710', accent, false);
  }

  function drawSen(x, y, phase, ghost) {
    const bob = ghost ? 0 : Math.sin(phase * 3) * 1;
    ctx.save();
    ctx.translate(Math.round(x), Math.round(y + bob));
    if (!ghost) {
      ctx.globalAlpha = 0.4;
      ctx.fillStyle = '#000';
      ctx.beginPath();
      ctx.ellipse(0, 1, 10, 2.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    // tail
    const tail = Math.sin(phase * 2) * 2;
    ctx.strokeStyle = '#d4553a';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(-6, -5);
    ctx.quadraticCurveTo(-16, -10 + tail, -13, -18 + tail);
    ctx.stroke();
    px(-14, -20 + tail, '#ffb347'); px(-12, -21 + tail, '#ffd27a');
    // body
    rect(-7, -9, 14, 8, '#c74a2c');
    rect(-5, -6, 10, 5, '#e8dcc8');
    // legs
    rect(-5, -2, 2, 2, '#6d1d0d'); rect(3, -2, 2, 2, '#6d1d0d');
    // head
    rect(4, -13, 9, 7, '#d4553a');
    poly([[13, -12], [17, -10], [13, -7]], '#e8dcc8');
    // ears
    poly([[6, -13], [7, -18], [10, -13]], '#c74a2c');
    poly([[10, -13], [12, -18], [14, -12]], '#c74a2c');
    px(11, -11, '#080605'); px(12, -11, '#f0d878');
    ctx.restore();
  }

  function drawMara(x, y, phase) {
    ctx.save();
    ctx.translate(Math.round(x), Math.round(y));
    ctx.globalAlpha = 0.82;
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.ellipse(0, 1, 12, 3, 0, 0, Math.PI * 2);
    ctx.fill();
    // robe
    poly([[-8, -42], [8, -42], [13, -2], [0, 2], [-13, -2]], '#3a3540');
    ditherRect(-9, -38, 18, 32, '#8a8490', 0.14, 3, 5);
    // arms
    rect(-10, -36, 3, 20, '#3a3540'); rect(7, -36, 3, 20, '#3a3540');
    // head / veil
    rect(-5, -50, 10, 10, '#8a8490');
    poly([[-7, -50], [7, -50], [10, -42], [0, -38], [-10, -42]], '#4a444e');
    rect(-5, -48, 10, 5, '#cfc4b1');
    px(-3, -46, '#080605'); px(2, -46, '#9ed8c4');
    // long grey hair
    line(-7, -46, -9, -30, '#6b6570', 1); line(7, -46, 9, -30, '#6b6570', 1);
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  function drawAshChild(x, y) {
    const bob = Math.sin(time * 1.4) * 0.7;
    ctx.save();
    ctx.translate(Math.round(x), Math.round(y + bob));
    // glow
    glow(0, -10, 18, 'rgba(240,216,120,.14)', 0.8);
    rect(-4, -18, 8, 12, '#3a332e');
    rect(-3, -23, 6, 6, '#8a8490');
    px(-2, -21, '#f0d878'); px(2, -21, '#f0d878');
    rect(-5, -16, 2, 8, '#3a332e'); rect(3, -16, 2, 8, '#3a332e');
    // ash flecks
    for (let i = 0; i < 4; i++) px(-8 + i * 5, -26 - (i % 2) * 3, '#bfae98');
    ctx.restore();
  }

  function drawActors(s) {
    const chapter = s.chapter || (TRO.CHAPTERS && TRO.CHAPTERS[0]) || {};
    const accent = chapter.accent || '#ff8a3d';
    const x = s.x == null ? 64 : s.x;
    const f = s.facing || 1;
    const phase = s.moving ? (s.phase || time * 6) : 0;

    if (scene === 'threshold') {
      // child already part of the scene; Sen sits near the fox anchor
      drawSen(238, GROUND, time + 1.2, false);
    } else if (scene === 'silence') {
      drawMara(446, GROUND, time);
      drawSen(Math.max(24, x - 24), GROUND, time, true);
    } else if (scene === 'forest') {
      drawSen(x - 25 * f, GROUND, time + 0.5, false);
    } else if (scene === 'time') {
      drawSen(x - 24 * f, GROUND, time + 0.2, true);
    } else if (scene === 'library') {
      drawSen(x - 24 * f, GROUND, time + 0.8, false);
    } else {
      drawSen(x - 24 * f, GROUND, time, scene === 'ark' ? false : false);
    }

    drawKern(x, GROUND, f, phase, accent);
  }

  // ───────────────────────────────────────────────────────────── markers
  function marker(x, y, rune, found, near, accent) {
    const pulse = 0.55 + 0.45 * Math.sin(time * 2.4);
    if (found) {
      ctx.globalAlpha = 0.55;
      drawRune(x, y - 30, 15, rune, accent || '#f0d878', 0.7);
      ctx.globalAlpha = 1;
      return;
    }
    ctx.globalAlpha = near ? 0.95 : 0.6;
    const yy = y - 34 + Math.sin(time * 1.8) * 2;
    // hovering diamond
    poly([[x, yy - 5], [x + 4, yy], [x, yy + 5], [x - 4, yy]], near ? '#f0d878' : '#bfae98');
    poly([[x, yy - 2], [x + 2, yy], [x, yy + 2], [x - 2, yy]], '#080605');
    if (near) {
      ctx.globalAlpha = 0.35;
      ctx.strokeStyle = '#f0d878';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(x, yy, 9 + pulse * 4, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
    ctx.globalAlpha = 1;
  }

  function drawMarkers(s) {
    const chapter = s.chapter;
    if (!chapter || !chapter.anchors) return;
    const found = s.found || {};
    const near = s.nearAnchor;
    for (const a of chapter.anchors) {
      marker(a.x, GROUND, a.rune, !!found[a.id], near === a.id, chapter.accent);
    }
    // echo
    if (chapter.echo && !s.echoFound) {
      const e = chapter.echo;
      const visible = s.listen || s.nearEcho;
      const pulse = 0.5 + 0.5 * Math.sin(time * 1.7);
      ctx.globalAlpha = visible ? 0.85 : 0.26;
      ctx.strokeStyle = '#9ed8c4';
      ctx.lineWidth = 1;
      for (let i = 0; i < 3; i++) {
        const r = 4 + i * 4 + pulse * 2;
        ctx.beginPath();
        ctx.arc(e.x, e.y, r, 0, Math.PI * 2);
        ctx.stroke();
      }
      circle(e.x, e.y, 2, '#fafbf3');
      if (visible) glow(e.x, e.y, 22, 'rgba(158,216,196,.22)', 0.8);
      ctx.globalAlpha = 1;
    } else if (chapter.echo && s.echoFound) {
      ctx.globalAlpha = 0.2;
      circle(chapter.echo.x, chapter.echo.y, 2, '#9ed8c4');
      ctx.globalAlpha = 1;
    }
  }

  // ───────────────────────────────────────────────────────────── particles+grade
  function drawParticles() {
    for (const p of particles) {
      const a = p.kind === 'firefly'
        ? 0.35 + 0.65 * Math.abs(Math.sin(time * 2 + p.sway))
        : clamp(p.life / p.max, 0, 1);
      ctx.globalAlpha = a;
      if (p.kind === 'rain') {
        line(p.x, p.y, p.x + 2, p.y + 7, p.color, 1);
      } else if (p.kind === 'page') {
        rect(p.x, p.y, 3, 2, p.color);
        rect(p.x + 1, p.y - 1, 2, 1, p.color);
      } else if (p.kind === 'glint') {
        px(p.x, p.y, p.color);
        if (p.size > 1) { px(p.x - 1, p.y, p.color); px(p.x + 1, p.y, p.color); px(p.x, p.y - 1, p.color); px(p.x, p.y + 1, p.color); }
      } else {
        rect(p.x, p.y, p.size, p.size, p.color);
      }
    }
    ctx.globalAlpha = 1;
  }

  function grade(s) {
    // vignette-ish dithering + audio pulse + listen tint
    if (scene === 'silence') {
      ctx.fillStyle = 'rgba(8,6,10,.16)';
      ctx.fillRect(0, 0, W, H);
    }
    if (s.listen) {
      ctx.fillStyle = 'rgba(10,28,26,.16)';
      ctx.fillRect(0, 0, W, H);
      ctx.globalAlpha = 0.05 + Math.max(0, Math.sin(time * 1.3)) * 0.03;
      ctx.fillStyle = '#9ed8c4';
      ctx.fillRect(0, 0, W, H);
      ctx.globalAlpha = 1;
    }
    // subtle darkening at the edges (dither, keeps pixel feel)
    const r = seeded(5);
    ctx.globalAlpha = 0.42;
    for (let i = 0; i < 120; i++) {
      const x = Math.floor(r() * W);
      const y = Math.floor(r() * H);
      const edge = Math.min(x, W - x, y, H - y);
      if (edge < 24 && r() > edge / 24) {
        ctx.fillStyle = '#040302';
        ctx.fillRect(x, y, 2, 2);
      }
    }
    ctx.globalAlpha = 1;
    if (lightning > 0) {
      ctx.fillStyle = 'rgba(220,240,244,' + (lightning * 0.25) + ')';
      ctx.fillRect(0, 0, W, H);
    }
  }

  function render(s) {
    if (!ctx) return;
    s = s || {};
    const dt = clamp(s.dt == null ? 0.016 : s.dt, 0.001, 0.05);
    time += dt;
    energy = s.energy == null ? energy : s.energy;
    spectrum = s.spectrum || spectrum;
    const reduce = !!s.reduceMotion;

    // ambient lightning
    lightningTimer -= dt;
    if (lightningTimer <= 0) {
      lightning = 1;
      lightningTimer = 4 + Math.random() * 7;
    }
    lightning = Math.max(0, lightning - dt * 3.2);

    updateParticles(dt, reduce);

    ctx.save();
    const draw = SCENES[scene] || drawDunes;
    draw(s || {});
    drawActors(s || {});
    drawMarkers(s || {});
    drawParticles();
    grade(s || {});
    ctx.restore();
  }

  window.Art = {
    W, H, GROUND,
    init,
    setScene,
    render,
    runeSVG,
    drawRune,
    getScene: () => scene,
    getTime: () => time
  };
})();
