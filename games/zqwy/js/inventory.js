/* Инвентарь: граф предметов и связей, а не список.
   Узлы можно перетаскивать; связи показывают, что с чем связано.
   Рюкзак — такой же предмет, но его slotBonus расширяет инвентарь.
   Кассеты живут внутри проигрывателя: это отдельный уровень
   иерархии inventory -> player -> cassette, а не отдельные ячейки. */
(function () {
  'use strict';

  const ZQ = window.ZQ;
  const C = ZQ.C;
  const rt = ZQ.rt;
  const dom = ZQ.dom;

  function cassetteIds() {
    if (!rt.state) return [];
    const tracks = C.music && C.music.tracks ? C.music.tracks : {};
    const result = [];
    for (const trackId of rt.state.cassettes || []) {
      const track = tracks[trackId];
      if (track && track.cassette && C.items[track.cassette] &&
          !result.includes(track.cassette)) {
        result.push(track.cassette);
      }
    }
    return result;
  }

  function graphIds() {
    if (!rt.state) return [];
    return rt.state.items
      .filter((id) => C.items[id])
      .concat(cassetteIds().filter((id) => !rt.state.items.includes(id)));
  }

  function presentId(id) {
    return graphIds().includes(id);
  }

  function selectedId() {
    const id = rt.inventorySelected;
    if (!id) return null;
    return presentId(id) ? id : null;
  }

  function ensurePositions(ids) {
    const positions = rt.inventoryPositions;
    if (!positions) {
      rt.inventoryPositions = Object.create(null);
      return ensurePositions(ids);
    }
    const missing = ids.filter((id) => !positions[id]);
    if (!missing.length) return;
    const items = rt.state.items.filter((id) => C.items[id]);
    const total = Math.max(ids.length, 1);
    for (const id of missing) {
      /* Кассеты раскладываются вокруг проигрывателя, а не по общему
         кругу: так видна иерархия «инвентарь → плеер → кассета». */
      const owner = items.includes('music_player') &&
        id !== 'music_player' && C.items[id].kind === 'cassette'
        ? positions.music_player || { nx: 0.5, ny: 0.5 }
        : null;
      const index = ids.indexOf(id);
      const angle = (index / total) * Math.PI * 2 - Math.PI / 2;
      const radius = total <= 1 ? 0 : 0.3;
      const nx = owner
        ? owner.nx + Math.cos(angle) * 0.2
        : 0.5 + Math.cos(angle) * radius;
      const ny = owner
        ? owner.ny + Math.sin(angle) * 0.16
        : 0.5 + Math.sin(angle) * radius * 0.92;
      positions[id] = {
        nx: ZQ.clamp(nx, 0.08, 0.92),
        ny: ZQ.clamp(ny, 0.1, 0.9)
      };
    }
  }

  function positionFor(id) {
    const positions = rt.inventoryPositions || {};
    return positions[id] || { nx: 0.5, ny: 0.5 };
  }

  function placeNode(node, id) {
    const pos = positionFor(id);
    node.style.left = `${(pos.nx * 100).toFixed(2)}%`;
    node.style.top = `${(pos.ny * 100).toFixed(2)}%`;
  }

  function itemThumb(item, extraClass) {
    const thumb = document.createElement('span');
    thumb.className = 'inv-node-thumb';
    if (extraClass) thumb.classList.add(extraClass);
    if (item.kind === 'card' && item.art) {
      const img = document.createElement('img');
      img.src = item.art;
      img.alt = '';
      thumb.appendChild(img);
    } else if (item.kind === 'map') {
      thumb.classList.add('map-thumb');
    } else if (item.id === 'chalk') {
      thumb.classList.add('chalk-thumb');
    } else if (item.id === 'bead') {
      thumb.classList.add('bead-thumb');
    } else if (item.id === 'backpack') {
      thumb.classList.add('backpack-thumb');
    } else if (item.id === 'umbrella') {
      thumb.classList.add('umbrella-thumb');
    } else if (item.id === 'music_player') {
      thumb.classList.add('player-thumb');
    } else if (item.kind === 'cassette') {
      thumb.classList.add('cassette-thumb');
    }
    return thumb;
  }

  function edgePairs(ids) {
    const present = new Set(ids);
    const pairs = new Map();
    const add = (from, to, label, kind) => {
      if (!present.has(from) || !present.has(to) || from === to) return;
      const key = [from, to].sort().join('|');
      if (pairs.has(key)) return;
      pairs.set(key, { from, to, label, kind });
    };
    for (const link of C.inventoryLinks || []) {
      add(link.from, link.to, link.label, 'item');
    }
    if (present.has('backpack')) {
      for (const id of ids) add('backpack', id, 'вмещает', 'container');
    }
    if (present.has('music_player')) {
      for (const id of cassetteIds()) add('music_player', id, 'кассета', 'cassette');
    }
    return Array.from(pairs.values());
  }

  function drawLinks(ids) {
    if (!dom.inventoryLinks) return;
    dom.inventoryLinks.textContent = '';
    for (const edge of edgePairs(ids)) {
      const a = positionFor(edge.from);
      const b = positionFor(edge.to);
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', (a.nx * 100).toFixed(2));
      line.setAttribute('y1', (a.ny * 100).toFixed(2));
      line.setAttribute('x2', (b.nx * 100).toFixed(2));
      line.setAttribute('y2', (b.ny * 100).toFixed(2));
      line.setAttribute('class', `inventory-link${edge.kind === 'container' ? ' container' : ''}${edge.kind === 'cassette' ? ' cassette' : ''}`);
      line.setAttribute('vector-effect', 'non-scaling-stroke');
      dom.inventoryLinks.appendChild(line);
    }
  }

  function makeButton(label, className, onClick) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = className;
    button.textContent = label;
    button.addEventListener('click', onClick);
    return button;
  }

  function renderDetail(ids) {
    if (!dom.inventoryDetail) return;
    const id = selectedId();
    dom.inventoryDetail.textContent = '';
    dom.inventoryDetail.classList.toggle('empty', !id);
    if (!id) {
      const hint = document.createElement('p');
      hint.className = 'inventory-detail-hint';
      hint.textContent = 'Выбери узел графа. Рюкзак раскрывает связи, проигрыватель — кассеты.';
      dom.inventoryDetail.appendChild(hint);
      return;
    }

    const item = C.items[id];
    if (!item) return;
    const head = document.createElement('div');
    head.className = 'inventory-detail-head';
    const title = document.createElement('strong');
    title.textContent = item.name;
    head.appendChild(title);
    const kind = document.createElement('span');
    kind.className = 'inventory-detail-kind';
    kind.textContent = item.command ? `> ${item.command}` : (item.kind || 'предмет');
    head.appendChild(kind);
    dom.inventoryDetail.appendChild(head);

    const desc = document.createElement('p');
    desc.className = 'inventory-detail-desc';
    desc.textContent = item.description || '';
    dom.inventoryDetail.appendChild(desc);

    if (item.note) {
      const note = document.createElement('p');
      note.className = 'inventory-detail-note';
      note.textContent = item.note;
      dom.inventoryDetail.appendChild(note);
    }

    if (Number.isFinite(item.slotBonus) && item.slotBonus) {
      const bonus = document.createElement('p');
      bonus.className = 'inventory-detail-bonus';
      bonus.textContent = `+${item.slotBonus} ячеек инвентаря`;
      dom.inventoryDetail.appendChild(bonus);
    }

    if (item.kind === 'player') {
      const cassettes = cassetteIds();
      const row = document.createElement('div');
      row.className = 'inventory-cassettes';
      if (!cassettes.length) {
        row.textContent = 'Внутри пока нет кассет.';
      } else {
        for (const cassetteId of cassettes) {
          const cassette = C.items[cassetteId];
          const chip = makeButton(cassette.name.replace(/^Кассета · /, ''), 'inventory-chip cassette-chip', () => {
            if (ZQ.audio && typeof ZQ.audio.playCassette === 'function') {
              ZQ.audio.playCassette(cassette.trackId);
              renderDetail(ids);
            }
          });
          if (rt.state.activeCassette === cassette.trackId) chip.classList.add('active');
          row.appendChild(chip);
        }
      }
      const label = document.createElement('span');
      label.className = 'inventory-detail-links-label';
      label.textContent = 'кассеты';
      const wrap = document.createElement('div');
      wrap.className = 'inventory-detail-links';
      wrap.appendChild(label);
      wrap.appendChild(row);
      dom.inventoryDetail.appendChild(wrap);
    }

    const connections = edgePairs(ids).filter((edge) =>
      edge.from === id || edge.to === id
    );
    if (connections.length) {
      const row = document.createElement('div');
      row.className = 'inventory-detail-links';
      const label = document.createElement('span');
      label.className = 'inventory-detail-links-label';
      label.textContent = 'связи';
      row.appendChild(label);
      for (const edge of connections) {
        const otherId = edge.from === id ? edge.to : edge.from;
        const other = C.items[otherId];
        if (!other) continue;
        const chip = document.createElement('span');
        chip.className = 'inventory-chip';
        chip.textContent = other.name;
        row.appendChild(chip);
      }
      dom.inventoryDetail.appendChild(row);
    }

    const actions = document.createElement('div');
    actions.className = 'inventory-detail-actions';

    if (item.kind === 'card' && item.art) {
      actions.appendChild(makeButton('открыть', 'inv-btn', () => {
        ZQ.openCardDetail(item.id, 'inventory');
      }));
    }

    if (item.kind === 'cassette' && ZQ.audio && typeof ZQ.audio.playCassette === 'function') {
      actions.appendChild(makeButton('включить', 'inv-btn accent', () => {
        ZQ.audio.playCassette(item.trackId);
        renderDetail(ids);
      }));
    }

    if (item.command) {
      actions.appendChild(makeButton(item.action || 'выполнить', 'inv-btn accent', () => {
        closeInventory();
        ZQ.handleCommand(item.command, 'terminal');
      }));
    }

    if (item.command || item.art) {
      actions.appendChild(makeButton('на стол', 'inv-btn', () => {
        closeInventory();
        ZQ.addItemElement(item.id, true);
      }));
    }

    if (actions.childNodes.length) dom.inventoryDetail.appendChild(actions);
  }

  function renderSlots() {
    if (!dom.inventorySlots) return;
    dom.inventorySlots.textContent = '';
    const capacity = ZQ.inventoryCapacity();
    const used = ZQ.inventoryUsed();
    const items = rt.state.items.filter((id) => C.items[id]);
    for (let index = 0; index < capacity; index += 1) {
      const slot = document.createElement('span');
      slot.className = 'inventory-slot';
      const id = items[index];
      if (id) {
        const item = C.items[id];
        slot.classList.add('filled');
        slot.dataset.item = id;
        slot.appendChild(itemThumb(item));
        slot.title = item.name;
        slot.setAttribute('aria-label', `${index + 1}: ${item.name}`);
        if (id === 'music_player') {
          slot.classList.add('has-cassettes');
          const badge = document.createElement('span');
          badge.className = 'inventory-slot-badge';
          badge.textContent = String(cassetteIds().length);
          slot.appendChild(badge);
        }
      } else {
        slot.classList.add('empty');
        slot.setAttribute('aria-label', `${index + 1}: пусто`);
      }
      const number = document.createElement('span');
      number.className = 'inventory-slot-index';
      number.textContent = String(index + 1);
      slot.appendChild(number);
      dom.inventorySlots.appendChild(slot);
    }
    if (dom.inventoryCapacity) {
      dom.inventoryCapacity.textContent = `${used} / ${capacity}`;
      dom.inventoryCapacity.classList.toggle('full', used >= capacity);
    }
  }

  function applyInventoryTransform() {
    if (!dom.inventoryStage) return;
    if (ZQ.Viewport) {
      ZQ.Viewport.applyTransform(dom.inventoryStage, {
        zoom: rt.inventoryZoom,
        panX: rt.inventoryPanX,
        panY: rt.inventoryPanY
      });
    }
    if (dom.inventoryZoomLabel) {
      dom.inventoryZoomLabel.textContent = `${Math.round(rt.inventoryZoom * 100)}%`;
    }
  }

  function setInventoryZoom(value, announce) {
    rt.inventoryZoom = ZQ.Viewport
      ? ZQ.Viewport.clampZoom(value)
      : ZQ.clamp(value, 0.18, 3.2);
    applyInventoryTransform();
    if (announce) {
      ZQ.appendLog(
        `Масштаб инвентаря: ${Math.round(rt.inventoryZoom * 100)}%.`,
        'reply',
        true
      );
    }
  }

  function resetInventoryView() {
    rt.inventoryZoom = 1;
    rt.inventoryPanX = 0;
    rt.inventoryPanY = 0;
    applyInventoryTransform();
  }

  function selectItem(id) {
    rt.inventorySelected = id;
    if (dom.inventoryNodes) {
      for (const node of dom.inventoryNodes.querySelectorAll('.inv-node')) {
        node.classList.toggle('selected', node.dataset.item === id);
      }
    }
    renderDetail(graphIds());
  }

  function bindNodeDrag(node, id) {
    node.addEventListener('pointerdown', (event) => {
      if (event.button !== undefined && event.button !== 0) return;
      event.preventDefault();
      event.stopPropagation();
      const graph = dom.inventoryGraph;
      if (!graph) return;
      const rect = graph.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const start = positionFor(id);
      const zoom = rt.inventoryZoom || 1;
      const drag = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        nx: start.nx,
        ny: start.ny,
        moved: false
      };
      try {
        node.setPointerCapture(event.pointerId);
      } catch (error) {
        /* capture не обязателен */
      }
      const move = (moveEvent) => {
        if (!drag || moveEvent.pointerId !== drag.pointerId) return;
        const dx = moveEvent.clientX - drag.startX;
        const dy = moveEvent.clientY - drag.startY;
        if (!drag.moved && Math.hypot(dx, dy) > 3) {
          drag.moved = true;
          node.classList.add('dragging');
        }
        if (!drag.moved) return;
        moveEvent.preventDefault();
        const nx = ZQ.clamp(drag.nx + dx / (rect.width * zoom), 0.06, 0.94);
        const ny = ZQ.clamp(drag.ny + dy / (rect.height * zoom), 0.08, 0.92);
        rt.inventoryPositions[id] = { nx, ny };
        placeNode(node, id);
        drawLinks(graphIds());
      };
      const finish = (finishEvent) => {
        if (finishEvent.pointerId !== drag.pointerId) return;
        node.removeEventListener('pointermove', move);
        node.removeEventListener('pointerup', finish);
        node.removeEventListener('pointercancel', finish);
        node.classList.remove('dragging');
        if (!drag.moved) selectItem(id);
        try {
          node.releasePointerCapture(finishEvent.pointerId);
        } catch (error) {
          /* ignored */
        }
      };
      node.addEventListener('pointermove', move);
      node.addEventListener('pointerup', finish);
      node.addEventListener('pointercancel', finish);
    });
  }

  function renderInventory() {
    if (!dom.inventoryNodes) return;
    const ids = graphIds();
    if (rt.inventorySelected && !ids.includes(rt.inventorySelected)) {
      rt.inventorySelected = null;
    }
    ensurePositions(ids);
    dom.inventoryNodes.textContent = '';

    if (!ids.length) {
      const empty = document.createElement('div');
      empty.className = 'inv-empty';
      empty.textContent = 'Пусто. Всё, что было, осталось на месте смерти — или ещё не найдено.';
      dom.inventoryNodes.appendChild(empty);
    }

    for (const id of ids) {
      const item = C.items[id];
      const node = document.createElement('button');
      node.type = 'button';
      node.className = 'inv-node';
      node.dataset.item = id;
      node.dataset.kind = item.kind || 'item';
      if (id === rt.inventorySelected) node.classList.add('selected');
      if ((item.kind === 'cassette')) node.classList.add('cassette');
      if (Number.isFinite(item.slotBonus) && item.slotBonus) node.classList.add('container');
      node.setAttribute('aria-label', `${item.name}. ${item.description || ''}`);

      node.appendChild(itemThumb(item));
      const copy = document.createElement('span');
      copy.className = 'inv-node-copy';
      const name = document.createElement('span');
      name.className = 'inv-node-name';
      name.textContent = item.name;
      copy.appendChild(name);
      const sub = document.createElement('span');
      sub.className = 'inv-node-sub';
      if (Number.isFinite(item.slotBonus) && item.slotBonus) {
        sub.textContent = `+${item.slotBonus} ячеек`;
      } else if (item.kind === 'player') {
        sub.textContent = `кассет: ${cassetteIds().length}`;
      } else if (item.command) {
        sub.textContent = `> ${item.command}`;
      } else {
        sub.textContent = item.kind || 'предмет';
      }
      copy.appendChild(sub);
      node.appendChild(copy);

      placeNode(node, id);
      bindNodeDrag(node, id);
      dom.inventoryNodes.appendChild(node);
    }

    renderSlots();
    drawLinks(ids);
    renderDetail(ids);
    applyInventoryTransform();

    if (dom.inventoryNote) {
      const backpacks = rt.state.backpacks.length;
      const parts = [
        'Ячейки наверху показывают занятое место. Тяни узлы, раскладывая связи.'
      ];
      if (backpacks) {
        parts.push(`В Лабиринте осталось рюкзаков: ${backpacks}. Предметы на столе остаются на месте, но недоступны, пока рюкзак не возвращён.`);
      } else {
        parts.push('Колесо и двойной клик управляют масштабом.');
      }
      dom.inventoryNote.textContent = parts.join(' ');
    }
  }

  /* Текстовая таблица — для терминала. Кассеты показаны внутри
     проигрывателя, поэтому не занимают отдельные ячейки. */
  function inventoryTable() {
    const items = rt.state.items.filter((id) => C.items[id]);
    const capacity = ZQ.inventoryCapacity();
    const lines = [];
    lines.push('┌────┬──────────────────────────────┬──────────────┬───────┐');
    lines.push('│ №  │ предмет                      │ тип          │ ячейки│');
    lines.push('├────┼──────────────────────────────┼──────────────┼───────┤');
    let index = 0;
    for (const id of items) {
      const item = C.items[id];
      index += 1;
      const name = String(item.name).slice(0, 28).padEnd(28, ' ');
      const kind = String(item.kind || 'предмет').slice(0, 12).padEnd(12, ' ');
      lines.push(`│ ${String(index).padStart(2, ' ')} │ ${name} │ ${kind} │ ${'1'.padStart(5, ' ')} │`);
      if (item.kind === 'player') {
        for (const cassetteId of cassetteIds()) {
          const cassette = C.items[cassetteId];
          const label = `  ↳ ${cassette.name.replace(/^Кассета · /, '')}`;
          lines.push(`│    │ ${label.slice(0, 28).padEnd(28, ' ')} │ кассета      │   —   │`);
        }
      }
    }
    if (!items.length) {
      lines.push('│  — │ пусто                        │ —            │   —   │');
    }
    lines.push('└────┴──────────────────────────────┴──────────────┴───────┘');
    lines.push(`Занято ${ZQ.inventoryUsed()} из ${capacity} ячеек. Кассеты хранятся в проигрывателе.`);
    if (rt.state.backpacks.length) {
      lines.push(`Рюкзаков в Лабиринте: ${rt.state.backpacks.length}.`);
    }
    return lines.join('\n');
  }

  function openInventory() {
    if (ZQ.isTrialBlocking()) return false;
    if (!ZQ.hasUnlock('backpack')) {
      ZQ.appendLog(ZQ.denyLocked('backpack'), 'sys', true);
      return false;
    }
    if (rt.termView === 'inventory') {
      closeInventory();
      return false;
    }
    ZQ.ensureTerminalShare(0.5);
    ZQ.setTerminalView('inventory');
    renderInventory();
    return true;
  }

  function closeInventory() {
    ZQ.setTerminalView('main');
    ZQ.updatePrompt();
  }

  if (dom.inventoryClose) dom.inventoryClose.addEventListener('click', closeInventory);
  if (dom.inventoryZoomIn) {
    dom.inventoryZoomIn.addEventListener('click', () => setInventoryZoom(rt.inventoryZoom * 1.18, true));
  }
  if (dom.inventoryZoomOut) {
    dom.inventoryZoomOut.addEventListener('click', () => setInventoryZoom(rt.inventoryZoom / 1.18, true));
  }
  if (dom.inventoryZoomReset) {
    dom.inventoryZoomReset.addEventListener('click', () => {
      resetInventoryView();
      ZQ.appendLog('Масштаб инвентаря сброшен.', 'reply', true);
    });
  }

  function bindViewport() {
    if (!dom.inventoryGraph || !ZQ.Viewport) return;
    ZQ.Viewport.attach({
      surface: dom.inventoryGraph,
      content: dom.inventoryStage || dom.inventoryGraph,
      get: () => ({
        zoom: rt.inventoryZoom,
        panX: rt.inventoryPanX,
        panY: rt.inventoryPanY
      }),
      set: (state) => {
        rt.inventoryZoom = state.zoom;
        rt.inventoryPanX = state.panX;
        rt.inventoryPanY = state.panY;
      },
      onChange: () => applyInventoryTransform(),
      onReset: resetInventoryView
    });
    applyInventoryTransform();
  }

  bindViewport();

  ZQ.renderInventory = renderInventory;
  ZQ.openInventory = openInventory;
  ZQ.closeInventory = closeInventory;
  ZQ.inventoryTable = inventoryTable;
  ZQ.setInventoryZoom = setInventoryZoom;
})();
