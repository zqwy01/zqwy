/* Ветер гложет скелет забытого миротворца — процедурный звук без файлов.
   Несколько слоёв: низкий гул пустоши, коричневый шум ветра, более светлый
   шипящий слой, порыв и редкие колокольчики на найденные обрывки памяти.
   Ничего не создаётся до первого действия пользователя (autoplay policy). */
window.PEACEMAKER_AUDIO = (function () {
  'use strict';

  var ctx = null;
  var master = null;
  var windGain = null;
  var hissGain = null;
  var gustGain = null;
  var droneGain = null;
  var windFilter = null;
  var hissFilter = null;
  var brownBuffer = null;
  var whiteBuffer = null;
  var enabled = true;
  var lastWindUpdate = 0;

  var MEMORY_NOTES = [392, 440, 523.25, 587.33, 659.25, 783.99, 880, 1046.5];

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

  function makeNoise(kind) {
    var length = Math.floor(ctx.sampleRate * 2);
    var buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    var data = buffer.getChannelData(0);
    var last = 0;
    for (var i = 0; i < length; i += 1) {
      var white = Math.random() * 2 - 1;
      if (kind === 'brown') {
        last = (last + 0.02 * white) / 1.02;
        data[i] = last * 3.4;
      } else {
        data[i] = white * 0.55;
      }
    }
    return buffer;
  }

  function loopSource(buffer) {
    var source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    return source;
  }

  function ensure() {
    if (ctx) return true;
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    try {
      ctx = new AC();

      master = ctx.createGain();
      master.gain.value = enabled ? 0.55 : 0;
      master.connect(ctx.destination);

      brownBuffer = makeNoise('brown');
      whiteBuffer = makeNoise('white');

      // Низкий, медленно дышащий ветер.
      windGain = ctx.createGain();
      windGain.gain.value = 0.02;
      windFilter = ctx.createBiquadFilter();
      windFilter.type = 'lowpass';
      windFilter.frequency.value = 420;
      windFilter.Q.value = 0.6;
      var brown = loopSource(brownBuffer);
      brown.connect(windFilter);
      windFilter.connect(windGain);
      windGain.connect(master);

      // Песчинки: более светлый шипящий слой поверх гула.
      hissGain = ctx.createGain();
      hissGain.gain.value = 0.005;
      hissFilter = ctx.createBiquadFilter();
      hissFilter.type = 'bandpass';
      hissFilter.frequency.value = 1200;
      hissFilter.Q.value = 0.5;
      var white = loopSource(whiteBuffer);
      white.connect(hissFilter);
      hissFilter.connect(hissGain);
      hissGain.connect(master);

      // Порыв — отдельный краткий слой, чтобы не сбивать постоянный ветер.
      gustGain = ctx.createGain();
      gustGain.gain.value = 0;
      var gustFilter = ctx.createBiquadFilter();
      gustFilter.type = 'highpass';
      gustFilter.frequency.value = 520;
      var gustSource = loopSource(whiteBuffer);
      gustSource.connect(gustFilter);
      gustFilter.connect(gustGain);
      gustGain.connect(master);

      // Почти неслышный тон: пустошь не абсолютно тихая.
      droneGain = ctx.createGain();
      droneGain.gain.value = 0.006;
      var droneFilter = ctx.createBiquadFilter();
      droneFilter.type = 'lowpass';
      droneFilter.frequency.value = 280;
      var a = ctx.createOscillator();
      a.type = 'sine';
      a.frequency.value = 82;
      var b = ctx.createOscillator();
      b.type = 'sine';
      b.frequency.value = 82.7;
      a.connect(droneFilter);
      b.connect(droneFilter);
      droneFilter.connect(droneGain);
      droneGain.connect(master);

      var lfo = ctx.createOscillator();
      lfo.type = 'sine';
      lfo.frequency.value = 0.09;
      var lfoGain = ctx.createGain();
      lfoGain.gain.value = 130;
      lfo.connect(lfoGain);
      lfoGain.connect(windFilter.frequency);

      brown.start(0);
      white.start(0);
      gustSource.start(0);
      a.start(0);
      b.start(0);
      lfo.start(0);
      return true;
    } catch (err) {
      ctx = null;
      return false;
    }
  }

  function unlock() {
    if (!enabled || !ensure()) return false;
    try {
      if (ctx.state === 'suspended') ctx.resume();
    } catch (err) { /* без звука игра работает */ }
    return true;
  }

  function setEnabled(value) {
    enabled = !!value;
    if (enabled && !unlock()) return;
    if (!ctx || !master) return;
    try {
      var now = ctx.currentTime;
      master.gain.cancelScheduledValues(now);
      master.gain.setTargetAtTime(enabled ? 0.55 : 0, now, 0.16);
    } catch (err) { /* ignore */ }
  }

  /* Ветер меняется каждый кадр, но аудиопараметры обновляем реже. */
  function setWind(power, sheltered) {
    if (!ctx || !enabled) return;
    var now = ctx.currentTime;
    if (now - lastWindUpdate < 0.07) return;
    lastWindUpdate = now;
    var p = clamp(Number(power) || 0, 0, 1.6) * (sheltered ? 0.22 : 1);
    try {
      windGain.gain.setTargetAtTime(0.014 + p * 0.038, now, 0.22);
      hissGain.gain.setTargetAtTime(0.003 + p * 0.017, now, 0.22);
      windFilter.frequency.setTargetAtTime(280 + p * 620, now, 0.3);
      hissFilter.frequency.setTargetAtTime(780 + p * 1350, now, 0.3);
      droneGain.gain.setTargetAtTime(0.005 + p * 0.003, now, 0.4);
    } catch (err) { /* ignore */ }
  }

  function gust() {
    if (!enabled || !unlock() || !gustGain) return;
    try {
      var now = ctx.currentTime;
      gustGain.gain.cancelScheduledValues(now);
      gustGain.gain.setValueAtTime(0.0001, now);
      gustGain.gain.linearRampToValueAtTime(0.055, now + 0.13);
      gustGain.gain.exponentialRampToValueAtTime(0.0001, now + 1.15);
    } catch (err) { /* ignore */ }
  }

  function tone(freq, duration, peak, type) {
    if (!enabled || !unlock()) return;
    try {
      var now = ctx.currentTime + 0.005;
      var osc = ctx.createOscillator();
      var gain = ctx.createGain();
      osc.type = type || 'sine';
      osc.frequency.setValueAtTime(freq, now);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.linearRampToValueAtTime(peak, now + 0.03);
      gain.gain.exponentialRampToValueAtTime(peak * 0.28, now + duration * 0.5);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
      osc.connect(gain);
      gain.connect(master);
      osc.start(now);
      osc.stop(now + duration + 0.04);
    } catch (err) { /* ignore */ }
  }

  function chime(index) {
    var note = MEMORY_NOTES[clamp(index | 0, 0, MEMORY_NOTES.length - 1)];
    tone(note, 0.9, 0.075, 'sine');
    tone(note * 2, 0.42, 0.018, 'triangle');
  }

  function listen() {
    tone(110, 1.15, 0.028, 'sine');
    tone(164.8, 0.8, 0.014, 'sine');
  }

  return {
    unlock: unlock,
    setEnabled: setEnabled,
    setWind: setWind,
    gust: gust,
    chime: chime,
    listen: listen
  };
})();
