#!/usr/bin/env node
/*
 * Build the interactive TiddlyWiki edition at dev/wiki/tiddlywiki/index.html
 * from the markdown notes in src/notes/.
 *
 * Pipeline:
 *   src/notes/**\/*.md
 *     -> Markdown -> native WikiText tiddlers (no markdown plugin required)
 *     -> .cache/tiddlywiki/zqwy-wiki/  (temporary wiki, never committed)
 *     -> tiddlywiki CLI --build index
 *     -> dev/wiki/tiddlywiki/index.html  (single interactive file)
 *
 * The engine itself is installed on demand by scripts/fetch_tiddlywiki.mjs.
 */
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { writeFileSafe } from "./lib/write-file-smb-safe.mjs";
import {
  normalizeNotes,
  walkNotes,
  parseNote,
  sectionLabel,
  noteCategory,
} from "./lib/notes-source.mjs";
import { markdownToWikiText, buildLinkMap } from "./lib/markdown-to-wikitext.mjs";
import {
  PROJECT,
  CACHE_DIR,
  CLI_FILE,
  PACKAGE_DIR,
  ensureTiddlyWiki,
} from "./fetch_tiddlywiki.mjs";

const OUT_DIR = path.join(PROJECT, "dev", "wiki", "tiddlywiki");
const WIKI_DIR = path.join(CACHE_DIR, "zqwy-wiki");
const TIDDLERS_DIR = path.join(WIKI_DIR, "tiddlers");
const EDITION_INFO = path.join(PACKAGE_DIR, "editions", "empty", "tiddlywiki.info");
const INDEX_TITLE = "ZQWY — заметки";
const BACK_TITLE = "$:/zqwy/BackToSite";

function writeTiddler(filename, fields, text, { keepNewline = true } = {}) {
  const header = Object.entries(fields)
    .filter(([, value]) => value !== undefined && value !== null && String(value) !== "")
    .map(([name, value]) => `${name}: ${String(value).replace(/\r?\n/g, " ")}`)
    .join("\n");
  const body = `${header}\n\n${String(text).trim()}`;
  writeFileSafe(path.join(TIDDLERS_DIR, filename), keepNewline ? `${body}\n` : body);
}

function twDate(date) {
  return `${String(date || "1970-01-01").replace(/-/g, "")}000000000`;
}

// YAML front matter is metadata, not note text: without this it would turn
// into two horizontal rules and a block of raw `key: value` lines. Keep the
// values as tiddler fields with an `fm-` prefix instead.
function splitFrontmatter(raw) {
  const match = /^\s*---\s*\r?\n([\s\S]*?)\r?\n---\s*(?:\r?\n|$)/.exec(String(raw || ""));
  if (!match) return { body: String(raw || ""), fields: {} };
  const fields = {};
  for (const line of match[1].split(/\r?\n/)) {
    const pair = /^([A-Za-z_][\w-]*):\s*(.*)$/.exec(line.trim());
    if (pair) fields[pair[1]] = pair[2].trim();
  }
  return { body: String(raw).slice(match[0].length), fields };
}

function tag(value) {
  return `[[${value}]]`;
}

function uniqueTitles(notes) {
  const used = new Set();
  return notes.map((note) => {
    let title = note.title;
    if (used.has(title)) title = `${sectionLabel(note.section)} / ${title}`;
    let suffix = 2;
    while (used.has(title)) title = `${note.title} (${suffix++})`;
    used.add(title);
    return { ...note, wikiTitle: title };
  });
}

function buildIndex(records, version) {
  const sections = new Map();
  for (const note of records) {
    const label = sectionLabel(note.section);
    if (!sections.has(label)) sections.set(label, []);
    sections.get(label).push(note);
  }
  const parts = [
    "! ZQWY — заметки",
    "",
    `Заметки из \`src/notes/\`, собранные из Markdown в TiddlyWiki ${version}.`,
    "Откройте заметку по ссылке ниже; теги и поиск работают как в обычной вики.",
    "",
  ];
  for (const [label, notes] of [...sections.entries()].sort((a, b) => a[0].localeCompare(b[0], "ru"))) {
    parts.push(`!! ${label}`, "");
    for (const note of notes) {
      parts.push(`* [[${note.wikiTitle}]] — \`${note.relative}\``);
    }
    parts.push("");
  }
  parts.push("----", `Всего заметок: ${records.length}.`);
  return parts.join("\n");
}

export function buildTiddlyWiki() {
  const version = ensureTiddlyWiki();

  const normalized = normalizeNotes();
  if (normalized) console.log(`Нормализовано заметок: ${normalized} → .md`);

  const records = uniqueTitles(walkNotes().map((file) => parseNote(file)));
  const linkMap = buildLinkMap(records);

  // Temporary wiki: rebuild the tiddler directory from scratch so removed
  // notes never linger in the generated single file.
  fs.rmSync(TIDDLERS_DIR, { recursive: true, force: true });
  fs.mkdirSync(TIDDLERS_DIR, { recursive: true });
  fs.mkdirSync(OUT_DIR, { recursive: true });
  if (fs.existsSync(EDITION_INFO)) {
    fs.copyFileSync(EDITION_INFO, path.join(WIKI_DIR, "tiddlywiki.info"));
  } else {
    writeFileSafe(path.join(WIKI_DIR, "tiddlywiki.info"), `${JSON.stringify({
      description: "zqwy notes edition",
      plugins: [],
      themes: ["tiddlywiki/vanilla", "tiddlywiki/snowwhite"],
      build: { index: ["--render", "$:/core/save/all", "index.html", "text/plain"] },
    }, null, 2)}\n`);
  }

  records.forEach((note, index) => {
    const tags = [tag("Заметки"), tag(noteCategory(note.section)), tag("markdown")]
      .filter((value, position, all) => all.indexOf(value) === position);
    const { body, fields } = splitFrontmatter(note.rawBody);
    const extraFields = Object.fromEntries(
      Object.entries(fields)
        .filter(([name]) => name !== "title")
        .map(([name, value]) => [`fm-${name}`, value]),
    );
    // Some notes (e.g. the zemic story tree) consist only of front matter.
    // Mirror it into the body as well so the tiddler is not empty.
    const visibleFields = Object.keys(extraFields).length
      ? `${Object.entries(extraFields).map(([name, value]) => `* ''${name.slice(3)}:'' \`${value}\``).join("\n")}\n\n`
      : "";
    writeTiddler(`${String(index).padStart(3, "0")}-${note.slug}.tid`, {
      title: note.wikiTitle,
      type: "text/vnd.tiddlywiki",
      tags: tags.join(" "),
      created: twDate(note.date),
      modified: twDate(note.date),
      date: note.date,
      slug: note.slug,
      source: `src/notes/${note.relative}`,
      section: note.section,
      ...extraFields,
    }, `${visibleFields}${markdownToWikiText(body, { linkMap })}`);
  });

  writeTiddler("index.tid", {
    title: INDEX_TITLE,
    type: "text/vnd.tiddlywiki",
    tags: [tag("Заметки"), tag("Индексы")].join(" "),
  }, buildIndex(records, version));

  writeTiddler("$__DefaultTiddlers.tid", { title: "$:/DefaultTiddlers" }, `[[${INDEX_TITLE}]]`);
  writeTiddler("$__SiteTitle.tid", { title: "$:/SiteTitle" }, "ZQWY wiki");
  writeTiddler("$__SiteSubtitle.tid", { title: "$:/SiteSubtitle" }, `Заметки из Markdown · TiddlyWiki ${version}`);

  // Тёмная палитра по умолчанию — та же логика, что и у остального сайта.
  // Без завершающего перевода строки: имя палитры используется как точный
  // заголовок tiddler, и `\n` в конце ломает поиск палитры.
  writeTiddler("$__palette.tid", { title: "$:/palette" }, "$:/palettes/ContrastDark", { keepNewline: false });

  // Кнопка возврата в основной портал живёт в стандартной панели
  // tc-page-controls наряду с Home/Search/etc., а не поверх заметок.
  writeTiddler("$__zqwy_BackToSite.tid", {
    title: BACK_TITLE,
    type: "text/vnd.tiddlywiki",
    tags: "$:/tags/PageControls",
    caption: "← ZQWY",
    description: "Вернуться на главную ZQWY",
  }, '<a class="tc-btn-invisible zqwy-back-to-site" href="../../" title="Вернуться на главную ZQWY" aria-label="Вернуться на главную ZQWY">← ZQWY</a>');

  writeTiddler("$__zqwy_Styles.tid", {
    title: "$:/zqwy/Styles",
    type: "text/css",
    tags: "$:/tags/Stylesheet",
  }, `.tc-page-controls a.zqwy-back-to-site {
  margin-right: 0.5em;
  text-decoration: none;
  white-space: nowrap;
}
.tc-page-controls a.zqwy-back-to-site:hover {
  text-decoration: underline;
}`);

  console.log(`TiddlyWiki: ${records.length} заметок → ${path.relative(PROJECT, WIKI_DIR)}/`);
  execFileSync(process.execPath, [
    CLI_FILE,
    WIKI_DIR,
    "--output", OUT_DIR,
    "--build", "index",
  ], { cwd: PROJECT, stdio: "inherit" });

  const output = path.join(OUT_DIR, "index.html");
  if (!fs.existsSync(output) || fs.statSync(output).size < 100000) {
    throw new Error(`TiddlyWiki не создал ожидаемый одностраничник: ${output}`);
  }
  console.log(`TiddlyWiki: готово → ${path.relative(PROJECT, output)} (${(fs.statSync(output).size / 1024 / 1024).toFixed(2)} МБ)`);
  return output;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    buildTiddlyWiki();
  } catch (error) {
    console.error(`Ошибка сборки TiddlyWiki: ${error.message}`);
    process.exitCode = 1;
  }
}
