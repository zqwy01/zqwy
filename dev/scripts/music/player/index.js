/* Universal, persistent music player.
 *
 * Lives outside .page-content, so SPA navigation never destroys it: switching
 * between links, music and any future catalog page keeps playback running.
 * The engine is switchable — native HTML5 audio, WaveSurfer.js, Peaks.js,
 * Howler.js, Waviz, MediaElement.js, AmplitudeJS, APlayer and jPlayer — and all
 * settings are saved site-wide. The audio format (.opus/.mp3/.wav/.flac) is a
 * separate setting. Every engine drives the same <audio> element, so playback,
 * seeking, volume and Media Session stay identical across the site. Track
 * switches fade a temporary copy of the outgoing element through a Web Audio
 * GainNode; the incoming track gets a configurable fade-in envelope on the
 * shared main gain, so transitions are smooth and click-free.
 *
 * Public API (window.zqwyPlayer):
 *   playTrack(album, index, options) · setContext(album) · toggle() · play()
 *   pause() · next(manual) · previous() · stop() · seek(seconds) · getState()
 *   setEngine(name) · setFormat(name) · openSettings() · on(event, handler)
 *   enqueue(album, index) · removeFromQueue(i) · clearQueue() · getQueue()
 *
 * This file is the entry module. The implementation is split into small
 * modules under ./ — see README.md there for the map.
 */

import { P, initContext, initDom } from "./context.js";
import "./lazy.js";
import { install as install_0 } from "./audio/effects/bake.js";
import { install as install_1 } from "./audio/effects/chain.js";
import { install as install_2 } from "./audio/effects/distortion.js";
import { install as install_3 } from "./audio/effects/effect.js";
import { install as install_4 } from "./audio/effects/reverb.js";
import { install as install_5 } from "./audio/effects/saturation.js";
import { install as install_6 } from "./audio/eq.js";
import { install as install_7 } from "./audio/graph.js";
import { install as install_8 } from "./audio/limiter.js";
import { install as install_9 } from "./engine/detection.js";
import { install as install_10 } from "./engines/index.js";
import { install as install_11 } from "./engines/loader.js";
import { install as install_12 } from "./i18n.js";
import { install as install_13 } from "./init.js";
import { install as install_14 } from "./intro.js";
import { install as install_15 } from "./persistence.js";
import { install as install_16 } from "./playback/core.js";
import { install as install_17 } from "./playback/fades.js";
import { install as install_18 } from "./playback/queue.js";
import { install as install_19 } from "./playback/rate.js";
import { install as install_20 } from "./share.js";
import { install as install_21 } from "./ui/eq.js";
import { install as install_22 } from "./ui/fade.js";
import { install as install_23 } from "./ui/limiter.js";
import { install as install_24 } from "./ui/markup.js";
import { install as install_25 } from "./ui/player-bar.js";
import { install as install_26 } from "./ui/queue.js";
import { install as install_27 } from "./ui/settings.js";
import { bindEvents } from "./events.js";

// Install function bodies first, then create the state they close over.
// Module scripts have no document.currentScript: paths come from import.meta
// in context.js, which stays correct after SPA pushState and on GitHub Pages.
install_0(P);
install_1(P);
install_2(P);
install_3(P);
install_4(P);
install_5(P);
install_6(P);
install_7(P);
install_8(P);
install_9(P);
install_10(P);
install_11(P);
install_12(P);
install_13(P);
install_14(P);
install_15(P);
install_16(P);
install_17(P);
install_18(P);
install_19(P);
install_20(P);
install_21(P);
install_22(P);
install_23(P);
install_24(P);
install_25(P);
install_26(P);
install_27(P);
initContext(P);

function boot() {

  "use strict";

  if (document.getElementById("playerBar")) return; // already injected
  document.body.insertAdjacentHTML("beforeend", P.BAR_HTML);  initDom(P);

  // Both dialogs are full-screen pages. They cannot stay inside the player bar:
  // `will-change: transform` on the bar would make `position: fixed` resolve
  // against the bar instead of the viewport.
  if (P.settingsPanel && P.settingsPanel.parentElement !== document.body) {
    document.body.appendChild(P.settingsPanel);
  }
  if (P.queuePanel && P.queuePanel.parentElement !== document.body) {
    document.body.appendChild(P.queuePanel);
  }

  if ("mediaSession" in navigator) {
    const handlers = {
      play: () => { if (P.state.current) P.attemptPlay(); },
      pause: P.pauseAudio,
      previoustrack: P.previous,
      nexttrack: () => P.next(true),
      seekbackward: () => { P.introUserSeeked = true; P.setTime(P.audio.currentTime - 10); },
      seekforward: () => { P.introUserSeeked = true; P.setTime(P.audio.currentTime + 10); },
      seekto: (details) => { if (Number.isFinite(details.seekTime)) { P.introUserSeeked = true; P.setTime(details.seekTime); } },
    };
    for (const [action, handler] of Object.entries(handlers)) {
      try { navigator.mediaSession.setActionHandler(action, handler); } catch {}
    }
  }  bindEvents(P);
  window.zqwyPlayer = {
    playTrack: P.playTrack,
    setContext: P.setContext,
    toggle: P.toggle,
    play: P.attemptPlay,
    pause: P.pauseAudio,
    next: P.next,
    previous: P.previous,
    stop: P.stop,
    seek: P.setTime,
    seekProgram: P.seekProgram,
    setProgramLock: P.setProgramLock,
    getState: P.getState,
    setEngine: P.setEngine,
    setFormat: P.setFormat,
    openSettings: P.openSettings,
    enqueue: P.enqueue,
    removeFromQueue: P.removeFromQueue,
    clearQueue: P.clearQueue,
    getQueue: P.getQueue,
    openQueue: P.openQueue,
    closeQueue: P.closeQueue,
    on(event, handler) {
      if (typeof handler !== "function") return;
      P.listeners.set(event, handler);
    },
  };


  P.restore();}

boot();
