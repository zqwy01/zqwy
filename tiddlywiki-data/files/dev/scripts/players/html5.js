const html5Player = {
    label: "HTML5 audio",

    isAvailable() {
        return typeof HTMLAudioElement !== "undefined";
    },

    render({ container, src }) {
        const doc = container.ownerDocument;

        const audio = doc.createElement("audio");

        audio.controls = true;
        audio.preload = "metadata";
        audio.style.width = "100%";
        audio.style.display = "block";

        if (src) {
            audio.src = src;
        }

        container.appendChild(audio);

        if (!src) {
            const message = doc.createElement("div");

            message.textContent =
            "No src provided to player-switcher.";

            container.appendChild(message);
        }
    }
};

export default html5Player;
