/*
 * Cursor-reactive hover glow for links and games cards.
 *
 * base.css draws a radial fill and a 1px border highlight using --accent,
 * --mx and --my. This script gives every card its service colour once and
 * then only updates the two pointer coordinates, so moving the mouse over
 * Spotify (for example) leaves a green trail under the cursor.
 *
 * The listener is delegated, so it keeps working after SPA page swaps.
 */
(() => {
  "use strict";

  const DEFAULT = "255, 255, 255";

  // Order matters: more specific patterns must come before broader ones.
  const ACCENTS = [
    // games
    [/to[-_ ]?east|godot/i, "73, 160, 220"],
    [/rhythm[-_ ]?catalog/i, "255, 100, 60"],
    [/labyrinth|zemic|games\/zqwy/i, "160, 110, 255"],
    [/nemeton|umbrella/i, "90, 200, 130"],
    [/ клетчат|adventure/i, "235, 190, 80"],
    [/drill|курган/i, "190, 150, 100"],
    [/remaining|оставш/i, "220, 80, 100"],
    [/nine[-_ ]?sleeps|kern|девять/i, "120, 150, 255"],
    [/game[-_ ]?designer/i, "200, 200, 200"],
    [/east/i, "255, 190, 60"],

    // links / platforms
    [/spotify/i, "30, 215, 96"],
    [/youtube/i, "255, 0, 0"],
    [/tiktok|my toks/i, "254, 36, 92"],
    [/telegram|t\.me/i, "42, 171, 238"],
    [/pinterest/i, "230, 0, 0"],
    [/matrix/i, "0, 176, 144"],
    [/linktr\.ee/i, "165, 48, 255"],
    [/instagram/i, "225, 48, 108"],
    [/facebook/i, "59, 89, 152"],
    [/mastodon/i, "99, 100, 255"],
    [/bluesky|bsky/i, "0, 119, 255"],
    [/vk\.com/i, "75, 119, 190"],
    [/substack/i, "255, 103, 31"],
    [/reddit/i, "255, 87, 18"],
    [/itch\.io/i, "255, 70, 110"],
    [/duolingo/i, "88, 188, 67"],
    [/pond5/i, "0, 180, 220"],
    [/audiomack/i, "255, 160, 0"],
    [/apple[_ -]?music/i, "250, 75, 95"],
    [/amazon[_ -]?music/i, "255, 153, 0"],
    // sumbit_hub is a deliberately purple icon/name, not a red one.
    [/submit[_ -]?hub|sumbit/i, "165, 48, 255"],
    [/soundclick/i, "255, 130, 0"],
    [/soundcloud/i, "255, 85, 0"],
    [/rapchat/i, "140, 90, 255"],
    [/yandex[_ -]?music/i, "255, 215, 0"],
    [/mts[_ -]?music/i, "255, 0, 0"],
    [/sber[_ -]?zvuk/i, "30, 190, 90"],
    [/shazam/i, "0, 170, 255"],
    [/deezer/i, "160, 55, 255"],
    [/bandcamp/i, "30, 170, 190"],
    [/pandora/i, "60, 120, 255"],
    [/qobuz/i, "255, 200, 0"],
    [/ok\.ru/i, "255, 170, 0"],
    [/audius/i, "60, 200, 255"],
    [/flo/i, "145, 80, 255"],
    [/mailto:|email/i, "120, 180, 255"],
  ];

  function cardFrom(target) {
    return target instanceof Element ? target.closest(".link-card, .game-card, .music-track") : null;
  }

  function applyAccents(root = document) {
    root.querySelectorAll(".link-card, .game-card").forEach((card) => {
      const haystack = `${card.getAttribute("href") || ""} ${card.textContent || ""}`;
      const found = ACCENTS.find(([pattern]) => pattern.test(haystack));
      card.style.setProperty("--accent", found ? found[1] : DEFAULT);
    });
  }

  document.addEventListener("pointermove", (event) => {
    const card = cardFrom(event.target);
    if (!card) return;
    const rect = card.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;
    card.style.setProperty("--mx", `${x.toFixed(1)}%`);
    card.style.setProperty("--my", `${y.toFixed(1)}%`);
  }, { passive: true });

  document.addEventListener("pointerout", (event) => {
    const card = cardFrom(event.target);
    if (!card || (event.relatedTarget instanceof Node && card.contains(event.relatedTarget))) return;
    card.style.setProperty("--mx", "50%");
    card.style.setProperty("--my", "50%");
  }, { passive: true });

  applyAccents();
  window.addEventListener("zqwy:pagechange", () => applyAccents());
})();
