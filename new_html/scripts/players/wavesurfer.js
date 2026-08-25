import * as wavesButtonsModule from "./waves-buttons.js";

const URLS = {
    ws: "/new_html/scripts/players/wavesurfer/wavesurfer.min.js",
    hover: "/new_html/scripts/players/wavesurfer/hover.min.js",
    timeline: "/new_html/scripts/players/wavesurfer/timeline.min.js"
};

const promises = {};

function loadScript(url, getValue) {
    const value = getValue();

    if (value) return Promise.resolve(value);
    if (promises[url]) return promises[url];

    promises[url] = new Promise((resolve, reject) => {
        const fail = () => reject(new Error(`Script load failed: ${url}`));
        const check = () => {
            const result = getValue();
            result
            ? resolve(result)
            : reject(new Error(`Module is not available: ${url}`));
        };

        let script = document.querySelector(`script[src="${url}"]`);

        if (script) {
            script.addEventListener("load", check);
            script.addEventListener("error", fail);
            return;
        }

        script = document.createElement("script");
        script.src = url;
        script.async = true;
        script.onload = check;
        script.onerror = fail;
        document.head.appendChild(script);
    });

    return promises[url];
}

const loadWaveSurfer = () =>
loadScript(URLS.ws, () => window.WaveSurfer);

const loadWaveSurferHover = () =>
loadScript(URLS.hover, () => window.WaveSurfer?.Hover);

const loadWaveSurferTimeline = () =>
loadScript(URLS.timeline, () => window.WaveSurfer?.Timeline);

function addStyles() {
    if (document.getElementById("wavesurfer-player-styles")) return;

    const style = document.createElement("style");

    style.id = "wavesurfer-player-styles";
    style.textContent = `
    .wavesurfer-wrapper{position:relative;display:block;width:100%}
    .wavesurfer-frame{position:relative;width:100%;height:100px}
    .wavesurfer-wave{width:100%;height:100px;cursor:grab;user-select:none;-webkit-user-select:none;touch-action:none}
    .wavesurfer-wave:active{cursor:grabbing}
    .wavesurfer-timeline{width:100%;min-height:28px;margin-top:4px;overflow:hidden}
    .wavesurfer-timeline canvas{display:block;width:100%}
    .waves-overlay{position:absolute;left:50%;top:50%;z-index:10;width:220px;max-width:92%;padding:12px 14px;box-sizing:border-box;border-radius:12px;background:rgba(0,0,0,.65);color:#fff;text-align:center;opacity:0;pointer-events:none;transform:translate(-50%,-50%);transition:opacity 160ms ease,transform 160ms ease}
    .waves-overlay.show{opacity:1;transform:translate(-50%,-50%) scale(1.02)}
    .waves-overlay-row{display:flex;align-items:center;justify-content:space-between;gap:10px}
    .waves-overlay-text,.waves-overlay-percent{font-size:44px;line-height:.6}
    .waves-overlay-percent{white-space:nowrap}
    .waves-overlay-bar{width:100%;height:8px;margin-top:10px;overflow:hidden;border-radius:999px;background:rgba(255,255,255,.25)}
    .waves-overlay-bar-fill{width:0;height:100%;border-radius:999px;background:#fff;transition:width 120ms linear}
    .wavesurfer-message{margin-top:8px;color:#b00020}
    `;

    document.head.appendChild(style);
}

function createOverlay(doc) {
    const overlay = doc.createElement("div");
    overlay.className = "waves-overlay";

    const row = doc.createElement("div");
    row.className = "waves-overlay-row";

    const text = doc.createElement("div");
    text.className = "waves-overlay-text";

    const percent = doc.createElement("div");
    percent.className = "waves-overlay-percent";

    const bar = doc.createElement("div");
    bar.className = "waves-overlay-bar";

    const fill = doc.createElement("div");
    fill.className = "waves-overlay-bar-fill";

    row.append(text, percent);
    bar.appendChild(fill);
    overlay.append(row, bar);

    return { element: overlay, text, percent, bar, fill };
}

function showOverlay(overlay, text, percent = "") {
    overlay.element.classList.add("show");
    overlay.text.textContent = text;
    overlay.percent.textContent = percent;
    overlay.bar.style.visibility = percent ? "visible" : "hidden";

    if (percent) overlay.fill.style.width = `${percent}%`;
}

function hideOverlay(overlay) {
    overlay.element.classList.remove("show");
}

const wavesurferPlayer = {
    label: "WaveSurfer",

    isAvailable() {
        return typeof window !== "undefined" &&
        typeof document !== "undefined";
    },

    async render({ container, src }) {
        addStyles();

        const doc = container.ownerDocument;
        const oldInstance = container._waveSurferInstance;

        if (oldInstance) {
            try {
                oldInstance.destroy();
            } catch (error) {
                console.warn("Unable to destroy WaveSurfer:", error);
            }

            container._waveSurferInstance = null;
        }

        container.replaceChildren();

        const wrapper = doc.createElement("div");
        wrapper.className = "wavesurfer-wrapper";

        const frame = doc.createElement("div");
        frame.className = "wavesurfer-frame";

        const waveContainer = doc.createElement("div");
        waveContainer.className = "wavesurfer-wave";

        const timelineContainer = doc.createElement("div");
        timelineContainer.className = "wavesurfer-timeline";

        const overlay = createOverlay(doc);

        const buttonsHost = doc.createElement("div");
        buttonsHost.className = "wavesurfer-buttons";

        const message = doc.createElement("div");
        message.className = "wavesurfer-message";

        frame.append(waveContainer, overlay.element);
        wrapper.append(frame, timelineContainer, buttonsHost, message);
        container.appendChild(wrapper);

        const showError = text => {
            showOverlay(overlay, text);
            message.textContent = "";
        };

        if (!src) {
            showError("Нет источника аудио");
            return;
        }

        let WaveSurfer;
        let Hover;
        let Timeline;

        try {
            [WaveSurfer, Hover, Timeline] = await Promise.all([
                loadWaveSurfer(),
                loadWaveSurferHover(),
                loadWaveSurferTimeline()
            ]);
        } catch (error) {
            showError("WaveSurfer не загрузился");
            console.error(error);
            return;
        }

        let buttons = null;

        const initButtons =
        wavesButtonsModule?.initWavesButtons ||
        wavesButtonsModule?.default?.initWavesButtons ||
        wavesButtonsModule?.default;

        if (typeof initButtons === "function") {
            try {
                buttons = initButtons(buttonsHost, waveContainer);
                buttons?.setEnabled?.(false);
            } catch (error) {
                console.error("Buttons initialization failed:", error);
            }
        }

        let ws;

        try {
            ws = WaveSurfer.create({
                container: waveContainer,
                waveColor: "#757575",
                progressColor: "#ffffff",
                height: 100,
                cursorColor: "#ffffff",
                cursorWidth: 3,
                barWidth: 1,
                barGap: 1,
                barHeight: 0.8,
                fillParent: true,
                responsive: true,
                dragToSeek: true,
                plugins: [
                    Hover.create({
                        lineColor: "white",
                        lineWidth: 2,
                        labelBackground: "#222222",
                        labelColor: "#ffffff",
                        labelSize: "32px",
                    }),
                    Timeline.create({
                        container: timelineContainer,
                        height: 28,
                        timeInterval: 5,
                        primaryLabelInterval: 10,
                        secondaryLabelInterval: 5,
                        style: {
                            fontSize: "16px",
                            color: "#757575"
                        }
                    })
                ]
            });
        } catch (error) {
            showError("Ошибка создания WaveSurfer");
            console.error(error);
            return;
        }

        container._waveSurferInstance = ws;

        const backend = {
            type: "wavesurfer",

            playPause: () => ws.playPause(),

            stop() {
                ws.stop();
                ws.seekTo(0);
            },

            seekTo: ratio => ws.seekTo(ratio),
            getDuration: () => ws.getDuration(),
            getCurrentTime: () => ws.getCurrentTime(),
            setVolume: value => ws.setVolume(value),

            setPlaybackRate(value) {
                const rate = Number(value) || 1;
                console.log("Установка скорости WaveSurfer:", rate);
                ws.setPlaybackRate(rate);
            },

            isPlaying: () => ws.isPlaying(),
            destroy: () => ws.destroy()
        };

        buttons?.setBackend?.(backend);

        let timeout = setTimeout(() => {
            showError("WaveSurfer не успел подготовиться");
            buttons?.setEnabled?.(false);
        }, 9000);

        ws.on("loading", percent => {
            const value = Math.max(0, Math.min(100, Number(percent) || 0));

            showOverlay(
                overlay,
                "Загрузка аудио...",
                `${Math.round(value)}%`
            );

            overlay.fill.style.width = `${value}%`;
        });

        ws.on("decode", () => {
            showOverlay(overlay, "Подготовка...");
            overlay.bar.style.visibility = "visible";
            overlay.fill.style.width = "100%";
        });

        ws.on("ready", () => {
            clearTimeout(timeout);
            timeout = null;

            buttons?.setEnabled?.(true);
            showOverlay(overlay, "Готово");
            overlay.bar.style.visibility = "hidden";

            setTimeout(() => {
                if (!ws.isPlaying()) hideOverlay(overlay);
            }, 450);
        });

        ws.on("play", () => hideOverlay(overlay));

        ws.on("pause", () => {
            showOverlay(overlay, "⏸ Пауза. Еноты думают. 🦝");
        });

        ws.on("finish", () => {
            showOverlay(overlay, "⏹ Завершено");
            setTimeout(() => hideOverlay(overlay), 1200);
        });

        ws.on("error", error => {
            clearTimeout(timeout);
            timeout = null;

            buttons?.setEnabled?.(false);
            showError("WaveSurfer не смог загрузить аудио");
            console.error(error);
        });

        try {
            showOverlay(overlay, "Загрузка аудио...", "0");
            await ws.load(src);
        } catch (error) {
            showError("Ошибка при загрузке аудио");
            console.error(error);
        }
    }
};

export default wavesurferPlayer;
