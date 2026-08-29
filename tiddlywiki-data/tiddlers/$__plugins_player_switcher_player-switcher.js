(function () {
  "use strict";

  var Widget = require("$:/core/modules/widgets/widget.js").widget;

  var PREF_TITLE = "$:/plugins/player_switcher/preferred-player";
  var SEL_TITLE = "$:/plugins/player_switcher/selected-player";
  var AVAIL_TITLE = "$:/plugins/player_switcher/available-players";

  var DEFAULT_FALLBACK_PLAYER_ID = "$:/plugins/player_switcher/players/html5-video";

  function parseAvailableList(text) {
    if (!text) return [];
    return text
      .split(/\r?\n/)
      .map(function (s) { return s.trim(); })
      .filter(Boolean);
  }

  class PlayerSwitcherWidget extends Widget {
    constructor(parseTreeNode, options) {
      super(parseTreeNode, options);
      this.initialise(parseTreeNode, options);
    }

    render(parent, nextSibling) {
      this.parentDomNode = parent;
      this.computeAttributes();
      this.execute();

      if (nextSibling) {
        nextSibling.before(this.domNodes[0]);
      } else {
        parent.appendChild(this.domNodes[0]);
      }
    }

    execute() {
      this.domNodes = [];
      this.playerDomNode = this.document.createElement("div");
      this.playerDomNode.className = "tc-player-switcher-player";

      this.wrapNode = this.document.createElement("div");
      this.wrapNode.className = "tc-player-switcher";

      this.selectNode = this.document.createElement("select");
      this.selectNode.className = "tc-player-switcher-select";

      this.messageNode = this.document.createElement("div");
      this.messageNode.className = "tc-player-switcher-message";

      this.wrapNode.appendChild(this.selectNode);
      this.wrapNode.appendChild(this.messageNode);
      this.wrapNode.appendChild(this.playerDomNode);

      this.domNodes.push(this.wrapNode);

      this.mediaSrc = this.getAttribute("src", "");

      this.preferredId = (this.wiki.getTiddlerText(PREF_TITLE, "") || "").trim();
      this.selectedId = (this.wiki.getTiddlerText(SEL_TITLE, "") || "").trim();

      this.availableIds = parseAvailableList(this.wiki.getTiddlerText(AVAIL_TITLE, ""));
      if (!this.availableIds.length) {
        if (this.preferredId) this.availableIds.push(this.preferredId);
        this.availableIds.push(DEFAULT_FALLBACK_PLAYER_ID);
      }

      this._renderSelect();
      this._renderPlayer();
    }

    refresh(changedTiddlers) {
      if (changedTiddlers[PREF_TITLE] || changedTiddlers[SEL_TITLE] || changedTiddlers[AVAIL_TITLE]) {
        this.refreshSelf();
        return true;
      }
      return false;
    }

    _isModuleAvailable(playerModuleId) {
      if (!playerModuleId) return false;
      try {
        require(playerModuleId);
        return true;
      } catch (e) {
        return false;
      }
    }

    _resolvePlayerId() {
      var candidates = [];

      if (this.selectedId) candidates.push(this.selectedId);
      if (this.preferredId) candidates.push(this.preferredId);

      for (var i = 0; i < this.availableIds.length; i++) {
        candidates.push(this.availableIds[i]);
      }

      candidates.push(DEFAULT_FALLBACK_PLAYER_ID);

      for (var j = 0; j < candidates.length; j++) {
        var id = candidates[j];
        if (this._isModuleAvailable(id)) return id;
      }

      return DEFAULT_FALLBACK_PLAYER_ID;
    }

    _renderSelect() {
      var currentId = this._resolvePlayerId();

      this.selectNode.innerHTML = "";

      var addedAny = false;
      for (var i = 0; i < this.availableIds.length; i++) {
        var id = this.availableIds[i];
        if (!this._isModuleAvailable(id)) continue;

        var mod = null;
        try {
          mod = require(id);
        } catch (e) {
          mod = null;
        }

        var opt = this.document.createElement("option");
        opt.value = id;
        opt.textContent = (mod && mod.label) ? mod.label : id;
        if (id === currentId) opt.selected = true;

        this.selectNode.appendChild(opt);
        addedAny = true;
      }

      if (!addedAny) {
        this.selectNode.disabled = true;
        this.selectNode.title = "No available players";
      } else {
        this.selectNode.disabled = false;
      }

      var self = this;
      this.selectNode.onchange = function () {
        var newId = self.selectNode.value;
        self.wiki.setText(SEL_TITLE, "text", undefined, newId);
      };
    }

    _renderPlayer() {
      var playerId = this._resolvePlayerId();

      var mod = null;
      try {
        mod = require(playerId);
      } catch (e) {
        mod = null;
      }

      while (this.playerDomNode.firstChild) {
        this.playerDomNode.removeChild(this.playerDomNode.firstChild);
      }

      this.messageNode.textContent = "";

      if (!mod || typeof mod.render !== "function") {
        this.messageNode.textContent = "Player module not found or has no render(): " + playerId;
        return;
      }

      try {
        mod.render({
          container: this.playerDomNode,
          wiki: this.wiki,
          src: this.mediaSrc,
          playerId: playerId
        });
      } catch (e) {
        while (this.playerDomNode.firstChild) {
          this.playerDomNode.removeChild(this.playerDomNode.firstChild);
        }

        var fallbackMod = null;
        try {
          fallbackMod = require(DEFAULT_FALLBACK_PLAYER_ID);
        } catch (e2) {
          fallbackMod = null;
        }

        if (fallbackMod && typeof fallbackMod.render === "function") {
          fallbackMod.render({
            container: this.playerDomNode,
            wiki: this.wiki,
            src: this.mediaSrc,
            playerId: DEFAULT_FALLBACK_PLAYER_ID,
            options: { reason: "render error: " + e }
          });
          this.messageNode.textContent = "Fallback to builtin HTML5 player due to player error.";
        } else {
          this.messageNode.textContent = "Fallback player missing.";
        }
      }
    }
  }

  exports["player-switcher"] = PlayerSwitcherWidget;
})();
