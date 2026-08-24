export function initWavesButtons(buttonsHost, containerWave) {
    const doc = buttonsHost.ownerDocument, win = doc.defaultView;
    function btn(text) {
        const button = doc.createElement("button");
        return button.type = "button", button.textContent = text, button.className = "waves-btn",
        button;
    }
    const play = btn("Play/Pause");
    play.classList.add("waves-play-btn");
    const stop = btn("Stop");
    stop.className = "waves-btn waves-stop-btn";
    const back = btn("<<10s");
    back.className = "waves-btn waves-skip-btn";
    const fwd = btn("10s>>");
    fwd.className = "waves-btn waves-skip-btn", play.innerHTML = '\n    <span class="waves-art waves-art-play" aria-hidden="true"></span>\n    <span class="waves-art waves-art-pause" aria-hidden="true"></span>\n    <span class="waves-play-label">Play</span>\n    ';
    const playArt = play.querySelector(".waves-art-play"), pauseArt = play.querySelector(".waves-art-pause"), playLabel = play.querySelector(".waves-play-label");
    playLabel && (playLabel.style.display = "none");
    const vol = doc.createElement("input");
    vol.type = "range", vol.min = "0", vol.max = "1", vol.step = "0.01", vol.value = "1",
    vol.title = "Volume", vol.style.width = "90px", vol.className = "waves-volume";
    const speed = doc.createElement("input");
    speed.type = "range", speed.min = "0.25", speed.max = "2", speed.step = "0.05",
    speed.value = "1", speed.title = "Playback speed", speed.style.width = "100px",
    speed.className = "waves-speed";
    const speedValue = doc.createElement("span");
    speedValue.className = "waves-speed-value", speedValue.textContent = "1×", speedValue.style.minWidth = "35px",
    speedValue.style.display = "inline-block", speedValue.style.textAlign = "center";
    const resetSpeed = btn("1×");
    resetSpeed.className = "waves-btn waves-speed-reset", resetSpeed.title = "Reset playback speed";
    const speedControls = doc.createElement("div");
    speedControls.className = "waves-speed-controls", speedControls.style.display = "flex",
    speedControls.style.alignItems = "center", speedControls.style.gap = "4px", speedControls.append(speed, speedValue, resetSpeed);
    const controls = doc.createElement("div");
    controls.className = "waves-controls", controls.style.display = "flex", controls.style.gap = "8px",
    controls.style.alignItems = "center", controls.style.marginTop = "6px", [ play, stop, back, fwd ].forEach(button => {
        button.disabled = !0;
    }), vol.disabled = !0, speed.disabled = !0, resetSpeed.disabled = !0, controls.append(back, play, stop, fwd, vol, speedControls),
    buttonsHost.appendChild(controls);
    let backend = null, isPlaying = !1, pausedFrameIndex = 0, rafId = null, playStartTs = 0, playBaseTimeMs = 0;
    function readVarsFromPlayButton() {
        const styles = win.getComputedStyle(play);
        return {
            fw: parseFloat(styles.getPropertyValue("--fw")) || 96,
            playFrames: parseInt(styles.getPropertyValue("--playFrames"), 10) || 91,
            playDurationMs: parseFloat(styles.getPropertyValue("--playDurationMs")) || 3e3
        };
    }
    function setPlaybackSpeed(value) {
        const nextSpeed = Math.max(.25, Math.min(2, Number(value) || 1));
        speed.value = String(nextSpeed), speedValue.textContent = function(value) {
            const number = Number(value);
            return 1 === number ? "1×" : `${number.toFixed(2).replace(/0$/, "")}×`;
        }(nextSpeed), backend?.setPlaybackRate?.(nextSpeed);
    }
    function frameDurationMs() {
        const {playFrames: playFrames, playDurationMs: playDurationMs} = readVarsFromPlayButton();
        return playDurationMs / playFrames;
    }
    function getCurrentFrameIndex() {
        const {playFrames: playFrames, playDurationMs: playDurationMs} = readVarsFromPlayButton();
        if (!playFrames || playFrames < 1) return 0;
        const frameDuration = frameDurationMs(), time = isPlaying ? (playBaseTimeMs + (win.performance.now() - playStartTs)) % playDurationMs : pausedFrameIndex * frameDuration, index = Math.floor(time / frameDuration);
        return Math.max(0, Math.min(playFrames - 1, index));
    }
    function setPlayFrame(frameIndex) {
        const {fw: fw} = readVarsFromPlayButton();
        playArt.style.backgroundPosition = -frameIndex * fw + "px 0px";
    }
    function tick() {
        isPlaying && (setPlayFrame(getCurrentFrameIndex()), rafId = win.requestAnimationFrame(tick));
    }
    function updateVisualState() {
        play.classList.toggle("is-playing", isPlaying), pauseArt.style.opacity = isPlaying ? "0" : "1";
    }
    const SPRITE_SRC = new URL("../../icons/play.png", import.meta.url).href;
    let spriteReady = !1, spriteImageData = null;
    const spriteCanvas = doc.createElement("canvas"), spriteCtx = spriteCanvas.getContext("2d", {
        willReadFrequently: !0
    });
    function togglePlay() {
        !isPlaying ? (pauseArt.style.animation = "none", function() {
            isPlaying = !0;
            const {playDurationMs: playDurationMs} = readVarsFromPlayButton(), frameDuration = frameDurationMs();
            playBaseTimeMs = pausedFrameIndex * frameDuration, playBaseTimeMs = (playBaseTimeMs % playDurationMs + playDurationMs) % playDurationMs,
                      playStartTs = win.performance.now(), null !== rafId && win.cancelAnimationFrame(rafId),
                      rafId = win.requestAnimationFrame(tick);
        }()) : (pausedFrameIndex = getCurrentFrameIndex(), isPlaying = !1, null !== rafId && win.cancelAnimationFrame(rafId),
                rafId = null, setPlayFrame(pausedFrameIndex), pauseArt.style.animation = "none",
                pauseArt.offsetHeight, pauseArt.style.animation = ""), updateVisualState(), backend?.playPause && backend.playPause();
    }
    function togglePlayFromEvent(event) {
        event.stopPropagation(), function(event) {
            if (!playArt) return !1;
            const rect = playArt.getBoundingClientRect();
            if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) return !1;
            if (!spriteReady || !spriteImageData) return !0;
            const {playFrames: playFrames} = readVarsFromPlayButton();
            if (!playFrames || playFrames < 1) return !0;
            const frameIndex = getCurrentFrameIndex(), naturalW = spriteCanvas.width, naturalH = spriteCanvas.height, naturalFrameW = naturalW / playFrames, localX = event.clientX - rect.left, localY = event.clientY - rect.top;
            if (rect.width <= 0 || rect.height <= 0) return !1;
            let sx = Math.floor(localX / rect.width * naturalFrameW) + Math.floor(frameIndex * naturalFrameW), sy = Math.floor(localY / rect.height * naturalH);
            return sx = Math.max(0, Math.min(naturalW - 1, sx)), sy = Math.max(0, Math.min(naturalH - 1, sy)),
            spriteImageData.data[4 * (sy * naturalW + sx) + 3] > 8;
        }(event) && togglePlay();
    }
    function seekBy(seconds) {
        if (!backend) return;
        const duration = backend.getDuration?.() || 0;
        if (!duration) return;
        const currentTime = backend.getCurrentTime?.() || 0, nextTime = Math.max(0, Math.min(duration, currentTime + seconds));
        backend.seekTo?.(nextTime / duration);
    }
    function changeVolumeBy(value) {
        const currentVolume = Number.parseFloat(vol.value) || 0, nextVolume = Math.max(0, Math.min(1, currentVolume + value));
        vol.value = nextVolume.toFixed(2), backend?.setVolume?.(nextVolume);
    }
    function handleKeyDown(event) {
        const isSpace = "Space" === event.code || " " === event.key, isArrowLeft = "ArrowLeft" === event.code || "ArrowLeft" === event.key, isArrowRight = "ArrowRight" === event.code || "ArrowRight" === event.key, isArrowUp = "ArrowUp" === event.code || "ArrowUp" === event.key, isArrowDown = "ArrowDown" === event.code || "ArrowDown" === event.key;
        if (!(target = event.target) || !(target instanceof win.HTMLTextAreaElement || target instanceof win.HTMLSelectElement || target instanceof win.HTMLInputElement && "button" !== target.type || !0 === target.isContentEditable)) {
            var target;
            if (isSpace) {
                if (event.repeat) return;
                return event.preventDefault(), event.stopPropagation(), void togglePlay();
            }
            return isArrowLeft ? (event.preventDefault(), event.stopPropagation(), void seekBy(-5)) : isArrowRight ? (event.preventDefault(),
                                                                                                                      event.stopPropagation(), void seekBy(5)) : isArrowUp ? (event.preventDefault(),
                                                                                                                                                                              event.stopPropagation(), void changeVolumeBy(.05)) : void (isArrowDown && (event.preventDefault(),
                                                                                                                                                                                                                                                         event.stopPropagation(), changeVolumeBy(-.05)));
        }
    }
    return play.addEventListener("click", togglePlayFromEvent), doc.addEventListener("keydown", handleKeyDown),
    stop.addEventListener("click", () => {
        pausedFrameIndex = 0, isPlaying = !1, null !== rafId && win.cancelAnimationFrame(rafId),
                          rafId = null, setPlayFrame(0), updateVisualState(), backend?.stop && backend.stop();
    }), back.addEventListener("click", () => {
        seekBy(-10);
    }), fwd.addEventListener("click", () => {
        seekBy(10);
    }), vol.addEventListener("input", () => {
        backend?.setVolume?.(Number.parseFloat(vol.value));
    }), speed.addEventListener("input", () => {
        setPlaybackSpeed(speed.value);
    }), resetSpeed.addEventListener("click", () => {
        setPlaybackSpeed(1);
    }), containerWave && containerWave.addEventListener("click", event => {
        event.target.closest?.(".waves-controls") || togglePlayFromEvent(event);
    }), pausedFrameIndex = 0, isPlaying = !1, setPlayFrame(0), updateVisualState(),
    setPlaybackSpeed(1), spriteReady ? Promise.resolve(!0) : new Promise(resolve => {
        const image = new win.Image;
        image.decoding = "async", image.onload = () => {
            spriteCanvas.width = image.naturalWidth, spriteCanvas.height = image.naturalHeight,
            spriteCtx.clearRect(0, 0, spriteCanvas.width, spriteCanvas.height), spriteCtx.drawImage(image, 0, 0),
                                                                         spriteImageData = spriteCtx.getImageData(0, 0, spriteCanvas.width, spriteCanvas.height),
                                                                         spriteReady = !0, resolve(!0);
        }, image.onerror = () => {
            spriteReady = !1, spriteImageData = null, resolve(!1);
        }, image.src = SPRITE_SRC;
    }), {
        setBackend: function(value) {
            backend = value, backend?.setPlaybackRate?.(Number.parseFloat(speed.value)), backend?.setVolume?.(Number.parseFloat(vol.value));
        },
        setEnabled: function(enabled) {
            [ play, stop, back, fwd, resetSpeed ].forEach(button => {
                button.disabled = !enabled;
            }), vol.disabled = !enabled, speed.disabled = !enabled;
        },
        controls: controls,
        play: play,
        stop: stop,
        back: back,
        fwd: fwd,
        vol: vol,
        speed: speed,
        speedValue: speedValue,
        resetSpeed: resetSpeed,
        destroy() {
            doc.removeEventListener("keydown", handleKeyDown), null !== rafId && (win.cancelAnimationFrame(rafId),
                                                                                  rafId = null), controls.remove();
        }
    };
}
