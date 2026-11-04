/* Small pure helpers shared by the game and the self-test. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.DrillCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const TAU = Math.PI * 2;
  const WIN_PCT = 65;

  // Gameplay tuning. Kept here so tools/selftest.mjs can exercise it.
  const DIFFICULTY = {
    silence:   { every: 0, speed: 0,  max: 0,  spawnFrom: 999 },
    wake:      { every: 8, speed: 27, max: 5,  spawnFrom: 13.0 },
    tide:      { every: 4, speed: 35, max: 7,  spawnFrom: 37.0 },
    deep:      { every: 6, speed: 33, max: 7,  spawnFrom: 45.0 },
    heart:     { every: 3, speed: 43, max: 9,  spawnFrom: 108.5 },
    road:      { every: 5, speed: 37, max: 8,  spawnFrom: 113.0 },
    threshold: { every: 3, speed: 46, max: 10, spawnFrom: 148.5 }
  };

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function dist(ax, ay, bx, by) { return Math.hypot(ax - bx, ay - by); }
  function dist2(ax, ay, bx, by) { const dx = ax - bx, dy = ay - by; return dx * dx + dy * dy; }
  function angleTo(ax, ay, bx, by) { return Math.atan2(by - ay, bx - ax); }

  function formatTime(seconds) {
    if (!Number.isFinite(seconds) || seconds < 0) seconds = 0;
    const s = Math.floor(seconds);
    return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
  }

  function sectionAt(sections, t) {
    if (!sections || !sections.length) return { index: 0, section: null };
    const last = sections.length - 1;
    if (t < sections[0].start) return { index: 0, section: sections[0] };
    for (let i = 0; i < sections.length; i++) {
      if (t < sections[i].end || i === last) return { index: i, section: sections[i] };
    }
    return { index: last, section: sections[last] };
  }

  // First beat whose time is >= t (or the last beat).
  function lowerBoundBeat(beats, t) {
    let lo = 0, hi = beats.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (beats[mid].t < t) lo = mid + 1;
      else hi = mid;
    }
    return lo;
  }

  function nearestBeat(beats, t) {
    if (!beats.length) return null;
    const i = lowerBoundBeat(beats, t);
    const candidates = [];
    if (i < beats.length) candidates.push(i);
    if (i > 0) candidates.push(i - 1);
    let best = candidates[0];
    for (const c of candidates) {
      if (Math.abs(beats[c].t - t) < Math.abs(beats[best].t - t)) best = c;
    }
    return { index: best, beat: beats[best], delta: t - beats[best].t };
  }

  function judge(beats, t, consumed, perfectWindow, goodWindow) {
    perfectWindow = perfectWindow == null ? 0.09 : perfectWindow;
    goodWindow = goodWindow == null ? 0.17 : goodWindow;
    const found = nearestBeat(beats, t);
    if (!found) return { grade: 'fizzle', reason: 'empty', index: -1, delta: 0, beat: null };
    const taken = !!(consumed && consumed[found.index]);
    if (taken) return { grade: 'fizzle', reason: 'taken', index: found.index, delta: found.delta, beat: found.beat };
    if (Math.abs(found.delta) > goodWindow) {
      return { grade: 'fizzle', reason: 'offbeat', index: found.index, delta: found.delta, beat: found.beat };
    }
    return {
      grade: Math.abs(found.delta) <= perfectWindow ? 'perfect' : 'good',
      reason: 'hit',
      index: found.index,
      delta: found.delta,
      beat: found.beat
    };
  }

  function shouldSpawn(beat, section, activeCount) {
    const diff = section && DIFFICULTY[section.id];
    if (!diff || diff.every <= 0 || activeCount >= diff.max) return false;
    if (beat.t < diff.spawnFrom) return false;
    return beat.n % diff.every === 0;
  }

  function hazardKind(beat, section, spawnCount) {
    if (!beat || !section) return 'thorn';
    const hot = section.id === 'heart' || section.id === 'threshold' || section.id === 'tide';
    if (hot && spawnCount % 4 === 3) return 'stone';
    if (beat.strong && spawnCount % 6 === 5) return 'stone';
    return 'thorn';
  }

  function hazardSpeed(kind, section, rng) {
    const diff = section && DIFFICULTY[section.id];
    let base = diff ? diff.speed : 30;
    const jitter = 0.9 + (rng ? rng() : 0.5) * 0.22;
    if (kind === 'stone') base *= 0.68;
    return base * jitter;
  }

  // Deterministic PRNG (mulberry32) so a run can be replayed in the self-test.
  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function hash32(n) {
    let x = (n | 0) + 0x9e3779b9;
    x = Math.imul(x ^ (x >>> 16), 0x85ebca6b);
    x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35);
    return (x ^ (x >>> 16)) >>> 0;
  }

  // Pick a spawn point on the rim, preferring directions away from the player.
  function chooseSpawnAngle(player, rng, radius) {
    let best = 0, bestScore = -Infinity;
    for (let i = 0; i < 7; i++) {
      const a = rng ? rng() * TAU : (i / 7) * TAU;
      const x = 200 + Math.cos(a) * (radius || 186);
      const y = 200 + Math.sin(a) * (radius || 186);
      const score = player ? dist2(x, y, player.x, player.y) : 0;
      const jitter = (rng ? rng() : 0.5) * 400;
      if (score + jitter > bestScore) { bestScore = score + jitter; best = a; }
    }
    return best;
  }

  function comboMultiplier(combo) {
    return 1 + Math.min(4, Math.floor(combo / 8));
  }

  return {
    TAU, WIN_PCT, DIFFICULTY,
    clamp, lerp, dist, dist2, angleTo, formatTime,
    sectionAt, lowerBoundBeat, nearestBeat, judge, shouldSpawn,
    hazardKind, hazardSpeed, mulberry32, hash32, chooseSpawnAngle,
    comboMultiplier
  };
});
