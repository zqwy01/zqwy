/* Регистрация service worker и синхронизация head-ссылок при SPA-навигации.
   Подключается во все страницы dist/ генератором scripts/build_pwa.mjs. */

const appBase = new URL("../", import.meta.url);
const swUrl = new URL("sw.js", appBase).href;
const manifestUrl = new URL("manifest.webmanifest", appBase).href;
const appleIconUrl = new URL("assets/icons/apple-touch-icon.png", appBase).href;

// Head при SPA-переходах не меняется, поэтому относительные ссылки из
// исходной страницы могут указывать не туда. Приводим их к корню приложения.
function syncHeadLinks() {
  const manifest = document.querySelector('link[rel="manifest"]');
  if (manifest && manifest.href !== manifestUrl) manifest.href = manifestUrl;

  const appleIcon = document.querySelector('link[rel="apple-touch-icon"]');
  if (appleIcon && appleIcon.href !== appleIconUrl) appleIcon.href = appleIconUrl;
}

syncHeadLinks();
window.addEventListener("zqwy:pagechange", syncHeadLinks);

const STRINGS = {
  ru: { message: "Доступна новая версия", update: "Обновить", later: "Позже" },
  en: { message: "A new version is available", update: "Update", later: "Later" },
  de: { message: "Eine neue Version ist verfügbar", update: "Aktualisieren", later: "Später" },
};

function notifyUpdate(worker) {
  if (document.querySelector("[data-zqwy-pwa-update]")) return;

  const lang = document.documentElement.lang;
  const t = STRINGS[lang] || STRINGS.ru;

  const style = document.createElement("style");
  style.id = "zqwyPwaUpdateStyle";
  style.textContent =
    "[data-zqwy-pwa-update]{position:fixed;left:50%;bottom:16px;transform:translateX(-50%);" +
    "z-index:1000001;display:flex;gap:12px;align-items:center;max-width:calc(100vw - 32px);" +
    "padding:10px 14px;border:1px solid #333;border-radius:10px;background:#141414;" +
    "color:#fff;font:14px/1.4 system-ui,sans-serif;box-shadow:0 8px 24px #0008}" +
    "[data-zqwy-pwa-update] button{cursor:pointer;border:1px solid #555;border-radius:6px;" +
    "padding:5px 10px;background:#222;color:#fff;font:inherit}" +
    "[data-zqwy-pwa-update] [data-update]{background:#fff;color:#000;border-color:#fff}";
  document.head.appendChild(style);

  const toast = document.createElement("div");
  toast.dataset.zqwyPwaUpdate = "";
  toast.setAttribute("role", "status");
  toast.setAttribute("aria-live", "polite");

  const text = document.createElement("span");
  text.textContent = t.message;

  const later = document.createElement("button");
  later.type = "button";
  later.textContent = t.later;

  const update = document.createElement("button");
  update.type = "button";
  update.dataset.update = "";
  update.textContent = t.update;

  const close = () => {
    toast.remove();
    style.remove();
  };
  later.addEventListener("click", close);
  update.addEventListener("click", () => {
    close();
    worker.postMessage({ type: "SKIP_WAITING" });
  });

  toast.append(text, later, update);
  document.body.appendChild(toast);
}

async function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  try {
    const registration = await navigator.serviceWorker.register(swUrl, {
      scope: appBase.pathname,
    });

    registration.addEventListener("updatefound", () => {
      const worker = registration.installing;
      if (!worker) return;
      worker.addEventListener("statechange", () => {
        // Первая установка не требует уведомления: controlling worker ещё нет.
        if (worker.state === "installed" && navigator.serviceWorker.controller) {
          notifyUpdate(worker);
        }
      });
    });

    if (registration.waiting && navigator.serviceWorker.controller) {
      notifyUpdate(registration.waiting);
    }

    // Полный офлайн-кэш (~26 МБ) догружаем уже после активации: если качать
    // его внутри install, Chrome Android не показывает кнопку «Установить»,
    // пока SW не станет активным (на GitHub Pages это ~25 секунд).
    let prefetchRequested = false;
    const requestPrefetch = () => {
      if (prefetchRequested) return;
      const worker = navigator.serviceWorker.controller || registration.active;
      if (!worker) return;
      prefetchRequested = true;
      const send = () => worker.postMessage({ type: "PREFETCH" });
      if ("requestIdleCallback" in window) {
        window.requestIdleCallback(send, { timeout: 3000 });
      } else {
        setTimeout(send, 1000);
      }
    };
    requestPrefetch();
    navigator.serviceWorker.addEventListener("controllerchange", requestPrefetch);

    let reloaded = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (reloaded) return;
      reloaded = true;
      window.location.reload();
    });
  } catch {
    // PWA — необязательный слой: при отказе регистрации сайт работает как обычно.
  }
}

if (document.readyState === "complete") {
  registerServiceWorker();
} else {
  window.addEventListener("load", registerServiceWorker, { once: true });
}
