/* ОСТАВШИЙСЯ — game engine.
   State machine, input, judgement, story beats, echoes, choices and endings.
   Art lives in art.js, sound in audio.js, content in story.js / charts.js. */
(function () {
  'use strict';

  const STORY = window.TRO_STORY;
  const CHARTS = window.TRO_CHARTS;
  const ART = window.TRO_ART;
  const AudioEngine = window.TRO_AUDIO;

  const W = ART.W;
  const H = ART.H;
  const SPAWN_Y = -14;

  const $ = id => document.getElementById(id);
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const lerp = (a, b, t) => a + (b - a) * t;

  const SAVE_KEY = 'tro.save.v2';
  const SET_KEY = 'tro.settings.v2';
  const SCREENS = [
    'bootScreen', 'titleScreen', 'chapterScreen', 'pauseScreen', 'resultScreen',
    'endingScreen', 'settingsScreen', 'codexScreen', 'chaptersScreen', 'confirmScreen'
  ];

  const DIFF = {
    easy: {
      perfect: 0.115, good: 0.205, ok: 0.33, travel: 2.05,
      label: 'СЛУШАТЕЛЬ', note: 'Меньше рун, больше времени на вдох.'
    },
    normal: {
      perfect: 0.078, good: 0.15, ok: 0.255, travel: 1.72,
      label: 'СПУТНИК', note: 'Руны в такт. Окно — как дыхание.'
    },
    hard: {
      perfect: 0.052, good: 0.105, ok: 0.19, travel: 1.42,
      label: 'ДРУИД', note: 'Плотный поток, короткое окно, быстрый полёт.'
    }
  };

  const CODE_LANE = {
    KeyD: 0, KeyF: 1, KeyJ: 2, KeyK: 3,
    ArrowLeft: 0, ArrowDown: 1, ArrowUp: 2, ArrowRight: 3,
    Digit1: 0, Digit2: 1, Digit3: 2, Digit4: 3,
    Numpad1: 0, Numpad2: 1, Numpad3: 2, Numpad4: 3
  };

  const JUDGE_TEXT = {
    perfect: 'ИДЕАЛЬНО',
    good: 'ТОЧНО',
    ok: 'ХОРОШО',
    miss: 'МИМО'
  };

  const audio = new AudioEngine();
  const canvas = $('world');
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;

  const defaultSave = () => ({
    version: 2,
    unlocked: 1,
    chapters: {},
    echoes: {},
    last: 0,
    bestCombo: 0
  });

  const defaultSettings = () => ({
    volume: 0.9,
    offset: 0,
    difficulty: 'normal',
    sfx: true,
    shake: true,
    captions: true,
    muted: false
  });

  const state = {
    phase: 'boot',
    save: defaultSave(),
    settings: defaultSettings(),
    chapter: 0,
    activeDiff: 'normal',
    preparedSlug: '',
    prepareToken: 0,
    audioReady: false,
    run: null,
    notes: [],
    chart: null,
    songTime: 0,
    missCursor: 0,
    beatCursor: 0,
    echoTimes: [],
    echoActive: -1,
    combo: 0,
    maxCombo: 0,
    memory: 0.5,
    levels: { bass: 0, mid: 0, high: 0, level: 0 },
    laneFlash: [0, 0, 0, 0],
    particles: [],
    rings: [],
    shake: 0,
    realT: 0,
    lastFrame: 0,
    captionUntil: 0,
    settingsReturn: 'title',
    confirmAction: null,
    confirmReturn: null,
    artScene: '',
    toastTimer: 0
  };

  // ------------------------------------------------------------------ storage
  function loadSave() {
    const base = defaultSave();
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return base;
      const o = JSON.parse(raw);
      if (!o || typeof o !== 'object') return base;
      return {
        version: 2,
        unlocked: clamp(o.unlocked | 0 || 1, 1, 9),
        chapters: o.chapters && typeof o.chapters === 'object' ? o.chapters : {},
        echoes: o.echoes && typeof o.echoes === 'object' ? o.echoes : {},
        last: clamp(o.last | 0, 0, 8),
        bestCombo: Math.max(0, o.bestCombo | 0)
      };
    } catch (e) {
      return base;
    }
  }

  function persistSave() {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(state.save)); } catch (e) {}
  }

  function loadSettings() {
    const base = defaultSettings();
    try {
      const raw = localStorage.getItem(SET_KEY);
      if (!raw) return base;
      const o = JSON.parse(raw);
      if (!o || typeof o !== 'object') return base;
      const volume = Number(o.volume);
      return {
        volume: Number.isFinite(volume) ? clamp(volume, 0, 1) : base.volume,
        offset: clamp(Number(o.offset) || 0, -250, 250),
        difficulty: DIFF[o.difficulty] ? o.difficulty : 'normal',
        sfx: o.sfx !== false,
        shake: o.shake !== false,
        captions: o.captions !== false,
        muted: !!o.muted
      };
    } catch (e) {
      return base;
    }
  }

  function persistSettings() {
    try { localStorage.setItem(SET_KEY, JSON.stringify(state.settings)); } catch (e) {}
  }

  function totalEchoes() {
    let n = 0;
    for (const slug of Object.keys(state.save.echoes)) {
      const arr = state.save.echoes[slug];
      if (Array.isArray(arr)) n += arr.length;
    }
    return n;
  }

  function hasProgress() {
    return state.save.unlocked > 1 || Object.keys(state.save.chapters).length > 0 || totalEchoes() > 0;
  }

  function chapterRecord(index) {
    const slug = STORY.CHAPTERS[index].slug;
    return state.save.chapters[slug] || null;
  }

  function ensureChapterRecord(index) {
    const slug = STORY.CHAPTERS[index].slug;
    let rec = state.save.chapters[slug];
    if (!rec) {
      rec = { best: 0, tries: 0, cleared: false, choice: null };
      state.save.chapters[slug] = rec;
    }
    return rec;
  }

  function saveEcho(chapterIndex, echoIndex) {
    const slug = STORY.CHAPTERS[chapterIndex].slug;
    const arr = Array.isArray(state.save.echoes[slug]) ? state.save.echoes[slug] : [];
    if (arr.indexOf(echoIndex) === -1) {
      arr.push(echoIndex);
      arr.sort((a, b) => a - b);
      state.save.echoes[slug] = arr;
    }
    persistSave();
  }

  // ------------------------------------------------------------------- helpers
  function fmt(sec) {
    sec = Math.max(0, Number(sec) || 0);
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return m + ':' + String(s).padStart(2, '0');
  }

  function rankFor(c) {
    if (c >= 0.85) return 'ДРУИД';
    if (c >= 0.68) return 'ХРАНИТЕЛЬ';
    if (c >= 0.5) return 'СПУТНИК';
    return 'СЛУШАТЕЛЬ';
  }

  function idleLevels(t) {
    return {
      bass: 0.10 + 0.05 * Math.sin(t * 0.7),
      mid: 0.13 + 0.06 * Math.sin(t * 0.93 + 1.2),
      high: 0.08 + 0.05 * Math.sin(t * 1.31 + 2.4),
      level: 0.13
    };
  }

  function envLevels(chart, t) {
    if (!chart || !chart.env || !chart.env.length) return idleLevels(t);
    const hz = chart.envHz || 5;
    const i = clamp(Math.floor(t * hz), 0, chart.env.length - 1);
    const row = chart.env[i] || '00000000';
    return {
      bass: parseInt(row.substr(2, 2), 16) / 255 || 0,
      mid: parseInt(row.substr(4, 2), 16) / 255 || 0,
      high: parseInt(row.substr(6, 2), 16) / 255 || 0,
      level: parseInt(row.substr(0, 2), 16) / 255 || 0
    };
  }

  function noteSpeed() {
    const travel = DIFF[state.activeDiff].travel;
    return ART.SPEED * ART.TRAVEL / travel;
  }

  function toast(msg, dur) {
    const el = $('toast');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(state.toastTimer);
    state.toastTimer = setTimeout(() => el.classList.remove('show'), dur || 2400);
  }

  function hideCaption() {
    $('caption').classList.remove('show', 'echo');
    $('caption').textContent = '';
    state.captionUntil = 0;
  }

  function showCaption(kind, title, text, dur) {
    if (!state.settings.captions) return;
    const el = $('caption');
    el.classList.toggle('echo', kind === 'echo');
    el.textContent = '';
    if (title) {
      const b = document.createElement('b');
      b.textContent = title;
      el.appendChild(b);
    }
    el.appendChild(document.createTextNode(text));
    el.classList.add('show');
    state.captionUntil = state.realT + (dur || 5);
  }

  function hideJudge() {
    const el = $('judge');
    el.classList.remove('show', 'perfect', 'good', 'ok', 'miss');
    el.textContent = '';
  }

  function showJudge(kind) {
    const el = $('judge');
    el.textContent = JUDGE_TEXT[kind] || '';
    el.className = 'judge ' + kind;
    void el.offsetWidth;
    el.classList.add('show');
  }

  function burst(x, y, color, count, power) {
    const n = Math.min(60, count | 0);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = (18 + Math.random() * 80) * (power || 1);
      state.particles.push({
        x, y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - 28,
        life: 0.4 + Math.random() * 0.55,
        max: 0.95,
        c: color,
        s: Math.random() < 0.28 ? 2 : 1
      });
    }
    state.rings.push({ x, y, r: 5, c: color, life: 0.5, max: 0.5 });
    if (state.particles.length > 380) state.particles.splice(0, state.particles.length - 380);
    if (state.rings.length > 24) state.rings.splice(0, state.rings.length - 24);
  }

  function updateParticles(dt) {
    const arr = state.particles;
    for (let i = arr.length - 1; i >= 0; i--) {
      const p = arr[i];
      p.life -= dt;
      if (p.life <= 0) { arr.splice(i, 1); continue; }
      p.vy += 190 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
    const rings = state.rings;
    for (let i = rings.length - 1; i >= 0; i--) {
      const r = rings[i];
      r.life -= dt;
      if (r.life <= 0) { rings.splice(i, 1); continue; }
      r.r += 74 * dt;
    }
  }

  // ------------------------------------------------------------------- scenes
  function setScene(slug) {
    if (state.artScene === slug) return;
    state.artScene = slug;
    ART.buildScene(slug);
  }

  // ------------------------------------------------------------------ screens
  function showScreen(id, phase) {
    for (const s of SCREENS) $(s).classList.toggle('hidden', s !== id);
    const overlay = $('overlay');
    overlay.classList.remove('hidden');
    document.body.dataset.phase = phase || 'menu';
    $('hud').classList.add('hidden');
    $('hud').setAttribute('aria-hidden', 'true');
    $('timeline').classList.add('hidden');
    $('echoPrompt').classList.add('hidden');
    $('touchListen').classList.add('hidden');
    hideCaption();
    hideJudge();
  }

  function beginPlayUI() {
    for (const s of SCREENS) $(s).classList.add('hidden');
    $('overlay').classList.remove('hidden');
    document.body.dataset.phase = 'playing';
    $('hud').classList.remove('hidden');
    $('hud').setAttribute('aria-hidden', 'false');
    $('timeline').classList.remove('hidden');
    hideCaption();
    hideJudge();
  }

  function updateEchoUI() {
    const on = state.phase === 'playing' && state.echoActive >= 0;
    $('echoPrompt').classList.toggle('hidden', !on);
    $('touchListen').classList.toggle('hidden', !on);
  }

  function updateHUD(t, chart) {
    $('hudNumeral').textContent = STORY.CHAPTERS[state.chapter].numeral;
    $('hudChapter').textContent = STORY.CHAPTERS[state.chapter].ru;
    $('hudTrack').textContent = STORY.CHAPTERS[state.chapter].en;
    $('memoryFill').style.width = Math.round(clamp(state.memory, 0, 1) * 100) + '%';
    $('comboVal').textContent = '×' + state.combo;
    const dur = chart.duration || audio.duration || 0;
    $('timelineFill').style.width = Math.round(clamp(t / (dur || 1), 0, 1) * 100) + '%';
    $('timeVal').textContent = fmt(t) + ' / ' + fmt(dur);
  }

  // -------------------------------------------------------------------- title
  function updateTitleUI() {
    const progress = hasProgress();
    $('continueBtn').classList.toggle('hidden', !progress);
    $('newBtn').classList.toggle('primary', !progress);
    const chaptersDone = STORY.CHAPTERS.filter(ch => {
      const rec = state.save.chapters[ch.slug];
      return rec && rec.cleared;
    }).length;
    $('saveLine').textContent = progress
      ? `ПУТЬ · ${chaptersDone} / 9 ГЛАВ · ${totalEchoes()} / 27 ЭХ`
      : 'СОХРАНЕНИЙ НЕТ · НАЧНИ С ПЕРВОЙ ПЕСНИ';
    $('versionLine').textContent = 'v1.1 · ' + state.settings.difficulty.toUpperCase();
  }

  function showTitle() {
    audio.stop();
    state.run = null;
    state.notes = [];
    state.phase = 'title';
    state.settingsReturn = 'title';
    setScene('menu');
    updateTitleUI();
    showScreen('titleScreen', 'title');
    resize();
  }

  function firstUnfinished() {
    for (let i = 0; i < STORY.CHAPTERS.length; i++) {
      const rec = chapterRecord(i);
      if (!rec || !rec.cleared) return i;
    }
    const pending = STORY.CHAPTERS.findIndex(ch => {
      const rec = state.save.chapters[ch.slug];
      return rec && rec.cleared && !rec.choice;
    });
    return pending >= 0 ? pending : 8;
  }

  function allCleared() {
    return STORY.CHAPTERS.every(ch => {
      const rec = state.save.chapters[ch.slug];
      return rec && rec.cleared;
    });
  }

  function continuePath() {
    audio.ensure().catch(() => {});
    if (allCleared()) {
      const pending = firstUnfinished();
      if (pending === 8 && chapterRecord(8) && chapterRecord(8).choice) {
        showEnding();
      } else {
        showChapter(Math.min(pending, state.save.unlocked - 1));
      }
    } else {
      showChapter(Math.min(firstUnfinished(), state.save.unlocked - 1));
    }
  }

  // ------------------------------------------------------------------ chapter
  function renderChapterDots() {
    const row = $('chapterDots');
    row.textContent = '';
    STORY.CHAPTERS.forEach((ch, i) => {
      const el = document.createElement('i');
      const rec = state.save.chapters[ch.slug];
      if (rec && rec.cleared) el.classList.add('done');
      if (i === state.chapter) el.classList.add('current');
      row.appendChild(el);
    });
  }

  function chapterErrorText(err) {
    const msg = err && err.message ? err.message : String(err || '');
    let text = 'Браузер не смог открыть Opus-трек. Запусти игру через play.sh (нужен HTTP и Range) и проверь путь к файлу.';
    if (/opus|открыть/i.test(msg)) {
      text += ' На iPhone/iPad Safari не читает Ogg Opus: нужен m4a-дубль, Chrome или Firefox.';
    }
    return text;
  }

  async function prepareChapter(index) {
    const chapter = STORY.CHAPTERS[index];
    const chart = CHARTS[chapter.slug];
    const token = ++state.prepareToken;
    state.audioReady = false;

    const start = $('chapterStartBtn');
    start.disabled = true;
    start.textContent = 'ЗАГРУЗКА…';
    $('chapterError').classList.add('hidden');
    $('chapterError').textContent = '';
    $('chapterLoad').classList.remove('hidden');
    $('chapterLoadFill').style.width = '0%';
    $('chapterLoadText').textContent = 'ЗАГРУЗКА ТРЕКА…';

    if (state.preparedSlug === chapter.slug && audio.ready) {
      state.audioReady = true;
      start.disabled = false;
      start.textContent = 'ВОЙТИ В ПЕСНЮ';
      $('chapterLoadFill').style.width = '100%';
      $('chapterLoadText').textContent = 'ТРЕК ГОТОВ · ' + fmt(chart.duration);
      return;
    }

    if (!chart) {
      $('chapterLoadText').textContent = 'НЕТ ДАННЫХ ТРЕКА';
      $('chapterError').textContent = 'Для этой главы не найден файл чарта. Перегенерируй charts.js через tools/analyze_tracks.py.';
      $('chapterError').classList.remove('hidden');
      return;
    }

    try {
      await audio.load(
        { slug: chapter.slug, file: chart.file, key: chart.key },
        (p, dur, err) => {
          if (token !== state.prepareToken) return;
          if (err) return;
          $('chapterLoadFill').style.width = Math.round(clamp(p, 0, 1) * 100) + '%';
          if (p >= 0.98) $('chapterLoadText').textContent = 'ТРЕК ГОТОВ';
          else $('chapterLoadText').textContent = 'ЗАГРУЗКА ТРЕКА… ' + Math.round(p * 100) + '%';
        }
      );
      if (token !== state.prepareToken) return;
      state.audioReady = true;
      state.preparedSlug = chapter.slug;
      start.disabled = false;
      start.textContent = 'ВОЙТИ В ПЕСНЮ';
      $('chapterLoadFill').style.width = '100%';
      $('chapterLoadText').textContent = 'ТРЕК ГОТОВ · ' + fmt(chart.duration);
    } catch (err) {
      if (token !== state.prepareToken) return;
      state.audioReady = false;
      state.preparedSlug = '';
      start.disabled = true;
      start.textContent = 'ТРЕК НЕДОСТУПЕН';
      $('chapterLoadText').textContent = 'ОШИБКА ЗАГРУЗКИ';
      $('chapterError').textContent = chapterErrorText(err);
      $('chapterError').classList.remove('hidden');
    }
  }

  function showChapter(index) {
    index = clamp(index | 0, 0, STORY.CHAPTERS.length - 1);
    if (index >= state.save.unlocked) {
      toast('ГЛАВА ЕЩЁ НЕ ОТКРЫТА');
      return;
    }
    audio.stop();
    audio.ensure().catch(() => {});

    const chapter = STORY.CHAPTERS[index];
    const chart = CHARTS[chapter.slug];
    state.chapter = index;
    state.run = null;
    state.notes = [];
    state.songTime = 0;
    state.echoActive = -1;
    state.phase = 'chapter';
    state.particles = [];
    state.rings = [];
    state.shake = 0;
    state.laneFlash = [0, 0, 0, 0];
    setScene(chapter.slug);

    $('chKicker').textContent = 'ГЛАВА ' + chapter.numeral + ' · ' + chapter.en;
    $('chNumeral').textContent = chapter.numeral;
    $('chTitle').textContent = chapter.ru;
    $('chScene').textContent = chapter.scene;
    $('chEpigraph').textContent = '«' + chapter.epigraph + '»';
    $('chIntro').textContent = chapter.intro;
    $('chTrack').textContent = chapter.en;
    $('chBpm').textContent = (chart ? chart.bpm : chapter.bpm) + ' BPM';
    $('chKey').textContent = chart ? chart.key : chapter.key;
    $('chDur').textContent = chart ? fmt(chart.duration) : '—';
    $('chArtNumeral').textContent = chapter.numeral;
    renderChapterDots();

    showScreen('chapterScreen', 'chapter');
    prepareChapter(index);
  }

  // -------------------------------------------------------------------- notes
  function buildNotes(chart, diff) {
    const src = chart.notes || [];
    const out = [];
    if (diff === 'easy') {
      const last = [-99, -99, -99, -99];
      for (let i = 0; i < src.length; i++) {
        const ms = src[i][0];
        const lane = src[i][1];
        const strength = src[i][2];
        const t = ms / 1000;
        // Keep strong notes and a third of the quiet ones; enforce breathing room.
        if (strength < 45 && i % 3 !== 0) continue;
        if (t - last[lane] < 0.24) continue;
        last[lane] = t;
        out.push({ t, l: lane, s: strength, judged: false, hit: false });
      }
      return out;
    }
    for (let i = 0; i < src.length; i++) {
      out.push({
        t: src[i][0] / 1000,
        l: src[i][1],
        s: src[i][2],
        judged: false,
        hit: false
      });
    }
    return out;
  }

  // Echo windows: keep the story's position, but slide each one into the
  // quietest nearby stretch of the real track.
  function computeEchoTimes(chapter, chart) {
    const targets = chapter.echoes.map(e => e[0] * chart.duration);
    const env = chart.env || [];
    const hz = chart.envHz || 5;
    const result = [];
    for (let k = 0; k < targets.length; k++) {
      const target = targets[k];
      let bestT = target;
      let bestScore = 1e9;
      const lo = Math.max(0, target - 7);
      const hi = Math.min(chart.duration - 2.5, target + 7);
      for (let t = lo; t <= hi; t += 0.35) {
        let sum = 0, n = 0;
        for (let tt = t; tt < t + 1.6; tt += 1 / hz) {
          const row = env[Math.floor(tt * hz)];
          if (!row) continue;
          sum += parseInt(row.substr(0, 2), 16) || 0;
          n++;
        }
        const loudness = n ? sum / n : 255;
        // Prefer quiet, but don't stray far from the written beat.
        const score = loudness + Math.abs(t - target) * 2.4;
        if (score < bestScore) { bestScore = score; bestT = t; }
      }
      result.push({
        idx: k,
        time: bestT,
        from: Math.max(0, bestT - 1.0),
        to: Math.min(chart.duration - 0.2, bestT + 2.7)
      });
    }
    return result;
  }

  // --------------------------------------------------------------------- play
  function freshRun() {
    return {
      perfect: 0,
      good: 0,
      ok: 0,
      miss: 0,
      echoes: new Set(),
      echoDone: new Set(),
      choice: null,
      finished: false,
      clarity: 0
    };
  }

  function startRun() {
    const chapter = STORY.CHAPTERS[state.chapter];
    const chart = CHARTS[chapter.slug];
    if (!state.audioReady || !chart) {
      showChapter(state.chapter);
      return;
    }
    state.run = freshRun();
    state.activeDiff = state.settings.difficulty;
    state.notes = buildNotes(chart, state.activeDiff);
    state.chart = chart;
    state.songTime = 0;
    state.missCursor = 0;
    state.beatCursor = 0;
    state.combo = 0;
    state.maxCombo = 0;
    state.memory = 0.5;
    state.levels = envLevels(chart, 0);
    state.echoTimes = computeEchoTimes(chapter, chart);
    state.echoActive = -1;
    state.particles = [];
    state.rings = [];
    state.laneFlash = [0, 0, 0, 0];
    state.shake = 0;
    state.captionUntil = 0;
    state.phase = 'playing';
    state.preparedSlug = chapter.slug;

    beginPlayUI();
    updateHUD(0, chart);
    showCaption('story', '', 'СЛУШАЙ. ДЕВЯТЬ ПЕСЕН ЕЩЁ ПОМНЯТ, КАК МИР НАЗЫВАЛСЯ.', 4.6);

    audio.play(0).catch(() => {
      if (state.phase !== 'playing') return;
      state.phase = 'pause';
      try { audio.pause(); } catch (e) {}
      showPauseScreen();
      toast('Браузер не запустил звук. Нажми «ПРОДОЛЖИТЬ».');
    });
  }

  function pauseGame() {
    if (state.phase !== 'playing' || !state.run) return;
    audio.pause();
    state.phase = 'pause';
    state.shake = 0;
    showPauseScreen();
  }

  function showPauseScreen() {
    $('pauseCalibration').textContent = 'задержка ' + Math.round(state.settings.offset) + ' мс · ' +
      DIFF[state.activeDiff].label;
    showScreen('pauseScreen', 'pause');
  }

  function resumeGame() {
    if (!state.run) { showTitle(); return; }
    state.phase = 'playing';
    for (const s of SCREENS) $(s).classList.add('hidden');
    document.body.dataset.phase = 'playing';
    $('hud').classList.remove('hidden');
    $('hud').setAttribute('aria-hidden', 'false');
    $('timeline').classList.remove('hidden');
    hideCaption();
    hideJudge();
    updateEchoUI();
    audio.resume().catch(() => {
      state.phase = 'pause';
      showPauseScreen();
      toast('Звук не запустился. Нажми «ПРОДОЛЖИТЬ» ещё раз.');
    });
  }

  function restartChapter() {
    if (!state.run) { showChapter(state.chapter); return; }
    audio.stop();
    state.run = null;
    state.phase = 'chapter';
    startRun();
  }

  function exitToChapters() {
    audio.stop();
    state.run = null;
    state.notes = [];
    state.echoActive = -1;
    state.phase = 'chapters';
    showChapters();
  }

  function judgeNote(note, delta) {
    const d = Math.abs(delta);
    const cfg = DIFF[state.activeDiff];
    let kind;
    if (d <= cfg.perfect) kind = 'perfect';
    else if (d <= cfg.good) kind = 'good';
    else if (d <= cfg.ok) kind = 'ok';
    else return;

    const run = state.run;
    note.judged = true;
    note.hit = true;
    run[kind]++;
    state.combo++;
    if (state.combo > state.maxCombo) state.maxCombo = state.combo;

    if (kind === 'perfect') {
      state.memory = clamp(state.memory + 0.006, 0, 1);
      state.shake = Math.max(state.shake, 0.8);
    } else if (kind === 'good') {
      state.memory = clamp(state.memory + 0.003, 0, 1);
      state.shake = Math.max(state.shake, 0.45);
    } else {
      state.memory = clamp(state.memory - 0.001, 0, 1);
    }

    const x = ART.LANE_X[note.l];
    burst(x, ART.HIT_Y, ART.P.lane[note.l], kind === 'perfect' ? 14 : kind === 'good' ? 9 : 5,
      kind === 'perfect' ? 1.35 : 1);
    state.laneFlash[note.l] = 1;
    showJudge(kind);
    if (state.settings.sfx) audio.tick(kind, note.l);
    updateHUD(state.songTime, state.chart);
  }

  function pressLane(lane) {
    if (state.phase !== 'playing' || !state.run) return;
    if (lane < 0 || lane > 3) return;
    state.laneFlash[lane] = 1;
    const cfg = DIFF[state.activeDiff];
    const t = audio.judgeTime;
    let best = null;
    let bestD = 1e9;
    for (let i = 0; i < state.notes.length; i++) {
      const n = state.notes[i];
      if (n.judged || n.l !== lane) continue;
      const d = t - n.t;
      const ad = Math.abs(d);
      if (ad <= cfg.ok + 0.018 && ad < bestD) {
        best = n;
        bestD = ad;
      }
    }
    if (!best) {
      if (state.settings.sfx) audio.pluck();
      return;
    }
    judgeNote(best, t - best.t);
  }

  function pressEcho() {
    if (state.phase !== 'playing' || !state.run) return;
    if (state.echoActive < 0) return;
    const win = state.echoTimes[state.echoActive];
    if (!win) return;
    const chapter = STORY.CHAPTERS[state.chapter];
    const echo = chapter.echoes[win.idx];
    if (!echo) return;

    state.run.echoes.add(win.idx);
    state.run.echoDone.add(win.idx);
    state.echoActive = -1;
    updateEchoUI();
    state.memory = clamp(state.memory + 0.055, 0, 1);
    state.shake = Math.max(state.shake, 1.25);
    burst(240, 116, ART.P.gold2, 26, 1.5);
    audio.chime();
    saveEcho(state.chapter, win.idx);
    showCaption('echo', echo[1], echo[2], 6.5);
    updateHUD(state.songTime, state.chart);
  }

  function updateEchoes(t) {
    if (state.echoActive >= 0) {
      const win = state.echoTimes[state.echoActive];
      if (!win || t > win.to) {
        if (win) state.run.echoDone.add(win.idx);
        state.echoActive = -1;
        updateEchoUI();
      }
      return;
    }
    for (let i = 0; i < state.echoTimes.length; i++) {
      const win = state.echoTimes[i];
      if (state.run.echoDone.has(win.idx)) continue;
      if (t >= win.from && t <= win.to) {
        state.echoActive = i;
        updateEchoUI();
        if (state.settings.sfx) audio.pluck();
        return;
      }
    }
  }

  // ------------------------------------------------------------------ results
  function finishChapter() {
    if (!state.run || state.run.finished) return;
    state.run.finished = true;
    try { audio.pause(); } catch (e) {}
    state.echoActive = -1;
    updateEchoUI();
    hideCaption();
    hideJudge();

    const chapter = STORY.CHAPTERS[state.chapter];
    const chart = state.chart || CHARTS[chapter.slug];
    const run = state.run;
    const total = Math.max(1, state.notes.length);
    const acc = (run.perfect + run.good * 0.72 + run.ok * 0.42) / total;
    const clarity = clamp(acc + run.echoes.size * 0.025, 0, 1);
    run.clarity = clarity;

    const rec = ensureChapterRecord(state.chapter);
    rec.best = Math.max(rec.best || 0, clarity);
    rec.tries = (rec.tries || 0) + 1;
    rec.cleared = true;
    state.save.unlocked = Math.max(state.save.unlocked, Math.min(9, state.chapter + 2));
    state.save.last = state.chapter;
    state.save.bestCombo = Math.max(state.save.bestCombo || 0, state.maxCombo);
    persistSave();

    const clear = clarity >= 0.5;
    $('resultKicker').textContent = 'ГЛАВА ' + chapter.numeral + ' ЗАВЕРШЕНА';
    $('resultTitle').textContent = clear ? 'ПАМЯТЬ ЯСНА' : 'ПАМЯТЬ ПОГАСЛА';
    $('resultMemory').textContent = clear ? chapter.clear : chapter.faded;
    $('resultRank').textContent = 'РАНГ · ' + rankFor(clarity);
    $('clarityRing').style.setProperty('--p', String(Math.round(clarity * 100)));
    $('clarityPct').textContent = Math.round(clarity * 100) + '%';
    $('resPerfect').textContent = run.perfect;
    $('resGood').textContent = run.good;
    $('resOk').textContent = run.ok;
    $('resMiss').textContent = run.miss;
    $('resCombo').textContent = state.maxCombo;
    $('resEcho').textContent = run.echoes.size + ' / 3';

    renderChoiceOptions(chapter.choice);
    state.phase = 'result';
    setScene(chapter.slug);
    showScreen('resultScreen', 'result');
    updateTitleUI();
  }

  function renderChoiceOptions(choice) {
    const box = $('choiceOptions');
    box.textContent = '';
    $('choicePrompt').textContent = choice.prompt;
    $('choiceBlock').classList.remove('hidden');
    $('choiceResult').classList.add('hidden');
    $('resultNextBtn').classList.add('hidden');
    choice.options.forEach((opt, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'btn';
      b.textContent = opt.label;
      b.addEventListener('click', () => chooseOption(i));
      box.appendChild(b);
    });
  }

  function chooseOption(index) {
    const chapter = STORY.CHAPTERS[state.chapter];
    const opt = chapter.choice.options[index];
    if (!opt) return;
    if (state.run) state.run.choice = {
      index, label: opt.label, trait: opt.trait, result: opt.result
    };
    const rec = ensureChapterRecord(state.chapter);
    rec.choice = { label: opt.label, trait: opt.trait, result: opt.result };
    state.save.last = state.chapter;
    persistSave();

    $('choiceResultText').textContent = opt.result;
    $('choiceResult').classList.remove('hidden');
    $('choiceBlock').classList.add('hidden');
    const next = $('resultNextBtn');
    next.classList.remove('hidden');
    next.textContent = state.chapter < STORY.CHAPTERS.length - 1 ? 'ДАЛЬШЕ' : 'К ФИНАЛУ';
  }

  function nextChapter() {
    if (state.chapter < STORY.CHAPTERS.length - 1) {
      showChapter(state.chapter + 1);
    } else {
      showEnding();
    }
  }

  // ------------------------------------------------------------------- ending
  function averageClarity() {
    let sum = 0;
    for (const ch of STORY.CHAPTERS) {
      const rec = state.save.chapters[ch.slug];
      sum += rec && Number.isFinite(rec.best) ? rec.best : 0;
    }
    return sum / STORY.CHAPTERS.length;
  }

  function showEnding() {
    audio.stop();
    state.run = null;
    state.phase = 'ending';
    setScene('neverborne');

    const counts = { mercy: 0, knowledge: 0, silence: 0 };
    let lastTrait = '';
    const choiceEls = [];
    for (const ch of STORY.CHAPTERS) {
      const rec = state.save.chapters[ch.slug];
      const choice = rec && rec.choice;
      if (choice && counts[choice.trait] !== undefined) {
        counts[choice.trait]++;
        lastTrait = choice.trait;
        choiceEls.push({ numeral: ch.numeral, label: choice.label, trait: choice.trait });
      }
    }
    let dominant = 'mercy';
    if (counts.knowledge > counts[dominant]) dominant = 'knowledge';
    if (counts.silence > counts[dominant]) dominant = 'silence';
    if (lastTrait && counts[lastTrait] === counts[dominant]) dominant = lastTrait;

    const avg = averageClarity();
    const faded = avg < 0.45;
    const ending = STORY.ENDINGS[faded ? 'faded' : dominant] || STORY.ENDINGS.mercy;

    $('endingKicker').textContent = ending.kicker;
    $('endingEn').textContent = ending.en;
    $('endingTitle').textContent = ending.ru;
    const text = $('endingText');
    text.textContent = '';
    ending.text.forEach(p => {
      const el = document.createElement('p');
      el.textContent = p;
      text.appendChild(el);
    });

    $('endClarity').textContent = Math.round(avg * 100) + '%';
    $('endEchoes').textContent = totalEchoes() + ' / 27';
    $('endCombo').textContent = state.save.bestCombo || 0;

    const choices = $('endingChoices');
    choices.textContent = '';
    choiceEls.forEach(c => {
      const el = document.createElement('span');
      el.className = c.trait;
      el.textContent = c.numeral + ' · ' + c.label;
      choices.appendChild(el);
    });

    showScreen('endingScreen', 'ending');
  }

  function newPath() {
    state.save = defaultSave();
    persistSave();
    state.run = null;
    state.notes = [];
    state.preparedSlug = '';
    updateTitleUI();
    showChapter(0);
  }

  // ----------------------------------------------------------------- chapters
  function showChapters() {
    const list = $('chapterList');
    list.textContent = '';
    STORY.CHAPTERS.forEach((ch, i) => {
      const locked = i >= state.save.unlocked;
      const rec = state.save.chapters[ch.slug];
      const chart = CHARTS[ch.slug];
      const el = document.createElement('button');
      el.type = 'button';
      el.className = 'chapter-item' + (locked ? ' locked' : '') + (i === state.save.last ? ' current' : '');
      const num = document.createElement('span');
      num.className = 'num';
      num.textContent = ch.numeral;
      const name = document.createElement('span');
      name.className = 'name';
      name.textContent = ch.ru;
      const meta = document.createElement('span');
      meta.className = 'meta';
      meta.textContent = ch.en + ' · ' + (chart ? chart.bpm : ch.bpm) + ' BPM';
      const status = document.createElement('span');
      status.className = 'status';
      status.textContent = locked ? 'ЗАКРЫТО' : rec && rec.cleared ? 'ПРОЙДЕНО · ' + Math.round((rec.best || 0) * 100) + '%' : 'ДОСТУПНО';
      el.appendChild(num);
      el.appendChild(name);
      el.appendChild(meta);
      el.appendChild(status);
      if (!locked) el.addEventListener('click', () => showChapter(i));
      list.appendChild(el);
    });
    state.phase = 'chapters';
    setScene('menu');
    showScreen('chaptersScreen', 'chapters');
  }

  // -------------------------------------------------------------------- codex
  function showCodex() {
    const list = $('codexList');
    list.textContent = '';
    STORY.CHAPTERS.forEach(ch => {
      const foundArr = Array.isArray(state.save.echoes[ch.slug]) ? state.save.echoes[ch.slug] : [];
      const group = document.createElement('div');
      group.className = 'codex-group';
      const h = document.createElement('h3');
      h.textContent = ch.numeral + ' · ' + ch.ru;
      group.appendChild(h);
      ch.echoes.forEach((echo, j) => {
        const found = foundArr.indexOf(j) !== -1;
        const entry = document.createElement('div');
        entry.className = 'codex-entry' + (found ? '' : ' locked');
        const b = document.createElement('b');
        b.textContent = found ? echo[1] : '???';
        const p = document.createElement('p');
        p.textContent = found ? echo[2] : 'ЭХО ЕЩЁ НЕ УСЛЫШАНО';
        entry.appendChild(b);
        entry.appendChild(p);
        group.appendChild(entry);
      });
      list.appendChild(group);
    });
    state.phase = 'codex';
    setScene('aleppo');
    showScreen('codexScreen', 'codex');
  }

  // ----------------------------------------------------------------- settings
  function applySettings() {
    const s = state.settings;
    audio.setVolume(s.volume);
    audio.setOffsetMs(s.offset);
    audio.sfxOn = s.sfx;
    audio.setMuted(s.muted);

    $('volumeRange').value = String(Math.round(s.volume * 100));
    $('volumeVal').textContent = Math.round(s.volume * 100) + '%';
    $('offsetRange').value = String(Math.round(s.offset));
    $('offsetVal').textContent = Math.round(s.offset) + ' мс';
    $('sfxToggle').checked = s.sfx;
    $('shakeToggle').checked = s.shake;
    $('captionToggle').checked = s.captions;

    document.querySelectorAll('#difficultyGroup button').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.diff === s.difficulty);
    });
    $('difficultyNote').textContent = DIFF[s.difficulty].note;
    $('muteBtn').textContent = s.muted ? '×' : '♪';
    $('muteBtn').setAttribute('aria-label', s.muted ? 'Включить звук' : 'Выключить звук');
    $('versionLine').textContent = 'v1.1 · ' + s.difficulty.toUpperCase();
  }

  function showSettings(returnTo) {
    state.settingsReturn = returnTo || 'title';
    state.phase = 'settings';
    applySettings();
    showScreen('settingsScreen', 'settings');
  }

  // ----------------------------------------------------------------- confirm
  function showConfirm(title, text, onYes, onNo) {
    $('confirmTitle').textContent = title;
    $('confirmText').textContent = text;
    state.confirmAction = onYes || null;
    state.confirmReturn = onNo || showTitle;
    state.phase = 'confirm';
    showScreen('confirmScreen', 'confirm');
  }

  // --------------------------------------------------------------------- boot
  function boot() {
    state.save = loadSave();
    state.settings = loadSettings();
    state.preparedSlug = '';
    applySettings();
    resize();
    setScene('menu');
    updateTitleUI();
    showScreen('bootScreen', 'boot');

    const steps = [
      [0.18, 'ПРОБУЖДЕНИЕ ПЕСЕН…'],
      [0.38, 'СБОР ДЕВЯТИ ГЛАВ…'],
      [0.58, 'НАСТРОЙКА СЛУХА…'],
      [0.76, 'ПОСЛЕДНИЙ ДРУИД…'],
      [0.92, 'МИР ЖДЁТ ИМЕНИ…']
    ];
    let i = 0;
    const iv = setInterval(() => {
      const st = steps[Math.min(i, steps.length - 1)];
      $('bootFill').style.width = Math.round(st[0] * 100) + '%';
      $('bootStatus').textContent = st[1];
      i++;
    }, 185);
    setTimeout(() => {
      clearInterval(iv);
      $('bootFill').style.width = '100%';
      showTitle();
    }, 1180);
  }

  // ---------------------------------------------------------------- game loop
  function update(dt) {
    state.realT += dt;
    if (state.shake > 0) state.shake = Math.max(0, state.shake - dt * 8);
    for (let i = 0; i < 4; i++) {
      state.laneFlash[i] = Math.max(0, state.laneFlash[i] - dt * 4.6);
    }
    updateParticles(dt);
    if (state.captionUntil && state.realT > state.captionUntil) hideCaption();

    if (state.phase !== 'playing' || !state.run || !state.chart) return;

    const chapter = STORY.CHAPTERS[state.chapter];
    const chart = state.chart;
    state.songTime = audio.ready ? audio.time : state.songTime + dt;
    const t = state.songTime;

    let levels = envLevels(chart, t);
    if (audio.ready && audio.connected) {
      const live = audio.getLevels();
      levels = {
        bass: Math.max(levels.bass, live.bass),
        mid: Math.max(levels.mid, live.mid),
        high: Math.max(levels.high, live.high),
        level: Math.max(levels.level, live.level)
      };
    }
    state.levels = levels;

    // Misses: a note becomes a miss only after its window has fully passed.
    const cfg = DIFF[state.activeDiff];
    while (state.missCursor < state.notes.length &&
           state.notes[state.missCursor].t < t - cfg.ok - 0.03) {
      const n = state.notes[state.missCursor++];
      if (n.judged) continue;
      n.judged = true;
      n.hit = false;
      state.run.miss++;
      state.combo = 0;
      state.memory = clamp(state.memory - 0.011, 0, 1);
      state.shake = Math.max(state.shake, 0.3);
      showJudge('miss');
      if (state.settings.sfx) audio.tick('miss', n.l);
    }

    // Story beats written as fractions of the song.
    const beats = chapter.beats || [];
    while (state.beatCursor < beats.length &&
           t >= beats[state.beatCursor][0] * chart.duration) {
      showCaption('story', '', beats[state.beatCursor][1], 5.4);
      state.beatCursor++;
    }

    updateEchoes(t);
    updateHUD(t, chart);

    if (audio.finished || (chart.duration > 0 && t >= chart.duration - 0.08)) {
      finishChapter();
    }
  }

  function render() {
    const phase = state.phase;
    const playing = phase === 'playing' || phase === 'pause';
    let t;
    let levels;

    if (playing) {
      t = state.songTime;
      levels = state.levels;
    } else {
      t = state.realT;
      const chart = CHARTS[STORY.CHAPTERS[state.chapter].slug];
      if ((phase === 'chapter' || phase === 'result') && chart) {
        const scan = phase === 'chapter'
          ? (state.realT * 0.22) % chart.duration
          : chart.duration * 0.62;
        levels = envLevels(chart, scan);
        t = phase === 'chapter' ? state.realT : scan;
      } else {
        levels = idleLevels(t);
      }
    }

    ART.draw(ctx, {
      t,
      levels,
      notes: playing ? state.notes : [],
      speed: noteSpeed(),
      showLanes: playing,
      showNotes: playing,
      showDruid: true,
      echo: phase === 'playing' && state.echoActive >= 0,
      laneFlash: state.laneFlash,
      particles: state.particles,
      rings: state.rings,
      shake: state.settings.shake ? state.shake : 0,
      cast: state.combo > 0 ? clamp(state.combo / 40, 0, 1) : 0
    });
  }

  function frame(now) {
    const dt = Math.min(0.06, Math.max(0, (now - (state.lastFrame || now)) / 1000));
    state.lastFrame = now;
    update(dt);
    render();
    requestAnimationFrame(frame);
  }

  function resize() {
    const wrap = $('stageWrap');
    if (!wrap) return;
    const cw = wrap.clientWidth;
    const ch = wrap.clientHeight;
    if (!cw || !ch) return;
    const availW = Math.max(180, cw - 20);
    const availH = Math.max(120, ch - 14);
    let scale = Math.min(availW / W, availH / H);
    let cssW = Math.max(180, Math.floor(W * scale));
    let cssH = Math.floor(cssW * H / W);
    if (cssH > availH) {
      cssH = Math.floor(availH);
      cssW = Math.floor(cssH * W / H);
    }
    canvas.style.width = cssW + 'px';
    canvas.style.height = cssH + 'px';
  }

  // -------------------------------------------------------------------- input
  document.addEventListener('keydown', e => {
    const tag = e.target && e.target.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

    if (e.code === 'KeyM') {
      e.preventDefault();
      toggleMute();
      return;
    }

    if (state.phase === 'playing') {
      const lane = CODE_LANE[e.code];
      if (lane !== undefined) {
        e.preventDefault();
        if (!e.repeat) pressLane(lane);
        return;
      }
      if (e.code === 'Space') {
        e.preventDefault();
        if (!e.repeat) pressEcho();
        return;
      }
      if (e.code === 'KeyP' || e.code === 'Escape') {
        e.preventDefault();
        pauseGame();
        return;
      }
    }

    if (state.phase === 'pause') {
      if (e.code === 'KeyP' || e.code === 'Escape' || e.code === 'Enter' || e.code === 'Space') {
        e.preventDefault();
        resumeGame();
      }
    }
  });

  document.addEventListener('pointerdown', () => {
    audio.ensure().catch(() => {});
  }, { passive: true });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && state.phase === 'playing') pauseGame();
  });

  window.addEventListener('resize', resize);
  window.addEventListener('orientationchange', () => setTimeout(resize, 120));
  if (window.visualViewport) window.visualViewport.addEventListener('resize', resize);

  canvas.addEventListener('pointerdown', e => {
    if (state.phase !== 'playing') return;
    const rect = canvas.getBoundingClientRect();
    if (!rect.width) return;
    const x = (e.clientX - rect.left) / rect.width * W;
    const y = (e.clientY - rect.top) / rect.height * H;
    if (y < 96) return;
    let lane = 0;
    let best = 1e9;
    for (let i = 0; i < 4; i++) {
      const d = Math.abs(x - ART.LANE_X[i]);
      if (d < best) { best = d; lane = i; }
    }
    e.preventDefault();
    pressLane(lane);
  });

  document.querySelectorAll('.touch-lane').forEach(btn => {
    const lane = Number(btn.dataset.lane);
    const down = e => {
      e.preventDefault();
      btn.classList.add('pressed');
      pressLane(lane);
    };
    const up = () => btn.classList.remove('pressed');
    btn.addEventListener('pointerdown', down);
    btn.addEventListener('pointerup', up);
    btn.addEventListener('pointerleave', up);
    btn.addEventListener('pointercancel', up);
  });

  // ----------------------------------------------------------------- buttons
  $('continueBtn').addEventListener('click', continuePath);
  $('newBtn').addEventListener('click', () => {
    audio.ensure().catch(() => {});
    if (hasProgress()) {
      showConfirm(
        'НАЧАТЬ ПУТЬ ЗАНОВО?',
        'Текущие выборы, эха и открытые главы исчезнут. Настройки останутся.',
        newPath,
        showTitle
      );
    } else {
      showChapter(0);
    }
  });
  $('chaptersBtn').addEventListener('click', showChapters);
  $('codexBtn').addEventListener('click', showCodex);
  $('settingsBtn').addEventListener('click', () => showSettings('title'));

  $('chapterStartBtn').addEventListener('click', () => {
    if (state.audioReady) startRun();
  });
  $('chapterBackBtn').addEventListener('click', () => {
    state.prepareToken++;
    audio.stop();
    showChapters();
  });

  $('pauseBtn').addEventListener('click', pauseGame);
  $('muteBtn').addEventListener('click', toggleMute);
  $('resumeBtn').addEventListener('click', resumeGame);
  $('restartBtn').addEventListener('click', restartChapter);
  $('pauseSettingsBtn').addEventListener('click', () => showSettings('pause'));
  $('pauseExitBtn').addEventListener('click', exitToChapters);

  $('echoBtn').addEventListener('click', pressEcho);
  $('touchListen').addEventListener('pointerdown', e => {
    e.preventDefault();
    pressEcho();
  });

  $('resultAgainBtn').addEventListener('click', restartChapter);
  $('resultNextBtn').addEventListener('click', nextChapter);

  $('endingAgainBtn').addEventListener('click', newPath);
  $('endingMenuBtn').addEventListener('click', showTitle);

  $('settingsBackBtn').addEventListener('click', () => {
    if (state.settingsReturn === 'pause' && state.run) showPauseScreen();
    else showTitle();
  });

  $('volumeRange').addEventListener('input', e => {
    state.settings.volume = clamp(Number(e.target.value) / 100, 0, 1);
    audio.setVolume(state.settings.volume);
    $('volumeVal').textContent = Math.round(state.settings.volume * 100) + '%';
    persistSettings();
  });
  $('offsetRange').addEventListener('input', e => {
    state.settings.offset = clamp(Number(e.target.value), -200, 200);
    audio.setOffsetMs(state.settings.offset);
    $('offsetVal').textContent = Math.round(state.settings.offset) + ' мс';
    persistSettings();
  });
  document.querySelectorAll('#difficultyGroup button').forEach(btn => {
    btn.addEventListener('click', () => {
      state.settings.difficulty = btn.dataset.diff;
      applySettings();
      updateTitleUI();
      persistSettings();
      toast('СЛОЖНОСТЬ · ' + DIFF[state.settings.difficulty].label + ' (со следующей главы)');
    });
  });
  $('sfxToggle').addEventListener('change', e => {
    state.settings.sfx = e.target.checked;
    audio.sfxOn = state.settings.sfx;
    persistSettings();
  });
  $('shakeToggle').addEventListener('change', e => {
    state.settings.shake = e.target.checked;
    persistSettings();
  });
  $('captionToggle').addEventListener('change', e => {
    state.settings.captions = e.target.checked;
    if (!state.settings.captions) hideCaption();
    persistSettings();
  });
  $('resetBtn').addEventListener('click', () => {
    const ret = state.settingsReturn;
    showConfirm(
      'СБРОСИТЬ ПРОГРЕСС?',
      'Выборы, эха и открытые главы будут удалены. Настройки останутся.',
      () => {
        state.save = defaultSave();
        persistSave();
        state.run = null;
        state.notes = [];
        state.preparedSlug = '';
        updateTitleUI();
        toast('ПРОГРЕСС СБРОШЕН');
        showTitle();
      },
      () => showSettings(ret)
    );
  });

  $('codexBackBtn').addEventListener('click', showTitle);
  $('chaptersBackBtn').addEventListener('click', showTitle);

  $('confirmYes').addEventListener('click', () => {
    const fn = state.confirmAction;
    state.confirmAction = null;
    if (fn) fn();
  });
  $('confirmNo').addEventListener('click', () => {
    state.confirmAction = null;
    if (state.confirmReturn) state.confirmReturn();
  });

  function toggleMute() {
    state.settings.muted = !state.settings.muted;
    audio.setMuted(state.settings.muted);
    $('muteBtn').textContent = state.settings.muted ? '×' : '♪';
    $('muteBtn').setAttribute('aria-label', state.settings.muted ? 'Включить звук' : 'Выключить звук');
    persistSettings();
    toast(state.settings.muted ? 'ЗВУК ВЫКЛЮЧЕН' : 'ЗВУК ВКЛЮЧЁН', 1400);
  }

  // -------------------------------------------------------------------- start
  audio._onEnded = () => {
    if (state.phase === 'playing') finishChapter();
  };

  boot();
  requestAnimationFrame(frame);
})();
