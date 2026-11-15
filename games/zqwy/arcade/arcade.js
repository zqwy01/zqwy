/* Аркадный автомат Лабиринта.
   zqwy-сторона: находит кассеты игрока, сопоставляет их дорожки с чартами
   rhythm_catalog и встраивает сам ритм-каталог в терминал через iframe.
   Сам ритм-каталог остаётся самостоятельной игрой и ничего не знает о zqwy,
   кроме необязательного режима ?embed=zqwy. */
(function () {
  'use strict';

  const ZQ = window.ZQ;
  const C = ZQ.C;
  const rt = ZQ.rt;

  const CATALOG_URL = '../rhythm_catalog/data/catalog.json';
  const EMBED_URL = '../rhythm_catalog/index.html?embed=zqwy';
  const BEST_KEY = 'rhythmCatalog.bests.v1';

  const $ = (id) => document.getElementById(id);

  let catalog = null;
  let catalogPromise = null;
  let catalogError = '';
  let frameReady = false;
  let pending = null;
  let current = null;
  let audioWasPlaying = false;

  function lang() {
    const value = window.ZQI18N && window.ZQI18N.lang;
    return value === 'ru' || value === 'de' ? value : 'en';
  }

  function t(ru, en, de) {
    const value = lang();
    if (value === 'ru') return ru;
    if (value === 'de') return de || en;
    return en;
  }

  function toyLang() {
    return lang() === 'ru' ? 'ru' : 'en';
  }

  /* ------------------------------------------------------------ catalog */
  function stripSource(path) {
    const value = String(path || '');
    const marker = 'src/tracks/';
    const at = value.indexOf(marker);
    if (at >= 0) return value.slice(at + marker.length);
    return value.replace(/^\.\.\/\.\.\//, '');
  }

  function ensureCatalog() {
    if (catalog) return Promise.resolve(catalog);
    if (catalogPromise) return catalogPromise;
    catalogPromise = fetch(CATALOG_URL, { cache: 'force-cache' })
      .then((res) => {
        if (!res.ok) throw new Error(String(res.status));
        return res.json();
      })
      .then((data) => {
        catalog = data && Array.isArray(data.albums) ? data : { albums: [] };
        catalogError = '';
        return catalog;
      })
      .catch((error) => {
        catalogError = String((error && error.message) || error);
        return null;
      });
    return catalogPromise;
  }

  function chartIndex() {
    const index = new Map();
    if (!catalog) return index;
    for (const album of catalog.albums || []) {
      for (const track of album.tracks || []) {
        const source = stripSource(track.path);
        if (source) index.set(source, { album, track });
      }
    }
    return index;
  }

  function readBests() {
    try {
      const raw = window.localStorage.getItem(BEST_KEY);
      const data = JSON.parse(raw || '{}');
      return data && typeof data === 'object' ? data : {};
    } catch (error) {
      return {};
    }
  }

  function fmtScore(value) {
    return String(Math.max(0, Math.round(Number(value) || 0))).padStart(6, '0');
  }

  function ownedGroups() {
    const tracks = (C.music && C.music.tracks) || {};
    const owned = new Set(
      rt.state && Array.isArray(rt.state.cassettes) ? rt.state.cassettes : []
    );
    const groups = new Map();

    for (const id of Object.keys(tracks)) {
      if (!owned.has(id)) continue;
      const track = tracks[id] || {};
      const cassetteId = track.cassette || 'cassette_other';
      if (!groups.has(cassetteId)) {
        const item = C.items && C.items[cassetteId];
        groups.set(cassetteId, {
          id: cassetteId,
          albumId: track.album || '',
          title: item && item.name ? item.name : (track.cassetteTitle || cassetteId),
          tracks: []
        });
      }
      groups.get(cassetteId).tracks.push(Object.assign({ id }, track));
    }

    const index = chartIndex();
    const bests = readBests();
    const result = [];

    for (const group of groups.values()) {
      const playable = [];
      for (const track of group.tracks) {
        const hit = track.source ? index.get(track.source) : null;
        if (!hit) continue;
        playable.push({
          zqwyId: track.id,
          id: hit.track.id,
          title: hit.track.title || track.title || hit.track.id,
          albumId: hit.album.id,
          albumTitle: hit.album.title || hit.album.id,
          bpm: hit.track.bpm,
          difficulty: hit.track.difficulty,
          duration: hit.track.duration,
          best: bests[hit.track.id] || null
        });
      }
      if (!playable.length) continue;
      playable.sort((a, b) => String(a.title).localeCompare(String(b.title)));
      result.push(Object.assign({}, group, { tracks: playable }));
    }

    result.sort((a, b) => String(a.title).localeCompare(String(b.title)));
    return result;
  }

  /* -------------------------------------------------------------- picker */
  function renderPicker() {
    const root = $('arcade-cassettes');
    if (!root) return;
    root.textContent = '';

    if (!catalog) {
      const empty = $('arcade-empty');
      if (empty) {
        empty.classList.remove('hidden');
        empty.textContent = t(
          'Ритм-каталог не найден рядом с zqwy. Автомат молчит.',
          'The rhythm catalog was not found next to zqwy. The cabinet is silent.',
          'Der Rhythmus-Katalog wurde neben zqwy nicht gefunden. Der Automat schweigt.'
        );
      }
      const count = $('arcade-count');
      if (count) count.textContent = '';
      return;
    }

    const groups = ownedGroups();
    const totalTracks = groups.reduce((sum, group) => sum + group.tracks.length, 0);
    const count = $('arcade-count');
    if (count) {
      count.textContent = t(
        `${groups.length} кассет · ${totalTracks} дорожек`,
        `${groups.length} cassettes · ${totalTracks} tracks`,
        `${groups.length} Kassetten · ${totalTracks} Spuren`
      );
    }

    const empty = $('arcade-empty');
    if (!groups.length) {
      if (empty) {
        empty.classList.remove('hidden');
        empty.textContent = t(
          'В коллекции нет кассет с готовыми чартами. Ищи музыку в комнатах Лабиринта.',
          'No cassette in the collection has a playable chart yet. Find music in the rooms of the Labyrinth.',
          'Keine Kassette der Sammlung hat eine spielbare Chart. Finde Musik in den Räumen des Labyrinths.'
        );
      }
      return;
    }
    if (empty) empty.classList.add('hidden');

    const saved = rt.state && rt.state.arcade ? rt.state.arcade : {};
    for (const group of groups) {
      const box = document.createElement('details');
      box.className = 'arcade-cassette';
      if (saved.cassette === group.id) box.open = true;

      const summary = document.createElement('summary');
      summary.className = 'arcade-cassette-head';
      const name = document.createElement('span');
      name.className = 'arcade-cassette-title';
      name.textContent = group.title;
      const meta = document.createElement('span');
      meta.className = 'arcade-cassette-meta';
      meta.textContent = t(
        `${group.tracks.length} дорожек`,
        `${group.tracks.length} tracks`,
        `${group.tracks.length} Spuren`
      );
      summary.appendChild(name);
      summary.appendChild(meta);
      box.appendChild(summary);

      const list = document.createElement('div');
      list.className = 'arcade-tracks';
      for (const track of group.tracks) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'arcade-track';
        if (current && current.track === track.id) button.classList.add('active');

        const title = document.createElement('span');
        title.className = 'arcade-track-title';
        title.textContent = track.title;

        const info = document.createElement('span');
        info.className = 'arcade-track-meta';
        const bits = [];
        if (Number.isFinite(track.bpm)) bits.push(`${track.bpm} BPM`);
        if (Number.isFinite(track.difficulty)) bits.push(`${track.difficulty}/10`);
        if (track.best && Number.isFinite(track.best.score)) {
          bits.push(t('рекорд', 'best', 'Rekord') + ' ' + fmtScore(track.best.score));
        }
        info.textContent = bits.join(' · ');

        button.appendChild(title);
        button.appendChild(info);
        button.addEventListener('click', () => playTrack(group, track));
        list.appendChild(button);
      }
      box.appendChild(list);
      root.appendChild(box);
    }
  }

  /* --------------------------------------------------------------- frame */
  function ensureFrame() {
    const frame = $('arcade-frame');
    if (!frame) return null;
    if (frame.dataset.loaded !== '1') {
      frame.dataset.loaded = '1';
      frame.src = EMBED_URL;
    }
    return frame;
  }

  function postToFrame(payload) {
    const frame = $('arcade-frame');
    if (!frame || !frame.contentWindow) return;
    try {
      frame.contentWindow.postMessage(
        Object.assign({ source: 'zqwy-arcade', lang: toyLang() }, payload || {}),
        '*'
      );
    } catch (error) {
      /* iframe может быть ещё не готов */
    }
  }

  function sendStart(request) {
    if (!request) return;
    postToFrame({ type: 'start', album: request.album, track: request.track });
    /* Кадр same-origin: забираем фокус, чтобы D F J K и стрелки сразу
       попадали в ритм-каталог, а не в поле команды терминала. */
    const frame = $('arcade-frame');
    if (frame && typeof frame.focus === 'function') frame.focus();
  }

  function showScreen() {
    const picker = $('arcade-picker');
    const screen = $('arcade-screen-wrap');
    if (picker) picker.classList.add('hidden');
    if (screen) screen.classList.remove('hidden');
  }

  function showPicker() {
    const picker = $('arcade-picker');
    const screen = $('arcade-screen-wrap');
    if (picker) picker.classList.remove('hidden');
    if (screen) screen.classList.add('hidden');
  }

  function updateNowPlaying(track) {
    const label = $('arcade-now-label');
    const title = $('arcade-now-track');
    if (label) {
      const album = (track && track.albumTitle) || (current && current.albumTitle) || '';
      label.textContent = album ? album.toUpperCase() : t('АРКАДА', 'ARCADE', 'ARKADE');
    }
    if (title) {
      title.textContent = (track && track.title) || (current && current.trackTitle) || '';
    }
  }

  function playTrack(group, track) {
    ensureFrame();
    pending = { album: track.albumId, track: track.id };
    current = {
      cassette: group.id,
      cassetteTitle: group.title,
      album: track.albumId,
      albumTitle: track.albumTitle,
      track: track.id,
      trackTitle: track.title,
      zqwyId: track.zqwyId
    };
    showScreen();
    updateNowPlaying({
      albumTitle: track.albumTitle,
      title: track.title
    });
    saveArcadeState({});
    if (frameReady) {
      sendStart(pending);
      pending = null;
    }
    if (typeof ZQ.logEvent === 'function') {
      ZQ.logEvent('actions', t(
        `аркада: запуск «${track.title}»`,
        `arcade: started “${track.title}”`,
        `Arkade: „${track.title}“ gestartet`
      ), t('аркада', 'arcade', 'Arkade'));
    }
  }

  function saveArcadeState(extra) {
    if (!rt.state) return;
    const prev = rt.state.arcade && typeof rt.state.arcade === 'object'
      ? rt.state.arcade
      : {};
    const next = {
      cassette: current ? current.cassette : (prev.cassette || null),
      album: current ? current.album : (prev.album || null),
      track: current ? current.track : (prev.track || null),
      plays: Number.isFinite(prev.plays) ? prev.plays : 0,
      last: prev.last || null
    };
    if (extra && Number.isFinite(extra.plays)) next.plays = extra.plays;
    if (extra && Object.prototype.hasOwnProperty.call(extra, 'last')) next.last = extra.last;
    if (extra && extra.cassette) next.cassette = extra.cassette;
    if (extra && extra.album) next.album = extra.album;
    if (extra && extra.track) next.track = extra.track;
    rt.state.arcade = next;
    if (typeof ZQ.saveGame === 'function') ZQ.saveGame();
  }

  function resultText(data) {
    const score = Math.round(Number(data.score) || 0);
    const acc = (Number(data.acc) || 0).toFixed(1);
    const rank = data.rankName || data.rank || '';
    const line = t(
      `Аркада · «${data.trackTitle || ''}»: ${score} очков, ${acc}%, ранг «${rank}».`,
      `Arcade · “${data.trackTitle || ''}”: ${score} points, ${acc}%, rank “${rank}”.`,
      `Arkade · „${data.trackTitle || ''}“: ${score} Punkte, ${acc} %, Rang „${rank}“.`
    );
    if (!data.newBest) return line;
    return line + ' ' + t('Новый рекорд.', 'New best.', 'Neuer Rekord.');
  }

  function onResult(data) {
    const prev = rt.state && rt.state.arcade ? rt.state.arcade : {};
    const plays = (Number.isFinite(prev.plays) ? prev.plays : 0) + 1;
    const cassette = (current && current.cassette) || prev.cassette || null;
    saveArcadeState({
      plays,
      cassette,
      album: data.album,
      track: data.track,
      last: {
        track: data.track,
        album: data.album,
        title: data.trackTitle || '',
        score: Number(data.score) || 0,
        acc: Number(data.acc) || 0,
        rank: data.rank || '',
        rankName: data.rankName || '',
        at: Date.now()
      }
    });
    const text = resultText(data);
    if (typeof ZQ.appendLog === 'function') ZQ.appendLog(text, 'reply');
    if (typeof ZQ.logEvent === 'function') {
      ZQ.logEvent('actions', text, t('аркада', 'arcade', 'Arkade'));
    }
    renderPicker();
  }

  function onError(data) {
    const text = t(
      `Аркада: дорожка не открылась${data && data.message ? ` (${data.message})` : ''}.`,
      `Arcade: the track did not open${data && data.message ? ` (${data.message})` : ''}.`,
      `Arkade: Die Spur wurde nicht geöffnet${data && data.message ? ` (${data.message})` : ''}.`
    );
    if (typeof ZQ.appendLog === 'function') ZQ.appendLog(text, 'sys', true);
    if (typeof ZQ.logEvent === 'function') {
      ZQ.logEvent('actions', text, t('аркада', 'arcade', 'Arkade'));
    }
  }

  function onTrack(data) {
    if (!current) return;
    if (data.track) current.track = data.track;
    if (data.album) current.album = data.album;
    if (data.albumTitle) current.albumTitle = data.albumTitle;
    if (data.trackTitle) current.trackTitle = data.trackTitle;
    updateNowPlaying({ albumTitle: current.albumTitle, title: current.trackTitle });
    saveArcadeState({});
  }

  function eject(silent) {
    postToFrame({ type: 'stop' });
    pending = null;
    current = null;
    showPicker();
    renderPicker();
    if (!silent && typeof ZQ.logEvent === 'function') {
      ZQ.logEvent('actions', t(
        'аркада: кассета извлечена',
        'arcade: cassette ejected',
        'Arkade: Kassette ausgeworfen'
      ), t('аркада', 'arcade', 'Arkade'));
    }
  }

  window.addEventListener('message', (event) => {
    const frame = $('arcade-frame');
    if (!frame || event.source !== frame.contentWindow) return;
    const data = event.data;
    if (!data || typeof data !== 'object' || data.source !== 'rhythm-catalog') return;
    if (data.type === 'ready') {
      frameReady = true;
      if (pending) {
        sendStart(pending);
        pending = null;
      }
      return;
    }
    if (data.type === 'track') {
      onTrack(data);
      return;
    }
    if (data.type === 'result') {
      onResult(data);
      return;
    }
    if (data.type === 'error') {
      onError(data);
      return;
    }
    if (data.type === 'exit') {
      eject(true);
    }
  });

  /* --------------------------------------------------------------- audio */
  function pauseLabyrinth() {
    const audio = ZQ.audio;
    if (!audio || typeof audio.state !== 'function') return;
    const state = audio.state();
    audioWasPlaying = Boolean(state && state.playing && state.enabled);
    if (audioWasPlaying && typeof audio.pause === 'function') audio.pause();
  }

  function resumeLabyrinth() {
    const audio = ZQ.audio;
    if (!audioWasPlaying || !audio || typeof audio.play !== 'function') {
      audioWasPlaying = false;
      return;
    }
    audioWasPlaying = false;
    audio.play();
  }

  /* ------------------------------------------------------------ lifecycle */
  function openArcade() {
    if (typeof ZQ.isTrialBlocking === 'function' && ZQ.isTrialBlocking()) return false;
    if (typeof ZQ.ensureTerminalShare === 'function') ZQ.ensureTerminalShare(0.7);
    if (typeof ZQ.applyTermSettings === 'function') ZQ.applyTermSettings(false);
    pauseLabyrinth();
    ZQ.setTerminalView('arcade');
    showPicker();
    current = null;
    pending = null;
    if (frameReady) postToFrame({ type: 'stop' });
    renderPicker();
    ensureCatalog().then(() => {
      if (rt.termView !== 'arcade') return;
      renderPicker();
    });
    if (typeof ZQ.logEvent === 'function') {
      ZQ.logEvent('terminal', t(
        'открыт аркадный автомат',
        'arcade cabinet opened',
        'Arkade geöffnet'
      ), t('терминал', 'terminal', 'Terminal'));
    }
    return true;
  }

  function closeArcade() {
    eject(true);
    ZQ.setTerminalView('main');
    if (typeof ZQ.updatePrompt === 'function') ZQ.updatePrompt();
    resumeLabyrinth();
    if (typeof ZQ.logEvent === 'function') {
      ZQ.logEvent('terminal', t(
        'закрыт аркадный автомат',
        'arcade cabinet closed',
        'Arkade geschlossen'
      ), t('терминал', 'terminal', 'Terminal'));
    }
  }

  function refresh() {
    renderPicker();
  }

  function wire() {
    const close = $('arcade-close');
    if (close) close.addEventListener('click', closeArcade);
    const ejectButton = $('arcade-eject');
    if (ejectButton) ejectButton.addEventListener('click', () => eject(false));
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', wire, { once: true });
  } else {
    wire();
  }

  window.addEventListener('zqwy:lang', () => {
    if (catalog && rt.termView === 'arcade') renderPicker();
    if (frameReady) postToFrame({ type: 'lang', lang: toyLang() });
  });

  ZQ.openArcade = openArcade;
  ZQ.closeArcade = closeArcade;
  ZQ.renderArcade = refresh;
  ZQ.arcadeState = () => (rt.state && rt.state.arcade) || null;
})();
