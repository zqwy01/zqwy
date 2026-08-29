exports.render = function(opts) {
  var container = opts.container;
  var wiki = opts.wiki;
  var src = opts.src || "";
  var playerId = opts.playerId || "";

  if (typeof document === "undefined") return;

  // 1) Создаём placeholder, который уже умеет обрабатывать wavesurfer.js
  var placeholder = document.createElement("div");
  placeholder.className = "wavesurfer-placeholder";
  placeholder.dataset.src = src;

  // если хочешь управлять высотой через style плейсхолдера
  // placeholder.style.height = "500px";

  // 2) Кидаем в контейнер player-switcher-а
  container.appendChild(placeholder);

  // 3) Поднимаем startup-процесс wavesurfer.js (инициализация + MutationObserver)
  // guard, чтобы не запускать startup многократно
  if (typeof window !== "undefined") {
    window.__wavesurferPluginStartupDone = window.__wavesurferPluginStartupDone || {};
    var key = String(playerId) || "default";

    if (!window.__wavesurferPluginStartupDone[key]) {
      window.__wavesurferPluginStartupDone[key] = true;

      var wsModule = null;
      try {
        wsModule = require("$:/plugins/music_player/wavesurfer.js");
      } catch (e) {}

      if (wsModule && typeof wsModule.startup === "function") {
        wsModule.startup();
      }
    }
  }
};