#!/usr/bin/env node

import fs from "node:fs";

const inputFile = process.argv[2] ?? "-";

function emptyToNull(value) {
  return value === "" || value === undefined ? null : value;
}

function parseTiddlyWikiDate(value) {
  if (!value) return null;

  const match = String(value).match(
    /^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})(\d{3})$/
  );

  if (!match) return value;

  const [, year, month, day, hours, minutes, seconds, milliseconds] = match;

  const date = new Date(
    Date.UTC(
      Number(year),
      Number(month) - 1,
      Number(day),
      Number(hours),
      Number(minutes),
      Number(seconds),
      Number(milliseconds)
    )
  );

  return Number.isNaN(date.getTime()) ? value : date.toISOString();
}

function parseIntValue(value) {
  if (value === "" || value === null || value === undefined) {
    return null;
  }

  const result = Number.parseInt(value, 10);
  return Number.isNaN(result) ? value : result;
}

function parseFloatValue(value) {
  if (value === "" || value === null || value === undefined) {
    return null;
  }

  const result = Number.parseFloat(value);
  return Number.isNaN(result) ? value : result;
}

function parseTags(value) {
  if (!value) return [];

  if (Array.isArray(value)) return value;

  return String(value)
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

function parseEdges(value) {
  if (!value) return {};

  if (typeof value === "object") return value;

  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function detectContentFormat(item) {
  const formats = {
    "text/markdown": "markdown",
    "text/vnd.tiddlywiki": "tiddlywiki",
    "text/html": "html",
    "text/plain": "plain"
  };

  return formats[item.type] ?? item.type ?? null;
}

function stripHtml(value) {
  if (value === null || value === undefined) {
    return null;
  }

  const result = String(value)
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p\s*>/gi, "\n")
    .replace(/<\/div\s*>/gi, "\n")
    .replace(/<\/li\s*>/gi, "\n")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return result || null;
}

function makeSafeTitle(value) {
  if (!value) return null;

  let result = String(value)
    .normalize("NFKC")
    .toLowerCase()
    .trim()
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .replace(/[<>:"/\\|?*\u0000]/g, "-")
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  if (/^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i.test(result)) {
    result = `_${result}`;
  }

  return result || null;
}

function normalizeTiddler(item) {
  const contentFormat = detectContentFormat(item);

  return {
    id: item.id || item["tmap.id"] || null,
    title: item.title ?? null,
    safeTitle: makeSafeTitle(item.title),
    alias: emptyToNull(item.alias),
    category: emptyToNull(item.type_content),
    content: {
      format: contentFormat,
      text: stripHtml(item.text)
    },
    dates: {
      created: parseTiddlyWikiDate(item.created),
      modified: parseTiddlyWikiDate(item.modified),
      release: emptyToNull(item.date)
    },
    media: {
      cover: emptyToNull(item.cover),
      archive: emptyToNull(item.url_archive),
      mp3: emptyToNull(item.url_download_mp3),
      wav: emptyToNull(item.url_download_wav)
    },
    music: {
      author: emptyToNull(item.author),
      distributor: emptyToNull(item.distributor),
      tags: parseTags(item.tags),
      instruments: parseTags(item.instruments),
      bpm: parseFloatValue(item.track_bpm),
      key: emptyToNull(item.track_init_key),
      trackNumber: parseIntValue(item.track_number),
      isrc: emptyToNull(item.isrc),
      upc: emptyToNull(item.upc),
      albumSize: parseIntValue(item.size_album),
      releaseSize: parseIntValue(item.size_release)
    },
    map: {
      id: emptyToNull(item["tmap.id"]),
      edges: parseEdges(item["tmap.edges"]),
      style: emptyToNull(item["tmap.style"])
    },
    emoji: emptyToNull(item.emoji),
    worldEpoch: parseIntValue(item.epocha),
    version: emptyToNull(item.version)
  };
}

function readInput() {
  return inputFile === "-"
    ? fs.readFileSync(0, "utf8")
    : fs.readFileSync(inputFile, "utf8");
}

function main() {
  const data = JSON.parse(readInput());

  if (!Array.isArray(data)) {
    throw new TypeError("Ожидался JSON-массив записей");
  }

  const normalizedData = data
    .filter((item) => item && item.type_content === "music")
    .map(normalizeTiddler);

  process.stdout.write(JSON.stringify(normalizedData, null, 2) + "\n");
}

try {
  main();
} catch (error) {
  console.error(`Ошибка нормализации: ${error.message}`);
  process.exit(1);
}
