#!/usr/bin/env node
/*
 * Minimal Markdown -> TiddlyWiki WikiText converter for the wiki notes.
 *
 * TiddlyWiki renders tiddlers of type `text/html` inside a sandboxed iframe,
 * and raw HTML placed in a normal tiddler is parsed as WikiText (so `[[...]]`
 * and `//` in the prose break the page). Converting the Markdown into native
 * WikiText instead gives inline rendering, working links, tags and search
 * without the Markdown plugin.
 *
 * Supported subset matches lib/notes-source.mjs: headings, lists (including
 * nested and quoted), code fences, paragraphs with soft breaks, emphasis,
 * inline code, links, images and [[wiki links]].
 */

function safeUrl(value) {
  const url = String(value || "").trim();
  if (/^(https?:\/\/|mailto:|\/|\.{1,2}\/|#)/i.test(url)) return url;
  return "#";
}

function normalizeLink(value) {
  return String(value || "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "_").replace(/^_+|_+$/g, "");
}

function inline(value, linkMap) {
  const held = [];
  const hold = (text) => {
    const key = `\u0000${held.length}\u0000`;
    held.push(text);
    return key;
  };
  let out = String(value || "")
    // Unknown WikiText widgets (e.g. <$player-switcher> copied from an old
    // TiddlyWiki note) would be executed as widget calls. Show them as text.
    .replace(/<\/?\$/g, (match) => match.replace("<", "&lt;"));

  // Protect spans whose contents must not be re-parsed as emphasis or links.
  out = out.replace(/`([^`]+)`/g, (match, code) => hold(match));
  out = out.replace(/!\[([^\]]*)\]\(((?:[^()]|\([^()]*\))*)\)/g,
    (match, alt, url) => hold(`<img src="${safeUrl(url)}" alt="${alt}">`));
  out = out.replace(/\[([^\]]+)\]\(((?:[^()]|\([^()]*\))*)\)/g,
    (match, text, url) => hold(`[${text}|${safeUrl(url)}]`));

  // TiddlyWiki writes [[target|label]], while the notes contain both that
  // form and [[label|target]]. Resolve whichever part names a generated
  // tiddler; otherwise show plain text instead of a "missing tiddler" link.
  out = out.replace(/\[\[([^\[\]]+)\]\]/g, (match, body) => {
    const parts = body.split("|").map((part) => part.trim());
    const first = parts[0];
    const second = parts[1];
    if (second === undefined) {
      const resolved = linkMap?.get(normalizeLink(first));
      return hold(resolved ? `[[${resolved}]]` : first);
    }
    if (linkMap?.has(normalizeLink(first))) return hold(`[[${first}|${second}]]`);
    if (linkMap?.has(normalizeLink(second))) return hold(`[[${second}|${first}]]`);
    return hold(first);
  });

  // Bare URLs would be italicised by the `//` emphasis rule. Give them an
  // explicit WikiText external link before escaping the rest of the text.
  out = out.replace(/https?:\/\/[^\s<>()"]+/gi, (url) => hold(`[${url}]`));

  // Neutralise WikiText tokens that can occur in ordinary prose.
  out = out
    .replace(/\{\{/g, "&#123;&#123;")
    .replace(/<</g, "&lt;&lt;")
    .replace(/\/\//g, "&#47;&#47;")
    .replace(/~~/g, "&#126;&#126;")
    .replace(/\^\^/g, "&#94;&#94;")
    .replace(/''/g, "&#39;&#39;");

  // Markdown emphasis -> WikiText emphasis. Underscores are deliberately not
  // treated as emphasis: notes contain many identifiers and URLs with `_`.
  out = out
    .replace(/\*\*([^*]+)\*\*/g, "''$1''")
    .replace(/\*([^*]+)\*/g, "//$1//");

  return out.replace(/\u0000(\d+)\u0000/g, (match, index) => held[Number(index)]);
}

function indentLevel(spaces) {
  return Math.min(Math.floor(String(spaces || "").replace(/\t/g, "  ").length / 2) + 1, 6);
}

export function markdownToWikiText(value, options = {}) {
  const linkMap = options.linkMap;
  const lines = String(value || "").replace(/\r\n?/g, "\n").split("\n");
  const out = [];
  let paragraph = [];
  let inCode = false;

  const flushParagraph = () => {
    if (paragraph.length) out.push(paragraph.map((line) => inline(line, linkMap)).join("<br>"));
    paragraph = [];
  };

  for (const line of lines) {
    if (/^\s*```/.test(line)) {
      if (inCode) {
        out.push("}}}");
        inCode = false;
      } else {
        flushParagraph();
        out.push("{{{");
        inCode = true;
      }
      continue;
    }
    if (inCode) {
      out.push(line);
      continue;
    }

    const heading = /^(#{1,6})\s+(.*)$/.exec(line);
    if (heading) {
      flushParagraph();
      out.push(`${"!".repeat(heading[1].length)} ${inline(heading[2], linkMap)}`);
      continue;
    }
    if (/^\s*(?:-{3,}|\*{3,}|_{3,})\s*$/.test(line)) {
      flushParagraph();
      out.push("----");
      continue;
    }

    const unordered = /^([ \t]*)[-+*]\s+(.*)$/.exec(line);
    if (unordered) {
      flushParagraph();
      out.push(`${"*".repeat(indentLevel(unordered[1]))} ${inline(unordered[2], linkMap)}`);
      continue;
    }
    const ordered = /^([ \t]*)\d+[.)]\s+(.*)$/.exec(line);
    if (ordered) {
      flushParagraph();
      out.push(`${"#".repeat(indentLevel(ordered[1]))} ${inline(ordered[2], linkMap)}`);
      continue;
    }
    const quote = /^([ \t]*)>\s?(.*)$/.exec(line);
    if (quote) {
      flushParagraph();
      out.push(`${">".repeat(indentLevel(quote[1]))} ${inline(quote[2], linkMap)}`);
      continue;
    }

    if (!line.trim()) {
      flushParagraph();
      out.push("");
      continue;
    }
    paragraph.push(line.trim());
  }
  flushParagraph();
  if (inCode) out.push("}}}");

  return out.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

export function buildLinkMap(notes) {
  const map = new Map();
  for (const note of notes) {
    for (const key of [note.title, note.slug, note.relative, note.relative.replace(/\.md$/i, "")]) {
      const normalized = normalizeLink(key);
      if (normalized && !map.has(normalized)) map.set(normalized, note.title);
    }
  }
  return map;
}
