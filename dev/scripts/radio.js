/*
 * 24/7 radio service.
 *
 * The broadcast is anchored to a fixed epoch and to stable track ids, never to
 * generatedAt, the build number or catalog order. A whole day is one ordered
 * sequence: tracks run one after another from 00:00 UTC to the next 00:00 UTC,
 * then the next cycle begins. The listener cannot pick a track — the player is
 * locked to the program while the broadcast is active.
 */
(() => {
  "use strict";

  const CATALOG_URL = new URL("../../data/music-catalog.json", document.baseURI).href;
  const STORAGE_ACTIVE = "zqwy.radio.active.v1";
  const EPOCH_MS = Date.UTC(2020, 0, 1);
  const CYCLE_MS = 24 * 60 * 60 * 1000;
  const BLOCK_MS = 4 * 60 * 60 * 1000;
  const BLOCKS_PER_DAY = CYCLE_MS / BLOCK_MS;
  const TICK_MS = 1000;
  // Do not fight the audio clock every second: a small correction sounds like
  // a rewind. Correct only a substantial drift, only forward, and rarely.
  const RESYNC_MS = 20000;
  const RESYNC_INTERVAL_MS = 30000;
  const MAX_CACHED_PROGRAMS = 3;

  const TEXT = {
    ru: {
      service: "радио", heading: "Круглосуточный эфир",
      hint: "Непрерывная программа идёт от фиксированной точки 2020-01-01 UTC. Треки следуют строго один за другим; загрузка сайта не сбрасывает эфир.",
      play: "Включить эфир", pause: "Пауза эфира",
      onAir: "В эфире", paused: "Эфир на паузе", off: "Эфир выключен",
      schedule: "Программа дня", now: "Сейчас", next: "Далее",
      prevBlock: "← Раньше", nowBlock: "К эфиру", nextBlock: "Позже →",
      day: "Весь день", block: "Блок",
      empty: "Нет доступных треков", unavailable: "Каталог недоступен",
      locked: "Плеер закреплён за эфиром", trackNumber: "Трек",
      blocks: [
        { title: "Ночной эфир", description: "Тихая часть программы: спокойные записи для ночного прослушивания." },
        { title: "Утренний эфир", description: "Мягкое начало дня без резких переходов между треками." },
        { title: "Дневной поток", description: "Непрерывная музыкальная дорожка на рабочие часы." },
        { title: "После полудня", description: "Более плотная подборка из всего архива." },
        { title: "Вечерний эфир", description: "Медленное завершение дня и длинные композиции." },
        { title: "Прайм-тайм", description: "Основной эфир по той же фиксированной программе." },
      ],
    },
    en: {
      service: "radio", heading: "24/7 broadcast",
      hint: "One continuous program runs from the fixed 2020-01-01 UTC epoch. Tracks follow one another strictly; site updates never reset the air.",
      play: "Start broadcast", pause: "Pause broadcast",
      onAir: "On air", paused: "Broadcast paused", off: "Broadcast off",
      schedule: "Day program", now: "Now", next: "Next",
      prevBlock: "← Earlier", nowBlock: "To live", nextBlock: "Later →",
      day: "Full day", block: "Block",
      empty: "No tracks available", unavailable: "Catalog unavailable",
      locked: "Player locked to the broadcast", trackNumber: "Track",
      blocks: [
        { title: "Night air", description: "The quiet part of the program: calm recordings for late listening." },
        { title: "Morning air", description: "A gentle start to the day with smooth transitions." },
        { title: "Daytime stream", description: "A continuous soundtrack for working hours." },
        { title: "Afternoon", description: "A denser selection drawn from the whole archive." },
        { title: "Evening air", description: "A slower end to the day with longer tracks." },
        { title: "Prime time", description: "The main air, chosen by the same fixed program." },
      ],
    },
  };

  const state = {
    catalog: null,
    pool: [],
    poolKey: "",
    programs: new Map(),
    active: false,
    position: null,
    switching: false,
    timer: 0,
    lastListKey: "",
    lastActiveIndex: -1,
    followCurrent: true,
    lastResyncAt: 0,
  };

  const ui = {};

  function player() {
    return window.zqwyPlayer || null;
  }

  function lang() {
    return document.documentElement.lang === "en" ? "en" : "ru";
  }

  function text() {
    return TEXT[lang()];
  }

  function clock(ms) {
    try {
      return new Date(ms).toLocaleTimeString(lang() === "en" ? "en-GB" : "ru-RU", {
        hour: "2-digit", minute: "2-digit",
      });
    } catch {
      return "";
    }
  }

  function hash(value) {
    let result = 0x811c9dc5; // FNV-1a, identical in every browser and release
    for (let i = 0; i < value.length; i++) {
      result ^= value.charCodeAt(i);
      result = Math.imul(result, 0x01000193) >>> 0;
    }
    return result >>> 0;
  }

  function captureUi() {
    ui.play = document.getElementById("radioPlay");
    ui.playLabel = document.getElementById("radioPlayLabel");
    ui.status = document.getElementById("radioStatus");
    ui.lock = document.getElementById("radioLock");
    ui.blockTime = document.getElementById("radioBlockTime");
    ui.blockTitle = document.getElementById("radioBlockTitle");
    ui.blockDescription = document.getElementById("radioBlockDescription");
    ui.trackTitle = document.getElementById("radioTrackTitle");
    ui.nextTrack = document.getElementById("radioNextTrack");
    ui.progressFill = document.getElementById("radioProgressFill");
    ui.program = document.getElementById("radioProgram");
    ui.programMeta = document.getElementById("radioProgramMeta");
    ui.programPrev = document.getElementById("radioProgramPrev");
    ui.programNow = document.getElementById("radioProgramNow");
    ui.programNext = document.getElementById("radioProgramNext");
    ui.empty = document.getElementById("radioEmpty");
  }

  function buildPool() {
    const pool = [];
    for (const album of state.catalog?.albums || []) {
      for (const track of album.tracks || []) {
        if (!track?.path) continue;
        const duration = Number(track.duration);
        pool.push({
          id: `${album.id}::${track.path}`,
          title: track.title || track.path,
          albumTitle: album.title || "",
          path: track.path,
          formats: track.formats,
          duration: Number.isFinite(duration) && duration > 0 ? duration : 180,
        });
      }
    }
    pool.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    state.pool = pool;
    state.poolKey = `${pool.length}:${pool[0]?.id || ""}:${pool[pool.length - 1]?.id || ""}`;
    state.programs.clear();
    state.lastListKey = "";
    return pool;
  }

  // One deterministic 24-hour sequence. The cycle number comes only from the
  // fixed epoch; rebuilding the catalog cannot move a single boundary.
  function programFor(cycle) {
    const key = `${state.poolKey}|${cycle}`;
    if (state.programs.has(key)) return state.programs.get(key);
    if (!state.pool.length) return [];

    const ranked = state.pool
      .map((item) => ({ item, score: hash(`${item.id}|${cycle}`) }))
      .sort((a, b) => a.score - b.score || (a.item.id < b.item.id ? -1 : a.item.id > b.item.id ? 1 : 0));

    const program = [];
    let cursor = 0;
    let pass = 0;
    while (cursor < CYCLE_MS && pass < 6) {
      for (const entry of ranked) {
        if (cursor >= CYCLE_MS) break;
        const durationMs = Math.min(entry.item.duration * 1000, CYCLE_MS - cursor);
        program.push({
          ...entry.item,
          index: program.length,
          startMs: cursor,
          endMs: cursor + durationMs,
        });
        cursor += durationMs;
      }
      pass++;
    }
    if (program.length) program[program.length - 1].endMs = CYCLE_MS;

    state.programs.set(key, program);
    while (state.programs.size > MAX_CACHED_PROGRAMS) {
      state.programs.delete(state.programs.keys().next().value);
    }
    return program;
  }

  function positionAt(now) {
    const elapsed = Math.max(0, now - EPOCH_MS);
    const cycle = Math.floor(elapsed / CYCLE_MS);
    const cycleStart = EPOCH_MS + cycle * CYCLE_MS;
    const offsetMs = now - cycleStart;
    const program = programFor(cycle);

    let index = 0;
    if (program.length) {
      let low = 0;
      let high = program.length - 1;
      while (low < high) {
        const mid = (low + high) >> 1;
        if (offsetMs < program[mid].endMs) high = mid;
        else low = mid + 1;
      }
      index = low;
    }
    const item = program[index] || null;
    const blockIndex = Math.min(BLOCKS_PER_DAY - 1, Math.floor(offsetMs / BLOCK_MS));
    return { now, cycle, cycleStart, offsetMs, program, index, item, blockIndex };
  }

  function albumFor(position) {
    return {
      id: `radio-cycle-${position.cycle}`,
      title: `${text().service} · ${clock(position.cycleStart)}`,
      cover: null,
      tracks: position.program.map((entry) => ({
        title: entry.title,
        path: entry.path,
        formats: entry.formats,
        duration: (entry.endMs - entry.startMs) / 1000,
      })),
    };
  }

  // Keep the whole day in the DOM so it can actually be scrolled. The old
  // version rendered one 4-hour block and called scrollIntoView() every tick,
  // which made manual scrolling impossible.
  function scrollProgramTo(index) {
    if (!ui.program) return;
    const row = ui.program.querySelector(`[data-radio-index="${index}"]`);
    if (!row) return;
    const top = row.offsetTop - ui.program.clientHeight / 2 + row.offsetHeight / 2;
    ui.program.scrollTop = Math.max(0, top);
  }

  function indexAtOffset(position, offsetMs) {
    const target = Math.max(0, Math.min(CYCLE_MS - 1, offsetMs));
    const entry = position.program.find((item) => item.endMs > target) || position.program[position.program.length - 1];
    return entry ? entry.index : 0;
  }

  function renderProgram(position, copy) {
    if (!ui.program) return;
    // One rebuild per cycle/language/catalog, not once per block. Scrolling
    // then never destroys the rows under the pointer.
    const key = `${position.cycle}|${lang()}|${state.poolKey}`;
    if (state.lastListKey !== key) {
      state.lastListKey = key;
      const fragment = document.createDocumentFragment();
      position.program.forEach((entry) => {
        const row = document.createElement("div");
        row.className = "radio-program-item";
        if (entry.startMs % BLOCK_MS === 0) row.classList.add("is-block-start");
        row.dataset.radioIndex = String(entry.index);

        const time = document.createElement("span");
        time.className = "radio-program-time";
        time.textContent = clock(position.cycleStart + entry.startMs);

        const info = document.createElement("span");
        info.className = "radio-program-info";
        const title = document.createElement("span");
        title.className = "radio-program-title";
        title.textContent = entry.title;
        const album = document.createElement("span");
        album.className = "radio-program-album";
        album.textContent = entry.albumTitle;
        info.append(title, album);

        row.append(time, info);
        fragment.appendChild(row);
      });
      ui.program.replaceChildren(fragment);
      if (ui.programMeta) {
        ui.programMeta.textContent = `${copy.day} · ${clock(position.cycleStart)} – ${clock(position.cycleStart + CYCLE_MS)}`;
      }
      state.lastActiveIndex = -1;
    }

    if (ui.programPrev) ui.programPrev.textContent = copy.prevBlock;
    if (ui.programNow) ui.programNow.textContent = copy.nowBlock;
    if (ui.programNext) ui.programNext.textContent = copy.nextBlock;

    ui.program.querySelectorAll(".radio-program-item").forEach((row) => {
      const active = Number(row.dataset.radioIndex) === position.index;
      row.classList.toggle("is-active", active);
      row.setAttribute("aria-current", active ? "true" : "false");
    });
    // Follow the broadcast only while the visitor has not scrolled away, and
    // only when the active track actually changes — never on every tick.
    if (state.followCurrent && state.lastActiveIndex !== position.index) {
      state.lastActiveIndex = position.index;
      scrollProgramTo(position.index);
    }
  }

  function render(position) {
    if (!ui.play && !ui.status) return;
    const copy = text();
    const ready = !!position?.item;
    const api = player();
    const live = !!state.active && !!(api && api.getState().playing);

    if (ui.status) {
      let status = copy.off;
      if (!state.catalog || !state.pool.length) status = copy.unavailable;
      else if (state.active) status = live ? copy.onAir : copy.paused;
      ui.status.textContent = status;
      ui.status.classList.toggle("is-live", live);
    }
    if (ui.lock) {
      ui.lock.hidden = !state.active;
      ui.lock.textContent = copy.locked;
    }
    if (ui.play) {
      ui.play.setAttribute("aria-pressed", String(state.active));
      ui.play.classList.toggle("is-active", state.active);
      const label = state.active ? copy.pause : copy.play;
      ui.play.setAttribute("aria-label", label);
      ui.play.setAttribute("title", label);
    }
    if (ui.playLabel) ui.playLabel.textContent = state.active ? copy.pause : copy.play;
    if (ui.empty) ui.empty.hidden = !!state.catalog && !!state.pool.length && ready;

    if (!position) return;
    const block = copy.blocks[position.blockIndex];
    const next = position.program[position.index + 1] || null;
    if (ui.blockTitle) ui.blockTitle.textContent = block.title;
    if (ui.blockDescription) ui.blockDescription.textContent = block.description;
    if (ui.blockTime) {
      const start = position.cycleStart + position.blockIndex * BLOCK_MS;
      ui.blockTime.textContent = `${clock(start)} – ${clock(start + BLOCK_MS)} · ${copy.now} ${clock(position.now)}`;
    }
    if (ui.trackTitle) {
      ui.trackTitle.textContent = ready
        ? `${copy.trackNumber} ${position.index + 1} · ${position.item.title} — ${position.item.albumTitle}`
        : (state.catalog ? copy.empty : copy.unavailable);
    }
    if (ui.nextTrack) {
      ui.nextTrack.textContent = next ? `${copy.next}: ${next.title}` : "";
    }
    if (ui.progressFill) {
      const progress = ready
        ? Math.max(0, Math.min(1, (position.offsetMs - position.item.startMs) / Math.max(1, position.item.endMs - position.item.startMs)))
        : 0;
      ui.progressFill.style.width = `${progress * 100}%`;
    }
    renderProgram(position, copy);
  }

  function applyTrack(position) {
    const api = player();
    if (!api || !position?.item) return;
    const current = api.getState().current;
    const albumId = `radio-cycle-${position.cycle}`;
    const expectedTime = Math.max(0, (position.offsetMs - position.item.startMs) / 1000);
    if (current?.albumId === albumId && current.path === position.item.path) {
      if (api.getState().playing && Math.abs(api.getState().time - expectedTime) > RESYNC_MS / 1000) {
        api.seekProgram(expectedTime);
      }
      return;
    }

    state.switching = true;
    state.lastResyncAt = Date.now();
    api.setProgramLock(true);
    api.playTrack(albumFor(position), position.item.index, {
      autoplay: true,
      startTime: expectedTime,
      fromProgram: true,
      crossfade: false,
      fadeIn: false,
    });

    const startedAt = Date.now();
    const confirm = () => {
      const stateNow = api.getState().current;
      if (stateNow?.albumId === albumId && stateNow.path === position.item.path) {
        state.switching = false;
        return;
      }
      if (Date.now() - startedAt > 20000) {
        state.switching = false;
        return;
      }
      window.setTimeout(confirm, 200);
    };
    window.setTimeout(confirm, 200);
  }

  function tick() {
    if (!ui.play && !ui.status) return;
    if (!state.catalog || !state.pool.length) {
      render(null);
      return;
    }
    const position = positionAt(Date.now());
    state.position = position;
    render(position);
    if (!state.active || !position.item) return;

    const api = player();
    if (!api || state.switching) return;

    const now = Date.now();
    const current = api.getState().current;
    const albumId = `radio-cycle-${position.cycle}`;
    if (!current || current.albumId !== albumId || current.path !== position.item.path) {
      applyTrack(position);
      return;
    }
    // Let the audio clock run. Seeking to the wall clock every second caused a
    // small, constant rewind. Only a large, rare *lag* is corrected, and never
    // backwards. If a file ends before its slot, the broadcast stays silent
    // until the next scheduled item instead of re-seeking the finished file.
    const playback = api.getState();
    const expectedTime = Math.max(0, (position.offsetMs - position.item.startMs) / 1000);
    const slotEnd = position.item.endMs / 1000;
    const behind = expectedTime - (playback.time || 0);
    if (playback.playing && behind > RESYNC_MS / 1000 && now - state.lastResyncAt > RESYNC_INTERVAL_MS && expectedTime < slotEnd - 1) {
      api.seekProgram(expectedTime);
      state.lastResyncAt = now;
    }
  }

  function start() {
    if (!state.catalog || !state.pool.length) return;
    state.active = true;
    try { localStorage.setItem(STORAGE_ACTIVE, "1"); } catch {}
    const position = positionAt(Date.now());
    applyTrack(position);
    tick();
  }

  function stop() {
    state.active = false;
    try { localStorage.setItem(STORAGE_ACTIVE, "0"); } catch {}
    player()?.setProgramLock(false);
    player()?.pause();
    render(state.position || positionAt(Date.now()));
  }

  function jumpProgram(direction) {
    state.followCurrent = false;
    const position = state.position || positionAt(Date.now());
    state.position = position;
    if (direction === 0) {
      state.followCurrent = true;
      state.lastActiveIndex = -1;
      scrollProgramTo(position.index);
      return;
    }
    const targetBlock = clampBlock(position.blockIndex + direction);
    scrollProgramTo(indexAtOffset(position, targetBlock * BLOCK_MS + 1000));
  }

  function clampBlock(index) {
    return Math.max(0, Math.min(BLOCKS_PER_DAY - 1, index));
  }

  function bind() {
    captureUi();
    document.addEventListener("click", (ev) => {
      const target = ev.target instanceof Element ? ev.target : null;
      if (!target) return;
      if (target.closest("#radioPlay") && ui.play?.contains(target)) {
        if (state.active) stop();
        else start();
        return;
      }
      if (target.closest("#radioProgramPrev")) jumpProgram(-1);
      else if (target.closest("#radioProgramNext")) jumpProgram(1);
      else if (target.closest("#radioProgramNow")) jumpProgram(0);
    });

    // A wheel/touch gesture on the program means the visitor is browsing the
    // day themselves. Stop yanking the list back to the live track.
    ["wheel", "touchstart", "pointerdown"].forEach((eventName) => {
      ui.program?.addEventListener(eventName, () => { state.followCurrent = false; }, { passive: true });
    });
    ui.program?.addEventListener("keydown", (ev) => {
      if (["ArrowUp", "ArrowDown", "PageUp", "PageDown", "Home", "End"].includes(ev.key)) state.followCurrent = false;
    });

    window.addEventListener("zqwy:playerstate", () => {
      const api = player();
      const current = api ? api.getState().current : null;
      // Closing the global player ends the broadcast instead of fighting it.
      if (state.active && !state.switching && !current) {
        state.active = false;
        try { localStorage.setItem(STORAGE_ACTIVE, "0"); } catch {}
        api?.setProgramLock(false);
      }
      render(state.position || positionAt(Date.now()));
    });

    window.addEventListener("zqwy:languagechange", () => {
      state.lastListKey = "";
      render(state.position || positionAt(Date.now()));
    });
  }

  async function init() {
    captureUi();
    if (!state.timer) {
      state.timer = window.setInterval(() => tick(), TICK_MS);
    }
    if (state.catalog) {
      render(state.position || positionAt(Date.now()));
      return;
    }
    try {
      const response = await fetch(CATALOG_URL, { cache: "force-cache", credentials: "same-origin" });
      if (!response.ok) throw new Error(String(response.status));
      state.catalog = await response.json();
    } catch {
      state.catalog = null;
      render(null);
      return;
    }
    buildPool();
    tick();
    let resume = false;
    try { resume = localStorage.getItem(STORAGE_ACTIVE) === "1"; } catch {}
    if (resume) start();
  }

  bind();
  init();
  // The player survives SPA navigation. When the visitor leaves the radio
  // page, end the broadcast so no invisible lock can block the music player.
  window.addEventListener("zqwy:pagechange", () => {
    if (!/\/radio(?:\/|$)/.test(window.location.pathname)) {
      if (state.active) stop();
      return;
    }
    init();
  });
})();
