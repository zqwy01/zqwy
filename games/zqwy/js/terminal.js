/* Терминал: сообщения, представления, настройки и логгирование.
   Логгирование — это запись действий. Категории нужны для фильтрации
   полезного текста: терминал, сцены, система, мир, движение, действия,
   команды. */
(function () {
  'use strict';

  const ZQ = window.ZQ;
  const C = ZQ.C;
  const rt = ZQ.rt;
  const dom = ZQ.dom;
  const {
    TERM_SETTINGS_KEY,
    SPEED_MIN,
    SPEED_MAX,
    FONT_MIN,
    FONT_MAX,
    FONT_BASE,
    OVERRIDE_MAX
  } = ZQ.constants;
  const DEFAULT = ZQ.DEFAULT_TERM_SETTINGS;
  const LOG_KEYS = ZQ.LOG_KEYS || ['terminal', 'scenes', 'system', 'world', 'movement', 'actions', 'commands'];

  function lang() {
    return window.ZQI18N && window.ZQI18N.lang ? window.ZQI18N.lang : 'ru';
  }

  function isEn() {
    return lang() === 'en';
  }

  function t(ru, en, de) {
    const code = lang();
    if (code === 'de') return de || en || ru;
    return code === 'en' ? (en || ru) : ru;
  }

  function languageName() {
    const code = lang();
    if (code === 'de') return 'Deutsch';
    if (code === 'en') return 'English';
    return 'русский';
  }

  function translate(text) {
    return window.ZQI18N && typeof window.ZQI18N.tr === 'function'
      ? window.ZQI18N.tr(text)
      : text;
  }

  function translateLabel(label) {
    return window.ZQI18N && typeof window.ZQI18N.trLabel === 'function'
      ? window.ZQI18N.trLabel(label)
      : label;
  }

  /* Метки времени намеренно не выводятся: терминал — это поток текста,
     а не журнал с часами. Правило зафиксировано в README. */
  function loggingFallback() {
    const result = { enabled: Boolean(DEFAULT.logging.enabled) };
    for (const key of LOG_KEYS) result[key] = DEFAULT.logging[key] !== false;
    return result;
  }

  function readTermSettings() {
    const fallback = {
      speed: DEFAULT.speed,
      fontSize: DEFAULT.fontSize,
      fontOverrides: { ...DEFAULT.fontOverrides },
      logging: loggingFallback(),
      music: DEFAULT.music,
      musicVolume: DEFAULT.musicVolume,
      musicRate: DEFAULT.musicRate,
      musicAlgorithm: DEFAULT.musicAlgorithm
    };
    try {
      const raw = window.localStorage.getItem(TERM_SETTINGS_KEY);
      if (!raw) return fallback;
      const parsed = JSON.parse(raw) || {};
      const overrides = parsed.fontOverrides && typeof parsed.fontOverrides === 'object'
        ? parsed.fontOverrides
        : {};
      const logging = parsed.logging && typeof parsed.logging === 'object'
        ? parsed.logging
        : {};
      const result = {
        speed: Number.isFinite(parsed.speed) ? parsed.speed : fallback.speed,
        fontSize: Number.isFinite(parsed.fontSize) ? parsed.fontSize : fallback.fontSize,
        fontOverrides: {
          terminal: Number.isFinite(overrides.terminal) ? overrides.terminal : 0,
          table: Number.isFinite(overrides.table) ? overrides.table : 0
        },
        logging: {
          enabled: typeof logging.enabled === 'boolean' ? logging.enabled : fallback.logging.enabled
        },
        music: typeof parsed.music === 'boolean' ? parsed.music : fallback.music,
        musicVolume: Number.isFinite(parsed.musicVolume)
          ? parsed.musicVolume
          : fallback.musicVolume,
        musicRate: Number.isFinite(parsed.musicRate)
          ? parsed.musicRate
          : fallback.musicRate,
        musicAlgorithm: typeof parsed.musicAlgorithm === 'string'
          ? parsed.musicAlgorithm
          : fallback.musicAlgorithm
      };
      for (const key of LOG_KEYS) {
        result.logging[key] = typeof logging[key] === 'boolean'
          ? logging[key]
          : fallback.logging[key];
      }
      return result;
    } catch (error) {
      return fallback;
    }
  }

  function normalizeTermSettings() {
    const s = rt.termSettings;
    s.speed = s.speed <= 0 ? 0 : ZQ.clamp(Math.round(s.speed), SPEED_MIN, SPEED_MAX);
    s.fontSize = ZQ.clamp(Math.round(s.fontSize), FONT_MIN, FONT_MAX);
    if (!s.fontOverrides || typeof s.fontOverrides !== 'object') {
      s.fontOverrides = { terminal: 0, table: 0 };
    }
    for (const section of ['terminal', 'table']) {
      const value = Number(s.fontOverrides[section]);
      s.fontOverrides[section] = Number.isFinite(value)
        ? ZQ.clamp(Math.round(value), 0, OVERRIDE_MAX)
        : 0;
    }
    if (!s.logging || typeof s.logging !== 'object') s.logging = loggingFallback();
    for (const key of LOG_KEYS) {
      s.logging[key] = typeof s.logging[key] === 'boolean'
        ? s.logging[key]
        : DEFAULT.logging[key] !== false;
    }
    s.logging.enabled = typeof s.logging.enabled === 'boolean'
      ? s.logging.enabled
      : Boolean(DEFAULT.logging.enabled);
    s.music = typeof s.music === 'boolean' ? s.music : DEFAULT.music;
    s.musicVolume = Number.isFinite(s.musicVolume)
      ? ZQ.clamp(s.musicVolume, 0, 1)
      : DEFAULT.musicVolume;
    s.musicRate = Number.isFinite(s.musicRate)
      ? ZQ.clamp(s.musicRate, 0.5, 2)
      : DEFAULT.musicRate;
    const algorithms = C.music && Array.isArray(C.music.rateAlgorithms)
      ? C.music.rateAlgorithms
      : [];
    const ids = algorithms.map((entry) => entry.id);
    s.musicAlgorithm = typeof s.musicAlgorithm === 'string' && ids.includes(s.musicAlgorithm)
      ? s.musicAlgorithm
      : (ids[0] || DEFAULT.musicAlgorithm || 'tempo');
  }

  function categoryName(key) {
    const names = {
      terminal: t('терминал', 'terminal'),
      scenes: t('сцены', 'scenes'),
      system: t('система', 'system'),
      world: t('мир', 'world'),
      movement: t('движение', 'movement'),
      actions: t('действия', 'actions'),
      commands: t('команды', 'commands')
    };
    return names[key] || key;
  }

  function loggingSummary() {
    const logging = rt.termSettings.logging;
    if (!logging.enabled) return t('выключено', 'off');
    const parts = [];
    for (const key of LOG_KEYS) {
      if (logging[key]) parts.push(categoryName(key));
    }
    if (!parts.length) return t('включено, но все категории выключены', 'on, but all categories are off');
    return `${t('включено', 'on')}: ${parts.join(', ')}`;
  }

  function applyFonts() {
    if (!window.ZQFonts) return;
    const s = rt.termSettings;
    window.ZQFonts.apply(s.fontSize, s.fontOverrides);
  }

  function setChecked(input, value) {
    if (input) input.checked = Boolean(value);
  }

  function setValue(input, value) {
    if (input) input.value = String(value);
  }

  function applyTermSettings(persist) {
    normalizeTermSettings();
    const s = rt.termSettings;
    applyFonts();

    if (dom.settingSpeed) {
      setValue(dom.settingSpeed, s.speed);
      setValue(dom.settingSpeedNumber, s.speed);
      dom.settingSpeedValue.textContent = s.speed <= 0
        ? t('сразу', 'instant')
        : `${s.speed} ${t('зн/с', 'ch/s')}`;
    }
    if (dom.settingFont) {
      setValue(dom.settingFont, s.fontSize);
      setValue(dom.settingFontNumber, s.fontSize);
      dom.settingFontValue.textContent = `${s.fontSize} px`;
    }
    if (dom.settingFontCurrent) {
      dom.settingFontCurrent.textContent = `${s.fontSize} px`;
    }

    const setOverrideInputs = (key) => {
      const value = s.fontOverrides[key];
      const slider = key === 'terminal' ? dom.settingFontTerminal : dom.settingFontTable;
      const number = key === 'terminal' ? dom.settingFontTerminalNumber : dom.settingFontTableNumber;
      setValue(slider, value);
      setValue(number, value);
    };
    setOverrideInputs('terminal');
    setOverrideInputs('table');

    if (dom.settingSpeedPresets) {
      dom.settingSpeedPresets.querySelectorAll('[data-speed]').forEach((button) => {
        button.classList.toggle('active', Number(button.dataset.speed) === s.speed);
      });
    }
    if (dom.settingFontPresets) {
      dom.settingFontPresets.querySelectorAll('[data-font]').forEach((button) => {
        button.classList.toggle('active', Number(button.dataset.font) === s.fontSize);
      });
    }

    setChecked(dom.settingLogEnabled, s.logging.enabled);
    setChecked(dom.settingLogTerminal, s.logging.terminal);
    setChecked(dom.settingLogScenes, s.logging.scenes);
    setChecked(dom.settingLogSystem, s.logging.system);
    setChecked(dom.settingLogWorld, s.logging.world);
    setChecked(dom.settingLogMovement, s.logging.movement);
    setChecked(dom.settingLogActions, s.logging.actions);
    setChecked(dom.settingLogCommands, s.logging.commands);
    if (dom.settingLogState) {
      dom.settingLogState.textContent = loggingSummary();
    }

    if (dom.settingLanguageState) {
      dom.settingLanguageState.textContent = languageName();
    }

    if (ZQ.audio) {
      if (typeof ZQ.audio.setVolume === 'function') ZQ.audio.setVolume(s.musicVolume);
      if (typeof ZQ.audio.setEnabled === 'function') ZQ.audio.setEnabled(s.music);
      if (typeof ZQ.audio.setRate === 'function') ZQ.audio.setRate(s.musicRate);
      if (typeof ZQ.audio.setAlgorithm === 'function') ZQ.audio.setAlgorithm(s.musicAlgorithm);
    }
    updateMusicUI();

    if (persist) {
      try {
        window.localStorage.setItem(TERM_SETTINGS_KEY, JSON.stringify(s));
      } catch (error) {
        /* Приватный режим: настройки не сохранятся. */
      }
    }
  }

  function setSpeed(value) {
    rt.termSettings.speed = Number(value);
    applyTermSettings(true);
  }

  function setFontSize(value) {
    rt.termSettings.fontSize = Number(value);
    applyTermSettings(true);
  }

  function setFontOverride(section, value) {
    rt.termSettings.fontOverrides[section] = Number(value);
    applyTermSettings(true);
  }

  function setLogging(key, value) {
    if (key === 'enabled') {
      rt.termSettings.logging.enabled = Boolean(value);
    } else if (LOG_KEYS.includes(key)) {
      rt.termSettings.logging[key] = Boolean(value);
    }
    applyTermSettings(true);
  }

  function setMusicEnabled(value) {
    rt.termSettings.music = Boolean(value);
    applyTermSettings(true);
  }

  function setMusicVolume(value) {
    rt.termSettings.musicVolume = ZQ.clamp(Number(value), 0, 1);
    applyTermSettings(true);
  }

  function setMusicRate(value) {
    rt.termSettings.musicRate = ZQ.clamp(Number(value), 0.5, 2);
    applyTermSettings(true);
  }

  function setMusicAlgorithm(value) {
    const algorithms = C.music && Array.isArray(C.music.rateAlgorithms)
      ? C.music.rateAlgorithms
      : [];
    const ids = algorithms.map((entry) => entry.id);
    rt.termSettings.musicAlgorithm = ids.includes(value) ? value : (ids[0] || 'tempo');
    applyTermSettings(true);
  }

  function openSettings() {
    if (ZQ.isTrialBlocking()) return;
    ZQ.ensureTerminalShare(0.5);
    applyTermSettings(false);
    ZQ.setTerminalView('settings');
    refreshSaveSlots();
    if (ZQ.logEvent) ZQ.logEvent('terminal', 'открыты общие настройки', 'терминал');
  }

  function openTermSettings() {
    if (ZQ.isTrialBlocking()) return;
    ZQ.ensureTerminalShare(0.5);
    applyTermSettings(false);
    ZQ.setTerminalView('termSettings');
    if (ZQ.logEvent) ZQ.logEvent('terminal', 'открыты настройки терминала', 'терминал');
  }

  function openFontSettings() {
    if (ZQ.isTrialBlocking()) return;
    ZQ.ensureTerminalShare(0.5);
    applyTermSettings(false);
    ZQ.setTerminalView('fontSettings');
    if (ZQ.logEvent) ZQ.logEvent('terminal', 'открыты настройки шрифта', 'терминал');
  }

  function closeSettings() {
    ZQ.setTerminalView('main');
    ZQ.updatePrompt();
    if (ZQ.logEvent) ZQ.logEvent('terminal', 'закрыты настройки', 'терминал');
  }

  /* ----------------------------- Лог ------------------------------- */

  function defaultLabelForType(type) {
    if (type === 'sys' || type === 'reply') return t('система', 'system');
    if (type === 'story' || type === 'log-scenes') return t('сцена', 'scene');
    if (type === 'cmd') return 'Zemic:';
    if (type === 'log-movement') return t('шаг', 'step');
    if (type === 'log-actions') return t('действие', 'action');
    if (type === 'log-commands') return t('команда', 'command');
    if (type === 'log-terminal') return t('терминал', 'terminal');
    if (type === 'log-world') return t('мир', 'world');
    if (type === 'log-system') return t('система', 'system');
    return '';
  }

  const LOG_TYPE_ALIAS = {
    terminal: 'log-terminal',
    scenes: 'log-scenes',
    system: 'log-system',
    world: 'log-world',
    movement: 'log-movement',
    actions: 'log-actions',
    commands: 'log-commands'
  };

  function appendLog(text, type, instant, label) {
    if (text === null || text === undefined || text === '') return;
    const sourceType = type || 'sys';
    const finalType = LOG_TYPE_ALIAS[sourceType] || sourceType;
    const rawText = String(text);
    const rawLabel = label === undefined ? defaultLabelForType(sourceType) : label;
    rt.logQueue.push({
      text: rawText,
      type: finalType,
      instant: Boolean(instant) || rt.termSettings.speed <= 0,
      label: rawLabel
    });
    pumpLog();
  }

  function logEvent(category, text, label) {
    if (LOG_KEYS.includes(category)) {
      const logging = rt.termSettings.logging;
      if (!logging.enabled || !logging[category]) return false;
      appendLog(text, `log-${category}`, true, label || defaultLabelForType(`log-${category}`));
      return true;
    }
    return false;
  }

  function clearLog() {
    rt.logQueue.length = 0;
    rt.logToken++;
    rt.logBusy = false;
    dom.log.textContent = '';
  }

  function whenLogsIdle(callback) {
    rt.logIdleCallbacks.push(callback);
    pumpLog();
  }

  function flushLogIdle() {
    if (rt.logBusy || rt.logQueue.length) return;
    while (rt.logIdleCallbacks.length) {
      const callback = rt.logIdleCallbacks.shift();
      try {
        callback();
      } catch (error) {
        console.error(error);
      }
    }
  }

  function makeLogLine(entry) {
    const line = document.createElement('div');
    line.className = `log-line ${entry.type}`;
    line.dataset.rawText = entry.text;
    line.dataset.rawLabel = entry.label || '';
    if (entry.label) {
      const label = document.createElement('span');
      label.className = 'log-label';
      label.textContent = translateLabel(entry.label);
      line.appendChild(label);
    }
    const body = document.createElement('span');
    body.className = 'log-text';
    line.appendChild(body);
    return { line, body, display: translate(entry.text) };
  }

  function pumpLog() {
    if (rt.logBusy) return;
    const entry = rt.logQueue.shift();
    if (!entry) {
      flushLogIdle();
      return;
    }
    rt.logBusy = true;

    const { line, body, display } = makeLogLine(entry);
    dom.log.appendChild(line);
    dom.log.scrollTop = dom.log.scrollHeight;

    const finish = () => {
      line.querySelectorAll('.cursor').forEach((node) => node.remove());
      rt.logBusy = false;
      dom.log.scrollTop = dom.log.scrollHeight;
      pumpLog();
    };

    if (entry.instant || display.length < 3) {
      body.textContent = display;
      finish();
      return;
    }

    const token = ++rt.logToken;
    const cursor = document.createElement('span');
    cursor.className = 'cursor';
    body.appendChild(cursor);
    let index = 0;
    let budget = 0;
    const tick = 16;
    rt.logSkip = false;

    const step = () => {
      if (token !== rt.logToken) {
        body.textContent = display;
        finish();
        return;
      }
      if (rt.logSkip) {
        body.textContent = display;
        finish();
        return;
      }
      budget += rt.termSettings.speed * tick / 1000;
      const add = Math.floor(budget);
      if (add > 0) {
        budget -= add;
        index = Math.min(display.length, index + add);
        body.textContent = display.slice(0, index);
      }
      if (index >= display.length) {
        finish();
        return;
      }
      body.appendChild(cursor);
      dom.log.scrollTop = dom.log.scrollHeight;
      window.setTimeout(step, tick);
    };
    step();
  }

  /* Переводим уже показанные строки при смене языка. Исходный текст
     хранится в dataset, поэтому русские записи становятся английскими. */
  function translateLog() {
    dom.log.querySelectorAll('.log-line').forEach((line) => {
      const rawText = line.dataset.rawText;
      const rawLabel = line.dataset.rawLabel;
      if (rawLabel) {
        const label = line.querySelector('.log-label');
        if (label) label.textContent = translateLabel(rawLabel);
      }
      const body = line.querySelector('.log-text');
      if (body && rawText !== undefined) body.textContent = translate(rawText);
    });
  }

  dom.log.addEventListener('click', () => {
    if (rt.logBusy) rt.logSkip = true;
  });

  /* --------------------------- История ----------------------------- */

  function isTyping() {
    return document.activeElement === dom.commandInput;
  }

  function resetHistory() {
    rt.commandHistoryIndex = -1;
    rt.commandDraft = '';
  }

  function rememberCommand(value) {
    if (!value) return;
    const history = rt.commandHistory;
    if (history[history.length - 1] !== value) history.push(value);
    while (history.length > 80) history.shift();
    resetHistory();
  }

  function historyText() {
    const history = rt.commandHistory;
    if (!history.length) return t('История команд пуста.', 'Command history is empty.');
    const lines = [`${t('История команд', 'Command history')} (${history.length}):`];
    history.forEach((entry, index) => {
      lines.push(`  ${index + 1}. ${entry}`);
    });
    return lines.join('\n');
  }

  function showHistory(offset) {
    const history = rt.commandHistory;
    if (!history.length) return;
    if (rt.commandHistoryIndex === -1) {
      if (offset > 0) return;
      rt.commandDraft = dom.commandInput.value;
      rt.commandHistoryIndex = history.length - 1;
    } else {
      const next = rt.commandHistoryIndex + offset;
      rt.commandHistoryIndex = next >= history.length ? -1 : Math.max(-1, next);
    }
    if (rt.commandHistoryIndex === -1) {
      dom.commandInput.value = rt.commandDraft;
    } else {
      dom.commandInput.value = history[rt.commandHistoryIndex];
    }
    const end = dom.commandInput.value.length;
    try {
      dom.commandInput.setSelectionRange(end, end);
    } catch (error) {
      /* ignored */
    }
    dom.commandInput.focus();
    refreshCommandSuggestions();
  }

  /* ------------------------- Автодополнение ------------------------ */

  function suggestionPool(needle) {
    const pool = [];
    const add = (value) => {
      if (value && !pool.includes(value)) pool.push(value);
    };
    for (const group of C.terminal.helpGroups) {
      if (!ZQ.groupUnlocked(group)) continue;
      for (const entry of group.commands) {
        if (entry.bindable === false) continue;
        add(entry.command);
      }
    }
    for (const command of rt.commandHistory) {
      add(command);
    }

    const text = String(needle || '').toLowerCase();
    const prefix = (value) => Boolean(text) && (text.startsWith(value) || value.startsWith(text));
    if (prefix('идти ')) {
      for (const dir of ['вверх', 'вниз', 'влево', 'вправо']) {
        add(`идти ${dir}`);
        add(`идти ${dir} 5`);
      }
    }
    if (prefix('walk ')) {
      for (const dir of ['up', 'down', 'left', 'right']) {
        add(`walk ${dir}`);
        add(`walk ${dir} 5`);
      }
    }
    if (prefix('laufen ')) {
      for (const dir of ['oben', 'unten', 'links', 'rechts']) {
        add(`laufen ${dir}`);
        add(`laufen ${dir} 5`);
      }
    }
    if (prefix('язык ') || prefix('language ') || prefix('sprache ')) {
      if (prefix('язык ')) {
        for (const value of ['русский', 'английский', 'немецкий']) add(`язык ${value}`);
      }
      if (prefix('language ')) {
        for (const value of ['russian', 'english', 'german']) add(`language ${value}`);
      }
      if (prefix('sprache ')) {
        for (const value of ['russisch', 'englisch', 'deutsch']) add(`sprache ${value}`);
      }
    }
    if (prefix('логгирование ') || prefix('logging ') || prefix('protokoll ')) {
      if (prefix('логгирование ')) {
        for (const value of ['включи', 'выключи', 'всё', 'ничего', 'терминал', 'сцены', 'система', 'мир', 'движение', 'действия', 'команды']) {
          add(`логгирование ${value}`);
        }
      }
      if (prefix('logging ')) {
        for (const value of ['on', 'off', 'all', 'none', 'terminal', 'scenes', 'system', 'world', 'movement', 'actions', 'commands']) {
          add(`logging ${value}`);
        }
      }
      if (prefix('protokoll ')) {
        for (const value of ['an', 'aus', 'alles', 'nichts', 'terminal', 'szenen', 'system', 'welt', 'bewegung', 'handlungen', 'befehle']) {
          add(`protokoll ${value}`);
        }
      }
    }
    if (prefix('помоги ') || prefix('help ') || prefix('hilfe ')) {
      for (const group of C.terminal.helpGroups) {
        if (!ZQ.groupUnlocked(group)) continue;
        if (prefix('помоги ')) add(`помоги ${group.title}`);
        if (prefix('help ')) add(`help ${group.title}`);
        if (prefix('hilfe ')) add(`hilfe ${group.title}`);
      }
    }
    if (prefix('настройки ') || prefix('settings ') || prefix('einstellungen ')) {
      if (prefix('настройки ')) add('настройки терминал');
      if (prefix('settings ')) add('settings terminal');
      if (prefix('einstellungen ')) add('einstellungen terminal');
    }
    if (prefix('музыка ') || prefix('music ') || prefix('musik ')) {
      if (prefix('музыка ')) add('музыка');
      if (prefix('music ')) add('music');
      if (prefix('musik ')) add('musik');
    }
    return pool;
  }

  function hideSuggestions() {
    rt.commandSuggestions = [];
    rt.commandSuggestIndex = -1;
    if (dom.commandGhost) {
      dom.commandGhost.textContent = '';
      dom.commandGhost.classList.add('hidden');
    }
  }

  function completeSuggestion(reverse) {
    if (!rt.commandSuggestions.length) refreshCommandSuggestions();
    const list = rt.commandSuggestions;
    if (!list.length) return false;
    const step = reverse ? -1 : 1;
    rt.commandSuggestIndex = (rt.commandSuggestIndex + step + list.length) % list.length;
    const value = list[rt.commandSuggestIndex];
    if (!value) return false;
    dom.commandInput.value = value;
    const end = value.length;
    try {
      dom.commandInput.setSelectionRange(end, end);
    } catch (error) {
      /* ignored */
    }
    hideSuggestions();
    return true;
  }

  /* Подсказка — прозрачное продолжение прямо в поле ввода. Никакой
     отдельной колонки или списка под терминалом нет. */
  function refreshCommandSuggestions() {
    if (!dom.commandGhost) return;
    if (!isTyping()) {
      hideSuggestions();
      return;
    }
    const value = dom.commandInput.value;
    if (!value) {
      hideSuggestions();
      return;
    }
    const needle = value.toLowerCase();
    const matches = [];
    for (const command of suggestionPool(needle)) {
      const lower = command.toLowerCase();
      if (lower.startsWith(needle) && command.length > value.length) {
        matches.push(command);
      }
    }
    rt.commandSuggestions = matches;
    rt.commandSuggestIndex = -1;
    if (!matches.length) {
      hideSuggestions();
      return;
    }
    const completion = matches[0];
    dom.commandGhost.textContent = '';
    const prefix = document.createElement('span');
    prefix.className = 'command-ghost-prefix';
    prefix.textContent = value;
    const suffix = document.createElement('span');
    suffix.className = 'command-ghost-suffix';
    suffix.textContent = completion.slice(value.length);
    dom.commandGhost.appendChild(prefix);
    dom.commandGhost.appendChild(suffix);
    dom.commandGhost.style.transform = `translateX(${-dom.commandInput.scrollLeft}px)`;
    dom.commandGhost.classList.remove('hidden');
  }

  dom.commandInput.addEventListener('keydown', (event) => {
    if (event.code === 'ArrowUp') {
      event.preventDefault();
      showHistory(-1);
    } else if (event.code === 'ArrowDown') {
      event.preventDefault();
      showHistory(1);
    } else if (event.code === 'Tab' && rt.commandSuggestions.length) {
      event.preventDefault();
      completeSuggestion(event.shiftKey);
    } else if (event.code === 'Escape' && rt.commandSuggestions.length) {
      event.preventDefault();
      hideSuggestions();
    }
  });

  dom.commandInput.addEventListener('input', () => {
    if (rt.commandHistoryIndex !== -1) resetHistory();
    refreshCommandSuggestions();
  });

  dom.commandInput.addEventListener('scroll', () => {
    if (!dom.commandGhost || dom.commandGhost.classList.contains('hidden')) return;
    dom.commandGhost.style.transform = `translateX(${-dom.commandInput.scrollLeft}px)`;
  });

  dom.commandForm.addEventListener('submit', (event) => {
    event.preventDefault();
    if (ZQ.isPaused()) {
      appendLog(t('Сейчас не до команд.', 'Not now for commands.'), 'sys', true);
      return;
    }
    const value = dom.commandInput.value.trim();
    if (!value) return;
    dom.commandInput.value = '';
    hideSuggestions();
    rememberCommand(value);
    appendLog(value, 'cmd', true);
    ZQ.handleCommand(value, 'terminal');
  });

  dom.commandInput.addEventListener('focus', () => {
    dom.termContext.textContent = '';
    dom.termContext.classList.remove('tablet');
    dom.btnAction.classList.add('hidden');
    refreshCommandSuggestions();
  });

  dom.commandInput.addEventListener('blur', () => {
    window.setTimeout(() => {
      if (document.activeElement !== dom.commandInput) hideSuggestions();
    }, 120);
    ZQ.updatePrompt();
  });

  /* --------------------------- Настройки --------------------------- */

  dom.settingsClose.addEventListener('click', closeSettings);
  dom.termSettingsClose.addEventListener('click', closeSettings);
  dom.termSettingsBack.addEventListener('click', openSettings);
  dom.openTermSettings.addEventListener('click', openTermSettings);
  if (dom.fontSettingsClose) dom.fontSettingsClose.addEventListener('click', closeSettings);
  if (dom.fontSettingsBack) dom.fontSettingsBack.addEventListener('click', openSettings);
  if (dom.openFontSettings) dom.openFontSettings.addEventListener('click', openFontSettings);

  dom.settingSpeed.addEventListener('input', () => setSpeed(dom.settingSpeed.value));
  dom.settingSpeedNumber.addEventListener('change', () => setSpeed(dom.settingSpeedNumber.value));
  dom.settingFont.addEventListener('input', () => setFontSize(dom.settingFont.value));
  dom.settingFontNumber.addEventListener('change', () => setFontSize(dom.settingFontNumber.value));
  dom.settingFontTerminal.addEventListener('input', () => {
    setFontOverride('terminal', dom.settingFontTerminal.value);
  });
  dom.settingFontTerminalNumber.addEventListener('change', () => {
    setFontOverride('terminal', dom.settingFontTerminalNumber.value);
  });
  dom.settingFontTable.addEventListener('input', () => {
    setFontOverride('table', dom.settingFontTable.value);
  });
  dom.settingFontTableNumber.addEventListener('change', () => {
    setFontOverride('table', dom.settingFontTableNumber.value);
  });

  const logInputs = {
    enabled: dom.settingLogEnabled,
    terminal: dom.settingLogTerminal,
    scenes: dom.settingLogScenes,
    system: dom.settingLogSystem,
    world: dom.settingLogWorld,
    movement: dom.settingLogMovement,
    actions: dom.settingLogActions,
    commands: dom.settingLogCommands
  };
  for (const [key, input] of Object.entries(logInputs)) {
    if (!input) continue;
    input.addEventListener('change', () => setLogging(key, input.checked));
  }

  const handleSettingsClick = (event) => {
    const clear = event.target.closest('[data-font-clear]');
    if (clear) {
      setFontOverride(clear.dataset.fontClear, 0);
      return;
    }
    const speedButton = event.target.closest('[data-speed]');
    if (speedButton) {
      setSpeed(speedButton.dataset.speed);
      return;
    }
    const fontButton = event.target.closest('[data-font]');
    if (fontButton) {
      setFontSize(fontButton.dataset.font);
      return;
    }
    const languageButton = event.target.closest('[data-lang]');
    if (languageButton && window.ZQI18N) {
      window.ZQI18N.apply(languageButton.dataset.lang);
    }
  };
  dom.settingsView.addEventListener('click', handleSettingsClick);
  if (dom.fontSettingsView) dom.fontSettingsView.addEventListener('click', handleSettingsClick);

  dom.settingsReset.addEventListener('click', () => {
    rt.termSettings = {
      speed: DEFAULT.speed,
      fontSize: DEFAULT.fontSize,
      fontOverrides: { ...DEFAULT.fontOverrides },
      logging: loggingFallback(),
      music: DEFAULT.music,
      musicVolume: DEFAULT.musicVolume,
      musicRate: DEFAULT.musicRate,
      musicAlgorithm: DEFAULT.musicAlgorithm
    };
    applyTermSettings(true);
  });

  /* ---------------------------- Музыка ----------------------------- */

  function updateMusicUI() {
    if (!dom.musicState) return;
    const audio = ZQ.audio;
    const state = audio && typeof audio.state === 'function'
      ? audio.state()
      : {
        enabled: rt.termSettings.music,
        playing: false,
        current: 0,
        duration: 0,
        volume: rt.termSettings.musicVolume,
        cue: 'tablet'
      };

    dom.musicState.textContent = state.enabled
      ? t('включена', 'on', 'an')
      : t('выключена', 'off', 'aus');
    if (dom.musicPlayerState) {
      dom.musicPlayerState.textContent = state.enabled
        ? (state.playing ? t('играет', 'playing', 'spielt') : t('пауза', 'paused', 'pausiert'))
        : t('выключена', 'off', 'aus');
    }
    if (dom.musicToggle) {
      dom.musicToggle.textContent = state.playing
        ? t('пауза', 'pause', 'Pause')
        : t('играть', 'play', 'Abspielen');
    }
    if (dom.musicTime) {
      const total = Number.isFinite(state.duration) ? state.duration : 0;
      dom.musicTime.textContent = `${formatTime(state.current)} / ${formatTime(total)}`;
    }
    if (dom.musicSeek) {
      const total = Number.isFinite(state.duration) ? state.duration : 0;
      const value = total > 0 ? Math.round((state.current / total) * 1000) : 0;
      if (document.activeElement !== dom.musicSeek) dom.musicSeek.value = String(value);
    }
    if (dom.musicVolume) {
      const value = Math.round((Number.isFinite(state.volume) ? state.volume : rt.termSettings.musicVolume) * 100);
      if (document.activeElement !== dom.musicVolume) dom.musicVolume.value = String(value);
      if (dom.musicVolumeValue) dom.musicVolumeValue.textContent = `${value}%`;
    }
    if (dom.musicMute) {
      const muted = !(Number(state.volume) > 0);
      dom.musicMute.setAttribute('aria-pressed', muted ? 'true' : 'false');
      dom.musicMute.textContent = muted
        ? t('🔇 включить', '🔇 unmute', '🔇 einschalten')
        : t('🔇 выкл', '🔇 mute', '🔇 stumm');
      dom.musicMute.classList.toggle('active', muted);
    }
    if (dom.musicRate) {
      const rate = Number.isFinite(state.rate) ? state.rate : rt.termSettings.musicRate;
      if (document.activeElement !== dom.musicRate) dom.musicRate.value = String(Math.round(rate * 100));
      if (dom.musicRateValue) dom.musicRateValue.textContent = `${rate.toFixed(2)}×`;
      dom.musicRate.closest('.setting-group')
        ?.querySelectorAll('[data-rate]')
        .forEach((button) => {
          button.classList.toggle('active', Number(button.dataset.rate) === Math.round(rate * 100));
        });
    }
    if (dom.musicCue) {
      const cue = state.cue || 'labyrinth';
      const meta = C.musicCues && C.musicCues[cue];
      const track = C.music && C.music.tracks && state.track
        ? C.music.tracks[state.track]
        : null;
      dom.musicCue.textContent = track
        ? track.title
        : (meta ? meta.title : t('Лабиринт', 'Labyrinth', 'Labyrinth'));
    }
    if (dom.musicAlgorithmPresets) {
      const active = state.algorithm || rt.termSettings.musicAlgorithm;
      dom.musicAlgorithmPresets.querySelectorAll('[data-algorithm]').forEach((button) => {
        button.classList.toggle('active', button.dataset.algorithm === active);
      });
    }
  }

  function formatTime(seconds) {
    const value = Number.isFinite(seconds) && seconds > 0 ? Math.floor(seconds) : 0;
    const m = Math.floor(value / 60);
    const s = value % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  }

  if (dom.musicToggle) {
    dom.musicToggle.addEventListener('click', () => {
      if (!ZQ.audio) return;
      const state = typeof ZQ.audio.state === 'function' ? ZQ.audio.state() : null;
      if (state && state.playing) ZQ.audio.pause();
      else ZQ.audio.play();
      updateMusicUI();
    });
  }
  if (dom.musicStop) {
    dom.musicStop.addEventListener('click', () => {
      if (ZQ.audio && typeof ZQ.audio.stop === 'function') ZQ.audio.stop();
      updateMusicUI();
    });
  }
  if (dom.musicSeek) {
    dom.musicSeek.addEventListener('input', () => {
      if (ZQ.audio && typeof ZQ.audio.seekFraction === 'function') {
        ZQ.audio.seekFraction(Number(dom.musicSeek.value) / 1000);
      }
    });
  }
  if (dom.musicVolume) {
    dom.musicVolume.addEventListener('input', () => {
      const value = Number(dom.musicVolume.value) / 100;
      if (value > 0) rt.musicLastVolume = value;
      setMusicVolume(value);
    });
  }
  if (dom.musicMute) {
    dom.musicMute.addEventListener('click', () => {
      const current = Number(rt.termSettings.musicVolume) || 0;
      if (current > 0) {
        rt.musicLastVolume = current;
        setMusicVolume(0);
      } else {
        setMusicVolume(rt.musicLastVolume > 0 ? rt.musicLastVolume : 0.55);
      }
      updateMusicUI();
    });
  }
  if (dom.soundtrack) {
    for (const eventName of ['timeupdate', 'play', 'pause', 'loadedmetadata', 'volumechange']) {
      dom.soundtrack.addEventListener(eventName, updateMusicUI);
    }
  }

  /* --------------------------- Данные ------------------------------ */

  function saveWorld(announce) {
    const ok = ZQ.saveGame();
    if (announce) {
      appendLog(
        ok
          ? `Мир сохранён. Seed: ${rt.state.seed}.`
          : t('Не удалось сохранить мир.', 'Could not save the world.'),
        'sys',
        true
      );
    }
    return ok;
  }

  function loadWorld(announce) {
    const result = ZQ.loadGame();
    if (announce) {
      if (!result || !result.ok) {
        appendLog(t('Сохранения пока нет.', 'There is no save yet.'), 'sys', true);
      } else {
        appendLog(`Сохранение загружено. Seed: ${result.seed}.`, 'sys', true);
        appendLog(ZQ.bootMessage(result.seed, {
          kind: 'load',
          slotName: result.slotName || ''
        }), 'sys', true);
      }
    }
    updateMusicUI();
    return result || { ok: false };
  }

  function exportWorld(announce) {
    const ok = ZQ.exportGame();
    if (announce) {
      appendLog(
        ok
          ? t('Мир выгружен в файл.', 'World exported to a file.')
          : t('Не удалось выгрузить мир.', 'Could not export the world.'),
        'sys',
        true
      );
    }
    return ok;
  }

  /* --------------------- Слоты и импорт мира ----------------------- */

  function slotDate(timestamp) {
    if (!Number.isFinite(timestamp) || timestamp <= 0) return '';
    try {
      return new Date(timestamp).toLocaleString(languageName());
    } catch (error) {
      return '';
    }
  }

  function setSlotStatus(text) {
    if (dom.saveSlotStatus) dom.saveSlotStatus.textContent = text;
  }

  function refreshSaveSlots() {
    if (!dom.saveSlotSelect || typeof ZQ.listSaveSlots !== 'function') return [];
    const previous = dom.saveSlotSelect.value;
    const slots = ZQ.listSaveSlots();
    dom.saveSlotSelect.textContent = '';
    if (!slots.length) {
      const option = document.createElement('option');
      option.value = '';
      option.textContent = t('пока нет слотов', 'no slots yet', 'noch keine Slots');
      dom.saveSlotSelect.appendChild(option);
      dom.saveSlotSelect.disabled = true;
    } else {
      dom.saveSlotSelect.disabled = false;
      for (const slot of slots) {
        const option = document.createElement('option');
        option.value = slot.name;
        const date = slotDate(slot.savedAt);
        option.textContent = `${slot.name}${date ? ` · ${date}` : ''}`;
        option.title = `${slot.name} · seed: ${slot.seed || '—'} · ${t('комнат', 'rooms', 'Räume')}: ${slot.rooms}`;
        dom.saveSlotSelect.appendChild(option);
      }
      const hasPrevious = slots.some((slot) => slot.name === previous);
      dom.saveSlotSelect.value = hasPrevious ? previous : slots[0].name;
    }
    if (dom.saveSlotCount) dom.saveSlotCount.textContent = String(slots.length);
    const empty = slots.length === 0;
    for (const button of [dom.saveSlotLoad, dom.saveSlotRename, dom.saveSlotDelete]) {
      if (button) button.disabled = empty;
    }
    return slots;
  }

  function slotListText() {
    const slots = ZQ.listSaveSlots();
    if (!slots.length) {
      return t('Именованных сохранений пока нет.', 'There are no named saves yet.', 'Es gibt noch keine benannten Speicherungen.');
    }
    const lines = slots.map((slot) => {
      const date = slotDate(slot.savedAt);
      return `• ${slot.name} — seed: ${slot.seed || '—'} · ${t('комнат', 'rooms', 'Räume')}: ${slot.rooms}${date ? ` · ${date}` : ''}`;
    });
    return [t('Именованные сохранения:', 'Named saves:', 'Benannte Speicherungen:')].concat(lines).join('\n');
  }

  function saveSlotWorld(name, announce) {
    const result = ZQ.saveToSlot(name);
    if (result.ok) {
      if (announce) {
        appendLog(t(`Слот «${result.name}» сохранён.`, `Slot “${result.name}” saved.`, `Slot „${result.name}“ gespeichert.`), 'sys', true);
      }
      if (dom.saveSlotName) dom.saveSlotName.value = result.name;
      refreshSaveSlots();
      if (dom.saveSlotSelect) dom.saveSlotSelect.value = result.name;
      setSlotStatus(t(`Слот «${result.name}» сохранён.`, `Slot “${result.name}” saved.`, `Slot „${result.name}“ gespeichert.`));
    } else if (announce) {
      const message = result.reason === 'name'
        ? t('Введи имя слота.', 'Enter a slot name.', 'Gib einen Slot-Namen ein.')
        : t('Не удалось сохранить слот.', 'Could not save the slot.', 'Der Slot konnte nicht gespeichert werden.');
      appendLog(message, 'sys', true);
      setSlotStatus(message);
    }
    return result;
  }

  function loadSlotWorld(name, announce) {
    const result = ZQ.loadFromSlot(name);
    if (result.ok) {
      if (announce) {
        appendLog(t(`Слот «${name}» загружен. Seed: ${result.seed}.`, `Slot “${name}” loaded. Seed: ${result.seed}.`, `Slot „${name}“ geladen. Seed: ${result.seed}.`), 'sys', true);
        appendLog(ZQ.bootMessage(result.seed, {
          kind: 'load',
          slotName: ZQ.normalizeSlotName(name)
        }), 'sys', true);
      }
      refreshSaveSlots();
      if (dom.saveSlotSelect) dom.saveSlotSelect.value = ZQ.normalizeSlotName(name);
      updateMusicUI();
      setSlotStatus(t(`Слот «${name}» загружен.`, `Slot “${name}” loaded.`, `Slot „${name}“ geladen.`));
    } else if (announce) {
      const message = result.reason === 'empty'
        ? t('Такого слота нет.', 'There is no such slot.', 'Diesen Slot gibt es nicht.')
        : t('Не удалось загрузить слот.', 'Could not load the slot.', 'Der Slot konnte nicht geladen werden.');
      appendLog(message, 'sys', true);
      setSlotStatus(message);
    }
    return result;
  }

  function renameSlot(from, to, announce) {
    const result = ZQ.renameSaveSlot(from, to);
    if (result.ok) {
      if (announce) {
        appendLog(t(`Слот «${result.from}» переименован в «${result.name}».`, `Slot “${result.from}” renamed to “${result.name}”.`, `Slot „${result.from}“ umbenannt in „${result.name}“.`), 'sys', true);
      }
      refreshSaveSlots();
      if (dom.saveSlotSelect) dom.saveSlotSelect.value = result.name;
      if (dom.saveSlotName) dom.saveSlotName.value = result.name;
      setSlotStatus(t(`Слот переименован: «${result.name}».`, `Slot renamed: “${result.name}”.`, `Slot umbenannt: „${result.name}“.`));
    } else if (announce) {
      const message = result.reason === 'exists'
        ? t('Слот с таким именем уже есть.', 'A slot with that name already exists.', 'Ein Slot mit diesem Namen existiert bereits.')
        : result.reason === 'name'
          ? t('Введи новое имя слота.', 'Enter a new slot name.', 'Gib einen neuen Slot-Namen ein.')
          : t('Не удалось переименовать слот.', 'Could not rename the slot.', 'Der Slot konnte nicht umbenannt werden.');
      appendLog(message, 'sys', true);
      setSlotStatus(message);
    }
    return result;
  }

  function deleteSlot(name, announce) {
    const result = ZQ.deleteSaveSlot(name);
    if (result.ok) {
      if (announce) {
        appendLog(t(`Слот «${result.name}» удалён.`, `Slot “${result.name}” deleted.`, `Slot „${result.name}“ gelöscht.`), 'sys', true);
      }
      refreshSaveSlots();
      setSlotStatus(t(`Слот «${result.name}» удалён.`, `Slot “${result.name}” deleted.`, `Slot „${result.name}“ gelöscht.`));
    } else if (announce) {
      appendLog(t('Не удалось удалить слот.', 'Could not delete the slot.', 'Der Slot konnte nicht gelöscht werden.'), 'sys', true);
    }
    return result;
  }

  function importWorldData(text, announce) {
    const result = ZQ.importGame(text);
    if (result.ok) {
      if (announce) {
        appendLog(t(`Мир импортирован. Seed: ${result.seed}.`, `World imported. Seed: ${result.seed}.`, `Welt importiert. Seed: ${result.seed}.`), 'sys', true);
        appendLog(ZQ.bootMessage(result.seed), 'sys', true);
      }
      refreshSaveSlots();
      updateMusicUI();
    } else if (announce) {
      const message = result.reason === 'json' || result.reason === 'format' || result.reason === 'seed'
        ? t('Файл не похож на мир ZQwy.', 'The file does not look like a ZQwy world.', 'Die Datei sieht nicht wie eine ZQwy-Welt aus.')
        : t('Не удалось импортировать мир.', 'Could not import the world.', 'Die Welt konnte nicht importiert werden.');
      appendLog(message, 'sys', true);
    }
    return result;
  }

  function readImportFile(file) {
    if (!file) return;
    if (typeof file.text === 'function') {
      file.text()
        .then((text) => importWorldData(text, true))
        .catch(() => appendLog(t('Не удалось прочитать файл.', 'Could not read the file.', 'Die Datei konnte nicht gelesen werden.'), 'sys', true));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => importWorldData(String(reader.result || ''), true);
    reader.onerror = () => appendLog(t('Не удалось прочитать файл.', 'Could not read the file.', 'Die Datei konnte nicht gelesen werden.'), 'sys', true);
    reader.readAsText(file);
  }

  const onAction = (button, handler) => {
    if (button) button.addEventListener('click', handler);
  };
  onAction(dom.btnSave, () => saveWorld(true));
  onAction(dom.btnLoad, () => loadWorld(true));
  onAction(dom.btnExport, () => exportWorld(true));
  onAction(dom.btnSettings, openSettings);
  onAction(dom.dataSave, () => saveWorld(true));
  onAction(dom.dataLoad, () => loadWorld(true));
  onAction(dom.dataExport, () => exportWorld(true));
  onAction(dom.dataImport, () => {
    if (dom.dataImportFile) dom.dataImportFile.click();
  });
  if (dom.dataImportFile) {
    dom.dataImportFile.addEventListener('change', () => {
      const file = dom.dataImportFile.files && dom.dataImportFile.files[0];
      readImportFile(file);
      dom.dataImportFile.value = '';
    });
  }

  onAction(dom.saveSlotSave, () => {
    const typed = dom.saveSlotName ? dom.saveSlotName.value.trim() : '';
    const selected = dom.saveSlotSelect ? dom.saveSlotSelect.value : '';
    saveSlotWorld(typed || selected, true);
  });
  onAction(dom.saveSlotLoad, () => {
    if (dom.saveSlotSelect && dom.saveSlotSelect.value) {
      loadSlotWorld(dom.saveSlotSelect.value, true);
    }
  });
  onAction(dom.saveSlotRename, () => {
    const selected = dom.saveSlotSelect ? dom.saveSlotSelect.value : '';
    const next = dom.saveSlotName ? dom.saveSlotName.value.trim() : '';
    if (selected) renameSlot(selected, next || selected, true);
  });
  onAction(dom.saveSlotDelete, () => {
    if (dom.saveSlotSelect && dom.saveSlotSelect.value) {
      deleteSlot(dom.saveSlotSelect.value, true);
    }
  });
  if (dom.saveSlotSelect) {
    dom.saveSlotSelect.addEventListener('change', () => {
      if (dom.saveSlotName) dom.saveSlotName.value = dom.saveSlotSelect.value;
      setSlotStatus(t('Слот выбран.', 'Slot selected.', 'Slot ausgewählt.'));
    });
  }

  ZQ.readTermSettings = readTermSettings;
  ZQ.normalizeTermSettings = normalizeTermSettings;
  ZQ.applyTermSettings = applyTermSettings;
  ZQ.applyFonts = applyFonts;
  ZQ.loggingSummary = loggingSummary;
  ZQ.setLogging = setLogging;
  ZQ.setMusicEnabled = setMusicEnabled;
  ZQ.setMusicVolume = setMusicVolume;
  ZQ.setMusicRate = setMusicRate;
  ZQ.setMusicAlgorithm = setMusicAlgorithm;
  ZQ.setSpeed = setSpeed;
  ZQ.setFontSize = setFontSize;
  ZQ.setFontOverride = setFontOverride;
  ZQ.openSettings = openSettings;
  ZQ.openTermSettings = openTermSettings;
  ZQ.openFontSettings = openFontSettings;
  ZQ.closeSettings = closeSettings;
  ZQ.appendLog = appendLog;
  ZQ.logEvent = logEvent;
  ZQ.clearLog = clearLog;
  ZQ.whenLogsIdle = whenLogsIdle;
  ZQ.isTyping = isTyping;
  ZQ.rememberCommand = rememberCommand;
  ZQ.historyText = historyText;
  ZQ.refreshCommandSuggestions = refreshCommandSuggestions;
  ZQ.completeSuggestion = completeSuggestion;
  ZQ.hideSuggestions = hideSuggestions;
  ZQ.updateMusicUI = updateMusicUI;
  ZQ.translateLog = translateLog;
  ZQ.saveWorld = saveWorld;
  ZQ.loadWorld = loadWorld;
  ZQ.exportWorld = exportWorld;
  ZQ.refreshSaveSlots = refreshSaveSlots;
  ZQ.slotListText = slotListText;
  ZQ.saveSlotWorld = saveSlotWorld;
  ZQ.loadSlotWorld = loadSlotWorld;
  ZQ.renameSlot = renameSlot;
  ZQ.deleteSlot = deleteSlot;
  ZQ.importWorldData = importWorldData;
  ZQ.categoryName = categoryName;
})();
