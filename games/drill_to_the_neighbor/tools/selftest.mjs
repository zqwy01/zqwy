#!/usr/bin/env node
/*
 * Local logic checks for DRILL TO THE NEIGHBOR.
 * No browser required. Exercises the measured chart, judging windows,
 * hazard tuning and the reachability of the 65% depth goal.
 *
 *   node tools/selftest.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const require = createRequire(import.meta.url);
const Core = require(path.join(root, 'js', 'core.js'));

function loadChart() {
  const code = fs.readFileSync(path.join(root, 'js', 'chart.js'), 'utf8');
  const sandbox = { window: {} };
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox);
  return sandbox.window.DRILL_CHART;
}

let checks = 0;
let failures = 0;

function check(name, condition, detail) {
  checks++;
  if (condition) {
    console.log('  ok   ' + name);
  } else {
    failures++;
    console.log('  FAIL ' + name + (detail ? '  [' + detail + ']' : ''));
  }
}

function near(a, b, eps) {
  return Math.abs(a - b) <= (eps == null ? 1e-6 : eps);
}

const CH = loadChart();
const meta = CH.meta;
const beats = CH.beats;
const sections = CH.sections;

console.log('\nCHART');
check('meta beat count matches array', meta.beatCount === beats.length, meta.beatCount + ' vs ' + beats.length);
check('at least 200 playable beats', beats.length >= 200, String(beats.length));
check('first beat matches meta', near(beats[0].t, meta.firstBeat, 0.001));
check('last beat matches meta', near(beats[beats.length - 1].t, meta.lastBeat, 0.001));
check('beats are strictly increasing', beats.every((b, i) => i === 0 || b.t > beats[i - 1].t));
check('beats sit on the 90 BPM grid', beats.every((b, i) => i === 0 || near(b.t - beats[i - 1].t, meta.beatPeriod, 0.001)));
check('playable end after last beat', meta.playableEnd > meta.lastBeat);
check('playable end near 155 s', meta.playableEnd > 154 && meta.playableEnd < 156, String(meta.playableEnd));
check('beat index n advances by one', beats.every((b, i) => i === 0 || b.n === beats[i - 1].n + 1));
check('section list is contiguous and covers the run', sections.every((s, i) => {
  if (i === 0) return near(s.start, 0, 0.001);
  return near(s.start, sections[i - 1].end, 0.001) && s.end > s.start;
}) && near(sections[sections.length - 1].end, meta.playableEnd, 0.001));

console.log('\nJUDGEMENT');
const t0 = beats[10].t;
const exact = Core.judge(beats, t0, null, 0.085, 0.17);
check('exact beat is perfect', exact.grade === 'perfect' && exact.index === 10);
const late = Core.judge(beats, t0 + 0.12, null, 0.085, 0.17);
check('+120 ms is good', late.grade === 'good' && near(late.delta, 0.12, 0.001));
const early = Core.judge(beats, t0 - 0.12, null, 0.085, 0.17);
check('-120 ms is good', early.grade === 'good' && near(early.delta, -0.12, 0.001));
const off = Core.judge(beats, t0 + 0.3, null, 0.085, 0.17);
check('+300 ms fizzles', off.grade === 'fizzle' && off.reason === 'offbeat');
const consumed = new Uint8Array(beats.length);
consumed[10] = 1;
const taken = Core.judge(beats, t0 + 0.01, consumed, 0.085, 0.17);
check('consumed beat is guarded', taken.grade === 'fizzle' && taken.reason === 'taken');

console.log('\nSECTIONS / SPAWNS');
check('sectionAt(0) is intro', Core.sectionAt(sections, 0).section.id === 'silence');
check('sectionAt(mid) is deep', Core.sectionAt(sections, 70).section.id === 'deep');
check('sectionAt(playableEnd) is threshold', Core.sectionAt(sections, meta.playableEnd).section.id === 'threshold');

const spawnPlan = {};
for (const beat of beats) {
  const sec = Core.sectionAt(sections, beat.t).section;
  if (!spawnPlan[sec.id]) spawnPlan[sec.id] = 0;
  if (Core.shouldSpawn(beat, sec, 0)) spawnPlan[sec.id]++;
}
console.log('  spawn events (activeCount=0):', JSON.stringify(spawnPlan));
const totalSpawns = Object.values(spawnPlan).reduce((a, b) => a + b, 0);
check('there are enough hazards to matter', totalSpawns >= 30, String(totalSpawns));
check('danger ramps up in the last section', (spawnPlan.threshold || 0) > 0);
check('hazard cap is positive in every active section', Object.keys(Core.DIFFICULTY).every(id => {
  if (id === 'silence') return true;
  return Core.DIFFICULTY[id].max > 0 && Core.DIFFICULTY[id].speed > 0;
}));

let rng = Core.mulberry32(0x1234);
const speeds = [];
for (let i = 0; i < 50; i++) speeds.push(Core.hazardSpeed(i % 3 ? 'thorn' : 'stone', sections[3], rng));
check('hazard speeds stay in a readable range', speeds.every(s => s > 15 && s < 60), Math.min(...speeds).toFixed(1) + '..' + Math.max(...speeds).toFixed(1));

console.log('\nGOAL REACHABILITY');
const P = Core.PROGRESS;
const maxDepth = beats.length * P.perfect;
const allGood = beats.length * P.good;
console.log('  all-perfect strikes = ' + maxDepth.toFixed(1) + '%');
console.log('  all-good strikes    = ' + allGood.toFixed(1) + '%');
check('perfect play can fill the drill', maxDepth >= 90);
check('all-good play alone is below goal', allGood < Core.WIN_PCT);

function simulatedDepth(acc, perfectShare, hazardKills) {
  const hits = beats.length * acc;
  return hits * (perfectShare * P.perfect + (1 - perfectShare) * P.good) + hazardKills * P.hazardPerfect;
}
const strong = simulatedDepth(0.82, 0.74, Math.round(totalSpawns * 0.55));
const medium = simulatedDepth(0.70, 0.62, Math.round(totalSpawns * 0.4));
const weak = simulatedDepth(0.50, 0.55, Math.round(totalSpawns * 0.22));
console.log('  strong run          = ' + strong.toFixed(1) + '%');
console.log('  medium run          = ' + medium.toFixed(1) + '%');
console.log('  weak run            = ' + weak.toFixed(1) + '%');
check('strong run wins', strong >= Core.WIN_PCT);
check('medium run is close but can win', medium >= Core.WIN_PCT - 4 && medium <= 100);
check('weak run loses', weak < Core.WIN_PCT);

console.log('\nASSETS');
const assets = [
  'assets/drill_to_the_neighbor.mp3',
  'assets/drill_to_the_neighbor.ogg',
  'assets/fonts/Tiny5.ttf',
  'index.html', 'style.css', 'js/game.js'
];
for (const rel of assets) {
  const p = path.join(root, rel);
  const ok = fs.existsSync(p) && fs.statSync(p).size > 100;
  check(rel + ' exists', ok, ok ? String(fs.statSync(p).size) : 'missing');
}

console.log('\n' + (failures ? 'FAILED: ' + failures + ' / ' + checks : 'ALL OK: ' + checks + ' checks'));
process.exit(failures ? 1 : 0);
