/* music/view.js — модуль скрипта music.js. */
export function install(P) {
  Object.assign(P, { refresh, applyView, loadSavedView, changeView, applyFullscreen, applyCollapsed, fitSidebarToTitles, pulseViewButton });


  function refresh() {
    P.ensureLightbox();
    P.ui = {
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
    if (P.ui.expandBtn) {
      const label = P.state.collapsed ? P.t("musicShowReleases") : P.t("musicHideReleases");
      P.ui.expandBtn.setAttribute("aria-pressed", String(P.state.collapsed));
      P.ui.expandBtn.setAttribute("aria-label", label);
      P.ui.expandBtn.setAttribute("title", P.state.collapsed
        ? P.t("musicShowReleasesTip")
        : P.t("musicHideReleasesTip"));
    }
  }

  /* ---------- release view mode ---------- */

  function applyView(nextView, persist = true) {
    P.state.view = P.VIEW_MODES.has(nextView) ? nextView : "list";
    document.body.dataset.musicView = P.state.view;
    for (const node of [P.ui.albumList, P.ui.musicLayout]) {
      node?.classList.remove("is-list", "is-cards", "is-large");
      node?.classList.add(`is-${P.state.view}`);
    }
    const viewOrder = ["list", "cards", "large"];
    document.querySelector(".album-view-toggle")?.style.setProperty("--view-index", String(viewOrder.indexOf(P.state.view)));
    P.ui.viewButtons?.forEach((button) => {
      button.setAttribute("aria-pressed", String(button.dataset.albumView === P.state.view));
    });
    if (persist) {
      try { localStorage.setItem(P.STORAGE_VIEW, P.state.view); } catch {}
    }
  }

  function loadSavedView() {
    let saved = "";
    try { saved = localStorage.getItem(P.STORAGE_VIEW) || ""; } catch {}
    P.applyView(P.VIEW_MODES.has(saved) ? saved : "list", false);
  }

  function changeView(nextView) {
    const previous = P.captureReleaseRects();
    P.applyView(nextView);
    P.renderAlbums();
    P.animateReleaseRects(previous);
  }

  /* ---------- full-screen releases mode ---------- */

  function applyFullscreen(on) {
    const previous = P.captureReleaseRects();
    P.state.fullscreen = !!on;
    document.body.classList.toggle("music-releases-fullscreen", P.state.fullscreen);
    P.ui.musicLayout?.classList.toggle("is-fullscreen", P.state.fullscreen);
    P.ui.fullscreenBtn?.setAttribute("aria-pressed", String(P.state.fullscreen));
    if (P.ui.fullscreenLabel) {
      P.ui.fullscreenLabel.textContent = P.state.fullscreen ? P.t("musicHideReleases") : P.t("musicReleasesFullscreen");
    }
    if (P.ui.fullscreenBtn) {
      const label = P.state.fullscreen ? P.t("musicHideReleases") : P.t("musicReleasesFullscreen");
      P.ui.fullscreenBtn.setAttribute("aria-label", label);
      P.ui.fullscreenBtn.setAttribute("title", label);
    }
    P.renderAlbums();
    P.animateReleaseRects(previous);
  }

  // Hide the release sidebar entirely and let the selected album's tracks use
  // the whole page. The same button restores the release list.
  function applyCollapsed(on) {
    P.state.collapsed = !!on;
    document.body.classList.toggle("music-releases-collapsed", P.state.collapsed);
    if (P.state.collapsed && P.state.fullscreen) P.applyFullscreen(false);
    const label = P.state.collapsed ? P.t("musicShowReleases") : P.t("musicHideReleases");
    if (P.ui.expandBtn) {
      P.ui.expandBtn.setAttribute("aria-pressed", String(P.state.collapsed));
      P.ui.expandBtn.setAttribute("aria-label", label);
      P.ui.expandBtn.setAttribute("title", P.state.collapsed
        ? P.t("musicShowReleasesTip")
        : P.t("musicHideReleasesTip"));
    }
    if (!P.state.collapsed) P.fitSidebarToTitles();
  }

  // The release column hugs the longest visible title, leaving the rest of the
  // width for the track list. Measured with the real font of the row label.
  function fitSidebarToTitles() {
    if (!P.ui.albumList || !P.ui.musicLayout || P.state.fullscreen || !P.measureCtx) return;
    const labels = [...P.ui.albumList.querySelectorAll(".album-item-title, .album-card-title")];
    if (!labels.length) return;
    const style = getComputedStyle(labels[0]);
    P.measureCtx.font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
    let max = 0;
    labels.forEach((label) => {
      max = Math.max(max, P.measureCtx.measureText(label.textContent || "").width);
    });
    const large = P.state.view === "large";
    const cards = P.state.view === "cards" || large;
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
    P.ui.musicLayout.style.setProperty(property, `${width}px`);
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
  }}
