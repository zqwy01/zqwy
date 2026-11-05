/* БУР ДРУИДА — game loop, chart judgement, hazards, HUD and ritual flow. */
(function () {
  'use strict';

  const CH = window.DRILL_CHART;
  const Core = window.DrillCore;
  const Art = window.DrillArt;
  const AudioEngine = window.DrillAudio;

  if (!CH || !Core || !Art || !AudioEngine) {
    document.body.innerHTML =
      '<p style="padding:2rem;color:#faf1ef;font-family:monospace;line-height:1.6">' +
      'Ошибка загрузки игры: не найден один из модулей.<br>' +
      'Открой игру через ./play.sh или локальный сервер.</p>';
    return;
  }

  const BEATS = CH.beats || [];
  const SECTIONS = CH.sections || [];
  const META = CH.meta || {};
  const W = Art.W, H = Art.H, CX = Art.CX, CY = Art.CY;
  const TAU = Math.PI * 2;
  const END = META.playableEnd || 155.1;
  const WIN = Core.WIN_PCT;
  const HP_MAX = 5;
  const ARENA_R = 159;
  const PLAYER_SPEED = 106;
  const PERFECT_WINDOW = 0.085;
  const GOOD_WINDOW = 0.17;
  const WARN_DELAY = META.beatPeriod || 0.666667;
  const HAZARD_R = { thorn: 7, stone: 10 };
  const PROGRESS = Core.PROGRESS;

  const SECTION_SUB = {
    silence: 'СЛУШАЙ ТИШИНУ. ПЕРВЫЙ УДАР — НА 0:06.',
    wake: 'КОРНИ ПРОСЫПАЮТСЯ ПОД НОГАМИ.',
    tide: 'ПРИЛИВ СГУЩАЕТСЯ. БЕЙ ЧАЩЕ.',
    deep: 'ГЛУБЖЕ. РОВНЕЕ. НЕ СПЕШИ.',
    heart: 'СЕРДЦЕ КУРГАНА БЬЁТ В ТАКТ.',
    road: 'СОСЕД УЖЕ СЛЫШИТ ТЕБЯ.',
    threshold: 'ПОСЛЕДНИЙ РЫВОК. ДЕРЖИ РИТМ.'
  };

  const $ = function (id) { return document.getElementById(id); };

  const world = $('world');
  const stage = $('stage');
  const wctx = world.getContext('2d', { alpha: false });
  wctx.imageSmoothingEnabled = false;

  const overlay = $('overlay');
  const startScreen = $('startScreen');
  const pauseScreen = $('pauseScreen');
  const endScreen = $('endScreen');
  const screens = [startScreen, pauseScreen, endScreen];

  const hpPips = $('hpPips');
  const depthPct = $('depthPct');
  const depthFill = $('depthFill');
  const scoreVal = $('scoreVal');
  const comboVal = $('comboVal');
  const sectionLabel = $('sectionLabel');
  const timeVal = $('timeVal');
  const startBtn = $('startBtn');
  const loadStatus = $('loadStatus');
  const bestLine = $('bestLine');
  const muteBtn = $('muteBtn');
  const pauseBtn = $('pauseBtn');
  const resumeBtn = $('resumeBtn');
  const restartBtn = $('restartBtn');
  const menuBtn = $('menuBtn');
  const retryBtn = $('retryBtn');
  const endMenuBtn = $('endMenuBtn');
  const endKicker = $('endKicker');
  const endTitle = $('endTitle');
  const endSub = $('endSub');
  const endDepth = $('endDepth');
  const endScore = $('endScore');
  const endCombo = $('endCombo');
  const endPerfect = $('endPerfect');
  const endGood = $('endGood');
  const endMiss = $('endMiss');
  const endTime = $('endTime');
  const endBest = $('endBest');
  const banner = $('banner');
  const bannerNum = $('bannerNum');
  const bannerName = $('bannerName');
  const bannerSub = $('bannerSub');
  const judge = $('judge');
  const toast = $('toast');
  const stick = $('stick');
  const knob = $('knob');
  const strikeBtn = $('strikeBtn');

  const audio = new AudioEngine();

  const S = {
    phase: 'loading',
    touch: false,
    ready: false,
    loadingAudio: false,
    starting: false,
    resuming: false,
    uiTime: 0,
    songTime: 0,
    pausedArtTime: 0,
    hp: HP_MAX,
    drill: 0,
    score: 0,
    combo: 0,
    maxCombo: 0,
    perfect: 0,
    good: 0,
    missed: 0,
    fizzles: 0,
    hazards: [],
    warnings: [],
    pulses: [],
    particles: [],
    consumed: new Uint8Array(BEATS.length),
    beatCursor: 0,
    missCursor: 0,
    spawnCount: 0,
    sectionIndex: -1,
    section: SECTIONS[0] || null,
    beatPulse: 0,
    barPulse: 0,
    shake: 0,
    hitFlash: 0,
    nextBeat: null,
    fullShown: false,
    introShown: false,
    result: null,
    best: null,
    keys: Object.create(null),
    stick: { x: 0, y: 0, pointer: null },
    player: {
      x: CX, y: 258, vx: 0, vy: 0,
      dir: -Math.PI / 2, moving: false, invuln: 0, hitFlash: 0
    },
    moveAcc: 0,
    rng: Core.mulberry32(0x51a7),
    lastLevels: { bass: 0, mid: 0, high: 0, level: 0 }
  };

  let vw = 0, vh = 0, stageSize = 400;
  let last = 0, raf = 0;
  let bannerTimer = 0, judgeTimer = 0, toastTimer = 0;

  // ---------- small helpers ----------

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function setText(el, value) {
    if (!el) return;
    if (el.__drillText !== value) {
      el.__drillText = value;
      el.textContent = value;
    }
  }
  function group(n) {
    return String(Math.max(0, Math.round(n))).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  }
  function padScore(n) {
    const s = String(Math.max(0, Math.round(n)));
    return s.length >= 6 ? s : '000000'.slice(s.length) + s;
  }
  function nowPhase() { return S.phase; }

  function loadBest() {
    try {
      const b = JSON.parse(localStorage.getItem('drill.best') || 'null');
      if (b && Number.isFinite(b.progress) && Number.isFinite(b.score)) return b;
    } catch (e) {}
    return null;
  }

  function saveBest(result) {
    const prev = S.best || loadBest();
    const better = !prev ||
      result.progress > prev.progress + 0.001 ||
      (Math.abs(result.progress - prev.progress) <= 0.001 && result.score > prev.score) ||
      (result.won && !prev.won);
    if (better) {
      const b = {
        progress: Math.round(result.progress * 10) / 10,
        score: Math.round(result.score),
        won: !!result.won,
        combo: result.maxCombo,
        at: Date.now()
      };
      S.best = b;
      try { localStorage.setItem('drill.best', JSON.stringify(b)); } catch (e) {}
      return true;
    }
    S.best = prev;
    return false;
  }

  function updateBestLine() {
    if (!bestLine) return;
    const b = S.best || loadBest();
    S.best = b;
    if (!b) {
      bestLine.hidden = true;
      return;
    }
    bestLine.hidden = false;
    setText(
      bestLine,
      'ЛУЧШИЙ ЗАБЕГ · ' + Math.round(b.progress) + '% · ' + group(b.score) + ' ОЧКОВ' +
      (b.won ? ' · ПРОБИТ' : '')
    );
  }

  // ---------- resize / scaling ----------

  function isTouchDevice() {
    return (navigator.maxTouchPoints && navigator.maxTouchPoints > 0) ||
      ('ontouchstart' in window) ||
      (window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
  }

  function resize() {
    vw = Math.max(300, window.innerWidth || 960);
    vh = Math.max(260, window.innerHeight || 640);

    const touch = isTouchDevice();
    if (touch !== S.touch) {
      S.touch = touch;
      document.body.classList.toggle('touch', touch);
    }

    const landscape = vw >= vh;
    const topReserve = touch && landscape ? 74 : 84;
    const bottomReserve = touch ? (landscape ? 14 : 150) : 24;
    const sideReserve = 12;
    const availW = vw - sideReserve * 2;
    const availH = vh - topReserve - bottomReserve;

    let scale = Math.min(availW / W, availH / H);
    if (scale >= 1) {
      scale = Math.floor(scale * 2) / 2;
      if (scale < 1) scale = 1;
    } else {
      scale = Math.max(0.42, Math.floor(scale * 100) / 100);
    }

    stageSize = Math.round(W * scale);
    const left = Math.round((vw - stageSize) / 2);
    // Keep the field close under the HUD. The spare height is used by the
    // touch controls at the bottom of the viewport.
    const top = Math.round(topReserve + Math.max(0, (availH - stageSize) * 0.08));

    stage.style.width = stageSize + 'px';
    stage.style.height = stageSize + 'px';
    stage.style.left = left + 'px';
    stage.style.top = top + 'px';
  }

  // ---------- screen / state flow ----------

  function showScreen(id) {
    for (const s of screens) {
      if (!s) continue;
      const on = s.id === id;
      s.classList.toggle('active', on);
      s.classList.toggle('hidden', !on);
      s.setAttribute('aria-hidden', on ? 'false' : 'true');
    }
    overlay.classList.toggle('hidden', !id);
  }

  function applyPhase(phase) {
    S.phase = phase;
    document.body.classList.remove('state-loading', 'state-menu', 'state-playing', 'state-paused', 'state-won', 'state-lost', 'state-error');
    document.body.classList.add('state-' + phase);
    document.body.classList.toggle('playing', phase === 'playing');
    if (phase === 'playing') {
      showScreen(null);
    } else if (phase === 'paused') {
      showScreen('pauseScreen');
    } else if (phase === 'won' || phase === 'lost') {
      showScreen('endScreen');
    } else {
      showScreen('startScreen');
    }
  }

  function announceSection(sec, first) {
    if (!sec) return;
    const idx = Math.max(0, SECTIONS.indexOf(sec));
    setText(bannerNum, String(idx + 1).padStart(2, '0') + ' / ' + String(SECTIONS.length).padStart(2, '0'));
    setText(bannerName, sec.name);
    setText(bannerSub, first ? SECTION_SUB.silence : (SECTION_SUB[sec.id] || ''));
    banner.classList.remove('show');
    // retrigger CSS transition/animation
    void banner.offsetWidth;
    banner.classList.add('show');
    clearTimeout(bannerTimer);
    bannerTimer = setTimeout(function () { banner.classList.remove('show'); }, first ? 4200 : 3100);
  }

  function showJudge(text, kind) {
    if (!judge) return;
    judge.textContent = text;
    judge.className = 'show ' + (kind || '');
    clearTimeout(judgeTimer);
    judgeTimer = setTimeout(function () { judge.classList.remove('show'); }, 650);
  }

  function showToast(text, kind, dur) {
    if (!toast) return;
    toast.textContent = text;
    toast.className = 'show ' + (kind || '');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toast.classList.remove('show'); }, dur || 1800);
  }

  // ---------- HUD ----------

  for (let i = 0; i < HP_MAX; i++) {
    const pip = document.createElement('span');
    hpPips.appendChild(pip);
  }
  const pips = Array.prototype.slice.call(hpPips.children);
  let lastHpDrawn = -1;

  function updateHud(force) {
    const pct = clamp(S.drill, 0, 100);
    setText(depthPct, Math.round(pct) + '%');
    depthFill.style.transform = 'scaleX(' + (pct / 100).toFixed(4) + ')';
    setText(scoreVal, padScore(S.score));
    setText(comboVal, S.combo > 1 ? 'КОМБО ' + S.combo : '');
    comboVal.classList.toggle('hot', S.combo >= 24);
    setText(timeVal, Core.formatTime(S.songTime) + ' / ' + Core.formatTime(END));
    if (S.section) setText(sectionLabel, S.section.name);

    if (force || S.hp !== lastHpDrawn) {
      lastHpDrawn = S.hp;
      for (let i = 0; i < pips.length; i++) {
        pips[i].classList.toggle('on', i < S.hp);
        pips[i].classList.toggle('last', i === S.hp - 1 && S.hp === 1);
      }
      document.body.classList.toggle('lowhp', S.hp > 0 && S.hp <= 2);
    }
  }

  // ---------- audio loading ----------

  function setLoadStatus(text, error) {
    if (!loadStatus) return;
    loadStatus.textContent = text;
    loadStatus.classList.toggle('error', !!error);
  }

  async function loadAudio() {
    if (S.loadingAudio || audio.ready) {
      if (audio.ready) {
        S.ready = true;
        startBtn.disabled = false;
        setText(startBtn, 'НАЧАТЬ РИТУАЛ');
      }
      return;
    }
    S.loadingAudio = true;
    S.ready = false;
    startBtn.disabled = true;
    setText(startBtn, 'ПРОБУЖДЕНИЕ…');
    setLoadStatus('ПРОБУЖДЕНИЕ ТРЕКА… 0%', false);

    try {
      await audio.load(function (p) {
        const pc = Math.round(clamp(p, 0, 1) * 100);
        setLoadStatus('ПРОБУЖДЕНИЕ ТРЕКА… ' + pc + '%', false);
      });
      S.ready = true;
      startBtn.disabled = false;
      setText(startBtn, 'НАЧАТЬ РИТУАЛ');
      setLoadStatus('ТРЕК ГОТОВ · ЗАБЕГ 2:35 · НАУШНИКИ', false);
    } catch (e) {
      console.error(e);
      S.ready = false;
      audio.ready = false;
      startBtn.disabled = false;
      setText(startBtn, 'ПОВТОРИТЬ ЗАГРУЗКУ');
      setLoadStatus('ТРЕК НЕ ЗАГРУЗИЛСЯ. ЗАПУСТИ ЧЕРЕЗ ./play.sh ИЛИ ЛОКАЛЬНЫЙ СЕРВЕР.', true);
    } finally {
      S.loadingAudio = false;
      applyPhase(nowPhase() === 'loading' ? 'menu' : nowPhase());
    }
  }

  // ---------- run lifecycle ----------

  function resetRun() {
    S.songTime = 0;
    S.pausedArtTime = 0;
    S.hp = HP_MAX;
    S.drill = 0;
    S.score = 0;
    S.combo = 0;
    S.maxCombo = 0;
    S.perfect = 0;
    S.good = 0;
    S.missed = 0;
    S.fizzles = 0;
    S.hazards = [];
    S.warnings = [];
    S.pulses = [];
    S.particles = [];
    S.consumed = new Uint8Array(BEATS.length);
    S.beatCursor = 0;
    S.missCursor = 0;
    S.spawnCount = 0;
    S.sectionIndex = -1;
    S.section = SECTIONS[0] || null;
    S.beatPulse = 0;
    S.barPulse = 0;
    S.shake = 0;
    S.hitFlash = 0;
    S.nextBeat = null;
    S.fullShown = false;
    S.introShown = false;
    S.result = null;
    S.moveAcc = 0;
    S.rng = Core.mulberry32((0x51a7 ^ (Date.now() & 0xffff)) >>> 0);
    S.player.x = CX;
    S.player.y = 258;
    S.player.vx = 0;
    S.player.vy = 0;
    S.player.dir = -Math.PI / 2;
    S.player.moving = false;
    S.player.invuln = 0;
    S.player.hitFlash = 0;
    S.stick.x = 0;
    S.stick.y = 0;
    S.stick.pointer = null;
    knob.style.transform = '';
    lastHpDrawn = -1;
    banner.classList.remove('show');
    judge.classList.remove('show');
    toast.classList.remove('show');
    clearTimeout(bannerTimer);
    clearTimeout(judgeTimer);
    clearTimeout(toastTimer);
    updateHud(true);
  }

  async function beginRun() {
    if (S.starting) return;
    if (!audio.ready) {
      setLoadStatus('СНАЧАЛА ЗАГРУЗИ ТРЕК.', true);
      return;
    }
    S.starting = true;
    audio.stopNow();
    resetRun();
    S.sectionIndex = 0;
    applyPhase('playing');
    if (SECTIONS[0]) announceSection(SECTIONS[0], true);
    updateBestLine();
    try {
      await audio.start(0);
    } catch (e) {
      console.error(e);
      applyPhase('menu');
      setLoadStatus('НЕ УДАЛОСЬ ЗАПУСТИТЬ ТРЕК. НАЖМИ ЕЩЁ РАЗ.', true);
      setText(startBtn, 'НАЧАТЬ РИТУАЛ');
    } finally {
      S.starting = false;
    }
  }

  function pauseRun() {
    if (S.phase !== 'playing') return;
    audio.pause();
    S.pausedArtTime = audio.pausedAt || S.songTime;
    applyPhase('paused');
  }

  async function resumeRun() {
    if (S.phase !== 'paused' || S.resuming) return;
    S.resuming = true;
    applyPhase('playing');
    try {
      await audio.resume();
    } catch (e) {
      console.error(e);
      applyPhase('paused');
    } finally {
      S.resuming = false;
    }
  }

  function toMenu() {
    audio.stopNow();
    resetRun();
    S.result = null;
    applyPhase('menu');
    updateBestLine();
    if (audio.ready) {
      startBtn.disabled = false;
      setText(startBtn, 'НАЧАТЬ РИТУАЛ');
      setLoadStatus('ТРЕК ГОТОВ · ЗАБЕГ 2:35 · НАУШНИКИ', false);
    }
  }

  function makeResult(won, reason) {
    return {
      won: !!won,
      reason: reason,
      progress: Math.round(S.drill * 10) / 10,
      score: Math.round(S.score),
      maxCombo: S.maxCombo,
      perfect: S.perfect,
      good: S.good,
      missed: S.missed,
      fizzles: S.fizzles,
      hp: S.hp,
      time: S.songTime
    };
  }

  function finishRun(won, reason) {
    if (S.phase !== 'playing') return;
    S.result = makeResult(won, reason);
    S.result.newBest = saveBest(S.result);

    if (won) {
      S.hitFlash = Math.max(S.hitFlash, 0.55);
      S.shake = Math.max(S.shake, 0.5);
    } else {
      S.shake = 1.25;
      S.hitFlash = 1;
      // vinyl brake: the music is cut immediately, with a short scrape.
      audio.stopVinyl();
    }

    fillEndScreen(S.result, reason);
    applyPhase(won ? 'won' : 'lost');
    updateBestLine();
  }

  function fillEndScreen(r, reason) {
    endScreen.classList.toggle('win', !!r.won);
    endScreen.classList.toggle('lose', !r.won);

    setText(endKicker, r.won ? 'РИТУАЛ ЗАВЕРШЁН' : 'РИТУАЛ ОБОРВАН');
    setText(endTitle, r.won ? 'ПРОХОД ПРОБИТ' : 'БУР ЗАГЛОХ');

    let sub;
    if (r.won) {
      sub = 'Соседний курган услышал тебя. Древо приняло ритм.';
    } else if (reason === 'hp') {
      sub = 'Курган выпил последний удар. Слушай глубже и держи комбо.';
    } else {
      sub = 'Ты выжил, но не дошёл до соседа. Нужно 65% глубины к концу трека.';
    }
    setText(endSub, sub);
    setText(endDepth, Math.round(r.progress) + '%');
    setText(endScore, group(r.score));
    setText(endCombo, String(r.maxCombo));
    setText(endPerfect, String(r.perfect));
    setText(endGood, String(r.good));
    setText(endMiss, String(r.missed));
    setText(endTime, Core.formatTime(r.time));

    if (endBest) {
      if (r.newBest) {
        endBest.hidden = false;
        setText(endBest, 'НОВЫЙ РЕКОРД КУРГАНА');
      } else if (S.best) {
        endBest.hidden = false;
        setText(endBest, 'ЛУЧШИЙ ЗАБЕГ · ' + Math.round(S.best.progress) + '% · ' + group(S.best.score) + ' ОЧКОВ');
      } else {
        endBest.hidden = true;
      }
    }
  }

  // ---------- chart-driven world ----------

  function currentSection(t) {
    return Core.sectionAt(SECTIONS, t);
  }

  function updateSections(t) {
    const found = currentSection(t);
    if (found.index !== S.sectionIndex) {
      const first = S.sectionIndex < 0;
      S.sectionIndex = found.index;
      S.section = found.section;
      if (S.phase === 'playing' && !S.starting) {
        announceSection(found.section, first);
        if (found.section && (found.section.id === 'heart' || found.section.id === 'threshold')) {
          S.hitFlash = Math.max(S.hitFlash, 0.35);
          S.shake = Math.max(S.shake, 0.45);
        }
      }
      updateHud(true);
    }
  }

  function updateBeat(t) {
    const period = META.beatPeriod || 0.666667;
    const phase0 = META.beatPhase || 0.6347;
    const firstBeat = META.firstBeat || 6.635;
    const f = (t - phase0) / period;
    const frac = f - Math.floor(f);

    // The grid extends backwards in time; do not pulse during the intro silence.
    const silent = t < firstBeat - 0.18;
    S.beatPulse = silent ? 0 : Math.pow(1 - clamp(frac, 0, 1), 3.1);

    const beatNo = Math.floor((t - firstBeat) / period + 0.0001) + 9;
    const inBar = ((beatNo - 9) % 4 + 4) % 4;
    S.barPulse = silent || inBar !== 0 ? 0 : S.beatPulse;

    const found = Core.lowerBoundBeat(BEATS, t);
    S.nextBeat = silent ? null : (found < BEATS.length ? BEATS[found] : null);
  }

  function spawnWarning(beat, section) {
    const ang = Core.chooseSpawnAngle(S.player, S.rng, 177);
    const x = CX + Math.cos(ang) * 177;
    const y = CY + Math.sin(ang) * 177;
    const kind = Core.hazardKind(beat, section, S.spawnCount);
    S.spawnCount++;
    S.warnings.push({
      x: x,
      y: y,
      kind: kind,
      seed: S.rng() * TAU,
      delay: WARN_DELAY,
      maxDelay: WARN_DELAY
    });
  }

  function spawnHazard(w) {
    const sec = S.section || currentSection(S.songTime).section;
    const speed = Core.hazardSpeed(w.kind, sec, S.rng);
    const a = Math.atan2(S.player.y - w.y, S.player.x - w.x);
    S.hazards.push({
      x: w.x,
      y: w.y,
      kind: w.kind,
      seed: w.seed,
      speed: speed,
      vx: Math.cos(a) * speed,
      vy: Math.sin(a) * speed,
      r: HAZARD_R[w.kind] || HAZARD_R.thorn,
      born: S.songTime
    });
    for (let i = 0; i < 4; i++) {
      addParticle(
        w.x + (Math.random() - 0.5) * 8,
        w.y + (Math.random() - 0.5) * 8,
        (Math.random() - 0.5) * 14,
        (Math.random() - 0.5) * 14,
        0.35 + Math.random() * 0.3,
        w.kind === 'stone' ? Art.P.lilac : Art.P.flame,
        Math.random() < 0.25 ? 2 : 1,
        0
      );
    }
  }

  function processBeats(t) {
    while (S.beatCursor < BEATS.length && BEATS[S.beatCursor].t <= t + 0.0005) {
      const beat = BEATS[S.beatCursor];
      const found = currentSection(beat.t);
      const active = S.hazards.length + S.warnings.length;
      if (Core.shouldSpawn(beat, found.section, active)) spawnWarning(beat, found.section);
      S.beatCursor++;
    }
  }

  function processMissed(t) {
    while (S.missCursor < BEATS.length && BEATS[S.missCursor].t + GOOD_WINDOW < t) {
      if (!S.consumed[S.missCursor]) {
        S.missed++;
        if (S.combo > 0) {
          S.combo = 0;
          updateHud(true);
        }
      }
      S.missCursor++;
    }
  }

  function updatePlayer(dt) {
    const p = S.player;
    let kx = 0, ky = 0;
    if (S.keys.KeyA || S.keys.ArrowLeft) kx -= 1;
    if (S.keys.KeyD || S.keys.ArrowRight) kx += 1;
    if (S.keys.KeyW || S.keys.ArrowUp) ky -= 1;
    if (S.keys.KeyS || S.keys.ArrowDown) ky += 1;

    let ax = kx + S.stick.x;
    let ay = ky + S.stick.y;
    const mag = Math.hypot(ax, ay);
    if (mag > 1) { ax /= mag; ay /= mag; }

    const tx = ax * PLAYER_SPEED;
    const ty = ay * PLAYER_SPEED;
    const k = Math.min(1, dt * 14);
    p.vx += (tx - p.vx) * k;
    p.vy += (ty - p.vy) * k;
    p.x += p.vx * dt;
    p.y += p.vy * dt;

    const dx = p.x - CX, dy = p.y - CY;
    const d = Math.hypot(dx, dy);
    if (d > ARENA_R) {
      p.x = CX + dx / d * ARENA_R;
      p.y = CY + dy / d * ARENA_R;
      p.vx *= 0.5;
      p.vy *= 0.5;
    }

    const speed = Math.hypot(p.vx, p.vy);
    p.moving = speed > 9;
    if (p.moving) p.dir = Math.atan2(p.vy, p.vx);

    if (p.moving) {
      S.moveAcc += dt * 13;
      while (S.moveAcc >= 1) {
        S.moveAcc -= 1;
        const a = p.dir + Math.PI + (Math.random() - 0.5) * 0.7;
        addParticle(
          p.x + Math.cos(a) * 5,
          p.y + Math.sin(a) * 5 + 3,
          Math.cos(a) * (6 + Math.random() * 10),
          Math.sin(a) * (6 + Math.random() * 10) - 3,
          0.32 + Math.random() * 0.3,
          Math.random() < 0.25 ? Art.P.ember : Art.P.soil3,
          1,
          0
        );
      }
    }
  }

  function updateWarnings(dt) {
    for (let i = S.warnings.length - 1; i >= 0; i--) {
      const w = S.warnings[i];
      w.delay -= dt;
      if (w.delay <= 0) {
        S.warnings.splice(i, 1);
        spawnHazard(w);
      }
    }
  }

  function updateHazards(dt) {
    const p = S.player;
    for (let i = S.hazards.length - 1; i >= 0; i--) {
      const h = S.hazards[i];
      const dx = p.x - h.x, dy = p.y - h.y;
      const d = Math.hypot(dx, dy) || 0.001;
      const desired = Math.atan2(dy, dx);
      let cur = Math.atan2(h.vy, h.vx);
      let diff = ((desired - cur + Math.PI * 3) % TAU) - Math.PI;
      const steer = h.kind === 'stone' ? 1.15 : 1.8;
      cur += clamp(diff, -steer * dt, steer * dt);
      const wob = Math.sin(S.songTime * 2.2 + h.seed) * (h.kind === 'stone' ? 0.04 : 0.11);
      h.vx = Math.cos(cur + wob) * h.speed;
      h.vy = Math.sin(cur + wob) * h.speed;
      h.x += h.vx * dt;
      h.y += h.vy * dt;

      if (h.x < -24 || h.x > W + 24 || h.y < -24 || h.y > H + 24) {
        S.hazards.splice(i, 1);
        continue;
      }

      const hitR = h.r + 6;
      if (d < hitR) {
        S.hazards.splice(i, 1);
        if (p.invuln <= 0) {
          hurt(h.kind === 'stone' ? 2 : 1, h);
          if (S.phase !== 'playing') return;
        } else {
          burst(h.x, h.y, 5, [Art.P.mauve, Art.P.rust]);
        }
      }
    }
  }

  function burst(x, y, count, colors) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * TAU;
      const sp = 16 + Math.random() * 42;
      addParticle(
        x, y,
        Math.cos(a) * sp, Math.sin(a) * sp,
        0.35 + Math.random() * 0.5,
        colors[Math.floor(Math.random() * colors.length)],
        Math.random() < 0.25 ? 2 : 1,
        22
      );
    }
  }

  function hurt(amount, h) {
    const p = S.player;
    S.hp = Math.max(0, S.hp - amount);
    S.combo = 0;
    S.drill = Math.max(0, S.drill - 1.4);
    p.invuln = 1.25;
    p.hitFlash = 1;
    S.hitFlash = 0.9;
    S.shake = 1.1;
    audio.sfx('hurt');
    burst(h.x, h.y, 16, [Art.P.flame, Art.P.ember, Art.P.rust, Art.P.cream]);
    showJudge('РАНА', 'miss');
    showToast(amount >= 2 ? 'КАМЕНЬ ПРОБИЛ ЗАЩИТУ' : 'КОРЕНЬ РАНИТ', 'warn', 1000);
    updateHud(true);
    if (S.hp <= 0) finishRun(false, 'hp');
  }

  function addParticle(x, y, vx, vy, life, color, size, g) {
    if (S.particles.length > 260) S.particles.shift();
    S.particles.push({
      x: x, y: y, vx: vx, vy: vy,
      life: life, maxLife: life,
      color: color, size: size, g: g || 0
    });
  }

  function strike() {
    if (S.phase !== 'playing' || !audio.ready) return;
    const p = S.player;
    const res = Core.judge(BEATS, S.songTime, S.consumed, PERFECT_WINDOW, GOOD_WINDOW);

    if (res.grade === 'fizzle') {
      if (res.reason === 'taken') {
        // A double-tap inside one beat is ignored, not punished.
        S.pulses.push({ x: p.x, y: p.y, life: 0.16, maxLife: 0.16, maxR: 18, fizzle: true });
        return;
      }
      S.fizzles++;
      S.combo = 0;
      S.pulses.push({ x: p.x, y: p.y, life: 0.32, maxLife: 0.32, maxR: 24, fizzle: true });
      audio.sfx('fizzle');
      showJudge('НЕ В ТАКТ', 'miss');
      updateHud(true);
      return;
    }

    const perfect = res.grade === 'perfect';
    S.consumed[res.index] = 1;
    if (perfect) S.perfect++; else S.good++;
    S.combo++;
    if (S.combo > S.maxCombo) S.maxCombo = S.combo;
    const mult = Core.comboMultiplier(S.combo);
    S.score += (perfect ? 300 : 180) * mult;
    S.drill = Math.min(100, S.drill + (perfect ? PROGRESS.perfect : PROGRESS.good));

    const radius = perfect ? 64 : 52;
    let kills = 0;
    for (let i = S.hazards.length - 1; i >= 0; i--) {
      const h = S.hazards[i];
      const d = Math.hypot(h.x - p.x, h.y - p.y);
      if (d <= radius + h.r) {
        S.hazards.splice(i, 1);
        kills++;
        S.score += (perfect ? 190 : 115) * mult;
        S.drill = Math.min(100, S.drill + (perfect ? PROGRESS.hazardPerfect : PROGRESS.hazardGood));
        burst(h.x, h.y, h.kind === 'stone' ? 12 : 9, perfect ? [Art.P.cream, Art.P.gold, Art.P.flame] : [Art.P.gold, Art.P.flame, Art.P.rust]);
        if (h.kind === 'stone') S.shake = Math.max(S.shake, 0.6);
      }
    }

    S.pulses.push({
      x: p.x, y: p.y,
      life: perfect ? 0.5 : 0.4,
      maxLife: perfect ? 0.5 : 0.4,
      maxR: radius + 6,
      perfect: perfect,
      fizzle: false
    });

    for (let i = 0; i < (perfect ? 12 : 8); i++) {
      const a = Math.random() * TAU;
      const sp = 18 + Math.random() * (perfect ? 58 : 38);
      addParticle(
        p.x, p.y,
        Math.cos(a) * sp, Math.sin(a) * sp,
        0.4 + Math.random() * 0.55,
        perfect ? (i % 3 ? Art.P.cream : Art.P.gold) : (i % 2 ? Art.P.gold : Art.P.flame),
        Math.random() < 0.3 ? 2 : 1,
        18
      );
    }

    S.hitFlash = Math.max(S.hitFlash, perfect ? 0.24 : 0.1);
    S.shake = Math.max(S.shake, (perfect ? 0.45 : 0.2) + Math.min(0.5, kills * 0.12));
    audio.sfx(perfect ? 'perfect' : 'hit', kills > 0);
    showJudge(perfect ? 'ИДЕАЛЬНО' : 'ХОРОШО', perfect ? 'perfect' : 'good');

    if (S.combo > 0 && S.combo % 24 === 0 && S.hp < HP_MAX) {
      S.hp++;
      audio.sfx('heal');
      showToast('КУРГАН ДЫШИТ · +1 ЖИЗНЬ', 'heal', 1700);
      burst(p.x, p.y, 14, [Art.P.cream, Art.P.bone, Art.P.gold]);
      updateHud(true);
    }

    if (S.drill >= 100 && !S.fullShown) {
      S.fullShown = true;
      showToast('ГЛУБИНА 100% · ДЕРЖИСЬ ДО КОНЦА', 'heal', 2300);
    }
  }

  function updateFx(dt) {
    const p = S.player;
    p.invuln = Math.max(0, p.invuln - dt);
    p.hitFlash = Math.max(0, p.hitFlash - dt * 3.4);
    S.hitFlash = Math.max(0, S.hitFlash - dt * 2.1);
    S.shake = Math.max(0, S.shake - dt * 3.8);

    for (let i = S.pulses.length - 1; i >= 0; i--) {
      const x = S.pulses[i];
      x.life -= dt;
      if (x.life <= 0) S.pulses.splice(i, 1);
    }
    for (let i = S.particles.length - 1; i >= 0; i--) {
      const x = S.particles[i];
      x.life -= dt;
      if (x.life <= 0) { S.particles.splice(i, 1); continue; }
      x.x += x.vx * dt;
      x.y += x.vy * dt;
      if (x.g) x.vy += x.g * dt;
      x.vx *= 0.985;
      x.vy *= 0.985;
      if (x.x < -20 || x.x > W + 20 || x.y < -20 || x.y > H + 20) S.particles.splice(i, 1);
    }
  }

  function updatePlaying(dt) {
    const t = audio.time;
    S.songTime = t;

    if (!S.introShown && t > 2.4) {
      S.introShown = true;
      showToast('ПЕРВЫЙ УДАР — НА 0:06 · ДВИГАЙСЯ ПО КРУГУ', 'warn', 2400);
    }

    updateSections(t);
    updateBeat(t);
    processBeats(t);
    processMissed(t);
    updatePlayer(dt);
    updateWarnings(dt);
    updateHazards(dt);
    updateFx(dt);

    if (S.phase !== 'playing') return;

    if (t >= END - 0.001) {
      finishRun(S.drill >= WIN, 'time');
    }
  }

  function updateIdle(dt) {
    S.uiTime += dt;
    if (S.phase === 'won' || S.phase === 'lost') {
      updateFx(dt);
    } else if (S.phase === 'menu' || S.phase === 'error') {
      updateFx(dt * 0.35);
    }
    // paused: freeze the ritual completely
  }

  // ---------- draw ----------

  function fakeLevels() {
    const t = S.uiTime;
    return {
      bass: 0.07 + 0.035 * (0.5 + 0.5 * Math.sin(t * 0.83)),
      mid: 0.06 + 0.03 * (0.5 + 0.5 * Math.sin(t * 0.61 + 1.8)),
      high: 0.04 + 0.025 * (0.5 + 0.5 * Math.sin(t * 0.47 + 3.1)),
      level: 0.07
    };
  }

  function draw(dt) {
    let time;
    let levels;
    if (S.phase === 'playing') {
      time = S.songTime;
      levels = audio.levels();
      S.lastLevels = levels;
    } else if (S.phase === 'paused') {
      time = S.pausedArtTime;
      levels = S.lastLevels;
      dt = 0;
    } else {
      time = S.uiTime;
      levels = fakeLevels();
    }

    const G = {
      state: S.phase,
      player: S.player,
      hazards: S.hazards,
      warnings: S.warnings,
      pulses: S.pulses,
      particles: S.particles,
      drill: S.drill,
      combo: S.combo,
      hp: S.hp,
      beatPulse: S.beatPulse,
      barPulse: S.barPulse,
      shake: S.shake,
      hitFlash: S.hitFlash,
      nextBeat: S.nextBeat,
      section: S.section
    };
    Art.render(wctx, G, time, dt, levels);
  }

  // ---------- main loop ----------

  function frame(now) {
    raf = requestAnimationFrame(frame);
    if (!last) last = now;
    let dt = (now - last) / 1000;
    last = now;
    if (!Number.isFinite(dt) || dt < 0) dt = 0;
    dt = clamp(dt, 0, 0.05);

    try {
      if (S.phase === 'playing') {
        updatePlaying(dt);
        S.uiTime += dt;
      } else if (S.phase !== 'paused') {
        updateIdle(dt);
      }
      draw(dt);
      updateHud(false);
    } catch (e) {
      console.error(e);
    }
  }

  // ---------- input ----------

  const MOVE_CODES = {
    KeyW: 1, KeyA: 1, KeyS: 1, KeyD: 1,
    ArrowUp: 1, ArrowLeft: 1, ArrowDown: 1, ArrowRight: 1
  };

  function toggleMute() {
    const muted = audio.toggleMute();
    setText(muteBtn, muted ? '×' : '♪');
    muteBtn.setAttribute('aria-label', muted ? 'Включить звук' : 'Выключить звук');
    muteBtn.title = muted ? 'Звук выключен (M)' : 'Звук включён (M)';
    showToast(muted ? 'ЗВУК ВЫКЛЮЧЕН' : 'ЗВУК ВКЛЮЧЁН', '', 900);
  }

  function onKeyDown(e) {
    if (e.repeat) {
      if (MOVE_CODES[e.code]) e.preventDefault();
      return;
    }
    if (MOVE_CODES[e.code]) {
      S.keys[e.code] = true;
      e.preventDefault();
      return;
    }
    if (e.code === 'Space' || e.code === 'KeyJ') {
      e.preventDefault();
      if (S.phase === 'playing') strike();
      else if (S.phase === 'menu' && !S.starting && S.ready) beginRun();
      else if (S.phase === 'paused') resumeRun();
      return;
    }
    if (e.code === 'KeyP' || e.code === 'Escape') {
      e.preventDefault();
      if (S.phase === 'playing') pauseRun();
      else if (S.phase === 'paused') resumeRun();
      else if (S.phase === 'won' || S.phase === 'lost') toMenu();
      return;
    }
    if (e.code === 'KeyR') {
      e.preventDefault();
      if (S.phase === 'paused' || S.phase === 'won' || S.phase === 'lost') beginRun();
      return;
    }
    if (e.code === 'KeyM') {
      e.preventDefault();
      toggleMute();
    }
  }

  function onKeyUp(e) {
    if (MOVE_CODES[e.code]) {
      S.keys[e.code] = false;
      e.preventDefault();
    }
  }

  function clearKeys() {
    for (const k in S.keys) S.keys[k] = false;
    resetStick();
  }

  function resetStick() {
    S.stick.x = 0;
    S.stick.y = 0;
    S.stick.pointer = null;
    knob.style.transform = '';
  }

  function stickMove(e) {
    if (S.stick.pointer !== e.pointerId) return;
    const r = stick.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    let dx = e.clientX - cx;
    let dy = e.clientY - cy;
    const max = r.width * 0.33;
    const d = Math.hypot(dx, dy);
    if (d > max) { dx = dx / d * max; dy = dy / d * max; }
    S.stick.x = dx / max;
    S.stick.y = dy / max;
    if (Math.hypot(S.stick.x, S.stick.y) < 0.12) {
      S.stick.x = 0;
      S.stick.y = 0;
    }
    knob.style.transform = 'translate(' + dx.toFixed(1) + 'px, ' + dy.toFixed(1) + 'px)';
    e.preventDefault();
  }

  function onStickDown(e) {
    if (S.phase !== 'playing') return;
    S.stick.pointer = e.pointerId;
    try { stick.setPointerCapture(e.pointerId); } catch (err) {}
    stickMove(e);
  }

  function onStickUp(e) {
    if (S.stick.pointer !== e.pointerId) return;
    resetStick();
    try { stick.releasePointerCapture(e.pointerId); } catch (err) {}
  }

  // ---------- wiring ----------

  startBtn.addEventListener('click', function () {
    if (S.starting) return;
    if (!audio.ready) {
      loadAudio();
      return;
    }
    beginRun();
  });
  resumeBtn.addEventListener('click', resumeRun);
  restartBtn.addEventListener('click', beginRun);
  menuBtn.addEventListener('click', toMenu);
  retryBtn.addEventListener('click', beginRun);
  endMenuBtn.addEventListener('click', toMenu);
  pauseBtn.addEventListener('click', function (e) { e.stopPropagation(); pauseRun(); });
  muteBtn.addEventListener('click', function (e) { e.stopPropagation(); toggleMute(); });

  strikeBtn.addEventListener('pointerdown', function (e) {
    e.preventDefault();
    e.stopPropagation();
    strikeBtn.classList.add('pressed');
    if (S.phase === 'playing') strike();
    else if (S.phase === 'menu' && S.ready) beginRun();
  });
  strikeBtn.addEventListener('pointerup', function () { strikeBtn.classList.remove('pressed'); });
  strikeBtn.addEventListener('pointercancel', function () { strikeBtn.classList.remove('pressed'); });
  strikeBtn.addEventListener('pointerleave', function () { strikeBtn.classList.remove('pressed'); });

  stick.addEventListener('pointerdown', onStickDown);
  stick.addEventListener('pointermove', stickMove);
  stick.addEventListener('pointerup', onStickUp);
  stick.addEventListener('pointercancel', onStickUp);
  stick.addEventListener('lostpointercapture', resetStick);

  stage.addEventListener('pointerdown', function (e) {
    if (S.phase === 'playing') {
      e.preventDefault();
      strike();
    }
  });
  stage.addEventListener('contextmenu', function (e) { e.preventDefault(); });

  window.addEventListener('keydown', onKeyDown, { passive: false });
  window.addEventListener('keyup', onKeyUp, { passive: false });
  window.addEventListener('blur', clearKeys);
  window.addEventListener('resize', resize);
  window.addEventListener('orientationchange', function () { setTimeout(resize, 120); });

  document.addEventListener('visibilitychange', function () {
    if (document.hidden) {
      clearKeys();
      if (S.phase === 'playing') pauseRun();
    }
  });

  audio.onEnded = function () {
    if (S.phase === 'playing') finishRun(S.drill >= WIN, 'time');
  };

  // ---------- boot ----------

  function boot() {
    if (document.fonts && document.fonts.load) {
      document.fonts.load('16px Tiny5').catch(function () {});
    }
    S.best = loadBest();
    updateBestLine();
    resize();
    Art.init();
    resetRun();
    applyPhase('menu');
    showScreen('startScreen');
    updateHud(true);
    loadAudio();
    raf = requestAnimationFrame(frame);
  }

  // Exposed only for the local self-test / diagnostics.
  window.__drillDebug = {
    state: S,
    chart: CH,
    beginRun: beginRun,
    strike: strike,
    finishRun: finishRun,
    audio: audio
  };

  boot();
})();
