#!/usr/bin/env node
/*
 * Generate the "zqwy" notes mode from markdown files in src/notes/.
 *
 * Source:  src/notes/**\/*.md            (hand-written markdown, never edited here)
 * Output:  dev/wiki/zqwy/index.html      (notes landing, SPA-compatible)
 *          dev/wiki/zqwy/<slug>.html     (one page per note)
 *          dev/data/wiki-notes.json      (metadata for build_search_index.mjs)
 *
 * No markdown dependency is used: the small converter below handles the
 * subset needed for notes — headings, lists, code fences, paragraphs and
 * inline emphasis/code/links. Run automatically from scripts/build_dist.sh.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PROJECT = path.resolve(HERE, "..");
const NOTES_DIR = path.join(PROJECT, "src", "notes");
const OUT_DIR = path.join(PROJECT, "dev", "wiki", "zqwy");
const META_FILE = path.join(PROJECT, "dev", "data", "wiki-notes.json");

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
    if (paragraph.length) out.push(`<p>${inline(paragraph.join(" "))}</p>`);
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

function parseNote(file) {
  const raw = fs.readFileSync(file, "utf8");
  const firstHeading = /^#\s+(.+)$/m.exec(raw);
  const title = (firstHeading?.[1] || path.basename(file, ".md")).trim();
  const body = firstHeading ? raw.replace(/^#\s+.+\n?/m, "") : raw;
  const relative = path.relative(NOTES_DIR, file).replace(/\\/g, "/");
  const baseSlug = slugify(path.basename(file, ".md"));
  const slug = path.dirname(relative) === "." ? baseSlug : `${slugify(path.dirname(relative))}-${baseSlug}`;
  return { title, slug, relative, text: body.replace(/[#*`\[\]()>]/g, " ").replace(/\s+/g, " ").trim(), html: markdown(body) };
}

function shell({ title, description, body, depth }) {
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
      </header>
      <article class="notes-article">
${body}
      </article>
    </div>
  </main>
  <script src="${base}scripts/transition.js" defer></script>
  <script src="${base}scripts/menu.js" defer></script>
  <script src="${base}scripts/player.js" defer></script>
</body>
</html>
`;
}

const notes = walk(NOTES_DIR).map(parseNote);
fs.mkdirSync(OUT_DIR, { recursive: true });

// Drop pages from notes that have since been removed or renamed.
for (const file of fs.readdirSync(OUT_DIR)) {
  if (file.endsWith(".html") && file !== "index.html") {
    fs.rmSync(path.join(OUT_DIR, file), { force: true });
  }
}

const indexBody = `
        <nav class="notes-nav" aria-label="Заметки">
${notes.length
  ? notes.map((note) => `          <a class="note-card" href="./${escapeHtml(note.slug)}.html"><strong>${escapeHtml(note.title)}</strong><span>${escapeHtml(note.relative)}</span></a>`).join("\n")
  : `          <p class="notes-empty" data-i18n="notesEmpty">Заметки пока не добавлены. Положите .md-файлы в src/notes/.</p>`}
        </nav>
${notes.map((note) => `        <section class="note-preview" id="note-${escapeHtml(note.slug)}">
          <h2>${escapeHtml(note.title)}</h2>
${note.html.split("\n").map((line) => `          ${line}`).join("\n")}
        </section>`).join("\n")}
`.trim();

fs.writeFileSync(path.join(OUT_DIR, "index.html"), shell({
  title: "notes",
  description: "Заметки zqwy в формате markdown",
  body: indexBody,
  depth: 2,
}), "utf8");

for (const note of notes) {
  fs.writeFileSync(path.join(OUT_DIR, `${note.slug}.html`), shell({
    title: note.title,
    description: note.text.slice(0, 150),
    body: `        <header class="note-header"><h2>${escapeHtml(note.title)}</h2><p>${escapeHtml(note.relative)}</p></header>\n${note.html.split("\n").map((line) => `        ${line}`).join("\n")}`,
    depth: 2,
  }), "utf8");
}

fs.mkdirSync(path.dirname(META_FILE), { recursive: true });
fs.writeFileSync(META_FILE, `${JSON.stringify({
  generatedAt: new Date().toISOString(),
  count: notes.length,
  notes: notes.map((note) => ({
    title: note.title,
    path: `./wiki/zqwy/${note.slug}.html`,
    text: note.text.slice(0, 240),
    category: "Заметки",
    type: "note",
    keywords: ["zqwy", "заметки", "notes", "markdown", note.slug],
  })),
}, null, 2)}\n`, "utf8");

console.log(`Wiki notes: ${notes.length} файлов → ${path.relative(PROJECT, OUT_DIR)}`);
