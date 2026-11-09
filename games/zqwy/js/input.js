/* Ввод: клавиатура, экранные кнопки и геймпад. */
(function () {
  'use strict';

  const ZQ = window.ZQ;
  const rt = ZQ.rt;
  const dom = ZQ.dom;

  const MOVE_KEYS = {
    ArrowUp: 'up', KeyW: 'up',
    ArrowDown: 'down', KeyS: 'down',
    ArrowLeft: 'left', KeyA: 'left',
    ArrowRight: 'right', KeyD: 'right'
  };

  const CORE_CODES = new Set([
    'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
    'KeyW', 'KeyA', 'KeyS', 'KeyD',
    'KeyE', 'Space', 'Enter', 'Escape'
  ]);

  function closeActiveView() {
    if (rt.termView === 'card') ZQ.closeCardDetail();
    else if (rt.termView === 'canvas') ZQ.closeCanvas();
    else if (rt.termView === 'inventory') ZQ.closeInventory();
    else if (rt.termView === 'map') ZQ.closeMap();
    else if (rt.termView === 'settings' || rt.termView === 'termSettings' || rt.termView === 'fontSettings') ZQ.closeSettings();
    else if (rt.termView === 'music') ZQ.closeMusic();
    else if (rt.termView === 'story') ZQ.closeStory();
  }

  window.addEventListener('keydown', (event) => {
    if (rt.keyBindingId) {
      event.preventDefault();
      const element = rt.state.canvasElements.find((el) =>
        el.kind === 'key' && el.id === rt.keyBindingId
      );
      if (!element) {
        rt.keyBindingId = null;
        return;
      }
      ZQ.assignKeyCode(element, event.code);
      return;
    }

    if (ZQ.isTyping()) return;

    /* Связанные клавиши: на столе работают все, в основной вкладке —
       всё, что не занято базовым управлением. */
    if ((rt.termView === 'canvas' || rt.termView === 'main') &&
        event.code !== 'Escape' &&
        !event.ctrlKey && !event.metaKey && !event.altKey) {
      if (rt.termView === 'canvas' || !CORE_CODES.has(event.code)) {
        const key = ZQ.keyForCode(event.code);
        if (key) {
          event.preventDefault();
          ZQ.executeKeyElement(key);
          return;
        }
      }
    }

    const move = MOVE_KEYS[event.code];
    if (move) {
      rt.keys[move] = true;
      event.preventDefault();
      return;
    }

    if (event.code === 'Space') {
      if (rt.trial && rt.trial.active) {
        event.preventDefault();
        ZQ.attemptSeal();
      }
      return;
    }

    if (event.code === 'Escape') {
      closeActiveView();
      return;
    }

    if (event.code === 'Enter') {
      if (rt.termView === 'main') {
        event.preventDefault();
        dom.commandInput.focus();
      }
      return;
    }

    if (event.ctrlKey || event.metaKey || event.altKey) return;

    if (event.code === 'KeyE') {
      event.preventDefault();
      ZQ.interact();
    }
  });

  window.addEventListener('keyup', (event) => {
    const move = MOVE_KEYS[event.code];
    if (!move) return;
    rt.keys[move] = false;
    if (!ZQ.isTyping()) event.preventDefault();
  });

  window.addEventListener('blur', () => {
    ZQ.resetKeys();
  });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) ZQ.resetKeys();
  });

  function bindDirectionPad(root) {
    if (!root) return;
    root.querySelectorAll('[data-dir]').forEach((button) => {
      const direction = button.dataset.dir;
      const press = (event) => {
        event.preventDefault();
        rt.keys[direction] = true;
        try {
          button.setPointerCapture(event.pointerId);
        } catch (error) {
          /* ignored */
        }
      };
      const release = (event) => {
        event.preventDefault();
        rt.keys[direction] = false;
      };
      button.addEventListener('pointerdown', press);
      button.addEventListener('pointerup', release);
      button.addEventListener('pointercancel', release);
      button.addEventListener('lostpointercapture', release);
    });
  }

  bindDirectionPad(document.querySelector('.touch-ui .dpad'));
  bindDirectionPad(document.querySelector('.trial-touch .dpad'));

  dom.btnAction.addEventListener('click', () => ZQ.interact());

  /* Геймпад: только базовые жесты. Клавиши стола настраиваются
     отдельными элементами и не появляются заранее. */
  const GAMEPAD_BUTTONS = {
    0: { label: 'A', action: 'interact' },
    1: { label: 'B', action: 'stop' },
    9: { label: 'START', action: 'settings' }
  };

  function runGamepadAction(action) {
    if (action === 'settings') {
      if (rt.termView === 'main') ZQ.openSettings();
      return;
    }
    if (action === 'stop') {
      ZQ.resetKeys();
      if (rt.state) rt.state.player.moving = false;
      return;
    }
    if (action === 'interact') ZQ.interact();
  }

  function pollGamepad() {
    if (!navigator.getGamepads || document.hidden) return;
    let pad = null;
    try {
      const pads = navigator.getGamepads();
      for (let i = 0; i < pads.length; i++) {
        if (pads[i]) {
          pad = pads[i];
          rt.gamepadIndex = i;
          break;
        }
      }
    } catch (error) {
      return;
    }

    const directions = { up: false, down: false, left: false, right: false };
    if (pad) {
      const axisX = pad.axes.length > 0 ? pad.axes[0] : 0;
      const axisY = pad.axes.length > 1 ? pad.axes[1] : 0;
      const dead = 0.38;
      const pressed = (index) => Boolean(pad.buttons[index] && pad.buttons[index].pressed);
      directions.up = pressed(12) || axisY < -dead;
      directions.down = pressed(13) || axisY > dead;
      directions.left = pressed(14) || axisX < -dead;
      directions.right = pressed(15) || axisX > dead;

      /* Открытая вкладка терминала не мешает геймпаду: ограничиваем
         действие только паузой (скрытый документ или испытание).
         Во время испытания оставляем кнопку действия для закрытия печати. */
      const canAct = (rt.trial && rt.trial.active) ||
        (!ZQ.isPaused() && !ZQ.isTyping());
      for (const key of Object.keys(GAMEPAD_BUTTONS)) {
        const index = Number(key);
        const info = GAMEPAD_BUTTONS[key];
        const isPressed = pressed(index);
        const wasPressed = Boolean(rt.gamepadPrev[index]);
        if (!isPressed || wasPressed || !canAct) continue;
        if (rt.trial && rt.trial.active) {
          if (info.action === 'interact') ZQ.attemptSeal();
          continue;
        }
        runGamepadAction(info.action);
      }
      const next = [];
      for (const key of Object.keys(GAMEPAD_BUTTONS)) {
        next[Number(key)] = pressed(Number(key));
      }
      rt.gamepadPrev = next;
    }

    for (const key of Object.keys(directions)) rt.gamepadKeys[key] = directions[key];
  }

  /* --------------------- Курсор по миру (ЛКМ) ---------------------- */
  /* Короткий клик ставит точку назначения. Удержание и перетаскивание
     ведут Zemic за курсором; отпускание останавливает следование. */
  function screenToWorld(clientX, clientY) {
    if (!rt.state || !rt.state.camera) return null;
    const rect = dom.worldCanvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;
    const view = { w: rect.width, h: rect.height };
    const ts = window.Renderer && window.Renderer.tilePxFor
      ? window.Renderer.tilePxFor(view)
      : 30;
    return {
      x: rt.state.camera.x + (clientX - rect.left - rect.width / 2) / ts,
      y: rt.state.camera.y + (clientY - rect.top - rect.height / 2) / ts
    };
  }

  function canUseCursor() {
    if (!rt.state || !rt.world) return false;
    if (ZQ.isTyping() || ZQ.isPaused()) return false;
    if (rt.trial && rt.trial.active) return false;
    /* Вкладки терминала не блокируют курсор: можно вести Zemic ЛКМ,
       даже когда открыт рюкзак, карта, сюжет или настройки. */
    return true;
  }

  /* --------------------- Свой курсор в мире ------------------------ */
  function hideGameCursor() {
    if (!dom.gameCursor) return;
    dom.gameCursor.classList.add('hidden');
    dom.gameCursor.classList.remove('down');
    rt.cursorPos.inside = false;
    rt.cursorPos.down = false;
  }

  function updateGameCursor(event) {
    if (!dom.gameCursor) return;
    if (event.pointerType && event.pointerType !== 'mouse' && event.pointerType !== 'pen') {
      hideGameCursor();
      return;
    }
    const canvasRect = dom.worldCanvas.getBoundingClientRect();
    const inside = event.clientX >= canvasRect.left &&
      event.clientX <= canvasRect.right &&
      event.clientY >= canvasRect.top &&
      event.clientY <= canvasRect.bottom;
    if (!inside || ZQ.isTyping()) {
      hideGameCursor();
      return;
    }
    const host = dom.gameCursor.parentElement || dom.worldCanvas;
    const hostRect = host.getBoundingClientRect();
    const x = event.clientX - hostRect.left;
    const y = event.clientY - hostRect.top;
    rt.cursorPos.x = x;
    rt.cursorPos.y = y;
    rt.cursorPos.inside = true;
    dom.gameCursor.style.transform = `translate3d(${x}px, ${y}px, 0)`;
    dom.gameCursor.classList.remove('hidden');
  }

  dom.worldCanvas.addEventListener('pointerenter', updateGameCursor);
  dom.worldCanvas.addEventListener('pointermove', updateGameCursor);
  dom.worldCanvas.addEventListener('pointerleave', hideGameCursor);
  dom.worldCanvas.addEventListener('pointerdown', (event) => {
    if (event.pointerType && event.pointerType !== 'mouse' && event.pointerType !== 'pen') return;
    updateGameCursor(event);
    if (dom.gameCursor && !dom.gameCursor.classList.contains('hidden')) {
      dom.gameCursor.classList.add('down');
      rt.cursorPos.down = true;
    }
  });
  window.addEventListener('pointerup', () => {
    if (!dom.gameCursor) return;
    dom.gameCursor.classList.remove('down');
    rt.cursorPos.down = false;
  });

  dom.worldCanvas.addEventListener('pointerdown', (event) => {
    if (event.button !== undefined && event.button !== 0) return;
    if (!canUseCursor()) return;
    const target = screenToWorld(event.clientX, event.clientY);
    if (!target) return;
    rt.cursorPointer = {
      id: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      moved: false
    };
    ZQ.setCursorDestination(target.x, target.y, true);
    try {
      dom.worldCanvas.setPointerCapture(event.pointerId);
    } catch (error) {
      /* capture не обязателен */
    }
    event.preventDefault();
  });

  dom.worldCanvas.addEventListener('pointermove', (event) => {
    const pointer = rt.cursorPointer;
    if (!pointer || pointer.id !== event.pointerId) return;
    if (event.buttons !== undefined && (event.buttons & 1) === 0) return;
    if (!canUseCursor()) return;
    const dx = event.clientX - pointer.startX;
    const dy = event.clientY - pointer.startY;
    if (Math.hypot(dx, dy) > 4) pointer.moved = true;
    if (!pointer.moved) return;
    const target = screenToWorld(event.clientX, event.clientY);
    if (!target) return;
    ZQ.setCursorDestination(target.x, target.y, true);
    event.preventDefault();
  });

  function finishCursorPointer(event) {
    const pointer = rt.cursorPointer;
    if (!pointer || pointer.id !== event.pointerId) return;
    rt.cursorPointer = null;
    try {
      dom.worldCanvas.releasePointerCapture(event.pointerId);
    } catch (error) {
      /* ignored */
    }
    if (pointer.moved) {
      /* Ведение за курсором заканчивается вместе с удержанием. */
      ZQ.stopMovement();
    }
  }

  dom.worldCanvas.addEventListener('pointerup', finishCursorPointer);
  dom.worldCanvas.addEventListener('pointercancel', (event) => {
    if (!rt.cursorPointer || rt.cursorPointer.id !== event.pointerId) return;
    rt.cursorPointer = null;
    ZQ.stopMovement();
  });

  window.addEventListener('resize', () => {
    if (rt.termView === 'map') ZQ.drawMapNow();
    ZQ.resizeTrial();
    ZQ.updatePrompt();
  });

  window.addEventListener('beforeunload', ZQ.saveGame);

  ZQ.pollGamepad = pollGamepad;
})();
