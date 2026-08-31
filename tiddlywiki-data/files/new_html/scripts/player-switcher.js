import html5Player from "./players/html5.js";
import wavesurferPlayer from "./players/wavesurfer.js";

const DEFAULT_FALLBACK_PLAYER_ID = "html5";
const STORAGE_KEY = "selected-player";

const players = {
    html5: html5Player,
    wavesurfer: wavesurferPlayer
};

function parseAvailableList(value) {
    if (!value) return [];

    return value
    .split(/\r?\n|,/)
    .map(item => item.trim())
    .filter(Boolean);
}

class PlayerSwitcher {
    constructor(options = {}) {
        this.container = options.container;

        if (!this.container) {
            throw new Error("PlayerSwitcher: container is required");
        }

        this.src = options.src || this.container.dataset.src || "";
        this.preferredId =
        options.preferredPlayer ||
        this.container.dataset.preferredPlayer ||
        "";

        this.selectedId =
        options.selectedPlayer ||
        localStorage.getItem(STORAGE_KEY) ||
        "";

        this.availableIds =
        options.availablePlayers ||
        parseAvailableList(this.container.dataset.availablePlayers);

        if (!this.availableIds.length) {
            if (this.preferredId) {
                this.availableIds.push(this.preferredId);
            }

            this.availableIds.push(DEFAULT_FALLBACK_PLAYER_ID);
        }

        this.players = options.players || players;

        this.container.addEventListener(
            "change-player-source",
            event => {
                const source =
                event.detail?.src ||
                this.container.dataset.src ||
                "";

        if (!source) return;

        this.src = source;
                this.container.dataset.src = source;
                this.renderPlayer();
            }
        );

        this.render();
    }

    isPlayerAvailable(playerId) {
        const player = this.players[playerId];

        return Boolean(
            player &&
            typeof player.render === "function"
        );
    }

    getPlayer(playerId) {
        return this.players[playerId] || null;
    }

    resolvePlayerId() {
        const candidates = [
            this.selectedId,
            this.preferredId,
            ...this.availableIds,
            DEFAULT_FALLBACK_PLAYER_ID
        ];

        return candidates.find(playerId =>
        this.isPlayerAvailable(playerId)
        ) || null;
    }

    render() {
        this.container.replaceChildren();

        this.wrapperNode = document.createElement("div");
        this.wrapperNode.className = "tc-player-switcher";

        this.selectNode = document.createElement("select");
        this.selectNode.className = "tc-player-switcher-select";

        this.messageNode = document.createElement("div");
        this.messageNode.className = "tc-player-switcher-message";

        this.playerNode = document.createElement("div");
        this.playerNode.className = "tc-player-switcher-player";

        this.wrapperNode.append(
            this.selectNode,
            this.messageNode,
            this.playerNode
        );

        this.container.appendChild(this.wrapperNode);

        this.renderSelect();
        this.renderPlayer();
    }

    renderSelect() {
        const currentId = this.resolvePlayerId();

        this.selectNode.replaceChildren();

        let hasAvailablePlayers = false;

        for (const playerId of this.availableIds) {
            const player = this.getPlayer(playerId);

            if (!this.isPlayerAvailable(playerId)) continue;

            const option = document.createElement("option");

            option.value = playerId;
            option.textContent = player.label || playerId;
            option.selected = playerId === currentId;

            this.selectNode.appendChild(option);
            hasAvailablePlayers = true;
        }

        this.selectNode.disabled = !hasAvailablePlayers;

        if (!hasAvailablePlayers) {
            this.selectNode.title = "No available players";
        } else {
            this.selectNode.removeAttribute("title");
        }

        this.selectNode.addEventListener("change", () => {
            this.selectedId = this.selectNode.value;
            localStorage.setItem(STORAGE_KEY, this.selectedId);
            this.renderPlayer();
        });
    }

    renderPlayer() {
        const playerId = this.resolvePlayerId();
        const player = this.getPlayer(playerId);

        this.playerNode.replaceChildren();
        this.messageNode.textContent = "";

        if (!player || typeof player.render !== "function") {
            this.messageNode.textContent =
            `Player module not found or has no render(): ${playerId}`;

            return;
        }

        try {
            player.render({
                container: this.playerNode,
                src: this.src,
                playerId
            });
        } catch (error) {
            console.error("Player render error:", error);

            this.playerNode.replaceChildren();

            const fallbackPlayer =
            this.getPlayer(DEFAULT_FALLBACK_PLAYER_ID);

            if (
                fallbackPlayer &&
                typeof fallbackPlayer.render === "function"
            ) {
                fallbackPlayer.render({
                    container: this.playerNode,
                    src: this.src,
                    playerId: DEFAULT_FALLBACK_PLAYER_ID,
                    options: {
                        reason: error.message
                    }
                });

                this.messageNode.textContent =
                "Используется резервный HTML5-плеер.";
            } else {
                this.messageNode.textContent =
                "Резервный плеер отсутствует.";
            }
        }
    }
}

document
.querySelectorAll(".tc-player-switcher")
.forEach(container => {
    new PlayerSwitcher({ container });
});
