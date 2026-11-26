/* radio/i18n.js — модуль скрипта radio.js. */
export function install(P) {
  Object.assign(P, { lang, text, clock });


  function lang() {
    return document.documentElement.lang === "en" ? "en" : "ru";
  }

  function text() {
    return P.TEXT[P.lang()];
  }

  function clock(ms) {
    try {
      return new Date(ms).toLocaleTimeString(P.lang() === "en" ? "en-GB" : "ru-RU", {
        hour: "2-digit", minute: "2-digit",
      });
    } catch {
      return "";
    }
  }}
