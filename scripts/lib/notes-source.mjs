#!/usr/bin/env node
/*
 * Shared source layer for the note generators.
 *
 * Both scripts/build_wiki_notes.mjs (HTML pages for the zqwy notes mode) and
 * scripts/build_tiddlywiki.mjs (tiddlers for the TiddlyWiki build) must see
 * exactly the same set of notes. Keeping the reader/parser here avoids two
 * subtly different implementations drifting apart.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { writeFileSafe } from "./write-file-smb-safe.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));

export const NOTES_DIR = path.resolve(HERE, "../..", "src", "notes");

// Plain-text notes sometimes arrive as .txt or with no extension at all
// (e.g. "Панорамирование"). Convert them to .md in place so the walk below —
// and every subsequent build — sees them. Other formats (.tid, .meta, ...)
// are left untouched, and an existing .md note is never overwritten.
export function normalizeNotes(dir = NOTES_DIR) {
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

export function walkNotes(dir = NOTES_DIR) {
  if (!fs.existsSync(dir)) return [];
  const files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...walkNotes(full));
    else if (entry.isFile() && entry.name.toLowerCase().endsWith(".md")) files.push(full);
  }
  return files.sort();
}

export function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function safeUrl(value) {
  const url = String(value || "").trim();
  if (/^(https?:\/\/|mailto:|\/|\.{1,2}\/|#)/i.test(url)) return escapeHtml(url);
  return "#";
}

export function inlineMarkdown(value) {
  return escapeHtml(value)
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g,
      (match, text, url) => `<a href="${safeUrl(url)}" target="_blank" rel="noopener noreferrer">${text}</a>`);
}

export function markdownToHtml(value) {
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
    if (paragraph.length) out.push(`<p>${paragraph.map(inlineMarkdown).join("<br>\n")}</p>`);
    paragraph = [];
  };
  const flushList = () => {
    if (list.length) out.push(`<ul>${list.map((item) => `<li>${inlineMarkdown(item)}</li>`).join("")}</ul>`);
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
      out.push(`<h${level}>${inlineMarkdown(heading[2])}</h${level}>`);
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

export function slugify(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "note";
}

export function sectionOf(relative) {
  const dir = path.posix.dirname(String(relative || "").replace(/\\/g, "/"));
  return dir === "." ? "" : dir;
}

export function sectionLabel(section) {
  return section ? section.split("/").join(" / ") : "Общие";
}

export function noteCategory(section) {
  return section ? `Заметки / ${section.split("/").join(" / ")}` : "Заметки";
}

export function parseNote(file, notesRoot = NOTES_DIR) {
  notesRoot = typeof notesRoot === "string" ? notesRoot : NOTES_DIR;
  const raw = fs.readFileSync(file, "utf8");
  // A date in the YAML front matter wins; otherwise use the file's mtime so
  // the blog timeline still has a stable newest-first order.
  const dateMatch = /(?:^|\n)\s*date:\s*(\d{4}-\d{2}-\d{2})/.exec(raw);
  const date = dateMatch ? dateMatch[1] : new Date(fs.statSync(file).mtimeMs).toISOString().slice(0, 10);
  const firstHeading = /^#\s+(.+)$/m.exec(raw);
  const title = (firstHeading?.[1] || path.basename(file, ".md")).trim();
  const body = firstHeading ? raw.replace(/^#\s+.+\n?/m, "") : raw;
  const relative = path.relative(notesRoot, file).replace(/\\/g, "/");
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
    // Only the graph builder and the TiddlyWiki generator need the untouched
    // source (for [[links]], markdown syntax and backticked filenames); it is
    // never written into the public search metadata.
    rawBody: body,
    html: markdownToHtml(body),
  };
}
