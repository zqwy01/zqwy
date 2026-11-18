/* Единая канва для «холстов» игры: стол, инвентарь, сюжет и будущие
   модули. Модуль не знает, что именно лежит на сцене. Он даёт
   одинаковый каркас: рабочая поверхность, бесконечная сетка, масштаб
   вокруг курсора, панорамирование фона, узлы в нормализованных
   координатах (0…1) или в пикселях сцены, перетаскивание узлов и
   единую панель управления внутри самой канвы.

   Подключение нового модуля:

     const canvas = ZQ.Canvas.create({
       surface: dom.mySurface,   // div с overflow: hidden
       stage: dom.myStage,       // div.canvas-stage внутри surface
       grid: dom.myGrid,         // div.canvas-grid (необязательно)
       links: dom.myLinks,       // svg.canvas-links (необязательно)
       elements: dom.myNodes,    // div.canvas-elements
       origin: '50% 50%',        // или '0 0' для пиксельной сцены
       get: () => ({ zoom, panX, panY }),
       set: (view) => { zoom, panX, panY = …, },
       onChange: () => {}
     });
     canvas.attachViewport();
     ZQ.Canvas.mountControls({
       canvas,
       idPrefix: 'my',
       fit: () => canvas.fitToNodes('.my-node'),
       grid: () => canvas.alignToGrid('.my-node', 22, { apply: rows => { … } })
     });
     const cleanup = canvas.bindNodeDrag(node, position, {
       onMove: (pos) => { drawLinks(); },
       onEnd: (moved) => { if (moved) ZQ.saveGame(); }
     });

   Позиции узлов по умолчанию хранятся как nx/ny относительно сцены.
   Значения могут выходить за 0…1: канва бесконечная, поэтому узел
   можно увести за край и вернуть панорамированием. Для сцен, которые
   исторически живут в пикселях (сюжетная ветвь), drag принимает
   units: 'px' и объект { x, y }. */
(function () {
  'use strict';

  const ZQ = window.ZQ;
  const rt = ZQ.rt;

  function finite(value, fallback) {
    return Number.isFinite(Number(value)) ? Number(value) : fallback;
  }

  function clampZoom(value) {
    return ZQ.Viewport
      ? ZQ.Viewport.clampZoom(value)
      : ZQ.clamp(finite(value, 1), 0.18, 3.2);
  }

  function normalizeOrigin(origin) {
    return origin === '0 0' ? '0 0' : '50% 50%';
  }

  function applyTransform(surface, stage, grid, view, origin) {
    const zoom = clampZoom(view && view.zoom);
    const panX = finite(view && view.panX, 0);
    const panY = finite(view && view.panY, 0);
    const transformOrigin = normalizeOrigin(origin);

    if (stage) {
      stage.style.transformOrigin = transformOrigin;
      stage.style.transform =
        `translate(${panX.toFixed(2)}px, ${panY.toFixed(2)}px) scale(${zoom.toFixed(4)})`;
    }

    /* Сетка живёт вне сцены, чтобы оставаться непрерывной при любом
       сдвиге. Её размер и смещение повторяют трансформацию сцены. */
    if (grid && surface) {
      const width = Math.max(1, surface.clientWidth || 1);
      const height = Math.max(1, surface.clientHeight || 1);
      const size = 22 * zoom;
      const centered = transformOrigin !== '0 0';
      const originX = (centered ? (width / 2) * (1 - zoom) : 0) + panX;
      const originY = (centered ? (height / 2) * (1 - zoom) : 0) + panY;
      const offsetX = ((originX % size) + size) % size;
      const offsetY = ((originY % size) + size) % size;
      grid.style.backgroundSize = `${size.toFixed(2)}px ${size.toFixed(2)}px`;
      grid.style.backgroundPosition = `${offsetX.toFixed(2)}px ${offsetY.toFixed(2)}px`;
    }
  }

  function create(options) {
    const config = options || {};
    const surface = config.surface || null;
    const stage = config.stage || null;
    const grid = config.grid || null;
    const links = config.links || null;
    const elements = config.elements || null;
    const origin = normalizeOrigin(config.origin);
    const listeners = [];

    function get() {
      const view = typeof config.get === 'function' ? config.get() : null;
      return view || { zoom: 1, panX: 0, panY: 0 };
    }

    function set(view) {
      if (typeof config.set === 'function') config.set(view);
    }

    function current() {
      const view = get();
      return {
        zoom: clampZoom(view.zoom),
        panX: finite(view.panX, 0),
        panY: finite(view.panY, 0)
      };
    }

    function apply() {
      applyTransform(surface, stage, grid, current(), origin);
      const view = current();
      if (typeof config.onChange === 'function') config.onChange(view);
      for (const listener of listeners) {
        try {
          listener(view);
        } catch (error) {
          console.error(error);
        }
      }
    }

    /* Подписка на изменения вида: панель управления обновляет
       процент масштаба одинаково во всех канвасах. */
    function subscribe(listener) {
      if (typeof listener !== 'function') return () => {};
      listeners.push(listener);
      return () => {
        const index = listeners.indexOf(listener);
        if (index !== -1) listeners.splice(index, 1);
      };
    }

    function setZoom(value, announce) {
      const view = current();
      set({ ...view, zoom: clampZoom(value) });
      apply();
      if (announce && typeof config.announce === 'function') {
        config.announce(`${Math.round(current().zoom * 100)}%`);
      }
      return current().zoom;
    }

    function setPan(x, y) {
      const view = current();
      set({ ...view, panX: finite(x, view.panX), panY: finite(y, view.panY) });
      apply();
    }

    function reset(announce) {
      set({ zoom: 1, panX: 0, panY: 0 });
      apply();
      if (announce && typeof config.announce === 'function') config.announce('100%');
    }

    function attachViewport() {
      if (!surface || !stage || !ZQ.Viewport) return null;
      ZQ.Viewport.attach({
        surface,
        content: stage,
        origin,
        get: current,
        set: (view) => set({
          zoom: clampZoom(view.zoom),
          panX: finite(view.panX, 0),
          panY: finite(view.panY, 0)
        }),
        onChange: apply,
        onReset: () => reset(true),
        canStart: config.canStart
      });
      apply();
      return true;
    }

    /* Вписывает все узлы выбранного вида в окно канвы. Координаты
       считаются в локальной системе сцены, поэтому работают и для
       процентных, и для пиксельных сцен. */
    function fitToNodes(selector, options) {
      if (!surface || !stage) return false;
      const opts = options || {};
      const scope = elements || stage;
      const nodes = scope.querySelectorAll(selector || '.canvas-node');
      if (!nodes.length) return false;

      const stageRect = stage.getBoundingClientRect();
      const zoom = current().zoom || 1;
      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;

      for (const node of nodes) {
        const rect = node.getBoundingClientRect();
        if (!rect.width && !rect.height) continue;
        const x = (rect.left - stageRect.left) / zoom;
        const y = (rect.top - stageRect.top) / zoom;
        const w = rect.width / zoom;
        const h = rect.height / zoom;
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x + w);
        maxY = Math.max(maxY, y + h);
      }
      if (!Number.isFinite(minX) || !Number.isFinite(minY)) return false;

      const surfaceRect = surface.getBoundingClientRect();
      const width = Math.max(1, surfaceRect.width);
      const height = Math.max(1, surfaceRect.height);
      const pad = finite(opts.pad, 24);
      const maxZoom = finite(opts.maxZoom, 1.4);
      const contentW = Math.max(1, maxX - minX);
      const contentH = Math.max(1, maxY - minY);
      const fit = Math.min(
        (width - pad * 2) / contentW,
        (height - pad * 2) / contentH,
        maxZoom
      );
      const nextZoom = clampZoom(fit);
      const centerX = (minX + maxX) / 2;
      const centerY = (minY + maxY) / 2;
      const viewCenterX = width / 2;
      const viewCenterY = height / 2;
      const panX = origin === '0 0'
        ? viewCenterX - centerX * nextZoom
        : (viewCenterX - centerX) * nextZoom;
      const panY = origin === '0 0'
        ? viewCenterY - centerY * nextZoom
        : (viewCenterY - centerY) * nextZoom;

      set({ zoom: nextZoom, panX, panY });
      apply();
      return true;
    }

    /* Выравнивает узлы по шагу сетки. Возвращает строки с локальными
       координатами; модуль сам решает, как сохранить их в своей модели. */
    function alignToGrid(selector, step, options) {
      if (!stage) return [];
      const opts = options || {};
      const scope = elements || stage;
      const nodes = scope.querySelectorAll(selector || '.canvas-node');
      const stageRect = stage.getBoundingClientRect();
      const zoom = current().zoom || 1;
      const size = Math.max(1, finite(step, 22));
      const centerAnchor = opts.anchor === 'center';
      const rows = [];

      for (const node of nodes) {
        const rect = node.getBoundingClientRect();
        if (!rect.width && !rect.height) continue;
        const width = rect.width / zoom;
        const height = rect.height / zoom;
        let x = (rect.left - stageRect.left) / zoom;
        let y = (rect.top - stageRect.top) / zoom;
        if (centerAnchor) {
          x += width / 2;
          y += height / 2;
        }
        rows.push({
          node,
          x: Math.round(x / size) * size,
          y: Math.round(y / size) * size,
          width,
          height
        });
      }

      if (typeof opts.apply === 'function') opts.apply(rows);
      return rows;
    }

    /* Перетаскивание узла. Сцена может быть масштабирована, поэтому
       делим экранное смещение на масштаб. units: 'px' двигает объект
       { x, y } в пикселях сцены, иначе — nx/ny в процентах. */
    function bindNodeDrag(node, position, callbacks) {
      const handlers = callbacks || {};
      const pixelUnits = handlers.units === 'px';
      let drag = null;

      const move = (event) => {
        if (!drag || event.pointerId !== drag.pointerId) return;
        const dx = event.clientX - drag.startX;
        const dy = event.clientY - drag.startY;
        if (!drag.moved && Math.hypot(dx, dy) <= (handlers.threshold || 3)) return;
        if (!drag.moved) {
          drag.moved = true;
          node.classList.add('dragging');
        }
        event.preventDefault();
        /* Канва бесконечная: координаты не обрезаются по краям. */
        if (pixelUnits) {
          position.x = drag.x + dx / drag.zoom;
          position.y = drag.y + dy / drag.zoom;
          placeNode(node, position, 'px');
        } else {
          position.nx = drag.nx + dx / drag.rect.width;
          position.ny = drag.ny + dy / drag.rect.height;
          placeNode(node, position);
        }
        if (typeof handlers.onMove === 'function') handlers.onMove(position, event);
      };

      const finish = (event) => {
        if (!drag || event.pointerId !== drag.pointerId) return;
        const moved = drag.moved;
        drag = null;
        node.classList.remove('dragging');
        node.removeEventListener('pointermove', move);
        node.removeEventListener('pointerup', finish);
        node.removeEventListener('pointercancel', cancel);
        try {
          node.releasePointerCapture(event.pointerId);
        } catch (error) {
          /* capture не обязателен */
        }
        if (moved) {
          if (typeof handlers.onEnd === 'function') handlers.onEnd(true, position, event);
        } else if (typeof handlers.onClick === 'function') {
          handlers.onClick(event);
        }
      };

      const cancel = (event) => {
        if (!drag || event.pointerId !== drag.pointerId) return;
        drag = null;
        node.classList.remove('dragging');
        node.removeEventListener('pointermove', move);
        node.removeEventListener('pointerup', finish);
        node.removeEventListener('pointercancel', cancel);
        if (typeof handlers.onEnd === 'function') handlers.onEnd(false, position);
      };

      const down = (event) => {
        if (event.button !== undefined && event.button !== 0) return;
        if (handlers.ignore && event.target.closest(handlers.ignore)) return;
        event.preventDefault();
        event.stopPropagation();
        const source = stage || surface;
        const rect = source ? source.getBoundingClientRect() : null;
        if (!rect || !rect.width || !rect.height) return;
        drag = {
          pointerId: event.pointerId,
          startX: event.clientX,
          startY: event.clientY,
          nx: finite(position.nx, 0.5),
          ny: finite(position.ny, 0.5),
          x: finite(position.x, 0),
          y: finite(position.y, 0),
          zoom: current().zoom || 1,
          rect,
          moved: false
        };
        node.addEventListener('pointermove', move);
        node.addEventListener('pointerup', finish);
        node.addEventListener('pointercancel', cancel);
        try {
          node.setPointerCapture(event.pointerId);
        } catch (error) {
          /* Старые браузеры могут не поддерживать capture. */
        }
      };

      node.addEventListener('pointerdown', down);

      return {
        destroy() {
          node.removeEventListener('pointerdown', down);
          node.removeEventListener('pointermove', move);
          node.removeEventListener('pointerup', finish);
          node.removeEventListener('pointercancel', cancel);
        }
      };
    }

    /* Связи в нормализованных координатах: SVG растягивается на всю
       сцену, а толщина линий остаётся экранной. */
    function drawLinks(edges, positionFor, options) {
      if (!links) return;
      const opts = options || {};
      links.textContent = '';
      links.setAttribute('viewBox', '0 0 100 100');
      links.setAttribute('preserveAspectRatio', 'none');
      for (const edge of edges || []) {
        const from = positionFor(edge.from);
        const to = positionFor(edge.to);
        if (!from || !to) continue;
        if (opts.skip && opts.skip(edge)) continue;
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('x1', (from.nx * 100).toFixed(2));
        line.setAttribute('y1', (from.ny * 100).toFixed(2));
        line.setAttribute('x2', (to.nx * 100).toFixed(2));
        line.setAttribute('y2', (to.ny * 100).toFixed(2));
        line.setAttribute('vector-effect', 'non-scaling-stroke');
        const base = opts.className || 'canvas-link';
        const kind = edge.kind ? ` ${edge.kind}` : '';
        line.setAttribute('class', `${base}${kind}`);
        links.appendChild(line);
      }
    }

    return {
      surface,
      stage,
      grid,
      links,
      elements,
      origin,
      get: current,
      set,
      apply,
      subscribe,
      setZoom,
      setPan,
      reset,
      attachViewport,
      fitToNodes,
      alignToGrid,
      bindNodeDrag,
      drawLinks,
      placeNode
    };
  }

  function placeNode(node, position, units) {
    if (!node || !position) return;
    if (units === 'px') {
      node.style.left = `${finite(position.x, 0).toFixed(2)}px`;
      node.style.top = `${finite(position.y, 0).toFixed(2)}px`;
      return;
    }
    const nx = finite(position.nx, 0.5);
    const ny = finite(position.ny, 0.5);
    node.style.left = `${(nx * 100).toFixed(2)}%`;
    node.style.top = `${(ny * 100).toFixed(2)}%`;
  }

  function controlSeparator() {
    const separator = document.createElement('span');
    separator.className = 'canvas-controls-sep';
    separator.setAttribute('aria-hidden', 'true');
    return separator;
  }

  /* Единая панель управления канвой. Она живёт внутри поверхности и
     выглядит одинаково на столе, в инвентаре и в ветви сюжета.
     Модуль передаёт только свои сущности: fit, grid и дополнительные
     действия вроде «закрепить» или «добавить». */
  function mountControls(options) {
    const opts = options || {};
    const canvas = opts.canvas;
    const container = opts.container || (canvas && canvas.surface);
    if (!canvas || !container) return null;

    const tr = (text) => (typeof ZQ.tr === 'function' ? ZQ.tr(text) : text);
    const idPrefix = opts.idPrefix || 'canvas';
    const ids = opts.ids || {};
    const buttons = {};

    const root = document.createElement('div');
    root.className = 'canvas-controls';
    root.setAttribute('data-no-pan', '');
    root.setAttribute('role', 'toolbar');
    root.setAttribute('aria-label', tr('Управление канвой'));

    function makeButton(id, className, text, title, onClick, ariaLabel) {
      const button = document.createElement('button');
      button.type = 'button';
      button.id = id;
      button.className = className;
      button.textContent = text;
      if (title) button.title = tr(title);
      button.setAttribute('aria-label', tr(ariaLabel || title || text));
      if (typeof onClick === 'function') button.addEventListener('click', onClick);
      buttons[id] = button;
      return button;
    }

    const extras = Array.isArray(opts.extras) ? opts.extras : [];
    if (extras.length) {
      const group = document.createElement('div');
      group.className = 'canvas-controls-group';
      for (const extra of extras) {
        if (!extra || !extra.id) continue;
        const className = `zoom-btn canvas-controls-text${extra.className ? ` ${extra.className}` : ''}`;
        const button = makeButton(
          extra.id,
          className,
          tr(extra.label || ''),
          extra.title,
          extra.onClick,
          extra.ariaLabel
        );
        if (extra.active) button.classList.add('active');
        if (typeof extra.ariaExpanded === 'boolean') {
          button.setAttribute('aria-expanded', String(extra.ariaExpanded));
        }
        group.appendChild(button);
      }
      if (group.childElementCount) {
        root.appendChild(group);
        root.appendChild(controlSeparator());
      }
    }

    const zoomGroup = document.createElement('div');
    zoomGroup.className = 'canvas-controls-group';
    zoomGroup.setAttribute('role', 'group');
    zoomGroup.setAttribute('aria-label', tr('Масштаб'));

    const zoomOut = makeButton(
      ids.zoomOut || `${idPrefix}-zoom-out`,
      'zoom-btn',
      '−',
      'Отдалить',
      () => canvas.setZoom(canvas.get().zoom / 1.18),
      'Отдалить'
    );
    zoomGroup.appendChild(zoomOut);

    const resetButton = makeButton(
      ids.reset || `${idPrefix}-zoom-reset`,
      'zoom-btn zoom-value',
      '',
      'Сбросить масштаб',
      () => canvas.reset(true),
      'Сбросить масштаб'
    );
    const label = document.createElement('span');
    label.id = ids.label || `${idPrefix}-zoom-label`;
    label.textContent = '100%';
    resetButton.appendChild(label);
    zoomGroup.appendChild(resetButton);

    const zoomIn = makeButton(
      ids.zoomIn || `${idPrefix}-zoom-in`,
      'zoom-btn',
      '+',
      'Приблизить',
      () => canvas.setZoom(canvas.get().zoom * 1.18),
      'Приблизить'
    );
    zoomGroup.appendChild(zoomIn);
    root.appendChild(zoomGroup);

    const actions = document.createElement('div');
    actions.className = 'canvas-controls-group';
    const fit = makeButton(
      ids.fit || `${idPrefix}-fit`,
      'zoom-btn canvas-controls-text',
      tr('развернуть'),
      'Показать всё',
      () => {
        if (typeof opts.fit === 'function') opts.fit();
        else canvas.fitToNodes(opts.selector || '.canvas-node', opts.fitOptions);
      },
      'Показать всё'
    );
    actions.appendChild(fit);
    const grid = makeButton(
      ids.grid || `${idPrefix}-align-grid`,
      'zoom-btn canvas-controls-text',
      tr('сетка'),
      'Выровнять по сетке',
      () => {
        if (typeof opts.grid === 'function') opts.grid();
        else canvas.alignToGrid(opts.selector || '.canvas-node', opts.step || 22, opts.gridOptions);
      },
      'Выровнять по сетке'
    );
    actions.appendChild(grid);
    root.appendChild(actions);

    const update = () => {
      label.textContent = `${Math.round(canvas.get().zoom * 100)}%`;
    };
    canvas.subscribe(update);
    update();
    container.appendChild(root);

    return { element: root, label, buttons, update };
  }

  ZQ.Canvas = {
    create,
    applyTransform,
    mountControls,
    placeNode,
    clampZoom
  };
})();
