/* transition/preload.js — модуль скрипта transition.js. */
export function install(P) {
  Object.assign(P, { isInternal, samePath, preloadStyles, preloadScripts, waitForFonts });


  function isInternal(url) {
    if (url.origin !== window.location.origin) return false;
    return url.protocol === "http:" || url.protocol === "https:" || url.protocol === "file:";
  }

  function samePath(url) {
    const rendered = new URL(P.renderedUrl, window.location.href);
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
        // The player is an ES module. Without copying `type` the browser would
        // evaluate it as a classic script and fail on import/import.meta.
        if (tag.type) script.type = tag.type;
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
    try { await Promise.race([document.fonts.ready, P.sleep(600)]); } catch {}
  }}
