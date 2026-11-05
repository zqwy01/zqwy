/* Рюкзак: список найденного и быстрые действия. */
(function () {
  'use strict';

  const ZQ = window.ZQ;
  const C = ZQ.C;
  const rt = ZQ.rt;
  const dom = ZQ.dom;

  function itemThumb(item) {
    if (item.kind === 'card' && item.art) {
      const thumb = document.createElement('div');
      thumb.className = 'inv-thumb';
      const img = document.createElement('img');
      img.src = item.art;
      img.alt = '';
      thumb.appendChild(img);
      return thumb;
    }
    const thumb = document.createElement('div');
    thumb.className = 'inv-thumb';
    if (item.kind === 'map') thumb.classList.add('map-thumb');
    else if (item.id === 'chalk') thumb.classList.add('chalk-thumb');
    else if (item.id === 'bead') thumb.classList.add('bead-thumb');
    return thumb;
  }

  function renderInventory() {
    dom.inventoryList.textContent = '';
    if (!rt.state.items.length) {
      const empty = document.createElement('div');
      empty.className = 'inv-empty';
      empty.textContent = 'Пусто. Всё, что было, осталось на месте смерти — или ещё не найдено.';
      dom.inventoryList.appendChild(empty);
    }

    for (const itemId of rt.state.items) {
      const item = C.items[itemId];
      if (!item) continue;
      const row = document.createElement('div');
      row.className = 'inv-item';

      row.appendChild(itemThumb(item));

      const copy = document.createElement('div');
      copy.className = 'inv-copy';
      const name = document.createElement('div');
      name.className = 'inv-name';
      name.textContent = item.name;
      copy.appendChild(name);
      if (item.command) {
        const cmd = document.createElement('div');
        cmd.className = 'inv-command';
        cmd.textContent = `> ${item.command}`;
        copy.appendChild(cmd);
      }
      const desc = document.createElement('div');
      desc.className = 'inv-desc';
      desc.textContent = item.description;
      copy.appendChild(desc);
      row.appendChild(copy);

      const actions = document.createElement('div');
      actions.className = 'inv-actions';

      if (item.kind === 'card' && item.art) {
        const open = document.createElement('button');
        open.type = 'button';
        open.className = 'inv-btn';
        open.textContent = 'открыть';
        open.addEventListener('click', () => {
          ZQ.openCardDetail(item.id, 'inventory');
        });
        actions.appendChild(open);
      }

      if (item.command) {
        const run = document.createElement('button');
        run.type = 'button';
        run.className = 'inv-btn accent';
        run.textContent = item.action || 'выполнить';
        run.addEventListener('click', () => {
          closeInventory();
          ZQ.handleCommand(item.command, 'terminal');
        });
        actions.appendChild(run);
      }

      if (item.command || item.art) {
        const place = document.createElement('button');
        place.type = 'button';
        place.className = 'inv-btn';
        place.textContent = 'на стол';
        place.addEventListener('click', () => {
          closeInventory();
          ZQ.addItemElement(item.id, true);
        });
        actions.appendChild(place);
      }

      row.appendChild(actions);
      dom.inventoryList.appendChild(row);
    }

    if (dom.inventoryNote) {
      const backpacks = rt.state.backpacks.length;
      dom.inventoryNote.textContent = backpacks
        ? `В Лабиринте осталось рюкзаков: ${backpacks}. Предметы на столе остаются на месте, но недоступны, пока рюкзак не возвращён.`
        : 'Предметы можно вынести на стол, связать с клавишей и запускать быстрым нажатием.';
    }
  }

  function openInventory() {
    if (ZQ.isTrialBlocking()) return;
    if (!ZQ.hasUnlock('backpack')) {
      ZQ.appendLog(ZQ.denyLocked('backpack'), 'sys', true);
      return;
    }
    ZQ.ensureTerminalShare(0.42);
    renderInventory();
    ZQ.setTerminalView('inventory');
    ZQ.resetKeys();
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
