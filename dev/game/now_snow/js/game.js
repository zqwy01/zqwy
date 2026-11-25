/* Мокрый снег — маленькая игрушка у окна.
 * Никаких проигрышей: стекло можно тереть, хлопья — собирать,
 * игрушку — гладить. Музыка — из общего каталога src/tracks.
 */
(function () {
  'use strict';

  var canvas = document.getElementById('snow');
  var ctx = canvas.getContext('2d');
  var fog = document.createElement('canvas');
  var fctx = fog.getContext('2d');

  var toy = document.getElementById('toy');
  var hearts = document.getElementById('hearts');
  var bubble = document.getElementById('bubble');
  var hint = document.getElementById('hint');
  var cozyFill = document.getElementById('cozyFill');
  var cozyValue = document.getElementById('cozyValue');
  var flakeCountEl = document.getElementById('flakeCount');
  var patCountEl = document.getElementById('patCount');
  var funCountEl = document.getElementById('funCount');
  var jarFill = document.getElementById('jarFill');

  var audio = document.getElementById('audio');
  var musicBtn = document.getElementById('musicBtn');
  var musicLabel = document.getElementById('musicLabel');
  var windBtn = document.getElementById('windBtn');
  var windLabel = document.getElementById('windLabel');
  var resetBtn = document.getElementById('resetBtn');

  var TRACKS = [
    {
      title: 'Winter dream · zqwy',
      url: '../../src/tracks/backers/15_zqwy_winter_dream/15_zqwy_winter_dream.opus'
    },
    {
      title: 'Night · everyday',
      url: '../../src/tracks/everyday/4_zqwy_night/4_zqwy_night.opus'
    }
  ];

  var PHRASES = [
    'Какой мокрый снег…',
    'Хлопья липнут к стеклу.',
    'Мне тут тепло.',
    'Смотри, за окном фонарь.',
    'Ещё немного… ой, прости.',
    'Давай постоим тут.',
    'Банка почти полная!',
    'Тихо. Снег идёт.'
  ];
  var PATS = ['хихи!', 'тепло', 'ещё!', 'я домашняя гиенка', 'мурк… ой, хихи'];
  var HAPPY = ['снежок!', 'поймала!', 'давай ещё!', 'хихихи!'];
  var SLEEP_PHRASES = ['…хрр-хихи', 'я засыпаю', 'снег укрыл город'];

  var W = 1, H = 1, dpr = 1;
  var flakes = [];
  var stuck = [];
  var rings = [];
  var snowballs = [];
  var buildings = [];
  var trees = [];
  var windowsLit = [];

  var cozy = 0;
  var flakeCount = 0;
  var patCount = 0;
  var fun = 0;
  var wipeDist = 0;
  var sleeping = false;
  var bubbleTimer = null;
  var lastWipe = null;
  var lastTime = 0;
  var fogTick = 0;
  var uiTick = 0;
  var trackIndex = 0;
  var trackRetries = 0;
  var audioCtx = null;
  var windGain = null;
  var windOn = false;
  var musicOn = false;

  function rnd(a, b) { return a + Math.random() * (b - a); }
  function pick(list) { return list[(Math.random() * list.length) | 0]; }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

  /* ── стекло и вид за окном ─────────────────────────────────────── */

  function makeTown() {
    buildings = [];
    windowsLit = [];
    var x = -0.03;
    while (x < 1.05) {
      var w = rnd(0.09, 0.19);
      var h = rnd(0.22, 0.48);
      buildings.push({ x: x, w: w, h: h, tint: rnd(0, 1) });
      for (var wy = 0.08; wy < h - 0.04; wy += 0.075) {
        for (var wx = x + 0.018; wx < x + w - 0.02; wx += 0.045) {
          windowsLit.push({
            x: wx, y: wy,
            on: Math.random() < 0.42,
            phase: rnd(0, 6.28)
          });
        }
      }
      x += w + rnd(0.005, 0.025);
    }
    trees = [
      { x: 0.11, h: 0.31 }, { x: 0.22, h: 0.23 },
      { x: 0.78, h: 0.27 }, { x: 0.91, h: 0.35 }
    ];
  }

  function paintFog() {
    fctx.clearRect(0, 0, W, H);
    var g = fctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, 'rgba(202,220,234,0.15)');
    g.addColorStop(0.55, 'rgba(190,210,226,0.24)');
    g.addColorStop(1, 'rgba(176,199,217,0.34)');
    fctx.fillStyle = g;
    fctx.fillRect(0, 0, W, H);
  }

  function resize() {
    var rect = canvas.getBoundingClientRect();
    var newW = Math.max(1, rect.width);
    var newH = Math.max(1, rect.height);
    var sx = W > 1 ? newW / W : 1;
    var sy = H > 1 ? newH / H : 1;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = newW; H = newH;

    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    fog.width = canvas.width;
    fog.height = canvas.height;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    fctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    paintFog();

    flakes.forEach(function (f) { f.x *= sx; f.y *= sy; });
    stuck.forEach(function (s) { s.x *= sx; s.y *= sy; });
    rings.length = 0;
  }

  function newFlake(initial) {
    var z = Math.random();
    return {
      x: rnd(0, W),
      y: initial ? rnd(-H * 0.2, H) : rnd(-30, -2),
      z: z,
      r: 0.7 + z * 2.5,
      vy: 12 + z * 44,
      drift: rnd(4, 18),
      phase: rnd(0, 6.28)
    };
  }

  function initFlakes() {
    flakes = [];
    for (var i = 0; i < 130; i++) flakes.push(newFlake(true));
  }

  function drawTown(t) {
    var sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, '#101a2c');
    sky.addColorStop(0.52, '#26334b');
    sky.addColorStop(1, '#4c5870');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);

    buildings.forEach(function (b) {
      var bx = b.x * W, bw = b.w * W, bh = b.h * H;
      ctx.fillStyle = b.tint > 0.5 ? '#1b2437' : '#222c40';
      ctx.fillRect(bx, H - bh, bw, bh);
      ctx.fillStyle = 'rgba(220,232,245,0.16)';
      ctx.fillRect(bx, H - bh, bw, 2.5);
      ctx.beginPath();
      ctx.moveTo(bx - 3, H - bh);
      ctx.lineTo(bx + bw * 0.5, H - bh - 8 - b.tint * 7);
      ctx.lineTo(bx + bw + 3, H - bh);
      ctx.closePath();
      ctx.fillStyle = '#161f30';
      ctx.fill();
    });

    windowsLit.forEach(function (win) {
      if (!win.on) return;
      var flicker = 0.75 + 0.25 * Math.sin(t * 0.4 + win.phase);
      ctx.fillStyle = 'rgba(239,195,126,' + (0.45 * flicker).toFixed(3) + ')';
      ctx.fillRect(win.x * W, win.y * H, Math.max(2, W * 0.015), Math.max(3, H * 0.026));
    });

    trees.forEach(function (tr) {
      var tx = tr.x * W, ground = H * 0.88, th = tr.h * H;
      ctx.strokeStyle = '#131d2b';
      ctx.lineCap = 'round';
      ctx.lineWidth = Math.max(3, W * 0.008);
      ctx.beginPath();
      ctx.moveTo(tx, ground);
      ctx.lineTo(tx, ground - th);
      ctx.stroke();
      ctx.lineWidth = Math.max(1.5, W * 0.004);
      for (var i = 0; i < 5; i++) {
        var y = ground - th * (0.35 + i * 0.13);
        var len = W * (0.045 - i * 0.006);
        ctx.beginPath();
        ctx.moveTo(tx, y);
        ctx.lineTo(tx - len, y - len * 0.75);
        ctx.moveTo(tx, y);
        ctx.lineTo(tx + len, y - len * 0.8);
        ctx.stroke();
      }
      ctx.fillStyle = 'rgba(226,236,246,0.22)';
      ctx.beginPath();
      ctx.ellipse(tx, ground - th, W * 0.035, H * 0.012, 0, 0, 6.2832);
      ctx.fill();
    });

    // фонарь: тёплый ореол только вокруг лампы, без огромного прямоугольника
    var lx = W * 0.63, ly = H * 0.44;
    var lampX = lx - W * 0.045;
    var lampY = ly + H * 0.012;
    ctx.strokeStyle = '#101925';
    ctx.lineWidth = Math.max(2, W * 0.004);
    ctx.beginPath();
    ctx.moveTo(lx, H * 0.88);
    ctx.lineTo(lx, ly);
    ctx.lineTo(lampX, ly);
    ctx.stroke();
    var lamp = ctx.createRadialGradient(lampX, lampY, 1, lampX, lampY, W * 0.11);
    lamp.addColorStop(0, 'rgba(255,220,160,0.42)');
    lamp.addColorStop(0.35, 'rgba(255,200,130,0.16)');
    lamp.addColorStop(1, 'rgba(255,200,130,0)');
    ctx.fillStyle = lamp;
    ctx.beginPath();
    ctx.arc(lampX, lampY, W * 0.11, 0, 6.2832);
    ctx.fill();
    ctx.fillStyle = '#ffe2b0';
    ctx.fillRect(lampX - W * 0.007, ly, W * 0.014, H * 0.018);

    ctx.fillStyle = '#151e2d';
    ctx.fillRect(0, H * 0.88, W, H * 0.12);
    ctx.fillStyle = 'rgba(225,236,246,0.12)';
    ctx.fillRect(0, H * 0.88, W, 2);
  }

  function drawFlakes(t, dt) {
    // дальний снег
    for (var i = 0; i < flakes.length; i++) {
      var f = flakes[i];
      f.y += f.vy * dt;
      f.x += Math.sin(t * 0.7 + f.phase) * f.drift * dt;
      if (f.y > H + 8 || f.x < -12 || f.x > W + 12) {
        flakes[i] = newFlake(false);
        continue;
      }
      var alpha = 0.34 + f.z * 0.55;
      ctx.beginPath();
      ctx.arc(f.x, f.y, f.r, 0, 6.2832);
      ctx.fillStyle = 'rgba(244,250,255,' + alpha.toFixed(3) + ')';
      ctx.fill();

      if (f.z > 0.5 && f.y > H * 0.22 && f.y < H * 0.87 && stuck.length < 26 && Math.random() < 0.00013) {
        stickFlake(f);
        flakes[i] = newFlake(false);
      }
    }

    // прилипшие мокрые хлопья
    for (var j = stuck.length - 1; j >= 0; j--) {
      var s = stuck[j];
      s.age += dt;
      s.y += s.vy * dt;
      s.trail += s.vy * dt;
      var life = clamp(1 - s.age / s.life, 0, 1);
      if (life <= 0) { stuck.splice(j, 1); continue; }
      ctx.strokeStyle = 'rgba(224,240,250,' + (0.2 * life).toFixed(3) + ')';
      ctx.lineWidth = s.r * 0.7;
      ctx.beginPath();
      ctx.moveTo(s.x, s.y - s.trail);
      ctx.lineTo(s.x, s.y);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, 6.2832);
      ctx.fillStyle = 'rgba(238,247,255,' + (0.5 * life).toFixed(3) + ')';
      ctx.fill();
      ctx.beginPath();
      ctx.arc(s.x - s.r * 0.3, s.y - s.r * 0.3, s.r * 0.32, 0, 6.2832);
      ctx.fillStyle = 'rgba(255,255,255,' + (0.7 * life).toFixed(3) + ')';
      ctx.fill();
    }

    for (var k = rings.length - 1; k >= 0; k--) {
      var ring = rings[k];
      ring.age += dt;
      if (ring.age > 0.6) { rings.splice(k, 1); continue; }
      ctx.beginPath();
      ctx.arc(ring.x, ring.y, 4 + ring.age * 30, 0, 6.2832);
      ctx.strokeStyle = 'rgba(255,255,255,' + ((1 - ring.age / 0.6) * 0.6).toFixed(3) + ')';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
  }

  function stickFlake(f) {
    stuck.push({
      x: f.x, y: f.y,
      r: 3 + f.z * 5,
      vy: rnd(0.5, 2.4),
      age: 0,
      life: rnd(11, 21),
      trail: 0
    });
  }

  function drawSnowballs(dt) {
    for (var i = snowballs.length - 1; i >= 0; i--) {
      var b = snowballs[i];
      b.t += dt;
      var p = Math.min(1, b.t / b.dur);
      var arc = Math.sin(p * Math.PI) * H * 0.18;
      var x = b.x + (b.tx - b.x) * p;
      var y = b.y + (b.ty - b.y) * p - arc;
      ctx.beginPath();
      ctx.arc(x, y, b.r, 0, 6.2832);
      ctx.fillStyle = 'rgba(245,250,255,0.95)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(180,210,230,0.7)';
      ctx.lineWidth = 1;
      ctx.stroke();
      if (p >= 1) {
        snowballs.splice(i, 1);
        rings.push({ x: b.tx, y: b.ty - 24, age: 0 });
        addFun(2, pick(HAPPY));
      }
    }
  }

  function draw(t, dt) {
    drawTown(t);
    drawFlakes(t, dt);
    drawSnowballs(dt);

    fogTick++;
    if (fogTick % 18 === 0) {
      fctx.fillStyle = 'rgba(198,217,232,0.004)';
      fctx.fillRect(0, 0, W, H);
    }
    ctx.drawImage(fog, 0, 0, W, H);
  }

  function loop(now) {
    if (!lastTime) lastTime = now;
    var dt = Math.min(0.05, (now - lastTime) / 1000);
    lastTime = now;

    if (!sleeping) cozy += dt * 0.42;
    if (cozy >= 100) { cozy = 100; fallAsleep(); }

    uiTick++;
    if (uiTick % 8 === 0) updateUi();
    draw(now / 1000, dt);
    requestAnimationFrame(loop);
  }

  /* ── взаимодействие ───────────────────────────────────────────── */

  function pointFromEvent(e) {
    var rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function wipe(x, y) {
    fctx.save();
    fctx.globalCompositeOperation = 'destination-out';
    fctx.beginPath();
    fctx.arc(x, y, 34, 0, 6.2832);
    fctx.fillStyle = 'rgba(0,0,0,0.9)';
    fctx.fill();
    fctx.restore();

    // убрать прилипшие хлопьи на пути пальца
    for (var i = stuck.length - 1; i >= 0; i--) {
      var dx = stuck[i].x - x, dy = stuck[i].y - y;
      if (dx * dx + dy * dy < 26 * 26) stuck.splice(i, 1);
    }
  }

  function wipeTo(x, y) {
    if (lastWipe) {
      var dx = x - lastWipe.x, dy = y - lastWipe.y;
      var dist = Math.sqrt(dx * dx + dy * dy);
      var steps = Math.ceil(dist / 16);
      for (var i = 1; i <= steps; i++) {
        wipe(lastWipe.x + dx * i / steps, lastWipe.y + dy * i / steps);
      }
      wipeDist += dist;
      if (wipeDist > 900) {
        wipeDist = 0;
        addFun(1, 'Окошко чистое!');
      }
    } else {
      wipe(x, y);
    }
    lastWipe = { x: x, y: y };
  }

  canvas.addEventListener('pointerdown', function (e) {
    var p = pointFromEvent(e);
    lastWipe = p;
    wipe(p.x, p.y);

    var best = -1, bestDist = 44 * 44;
    for (var i = 0; i < stuck.length; i++) {
      var dx = stuck[i].x - p.x, dy = stuck[i].y - p.y;
      var dist = dx * dx + dy * dy;
      if (dist < bestDist) { bestDist = dist; best = i; }
    }
    if (best >= 0) {
      var s = stuck[best];
      stuck.splice(best, 1);
      rings.push({ x: s.x, y: s.y, age: 0 });
      collect();
    }
    ensureAudioContext();
  });

  canvas.addEventListener('pointermove', function (e) {
    if (e.pointerType !== 'mouse' && e.buttons === 0) { lastWipe = null; return; }
    var p = pointFromEvent(e);
    wipeTo(p.x, p.y);
  });
  canvas.addEventListener('pointerup', function () { lastWipe = null; });
  canvas.addEventListener('pointerleave', function () { lastWipe = null; });

  window.addEventListener('pointermove', function (e) {
    var r = toy.getBoundingClientRect();
    var cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    var dx = clamp((e.clientX - cx) / (r.width * 0.6), -1, 1);
    var dy = clamp((e.clientY - cy) / (r.height * 0.6), -1, 1);
    toy.style.setProperty('--lx', (dx * 7).toFixed(1) + 'px');
    toy.style.setProperty('--ly', (dy * 5).toFixed(1) + 'px');
    toy.style.setProperty('--tilt', (dx * 4).toFixed(1) + 'deg');
  });

  function showBubble(text, ms) {
    bubble.textContent = text;
    bubble.classList.add('show');
    clearTimeout(bubbleTimer);
    bubbleTimer = setTimeout(function () { bubble.classList.remove('show'); }, ms || 2600);
  }

  function makeHeart(kind) {
    var el = document.createElement('span');
    el.className = 'heart';
    el.textContent = kind || pick(['♥', '♡', '✦']);
    el.style.setProperty('--drift', rnd(-42, 42).toFixed(0) + 'px');
    el.style.left = rnd(38, 62).toFixed(0) + '%';
    hearts.appendChild(el);
    setTimeout(function () { el.remove(); }, 1300);
  }

  function addFun(amount, text) {
    fun = Math.min(12, fun + amount);
    cozy = Math.min(100, cozy + amount * 0.7);
    toy.classList.remove('happy');
    void toy.offsetWidth;
    toy.classList.add('happy');
    setTimeout(function () { toy.classList.remove('happy'); }, 900);
    makeHeart(pick(['✦', '♪', '♥']));
    if (text) showBubble(text, 1800);
    bell(880 + fun * 18);
    updateUi();
  }

  function pat() {
    patCount++;
    cozy = Math.min(100, cozy + 2.2);
    toy.classList.remove('pet');
    void toy.offsetWidth;
    toy.classList.add('pet');
    setTimeout(function () { toy.classList.remove('pet'); }, 600);
    makeHeart();
    showBubble(sleeping ? pick(SLEEP_PHRASES) : pick(PATS), 1900);
    bell(700 + pick([0, 90, 180]));
    updateUi();
  }

  function collect() {
    flakeCount++;
    cozy = Math.min(100, cozy + 3.2);
    showBubble(sleeping ? pick(SLEEP_PHRASES) : pick(PHRASES));
    bell(980);
    if (flakeCount === 1) {
      hint.textContent = 'Хлопья прилипают к стеклу и медленно сползают. Лови их в банку, протирай стекло и бросай гиенке снежок клавишей S.';
    }
    if (flakeCount > 0 && flakeCount % 5 === 0) addFun(1, 'Банка звенит!');
    updateUi();
  }

  function throwSnowball() {
    if (sleeping) { showBubble(pick(SLEEP_PHRASES), 1600); return; }
    var tx = W * 0.5;
    var ty = H * 0.68;
    snowballs.push({ x: rnd(W * 0.2, W * 0.8), y: -12, tx: tx, ty: ty, t: 0, dur: rnd(0.7, 1), r: rnd(4, 6) });
    showBubble('Снежок летит…', 900);
  }

  function fallAsleep() {
    if (sleeping) return;
    sleeping = true;
    toy.classList.add('sleeping');
    showBubble(pick(SLEEP_PHRASES), 4200);
  }

  function reset() {
    flakeCount = 0;
    patCount = 0;
    fun = 0;
    cozy = 0;
    wipeDist = 0;
    sleeping = false;
    stuck.length = 0;
    snowballs.length = 0;
    toy.classList.remove('sleeping', 'pet', 'happy');
    showBubble('Сначала. Снег ещё идёт.', 2200);
    updateUi();
  }

  function updateUi() {
    cozyFill.style.width = cozy.toFixed(1) + '%';
    cozyValue.textContent = Math.round(cozy) + '%';
    flakeCountEl.textContent = String(flakeCount);
    patCountEl.textContent = String(patCount);
    funCountEl.textContent = String(fun);
    jarFill.style.height = Math.min(100, flakeCount / 12 * 100).toFixed(0) + '%';
  }

  toy.addEventListener('click', pat);
  resetBtn.addEventListener('click', reset);

  /* ── звук ──────────────────────────────────────────────────────── */

  function ensureAudioContext() {
    if (audioCtx) {
      if (audioCtx.state === 'suspended') audioCtx.resume().catch(function () {});
      return audioCtx;
    }
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    try {
      audioCtx = new AC();
      var len = Math.floor(audioCtx.sampleRate * 2);
      var buffer = audioCtx.createBuffer(1, len, audioCtx.sampleRate);
      var data = buffer.getChannelData(0);
      for (var i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
      var source = audioCtx.createBufferSource();
      source.buffer = buffer;
      source.loop = true;
      var filter = audioCtx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 380;
      windGain = audioCtx.createGain();
      windGain.gain.value = windOn ? 0.05 : 0;
      var lfo = audioCtx.createOscillator();
      var lfoGain = audioCtx.createGain();
      lfo.frequency.value = 0.09;
      lfoGain.gain.value = 0.018;
      lfo.connect(lfoGain);
      lfoGain.connect(windGain.gain);
      source.connect(filter);
      filter.connect(windGain);
      windGain.connect(audioCtx.destination);
      source.start();
      lfo.start();
    } catch (e) {
      audioCtx = null;
      windGain = null;
    }
    return audioCtx;
  }

  function bell(freq) {
    var ac = ensureAudioContext();
    if (!ac) return;
    try {
      var osc = ac.createOscillator();
      var gain = ac.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, ac.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.055, ac.currentTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + 0.45);
      osc.connect(gain);
      gain.connect(ac.destination);
      osc.start();
      osc.stop(ac.currentTime + 0.5);
    } catch (e) { /* звук необязателен */ }
  }

  function loadTrack(index) {
    trackIndex = index;
    audio.src = TRACKS[index].url;
    audio.load();
  }

  function toggleMusic() {
    if (!musicOn) {
      if (!audio.src) loadTrack(0);
      ensureAudioContext();
      musicBtn.setAttribute('aria-pressed', 'true');
      musicLabel.textContent = '...';
      var promise = audio.play();
      if (promise && promise.then) {
        promise.then(function () {
          musicOn = true;
          musicBtn.setAttribute('aria-pressed', 'true');
          musicLabel.textContent = 'ПАУЗА';
        }).catch(function () {
          musicOn = false;
          musicBtn.setAttribute('aria-pressed', 'false');
          musicLabel.textContent = 'МУЗЫКА';
          showBubble('Нажми ещё раз — браузер ждёт жест.', 2800);
        });
      } else {
        musicOn = true;
        musicLabel.textContent = 'ПАУЗА';
      }
    } else {
      audio.pause();
      musicOn = false;
      musicBtn.setAttribute('aria-pressed', 'false');
      musicLabel.textContent = 'МУЗЫКА';
    }
  }

  audio.addEventListener('ended', function () {
    // на всякий случай, если loop не сработал
    audio.play().catch(function () {});
  });

  audio.addEventListener('error', function () {
    if (trackRetries < TRACKS.length - 1) {
      trackRetries++;
      loadTrack(trackRetries);
      if (musicBtn.getAttribute('aria-pressed') === 'true') {
        audio.play().then(function () {
          musicOn = true;
          musicLabel.textContent = 'ПАУЗА';
        }).catch(function () {
          musicOn = false;
          musicBtn.setAttribute('aria-pressed', 'false');
          musicLabel.textContent = 'МУЗЫКА';
        });
      }
    } else {
      musicOn = false;
      musicBtn.setAttribute('aria-pressed', 'false');
      musicLabel.textContent = 'МУЗЫКА';
      showBubble('Этот браузер не играет .opus — включи ветер.', 4000);
    }
  });

  function toggleWind() {
    var ac = ensureAudioContext();
    if (!ac || !windGain) {
      showBubble('Звук недоступен в этом браузере.', 2400);
      return;
    }
    windOn = !windOn;
    windGain.gain.setTargetAtTime(windOn ? 0.05 : 0, ac.currentTime, 0.4);
    windBtn.setAttribute('aria-pressed', String(windOn));
    windLabel.textContent = windOn ? 'ШУМИТ' : 'ВЕТЕР';
  }

  musicBtn.addEventListener('click', toggleMusic);
  windBtn.addEventListener('click', toggleWind);

  window.addEventListener('keydown', function (e) {
    if (e.target && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
    if (e.code === 'Space' && e.target === document.body) {
      e.preventDefault();
      pat();
    } else if (e.key === 's' || e.key === 'S' || e.key === 'ы' || e.key === 'Ы') {
      throwSnowball();
    } else if (e.key === 'm' || e.key === 'M' || e.key === 'ь' || e.key === 'Ь') {
      toggleMusic();
    } else if (e.key === 'w' || e.key === 'W' || e.key === 'ц' || e.key === 'Ц') {
      toggleWind();
    }
  });

  document.addEventListener('visibilitychange', function () {
    if (document.hidden) lastTime = 0;
  });

  /* ── старт ─────────────────────────────────────────────────────── */

  makeTown();
  resize();
  initFlakes();
  updateUi();
  window.addEventListener('resize', resize);
  requestAnimationFrame(loop);
})();
