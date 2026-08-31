import fs from "node:fs";

const inputFile = process.argv[2] ?? "-";

const excludedMusicTags = new Set(["музыка", "саундтрек"]);

function writeLog(message) {
  console.error(`[${new Date().toISOString()}] ${message}`);
}

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

  if (Array.isArray(value)) {
    return value.filter(Boolean);
  }

  return String(value)
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

function normalizeTag(tag) {
  return String(tag)
    .normalize("NFKC")
    .trim()
    .toLocaleLowerCase("ru-RU");
}

function parseMusicTags(value) {
  return parseTags(value).filter(
    (tag) => !excludedMusicTags.has(normalizeTag(tag))
  );
}

function parseEdges(value) {
  if (!value) return {};

  if (typeof value === "object" && !Array.isArray(value)) {
    return value;
  }

  try {
    const parsed = JSON.parse(value);

    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed
      : {};
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

/*
 * Приводит значения к единому виду для сравнения.
 *
 * Например:
 *
 * "The Remaining One"  -> "the-remaining-one"
 * "the_remaining_one"  -> "the-remaining-one"
 * "the remaining one"  -> "the-remaining-one"
 */
function normalizeKey(value) {
  return makeSafeTitle(value) ?? "";
}

function normalizeTiddler(item) {
  const contentFormat = detectContentFormat(item);

  return {
    id: item.id || item["tmap.id"] || null,
    title: item.title ?? null,
    safeTitle: makeSafeTitle(item.title),
    alias: emptyToNull(item.alias),
    category: emptyToNull(item.type_content),
    albumName: emptyToNull(item.album_name),
    releaseName: emptyToNull(item.releasename),

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
      tags: parseMusicTags(item.tags),
      instruments: parseTags(item.instruments),
      bpm: parseFloatValue(item.track_bpm),
      key: emptyToNull(item.track_init_key),

      // Внутреннее имя используется для сортировки и обработки.
      // В итоговом JSON оно будет преобразовано в track_number.
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

function getTrackNumber(item, fallback = 1) {
  return typeof item.music.trackNumber === "number"
    ? item.music.trackNumber
    : fallback;
}

function createTrack(item, index) {
  return {
    track_number: getTrackNumber(item, index + 1),

    id: item.id,
    title: item.title,
    safeTitle: item.safeTitle,
    alias: item.alias,

    content: item.content,
    dates: item.dates,
    media: item.media,

    music: {
      author: item.music.author,
      distributor: item.music.distributor,
      tags: item.music.tags,
      instruments: item.music.instruments,
      bpm: item.music.bpm,
      key: item.music.key,
      isrc: item.music.isrc,
      upc: item.music.upc
    },

    emoji: item.emoji,
    worldEpoch: item.worldEpoch,
    version: item.version
  };
}

function sortTracks(tracks) {
  return [...tracks].sort((a, b) => {
    const aNumber = a.music.trackNumber;
    const bNumber = b.music.trackNumber;

    if (typeof aNumber === "number" && typeof bNumber === "number") {
      return aNumber - bNumber;
    }

    if (typeof aNumber === "number") return -1;
    if (typeof bNumber === "number") return 1;

    return 0;
  });
}

function mergeIntoAlbums(items) {
  const groups = new Map();

  for (const item of items) {
    const albumName = item.albumName;

    if (albumName) {
      /*
       * Благодаря normalizeKey() значения вроде:
       *
       * the_remaining_one
       * the-remaining-one
       * The Remaining One
       *
       * попадут в одну группу.
       */
      const key = `album:${normalizeKey(albumName)}`;

      if (!groups.has(key)) {
        groups.set(key, []);
      }

      groups.get(key).push(item);
    } else {
      const key = `single:${item.id}`;

      if (!groups.has(key)) {
        groups.set(key, []);
      }

      groups.get(key).push(item);
    }
  }

  return Array.from(groups.values()).map((group) => {
    const albumName =
      group.find((item) => item.albumName)?.albumName ?? null;

    /*
     * Ищем запись альбома по нормализованному названию.
     *
     * Раньше сравнивались:
     *
     * "The Remaining One"
     * "the_remaining_one"
     *
     * и они считались разными значениями.
     */
    const parent =
      group.find(
        (item) =>
          albumName &&
          normalizeKey(item.title) === normalizeKey(albumName)
      ) ?? group[0];

    if (
      albumName &&
      normalizeKey(parent.title) !== normalizeKey(albumName)
    ) {
      writeLog(
        `Не удалось точно найти родительский элемент альбома "${albumName}". ` +
          `Используется первая запись: "${parent.title}"`
      );
    }

    const childTracks = albumName
      ? group.filter((item) => item.id !== parent.id)
      : [];

    const tracks = sortTracks(childTracks);
    const isSingle = !albumName;

    return {
      id: parent.id,
      title: parent.title,
      safeTitle: parent.safeTitle,
      alias: parent.alias,
      category: parent.category,
      albumName: parent.albumName,
      releaseName: parent.releaseName,

      /*
       * Для сингла track_number находится на верхнем уровне.
       * Если номер не указан в исходных данных, используется 1.
       */
      ...(isSingle
        ? {
            track_number: getTrackNumber(parent)
          }
        : {}),

      content: parent.content,
      dates: parent.dates,
      media: parent.media,

      music: {
        author: parent.music.author,
        distributor: parent.music.distributor,
        tags: parent.music.tags,
        instruments: parent.music.instruments,
        bpm: parent.music.bpm,
        key: parent.music.key,
        isrc: parent.music.isrc,
        upc: parent.music.upc,
        albumSize: parent.music.albumSize,
        releaseSize: parent.music.releaseSize,

        // Для альбома track_number находится у каждого трека.
        trackList: tracks.map(createTrack)
      },

      map: parent.map,
      emoji: parent.emoji,
      worldEpoch: parent.worldEpoch,
      version: parent.version
    };
  });
}

function readInput() {
  return inputFile === "-"
    ? fs.readFileSync(0, "utf8")
    : fs.readFileSync(inputFile, "utf8");
}

function main() {
  writeLog(`Начало нормализации. Источник: ${inputFile}`);

  const data = JSON.parse(readInput());

  if (!Array.isArray(data)) {
    throw new TypeError("Ожидался JSON-массив записей");
  }

  const musicItems = data
    .filter((item) => item && item.type_content === "music")
    .map(normalizeTiddler);

  const normalizedData = mergeIntoAlbums(musicItems);

  process.stdout.write(JSON.stringify(normalizedData, null, 2) + "\n");

  writeLog(
    `Нормализация завершена. ` +
      `Всего записей: ${data.length}, ` +
      `музыкальных заметок: ${musicItems.length}, ` +
      `альбомов и синглов: ${normalizedData.length}`
  );
}

try {
  main();
} catch (error) {
  writeLog(`Ошибка нормализации: ${error.message}`);
  process.exitCode = 1;
}
