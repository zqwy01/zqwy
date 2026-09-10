export function initWavesButtons(buttonsHost, containerWave) {
    const doc = buttonsHost.ownerDocument;
    const win = doc.defaultView;

    function btn(text) {
        const button = doc.createElement("button");

        button.type = "button";
        button.textContent = text;
        button.className = "waves-btn";

        return button;
    }

    const play = btn("Play/Pause");
    play.classList.add("waves-play-btn");

    const stop = btn("Stop");
    stop.className = "waves-btn waves-stop-btn";

    const back = btn("<<10s");
    back.className = "waves-btn waves-skip-btn";

    const fwd = btn("10s>>");
    fwd.className = "waves-btn waves-skip-btn";

    play.innerHTML = `
    <span class="waves-art waves-art-play" aria-hidden="true"></span>
    <span class="waves-art waves-art-pause" aria-hidden="true"></span>
    <span class="waves-play-label">Play</span>
    `;

    const playArt = play.querySelector(".waves-art-play");
    const pauseArt = play.querySelector(".waves-art-pause");
    const playLabel = play.querySelector(".waves-play-label");

    if (playLabel) {
        playLabel.style.display = "none";
    }

    /*
     * Громкость
     */
    const vol = doc.createElement("input");

    vol.type = "range";
    vol.min = "0";
    vol.max = "1";
    vol.step = "0.01";
    vol.value = "1";
    vol.title = "Volume";
    vol.style.width = "90px";
    vol.className = "waves-volume";

    /*
     * Скорость воспроизведения
     */
    const speed = doc.createElement("input");

    speed.type = "range";
    speed.min = "0.25";
    speed.max = "2";
    speed.step = "0.05";
    speed.value = "1";
    speed.title = "Playback speed";
    speed.style.width = "100px";
    speed.className = "waves-speed";

    const speedValue = doc.createElement("span");

    speedValue.className = "waves-speed-value";
    speedValue.textContent = "1×";
    speedValue.style.minWidth = "35px";
    speedValue.style.display = "inline-block";
    speedValue.style.textAlign = "center";

    const resetSpeed = btn("1×");

    resetSpeed.className =
    "waves-btn waves-speed-reset";

    resetSpeed.title =
    "Reset playback speed";

    const speedControls = doc.createElement("div");

    speedControls.className =
    "waves-speed-controls";

    speedControls.style.display =
    "flex";

    speedControls.style.alignItems =
    "center";

    speedControls.style.gap =
    "4px";

    speedControls.append(
        speed,
        speedValue,
        resetSpeed
    );

    /*
     * Общий контейнер кнопок
     */
    const controls = doc.createElement("div");

    controls.className = "waves-controls";
    controls.style.display = "flex";
    controls.style.gap = "8px";
    controls.style.alignItems = "center";
    controls.style.marginTop = "6px";

    [play, stop, back, fwd].forEach(button => {
        button.disabled = true;
    });

    vol.disabled = true;
    speed.disabled = true;
    resetSpeed.disabled = true;

    controls.append(
        back,
        play,
        stop,
        fwd,
        vol,
        speedControls
    );

    buttonsHost.appendChild(controls);

    let backend = null;
    let isPlaying = false;
    let pausedFrameIndex = 0;

    let rafId = null;
    let playStartTs = 0;
    let playBaseTimeMs = 0;

    /*
     * Получение настроек анимации кнопки Play
     */
    function readVarsFromPlayButton() {
        const styles = win.getComputedStyle(play);

        const fw =
        parseFloat(
            styles.getPropertyValue("--fw")
        ) || 96;

        const playFrames =
        parseInt(
            styles.getPropertyValue("--playFrames"),
                 10
        ) || 91;

        const playDurationMs =
        parseFloat(
            styles.getPropertyValue(
                "--playDurationMs"
            )
        ) || 3000;

        return {
            fw,
            playFrames,
            playDurationMs
        };
    }

    /*
     * Подключение WaveSurfer
     */
    function setBackend(value) {
        backend = value;

        /*
         * После подключения WaveSurfer сразу
         * применяем выбранную скорость
         */
        backend?.setPlaybackRate?.(
            Number.parseFloat(speed.value)
        );

        backend?.setVolume?.(
            Number.parseFloat(vol.value)
        );
    }

    /*
     * Включение или отключение контролов
     */
    function setEnabled(enabled) {
        [play, stop, back, fwd, resetSpeed]
        .forEach(button => {
            button.disabled = !enabled;
        });

        vol.disabled = !enabled;
        speed.disabled = !enabled;
    }

    /*
     * Изменение скорости воспроизведения
     */
    function formatSpeed(value) {
        const number = Number(value);

        if (number === 1) {
            return "1×";
        }

        return `${number.toFixed(2).replace(/0$/, "")}×`;
    }

    function setPlaybackSpeed(value) {
        const nextSpeed = Math.max(
            0.25,
            Math.min(2, Number(value) || 1)
        );

        speed.value = String(nextSpeed);

        speedValue.textContent =
        formatSpeed(nextSpeed);

        /*
         * Главный вызов WaveSurfer
         */
        backend?.setPlaybackRate?.(nextSpeed);
    }

    /*
     * Длительность одного кадра анимации
     */
    function frameDurationMs() {
        const {
            playFrames,
            playDurationMs
        } = readVarsFromPlayButton();

        return playDurationMs / playFrames;
    }

    /*
     * Текущий кадр анимации
     */
    function getCurrentFrameIndex() {
        const {
            playFrames,
            playDurationMs
        } = readVarsFromPlayButton();

        if (!playFrames || playFrames < 1) {
            return 0;
        }

        const frameDuration =
        frameDurationMs();

        const time = isPlaying
        ? (
            playBaseTimeMs +
            (
                win.performance.now() -
                playStartTs
            )
        ) % playDurationMs
        : pausedFrameIndex * frameDuration;

        const index = Math.floor(
            time / frameDuration
        );

        return Math.max(
            0,
            Math.min(playFrames - 1, index)
        );
    }

    /*
     * Установка кадра спрайта Play
     */
    function setPlayFrame(frameIndex) {
        const { fw } =
        readVarsFromPlayButton();

        playArt.style.backgroundPosition =
        `${-frameIndex * fw}px 0px`;
    }

    /*
     * Обновление анимации спрайта
     */
    function tick() {
        if (!isPlaying) {
            return;
        }

        setPlayFrame(
            getCurrentFrameIndex()
        );

        rafId =
        win.requestAnimationFrame(tick);
    }

    /*
     * Остановка анимации на текущем кадре
     */
    function freezePlayArtAtCurrentFrame() {
        pausedFrameIndex =
        getCurrentFrameIndex();

        isPlaying = false;

        if (rafId !== null) {
            win.cancelAnimationFrame(rafId);
        }

        rafId = null;

        setPlayFrame(
            pausedFrameIndex
        );
    }

    /*
     * Продолжение анимации с сохранённого кадра
     */
    function resumePlayArtFromPausedFrame() {
        isPlaying = true;

        const {
            playDurationMs
        } = readVarsFromPlayButton();

        const frameDuration =
        frameDurationMs();

        playBaseTimeMs =
        pausedFrameIndex * frameDuration;

        playBaseTimeMs =
        (
            playBaseTimeMs % playDurationMs +
            playDurationMs
        ) % playDurationMs;

        playStartTs =
        win.performance.now();

        if (rafId !== null) {
            win.cancelAnimationFrame(rafId);
        }

        rafId =
        win.requestAnimationFrame(tick);
    }

    /*
     * Обновление внешнего вида кнопки
     */
    function updateVisualState() {
        play.classList.toggle(
            "is-playing",
            isPlaying
        );

        pauseArt.style.opacity =
        isPlaying ? "0" : "1";
    }

    /*
     * Проверка прозрачности пикселя PNG
     */
    const SPRITE_SRC = new URL(
        "../../icons/play.png",
        import.meta.url
    ).href;

    let spriteReady = false;
    let spriteImageData = null;

    const spriteCanvas =
    doc.createElement("canvas");

    const spriteCtx =
    spriteCanvas.getContext(
        "2d",
        {
            willReadFrequently: true
        }
    );

    function ensureSpriteReady() {
        if (spriteReady) {
            return Promise.resolve(true);
        }

        return new Promise(resolve => {
            const image = new win.Image();

            image.decoding = "async";

            image.onload = () => {
                spriteCanvas.width =
                image.naturalWidth;

                spriteCanvas.height =
                image.naturalHeight;

                spriteCtx.clearRect(
                    0,
                    0,
                    spriteCanvas.width,
                    spriteCanvas.height
                );

                spriteCtx.drawImage(
                    image,
                    0,
                    0
                );

                spriteImageData =
                spriteCtx.getImageData(
                    0,
                    0,
                    spriteCanvas.width,
                    spriteCanvas.height
                );

                spriteReady = true;

                resolve(true);
            };

            image.onerror = () => {
                spriteReady = false;
                spriteImageData = null;

                resolve(false);
            };

            image.src = SPRITE_SRC;
        });
    }

    function isClickOnPlaySpritePixel(event) {
        if (!playArt) {
            return false;
        }

        const rect =
        playArt.getBoundingClientRect();

        if (
            event.clientX < rect.left ||
            event.clientX > rect.right ||
            event.clientY < rect.top ||
            event.clientY > rect.bottom
        ) {
            return false;
        }

        if (
            !spriteReady ||
            !spriteImageData
        ) {
            return true;
        }

        const {
            playFrames
        } = readVarsFromPlayButton();

        if (!playFrames || playFrames < 1) {
            return true;
        }

        const frameIndex =
        getCurrentFrameIndex();

        const naturalW =
        spriteCanvas.width;

        const naturalH =
        spriteCanvas.height;

        const naturalFrameW =
        naturalW / playFrames;

        const localX =
        event.clientX - rect.left;

        const localY =
        event.clientY - rect.top;

        if (
            rect.width <= 0 ||
            rect.height <= 0
        ) {
            return false;
        }

        let sx =
        Math.floor(
            (localX / rect.width) *
            naturalFrameW
        ) +
        Math.floor(
            frameIndex * naturalFrameW
        );

        let sy =
        Math.floor(
            (localY / rect.height) *
            naturalH
        );

        sx = Math.max(
            0,
            Math.min(naturalW - 1, sx)
        );

        sy = Math.max(
            0,
            Math.min(naturalH - 1, sy)
        );

        const alpha =
        spriteImageData.data[
            (sy * naturalW + sx) * 4 + 3
        ];

        return alpha > 8;
    }

    /*
     * Play/Pause
     */
    function togglePlay() {
        const nextPlaying =
        !isPlaying;

        if (nextPlaying) {
            pauseArt.style.animation =
            "none";

        resumePlayArtFromPausedFrame();
        } else {
            freezePlayArtAtCurrentFrame();

            pauseArt.style.animation =
            "none";

        /*
         * Принудительно перезапускаем анимацию
         */
        pauseArt.offsetHeight;

        pauseArt.style.animation =
        "";
        }

        updateVisualState();

        if (backend?.playPause) {
            backend.playPause();
        }
    }

    function togglePlayFromEvent(event) {
        event.stopPropagation();

        if (
            !isClickOnPlaySpritePixel(event)
        ) {
            return;
        }

        togglePlay();
    }

    /*
     * Перемотка
     */
    function seekBy(seconds) {
        if (!backend) {
            return;
        }

        const duration =
        backend.getDuration?.() || 0;

        if (!duration) {
            return;
        }

        const currentTime =
        backend.getCurrentTime?.() || 0;

        const nextTime =
        Math.max(
            0,
            Math.min(
                duration,
                currentTime + seconds
            )
        );

        backend.seekTo?.(
            nextTime / duration
        );
    }

    /*
     * Изменение громкости с клавиатуры
     */
    function changeVolumeBy(value) {
        const currentVolume =
        Number.parseFloat(vol.value) || 0;

        const nextVolume =
        Math.max(
            0,
            Math.min(
                1,
                currentVolume + value
            )
        );

        vol.value =
        nextVolume.toFixed(2);

        backend?.setVolume?.(
            nextVolume
        );
    }

    /*
     * Проверка, что фокус находится
     * в поле ввода
     */
    function isEditableTarget(target) {
        if (!target) {
            return false;
        }

        if (
            target instanceof
            win.HTMLTextAreaElement ||

            target instanceof
            win.HTMLSelectElement
        ) {
            return true;
        }

        if (
            target instanceof
            win.HTMLInputElement &&
            target.type !== "button"
        ) {
            return true;
        }

        return target.isContentEditable === true;
    }

    /*
     * Управление с клавиатуры
     */
    function handleKeyDown(event) {
        const isSpace =
        event.code === "Space" ||
        event.key === " ";

        const isArrowLeft =
        event.code === "ArrowLeft" ||
        event.key === "ArrowLeft";

        const isArrowRight =
        event.code === "ArrowRight" ||
        event.key === "ArrowRight";

        const isArrowUp =
        event.code === "ArrowUp" ||
        event.key === "ArrowUp";

        const isArrowDown =
        event.code === "ArrowDown" ||
        event.key === "ArrowDown";

        if (
            isEditableTarget(event.target)
        ) {
            return;
        }

        if (isSpace) {
            if (event.repeat) {
                return;
            }

            event.preventDefault();
            event.stopPropagation();

            togglePlay();

            return;
        }

        if (isArrowLeft) {
            event.preventDefault();
            event.stopPropagation();

            seekBy(-5);

            return;
        }

        if (isArrowRight) {
            event.preventDefault();
            event.stopPropagation();

            seekBy(5);

            return;
        }

        if (isArrowUp) {
            event.preventDefault();
            event.stopPropagation();

            changeVolumeBy(0.05);

            return;
        }

        if (isArrowDown) {
            event.preventDefault();
            event.stopPropagation();

            changeVolumeBy(-0.05);
        }
    }

    /*
     * Обработчики кнопок
     */
    play.addEventListener(
        "click",
        togglePlayFromEvent
    );

    doc.addEventListener(
        "keydown",
        handleKeyDown
    );

    stop.addEventListener(
        "click",
        () => {
            pausedFrameIndex = 0;
            isPlaying = false;

            if (rafId !== null) {
                win.cancelAnimationFrame(rafId);
            }

            rafId = null;

            setPlayFrame(0);
            updateVisualState();

            if (backend?.stop) {
                backend.stop();
            }
        }
    );

    back.addEventListener(
        "click",
        () => {
            seekBy(-10);
        }
    );

    fwd.addEventListener(
        "click",
        () => {
            seekBy(10);
        }
    );

    /*
     * Громкость
     */
    vol.addEventListener(
        "input",
        () => {
            backend?.setVolume?.(
                Number.parseFloat(vol.value)
            );
        }
    );

    /*
     * Скорость воспроизведения
     */
    speed.addEventListener(
        "input",
        () => {
            setPlaybackSpeed(
                speed.value
            );
        }
    );

    resetSpeed.addEventListener(
        "click",
        () => {
            setPlaybackSpeed(1);
        }
    );

    /*
     * Клик по waveform
     */
    if (containerWave) {
        containerWave.addEventListener(
            "click",
            event => {
                if (
                    event.target.closest?.(
                        ".waves-controls"
                    )
                ) {
                    return;
                }

                togglePlayFromEvent(event);
            }
        );
    }

    /*
     * Начальное состояние
     */
    pausedFrameIndex = 0;
    isPlaying = false;

    setPlayFrame(0);
    updateVisualState();
    setPlaybackSpeed(1);

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

        speed,
        speedValue,
        resetSpeed,

        destroy() {
            doc.removeEventListener(
                "keydown",
                handleKeyDown
            );

            if (rafId !== null) {
                win.cancelAnimationFrame(
                    rafId
                );

                rafId = null;
            }

            controls.remove();
        }
    };
}
