import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { parseNote, NOTES_DIR } from "./notes-source.mjs";
import {
  loadNoteTranslationIndex,
  loadNoteVariants,
  parseNoteVariant,
  sectionPaths,
  sectionTranslationKey,
  variantFor,
} from "./note-translations.mjs";

test("section helpers produce stable dictionary keys", () => {
  assert.equal(sectionTranslationKey("bio/job"), "bio-job");
  assert.equal(sectionTranslationKey(""), "general");
  assert.deepEqual(sectionPaths("bio/job"), ["", "bio", "bio/job"]);
});

test("parseNoteVariant separates front matter from searchable text and prefers translated titles", () => {
  const raw = `---\ntitle:\ndescription:\ntags:\n  - folk\n---\nAesthetics: Indie Folk;\n`;
  const parsed = parseNoteVariant(raw, { fallbackTitle: "folk", indexTitle: "Aesthetics: Indie Folk" });
  assert.equal(parsed.title, "Aesthetics: Indie Folk");
  assert.equal(parsed.description, "Aesthetics: Indie Folk;");
  assert.ok(!parsed.text.includes("---"));
  assert.ok(!parsed.text.includes("tags:"));
  // Pages keep rendering front matter as before; story-tree notes store their
  // whole payload there, so hiding it would leave an empty article.
  assert.ok(parsed.html.includes("tags:"));
});

test("real EN/DE variants exist for translated notes", () => {
  const relative = "music/effects.md";
  const note = parseNote(path.join(NOTES_DIR, relative), NOTES_DIR);
  const variants = loadNoteVariants(note, loadNoteTranslationIndex());
  assert.ok(variants.en, "English note variant should exist");
  assert.ok(variants.de, "German note variant should exist");
  assert.notEqual(variants.en.title, variants.ru.title);
  assert.notEqual(variants.de.title, variants.ru.title);
  assert.ok(variants.en.html.includes("Dynamic Processing"));
  assert.ok(variants.de.html.includes("Dynamikbearbeitung"));
  assert.ok(!variants.en.html.includes("---"));
});

test("missing translations fall back to the Russian variant", () => {
  const relative = "tiddly/notes/algiz.md";
  const source = path.join(NOTES_DIR, relative);
  const note = parseNote(source, NOTES_DIR);
  const variants = loadNoteVariants(note, loadNoteTranslationIndex());
  assert.equal(variants.en, null);
  assert.equal(variantFor(variants, "en"), variants.ru);
  assert.equal(variantFor(variants, "de"), variants.ru);
});
