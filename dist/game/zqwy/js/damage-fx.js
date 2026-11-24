/* ZEMIC damage effect (zemic-damage-v1).
   Shared canvas overlay for the battle and the trial. It is deliberately
   drawn after the player sprite so a hit is visible even during the short
   invulnerability window. */
(function () {
  'use strict';

  const ZQ = window.ZQ;
  if (!ZQ) return;

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function drawDamageFx(ctx, options) {
    if (!ctx || !options) return;
    const flash = clamp(Number(options.flash) || 0, 0, 1);
    if (flash <= 0) return;

    const canvasWidth = ctx.canvas && ctx.canvas.width ? ctx.canvas.width : 0;
    const canvasHeight = ctx.canvas && ctx.canvas.height ? ctx.canvas.height : 0;
    const w = Math.max(1, Number(options.w) || canvasWidth);
    const h = Math.max(1, Number(options.h) || canvasHeight);
    const x = Number(options.x) || 0;
    const y = Number(options.y) || 0;
    const radius = Math.max(4, Number(options.radius) || 16);
    const now = Number(options.now) || 0;
    const seed = Number(options.seed) || 0;

    ctx.save();

    // Red vignette: the edges of the labyrinth pulse when Zemic is hurt.
    const reach = Math.max(w, h) * 0.74;
    const vignette = ctx.createRadialGradient(
      w / 2, h / 2, Math.min(w, h) * 0.16,
      w / 2, h / 2, reach
    );
    vignette.addColorStop(0, 'rgba(255, 72, 40, 0)');
    vignette.addColorStop(0.55, `rgba(255, 62, 34, ${0.05 * flash})`);
    vignette.addColorStop(1, `rgba(210, 28, 20, ${0.34 * flash})`);
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, w, h);

    // Short scanline tears make the hit feel like a corrupted terminal frame.
    const bars = 6;
    for (let i = 0; i < bars; i++) {
      const jitter = 0.5 + 0.5 * Math.sin(now * 0.045 + i * 13.7 + seed);
      const bandY = ((i + 0.5) / bars) * h + (jitter - 0.5) * 20 * flash;
      const bandH = (1.2 + 2.8 * jitter) * flash;
      ctx.fillStyle = i % 2 === 0
        ? `rgba(255, 102, 70, ${0.16 * flash})`
        : `rgba(129, 226, 255, ${0.1 * flash})`;
      ctx.fillRect(0, bandY, w, bandH);
    }

    // Cracked ring and pixel shards centred on the damaged player.
    const rays = 10;
    const phase = now * 0.002 + seed;
    for (let i = 0; i < rays; i++) {
      const angle = phase + (i / rays) * Math.PI * 2;
      const wobble = 0.5 + 0.5 * Math.sin(now * 0.012 + i * 4.1 + seed);
      const inner = radius * (0.7 + wobble * 0.25);
      const outer = radius * (1.8 + wobble * 1.2) * (0.65 + flash * 0.55);
      ctx.strokeStyle = i % 2 === 0
        ? `rgba(255, 220, 180, ${0.7 * flash})`
        : `rgba(255, 92, 58, ${0.62 * flash})`;
      ctx.lineWidth = Math.max(1, radius * (i % 3 === 0 ? 0.12 : 0.06));
      ctx.beginPath();
      ctx.moveTo(x + Math.cos(angle) * inner, y + Math.sin(angle) * inner);
      ctx.lineTo(x + Math.cos(angle + 0.12) * outer, y + Math.sin(angle + 0.12) * outer);
      ctx.stroke();
    }

    ctx.strokeStyle = `rgba(255, 236, 208, ${0.8 * flash})`;
    ctx.lineWidth = Math.max(1.5, radius * 0.14);
    ctx.beginPath();
    ctx.arc(x, y, radius * (0.78 + 0.3 * (1 - flash)), 0, Math.PI * 2);
    ctx.stroke();

    for (let i = 0; i < 8; i++) {
      const angle = phase * 1.3 + (i / 8) * Math.PI * 2;
      const dist = radius * (1.15 + 0.55 * (0.5 + 0.5 * Math.sin(now * 0.02 + i)));
      const size = Math.max(2, radius * 0.2 * flash);
      ctx.fillStyle = i % 2 === 0
        ? `rgba(255, 184, 122, ${0.8 * flash})`
        : `rgba(169, 105, 255, ${0.68 * flash})`;
      ctx.fillRect(
        x + Math.cos(angle) * dist - size / 2,
        y + Math.sin(angle) * dist - size / 2,
        size,
        size
      );
    }

    ctx.restore();
  }

  /* Смерть: тело распадается на пиксельные частицы и улетает.
     Эффект живёт ровно один проход: progress приходит из rt.deathFx
     и никогда не зацикливается. */
  function drawDeathFx(ctx, options) {
    if (!ctx || !options) return;
    const progress = clamp(Number(options.progress) || 0, 0, 1);
    if (progress <= 0) return;

    const canvasWidth = ctx.canvas && ctx.canvas.width ? ctx.canvas.width : 0;
    const canvasHeight = ctx.canvas && ctx.canvas.height ? ctx.canvas.height : 0;
    const w = Math.max(1, Number(options.w || options.width) || canvasWidth);
    const h = Math.max(1, Number(options.h || options.height) || canvasHeight);
    const x = Number(options.x) || 0;
    const y = Number(options.y) || 0;
    const now = Number(options.now) || 0;
    const radius = Math.max(6, Number(options.radius) || 18);
    const seed = Math.floor(Number(options.seed) || 0);

    const fade = progress > 0.78 ? (progress - 0.78) / 0.22 : 0;
    const burst = 1 - Math.pow(1 - progress, 2.2);

    ctx.save();

    // Затемнение вокруг точки распада, без "схлопывания" тела.
    const reach = Math.max(w, h) * 0.82;
    const vignette = ctx.createRadialGradient(
      x, y, Math.min(w, h) * 0.03,
      x, y, reach
    );
    vignette.addColorStop(0, `rgba(40, 12, 18, ${0.08 * (1 - progress)})`);
    vignette.addColorStop(0.55, `rgba(30, 8, 12, ${0.16 * (1 - fade)})`);
    vignette.addColorStop(1, `rgba(3, 4, 5, ${0.42 + 0.58 * fade})`);
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, w, h);

    const particleCount = Math.max(22, Number(options.particles) || 54);
    for (let i = 0; i < particleCount; i++) {
      const angle = (i / particleCount) * Math.PI * 2 + (seed % 360) * 0.017 + Math.sin(i * 2.3) * 0.12;
      const speed = 0.55 + ((i * 37 + seed * 11) % 100) / 100;
      const dist = radius * (0.2 + burst * speed * 5.2);
      const driftY = burst * burst * radius * (0.18 + (i % 5) * 0.06);
      const px = x + Math.cos(angle) * dist;
      const py = y + Math.sin(angle) * dist + driftY;
      const base = Math.max(1.5, radius * (0.08 + ((i * 13) % 7) * 0.03));
      const size = base * (1 - progress * 0.82);
      if (size <= 0.4) continue;
      const alpha = (1 - progress) * (0.45 + ((i * 19) % 5) * 0.12);
      const tint = i % 4;
      if (tint === 0) ctx.fillStyle = `rgba(242, 236, 220, ${alpha})`;
      else if (tint === 1) ctx.fillStyle = `rgba(255, 196, 150, ${alpha})`;
      else if (tint === 2) ctx.fillStyle = `rgba(255, 124, 96, ${alpha * 0.92})`;
      else ctx.fillStyle = `rgba(169, 105, 255, ${alpha * 0.85})`;
      ctx.fillRect(px - size / 2, py - size / 2, size, size);
    }

    // Лёгкие цифровые полосы в начале распада.
    const glitch = Math.max(0, 1 - progress * 1.8);
    if (glitch > 0) {
      for (let i = 0; i < 4; i++) {
        const jitter = 0.5 + 0.5 * Math.sin(now * 0.04 + i * 7.3 + seed);
        const bandY = y - radius * 0.9 + (i / 3) * radius * 1.8 + (jitter - 0.5) * 8;
        ctx.fillStyle = i % 2 === 0
          ? `rgba(255, 110, 80, ${0.12 * glitch})`
          : `rgba(142, 224, 255, ${0.08 * glitch})`;
        ctx.fillRect(x - radius * 1.4, bandY, radius * 2.8, 1.5);
      }
    }

    ctx.restore();
  }

  ZQ.drawDamageFx = drawDamageFx;
  ZQ.damageFxVersion = 'zemic-damage-v1';
  ZQ.drawDeathFx = drawDeathFx;
  ZQ.deathFxVersion = 'zemic-death-v2';
})();
