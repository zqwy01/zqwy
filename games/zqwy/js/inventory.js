/* Инвентарь: граф предметов и связей, а не список.
   Узлы можно перетаскивать; связи показывают, что с чем связано.
   Рюкзак — такой же предмет, но его slotBonus расширяет инвентарь. */
(function () {
  'use strict';

  const ZQ = window.ZQ;
  const C = ZQ.C;
  const rt = ZQ.rt;
  const dom = ZQ.dom;

  function selectedId() {
    const id = rt.inventorySelected;
    if (!id) return null;
    return rt.state.items.includes(id) ? id : null;
  }

  function ensurePositions(ids) {
    const positions = rt.inventoryPositions;
    if (!positions) {
      rt.inventoryPositions = Object.create(null);
      return ensurePositions(ids);
    }
    const missing = ids.filter((id) => !positions[id]);
    if (!missing.length) return;
    const total = Math.max(ids.length, 1);
    for (const id of missing) {
      const index = ids.indexOf(id);
      const angle = (index / total) * Math.PI * 2 - Math.PI / 2;
      const radius = total <= 1 ? 0 : 0.3;
      positions[id] = {
        nx: ZQ.clamp(0.5 + Math.cos(angle) * radius, 0.1, 0.9),
        ny: ZQ.clamp(0.5 + Math.sin(angle) * radius * 0.92, 0.12, 0.88)
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
      line.setAttribute('class', `inventory-link${edge.kind === 'container' ? ' container' : ''}`);
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
      hint.textContent = 'Выбери узел графа. Связи показывают, как предметы относятся друг к другу.';
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

  function selectItem(id) {
    rt.inventorySelected = id;
    if (dom.inventoryNodes) {
      for (const node of dom.inventoryNodes.querySelectorAll('.inv-node')) {
        node.classList.toggle('selected', node.dataset.item === id);
      }
    }
    renderDetail(rt.state.items.slice());
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
        const nx = ZQ.clamp(drag.nx + dx / rect.width, 0.06, 0.94);
        const ny = ZQ.clamp(drag.ny + dy / rect.height, 0.08, 0.92);
        rt.inventoryPositions[id] = { nx, ny };
        placeNode(node, id);
        drawLinks(rt.state.items.slice());
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
    const ids = rt.state.items.filter((id) => C.items[id]);
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
      if (id === rt.inventorySelected) node.classList.add('selected');
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

    const capacity = ZQ.inventoryCapacity();
    const used = ZQ.inventoryUsed();
    if (dom.inventoryCapacity) {
      dom.inventoryCapacity.textContent = `${used} / ${capacity}`;
      dom.inventoryCapacity.classList.toggle('full', used >= capacity);
    }

    drawLinks(ids);
    renderDetail(ids);

    if (dom.inventoryNote) {
      const backpacks = rt.state.backpacks.length;
      const free = ZQ.inventoryFree();
      const parts = [
        free > 0
          ? `Свободно ячеек: ${free}.`
          : `Инвентарь заполнен: ${used} из ${capacity}.`
      ];
      if (backpacks) {
        parts.push(`В Лабиринте осталось рюкзаков: ${backpacks}. Предметы на столе остаются на месте, но недоступны, пока рюкзак не возвращён.`);
      } else {
        parts.push('Тяни узлы, чтобы разложить связи. Выбери предмет, чтобы открыть его действия.');
      }
      dom.inventoryNote.textContent = parts.join(' ');
    }
  }

  function openInventory() {
    if (ZQ.isTrialBlocking()) return;
    if (!ZQ.hasUnlock('backpack')) {
      ZQ.appendLog(ZQ.denyLocked('backpack'), 'sys', true);
      return;
    }
    ZQ.ensureTerminalShare(0.5);
    ZQ.setTerminalView('inventory');
  }

  function closeInventory() {
    ZQ.setTerminalView('main');
    ZQ.updatePrompt();
  }

  dom.inventoryClose.addEventListener('click', closeInventory);

  ZQ.renderInventory = renderInventory;
  ZQ.openInventory = openInventory;
  ZQ.closeInventory = closeInventory;
})();
