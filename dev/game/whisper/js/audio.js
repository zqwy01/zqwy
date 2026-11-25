/* УШКО — layered, reactive Web Audio sound bed.
   No audio files: a low room tone, slow breathing, a warm beating pad, a purr
   that grows with calmness, soft inhales, tiny note/rustle grains on word
   boundaries and a small bell on victory. speechSynthesis cannot be routed
   through Web Audio in most browsers, so everything procedural here is panned
   to the chosen ear. Only oscillators and generated noise buffers: iOS-safe. */
window.USHKO_AUDIO = (function () {
  'use strict';

  let ctx = null;
  let bedGain = null;
  let bedFilter = null;
  let panNode = null;
  let lfo = null;
  let lfoGain = null;
  let filterLfo = null;
  let filterLfoGain = null;
  let padGain = null;
  let padFriend = null;
  let purrGain = null;
  let active = false;
  let ear = 'left';
  let lastWord = 0;
  let lastMood = 0;
  let wordStep = 0;
  let whiteCache = null;
  let brownCache = null;

  const NOTES = [392, 440, 523.25, 587.33, 659.25, 783.99];

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

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

      if (typeof ctx.createStereoPanner === 'function') {
        panNode = ctx.createStereoPanner();
        panNode.pan.value = -0.82;
        panNode.connect(ctx.destination);
      }

      /* Room tone: brown noise through a slowly wandering low-pass filter. */
      bedGain = ctx.createGain();
      bedGain.gain.value = 0.012;
      bedFilter = ctx.createBiquadFilter();
      bedFilter.type = 'lowpass';
      bedFilter.frequency.value = 470;
      bedFilter.Q.value = 0.7;
      const bedSource = ctx.createBufferSource();
      bedSource.buffer = noise('brown');
      bedSource.loop = true;
      bedSource.connect(bedFilter);
      bedFilter.connect(bedGain);
      toPan(bedGain);

      /* A barely audible airy layer keeps the room from sounding synthetic. */
      const roomFilter = ctx.createBiquadFilter();
      roomFilter.type = 'highpass';
      roomFilter.frequency.value = 1500;
      const roomGain = ctx.createGain();
      roomGain.gain.value = 0.2;
      const roomSource = ctx.createBufferSource();
      roomSource.buffer = noise('white');
      roomSource.loop = true;
      roomSource.connect(roomFilter);
      roomFilter.connect(roomGain);
      roomGain.connect(bedGain);

      /* Two almost-equal sine waves beat gently, like a voice just out of reach. */
      padGain = ctx.createGain();
      padGain.gain.value = 0.004;
      const padFilter = ctx.createBiquadFilter();
      padFilter.type = 'lowpass';
      padFilter.frequency.value = 820;
      const padOsc = ctx.createOscillator();
      padOsc.type = 'sine';
      padOsc.frequency.value = 174;
      padFriend = ctx.createOscillator();
      padFriend.type = 'sine';
      padFriend.frequency.value = 175.5;
      padOsc.connect(padFilter);
      padFriend.connect(padFilter);
      padFilter.connect(padGain);
      toPan(padGain);

      /* A very quiet purr appears as Ушко calms down. */
      purrGain = ctx.createGain();
      purrGain.gain.value = 0;
      const purrFilter = ctx.createBiquadFilter();
      purrFilter.type = 'lowpass';
      purrFilter.frequency.value = 170;
      const purrOsc = ctx.createOscillator();
      purrOsc.type = 'sine';
      purrOsc.frequency.value = 58;
      purrOsc.connect(purrFilter);
      purrFilter.connect(purrGain);
      toPan(purrGain);
      const purrLfo = ctx.createOscillator();
      purrLfo.type = 'sine';
      purrLfo.frequency.value = 17;
      const purrLfoGain = ctx.createGain();
      purrLfoGain.gain.value = 0.0025;
      purrLfo.connect(purrLfoGain);
      purrLfoGain.connect(purrGain.gain);

      /* Slow amplitude and filter swells: someone breathing next to your ear. */
      lfo = ctx.createOscillator();
      lfo.type = 'sine';
      lfo.frequency.value = 0.14;
      lfoGain = ctx.createGain();
      lfoGain.gain.value = 0.006;
      lfo.connect(lfoGain);
      lfoGain.connect(bedGain.gain);
      filterLfo = ctx.createOscillator();
      filterLfo.type = 'sine';
      filterLfo.frequency.value = 0.07;
      filterLfoGain = ctx.createGain();
      filterLfoGain.gain.value = 70;
      filterLfo.connect(filterLfoGain);
      filterLfoGain.connect(bedFilter.frequency);

      bedSource.start(0);
      roomSource.start(0);
      padOsc.start(0);
      padFriend.start(0);
      purrOsc.start(0);
      purrLfo.start(0);
      lfo.start(0);
      filterLfo.start(0);
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
      const now = ctx.currentTime;
      bedGain.gain.cancelScheduledValues(now);
      bedGain.gain.setTargetAtTime(0.05, now, 0.18);
      padGain.gain.setTargetAtTime(0.009, now, 0.25);
    } catch (err) { /* ignore */ }
  }

  function stop() {
    active = false;
    if (!ctx || !bedGain) return;
    try {
      const now = ctx.currentTime;
      bedGain.gain.cancelScheduledValues(now);
      bedGain.gain.setTargetAtTime(0.012, now, 0.25);
      padGain.gain.setTargetAtTime(0.004, now, 0.3);
      purrGain.gain.setTargetAtTime(0, now, 0.3);
    } catch (err) { /* ignore */ }
  }

  /* The bed follows the game: warmer and purrier as Ушко calms, thinner when
     it gets scared. Throttled so the game loop can call it every frame. */
  function setMood(calm, fear) {
    if (!ctx || !bedFilter || !padGain || !purrGain) return;
    const now = ctx.currentTime;
    if (now - lastMood < 0.12) return;
    lastMood = now;
    const c = clamp(Number(calm) / 100 || 0, 0, 1);
    const f = clamp(Number(fear) / 100 || 0, 0, 1);
    try {
      bedFilter.frequency.setTargetAtTime(430 + c * 150 - f * 130, now, 0.5);
      padGain.gain.setTargetAtTime(active ? 0.006 + c * 0.006 : 0.004, now, 0.5);
      purrGain.gain.setTargetAtTime(active ? c * c * 0.01 : 0, now, 0.4);
      if (padFriend) padFriend.frequency.setTargetAtTime(175.5 + f * 7, now, 0.5);
    } catch (err) { /* ignore */ }
  }

  /* A soft two-stage inhale with a small warm hum before each phrase. */
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
      gain.gain.exponentialRampToValueAtTime(0.03, now + 0.08);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.42);
      source.connect(filter);
      filter.connect(gain);
      toPan(gain);
      source.start(now, Math.random(), 0.45);
      source.stop(now + 0.46);

      const tail = ctx.createBufferSource();
      tail.buffer = noise('brown');
      const tailFilter = ctx.createBiquadFilter();
      tailFilter.type = 'bandpass';
      tailFilter.frequency.value = 380;
      tailFilter.Q.value = 1.1;
      const tailGain = ctx.createGain();
      tailGain.gain.setValueAtTime(0.0001, now + 0.18);
      tailGain.gain.exponentialRampToValueAtTime(0.014, now + 0.26);
      tailGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.62);
      tail.connect(tailFilter);
      tailFilter.connect(tailGain);
      toPan(tailGain);
      tail.start(now + 0.16, Math.random(), 0.5);
      tail.stop(now + 0.64);

      [135, 202.5].forEach((freq, i) => {
        const hum = ctx.createOscillator();
        hum.type = 'sine';
        hum.frequency.value = freq;
        const humGain = ctx.createGain();
        humGain.gain.setValueAtTime(0.0001, now);
        humGain.gain.exponentialRampToValueAtTime(i ? 0.003 : 0.006, now + 0.09);
        humGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.38);
        hum.connect(humGain);
        toPan(humGain);
        hum.start(now);
        hum.stop(now + 0.4);
      });
    } catch (err) { /* ignore */ }
  }

  /* A tiny pentatonic bell plus an occasional breathy "с" on word boundaries. */
  function word() {
    if (!ctx) return;
    const now = ctx.currentTime;
    if (now - lastWord < 0.11) return;
    lastWord = now;
    const note = NOTES[wordStep % NOTES.length];
    wordStep += 1;
    try {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = note;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);
      osc.connect(gain);
      toPan(gain);
      osc.start(now);
      osc.stop(now + 0.13);

      const overtone = ctx.createOscillator();
      overtone.type = 'triangle';
      overtone.frequency.value = note * 2;
      const overGain = ctx.createGain();
      overGain.gain.setValueAtTime(0.0001, now);
      overGain.gain.exponentialRampToValueAtTime(0.0025, now + 0.006);
      overGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.07);
      overtone.connect(overGain);
      toPan(overGain);
      overtone.start(now);
      overtone.stop(now + 0.08);

      if (Math.random() < 0.55) {
        const air = ctx.createBufferSource();
        air.buffer = noise('white');
        const airFilter = ctx.createBiquadFilter();
        airFilter.type = 'highpass';
        airFilter.frequency.value = 2600;
        const airGain = ctx.createGain();
        airGain.gain.setValueAtTime(0.0001, now);
        airGain.gain.exponentialRampToValueAtTime(0.005, now + 0.01);
        airGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.09);
        air.connect(airFilter);
        airFilter.connect(airGain);
        toPan(airGain);
        air.start(now, Math.random(), 0.1);
        air.stop(now + 0.1);
      }
    } catch (err) { /* ignore */ }
  }

  /* Four soft notes when Ушко finally falls asleep. */
  function chime() {
    if (!ctx) return;
    const now = ctx.currentTime;
    [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => {
      try {
        const at = now + i * 0.14;
        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.value = freq;
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.0001, at);
        gain.gain.exponentialRampToValueAtTime(0.016 / (1 + i * 0.25), at + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, at + 1.1);
        osc.connect(gain);
        toPan(gain);
        osc.start(at);
        osc.stop(at + 1.12);
      } catch (err) { /* ignore */ }
    });
  }

  return {
    unlock: ensure,
    start: start,
    stop: stop,
    setEar: setEar,
    setMood: setMood,
    breath: breath,
    word: word,
    chime: chime,
    get ready() { return !!ctx; },
    get active() { return active; }
  };
})();
