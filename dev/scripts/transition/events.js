/* transition/events.js — модуль скрипта transition.js. */
export function bindEvents(P) {

  // The whole page animates exactly like the catalog overlay opened by the
  // logo. The class is unconditional: a bare @media rule was silently dropping
  // the motion in Firefox, and the overlay itself never honoured that query.
  // Reduced-motion users still get a (shorter) fade, never a dead jump.
  P.root.classList.add("zqwy-motion");
  if (P.reduced) {
    const onPreferenceChange = () => {
      P.leaveMs = P.durationFor();
      P.loaderDelay = P.leaveMs + 60;
    };
    if (typeof P.reduced.addEventListener === "function") {
      P.reduced.addEventListener("change", onPreferenceChange);
    } else if (typeof P.reduced.addListener === "function") {
      P.reduced.addListener(onPreferenceChange);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      P.playPageEnter(document.querySelector(P.CONTENT));
    }, { once: true });
  } else {
    P.playPageEnter(document.querySelector(P.CONTENT));
  }

  // pushState changes document.baseURI, which silently re-resolves every
  // remaining relative href/src (./styles/base.css would become
  // /music/styles/base.css). Pin them to absolute URLs up front: the styles
  // keep working and the dedup checks below stay reliable on later moves.
  document.querySelectorAll("link[href], script[src]").forEach((el) => {
    if (el.hasAttribute("href")) el.setAttribute("href", el.href);
    if (el.hasAttribute("src")) el.setAttribute("src", el.src);
  });

  P.ensureLoader();
  window.addEventListener("load", P.hideLoader, { once: true });
  if (document.readyState !== "complete") {
    P.initialLoaderTimer = window.setTimeout(() => {
      if (document.readyState !== "complete") P.showLoader();
      P.initialLoaderTimer = 0;
    }, P.loaderDelay);
  }

  // Public helper used by the search form on pages without a results area.
  window.zqwyNavigate = (href) => P.navigate(href, { push: true });

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
    if (!P.isInternal(url)) return;
    if (P.samePath(url)) return;

    ev.preventDefault();
    if (P.navigating) return;

    if (link.hasAttribute("data-back")) {
      // Always return to the catalog page named by href, regardless of how
      // the visitor arrived here, and open the catalog overlay on arrival.
      P.navigate(url.href, { push: true, openMenu: true });
      return;
    }
    P.navigate(url.href, { push: true });
  }, true);

  window.addEventListener("popstate", () => {
    if (P.samePath(new URL(window.location.href))) return;
    P.navigate(window.location.href, { push: false });
  });

  // bfcache: the page is restored as-is, just clear any leftover leave state.
  // On a normal first load pageshow also fires, but scripts have already
  // initialised — only a real bfcache restore needs a pagechange event.
  window.addEventListener("pageshow", (event) => {
    P.navigating = false;
    P.root.classList.remove("page-leaving");
    if (event && event.persisted) {
      P.hideLoader();
      window.dispatchEvent(new CustomEvent("zqwy:pagechange", {
        detail: { href: window.location.href, path: window.location.pathname, document: document },
      }));
    }
  });}
