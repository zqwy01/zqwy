#!/usr/bin/env node
/*
 * Собирает каталог музыки для плеера.
 *
 * Источник: src/tracks/<релиз>/... (аудиофайлы в любой вложенности).
 * Результат: dev/data/music-catalog.json — единственный файл, который
 * читает страница /music/. Пути внутри JSON хранятся от корня сайта
 * (src/tracks/...), а страница добавляет к ним префикс ../../.
 * Для каждого трека сохраняется карта formats ({opus, mp3, wav, flac})
 * с путями ко всем реально существующим версиям файла и заранее посчитанная
 * длительность (секунды) предпочтительной версии — она сразу показывается
 * в .music-track-duration, без ожидания воспроизведения.
 *
 * Аудиофайлы не изменяются: ffprobe только читает метаданные.
 * Запускается автоматически из scripts/build_dist.sh и вручную:
 *   node scripts/build_music_catalog.mjs
 */

import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { writeFileSafe } from "./lib/write-file-smb-safe.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PROJECT = path.resolve(HERE, "..");
const TRACKS_DIR = path.join(PROJECT, "src", "tracks");
const COVERS_DIR = path.join(PROJECT, "src", "covers");
const OUT_FILE = path.join(PROJECT, "dev", "data", "music-catalog.json");

const AUDIO_EXT = new Set([".opus", ".ogg", ".mp3", ".wav", ".flac", ".m4a", ".aac"]);
const COVER_EXT = [".webp", ".png", ".jpg", ".jpeg", ".avif", ".gif"];

// Порядок, в котором плеер выбирает формат, если в настройках выбранный файл
// отсутствует. opus — основной архив сайта, остальные форматы подключаются,
// как только появляются рядом с opus-файлом.
const FORMAT_PRIORITY = [".opus", ".mp3", ".wav", ".flac", ".ogg", ".m4a", ".aac"];

// Служебные каталоги внутри коллекции: в них лежат рабочие материалы
// (рендеры, лупы, автосохранения), а не готовые треки.
const SKIP_DIRS = /^(Media|AutoSaves|loops|worked|projects_rpp|backup|backups|exports?)$/i;

function prettify(value) {
  const text = String(value)
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : text;
}

function trackTitle(fileName) {
  let name = fileName.replace(/\.[^.]+$/, "");
  name = name.replace(/^\d+[_-]zqwy[_-]/i, "");
  name = name.replace(/^zqwy[_-]/i, "");
  return prettify(name) || fileName;
}

function trackOrder(fileName) {
  const match = fileName.match(/^(\d+)[_-]/);
  return match ? Number(match[1]) : Number.POSITIVE_INFINITY;
}

function albumTitle(albumId) {
  if (albumId === "!not_sorted") return "Not sorted";
  return prettify(albumId.replace(/^!/, ""));
}

// Read the duration once at generation time so the catalog can show it before
// the visitor presses play. Never fails the whole build if a file is unreadable.
function probeDuration(relativePath) {
  try {
    const result = spawnSync("ffprobe", [
      "-v", "error",
      "-show_entries", "format=duration",
      "-of", "default=noprint_wrappers=1:nokey=1",
      path.join(PROJECT, relativePath),
    ], { encoding: "utf8", timeout: 30000 });
    if (result.error || result.status !== 0) return null;
    const seconds = Number.parseFloat(result.stdout);
    return Number.isFinite(seconds) && seconds > 0
      ? Math.round(seconds * 1000) / 1000
      : null;
  } catch {
    return null;
  }
}

function findCover(albumId) {
  const dir = path.join(COVERS_DIR, albumId);
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return null;
  }
  for (const ext of COVER_EXT) {
    const file = entries.find((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(ext));
    if (file) {
      return `src/covers/${albumId}/${file.name}`;
    }
  }
  return null;
}

function walk(dir, isRoot = false) {
  const result = [];
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return result;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!isRoot && SKIP_DIRS.test(entry.name)) continue;
      result.push(...walk(full));
      continue;
    }
    if (!entry.isFile()) continue;
    if (entry.name.startsWith(".")) continue;
    if (/^orig[_-]/i.test(entry.name)) continue;
    if (!AUDIO_EXT.has(path.extname(entry.name).toLowerCase())) continue;
    result.push(full);
  }
  return result;
}

if (!fs.existsSync(TRACKS_DIR)) {
  console.error(`Нет каталога с треками: ${TRACKS_DIR}`);
  process.exit(1);
}

const albums = [];
let totalTracks = 0;

for (const entry of fs.readdirSync(TRACKS_DIR, { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;
  if (entry.name.startsWith(".")) continue;

  const albumId = entry.name;
  const root = path.join(TRACKS_DIR, albumId);
  // Служебные каталоги верхнего уровня (например, !not_sorted) — это релизы,
  // поэтому фильтр SKIP_DIRS применяется только ниже первого уровня.
  const files = walk(root, true).sort((a, b) => {
    const byNumber = trackOrder(path.basename(a)) - trackOrder(path.basename(b));
    return byNumber || path.basename(a).localeCompare(path.basename(b), "ru");
  });

  if (!files.length) continue;

  // Группируем файлы по названию без расширения: один трек может быть
  // доступен сразу в .opus/.mp3/.wav/.flac. В каталоге хранится карта
  // реально существующих файлов, а плеер выбирает из неё нужный формат.
  const groups = new Map();
  for (const file of files) {
    const ext = path.extname(file);
    const base = file.slice(0, -ext.length);
    const relative = path.relative(PROJECT, file).split(path.sep).join("/");
    let entry = groups.get(base);
    if (!entry) {
      entry = { base, formats: {} };
      groups.set(base, entry);
    }
    entry.formats[ext.slice(1).toLowerCase()] = relative;
  }

  const tracks = [...groups.values()].map((entry) => {
    const preferred = FORMAT_PRIORITY
      .map((ext) => entry.formats[ext.slice(1)])
      .find(Boolean) || Object.values(entry.formats)[0];
    let size = 0;
    try { size = fs.statSync(path.join(PROJECT, preferred)).size; } catch {}
    return {
      title: trackTitle(path.basename(entry.base)),
      path: preferred,
      size,
      duration: probeDuration(preferred),
      formats: entry.formats,
    };
  });

  totalTracks += tracks.length;
  albums.push({
    id: albumId,
    title: albumTitle(albumId),
    cover: findCover(albumId),
    tracks,
  });
}

albums.sort((a, b) => a.title.localeCompare(b.title, "ru"));

const payload = {
  generatedAt: new Date().toISOString(),
  trackCount: totalTracks,
  albumCount: albums.length,
  albums,
};

fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });
writeFileSafe(OUT_FILE, `${JSON.stringify(payload)}\n`);

const sizeKb = Math.round(fs.statSync(OUT_FILE).size / 1024);
console.log(`Каталог музыки: ${albums.length} релизов, ${totalTracks} треков`);
console.log(`Записано: ${path.relative(PROJECT, OUT_FILE)} (${sizeKb} КБ)`);
