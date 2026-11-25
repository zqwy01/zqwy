/* УШКО — layered Web Audio sound bed.
   No audio files are loaded: a low room tone, a slow breathing LFO, a soft
   inhale before each phrase, tiny word ticks and a quiet bell on victory.
   speechSynthesis cannot be routed through Web Audio in most browsers, so the
   ear choice is a game rule while everything procedural here is panned to the
   chosen ear. iOS is supported: only oscillators and generated noise buffers. */
window.USHKO_AUDIO = (function () {
  'use strict';

  let ctx = null;
  let bedGain = null;
  let panNode = null;
  let lfo = null;
  let lfoGain = null;
  let active = false;
  let ear = 'left';
  let lastWord = 0;
  let whiteCache = null;
  let brownCache = null;

  function makeNoiseBuffer(kind) {
    const length = Math.floor(ctx.sampleRate * 2);
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < length; i += 1) {
      const white = Math.random() * 2 - 1;
      if (kind === 'brown') {
        last = (last + 0.02 * white) / 1.02;
        data[i] = last * 3.5;
      } else {
        data[i] = white * 0.55;
      }
    }
    return buffer;
  }

  function noise(kind) {
    if (kind === 'brown') {
      if (!brownCache) brownCache = makeNoiseBuffer('brown');
      return brownCache;
    }
    if (!whiteCache) whiteCache = makeNoiseBuffer('white');
    return whiteCache;
  }

  function toPan(node) {
    if (panNode) node.connect(panNode);
    else node.connect(ctx.destination);
  }

  function ensure() {
    if (ctx) return true;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    try {
      ctx = new AC();

      bedGain = ctx.createGain();
      bedGain.gain.value = 0.012;

      const bedFilter = ctx.createBiquadFilter();
      bedFilter.type = 'lowpass';
      bedFilter.frequency.value = 470;
      bedFilter.Q.value = 0.7;

      const bedSource = ctx.createBufferSource();
      bedSource.buffer = noise('brown');
      bedSource.loop = true;
      bedSource.connect(bedFilter);
      bedFilter.connect(bedGain);

      /* A barely audible airy layer makes the first one feel less synthetic. */
      const roomFilter = ctx.createBiquadFilter();
      roomFilter.type = 'highpass';
      roomFilter.frequency.value = 1500;
      const roomGain = ctx.createGain();
      roomGain.gain.value = 0.22;
      const roomSource = ctx.createBufferSource();
      roomSource.buffer = noise('white');
      roomSource.loop = true;
      roomSource.connect(roomFilter);
      roomFilter.connect(roomGain);
      roomGain.connect(bedGain);

      /* Slow swell, as if someone is breathing next to your ear. */
      lfo = ctx.createOscillator();
      lfo.type = 'sine';
      lfo.frequency.value = 0.14;
      lfoGain = ctx.createGain();
      lfoGain.gain.value = 0.006;
      lfo.connect(lfoGain);
      lfoGain.connect(bedGain.gain);

      if (typeof ctx.createStereoPanner === 'function') {
        panNode = ctx.createStereoPanner();
        panNode.pan.value = -0.82;
        bedGain.connect(panNode);
        panNode.connect(ctx.destination);
      } else {
        bedGain.connect(ctx.destination);
      }

      bedSource.start(0);
      roomSource.start(0);
      lfo.start(0);
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
      bedGain.gain.setTargetAtTime(0.05, ctx.currentTime, 0.18);
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

  /* A soft inhale with a small warm hum at the start of a phrase. */
  function breath() {
    if (!ctx) return;
    try {
      const now = ctx.currentTime;
      const source = ctx.createBufferSource();
      source.buffer = noise('white');
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.Q.value = 0.8;
      filter.frequency.setValueAtTime(620, now);
      filter.frequency.exponentialRampToValueAtTime(1250, now + 0.12);
      filter.frequency.exponentialRampToValueAtTime(760, now + 0.4);
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.032, now + 0.08);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.42);
      source.connect(filter);
      filter.connect(gain);
      toPan(gain);
      source.start(now, Math.random(), 0.45);
      source.stop(now + 0.46);

      const hum = ctx.createOscillator();
      hum.type = 'sine';
      hum.frequency.value = 135;
      const humGain = ctx.createGain();
      humGain.gain.setValueAtTime(0.0001, now);
      humGain.gain.exponentialRampToValueAtTime(0.006, now + 0.09);
      humGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.38);
      hum.connect(humGain);
      toPan(humGain);
      hum.start(now);
      hum.stop(now + 0.4);
    } catch (err) { /* ignore */ }
  }

  /* Tiny bell-like tick on a word boundary; deliberately quiet. */
  function word() {
    if (!ctx) return;
    const now = ctx.currentTime;
    if (now - lastWord < 0.12) return;
    lastWord = now;
    try {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = 420 + Math.random() * 120;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.011, now + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.1);
      osc.connect(gain);
      toPan(gain);
      osc.start(now);
      osc.stop(now + 0.11);
    } catch (err) { /* ignore */ }
  }

  /* Two soft notes when Ushko finally falls asleep. */
  function chime() {
    if (!ctx) return;
    const now = ctx.currentTime;
    [660, 990].forEach((freq, i) => {
      try {
        const at = now + i * 0.13;
        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.value = freq;
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.0001, at);
        gain.gain.exponentialRampToValueAtTime(0.018, at + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.9);
        osc.connect(gain);
        toPan(gain);
        osc.start(at);
        osc.stop(at + 0.92);
      } catch (err) { /* ignore */ }
    });
  }

  return {
    unlock: ensure,
    start: start,
    stop: stop,
    setEar: setEar,
    breath: breath,
    word: word,
    chime: chime,
    get ready() { return !!ctx; },
    get active() { return active; }
  };
})();
