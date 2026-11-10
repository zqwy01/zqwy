/* Музыкальный модуль: отдельный плеер с волной, перемоткой,
   громкостью и скоростью воспроизведения. */
(function () {
  'use strict';

  const ZQ = window.ZQ;
  const C = ZQ.C;
  const rt = ZQ.rt;
  const dom = ZQ.dom;

  function tr(text) {
    return window.ZQI18N && typeof window.ZQI18N.tr === 'function'
      ? window.ZQI18N.tr(text)
      : text;
  }

  function openMusic() {
    if (typeof ZQ.isTrialBlocking === 'function' && ZQ.isTrialBlocking()) return;
    if (typeof ZQ.ensureTerminalShare === 'function') ZQ.ensureTerminalShare(0.5);
    if (typeof ZQ.applyTermSettings === 'function') ZQ.applyTermSettings(false);
    ZQ.setTerminalView('music');
    ZQ.updateMusicUI();
    if (ZQ.audio && typeof ZQ.audio.decodePeaks === 'function') ZQ.audio.decodePeaks();
    drawWave();
    if (ZQ.logEvent) ZQ.logEvent('terminal', 'открыт музыкальный плеер', 'терминал');
  }

  function closeMusic() {
    ZQ.setTerminalView('main');
    ZQ.updatePrompt();
    if (ZQ.logEvent) ZQ.logEvent('terminal', 'закрыт музыкальный плеер', 'терминал');
  }

  function drawWave() {
    const canvas = dom.musicWave;
    if (!canvas || !canvas.getContext) return;
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
    const width = Math.round(rect.width * dpr);
    const height = Math.round(rect.height * dpr);
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, width, height);

    const audio = ZQ.audio;
    const bars = audio && typeof audio.waveform === 'function'
      ? audio.waveform(72)
      : [];
    const progress = audio && typeof audio.progress === 'function'
      ? audio.progress()
      : 0;
    if (!bars.length) return;

    const gap = 2 * dpr;
    const barWidth = Math.max(1, (width - gap * (bars.length - 1)) / bars.length);
    const middle = height / 2;
    for (let i = 0; i < bars.length; i += 1) {
      const x = i * (barWidth + gap);
      const amplitude = Math.max(0.05, bars[i]);
      const barHeight = Math.max(2 * dpr, amplitude * (height * 0.86));
      const played = (i + 0.5) / bars.length <= progress;
      ctx.fillStyle = played
        ? 'rgba(229, 161, 104, 0.94)'
        : 'rgba(158, 164, 151, 0.3)';
      ctx.fillRect(x, middle - barHeight / 2, barWidth, barHeight);
    }

    /* Центральная линия и маркер перемотки: видно, где именно
       находится игрок на всём треке. */
    ctx.fillStyle = 'rgba(196, 204, 193, 0.16)';
    ctx.fillRect(0, Math.round(middle), width, Math.max(1, dpr));
    ctx.fillStyle = 'rgba(255, 226, 190, 0.9)';
    const lineX = Math.round(progress * width);
    ctx.fillRect(lineX, 0, Math.max(1, dpr * 1.5), height);
  }

  function seekFromPointer(event) {
    const canvas = dom.musicWave;
    const audio = ZQ.audio;
    if (!canvas || !audio || typeof audio.seekFraction !== 'function') return;
    const rect = canvas.getBoundingClientRect();
    if (!rect.width) return;
    const fraction = (event.clientX - rect.left) / rect.width;
    if (audio.seekFraction(fraction)) {
      if (typeof ZQ.updateMusicUI === 'function') ZQ.updateMusicUI();
      drawWave();
    }
  }

  if (dom.musicWave) {
    let seeking = false;
    dom.musicWave.addEventListener('pointerdown', (event) => {
      if (event.button !== undefined && event.button !== 0) return;
      event.preventDefault();
      seeking = true;
      try {
        dom.musicWave.setPointerCapture(event.pointerId);
      } catch (error) {
        /* необязательный захват указателя */
      }
      seekFromPointer(event);
    });
    dom.musicWave.addEventListener('pointermove', (event) => {
      if (seeking) seekFromPointer(event);
    });
    const endSeek = (event) => {
      if (!seeking) return;
      seeking = false;
      try {
        dom.musicWave.releasePointerCapture(event.pointerId);
      } catch (error) {
        /* необязательный захват указателя */
      }
    };
    dom.musicWave.addEventListener('pointerup', endSeek);
    dom.musicWave.addEventListener('pointercancel', endSeek);
  }

  function tick() {
    if (rt.termView !== 'music') return;
    if (typeof ZQ.updateMusicUI === 'function') ZQ.updateMusicUI();
    drawWave();
  }

  window.setInterval(tick, 120);

  window.addEventListener('resize', () => {
    if (rt.termView === 'music') {
      window.requestAnimationFrame(drawWave);
    }
  });

  if (dom.musicClose) dom.musicClose.addEventListener('click', closeMusic);
  if (dom.musicBack) dom.musicBack.addEventListener('click', () => ZQ.openSettings());
  if (dom.openMusic) dom.openMusic.addEventListener('click', openMusic);

  if (dom.musicRate) {
    dom.musicRate.addEventListener('input', () => {
      if (typeof ZQ.setMusicRate === 'function') {
        ZQ.setMusicRate(Number(dom.musicRate.value) / 100);
      }
      tick();
    });
  }

  if (dom.musicView) {
    dom.musicView.addEventListener('click', (event) => {
      const preset = event.target.closest('[data-rate]');
      if (preset && typeof ZQ.setMusicRate === 'function') {
        ZQ.setMusicRate(Number(preset.dataset.rate) / 100);
        tick();
        return;
      }
      const algorithm = event.target.closest('[data-algorithm]');
      if (algorithm && typeof ZQ.setMusicAlgorithm === 'function') {
        ZQ.setMusicAlgorithm(algorithm.dataset.algorithm);
        const meta = (C.music.rateAlgorithms || []).find((entry) =>
          entry.id === algorithm.dataset.algorithm
        );
        if (dom.musicAlgorithmCurrent && meta) {
          dom.musicAlgorithmCurrent.textContent = tr(meta.title);
        }
        if (ZQ.appendLog) {
          ZQ.appendLog(
            `Алгоритм скорости: «${meta ? tr(meta.title) : algorithm.dataset.algorithm}».`,
            'reply',
            true
          );
        }
        tick();
      }
    });
  }

  if (dom.musicAlgorithmPresets) {
    const active = rt.termSettings.musicAlgorithm;
    const meta = (C.music.rateAlgorithms || []).find((entry) => entry.id === active);
    if (dom.musicAlgorithmCurrent && meta) {
      dom.musicAlgorithmCurrent.textContent = tr(meta.title);
    }
    dom.musicAlgorithmPresets.querySelectorAll('[data-algorithm]').forEach((button) => {
      button.classList.toggle('active', button.dataset.algorithm === active);
    });
  }

  if (dom.soundtrack) {
    for (const eventName of ['timeupdate', 'play', 'pause', 'loadedmetadata', 'ratechange']) {
      dom.soundtrack.addEventListener(eventName, tick);
    }
  }

  ZQ.openMusic = openMusic;
  ZQ.closeMusic = closeMusic;
  ZQ.drawMusicWave = drawWave;
})();
