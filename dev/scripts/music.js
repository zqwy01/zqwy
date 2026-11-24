/*
 * Music catalog UI (albums and track lists).
 *
 * Playback itself lives in the persistent global player (scripts/player.js),
 * which is injected into <body> outside .page-content. That player never gets
 * destroyed by SPA navigation, so this file only renders the catalog, selects
 * albums and forwards track clicks to window.zqwyPlayer.
 *
 * The catalog is read from ../data/music-catalog.json (generated from
 * src/tracks/). Audio paths in the catalog are project-relative src/... paths;
 * prepending ../../ works both from dist/ and from the project root.
 */
(() => {
  "use strict";

  const STORAGE_ALBUM = "zqwy.player.album.v1";
  const STORAGE_VIEW = "zqwy.music.view.v1";
  const VIEW_MODES = new Set(["list", "cards", "large"]);
  const state = {
    catalog: null,
    album: null,
    durations: new Map(),
    view: "list", // "list", "cards" or "large"
    fullscreen: false, // releases fill the screen until one is chosen
    collapsed: false, // releases hidden so the selected album's tracks fill the page
  };

  let ui = {};
  const measureCanvas = document.createElement("canvas");
  const measureCtx = measureCanvas.getContext ? measureCanvas.getContext("2d") : null;

  function ensureLightbox() {
    if (document.getElementById("coverLightbox") || !document.body) return;
    document.body.insertAdjacentHTML("beforeend", `
<div class="cover-lightbox" id="coverLightbox" hidden role="dialog" aria-modal="true" aria-label="Обложка релиза">
  <button class="cover-lightbox-backdrop" type="button" data-cover-close aria-label="Закрыть обложку"></button>
  <div class="cover-lightbox-frame">
    <img id="coverLightboxImg" alt="" hidden>
    <span class="cover-lightbox-letter" id="coverLightboxLetter" aria-hidden="true">♪</span>
    <p class="cover-lightbox-caption" id="coverLightboxCaption"></p>
    <button class="cover-lightbox-close" id="coverLightboxClose" type="button" data-cover-close aria-label="Закрыть обложку">×</button>
  </div>
</div>`);
  }

  function refresh() {
    ensureLightbox();
    ui = {
      albumList: document.getElementById("albumList"),
      albumFilter: document.getElementById("albumFilter"),
      musicCount: document.getElementById("musicCount"),
      musicLayout: document.querySelector(".music-layout"),
      viewButtons: [...document.querySelectorAll("[data-album-view]")],
      albumPanel: document.getElementById("albumPanel"),
      fullscreenBtn: document.getElementById("releasesFullscreen"),
      fullscreenLabel: document.getElementById("releasesFullscreenLabel"),
      expandBtn: document.getElementById("tracksExpand"),
      trackList: document.getElementById("trackList"),
      albumTitle: document.getElementById("albumTitle"),
      albumSubtitle: document.getElementById("albumSubtitle"),
      albumCoverImg: document.getElementById("albumCoverImg"),
      albumCoverLetter: document.getElementById("albumCoverLetter"),
      albumCover: document.getElementById("albumCover"),
      albumEmpty: document.getElementById("albumEmpty"),
      lightbox: document.getElementById("coverLightbox"),
      lightboxImg: document.getElementById("coverLightboxImg"),
      lightboxLetter: document.getElementById("coverLightboxLetter"),
      lightboxCaption: document.getElementById("coverLightboxCaption"),
    };
    if (ui.expandBtn) {
      const label = state.collapsed ? "Показать список релизов" : "Свернуть список релизов";
      ui.expandBtn.setAttribute("aria-pressed", String(state.collapsed));
      ui.expandBtn.setAttribute("aria-label", label);
      ui.expandBtn.setAttribute("title", state.collapsed
        ? "Показать список релизов"
        : "Свернуть список релизов — треки на весь экран");
    }
  }

  function player() {
    return window.zqwyPlayer || null;
  }

  /* ---------- helpers ---------- */

  function assetUrl(relative) {
    const segments = String(relative).split("/").filter(Boolean);
    const tail = segments.map(encodeURIComponent).join("/");
    // Resolve against the current base at call time: SPA navigation rewrites
    // document.baseURI, and the music page always renders after that swap.
    return new URL(`../../${tail}`, document.baseURI).href;
  }

  function formatTime(seconds) {
    if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
    const total = Math.floor(seconds);
    return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
  }

  function plural(count, one, few, many) {
    const mod10 = count % 10;
    const mod100 = count % 100;
    if (mod10 === 1 && mod100 !== 11) return one;
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
    return many;
  }

  function coverNode(album, image, letter) {
    if (!image || !letter) return;
    const fallbackLetter = album && album.title
      ? album.title.replace(/^!/, "").charAt(0) || "♪"
      : "♪";
    if (album && album.cover) {
      // A missing file must never leave an empty hole: fall back to the letter.
      image.onload = () => { image.hidden = false; letter.hidden = true; };
      image.onerror = () => {
        image.hidden = true;
        letter.hidden = false;
        letter.textContent = fallbackLetter;
      };
      image.src = assetUrl(album.cover);
      image.hidden = false;
      letter.hidden = true;
    } else {
      image.onload = null;
      image.onerror = null;
      image.removeAttribute("src");
      image.hidden = true;
      letter.hidden = false;
      letter.textContent = fallbackLetter;
    }
  }

  /* ---------- fullscreen cover preview ---------- */

  let lightboxTimer = 0;

  function openCover(source) {
    if (!ui.lightbox || !source) return;
    const image = source.tagName === "IMG" ? source : source.querySelector("img");
    const letterNode = source.querySelector(".album-cover-letter, .album-card-cover-letter");
    const hasImage = image && image.getAttribute("src") && !image.hidden;
    const img = ui.lightboxImg;
    const letter = ui.lightboxLetter;
    if (hasImage) {
      img.src = image.currentSrc || image.src;
      img.hidden = false;
      letter.hidden = true;
    } else {
      img.removeAttribute("src");
      img.hidden = true;
      letter.hidden = false;
      letter.textContent = (letterNode?.textContent || "♪").trim() || "♪";
    }
    if (ui.lightboxCaption) {
      ui.lightboxCaption.textContent = source.dataset.coverTitle
        || ui.albumTitle?.textContent
        || "";
    }
    if (lightboxTimer) { window.clearTimeout(lightboxTimer); lightboxTimer = 0; }
    ui.lightbox.hidden = false;
    ui.lightbox.classList.remove("is-closing");
    document.body.classList.add("cover-lightbox-open");
    void ui.lightbox.offsetWidth;
    ui.lightbox.classList.add("is-open");
    ui.lightbox.querySelector("[data-cover-close]")?.focus({ preventScroll: true });
  }

  function closeCover() {
    if (!ui.lightbox || ui.lightbox.hidden) return;
    ui.lightbox.classList.remove("is-open");
    ui.lightbox.classList.add("is-closing");
    document.body.classList.remove("cover-lightbox-open");
    if (lightboxTimer) window.clearTimeout(lightboxTimer);
    lightboxTimer = window.setTimeout(() => {
      if (!ui.lightbox.classList.contains("is-open")) {
        ui.lightbox.hidden = true;
        ui.lightbox.classList.remove("is-closing");
      }
      lightboxTimer = 0;
    }, 300);
  }

  function coverIsOpen() {
    return !!(ui.lightbox && !ui.lightbox.hidden && ui.lightbox.classList.contains("is-open"));
  }

  /* ---------- release view mode ---------- */

  function applyView(nextView, persist = true) {
    state.view = VIEW_MODES.has(nextView) ? nextView : "list";
    document.body.dataset.musicView = state.view;
    for (const node of [ui.albumList, ui.musicLayout]) {
      node?.classList.remove("is-list", "is-cards", "is-large");
      node?.classList.add(`is-${state.view}`);
    }
    const viewOrder = ["list", "cards", "large"];
    document.querySelector(".album-view-toggle")?.style.setProperty("--view-index", String(viewOrder.indexOf(state.view)));
    ui.viewButtons?.forEach((button) => {
      button.setAttribute("aria-pressed", String(button.dataset.albumView === state.view));
    });
    if (persist) {
      try { localStorage.setItem(STORAGE_VIEW, state.view); } catch {}
    }
  }

  function loadSavedView() {
    let saved = "";
    try { saved = localStorage.getItem(STORAGE_VIEW) || ""; } catch {}
    applyView(VIEW_MODES.has(saved) ? saved : "list", false);
  }

  /* Releases are re-rendered when the view or full-screen mode changes. Remember
     where each button was so the new, differently sized buttons can animate from
     the old geometry instead of popping into place. */
  function captureReleaseRects() {
    const rects = new Map();
    if (!ui.albumList || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return rects;
    ui.albumList.querySelectorAll("button[data-album]").forEach((node) => {
      const rect = node.getBoundingClientRect();
      if (rect.width && rect.height) {
        rects.set(node.dataset.album, { left: rect.left, top: rect.top, width: rect.width, height: rect.height });
      }
    });
    return rects;
  }

  function animateReleaseRects(previous) {
    if (!previous?.size || !ui.albumList || !Element.prototype.animate
      || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    ui.albumList.querySelectorAll("button[data-album]").forEach((node) => {
      const before = previous.get(node.dataset.album);
      const after = node.getBoundingClientRect();
      if (!before || !after.width || !after.height) return;
      const dx = before.left - after.left;
      const dy = before.top - after.top;
      const sx = before.width / after.width;
      const sy = before.height / after.height;
      if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5 && Math.abs(sx - 1) < 0.01 && Math.abs(sy - 1) < 0.01) return;
      node.style.transformOrigin = "top left";
      node.animate(
        [
          { transform: `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})`, opacity: 0.72 },
          { transform: "none", opacity: 1 },
        ],
        { duration: 240, easing: "cubic-bezier(0.22, 1, 0.36, 1)" },
      );
    });
  }

  function changeView(nextView) {
    const previous = captureReleaseRects();
    applyView(nextView);
    renderAlbums();
    animateReleaseRects(previous);
  }

  /* ---------- full-screen releases mode ---------- */

  function applyFullscreen(on) {
    const previous = captureReleaseRects();
    state.fullscreen = !!on;
    document.body.classList.toggle("music-releases-fullscreen", state.fullscreen);
    ui.musicLayout?.classList.toggle("is-fullscreen", state.fullscreen);
    ui.fullscreenBtn?.setAttribute("aria-pressed", String(state.fullscreen));
    if (ui.fullscreenLabel) {
      ui.fullscreenLabel.textContent = state.fullscreen ? "Свернуть релизы" : "Релизы на весь экран";
    }
    if (ui.fullscreenBtn) {
      const label = state.fullscreen ? "Свернуть релизы" : "Релизы на весь экран";
      ui.fullscreenBtn.setAttribute("aria-label", label);
      ui.fullscreenBtn.setAttribute("title", label);
    }
    renderAlbums();
    animateReleaseRects(previous);
  }

  // Hide the release sidebar entirely and let the selected album's tracks use
  // the whole page. The same button restores the release list.
  function applyCollapsed(on) {
    state.collapsed = !!on;
    document.body.classList.toggle("music-releases-collapsed", state.collapsed);
    if (state.collapsed && state.fullscreen) applyFullscreen(false);
    const label = state.collapsed
      ? "Показать список релизов"
      : "Свернуть список релизов";
    if (ui.expandBtn) {
      ui.expandBtn.setAttribute("aria-pressed", String(state.collapsed));
      ui.expandBtn.setAttribute("aria-label", label);
      ui.expandBtn.setAttribute("title", state.collapsed
        ? "Показать список релизов"
        : "Свернуть список релизов — треки на весь экран");
    }
    if (!state.collapsed) fitSidebarToTitles();
  }

  // The release column hugs the longest visible title, leaving the rest of the
  // width for the track list. Measured with the real font of the row label.
  function fitSidebarToTitles() {
    if (!ui.albumList || !ui.musicLayout || state.fullscreen || !measureCtx) return;
    const labels = [...ui.albumList.querySelectorAll(".album-item-title, .album-card-title")];
    if (!labels.length) return;
    const style = getComputedStyle(labels[0]);
    measureCtx.font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
    let max = 0;
    labels.forEach((label) => {
      max = Math.max(max, measureCtx.measureText(label.textContent || "").width);
    });
    const large = state.view === "large";
    const cards = state.view === "cards" || large;
    const extra = large ? 150 : cards ? 96 : 62; // cover/gap/arrow or count + padding
    const baseMin = large ? 300 : cards ? 220 : 170;
    // Keep the release column proportional to the viewport on wide screens
    // instead of freezing it at a 340–480px phone-era cap. Leave room for the
    // track list even on smaller landscape windows.
    const viewport = document.documentElement.clientWidth || window.innerWidth || 0;
    const room = Math.max(0, viewport - 48 - (large ? 520 : cards ? 440 : 360));
    const fluidCap = Math.round(viewport * (large ? 0.42 : cards ? 0.36 : 0.32));
    const upper = large ? 900 : cards ? 680 : 560;
    const min = Math.round(Math.max(baseMin, Math.min(upper, viewport * (large ? 0.24 : cards ? 0.2 : 0.16))));
    const maxWidth = Math.max(min, Math.min(upper, fluidCap, room));
    const width = Math.round(Math.min(maxWidth, Math.max(min, max + extra)));
    const property = large ? "--album-columns-large" : cards ? "--album-columns-cards" : "--album-columns";
    ui.musicLayout.style.setProperty(property, `${width}px`);
  }

  function releaseButton(album, index) {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.album = album.id;
    button.style.setProperty("--i", String(index));
    button.setAttribute("aria-pressed", String(state.album && state.album.id === album.id));
    if (state.album && album.id === state.album.id) button.classList.add("is-active");
    return button;
  }

  function listAlbumItem(album, index) {
    const button = releaseButton(album, index);
    button.className = "album-item";
    const title = document.createElement("span");
    title.className = "album-item-title";
    title.textContent = album.title;
    const count = document.createElement("span");
    count.className = "album-item-count";
    count.textContent = String(album.tracks.length);
    button.append(title, count);
    return button;
  }

  function cardAlbumItem(album, index) {
    const button = releaseButton(album, index);
    button.className = "album-card-item";

    const cover = document.createElement("span");
    cover.className = "album-card-cover";
    cover.setAttribute("data-cover-open", "1");
    cover.dataset.coverTitle = album.title;
    cover.setAttribute("title", "Открыть обложку на весь экран");
    const image = document.createElement("img");
    image.alt = "";
    const letter = document.createElement("span");
    letter.className = "album-card-cover-letter";
    letter.setAttribute("aria-hidden", "true");
    coverNode(album, image, letter);
    cover.append(image, letter);

    const body = document.createElement("span");
    body.className = "album-card-body";
    const title = document.createElement("span");
    title.className = "album-card-title";
    title.textContent = album.title;
    const count = document.createElement("span");
    count.className = "album-card-count";
    count.textContent = `${album.tracks.length} ${plural(album.tracks.length, "трек", "трека", "треков")}`;
    body.append(title, count);

    const open = document.createElement("span");
    open.className = "album-card-open";
    open.setAttribute("aria-hidden", "true");
    open.textContent = "›";

    button.append(cover, body, open);
    return button;
  }

  /* ---------- catalog rendering ---------- */

  function renderAlbums() {
    if (!state.catalog || !ui.albumList) return;
    const query = (ui.albumFilter?.value || "").trim().toLowerCase();
    const albums = state.catalog.albums.filter((album) => {
      if (!query) return true;
      return album.title.toLowerCase().includes(query) || album.id.toLowerCase().includes(query);
    });

    const scrollTop = ui.albumList.scrollTop;
    ui.albumList.replaceChildren();
    const fragment = document.createDocumentFragment();
    // Full-screen mode changes the placement, not the selected release view:
    // table/list mode must stay a table there too.
    const useCards = state.view !== "list";
    for (const [index, album] of albums.entries()) {
      const item = document.createElement("li");
      const button = useCards
        ? cardAlbumItem(album, index)
        : listAlbumItem(album, index);
      item.appendChild(button);
      fragment.appendChild(item);
    }
    ui.albumList.appendChild(fragment);
    ui.albumList.scrollTop = scrollTop;
    fitSidebarToTitles();

    if (ui.musicCount) {
      ui.musicCount.textContent = query
        ? `Найдено: ${albums.length}`
        : `${state.catalog.albumCount} релизов · ${state.catalog.trackCount} треков`;
    }
  }

  function renderAlbum(options = {}) {
    if (!ui.trackList) return;
    if (!state.album) {
      if (ui.albumTitle) ui.albumTitle.textContent = "Нет релиза";
      if (ui.albumSubtitle) ui.albumSubtitle.textContent = "";
      ui.trackList.replaceChildren();
      return;
    }
    const album = state.album;
    if (ui.albumTitle) ui.albumTitle.textContent = album.title;
    if (ui.albumSubtitle) {
      ui.albumSubtitle.textContent = `${album.tracks.length} ${plural(album.tracks.length, "трек", "трека", "треков")} · Opus`;
    }
    coverNode(album, ui.albumCoverImg, ui.albumCoverLetter);

    ui.trackList.replaceChildren();
    const fragment = document.createDocumentFragment();
    album.tracks.forEach((track, index) => {
      const item = document.createElement("li");
      item.className = "music-track";
      item.dataset.index = String(index);
      item.style.setProperty("--i", String(index));

      const row = document.createElement("div");
      row.className = "music-track-row";

      // The queue button sits immediately next to the play/pause button at the
      // start of the row. Both are real sibling buttons — never nested.
      const controls = document.createElement("div");
      controls.className = "music-track-controls";

      const play = document.createElement("button");
      play.type = "button";
      play.className = "music-track-button";
      play.dataset.index = String(index);
      play.setAttribute("aria-label", `Играть: ${track.title}`);

      // The number cell doubles as a play/pause control for the active track.
      // Both icons live inside a real button so the state can be announced and
      // animated instead of swapping a CSS "▶" pseudo-element.
      const number = document.createElement("span");
      number.className = "music-track-number";

      const indexLabel = document.createElement("span");
      indexLabel.className = "music-track-index";
      indexLabel.textContent = String(index + 1).padStart(2, "0");

      const toggle = document.createElement("span");
      toggle.className = "music-track-toggle";
      toggle.setAttribute("aria-hidden", "true");
      toggle.innerHTML =
        '<svg class="icon-play" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>' +
        '<svg class="icon-pause" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 5h4v14H7zM13 5h4v14h-4z"/></svg>';

      number.append(indexLabel, toggle);
      play.appendChild(number);

      const add = document.createElement("button");
      add.type = "button";
      add.className = "music-track-queue";
      add.dataset.index = String(index);
      add.setAttribute("aria-label", `Добавить в очередь: ${track.title}`);
      add.setAttribute("title", "Добавить в очередь");
      add.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h11v2H4zM4 11h11v2H4zM4 16h7v2H4zM18 9h2v3h3v2h-3v3h-2v-3h-3v-2h3z"/></svg>';

      controls.append(play, add);

      // A separate info button keeps the whole title clickable without making
      // the queue control a child of another button.
      const info = document.createElement("button");
      info.type = "button";
      info.className = "music-track-info";
      info.dataset.index = String(index);
      info.setAttribute("aria-label", `Играть: ${track.title}`);

      const title = document.createElement("span");
      title.className = "music-track-title";
      title.textContent = track.title;

      const duration = document.createElement("span");
      duration.className = "music-track-duration";
      duration.textContent = state.durations.has(track.path)
        ? formatTime(state.durations.get(track.path))
        : "—";

      info.append(title, duration);
      row.append(controls, info);
      item.appendChild(row);
      fragment.appendChild(item);
    });
    ui.trackList.appendChild(fragment);
    markActiveTrack();
    // Only scroll when the visitor explicitly picks an album; the initial
    // render must leave the top of the page (logo + search) in place.
    if (options.scroll) ui.albumPanel?.scrollIntoView({ block: "nearest" });
  }

  function markActiveTrack() {
    if (!ui.trackList) return;
    const api = player();
    const playerState = api ? api.getState() : null;
    const current = playerState ? playerState.current : null;
    const playing = !!(playerState && playerState.playing);
    const activeAlbum = !!(current && state.album && current.albumId === state.album.id);
    const queuedPaths = new Set((playerState?.queue || [])
      .filter((entry) => entry && state.album && entry.albumId === state.album.id)
      .map((entry) => entry.path));

    ui.trackList.querySelectorAll(".music-track").forEach((item) => {
      const index = Number(item.dataset.index);
      const track = state.album?.tracks[index];
      const active = activeAlbum && current.index === index;
      const isPlaying = active && playing;
      const isQueued = !!track && queuedPaths.has(track.path);
      item.classList.toggle("is-active", active);
      item.classList.toggle("is-playing", isPlaying);
      item.classList.toggle("is-queued", isQueued);
      const label = `${isPlaying ? "Пауза" : "Играть"}: ${state.album?.tracks[index]?.title || ""}`;
      [".music-track-button", ".music-track-info"].forEach((selector) => {
        const el = item.querySelector(selector);
        if (!el) return;
        el.setAttribute("aria-pressed", String(active));
        el.setAttribute("aria-label", label);
      });
      const addButton = item.querySelector(".music-track-queue");
      if (addButton) {
        addButton.setAttribute("title", isQueued ? "Уже в очереди" : "Добавить в очередь");
        addButton.setAttribute("aria-pressed", String(isQueued));
      }
    });
  }

  function seedDurations() {
    if (!state.catalog?.albums) return;
    for (const album of state.catalog.albums) {
      for (const track of album.tracks || []) {
        if (Number.isFinite(track.duration) && track.duration > 0) {
          state.durations.set(track.path, track.duration);
        }
      }
    }
  }

  function applyDurations() {
    const api = player();
    if (!api || !state.album) return;
    const { current, duration } = api.getState();
    if (!current || !Number.isFinite(duration) || duration <= 0 || current.albumId !== state.album.id) return;
    const track = state.album.tracks[current.index];
    if (!track) return;
    state.durations.set(track.path, duration);
    const label = ui.trackList?.querySelector(`.music-track[data-index="${current.index}"] .music-track-duration`);
    if (label) label.textContent = formatTime(duration);
  }

  function selectAlbum(album, options = {}) {
    if (!album) return;
    state.album = album;
    renderAlbums();
    renderAlbum({ scroll: options.scroll === true });
    try { localStorage.setItem(STORAGE_ALBUM, album.id); } catch {}
    player()?.setContext(album);
    if (options.updateHash !== false) {
      const hash = `#${encodeURIComponent(album.id)}`;
      if (window.location.hash !== hash) {
        window.history.replaceState(window.history.state, "", hash);
      }
    }
  }

  function playTrack(index) {
    if (!state.album || !state.album.tracks[index]) return;
    player()?.playTrack(state.album, index);
    markActiveTrack();
  }

  function pulseViewButton(button) {
    if (!button || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    button.classList.remove("is-switching");
    void button.offsetWidth;
    button.classList.add("is-switching");
    const done = () => {
      button.classList.remove("is-switching");
      button.removeEventListener("animationend", done);
    };
    button.addEventListener("animationend", done);
  }

  function pulseTrackButton(button) {
    if (!button || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    button.classList.remove("is-toggling");
    void button.offsetWidth; // restart the animation on a rapid second click
    button.classList.add("is-toggling");
    const done = () => {
      button.classList.remove("is-toggling");
      button.removeEventListener("animationend", done);
    };
    button.addEventListener("animationend", done);
  }

  /* ---------- delegated, SPA-safe events ---------- */

  document.addEventListener("click", (event) => {
    const target = event.target instanceof Element ? event.target : null;
    if (!target) return;

    const viewButton = target.closest("[data-album-view]");
    if (viewButton && ui.viewButtons?.includes(viewButton)) {
      changeView(viewButton.dataset.albumView);
      pulseViewButton(viewButton);
      return;
    }

    if (target.closest("#releasesFullscreen")) {
      const next = !state.fullscreen;
      if (next && state.collapsed) applyCollapsed(false);
      applyFullscreen(next);
      return;
    }

    if (target.closest("#tracksExpand")) {
      applyCollapsed(!state.collapsed);
      return;
    }

    const coverTrigger = target.closest("[data-cover-open]");
    if (coverTrigger && (ui.albumCover?.contains(coverTrigger) || ui.albumList?.contains(coverTrigger))) {
      openCover(coverTrigger);
      return;
    }

    if (target.closest("[data-cover-close]")) { closeCover(); return; }

    const albumButton = target.closest("button[data-album]");
    if (albumButton && ui.albumList?.contains(albumButton) && state.catalog) {
      const album = state.catalog.albums.find((item) => item.id === albumButton.dataset.album);
      if (album) {
        // Full-screen mode shows releases first; choosing one reveals its tracks.
        if (state.fullscreen) applyFullscreen(false);
        selectAlbum(album, { scroll: true });
      }
      return;
    }

    const queueAdd = target.closest(".music-track-queue");
    if (queueAdd && ui.trackList?.contains(queueAdd) && state.album) {
      const index = Number(queueAdd.dataset.index);
      player()?.enqueue(state.album, index);
      return;
    }

    // Both the number button and the title button start/pause the track.
    const trackButton = target.closest(".music-track-button, .music-track-info");
    if (trackButton && ui.trackList?.contains(trackButton)) {
      const index = Number(trackButton.dataset.index);
      const api = player();
      const current = api ? api.getState().current : null;
      const playButton = trackButton.closest(".music-track")?.querySelector(".music-track-button");
      pulseTrackButton(playButton);
      if (current && state.album && current.albumId === state.album.id && current.index === index) {
        api.toggle();
        markActiveTrack();
      } else {
        playTrack(index);
      }
    }
  });

  document.addEventListener("input", (event) => {
    if (event.target === ui.albumFilter) renderAlbums();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      if (coverIsOpen()) { closeCover(); return; }
      if (state.fullscreen) applyFullscreen(false);
      else if (state.collapsed) applyCollapsed(false);
      return;
    }
    const target = event.target instanceof Element ? event.target : null;
    if (target && ui.albumCover?.contains(target) && (event.key === "Enter" || event.key === " ")) {
      event.preventDefault();
      openCover(ui.albumCover);
    }
  });

  // The global player emits this on every state change (track, play/pause,
  // duration, engine, settings). Keep the catalog's active row and track
  // durations in sync without owning any playback logic here.
  window.addEventListener("zqwy:playerstate", () => {
    markActiveTrack();
    applyDurations();
  });

  window.addEventListener("hashchange", () => {
    if (!state.catalog) return;
    const id = decodeURIComponent(window.location.hash.replace(/^#/, ""));
    const album = state.catalog.albums.find((item) => item.id === id);
    if (album && album !== state.album) selectAlbum(album, { updateHash: false, scroll: true });
  });

  /* ---------- init (runs on first load and after SPA navigation) ---------- */

  // The same page can initialise twice in a row: once when transition.js
  // injects this script and again on zqwy:pagechange. Share the in-flight load
  // so the catalog is fetched and rendered only once.
  let inFlight = null;

  async function init() {
    refresh();
    if (!ui.albumList || !ui.trackList) return; // another catalog page is active
    loadSavedView();
    applyFullscreen(false);
    if (inFlight) return inFlight;
    inFlight = doInit();
    try { await inFlight; } finally { inFlight = null; }
  }

  async function doInit() {
    if (state.catalog) {
      renderAlbums();
      renderAlbum();
      return;
    }

    if (ui.albumEmpty) {
      ui.albumEmpty.hidden = false;
      ui.albumEmpty.textContent = "Загрузка каталога…";
    }
    try {
      const response = await fetch("../data/music-catalog.json", { cache: "no-store" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      state.catalog = await response.json();
      if (!state.catalog || !Array.isArray(state.catalog.albums)) throw new Error("bad catalog");
      seedDurations();
    } catch {
      if (ui.albumTitle) ui.albumTitle.textContent = "Каталог недоступен";
      if (ui.albumSubtitle) ui.albumSubtitle.textContent = "";
      if (ui.albumEmpty) {
        ui.albumEmpty.hidden = false;
        ui.albumEmpty.textContent = "Не удалось прочитать data/music-catalog.json. Запустите npm run build.";
      }
      return;
    }

    if (ui.albumEmpty) ui.albumEmpty.hidden = true;
    renderAlbums();

    // Search results link to ./music/?album=<id>&track=<n>#<id>.
    const params = new URLSearchParams(window.location.search);
    const albumParam = params.get("album");
    const trackParam = params.get("track");
    const fromHash = decodeURIComponent(window.location.hash.replace(/^#/, ""));
    let saved = "";
    try { saved = localStorage.getItem(STORAGE_ALBUM) || ""; } catch {}
    const album = state.catalog.albums.find((item) => item.id === albumParam)
      || state.catalog.albums.find((item) => item.id === fromHash)
      || state.catalog.albums.find((item) => item.id === saved)
      || state.catalog.albums[0];
    if (!album) return;

    selectAlbum(album, { updateHash: false });

    if (albumParam && trackParam !== null) {
      const index = Number(trackParam);
      if (Number.isInteger(index) && album.tracks[index]) {
        playTrack(index);
      }
      // Consume the deep-link query so re-entering the page (or a bfcache
      // restore) does not replay the track; keep the album in the hash.
      const clean = `${window.location.pathname}#${encodeURIComponent(album.id)}`;
      window.history.replaceState(window.history.state, "", clean);
    }
  }

  init();
  window.addEventListener("zqwy:pagechange", () => { closeCover(); init(); });
  window.addEventListener("resize", () => fitSidebarToTitles());
  document.fonts?.ready.then(() => fitSidebarToTitles());
})();
