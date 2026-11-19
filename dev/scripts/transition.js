/*
 * Monolithic transitions between catalog pages.
 *
 * Instead of a full reload, internal links are fetched and only .page-content
 * is swapped. The logo/search row, the theme and — most importantly — the
 * persistent player live outside the swapped content, so playback continues
 * while the visitor moves between links, music and every other catalog page.
 *
 * Page-specific CSS and JS are now loaded BEFORE the swap. That removes the
 * old flash of unstyled content: the new markup is only revealed once its
 * stylesheet, scripts and fonts are ready. A delayed loading overlay covers
 * slow navigations without flashing on fast ones.
 */
(() => {
  "use strict";

  const root = document.documentElement;
  const CONTENT = ".page-content";
  const reduced = window.matchMedia
    ? window.matchMedia("(prefers-reduced-motion: reduce)")
    : null;
  // Must match --catalog-open-duration in base.css so the outgoing page uses
  // the same motion as the catalog overlay opened by the logo.
  const LEAVE_MS = reduced && reduced.matches ? 0 : 420;
  const LOADER_DELAY = 180;

  // pushState changes document.baseURI, which silently re-resolves every
  // remaining relative href/src (./styles/base.css would become
  // /music/styles/base.css). Pin them to absolute URLs up front: the styles
  // keep working and the dedup checks below stay reliable on later moves.
  document.querySelectorAll("link[href], script[src]").forEach((el) => {
    if (el.hasAttribute("href")) el.setAttribute("href", el.href);
    if (el.hasAttribute("src")) el.setAttribute("src", el.src);
  });

  /* ---------- delayed loading overlay ---------- */

  const LOADER_CSS = `
.zqwy-page-loader{position:fixed;inset:0;z-index:1000010;display:flex;align-items:center;justify-content:center;box-sizing:border-box;background:var(--bg,#000);color:var(--text,#fff);opacity:0;visibility:hidden;pointer-events:none;transition:opacity .18s ease,visibility 0s linear .18s}
.zqwy-page-loader.is-visible{opacity:1;visibility:visible;pointer-events:auto;transition:opacity .18s ease,visibility 0s}
.zqwy-page-loader-card{display:flex;flex-direction:column;align-items:center;gap:12px;padding:22px 28px;border:1px solid var(--border,#2a2a2a);border-radius:14px;background:var(--bg-elevated,#0b0b0b)}
.zqwy-page-loader-spinner{width:28px;height:28px;border:2px solid var(--border,#2a2a2a);border-top-color:var(--text,#fff);border-radius:50%;animation:zqwy-loader-spin .8s linear infinite}
.zqwy-page-loader-text{font-family:var(--font,system-ui,sans-serif);font-size:.92rem;letter-spacing:.03em}
@keyframes zqwy-loader-spin{to{transform:rotate(360deg)}}
@media (prefers-reduced-motion:reduce){.zqwy-page-loader-spinner{animation:none}}
`;

  let loader = null;
  let initialLoaderTimer = 0;
  let loaderActive = false;

  function ensureLoader() {
    if (loader) return loader;
    const style = document.createElement("style");
    style.id = "zqwyPageLoaderStyle";
    style.textContent = LOADER_CSS;
    document.head.appendChild(style);

    loader = document.createElement("div");
    loader.className = "zqwy-page-loader";
    loader.id = "zqwyPageLoader";
    loader.setAttribute("aria-hidden", "true");
    loader.innerHTML =
      '<div class="zqwy-page-loader-card">' +
      '<span class="zqwy-page-loader-spinner" aria-hidden="true"></span>' +
      '<span class="zqwy-page-loader-text">Загрузка…</span>' +
      "</div>";
    document.body.appendChild(loader);
    return loader;
  }

  function showLoader() {
    ensureLoader();
    loaderActive = true;
    loader.classList.add("is-visible");
  }

  function hideLoader() {
    if (initialLoaderTimer) {
      window.clearTimeout(initialLoaderTimer);
      initialLoaderTimer = 0;
    }
    loaderActive = false;
    loader?.classList.remove("is-visible");
  }

  ensureLoader();
  window.addEventListener("load", hideLoader, { once: true });
  if (document.readyState !== "complete") {
    initialLoaderTimer = window.setTimeout(() => {
      if (document.readyState !== "complete") showLoader();
      initialLoaderTimer = 0;
    }, LOADER_DELAY);
  }

  let navigating = false;
  // The URL whose content is actually on screen. location can change first
  // (history.back() → popstate), so comparing against location alone skips the
  // content swap and leaves the previous page rendered under the new URL.
  let renderedUrl = window.location.href;

  const sleep = (ms) => new Promise((resolve) => window.setTimeout(resolve, ms));

  function isInternal(url) {
    if (url.origin !== window.location.origin) return false;
    return url.protocol === "http:" || url.protocol === "https:" || url.protocol === "file:";
  }

  function samePath(url) {
    const rendered = new URL(renderedUrl, window.location.href);
    return url.pathname === rendered.pathname && url.search === rendered.search;
  }

  /* ---------- page assets: load before the markup is revealed ---------- */

  function preloadStyles(doc, url) {
    const loaded = new Set(
      [...document.querySelectorAll('link[rel="stylesheet"][href]')]
        .map((el) => el.href),
    );
    const jobs = [];
    for (const tag of doc.querySelectorAll('link[rel="stylesheet"][href]')) {
      const cssUrl = new URL(tag.getAttribute("href"), url.href).href;
      if (loaded.has(cssUrl)) continue;
      loaded.add(cssUrl);
      jobs.push(new Promise((resolve) => {
        const link = document.createElement("link");
        link.rel = "stylesheet";
        link.href = cssUrl;
        link.onload = resolve;
        link.onerror = resolve; // a failed CSS must not block navigation
        document.head.appendChild(link);
      }));
    }
    return Promise.all(jobs);
  }

  function preloadScripts(doc, url) {
    const loaded = new Set(
      [...document.querySelectorAll("script[src]")].map((el) => el.src),
    );
    const jobs = [];
    for (const tag of doc.querySelectorAll("script[src]")) {
      const scriptUrl = new URL(tag.getAttribute("src"), url.href).href;
      if (loaded.has(scriptUrl)) continue;
      loaded.add(scriptUrl);
      jobs.push(new Promise((resolve) => {
        const script = document.createElement("script");
        script.src = scriptUrl;
        script.onload = resolve;
        script.onerror = resolve; // a failed script must not block navigation
        document.head.appendChild(script);
      }));
    }
    return Promise.all(jobs);
  }

  async function waitForFonts() {
    if (!document.fonts?.ready) return;
    try { await Promise.race([document.fonts.ready, sleep(600)]); } catch {}
  }

  async function navigate(href, options = {}) {
    const push = options.push === true;
    if (navigating) return;
    navigating = true;

    let url;
    try { url = new URL(href, window.location.href); } catch { navigating = false; return; }

    let loaderTimer = 0;
    let loaderShown = false;
    loaderTimer = window.setTimeout(() => {
      loaderShown = true;
      showLoader();
    }, LOADER_DELAY);

    root.classList.add("page-leaving");
    if (LEAVE_MS) await sleep(LEAVE_MS);

    try {
      const response = await fetch(url.href, { cache: "no-store" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const html = await response.text();
      const doc = new DOMParser().parseFromString(html, "text/html");
      const next = doc.querySelector(CONTENT);
      const current = document.querySelector(CONTENT);
      if (!next || !current) throw new Error("page-content not found");

      // Load the new page's stylesheet and scripts first. Only after every
      // asset has settled do we replace the DOM, so nothing ever renders
      // half-styled or without its event handlers.
      await preloadStyles(doc, url);
      await preloadScripts(doc, url);

      if (push) window.history.pushState({ zqwy: true, url: url.href }, "", url.href);

      document.title = doc.title || document.title;
      current.replaceWith(next);
      renderedUrl = url.href;
      root.classList.remove("page-leaving");
      window.scrollTo(0, 0);

      await waitForFonts();
      window.dispatchEvent(new CustomEvent("zqwy:pagechange", {
        detail: { href: url.href, path: url.pathname, document: doc },
      }));

      // A `data-back` logo lands on the home page with the catalog already
      // open. The home logo is a real button, so let menu.js handle the click
      // through its normal delegated listener (after its pagechange refresh).
      if (options.openMenu) {
        const logo = document.getElementById("menuOpenButton");
        if (logo && logo.tagName === "BUTTON") logo.click();
      }
    } catch (error) {
      root.classList.remove("page-leaving");
      // Network failure or a malformed page: let the browser do a real load.
      window.location.assign(url.href);
    } finally {
      if (loaderTimer) window.clearTimeout(loaderTimer);
      if (loaderShown) hideLoader();
      loaderActive = false;
      navigating = false;
    }
  }

  // Public helper used by the search form on pages without a results area.
  window.zqwyNavigate = (href) => navigate(href, { push: true });

  document.addEventListener("click", (ev) => {
    if (ev.defaultPrevented || ev.button !== 0) return;
    if (ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.altKey) return;

    const link = ev.target instanceof Element ? ev.target.closest("a[href]") : null;
    if (!link) return;
    if (link.target && link.target !== "_self") return;
    if (link.hasAttribute("download")) return;

    const raw = link.getAttribute("href");
    if (!raw || raw.startsWith("#")) return;

    let url;
    try { url = new URL(raw, window.location.href); } catch { return; }
    if (!isInternal(url)) return;
    if (samePath(url)) return;

    ev.preventDefault();
    if (navigating) return;

    if (link.hasAttribute("data-back")) {
      // Always return to the catalog page named by href, regardless of how
      // the visitor arrived here, and open the catalog overlay on arrival.
      navigate(url.href, { push: true, openMenu: true });
      return;
    }
    navigate(url.href, { push: true });
  }, true);

  window.addEventListener("popstate", () => {
    if (samePath(new URL(window.location.href))) return;
    navigate(window.location.href, { push: false });
  });

  // bfcache: the page is restored as-is, just clear any leftover leave state.
  // On a normal first load pageshow also fires, but scripts have already
  // initialised — only a real bfcache restore needs a pagechange event.
  window.addEventListener("pageshow", (event) => {
    navigating = false;
    root.classList.remove("page-leaving");
    if (event && event.persisted) {
      hideLoader();
      window.dispatchEvent(new CustomEvent("zqwy:pagechange", {
        detail: { href: window.location.href, path: window.location.pathname, document: document },
      }));
    }
  });
})();
