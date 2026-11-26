/* hover-glow/accents.js — модуль скрипта hover-glow.js. */
export function install(P) {
  Object.assign(P, { cardFrom, applyAccents });


  function cardFrom(target) {
    return target instanceof Element ? target.closest(".link-card, .game-card, .music-track") : null;
  }

  function applyAccents(root = document) {
    root.querySelectorAll(".link-card, .game-card").forEach((card) => {
      const haystack = `${card.getAttribute("href") || ""} ${card.textContent || ""}`;
      const found = P.ACCENTS.find(([pattern]) => pattern.test(haystack));
      card.style.setProperty("--accent", found ? found[1] : P.DEFAULT);
    });
  }}
