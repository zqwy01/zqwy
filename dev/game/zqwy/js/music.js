/* Музыкальный модуль: отдельный плеер с волной, перемоткой,
   громкостью и скоростью воспроизведения. */
(function () {
  'use strict';

  const ZQ = window.ZQ;
  const C = ZQ.C;
  const rt = ZQ.rt;
  const dom = ZQ.dom;

  function tr(text) {
    return window.ZQI18N && typeof window.ZQI18N.tr === 'function'
      ? window.ZQI18N.tr(text)
      : text;
  }

  function availableTracks() {
    const tracks = (C.music && C.music.tracks) || {};
    const available = new Set(
      rt.state && Array.isArray(rt.state.cassettes)
        ? rt.state.cassettes
        : Object.keys(tracks)
    );
    const result = [];
    for (const id of Object.keys(tracks)) {
      if (!available.has(id)) continue;
      result.push({ id, ...tracks[id] });
    }
    return result;
  }

  function trackAlbums() {
    const groups = new Map();
    for (const track of availableTracks()) {
      const cassetteId = track.cassette || 'cassette_other';
      if (!groups.has(cassetteId)) {
        const item = C.items && C.items[cassetteId];
        const title = item
          ? item.name.replace(/^Кассета · /, '')
          : (track.cassetteTitle || cassetteId).replace(/^кассета · /i, '');
        groups.set(cassetteId, { id: cassetteId, title, tracks: [] });
      }
      groups.get(cassetteId).tracks.push(track);
    }
    return Array.from(groups.values()).sort((a, b) =>
      a.title.localeCompare(b.title, 'ru')
    );
  }

  function currentAlbumId(albums) {
    const audio = ZQ.audio;
    const trackId = audio && audio.trackId;
    const track = trackId && C.music && C.music.tracks
      ? C.music.tracks[trackId]
      : null;
    const cassette = track && track.cassette;
    if (cassette && albums.some((album) => album.id === cassette)) return cassette;
    return albums.length ? albums[0].id : '';
  }

  function fillSelect(select, entries, value) {
    if (!select) return;
    select.textContent = '';
    for (const entry of entries) {
      const option = document.createElement('option');
      option.value = entry.value;
      option.textContent = entry.label;
      if (entry.value === value) option.selected = true;
      select.appendChild(option);
    }
  }

  function renderMusicLibrary(force) {
    if (!dom.musicAlbum) return;
    const albums = trackAlbums();
    if (dom.musicLibraryCount) dom.musicLibraryCount.textContent = String(albums.length);
    const albumId = force && dom.musicAlbum.value
      ? dom.musicAlbum.value
      : currentAlbumId(albums);
    fillSelect(
      dom.musicAlbum,
      albums.map((album) => ({
        value: album.id,
        label: `${album.title} · ${album.tracks.length}`
      })),
      albumId
    );
    const album = albums.find((entry) => entry.id === albumId);
    const audio = ZQ.audio;
    const activeTrack = audio && audio.trackId;
    const trackId = album && album.tracks.some((track) => track.id === activeTrack)
      ? activeTrack
      : (album && album.tracks[0] ? album.tracks[0].id : '');
    fillSelect(
      dom.musicTrack,
      (album ? album.tracks : []).map((track) => ({
        value: track.id,
        label: track.title
      })),
      trackId
    );
  }

  function syncMusicLibrary() {
    if (!dom.musicTrack) return;
    const audio = ZQ.audio;
    const trackId = audio && audio.trackId;
    const track = trackId && C.music && C.music.tracks
      ? C.music.tracks[trackId]
      : null;
    if (track && track.cassette && document.activeElement !== dom.musicAlbum &&
        dom.musicAlbum.value !== track.cassette) {
      renderMusicLibrary(true);
      return;
    }
    if (track && document.activeElement !== dom.musicTrack &&
        dom.musicTrack.value !== track.id) {
      dom.musicTrack.value = track.id;
    }
  }

  function playSelectedTrack(trackId) {
    if (!trackId || !ZQ.audio || typeof ZQ.audio.playCassette !== 'function') return;
    ZQ.audio.playCassette(trackId);
    if (typeof ZQ.updateMusicUI === 'function') ZQ.updateMusicUI();
    tick();
  }

  /* --------------------------- Очередь ----------------------------- */

  let queueSignature = null;

  function renderMusicQueue() {
    const audio = ZQ.audio;
    const entries = audio && typeof audio.queue === 'function' ? audio.queue() : [];
    if (dom.musicQueueCount) dom.musicQueueCount.textContent = String(entries.length);
    if (dom.musicQueueList) {
      dom.musicQueueList.textContent = '';
      entries.forEach((entry, index) => {
        const row = document.createElement('div');
        row.className = 'music-queue-item';
        const number = document.createElement('span');
        number.className = 'music-queue-index';
        number.textContent = String(index + 1);
        const title = document.createElement('span');
        title.className = 'music-queue-title';
        title.textContent = entry.title;
        const remove = document.createElement('button');
        remove.type = 'button';
        remove.className = 'ghost-btn music-queue-remove';
        remove.dataset.queueIndex = String(index);
        remove.title = tr('убрать из очереди');
        remove.setAttribute('aria-label', tr('убрать из очереди'));
        remove.textContent = '\u00d7';
        row.append(number, title, remove);
        dom.musicQueueList.appendChild(row);
      });
    }
    if (dom.musicQueueEmpty) {
      dom.musicQueueEmpty.classList.toggle('hidden', entries.length > 0);
    }
    if (dom.musicQueuePlay) dom.musicQueuePlay.disabled = !entries.length;
    if (dom.musicQueueClear) dom.musicQueueClear.disabled = !entries.length;
    if (dom.musicQueueNext) {
      dom.musicQueueNext.disabled = !entries.length && !(audio && audio.queueMode);
    }
    queueSignature = entries.map((entry) => entry.id).join('|');
  }

  function syncMusicQueue() {
    const audio = ZQ.audio;
    const entries = audio && typeof audio.queue === 'function' ? audio.queue() : [];
    const signature = entries.map((entry) => entry.id).join('|');
    if (signature !== queueSignature) renderMusicQueue();
  }

  function selectedTrackId() {
    if (dom.musicTrack && dom.musicTrack.value) return dom.musicTrack.value;
    return ZQ.audio ? ZQ.audio.trackId : '';
  }

  if (dom.musicQueueAdd) {
    dom.musicQueueAdd.addEventListener('click', () => {
      const audio = ZQ.audio;
      const trackId = selectedTrackId();
      if (!audio || typeof audio.queueAdd !== 'function' || !trackId) return;
      const result = audio.queueAdd(trackId);
      renderMusicQueue();
      if (ZQ.appendLog) {
        const title = result.track ? result.track.title : trackId;
        if (result.ok) {
          ZQ.appendLog(`Кассета «${title}» поставлена в очередь.`, 'sys', true);
        } else if (result.reason === 'queued') {
          ZQ.appendLog(`Кассета «${title}» уже стоит в очереди.`, 'sys', true);
        }
      }
    });
  }

  if (dom.musicQueuePlay) {
    dom.musicQueuePlay.addEventListener('click', () => {
      if (!ZQ.audio || typeof ZQ.audio.startQueue !== 'function') return;
      if (ZQ.audio.startQueue()) {
        if (ZQ.appendLog) ZQ.appendLog('Очередь кассет играет.', 'sys', true);
        tick();
      } else {
        renderMusicQueue();
      }
    });
  }

  if (dom.musicQueueNext) {
    dom.musicQueueNext.addEventListener('click', () => {
      if (!ZQ.audio || typeof ZQ.audio.nextQueued !== 'function') return;
      ZQ.audio.nextQueued();
      tick();
    });
  }

  if (dom.musicQueueClear) {
    dom.musicQueueClear.addEventListener('click', () => {
      if (!ZQ.audio || typeof ZQ.audio.queueClear !== 'function') return;
      ZQ.audio.queueClear();
      renderMusicQueue();
      if (ZQ.appendLog) ZQ.appendLog('Очередь кассет очищена.', 'sys', true);
    });
  }

  if (dom.musicQueueList) {
    dom.musicQueueList.addEventListener('click', (event) => {
      const button = event.target.closest('[data-queue-index]');
      if (!button || !ZQ.audio || typeof ZQ.audio.queueRemove !== 'function') return;
      ZQ.audio.queueRemove(Number(button.dataset.queueIndex));
      renderMusicQueue();
    });
  }

  if (dom.musicAlbum) {
    dom.musicAlbum.addEventListener('change', () => {
      renderMusicLibrary(true);
      const trackId = dom.musicTrack ? dom.musicTrack.value : '';
      playSelectedTrack(trackId);
    });
  }
  if (dom.musicTrack) {
    dom.musicTrack.addEventListener('change', () => {
      playSelectedTrack(dom.musicTrack.value);
    });
  }

  function openMusic() {
    if (typeof ZQ.isTrialBlocking === 'function' && ZQ.isTrialBlocking()) return;
    if (typeof ZQ.ensureTerminalShare === 'function') ZQ.ensureTerminalShare(0.5);
    if (typeof ZQ.applyTermSettings === 'function') ZQ.applyTermSettings(false);
    ZQ.setTerminalView('music');
    renderMusicLibrary(true);
    renderMusicQueue();
    ZQ.updateMusicUI();
    if (ZQ.audio && typeof ZQ.audio.decodePeaks === 'function') ZQ.audio.decodePeaks();
    drawWave();
    if (ZQ.logEvent) ZQ.logEvent('terminal', 'открыт музыкальный плеер', 'терминал');
  }

  function closeMusic() {
    ZQ.setTerminalView('main');
    ZQ.updatePrompt();
    if (ZQ.logEvent) ZQ.logEvent('terminal', 'закрыт музыкальный плеер', 'терминал');
  }

  function drawWave() {
    const canvas = dom.musicWave;
    if (!canvas || !canvas.getContext) return;
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
    const width = Math.round(rect.width * dpr);
    const height = Math.round(rect.height * dpr);
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, width, height);

    const audio = ZQ.audio;
    const bars = audio && typeof audio.waveform === 'function'
      ? audio.waveform(72)
      : [];
    const progress = audio && typeof audio.progress === 'function'
      ? audio.progress()
      : 0;
    if (!bars.length) return;

    const gap = 2 * dpr;
    const barWidth = Math.max(1, (width - gap * (bars.length - 1)) / bars.length);
    const middle = height / 2;
    for (let i = 0; i < bars.length; i += 1) {
      const x = i * (barWidth + gap);
      const amplitude = Math.max(0.05, bars[i]);
      const barHeight = Math.max(2 * dpr, amplitude * (height * 0.86));
      const played = (i + 0.5) / bars.length <= progress;
      ctx.fillStyle = played
        ? 'rgba(229, 161, 104, 0.94)'
        : 'rgba(158, 164, 151, 0.3)';
      ctx.fillRect(x, middle - barHeight / 2, barWidth, barHeight);
    }

    /* Центральная линия и маркер перемотки: видно, где именно
       находится игрок на всём треке. */
    ctx.fillStyle = 'rgba(196, 204, 193, 0.16)';
    ctx.fillRect(0, Math.round(middle), width, Math.max(1, dpr));
    ctx.fillStyle = 'rgba(255, 226, 190, 0.9)';
    const lineX = Math.round(progress * width);
    ctx.fillRect(lineX, 0, Math.max(1, dpr * 1.5), height);
  }

  function seekFromPointer(event) {
    const canvas = dom.musicWave;
    const audio = ZQ.audio;
    if (!canvas || !audio || typeof audio.seekFraction !== 'function') return;
    const rect = canvas.getBoundingClientRect();
    if (!rect.width) return;
    const fraction = (event.clientX - rect.left) / rect.width;
    if (audio.seekFraction(fraction)) {
      if (typeof ZQ.updateMusicUI === 'function') ZQ.updateMusicUI();
      drawWave();
    }
  }

  if (dom.musicWave) {
    let seeking = false;
    dom.musicWave.addEventListener('pointerdown', (event) => {
      if (event.button !== undefined && event.button !== 0) return;
      event.preventDefault();
      seeking = true;
      try {
        dom.musicWave.setPointerCapture(event.pointerId);
      } catch (error) {
        /* необязательный захват указателя */
      }
      seekFromPointer(event);
    });
    dom.musicWave.addEventListener('pointermove', (event) => {
      if (seeking) seekFromPointer(event);
    });
    const endSeek = (event) => {
      if (!seeking) return;
      seeking = false;
      try {
        dom.musicWave.releasePointerCapture(event.pointerId);
      } catch (error) {
        /* необязательный захват указателя */
      }
    };
    dom.musicWave.addEventListener('pointerup', endSeek);
    dom.musicWave.addEventListener('pointercancel', endSeek);
  }

  function tick() {
    if (rt.termView !== 'music') return;
    syncMusicLibrary();
    syncMusicQueue();
    if (typeof ZQ.updateMusicUI === 'function') ZQ.updateMusicUI();
    drawWave();
  }

  window.setInterval(tick, 120);

  window.addEventListener('resize', () => {
    if (rt.termView === 'music') {
      window.requestAnimationFrame(drawWave);
    }
  });

  if (dom.musicClose) dom.musicClose.addEventListener('click', closeMusic);
  if (dom.musicBack) dom.musicBack.addEventListener('click', () => ZQ.openSettings());
  if (dom.openMusic) dom.openMusic.addEventListener('click', openMusic);

  if (dom.musicRate) {
    dom.musicRate.addEventListener('input', () => {
      if (typeof ZQ.setMusicRate === 'function') {
        ZQ.setMusicRate(Number(dom.musicRate.value) / 100);
      }
      tick();
    });
  }

  if (dom.musicView) {
    dom.musicView.addEventListener('click', (event) => {
      const preset = event.target.closest('[data-rate]');
      if (preset && typeof ZQ.setMusicRate === 'function') {
        ZQ.setMusicRate(Number(preset.dataset.rate) / 100);
        tick();
        return;
      }
      const algorithm = event.target.closest('[data-algorithm]');
      if (algorithm && typeof ZQ.setMusicAlgorithm === 'function') {
        ZQ.setMusicAlgorithm(algorithm.dataset.algorithm);
        const meta = (C.music.rateAlgorithms || []).find((entry) =>
          entry.id === algorithm.dataset.algorithm
        );
        if (dom.musicAlgorithmCurrent && meta) {
          dom.musicAlgorithmCurrent.textContent = tr(meta.title);
        }
        if (ZQ.appendLog) {
          ZQ.appendLog(
            `Алгоритм скорости: «${meta ? tr(meta.title) : algorithm.dataset.algorithm}».`,
            'reply',
            true
          );
        }
        tick();
      }
    });
  }

  if (dom.musicAlgorithmPresets) {
    const active = rt.termSettings.musicAlgorithm;
    const meta = (C.music.rateAlgorithms || []).find((entry) => entry.id === active);
    if (dom.musicAlgorithmCurrent && meta) {
      dom.musicAlgorithmCurrent.textContent = tr(meta.title);
    }
    dom.musicAlgorithmPresets.querySelectorAll('[data-algorithm]').forEach((button) => {
      button.classList.toggle('active', button.dataset.algorithm === active);
    });
  }

  for (const deck of [dom.soundtrack, dom.soundtrackB]) {
    if (!deck) continue;
    for (const eventName of ['timeupdate', 'play', 'pause', 'loadedmetadata', 'ratechange', 'ended']) {
      deck.addEventListener(eventName, tick);
    }
  }

  ZQ.openMusic = openMusic;
  ZQ.closeMusic = closeMusic;
  ZQ.drawMusicWave = drawWave;
  ZQ.renderMusicLibrary = renderMusicLibrary;
  ZQ.renderMusicQueue = renderMusicQueue;
})();
