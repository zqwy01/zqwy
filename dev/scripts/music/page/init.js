/* music/init.js — модуль скрипта music.js. */
export function install(P) {
  Object.assign(P, { init, doInit });


  async function init() {
    P.refresh();
    if (!P.ui.albumList || !P.ui.trackList) return; // another catalog page is active
    P.loadSavedView();
    P.applyFullscreen(false);
    if (P.inFlight) return P.inFlight;
    P.inFlight = P.doInit();
    try { await P.inFlight; } finally { P.inFlight = null; }
  }

  async function doInit() {
    if (P.state.catalog) {
      P.renderAlbums();
      P.renderAlbum();
      return;
    }

    if (P.ui.albumEmpty) {
      P.ui.albumEmpty.hidden = false;
      P.ui.albumEmpty.textContent = P.t("musicCatalogLoading");
    }
    try {
      const response = await fetch("../data/music-catalog.json", { cache: "no-store" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      P.state.catalog = await response.json();
      if (!P.state.catalog || !Array.isArray(P.state.catalog.albums)) throw new Error("bad catalog");
      P.seedDurations();
    } catch {
      if (P.ui.albumTitle) P.ui.albumTitle.textContent = P.t("musicCatalogUnavailable");
      if (P.ui.albumSubtitle) P.ui.albumSubtitle.textContent = "";
      if (P.ui.albumEmpty) {
        P.ui.albumEmpty.hidden = false;
        P.ui.albumEmpty.textContent = P.t("musicCatalogError");
      }
      return;
    }

    if (P.ui.albumEmpty) P.ui.albumEmpty.hidden = true;
    P.renderAlbums();

    // Search results link to ./music/?album=<id>&track=<n>#<id>.
    const params = new URLSearchParams(window.location.search);
    const albumParam = params.get("album");
    const trackParam = params.get("track");
    const fromHash = decodeURIComponent(window.location.hash.replace(/^#/, ""));
    let saved = "";
    try { saved = localStorage.getItem(P.STORAGE_ALBUM) || ""; } catch {}
    const album = P.state.catalog.albums.find((item) => item.id === albumParam)
      || P.state.catalog.albums.find((item) => item.id === fromHash)
      || P.state.catalog.albums.find((item) => item.id === saved)
      || P.state.catalog.albums[0];
    if (!album) return;

    P.selectAlbum(album, { updateHash: false });

    if (albumParam && trackParam !== null) {
      const index = Number(trackParam);
      if (Number.isInteger(index) && album.tracks[index]) {
        // Shared links carry the exact position as ?t=<seconds>.
        const rawTime = Number(params.get("t"));
        const startTime = Number.isFinite(rawTime) && rawTime >= 0 ? rawTime : 0;
        P.playTrack(index, { startTime });
      }
      // Consume the deep-link query so re-entering the page (or a bfcache
      // restore) does not replay the track; keep the album in the hash.
      const clean = `${window.location.pathname}#${encodeURIComponent(album.id)}`;
      window.history.replaceState(window.history.state, "", clean);
    }
  }}
