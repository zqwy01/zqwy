/* music/catalog.js — модуль скрипта music.js. */
export function install(P) {
  Object.assign(P, { captureReleaseRects, animateReleaseRects, releaseButton, listAlbumItem, cardAlbumItem, renderAlbums, renderAlbum, markActiveTrack, seedDurations, applyDurations, selectAlbum, playTrack, pulseTrackButton });


  /* Releases are re-rendered when the view or full-screen mode changes. Remember
     where each button was so the new, differently sized buttons can animate from
     the old geometry instead of popping into place. */
  function captureReleaseRects() {
    const rects = new Map();
    if (!P.ui.albumList || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return rects;
    P.ui.albumList.querySelectorAll("button[data-album]").forEach((node) => {
      const rect = node.getBoundingClientRect();
      if (rect.width && rect.height) {
        rects.set(node.dataset.album, { left: rect.left, top: rect.top, width: rect.width, height: rect.height });
      }
    });
    return rects;
  }

  function animateReleaseRects(previous) {
    if (!previous?.size || !P.ui.albumList || !Element.prototype.animate
      || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    P.ui.albumList.querySelectorAll("button[data-album]").forEach((node) => {
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

  function releaseButton(album, index) {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.album = album.id;
    button.style.setProperty("--i", String(index));
    button.setAttribute("aria-pressed", String(P.state.album && P.state.album.id === album.id));
    if (P.state.album && album.id === P.state.album.id) button.classList.add("is-active");
    return button;
  }

  function listAlbumItem(album, index) {
    const button = P.releaseButton(album, index);
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
    const button = P.releaseButton(album, index);
    button.className = "album-card-item";

    const cover = document.createElement("span");
    cover.className = "album-card-cover";
    cover.setAttribute("data-cover-open", "1");
    cover.dataset.coverTitle = album.title;
    cover.setAttribute("title", P.t("musicOpenCover"));
    const image = document.createElement("img");
    image.alt = "";
    const letter = document.createElement("span");
    letter.className = "album-card-cover-letter";
    letter.setAttribute("aria-hidden", "true");
    P.coverNode(album, image, letter);
    cover.append(image, letter);

    const body = document.createElement("span");
    body.className = "album-card-body";
    const title = document.createElement("span");
    title.className = "album-card-title";
    title.textContent = album.title;
    const count = document.createElement("span");
    count.className = "album-card-count";
    count.textContent = `${album.tracks.length} ${P.trackWord(album.tracks.length)}`;
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
    if (!P.state.catalog || !P.ui.albumList) return;
    const query = (P.ui.albumFilter?.value || "").trim().toLowerCase();
    const albums = P.state.catalog.albums.filter((album) => {
      if (!query) return true;
      return album.title.toLowerCase().includes(query) || album.id.toLowerCase().includes(query);
    });

    const scrollTop = P.ui.albumList.scrollTop;
    P.ui.albumList.replaceChildren();
    const fragment = document.createDocumentFragment();
    // Full-screen mode changes the placement, not the selected release view:
    // table/list mode must stay a table there too.
    const useCards = P.state.view !== "list";
    for (const [index, album] of albums.entries()) {
      const item = document.createElement("li");
      const button = useCards
        ? P.cardAlbumItem(album, index)
        : P.listAlbumItem(album, index);
      item.appendChild(button);
      fragment.appendChild(item);
    }
    P.ui.albumList.appendChild(fragment);
    P.ui.albumList.scrollTop = scrollTop;
    P.fitSidebarToTitles();

    if (P.ui.musicCount) {
      P.ui.musicCount.textContent = query
        ? P.t("musicFound", { count: albums.length })
        : P.t("musicReleaseCount", { count: P.state.catalog.albumCount, tracks: P.state.catalog.trackCount });
    }
  }

  function renderAlbum(options = {}) {
    if (!P.ui.trackList) return;
    if (!P.state.album) {
      if (P.ui.albumTitle) P.ui.albumTitle.textContent = P.t("musicNoRelease");
      if (P.ui.albumSubtitle) P.ui.albumSubtitle.textContent = "";
      P.ui.trackList.replaceChildren();
      return;
    }
    const album = P.state.album;
    if (P.ui.albumTitle) P.ui.albumTitle.textContent = album.title;
    if (P.ui.albumSubtitle) {
      P.ui.albumSubtitle.textContent = `${album.tracks.length} ${P.trackWord(album.tracks.length)} · Opus`;
    }
    P.coverNode(album, P.ui.albumCoverImg, P.ui.albumCoverLetter);

    P.ui.trackList.replaceChildren();
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
      play.setAttribute("aria-label", P.t("musicPlayTrack", { title: track.title }));

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
      add.setAttribute("aria-label", P.t("musicQueueTrack", { title: track.title }));
      add.setAttribute("title", P.t("musicAddToQueue"));
      add.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h11v2H4zM4 11h11v2H4zM4 16h7v2H4zM18 9h2v3h3v2h-3v3h-2v-3h-3v-2h3z"/></svg>';

      controls.append(play, add);

      // A separate info button keeps the whole title clickable without making
      // the queue control a child of another button.
      const info = document.createElement("button");
      info.type = "button";
      info.className = "music-track-info";
      info.dataset.index = String(index);
      info.setAttribute("aria-label", P.t("musicPlayTrack", { title: track.title }));

      const title = document.createElement("span");
      title.className = "music-track-title";
      title.textContent = track.title;

      const duration = document.createElement("span");
      duration.className = "music-track-duration";
      duration.textContent = P.state.durations.has(track.path)
        ? P.formatTime(P.state.durations.get(track.path))
        : "—";

      info.append(title, duration);
      row.append(controls, info);
      item.appendChild(row);
      fragment.appendChild(item);
    });
    P.ui.trackList.appendChild(fragment);
    P.markActiveTrack();
    // Only scroll when the visitor explicitly picks an album; the initial
    // render must leave the top of the page (logo + search) in place.
    if (options.scroll) P.ui.albumPanel?.scrollIntoView({ block: "nearest" });
  }

  function markActiveTrack() {
    if (!P.ui.trackList) return;
    const api = P.player();
    const playerState = api ? api.getState() : null;
    const current = playerState ? playerState.current : null;
    const playing = !!(playerState && playerState.playing);
    const activeAlbum = !!(current && P.state.album && current.albumId === P.state.album.id);
    const queuedPaths = new Set((playerState?.queue || [])
      .filter((entry) => entry && P.state.album && entry.albumId === P.state.album.id)
      .map((entry) => entry.path));

    P.ui.trackList.querySelectorAll(".music-track").forEach((item) => {
      const index = Number(item.dataset.index);
      const track = P.state.album?.tracks[index];
      const active = activeAlbum && current.index === index;
      const isPlaying = active && playing;
      const isQueued = !!track && queuedPaths.has(track.path);
      item.classList.toggle("is-active", active);
      item.classList.toggle("is-playing", isPlaying);
      item.classList.toggle("is-queued", isQueued);
      const label = `${isPlaying ? P.t("musicPause") : P.t("musicPlay")}: ${P.state.album?.tracks[index]?.title || ""}`;
      [".music-track-button", ".music-track-info"].forEach((selector) => {
        const el = item.querySelector(selector);
        if (!el) return;
        el.setAttribute("aria-pressed", String(active));
        el.setAttribute("aria-label", label);
      });
      const addButton = item.querySelector(".music-track-queue");
      if (addButton) {
        addButton.setAttribute("title", isQueued ? P.t("musicAlreadyQueued") : P.t("musicAddToQueue"));
        addButton.setAttribute("aria-pressed", String(isQueued));
      }
    });
  }

  function seedDurations() {
    if (!P.state.catalog?.albums) return;
    for (const album of P.state.catalog.albums) {
      for (const track of album.tracks || []) {
        if (Number.isFinite(track.duration) && track.duration > 0) {
          P.state.durations.set(track.path, track.duration);
        }
      }
    }
  }

  function applyDurations() {
    const api = P.player();
    if (!api || !P.state.album) return;
    const { current, duration } = api.getState();
    if (!current || !Number.isFinite(duration) || duration <= 0 || current.albumId !== P.state.album.id) return;
    const track = P.state.album.tracks[current.index];
    if (!track) return;
    P.state.durations.set(track.path, duration);
    const label = P.ui.trackList?.querySelector(`.music-track[data-index="${current.index}"] .music-track-duration`);
    if (label) label.textContent = P.formatTime(duration);
  }

  function selectAlbum(album, options = {}) {
    if (!album) return;
    P.state.album = album;
    P.renderAlbums();
    P.renderAlbum({ scroll: options.scroll === true });
    try { localStorage.setItem(P.STORAGE_ALBUM, album.id); } catch {}
    P.player()?.setContext(album);
    if (options.updateHash !== false) {
      const hash = `#${encodeURIComponent(album.id)}`;
      if (window.location.hash !== hash) {
        window.history.replaceState(window.history.state, "", hash);
      }
    }
  }

  function playTrack(index, options = {}) {
    if (!P.state.album || !P.state.album.tracks[index]) return;
    P.player()?.playTrack(P.state.album, index, options);
    P.markActiveTrack();
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
  }}
