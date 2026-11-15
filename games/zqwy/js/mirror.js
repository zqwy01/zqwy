/* Зеркальный зал и Вишня — девчонка-отражение.
   Она не враг по умолчанию: три зеркала показывают чужие отражения,
   а ответ на её вопрос решает, станет она собакой-проводником,
   исчезнет или попробует стереть Zemic. Состояние живёт во флагах
   сохранения и переживает перезагрузку. */
(function () {
  'use strict';

  const ZQ = window.ZQ;
  const C = ZQ.C;
  const rt = ZQ.rt;

  const PHASE = {
    unmet: 'unmet',
    met: 'met',
    ready: 'ready',
    trust: 'trust',
    neutral: 'neutral',
    hostile: 'hostile',
    regret: 'regret'
  };

  const MIRRORS = {
    phone: {
      id: 'phone',
      label: 'зеркало с телефоном',
      title: 'Телефон без сигнала',
      lines: [
        'В отражении у тебя в руке телефон. Экран горит, но входящих нет.',
        'На стекле вместо твоего лица — её лицо. Она смотрит не в телефон, а на тебя.'
      ],
      clue: 'В этом зеркале лишняя — ты: у отражения нет собственного лица.'
    },
    two: {
      id: 'two',
      label: 'зеркало с двумя',
      title: 'Две фигуры',
      lines: [
        'В раме стоят две девчонки. Одна чёткая, вторая выцветает к краю стекла.',
        'У выцветшей нет отражения в соседних зеркалах. Только тонкая красная нить на запястье.'
      ],
      clue: 'Лишняя та, у которой нет отражения в других рамах.'
    },
    dog: {
      id: 'dog',
      label: 'зеркало с собакой',
      title: 'Собака и девочка',
      lines: [
        'На полу сидит маленькая собака с вишнёвым ошейником. Она смотрит вверх, на девочку.',
        'Но в зале, кроме тебя, никого нет. Собака смотрит на ту, которой здесь не должно быть.'
      ],
      clue: 'Собака видит ту, кого не видишь ты. Значит, отражение помнит больше оригинала.'
    }
  };

  const PHASE_TITLES = {
    unmet: 'не встречена',
    met: 'ждёт осмотра',
    ready: 'ждёт ответа',
    trust: 'доверилась',
    neutral: 'ушла',
    hostile: 'враждебна',
    regret: 'сожалеет'
  };

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function normalize(value) {
    return String(value || '').toLowerCase().replace(/ё/g, 'е').replace(/\s+/g, ' ').trim();
  }

  function flags() {
    if (!rt.state) return {};
    if (!rt.state.flags || typeof rt.state.flags !== 'object') rt.state.flags = {};
    return rt.state.flags;
  }

  function phase() {
    const value = flags().mirrorPhase;
    return Object.prototype.hasOwnProperty.call(PHASE, value) ? value : PHASE.unmet;
  }

  function setPhase(value) {
    flags().mirrorPhase = value;
    ZQ.saveGame();
  }

  function mirrorRoom() {
    if (!rt.world || !Array.isArray(rt.world.rooms)) return null;
    return rt.world.rooms.find((room) => room && room.role === 'mirror') || null;
  }

  function inRoom(room, x, y) {
    if (!room) return false;
    return x >= room.x1 - 0.6 && x <= room.x2 + 0.6 &&
      y >= room.y1 - 0.6 && y <= room.y2 + 0.6;
  }

  function playerInRoom(room) {
    if (!room || !rt.state || !rt.state.player) return false;
    return inRoom(room, rt.state.player.x, rt.state.player.y);
  }

  function mirrorLayout(room) {
    if (!room) return [];
    const cx = room.centerX + 0.5;
    const spread = Math.max(3.2, Math.min(6.4, room.w * 0.26));
    const y = room.y1 + 1.45;
    return [
      Object.assign({}, MIRRORS.phone, { x: cx - spread, y }),
      Object.assign({}, MIRRORS.two, { x: cx, y: room.y1 + 1.1 }),
      Object.assign({}, MIRRORS.dog, { x: cx + spread, y })
    ];
  }

  function home(room) {
    return {
      x: room.centerX + 0.5,
      y: room.centerY + 1.15
    };
  }

  function runtime() {
    if (!rt.mirror || typeof rt.mirror !== 'object') {
      rt.mirror = {
        roomId: null,
        x: NaN,
        y: NaN,
        facing: 0,
        moving: false,
        stride: 0,
        warnAt: 0,
        warnedRoom: null,
        dog: null
      };
    }
    return rt.mirror;
  }

  function ensureNpc(room) {
    const npc = runtime();
    if (npc.roomId !== room.id || !Number.isFinite(npc.x) || !Number.isFinite(npc.y)) {
      const spot = home(room);
      npc.roomId = room.id;
      npc.x = spot.x;
      npc.y = spot.y;
      npc.facing = -Math.PI / 2;
    }
    return npc;
  }

  function seenMap() {
    const f = flags();
    return {
      phone: Boolean(f.mirrorSeenPhone),
      two: Boolean(f.mirrorSeenTwo),
      dog: Boolean(f.mirrorSeenDog)
    };
  }

  function seenCount() {
    const seen = seenMap();
    return Number(seen.phone) + Number(seen.two) + Number(seen.dog);
  }

  function markSeen(id) {
    const key = {
      phone: 'mirrorSeenPhone',
      two: 'mirrorSeenTwo',
      dog: 'mirrorSeenDog'
    }[id];
    if (!key) return false;
    if (flags()[key]) return false;
    flags()[key] = true;
    ZQ.saveGame();
    return true;
  }

  function playStory(key) {
    const story = C.story && C.story[key];
    if (!story) return;
    ZQ.appendLog(story.title, 'sys', true, 'сцена');
    const speaker = story.speaker || 'ВИШНЯ';
    for (const line of story.lines) {
      ZQ.appendLog(line, 'story', false, speaker);
    }
  }

  function grantShard() {
    if (!rt.state) return false;
    if (rt.state.items.includes('mirror_shard')) {
      flags().mirrorShardWaiting = false;
      return true;
    }
    const result = ZQ.addInventoryItem('mirror_shard');
    if (result && result.ok) {
      flags().mirrorShardWaiting = false;
      ZQ.saveGame();
      ZQ.appendLog('В инвентаре: Осколок зеркала', 'sys', true);
      ZQ.appendLog(
        'Осколок тёплый. В нём видно не тебя, а чужие отражения: засадные жабы выдают себя красным бликом.',
        'reply',
        true
      );
      return true;
    }
    flags().mirrorShardWaiting = true;
    ZQ.saveGame();
    ZQ.appendLog(
      `Осколок не помещается в инвентарь (${ZQ.inventoryUsed()} из ${ZQ.inventoryCapacity()} ячеек). Он подождёт в раме.`,
      'sys',
      true
    );
    return false;
  }

  function answer(arg) {
    const room = mirrorRoom();
    if (!room) return 'Зеркального зала пока нет в этом мире.';
    if (!playerInRoom(room) && rt.state.currentRoomId !== room.id) {
      return 'Ты не в Зеркальном зале. Вишня не услышит ответа отсюда.';
    }
    if (phase() !== PHASE.ready) {
      if (phase() === PHASE.hostile) {
        return 'Сейчас она не слушает. Уходи из зала или скажи «прости».';
      }
      if (phase() === PHASE.trust) return 'Вишня уже получила твой ответ.';
      if (phase() === PHASE.neutral) return 'Вишня уже ушла. Отвечать некому.';
      return `Сначала осмотри три зеркала (${seenCount()} из 3) и подойди к Вишне.`;
    }

    const value = normalize(arg);
    if (!value) {
      return 'Ответь одним словом: «ответить я», «ответить ты» или «ответить никто».';
    }
    if (['я', 'себя', 'себе', 'меня', 'self', 'me', 'i'].includes(value)) {
      setPhase(PHASE.trust);
      flags().mirrorAnswer = 'self';
      flags().mirrorDog = true;
      grantShard();
      playStory('mirrorTrust');
      ZQ.logEvent('actions', 'ответил Вишне: «я»', 'зеркало');
      ZQ.saveGame();
      if (ZQ.updatePrompt) ZQ.updatePrompt();
      return 'Вишня принимает ответ. Теперь отражений меньше, но одно из них идёт за тобой.';
    }
    if (['ты', 'тебя', 'ей', 'она', 'ее', 'her', 'you'].includes(value)) {
      setPhase(PHASE.hostile);
      flags().mirrorAnswer = 'her';
      flags().mirrorHostileAt = ZQ.now();
      flags().mirrorHostileUntil = ZQ.now() + 22000;
      playStory('mirrorHostile');
      ZQ.logEvent('actions', 'ответил Вишне: «ты»', 'зеркало');
      ZQ.saveGame();
      if (ZQ.updatePrompt) ZQ.updatePrompt();
      return 'Зеркала поворачиваются к тебе. Беги из зала или скажи «прости».';
    }
    if (['никто', 'обе', 'none', 'nobody', 'no one'].includes(value)) {
      setPhase(PHASE.neutral);
      flags().mirrorAnswer = 'none';
      playStory('mirrorNeutral');
      ZQ.logEvent('actions', 'ответил Вишне: «никто»', 'зеркало');
      ZQ.saveGame();
      if (ZQ.updatePrompt) ZQ.updatePrompt();
      return 'Вишня исчезает между рамами. В зале остаётся только твоё дыхание.';
    }
    return 'Такого ответа она не понимает. Скажи «ответить я», «ответить ты» или «ответить никто».';
  }

  function forgive() {
    const room = mirrorRoom();
    if (!room) return 'Зеркального зала пока нет в этом мире.';
    if (phase() === PHASE.hostile) {
      setPhase(PHASE.regret);
      flags().mirrorHostileUntil = 0;
      playStory('mirrorRegret');
      ZQ.logEvent('actions', 'попросил отражение отпустить', 'зеркало');
      ZQ.saveGame();
      if (ZQ.updatePrompt) ZQ.updatePrompt();
      return 'Ты говоришь «прости». Зеркала гаснут, и она отступает в глубину рамы.';
    }
    if (phase() === PHASE.trust) return 'Она уже не держит зла. Косточка сидит рядом и ждёт.';
    if (phase() === PHASE.regret) return 'Она давно отпустила тебя.';
    return 'Сейчас просить прощения не у кого.';
  }

  function status() {
    const room = mirrorRoom();
    const current = phase();
    const lines = ['Зеркальный зал:'];
    if (!room) {
      lines.push('• в этом мире зал ещё не создан');
      return lines.join('\n');
    }
    lines.push(`• состояние Вишни: ${PHASE_TITLES[current] || current}`);
    lines.push(`• осмотрено зеркал: ${seenCount()} из 3`);
    const seen = seenMap();
    for (const mirror of mirrorLayout(room)) {
      lines.push(`  — ${mirror.label}: ${seen[mirror.id] ? 'осмотрено' : 'ещё не смотрено'}`);
    }
    if (flags().mirrorDog) lines.push('• Косточка идёт за тобой и чует засады');
    if (flags().mirrorShardWaiting) lines.push('• осколок ждёт в раме: в инвентаре нет места');
    if (rt.state.items.includes('mirror_shard')) lines.push('• осколок зеркала в инвентаре');

    if (current === PHASE.unmet) {
      lines.push('Подойди к девчонке между рамами.');
    } else if (current === PHASE.met) {
      lines.push(`Осмотри все три зеркала: «посмотреть» у каждой рамы или E рядом. Осталось ${3 - seenCount()}.`);
    } else if (current === PHASE.ready) {
      lines.push('Ответь: «ответить я», «ответить ты» или «ответить никто».');
    } else if (current === PHASE.hostile) {
      lines.push('Уходи из зала или скажи «прости».');
    } else if (current === PHASE.trust) {
      lines.push('Она больше не опасна. Собака рядом.');
    } else if (current === PHASE.neutral) {
      lines.push('Она ушла. Зеркала пусты.');
    } else if (current === PHASE.regret) {
      lines.push('Она не поднимает глаз.');
    }
    return lines.join('\n');
  }

  function roomDescription() {
    const current = phase();
    if (current === PHASE.unmet) {
      return 'Три высоких зеркала стоят у стены. В каждом — ты, но ни в одном ты не один.';
    }
    if (current === PHASE.met) {
      return 'Вишня стоит между рамами и ждёт, пока ты посмотришь в каждое стекло.';
    }
    if (current === PHASE.ready) {
      return 'Все три зеркала осмотрены. Вишня поднимает голову: «Ну? Кто здесь лишняя?»';
    }
    if (current === PHASE.trust) {
      return 'Вишня улыбается из средней рамы. У твоих ног сидит Косточка и тихо стучит хвостом.';
    }
    if (current === PHASE.hostile) {
      return 'Все три зеркала повёрнуты к тебе. В каждом — её лицо и твой силуэт за спиной.';
    }
    if (current === PHASE.regret) {
      return 'Зеркала потускнели. Вишня стоит в глубине рамы и больше не поднимает глаз.';
    }
    return 'Три зеркала отражают пустой зал. Вишни больше нет.';
  }

  function mirrorTarget(px, py) {
    const room = mirrorRoom();
    if (!room || !rt.state) return null;
    if (!inRoom(room, px, py)) return null;
    let best = null;
    const npc = ensureNpc(room);
    if (phase() !== PHASE.neutral) {
      const distance = Math.hypot(px - npc.x, py - npc.y);
      if (distance <= 1.9) {
        best = { type: 'vishnya', distance };
      }
    }
    for (const mirror of mirrorLayout(room)) {
      const distance = Math.hypot(px - mirror.x, py - mirror.y);
      if (distance <= 1.8 && (!best || distance < best.distance)) {
        best = { type: 'mirror', mirror, distance };
      }
    }
    return best;
  }

  function interact(target) {
    if (!target) return false;
    const room = mirrorRoom();
    if (!room) return false;
    const npc = ensureNpc(room);

    if (target.type === 'mirror') {
      const mirror = target.mirror;
      const first = markSeen(mirror.id);
      ZQ.appendLog(mirror.title, 'sys', false, 'ЗЕРКАЛО');
      for (const line of mirror.lines) {
        ZQ.appendLog(line, 'story', false, 'ЗЕРКАЛО');
      }
      if (first) ZQ.logEvent('actions', `осмотрел «${mirror.label}»`, 'зеркало');
      if (seenCount() >= 3 && phase() === PHASE.met) {
        setPhase(PHASE.ready);
        ZQ.appendLog(
          'Вишня поднимает голову. «Ну? Кто здесь лишняя?» Ответь: «ответить я», «ответить ты» или «ответить никто».',
          'reply',
          true,
          'ВИШНЯ'
        );
      } else if (first) {
        ZQ.appendLog(mirror.clue, 'reply', true, 'зеркало');
        if (seenCount() < 3) {
          ZQ.appendLog(`Осмотрено зеркал: ${seenCount()} из 3.`, 'sys', true);
        }
      }
      if (ZQ.updatePrompt) ZQ.updatePrompt();
      return true;
    }

    if (target.type !== 'vishnya') return false;
    const current = phase();
    if (current === PHASE.unmet) {
      setPhase(PHASE.met);
      ZQ.appendLog('Вишня поднимает глаза. В отражении телефона мелькает твоё лицо.', 'story', false, 'ВИШНЯ');
      ZQ.appendLog(
        '«Три зеркала. Одно лжёт. Осмотри все — и я скажу, кто здесь лишняя».',
        'reply',
        true,
        'ВИШНЯ'
      );
      ZQ.logEvent('actions', 'заговорил с Вишней', 'зеркало');
      ZQ.saveGame();
    } else if (current === PHASE.met) {
      const left = 3 - seenCount();
      ZQ.appendLog(
        `«Смотри внимательнее. Осталось зеркал: ${left}».`,
        'reply',
        true,
        'ВИШНЯ'
      );
    } else if (current === PHASE.ready) {
      ZQ.appendLog(
        '«Кто здесь лишняя?» — спрашивает она. Ответь: «ответить я», «ответить ты» или «ответить никто».',
        'reply',
        true,
        'ВИШНЯ'
      );
    } else if (current === PHASE.trust) {
      ZQ.appendLog(
        '«Иди. Я не стану тебя стирать. И Косточка не даст тебе пропасть в болоте».',
        'reply',
        true,
        'ВИШНЯ'
      );
    } else if (current === PHASE.neutral) {
      ZQ.appendLog('В зале только зеркала. Вишня уже ушла.', 'reply', true, 'ЗЕРКАЛО');
    } else if (current === PHASE.hostile) {
      ZQ.appendLog('«Поздно», — говорит она. Зеркала не отражают тебя.', 'reply', true, 'ВИШНЯ');
    } else if (current === PHASE.regret) {
      ZQ.appendLog('«Я не хотела», — говорит она из глубины рамы.', 'reply', true, 'ВИШНЯ');
    }
    if (ZQ.updatePrompt) ZQ.updatePrompt();
    return true;
  }

  function moveToward(npc, target, speed, dt) {
    const dx = target.x - npc.x;
    const dy = target.y - npc.y;
    const distance = Math.hypot(dx, dy);
    if (distance < 0.04) {
      npc.moving = false;
      return;
    }
    const step = Math.min(distance, speed * dt);
    const nx = npc.x + (dx / distance) * step;
    const ny = npc.y + (dy / distance) * step;
    let moved = false;
    if (ZQ.canStandAt(nx, npc.y)) {
      npc.x = nx;
      moved = true;
    }
    if (ZQ.canStandAt(npc.x, ny)) {
      npc.y = ny;
      moved = true;
    }
    npc.moving = moved;
    if (moved) {
      npc.stride = (npc.stride || 0) + step * 2.4;
      npc.facing = Math.atan2(dy, dx);
    }
  }

  function reflectionTarget(room) {
    const player = rt.state.player;
    const cx = room.centerX + 0.5;
    const cy = room.centerY + 0.5;
    const candidates = [
      { x: 2 * cx - player.x, y: 2 * cy - player.y },
      { x: 2 * cx - player.x, y: player.y },
      { x: player.x, y: 2 * cy - player.y },
      home(room)
    ];
    for (const candidate of candidates) {
      const x = clamp(candidate.x, room.x1 + 1.1, room.x2 - 0.6);
      const y = clamp(candidate.y, room.y1 + 1.1, room.y2 - 0.6);
      if (ZQ.canStandAt(x, y)) return { x, y };
    }
    return home(room);
  }

  function followTarget(room) {
    const player = rt.state.player;
    const fx = Number.isFinite(player.facingX) ? player.facingX : 0;
    const fy = Number.isFinite(player.facingY) ? player.facingY : -1;
    const side = 0.9;
    const back = 1.15;
    const candidates = [
      { x: player.x - fx * back - fy * side, y: player.y - fy * back + fx * side },
      { x: player.x - fx * back + fy * side, y: player.y - fy * back - fx * side },
      { x: player.x - fx * back, y: player.y - fy * back },
      home(room)
    ];
    for (const candidate of candidates) {
      if (ZQ.canStandAt(candidate.x, candidate.y)) return candidate;
    }
    return home(room);
  }

  function ensureDog() {
    const npc = runtime();
    if (!npc.dog || !Number.isFinite(npc.dog.x) || !Number.isFinite(npc.dog.y)) {
      npc.dog = {
        x: rt.state.player.x - 1.1,
        y: rt.state.player.y + 0.6,
        facing: 0,
        stride: 0
      };
    }
    return npc.dog;
  }

  function updateDog(dt) {
    if (!flags().mirrorDog || !rt.state || !rt.state.player) return;
    const dog = ensureDog();
    const player = rt.state.player;
    const fx = Number.isFinite(player.facingX) ? player.facingX : 0;
    const fy = Number.isFinite(player.facingY) ? player.facingY : -1;
    const target = {
      x: player.x - fx * 0.95 - fy * 0.62,
      y: player.y - fy * 0.95 + fx * 0.62
    };
    const distance = Math.hypot(dog.x - player.x, dog.y - player.y);
    if (distance > 6) {
      dog.x = target.x;
      dog.y = target.y;
    } else {
      const dx = target.x - dog.x;
      const dy = target.y - dog.y;
      const targetDistance = Math.hypot(dx, dy);
      if (targetDistance > 0.18) {
        const step = Math.min(targetDistance, 4.2 * dt);
        const nx = dog.x + (dx / targetDistance) * step;
        const ny = dog.y + (dy / targetDistance) * step;
        if (ZQ.canStandAt(nx, dog.y)) dog.x = nx;
        if (ZQ.canStandAt(dog.x, ny)) dog.y = ny;
        dog.facing = Math.atan2(dy, dx);
        dog.stride = (dog.stride || 0) + step * 5;
      }
    }
    warnAboutAmbush(dog);
  }

  function warnAboutAmbush(dog) {
    const npc = runtime();
    const now = ZQ.now();
    if (now < (npc.warnAt || 0)) return;
    const player = rt.state.player;
    let nearest = null;
    let nearestDistance = Infinity;
    if (typeof ZQ.roamBelzebufos === 'function') {
      for (const frog of ZQ.roamBelzebufos()) {
        const distance = Math.hypot(frog.x - player.x, frog.y - player.y);
        if (distance < nearestDistance) {
          nearestDistance = distance;
          nearest = frog;
        }
      }
    }
    if (nearest && nearestDistance < 8) {
      npc.warnAt = now + 18000;
      ZQ.appendLog(
        'Косточка тихо рычит и прижимается к земле. Рядом в болоте кто-то ждёт.',
        'sys',
        true,
        'КОСТОЧКА'
      );
      return;
    }
    const room = typeof ZQ.currentRoom === 'function' ? ZQ.currentRoom() : null;
    if (room && room.faunaKind === 'belzebufo' && npc.warnedRoom !== room.id) {
      const distance = Math.hypot(player.x - (room.centerX + 0.5), player.y - (room.centerY + 0.5));
      if (distance < 10) {
        npc.warnedRoom = room.id;
        npc.warnAt = now + 22000;
        ZQ.appendLog(
          'Косточка упирается лапами. В этом зале пахнет мокрой кожей и ядом.',
          'sys',
          true,
          'КОСТОЧКА'
        );
      }
    }
  }

  function updateMirror(dt) {
    if (!rt.world || !rt.state || !rt.state.player) return;
    if (!Number.isFinite(dt) || dt <= 0) return;
    const room = mirrorRoom();
    if (!room) return;
    const current = phase();
    const npc = ensureNpc(room);

    if (flags().mirrorShardWaiting && ZQ.inventoryFree() > 0) {
      grantShard();
    }

    if (current === PHASE.hostile) {
      if (!playerInRoom(room)) {
        setPhase(PHASE.regret);
        ZQ.appendLog('Зеркала остаются позади. Она не идёт следом.', 'sys', true);
        return;
      }
      const now = ZQ.now();
      if (now > (flags().mirrorHostileUntil || 0)) {
        setPhase(PHASE.regret);
        ZQ.appendLog('Зеркала гаснут. Она больше не преследует тебя.', 'sys', true);
        return;
      }
      moveToward(npc, { x: rt.state.player.x, y: rt.state.player.y }, 2.65, dt);
      const distance = Math.hypot(npc.x - rt.state.player.x, npc.y - rt.state.player.y);
      if (now - (flags().mirrorHostileAt || 0) > 1100 && distance < 0.68) {
        setPhase(PHASE.regret);
        flags().mirrorHostileUntil = 0;
        ZQ.appendLog('Стекло касается лица. На миг в нём нет ни тебя, ни её.', 'story', true, 'ВИШНЯ');
        ZQ.die('отражение');
        return;
      }
    } else if (current === PHASE.trust) {
      moveToward(npc, followTarget(room), 2.5, dt);
    } else if (current === PHASE.met || current === PHASE.ready) {
      moveToward(npc, reflectionTarget(room), 1.7, dt);
    } else if (current === PHASE.regret) {
      moveToward(npc, home(room), 0.7, dt);
    } else if (current === PHASE.unmet) {
      moveToward(npc, home(room), 0.5, dt);
    }

    updateDog(dt);
    if (ZQ.updatePrompt) ZQ.updatePrompt();
  }

  function pointInView(x, y, view, ts) {
    return x > -ts * 3 && x < view.w + ts * 3 && y > -ts * 4 && y < view.h + ts * 3;
  }

  function archPath(ctx, w, h) {
    ctx.beginPath();
    ctx.moveTo(-w / 2, 0);
    ctx.lineTo(-w / 2, -h * 0.76);
    ctx.quadraticCurveTo(-w / 2, -h, 0, -h);
    ctx.quadraticCurveTo(w / 2, -h, w / 2, -h * 0.76);
    ctx.lineTo(w / 2, 0);
    ctx.closePath();
  }

  function drawMirror(ctx, sx, sy, ts, now, mirror, seen) {
    const w = ts * 1.02;
    const h = ts * 1.92;
    const flicker = 0.5 + 0.5 * Math.sin(now * 0.0017 + mirror.x * 0.7);
    ctx.save();
    ctx.translate(sx, sy);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.48)';
    ctx.beginPath();
    ctx.ellipse(0, ts * 0.06, w * 0.58, ts * 0.16, 0, 0, Math.PI * 2);
    ctx.fill();

    /* Рама: тёмное дерево, серебряный кант и красная нить. */
    archPath(ctx, w, h);
    ctx.fillStyle = '#2a1918';
    ctx.fill();
    ctx.lineWidth = Math.max(1, ts * 0.06);
    ctx.strokeStyle = '#8d6a58';
    ctx.stroke();

    ctx.save();
    ctx.translate(0, -h * 0.04);
    archPath(ctx, w * 0.78, h * 0.84);
    ctx.fillStyle = '#0a1214';
    ctx.fill();
    const glass = ctx.createLinearGradient(-w * 0.4, -h, w * 0.4, 0);
    glass.addColorStop(0, `rgba(145, 190, 198, ${0.22 + flicker * 0.1})`);
    glass.addColorStop(0.45, 'rgba(74, 108, 116, 0.16)');
    glass.addColorStop(1, 'rgba(198, 220, 218, 0.08)');
    ctx.fillStyle = glass;
    ctx.fill();
    ctx.strokeStyle = 'rgba(198, 223, 222, 0.38)';
    ctx.lineWidth = Math.max(1, ts * 0.025);
    ctx.stroke();

    /* Отражения внутри: у каждого зеркала своя сцена. */
    const cx = 0;
    const baseY = -h * 0.06;
    ctx.save();
    ctx.globalAlpha = 0.72;
    if (mirror.id === 'phone') {
      ctx.fillStyle = '#d7c7bd';
      ctx.beginPath();
      ctx.ellipse(cx - w * 0.02, baseY - h * 0.42, w * 0.115, h * 0.085, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#1b1c22';
      ctx.beginPath();
      ctx.moveTo(cx - w * 0.13, baseY - h * 0.33);
      ctx.lineTo(cx + w * 0.13, baseY - h * 0.33);
      ctx.lineTo(cx + w * 0.2, baseY);
      ctx.lineTo(cx - w * 0.2, baseY);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = `rgba(103, 232, 241, ${0.55 + flicker * 0.35})`;
      ctx.fillRect(cx - w * 0.055, baseY - h * 0.27, w * 0.11, h * 0.14);
      const glow = ctx.createRadialGradient(cx, baseY - h * 0.2, 0, cx, baseY - h * 0.2, w * 0.5);
      glow.addColorStop(0, 'rgba(103, 232, 241, 0.45)');
      glow.addColorStop(1, 'rgba(103, 232, 241, 0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(cx, baseY - h * 0.2, w * 0.5, 0, Math.PI * 2);
      ctx.fill();
    } else if (mirror.id === 'two') {
      for (const side of [-1, 1]) {
        ctx.save();
        ctx.globalAlpha = side > 0 ? 0.28 : 0.78;
        ctx.fillStyle = side > 0 ? '#7f6b78' : '#cbbdb4';
        ctx.beginPath();
        ctx.ellipse(cx + side * w * 0.16, baseY - h * 0.46, w * 0.09, h * 0.07, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = side > 0 ? '#3a2731' : '#26202a';
        ctx.beginPath();
        ctx.moveTo(cx + side * w * 0.26, baseY - h * 0.4);
        ctx.lineTo(cx + side * w * 0.06, baseY - h * 0.4);
        ctx.lineTo(cx + side * w * 0.02, baseY);
        ctx.lineTo(cx + side * w * 0.3, baseY);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
      ctx.strokeStyle = 'rgba(226, 51, 78, 0.75)';
      ctx.lineWidth = Math.max(1, ts * 0.035);
      ctx.beginPath();
      ctx.moveTo(cx + w * 0.08, baseY - h * 0.4);
      ctx.quadraticCurveTo(cx + w * 0.3, baseY - h * 0.2, cx + w * 0.22, baseY - h * 0.05);
      ctx.stroke();
    } else if (mirror.id === 'dog') {
      ctx.fillStyle = '#191317';
      ctx.beginPath();
      ctx.ellipse(cx + w * 0.04, baseY - h * 0.09, w * 0.16, h * 0.05, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(cx + w * 0.14, baseY - h * 0.16, w * 0.07, h * 0.055, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(cx + w * 0.08, baseY - h * 0.2);
      ctx.lineTo(cx + w * 0.1, baseY - h * 0.26);
      ctx.lineTo(cx + w * 0.14, baseY - h * 0.2);
      ctx.fill();
      ctx.fillStyle = 'rgba(227, 52, 81, 0.85)';
      ctx.fillRect(cx + w * 0.09, baseY - h * 0.14, w * 0.1, h * 0.018);
    }
    ctx.restore();

    if (seen) {
      ctx.strokeStyle = 'rgba(226, 232, 230, 0.5)';
      ctx.lineWidth = Math.max(1, ts * 0.018);
      ctx.beginPath();
      ctx.moveTo(-w * 0.16, -h * 0.62);
      ctx.lineTo(-w * 0.04, -h * 0.44);
      ctx.lineTo(-w * 0.11, -h * 0.37);
      ctx.lineTo(w * 0.03, -h * 0.2);
      ctx.stroke();
      ctx.fillStyle = 'rgba(221, 47, 76, 0.92)';
      ctx.beginPath();
      ctx.arc(-w * 0.02, -h * 0.49, Math.max(1.2, ts * 0.035), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    /* Красная нить с вишнёвой бусиной на раме. */
    ctx.strokeStyle = 'rgba(222, 42, 72, 0.8)';
    ctx.lineWidth = Math.max(1, ts * 0.022);
    ctx.beginPath();
    ctx.moveTo(w * 0.45, -h * 0.72);
    ctx.quadraticCurveTo(w * 0.6, -h * 0.5, w * 0.43, -h * 0.34);
    ctx.stroke();
    ctx.fillStyle = '#c81f3f';
    ctx.beginPath();
    ctx.arc(w * 0.43, -h * 0.32, Math.max(1.4, ts * 0.045), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawVishnya(ctx, sx, sy, ts, now, npc, hostile) {
    const h = ts * 2.02;
    const bob = Math.sin(now * 0.0024 + (npc.phase || 0)) * ts * 0.025;
    const stride = Math.sin(npc.stride || 0) * (npc.moving ? 0.5 : 0);
    const flicker = 0.5 + 0.5 * Math.sin(now * 0.009);

    ctx.save();
    ctx.translate(sx, sy + bob);

    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.beginPath();
    ctx.ellipse(0, ts * 0.08, h * 0.2, ts * 0.105, 0, 0, Math.PI * 2);
    ctx.fill();

    if (hostile) {
      for (let i = 1; i <= 2; i += 1) {
        ctx.save();
        ctx.globalAlpha = 0.16 - i * 0.04;
        ctx.translate(Math.sin(now * 0.013 + i) * ts * 0.18 * i, -i * ts * 0.05);
        drawVishnyaBody(ctx, h, ts, now, npc, stride, flicker, true);
        ctx.restore();
      }
    }
    drawVishnyaBody(ctx, h, ts, now, npc, stride, flicker, hostile);
    ctx.restore();
  }

  function drawVishnyaBody(ctx, h, ts, now, npc, stride, flicker, hostile) {
    const legW = h * 0.052;
    const legY = h * 0.72;
    const hipY = -h * 0.68;
    const shoulderY = -h * 1.2;
    const headY = -h * 1.39;
    const headR = h * 0.078;

    /* Ноги и тяжёлые ботинки. */
    for (const side of [-1, 1]) {
      ctx.strokeStyle = '#17151c';
      ctx.lineWidth = legW;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(side * h * 0.055, hipY);
      ctx.lineTo(side * h * 0.052 + stride * h * 0.018, -h * 0.08);
      ctx.stroke();
      ctx.fillStyle = '#0e0d12';
      ctx.beginPath();
      ctx.ellipse(side * h * 0.055 + stride * h * 0.018, -h * 0.035, h * 0.052, h * 0.03, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    /* Юбка и куртка: тёмный силуэт с вишнёвой подкладкой. */
    ctx.fillStyle = '#1b1720';
    ctx.beginPath();
    ctx.moveTo(-h * 0.15, hipY);
    ctx.lineTo(h * 0.15, hipY);
    ctx.lineTo(h * 0.2, -h * 0.46);
    ctx.lineTo(-h * 0.2, -h * 0.46);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(171, 35, 62, 0.72)';
    ctx.beginPath();
    ctx.moveTo(-h * 0.18, -h * 0.44);
    ctx.lineTo(h * 0.18, -h * 0.44);
    ctx.lineTo(h * 0.12, -h * 0.36);
    ctx.lineTo(-h * 0.12, -h * 0.36);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#231c27';
    ctx.beginPath();
    ctx.moveTo(-h * 0.15, shoulderY);
    ctx.quadraticCurveTo(-h * 0.19, -h * 1.02, -h * 0.12, -h * 0.72);
    ctx.lineTo(h * 0.12, -h * 0.72);
    ctx.quadraticCurveTo(h * 0.19, -h * 1.02, h * 0.15, shoulderY);
    ctx.closePath();
    ctx.fill();

    /* Руки: одна держит телефон, вторая — сигарету у лица. */
    ctx.strokeStyle = '#211b26';
    ctx.lineWidth = h * 0.045;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-h * 0.12, shoulderY + h * 0.05);
    ctx.lineTo(-h * 0.24, -h * 0.9);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(h * 0.12, shoulderY + h * 0.05);
    ctx.lineTo(h * 0.19, -h * 1.16);
    ctx.stroke();

    /* Телефон с холодным экраном. */
    ctx.save();
    const phoneX = -h * 0.26;
    const phoneY = -h * 0.84;
    const glow = ctx.createRadialGradient(phoneX, phoneY, 0, phoneX, phoneY, h * 0.18);
    glow.addColorStop(0, `rgba(104, 232, 242, ${0.45 + flicker * 0.3})`);
    glow.addColorStop(1, 'rgba(104, 232, 242, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(phoneX, phoneY, h * 0.18, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#0c1316';
    ctx.fillRect(phoneX - h * 0.035, phoneY - h * 0.055, h * 0.07, h * 0.11);
    ctx.fillStyle = `rgba(117, 240, 246, ${0.65 + flicker * 0.3})`;
    ctx.fillRect(phoneX - h * 0.025, phoneY - h * 0.042, h * 0.05, h * 0.082);
    ctx.restore();

    /* Сигарета с вишней: белая бумага, красный огонёк, дым. */
    const cigX = h * 0.2;
    const cigY = -h * 1.17;
    ctx.strokeStyle = '#e6ddd4';
    ctx.lineWidth = h * 0.018;
    ctx.beginPath();
    ctx.moveTo(cigX, cigY);
    ctx.lineTo(cigX + h * 0.08, cigY - h * 0.02);
    ctx.stroke();
    ctx.fillStyle = '#d42445';
    ctx.beginPath();
    ctx.arc(cigX + h * 0.086, cigY - h * 0.022, h * 0.014, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = `rgba(214, 210, 203, ${0.16 + flicker * 0.12})`;
    ctx.lineWidth = h * 0.012;
    ctx.beginPath();
    ctx.moveTo(cigX + h * 0.09, cigY - h * 0.03);
    ctx.bezierCurveTo(
      cigX + h * 0.16, cigY - h * 0.14,
      cigX + h * 0.03, cigY - h * 0.22,
      cigX + h * 0.1, cigY - h * 0.32
    );
    ctx.stroke();

    /* Шея, голова, длинные волосы с красной прядью. */
    ctx.fillStyle = '#d8c0b8';
    ctx.fillRect(-h * 0.032, -h * 1.33, h * 0.064, h * 0.11);
    ctx.fillStyle = '#16121a';
    ctx.beginPath();
    ctx.ellipse(0, headY, headR * 1.22, headR * 1.24, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#e0c9c0';
    ctx.beginPath();
    ctx.ellipse(0, headY + headR * 0.06, headR * 0.88, headR * 1.0, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#16121a';
    ctx.beginPath();
    ctx.moveTo(-headR * 1.1, headY + headR * 0.15);
    ctx.quadraticCurveTo(-headR * 1.5, headY + headR * 1.9, -headR * 0.5, headY + headR * 2.1);
    ctx.quadraticCurveTo(headR * 0.1, headY + headR * 1.6, headR * 0.35, headY + headR * 0.55);
    ctx.quadraticCurveTo(headR * 0.6, headY + headR * 1.75, headR * 1.15, headY + headR * 1.3);
    ctx.quadraticCurveTo(headR * 1.4, headY - headR * 0.2, headR * 0.85, headY - headR * 0.85);
    ctx.lineTo(-headR * 0.85, headY - headR * 0.85);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(196, 34, 62, 0.9)';
    ctx.lineWidth = h * 0.018;
    ctx.beginPath();
    ctx.moveTo(-headR * 0.45, headY - headR * 0.3);
    ctx.quadraticCurveTo(-headR * 0.8, headY + headR * 1.2, -headR * 0.3, headY + headR * 1.95);
    ctx.stroke();

    /* Глаза и тонкая улыбка. В ярости — красный блик. */
    const eyeColor = hostile ? '#f04b64' : '#2a2024';
    ctx.fillStyle = eyeColor;
    ctx.beginPath();
    ctx.ellipse(-headR * 0.3, headY + headR * 0.12, headR * 0.075, headR * 0.11, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(headR * 0.3, headY + headR * 0.12, headR * 0.075, headR * 0.11, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = hostile ? 'rgba(222, 45, 73, 0.95)' : 'rgba(97, 52, 61, 0.85)';
    ctx.lineWidth = h * 0.014;
    ctx.beginPath();
    ctx.arc(0, headY + headR * 0.3, headR * 0.24, 0.25, Math.PI - 0.25);
    ctx.stroke();

    if (hostile) {
      const aura = ctx.createRadialGradient(0, -h * 0.9, 0, 0, -h * 0.9, h * 0.55);
      aura.addColorStop(0, `rgba(225, 42, 76, ${0.12 + flicker * 0.09})`);
      aura.addColorStop(1, 'rgba(225, 42, 76, 0)');
      ctx.fillStyle = aura;
      ctx.beginPath();
      ctx.arc(0, -h * 0.9, h * 0.55, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawDog(ctx, sx, sy, ts, now, dog) {
    const h = ts * 0.52;
    const bob = Math.sin(now * 0.008 + (dog.stride || 0)) * ts * 0.025;
    const wag = Math.sin(now * 0.014) * 0.5;
    ctx.save();
    ctx.translate(sx, sy + bob);
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.beginPath();
    ctx.ellipse(0, ts * 0.03, h * 0.42, ts * 0.08, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#171318';
    ctx.beginPath();
    ctx.ellipse(0, -h * 0.28, h * 0.42, h * 0.24, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(h * 0.36, -h * 0.4, h * 0.22, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(h * 0.25, -h * 0.55);
    ctx.lineTo(h * 0.2, -h * 0.82);
    ctx.lineTo(h * 0.4, -h * 0.62);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(h * 0.44, -h * 0.55);
    ctx.lineTo(h * 0.54, -h * 0.82);
    ctx.lineTo(h * 0.58, -h * 0.55);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#171318';
    ctx.lineWidth = h * 0.1;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-h * 0.32, -h * 0.36);
    ctx.quadraticCurveTo(-h * 0.72, -h * 0.5 + wag * h * 0.1, -h * 0.78, -h * 0.72);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(210, 38, 66, 0.95)';
    ctx.lineWidth = h * 0.08;
    ctx.beginPath();
    ctx.moveTo(h * 0.24, -h * 0.3);
    ctx.lineTo(h * 0.48, -h * 0.3);
    ctx.stroke();
    ctx.fillStyle = '#f1d8b8';
    ctx.beginPath();
    ctx.arc(h * 0.5, -h * 0.43, h * 0.045, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawRevealMarks(ctx, params) {
    const { state, view, ts, toScreenX, toScreenY, now } = params;
    if (!state.items || !state.items.includes('mirror_shard')) return;
    if (typeof ZQ.roamBelzebufos !== 'function') return;
    for (const frog of ZQ.roamBelzebufos()) {
      const distance = Math.hypot(frog.x - state.player.x, frog.y - state.player.y);
      if (distance > 14) continue;
      const sx = toScreenX(frog.x);
      const sy = toScreenY(frog.y);
      if (!pointInView(sx, sy, view, ts)) continue;
      const pulse = 0.5 + 0.5 * Math.sin(now * 0.004 + frog.x);
      ctx.save();
      ctx.strokeStyle = `rgba(231, 47, 78, ${0.28 + pulse * 0.35})`;
      ctx.lineWidth = Math.max(1, ts * 0.035);
      ctx.beginPath();
      ctx.arc(sx, sy - ts * 0.2, ts * (0.55 + pulse * 0.12), 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = `rgba(255, 138, 158, ${0.5 + pulse * 0.4})`;
      ctx.beginPath();
      ctx.arc(sx, sy - ts * 0.78, Math.max(1.2, ts * 0.04), 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  function drawMirrorWorld(ctx, params) {
    const { state, view, ts, toScreenX, toScreenY, now } = params;
    if (!state || !rt.state) return;
    drawRevealMarks(ctx, params);

    const room = mirrorRoom();
    if (room) {
      const seen = seenMap();
      for (const mirror of mirrorLayout(room)) {
        const sx = toScreenX(mirror.x);
        const sy = toScreenY(mirror.y);
        if (!pointInView(sx, sy, view, ts)) continue;
        drawMirror(ctx, sx, sy, ts, now, mirror, seen[mirror.id]);
      }

      const current = phase();
      if (current !== PHASE.neutral) {
        const npc = ensureNpc(room);
        const sx = toScreenX(npc.x);
        const sy = toScreenY(npc.y);
        if (pointInView(sx, sy, view, ts)) {
          drawVishnya(ctx, sx, sy, ts, now, npc, current === PHASE.hostile);
        }
      }
    }

    if (flags().mirrorDog) {
      const dog = ensureDog();
      const sx = toScreenX(dog.x);
      const sy = toScreenY(dog.y);
      if (pointInView(sx, sy, view, ts)) drawDog(ctx, sx, sy, ts, now, dog);
    }
  }

  ZQ.mirrorRoom = mirrorRoom;
  ZQ.mirrorTarget = mirrorTarget;
  ZQ.mirrorInteract = interact;
  ZQ.mirrorAnswer = answer;
  ZQ.mirrorForgive = forgive;
  ZQ.mirrorStatus = status;
  ZQ.mirrorRoomDescription = roomDescription;
  ZQ.updateMirror = updateMirror;
  ZQ.drawMirrorWorld = drawMirrorWorld;
})();
