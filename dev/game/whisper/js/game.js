/* УШКО — game loop, metrics and UI.
   Everything is local: no microphone, no user text, no network requests.
   Voice comes from speechSynthesis; an optional recorded-sample map can be
   supplied by window.USHKO_SAMPLES without changing this file. */
(function () {
  'use strict';

  const DATA = window.USHKO_DATA;
  const AUDIO = window.USHKO_AUDIO;
  const VOICE = window.USHKO_VOICE;
  const SAVE_KEY = 'zqwy.whisper.save.v1';

  const RATE_MIN = 0.5;
  const BASE_COMFORT = {
    volume: { min: 0.30, max: 0.44 },
    tempo: { min: 0.80, max: 0.98 },
    pitch: { min: 0.86, max: 1.04 }
  };

  const $ = (id) => document.getElementById(id);
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

  function defaultSave() {
    return {
      version: 1,
      nights: {},
      achievements: [],
      heard: [],
      lastNight: 1,
      settings: { volume: 36, tempo: 35, pitch: 45, ear: 'left' }
    };
  }

  function loadSave() {
    const base = defaultSave();
    try {
      const raw = window.localStorage.getItem(SAVE_KEY);
      if (!raw) return base;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return base;
      return {
        version: 1,
        nights: parsed.nights && typeof parsed.nights === 'object' ? parsed.nights : {},
        achievements: Array.isArray(parsed.achievements) ? parsed.achievements : [],
        heard: Array.isArray(parsed.heard) ? parsed.heard : [],
        lastNight: clamp(Number(parsed.lastNight) || 1, 1, 5),
        settings: Object.assign(base.settings, parsed.settings || {})
      };
    } catch (err) {
      return base;
    }
  }

  let save = loadSave();

  function persist() {
    try { window.localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (err) { /* private mode */ }
  }

  const S = {
    screen: 'intro',
    backTo: 'intro',
    night: null,
    calm: 0,
    fear: 0,
    attention: 100,
    holding: false,
    finished: false,
    phraseIdx: 0,
    speakToken: 0,
    targetEar: 'left',
    zeroAttentionMs: 0,
    qualitySum: 0,
    qualityTicks: 0,
    maxFear: 0,
    usedEars: {},
    lastTs: 0,
    raf: 0,
    wordEls: [],
    wordRanges: [],
    fallbackTimer: 0,
    silentMode: false,
    silentWarned: false
  };

  function selectedEar() {
    return document.querySelector('.ear-btn.is-active')?.dataset.ear || 'left';
  }

  function slider(name) { return $(name + 'Slider'); }

  function values() {
    return {
      volume: Number(slider('volume').value) / 100,
      tempo: RATE_MIN + Number(slider('tempo').value) / 100,
      pitch: RATE_MIN + Number(slider('pitch').value) / 100
    };
  }

  function unlockedNight() {
    let unlocked = 1;
    for (let i = 1; i <= DATA.nights.length; i += 1) {
      if (save.nights[i] && save.nights[i].stars > 0) unlocked = Math.max(unlocked, i + 1);
    }
    return Math.min(unlocked, DATA.nights.length);
  }

  function renderIntroProgress() {
    $('introProgress').textContent = save.achievements.length
      ? 'Пройдено ночей: ' + Object.keys(save.nights).length + ' · достижений: ' + save.achievements.length
      : 'Прогресс сохраняется в этом браузере.';
  }

  function showScreen(name) {
    if (name !== 'game') endWhisper();
    document.querySelectorAll('.screen').forEach((el) => el.classList.add('hidden'));
    $(name + 'Screen')?.classList.remove('hidden');
    S.screen = name;
    if (name === 'intro') renderIntroProgress();
  }

  /* ───────────────────────── comfort zones ───────────────────────── */

  function comfort(now) {
    const width = (S.night && S.night.zoneWidth) || 0.12;
    const half = width / 2;
    const keys = ['volume', 'tempo', 'pitch'];
    const out = {};
    keys.forEach((key) => {
      const base = BASE_COMFORT[key];
      const center = (base.min + base.max) / 2;
      out[key] = {
        min: clamp(center - half, 0.12, 0.88),
        max: clamp(center + half, 0.2, 0.94)
      };
    });
    if (S.night && S.night.drift) {
      const t = now / 2200;
      const shift = {
        volume: 0.055 * Math.sin(t + S.phraseIdx * 0.8),
        tempo: 0.045 * Math.cos(t * 0.9 + S.phraseIdx * 0.5),
        pitch: 0.05 * Math.sin(t * 1.15 + S.phraseIdx * 0.35)
      };
      keys.forEach((key) => {
        const minBound = key === 'volume' ? 0.14 : 0.58;
        const maxBound = key === 'volume' ? 0.82 : 1.28;
        out[key].min = clamp(out[key].min + shift[key], minBound, maxBound - width);
        out[key].max = clamp(out[key].max + shift[key], minBound + width, maxBound);
      });
    }
    return out;
  }

  function toSliderValue(key, value) {
    if (key === 'volume') return clamp(Math.round(value * 100), 0, 100);
    return clamp(Math.round((value - RATE_MIN) * 100), 0, 100);
  }

  function renderZones() {
    const zones = comfort(performance.now());
    const params = ['volume', 'tempo', 'pitch'];
    params.forEach((key) => {
      const el = $(key + 'Zone');
      const row = $(key + 'Row');
      if (!el || !row) return;
      const active = S.night && S.night.mechanics.indexOf(key) !== -1;
      row.classList.toggle('is-locked', !active);
      if (!active) { el.style.width = '0'; return; }
      const left = toSliderValue(key, zones[key].min);
      const right = toSliderValue(key, zones[key].max);
      el.style.left = left + '%';
      el.style.width = Math.max(2, right - left) + '%';
    });
  }

  function renderSliderLabels() {
    const v = values();
    $('volumeValue').textContent = Math.round(v.volume * 100) + '%';
    $('tempoValue').textContent = v.tempo.toFixed(2) + '×';
    $('pitchValue').textContent = v.pitch.toFixed(2);
  }

  function saveSettings() {
    save.settings = {
      volume: Number(slider('volume').value),
      tempo: Number(slider('tempo').value),
      pitch: Number(slider('pitch').value),
      ear: selectedEar()
    };
    persist();
  }

  function applySettings() {
    slider('volume').value = clamp(Number(save.settings.volume), 0, 100);
    slider('tempo').value = clamp(Number(save.settings.tempo), 0, 100);
    slider('pitch').value = clamp(Number(save.settings.pitch), 0, 100);
    document.querySelectorAll('.ear-btn').forEach((btn) => {
      const active = btn.dataset.ear === save.settings.ear;
      btn.classList.toggle('is-active', active);
      btn.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
    AUDIO.setEar(selectedEar());
    renderSliderLabels();
  }

  /* ───────────────────────── nights ───────────────────────── */

  function renderNights() {
    const grid = $('nightsGrid');
    grid.textContent = '';
    const unlocked = unlockedNight();
    DATA.nights.forEach((night) => {
      const locked = night.id > unlocked;
      const record = save.nights[night.id] || { stars: 0 };
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'night-card';
      btn.disabled = locked;

      const number = document.createElement('span');
      number.className = 'night-number';
      number.textContent = night.kicker + (locked ? ' · ЗАКРЫТА' : '');
      const name = document.createElement('span');
      name.className = 'night-name';
      name.textContent = night.title;
      const desc = document.createElement('span');
      desc.className = 'night-desc';
      desc.textContent = night.hint;
      const stars = document.createElement('span');
      stars.className = 'night-stars';
      stars.textContent = '★'.repeat(record.stars || 0) + '☆'.repeat(3 - (record.stars || 0));
      btn.append(number, name, desc, stars);
      btn.addEventListener('click', () => startNight(night.id));
      grid.appendChild(btn);
    });
  }

  function startNight(id) {
    const night = DATA.nights.find((n) => n.id === id);
    if (!night || id > unlockedNight()) return;
    S.night = night;
    S.calm = 0;
    S.fear = 0;
    S.attention = 100;
    S.holding = false;
    S.finished = false;
    S.phraseIdx = 0;
    S.zeroAttentionMs = 0;
    S.qualitySum = 0;
    S.qualityTicks = 0;
    S.maxFear = 0;
    S.usedEars = {};
    S.targetEar = 'left';
    S.silentMode = false;
    S.silentWarned = false;

    $('nightKicker').textContent = night.kicker;
    $('nightTitle').textContent = night.title;
    $('hintLine').textContent = night.hint;

    const usesEar = night.mechanics.indexOf('ear') !== -1;
    document.querySelectorAll('.ear-btn').forEach((btn) => { btn.disabled = !usesEar; });
    ['volume', 'tempo', 'pitch'].forEach((key) => {
      const active = night.mechanics.indexOf(key) !== -1;
      slider(key).disabled = !active;
    });

    applySettings();
    renderZones();
    setTargetEar();
    renderSubtitleIntro();
    updateUI(performance.now());
    showScreen('game');

    save.lastNight = id;
    persist();
    /* finish() cancels the frame loop; every new night must restart it. */
    if (!S.raf) {
      S.lastTs = performance.now();
      S.raf = window.requestAnimationFrame(tick);
    }
  }

  /* ───────────────────────── speech ───────────────────────── */

  function renderSubtitleIntro() {
    $('subtitleSource').textContent = DATA.phrases[0].source;
    $('subtitles').textContent = 'Нажми «Шептать», чтобы Ушко услышало первое слово.';
    S.wordEls = [];
    S.wordRanges = [];
  }

  function renderSubtitle(phrase) {
    const box = $('subtitles');
    box.textContent = '';
    S.wordEls = [];
    S.wordRanges = [];
    const parts = phrase.text.split(/(\s+)/);
    let cursor = 0;
    parts.forEach((part) => {
      if (/^\s+$/.test(part)) { cursor += part.length; return; }
      const span = document.createElement('span');
      span.className = 'word';
      span.textContent = part;
      box.appendChild(span);
      S.wordRanges.push({ start: cursor, end: cursor + part.length });
      S.wordEls.push(span);
      cursor += part.length;
    });
    $('subtitleSource').textContent = phrase.source;
  }

  function highlightWord(index) {
    S.wordEls.forEach((el, i) => el.classList.toggle('spoken', i === index));
  }

  function startFallbackHighlight(rate) {
    window.clearTimeout(S.fallbackTimer);
    let i = 0;
    const step = () => {
      if (!S.holding || !S.wordEls.length) return;
      highlightWord(i);
      i += 1;
      if (i < S.wordEls.length) {
        const delay = S.silentMode ? 200 / rate : 330 / rate;
        S.fallbackTimer = window.setTimeout(step, Math.max(140, delay));
      }
    };
    S.fallbackTimer = window.setTimeout(step, 180);
  }

  function setTargetEar() {
    const usesEar = S.night && S.night.mechanics.indexOf('ear') !== -1;
    if (usesEar) {
      S.targetEar = (S.phraseIdx + S.night.id) % 2 === 0 ? 'left' : 'right';
      $('earHint').textContent = 'Ушко слушает: ' + (S.targetEar === 'left' ? 'ЛЕВОЕ ухо' : 'ПРАВОЕ ухо');
      $('ushkoSvg').classList.remove('target-left', 'target-right');
      $('ushkoSvg').classList.add('target-' + S.targetEar);
    } else {
      S.targetEar = selectedEar();
      $('earHint').textContent = 'Ушко слушает оба уха.';
      $('ushkoSvg').classList.remove('target-left', 'target-right');
    }
  }

  function rememberPhrase(id) {
    if (save.heard.indexOf(id) === -1) {
      save.heard.push(id);
      persist();
    }
  }

  function warnSilent(message) {
    if (S.silentWarned) return;
    S.silentWarned = true;
    S.silentMode = true;
    $('statusLine').textContent = message + ' Продолжаем без голоса — читай субтитры.';
  }

  function speakPhrase() {
    if (!S.holding || S.finished || S.screen !== 'game') return;
    const phrase = DATA.phrases[S.phraseIdx % DATA.phrases.length];
    const myToken = ++S.speakToken;
    let advanced = false;
    rememberPhrase(phrase.id);
    setTargetEar();
    renderSubtitle(phrase);
    AUDIO.setEar(selectedEar());
    AUDIO.breath();

    const advance = (delay) => {
      if (advanced) return;
      advanced = true;
      window.setTimeout(() => {
        if (myToken === S.speakToken && S.holding && !S.finished) {
          S.phraseIdx += 1;
          speakPhrase();
        }
      }, delay);
    };

    const v = values();
    const handle = VOICE.speak({
      id: phrase.id,
      text: phrase.text,
      volume: v.volume,
      rate: v.tempo,
      pitch: v.pitch,
      onBoundary: (charIndex) => {
        if (myToken !== S.speakToken) return;
        window.clearTimeout(S.fallbackTimer);
        let index = S.wordRanges.findIndex((r) => charIndex >= r.start && charIndex < r.end);
        if (index < 0) index = S.wordRanges.length - 1;
        if (index >= 0) highlightWord(index);
      },
      onEnd: () => {
        if (myToken !== S.speakToken || !S.holding || S.finished) return;
        advance(280);
      },
      /* A browser may refuse speech even after a gesture (no Russian voice,
         headless mode, iOS restrictions). Keep the game playable: subtitles
         and the metric loop still run, and the reason stays on screen. */
      onError: (message) => {
        if (myToken !== S.speakToken) return;
        warnSilent(message);
        advance(1600);
      }
    });
    if (!handle) {
      warnSilent('Этот браузер не умеет говорить вслух. Попробуй Chrome, Edge или Firefox.');
      advance(1600);
    }
    startFallbackHighlight(v.tempo);
  }

  function beginWhisper() {
    if (S.screen !== 'game' || S.finished || S.holding) return;
    if (!S.silentWarned) $('statusLine').textContent = '';
    AUDIO.unlock();
    AUDIO.start();
    AUDIO.setEar(selectedEar());
    S.holding = true;
    $('whisperBtn').classList.add('is-holding');
    speakPhrase();
  }

  function endWhisper() {
    S.holding = false;
    S.speakToken += 1;
    VOICE.cancel();
    AUDIO.stop();
    window.clearTimeout(S.fallbackTimer);
    $('whisperBtn').classList.remove('is-holding');
  }

  /* ───────────────────────── loop ───────────────────────── */

  function updateUI(now) {
    $('calmBar').style.width = S.calm.toFixed(1) + '%';
    $('fearBar').style.width = S.fear.toFixed(1) + '%';
    $('attentionBar').style.width = S.attention.toFixed(1) + '%';
    $('calmValue').textContent = Math.round(S.calm);
    $('fearValue').textContent = Math.round(S.fear);
    $('attentionValue').textContent = Math.round(S.attention);

    const svg = $('ushkoSvg');
    let mood = 'Ушко смотрит на тебя большими глазами.';
    let state = '';
    if (S.fear > 62) { mood = 'Ай! Ушко испугалось и прижало ушки!'; state = 'scared'; }
    else if (S.calm > 92) { mood = 'Ушко свернулся клубочком и уснул.'; state = 'asleep'; }
    else if (S.calm > 55) { mood = 'Ушко мурчит и машет хвостиком.'; state = 'calm'; }
    else if (S.holding) { mood = 'Ушко навострил ушки и слушает.'; state = 'listening'; }
    else if (S.attention < 35) { mood = 'Ушко скучает... позови его шёпотом.'; }
    $('moodLine').textContent = mood;
    const targetClass = S.night && S.night.mechanics.indexOf('ear') !== -1 ? 'target-' + S.targetEar : '';
    svg.setAttribute('class', ['ushko-svg', state, targetClass].filter(Boolean).join(' '));

    renderZones(now);
  }

  function evaluate(dt, now) {
    const v = values();
    const zones = comfort(now);
    const activeParams = S.night.mechanics.filter((m) => m !== 'ear');
    let scoreSum = 0;
    let scare = 0;
    let neglect = 0;

    activeParams.forEach((key) => {
      const zone = zones[key];
      const value = v[key];
      const span = Math.max(0.06, zone.max - zone.min);
      let dist = 0;
      let harsh = false;
      if (value > zone.max) { dist = value - zone.max; harsh = true; }
      else if (value < zone.min) { dist = zone.min - value; harsh = false; }
      const score = dist === 0 ? 1 : Math.max(0, 1 - dist / (span * 1.6));
      scoreSum += score;
      if (harsh) scare += 1 - score;
      else if (dist > 0) neglect += 1 - score;
    });

    const avgScore = activeParams.length ? scoreSum / activeParams.length : 1;
    const usesEar = S.night.mechanics.indexOf('ear') !== -1;
    const earOk = !usesEar || selectedEar() === S.targetEar;
    if (usesEar && S.holding) S.usedEars[selectedEar()] = true;

    const nightFactor = 1 + (S.night.id - 1) * 0.08;
    const driftPenalty = S.night.drift ? 1.15 : 1;

    if (S.holding) {
      if (earOk && avgScore > 0.9) {
        S.calm += 12 * dt;
        S.fear = Math.max(0, S.fear - 6 * dt);
        S.attention = Math.min(100, S.attention + 5 * dt);
        S.qualitySum += avgScore;
        S.qualityTicks += 1;
      } else {
        if (!earOk) {
          neglect += 1.6;
          S.fear += 10 * dt * nightFactor;
        }
        S.fear += scare * 24 * dt * nightFactor * driftPenalty;
        S.attention -= neglect * 18 * dt * nightFactor;
        S.calm -= (scare + neglect) * 5 * dt * nightFactor;
        if (avgScore > 0.72 && earOk) {
          S.qualitySum += avgScore * 0.35;
          S.qualityTicks += 0.35;
        }
      }
    } else {
      S.fear = Math.max(0, S.fear - 7 * dt);
      S.attention = Math.min(100, S.attention + 2.2 * dt);
      S.calm = Math.max(0, S.calm - 2.2 * dt * nightFactor);
    }

    S.calm = clamp(S.calm, 0, 100);
    S.fear = clamp(S.fear, 0, 100);
    S.attention = clamp(S.attention, 0, 100);
    S.maxFear = Math.max(S.maxFear, S.fear);
    S.zeroAttentionMs = S.attention <= 0.5 ? S.zeroAttentionMs + dt * 1000 : 0;

    const attentionLimit = S.night.id >= 4 ? 2600 : 3200;
    if (S.calm >= 100) finish(true);
    else if (S.fear >= 100) finish(false, 'Ушко испугалось. Сделай голос тише, ниже и медленнее.');
    else if (S.zeroAttentionMs >= attentionLimit) finish(false, 'Ушко отвернулось. Лови зону комфорта и правильное ухо.');
  }

  function tick(ts) {
    S.raf = window.requestAnimationFrame(tick);
    if (S.screen !== 'game' || S.finished || !S.night) { S.lastTs = ts; return; }
    const dt = Math.min(0.05, Math.max(0, (ts - S.lastTs) / 1000));
    S.lastTs = ts;
    evaluate(dt, ts);
    updateUI(ts);
  }

  /* ───────────────────────── results ───────────────────────── */

  function addAchievement(id) {
    if (save.achievements.indexOf(id) !== -1) return;
    save.achievements.push(id);
  }

  function quality() {
    return S.qualityTicks ? S.qualitySum / S.qualityTicks : 0;
  }

  function starsFor(q, fear) {
    if (fear > 45 || q < 0.62) return 1;
    if (fear < 16 && q > 0.93) return 3;
    return 2;
  }

  function finish(win, reason) {
    if (S.finished) return;
    S.finished = true;
    endWhisper();
    window.cancelAnimationFrame(S.raf);
    S.raf = 0;

    const q = quality();
    const stars = win ? starsFor(q, S.maxFear) : 0;
    if (win) {
      const old = save.nights[S.night.id] || { stars: 0 };
      save.nights[S.night.id] = {
        stars: Math.max(old.stars || 0, stars),
        bestFear: Math.min(old.bestFear === undefined ? 100 : old.bestFear, Math.round(S.maxFear)),
        bestQuality: Math.max(old.bestQuality || 0, Number(q.toFixed(2)))
      };
      if (S.night.id === 1) addAchievement('first-calm');
      if (stars === 3) addAchievement('perfect');
      if (S.maxFear <= 2) addAchievement('no-fear');
      if (S.night.mechanics.indexOf('ear') !== -1 && S.usedEars.left && S.usedEars.right) addAchievement('both-ears');
      if (DATA.nights.every((n) => save.nights[n.id] && save.nights[n.id].stars > 0)) addAchievement('five-nights');
      persist();
    }

    $('resultKicker').textContent = win ? S.night.kicker + ' · УДАЧНО' : S.night.kicker + ' · НЕ ПОЛУЧИЛОСЬ';
    $('resultTitle').textContent = win ? 'Ушко уснуло' : 'Ушко проснулось';
    $('resultText').textContent = win
      ? 'Ты нашёл зону комфорта и читал так, что стало тепло. Остальные ночи ждут.'
      : (reason || 'Попробуй ещё раз, только очень тихо.');
    $('resultStars').textContent = win ? '★'.repeat(stars) + '☆'.repeat(3 - stars) : '☆☆☆';
    $('resultStats').textContent = '';
    [
      'Спокойствие ' + Math.round(S.calm),
      'Испуг ' + Math.round(S.maxFear),
      'Качество ' + Math.round(q * 100) + '%'
    ].forEach((text) => {
      const span = document.createElement('span');
      span.textContent = text;
      $('resultStats').appendChild(span);
    });

    const hasNext = win && S.night.id < DATA.nights.length;
    $('nextNightBtn').classList.toggle('hidden', !hasNext);
    if (hasNext) $('nextNightBtn').dataset.next = String(S.night.id + 1);
    showScreen('result');
  }

  /* ───────────────────────── codex ───────────────────────── */

  function renderCodex() {
    const list = $('heardList');
    list.textContent = '';
    if (!save.heard.length) {
      const li = document.createElement('li');
      li.textContent = 'Здесь появятся строчки, которые уже шептали Ушку.';
      list.appendChild(li);
    }
    save.heard.forEach((id) => {
      const phrase = DATA.phrases.find((p) => p.id === id);
      if (!phrase) return;
      const li = document.createElement('li');
      li.textContent = '«' + phrase.text + '»';
      const small = document.createElement('small');
      small.textContent = 'из ' + phrase.source;
      li.appendChild(small);
      list.appendChild(li);
    });

    const achievements = $('achievementList');
    achievements.textContent = '';
    DATA.achievements.forEach((a) => {
      const li = document.createElement('li');
      const unlocked = save.achievements.indexOf(a.id) !== -1;
      li.classList.toggle('unlocked', unlocked);
      const b = document.createElement('b');
      b.textContent = (unlocked ? '★ ' : '☆ ') + a.title;
      const small = document.createElement('small');
      small.textContent = a.desc;
      li.append(b, small);
      achievements.appendChild(li);
    });
  }

  function openCodex(from) {
    S.backTo = from;
    renderCodex();
    showScreen('codex');
  }

  /* ───────────────────────── bindings ───────────────────────── */

  function bind() {
    $('startBtn').addEventListener('click', () => {
      AUDIO.unlock();
      startNight(Math.min(save.lastNight || 1, unlockedNight()));
    });
    $('nightsBtn').addEventListener('click', () => { renderNights(); showScreen('nights'); });
    $('achievementsBtn').addEventListener('click', () => openCodex('intro'));
    $('codexBtn').addEventListener('click', () => openCodex('game'));

    document.querySelectorAll('[data-go]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const target = btn.dataset.go === 'back' ? S.backTo : btn.dataset.go;
        if (target === 'game' && S.night) showScreen('game');
        else if (target === 'nights') { renderNights(); showScreen('nights'); }
        else showScreen(target);
      });
    });

    $('resetBtn').addEventListener('click', () => {
      if (!window.confirm('Сбросить ночи, звёзды и достижения?')) return;
      try { window.localStorage.removeItem(SAVE_KEY); } catch (err) { /* ignore */ }
      window.location.reload();
    });

    $('stopBtn').addEventListener('click', () => {
      endWhisper();
      $('statusLine').textContent = 'Шёпот остановлен. Ушко отдыхает.';
    });

    document.querySelectorAll('.ear-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.ear-btn').forEach((b) => {
          const active = b === btn;
          b.classList.toggle('is-active', active);
          b.setAttribute('aria-pressed', active ? 'true' : 'false');
        });
        AUDIO.setEar(btn.dataset.ear);
        saveSettings();
        if (S.night && S.night.mechanics.indexOf('ear') === -1) setTargetEar();
      });
    });

    ['volume', 'tempo', 'pitch'].forEach((key) => {
      slider(key).addEventListener('input', () => {
        renderSliderLabels();
        renderZones(performance.now());
        saveSettings();
      });
    });

    const whisperBtn = $('whisperBtn');
    whisperBtn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      beginWhisper();
      const release = () => { endWhisper(); window.removeEventListener('pointerup', release); window.removeEventListener('pointercancel', release); };
      window.addEventListener('pointerup', release, { once: true });
      window.addEventListener('pointercancel', release, { once: true });
    });
    whisperBtn.addEventListener('keydown', (e) => {
      if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); if (!e.repeat) beginWhisper(); }
    });
    whisperBtn.addEventListener('keyup', (e) => {
      if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); endWhisper(); }
    });
    whisperBtn.addEventListener('blur', endWhisper);

    document.addEventListener('keydown', (e) => {
      if (e.key !== ' ' || e.repeat) return;
      const tag = e.target && e.target.tagName;
      if (tag === 'INPUT' || tag === 'BUTTON' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (S.screen !== 'game') return;
      e.preventDefault();
      beginWhisper();
    });
    document.addEventListener('keyup', (e) => {
      if (e.key !== ' ') return;
      const tag = e.target && e.target.tagName;
      if (tag === 'INPUT' || tag === 'BUTTON' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      endWhisper();
    });

    $('retryBtn').addEventListener('click', () => startNight(S.night.id));
    $('resultNightsBtn').addEventListener('click', () => { renderNights(); showScreen('nights'); });
    $('nextNightBtn').addEventListener('click', () => {
      const next = Number($('nextNightBtn').dataset.next || S.night.id + 1);
      startNight(next);
    });

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) endWhisper();
    });
    window.addEventListener('beforeunload', () => VOICE.cancel());
  }

  bind();
  applySettings();
  renderNights();
  renderCodex();
  renderIntroProgress();
  S.lastTs = performance.now();
  S.raf = window.requestAnimationFrame(tick);
})();
