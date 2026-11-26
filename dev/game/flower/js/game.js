/* Цветочек — маленькая игрушка (◕ᴗ◕✿). Каомодзи здесь не подпись, а живой
 * персонаж: оно моргает, улыбается, сердится и выпускает аромат.
 * Никаких таймеров и проигрышей: лепестки падают сами, цветочек можно
 * гладить, греть солнышком, поливать, нюхать и дразнить. Садик меняет свет
 * по времени суток. Всё живёт в текущей вкладке.
 */
(function () {
  'use strict';

  var garden = document.getElementById('garden');
  var canvas = document.getElementById('sky');
  var ctx = canvas.getContext('2d');

  var flowerBtn = document.getElementById('flowerBtn');
  var flowerHint = document.getElementById('flowerHint');
  var daypartEl = document.getElementById('daypart');
  var sunBtn = document.getElementById('sunBtn');
  var canBtn = document.getElementById('canBtn');
  var bubble = document.getElementById('bubble');
  var gardenFlowers = document.getElementById('gardenFlowers');

  var joyFill = document.getElementById('joyFill');
  var joyValue = document.getElementById('joyValue');
  var sunFill = document.getElementById('sunFill');
  var sunValue = document.getElementById('sunValue');
  var scentFill = document.getElementById('scentFill');
  var scentValue = document.getElementById('scentValue');
  var moodText = document.getElementById('moodText');
  var petCountEl = document.getElementById('petCount');
  var petalCountEl = document.getElementById('petalCount');
  var bloomCountEl = document.getElementById('bloomCount');
  var smellCountEl = document.getElementById('smellCount');

  var patBtn = document.getElementById('patBtn');
  var sunControlBtn = document.getElementById('sunControlBtn');
  var waterControlBtn = document.getElementById('waterControlBtn');
  var smellBtn = document.getElementById('smellBtn');
  var teaseBtn = document.getElementById('teaseBtn');
  var danceBtn = document.getElementById('danceBtn');
  var soundBtn = document.getElementById('soundBtn');
  var soundLabel = document.getElementById('soundLabel');
  var resetBtn = document.getElementById('resetBtn');

  var PHRASES = [
    'Привет! Я цветочек (◕ᴗ◕✿)',
    'Мне так тепло…',
    'Смотри, ещё лепесток!',
    'Давай посидим здесь.',
    'Ты меня гладил? Я заметил!',
    'У тебя добрые руки.',
    'Хороший день для цветка.',
    'Расти-расти, садик!'
  ];
  var PAT_PHRASES = ['хихи!', 'ещё чуть-чуть', 'мне щекотно', '♡', 'я улыбаюсь', 'спасибо!'];
  var SUN_PHRASES = ['Солнышко, иди сюда!', 'Тепло…', 'Лучик поймали!', 'Давай греться.'];
  var WATER_PHRASES = ['Кап-кап — спасибо!', 'Я пью!', 'Свеженько…', 'Листочки радуются.'];
  var CATCH_PHRASES = ['Лепесток мой!', 'Ещё один в садик!', '✿', 'Поймал!', 'Спасибо, ветерок!'];
  var SMELL_PHRASES = ['Ах, пахнет летом…', 'Нюхай — я пахну цветами!', 'Запах лепестков — это я.', 'Тепло и душисто.', 'Вдохни… и улыбнись.'];
  var TEASE_PHRASES = ['Не дёргай меня!', 'Ну всё, хватит!', 'Я злюсь, видишь?', 'Фу! Я ещё не расцвела!', 'Ой, щекотно — злюсь!'];
  var DANCE_PHRASES = ['Смотри, я танцую! (◕ᴗ◕✿)', 'Раз-два, лепесток!', 'Это мой танец цветения.', 'Покачаемся вместе!', '♪ Танцуй, садик, танцуй!'];
  var CALM_PHRASES = ['Ладно, помирились (◕ᴗ◕✿)', 'Фух… снова пахну.', 'Давай посидим тихо.'];
  var DANCE_NOTES = [523, 659, 784, 659, 587, 784, 880, 784];
  var PETAL_COLORS = ['#ffc6d3', '#f9a8bd', '#ffe0c8', '#ffd1dc'];

  var state = {
    joy: 8,
    sun: 65,
    aroma: 0,
    grumpy: 0,
    dance: 0,
    danceBeat: 0,
    beatIndex: 0,
    smells: 0,
    petStreak: 0,
    lastPetAt: 0,
    pets: 0,
    petals: 0,
    blooms: 0,
    sleeping: false,
    sound: true
  };

  var petals = [];
  var sparks = [];
  var scents = [];
  var drops = [];
  var W = 1, H = 1, dpr = 1;
  var lastFrame = 0, uiTick = 0, spawnTimer = 1.4, waterCooldown = 0, idleTimer = 16;
  var scentTimer = 3.2, daypartTimer = 0, lastDaypart = '';
  var bubbleTimer = null;
  var audioCtx = null, audioBus = null, audioVoices = [], lastChimeAt = 0;

  function rnd(a, b) { return a + Math.random() * (b - a); }
  function pick(list) { return list[(Math.random() * list.length) | 0]; }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

  /* ── звук: мягкий колокольчик без внешних файлов ─────────────────
   * Раньше быстрые клики складывали несколько голосов и давали «пук»/хрип.
   * Теперь у звука есть общий фильтр, компрессор, плавная атака и лимит голосов.
   */

  function initAudio() {
    if (audioCtx) return true;
    var Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return false;
    audioCtx = new Ctx();
    var filter = audioCtx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 2400;
    filter.Q.value = 0.4;
    var comp = audioCtx.createDynamicsCompressor();
    comp.threshold.value = -24;
    comp.knee.value = 18;
    comp.ratio.value = 6;
    comp.attack.value = 0.004;
    comp.release.value = 0.18;
    var master = audioCtx.createGain();
    master.gain.value = 0.48;
    filter.connect(comp);
    comp.connect(master);
    master.connect(audioCtx.destination);
    audioBus = filter;
    return true;
  }

  function chime(freq, duration, soft) {
    if (!state.sound) return;
    try {
      if (!initAudio()) return;
      if (audioCtx.state === 'suspended') audioCtx.resume();
      var nowMs = performance.now();
      if (nowMs - lastChimeAt < 45) return; // анти-дребезг при частых кликах
      lastChimeAt = nowMs;

      while (audioVoices.length >= 4) {
        var old = audioVoices.shift();
        try {
          old.gain.gain.cancelScheduledValues(audioCtx.currentTime);
          old.gain.gain.setTargetAtTime(0.0001, audioCtx.currentTime, 0.01);
          old.osc.stop(audioCtx.currentTime + 0.05);
        } catch (e) { /* голос уже закончился */ }
      }

      var now = audioCtx.currentTime + 0.005;
      var len = Math.max(0.12, Math.min(duration || 0.28, 0.6));
      var peak = soft ? 0.032 : 0.05;
      var osc = audioCtx.createOscillator();
      var gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.linearRampToValueAtTime(peak, now + 0.035);
      gain.gain.exponentialRampToValueAtTime(peak * 0.35, now + len * 0.45);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + len);
      osc.connect(gain);
      gain.connect(audioBus);
      osc.start(now);
      osc.stop(now + len + 0.03);
      var voice = { osc: osc, gain: gain };
      audioVoices.push(voice);
      osc.onended = function () {
        var i = audioVoices.indexOf(voice);
        if (i >= 0) audioVoices.splice(i, 1);
        try { gain.disconnect(); } catch (e) { /* уже отключён */ }
      };
    } catch (e) { /* без звука игра тоже работает */ }
  }

  /* ── садик, лепестки и искры ────────────────────────────────────── */

  function resize() {
    var rect = garden.getBoundingClientRect();
    var newW = Math.max(1, rect.width);
    var newH = Math.max(1, rect.height);
    var sx = W > 1 ? newW / W : 1;
    var sy = H > 1 ? newH / H : 1;
    W = newW;
    H = newH;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    for (var i = 0; i < petals.length; i++) {
      petals[i].x *= sx;
      petals[i].y *= sy;
    }
    for (var j = 0; j < sparks.length; j++) {
      sparks[j].x *= sx;
      sparks[j].y *= sy;
    }
    for (var k = 0; k < scents.length; k++) {
      scents[k].x *= sx;
      scents[k].y *= sy;
    }
    for (var d = 0; d < drops.length; d++) {
      drops[d].x0 *= sx;
      drops[d].x1 *= sx;
      drops[d].y0 *= sy;
      drops[d].y1 *= sy;
    }
    placeCan();
  }

  /* Держим носник лейки чуть выше чашечки. Считаем от реального положения
   * цветка, поэтому струя попадает и в 16×9, и в 9×16, и при любом размере. */
  function placeCan() {
    var g = garden.getBoundingClientRect();
    var head = flowerBtn.querySelector('.flower-svg') || flowerBtn;
    var headRect = head.getBoundingClientRect();
    var headFromBottom = g.bottom - (headRect.top + headRect.height * 0.4);
    var canH = canBtn.offsetHeight || canBtn.getBoundingClientRect().height;
    var tipOffset = canH * 0.37; // носник в SVG находится примерно на 37% высоты
    var gap = clamp(W * 0.035, 22, 38);
    var bottom = clamp(headFromBottom - canH + tipOffset + gap, 24, g.height * 0.72);
    canBtn.style.bottom = bottom.toFixed(1) + 'px';
  }

  function spawnPetal(x, y) {
    if (petals.length >= 14) return;
    petals.push({
      x: typeof x === 'number' ? x : rnd(24, W - 24),
      y: typeof y === 'number' ? y : -22,
      baseY: typeof y === 'number' ? y : -22,
      r: rnd(10, 17),
      vy: rnd(17, 36),
      sway: rnd(10, 30),
      phase: rnd(0, 6.28),
      rot: rnd(0, 6.28),
      vr: rnd(-0.9, 0.9),
      color: pick(PETAL_COLORS)
    });
  }

  function burst(x, y, kind, count) {
    var texts = kind === 'heart' ? ['♡', '♥'] : kind === 'drop' ? ['·', '∘', '◦'] : ['✦', '✧', '✿'];
    var colors = kind === 'heart' ? ['#ec7d9c', '#f7a9bc'] : kind === 'drop' ? ['#86c6df', '#a8dbeb'] : ['#eab768', '#f4c96f', '#ef9fb5'];
    for (var i = 0; i < count; i++) {
      var life = rnd(0.7, 1.35);
      sparks.push({
        x: x + rnd(-16, 16),
        y: y + rnd(-12, 12),
        vx: rnd(-25, 25),
        vy: kind === 'drop' ? rnd(22, 48) : rnd(-52, -18),
        life: life,
        maxLife: life,
        text: pick(texts),
        color: pick(colors),
        size: rnd(13, 24)
      });
    }
  }

  /* Аромат — видимый: лёгкие значки поднимаются от чашечки и тают. */
  function spawnScent(x, y, count, angry) {
    var glyphs = angry ? ['≋', '!', '☁'] : ['≈', '✿', '♡', '·'];
    var colors = angry ? ['#d18a8a', '#b56d6d', '#e3a4a4'] : ['#ef9fb5', '#f4c96f', '#f7b6c9'];
    for (var i = 0; i < count; i++) {
      var life = rnd(1.4, 2.6);
      scents.push({
        x: x + rnd(-24, 24),
        y: y + rnd(-12, 12),
        vx: rnd(-13, 13),
        vy: angry ? rnd(-40, -18) : rnd(-34, -14),
        phase: rnd(0, 6.28),
        life: life,
        maxLife: life,
        text: pick(glyphs),
        color: pick(colors),
        size: rnd(12, 22)
      });
    }
    if (scents.length > 40) scents.splice(0, scents.length - 40);
  }

  function centerIn(element) {
    var r = element.getBoundingClientRect();
    var g = garden.getBoundingClientRect();
    return { x: r.left + r.width / 2 - g.left, y: r.top + r.height / 2 - g.top };
  }

  /* Капли берут старт у настоящего носника лейки и летят по дуге в чашечку.
   * Координаты считаются от SVG-элементов, поэтому попадание сохраняется и
   * в 16×9, и в 9×16, и после изменения размера окна. */
  function pourDrops() {
    var tip = canBtn.querySelector('.can-spout-tip') || canBtn;
    var head = flowerBtn.querySelector('.flower-svg') || flowerBtn;
    var start = centerIn(tip);
    var headRect = head.getBoundingClientRect();
    var gRect = garden.getBoundingClientRect();
    var targetX = headRect.left - gRect.left + headRect.width / 2;
    var targetY = headRect.top - gRect.top + headRect.height * 0.38;
    var colors = ['#8cc9e2', '#a8dbeb', '#c7ecf5'];
    for (var i = 0; i < 16; i++) {
      drops.push({
        x0: start.x + rnd(-3, 3),
        y0: start.y + rnd(-2, 2),
        x1: targetX + rnd(-24, 24),
        y1: targetY + rnd(-10, 10),
        delay: i * 0.032,
        t: 0,
        dur: rnd(0.4, 0.56),
        arc: rnd(8, 26),
        r: rnd(2.4, 4.1),
        color: pick(colors)
      });
    }
    if (drops.length > 60) drops.splice(0, drops.length - 60);
  }

  function draw(t) {
    ctx.clearRect(0, 0, W, H);

    for (var i = petals.length - 1; i >= 0; i--) {
      var p = petals[i];
      var px = p.x + Math.sin(t * 1.15 + p.phase) * p.sway;
      ctx.save();
      ctx.translate(px, p.y);
      ctx.rotate(p.rot);
      ctx.globalAlpha = 0.9;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.ellipse(0, 0, p.r * 0.62, p.r, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 0.45;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.4;
      ctx.stroke();
      ctx.restore();
    }

    for (var d = drops.length - 1; d >= 0; d--) {
      var drop = drops[d];
      if (drop.delay > 0) continue;
      var u = clamp(drop.t / drop.dur, 0, 1);
      var dx = drop.x0 + (drop.x1 - drop.x0) * u;
      var dy = drop.y0 + (drop.y1 - drop.y0) * u - drop.arc * Math.sin(Math.PI * u);
      ctx.save();
      ctx.globalAlpha = u > 0.85 ? (1 - u) / 0.15 * 0.9 : 0.9;
      ctx.fillStyle = drop.color;
      ctx.beginPath();
      ctx.ellipse(dx, dy, drop.r * 0.72, drop.r * 1.2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    for (var k = scents.length - 1; k >= 0; k--) {
      var a = scents[k];
      ctx.save();
      ctx.globalAlpha = clamp(a.life / a.maxLife, 0, 1) * 0.72;
      ctx.fillStyle = a.color;
      ctx.font = '600 ' + a.size.toFixed(0) + 'px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(a.text, a.x + Math.sin(t * 1.6 + a.phase) * 7, a.y);
      ctx.restore();
    }

    for (var j = sparks.length - 1; j >= 0; j--) {
      var s = sparks[j];
      ctx.save();
      ctx.globalAlpha = clamp(s.life / s.maxLife, 0, 1);
      ctx.fillStyle = s.color;
      ctx.font = '700 ' + s.size.toFixed(0) + 'px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(s.text, s.x, s.y);
      ctx.restore();
    }
  }

  /* ── состояние ──────────────────────────────────────────────────── */

  function say(text) {
    bubble.textContent = text;
    bubble.classList.add('is-visible');
    if (bubbleTimer) window.clearTimeout(bubbleTimer);
    bubbleTimer = window.setTimeout(function () {
      bubble.classList.remove('is-visible');
    }, 2600);
  }

  function paintGarden() {
    gardenFlowers.textContent = '';
    var rotations = [-9, 7, -6, 9];
    for (var i = 0; i < state.blooms; i++) {
      var flower = document.createElement('span');
      flower.className = 'mini-flower mf' + (i + 1);
      flower.style.setProperty('--r', rotations[i] + 'deg');
      flower.textContent = '✿';
      gardenFlowers.appendChild(flower);
    }
  }

  function syncBlooms() {
    var target = state.sleeping ? 4 : Math.min(4, Math.floor(state.joy / 25));
    if (target !== state.blooms) {
      state.blooms = target;
      paintGarden();
    }
  }

  function updateUI() {
    joyFill.style.width = state.joy.toFixed(1) + '%';
    joyValue.textContent = Math.round(state.joy) + '%';
    sunFill.style.width = state.sun.toFixed(1) + '%';
    sunValue.textContent = Math.round(state.sun) + '%';
    scentFill.style.width = state.aroma.toFixed(1) + '%';
    scentValue.textContent = Math.round(state.aroma) + '%';
    petCountEl.textContent = state.pets;
    petalCountEl.textContent = state.petals;
    bloomCountEl.textContent = state.blooms;
    smellCountEl.textContent = state.smells;

    var grumpy = state.grumpy > 0;
    var dancing = state.dance > 0 && !grumpy;
    flowerBtn.classList.toggle('is-grumpy', grumpy);
    flowerBtn.classList.toggle('is-dancing', dancing);
    garden.classList.toggle('is-dancing', dancing);
    flowerBtn.classList.toggle('is-happy', !grumpy && !dancing && !state.sleeping && state.joy >= 55 && state.sun >= 22);
    flowerBtn.classList.toggle('is-sleepy', !grumpy && !dancing && !state.sleeping && state.sun < 22);
    flowerBtn.classList.toggle('has-aroma', !grumpy && state.aroma >= 22);
    moodText.classList.toggle('is-grumpy', grumpy);
    moodText.textContent = grumpy
      ? 'настроение: злится (︿)'
      : dancing ? 'настроение: танцует (◕ᴗ◕✿)'
      : state.sleeping ? 'настроение: расцвела и дремлет'
      : state.sun < 22 ? 'настроение: ёжится от холода'
      : state.joy >= 55 ? 'настроение: радуется и пахнет'
      : 'настроение: тихо радуется';

    flowerHint.textContent = grumpy
      ? 'не дёргай меня!'
      : dancing ? 'я танцую!'
      : state.sleeping ? 'я расцвела ♡'
      : state.sun < 22 ? 'мне холодновато…'
      : state.joy >= 55 ? 'как хорошо!' : 'погладь меня';
  }

  function addJoy(amount) {
    state.aroma = clamp(state.aroma + Math.max(0, amount) * 0.9 + 1.5, 0, 100);
    if (state.sleeping || state.grumpy > 0) return;
    state.joy = clamp(state.joy + amount, 0, 100);
    syncBlooms();
    if (state.joy >= 100) {
      state.sleeping = true;
      flowerBtn.classList.remove('is-sleepy');
      flowerBtn.classList.add('is-bloomed');
      var c = centerIn(flowerBtn);
      burst(c.x, c.y - 30, 'heart', 12);
      burst(c.x, c.y - 30, 'sparkle', 10);
      spawnScent(c.x, c.y - 30, 14, false);
      say('Я расцвела! (◕ᴗ◕✿) Спасибо!');
      chime(1046, 0.55);
    }
    updateUI();
  }

  function makeGrumpy(reason) {
    if (state.sleeping) {
      say('Я расцвела — не дразнись.');
      return false;
    }
    if (state.grumpy > 0) {
      say(pick(TEASE_PHRASES));
      var f = centerIn(flowerBtn);
      spawnScent(f.x, f.y - 28, 4, true);
      return false;
    }
    state.grumpy = 7;
    state.dance = 0;
    state.danceBeat = 0;
    flowerBtn.classList.remove('is-dancing');
    garden.classList.remove('is-dancing');
    state.aroma = clamp(state.aroma - 20, 0, 100);
    state.joy = clamp(state.joy - 5, 0, 100);
    var c = centerIn(flowerBtn);
    burst(c.x, c.y - 30, 'sparkle', 4);
    spawnScent(c.x, c.y - 28, 9, true);
    say(reason || pick(TEASE_PHRASES));
    chime(330, 0.18, true); // мягкий «обиженный» звук вместо низкого «пука»
    updateUI();
    return true;
  }

  function pet() {
    state.pets++;
    var c = centerIn(flowerBtn);
    burst(c.x, c.y - 26, 'heart', 7);
    var nowMs = performance.now();
    state.petStreak = nowMs - state.lastPetAt < 500 ? state.petStreak + 1 : 1;
    state.lastPetAt = nowMs;

    if (state.petStreak >= 6 && !state.sleeping) {
      state.petStreak = 0;
      makeGrumpy('Ой! Хватит щекотать!');
    } else if (state.grumpy > 0) {
      say(pick(TEASE_PHRASES));
      spawnScent(c.x, c.y - 28, 4, true);
      chime(330, 0.14, true);
    } else if (state.sleeping) {
      say('Я сплю… но спасибо (◕ᴗ◕✿)');
      spawnScent(c.x, c.y - 28, 4, false);
    } else {
      say(pick(PAT_PHRASES));
      addJoy(2.4);
      if (Math.random() < 0.45) spawnPetal(rnd(30, W - 30), rnd(18, 90));
      if (Math.random() < 0.5) spawnScent(c.x, c.y - 28, 3, false);
    }
    chime(660 + (state.pets % 3) * 80, 0.22);
    updateUI();
  }

  function callSun() {
    state.sun = clamp(state.sun + 20, 0, 100);
    var c = centerIn(sunBtn);
    burst(c.x, c.y, 'sparkle', 10);
    for (var i = 0; i < 3; i++) spawnPetal(c.x + rnd(-30, 55), c.y + rnd(-5, 30));
    sunBtn.classList.add('is-warm');
    window.setTimeout(function () { sunBtn.classList.remove('is-warm'); }, 420);
    say(state.grumpy > 0 ? 'Даже солнышко не поможет — я злюсь!' : pick(SUN_PHRASES));
    chime(880, 0.3);
    if (state.grumpy <= 0) {
      addJoy(1.3);
      state.aroma = clamp(state.aroma + 9, 0, 100);
      var f = centerIn(flowerBtn);
      spawnScent(f.x, f.y - 30, 4, false);
    }
    updateUI();
  }

  function water() {
    if (waterCooldown > 0) return;
    waterCooldown = 0.45;
    var f = centerIn(flowerBtn);
    // Капли летят из носника по дуге и попадают в чашечку, а не под лейку.
    pourDrops();
    canBtn.classList.add('is-pouring');
    window.setTimeout(function () { canBtn.classList.remove('is-pouring'); }, 660);
    state.sun = clamp(state.sun - 3, 0, 100);
    say(state.grumpy > 0 ? 'Не поливай сердитый цветок!' : pick(WATER_PHRASES));
    chime(520, 0.25);
    if (state.grumpy <= 0) {
      addJoy(4.5);
      state.aroma = clamp(state.aroma + 12, 0, 100);
      spawnScent(f.x, f.y - 30, 6, false);
    }
    updateUI();
  }

  function smell() {
    var c = centerIn(flowerBtn);
    if (state.grumpy > 0) {
      say('Фу! Я злюсь — не нюхай.');
      spawnScent(c.x, c.y - 28, 4, true);
      chime(330, 0.14, true);
      return;
    }
    state.smells++;
    if (state.aroma < 10) {
      say('Подожди, аромат ещё собирается…');
      spawnScent(c.x, c.y - 28, 2, false);
    } else {
      say(state.sleeping ? 'Пахнет сном… (◕ᴗ◕✿)' : pick(SMELL_PHRASES));
      burst(c.x, c.y - 34, 'sparkle', 6);
      spawnScent(c.x, c.y - 28, 12, false);
      addJoy(2.2);
      chime(1040, 0.3);
    }
    updateUI();
  }

  function tease() {
    makeGrumpy(pick(TEASE_PHRASES));
  }

  function dance() {
    if (state.grumpy > 0) {
      say('Я злюсь — не хочу танцевать!');
      var g = centerIn(flowerBtn);
      spawnScent(g.x, g.y - 28, 4, true);
      return;
    }
    state.dance = 6;
    state.danceBeat = 0;
    flowerBtn.classList.add('is-dancing');
    garden.classList.add('is-dancing');
    var c = centerIn(flowerBtn);
    burst(c.x, c.y - 34, 'heart', 5);
    spawnScent(c.x, c.y - 30, 8, false);
    say(state.sleeping ? 'Я расцвела и танцую во сне…' : pick(DANCE_PHRASES));
    addJoy(3);
    chime(784, 0.2, true);
    updateUI();
  }

  function reset() {
    petals.length = 0;
    sparks.length = 0;
    scents.length = 0;
    drops.length = 0;
    state.joy = 8;
    state.sun = 65;
    state.aroma = 0;
    state.grumpy = 0;
    state.dance = 0;
    state.danceBeat = 0;
    state.beatIndex = 0;
    state.smells = 0;
    state.petStreak = 0;
    state.lastPetAt = 0;
    state.pets = 0;
    state.petals = 0;
    state.sleeping = false;
    flowerBtn.classList.remove('is-bloomed', 'is-happy', 'is-sleepy', 'is-grumpy', 'is-dancing', 'has-aroma');
    garden.classList.remove('is-dancing');
    syncBlooms();
    updateUI();
    say('Снова здравствуй! (◕ᴗ◕✿)');
    chime(784, 0.35);
  }

  /* ── ввод ───────────────────────────────────────────────────────── */

  flowerBtn.addEventListener('click', pet);
  patBtn.addEventListener('click', pet);
  sunBtn.addEventListener('click', callSun);
  sunControlBtn.addEventListener('click', callSun);
  canBtn.addEventListener('click', water);
  waterControlBtn.addEventListener('click', water);
  smellBtn.addEventListener('click', smell);
  teaseBtn.addEventListener('click', tease);
  danceBtn.addEventListener('click', dance);
  resetBtn.addEventListener('click', reset);

  soundBtn.addEventListener('click', function () {
    state.sound = !state.sound;
    soundBtn.setAttribute('aria-pressed', state.sound ? 'true' : 'false');
    soundLabel.textContent = state.sound ? 'ЗВУК ВКЛ' : 'ЗВУК ВЫКЛ';
    if (state.sound) chime(760, 0.22);
  });

  canvas.addEventListener('pointerdown', function (e) {
    var rect = canvas.getBoundingClientRect();
    var x = e.clientX - rect.left;
    var y = e.clientY - rect.top;
    var t = performance.now() / 1000;
    for (var i = petals.length - 1; i >= 0; i--) {
      var p = petals[i];
      var px = p.x + Math.sin(t * 1.15 + p.phase) * p.sway;
      var dx = px - x, dy = p.y - y;
      if (dx * dx + dy * dy < Math.pow(Math.max(20, p.r * 1.9), 2)) {
        petals.splice(i, 1);
        state.petals++;
        burst(px, p.y, 'sparkle', 7);
        say(state.grumpy > 0 ? 'Даже лепесток не утешит!' : pick(CATCH_PHRASES));
        chime(990, 0.26);
        addJoy(3.2);
        updateUI();
        return;
      }
    }
    burst(x, y, 'sparkle', 3);
  });

  document.addEventListener('keydown', function (e) {
    var tag = e.target && e.target.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
    if (e.code === 'Space') {
      e.preventDefault();
      pet();
    } else if (e.key === 's' || e.key === 'S' || e.key === 'ы' || e.key === 'Ы') {
      callSun();
    } else if (e.key === 'w' || e.key === 'W' || e.key === 'ц' || e.key === 'Ц') {
      water();
    } else if (e.key === 'n' || e.key === 'N' || e.key === 'т' || e.key === 'Т') {
      smell();
    } else if (e.key === 'd' || e.key === 'D' || e.key === 'в' || e.key === 'В') {
      tease();
    } else if (e.key === 't' || e.key === 'T' || e.key === 'е' || e.key === 'Е') {
      dance();
    }
  });

  /* ── время суток ────────────────────────────────────────────────── */

  function updateDaypart() {
    var hour = new Date().getHours();
    var part = hour >= 7 && hour < 17 ? 'day' : hour >= 17 && hour < 22 ? 'evening' : 'night';
    if (part === lastDaypart) return;
    lastDaypart = part;
    garden.dataset.daypart = part;
    var label = part === 'day' ? 'день' : part === 'evening' ? 'вечер' : 'ночь';
    daypartEl.textContent = label;
    daypartEl.title = 'Сейчас ' + label + ' — цветочек радует и злит в любое время';
    sunBtn.setAttribute('aria-label', part === 'night' ? 'Позвать лучик' : 'Позвать солнышко');
  }

  /* ── кадр ───────────────────────────────────────────────────────── */

  function frame(now) {
    var dt = lastFrame ? Math.min(0.05, (now - lastFrame) / 1000) : 0;
    lastFrame = now;

    if (!state.sleeping) {
      state.sun = clamp(state.sun - dt * 0.55, 0, 100);
      if (state.sun < 20) {
        state.joy = clamp(state.joy - dt * 0.45, 0, 100);
        syncBlooms();
      }
    }

    if (state.grumpy > 0) {
      state.grumpy = Math.max(0, state.grumpy - dt);
      if (state.grumpy === 0) {
        var calmCenter = centerIn(flowerBtn);
        spawnScent(calmCenter.x, calmCenter.y - 30, 7, false);
        say(pick(CALM_PHRASES));
        chime(700, 0.24);
      }
    }
    if (state.dance > 0) {
      state.dance = Math.max(0, state.dance - dt);
      state.danceBeat -= dt;
      if (state.danceBeat <= 0) {
        state.danceBeat = 0.42;
        chime(DANCE_NOTES[state.beatIndex % DANCE_NOTES.length], 0.18, true);
        state.beatIndex++;
        var danceCenter = centerIn(flowerBtn);
        if (state.beatIndex % 2 === 0) spawnScent(danceCenter.x, danceCenter.y - 30, 2, false);
        else burst(danceCenter.x, danceCenter.y - 40, 'sparkle', 3);
      }
      if (state.dance === 0) {
        flowerBtn.classList.remove('is-dancing');
        garden.classList.remove('is-dancing');
        say(pick(CALM_PHRASES));
      }
    }
    state.aroma = clamp(state.aroma - dt * (state.grumpy > 0 ? 3.2 : 1), 0, 100);

    waterCooldown = Math.max(0, waterCooldown - dt);
    spawnTimer -= dt;
    if (spawnTimer <= 0) {
      spawnTimer = rnd(1.5, 3.2);
      spawnPetal(rnd(24, W - 24), -22);
    }

    scentTimer -= dt;
    if (scentTimer <= 0) {
      scentTimer = rnd(2.4, 4.2);
      var scentCenter = centerIn(flowerBtn);
      if (state.grumpy > 0) spawnScent(scentCenter.x, scentCenter.y - 28, 3, true);
      else if (state.aroma >= 22 && !state.sleeping) spawnScent(scentCenter.x, scentCenter.y - 30, 2, false);
    }

    daypartTimer -= dt;
    if (daypartTimer <= 0) {
      daypartTimer = 30;
      updateDaypart();
    }

    idleTimer -= dt;
    if (idleTimer <= 0) {
      idleTimer = rnd(14, 24);
      if (!bubble.classList.contains('is-visible') && state.dance <= 0) say(pick(state.grumpy > 0 ? TEASE_PHRASES : PHRASES));
    }

    for (var i = petals.length - 1; i >= 0; i--) {
      var p = petals[i];
      p.y += p.vy * dt;
      p.rot += p.vr * dt;
      if (p.y > H + 40) petals.splice(i, 1);
    }
    for (var j = sparks.length - 1; j >= 0; j--) {
      var s = sparks[j];
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.life -= dt;
      if (s.life <= 0) sparks.splice(j, 1);
    }
    for (var k = scents.length - 1; k >= 0; k--) {
      var a = scents[k];
      a.x += a.vx * dt;
      a.y += a.vy * dt;
      a.life -= dt;
      if (a.life <= 0) scents.splice(k, 1);
    }
    for (var d = drops.length - 1; d >= 0; d--) {
      var drop = drops[d];
      if (drop.delay > 0) { drop.delay -= dt; continue; }
      drop.t += dt;
      if (drop.t >= drop.dur) {
        if (Math.random() < 0.4) burst(drop.x1, drop.y1, 'drop', 1);
        drops.splice(d, 1);
      }
    }

    if (now - uiTick > 120) {
      uiTick = now;
      updateUI();
    }
    draw(now / 1000);
    requestAnimationFrame(frame);
  }

  updateDaypart();
  resize();
  if (window.ResizeObserver) {
    new ResizeObserver(resize).observe(garden);
  } else {
    window.addEventListener('resize', resize);
  }
  paintGarden();
  updateUI();
  requestAnimationFrame(frame);
  window.setTimeout(function () { say(PHRASES[0]); }, 650);
})();
