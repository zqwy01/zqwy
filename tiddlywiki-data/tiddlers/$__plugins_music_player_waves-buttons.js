// waves-buttons.js
exports.initWavesButtons = function initWavesButtons(buttonsHost, containerWave) {
  function btn(text) {
    var b = document.createElement("button");
    b.type = "button";
    b.textContent = text;
    b.className = "waves-btn";
    return b;
  }

  var play = btn("Play/Pause");
  play.classList.add("waves-play-btn");

  var stop = btn("Stop");
  stop.className = "waves-btn waves-stop-btn";

  var back = btn("<<10s");
  back.className = "waves-btn waves-skip-btn";

  var fwd = btn("10s>>");
  fwd.className = "waves-btn waves-skip-btn";

  play.innerHTML = `
    <span class="waves-art waves-art-play" aria-hidden="true"></span>
    <span class="waves-art waves-art-pause" aria-hidden="true"></span>
    <span class="waves-play-label">Play</span>
  `;

  var playArt = play.querySelector(".waves-art-play");
  var pauseArt = play.querySelector(".waves-art-pause");
  var playLabel = play.querySelector(".waves-play-label");

  if (playLabel) playLabel.style.display = "none";

  var vol = document.createElement("input");
  vol.type = "range";
  vol.min = 0;
  vol.max = 1;
  vol.step = 0.01;
  vol.value = 1;
  vol.title = "Volume";
  vol.style.width = "90px";
  vol.className = "waves-volume";

  var controls = document.createElement("div");
  controls.className = "waves-controls";
  controls.style.display = "flex";
  controls.style.gap = "8px";
  controls.style.alignItems = "center";
  controls.style.marginTop = "6px";

  [play, stop, back, fwd].forEach((b) => (b.disabled = true));

  controls.appendChild(back);
  controls.appendChild(play);
  controls.appendChild(stop);
  controls.appendChild(fwd);
  controls.appendChild(vol);

  buttonsHost.appendChild(controls);

  let backend = null;
  let isPlaying = false;

  let pausedFrameIndex = 0;

  // WAAPI не используем: делаем дискретные кадры шагом через requestAnimationFrame
  let rafId = null;
  let playStartTs = 0; // performance.now() на момент старта
  let playBaseTimeMs = 0; // базовое время внутри цикла (в ms) на resume

  function readVarsFromPlayButton() {
    var cs = getComputedStyle(play);
    var fw = parseFloat(cs.getPropertyValue("--fw")) || 96;
    var playFrames = parseInt(cs.getPropertyValue("--playFrames"), 10) || 91;
    var playDurationMs = parseFloat(cs.getPropertyValue("--playDurationMs")) || 3000;
    return { fw, playFrames, playDurationMs };
  }

  function setBackend(b) {
    backend = b;
  }

  function setEnabled(enabled) {
    [play, stop, back, fwd].forEach((b) => (b.disabled = !enabled));
  }

  function frameDurationMs() {
    const { playFrames, playDurationMs } = readVarsFromPlayButton();
    return playDurationMs / playFrames;
  }

  function getCurrentFrameIndex() {
    const { playFrames, playDurationMs } = readVarsFromPlayButton();
    if (!playFrames || playFrames < 1) return 0;

    const t = isPlaying
      ? (playBaseTimeMs + (performance.now() - playStartTs)) % playDurationMs
      : pausedFrameIndex * frameDurationMs();

    const idx = Math.floor(t / frameDurationMs());
    return Math.max(0, Math.min(playFrames - 1, idx));
  }

  function setPlayFrame(frameIndex) {
    const { fw } = readVarsFromPlayButton();
    // CSS background-position ожидает координаты в CSS-пикселях
    playArt.style.backgroundPosition = `${-1 * frameIndex * fw}px 0px`;
  }

  function tick() {
    if (!isPlaying) return;
    const idx = getCurrentFrameIndex();
    setPlayFrame(idx);
    rafId = requestAnimationFrame(tick);
  }

  function freezePlayArtAtCurrentFrame() {
    // важно: вызываем, когда isPlaying ещё true
    pausedFrameIndex = getCurrentFrameIndex();
    isPlaying = false;

    if (rafId) cancelAnimationFrame(rafId);
    rafId = null;

    setPlayFrame(pausedFrameIndex);
  }

  function resumePlayArtFromPausedFrame() {
    isPlaying = true;

    const { playDurationMs } = readVarsFromPlayButton();
    const fd = frameDurationMs();

    playBaseTimeMs = pausedFrameIndex * fd;
    playBaseTimeMs = ((playBaseTimeMs % playDurationMs) + playDurationMs) % playDurationMs;

    playStartTs = performance.now();

    if (rafId) cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(tick);
  }

  function updateVisualState() {
    play.classList.toggle("is-playing", isPlaying);
    pauseArt.style.opacity = isPlaying ? "0" : "1";
  }

  // ==== Pixel hit-test строго по PNG (без canvas-рендера) ====
  const SPRITE_SRC = "/buttons/play.png";

  let spriteReady = false;
  let spriteImageData = null; // ImageData из исходника
  let spriteCanvas = document.createElement("canvas");
  let spriteCtx = spriteCanvas.getContext("2d", { willReadFrequently: true });

  function ensureSpriteReady() {
    if (spriteReady) return Promise.resolve(true);

    return new Promise((resolve) => {
      const img = new Image();
      img.decoding = "async";
      img.onload = () => {
        spriteCanvas.width = img.naturalWidth;
        spriteCanvas.height = img.naturalHeight;
        spriteCtx.clearRect(0, 0, spriteCanvas.width, spriteCanvas.height);
        spriteCtx.drawImage(img, 0, 0);

        spriteImageData = spriteCtx.getImageData(0, 0, spriteCanvas.width, spriteCanvas.height);
        spriteReady = true;
        resolve(true);
      };
      img.onerror = () => {
        spriteReady = false;
        spriteImageData = null;
        resolve(false);
      };
      img.src = SPRITE_SRC;
    });
  }

  function isClickOnPlaySpritePixel(e) {
    if (!playArt) return false;

    const rect = playArt.getBoundingClientRect();

    // строго внутри прямоугольника арт-области
    if (
      e.clientX < rect.left ||
      e.clientX > rect.right ||
      e.clientY < rect.top ||
      e.clientY > rect.bottom
    ) {
      return false;
    }

    // если PNG ещё не готов — пусть клики работают (не делаем хит-тест)
    if (!spriteReady || !spriteImageData) return true;

    const { playFrames } = readVarsFromPlayButton();
    if (!playFrames || playFrames < 1) return true;

    const frameIndex = getCurrentFrameIndex();

    const naturalW = spriteCanvas.width;
    const naturalH = spriteCanvas.height;
    const naturalFrameW = naturalW / playFrames;
    if (!naturalFrameW || naturalFrameW <= 0) return true;

    const localX = e.clientX - rect.left;
    const localY = e.clientY - rect.top;

    if (rect.width <= 0 || rect.height <= 0) return false;

    // маппим кликовые координаты в пиксели исходника
    let sx =
      Math.floor((localX / rect.width) * naturalFrameW) +
      Math.floor(frameIndex * naturalFrameW);
    let sy = Math.floor((localY / rect.height) * naturalH);

    // clamp на всякий случай
    sx = Math.max(0, Math.min(naturalW - 1, sx));
    sy = Math.max(0, Math.min(naturalH - 1, sy));

    const alpha = spriteImageData.data[(sy * naturalW + sx) * 4 + 3];
    return alpha > 8; // порог от антиалиаса
  }

  function togglePlayFromEvent(e) {
    e.stopPropagation();

    // строгий pixel-hit-test
    if (!isClickOnPlaySpritePixel(e)) return;

    const nextPlaying = !isPlaying;

    if (!nextPlaying) {
      // PAUSE
      freezePlayArtAtCurrentFrame();

      pauseArt.style.animation = "none";
      pauseArt.offsetHeight; // reflow
      pauseArt.style.animation = "";
    } else {
      // PLAY
      pauseArt.style.animation = "none";
      resumePlayArtFromPausedFrame();
    }

    updateVisualState();
    backend && backend.playPause && backend.playPause();
  }

  // ==== EVENTS ====
  play.addEventListener("click", function (e) {
    togglePlayFromEvent(e);
  });

  stop.addEventListener("click", function () {
    pausedFrameIndex = 0;

    if (rafId) cancelAnimationFrame(rafId);
    rafId = null;

    isPlaying = false;
    setPlayFrame(0);

    pauseArt.style.animation = "none";
    pauseArt.offsetHeight;
    pauseArt.style.animation = "";

    updateVisualState();
    backend && backend.stop && backend.stop();
  });

  back.addEventListener("click", function () {
    if (!backend) return;
    var d = backend.getDuration ? backend.getDuration() : 0;
    if (!d) return;
    var t = (backend.getCurrentTime() - 10) / d;
    backend.seekTo && backend.seekTo(Math.max(0, t));
  });

  fwd.addEventListener("click", function () {
    if (!backend) return;
    var d = backend.getDuration ? backend.getDuration() : 0;
    if (!d) return;
    var t = (backend.getCurrentTime() + 10) / d;
    backend.seekTo && backend.seekTo(Math.min(1, t));
  });

  vol.addEventListener("input", function () {
    backend && backend.setVolume && backend.setVolume(parseFloat(vol.value));
  });

  if (containerWave) {
    containerWave.addEventListener("click", function (e) {
      // чтобы не было двойного срабатывания (конвейер/скачки)
      if (e.target && e.target.closest && e.target.closest(".waves-controls")) return;

      // toggle только если клик реально попал в пиксель спрайта
      togglePlayFromEvent(e);
    });
  }

  // инициализация
  pausedFrameIndex = 0;
  isPlaying = false;
  setPlayFrame(0);
  updateVisualState();

  ensureSpriteReady();

  return {
    setBackend,
    setEnabled,
    controls,
    play,
    stop,
    back,
    fwd,
    vol,
  };
};
