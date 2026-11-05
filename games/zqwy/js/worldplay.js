/* Мир: движение Zemic, комнаты, предметы и взаимодействия. */
(function () {
  'use strict';

  const ZQ = window.ZQ;
  const C = ZQ.C;
  const rt = ZQ.rt;
  const dom = ZQ.dom;

  function canStandAt(x, y) {
    const world = rt.world;
    if (!world) return false;
    const r = C.player.radius;
    const points = [
      [x, y],
      [x - r, y - r], [x + r, y - r],
      [x - r, y + r], [x + r, y + r],
      [x - r, y], [x + r, y],
      [x, y - r], [x, y + r]
    ];
    for (const point of points) {
      if (!world.isWalkable(Math.floor(point[0]), Math.floor(point[1]))) return false;
    }
    return true;
  }

  function roomUnderPlayer() {
    if (!rt.world || !rt.state) return null;
    return rt.world.roomAtTile(
      Math.floor(rt.state.player.x),
      Math.floor(rt.state.player.y)
    );
  }

  function currentRoom() {
    const under = roomUnderPlayer();
    if (under) return under;
    return rt.state.currentRoomId ? rt.world.roomById(rt.state.currentRoomId) : null;
  }

  function roomIdForPosition() {
    const under = roomUnderPlayer();
    if (under) return under.id;
    if (rt.state.currentRoomId) return rt.state.currentRoomId;
    let best = null;
    let bestDistance = Infinity;
    for (const room of rt.world.rooms) {
      const dx = room.centerX + 0.5 - rt.state.player.x;
      const dy = room.centerY + 0.5 - rt.state.player.y;
      const d = dx * dx + dy * dy;
      if (d < bestDistance) {
        bestDistance = d;
        best = room;
      }
    }
    return best ? best.id : null;
  }

  function snapCamera() {
    rt.state.camera.x = rt.state.player.x;
    rt.state.camera.y = rt.state.player.y;
  }

  function respawnAtTablet() {
    rt.state.player.x = rt.world.spawn.x;
    rt.state.player.y = rt.world.spawn.y;
    rt.state.player.facingX = 0;
    rt.state.player.facingY = -1;
    rt.state.player.moving = false;
    rt.state.currentRoomId = null;
    snapCamera();
  }

  function directionName(vx, vy) {
    const horizontal = Math.abs(vx) > 0.25;
    const vertical = Math.abs(vy) > 0.25;
    if (horizontal && vertical) {
      return `${vy < 0 ? 'вверх' : 'вниз'}-${vx < 0 ? 'влево' : 'вправо'}`;
    }
    if (horizontal) return vx < 0 ? 'влево' : 'вправо';
    return vy < 0 ? 'вверх' : 'вниз';
  }

  function updateMovement(dt) {
    let mx = 0;
    let my = 0;
    if (rt.keys.up || rt.gamepadKeys.up) my -= 1;
    if (rt.keys.down || rt.gamepadKeys.down) my += 1;
    if (rt.keys.left || rt.gamepadKeys.left) mx -= 1;
    if (rt.keys.right || rt.gamepadKeys.right) mx += 1;

    if (!mx && !my) {
      rt.state.player.moving = false;
      rt.moveLogDir = '';
      return;
    }

    const length = Math.hypot(mx, my);
    mx /= length;
    my /= length;
    rt.state.player.facingX = mx;
    rt.state.player.facingY = my;
    rt.state.player.moving = true;
    rt.state.animTime += dt;

    const name = directionName(mx, my);
    const time = ZQ.now();
    if (rt.moveLogDir !== name || time - rt.moveLogAt > 1200) {
      rt.moveLogDir = name;
      rt.moveLogAt = time;
      ZQ.logEvent('movement', `шаг ${name}`, 'шаг');
    }

    const step = C.player.speed * dt;
    const nx = rt.state.player.x + mx * step;
    if (canStandAt(nx, rt.state.player.y)) rt.state.player.x = nx;
    const ny = rt.state.player.y + my * step;
    if (canStandAt(rt.state.player.x, ny)) rt.state.player.y = ny;
  }

  function updateCamera() {
    /* Камера без сглаживания и без прижатия к краям мира:
       Zemic всегда остаётся ровно в центре видимой области. */
    rt.state.camera.x = rt.state.player.x;
    rt.state.camera.y = rt.state.player.y;
  }

  function enterRoom(room) {
    if (!room) return;
    const firstVisit = !rt.state.visited[room.id];
    rt.state.currentRoomId = room.id;
    rt.state.visited[room.id] = true;
    if (ZQ.audio) ZQ.audio.setCue(room.music);

    if (!firstVisit) return;

    ZQ.saveGame();
    ZQ.appendLog(`— ${room.name} —`, 'sys', true);
    ZQ.logEvent('actions', `вошёл в комнату «${room.name}»`, 'комната');

    if (room.role === 'trial') {
      ZQ.queueStory('trial', () => {
        if (!rt.state.flags.trialDone && !rt.trial) {
          rt.state.flags.trialAttempted = true;
          ZQ.startTrial();
        }
      });
      return;
    }

    if (C.story[room.role]) {
      if (room.role === 'tablet') {
        ZQ.queueStory(room.role, () => {
          ZQ.unlock('backpack');
          ZQ.unlock('table');
        });
      } else {
        ZQ.queueStory(room.role);
      }
      return;
    }

    const ambient = C.ambientRoomLines[
      window.World.hashString(`${rt.state.seed}:ambient:${room.id}`) % C.ambientRoomLines.length
    ];
    ZQ.appendLog(ambient, 'story', true, 'ЛАБИРИНТ');
  }

  function updateRoomDetection() {
    if (!rt.world || !rt.state) return;
    const room = roomUnderPlayer();
    if (room && rt.state.currentRoomId !== room.id) enterRoom(room);
  }

  function die(cause) {
    if (!rt.state) return;
    const roomId = roomIdForPosition();
    const backpack = {
      id: ZQ.makeId('bp'),
      x: rt.state.player.x,
      y: rt.state.player.y,
      roomId,
      items: rt.state.items.slice(),
      cause,
      createdAt: Date.now()
    };
    rt.state.backpacks.push(backpack);
    rt.state.items = [];
    rt.state.deaths = (rt.state.deaths || 0) + 1;
    respawnAtTablet();
    rt.invulnUntil = ZQ.now() + 2600;

    const room = roomId ? rt.world.roomById(roomId) : null;
    const roomPhrase = room ? `в комнате «${room.name}»` : 'в переходе между комнатами';
    const count = backpack.items.length;
    const deathText = count
      ? `Ты снова у Скрижали. Рюкзак остался ${roomPhrase}: ${count} ${ZQ.plural(count, ['предмет', 'предмета', 'предметов'])}. Он никуда не денется.`
      : `Ты снова у Скрижали. Рюкзак остался ${roomPhrase} — пустой, но никуда не денется.`;

    ZQ.setTerminalView('main');
    dom.btnAction.classList.add('hidden');
    ZQ.resetKeys();
    ZQ.appendLog(C.story.death.lines[0], 'story', true, C.story.death.speaker || 'СКРИЖАЛЬ');
    ZQ.appendLog(deathText, 'sys', false, 'система');
    ZQ.logEvent('actions', `смерть: ${cause || 'неизвестно'}`, 'смерть');
    rt.lastFrame = ZQ.now();
    ZQ.saveGame();
    updatePrompt();
  }

  function collectItemPickup(pickup) {
    if (rt.state.flags[`taken_${pickup.itemId}`]) return;
    rt.state.flags[`taken_${pickup.itemId}`] = true;
    if (!rt.state.items.includes(pickup.itemId)) rt.state.items.push(pickup.itemId);
    const item = C.items[pickup.itemId];
    const name = item ? item.name : pickup.itemId;
    ZQ.appendLog(`В рюкзаке: ${name}`, 'sys', true);
    ZQ.appendLog(`Взято: ${name}.`, 'reply', true);
    ZQ.logEvent('actions', `взял «${name}»`, 'находка');
    ZQ.unlock('backpack');
    if (pickup.itemId === 'map_fragment') ZQ.unlock('map');
    ZQ.saveGame();
    updatePrompt();
  }

  function takeCard() {
    if (rt.state.flags.cardTaken) return;
    rt.state.flags.cardTaken = true;
    if (!rt.state.items.includes('card_angel')) rt.state.items.push('card_angel');
    ZQ.appendLog('Получена карта «Очарование»', 'sys', true);
    ZQ.appendLog('Карта «Очарование» лежит в рюкзаке. Её можно вынести на стол.', 'reply');
    ZQ.logEvent('actions', 'взял карту «Очарование»', 'находка');
    ZQ.saveGame();
    updatePrompt();
  }

  function retrieveBackpack(backpack) {
    const restored = [];
    for (const itemId of backpack.items) {
      if (!rt.state.items.includes(itemId)) {
        rt.state.items.push(itemId);
        const item = C.items[itemId];
        restored.push(item ? item.name : itemId);
      }
    }
    rt.state.backpacks = rt.state.backpacks.filter((bp) => bp.id !== backpack.id);
    if (restored.length) {
      ZQ.appendLog(`Рюкзак возвращён: ${restored.join(', ')}`, 'sys', true);
      ZQ.appendLog(`Рюкзак возвращён. Внутри: ${restored.join(', ')}.`, 'reply');
      ZQ.logEvent('actions', `вернул рюкзак: ${restored.join(', ')}`, 'рюкзак');
    } else {
      ZQ.appendLog('Пустой рюкзак возвращён', 'sys', true);
      ZQ.appendLog('Рюкзак возвращён. Внутри ничего не было.', 'reply');
      ZQ.logEvent('actions', 'вернул пустой рюкзак', 'рюкзак');
    }
    ZQ.saveGame();
    updatePrompt();
    if (rt.termView === 'inventory') ZQ.renderInventory();
    if (rt.termView === 'canvas' || rt.termView === 'card') ZQ.renderCanvasElements();
  }

  function findInteractable() {
    if (!rt.world || !rt.state) return null;
    const px = rt.state.player.x;
    const py = rt.state.player.y;
    let best = null;
    let bestDistance = Infinity;

    function consider(target, distance) {
      if (distance < bestDistance && distance <= 1.22) {
        bestDistance = distance;
        best = target;
      }
    }

    for (const pickup of rt.world.itemPickups) {
      if (rt.state.flags[`taken_${pickup.itemId}`]) continue;
      consider({ type: 'item', pickup }, Math.hypot(px - pickup.x, py - pickup.y));
    }

    for (const backpack of rt.state.backpacks) {
      consider({ type: 'backpack', backpack }, Math.hypot(px - backpack.x, py - backpack.y));
    }

    const tabletDistance = Math.hypot(px - rt.world.tablet.x, py - rt.world.tablet.y);
    if (tabletDistance <= 1.65 && tabletDistance < bestDistance) {
      bestDistance = tabletDistance;
      best = { type: 'tablet' };
    }

    if (rt.state.flags.trialDone && !rt.state.flags.cardTaken && rt.world.trialRoom) {
      const distance = Math.hypot(
        px - (rt.world.trialRoom.centerX + 0.5),
        py - (rt.world.trialRoom.centerY + 0.5)
      );
      if (distance <= 1.55 && distance < bestDistance) {
        bestDistance = distance;
        best = { type: 'card' };
      }
    }

    if (!rt.state.flags.trialDone && rt.world.trialRoom) {
      const distance = Math.hypot(
        px - (rt.world.trialRoom.centerX + 0.5),
        py - (rt.world.trialRoom.centerY + 0.5)
      );
      if (distance <= 1.55 && distance < bestDistance) {
        bestDistance = distance;
        best = { type: 'trial' };
      }
    }

    return best;
  }

  function promptFor(target) {
    if (!target) return '';
    if (target.type === 'item') {
      const item = C.items[target.pickup.itemId];
      return `взять «${item ? item.name : 'находка'}»`;
    }
    if (target.type === 'backpack') {
      const count = target.backpack.items.length;
      return count ? `подобрать рюкзак (${count})` : 'подобрать пустой рюкзак';
    }
    if (target.type === 'tablet') return 'коснуться Скрижали';
    if (target.type === 'card') return 'взять карту';
    if (target.type === 'trial') return 'войти в круг';
    return '';
  }

  function updatePrompt() {
    if (ZQ.isPaused() || ZQ.isTyping()) {
      rt.activePrompt = null;
      rt.promptLabel = '';
      dom.termContext.textContent = '';
      dom.termContext.classList.remove('tablet');
      dom.btnAction.classList.add('hidden');
      return;
    }
    const target = findInteractable();
    rt.activePrompt = target;
    const label = promptFor(target);
    if (!label) {
      rt.promptLabel = '';
      dom.termContext.textContent = '';
      dom.termContext.classList.remove('tablet');
      dom.btnAction.classList.add('hidden');
      return;
    }
    if (label !== rt.promptLabel) {
      rt.promptLabel = label;
      dom.btnAction.setAttribute('aria-label', label);
      dom.btnAction.textContent = '✦';
    }
    dom.termContext.textContent = `рядом: ${label} · E`;
    dom.termContext.classList.toggle('tablet', target.type === 'tablet');
    dom.btnAction.classList.remove('hidden');
  }

  function interact(force) {
    if ((!force && ZQ.isPaused()) || ZQ.isTyping()) return;
    const target = findInteractable();
    if (!target) return;
    ZQ.logEvent('actions', `действие: ${promptFor(target)}`, 'действие');
    if (target.type === 'item') {
      collectItemPickup(target.pickup);
    } else if (target.type === 'backpack') {
      retrieveBackpack(target.backpack);
    } else if (target.type === 'tablet') {
      ZQ.queueStory('tablet', () => {
        ZQ.unlock('backpack');
        ZQ.unlock('table');
      }, true);
    } else if (target.type === 'card') {
      takeCard();
    } else if (target.type === 'trial') {
      ZQ.startTrial();
    }
  }

  function currentRoomDescription() {
    const room = currentRoom();
    if (!room) return 'Ты в переходе между комнатами. Здесь только камень и твоё дыхание.';
    let text;
    if (room.role === 'tablet') {
      text = 'Плоский камень теплее воздуха. Скрижаль не укрытие — просто место, где ты снова становишься собой.';
    } else if (room.role === 'hazard') {
      text = 'Слепой зал молчит. Ни теней, ни преследователей — только стены и твоя память о направлении.';
    } else if (room.role === 'low') {
      text = 'Низкий свод заставляет согнуться. Здесь легко потерять направление.';
    } else if (room.role === 'trial') {
      text = rt.state.flags.trialDone
        ? 'Круг молчит. Печати погасли, и в центре больше ничего нет.'
        : 'Круг проступает на полу. Он не объясняет правил.';
    } else if (room.role === 'storage') {
      text = 'Сухая бумага, пыль, чьи-то аккуратные полки. Здесь что-то оставили до тебя.';
    } else if (room.role === 'crossroad') {
      text = 'На стене четыре чёрточки: три длинные, одна короткая. Под ними — стёртая фраза.';
    } else {
      const index = window.World.hashString(`${rt.state.seed}:look:${room.id}`) % C.ambientRoomLines.length;
      text = C.ambientRoomLines[index];
    }

    const details = [];
    if (room.links && room.links.length) details.push(`выходов: ${room.links.length}`);
    const hasPickup = rt.world.itemPickups.some((p) =>
      !rt.state.flags[`taken_${p.itemId}`] && p.roomId === room.id
    );
    if (hasPickup) details.push('рядом что-то лежит');
    const hasBackpack = rt.state.backpacks.some((bp) => bp.roomId === room.id);
    if (hasBackpack) details.push('здесь оставлен рюкзак');
    if (details.length) text += ` (${details.join('; ')}).`;
    return text;
  }

  function inventorySummary() {
    if (!rt.state.items.length) return 'Рюкзак пуст.';
    const names = rt.state.items.map((id) => (C.items[id] ? C.items[id].name : id));
    return `Рюкзак: ${names.join(', ')}. Предметов: ${rt.state.items.length}.`;
  }

  function mapMark() {
    if (!rt.state.items.includes('chalk')) {
      return 'У тебя нет угольного мелка. Метку не поставить.';
    }
    const room = currentRoom();
    if (!room) return 'Здесь не на что поставить метку.';
    if (rt.state.mapMarks.includes(room.id)) return `Комната «${room.name}» уже отмечена.`;
    rt.state.mapMarks.push(room.id);
    ZQ.saveGame();
    ZQ.appendLog(`Метка: ${room.name}`, 'sys', true);
    ZQ.logEvent('actions', `поставил метку: «${room.name}»`, 'карта');
    return `Метка поставлена: «${room.name}».`;
  }

  function nudgePlayer(dx, dy, directionNameText) {
    const distance = 0.86;
    const nx = rt.state.player.x + dx * distance;
    const ny = rt.state.player.y + dy * distance;
    if (!canStandAt(nx, ny)) return `Дальше стена. В ${directionNameText} не пройти.`;
    rt.state.player.x = nx;
    rt.state.player.y = ny;
    rt.state.player.facingX = dx;
    rt.state.player.facingY = dy;
    rt.state.player.moving = false;
    rt.state.animTime += 0.18;
    ZQ.logEvent('movement', `шаг ${directionNameText}`, 'шаг');
    updateRoomDetection();
    updatePrompt();
    return `Шаг ${directionNameText}. Камень отзывается глухо.`;
  }

  ZQ.canStandAt = canStandAt;
  ZQ.roomUnderPlayer = roomUnderPlayer;
  ZQ.currentRoom = currentRoom;
  ZQ.roomIdForPosition = roomIdForPosition;
  ZQ.snapCamera = snapCamera;
  ZQ.respawnAtTablet = respawnAtTablet;
  ZQ.updateMovement = updateMovement;
  ZQ.updateCamera = updateCamera;
  ZQ.enterRoom = enterRoom;
  ZQ.updateRoomDetection = updateRoomDetection;
  ZQ.die = die;
  ZQ.collectItemPickup = collectItemPickup;
  ZQ.takeCard = takeCard;
  ZQ.retrieveBackpack = retrieveBackpack;
  ZQ.findInteractable = findInteractable;
  ZQ.promptFor = promptFor;
  ZQ.updatePrompt = updatePrompt;
  ZQ.interact = interact;
  ZQ.currentRoomDescription = currentRoomDescription;
  ZQ.inventorySummary = inventorySummary;
  ZQ.mapMark = mapMark;
  ZQ.nudgePlayer = nudgePlayer;
})();
