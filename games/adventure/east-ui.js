const SVG_NS = 'http://www.w3.org/2000/svg';

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function createUI({ itemDefs, callbacks }) {
  const els = {
    stage: document.getElementById('stage'),
    stageWrap: document.getElementById('stage-wrap'),
    sound: document.getElementById('btn-sound'),
    terminalSound: document.getElementById('btn-terminal-sound'),
    packBadge: document.getElementById('pack-badge'),
    roomKicker: document.getElementById('room-kicker'),
    roomTitle: document.getElementById('room-title'),
    roomSubtitle: document.getElementById('room-subtitle'),
    inventory: document.getElementById('hud-inventory'),
    banner: document.getElementById('room-banner'),
    bannerKicker: document.getElementById('room-banner-kicker'),
    bannerTitle: document.getElementById('room-banner-title'),
    trialHud: document.getElementById('trial-hud'),
    trialTime: document.getElementById('trial-time'),
    trialFill: document.getElementById('trial-fill'),
    prompt: document.getElementById('prompt'),
    promptText: document.getElementById('prompt-text'),
    promptAction: document.getElementById('prompt-action'),
    toast: document.getElementById('toast'),
    deathFlash: document.getElementById('death-flash'),
    terminalLog: document.getElementById('terminal-log'),
    terminalForm: document.getElementById('terminal-form'),
    terminalInput: document.getElementById('terminal-input'),
    terminalState: document.getElementById('terminal-state'),
    canvasButton: document.getElementById('btn-canvas'),
    canvasScreen: document.getElementById('canvas-screen'),
    canvasExit: document.getElementById('canvas-exit'),
    palette: document.getElementById('canvas-palette'),
    board: document.getElementById('canvas-board'),
    boardElements: document.getElementById('canvas-elements'),
    canvasEmpty: document.getElementById('canvas-empty'),
    canvasLog: document.getElementById('canvas-log'),
    canvasQuickForm: document.getElementById('canvas-quick-form'),
    canvasQuickInput: document.getElementById('canvas-quick-input'),
    canvasClear: document.getElementById('canvas-clear'),
    modalRoot: document.getElementById('modal-root'),
    modalCard: document.getElementById('modal-card'),
    modalKicker: document.getElementById('modal-kicker'),
    modalTitle: document.getElementById('modal-title'),
    modalCopy: document.getElementById('modal-copy'),
    modalNote: document.getElementById('modal-note'),
    modalArt: document.getElementById('modal-art'),
    modalImage: document.getElementById('modal-image'),
    modalActions: document.getElementById('modal-actions'),
    action: document.getElementById('touch-action'),
    dash: document.getElementById('touch-dash'),
  };

  let canvasOpen = false;
  let modalOpen = false;
  let modalDismissible = false;
  let modalDismissHandler = null;
  let toastTimer = 0;
  let bannerTimer = 0;
  let paletteDrag = null;
  let boardDrag = null;
  let lastTrialActive = false;
  let currentPalette = [];
  let currentElements = [];

  function log(text, tone = 'world', options = {}) {
    appendLog(els.terminalLog, text, tone);
    if (canvasOpen && options.canvas !== false) appendLog(els.canvasLog, text, tone);
  }

  function appendLog(container, text, tone) {
    if (!container) return;
    const node = element('p', `log-line ${tone || 'world'}`, text);
    container.appendChild(node);
    while (container.children.length > 140) container.removeChild(container.firstChild);
    container.scrollTop = container.scrollHeight;
  }

  function clearTerminal() {
    els.terminalLog.replaceChildren();
  }

  function renderInventory(state, room) {
    els.inventory.replaceChildren();
    if (state.inventory.length === 0) {
      els.inventory.appendChild(element('span', 'inv-empty', 'рюкзак пуст'));
    } else {
      for (const itemId of state.inventory) {
        const item = itemDefs[itemId];
        if (!item) continue;
        const chip = element('span', `inv-chip${item.card ? ' card' : ''}`);
        chip.textContent = `${item.icon || '·'} ${item.title}`;
        els.inventory.appendChild(chip);
      }
    }

    const packs = state.packs.filter((pack) => pack.roomId === room?.id).length;
    els.packBadge.hidden = packs === 0;
    if (packs > 0) {
      els.packBadge.replaceChildren();
      els.packBadge.append('▣ ');
      const strong = element('b', null, String(packs));
      els.packBadge.append(strong);
      els.packBadge.title = `Рюкзаков в комнате: ${packs}`;
    }
  }

  function setRoom(state, room, options = {}) {
    if (!room) return;
    els.roomTitle.textContent = room.title || 'Комната';
    els.roomSubtitle.textContent = room.subtitle || '';
    const depth = Number.isFinite(room.depth) ? room.depth + 1 : 0;
    els.roomKicker.textContent = `круг ${depth} · ${room.subtitle || 'переход'}`;
    renderInventory(state, room);

    if (options.banner) {
      els.bannerKicker.textContent = `круг ${depth}`;
      els.bannerTitle.textContent = room.title || '';
      els.banner.hidden = true;
      // Restart the CSS animation.
      void els.banner.offsetWidth;
      els.banner.hidden = false;
      clearTimeout(bannerTimer);
      bannerTimer = window.setTimeout(() => {
        els.banner.hidden = true;
      }, 2450);
    }
  }

  function setPrompt(text) {
    if (!text || lastTrialActive) {
      els.prompt.hidden = true;
      return;
    }
    els.promptText.textContent = text;
    els.prompt.hidden = false;
  }

  function setTrial(active, remaining = 0, total = 1) {
    lastTrialActive = Boolean(active);
    els.trialHud.hidden = !active;
    els.stageWrap.classList.toggle('trial-active', lastTrialActive);
    if (!active) {
      els.prompt.hidden = false;
      return;
    }
    els.prompt.hidden = true;
    const safeRemaining = Math.max(0, remaining);
    els.trialTime.textContent = safeRemaining.toFixed(1);
    const ratio = clamp(safeRemaining / Math.max(total, 0.001), 0, 1);
    els.trialFill.style.transform = `scaleX(${ratio})`;
  }

  function showBanner(kicker, title) {
    els.bannerKicker.textContent = kicker || '';
    els.bannerTitle.textContent = title || '';
    els.banner.hidden = true;
    void els.banner.offsetWidth;
    els.banner.hidden = false;
    clearTimeout(bannerTimer);
    bannerTimer = window.setTimeout(() => {
      els.banner.hidden = true;
    }, 2450);
  }

  function showToast(text, options = {}) {
    els.toast.textContent = text;
    els.toast.className = 'toast';
    if (options.tone) els.toast.classList.add(options.tone);
    els.toast.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => {
      els.toast.hidden = true;
    }, options.ms ?? 2800);
  }

  function flashDeath() {
    els.deathFlash.classList.remove('on');
    void els.deathFlash.offsetWidth;
    els.deathFlash.classList.add('on');
  }

  function setSound(enabled) {
    const label = enabled ? 'звук вкл' : 'звук выкл';
    els.sound.textContent = label;
    els.sound.setAttribute('aria-pressed', String(enabled));
    els.terminalSound.textContent = enabled ? 'звук' : 'без звука';
    els.terminalSound.setAttribute('aria-pressed', String(enabled));
  }

  function setTerminalState(text) {
    els.terminalState.textContent = text;
  }

  function renderPalette(palette) {
    currentPalette = Array.isArray(palette) ? palette : [];
    els.palette.replaceChildren();
    if (!currentPalette.length) {
      els.palette.appendChild(element('p', 'palette-empty', 'пусто'));
      return;
    }

    for (const descriptor of currentPalette) {
      const button = element('button', `palette-item${descriptor.sourceType === 'card' ? ' card' : ''}`);
      button.type = 'button';
      button.dataset.key = descriptor.key || descriptor.sourceId || descriptor.id || descriptor.command;
      button.title = descriptor.description || descriptor.title || '';
      button.setAttribute('aria-label', `Добавить на холст: ${descriptor.title}`);

      const icon = element('span', 'palette-icon');
      if (descriptor.art) {
        const image = document.createElement('img');
        image.src = descriptor.art;
        image.alt = '';
        icon.appendChild(image);
      } else {
        icon.textContent = descriptor.icon || '·';
      }

      const copy = element('span', 'palette-copy');
      copy.appendChild(element('strong', null, descriptor.title || descriptor.command));
      copy.appendChild(element('small', null, descriptor.sourceType === 'command' ? 'команда' : descriptor.sourceType === 'card' ? 'карта' : 'предмет'));
      button.append(icon, copy);

      button.addEventListener('pointerdown', (event) => beginPaletteDrag(event, descriptor, button));
      els.palette.appendChild(button);
    }
  }

  function beginPaletteDrag(event, descriptor, button) {
    if (event.button != null && event.button !== 0) return;
    event.preventDefault();
    paletteDrag = {
      descriptor,
      button,
      startX: event.clientX,
      startY: event.clientY,
      pointerId: event.pointerId,
      dragged: false,
      ghost: null,
    };
    window.addEventListener('pointermove', movePaletteDrag, { passive: false });
    window.addEventListener('pointerup', endPaletteDrag, { once: true });
    window.addEventListener('pointercancel', cancelPaletteDrag, { once: true });
  }

  function movePaletteDrag(event) {
    if (!paletteDrag || event.pointerId !== paletteDrag.pointerId) return;
    const dx = event.clientX - paletteDrag.startX;
    const dy = event.clientY - paletteDrag.startY;
    if (!paletteDrag.dragged && Math.hypot(dx, dy) < 7) return;
    if (!paletteDrag.dragged) {
      paletteDrag.dragged = true;
      const ghost = element('div', `palette-item${paletteDrag.descriptor.sourceType === 'card' ? ' card' : ''}`);
      ghost.style.position = 'fixed';
      ghost.style.zIndex = '60';
      ghost.style.pointerEvents = 'none';
      ghost.style.opacity = '0.88';
      ghost.style.width = `${paletteDrag.button.getBoundingClientRect().width}px`;
      ghost.style.transform = 'translate(-50%, -50%) scale(0.96)';
      const icon = element('span', 'palette-icon');
      icon.textContent = paletteDrag.descriptor.art ? '❦' : paletteDrag.descriptor.icon || '·';
      const copy = element('span', 'palette-copy');
      copy.appendChild(element('strong', null, paletteDrag.descriptor.title || ''));
      ghost.append(icon, copy);
      document.body.appendChild(ghost);
      paletteDrag.ghost = ghost;
    }
    paletteDrag.ghost.style.left = `${event.clientX}px`;
    paletteDrag.ghost.style.top = `${event.clientY}px`;
    event.preventDefault();
  }

  function endPaletteDrag(event) {
    window.removeEventListener('pointermove', movePaletteDrag);
    if (!paletteDrag) return;
    const drag = paletteDrag;
    paletteDrag = null;
    if (drag.ghost) drag.ghost.remove();
    if (event.pointerId != null && event.pointerId !== drag.pointerId) return;
    if (!drag.dragged) {
      callbacks.canvasAdd(drag.descriptor, null, null);
      return;
    }
    const rect = els.board.getBoundingClientRect();
    if (
      event.clientX >= rect.left && event.clientX <= rect.right &&
      event.clientY >= rect.top && event.clientY <= rect.bottom
    ) {
      callbacks.canvasAdd(
        drag.descriptor,
        clamp((event.clientX - rect.left) / rect.width, 0.08, 0.92),
        clamp((event.clientY - rect.top) / rect.height, 0.1, 0.9),
      );
    }
  }

  function cancelPaletteDrag() {
    window.removeEventListener('pointermove', movePaletteDrag);
    if (paletteDrag?.ghost) paletteDrag.ghost.remove();
    paletteDrag = null;
  }

  function renderBoard(elements) {
    currentElements = Array.isArray(elements) ? elements : [];
    els.boardElements.replaceChildren();
    els.canvasEmpty.hidden = currentElements.length > 0;

    for (const item of currentElements) {
      const card = item.sourceType === 'card';
      const node = element('div', `board-element${card ? ' card' : ''}${item.available === false ? ' unavailable' : ''}`);
      node.style.left = `${clamp(item.x, 0.06, 0.94) * 100}%`;
      node.style.top = `${clamp(item.y, 0.08, 0.92) * 100}%`;
      node.tabIndex = 0;
      node.setAttribute('role', 'button');
      node.setAttribute('aria-label', `${item.title}: ${item.actionLabel}. Нажми, чтобы выполнить; перетащи, чтобы переместить.`);
      node.dataset.id = item.id;

      const icon = element('span', 'be-icon');
      if (item.art) {
        const image = document.createElement('img');
        image.src = item.art;
        image.alt = '';
        icon.appendChild(image);
      } else {
        icon.textContent = item.icon || '·';
      }
      const title = element('span', 'be-title', item.title || item.command || 'элемент');
      const action = element('span', 'be-action', item.available === false ? 'недоступно' : item.actionLabel || 'Выполнить');
      const remove = element('button', 'be-remove', '×');
      remove.type = 'button';
      remove.title = 'Убрать с холста';
      remove.setAttribute('aria-label', `Убрать ${item.title} с холста`);
      remove.addEventListener('pointerdown', (event) => event.stopPropagation());
      remove.addEventListener('click', (event) => {
        event.stopPropagation();
        callbacks.canvasRemove(item.id);
      });

      node.append(icon, title, action, remove);
      node.addEventListener('pointerdown', (event) => beginBoardDrag(event, item, node));
      node.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          callbacks.canvasExecute(item);
        }
      });
      els.boardElements.appendChild(node);
    }
  }

  function beginBoardDrag(event, item, node) {
    if (event.button != null && event.button !== 0) return;
    if (event.target.closest('.be-remove')) return;
    event.preventDefault();
    const rect = els.board.getBoundingClientRect();
    boardDrag = {
      item,
      node,
      rect,
      startX: event.clientX,
      startY: event.clientY,
      pointerId: event.pointerId,
      moved: false,
    };
    node.classList.add('dragging');
    try { node.setPointerCapture(event.pointerId); } catch { /* ignore */ }
    node.addEventListener('pointermove', moveBoardDrag);
    node.addEventListener('pointerup', endBoardDrag, { once: true });
    node.addEventListener('pointercancel', cancelBoardDrag, { once: true });
  }

  function moveBoardDrag(event) {
    if (!boardDrag || event.pointerId !== boardDrag.pointerId) return;
    const dx = event.clientX - boardDrag.startX;
    const dy = event.clientY - boardDrag.startY;
    if (!boardDrag.moved && Math.hypot(dx, dy) < 5) return;
    boardDrag.moved = true;
    const nx = clamp((event.clientX - boardDrag.rect.left) / boardDrag.rect.width, 0.08, 0.92);
    const ny = clamp((event.clientY - boardDrag.rect.top) / boardDrag.rect.height, 0.1, 0.9);
    boardDrag.node.style.left = `${nx * 100}%`;
    boardDrag.node.style.top = `${ny * 100}%`;
    boardDrag.lastX = nx;
    boardDrag.lastY = ny;
    event.preventDefault();
  }

  function endBoardDrag(event) {
    if (!boardDrag) return;
    const drag = boardDrag;
    boardDrag = null;
    drag.node.classList.remove('dragging');
    drag.node.removeEventListener('pointermove', moveBoardDrag);
    if (event.pointerId != null && event.pointerId !== drag.pointerId) return;
    if (drag.moved && Number.isFinite(drag.lastX)) {
      callbacks.canvasMove(drag.item.id, drag.lastX, drag.lastY);
    } else {
      callbacks.canvasExecute(drag.item);
    }
  }

  function cancelBoardDrag() {
    if (!boardDrag) return;
    boardDrag.node.classList.remove('dragging');
    boardDrag.node.removeEventListener('pointermove', moveBoardDrag);
    boardDrag = null;
  }

  function setCanvasData(state, palette) {
    renderPalette(palette);
    const elements = state.canvas.elements.map((item) => {
      const def = item.sourceType === 'item' || item.sourceType === 'card'
        ? itemDefs[item.sourceId]
        : null;
      return {
        ...item,
        art: def?.art || null,
        available: item.sourceType === 'item' || item.sourceType === 'card'
          ? state.inventory.includes(item.sourceId)
          : true,
      };
    });
    renderBoard(elements);
  }

  function openCanvas() {
    canvasOpen = true;
    els.canvasScreen.hidden = false;
    els.terminalState.textContent = 'холст открыт · симуляция на паузе';
    window.setTimeout(() => {
      if (canvasOpen) els.canvasExit.focus({ preventScroll: true });
    }, 40);
  }

  function closeCanvas() {
    if (!canvasOpen) return;
    canvasOpen = false;
    els.canvasScreen.hidden = true;
    els.terminalState.textContent = 'канал открыт';
    if (!modalOpen) els.terminalInput.focus({ preventScroll: true });
  }

  function isPaused() {
    return modalOpen || canvasOpen;
  }

  function showModal(config) {
    modalOpen = true;
    modalDismissible = Boolean(config.dismissible);
    modalDismissHandler = config.onDismiss || null;
    els.modalKicker.textContent = config.kicker || '';
    els.modalTitle.textContent = config.title || '';
    els.modalCopy.replaceChildren();
    for (const paragraph of config.paragraphs || []) {
      els.modalCopy.appendChild(element('p', null, paragraph));
    }
    els.modalNote.textContent = config.note || '';
    els.modalNote.hidden = !config.note;
    els.modalArt.hidden = !config.art;
    if (config.art) {
      els.modalImage.src = config.art;
      if (config.artAlt) els.modalImage.alt = config.artAlt;
    }
    els.modalActions.replaceChildren();

    for (const button of config.buttons || []) {
      const node = element('button', `modal-btn${button.variant ? ` ${button.variant}` : ''}`, button.label);
      node.type = 'button';
      node.addEventListener('click', () => {
        hideModal();
        if (typeof button.onClick === 'function') button.onClick();
      });
      els.modalActions.appendChild(node);
    }

    if (!els.modalActions.children.length) {
      const node = element('button', 'modal-btn primary', 'Закрыть');
      node.type = 'button';
      node.addEventListener('click', hideModal);
      els.modalActions.appendChild(node);
    }

    els.modalRoot.hidden = false;
    els.terminalState.textContent = 'внимание · симуляция на паузе';
    window.setTimeout(() => {
      const first = els.modalActions.querySelector('.primary') || els.modalActions.firstElementChild;
      first?.focus({ preventScroll: true });
    }, 30);
  }

  function hideModal() {
    if (!modalOpen) return;
    modalOpen = false;
    modalDismissible = false;
    modalDismissHandler = null;
    els.modalRoot.hidden = true;
    els.terminalState.textContent = canvasOpen ? 'холст открыт · симуляция на паузе' : 'канал открыт';
    if (!canvasOpen) els.terminalInput.focus({ preventScroll: true });
  }

  function dismissModal() {
    if (!modalOpen || !modalDismissible) return;
    const handler = modalDismissHandler;
    modalDismissHandler = null;
    hideModal();
    if (typeof handler === 'function') handler();
  }

  function addCanvasLog(text, tone = 'world') {
    appendLog(els.canvasLog, text, tone);
  }

  function clearCanvasLog() {
    els.canvasLog.replaceChildren();
  }

  // ---- events -------------------------------------------------------

  els.terminalForm.addEventListener('submit', (event) => {
    event.preventDefault();
    if (modalOpen) return;
    const value = els.terminalInput.value.trim();
    if (!value) return;
    els.terminalInput.value = '';
    callbacks.command(value, 'terminal');
  });

  for (const chip of document.querySelectorAll('.quick-row .chip')) {
    chip.addEventListener('click', () => {
      if (modalOpen) return;
      callbacks.command(chip.dataset.command, 'terminal');
      els.terminalInput.focus({ preventScroll: true });
    });
  }

  els.canvasButton.addEventListener('click', () => callbacks.canvasOpen());
  els.canvasExit.addEventListener('click', () => callbacks.canvasClose());
  els.canvasClear.addEventListener('click', () => callbacks.canvasClear());

  els.canvasQuickForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const value = els.canvasQuickInput.value.trim();
    if (!value) return;
    els.canvasQuickInput.value = '';
    callbacks.canvasQuick(value);
  });

  els.sound.addEventListener('click', () => callbacks.soundToggle());
  els.terminalSound.addEventListener('click', () => callbacks.soundToggle());
  els.promptAction.addEventListener('click', () => callbacks.action());
  els.action.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    callbacks.action();
  });
  els.dash.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    callbacks.dash();
  });

  for (const button of document.querySelectorAll('[data-move]')) {
    const dir = button.dataset.move;
    let activePointer = null;
    const press = (event) => {
      if (activePointer !== null) return;
      event.preventDefault();
      activePointer = event.pointerId;
      button.classList.add('pressed');
      try { button.setPointerCapture(event.pointerId); } catch { /* ignore */ }
      callbacks.virtualMove(dir, true);
    };
    const release = (event) => {
      if (activePointer !== null && event.pointerId !== activePointer) return;
      activePointer = null;
      button.classList.remove('pressed');
      callbacks.virtualMove(dir, false);
    };
    button.addEventListener('pointerdown', press);
    button.addEventListener('pointerup', release);
    button.addEventListener('pointercancel', release);
    button.addEventListener('lostpointercapture', release);
  }

  window.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    if (modalOpen) {
      event.preventDefault();
      dismissModal();
      return;
    }
    if (canvasOpen) {
      event.preventDefault();
      callbacks.canvasClose();
    }
  });

  els.modalRoot.querySelector('.modal-backdrop').addEventListener('click', () => {
    if (modalDismissible) dismissModal();
  });

  // Put the caret in the terminal when the player clicks the empty area of the log.
  els.terminalLog.addEventListener('pointerdown', (event) => {
    if (event.target === els.terminalLog && !modalOpen && !canvasOpen) {
      window.setTimeout(() => els.terminalInput.focus({ preventScroll: true }), 0);
    }
  });

  return {
    log,
    clearTerminal,
    setRoom,
    setPrompt,
    setTrial,
    showBanner,
    showToast,
    flashDeath,
    setSound,
    setTerminalState,
    setCanvasData,
    openCanvas,
    closeCanvas,
    isCanvasOpen: () => canvasOpen,
    isPaused,
    showModal,
    hideModal,
    dismissModal,
    addCanvasLog,
    clearCanvasLog,
    focusTerminal: () => els.terminalInput.focus({ preventScroll: true }),
    isTypingTarget: (target) => Boolean(target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)),
    canvasElements: () => currentElements,
    palette: () => currentPalette,
    stageElement: els.stage,
    modalRoot: els.modalRoot,
  };
}

export { SVG_NS };
