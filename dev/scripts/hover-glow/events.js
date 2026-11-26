/* hover-glow/events.js — модуль скрипта hover-glow.js. */
export function bindEvents(P) {


  document.addEventListener("pointermove", (event) => {
    const card = P.cardFrom(event.target);
    if (!card) return;
    const rect = card.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;
    card.style.setProperty("--mx", `${x.toFixed(1)}%`);
    card.style.setProperty("--my", `${y.toFixed(1)}%`);
  }, { passive: true });

  document.addEventListener("pointerout", (event) => {
    const card = P.cardFrom(event.target);
    if (!card || (event.relatedTarget instanceof Node && card.contains(event.relatedTarget))) return;
    card.style.setProperty("--mx", "50%");
    card.style.setProperty("--my", "50%");
  }, { passive: true });

  P.applyAccents();
  window.addEventListener("zqwy:pagechange", () => P.applyAccents());}
