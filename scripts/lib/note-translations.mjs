#!/usr/bin/env node
/*
 * Optional RU/EN/DE variants for notes.
 *
 * Russian notes stay in src/notes/ and remain the canonical source (slugs,
 * dates, graph links). Translations live in src/notes-i18n/<lang>/ with the
 * same relative paths, plus src/notes-i18n/index.json for short titles and
 * folder labels. Missing or empty variants simply fall back to Russian.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { markdownToHtml, sectionLabel, slugify } from "./notes-source.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const NOTES_I18N_ROOT = path.resolve(HERE, "../..", "src", "notes-i18n");
export const NOTE_LANGUAGES = ["ru", "en", "de"];
const INDEX_FILE = path.join(NOTES_I18N_ROOT, "index.json");

export function loadNoteTranslationIndex() {
  try {
    const data = JSON.parse(fs.readFileSync(INDEX_FILE, "utf8"));
    return {
      titles: data && typeof data.titles === "object" && data.titles ? data.titles : {},
      sections: data && typeof data.sections === "object" && data.sections ? data.sections : {},
    };
  } catch {
    return { titles: {}, sections: {} };
  }
}

export function sectionTranslationKey(section) {
  const value = String(section || "").trim();
  return value ? (slugify(value.replace(/\//g, "-")) || "general") : "general";
}

/** Every section path plus its ancestors, so nested folders can be labelled. */
export function sectionPaths(section) {
  const parts = String(section || "").split("/").filter(Boolean);
  const out = [""];
  let current = "";
  for (const part of parts) {
    current = current ? `${current}/${part}` : part;
    out.push(current);
  }
  return out;
}

export function translatedSectionLabel(section, lang, index = loadNoteTranslationIndex()) {
  if (lang === "ru") return sectionLabel(section);
  return index.sections?.[String(section || "")]?.[lang] || sectionLabel(section);
}

function parseFrontmatter(raw) {
  const match = /^\s*---\s*\r?\n([\s\S]*?)\r?\n---\s*(?:\r?\n|$)/.exec(raw);
  if (!match) return { body: raw, fields: {} };
  const fields = {};
  for (const line of match[1].split(/\r?\n/)) {
    const field = /^([A-Za-z0-9_-]+)\s*:\s*(.*)$/.exec(line.trim());
    if (!field) continue;
    fields[field[1].toLowerCase()] = field[2].trim().replace(/^["']|["']$/g, "");
  }
  return { body: raw.slice(match[0].length), fields };
}

function cleanText(body) {
  return body.replace(/[#*`\[\]()>]/g, " ").replace(/\s+/g, " ").trim();
}

/**
 * Parse one language variant. `fallbackTitle` keeps the canonical RU title
 * when a translation has no explicit title/heading of its own.
 */
export function parseNoteVariant(raw, { fallbackTitle = "", indexTitle = "" } = {}) {
  const { body: withoutFrontmatter, fields } = parseFrontmatter(String(raw || ""));
  const heading = /^#\s+(.+)$/m.exec(withoutFrontmatter);
  const title = (fields.title || indexTitle || heading?.[1] || fallbackTitle || "").trim();
  const body = heading ? withoutFrontmatter.replace(heading[0], "") : withoutFrontmatter;
  const text = cleanText(body);
  // Front matter is metadata for search/titles, but the note pages have always
  // rendered it as text (story-tree notes keep their whole payload there), so
  // keep the original rendering in every language.
  const displaySource = heading ? raw.replace(heading[0], "") : raw;
  return {
    title,
    description: (fields.description || text.slice(0, 150)).trim(),
    text,
    body,
    html: markdownToHtml(displaySource),
  };
}

/**
 * Build a `{ ru, en, de }` map for one note. EN/DE entries are null when no
 * translation file exists; callers fall back to the RU variant.
 */
export function loadNoteVariants(note, index = loadNoteTranslationIndex()) {
  const sourceFile = note.file || path.join(path.resolve(HERE, "../..", "src", "notes"), note.relative);
  const rawRu = fs.readFileSync(sourceFile, "utf8");
  const variants = {
    ru: parseNoteVariant(rawRu, { fallbackTitle: note.title || "" }),
    en: null,
    de: null,
  };
  for (const lang of ["en", "de"]) {
    const file = path.join(NOTES_I18N_ROOT, lang, note.relative);
    if (!fs.existsSync(file)) continue;
    let raw;
    try { raw = fs.readFileSync(file, "utf8"); } catch { continue; }
    if (!raw.trim()) continue;
    variants[lang] = parseNoteVariant(raw, {
      fallbackTitle: note.title || "",
      indexTitle: index.titles?.[note.relative]?.[lang] || "",
    });
  }
  return variants;
}

export function variantFor(variants, lang) {
  return variants?.[lang] || variants?.ru;
}
