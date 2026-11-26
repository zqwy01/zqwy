/* Ветер гложет скелет забытого миротворца — атмосферный симулятор.
   Направление и сила ветра определяют, как быстро сдувается пыль с кости.
   Накопленное «обдувание» открывает обрывки памяти; укрытие останавливает
   разрушение, но не отнимает уже найденное. Проигрыша нет. */
(function () {
  'use strict';

  var stage = document.getElementById('wasteland');
  var canvas = document.getElementById('dust');
  var ctx = canvas.getContext('2d');
  var motesEl = document.getElementById('motes');
  var whisperEl = document.getElementById('whisper');
  var stageCaption = document.getElementById('stageCaption');
  var stageState = document.getElementById('stageState');

  var memoryFill = document.getElementById('memoryFill');
  var memoryValue = document.getElementById('memoryValue');
  var integrityFill = document.getElementById('integrityFill');
  var integrityValue = document.getElementById('integrityValue');
  var windFill = document.getElementById('windFill');
  var windValue = document.getElementById('windValue');
  var moodText = document.getElementById('moodText');
  var memoryCountEl = document.getElementById('memoryCount');
  var gustCountEl = document.getElementById('gustCount');
  var shelterCountEl = document.getElementById('shelterCount');

  var dirInput = document.getElementById('dirInput');
  var dirValue = document.getElementById('dirValue');
  var strengthInput = document.getElementById('strengthInput');
  var strengthValue = document.getElementById('strengthValue');
  var compassArrow = document.getElementById('compassArrow');
  var gustBtn = document.getElementById('gustBtn');
  var listenBtn = document.getElementById('listenBtn');
  var shelterBtn = document.getElementById('shelterBtn');
  var shelterLabel = document.getElementById('shelterLabel');
  var soundBtn = document.getElementById('soundBtn');
  var soundLabel = document.getElementById('soundLabel');
  var resetBtn = document.getElementById('resetBtn');

  var journalList = document.getElementById('journalList');
  var journalProgress = document.getElementById('journalProgress');
  var ending = document.getElementById('ending');

  var audio = window.PEACEMAKER_AUDIO || {
    unlock: function () {}, setEnabled: function () {}, setWind: function () {},
    gust: function () {}, chime: function () {}, listen: function () {}
  };

  var MEMORIES = [
    {
      title: 'Белый флаг',
      text: 'Он сшил его из бинта и простыни. Белый значил: можно остановиться.',
      hint: 'У древка зацепилась нить.'
    },
    {
      title: 'Радио',
      text: 'В эфире он говорил тише треска. Все слышали, никто не запомнил.',
      hint: 'Ребро звенит, как динамик.'
    },
    {
      title: 'Перемирие',
      text: 'Семь минут тишины. Он успел сосчитать их, а потом счёт потерялся.',
      hint: 'В груди будто считают до семи.'
    },
    {
      title: 'Посредник',
      text: 'Его позвали помирить стороны, но ни одна не хотела отдавать ему слово.',
      hint: 'На плече — след чужого сапога.'
    },
    {
      title: 'Имя',
      text: 'На каске было имя. Ветер сдул буквы одну за другой.',
      hint: 'Каска ещё помнит форму букв.'
    },
    {
      title: 'Рисунок',
      text: 'Кто-то нарисовал его с флагом и большим солнцем. Рисунок остался в кармане.',
      hint: 'В кармане шуршит бумага.'
    },
    {
      title: 'Приказ',
      text: '«Не стреляйте» — вот что он успел сказать перед тишиной.',
      hint: 'Челюсть застыла на первом слове.'
    },
    {
      title: 'Эхо',
      text: 'Теперь он сам — ветер. Он гложет кость, чтобы имя всё ещё звучало.',
      hint: 'Последняя искра дрожит у локтя.'
    }
  ];

  // Пороги накопленного обдувания: чем сильнее ветер, тем быстрее память всплывает.
  var THRESHOLDS = [8, 20, 34, 50, 68, 88, 110, 134];
  var ANCHORS = [
    { x: 52, y: 30 }, { x: 68, y: 42 }, { x: 37, y: 47 }, { x: 62, y: 59 },
    { x: 44, y: 65 }, { x: 73, y: 33 }, { x: 30, y: 34 }, { x: 54, y: 76 }
  ];

  var state = {
    dir: 0,
    strength: 38,
    integrity: 100,
    exposure: 0,
    unlocked: [false, false, false, false, false, false, false, false],
    collected: [false, false, false, false, false, false, false, false],
    sheltered: false,
    shelterSeconds: 0,
    gusts: 0,
    sound: true
  };

  var gustUntil = 0;
  var gustCooldown = 0;
  var listenCooldown = 0;
  var whisperTimer = null;
  var W = 1, H = 1, dpr = 1;
  var particles = [];
  var sparks = [];
  var spawnAcc = 0;
  var lastFrame = 0, uiTick = 0;
  var dragging = false;

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function collectedCount() {
    var n = 0;
    for (var i = 0; i < state.collected.length; i += 1) if (state.collected[i]) n += 1;
    return n;
  }
  function effectiveWind() {
    var base = state.sheltered ? state.strength * 0.12 : state.strength;
    var gust = performance.now() < gustUntil ? (state.sheltered ? 8 : 62) : 0;
    return base + gust;
  }
  function windVector() {
    var rad = state.dir * Math.PI / 180;
    return { x: Math.sin(rad), y: -Math.cos(rad) };
  }

  /* ── подсказки и дневник ───────────────────────────────────────── */

  function showWhisper(text) {
    whisperEl.textContent = text;
    whisperEl.classList.add('is-visible');
    if (whisperTimer) clearTimeout(whisperTimer);
    whisperTimer = setTimeout(function () {
      whisperEl.classList.remove('is-visible');
    }, 4200);
  }

  function renderJournal() {
    journalList.textContent = '';
    MEMORIES.forEach(function (memory, i) {
      var li = document.createElement('li');
      var found = state.collected[i];
      li.className = found ? 'is-found' : '';
      var title = document.createElement('b');
      title.textContent = found ? memory.title : '· · ·';
      var text = document.createElement('p');
      text.textContent = found ? memory.text : 'ещё в пыли';
      li.appendChild(title);
      li.appendChild(text);
      journalList.appendChild(li);
    });
    var count = collectedCount();
    journalProgress.textContent = count + ' из ' + MEMORIES.length + ' обрывков';
    ending.hidden = count < MEMORIES.length;
  }

  function createMote(i) {
    if (motesEl.querySelector('.mote[data-index="' + i + '"]')) return;
    var anchor = ANCHORS[i];
    var button = document.createElement('button');
    button.type = 'button';
    button.className = 'mote';
    button.dataset.index = String(i);
    button.textContent = '✧';
    button.title = 'Вспомнить: ' + MEMORIES[i].title;
    button.setAttribute('aria-label', 'Вспомнить обрывок: ' + MEMORIES[i].title);
    button.style.setProperty('--x', anchor.x + '%');
    button.style.setProperty('--y', anchor.y + '%');
    button.style.setProperty('--delay', (i * -0.53) + 's');
    button.addEventListener('click', function (event) {
      event.stopPropagation();
      collectMemory(i);
    });
    motesEl.appendChild(button);
  }

  function collectMemory(i) {
    if (state.collected[i]) return;
    audio.unlock();
    state.collected[i] = true;
    var mote = motesEl.querySelector('.mote[data-index="' + i + '"]');
    if (mote) mote.remove();
    sparkleAt(ANCHORS[i].x / 100 * W, ANCHORS[i].y / 100 * H, 18);
    audio.chime(i);
    renderJournal();
    updateUI();
    showWhisper(MEMORIES[i].text);
    if (collectedCount() === MEMORIES.length) {
      showWhisper('Имя прочитано. Ветер не смог стереть его — теперь его повторяют.');
    }
  }

  function checkUnlocks() {
    for (var i = 0; i < THRESHOLDS.length; i += 1) {
      if (!state.unlocked[i] && state.exposure >= THRESHOLDS[i]) {
        state.unlocked[i] = true;
        if (!state.collected[i]) {
          createMote(i);
          if (collectedCount() < MEMORIES.length) {
            showWhisper('В пыли блеснул обрывок. ' + MEMORIES[i].hint);
          }
        }
      }
    }
  }

  /* ── частицы ветра ─────────────────────────────────────────────── */

  function resize() {
    var rect = stage.getBoundingClientRect();
    W = Math.max(1, rect.width);
    H = Math.max(1, rect.height);
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function spawnDust(power) {
    if (particles.length > 240) return;
    var v = windVector();
    var speed = 55 + power * 2.6 + Math.random() * 45;
    var x, y;
    if (Math.abs(v.x) >= Math.abs(v.y)) {
      x = v.x >= 0 ? -14 : W + 14;
      y = Math.random() * H;
    } else {
      x = Math.random() * W;
      y = v.y >= 0 ? -14 : H + 14;
    }
    particles.push({
      x: x,
      y: y,
      vx: v.x * speed + (Math.random() - 0.5) * 24,
      vy: v.y * speed + (Math.random() - 0.5) * 24,
      life: 1.6 + Math.random() * 2.4,
      maxLife: 4,
      size: 0.6 + Math.random() * 1.4,
      grain: Math.random() < 0.3
    });
    if (particles.length > 260) particles.splice(0, particles.length - 260);
  }

  function sparkleAt(x, y, count) {
    for (var i = 0; i < count; i += 1) {
      sparks.push({
        x: x + (Math.random() - 0.5) * 36,
        y: y + (Math.random() - 0.5) * 30,
        vx: (Math.random() - 0.5) * 46,
        vy: -18 - Math.random() * 46,
        life: 0.7 + Math.random() * 0.9,
        maxLife: 1.6,
        size: 1 + Math.random() * 2.2
      });
    }
    if (sparks.length > 90) sparks.splice(0, sparks.length - 90);
  }

  function updateParticles(dt) {
    for (var i = particles.length - 1; i >= 0; i -= 1) {
      var p = particles[i];
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.life <= 0 || p.x < -60 || p.x > W + 60 || p.y < -60 || p.y > H + 60) {
        particles.splice(i, 1);
      }
    }
    for (var j = sparks.length - 1; j >= 0; j -= 1) {
      var s = sparks[j];
      s.life -= dt;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.vy += 8 * dt;
      if (s.life <= 0) sparks.splice(j, 1);
    }
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);

    for (var i = 0; i < particles.length; i += 1) {
      var p = particles[i];
      var alpha = clamp(p.life / p.maxLife, 0, 1) * (p.grain ? 0.42 : 0.3);
      if (p.grain) {
        ctx.fillStyle = 'rgba(220, 207, 180,' + alpha.toFixed(3) + ')';
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.strokeStyle = 'rgba(220, 207, 180,' + alpha.toFixed(3) + ')';
        ctx.lineWidth = p.size;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x - p.vx * 0.075, p.y - p.vy * 0.075);
        ctx.stroke();
      }
    }

    for (var j = 0; j < sparks.length; j += 1) {
      var s = sparks[j];
      var a = clamp(s.life / s.maxLife, 0, 1);
      ctx.fillStyle = 'rgba(239, 216, 159,' + (a * 0.9).toFixed(3) + ')';
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.size * a, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  /* ── управление ────────────────────────────────────────────────── */

  function setWind(dir, strength, fromPointer) {
    state.dir = ((dir % 360) + 360) % 360;
    state.strength = clamp(Math.round(strength), 0, 100);
    dirInput.value = String(Math.round(state.dir));
    strengthInput.value = String(state.strength);
    if (fromPointer) audio.unlock();
    updateUI();
  }

  function windFromPointer(event) {
    var rect = stage.getBoundingClientRect();
    var dx = event.clientX - rect.left - rect.width / 2;
    var dy = event.clientY - rect.top - rect.height / 2;
    var dir = Math.atan2(dy, -dx) * 180 / Math.PI;
    var reach = Math.min(rect.width, rect.height) * 0.52;
    var strength = Math.sqrt(dx * dx + dy * dy) / reach * 100;
    setWind(dir, clamp(strength, 5, 100), true);
  }

  function gust() {
    var now = performance.now();
    if (now < gustCooldown) return;
    audio.unlock();
    gustUntil = now + 1500;
    gustCooldown = now + 2600;
    state.gusts += 1;
    var power = state.sheltered ? 14 : 85;
    for (var i = 0; i < 26; i += 1) spawnDust(power);
    stage.classList.add('is-gusting');
    setTimeout(function () { stage.classList.remove('is-gusting'); }, 1500);
    audio.gust();
    updateUI();
  }

  function listen() {
    var now = performance.now();
    if (now < listenCooldown) return;
    listenCooldown = now + 1800;
    audio.unlock();
    audio.listen();
    state.exposure += 4;
    checkUnlocks();
    var i;
    for (i = 0; i < MEMORIES.length; i += 1) {
      if (state.unlocked[i] && !state.collected[i]) {
        showWhisper(MEMORIES[i].hint);
        return;
      }
    }
    if (collectedCount() === MEMORIES.length) {
      showWhisper('Больше ничего не спрятано. Имя звучит.');
    } else {
      showWhisper('Пока только ветер. Дай ему силу: набери скорость и подожди.');
    }
  }

  function toggleShelter() {
    state.sheltered = !state.sheltered;
    shelterBtn.setAttribute('aria-pressed', state.sheltered ? 'true' : 'false');
    shelterLabel.textContent = state.sheltered ? 'ОТКРЫТЬ' : 'УКРЫТЬ';
    stage.classList.toggle('is-sheltered', state.sheltered);
    showWhisper(state.sheltered
      ? 'Ткань легла на кость. Пыль успокоилась.'
      : 'Ткань убрана. Ветер снова работает.');
    updateUI();
  }

  function toggleSound() {
    state.sound = !state.sound;
    soundBtn.setAttribute('aria-pressed', state.sound ? 'true' : 'false');
    soundLabel.textContent = state.sound ? 'ЗВУК ВКЛ' : 'ЗВУК ВЫКЛ';
    audio.setEnabled(state.sound);
  }

  function reset() {
    state.strength = 38;
    state.dir = 0;
    state.integrity = 100;
    state.exposure = 0;
    state.sheltered = false;
    state.shelterSeconds = 0;
    state.gusts = 0;
    state.unlocked = [false, false, false, false, false, false, false, false];
    state.collected = [false, false, false, false, false, false, false, false];
    gustUntil = 0;
    gustCooldown = 0;
    listenCooldown = 0;
    particles.length = 0;
    sparks.length = 0;
    motesEl.textContent = '';
    stage.classList.remove('is-sheltered', 'is-gusting', 'is-fragile');
    shelterBtn.setAttribute('aria-pressed', 'false');
    shelterLabel.textContent = 'УКРЫТЬ';
    renderJournal();
    updateUI();
    showWhisper('Сначала. Пустошь помнит каждый порыв.');
  }

  function updateUI() {
    var count = collectedCount();
    var gusted = performance.now() < gustUntil;
    var power = state.strength;

    memoryValue.textContent = count + '/' + MEMORIES.length;
    memoryFill.style.width = (count / MEMORIES.length * 100).toFixed(1) + '%';
    memoryCountEl.textContent = String(count);
    integrityValue.textContent = Math.round(state.integrity) + '%';
    integrityFill.style.width = state.integrity.toFixed(1) + '%';
    windValue.textContent = power + '%';
    windFill.style.width = power + '%';
    gustCountEl.textContent = String(state.gusts);
    shelterCountEl.textContent = String(Math.floor(state.shelterSeconds));

    dirValue.textContent = Math.round(state.dir) + '°';
    strengthValue.textContent = state.strength + '%';
    compassArrow.style.setProperty('--dir', Math.round(state.dir) + 'deg');

    stage.classList.toggle('is-fragile', state.integrity < 45);

    if (count === MEMORIES.length) {
      moodText.textContent = 'Имя прочитано. Ветер стихает.';
      stageState.textContent = 'эхо';
      stageCaption.textContent = 'Тишина, в которой слышно имя.';
    } else if (state.sheltered) {
      moodText.textContent = 'Под тканью тихо. Кость восстанавливается.';
      stageState.textContent = 'укрыто';
      stageCaption.textContent = 'Пыль осела. Можно передохнуть.';
    } else if (gusted) {
      moodText.textContent = 'Порыв! Пыль срывается с кости.';
      stageState.textContent = 'порыв';
      stageCaption.textContent = 'Ветер гложет кость — и вспоминает.';
    } else if (power < 15) {
      moodText.textContent = 'Ветер почти стих. Память ждёт.';
      stageState.textContent = 'затишье';
      stageCaption.textContent = 'Затишье. Пыль лежит на костях.';
    } else if (power > 70) {
      moodText.textContent = 'Слишком сильно: кость сыплется, но память успевает всплыть.';
      stageState.textContent = 'сильно';
      stageCaption.textContent = 'Ветер сдирает с кости последние буквы.';
    } else {
      moodText.textContent = 'Ветер набирает силу. Слушай пыль.';
      stageState.textContent = 'тихо';
      stageCaption.textContent = 'Пустошь. Кость, флаг, ветер.';
    }
  }

  /* ── цикл ──────────────────────────────────────────────────────── */

  function frame(now) {
    var dt = lastFrame ? Math.min(0.05, (now - lastFrame) / 1000) : 0;
    lastFrame = now;

    var power = effectiveWind();
    if (state.sheltered) {
      state.integrity = clamp(state.integrity + dt * 4.2, 0, 100);
      state.shelterSeconds += dt;
    } else {
      state.integrity = clamp(state.integrity - power * dt * 0.022, 0, 100);
    }
    state.exposure += power * dt * 0.032;
    checkUnlocks();

    spawnAcc += (1.2 + power * 0.15) * dt;
    while (spawnAcc >= 1) {
      spawnDust(power);
      spawnAcc -= 1;
    }
    updateParticles(dt);
    draw();
    audio.setWind(power / 100, state.sheltered);

    if (now - uiTick > 130) {
      updateUI();
      uiTick = now;
    }
    requestAnimationFrame(frame);
  }

  // События
  dirInput.addEventListener('input', function () { setWind(Number(dirInput.value), state.strength); });
  strengthInput.addEventListener('input', function () { setWind(state.dir, Number(strengthInput.value)); });
  gustBtn.addEventListener('click', gust);
  listenBtn.addEventListener('click', listen);
  shelterBtn.addEventListener('click', toggleShelter);
  soundBtn.addEventListener('click', toggleSound);
  resetBtn.addEventListener('click', reset);

  stage.addEventListener('pointerdown', function (event) {
    if (event.target.closest('.mote')) return;
    dragging = true;
    try { stage.setPointerCapture(event.pointerId); } catch (e) { /* ignore */ }
    windFromPointer(event);
  });
  stage.addEventListener('pointermove', function (event) {
    if (dragging) windFromPointer(event);
  });
  stage.addEventListener('pointerup', function () { dragging = false; });
  stage.addEventListener('pointercancel', function () { dragging = false; });

  window.addEventListener('keydown', function (event) {
    var tag = event.target && event.target.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'BUTTON') return;
    if (event.code === 'Space') {
      event.preventDefault();
      gust();
    } else if (event.code === 'KeyE') {
      listen();
    } else if (event.code === 'KeyH') {
      toggleShelter();
    } else if (event.code === 'KeyR') {
      reset();
    } else if (event.code === 'ArrowLeft') {
      event.preventDefault();
      setWind(state.dir - 8, state.strength);
    } else if (event.code === 'ArrowRight') {
      event.preventDefault();
      setWind(state.dir + 8, state.strength);
    } else if (event.code === 'ArrowUp') {
      event.preventDefault();
      setWind(state.dir, state.strength + 6);
    } else if (event.code === 'ArrowDown') {
      event.preventDefault();
      setWind(state.dir, state.strength - 6);
    }
  });

  window.addEventListener('resize', resize);

  resize();
  renderJournal();
  updateUI();
  requestAnimationFrame(frame);
})();
