#!/usr/bin/env node
/*
 * Generate the "zqwy" notes mode from markdown files in src/notes/.
 *
 * Source:  src/notes/**\/*.md            (hand-written markdown)
 *          src/notes/**\/*.txt and text files without an extension are
 *          normalized to .md in place on every build, so newly added folders
 *          and nested notes are picked up without manual conversion.
 * Output:  dev/wiki/zqwy/index.html      (notes landing, SPA-compatible)
 *          dev/wiki/zqwy/<slug>.html     (one page per note)
 *          dev/data/wiki-notes.json      (metadata for build_search_index.mjs)
 *          dev/data/note-graph.json      (nodes/links for the graph page)
 *
 * Notes are grouped by directory path inside src/notes/ and shown as a
 * collapsible tree on the landing page so folders/categories can be expanded.
 *
 * No markdown dependency is used: the small converter in lib/notes-source.mjs
 * handles the subset needed for notes — headings, lists, code fences,
 * paragraphs and inline emphasis/code/links. Run automatically from
 * scripts/build_dist.sh.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { writeFileSafe } from "./lib/write-file-smb-safe.mjs";
import { buildNoteGraph } from "./lib/note-graph.mjs";
import {
  NOTES_DIR,
  normalizeNotes,
  walkNotes as walk,
  escapeHtml,
  parseNote,
  sectionLabel,
  noteCategory,
  slugify,
} from "./lib/notes-source.mjs";
import {
  NOTE_LANGUAGES,
  loadNoteTranslationIndex,
  loadNoteVariants,
  sectionTranslationKey,
  sectionPaths,
  translatedSectionLabel,
  variantFor,
} from "./lib/note-translations.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PROJECT = path.resolve(HERE, "..");
const OUT_DIR = path.join(PROJECT, "dev", "wiki", "zqwy");
const META_FILE = path.join(PROJECT, "dev", "data", "wiki-notes.json");
const GRAPH_FILE = path.join(PROJECT, "dev", "data", "note-graph.json");

function shell({ title, description, body, depth, isIndex = false, titleKey = "", descKey = "", i18n = {} }) {
  const base = "../".repeat(depth);
  // Escaped for an inline JSON block: HTML bodies can contain `<` and `</script>`.
  const i18nJson = JSON.stringify(i18n)
    .replace(/</g, "\\u003c")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
  const titleAttr = titleKey ? ` data-i18n="${escapeHtml(titleKey)}"` : "";
  const descAttr = descKey ? ` data-i18n-content="${escapeHtml(descKey)}"` : "";
  return `<!doctype html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title${titleAttr}>zqwy — ${escapeHtml(title)}</title>
  <meta name="description"${descAttr} content="${escapeHtml(description)}">
  <link rel="icon" href="${base}assets/icons/favicon.ico" type="image/x-icon">
  <link rel="stylesheet" href="${base}styles/menu/menu.css">
  <link rel="stylesheet" href="${base}styles/menu/menu_logo.css">
  <link rel="stylesheet" href="${base}styles/base.css">
  <link rel="stylesheet" href="${base}styles/notes.css">
  <link rel="stylesheet" href="${base}styles/player.css">
  <script>
    (function () {
      try {
        var raw = localStorage.getItem("zqwy.site.settings.v1");
        var s = raw ? JSON.parse(raw) : null;
        var theme = s && s.theme ? s.theme : "dark";
        if (theme === "system") {
          theme = window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
        }
        document.documentElement.dataset.theme = theme === "light" ? "light" : "dark";
        var language = s && s.language ? s.language : "ru";
        document.documentElement.lang = ["ru", "en", "de"].indexOf(language) >= 0 ? language : "ru";
      } catch (e) { document.documentElement.dataset.theme = "dark"; }
    })();
  </script>
  <script type="application/json" id="zqwy-note-i18n">${i18nJson}</script>
</head>
<body>
  <main class="page">
    <div class="page-content notes-page">
      <div class="container menu-button-container" id="menuButtonContainer">
        <div class="menu-trigger-row">
          <a class="menu-open-button" id="menuOpenButton" href="${base}" data-back aria-label="Назад" data-i18n-aria-label="back">
            <img class="menu-open-image" src="${base}assets/icons/favicon.ico" alt="" aria-hidden="true">
          </a>
          <form class="site-search" id="siteSearch" role="search" aria-label="Поиск" data-i18n-aria-label="siteSearch">
            <label class="visually-hidden" for="siteSearchInput" data-i18n="siteSearchLabel">Общий поиск сайта</label>
            <input class="menu-search-input" id="siteSearchInput" name="search" type="search" placeholder="Поиск" autocomplete="off" enterkeyhint="search" aria-keyshortcuts="Control+F Meta+F" title="Общий поиск сайта (Ctrl+F)" data-i18n-placeholder="searchPlaceholder" data-i18n-title="searchTitle">
          </form>
        </div>
      </div>
      <header class="home-head notes-head">
        <h1 class="home-title">zqwy notes</h1>
        <p class="home-heading" data-i18n="notesHeading">Заметки в формате markdown, собранные из src/notes/.</p>
${isIndex ? "" : `        <a class="notes-back" href="${base}wiki/zqwy/"><span aria-hidden="true">←</span> <span data-i18n="notesBack">Назад к заметкам</span></a>\n`}        <a class="notes-graph-link" href="${base}wiki/graph/"><span aria-hidden="true">✦</span> <span data-i18n="notesGraphLink">Граф заметок</span></a>
      </header>
      <article class="notes-article">
${body}
      </article>
    </div>
  </main>
  <script src="${base}scripts/transition.js" type="module"></script>
  <script src="${base}scripts/menu.js" type="module"></script>
  <script src="${base}scripts/player.js" type="module"></script>
</body>
</html>
`;
}

function buildTree(notesList) {
  const root = { name: "", path: "", folders: new Map(), notes: [] };
  for (const note of notesList) {
    const parts = note.section ? note.section.split("/") : [];
    let node = root;
    let cur = "";
    for (const part of parts) {
      cur = cur ? `${cur}/${part}` : part;
      if (!node.folders.has(part)) node.folders.set(part, { name: part, path: cur, folders: new Map(), notes: [] });
      node = node.folders.get(part);
    }
    node.notes.push(note);
  }
  return root;
}

function sortedFolders(node) {
  return [...node.folders.values()].sort((a, b) => a.name.localeCompare(b.name, "ru"));
}
function sortedNotes(node) {
  // Blog format: newest dated entries first; title keeps ties deterministic.
  return [...node.notes].sort((a, b) =>
    b.date.localeCompare(a.date) ||
    a.title.localeCompare(b.title, "ru") ||
    a.relative.localeCompare(b.relative, "ru"));
}

// Small, meaning-based badges for the note directories. Unknown folders get
// a plain folder icon instead of an empty glyph.
const FOLDER_ICONS = {
  aesthics: "🎨",
  bio: "🧬",
  dev: "💻",
  genres: "🎭",
  job: "💼",
  linux: "🐧",
  messangers: "💬",
  music: "🎵",
  music_albums: "💿",
  notes: "📝",
  phi: "🤔",
  rhymes: "✍️",
  sound_design: "🎚️",
  tiddly: "🧷",
  updates: "🗓️",
  zemic: "📜",
};
function folderIcon(name) {
  return FOLDER_ICONS[String(name).toLowerCase()] || "📁";
}

function sectionKey(section) {
  return sectionTranslationKey(section);
}

function renderTree(node, depth = 0) {
  const pad = "  ".repeat(depth);
  let html = "";
  for (const child of sortedFolders(node)) {
    html += `${pad}<details class="notes-folder">\n`;
    html += `${pad}  <summary><span class="notes-folder-icon" aria-hidden="true">${folderIcon(child.name)}</span><span class="notes-folder-name" data-i18n="noteSection.${escapeHtml(sectionKey(child.path))}">${escapeHtml(child.name)}</span></summary>\n`;
    html += `${pad}  <div class="notes-folder-body">\n`;
    html += renderTree(child, depth + 2);
    html += `${pad}  </div>\n`;
    html += `${pad}</details>\n`;
  }
  for (const note of sortedNotes(node)) {
    html += `${pad}<a class="note-tree-link" href="./${escapeHtml(note.slug)}.html"><span class="note-tree-title" data-i18n="noteTitle.${escapeHtml(note.slug)}">${escapeHtml(note.title)}</span><span class="note-tree-date">${escapeHtml(note.date)}</span><span class="note-tree-path">${escapeHtml(note.relative)}</span></a>\n`;
  }
  return html;
}

function flattenTree(node) {
  const out = [];
  for (const child of sortedFolders(node)) out.push(...flattenTree(child));
  out.push(...sortedNotes(node));
  return out;
}

function countFolders(node) {
  let n = node.folders.size;
  for (const child of node.folders.values()) n += countFolders(child);
  return n;
}

const normalized = normalizeNotes(NOTES_DIR);
if (normalized) console.log(`Нормализовано заметок: ${normalized} → .md`);
const translationIndex = loadNoteTranslationIndex();
const notes = walk(NOTES_DIR).map((file) => ({ file, ...parseNote(file, NOTES_DIR) }));
for (const note of notes) {
  note.variants = loadNoteVariants(note, translationIndex);
  note.sectionI18n = Object.fromEntries(NOTE_LANGUAGES.map((lang) => [
    lang,
    translatedSectionLabel(note.section, lang, translationIndex),
  ]));
  // Front matter is metadata, not article text. The canonical RU variant is
  // stripped here so HTML, search text and graph excerpts agree.
  note.text = note.variants.ru.text;
}
fs.mkdirSync(OUT_DIR, { recursive: true });

// Drop pages from notes that have since been removed or renamed.
for (const file of fs.readdirSync(OUT_DIR)) {
  if (file.endsWith(".html") && file !== "index.html") {
    fs.rmSync(path.join(OUT_DIR, file), { force: true });
  }
}

const tree = buildTree(notes);
const orderedNotes = flattenTree(tree);
const folderCount = countFolders(tree);

/* One dictionary per language, merged into the site's P.I18N at runtime.
   Only keys needed by the current page are embedded in its <head>. */
const allI18n = {
  ru: { notesPageTitle: "zqwy — notes", notesPageDesc: "Заметки zqwy в формате markdown" },
  en: { notesPageTitle: "zqwy — notes", notesPageDesc: "ZQWY notes in markdown" },
  de: { notesPageTitle: "zqwy — Notizen", notesPageDesc: "ZQWY-Notizen im Markdown-Format" },
};
for (const note of notes) {
  for (const sectionPath of sectionPaths(note.section)) {
    const key = sectionKey(sectionPath);
    for (const lang of NOTE_LANGUAGES) {
      allI18n[lang][`noteSection.${key}`] = translatedSectionLabel(sectionPath, lang, translationIndex);
    }
  }
  for (const lang of NOTE_LANGUAGES) {
    const variant = variantFor(note.variants, lang);
    allI18n[lang][`noteTitle.${note.slug}`] = variant.title;
    allI18n[lang][`noteDesc.${note.slug}`] = variant.description;
    allI18n[lang][`noteBody.${note.slug}`] = variant.html;
    allI18n[lang][`notePageTitle.${note.slug}`] = `zqwy — ${variant.title}`;
  }
}
function pickI18n(keys) {
  const out = { ru: {}, en: {}, de: {} };
  for (const lang of NOTE_LANGUAGES) {
    for (const key of keys) {
      if (Object.prototype.hasOwnProperty.call(allI18n[lang], key)) out[lang][key] = allI18n[lang][key];
    }
  }
  return out;
}
const indexI18n = pickI18n(Object.keys(allI18n.ru));
const noteI18nKeys = (note) => [
  `noteTitle.${note.slug}`,
  `noteDesc.${note.slug}`,
  `noteBody.${note.slug}`,
  `notePageTitle.${note.slug}`,
  ...sectionPaths(note.section).map((sectionPath) => `noteSection.${sectionKey(sectionPath)}`),
];
const indentLines = (html, spaces) => html.split("\n").map((line) => `${" ".repeat(spaces)}${line}`).join("\n");

const treeHtml = notes.length
  ? `        <nav class="notes-tree" aria-label="Заметки">\n${renderTree(tree, 5)}        </nav>`
  : `        <p class="notes-empty" data-i18n="notesEmpty">Заметки пока не добавлены. Положите .md-файлы в src/notes/.</p>`;

const previewsHtml = orderedNotes.map((note) => `        <section class="note-preview" id="note-${escapeHtml(note.slug)}">
          <p class="note-preview-section" data-i18n="noteSection.${escapeHtml(sectionKey(note.section))}">${escapeHtml(sectionLabel(note.section))}</p>
          <p class="note-preview-date">${escapeHtml(note.date)}</p>
          <h2 data-i18n="noteTitle.${escapeHtml(note.slug)}">${escapeHtml(note.title)}</h2>
          <div class="note-i18n-body" data-i18n-html="noteBody.${escapeHtml(note.slug)}">
${indentLines(note.variants.ru.html, 10)}
          </div>
        </section>`).join("\n");

// The blog title belongs where the chronological feed actually starts —
// after the category tree, not in the shared page header (and not on every
// individual note page).
const blogHeadingHtml = notes.length
  ? `        <header class="blog-head">
          <p class="home-heading blog-hint" data-i18n="blogHeading">Блог · хронология</p>
          <p class="home-heading blog-hint dim" data-i18n="blogHint">Записи расположены по датам — от новых к старым.</p>
        </header>`
  : "";

const indexBody = `${treeHtml}\n${blogHeadingHtml}\n${previewsHtml}`.trim();

writeFileSafe(path.join(OUT_DIR, "index.html"), shell({
  title: "notes",
  description: "Заметки zqwy в формате markdown",
  body: indexBody,
  depth: 2,
  isIndex: true,
  titleKey: "notesPageTitle",
  descKey: "notesPageDesc",
  i18n: indexI18n,
}));

for (const note of notes) {
  const label = sectionLabel(note.section);
  writeFileSafe(path.join(OUT_DIR, `${note.slug}.html`), shell({
    title: note.title,
    description: variantFor(note.variants, "ru").description,
    body: `        <header class="note-header"><p class="note-section" data-i18n="noteSection.${escapeHtml(sectionKey(note.section))}">${escapeHtml(label)}</p><h2 data-i18n="noteTitle.${escapeHtml(note.slug)}">${escapeHtml(note.title)}</h2><p>${escapeHtml(note.relative)}</p></header>
        <div class="note-i18n-body" data-i18n-html="noteBody.${escapeHtml(note.slug)}">
${indentLines(note.variants.ru.html, 8)}
        </div>`,
    depth: 2,
    titleKey: `notePageTitle.${note.slug}`,
    descKey: `noteDesc.${note.slug}`,
    i18n: pickI18n(noteI18nKeys(note)),
  }));
}

fs.mkdirSync(path.dirname(META_FILE), { recursive: true });
writeFileSafe(META_FILE, `${JSON.stringify({
  generatedAt: new Date().toISOString(),
  count: notes.length,
  notes: notes.map((note) => ({
    title: note.title,
    titleI18n: Object.fromEntries(NOTE_LANGUAGES.map((lang) => [lang, variantFor(note.variants, lang).title])),
    path: `./wiki/zqwy/${note.slug}.html`,
    section: note.section,
    sectionI18n: Object.fromEntries(NOTE_LANGUAGES.map((lang) => [lang, translatedSectionLabel(note.section, lang, translationIndex)])),
    relative: note.relative,
    // Keep the full note text searchable: important phrases can easily sit
    // past the first 240 characters, and the index is still tiny.
    text: note.text,
    textI18n: Object.fromEntries(NOTE_LANGUAGES.map((lang) => [lang, variantFor(note.variants, lang).text])),
    category: noteCategory(note.section),
    type: "note",
    keywords: [
      "zqwy",
      "заметки",
      "notes",
      "markdown",
      note.slug,
      ...note.section.split("/").filter(Boolean),
    ],
  })),
}, null, 2)}\n`);

// Graph data is derived from the same parse, so links always point at pages
// that actually exist in this build (no stale slugs after renames).
const graph = buildNoteGraph(notes);
fs.mkdirSync(path.dirname(GRAPH_FILE), { recursive: true });
writeFileSafe(GRAPH_FILE, `${JSON.stringify(graph, null, 2)}\n`);

console.log(`Wiki notes: ${notes.length} файлов, ${folderCount} папок → ${path.relative(PROJECT, OUT_DIR)}`);
console.log(`Note graph: ${graph.stats.nodes} узлов, ${graph.stats.links} связей → ${path.relative(PROJECT, GRAPH_FILE)}`);
