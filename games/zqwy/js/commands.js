/* Команды терминала и справка. */
(function () {
  'use strict';

  const ZQ = window.ZQ;
  const C = ZQ.C;
  const rt = ZQ.rt;
  const dom = ZQ.dom;

  const LOG_KEYS = ZQ.LOG_KEYS ||
    ['terminal', 'scenes', 'system', 'world', 'movement', 'actions', 'commands'];

  function t(ru, en) {
    return window.ZQI18N && window.ZQI18N.lang === 'en' ? en : ru;
  }

  /* Английские названия команд из подсказки работают и в русском
     интерфейсе: перед разбором строка приводится к русскому канону. */
  const ALIASES = {
    help: 'помоги',
    hello: 'привет',
    'where did you go': 'ты куда пропал',
    'come closer': 'подойди',
    'look around': 'осмотреться',
    story: 'сюжет',
    logging: 'логгирование',
    history: 'история',
    settings: 'настройки',
    'settings terminal': 'настройки терминал',
    save: 'сохранить',
    load: 'загрузить',
    export: 'экспорт',
    language: 'язык',
    music: 'музыка',
    clear: 'очисти',
    'new game': 'новая игра',
    backpack: 'рюкзак',
    map: 'карта',
    mark: 'пометить',
    table: 'стол',
    enchant: 'очаровать',
    action: 'действие',
    stop: 'стоп',
    up: 'вверх',
    down: 'вниз',
    left: 'влево',
    right: 'вправо'
  };

  const PREFIX_ALIASES = [
    [/^help\b/, 'помоги'],
    [/^walk\b/, 'идти'],
    [/^logging\b/, 'логгирование'],
    [/^language\b/, 'язык']
  ];

  const DIRECTION_EN = {
    up: 'вверх',
    down: 'вниз',
    left: 'влево',
    right: 'вправо'
  };

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
    return cmd.replace(/\b(up|down|left|right)\b/g, (word) => DIRECTION_EN[word] || word);
  }

  function commandGroup(name) {
    const needle = String(name || '').trim().toLowerCase();
    if (!needle) return null;
    return C.terminal.helpGroups.find((group) =>
      String(group.id).toLowerCase() === needle ||
      String(group.title).toLowerCase() === needle
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
    const lang = window.ZQI18N && window.ZQI18N.lang === 'en' ? 'English' : 'русский';
    return t(
      `Язык: ${lang}. Переключение: «язык английский» или «язык русский».`,
      `Language: ${lang}. Switch with “language english” or “language russian”.`
    );
  }

  function languageCommand(arg) {
    const value = String(arg || '').trim().toLowerCase();
    if (!value) return languageText();
    if (value === 'английский' || value === 'англ' || value === 'english' || value === 'en') {
      if (window.ZQI18N) window.ZQI18N.apply('en');
      return '';
    }
    if (value === 'русский' || value === 'рус' || value === 'russian' || value === 'ru') {
      if (window.ZQI18N) window.ZQI18N.apply('ru');
      return '';
    }
    return t(`Неизвестный язык «${arg}». ${languageText()}`, `Unknown language “${arg}”. ${languageText()}`);
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
    } else if (cmd === 'рюкзак') {
      if (!ZQ.hasUnlock('backpack')) {
        reply = ZQ.denyLocked('backpack');
      } else {
        reply = ZQ.inventorySummary();
        if (source === 'terminal') ZQ.openInventory();
      }
    } else if (cmd === 'карта') {
      if (!ZQ.hasUnlock('map')) {
        reply = ZQ.denyLocked('map');
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
      } else {
        reply = source === 'terminal'
          ? t('Стол открыт. Предметы, команды и клавиши можно разложить самому.',
            'The table is open. You can lay out items, commands and keys yourself.')
          : t('Ты уже за столом.', 'You are already at the table.');
        if (source === 'terminal') ZQ.openCanvas();
      }
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
        ZQ.openStory();
        reply = '';
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
    } else if (cmd === 'музыка') {
      const next = !rt.termSettings.music;
      ZQ.setMusicEnabled(next);
      reply = next
        ? t('Фоновый трек включён.', 'Background track enabled.')
        : t('Фоновый трек выключен.', 'Background track disabled.');
    } else if (cmd === 'сохранить') {
      const ok = ZQ.saveWorld(false);
      reply = ok
        ? t(`Мир сохранён. Seed: ${rt.state.seed}.`, `World saved. Seed: ${rt.state.seed}.`)
        : t('Не удалось сохранить мир.', 'Could not save the world.');
      replyInstant = true;
    } else if (cmd === 'загрузить') {
      const ok = ZQ.loadWorld(false);
      reply = ok
        ? t(`Сохранение загружено. Seed: ${rt.state.seed}.`, `Save loaded. Seed: ${rt.state.seed}.`)
        : t('Сохранения пока нет.', 'There is no save yet.');
      replyInstant = true;
    } else if (cmd === 'экспорт') {
      const ok = ZQ.exportWorld(false);
      reply = ok
        ? t('Мир выгружен в файл.', 'World exported to a file.')
        : t('Не удалось выгрузить мир.', 'Could not export the world.');
      replyInstant = true;
    } else if (cmd === 'очаровать') {
      reply = t('Очарование: способность ещё не подключена. Это временная нейтральная заглушка — эффект появится позже.',
        'Enchantment: the ability is not connected yet. This is a temporary neutral placeholder — the effect will come later.');
    } else if (cmd === 'настройки' || cmd === 'настройка') {
      if (source === 'terminal') {
        ZQ.openSettings();
        reply = '';
      } else {
        reply = t('Настройки открываются из основной вкладки терминала.',
          'Settings open from the main terminal tab.');
      }
    } else if (cmd === 'настройки терминал' || cmd === 'настройки терминала') {
      if (source === 'terminal') {
        ZQ.openTermSettings();
        reply = '';
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
        C.terminal.greeting.forEach((line) => ZQ.appendLog(line, 'sys', true));
        C.terminal.controls.forEach((line) => ZQ.appendLog(line, 'sys', true));
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
  ZQ.loggingStatus = loggingStatus;
})();
