/* РИТМ-КАТАЛОГ — game loop, catalogue, judgement and responsive HUD. */
(function () {
  'use strict';

  const CAT = window.RHYTHM_CATALOG;
  const Themes = window.RhythmThemes;
  const Art = window.RhythmArt;
  const AudioEngine = window.CatalogAudio;
  const I18N = window.RhythmI18n;
  const t = I18N ? I18N.t : function (key) { return key; };
  const tCount = I18N ? I18N.count : function (key, n) { return String(n); };

  const $ = id => document.getElementById(id);
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const lerp = (a, b, t) => a + (b - a) * t;

  const SET_KEY = 'rhythmCatalog.settings.v1';
  const BEST_KEY = 'rhythmCatalog.bests.v1';
  const LAST_KEY = 'rhythmCatalog.last.v1';

  const BASE_SCORE = { perfect: 300, good: 200, ok: 100 };
  const LEAD_IN = 2.6;
  const FEVER_TIME = 8.0;
  const MISS_GRACE = 0.18;
  const LANE_KEYS = ['D', 'F', 'J', 'K'];
  const LANE_BY_CODE = {
    KeyD: 0, KeyF: 1, KeyJ: 2, KeyK: 3,
    ArrowLeft: 0, ArrowDown: 1, ArrowUp: 2, ArrowRight: 3,
    Digit1: 0, Digit2: 1, Digit3: 2, Digit4: 3,
    Numpad1: 0, Numpad2: 1, Numpad3: 2, Numpad4: 3
  };
  const SCREENS = [
    'screen-menu', 'screen-select', 'screen-load', 'screen-ready',
    'screen-pause', 'screen-result', 'screen-error'
  ];

  if (!CAT || !CAT.albums || !CAT.albums.length) {
    document.addEventListener('DOMContentLoaded', function () {
      const boot = $('boot-sub');
      if (boot) boot.textContent = 'КАТАЛОГ НЕ НАЙДЕН · ЗАПУСТИ tools/build_catalog.py';
    });
    return;
  }
  if (!Themes || !Art || !AudioEngine) {
    const boot = $('boot-sub');
    if (boot) boot.textContent = 'НЕ ЗАГРУЗИЛИСЬ МОДУЛИ ИГРЫ';
    return;
  }

  const canvas = $('stage');
  const ctx = canvas.getContext('2d', { alpha: false });
  const audio = new AudioEngine();
  const albums = CAT.albums;
  const chartCache = new Map();

  const S = {
    phase: 'boot',
    albumIndex: 0,
    trackIndex: 0,
    album: null,
    track: null,
    chart: null,
    notes: [],
    totalNotes: 0,
    env: null,
    songTime: 0,
    ambient: 0,
    level: 0.16, bassP: 0, midP: 0, highP: 0,
    beatPulse: 0, downPulse: 0,
    section: null, sectionIndex: -1,
    banner: { name: '', sub: '', num: '', age: 0, dur: 0 },
    particles: [], rings: [], popups: [],
    score: 0, combo: 0, maxCombo: 0,
    stats: { perfect: 0, good: 0, ok: 0, miss: 0 },
    flow: 0, fever: 0,
    lanePulse: [0, 0, 0, 0],
    flash: 0, missFlash: 0, shake: 0, fade: 0,
    result: null,
    leadActive: false,
    leadStart: 0,
    leadPausedAt: null,
    startLock: false,
    settings: { offsetMs: 0, volume: 0.85, sfx: true, lang: 'ru' },
    load: { p: 0.04, key: 'load.reading' },
    tint: { r: 0, g: 0, b: 0, a: 0 },
    tintTarget: { r: 0, g: 0, b: 0, a: 0 },
    punch: 0,
    bests: {},
    lastMissFx: -10,
    weatherAcc: 0,
    dpr: 1,
    safeTop: 0,
    lastAlbumId: null,
    lastTrackId: null,
    searchActive: false,
    searchQuery: '',
    searchResults: []
  };

  let raf = 0;
  let lastFrame = 0;
  let resizeQueued = false;
  let toastTimer = 0;

  // --------------------------------------------------------------- storage
  function loadStore() {
    try {
      const s = JSON.parse(localStorage.getItem(SET_KEY) || '{}');
      if (Number.isFinite(s.offsetMs)) S.settings.offsetMs = clamp(s.offsetMs, -250, 250);
      if (Number.isFinite(s.volume)) S.settings.volume = clamp(s.volume, 0, 1);
      if (typeof s.sfx === 'boolean') S.settings.sfx = s.sfx;
      if (s.lang === 'ru' || s.lang === 'en') S.settings.lang = s.lang;
    } catch (e) {}
    try {
      const b = JSON.parse(localStorage.getItem(BEST_KEY) || '{}');
      if (b && typeof b === 'object') S.bests = b;
    } catch (e) {}
    try {
      const l = JSON.parse(localStorage.getItem(LAST_KEY) || 'null');
      if (l && typeof l.albumId === 'string') {
        S.lastAlbumId = l.albumId;
        S.lastTrackId = l.trackId || null;
      }
    } catch (e) {}
    audio.setVolume(S.settings.volume);
    audio.setOffsetMs(S.settings.offsetMs);
    audio.sfxOn = S.settings.sfx;
  }

  function saveSettings() {
    try { localStorage.setItem(SET_KEY, JSON.stringify(S.settings)); } catch (e) {}
  }

  function saveBests() {
    try { localStorage.setItem(BEST_KEY, JSON.stringify(S.bests)); } catch (e) {}
  }

  function saveLast() {
    if (!S.album || !S.track) return;
    try {
      localStorage.setItem(LAST_KEY, JSON.stringify({ albumId: S.album.id, trackId: S.track.id }));
    } catch (e) {}
  }

  function bestOf(trackId) {
    return S.bests[trackId] || null;
  }

  function bestScoreOverall() {
    let best = 0;
    for (const k in S.bests) {
      if (S.bests[k] && Number.isFinite(S.bests[k].score)) best = Math.max(best, S.bests[k].score);
    }
    return best;
  }

  // --------------------------------------------------------------- helpers
  function fmtScore(n) {
    return String(Math.max(0, Math.round(n))).padStart(6, '0');
  }

  function fmtTime(sec) {
    sec = Math.max(0, Math.round(sec || 0));
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    if (h) return h + ':' + String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
    return m + ':' + String(s).padStart(2, '0');
  }

  function showToast(text) {
    const el = $('toast');
    if (!el) return;
    el.textContent = text;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 1500);
  }

  function showScreen(id) {
    for (const s of SCREENS) {
      const el = $(s);
      if (el) el.classList.toggle('hidden', s !== id);
    }
  }

  function hideScreens() {
    for (const s of SCREENS) {
      const el = $(s);
      if (el) el.classList.add('hidden');
    }
  }

  function showPauseButton(show) {
    const b = $('btn-pause');
    if (b) b.classList.toggle('hidden', !show);
  }

  function setPhase(phase) {
    S.phase = phase;
    document.body.classList.toggle('playing', phase === 'playing');
  }

  function applyTheme(theme) {
    const root = document.documentElement;
    root.style.setProperty('--accent', theme.accent);
    root.style.setProperty('--accent2', theme.accent2);
    root.style.setProperty('--sun', theme.sun);
    root.style.setProperty('--faint', theme.fog);
    const ui = theme.ui || {};
    root.style.setProperty('--ui-radius', (ui.radius === undefined ? 12 : ui.radius) + 'px');
    root.style.setProperty('--ui-glow', String(ui.glow === undefined ? 0.22 : ui.glow));
    root.style.setProperty('--ui-tilt', (ui.tilt || 0) + 'deg');
    document.body.dataset.ui = ui.shape || 'soft';
    document.body.dataset.mark = ui.mark || 'none';
    document.body.dataset.scene = theme.scene || 'void';
  }

  function albumTheme(album) {
    return Themes.forAlbum(album.id, album.title);
  }

  function trackTheme(album, track) {
    return Themes.forTrack(album.id, album.title, track.id, track.title);
  }

  function trackSeed(track) {
    return Themes.hash32(String(track.id));
  }

  function previewTheme() {
    if (!S.album) return;
    const theme = S.track ? trackTheme(S.album, S.track) : albumTheme(S.album);
    applyTheme(theme);
    const seed = S.track ? trackSeed(S.track) : Themes.hash32(S.album.id);
    Art.setTheme(theme, seed);
  }

  // ------------------------------------------------------------- language
  function albumInitials(title) {
    const clean = String(title || '').replace(/[^\p{L}\p{N}\s]/gu, ' ').trim();
    const words = clean.split(/\s+/).filter(Boolean);
    if (words.length > 1) return (words[0][0] + words[1][0]).toUpperCase();
    return (clean.replace(/\s/g, '').slice(0, 2) || 'ZQ').toUpperCase();
  }

  function applyReleaseColors(el, album) {
    const theme = albumTheme(album);
    el.style.setProperty('--rel-accent', theme.accent);
    el.style.setProperty('--rel-accent2', theme.accent2);
    el.style.setProperty('--rel-sun', theme.sun);
    el.style.setProperty('--rel-fog', theme.fog);
    el.style.setProperty('--rel-note', theme.note || theme.accent);
    el.style.setProperty('--rel-glow', String((theme.ui && theme.ui.glow) || 0.2));
  }

  function trackMeta(track, album) {
    const genre = track.genre || (album && album.genre) || '—';
    const bpm = Number.isFinite(track.bpm) ? track.bpm + ' BPM' : '— BPM';
    const diff = Number.isFinite(track.difficulty) ? track.difficulty + '/10' : '—';
    return genre + ' · ' + fmtTime(track.duration) + ' · ' + bpm + ' · ' + diff;
  }

  function rankNameForBest(best) {
    if (!best) return '';
    return rankFor(Number.isFinite(best.acc) ? best.acc : 0).name;
  }

  function bestLineFor(trackId) {
    const b = bestOf(trackId);
    if (!b) return t('select.notPlayed');
    return t('select.record', {
      score: fmtScore(b.score || 0),
      rank: rankNameForBest(b),
      acc: Math.round((b.acc || 0) * 10) / 10
    });
  }

  function sectionName(section) {
    if (!section) return '';
    const tag = section.tag;
    if (tag && I18N && I18N.DICT.ru['section.' + tag + '.name']) return t('section.' + tag + '.name');
    return section.name || '';
  }

  function sectionSub(section) {
    if (!section) return '';
    const tag = section.tag;
    if (tag && I18N && I18N.DICT.ru['section.' + tag + '.sub']) return t('section.' + tag + '.sub');
    return section.sub || '';
  }

  function updateTrackPanel() {
    if (!S.album || !S.track) return;
    const track = S.track;
    $('sel-album').textContent = S.album.title.toUpperCase();
    $('sel-title').textContent = track.title;
    $('sel-genre').textContent = track.genre || S.album.genre || '—';
    $('sel-duration').textContent = fmtTime(track.duration);
    $('sel-bpm').textContent = Number.isFinite(track.bpm) ? String(track.bpm) : '—';
    $('sel-diff').textContent = Number.isFinite(track.difficulty) ? track.difficulty + '/10' : '—';
    $('sel-notes').textContent = Number.isFinite(track.notes) ? String(track.notes) : '—';
    $('sel-best').textContent = bestLineFor(track.id);
  }

  function refreshLanguageUi() {
    if (I18N) I18N.apply();
    setupMenu();
    updateHeader();
    updateTrackPanel();
    updateSettingsUi();
    renderAlbumSheet();
    if (S.searchActive) {
      S.searchResults = searchCatalog(S.searchQuery);
      updateSearchUi();
      renderSearchResults();
    }
    if (S.load && S.load.key) setLoadProgress(S.load.p, S.load.key);
    if (S.phase === 'end' && S.result) showResult(S.result);
    if (S.phase === 'error') {
      const el = $('err-text');
      if (el && !el.dataset.raw) el.textContent = t('error.default');
    }
  }

  function setLanguage(lang) {
    if (!I18N) return;
    S.settings.lang = I18N.normalize(lang);
    I18N.setLang(S.settings.lang);
    saveSettings();
    refreshLanguageUi();
  }

  // ------------------------------------------------------------- colour flow
  const TINT_TAGS = {
    intro: { key: 'fog', a: 0.100 },
    build: { key: 'accent2', a: 0.135 },
    theme: { key: 'accent', a: 0.115 },
    drop: { key: 'accent2', a: 0.185 },
    climax: { key: 'sun', a: 0.200 },
    break: { key: 'fog', a: 0.100 },
    outro: { key: 'sky', a: 0.220 }
  };

  function tintFor(tag) {
    const theme = Art.theme || (S.album ? trackTheme(S.album, S.track) : null);
    if (!theme) return { r: 0, g: 0, b: 0, a: 0 };
    const spec = TINT_TAGS[tag] || TINT_TAGS.theme;
    let color;
    if (spec.key === 'sky') color = theme.sky ? (theme.sky[2] || theme.sky[0]) : '#02040a';
    else color = theme[spec.key] || theme.accent;
    const rgb = Art.parseColor(color);
    return { r: rgb[0], g: rgb[1], b: rgb[2], a: spec.a };
  }

  function setTintTarget(tag, immediate) {
    const target = tintFor(tag);
    S.tintTarget = target;
    if (immediate) {
      S.tint = { r: target.r, g: target.g, b: target.b, a: target.a };
    }
  }

  function resetTint() {
    S.tintTarget = { r: S.tint.r, g: S.tint.g, b: S.tint.b, a: 0 };
  }

  function updateTint(dt) {
    const k = Math.min(1, dt * 1.9);
    S.tint.r += (S.tintTarget.r - S.tint.r) * k;
    S.tint.g += (S.tintTarget.g - S.tint.g) * k;
    S.tint.b += (S.tintTarget.b - S.tint.b) * k;
    S.tint.a += (S.tintTarget.a - S.tint.a) * k;
  }

  // ------------------------------------------------------------- selection
  function setupMenu() {
    $('stat-albums').textContent = CAT.stats ? CAT.stats.albums : albums.length;
    let tracks = 0;
    for (const a of albums) tracks += a.tracks.length;
    $('stat-tracks').textContent = CAT.stats ? CAT.stats.tracks : tracks;
    $('stat-best').textContent = fmtScore(bestScoreOverall());
  }

  function findAlbumIndex(id) {
    for (let i = 0; i < albums.length; i++) if (albums[i].id === id) return i;
    return 0;
  }

  function initialSelection() {
    const ai = findAlbumIndex(S.lastAlbumId || albums[0].id);
    let ti = 0;
    if (S.lastTrackId) {
      const idx = albums[ai].tracks.findIndex(t => t.id === S.lastTrackId);
      if (idx >= 0) ti = idx;
    }
    selectAlbum(ai, ti, true);
  }

  function makeAlbumChip(album, i, inSheet) {
    const b = document.createElement('button');
    b.className = 'album-chip' + (i === S.albumIndex ? ' active' : '') + (inSheet ? ' album-card' : '');
    b.dataset.index = String(i);
    b.type = 'button';
    b.title = album.genre || '';
    applyReleaseColors(b, album);
    if (inSheet) {
      const badge = document.createElement('span');
      badge.className = 'album-card-badge';
      badge.textContent = albumInitials(album.title);
      b.appendChild(badge);
      const info = document.createElement('span');
      info.className = 'album-card-info';
      const title = document.createElement('span');
      title.className = 'album-card-title';
      title.textContent = album.title;
      const count = document.createElement('em');
      count.textContent = (album.genre ? album.genre + ' · ' : '') + tCount('select.trackCount', album.tracks.length);
      info.appendChild(title);
      info.appendChild(count);
      b.appendChild(info);
    } else {
      const title = document.createElement('span');
      title.textContent = album.title;
      const count = document.createElement('em');
      count.textContent = String(album.tracks.length);
      b.appendChild(title);
      b.appendChild(count);
    }
    b.addEventListener('click', function () {
      if (S.phase !== 'select') return;
      selectAlbum(i, 0);
      if (inSheet) closeAlbumSheet();
    });
    return b;
  }

  function renderAlbumRail() {
    const rail = $('album-rail');
    if (!rail) return;
    rail.textContent = '';
    albums.forEach(function (album, i) {
      rail.appendChild(makeAlbumChip(album, i, false));
    });
    const active = rail.children[S.albumIndex];
    if (active) {
      requestAnimationFrame(function () {
        try { active.scrollIntoView({ block: 'nearest', inline: 'nearest' }); } catch (e) {}
      });
    }
  }

  function renderAlbumSheet() {
    const grid = $('album-grid');
    if (!grid) return;
    grid.textContent = '';
    albums.forEach(function (album, i) {
      grid.appendChild(makeAlbumChip(album, i, true));
    });
  }

  function openAlbumSheet() {
    if (S.phase !== 'select') return;
    const sheet = $('album-sheet');
    if (!sheet) return;
    renderAlbumSheet();
    sheet.classList.add('open');
    sheet.setAttribute('aria-hidden', 'false');
    document.body.classList.add('drawer-open');
    const active = sheet.querySelector('.album-chip.active');
    if (active) {
      requestAnimationFrame(function () {
        try { active.scrollIntoView({ block: 'center', inline: 'nearest' }); } catch (e) {}
      });
    }
  }

  function closeAlbumSheet() {
    const sheet = $('album-sheet');
    if (!sheet) return;
    sheet.classList.remove('open');
    sheet.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('drawer-open');
  }

  function renderTrackList() {
    const list = $('track-list');
    list.textContent = '';
    const album = S.album;
    album.tracks.forEach(function (track, i) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'track-item' + (i === S.trackIndex ? ' active' : '');
      b.dataset.index = String(i);
      b.dataset.trackId = track.id;
      b.setAttribute('role', 'option');
      b.setAttribute('aria-selected', i === S.trackIndex ? 'true' : 'false');
      applyReleaseColors(b, album);

      const num = document.createElement('span');
      num.className = 'num';
      num.textContent = String(i + 1).padStart(2, '0');

      const info = document.createElement('span');
      info.className = 'info';
      const name = document.createElement('span');
      name.className = 'name';
      name.textContent = track.title;
      const meta = document.createElement('span');
      meta.className = 'sub';
      meta.textContent = trackMeta(track, album);
      info.appendChild(name);
      info.appendChild(meta);

      const best = document.createElement('span');
      best.className = 'best';
      const bscore = bestOf(track.id);
      best.textContent = bscore ? fmtScore(bscore.score) : '—';

      b.appendChild(num);
      b.appendChild(info);
      b.appendChild(best);
      b.addEventListener('click', function () {
        if (S.phase !== 'select') return;
        if (S.trackIndex === i) {
          beginSelectedTrack();
        } else {
          selectTrack(i);
        }
      });
      b.addEventListener('dblclick', function () {
        if (S.phase !== 'select') return;
        selectTrack(i);
        beginSelectedTrack();
      });
      list.appendChild(b);
    });
  }

  // ----------------------------------------------------------------- search
  function normalizeSearchText(value) {
    return String(value || '').toLocaleLowerCase().replace(/ё/g, 'е').replace(/\s+/g, ' ').trim();
  }

  function searchCatalog(query) {
    const terms = normalizeSearchText(query).split(' ').filter(Boolean);
    if (!terms.length) return [];
    const out = [];
    albums.forEach(function (album, ai) {
      album.tracks.forEach(function (track, ti) {
        const hay = normalizeSearchText([
          track.title, album.title, track.genre || album.genre || '',
          track.id, album.id
        ].join(' '));
        let ok = true;
        for (const term of terms) {
          if (hay.indexOf(term) < 0) { ok = false; break; }
        }
        if (ok) out.push({ ai: ai, ti: ti, album: album, track: track });
      });
    });
    const q = normalizeSearchText(query);
    out.sort(function (a, b) {
      const at = normalizeSearchText(a.track.title);
      const bt = normalizeSearchText(b.track.title);
      const as = at === q ? 0 : at.indexOf(q) === 0 ? 1 : 2;
      const bs = bt === q ? 0 : bt.indexOf(q) === 0 ? 1 : 2;
      if (as !== bs) return as - bs;
      return a.album.title.localeCompare(b.album.title) || a.ti - b.ti;
    });
    return out;
  }

  function updateSearchUi() {
    const screen = $('screen-select');
    const clear = $('search-clear');
    const status = $('search-status');
    if (screen) screen.classList.toggle('searching', S.searchActive);
    if (clear) clear.classList.toggle('hidden', !S.searchActive);
    if (status) {
      if (!S.searchActive) status.textContent = '';
      else if (S.searchResults.length) status.textContent = t('select.searchCount', { n: S.searchResults.length });
      else status.textContent = t('select.searchEmpty');
    }
  }

  function renderSearchResults() {
    const list = $('track-list');
    if (!list) return;
    list.textContent = '';
    if (!S.searchResults.length) {
      const empty = document.createElement('p');
      empty.className = 'search-empty';
      empty.textContent = t('select.searchEmpty');
      list.appendChild(empty);
      return;
    }
    S.searchResults.forEach(function (item) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'track-item search-result' + (item.album === S.album && item.track === S.track ? ' active' : '');
      b.dataset.ai = String(item.ai);
      b.dataset.ti = String(item.ti);
      b.setAttribute('role', 'option');
      b.setAttribute('aria-selected', item.album === S.album && item.track === S.track ? 'true' : 'false');
      applyReleaseColors(b, item.album);

      const num = document.createElement('span');
      num.className = 'num';
      num.textContent = String(item.ti + 1).padStart(2, '0');

      const info = document.createElement('span');
      info.className = 'info';
      const name = document.createElement('span');
      name.className = 'name';
      name.textContent = item.track.title;
      const meta = document.createElement('span');
      meta.className = 'sub';
      meta.textContent = item.album.title + ' · ' + trackMeta(item.track, item.album);
      info.appendChild(name);
      info.appendChild(meta);

      const best = document.createElement('span');
      best.className = 'best';
      const bscore = bestOf(item.track.id);
      best.textContent = bscore ? fmtScore(bscore.score) : '—';

      b.appendChild(num);
      b.appendChild(info);
      b.appendChild(best);
      b.addEventListener('click', function () {
        if (S.phase !== 'select') return;
        chooseSearchResult(item.ai, item.ti);
      });
      b.addEventListener('dblclick', function () {
        if (S.phase !== 'select') return;
        chooseSearchResult(item.ai, item.ti);
        ensureAudioUnlocked();
        beginSelectedTrack();
      });
      list.appendChild(b);
    });
  }

  function chooseSearchResult(ai, ti) {
    const album = albums[ai];
    if (!album) return;
    const track = album.tracks[ti];
    if (!track) return;
    S.albumIndex = ai;
    S.album = album;
    S.trackIndex = ti;
    S.track = track;
    updateHeader();
    updateTrackPanel();
    previewTheme();
    saveLast();
    const rail = $('album-rail');
    if (rail) {
      for (let i = 0; i < rail.children.length; i++) {
        rail.children[i].classList.toggle('active', i === ai);
      }
    }
    const list = $('track-list');
    if (!list) return;
    for (let i = 0; i < list.children.length; i++) {
      const el = list.children[i];
      const on = el.dataset.ai === String(ai) && el.dataset.ti === String(ti);
      el.classList.toggle('active', on);
      if (el.hasAttribute('role')) el.setAttribute('aria-selected', on ? 'true' : 'false');
    }
  }

  function setSearchQuery(value) {
    const query = String(value || '');
    S.searchQuery = query;
    if (!normalizeSearchText(query)) {
      clearSearch();
      return;
    }
    S.searchActive = true;
    S.searchResults = searchCatalog(query);
    updateSearchUi();
    renderSearchResults();
  }

  function resetSearchState() {
    S.searchActive = false;
    S.searchQuery = '';
    S.searchResults = [];
    const input = $('search-input');
    if (input && input.value) input.value = '';
    updateSearchUi();
  }

  function clearSearch(skipRender) {
    const wasActive = S.searchActive;
    resetSearchState();
    if (!wasActive || skipRender) return;
    renderAlbumRail();
    updateHeader();
    renderTrackList();
  }

  function focusSearch() {
    const input = $('search-input');
    if (!input) return;
    input.focus();
    try { input.select(); } catch (e) {}
  }

  function moveSearchSelection(delta) {
    if (!S.searchActive || !S.searchResults.length) return;
    let idx = S.searchResults.findIndex(function (item) {
      return item.album === S.album && item.track === S.track;
    });
    if (idx < 0) idx = delta > 0 ? -1 : 0;
    idx = (idx + delta + S.searchResults.length) % S.searchResults.length;
    const item = S.searchResults[idx];
    chooseSearchResult(item.ai, item.ti);
    const list = $('track-list');
    if (!list) return;
    const el = list.querySelector('.search-result[data-ai="' + item.ai + '"][data-ti="' + item.ti + '"]');
    if (el) {
      try { el.scrollIntoView({ block: 'nearest' }); } catch (e) {}
    }
  }

  function playSearchSelection() {
    if (S.searchActive) {
      const inResults = S.searchResults.some(function (item) {
        return item.album === S.album && item.track === S.track;
      });
      if (!inResults && S.searchResults.length) {
        const first = S.searchResults[0];
        chooseSearchResult(first.ai, first.ti);
      }
    }
    ensureAudioUnlocked();
    beginSelectedTrack();
  }

  function selectAlbum(index, trackIndex, silent) {
    if (index < 0 || index >= albums.length) return;
    if (S.searchActive) resetSearchState();
    S.albumIndex = index;
    S.album = albums[index];
    S.trackIndex = clamp(trackIndex || 0, 0, S.album.tracks.length - 1);
    renderAlbumRail();
    renderTrackList();
    updateHeader();
    selectTrack(S.trackIndex, true);
    if (!silent) {
      const list = $('track-list');
      if (list && list.children[S.trackIndex]) {
        requestAnimationFrame(function () {
          try { list.children[S.trackIndex].scrollIntoView({ block: 'nearest' }); } catch (e) {}
        });
      }
    }
  }

  function updateHeader() {
    if (!S.album) return;
    $('album-heading').textContent = S.album.title;
    const genre = S.album.genre ? S.album.genre + ' · ' : '';
    $('album-count').textContent = genre + tCount('select.trackCount', S.album.tracks.length);
    const badge = $('album-badge');
    if (badge) badge.textContent = albumInitials(S.album.title);
    const albumsBtn = $('btn-albums');
    if (albumsBtn) albumsBtn.textContent = t('select.albums');
  }

  function selectTrack(index, silent) {
    if (!S.album) return;
    const tracks = S.album.tracks;
    S.trackIndex = clamp(index, 0, tracks.length - 1);
    S.track = tracks[S.trackIndex];

    const list = $('track-list');
    for (let i = 0; i < list.children.length; i++) {
      const el = list.children[i];
      const on = i === S.trackIndex;
      el.classList.toggle('active', on);
      el.setAttribute('aria-selected', on ? 'true' : 'false');
      if (on && !silent) {
        try { el.scrollIntoView({ block: 'nearest' }); } catch (e) {}
      }
    }

    updateTrackPanel();
    previewTheme();
    saveLast();
  }

  function refreshTrackBest(trackId) {
    const list = $('track-list');
    for (let i = 0; i < list.children.length; i++) {
      const el = list.children[i];
      if (el.dataset.trackId !== trackId) continue;
      const best = el.querySelector('.best');
      const b = bestOf(trackId);
      if (best) best.textContent = b ? fmtScore(b.score) : '—';
    }
    if (S.track && S.track.id === trackId) {
      $('sel-best').textContent = bestLineFor(trackId);
    }
  }

  // ----------------------------------------------------------------- audio
  async function ensureAudioUnlocked() {
    try { await audio.unlock(); } catch (e) { /* media may still work */ }
  }

  // ---------------------------------------------------------------- charts
  function prepareChart(chart) {
    if (chart._env) return chart;
    const rows = chart.env || [];
    const arr = new Uint8Array(rows.length * 4);
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      for (let k = 0; k < 4; k++) {
        const hex = row.slice(k * 2, k * 2 + 2);
        arr[i * 4 + k] = parseInt(hex, 16) || 0;
      }
    }
    chart._env = arr;
    chart._envHz = chart.envHz || 5;
    return chart;
  }

  async function loadChart(track) {
    if (chartCache.has(track.id)) return chartCache.get(track.id);
    const url = new URL(track.chart, location.href).href;
    const res = await fetch(url, { cache: 'force-cache' });
    if (!res.ok) throw new Error('Нет файла чарта: ' + track.chart);
    const chart = prepareChart(await res.json());
    chartCache.set(track.id, chart);
    return chart;
  }

  function envAt(col, t) {
    const chart = S.chart;
    if (!chart || !S.env || !S.env.length) return 0;
    const hz = chart._envHz || 5;
    const rows = S.env.length / 4;
    const f = clamp(t, 0, chart.duration || 0) * hz;
    const i = clamp(Math.floor(f), 0, rows - 1);
    const j = Math.min(i + 1, rows - 1);
    const k = f - Math.floor(f);
    return lerp(S.env[i * 4 + col], S.env[j * 4 + col], k) / 255;
  }

  function sectionAt(t) {
    const sections = S.chart && S.chart.sections;
    if (!sections || !sections.length) return -1;
    for (let i = sections.length - 1; i >= 0; i--) {
      if (t >= sections[i].t0) return i;
    }
    return 0;
  }

  function announce(section, force) {
    if (!section) return;
    S.banner = {
      name: section.name, sub: section.sub, num: section.num,
      age: force ? -0.25 : 0, dur: force ? 3.6 : 3.0
    };
  }

  // ------------------------------------------------------------- run setup
  function prepareRun(chart) {
    S.chart = chart;
    S.env = chart._env;
    S.notes = (chart.notes || []).map(function (n, i) {
      return {
        i: i, t: n[0], l: n[1], v: n[2] === undefined ? 0.6 : n[2],
        w: 0.74 + (n[2] === undefined ? 0.6 : n[2]) * 0.42,
        judged: false
      };
    });
    S.totalNotes = S.notes.length;
    S.score = 0;
    S.combo = 0;
    S.maxCombo = 0;
    S.stats = { perfect: 0, good: 0, ok: 0, miss: 0 };
    S.flow = 0;
    S.fever = 0;
    S.particles = [];
    S.rings = [];
    S.popups = [];
    S.lanePulse = [0, 0, 0, 0];
    S.flash = 0;
    S.missFlash = 0;
    S.shake = 0;
    S.fade = 0;
    S.songTime = -LEAD_IN;
    S.sectionIndex = -1;
    S.section = chart.sections && chart.sections.length ? chart.sections[0] : null;
    S.lastMissFx = -10;
    S.result = null;
    S.punch = 0;
    setTintTarget(S.section ? S.section.tag : 'theme', true);
    S.leadActive = true;
    S.leadStart = performance.now();
    S.leadPausedAt = null;
    announce(S.section, true);
  }

  async function beginSelectedTrack() {
    if (!S.album || !S.track) return;
    await startTrack(S.album, S.track);
  }

  async function startTrack(album, track) {
    if (S.startLock) return;
    S.startLock = true;
    S.album = album;
    S.albumIndex = albums.indexOf(album);
    S.track = track;
    const ti = album.tracks.indexOf(track);
    S.trackIndex = ti >= 0 ? ti : 0;

    applyTheme(trackTheme(album, track));
    Art.setTheme(trackTheme(album, track), trackSeed(track));
    audio.stop();
    audio.setVolume(S.settings.volume);
    audio.setOffsetMs(S.settings.offsetMs);
    audio.sfxOn = S.settings.sfx;

    showPauseButton(false);
    closeAlbumSheet();
    showScreen('screen-load');
    $('load-album').textContent = album.title.toUpperCase();
    $('load-title').textContent = track.title;
    setLoadProgress(0.04, 'load.reading');

    try {
      const chart = await loadChart(track);
      setLoadProgress(0.34, 'load.chartReady');
      await audio.loadTrack(track, function (p) {
        const pct = clamp(0.34 + p * 0.62, 0.34, 0.97);
        setLoadProgress(pct, p >= 1 ? 'load.soundReady' : 'load.streaming');
      });
      setLoadProgress(0.98, 'load.go');
      prepareRun(chart);
      setPhase('playing');
      hideScreens();
      showPauseButton(true);
      document.body.classList.add('playing');
      saveLast();
      S.startLock = false;
    } catch (err) {
      console.error(err);
      setPhase('error');
      showPauseButton(false);
      const errEl = $('err-text');
      const raw = String(err && err.message ? err.message : err);
      if (errEl) {
        errEl.dataset.raw = '1';
        errEl.textContent = raw;
      }
      showScreen('screen-error');
      S.startLock = false;
    }
  }

  function setLoadProgress(p, key) {
    S.load = { p: clamp(p, 0, 1), key: key || S.load.key };
    const pct = Math.round(S.load.p * 100);
    const bar = $('load-bar');
    const num = $('load-percent');
    const st = $('load-status');
    if (bar) bar.style.width = pct + '%';
    if (num) num.textContent = pct + '%';
    if (st && S.load.key) st.textContent = t(S.load.key);
  }

  async function startAudioForRun() {
    try {
      await audio.play(0);
      S.songTime = audio.time;
      return true;
    } catch (e) {
      console.warn('autoplay blocked', e);
      setPhase('ready');
      showPauseButton(false);
      $('ready-album').textContent = (S.album ? S.album.title : '').toUpperCase();
      $('ready-title').textContent = S.track ? S.track.title : '';
      showScreen('screen-ready');
      return false;
    }
  }

  async function pauseGame() {
    if (S.phase !== 'playing') return;
    if (S.leadActive) {
      S.leadPausedAt = S.songTime;
      S.leadActive = false;
    } else {
      audio.pause();
    }
    setPhase('paused');
    showPauseButton(false);
    updateSettingsUi();
    showScreen('screen-pause');
  }

  async function resumeGame() {
    if (S.phase !== 'paused') return;
    hideScreens();
    setPhase('playing');
    showPauseButton(true);
    if (S.leadPausedAt !== null) {
      S.leadStart = performance.now() - (S.leadPausedAt + LEAD_IN) * 1000;
      S.leadActive = true;
      S.leadPausedAt = null;
    } else {
      try {
        await audio.resume();
      } catch (e) {
        await startAudioForRun();
      }
    }
  }

  async function restartGame() {
    if (!S.album || !S.track) return;
    if (S.startLock) return;
    audio.stop();
    S.leadActive = false;
    S.leadPausedAt = null;
    hideScreens();
    await startTrack(S.album, S.track);
  }

  function quitToCatalog() {
    audio.stop();
    S.leadActive = false;
    S.leadPausedAt = null;
    resetTint();
    closeAlbumSheet();
    setPhase('select');
    showPauseButton(false);
    hideScreens();
    showScreen('screen-select');
    if (S.album) selectAlbum(S.albumIndex, S.trackIndex, true);
  }

  function toMenu() {
    closeAlbumSheet();
    if (S.searchActive) clearSearch(true);
    audio.stop();
    resetTint();
    setPhase('menu');
    showPauseButton(false);
    hideScreens();
    showScreen('screen-menu');
    setupMenu();
    previewTheme();
  }

  function openCatalog() {
    ensureAudioUnlocked();
    if (!S.album) initialSelection();
    resetTint();
    closeAlbumSheet();
    setPhase('select');
    showPauseButton(false);
    hideScreens();
    showScreen('screen-select');
    previewTheme();
  }

  // -------------------------------------------------------------- judgement
  function multiplier() {
    let tier = 1;
    if (S.combo >= 150) tier = 2.0;
    else if (S.combo >= 100) tier = 1.75;
    else if (S.combo >= 50) tier = 1.5;
    else if (S.combo >= 25) tier = 1.25;
    else if (S.combo >= 10) tier = 1.1;
    return tier * (S.fever > 0 ? 2 : 1);
  }

  function liveAccuracy() {
    const judged = S.stats.perfect + S.stats.good + S.stats.ok + S.stats.miss;
    if (!judged) return 100;
    const weighted = S.stats.perfect + S.stats.good * 0.72 + S.stats.ok * 0.42;
    return clamp(weighted / judged * 100, 0, 100);
  }

  function judge(lane) {
    if (S.phase !== 'playing') return;
    const t = S.songTime;
    let best = null;
    let bestDiff = 1e9;
    const limit = 0.18;
    for (let i = 0; i < S.notes.length; i++) {
      const n = S.notes[i];
      if (n.judged || n.l !== lane) continue;
      if (n.t < t - limit) continue;
      if (n.t > t + limit) break;
      const d = Math.abs(n.t - t);
      if (d < bestDiff) { best = n; bestDiff = d; }
    }
    if (!best) return;
    let q;
    if (bestDiff <= 0.055) q = 'perfect';
    else if (bestDiff <= 0.11) q = 'good';
    else q = 'ok';
    best.judged = true;
    S.stats[q]++;
    S.combo++;
    if (S.combo > S.maxCombo) S.maxCombo = S.combo;
    const gain = Math.round(BASE_SCORE[q] * multiplier());
    S.score += gain;
    if (S.fever <= 0) {
      S.flow = clamp(S.flow + (q === 'perfect' ? 2.4 : q === 'good' ? 1.5 : 0.7), 0, 100);
      if (S.flow >= 100) startFever();
    }
    spawnHitFx(lane, q, gain);
    audio.tick(q, lane);
    if (S.combo > 0 && S.combo % 25 === 0) {
      S.popups.push({
        x: Art.W / 2, y: Art.H * 0.42, text: '×' + S.combo,
        color: Art.theme.sun, life: 1.1, maxLife: 1.1, vy: -9, size: 1.35
      });
      S.punch = Math.max(S.punch, 0.9);
      S.shake = Math.max(S.shake, 0.32);
      S.rings.push({
        x: Art.W / 2, y: Art.HIT_Y, r: 4, maxR: Art.laneGap * 2.2,
        life: 0.7, maxLife: 0.7, color: Art.theme.accent2, wide: true
      });
      for (let i = 0; i < 16; i++) {
        const a = Math.random() * Math.PI * 2;
        S.particles.push({
          x: Art.W / 2 + Math.cos(a) * 30, y: Art.H * 0.42 + Math.sin(a) * 18,
          vx: Math.cos(a) * 32, vy: Math.sin(a) * 32 - 8,
          life: 0.5 + Math.random() * 0.6, maxLife: 1.1,
          color: i % 3 ? Art.theme.accent : Art.theme.sun,
          size: 2, kind: 'spark'
        });
      }
    }
  }

  function startFever() {
    if (S.fever > 0) return;
    S.fever = FEVER_TIME;
    S.flow = 100;
    audio.feverChime();
    S.flash = Math.max(S.flash, 0.32);
    S.shake = Math.max(S.shake, 1.15);
    S.punch = Math.max(S.punch, 1.6);
    S.popups.push({
      x: Art.W / 2, y: Art.H * 0.3, text: t('hud.feverBadge'),
      color: Art.theme.sun, life: 1.8, maxLife: 1.8, vy: -10, size: 1.7
    });
    S.rings.push({
      x: Art.W / 2, y: Art.HIT_Y, r: 10, maxR: Math.min(Art.W, Art.H) * 0.42,
      life: 1.0, maxLife: 1.0, color: Art.theme.sun, wide: true
    });
    for (let i = 0; i < 28; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 40 + Math.random() * 110;
      S.particles.push({
        x: Art.W / 2, y: Art.HIT_Y,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 30,
        life: 0.7 + Math.random() * 1.0, maxLife: 1.7,
        color: i % 3 ? Art.theme.sun : Art.theme.accent,
        size: Math.random() < 0.35 ? 3 : 2, kind: 'spark'
      });
    }
  }

  function spawnHitFx(lane, q, gain) {
    const x = Art.LANE_X[lane];
    const y = Art.HIT_Y;
    const theme = Art.theme;
    const col = theme.lane[lane] || theme.accent;
    const perfect = q === 'perfect';
    S.lanePulse[lane] = 1;
    S.shake = Math.max(S.shake, perfect ? 0.48 : q === 'good' ? 0.26 : 0.16);
    if (perfect) S.punch = Math.max(S.punch, 0.55);

    const count = perfect ? 18 : q === 'good' ? 12 : 7;
    for (let i = 0; i < count; i++) {
      const a = -Math.PI * 0.5 + (Math.random() - 0.5) * (perfect ? 2.8 : 2.2);
      const sp = perfect ? 50 + Math.random() * 90 : 26 + Math.random() * 52;
      S.particles.push({
        x: x + (Math.random() - 0.5) * 10,
        y: y - 2,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        life: 0.4 + Math.random() * (perfect ? 0.7 : 0.45),
        maxLife: perfect ? 1.1 : 0.85,
        color: perfect ? (i % 3 ? theme.sun : '#ffffff') : (i % 2 ? col : theme.accent2),
        size: Math.random() < 0.3 ? 3 : 2,
        kind: perfect ? 'spark' : 'ash'
      });
    }
    S.rings.push({
      x: x, y: y, r: 3,
      maxR: perfect ? Art.laneGap * 0.55 : Art.laneGap * 0.36,
      life: perfect ? 0.55 : 0.4, maxLife: perfect ? 0.55 : 0.4,
      color: perfect ? theme.sun : col, wide: perfect
    });
    if (perfect) S.flash = Math.max(S.flash, 0.06);
    S.popups.push({
      x: x, y: y - Art.laneGap * 0.3,
      text: t(perfect ? 'judge.perfect' : q === 'good' ? 'judge.good' : 'judge.ok'),
      color: perfect ? theme.sun : q === 'good' ? theme.accent : col,
      life: perfect ? 0.8 : 0.6, maxLife: perfect ? 0.8 : 0.6, vy: -34, size: 1
    });
  }

  function registerMiss(n) {
    S.stats.miss++;
    S.combo = 0;
    if (S.fever > 0) {
      S.fever = Math.max(0, S.fever - 0.7);
      if (S.fever === 0) S.flow = 0;
    } else {
      S.flow = Math.max(0, S.flow - 3.6);
    }
    S.missFlash = Math.min(0.6, S.missFlash + 0.22);
    const t = S.songTime;
    if (t - S.lastMissFx < 0.08) return;
    S.lastMissFx = t;
    const x = Art.LANE_X[n.l];
    const theme = Art.theme;
    for (let i = 0; i < 5; i++) {
      S.particles.push({
        x: x + (Math.random() - 0.5) * 18,
        y: Art.HIT_Y - 4 + Math.random() * 8,
        vx: (Math.random() - 0.5) * 28,
        vy: -6 - Math.random() * 16,
        life: 0.3 + Math.random() * 0.4, maxLife: 0.7,
        color: i % 2 ? theme.fog : '#8890a0',
        size: 2, kind: 'ash'
      });
    }
    S.rings.push({
      x: x, y: Art.HIT_Y, r: 2, maxR: Art.laneGap * 0.24,
      life: 0.3, maxLife: 0.3, color: theme.fog, wide: false
    });
    S.popups.push({
      x: x, y: Art.HIT_Y - Art.laneGap * 0.26, text: t('judge.miss'),
      color: theme.fog, life: 0.5, maxLife: 0.5, vy: -20, size: 0.9
    });
    audio.missTick();
  }

  function endGame() {
    if (S.phase === 'end') return;
    for (const n of S.notes) {
      if (!n.judged) {
        n.judged = true;
        S.stats.miss++;
      }
    }
    audio.stop();
    S.leadActive = false;
    S.leadPausedAt = null;
    S.combo = 0;
    S.fever = 0;
    S.flow = 0;
    S.result = makeResult();
    const saved = saveBest(S.result);
    S.result.newBest = saved;
    S.flash = 0.2;
    showResult(S.result);
    setPhase('end');
    showPauseButton(false);
    hideScreens();
    showScreen('screen-result');
    document.body.classList.remove('playing');
  }

  function makeResult() {
    const total = Math.max(1, S.totalNotes);
    const weighted = S.stats.perfect + S.stats.good * 0.72 + S.stats.ok * 0.42;
    const acc = clamp(weighted / total * 100, 0, 100);
    return {
      score: S.score,
      acc: acc,
      maxCombo: S.maxCombo,
      perfect: S.stats.perfect,
      good: S.stats.good,
      ok: S.stats.ok,
      miss: S.stats.miss,
      total: S.totalNotes,
      rank: rankFor(acc)
    };
  }

  function rankFor(acc) {
    let key = 'debut';
    let color = '#9aa4b8';
    if (acc >= 97) { key = 'legend'; color = '#ffe08a'; }
    else if (acc >= 92) { key = 'headliner'; color = '#ffc24a'; }
    else if (acc >= 84) { key = 'resident'; color = '#7affc0'; }
    else if (acc >= 70) { key = 'participant'; color = '#8fd3ff'; }
    else if (acc >= 50) { key = 'listener'; color = '#b8b0e8'; }
    return {
      key: key,
      name: t('rank.' + key + '.name'),
      sub: t('rank.' + key + '.sub'),
      color: color
    };
  }

  function saveBest(result) {
    if (!S.track) return false;
    const id = S.track.id;
    const prev = S.bests[id];
    const isNew = !prev || result.score > (prev.score || 0);
    const plays = (prev && prev.plays ? prev.plays : 0) + 1;
    if (isNew) {
      S.bests[id] = {
        score: result.score,
        acc: Math.round(result.acc * 10) / 10,
        combo: result.maxCombo,
        rankKey: result.rank.key,
        rank: result.rank.name,
        plays: plays,
        at: Date.now()
      };
    } else {
      prev.plays = plays;
    }
    saveBests();
    refreshTrackBest(id);
    return isNew;
  }

  function showResult(r) {
    $('res-album').textContent = (S.album ? S.album.title : '').toUpperCase();
    $('res-track').textContent = S.track ? S.track.title : '';
    $('res-rank').textContent = r.rank.name;
    $('res-rank').style.color = r.rank.color;
    $('res-sub').textContent = r.rank.sub;
    $('res-score').textContent = fmtScore(r.score);
    $('res-acc').textContent = r.acc.toFixed(1) + '%';
    $('res-combo').textContent = String(r.maxCombo);
    $('res-counts').textContent = t('result.counts', {
      perfect: r.perfect, good: r.good, ok: r.ok, miss: r.miss
    });
    const best = bestOf(S.track ? S.track.id : '');
    if (r.newBest) {
      $('res-best').textContent = t('result.newBest', { score: fmtScore(r.score) });
    } else if (best) {
      $('res-best').textContent = t('result.best', {
        score: fmtScore(best.score), rank: rankNameForBest(best)
      });
    } else {
      $('res-best').textContent = '';
    }
    $('btn-next').disabled = false;
  }

  function nextTrack() {
    if (!S.album) return;
    const idx = S.album.tracks.indexOf(S.track);
    const next = idx < 0 ? 0 : (idx + 1) % S.album.tracks.length;
    selectTrack(next, true);
    startTrack(S.album, S.album.tracks[next]);
  }

  // ---------------------------------------------------------------- update
  function update(dt) {
    S.ambient += dt;
    updateTint(dt);
    S.punch = Math.max(0, S.punch - dt * 4.2);
    if (S.phase === 'playing') {
      if (S.leadActive) {
        const now = (performance.now() - S.leadStart) / 1000 - LEAD_IN;
        S.songTime = now;
        if (now >= 0) {
          S.leadActive = false;
          S.songTime = 0;
          startAudioForRun();
        }
      } else {
        S.songTime = audio.time;
      }

      if (!S.leadActive) {
        if (S.songTime >= (S.chart.playableEnd || S.chart.duration) - 0.06 || audio.finished) {
          endGame();
          return;
        }
      }

      updateEnv(S.songTime);
      updateSections(S.songTime);
      updateBeat(S.songTime);
      updateNotes(S.songTime);
      updateFever(dt);
      updatePulses(dt);
      updateParticles(dt);
      updateRings(dt);
      updatePopups(dt);
      updateBanner(dt);
    } else if (S.phase === 'paused') {
      updateParticles(dt * 0.08);
      updateRings(dt * 0.08);
      updatePopups(dt * 0.08);
      updateBanner(dt * 0.08);
      updatePulses(dt * 0.2);
      S.flash = Math.max(0, S.flash - dt * 0.8);
      S.missFlash = Math.max(0, S.missFlash - dt * 1.2);
      S.shake = Math.max(0, S.shake - dt * 2);
    } else {
      const t = S.ambient;
      S.songTime = 0;
      S.level = 0.15 + Math.sin(t * 0.55) * 0.03;
      S.bassP = 0.05 + Math.sin(t * 0.8) * 0.025;
      S.midP = 0.06 + Math.sin(t * 0.47 + 1) * 0.025;
      S.highP = 0.04 + Math.sin(t * 0.66 + 2) * 0.02;
      S.beatPulse = 0.03 + 0.02 * Math.sin(t * 2);
      S.downPulse = 0.02;
      updatePulses(dt);
      updateParticles(dt);
      updateRings(dt);
      updatePopups(dt);
      updateBanner(dt);
      S.missFlash = Math.max(0, S.missFlash - dt * 1.5);
      S.flash = Math.max(0, S.flash - dt * 1.5);
      S.shake = Math.max(0, S.shake - dt * 2);
    }
  }

  function updateEnv(t) {
    if (!S.chart) return;
    const lv = audio.getLevels();
    const e0 = envAt(0, t), e1 = envAt(1, t), e2 = envAt(2, t), e3 = envAt(3, t);
    S.bassP = clamp(e0 * 0.78 + lv.bass * 0.34, 0, 1);
    S.midP = clamp(e1 * 0.7 + e2 * 0.2 + lv.mid * 0.3, 0, 1);
    S.highP = clamp(e3 * 0.76 + lv.high * 0.34, 0, 1);
    S.level = clamp((e0 * 0.34 + e1 * 0.3 + e2 * 0.2 + e3 * 0.16) * 0.78 + lv.all * 0.28, 0, 1);
  }

  function updateSections(t) {
    const idx = sectionAt(t);
    if (idx < 0) return;
    if (idx !== S.sectionIndex) {
      S.sectionIndex = idx;
      S.section = S.chart.sections[idx];
      setTintTarget(S.section && S.section.tag);
      if (!S.leadActive) {
        announce(S.section, idx === 0);
        S.flash = Math.max(S.flash, 0.16);
        S.punch = Math.max(S.punch, 0.6);
        S.shake = Math.max(S.shake, 0.16);
      }
    }
  }

  function updateBeat(t) {
    const beat = (S.chart && S.chart.beat) || 0.5;
    const phase = ((t / beat) % 1 + 1) % 1;
    S.beatPulse = Math.pow(1 - phase, 2.2);
    const barPhase = ((t / (beat * 4)) % 1 + 1) % 1;
    S.downPulse = Math.pow(1 - barPhase, 2.5);
  }

  function updateNotes(t) {
    if (S.leadActive) return;
    for (let i = 0; i < S.notes.length; i++) {
      const n = S.notes[i];
      if (n.judged) continue;
      if (t > n.t + MISS_GRACE) {
        n.judged = true;
        registerMiss(n);
      }
    }
  }

  function updateFever(dt) {
    if (S.fever > 0) {
      S.fever = Math.max(0, S.fever - dt);
      S.flow = 100 * (S.fever / FEVER_TIME);
    } else {
      S.flow = Math.max(0, S.flow - dt * 1.15);
    }
  }

  function updatePulses(dt) {
    for (let i = 0; i < 4; i++) {
      S.lanePulse[i] = Math.max(0, S.lanePulse[i] - dt * 4.8);
    }
    S.flash = Math.max(0, S.flash - dt * 1.8);
    S.missFlash = Math.max(0, S.missFlash - dt * 2.0);
    S.shake = Math.max(0, S.shake - dt * 6.2);
  }

  function updateParticles(dt) {
    const arr = S.particles;
    for (let i = arr.length - 1; i >= 0; i--) {
      const p = arr[i];
      p.life -= dt;
      if (p.life <= 0) { arr.splice(i, 1); continue; }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.992;
      p.vy *= 0.992;
      if (p.y > Art.H + 40 || p.x < -60 || p.x > Art.W + 60) arr.splice(i, 1);
    }
    if (arr.length > 440) arr.splice(0, arr.length - 440);
  }

  function updateRings(dt) {
    const arr = S.rings;
    for (let i = arr.length - 1; i >= 0; i--) {
      const r = arr[i];
      r.life -= dt;
      if (r.life <= 0) { arr.splice(i, 1); continue; }
      r.r += (r.maxR - r.r) * Math.min(1, dt * 8);
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
    if (S.banner.dur > 0) S.banner.age += dt;
  }

  // ---------------------------------------------------------------- render
  function visibleNotes(t) {
    const out = [];
    const travel = Art.TRAVEL;
    for (let i = 0; i < S.notes.length; i++) {
      const n = S.notes[i];
      if (n.judged) continue;
      const dn = n.t - t;
      if (dn < -0.28 || dn > travel + 0.4) continue;
      out.push(n);
    }
    return out;
  }

  function artState() {
    const playing = S.phase === 'playing' || S.phase === 'paused';
    return {
      t: playing || S.phase === 'end' ? S.songTime : S.ambient,
      level: S.level,
      bassP: S.bassP,
      midP: S.midP,
      highP: S.highP,
      beatPulse: S.beatPulse,
      downPulse: S.downPulse,
      beat: (S.chart && S.chart.beat) || 0.5,
      section: S.section,
      notes: playing ? visibleNotes(S.songTime) : [],
      particles: S.particles,
      rings: S.rings,
      flash: S.flash,
      fade: S.fade,
      missFlash: S.missFlash,
      fever: S.fever / FEVER_TIME,
      shake: S.shake,
      punch: S.punch,
      tint: S.tint,
      lanePulse: S.lanePulse,
      laneKeys: LANE_KEYS,
      songTime: S.songTime
    };
  }

  function setFont(size) {
    ctx.font = Math.round(size) + 'px Tiny5, "Courier New", monospace';
  }

  function hudText(str, x, y, size, color, align, alpha, shadow) {
    ctx.save();
    ctx.globalAlpha = alpha === undefined ? 1 : alpha;
    setFont(size);
    ctx.textAlign = align || 'left';
    ctx.textBaseline = 'middle';
    if (shadow !== false) {
      ctx.fillStyle = 'rgba(0,0,0,0.72)';
      ctx.fillText(str, x + Math.max(1, size * 0.05), y + Math.max(1, size * 0.05));
    }
    ctx.fillStyle = color;
    ctx.fillText(str, x, y);
    ctx.restore();
  }

  function drawProgress(ui, margin, top) {
    const w = Art.W - margin * 2;
    const y = top + ui * 0.25;
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.fillRect(margin, y, w, Math.max(2, ui * 0.08));
    const total = (S.chart && (S.chart.playableEnd || S.chart.duration)) || 1;
    const prog = S.phase === 'playing' || S.phase === 'paused' ? clamp(S.songTime / total, 0, 1) : 0;
    const g = ctx.createLinearGradient(margin, 0, margin + w, 0);
    g.addColorStop(0, Art.theme.accent2);
    g.addColorStop(1, Art.theme.sun);
    ctx.fillStyle = g;
    ctx.fillRect(margin, y, w * prog, Math.max(2, ui * 0.08));
    ctx.fillStyle = Art.theme.sun;
    ctx.fillRect(margin + w * prog - 2, y - ui * 0.12, 4, ui * 0.32);
    if (S.chart && S.chart.sections) {
      for (const sec of S.chart.sections) {
        const x = margin + w * (sec.t0 / total);
        ctx.fillStyle = 'rgba(255,255,255,0.22)';
        ctx.fillRect(Math.round(x), y + ui * 0.2, 1, ui * 0.16);
      }
    }
  }

  function drawFlow(ui, margin, y) {
    const theme = Art.theme;
    const w = Art.W - margin * 2;
    const h = Math.max(8, ui * 0.34);
    const fill = clamp(S.flow / 100, 0, 1);
    ctx.fillStyle = 'rgba(255,255,255,0.09)';
    ctx.fillRect(margin, y, w, h);
    const g = ctx.createLinearGradient(margin, 0, margin + w, 0);
    if (S.fever > 0) {
      g.addColorStop(0, theme.accent2);
      g.addColorStop(0.5, theme.sun);
      g.addColorStop(1, theme.accent);
    } else {
      g.addColorStop(0, theme.accent);
      g.addColorStop(1, theme.sun);
    }
    ctx.fillStyle = g;
    ctx.fillRect(margin, y, w * fill, h);
    ctx.fillStyle = 'rgba(255,255,255,0.16)';
    for (let i = 1; i < 24; i++) {
      ctx.fillRect(margin + (w / 24) * i, y, 1, h);
    }
    const label = S.fever > 0
      ? t('hud.feverBadge') + ' · ' + S.fever.toFixed(1) + t('hud.seconds')
      : t('hud.flow');
    hudText(label, margin, y - ui * 0.55, ui * 0.62, S.fever > 0 ? theme.sun : theme.fog, 'left', 0.95);
    hudText(Math.round(S.flow) + '%', margin + w, y - ui * 0.55, ui * 0.62, theme.fog, 'right', 0.95);
  }

  function drawBanner(ui) {
    const b = S.banner;
    if (!b || b.dur <= 0 || b.age > b.dur) return;
    const a = clamp(Math.min((b.age + 0.25) * 2.2, (b.dur - b.age) * 1.4), 0, 1);
    if (a <= 0.01) return;
    const theme = Art.theme;
    const y = S.safeTop + ui * (Art.portrait ? 4.75 : 4.2);
    hudText(b.num, Art.W / 2, y - ui * 0.78, ui * 0.62, theme.accent, 'center', a * 0.9);
    hudText(sectionName(S.section), Art.W / 2, y, ui * 0.92, '#f4f7fb', 'center', a);
    hudText(sectionSub(S.section), Art.W / 2, y + ui * 0.78, ui * 0.6, theme.fog, 'center', a * 0.92);
    ctx.save();
    ctx.globalAlpha = a * 0.3;
    ctx.fillStyle = theme.accent;
    ctx.fillRect(Art.W / 2 - ui * 3.6, y + ui * 1.22, ui * 7.2, 1);
    ctx.restore();
  }

  function drawCountdown(ui) {
    if (!S.leadActive) return;
    const remain = Math.max(0, -S.songTime);
    const n = Math.max(1, Math.ceil(remain));
    const theme = Art.theme;
    const cy = Art.H * (Art.portrait ? 0.36 : 0.38);
    ctx.save();
    ctx.globalAlpha = 0.18;
    ctx.fillStyle = theme.accent;
    ctx.beginPath();
    ctx.arc(Art.W / 2, cy, ui * 4.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    hudText(String(n), Art.W / 2, cy, ui * 6.4, theme.sun, 'center', 1);
    hudText(t('hud.ready'), Art.W / 2, cy + ui * 4.2, ui * 0.82, theme.fog, 'center', 0.95);
    if (S.track) {
      hudText(S.track.title, Art.W / 2, cy + ui * 5.3, ui * 1.2, '#f4f7fb', 'center', 0.9);
      hudText(S.album ? S.album.title : '', Art.W / 2, cy + ui * 6.2, ui * 0.7, theme.accent, 'center', 0.85);
    }
  }

  function drawPopups(ui) {
    for (const p of S.popups) {
      if (p.life <= 0) continue;
      const a = clamp(p.life / p.maxLife, 0, 1);
      hudText(p.text, p.x, p.y, ui * 0.78 * (p.size || 1), p.color, 'center', a);
    }
  }

  function drawHud() {
    const theme = Art.theme;
    const ui = clamp(Math.min(Art.W, Art.H) / 27, 14, 34);
    const top = S.safeTop + ui * 0.4;
    const margin = Math.max(14, ui * 0.95);

    const scrim = ctx.createLinearGradient(0, 0, 0, top + ui * 4.6);
    scrim.addColorStop(0, 'rgba(3,5,9,0.82)');
    scrim.addColorStop(1, 'rgba(3,5,9,0)');
    ctx.fillStyle = scrim;
    ctx.fillRect(0, 0, Art.W, top + ui * 4.6);

    drawProgress(ui, margin, top);

    const labelY = top + ui * 1.18;
    const valueY = labelY + ui * 1.02;
    const bpm = S.chart && Number.isFinite(S.chart.bpm)
      ? Math.round(S.chart.bpm)
      : (S.track && Number.isFinite(S.track.bpm) ? Math.round(S.track.bpm) : null);
    hudText(t('hud.score') + (bpm ? ' · ' + bpm + ' BPM' : ''), margin, labelY, ui * 0.66, theme.fog, 'left', 1);
    hudText(fmtScore(S.score), margin, valueY, ui * 1.65, '#f4f7fb', 'left', 1);

    hudText(t('hud.accuracy'), Art.W - margin, labelY, ui * 0.66, theme.fog, 'right', 1);
    hudText(liveAccuracy().toFixed(1) + '%', Art.W - margin, valueY, ui * 1.2, '#f4f7fb', 'right', 1);

    if (S.combo > 0) {
      hudText(t('hud.combo'), Art.W / 2, labelY, ui * 0.62, theme.accent, 'center', 0.95);
      hudText(String(S.combo), Art.W / 2, valueY, ui * 1.45, theme.accent, 'center', 1);
      if (S.fever > 0) {
        hudText('×2', Art.W / 2 + ui * 1.55, valueY + ui * 0.12, ui * 0.72, theme.sun, 'left', 0.95);
      }
    } else if (S.fever > 0) {
      hudText(t('hud.fever'), Art.W / 2, labelY, ui * 0.62, theme.sun, 'center', 0.95);
      hudText(S.fever.toFixed(1), Art.W / 2, valueY, ui * 1.45, theme.sun, 'center', 1);
    }

    drawFlow(ui, margin, top + ui * 3.75);
    if (!S.leadActive) drawBanner(ui);
    else drawCountdown(ui);

    drawPopups(ui);

    if (S.missFlash > 0.001) {
      const edge = Math.min(Art.W, Art.H) * 0.14;
      const g = ctx.createRadialGradient(
        Art.W / 2, Art.H / 2, Math.min(Art.W, Art.H) * 0.3,
        Art.W / 2, Art.H / 2, Math.max(Art.W, Art.H) * 0.75
      );
      g.addColorStop(0, 'rgba(255,40,70,0)');
      g.addColorStop(1, 'rgba(255,40,70,' + (S.missFlash * 0.28).toFixed(3) + ')');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, Art.W, Art.H);
      void edge;
    }
    if (S.fever > 0) {
      const a = 0.25 + 0.15 * Math.sin(S.ambient * 7);
      ctx.strokeStyle = Art.rgba(theme.sun, a);
      ctx.lineWidth = Math.max(2, ui * 0.12);
      ctx.strokeRect(ctx.lineWidth / 2, ctx.lineWidth / 2, Art.W - ctx.lineWidth, Art.H - ctx.lineWidth);
    }
  }

  function drawFrame(now) {
    raf = requestAnimationFrame(drawFrame);
    if (!lastFrame) lastFrame = now;
    let dt = (now - lastFrame) / 1000;
    lastFrame = now;
    if (!Number.isFinite(dt)) dt = 0;
    dt = clamp(dt, 0, 0.05);

    try {
      update(dt);
      Art.drawWorld(ctx, artState());
      if (S.phase === 'playing' || S.phase === 'paused' || S.phase === 'end') {
        // HUD stays behind pause/end overlays but is visible during the run.
        if (S.phase === 'playing') drawHud();
      }
    } catch (e) {
      console.error(e);
    }
  }

  // ---------------------------------------------------------------- resize
  function readSafeTop() {
    let probe = $('safe-probe');
    if (!probe) {
      probe = document.createElement('div');
      probe.id = 'safe-probe';
      probe.style.cssText = 'position:fixed;top:0;left:0;width:1px;height:env(safe-area-inset-top,0px);pointer-events:none;visibility:hidden;';
      document.body.appendChild(probe);
    }
    S.safeTop = probe.getBoundingClientRect().height || 0;
  }

  function resize() {
    const w = Math.max(280, window.innerWidth || 360);
    const h = Math.max(280, window.innerHeight || 640);
    const dpr = Math.min(2.5, Math.max(1, window.devicePixelRatio || 1));
    S.dpr = dpr;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = true;
    readSafeTop();
    Art.resize(w, h, dpr);
    if (S.album) previewTheme();
  }

  function queueResize() {
    if (resizeQueued) return;
    resizeQueued = true;
    requestAnimationFrame(function () {
      resizeQueued = false;
      resize();
    });
  }

  // ----------------------------------------------------------------- input
  function laneFromX(clientX) {
    const x = clientX;
    if (x < Art.LANE_X[0] - Art.laneGap * 0.85 || x > Art.LANE_X[3] + Art.laneGap * 0.85) return -1;
    let best = 0, bd = 1e9;
    for (let i = 0; i < 4; i++) {
      const d = Math.abs(x - Art.LANE_X[i]);
      if (d < bd) { bd = d; best = i; }
    }
    return best;
  }

  function adjustOffset(delta) {
    S.settings.offsetMs = clamp(S.settings.offsetMs + delta, -250, 250);
    audio.setOffsetMs(S.settings.offsetMs);
    saveSettings();
    updateSettingsUi();
    showToast(t('toast.offset', {
      value: (S.settings.offsetMs > 0 ? '+' : '') + S.settings.offsetMs,
      unit: t('common.ms')
    }));
  }

  function adjustVolume(delta) {
    S.settings.volume = clamp(Math.round((S.settings.volume + delta) * 10) / 10, 0, 1);
    audio.setVolume(S.settings.volume);
    saveSettings();
    updateSettingsUi();
    showToast(t('toast.volume', { value: Math.round(S.settings.volume * 100) }));
  }

  function toggleSfx() {
    S.settings.sfx = !S.settings.sfx;
    audio.sfxOn = S.settings.sfx;
    saveSettings();
    updateSettingsUi();
    showToast(t('toast.sfx', { state: S.settings.sfx ? t('common.on') : t('common.off') }));
  }

  function updateSettingsUi() {
    const off = $('off-value');
    const vol = $('vol-value');
    const sfx = $('btn-sfx');
    if (off) off.textContent = t('pause.offsetValue', {
      value: (S.settings.offsetMs > 0 ? '+' : '') + S.settings.offsetMs,
      unit: t('common.ms')
    });
    if (vol) vol.textContent = Math.round(S.settings.volume * 100) + '%';
    if (sfx) sfx.textContent = t('pause.sfx', {
      state: S.settings.sfx ? t('common.on') : t('common.off')
    });
  }

  function wireUi() {
    $('btn-enter').addEventListener('click', function () { ensureAudioUnlocked(); openCatalog(); });
    $('btn-back').addEventListener('click', toMenu);
    $('btn-menu').addEventListener('click', toMenu);
    $('btn-play').addEventListener('click', function () {
      ensureAudioUnlocked();
      beginSelectedTrack();
    });
    $('btn-pause').addEventListener('click', pauseGame);
    $('btn-resume').addEventListener('click', resumeGame);
    $('btn-restart').addEventListener('click', restartGame);
    $('btn-quit').addEventListener('click', quitToCatalog);
    $('btn-retry').addEventListener('click', restartGame);
    $('btn-next').addEventListener('click', function () { nextTrack(); });
    $('btn-catalog').addEventListener('click', quitToCatalog);
    $('btn-err-back').addEventListener('click', quitToCatalog);

    const albumsBtn = $('btn-albums');
    if (albumsBtn) albumsBtn.addEventListener('click', openAlbumSheet);
    const albumClose = $('btn-album-close');
    if (albumClose) albumClose.addEventListener('click', closeAlbumSheet);
    const sheet = $('album-sheet');
    if (sheet) {
      sheet.addEventListener('click', function (e) {
        const target = e.target;
        if (target === sheet || (target.closest && target.closest('[data-close-drawer]'))) {
          closeAlbumSheet();
        }
      });
    }
    document.querySelectorAll('[data-lang]').forEach(function (btn) {
      btn.addEventListener('click', function () { setLanguage(btn.dataset.lang); });
    });

    const searchInput = $('search-input');
    if (searchInput) {
      searchInput.addEventListener('input', function () { setSearchQuery(searchInput.value); });
      searchInput.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') {
          e.preventDefault();
          clearSearch();
          searchInput.blur();
          return;
        }
        if (e.key === 'Enter') {
          e.preventDefault();
          playSearchSelection();
          return;
        }
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          moveSearchSelection(1);
          return;
        }
        if (e.key === 'ArrowUp') {
          e.preventDefault();
          moveSearchSelection(-1);
          return;
        }
      });
    }
    const searchClear = $('search-clear');
    if (searchClear) {
      searchClear.addEventListener('click', function () {
        clearSearch();
        focusSearch();
      });
    }

    $('btn-ready').addEventListener('click', async function () {
      hideScreens();
      setPhase('playing');
      showPauseButton(true);
      await startAudioForRun();
    });
    $('off-minus').addEventListener('click', function () { adjustOffset(-5); });
    $('off-plus').addEventListener('click', function () { adjustOffset(5); });
    $('vol-minus').addEventListener('click', function () { adjustVolume(-0.1); });
    $('vol-plus').addEventListener('click', function () { adjustVolume(0.1); });
    $('btn-sfx').addEventListener('click', toggleSfx);

    canvas.addEventListener('pointerdown', function (e) {
      if (S.phase !== 'playing') return;
      const lane = laneFromX(e.clientX);
      if (lane < 0) return;
      e.preventDefault();
      judge(lane);
    }, { passive: false });

    canvas.addEventListener('contextmenu', function (e) { e.preventDefault(); });

    window.addEventListener('pointerdown', function () {
      ensureAudioUnlocked();
    }, { once: true });

    window.addEventListener('keydown', function (e) {
      if (e.repeat) return;
      const code = e.code;
      const target = e.target;
      const typing = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);
      if (typing && target !== $('search-input')) return;

      if (['Space', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Enter'].indexOf(code) >= 0) {
        e.preventDefault();
      }

      if (code === 'KeyL' && !typing) {
        setLanguage(S.settings.lang === 'ru' ? 'en' : 'ru');
        return;
      }
      if (S.phase === 'select' && !typing && (code === 'Slash' || (code === 'KeyF' && (e.ctrlKey || e.metaKey)))) {
        e.preventDefault();
        focusSearch();
        return;
      }

      if (S.phase === 'menu') {
        if (code === 'Space' || code === 'Enter' || code === 'NumpadEnter') {
          ensureAudioUnlocked(); openCatalog(); return;
        }
      } else if (S.phase === 'select') {
        const sheetEl = $('album-sheet');
        const sheetOpen = sheetEl && sheetEl.classList.contains('open');
        if (sheetOpen) {
          if (code === 'Escape') { closeAlbumSheet(); return; }
          if (code === 'ArrowDown') { selectAlbum(S.albumIndex + 1, 0); return; }
          if (code === 'ArrowUp') { selectAlbum(S.albumIndex - 1, 0); return; }
          if (code === 'Enter' || code === 'NumpadEnter' || code === 'Space') {
            closeAlbumSheet(); return;
          }
          if (code === 'KeyB') { closeAlbumSheet(); return; }
          return;
        }
        if (typing) {
          return;
        }
        if (code === 'KeyB') { openAlbumSheet(); return; }
        if (S.searchActive) {
          if (code === 'Escape') { clearSearch(); return; }
          if (code === 'ArrowDown') { moveSearchSelection(1); return; }
          if (code === 'ArrowUp') { moveSearchSelection(-1); return; }
          if (code === 'Enter' || code === 'NumpadEnter' || code === 'Space') {
            playSearchSelection(); return;
          }
        }
        if (code === 'ArrowDown') { selectTrack(S.trackIndex + 1); return; }
        if (code === 'ArrowUp') { selectTrack(S.trackIndex - 1); return; }
        if (code === 'ArrowRight') { selectAlbum(S.albumIndex + 1, 0); return; }
        if (code === 'ArrowLeft') { selectAlbum(S.albumIndex - 1, 0); return; }
        if (code === 'Enter' || code === 'NumpadEnter' || code === 'Space') {
          ensureAudioUnlocked(); beginSelectedTrack(); return;
        }
        if (code === 'Escape') { toMenu(); return; }
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
        if (code === 'Escape' || code === 'Space' || code === 'Enter' || code === 'NumpadEnter') { resumeGame(); return; }
        if (code === 'KeyR') { restartGame(); return; }
        if (code === 'BracketLeft') { adjustOffset(-5); return; }
        if (code === 'BracketRight') { adjustOffset(5); return; }
        if (code === 'Minus' || code === 'NumpadSubtract') { adjustVolume(-0.1); return; }
        if (code === 'Equal' || code === 'NumpadAdd') { adjustVolume(0.1); return; }
        if (code === 'KeyM') { toggleSfx(); return; }
      } else if (S.phase === 'ready') {
        if (code === 'Space' || code === 'Enter' || code === 'NumpadEnter') {
          $('btn-ready').click(); return;
        }
        if (code === 'Escape') { quitToCatalog(); return; }
      } else if (S.phase === 'end') {
        if (code === 'KeyR') { restartGame(); return; }
        if (code === 'Enter' || code === 'NumpadEnter' || code === 'Space') { nextTrack(); return; }
        if (code === 'Escape') { quitToCatalog(); return; }
      } else if (S.phase === 'error') {
        if (code === 'Escape' || code === 'Enter') { quitToCatalog(); }
      }
    });

    window.addEventListener('resize', queueResize);
    window.addEventListener('orientationchange', function () { setTimeout(queueResize, 180); });
    window.addEventListener('blur', function () {
      if (S.phase === 'playing') pauseGame();
    });
    document.addEventListener('visibilitychange', function () {
      if (document.hidden && S.phase === 'playing') pauseGame();
    });
  }

  // ------------------------------------------------------------------ init
  function init() {
    loadStore();
    if (I18N) I18N.setLang(S.settings.lang);
    resize();
    setupMenu();
    initialSelection();
    updateSettingsUi();
    wireUi();
    refreshLanguageUi();
    setPhase('menu');
    showScreen('screen-menu');
    showPauseButton(false);
    previewTheme();
    if (document.fonts && document.fonts.load) {
      document.fonts.load('16px Tiny5').catch(function () {});
    }
    lastFrame = 0;
    raf = requestAnimationFrame(drawFrame);

    const boot = $('boot');
    const bootBar = $('boot-bar');
    if (bootBar) bootBar.style.width = '100%';
    setTimeout(function () {
      if (boot) boot.classList.add('gone');
    }, 420);

    window.RhythmDebug = {
      state: S, audio: audio, catalog: CAT, art: Art, themes: Themes,
      startTrack: startTrack, judge: judge, endGame: endGame, pauseGame: pauseGame,
      selectAlbum: selectAlbum, selectTrack: selectTrack, nextTrack: nextTrack,
      resize: resize, openCatalog: openCatalog
    };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
