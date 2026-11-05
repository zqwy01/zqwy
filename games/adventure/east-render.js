import {
  DIRS,
  dangerPosition,
  hashString,
  mulberry32,
  packsInRoom,
} from './east-core.js';

const SPRITE = Object.freeze({
  frameWidth: 16,
  frameHeight: 18,
  pitch: 20,
  originX: 1,
  originY: 1,
});

const FACING = {
  down: { idle: 0, walk: [1, 2, 3] },
  up: { idle: 4, walk: [5, 6, 7] },
  left: { idle: 16, walk: [17, 18, 19] },
  right: { idle: 20, walk: [21, 22, 23] },
  'down-left': { idle: 8, walk: [9, 10, 11] },
  'down-right': { idle: 12, walk: [13, 14, 15] },
  'up-left': { idle: 24, walk: [25, 26, 27] },
  'up-right': { idle: 28, walk: [29, 30, 31] },
};

const SIDE_GLYPH = { north: 'С', south: 'Ю', west: 'З', east: 'В' };

const TAU = Math.PI * 2;

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function pathRoundRect(ctx, x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

function drawGlowCircle(ctx, x, y, radius, inner, outer) {
  const gradient = ctx.createRadialGradient(x, y, 0, x, y, Math.max(1, radius));
  gradient.addColorStop(0, inner);
  gradient.addColorStop(1, outer);
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, TAU);
  ctx.fill();
}

function strokeJitter(ctx, x1, y1, x2, y2, random, alpha, width = 1) {
  const passes = 2;
  for (let p = 0; p < passes; p += 1) {
    ctx.beginPath();
    const steps = Math.max(2, Math.ceil(Math.hypot(x2 - x1, y2 - y1) / 13));
    for (let i = 0; i <= steps; i += 1) {
      const t = i / steps;
      const jitter = (random() - 0.5) * 1.6 * Math.sin(Math.PI * t);
      const x = x1 + (x2 - x1) * t + jitter;
      const y = y1 + (y2 - y1) * t + jitter;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = `rgba(196, 226, 215, ${alpha * (p ? 0.45 : 1)})`;
    ctx.lineWidth = width * (p ? 0.7 : 1);
    ctx.stroke();
  }
}

export class Renderer {
  constructor(canvas, assets = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.assets = assets;
    this.width = 0;
    this.height = 0;
    this.dpr = 1;
    this.roomRect = { x: 0, y: 0, w: 1, h: 1 };
    this.dust = [];
    this.resize(true);
  }

  resize(force = false) {
    const rect = this.canvas.getBoundingClientRect();
    const width = Math.max(1, rect.width || 320);
    const height = Math.max(1, rect.height || 568);
    const dpr = clamp(window.devicePixelRatio || 1, 1, 2.5);
    const pixelWidth = Math.round(width * dpr);
    const pixelHeight = Math.round(height * dpr);
    if (!force && pixelWidth === this.canvas.width && pixelHeight === this.canvas.height) {
      this.width = width;
      this.height = height;
      return;
    }
    this.canvas.width = pixelWidth;
    this.canvas.height = pixelHeight;
    this.width = width;
    this.height = height;
    this.dpr = dpr;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.ctx.imageSmoothingEnabled = false;
    this.roomRect = {
      x: width * 0.075,
      y: height * 0.15,
      w: width * 0.85,
      h: height * 0.665,
    };
    const random = mulberry32(hashString(`dust-${Math.round(width)}x${Math.round(height)}`));
    this.dust = Array.from({ length: 46 }, () => ({
      x: random(),
      y: random(),
      r: 0.4 + random() * 1.1,
      speed: 0.008 + random() * 0.018,
      phase: random() * TAU,
      alpha: 0.06 + random() * 0.14,
    }));
  }

  toScreen(x, y) {
    return {
      x: this.roomRect.x + x * this.roomRect.w,
      y: this.roomRect.y + y * this.roomRect.h,
    };
  }

  metrics() {
    return { roomRect: { ...this.roomRect }, width: this.width, height: this.height };
  }

  render(scene) {
    const { ctx } = this;
    if (!this.width || !this.height) this.resize();
    if (!ctx) return;

    const { state, now = 0, trial = null, moving = false, walkClock = 0 } = scene;
    const room = state?.rooms?.[state.currentRoomId];
    const shake = scene.shake || 0;
    ctx.save();
    ctx.clearRect(0, 0, this.width, this.height);
    this.drawStageBackground(ctx, room, now);

    if (!room) {
      ctx.restore();
      return;
    }

    ctx.save();
    if (shake > 0.01) {
      ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
    }

    this.drawRoom(ctx, room, state, now, trial);
    this.drawDust(ctx, now);

    if (state.flags?.trialCleared && room.kind === 'story') {
      this.drawStoryCalm(ctx, now);
    }

    const drawables = [];
    if (room.kind === 'tablet') {
      drawables.push({ y: 0.5, draw: () => this.drawTablet(ctx, room, now) });
    }
    if (room.kind === 'find' && room.take && !room.take.taken) {
      drawables.push({ y: 0.5, draw: () => this.drawChalkShard(ctx, now) });
    }
    if (room.kind === 'story' && !state.flags?.trialCleared && !trial?.active) {
      drawables.push({ y: 0.47, draw: () => this.drawStoryLight(ctx, now) });
    }
    if (room.threat) {
      this.drawDanger(ctx, room, now);
    }

    const packs = packsInRoom(state, room.id);
    for (const pack of packs) {
      const seed = hashString(pack.id);
      const ox = ((seed % 9) - 4) * 0.0018;
      const oy = (((seed >> 4) % 7) - 3) * 0.0018;
      drawables.push({
        y: pack.y + oy,
        draw: () => this.drawPack(ctx, pack.x + ox, pack.y + oy, now),
      });
    }

    const playerY = trial?.active ? trial.player.y : state.player.y;
    drawables.push({
      y: playerY,
      draw: () => this.drawPlayer(ctx, {
        x: trial?.active ? trial.player.x : state.player.x,
        y: playerY,
        facing: trial?.active ? trial.player.facing : state.player.facing,
        moving,
        walkClock,
        invulnerable: Boolean(trial?.invulnerable || scene.invulnerable),
        dashTrail: scene.dashTrail || [],
        trial: Boolean(trial?.active),
      }),
    });

    if (trial?.active) {
      this.drawTrialField(ctx, trial, now);
    }

    drawables.sort((a, b) => a.y - b.y).forEach((item) => item.draw());

    if (trial?.active) {
      this.drawTrialOverlay(ctx, trial, now);
    }

    this.drawRoomVignette(ctx, room);
    ctx.restore();

    this.drawStageVignette(ctx);
    if (scene.flash > 0.001) {
      ctx.fillStyle = `rgba(2, 5, 5, ${clamp(scene.flash, 0, 0.92)})`;
      ctx.fillRect(0, 0, this.width, this.height);
    }
    ctx.restore();
  }

  drawStageBackground(ctx, room, now) {
    const { width: w, height: h } = this;
    const gradient = ctx.createLinearGradient(0, 0, 0, h);
    gradient.addColorStop(0, '#080d0e');
    gradient.addColorStop(0.5, '#070b0c');
    gradient.addColorStop(1, '#040707');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, w, h);

    if (room) {
      const r = this.roomRect;
      const cx = r.x + r.w / 2;
      const cy = r.y + r.h / 2;
      const aura = ctx.createRadialGradient(cx, cy, 0, cx, cy, r.w * 0.9);
      const tint = room.kind === 'story'
        ? 'rgba(97, 74, 42, 0.16)'
        : room.kind === 'danger'
          ? 'rgba(82, 27, 26, 0.12)'
          : 'rgba(45, 80, 71, 0.12)';
      aura.addColorStop(0, tint);
      aura.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = aura;
      ctx.fillRect(0, 0, w, h);

      const pulse = 0.01 + Math.sin(now * 1.4) * 0.004;
      ctx.strokeStyle = 'rgba(159, 216, 200, 0.045)';
      ctx.lineWidth = 1;
      ctx.strokeRect(r.x - 8 - pulse * 10, r.y - 8 - pulse * 10, r.w + 16 + pulse * 20, r.h + 16 + pulse * 20);
    }
  }

  drawRoom(ctx, room, state, now, trial) {
    const r = this.roomRect;
    ctx.save();
    pathRoundRect(ctx, r.x, r.y, r.w, r.h, 10);
    ctx.clip();

    const floor = ctx.createLinearGradient(r.x, r.y, r.x + r.w * 0.35, r.y + r.h);
    floor.addColorStop(0, room.kind === 'danger' ? '#171314' : '#11191a');
    floor.addColorStop(0.54, room.kind === 'story' ? '#171713' : '#0d1415');
    floor.addColorStop(1, '#080c0d');
    ctx.fillStyle = floor;
    ctx.fillRect(r.x, r.y, r.w, r.h);

    // Faint floor plates.
    ctx.strokeStyle = 'rgba(191, 220, 210, 0.055)';
    ctx.lineWidth = 0.7;
    for (let i = 1; i < 8; i += 1) {
      const x = r.x + (r.w * i) / 8;
      ctx.beginPath();
      ctx.moveTo(x, r.y + 8);
      ctx.lineTo(x + Math.sin(i * 1.7) * 3, r.y + r.h - 8);
      ctx.stroke();
    }
    for (let i = 1; i < 11; i += 1) {
      const y = r.y + (r.h * i) / 11;
      ctx.beginPath();
      ctx.moveTo(r.x + 8, y);
      ctx.lineTo(r.x + r.w - 8, y + Math.cos(i * 1.2) * 2);
      ctx.stroke();
    }

    const innerLight = ctx.createRadialGradient(
      r.x + r.w * 0.5, r.y + r.h * 0.45, 0,
      r.x + r.w * 0.5, r.y + r.h * 0.45, r.w * 0.72,
    );
    innerLight.addColorStop(0, room.kind === 'story' ? 'rgba(116, 94, 53, 0.12)' : 'rgba(56, 88, 80, 0.11)');
    innerLight.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = innerLight;
    ctx.fillRect(r.x, r.y, r.w, r.h);

    this.drawMotif(ctx, room, now);
    this.drawWalls(ctx, room, now);
    this.drawChalk(ctx, room);

    if (room.kind === 'danger') this.drawBreathFloor(ctx, room, now);
    if (room.kind === 'story') this.drawStoryFloor(ctx, room, now, trial);

    ctx.restore();

    // Double outline around the room.
    ctx.save();
    pathRoundRect(ctx, r.x - 2, r.y - 2, r.w + 4, r.h + 4, 12);
    ctx.strokeStyle = 'rgba(191, 220, 210, 0.16)';
    ctx.lineWidth = 1;
    ctx.stroke();
    pathRoundRect(ctx, r.x + 4, r.y + 4, r.w - 8, r.h - 8, 8);
    ctx.strokeStyle = 'rgba(5, 8, 8, 0.6)';
    ctx.stroke();
    ctx.restore();
  }

  drawWalls(ctx, room, now) {
    const r = this.roomRect;
    const thickness = 8;
    const pulse = 0.5 + Math.sin(now * 1.8) * 0.5;

    for (const dir of DIRS) {
      const open = Boolean(room.exits[dir.id]);
      if (open) {
        this.drawDoor(ctx, dir.id, pulse);
      } else {
        this.drawSealedWall(ctx, dir.id);
      }
    }

    // Corner blocks anchor the room visually.
    ctx.fillStyle = 'rgba(4, 7, 8, 0.7)';
    const corner = 13;
    ctx.fillRect(r.x, r.y, corner, thickness);
    ctx.fillRect(r.x, r.y, thickness, corner);
    ctx.fillRect(r.x + r.w - corner, r.y, corner, thickness);
    ctx.fillRect(r.x + r.w - thickness, r.y, thickness, corner);
    ctx.fillRect(r.x, r.y + r.h - thickness, corner, thickness);
    ctx.fillRect(r.x, r.y + r.h - corner, thickness, corner);
    ctx.fillRect(r.x + r.w - corner, r.y + r.h - thickness, corner, thickness);
    ctx.fillRect(r.x + r.w - thickness, r.y + r.h - corner, thickness, corner);
  }

  drawDoor(ctx, side, pulse) {
    const r = this.roomRect;
    const w = r.w * 0.21;
    const h = r.h * 0.105;
    const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);

    ctx.save();
    if (side === 'north' || side === 'south') {
      const y = side === 'north' ? r.y : r.y + r.h;
      const cx = r.x + r.w / 2;
      ctx.fillStyle = 'rgba(3, 6, 7, 0.95)';
      ctx.fillRect(cx - w / 2, y - 2, w, 10);
      // Light spill onto the floor.
      const spill = ctx.createLinearGradient(0, y, 0, y + (side === 'north' ? h : -h));
      spill.addColorStop(0, `rgba(159, 216, 200, ${0.11 + pulse * 0.04})`);
      spill.addColorStop(1, 'rgba(159, 216, 200, 0)');
      ctx.fillStyle = spill;
      ctx.fillRect(cx - w / 2, side === 'north' ? y : y - h, w, h);
      ctx.strokeStyle = `rgba(159, 216, 200, ${0.28 + pulse * 0.17})`;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(cx - w / 2, y + (side === 'north' ? 1 : -1));
      ctx.lineTo(cx + w / 2, y + (side === 'north' ? 1 : -1));
      ctx.stroke();
      this.drawSideGlyph(ctx, side, cx, side === 'north' ? y + 16 : y - 16);
    } else {
      const x = side === 'west' ? r.x : r.x + r.w;
      const cy = r.y + r.h / 2;
      ctx.fillStyle = 'rgba(3, 6, 7, 0.95)';
      ctx.fillRect(x - 2, cy - w / 2, 10, w);
      const spill = ctx.createLinearGradient(x, 0, x + (side === 'west' ? h : -h), 0);
      spill.addColorStop(0, `rgba(159, 216, 200, ${0.11 + pulse * 0.04})`);
      spill.addColorStop(1, 'rgba(159, 216, 200, 0)');
      ctx.fillStyle = spill;
      ctx.fillRect(side === 'west' ? x : x - h, cy - w / 2, h, w);
      ctx.strokeStyle = `rgba(159, 216, 200, ${0.28 + pulse * 0.17})`;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(x + (side === 'west' ? 1 : -1), cy - w / 2);
      ctx.lineTo(x + (side === 'west' ? 1 : -1), cy + w / 2);
      ctx.stroke();
      this.drawSideGlyph(ctx, side, side === 'west' ? x + 15 : x - 15, cy);
    }
    // Suppress unused variable warning in engines that care.
    void glow;
    ctx.restore();
  }

  drawSideGlyph(ctx, side, x, y) {
    ctx.save();
    ctx.fillStyle = 'rgba(159, 216, 200, 0.4)';
    ctx.font = '7px "Zqwy", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(SIDE_GLYPH[side], x, y);
    ctx.restore();
  }

  drawSealedWall(ctx, side) {
    const r = this.roomRect;
    ctx.save();
    ctx.strokeStyle = 'rgba(187, 219, 208, 0.07)';
    ctx.lineWidth = 0.7;
    if (side === 'north' || side === 'south') {
      const y = side === 'north' ? r.y + 3 : r.y + r.h - 3;
      for (let x = r.x + 18; x < r.x + r.w - 14; x += 12) {
        ctx.beginPath();
        ctx.moveTo(x, y - 2);
        ctx.lineTo(x + 4, y + 2);
        ctx.stroke();
      }
    } else {
      const x = side === 'west' ? r.x + 3 : r.x + r.w - 3;
      for (let y = r.y + 18; y < r.y + r.h - 14; y += 12) {
        ctx.beginPath();
        ctx.moveTo(x - 2, y);
        ctx.lineTo(x + 2, y + 4);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  drawMotif(ctx, room, now) {
    const r = this.roomRect;
    const random = mulberry32(hashString(`${room.id}-${room.motif}`));
    const cx = r.x + r.w / 2;
    const cy = r.y + r.h / 2;
    const baseAlpha = room.kind === 'story' ? 0.16 : 0.13;
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    switch (room.motif) {
      case 'loops': {
        for (let i = 0; i < 6; i += 1) {
          const rx = r.w * (0.11 + i * 0.055);
          const ry = r.h * (0.06 + i * 0.035);
          ctx.beginPath();
          const steps = 34;
          for (let s = 0; s <= steps; s += 1) {
            const a = (s / steps) * TAU;
            const j = (random() - 0.5) * 2;
            const x = cx + Math.cos(a) * (rx + j);
            const y = cy + Math.sin(a) * (ry + j);
            if (s === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          ctx.strokeStyle = `rgba(190, 222, 211, ${baseAlpha - i * 0.014})`;
          ctx.lineWidth = i === 0 ? 1.3 : 0.8;
          ctx.stroke();
        }
        break;
      }
      case 'teeth': {
        for (let row = 0; row < 7; row += 1) {
          const y = r.y + r.h * (0.14 + row * 0.1);
          const amp = 3 + (row % 3) * 2;
          ctx.beginPath();
          for (let x = r.x + 12; x < r.x + r.w - 10; x += 10) {
            const yy = y + ((Math.floor((x - r.x) / 10) % 2) ? amp : -amp);
            if (x === r.x + 12) ctx.moveTo(x, yy);
            else ctx.lineTo(x, yy);
          }
          ctx.strokeStyle = `rgba(190, 222, 211, ${baseAlpha * 0.7})`;
          ctx.lineWidth = 0.8;
          ctx.stroke();
        }
        break;
      }
      case 'columns': {
        for (let i = 0; i < 5; i += 1) {
          const x = r.x + r.w * (0.13 + i * 0.185);
          const top = r.y + r.h * (0.16 + random() * 0.11);
          const height = r.h * (0.37 + random() * 0.18);
          ctx.fillStyle = `rgba(190, 222, 211, ${0.025 + random() * 0.025})`;
          ctx.fillRect(x, top, r.w * 0.035, height);
          ctx.strokeStyle = `rgba(190, 222, 211, ${baseAlpha * 0.8})`;
          ctx.lineWidth = 0.9;
          ctx.strokeRect(x, top, r.w * 0.035, height);
          ctx.beginPath();
          ctx.moveTo(x - 2, top + height);
          ctx.lineTo(x + r.w * 0.035 + 2, top + height);
          ctx.stroke();
        }
        break;
      }
      case 'stairs': {
        const startX = r.x + r.w * 0.12;
        const startY = r.y + r.h * 0.73;
        ctx.strokeStyle = `rgba(190, 222, 211, ${baseAlpha})`;
        ctx.lineWidth = 0.9;
        for (let i = 0; i < 8; i += 1) {
          const x = startX + i * r.w * 0.055;
          const y = startY - i * r.h * 0.045;
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x + r.w * 0.22, y);
          ctx.lineTo(x + r.w * 0.22, y - r.h * 0.035);
          ctx.stroke();
        }
        break;
      }
      case 'eyes': {
        for (let i = 0; i < 5; i += 1) {
          const x = r.x + r.w * (0.2 + random() * 0.6);
          const y = r.y + r.h * (0.18 + random() * 0.58);
          const rx = r.w * (0.045 + random() * 0.025);
          const ry = rx * 0.45;
          ctx.beginPath();
          ctx.ellipse(x, y, rx, ry, 0, 0, TAU);
          ctx.strokeStyle = `rgba(190, 222, 211, ${baseAlpha * 0.9})`;
          ctx.lineWidth = 0.8;
          ctx.stroke();
          ctx.beginPath();
          ctx.arc(x, y, ry * 0.45, 0, TAU);
          ctx.fillStyle = `rgba(190, 222, 211, ${baseAlpha * 0.5})`;
          ctx.fill();
        }
        break;
      }
      case 'spiral': {
        ctx.beginPath();
        for (let i = 0; i < 160; i += 1) {
          const a = i * 0.18;
          const radius = 2 + i * 0.66;
          const x = cx + Math.cos(a) * radius * (r.w / r.h) * 0.55;
          const y = cy + Math.sin(a) * radius * 0.65;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.strokeStyle = `rgba(190, 222, 211, ${baseAlpha * 0.9})`;
        ctx.lineWidth = 1;
        ctx.stroke();
        break;
      }
      case 'echo': {
        for (let i = 0; i < 5; i += 1) {
          const inset = 0.12 + i * 0.075;
          pathRoundRect(
            ctx,
            r.x + r.w * inset,
            r.y + r.h * inset * 1.25,
            r.w * (1 - inset * 2),
            r.h * (1 - inset * 2.5),
            6,
          );
          ctx.strokeStyle = `rgba(190, 222, 211, ${baseAlpha - i * 0.016})`;
          ctx.lineWidth = 0.8;
          ctx.stroke();
        }
        break;
      }
      case 'breath': {
        for (let i = 0; i < 8; i += 1) {
          const y = r.y + r.h * (0.13 + i * 0.1);
          ctx.beginPath();
          for (let x = r.x + 10; x <= r.x + r.w - 10; x += 8) {
            const yy = y + Math.sin((x - r.x) * 0.065 + now * 0.8 + i) * (2 + i * 0.35);
            if (x === r.x + 10) ctx.moveTo(x, yy);
            else ctx.lineTo(x, yy);
          }
          ctx.strokeStyle = `rgba(214, 159, 144, ${baseAlpha * 0.45})`;
          ctx.lineWidth = 0.8;
          ctx.stroke();
        }
        break;
      }
      case 'trial': {
        for (let i = 0; i < 7; i += 1) {
          const radius = r.w * (0.08 + i * 0.058);
          ctx.beginPath();
          ctx.ellipse(cx, cy, radius, radius * 0.96, 0, 0, TAU);
          ctx.strokeStyle = `rgba(232, 198, 139, ${0.12 - i * 0.012})`;
          ctx.lineWidth = 0.8;
          ctx.stroke();
        }
        for (let i = 0; i < 20; i += 1) {
          const a = (i / 20) * TAU;
          ctx.beginPath();
          ctx.moveTo(cx + Math.cos(a) * r.w * 0.33, cy + Math.sin(a) * r.w * 0.33);
          ctx.lineTo(cx + Math.cos(a) * r.w * 0.45, cy + Math.sin(a) * r.w * 0.45);
          ctx.strokeStyle = 'rgba(232, 198, 139, 0.055)';
          ctx.stroke();
        }
        break;
      }
      case 'tablet': {
        for (let i = 0; i < 4; i += 1) {
          ctx.beginPath();
          ctx.arc(cx, cy, r.w * (0.2 + i * 0.075), 0.2 + i, TAU - 0.2);
          ctx.strokeStyle = `rgba(159, 216, 200, ${0.1 - i * 0.015})`;
          ctx.lineWidth = 0.8;
          ctx.stroke();
        }
        for (let i = 0; i < 12; i += 1) {
          const a = (i / 12) * TAU + 0.16;
          const x1 = cx + Math.cos(a) * r.w * 0.2;
          const y1 = cy + Math.sin(a) * r.w * 0.2;
          const x2 = cx + Math.cos(a) * r.w * 0.27;
          const y2 = cy + Math.sin(a) * r.w * 0.27;
          strokeJitter(ctx, x1, y1, x2, y2, random, 0.1, 0.8);
        }
        break;
      }
      default:
        break;
    }

    // Occasional chalk scratches for texture.
    for (let i = 0; i < 8; i += 1) {
      const x = r.x + 10 + random() * (r.w - 20);
      const y = r.y + 10 + random() * (r.h - 20);
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + (random() - 0.5) * 20, y + (random() - 0.5) * 12);
      ctx.strokeStyle = `rgba(190, 222, 211, ${0.035 + random() * 0.035})`;
      ctx.lineWidth = 0.6;
      ctx.stroke();
    }

    ctx.restore();
  }

  drawChalk(ctx, room) {
    if (!room.chalkMarked) return;
    const r = this.roomRect;
    const x = r.x + r.w * 0.5;
    const y = r.y + r.h * 0.75;
    const random = mulberry32(hashString(`${room.id}-chalk`));
    ctx.save();
    ctx.strokeStyle = 'rgba(236, 231, 216, 0.46)';
    ctx.lineWidth = 1.3;
    for (let i = 0; i < 3; i += 1) {
      ctx.beginPath();
      const offset = (random() - 0.5) * 4;
      ctx.moveTo(x - 18 + offset, y + offset);
      ctx.lineTo(x + 2 + offset, y - 6 + offset);
      ctx.lineTo(x + 16 + offset, y + 4 + offset);
      ctx.stroke();
    }
    ctx.restore();
  }

  drawBreathFloor(ctx, room, now) {
    const r = this.roomRect;
    const pos = dangerPosition(room, now);
    if (!pos) return;
    const p = this.toScreen(pos.x, pos.y);
    const radius = Math.max(r.w, r.h) * pos.radius * 1.8;
    drawGlowCircle(ctx, p.x, p.y, radius, 'rgba(116, 35, 34, 0.15)', 'rgba(116, 35, 34, 0)');
  }

  drawStoryFloor(ctx, room, now, trial) {
    const r = this.roomRect;
    const cx = r.x + r.w / 2;
    const cy = r.y + r.h * 0.47;
    const pulse = 0.5 + Math.sin(now * 2.1) * 0.5;
    drawGlowCircle(
      ctx,
      cx,
      cy,
      r.w * (0.36 + pulse * 0.025),
      `rgba(227, 194, 139, ${trial?.active ? 0.12 : 0.07 + pulse * 0.025})`,
      'rgba(227, 194, 139, 0)',
    );
  }

  drawStoryCalm(ctx, now) {
    const r = this.roomRect;
    const cx = r.x + r.w / 2;
    const cy = r.y + r.h * 0.48;
    ctx.save();
    drawGlowCircle(ctx, cx, cy, r.w * 0.2, 'rgba(159, 216, 200, 0.07)', 'rgba(159, 216, 200, 0)');
    ctx.strokeStyle = `rgba(159, 216, 200, ${0.16 + Math.sin(now * 1.2) * 0.03})`;
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.ellipse(cx, cy, r.w * 0.11, r.w * 0.035, 0.2, 0, TAU);
    ctx.stroke();
    ctx.restore();
  }

  drawStoryLight(ctx, now) {
    const r = this.roomRect;
    const cx = r.x + r.w / 2;
    const cy = r.y + r.h * 0.47;
    const pulse = 0.5 + Math.sin(now * 3.2) * 0.5;
    ctx.save();
    drawGlowCircle(ctx, cx, cy, r.w * (0.09 + pulse * 0.012), 'rgba(240, 212, 161, 0.34)', 'rgba(240, 212, 161, 0)');
    ctx.strokeStyle = 'rgba(240, 212, 161, 0.44)';
    ctx.lineWidth = 0.8;
    for (let i = 0; i < 3; i += 1) {
      ctx.beginPath();
      ctx.ellipse(cx, cy, r.w * (0.055 + i * 0.022), r.w * (0.018 + i * 0.006), now * 0.12 + i, 0, TAU);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.arc(cx, cy, r.w * 0.028 + pulse * 2, 0, TAU);
    ctx.fillStyle = 'rgba(247, 230, 190, 0.52)';
    ctx.fill();
    ctx.restore();
  }

  drawTablet(ctx, room, now) {
    const p = this.toScreen(0.5, 0.5);
    const r = this.roomRect;
    const pulse = 0.5 + Math.sin(now * 1.6) * 0.5;
    const size = Math.min(r.w, r.h) * 0.13;

    ctx.save();
    drawGlowCircle(ctx, p.x, p.y, size * 2.1, `rgba(159, 216, 200, ${0.12 + pulse * 0.03})`, 'rgba(159, 216, 200, 0)');

    // Ground rings under the tablet.
    ctx.strokeStyle = `rgba(159, 216, 200, ${0.2 + pulse * 0.06})`;
    ctx.lineWidth = 0.9;
    for (let i = 0; i < 3; i += 1) {
      ctx.beginPath();
      ctx.ellipse(p.x, p.y + size * 0.42, size * (0.6 + i * 0.2), size * (0.18 + i * 0.05), 0, 0, TAU);
      ctx.stroke();
    }

    // Soft stone slab.
    ctx.fillStyle = 'rgba(9, 14, 15, 0.86)';
    ctx.strokeStyle = 'rgba(180, 218, 205, 0.4)';
    ctx.lineWidth = 1;
    pathRoundRect(ctx, p.x - size * 0.37, p.y - size * 0.48, size * 0.74, size * 0.78, 3);
    ctx.fill();
    ctx.stroke();

    const image = this.assets.tablet;
    if (image && image.complete && image.naturalWidth) {
      ctx.save();
      ctx.imageSmoothingEnabled = false;
      ctx.shadowColor = 'rgba(159, 216, 200, 0.5)';
      ctx.shadowBlur = 12;
      ctx.drawImage(image, p.x - size * 0.43, p.y - size * 0.53, size * 0.86, size * 0.86);
      ctx.restore();
    } else {
      ctx.strokeStyle = 'rgba(231, 227, 212, 0.7)';
      ctx.beginPath();
      ctx.moveTo(p.x, p.y - size * 0.3);
      ctx.lineTo(p.x + size * 0.2, p.y);
      ctx.lineTo(p.x, p.y + size * 0.3);
      ctx.lineTo(p.x - size * 0.2, p.y);
      ctx.closePath();
      ctx.stroke();
    }

    ctx.fillStyle = 'rgba(159, 216, 200, 0.55)';
    ctx.font = '7px "Zqwy", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('СКРИЖАЛЬ', p.x, p.y + size * 0.77);
    ctx.restore();
  }

  drawChalkShard(ctx, now) {
    const p = this.toScreen(0.5, 0.5);
    const r = this.roomRect;
    const size = Math.max(5, r.w * 0.015);
    const float = Math.sin(now * 2.6) * 2;
    ctx.save();
    drawGlowCircle(ctx, p.x, p.y + float, size * 3.4, 'rgba(236, 231, 216, 0.12)', 'rgba(236, 231, 216, 0)');
    ctx.translate(p.x, p.y + float);
    ctx.rotate(-0.28);
    ctx.fillStyle = 'rgba(244, 239, 225, 0.92)';
    ctx.beginPath();
    ctx.moveTo(-size * 0.4, size * 0.5);
    ctx.lineTo(-size * 0.62, -size * 0.25);
    ctx.lineTo(size * 0.18, -size * 0.55);
    ctx.lineTo(size * 0.54, size * 0.05);
    ctx.lineTo(size * 0.24, size * 0.52);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(30, 36, 33, 0.55)';
    ctx.lineWidth = 0.8;
    ctx.stroke();
    ctx.restore();
  }

  drawDanger(ctx, room, now) {
    const pos = dangerPosition(room, now);
    if (!pos) return;
    const p = this.toScreen(pos.x, pos.y);
    const r = this.roomRect;
    const radius = Math.max(r.w, r.h) * pos.radius * 1.25;
    const pulse = 0.5 + Math.sin(now * 5.1) * 0.5;

    ctx.save();
    // A dark, breathing shadow.
    drawGlowCircle(ctx, p.x, p.y, radius * 2.2, 'rgba(42, 12, 17, 0.2)', 'rgba(42, 12, 17, 0)');
    ctx.fillStyle = `rgba(15, 7, 10, ${0.5 + pulse * 0.12})`;
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, radius, radius * 0.9, Math.sin(now) * 0.2, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = `rgba(219, 117, 104, ${0.25 + pulse * 0.16})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, radius, radius * 0.9, Math.sin(now) * 0.2, 0, TAU);
    ctx.stroke();

    // Tendrils.
    const random = mulberry32(hashString(room.id));
    ctx.strokeStyle = 'rgba(219, 117, 104, 0.16)';
    ctx.lineWidth = 0.8;
    for (let i = 0; i < 5; i += 1) {
      const a = random() * TAU + now * (0.1 + i * 0.02);
      const inner = radius * 0.76;
      const outer = radius * (1.2 + random() * 0.35);
      ctx.beginPath();
      ctx.moveTo(p.x + Math.cos(a) * inner, p.y + Math.sin(a) * inner * 0.9);
      ctx.quadraticCurveTo(
        p.x + Math.cos(a + 0.25) * outer,
        p.y + Math.sin(a + 0.25) * outer * 0.9,
        p.x + Math.cos(a + 0.12) * outer * 1.12,
        p.y + Math.sin(a + 0.12) * outer,
      );
      ctx.stroke();
    }
    ctx.restore();
  }

  drawPack(ctx, x, y, now) {
    const p = this.toScreen(x, y);
    const r = this.roomRect;
    const s = Math.max(10, Math.min(r.w, r.h) * 0.034);
    const bob = Math.sin(now * 2 + hashString(`${x}-${y}`)) * 1.2;
    ctx.save();
    drawGlowCircle(ctx, p.x, p.y + bob, s * 2.4, 'rgba(227, 194, 139, 0.12)', 'rgba(227, 194, 139, 0)');

    // Shadow.
    ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
    ctx.beginPath();
    ctx.ellipse(p.x, p.y + s * 0.45, s * 0.65, s * 0.2, 0, 0, TAU);
    ctx.fill();

    ctx.translate(p.x, p.y + bob);
    ctx.strokeStyle = 'rgba(227, 194, 139, 0.72)';
    ctx.lineWidth = 1;
    ctx.fillStyle = 'rgba(44, 34, 18, 0.9)';
    pathRoundRect(ctx, -s * 0.58, -s * 0.32, s * 1.16, s * 0.85, s * 0.22);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, -s * 0.3, s * 0.4, Math.PI, 0);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-s * 0.35, -s * 0.25);
    ctx.lineTo(-s * 0.35, s * 0.35);
    ctx.moveTo(s * 0.35, -s * 0.25);
    ctx.lineTo(s * 0.35, s * 0.35);
    ctx.strokeStyle = 'rgba(227, 194, 139, 0.28)';
    ctx.stroke();
    ctx.fillStyle = 'rgba(227, 194, 139, 0.7)';
    ctx.beginPath();
    ctx.arc(0, s * 0.1, s * 0.07, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  playerFrame(facing, moving, walkClock) {
    const set = FACING[facing] || FACING.down;
    if (!moving) return set.idle;
    const step = Math.floor(walkClock * 8) % 4;
    return set.walk[step === 3 ? 1 : step];
  }

  drawPlayer(ctx, options) {
    const { x, y, facing, moving, walkClock, invulnerable, dashTrail, trial } = options;
    const p = this.toScreen(x, y);
    const r = this.roomRect;
    const scale = clamp(r.w / 88, 2.9, 4.4);
    const w = SPRITE.frameWidth * scale;
    const h = SPRITE.frameHeight * scale;

    ctx.save();
    // Shadow.
    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
    ctx.beginPath();
    ctx.ellipse(p.x, p.y + 2, w * 0.32, h * 0.08, 0, 0, TAU);
    ctx.fill();

    if (trial) {
      drawGlowCircle(ctx, p.x, p.y - h * 0.36, w * 0.55, 'rgba(159, 216, 200, 0.1)', 'rgba(159, 216, 200, 0)');
    }

    for (const ghost of dashTrail) {
      const gp = this.toScreen(ghost.x, ghost.y);
      ctx.globalAlpha = Math.max(0, ghost.alpha * 0.35);
      this.blitPlayerFrame(ctx, ghost.facing || facing, moving, walkClock, gp.x, gp.y, w, h);
    }
    ctx.globalAlpha = 1;

    if (invulnerable) {
      ctx.globalAlpha = 0.46 + Math.abs(Math.sin(performance.now() * 0.025)) * 0.42;
    }

    this.blitPlayerFrame(ctx, facing, moving, walkClock, p.x, p.y, w, h);
    ctx.globalAlpha = 1;

    if (trial) {
      ctx.strokeStyle = 'rgba(159, 216, 200, 0.32)';
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.ellipse(p.x, p.y + 1, w * 0.19, w * 0.07, 0, 0, TAU);
      ctx.stroke();
    }
    ctx.restore();
  }

  blitPlayerFrame(ctx, facing, moving, walkClock, x, y, w, h) {
    const image = this.assets.walk;
    const frame = this.playerFrame(facing, moving, walkClock);
    if (image && image.complete && image.naturalWidth) {
      const sx = SPRITE.originX + frame * SPRITE.pitch;
      ctx.save();
      ctx.imageSmoothingEnabled = false;
      ctx.shadowColor = 'rgba(219, 240, 231, 0.42)';
      ctx.shadowBlur = 8;
      ctx.drawImage(
        image,
        sx, SPRITE.originY, SPRITE.frameWidth, SPRITE.frameHeight,
        x - w / 2, y - h + 3, w, h,
      );
      ctx.restore();
      return;
    }
    // Fallback silhouette.
    ctx.fillStyle = 'rgba(232, 239, 230, 0.84)';
    ctx.beginPath();
    ctx.ellipse(x, y - h * 0.6, w * 0.22, h * 0.28, 0, 0, TAU);
    ctx.fill();
    ctx.fillRect(x - w * 0.2, y - h * 0.38, w * 0.4, h * 0.37);
  }

  drawTrialField(ctx, trial, now) {
    const r = this.roomRect;
    const cx = r.x + r.w / 2;
    const cy = r.y + r.h / 2;
    const beat = ((trial.elapsed / (trial.beatSeconds || 0.5)) % 1);
    const beatRadius = r.w * (0.18 + 0.02 * Math.sin(beat * Math.PI));

    ctx.save();
    ctx.strokeStyle = `rgba(227, 194, 139, ${0.05 + (1 - beat) * 0.12})`;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(cx, cy, beatRadius * 3.2, 0, TAU);
    ctx.stroke();

    // Bullet trails first.
    for (const bullet of trial.bullets) {
      const p = this.toScreen(bullet.x, bullet.y);
      const radius = Math.max(1.8, bullet.r * Math.min(r.w, r.h) * 1.15);
      const speed = Math.hypot(bullet.vx || 0, bullet.vy || 0) || 1;
      const trail = Math.min(42, radius * 5.5);
      const tx = p.x - (bullet.vx / speed) * trail;
      const ty = p.y - (bullet.vy / speed) * trail;
      const color = bullet.color || '232, 198, 139';
      const gradient = ctx.createLinearGradient(tx, ty, p.x, p.y);
      gradient.addColorStop(0, `rgba(${color}, 0)`);
      gradient.addColorStop(1, `rgba(${color}, 0.55)`);
      ctx.strokeStyle = gradient;
      ctx.lineWidth = radius * 1.25;
      ctx.beginPath();
      ctx.moveTo(tx, ty);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();

      drawGlowCircle(ctx, p.x, p.y, radius * 3.4, `rgba(${color}, 0.18)`, `rgba(${color}, 0)`);
      ctx.fillStyle = `rgba(${color}, 0.94)`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, radius, 0, TAU);
      ctx.fill();
      ctx.fillStyle = 'rgba(255, 252, 237, 0.85)';
      ctx.beginPath();
      ctx.arc(p.x - radius * 0.22, p.y - radius * 0.24, radius * 0.36, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
    void now;
  }

  drawTrialOverlay(ctx, trial, now) {
    const r = this.roomRect;
    ctx.save();
    // Edge warning glow that intensifies as the trial gets harder.
    const progress = clamp(trial.elapsed / trial.duration, 0, 1);
    const inset = ctx.createLinearGradient(0, r.y, 0, r.y + r.h);
    inset.addColorStop(0, `rgba(219, 117, 104, ${0.04 + progress * 0.05})`);
    inset.addColorStop(0.22, 'rgba(219, 117, 104, 0)');
    inset.addColorStop(0.78, 'rgba(219, 117, 104, 0)');
    inset.addColorStop(1, `rgba(219, 117, 104, ${0.04 + progress * 0.05})`);
    ctx.fillStyle = inset;
    ctx.fillRect(r.x, r.y, r.w, r.h);

    if (trial.hitPulse > 0) {
      ctx.fillStyle = `rgba(219, 117, 104, ${trial.hitPulse * 0.22})`;
      ctx.fillRect(r.x, r.y, r.w, r.h);
    }
    ctx.restore();
    void now;
  }

  drawDust(ctx, now) {
    const { width: w, height: h } = this;
    ctx.save();
    for (const mote of this.dust) {
      const x = ((mote.x + now * mote.speed) % 1) * w;
      const y = (mote.y + Math.sin(now * 0.3 + mote.phase) * 0.006) * h;
      ctx.fillStyle = `rgba(205, 226, 217, ${mote.alpha})`;
      ctx.beginPath();
      ctx.arc(x, y, mote.r, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }

  drawRoomVignette(ctx, room) {
    const r = this.roomRect;
    ctx.save();
    const vignette = ctx.createRadialGradient(
      r.x + r.w / 2, r.y + r.h / 2, r.w * 0.25,
      r.x + r.w / 2, r.y + r.h / 2, r.w * 0.78,
    );
    vignette.addColorStop(0, 'rgba(0, 0, 0, 0)');
    vignette.addColorStop(1, 'rgba(0, 0, 0, 0.52)');
    ctx.fillStyle = vignette;
    ctx.fillRect(r.x, r.y, r.w, r.h);

    if (room.kind === 'danger') {
      const pulse = 0.5 + Math.sin(performance.now() * 0.0022) * 0.5;
      ctx.strokeStyle = `rgba(219, 117, 104, ${0.07 + pulse * 0.06})`;
      ctx.lineWidth = 2;
      pathRoundRect(ctx, r.x + 2, r.y + 2, r.w - 4, r.h - 4, 9);
      ctx.stroke();
    }
    ctx.restore();
  }

  drawStageVignette(ctx) {
    const { width: w, height: h } = this;
    ctx.save();
    const top = ctx.createLinearGradient(0, 0, 0, h * 0.22);
    top.addColorStop(0, 'rgba(2, 5, 5, 0.58)');
    top.addColorStop(1, 'rgba(2, 5, 5, 0)');
    ctx.fillStyle = top;
    ctx.fillRect(0, 0, w, h * 0.22);

    const bottom = ctx.createLinearGradient(0, h * 0.78, 0, h);
    bottom.addColorStop(0, 'rgba(2, 5, 5, 0)');
    bottom.addColorStop(1, 'rgba(2, 5, 5, 0.72)');
    ctx.fillStyle = bottom;
    ctx.fillRect(0, h * 0.78, w, h * 0.22);
    ctx.restore();
  }
}
