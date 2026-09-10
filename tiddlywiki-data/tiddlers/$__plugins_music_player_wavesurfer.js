exports.startup = function () {
  if (typeof window === "undefined" || typeof document === "undefined") return;

  function ensureScript(src, cb) {
    if (window.WaveSurfer) return cb();
    var s = document.createElement("script");
    s.src = src;
    s.onload = function () {
      cb();
    };
    s.onerror = function () {
      cb(new Error("WaveSurfer script load failed"));
    };
    document.head.appendChild(s);
  }

  // ---- подключаем модуль управления кнопками (tiddler module) ----
  var wavesButtonsModule = null;
  try {
    wavesButtonsModule = require("$:/plugins/music_player/waves-buttons.js");
  } catch (e) {
    // оставим null — дальше покажем ошибку и запретим кнопки
  }

  ensureScript("https://unpkg.com/wavesurfer.js@7/dist/wavesurfer.min.js", function init(WSError) {
    if (WSError && WSError.message) {
      showWavesurferErrorOnPlaceholders("WaveSurfer не загрузился — плеер недоступен");
      return;
    }
    initMain();
  });

  function initMain() {
    document.querySelectorAll(".wavesurfer-placeholder").forEach(function (el) {
      setupPlaceholder(el);
    });

    var obs = new MutationObserver(function () {
      document.querySelectorAll(".wavesurfer-placeholder").forEach(function (el) {
        setupPlaceholder(el);
      });
    });

    obs.observe(document.body, { childList: true, subtree: true });
  }

  function showWavesurferErrorOnPlaceholders(text) {
    document.querySelectorAll(".wavesurfer-placeholder").forEach(function (el) {
      setupPlaceholder(el, { forceError: true, errorText: text });
    });
  }

  function setupPlaceholder(el, opts) {
    if (el._playerInitialized) return;
    el._playerInitialized = true;

    var src = el.dataset.src;

    // cleanup old
    if (el._ws) {
      try {
        el._ws.destroy && el._ws.destroy();
      } catch (e) {}
      el._ws = null;
    }

    // --- overlay style ---
    if (!document.getElementById("waves-overlay-style")) {
      var style = document.createElement("style");
      style.id = "waves-overlay-style";
      style.textContent = `
.wavesurfer-wrapper { position: relative; display: block; }

.waves-overlay {
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%,-50%);
  pointer-events: none;

  opacity: 0;
  transition: opacity 160ms ease, transform 160ms ease;
  will-change: opacity, transform;

  z-index: 10;

  width: 220px;
  max-width: 92%;
  border-radius: 12px;

  background: rgba(0,0,0,0.65);
  color: white;
  padding: 12px 14px;
  box-sizing: border-box;

  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
}

.waves-overlay.show {
  opacity: 1;
  transform: translate(-50%,-50%) scale(1.02);
}

.waves-overlay-inner { width: 100%; }
.waves-overlay-row { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
.waves-overlay-text { font-size: 14px; line-height: 1.2; }
.waves-overlay-percent { font-size: 14px; white-space: nowrap; }

.waves-overlay-bar {
  margin-top: 10px;
  width: 100%;
  height: 8px;
  background: rgba(255,255,255,0.25);
  border-radius: 999px;
  overflow: hidden;
}
.waves-overlay-bar > div {
  height: 100%;
  width: 0%;
  background: #fff;
  border-radius: 999px;
  transition: width 120ms linear;
}
`;
      document.head.appendChild(style);
    }

    // ====== FIX: wrapper теперь не фиксированной высоты ======
    var wrapper = document.createElement("div");
    wrapper.className = "wavesurfer-wrapper";
    wrapper.style.height = "auto"; // <- раньше было wrapper.style.height = height;

    var height = "100px";
    if (el.style && el.style.height) height = el.style.height;

    // frame держит высоту волны и служит контейнером для overlay
    var waveFrame = document.createElement("div");
    waveFrame.style.height = height;
    waveFrame.style.position = "relative";

    var containerWave = document.createElement("div");
    containerWave.style.height = height;

    var overlay = document.createElement("div");
    overlay.className = "waves-overlay";

    var overlayInner = document.createElement("div");
    overlayInner.className = "waves-overlay-inner";

    var overlayRow = document.createElement("div");
    overlayRow.className = "waves-overlay-row";

    var overlayText = document.createElement("div");
    overlayText.className = "waves-overlay-text";
    overlayText.textContent = "Загрузка аудио...";

    var overlayPercent = document.createElement("div");
    overlayPercent.className = "waves-overlay-percent";
    overlayPercent.textContent = "0%";

    overlayRow.appendChild(overlayText);
    overlayRow.appendChild(overlayPercent);

    var bar = document.createElement("div");
    bar.className = "waves-overlay-bar";

    var barFill = document.createElement("div");
    bar.appendChild(barFill);

    overlayInner.appendChild(overlayRow);
    overlayInner.appendChild(bar);
    overlay.appendChild(overlayInner);

    waveFrame.appendChild(containerWave);
    waveFrame.appendChild(overlay);

    wrapper.appendChild(waveFrame);

    el.replaceChildren(wrapper);

    function setOverlayVisible(visible) {
      if (visible) overlay.classList.add("show");
      else overlay.classList.remove("show");
    }

    var overlayTimer = null;
    function clearOverlayTimer() {
      if (overlayTimer) clearTimeout(overlayTimer);
      overlayTimer = null;
    }

    function showLoading(percent) {
      clearOverlayTimer();
      setOverlayVisible(true);
      overlayText.textContent = "Загрузка аудио...";
      var p = Math.max(0, Math.min(100, percent || 0));
      overlayPercent.textContent = `${Math.round(p)}%`;
      bar.style.visibility = "visible";
      barFill.style.width = `${p}%`;
    }

    function showPreparing() {
      clearOverlayTimer();
      setOverlayVisible(true);
      overlayText.textContent = "Подготовка...";
      overlayPercent.textContent = "";
      bar.style.visibility = "visible";
      barFill.style.width = `100%`;
    }

    function showReadyBriefly() {
      clearOverlayTimer();
      setOverlayVisible(true);
      overlayText.textContent = "Готово";
      overlayPercent.textContent = "";
      bar.style.visibility = "hidden";
      barFill.style.width = "100%";

      overlayTimer = setTimeout(function () {
        if (backend && typeof backend.isPlaying === "function" && backend.isPlaying()) {
          setOverlayVisible(false);
          return;
        }
        setOverlayVisible(false);
      }, 450);
    }

    function showError(text) {
      clearOverlayTimer();
      setOverlayVisible(true);
      overlayText.textContent = text || "Ошибка загрузки";
      overlayPercent.textContent = "";
      bar.style.visibility = "hidden";
      barFill.style.width = "0%";
    }

    function showStateSymbol(symbol, subtitle, autoHideMs) {
      clearOverlayTimer();
      setOverlayVisible(true);

      overlayText.textContent = subtitle ? `${symbol} ${subtitle}` : symbol;
      overlayPercent.textContent = "";
      bar.style.visibility = "hidden";
      barFill.style.width = "100%";

      if (typeof autoHideMs === "number" && autoHideMs > 0) {
        overlayTimer = setTimeout(function () {
          setOverlayVisible(false);
          overlayTimer = null;
        }, autoHideMs);
      }
    }

    // --- кнопки (модуль) ---
    var buttonsHost = document.createElement("div");
    wrapper.appendChild(buttonsHost);

    var buttons = null;
    function setButtonsEnabled(enabled) {
      if (buttons && typeof buttons.setEnabled === "function") buttons.setEnabled(enabled);
    }

    if (!wavesButtonsModule) {
      setButtonsEnabled(false);
    } else {
      var initFn =
        (typeof wavesButtonsModule.initWavesButtons === "function" && wavesButtonsModule.initWavesButtons) ||
        (typeof wavesButtonsModule === "function" && wavesButtonsModule);

      if (typeof initFn === "function") {
        try {
          buttons = initFn(buttonsHost, containerWave);
          setButtonsEnabled(false);
        } catch (e) {
          buttons = null;
        }
      }
    }

    var backend = null;
    if (opts && opts.forceError) {
      setButtonsEnabled(false);
      showError(opts.errorText || "Ошибка");
      return;
    }

    if (!window.WaveSurfer) {
      setButtonsEnabled(false);
      showError("WaveSurfer недоступен — плеер недоступен");
      return;
    }

    if (!src) {
      setButtonsEnabled(false);
      showError("Нет data-src у плейсхолдера");
      return;
    }

    if (!buttons && wavesButtonsModule) {
      showError("Ошибка инициализации управления");
      setButtonsEnabled(false);
    } else if (!wavesButtonsModule) {
      showError("Управление не доступно");
      setButtonsEnabled(false);
    }

    showLoading(0);

    // Create wavesurfer
    var ws = WaveSurfer.create({
      container: containerWave,
      backend: "WebAudio",
      waveColor: "#757575",
      progressColor: "#FFFFFF",
      height: 100,
      cursorWidth: 3,
      barWidth: 1,
      barGap: 1,
      barHeight: 0.8,
      fillParent: true,
      responsive: true,
    });

    el._ws = ws;

    backend = {
      type: "wavesurfer",
      playPause: function () {
        ws.playPause();
      },
      stop: function () {
        ws.stop();
        ws.seekTo(0);
      },
      seekTo: function (ratio) {
        ws.seekTo(ratio);
      },
      getDuration: function () {
        return ws.getDuration ? ws.getDuration() : 0;
      },
      getCurrentTime: function () {
        return ws.getCurrentTime ? ws.getCurrentTime() : 0;
      },
      setVolume: function (v) {
        ws.setVolume && ws.setVolume(v);
      },
      isPlaying: function () {
        return typeof ws.isPlaying === "function" ? ws.isPlaying() : false;
      },
      destroy: function () {
        try {
          ws.destroy && ws.destroy();
        } catch (e) {}
      },
    };

    if (buttons && typeof buttons.setBackend === "function") {
      buttons.setBackend(backend);
    }

    var waveFailTimeout = setTimeout(function () {
      showError("WaveSurfer не успел подготовиться");
    }, 9000);

    if (ws.on) {
      ws.on("loading", function (percent) {
        showLoading(typeof percent === "number" ? percent : 0);
      });

      ws.on("decode", function () {
        showPreparing();
      });

      ws.on("ready", function () {
        if (waveFailTimeout) {
          clearTimeout(waveFailTimeout);
          waveFailTimeout = null;
        }
        setButtonsEnabled(true);
        showReadyBriefly();
      });

      ws.on("play", function () {
        clearOverlayTimer();
        setOverlayVisible(false);
      });

      ws.on("pause", function () {
        showStateSymbol("⏸", "Пауза. Еноты думают. 🦝");
      });

      ws.on("finish", function () {
        showStateSymbol("⏹", "Завершено", 1200);
      });

      ws.on("error", function () {
        if (waveFailTimeout) {
          clearTimeout(waveFailTimeout);
          waveFailTimeout = null;
        }
        showError("WaveSurfer не смог загрузить аудио");
        setButtonsEnabled(false);
      });
    }

    try {
      ws.load(src);
    } catch (e) {
      showError("WaveSurfer: ошибка при загрузке");
      setButtonsEnabled(false);
    }
  }
};
