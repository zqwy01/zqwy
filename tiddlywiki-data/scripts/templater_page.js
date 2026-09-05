import fs from "node:fs";
import path from "node:path";

import { markdownToHtml } from "./markdown.js";

const DEFAULT_COVER = "/images/default-cover.webp";

export function readJson(filePath) {
  try {
    return JSON.parse(
      fs.readFileSync(filePath, "utf8")
    );
  } catch (error) {
    console.error(
      `Ошибка чтения JSON-файла:\n${filePath}`
    );
    console.error(error.message);
    process.exit(1);
  }
}

export function readTemplate(filePath) {
  try {
    return fs.readFileSync(filePath, "utf8");
  } catch (error) {
    console.error(
      `Ошибка чтения HTML-шаблона:\n${filePath}`
    );
    console.error(error.message);
    process.exit(1);
  }
}

export function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function replaceVariable(
  html,
  variableName,
  value
) {
  return html.replaceAll(
    `{{${variableName}}}`,
    String(value ?? "")
  );
}

export function sanitizeFileName(value) {
  return String(value ?? "")
    .trim()
    .replaceAll("/", "-")
    .replaceAll("\\", "-")
    .replaceAll(":", "-")
    .replaceAll("*", "-")
    .replaceAll("?", "")
    .replaceAll('"', "")
    .replaceAll("<", "-")
    .replaceAll(">", "-")
    .replaceAll("|", "-");
}

export function getReleaseType(item) {
  const releaseSize =
    item?.music?.releaseSize ??
    item?.releaseSize;

  if (typeof releaseSize !== "string") {
    return null;
  }

  const normalized =
    releaseSize.trim().toLowerCase();

  return normalized === "single" ||
    normalized === "album"
    ? normalized
    : null;
}

export function isAlbum(item) {
  return getReleaseType(item) === "album";
}

export function createTagsHtml(tags) {
  if (!Array.isArray(tags)) {
    return "";
  }

  return tags
    .filter((tag) => {
      return (
        tag !== null &&
        tag !== undefined &&
        String(tag).trim() !== ""
      );
    })
    .map((tag) => {
      return `
        <h2 class="tag">
          ${escapeHtml(tag)}
        </h2>`;
    })
    .join("");
}

export function createDescriptionHtml(text) {
  if (!text) {
    return "";
  }

  return `
    <div class="description">
      ${markdownToHtml(text)}
    </div>`;
}

export function getTrackNumber(
  item,
  fallbackNumber = 1
) {
  const values = [
    item?.track_number,
    item?.music?.track_number,
    item?.music?.trackNumber,
    item?.number
  ];

  const trackNumber = values.find((value) => {
    if (
      value === null ||
      value === undefined ||
      value === ""
    ) {
      return false;
    }

    const number = Number(value);

    return (
      Number.isFinite(number) &&
      number > 0
    );
  });

  const result =
    trackNumber !== undefined
      ? Number(trackNumber)
      : Number(fallbackNumber);

  return Number.isFinite(result) && result > 0
    ? String(result)
    : "1";
}

export function getTrackReleaseName(
  item,
  fallbackName = ""
) {
  return sanitizeFileName(
    item?.releaseName ||
    item?.title ||
    fallbackName
  );
}

export function buildTrackSource(
  albumReleaseName,
  trackReleaseName,
  trackNumber,
  tracksPrefix = "../../tracks/"
) {
  if (
    !albumReleaseName ||
    !trackReleaseName
  ) {
    return "";
  }

  const trackFolder =
    `${trackNumber}_zqwy_${trackReleaseName}`;

  return (
    `${tracksPrefix}` +
    `${albumReleaseName}/tracks/` +
    `${trackFolder}/` +
    `${trackFolder}.opus`
  );
}

export function getAudioSource(
  item,
  albumReleaseName = "",
  fallbackNumber = 1,
  tracksPrefix = "../../tracks/"
) {
  const trackNumber =
    getTrackNumber(
      item,
      fallbackNumber
    );

  const opusSource =
    item?.media?.opus || "";

  if (
    opusSource &&
    !opusSource.endsWith("/")
  ) {
    return opusSource;
  }

  const trackReleaseName =
    getTrackReleaseName(
      item,
      albumReleaseName
    );

  return buildTrackSource(
    albumReleaseName,
    trackReleaseName,
    trackNumber,
    tracksPrefix
  );
}

export function createTrackHtml(
  item,
  fallbackNumber = 1,
  albumReleaseName = "",
  tracksPrefix = "../../tracks/"
) {
  const title =
    item?.title ||
    "Без названия";

  const trackNumber =
    getTrackNumber(
      item,
      fallbackNumber
    );

  const audioSource =
    getAudioSource(
      item,
      albumReleaseName,
      fallbackNumber,
      tracksPrefix
    );

  const wavSource =
    item?.media?.wav || "";

  const mp3Source =
    item?.media?.mp3 || "";

  const wavLink = wavSource
    ? `
      <a
        href="${escapeHtml(wavSource)}"
        class="logo-link"
        aria-label="Скачать WAV"
      >
        <img
          src="{{assetPrefix}}icons/download_wav.webp"
          alt="Скачать WAV"
        />
      </a>`
    : "";

  const mp3Link = mp3Source
    ? `
      <a
        href="${escapeHtml(mp3Source)}"
        class="logo-link"
        aria-label="Скачать MP3"
      >
        <img
          src="{{assetPrefix}}icons/download_mp3.webp"
          alt="Скачать MP3"
        />
      </a>`
    : "";

  return `
    <li
      class="track"
      data-src="${escapeHtml(audioSource)}"
      data-wav="${escapeHtml(wavSource)}"
      data-mp3="${escapeHtml(mp3Source)}"
    >
      <button
        class="track-button"
        type="button"
      >
        <span class="track-number">
          ${trackNumber}
        </span>

        <span class="track-name">
          ${escapeHtml(title)}
        </span>

        <span class="track-play">
          ▶
        </span>
      </button>

      <div class="track-downloads">
        ${wavLink}
        ${mp3Link}
      </div>
    </li>`;
}

export function createTracksHtml(
  item,
  tracksPrefix = "../../tracks/"
) {
  const albumReleaseName =
    String(
      item?.albumReleaseName ||
      item?.releaseName ||
      ""
    ).trim();

  if (isAlbum(item)) {
    const trackList =
      item?.music?.trackList || [];

    return trackList
      .map((track, index) => {
        return createTrackHtml(
          track,
          index + 1,
          albumReleaseName,
          tracksPrefix
        );
      })
      .join("");
  }

  return createTrackHtml(
    item,
    1,
    albumReleaseName,
    tracksPrefix
  );
}

export function getFirstTrack(item) {
  if (isAlbum(item)) {
    return (
      item?.music?.trackList?.[0] ||
      item
    );
  }

  return item;
}

export function createPageHtml(
  item,
  template,
  assetPrefix,
  coverPrefix,
  tracksPrefix = "../../tracks/"
) {
  const title =
    item?.title ||
    "Без названия";

  const albumReleaseName =
    String(
      item?.albumReleaseName ||
      item?.releaseName ||
      ""
    ).trim();

  const tags =
    createTagsHtml(
      item?.music?.tags
    );

  const cover =
    item?.media?.cover ||
    DEFAULT_COVER;

  const description =
    createDescriptionHtml(
      item?.content?.text
    );

  const tracks =
    createTracksHtml(
      item,
      tracksPrefix
    );

  const firstTrack =
    getFirstTrack(item);

  const firstTrackSrc =
    getAudioSource(
      firstTrack,
      albumReleaseName,
      1,
      tracksPrefix
    );

  let html = template;

  html = replaceVariable(
    html,
    "title",
    escapeHtml(title)
  );

  html = replaceVariable(
    html,
    "releaseName",
    escapeHtml(albumReleaseName)
  );

  html = replaceVariable(
    html,
    "tags",
    tags
  );

  html = replaceVariable(
    html,
    "cover",
    escapeHtml(cover)
  );

  html = replaceVariable(
    html,
    "coverPrefix",
    coverPrefix
  );

  html = replaceVariable(
    html,
    "firstTrackSrc",
    escapeHtml(firstTrackSrc)
  );

  html = replaceVariable(
    html,
    "tracks",
    tracks
  );

  html = replaceVariable(
    html,
    "description",
    description
  );

  html = replaceVariable(
    html,
    "assetPrefix",
    assetPrefix
  );

  return html;
}

export function getFileName(item) {
  const name =
    item?.releaseName ||
    item?.alias ||
    item?.title ||
    item?.id;

  if (!name) {
    return null;
  }

  return `${sanitizeFileName(name)}.html`;
}

export function collectAlbumPages(album) {
  const pages = [
    {
      item: album,
      fileName: getFileName(album)
    }
  ];

  const trackList =
    album?.music?.trackList || [];

  const albumReleaseName =
    album?.releaseName || "";

  for (const track of trackList) {
    pages.push({
      item: {
        ...track,
        albumReleaseName
      },
      fileName: getFileName(track)
    });
  }

  return pages;
}

function writePage({
  item,
  outputPath,
  template,
  assetPrefix,
  coverPrefix,
  tracksPrefix
}) {
  const pageHtml =
    createPageHtml(
      item,
      template,
      assetPrefix,
      coverPrefix,
      tracksPrefix
    );

  fs.writeFileSync(
    outputPath,
    pageHtml,
    "utf8"
  );
}

export function buildPages({
  items,
  template,
  outputDirectory,
  mode
}) {
  fs.mkdirSync(
    outputDirectory,
    {
      recursive: true
    }
  );

  let createdCount = 0;
  let skippedCount = 0;
  let failedCount = 0;

  const createdPaths =
    new Set();

  for (
    const [index, item] of items.entries()
  ) {
    if (
      !item ||
      typeof item !== "object"
    ) {
      console.error(
        `Элемент с индексом ${index} ` +
        `не является объектом. Пропущен.`
      );

      skippedCount++;
      continue;
    }

    if (mode === "single") {
      const fileName =
        getFileName(item);

      if (!fileName) {
        console.error(
          `У сингла с индексом ${index} ` +
          `отсутствует имя файла. Пропущен.`
        );

        skippedCount++;
        continue;
      }

      const outputPath =
        path.join(
          outputDirectory,
          fileName
        );

      if (
        createdPaths.has(outputPath)
      ) {
        console.error(
          `Файл уже создан, ` +
          `повторная запись пропущена:\n` +
          outputPath
        );

        skippedCount++;
        continue;
      }

      try {
        writePage({
          item,
          outputPath,
          template,
          assetPrefix: "../",
          coverPrefix: "../../",
          tracksPrefix: "../../tracks/"
        });

        createdPaths.add(outputPath);
        createdCount++;

        console.log(
          `Создан: ${path.relative(
            outputDirectory,
            outputPath
          )}`
        );
      } catch (error) {
        console.error(
          `Ошибка создания файла:\n${outputPath}`
        );

        console.error(error.message);
        failedCount++;
      }

      continue;
    }

    if (mode === "album") {
      const albumFolderName =
        sanitizeFileName(
          item?.releaseName ||
          item?.alias ||
          item?.title ||
          item?.id
        );

      if (!albumFolderName) {
        console.error(
          `У альбома с индексом ${index} ` +
          `отсутствует имя директории. Пропущен.`
        );

        skippedCount++;
        continue;
      }

      const albumDirectory =
        path.join(
          outputDirectory,
          albumFolderName
        );

      fs.mkdirSync(
        albumDirectory,
        {
          recursive: true
        }
      );

      const albumPages =
        collectAlbumPages(item);

      for (const page of albumPages) {
        if (!page.fileName) {
          console.error(
            "У страницы альбома отсутствует " +
            "имя файла. Пропущена."
          );

          skippedCount++;
          continue;
        }

        const outputPath =
          path.join(
            albumDirectory,
            page.fileName
          );

        if (
          createdPaths.has(outputPath)
        ) {
          console.error(
            `Файл уже создан, ` +
            `повторная запись пропущена:\n` +
            outputPath
          );

          skippedCount++;
          continue;
        }

        try {
          writePage({
            item: page.item,
            outputPath,
            template,
            assetPrefix: "../../",
            coverPrefix: "../../",
            tracksPrefix: "../../../tracks/"
          });

          createdPaths.add(outputPath);
          createdCount++;

          console.log(
            `Создан: ${path.relative(
              outputDirectory,
              outputPath
            )}`
          );
        } catch (error) {
          console.error(
            `Ошибка создания файла:\n${outputPath}`
          );

          console.error(error.message);
          failedCount++;
        }
      }
    }
  }

  console.log("");
  console.log(
    `Готово. Создано файлов: ${createdCount}`
  );
  console.log(
    `Пропущено файлов: ${skippedCount}`
  );
  console.log(
    `Неудачных операций: ${failedCount}`
  );
}
