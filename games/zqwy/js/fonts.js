/* Единая типографика.
   Все размеры текста в CSS берутся из токенов --fs-* и масштабируются
   одной переменной --type-unit. Модуль переключает единицу для всего
   интерфейса, терминала и стола, не размазывая пересчёт по коду. */
(function () {
  'use strict';

  const BASE = 14;
  const TOKENS = {
    micro: 0.714,
    xs: 0.786,
    sm: 0.857,
    md: 1,
    lg: 1.143,
    xl: 1.357,
    h2: 1.643,
    h1: 2.071
  };

  function unitFor(value) {
    const n = Number(value);
    return Number.isFinite(n) && n > 0 ? Math.round(n) : BASE;
  }

  function apply(globalSize, overrides) {
    const root = document.documentElement;
    const globalUnit = unitFor(globalSize);
    root.style.setProperty('--type-unit', `${globalUnit}px`);

    const terminal = document.querySelector('.terminal');
    if (terminal) {
      const terminalUnit = unitFor(overrides && overrides.terminal);
      if (overrides && Number(overrides.terminal) > 0) {
        terminal.style.setProperty('--type-unit', `${terminalUnit}px`);
      } else {
        terminal.style.removeProperty('--type-unit');
      }
    }

    const canvas = document.getElementById('view-canvas');
    if (canvas) {
      const tableUnit = unitFor(overrides && overrides.table);
      if (overrides && Number(overrides.table) > 0) {
        canvas.style.setProperty('--type-unit', `${tableUnit}px`);
      } else {
        canvas.style.removeProperty('--type-unit');
      }
    }

    /* Старые стили могли кэшировать --ui-scale: убираем, чтобы не
       осталось двух источников истины. */
    root.style.removeProperty('--ui-scale');
    if (terminal) terminal.style.removeProperty('--ui-scale');
    if (canvas) canvas.style.removeProperty('--ui-scale');
  }

  function token(name, fallback) {
    return `var(--fs-${name}, ${fallback || '14px'})`;
  }

  window.ZQFonts = {
    BASE,
    TOKENS,
    unitFor,
    apply,
    token
  };
})();
