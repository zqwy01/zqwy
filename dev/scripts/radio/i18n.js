/* radio/i18n.js — модуль скрипта radio.js. */
export function install(P) {
  Object.assign(P, { lang, text, clock });


  function lang() {
    const value = document.documentElement.lang;
    return ["ru", "en", "de"].includes(value) ? value : "ru";
  }

  function text() {
    return P.TEXT[P.lang()];
  }

  function clock(ms) {
    try {
      const locale = { ru: "ru-RU", en: "en-GB", de: "de-DE" }[P.lang()] || "ru-RU";
      return new Date(ms).toLocaleTimeString(locale, {
        hour: "2-digit", minute: "2-digit",
      });
    } catch {
      return "";
    }
  }}
