/* Цветочек — маленькая игрушка (◕ᴗ◕✿).
 * Никаких таймеров и проигрышей: лепестки падают сами, цветочек можно
 * гладить, греть солнышком и поливать. Всё живёт в текущей вкладке.
 */
(function () {
  'use strict';

  var garden = document.getElementById('garden');
  var canvas = document.getElementById('sky');
  var ctx = canvas.getContext('2d');

  var flowerBtn = document.getElementById('flowerBtn');
  var flowerHint = document.getElementById('flowerHint');
  var sunBtn = document.getElementById('sunBtn');
  var canBtn = document.getElementById('canBtn');
  var bubble = document.getElementById('bubble');
  var gardenFlowers = document.getElementById('gardenFlowers');

  var joyFill = document.getElementById('joyFill');
  var joyValue = document.getElementById('joyValue');
  var sunFill = document.getElementById('sunFill');
  var sunValue = document.getElementById('sunValue');
  var petCountEl = document.getElementById('petCount');
  var petalCountEl = document.getElementById('petalCount');
  var bloomCountEl = document.getElementById('bloomCount');

  var patBtn = document.getElementById('patBtn');
  var sunControlBtn = document.getElementById('sunControlBtn');
  var waterControlBtn = document.getElementById('waterControlBtn');
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
  var PETAL_COLORS = ['#ffc6d3', '#f9a8bd', '#ffe0c8', '#ffd1dc'];

  var state = {
    joy: 8,
    sun: 65,
    pets: 0,
    petals: 0,
    blooms: 0,
    sleeping: false,
    sound: true
  };

  var petals = [];
  var sparks = [];
  var W = 1, H = 1, dpr = 1;
  var lastFrame = 0, uiTick = 0, spawnTimer = 1.4, waterCooldown = 0, idleTimer = 16;
  var bubbleTimer = null;
  var audioCtx = null;

  function rnd(a, b) { return a + Math.random() * (b - a); }
  function pick(list) { return list[(Math.random() * list.length) | 0]; }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

  /* ── звук: тихий колокольчик без внешних файлов ─────────────────── */

  function chime(freq, duration) {
    if (!state.sound) return;
    try {
      var Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      if (!audioCtx) audioCtx = new Ctx();
      if (audioCtx.state === 'suspended') audioCtx.resume();
      var end = audioCtx.currentTime + (duration || 0.32);
      var osc = audioCtx.createOscillator();
      var gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
      gain.gain.setValueAtTime(0.0001, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.055, audioCtx.currentTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, end);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(end + 0.02);
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

  function centerIn(element) {
    var r = element.getBoundingClientRect();
    var g = garden.getBoundingClientRect();
    return { x: r.left + r.width / 2 - g.left, y: r.top + r.height / 2 - g.top };
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
    petCountEl.textContent = state.pets;
    petalCountEl.textContent = state.petals;
    bloomCountEl.textContent = state.blooms;

    flowerBtn.classList.toggle('is-happy', !state.sleeping && state.joy >= 55 && state.sun >= 22);
    flowerBtn.classList.toggle('is-sleepy', !state.sleeping && state.sun < 22);
    flowerHint.textContent = state.sleeping
      ? 'я расцвёл ♡'
      : state.sun < 22 ? 'мне холодновато…' : state.joy >= 55 ? 'как хорошо!' : 'погладь меня';
  }

  function addJoy(amount) {
    if (state.sleeping) return;
    state.joy = clamp(state.joy + amount, 0, 100);
    syncBlooms();
    if (state.joy >= 100) {
      state.sleeping = true;
      flowerBtn.classList.remove('is-sleepy');
      flowerBtn.classList.add('is-bloomed');
      var c = centerIn(flowerBtn);
      burst(c.x, c.y - 30, 'heart', 12);
      burst(c.x, c.y - 30, 'sparkle', 10);
      say('Я расцвёл! (◕ᴗ◕✿) Спасибо!');
      chime(1046, 0.55);
    }
    updateUI();
  }

  function pet() {
    state.pets++;
    var c = centerIn(flowerBtn);
    burst(c.x, c.y - 26, 'heart', 7);
    if (state.sleeping) {
      say('Я сплю… но спасибо (◕ᴗ◕✿)');
    } else {
      say(pick(PAT_PHRASES));
      addJoy(2.4);
      if (Math.random() < 0.45) spawnPetal(rnd(30, W - 30), rnd(18, 90));
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
    say(pick(SUN_PHRASES));
    chime(880, 0.3);
    addJoy(1.3);
    updateUI();
  }

  function water() {
    if (waterCooldown > 0) return;
    waterCooldown = 0.45;
    var c = centerIn(canBtn);
    burst(c.x - 36, c.y, 'drop', 12);
    canBtn.classList.add('is-pouring');
    window.setTimeout(function () { canBtn.classList.remove('is-pouring'); }, 660);
    state.sun = clamp(state.sun - 3, 0, 100);
    say(pick(WATER_PHRASES));
    chime(520, 0.25);
    addJoy(4.5);
    updateUI();
  }

  function reset() {
    petals.length = 0;
    sparks.length = 0;
    state.joy = 8;
    state.sun = 65;
    state.pets = 0;
    state.petals = 0;
    state.sleeping = false;
    flowerBtn.classList.remove('is-bloomed', 'is-happy', 'is-sleepy');
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
        say(pick(CATCH_PHRASES));
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
    }
  });

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

    waterCooldown = Math.max(0, waterCooldown - dt);
    spawnTimer -= dt;
    if (spawnTimer <= 0) {
      spawnTimer = rnd(1.5, 3.2);
      spawnPetal(rnd(24, W - 24), -22);
    }

    idleTimer -= dt;
    if (idleTimer <= 0) {
      idleTimer = rnd(14, 24);
      if (!bubble.classList.contains('is-visible')) say(pick(PHRASES));
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

    if (now - uiTick > 120) {
      uiTick = now;
      updateUI();
    }
    draw(now / 1000);
    requestAnimationFrame(frame);
  }

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
