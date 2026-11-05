/* Карта участка: только чтение и метки мелом. */
(function () {
  'use strict';

  const ZQ = window.ZQ;
  const rt = ZQ.rt;
  const dom = ZQ.dom;

  function updateMapNote() {
    if (rt.state.items.includes('map_fragment')) {
      dom.mapNote.textContent = 'Обрывок карты разворачивается: видны комнаты вокруг и оставленные рюкзаки.';
    } else {
      dom.mapNote.textContent = 'Пока это только память о пройденном и о соседних комнатах.';
    }
  }

  function drawMapNow() {
    try {
      window.Renderer.drawMap(dom.mapCanvas, rt.state, rt.world);
    } catch (error) {
      console.error(error);
    }
  }

  function openMap() {
    if (ZQ.isTrialBlocking()) return;
    if (!ZQ.hasUnlock('map')) {
      ZQ.appendLog(ZQ.denyLocked('map'), 'sys', true);
      return;
    }
    ZQ.ensureTerminalShare(0.42);
    updateMapNote();
    ZQ.setTerminalView('map');
    window.requestAnimationFrame(() => {
      drawMapNow();
      window.requestAnimationFrame(drawMapNow);
    });
    ZQ.resetKeys();
  }

  function closeMap() {
    ZQ.setTerminalView('main');
    ZQ.updatePrompt();
  }

  dom.mapClose.addEventListener('click', closeMap);

  ZQ.updateMapNote = updateMapNote;
  ZQ.drawMapNow = drawMapNow;
  ZQ.openMap = openMap;
  ZQ.closeMap = closeMap;
})();
