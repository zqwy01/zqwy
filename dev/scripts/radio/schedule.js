/* radio/schedule.js — модуль скрипта radio.js. */
export function install(P) {
  Object.assign(P, { hash, buildPool, programFor, positionAt, albumFor, indexAtOffset, syncNow, jumpProgram, clampBlock });


  function hash(value) {
    let result = 0x811c9dc5; // FNV-1a, identical in every browser and release
    for (let i = 0; i < value.length; i++) {
      result ^= value.charCodeAt(i);
      result = Math.imul(result, 0x01000193) >>> 0;
    }
    return result >>> 0;
  }

  function buildPool() {
    const pool = [];
    for (const album of P.state.catalog?.albums || []) {
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
    P.state.pool = pool;
    P.state.poolKey = `${pool.length}:${pool[0]?.id || ""}:${pool[pool.length - 1]?.id || ""}`;
    P.state.programs.clear();
    P.state.lastListKey = "";
    return pool;
  }

  // One deterministic 24-hour sequence. The cycle number comes only from the
  // fixed epoch; rebuilding the catalog cannot move a single boundary.
  function programFor(cycle) {
    const key = `${P.state.poolKey}|${cycle}`;
    if (P.state.programs.has(key)) return P.state.programs.get(key);
    if (!P.state.pool.length) return [];

    const ranked = P.state.pool
      .map((item) => ({ item, score: P.hash(`${item.id}|${cycle}`) }))
      .sort((a, b) => a.score - b.score || (a.item.id < b.item.id ? -1 : a.item.id > b.item.id ? 1 : 0));

    const program = [];
    let cursor = 0;
    let pass = 0;
    while (cursor < P.CYCLE_MS && pass < 6) {
      for (const entry of ranked) {
        if (cursor >= P.CYCLE_MS) break;
        const durationMs = Math.min(entry.item.duration * 1000, P.CYCLE_MS - cursor);
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
    if (program.length) program[program.length - 1].endMs = P.CYCLE_MS;

    P.state.programs.set(key, program);
    while (P.state.programs.size > P.MAX_CACHED_PROGRAMS) {
      P.state.programs.delete(P.state.programs.keys().next().value);
    }
    return program;
  }

  function positionAt(now) {
    const elapsed = Math.max(0, now - P.EPOCH_MS);
    const cycle = Math.floor(elapsed / P.CYCLE_MS);
    const cycleStart = P.EPOCH_MS + cycle * P.CYCLE_MS;
    const offsetMs = now - cycleStart;
    const program = P.programFor(cycle);

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
    const blockIndex = Math.min(P.BLOCKS_PER_DAY - 1, Math.floor(offsetMs / P.BLOCK_MS));
    return { now, cycle, cycleStart, offsetMs, program, index, item, blockIndex };
  }

  function albumFor(position) {
    return {
      id: `radio-cycle-${position.cycle}`,
      title: `${P.text().service} · ${P.clock(position.cycleStart)}`,
      cover: null,
      tracks: position.program.map((entry) => ({
        title: entry.title,
        path: entry.path,
        formats: entry.formats,
        duration: (entry.endMs - entry.startMs) / 1000,
      })),
    };
  }

  function indexAtOffset(position, offsetMs) {
    const target = Math.max(0, Math.min(P.CYCLE_MS - 1, offsetMs));
    const entry = position.program.find((item) => item.endMs > target) || position.program[position.program.length - 1];
    return entry ? entry.index : 0;
  }

  function syncNow() {
    const position = P.state.position || P.positionAt(Date.now());
    P.state.position = position;
    const api = P.player();
    if (!P.state.catalog || !position.item) {
      P.showSyncMessage(P.state.catalog ? "syncNoTrack" : "syncUnavailable");
      return;
    }
    if (!api || !P.state.active) {
      P.showSyncMessage("syncNoTrack");
      return;
    }
    const current = api.getState().current;
    const albumId = `radio-cycle-${position.cycle}`;
    if (!current || current.albumId !== albumId || current.path !== position.item.path) {
      P.applyTrack(position);
      P.showSyncMessage("syncDone");
      return;
    }
    const expectedTime = Math.max(0, (position.offsetMs - position.item.startMs) / 1000);
    const drift = expectedTime - (api.getState().time || 0);
    api.seekProgram(expectedTime);
    P.state.lastResyncAt = Date.now();
    P.render(position);
    P.showSyncMessage("syncDone", drift);
  }

  function jumpProgram(direction) {
    P.state.followCurrent = false;
    const position = P.state.position || P.positionAt(Date.now());
    P.state.position = position;
    if (direction === 0) {
      P.state.followCurrent = true;
      P.state.lastActiveIndex = -1;
      P.scrollProgramTo(position.index);
      return;
    }
    const targetBlock = P.clampBlock(position.blockIndex + direction);
    P.scrollProgramTo(P.indexAtOffset(position, targetBlock * P.BLOCK_MS + 1000));
  }

  function clampBlock(index) {
    return Math.max(0, Math.min(P.BLOCKS_PER_DAY - 1, index));
  }}
