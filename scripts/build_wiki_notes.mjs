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
 * No markdown dependency is used: the small converter below handles the
 * subset needed for notes — headings, lists, code fences, paragraphs and
 * inline emphasis/code/links. Run automatically from scripts/build_dist.sh.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { writeFileSafe } from "./lib/write-file-smb-safe.mjs";
import { buildNoteGraph } from "./lib/note-graph.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PROJECT = path.resolve(HERE, "..");
const NOTES_DIR = path.join(PROJECT, "src", "notes");
const OUT_DIR = path.join(PROJECT, "dev", "wiki", "zqwy");
const META_FILE = path.join(PROJECT, "dev", "data", "wiki-notes.json");
const GRAPH_FILE = path.join(PROJECT, "dev", "data", "note-graph.json");

// Plain-text notes sometimes arrive as .txt or with no extension at all
// (e.g. "Панорамирование"). Convert them to .md in place so the walk below —
// and every subsequent build — sees them. Other formats (.tid, .meta, ...)
// are left untouched, and an existing .md note is never overwritten.
function normalizeNotes(dir) {
  if (!fs.existsSync(dir)) return 0;
  let converted = 0;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      converted += normalizeNotes(full);
      continue;
    }
    if (!entry.isFile() || entry.name.startsWith(".")) continue;
    const ext = path.extname(entry.name).toLowerCase();
    if (ext !== "" && ext !== ".txt") continue;
    const target = ext ? `${full.slice(0, -ext.length)}.md` : `${full}.md`;
    if (fs.existsSync(target)) continue;
    let content;
    try { content = fs.readFileSync(full, "utf8"); } catch { continue; }
    if (content.includes("\0")) continue;
    writeFileSafe(target, content);
    fs.rmSync(full, { force: true });
    converted += 1;
  }
  return converted;
}

function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  const files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...walk(full));
    else if (entry.isFile() && entry.name.toLowerCase().endsWith(".md")) files.push(full);
  }
  return files.sort();
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function safeUrl(value) {
  const url = String(value || "").trim();
  if (/^(https?:\/\/|mailto:|\/|\.{1,2}\/|#)/i.test(url)) return escapeHtml(url);
  return "#";
}

function inline(value) {
  return escapeHtml(value)
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g,
      (match, text, url) => `<a href="${safeUrl(url)}" target="_blank" rel="noopener noreferrer">${text}</a>`);
}

function markdown(value) {
  const lines = String(value || "").replace(/\r\n?/g, "\n").split("\n");
  const out = [];
  let paragraph = [];
  let list = [];
  let code = [];
  let inCode = false;

  const flushParagraph = () => {
    // Markdown treats a single newline as a soft break inside the same
    // paragraph. Keep those line breaks explicitly: joining lines with a
    // space loses hand-written formatting (and the minifier collapses a bare
    // newline during the site build).
    if (paragraph.length) out.push(`<p>${paragraph.map(inline).join("<br>\n")}</p>`);
    paragraph = [];
  };
  const flushList = () => {
    if (list.length) out.push(`<ul>${list.map((item) => `<li>${inline(item)}</li>`).join("")}</ul>`);
    list = [];
  };
  const flushCode = () => {
    if (code.length) out.push(`<pre><code>${escapeHtml(code.join("\n"))}</code></pre>`);
    code = [];
  };

  for (const line of lines) {
    if (/^\s*```/.test(line)) {
      if (inCode) { flushCode(); inCode = false; } else { flushParagraph(); flushList(); inCode = true; }
      continue;
    }
    if (inCode) { code.push(line); continue; }

    const heading = /^(#{1,4})\s+(.*)$/.exec(line);
    if (heading) {
      flushParagraph(); flushList();
      const level = Math.min(heading[1].length + 1, 5); // h1 in markdown becomes page h2
      out.push(`<h${level}>${inline(heading[2])}</h${level}>`);
      continue;
    }
    if (/^\s*[-*+]\s+/.test(line)) {
      flushParagraph();
      list.push(line.replace(/^\s*[-*+]\s+/, ""));
      continue;
    }
    if (!line.trim()) {
      flushParagraph(); flushList();
      continue;
    }
    flushList();
    paragraph.push(line.trim());
  }
  flushParagraph(); flushList(); flushCode();
  return out.join("\n");
}

function slugify(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "note";
}

function sectionOf(relative) {
  const dir = path.posix.dirname(String(relative || "").replace(/\\/g, "/"));
  return dir === "." ? "" : dir;
}

function sectionLabel(section) {
  return section ? section.split("/").join(" / ") : "Общие";
}

function noteCategory(section) {
  return section ? `Заметки / ${section.split("/").join(" / ")}` : "Заметки";
}

function parseNote(file) {
  const raw = fs.readFileSync(file, "utf8");
  // A date in the YAML front matter wins; otherwise use the file's mtime so
  // the blog timeline still has a stable newest-first order.
  const dateMatch = /(?:^|\n)\s*date:\s*(\d{4}-\d{2}-\d{2})/.exec(raw);
  const date = dateMatch ? dateMatch[1] : new Date(fs.statSync(file).mtimeMs).toISOString().slice(0, 10);
  const firstHeading = /^#\s+(.+)$/m.exec(raw);
  const title = (firstHeading?.[1] || path.basename(file, ".md")).trim();
  const body = firstHeading ? raw.replace(/^#\s+.+\n?/m, "") : raw;
  const relative = path.relative(NOTES_DIR, file).replace(/\\/g, "/");
  const section = sectionOf(relative);
  const baseSlug = slugify(path.basename(file, ".md"));
  const slug = section ? `${slugify(section.replace(/\//g, "-"))}-${baseSlug}` : baseSlug;
  return {
    title,
    slug,
    date,
    relative,
    section,
    text: body.replace(/[#*`\[\]()>]/g, " ").replace(/\s+/g, " ").trim(),
    // Only the graph builder needs the untouched source (for [[links]] and
    // backticked filenames); it is never written into the public metadata.
    rawBody: body,
    html: markdown(body),
  };
}

function shell({ title, description, body, depth, isIndex = false }) {
  const base = "../".repeat(depth);
  return `<!doctype html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>zqwy — ${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(description)}">
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
        document.documentElement.lang = s && s.language === "en" ? "en" : "ru";
      } catch (e) { document.documentElement.dataset.theme = "dark"; }
    })();
  </script>
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

function renderTree(node, depth = 0) {
  const pad = "  ".repeat(depth);
  let html = "";
  for (const child of sortedFolders(node)) {
    html += `${pad}<details class="notes-folder">\n`;
    html += `${pad}  <summary><span class="notes-folder-icon" aria-hidden="true">${folderIcon(child.name)}</span><span class="notes-folder-name">${escapeHtml(child.name)}</span></summary>\n`;
    html += `${pad}  <div class="notes-folder-body">\n`;
    html += renderTree(child, depth + 2);
    html += `${pad}  </div>\n`;
    html += `${pad}</details>\n`;
  }
  for (const note of sortedNotes(node)) {
    html += `${pad}<a class="note-tree-link" href="./${escapeHtml(note.slug)}.html"><span class="note-tree-title">${escapeHtml(note.title)}</span><span class="note-tree-date">${escapeHtml(note.date)}</span><span class="note-tree-path">${escapeHtml(note.relative)}</span></a>\n`;
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
const notes = walk(NOTES_DIR).map(parseNote);
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

const treeHtml = notes.length
  ? `        <nav class="notes-tree" aria-label="Заметки">\n${renderTree(tree, 5)}        </nav>`
  : `        <p class="notes-empty" data-i18n="notesEmpty">Заметки пока не добавлены. Положите .md-файлы в src/notes/.</p>`;

const previewsHtml = orderedNotes.map((note) => `        <section class="note-preview" id="note-${escapeHtml(note.slug)}">
          <p class="note-preview-section">${escapeHtml(sectionLabel(note.section))}</p>
          <p class="note-preview-date">${escapeHtml(note.date)}</p>
          <h2>${escapeHtml(note.title)}</h2>
${note.html.split("\n").map((line) => `          ${line}`).join("\n")}
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
}));

for (const note of notes) {
  const label = sectionLabel(note.section);
  writeFileSafe(path.join(OUT_DIR, `${note.slug}.html`), shell({
    title: note.title,
    description: note.text.slice(0, 150),
    body: `        <header class="note-header"><p class="note-section">${escapeHtml(label)}</p><h2>${escapeHtml(note.title)}</h2><p>${escapeHtml(note.relative)}</p></header>\n${note.html.split("\n").map((line) => `        ${line}`).join("\n")}`,
    depth: 2,
  }));
}

fs.mkdirSync(path.dirname(META_FILE), { recursive: true });
writeFileSafe(META_FILE, `${JSON.stringify({
  generatedAt: new Date().toISOString(),
  count: notes.length,
  notes: notes.map((note) => ({
    title: note.title,
    path: `./wiki/zqwy/${note.slug}.html`,
    section: note.section,
    relative: note.relative,
    // Keep the full note text searchable: important phrases can easily sit
    // past the first 240 characters, and the index is still tiny.
    text: note.text,
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
