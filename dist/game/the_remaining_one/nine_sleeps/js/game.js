/* КЕРН · ДЕВЯТЬ СНОВ — game flow, save state and UI wiring. */
(function () {
  'use strict';

  const TRO = window.TRO;
  const Sound = window.Sound;
  const Art = window.Art;
  if (!TRO || !Sound || !Art) {
    document.body.innerHTML = '<p style="color:#e8dcc8;font-family:monospace;padding:24px">Не загрузились данные игры. Проверь js/data.js, js/audio.js и js/art.js.</p>';
    return;
  }

  const { TRACKS, RUNES, RUNE_ORDER, STRANDS, PROLOGUE, CHAPTERS, LORE, ENDINGS, ABOUT } = TRO;
  const SAVE_KEY = 'kern.dreams.save.v1';
  const SETTINGS_KEY = 'kern.dreams.settings.v1';
  const META_KEY = 'kern.dreams.meta.v1';

  const $ = (id) => document.getElementById(id);
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;

  const SCREEN_IDS = {
    title: 'titleScreen', prologue: 'prologueScreen', chapter: 'chapterScreen',
    path: 'pathScreen', play: null, dialog: 'dialogScreen', puzzle: 'puzzleScreen',
    pause: 'pauseScreen', codex: 'codexScreen', album: 'albumScreen',
    settings: 'settingsScreen', ending: 'endingScreen'
  };
  const STATE_CLASSES = Object.keys(SCREEN_IDS).map((n) => 'state-' + n);

  const defaultSettings = { volume: 0.78, muted: false, sfx: true, textSize: 'm', reduceMotion: false };
  const defaultMeta = { endings: [], echoes: 0, bestMemory: 0, runs: 0 };

  let settings = Object.assign({}, defaultSettings);
  let meta = Object.assign({}, defaultMeta);
  let run = null;
  let storedRun = false;
  let prologueIndex = 0;
  let toastTimer = 0;
  let lastFrame = 0;
  let frameCount = 0;
  let isTouch = false;

  const ui = {
    screen: 'title',
    listen: false,
    nearAnchor: null,
    nearEcho: false,
    prompt: '',
    echoHold: 0,
    pendingAnchor: null,
    pendingEcho: false,
    move: { left: false, right: false },
    dialogReturn: 'play',
    dialogCanClose: true,
    codexReturn: 'title',
    codexTab: 'dreams',
    albumReturn: 'title',
    settingsReturn: 'title',
    chapterReturn: 'title',
    puzzle: null,
    puzzleHint: false,
    puzzleMsg: '',
    puzzleMsgClass: '',
    choosing: false
  };

  const play = { x: 42, facing: 1, moving: false, phase: 0, stepTimer: 0, targetX: null };

  const touchQuery = window.matchMedia ? window.matchMedia('(hover: none) and (pointer: coarse)') : null;

  // ───────────────────────────────────────────────────────────── small helpers
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function storyHTML(text) {
    return String(text || '').split(/\n\n+/).map((p) =>
      '<p>' + esc(p).replace(/\n/g, '<br>') + '</p>'
    ).join('');
  }

  function loadJSON(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return fallback;
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : fallback;
    } catch (e) {
      return fallback;
    }
  }

  function saveJSON(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) {}
  }

  function freshRun() {
    return {
      version: 1,
      started: false,
      startedAt: Date.now(),
      chapter: 0,
      completed: new Array(CHAPTERS.length).fill(false),
      memory: 0,
      echoes: [],
      runes: [],
      strands: { mercy: 0, memory: 0, silence: 0 },
      data: {},
      ending: null,
      playTime: 0
    };
  }

  function normalizeRun(input) {
    const r = Object.assign(freshRun(), input || {});
    r.completed = new Array(CHAPTERS.length).fill(false).map((_, i) => !!(r.completed && r.completed[i]));
    r.echoes = Array.isArray(r.echoes) ? r.echoes : [];
    r.runes = Array.isArray(r.runes) ? r.runes : [];
    r.strands = Object.assign({ mercy: 0, memory: 0, silence: 0 }, r.strands || {});
    r.data = r.data && typeof r.data === 'object' ? r.data : {};
    r.chapter = clamp(Number(r.chapter) || 0, 0, CHAPTERS.length - 1);
    return r;
  }

  function dataFor(ch) {
    if (!run.data[ch.slug]) run.data[ch.slug] = { anchors: {}, echo: false, solved: false, choice: null };
    const d = run.data[ch.slug];
    if (!d.anchors || typeof d.anchors !== 'object') d.anchors = {};
    d.echo = !!d.echo;
    d.solved = !!d.solved;
    d.choice = d.choice || null;
    return d;
  }

  function currentChapter() {
    return CHAPTERS[clamp(run.chapter, 0, CHAPTERS.length - 1)];
  }

  function allAnchors(ch, d) {
    return ch.anchors.every((a) => !!d.anchors[a.id]);
  }

  function nextIncomplete() {
    for (let i = 0; i < CHAPTERS.length; i++) if (!run.completed[i]) return i;
    return -1;
  }

  function recomputeRun() {
    run.memory = 0;
    run.strands = { mercy: 0, memory: 0, silence: 0 };
    run.echoes = [];
    run.runes = [];
    run.completed = new Array(CHAPTERS.length).fill(false);
    CHAPTERS.forEach((ch, i) => {
      const d = run.data[ch.slug] || {};
      let mem = 0;
      if (d.echo) {
        run.echoes.push(ch.slug);
        mem += 1;
      }
      if (d.choice && d.choice.strand) {
        const s = d.choice.strand;
        run.strands[s] = (run.strands[s] || 0) + 1;
        if (s === 'memory') mem += 1;
        if (s === 'silence') mem -= 1;
      }
      run.memory += mem;
      if (d.anchors) {
        for (const a of ch.anchors) {
          if (d.anchors[a.id] && run.runes.indexOf(a.rune) < 0) run.runes.push(a.rune);
        }
      }
      if (d.solved && d.choice) run.completed[i] = true;
    });
    run.memory = clamp(run.memory, 0, 9);
    run.chapter = clamp(run.chapter, 0, CHAPTERS.length - 1);
  }

  function saveRun() {
    if (!run) return;
    storedRun = true;
    saveJSON(SAVE_KEY, run);
  }

  function saveMeta() {
    saveJSON(META_KEY, meta);
  }

  function saveSettings() {
    saveJSON(SETTINGS_KEY, settings);
  }

  function toast(msg, ms) {
    const el = $('toast');
    if (!el) return;
    el.textContent = msg;
    el.classList.remove('hidden');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.add('hidden'), ms || 2400);
  }

  function chapterNumeral(n) {
    const c = CHAPTERS[n];
    return c ? c.numeral : '';
  }

  function dominantEnding() {
    const s = run.strands;
    if (s.silence > s.memory && s.silence > s.mercy) return 'silence';
    if (s.memory > s.silence && s.memory >= s.mercy) return 'keeper';
    return 'dawn';
  }

  // ───────────────────────────────────────────────────────────── screens
  function hideAllScreens() {
    Object.keys(SCREEN_IDS).forEach((name) => {
      const id = SCREEN_IDS[name];
      if (id) $(id).classList.add('hidden');
    });
  }

  function setBodyState(name) {
    STATE_CLASSES.forEach((c) => document.body.classList.remove(c));
    document.body.classList.add('state-' + name);
  }

  function isTouchMode() {
    return (touchQuery && touchQuery.matches) || window.innerWidth < 900;
  }

  function updateDuck() {
    let d = 1;
    if (ui.screen === 'dialog' || ui.screen === 'puzzle') d = 0.48;
    else if (ui.screen === 'codex' || ui.screen === 'settings') d = 0.52;
    else if (ui.screen === 'chapter' || ui.screen === 'path') d = 0.78;
    if (ui.listen) d = Math.min(d, 0.62);
    Sound.setDuck(d);
  }

  function showScreen(name) {
    hideAllScreens();
    const id = SCREEN_IDS[name];
    if (id) $(id).classList.remove('hidden');
    ui.screen = name;
    setBodyState(name);

    const world = name === 'play' || name === 'dialog';
    $('hud').classList.toggle('hidden', !world);
    $('trackLine').classList.toggle('hidden', !world || !Sound.currentTrack());
    $('prompt').classList.toggle('hidden', name !== 'play' || !ui.prompt);
    $('touchBar').classList.toggle('hidden', name !== 'play' || !isTouchMode());

    if (name !== 'play' && name !== 'dialog') {
      ui.listen = false;
      document.body.classList.remove('listening');
      $('listenBtn').setAttribute('aria-pressed', 'false');
    }
    updateDuck();
    updateTrackLine();
    updateBreathVisibility();
  }

  function updateTrackLine() {
    const line = $('trackLine');
    if (!line) return;
    const t = Sound.currentTrack();
    if (!t || (ui.screen !== 'play' && ui.screen !== 'dialog')) {
      line.classList.add('hidden');
      return;
    }
    line.classList.remove('hidden');
    $('trackTitle').textContent = t.title;
    $('trackMeta').textContent = t.bpm + ' BPM · ' + t.key;
    $('trackState').textContent = Sound.isPlaying() ? 'ЗВУЧИТ' : 'ПАУЗА';
  }

  // ───────────────────────────────────────────────────────────── settings
  function applySettings() {
    document.body.classList.remove('text-s', 'text-m', 'text-l');
    document.body.classList.add('text-' + (settings.textSize || 'm'));
    document.body.classList.toggle('reduce-motion', !!settings.reduceMotion);

    Sound.setVolume(settings.volume);
    Sound.setMuted(settings.muted);
    Sound.setSfxEnabled(settings.sfx);

    const range = $('volumeRange');
    if (range) range.value = Math.round(settings.volume * 100);
    const val = $('volumeVal');
    if (val) val.textContent = Math.round(settings.volume * 100);

    const mute = $('muteToggle');
    if (mute) {
      mute.textContent = settings.muted ? 'ВЫКЛ' : 'ВКЛ';
      mute.setAttribute('aria-pressed', String(!settings.muted));
    }
    const sfx = $('sfxToggle');
    if (sfx) {
      sfx.textContent = settings.sfx ? 'ВКЛ' : 'ВЫКЛ';
      sfx.setAttribute('aria-pressed', String(!!settings.sfx));
    }
    const motion = $('motionToggle');
    if (motion) {
      motion.textContent = settings.reduceMotion ? 'ВКЛ' : 'ВЫКЛ';
      motion.setAttribute('aria-pressed', String(!!settings.reduceMotion));
    }
    document.querySelectorAll('#textSizeSeg button').forEach((b) => {
      b.classList.toggle('active', b.dataset.size === settings.textSize);
    });
    updateMuteButton();
  }

  function updateMuteButton() {
    const b = $('muteBtn');
    if (!b) return;
    b.textContent = settings.muted ? '✕' : '♪';
    b.setAttribute('aria-label', settings.muted ? 'Включить звук' : 'Выключить звук');
    b.title = settings.muted ? 'Включить звук (M)' : 'Выключить звук (M)';
  }

  function toggleMute() {
    settings.muted = !settings.muted;
    Sound.setMuted(settings.muted);
    saveSettings();
    updateMuteButton();
    $('muteToggle').textContent = settings.muted ? 'ВЫКЛ' : 'ВКЛ';
    $('muteToggle').setAttribute('aria-pressed', String(!settings.muted));
    toast(settings.muted ? 'ЗВУК ВЫКЛЮЧЕН' : 'ЗВУК ВКЛЮЧЁН', 1400);
  }

  function openSettings(returnTo) {
    ui.settingsReturn = returnTo || ui.screen;
    applySettings();
    showScreen('settings');
  }

  function closeSettings() {
    const r = ui.settingsReturn;
    if (r === 'pause') showScreen('pause');
    else if (r === 'ending') showScreen('ending');
    else if (r === 'path') showPath();
    else showTitle();
  }

  // ───────────────────────────────────────────────────────────── title
  function updateTitleProgress() {
    const cont = $('continueBtn');
    const prog = $('titleProgress');
    if (!cont || !prog) return;
    cont.classList.toggle('hidden', !storedRun);
    if (!storedRun) {
      prog.classList.add('hidden');
      return;
    }
    const done = run.completed.filter(Boolean).length;
    if (run.ending) {
      const e = ENDINGS.find((x) => x.id === run.ending);
      prog.textContent = 'СОН ЗАВЕРШЁН · ' + (e ? e.title : 'КОНЕЦ') + ' · ЭХА ' + run.echoes.length + '/9';
      cont.textContent = 'СМОТРЕТЬ КОНЦОВКУ';
    } else {
      prog.textContent = 'СОН ' + Math.min(done + 1, 9) + ' ИЗ 9 · ПАМЯТЬ ' + run.memory + '/9 · ЭХА ' + run.echoes.length + '/9';
      cont.textContent = 'ПРОДОЛЖИТЬ';
    }
    prog.classList.remove('hidden');
  }

  function showTitle() {
    updateTitleProgress();
    showScreen('title');
    if (Sound.unlocked && Sound.mode !== 'album' && Sound.mode !== 'chapter') Sound.startAmbience();
  }

  function resumeSaved() {
    if (!storedRun) return;
    recomputeRun();
    if (run.ending) {
      finishEnding(run.ending, true);
      return;
    }
    const next = nextIncomplete();
    if (next < 0) {
      showPath();
      return;
    }
    run.chapter = next;
    saveRun();
    showChapterCard(run.chapter, 'title');
  }

  function startNewGame(force) {
    if (!force && storedRun && run && run.started && !run.ending) {
      if (!window.confirm('Начать новый сон? Текущий прогресс будет потерян.')) return;
    }
    run = freshRun();
    run.started = true;
    run.startedAt = Date.now();
    storedRun = true;
    meta.runs = (meta.runs || 0) + 1;
    saveMeta();
    recomputeRun();
    saveRun();
    prologueIndex = 0;
    renderPrologue();
    showScreen('prologue');
    if (Sound.unlocked) Sound.startAmbience();
  }

  // ───────────────────────────────────────────────────────────── prologue
  function renderPrologue() {
    const page = PROLOGUE[clamp(prologueIndex, 0, PROLOGUE.length - 1)];
    if (!page) return;
    $('prologueKicker').textContent = page.kicker;
    $('prologueText').innerHTML = storyHTML(page.text);
    $('prologueDots').innerHTML = PROLOGUE.map((_, i) =>
      '<i class="' + (i === prologueIndex ? 'on' : '') + '"></i>'
    ).join('');
    $('prologueNext').textContent = prologueIndex >= PROLOGUE.length - 1 ? 'ВОЙТИ В СОН' : 'ДАЛЬШЕ';
    $('prologueSkip').textContent = prologueIndex >= PROLOGUE.length - 1 ? 'ПРОПУСТИТЬ' : 'ПРОПУСТИТЬ';
  }

  function nextPrologue() {
    if (prologueIndex < PROLOGUE.length - 1) {
      prologueIndex++;
      renderPrologue();
      Sound.sfx('page');
    } else {
      showChapterCard(0, 'title');
    }
  }

  function skipPrologue() {
    showChapterCard(run.chapter || 0, 'title');
  }

  // ───────────────────────────────────────────────────────────── chapter card
  function showChapterCard(index, from) {
    index = clamp(index, 0, CHAPTERS.length - 1);
    run.chapter = index;
    saveRun();
    const ch = CHAPTERS[index];
    const d = dataFor(ch);
    const track = TRACKS[ch.track - 1];

    $('chapterKicker').textContent = 'УЗЕЛ ' + ch.numeral + ' · ' + ch.sub.toUpperCase();
    $('chapterNumeral').textContent = ch.numeral;
    $('chapterTitle').textContent = ch.title;
    $('chapterEpigraph').textContent = ch.epigraph;
    $('chapterIntro').innerHTML = storyHTML(ch.intro);
    $('chapterTrack').innerHTML = track
      ? '<div><b>' + esc(track.title) + '</b> · ' + esc(track.ru) + '</div>' +
        '<div>' + track.bpm + ' BPM · ' + esc(track.key) + ' · ' + esc(track.duration) + ' · ' + esc(track.genre) + '</div>'
      : '';

    const done = d.solved && d.choice;
    $('chapterEnterBtn').textContent = done ? 'УЗЕЛ ПРОЙДЕН' : 'СЛУШАТЬ СОН';
    $('chapterEnterBtn').disabled = !!done;
    ui.chapterReturn = from || 'title';
    showScreen('chapter');
  }

  function chapterBack() {
    if (ui.chapterReturn === 'path') showPath();
    else if (ui.chapterReturn === 'pause') showScreen('pause');
    else showTitle();
  }

  // ───────────────────────────────────────────────────────────── path
  function pathLineText() {
    if (run.echoes.length >= 9) return 'Ты слышал все девять эх. Сон держится на твоей памяти — или на том, что ты решишь отпустить.';
    if (run.memory >= 7) return 'Ты помнишь больше, чем бог. Осталось несколько узлов — и одно имя, которое ты произнесёшь сам.';
    if (run.memory >= 4) return 'Сон держится неровно. Где-то звучит вода, где-то — тишина. Иди дальше, пока узлы не остыли.';
    return 'Ты помнишь слишком мало. Каждый узел просит имя, а Серая Тишина уже стоит у края.';
  }

  function spiralPosition(i, total) {
    const t = total <= 1 ? 0 : i / (total - 1);
    const angle = -Math.PI * 0.72 + t * Math.PI * 3.05;
    const rx = 41 * (1 - t * 0.64);
    const ry = 38 * (1 - t * 0.64);
    return {
      x: 50 + Math.cos(angle) * rx,
      y: 52 + Math.sin(angle) * ry
    };
  }

  function showPath() {
    recomputeRun();
    const next = nextIncomplete();
    if (next >= 0) run.chapter = next;
    saveRun();
    renderPath();
    showScreen('path');
  }

  function renderPath() {
    const next = nextIncomplete();
    $('pathLine').textContent = pathLineText();
    $('pathSpiral').innerHTML = CHAPTERS.map((ch, i) => {
      const p = spiralPosition(i, CHAPTERS.length);
      const isDone = run.completed[i];
      const isCurrent = i === next;
      const cls = isDone ? 'done' : isCurrent ? 'current' : 'locked';
      return '<button class="path-stone ' + cls + '" type="button" data-chapter="' + i + '" ' +
        'style="left:' + p.x.toFixed(2) + '%;top:' + p.y.toFixed(2) + '%" ' +
        'aria-label="' + esc(ch.numeral + ' ' + ch.title) + '" title="' + esc(ch.title) + '">' +
        '<span class="menhir"></span><span class="s-label">' + esc(ch.numeral) + '</span></button>';
    }).join('');
    $('pathSpiral').querySelectorAll('.path-stone').forEach((btn) => {
      btn.addEventListener('click', () => {
        const i = Number(btn.dataset.chapter);
        const ch = CHAPTERS[i];
        if (run.completed[i]) showMemoryDialog(ch);
        else if (i === next) showChapterCard(i, 'path');
        else toast('Этот узел ещё не открыт.', 1600);
      });
    });

    const done = run.completed.filter(Boolean).length;
    $('pathStats').innerHTML =
      '<span>ПРОЙДЕНО <b>' + done + '/9</b></span>' +
      '<span>ПАМЯТЬ <b>' + run.memory + '/9</b></span>' +
      '<span>ЭХА <b>' + run.echoes.length + '/9</b></span>' +
      '<span>МИЛОСТЬ <b>' + run.strands.mercy + '</b></span>' +
      '<span>ПАМЯТЬ-ПРЯДЬ <b>' + run.strands.memory + '</b></span>' +
      '<span>ТИШИНА <b>' + run.strands.silence + '</b></span>';

    const cont = $('pathContinueBtn');
    if (next < 0) {
      cont.textContent = run.ending ? 'СМОТРЕТЬ КОНЦОВКУ' : 'ВЕРНУТЬСЯ К ТИТУЛУ';
    } else {
      cont.textContent = 'ИДТИ ДАЛЬШЕ · ' + CHAPTERS[next].numeral;
    }
    cont.disabled = false;
  }

  function continuePath() {
    const next = nextIncomplete();
    if (next >= 0) {
      showChapterCard(next, 'path');
    } else if (run.ending) {
      finishEnding(run.ending, true);
    } else {
      showTitle();
    }
  }

  function showMemoryDialog(ch) {
    const d = dataFor(ch);
    const chosen = d.choice ? STRANDS[d.choice.strand] : null;
    let text = ch.intro;
    if (chosen) text += '\n\nПрядь: ' + chosen.name + '. ' + chosen.line;
    if (d.echo) text += '\n\nЭхо сна услышано.';
    showDialog({
      kicker: 'УЗЕЛ ' + ch.numeral + ' · ' + ch.sub.toUpperCase(),
      title: ch.title,
      text: text,
      returnTo: 'path',
      canClose: true,
      actions: [{ label: 'НАЗАД К ПУТИ', primary: true, onClick: closeDialog }]
    });
  }

  // ───────────────────────────────────────────────────────────── dialogue
  function showDialog(o) {
    ui.dialogReturn = o.returnTo || (ui.screen === 'play' ? 'play' : 'title');
    ui.dialogCanClose = o.canClose !== false;

    $('dialogKicker').textContent = o.kicker || '';
    $('dialogTitle').textContent = o.title || '';
    $('dialogText').innerHTML = storyHTML(o.text || '');

    const portrait = $('dialogPortrait');
    portrait.style.filter = o.portraitFilter || 'saturate(0.9) contrast(1.05)';

    const slot = $('dialogRuneSlot');
    if (o.rune && RUNES[o.rune]) {
      slot.innerHTML = Art.runeSVG(o.rune);
      slot.classList.remove('hidden');
    } else {
      slot.innerHTML = '';
      slot.classList.add('hidden');
    }

    const actions = $('dialogActions');
    actions.innerHTML = '';
    (o.actions || []).forEach((a) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'btn ' + (a.primary ? 'primary ' : '') + (a.choice ? 'choice' : '');
      b.innerHTML = '<span>' + esc(a.label) + '</span>' +
        (a.sub ? '<span class="choice-sub">' + esc(a.sub) + '</span>' : '');
      b.addEventListener('click', () => {
        if (typeof a.onClick === 'function') a.onClick();
      });
      actions.appendChild(b);
    });

    showScreen('dialog');
  }

  function hideDialogOnly() {
    $('dialogScreen').classList.add('hidden');
  }

  function closeDialog() {
    const ret = ui.dialogReturn;
    hideDialogOnly();
    if (ret === 'path') showPath();
    else if (ret === 'pause') showScreen('pause');
    else if (ret === 'ending') showScreen('ending');
    else if (currentChapter()) {
      showScreen('play');
      updateProximity();
      updatePrompt();
    } else {
      showTitle();
    }
  }

  // ───────────────────────────────────────────────────────────── puzzle
  function buildTiles(ch) {
    const order = ch.puzzle.order.slice();
    const pool = RUNE_ORDER.filter((id) => order.indexOf(id) < 0);
    const decoys = [];
    for (let k = 0; k < 3; k++) {
      const idx = (ch.n * 2 + k * 3) % pool.length;
      const id = pool[idx];
      if (decoys.indexOf(id) < 0 && order.indexOf(id) < 0) decoys.push(id);
    }
    let all = order.concat(decoys);
    // deterministic shuffle
    let seed = ch.n * 97 + 13;
    const rnd = () => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return seed / 0x7fffffff;
    };
    for (let i = all.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      const t = all[i]; all[i] = all[j]; all[j] = t;
    }
    return all;
  }

  function openPuzzle() {
    const ch = currentChapter();
    if (!ch) return;
    const d = dataFor(ch);
    if (!allAnchors(ch, d)) {
      toast('Сначала найди все три эха этого сна.', 2000);
      return;
    }
    if (!ui.puzzle || ui.puzzle.chapter !== ch.slug) {
      ui.puzzle = { chapter: ch.slug, slots: [null, null, null], tiles: buildTiles(ch), solved: d.solved };
      ui.puzzleHint = false;
      ui.puzzleMsg = d.solved ? ch.puzzle.success : '';
      ui.puzzleMsgClass = d.solved ? 'success' : '';
    }
    renderPuzzle();
    showScreen('puzzle');
    Sound.sfx('rune');
  }

  function renderPuzzle() {
    const ch = currentChapter();
    const d = dataFor(ch);
    const p = ui.puzzle;
    if (!ch || !p) return;

    $('puzzleIntro').textContent = ch.puzzle.intro;
    const plate = $('puzzleName');
    plate.textContent = d.solved ? ch.puzzle.name : '???';
    plate.classList.toggle('solved', !!d.solved);

    const slotMark = ['I', 'II', 'III'];
    $('puzzleSlots').innerHTML = p.slots.map((id, i) => {
      const r = id ? RUNES[id] : null;
      return '<button class="slot ' + (id ? 'filled' : '') + '" type="button" data-slot="' + i + '" ' +
        'aria-label="Слот ' + (i + 1) + (r ? ': ' + r.name : '') + '">' +
        '<span class="slot-index">' + slotMark[i] + '</span>' +
        (r
          ? '<span class="slot-rune">' + Art.runeSVG(id) + '</span><span class="slot-name">' + esc(r.name) + '</span>'
          : '<span class="slot-empty">·</span>') +
        '</button>';
    }).join('');

    $('puzzleTiles').innerHTML = p.tiles.map((id) => {
      const r = RUNES[id];
      const used = p.slots.indexOf(id) >= 0;
      return '<button class="rune-tile ' + (used ? 'used' : '') + '" type="button" data-rune="' + id + '" ' +
        'aria-label="' + esc(r.name + ', ' + r.tree) + '">' +
        '<span class="rune-glyph">' + Art.runeSVG(id) + '</span>' +
        '<span class="rune-copy"><span class="rune-name">' + esc(r.name) + '</span>' +
        '<span class="rune-tree">' + esc(r.tree) + ' · ' + esc(r.meaning) + '</span></span>' +
        '</button>';
    }).join('');

    $('puzzleSlots').querySelectorAll('.slot').forEach((btn) => {
      btn.addEventListener('click', () => {
        const i = Number(btn.dataset.slot);
        if (d.solved) return;
        if (p.slots[i]) {
          p.slots[i] = null;
          Sound.sfx('click');
          renderPuzzle();
        }
      });
    });

    $('puzzleTiles').querySelectorAll('.rune-tile').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (d.solved) return;
        const id = btn.dataset.rune;
        if (p.slots.indexOf(id) >= 0) return;
        const empty = p.slots.indexOf(null);
        if (empty < 0) {
          toast('Сначала освободи слот.', 1400);
          return;
        }
        p.slots[empty] = id;
        ui.puzzleMsg = '';
        ui.puzzleMsgClass = '';
        Sound.sfx('rune');
        renderPuzzle();
      });
    });

    const msg = $('puzzleMessage');
    msg.textContent = ui.puzzleMsg || '';
    msg.className = 'puzzle-message ' + (ui.puzzleMsgClass || '');

    const hint = $('puzzleHintText');
    hint.textContent = ch.puzzle.hint;
    hint.classList.toggle('hidden', !ui.puzzleHint);
    $('puzzleHintBtn').textContent = ui.puzzleHint ? 'СКРЫТЬ ПОДСКАЗКУ' : 'ПОДСКАЗКА';

    $('puzzleConfirmBtn').textContent = d.solved ? 'ПРИНЯТЬ РЕШЕНИЕ' : 'СЛОЖИТЬ ИМЯ';
    $('puzzleCloseBtn').textContent = d.solved ? 'К ВЫБОРУ' : 'ВЕРНУТЬСЯ';
    p.solved = d.solved;
  }

  function confirmPuzzle() {
    const ch = currentChapter();
    const d = dataFor(ch);
    if (d.solved) {
      openChoice(ch);
      return;
    }
    const slots = ui.puzzle.slots;
    if (slots.some((s) => !s)) {
      ui.puzzleMsg = 'Назови все три эха — ни больше, ни меньше.';
      ui.puzzleMsgClass = 'error';
      renderPuzzle();
      Sound.sfx('error');
      return;
    }
    if (slots.join('|') === ch.puzzle.order.join('|')) {
      d.solved = true;
      d.echo = d.echo || false;
      ui.puzzle.solved = true;
      ui.puzzleMsg = ch.puzzle.success;
      ui.puzzleMsgClass = 'success';
      recomputeRun();
      saveRun();
      updateHud();
      renderPuzzle();
      Sound.sfx('success');
    } else {
      ui.puzzleMsg = ch.puzzle.wrong;
      ui.puzzleMsgClass = 'error';
      renderPuzzle();
      Sound.sfx('error');
      const msg = $('puzzleMessage');
      msg.classList.remove('error');
      void msg.offsetWidth;
      msg.classList.add('error');
    }
  }

  function closePuzzle() {
    const ch = currentChapter();
    const d = ch ? dataFor(ch) : null;
    if (d && d.solved) {
      openChoice(ch);
      return;
    }
    showScreen('play');
    updateProximity();
    updatePrompt();
  }

  // ───────────────────────────────────────────────────────────── chapter play
  function enterChapter() {
    const ch = currentChapter();
    if (!ch) return;
    const d = dataFor(ch);
    if (d.solved && d.choice) {
      showPath();
      return;
    }
    Art.setScene(ch.scene);
    play.x = ch.startX || 42;
    play.facing = 1;
    play.moving = false;
    play.phase = 0;
    play.stepTimer = 0;
    play.targetX = null;
    ui.listen = false;
    ui.echoHold = 0;
    ui.pendingAnchor = null;
    ui.pendingEcho = false;
    ui.nearAnchor = null;
    ui.nearEcho = false;
    ui.prompt = '';
    document.body.classList.remove('listening');
    $('listenBtn').setAttribute('aria-pressed', 'false');

    showScreen('play');
    Sound.playChapter(ch.track - 1);
    updateHud();
    updateProximity();
    updatePrompt();

    if (d.solved && !d.choice) {
      setTimeout(() => {
        if (ui.screen === 'play') openChoice(ch);
      }, 700);
    } else if (allAnchors(ch, d) && !d.solved) {
      setTimeout(() => {
        if (ui.screen === 'play') openPuzzle();
      }, 850);
    }
  }

  function updatePlay(dt) {
    const ch = currentChapter();
    if (!ch) return;
    const d = dataFor(ch);

    let dir = 0;
    if (ui.move.left) dir -= 1;
    else if (ui.move.right) dir += 1;

    if (dir === 0 && play.targetX != null) {
      const diff = play.targetX - play.x;
      if (Math.abs(diff) <= 2.5) {
        play.targetX = null;
      } else {
        dir = diff > 0 ? 1 : -1;
      }
    }

    if (dir !== 0) {
      const speed = (ui.move.left || ui.move.right) ? 58 : 48;
      play.x = clamp(play.x + dir * speed * dt, 24, 456);
      play.facing = dir > 0 ? 1 : -1;
      play.moving = true;
      play.phase += dt * 8;
      play.stepTimer -= dt;
      if (play.stepTimer <= 0) {
        Sound.sfx('step');
        play.stepTimer = 0.36;
      }
      run.playTime = (run.playTime || 0) + dt;
    } else {
      play.moving = false;
      play.stepTimer = 0;
    }

    if (play.targetX != null && Math.abs(play.x - play.targetX) <= 2.5) play.targetX = null;

    updateProximity();

    if (ui.pendingAnchor) {
      const a = ch.anchors.find((x) => x.id === ui.pendingAnchor);
      if (a && Math.abs(play.x - a.x) < 27) {
        ui.pendingAnchor = null;
        play.targetX = null;
        openAnchor(a);
        return;
      }
    }
    if (ui.pendingEcho && ch.echo && !d.echo && Math.abs(play.x - ch.echo.x) < 27) {
      ui.pendingEcho = false;
      play.targetX = null;
      if (!ui.listen) toggleListen(true);
    }

    if (ui.listen && ui.nearEcho && !d.echo) {
      ui.echoHold += dt;
      if (ui.echoHold > 0.6) discoverEcho();
    } else {
      ui.echoHold = 0;
    }
  }

  function updateProximity() {
    const ch = currentChapter();
    if (!ch) return;
    const d = dataFor(ch);
    let best = null;
    let bestDist = 32;
    ch.anchors.forEach((a) => {
      const dist = Math.abs(play.x - a.x);
      if (dist < bestDist) { best = a; bestDist = dist; }
    });
    ui.nearAnchor = best ? best.id : null;
    ui.nearEcho = !!(ch.echo && !d.echo && Math.abs(play.x - ch.echo.x) < 30);

    const key = isTouchMode() ? 'ДЕЙСТВИЕ' : 'E';
    let text = '';
    if (ui.nearEcho) text = key + ' · СЛУШАТЬ ЭХО';
    else if (best && !d.anchors[best.id]) text = key + ' · ' + best.label + ' · ЗАПОМНИТЬ';
    else if (best) text = best.label + ' · РУНА ЗАПОМНЕНА';
    else if (allAnchors(ch, d) && !d.solved) text = key + ' · КАМЕНЬ ИМЁН';
    else if (d.solved && !d.choice) text = key + ' · ПРИНЯТЬ РЕШЕНИЕ';
    ui.prompt = text;
    updatePrompt();
  }

  function updatePrompt() {
    const el = $('prompt');
    if (!el) return;
    if (ui.screen !== 'play' || !ui.prompt) {
      el.classList.add('hidden');
      return;
    }
    el.textContent = ui.prompt;
    el.classList.remove('hidden');
  }

  function interact() {
    if (ui.screen !== 'play') return;
    const ch = currentChapter();
    if (!ch) return;
    const d = dataFor(ch);
    if (ui.nearAnchor) {
      const a = ch.anchors.find((x) => x.id === ui.nearAnchor);
      if (a) { openAnchor(a); return; }
    }
    if (ui.nearEcho) {
      if (!ui.listen) toggleListen(true);
      else discoverEcho();
      return;
    }
    if (allAnchors(ch, d) && !d.solved) {
      openPuzzle();
      return;
    }
    if (d.solved && !d.choice) {
      openChoice(ch);
      return;
    }
    toast('Здесь тихо. Иди дальше или слушай.', 1600);
  }

  function toggleListen(force) {
    if (ui.screen !== 'play') return;
    const next = force == null ? !ui.listen : !!force;
    ui.listen = next;
    ui.echoHold = 0;
    document.body.classList.toggle('listening', next);
    $('listenBtn').setAttribute('aria-pressed', String(next));
    if (next) Sound.sfx('listen');
    updateDuck();
    updatePrompt();
  }

  function handleListen() {
    if (ui.screen !== 'play') return;
    if (ui.listen && ui.nearEcho) {
      discoverEcho();
      return;
    }
    toggleListen(!ui.listen);
  }

  function discoverEcho() {
    const ch = currentChapter();
    if (!ch || !ch.echo || ui.screen !== 'play') return;
    const d = dataFor(ch);
    if (d.echo || !ui.nearEcho) return;
    d.echo = true;
    recomputeRun();
    saveRun();
    updateHud();
    if (ui.listen) toggleListen(false);
    Sound.sfx('echo');
    showDialog({
      kicker: 'СЛУШАТЬ · ЭХО СНА',
      title: ch.echo.title,
      text: ch.echo.text + '\n\n+1 ПАМЯТЬ',
      returnTo: 'play',
      canClose: true,
      actions: [{
        label: 'СОХРАНИТЬ В ПАМЯТИ',
        primary: true,
        onClick: () => {
          closeDialog();
        }
      }]
    });
  }

  function openAnchor(a) {
    if (ui.screen !== 'play') return;
    const ch = currentChapter();
    const d = dataFor(ch);
    const first = !d.anchors[a.id];
    if (first) {
      d.anchors[a.id] = true;
      if (run.runes.indexOf(a.rune) < 0) run.runes.push(a.rune);
      recomputeRun();
      saveRun();
      updateHud();
    }
    Sound.sfx(first ? 'rune' : 'click');
    const ready = allAnchors(ch, d) && !d.solved;
    showDialog({
      kicker: 'ЭХО · ' + a.label,
      title: a.title,
      text: a.text + '\n\n' + a.clue,
      rune: a.rune,
      returnTo: 'play',
      canClose: true,
      actions: [{
        label: first ? 'ЗАПОМНИТЬ РУНУ' : 'ЗАКРЫТЬ',
        primary: true,
        onClick: () => {
          closeDialog();
          if (ready) {
            setTimeout(() => {
              if (ui.screen === 'play') openPuzzle();
            }, 280);
          }
        }
      }]
    });
  }

  function updateHud() {
    const ch = currentChapter();
    if (!ch) return;
    $('hudNumeral').textContent = ch.numeral;
    $('hudTitle').textContent = ch.title;
    $('hudSub').textContent = ch.sub;

    const pips = $('memoryPips');
    if (pips && pips.children.length === 0) {
      pips.innerHTML = new Array(9).fill('<i></i>').join('');
    }
    if (pips) {
      const on = run.memory;
      const lost = clamp(run.echoes.length - run.memory, 0, Math.max(0, 9 - on));
      Array.from(pips.children).forEach((el, i) => {
        el.classList.toggle('on', i < on);
        el.classList.toggle('lost', i >= on && i < on + lost);
      });
      pips.setAttribute('aria-label', 'Память ' + run.memory + ' из 9');
    }
    updateTitleProgress();
  }

  function updateBreathVisibility() {
    const line = $('breathLine');
    if (!line) return;
    if (line.children.length === 0) {
      line.innerHTML = new Array(12).fill('<i></i>').join('');
    }
  }

  // ───────────────────────────────────────────────────────────── choices / endings
  function openChoice(ch) {
    const eligible = (ch.choice.options || []).filter((o) => {
      if (!o.secret) return true;
      return run.echoes.length >= 9 && run.memory >= 7;
    });
    ui.choosing = true;
    showDialog({
      kicker: 'ПРЯДЬ · ' + ch.numeral,
      title: 'ЧТО ТЫ ОСТАВИШЬ?',
      text: ch.choice.prompt,
      returnTo: 'play',
      canClose: false,
      actions: eligible.map((o) => ({
        label: o.label,
        sub: o.text,
        choice: true,
        onClick: () => chooseOption(ch, o)
      }))
    });
  }

  function chooseOption(ch, o) {
    ui.choosing = false;
    const d = dataFor(ch);
    d.solved = true;
    d.choice = {
      strand: o.strand,
      label: o.label,
      ending: o.ending || null,
      secret: !!o.secret
    };
    recomputeRun();
    saveRun();
    updateHud();
    Sound.sfx('choice');

    const strand = STRANDS[o.strand] || STRANDS.memory;
    const outro = (ch.outros && ch.outros[o.strand]) || '';
    showDialog({
      kicker: 'ПРЯДЬ · ' + strand.name,
      title: o.label,
      text: o.text + (outro ? '\n\n' + outro : ''),
      returnTo: 'play',
      canClose: false,
      actions: [{
        label: ch.final ? 'ПРОБУДИТЬСЯ' : 'ИДТИ ДАЛЬШЕ',
        primary: true,
        onClick: () => {
          hideDialogOnly();
          if (ch.final) finishEnding(o.ending || dominantEnding());
          else showPath();
        }
      }]
    });
  }

  function finishEnding(id, fromSaved) {
    let e = ENDINGS.find((x) => x.id === id);
    if (!e) e = ENDINGS.find((x) => x.id === dominantEnding()) || ENDINGS[0];
    run.ending = e.id;
    run.chapter = CHAPTERS.length - 1;
    recomputeRun();
    saveRun();

    if ((meta.endings || []).indexOf(e.id) < 0) {
      meta.endings = meta.endings || [];
      meta.endings.push(e.id);
    }
    meta.echoes = Math.max(meta.echoes || 0, run.echoes.length);
    meta.bestMemory = Math.max(meta.bestMemory || 0, run.memory);
    saveMeta();

    $('endingKicker').textContent = e.kicker;
    $('endingTitle').textContent = e.title;
    $('endingLines').innerHTML = e.lines.map((p) => '<p>' + esc(p) + '</p>').join('');
    const done = run.completed.filter(Boolean).length;
    $('endingStats').innerHTML =
      '<span>ПРОЙДЕНО <b>' + done + '/9</b></span>' +
      '<span>ПАМЯТЬ <b>' + run.memory + '/9</b></span>' +
      '<span>ЭХА <b>' + run.echoes.length + '/9</b></span>' +
      '<span>МИЛОСТЬ <b>' + run.strands.mercy + '</b></span>' +
      '<span>ПАМЯТЬ-ПРЯДЬ <b>' + run.strands.memory + '</b></span>' +
      '<span>ТИШИНА <b>' + run.strands.silence + '</b></span>';

    const art = document.querySelector('.ending-art');
    if (art) {
      const filters = {
        dawn: 'saturate(1.16) brightness(1.14)',
        keeper: 'saturate(.82) brightness(.84)',
        silence: 'grayscale(.82) brightness(.62)',
        remaining: 'saturate(1.2) brightness(1.02) hue-rotate(-8deg)'
      };
      art.style.filter = filters[e.id] || 'saturate(.9)';
    }

    updateTitleProgress();
    showScreen('ending');
    Sound.setDuck(1);
    if (!fromSaved) Sound.sfx('ending');
  }

  function goMenu() {
    saveRun();
    Sound.setDuck(1);
    Sound.stop(0.6);
    showTitle();
    setTimeout(() => {
      if (ui.screen === 'title' && Sound.mode !== 'album') Sound.startAmbience();
    }, 750);
  }

  // ───────────────────────────────────────────────────────────── codex
  function openCodex(returnTo) {
    ui.codexReturn = returnTo || ui.screen;
    renderCodex();
    showScreen('codex');
  }

  function closeCodex() {
    const r = ui.codexReturn;
    if (r === 'pause') showScreen('pause');
    else if (r === 'ending') showScreen('ending');
    else if (r === 'path') showPath();
    else showTitle();
  }

  function renderCodex() {
    document.querySelectorAll('.codex-tab').forEach((b) => {
      b.classList.toggle('active', b.dataset.tab === ui.codexTab);
    });
    const body = $('codexBody');
    if (!body) return;
    if (ui.codexTab === 'dreams') body.innerHTML = codexDreams();
    else if (ui.codexTab === 'runes') body.innerHTML = codexRunes();
    else if (ui.codexTab === 'lore') body.innerHTML = codexLore();
    else if (ui.codexTab === 'endings') body.innerHTML = codexEndings();
    else body.innerHTML = codexAbout();
  }

  function codexDreams() {
    const next = nextIncomplete();
    return CHAPTERS.map((ch, i) => {
      const d = run.data[ch.slug] || {};
      const done = !!run.completed[i];
      const open = done || i === next || i === run.chapter;
      const state = done ? 'ПРОЙДЕН' : open ? 'ОТКРЫТ' : 'ЗАКРЫТ';
      const strand = d.choice ? STRANDS[d.choice.strand] : null;
      const extra = [];
      if (strand) extra.push('Прядь: ' + strand.name);
      if (d.echo) extra.push('Эхо услышано');
      if (d.solved) extra.push('Имя сложено');
      return '<article class="codex-dream">' +
        '<div class="codex-dream-head"><h3>' + esc(ch.numeral + ' · ' + ch.title) + '</h3>' +
        '<span class="dream-state ' + (done ? 'done' : '') + '">' + state + '</span></div>' +
        '<div class="dream-meta">' + esc(ch.sub) + (extra.length ? ' · ' + esc(extra.join(' · ')) : '') + '</div>' +
        (open
          ? storyHTML(ch.intro)
          : '<p>Этот узел ещё скрыт Серой Тишиной. Назови предыдущие имена, чтобы дойти до него.</p>') +
        '</article>';
    }).join('');
  }

  function codexRunes() {
    return '<div class="codex-grid">' + RUNE_ORDER.map((id) => {
      const r = RUNES[id];
      const found = run.runes.indexOf(id) >= 0;
      return '<article class="codex-rune">' +
        '<span class="rune-glyph">' + Art.runeSVG(id, found ? {} : { color: '#2a2620' }) + '</span>' +
        '<div><h4>' + (found ? esc(r.name) : '???') + '</h4>' +
        '<div class="rune-sub">' + (found ? esc(r.tree + ' · ' + r.meaning) : 'РУНА ЕЩЁ НЕ УСЛЫШАНА') + '</div>' +
        '<p>' + (found ? esc(r.line) : 'Найди эхо, которое помнит эту руну.') + '</p></div>' +
        '</article>';
    }).join('') + '</div>';
  }

  function codexLore() {
    return LORE.map((l) =>
      '<article class="codex-lore"><h3>' + esc(l.title) + '</h3>' +
      '<div class="lore-sub">' + esc(l.sub) + '</div><p>' + esc(l.text) + '</p></article>'
    ).join('');
  }

  function codexEndings() {
    return ENDINGS.map((e) => {
      const unlocked = (meta.endings || []).indexOf(e.id) >= 0 || run.ending === e.id;
      const secret = e.id === 'remaining';
      return '<article class="codex-ending ' + (unlocked ? '' : 'locked') + '">' +
        '<h3>' + (unlocked || !secret ? esc(e.title) : '???') + '</h3>' +
        '<div class="ending-kicker">' + esc(e.kicker) + '</div>' +
        '<p>' + (unlocked
          ? esc(e.lines.slice(0, 2).join(' '))
          : (secret ? 'Тайная концовка. Собери все девять эх и сохрани память.' : 'Ещё не прожито.')) + '</p>' +
        '</article>';
    }).join('');
  }

  function codexAbout() {
    const tracks = TRACKS.map((t) =>
      '<div class="codex-dream"><div class="codex-dream-head"><h3>' + t.n + ' · ' + esc(t.title) + '</h3>' +
      '<span class="dream-meta">' + esc(t.duration) + '</span></div>' +
      '<div class="dream-meta">' + esc(t.ru) + ' · ' + t.bpm + ' BPM · ' + esc(t.key) + ' · ' + esc(t.genre) + '</div></div>'
    ).join('');
    return '<article class="codex-lore"><h3>О ИГРЕ</h3><p>' + esc(ABOUT) + '</p></article>' +
      '<article class="codex-lore"><h3>УПРАВЛЕНИЕ</h3><p>' +
      'Клавиатура: ← → / A D — идти; E / Space — действие; L — слушать; P / Esc — пауза; M — звук.\n' +
      'Мышь / палец: нажми на землю, чтобы идти; нажми на эхо, чтобы подойти. Кнопки внизу — для телефона.' +
      '</p></article>' +
      '<article class="codex-lore"><h3>ДЕВЯТЬ ДЫХАНИЙ</h3>' + tracks + '</article>';
  }

  // ───────────────────────────────────────────────────────────── album
  function openAlbum(returnTo) {
    ui.albumReturn = returnTo || ui.screen;
    renderAlbum();
    updateAlbumNow();
    showScreen('album');
  }

  function closeAlbum() {
    if (Sound.mode === 'album') Sound.stop(0.45);
    if (ui.albumReturn === 'pause') {
      showScreen('pause');
    } else {
      showTitle();
      setTimeout(() => {
        if (ui.screen === 'title') Sound.startAmbience();
      }, 650);
    }
  }

  function renderAlbum() {
    const list = $('albumList');
    if (!list) return;
    list.innerHTML = TRACKS.map((t, i) => {
      const active = Sound.mode === 'album' && Sound.index === i;
      return '<div class="album-row ' + (active ? 'active' : '') + '" data-track="' + i + '" ' +
        'role="button" tabindex="0" aria-label="Слушать ' + esc(t.title) + '">' +
        '<span class="a-num">' + String(t.n).padStart(2, '0') + '</span>' +
        '<div><div class="a-title">' + esc(t.title) + '</div>' +
        '<div class="a-meta">' + esc(t.ru) + ' · ' + t.bpm + ' BPM · ' + esc(t.key) + ' · ' + esc(t.genre) + '</div></div>' +
        '<div style="display:flex;align-items:center;gap:8px">' +
        '<span class="a-dur">' + esc(t.duration) + '</span>' +
        '<span class="a-play">' + (active && Sound.isPlaying() ? 'II' : '▶') + '</span></div></div>';
    }).join('');

    list.querySelectorAll('.album-row').forEach((row) => {
      const start = () => {
        const i = Number(row.dataset.track);
        Sound.playAlbum(i);
        renderAlbum();
        updateAlbumNow();
      };
      row.addEventListener('click', start);
      row.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); start(); }
      });
    });
  }

  function updateAlbumNow() {
    const now = $('albumNow');
    const btn = $('albumPlayPause');
    if (!now || !btn) return;
    const t = Sound.currentTrack();
    if (Sound.mode === 'album' && t) {
      now.textContent = t.n + '. ' + t.title.toUpperCase() + ' · ' + t.ru;
      btn.textContent = Sound.isPlaying() ? 'ПАУЗА' : 'ИГРАТЬ';
    } else {
      now.textContent = 'НИЧЕГО НЕ ИГРАЕТ';
      btn.textContent = 'ИГРАТЬ';
    }
    if (ui.screen === 'album') {
      document.querySelectorAll('.album-row').forEach((row) => {
        const i = Number(row.dataset.track);
        const active = Sound.mode === 'album' && Sound.index === i;
        row.classList.toggle('active', active);
        const play = row.querySelector('.a-play');
        if (play) play.textContent = active && Sound.isPlaying() ? 'II' : '▶';
      });
    }
  }

  // ───────────────────────────────────────────────────────────── audio banner
  function showAudioBanner(message) {
    const banner = $('audioBanner');
    if (!banner) return;
    const text = $('audioBannerText');
    if (text && message) text.textContent = message;
    banner.classList.remove('hidden');
  }

  function hideAudioBanner() {
    const banner = $('audioBanner');
    if (banner) banner.classList.add('hidden');
  }

  function unlockAudio() {
    if (!Sound.unlocked) {
      const ok = Sound.unlock();
      if (ok && ui.screen === 'title' && !Sound.isPlaying() && Sound.mode !== 'album') {
        Sound.startAmbience();
      }
    } else if (Sound.ctx && Sound.ctx.state === 'suspended') {
      Sound.unlock();
    }
  }

  // ───────────────────────────────────────────────────────────── pause / resume
  function openPause() {
    if (ui.screen !== 'play') return;
    Sound.pause();
    showScreen('pause');
  }

  function resumeGame() {
    if (ui.screen !== 'pause') return;
    showScreen('play');
    updateProximity();
    updatePrompt();
    const ch = currentChapter();
    if (!ch) return;
    if (Sound.mode === 'chapter' && Sound.currentTrack()) Sound.resume();
    else Sound.playChapter(ch.track - 1);
  }

  function restartChapter() {
    const ch = currentChapter();
    if (!ch) return;
    const index = run.chapter;
    delete run.data[ch.slug];
    recomputeRun();
    saveRun();
    Sound.stop(0.35);
    showChapterCard(index, 'pause');
    toast('Сон начинается заново.', 1800);
  }

  // ───────────────────────────────────────────────────────────── album controls
  function toggleAlbumPlayback() {
    if (Sound.mode === 'album') {
      if (Sound.isPlaying()) Sound.pause();
      else Sound.resume();
    } else {
      Sound.playAlbum(Sound.index >= 0 ? Sound.index : 0);
    }
    setTimeout(() => {
      renderAlbum();
      updateAlbumNow();
    }, 280);
  }

  function stopAlbum() {
    Sound.stop(0.25);
    updateAlbumNow();
    renderAlbum();
  }

  // ───────────────────────────────────────────────────────────── input
  function scenePoint(e) {
    const cv = $('world');
    if (!cv) return { x: 240, y: 135 };
    const r = cv.getBoundingClientRect();
    if (!r.width || !r.height) return { x: 240, y: 135 };
    return {
      x: clamp((e.clientX - r.left) / r.width * Art.W, 0, Art.W),
      y: clamp((e.clientY - r.top) / r.height * Art.H, 0, Art.H)
    };
  }

  function onCanvasPointer(e) {
    if (ui.screen !== 'play') return;
    const ch = currentChapter();
    if (!ch) return;
    e.preventDefault();

    const p = scenePoint(e);
    const d = dataFor(ch);

    if (ch.echo && !d.echo) {
      const dist = Math.hypot(p.x - ch.echo.x, p.y - ch.echo.y);
      if (dist < 30) {
        ui.pendingEcho = true;
        ui.pendingAnchor = null;
        play.targetX = ch.echo.x;
        Sound.sfx('click');
        return;
      }
    }

    let hit = null;
    ch.anchors.forEach((a) => {
      if (Math.abs(p.x - a.x) < 20 && p.y > 118) hit = a;
    });
    if (hit) {
      ui.pendingAnchor = hit.id;
      ui.pendingEcho = false;
      play.targetX = hit.x;
      Sound.sfx('click');
      return;
    }

    ui.pendingAnchor = null;
    ui.pendingEcho = false;
    play.targetX = p.x;
  }

  function bindHold(el, dir) {
    if (!el) return;
    const start = (e) => {
      e.preventDefault();
      ui.move[dir] = true;
      if (el.setPointerCapture) {
        try { el.setPointerCapture(e.pointerId); } catch (err) {}
      }
    };
    const stop = () => { ui.move[dir] = false; };
    el.addEventListener('pointerdown', start);
    ['pointerup', 'pointercancel', 'pointerleave', 'lostpointercapture'].forEach((ev) => {
      el.addEventListener(ev, stop);
    });
    el.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  function handleBack() {
    switch (ui.screen) {
      case 'play': openPause(); break;
      case 'pause': resumeGame(); break;
      case 'dialog': if (ui.dialogCanClose) closeDialog(); break;
      case 'puzzle': closePuzzle(); break;
      case 'codex': closeCodex(); break;
      case 'album': closeAlbum(); break;
      case 'settings': closeSettings(); break;
      case 'chapter': chapterBack(); break;
      case 'path': showTitle(); break;
      default: break;
    }
  }

  function onKeyDown(e) {
    unlockAudio();
    const tag = (e.target && e.target.tagName) || '';
    const onControl = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || tag === 'BUTTON';
    const key = e.key;

    if (key === 'Escape') {
      handleBack();
      e.preventDefault();
      return;
    }

    if (ui.screen === 'play') {
      if (key === 'ArrowLeft' || key === 'a' || key === 'A' || key === 'ф' || key === 'Ф') {
        ui.move.left = true;
        e.preventDefault();
        return;
      }
      if (key === 'ArrowRight' || key === 'd' || key === 'D' || key === 'в' || key === 'В') {
        ui.move.right = true;
        e.preventDefault();
        return;
      }
      if (!onControl && (key === 'e' || key === 'E' || key === 'у' || key === 'У' || key === ' ' || key === 'Enter')) {
        e.preventDefault();
        play.targetX = null;
        interact();
        return;
      }
      if (!onControl && (key === 'l' || key === 'L' || key === 'д' || key === 'Д')) {
        e.preventDefault();
        handleListen();
        return;
      }
    } else if (ui.screen === 'puzzle') {
      if (!onControl && (key === 'Enter' || key === ' ')) {
        e.preventDefault();
        confirmPuzzle();
        return;
      }
    } else if (ui.screen === 'dialog') {
      if (!onControl && (key === 'Enter' || key === ' ') && !ui.choosing) {
        const primary = document.querySelector('#dialogActions .btn.primary');
        if (primary) {
          e.preventDefault();
          primary.click();
          return;
        }
      }
    }

    if (key === 'p' || key === 'P' || key === 'з' || key === 'З') {
      if (ui.screen === 'play') openPause();
      else if (ui.screen === 'pause') resumeGame();
      e.preventDefault();
      return;
    }
    if (key === 'm' || key === 'M' || key === 'ь' || key === 'Ь') {
      toggleMute();
      e.preventDefault();
    }
  }

  function onKeyUp(e) {
    const key = e.key;
    if (key === 'ArrowLeft' || key === 'a' || key === 'A' || key === 'ф' || key === 'Ф') ui.move.left = false;
    if (key === 'ArrowRight' || key === 'd' || key === 'D' || key === 'в' || key === 'В') ui.move.right = false;
  }

  function refreshLayout() {
    isTouch = isTouchMode();
    document.body.classList.toggle('is-touch', isTouch);
    const bar = $('touchBar');
    if (bar) bar.classList.toggle('hidden', ui.screen !== 'play' || !isTouch);
    const hint = $('rotateHint');
    if (hint) hint.classList.add('hidden');
  }

  // ───────────────────────────────────────────────────────────── wiring
  function on(id, event, fn) {
    const el = $(id);
    if (el) el.addEventListener(event, fn);
  }

  function bindUI() {
    on('newGameBtn', 'click', () => startNewGame(false));
    on('continueBtn', 'click', () => resumeSaved());
    on('titleAlbumBtn', 'click', () => openAlbum('title'));
    on('titleCodexBtn', 'click', () => openCodex('title'));
    on('titleSettingsBtn', 'click', () => openSettings('title'));

    on('prologueNext', 'click', nextPrologue);
    on('prologueSkip', 'click', skipPrologue);

    on('chapterEnterBtn', 'click', enterChapter);
    on('chapterBackBtn', 'click', chapterBack);

    on('pathContinueBtn', 'click', continuePath);
    on('pathCodexBtn', 'click', () => openCodex('path'));

    on('puzzleHintBtn', 'click', () => {
      ui.puzzleHint = !ui.puzzleHint;
      renderPuzzle();
      Sound.sfx('click');
    });
    on('puzzleConfirmBtn', 'click', confirmPuzzle);
    on('puzzleCloseBtn', 'click', closePuzzle);

    on('resumeBtn', 'click', resumeGame);
    on('pauseCodexBtn', 'click', () => openCodex('pause'));
    on('pauseAlbumBtn', 'click', () => openAlbum('pause'));
    on('pauseSettingsBtn', 'click', () => openSettings('pause'));
    on('pauseRestartBtn', 'click', restartChapter);
    on('pauseMenuBtn', 'click', goMenu);

    on('codexCloseBtn', 'click', closeCodex);
    document.querySelectorAll('.codex-tab').forEach((tab) => {
      tab.addEventListener('click', () => {
        ui.codexTab = tab.dataset.tab || 'dreams';
        renderCodex();
        Sound.sfx('page');
      });
    });

    on('albumCloseBtn', 'click', closeAlbum);
    on('albumPlayPause', 'click', toggleAlbumPlayback);
    on('albumStop', 'click', stopAlbum);

    on('volumeRange', 'input', (e) => {
      settings.volume = clamp(Number(e.target.value) / 100, 0, 1);
      const val = $('volumeVal');
      if (val) val.textContent = Math.round(settings.volume * 100);
      Sound.setVolume(settings.volume);
      saveSettings();
    });
    on('muteToggle', 'click', () => {
      settings.muted = !settings.muted;
      Sound.setMuted(settings.muted);
      saveSettings();
      applySettings();
    });
    on('sfxToggle', 'click', () => {
      settings.sfx = !settings.sfx;
      Sound.setSfxEnabled(settings.sfx);
      saveSettings();
      applySettings();
      if (settings.sfx) Sound.sfx('click');
    });
    on('motionToggle', 'click', () => {
      settings.reduceMotion = !settings.reduceMotion;
      saveSettings();
      applySettings();
      Sound.sfx('click');
    });
    document.querySelectorAll('#textSizeSeg button').forEach((b) => {
      b.addEventListener('click', () => {
        settings.textSize = b.dataset.size || 'm';
        saveSettings();
        applySettings();
        Sound.sfx('click');
      });
    });
    on('resetBtn', 'click', () => {
      if (!window.confirm('Сбросить весь прогресс, руны, эха и открытые концовки?')) return;
      try {
        localStorage.removeItem(SAVE_KEY);
        localStorage.removeItem(META_KEY);
      } catch (e) {}
      storedRun = false;
      run = freshRun();
      meta = Object.assign({}, defaultMeta);
      prologueIndex = 0;
      Sound.stopImmediate();
      hideAudioBanner();
      showTitle();
      toast('ПРОГРЕСС СБРОШЕН', 2000);
      setTimeout(() => {
        if (ui.screen === 'title') Sound.startAmbience();
      }, 600);
    });
    on('settingsDoneBtn', 'click', closeSettings);
    on('settingsCloseBtn', 'click', closeSettings);

    on('endingCodexBtn', 'click', () => openCodex('ending'));
    on('endingAgainBtn', 'click', () => {
      Sound.stop(0.5);
      hideAudioBanner();
      startNewGame(true);
    });
    on('endingMenuBtn', 'click', goMenu);

    on('audioBannerRetry', 'click', () => {
      hideAudioBanner();
      Sound.retry();
    });
    on('audioBannerClose', 'click', hideAudioBanner);

    on('listenBtn', 'click', handleListen);
    on('pauseBtn', 'click', openPause);
    on('muteBtn', 'click', toggleMute);
    on('actionBtn', 'click', () => {
      if (ui.screen !== 'play') return;
      play.targetX = null;
      interact();
    });

    bindHold($('walkLeft'), 'left');
    bindHold($('walkRight'), 'right');

    const canvas = $('world');
    if (canvas) {
      canvas.addEventListener('pointerdown', onCanvasPointer);
      canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    }

    document.addEventListener('pointerdown', unlockAudio, { passive: true });
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', onKeyUp);
    window.addEventListener('resize', refreshLayout);
    window.addEventListener('orientationchange', () => setTimeout(refreshLayout, 160));
    window.addEventListener('blur', () => { ui.move.left = false; ui.move.right = false; });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        ui.move.left = false;
        ui.move.right = false;
        if (ui.screen === 'play') openPause();
      }
    });
    window.addEventListener('pagehide', saveRun);
    window.addEventListener('beforeunload', saveRun);
  }

  // ───────────────────────────────────────────────────────────── boot / loop
  function frame(now) {
    window.requestAnimationFrame(frame);
    const dt = clamp((now - (lastFrame || now)) / 1000, 0.001, 0.06);
    lastFrame = now;
    if (document.hidden) return;

    Sound.tick(dt);
    if (ui.screen === 'play') updatePlay(dt);

    const ch = currentChapter();
    const d = ch ? dataFor(ch) : { anchors: {}, echo: false };
    Art.render({
      chapter: ch,
      x: play.x,
      facing: play.facing,
      moving: play.moving,
      phase: play.phase,
      dt: dt,
      listen: ui.listen,
      found: d.anchors || {},
      echoFound: !!d.echo,
      nearAnchor: ui.nearAnchor,
      nearEcho: ui.nearEcho,
      energy: Sound.getEnergy ? Sound.getEnergy() : 0,
      spectrum: Sound.getBands ? Sound.getBands() : null,
      reduceMotion: !!settings.reduceMotion
    });
    frameCount++;
  }

  function boot() {
    settings = Object.assign({}, defaultSettings, loadJSON(SETTINGS_KEY, {}));
    meta = Object.assign({}, defaultMeta, loadJSON(META_KEY, {}));
    meta.endings = Array.isArray(meta.endings) ? meta.endings : [];
    meta.echoes = Number(meta.echoes) || 0;
    meta.bestMemory = Number(meta.bestMemory) || 0;
    meta.runs = Number(meta.runs) || 0;

    const saved = loadJSON(SAVE_KEY, null);
    if (saved && saved.started) {
      run = normalizeRun(saved);
      storedRun = true;
      recomputeRun();
    } else {
      run = freshRun();
      storedRun = false;
    }

    applySettings();

    const canvas = $('world');
    if (canvas) Art.init(canvas);
    Art.setScene((CHAPTERS[run.chapter] || CHAPTERS[0]).scene);

    Sound.onError = (info) => {
      showAudioBanner(info && info.message
        ? info.message
        : 'Браузер не смог прочитать трек. Игра продолжится без музыки.');
      updateTrackLine();
    };
    Sound.onTrack = () => {
      updateTrackLine();
      if (ui.screen === 'album') {
        renderAlbum();
        updateAlbumNow();
      }
    };
    Sound.onAlbumEnd = () => {
      renderAlbum();
      updateAlbumNow();
      toast('АЛЬБОМ ЗАКОНЧИЛСЯ · ТИШИНА', 2200);
    };
    Sound.onState = () => {
      updateTrackLine();
      if (ui.screen === 'album') updateAlbumNow();
    };

    bindUI();
    refreshLayout();
    showTitle();
    lastFrame = (window.performance && performance.now) ? performance.now() : Date.now();
    window.requestAnimationFrame(frame);
  }

  boot();
})();
