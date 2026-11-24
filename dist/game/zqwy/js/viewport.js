/* Единый взгляд на все «холсты» игры: стол, инвентарь, сюжет и карта.
   Модуль задаёт общий диапазон масштаба и одинаковые жесты: колесо
   масштабирует вокруг курсора, перетаскивание фона двигает сцену,
   двойной клик возвращает 100%. Конкретная сцена передаёт свои
   геттеры/сеттеры, поэтому разметка остаётся простой. */
(function () {
  'use strict';

  const ZQ = window.ZQ;

  const MIN_ZOOM = 0.18;
  const MAX_ZOOM = 3.2;

  function clampZoom(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) return 1;
    return ZQ.clamp(number, MIN_ZOOM, MAX_ZOOM);
  }

  function applyTransform(element, state, origin) {
    if (!element) return;
    const zoom = clampZoom(state.zoom);
    const panX = Number.isFinite(state.panX) ? state.panX : 0;
    const panY = Number.isFinite(state.panY) ? state.panY : 0;
    element.style.transformOrigin = origin || '50% 50%';
    element.style.transform =
      `translate(${panX.toFixed(2)}px, ${panY.toFixed(2)}px) scale(${zoom.toFixed(4)})`;
  }

  /* Зум вокруг точки (клиентские координаты). Возвращает новый масштаб
     и сдвиг, чтобы точка под курсором осталась на месте. origin
     совпадает с transform-origin: у стола и инвентаря это центр
     поверхности, у сюжетного графа — левый верхний угол. */
  function zoomAround(state, surface, clientX, clientY, nextZoom, origin) {
    const zoom = clampZoom(state.zoom);
    const wanted = clampZoom(nextZoom);
    if (Math.abs(wanted - zoom) < 0.0001) return { zoom, panX: state.panX, panY: state.panY };
    const rect = surface.getBoundingClientRect();
    if (!rect.width || !rect.height) return { zoom: wanted, panX: state.panX, panY: state.panY };
    const centered = origin !== '0 0';
    const px = clientX - rect.left - (centered ? rect.width / 2 : 0);
    const py = clientY - rect.top - (centered ? rect.height / 2 : 0);
    const scale = wanted / zoom;
    return {
      zoom: wanted,
      panX: state.panX + px - px * scale,
      panY: state.panY + py - py * scale
    };
  }

  /* Подключает общие жесты к поверхности. options:
     surface  — элемент, по которому двигают
     content  — что трансформировать (элемент или функция, если
                содержимое пересоздаётся, как сюжетный граф)
     get/set  — функции чтения и записи {zoom, panX, panY}
     onChange — перерисовать/озвучить
     onReset  — двойной клик
     origin   — '50% 50%' (по умолчанию) или '0 0'
     min/max  — необязательные переопределения (не выходят за общий) */
  function attach(options) {
    const surface = options.surface;
    if (!surface) return null;
    const contentOf = typeof options.content === 'function'
      ? options.content
      : () => options.content || surface;
    const get = typeof options.get === 'function'
      ? options.get
      : () => ({ zoom: 1, panX: 0, panY: 0 });
    const set = typeof options.set === 'function'
      ? options.set
      : () => {};
    const onChange = typeof options.onChange === 'function'
      ? options.onChange
      : () => {};
    const min = Number.isFinite(options.min) ? Math.max(MIN_ZOOM, options.min) : MIN_ZOOM;
    const max = Number.isFinite(options.max) ? Math.min(MAX_ZOOM, options.max) : MAX_ZOOM;
    const origin = options.origin === '0 0' ? '0 0' : '50% 50%';

    let drag = null;
    let pinch = null;

    const write = (state) => {
      set(state);
      applyTransform(contentOf(), get(), origin);
      onChange(get());
    };

    surface.addEventListener('wheel', (event) => {
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      event.preventDefault();
      const current = get();
      const factor = Math.exp(-event.deltaY * 0.0016);
      const next = ZQ.clamp(current.zoom * factor, min, max);
      write(zoomAround(current, surface, event.clientX, event.clientY, next, origin));
    }, { passive: false });

    surface.addEventListener('pointerdown', (event) => {
      if (event.button !== undefined && event.button !== 0) return;
      if (event.target.closest && event.target.closest('[data-no-pan]')) return;
      if (typeof options.canStart === 'function' && !options.canStart(event)) return;
      const state = get();
      drag = {
        id: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        panX: state.panX,
        panY: state.panY,
        moved: false
      };
      surface.classList.add('panning');
      try {
        surface.setPointerCapture(event.pointerId);
      } catch (error) {
        /* захват не обязателен */
      }
    });

    surface.addEventListener('pointermove', (event) => {
      if (!drag || drag.id !== event.pointerId) return;
      const dx = event.clientX - drag.startX;
      const dy = event.clientY - drag.startY;
      if (!drag.moved && Math.hypot(dx, dy) > 4) drag.moved = true;
      if (!drag.moved) return;
      event.preventDefault();
      write(Object.assign({}, get(), {
        panX: drag.panX + dx,
        panY: drag.panY + dy
      }));
    });

    const finish = (event) => {
      if (!drag || drag.id !== event.pointerId) return;
      drag = null;
      surface.classList.remove('panning');
      try {
        surface.releasePointerCapture(event.pointerId);
      } catch (error) {
        /* ignored */
      }
    };
    surface.addEventListener('pointerup', finish);
    surface.addEventListener('pointercancel', finish);

    surface.addEventListener('dblclick', (event) => {
      if (event.target.closest && event.target.closest('[data-no-pan]')) return;
      if (typeof options.canStart === 'function' && !options.canStart(event)) return;
      if (typeof options.onReset === 'function') options.onReset();
      else write({ zoom: 1, panX: 0, panY: 0 });
    });

    /* Щипок на телефоне: два пальца масштабируют вокруг середины. */
    surface.addEventListener('touchstart', (event) => {
      if (event.touches.length !== 2) return;
      const [a, b] = event.touches;
      const state = get();
      pinch = {
        distance: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY),
        zoom: state.zoom,
        panX: state.panX,
        panY: state.panY,
        x: (a.clientX + b.clientX) / 2,
        y: (a.clientY + b.clientY) / 2
      };
    }, { passive: true });

    surface.addEventListener('touchmove', (event) => {
      if (!pinch || event.touches.length !== 2) return;
      event.preventDefault();
      const [a, b] = event.touches;
      const distance = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
      if (!pinch.distance) return;
      const next = ZQ.clamp(pinch.zoom * (distance / pinch.distance), min, max);
      write(zoomAround(
        { zoom: pinch.zoom, panX: pinch.panX, panY: pinch.panY },
        surface,
        pinch.x,
        pinch.y,
        next,
        origin
      ));
    }, { passive: false });

    surface.addEventListener('touchend', (event) => {
      if (event.touches.length < 2) pinch = null;
    });

    return {
      refresh() {
        applyTransform(contentOf(), get(), origin);
      }
    };
  }

  ZQ.Viewport = {
    MIN_ZOOM,
    MAX_ZOOM,
    clampZoom,
    applyTransform,
    zoomAround,
    attach
  };
})();
