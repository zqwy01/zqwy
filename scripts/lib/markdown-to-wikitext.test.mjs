import assert from "node:assert/strict";
import test from "node:test";
import { markdownToWikiText, buildLinkMap } from "./markdown-to-wikitext.mjs";

test("headings become WikiText headings", () => {
  assert.equal(markdownToWikiText("# Title\n\n## Section\n\ntext"), "! Title\n\n!! Section\n\ntext");
});

test("unordered, ordered, nested and quoted lists", () => {
  const md = "- one\n  - two\n1. first\n2. second\n> quote";
  assert.equal(
    markdownToWikiText(md),
    "* one\n** two\n# first\n# second\n> quote",
  );
});

test("code fences become code blocks and keep their content", () => {
  const md = "before\n\n```js\nconst x = [[not a link]];\n```\n\nafter";
  assert.equal(
    markdownToWikiText(md),
    "before\n\n{{{\nconst x = [[not a link]];\n}}}\n\nafter",
  );
});

test("emphasis, inline code and links are converted", () => {
  assert.equal(
    markdownToWikiText("**bold** and *italic* and `code` and [site](https://example.com)"),
    "''bold'' and //italic// and `code` and [site|https://example.com]",
  );
});

test("bare URLs do not turn following prose into italics", () => {
  const out = markdownToWikiText("see https://example.com/a//b and more");
  assert.match(out, /\[https:\/\/example\.com\/a\/\/b\]/);
  assert.ok(!out.includes("// and more"));
});

test("wiki links resolve through the note map, otherwise become plain text", () => {
  const notes = [{ title: "Скрижаль", slug: "skrizhal", relative: "zemic/скрижаль.md" }];
  const linkMap = buildLinkMap(notes);
  assert.equal(
    markdownToWikiText("[[Скрижаль]] and [[Скрижаль|detail]] and [[нет|missing]]", { linkMap }),
    "[[Скрижаль]] and [[Скрижаль|detail]] and нет",
  );
});

test("soft line breaks inside a paragraph are explicit", () => {
  assert.equal(markdownToWikiText("first line\nsecond line"), "first line<br>second line");
});

test("markdown image becomes an html img tag", () => {
  assert.equal(
    markdownToWikiText("![alt](https://example.com/a.png)"),
    '<img src="https://example.com/a.png" alt="alt">',
  );
});

test("unsupported link targets are neutralised", () => {
  assert.equal(markdownToWikiText("[bad](javascript:alert(1))"), "[bad|#]");
});
