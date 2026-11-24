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

  /* Автомат — не предмет в ячейках: узел появляется в графе, только
     пока Zemic стоит рядом с настоящим корпусом в Лабиринте. */
  function nearbyCabinet() {
    /* Узел исчезает, как только Zemic отходит от корпуса: радиус чуть
       больше дистанции взаимодействия, но меньше «через ползала». */
    return typeof ZQ.arcadeNearby === 'function' ? ZQ.arcadeNearby(1.9) : null;
  }

  function insertedCassette() {
    return typeof ZQ.arcadeInserted === 'function' ? ZQ.arcadeInserted() : null;
  }

  function graphIds() {
    if (!rt.state) return [];
    const ids = rt.state.items.filter((id) => C.items[id]);
    /* Рюкзак — не ячейка и не команда «инвентарь», а отдельный узел:
       он показывает, что именно переносится и сколько ячеек занято. */
    if (ZQ.hasUnlock && ZQ.hasUnlock('backpack') && C.items.backpack &&
        !ids.includes('backpack')) {
      ids.push('backpack');
    }
    if (nearbyCabinet() && C.items.arcade_cabinet &&
        !ids.includes('arcade_cabinet')) {
      ids.push('arcade_cabinet');
    }
    return ids.concat(cassetteIds().filter((id) => !ids.includes(id)));
  }

  function presentId(id) {
    return graphIds().includes(id);
  }

  function selectedId() {
    const id = rt.inventorySelected;
    if (!id) return null;
    return presentId(id) ? id : null;
  }

  function positions() {
    if (!rt.state) return Object.create(null);
    if (!rt.state.inventoryPositions || typeof rt.state.inventoryPositions !== 'object') {
      rt.state.inventoryPositions = Object.create(null);
    }
    return rt.state.inventoryPositions;
  }

  const INVENTORY_LAYOUT = 2;

  /* Раскладка разделяет зоны: слева обычные предметы и рюкзак,
     в центре проигрыватель, справа сетка кассет. Так кассеты не
     накрывают остальные предметы, а связи плеер → кассета видны. */
  function layoutSnapshot(ids) {
    const result = Object.create(null);
    const cassette = (id) => C.items[id] && C.items[id].kind === 'cassette';
    const cassettes = ids.filter(cassette);
    const regular = ids.filter((id) => !cassette(id));
    const player = regular.includes('music_player') ? 'music_player' : null;
    const cabinet = regular.includes('arcade_cabinet') ? 'arcade_cabinet' : null;
    const others = regular.filter((id) => id !== player && id !== cabinet);
    /* Обычные предметы занимают две колонки слева. Строки
       распределяются по высоте целиком, поэтому при стартовом
       наборе все они видны без прокрутки, а не прячутся под
       нижней границей. */
    const columns = 2;
    const rows = Math.max(1, Math.ceil(others.length / columns));
    const leftX = 0.1;
    const leftDX = 0.17;
    const topY = rows === 1 ? 0.5 : 0.16;
    const bottomY = rows === 1 ? 0.5 : 0.84;
    others.forEach((id, index) => {
      const col = Math.floor(index / rows);
      const row = index % rows;
      result[id] = {
        nx: leftX + col * leftDX,
        ny: topY + (bottomY - topY) * (row / Math.max(1, rows - 1))
      };
    });
    if (player) {
      const usedColumns = Math.max(1, Math.ceil(others.length / rows));
      result[player] = {
        nx: Math.min(0.44, leftX + usedColumns * leftDX),
        ny: 0.5
      };
    }
    /* Гнездо автомата — внизу по центру: оттуда связи к кассетам
       справа не перекрывают предметы слева. */
    if (cabinet) {
      result[cabinet] = { nx: 0.47, ny: 0.84 };
    }
    const cols = 4;
    const startX = 0.56;
    const startY = 0.1;
    const dx = 0.116;
    const dy = 0.25;
    cassettes.forEach((id, index) => {
      const col = index % cols;
      const row = Math.floor(index / cols);
      result[id] = {
        nx: startX + col * dx,
        ny: startY + row * dy
      };
    });
    return result;
  }

  function ensurePositions(ids) {
    const store = positions();
    const desired = layoutSnapshot(ids);
    if (rt.state.inventoryLayout !== INVENTORY_LAYOUT) {
      /* Патч 11 раскладывал кассеты спиралью поверх предметов.
         Один раз переносим всё на новую раскладку, дальше позиции
         остаются за игроком. */
      for (const key of Object.keys(store)) delete store[key];
      for (const id of ids) {
        if (desired[id]) store[id] = desired[id];
      }
      rt.state.inventoryLayout = INVENTORY_LAYOUT;
      if (typeof ZQ.saveGame === 'function') ZQ.saveGame();
      return;
    }
    for (const id of ids) {
      if (!store[id] && desired[id]) store[id] = desired[id];
    }
  }

  function positionFor(id) {
    const store = positions();
    return store[id] || { nx: 0.5, ny: 0.5 };
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
    } else if (item.id === 'arcade_cabinet') {
      thumb.classList.add('cabinet-thumb');
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
      /* Кассеты висят на проигрывателе, а не напрямую на рюкзаке:
         иначе десятки линий закрывают всю схему. */
      const hasPlayer = present.has('music_player');
      for (const id of ids) {
        if (id === 'backpack') continue;
        if (hasPlayer && C.items[id] && C.items[id].kind === 'cassette') continue;
        add('backpack', id, 'вмещает', 'container');
      }
    }
    if (present.has('music_player')) {
      for (const id of cassetteIds()) add('music_player', id, 'кассета', 'cassette');
    }
    if (present.has('arcade_cabinet')) {
      const inserted = insertedCassette();
      if (inserted) add('arcade_cabinet', inserted, 'вставлена', 'cassette');
    }
    return Array.from(pairs.values());
  }

  function drawLinks(ids) {
    if (!dom.inventoryLinks) return;
    const edges = edgePairs(ids);
    const canvas = getInventoryCanvas();
    if (canvas) {
      canvas.drawLinks(edges, positionFor, { className: 'inventory-link' });
      return;
    }
    dom.inventoryLinks.textContent = '';
    for (const edge of edges) {
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
          const album = cassette.album && C.music.albums
            ? C.music.albums[cassette.album]
            : null;
          const albumTracks = album && Array.isArray(album.tracks)
            ? album.tracks
            : [cassette.trackId];
          const chip = makeButton(cassette.name.replace(/^Кассета · /, ''), 'inventory-chip cassette-chip', () => {
            if (ZQ.audio && typeof ZQ.audio.playCassette === 'function') {
              ZQ.audio.playCassette(cassette.trackId);
              renderDetail(ids);
            }
          });
          if (albumTracks.includes(rt.state.activeCassette)) chip.classList.add('active');
          chip.title = `${cassette.name} · дорожек: ${albumTracks.length}`;
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

    if (id === 'arcade_cabinet') {
      const inserted = insertedCassette();
      const cassette = inserted && C.items[inserted];
      const row = document.createElement('div');
      row.className = 'inventory-cassettes';
      const label = document.createElement('span');
      label.className = 'inventory-detail-links-label';
      label.textContent = 'гнездо';
      row.appendChild(label);
      const chip = document.createElement('span');
      chip.className = 'inventory-chip cassette-chip';
      chip.textContent = cassette
        ? cassette.name.replace(/^Кассета · /, '').replace(/^Cassette · /, '')
        : 'пусто';
      if (!cassette) chip.classList.add('empty');
      row.appendChild(chip);
      dom.inventoryDetail.appendChild(row);
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

    /* Кассета вставляется в автомат прямо из графа: связь появляется
       в тот же момент, когда гнездо занимает эта плёнка. */
    if (item.kind === 'cassette' && nearbyCabinet() &&
        typeof ZQ.arcadeInsertCassette === 'function') {
      const isInserted = insertedCassette() === item.id;
      if (!isInserted) {
        actions.appendChild(makeButton('вставить в автомат', 'inv-btn accent', () => {
          ZQ.arcadeInsertCassette(item.id);
          renderInventory();
        }));
      }
    }

    if (id === 'arcade_cabinet') {
      actions.appendChild(makeButton('играть', 'inv-btn accent', () => {
        closeInventory();
        if (typeof ZQ.openArcade === 'function') ZQ.openArcade();
      }));
      if (insertedCassette() && typeof ZQ.arcadeEjectCassette === 'function') {
        actions.appendChild(makeButton('вынуть кассету', 'inv-btn', () => {
          ZQ.arcadeEjectCassette(false);
          renderInventory();
        }));
      }
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

  let inventoryCanvas = null;

  function getInventoryCanvas() {
    if (inventoryCanvas || !ZQ.Canvas) return inventoryCanvas;
    inventoryCanvas = ZQ.Canvas.create({
      surface: dom.inventoryGraph,
      stage: dom.inventoryStage,
      grid: dom.inventoryGrid,
      links: dom.inventoryLinks,
      elements: dom.inventoryNodes,
      get: () => ({
        zoom: rt.inventoryZoom,
        panX: rt.inventoryPanX,
        panY: rt.inventoryPanY
      }),
      set: (view) => {
        rt.inventoryZoom = ZQ.Canvas.clampZoom(view.zoom);
        rt.inventoryPanX = view.panX;
        rt.inventoryPanY = view.panY;
      },
      onChange: () => {
        if (dom.inventoryZoomLabel) {
          dom.inventoryZoomLabel.textContent = `${Math.round(rt.inventoryZoom * 100)}%`;
        }
      },
      canStart: (event) => {
        if (event.target.closest('.inv-node')) return false;
        if (event.target.closest('.canvas-controls')) return false;
        return true;
      }
    });
    return inventoryCanvas;
  }

  function applyInventoryTransform() {
    const canvas = getInventoryCanvas();
    if (canvas) canvas.apply();
    else if (dom.inventoryStage && ZQ.Viewport) {
      ZQ.Viewport.applyTransform(dom.inventoryStage, {
        zoom: rt.inventoryZoom,
        panX: rt.inventoryPanX,
        panY: rt.inventoryPanY
      });
    }
  }

  function setInventoryZoom(value, announce) {
    const canvas = getInventoryCanvas();
    if (canvas) {
      canvas.setZoom(value, announce);
    } else {
      rt.inventoryZoom = ZQ.clamp(value, 0.18, 3.2);
      applyInventoryTransform();
    }
    if (announce) {
      ZQ.appendLog(
        `Масштаб инвентаря: ${Math.round(rt.inventoryZoom * 100)}%.`,
        'reply',
        true
      );
    }
  }

  function resetInventoryView() {
    const canvas = getInventoryCanvas();
    if (canvas) {
      canvas.set({ zoom: 1, panX: 0, panY: 0 });
      applyInventoryTransform();
    } else {
      rt.inventoryZoom = 1;
      rt.inventoryPanX = 0;
      rt.inventoryPanY = 0;
      applyInventoryTransform();
    }
  }

  /* Общие действия канвы: вписать все узлы и выровнять их по сетке.
     Те же кнопки есть на столе и в ветви сюжета. */
  function fitInventory() {
    const canvas = getInventoryCanvas();
    if (!canvas) return;
    canvas.fitToNodes('.inv-node', { pad: 26, maxZoom: 1.5 });
  }

  function gridInventory() {
    const canvas = getInventoryCanvas();
    if (!canvas || !dom.inventoryStage) return;
    const width = Math.max(1, dom.inventoryStage.clientWidth || 1);
    const height = Math.max(1, dom.inventoryStage.clientHeight || 1);
    const store = positions();
    canvas.alignToGrid('.inv-node', 22, {
      apply: (rows) => {
        for (const row of rows) {
          const id = row.node.dataset.item;
          if (!id) continue;
          store[id] = { nx: row.x / width, ny: row.y / height };
        }
      }
    });
    renderInventory();
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

  /* Центрируем узел в окне графа: сцена масштабируется от центра,
     поэтому смещение считается от половины её размера. */
  function centerInventoryNode(id) {
    if (!dom.inventoryStage) return;
    const rect = dom.inventoryStage.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const pos = positionFor(id);
    const zoom = Number.isFinite(rt.inventoryZoom) ? rt.inventoryZoom : 1;
    rt.inventoryPanX = -(pos.nx - 0.5) * rect.width * zoom;
    rt.inventoryPanY = -(pos.ny - 0.5) * rect.height * zoom;
    applyInventoryTransform();
  }

  /* Взаимодействие с автоматом открывает инвентарь уже на его узле:
     кассету можно сразу перетащить в гнездо. */
  function focusInventoryItem(id) {
    if (!rt.state || !id) return false;
    if (!ZQ.hasUnlock('backpack')) {
      /* До рюкзака инвентаря ещё нет: автомат открывается напрямую,
         чтобы подсказка E не вела в пустоту. */
      if (id === 'arcade_cabinet' && typeof ZQ.openArcade === 'function') {
        return ZQ.openArcade();
      }
      ZQ.appendLog(ZQ.denyLocked('backpack'), 'sys', true);
      return false;
    }
    if (!presentId(id)) return false;
    ZQ.ensureTerminalShare(0.5);
    ZQ.setTerminalView('inventory');
    renderInventory();
    if (!presentId(id)) return false;
    selectItem(id);
    centerInventoryNode(id);
    return true;
  }

  /* Узел автомата живёт в графе только рядом с корпусом. Пока игрок
     отходит, инвентарь перерисовывается и узел исчезает. */
  function syncInventoryCabinet() {
    const present = Boolean(nearbyCabinet());
    if (rt.inventoryCabinetPresent === present) return;
    rt.inventoryCabinetPresent = present;
    if (rt.termView === 'inventory') renderInventory();
  }

  function nodeUnderPointer(event, skipNode) {
    if (!event || !dom.inventoryNodes) return null;
    let best = null;
    let bestDistance = Infinity;
    for (const node of dom.inventoryNodes.querySelectorAll('.inv-node')) {
      if (node === skipNode) continue;
      const rect = node.getBoundingClientRect();
      const inside = event.clientX >= rect.left && event.clientX <= rect.right &&
        event.clientY >= rect.top && event.clientY <= rect.bottom;
      if (!inside) continue;
      const distance = Math.hypot(
        event.clientX - (rect.left + rect.width / 2),
        event.clientY - (rect.top + rect.height / 2)
      );
      if (distance < bestDistance) {
        bestDistance = distance;
        best = node.dataset.item;
      }
    }
    return best;
  }

  function highlightDropTarget(id) {
    if (!dom.inventoryNodes) return;
    for (const node of dom.inventoryNodes.querySelectorAll('.inv-node')) {
      node.classList.toggle('drop-target', Boolean(id) && node.dataset.item === id);
    }
  }

  function handleDrop(sourceId, targetId) {
    if (!sourceId || !targetId || sourceId === targetId) return false;
    const source = C.items[sourceId];
    if (!source) return false;
    if (source.kind === 'cassette') {
      /* Кассета → автомат: связь создаётся в тот же миг, плёнка
         занимает гнездо, а автомат открывает экран и играет. */
      if (targetId === 'arcade_cabinet' && nearbyCabinet() &&
          typeof ZQ.arcadePlayCassette === 'function') {
        return ZQ.arcadePlayCassette(sourceId);
      }
      /* Кассета → проигрыватель: выбрать и включить дорожку. */
      if (targetId === 'music_player' && ZQ.audio &&
          typeof ZQ.audio.playCassette === 'function') {
        ZQ.audio.playCassette(source.trackId);
        selectItem(sourceId);
        return true;
      }
    }
    return false;
  }

  function bindNodeDrag(node, id) {
    const canvas = getInventoryCanvas();
    const store = positions();
    if (!store[id]) store[id] = { nx: 0.5, ny: 0.5 };
    if (!canvas) return;
    canvas.bindNodeDrag(node, store[id], {
      onMove: (position, event) => {
        drawLinks(graphIds());
        highlightDropTarget(nodeUnderPointer(event, node));
      },
      onEnd: (moved, position, event) => {
        highlightDropTarget(null);
        if (moved) {
          const targetId = nodeUnderPointer(event, node);
          handleDrop(id, targetId);
          ZQ.saveGame();
          drawLinks(graphIds());
          return;
        }
        /* Щелчок по узлу автомата открывает аркадный экран. */
        if (id === 'arcade_cabinet' && nearbyCabinet() &&
            typeof ZQ.openArcade === 'function') {
          ZQ.openArcade();
          return;
        }
        selectItem(id);
      }
    });
  }

  function renderInventory() {
    if (!dom.inventoryNodes) return;
    const ids = graphIds();
    /* Запоминаем, был ли узел автомата в кадре: следующая проверка
       «отойди от корпуса» должна увидеть смену состояния. */
    rt.inventoryCabinetPresent = Boolean(nearbyCabinet());
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
      name.textContent = item.kind === 'cassette'
        ? item.name.replace(/^Кассета · /, '')
        : item.name;
      copy.appendChild(name);
      const sub = document.createElement('span');
      sub.className = 'inv-node-sub';
      if (Number.isFinite(item.slotBonus) && item.slotBonus) {
        sub.textContent = `+${item.slotBonus} ячеек`;
      } else if (item.kind === 'player') {
        sub.textContent = `кассет: ${cassetteIds().length}`;
      } else if (id === 'arcade_cabinet') {
        const inserted = insertedCassette();
        const cassette = inserted && C.items[inserted];
        sub.textContent = cassette
          ? `гнездо: ${cassette.name.replace(/^Кассета · /, '').replace(/^Cassette · /, '')}`
          : 'гнездо пусто';
      } else if (item.kind === 'cassette') {
        const album = item.album && C.music.albums ? C.music.albums[item.album] : null;
        sub.textContent = `дорожек: ${album && Array.isArray(album.tracks) ? album.tracks.length : 1}`;
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

  /* «Рюкзак» — это отчёт о вещи и её состоянии, а не команда открытия
     инвентаря. Инвентарь открывается отдельной командой «инвентарь». */
  function backpackReport() {
    if (!rt.state) return '';
    if (!ZQ.hasUnlock('backpack')) return ZQ.denyLocked('backpack');
    const item = C.items.backpack || { name: 'Рюкзак', description: '' };
    const capacity = ZQ.inventoryCapacity();
    const base = C.inventory && Number.isFinite(C.inventory.baseSlots)
      ? C.inventory.baseSlots
      : 4;
    const used = ZQ.inventoryUsed();
    const lost = rt.state.backpacks.length;
    const carried = rt.state.items.filter((id) => C.items[id] && id !== 'backpack');
    const hasBackpack = rt.state.items.includes('backpack');
    const cassettes = cassetteIds();
    const bonusValue = Math.max(0, capacity - base);
    const bonus = bonusValue ? ` (+${bonusValue} от рюкзака)` : '';
    const stateLine = hasBackpack
      ? 'Сейчас рюкзак на плечах.'
      : lost
        ? `Сейчас рюкзак лежит в Лабиринте: ${lost}. Пока его не вернуть, переносимые вещи недоступны.`
        : 'Рюкзака при тебе нет.';
    const contents = hasBackpack
      ? (carried.length
        ? `Внутри: ${carried.map((id) => C.items[id].name).join(', ')}.`
        : 'Внутри пока пусто.')
      : '';
    const parts = [`${item.name}: ${item.description} ${stateLine}`];
    if (contents) parts.push(contents);
    parts.push(
      `Ячейки: ${used} из ${capacity}${bonus}. ` +
      `Кассет в проигрывателе: ${cassettes.length}.`
    );
    return parts.join(' ');
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

  function bindViewport() {
    if (!dom.inventoryGraph) return;
    const canvas = getInventoryCanvas();
    if (!canvas) return;
    canvas.attachViewport();
    const controls = ZQ.Canvas.mountControls({
      canvas,
      container: dom.inventoryGraph,
      idPrefix: 'inventory',
      ids: { fit: 'inventory-fit', grid: 'inventory-align-grid' },
      fit: fitInventory,
      grid: gridInventory
    });
    if (controls) dom.inventoryZoomLabel = controls.label;
    applyInventoryTransform();
  }

  bindViewport();

  ZQ.renderInventory = renderInventory;
  ZQ.openInventory = openInventory;
  ZQ.closeInventory = closeInventory;
  ZQ.focusInventoryItem = focusInventoryItem;
  ZQ.syncInventoryCabinet = syncInventoryCabinet;
  ZQ.backpackReport = backpackReport;
  ZQ.inventoryTable = inventoryTable;
  ZQ.setInventoryZoom = setInventoryZoom;
})();
