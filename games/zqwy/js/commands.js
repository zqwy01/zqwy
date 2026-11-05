/* Команды терминала и справка. */
(function () {
  'use strict';

  const ZQ = window.ZQ;
  const C = ZQ.C;
  const rt = ZQ.rt;
  const dom = ZQ.dom;

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

  function helpOverview() {
    const lines = ['Группы команд:'];
    for (const group of C.terminal.helpGroups) {
      if (groupUnlocked(group)) {
        lines.push(`• ${group.title} — ${group.description}`);
      } else {
        lines.push(`• ${group.title} — закрыто. ${ZQ.unlockHint(group.unlock)}`);
      }
    }
    lines.push('Подробнее: «помоги движение». Так видно только нужный список.');
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
    const mark = (on) => on ? 'вкл' : 'выкл';
    return [
      `Логгирование: ${logging.enabled ? 'включено' : 'выключено'}.`,
      `Категории: движение — ${mark(logging.movement)}; действия — ${mark(logging.actions)}; команды — ${mark(logging.commands)}.`,
      'Использование: «логгирование вкл», «выкл», «движение», «действия», «команды», «всё» или «ничего».'
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
    if (value === 'всё' || value === 'все') {
      ZQ.setLogging('enabled', true);
      ZQ.setLogging('movement', true);
      ZQ.setLogging('actions', true);
      ZQ.setLogging('commands', true);
      return 'Логгирование включено для всех категорий.';
    }
    if (value === 'ничего') {
      ZQ.setLogging('enabled', false);
      return 'Логгирование выключено.';
    }
    const categories = {
      движение: 'movement',
      шаги: 'movement',
      действия: 'actions',
      действие: 'actions',
      команды: 'commands',
      команда: 'commands'
    };
    const key = categories[value];
    if (!key) {
      return `Неизвестная категория «${arg}». ${loggingStatus()}`;
    }
    const next = !logging[key];
    ZQ.setLogging(key, next);
    if (next && !logging.enabled) ZQ.setLogging('enabled', true);
    return `Категория «${value}»: ${next ? 'включена' : 'выключена'}. ${ZQ.loggingSummary()}.`;
  }

  function handleCommand(raw, source) {
    source = source || 'terminal';
    const text = String(raw === null || raw === undefined ? '' : raw).trim();
    const cmd = text.toLowerCase().replace(/\s+/g, ' ');
    let reply = '';
    let replyInstant = false;

    if (!text) return '';

    if (source !== 'terminal') {
      ZQ.logEvent('commands', `> ${text}`, 'команда');
    }

    if (cmd === 'помоги' || cmd === 'помощь') {
      reply = helpOverview();
      replyInstant = true;
    } else if (cmd.startsWith('помоги ') || cmd.startsWith('помощь ')) {
      const requested = cmd.replace(/^помо[гщ][ьи]\s+/, '');
      const group = commandGroup(requested);
      reply = group ? helpGroup(group) : `${C.terminal.unknownGroup}«${requested}»`;
      replyInstant = true;
    } else if (cmd === 'привет') {
      reply = 'Терминал отвечает с задержкой, будто подбирает слова. Привет.';
    } else if (cmd === 'ты куда пропал') {
      reply = 'Я не уходил. Я ждал, пока ты снова наберёшь команду.';
    } else if (cmd === 'подойди') {
      const distance = Math.hypot(
        rt.state.player.x - rt.world.tablet.x,
        rt.state.player.y - rt.world.tablet.y
      );
      reply = distance <= 1.7
        ? 'Скрижаль уже под ладонью. Терминал остаётся там, где был.'
        : 'Терминал не двигается. Это ты можешь подойти к Скрижали сам.';
    } else if (cmd === 'вверх') {
      reply = ZQ.nudgePlayer(0, -1, 'вверх');
    } else if (cmd === 'вниз') {
      reply = ZQ.nudgePlayer(0, 1, 'вниз');
    } else if (cmd === 'влево') {
      reply = ZQ.nudgePlayer(-1, 0, 'влево');
    } else if (cmd === 'вправо') {
      reply = ZQ.nudgePlayer(1, 0, 'вправо');
    } else if (cmd === 'стоп') {
      ZQ.resetKeys();
      rt.state.player.moving = false;
      reply = 'Движение остановлено.';
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
        reply = 'Обрывок карты разворачивается. Виден весь участок и твои метки.';
        if (source === 'terminal') ZQ.openMap();
      } else {
        reply = 'У тебя нет обрывка карты. Дорогу пока приходится помнить самому.';
      }
    } else if (cmd === 'стол') {
      if (!ZQ.hasUnlock('table')) {
        reply = ZQ.denyLocked('table');
      } else {
        reply = source === 'terminal'
          ? 'Стол открыт. Предметы, команды и клавиши можно разложить самому.'
          : 'Ты уже за столом.';
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
      reply = 'Взаимодействие выполнено, если рядом был объект.';
    } else if (cmd === 'сюжет') {
      if (source === 'terminal') {
        ZQ.openStory();
        reply = '';
      } else {
        reply = 'Ветвь истории открывается из основной вкладки терминала командой «сюжет».';
      }
    } else if (cmd === 'логгирование' || cmd.startsWith('логгирование ')) {
      reply = loggingCommand(cmd.replace(/^логгирование\s*/, ''));
      replyInstant = true;
    } else if (cmd === 'музыка') {
      const next = !rt.termSettings.music;
      ZQ.setMusicEnabled(next);
      reply = next ? 'Фоновый трек включён.' : 'Фоновый трек выключен.';
    } else if (cmd === 'очаровать') {
      reply = 'Очарование: способность ещё не подключена. Это временная нейтральная заглушка — эффект появится позже.';
    } else if (cmd === 'настройки' || cmd === 'настройка') {
      if (source === 'terminal') {
        ZQ.openSettings();
        reply = '';
      } else {
        reply = 'Настройки открываются из основной вкладки терминала.';
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

  ZQ.commandGroup = commandGroup;
  ZQ.groupUnlocked = groupUnlocked;
  ZQ.helpOverview = helpOverview;
  ZQ.helpGroup = helpGroup;
  ZQ.handleCommand = handleCommand;
  ZQ.loggingStatus = loggingStatus;
})();
