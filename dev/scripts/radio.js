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
  const RESYNC_MS = 4000;
  const MAX_CACHED_PROGRAMS = 3;

  const TEXT = {
    ru: {
      service: "радио", heading: "Круглосуточный эфир",
      hint: "Непрерывная программа идёт от фиксированной точки 2020-01-01 UTC. Треки следуют строго один за другим; загрузка сайта не сбрасывает эфир.",
      play: "Включить эфир", pause: "Пауза эфира",
      onAir: "В эфире", paused: "Эфир на паузе", off: "Эфир выключен",
      schedule: "Программа дня", now: "Сейчас", next: "Далее",
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

  function renderProgram(position, copy) {
    if (!ui.program) return;
    const key = `${position.cycle}|${position.blockIndex}|${lang()}|${state.poolKey}`;
    const blockStart = position.blockIndex * BLOCK_MS;
    const blockEnd = blockStart + BLOCK_MS;
    if (state.lastListKey !== key) {
      state.lastListKey = key;
      const fragment = document.createDocumentFragment();
      position.program.forEach((entry) => {
        if (entry.startMs >= blockEnd || entry.endMs <= blockStart) return;
        const row = document.createElement("div");
        row.className = "radio-program-item";
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
        ui.programMeta.textContent = `${clock(position.cycleStart + blockStart)} – ${clock(position.cycleStart + blockEnd)}`;
      }
    }

    let activeRow = null;
    ui.program.querySelectorAll(".radio-program-item").forEach((row) => {
      const active = Number(row.dataset.radioIndex) === position.index;
      row.classList.toggle("is-active", active);
      row.setAttribute("aria-current", active ? "true" : "false");
      if (active) activeRow = row;
    });
    if (activeRow && activeRow.scrollIntoView) {
      activeRow.scrollIntoView({ block: "nearest" });
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
    if (!api) return;
    api.setProgramLock(true);
    if (state.switching) return;

    const current = api.getState().current;
    const albumId = `radio-cycle-${position.cycle}`;
    if (!current || current.albumId !== albumId || current.path !== position.item.path) {
      applyTrack(position);
      return;
    }
    // The catalog durations and the file durations match; only correct a tab
    // that was throttled enough to fall behind the published schedule.
    const expectedTime = Math.max(0, (position.offsetMs - position.item.startMs) / 1000);
    if (api.getState().playing && Math.abs(api.getState().time - expectedTime) > RESYNC_MS / 1000) {
      api.seekProgram(expectedTime);
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

  function bind() {
    document.addEventListener("click", (ev) => {
      const target = ev.target instanceof Element ? ev.target : null;
      if (!target) return;
      const button = target.closest("#radioPlay");
      if (button && ui.play?.contains(button)) {
        if (state.active) stop();
        else start();
      }
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
