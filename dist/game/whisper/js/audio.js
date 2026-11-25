/* УШКО — tiny Web Audio sound bed.
   No audio files are loaded: a looping low-passed noise layer and a slow
   breath envelope give the "close to the ear" feeling and work on iOS too.
   speechSynthesis itself cannot be routed through Web Audio in most browsers,
   so the ear choice is a game rule while this bed is panned left or right. */
window.USHKO_AUDIO = (function () {
  'use strict';

  let ctx = null;
  let bedGain = null;
  let panNode = null;
  let noiseSource = null;
  let breathTimer = 0;
  let active = false;
  let ear = 'left';

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

  function makeNoiseBuffer() {
    const length = Math.floor(ctx.sampleRate * 2);
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < length; i += 1) {
      const white = Math.random() * 2 - 1;
      last = (last + 0.02 * white) / 1.02;
      data[i] = last * 3.5;
    }
    return buffer;
  }

  function ensure() {
    if (ctx) return true;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    try {
      ctx = new AC();
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 520;
      filter.Q.value = 0.6;

      bedGain = ctx.createGain();
      bedGain.gain.value = 0.012;

      noiseSource = ctx.createBufferSource();
      noiseSource.buffer = makeNoiseBuffer();
      noiseSource.loop = true;
      noiseSource.connect(filter);
      filter.connect(bedGain);

      if (typeof ctx.createStereoPanner === 'function') {
        panNode = ctx.createStereoPanner();
        panNode.pan.value = -0.8;
        bedGain.connect(panNode);
        panNode.connect(ctx.destination);
      } else {
        bedGain.connect(ctx.destination);
      }

      noiseSource.start(0);
      return true;
    } catch (err) {
      ctx = null;
      return false;
    }
  }

  function setEar(value) {
    ear = value === 'right' ? 'right' : 'left';
    if (!ctx || !panNode) return;
    const target = ear === 'right' ? 0.82 : -0.82;
    try { panNode.pan.setTargetAtTime(target, ctx.currentTime, 0.12); } catch (err) { /* ignore */ }
  }

  function start() {
    if (!ensure()) return;
    if (ctx.state === 'suspended') {
      try { ctx.resume(); } catch (err) { /* ignore */ }
    }
    active = true;
    try {
      bedGain.gain.cancelScheduledValues(ctx.currentTime);
      bedGain.gain.setTargetAtTime(0.055, ctx.currentTime, 0.18);
    } catch (err) { /* ignore */ }
  }

  function stop() {
    active = false;
    if (!ctx || !bedGain) return;
    try {
      bedGain.gain.cancelScheduledValues(ctx.currentTime);
      bedGain.gain.setTargetAtTime(0.012, ctx.currentTime, 0.25);
    } catch (err) { /* ignore */ }
  }

  /* A single soft inhale at the start of a phrase. */
  function breath() {
    if (!ctx || !bedGain) return;
    window.clearTimeout(breathTimer);
    try {
      const source = ctx.createBufferSource();
      source.buffer = makeNoiseBuffer();
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = 900;
      filter.Q.value = 0.7;
      const gain = ctx.createGain();
      const now = ctx.currentTime;
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.05, now + 0.09);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.42);
      source.connect(filter);
      filter.connect(gain);
      if (panNode) gain.connect(panNode); else gain.connect(ctx.destination);
      source.start(now, 0, 0.45);
      source.stop(now + 0.46);
    } catch (err) { /* ignore */ }
  }

  return {
    unlock: ensure,
    start: start,
    stop: stop,
    setEar: setEar,
    breath: breath,
    get ready() { return !!ctx; },
    get active() { return active; }
  };
})();
