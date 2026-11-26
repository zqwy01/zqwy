/* transition/navigation.js — модуль скрипта transition.js. */
export function install(P) {
  Object.assign(P, { navigate });


  async function navigate(href, options = {}) {
    const push = options.push === true;
    if (P.navigating) return;
    P.navigating = true;

    let url;
    try { url = new URL(href, window.location.href); } catch { P.navigating = false; return; }

    let loaderTimer = 0;
    let loaderShown = false;
    loaderTimer = window.setTimeout(() => {
      loaderShown = true;
      P.showLoader();
    }, P.loaderDelay);

    // The incoming motion was left on the previous page after a navigation;
    // drop it so the leave animation wins for the outgoing DOM.
    document.querySelector(P.CONTENT)?.classList.remove("page-entering");
    P.root.classList.add("page-leaving");
    void document.body.offsetWidth; // let Firefox start the leaving animation
    if (P.leaveMs) await P.sleep(P.leaveMs);

    try {
      const response = await fetch(url.href, { cache: "no-store" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const html = await response.text();
      const doc = new DOMParser().parseFromString(html, "text/html");
      const next = doc.querySelector(P.CONTENT);
      const current = document.querySelector(P.CONTENT);
      if (!next || !current) throw new Error("page-content not found");

      // Load the new page's stylesheet and scripts first. Only after every
      // asset has settled do we replace the DOM, so nothing ever renders
      // half-styled or without its event handlers.
      await P.preloadStyles(doc, url);
      await P.preloadScripts(doc, url);
      await P.waitForFonts();

      if (push) window.history.pushState({ zqwy: true, url: url.href }, "", url.href);

      document.title = doc.title || document.title;
      current.replaceWith(next);
      P.renderedUrl = url.href;
      P.root.classList.remove("page-leaving");
      window.scrollTo(0, 0);

      // Hide the loading cover before the entrance animation, otherwise the
      // new page fades in behind an opaque overlay and the motion is invisible.
      P.hideLoader();
      P.playPageEnter(next);
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
      P.root.classList.remove("page-leaving");
      // Network failure or a malformed page: let the browser do a real load.
      window.location.assign(url.href);
    } finally {
      if (loaderTimer) window.clearTimeout(loaderTimer);
      if (loaderShown) P.hideLoader();
      P.loaderActive = false;
      P.navigating = false;
    }
  }}
