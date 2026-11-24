/* «Клетчатый лист» — процедурная карандашная графика на Canvas 2D.
   Никаких растровых ассетов: бумага, штриховка, героиня, птенец и сердце
   рисуются кодом. Все функции детерминированы по seed, поэтому линии
   не «дрожат» между кадрами. */
(function () {
  'use strict';

  const C = window.PaperLevels.COLORS;

  // ---------- randomness & helpers ----------
  function mulberry32(a) {
    return function () {
      a |= 0;
      a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function seedFor(zone, x, y, salt) {
    return ((zone + 1) * 73856093) ^ ((x + 11) * 19349663) ^ ((y + 17) * 83492791) ^ ((salt || 0) * 2654435761);
  }

  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;

  // Множитель прозрачности для целой группы штрихов (используется
  // для плавного проявления декора по мере исследования клеток).
  let alphaScale = 1;
  function setAlpha(ctx, v) {
    ctx.globalAlpha = clamp(v * alphaScale, 0, 1);
  }
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = t => {
    t = clamp(t, 0, 1);
    return t * t * (3 - 2 * t);
  };

  function roughLine(ctx, x1, y1, x2, y2, seed, opts) {
    opts = opts || {};
    const rng = mulberry32(seed | 0);
    const dx = x2 - x1, dy = y2 - y1;
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len, ny = dx / len;
    const passes = opts.passes == null ? 2 : opts.passes;
    const amp = opts.amp == null ? 0.65 : opts.amp;
    const color = opts.color || C.graphite;
    const alpha = opts.alpha == null ? 0.55 : opts.alpha;
    const width = opts.width == null ? 1.05 : opts.width;
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (let p = 0; p < passes; p++) {
      const steps = Math.max(2, Math.ceil(len / 8));
      ctx.beginPath();
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const env = Math.sin(Math.PI * t);
        const off = (rng() - 0.5) * 2 * amp * env + (p ? (p % 2 ? 0.7 : -0.7) : 0);
        const x = x1 + dx * t + nx * off;
        const y = y1 + dy * t + ny * off;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      setAlpha(ctx, alpha * (p ? 0.45 : 1));
      ctx.lineWidth = width * (p ? 0.7 : 1);
      ctx.stroke();
    }
    ctx.restore();
  }

  function partLine(ctx, x1, y1, x2, y2, f, seed, opts) {
    if (f <= 0) return;
    if (f >= 1) {
      roughLine(ctx, x1, y1, x2, y2, seed, opts);
      return;
    }
    roughLine(ctx, x1, y1, x1 + (x2 - x1) * f, y1 + (y2 - y1) * f, seed, opts);
  }

  function roughEllipse(ctx, cx, cy, rx, ry, seed, opts) {
    opts = opts || {};
    const rng = mulberry32(seed | 0);
    const color = opts.color || C.graphite;
    const alpha = opts.alpha == null ? 0.55 : opts.alpha;
    const width = opts.width == null ? 1.05 : opts.width;
    const amp = opts.amp == null ? 0.8 : opts.amp;
    const passes = opts.passes == null ? 2 : opts.passes;
    const steps = opts.steps || Math.max(22, Math.round((rx + ry) * 0.9));
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.lineCap = 'round';
    for (let p = 0; p < passes; p++) {
      ctx.beginPath();
      for (let i = 0; i <= steps; i++) {
        const a = (i / steps) * Math.PI * 2;
        const j = (rng() - 0.5) * amp * 2;
        const x = cx + Math.cos(a) * (rx + j);
        const y = cy + Math.sin(a) * (ry + j);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      setAlpha(ctx, alpha * (p ? 0.45 : 1));
      ctx.stroke();
    }
    ctx.restore();
  }

  function hatchRect(ctx, x, y, w, h, seed, opts) {
    opts = opts || {};
    const rng = mulberry32(seed | 0);
    const spacing = Math.max(3, opts.spacing || 5);
    const alpha = opts.alpha == null ? 0.07 : opts.alpha;
    const color = opts.color || C.graphite;
    const dir = opts.dir || 1;
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();
    ctx.beginPath();
    const start = -h - (rng() * spacing);
    for (let i = start; i < w + h; i += spacing) {
      if (dir >= 0) {
        ctx.moveTo(x + i, y);
        ctx.lineTo(x + i + h, y + h);
      } else {
        ctx.moveTo(x + i, y + h);
        ctx.lineTo(x + i + h, y);
      }
    }
    ctx.strokeStyle = color;
    setAlpha(ctx, alpha);
    ctx.lineWidth = opts.width || 0.65;
    ctx.stroke();
    ctx.restore();
  }

  function dot(ctx, x, y, r, color, alpha) {
    ctx.save();
    setAlpha(ctx, alpha == null ? 1 : alpha);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // ---------- paper ----------
  let paperPattern = null;

  function getPaperPattern(ctx) {
    if (paperPattern) return paperPattern;
    const c = document.createElement('canvas');
    c.width = c.height = 96;
    const g = c.getContext('2d');
    const rng = mulberry32(71423);
    for (let i = 0; i < 150; i++) {
      g.fillStyle = 'rgba(88, 82, 68, ' + (0.018 + rng() * 0.05).toFixed(3) + ')';
      const x = (rng() * 96) | 0;
      const y = (rng() * 96) | 0;
      g.fillRect(x, y, rng() > 0.82 ? 2 : 1, 1);
    }
    for (let i = 0; i < 14; i++) {
      g.strokeStyle = 'rgba(120, 112, 94, ' + (0.018 + rng() * 0.025).toFixed(3) + ')';
      g.lineWidth = 0.6;
      g.beginPath();
      const x = rng() * 96, y = rng() * 96;
      g.moveTo(x, y);
      g.quadraticCurveTo(x + 8 + rng() * 14, y + (rng() - 0.5) * 3, x + 20 + rng() * 20, y + (rng() - 0.5) * 4);
      g.stroke();
    }
    paperPattern = ctx.createPattern(c, 'repeat');
    return paperPattern;
  }

  function drawPaper(ctx, w, h, layout, zone, page) {
    const cell = layout.cell;
    ctx.save();
    ctx.fillStyle = zone.paper || C.paper;
    ctx.fillRect(0, 0, w, h);

    // бумажные волокна
    const pat = getPaperPattern(ctx);
    if (pat) {
      setAlpha(ctx, 0.9);
      ctx.fillStyle = pat;
      ctx.fillRect(0, 0, w, h);
    }
    ctx.restore();

    // сетка на весь лист, выровненная по игровому полю
    const ox = layout.ox, oy = layout.oy;
    const kx0 = Math.floor((0 - ox) / cell);
    const kx1 = Math.ceil((w - ox) / cell);
    const ky0 = Math.floor((0 - oy) / cell);
    const ky1 = Math.ceil((h - oy) / cell);

    ctx.save();
    ctx.lineWidth = 1;
    for (let k = kx0; k <= kx1; k++) {
      const x = Math.round(ox + k * cell) + 0.5;
      const major = k % 5 === 0;
      ctx.strokeStyle = major ? C.gridMajor : C.grid;
      setAlpha(ctx, major ? 0.55 : 0.42);
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    for (let k = ky0; k <= ky1; k++) {
      const y = Math.round(oy + k * cell) + 0.5;
      const major = k % 5 === 0;
      ctx.strokeStyle = major ? C.gridMajor : C.grid;
      setAlpha(ctx, major ? 0.55 : 0.42);
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }
    ctx.restore();

    // красная линия поля
    const marginX = ox - Math.max(10, cell * 0.52);
    if (marginX > 10) {
      ctx.save();
      ctx.strokeStyle = C.redSoft;
      setAlpha(ctx, 0.22);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(Math.round(marginX) + 0.5, 0);
      ctx.lineTo(Math.round(marginX) + 0.5, h);
      ctx.stroke();
      setAlpha(ctx, 0.10);
      ctx.beginPath();
      ctx.moveTo(Math.round(marginX) + 3.5, 0);
      ctx.lineTo(Math.round(marginX) + 3.5, h);
      ctx.stroke();
      ctx.restore();
    }

    // подпись страницы
    const pageText = page || zone.page;
    if (pageText) {
      const fs = clamp(cell * 0.17, 9, 13);
      ctx.save();
      ctx.font = fs + 'px Georgia, "Times New Roman", serif';
      ctx.fillStyle = C.graphiteFaint;
      setAlpha(ctx, 0.55);
      ctx.textAlign = 'right';
      ctx.textBaseline = 'top';
      ctx.fillText(pageText, ox + layout.cols * cell - 2, oy + layout.rows * cell + 6);
      ctx.restore();
    }

    // заметка на полях
    if (zone.marginNote && ox > 46) {
      const fs = clamp(cell * 0.16, 9, 12);
      ctx.save();
      ctx.translate(ox - Math.max(16, cell * 0.72), oy + layout.rows * cell - 8);
      ctx.rotate(-Math.PI / 2);
      ctx.font = 'italic ' + fs + 'px Georgia, "Times New Roman", serif';
      ctx.fillStyle = C.graphiteFaint;
      setAlpha(ctx, 0.48);
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(zone.marginNote, 0, 0);
      ctx.restore();
    }

    // лёгкая тень листа у краёв
    ctx.save();
    const g = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.25, w / 2, h / 2, Math.max(w, h) * 0.75);
    g.addColorStop(0, 'rgba(70,62,48,0)');
    g.addColorStop(1, 'rgba(70,62,48,0.10)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  }

  // ---------- cells ----------
  function cellRect(layout, gx, gy) {
    return {
      x: layout.ox + gx * layout.cell,
      y: layout.oy + gy * layout.cell,
      w: layout.cell,
      h: layout.cell,
      cx: layout.ox + (gx + 0.5) * layout.cell,
      cy: layout.oy + (gy + 0.5) * layout.cell
    };
  }

  function drawCell(ctx, zone, gx, gy, layout, reveal, zoneIndex) {
    const r = cellRect(layout, gx, gy);
    const p = smooth(reveal);
    if (p <= 0.001) return;
    const seed = seedFor(zoneIndex, gx, gy, 1);
    const inner = Math.max(1.5, r.w * 0.045);

    // заливка «ожившей» клетки
    ctx.save();
    setAlpha(ctx, 0.58 * p);
    ctx.fillStyle = C.white;
    ctx.fillRect(r.x + inner, r.y + inner, r.w - inner * 2, r.h - inner * 2);
    ctx.restore();

    // лёгкая штриховка
    if (p > 0.25) {
      hatchRect(ctx, r.x + inner + 2, r.y + inner + 2, r.w - inner * 2 - 4, r.h - inner * 2 - 4, seed, {
        spacing: clamp(r.w * 0.075, 3.5, 6.5),
        alpha: 0.06 * ((p - 0.25) / 0.75),
        dir: (gx + gy) % 2 ? 1 : -1
      });
    }

    // рамка рисуется по мере появления клетки
    const x1 = r.x + inner, y1 = r.y + inner;
    const x2 = r.x + r.w - inner, y2 = r.y + r.h - inner;
    const side = (p * 4);
    const col = C.graphiteSoft;
    const o = { color: col, alpha: 0.52, width: 1.05, amp: 0.55 };
    partLine(ctx, x1, y1, x2, y1, clamp(side, 0, 1), seed + 11, o);
    partLine(ctx, x2, y1, x2, y2, clamp(side - 1, 0, 1), seed + 23, o);
    partLine(ctx, x2, y2, x1, y2, clamp(side - 2, 0, 1), seed + 37, o);
    partLine(ctx, x1, y2, x1, y1, clamp(side - 3, 0, 1), seed + 41, o);

    // лёгкий второй контур, будто карандаш прошёлся по рамке ещё раз
    if (p > 0.8) {
      const q = 0.16 * ((p - 0.8) / 0.2);
      const o2 = { color: C.graphiteSoft, alpha: 0.35 * q, width: 0.7, amp: 1.1, passes: 1 };
      const ix = inner + 0.9, iy = inner + 0.6;
      roughLine(ctx, r.x + ix, r.y + iy, r.x + r.w - ix, r.y + iy + 0.4, seed + 61, o2);
      roughLine(ctx, r.x + r.w - ix, r.y + iy, r.x + r.w - ix + 0.4, r.y + r.h - iy, seed + 62, o2);
      roughLine(ctx, r.x + r.w - ix, r.y + r.h - iy, r.x + ix, r.y + r.h - iy + 0.3, seed + 63, o2);
      roughLine(ctx, r.x + ix, r.y + r.h - iy, r.x + ix - 0.3, r.y + iy, seed + 64, o2);
    }

    // тематический декор клетки
    const theme = zone.theme;
    ctx.save();
    setAlpha(ctx, p);
    if (theme === 'garden') {
      const s = r.w * 0.07;
      drawTinyHeart(ctx, r.cx + Math.sin(seed) * r.w * 0.18, r.cy + Math.cos(seed * 0.7) * r.h * 0.16, s, seed);
      const stemX = r.cx + Math.cos(seed) * r.w * 0.18;
      roughLine(ctx, stemX, r.cy + r.h * 0.22, stemX, r.cy + r.h * 0.02, seed + 9, {
        color: C.graphiteSoft, alpha: 0.3, width: 0.7, amp: 1.2, passes: 1
      });
    } else if (theme === 'tower') {
      ctx.save();
      setAlpha(ctx, 0.13 * p);
      ctx.strokeStyle = C.graphiteSoft;
      ctx.lineWidth = 0.8;
      for (let i = 1; i <= 3; i++) {
        const yy = r.y + r.h * (i / 4);
        ctx.beginPath();
        ctx.moveTo(r.x + r.w * 0.16, yy);
        ctx.lineTo(r.x + r.w * 0.84, yy);
        ctx.stroke();
      }
      ctx.restore();
    } else if (theme === 'plain') {
      // редкие точки бумаги
      if ((gx * 7 + gy * 13) % 5 === 0) {
        dot(ctx, r.cx + r.w * 0.14, r.cy - r.h * 0.17, 0.7, C.graphiteFaint, 0.3 * p);
      }
    }
    ctx.restore();
  }

  // ---------- paths between cells ----------
  function drawConnections(ctx, zone, visited, reveals, layout, zoneIndex) {
    if (zone.theme !== 'path' && zone.theme !== 'bridge') return;
    const cell = layout.cell;
    const isVisited = (x, y) => visited.has(x + ',' + y);
    const revealOf = (x, y) => reveals[x + ',' + y] == null ? 1 : reveals[x + ',' + y];

    visited.forEach(key => {
      const parts = key.split(',');
      const x = +parts[0], y = +parts[1];
      const dirs = [[1, 0], [0, 1]];
      dirs.forEach((d, di) => {
        const nx = x + d[0], ny = y + d[1];
        if (!isVisited(nx, ny)) return;
        if (nx >= zone.cols || ny >= zone.rows) return;
        const a = cellRect(layout, x, y);
        const b = cellRect(layout, nx, ny);
        const alpha = Math.min(revealOf(x, y), revealOf(nx, ny));
        const seed = seedFor(zoneIndex, x, y, 50 + di);
        ctx.save();
        setAlpha(ctx, alpha);
        if (zone.theme === 'bridge') {
          drawBridge(ctx, a.cx, a.cy, b.cx, b.cy, cell, seed, alpha);
        } else {
          drawTrail(ctx, a.cx, a.cy, b.cx, b.cy, cell, seed, alpha);
        }
        ctx.restore();
      });
    });
  }

  function drawTrail(ctx, x1, y1, x2, y2, cell, seed, alpha) {
    roughLine(ctx, x1, y1, x2, y2, seed, {
      color: C.graphiteSoft, alpha: 0.30 * alpha, width: 1.0, amp: cell * 0.018, passes: 1
    });
    const rng = mulberry32(seed + 3);
    const n = Math.max(2, Math.round(cell / 18));
    const dx = x2 - x1, dy = y2 - y1;
    for (let i = 1; i < n; i++) {
      const t = i / n;
      const x = x1 + dx * t + (rng() - 0.5) * cell * 0.18;
      const y = y1 + dy * t + (rng() - 0.5) * cell * 0.18;
      dot(ctx, x, y, Math.max(0.6, cell * 0.014), C.graphiteSoft, 0.24 * alpha);
    }
  }

  function drawBridge(ctx, x1, y1, x2, y2, cell, seed, alpha) {
    const dx = x2 - x1, dy = y2 - y1;
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len, ny = dx / len;
    const off = cell * 0.16;
    const ax = x1 + nx * off, ay = y1 + ny * off;
    const bx = x2 + nx * off, by = y2 + ny * off;
    const cx = x1 - nx * off, cy = y1 - ny * off;
    const dx2 = x2 - nx * off, dy2 = y2 - ny * off;
    const o = { color: C.graphiteSoft, alpha: 0.33 * alpha, width: 0.95, amp: cell * 0.012, passes: 1 };
    roughLine(ctx, ax, ay, bx, by, seed, o);
    roughLine(ctx, cx, cy, dx2, dy2, seed + 7, o);

    const planks = Math.max(3, Math.round(cell / 16));
    ctx.save();
    ctx.strokeStyle = C.graphiteSoft;
    setAlpha(ctx, 0.22 * alpha);
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    for (let i = 1; i < planks; i++) {
      const t = i / planks;
      const mx = x1 + dx * t;
      const my = y1 + dy * t;
      ctx.moveTo(mx + nx * off, my + ny * off);
      ctx.lineTo(mx - nx * off, my - ny * off);
    }
    ctx.stroke();
    ctx.restore();
  }

  // ---------- decorative objects ----------
  function drawDecor(ctx, item, layout, strength, time, zoneIndex) {
    if (strength <= 0.001) return;
    const cell = layout.cell;
    const r = cellRect(layout, item.x, item.y);
    const prevScale = alphaScale;
    alphaScale = clamp(strength, 0, 1);
    ctx.save();
    try {
      switch (item.type) {
        case 'sprout': drawSprout(ctx, r.cx, r.cy, cell, zoneIndex + item.x * 3 + item.y * 7); break;
        case 'waves': drawWaves(ctx, r.cx, r.cy, cell * (item.w || 3), cell, zoneIndex); break;
        case 'table': drawTable(ctx, r.cx, r.cy, cell * (item.w || 2), cell); break;
        case 'chair': drawChair(ctx, r.cx, r.cy, cell); break;
        case 'cup': drawCup(ctx, r.cx, r.cy, cell, time); break;
        case 'rug': drawRug(ctx, r.cx, r.cy, cell * (item.w || 2), cell * (item.h || 2)); break;
        case 'sun': drawSun(ctx, r.cx, r.cy, cell, time); break;
        case 'flag': drawFlag(ctx, r.cx, r.cy, cell, time); break;
        case 'feather': drawFeather(ctx, r.cx, r.cy, cell, time); break;
        default: break;
      }
    } finally {
      alphaScale = prevScale;
      ctx.restore();
    }
  }

  function drawSprout(ctx, cx, cy, cell, seed) {
    const h = cell * 0.34;
    roughLine(ctx, cx, cy + h * 0.55, cx, cy - h * 0.55, seed, {
      color: C.graphiteSoft, alpha: 0.46, width: 0.9, amp: 0.6, passes: 1
    });
    for (let s = -1; s <= 1; s += 2) {
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(cx, cy - h * 0.1);
      ctx.quadraticCurveTo(cx + s * h * 0.75, cy - h * 0.55, cx + s * h * 0.95, cy - h * 0.1);
      ctx.quadraticCurveTo(cx + s * h * 0.55, cy + h * 0.05, cx, cy - h * 0.1);
      ctx.fillStyle = 'rgba(240, 248, 230, ' + (0.5 * alphaScale).toFixed(3) + ')';
      ctx.fill();
      ctx.strokeStyle = C.graphiteSoft;
      setAlpha(ctx, 0.48);
      ctx.lineWidth = 0.8;
      ctx.stroke();
      ctx.restore();
    }
  }

  function drawWaves(ctx, cx, cy, w, cell, seed) {
    for (let row = 0; row < 2; row++) {
      const y = cy + row * cell * 0.18;
      ctx.save();
      ctx.beginPath();
      ctx.strokeStyle = C.graphiteSoft;
      setAlpha(ctx, 0.26 - row * 0.07);
      ctx.lineWidth = 0.8;
      const left = cx - w / 2;
      const steps = 18;
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const x = left + w * t;
        const yy = y + Math.sin(t * Math.PI * 8 + seed) * cell * 0.035;
        if (i === 0) ctx.moveTo(x, yy);
        else ctx.lineTo(x, yy);
      }
      ctx.stroke();
      ctx.restore();
    }
  }

  function drawTable(ctx, cx, cy, w, cell) {
    const h = cell * 0.56;
    const topY = cy - h * 0.18;
    roughLine(ctx, cx - w / 2, topY, cx + w / 2, topY, 901, { color: C.graphiteSoft, alpha: 0.5, width: 1.0, amp: 0.7 });
    roughLine(ctx, cx - w / 2, topY + cell * 0.08, cx + w / 2, topY + cell * 0.08, 902, { color: C.graphiteSoft, alpha: 0.32, width: 0.8, amp: 0.6, passes: 1 });
    const leg = cell * 0.42;
    roughLine(ctx, cx - w * 0.38, topY, cx - w * 0.38, topY + leg, 903, { color: C.graphiteSoft, alpha: 0.48, width: 0.9, amp: 0.5, passes: 1 });
    roughLine(ctx, cx + w * 0.38, topY, cx + w * 0.38, topY + leg, 904, { color: C.graphiteSoft, alpha: 0.48, width: 0.9, amp: 0.5, passes: 1 });
  }

  function drawChair(ctx, cx, cy, cell) {
    const s = cell * 0.34;
    roughLine(ctx, cx - s * 0.7, cy - s * 1.2, cx - s * 0.7, cy + s * 0.9, 911, { color: C.graphiteSoft, alpha: 0.48, width: 0.9, amp: 0.5, passes: 1 });
    roughLine(ctx, cx - s * 0.7, cy - s * 1.2, cx + s * 0.5, cy - s * 1.3, 912, { color: C.graphiteSoft, alpha: 0.42, width: 0.8, amp: 0.5, passes: 1 });
    roughLine(ctx, cx - s * 0.7, cy + s * 0.1, cx + s * 0.9, cy + s * 0.1, 913, { color: C.graphiteSoft, alpha: 0.48, width: 0.9, amp: 0.5 });
    roughLine(ctx, cx + s * 0.6, cy - s * 1.2, cx + s * 0.9, cy + s * 0.1, 914, { color: C.graphiteSoft, alpha: 0.42, width: 0.8, amp: 0.5, passes: 1 });
    roughLine(ctx, cx + s * 0.9, cy + s * 0.1, cx + s * 0.9, cy + s * 0.9, 915, { color: C.graphiteSoft, alpha: 0.48, width: 0.9, amp: 0.5, passes: 1 });
    roughLine(ctx, cx - s * 0.5, cy + s * 0.1, cx - s * 0.5, cy + s * 0.9, 916, { color: C.graphiteSoft, alpha: 0.42, width: 0.8, amp: 0.5, passes: 1 });
  }

  function drawCup(ctx, cx, cy, cell, time) {
    const s = cell * 0.14;
    ctx.save();
    ctx.strokeStyle = C.graphiteSoft;
    setAlpha(ctx, 0.55);
    ctx.lineWidth = 0.85;
    ctx.beginPath();
    ctx.moveTo(cx - s, cy - s * 0.6);
    ctx.lineTo(cx - s * 0.7, cy + s);
    ctx.quadraticCurveTo(cx, cy + s * 1.25, cx + s * 0.7, cy + s);
    ctx.lineTo(cx + s, cy - s * 0.6);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx + s * 0.95, cy, s * 0.45, -Math.PI / 2, Math.PI / 2);
    ctx.stroke();
    ctx.restore();
    // пар
    const wob = Math.sin(time * 1.5) * s * 0.18;
    roughLine(ctx, cx - s * 0.25, cy - s * 1.0, cx - s * 0.25 + wob, cy - s * 1.8, 921, {
      color: C.graphiteFaint, alpha: 0.35, width: 0.7, amp: 0.8, passes: 1
    });
    roughLine(ctx, cx + s * 0.3, cy - s * 1.0, cx + s * 0.3 - wob, cy - s * 1.9, 922, {
      color: C.graphiteFaint, alpha: 0.3, width: 0.7, amp: 0.8, passes: 1
    });
  }

  function drawRug(ctx, cx, cy, w, h) {
    ctx.save();
    ctx.fillStyle = 'rgba(190, 170, 140, ' + (0.16 * alphaScale).toFixed(3) + ')';
    ctx.fillRect(cx - w / 2, cy - h / 2, w, h);
    ctx.strokeStyle = C.graphiteSoft;
    setAlpha(ctx, 0.42);
    ctx.lineWidth = 0.85;
    ctx.strokeRect(cx - w / 2, cy - h / 2, w, h);
    setAlpha(ctx, 0.22);
    ctx.strokeRect(cx - w / 2 + 3, cy - h / 2 + 3, w - 6, h - 6);
    ctx.beginPath();
    for (let i = 1; i < 4; i++) {
      const x = cx - w / 2 + (w / 4) * i;
      ctx.moveTo(x, cy - h / 2 + 4);
      ctx.lineTo(x, cy + h / 2 - 4);
    }
    ctx.stroke();
    ctx.restore();
  }

  function drawSun(ctx, cx, cy, cell, time) {
    const r = cell * 0.18;
    roughEllipse(ctx, cx, cy, r, r, 931, { color: C.graphiteSoft, alpha: 0.38, width: 0.85, amp: 0.8 });
    ctx.save();
    ctx.strokeStyle = C.graphiteSoft;
    setAlpha(ctx, 0.24);
    ctx.lineWidth = 0.7;
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + Math.sin(time * 0.3) * 0.03;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * r * 1.35, cy + Math.sin(a) * r * 1.35);
      ctx.lineTo(cx + Math.cos(a) * r * 1.85, cy + Math.sin(a) * r * 1.85);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawFlag(ctx, cx, cy, cell, time) {
    const h = cell * 0.75;
    const topY = cy - h * 0.5;
    roughLine(ctx, cx, cy + h * 0.4, cx, topY, 941, { color: C.graphiteSoft, alpha: 0.5, width: 1.0, amp: 0.5, passes: 1 });
    const wave = Math.sin(time * 2) * cell * 0.02;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(cx, topY);
    ctx.quadraticCurveTo(cx + cell * 0.22, topY + wave, cx + cell * 0.32, topY + cell * 0.06);
    ctx.lineTo(cx + cell * 0.05, topY + cell * 0.16);
    ctx.closePath();
    ctx.fillStyle = 'rgba(177, 59, 59, ' + (0.20 * alphaScale).toFixed(3) + ')';
    ctx.fill();
    ctx.strokeStyle = C.red;
    setAlpha(ctx, 0.55);
    ctx.lineWidth = 0.8;
    ctx.stroke();
    ctx.restore();
  }

  function drawFeather(ctx, cx, cy, cell, time) {
    const tilt = -0.35 + Math.sin(time * 0.7) * 0.02;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(tilt);
    const len = cell * 0.9;
    roughLine(ctx, 0, len * 0.62, 0, -len * 0.62, 951, {
      color: C.graphite, alpha: 0.52, width: 1.0, amp: 0.6, passes: 1
    });
    const barbs = 9;
    for (let i = 0; i < barbs; i++) {
      const t = i / (barbs - 1);
      const y = -len * 0.5 + len * 0.95 * t;
      const w = Math.sin(t * Math.PI) * cell * 0.24 + cell * 0.02;
      const drop = cell * 0.06;
      ctx.strokeStyle = C.graphiteSoft;
      setAlpha(ctx, 0.42 * (1 - t * 0.25));
      ctx.lineWidth = 0.7;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.quadraticCurveTo(-w * 0.65, y + drop, -w, y + drop * 1.6);
      ctx.moveTo(0, y);
      ctx.quadraticCurveTo(w * 0.65, y + drop, w, y + drop * 1.6);
      ctx.stroke();
    }
    ctx.fillStyle = 'rgba(250, 246, 232, ' + (0.35 * alphaScale).toFixed(3) + ')';
    ctx.beginPath();
    ctx.ellipse(0, 0, cell * 0.15, len * 0.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // ---------- heart fragment ----------
  function heartPath(ctx, cx, cy, s) {
    ctx.beginPath();
    ctx.moveTo(cx, cy + s * 0.78);
    ctx.bezierCurveTo(cx - s * 1.15, cy - s * 0.06, cx - s * 0.62, cy - s * 0.98, cx, cy - s * 0.30);
    ctx.bezierCurveTo(cx + s * 0.62, cy - s * 0.98, cx + s * 1.15, cy - s * 0.06, cx, cy + s * 0.78);
    ctx.closePath();
  }

  function drawTinyHeart(ctx, cx, cy, s, seed) {
    const rng = mulberry32(seed | 0);
    ctx.save();
    setAlpha(ctx, 0.38);
    ctx.fillStyle = 'rgba(177, 59, 59, 0.25)';
    heartPath(ctx, cx, cy, s);
    ctx.fill();
    ctx.strokeStyle = C.red;
    setAlpha(ctx, 0.44);
    ctx.lineWidth = 0.7;
    for (let p = 0; p < 2; p++) {
      ctx.beginPath();
      const j = (rng() - 0.5) * 0.3;
      ctx.moveTo(cx + j, cy + s * 0.78);
      ctx.bezierCurveTo(cx - s * 1.15 + j, cy - s * 0.06, cx - s * 0.62, cy - s * 0.98, cx + j, cy - s * 0.30);
      ctx.bezierCurveTo(cx + s * 0.62, cy - s * 0.98, cx + s * 1.15 + j, cy - s * 0.06, cx + j, cy + s * 0.78);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawHeart(ctx, cx, cy, s, time, alpha, seed) {
    const pulse = 1 + Math.sin(time * 2.6) * 0.045;
    ctx.save();
    setAlpha(ctx, clamp(alpha == null ? 1 : alpha, 0, 1));
    ctx.translate(cx, cy);
    ctx.scale(pulse, pulse);
    // мягкое свечение
    const glow = ctx.createRadialGradient(0, 0, s * 0.2, 0, 0, s * 2.4);
    glow.addColorStop(0, 'rgba(177, 59, 59, 0.16)');
    glow.addColorStop(1, 'rgba(177, 59, 59, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(0, 0, s * 2.4, 0, Math.PI * 2);
    ctx.fill();

    // заливка
    heartPath(ctx, 0, 0, s);
    ctx.fillStyle = 'rgba(190, 79, 75, 0.22)';
    ctx.fill();

    // штриховка внутри
    ctx.save();
    heartPath(ctx, 0, 0, s);
    ctx.clip();
    hatchRect(ctx, -s, -s, s * 2, s * 2, (seed || 71) + 4, {
      spacing: Math.max(2.5, s * 0.12), alpha: 0.16, color: C.red, dir: 1
    });
    ctx.restore();

    // контур — несколько карандашных проходов
    const rng = mulberry32((seed || 71) | 0);
    for (let p = 0; p < 2; p++) {
      const j = (rng() - 0.5) * s * 0.18;
      ctx.beginPath();
      ctx.moveTo(j, s * 0.78);
      ctx.bezierCurveTo(-s * 1.15 + j, -s * 0.06, -s * 0.62, -s * 0.98, j, -s * 0.30);
      ctx.bezierCurveTo(s * 0.62, -s * 0.98, s * 1.15 + j, -s * 0.06, j, s * 0.78);
      ctx.strokeStyle = C.red;
      setAlpha(ctx, (p ? 0.45 : 0.82) * (alpha == null ? 1 : alpha));
      ctx.lineWidth = p ? 0.7 : 1.15;
      ctx.stroke();
    }

    // блик
    ctx.beginPath();
    ctx.arc(-s * 0.36, -s * 0.28, s * 0.15, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 245, 230, 0.55)';
    ctx.fill();

    // искры
    ctx.strokeStyle = C.redSoft;
    setAlpha(ctx, 0.35);
    ctx.lineWidth = 0.8;
    for (let i = 0; i < 4; i++) {
      const a = time * 0.5 + i * Math.PI / 2;
      const r1 = s * 1.45, r2 = s * (1.65 + Math.sin(time * 2 + i) * 0.15);
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * r1, Math.sin(a) * r1);
      ctx.lineTo(Math.cos(a) * r2, Math.sin(a) * r2);
      ctx.stroke();
    }
    ctx.restore();
  }

  // ---------- girl & companion ----------
  function drawGirl(ctx, cx, baseY, height, time, opts) {
    opts = opts || {};
    const u = height / 100;
    const facing = opts.facing || 1;
    const walking = !!opts.walking;
    const phase = opts.phase || 0;
    const alpha = opts.alpha == null ? 1 : opts.alpha;
    const bob = walking ? Math.sin(phase * Math.PI * 2) * 1.8 * u : Math.sin(time * 1.8) * 0.7 * u;
    const legSwing = walking ? Math.sin(phase * Math.PI * 2) * 5 * u : 0;
    const wingFlap = Math.sin(time * 3.1 + (walking ? phase * Math.PI * 2 : 0)) * 3 * u;

    ctx.save();
    setAlpha(ctx, alpha);
    ctx.translate(cx, baseY + bob);
    ctx.scale(facing, 1);

    // тень
    ctx.save();
    ctx.fillStyle = C.shadow;
    ctx.beginPath();
    ctx.ellipse(0, 1.5 * u, 17 * u, 3.2 * u, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // крылья за спиной
    ctx.save();
    setAlpha(ctx, alpha * 0.55);
    ctx.fillStyle = 'rgba(255, 252, 240, 0.42)';
    ctx.strokeStyle = C.graphiteSoft;
    ctx.lineWidth = 0.9 * u;
    for (let side = -1; side <= 1; side += 2) {
      ctx.beginPath();
      ctx.moveTo(side * 5 * u, -56 * u);
      ctx.quadraticCurveTo(side * (26 + wingFlap) * u, -78 * u, side * (31 + wingFlap) * u, -58 * u);
      ctx.quadraticCurveTo(side * (24 + wingFlap) * u, -52 * u, side * 7 * u, -49 * u);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      // перья
      for (let f = 1; f <= 3; f++) {
        ctx.beginPath();
        ctx.moveTo(side * 7 * u, -55 * u);
        ctx.quadraticCurveTo(side * (14 + f * 3 + wingFlap) * u, -62 * u, side * (18 + f * 4 + wingFlap) * u, -56 * u);
        setAlpha(ctx, alpha * (0.18 + f * 0.05));
        ctx.stroke();
        setAlpha(ctx, alpha * 0.55);
      }
    }
    ctx.restore();

    // ноги
    ctx.save();
    ctx.strokeStyle = C.graphite;
    ctx.lineWidth = 1.5 * u;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-4 * u, -38 * u);
    ctx.lineTo(-5 * u + legSwing, -6 * u);
    ctx.moveTo(4 * u, -38 * u);
    ctx.lineTo(5 * u - legSwing, -6 * u);
    ctx.stroke();
    // туфельки
    ctx.lineWidth = 2.4 * u;
    ctx.strokeStyle = C.graphiteSoft;
    ctx.beginPath();
    ctx.moveTo(-5 * u + legSwing, -6 * u);
    ctx.lineTo(-9 * u + legSwing, -4 * u);
    ctx.moveTo(5 * u - legSwing, -6 * u);
    ctx.lineTo(9 * u - legSwing, -4 * u);
    ctx.stroke();
    ctx.restore();

    // платье
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(-7 * u, -64 * u);
    ctx.lineTo(-9 * u, -52 * u);
    ctx.quadraticCurveTo(-13 * u, -43 * u, -19 * u, -37 * u);
    ctx.quadraticCurveTo(-14 * u, -33 * u, -9 * u, -36 * u);
    ctx.quadraticCurveTo(-4 * u, -32 * u, 0, -36 * u);
    ctx.quadraticCurveTo(4 * u, -32 * u, 9 * u, -36 * u);
    ctx.quadraticCurveTo(14 * u, -33 * u, 19 * u, -37 * u);
    ctx.quadraticCurveTo(13 * u, -43 * u, 9 * u, -52 * u);
    ctx.lineTo(7 * u, -64 * u);
    ctx.closePath();
    ctx.fillStyle = 'rgba(255, 251, 240, 0.72)';
    ctx.fill();
    ctx.strokeStyle = C.graphite;
    ctx.lineWidth = 1.15 * u;
    ctx.stroke();
    // складки
    ctx.strokeStyle = C.graphiteSoft;
    setAlpha(ctx, alpha * 0.42);
    ctx.lineWidth = 0.75 * u;
    ctx.beginPath();
    ctx.moveTo(-4 * u, -54 * u);
    ctx.lineTo(-9 * u, -38 * u);
    ctx.moveTo(3 * u, -54 * u);
    ctx.lineTo(7 * u, -38 * u);
    ctx.stroke();
    // пояс
    setAlpha(ctx, alpha * 0.6);
    ctx.lineWidth = 1.4 * u;
    ctx.beginPath();
    ctx.moveTo(-9 * u, -52 * u);
    ctx.quadraticCurveTo(0, -49 * u, 9 * u, -52 * u);
    ctx.stroke();
    ctx.restore();

    // руки
    ctx.save();
    ctx.strokeStyle = C.graphite;
    ctx.lineWidth = 1.45 * u;
    ctx.lineCap = 'round';
    // левая рука придерживает птенца
    ctx.beginPath();
    ctx.moveTo(-7 * u, -62 * u);
    ctx.quadraticCurveTo(-15 * u, -58 * u, -13 * u, -70 * u);
    ctx.stroke();
    // правая рука
    const armSwing = walking ? Math.sin(phase * Math.PI * 2 + Math.PI) * 4 * u : 0;
    ctx.beginPath();
    ctx.moveTo(7 * u, -62 * u);
    ctx.quadraticCurveTo(16 * u, -56 * u + armSwing, 14 * u, -44 * u + armSwing);
    ctx.stroke();
    ctx.restore();

    // шея
    ctx.save();
    ctx.strokeStyle = C.graphite;
    ctx.lineWidth = 1.1 * u;
    ctx.beginPath();
    ctx.moveTo(-2 * u, -64 * u);
    ctx.lineTo(-2 * u, -70 * u);
    ctx.stroke();
    ctx.restore();

    // голова
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(0, -80 * u, 10.5 * u, 11.5 * u, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 252, 242, 0.86)';
    ctx.fill();
    ctx.strokeStyle = C.graphite;
    ctx.lineWidth = 1.15 * u;
    ctx.stroke();

    // волосы
    ctx.strokeStyle = C.graphite;
    ctx.lineWidth = 1.0 * u;
    setAlpha(ctx, alpha * 0.78);
    const hair = [
      [-10, -88, -15, -80, -12, -72],
      [-6, -91, -9, -83, -7, -76],
      [0, -92, -2, -84, 0, -77],
      [6, -91, 8, -83, 6, -76],
      [10, -88, 14, -81, 12, -73],
      [-8, -90, -4, -87, 1, -90],
      [3, -91, 7, -88, 11, -86]
    ];
    hair.forEach((h, i) => {
      ctx.beginPath();
      ctx.moveTo(h[0] * u, h[1] * u);
      ctx.quadraticCurveTo(h[2] * u + Math.sin(time * 1.2 + i) * 0.6 * u, h[3] * u, h[4] * u, h[5] * u);
      ctx.stroke();
    });

    // лицо: закрытые глаза и улыбка
    setAlpha(ctx, alpha);
    ctx.strokeStyle = C.graphite;
    ctx.lineWidth = 0.95 * u;
    ctx.beginPath();
    ctx.arc(-3.3 * u, -80 * u, 1.6 * u, 0.15 * Math.PI, 0.85 * Math.PI);
    ctx.arc(3.3 * u, -80 * u, 1.6 * u, 0.15 * Math.PI, 0.85 * Math.PI);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, -76.5 * u, 2.4 * u, 0.2 * Math.PI, 0.8 * Math.PI);
    ctx.stroke();
    // румянец
    ctx.fillStyle = 'rgba(177, 59, 59, 0.16)';
    ctx.beginPath();
    ctx.ellipse(-5.5 * u, -76 * u, 2.4 * u, 1.4 * u, 0, 0, Math.PI * 2);
    ctx.ellipse(5.5 * u, -76 * u, 2.4 * u, 1.4 * u, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // птенец-капля на плече
    drawChick(ctx, -11 * u, -71 * u, 8.5 * u, time, alpha);

    ctx.restore();
  }

  function drawChick(ctx, x, y, s, time, alpha) {
    const bob = Math.sin(time * 3.2) * s * 0.10;
    ctx.save();
    setAlpha(ctx, alpha == null ? 1 : alpha);
    ctx.translate(x, y + bob);
    // капля
    ctx.beginPath();
    ctx.moveTo(0, -s * 1.25);
    ctx.bezierCurveTo(s * 0.8, -s * 0.35, s * 0.95, s * 0.25, s * 0.55, s * 0.8);
    ctx.quadraticCurveTo(0, s * 1.3, -s * 0.55, s * 0.8);
    ctx.bezierCurveTo(-s * 0.95, s * 0.25, -s * 0.8, -s * 0.35, 0, -s * 1.25);
    ctx.closePath();
    ctx.fillStyle = C.ink;
    ctx.fill();
    ctx.strokeStyle = C.graphite;
    setAlpha(ctx, (alpha == null ? 1 : alpha) * 0.5);
    ctx.lineWidth = 0.7;
    ctx.stroke();
    setAlpha(ctx, alpha == null ? 1 : alpha);
    // блик
    ctx.beginPath();
    ctx.ellipse(-s * 0.25, -s * 0.25, s * 0.22, s * 0.42, -0.4, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 252, 240, 0.50)';
    ctx.fill();
    // глаз
    ctx.beginPath();
    ctx.arc(-s * 0.28, -s * 0.12, s * 0.20, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 250, 240, 0.95)';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(-s * 0.30, -s * 0.10, s * 0.10, 0, Math.PI * 2);
    ctx.fillStyle = C.ink;
    ctx.fill();
    // клюв
    ctx.beginPath();
    ctx.moveTo(s * 0.10, s * 0.10);
    ctx.lineTo(s * 0.52, s * 0.24);
    ctx.lineTo(s * 0.10, s * 0.36);
    ctx.closePath();
    ctx.fillStyle = C.red;
    setAlpha(ctx, (alpha == null ? 1 : alpha) * 0.85);
    ctx.fill();
    // крылышко
    ctx.strokeStyle = 'rgba(255, 250, 240, 0.5)';
    ctx.lineWidth = 0.7;
    ctx.beginPath();
    ctx.arc(s * 0.15, s * 0.46, s * 0.32, -0.2, Math.PI * 0.8);
    ctx.stroke();
    ctx.restore();
  }

  // ---------- particles ----------
  function drawParticle(ctx, p) {
    ctx.save();
    setAlpha(ctx, clamp(p.life / p.max, 0, 1) * (p.alpha == null ? 1 : p.alpha));
    if (p.kind === 'heart') {
      drawTinyHeart(ctx, p.x, p.y, p.size, p.seed || 1);
    } else if (p.kind === 'spark') {
      ctx.strokeStyle = C.redSoft;
      ctx.lineWidth = 0.9;
      ctx.beginPath();
      ctx.moveTo(p.x - p.size, p.y);
      ctx.lineTo(p.x + p.size, p.y);
      ctx.moveTo(p.x, p.y - p.size);
      ctx.lineTo(p.x, p.y + p.size);
      ctx.stroke();
    } else {
      dot(ctx, p.x, p.y, p.size, p.color || C.graphiteSoft, 0.5);
    }
    ctx.restore();
  }

  window.PaperArt = {
    COLORS: C,
    seedFor: seedFor,
    mulberry32: mulberry32,
    roughLine: roughLine,
    roughEllipse: roughEllipse,
    hatchRect: hatchRect,
    dot: dot,
    drawPaper: drawPaper,
    cellRect: cellRect,
    drawCell: drawCell,
    drawConnections: drawConnections,
    drawDecor: drawDecor,
    drawHeart: drawHeart,
    drawTinyHeart: drawTinyHeart,
    drawGirl: drawGirl,
    drawChick: drawChick,
    drawFeather: drawFeather,
    drawParticle: drawParticle
  };
})();
