import { t, pick, translateDocument } from './east-i18n.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

function svgNode(tag, attrs = {}) {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, String(value));
  return node;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function toneToSource(tone) {
  if (tone === 'good') return 'action';
  if (['command', 'terminal', 'system', 'world', 'action', 'error', 'echo'].includes(tone)) return tone;
  return 'world';
}

function formatTime(seconds) {
  const value = Math.max(0, Number(seconds) || 0);
  const minutes = Math.floor(value / 60);
  const rest = Math.floor(value % 60);
  return `${minutes}:${String(rest).padStart(2, '0')}`;
}

export function createUI({ itemDefs, callbacks, keyboardRows = [], keyActions = {}, musicTracks = [] }) {
  const els = {
    stage: document.getElementById('stage'),
    stageWrap: document.getElementById('stage-wrap'),
    sound: document.getElementById('btn-sound'),
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
    terminalSuggest: document.getElementById('terminal-suggest'),
    canvasButton: document.getElementById('btn-canvas'),
    storyButton: document.getElementById('btn-story'),
    settingsButton: document.getElementById('btn-settings'),
    canvasScreen: document.getElementById('canvas-screen'),
    canvasExit: document.getElementById('canvas-exit'),
    canvasLink: document.getElementById('canvas-link'),
    palette: document.getElementById('canvas-palette'),
    board: document.getElementById('canvas-board'),
    canvasWorld: document.getElementById('canvas-world'),
    canvasLinks: document.getElementById('canvas-links'),
    boardElements: document.getElementById('canvas-elements'),
    canvasEmpty: document.getElementById('canvas-empty'),
    canvasLog: document.getElementById('canvas-log'),
    canvasQuickForm: document.getElementById('canvas-quick-form'),
    canvasQuickInput: document.getElementById('canvas-quick-input'),
    canvasClear: document.getElementById('canvas-clear'),
    canvasZoomIn: document.getElementById('canvas-zoom-in'),
    canvasZoomOut: document.getElementById('canvas-zoom-out'),
    canvasZoomReset: document.getElementById('canvas-zoom-reset'),
    canvasZoomLabel: document.getElementById('canvas-zoom-label'),
    canvasKeyboard: document.getElementById('canvas-keyboard'),
    canvasWalkSeconds: document.getElementById('canvas-walk-seconds'),
    canvasCursorControl: document.getElementById('canvas-cursor-control'),
    settingsScreen: document.getElementById('settings-screen'),
    settingsClose: document.getElementById('settings-close'),
    settingsTerminal: document.getElementById('settings-terminal'),
    settingsTerminalRoute: document.getElementById('settings-terminal-route'),
    settingsCanvas: document.getElementById('settings-canvas'),
    settingsStory: document.getElementById('settings-story'),
    settingsReset: document.getElementById('settings-reset'),
    settingAutocomplete: document.getElementById('setting-autocomplete'),
    settingsLogSources: document.getElementById('settings-log-sources'),
    settingsWalkSeconds: document.getElementById('settings-walk-seconds'),
    settingsCursorControl: document.getElementById('settings-cursor-control'),
    settingsAspect: document.getElementById('settings-aspect'),
    settingsAspectState: document.getElementById('settings-aspect-state'),
    musicTrack: document.getElementById('music-track'),
    musicPlay: document.getElementById('music-play'),
    musicPause: document.getElementById('music-pause'),
    musicStop: document.getElementById('music-stop'),
    musicSeek: document.getElementById('music-seek'),
    musicTime: document.getElementById('music-time'),
    musicVolume: document.getElementById('music-volume'),
    langRu: document.getElementById('lang-ru'),
    langEn: document.getElementById('lang-en'),
    settingsSave: document.getElementById('settings-save'),
    settingsLoad: document.getElementById('settings-load'),
    settingsExport: document.getElementById('settings-export'),
    settingsImport: document.getElementById('settings-import'),
    worldImport: document.getElementById('world-import'),
    settingsStatus: document.getElementById('settings-status'),
    storyScreen: document.getElementById('story-screen'),
    storyExit: document.getElementById('story-exit'),
    storyBoard: document.getElementById('story-board'),
    storyLinks: document.getElementById('story-links'),
    storyNodes: document.getElementById('story-nodes'),
    storyLegend: document.getElementById('story-legend'),
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
  let settingsOpen = false;
  let storyOpen = false;
  let modalOpen = false;
  let modalDismissible = false;
  let modalDismissHandler = null;
  let toastTimer = 0;
  let bannerTimer = 0;
  let paletteDrag = null;
  let boardDrag = null;
  let boardPan = null;
  let lastTrialActive = false;
  let currentPalette = [];
  let currentElements = [];
  let currentLinks = [];
  let currentSettings = null;
  let currentState = null;
  let currentRoom = null;
  let lastStory = null;
  let musicSnapshot = null;
  let aspect = { ratio: 0.5625, ok: true, label: '9:16' };
  let linkMode = false;
  let linkSource = null;
  let suggestions = [];
  let suggestionIndex = -1;
  let history = [];
  let historyIndex = -1;
  let historyDraft = '';
  let pressedTimers = new Map();

  const view = { x: 0, y: 0, zoom: 1 };

  // ---------------------------------------------------------------------------
  // Logging

  function sourceAllowed(tone, options = {}) {
    if (options.force) return true;
    const source = toneToSource(tone);
    return currentSettings?.logSources?.[source] !== false;
  }

  function appendLog(container, text, tone = 'world', options = {}) {
    if (!container || !sourceAllowed(tone, options)) return;
    const source = toneToSource(tone);
    const node = element('p', `log-line ${tone || 'world'}`);
    node.dataset.source = source;
    const label = element('span', 'log-source', t(`log.source.${source}`));
    const body = element('span', 'log-text', pick(text));
    node.append(label, body);
    container.appendChild(node);
    while (container.children.length > 180) container.removeChild(container.firstChild);
    container.scrollTop = container.scrollHeight;
  }

  function log(text, tone = 'world', options = {}) {
    appendLog(els.terminalLog, text, tone, options);
    if (canvasOpen && options.canvas !== false) appendLog(els.canvasLog, text, tone, options);
  }

  function clearTerminal() {
    els.terminalLog.replaceChildren();
  }

  // ---------------------------------------------------------------------------
  // Room, inventory, prompt

  function renderInventory(state, room) {
    els.inventory.replaceChildren();
    const empty = element('span', 'inv-empty', t('hud.inventoryEmpty'));
    if (!state || state.inventory.length === 0) {
      els.inventory.appendChild(empty);
    } else {
      for (const itemId of state.inventory) {
        const item = itemDefs[itemId];
        if (!item) continue;
        const chip = element('span', `inv-chip${item.card ? ' card' : ''}`);
        chip.textContent = `${item.icon || '·'} ${pick(item.title)}`;
        els.inventory.appendChild(chip);
      }
    }

    const packs = state?.packs?.filter((pack) => pack.roomId === room?.id).length || 0;
    els.packBadge.hidden = packs === 0;
    if (packs > 0) {
      els.packBadge.replaceChildren();
      els.packBadge.append('▣ ');
      const strong = element('b', null, String(packs));
      els.packBadge.append(strong);
      els.packBadge.title = t('hud.packTitle', { count: packs });
    }
  }

  function setRoom(state, room, options = {}) {
    if (!room) return;
    currentState = state;
    currentRoom = room;
    const title = pick(room.title) || t('room.fallback');
    const subtitle = pick(room.subtitle);
    els.roomTitle.textContent = title;
    els.roomSubtitle.textContent = subtitle;
    const depth = Number.isFinite(room.depth) ? room.depth + 1 : 0;
    els.roomKicker.textContent = t('room.kicker', { n: depth, subtitle: subtitle || t('banner.enter') });
    renderInventory(state, room);

    if (options.banner) {
      els.bannerKicker.textContent = t('banner.round', { n: depth });
      els.bannerTitle.textContent = title;
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
    els.promptText.textContent = pick(text);
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
    els.bannerKicker.textContent = pick(kicker) || '';
    els.bannerTitle.textContent = pick(title) || '';
    els.banner.hidden = true;
    void els.banner.offsetWidth;
    els.banner.hidden = false;
    clearTimeout(bannerTimer);
    bannerTimer = window.setTimeout(() => {
      els.banner.hidden = true;
    }, 2450);
  }

  function showToast(text, options = {}) {
    els.toast.textContent = pick(text);
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
    els.sound.textContent = enabled ? t('sound.on') : t('sound.off');
    els.sound.setAttribute('aria-pressed', String(enabled));
  }

  function setTerminalState(text) {
    if (text) els.terminalState.textContent = pick(text);
  }

  // ---------------------------------------------------------------------------
  // Settings and aspect

  function setSettings(settings) {
    currentSettings = settings;
    if (!settings) return;
    if (els.settingAutocomplete) els.settingAutocomplete.checked = settings.autocomplete !== false;
    if (els.settingsWalkSeconds) els.settingsWalkSeconds.value = String(settings.walkSeconds ?? 1);
    if (els.settingsCursorControl) els.settingsCursorControl.checked = settings.cursorControl !== false;
    if (els.canvasWalkSeconds) els.canvasWalkSeconds.value = String(settings.walkSeconds ?? 1);
    if (els.canvasCursorControl) els.canvasCursorControl.checked = settings.cursorControl !== false;
    renderLogSources(settings);
    if (els.langRu) els.langRu.classList.toggle('active', settings.language !== 'en');
    if (els.langEn) els.langEn.classList.toggle('active', settings.language === 'en');
    if (els.musicVolume) els.musicVolume.value = String(Math.round((settings.musicVolume ?? 0.8) * 100));
  }

  function renderLogSources(settings) {
    if (!els.settingsLogSources) return;
    if (els.settingsLogSources.dataset.built === '1') {
      for (const input of els.settingsLogSources.querySelectorAll('input[data-source]')) {
        input.checked = settings.logSources?.[input.dataset.source] !== false;
      }
      return;
    }
    els.settingsLogSources.dataset.built = '1';
    els.settingsLogSources.replaceChildren();
    const labels = {
      command: 'settings.log.commands',
      terminal: 'settings.log.terminal',
      system: 'settings.log.system',
      world: 'settings.log.world',
      action: 'settings.log.actions',
      error: 'settings.log.errors',
      echo: 'settings.log.echo',
    };
    for (const [source, key] of Object.entries(labels)) {
      const label = element('label', 'check-item');
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.dataset.source = source;
      input.checked = settings.logSources?.[source] !== false;
      input.addEventListener('change', () => {
        const next = { ...(currentSettings.logSources || {}) };
        next[source] = input.checked;
        callbacks.settingsChange({ logSources: next });
      });
      label.append(input, element('span', null, t(key)));
      els.settingsLogSources.appendChild(label);
    }
  }

  function renderAspect() {
    if (!aspect) return;
    if (els.settingsAspect) {
      els.settingsAspect.textContent = t('settings.screen.current', { ratio: aspect.label });
      els.settingsAspect.dataset.ok = String(aspect.ok);
    }
    if (els.settingsAspectState) {
      els.settingsAspectState.textContent = aspect.ok ? t('settings.screen.ok') : t('settings.screen.warn');
      els.settingsAspectState.dataset.ok = String(aspect.ok);
    }
  }

  function setAspect(next) {
    aspect = next;
    renderAspect();
  }

  // ---------------------------------------------------------------------------
  // Music player

  function setMusic(snapshot) {
    musicSnapshot = snapshot;
    if (!els.musicTrack) return;
    if (els.musicTrack.options.length !== musicTracks.length) {
      els.musicTrack.replaceChildren();
      for (const track of musicTracks) {
        const option = document.createElement('option');
        option.value = track.id;
        els.musicTrack.appendChild(option);
      }
    }
    for (const option of els.musicTrack.options) {
      const track = musicTracks.find((entry) => entry.id === option.value);
      option.textContent = track ? pick(track.title) : option.value;
    }
    if (snapshot?.id) els.musicTrack.value = snapshot.id;
    els.musicPlay.disabled = !snapshot?.enabled;
    els.musicPause.disabled = !snapshot?.playing;
    els.musicStop.disabled = !snapshot?.id;
    const duration = Number.isFinite(snapshot?.duration) ? snapshot.duration : 0;
    els.musicSeek.max = String(Math.max(1, duration));
    els.musicSeek.value = String(Math.min(duration || 0, snapshot?.currentTime || 0));
    els.musicSeek.disabled = !duration;
    els.musicTime.textContent = `${formatTime(snapshot?.currentTime || 0)} / ${formatTime(duration)}`;
    if (document.activeElement !== els.musicVolume) {
      els.musicVolume.value = String(Math.round((snapshot?.volume ?? 0.8) * 100));
    }
  }

  function setSettingsStatus(text) {
    if (els.settingsStatus) els.settingsStatus.textContent = pick(text);
  }

  // ---------------------------------------------------------------------------
  // Terminal history and autocomplete

  function recordHistory(value) {
    const text = String(value || '').trim();
    if (!text) return;
    if (history[history.length - 1] !== text) history.push(text);
    while (history.length > 80) history.shift();
    historyIndex = -1;
    historyDraft = '';
  }

  function getHistory() {
    return [...history];
  }

  function clearHistory() {
    history = [];
    historyIndex = -1;
  }

  function renderSuggestions() {
    if (!els.terminalSuggest) return;
    els.terminalSuggest.replaceChildren();
    if (!currentSettings?.autocomplete || !suggestions.length) {
      els.terminalSuggest.hidden = true;
      return;
    }
    suggestionIndex = clamp(suggestionIndex, -1, suggestions.length - 1);
    suggestions.forEach((entry, index) => {
      const button = element('button', `suggest-item${index === suggestionIndex ? ' active' : ''}`);
      button.type = 'button';
      button.append(
        element('strong', null, entry.label || entry.value),
        element('span', null, entry.hint || entry.value),
      );
      button.addEventListener('pointerdown', (event) => {
        event.preventDefault();
        els.terminalInput.value = entry.value;
        els.terminalSuggest.hidden = true;
        els.terminalInput.focus({ preventScroll: true });
      });
      button.addEventListener('click', () => {
        els.terminalInput.value = entry.value;
        els.terminalSuggest.hidden = true;
        els.terminalInput.focus({ preventScroll: true });
      });
      els.terminalSuggest.appendChild(button);
    });
    els.terminalSuggest.hidden = false;
  }

  function updateSuggestions() {
    const value = els.terminalInput.value;
    suggestions = value.trim() ? (callbacks.suggest?.(value) || []) : [];
    suggestionIndex = -1;
    renderSuggestions();
  }

  function acceptSuggestion() {
    if (!suggestions.length) return false;
    const index = suggestionIndex >= 0 ? suggestionIndex : 0;
    els.terminalInput.value = suggestions[index].value;
    els.terminalSuggest.hidden = true;
    suggestions = [];
    suggestionIndex = -1;
    return true;
  }

  // ---------------------------------------------------------------------------
  // Canvas palette

  function renderPalette(palette) {
    currentPalette = Array.isArray(palette) ? palette : [];
    els.palette.replaceChildren();
    if (!currentPalette.length) {
      els.palette.appendChild(element('p', 'palette-empty', t('canvas.paletteEmpty')));
      return;
    }

    for (const descriptor of currentPalette) {
      const card = descriptor.sourceType === 'card';
      const button = element('button', `palette-item${card ? ' card' : ''}`);
      button.type = 'button';
      button.dataset.key = descriptor.key || descriptor.sourceId || descriptor.id || descriptor.command;
      button.title = pick(descriptor.description) || pick(descriptor.title) || '';
      button.setAttribute('aria-label', `${t('canvas.palette')}: ${pick(descriptor.title)}`);

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
      copy.appendChild(element('strong', null, pick(descriptor.title) || descriptor.command));
      const label = descriptor.sourceType === 'command'
        ? t('canvas.labelCommand')
        : descriptor.sourceType === 'card'
          ? t('canvas.labelCard')
          : t('canvas.labelItem');
      copy.appendChild(element('small', null, label));

      const add = element('span', 'palette-add', '+');
      add.setAttribute('aria-hidden', 'true');
      button.append(icon, copy, add);

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
      copy.appendChild(element('strong', null, pick(paletteDrag.descriptor.title) || ''));
      ghost.append(icon, copy, element('span', 'palette-add', '+'));
      document.body.appendChild(ghost);
      paletteDrag.ghost = ghost;
    }
    paletteDrag.ghost.style.left = `${event.clientX}px`;
    paletteDrag.ghost.style.top = `${event.clientY}px`;
    event.preventDefault();
  }

  function boardPointFromEvent(event) {
    const rect = els.board.getBoundingClientRect();
    return {
      x: (event.clientX - rect.left - view.x) / view.zoom,
      y: (event.clientY - rect.top - view.y) / view.zoom,
    };
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
      const point = boardPointFromEvent(event);
      callbacks.canvasAdd(drag.descriptor, point.x, point.y);
    }
  }

  function cancelPaletteDrag() {
    window.removeEventListener('pointermove', movePaletteDrag);
    if (paletteDrag?.ghost) paletteDrag.ghost.remove();
    paletteDrag = null;
  }

  // ---------------------------------------------------------------------------
  // Infinite board

  function applyView() {
    if (els.canvasWorld) {
      els.canvasWorld.style.transform = `translate(${view.x}px, ${view.y}px) scale(${view.zoom})`;
    }
    if (els.canvasZoomLabel) els.canvasZoomLabel.textContent = `${Math.round(view.zoom * 100)}%`;
    renderLinks();
  }

  function setCanvasView(next) {
    view.x = Number(next?.x) || 0;
    view.y = Number(next?.y) || 0;
    view.zoom = clamp(Number(next?.zoom) || 1, 0.35, 2.6);
    applyView();
  }

  function emitView() {
    callbacks.canvasViewChange?.({ ...view });
  }

  function renderLinks() {
    if (!els.canvasLinks) return;
    els.canvasLinks.replaceChildren();
    els.canvasLinks.setAttribute('width', '1');
    els.canvasLinks.setAttribute('height', '1');
    const defs = svgNode('defs');
    const marker = svgNode('marker', {
      id: 'canvas-arrow',
      viewBox: '0 0 10 10',
      refX: '9',
      refY: '5',
      markerWidth: '6',
      markerHeight: '6',
      orient: 'auto-start-reverse',
    });
    marker.appendChild(svgNode('path', { d: 'M 0 0 L 10 5 L 0 10 z', fill: 'rgba(159, 216, 200, 0.72)' }));
    defs.appendChild(marker);
    els.canvasLinks.appendChild(defs);

    const byId = new Map(currentElements.map((item) => [item.id, item]));
    for (const link of currentLinks) {
      const from = byId.get(link.from);
      const to = byId.get(link.to);
      if (!from || !to) continue;
      const line = svgNode('line', {
        x1: from.x,
        y1: from.y,
        x2: to.x,
        y2: to.y,
        stroke: 'rgba(159, 216, 200, 0.42)',
        'stroke-width': '1.4',
        'stroke-dasharray': '5 4',
        'marker-end': 'url(#canvas-arrow)',
      });
      els.canvasLinks.appendChild(line);
      const label = svgNode('text', {
        x: (from.x + to.x) / 2,
        y: (from.y + to.y) / 2 - 4,
        fill: 'rgba(159, 216, 200, 0.68)',
        'font-size': '11',
        'font-family': 'monospace',
        'text-anchor': 'middle',
      });
      label.textContent = '->';
      els.canvasLinks.appendChild(label);
    }
  }

  function renderBoard(elements, links = []) {
    currentElements = Array.isArray(elements) ? elements : [];
    currentLinks = Array.isArray(links) ? links : [];
    els.boardElements.replaceChildren();
    els.canvasEmpty.hidden = currentElements.length > 0;

    for (const item of currentElements) {
      const card = item.sourceType === 'card';
      const key = item.sourceType === 'key';
      const node = element('div', `board-element${card ? ' card' : ''}${key ? ' key' : ''}${item.available === false ? ' unavailable' : ''}`);
      node.style.left = `${item.x}px`;
      node.style.top = `${item.y}px`;
      node.tabIndex = 0;
      node.setAttribute('role', 'button');
      node.setAttribute('aria-label', `${pick(item.title)}: ${pick(item.actionLabel)}. ${t('canvas.hint')}`);
      node.dataset.id = item.id;
      node.classList.toggle('link-source', linkSource === item.id);

      const icon = element('span', 'be-icon');
      if (item.art) {
        const image = document.createElement('img');
        image.src = item.art;
        image.alt = '';
        icon.appendChild(image);
      } else {
        icon.textContent = item.icon || '·';
      }
      const title = element('span', 'be-title', pick(item.title) || item.command || '');
      const action = element('span', 'be-action', item.available === false ? t('canvas.unavailable') : pick(item.actionLabel));
      const remove = element('button', 'be-remove', '×');
      remove.type = 'button';
      remove.title = t('canvas.removed', { title: pick(item.title) });
      remove.setAttribute('aria-label', remove.title);
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
          if (linkMode) beginLink(item.id);
          else callbacks.canvasExecute(item);
        }
      });
      els.boardElements.appendChild(node);
    }
    renderLinks();
  }

  function beginLink(id) {
    if (!linkMode) return;
    if (!linkSource) {
      linkSource = id;
      renderBoard(currentElements, currentLinks);
      addCanvasLog(t('canvas.linkMode'), 'system');
      return;
    }
    if (linkSource === id) {
      linkSource = null;
      renderBoard(currentElements, currentLinks);
      return;
    }
    callbacks.canvasLinkCreate(linkSource, id);
    linkSource = null;
    linkMode = false;
    els.canvasLink.classList.remove('active');
    renderBoard(currentElements, currentLinks);
  }

  function beginBoardDrag(event, item, node) {
    if (event.button != null && event.button !== 0) return;
    if (event.target.closest('.be-remove')) return;
    if (linkMode) {
      event.preventDefault();
      event.stopPropagation();
      beginLink(item.id);
      return;
    }
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
      lastX: item.x,
      lastY: item.y,
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
    const point = boardPointFromEvent(event);
    boardDrag.node.style.left = `${point.x}px`;
    boardDrag.node.style.top = `${point.y}px`;
    boardDrag.lastX = point.x;
    boardDrag.lastY = point.y;
    // Keep connections glued to the moving node.
    const live = currentElements.map((entry) => (
      entry.id === boardDrag.item.id ? { ...entry, x: point.x, y: point.y } : entry
    ));
    currentElements = live;
    renderLinks();
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

  function beginBoardPan(event) {
    if (event.button != null && event.button !== 0) return;
    if (event.target.closest('.board-element, .canvas-rail, .canvas-empty, .board-hint')) return;
    event.preventDefault();
    boardPan = {
      startX: event.clientX,
      startY: event.clientY,
      viewX: view.x,
      viewY: view.y,
      pointerId: event.pointerId,
    };
    els.board.classList.add('panning');
    try { els.board.setPointerCapture(event.pointerId); } catch { /* ignore */ }
    els.board.addEventListener('pointermove', moveBoardPan);
    els.board.addEventListener('pointerup', endBoardPan, { once: true });
    els.board.addEventListener('pointercancel', endBoardPan, { once: true });
  }

  function moveBoardPan(event) {
    if (!boardPan || event.pointerId !== boardPan.pointerId) return;
    view.x = boardPan.viewX + (event.clientX - boardPan.startX);
    view.y = boardPan.viewY + (event.clientY - boardPan.startY);
    applyView();
    event.preventDefault();
  }

  function endBoardPan(event) {
    if (!boardPan) return;
    els.board.classList.remove('panning');
    els.board.removeEventListener('pointermove', moveBoardPan);
    if (event.pointerId != null && event.pointerId !== boardPan.pointerId) return;
    boardPan = null;
    emitView();
  }

  function zoomBy(factor, clientX = null, clientY = null) {
    const rect = els.board.getBoundingClientRect();
    const px = clientX == null ? rect.width / 2 : clientX - rect.left;
    const py = clientY == null ? rect.height / 2 : clientY - rect.top;
    const worldX = (px - view.x) / view.zoom;
    const worldY = (py - view.y) / view.zoom;
    view.zoom = clamp(view.zoom * factor, 0.35, 2.6);
    view.x = px - worldX * view.zoom;
    view.y = py - worldY * view.zoom;
    applyView();
    emitView();
  }

  function setCanvasData(state, palette) {
    if (state?.canvas?.view) setCanvasView(state.canvas.view);
    renderPalette(palette);
    const elements = (state?.canvas?.elements || []).map((item) => {
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
    renderBoard(elements, state?.canvas?.links || []);
  }

  function setLinkMode(active) {
    linkMode = Boolean(active);
    linkSource = null;
    els.canvasLink.classList.toggle('active', linkMode);
    addCanvasLog(linkMode ? t('canvas.linkMode') : t('canvas.linkCancel'), 'system');
    renderBoard(currentElements, currentLinks);
  }

  function buildKeyboard() {
    if (!els.canvasKeyboard) return;
    els.canvasKeyboard.replaceChildren();
    for (const row of keyboardRows) {
      const rowNode = element('div', 'keyboard-row');
      for (const key of row) {
        const button = element('button', 'key-btn', key.label);
        button.type = 'button';
        const action = keyActions[key.code];
        button.title = action ? t(action.labelKey) : key.label;
        button.dataset.code = key.code;
        button.addEventListener('pointerdown', (event) => {
          event.preventDefault();
          pressKey(key.code);
        });
        rowNode.appendChild(button);
      }
      els.canvasKeyboard.appendChild(rowNode);
    }
  }

  function pressKey(code) {
    const button = els.canvasKeyboard?.querySelector(`[data-code="${code}"]`);
    if (button) {
      button.classList.add('pressed');
      clearTimeout(pressedTimers.get(code));
      pressedTimers.set(code, window.setTimeout(() => button.classList.remove('pressed'), 140));
    }
    callbacks.canvasAddKey?.(code);
  }

  // ---------------------------------------------------------------------------
  // Screens

  function openCanvas() {
    closeSettingsInternal();
    closeStoryInternal();
    canvasOpen = true;
    els.canvasScreen.hidden = false;
    els.terminalState.textContent = t('terminal.state.canvas');
    applyView();
    window.setTimeout(() => {
      if (canvasOpen) els.canvasExit.focus({ preventScroll: true });
    }, 40);
  }

  function closeCanvas() {
    if (!canvasOpen) return;
    canvasOpen = false;
    els.canvasScreen.hidden = true;
    els.terminalState.textContent = t('terminal.state.open');
    if (!modalOpen) els.terminalInput.focus({ preventScroll: true });
  }

  function openSettings() {
    closeCanvasInternal();
    closeStoryInternal();
    settingsOpen = true;
    els.settingsScreen.hidden = false;
    els.terminalState.textContent = t('terminal.state.settings');
    translateDocument(document);
    renderAspect();
    setSettings(currentSettings);
    window.setTimeout(() => {
      if (settingsOpen) els.settingsClose.focus({ preventScroll: true });
    }, 40);
  }

  function closeSettingsInternal() {
    settingsOpen = false;
    if (els.settingsScreen) els.settingsScreen.hidden = true;
  }

  function closeSettings() {
    if (!settingsOpen) return;
    closeSettingsInternal();
    els.terminalState.textContent = t('terminal.state.open');
    if (!modalOpen) els.terminalInput.focus({ preventScroll: true });
  }

  function openStory(story) {
    closeCanvasInternal();
    closeSettingsInternal();
    lastStory = story;
    storyOpen = true;
    els.storyScreen.hidden = false;
    els.terminalState.textContent = t('terminal.state.story');
    renderStory(story);
    window.setTimeout(() => {
      if (storyOpen) els.storyExit.focus({ preventScroll: true });
    }, 40);
  }

  function closeStoryInternal() {
    storyOpen = false;
    if (els.storyScreen) els.storyScreen.hidden = true;
  }

  function closeStory() {
    if (!storyOpen) return;
    closeStoryInternal();
    els.terminalState.textContent = t('terminal.state.open');
    if (!modalOpen) els.terminalInput.focus({ preventScroll: true });
  }

  function closeCanvasInternal() {
    if (!canvasOpen) return;
    canvasOpen = false;
    els.canvasScreen.hidden = true;
  }

  function isPaused() {
    return modalOpen || canvasOpen || settingsOpen || storyOpen;
  }

  // ---------------------------------------------------------------------------
  // Story table

  const STORY_W = 760;
  const STORY_H = 520;

  function renderStory(story) {
    if (!story || !els.storyNodes) return;
    const nodes = story.nodes || [];
    const edges = story.edges || [];
    const byId = new Map(nodes.map((node) => [node.id, node]));
    els.storyNodes.replaceChildren();
    els.storyLinks.replaceChildren();
    els.storyLinks.setAttribute('viewBox', `0 0 ${STORY_W} ${STORY_H}`);
    els.storyLinks.setAttribute('width', String(STORY_W));
    els.storyLinks.setAttribute('height', String(STORY_H));

    const defs = svgNode('defs');
    const marker = svgNode('marker', {
      id: 'story-arrow',
      viewBox: '0 0 10 10',
      refX: '9',
      refY: '5',
      markerWidth: '7',
      markerHeight: '7',
      orient: 'auto-start-reverse',
    });
    marker.appendChild(svgNode('path', {
      d: 'M 0 0 L 10 5 L 0 10 z',
      fill: 'rgba(227, 194, 139, 0.74)',
    }));
    defs.appendChild(marker);
    els.storyLinks.appendChild(defs);

    for (const [fromId, toId] of edges) {
      const from = byId.get(fromId);
      const to = byId.get(toId);
      if (!from || !to) continue;
      const x1 = (from.x / 100) * STORY_W;
      const y1 = (from.y / 100) * STORY_H;
      const x2 = (to.x / 100) * STORY_W;
      const y2 = (to.y / 100) * STORY_H;
      const line = svgNode('line', {
        x1, y1, x2, y2,
        stroke: 'rgba(227, 194, 139, 0.38)',
        'stroke-width': '1.5',
        'stroke-dasharray': '6 5',
        'marker-end': 'url(#story-arrow)',
      });
      els.storyLinks.appendChild(line);
      const label = svgNode('text', {
        x: (x1 + x2) / 2,
        y: (y1 + y2) / 2 - 5,
        fill: 'rgba(227, 194, 139, 0.7)',
        'font-size': '12',
        'font-family': 'monospace',
        'text-anchor': 'middle',
      });
      label.textContent = '->';
      els.storyLinks.appendChild(label);
    }

    for (const node of nodes) {
      const nodeEl = element('article', `story-node${node.locked ? ' locked' : ''}${node.current ? ' current' : ''}`);
      nodeEl.style.left = `${(node.x / 100) * STORY_W}px`;
      nodeEl.style.top = `${(node.y / 100) * STORY_H}px`;
      nodeEl.appendChild(element('span', 'story-node-kind', node.current ? t('story.current') : node.locked ? t('story.locked') : ''));
      nodeEl.appendChild(element('strong', null, pick(node.title)));
      nodeEl.appendChild(element('p', null, pick(node.copy)));
      els.storyNodes.appendChild(nodeEl);
    }
  }

  // ---------------------------------------------------------------------------
  // Modal

  function showModal(config) {
    modalOpen = true;
    modalDismissible = Boolean(config.dismissible);
    modalDismissHandler = config.onDismiss || null;
    els.modalKicker.textContent = pick(config.kicker);
    els.modalTitle.textContent = pick(config.title);
    els.modalCopy.replaceChildren();
    for (const paragraph of config.paragraphs || []) {
      els.modalCopy.appendChild(element('p', null, pick(paragraph)));
    }
    els.modalNote.textContent = pick(config.note);
    els.modalNote.hidden = !config.note;
    els.modalArt.hidden = !config.art;
    if (config.art) {
      els.modalImage.src = config.art;
      if (config.artAlt) els.modalImage.alt = pick(config.artAlt);
    }
    els.modalActions.replaceChildren();

    for (const button of config.buttons || []) {
      const node = element('button', `modal-btn${button.variant ? ` ${button.variant}` : ''}`, pick(button.label));
      node.type = 'button';
      node.addEventListener('click', () => {
        hideModal();
        if (typeof button.onClick === 'function') button.onClick();
      });
      els.modalActions.appendChild(node);
    }

    if (!els.modalActions.children.length) {
      const node = element('button', 'modal-btn primary', t('settings.close'));
      node.type = 'button';
      node.addEventListener('click', hideModal);
      els.modalActions.appendChild(node);
    }

    els.modalRoot.hidden = false;
    els.terminalState.textContent = t('terminal.state.attention');
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
    els.terminalState.textContent = canvasOpen
      ? t('terminal.state.canvas')
      : settingsOpen
        ? t('terminal.state.settings')
        : storyOpen
          ? t('terminal.state.story')
          : t('terminal.state.open');
    if (!isPaused()) els.terminalInput.focus({ preventScroll: true });
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

  // ---------------------------------------------------------------------------
  // Refresh for language switches

  function refreshAll(state, room, palette, settings) {
    translateDocument(document);
    if (els.settingsLogSources) {
      els.settingsLogSources.dataset.built = '';
      els.settingsLogSources.replaceChildren();
    }
    setSettings(settings || currentSettings);
    if (room) setRoom(state, room);
    if (state && palette) setCanvasData(state, palette);
    if (lastStory && storyOpen) renderStory(lastStory);
    if (musicSnapshot) setMusic(musicSnapshot);
  }

  // ---------------------------------------------------------------------------
  // Events

  els.terminalForm.addEventListener('submit', (event) => {
    event.preventDefault();
    if (modalOpen) return;
    const value = els.terminalInput.value.trim();
    if (!value) return;
    els.terminalInput.value = '';
    els.terminalSuggest.hidden = true;
    recordHistory(value);
    callbacks.command(value, 'terminal');
  });

  els.terminalInput.addEventListener('input', updateSuggestions);
  els.terminalInput.addEventListener('focus', updateSuggestions);
  els.terminalInput.addEventListener('blur', () => {
    window.setTimeout(() => { els.terminalSuggest.hidden = true; }, 120);
  });
  els.terminalInput.addEventListener('keydown', (event) => {
    if (event.key === 'Tab') {
      if (acceptSuggestion()) {
        event.preventDefault();
        return;
      }
    }
    if (event.key === 'ArrowDown') {
      if (!els.terminalSuggest.hidden && suggestions.length) {
        event.preventDefault();
        suggestionIndex = Math.min(suggestions.length - 1, suggestionIndex + 1);
        renderSuggestions();
        return;
      }
      event.preventDefault();
      if (!history.length) return;
      if (historyIndex < 0) historyDraft = els.terminalInput.value;
      historyIndex = Math.min(history.length - 1, historyIndex + 1);
      els.terminalInput.value = history[history.length - 1 - historyIndex] || '';
      return;
    }
    if (event.key === 'ArrowUp') {
      if (!els.terminalSuggest.hidden && suggestions.length) {
        event.preventDefault();
        suggestionIndex = Math.max(-1, suggestionIndex - 1);
        renderSuggestions();
        return;
      }
      event.preventDefault();
      if (!history.length) return;
      if (historyIndex < 0) historyDraft = els.terminalInput.value;
      historyIndex = Math.min(history.length - 1, historyIndex + 1);
      els.terminalInput.value = history[history.length - 1 - historyIndex] || '';
      return;
    }
    if (event.key === 'Escape') {
      els.terminalSuggest.hidden = true;
      suggestions = [];
      suggestionIndex = -1;
      if (historyIndex >= 0) {
        els.terminalInput.value = historyDraft;
        historyIndex = -1;
      }
    }
  });

  for (const chip of document.querySelectorAll('.quick-row .chip')) {
    chip.addEventListener('click', () => {
      if (modalOpen) return;
      callbacks.command(chip.dataset.command, 'terminal');
      els.terminalInput.focus({ preventScroll: true });
    });
  }

  els.canvasButton?.addEventListener('click', () => callbacks.canvasOpen());
  els.storyButton?.addEventListener('click', () => callbacks.storyOpen());
  els.settingsButton?.addEventListener('click', () => callbacks.settingsOpen());
  els.canvasExit.addEventListener('click', () => callbacks.canvasClose());
  els.canvasClear.addEventListener('click', () => callbacks.canvasClear());
  els.canvasLink.addEventListener('click', () => setLinkMode(!linkMode));
  els.canvasZoomIn.addEventListener('click', () => zoomBy(1.18));
  els.canvasZoomOut.addEventListener('click', () => zoomBy(1 / 1.18));
  els.canvasZoomReset.addEventListener('click', () => {
    view.x = 0;
    view.y = 0;
    view.zoom = 1;
    applyView();
    emitView();
  });

  els.canvasQuickForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const value = els.canvasQuickInput.value.trim();
    if (!value) return;
    els.canvasQuickInput.value = '';
    callbacks.canvasQuick(value);
  });

  els.board.addEventListener('pointerdown', beginBoardPan);
  els.board.addEventListener('wheel', (event) => {
    event.preventDefault();
    zoomBy(event.deltaY < 0 ? 1.1 : 1 / 1.1, event.clientX, event.clientY);
  }, { passive: false });

  els.sound.addEventListener('click', () => callbacks.soundToggle());
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

  // Cursor-controlled walking on the stage.
  let cursorDown = false;
  els.stage.addEventListener('pointerdown', (event) => {
    if (event.button != null && event.button !== 0) return;
    if (isPaused()) return;
    cursorDown = true;
    try { els.stage.setPointerCapture(event.pointerId); } catch { /* ignore */ }
    callbacks.cursorDown?.(event.clientX, event.clientY);
  });
  els.stage.addEventListener('pointermove', (event) => {
    if (!cursorDown) return;
    callbacks.cursorMove?.(event.clientX, event.clientY);
  });
  const releaseCursor = (event) => {
    if (!cursorDown) return;
    cursorDown = false;
    callbacks.cursorUp?.(event.clientX, event.clientY);
  };
  els.stage.addEventListener('pointerup', releaseCursor);
  els.stage.addEventListener('pointercancel', releaseCursor);

  // Canvas keyboard listener for physical keys while the board is open.
  window.addEventListener('keydown', (event) => {
    if (!canvasOpen || modalOpen) return;
    const typing = event.target && (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA' || event.target.isContentEditable);
    if (typing) return;
    if (keyActions[event.code]) {
      event.preventDefault();
      pressKey(event.code);
    }
  });

  // Settings controls.
  els.settingsClose?.addEventListener('click', () => callbacks.settingsClose());
  els.settingsTerminal?.addEventListener('click', () => callbacks.settingsClose());
  els.settingsTerminalRoute?.addEventListener('click', () => callbacks.settingsClose());
  els.settingsCanvas?.addEventListener('click', () => callbacks.settingsOpenCanvas?.());
  els.settingsStory?.addEventListener('click', () => callbacks.settingsOpenStory?.());
  els.storyExit?.addEventListener('click', () => callbacks.storyClose());

  els.settingAutocomplete?.addEventListener('change', () => {
    callbacks.settingsChange({ autocomplete: els.settingAutocomplete.checked });
  });
  els.settingsWalkSeconds?.addEventListener('input', () => {
    callbacks.settingsChange({ walkSeconds: Number(els.settingsWalkSeconds.value) });
  });
  els.settingsCursorControl?.addEventListener('change', () => {
    callbacks.settingsChange({ cursorControl: els.settingsCursorControl.checked });
  });
  els.canvasWalkSeconds?.addEventListener('input', () => {
    callbacks.settingsChange({ walkSeconds: Number(els.canvasWalkSeconds.value) });
  });
  els.canvasCursorControl?.addEventListener('change', () => {
    callbacks.settingsChange({ cursorControl: els.canvasCursorControl.checked });
  });
  els.langRu?.addEventListener('click', () => callbacks.languageChange('ru'));
  els.langEn?.addEventListener('click', () => callbacks.languageChange('en'));

  els.musicPlay?.addEventListener('click', () => callbacks.musicAction('play'));
  els.musicPause?.addEventListener('click', () => callbacks.musicAction('pause'));
  els.musicStop?.addEventListener('click', () => callbacks.musicAction('stop'));
  els.musicTrack?.addEventListener('change', () => callbacks.musicAction('track', els.musicTrack.value));
  els.musicSeek?.addEventListener('change', () => callbacks.musicAction('seek', Number(els.musicSeek.value)));
  els.musicVolume?.addEventListener('input', () => callbacks.musicAction('volume', Number(els.musicVolume.value) / 100));

  els.settingsSave?.addEventListener('click', () => callbacks.saveAction('save'));
  els.settingsLoad?.addEventListener('click', () => callbacks.saveAction('load'));
  els.settingsExport?.addEventListener('click', () => callbacks.saveAction('export'));
  els.settingsImport?.addEventListener('click', () => els.worldImport?.click());
  els.settingsReset?.addEventListener('click', () => callbacks.saveAction('reset'));
  els.worldImport?.addEventListener('change', () => {
    const file = els.worldImport.files?.[0];
    els.worldImport.value = '';
    if (file) callbacks.saveAction('import', file);
  });

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
      return;
    }
    if (settingsOpen) {
      event.preventDefault();
      callbacks.settingsClose();
      return;
    }
    if (storyOpen) {
      event.preventDefault();
      callbacks.storyClose();
    }
  });

  els.modalRoot.querySelector('.modal-backdrop').addEventListener('click', () => {
    if (modalDismissible) dismissModal();
  });

  els.terminalLog.addEventListener('pointerdown', (event) => {
    if (event.target === els.terminalLog && !isPaused()) {
      window.setTimeout(() => els.terminalInput.focus({ preventScroll: true }), 0);
    }
  });

  buildKeyboard();
  setSettings(currentSettings);

  // Keep the music seek/time indicators fresh while settings is open.
  window.setInterval(() => {
    if (!settingsOpen || !callbacks.musicSnapshot) return;
    const snapshot = callbacks.musicSnapshot();
    if (snapshot) setMusic(snapshot);
  }, 500);

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
    setSettings,
    setMusic,
    setAspect,
    setSettingsStatus,
    setCanvasData,
    setCanvasView,
    openCanvas,
    closeCanvas,
    isCanvasOpen: () => canvasOpen,
    openSettings,
    closeSettings,
    isSettingsOpen: () => settingsOpen,
    openStory,
    closeStory,
    isStoryOpen: () => storyOpen,
    isPaused,
    showModal,
    hideModal,
    dismissModal,
    addCanvasLog,
    clearCanvasLog,
    recordHistory,
    getHistory,
    clearHistory,
    refreshAll,
    focusTerminal: () => els.terminalInput.focus({ preventScroll: true }),
    isTypingTarget: (target) => Boolean(target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)),
    canvasElements: () => currentElements,
    canvasCenter: () => {
      const rect = els.board.getBoundingClientRect();
      return {
        x: (rect.width / 2 - view.x) / view.zoom,
        y: (rect.height / 2 - view.y) / view.zoom,
      };
    },
    palette: () => currentPalette,
    stageElement: els.stage,
    modalRoot: els.modalRoot,
    pressKey,
  };
}

export { SVG_NS };
