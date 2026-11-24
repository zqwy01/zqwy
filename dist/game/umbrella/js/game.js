/* НЕМЕТОН — game loop, chart judgement, HUD and ritual flow. */
(function () {
  'use strict';

  const CH = window.NEMETON_CHART;
  const Art = window.NemetonArt;
  const AudioEngine = window.NemetonAudio;
  if (!CH || !Art || !AudioEngine) {
    document.body.innerHTML = '<p style="padding:2rem;color:#d8d4b4;font-family:monospace">Ошибка: не загрузились данные игры.</p>';
    return;
  }

  const W = Art.W, H = Art.H, HIT_Y = Art.HIT_Y, LANE_X = Art.LANE_X;
  const LANE_COLORS = CH.lanes.map(l => l.color);
  const INSTR = CH.instruments || {};
  const LANE_GLYPHS = CH.lanes.map(l => l.glyph || 'rune');
  const TRAVEL = 1.55;
  const SPAWN_Y = -20;
  const SPEED = (HIT_Y - SPAWN_Y) / TRAVEL;
  const MISS_GRACE = 0.175;
  const TOTAL_NOTES = CH.notes.length;

  const BASE_SCORE = { perfect: 300, good: 200, ok: 100 };

  const $ = id => document.getElementById(id);
  const worldCanvas = $('world');
  const uiCanvas = $('ui');
  const boot = $('boot');
  const bootSub = $('boot-sub');
  const bootBar = $('boot-bar');
  const wctx = worldCanvas.getContext('2d', { alpha: false });
  const uctx = uiCanvas.getContext('2d');

  const audio = new AudioEngine();

  const S = {
    phase: 'boot',
    ambient: 0,
    t: 0,
    songTime: 0,
    section: null,
    sectionIndex: -1,
    banner: { name: '', sub: '', num: '', age: 0, dur: 0 },
    notes: [],
    particles: [],
    rings: [],
    popups: [],
    score: 0,
    combo: 0,
    maxCombo: 0,
    aura: 0,
    blessing: 0,
    blessingMax: 8,
    stats: { perfect: 0, good: 0, ok: 0, miss: 0 },
    bloom: 0.16,
    level: 0.22,
    bass: 0, mid: 0, high: 0,
    bassP: 0, midP: 0, highP: 0, nov: 0,
    beatPulse: 0, downPulse: 0, beatIndex: -1,
    swell: 0, flash: 0, fade: 0, missFlash: 0,
    toast: { text: '', life: 0, max: 1.4 },
    result: null,
    best: null,
    settings: { offsetMs: 0, volume: 0.9, sfx: true },
    lastMissFx: -10,
    leafAcc: 0,
    emberAcc: 0,
    eventFlags: {},
    startLock: false,
    lowFps: 0,
    instrPulse: [0, 0, 0, 0],
    instrFlash: [0, 0, 0, 0],
    shake: 0,
    birds: [],
    birdTimer: 2.8,
    birdCues: {}
  };

  let vw = 0, vh = 0, dpr = 1;
  let ox = 0, oy = 0, sx = 1, sy = 1, cw = W, ch = H;
  let base = 20;
  let last = 0;
  let raf = 0;

  // ---------- settings & best ----------
  function loadStore() {
    try {
      const s = JSON.parse(localStorage.getItem('nemeton.settings') || '{}');
      if (Number.isFinite(s.offsetMs)) S.settings.offsetMs = clamp(s.offsetMs, -200, 200);
      if (Number.isFinite(s.volume)) S.settings.volume = clamp(s.volume, 0, 1);
      if (typeof s.sfx === 'boolean') S.settings.sfx = s.sfx;
    } catch (e) {}
    try {
      const b = JSON.parse(localStorage.getItem('nemeton.best') || 'null');
      if (b && Number.isFinite(b.score)) S.best = b;
    } catch (e) {}
  }

  function saveSettings() {
    try { localStorage.setItem('nemeton.settings', JSON.stringify(S.settings)); } catch (e) {}
  }

  function saveBest() {
    if (!S.result) return false;
    const prev = S.best ? S.best.score : -1;
    if (S.result.score > prev) {
      S.best = {
        score: S.result.score,
        acc: Math.round(S.result.acc * 10) / 10,
        combo: S.result.maxCombo,
        rank: S.result.rank.name
      };
      try { localStorage.setItem('nemeton.best', JSON.stringify(S.best)); } catch (e) {}
      return true;
    }
    return false;
  }

  // ---------- resize ----------
  function resize() {
    vw = Math.max(320, window.innerWidth || 960);
    vh = Math.max(240, window.innerHeight || 540);
    dpr = Math.min(2, window.devicePixelRatio || 1);

    let s = Math.min(vw / W, vh / H);
    if (s >= 1) {
      // Крупнейший полуцелый множитель, который влезает в окно: картинка
      // заметно крупнее, а соседние пиксели остаются резкими.
      s = Math.floor(s * 2) / 2;
      if (s < 1) s = 1;
    } else {
      s = Math.max(0.35, s);
    }

    cw = Math.round(W * s);
    ch = Math.round(H * s);
    ox = Math.round((vw - cw) / 2);
    oy = Math.round((vh - ch) / 2);
    sx = cw / W;
    sy = ch / H;

    worldCanvas.style.width = cw + 'px';
    worldCanvas.style.height = ch + 'px';
    worldCanvas.style.left = ox + 'px';
    worldCanvas.style.top = oy + 'px';

    uiCanvas.width = Math.max(1, Math.round(vw * dpr));
    uiCanvas.height = Math.max(1, Math.round(vh * dpr));
    uiCanvas.style.width = vw + 'px';
    uiCanvas.style.height = vh + 'px';
    uctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    base = clamp(Math.round(Math.min(vw / 52, vh / 31)), 12, 30);
  }

  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const lerp = (a, b, t) => a + (b - a) * t;

  function ensureFont() {
    if (document.fonts && document.fonts.load) {
      document.fonts.load('16px Tiny5').catch(() => {});
    }
  }

  // ---------- audio loading ----------
  async function bootAudio() {
    loadStore();
    audio.setVolume(S.settings.volume);
    audio.setOffsetMs(S.settings.offsetMs);
    audio.sfxOn = S.settings.sfx;
    try {
      await audio.load((p) => {
        const pct = Math.round(clamp(p, 0, 1) * 100);
        if (bootBar) bootBar.style.width = pct + '%';
        if (bootSub && p < 1) bootSub.textContent = 'РОЩА ПРОСЫПАЕТСЯ… ' + pct + '%';
      });
      S.phase = 'menu';
      S.t = 0;
      if (boot) {
        boot.classList.add('gone');
        setTimeout(() => { boot.style.display = 'none'; }, 700);
      }
      // ambient preview starts immediately
      S.bloom = 0.16;
      S.section = CH.sections[0];
    } catch (e) {
      S.phase = 'error';
      if (bootBar) bootBar.style.width = '100%';
      if (bootSub) {
        bootSub.classList.add('boot-error');
        bootSub.innerHTML =
          '<b>ТРЕК НЕ ЗАГРУЗИЛСЯ</b><br>' +
          'Открой игру через <code>./play.sh</code> или локальный сервер:<br>' +
          '<code>python3 -m http.server 8080</code><br>' +
          'Файл: <code>assets/umbrella.wav</code><br><br>' +
          '<span style="color:#789c8a">Кликни сюда, чтобы попробовать снова</span>';
      }
      if (boot) {
        boot.style.cursor = 'pointer';
        boot.addEventListener('click', () => location.reload(), { once: true });
      }
      console.error(e);
    }
  }

  // ---------- run helpers ----------
  function makeNotes() {
    return CH.notes.map((n, i) => ({
      i, t: n.t, l: n.l, s: n.s,
      ins: n.i || 'perc',
      v: n.v === undefined ? 0.5 : n.v,
      p: n.p || 0,
      g: n.g || (INSTR[n.i] && INSTR[n.i].glyph) || 'rune',
      h: n.h || 0,
      runes: (n.l % 4) + 1,
      judged: false, hit: false, quality: null
    }));
  }

  function sectionAt(t) {
    for (let i = CH.sections.length - 1; i >= 0; i--) {
      if (t >= CH.sections[i].t0) return i;
    }
    return 0;
  }

  function envAt(arr, t) {
    const f = clamp(t, 0, CH.duration) * CH.env.fps;
    const i = Math.floor(f);
    const k = clamp(f - i, 0, 1);
    const a = arr[Math.min(i, arr.length - 1)] || 0;
    const b = arr[Math.min(i + 1, arr.length - 1)] || a;
    return lerp(a, b, k) / 255;
  }

  function announce(sec, force) {
    if (!sec) return;
    S.banner = { name: sec.name, sub: sec.sub, num: sec.num, age: 0, dur: force ? 4.2 : 3.4 };
  }

  function resetRun() {
    S.notes = makeNotes();
    S.particles = [];
    S.rings = [];
    S.popups = [];
    S.score = 0;
    S.combo = 0;
    S.maxCombo = 0;
    S.aura = 0;
    S.blessing = 0;
    S.stats = { perfect: 0, good: 0, ok: 0, miss: 0 };
    S.bloom = 0.055;
    S.swell = 0; S.flash = 0; S.fade = 0; S.missFlash = 0;
    S.songTime = 0;
    S.eventFlags = {};
    S.leafAcc = 0; S.emberAcc = 0;
    S.lastMissFx = -10;
    S.result = null;
    S.toast = { text: '', life: 0, max: 1.4 };
    S.sectionIndex = -1;
    S.blessingMax = 8;
    S.instrPulse = [0, 0, 0, 0];
    S.instrFlash = [0, 0, 0, 0];
    S.shake = 0;
    S.birds = [];
    S.birdTimer = 3.2;
    S.birdCues = {};
  }

  async function startGame() {
    if (S.startLock) return;
    if (!audio.ready) return;
    S.startLock = true;
    resetRun();
    S.phase = 'playing';
    S.sectionIndex = -1;
    S.section = CH.sections[0];
    S.songTime = 0;
    S.ambient = 0;
    document.body.classList.add('playing');
    announce(CH.sections[0], true);
    S.banner.age = -0.4;
    try {
      await audio.play(0);
    } catch (e) {
      S.phase = 'menu';
      document.body.classList.remove('playing');
      S.toast = { text: 'НЕ УДАЛОСЬ ЗАПУСТИТЬ ТРЕК — НАЖМИ ЕЩЁ РАЗ', life: 2.5, max: 2.5 };
      console.error(e);
    }
    S.startLock = false;
  }

  async function pauseGame() {
    if (S.phase !== 'playing') return;
    audio.pause();
    S.phase = 'paused';
    document.body.classList.remove('playing');
  }

  async function resumeGame() {
    if (S.phase !== 'paused') return;
    const at = Math.max(0, audio.pausedAt || 0);
    S.phase = 'playing';
    document.body.classList.add('playing');
    try {
      await audio.play(at);
    } catch (e) {
      S.phase = 'paused';
      document.body.classList.remove('playing');
    }
  }

  function toMenu() {
    audio.stop();
    S.phase = 'menu';
    S.bloom = 0.16;
    S.notes = [];
    S.particles = [];
    S.rings = [];
    S.popups = [];
    S.ambient = 0;
    S.section = CH.sections[0];
    S.sectionIndex = -1;
    document.body.classList.remove('playing');
  }

  function endGame() {
    if (S.phase === 'end') return;
    // anything still unjudged at the end counts as a miss
    for (const n of S.notes) {
      if (!n.judged) {
        n.judged = true;
        n.missed = true;
        S.stats.miss++;
      }
    }
    S.phase = 'end';
    document.body.classList.remove('playing');
    audio.stop();
    S.combo = 0;
    S.blessing = 0;
    S.result = makeResult();
    S.result.newBest = saveBest();
    S.bloom = clamp(0.35 + S.result.acc / 100 * 0.65, 0, 1);
    S.fade = 0.18;
    S.ambient = 0;
  }

  function makeResult() {
    const judged = S.stats.perfect + S.stats.good + S.stats.ok + S.stats.miss;
    const total = Math.max(1, TOTAL_NOTES);
    const weighted = S.stats.perfect + S.stats.good * 0.72 + S.stats.ok * 0.42;
    const acc = clamp(weighted / total * 100, 0, 100);
    return {
      score: S.score,
      acc,
      maxCombo: S.maxCombo,
      perfect: S.stats.perfect,
      good: S.stats.good,
      ok: S.stats.ok,
      miss: S.stats.miss,
      judged,
      rank: rankFor(acc)
    };
  }

  function rankFor(acc) {
    if (acc >= 96) return { name: 'АРХИДРУИД', sub: 'Роща узнаёт твой голос.', color: '#f0d078' };
    if (acc >= 88) return { name: 'ХРАНИТЕЛЬ', sub: 'Древо склоняет ветви.', color: '#bf9440' };
    if (acc >= 76) return { name: 'УЧЕНИК ДУБА', sub: 'Огам ложится ровно.', color: '#a3c47a' };
    if (acc >= 58) return { name: 'СТРАННИК', sub: 'Туман ещё не рассеялся.', color: '#93b09a' };
    return { name: 'ГОСТЬ ТУМАНА', sub: 'Слушай глубже — роща ждёт.', color: '#5d7d6e' };
  }

  function comboTier() {
    if (S.combo >= 100) return 3;
    if (S.combo >= 50) return 2;
    if (S.combo >= 25) return 1.5;
    if (S.combo >= 10) return 1.25;
    return 1;
  }

  function multiplier() {
    return comboTier() * (S.blessing > 0 ? 2 : 1);
  }

  function startBlessing() {
    S.blessing = S.blessingMax;
    S.aura = 100;
    audio.blessingChime();
    S.rings.push({ x: 240, y: 150, r: 10, maxR: 86, life: 1.1, maxLife: 1.1, color: Art.P.gold2, wide: true });
    for (let i = 0; i < 26; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 20 + Math.random() * 46;
      S.particles.push({
        x: 240, y: 160,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 10,
        life: 0.8 + Math.random() * 0.9, maxLife: 1.7,
        color: Math.random() < 0.5 ? Art.P.gold2 : Art.P.white,
        size: Math.random() < 0.5 ? 1 : 2, kind: 'spark', g: 24
      });
    }
    S.popups.push({ x: 240, y: 126, text: 'ДАР ДУБА', color: Art.P.gold2, life: 1.7, maxLife: 1.7, vy: -11 });
    S.toast = { text: 'ДАР ДУБА · ДВОЙНЫЕ ОЧКИ', life: 2.2, max: 2.2 };
  }

  // ---------- judgement ----------
  function judge(lane) {
    if (S.phase !== 'playing') return;
    const t = S.songTime;
    let best = null, bestDiff = 1e9;
    const winPerfect = 0.052 + (S.blessing > 0 ? 0.028 : 0);
    const winOk = 0.155 + (S.blessing > 0 ? 0.02 : 0);
    for (const n of S.notes) {
      if (n.judged || n.l !== lane) continue;
      const d = Math.abs(n.t - t);
      if (d < bestDiff && d <= winOk) { best = n; bestDiff = d; }
    }
    if (!best) return;
    let q;
    if (bestDiff <= winPerfect) q = 'perfect';
    else if (bestDiff <= 0.105) q = 'good';
    else q = 'ok';
    best.judged = true;
    best.hit = true;
    best.quality = q;
    S.stats[q]++;
    S.combo++;
    if (S.combo > S.maxCombo) S.maxCombo = S.combo;
    const mult = multiplier();
    const gain = Math.round(BASE_SCORE[q] * mult);
    S.score += gain;
    if (S.blessing <= 0) {
      S.aura = clamp(S.aura + (q === 'perfect' ? 2.1 : q === 'good' ? 1.35 : 0.6), 0, 100);
      if (S.aura >= 100) startBlessing();
    }
    spawnHit(lane, q, gain, best);
    audio.tick(q, lane, best.ins);
    if (S.combo > 0 && S.combo % 25 === 0) {
      S.popups.push({
        x: 240, y: 96, text: '×' + S.combo,
        color: Art.P.gold2, life: 1.1, maxLife: 1.1, vy: -9
      });
      for (let i = 0; i < 14; i++) {
        const a = Math.random() * Math.PI * 2;
        S.particles.push({
          x: 240 + Math.cos(a) * 30, y: 120 + Math.sin(a) * 22,
          vx: Math.cos(a) * 24, vy: Math.sin(a) * 24 - 8,
          life: 0.6 + Math.random() * 0.6, maxLife: 1.2,
          color: i % 3 ? Art.P.leaf2 : Art.P.gold2, size: 1, kind: 'spark', g: 14
        });
      }
    }
  }

  function spawnHit(lane, q, gain, n) {
    const x = LANE_X[lane], y = HIT_Y;
    const col = LANE_COLORS[lane];
    const ins = n ? n.ins : 'kick';
    const meta = INSTR[ins] || {};
    const fam = meta.family || 'drum';
    const perfect = q === 'perfect';
    const pal = {
      drum: [col, Art.P.gold2, Art.P.bone1],
      perc: [col, Art.P.gold1, Art.P.leaf2],
      hat: [col, Art.P.leaf2, Art.P.white],
      bell: [col, Art.P.gold2, Art.P.white],
      string: [col, Art.P.gold2, Art.P.leaf2],
      wind: [col, Art.P.water2, Art.P.bone1]
    }[fam] || [col, Art.P.gold2, Art.P.bone1];

    S.instrPulse[lane] = 1;
    S.instrFlash[lane] = 1;

    const nP = perfect ? 16 : q === 'good' ? 10 : 6;
    for (let i = 0; i < nP; i++) {
      const a = -Math.PI * 0.5 + (Math.random() - 0.5) * (perfect ? 2.9 : 2.2);
      const sp = perfect ? 34 + Math.random() * 54 : 20 + Math.random() * 40;
      S.particles.push({
        x: x + (Math.random() - 0.5) * 8,
        y: y - 2,
        vx: Math.cos(a) * sp * (0.5 + Math.random()),
        vy: Math.sin(a) * sp,
        life: 0.45 + Math.random() * (perfect ? 0.7 : 0.4),
        maxLife: perfect ? 1.15 : 0.85,
        color: perfect ? (i % 3 ? Art.P.gold2 : Art.P.white) : pal[i % pal.length],
        size: Math.random() < 0.35 ? 2 : 1,
        kind: perfect ? 'spark' : 'ash',
        g: perfect ? 54 : 28
      });
    }

    S.rings.push({
      x, y, r: 3, maxR: perfect ? 28 : 18,
      life: perfect ? 0.55 : 0.4, maxLife: perfect ? 0.55 : 0.4,
      color: perfect ? Art.P.gold2 : col, wide: perfect
    });

    // instrument-specific reaction
    if (ins === 'kick') {
      S.shake = Math.max(S.shake, perfect ? 0.95 : 0.5);
      S.rings.push({
        x: 240, y: 241, r: 4, maxR: perfect ? 92 : 52,
        life: perfect ? 0.75 : 0.5, maxLife: perfect ? 0.75 : 0.5,
        color: perfect ? Art.P.gold1 : Art.P.bark2, wide: true
      });
      if (perfect) S.flash = Math.max(S.flash, 0.045);
    } else if (ins === 'crash') {
      S.flash = Math.max(S.flash, perfect ? 0.16 : 0.08);
      S.rings.push({
        x, y, r: 8, maxR: 54, life: 0.8, maxLife: 0.8,
        color: Art.P.gold2, wide: true
      });
    } else if (ins === 'cowbell') {
      S.flash = Math.max(S.flash, perfect ? 0.10 : 0.05);
    } else if (ins === 'flute') {
      birdReact();
      for (let i = 0; i < 7; i++) {
        S.particles.push({
          x: x + (Math.random() - 0.5) * 20, y: y - 4,
          vx: (Math.random() - 0.5) * 26, vy: -14 - Math.random() * 18,
          life: 0.5 + Math.random() * 0.6, maxLife: 1.1,
          color: i % 2 ? Art.P.water2 : Art.P.bone1,
          size: 1, kind: 'spark', g: -6
        });
      }
    } else if (fam === 'string') {
      S.rings.push({
        x, y: y - 8, r: 2, maxR: perfect ? 24 : 15,
        life: 0.55, maxLife: 0.55, color: Art.P.leaf2, wide: false
      });
    }

    // an instrument rune drifting up from big moments
    if (perfect && (fam === 'string' || fam === 'wind' || ins === 'cowbell' || ins === 'crash' || ins === 'harpa')) {
      S.particles.push({
        x: x + (Math.random() - 0.5) * 10, y: y - 8,
        vx: (Math.random() - 0.5) * 10, vy: -16 - Math.random() * 8,
        life: 1.05, maxLife: 1.05, color: col, size: 1,
        kind: 'glyph', glyph: n ? n.g : 'rune', g: -2
      });
    }

    S.popups.push({
      x, y: y - 22,
      text: perfect ? 'ИДЕАЛЬНО' : q === 'good' ? 'ХОРОШО' : 'ТОЧНО',
      color: perfect ? Art.P.gold2 : q === 'good' ? Art.P.leaf2 : Art.P.bone0,
      life: perfect ? 0.8 : 0.6, maxLife: perfect ? 0.8 : 0.6, vy: -25
    });
    if (perfect) S.flash = Math.max(S.flash, 0.06);
  }

  // ---------- birds & instrument life ----------
  function spawnBird(opts) {
    opts = opts || {};
    const fromLeft = opts.fromLeft !== undefined ? opts.fromLeft : Math.random() < 0.58;
    const size = opts.size || (Math.random() < 0.16 ? 2 : 1);
    const speed = (opts.speed || 19 + Math.random() * 13) * (size === 2 ? 0.82 : 1);
    const y = opts.y !== undefined ? opts.y : 42 + Math.random() * 98;
    S.birds.push({
      x: fromLeft ? -16 : W + 16,
      y,
      vx: (fromLeft ? 1 : -1) * speed,
      vy: (Math.random() - 0.5) * 2.4,
      wing: Math.random() * Math.PI * 2,
      flap: 5.4 + Math.random() * 3.2,
      size,
      ph: Math.random() * Math.PI * 2,
      react: 0,
      life: 0,
      gold: !!opts.gold,
      layer: opts.layer || (size === 2 ? 1 : 0)
    });
    if (S.birds.length > 16) S.birds.shift();
  }

  function spawnFlock(count, gold) {
    for (let i = 0; i < count; i++) {
      spawnBird({
        fromLeft: Math.random() < 0.5,
        y: 38 + Math.random() * 92,
        size: Math.random() < 0.45 ? 2 : 1,
        speed: 24 + Math.random() * 22,
        gold: gold || Math.random() < 0.35,
        layer: 1
      });
    }
  }

  function birdReact() {
    let best = null, bd = 1e9;
    for (const b of S.birds) {
      const d = Math.abs(b.x - 240) * 0.55 + Math.abs(b.y - 82);
      if (d < bd) { bd = d; best = b; }
    }
    if (best) {
      best.react = 1;
      best.gold = true;
      for (let i = 0; i < 6; i++) {
        S.particles.push({
          x: best.x + (Math.random() - 0.5) * 8,
          y: best.y + (Math.random() - 0.5) * 6,
          vx: (Math.random() - 0.5) * 16,
          vy: -6 - Math.random() * 12,
          life: 0.5 + Math.random() * 0.7, maxLife: 1.2,
          color: i % 2 ? Art.P.gold2 : Art.P.bone1,
          size: 1, kind: 'spark', g: -4
        });
      }
    } else if (S.birds.length < 3) {
      spawnBird({ gold: true, y: 52 + Math.random() * 46, speed: 25 });
    }
  }

  function updateBirds(dt, t) {
    S.birdTimer -= dt;
    if (S.birdTimer <= 0 && S.phase !== 'paused') {
      const tag = S.section ? S.section.tag : 'intro';
      const base = (tag === 'storm' || tag === 'climax') ? 8
        : (tag === 'intro' || tag === 'outro') ? 17 : 12;
      spawnBird({});
      S.birdTimer = base * (0.7 + Math.random() * 0.7);
    }
    for (let i = S.birds.length - 1; i >= 0; i--) {
      const b = S.birds[i];
      b.life += dt;
      b.x += b.vx * dt;
      b.y += b.vy * dt + Math.sin(b.life * 1.7 + b.ph) * 2.4 * dt;
      b.wing += b.flap * dt;
      if (b.react > 0) {
        b.react = Math.max(0, b.react - dt * 1.25);
        b.y -= 10 * dt;
      }
      if (b.y < 26) { b.y = 26; b.vy = Math.abs(b.vy); }
      if (b.y > 154) { b.y = 154; b.vy = -Math.abs(b.vy); }
      if (b.x < -42 || b.x > W + 42) S.birds.splice(i, 1);
    }
  }

  function updateInstrumentFx(dt) {
    for (let i = 0; i < 4; i++) {
      S.instrPulse[i] = Math.max(0, S.instrPulse[i] - dt * 4.4);
      S.instrFlash[i] = Math.max(0, S.instrFlash[i] - dt * 8.5);
    }
    S.shake = Math.max(0, S.shake - dt * 6.5);
  }

  function registerMiss(n) {
    S.stats.miss++;
    S.combo = 0;
    if (S.blessing > 0) {
      S.blessing = Math.max(0, S.blessing - 0.35);
    } else {
      S.aura = Math.max(0, S.aura - 3.4);
    }
    S.missFlash = Math.min(0.5, S.missFlash + 0.22);
    const t = S.songTime;
    if (t - S.lastMissFx > 0.075) {
      S.lastMissFx = t;
      const x = LANE_X[n.l];
      for (let i = 0; i < 5; i++) {
        S.particles.push({
          x: x + (Math.random() - 0.5) * 14,
          y: HIT_Y - 6 + Math.random() * 8,
          vx: (Math.random() - 0.5) * 22,
          vy: -4 - Math.random() * 14,
          life: 0.35 + Math.random() * 0.4, maxLife: 0.75,
          color: i % 2 ? Art.P.stone2 : Art.P.mist1,
          size: 1, kind: 'ash', g: 18
        });
      }
      S.rings.push({ x, y: HIT_Y, r: 2, maxR: 12, life: 0.3, maxLife: 0.3, color: Art.P.stone2, wide: false });
      S.popups.push({ x, y: HIT_Y - 20, text: 'МИМО', color: Art.P.stone2, life: 0.5, maxLife: 0.5, vy: -14 });
    }
  }

  // ---------- update ----------
  function update(dt) {
    S.ambient += dt;
    if (S.phase === 'playing') {
      const t = audio.time;
      S.songTime = t;
      S.t = t;

      if (t >= CH.duration - 0.06 || audio.finished) {
        endGame();
        return;
      }

      updateEnv(t);
      updateSections(t);
      updateBeat(t);
      updateEvents(t, dt);
      updateNotes(t);
      updateBlessing(dt);
      updateBloom(dt);
      updateAmbientParticles(dt, t);
      updateBirds(dt, t);
      updateParticles(dt);
      updateRings(dt);
      updatePopups(dt);
      updateBanner(dt);
      updateToast(dt);
      updateInstrumentFx(dt);
      S.missFlash = Math.max(0, S.missFlash - dt * 2.2);
    } else if (S.phase === 'paused') {
      updateParticles(dt * 0.06);
      updateRings(dt * 0.06);
      updatePopups(dt * 0.06);
      updateBanner(dt * 0.06);
      updateToast(dt);
    } else {
      // menu / end: gentle ambient life
      S.t = S.ambient;
      S.level = (S.phase === 'end' ? 0.18 : 0.24) + Math.sin(S.ambient * 0.5) * 0.025;
      S.bassP = 0.04 + Math.sin(S.ambient * 0.7) * 0.02;
      S.midP = 0.05 + Math.sin(S.ambient * 0.43 + 1) * 0.02;
      S.highP = 0.03 + Math.sin(S.ambient * 0.61 + 2) * 0.02;
      S.beatPulse = 0.05;
      S.downPulse = 0.03;
      updateParticles(dt);
      updateRings(dt);
      updatePopups(dt);
      updateBanner(dt);
      updateToast(dt);
      updateBirds(dt, S.ambient);
      updateInstrumentFx(dt);
      if (S.phase === 'menu') {
        S.bloom = Math.max(S.bloom, 0.16);
      }
    }
  }

  function updateEnv(t) {
    const env = CH.env;
    S.level = envAt(env.level, t);
    S.bass = envAt(env.bass, t);
    S.mid = envAt(env.mid, t);
    S.high = envAt(env.high, t);
    S.bassP = clamp(envAt(env.bassP, t) * 0.84 + audio.getLevels().bass * 0.26, 0, 1);
    S.midP = clamp(envAt(env.midP, t) * 0.84 + audio.getLevels().mid * 0.26, 0, 1);
    S.highP = clamp(envAt(env.highP, t) * 0.84 + audio.getLevels().high * 0.26, 0, 1);
    S.nov = envAt(env.nov, t);
  }

  function updateSections(t) {
    const idx = sectionAt(t);
    if (idx !== S.sectionIndex) {
      S.sectionIndex = idx;
      S.section = CH.sections[idx];
      if (S.phase === 'playing' && !S.startLock) {
        announce(S.section, idx === 0);
        S.flash = Math.max(S.flash, 0.10);
      }
    }
  }

  function updateBeat(t) {
    const beat = CH.beat;
    const phase = (t / beat) % 1;
    S.beatPulse = Math.pow(1 - phase, 2.3);
    const barPhase = (t / (beat * 4)) % 1;
    S.downPulse = Math.pow(1 - barPhase, 2.6);
    S.beatIndex = Math.floor(t / beat);
  }

  function updateBlessing(dt) {
    if (S.blessing > 0) {
      S.blessing = Math.max(0, S.blessing - dt);
      S.aura = 100 * (S.blessing / S.blessingMax);
      if (S.blessing === 0) S.aura = 0;
    }
  }

  function updateBloom(dt) {
    const played = (S.stats.perfect + S.stats.good + S.stats.ok) / TOTAL_NOTES;
    const target = clamp(S.maxCombo / 72 * 0.72 + played * 0.28, 0, 1);
    S.bloom += (target - S.bloom) * Math.min(1, dt * 2.2);
  }

  function updateNotes(t) {
    for (const n of S.notes) {
      if (n.judged) continue;
      if (t > n.t + MISS_GRACE) {
        n.judged = true;
        n.missed = true;
        registerMiss(n);
      }
    }
  }

  function updateEvents(t, dt) {
    // the reverb throw: the grove disappears into mist before the drop
    if (t >= 24.545 && t < 27.273) {
      const u = clamp((t - 24.545) / (27.273 - 24.545), 0, 1);
      S.swell = Math.pow(u, 1.7);
    } else {
      S.swell = Math.max(0, S.swell - dt * 2.4);
    }
    // burst at 27.273
    if (t >= 27.273 && !S.eventFlags.burst) {
      S.eventFlags.burst = true;
      S.flash = 0.8;
      S.swell = 0;
      for (let i = 0; i < 34; i++) {
        const a = Math.random() * Math.PI * 2;
        const sp = 30 + Math.random() * 90;
        S.particles.push({
          x: 240, y: 185,
          vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 20,
          life: 0.7 + Math.random() * 1.1, maxLife: 1.8,
          color: i % 3 ? Art.P.gold2 : Art.P.leaf2, size: Math.random() < 0.3 ? 2 : 1,
          kind: 'spark', g: 34
        });
      }
      S.rings.push({ x: 240, y: 190, r: 6, maxR: 130, life: 1.2, maxLife: 1.2, color: Art.P.gold2, wide: true });
    }
    // phaser click
    if (t >= 38.182 && !S.eventFlags.flash) {
      S.eventFlags.flash = true;
      S.flash = 0.45;
    }
    // first kick of the drop
    if (t >= 16.4 && !S.eventFlags.dropFx) {
      S.eventFlags.dropFx = true;
      S.flash = Math.max(S.flash, 0.12);
      S.shake = Math.max(S.shake, 0.55);
      S.rings.push({ x: 240, y: 210, r: 4, maxR: 84, life: 0.7, maxLife: 0.7, color: Art.P.gold1, wide: true });
    }
    // storm transition
    if (t >= 43.636 && !S.eventFlags.storm) {
      S.eventFlags.storm = true;
      S.flash = Math.max(S.flash, 0.14);
    }
    // climax
    if (t >= 54.545 && !S.eventFlags.climax) {
      S.eventFlags.climax = true;
      S.flash = Math.max(S.flash, 0.34);
      S.shake = Math.max(S.shake, 0.8);
      S.bloom = Math.min(1, S.bloom + 0.16);
      S.rings.push({ x: 240, y: 160, r: 12, maxR: 110, life: 1.0, maxLife: 1.0, color: Art.P.gold1, wide: true });
      S.rings.push({ x: 240, y: 214, r: 6, maxR: 132, life: 1.3, maxLife: 1.3, color: Art.P.gold2, wide: true });
      for (let i = 0; i < 38; i++) {
        const a = -Math.PI * 0.5 + (Math.random() - 0.5) * Math.PI * 1.7;
        const sp = 34 + Math.random() * 96;
        S.particles.push({
          x: 240 + (Math.random() - 0.5) * 30, y: 172 + Math.random() * 24,
          vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 12,
          life: 0.8 + Math.random() * 1.2, maxLife: 2.0,
          color: i % 3 ? Art.P.gold2 : Art.P.leaf2,
          size: Math.random() < 0.35 ? 2 : 1,
          kind: 'spark', g: 40
        });
      }
    }
    // outro fade
    if (t >= 65.455) {
      S.fade = clamp((t - 65.455) / (CH.duration - 65.455), 0, 1) * 0.42;
    } else {
      S.fade = 0;
    }

    // birds follow the song's big breaths
    if (t >= 1.1 && !S.eventFlags.birdFirst) {
      S.eventFlags.birdFirst = true;
      spawnBird({ fromLeft: true, y: 72, size: 1, speed: 20 });
    }
    if (t >= 4.6 && !S.eventFlags.birdIntro) {
      S.eventFlags.birdIntro = true;
      spawnBird({ fromLeft: true, y: 66, size: 1, speed: 22 });
    }
    if (t >= 16.5 && !S.eventFlags.birdDrop) {
      S.eventFlags.birdDrop = true;
      spawnBird({ fromLeft: false, y: 58, size: 2, speed: 26, gold: true });
    }
    if (t >= 27.273 && !S.eventFlags.birdBurst) {
      S.eventFlags.birdBurst = true;
      spawnFlock(4, false);
    }
    if (t >= 38.35 && !S.eventFlags.birdEarth) {
      S.eventFlags.birdEarth = true;
      spawnBird({ fromLeft: true, y: 46, size: 1, speed: 20 });
      spawnBird({ fromLeft: false, y: 96, size: 1, speed: 20 });
    }
    if (t >= 43.7 && !S.eventFlags.birdStorm) {
      S.eventFlags.birdStorm = true;
      spawnFlock(3, false);
    }
    if (t >= 54.6 && !S.eventFlags.birdClimax) {
      S.eventFlags.birdClimax = true;
      spawnFlock(6, true);
    }
    if (t >= 65.6 && !S.eventFlags.birdOutro) {
      S.eventFlags.birdOutro = true;
      spawnBird({ fromLeft: true, y: 54, size: 2, speed: 16, gold: true });
    }

    S.flash = Math.max(0, S.flash - dt * 1.8);
  }

  function updateAmbientParticles(dt, t) {
    const tag = S.section ? S.section.tag : 'intro';
    if (tag === 'storm' || tag === 'climax') {
      S.leafAcc += dt * (tag === 'storm' ? 15 : 9);
      while (S.leafAcc >= 1) {
        S.leafAcc -= 1;
        if (S.particles.length > 420) break;
        S.particles.push({
          x: Math.random() * (W + 40) - 20,
          y: -8 - Math.random() * 10,
          vx: 8 + Math.random() * 20,
          vy: 20 + Math.random() * 30,
          life: 6 + Math.random() * 4, maxLife: 10,
          color: [Art.P.leaf0, Art.P.leaf1, Art.P.leaf2, Art.P.gold1][Math.floor(Math.random() * 4)],
          size: 1, kind: 'leaf', g: 2
        });
      }
    }
    if (tag === 'fire' || tag === 'sparks' || tag === 'climax') {
      S.emberAcc += dt * 5;
      while (S.emberAcc >= 1) {
        S.emberAcc -= 1;
        if (S.particles.length > 460) break;
        S.particles.push({
          x: 232 + (Math.random() - 0.5) * 18,
          y: 234,
          vx: (Math.random() - 0.5) * 10,
          vy: -24 - Math.random() * 34,
          life: 1.2 + Math.random() * 1.6, maxLife: 2.8,
          color: Math.random() < 0.5 ? Art.P.fire2 : Art.P.gold2,
          size: 1, kind: 'spark', g: -4
        });
      }
    }
    if (S.blessing > 0) {
      if (Math.random() < dt * 22) {
        S.particles.push({
          x: 240 + (Math.random() - 0.5) * 130,
          y: 80 + Math.random() * 100,
          vx: (Math.random() - 0.5) * 10,
          vy: -8 - Math.random() * 14,
          life: 0.8 + Math.random() * 1.2, maxLife: 2,
          color: Math.random() < 0.6 ? Art.P.gold2 : Art.P.white,
          size: 1, kind: 'spark', g: 4
        });
      }
    }
  }

  function updateParticles(dt) {
    const arr = S.particles;
    for (let i = arr.length - 1; i >= 0; i--) {
      const p = arr[i];
      p.life -= dt;
      if (p.life <= 0) { arr.splice(i, 1); continue; }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.g) p.vy += p.g * dt;
      if (p.kind === 'leaf') {
        p.vx += Math.sin(p.y * 0.08 + p.life * 2) * 8 * dt;
        p.vx = clamp(p.vx, -30, 40);
      }
      if (p.y > H + 12 || p.x < -30 || p.x > W + 30) arr.splice(i, 1);
    }
    if (arr.length > 520) arr.splice(0, arr.length - 520);
  }

  function updateRings(dt) {
    const arr = S.rings;
    for (let i = arr.length - 1; i >= 0; i--) {
      const r = arr[i];
      r.life -= dt;
      if (r.life <= 0) { arr.splice(i, 1); continue; }
      r.r += (r.maxR - r.r) * Math.min(1, dt * 9);
    }
  }

  function updatePopups(dt) {
    const arr = S.popups;
    for (let i = arr.length - 1; i >= 0; i--) {
      const p = arr[i];
      p.life -= dt;
      if (p.life <= 0) { arr.splice(i, 1); continue; }
      p.y += p.vy * dt;
      p.vy *= 0.98;
    }
  }

  function updateBanner(dt) {
    if (S.banner.dur <= 0) return;
    S.banner.age += dt;
  }

  function updateToast(dt) {
    if (S.toast.life > 0) S.toast.life = Math.max(0, S.toast.life - dt);
  }

  // ---------- drawing world ----------
  function drawWorld() {
    const visibleNotes = [];
    if (S.phase === 'playing' || S.phase === 'paused') {
      for (const n of S.notes) {
        if (n.judged) continue;
        const dn = n.t - S.songTime;
        if (dn > -0.28 && dn < TRAVEL + 0.35) {
          const y = HIT_Y - dn * SPEED;
          if (y > -30 && y < HIT_Y + 20) {
            visibleNotes.push({
              x: LANE_X[n.l], y, lane: n.l, runes: n.runes, s: n.s, t: n.t,
              g: n.g, ins: n.ins,
              h: n.h * clamp(dn / 0.7, 0, 1)
            });
          }
        }
      }
    }
    const state = {
      t: S.t,
      level: S.level,
      bassP: S.bassP,
      midP: S.midP,
      highP: S.highP,
      nov: S.nov,
      beatPulse: clamp(S.beatPulse * 0.75 + S.downPulse * 0.35, 0, 1),
      section: S.section,
      bloom: S.bloom,
      aura: S.aura,
      blessing: S.blessing,
      notes: visibleNotes,
      particles: S.particles,
      rings: S.rings,
      swell: S.swell,
      flash: S.flash,
      fade: S.fade,
      instrPulse: S.instrPulse,
      instrFlash: S.instrFlash,
      shake: S.shake,
      birds: S.birds,
      laneGlyphs: LANE_GLYPHS
    };
    Art.drawWorld(wctx, state);
    // miss vignette flash on top of the world
    if (S.missFlash > 0.001) {
      wctx.fillStyle = 'rgba(120, 50, 34,' + (S.missFlash * 0.16).toFixed(3) + ')';
      wctx.fillRect(0, 0, W, H);
    }
  }

  // ---------- drawing overlay ----------
  function alignPx(v) {
    return dpr ? Math.round(v * dpr) / dpr : v;
  }

  function snapFontSize(size) {
    // Tiny5 нарисован по сетке 8 px: при кратном размере каждая «пиксельная»
    // клетка шрифта попадает в целое число экранных пикселей.
    // dpr учитывается, поэтому на Retina-экранах шаг мельче.
    const step = 8 / dpr;
    const snapped = Math.round(size / step) * step;
    const minSize = Math.max(8, step);
    return Math.max(minSize, snapped);
  }

  function font(size) {
    const px = snapFontSize(size);
    return (Math.round(px * 100) / 100) + 'px Tiny5, "Courier New", monospace';
  }

  function text(str, x, y, size, color, align, alpha, shadow) {
    y = alignPx(y);
    const px = snapFontSize(size);
    uctx.save();
    uctx.globalAlpha = alpha === undefined ? 1 : alpha;
    uctx.font = font(size);
    uctx.textBaseline = 'middle';
    uctx.textAlign = 'left';
    const tw = uctx.measureText(str).width;
    let tx = x;
    if (align === 'center') tx = x - tw / 2;
    else if (align === 'right') tx = x - tw;
    tx = alignPx(tx);
    if (shadow !== false) {
      const off = Math.max(1 / dpr, Math.round(px * 0.05 * dpr) / dpr);
      uctx.fillStyle = 'rgba(2, 6, 4, .82)';
      uctx.fillText(str, tx + off, y + off);
    }
    uctx.fillStyle = color;
    uctx.fillText(str, tx, y);
    uctx.restore();
  }

  function spaced(str, x, y, size, color, spacing, align, alpha) {
    x = alignPx(x);
    y = alignPx(y);
    const px = snapFontSize(size);
    uctx.save();
    uctx.globalAlpha = alpha === undefined ? 1 : alpha;
    uctx.font = font(size);
    uctx.textBaseline = 'middle';
    const chars = Array.from(str);
    const widths = chars.map(c => uctx.measureText(c).width);
    const total = widths.reduce((a, b) => a + b, 0) + spacing * (chars.length - 1);
    let cx = align === 'center' ? x - total / 2 : align === 'right' ? x - total : x;
    uctx.fillStyle = 'rgba(2, 6, 4, .8)';
    let tx = cx;
    for (let i = 0; i < chars.length; i++) {
      uctx.fillText(chars[i], alignPx(tx), y + Math.max(1 / dpr, Math.round(px * 0.05 * dpr) / dpr));
      tx += widths[i] + spacing;
    }
    tx = align === 'center' ? x - total / 2 : align === 'right' ? x - total : x;
    uctx.fillStyle = color;
    for (let i = 0; i < chars.length; i++) {
      uctx.fillText(chars[i], alignPx(tx), y);
      tx += widths[i] + spacing;
    }
    uctx.restore();
  }

  function wrap(str, maxW, size) {
    uctx.save();
    uctx.font = font(size);
    const words = str.split(' ');
    const lines = [];
    let line = '';
    for (const w of words) {
      const test = line ? line + ' ' + w : w;
      if (uctx.measureText(test).width > maxW && line) {
        lines.push(line);
        line = w;
      } else {
        line = test;
      }
    }
    if (line) lines.push(line);
    uctx.restore();
    return lines;
  }

  function panel(x, y, w, h, a) {
    uctx.fillStyle = 'rgba(3, 9, 7, ' + (a === undefined ? 0.78 : a) + ')';
    uctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
    uctx.fillStyle = 'rgba(191, 148, 64, .26)';
    uctx.fillRect(Math.round(x), Math.round(y), Math.round(w), 1);
    uctx.fillRect(Math.round(x), Math.round(y + h - 1), Math.round(w), 1);
    uctx.fillStyle = 'rgba(61, 74, 66, .35)';
    uctx.fillRect(Math.round(x), Math.round(y), 1, Math.round(h));
    uctx.fillRect(Math.round(x + w - 1), Math.round(y), 1, Math.round(h));
  }

  function triskele(cx, cy, r, color, alpha, rot) {
    uctx.save();
    uctx.globalAlpha = alpha === undefined ? 1 : alpha;
    uctx.strokeStyle = color;
    uctx.lineWidth = Math.max(1.2, r * 0.10);
    uctx.lineCap = 'round';
    for (let k = 0; k < 3; k++) {
      uctx.beginPath();
      for (let i = 0; i <= 26; i++) {
        const t = i / 26;
        const a = rot + k * 2.094 + t * 4.4;
        const rr = r * t;
        const x = cx + Math.cos(a) * rr;
        const y = cy + Math.sin(a) * rr * 0.92;
        if (i === 0) uctx.moveTo(x, y); else uctx.lineTo(x, y);
      }
      uctx.stroke();
    }
    uctx.restore();
  }

  function sxw(x) { return ox + x * sx; }
  function syw(y) { return oy + y * sy; }

  function drawProgress() {
    const margin = Math.max(12, base * 0.9);
    const y = Math.max(8, base * 0.45);
    const w = vw - margin * 2;
    const prog = S.phase === 'playing' || S.phase === 'paused' ? clamp(S.songTime / CH.duration, 0, 1) : 0;
    uctx.fillStyle = 'rgba(43, 70, 56, .55)';
    uctx.fillRect(margin, y, w, 1);
    uctx.fillStyle = 'rgba(191, 148, 64, .55)';
    uctx.fillRect(margin, y, w * prog, 1);
    uctx.fillStyle = 'rgba(240, 208, 120, .9)';
    uctx.fillRect(margin + w * prog - 1, y - 2, 2, 5);
    for (const sec of CH.sections) {
      const x = margin + w * (sec.t0 / CH.duration);
      uctx.fillStyle = 'rgba(127, 157, 140, .30)';
      uctx.fillRect(Math.round(x), y + 3, 1, 2);
    }
  }

  function drawHUD() {
    // top scrim
    const g = uctx.createLinearGradient(0, 0, 0, base * 5.2);
    g.addColorStop(0, 'rgba(2, 6, 4, .72)');
    g.addColorStop(1, 'rgba(2, 6, 4, 0)');
    uctx.fillStyle = g;
    uctx.fillRect(0, 0, vw, base * 5.2);

    drawProgress();

    const margin = Math.max(14, base * 1.0);
    const top = Math.max(22, base * 1.75);

    // score
    text('ОЧКИ', margin, top, base * 0.62, Art.P.uiDim, 'left', 1);
    text(String(S.score).padStart(6, '0'), margin, top + base * 1.15, base * 1.55, Art.P.bone1, 'left', 1);
    if (S.combo > 0) {
      const mult = multiplier();
      text('КОМБО ' + S.combo, margin, top + base * 2.25, base * 0.72, Art.P.gold1, 'left', 1);
      text('×' + (Math.round(mult * 10) / 10).toFixed(1), margin + base * 4.3, top + base * 2.25, base * 0.72,
        S.blessing > 0 ? Art.P.gold2 : Art.P.leaf2, 'left', 1);
    }

    // connection meter
    const bw = Math.min(vw * 0.25, base * 11);
    const bx = vw - margin - bw;
    const by = top + base * 0.45;
    const label = S.blessing > 0 ? 'ДАР ДУБА' : 'СВЯЗЬ';
    text(label, vw - margin, top, base * 0.62, S.blessing > 0 ? Art.P.gold2 : Art.P.uiDim, 'right', 1);
    const segs = 20;
    const fill = clamp(S.aura / 100, 0, 1);
    for (let i = 0; i < segs; i++) {
      const on = (i + 0.5) / segs <= fill;
      uctx.fillStyle = on
        ? (S.blessing > 0 ? (i % 2 ? Art.P.gold2 : Art.P.white) : (i > 14 ? Art.P.gold1 : Art.P.water2))
        : 'rgba(43, 70, 56, .55)';
      uctx.fillRect(Math.round(bx + i * (bw / segs)), Math.round(by), Math.max(2, Math.round(bw / segs) - 2), Math.max(2, base * 0.22));
    }
    uctx.fillStyle = 'rgba(216, 212, 180, .14)';
    uctx.fillRect(Math.round(bx), Math.round(by + base * 0.34), Math.round(bw), 1);
    if (S.blessing > 0) {
      text((Math.max(0, S.blessing)).toFixed(1) + ' С', vw - margin, by + base * 0.82, base * 0.62, Art.P.gold2, 'right', 1);
    } else {
      text(Math.round(S.aura) + '%', vw - margin, by + base * 0.82, base * 0.62, Art.P.uiDim, 'right', 1);
    }

    // section banner
    const b = S.banner;
    if (b.dur > 0) {
      const age = b.age;
      let a = 0;
      if (age < 0) a = 0;
      else a = Math.min(1, age * 2.6, (b.dur - age) * 1.2);
      a = clamp(a, 0, 1);
      if (a > 0.01) {
        const cy = top + base * 3.25;
        text(b.num, vw / 2, cy - base * 0.74, base * 0.62, Art.P.gold1, 'center', a * 0.9);
        spaced(b.name, vw / 2, cy, base * 0.95, Art.P.bone1, base * 0.045, 'center', a);
        text(b.sub, vw / 2, cy + base * 0.80, base * 0.62, Art.P.uiDim, 'center', a * 0.85);
        uctx.fillStyle = 'rgba(191, 148, 64, ' + (a * 0.22).toFixed(3) + ')';
        uctx.fillRect(vw / 2 - base * 3.2, cy + base * 1.25, base * 6.4, 1);
      }
    }

    // key labels at the altar
    for (let i = 0; i < 4; i++) {
      const x = sxw(LANE_X[i]);
      const y = syw(252);
      text(CH.lanes[i].key, x, y, base * 0.82, LANE_COLORS[i], 'center', 0.92);
      text(CH.lanes[i].short || CH.lanes[i].tree, x, y + base * 0.86, base * 0.42, Art.P.uiFaint, 'center', 0.9);
    }

    // judgement popups (world coords)
    for (const p of S.popups) {
      if (p.life <= 0) continue;
      const a = clamp(p.life / p.maxLife, 0, 1);
      text(p.text, sxw(p.x), syw(p.y), base * 0.72, p.color, 'center', a);
    }

    // toast
    if (S.toast.life > 0) {
      const a = clamp(Math.min(1, S.toast.life * 2, (S.toast.max - S.toast.life) * 4), 0, 1);
      text(S.toast.text, vw / 2, vh * 0.245, base * 0.68, Art.P.gold2, 'center', a);
    }
  }

  function drawMenu() {
    // backdrop gradient
    const g = uctx.createLinearGradient(0, 0, 0, vh);
    g.addColorStop(0, 'rgba(2, 6, 4, .72)');
    g.addColorStop(0.45, 'rgba(2, 6, 4, .34)');
    g.addColorStop(0.78, 'rgba(2, 6, 4, .55)');
    g.addColorStop(1, 'rgba(2, 6, 4, .82)');
    uctx.fillStyle = g;
    uctx.fillRect(0, 0, vw, vh);

    const tSize = clamp(Math.round(Math.min(vw * 0.082, vh * 0.155)), 34, 98);
    const titleY = vh * 0.27;
    triskele(vw / 2, titleY - tSize * 1.15, tSize * 0.30, Art.P.gold1, 0.75, S.ambient * 0.22);
    spaced(CH.title, vw / 2, titleY, tSize, Art.P.bone1, tSize * 0.055, 'center', 1);
    spaced(CH.subtitle, vw / 2, titleY + tSize * 0.64, base * 1.05, Art.P.gold1, base * 0.12, 'center', 0.95);

    uctx.fillStyle = 'rgba(191, 148, 64, .30)';
    uctx.fillRect(vw / 2 - base * 3.6, titleY + tSize * 0.98, base * 7.2, 1);

    const tagY = vh * 0.53;
    text('СЛУШАЙ ИНСТРУМЕНТ. ДЕРЖИ РОЩУ.', vw / 2, tagY, base * 0.86, Art.P.bone0, 'center', 0.92);

    // keys
    const keyY = vh * 0.655;
    const kw = Math.min(base * 4.2, (vw * 0.72) / 4 - base * 0.5);
    const gap = Math.min(base * 0.55, vw * 0.015);
    const totalW = kw * 4 + gap * 3;
    let kx = vw / 2 - totalW / 2;
    for (let i = 0; i < 4; i++) {
      const x = kx + i * (kw + gap);
      uctx.fillStyle = 'rgba(4, 11, 8, .72)';
      uctx.fillRect(Math.round(x), Math.round(keyY - base * 1.42), Math.round(kw), Math.round(base * 2.55));
      uctx.fillStyle = 'rgba(191, 148, 64, .18)';
      uctx.fillRect(Math.round(x), Math.round(keyY - base * 1.42), Math.round(kw), 1);
      uctx.fillStyle = LANE_COLORS[i];
      uctx.fillRect(Math.round(x), Math.round(keyY + base * 1.05), Math.round(kw), 1);
      text(CH.lanes[i].key, x + kw / 2, keyY - base * 0.91, base * 1.22, LANE_COLORS[i], 'center', 1);
      text(CH.lanes[i].name, x + kw / 2, keyY - base * 0.03, base * 0.56, Art.P.bone0, 'center', 0.96);
      text(CH.lanes[i].short || CH.lanes[i].tree, x + kw / 2, keyY + base * 0.61, base * 0.40, Art.P.uiFaint, 'center', 0.9);
    }

    const pulse = 0.62 + 0.38 * (0.5 + 0.5 * Math.sin(S.ambient * 2.3));
    text('ПРОБЕЛ — НАЧАТЬ РИТУАЛ', vw / 2, vh * 0.79, base * 0.84, Art.P.gold2, 'center', pulse);

    if (S.best) {
      text('ЛУЧШИЙ РИТУАЛ · ' + String(S.best.score).padStart(6, '0') + ' · ' + (S.best.rank || ''),
        vw / 2, vh * 0.867, base * 0.62, Art.P.uiDim, 'center', 0.9);
    }

    const foot = 'НАУШНИКИ · [ / ] ЗАДЕРЖКА ' + (S.settings.offsetMs > 0 ? '+' : '') + S.settings.offsetMs +
      ' МС · − / = ГРОМКОСТЬ ' + Math.round(S.settings.volume * 100) + '%';
    text(foot, vw / 2, vh * 0.932, base * 0.62, Art.P.uiFaint, 'center', 0.95);

    if (vw < vh) {
      text('ЛУЧШЕ В АЛЬБОМНОЙ ОРИЕНТАЦИИ', vw / 2, vh * 0.972, base * 0.62, Art.P.gold1, 'center', 0.85);
    }
  }

  function drawPause() {
    uctx.fillStyle = 'rgba(2, 6, 4, .68)';
    uctx.fillRect(0, 0, vw, vh);
    const w = Math.min(vw * 0.72, base * 24);
    const h = Math.min(vh * 0.62, base * 15);
    const x = (vw - w) / 2, y = (vh - h) / 2;
    panel(x, y, w, h, 0.84);
    text('ПАУЗА', vw / 2, y + base * 2.2, base * 2.0, Art.P.bone1, 'center', 1);
    text('РОЩА ЖДЁТ', vw / 2, y + base * 3.45, base * 0.68, Art.P.uiDim, 'center', 0.9);
    const lines = [
      'ESC — ПРОДОЛЖИТЬ',
      'R — НАЧАТЬ СНАЧАЛА',
      '[ / ] — ЗАДЕРЖКА ' + (S.settings.offsetMs > 0 ? '+' : '') + S.settings.offsetMs + ' МС',
      '− / = — ГРОМКОСТЬ ' + Math.round(S.settings.volume * 100) + '%',
      'M — ЗВУК УДАРОВ ' + (S.settings.sfx ? 'ВКЛ' : 'ВЫКЛ')
    ];
    const lh = base * 1.05;
    const ly = y + base * 5.0;
    for (let i = 0; i < lines.length; i++) {
      text(lines[i], vw / 2, ly + i * lh, base * 0.68, i === 0 ? Art.P.gold2 : Art.P.bone0, 'center', 0.95);
    }
    text('СЛУШАЙ. НЕ СПЕШИ.', vw / 2, y + h - base * 1.15, base * 0.62, Art.P.uiDim, 'center', 0.8);
  }

  function drawEnd() {
    const r = S.result;
    if (!r) return;
    uctx.fillStyle = 'rgba(2, 6, 4, .72)';
    uctx.fillRect(0, 0, vw, vh);

    const w = Math.min(vw * 0.82, base * 27);
    const h = Math.min(vh * 0.74, base * 16);
    const x = (vw - w) / 2, y = (vh - h) / 2;
    panel(x, y, w, h, 0.86);

    // едва заметная печать-трискель заполняет нижнюю часть панели
    triskele(vw / 2, y + h * 0.66, base * 2.0, Art.P.gold1, 0.085, S.ambient * 0.12);

    const top = y + base * 1.6;
    text('РИТУАЛ ЗАВЕРШЁН', vw / 2, top, base * 1.35, Art.P.bone1, 'center', 1);
    text(r.rank.name, vw / 2, top + base * 2.25, base * 2.35, r.rank.color, 'center', 1);
    text(r.rank.sub, vw / 2, top + base * 3.55, base * 0.68, Art.P.uiDim, 'center', 0.95);
    uctx.fillStyle = 'rgba(191, 148, 64, .22)';
    uctx.fillRect(vw / 2 - base * 4.2, top + base * 4.15, base * 8.4, 1);

    const statsY = top + base * 4.95;
    const cols = [
      ['ТОЧНОСТЬ', r.acc.toFixed(1) + '%'],
      ['МАКС. КОМБО', String(r.maxCombo)],
      ['ОЧКИ', String(r.score).padStart(6, '0')]
    ];
    const cw3 = w / 3;
    for (let i = 0; i < 3; i++) {
      const cx = x + cw3 * (i + 0.5);
      text(cols[i][0], cx, statsY, base * 0.62, Art.P.uiDim, 'center', 0.95);
      text(cols[i][1], cx, statsY + base * 1.05, base * 1.15, i === 2 ? Art.P.gold2 : Art.P.bone1, 'center', 1);
    }

    text('ИДЕАЛЬНО ' + r.perfect + '   ·   ХОРОШО ' + r.good + '   ·   ТОЧНО ' + r.ok + '   ·   МИМО ' + r.miss,
      vw / 2, statsY + base * 2.35, base * 0.62, Art.P.uiDim, 'center', 0.9);

    if (r.newBest) {
      const p = 0.6 + 0.4 * (0.5 + 0.5 * Math.sin(S.ambient * 3.1));
      text('НОВЫЙ РЕКОРД РОЩИ', vw / 2, statsY + base * 3.15, base * 0.72, Art.P.gold2, 'center', p);
    } else if (S.best) {
      text('ЛУЧШИЙ РИТУАЛ · ' + String(S.best.score).padStart(6, '0'),
        vw / 2, statsY + base * 3.15, base * 0.62, Art.P.uiFaint, 'center', 0.9);
    }

    const p = 0.68 + 0.32 * (0.5 + 0.5 * Math.sin(S.ambient * 2.1));
    text('R — СНОВА     ·     ESC — В РОЩУ', vw / 2, y + h - base * 1.55, base * 0.74, Art.P.gold2, 'center', p);
    text('СЕМЯ ОСТАЁТСЯ В ЗЕМЛЕ', vw / 2, y + h - base * 0.72, base * 0.62, Art.P.uiDim, 'center', 0.75);
  }

  function drawError() {
    uctx.fillStyle = 'rgba(2, 6, 4, .85)';
    uctx.fillRect(0, 0, vw, vh);
    const w = Math.min(vw * 0.84, base * 27);
    const h = Math.min(vh * 0.7, base * 16);
    const x = (vw - w) / 2, y = (vh - h) / 2;
    panel(x, y, w, h, 0.9);
    text('ТРЕК НЕ ЗАГРУЗИЛСЯ', vw / 2, y + base * 2.0, base * 1.3, Art.P.gold1, 'center', 1);
    const lines = [
      'Открой игру через ./play.sh или локальный сервер:',
      'python3 -m http.server 8080',
      'Файл трека: assets/umbrella.wav',
      '',
      'R — ПОПРОБОВАТЬ СНОВА'
    ];
    for (let i = 0; i < lines.length; i++) {
      text(lines[i], vw / 2, y + base * 4.0 + i * base * 1.0, base * 0.6, i === lines.length - 1 ? Art.P.gold2 : Art.P.bone0, 'center', 0.95);
    }
  }

  function drawOverlay() {
    uctx.clearRect(0, 0, vw, vh);
    if (S.phase === 'playing' || S.phase === 'paused') drawHUD();
    if (S.phase === 'menu') drawMenu();
    else if (S.phase === 'paused') drawPause();
    else if (S.phase === 'end') drawEnd();
    else if (S.phase === 'error') drawError();
    if (S.phase === 'playing' && S.blessing > 0) {
      const a = 0.20 + 0.16 * (0.5 + 0.5 * Math.sin(S.ambient * 4));
      uctx.strokeStyle = 'rgba(240, 208, 120, ' + a.toFixed(3) + ')';
      uctx.lineWidth = 2;
      uctx.strokeRect(2, 2, vw - 4, vh - 4);
    }
  }

  // ---------- main loop ----------
  function frame(now) {
    raf = requestAnimationFrame(frame);
    if (!last) last = now;
    let dt = (now - last) / 1000;
    last = now;
    if (!Number.isFinite(dt)) dt = 0;
    dt = clamp(dt, 0, 0.05);
    try {
      update(dt);
      drawWorld();
      drawOverlay();
    } catch (e) {
      console.error(e);
    }
  }

  // ---------- input ----------
  const LANE_BY_CODE = {
    KeyD: 0, KeyF: 1, KeyJ: 2, KeyK: 3,
    ArrowLeft: 0, ArrowDown: 1, ArrowUp: 2, ArrowRight: 3,
    Digit1: 0, Digit2: 1, Digit3: 2, Digit4: 3,
    Numpad1: 0, Numpad2: 1, Numpad3: 2, Numpad4: 3
  };

  function adjustOffset(delta) {
    S.settings.offsetMs = clamp(S.settings.offsetMs + delta, -200, 200);
    audio.setOffsetMs(S.settings.offsetMs);
    saveSettings();
    S.toast = {
      text: 'ЗАДЕРЖКА ' + (S.settings.offsetMs > 0 ? '+' : '') + S.settings.offsetMs + ' МС',
      life: 1.3, max: 1.3
    };
  }

  function adjustVolume(delta) {
    S.settings.volume = clamp(Math.round((S.settings.volume + delta) * 10) / 10, 0, 1);
    audio.setVolume(S.settings.volume);
    saveSettings();
    S.toast = { text: 'ГРОМКОСТЬ ' + Math.round(S.settings.volume * 100) + '%', life: 1.3, max: 1.3 };
  }

  function toggleSfx() {
    S.settings.sfx = !S.settings.sfx;
    audio.sfxOn = S.settings.sfx;
    saveSettings();
    S.toast = { text: 'ЗВУК УДАРОВ ' + (S.settings.sfx ? 'ВКЛ' : 'ВЫКЛ'), life: 1.3, max: 1.3 };
  }

  window.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    const code = e.code;
    if (code === 'Space' || code === 'ArrowLeft' || code === 'ArrowRight' || code === 'ArrowUp' || code === 'ArrowDown') {
      e.preventDefault();
    }

    if (S.phase === 'menu') {
      if (code === 'Space' || code === 'Enter' || code === 'NumpadEnter') { startGame(); return; }
      if (code === 'BracketLeft') { adjustOffset(-5); return; }
      if (code === 'BracketRight') { adjustOffset(5); return; }
      if (code === 'Minus' || code === 'NumpadSubtract') { adjustVolume(-0.1); return; }
      if (code === 'Equal' || code === 'NumpadAdd') { adjustVolume(0.1); return; }
      if (code === 'KeyM') { toggleSfx(); return; }
    } else if (S.phase === 'playing') {
      if (code === 'Escape' || code === 'KeyP') { pauseGame(); return; }
      const lane = LANE_BY_CODE[code];
      if (lane !== undefined) { judge(lane); return; }
    } else if (S.phase === 'paused') {
      if (code === 'Escape' || code === 'Space' || code === 'Enter') { resumeGame(); return; }
      if (code === 'KeyR') { startGame(); return; }
      if (code === 'BracketLeft') { adjustOffset(-5); return; }
      if (code === 'BracketRight') { adjustOffset(5); return; }
      if (code === 'Minus' || code === 'NumpadSubtract') { adjustVolume(-0.1); return; }
      if (code === 'Equal' || code === 'NumpadAdd') { adjustVolume(0.1); return; }
      if (code === 'KeyM') { toggleSfx(); return; }
    } else if (S.phase === 'end') {
      if (code === 'KeyR' || code === 'Space' || code === 'Enter' || code === 'NumpadEnter') { startGame(); return; }
      if (code === 'Escape') { toMenu(); return; }
    } else if (S.phase === 'error') {
      if (code === 'KeyR') location.reload();
    }
  });

  function pointerLane(clientX, clientY) {
    const wx = (clientX - ox) / sx;
    if (wx < LANE_X[0] - 34 || wx > LANE_X[3] + 34) return -1;
    let best = 0, bd = 1e9;
    for (let i = 0; i < 4; i++) {
      const d = Math.abs(wx - LANE_X[i]);
      if (d < bd) { bd = d; best = i; }
    }
    return best;
  }

  window.addEventListener('pointerdown', (e) => {
    if (S.phase === 'playing') {
      const lane = pointerLane(e.clientX, e.clientY);
      if (lane >= 0) { e.preventDefault(); judge(lane); }
    } else if (S.phase === 'menu') {
      e.preventDefault();
      startGame();
    } else if (S.phase === 'paused') {
      e.preventDefault();
      resumeGame();
    } else if (S.phase === 'end') {
      e.preventDefault();
      startGame();
    }
  }, { passive: false });

  window.addEventListener('blur', () => {
    if (S.phase === 'playing') pauseGame();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && S.phase === 'playing') pauseGame();
  });

  window.addEventListener('resize', resize);
  window.addEventListener('orientationchange', () => setTimeout(resize, 180));

  // ---------- start ----------
  function init() {
    resize();
    ensureFont();
    Art.init();
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(() => { /* font is now live for canvas */ });
    }
    // seed ambient particles for a livelier menu
    S.section = CH.sections[0];
    S.t = 0;
    S.phase = 'boot';
    // отладочный доступ для тестов и настройки
    window.NemetonDebug = {
      state: S, audio: audio, chart: CH, judge: judge, startGame: startGame, endGame: endGame, resize: resize,
      spawnBird: spawnBird, spawnFlock: spawnFlock, birdReact: birdReact
    };
    bootAudio();
    raf = requestAnimationFrame(frame);
  }

  init();
})();
