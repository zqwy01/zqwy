/* radio/playback.js — модуль скрипта radio.js. */
export function install(P) {
  Object.assign(P, { player, applyTrack, tick, start, stop });


  function player() {
    return window.zqwyPlayer || null;
  }

  function applyTrack(position) {
    const api = P.player();
    if (!api || !position?.item) return;
    const current = api.getState().current;
    const albumId = `radio-cycle-${position.cycle}`;
    const expectedTime = Math.max(0, (position.offsetMs - position.item.startMs) / 1000);
    if (current?.albumId === albumId && current.path === position.item.path) {
      if (api.getState().playing && Math.abs(api.getState().time - expectedTime) > P.state.resyncMs / 1000) {
        api.seekProgram(expectedTime);
        P.state.lastResyncAt = Date.now();
      }
      return;
    }

    P.state.switching = true;
    P.state.lastResyncAt = Date.now();
    api.setProgramLock(true);
    api.playTrack(P.albumFor(position), position.item.index, {
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
        P.state.switching = false;
        return;
      }
      if (Date.now() - startedAt > 20000) {
        P.state.switching = false;
        return;
      }
      window.setTimeout(confirm, 200);
    };
    window.setTimeout(confirm, 200);
  }

  function tick() {
    if (!P.ui.play && !P.ui.status) return;
    if (!P.state.catalog || !P.state.pool.length) {
      P.render(null);
      return;
    }
    const position = P.positionAt(Date.now());
    P.state.position = position;
    P.render(position);
    if (!P.state.active || !position.item) return;

    const api = P.player();
    if (!api || P.state.switching) return;

    const now = Date.now();
    const current = api.getState().current;
    const albumId = `radio-cycle-${position.cycle}`;
    if (!current || current.albumId !== albumId || current.path !== position.item.path) {
      P.applyTrack(position);
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
    if (P.state.autoSync && playback.playing && behind > P.state.resyncMs / 1000 && now - P.state.lastResyncAt > P.state.resyncIntervalMs && expectedTime < slotEnd - 1) {
      api.seekProgram(expectedTime);
      P.state.lastResyncAt = now;
    }
  }

  function start() {
    if (!P.state.catalog || !P.state.pool.length) return;
    P.state.active = true;
    try { localStorage.setItem(P.STORAGE_ACTIVE, "1"); } catch {}
    const position = P.positionAt(Date.now());
    P.applyTrack(position);
    P.tick();
  }

  function stop() {
    P.state.active = false;
    try { localStorage.setItem(P.STORAGE_ACTIVE, "0"); } catch {}
    P.player()?.setProgramLock(false);
    P.player()?.pause();
    P.render(P.state.position || P.positionAt(Date.now()));
  }}
