import test from "node:test";
import assert from "node:assert/strict";
import { buildNoteGraph, extractReferenceTargets } from "./note-graph.mjs";

const note = (id, extra = {}) => ({
  slug: id,
  title: id,
  relative: `${id}.md`,
  section: "",
  date: "2026-01-01",
  text: "produktivnost tihogo uma i muzykalnie eksperimenti so zvukom",
  rawBody: "",
  ...extra,
});

test("extracts wiki, code and markdown links", () => {
  const body = "См. [[Drugaia|другая]] и `tretya.md` и [четвёртая](pod/chetvertaya.md#razdel).";
  assert.deepEqual(extractReferenceTargets(body).sort(), [
    "Drugaia", "pod/chetvertaya.md", "tretya.md",
  ]);
});

test("resolves explicit mentions, numbered series and never self-links", () => {
  const graph = buildNoteGraph([
    note("a", { rawBody: "См. [[B]] и `b.md`." }),
    note("b"),
  ]);
  assert.equal(graph.links.length, 1);
  assert.equal(graph.links[0].kind, "reference");
  assert.equal(graph.links[0].source, "a");
  assert.equal(graph.links[0].target, "b");
  assert.equal(graph.stats.reference, 1);
  assert.ok(graph.nodes.every((node) => node.degree === 1));
});

test("connects neighbouring numbered notes inside one section", () => {
  const graph = buildNoteGraph([
    note("one", { title: "01. Первая", relative: "d/01. Первая.md", section: "d", rawBody: "" }),
    note("two", { title: "02. Вторая", relative: "d/02. Вторая.md", section: "d", rawBody: "" }),
    note("three", { title: "03. Третья", relative: "d/03. Третья.md", section: "d", rawBody: "" }),
  ], {});
  const series = graph.links.filter((link) => link.kind === "series");
  assert.equal(series.length, 2);
  assert.ok(series.some((link) => link.source === "one" && link.target === "two"));
  assert.ok(series.some((link) => link.source === "two" && link.target === "three"));
});

test("adds similarity edges for notes without explicit links", () => {
  const graph = buildNoteGraph([
    note("a", { text: "zvuk muzyka eksperiment effects signal zvuk muzyka" }),
    note("b", { text: "zvuk muzyka eksperiment effects signal muzyka zvuk" }),
    note("c", { text: "sovsem drugaya tema geology rocks minerals" }),
  ]);
  assert.ok(graph.links.some((link) => link.kind === "similar"));
  assert.ok(graph.nodes.every((node) => Number.isFinite(node.chars)));
});

test("is deterministic and keeps link ids valid", () => {
  const notes = [note("a"), note("b"), note("c")];
  const first = buildNoteGraph(notes);
  const second = buildNoteGraph(notes);
  assert.deepEqual(first.links, second.links);
  const ids = new Set(first.nodes.map((node) => node.id));
  assert.ok(first.links.every((link) => ids.has(link.source) && ids.has(link.target)));
});
