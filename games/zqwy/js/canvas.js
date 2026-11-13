/* Единая канва для «холстов» игры: стол, инвентарь и будущие модули.
   Модуль не знает, что именно лежит на сцене. Он даёт одинаковый
   каркас: рабочая поверхность, бесконечная сетка, масштаб вокруг
   курсора, панорамирование фона, узлы в нормализованных координатах
   (0…1) и перетаскивание узлов по всей поверхности.

   Подключение нового модуля:

     const canvas = ZQ.Canvas.create({
       surface: dom.mySurface,   // div с overflow: hidden
       stage: dom.myStage,       // div.canvas-stage внутри surface
       grid: dom.myGrid,         // div.canvas-grid (необязательно)
       links: dom.myLinks,       // svg.canvas-links (необязательно)
       elements: dom.myNodes,    // div.canvas-elements
       get: () => ({ zoom, panX, panY }),
       set: (view) => { zoom, panX, panY = …, },
       onChange: () => {}
     });
     canvas.attachViewport();
     const cleanup = canvas.bindNodeDrag(node, position, {
       onMove: (pos) => { drawLinks(); },
       onEnd: (moved) => { if (moved) ZQ.saveGame(); }
     });

   Позиции узлов хранятся как nx/ny относительно сцены. Значения
   могут выходить за 0…1: канва бесконечная, поэтому узел можно увести
   за край и вернуть панорамированием. */
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

  function applyTransform(surface, stage, grid, view) {
    const zoom = clampZoom(view && view.zoom);
    const panX = finite(view && view.panX, 0);
    const panY = finite(view && view.panY, 0);

    if (stage) {
      stage.style.transformOrigin = '50% 50%';
      stage.style.transform =
        `translate(${panX.toFixed(2)}px, ${panY.toFixed(2)}px) scale(${zoom.toFixed(4)})`;
    }

    /* Сетка живёт вне сцены, чтобы оставаться непрерывной при любом
       сдвиге. Её размер и смещение повторяют трансформацию сцены. */
    if (grid && surface) {
      const width = Math.max(1, surface.clientWidth || 1);
      const height = Math.max(1, surface.clientHeight || 1);
      const size = 22 * zoom;
      const originX = width / 2 + panX - (width / 2) * zoom;
      const originY = height / 2 + panY - (height / 2) * zoom;
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
      applyTransform(surface, stage, grid, current());
      if (typeof config.onChange === 'function') config.onChange(current());
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

    /* Перетаскивание узла. Сцена может быть масштабирована, поэтому
       делим экранное смещение на реальный размер сцены. */
    function bindNodeDrag(node, position, callbacks) {
      const handlers = callbacks || {};
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
        const nx = drag.nx + dx / drag.rect.width;
        const ny = drag.ny + dy / drag.rect.height;
        position.nx = nx;
        position.ny = ny;
        placeNode(node, position);
        if (typeof handlers.onMove === 'function') handlers.onMove(position);
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
          if (typeof handlers.onEnd === 'function') handlers.onEnd(true, position);
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
      get: current,
      set,
      apply,
      setZoom,
      setPan,
      reset,
      attachViewport,
      bindNodeDrag,
      drawLinks,
      placeNode
    };
  }

  function placeNode(node, position) {
    if (!node || !position) return;
    const nx = finite(position.nx, 0.5);
    const ny = finite(position.ny, 0.5);
    node.style.left = `${(nx * 100).toFixed(2)}%`;
    node.style.top = `${(ny * 100).toFixed(2)}%`;
  }

  ZQ.Canvas = {
    create,
    applyTransform,
    placeNode,
    clampZoom
  };
})();