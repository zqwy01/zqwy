#!/usr/bin/env node
/*
 * Pure data layer for the notes graph.
 *
 * Takes the parsed markdown notes from build_wiki_notes.mjs and produces a
 * tiny, engine-agnostic graph:
 *
 *   nodes: one per note (id = generated page slug)
 *   links: `reference` (explicit .md / [[wiki]] mentions),
 *          `series` (numbered neighbours in one folder),
 *          `similar` (top TF-IDF neighbours, so notes never float alone)
 *
 * The browser only ever sees the JSON produced here — no markdown parsing and
 * no expensive scoring at runtime.
 */

const STOPWORDS = new Set([
  "это", "что", "как", "для", "тот", "этот", "она", "они", "он", "его", "её", "ее", "был", "была", "были",
  "есть", "если", "или", "при", "без", "ещё", "еще", "уже", "быть", "было", "будет",
  "чтобы", "когда", "где", "куда", "очень", "самый", "самая", "самое", "самые", "также", "так", "там",
  "здесь", "этого", "этому", "этим", "все", "всё", "всего", "всем", "раз",
  "the", "and", "for", "with", "that", "this", "from", "into", "you", "your", "are", "was", "were",
  "have", "has", "not", "can", "will", "its", "about", "which", "their", "there", "when", "than",
  "http", "https", "www", "html", "md", "just", "like", "more", "some", "any", "all", "but", "one",
]);

const MIN_TOKEN_LENGTH = 4;
const SIMILAR_PER_NOTE = 4;
const MIN_SIMILARITY = 0.055;

function slugify(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "note";
}

function baseName(value) {
  return String(value || "").replace(/\\/g, "/").split("/").pop() || "";
}

function cleanTarget(value) {
  let target = String(value || "").trim();
  try { target = decodeURIComponent(target); } catch {}
  target = target.replace(/#.*$/, "").replace(/\?.*$/, "").replace(/^\.\//, "");
  return target;
}

/** Extract note mentions written by hand: [[Wiki]], `file.md`, [text](file.md). */
export function extractReferenceTargets(body) {
  const found = [];
  const patterns = [
    /\[\[([^\]]{1,120})\]\]/g,                 // [[Note]] or [[Note|alias]]
    /`([^`\n]{1,160}\.md)`/gi,                  // `note.md`
    /\[[^\]]*\]\(([^)]{1,200}\.md(?:#[^)]*)?)\)/gi, // [text](note.md)
  ];
  for (const re of patterns) {
    let match;
    while ((match = re.exec(String(body || "")))) {
      let target = match[1];
      if (target.includes("|")) target = target.split("|")[0];
      found.push(cleanTarget(target));
    }
  }
  return found;
}

function tokens(text) {
  const out = [];
  for (const word of String(text || "").toLowerCase().matchAll(/[\p{L}\p{N}]+/gu)) {
    const value = word[0];
    if (value.length < MIN_TOKEN_LENGTH || STOPWORDS.has(value) || /^\d+$/.test(value)) continue;
    out.push(value);
  }
  return out;
}

function seriesNumber(note) {
  const candidates = [baseName(note.relative || ""), note.title || ""];
  for (const value of candidates) {
    const match = /(?:^|[^\p{N}])(\d{1,2})(?:[.\-_]|$)/u.exec(value);
    if (match) return Number(match[1]);
  }
  return null;
}

function pairKey(a, b) {
  return a < b ? `${a}\u0000${b}` : `${b}\u0000${a}`;
}

function categoryOf(note) {
  const section = String(note.section || "");
  return section ? section.split("/")[0] : "";
}

/** Build the graph. `notes` need: slug, title, relative, section, date, text, rawBody. */
export function buildNoteGraph(notes, options = {}) {
  const list = Array.isArray(notes) ? notes.filter((note) => note && note.slug) : [];
  const byId = new Map(list.map((note) => [note.slug, note]));
  const aliases = new Map();
  const addAlias = (key, note) => {
    if (!key) return;
    const normalized = String(key).toLowerCase();
    if (!aliases.has(normalized)) aliases.set(normalized, note.slug);
  };
  for (const note of list) {
    const relative = String(note.relative || "").toLowerCase();
    addAlias(baseName(relative), note);
    addAlias(relative, note);
    addAlias(relative.replace(/\.md$/, ""), note);
    addAlias(note.slug, note);
    addAlias(note.title, note);
  }
  const resolve = (target) => {
    const value = cleanTarget(target);
    if (!value) return null;
    return aliases.get(value.toLowerCase())
      || aliases.get(baseName(value).toLowerCase())
      || aliases.get(baseName(value).replace(/\.md$/, "").toLowerCase())
      || null;
  };

  const links = [];
  const seen = new Set();
  const addLink = (source, target, kind, weight) => {
    if (!source || !target || source === target || !byId.has(source) || !byId.has(target)) return false;
    const key = pairKey(source, target);
    if (seen.has(key)) return false;
    seen.add(key);
    links.push({ source, target, kind, weight: Number(weight.toFixed(3)) });
    return true;
  };

  let explicitCount = 0;
  for (const note of list) {
    for (const target of extractReferenceTargets(note.rawBody)) {
      const resolved = resolve(target);
      if (resolved && addLink(note.slug, resolved, "reference", 1)) explicitCount += 1;
    }
  }

  let seriesCount = 0;
  const sections = new Map();
  for (const note of list) {
    const key = String(note.section || "");
    if (!sections.has(key)) sections.set(key, []);
    const number = seriesNumber(note);
    if (number !== null) sections.get(key).push({ slug: note.slug, number });
  }
  for (const group of sections.values()) {
    group.sort((a, b) => a.number - b.number || a.slug.localeCompare(b.slug, "ru"));
    for (let i = 1; i < group.length; i += 1) {
      if (group[i].number - group[i - 1].number <= 2
        && addLink(group[i - 1].slug, group[i].slug, "series", 0.8)) seriesCount += 1;
    }
  }

  // TF-IDF cosine similarity. Sparse enough at this size to do in the build
  // step, which keeps the browser bundle free of any NLP code.
  const docs = list.map((note) => tokens(note.text));
  const df = new Map();
  for (const words of docs) {
    for (const word of new Set(words)) df.set(word, (df.get(word) || 0) + 1);
  }
  const vectors = docs.map((words) => {
    const counts = new Map();
    for (const word of words) counts.set(word, (counts.get(word) || 0) + 1);
    const vector = new Map();
    let norm = 0;
    for (const [word, count] of counts) {
      const idf = Math.log(1 + list.length / (1 + df.get(word)));
      const value = (1 + Math.log(count)) * idf;
      vector.set(word, value);
      norm += value * value;
    }
    norm = Math.sqrt(norm) || 1;
    for (const [word, value] of vector) vector.set(word, value / norm);
    return vector;
  });

  let similarCount = 0;
  const ranked = [];
  const similarWeight = (score) => Math.min(0.55, 0.12 + score * 0.7);
  for (let i = 0; i < list.length; i += 1) {
    const scores = [];
    for (let j = 0; j < list.length; j += 1) {
      if (i === j || seen.has(pairKey(list[i].slug, list[j].slug))) continue;
      const a = vectors[i];
      const b = vectors[j];
      const [small, large] = a.size < b.size ? [a, b] : [b, a];
      let score = 0;
      for (const [word, value] of small) score += value * (large.get(word) || 0);
      if (score <= 0) continue;
      // A small nudge keeps neighbouring folders visually clustered, but the
      // text itself still decides which notes belong together.
      if (categoryOf(list[i]) === categoryOf(list[j])) score += 0.02;
      scores.push({ slug: list[j].slug, score });
    }
    scores.sort((x, y) => y.score - x.score);
    ranked.push(scores);
    for (const candidate of scores.slice(0, SIMILAR_PER_NOTE)) {
      if (candidate.score < MIN_SIMILARITY) continue;
      if (addLink(list[i].slug, candidate.slug, "similar", similarWeight(candidate.score))) similarCount += 1;
    }
  }

  const degree = new Map(list.map((note) => [note.slug, 0]));
  for (const link of links) {
    degree.set(link.source, (degree.get(link.source) || 0) + 1);
    degree.set(link.target, (degree.get(link.target) || 0) + 1);
  }

  // Short notes have very few tokens, so they would otherwise become lonely
  // dots. Give every node at least two neighbours from its ranked list.
  for (let i = 0; i < list.length; i += 1) {
    if ((degree.get(list[i].slug) || 0) >= 2) continue;
    if (!ranked[i].length) {
      const same = list.filter((note, index) => index !== i && categoryOf(note) === categoryOf(list[i]));
      const pool = same.length ? same : list.filter((_, index) => index !== i);
      ranked[i] = pool.slice(0, 3).map((note) => ({ slug: note.slug, score: 0.01 }));
    }
    for (const candidate of ranked[i]) {
      if ((degree.get(list[i].slug) || 0) >= 2) break;
      if (!addLink(list[i].slug, candidate.slug, "similar", similarWeight(candidate.score))) continue;
      degree.set(list[i].slug, (degree.get(list[i].slug) || 0) + 1);
      degree.set(candidate.slug, (degree.get(candidate.slug) || 0) + 1);
      similarCount += 1;
    }
  }
  const finalDegree = new Map(list.map((note) => [note.slug, 0]));
  for (const link of links) {
    finalDegree.set(link.source, (finalDegree.get(link.source) || 0) + 1);
    finalDegree.set(link.target, (finalDegree.get(link.target) || 0) + 1);
  }

  const categoryIds = [...new Set(list.map(categoryOf).filter(Boolean))].sort((a, b) => a.localeCompare(b, "ru"));
  const nodes = list.map((note) => {
    const category = categoryOf(note);
    return {
      id: note.slug,
      title: note.title,
      path: `./wiki/zqwy/${note.slug}.html`,
      section: note.section || "",
      category,
      categoryLabel: category.split("/").join(" / ") || "Общие",
      date: note.date || "",
      chars: String(note.text || "").length,
      excerpt: String(note.text || "").slice(0, 260),
      degree: finalDegree.get(note.slug) || 0,
    };
  });

  return {
    generatedAt: new Date().toISOString(),
    nodes,
    links,
    categories: categoryIds.map((id) => ({ id, label: id.split("/").join(" / ") })),
    stats: {
      nodes: nodes.length,
      links: links.length,
      reference: explicitCount,
      series: seriesCount,
      similar: similarCount,
    },
  };
}

export { slugify };
