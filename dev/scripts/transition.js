/*
 * Monolithic transitions between catalog pages.
 *
 * Instead of a full reload, internal links are fetched and only .page-content
 * is swapped. The logo/search row, the theme and — most importantly — the
 * persistent player live outside .page-content, so playback continues while
 * the visitor moves between links, music and every other catalog page.
 *
 * Clicking a link, clicking a `data-back` logo (a deterministic return to the
 * catalog) and the browser Back/Forward buttons all go through the same
 * fade-out → swap → fade-in sequence. External links, new tabs, downloads,
 * hash anchors and reduced motion are left to the browser.
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

  // pushState changes document.baseURI, which silently re-resolves every
  // remaining relative href/src (./styles/base.css would become
  // /music/styles/base.css). Pin them to absolute URLs up front: the styles
  // keep working and the dedup checks below stay reliable on later moves.
  document.querySelectorAll("link[href], script[src]").forEach((el) => {
    if (el.hasAttribute("href")) el.setAttribute("href", el.href);
    if (el.hasAttribute("src")) el.setAttribute("src", el.src);
  });

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

  async function navigate(href, options = {}) {
    const push = options.push === true;
    if (navigating) return;
    navigating = true;

    let url;
    try { url = new URL(href, window.location.href); } catch { navigating = false; return; }

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

      if (push) window.history.pushState({ zqwy: true, url: url.href }, "", url.href);

      document.title = doc.title || document.title;
      current.replaceWith(next);
      renderedUrl = url.href;
      root.classList.remove("page-leaving");
      window.scrollTo(0, 0);

      // Only .page-content is swapped — the fetched document's <head> is not
      // applied. Load page-specific stylesheets (music.css, links.css) that
      // the current document does not have yet, otherwise those sections
      // render with just the base styles after SPA navigation.
      const loadedStyles = [...document.querySelectorAll('link[rel="stylesheet"][href]')]
        .map((el) => el.href);
      for (const tag of doc.querySelectorAll('link[rel="stylesheet"][href]')) {
        const cssUrl = new URL(tag.getAttribute("href"), url.href).href;
        if (loadedStyles.includes(cssUrl)) continue;
        loadedStyles.push(cssUrl);
        await new Promise((resolve) => {
          const link = document.createElement("link");
          link.rel = "stylesheet";
          link.href = cssUrl;
          link.onload = resolve;
          link.onerror = resolve; // a failed CSS must not block navigation
          document.head.appendChild(link);
        });
      }

      // Scripts inside the fetched document are not executed by DOMParser or
      // replaceWith. Load any page-specific ones (e.g. music.js) before the
      // pagechange event so their listeners are ready for the new content.
      // Asset URLs were pinned to absolute form above, so el.src stays stable.
      const loadedScripts = [...document.querySelectorAll("script[src]")].map((el) => el.src);
      for (const tag of doc.querySelectorAll("script[src]")) {
        const scriptUrl = new URL(tag.getAttribute("src"), url.href).href;
        if (loadedScripts.includes(scriptUrl)) continue;
        loadedScripts.push(scriptUrl);
        await new Promise((resolve) => {
          const script = document.createElement("script");
          script.src = scriptUrl;
          script.onload = resolve;
          script.onerror = resolve; // a failed script must not block navigation
          document.head.appendChild(script);
        });
      }

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
      window.dispatchEvent(new CustomEvent("zqwy:pagechange", {
        detail: { href: window.location.href, path: window.location.pathname, document: document },
      }));
    }
  });
})();
