/* music/events.js — модуль скрипта music.js. */
export function bindEvents(P) {


  /* ---------- delegated, SPA-safe events ---------- */

  document.addEventListener("click", (event) => {
    const target = event.target instanceof Element ? event.target : null;
    if (!target) return;

    const viewButton = target.closest("[data-album-view]");
    if (viewButton && P.ui.viewButtons?.includes(viewButton)) {
      P.changeView(viewButton.dataset.albumView);
      P.pulseViewButton(viewButton);
      return;
    }

    if (target.closest("#releasesFullscreen")) {
      const next = !P.state.fullscreen;
      if (next && P.state.collapsed) P.applyCollapsed(false);
      P.applyFullscreen(next);
      return;
    }

    if (target.closest("#tracksExpand")) {
      P.applyCollapsed(!P.state.collapsed);
      return;
    }

    const coverTrigger = target.closest("[data-cover-open]");
    if (coverTrigger && (P.ui.albumCover?.contains(coverTrigger) || P.ui.albumList?.contains(coverTrigger))) {
      P.openCover(coverTrigger);
      return;
    }

    if (target.closest("[data-cover-close]")) { P.closeCover(); return; }

    const albumButton = target.closest("button[data-album]");
    if (albumButton && P.ui.albumList?.contains(albumButton) && P.state.catalog) {
      const album = P.state.catalog.albums.find((item) => item.id === albumButton.dataset.album);
      if (album) {
        // Full-screen mode shows releases first; choosing one reveals its tracks.
        if (P.state.fullscreen) P.applyFullscreen(false);
        P.selectAlbum(album, { scroll: true });
      }
      return;
    }

    const queueAdd = target.closest(".music-track-queue");
    if (queueAdd && P.ui.trackList?.contains(queueAdd) && P.state.album) {
      const index = Number(queueAdd.dataset.index);
      P.player()?.enqueue(P.state.album, index);
      return;
    }

    // Both the number button and the title button start/pause the track.
    const trackButton = target.closest(".music-track-button, .music-track-info");
    if (trackButton && P.ui.trackList?.contains(trackButton)) {
      const index = Number(trackButton.dataset.index);
      const api = P.player();
      const current = api ? api.getState().current : null;
      const playButton = trackButton.closest(".music-track")?.querySelector(".music-track-button");
      P.pulseTrackButton(playButton);
      if (current && P.state.album && current.albumId === P.state.album.id && current.index === index) {
        api.toggle();
        P.markActiveTrack();
      } else {
        P.playTrack(index);
      }
    }
  });

  document.addEventListener("input", (event) => {
    if (event.target === P.ui.albumFilter) P.renderAlbums();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      if (P.coverIsOpen()) { P.closeCover(); return; }
      if (P.state.fullscreen) P.applyFullscreen(false);
      else if (P.state.collapsed) P.applyCollapsed(false);
      return;
    }
    const target = event.target instanceof Element ? event.target : null;
    if (target && P.ui.albumCover?.contains(target) && (event.key === "Enter" || event.key === " ")) {
      event.preventDefault();
      P.openCover(P.ui.albumCover);
    }
  });

  // The global player emits this on every state change (track, play/pause,
  // duration, engine, settings). Keep the catalog's active row and track
  // durations in sync without owning any playback logic here.
  window.addEventListener("zqwy:playerstate", () => {
    P.markActiveTrack();
    P.applyDurations();
  });

  window.addEventListener("hashchange", () => {
    if (!P.state.catalog) return;
    const id = decodeURIComponent(window.location.hash.replace(/^#/, ""));
    const album = P.state.catalog.albums.find((item) => item.id === id);
    if (album && album !== P.state.album) P.selectAlbum(album, { updateHash: false, scroll: true });
  });

  P.init();
  // Catalog rows, counts and track buttons are built in JS, so data-i18n
  // markup alone cannot translate them. Rebuild them on a site language change.
  window.addEventListener("zqwy:languagechange", () => {
    P.refresh();
    if (!P.state.catalog) return;
    P.renderAlbums();
    P.renderAlbum();
    P.applyFullscreen(P.state.fullscreen);
    P.applyCollapsed(P.state.collapsed);
    P.applyDurations();
  });

  window.addEventListener("zqwy:pagechange", () => { P.closeCover(); P.init(); });
  window.addEventListener("resize", () => P.fitSidebarToTitles());
  document.fonts?.ready.then(() => P.fitSidebarToTitles());}
