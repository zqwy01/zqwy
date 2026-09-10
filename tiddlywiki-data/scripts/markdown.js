// markdown.js
import { marked } from "marked";
import sanitizeHtml from "sanitize-html";

const removeHtmlOptions = {
  allowedTags: [],
  allowedAttributes: {},
  disallowedTagsMode: "discard"
};

const outputOptions = {
  allowedTags: [
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",

    "p",
    "br",
    "hr",

    "strong",
    "b",
    "em",
    "i",
    "del",
    "s",

    "ul",
    "ol",
    "li",

    "blockquote",

    "pre",
    "code",

    "a",
    "img",

    "table",
    "thead",
    "tbody",
    "tfoot",
    "tr",
    "th",
    "td"
  ],

  allowedAttributes: {
    a: [
      "href",
      "title"
    ],

    img: [
      "src",
      "alt",
      "title",
      "width",
      "height"
    ],

    code: [
      "class"
    ]
  },

  allowedSchemes: [
    "http",
    "https",
    "mailto"
  ],

  allowProtocolRelative: false
};

/**
 * Экранирование текста ссылки для Markdown.
 *
 * Например:
 * [алгиз] -> \[алгиз\]
 */
function escapeMarkdownLinkText(value) {
  return String(value)
    .replaceAll("\\", "\\\\")
    .replaceAll("[", "\\[")
    .replaceAll("]", "\\]");
}

/**
 * Преобразование адреса ссылки.
 *
 * Здесь можно настроить маршрут приложения.
 */
function resolveWikiLink(target) {
  const value = String(target).trim();

  if (!value) {
    return "";
  }

  /*
   * Внешние и уже готовые адреса оставляем без изменений.
   */
  if (
    /^(https?:|mailto:|#|\/|\.\/|\.\.\/)/i.test(value)
  ) {
    return value;
  }

  /*
   * Вариант по умолчанию:
   *
   * [[алгиз|руны]]
   *
   * превращается в:
   *
   * [алгиз](#руны)
   */
  return `#${encodeURIComponent(value)}`;
}

/**
 * Защищает кодовые блоки и inline-код,
 * чтобы ссылки внутри них не преобразовывались.
 */
function protectCode(source) {
  const protectedBlocks = [];

  const protectedSource = source.replace(
    /(```[\s\S]*?```|~~~[\s\S]*?~~~|`[^`\n]*`)/g,
    (block) => {
      const index = protectedBlocks.push(block) - 1;

      return `@@MARKDOWN_CODE_BLOCK_${index}@@`;
    }
  );

  return {
    protectedSource,
    protectedBlocks
  };
}

/**
 * Восстанавливает кодовые блоки после обработки ссылок.
 */
function restoreCode(source, protectedBlocks) {
  return source.replace(
    /@@MARKDOWN_CODE_BLOCK_(\d+)@@/g,
    (_, index) => protectedBlocks[Number(index)]
  );
}

/**
 * Преобразует ссылки TiddlyWiki в Markdown-ссылки.
 *
 * Поддерживает:
 *
 * [[алгиз|руны]]
 * [[руны]]
 */
function convertWikiLinks(source) {
  const {
    protectedSource,
    protectedBlocks
  } = protectCode(source);

  const convertedSource = protectedSource.replace(
    /\[\[([\s\S]*?)\]\]/g,
    (fullMatch, linkContent) => {
      const separatorIndex = linkContent.indexOf("|");

      let label;
      let target;

      if (separatorIndex === -1) {
        label = linkContent.trim();
        target = linkContent.trim();
      } else {
        label = linkContent
          .slice(0, separatorIndex)
          .trim();

        target = linkContent
          .slice(separatorIndex + 1)
          .trim();
      }

      if (!label || !target) {
        return fullMatch;
      }

      const href = resolveWikiLink(target);

      if (!href) {
        return fullMatch;
      }

      return `[${escapeMarkdownLinkText(label)}](${href})`;
    }
  );

  return restoreCode(convertedSource, protectedBlocks);
}

export function markdownToHtml(value) {
  if (!value) {
    return "";
  }

  const sourceMarkdown = String(value);

  /*
   * Шаг 1.
   *
   * Удаляем старую HTML-разметку.
   */
  const cleanedMarkdown = sanitizeHtml(
    sourceMarkdown,
    removeHtmlOptions
  );

  /*
   * Шаг 2.
   *
   * Преобразуем ссылки TiddlyWiki:
   *
   * [[алгиз|руны]]
   *
   * в:
   *
   * [алгиз](#руны)
   */
  const markdownWithWikiLinks = convertWikiLinks(
    cleanedMarkdown
  );

  /*
   * Шаг 3.
   *
   * Преобразуем Markdown в HTML.
   */
  const renderedHtml = marked.parse(
    markdownWithWikiLinks,
    {
      gfm: true,
      breaks: true,
      html: false
    }
  );

  /*
   * Шаг 4.
   *
   * Очищаем итоговый HTML.
   */
  return sanitizeHtml(
    renderedHtml,
    outputOptions
  );
}
