/* Лабиринт сознаний — точка сборки.
   Модули: core, terminal, story, worldplay, commands, inventory, mapview,
   table, trial, audio, input. Здесь остаются только цикл, запуск и
   отладочный API. */
(function () {
  'use strict';

  const ZQ = window.ZQ;
  const C = ZQ.C;
  const rt = ZQ.rt;
  const dom = ZQ.dom;

  function installDebugApi() {
    let enabled = false;
    try {
      enabled = new URLSearchParams(window.location.search).has('debug');
    } catch (error) {
      enabled = false;
    }
    if (!enabled) return;

    function keyElements() {
      return rt.state.canvasElements
        .filter((element) => element.kind === 'key')
        .map((element) => JSON.parse(JSON.stringify(element)));
    }

    window.__zqwy = {
      snapshot() {
        return JSON.parse(JSON.stringify({
          player: rt.state.player,
          camera: rt.state.camera,
          seed: rt.state.seed,
          currentRoomId: rt.state.currentRoomId,
          flags: rt.state.flags,
          items: rt.state.items,
          backpacks: rt.state.backpacks,
          visited: rt.state.visited,
          mapMarks: rt.state.mapMarks,
          storySeen: rt.state.storySeen,
          unlocks: rt.state.unlocks,
          deaths: rt.state.deaths,
          canvasElements: rt.state.canvasElements,
          world: {
            seed: rt.world.seed,
            chunks: rt.world.chunkCount,
            rooms: rt.world.rooms.length,
            chunkSize: rt.world.CHUNK,
            chunkW: rt.world.chunkW,
            chunkH: rt.world.chunkH
          },
          trial: rt.trial ? {
            active: rt.trial.active,
            elapsed: rt.trial.elapsed,
            sparksLeft: rt.trial.sparksLeft,
            sealsClosed: rt.trial.sealsClosed,
            activeSeal: rt.trial.activeSeal,
            resultKind: rt.trial.resultKind
          } : null,
          overlays: {
            termView: rt.termView,
            cardOrigin: rt.cardOrigin,
            trial: rt.termView === 'trial',
            inventory: rt.termView === 'inventory',
            map: rt.termView === 'map',
            settings: rt.termView === 'settings',
            canvas: rt.termView === 'canvas' || rt.termView === 'card',
            card: rt.termView === 'card',
            story: rt.termView === 'story',
            trialStage: !dom.trialStage.classList.contains('hidden'),
            scheme: !dom.canvasKeys.classList.contains('hidden')
          },
          terminal: {
            view: rt.termView,
            split: (function () {
              try {
                const raw = window.localStorage.getItem(ZQ.constants.SPLIT_KEY);
                const value = raw === null ? NaN : Number(raw);
                return Number.isFinite(value) ? value : null;
              } catch (error) {
                return null;
              }
            })(),
            gameRows: dom.app.style.gridTemplateRows,
            zoom: rt.canvasZoom,
            pan: { x: rt.canvasPanX, y: rt.canvasPanY },
            device: rt.canvasDevice,
            speed: rt.termSettings.speed,
            fontSize: rt.termSettings.fontSize,
            fontOverrides: rt.termSettings.fontOverrides,
            logging: rt.termSettings.logging,
            logText: dom.log.textContent,
            controls: rt.state.canvasElements
              .filter((element) => element.kind === 'control')
              .map((element) => JSON.parse(JSON.stringify(element))),
            keys: keyElements(),
            history: rt.commandHistory.slice()
          },
          story: typeof ZQ.storyInfo === 'function' ? ZQ.storyInfo() : []
        }));
      },

      teleport(x, y) {
        rt.state.player.x = x;
        rt.state.player.y = y;
        rt.state.player.moving = false;
        ZQ.snapCamera();
        rt.state.currentRoomId = null;
        ZQ.updateRoomDetection();
        ZQ.updatePrompt();
      },

      goRoom(role) {
        const room = rt.world.rooms.find((candidate) => candidate.role === role);
        if (!room) return null;
        rt.state.player.x = room.centerX + 0.5;
        rt.state.player.y = room.centerY + 0.5;
        rt.state.player.moving = false;
        ZQ.snapCamera();
        rt.state.currentRoomId = null;
        ZQ.updateRoomDetection();
        ZQ.updatePrompt();
        return room.id;
      },

      give(itemId) {
        if (!ZQ.knownItemId(itemId) || rt.state.items.includes(itemId)) return false;
        rt.state.items.push(itemId);
        if (rt.termView === 'inventory') ZQ.renderInventory();
        if (rt.termView === 'canvas') ZQ.renderCanvasElements();
        ZQ.saveGame();
        return true;
      },

      die(cause) {
        ZQ.die(cause || 'debug');
      },

      startTrial() {
        ZQ.startTrial();
      },

      trialInfo() {
        if (!rt.trial) return null;
        return {
          player: { x: rt.trial.player.x, y: rt.trial.player.y },
          center: { x: rt.trial.center.x, y: rt.trial.center.y },
          radius: rt.trial.radius,
          activeSeal: rt.trial.activeSeal
            ? JSON.parse(JSON.stringify(rt.trial.activeSeal))
            : null,
          elapsed: rt.trial.elapsed,
          sealsClosed: rt.trial.sealsClosed,
          sparksLeft: rt.trial.sparksLeft
        };
      },

      finishTrialNow(kind) {
        if (!rt.trial) return false;
        if (kind === 'success') {
          rt.trial.elapsed = C.trial.duration;
          rt.trial.sealsClosed = C.trial.sealsRequired;
        } else if (kind === 'fail') {
          rt.trial.elapsed = C.trial.duration;
          rt.trial.sealsClosed = 0;
        }
        return true;
      },

      closeAll() {
        ZQ.hideTrialStage();
        ZQ.setTerminalView('main');
        ZQ.clearStoryQueue();
        if (rt.trialRaf) window.cancelAnimationFrame(rt.trialRaf);
        rt.trialRaf = 0;
        rt.trial = null;
        ZQ.updatePrompt();
      },

      newGame() {
        ZQ.startNewGame();
        return rt.state.seed;
      },

      setScheme(device) {
        rt.canvasDevice = ['keyboard', 'gamepad', 'phone', 'mouse'].includes(device)
          ? device
          : 'keyboard';
        ZQ.renderKeyScheme();
        return rt.canvasDevice;
      },

      addKey(code) {
        const key = ZQ.addKeyElement(typeof code === 'string' ? code : null);
        if (!key) return null;
        if (!code) {
          rt.keyBindingId = null;
          ZQ.renderCanvasElements();
          ZQ.renderKeyScheme();
        }
        return key.id;
      },

      linkKey(keyId, targetId) {
        const key = rt.state.canvasElements.find((element) =>
          element.kind === 'key' && element.id === keyId
        );
        const target = rt.state.canvasElements.find((element) =>
          element.kind !== 'key' && element.id === targetId
        );
        if (!key || !target) return false;
        if (!Array.isArray(key.links)) key.links = [];
        if (!key.links.includes(target.id)) key.links.push(target.id);
        ZQ.saveGame();
        ZQ.renderCanvasElements();
        ZQ.renderCanvasDrawer();
        ZQ.renderKeyScheme();
        return true;
      },

      unlinkKey(keyId, targetId) {
        const key = rt.state.canvasElements.find((element) =>
          element.kind === 'key' && element.id === keyId
        );
        if (!key) return false;
        key.links = (key.links || []).filter((id) => id !== targetId);
        ZQ.saveGame();
        ZQ.renderCanvasElements();
        ZQ.renderCanvasDrawer();
        ZQ.renderKeyScheme();
        return true;
      },

      runKey(keyId) {
        const key = rt.state.canvasElements.find((element) =>
          element.kind === 'key' && element.id === keyId
        );
        if (!key) return false;
        ZQ.executeKeyElement(key);
        return true;
      },

      bindKey(elementId, code) {
        if (typeof code !== 'string') return false;
        const element = rt.state.canvasElements.find((candidate) => candidate.id === elementId);
        if (element && element.kind === 'key') {
          ZQ.assignKeyCode(element, code);
          return true;
        }
        if (!element) return false;
        const existing = ZQ.keyForCode(code);
        if (existing) {
          if (!existing.links.includes(element.id)) existing.links.push(element.id);
          ZQ.saveGame();
          ZQ.renderCanvasElements();
          ZQ.renderKeyScheme();
          return true;
        }
        const key = ZQ.addKeyElement(code);
        if (!key || !key.id) return false;
        key.links.push(element.id);
        ZQ.saveGame();
        ZQ.renderCanvasElements();
        ZQ.renderCanvasDrawer();
        ZQ.renderKeyScheme();
        return true;
      },

      addElement(kind, value) {
        if (kind === 'item') return ZQ.addItemElement(value, false) ? true : false;
        if (kind === 'command') return ZQ.addCommandElement(value) ? true : false;
        if (kind === 'control') return ZQ.addControlElement(value) ? true : false;
        if (kind === 'key') return this.addKey(value);
        return false;
      },

      panBy(x, y) {
        ZQ.setCanvasPan(rt.canvasPanX + Number(x || 0), rt.canvasPanY + Number(y || 0));
        return { x: rt.canvasPanX, y: rt.canvasPanY };
      },

      setLogging(category, value) {
        ZQ.setLogging(category, value);
        return rt.termSettings.logging;
      },

      storyInfo() {
        return ZQ.storyInfo();
      },

      move(dir, seconds) {
        return ZQ.startTimedMove(dir, seconds);
      },

      stopMove() {
        ZQ.stopMovement();
        return true;
      },

      setCursor(x, y) {
        return ZQ.setCursorDestination(x, y);
      },

      load() {
        return ZQ.loadGame();
      },

      save: ZQ.saveGame
    };
  }

  function loop(time) {
    const dt = Math.min(0.05, (time - rt.lastFrame) / 1000 || 0);
    rt.lastFrame = time;
    ZQ.pollGamepad();

    if (!ZQ.isPaused()) {
      /* Ошибка в одном кадре не должна останавливать цикл: иначе игра
         выглядит зависшей, хотя достаточно было пропустить кадр. */
      try {
        ZQ.updateMovement(dt);
        ZQ.updateRoomDetection();
        if (typeof ZQ.updateBattle === 'function') ZQ.updateBattle(dt);
        if (typeof ZQ.updateChase === 'function') ZQ.updateChase(dt);
        ZQ.updateCamera();
        if (!rt.trial) ZQ.updatePrompt();
      } catch (error) {
        console.error(error);
      }
    }

    if (rt.images) {
      try {
        const view = window.Renderer.makeCanvasSize(dom.worldCanvas);
        rt.worldCtx = view.ctx;
        window.Renderer.drawWorld(view.ctx, {
          state: rt.state,
          world: rt.world,
          images: rt.images,
          view,
          cursor: rt.cursorMove,
          cursorMode: rt.cursorMode,
          cursorPath: rt.cursorPath,
          cursorPathGoal: rt.cursorPathGoal,
          cursorTile: rt.cursorTile,
          now: time
        });
      } catch (error) {
        console.error(error);
      }
    }

    window.requestAnimationFrame(loop);
  }

  function boot() {
    const started = ZQ.now();
    rt.termSettings = ZQ.readTermSettings();
    ZQ.applyTermSettings(false);

    const saved = ZQ.readSave();
    const seed = saved && typeof saved.seed === 'string' ? saved.seed : ZQ.newSeed();
    rt.world = window.World.generate(seed);
    rt.state = ZQ.defaultState(seed);
    if (saved) ZQ.hydrateState(saved);
    if (typeof ZQ.normalizeTableBindings === 'function') ZQ.normalizeTableBindings();

    if (!ZQ.canStandAt(rt.state.player.x, rt.state.player.y)) {
      ZQ.respawnAtTablet();
    }
    ZQ.snapCamera();
    rt.images = window.Renderer.prepareImages();
    rt.loadMs = Math.max(0, Math.round(ZQ.now() - started));

    ZQ.appendLog(
      ZQ.bootMessage(seed, saved
        ? { kind: 'load', slotName: saved.slotName || '' }
        : { kind: 'new' }),
      'sys',
      true
    );
    ZQ.initDivider();
    ZQ.resetCanvasView(false);
    ZQ.renderCanvasElements();
    ZQ.renderCanvasDrawer();
    ZQ.renderKeyScheme();
    ZQ.setTerminalView('main');
    ZQ.checkAspectRatio();
    installDebugApi();

    rt.lastFrame = ZQ.now();
    window.requestAnimationFrame(loop);
  }

  boot();
})();
