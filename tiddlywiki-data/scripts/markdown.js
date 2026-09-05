// markdown.js
import { marked } from "marked";
import sanitizeHtml from "sanitize-html";

const removeHtmlOptions = {
  // Не разрешаем ни одного HTML-тега
  allowedTags: [],

  // Не разрешаем HTML-атрибуты
  allowedAttributes: {},

  // Удаляем теги, сохраняя их текстовое содержимое
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

export function markdownToHtml(value) {
  if (!value) {
    return "";
  }

  const sourceMarkdown =
    String(value);

  /*
   * Шаг 1.
   *
   * Удаляем старую HTML-разметку
   * из исходного текста.
   *
   * Например:
   * <p>Текст</p>
   *
   * превращается в:
   * Текст
   */
  const cleanedMarkdown =
    sanitizeHtml(
      sourceMarkdown,
      removeHtmlOptions
    );

  /*
   * Шаг 2.
   *
   * Преобразуем оставшийся Markdown
   * в HTML.
   */
  const renderedHtml =
    marked.parse(
      cleanedMarkdown,
      {
        gfm: true,
        breaks: true,

        /*
         * Не разрешаем marked обрабатывать
         * HTML, если он каким-либо образом
         * остался после очистки.
         */
        html: false
      }
    );

  /*
   * Шаг 3.
   *
   * Очищаем HTML, созданный именно
   * Markdown-конвертером.
   *
   * Это не удаляет разрешённые Markdown-элементы:
   * заголовки, списки, ссылки, таблицы и т.д.
   */
  return sanitizeHtml(
    renderedHtml,
    outputOptions
  );
}
