/*\
title: $:/plugins/player_switcher/players/html5-video
type: application/javascript
module-type: library
\*/
(function () {
  "use strict";

  exports.label = "HTML5 audio";

  exports.isAvailable = function () {
    return true;
  };

  exports.render = function ({ container, src }) {
    const doc = container.ownerDocument;

    const audio = doc.createElement("audio");
    audio.controls = true;
    audio.preload = "metadata";
    if (src) audio.src = src;

    audio.style.width = "100%";
    audio.style.display = "block";

    container.appendChild(audio);

    if (!src) {
      const msg = doc.createElement("div");
      msg.textContent = "No src provided to player-switcher.";
      container.appendChild(msg);
    }
  };
})();

