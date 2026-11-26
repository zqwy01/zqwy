#!/usr/bin/env node
/* Генератор PWA-слоя в уже собранном dist/.
   Вызывается build_dist.sh после минификации: создаёт sw.js со списком
   precache и добавляет manifest/иконки/регистрацию во все HTML-страницы. */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PROJECT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DIST_DIR = path.join(PROJECT_DIR, "dist");

const MAX_PRECACHE_BYTES = 6 * 1024 * 1024;
const PRECACHE_EXTENSIONS = new Set([
  ".html", ".htm", ".css", ".js", ".json", ".webmanifest",
  ".webp", ".png", ".svg", ".ico", ".woff", ".woff2", ".ttf",
]);
const MEDIA_EXTENSIONS = new Set([
  ".opus", ".mp3", ".wav", ".ogg", ".oga", ".m4a", ".aac", ".flac",
]);
// Оставляем TiddlyWiki в покое: это готовый одностраничник со встроенным JS.
const SKIP_INJECTION = new Set(["wiki/tiddlywiki/index.html"]);
const MARKER = "data-zqwy-pwa";

if (!fs.existsSync(DIST_DIR)) {
  console.error(`Ошибка: нет директории сборки ${DIST_DIR}`);
  process.exit(1);
}

function walk(dir, base = DIST_DIR) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const result = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      result.push(...walk(full, base));
    } else if (entry.isFile()) {
      result.push({
        full,
        relative: path.relative(base, full).split(path.sep).join("/"),
        size: fs.statSync(full).size,
      });
    }
  }
  return result;
}

function readVersion() {
  try {
    const info = JSON.parse(fs.readFileSync(path.join(DIST_DIR, "data/build-info.json"), "utf8"));
    return [info.version, info.build, info.commit].filter(Boolean).join(".");
  } catch {
    return "unknown";
  }
}

function swSource(version, precache) {
  return `/* Сгенерировано scripts/build_pwa.mjs — не редактировать вручную. */
const VERSION = ${JSON.stringify(version)};
const CACHE_PREFIX = "zqwy-";
const SHELL_CACHE = CACHE_PREFIX + "shell-" + VERSION;
const RUNTIME_CACHE = CACHE_PREFIX + "runtime-" + VERSION;
const PRECACHE = ${JSON.stringify(precache, null, 2)};

const MEDIA_RE = /\\.(opus|mp3|wav|ogg|oga|m4a|aac|flac)$/i;

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(SHELL_CACHE);
    await Promise.all(PRECACHE.map(async (url) => {
      // Один отсутствующий файл не должен срывать установку всего SW.
      try { await cache.add(url); } catch (error) {}
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys
      .filter((key) => key.startsWith(CACHE_PREFIX) && key !== SHELL_CACHE && key !== RUNTIME_CACHE)
      .map((key) => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") self.skipWaiting();
});

function cleanRequest(request) {
  // Cache API запрещает no-store, а SPA-переходы и часть данных используют его.
  return new Request(request.url, {
    method: "GET",
    credentials: "same-origin",
    redirect: "follow",
  });
}

async function putInRuntime(request, response) {
  if (!response || !response.ok || response.type !== "basic") return;
  try {
    const cache = await caches.open(RUNTIME_CACHE);
    await cache.put(cleanRequest(request), response.clone());
  } catch (error) {}
}

function isDocumentRequest(request, url) {
  if (request.mode === "navigate" || request.destination === "document") return true;
  return url.pathname.endsWith("/") || url.pathname.endsWith(".html") || url.pathname.endsWith(".htm");
}

async function networkFirst(event) {
  const request = event.request;
  try {
    const response = await fetch(request);
    if (response && response.ok) event.waitUntil(putInRuntime(request, response.clone()));
    return response;
  } catch (error) {
    const url = new URL(request.url);
    const cached = await caches.match(cleanRequest(request), { ignoreSearch: true });
    if (cached) return cached;
    const indexUrl = url.pathname.endsWith("/")
      ? new URL("index.html", url)
      : new URL(url.pathname + "/index.html", url);
    const index = await caches.match(indexUrl.href);
    if (index) return index;
    const root = await caches.match(new URL("index.html", self.location.href).href);
    return root || Response.error();
  }
}

async function staleWhileRevalidate(event) {
  const request = event.request;
  const cached = await caches.match(cleanRequest(request));
  const update = fetch(request)
    .then((response) => {
      event.waitUntil(putInRuntime(request, response.clone()));
      return response;
    })
    .catch(() => null);
  event.waitUntil(update);
  if (cached) return cached;
  return (await update) || Response.error();
}

async function cacheFirst(event) {
  const request = event.request;
  const cached = await caches.match(cleanRequest(request));
  if (cached) return cached;
  try {
    const response = await fetch(request);
    event.waitUntil(putInRuntime(request, response.clone()));
    return response;
  } catch (error) {
    return Response.error();
  }
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  let url;
  try { url = new URL(request.url); } catch (error) { return; }
  if (url.origin !== self.location.origin) return;

  // Музыка остаётся онлайн: range-запросы и 545 МБ треков не кэшируются.
  if (MEDIA_RE.test(url.pathname)) return;

  if (isDocumentRequest(request, url)) {
    event.respondWith(networkFirst(event));
  } else if (url.pathname.endsWith(".json")) {
    event.respondWith(staleWhileRevalidate(event));
  } else {
    event.respondWith(cacheFirst(event));
  }
});
`;
}

function injectIntoHtml(file) {
  const html = fs.readFileSync(file, "utf8");
  if (html.includes(MARKER)) return false;

  const relativeDir = path.relative(path.dirname(file), DIST_DIR).split(path.sep).join("/");
  const prefix = relativeDir ? relativeDir + "/" : "./";
  const tags = [
    `<!-- ${MARKER} -->`,
    `<link rel="manifest" href="${prefix}manifest.webmanifest" ${MARKER}>`,
    `<meta name="theme-color" content="#000000" ${MARKER}>`,
    `<link rel="apple-touch-icon" href="${prefix}assets/icons/apple-touch-icon.png" ${MARKER}>`,
    `<script type="module" src="${prefix}scripts/pwa.js" ${MARKER}></script>`,
  ].join("\n  ");

  let updated;
  if (/<\/head\s*>/i.test(html)) {
    updated = html.replace(/<\/head\s*>/i, (closing) => `  ${tags}\n  ${closing}`);
  } else {
    updated = `  ${tags}\n` + html;
  }
  fs.writeFileSync(file, updated);
  return true;
}

const files = walk(DIST_DIR);
const version = readVersion();

const precache = files
  .filter((file) => file.relative !== "sw.js")
  .filter((file) => !file.relative.startsWith("src/tracks/"))
  .filter((file) => !file.relative.startsWith("game/src/"))
  .filter((file) => {
    const ext = path.extname(file.relative).toLowerCase();
    return !MEDIA_EXTENSIONS.has(ext)
      && PRECACHE_EXTENSIONS.has(ext)
      && file.size <= MAX_PRECACHE_BYTES;
  })
  .map((file) => "./" + file.relative)
  .sort();

fs.writeFileSync(path.join(DIST_DIR, "sw.js"), swSource(version, precache));

let injected = 0;
for (const file of files) {
  if (!/\.html?$/i.test(file.relative)) continue;
  if (SKIP_INJECTION.has(file.relative)) continue;
  if (injectIntoHtml(file.full)) injected += 1;
}

const bytes = files
  .filter((file) => precache.includes("./" + file.relative))
  .reduce((sum, file) => sum + file.size, 0);

console.log(`PWA: версия кэша ${version}`);
console.log(`PWA: precache ${precache.length} файлов, ${(bytes / 1048576).toFixed(1)} МБ`);
console.log(`PWA: регистрация добавлена на ${injected} HTML-страниц`);
