/* radio/ui.js — модуль скрипта radio.js. */
export function install(P) {
  Object.assign(P, { captureUi, syncSettingsUi, showSyncMessage, scrollProgramTo, renderProgram, render });


  function captureUi() {
    P.ui.play = document.getElementById("radioPlay");
    P.ui.playLabel = document.getElementById("radioPlayLabel");
    P.ui.status = document.getElementById("radioStatus");
    P.ui.lock = document.getElementById("radioLock");
    P.ui.blockTime = document.getElementById("radioBlockTime");
    P.ui.blockTitle = document.getElementById("radioBlockTitle");
    P.ui.blockDescription = document.getElementById("radioBlockDescription");
    P.ui.trackTitle = document.getElementById("radioTrackTitle");
    P.ui.nextTrack = document.getElementById("radioNextTrack");
    P.ui.progressFill = document.getElementById("radioProgressFill");
    P.ui.program = document.getElementById("radioProgram");
    P.ui.programMeta = document.getElementById("radioProgramMeta");
    P.ui.programPrev = document.getElementById("radioProgramPrev");
    P.ui.programNow = document.getElementById("radioProgramNow");
    P.ui.programNext = document.getElementById("radioProgramNext");
    P.ui.empty = document.getElementById("radioEmpty");
    P.ui.syncNow = document.getElementById("radioSyncNow");
    P.ui.syncMessage = document.getElementById("radioSyncMessage");
    P.ui.autoSync = document.getElementById("radioAutoSync");
    P.ui.syncThreshold = document.getElementById("radioSyncThreshold");
    P.ui.syncThresholdValue = document.getElementById("radioSyncThresholdValue");
    P.ui.syncInterval = document.getElementById("radioSyncInterval");
    P.ui.syncIntervalValue = document.getElementById("radioSyncIntervalValue");
  }

  function syncSettingsUi() {
    if (P.ui.autoSync) P.ui.autoSync.checked = P.state.autoSync;
    if (P.ui.syncThreshold) P.ui.syncThreshold.value = String(Math.round(P.state.resyncMs / 1000));
    const sec = P.lang() === "ru" ? "с" : "s";
    if (P.ui.syncThresholdValue) P.ui.syncThresholdValue.textContent = `${Math.round(P.state.resyncMs / 1000)} ${sec}`;
    if (P.ui.syncInterval) P.ui.syncInterval.value = String(Math.round(P.state.resyncIntervalMs / 1000));
    if (P.ui.syncIntervalValue) P.ui.syncIntervalValue.textContent = `${Math.round(P.state.resyncIntervalMs / 1000)} ${sec}`;
  }

  function showSyncMessage(key, driftSec) {
    if (!P.ui.syncMessage) return;
    const copy = P.text();
    let message = copy[key] || "";
    if (Number.isFinite(driftSec)) {
      const direction = driftSec >= 0 ? copy.syncBehind : copy.syncAhead;
      const sec = P.lang() === "ru" ? "с" : "s";
      message += ` · ${copy.syncDrift} ${direction} ${Math.abs(driftSec).toFixed(1)} ${sec}`;
    }
    P.ui.syncMessage.textContent = message;
    P.ui.syncMessage.hidden = false;
    window.clearTimeout(showSyncMessage.timer);
    showSyncMessage.timer = window.setTimeout(() => {
      if (P.ui.syncMessage) P.ui.syncMessage.hidden = true;
    }, 6000);
  }

  // Keep the whole day in the DOM so it can actually be scrolled. The old
  // version rendered one 4-hour block and called scrollIntoView() every tick,
  // which made manual scrolling impossible.
  function scrollProgramTo(index) {
    if (!P.ui.program) return;
    const row = P.ui.program.querySelector(`[data-radio-index="${index}"]`);
    if (!row) return;
    const top = row.offsetTop - P.ui.program.clientHeight / 2 + row.offsetHeight / 2;
    P.ui.program.scrollTop = Math.max(0, top);
  }

  function renderProgram(position, copy) {
    if (!P.ui.program) return;
    // One rebuild per cycle/language/catalog, not once per block. Scrolling
    // then never destroys the rows under the pointer.
    const key = `${position.cycle}|${P.lang()}|${P.state.poolKey}`;
    if (P.state.lastListKey !== key) {
      P.state.lastListKey = key;
      const fragment = document.createDocumentFragment();
      position.program.forEach((entry) => {
        const row = document.createElement("div");
        row.className = "radio-program-item";
        if (entry.startMs % P.BLOCK_MS === 0) row.classList.add("is-block-start");
        row.dataset.radioIndex = String(entry.index);

        const time = document.createElement("span");
        time.className = "radio-program-time";
        time.textContent = P.clock(position.cycleStart + entry.startMs);

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
      P.ui.program.replaceChildren(fragment);
      if (P.ui.programMeta) {
        P.ui.programMeta.textContent = `${copy.day} · ${P.clock(position.cycleStart)} – ${P.clock(position.cycleStart + P.CYCLE_MS)}`;
      }
      P.state.lastActiveIndex = -1;
    }

    if (P.ui.programPrev) P.ui.programPrev.textContent = copy.prevBlock;
    if (P.ui.programNow) P.ui.programNow.textContent = copy.nowBlock;
    if (P.ui.programNext) P.ui.programNext.textContent = copy.nextBlock;

    P.ui.program.querySelectorAll(".radio-program-item").forEach((row) => {
      const active = Number(row.dataset.radioIndex) === position.index;
      row.classList.toggle("is-active", active);
      row.setAttribute("aria-current", active ? "true" : "false");
    });
    // Follow the broadcast only while the visitor has not scrolled away, and
    // only when the active track actually changes — never on every tick.
    if (P.state.followCurrent && P.state.lastActiveIndex !== position.index) {
      P.state.lastActiveIndex = position.index;
      P.scrollProgramTo(position.index);
    }
  }

  function render(position) {
    if (!P.ui.play && !P.ui.status) return;
    const copy = P.text();
    const ready = !!position?.item;
    const api = P.player();
    const live = !!P.state.active && !!(api && api.getState().playing);

    if (P.ui.status) {
      let status = copy.off;
      if (!P.state.catalog || !P.state.pool.length) status = copy.unavailable;
      else if (P.state.active) status = live ? copy.onAir : copy.paused;
      P.ui.status.textContent = status;
      P.ui.status.classList.toggle("is-live", live);
    }
    const driftSec = live && position?.item && api
      ? (position.offsetMs - position.item.startMs) / 1000 - (api.getState().time || 0)
      : null;
    if (P.ui.lock) {
      P.ui.lock.hidden = !P.state.active;
      const sec = P.lang() === "ru" ? "с" : "s";
      P.ui.lock.textContent = driftSec != null && Math.abs(driftSec) > 1
        ? `${copy.locked} · ${copy.syncDrift} ${driftSec >= 0 ? copy.syncBehind : copy.syncAhead} ${Math.abs(driftSec).toFixed(1)} ${sec}`
        : copy.locked;
    }
    if (P.ui.play) {
      P.ui.play.setAttribute("aria-pressed", String(P.state.active));
      P.ui.play.classList.toggle("is-active", P.state.active);
      const label = P.state.active ? copy.pause : copy.play;
      P.ui.play.setAttribute("aria-label", label);
      P.ui.play.setAttribute("title", label);
    }
    if (P.ui.playLabel) P.ui.playLabel.textContent = P.state.active ? copy.pause : copy.play;
    if (P.ui.empty) P.ui.empty.hidden = !!P.state.catalog && !!P.state.pool.length && ready;

    if (!position) return;
    const block = copy.blocks[position.blockIndex];
    const next = position.program[position.index + 1] || null;
    if (P.ui.blockTitle) P.ui.blockTitle.textContent = block.title;
    if (P.ui.blockDescription) P.ui.blockDescription.textContent = block.description;
    if (P.ui.blockTime) {
      const start = position.cycleStart + position.blockIndex * P.BLOCK_MS;
      P.ui.blockTime.textContent = `${P.clock(start)} – ${P.clock(start + P.BLOCK_MS)} · ${copy.now} ${P.clock(position.now)}`;
    }
    if (P.ui.trackTitle) {
      P.ui.trackTitle.textContent = ready
        ? `${copy.trackNumber} ${position.index + 1} · ${position.item.title} — ${position.item.albumTitle}`
        : (P.state.catalog ? copy.empty : copy.unavailable);
    }
    if (P.ui.nextTrack) {
      P.ui.nextTrack.textContent = next ? `${copy.next}: ${next.title}` : "";
    }
    if (P.ui.progressFill) {
      const progress = ready
        ? Math.max(0, Math.min(1, (position.offsetMs - position.item.startMs) / Math.max(1, position.item.endMs - position.item.startMs)))
        : 0;
      P.ui.progressFill.style.width = `${progress * 100}%`;
    }
    P.renderProgram(position, copy);
  }}
