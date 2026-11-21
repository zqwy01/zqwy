/*
 * Universal, persistent music player.
 *
 * Lives outside .page-content, so SPA navigation never destroys it: switching
 * between links, music and any future catalog page keeps playback running.
 * The engine is switchable — native HTML5 audio, WaveSurfer.js, Peaks.js,
 * Howler.js, Waviz, MediaElement.js, AmplitudeJS, APlayer and jPlayer — and all
 * settings are saved site-wide. The audio format (.opus/.mp3/.wav/.flac) is a
 * separate setting. Every engine drives the same <audio> element, so playback,
 * seeking, volume and Media Session stay identical across the site. Track
 * switches fade a temporary copy of the outgoing element through a Web Audio
 * GainNode; the incoming track gets only a 14 ms anti-click ramp so an
 * immediate drop is not softened.
 *
 * Public API (window.zqwyPlayer):
 *   playTrack(album, index, options) · setContext(album) · toggle() · play()
 *   pause() · next(manual) · previous() · stop() · seek(seconds) · getState()
 *   setEngine(name) · setFormat(name) · openSettings() · on(event, handler)
 *   enqueue(album, index) · removeFromQueue(i) · clearQueue() · getQueue()
 */
(() => {
  "use strict";

  // Capture the script's own URL now: after SPA navigation document.baseURI
  // changes, but this absolute URL always points at the site's vendor folder.
  const PLAYER_SCRIPT = document.currentScript;
  const VENDOR_BASE = PLAYER_SCRIPT
    ? new URL("../vendor/", PLAYER_SCRIPT.src).href
    : null;

  const STORAGE_STATE = "zqwy.player.state.v1";
  const STORAGE_SETTINGS = "zqwy.player.settings.v1";
  const STORAGE_ALBUM = "zqwy.player.album.v1";
  const ENGINES = [
    "html5", "wavesurfer", "peaks", "howler", "waviz",
    "mediaelement", "amplitude", "aplayer", "jplayer",
  ];
  const FORMATS = ["opus", "mp3", "wav", "flac"];
  const CROSSFADE_OPTIONS = [200, 400, 700];
  const DEFAULT_CROSSFADE_MS = 400;

  const BAR_HTML = `
<div class="player-bar" id="playerBar" hidden>
  <div class="player-inner">
    <div class="player-now">
      <div class="player-cover">
        <img id="playerCover" alt="" hidden>
        <span class="player-cover-letter" id="playerCoverLetter" aria-hidden="true">♪</span>
      </div>
      <div class="player-text">
        <span class="player-title" id="playerTitle">Ничего не играет</span>
        <span class="player-album" id="playerAlbum"></span>
      </div>
    </div>

    <div class="player-controls">
      <button class="player-btn player-prev" id="playerPrev" type="button" aria-label="Предыдущий трек">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 5h2v14H6zM20 5v14L9 12z"/></svg>
      </button>
      <button class="player-btn player-play" id="playerPlay" type="button" aria-label="Воспроизвести">
        <svg class="icon-play" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>
        <svg class="icon-pause" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 5h4v14H7zM13 5h4v14h-4z"/></svg>
      </button>
      <button class="player-btn player-next" id="playerNext" type="button" aria-label="Следующий трек">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M16 5h2v14h-2zM4 5v14l11-7z"/></svg>
      </button>
    </div>

    <div class="player-seek">
      <span class="player-time" id="playerCurrent">0:00</span>
      <input class="player-range player-progress" id="playerSeek" type="range" min="0" max="1000" step="1" value="0" aria-label="Позиция трека">
      <div class="player-waveform" id="playerWaveform" hidden></div>
      <!-- Libraries that draw their own controls live directly in this row,
           next to the native seek bar / waveform — never in a panel above it. -->
      <div class="player-engine-ui" id="playerEngineUi" hidden>
        <div class="engine-ui-view" data-engine-view="howler" hidden>
          <canvas class="lab-analyser" id="labAnalyser" width="640" height="56" aria-hidden="true"></canvas>
          <span class="lab-analyser-level" id="labAnalyserLevel">0%</span>
        </div>
        <div class="engine-ui-view" data-engine-view="mediaelement" hidden>
          <div class="lab-mediaelement" id="labMediaElement"></div>
        </div>
        <div class="engine-ui-view" data-engine-view="amplitude" hidden>
          <div class="lab-amplitude">
            <span class="lab-amplitude-cover" data-amplitude-song-info="cover_art_url"></span>
            <div class="lab-amplitude-info">
              <span class="lab-amplitude-title" data-amplitude-song-info="name">—</span>
              <span class="lab-amplitude-artist" data-amplitude-song-info="artist">zqwy · AmplitudeJS</span>
            </div>
            <input class="amplitude-song-slider" type="range" min="0" max="100" value="0" aria-label="Позиция (AmplitudeJS)">
            <button class="amplitude-play-pause lab-amplitude-play" type="button" aria-label="Воспроизвести/пауза">▶</button>
            <span class="amplitude-current-time">0:00</span>
            <span class="lab-amplitude-sep">/</span>
            <span class="amplitude-duration-time">0:00</span>
            <input class="amplitude-volume-slider" type="range" min="0" max="100" value="100" aria-label="Громкость (AmplitudeJS)">
          </div>
        </div>
        <div class="engine-ui-view" data-engine-view="aplayer" hidden>
          <div class="lab-aplayer" id="labAPlayer"></div>
        </div>
        <div class="engine-ui-view" data-engine-view="jplayer" hidden>
          <div class="lab-jplayer" id="labJPlayer">
            <div class="jp-jplayer" id="labJPlayerMedia"></div>
            <div id="jp_container_1" class="jp-audio jp-type-single" role="application" aria-label="jPlayer">
              <div class="jp-gui jp-interface">
                <div class="jp-controls">
                  <button class="jp-play" type="button" tabindex="0">play</button>
                  <button class="jp-pause" type="button" tabindex="0">pause</button>
                  <button class="jp-stop" type="button" tabindex="0">stop</button>
                  <button class="jp-mute" type="button" tabindex="0" title="mute">mute</button>
                  <button class="jp-unmute" type="button" tabindex="0" title="unmute">unmute</button>
                </div>
                <div class="jp-progress"><div class="jp-seek-bar"><div class="jp-play-bar"></div></div></div>
                <div class="jp-volume-bar"><div class="jp-volume-bar-value"></div></div>
                <div class="jp-time-holder">
                  <div class="jp-current-time" role="timer" aria-label="time">&nbsp;</div>
                  <div class="jp-duration" role="timer" aria-label="duration">&nbsp;</div>
                </div>
              </div>
              <div class="jp-title" aria-label="title"></div>
            </div>
          </div>
        </div>
      </div>
      <span class="player-time" id="playerDuration">0:00</span>
    </div>

    <div class="player-tools">
    <div class="player-extra">
      <button class="player-btn player-queue-toggle" id="playerQueueToggle" type="button" aria-label="Очередь треков" aria-expanded="false" aria-controls="playerQueuePanel" title="Очередь треков">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h11v2H4zM4 11h11v2H4zM4 16h7v2H4zM17 8l5 4-5 4V8z"/></svg>
        <span class="player-queue-count" id="playerQueueCount" hidden>0</span>
      </button>
      <button class="player-btn player-toggle" id="playerShuffle" type="button" aria-label="Перемешать" aria-pressed="false">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10.6 9.2 5.4 4 4 5.4l5.2 5.2 1.4-1.4zm3.8-5.2 2 2L4.1 18.6 5.5 20 17.9 7.7l2 2V4h-5.5zm-.3 9.4-1.4 1.4 3.1 3.1-3.1 3.1 1.4 1.4 3.1-3.1V20H20v-4h-2.8l-3.1-3.1z"/></svg>
      </button>
      <button class="player-btn player-toggle" id="playerRepeat" type="button" aria-label="Повтор: выключен" aria-pressed="false">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 7h10v3l4-4-4-4v3H5v6h2V7zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2v4z"/></svg>
        <span class="player-repeat-one" aria-hidden="true">1</span>
      </button>
      <button class="player-btn player-mute" id="playerMute" type="button" aria-label="Выключить звук">
        <svg class="icon-volume" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9H4zm12.5 3a4.5 4.5 0 0 1-2.5 4v-8a4.5 4.5 0 0 1 2.5 4z"/></svg>
        <svg class="icon-muted" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9H4zm12.6 1.1 1.4-1.4 4.4 4.4-1.4 1.4-4.4-4.4zm5.8 0-4.4 4.4-1.4-1.4 4.4-4.4 1.4 1.4z"/></svg>
      </button>
      <input class="player-range player-volume" id="playerVolume" type="range" min="0" max="1" step="0.01" value="1" aria-label="Громкость">
      <button class="player-btn player-settings-toggle" id="playerSettingsToggle" type="button" aria-label="Настройки плеера" aria-expanded="false" aria-controls="playerSettings">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19.14 12.94a7.6 7.6 0 0 0 .05-1.88l2.03-1.58a.5.5 0 0 0 .12-.64l-1.92-3.32a.5.5 0 0 0-.6-.22l-2.39.96a7.3 7.3 0 0 0-1.63-.94l-.36-2.54a.5.5 0 0 0-.5-.42h-3.84a.5.5 0 0 0-.5.42l-.36 2.54a7.3 7.3 0 0 0-1.63.94l-2.39-.96a.5.5 0 0 0-.6.22L2.7 8.84a.5.5 0 0 0 .12.64l2.03 1.58a7.6 7.6 0 0 0 0 1.88L2.82 14.5a.5.5 0 0 0-.12.64l1.92 3.32a.5.5 0 0 0 .6.22l2.39-.96a7.3 7.3 0 0 0 1.63.94l.36 2.54a.5.5 0 0 0 .5.42h3.84a.5.5 0 0 0 .5-.42l.36-2.54a7.3 7.3 0 0 0 1.63-.94l2.39.96a.5.5 0 0 0 .6-.22l1.92-3.32a.5.5 0 0 0-.12-.64l-2.03-1.58zM12 15.5a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7z"/></svg>
      </button>
    </div>

    <button class="player-btn player-close" id="playerClose" type="button" aria-label="Остановить и закрыть плеер">
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.4 5 5 6.4 10.6 12 5 17.6 6.4 19l5.6-5.6 5.6 5.6 1.4-1.4L13.4 12 19 6.4 17.6 5 12 10.6z"/></svg>
    </button>
    </div>
  </div>

  <div class="player-settings" id="playerSettings" hidden>
    <div class="player-settings-head">
      <strong>Настройки плеера</strong>
      <button class="player-btn player-settings-close" id="playerSettingsClose" type="button" aria-label="Закрыть настройки">×</button>
    </div>
    <div class="player-settings-mount" data-player-settings-mount></div>
  </div>

  <div class="player-queue" id="playerQueuePanel" hidden>
    <div class="player-queue-head">
      <strong>Очередь треков</strong>
      <div class="player-queue-actions">
        <button type="button" id="playerQueueClear" class="player-queue-text-btn">Очистить</button>
        <button class="player-btn player-queue-close" id="playerQueueClose" type="button" aria-label="Закрыть очередь">×</button>
      </div>
    </div>
    <ol class="player-queue-list" id="playerQueueList"></ol>
    <p class="player-queue-empty" id="playerQueueEmpty">Очередь пуста. Добавьте треки кнопкой «+» в каталоге.</p>
  </div>

  <p class="player-status" id="playerStatus" aria-live="polite"></p>
  <audio id="audio" preload="metadata"></audio>
</div>`;

  if (document.getElementById("playerBar")) return; // already injected
  document.body.insertAdjacentHTML("beforeend", BAR_HTML);

  const $ = (id) => document.getElementById(id);
  const audio = $("audio");
  const bar = $("playerBar");
  const seek = $("playerSeek");
  const waveform = $("playerWaveform");
  const volume = $("playerVolume");
  const settingsPanel = $("playerSettings");
  const settingsToggle = $("playerSettingsToggle");
  const queuePanel = $("playerQueuePanel");
  const queueToggle = $("playerQueueToggle");
  const statusEl = $("playerStatus");
  const engineUi = $("playerEngineUi");

  const listeners = new Map();
  const state = {
    context: null,   // { albumId, title, cover, tracks: [{ title, path }] }
    current: null,   // { albumId, index, title, path, cover }
    time: 0,
    volume: 1,
    muted: false,
    shuffle: false,
    repeat: "off",
    engine: "html5",
    format: "opus",
    autoNext: true,
    rememberPosition: true,
    crossfade: true,          // fade the outgoing track under the incoming one
    crossfadeMs: DEFAULT_CROSSFADE_MS,
    queue: [],   // upcoming tracks added from the music catalog
  };

  let waveSurfer = null;
  let peaks = null;
  let howl = null;
  let waviz = null;
  let mediaElementWrapper = null;
  let aplayer = null;
  let aplayerHost = null;
  let jplayerHost = null;
  let wavizCanvas = null;
  let wavizPlayHandler = null;
  let wavizPauseHandler = null;
  let audioContext = null;
  let mediaSourceNode = null;
  let pendingStart = null;
  let pendingAutoplay = false;
  let saveTimer = 0;
  let hideTimer = 0;
  let settingsTimer = 0;
  let queueTimer = 0;
  let scriptPromise = null;
  let peaksScriptPromise = null;
  let howlerScriptPromise = null;
  let wavizScriptPromise = null;
  let mediaElementScriptPromise = null;
  let amplitudeScriptPromise = null;
  let aplayerScriptPromise = null;
  let jqueryScriptPromise = null;
  let jplayerScriptPromise = null;
  const loadedEngineCss = new Set();
  let labRaf = 0;
  let labNode = null;
  let labGain = null;
  const activeFades = new Set(); // temporary <audio> elements fading out after a track switch
  let incomingFadeToken = 0;     // invalidates an older anti-click ramp on rapid switches

  /* ---------- helpers ---------- */

  function assetUrl(relative) {
    const segments = String(relative).split("/").filter(Boolean);
    return ["..", "..", ...segments]
      .map((part, index) => (index < 2 ? part : encodeURIComponent(part)))
      .join("/");
  }

  function basePrefix() {
    const link = [...document.querySelectorAll('link[rel="stylesheet"]')]
      .find((el) => /styles\/base\.css/.test(el.getAttribute("href") || ""));
    const match = (link?.getAttribute("href") || "").match(/^(.*?)styles\/base\.css/);
    return match ? match[1] : "./";
  }

  function cssVar(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  }

  function formatTime(seconds) {
    if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
    const total = Math.floor(seconds);
    return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
  }

  function setStatus(text) { if (statusEl) statusEl.textContent = text || ""; }

  // WaveSurfer replaces the compact seek bar with a full-width waveform row;
  // marking both the bar and the body lets CSS enlarge the row and the page
  // padding without measuring anything in JS.
  function setWaveMode(on) {
    bar.classList.toggle("has-waveform", on);
    document.body.classList.toggle("has-waveform", on);
  }

  /* ---------- engine-owned UI inside the player ----------
   * MediaElement.js, AmplitudeJS, APlayer and jPlayer render their own controls.
   * Those controls are placed in the same seek row as WaveSurfer's waveform —
   * there is no second floating interface above the main player. Howler has no
   * DOM UI of its own, so its live analyser uses that same slot.
   */

  const ENGINE_UI = new Set(["howler", "mediaelement", "amplitude", "aplayer", "jplayer"]);

  function loadEngineCss(file, key) {
    if (loadedEngineCss.has(key)) return;
    loadedEngineCss.add(key);
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.dataset.engineCss = key;
    link.href = VENDOR_BASE ? `${VENDOR_BASE}${file}` : `${basePrefix()}vendor/${file}`;
    document.head.appendChild(link);
  }

  function showEngineUi(engine) {
    if (!engineUi || !ENGINE_UI.has(engine)) return false;
    if (engine === "aplayer") loadEngineCss("aplayer.min.css", "aplayer");
    else if (engine === "mediaelement") loadEngineCss("mediaelementplayer.min.css", "mediaelement");
    else if (engine === "jplayer") loadEngineCss("jplayer.blue.monday.min.css", "jplayer");

    engineUi.hidden = false;
    engineUi.querySelectorAll("[data-engine-view]").forEach((view) => {
      view.hidden = view.dataset.engineView !== engine;
    });
    seek.hidden = true;
    waveform.hidden = true;
    setWaveMode(true);
    if (engine === "howler") startHowlerAnalyser();
    else stopHowlerAnalyser();
    return true;
  }

  function hideEngineUi() {
    stopHowlerAnalyser();
    if (!engineUi) return;
    engineUi.hidden = true;
    engineUi.querySelectorAll("[data-engine-view]").forEach((view) => { view.hidden = true; });
  }

  function stopHowlerAnalyser() {
    if (labRaf) { window.cancelAnimationFrame(labRaf); labRaf = 0; }
    try { labNode?.disconnect(); } catch {}
    try { labGain?.disconnect(); } catch {}
    labNode = null;
    labGain = null;
  }

  function startHowlerAnalyser() {
    if (labRaf || !$("labAnalyser")) return;
    const context = sharedAudioContext();
    if (!context || !mediaSourceNode) return;
    const canvas = $("labAnalyser");
    const ctx2d = canvas.getContext("2d");
    if (!ctx2d) return;
    const analyser = context.createAnalyser();
    analyser.fftSize = 1024;
    // A unity gain keeps the shared element audible once createMediaElementSource
    // has routed its signal through the AudioContext.
    labGain = context.createGain();
    labGain.gain.value = 1;
    try {
      mediaSourceNode.connect(analyser);
      analyser.connect(labGain);
      labGain.connect(context.destination);
    } catch {}
    labNode = analyser;

    const data = new Uint8Array(analyser.frequencyBinCount);
    const draw = () => {
      labRaf = window.requestAnimationFrame(draw);
      analyser.getByteTimeDomainData(data);
      const width = canvas.width;
      const height = canvas.height;
      ctx2d.fillStyle = cssVar("--bg-elevated-2") || "#141414";
      ctx2d.fillRect(0, 0, width, height);
      ctx2d.lineWidth = 2;
      ctx2d.strokeStyle = cssVar("--text") || "#ffffff";
      ctx2d.beginPath();
      const slice = width / data.length;
      let x = 0;
      let peak = 0;
      for (let i = 0; i < data.length; i++) {
        const value = data[i];
        const y = (value / 128) * (height / 2);
        if (i === 0) ctx2d.moveTo(x, y); else ctx2d.lineTo(x, y);
        peak = Math.max(peak, Math.abs(value - 128));
        x += slice;
      }
      ctx2d.stroke();
      const level = $("labAnalyserLevel");
      if (level) level.textContent = `${Math.round((peak / 128) * 100)}%`;
    };
    draw();
  }

  /* ---------- audio formats ---------- */

  function trackFormats(track) {
    if (!track) return {};
    if (track.formats && typeof track.formats === "object") return track.formats;
    const match = String(track.path || "").match(/\.([^.]+)$/);
    return match ? { [match[1].toLowerCase()]: track.path } : {};
  }

  // The selected format wins, but a missing file never breaks playback: we
  // fall back to the track's canonical path, then to opus, then to whatever
  // version is actually present in the catalog.
  function resolveTrackPath(track) {
    const formats = trackFormats(track);
    if (state.format && formats[state.format]) return formats[state.format];
    return track?.path || formats.opus || Object.values(formats)[0] || "";
  }

  function setFormat(name) {
    if (!FORMATS.includes(name) || name === state.format) return;
    const wasPlaying = !audio.paused;
    const time = audio.currentTime || 0;
    state.format = name;
    syncSettingsUI();
    saveState();
    notify("settings");
    if (!state.current) return;

    const formats = trackFormats(state.current);
    if (!formats[name]) {
      setStatus(`Формат .${name} для этого трека отсутствует — используется доступный.`);
      return;
    }
    setStatus("");
    loadCurrent({ autoplay: wasPlaying, startTime: time });
  }

  function notify(type) {
    const detail = getState();
    listeners.forEach((handler, event) => {
      if (event === type || event === "state") {
        try { handler(detail); } catch {}
      }
    });
    window.dispatchEvent(new CustomEvent("zqwy:playerstate", { detail }));
  }

  /* ---------- upcoming track queue ---------- */

  function queueItem(album, index) {
    const track = album?.tracks?.[index];
    if (!track) return null;
    return {
      albumId: album.id,
      albumTitle: album.title,
      cover: album.cover || null,
      index,
      title: track.title,
      path: track.path,
      formats: track.formats,
      tracks: album.tracks.map((item) => ({
        title: item.title, path: item.path, formats: item.formats,
      })),
    };
  }

  function renderQueue() {
    if (!queuePanel) return;
    const list = $("playerQueueList");
    const empty = $("playerQueueEmpty");
    const count = $("playerQueueCount");
    const total = state.queue.length;
    if (count) {
      count.textContent = String(total);
      count.hidden = total === 0;
    }
    if (empty) empty.hidden = total > 0;
    if (!list) return;
    list.replaceChildren();
    state.queue.forEach((item, index) => {
      const li = document.createElement("li");
      li.className = "player-queue-item";

      const play = document.createElement("button");
      play.type = "button";
      play.className = "player-queue-play";
      play.dataset.queuePlay = String(index);
      play.setAttribute("aria-label", `Играть следующим: ${item.title}`);
      const title = document.createElement("span");
      title.className = "player-queue-title";
      title.textContent = item.title;
      const album = document.createElement("span");
      album.className = "player-queue-album";
      album.textContent = `${index + 1}. ${item.albumTitle || ""}`;
      play.append(title, album);

      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "player-btn player-queue-remove";
      remove.dataset.queueRemove = String(index);
      remove.setAttribute("aria-label", `Убрать из очереди: ${item.title}`);
      remove.textContent = "×";

      li.append(play, remove);
      list.appendChild(li);
    });
  }

  function openQueue() {
    if (!queuePanel) return;
    if (settingsPanel && !settingsPanel.hidden) closeSettings();
    if (queueTimer) { window.clearTimeout(queueTimer); queueTimer = 0; }
    queuePanel.hidden = false;
    queueToggle?.setAttribute("aria-expanded", "true");
    renderQueue();
    void queuePanel.offsetWidth;
    queuePanel.classList.add("is-open");
  }

  function closeQueue() {
    if (!queuePanel || queuePanel.hidden) return;
    queueToggle?.setAttribute("aria-expanded", "false");
    queuePanel.classList.remove("is-open");
    if (queueTimer) window.clearTimeout(queueTimer);
    queueTimer = window.setTimeout(() => {
      if (!queuePanel.classList.contains("is-open")) queuePanel.hidden = true;
      queueTimer = 0;
    }, 260);
  }

  function toggleQueue() {
    queuePanel?.hidden ? openQueue() : closeQueue();
  }

  function enqueue(album, index) {
    const item = queueItem(album, index);
    if (!item) return false;
    state.queue.push(item);
    renderQueue();
    saveState();
    notify("queue");
    return true;
  }

  function removeFromQueue(index) {
    if (!Number.isInteger(index) || index < 0 || index >= state.queue.length) return false;
    state.queue.splice(index, 1);
    renderQueue();
    saveState();
    notify("queue");
    return true;
  }

  function clearQueue() {
    if (!state.queue.length) return;
    state.queue = [];
    renderQueue();
    saveState();
    notify("queue");
  }

  function getQueue() {
    return state.queue.map((item) => ({ ...item }));
  }

  function playQueued(index) {
    const item = state.queue[index];
    if (!item) return;
    const commit = () => {
      state.queue.splice(index, 1);
      state.context = {
        albumId: item.albumId,
        title: item.albumTitle,
        cover: item.cover,
        tracks: item.tracks || [],
      };
      state.current = {
        albumId: item.albumId,
        index: item.index,
        title: item.title,
        path: item.path,
        formats: item.formats,
        cover: item.cover,
      };
      state.time = 0;
      showBar();
      setStatus("");
      renderMetadata();
      loadCurrent({ autoplay: true, startTime: 0, antiClick: true });
      renderQueue();
      saveState();
      notify("queue");
      notify("track");
    };
    beginCrossfade(item, commit);
  }

  function getState() {
    return {
      current: state.current ? { ...state.current } : null,
      context: state.context ? { ...state.context } : null,
      playing: !!(state.current && !audio.paused && !audio.ended),
      time: audio.currentTime || 0,
      duration: Number.isFinite(audio.duration) ? audio.duration : 0,
      volume: state.volume,
      muted: state.muted,
      shuffle: state.shuffle,
      repeat: state.repeat,
      engine: state.engine,
      format: state.format,
      fileFormat: (resolveTrackPath(state.current).match(/\.([^.]+)$/) || [])[1] || null,
      formats: trackFormats(state.current),
      queue: getQueue(),
    };
  }

  /* ---------- persistence ---------- */

  function loadSaved() {
    try {
      const raw = localStorage.getItem(STORAGE_STATE);
      if (raw) return JSON.parse(raw) || {};
      const legacy = localStorage.getItem(STORAGE_SETTINGS);
      return legacy ? JSON.parse(legacy) || {} : {};
    } catch { return {}; }
  }

  function saveState() {
    try {
      const payload = {
        ...state,
        time: state.rememberPosition && state.current ? audio.currentTime || 0 : 0,
      };
      localStorage.setItem(STORAGE_STATE, JSON.stringify(payload));
      localStorage.setItem(STORAGE_SETTINGS, JSON.stringify({
        volume: state.volume, muted: state.muted, shuffle: state.shuffle,
        repeat: state.repeat, engine: state.engine, format: state.format,
        autoNext: state.autoNext, rememberPosition: state.rememberPosition,
        crossfade: state.crossfade, crossfadeMs: state.crossfadeMs,
      }));
      if (state.context?.albumId) localStorage.setItem(STORAGE_ALBUM, state.context.albumId);
    } catch {}
  }

  function saveStateSoon() {
    if (saveTimer) return;
    saveTimer = window.setTimeout(() => { saveTimer = 0; saveState(); }, 1500);
  }

  /* ---------- engine: WaveSurfer ---------- */

  function injectVendorScript(file) {
    return new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = VENDOR_BASE
        ? `${VENDOR_BASE}${file}`
        : `${basePrefix()}vendor/${file}`;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error(`${file} not loaded`));
      document.head.appendChild(script);
    });
  }

  function loadWaveSurferScript() {
    if (window.WaveSurfer) return Promise.resolve();
    if (!scriptPromise) scriptPromise = injectVendorScript("wavesurfer.min.js");
    return scriptPromise;
  }

  function loadPeaksScript() {
    if (window.peaks) return Promise.resolve();
    if (!peaksScriptPromise) peaksScriptPromise = injectVendorScript("peaks.min.js");
    return peaksScriptPromise;
  }

  function loadHowlerScript() {
    if (window.Howl && window.Howler) return Promise.resolve();
    if (!howlerScriptPromise) howlerScriptPromise = injectVendorScript("howler.min.js");
    return howlerScriptPromise;
  }

  function loadWavizScript() {
    if (wavizConstructor()) return Promise.resolve();
    if (!wavizScriptPromise) wavizScriptPromise = injectVendorScript("waviz.min.js");
    return wavizScriptPromise;
  }

  // The UMD build exposes a namespace: window.Waviz.Waviz (also .default).
  function wavizConstructor() {
    const ns = window.Waviz;
    if (typeof ns === "function") return ns;
    return ns && (typeof ns.Waviz === "function" ? ns.Waviz : ns.default);
  }

  function loadMediaElementScript() {
    if (window.MediaElement) return Promise.resolve();
    if (!mediaElementScriptPromise) {
      mediaElementScriptPromise = injectVendorScript("mediaelement-and-player.min.js");
    }
    return mediaElementScriptPromise;
  }

  function loadAmplitudeScript() {
    if (window.Amplitude) return Promise.resolve();
    if (!amplitudeScriptPromise) amplitudeScriptPromise = injectVendorScript("amplitude.min.js");
    return amplitudeScriptPromise;
  }

  function loadAPlayerScript() {
    if (window.APlayer) return Promise.resolve();
    if (!aplayerScriptPromise) aplayerScriptPromise = injectVendorScript("aplayer.min.js");
    return aplayerScriptPromise;
  }

  // jPlayer is a jQuery plugin, and the pinned jQuery 2 build keeps the old
  // .bind()/.unbind() API that jPlayer 2.9.2 was written against.
  function loadJPlayerScript() {
    const ensureJQuery = window.jQuery
      ? Promise.resolve()
      : (jqueryScriptPromise || (jqueryScriptPromise = injectVendorScript("jquery.min.js")));
    return ensureJQuery.then(() => {
      if (window.jQuery?.fn?.jPlayer) return;
      if (!jplayerScriptPromise) jplayerScriptPromise = injectVendorScript("jquery.jplayer.min.js");
      return jplayerScriptPromise;
    });
  }

  function rememberAudioDom() {
    return { parent: audio.parentNode, next: audio.nextSibling };
  }

  // APlayer and jPlayer create their own <audio> with document.createElement.
  // Handing them the shared element keeps one source of truth for playback;
  // the element is moved back into the player bar once the library is built.
  function withSharedAudioElement(factory) {
    const original = document.createElement;
    document.createElement = function (tagName, options) {
      if (String(tagName).toLowerCase() === "audio") return audio;
      return original.call(document, tagName, options);
    };
    try { return factory(); } finally { document.createElement = original; }
  }

  function restoreAudioDom(position) {
    if (!position?.parent) return;
    if (audio.parentNode === position.parent && audio.nextSibling === position.next) return;
    if (position.next && position.next.parentNode === position.parent) {
      position.parent.insertBefore(audio, position.next);
    } else {
      position.parent.appendChild(audio);
    }
  }

  function waveformColors() {
    return {
      waveColor: cssVar("--muted") || "#888888",
      progressColor: cssVar("--text") || "#ffffff",
      cursorColor: cssVar("--text") || "#ffffff",
    };
  }

  function showWaveMode() {
    hideEngineUi();
    waveform.hidden = false;
    seek.hidden = true;
    setWaveMode(true);
  }

  function hideWaveMode() {
    hideEngineUi();
    waveform.hidden = true;
    seek.hidden = false;
    setWaveMode(false);
  }

  // A double click on the WaveSurfer waveform pauses/resumes the same shared
  // <audio> element the rest of the player controls.
  function handleWaveDoubleClick(event) {
    event.preventDefault();
    if (!state.current) return;
    toggle();
  }

  // One AudioContext is shared by Peaks and Waviz. Browsers allow only one
  // MediaElementSource per element per context, so cache the node too.
  function sharedAudioContext() {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return null;
    if (!audioContext) {
      audioContext = new AudioContextClass();
      const createSource = audioContext.createMediaElementSource.bind(audioContext);
      audioContext.createMediaElementSource = (element) => {
        if (element === audio && mediaSourceNode) return mediaSourceNode;
        const node = createSource(element);
        if (element === audio) mediaSourceNode = node;
        return node;
      };
    }
    if (audioContext.state === "suspended") audioContext.resume().catch(() => {});
    return audioContext;
  }

  function destroyHowl() {
    if (!howl) return;
    const sound = howl._sounds && howl._sounds[0];
    if (sound && sound._node === audio) {
      audio.removeEventListener("error", sound._errorFn);
      audio.removeEventListener((window.Howler && window.Howler._canPlayEvent) || "canplaythrough", sound._loadFn);
      audio.removeEventListener("ended", sound._endFn);
    }
    const list = window.Howler && window.Howler._howls;
    const index = list ? list.indexOf(howl) : -1;
    if (index >= 0) list.splice(index, 1);
    howl = null;
  }

  function destroyWaviz() {
    if (wavizPlayHandler) { audio.removeEventListener("play", wavizPlayHandler); wavizPlayHandler = null; }
    if (wavizPauseHandler) { audio.removeEventListener("pause", wavizPauseHandler); wavizPauseHandler = null; }
    if (waviz) {
      try { waviz.stop(); } catch {}
      // Do not call waviz.cleanup(): it would close the shared AudioContext.
      waviz = null;
    }
    wavizCanvas?.remove();
    wavizCanvas = null;
  }

  // Some engines keep native listeners on the shared <audio> even after a
  // switch. Pause them while their engine is still current so they cannot
  // fight the next engine for control of the same element.
  function pauseExternalEngines() {
    if (state.engine === "amplitude" && window.Amplitude) {
      try { window.Amplitude.pause(); } catch {}
      // Detach Amplitude from the shared element; its next init creates a new
      // private Audio internally, so no stale callbacks remain on ours.
      try { window.Amplitude.getConfig().audio = new Audio(); } catch {}
    }
    if (state.engine === "aplayer" && aplayer) {
      try { aplayer.pause(); } catch {}
    }
    if (state.engine === "mediaelement" && mediaElementWrapper) {
      try { mediaElementWrapper.pause(); } catch {}
    }
    if (state.engine === "jplayer" && jplayerHost && window.jQuery) {
      try { window.jQuery($("labJPlayerMedia")).jPlayer("pause"); } catch {}
    }
  }

  function destroyWaveforms() {
    pauseExternalEngines();
    waveform?.removeEventListener("dblclick", handleWaveDoubleClick);
    if (waveSurfer) {
      try { waveSurfer.destroy(); } catch {}
      waveSurfer = null;
    }
    if (peaks) {
      try { peaks.destroy(); } catch {}
      peaks = null;
    }
    destroyHowl();
    destroyWaviz();
    waveform?.replaceChildren();
    hideEngineUi();
  }

  function fallbackToHtml5(message) {
    destroyWaveforms();
    setStatus(message);
    state.engine = "html5";
    hideWaveMode();
    syncSettingsUI();
    saveState();
  }

  async function createWaveSurfer(url, startAt, autoplay) {
    try { await loadWaveSurferScript(); } catch {
      fallbackToHtml5("WaveSurfer.js недоступен — используется HTML5.");
      return false;
    }
    if (!window.WaveSurfer) return false;

    showWaveMode();
    // WaveSurfer has no built-in "double click toggles playback" behaviour.
    waveform.addEventListener("dblclick", handleWaveDoubleClick);
    const colors = waveformColors();

    waveSurfer = window.WaveSurfer.create({
      container: waveform,
      media: audio,
      url,
      height: 56,
      barWidth: 2,
      barGap: 1,
      barRadius: 1,
      normalize: true,
      interact: true,
      dragToSeek: true,
      cursorWidth: 1,
      cursorColor: colors.cursorColor,
      waveColor: colors.waveColor,
      progressColor: colors.progressColor,
    });

    waveSurfer.on("ready", () => {
      if (startAt) setTime(startAt);
      if (autoplay) attemptPlay();
    });
    // WaveSurfer v7 seeks on click/drag itself; mirroring the interaction event
    // onto the shared <audio> guarantees scrubbing with the cursor works even
    // when an external media element is used.
    waveSurfer.on("interaction", (seconds) => {
      if (Number.isFinite(seconds)) setTime(seconds);
    });
    // "ended" on the shared <audio> covers track completion; no need to
    // also handle WaveSurfer's "finish" (that would advance twice).
    waveSurfer.on("error", () => {
      fallbackToHtml5("WaveSurfer не смог прочитать файл — включён HTML5.");
      notify("engine");
    });
    return true;
  }

  async function createPeaks(url, startAt, autoplay) {
    try { await loadPeaksScript(); } catch {
      fallbackToHtml5("Peaks.js недоступен — используется HTML5.");
      notify("engine");
      return false;
    }
    if (!window.peaks) return false;

    const audioContext = sharedAudioContext();
    if (!audioContext) {
      fallbackToHtml5("Web Audio недоступен — используется HTML5.");
      notify("engine");
      return false;
    }

    showWaveMode();
    const surface = document.createElement("div");
    surface.style.width = "100%";
    surface.style.height = "100%";
    waveform.appendChild(surface);

    const colors = waveformColors();
    audio.src = url;
    audio.load();

    peaks = window.peaks.init({
      mediaElement: audio,
      mediaUrl: url,
      webAudio: { audioContext },
      zoomview: {
        container: surface,
        waveformColor: colors.waveColor,
        playedWaveformColor: colors.progressColor,
        playheadColor: colors.cursorColor,
        showAxisLabels: false,
        enablePoints: false,
        enableSegments: false,
      },
    }, (error) => {
      if (error) {
        fallbackToHtml5("Peaks.js не смог прочитать файл — включён HTML5.");
        notify("engine");
        return;
      }
      if (startAt) setTime(startAt);
      if (autoplay) attemptPlay();
    });
    return true;
  }

  /*
   * Howler.js normally manages its own hidden <audio> element. We hand it
   * the player's shared element instead, so playback, seeking, time and
   * Media Session keep working exactly as in the other engines while Howler
   * remains the component issuing play/pause/seek commands.
   */
  async function createHowler(url, startAt, autoplay) {
    try { await loadHowlerScript(); } catch {
      fallbackToHtml5("Howler.js недоступен — используется HTML5.");
      notify("engine");
      return false;
    }
    if (!window.Howl || !window.Howler) return false;

    showEngineUi("howler");
    audio.src = url;
    audio.load();

    const global = window.Howler;
    const obtain = global._obtainHtml5Audio;
    global._obtainHtml5Audio = () => audio;
    try {
      howl = new window.Howl({
        src: [url],
        html5: true,
        preload: true,
        loop: false,
        volume: state.volume,
        muted: state.muted,
      });
    } catch {
      howl = null;
    } finally {
      global._obtainHtml5Audio = obtain;
    }
    if (!howl) {
      fallbackToHtml5("Howler.js не смог создать плеер — включён HTML5.");
      notify("engine");
      return false;
    }

    howl.on("loaderror", () => {
      fallbackToHtml5("Howler.js не смог прочитать файл — включён HTML5.");
      notify("engine");
    });
    howl.once("load", () => {
      if (startAt) setTime(startAt);
      if (autoplay) attemptPlay();
    });
    return true;
  }

  /* Waviz supplies a live Web Audio visualisation drawn on a canvas in the
     waveform row; playback itself uses the same shared <audio> element. */
  async function createWaviz(url, startAt, autoplay) {
    try { await loadWavizScript(); } catch {
      fallbackToHtml5("Waviz недоступен — используется HTML5.");
      notify("engine");
      return false;
    }
    const WavizClass = wavizConstructor();
    if (!WavizClass) return false;

    const context = sharedAudioContext();
    if (!context) {
      fallbackToHtml5("Web Audio недоступен — используется HTML5.");
      notify("engine");
      return false;
    }

    const canvas = document.createElement("canvas");
    canvas.className = "player-waviz-canvas";
    canvas.width = 1024;
    canvas.height = 56;
    canvas.setAttribute("aria-hidden", "true");
    waveform.appendChild(canvas);
    wavizCanvas = canvas;
    showWaveMode();
    audio.src = url;
    audio.load();

    try {
      waviz = new WavizClass(canvas, audio, context);
    } catch {
      wavizCanvas?.remove();
      wavizCanvas = null;
      fallbackToHtml5("Waviz не смог запустить визуализацию — включён HTML5.");
      notify("engine");
      return false;
    }

    wavizPlayHandler = () => {
      if (!waviz) return;
      try { waviz.simpleLine(cssVar("--text") || "#ffffff").catch(() => {}); } catch {}
    };
    wavizPauseHandler = () => {
      try { waviz?.stop(); } catch {}
    };
    audio.addEventListener("play", wavizPlayHandler);
    audio.addEventListener("pause", wavizPauseHandler);

    if (startAt) setTime(startAt);
    if (autoplay) attemptPlay();
    return true;
  }

  /* MediaElement.js wraps the shared element once and then delegates play,
     pause and seeking to its native HTML5 renderer. Its own control bar is
     mounted in the player's seek row — the same place WaveSurfer uses. */
  async function createMediaElement(url, startAt, autoplay) {
    try { await loadMediaElementScript(); } catch {
      fallbackToHtml5("MediaElement.js недоступен — используется HTML5.");
      notify("engine");
      return false;
    }
    if (!window.MediaElement) {
      fallbackToHtml5("MediaElement.js недоступен — используется HTML5.");
      notify("engine");
      return false;
    }

    showEngineUi("mediaelement");
    audio.src = url;
    audio.load();
    if (!mediaElementWrapper) {
      try {
        // MediaElementPlayer builds the recognizable control bar; the plain
        // MediaElement core would only wrap the element without any UI.
        const PlayerClass = window.MediaElementPlayer || window.MediaElement;
        mediaElementWrapper = new PlayerClass(audio, {
          features: ["playpause", "current", "progress", "duration", "volume"],
        });
      } catch {
        mediaElementWrapper = null;
      }
    }
    if (!mediaElementWrapper) {
      fallbackToHtml5("MediaElement.js не смог создать плеер — включён HTML5.");
      notify("engine");
      return false;
    }
    const host = $("labMediaElement");
    const container = mediaElementWrapper.container
      || (audio.parentElement && audio.parentElement !== bar ? audio.parentElement : null);
    if (host && container && host.firstElementChild !== container) host.replaceChildren(container);
    if (startAt) setTime(startAt);
    if (autoplay) attemptPlay();
    return true;
  }

  /* AmplitudeJS keeps its own private Audio for event wiring, but after init
     its config points at the shared element. That lets Amplitude issue the
     play/pause commands without its internal "next song" handlers touching
     our queue. */
  async function createAmplitude(url, startAt, autoplay) {
    try { await loadAmplitudeScript(); } catch {
      fallbackToHtml5("AmplitudeJS недоступен — используется HTML5.");
      notify("engine");
      return false;
    }
    if (!window.Amplitude) {
      fallbackToHtml5("AmplitudeJS недоступен — используется HTML5.");
      notify("engine");
      return false;
    }

    showEngineUi("amplitude");
    try {
      window.Amplitude.init({
        songs: [{ name: state.current?.title || "zqwy", artist: "zqwy", url }],
        continue_next: false,
        volume: Math.round(state.volume * 100),
        debug: false,
      });
      const config = window.Amplitude.getConfig();
      config.audio = audio;
      if (config.songs?.[0]) config.active_metadata = config.songs[0];
    } catch {
      fallbackToHtml5("AmplitudeJS не смог создать плеер — включён HTML5.");
      notify("engine");
      return false;
    }
    audio.src = url;
    audio.load();
    if (startAt) setTime(startAt);
    if (autoplay) attemptPlay();
    return true;
  }

  function engineHost(id) {
    let host = document.getElementById(id);
    if (!host) {
      host = document.createElement("div");
      host.id = id;
      host.setAttribute("aria-hidden", "true");
      host.style.cssText = "position:absolute;left:-99999px;top:0;width:320px;height:120px;visibility:hidden;pointer-events:none;";
      document.body.appendChild(host);
    }
    return host;
  }

  function aplayerTrack(url) {
    return {
      name: state.current?.title || "zqwy",
      artist: "zqwy",
      url,
      cover: state.current?.cover ? assetUrl(state.current.cover) : undefined,
    };
  }

  /* APlayer normally owns a hidden <audio>. Creating it while
     document.createElement('audio') returns our shared element makes APlayer
     the component driving that element instead. */
  async function createAPlayer(url, startAt, autoplay) {
    try { await loadAPlayerScript(); } catch {
      fallbackToHtml5("APlayer недоступен — используется HTML5.");
      notify("engine");
      return false;
    }
    if (!window.APlayer) {
      fallbackToHtml5("APlayer недоступен — используется HTML5.");
      notify("engine");
      return false;
    }

    showEngineUi("aplayer");
    const track = aplayerTrack(url);
    try {
      if (!aplayer) {
        // Render APlayer's own UI in the player's seek row. It still receives
        // the shared <audio> via the createElement shim, so its controls drive
        // the real playback.
        aplayerHost = $("labAPlayer") || engineHost("zqwy-aplayer-host");
        const position = rememberAudioDom();
        aplayer = withSharedAudioElement(() => new window.APlayer({
          container: aplayerHost,
          audio: [track],
          autoplay: false,
          theme: "#ffffff",
          loop: "none",
          order: "none",
          preload: "metadata",
          listFolded: true,
        }));
        restoreAudioDom(position);
      } else {
        aplayer.list.audios = [track];
        aplayer.setAudio(track);
      }
      aplayer.volume(state.volume, true);
    } catch {
      aplayer = null;
      fallbackToHtml5("APlayer не смог создать плеер — включён HTML5.");
      notify("engine");
      return false;
    }
    if (startAt) setTime(startAt);
    if (autoplay) attemptPlay();
    return true;
  }

  /* jPlayer is loaded lazily together with its pinned jQuery dependency. The
     same createElement shim hands it the shared audio element. */
  async function createJPlayer(url, startAt, autoplay) {
    try { await loadJPlayerScript(); } catch {
      fallbackToHtml5("jPlayer недоступен — используется HTML5.");
      notify("engine");
      return false;
    }
    if (!window.jQuery?.fn?.jPlayer) {
      fallbackToHtml5("jPlayer недоступен — используется HTML5.");
      notify("engine");
      return false;
    }

    showEngineUi("jplayer");
    try {
      const media = $("labJPlayerMedia");
      jplayerHost = $("labJPlayer");
      if (media && !media.dataset.jplayerReady) {
        const position = rememberAudioDom();
        withSharedAudioElement(() => {
          window.jQuery(media).jPlayer({
            supplied: "mp3",
            preload: "metadata",
            loop: false,
            cssSelectorAncestor: "#jp_container_1",
            errorAlerts: false,
            warningAlerts: false,
          });
        });
        media.dataset.jplayerReady = "true";
        restoreAudioDom(position);
      }
      window.jQuery(media).jPlayer("setMedia", { mp3: url });
    } catch {
      fallbackToHtml5("jPlayer не смог создать плеер — включён HTML5.");
      notify("engine");
      return false;
    }
    if (startAt) setTime(startAt);
    if (autoplay) attemptPlay();
    return true;
  }

  function loadEngine(url, startAt, autoplay) {
    switch (state.engine) {
      case "wavesurfer": return createWaveSurfer(url, startAt, autoplay);
      case "peaks": return createPeaks(url, startAt, autoplay);
      case "howler": return createHowler(url, startAt, autoplay);
      case "waviz": return createWaviz(url, startAt, autoplay);
      case "mediaelement": return createMediaElement(url, startAt, autoplay);
      case "amplitude": return createAmplitude(url, startAt, autoplay);
      case "aplayer": return createAPlayer(url, startAt, autoplay);
      case "jplayer": return createJPlayer(url, startAt, autoplay);
      default:
        hideWaveMode();
        audio.src = url;
        audio.load();
        if (autoplay) attemptPlay();
        return Promise.resolve(true);
    }
  }

  function setEngine(name) {
    if (!ENGINES.includes(name) || name === state.engine) return;
    const wasPlaying = !audio.paused;
    const time = audio.currentTime || state.time || 0;
    const hadTrack = !!state.current;

    destroyWaveforms();
    state.engine = name;

    const url = hadTrack ? assetUrl(resolveTrackPath(state.current)) : "";
    if (hadTrack) loadEngine(url, time, wasPlaying);
    else hideWaveMode();
    syncSettingsUI();
    saveState();
    notify("engine");
  }

  /* ---------- playback core ---------- */

  function showBar() {
    bar.hidden = false;
    document.body.classList.add("has-player");
    if (hideTimer) { window.clearTimeout(hideTimer); hideTimer = 0; }
    void bar.offsetHeight;
    bar.classList.add("is-visible");
  }

  function hideBar(immediate = false) {
    bar.classList.remove("is-visible");
    const finish = () => {
      bar.hidden = true;
      document.body.classList.remove("has-player");
      hideTimer = 0;
    };
    if (immediate) finish();
    else hideTimer = window.setTimeout(finish, 300);
  }

  function attemptPlay() {
    if (state.engine === "howler" && howl) {
      try { howl.play(); return; } catch {}
    }
    if (state.engine === "amplitude" && window.Amplitude) {
      try { window.Amplitude.play(); return; } catch {}
    }
    if (state.engine === "aplayer" && aplayer) {
      try { aplayer.play(); return; } catch {}
    }
    if (state.engine === "jplayer" && jplayerHost && window.jQuery) {
      try { window.jQuery($("labJPlayerMedia")).jPlayer("play"); return; } catch {}
    }
    let result;
    if (state.engine === "mediaelement" && mediaElementWrapper) {
      try { result = mediaElementWrapper.play(); } catch {}
    }
    if (!result) result = audio.play();
    if (result && typeof result.catch === "function") {
      result.catch(() => setStatus("Нажмите ▶, чтобы начать воспроизведение."));
    }
  }

  function pauseAudio() {
    // A user-initiated pause must silence the fading copy of the previous
    // track too — otherwise it would keep playing until its timer runs out.
    stopFades();
    if (state.engine === "howler" && howl) {
      try { howl.pause(); return; } catch {}
    }
    if (state.engine === "amplitude" && window.Amplitude) {
      try { window.Amplitude.pause(); return; } catch {}
    }
    if (state.engine === "aplayer" && aplayer) {
      try { aplayer.pause(); return; } catch {}
    }
    if (state.engine === "jplayer" && jplayerHost && window.jQuery) {
      try { window.jQuery($("labJPlayerMedia")).jPlayer("pause"); return; } catch {}
    }
    if (state.engine === "mediaelement" && mediaElementWrapper) {
      try { mediaElementWrapper.pause(); return; } catch {}
    }
    audio.pause();
  }

  /* ---------- smooth track switching ----------
   * The outgoing track is copied into a detached <audio> and faded with a Web
   * Audio GainNode: sample-accurate, no stepped "zipper" noise. We wait until
   * that copy is really playing before replacing the shared element's src, so
   * there is no silence gap and no wrong-offset overlap of the old track. The
   * incoming track gets only the 14 ms anti-click ramp from loadCurrent(), so
   * an immediate drop still hits at full level.
   */
  function cleanupFade(fade) {
    if (!fade || fade.done) return;
    fade.done = true;
    if (fade.interval) window.clearInterval(fade.interval);
    if (fade.timeout) window.clearTimeout(fade.timeout);
    if (fade.startTimer) window.clearTimeout(fade.startTimer);
    if (fade.playTimer) window.clearTimeout(fade.playTimer);
    activeFades.delete(fade);
    try { fade.source?.disconnect(); } catch {}
    try { fade.gain?.disconnect(); } catch {}
    fade.source = null;
    fade.gain = null;
    const element = fade.element;
    if (!element) return;
    try { element.pause(); } catch {}
    try { element.removeAttribute("src"); element.load(); } catch {}
  }

  // `commit: false` is used only by stop(), where a pending switch must be
  // discarded instead of starting a new track after the player was closed.
  function stopFades(options = {}) {
    const commit = options.commit !== false;
    for (const fade of [...activeFades]) {
      if (commit && !fade.committed) {
        fade.committed = true;
        fade.commitNow();
      }
      cleanupFade(fade);
    }
  }

  function startFadeAutomation(fade) {
    if (fade.started || fade.done) return;
    fade.started = true;
    fade.startedAt = performance.now();
    const context = sharedAudioContext();
    if (context) {
      try {
        const source = context.createMediaElementSource(fade.element);
        const gain = context.createGain();
        const now = context.currentTime;
        gain.gain.setValueAtTime(1, now);
        gain.gain.linearRampToValueAtTime(0, now + fade.duration / 1000);
        source.connect(gain);
        gain.connect(context.destination);
        fade.source = source;
        fade.gain = gain;
        fade.timeout = window.setTimeout(() => cleanupFade(fade), fade.duration + 250);
        return;
      } catch {}
    }
    // No Web Audio available: ramp element.volume instead of cutting it.
    fade.interval = window.setInterval(() => {
      if (fade.done) return;
      const progress = Math.min(1, (performance.now() - fade.startedAt) / fade.duration);
      fade.element.volume = Math.max(0, fade.from * (1 - progress));
      if (progress >= 1) cleanupFade(fade);
    }, 20);
    fade.timeout = window.setTimeout(() => cleanupFade(fade), fade.duration + 250);
  }

  function beginCrossfade(nextTrack, commit) {
    const proceed = () => { if (typeof commit === "function") commit(); };
    if (!state.crossfade || !state.current || audio.paused || audio.ended) { proceed(); return; }

    const absoluteUrl = (value) => {
      try { return new URL(value, document.baseURI).href; } catch { return value; }
    };
    const fromUrl = absoluteUrl(audio.currentSrc || audio.src || assetUrl(resolveTrackPath(state.current)));
    const toUrl = nextTrack ? absoluteUrl(assetUrl(resolveTrackPath(nextTrack))) : "";
    // Restarting the very same file (deep link / queue edge case) would only
    // create a phasing copy of itself — nothing to smooth there.
    if (!fromUrl || fromUrl === toUrl) { proceed(); return; }
    const fromVolume = audio.muted ? 0 : Math.max(0, Math.min(1, audio.volume));
    if (fromVolume <= 0) { proceed(); return; }
    const fromTime = Number.isFinite(audio.currentTime) ? audio.currentTime : 0;
    const duration = state.crossfadeMs;

    // A rapid next/next chain must not leave several overlapping ghosts.
    stopFades({ commit: true });

    const element = document.createElement("audio");
    element.preload = "auto";
    element.src = fromUrl;
    element.volume = fromVolume; // gain node only shapes 1 → 0 on top of this

    const fade = {
      element,
      source: null,
      gain: null,
      interval: 0,
      timeout: 0,
      startTimer: 0,
      playTimer: 0,
      committed: false,
      started: false,
      startedAt: 0,
      done: false,
      from: fromVolume,
      duration,
      commitNow: null,
    };
    activeFades.add(fade);

    const commitOnce = () => {
      if (fade.committed || fade.done) return;
      fade.committed = true;
      if (fade.startTimer) { window.clearTimeout(fade.startTimer); fade.startTimer = 0; }
      if (fade.playTimer) { window.clearTimeout(fade.playTimer); fade.playTimer = 0; }
      proceed();
    };
    fade.commitNow = commitOnce;

    element.addEventListener("playing", () => {
      if (fade.done) return;
      startFadeAutomation(fade);
      commitOnce();
    }, { once: true });

    const startPlayback = () => {
      if (fade.done) return;
      // Seek only after metadata exists: setting currentTime on a fresh
      // HAVE_NOTHING element is unreliable and can restart the old intro.
      try { element.currentTime = fromTime; } catch {}
      const attempt = element.play();
      if (attempt && typeof attempt.catch === "function") {
        attempt.catch(() => { startFadeAutomation(fade); commitOnce(); });
      }
      // If `playing` never fires, switch anyway instead of freezing the UI.
      fade.playTimer = window.setTimeout(() => {
        startFadeAutomation(fade);
        commitOnce();
      }, 160);
    };

    if (element.readyState >= 1) startPlayback();
    else {
      element.addEventListener("loadedmetadata", startPlayback, { once: true });
      fade.startTimer = window.setTimeout(() => {
        if (fade.committed || fade.done) return;
        fade.committed = true;
        cleanupFade(fade);
        proceed();
      }, 240);
    }
  }

  /* A 14 ms ramp on the incoming track removes the click caused by starting
   * playback on a non-zero sample. It is far too short to soften a drop, but
   * it removes the "обрыв" sound at the exact switch moment. */
  function runIncomingFade(target) {
    const token = ++incomingFadeToken;
    const duration = 14;
    const started = performance.now();
    let frame = 0;
    const finish = () => {
      if (token !== incomingFadeToken) return;
      if (frame) window.cancelAnimationFrame(frame);
      frame = 0;
      audio.volume = target;
    };
    const step = () => {
      if (token !== incomingFadeToken) return;
      const progress = Math.min(1, (performance.now() - started) / duration);
      audio.volume = target * progress;
      if (progress < 1) frame = window.requestAnimationFrame(step);
      else finish();
    };
    frame = window.requestAnimationFrame(step);
    // A hidden tab throttles rAF; never leave the track stuck at low volume.
    window.setTimeout(finish, duration + 150);
  }

  function loadCurrent(options = {}) {
    if (!state.current) return;
    pendingStart = options.startTime || 0;
    pendingAutoplay = options.autoplay !== false;
    // Use the saved volume, not audio.volume: a previous anti-click ramp may
    // still be in progress and would otherwise become the new ramp's target.
    const incomingTarget = options.antiClick && !state.muted && !audio.muted
      ? Math.max(0, Math.min(1, state.volume))
      : 0;
    if (incomingTarget > 0) audio.volume = 0;
    const url = assetUrl(resolveTrackPath(state.current));
    destroyWaveforms();
    loadEngine(url, pendingStart, pendingAutoplay);
    if (incomingTarget > 0) runIncomingFade(incomingTarget);
  }

  function renderMetadata() {
    if (!state.current) return;
    const title = state.current.title || "";
    // Size the text block to the actual name length so the player has as
    // little empty space as possible next to the centred controls.
    const textEl = $("playerTitle").parentElement;
    if (textEl) {
      textEl.style.setProperty("--title-chars", String(Math.min(64, Math.max(8, title.length))));
    }
    $("playerTitle").textContent = title;
    $("playerAlbum").textContent = state.context?.title || "";

    const image = $("playerCover");
    const letter = $("playerCoverLetter");
    if (state.current.cover) {
      image.src = assetUrl(state.current.cover);
      image.hidden = false;
      letter.hidden = true;
    } else {
      image.removeAttribute("src");
      image.hidden = true;
      letter.hidden = false;
      letter.textContent = (state.context?.title || "♪").replace(/^!/, "").charAt(0);
    }

    if ("mediaSession" in navigator && window.MediaMetadata) {
      try {
        navigator.mediaSession.metadata = new MediaMetadata({
          title: state.current.title || "",
          artist: "zqwy",
          album: state.context?.title || "",
          artwork: state.current.cover ? [{ src: assetUrl(state.current.cover), sizes: "512x512" }] : [],
        });
      } catch {}
    }
    updateMediaSessionState();
  }

  function updateMediaSessionState() {
    if (!("mediaSession" in navigator)) return;
    try { navigator.mediaSession.playbackState = audio.paused ? "paused" : "playing"; } catch {}
  }

  function playTrack(album, index, options = {}) {
    if (!album || !album.tracks || !album.tracks[index]) return;
    const track = album.tracks[index];
    const commit = () => {
      state.context = {
        albumId: album.id,
        title: album.title,
        cover: album.cover || null,
        tracks: album.tracks.map((item) => ({ title: item.title, path: item.path, formats: item.formats })),
      };
      state.current = {
        albumId: album.id,
        index,
        title: track.title,
        path: track.path,
        formats: track.formats,
        cover: album.cover || null,
      };
      state.time = 0;
      showBar();
      setStatus("");
      renderMetadata();
      loadCurrent({
        autoplay: options.autoplay !== false,
        startTime: options.startTime || 0,
        antiClick: options.autoplay !== false,
      });
      saveState();
      notify("track");
    };
    if (options.autoplay !== false) beginCrossfade(track, commit);
    else commit();
  }

  function setContext(album) {
    if (!album) return;
    const sameAlbum = state.context && state.context.albumId === album.id;
    if (!sameAlbum) {
      state.context = {
        albumId: album.id,
        title: album.title,
        cover: album.cover || null,
        tracks: album.tracks.map((item) => ({ title: item.title, path: item.path, formats: item.formats })),
      };
      saveState();
    }
  }

  function selectByIndex(index, autoplay = true) {
    const tracks = state.context?.tracks;
    if (!tracks || !tracks.length) return;
    const wrapped = ((index % tracks.length) + tracks.length) % tracks.length;
    const item = tracks[wrapped];
    const commit = () => {
      state.current = {
        albumId: state.context.albumId,
        index: wrapped,
        title: item.title,
        path: item.path,
        formats: item.formats,
        cover: state.context.cover,
      };
      state.time = 0;
      showBar();
      setStatus("");
      renderMetadata();
      loadCurrent({ autoplay, startTime: 0, antiClick: autoplay });
      saveState();
      notify("track");
    };
    if (autoplay) beginCrossfade(item, commit);
    else commit();
  }

  function next(manual = false) {
    // An explicit queue always wins over the album's own order: these are the
    // tracks the visitor deliberately marked as "up next".
    if (state.queue.length) { playQueued(0); return; }
    if (!state.current || !state.context?.tracks?.length) return;
    const length = state.context.tracks.length;
    if (state.shuffle && length > 1) {
      let target = state.current.index;
      while (target === state.current.index) target = Math.floor(Math.random() * length);
      selectByIndex(target);
      return;
    }
    if (state.current.index + 1 < length) selectByIndex(state.current.index + 1);
    else if (manual || state.repeat === "all" || state.autoNext) selectByIndex(0);
    else pauseAudio();
  }

  function previous() {
    if (!state.current) return;
    if (audio.currentTime > 3) { setTime(0); return; }
    selectByIndex(state.current.index - 1);
  }

  function handleEnded() {
    if (state.repeat === "one") { setTime(0); attemptPlay(); return; }
    next(false);
  }

  function setTime(seconds) {
    if (!Number.isFinite(seconds)) return;
    const duration = Number.isFinite(audio.duration) ? audio.duration : seconds;
    audio.currentTime = Math.max(0, Math.min(seconds, duration));
  }

  function toggle() {
    if (!state.current) return;
    if (audio.paused) attemptPlay();
    else pauseAudio();
  }

  function stop() {
    // Closing the player must not let a pending crossfade commit a new track.
    stopFades({ commit: false });
    pauseAudio();
    audio.removeAttribute("src");
    audio.load();
    destroyWaveforms();
    setWaveMode(false);
    closeSettings();
    state.current = null;
    state.time = 0;
    hideBar();
    $("playerTitle").textContent = "Ничего не играет";
    $("playerAlbum").textContent = "";
    setStatus("");
    updateTime();
    saveState();
    notify("stop");
  }

  /* ---------- UI ---------- */

  function pulseElement(el, className = "is-pulsing") {
    if (!el || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    el.classList.remove(className);
    void el.offsetWidth; // restart the animation even on a rapid second click
    el.classList.add(className);
    const done = () => {
      el.classList.remove(className);
      el.removeEventListener("animationend", done);
    };
    el.addEventListener("animationend", done);
  }

  function updatePlayState() {
    const playing = !!(state.current && !audio.paused && !audio.ended);
    bar.classList.toggle("is-playing", playing);
    const playButton = $("playerPlay");
    playButton.setAttribute("aria-label", playing ? "Пауза" : "Воспроизвести");
    pulseElement(playButton);
    updateMediaSessionState();
    notify("playstate");
  }

  function updateMuteState() {
    const muted = audio.muted || state.volume === 0;
    bar.classList.toggle("is-muted", muted);
    $("playerMute").setAttribute("aria-label", muted ? "Включить звук" : "Выключить звук");
    $("playerMute").setAttribute("aria-pressed", String(muted));
    notify("volume");
  }

  function updateTime() {
    const duration = Number.isFinite(audio.duration) ? audio.duration : 0;
    const current = Number.isFinite(audio.currentTime) ? audio.currentTime : 0;
    seek.value = duration ? String(Math.round((current / duration) * 1000)) : "0";
    $("playerCurrent").textContent = formatTime(current);
    $("playerDuration").textContent = formatTime(duration);
  }

  function applyShuffle() {
    $("playerShuffle").setAttribute("aria-pressed", String(state.shuffle));
    $("playerShuffle").setAttribute("aria-label", state.shuffle ? "Перемешивание включено" : "Перемешивание выключено");
  }

  function applyRepeat() {
    const button = $("playerRepeat");
    button.dataset.repeat = state.repeat;
    button.setAttribute("aria-pressed", String(state.repeat !== "off"));
    button.setAttribute("aria-label", {
      off: "Повтор: выключен", all: "Повтор: весь релиз", one: "Повтор: один трек",
    }[state.repeat]);
  }

  /* ---------- settings ---------- */

  function settingsFormHtml() {
    return `
<div class="player-settings-body">
  <p class="player-settings-hint">Плеер универсальный: движок и поведение выбираются здесь и сохраняются для всего сайта.</p>
  <div class="settings-field">
    <label class="settings-label" for="playerEngineSelect">Движок воспроизведения</label>
    <select class="settings-select" id="playerEngineSelect" data-player-setting="engine">
      <option value="html5">HTML5 (встроенный в браузер)</option>
      <option value="wavesurfer">WaveSurfer.js (форма волны)</option>
      <option value="peaks">Peaks.js (форма волны)</option>
      <option value="howler">Howler.js (аудио + живой сигнал)</option>
      <option value="waviz">Waviz (визуализация)</option>
      <option value="mediaelement">MediaElement.js (интерфейс)</option>
      <option value="amplitude">AmplitudeJS (интерфейс)</option>
      <option value="aplayer">APlayer (интерфейс)</option>
      <option value="jplayer">jPlayer (интерфейс)</option>
    </select>
    <p class="player-settings-hint">Интерфейс выбранной библиотеки отображается прямо в строке плеера — отдельного окна больше нет.</p>
  </div>
  <div class="settings-field">
    <label class="settings-label" for="playerFormatSelect">Формат аудиофайла</label>
    <select class="settings-select" id="playerFormatSelect" data-player-setting="format">
      <option value="opus">.opus</option>
      <option value="mp3">.mp3</option>
      <option value="wav">.wav</option>
      <option value="flac">.flac</option>
    </select>
  </div>
  <fieldset class="settings-group">
    <legend>Поведение</legend>
    <label><input type="checkbox" data-player-setting="autoNext"> Играть следующий трек автоматически</label>
    <label><input type="checkbox" data-player-setting="rememberPosition"> Запоминать позицию трека</label>
    <label><input type="checkbox" data-player-setting="crossfade"> Плавный переход между треками</label>
  </fieldset>
  <div class="settings-field">
    <label class="settings-label" for="playerCrossfadeMs">Затухание предыдущего трека</label>
    <select class="settings-select" id="playerCrossfadeMs" data-player-setting="crossfadeMs">
      <option value="200">Короткое — 0,2 с</option>
      <option value="400">Обычное — 0,4 с</option>
      <option value="700">Длинное — 0,7 с</option>
    </select>
    <p class="player-settings-hint">Новый трек выходит на полную громкость за 14 мс — этого хватает против щелчка, но дроп в первые секунды не смягчается.</p>
  </div>
</div>`;
  }

  function mountSettings() {
    document.querySelectorAll("[data-player-settings-mount]").forEach((mount) => {
      if (!mount.querySelector("[data-player-setting]")) mount.innerHTML = settingsFormHtml();
    });
    syncSettingsUI();
  }

  function syncSettingsUI() {
    document.querySelectorAll("[data-player-setting]").forEach((input) => {
      const key = input.dataset.playerSetting;
      if (key === "engine" || key === "format") {
        if (input instanceof HTMLSelectElement) input.value = state[key];
        else input.checked = input.value === state[key];
      }
      else if (key === "crossfadeMs") input.value = String(state.crossfadeMs);
      else if (key === "autoNext" || key === "rememberPosition" || key === "crossfade") {
        input.checked = !!state[key];
      }
    });
  }

  function openSettings() {
    if (settingsTimer) { window.clearTimeout(settingsTimer); settingsTimer = 0; }
    if (queuePanel && !queuePanel.hidden) closeQueue();
    settingsPanel.hidden = false;
    settingsToggle.setAttribute("aria-expanded", "true");
    mountSettings();
    // Restart the transition even if the panel was still closing.
    void settingsPanel.offsetWidth;
    settingsPanel.classList.add("is-open");
    const first = settingsPanel.querySelector("select, input");
    if (first) first.focus({ preventScroll: true });
  }

  function closeSettings() {
    if (settingsPanel.hidden) return;
    settingsToggle.setAttribute("aria-expanded", "false");
    settingsPanel.classList.remove("is-open");
    if (settingsTimer) window.clearTimeout(settingsTimer);
    // Keep the panel in the DOM until its fade/slide-out has finished.
    settingsTimer = window.setTimeout(() => {
      if (!settingsPanel.classList.contains("is-open")) settingsPanel.hidden = true;
      settingsTimer = 0;
    }, 260);
  }

  /* ---------- events ---------- */

  $("playerPlay").addEventListener("click", () => {
    if (!state.current) {
      if (state.context?.tracks?.length) selectByIndex(0);
      return;
    }
    toggle();
  });
  $("playerPrev").addEventListener("click", previous);
  $("playerNext").addEventListener("click", () => next(true));
  $("playerClose").addEventListener("click", stop);

  seek.addEventListener("input", () => setTime((Number(seek.value) / 1000) * (audio.duration || 0)));

  volume.addEventListener("input", () => {
    const value = Math.min(1, Math.max(0, Number(volume.value)));
    state.volume = value;
    audio.volume = value;
    audio.muted = value === 0;
    state.muted = audio.muted;
    try { howl?.volume(value); howl?.mute(audio.muted); } catch {}
    updateMuteState();
    saveState();
  });

  $("playerMute").addEventListener("click", () => {
    audio.muted = !audio.muted;
    state.muted = audio.muted;
    try { howl?.mute(audio.muted); } catch {}
    updateMuteState();
    saveState();
  });

  $("playerShuffle").addEventListener("click", () => {
    state.shuffle = !state.shuffle;
    applyShuffle();
    saveState();
    notify("settings");
  });

  $("playerRepeat").addEventListener("click", () => {
    const modes = ["off", "all", "one"];
    state.repeat = modes[(modes.indexOf(state.repeat) + 1) % modes.length];
    applyRepeat();
    saveState();
    notify("settings");
  });

  settingsToggle.addEventListener("click", () => {
    settingsPanel.hidden ? openSettings() : closeSettings();
  });
  $("playerSettingsClose").addEventListener("click", closeSettings);
  queueToggle?.addEventListener("click", toggleQueue);
  $("playerQueueClose")?.addEventListener("click", closeQueue);
  $("playerQueueClear")?.addEventListener("click", clearQueue);
  queuePanel?.addEventListener("click", (ev) => {
    const target = ev.target instanceof Element ? ev.target : null;
    if (!target) return;
    const remove = target.closest("[data-queue-remove]");
    if (remove) { removeFromQueue(Number(remove.dataset.queueRemove)); return; }
    const play = target.closest("[data-queue-play]");
    if (play) playQueued(Number(play.dataset.queuePlay));
  });
  document.addEventListener("keydown", (ev) => {
    if (ev.key !== "Escape") return;
    if (queuePanel && !queuePanel.hidden) closeQueue();
  });

  document.addEventListener("change", (ev) => {
    const input = ev.target instanceof Element ? ev.target.closest("[data-player-setting]") : null;
    if (!input) return;
    const key = input.dataset.playerSetting;
    if (key === "engine") setEngine(input.value);
    else if (key === "format") setFormat(input.value);
    else if (key === "crossfadeMs") {
      const value = Number(input.value);
      state.crossfadeMs = CROSSFADE_OPTIONS.includes(value) ? value : DEFAULT_CROSSFADE_MS;
      syncSettingsUI();
      saveState();
      notify("settings");
    } else if (key === "autoNext" || key === "rememberPosition" || key === "crossfade") {
      state[key] = !!input.checked;
      if (key === "crossfade" && !state.crossfade) stopFades();
      syncSettingsUI();
      saveState();
      notify("settings");
    }
  });

  audio.addEventListener("loadedmetadata", () => {
    if (pendingStart != null && pendingStart > 0) {
      try { audio.currentTime = pendingStart; } catch {}
    }
    pendingStart = null;
    updateTime();
  });
  audio.addEventListener("timeupdate", () => { updateTime(); saveStateSoon(); });
  audio.addEventListener("play", updatePlayState);
  audio.addEventListener("pause", () => { updatePlayState(); saveStateSoon(); });
  audio.addEventListener("volumechange", updateMuteState);
  audio.addEventListener("ended", handleEnded);
  audio.addEventListener("error", () => {
    if (state.current) setStatus("Не удалось загрузить трек. Проверьте файл в src/tracks.");
  });

  document.addEventListener("keydown", (ev) => {
    const target = ev.target;
    if (target instanceof Element && target.closest("input, textarea, select, [contenteditable='true']")) return;
    if (ev.metaKey || ev.ctrlKey || ev.altKey) return;
    if (ev.code === "Space" && state.current) { ev.preventDefault(); toggle(); }
    else if (ev.key === "ArrowRight" && state.current) { ev.preventDefault(); setTime(audio.currentTime + 5); }
    else if (ev.key === "ArrowLeft" && state.current) { ev.preventDefault(); setTime(audio.currentTime - 5); }
    else if (ev.key.toLowerCase() === "m" && state.current) {
      audio.muted = !audio.muted;
      state.muted = audio.muted;
      try { howl?.mute(audio.muted); } catch {}
      updateMuteState();
      saveState();
    }
  });

  window.addEventListener("zqwy:themechange", () => {
    const colors = waveformColors();
    if (waveSurfer && typeof waveSurfer.setOptions === "function") {
      try {
        waveSurfer.setOptions({
          waveColor: colors.waveColor,
          progressColor: colors.progressColor,
          cursorColor: colors.cursorColor,
        });
      } catch {}
    }
    if (peaks) {
      try {
        const view = peaks.views.getView("zoomview");
        if (view) {
          view.setWaveformColor(colors.waveColor);
          view.setPlayedWaveformColor(colors.progressColor);
          view.setPlayheadColor?.(colors.cursorColor);
        }
      } catch {}
    }
    if (state.engine === "waviz" && waviz && !audio.paused) {
      try { waviz.stop(); waviz.simpleLine(colors.progressColor).catch(() => {}); } catch {}
    }
  });

  window.addEventListener("zqwy:pagechange", () => { mountSettings(); updateTime(); });

  window.addEventListener("pagehide", saveState);
  document.addEventListener("visibilitychange", () => { if (document.hidden) saveState(); });

  if ("mediaSession" in navigator) {
    const handlers = {
      play: () => { if (state.current) attemptPlay(); },
      pause: pauseAudio,
      previoustrack: previous,
      nexttrack: () => next(true),
      seekbackward: () => setTime(audio.currentTime - 10),
      seekforward: () => setTime(audio.currentTime + 10),
      seekto: (details) => { if (Number.isFinite(details.seekTime)) setTime(details.seekTime); },
    };
    for (const [action, handler] of Object.entries(handlers)) {
      try { navigator.mediaSession.setActionHandler(action, handler); } catch {}
    }
  }

  /* ---------- init ---------- */

  function restore() {
    const saved = loadSaved();
    state.context = saved.context || null;
    state.current = saved.current || null;
    state.time = typeof saved.time === "number" ? saved.time : 0;
    state.volume = typeof saved.volume === "number" ? Math.min(1, Math.max(0, saved.volume)) : 1;
    state.muted = saved.muted === true;
    state.shuffle = saved.shuffle === true;
    state.repeat = ["off", "all", "one"].includes(saved.repeat) ? saved.repeat : "off";
    state.engine = ENGINES.includes(saved.engine) ? saved.engine : "html5";
    state.format = FORMATS.includes(saved.format) ? saved.format : "opus";
    state.autoNext = saved.autoNext !== false;
    state.rememberPosition = saved.rememberPosition !== false;
    state.crossfade = saved.crossfade !== false;
    const savedCrossfadeMs = Number(saved.crossfadeMs);
    state.crossfadeMs = CROSSFADE_OPTIONS.includes(savedCrossfadeMs)
      ? savedCrossfadeMs
      : DEFAULT_CROSSFADE_MS;
    state.queue = Array.isArray(saved.queue)
      ? saved.queue.filter((item) => item && item.path && Array.isArray(item.tracks)).slice(0, 100)
      : [];

    audio.volume = state.volume;
    audio.muted = state.muted;
    volume.value = String(state.volume);

    applyShuffle();
    applyRepeat();
    updateMuteState();
    renderQueue();
    mountSettings();

    if (!state.current || !state.current.path) return;
    showBar();
    renderMetadata();
    setStatus("Плеер восстановлен. Нажмите ▶, чтобы продолжить.");
    loadCurrent({ autoplay: false, startTime: state.rememberPosition ? state.time : 0 });
  }

  window.zqwyPlayer = {
    playTrack, setContext, toggle, play: attemptPlay, pause: pauseAudio,
    next, previous, stop, seek: setTime, getState, setEngine, setFormat, openSettings,
    enqueue, removeFromQueue, clearQueue, getQueue, openQueue, closeQueue,
    on(event, handler) {
      if (typeof handler !== "function") return;
      listeners.set(event, handler);
    },
  };

  restore();
})();
