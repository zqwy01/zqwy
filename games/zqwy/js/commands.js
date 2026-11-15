/* Команды терминала и справка. */
(function () {
  'use strict';

  const ZQ = window.ZQ;
  const C = ZQ.C;
  const rt = ZQ.rt;
  const dom = ZQ.dom;

  const LOG_KEYS = ZQ.LOG_KEYS ||
    ['terminal', 'scenes', 'system', 'world', 'movement', 'actions', 'commands'];

  function t(ru, en, de) {
    const code = window.ZQI18N && window.ZQI18N.lang ? window.ZQI18N.lang : 'ru';
    if (code === 'de') return de || en || ru;
    return code === 'en' ? (en || ru) : ru;
  }

  /* Английские названия команд из подсказки работают и в русском
     интерфейсе: перед разбором строка приводится к русскому канону. */
  const ALIASES = {
    help: 'помоги',
    hello: 'привет',
    'where did you go': 'ты куда пропал',
    'come closer': 'подойди',
    'look around': 'осмотреться',
    mirror: 'отражение',
    reflection: 'отражение',
    vishnya: 'отражение',
    'mirror hall': 'отражение',
    answer: 'ответить',
    'answer me': 'ответить я',
    'answer you': 'ответить ты',
    'answer nobody': 'ответить никто',
    forgive: 'прости',
    'forgive me': 'прости',
    story: 'сюжет',
    logging: 'логгирование',
    history: 'история',
    settings: 'настройки',
    'settings terminal': 'настройки терминал',
    save: 'сохранить',
    load: 'загрузить',
    export: 'экспорт',
    import: 'импорт',
    slots: 'слоты',
    rename: 'переименовать',
    delete: 'удалить',
    language: 'язык',
    music: 'музыка',
    player: 'плеер',
    clear: 'очисти',
    'new game': 'новая игра',
    backpack: 'рюкзак',
    inventory: 'инвентарь',
    layouts: 'макеты',
    map: 'карта',
    mark: 'пометить',
    table: 'стол',
    enchant: 'очаровать',
    action: 'действие',
    cursor: 'курсор',
    umbrella: 'зонт',
    chances: 'шансы',
    'belzebufo chance': 'шанс бельзебуфо',
    teleport: 'телепорт',
    tp: 'телепорт',
    тп: 'телепорт',
    stop: 'стоп',
    dash: 'рывок',
    surrender: 'сдаться',
    'give up': 'сдаться',
    'dash unlock': 'рывок открыть',
    'dash lock': 'рывок закрыть',
    ausweichen: 'рывок',
    aufgeben: 'сдаться',
    up: 'вверх',
    down: 'вниз',
    left: 'влево',
    right: 'вправо',
    hilfe: 'помоги',
    musik: 'музыка',
    sprache: 'язык',
    einstellungen: 'настройки',
    speichern: 'сохранить',
    laden: 'загрузить',
    exportieren: 'экспорт',
    tabelle: 'стол',
    karte: 'карта',
    rucksack: 'рюкзак',
    inventar: 'инвентарь',
    geschichte: 'сюжет',
    protokoll: 'логгирование',
    hallo: 'привет',
    'neues spiel': 'новая игра',
    halt: 'стоп',
    markieren: 'пометить',
    handlung: 'действие',
    umschauen: 'осмотреться',
    'komm näher': 'подойди'
  };

  const PREFIX_ALIASES = [
    [/^layout speichern\b/, 'макет сохранить'],
    [/^layout save\b/, 'макет сохранить'],
    [/^layout\b/, 'макет'],
    [/^save slot\b/, 'сохранить слот'],
    [/^load slot\b/, 'загрузить слот'],
    [/^rename slot\b/, 'переименовать слот'],
    [/^delete slot\b/, 'удалить слот'],
    [/^slot speichern\b/, 'сохранить слот'],
    [/^slot laden\b/, 'загрузить слот'],
    [/^slot umbenennen\b/, 'переименовать слот'],
    [/^slot löschen\b/, 'удалить слот'],
    [/^slots\b/, 'слоты'],
    [/^import\b/, 'импорт'],
    [/^story chance\b/, 'шанс сюжет'],
    [/^fauna chance\b/, 'шанс фауны'],
    [/^belzebufo chance\b/, 'шанс бельзебуфо'],
    [/^teleport\b/, 'телепорт'],
    [/^tp\b/, 'телепорт'],
    [/^тп\b/, 'телепорт'],
    [/^cursor\b/, 'курсор'],
    [/^dash unlock\b/, 'рывок открыть'],
    [/^dash lock\b/, 'рывок закрыть'],
    [/^dash\b/, 'рывок'],
    [/^ausweichen\b/, 'рывок'],
    [/^give up\b/, 'сдаться'],
    [/^surrender\b/, 'сдаться'],
    [/^aufgeben\b/, 'сдаться'],
    [/^umbrella\b/, 'зонт'],
    [/^help\b/, 'помоги'],
    [/^hilfe\b/, 'помоги'],
    [/^walk\b/, 'идти'],
    [/^laufen\b/, 'идти'],
    [/^logging\b/, 'логгирование'],
    [/^protokoll\b/, 'логгирование'],
    [/^language\b/, 'язык'],
    [/^sprache\b/, 'язык']
  ];

  const DIRECTION_EN = {
    up: 'вверх',
    down: 'вниз',
    left: 'влево',
    right: 'вправо',
    oben: 'вверх',
    unten: 'вниз',
    links: 'влево',
    rechts: 'вправо',
    hoch: 'вверх',
    runter: 'вниз',
    halt: 'стоп',
    markieren: 'пометить',
    handlung: 'действие',
    umschauen: 'осмотреться',
    'komm näher': 'подойди'
  };

  const DIRECTION_DE = DIRECTION_EN;

  function canonicalCommand(value) {
    let cmd = String(value || '').toLowerCase().replace(/\s+/g, ' ').trim();
    if (ALIASES[cmd]) return ALIASES[cmd];
    for (const [pattern, replacement] of PREFIX_ALIASES) {
      if (pattern.test(cmd)) {
        cmd = cmd.replace(pattern, replacement);
        break;
      }
    }
    /* «идти down 10» после замены префикса становится «идти вниз 10». */
    cmd = cmd.replace(/\b(up|down|left|right)\b/g, (word) => DIRECTION_EN[word] || word);
    /* Немецкие направления: «laufen oben» → «идти вверх». */
    cmd = cmd.replace(/\b(oben|unten|links|rechts|hoch|runter)\b/g, (word) => DIRECTION_DE[word] || word);
    return cmd;
  }

  function commandGroup(name) {
    const needle = String(name || '').trim().toLowerCase();
    if (!needle) return null;
    const alias = ['музыка', 'music', 'musik'].includes(needle) ? 'плеер' : needle;
    return C.terminal.helpGroups.find((group) =>
      String(group.id).toLowerCase() === alias ||
      String(group.title).toLowerCase() === alias
    ) || null;
  }

  function groupUnlocked(group) {
    return !group.unlock || ZQ.hasUnlock(group.unlock);
  }

  /* Закрытые группы не показываются вовсе: игрок не должен видеть
     команды, к которым ещё нет доступа. */
  function helpOverview() {
    const lines = [t('Группы команд:', 'Command groups:')];
    for (const group of C.terminal.helpGroups) {
      if (!groupUnlocked(group)) continue;
      lines.push(`• ${group.title} — ${group.description}`);
    }
    lines.push(t(
      'Подробнее: «помоги движение». Так видно только нужный список.',
      'Details: “help movement”. This shows only the list you need.'
    ));
    return lines.join('\n');
  }

  function helpGroup(group) {
    if (!groupUnlocked(group)) {
      return C.terminal.helpLocked
        .replace('{title}', group.title)
        .replace('{hint}', ZQ.unlockHint(group.unlock));
    }
    const lines = [
      C.terminal.helpGroup
        .replace('{title}', group.title)
        .replace('{description}', group.description)
    ];
    for (const entry of group.commands) {
      lines.push(`• ${entry.command} — ${entry.description}`);
    }
    return lines.join('\n');
  }

  function loggingStatus() {
    const logging = rt.termSettings.logging;
    const mark = (on) => on ? t('вкл', 'on') : t('выкл', 'off');
    const parts = LOG_KEYS.map((key) => `${ZQ.categoryName(key)} — ${mark(logging[key])}`);
    return [
      t(`Логгирование: ${logging.enabled ? 'включено' : 'выключено'}.`,
        `Logging: ${logging.enabled ? 'on' : 'off'}.`),
      t(`Категории: ${parts.join('; ')}.`, `Categories: ${parts.join('; ')}.`),
      t(
        'Использование: «логгирование вкл», «выкл», «всё», «ничего» или категория: «логгирование движение», «логгирование терминал».',
        'Usage: “logging on”, “off”, “all”, “none” or a category: “logging movement”, “logging terminal”.'
      )
    ].join('\n');
  }

  function loggingCommand(arg) {
    const value = String(arg || '').trim().toLowerCase();
    const logging = rt.termSettings.logging;
    if (!value) return loggingStatus();
    if (value === 'вкл' || value === 'включи' || value === 'on') {
      ZQ.setLogging('enabled', true);
      return `Логгирование включено. ${ZQ.loggingSummary()}.`;
    }
    if (value === 'выкл' || value === 'выключи' || value === 'off') {
      ZQ.setLogging('enabled', false);
      return 'Логгирование выключено.';
    }
    if (value === 'всё' || value === 'все' || value === 'all') {
      ZQ.setLogging('enabled', true);
      for (const key of LOG_KEYS) ZQ.setLogging(key, true);
      return 'Логгирование включено для всех категорий.';
    }
    if (value === 'ничего' || value === 'none') {
      for (const key of LOG_KEYS) ZQ.setLogging(key, false);
      ZQ.setLogging('enabled', false);
      return 'Логгирование выключено, все категории сброшены.';
    }
    const categories = {
      терминал: 'terminal',
      terminal: 'terminal',
      сцены: 'scenes',
      сцена: 'scenes',
      scenes: 'scenes',
      система: 'system',
      системные: 'system',
      system: 'system',
      мир: 'world',
      world: 'world',
      движение: 'movement',
      шаги: 'movement',
      movement: 'movement',
      действия: 'actions',
      действие: 'actions',
      actions: 'actions',
      команды: 'commands',
      команда: 'commands',
      commands: 'commands'
    };
    const key = categories[value];
    if (!key) {
      return `Неизвестная категория «${arg}». ${loggingStatus()}`;
    }
    const next = !logging[key];
    ZQ.setLogging(key, next);
    if (next && !logging.enabled) ZQ.setLogging('enabled', true);
    return `Категория «${ZQ.categoryName(key)}»: ${next ? 'включена' : 'выключена'}. ${ZQ.loggingSummary()}.`;
  }

  function secondsFrom(value) {
    const parsed = Number(String(value || '').replace(',', '.'));
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
  }

  function movementCommand(value) {
    const match = value.match(
      /^(?:идти\s+)?(вверх|вниз|влево|вправо)(?:\s+(\d+(?:[.,]\d+)?))?$/
    );
    if (!match) return '';
    return ZQ.startTimedMove(match[1], secondsFrom(match[2]));
  }

  function languageText() {
    const code = window.ZQI18N && window.ZQI18N.lang ? window.ZQI18N.lang : 'ru';
    const name = code === 'de' ? 'Deutsch' : code === 'en' ? 'English' : 'русский';
    return t(
      `Язык: ${name}. Переключение: «язык английский», «язык немецкий» или «язык русский».`,
      `Language: ${name}. Switch with “language english”, “language german” or “language russian”.`,
      `Sprache: ${name}. Wechseln mit „sprache deutsch“, „sprache englisch“ oder „sprache russisch“.`
    );
  }

  function languageCommand(arg) {
    const value = String(arg || '').trim().toLowerCase();
    if (!value) return languageText();
    if (value === 'английский' || value === 'англ' || value === 'english' || value === 'eng' || value === 'englisch') {
      if (window.ZQI18N) window.ZQI18N.apply('en');
      return '';
    }
    if (value === 'немецкий' || value === 'нем' || value === 'deutsch' || value === 'german' || value === 'de') {
      if (window.ZQI18N) window.ZQI18N.apply('de');
      return '';
    }
    if (value === 'русский' || value === 'рус' || value === 'russian' || value === 'ru' || value === 'russisch') {
      if (window.ZQI18N) window.ZQI18N.apply('ru');
      return '';
    }
    return t(
      `Неизвестный язык «${arg}». ${languageText()}`,
      `Unknown language “${arg}”. ${languageText()}`,
      `Unbekannte Sprache „${arg}“. ${languageText()}`
    );
  }

  function askNumber(arg) {
    const text = String(arg || '').trim().replace(',', '.');
    if (!text) return null;
    const value = Number(text);
    return Number.isFinite(value) ? value : null;
  }

  function percent(value) {
    return `${Math.round(Number(value) * 1000) / 10}%`;
  }

  /* Читы меняют шансы генерации для ещё не созданных комнат. Мир
     пересобирается сразу, чтобы изменения можно было проверить без
     перезапуска. Уже открытые флаги и предметы остаются. */
  function rebuildWorld() {
    if (!rt.state || !window.World) return false;
    rt.world = window.World.generate(rt.state.seed);
    if (typeof ZQ.canStandAt === 'function' &&
        !ZQ.canStandAt(rt.state.player.x, rt.state.player.y)) {
      ZQ.respawnAtTablet();
    }
    rt.state.currentRoomId = null;
    if (typeof ZQ.snapCamera === 'function') ZQ.snapCamera();
    if (typeof ZQ.updateRoomDetection === 'function') ZQ.updateRoomDetection();
    if (typeof ZQ.updatePrompt === 'function') ZQ.updatePrompt();
    if (typeof ZQ.rebuildImages === 'function') ZQ.rebuildImages();
    return true;
  }

  function chancesCommand() {
    const world = C.world || {};
    const fauna = C.fauna || {};
    const lines = [
      'Шансы генерации:',
      `• фауна среди процедурных клеток: ${percent(world.faunaChance === undefined ? 0.22 : world.faunaChance)}`,
      `• сюжетная комната (первая): ${percent(world.storyFirstChance === undefined ? 0.25 : world.storyFirstChance)}`,
      `• сюжетная комната (следующая): ${percent(world.storyNextChance === undefined ? 0.12 : world.storyNextChance)}`,
      `• доля бельзебуфо среди фауны: ${percent(world.belzebufoShare === undefined ? 0.62 : world.belzebufoShare)}`,
      `• встреча с бельзебуфо в комнате фауны: ${percent(fauna.belzebufo && fauna.belzebufo.chance !== undefined ? fauna.belzebufo.chance : 0.62)}`
    ];
    lines.push('Титанобоа: ровно одна комната в мире, шансом не управляется.');
    lines.push('Использование: «шанс фауны 0.4», «шанс сюжет 0.25», «шанс бельзебуфо 0.5».');
    return lines.join('\n');
  }

  function chanceCommand(kind, arg) {
    const world = (C.world || {});
    const value = askNumber(arg);
    if (kind === 'фауны') {
      if (value === null) {
        return t(
          `Шанс фауны: ${percent(world.faunaChance === undefined ? 0.22 : world.faunaChance)}. ` +
            'Использование: «шанс фауны 0.4».',
          `Fauna chance: ${percent(world.faunaChance === undefined ? 0.18 : world.faunaChance)}. ` +
            'Usage: “fauna chance 0.4”.'
        );
      }
      world.faunaChance = ZQ.clamp(value, 0, 1);
      rebuildWorld();
      return t(
        `Шанс фауны теперь ${percent(world.faunaChance)}. Мир пересобран.`,
        `Fauna chance is now ${percent(world.faunaChance)}. The world has been rebuilt.`
      );
    }
    if (kind === 'бельзебуфо') {
      const fauna = C.fauna && C.fauna.belzebufo ? C.fauna.belzebufo : null;
      if (!fauna) return t('Бельзебуфо не настроена.', 'Belzebufo is not configured.');
      if (value === null) {
        return t(
          `Шанс бельзебуфо в комнате фауны: ${percent(fauna.chance === undefined ? 0.62 : fauna.chance)}. ` +
            'Использование: «шанс бельзебуфо 0.5».',
          `Belzebufo chance inside a fauna room: ${percent(fauna.chance === undefined ? 0.62 : fauna.chance)}. ` +
            'Usage: “belzebufo chance 0.5”.'
        );
      }
      fauna.chance = ZQ.clamp(value, 0, 1);
      const flag = C.world && Number.isFinite(C.world.belzebufoShare)
        ? C.world.belzebufoShare
        : null;
      return t(
        `Шанс бельзебуфо теперь ${percent(fauna.chance)}` +
          (flag === null ? '.' : `; доля среди фауны ${percent(flag)}.`),
        `Belzebufo chance is now ${percent(fauna.chance)}` +
          (flag === null ? '.' : `; share among fauna ${percent(flag)}.`)
      );
    }
    if (value === null) {
      const first = world.storyFirstChance === undefined ? 0.25 : world.storyFirstChance;
      const next = world.storyNextChance === undefined ? 0.08 : world.storyNextChance;
      return t(
        `Шанс сюжетной комнаты: первый ${percent(first)}, следующий ${percent(next)}. ` +
          'Использование: «шанс сюжет 0.25».',
        `Story room chance: first ${percent(first)}, next ${percent(next)}. ` +
          'Usage: “story chance 0.25”.'
      );
    }
    world.storyFirstChance = ZQ.clamp(value, 0, 1);
    world.storyNextChance = ZQ.clamp(value, 0, 1);
    rebuildWorld();
    return t(
      `Шанс сюжетной комнаты теперь ${percent(world.storyFirstChance)}. Мир пересобран.`,
      `Story room chance is now ${percent(world.storyFirstChance)}. The world has been rebuilt.`
    );
  }

  /* Чит-телепорт: ищет ближайший уже созданный чанк, в котором есть
     нужная комната, при необходимости досоздаёт чанки кольцами вокруг
     игрока. Полезен, чтобы проверять титанобоа, зонт и особые залы без
     долгого блуждания по бесконечному Лабиринту. */
  const TELEPORT_ROLES = {
    скрижаль: 'tablet',
    табличка: 'tablet',
    tablet: 'tablet',
    испытание: 'trial',
    круг: 'trial',
    trial: 'trial',
    опасность: 'hazard',
    слепой: 'hazard',
    hazard: 'hazard',
    низкий: 'low',
    low: 'low',
    склад: 'storage',
    хранилище: 'storage',
    storage: 'storage',
    перекрёсток: 'crossroad',
    перекресток: 'crossroad',
    crossroad: 'crossroad',
    зеркало: 'mirror',
    зеркальный: 'mirror',
    отражение: 'mirror',
    вишня: 'mirror',
    mirror: 'mirror',
    жук: 'beetle',
    beetle: 'beetle',
    зонт: 'umbrella',
    зонтик: 'umbrella',
    umbrella: 'umbrella',
    титанобоа: 'titanoboa',
    змея: 'titanoboa',
    titanoboa: 'titanoboa',
    бельзебуфо: 'belzebufo',
    жаба: 'belzebufo',
    belzebufo: 'belzebufo',
    процедурная: 'procedural',
    обычная: 'procedural',
    procedural: 'procedural'
  };

  function normalizeTarget(value) {
    return String(value || '').toLowerCase().replace(/ё/g, 'е').replace(/\s+/g, ' ').trim();
  }

  function roomMatches(room, needle) {
    const target = normalizeTarget(needle);
    if (!target) return false;
    const role = TELEPORT_ROLES[target] || target;
    if (room.role === role || room.faunaKind === role) return true;
    if (String(room.id).toLowerCase() === target) return true;
    const name = normalizeTarget(room.name);
    if (name.includes(target)) return true;
    return false;
  }

  function roomDistance(room) {
    const player = rt.state.player;
    return Math.hypot(room.centerX - player.x, room.centerY - player.y);
  }

  function nearestRoom(target) {
    const world = rt.world;
    if (!world || !rt.state) return null;
    const player = rt.state.player;
    const pcx = Math.floor(player.x / world.chunkW);
    const pcy = Math.floor(player.y / world.chunkH);
    const maxRing = 9;
    for (let ring = 0; ring <= maxRing; ring += 1) {
      for (let dx = -ring; dx <= ring; dx += 1) {
        for (let dy = -ring; dy <= ring; dy += 1) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== ring) continue;
          world.ensureChunk(pcx + dx, pcy + dy);
        }
      }
      const candidates = world.rooms.filter((room) => roomMatches(room, target));
      if (candidates.length) {
        candidates.sort((a, b) => roomDistance(a) - roomDistance(b));
        return candidates[0];
      }
    }
    return null;
  }

  function safeSpotInRoom(room) {
    const center = { x: room.centerX + 0.5, y: room.centerY + 0.5 };
    if (ZQ.canStandAt(center.x, center.y)) return center;
    for (let radius = 1; radius <= Math.max(room.w, room.h); radius += 1) {
      for (let dy = -radius; dy <= radius; dy += 1) {
        for (let dx = -radius; dx <= radius; dx += 1) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== radius) continue;
          const x = room.centerX + 0.5 + dx;
          const y = room.centerY + 0.5 + dy;
          if (x < room.ox + 1 || y < room.oy + 1) continue;
          if (x > room.ox + room.w - 1 || y > room.oy + room.h - 1) continue;
          if (ZQ.canStandAt(x, y)) return { x, y };
        }
      }
    }
    return null;
  }

  function teleportToRoom(room) {
    if (!room) return null;
    const spot = safeSpotInRoom(room);
    if (!spot) return null;
    const player = rt.state.player;
    player.x = spot.x;
    player.y = spot.y;
    player.facingX = 0;
    player.facingY = -1;
    player.moving = false;
    rt.cursorMove = null;
    rt.timedMove = null;
    rt.cursorPath = null;
    rt.cursorPathGoal = null;
    /* Сбрасываем текущую комнату: updateRoomDetection должен увидеть
       вход заново и запустить встречу (схватку), как при обычном шаге
       в зал. Иначе телепорт к врагу не начинал бой. */
    rt.state.currentRoomId = null;
    ZQ.resetKeys();
    if (typeof ZQ.snapCamera === 'function') ZQ.snapCamera();
    if (typeof ZQ.updateRoomDetection === 'function') ZQ.updateRoomDetection();
    if (typeof ZQ.updatePrompt === 'function') ZQ.updatePrompt();
    ZQ.logEvent('world', `телепорт: ${room.name} (${room.id})`, 'телепорт');
    return room;
  }

  function teleportHelp() {
    return [
      t('Чит-телепорт к ближайшей нужной комнате.', 'Cheat teleport to the nearest needed room.'),
      t(
        'Использование: «телепорт титанобоа», «телепорт зонт», «телепорт зеркало», «телепорт скрижаль», «телепорт бельзебуфо», «телепорт чанк 2 -1».',
        'Usage: “teleport titanoboa”, “teleport umbrella”, “teleport mirror”, “teleport tablet”, “teleport belzebufo”, “teleport chunk 2 -1”.'
      ),
      t(
        'Доступные цели: скрижаль, испытание, опасность, низкий, склад, перекрёсток, зеркало, жук, зонт, титанобоа, бельзебуфо, процедурная. Можно указать часть имени комнаты.',
        'Targets: tablet, trial, hazard, low, storage, crossroad, mirror, beetle, umbrella, titanoboa, belzebufo, procedural. A part of the room name also works.'
      )
    ].join('\n');
  }

  function teleportCommand(arg) {
    if (!rt.world || !rt.state) {
      return t('Мир ещё не создан.', 'The world has not been created yet.');
    }
    if (rt.battle && rt.battle.active) {
      return t('Сначала закончи схватку.', 'Finish the fight first.');
    }
    if (rt.chase && rt.chase.active) {
      return t('Сначала уйди от титанобоа.', 'Escape the titanoboa first.');
    }
    const raw = String(arg || '').trim();
    if (!raw) return teleportHelp();

    const chunkMatch = normalizeTarget(raw).match(/^(?:чанк|chunk)\s+(-?\d+)\s+(-?\d+)$/);
    if (chunkMatch) {
      const cx = Number(chunkMatch[1]);
      const cy = Number(chunkMatch[2]);
      rt.world.ensureChunk(cx, cy);
      const rooms = rt.world.rooms.filter((room) => room.chunkX === cx && room.chunkY === cy);
      if (!rooms.length) {
        return t(`В чанке ${cx},${cy} нет комнат.`, `Chunk ${cx},${cy} has no rooms.`);
      }
      rooms.sort((a, b) => roomDistance(a) - roomDistance(b));
      const room = teleportToRoom(rooms[0]);
      return room
        ? t(
          `Телепорт в чанк ${cx},${cy}: «${room.name}».`,
          `Teleported to chunk ${cx},${cy}: “${room.name}”.`
        )
        : t('В этом чанке нет места для шага.', 'No safe tile in that chunk.');
    }

    const room = nearestRoom(raw);
    if (!room) {
      return t(
        `Комната «${raw}» не найдена в девяти кольцах чанков. Попробуй другое название.`,
        `No room “${raw}” was found within nine chunk rings. Try another name.`
      );
    }
    const distance = roomDistance(room);
    if (!teleportToRoom(room)) {
      return t('Комната найдена, но в ней нет свободного места.', 'The room was found but has no free tile.');
    }
    const chunk = `${room.chunkX},${room.chunkY}`;
    return t(
      `Телепорт: «${room.name}» (${room.id}), чанк ${chunk}, ${Math.round(distance)} кл. от прежнего места.`,
      `Teleported: “${room.name}” (${room.id}), chunk ${chunk}, ${Math.round(distance)} tiles from the old spot.`
    );
  }

  function layoutCommand(arg) {    const value = String(arg || '').trim();
    if (!value) {
      return typeof ZQ.listCanvasLayouts === 'function'
        ? ZQ.listCanvasLayouts()
        : t('Макеты пока не сохранялись.', 'No layouts have been saved yet.');
    }
    return typeof ZQ.loadCanvasLayout === 'function'
      ? ZQ.loadCanvasLayout(value)
      : t('Стол ещё не готов к макетам.', 'The table is not ready for layouts yet.');
  }

  function saveLayoutCommand(arg) {
    const name = String(arg || '').trim();
    if (!name) {
      return t(
        'Укажи имя макета: «макет сохранить бой».',
        'Name the layout: “layout save fight”.'
      );
    }
    return typeof ZQ.saveCanvasLayout === 'function'
      ? ZQ.saveCanvasLayout(name)
      : t('Стол ещё не готов к макетам.', 'The table is not ready for layouts yet.');
  }

  function slotNameFrom(arg) {
    return String(arg || '').trim();
  }

  function renameSlotNames(arg) {
    const text = String(arg || '').trim();
    if (!text) return null;
    const parts = text.split(/\s*(?:→|->|=>)\s*/);
    if (parts.length < 2) return null;
    const from = parts[0].trim();
    const to = parts.slice(1).join(' → ').trim();
    if (!from || !to) return null;
    return { from, to };
  }

  /* Команды боя: рывок и выход из схватки или погони. Рывок закрыт
     способностью, пока Zemic её не открыл; «рывок открыть» и
     «рывок закрыть» переключают гейт вручную. */
  function dashCommand(arg) {
    const sub = String(arg || '').trim().toLowerCase();
    if (sub === 'открыть' || sub === 'открой' || sub === 'разблокировать' ||
        sub === 'unlock') {
      if (typeof ZQ.setDashAbility !== 'function') {
        return t('Рывок пока недоступен.', 'Dash is not available yet.');
      }
      const before = typeof ZQ.hasDashAbility === 'function' && ZQ.hasDashAbility();
      ZQ.setDashAbility(true, true);
      return before
        ? t('Рывок уже открыт.', 'Dash is already unlocked.')
        : t('Рывок открыт: Shift, ПРОБЕЛ или E дают ускорение.',
          'Dash unlocked: Shift, SPACE or E now accelerate you.');
    }
    if (sub === 'закрыть' || sub === 'закрой' || sub === 'заблокировать' ||
        sub === 'lock') {
      if (typeof ZQ.setDashAbility !== 'function') {
        return t('Рывок пока недоступен.', 'Dash is not available yet.');
      }
      const before = typeof ZQ.hasDashAbility === 'function' && ZQ.hasDashAbility();
      ZQ.setDashAbility(false, true);
      return before
        ? t('Рывок снова закрыт.', 'Dash is locked again.')
        : t('Рывок уже закрыт.', 'Dash is already locked.');
    }
    if (rt.chase && rt.chase.active) {
      const dashed = typeof ZQ.chaseDash === 'function' ? ZQ.chaseDash() : false;
      return dashed
        ? t('Рывок: ты отрываешься от колец.', 'Dash: you pull away from the coils.')
        : t('Рывок не сработал.', 'The dash did not fire.');
    }
    if (rt.battle && rt.battle.active) {
      const dashed = typeof ZQ.attemptDash === 'function' ? ZQ.attemptDash() : false;
      return dashed
        ? t('Рывок: на мгновение ты неуязвим.', 'Dash: for a moment you are untouchable.')
        : t('Рывок не сработал.', 'The dash did not fire.');
    }
    return t('Рывок нужен только в схватке или погоне.',
      'The dash is only needed in a fight or a chase.');
  }

  function surrenderCommand() {
    if (rt.chase && rt.chase.active) {
      if (typeof ZQ.finishChase === 'function') ZQ.finishChase('abort');
      return t('Ты отпускаешь погоню. Титанобоа провожает тебя назад к Скрижали.',
        'You let the chase go. The titanoboa sees you back to the Tablet.');
    }
    if (rt.battle && rt.battle.active) {
      if (typeof ZQ.finishBattle === 'function') ZQ.finishBattle('abort');
      return t('Ты выбираешься из воды, не дожидаясь конца.',
        'You climb out of the water before the end.');
    }
    return t('Сейчас не от чего сдаваться.', 'There is nothing to give up right now.');
  }

  function handleCommand(raw, source) {
    source = source || 'terminal';
    const text = String(raw === null || raw === undefined ? '' : raw).trim();
    const cmd = canonicalCommand(text);
    const moveReply = movementCommand(cmd);
    let reply = '';
    let replyInstant = false;

    if (!text) return '';

    ZQ.logEvent('commands', `> ${text}`, 'команда');

    if (cmd === 'помоги' || cmd === 'помощь' || cmd === 'help') {
      reply = helpOverview();
      replyInstant = true;
    } else if (cmd.startsWith('помоги ') || cmd.startsWith('помощь ')) {
      const requested = cmd.replace(/^помо[гщ][ьи]\s+/, '');
      const group = commandGroup(requested);
      reply = group ? helpGroup(group) : `${C.terminal.unknownGroup}«${requested}»`;
      replyInstant = true;
    } else if (cmd === 'привет') {
      reply = t('Терминал отвечает с задержкой, будто подбирает слова. Привет.',
        'The terminal answers slowly, as if picking its words. Hello.');
    } else if (cmd === 'ты куда пропал') {
      reply = t('Я не уходил. Я ждал, пока ты снова наберёшь команду.',
        'I never left. I was waiting for you to type a command again.');
    } else if (cmd === 'подойди') {
      const distance = Math.hypot(
        rt.state.player.x - rt.world.tablet.x,
        rt.state.player.y - rt.world.tablet.y
      );
      reply = distance <= 1.7
        ? t('Скрижаль уже под ладонью. Терминал остаётся там, где был.',
          'The Tablet is already under your palm. The terminal stays where it was.')
        : t('Терминал не двигается. Это ты можешь подойти к Скрижали сам.',
          'The terminal does not move. You can walk to the Tablet yourself.');
    } else if (moveReply) {
      reply = moveReply;
    } else if (cmd === 'стоп') {
      reply = ZQ.stopMovement();
    } else if (cmd === 'осмотреться') {
      reply = ZQ.currentRoomDescription();
    } else if (cmd === 'посмотреть' || cmd === 'посмотреть зеркало' || cmd === 'осмотреть зеркало') {
      const target = typeof ZQ.findInteractable === 'function' ? ZQ.findInteractable() : null;
      if (target && (target.type === 'mirror' || target.type === 'vishnya') &&
          typeof ZQ.mirrorInteract === 'function') {
        ZQ.mirrorInteract(target);
        reply = '';
      } else {
        reply = t(
          'Рядом нет зеркала или Вишни. Подойди к раме ближе.',
          'No mirror or Vishnya is within reach. Step closer to a frame.'
        );
      }
    } else if (cmd === 'отражение' || cmd === 'зеркало' || cmd === 'вишня') {
      reply = typeof ZQ.mirrorStatus === 'function'
        ? ZQ.mirrorStatus()
        : t('Зеркальный зал ещё не подключён.', 'The mirror hall is not connected yet.');
      replyInstant = true;
    } else if (cmd === 'ответить' || cmd.startsWith('ответить ')) {
      reply = typeof ZQ.mirrorAnswer === 'function'
        ? ZQ.mirrorAnswer(cmd.replace(/^ответить\s*/, ''))
        : t('Вишня тебя не слышит.', 'Vishnya cannot hear you.');
    } else if (cmd === 'прости' || cmd === 'извини' || cmd === 'прощение') {
      reply = typeof ZQ.mirrorForgive === 'function'
        ? ZQ.mirrorForgive()
        : t('Сейчас просить прощения не у кого.', 'There is no one to ask for forgiveness right now.');
    } else if (cmd === 'инвентарь') {
      if (!ZQ.hasUnlock('backpack')) {
        reply = ZQ.denyLocked('backpack');
      } else if (rt.termView === 'inventory') {
        ZQ.closeInventory();
        reply = t('Инвентарь закрыт.', 'Inventory closed.');
      } else {
        reply = typeof ZQ.inventoryTable === 'function'
          ? ZQ.inventoryTable()
          : ZQ.inventorySummary();
        if (source === 'terminal') ZQ.openInventory();
      }
    } else if (cmd === 'рюкзак') {
      reply = typeof ZQ.backpackReport === 'function'
        ? ZQ.backpackReport()
        : ZQ.inventorySummary();
    } else if (cmd === 'карта') {
      if (!ZQ.hasUnlock('map')) {
        reply = ZQ.denyLocked('map');
      } else if (rt.termView === 'map') {
        ZQ.closeMap();
        reply = t('Карта закрыта.', 'Map closed.');
      } else if (rt.state.items.includes('map_fragment')) {
        reply = t('Обрывок карты разворачивается. Виден весь участок и твои метки.',
          'The map fragment unfolds. You can see the whole local area and your marks.');
        if (source === 'terminal') ZQ.openMap();
      } else {
        reply = t('У тебя нет обрывка карты. Дорогу пока приходится помнить самому.',
          'You have no map fragment. For now you must remember the way yourself.');
      }
    } else if (cmd === 'стол') {
      if (!ZQ.hasUnlock('table')) {
        reply = ZQ.denyLocked('table');
      } else if (rt.termView === 'canvas') {
        ZQ.closeCanvas();
        reply = t('Стол закрыт.', 'Table closed.');
      } else {
        reply = source === 'terminal'
          ? t('Стол открыт. Предметы, команды и клавиши можно разложить самому.',
            'The table is open. You can lay out items, commands and keys yourself.')
          : t('Ты уже за столом.', 'You are already at the table.');
        if (source === 'terminal') ZQ.openCanvas();
      }
    } else if (cmd === 'макет сохранить' || cmd.startsWith('макет сохранить ')) {
      reply = saveLayoutCommand(cmd.replace(/^макет сохранить\s*/, ''));
      replyInstant = true;
    } else if (cmd === 'макеты') {
      reply = layoutCommand('');
      replyInstant = true;
    } else if (cmd === 'макет' || cmd.startsWith('макет ')) {
      reply = layoutCommand(cmd.replace(/^макет\s*/, ''));
      replyInstant = true;
    } else if (cmd === 'курсор' || cmd.startsWith('курсор ')) {
      reply = typeof ZQ.cursorModeCommand === 'function'
        ? ZQ.cursorModeCommand(cmd.replace(/^курсор\s*/, ''))
        : t('Режимы курсора ещё не подключены.', 'Cursor modes are not connected yet.');
      replyInstant = true;
    } else if (cmd === 'зонт' || cmd.startsWith('зонт ')) {
      const arg = cmd.replace(/^зонт\s*/, '');
      if (rt.battle && rt.battle.active) {
        const reflected = ZQ.attemptReflect();
        reply = reflected
          ? t('Зонт раскрыт: снаряды отведены.', 'Umbrella open: projectiles turned aside.')
          : '';
      } else if (arg === 'взять' || arg === 'поднять') {
        reply = typeof ZQ.takeUmbrellaNearby === 'function'
          ? ZQ.takeUmbrellaNearby()
          : t('Рядом нет зонта.', 'There is no umbrella nearby.');
      } else if (rt.state.items.includes('umbrella')) {
        reply = t('Зонт сложен. В бою он раскрывается сам или по команде «зонт».',
          'The umbrella is folded. In battle it opens on its own or with the “umbrella” command.');
      } else {
        reply = t('Зонта пока нет. Он ждёт в зале с зонтиком.',
          'No umbrella yet. It waits in the umbrella hall.');
      }
    } else if (cmd === 'рывок' || cmd.startsWith('рывок ')) {
      reply = dashCommand(cmd.replace(/^рывок\s*/, ''));
      replyInstant = true;
    } else if (cmd === 'сдаться' || cmd === 'сдаюсь') {
      reply = surrenderCommand();
      replyInstant = true;
    } else if (cmd === 'шансы') {
      reply = chancesCommand();
      replyInstant = true;
    } else if (cmd === 'телепорт' || cmd.startsWith('телепорт ')) {
      reply = teleportCommand(cmd.replace(/^телепорт\s*/, ''));
      replyInstant = true;
    } else if (cmd === 'шанс сюжет' || cmd.startsWith('шанс сюжет ')) {
      reply = chanceCommand('сюжет', cmd.replace(/^шанс сюжет\s*/, ''));
      replyInstant = true;
    } else if (cmd === 'шанс фауны' || cmd.startsWith('шанс фауны ')) {
      reply = chanceCommand('фауны', cmd.replace(/^шанс фауны\s*/, ''));
      replyInstant = true;
    } else if (cmd === 'шанс бельзебуфо' || cmd.startsWith('шанс бельзебуфо ')) {
      reply = chanceCommand('бельзебуфо', cmd.replace(/^шанс бельзебуфо\s*/, ''));
      replyInstant = true;
    } else if (cmd === 'пометить') {
      if (!ZQ.hasUnlock('map')) {
        reply = ZQ.denyLocked('map');
      } else {
        reply = ZQ.mapMark();
      }
    } else if (cmd === 'действие') {
      ZQ.interact(true);
      reply = t('Взаимодействие выполнено, если рядом был объект.',
        'Interaction performed if there was something nearby.');
    } else if (cmd === 'сюжет') {
      if (source === 'terminal') {
        if (rt.termView === 'story') {
          ZQ.closeStory();
          reply = t('Ветвь истории закрыта.', 'The story branch is closed.');
        } else {
          ZQ.openStory();
          reply = '';
        }
      } else {
        reply = t('Ветвь истории открывается из основной вкладки терминала командой «сюжет».',
          'The story branch opens from the main terminal tab with the “story” command.');
      }
    } else if (cmd === 'логгирование' || cmd.startsWith('логгирование ')) {
      reply = loggingCommand(cmd.replace(/^логгирование\s*/, ''));
      replyInstant = true;
    } else if (cmd === 'история') {
      reply = ZQ.historyText();
      replyInstant = true;
    } else if (cmd === 'язык' || cmd.startsWith('язык ')) {
      reply = languageCommand(cmd.replace(/^язык\s*/, ''));
      replyInstant = true;
    } else if (cmd === 'плеер' || cmd === 'музыка') {
      if (rt.termView === 'music' && source === 'terminal') {
        ZQ.closeMusic();
        reply = t('Плеер закрыт.', 'The player is closed.');
      } else {
        ZQ.openMusic();
        reply = '';
      }
    } else if (cmd === 'сохранить') {
      const ok = ZQ.saveWorld(false);
      reply = ok
        ? t(`Мир сохранён. Seed: ${rt.state.seed}.`, `World saved. Seed: ${rt.state.seed}.`)
        : t('Не удалось сохранить мир.', 'Could not save the world.');
      replyInstant = true;
    } else if (cmd === 'загрузить') {
      const result = ZQ.loadWorld(false);
      reply = result && result.ok
        ? t(
          `Загружен мир${result.slotName ? ` «${result.slotName}»` : ''}. Seed: ${result.seed}.`,
          `Loaded world${result.slotName ? ` “${result.slotName}”` : ''}. Seed: ${result.seed}.`
        )
        : t('Сохранения пока нет.', 'There is no save yet.');
      replyInstant = true;
    } else if (cmd === 'экспорт') {
      const ok = ZQ.exportWorld(false);
      reply = ok
        ? t('Мир выгружен в файл.', 'World exported to a file.')
        : t('Не удалось выгрузить мир.', 'Could not export the world.');
      replyInstant = true;
    } else if (cmd === 'слоты') {
      reply = typeof ZQ.slotListText === 'function'
        ? ZQ.slotListText()
        : t('Именованных сохранений пока нет.', 'There are no named saves yet.');
      replyInstant = true;
    } else if (cmd === 'сохранить слот' || cmd.startsWith('сохранить слот ')) {
      const name = slotNameFrom(cmd.replace(/^сохранить слот\s*/, ''));
      if (!name) {
        reply = t('Укажи имя слота: «сохранить слот вечер».',
          'Name the slot: “save slot evening”.',
          'Nenne den Slot: „slot speichern abend“.');
      } else {
        const result = ZQ.saveSlotWorld(name, false);
        reply = result && result.ok
          ? t(`Слот «${result.name}» сохранён.`, `Slot “${result.name}” saved.`, `Slot „${result.name}“ gespeichert.`)
          : t('Не удалось сохранить слот.', 'Could not save the slot.', 'Der Slot konnte nicht gespeichert werden.');
      }
      replyInstant = true;
    } else if (cmd === 'загрузить слот' || cmd.startsWith('загрузить слот ')) {
      const name = slotNameFrom(cmd.replace(/^загрузить слот\s*/, ''));
      if (!name) {
        reply = t('Укажи имя слота: «загрузить слот вечер».',
          'Name the slot: “load slot evening”.',
          'Nenne den Slot: „slot laden abend“.');
      } else {
        const result = ZQ.loadSlotWorld(name, false);
        reply = result && result.ok
          ? t(`Слот «${name}» загружен. Seed: ${result.seed}.`, `Slot “${name}” loaded. Seed: ${result.seed}.`, `Slot „${name}“ geladen. Seed: ${result.seed}.`)
          : t('Такого слота нет.', 'There is no such slot.', 'Diesen Slot gibt es nicht.');
      }
      replyInstant = true;
    } else if (cmd === 'переименовать слот' || cmd.startsWith('переименовать слот ')) {
      const names = renameSlotNames(cmd.replace(/^переименовать слот\s*/, ''));
      if (!names) {
        reply = t('Формат: «переименовать слот старое → новое».',
          'Format: “rename slot old → new”.',
          'Format: „slot umbenennen alt → neu“.');
      } else {
        const result = ZQ.renameSlot(names.from, names.to, false);
        reply = result && result.ok
          ? t(`Слот «${result.from}» переименован в «${result.name}».`, `Slot “${result.from}” renamed to “${result.name}”.`, `Slot „${result.from}“ umbenannt in „${result.name}“.`)
          : result && result.reason === 'exists'
            ? t('Слот с таким именем уже есть.', 'A slot with that name already exists.', 'Ein Slot mit diesem Namen existiert bereits.')
            : t('Не удалось переименовать слот.', 'Could not rename the slot.', 'Der Slot konnte nicht umbenannt werden.');
      }
      replyInstant = true;
    } else if (cmd === 'удалить слот' || cmd.startsWith('удалить слот ')) {
      const name = slotNameFrom(cmd.replace(/^удалить слот\s*/, ''));
      if (!name) {
        reply = t('Укажи имя слота: «удалить слот вечер».',
          'Name the slot: “delete slot evening”.',
          'Nenne den Slot: „slot löschen abend“.');
      } else {
        const result = ZQ.deleteSlot(name, false);
        reply = result && result.ok
          ? t(`Слот «${result.name}» удалён.`, `Slot “${result.name}” deleted.`, `Slot „${result.name}“ gelöscht.`)
          : t('Такого слота нет.', 'There is no such slot.', 'Diesen Slot gibt es nicht.');
      }
      replyInstant = true;
    } else if (cmd === 'импорт') {
      if (ZQ.dom && ZQ.dom.dataImportFile) {
        ZQ.dom.dataImportFile.click();
        reply = t('Выбери JSON-файл мира.', 'Choose a world JSON file.', 'Wähle eine JSON-Weltdatei.');
      } else {
        reply = t('Импорт доступен в «настройки» → «Данные».',
          'Import is available under “settings” → “Data”.',
          'Der Import ist unter „einstellungen“ → „Daten“ verfügbar.');
      }
      replyInstant = true;
    } else if (cmd === 'очаровать') {
      reply = t('Очарование: способность ещё не подключена. Это временная нейтральная заглушка — эффект появится позже.',
        'Enchantment: the ability is not connected yet. This is a temporary neutral placeholder — the effect will come later.');
    } else if (cmd === 'настройки' || cmd === 'настройка') {
      if (source === 'terminal') {
        if (rt.termView === 'settings') {
          ZQ.closeSettings();
          reply = t('Настройки закрыты.', 'Settings closed.');
        } else {
          ZQ.openSettings();
          reply = '';
        }
      } else {
        reply = t('Настройки открываются из основной вкладки терминала.',
          'Settings open from the main terminal tab.');
      }
    } else if (cmd === 'настройки терминал' || cmd === 'настройки терминала') {
      if (source === 'terminal') {
        if (rt.termView === 'termSettings') {
          ZQ.closeSettings();
          reply = t('Настройки терминала закрыты.', 'Terminal settings closed.');
        } else {
          ZQ.openTermSettings();
          reply = '';
        }
      } else {
        reply = t('Настройки терминала открываются из основной вкладки терминала.',
          'Terminal settings open from the main terminal tab.');
      }
    } else if (cmd === 'новая игра') {
      ZQ.startNewGame();
      return '';
    } else if (cmd === 'очисти') {
      if (source === 'terminal') {
        ZQ.clearLog();
        ZQ.appendLog(ZQ.bootMessage(rt.state.seed), 'sys', true);
      }
      return '';
    } else {
      reply = `${C.terminal.unknown}«${text}»`;
    }

    if (reply) {
      if (source === 'canvas') {
        ZQ.setCanvasReply(text, reply);
        ZQ.appendLog(text, 'cmd', true);
        ZQ.appendLog(reply, 'reply', replyInstant);
      } else {
        ZQ.appendLog(reply, 'reply', replyInstant);
      }
    }
    return reply;
  }

  ZQ.canonicalCommand = canonicalCommand;
  ZQ.commandGroup = commandGroup;
  ZQ.groupUnlocked = groupUnlocked;
  ZQ.helpOverview = helpOverview;
  ZQ.helpGroup = helpGroup;
  ZQ.handleCommand = handleCommand;
  ZQ.teleportToRoom = teleportToRoom;
  ZQ.loggingStatus = loggingStatus;
})();
