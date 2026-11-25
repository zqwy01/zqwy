/* Lazy parts of the player: heavy code that most visits never need.
 *
 * These modules still share the same context P as the eager modules, so the
 * split stays transparent to callers. Each group is fetched and installed once,
 * on first use; later calls reuse the installed functions.
 */
import { P } from "./context.js";

const pending = new Map();

function loadGroup(name, specs) {
  if (!pending.has(name)) {
    pending.set(name, Promise.all(specs.map((spec) => import(spec))).then((mods) => {
      for (const mod of mods) mod.install?.(P);
    }).catch((error) => {
      pending.delete(name); // allow a retry after a network hiccup
      throw error;
    }));
  }
  return pending.get(name);
}

export function ensureFxUi(P) { return loadGroup("fxUi", ["./ui/fx.js"]); }
export function ensureEncoders(P) { return loadGroup("encoders", ["./audio/encoders/wav.js", "./audio/encoders/flac.js", "./audio/encoders/media.js"]); }
export function ensureEngines(P) { return loadGroup("engines", ["./engines/wavesurfer.js", "./engines/peaks.js", "./engines/howler.js", "./engines/waviz.js", "./engines/mediaelement.js", "./engines/amplitude.js", "./engines/aplayer.js", "./engines/jplayer.js"]); }
export function ensureRemix(P) { return loadGroup("remix", ["./remix.js"]); }

// Eager modules call these names as if the functions were always there.
function later(name, ensure) {
  return (...args) => ensure(P).then(() => P[name](...args));
}

P.ensureFxUi = (...a) => ensureFxUi(P, ...a);
P.ensureEncoders = (...a) => ensureEncoders(P, ...a);
P.ensureEngines = (...a) => ensureEngines(P, ...a);
P.ensureRemix = (...a) => ensureRemix(P, ...a);

// The FX canvases live inside the settings panel. There is nothing to draw
// until the panel is opened, so boot-time syncs are intentionally skipped.
const fxUiNames = ["fxPercent", "drawFxCanvas", "drawFxVisuals", "fxCanvasPoint", "applyFxCanvasDrag", "bindFxCanvasInteractions", "syncFxVisual"];
for (const name of fxUiNames) {
  P[name] = (...args) => {
    if (name === "syncFxVisual" && (!P.settingsPanel || P.settingsPanel.hidden)) return Promise.resolve();
    return later(name, ensureFxUi)(...args);
  };
}
for (const name of ["encodeWav", "encodeFlac", "encodeWithMediaRecorder", "recorderMime", "decodeUrlToBuffer"]) {
  P[name] = later(name, ensureEncoders);
}
for (const name of ["createWaveSurfer", "createPeaks", "createHowler", "createWaviz", "createMediaElement", "createAmplitude", "createAPlayer", "createJPlayer"]) {
  P[name] = later(name, ensureEngines);
}
for (const name of ["showRemixMessage", "rememberRemixUrl", "remixBaseName", "downloadBlob", "bakeRemixNow", "remixExtension", "saveRemix", "loadRemixFile"]) {
  P[name] = later(name, ensureRemix);
}
