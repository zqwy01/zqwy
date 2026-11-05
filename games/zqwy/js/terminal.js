/* Терминал: сообщения, представления, настройки и логгирование. */
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

  function readTermSettings() {
    const fallback = {
      speed: DEFAULT.speed,
      fontSize: DEFAULT.fontSize,
      fontOverrides: { ...DEFAULT.fontOverrides },
      logging: { ...DEFAULT.logging },
      music: DEFAULT.music
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
      return {
        speed: Number.isFinite(parsed.speed) ? parsed.speed : fallback.speed,
        fontSize: Number.isFinite(parsed.fontSize) ? parsed.fontSize : fallback.fontSize,
        fontOverrides: {
          terminal: Number.isFinite(overrides.terminal) ? overrides.terminal : 0,
          table: Number.isFinite(overrides.table) ? overrides.table : 0
        },
        logging: {
          enabled: typeof logging.enabled === 'boolean' ? logging.enabled : fallback.logging.enabled,
          movement: typeof logging.movement === 'boolean' ? logging.movement : fallback.logging.movement,
          actions: typeof logging.actions === 'boolean' ? logging.actions : fallback.logging.actions,
          commands: typeof logging.commands === 'boolean' ? logging.commands : fallback.logging.commands
        },
        music: typeof parsed.music === 'boolean' ? parsed.music : fallback.music
      };
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
    if (!s.logging || typeof s.logging !== 'object') s.logging = { ...DEFAULT.logging };
    for (const key of ['enabled', 'movement', 'actions', 'commands']) {
      s.logging[key] = typeof s.logging[key] === 'boolean' ? s.logging[key] : DEFAULT.logging[key];
    }
    s.music = typeof s.music === 'boolean' ? s.music : DEFAULT.music;
  }

  function scaleFor(override) {
    const size = override > 0 ? override : rt.termSettings.fontSize;
    return size / FONT_BASE;
  }

  function loggingSummary() {
    const logging = rt.termSettings.logging;
    if (!logging.enabled) return 'выключено';
    const parts = [];
    if (logging.movement) parts.push('движение');
    if (logging.actions) parts.push('действия');
    if (logging.commands) parts.push('команды');
    return parts.length ? `включено: ${parts.join(', ')}` : 'включено, но все категории выключены';
  }

  function applyTermSettings(persist) {
    normalizeTermSettings();
    const s = rt.termSettings;

    document.documentElement.style.setProperty('--ui-scale', String(scaleFor(0)));
    dom.terminal.style.setProperty('--ui-scale', String(scaleFor(s.fontOverrides.terminal)));
    dom.canvasView.style.setProperty('--ui-scale', String(scaleFor(s.fontOverrides.table)));

    if (dom.settingSpeed) {
      dom.settingSpeed.value = String(s.speed);
      dom.settingSpeedNumber.value = String(s.speed);
      dom.settingSpeedValue.textContent = s.speed <= 0 ? 'сразу' : `${s.speed} зн/с`;
    }
    if (dom.settingFont) {
      dom.settingFont.value = String(s.fontSize);
      dom.settingFontNumber.value = String(s.fontSize);
      dom.settingFontValue.textContent = `${s.fontSize} px`;
    }

    const setOverrideInputs = (key) => {
      const value = s.fontOverrides[key];
      const slider = key === 'terminal' ? dom.settingFontTerminal : dom.settingFontTable;
      const number = key === 'terminal' ? dom.settingFontTerminalNumber : dom.settingFontTableNumber;
      if (slider) slider.value = String(value);
      if (number) number.value = String(value);
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

    if (dom.settingLogEnabled) {
      dom.settingLogEnabled.checked = s.logging.enabled;
      dom.settingLogMovement.checked = s.logging.movement;
      dom.settingLogActions.checked = s.logging.actions;
      dom.settingLogCommands.checked = s.logging.commands;
    }
    if (dom.settingLogState) dom.settingLogState.textContent = loggingSummary();

    if (ZQ.audio && typeof ZQ.audio.setEnabled === 'function') {
      ZQ.audio.setEnabled(s.music);
    }

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
    } else if (['movement', 'actions', 'commands'].includes(key)) {
      rt.termSettings.logging[key] = Boolean(value);
    }
    applyTermSettings(true);
  }

  function setMusicEnabled(value) {
    rt.termSettings.music = Boolean(value);
    applyTermSettings(true);
  }

  function openSettings() {
    if (ZQ.isTrialBlocking()) return;
    ZQ.ensureTerminalShare(0.5);
    applyTermSettings(false);
    ZQ.setTerminalView('settings');
    ZQ.resetKeys();
  }

  function closeSettings() {
    ZQ.setTerminalView('main');
    ZQ.updatePrompt();
  }

  dom.settingsClose.addEventListener('click', closeSettings);
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
  dom.settingLogEnabled.addEventListener('change', () => {
    setLogging('enabled', dom.settingLogEnabled.checked);
  });
  dom.settingLogMovement.addEventListener('change', () => {
    setLogging('movement', dom.settingLogMovement.checked);
  });
  dom.settingLogActions.addEventListener('change', () => {
    setLogging('actions', dom.settingLogActions.checked);
  });
  dom.settingLogCommands.addEventListener('change', () => {
    setLogging('commands', dom.settingLogCommands.checked);
  });

  dom.settingsView.addEventListener('click', (event) => {
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
    if (fontButton) setFontSize(fontButton.dataset.font);
  });
  dom.settingsReset.addEventListener('click', () => {
    rt.termSettings = {
      speed: DEFAULT.speed,
      fontSize: DEFAULT.fontSize,
      fontOverrides: { ...DEFAULT.fontOverrides },
      logging: { ...DEFAULT.logging },
      music: DEFAULT.music
    };
    applyTermSettings(true);
  });

  function defaultLabelForType(type) {
    if (type === 'sys') return 'система';
    if (type === 'story') return 'сцена';
    if (type === 'reply') return 'система';
    if (type === 'cmd') return 'Zemic:';
    if (type === 'log-movement') return 'шаг';
    if (type === 'log-actions') return 'действие';
    if (type === 'log-commands') return 'команда';
    return '';
  }

  function appendLog(text, type, instant, label) {
    if (text === null || text === undefined || text === '') return;
    rt.logQueue.push({
      text: String(text),
      type: type || 'sys',
      instant: Boolean(instant) || rt.termSettings.speed <= 0,
      label: label === undefined ? defaultLabelForType(type || 'sys') : label
    });
    pumpLog();
  }

  function logEvent(category, text, label) {
    const logging = rt.termSettings.logging;
    if (!logging.enabled || !logging[category]) return false;
    appendLog(text, `log-${category}`, true, label || defaultLabelForType(`log-${category}`));
    return true;
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

  function pumpLog() {
    if (rt.logBusy) return;
    const entry = rt.logQueue.shift();
    if (!entry) {
      flushLogIdle();
      return;
    }
    rt.logBusy = true;

    const line = document.createElement('div');
    line.className = `log-line ${entry.type}`;
    if (entry.label) {
      const label = document.createElement('span');
      label.className = 'log-label';
      label.textContent = entry.label;
      line.appendChild(label);
    }
    const body = document.createElement('span');
    body.className = 'log-text';
    line.appendChild(body);
    dom.log.appendChild(line);
    dom.log.scrollTop = dom.log.scrollHeight;

    const finish = () => {
      line.querySelectorAll('.cursor').forEach((node) => node.remove());
      rt.logBusy = false;
      dom.log.scrollTop = dom.log.scrollHeight;
      pumpLog();
    };

    if (entry.instant || entry.text.length < 3) {
      body.textContent = entry.text;
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
        body.textContent = entry.text;
        finish();
        return;
      }
      if (rt.logSkip) {
        body.textContent = entry.text;
        finish();
        return;
      }
      budget += rt.termSettings.speed * tick / 1000;
      const add = Math.floor(budget);
      if (add > 0) {
        budget -= add;
        index = Math.min(entry.text.length, index + add);
        body.textContent = entry.text.slice(0, index);
      }
      if (index >= entry.text.length) {
        finish();
        return;
      }
      body.appendChild(cursor);
      dom.log.scrollTop = dom.log.scrollHeight;
      window.setTimeout(step, tick);
    };
    step();
  }

  dom.log.addEventListener('click', () => {
    if (rt.logBusy) rt.logSkip = true;
  });

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

  function showHistory(offset) {
    const history = rt.commandHistory;
    if (!history.length) return;
    if (rt.commandHistoryIndex === -1) {
      /* Из черновика ↑ уходит к последней команде, а ↓ уже некуда. */
      if (offset > 0) return;
      rt.commandDraft = dom.commandInput.value;
      rt.commandHistoryIndex = history.length - 1;
    } else {
      const next = rt.commandHistoryIndex + offset;
      /* После последней команды ↓ возвращает пустой черновик. */
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
  }

  dom.commandInput.addEventListener('keydown', (event) => {
    if (event.code === 'ArrowUp') {
      event.preventDefault();
      showHistory(-1);
    } else if (event.code === 'ArrowDown') {
      event.preventDefault();
      showHistory(1);
    }
  });
  dom.commandInput.addEventListener('input', () => {
    if (rt.commandHistoryIndex !== -1) resetHistory();
  });

  dom.commandForm.addEventListener('submit', (event) => {
    event.preventDefault();
    if (ZQ.isPaused()) {
      appendLog('Сейчас не до команд.', 'sys', true);
      return;
    }
    const value = dom.commandInput.value.trim();
    if (!value) return;
    dom.commandInput.value = '';
    rememberCommand(value);
    appendLog(value, 'cmd', true);
    ZQ.handleCommand(value, 'terminal');
  });

  dom.commandInput.addEventListener('focus', () => {
    dom.termContext.textContent = '';
    dom.termContext.classList.remove('tablet');
    dom.btnAction.classList.add('hidden');
  });

  dom.commandInput.addEventListener('blur', () => {
    ZQ.updatePrompt();
  });

  ZQ.readTermSettings = readTermSettings;
  ZQ.normalizeTermSettings = normalizeTermSettings;
  ZQ.applyTermSettings = applyTermSettings;
  ZQ.loggingSummary = loggingSummary;
  ZQ.setLogging = setLogging;
  ZQ.setMusicEnabled = setMusicEnabled;
  ZQ.openSettings = openSettings;
  ZQ.closeSettings = closeSettings;
  ZQ.appendLog = appendLog;
  ZQ.logEvent = logEvent;
  ZQ.clearLog = clearLog;
  ZQ.whenLogsIdle = whenLogsIdle;
  ZQ.isTyping = isTyping;
  ZQ.rememberCommand = rememberCommand;
})();
