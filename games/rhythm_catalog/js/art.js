/* РИТМ-КАТАЛОГ — responsive procedural worlds.
   The canvas fills the whole viewport, so geometry is recomputed on every
   resize. Each album supplies a palette and a scene; each track supplies a
   seed that changes the skyline, dunes, trees, stars and weather. */
(function () {
  'use strict';

  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const lerp = (a, b, t) => a + (b - a) * t;
  const TAU = Math.PI * 2;

  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function hash32(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  function parseColor(c) {
    if (!c) return [255, 255, 255];
    c = String(c).trim();
    if (c[0] === '#') {
      let s = c.slice(1);
      if (s.length === 3) s = s[0] + s[0] + s[1] + s[1] + s[2] + s[2];
      const n = parseInt(s, 16);
      return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    }
    let m = c.match(/hsl\(\s*([-\d.]+)[\s,]+([-\d.]+)%[\s,]+([-\d.]+)%/i);
    if (m) {
      const h = ((parseFloat(m[1]) % 360) + 360) % 360 / 360;
      const s = clamp(parseFloat(m[2]) / 100, 0, 1);
      const l = clamp(parseFloat(m[3]) / 100, 0, 1);
      const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      const p = 2 * l - q;
      const hue = x => {
        x = (x + 1) % 1;
        if (x < 1 / 6) return p + (q - p) * 6 * x;
        if (x < 1 / 2) return q;
        if (x < 2 / 3) return p + (q - p) * (2 / 3 - x) * 6;
        return p;
      };
      return [Math.round(hue(h + 1 / 3) * 255), Math.round(hue(h) * 255), Math.round(hue(h - 1 / 3) * 255)];
    }
    m = c.match(/\d+/g);
    if (m && m.length >= 3) return [ +m[0], +m[1], +m[2] ];
    return [255, 255, 255];
  }

  function rgba(c, a) {
    const p = parseColor(c);
    return 'rgba(' + p[0] + ',' + p[1] + ',' + p[2] + ',' + a + ')';
  }

  function shade(c, k) {
    const p = parseColor(c);
    return 'rgb(' + Math.round(clamp(p[0] * k, 0, 255)) + ',' +
      Math.round(clamp(p[1] * k, 0, 255)) + ',' +
      Math.round(clamp(p[2] * k, 0, 255)) + ')';
  }

  function rr(ctx, x, y, w, h, r) {
    r = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function glow(ctx, x, y, r, color, a) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, Math.max(1, r));
    g.addColorStop(0, rgba(color, a));
    g.addColorStop(0.45, rgba(color, a * 0.42));
    g.addColorStop(1, rgba(color, 0));
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }

  // ---------------------------------------------------------------- geometry
  let W = 360, H = 640, DPR = 1;
  let portrait = true;
  let laneSpan = 280, laneGap = 93, HIT_Y = 512;
  let LANE_X = [0, 0, 0, 0];
  let noteW = 70, noteH = 18;
  let hitR = 26;
  const SPAWN_Y = -24;
  const TRAVEL = 1.55;

  let theme = null;
  let seed = 1;
  let bg = null;
  let bgKey = '';
  let stars = [];
  let dust = [];
  let starSeed = 1;

  const Art = {
    get W() { return W; },
    get H() { return H; },
    get HIT_Y() { return HIT_Y; },
    get LANE_X() { return LANE_X; },
    get portrait() { return portrait; },
    get laneGap() { return laneGap; },
    get noteW() { return noteW; },
    get TRAVEL() { return TRAVEL; },
    get SPAWN_Y() { return SPAWN_Y; },
    get theme() { return theme; },
    get seed() { return seed; },
    get ui() { return clamp(Math.min(W, H) / 30, 12, 32); },
    init: init,
    resize: resize,
    setTheme: setTheme,
    drawWorld: drawWorld,
    hash32: hash32,
    rgba: rgba,
    parseColor: parseColor,
    shade: shade
  };

  function init() {
    // nothing to precompute: backgrounds are cached per theme/seed/size
  }

  function resize(w, h, dpr) {
    W = Math.max(240, Math.round(w));
    H = Math.max(240, Math.round(h));
    DPR = clamp(dpr || 1, 1, 2.5);
    portrait = H > W * 1.03;

    if (portrait) {
      laneSpan = Math.min(W * 0.82, 520);
    } else {
      laneSpan = clamp(Math.min(W * 0.5, H * 0.86), 300, 900);
    }
    laneGap = laneSpan / 3;
    LANE_X = [-1.5, -0.5, 0.5, 1.5].map(k => W / 2 + k * laneGap);
    HIT_Y = Math.round(H * (portrait ? 0.80 : 0.82));
    noteW = Math.min(laneGap * 0.66, portrait ? 96 : 78);
    noteH = clamp(noteW * 0.24, 12, 24);
    hitR = Math.max(16, laneGap * 0.24);

    bgKey = '';
    rebuild();
  }

  function setTheme(t, sd) {
    theme = t || theme;
    seed = (sd >>> 0) || 1;
    bgKey = '';
    rebuild();
  }

  function rebuild() {
    if (!theme) return;
    const key = [theme.scene, theme.accent, theme.accent2, seed, W, H, DPR].join('|');
    if (key === bgKey && bg) return;
    bgKey = key;
    starSeed = seed || 1;
    stars = [];
    dust = [];
    const r = mulberry32(seed ^ 0x9e3779b9);
    for (let i = 0; i < 120; i++) {
      stars.push({ x: r() * W, y: r() * H * 0.55, s: r() < 0.18 ? 2 : 1, p: r() * TAU, sp: 0.5 + r() * 1.8 });
    }
    for (let i = 0; i < 46; i++) {
      dust.push({ x: r() * W, y: r() * H, s: 0.6 + r() * 1.8, p: r() * TAU, sp: 0.3 + r() * 1.1 });
    }
    bg = buildBackground(theme, seed);
  }

  // -------------------------------------------------------------- background
  function buildBackground(t, sd) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(W * DPR));
    c.height = Math.max(1, Math.round(H * DPR));
    const g = c.getContext('2d');
    g.setTransform(DPR, 0, 0, DPR, 0, 0);
    g.imageSmoothingEnabled = true;
    const r = mulberry32((sd ^ 0x51ed270b) >>> 0);

    drawSky(g, t);
    const scene = SCENES[t.scene] || SCENES.void;
    scene(g, t, r);
    drawVignette(g, t);
    return c;
  }

  function drawSky(g, t) {
    const grd = g.createLinearGradient(0, 0, 0, H);
    grd.addColorStop(0, t.sky[0]);
    grd.addColorStop(0.55, t.sky[1]);
    grd.addColorStop(1, t.sky[2]);
    g.fillStyle = grd;
    g.fillRect(0, 0, W, H);
    // low horizon haze
    const hz = g.createLinearGradient(0, H * 0.42, 0, H);
    hz.addColorStop(0, rgba(t.fog, 0));
    hz.addColorStop(1, rgba(t.fog, 0.22));
    g.fillStyle = hz;
    g.fillRect(0, H * 0.42, W, H * 0.58);
  }

  function drawVignette(g, t) {
    const cx = W / 2;
    const cy = H * 0.54;
    const r = Math.max(W, H) * 0.78;
    const grd = g.createRadialGradient(cx, cy, r * 0.28, cx, cy, r);
    grd.addColorStop(0, 'rgba(0,0,0,0)');
    grd.addColorStop(0.72, 'rgba(0,0,0,0.28)');
    grd.addColorStop(1, 'rgba(0,0,0,0.72)');
    g.fillStyle = grd;
    g.fillRect(0, 0, W, H);
  }

  // ---------------------------------------------------------------- scenes
  const SCENES = {};

  SCENES.space = function (g, t, r) {
    // nebula
    for (let i = 0; i < 5; i++) {
      const x = r() * W, y = r() * H * 0.62, rad = Math.max(W, H) * (0.16 + r() * 0.22);
      glow(g, x, y, rad, i % 2 ? t.accent : t.accent2, 0.075 + r() * 0.06);
    }
    // stars
    for (let i = 0; i < 190; i++) {
      const x = r() * W, y = r() * H * 0.72, s = r() < 0.1 ? 2 : 1;
      g.globalAlpha = 0.18 + r() * 0.6;
      g.fillStyle = i % 7 === 0 ? t.accent2 : '#ffffff';
      g.fillRect(x, y, s, s);
    }
    g.globalAlpha = 1;
    // planet
    const pr = Math.min(W, H) * (0.13 + r() * 0.05);
    const px = W * (0.62 + r() * 0.18), py = H * (0.20 + r() * 0.12);
    glow(g, px, py, pr * 2.2, t.accent2, 0.12);
    const pg = g.createRadialGradient(px - pr * 0.4, py - pr * 0.4, pr * 0.1, px, py, pr);
    pg.addColorStop(0, shade(t.accent2, 1.1));
    pg.addColorStop(0.68, shade(t.accent2, 0.55));
    pg.addColorStop(1, shade(t.sky[0], 0.9));
    g.fillStyle = pg;
    g.beginPath();
    g.arc(px, py, pr, 0, TAU);
    g.fill();
    g.strokeStyle = rgba(t.accent, 0.4);
    g.lineWidth = Math.max(1, pr * 0.05);
    g.beginPath();
    g.ellipse(px, py, pr * 1.7, pr * 0.36, -0.32, 0, TAU);
    g.stroke();
    // distant debris
    for (let i = 0; i < 18; i++) {
      const x = r() * W, y = H * (0.5 + r() * 0.2);
      g.fillStyle = rgba(t.fog, 0.3 + r() * 0.3);
      g.fillRect(x, y, 2 + r() * 5, 1 + r() * 2);
    }
  };

  SCENES.forest = function (g, t, r) {
    // moon
    const mx = W * (0.72 + r() * 0.14), my = H * (0.14 + r() * 0.08);
    glow(g, mx, my, Math.min(W, H) * 0.22, t.sun, 0.20);
    g.fillStyle = t.sun;
    g.beginPath();
    g.arc(mx, my, Math.min(W, H) * 0.035, 0, TAU);
    g.fill();
    // three tree layers
    const layers = [
      { y: H * 0.58, h: H * 0.16, c: shade(t.horizon[0], 0.72), n: 22 },
      { y: H * 0.68, h: H * 0.24, c: shade(t.horizon[0], 0.92), n: 15 },
      { y: H * 0.80, h: H * 0.30, c: shade(t.sky[0], 0.92), n: 10 }
    ];
    layers.forEach(function (L, li) {
      for (let i = 0; i < L.n; i++) {
        const x = (i + 0.25 + r() * 0.5) * (W / L.n);
        const h = L.h * (0.6 + r() * 0.65);
        const w = h * (0.34 + r() * 0.16);
        g.fillStyle = L.c;
        g.beginPath();
        g.moveTo(x, L.y - h);
        g.lineTo(x - w, L.y);
        g.lineTo(x + w, L.y);
        g.closePath();
        g.fill();
        if (li > 0) {
          g.fillStyle = rgba(t.accent, 0.07);
          g.beginPath();
          g.moveTo(x, L.y - h);
          g.lineTo(x - w * 0.45, L.y - h * 0.32);
          g.lineTo(x + w * 0.45, L.y - h * 0.32);
          g.closePath();
          g.fill();
        }
      }
    });
    // fireflies / mushrooms in the foreground
    for (let i = 0; i < 34; i++) {
      const x = r() * W, y = H * (0.72 + r() * 0.2);
      g.fillStyle = rgba(i % 3 ? t.accent : t.accent2, 0.25 + r() * 0.45);
      g.fillRect(x, y, 2, 2);
    }
    // ground
    const gg = g.createLinearGradient(0, H * 0.76, 0, H);
    gg.addColorStop(0, rgba(t.horizon[0], 0.0));
    gg.addColorStop(1, rgba(t.sky[0], 0.85));
    g.fillStyle = gg;
    g.fillRect(0, H * 0.76, W, H * 0.24);
  };

  SCENES.city = function (g, t, r) {
    // horizon glow
    glow(g, W * 0.5, H * 0.62, Math.max(W, H) * 0.5, t.accent2, 0.10);
    // back skyline
    const base = H * 0.80;
    for (let layer = 0; layer < 2; layer++) {
      const n = layer ? 13 : 17;
      const c = layer ? shade(t.sky[0], 1.18) : shade(t.sky[0], 0.92);
      for (let i = 0; i < n; i++) {
        const bw = W / n * (0.55 + r() * 0.7);
        const bh = H * (layer ? 0.14 + r() * 0.24 : 0.10 + r() * 0.19);
        const x = (i / n) * W - bw * 0.1;
        const y = base - bh;
        g.fillStyle = c;
        g.fillRect(x, y, bw, bh);
        if (r() < 0.4) {
          g.fillStyle = shade(t.sky[0], 0.68);
          g.fillRect(x + bw * 0.45, y - bh * 0.1, Math.max(2, bw * 0.05), bh * 0.1);
        }
        // windows
        const cols = Math.max(2, Math.floor(bw / 11));
        const rows = Math.max(2, Math.floor(bh / 14));
        for (let yy = 0; yy < rows; yy++) {
          for (let xx = 0; xx < cols; xx++) {
            if (r() < 0.68) continue;
            g.fillStyle = rgba(r() < 0.25 ? t.accent2 : t.accent, 0.16 + r() * 0.6);
            g.fillRect(x + 3 + xx * (bw - 6) / cols, y + 4 + yy * (bh - 8) / rows, 2, 2);
          }
        }
        // neon sign
        if (r() < 0.22) {
          g.fillStyle = rgba(t.accent2, 0.55 + r() * 0.3);
          g.fillRect(x + bw * 0.2, y + bh * 0.28, bw * 0.6, 2);
        }
      }
    }
    // street / wet reflection
    const gg = g.createLinearGradient(0, base, 0, H);
    gg.addColorStop(0, rgba(t.sky[0], 0.9));
    gg.addColorStop(1, rgba(t.sky[0], 0.55));
    g.fillStyle = gg;
    g.fillRect(0, base, W, H - base);
    for (let i = 0; i < 16; i++) {
      g.fillStyle = rgba(t.accent, 0.08 + r() * 0.12);
      g.fillRect(r() * W, base + r() * (H - base), 2, 8 + r() * 26);
    }
  };

  SCENES.desert = function (g, t, r) {
    const sunX = W * (0.24 + r() * 0.5), sunY = H * (0.24 + r() * 0.1);
    glow(g, sunX, sunY, Math.min(W, H) * 0.3, t.sun, 0.16);
    g.fillStyle = rgba(t.sun, 0.9);
    g.beginPath();
    g.arc(sunX, sunY, Math.min(W, H) * (0.045 + r() * 0.02), 0, TAU);
    g.fill();
    // dunes
    for (let layer = 0; layer < 4; layer++) {
      const y = H * (0.56 + layer * 0.085);
      const amp = H * (0.05 + layer * 0.012);
      const c = layer === 3 ? shade(t.sky[0], 0.95) : shade(t.horizon[0], 0.62 + layer * 0.13);
      g.fillStyle = c;
      g.beginPath();
      g.moveTo(0, H);
      g.lineTo(0, y);
      const steps = 8;
      for (let i = 0; i <= steps; i++) {
        const x = (i / steps) * W;
        const yy = y + Math.sin(i * 1.7 + layer * 2.1 + r() * 0.4) * amp;
        g.lineTo(x, yy);
      }
      g.lineTo(W, H);
      g.closePath();
      g.fill();
    }
    // monolith
    if (r() < 0.72) {
      const mx = W * (0.5 + r() * 0.3), mh = H * (0.12 + r() * 0.12);
      g.fillStyle = shade(t.fog, 0.52);
      g.fillRect(mx, H * 0.60 - mh, Math.max(5, W * 0.016), mh);
      g.fillStyle = rgba(t.accent2, 0.35);
      g.fillRect(mx + 2, H * 0.60 - mh + 4, 2, mh * 0.4);
    }
    // dust stars
    for (let i = 0; i < 40; i++) {
      g.fillStyle = rgba(t.sun, 0.08 + r() * 0.18);
      g.fillRect(r() * W, r() * H * 0.6, 1, 1);
    }
  };

  SCENES.rain = function (g, t, r) {
    // clouds
    for (let i = 0; i < 14; i++) {
      const x = r() * W, y = H * (0.08 + r() * 0.3), rad = Math.min(W, H) * (0.10 + r() * 0.16);
      g.fillStyle = rgba(t.fog, 0.10 + r() * 0.08);
      g.beginPath();
      g.ellipse(x, y, rad * 1.7, rad * 0.6, r() * 0.5, 0, TAU);
      g.fill();
    }
    // distant city
    const base = H * 0.78;
    for (let i = 0; i < 18; i++) {
      const bw = W / 18 * (0.6 + r() * 0.8);
      const bh = H * (0.08 + r() * 0.2);
      g.fillStyle = rgba(t.sky[0], 0.72);
      g.fillRect((i / 18) * W, base - bh, bw, bh);
      if (r() < 0.32) {
        g.fillStyle = rgba(t.accent2, 0.25 + r() * 0.3);
        g.fillRect((i / 18) * W + bw * 0.3, base - bh + 5, 2, 2);
      }
    }
    // wet ground
    const gg = g.createLinearGradient(0, base, 0, H);
    gg.addColorStop(0, rgba(t.sky[1], 0.55));
    gg.addColorStop(1, rgba(t.sky[0], 0.95));
    g.fillStyle = gg;
    g.fillRect(0, base, W, H - base);
    for (let i = 0; i < 22; i++) {
      const x = r() * W, y = base + r() * (H - base);
      g.fillStyle = rgba(t.accent, 0.06 + r() * 0.12);
      g.fillRect(x, y, 2 + r() * 12, 1);
    }
  };

  SCENES.cathedral = function (g, t, r) {
    const cx = W / 2, base = H * 0.86;
    // rose window
    const ry = H * 0.28, rad = Math.min(W, H) * 0.19;
    glow(g, cx, ry, rad * 1.9, t.accent2, 0.13);
    g.strokeStyle = rgba(t.accent2, 0.38);
    g.lineWidth = Math.max(2, rad * 0.035);
    g.beginPath(); g.arc(cx, ry, rad, 0, TAU); g.stroke();
    g.beginPath(); g.arc(cx, ry, rad * 0.62, 0, TAU); g.stroke();
    for (let i = 0; i < 12; i++) {
      const a = i / 12 * TAU;
      g.beginPath();
      g.moveTo(cx + Math.cos(a) * rad * 0.2, ry + Math.sin(a) * rad * 0.2);
      g.lineTo(cx + Math.cos(a) * rad, ry + Math.sin(a) * rad);
      g.stroke();
    }
    for (let i = 0; i < 10; i++) {
      const a = r() * TAU, d = rad * (0.25 + r() * 0.6);
      g.fillStyle = rgba(r() < 0.5 ? t.accent : t.accent2, 0.22 + r() * 0.3);
      g.fillRect(cx + Math.cos(a) * d, ry + Math.sin(a) * d, 3, 3);
    }
    // gothic arches
    const archN = 5;
    for (let i = 0; i < archN; i++) {
      const span = W / archN;
      const x = i * span;
      const h = H * 0.34;
      g.fillStyle = shade(t.sky[0], i % 2 ? 1.28 : 1.12);
      g.beginPath();
      g.moveTo(x, base);
      g.lineTo(x, base - h);
      g.quadraticCurveTo(x + span * 0.5, base - h - span * 0.75, x + span, base - h);
      g.lineTo(x + span, base);
      g.closePath();
      g.fill();
      g.strokeStyle = rgba(t.accent, 0.18);
      g.lineWidth = 1;
      g.stroke();
    }
    // columns
    for (let i = 0; i <= archN; i++) {
      const x = i * (W / archN);
      const cw = Math.max(8, W / archN * 0.13);
      g.fillStyle = shade(t.fog, 0.28);
      g.fillRect(x - cw / 2, H * 0.36, cw, H * 0.5);
      g.fillStyle = rgba(t.accent, 0.10);
      g.fillRect(x - cw / 2, H * 0.36, Math.max(1, cw * 0.18), H * 0.5);
    }
    // candle glow
    for (let i = 0; i < 8; i++) {
      glow(g, W * (0.12 + i * 0.11), H * (0.64 + r() * 0.08), Math.min(W, H) * 0.03, t.sun, 0.22);
    }
  };

  SCENES.garden = function (g, t, r) {
    const mx = W * (0.3 + r() * 0.4), my = H * (0.16 + r() * 0.08);
    glow(g, mx, my, Math.min(W, H) * 0.24, t.sun, 0.14);
    g.fillStyle = rgba(t.sun, 0.75);
    g.beginPath();
    g.arc(mx, my, Math.min(W, H) * 0.04, 0, TAU);
    g.fill();
    // hills
    for (let i = 0; i < 3; i++) {
      const y = H * (0.62 + i * 0.08);
      g.fillStyle = shade(t.horizon[0], 0.55 + i * 0.17);
      g.beginPath();
      g.moveTo(0, H);
      g.lineTo(0, y);
      for (let k = 0; k <= 6; k++) {
        g.quadraticCurveTo(W * (k + 0.5) / 6, y - H * (0.03 + (k % 2) * 0.02), W * (k + 1) / 6, y);
      }
      g.lineTo(W, H);
      g.closePath();
      g.fill();
    }
    // flower stems
    for (let i = 0; i < 26; i++) {
      const x = r() * W, base = H * (0.76 + r() * 0.22), h = H * (0.05 + r() * 0.16);
      g.strokeStyle = rgba(t.accent, 0.22 + r() * 0.25);
      g.lineWidth = 1 + (r() < 0.4 ? 1 : 0);
      g.beginPath();
      g.moveTo(x, base);
      g.quadraticCurveTo(x + (r() - 0.5) * 18, base - h * 0.5, x + (r() - 0.5) * 10, base - h);
      g.stroke();
      const petal = 2 + r() * 3;
      g.fillStyle = rgba(r() < 0.5 ? t.accent2 : t.accent, 0.35 + r() * 0.45);
      for (let p = 0; p < 5; p++) {
        const a = p / 5 * TAU;
        g.beginPath();
        g.arc(x + Math.cos(a) * petal, base - h + Math.sin(a) * petal, petal * 0.75, 0, TAU);
        g.fill();
      }
    }
    // vines on the edges
    for (let side = 0; side < 2; side++) {
      const sx = side ? W : 0;
      g.strokeStyle = rgba(t.accent, 0.14);
      g.lineWidth = 2;
      for (let i = 0; i < 5; i++) {
        g.beginPath();
        g.moveTo(sx, H * (0.1 + i * 0.18));
        g.bezierCurveTo(sx + (side ? -1 : 1) * W * 0.18, H * (0.14 + i * 0.18), sx + (side ? -1 : 1) * W * 0.08, H * (0.24 + i * 0.18), sx + (side ? -1 : 1) * W * 0.22, H * (0.3 + i * 0.18));
        g.stroke();
      }
    }
  };

  SCENES.ice = function (g, t, r) {
    // aurora
    for (let i = 0; i < 4; i++) {
      const y = H * (0.1 + i * 0.06);
      g.strokeStyle = rgba(i % 2 ? t.accent : t.accent2, 0.10 + i * 0.015);
      g.lineWidth = H * 0.04;
      g.beginPath();
      g.moveTo(-20, y);
      for (let k = 0; k <= 5; k++) {
        g.quadraticCurveTo(W * (k + 0.5) / 5, y + Math.sin(k * 1.3 + i + r()) * H * 0.05, W * (k + 1) / 5 + 20, y);
      }
      g.stroke();
    }
    // shards
    for (let i = 0; i < 12; i++) {
      const x = r() * W, base = H * (0.72 + r() * 0.2), h = H * (0.1 + r() * 0.34), w = h * (0.12 + r() * 0.15);
      g.fillStyle = rgba(i % 3 ? t.horizon[1] : t.accent2, 0.10 + r() * 0.18);
      g.beginPath();
      g.moveTo(x, base - h);
      g.lineTo(x - w, base);
      g.lineTo(x + w, base);
      g.closePath();
      g.fill();
      g.strokeStyle = rgba(t.accent, 0.18);
      g.stroke();
    }
    const gg = g.createLinearGradient(0, H * 0.74, 0, H);
    gg.addColorStop(0, rgba(t.sky[1], 0.2));
    gg.addColorStop(1, rgba(t.sky[0], 0.85));
    g.fillStyle = gg;
    g.fillRect(0, H * 0.74, W, H * 0.26);
  };

  SCENES.industrial = function (g, t, r) {
    glow(g, W * 0.5, H * 0.68, Math.max(W, H) * 0.46, t.accent2, 0.07);
    // smokestacks
    for (let i = 0; i < 5; i++) {
      const x = W * (0.08 + r() * 0.84), w = W * (0.03 + r() * 0.04), h = H * (0.2 + r() * 0.3);
      g.fillStyle = shade(t.sky[0], 1.2);
      g.fillRect(x, H * 0.72 - h, w, h);
      g.fillStyle = rgba(t.accent, 0.22);
      g.fillRect(x + w * 0.3, H * 0.72 - h, Math.max(1, w * 0.15), h);
      for (let s = 0; s < 3; s++) {
        g.fillStyle = rgba(t.fog, 0.08 - s * 0.02);
        g.beginPath();
        g.ellipse(x + w / 2 + s * 8, H * 0.72 - h - 12 - s * 14, 18 + s * 8, 7 + s * 3, 0, 0, TAU);
        g.fill();
      }
    }
    // trusses
    g.strokeStyle = rgba(t.fog, 0.30);
    g.lineWidth = 2;
    for (let i = 0; i < 3; i++) {
      const y = H * (0.12 + i * 0.05);
      g.beginPath();
      g.moveTo(0, y);
      g.lineTo(W, y);
      g.stroke();
      for (let x = 0; x < W; x += W / 8) {
        g.beginPath();
        g.moveTo(x, y);
        g.lineTo(x + W / 16, y + H * 0.035);
        g.lineTo(x + W / 8, y);
        g.stroke();
      }
    }
    // pipes
    for (let i = 0; i < 4; i++) {
      g.strokeStyle = rgba(t.fog, 0.16 + i * 0.04);
      g.lineWidth = 3 + r() * 5;
      const y = H * (0.76 + r() * 0.14);
      g.beginPath();
      g.moveTo(0, y);
      g.lineTo(W * 0.35, y);
      g.lineTo(W * 0.42, y - H * 0.06);
      g.lineTo(W, y - H * 0.06);
      g.stroke();
    }
    const gg = g.createLinearGradient(0, H * 0.74, 0, H);
    gg.addColorStop(0, rgba(t.sky[1], 0.45));
    gg.addColorStop(1, rgba(t.sky[0], 0.9));
    g.fillStyle = gg;
    g.fillRect(0, H * 0.74, W, H * 0.26);
  };

  SCENES.ruins = function (g, t, r) {
    glow(g, W * (0.3 + r() * 0.4), H * 0.58, Math.max(W, H) * 0.4, t.sun, 0.09);
    const base = H * 0.82;
    // broken distant wall
    for (let i = 0; i < 14; i++) {
      const x = (i / 14) * W, w = W / 14 * (0.7 + r() * 0.5);
      const h = H * (0.04 + r() * 0.18);
      g.fillStyle = rgba(t.horizon[0], 0.35 + r() * 0.3);
      g.fillRect(x, base - h, w, h);
    }
    // columns
    for (let i = 0; i < 6; i++) {
      const x = W * (0.06 + i * 0.18 + r() * 0.04);
      const h = H * (0.14 + r() * 0.22);
      const w = W * (0.016 + r() * 0.012);
      g.fillStyle = shade(t.fog, 0.46);
      g.fillRect(x, base - h, w, h);
      if (r() < 0.55) {
        g.fillStyle = shade(t.fog, 0.38);
        g.fillRect(x - w * 0.35, base - h, w * 1.7, Math.max(3, h * 0.045));
      }
    }
    // rubble
    for (let i = 0; i < 22; i++) {
      const x = r() * W, y = base + r() * (H - base) * 0.8, s = 2 + r() * 10;
      g.fillStyle = rgba(t.fog, 0.18 + r() * 0.28);
      g.fillRect(x, y, s, s * 0.6);
    }
    const gg = g.createLinearGradient(0, base, 0, H);
    gg.addColorStop(0, rgba(t.horizon[0], 0.25));
    gg.addColorStop(1, rgba(t.sky[0], 0.85));
    g.fillStyle = gg;
    g.fillRect(0, base, W, H - base);
  };

  SCENES.grid = function (g, t, r) {
    const horizon = H * 0.56;
    // floor grid
    g.save();
    g.strokeStyle = rgba(t.accent, 0.20);
    g.lineWidth = 1;
    for (let i = 0; i <= 16; i++) {
      const x = (i / 16) * W;
      g.beginPath();
      g.moveTo(W / 2 + (x - W / 2) * 0.06, horizon);
      g.lineTo(x, H);
      g.stroke();
    }
    for (let i = 0; i < 14; i++) {
      const p = i / 14;
      const y = horizon + Math.pow(p, 2.1) * (H - horizon);
      g.globalAlpha = 0.07 + p * 0.20;
      g.beginPath();
      g.moveTo(0, y);
      g.lineTo(W, y);
      g.stroke();
    }
    g.restore();
    g.globalAlpha = 1;
    // horizon glow
    glow(g, W / 2, horizon, Math.max(W, H) * 0.42, t.accent2, 0.12);
    g.fillStyle = rgba(t.accent2, 0.5);
    g.fillRect(W * 0.1, horizon, W * 0.8, 1);
    // glitch slabs
    for (let i = 0; i < 12; i++) {
      const x = r() * W, y = r() * horizon, w = 12 + r() * W * 0.2, h = 2 + r() * 10;
      g.fillStyle = rgba(r() < 0.4 ? t.accent2 : t.accent, 0.05 + r() * 0.22);
      g.fillRect(x, y, w, h);
    }
    // scanlines
    g.fillStyle = 'rgba(0,0,0,0.16)';
    for (let y = 0; y < H; y += 5) g.fillRect(0, y, W, 1);
  };

  SCENES.organic = function (g, t, r) {
    // membranes
    for (let i = 0; i < 11; i++) {
      const x = r() * W, y = r() * H, rad = Math.min(W, H) * (0.05 + r() * 0.16);
      const pg = g.createRadialGradient(x, y, rad * 0.1, x, y, rad);
      pg.addColorStop(0, rgba(t.accent, 0.18));
      pg.addColorStop(0.7, rgba(t.accent2, 0.08));
      pg.addColorStop(1, rgba(t.accent, 0));
      g.fillStyle = pg;
      g.beginPath();
      g.arc(x, y, rad, 0, TAU);
      g.fill();
      g.strokeStyle = rgba(t.accent2, 0.14);
      g.lineWidth = 1;
      g.beginPath();
      g.arc(x, y, rad * 0.8, 0, TAU);
      g.stroke();
      g.fillStyle = rgba(t.accent2, 0.20);
      g.beginPath();
      g.arc(x, y, Math.max(2, rad * 0.08), 0, TAU);
      g.fill();
    }
    // veins
    g.strokeStyle = rgba(t.accent, 0.12);
    g.lineWidth = 1;
    for (let i = 0; i < 16; i++) {
      let x = r() * W, y = r() * H;
      g.beginPath();
      g.moveTo(x, y);
      for (let k = 0; k < 4; k++) {
        x += (r() - 0.5) * W * 0.18;
        y += (r() - 0.5) * H * 0.16;
        g.lineTo(x, y);
      }
      g.stroke();
    }
  };

  SCENES.orb = function (g, t, r) {
    const cx = W * 0.5, cy = H * 0.36, rad = Math.min(W, H) * 0.28;
    glow(g, cx, cy, rad * 2.5, t.accent, 0.14);
    const pg = g.createRadialGradient(cx - rad * 0.3, cy - rad * 0.3, rad * 0.08, cx, cy, rad);
    pg.addColorStop(0, rgba(t.sun, 0.85));
    pg.addColorStop(0.4, rgba(t.accent, 0.55));
    pg.addColorStop(1, rgba(t.accent2, 0.04));
    g.fillStyle = pg;
    g.beginPath();
    g.arc(cx, cy, rad, 0, TAU);
    g.fill();
    for (let i = 0; i < 4; i++) {
      g.strokeStyle = rgba(i % 2 ? t.accent2 : t.accent, 0.16 + i * 0.05);
      g.lineWidth = 1 + i * 0.6;
      g.beginPath();
      g.ellipse(cx, cy, rad * (1.25 + i * 0.24), rad * (0.30 + i * 0.10), -0.35 + i * 0.13, 0, TAU);
      g.stroke();
    }
    for (let i = 0; i < 30; i++) {
      const a = r() * TAU, d = rad * (1.1 + r() * 1.4);
      g.fillStyle = rgba(i % 3 ? t.accent : t.accent2, 0.15 + r() * 0.35);
      g.fillRect(cx + Math.cos(a) * d, cy + Math.sin(a) * d * 0.6, 2, 2);
    }
    // floor reflection
    const gg = g.createLinearGradient(0, H * 0.66, 0, H);
    gg.addColorStop(0, rgba(t.accent, 0.10));
    gg.addColorStop(1, rgba(t.sky[0], 0.9));
    g.fillStyle = gg;
    g.fillRect(0, H * 0.66, W, H * 0.34);
  };

  SCENES.hall = function (g, t, r) {
    const base = H * 0.84;
    // floor tiles
    for (let i = 0; i < 10; i++) {
      const y = base + Math.pow(i / 10, 1.7) * (H - base);
      g.strokeStyle = rgba(t.accent, 0.07);
      g.beginPath();
      g.moveTo(0, y);
      g.lineTo(W, y);
      g.stroke();
    }
    for (let i = 0; i <= 8; i++) {
      const x = (i / 8) * W;
      g.strokeStyle = rgba(t.accent, 0.055);
      g.beginPath();
      g.moveTo(W / 2 + (x - W / 2) * 0.2, base);
      g.lineTo(x, H);
      g.stroke();
    }
    // columns
    for (let i = 0; i < 4; i++) {
      const left = i < 2;
      const x = left ? W * (0.04 + (i % 2) * 0.10) : W * (0.78 + (i % 2) * 0.10);
      const w = W * 0.05;
      const top = H * (0.16 + r() * 0.04);
      g.fillStyle = shade(t.horizon[0], 0.55);
      g.fillRect(x, top, w, base - top);
      g.fillStyle = rgba(t.accent, 0.013);
      g.fillRect(x + w * 0.2, top, w * 0.2, base - top);
      g.fillStyle = shade(t.horizon[0], 0.42);
      g.fillRect(x - w * 0.2, top - H * 0.02, w * 1.4, H * 0.025);
      g.fillRect(x - w * 0.2, base - H * 0.025, w * 1.4, H * 0.025);
    }
    // chandelier
    const cx = W / 2, cy = H * 0.18;
    glow(g, cx, cy, Math.min(W, H) * 0.18, t.sun, 0.18);
    g.strokeStyle = rgba(t.accent2, 0.5);
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(cx, 0);
    g.lineTo(cx, cy);
    g.stroke();
    g.beginPath();
    g.arc(cx, cy, Math.min(W, H) * 0.06, 0, TAU);
    g.stroke();
    for (let i = 0; i < 8; i++) {
      const a = i / 8 * TAU;
      const x = cx + Math.cos(a) * Math.min(W, H) * 0.06;
      const y = cy + Math.sin(a) * Math.min(W, H) * 0.03;
      glow(g, x, y, 10, t.sun, 0.26);
    }
  };

  SCENES.circus = function (g, t, r) {
    // tent stripes
    const cx = W * 0.5, top = H * 0.02;
    for (let i = 0; i < 12; i++) {
      const a0 = Math.PI + (i / 12) * Math.PI;
      const a1 = Math.PI + ((i + 1) / 12) * Math.PI;
      g.fillStyle = rgba(i % 2 ? t.accent : t.accent2, 0.10 + r() * 0.08);
      g.beginPath();
      g.moveTo(cx, top);
      g.lineTo(cx + Math.cos(a0) * W, top + Math.sin(a0) * W * 0.7);
      g.lineTo(cx + Math.cos(a1) * W, top + Math.sin(a1) * W * 0.7);
      g.closePath();
      g.fill();
    }
    // stage
    const base = H * 0.78;
    g.fillStyle = shade(t.sky[0], 1.3);
    g.beginPath();
    g.ellipse(W / 2, base, W * 0.42, H * 0.09, 0, 0, TAU);
    g.fill();
    g.fillStyle = rgba(t.accent2, 0.35);
    g.fillRect(W * 0.08, base, W * 0.84, 2);
    // spotlights
    for (let i = 0; i < 3; i++) {
      const x = W * (0.18 + i * 0.32);
      const lg = g.createLinearGradient(x, 0, W / 2, base);
      lg.addColorStop(0, rgba(i % 2 ? t.accent : t.accent2, 0.18));
      lg.addColorStop(1, rgba(i % 2 ? t.accent : t.accent2, 0));
      g.fillStyle = lg;
      g.beginPath();
      g.moveTo(x, 0);
      g.lineTo(W / 2 - W * 0.22, base);
      g.lineTo(W / 2 + W * 0.22, base);
      g.closePath();
      g.fill();
    }
    // confetti / stars
    for (let i = 0; i < 50; i++) {
      g.fillStyle = rgba(r() < 0.5 ? t.accent : t.accent2, 0.15 + r() * 0.35);
      g.fillRect(r() * W, r() * H * 0.7, 2, 2);
    }
  };

  SCENES.edge = function (g, t, r) {
    // jagged cliffs from both sides
    for (let side = 0; side < 2; side++) {
      g.fillStyle = shade(t.sky[0], side ? 1.35 : 1.18);
      g.beginPath();
      g.moveTo(side ? W : 0, H);
      g.lineTo(side ? W : 0, H * 0.2);
      const steps = 7;
      for (let i = 1; i <= steps; i++) {
        const p = i / steps;
        const x = (side ? W : 0) + (side ? -1 : 1) * W * 0.34 * p;
        const y = H * (0.2 + p * 0.7) + Math.sin(i * 2.1 + r() * 2) * H * 0.06;
        g.lineTo(x, y);
      }
      g.closePath();
      g.fill();
    }
    // crack glow
    g.strokeStyle = rgba(t.accent, 0.42);
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(W * 0.5, H * 0.24);
    g.lineTo(W * 0.46, H * 0.38);
    g.lineTo(W * 0.53, H * 0.5);
    g.lineTo(W * 0.47, H * 0.64);
    g.lineTo(W * 0.51, H * 0.78);
    g.stroke();
    glow(g, W * 0.5, H * 0.52, Math.max(W, H) * 0.35, t.accent, 0.08);
    // abyss mist
    const gg = g.createLinearGradient(0, H * 0.6, 0, H);
    gg.addColorStop(0, rgba(t.fog, 0.0));
    gg.addColorStop(1, rgba(t.sky[0], 0.85));
    g.fillStyle = gg;
    g.fillRect(0, H * 0.6, W, H * 0.4);
  };

  SCENES.field = function (g, t, r) {
    const sx = W * (0.7 + r() * 0.16), sy = H * 0.3;
    glow(g, sx, sy, Math.min(W, H) * 0.3, t.sun, 0.18);
    g.fillStyle = rgba(t.sun, 0.85);
    g.beginPath();
    g.arc(sx, sy, Math.min(W, H) * 0.055, 0, TAU);
    g.fill();
    for (let i = 0; i < 5; i++) {
      const y = H * (0.55 + i * 0.08);
      g.fillStyle = shade(t.horizon[0], 0.62 + i * 0.12);
      g.beginPath();
      g.moveTo(0, H);
      g.lineTo(0, y);
      for (let k = 0; k <= 5; k++) {
        g.quadraticCurveTo(W * (k + 0.5) / 5, y - H * (0.04 + (k % 2) * 0.02), W * (k + 1) / 5, y);
      }
      g.lineTo(W, H);
      g.closePath();
      g.fill();
    }
    // grass
    for (let i = 0; i < 90; i++) {
      const x = r() * W, y = H * (0.7 + r() * 0.28), h = 3 + r() * 12;
      g.strokeStyle = rgba(i % 4 ? t.accent : t.accent2, 0.12 + r() * 0.24);
      g.lineWidth = 1;
      g.beginPath();
      g.moveTo(x, y);
      g.quadraticCurveTo(x + (r() - 0.5) * 4, y - h * 0.6, x + (r() - 0.5) * 8, y - h);
      g.stroke();
    }
  };

  SCENES.arena = function (g, t, r) {
    // beams from behind the stage
    for (let i = 0; i < 5; i++) {
      const x = W * (0.12 + i * 0.19);
      const lg = g.createLinearGradient(x, H * 0.1, W / 2, H * 0.82);
      lg.addColorStop(0, rgba(i % 2 ? t.accent : t.accent2, 0.16));
      lg.addColorStop(1, rgba(i % 2 ? t.accent : t.accent2, 0));
      g.fillStyle = lg;
      g.beginPath();
      g.moveTo(x, H * 0.04);
      g.lineTo(W / 2 - W * 0.34, H * 0.86);
      g.lineTo(W / 2 + W * 0.34, H * 0.86);
      g.closePath();
      g.fill();
    }
    // truss
    g.strokeStyle = rgba(t.fog, 0.4);
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(0, H * 0.10);
    g.lineTo(W, H * 0.10);
    g.stroke();
    for (let x = 0; x < W; x += W / 9) {
      g.beginPath();
      g.moveTo(x, H * 0.08);
      g.lineTo(x + W / 18, H * 0.12);
      g.lineTo(x + W / 9, H * 0.08);
      g.stroke();
    }
    for (let i = 0; i < 8; i++) {
      glow(g, W * (0.08 + i * 0.12), H * 0.11, Math.min(W, H) * 0.028, i % 2 ? t.accent : t.accent2, 0.4);
    }
    // crowd silhouette
    const base = H * 0.9;
    g.fillStyle = '#050406';
    g.beginPath();
    g.moveTo(0, H);
    g.lineTo(0, base);
    for (let i = 0; i < 34; i++) {
      const x = (i / 34) * W;
      const h = H * (0.03 + r() * 0.05);
      g.lineTo(x, base - h);
      g.lineTo(x + W / 68, base - h * 0.3);
    }
    g.lineTo(W, base);
    g.lineTo(W, H);
    g.closePath();
    g.fill();
    // phone lights
    for (let i = 0; i < 26; i++) {
      g.fillStyle = rgba(i % 3 ? t.accent2 : '#ffffff', 0.25 + r() * 0.4);
      g.fillRect(r() * W, H * (0.86 + r() * 0.1), 2, 2);
    }
  };

  SCENES.void = function (g, t, r) {
    for (let i = 0; i < 5; i++) {
      glow(g, r() * W, r() * H * 0.7, Math.max(W, H) * (0.12 + r() * 0.16), i % 2 ? t.accent : t.accent2, 0.05);
    }
    for (let i = 0; i < 90; i++) {
      g.fillStyle = rgba(i % 4 ? t.sun : t.accent, 0.08 + r() * 0.35);
      g.fillRect(r() * W, r() * H * 0.82, r() < 0.15 ? 2 : 1, 1);
    }
    // distant gate
    const cx = W * 0.5, cy = H * 0.44, rad = Math.min(W, H) * 0.13;
    glow(g, cx, cy, rad * 2.1, t.accent2, 0.10);
    g.strokeStyle = rgba(t.accent2, 0.22);
    g.lineWidth = 2;
    g.beginPath();
    g.arc(cx, cy, rad, 0, TAU);
    g.stroke();
    g.beginPath();
    g.arc(cx, cy, rad * 0.7, 0, TAU);
    g.stroke();
  };

  // ------------------------------------------------------------- atmosphere
  function drawWeather(ctx, t, state) {
    const weather = (theme && theme.weather) || 'dust';
    const time = state.t || 0;
    const a0 = clamp(state.level || 0, 0, 1);
    const n = portrait ? 34 : 48;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < n; i++) {
      const h = hash32(seed + ':' + i + ':' + weather);
      const px0 = (h & 1023) / 1023;
      const py0 = ((h >>> 10) & 1023) / 1023;
      const spd = 0.2 + ((h >>> 20) & 255) / 255 * 0.9;
      let x, y, c = theme.accent;
      if (weather === 'rain') {
        x = ((px0 * W + time * (30 + spd * 60)) % (W + 40)) - 20;
        y = ((py0 * H + time * (280 + spd * 260)) % (H + 40)) - 20;
        ctx.strokeStyle = rgba(theme.accent2, 0.10 + 0.14 * spd);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x - 4, y + 14 + spd * 12);
        ctx.stroke();
        continue;
      }
      if (weather === 'snow' || weather === 'ash' || weather === 'dust') {
        x = (px0 * W + Math.sin(time * 0.4 + i) * 18 + time * 8 * spd) % W;
        y = (py0 * H + time * (10 + spd * 20)) % H;
        c = weather === 'ash' ? theme.fog : (weather === 'snow' ? '#ffffff' : theme.sun);
        const s = 1 + ((h >>> 28) & 1);
        ctx.fillStyle = rgba(c, (0.10 + 0.25 * spd) * (0.5 + a0 * 0.5));
        ctx.fillRect(x, y, s, s);
        continue;
      }
      if (weather === 'embers' || weather === 'sparks') {
        x = (px0 * W + Math.sin(time * 0.8 + i * 0.7) * 20) % W;
        y = H - ((py0 * H + time * (36 + spd * 70)) % (H + 40));
        c = i % 3 ? theme.accent2 : theme.accent;
        ctx.fillStyle = rgba(c, (0.18 + 0.38 * spd) * (0.5 + a0 * 0.5));
        ctx.fillRect(x, y, 2, 2);
        if (spd > 0.82) {
          ctx.fillRect(x - 1, y + 2, 1, 1);
          ctx.fillRect(x + 1, y + 4, 1, 1);
        }
        continue;
      }
      if (weather === 'leaves' || weather === 'petals') {
        x = (px0 * W + time * (12 + spd * 28)) % (W + 30) - 15;
        y = (py0 * H + time * (16 + spd * 26)) % (H + 30) - 15;
        c = i % 3 ? theme.accent : theme.accent2;
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(time * 0.8 + i);
        ctx.fillStyle = rgba(c, (0.15 + 0.25 * spd) * (0.5 + a0 * 0.5));
        if (weather === 'petals') {
          ctx.beginPath();
          ctx.ellipse(0, 0, 3, 1.6, 0, 0, TAU);
          ctx.fill();
        } else {
          ctx.fillRect(-2, -1, 5, 2);
        }
        ctx.restore();
        continue;
      }
      if (weather === 'glyphs' || weather === 'data') {
        x = (px0 * W + Math.sin(time * 0.5 + i) * 8) % W;
        y = (py0 * H + time * (20 + spd * 40)) % H;
        c = i % 2 ? theme.accent : theme.accent2;
        ctx.fillStyle = rgba(c, (0.10 + 0.26 * spd) * (0.4 + a0 * 0.6));
        if (weather === 'glyphs' && i % 3 === 0) {
          ctx.font = Math.round(8 + spd * 7) + 'px monospace';
          ctx.fillText(String.fromCharCode(0x30A0 + (h % 90)), x, y);
        } else {
          ctx.fillRect(x, y, 2 + ((h >>> 26) & 3), 2);
        }
        continue;
      }
      if (weather === 'bubbles') {
        x = (px0 * W + Math.sin(time * 0.6 + i) * 16) % W;
        y = H - ((py0 * H + time * (18 + spd * 34)) % (H + 40));
        ctx.strokeStyle = rgba(theme.accent2, (0.10 + 0.20 * spd) * (0.5 + a0 * 0.5));
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(x, y, 2 + spd * 4, 0, TAU);
        ctx.stroke();
        continue;
      }
      if (weather === 'confetti') {
        x = (px0 * W + Math.sin(time * 0.7 + i * 2) * 12) % W;
        y = (py0 * H + time * (22 + spd * 34)) % (H + 30) - 15;
        c = [theme.accent, theme.accent2, theme.sun][h % 3];
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(time * 1.6 + i);
        ctx.fillStyle = rgba(c, (0.18 + 0.30 * spd) * (0.5 + a0 * 0.5));
        ctx.fillRect(-2, -1, 4, 2);
        ctx.restore();
        continue;
      }
      if (weather === 'speed') {
        x = ((px0 * W + time * (90 + spd * 160)) % (W + 80)) - 40;
        y = py0 * H * 0.86;
        ctx.fillStyle = rgba(i % 2 ? theme.accent2 : theme.accent, (0.08 + 0.18 * spd) * (0.4 + a0 * 0.6));
        ctx.fillRect(x, y, 10 + spd * 40, 1);
        continue;
      }
      // stars / fireflies
      x = px0 * W;
      y = py0 * H * 0.85;
      const tw = 0.5 + 0.5 * Math.sin(time * (0.6 + spd) + i);
      ctx.fillStyle = rgba(i % 3 ? theme.accent : theme.accent2, (0.10 + 0.45 * spd) * (0.4 + tw * 0.6));
      ctx.fillRect(x, y, 2, 2);
    }
    ctx.restore();
  }

  // ------------------------------------------------------------------ world
  function drawWorld(ctx, state) {
    if (!theme) return;
    if (!bg) rebuild();
    const t = state.t || 0;
    const level = clamp(state.level || 0, 0, 1);
    const beat = state.beatPulse || 0;
    const bar = state.downPulse || 0;
    const fever = state.fever || 0;
    const shake = state.shake || 0;

    ctx.save();
    ctx.globalAlpha = 1;
    if (shake > 0.01) {
      const s = shake * Math.min(W, H) * 0.007;
      ctx.translate(Math.sin(t * 71) * s, Math.cos(t * 63) * s);
    }
    ctx.drawImage(bg, 0, 0, W, H);

    // twinkling sky points
    if (theme.scene === 'space' || theme.scene === 'void' || theme.scene === 'forest') {
      for (let i = 0; i < stars.length; i++) {
        const s = stars[i];
        const a = 0.10 + 0.5 * (0.5 + 0.5 * Math.sin(t * s.sp + s.p)) * (0.4 + level * 0.6);
        ctx.fillStyle = rgba(i % 5 ? theme.accent2 : '#ffffff', a);
        ctx.fillRect(s.x, s.y, s.s, s.s);
      }
    }

    drawWeather(ctx, t, state);

    // horizon pulse
    const hx = W / 2, hy = H * 0.62;
    glow(ctx, hx, hy, Math.min(W, H) * (0.5 + beat * 0.1), theme.accent, 0.028 + level * 0.05 + beat * 0.03);

    drawLanes(ctx, state, t, level, beat, bar, fever);
    drawNotes(ctx, state, t);
    drawParticles(ctx, state.particles || []);
    drawRings(ctx, state.rings || []);

    if (fever > 0.001) {
      const a = 0.06 + 0.04 * Math.sin(t * 6);
      ctx.strokeStyle = rgba(theme.sun, a + fever * 0.08);
      ctx.lineWidth = Math.max(2, Math.min(W, H) * 0.006);
      ctx.strokeRect(ctx.lineWidth / 2, ctx.lineWidth / 2, W - ctx.lineWidth, H - ctx.lineWidth);
    }
    if (state.swell > 0.001) {
      ctx.fillStyle = rgba(theme.fog, state.swell * 0.30);
      ctx.fillRect(0, 0, W, H);
    }
    if (state.flash > 0.001) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = rgba(theme.sun, state.flash * 0.30);
      ctx.fillRect(0, 0, W, H);
      ctx.globalCompositeOperation = 'source-over';
    }
    if (state.fade > 0.001) {
      ctx.fillStyle = 'rgba(0,0,0,' + clamp(state.fade, 0, 1) * 0.75 + ')';
      ctx.fillRect(0, 0, W, H);
    }
    ctx.restore();
  }

  function drawLanes(ctx, state, t, level, beat, bar, fever) {
    const pulse = state.lanePulse || [0, 0, 0, 0];
    const top = H * 0.05;
    const bottom = HIT_Y + Math.min(H * 0.10, 70);

    // playfield scrim
    const fieldW = laneSpan + laneGap * 0.9;
    const fx = W / 2 - fieldW / 2;
    const fg = ctx.createLinearGradient(0, top, 0, bottom);
    fg.addColorStop(0, 'rgba(0,0,0,0.16)');
    fg.addColorStop(0.72, 'rgba(0,0,0,0.28)');
    fg.addColorStop(1, 'rgba(0,0,0,0.10)');
    ctx.fillStyle = fg;
    ctx.fillRect(fx, top, fieldW, bottom - top);

    // moving beat lines
    const spd = (HIT_Y - SPAWN_Y) / TRAVEL;
    const beatLen = state.beat || 0.42;
    const phase = ((t % beatLen) / beatLen);
    ctx.strokeStyle = rgba(theme.accent, 0.055 + level * 0.06);
    ctx.lineWidth = 1;
    for (let i = 0; i < 7; i++) {
      const y = HIT_Y - (phase + i) * beatLen * spd;
      if (y < top || y > HIT_Y) continue;
      ctx.beginPath();
      ctx.moveTo(fx + 6, y);
      ctx.lineTo(fx + fieldW - 6, y);
      ctx.stroke();
    }

    for (let i = 0; i < 4; i++) {
      const x = LANE_X[i];
      const col = theme.lane[i] || theme.accent;
      const p = pulse[i] || 0;

      // lane column
      const lg = ctx.createLinearGradient(0, top, 0, HIT_Y);
      lg.addColorStop(0, rgba(col, 0.0));
      lg.addColorStop(0.55, rgba(col, 0.025 + p * 0.08 + beat * 0.02));
      lg.addColorStop(1, rgba(col, 0.06 + p * 0.14 + beat * 0.03));
      ctx.fillStyle = lg;
      ctx.fillRect(x - laneGap * 0.40, top, laneGap * 0.80, HIT_Y - top);

      // separator lines
      if (i < 3) {
        const sx = x + laneGap / 2;
        ctx.strokeStyle = rgba(col, 0.06);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(sx, top + 10);
        ctx.lineTo(sx, HIT_Y - 8);
        ctx.stroke();
      }

      // hit pad
      const hy = HIT_Y;
      const r = hitR * (1 + bar * 0.14 + p * 0.26);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      glow(ctx, x, hy, r * 2.6, col, 0.10 + p * 0.18 + beat * 0.04 + fever * 0.06);
      ctx.restore();

      ctx.strokeStyle = rgba(col, 0.30 + p * 0.5 + beat * 0.1);
      ctx.lineWidth = Math.max(2, laneGap * 0.022);
      ctx.beginPath();
      ctx.arc(x, hy, r, 0, TAU);
      ctx.stroke();

      ctx.fillStyle = rgba(col, 0.05 + p * 0.12);
      ctx.beginPath();
      ctx.arc(x, hy, r * 0.72, 0, TAU);
      ctx.fill();

      // inner key mark
      ctx.strokeStyle = rgba(col, 0.5 + p * 0.5);
      ctx.lineWidth = Math.max(1.5, laneGap * 0.012);
      ctx.beginPath();
      if (i % 2 === 0) {
        ctx.moveTo(x - r * 0.26, hy - r * 0.26);
        ctx.lineTo(x + r * 0.26, hy + r * 0.26);
      } else {
        ctx.moveTo(x + r * 0.26, hy - r * 0.26);
        ctx.lineTo(x - r * 0.26, hy + r * 0.26);
      }
      ctx.stroke();

      const key = (state.laneKeys && state.laneKeys[i]) || ['D', 'F', 'J', 'K'][i];
      ctx.fillStyle = rgba(col, 0.72 + p * 0.28);
      ctx.font = Math.round(Math.max(10, laneGap * 0.11)) + 'px Tiny5, monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(key, x, hy + r + Math.max(6, laneGap * 0.08));
    }

    // judgement line glow
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const lg2 = ctx.createLinearGradient(fx, 0, fx + fieldW, 0);
    lg2.addColorStop(0, rgba(theme.accent, 0));
    lg2.addColorStop(0.5, rgba(theme.sun, 0.16 + level * 0.12 + bar * 0.10));
    lg2.addColorStop(1, rgba(theme.accent, 0));
    ctx.fillStyle = lg2;
    ctx.fillRect(fx, HIT_Y - 1, fieldW, 2);
    ctx.restore();
  }

  function drawNotes(ctx, state, t) {
    const notes = state.notes || [];
    const spd = (HIT_Y - SPAWN_Y) / TRAVEL;
    for (let i = 0; i < notes.length; i++) {
      const n = notes[i];
      const dn = n.t - t;
      if (dn > TRAVEL + 0.3 || dn < -0.25) continue;
      const x = LANE_X[n.l];
      if (x === undefined) continue;
      const y = HIT_Y - dn * spd;
      if (y < SPAWN_Y - 40 || y > HIT_Y + 18) continue;
      const col = (theme.lane[n.l] || theme.accent);
      const appear = clamp((TRAVEL + 0.25 - dn) / 0.3, 0, 1) * clamp((dn + 0.25) / 0.25, 0, 1);
      const w = noteW * (n.w || 1);
      const h = noteH;
      const hot = dn < 0.22 ? 1 : 0;

      // trail
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const trail = ctx.createLinearGradient(0, y - h * 1.8, 0, y + h);
      trail.addColorStop(0, rgba(col, 0));
      trail.addColorStop(0.75, rgba(col, 0.10 + hot * 0.14));
      trail.addColorStop(1, rgba(col, 0.26 + hot * 0.2));
      ctx.fillStyle = trail;
      ctx.fillRect(x - w * 0.42, y - h * 1.8, w * 0.84, h * 2.8);
      glow(ctx, x, y, w * (0.9 + hot * 0.25), col, (0.10 + hot * 0.10) * appear);
      ctx.restore();

      // body
      ctx.save();
      ctx.globalAlpha = appear;
      const body = ctx.createLinearGradient(0, y - h / 2, 0, y + h / 2);
      body.addColorStop(0, rgba(theme.sun, 0.72));
      body.addColorStop(0.28, rgba(col, 0.96));
      body.addColorStop(1, shade(col, 0.62));
      ctx.fillStyle = body;
      rr(ctx, x - w / 2, y - h / 2, w, h, h * 0.42);
      ctx.fill();
      // top highlight
      ctx.fillStyle = rgba('#ffffff', 0.32);
      rr(ctx, x - w * 0.32, y - h * 0.34, w * 0.64, Math.max(1.5, h * 0.14), h * 0.1);
      ctx.fill();
      // side ticks
      ctx.fillStyle = rgba(theme.sun, 0.75);
      ctx.fillRect(x - w / 2 + 2, y - h * 0.28, 2, h * 0.56);
      ctx.fillRect(x + w / 2 - 4, y - h * 0.28, 2, h * 0.56);
      ctx.restore();
    }
  }

  function drawParticles(ctx, particles) {
    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      const a = clamp(p.life / p.maxLife, 0, 1);
      if (a <= 0) continue;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = a * (p.alpha || 0.9);
      ctx.fillStyle = p.color;
      if (p.kind === 'ringlet') {
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * 2, 0, TAU);
        ctx.stroke();
      } else if (p.kind === 'spark') {
        ctx.fillRect(p.x - p.size, p.y - p.size, p.size * 2, p.size * 2);
      } else if (p.kind === 'leaf') {
        ctx.translate(p.x, p.y);
        ctx.rotate(p.life * 2 + (p.spin || 0));
        ctx.fillRect(-p.size * 1.5, -p.size * 0.5, p.size * 3, p.size);
      } else {
        ctx.fillRect(p.x, p.y, p.size, p.size);
      }
      ctx.restore();
    }
  }

  function drawRings(ctx, rings) {
    for (let i = 0; i < rings.length; i++) {
      const r = rings[i];
      const a = clamp(r.life / r.maxLife, 0, 1);
      if (a <= 0) continue;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = rgba(r.color, a * 0.72);
      ctx.lineWidth = Math.max(1, (r.wide ? 3 : 1.5) * a + 0.5);
      ctx.beginPath();
      ctx.arc(r.x, r.y, r.r, 0, TAU);
      ctx.stroke();
      if (r.wide) {
        ctx.strokeStyle = rgba(r.color, a * 0.24);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(r.x, r.y, r.r * 0.72, 0, TAU);
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  window.RhythmArt = Art;
})();
