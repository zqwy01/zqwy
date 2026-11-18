/* «Клетчатый лист» — игровой цикл, состояние, ввод и переходы.
   Состояния: title -> playing -> memory -> paused -> credits -> ending. */
(function () {
  'use strict';

  const L = window.PaperLevels;
  const Art = window.PaperArt;
  const AudioEngine = window.PaperAudio;
  const PaperUI = window.PaperUI;

  if (!L || !Art || !AudioEngine || !PaperUI) {
    document.body.innerHTML = '<p style="padding:2rem;font:16px Georgia,serif;color:#3a3a38">Ошибка: не загрузились модули игры. Проверьте папку js/.</p>';
    return;
  }

  const ZONES = L.ZONES;
  const MEMORIES = L.MEMORIES;
  const UI = L.UI;
  const C = L.COLORS;
  const TOTAL = ZONES.length;
  const SAVE_KEY = 'kletchaty.list.save.v1';
  const SETTINGS_KEY = 'kletchaty.list.settings.v1';

  const canvas = document.getElementById('stage');
  const ctx = canvas.getContext('2d');
  const audio = new AudioEngine();
  const ui = new PaperUI();

  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = t => {
    t = clamp(t, 0, 1);
    return t * t * (3 - 2 * t);
  };
  const easeInOut = t => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

  const S = {
    mode: 'title',
    zone: 0,
    collected: new Array(TOTAL).fill(false),
    visited: Array.from({ length: TOTAL }, () => new Set()),
    reveals: Array.from({ length: TOTAL }, () => ({})),
    player: { x: 1, y: 1, fromX: 1, fromY: 1, toX: 1, toY: 1, t: 0, moving: false, facing: 1 },
    time: 0,
    idle: 0,
    nextIdleHint: 14,
    pendingMemory: 0,
    memoryPend: false,
    particles: [],
    flash: 0,
    bump: 0,
    settings: { volume: 0.7, muted: false },
    reduced: false,
    audioPromise: null,
    firstGesture: false,
    hintShown: false,
    sessionStarted: false,
    completed: false,
    vw: 0,
    vh: 0,
    dpr: 1
  };

  let layout = { cell: 60, ox: 0, oy: 0, cols: 8, rows: 8 };
  let lastTime = 0;
  let raf = 0;

  const TITLE_PLAYER = { x: 4, y: 4, fromX: 4, fromY: 4, toX: 4, toY: 4, t: 0, moving: false, facing: 1 };
  const titleVisited = new Set([
    '1,1', '2,1', '2,2', '3,2', '3,3', '4,3', '4,4', '5,4',
    '5,5', '6,5', '6,6', '1,3', '2,4', '3,5', '4,6', '5,3'
  ]);
  const titleReveals = {};
  titleVisited.forEach(k => { titleReveals[k] = 1; });

  // ---------- settings & save ----------
  function loadSettings() {
    try {
      const raw = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
      if (Number.isFinite(raw.volume)) S.settings.volume = clamp(raw.volume, 0, 1);
      if (typeof raw.muted === 'boolean') S.settings.muted = raw.muted;
    } catch (e) {}
    audio.setVolume(S.settings.volume);
    audio.setMuted(S.settings.muted);
  }

  function saveSettings() {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify({
        volume: S.settings.volume,
        muted: S.settings.muted
      }));
    } catch (e) {}
  }

  function readSave() {
    try {
      const raw = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null');
      if (!raw || raw.version !== 1) return null;
      const zone = clamp(parseInt(raw.zone, 10) || 0, 0, TOTAL - 1);
      const collected = Array.from({ length: TOTAL }, (_, i) => !!(raw.collected && raw.collected[i]));
      const visited = Array.from({ length: TOTAL }, (_, i) => {
        const set = new Set();
        const arr = raw.visited && Array.isArray(raw.visited[i]) ? raw.visited[i] : [];
        arr.forEach(k => {
          if (typeof k !== 'string') return;
          const p = k.split(',');
          const x = Number(p[0]), y = Number(p[1]);
          if (Number.isInteger(x) && Number.isInteger(y) && x >= 0 && y >= 0 && x < ZONES[i].cols && y < ZONES[i].rows) {
            set.add(k);
          }
        });
        return set;
      });
      return {
        zone: zone,
        collected: collected,
        visited: visited,
        memoryPend: !!raw.memoryPend,
        completed: !!raw.completed
      };
    } catch (e) {
      return null;
    }
  }

  function writeSave() {
    if (!S.sessionStarted) return;
    try {
      const data = {
        version: 1,
        zone: S.zone,
        collected: S.collected.slice(),
        visited: S.visited.map(set => Array.from(set)),
        memoryPend: !!S.memoryPend,
        completed: !!S.completed
      };
      localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    } catch (e) {}
  }

  function clearSave() {
    try { localStorage.removeItem(SAVE_KEY); } catch (e) {}
  }

  // ---------- layout & resize ----------
  function resize() {
    S.vw = Math.max(280, window.innerWidth || 960);
    S.vh = Math.max(320, window.innerHeight || 640);
    S.dpr = Math.min(2.5, window.devicePixelRatio || 1);
    canvas.width = Math.max(1, Math.round(S.vw * S.dpr));
    canvas.height = Math.max(1, Math.round(S.vh * S.dpr));
    canvas.style.width = S.vw + 'px';
    canvas.style.height = S.vh + 'px';
    ctx.setTransform(S.dpr, 0, 0, S.dpr, 0, 0);
    computeLayout();
  }

  function computeLayout() {
    const zone = S.mode === 'title' ? ZONES[0] : ZONES[S.zone];
    const w = S.vw, h = S.vh;
    const compact = w < 720;
    const top = h < 430 ? 62 : (compact ? 80 : 98);
    const side = clamp(Math.min(w, h) * 0.045, 10, 54);
    const bottom = h < 430 ? 18 : 34;
    const availW = Math.max(80, w - side * 2);
    const availH = Math.max(80, h - top - bottom);
    let cell = Math.min(availW / zone.cols, availH / zone.rows);
    cell = clamp(cell, 14, 132);
    layout = {
      cell: cell,
      ox: Math.round((w - zone.cols * cell) / 2),
      oy: Math.round(top + Math.max(0, (availH - zone.rows * cell) / 2)),
      cols: zone.cols,
      rows: zone.rows
    };
  }

  // ---------- scenes ----------
  function getScene() {
    if (S.mode === 'title') {
      return {
        zoneIndex: 0,
        zone: ZONES[0],
        visited: titleVisited,
        reveals: titleReveals,
        collected: false,
        player: TITLE_PLAYER
      };
    }
    const zone = ZONES[S.zone];
    return {
      zoneIndex: S.zone,
      zone: zone,
      visited: S.visited[S.zone],
      reveals: S.reveals[S.zone],
      collected: S.collected[S.zone],
      player: (S.mode === 'credits' || S.mode === 'ending')
        ? { x: zone.heart.x, y: zone.heart.y, fromX: zone.heart.x, fromY: zone.heart.y, toX: zone.heart.x, toY: zone.heart.y, t: 0, moving: false, facing: 1 }
        : S.player
    };
  }

  // ---------- audio ----------
  function ensureAudio() {
    if (!S.audioPromise) {
      S.audioPromise = audio.unlock().catch(() => {});
    }
    return S.audioPromise;
  }

  function firstGesture() {
    if (S.firstGesture) return;
    S.firstGesture = true;
    ensureAudio().then(() => {
      if (S.mode === 'title') audio.playGroup(0);
    });
  }

  // ---------- game flow ----------
  function showTitle() {
    S.mode = 'title';
    S.sessionStarted = false;
    S.memoryPend = false;
    S.pendingMemory = 0;
    S.particles = [];
    S.idle = 0;
    S.hintShown = false;
    ui.hide();
    ui.hideHint();
    ui.setHudVisible(false);
    ui.setPauseEnabled(false);
    const save = readSave();
    ui.showTitle({
      hasSave: !!(save && !save.completed),
      zone: save ? save.zone : 0,
      completed: !!(save && save.completed)
    });
    computeLayout();
    if (S.firstGesture) audio.playGroup(0);
  }

  function startNew() {
    ensureAudio();
    clearSave();
    S.sessionStarted = true;
    S.completed = false;
    S.memoryPend = false;
    S.pendingMemory = 0;
    S.collected = new Array(TOTAL).fill(false);
    S.visited = Array.from({ length: TOTAL }, () => new Set());
    S.reveals = Array.from({ length: TOTAL }, () => ({}));
    S.particles = [];
    S.flash = 1;
    S.idle = 0;
    S.nextIdleHint = 14;
    S.hintShown = false;
    S.mode = 'playing';
    ui.hide();
    ui.setHudVisible(true);
    ui.setPauseEnabled(true);
    loadZone(0, false);
    writeSave();
    setTimeout(() => {
      if (S.mode === 'playing' && !S.hintShown) {
        S.hintShown = true;
        ui.hint(UI.hintMove, 9000);
      }
    }, 900);
  }

  function continueGame() {
    ensureAudio();
    const save = readSave();
    if (!save || save.completed) {
      startNew();
      return;
    }
    S.sessionStarted = true;
    S.completed = false;
    S.memoryPend = !!save.memoryPend;
    S.collected = save.collected;
    S.visited = save.visited;
    S.reveals = save.visited.map(set => {
      const r = {};
      set.forEach(k => { r[k] = 1; });
      return r;
    });
    S.particles = [];
    S.flash = 0.5;
    S.idle = 0;
    S.nextIdleHint = 14;
    S.hintShown = true;
    S.mode = 'playing';
    ui.hide();
    ui.setHudVisible(true);
    ui.setPauseEnabled(true);

    if (save.memoryPend && S.collected[save.zone]) {
      loadZone(save.zone, true);
      S.mode = 'memory';
      S.memoryPend = true;
      ui.setPauseEnabled(false);
      ui.showMemory(MEMORIES[save.zone], save.zone, TOTAL);
      return;
    }

    let z = save.zone;
    if (S.collected[z]) {
      while (z < TOTAL && S.collected[z]) z++;
      if (z >= TOTAL) {
        loadZone(TOTAL - 1, true);
        showCredits();
        return;
      }
    }
    loadZone(z, true);
    writeSave();
  }

  function loadZone(index, restored) {
    const zone = ZONES[index];
    S.zone = index;
    S.pendingMemory = 0;

    if (!restored) {
      S.visited[index] = new Set();
      S.reveals[index] = {};
    }
    const visited = S.visited[index];
    const reveals = S.reveals[index];
    const startKey = zone.start.x + ',' + zone.start.y;
    if (!visited.has(startKey)) {
      visited.add(startKey);
      reveals[startKey] = restored ? 1 : 0;
    } else if (reveals[startKey] == null) {
      reveals[startKey] = 1;
    }

    S.player = {
      x: zone.start.x, y: zone.start.y,
      fromX: zone.start.x, fromY: zone.start.y,
      toX: zone.start.x, toY: zone.start.y,
      t: 0, moving: false, facing: 1
    };
    S.idle = 0;
    S.nextIdleHint = 14;

    computeLayout();
    ui.setHud(zone, index, S.collected);
    ui.setPauseEnabled(S.mode === 'playing');
    if (S.mode === 'playing') {
      ui.banner('Зона ' + (index + 1) + ' / ' + TOTAL, zone.title, zone.subtitle);
    }
    audio.playGroup(zone.group);
    if (index + 1 < TOTAL) {
      const ng = ZONES[index + 1].group;
      if (ng !== zone.group) audio.preloadGroup(ng);
    }
    S.flash = restored ? 0.4 : 1;
  }

  function pauseGame() {
    if (S.mode !== 'playing') return;
    S.mode = 'paused';
    ui.hideHint();
    ui.setPauseEnabled(true);
    ui.showPause(audio.muted, S.settings.volume);
    audio.pause();
    writeSave();
  }

  function resumeGame() {
    if (S.mode !== 'paused') return;
    ui.hide();
    S.mode = 'playing';
    ui.setPauseEnabled(true);
    writeSave();
  }

  function toggleSound() {
    ensureAudio();
    const muted = audio.toggleMuted();
    S.settings.muted = muted;
    saveSettings();
    ui.setSound(muted);
    if (!muted) {
      const group = S.mode === 'title' ? 0 : ZONES[S.zone].group;
      audio.playGroup(group);
    }
    if (S.mode === 'paused') ui.showPause(muted, S.settings.volume);
  }

  function onVolume(v) {
    S.settings.volume = clamp(v, 0, 1);
    audio.setVolume(S.settings.volume);
    saveSettings();
  }

  function goToMenu() {
    if (S.mode === 'paused') {
      writeSave();
      S.memoryPend = false;
      showTitle();
    }
  }

  function showCredits() {
    S.mode = 'credits';
    S.memoryPend = false;
    ui.hide();
    ui.hideHint();
    ui.setHudVisible(false);
    ui.setPauseEnabled(false);
    ui.showCredits();
    audio.playGroup(2);
    writeSave();
  }

  function goToFinal() {
    if (S.mode !== 'credits') return;
    S.mode = 'ending';
    S.completed = true;
    writeSave();
    ui.setHudVisible(false);
    ui.setPauseEnabled(false);
    ui.showEnding(S.collected, TOTAL);
    audio.playGroup(2);
  }

  function restartFromEnding() {
    clearSave();
    S.completed = false;
    S.sessionStarted = false;
    S.collected = new Array(TOTAL).fill(false);
    S.visited = Array.from({ length: TOTAL }, () => new Set());
    S.reveals = Array.from({ length: TOTAL }, () => ({}));
    showTitle();
  }

  function collectHeart() {
    if (S.mode !== 'playing' || S.collected[S.zone]) return;
    const zone = ZONES[S.zone];
    S.collected[S.zone] = true;
    S.memoryPend = true;
    S.pendingMemory = 0;
    S.mode = 'memory';
    S.flash = 0.35;
    ui.setHud(zone, S.zone, S.collected);
    ui.setPauseEnabled(false);
    ui.hideHint();
    ui.showMemory(MEMORIES[S.zone], S.zone, TOTAL);
    audio.heart();
    spawnHeartBurst(zone.heart.x, zone.heart.y);
    writeSave();
  }

  function nextMemory() {
    if (S.mode !== 'memory') return;
    ui.hide();
    S.memoryPend = false;
    if (S.zone < TOTAL - 1) {
      const next = S.zone + 1;
      S.mode = 'playing';
      loadZone(next, false);
      ui.setPauseEnabled(true);
      audio.pageTurn();
      S.flash = 1;
      writeSave();
    } else {
      showCredits();
    }
  }

  function companionHint() {
    if (S.mode !== 'playing') return;
    audio.chirp();
    const zone = ZONES[S.zone];
    if (S.collected[S.zone]) {
      ui.hint('Птенец довольно жмурится. Эта страница уже собрана.', 3000);
      return;
    }
    const dx = zone.heart.x - S.player.x;
    const dy = zone.heart.y - S.player.y;
    let dir;
    if (Math.abs(dx) >= Math.abs(dy)) dir = dx < 0 ? 'left' : 'right';
    else dir = dy < 0 ? 'up' : 'down';
    ui.hint(UI.hintCompanion + ' ' + UI.directions[dir] + '.', 3200);
  }

  // ---------- actions ----------
  function onAction(action) {
    switch (action) {
      case 'start': startNew(); break;
      case 'continue': continueGame(); break;
      case 'next-memory': nextMemory(); break;
      case 'pause': if (S.mode === 'playing') pauseGame(); else if (S.mode === 'paused') resumeGame(); break;
      case 'resume': resumeGame(); break;
      case 'toggle-sound': toggleSound(); break;
      case 'menu': goToMenu(); break;
      case 'restart':
        if (S.mode === 'paused') ui.showRestartConfirm();
        break;
      case 'restart-confirm': startNew(); break;
      case 'cancel-restart':
        if (S.mode === 'paused') ui.showPause(audio.muted, S.settings.volume);
        else showTitle();
        break;
      case 'to-final': goToFinal(); break;
      case 'restart-from-ending': restartFromEnding(); break;
      default: break;
    }
  }

  // ---------- movement ----------
  function move(dx, dy) {
    if (S.mode !== 'playing') return;
    const p = S.player;
    if (p.moving) return;
    const nx = p.x + dx;
    const ny = p.y + dy;
    const zone = ZONES[S.zone];
    if (nx < 0 || ny < 0 || nx >= zone.cols || ny >= zone.rows) {
      S.bump = 0.22;
      audio.bump();
      return;
    }
    if (dx < 0) p.facing = -1;
    else if (dx > 0) p.facing = 1;
    p.fromX = p.x;
    p.fromY = p.y;
    p.toX = nx;
    p.toY = ny;
    p.t = 0;
    p.moving = true;
    S.idle = 0;
    S.nextIdleHint = 14;
    audio.step();
  }

  function arriveCell() {
    const p = S.player;
    p.x = p.toX;
    p.y = p.toY;
    p.moving = false;
    p.t = 0;
    const key = p.x + ',' + p.y;
    const visited = S.visited[S.zone];
    const reveals = S.reveals[S.zone];
    if (!visited.has(key)) {
      visited.add(key);
      reveals[key] = 0;
    } else if (reveals[key] == null) {
      reveals[key] = 1;
    }
    const zone = ZONES[S.zone];
    if (p.x === zone.heart.x && p.y === zone.heart.y && !S.collected[S.zone]) {
      S.pendingMemory = S.reduced ? 0.30 : 0.85;
    }
    S.idle = 0;
    S.nextIdleHint = 14;
    writeSave();
  }

  function reachableCellFromPointer(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    const x = (clientX - rect.left - layout.ox) / layout.cell;
    const y = (clientY - rect.top - layout.oy) / layout.cell;
    if (x < 0 || y < 0 || x >= layout.cols || y >= layout.rows) return null;
    return { x: Math.floor(x), y: Math.floor(y) };
  }

  // ---------- particles ----------
  function spawnHeartBurst(gx, gy) {
    const r = Art.cellRect(layout, gx, gy);
    const count = S.reduced ? 7 : 22;
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = (20 + Math.random() * 80) * (layout.cell / 70);
      S.particles.push({
        kind: i % 3 === 0 ? 'spark' : 'heart',
        x: r.cx + (Math.random() - 0.5) * layout.cell * 0.4,
        y: r.cy + (Math.random() - 0.5) * layout.cell * 0.4,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - 18,
        gravity: 30,
        life: 0.7 + Math.random() * 0.9,
        max: 1.6,
        size: (Math.random() * 2.2 + 1.1) * (layout.cell / 70),
        seed: (Math.random() * 100000) | 0,
        color: C.redSoft
      });
    }
  }

  function updateParticles(dt) {
    for (let i = S.particles.length - 1; i >= 0; i--) {
      const p = S.particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        S.particles.splice(i, 1);
        continue;
      }
      p.vy += p.gravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.985;
      p.vy *= 0.99;
    }
  }

  // ---------- update ----------
  function update(dt) {
    S.time += dt;
    if (S.mode === 'paused') {
      updateParticles(dt * 0.15);
      return;
    }

    if (S.mode === 'playing' || S.mode === 'memory' || S.mode === 'credits' || S.mode === 'ending') {
      const rv = S.reveals[S.zone] || {};
      const speed = S.reduced ? 7 : 2.3;
      Object.keys(rv).forEach(k => {
        if (rv[k] < 1) rv[k] = Math.min(1, rv[k] + dt * speed);
      });
    }

    if (S.mode === 'playing') {
      const p = S.player;
      if (p.moving) {
        p.t += dt / (S.reduced ? 0.13 : 0.23);
        if (p.t >= 1) {
          p.t = 1;
          arriveCell();
        }
      }
      if (S.pendingMemory > 0) {
        S.pendingMemory -= dt;
        if (S.pendingMemory <= 0) collectHeart();
      }
      S.idle += dt;
      if (S.idle > S.nextIdleHint && S.pendingMemory <= 0) {
        companionHint();
        S.nextIdleHint = S.idle + 18;
      }
    }

    updateParticles(dt);
    if (S.flash > 0) S.flash = Math.max(0, S.flash - dt * 2.4);
    if (S.bump > 0) S.bump = Math.max(0, S.bump - dt * 3);
  }

  // ---------- render ----------
  function playerScreen(scene) {
    const p = scene.player;
    let gx = p.x, gy = p.y;
    if (p.moving) {
      const e = easeInOut(p.t);
      gx = lerp(p.fromX, p.toX, e);
      gy = lerp(p.fromY, p.toY, e);
    }
    const r = Art.cellRect(layout, gx, gy);
    return {
      cx: r.cx,
      baseY: r.y + r.h * 0.92,
      walking: !!p.moving,
      phase: p.moving ? p.t * 2 : 0,
      facing: p.facing || 1
    };
  }

  function render() {
    const w = S.vw, h = S.vh;
    ctx.setTransform(S.dpr, 0, 0, S.dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    const scene = getScene();
    const zone = scene.zone;
    const zoneIndex = scene.zoneIndex;

    Art.drawPaper(ctx, w, h, layout, zone, zone.page);

    const keys = Object.keys(scene.reveals).filter(k => (scene.reveals[k] || 0) > 0.001);
    keys.sort((a, b) => {
      const pa = a.split(','), pb = b.split(',');
      const ay = +pa[1], by = +pb[1];
      if (ay !== by) return ay - by;
      return (+pa[0]) - (+pb[0]);
    });
    keys.forEach(k => {
      const parts = k.split(',');
      Art.drawCell(ctx, zone, +parts[0], +parts[1], layout, scene.reveals[k], zoneIndex);
    });

    Art.drawConnections(ctx, zone, scene.visited, scene.reveals, layout, zoneIndex);

    // декор: бледный намёк, пока клетка не пройдена, и плотный после
    (zone.decor || []).forEach(item => {
      const key = item.x + ',' + item.y;
      const rev = scene.reveals[key] || 0;
      const strength = 0.15 + 0.85 * Math.min(1, rev);
      Art.drawDecor(ctx, item, layout, strength, S.time, zoneIndex);
    });

    // фрагмент воспоминания
    const heartKey = zone.heart.x + ',' + zone.heart.y;
    const heartRev = scene.reveals[heartKey] || 0;
    if (!scene.collected && heartRev > 0.01) {
      const r = Art.cellRect(layout, zone.heart.x, zone.heart.y);
      Art.drawHeart(ctx, r.cx, r.cy, layout.cell * (0.16 + 0.035 * smooth(heartRev)), S.time, smooth(heartRev), Art.seedFor(zoneIndex, zone.heart.x, zone.heart.y, 77));
    }

    // тихий намёк, если игрок долго стоит
    if (S.mode === 'playing' && !S.collected[S.zone] && S.idle > 11 && heartRev < 0.02) {
      const r = Art.cellRect(layout, zone.heart.x, zone.heart.y);
      const a = 0.08 + 0.05 * (0.5 + 0.5 * Math.sin(S.time * 2.2));
      Art.roughEllipse(ctx, r.cx, r.cy, layout.cell * 0.34, layout.cell * 0.34, Art.seedFor(zoneIndex, zone.heart.x, zone.heart.y, 5), {
        color: C.redSoft, alpha: a, width: 0.8, amp: layout.cell * 0.03, passes: 1, steps: 20
      });
    }

    // героиня
    const pos = playerScreen(scene);
    const bumpX = S.bump > 0 ? Math.sin(S.time * 70) * S.bump * 2 : 0;
    Art.drawGirl(ctx, pos.cx + bumpX, pos.baseY, layout.cell * 1.06, S.time, {
      facing: pos.facing,
      walking: pos.walking,
      phase: pos.phase
    });

    // частицы
    S.particles.forEach(p => Art.drawParticle(ctx, p));

    // мягкая вспышка при смене страницы
    if (S.flash > 0.001) {
      ctx.save();
      ctx.globalAlpha = smooth(S.flash) * 0.9;
      ctx.fillStyle = zone.paper;
      ctx.fillRect(0, 0, w, h);
      ctx.restore();
    }
  }

  // ---------- input ----------
  function onKeyDown(e) {
    const key = e.key;
    const lower = key.toLowerCase();
    const inField = e.target && /input|textarea|select/i.test(e.target.tagName || '');

    if (lower === 'm') {
      e.preventDefault();
      toggleSound();
      return;
    }
    if (key === 'Escape' || lower === 'p' || lower === 'з') {
      if (S.mode === 'playing') {
        e.preventDefault();
        pauseGame();
      } else if (S.mode === 'paused') {
        e.preventDefault();
        resumeGame();
      }
      return;
    }
    if (inField) return;
    if (S.mode !== 'playing') return;

    let dx = 0, dy = 0;
    if (lower === 'w' || key === 'ArrowUp' || lower === 'ц') dy = -1;
    else if (lower === 's' || key === 'ArrowDown' || lower === 'ы') dy = 1;
    else if (lower === 'a' || key === 'ArrowLeft' || lower === 'ф') dx = -1;
    else if (lower === 'd' || key === 'ArrowRight' || lower === 'в') dx = 1;

    if (dx || dy) {
      e.preventDefault();
      move(dx, dy);
      return;
    }
    if (lower === 'e' || lower === 'у' || key === ' ') {
      e.preventDefault();
      companionHint();
    }
  }

  function onPointerDown(e) {
    firstGesture();
    if (S.mode !== 'playing') return;
    if (e.button != null && e.button !== 0) return;
    const cell = reachableCellFromPointer(e.clientX, e.clientY);
    if (!cell) return;
    const dx = cell.x - S.player.x;
    const dy = cell.y - S.player.y;
    if (Math.abs(dx) + Math.abs(dy) === 1) {
      move(dx, dy);
    } else if (dx === 0 && dy === 0) {
      audio.chirp();
      companionHint();
    } else {
      audio.bump();
      ui.hint(UI.hintTap, 1400);
    }
  }

  // ---------- boot ----------
  function frame(ts) {
    if (!lastTime) lastTime = ts;
    const dt = Math.min(0.05, Math.max(0.001, (ts - lastTime) / 1000));
    lastTime = ts;
    update(dt);
    render();
    raf = requestAnimationFrame(frame);
  }

  function init() {
    S.reduced = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    loadSettings();
    ui.onAction = onAction;
    ui.onVolume = onVolume;
    ui.setSound(S.settings.muted);
    resize();
    showTitle();

    window.addEventListener('resize', resize);
    window.addEventListener('orientationchange', () => setTimeout(resize, 80));
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('pointerdown', firstGesture, true);
    window.addEventListener('keydown', firstGesture, true);
    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('contextmenu', e => e.preventDefault());
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && S.mode === 'playing') pauseGame();
    });

    raf = requestAnimationFrame(frame);
    if (canvas.focus) canvas.focus({ preventScroll: true });
  }

  init();
})();
