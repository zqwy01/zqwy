/*
 * Universal, persistent music player.
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
 */
(() => {
  "use strict";

  // Capture the script's own URL now: after SPA navigation document.baseURI
  // changes, but this absolute URL always points at the site's vendor folder.
  const PLAYER_SCRIPT = document.currentScript;
  const VENDOR_BASE = PLAYER_SCRIPT
    ? new URL("../vendor/", PLAYER_SCRIPT.src).href
    : null;
  // Root of the site, derived from the script URL rather than document.baseURI:
  // SPA navigation and note pages change the latter, which made ../../src/...
  // resolve to the wrong folder and every track 404.
  const SITE_ROOT = VENDOR_BASE ? new URL("../", VENDOR_BASE).href : null;

  const STORAGE_STATE = "zqwy.player.state.v1";
  const STORAGE_SETTINGS = "zqwy.player.settings.v1";
  const STORAGE_ALBUM = "zqwy.player.album.v1";
  // A settings link carries compact JSON in ?player=<base64url>. Only the keys
  // listed below are accepted: playback position, queue and the current track
  // are intentionally personal and are never shared.
  const SHARE_PARAM = "player";
  const TIME_PARAM = "t";
  const ENGINES = [
    "html5", "wavesurfer", "peaks", "howler", "waviz",
    "mediaelement", "amplitude", "aplayer", "jplayer",
  ];
  const FORMATS = ["opus", "mp3", "wav", "flac"];
  const REMIX_FORMATS = ["wav", "flac", "mp3", "opus", "ogg"];
  const LIMITER_MODES = ["dbfs", "truepeak", "softclip", "hardclip"];
  // When JavaScript and the APIs WaveSurfer needs are available, the waveform
  // player is the default. The explicit user choice (or a legacy non-HTML5
  // engine) always wins; see detectDefaultEngine()/restore().
  const DEFAULT_ENGINE = "wavesurfer";
  const CROSSFADE_MIN_MS = 0;
  const CROSSFADE_MAX_MS = 3000;
  const DEFAULT_FADE_OUT_MS = 700;
  const DEFAULT_FADE_IN_MS = 500;
  // Effects are audible immediately through a live Web Audio chain. After a
  // configurable pause without knob movement the current track is baked once
  // into a static WAV, and playback switches to that baked waveform.
  const DEFAULT_FX_BAKE_DELAY_MS = 10000;
  const FX_BAKE_DELAY_MIN_MS = 1000;
  const FX_BAKE_DELAY_MAX_MS = 60000;
  // Intro detection replaces the old fixed "skip the first 12 seconds" hack.
  // These are safety limits, not the offset we always jump to: the real skip
  // point is the first sustained sound after the initial quiet run.
  const INTRO_SCAN_MAX_SEC = 90;
  const INTRO_WINDOW_SEC = 0.02;
  const INTRO_MIN_QUIET_SEC = 1;
  const INTRO_MIN_SOUND_SEC = 0.24;
  const INTRO_LEAD_SEC = 0.1;
  // Conservative defaults: quiet music should not be mistaken for silence.
  const DEFAULT_SILENCE_DB = -38;
  const DEFAULT_INTRO_MAX_SEC = 45;

  /* The player used to be the only untranslated part of the site. Keep its
     wording here (and mirror the site's RU/EN switch) instead of baking one
     language into the injected markup. */
  const PLAYER_I18N = {
    ru: {
      nothingPlaying: "Ничего не играет",
      prev: "Предыдущий трек", play: "Воспроизвести", pause: "Пауза", next: "Следующий трек",
      queue: "Очередь треков", clearQueue: "Очистить", closeQueue: "Закрыть очередь",
      queueEmpty: "Очередь пуста. Добавьте треки кнопкой «+» в каталоге.",
      shuffleOn: "Перемешивание включено", shuffleOff: "Перемешивание выключено",
      repeatOff: "Повтор: выключен", repeatAll: "Повтор: весь релиз", repeatOne: "Повтор: один трек",
      muteOn: "Включить звук", muteOff: "Выключить звук",
      settings: "Настройки плеера", closeSettings: "Закрыть настройки",
      share: "Поделиться настройками",
      shareHint: "Ссылка откроет плеер с вашими настройками: движок, формат, скорость, эквалайзер и эффекты.",
      shareCopy: "Скопировать ссылку", shareCopied: "Ссылка скопирована",
      shareManual: "Ссылка готова — скопируйте её из поля",
      close: "Остановить и закрыть плеер", loading: "Загрузка трека",
      createRemix: "Создать ремикс", saveRemix: "Сохранить ремикс", loadRemix: "Загрузить ремикс",
      remixSection: "Ремикс",
      remixHint: "«Создать ремикс» запекает текущие эффекты сразу. «Сохранить ремикс» скачивает готовый файл в выбранном формате. Исходные файлы не перезаписываются.",
      remixFormat: "Формат файла ремикса",
      remixSaved: "Ремикс сохранён", remixLoaded: "Загружен ремикс — исходный файл не перезаписывается",
      remixCreated: "Ремикс создан и запечён в звуковую волну", remixEncoding: "Кодирую {format}…",
      remixNoTrack: "Сначала включите трек", remixNoFx: "Включите хотя бы один эффект",
      remixError: "Не удалось обработать ремикс",
      remixUnsupported: "Формат {format} недоступен в этом браузере — выберите WAV или FLAC",
      position: "Позиция трека", volume: "Громкость", engineUi: "Позиция (AmplitudeJS)",
      playPause: "Воспроизвести/пауза", amplitudeVolume: "Громкость (AmplitudeJS)",
      settingsHint: "Плеер универсальный: движок и поведение выбираются здесь и сохраняются для всего сайта.",
      engine: "Движок воспроизведения",
      engineHtml5: "HTML5 (встроенный в браузер)", engineWavesurfer: "WaveSurfer.js (форма волны)",
      enginePeaks: "Peaks.js (форма волны)", engineHowler: "Howler.js (аудио + живой сигнал)",
      engineWaviz: "Waviz (визуализация)", engineMediaelement: "MediaElement.js (интерфейс)",
      engineAmplitude: "AmplitudeJS (интерфейс)", engineAplayer: "APlayer (интерфейс)",
      engineJplayer: "jPlayer (интерфейс)",
      engineDefaultHint: "По умолчанию используется WaveSurfer.js: JavaScript и нужные браузерные API определяются автоматически, при ошибке загрузки включается HTML5. Выбранный здесь движок сохраняется как явный выбор.",
      engineUiHint: "Интерфейс выбранной библиотеки отображается прямо в строке плеера — отдельного окна больше нет.",
      format: "Формат аудиофайла", behavior: "Поведение",
      autoNext: "Играть следующий трек автоматически",
      rememberPosition: "Запоминать позицию трека",
      crossfade: "Плавный переход между треками",
      skipIntroAuto: "Пропускать начальную тишину автоматически",
      silenceThreshold: "Порог тишины", introMax: "Максимум интро",
      thresholdHint: "Тише этого уровня считается тишиной. Чем ниже число, тем меньше вы пропускаете.",
      introMaxHint: "Дальше этого времени интро не ищется, чтобы не перескочить в начало музыки.",
      fadeLabel: "Появление / затухание", fadeIn: "Появление", fadeOut: "Затухание",
      fadeInEnable: "Включить появление", fadeOutEnable: "Включить затухание",
      fadeHint: "Появление и затухание включаются отдельно. Длительности настраиваются независимо; общий плавный переход между треками задаётся выше.",
      playbackRate: "Скорость воспроизведения",
      playbackRateHint: "Ползунок меняет темп от 0.1x до 10x. Режим скорости задаёт пресет темпа, режим изменения тона — стиль воспроизведения.",
      playbackMode: "Режим скорости",
      pitchMode: "Режим изменения тона",
      modeNormal: "Обычная (1x)", modeSlow025: "0.25x", modeSlow05: "0.5x", modeSlow075: "0.75x",
      modeFast125: "1.25x", modeFast15: "1.5x", modeFast2: "2x", modeFast3: "3x", modeCustom: "Своя",
      pitchPreserve: "Сохранять тон",
      pitchVinyl: "Винил/лента (тон меняется)",
      pitchTape: "Тональный (стабильный тон)",
      equalizer: "Параметрический эквалайзер",
      eqEnable: "Включить эквалайзер",
      eqHint: "Визуальная кривая показывает суммарный отклик. Добавляйте фильтры и меняйте тип, частоту, усиление и Q.",
      eqCanvasHint: "Перетаскивайте точки на кривой: по горизонтали — частота, по вертикали — усиление.",
      limiter: "Лимитер 0 dBFS",
      limiterMode: "Режим лимитера",
      limiterModeHint: "dBFS — пиковый лимитер; true peak — 4× оверсемплинг и запас по межсэмпльным пикам; soft clip — мягкое насыщение; hard clip — жёсткое цифровое ограничение.",
      limiterDbfs: "dBFS (пиковый)", limiterTruePeak: "True peak (4×)",
      limiterSoftClip: "Soft clip", limiterHardClip: "Hard clip",
      limiterHint: "Ограничивает выход после эквалайзера в выбранном режиме.",
      limiterMeter: "Пик после лимитера",
      effects: "Эффекты",
      effectsHint: "Цепочка: дисторшн → хорус → флейзер → дилей → реверб. Изменения слышны сразу через живую обработку; после паузы в настройках эффект запекается в звуковую волну. Холсты интерактивны: перетаскивайте их или используйте ползунки.",
      fxBakeDelay: "Ожидание до запекания", fxBakeDelayHint: "Секунд бездействия после последнего изменения эффекта, прежде чем начать запекание.",
      effectRendering: "Запекаю эффекты в трек…", effectReady: "Эффекты запечены в звуковую волну",
      effectCountdown: "Живой эффект · запекание через {s} с",
      effectLive: "Живой эффект · запекание после {s} с бездействия",
      effectUnavailable: "Не удалось запечь эффекты — играет оригинальный файл",
      distortion: "Дисторшн", distortionEnable: "Включить дисторшн",
      distortionHint: "Нелинейное искажение с мягким фильтром тона после формы сигнала.",
      drive: "Степень", tone: "Тон", mix: "Смесь",
      chorus: "Хорус", chorusEnable: "Включить хорус",
      chorusHint: "Модуляция задержки создаёт эффект хора и ленточного вибрато.",
      rate: "Скорость LFO", depth: "Глубина",
      flanger: "Флейзер", flangerEnable: "Включить флейзер",
      flangerHint: "Короткая модулируемая задержка с обратной связью даёт металлический свист и движение спектра.",
      delay: "Дилей", delayEnable: "Включить дилей",
      delayHint: "Повторы с затуханием: время задержки, обратная связь и смесь с оригиналом.",
      delayTime: "Время", feedback: "Обратная связь",
      reverb: "Реверб", reverbEnable: "Включить реверб",
      reverbHint: "Синтетическая impulse-характеристика с регулируемым временем затухания.",
      decay: "Затухание",
      fxCanvasDistortionHint: "Горизонталь — тон, вертикаль — степень искажения.",
      fxCanvasChorusHint: "Горизонталь — скорость LFO, вертикаль — глубина.",
      fxCanvasFlangerHint: "Горизонталь — скорость LFO, вертикаль — глубина.",
      fxCanvasDelayHint: "Горизонталь — время задержки, вертикаль — обратная связь.",
      fxCanvasReverbHint: "Горизонталь — затухание, вертикаль — смесь.",
      eqAdd: "Добавить фильтр",
      eqReset: "Сбросить эквалайзер",
      eqFreq: "Частота", eqGain: "Усиление", eqQ: "Q", eqType: "Тип", eqRemove: "Удалить",
      off: "выкл", ms: "мс", s: "с", db: "дБ",
      playNext: "Играть следующим: {title}", removeQueue: "Убрать из очереди: {title}",
    },
    en: {
      nothingPlaying: "Nothing is playing",
      prev: "Previous track", play: "Play", pause: "Pause", next: "Next track",
      queue: "Track queue", clearQueue: "Clear", closeQueue: "Close queue",
      queueEmpty: "The queue is empty. Add tracks with the “+” button in the catalog.",
      shuffleOn: "Shuffle on", shuffleOff: "Shuffle off",
      repeatOff: "Repeat: off", repeatAll: "Repeat: album", repeatOne: "Repeat: one track",
      muteOn: "Unmute", muteOff: "Mute",
      settings: "Player settings", closeSettings: "Close settings",
      share: "Share settings",
      shareHint: "The link opens the player with your settings: engine, format, speed, equalizer and effects.",
      shareCopy: "Copy link", shareCopied: "Link copied",
      shareManual: "Link ready — copy it from the field",
      close: "Stop and close the player", loading: "Loading track",
      createRemix: "Create remix", saveRemix: "Save remix", loadRemix: "Load remix",
      remixSection: "Remix",
      remixHint: "“Create remix” bakes the current effects immediately. “Save remix” downloads the result in the selected format. Source files are never overwritten.",
      remixFormat: "Remix file format",
      remixSaved: "Remix saved", remixLoaded: "Remix loaded — the source file is not modified",
      remixCreated: "Remix created and baked into the waveform", remixEncoding: "Encoding {format}…",
      remixNoTrack: "Start a track first", remixNoFx: "Enable at least one effect",
      remixError: "Could not process the remix",
      remixUnsupported: "The {format} format is not available in this browser — choose WAV or FLAC",
      position: "Track position", volume: "Volume", engineUi: "Position (AmplitudeJS)",
      playPause: "Play/pause", amplitudeVolume: "Volume (AmplitudeJS)",
      settingsHint: "The player is universal: pick an engine and behaviour here; settings are saved site-wide.",
      engine: "Playback engine",
      engineHtml5: "HTML5 (built into the browser)", engineWavesurfer: "WaveSurfer.js (waveform)",
      enginePeaks: "Peaks.js (waveform)", engineHowler: "Howler.js (audio + live signal)",
      engineWaviz: "Waviz (visualisation)", engineMediaelement: "MediaElement.js (interface)",
      engineAmplitude: "AmplitudeJS (interface)", engineAplayer: "APlayer (interface)",
      engineJplayer: "jPlayer (interface)",
      engineDefaultHint: "WaveSurfer.js is the default when JavaScript and the required browser APIs are available; if loading fails, HTML5 takes over. An explicit choice here is remembered.",
      engineUiHint: "The selected library's controls are shown right in the player row — there is no separate window.",
      format: "Audio format", behavior: "Behaviour",
      autoNext: "Play the next track automatically",
      rememberPosition: "Remember track position",
      crossfade: "Smooth transition between tracks",
      skipIntroAuto: "Skip initial silence automatically",
      silenceThreshold: "Silence threshold", introMax: "Intro limit",
      thresholdHint: "Anything quieter than this counts as silence. Lower values skip less.",
      introMaxHint: "The intro search stops here so the music itself is never skipped.",
      fadeLabel: "Fade in / fade out", fadeIn: "Fade in", fadeOut: "Fade out",
      fadeInEnable: "Enable fade in", fadeOutEnable: "Enable fade out",
      fadeHint: "Fade in and fade out are switched independently. Durations are separate; the overall overlap between tracks is set above.",
      playbackRate: "Playback speed",
      playbackRateHint: "Slider changes tempo from 0.1x to 10x. Speed mode sets tempo preset; pitch mode sets playback style.",
      playbackMode: "Speed mode",
      pitchMode: "Pitch mode",
      modeNormal: "Normal (1x)", modeSlow025: "0.25x", modeSlow05: "0.5x", modeSlow075: "0.75x",
      modeFast125: "1.25x", modeFast15: "1.5x", modeFast2: "2x", modeFast3: "3x", modeCustom: "Custom",
      pitchPreserve: "Preserve pitch",
      pitchVinyl: "Vinyl/tape (pitch changes)",
      pitchTape: "Tonal (stable pitch)",
      equalizer: "Parametric equalizer",
      eqEnable: "Enable equalizer",
      eqHint: "The curve shows the combined response. Add filters and adjust type, frequency, gain, and Q.",
      eqCanvasHint: "Drag points on the curve: horizontal is frequency, vertical is gain.",
      limiter: "0 dBFS limiter",
      limiterMode: "Limiter mode",
      limiterModeHint: "dBFS — sample-peak limiter; true peak — 4× oversampling with intersample headroom; soft clip — gentle saturation; hard clip — hard digital ceiling.",
      limiterDbfs: "dBFS (peak)", limiterTruePeak: "True peak (4×)",
      limiterSoftClip: "Soft clip", limiterHardClip: "Hard clip",
      limiterHint: "Limits the output after the equalizer using the selected mode.",
      limiterMeter: "Post-limiter peak",
      effects: "Effects",
      effectsHint: "Chain: distortion → chorus → flanger → delay → reverb. Changes are audible immediately through live processing; after a pause the effect is baked into the waveform. The canvases are interactive: drag them or use the sliders.",
      fxBakeDelay: "Bake delay", fxBakeDelayHint: "Seconds of inactivity after the last effect change before baking starts.",
      effectRendering: "Baking effects into the track…", effectReady: "Effects baked into the waveform",
      effectCountdown: "Live effect · baking in {s} s",
      effectLive: "Live effect · bakes after {s} s of inactivity",
      effectUnavailable: "Could not bake effects — playing the original file",
      distortion: "Distortion", distortionEnable: "Enable distortion",
      distortionHint: "Non-linear shaping with a gentle tone filter after the waveshaper.",
      drive: "Drive", tone: "Tone", mix: "Mix",
      chorus: "Chorus", chorusEnable: "Enable chorus",
      chorusHint: "Modulated delay creates a choir/tape vibrato texture.",
      rate: "LFO rate", depth: "Depth",
      flanger: "Flanger", flangerEnable: "Enable flanger",
      flangerHint: "A short modulated delay with feedback creates a metallic sweep and moving spectrum.",
      delay: "Delay", delayEnable: "Enable delay",
      delayHint: "Decaying repeats: delay time, feedback, and mix with the original signal.",
      delayTime: "Time", feedback: "Feedback",
      reverb: "Reverb", reverbEnable: "Enable reverb",
      reverbHint: "Synthetic impulse response with adjustable decay time.",
      decay: "Decay",
      fxCanvasDistortionHint: "Horizontal — tone, vertical — drive.",
      fxCanvasChorusHint: "Horizontal — LFO rate, vertical — depth.",
      fxCanvasFlangerHint: "Horizontal — LFO rate, vertical — depth.",
      fxCanvasDelayHint: "Horizontal — delay time, vertical — feedback.",
      fxCanvasReverbHint: "Horizontal — decay, vertical — mix.",
      eqAdd: "Add filter",
      eqReset: "Reset equalizer",
      eqFreq: "Frequency", eqGain: "Gain", eqQ: "Q", eqType: "Type", eqRemove: "Remove",
      off: "off", ms: "ms", s: "s", db: "dB",
      playNext: "Play next: {title}", removeQueue: "Remove from queue: {title}",
    },
  };
  let playerLanguage = document.documentElement.lang === "en" ? "en" : "ru";

  function pt(key, vars) {
    const value = PLAYER_I18N[playerLanguage]?.[key] ?? PLAYER_I18N.ru[key] ?? key;
    if (!vars) return value;
    return value.replace(/\{(\w+)\}/g, (match, name) =>
      Object.prototype.hasOwnProperty.call(vars, name) ? String(vars[name]) : match);
  }

  // menu.js owns the site-wide RU/EN switch and announces it with this event.
  // The player is injected outside [data-i18n] markup, so it translates itself.
  function setPlayerLanguage(language) {
    const next = language === "en" ? "en" : "ru";
    if (next !== playerLanguage) playerLanguage = next;
    applyPlayerLanguage();
  }

  function applyPlayerLanguage() {
    document.querySelectorAll("[data-player-i18n]").forEach((el) => {
      el.textContent = pt(el.dataset.playerI18n);
    });
    document.querySelectorAll("[data-player-i18n-aria-label]").forEach((el) => {
      el.setAttribute("aria-label", pt(el.dataset.playerI18nAriaLabel));
    });
    document.querySelectorAll("[data-player-i18n-title]").forEach((el) => {
      el.setAttribute("title", pt(el.dataset.playerI18nTitle));
    });
    // The settings form contains many static strings, so the simplest reliable
    // approach is to rebuild it from the current dictionary and re-sync values.
    document.querySelectorAll("[data-player-settings-mount]").forEach((mount) => {
      mount.innerHTML = settingsFormHtml();
    });
    syncProgramLockUi();
    syncSettingsUI();
    setFxRendering(false, fxRenderFailed);
    applyShuffle();
    applyRepeat();
    updateMuteState();
    renderQueue();
    if (state.current) renderMetadata();
    else $("playerTitle").textContent = pt("nothingPlaying");
    const loadingText = document.querySelector(".player-loading-text");
    if (loadingText) loadingText.textContent = pt("loading");
  }

  const BAR_HTML = `
<div class="player-bar" id="playerBar" hidden>
  <div class="player-inner">
    <div class="player-now">
      <div class="player-cover">
        <img id="playerCover" alt="" hidden>
        <span class="player-cover-letter" id="playerCoverLetter" aria-hidden="true">♪</span>
      </div>
      <div class="player-text">
        <span class="player-title" id="playerTitle">${pt("nothingPlaying")}</span>
        <span class="player-album" id="playerAlbum"></span>
      </div>
    </div>

    <div class="player-controls">
      <button class="player-btn player-prev" id="playerPrev" type="button" aria-label="${pt("prev")}" data-player-i18n-aria-label="prev">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 5h2v14H6zM20 5v14L9 12z"/></svg>
      </button>
      <button class="player-btn player-play" id="playerPlay" type="button" aria-label="${pt("play")}" data-player-i18n-aria-label="play">
        <svg class="icon-play" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>
        <svg class="icon-pause" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 5h4v14H7zM13 5h4v14h-4z"/></svg>
      </button>
      <button class="player-btn player-next" id="playerNext" type="button" aria-label="${pt("next")}" data-player-i18n-aria-label="next">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M16 5h2v14h-2zM4 5v14l11-7z"/></svg>
      </button>
    </div>

    <div class="player-seek">
      <span class="player-time" id="playerCurrent">0:00</span>
      <input class="player-range player-progress" id="playerSeek" type="range" min="0" max="1000" step="1" value="0" aria-label="${pt("position")}" data-player-i18n-aria-label="position">
      <div class="player-waveform-stack">
        <div class="player-waveform" id="playerWaveform" hidden></div>
        <p class="fx-render-status" data-fx-status hidden>${pt("effectReady")}</p>
      </div>
      <!-- Libraries that draw their own controls live directly in this row,
           next to the native seek bar / waveform — never in a panel above it. -->
      <div class="player-engine-ui" id="playerEngineUi" hidden>
        <div class="engine-ui-view" data-engine-view="howler" hidden>
          <canvas class="lab-analyser" id="labAnalyser" width="640" height="56" aria-hidden="true"></canvas>
          <span class="lab-analyser-level" id="labAnalyserLevel">0%</span>
        </div>
        <div class="engine-ui-view" data-engine-view="mediaelement" hidden>
          <div class="lab-mediaelement" id="labMediaElement"></div>
        </div>
        <div class="engine-ui-view" data-engine-view="amplitude" hidden>
          <div class="lab-amplitude">
            <span class="lab-amplitude-cover" data-amplitude-song-info="cover_art_url"></span>
            <div class="lab-amplitude-info">
              <span class="lab-amplitude-title" data-amplitude-song-info="name">—</span>
              <span class="lab-amplitude-artist" data-amplitude-song-info="artist">zqwy · AmplitudeJS</span>
            </div>
            <input class="amplitude-song-slider" type="range" min="0" max="100" value="0" aria-label="${pt("engineUi")}" data-player-i18n-aria-label="engineUi">
            <button class="amplitude-play-pause lab-amplitude-play" type="button" aria-label="${pt("playPause")}" data-player-i18n-aria-label="playPause">▶</button>
            <span class="amplitude-current-time">0:00</span>
            <span class="lab-amplitude-sep">/</span>
            <span class="amplitude-duration-time">0:00</span>
            <input class="amplitude-volume-slider" type="range" min="0" max="100" value="100" aria-label="${pt("amplitudeVolume")}" data-player-i18n-aria-label="amplitudeVolume">
          </div>
        </div>
        <div class="engine-ui-view" data-engine-view="aplayer" hidden>
          <div class="lab-aplayer" id="labAPlayer"></div>
        </div>
        <div class="engine-ui-view" data-engine-view="jplayer" hidden>
          <div class="lab-jplayer" id="labJPlayer">
            <div class="jp-jplayer" id="labJPlayerMedia"></div>
            <div id="jp_container_1" class="jp-audio jp-type-single" role="application" aria-label="jPlayer">
              <div class="jp-gui jp-interface">
                <div class="jp-controls">
                  <button class="jp-play" type="button" tabindex="0">play</button>
                  <button class="jp-pause" type="button" tabindex="0">pause</button>
                  <button class="jp-stop" type="button" tabindex="0">stop</button>
                  <button class="jp-mute" type="button" tabindex="0" title="mute">mute</button>
                  <button class="jp-unmute" type="button" tabindex="0" title="unmute">unmute</button>
                </div>
                <div class="jp-progress"><div class="jp-seek-bar"><div class="jp-play-bar"></div></div></div>
                <div class="jp-volume-bar"><div class="jp-volume-bar-value"></div></div>
                <div class="jp-time-holder">
                  <div class="jp-current-time" role="timer" aria-label="time">&nbsp;</div>
                  <div class="jp-duration" role="timer" aria-label="duration">&nbsp;</div>
                </div>
              </div>
              <div class="jp-title" aria-label="title"></div>
            </div>
          </div>
        </div>
      </div>
      <span class="player-time" id="playerDuration">0:00</span>
    </div>

    <div class="player-tools">
    <div class="player-extra">
      <button class="player-btn player-queue-toggle" id="playerQueueToggle" type="button" aria-label="${pt("queue")}" aria-expanded="false" aria-controls="playerQueuePanel" title="${pt("queue")}" data-player-i18n-aria-label="queue" data-player-i18n-title="queue">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h11v2H4zM4 11h11v2H4zM4 16h7v2H4zM17 8l5 4-5 4V8z"/></svg>
        <span class="player-queue-count" id="playerQueueCount" hidden>0</span>
      </button>
      <button class="player-btn player-toggle" id="playerShuffle" type="button" aria-label="${pt("shuffleOff")}" aria-pressed="false" data-player-i18n-aria-label="shuffleOff">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10.6 9.2 5.4 4 4 5.4l5.2 5.2 1.4-1.4zm3.8-5.2 2 2L4.1 18.6 5.5 20 17.9 7.7l2 2V4h-5.5zm-.3 9.4-1.4 1.4 3.1 3.1-3.1 3.1 1.4 1.4 3.1-3.1V20H20v-4h-2.8l-3.1-3.1z"/></svg>
      </button>
      <button class="player-btn player-toggle" id="playerRepeat" type="button" aria-label="${pt("repeatOff")}" aria-pressed="false" data-player-i18n-aria-label="repeatOff">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 7h10v3l4-4-4-4v3H5v6h2V7zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2v4z"/></svg>
        <span class="player-repeat-one" aria-hidden="true">1</span>
      </button>
      <button class="player-btn player-mute" id="playerMute" type="button" aria-label="${pt("muteOff")}" data-player-i18n-aria-label="muteOff">
        <svg class="icon-volume" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9H4zm12.5 3a4.5 4.5 0 0 1-2.5 4v-8a4.5 4.5 0 0 1 2.5 4z"/></svg>
        <svg class="icon-muted" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9H4zm12.6 1.1 1.4-1.4 4.4 4.4-1.4 1.4-4.4-4.4zm5.8 0-4.4 4.4-1.4-1.4 4.4-4.4 1.4 1.4z"/></svg>
      </button>
      <input class="player-range player-volume" id="playerVolume" type="range" min="0" max="1" step="0.01" value="1" aria-label="${pt("volume")}" data-player-i18n-aria-label="volume">
      <button class="player-btn player-settings-toggle" id="playerSettingsToggle" type="button" aria-label="${pt("settings")}" aria-expanded="false" aria-controls="playerSettings" data-player-i18n-aria-label="settings">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19.14 12.94a7.6 7.6 0 0 0 .05-1.88l2.03-1.58a.5.5 0 0 0 .12-.64l-1.92-3.32a.5.5 0 0 0-.6-.22l-2.39.96a7.3 7.3 0 0 0-1.63-.94l-.36-2.54a.5.5 0 0 0-.5-.42h-3.84a.5.5 0 0 0-.5.42l-.36 2.54a7.3 7.3 0 0 0-1.63.94l-2.39-.96a.5.5 0 0 0-.6.22L2.7 8.84a.5.5 0 0 0 .12.64l2.03 1.58a7.6 7.6 0 0 0 0 1.88L2.82 14.5a.5.5 0 0 0-.12.64l1.92 3.32a.5.5 0 0 0 .6.22l2.39-.96a7.3 7.3 0 0 0 1.63.94l.36 2.54a.5.5 0 0 0 .5.42h3.84a.5.5 0 0 0 .5-.42l.36-2.54a7.3 7.3 0 0 0 1.63-.94l2.39.96a.5.5 0 0 0 .6-.22l1.92-3.32a.5.5 0 0 0-.12-.64l-2.03-1.58zM12 15.5a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7z"/></svg>
      </button>
    </div>

    <button class="player-btn player-close" id="playerClose" type="button" aria-label="${pt("close")}" data-player-i18n-aria-label="close">
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.4 5 5 6.4 10.6 12 5 17.6 6.4 19l5.6-5.6 5.6 5.6 1.4-1.4L13.4 12 19 6.4 17.6 5 12 10.6z"/></svg>
    </button>
    </div>

    <!-- Loading state sits over the seek/waveform row in every engine, so the
         percentage is visible even when a library renders its own controls. -->
    <div class="player-loading" id="playerLoading" hidden role="status" aria-live="polite">
      <span class="player-loading-ring" aria-hidden="true"></span>
      <span class="player-loading-text">${pt("loading")}</span>
      <span class="player-loading-percent" id="playerLoadingPercent">0%</span>
      <span class="player-loading-track" aria-hidden="true">
        <span class="player-loading-fill" id="playerLoadingFill"></span>
      </span>
    </div>
  </div>

  <div class="player-settings" id="playerSettings" role="dialog" aria-labelledby="playerSettingsTitle" hidden>
    <div class="player-settings-head">
      <strong id="playerSettingsTitle" data-player-i18n="settings">${pt("settings")}</strong>
      <button class="player-btn player-settings-close" id="playerSettingsClose" type="button" aria-label="${pt("closeSettings")}" data-player-i18n-aria-label="closeSettings">×</button>
    </div>
    <div class="player-settings-mount" data-player-settings-mount></div>
  </div>

  <div class="player-queue" id="playerQueuePanel" hidden>
    <div class="player-queue-head">
      <strong data-player-i18n="queue">${pt("queue")}</strong>
      <div class="player-queue-actions">
        <button type="button" id="playerQueueClear" class="player-queue-text-btn" data-player-i18n="clearQueue">${pt("clearQueue")}</button>
        <button class="player-btn player-queue-close" id="playerQueueClose" type="button" aria-label="${pt("closeQueue")}" data-player-i18n-aria-label="closeQueue">×</button>
      </div>
    </div>
    <ol class="player-queue-list" id="playerQueueList"></ol>
    <p class="player-queue-empty" id="playerQueueEmpty" data-player-i18n="queueEmpty">${pt("queueEmpty")}</p>
  </div>

  <audio id="audio" preload="metadata"></audio>
  <!-- Warms the HTTP cache for the upcoming track. It never plays and never
       touches the shared audio element (Web Audio needs one source per node). -->
  <audio id="preloadAudio" preload="auto" aria-hidden="true" tabindex="-1"></audio>
</div>`;

  if (document.getElementById("playerBar")) return; // already injected
  document.body.insertAdjacentHTML("beforeend", BAR_HTML);

  const $ = (id) => document.getElementById(id);
  const audio = $("audio");
  const preloadAudio = $("preloadAudio");
  const loadingEl = $("playerLoading");
  const loadingPercentEl = $("playerLoadingPercent");
  const loadingFillEl = $("playerLoadingFill");
  const bar = $("playerBar");
  const seek = $("playerSeek");
  const waveform = $("playerWaveform");
  const volume = $("playerVolume");
  const settingsPanel = $("playerSettings");
  // The settings dialog is a full-screen page. It cannot stay inside the
  // player bar: `will-change: transform` on the bar would make `position: fixed`
  // resolve against the bar instead of the viewport.
  if (settingsPanel && settingsPanel.parentElement !== document.body) {
    document.body.appendChild(settingsPanel);
  }
  const settingsToggle = $("playerSettingsToggle");
  const queuePanel = $("playerQueuePanel");
  const queueToggle = $("playerQueueToggle");
  const engineUi = $("playerEngineUi");

  const PLAYBACK_RATE_MIN = 0.1;
  const PLAYBACK_RATE_MAX = 10;
  const PLAYBACK_RATE_STEP = 0.05;
  const PLAYBACK_RATE_MODES = [
    { id: "normal", rate: 1, preservePitch: true },
    { id: "slow025", rate: 0.25, preservePitch: true },
    { id: "slow05", rate: 0.5, preservePitch: true },
    { id: "slow075", rate: 0.75, preservePitch: true },
    { id: "fast125", rate: 1.25, preservePitch: true },
    { id: "fast15", rate: 1.5, preservePitch: true },
    { id: "fast2", rate: 2, preservePitch: true },
    { id: "fast3", rate: 3, preservePitch: true },
  ];
  const PLAYBACK_PITCH_MODES = [
    { id: "preserve", preservePitch: true, labelKey: "pitchPreserve" },
    { id: "vinyl", preservePitch: false, labelKey: "pitchVinyl" },
    { id: "tape", preservePitch: true, labelKey: "pitchTape" }, // UI mode; browser fallback uses preservePitch
  ];
  const EQ_MIN_GAIN = -36;
  const EQ_MAX_GAIN = 36;
  const EQ_MIN_FREQ = 31;
  const EQ_MAX_FREQ = 16000;
  const EQ_MIN_Q = 0.4;
  const EQ_MAX_Q = 18;
  const DEFAULT_EQ_FILTERS = [
    { id: "low", type: "lowshelf", freq: 120, gain: 0, q: 0.7, enabled: true },
    { id: "mid", type: "peaking", freq: 1000, gain: 0, q: 1, enabled: true },
    { id: "high", type: "highshelf", freq: 8000, gain: 0, q: 0.7, enabled: true },
  ];
  const FX_RANGES = {
    distortionDrive: { min: 0, max: 1, step: 0.01, fallback: 0.35 },
    distortionTone: { min: 0, max: 1, step: 0.01, fallback: 0.55 },
    distortionMix: { min: 0, max: 1, step: 0.01, fallback: 0.35 },
    chorusRate: { min: 0.1, max: 5, step: 0.05, fallback: 0.8 },
    chorusDepth: { min: 0, max: 1, step: 0.01, fallback: 0.4 },
    chorusMix: { min: 0, max: 1, step: 0.01, fallback: 0.35 },
    flangerRate: { min: 0.05, max: 4, step: 0.05, fallback: 0.35 },
    flangerDepth: { min: 0, max: 1, step: 0.01, fallback: 0.55 },
    flangerMix: { min: 0, max: 1, step: 0.01, fallback: 0.35 },
    delayTime: { min: 0.05, max: 0.9, step: 0.01, fallback: 0.28 },
    delayFeedback: { min: 0, max: 0.85, step: 0.01, fallback: 0.35 },
    delayMix: { min: 0, max: 1, step: 0.01, fallback: 0.3 },
    reverbDecay: { min: 0.4, max: 4, step: 0.1, fallback: 2.2 },
    reverbMix: { min: 0, max: 1, step: 0.01, fallback: 0.3 },
  };
  const FX_KINDS = ["distortion", "chorus", "flanger", "delay", "reverb"];
  const SHARE_KEYS = [
    "engine", "format", "autoNext", "rememberPosition", "crossfade",
    "fadeOutMs", "fadeInMs", "fadeOutEnabled", "fadeInEnabled",
    "skipIntro", "silenceDb", "introMaxSec",
    "playbackRate", "playbackMode", "pitchMode",
    "eqEnabled", "eqFilters", "limiterEnabled", "limiterMode", "fxBakeDelayMs",
    ...FX_KINDS.map((kind) => `${kind}Enabled`),
    ...Object.keys(FX_RANGES),
  ];

  const listeners = new Map();
  const state = {
    context: null,   // { albumId, title, cover, tracks: [{ title, path }] }
    current: null,   // { albumId, index, title, path, cover }
    time: 0,
    volume: 1,
    muted: false,
    shuffle: false,
    repeat: "off",
    engine: DEFAULT_ENGINE,
    engineExplicit: false, // true only after the visitor picks an engine manually
    format: "opus",
    autoNext: true,
    rememberPosition: true,
    crossfade: true,          // overlap the outgoing and incoming tracks
    fadeOutMs: DEFAULT_FADE_OUT_MS,
    fadeInMs: DEFAULT_FADE_IN_MS,
    fadeOutEnabled: true,     // outgoing track fade envelope
    fadeInEnabled: true,      // incoming track fade envelope
    skipIntro: false,         // skip detected initial silence on a fresh track
    silenceDb: DEFAULT_SILENCE_DB,
    introMaxSec: DEFAULT_INTRO_MAX_SEC,
    playbackRate: 1,
    preservePitch: true,
    playbackMode: "normal",
    pitchMode: "preserve",
    eqEnabled: false,
    eqFilters: DEFAULT_EQ_FILTERS.map((f) => ({ ...f })),
    limiterEnabled: true,
    limiterMode: "dbfs",
    distortionEnabled: false,
    distortionDrive: FX_RANGES.distortionDrive.fallback,
    distortionTone: FX_RANGES.distortionTone.fallback,
    distortionMix: FX_RANGES.distortionMix.fallback,
    chorusEnabled: false,
    chorusRate: FX_RANGES.chorusRate.fallback,
    chorusDepth: FX_RANGES.chorusDepth.fallback,
    chorusMix: FX_RANGES.chorusMix.fallback,
    flangerEnabled: false,
    flangerRate: FX_RANGES.flangerRate.fallback,
    flangerDepth: FX_RANGES.flangerDepth.fallback,
    flangerMix: FX_RANGES.flangerMix.fallback,
    delayEnabled: false,
    delayTime: FX_RANGES.delayTime.fallback,
    delayFeedback: FX_RANGES.delayFeedback.fallback,
    delayMix: FX_RANGES.delayMix.fallback,
    reverbEnabled: false,
    reverbDecay: FX_RANGES.reverbDecay.fallback,
    reverbMix: FX_RANGES.reverbMix.fallback,
    fxBakeDelayMs: DEFAULT_FX_BAKE_DELAY_MS,
    remixFormat: "wav",
    queue: [],   // upcoming tracks added from the music catalog
  };

  let waveSurfer = null;
  let peaks = null;
  let howl = null;
  let waviz = null;
  let mediaElementWrapper = null;
  let aplayer = null;
  let aplayerHost = null;
  let jplayerHost = null;
  let wavizCanvas = null;
  let wavizPlayHandler = null;
  let wavizPauseHandler = null;
  let audioContext = null;
  let mediaSourceNode = null;
  let mainGainNode = null;
  let eqInputNode = null;
  let eqFilters = [];
  // Effects are offline-rendered into WAV blobs. Caches are keyed by the
  // original track URL; the rendered URL is only used while its settings key
  // still matches, so a half-finished render can never reach playback.
  const decodedTrackCache = new Map();
  const renderedTrackCache = new Map();
  const renderRequests = new Map();
  const MAX_DECODED_TRACKS = 4;
  const MAX_RENDERED_TRACKS = 6;
  let decodeContext = null;
  let programLocked = false;   // radio owns the program: no manual track changes
  let loadedRemixUrl = "";     // object URL of an imported remix, revoked on replace
  let remixMessageTimer = 0;
  let fxRenderTimer = 0;
  let fxRenderToken = 0;
  let fxRenderDeadline = 0;
  let fxRenderFailed = false;
  let fxStatusTick = 0;
  let liveFxInputNode = null;
  let liveFxOutputNode = null;
  let liveFxOscillators = [];
  let liveFxSignature = "";
  let restoring = false;
  let loadToken = 0;
  let masterOutputNode = null;
  let limiterNode = null;
  let limiterInputNode = null;
  let limiterOutputNode = null;
  let limiterChainNodes = [];
  let limiterEnabled = true;
  let limiterMeterNode = null;
  let limiterMeterRaf = 0;
  let limiterPeak = 0;
  let limiterPeakHold = 0;
  let limiterPeakHoldAt = 0;
  let pendingStart = null;
  let pendingAutoplay = false;
  // Intro analysis is cached per URL + threshold so scrubbing back and
  // replaying a track never decodes the same file twice.
  const introCache = new Map();
  let introToken = 0;
  let introUserSeeked = false;
  let saveTimer = 0;
  let hideTimer = 0;
  let settingsTimer = 0;
  let queueTimer = 0;
  let loadHideTimer = 0;
  let loadFallbackTimer = 0;
  let preloadTimer = 0;
  let preloadUrl = "";
  let shufflePick = null;
  let scriptPromise = null;
  let peaksScriptPromise = null;
  let howlerScriptPromise = null;
  let wavizScriptPromise = null;
  let mediaElementScriptPromise = null;
  let amplitudeScriptPromise = null;
  let aplayerScriptPromise = null;
  let jqueryScriptPromise = null;
  let jplayerScriptPromise = null;
  const loadedEngineCss = new Set();
  let labRaf = 0;
  let labNode = null;
  let labGain = null;
  const activeFades = new Set(); // temporary <audio> elements fading out after a track switch
  let incomingFadeToken = 0;     // invalidates an older anti-click ramp on rapid switches
  let incomingFadeActive = 0;   // token of fade-in currently animating

  /* ---------- helpers ---------- */

  function assetUrl(relative) {
    const tail = String(relative).split("/").filter(Boolean)
      .map((part) => encodeURIComponent(part))
      .join("/");
    if (SITE_ROOT) return new URL(tail, SITE_ROOT).href;
    return `../../${tail}`;
  }

  // Baked effects live in blob: URLs. They are already absolute and must not
  // be passed through assetUrl(), which would URL-encode the blob prefix.
  function sourceUrl(track) {
    const value = sourceTrackPath(track);
    if (!value) return "";
    return /^(?:[a-z]+:)?\/\//i.test(value) || value.startsWith("blob:") || value.startsWith("data:")
      ? value
      : assetUrl(value);
  }

  function playableUrl(track) {
    const value = resolveTrackPath(track);
    if (!value) return "";
    return /^(?:[a-z]+:)?\/\//i.test(value) || value.startsWith("blob:") || value.startsWith("data:")
      ? value
      : assetUrl(value);
  }

  function basePrefix() {
    const link = [...document.querySelectorAll('link[rel="stylesheet"]')]
      .find((el) => /styles\/base\.css/.test(el.getAttribute("href") || ""));
    const match = (link?.getAttribute("href") || "").match(/^(.*?)styles\/base\.css/);
    return match ? match[1] : "./";
  }

  function cssVar(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  }

  function formatTime(seconds) {
    if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
    const total = Math.floor(seconds);
    return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
  }

  /* ---------- intro silence detection ----------
   * The old implementation skipped a hard-coded 12 seconds, which regularly
   * ate the beginning of a track. Instead, decode the file once in a dedicated
   * AudioContext, measure short RMS windows and jump only when a run of real
   * sound follows a sustained initial silence. A failed decode simply leaves
   * the track at its natural start — no guessing, no chopped music. */
  function introKey(url) {
    return `${url}|${state.silenceDb}|${state.introMaxSec}`;
  }

  function ensureIntroTarget(url) {
    if (!url) return Promise.resolve(null);
    const key = introKey(url);
    if (!introCache.has(key)) introCache.set(key, analyzeIntro(url).catch(() => null));
    return introCache.get(key);
  }

  async function analyzeIntro(url) {
    if (!window.fetch || !(window.AudioContext || window.webkitAudioContext)) return null;
    const response = await fetch(url, { cache: "force-cache", credentials: "same-origin" });
    if (!response.ok) return null;
    const bytes = await response.arrayBuffer();
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    let context = null;
    try {
      context = new AudioContextClass();
      const buffer = await context.decodeAudioData(bytes);
      const sampleRate = buffer.sampleRate;
      const frameSamples = Math.max(1, Math.round(sampleRate * INTRO_WINDOW_SEC));
      const maxSeconds = Math.max(
        INTRO_MIN_QUIET_SEC + INTRO_MIN_SOUND_SEC,
        Math.min(buffer.duration, state.introMaxSec, INTRO_SCAN_MAX_SEC),
      );
      const threshold = Math.pow(10, Number(state.silenceDb) / 20);
      const channels = Array.from({ length: buffer.numberOfChannels }, (_, i) => buffer.getChannelData(i));
      let soundStart = -1;

      for (let time = 0; time < maxSeconds; time += INTRO_WINDOW_SEC) {
        const from = Math.floor(time * sampleRate);
        const to = Math.min(from + frameSamples, buffer.length);
        if (to <= from) break;
        let sumSquares = 0;
        let count = 0;
        for (const channel of channels) {
          for (let i = from; i < to; i++) {
            const value = channel[i];
            sumSquares += value * value;
            count++;
          }
        }
        const rms = count ? Math.sqrt(sumSquares / count) : 0;
        if (rms >= threshold) {
          if (soundStart < 0) soundStart = time;
          if (time - soundStart + INTRO_WINDOW_SEC >= INTRO_MIN_SOUND_SEC) {
            // Music that starts immediately is never an intro. Only a quiet
            // run long enough to be intentional qualifies for a skip.
            if (soundStart < INTRO_MIN_QUIET_SEC) return null;
            return Math.max(0, Math.round((soundStart - INTRO_LEAD_SEC) * 100) / 100);
          }
        } else {
          soundStart = -1;
        }
      }
      return null;
    } finally {
      if (context && typeof context.close === "function") context.close().catch(() => {});
    }
  }

  // Called for every fresh track. The token prevents a slow decode from an
  // earlier track seeking after the visitor has already moved on.
  function prepareIntro(url) {
    const token = ++introToken;
    introUserSeeked = false;
    ensureIntroTarget(url).then((target) => {
      if (token !== introToken || !state.current || target == null || introUserSeeked) return;
      // Decoding can take a moment; only a deliberate scrub by the visitor
      // should cancel the automatic jump, not natural playback progress.
      setTime(target);
      notify("intro");
    });
  }

  // WaveSurfer replaces the compact seek bar with a full-width waveform row;
  // marking both the bar and the body lets CSS enlarge the row and the page
  // padding without measuring anything in JS.
  function setWaveMode(on) {
    bar.classList.toggle("has-waveform", on);
    document.body.classList.toggle("has-waveform", on);
  }

  /* ---------- browser capability / default engine ---------- */

  // The player script itself only runs when JavaScript is enabled. WaveSurfer
  // additionally needs promises, fetch and a 2D canvas to draw the waveform;
  // without them the native <audio> player remains the safe default.
  function detectDefaultEngine() {
    try {
      if (typeof Promise !== "function" || typeof fetch !== "function") return "html5";
      if (!window.requestAnimationFrame) return "html5";
      const canvas = document.createElement("canvas");
      if (!canvas.getContext || !canvas.getContext("2d")) return "html5";
      return DEFAULT_ENGINE;
    } catch {
      return "html5";
    }
  }

  /* ---------- loading progress (shown in the seek/waveform row) ---------- */

  function setLoadingProgress(value) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return;
    const percent = Math.round(Math.min(100, Math.max(0, numeric)));
    if (loadingPercentEl) loadingPercentEl.textContent = `${percent}%`;
    if (loadingFillEl) loadingFillEl.style.width = `${percent}%`;
    loadingEl?.setAttribute("aria-label", `${pt("loading")}: ${percent}%`);
  }

  function setLoading(active, progress = 0) {
    if (loadHideTimer) { window.clearTimeout(loadHideTimer); loadHideTimer = 0; }
    if (loadFallbackTimer) { window.clearTimeout(loadFallbackTimer); loadFallbackTimer = 0; }
    if (!loadingEl) return;
    loadingEl.hidden = !active;
    bar.classList.toggle("is-loading", !!active);
    if (!active) return;
    setLoadingProgress(progress);
    // Never leave the overlay stuck if a browser/library reports no progress.
    loadFallbackTimer = window.setTimeout(() => finishLoading(), 12000);
  }

  function finishLoading() {
    if (!loadingEl || loadingEl.hidden) return;
    setLoadingProgress(100);
    if (loadFallbackTimer) { window.clearTimeout(loadFallbackTimer); loadFallbackTimer = 0; }
    if (loadHideTimer) window.clearTimeout(loadHideTimer);
    loadHideTimer = window.setTimeout(() => {
      loadingEl.hidden = true;
      bar.classList.remove("is-loading");
      loadHideTimer = 0;
    }, 220);
  }

  // Wave engines report their own loading progress; the shared element's
  // buffered ranges would reach 100% long before the waveform is decoded.
  function usesNativeProgress() {
    return state.engine !== "wavesurfer" && state.engine !== "peaks";
  }

  function bufferedPercent() {
    if (!Number.isFinite(audio.duration) || audio.duration <= 0) {
      return audio.readyState >= 2 ? 100 : 0;
    }
    try {
      if (audio.buffered && audio.buffered.length) {
        const end = audio.buffered.end(audio.buffered.length - 1);
        if (Number.isFinite(end)) return (end / audio.duration) * 100;
      }
    } catch {}
    // readyState fallbacks for browsers that don't expose buffered ranges.
    return ({ 0: 0, 1: 15, 2: 45, 3: 80, 4: 100 })[audio.readyState] || 0;
  }

  /* ---------- engine-owned UI inside the player ----------
   * MediaElement.js, AmplitudeJS, APlayer and jPlayer render their own controls.
   * Those controls are placed in the same seek row as WaveSurfer's waveform —
   * there is no second floating interface above the main player. Howler has no
   * DOM UI of its own, so its live analyser uses that same slot.
   */

  const ENGINE_UI = new Set(["howler", "mediaelement", "amplitude", "aplayer", "jplayer"]);

  function loadEngineCss(file, key) {
    if (loadedEngineCss.has(key)) return;
    loadedEngineCss.add(key);
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.dataset.engineCss = key;
    link.href = VENDOR_BASE ? `${VENDOR_BASE}${file}` : `${basePrefix()}vendor/${file}`;
    document.head.appendChild(link);
  }

  function showEngineUi(engine) {
    if (!engineUi || !ENGINE_UI.has(engine)) return false;
    if (engine === "aplayer") loadEngineCss("aplayer.min.css", "aplayer");
    else if (engine === "mediaelement") loadEngineCss("mediaelementplayer.min.css", "mediaelement");
    else if (engine === "jplayer") loadEngineCss("jplayer.blue.monday.min.css", "jplayer");

    engineUi.hidden = false;
    engineUi.querySelectorAll("[data-engine-view]").forEach((view) => {
      view.hidden = view.dataset.engineView !== engine;
    });
    seek.hidden = true;
    waveform.hidden = true;
    setWaveMode(true);
    if (engine === "howler") startHowlerAnalyser();
    else stopHowlerAnalyser();
    return true;
  }

  function hideEngineUi() {
    stopHowlerAnalyser();
    if (!engineUi) return;
    engineUi.hidden = true;
    engineUi.querySelectorAll("[data-engine-view]").forEach((view) => { view.hidden = true; });
  }

  function stopHowlerAnalyser() {
    if (labRaf) { window.cancelAnimationFrame(labRaf); labRaf = 0; }
    try { labNode?.disconnect(); } catch {}
    try { labGain?.disconnect(); } catch {}
    labNode = null;
    labGain = null;
  }

  function startHowlerAnalyser() {
    if (labRaf || !$("labAnalyser")) return;
    const context = sharedAudioContext();
    if (!context) return;
    const main = ensureMainGain();
    const tapSource = main?.gain || mediaSourceNode;
    if (!tapSource) return;
    const canvas = $("labAnalyser");
    const ctx2d = canvas.getContext("2d");
    if (!ctx2d) return;
    const analyser = context.createAnalyser();
    analyser.fftSize = 1024;
    try {
      tapSource.connect(analyser);
      // If we tapped mainGainNode, audio already reaches destination.
      // Otherwise route through unity gain to keep element audible.
      if (!main?.gain) {
        labGain = context.createGain();
        labGain.gain.value = 1;
        analyser.connect(labGain);
        labGain.connect(outputDestination() || context.destination);
      }
    } catch {}
    labNode = analyser;

    const data = new Uint8Array(analyser.frequencyBinCount);
    const draw = () => {
      labRaf = window.requestAnimationFrame(draw);
      analyser.getByteTimeDomainData(data);
      const width = canvas.width;
      const height = canvas.height;
      ctx2d.fillStyle = cssVar("--bg-elevated-2") || "#141414";
      ctx2d.fillRect(0, 0, width, height);
      ctx2d.lineWidth = 2;
      ctx2d.strokeStyle = cssVar("--text") || "#ffffff";
      ctx2d.beginPath();
      const slice = width / data.length;
      let x = 0;
      let peak = 0;
      for (let i = 0; i < data.length; i++) {
        const value = data[i];
        const y = (value / 128) * (height / 2);
        if (i === 0) ctx2d.moveTo(x, y); else ctx2d.lineTo(x, y);
        peak = Math.max(peak, Math.abs(value - 128));
        x += slice;
      }
      ctx2d.stroke();
      const level = $("labAnalyserLevel");
      if (level) level.textContent = `${Math.round((peak / 128) * 100)}%`;
    };
    draw();
  }

  /* ---------- audio formats ---------- */

  function trackFormats(track) {
    if (!track) return {};
    if (track.formats && typeof track.formats === "object") return track.formats;
    const match = String(track.path || "").match(/\.([^.]+)$/);
    return match ? { [match[1].toLowerCase()]: track.path } : {};
  }

  // The selected format wins, but a missing file never breaks playback: we
  // fall back to the track's canonical path, then to opus, then to whatever
  // version is actually present in the catalog.
  function sourceTrackPath(track) {
    const formats = trackFormats(track);
    if (state.format && formats[state.format]) return formats[state.format];
    return track?.path || formats.opus || Object.values(formats)[0] || "";
  }

  // Playback uses the baked version only when its settings signature still
  // matches. While a new render is in flight the original file keeps playing,
  // so changing a slider never freezes or corrupts the current track.
  function renderKey(source, key) {
    return `${source}\u0000${key}`;
  }

  function renderedEntry(track) {
    const source = sourceUrl(track);
    if (!source || !anyFxEnabled()) return null;
    const entry = renderedTrackCache.get(renderKey(source, fxSettingsKey()));
    return entry?.source === source ? entry : null;
  }

  function isTrackRendered(track) {
    return !!renderedEntry(track);
  }

  function resolveTrackPath(track) {
    const source = sourceTrackPath(track);
    if (!source || !anyFxEnabled()) return source;
    return renderedEntry(track)?.url || source;
  }

  function setFormat(name) {
    if (programLocked || !FORMATS.includes(name) || name === state.format) return;
    const wasPlaying = !audio.paused;
    const time = audio.currentTime || 0;
    state.format = name;
    syncSettingsUI();
    saveState();
    notify("settings");
    if (!state.current) return;

    const formats = trackFormats(state.current);
    if (!formats[name]) return;
    loadCurrent({ autoplay: wasPlaying, startTime: time });
  }

  function notify(type) {
    const detail = getState();
    listeners.forEach((handler, event) => {
      if (event === type || event === "state") {
        try { handler(detail); } catch {}
      }
    });
    window.dispatchEvent(new CustomEvent("zqwy:playerstate", { detail }));
  }

  /* ---------- upcoming track queue ---------- */

  function queueItem(album, index) {
    const track = album?.tracks?.[index];
    if (!track) return null;
    return {
      albumId: album.id,
      albumTitle: album.title,
      cover: album.cover || null,
      index,
      title: track.title,
      path: track.path,
      formats: track.formats,
      tracks: album.tracks.map((item) => ({
        title: item.title, path: item.path, formats: item.formats,
      })),
    };
  }

  function renderQueue() {
    if (!queuePanel) return;
    const list = $("playerQueueList");
    const empty = $("playerQueueEmpty");
    const count = $("playerQueueCount");
    const total = state.queue.length;
    if (count) {
      count.textContent = String(total);
      count.hidden = total === 0;
    }
    if (empty) empty.hidden = total > 0;
    if (!list) return;
    list.replaceChildren();
    state.queue.forEach((item, index) => {
      const li = document.createElement("li");
      li.className = "player-queue-item";

      const play = document.createElement("button");
      play.type = "button";
      play.className = "player-queue-play";
      play.dataset.queuePlay = String(index);
      play.setAttribute("aria-label", pt("playNext", { title: item.title }));
      const title = document.createElement("span");
      title.className = "player-queue-title";
      title.textContent = item.title;
      const album = document.createElement("span");
      album.className = "player-queue-album";
      album.textContent = `${index + 1}. ${item.albumTitle || ""}`;
      play.append(title, album);

      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "player-btn player-queue-remove";
      remove.dataset.queueRemove = String(index);
      remove.setAttribute("aria-label", pt("removeQueue", { title: item.title }));
      remove.textContent = "×";

      li.append(play, remove);
      list.appendChild(li);
    });
  }

  function openQueue() {
    if (programLocked || !queuePanel) return;
    if (settingsPanel && !settingsPanel.hidden) closeSettings();
    if (queueTimer) { window.clearTimeout(queueTimer); queueTimer = 0; }
    queuePanel.hidden = false;
    queueToggle?.setAttribute("aria-expanded", "true");
    renderQueue();
    void queuePanel.offsetWidth;
    queuePanel.classList.add("is-open");
  }

  function closeQueue() {
    if (!queuePanel || queuePanel.hidden) return;
    queueToggle?.setAttribute("aria-expanded", "false");
    queuePanel.classList.remove("is-open");
    if (queueTimer) window.clearTimeout(queueTimer);
    queueTimer = window.setTimeout(() => {
      if (!queuePanel.classList.contains("is-open")) queuePanel.hidden = true;
      queueTimer = 0;
    }, 260);
  }

  function toggleQueue() {
    queuePanel?.hidden ? openQueue() : closeQueue();
  }

  function enqueue(album, index) {
    if (programLocked) return false;
    const item = queueItem(album, index);
    if (!item) return false;
    state.queue.push(item);
    renderQueue();
    saveState();
    notify("queue");
    schedulePreload();
    return true;
  }

  function removeFromQueue(index) {
    if (programLocked || !Number.isInteger(index) || index < 0 || index >= state.queue.length) return false;
    state.queue.splice(index, 1);
    renderQueue();
    saveState();
    notify("queue");
    schedulePreload();
    return true;
  }

  function clearQueue() {
    if (programLocked || !state.queue.length) return;
    state.queue = [];
    renderQueue();
    saveState();
    notify("queue");
    schedulePreload();
  }

  function getQueue() {
    return state.queue.map((item) => ({ ...item }));
  }

  function playQueued(index) {
    if (programLocked) return;
    const item = state.queue[index];
    if (!item) return;
    const commit = () => {
      state.queue.splice(index, 1);
      state.context = {
        albumId: item.albumId,
        title: item.albumTitle,
        cover: item.cover,
        tracks: item.tracks || [],
      };
      state.current = {
        albumId: item.albumId,
        index: item.index,
        title: item.title,
        path: item.path,
        formats: item.formats,
        cover: item.cover,
      };
      state.time = 0;
      showBar();
      renderMetadata();
      loadCurrent({ autoplay: true, startTime: 0, fadeIn: true });
      renderQueue();
      saveState();
      notify("queue");
      notify("track");
    };
    beginCrossfade(item, commit);
  }

  function getState() {
    return {
      current: state.current ? { ...state.current } : null,
      context: state.context ? { ...state.context } : null,
      playing: !!(state.current && !audio.paused && !audio.ended),
      time: audio.currentTime || 0,
      duration: Number.isFinite(audio.duration) ? audio.duration : 0,
      volume: state.volume,
      muted: state.muted,
      shuffle: state.shuffle,
      repeat: state.repeat,
      engine: state.engine,
      format: state.format,
      fileFormat: (resolveTrackPath(state.current).match(/\.([^.]+)$/) || [])[1] || null,
      formats: trackFormats(state.current),
      queue: getQueue(),
      programLocked,
    };
  }

  function syncProgramLockUi() {
    if (!bar) return;
    bar.classList.toggle("is-program-locked", programLocked);
    ["playerPrev", "playerNext", "playerQueueToggle", "playerShuffle", "playerRepeat", "playerSeek"]
      .forEach((id) => {
        const el = $(id);
        if (el) el.disabled = programLocked;
      });
    document.querySelectorAll("[data-remix-action], [data-remix-file]").forEach((el) => {
      el.disabled = programLocked;
    });
  }

  // The radio owns playback while this is on: the listener can pause and set
  // volume, but cannot pick, skip, scrub, or queue another track.
  function setProgramLock(enabled) {
    const next = !!enabled;
    if (programLocked === next) return;
    programLocked = next;
    syncProgramLockUi();
    if (programLocked) {
      closeQueue();
      closeSettings();
    }
    notify("programlock");
  }

  function seekProgram(seconds) {
    setTime(seconds, true);
  }

  /* ---------- persistence ---------- */

  function loadSaved() {
    try {
      const raw = localStorage.getItem(STORAGE_STATE);
      if (raw) return JSON.parse(raw) || {};
      const legacy = localStorage.getItem(STORAGE_SETTINGS);
      return legacy ? JSON.parse(legacy) || {} : {};
    } catch { return {}; }
  }

  function saveState() {
    try {
      // Imported remixes are session-only blob URLs: persisting them would
      // restore a dead URL on the next visit.
      const transient = !!state.current && String(state.current.path).startsWith("blob:");
      const current = transient ? null : state.current;
      const context = transient ? null : state.context;
      const payload = {
        ...state,
        current,
        context,
        queue: state.queue.filter((item) => !String(item.path || "").startsWith("blob:")),
        time: state.rememberPosition && current ? audio.currentTime || 0 : 0,
      };
      localStorage.setItem(STORAGE_STATE, JSON.stringify(payload));
      localStorage.setItem(STORAGE_SETTINGS, JSON.stringify({
        volume: state.volume, muted: state.muted, shuffle: state.shuffle,
        repeat: state.repeat, engine: state.engine, format: state.format,
        engineExplicit: state.engineExplicit,
        autoNext: state.autoNext, rememberPosition: state.rememberPosition,
        crossfade: state.crossfade, fadeOutMs: state.fadeOutMs, fadeInMs: state.fadeInMs,
        fadeOutEnabled: state.fadeOutEnabled, fadeInEnabled: state.fadeInEnabled,
        skipIntro: state.skipIntro, silenceDb: state.silenceDb, introMaxSec: state.introMaxSec,
        playbackRate: state.playbackRate, preservePitch: state.preservePitch, playbackMode: state.playbackMode, pitchMode: state.pitchMode,
        eqEnabled: state.eqEnabled, eqFilters: state.eqFilters,
        limiterEnabled: state.limiterEnabled !== false, limiterMode: state.limiterMode,
        fxBakeDelayMs: state.fxBakeDelayMs, remixFormat: state.remixFormat,
        ...Object.fromEntries(FX_KINDS.map((kind) => [`${kind}Enabled`, state[`${kind}Enabled`]])),
        ...Object.fromEntries(Object.keys(FX_RANGES).map((key) => [key, state[key]])),
      }));
      if (context?.albumId) localStorage.setItem(STORAGE_ALBUM, context.albumId);
    } catch {}
  }

  function saveStateSoon() {
    if (saveTimer) return;
    saveTimer = window.setTimeout(() => { saveTimer = 0; saveState(); }, 1500);
  }

  /* ---------- shareable settings links ---------- */

  function encodeShareToken(payload) {
    const bytes = new TextEncoder().encode(JSON.stringify(payload));
    let binary = "";
    bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
    return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }

  function decodeShareToken(token) {
    const base64 = String(token).replace(/-/g, "+").replace(/_/g, "/");
    const binary = atob(base64 + "=".repeat((4 - base64.length % 4) % 4));
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    return JSON.parse(new TextDecoder().decode(bytes));
  }

  function readSharedSettings() {
    try {
      const token = new URLSearchParams(window.location.search).get(SHARE_PARAM);
      if (!token) return null;
      const raw = decodeShareToken(token);
      if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
      const shared = {};
      SHARE_KEYS.forEach((key) => {
        if (Object.prototype.hasOwnProperty.call(raw, key)) shared[key] = raw[key];
      });
      if (Object.prototype.hasOwnProperty.call(shared, "engine")) {
        if (!ENGINES.includes(shared.engine)) delete shared.engine;
        else shared.engineExplicit = true; // a shared engine must beat auto-detection
      }
      if (Object.prototype.hasOwnProperty.call(shared, "format") && !FORMATS.includes(shared.format)) delete shared.format;
      return Object.keys(shared).length ? shared : null;
    } catch { return null; }
  }

  function clearShareParam() {
    try {
      const url = new URL(window.location.href);
      if (!url.searchParams.has(SHARE_PARAM)) return;
      url.searchParams.delete(SHARE_PARAM);
      window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
    } catch {}
  }

  function readTimeParam() {
    try {
      const raw = new URLSearchParams(window.location.search).get(TIME_PARAM);
      if (raw === null) return null;
      const value = Number(raw);
      return Number.isFinite(value) && value >= 0 ? value : null;
    } catch { return null; }
  }

  function buildShareUrl() {
    const payload = {};
    SHARE_KEYS.forEach((key) => { payload[key] = state[key]; });
    // Always point at the music page: it is the only page that can select the
    // album/track from the catalog before handing the timecode to the player.
    const url = SITE_ROOT ? new URL("music/", SITE_ROOT) : new URL(window.location.href);
    url.search = "";
    url.hash = "";
    const albumId = state.context?.albumId;
    if (albumId) url.searchParams.set("album", albumId);
    if (state.current && Number.isInteger(state.current.index)) {
      url.searchParams.set("track", String(state.current.index));
    }
    const time = state.current ? Math.round((audio.currentTime || state.time || 0) * 100) / 100 : 0;
    if (time > 0) url.searchParams.set(TIME_PARAM, String(time));
    url.searchParams.set(SHARE_PARAM, encodeShareToken(payload));
    if (albumId) url.hash = encodeURIComponent(albumId);
    return url.href;
  }

  function copyText(text) {
    if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(text);
    return new Promise((resolve, reject) => {
      const input = document.createElement("textarea");
      input.value = text;
      input.setAttribute("readonly", "");
      input.style.position = "fixed";
      input.style.opacity = "0";
      document.body.appendChild(input);
      input.select();
      let copied = false;
      try { copied = document.execCommand("copy"); } catch {}
      input.remove();
      if (copied) resolve();
      else reject(new Error("copy failed"));
    });
  }

  const shareStatusTimers = new WeakMap();

  function showShareStatus(button, message, url) {
    const field = button.closest(".share-setting");
    const status = field?.querySelector("[data-share-status]");
    const input = field?.querySelector("[data-share-url]");
    if (status) status.textContent = message;
    if (input) {
      input.hidden = !url;
      if (url) { input.value = url; input.focus(); input.select(); }
    }
    const previous = shareStatusTimers.get(button);
    if (previous) window.clearTimeout(previous);
    shareStatusTimers.set(button, window.setTimeout(() => {
      if (status) status.textContent = "";
      if (input) input.hidden = true;
      shareStatusTimers.delete(button);
    }, 4000));
  }

  function shareSettings(button) {
    let url;
    try { url = buildShareUrl(); } catch { return; }
    copyText(url)
      .then(() => showShareStatus(button, pt("shareCopied")))
      .catch(() => showShareStatus(button, pt("shareManual"), url));
  }

  /* ---------- engine: WaveSurfer ---------- */

  function injectVendorScript(file) {
    return new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = VENDOR_BASE
        ? `${VENDOR_BASE}${file}`
        : `${basePrefix()}vendor/${file}`;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error(`${file} not loaded`));
      document.head.appendChild(script);
    });
  }

  function loadWaveSurferScript() {
    if (window.WaveSurfer) return Promise.resolve();
    if (!scriptPromise) scriptPromise = injectVendorScript("wavesurfer.min.js");
    return scriptPromise;
  }

  function loadPeaksScript() {
    if (window.peaks) return Promise.resolve();
    if (!peaksScriptPromise) peaksScriptPromise = injectVendorScript("peaks.min.js");
    return peaksScriptPromise;
  }

  function loadHowlerScript() {
    if (window.Howl && window.Howler) return Promise.resolve();
    if (!howlerScriptPromise) howlerScriptPromise = injectVendorScript("howler.min.js");
    return howlerScriptPromise;
  }

  function loadWavizScript() {
    if (wavizConstructor()) return Promise.resolve();
    if (!wavizScriptPromise) wavizScriptPromise = injectVendorScript("waviz.min.js");
    return wavizScriptPromise;
  }

  // The UMD build exposes a namespace: window.Waviz.Waviz (also .default).
  function wavizConstructor() {
    const ns = window.Waviz;
    if (typeof ns === "function") return ns;
    return ns && (typeof ns.Waviz === "function" ? ns.Waviz : ns.default);
  }

  function loadMediaElementScript() {
    if (window.MediaElement) return Promise.resolve();
    if (!mediaElementScriptPromise) {
      mediaElementScriptPromise = injectVendorScript("mediaelement-and-player.min.js");
    }
    return mediaElementScriptPromise;
  }

  function loadAmplitudeScript() {
    if (window.Amplitude) return Promise.resolve();
    if (!amplitudeScriptPromise) amplitudeScriptPromise = injectVendorScript("amplitude.min.js");
    return amplitudeScriptPromise;
  }

  function loadAPlayerScript() {
    if (window.APlayer) return Promise.resolve();
    if (!aplayerScriptPromise) aplayerScriptPromise = injectVendorScript("aplayer.min.js");
    return aplayerScriptPromise;
  }

  // jPlayer is a jQuery plugin, and the pinned jQuery 2 build keeps the old
  // .bind()/.unbind() API that jPlayer 2.9.2 was written against.
  function loadJPlayerScript() {
    const ensureJQuery = window.jQuery
      ? Promise.resolve()
      : (jqueryScriptPromise || (jqueryScriptPromise = injectVendorScript("jquery.min.js")));
    return ensureJQuery.then(() => {
      if (window.jQuery?.fn?.jPlayer) return;
      if (!jplayerScriptPromise) jplayerScriptPromise = injectVendorScript("jquery.jplayer.min.js");
      return jplayerScriptPromise;
    });
  }

  function rememberAudioDom() {
    return { parent: audio.parentNode, next: audio.nextSibling };
  }

  // APlayer and jPlayer create their own <audio> with document.createElement.
  // Handing them the shared element keeps one source of truth for playback;
  // the element is moved back into the player bar once the library is built.
  function withSharedAudioElement(factory) {
    const original = document.createElement;
    document.createElement = function (tagName, options) {
      if (String(tagName).toLowerCase() === "audio") return audio;
      return original.call(document, tagName, options);
    };
    try { return factory(); } finally { document.createElement = original; }
  }

  function restoreAudioDom(position) {
    if (!position?.parent) return;
    if (audio.parentNode === position.parent && audio.nextSibling === position.next) return;
    if (position.next && position.next.parentNode === position.parent) {
      position.parent.insertBefore(audio, position.next);
    } else {
      position.parent.appendChild(audio);
    }
  }

  function waveformColors() {
    return {
      waveColor: cssVar("--muted") || "#888888",
      progressColor: cssVar("--text") || "#ffffff",
      cursorColor: cssVar("--text") || "#ffffff",
    };
  }

  function showWaveMode() {
    hideEngineUi();
    waveform.hidden = false;
    seek.hidden = true;
    setWaveMode(true);
  }

  function hideWaveMode() {
    hideEngineUi();
    waveform.hidden = true;
    seek.hidden = false;
    setWaveMode(false);
  }

  // A double click on the WaveSurfer waveform pauses/resumes the same shared
  // <audio> element the rest of the player controls.
  function handleWaveDoubleClick(event) {
    event.preventDefault();
    if (!state.current) return;
    toggle();
  }

  // One AudioContext is shared by Peaks and Waviz. Browsers allow only one
  // MediaElementSource per element per context, so cache the node too.
  function sharedAudioContext() {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return null;
    if (!audioContext) {
      audioContext = new AudioContextClass();
      const createSource = audioContext.createMediaElementSource.bind(audioContext);
      audioContext.createMediaElementSource = (element) => {
        if (element === audio && mediaSourceNode) return mediaSourceNode;
        const node = createSource(element);
        if (element === audio) mediaSourceNode = node;
        return node;
      };
    }
    if (audioContext.state === "suspended") audioContext.resume().catch(() => {});
    return audioContext;
  }

  function makeLimiterCurve(mode) {
    const samples = 4096;
    const curve = new Float32Array(samples);
    for (let i = 0; i < samples; i++) {
      const x = (i / (samples - 1)) * 2 - 1;
      if (mode === "truepeak") curve[i] = (Math.tanh(x * 1.6) / Math.tanh(1.6)) * 0.96;
      else if (mode === "softclip") curve[i] = (Math.tanh(x * 1.3) / Math.tanh(1.3)) * 0.99;
      else curve[i] = clamp(x, -0.999, 0.999);
    }
    return curve;
  }

  function stopLimiterChain() {
    limiterChainNodes.forEach((node) => { try { node.disconnect(); } catch {} });
    limiterChainNodes = [];
    limiterNode = null;
    limiterInputNode = null;
    limiterOutputNode = null;
  }

  // Four ceiling modes. dBFS uses a compressor, true peak adds 4× oversampling
  // and intersample headroom, and the clip modes use WaveShaper curves.
  function ensureLimiter() {
    const context = sharedAudioContext();
    if (!context) return null;
    if (limiterInputNode && limiterOutputNode) return limiterInputNode;
    stopLimiterChain();
    try {
      const input = context.createGain();
      const output = context.createGain();
      const keep = (node) => { limiterChainNodes.push(node); return node; };
      let tail = input;
      const mode = LIMITER_MODES.includes(state.limiterMode) ? state.limiterMode : "dbfs";

      if (mode === "dbfs" || mode === "truepeak") {
        const comp = keep(context.createDynamicsCompressor());
        comp.threshold.value = mode === "truepeak" ? -2.5 : -1;
        comp.knee.value = 0;
        comp.ratio.value = 20;
        comp.attack.value = mode === "truepeak" ? 0.001 : 0.003;
        comp.release.value = mode === "truepeak" ? 0.18 : 0.25;
        tail.connect(comp);
        tail = comp;
        limiterNode = comp;
        if (mode === "truepeak") {
          const shaper = keep(context.createWaveShaper());
          shaper.curve = makeLimiterCurve("truepeak");
          try { shaper.oversample = "4x"; } catch {}
          tail.connect(shaper);
          tail = shaper;
          limiterNode = shaper;
        }
      } else {
        const shaper = keep(context.createWaveShaper());
        shaper.curve = makeLimiterCurve(mode);
        try { shaper.oversample = mode === "softclip" ? "4x" : "none"; } catch {}
        tail.connect(shaper);
        tail = shaper;
        limiterNode = shaper;
      }
      tail.connect(output);
      limiterInputNode = input;
      limiterOutputNode = output;
      return input;
    } catch {
      stopLimiterChain();
      return null;
    }
  }

  function rebuildLimiter() {
    stopLimiterChain();
    ensureLimiter();
    wireMasterOutput();
  }

  function setLimiterMode(mode) {
    if (!LIMITER_MODES.includes(mode) || mode === state.limiterMode) return;
    state.limiterMode = mode;
    rebuildLimiter();
    connectMainOutput();
    syncSettingsUI();
    saveState();
    notify("settings");
  }

  function ensureLimiterMeter() {
    const context = sharedAudioContext();
    if (!context) return null;
    if (limiterMeterNode) return limiterMeterNode;
    try {
      const analyser = context.createAnalyser();
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0.6;
      limiterMeterNode = analyser;
    } catch {
      limiterMeterNode = null;
    }
    return limiterMeterNode;
  }

  function ensureMasterOutput() {
    const context = sharedAudioContext();
    if (!context) return null;
    if (masterOutputNode) {
      wireMasterOutput();
      return masterOutputNode;
    }
    try {
      masterOutputNode = context.createGain();
      masterOutputNode.gain.value = 1;
      wireMasterOutput();
    } catch {
      masterOutputNode = null;
    }
    return masterOutputNode;
  }

  function wireMasterOutput() {
    if (!masterOutputNode || !audioContext) return;
    try { masterOutputNode.disconnect(); } catch {}
    const meter = ensureLimiterMeter();
    if (limiterEnabled) {
      const input = ensureLimiter();
      if (input && limiterOutputNode) {
        try { limiterOutputNode.disconnect(); } catch {}
        try { masterOutputNode.connect(input); } catch {}
        if (meter) {
          try { limiterOutputNode.connect(meter); } catch {}
        }
        try { limiterOutputNode.connect(audioContext.destination); } catch {}
        return;
      }
    }
    if (meter) {
      try { masterOutputNode.connect(meter); } catch {}
    }
    try { masterOutputNode.connect(audioContext.destination); } catch {}
  }

  function outputDestination() {
    if (!audioContext) return null;
    return ensureMasterOutput() || audioContext.destination;
  }

  function connectMainOutput() {
    if (!mainGainNode || !audioContext) return;
    try { mainGainNode.disconnect(); } catch {}
    const fxInput = liveFxActive() ? ensureLiveFx() : null;
    if (!fxInput) stopLiveFx();
    const target = fxInput || (state.eqEnabled && eqInputNode ? eqInputNode : outputDestination());
    try { mainGainNode.connect(target); } catch {}
  }

  function clamp(n, min, max) { return Math.min(max, Math.max(min, n)); }

  function normalizeEqFilter(filter, index) {
    const fallback = DEFAULT_EQ_FILTERS[Math.min(index, DEFAULT_EQ_FILTERS.length - 1)] || DEFAULT_EQ_FILTERS[0];
    const type = ["peaking", "lowshelf", "highshelf", "lowpass", "highpass", "notch"].includes(filter?.type) ? filter.type : fallback.type;
    return {
      id: typeof filter?.id === "string" ? filter.id : `f${Date.now()}_${index}`,
      type,
      freq: clamp(Math.round(Number(filter?.freq) || fallback.freq), EQ_MIN_FREQ, EQ_MAX_FREQ),
      gain: clamp(Math.round(Number(filter?.gain) || 0), EQ_MIN_GAIN, EQ_MAX_GAIN),
      q: clamp(Number(filter?.q) || fallback.q, EQ_MIN_Q, EQ_MAX_Q),
      enabled: filter?.enabled !== false,
    };
  }

  function syncEqNodes() {
    if (!eqInputNode || !audioContext) return;
    try { eqInputNode.disconnect(); } catch {}
    eqFilters.forEach((f) => { try { f.node.disconnect(); } catch {} });

    let prev = eqInputNode;
    eqFilters.forEach((entry) => {
      const cfg = entry.cfg;
      const node = entry.node;
      node.type = cfg.type;
      node.frequency.value = cfg.freq;
      node.Q.value = cfg.q;
      node.gain.value = cfg.type === "lowpass" || cfg.type === "highpass" || cfg.type === "notch" ? 0 : cfg.gain;
      if (state.eqEnabled && cfg.enabled) {
        try { prev.connect(node); } catch {}
        prev = node;
      }
    });
    try { prev.connect(outputDestination() || audioContext.destination); } catch {}
  }

  function ensureEqChain() {
    const main = ensureMainGain();
    if (!main) return null;
    if (eqFilters.length) return { context: main.context, filters: eqFilters };
    try {
      ensureLimiter();
      eqInputNode = main.context.createGain();
      eqInputNode.gain.value = 1;
      eqFilters = state.eqFilters.map((cfg, index) => {
        const normalized = normalizeEqFilter(cfg, index);
        state.eqFilters[index] = normalized;
        return { cfg: normalized, node: main.context.createBiquadFilter() };
      });
      syncEqNodes();
      connectMainOutput();
    } catch {
      eqFilters = [];
      eqInputNode = null;
    }
    return { context: main.context, filters: eqFilters };
  }

  function applyEqState() {
    if (state.eqEnabled) ensureEqChain();
    if (eqInputNode) syncEqNodes();
    connectMainOutput();
  }

  function setEqEnabled(enabled) {
    state.eqEnabled = !!enabled;
    if (state.eqEnabled) ensureEqChain();
    applyEqState();
    syncSettingsUI();
    saveState();
    notify("settings");
  }

  /* ---------- effects: render once into a static waveform ----------
   * The old player kept WaveShaper/Delay/Convolver nodes in the live graph for
   * the whole playback. That meant continuous real-time DSP, a permanently
   * running LFO and reverb impulse rebuilds on every slider move. It also made
   * the audible state and the checkboxes drift apart after a reload.
   * Now the same chain runs once in an OfflineAudioContext and the result is
   * a plain WAV blob used as the track source. Playback itself is just audio.
   */

  function anyFxEnabled() {
    return FX_KINDS.some((kind) => !!state[`${kind}Enabled`]);
  }

  function fxSnapshot() {
    const settings = { fx: {} };
    FX_KINDS.forEach((kind) => {
      settings.fx[`${kind}Enabled`] = !!state[`${kind}Enabled`];
    });
    Object.keys(FX_RANGES).forEach((key) => { settings.fx[key] = state[key]; });
    return settings;
  }

  function fxSettingsKey() {
    return JSON.stringify(fxSnapshot().fx);
  }

  function getDecodeContext() {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return null;
    if (decodeContext && decodeContext.state !== "closed") return decodeContext;
    try { decodeContext = new AudioContextClass(); } catch { decodeContext = null; }
    return decodeContext;
  }

  function decodeTrack(url) {
    if (!url || !window.fetch) return Promise.resolve(null);
    if (decodedTrackCache.has(url)) return decodedTrackCache.get(url);
    const task = (async () => {
      const context = getDecodeContext();
      if (!context) return null;
      const response = await fetch(url, { cache: "force-cache", credentials: "same-origin" });
      if (!response.ok) return null;
      const bytes = await response.arrayBuffer();
      return await context.decodeAudioData(bytes.slice(0));
    })().catch(() => null);
    // Decoded PCM is heavy: keep only a few files. A render already holding a
    // promise is unaffected when its map entry is evicted.
    if (decodedTrackCache.size >= MAX_DECODED_TRACKS) {
      decodedTrackCache.delete(decodedTrackCache.keys().next().value);
    }
    decodedTrackCache.set(url, task);
    return task;
  }

  function distortionCurveAt(x, drive) {
    const amount = clamp(Number(drive) || 0, 0, 1) * 50;
    if (amount < 0.001) return x;
    return Math.tanh(x * (1 + amount)) / Math.tanh(1 + amount);
  }

  function makeDistortionCurve(drive) {
    const samples = 2048;
    const curve = new Float32Array(samples);
    for (let i = 0; i < samples; i++) {
      curve[i] = distortionCurveAt((i * 2) / (samples - 1) - 1, drive);
    }
    return curve;
  }

  function makeReverbImpulse(context, decay) {
    const seconds = clamp(Number(decay) || FX_RANGES.reverbDecay.fallback, FX_RANGES.reverbDecay.min, FX_RANGES.reverbDecay.max);
    const length = Math.max(1, Math.floor(context.sampleRate * seconds));
    const impulse = context.createBuffer(2, length, context.sampleRate);
    // Slightly steeper tails at longer decays keep the end from sounding boxy.
    const exponent = 1.9 + seconds * 0.3;
    for (let channel = 0; channel < 2; channel++) {
      const data = impulse.getChannelData(channel);
      for (let i = 0; i < length; i++) {
        const t = i / length;
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, exponent);
      }
    }
    return impulse;
  }

  // Dry/wet stage used by the offline chain. All parameters are constants for
  // the whole render — that is exactly why no real-time automation is needed.
  function makeFxStage(context, processorInput, processorOutput, mix) {
    const level = clamp(Number(mix) || 0, 0, 1);
    const input = context.createGain();
    const output = context.createGain();
    const dry = context.createGain();
    const wet = context.createGain();
    dry.gain.value = 1 - level;
    wet.gain.value = level;
    input.connect(dry);
    dry.connect(output);
    input.connect(processorInput);
    processorOutput.connect(wet);
    wet.connect(output);
    return { input, output };
  }

  function connectOfflineFxChain(context, source, destination, settings, oscillators) {
    let node = source;
    const fx = settings.fx;
    if (fx.distortionEnabled) {
      const shaper = context.createWaveShaper();
      shaper.curve = makeDistortionCurve(fx.distortionDrive);
      try { shaper.oversample = "4x"; } catch {}
      const tone = context.createBiquadFilter();
      tone.type = "lowpass";
      tone.frequency.value = 600 + clamp(fx.distortionTone, 0, 1) * 11400;
      shaper.connect(tone);
      const stage = makeFxStage(context, shaper, tone, fx.distortionMix);
      node.connect(stage.input);
      node = stage.output;
    }
    if (fx.chorusEnabled) {
      const delay = context.createDelay(0.08);
      const depth = clamp(fx.chorusDepth, 0, 1);
      delay.delayTime.value = 0.01 + depth * 0.004;
      const lfo = context.createOscillator();
      lfo.type = "sine";
      lfo.frequency.value = clamp(fx.chorusRate, FX_RANGES.chorusRate.min, FX_RANGES.chorusRate.max);
      const lfoGain = context.createGain();
      lfoGain.gain.value = depth * 0.004;
      lfo.connect(lfoGain);
      lfoGain.connect(delay.delayTime);
      lfo.start(0);
      if (oscillators) oscillators.push(lfo);
      const stage = makeFxStage(context, delay, delay, fx.chorusMix);
      node.connect(stage.input);
      node = stage.output;
    }
    if (fx.flangerEnabled) {
      const delay = context.createDelay(0.02);
      const depth = clamp(fx.flangerDepth, FX_RANGES.flangerDepth.min, FX_RANGES.flangerDepth.max);
      delay.delayTime.value = 0.004 + depth * 0.004;
      const lfo = context.createOscillator();
      lfo.type = "sine";
      lfo.frequency.value = clamp(fx.flangerRate, FX_RANGES.flangerRate.min, FX_RANGES.flangerRate.max);
      const lfoGain = context.createGain();
      lfoGain.gain.value = depth * 0.0035;
      lfo.connect(lfoGain);
      lfoGain.connect(delay.delayTime);
      lfo.start(0);
      if (oscillators) oscillators.push(lfo);
      const stage = makeFxStage(context, delay, delay, fx.flangerMix);
      node.connect(stage.input);
      node = stage.output;
    }
    if (fx.delayEnabled) {
      const delay = context.createDelay(1);
      const time = clamp(fx.delayTime, FX_RANGES.delayTime.min, FX_RANGES.delayTime.max);
      const feedback = clamp(fx.delayFeedback, FX_RANGES.delayFeedback.min, FX_RANGES.delayFeedback.max);
      delay.delayTime.value = time;
      const feedbackGain = context.createGain();
      feedbackGain.gain.value = feedback;
      const wetMix = context.createGain();
      delay.connect(wetMix);
      delay.connect(feedbackGain);
      feedbackGain.connect(delay);
      const stage = makeFxStage(context, delay, wetMix, fx.delayMix);
      node.connect(stage.input);
      node = stage.output;
    }
    if (fx.reverbEnabled) {
      const convolver = context.createConvolver();
      try { convolver.normalize = true; } catch {}
      convolver.buffer = makeReverbImpulse(context, fx.reverbDecay);
      const stage = makeFxStage(context, convolver, convolver, fx.reverbMix);
      node.connect(stage.input);
      node = stage.output;
    }
    node.connect(destination);
  }

  /* Live preview: the same chain runs in the realtime context while knobs
   * move. Once the idle timer fires, renderTrackToWav() bakes an identical
   * static copy and playback switches to it, so there is no permanent LFO or
   * convolution load during steady playback. */
  function liveFxActive() {
    return !!state.current && anyFxEnabled() && !isTrackRendered(state.current);
  }

  function stopLiveFxOscillators() {
    liveFxOscillators.forEach((osc) => { try { osc.stop(); } catch {} });
    liveFxOscillators = [];
  }

  function stopLiveFx() {
    stopLiveFxOscillators();
    if (liveFxInputNode) { try { liveFxInputNode.disconnect(); } catch {} }
    if (liveFxOutputNode) { try { liveFxOutputNode.disconnect(); } catch {} }
    liveFxSignature = "";
  }

  function normalizeBakeDelay(value) {
    const n = Number(value);
    return Number.isFinite(n)
      ? Math.min(FX_BAKE_DELAY_MAX_MS, Math.max(FX_BAKE_DELAY_MIN_MS, Math.round(n)))
      : DEFAULT_FX_BAKE_DELAY_MS;
  }

  function bakeDelayMs() {
    return normalizeBakeDelay(state.fxBakeDelayMs);
  }

  function wireLiveFxOutput() {
    if (!liveFxOutputNode) return;
    try { liveFxOutputNode.disconnect(); } catch {}
    const target = state.eqEnabled && eqInputNode ? eqInputNode : outputDestination();
    try { liveFxOutputNode.connect(target); } catch {}
  }

  function ensureLiveFx() {
    const context = sharedAudioContext();
    if (!context || !anyFxEnabled()) { stopLiveFx(); return null; }
    if (!liveFxInputNode) liveFxInputNode = context.createGain();
    if (!liveFxOutputNode) liveFxOutputNode = context.createGain();
    const signature = fxSettingsKey();
    if (liveFxSignature !== signature) {
      stopLiveFxOscillators();
      // Replace the whole graph, not just its endpoints: a delay or convolver
      // tail from the previous settings would otherwise stay connected to a
      // reused output node and bleed into the new preview.
      if (liveFxInputNode) { try { liveFxInputNode.disconnect(); } catch {} }
      if (liveFxOutputNode) { try { liveFxOutputNode.disconnect(); } catch {} }
      liveFxInputNode = context.createGain();
      liveFxOutputNode = context.createGain();
      connectOfflineFxChain(context, liveFxInputNode, liveFxOutputNode, fxSnapshot(), liveFxOscillators);
      liveFxSignature = signature;
    }
    wireLiveFxOutput();
    return liveFxInputNode;
  }

  function syncLiveFx() {
    if (!audioContext) return;
    if (liveFxActive()) ensureLiveFx();
    else stopLiveFx();
    connectMainOutput();
  }

  // 16-bit PCM WAV: every browser accepts it, and the blob is kept only for
  // this session (no server-side files are ever rewritten).
  function encodeWav(buffer) {
    const channels = Math.min(2, buffer.numberOfChannels);
    const frames = buffer.length;
    const bytesPerSample = 2;
    const dataSize = frames * channels * bytesPerSample;
    const view = new DataView(new ArrayBuffer(44 + dataSize));
    const ascii = (offset, text) => {
      for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i));
    };
    ascii(0, "RIFF");
    view.setUint32(4, 36 + dataSize, true);
    ascii(8, "WAVE");
    ascii(12, "fmt ");
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, channels, true);
    view.setUint32(24, buffer.sampleRate, true);
    view.setUint32(28, buffer.sampleRate * channels * bytesPerSample, true);
    view.setUint16(32, channels * bytesPerSample, true);
    view.setUint16(34, 16, true);
    ascii(36, "data");
    view.setUint32(40, dataSize, true);

    const data = [];
    for (let c = 0; c < channels; c++) data.push(buffer.getChannelData(c));
    let offset = 44;
    for (let i = 0; i < frames; i++) {
      for (let c = 0; c < channels; c++) {
        const sample = clamp(data[c][i] || 0, -1, 1);
        view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
        offset += 2;
      }
    }
    return new Blob([view.buffer], { type: "audio/wav" });
  }

  // Minimal FLAC encoder: verbatim 16-bit subframes. It is not the smallest
  // FLAC file, but it is dependency-free, lossless and accepted by browsers
  // and media players. Frame headers use 16-bit block size / sample rate so
  // arbitrary track lengths and sample rates work.
  function flacCrc8(bytes) {
    let crc = 0;
    for (const byte of bytes) {
      crc ^= byte;
      for (let i = 0; i < 8; i++) crc = (crc & 0x80) ? ((crc << 1) ^ 0x07) & 0xff : (crc << 1) & 0xff;
    }
    return crc;
  }

  function flacCrc16(bytes) {
    let crc = 0;
    for (const byte of bytes) {
      crc ^= byte << 8;
      for (let i = 0; i < 8; i++) crc = (crc & 0x8000) ? ((crc << 1) ^ 0x8005) & 0xffff : (crc << 1) & 0xffff;
    }
    return crc;
  }

  function flacFrameNumberBytes(value) {
    if (value < 0x80) return [value];
    if (value < 0x800) return [0xc0 | (value >> 6), 0x80 | (value & 0x3f)];
    if (value < 0x10000) return [0xe0 | (value >> 12), 0x80 | ((value >> 6) & 0x3f), 0x80 | (value & 0x3f)];
    if (value < 0x200000) return [0xf0 | (value >> 18), 0x80 | ((value >> 12) & 0x3f), 0x80 | ((value >> 6) & 0x3f), 0x80 | (value & 0x3f)];
    return [0xf8 | (value >> 24), 0x80 | ((value >> 18) & 0x3f), 0x80 | ((value >> 12) & 0x3f), 0x80 | ((value >> 6) & 0x3f), 0x80 | (value & 0x3f)];
  }

  function encodeFlac(buffer) {
    const channels = Math.min(2, buffer.numberOfChannels);
    const sampleRate = Math.max(1, Math.round(buffer.sampleRate));
    const blockSize = 4096;
    const data = [];
    for (let c = 0; c < channels; c++) data.push(buffer.getChannelData(c));

    const frames = [];
    let frameNumber = 0;
    for (let start = 0; start < buffer.length; start += blockSize) {
      const count = Math.min(blockSize, buffer.length - start);
      const header = [
        0xff, 0xfc,             // 14-bit sync, reserved 0, fixed block size
        0x7d,                   // block size / sample rate read from 16-bit fields
        channels === 2 ? 0x18 : 0x08, // channel assignment, 16-bit samples
      ];
      header.push(...flacFrameNumberBytes(frameNumber));
      header.push(((count - 1) >> 8) & 0xff, (count - 1) & 0xff);
      header.push((sampleRate >> 8) & 0xff, sampleRate & 0xff);
      header.push(flacCrc8(header));

      const frame = header.slice();
      for (let c = 0; c < channels; c++) {
        frame.push(0x01); // verbatim subframe
        const channel = data[c];
        for (let i = 0; i < count; i++) {
          const sample = clamp(channel[start + i] || 0, -1, 1);
          const value = sample < 0 ? Math.round(sample * 0x8000) : Math.round(sample * 0x7fff);
          frame.push((value >> 8) & 0xff, value & 0xff);
        }
      }
      const crc = flacCrc16(frame);
      frame.push((crc >> 8) & 0xff, crc & 0xff);
      frames.push(new Uint8Array(frame));
      frameNumber += count;
    }

    // STREAMINFO: 20-bit rate, 3-bit channels-1, 5-bit bits-1, 36-bit length,
    // then the (optional for most decoders) all-zero MD5.
    const infoBytes = new Uint8Array(34);
    const info = new DataView(infoBytes.buffer);
    info.setUint16(0, blockSize);
    info.setUint16(2, blockSize);
    let bit = 0;
    const writeBits = (value, count) => {
      for (let i = count - 1; i >= 0; i--) {
        if (Math.floor(value / (2 ** i)) % 2) {
          const index = 10 + Math.floor(bit / 8);
          info.setUint8(index, info.getUint8(index) | (1 << (7 - (bit % 8))));
        }
        bit++;
      }
    };
    writeBits(sampleRate, 20);
    writeBits(channels - 1, 3);
    writeBits(15, 5);
    writeBits(buffer.length, 36);

    return new Blob([
      new Uint8Array([0x66, 0x4c, 0x61, 0x43]), // fLaC
      new Uint8Array([0x80, 0x00, 0x00, 0x22]), // last metadata block, STREAMINFO, 34 bytes
      infoBytes,
      ...frames,
    ], { type: "audio/flac" });
  }

  const RECORDER_MIMES = {
    mp3: ["audio/mpeg", "audio/webm;codecs=mp3"],
    opus: ["audio/ogg;codecs=opus", "audio/opus", "audio/webm;codecs=opus"],
    ogg: ["audio/ogg;codecs=opus", "audio/ogg;codecs=vorbis", "audio/ogg"],
  };

  function recorderMime(format) {
    const candidates = RECORDER_MIMES[format] || [];
    if (!window.MediaRecorder || typeof window.MediaRecorder.isTypeSupported !== "function") return "";
    return candidates.find((mime) => window.MediaRecorder.isTypeSupported(mime)) || "";
  }

  // MP3/Opus/Ogg have no dependency-free encoder here. Where the browser has
  // MediaRecorder support, render the decoded buffer into a media stream in
  // real time and capture it in the requested container.
  function encodeWithMediaRecorder(buffer, format) {
    const mimeType = recorderMime(format);
    if (!mimeType) throw new Error("unsupported format");
    const context = getDecodeContext();
    if (!context || !context.createMediaStreamDestination) throw new Error("no recording context");
    const destination = context.createMediaStreamDestination();
    const source = context.createBufferSource();
    source.buffer = buffer;
    source.connect(destination);
    const chunks = [];
    const recorder = new window.MediaRecorder(destination.stream, { mimeType, audioBitsPerSecond: 192000 });
    const done = new Promise((resolve, reject) => {
      recorder.addEventListener("dataavailable", (event) => {
        if (event.data && event.data.size) chunks.push(event.data);
      });
      recorder.addEventListener("error", (event) => reject(event.error || new Error("recording failed")), { once: true });
      recorder.addEventListener("stop", () => resolve(new Blob(chunks, { type: mimeType })), { once: true });
    });
    if (context.state === "suspended") context.resume().catch(() => {});
    recorder.start();
    source.addEventListener("ended", () => {
      window.setTimeout(() => { if (recorder.state !== "inactive") recorder.stop(); }, 120);
    }, { once: true });
    source.start();
    return done;
  }

  async function decodeUrlToBuffer(url) {
    const context = getDecodeContext();
    if (!context || !url) return null;
    const response = await fetch(url, { cache: "force-cache", credentials: "same-origin" });
    if (!response.ok) throw new Error(String(response.status));
    const bytes = await response.arrayBuffer();
    return await context.decodeAudioData(bytes.slice(0));
  }

  async function renderTrackToWav(url, settings) {
    const OfflineContext = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    if (!OfflineContext) return null;
    const source = await decodeTrack(url);
    if (!source) return null;
    const reverbTail = settings.fx.reverbEnabled
      ? clamp(Number(settings.fx.reverbDecay) || FX_RANGES.reverbDecay.fallback,
        FX_RANGES.reverbDecay.min, FX_RANGES.reverbDecay.max)
      : 0;
    const feedback = settings.fx.delayEnabled
      ? clamp(Number(settings.fx.delayFeedback) || 0, FX_RANGES.delayFeedback.min, FX_RANGES.delayFeedback.max)
      : 0;
    const delayTail = feedback > 0
      ? Math.min(4, clamp(Number(settings.fx.delayTime) || FX_RANGES.delayTime.fallback,
        FX_RANGES.delayTime.min, FX_RANGES.delayTime.max) * feedback / (1 - feedback))
      : 0;
    const tail = reverbTail + delayTail;
    const length = source.length + Math.ceil(tail * source.sampleRate) + 1;
    const context = new OfflineContext(source.numberOfChannels, length, source.sampleRate);
    const input = context.createBufferSource();
    input.buffer = source;
    connectOfflineFxChain(context, input, context.destination, settings);
    input.start(0);
    const rendered = await context.startRendering();
    return encodeWav(rendered);
  }

  // Keep the blob cache bounded: a rendered long track is many megabytes.
  function rememberRenderedTrack(source, key, url) {
    const id = renderKey(source, key);
    const previous = renderedTrackCache.get(id);
    if (previous) window.setTimeout(() => URL.revokeObjectURL(previous.url), 8000);
    renderedTrackCache.delete(id);
    renderedTrackCache.set(id, { source, key, url });
    while (renderedTrackCache.size > MAX_RENDERED_TRACKS) {
      const [oldId, old] = renderedTrackCache.entries().next().value;
      renderedTrackCache.delete(oldId);
      // A crossfade copy may still be reading the old blob, so delay revocation.
      window.setTimeout(() => URL.revokeObjectURL(old.url), 8000);
    }
  }

  function ensureRenderedTrack(track) {
    const source = sourceUrl(track);
    if (!source || !anyFxEnabled()) return Promise.resolve(false);
    const settings = fxSnapshot();
    const key = JSON.stringify(settings.fx);
    const id = renderKey(source, key);
    if (renderedTrackCache.has(id)) return Promise.resolve(true);
    const pending = renderRequests.get(id);
    if (pending) return pending;

    const promise = renderTrackToWav(source, settings).then((blob) => {
      if (!blob) return false;
      rememberRenderedTrack(source, key, URL.createObjectURL(blob));
      return true;
    }).catch(() => false).finally(() => {
      if (renderRequests.get(id) === promise) renderRequests.delete(id);
    });
    renderRequests.set(id, promise);
    return promise;
  }

  function fxStatusText(active, failed) {
    if (active) return pt("effectRendering");
    if (failed) return pt("effectUnavailable");
    const left = Math.max(0, Math.ceil((fxRenderDeadline - Date.now()) / 1000));
    if (fxRenderDeadline && left > 0) return pt("effectCountdown", { s: left });
    if (isTrackRendered(state.current)) return pt("effectReady");
    return pt("effectLive", { s: Math.ceil(bakeDelayMs() / 1000) });
  }

  function setFxRendering(active, failed = false) {
    if (!active) fxRenderFailed = !!failed;
    const enabled = anyFxEnabled();
    document.querySelectorAll("[data-fx-status]").forEach((el) => {
      // Keep the warning visible after a failed render: the checkbox is on,
      // but the audible source is deliberately still the untouched original.
      el.hidden = !active && !enabled && !fxRenderFailed;
      el.textContent = fxStatusText(active, failed);
      el.classList.toggle("is-active", !!active);
      el.classList.toggle("is-unavailable", !active && !!failed);
    });
  }

  function startFxCountdown() {
    if (fxStatusTick) return;
    fxStatusTick = window.setInterval(() => {
      if (fxRenderDeadline && fxRenderDeadline <= Date.now()) {
        stopFxCountdown();
        return;
      }
      setFxRendering(false, fxRenderFailed);
    }, 500);
  }

  function stopFxCountdown() {
    if (!fxStatusTick) return;
    window.clearInterval(fxStatusTick);
    fxStatusTick = 0;
  }

  // One render per settled settings change. The original file plays through
  // the live effect chain meanwhile; the WAV only replaces it when ready.
  function requestFxRender() {
    if (fxRenderTimer) window.clearTimeout(fxRenderTimer);
    fxRenderToken++;
    const token = fxRenderToken;
    const delay = bakeDelayMs();
    fxRenderDeadline = Date.now() + delay;
    fxRenderFailed = false;
    setFxRendering(false, false);
    startFxCountdown();
    fxRenderTimer = window.setTimeout(async () => {
      fxRenderTimer = 0;
      fxRenderDeadline = 0;
      stopFxCountdown();
      const track = state.current;
      if (!track) { setFxRendering(false); return; }
      const wasPlaying = !audio.paused;
      const position = audio.currentTime || 0;
      setFxRendering(true);
      const baked = anyFxEnabled() ? await ensureRenderedTrack(track) : true;
      if (token !== fxRenderToken || state.current !== track) return;
      setFxRendering(false, !baked);
      loadCurrent({ autoplay: wasPlaying, startTime: position, fadeIn: false });
    }, delay);
  }

  function applyFxState() {
    syncFxVisual();
    // Slider movement is heard immediately; baking happens after the idle
    // delay. Both paths read the same persisted state.
    syncLiveFx();
    if (!anyFxEnabled()) {
      fxRenderDeadline = 0;
      stopFxCountdown();
      setFxRendering(false, false);
    }
    // loadCurrent() already waits for the first render during restore.
    if (!restoring) requestFxRender();
  }

  function applyBakeDelay(raw) {
    state.fxBakeDelayMs = normalizeBakeDelay(raw);
    // Re-arm an already pending bake so the visible countdown matches the
    // newly chosen idle time.
    if (fxRenderTimer) requestFxRender();
    else setFxRendering(false, fxRenderFailed);
    syncSettingsUI();
    saveState();
    notify("settings");
  }

  function setFxEnabled(kind, enabled) {
    if (!FX_KINDS.includes(kind)) return;
    state[`${kind}Enabled`] = !!enabled;
    applyFxState();
    syncSettingsUI();
    saveState();
    notify("settings");
  }

  function applyFxSetting(key, raw) {
    const range = FX_RANGES[key];
    if (!range) return;
    const value = Number(raw);
    state[key] = Number.isFinite(value) ? clamp(value, range.min, range.max) : range.fallback;
    applyFxState();
    syncSettingsUI();
    saveState();
    notify("settings");
  }

  function setEqParam(index, key, value) {
    const cfg = state.eqFilters[index];
    if (!cfg) return;
    if (key === "type") cfg.type = value;
    if (key === "freq") cfg.freq = clamp(Math.round(Number(value) || cfg.freq), EQ_MIN_FREQ, EQ_MAX_FREQ);
    if (key === "gain") cfg.gain = clamp(Math.round(Number(value) || 0), EQ_MIN_GAIN, EQ_MAX_GAIN);
    if (key === "q") cfg.q = clamp(Number(value) || cfg.q, EQ_MIN_Q, EQ_MAX_Q);
    if (key === "enabled") cfg.enabled = !!value;
    state.eqFilters[index] = normalizeEqFilter(cfg, index);
    if (state.eqEnabled) ensureEqChain();
    applyEqState();
    syncSettingsUI();
    saveState();
    notify("settings");
  }

  function addEqFilter() {
    const idx = state.eqFilters.length;
    const base = DEFAULT_EQ_FILTERS[idx % DEFAULT_EQ_FILTERS.length] || DEFAULT_EQ_FILTERS[1];
    state.eqFilters.push(normalizeEqFilter({ ...base, id: `f${Date.now()}_${idx}`, freq: base.freq, gain: 0 }, idx));
    if (eqFilters.length) { // rebuild chain cleanly
      eqFilters.forEach((f) => { try { f.node.disconnect(); } catch {} });
      eqFilters = [];
      eqInputNode = null;
    }
    if (state.eqEnabled) ensureEqChain();
    applyEqState();
    syncSettingsUI();
    saveState();
    notify("settings");
  }

  function removeEqFilter(index) {
    if (!state.eqFilters[index] || state.eqFilters.length <= 1) return;
    state.eqFilters.splice(index, 1);
    eqFilters.forEach((f) => { try { f.node.disconnect(); } catch {} });
    eqFilters = [];
    eqInputNode = null;
    if (state.eqEnabled) ensureEqChain();
    applyEqState();
    syncSettingsUI();
    saveState();
    notify("settings");
  }

  function resetEq() {
    state.eqFilters = DEFAULT_EQ_FILTERS.map((f) => ({ ...f }));
    eqFilters.forEach((f) => { try { f.node.disconnect(); } catch {} });
    eqFilters = [];
    eqInputNode = null;
    if (state.eqEnabled) ensureEqChain();
    applyEqState();
    syncSettingsUI();
    saveState();
    notify("settings");
  }

  function clampPlaybackRate(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return 1;
    return clamp(Math.round(n / PLAYBACK_RATE_STEP) * PLAYBACK_RATE_STEP, PLAYBACK_RATE_MIN, PLAYBACK_RATE_MAX);
  }

  function normalizePitchMode(id) {
    return PLAYBACK_PITCH_MODES.some((m) => m.id === id) ? id : "preserve";
  }

  function applyPlaybackRate() {
    const rate = clampPlaybackRate(state.playbackRate);
    state.playbackRate = rate;
    state.pitchMode = normalizePitchMode(state.pitchMode);
    const preserve = state.pitchMode !== "vinyl"; // tape/preserve keep stable pitch; vinyl shifts pitch with rate
    state.preservePitch = preserve;
    try { audio.playbackRate = rate; } catch {}
    try { audio.defaultPlaybackRate = rate; } catch {}
    if (audio.preservesPitch !== undefined) audio.preservesPitch = preserve;
    if (audio.mozPreservesPitch !== undefined) audio.mozPreservesPitch = preserve;
    if (audio.webkitPreservesPitch !== undefined) audio.webkitPreservesPitch = preserve;
  }

  function setPlaybackRate(rate) {
    state.playbackRate = clampPlaybackRate(rate);
    const match = PLAYBACK_RATE_MODES.find((m) => m.rate === state.playbackRate);
    state.playbackMode = match ? match.id : "custom";
    applyPlaybackRate();
    syncSettingsUI();
    saveState();
    notify("settings");
  }

  function setPlaybackMode(modeId) {
    const mode = PLAYBACK_RATE_MODES.find((m) => m.id === modeId);
    if (!mode) { state.playbackMode = "custom"; syncSettingsUI(); saveState(); notify("settings"); return; }
    state.playbackMode = mode.id;
    state.playbackRate = mode.rate;
    applyPlaybackRate();
    syncSettingsUI();
    saveState();
    notify("settings");
  }

  function setPitchMode(modeId) {
    state.pitchMode = normalizePitchMode(modeId);
    applyPlaybackRate();
    syncSettingsUI();
    saveState();
    notify("settings");
  }

  // Route the shared <audio> through a GainNode so fades are sample-accurate
  // (no zipper noise from stepping audio.volume). User volume stays on
  // audio.volume; this gain is only for transition envelopes.
  function ensureMainGain() {
    const context = sharedAudioContext();
    if (!context) return null;
    if (mainGainNode) return { context, gain: mainGainNode };
    if (!mediaSourceNode) {
      try {
        // Use the patched createMediaElementSource which caches the node.
        mediaSourceNode = context.createMediaElementSource(audio);
      } catch {
        return null;
      }
    }
    if (!mediaSourceNode) return null;
    try {
      ensureLimiter();
      mainGainNode = context.createGain();
      mainGainNode.gain.value = 1;
      mediaSourceNode.connect(mainGainNode);
      connectMainOutput();
    } catch {
      mainGainNode = null;
      return null;
    }
    return { context, gain: mainGainNode };
  }

  function destroyHowl() {
    if (!howl) return;
    const sound = howl._sounds && howl._sounds[0];
    if (sound && sound._node === audio) {
      audio.removeEventListener("error", sound._errorFn);
      audio.removeEventListener((window.Howler && window.Howler._canPlayEvent) || "canplaythrough", sound._loadFn);
      audio.removeEventListener("ended", sound._endFn);
    }
    const list = window.Howler && window.Howler._howls;
    const index = list ? list.indexOf(howl) : -1;
    if (index >= 0) list.splice(index, 1);
    howl = null;
  }

  function destroyWaviz() {
    if (wavizPlayHandler) { audio.removeEventListener("play", wavizPlayHandler); wavizPlayHandler = null; }
    if (wavizPauseHandler) { audio.removeEventListener("pause", wavizPauseHandler); wavizPauseHandler = null; }
    if (waviz) {
      try { waviz.stop(); } catch {}
      // Do not call waviz.cleanup(): it would close the shared AudioContext.
      waviz = null;
    }
    wavizCanvas?.remove();
    wavizCanvas = null;
  }

  // Some engines keep native listeners on the shared <audio> even after a
  // switch. Pause them while their engine is still current so they cannot
  // fight the next engine for control of the same element.
  function pauseExternalEngines() {
    if (state.engine === "amplitude" && window.Amplitude) {
      try { window.Amplitude.pause(); } catch {}
      // Detach Amplitude from the shared element; its next init creates a new
      // private Audio internally, so no stale callbacks remain on ours.
      try { window.Amplitude.getConfig().audio = new Audio(); } catch {}
    }
    if (state.engine === "aplayer" && aplayer) {
      try { aplayer.pause(); } catch {}
    }
    if (state.engine === "mediaelement" && mediaElementWrapper) {
      try { mediaElementWrapper.pause(); } catch {}
    }
    if (state.engine === "jplayer" && jplayerHost && window.jQuery) {
      try { window.jQuery($("labJPlayerMedia")).jPlayer("pause"); } catch {}
    }
  }

  function destroyWaveforms() {
    pauseExternalEngines();
    waveform?.removeEventListener("dblclick", handleWaveDoubleClick);
    if (waveSurfer) {
      try { waveSurfer.destroy(); } catch {}
      waveSurfer = null;
    }
    if (peaks) {
      try { peaks.destroy(); } catch {}
      peaks = null;
    }
    destroyHowl();
    destroyWaviz();
    waveform?.replaceChildren();
    hideEngineUi();
  }

  function fallbackToHtml5(options = {}) {
    const shouldReload = options.reload !== false && !!state.current;
    const autoplay = options.autoplay ?? pendingAutoplay;
    const startTime = options.startTime ?? pendingStart ?? 0;
    destroyWaveforms();
    state.engine = "html5";
    // A failed default engine stays eligible for retry next visit; an
    // explicitly chosen engine is remembered as the visitor's preference.
    hideWaveMode();
    setLoading(false);
    syncSettingsUI();
    saveState();
    // The failed engine may never have set audio.src. Without an explicit
    // reload the bar would show a track that can never start.
    if (shouldReload) loadCurrent({ autoplay, startTime, fadeIn: false });
  }

  async function createWaveSurfer(url, startAt, autoplay) {
    try { await loadWaveSurferScript(); } catch {
      fallbackToHtml5();
      return false;
    }
    if (!window.WaveSurfer) { fallbackToHtml5(); return false; }

    showWaveMode();
    // WaveSurfer has no built-in "double click toggles playback" behaviour.
    waveform.addEventListener("dblclick", handleWaveDoubleClick);
    const colors = waveformColors();

    waveSurfer = window.WaveSurfer.create({
      container: waveform,
      media: audio,
      url,
      height: 56,
      barWidth: 2,
      barGap: 1,
      barRadius: 1,
      normalize: true,
      interact: true,
      dragToSeek: true,
      cursorWidth: 1,
      cursorColor: colors.cursorColor,
      waveColor: colors.waveColor,
      progressColor: colors.progressColor,
    });

    // WaveSurfer reports 0..1 while it fetches/decodes the waveform — use it
    // for the percentage instead of the element's buffered ranges.
    waveSurfer.on("loading", (progress) => {
      const fraction = Number(progress);
      if (Number.isFinite(fraction)) setLoadingProgress(fraction <= 1 ? fraction * 100 : fraction);
    });
    waveSurfer.on("ready", () => {
      finishLoading();
      if (startAt) setTime(startAt);
      if (autoplay) attemptPlay();
    });
    // WaveSurfer v7 seeks on click/drag itself; mirroring the interaction event
    // onto the shared <audio> guarantees scrubbing with the cursor works even
    // when an external media element is used.
    waveSurfer.on("interaction", (seconds) => {
      if (Number.isFinite(seconds)) {
        introUserSeeked = true;
        setTime(seconds);
      }
    });
    // "ended" on the shared <audio> covers track completion; no need to
    // also handle WaveSurfer's "finish" (that would advance twice).
    waveSurfer.on("error", () => {
      fallbackToHtml5();
      notify("engine");
    });
    return true;
  }

  async function createPeaks(url, startAt, autoplay) {
    try { await loadPeaksScript(); } catch {
      fallbackToHtml5();
      notify("engine");
      return false;
    }
    if (!window.peaks) return false;

    const audioContext = sharedAudioContext();
    if (!audioContext) {
      fallbackToHtml5();
      notify("engine");
      return false;
    }

    showWaveMode();
    const surface = document.createElement("div");
    surface.style.width = "100%";
    surface.style.height = "100%";
    waveform.appendChild(surface);

    const colors = waveformColors();
    audio.src = url;
    audio.load();

    peaks = window.peaks.init({
      mediaElement: audio,
      mediaUrl: url,
      webAudio: { audioContext },
      zoomview: {
        container: surface,
        waveformColor: colors.waveColor,
        playedWaveformColor: colors.progressColor,
        playheadColor: colors.cursorColor,
        showAxisLabels: false,
        enablePoints: false,
        enableSegments: false,
      },
    }, (error) => {
      if (error) {
        fallbackToHtml5();
        notify("engine");
        return;
      }
      finishLoading();
      if (startAt) setTime(startAt);
      if (autoplay) attemptPlay();
    });
    return true;
  }

  /*
   * Howler.js normally manages its own hidden <audio> element. We hand it
   * the player's shared element instead, so playback, seeking, time and
   * Media Session keep working exactly as in the other engines while Howler
   * remains the component issuing play/pause/seek commands.
   */
  async function createHowler(url, startAt, autoplay) {
    try { await loadHowlerScript(); } catch {
      fallbackToHtml5();
      notify("engine");
      return false;
    }
    if (!window.Howl || !window.Howler) return false;

    showEngineUi("howler");
    audio.src = url;
    audio.load();

    const global = window.Howler;
    const obtain = global._obtainHtml5Audio;
    global._obtainHtml5Audio = () => audio;
    try {
      howl = new window.Howl({
        src: [url],
        html5: true,
        preload: true,
        loop: false,
        volume: state.volume,
        muted: state.muted,
      });
    } catch {
      howl = null;
    } finally {
      global._obtainHtml5Audio = obtain;
    }
    if (!howl) {
      fallbackToHtml5();
      notify("engine");
      return false;
    }

    howl.on("loaderror", () => {
      fallbackToHtml5();
      notify("engine");
    });
    howl.once("load", () => {
      finishLoading();
      if (startAt) setTime(startAt);
      if (autoplay) attemptPlay();
    });
    return true;
  }

  /* Waviz supplies a live Web Audio visualisation drawn on a canvas in the
     waveform row; playback itself uses the same shared <audio> element. */
  async function createWaviz(url, startAt, autoplay) {
    try { await loadWavizScript(); } catch {
      fallbackToHtml5();
      notify("engine");
      return false;
    }
    const WavizClass = wavizConstructor();
    if (!WavizClass) return false;

    const context = sharedAudioContext();
    if (!context) {
      fallbackToHtml5();
      notify("engine");
      return false;
    }

    const canvas = document.createElement("canvas");
    canvas.className = "player-waviz-canvas";
    canvas.width = 1024;
    canvas.height = 56;
    canvas.setAttribute("aria-hidden", "true");
    waveform.appendChild(canvas);
    wavizCanvas = canvas;
    showWaveMode();
    audio.src = url;
    audio.load();

    try {
      waviz = new WavizClass(canvas, audio, context);
    } catch {
      wavizCanvas?.remove();
      wavizCanvas = null;
      fallbackToHtml5();
      notify("engine");
      return false;
    }

    wavizPlayHandler = () => {
      if (!waviz) return;
      try { waviz.simpleLine(cssVar("--text") || "#ffffff").catch(() => {}); } catch {}
    };
    wavizPauseHandler = () => {
      try { waviz?.stop(); } catch {}
    };
    audio.addEventListener("play", wavizPlayHandler);
    audio.addEventListener("pause", wavizPauseHandler);

    if (startAt) setTime(startAt);
    if (autoplay) attemptPlay();
    return true;
  }

  /* MediaElement.js wraps the shared element once and then delegates play,
     pause and seeking to its native HTML5 renderer. Its own control bar is
     mounted in the player's seek row — the same place WaveSurfer uses. */
  async function createMediaElement(url, startAt, autoplay) {
    try { await loadMediaElementScript(); } catch {
      fallbackToHtml5();
      notify("engine");
      return false;
    }
    if (!window.MediaElement) {
      fallbackToHtml5();
      notify("engine");
      return false;
    }

    showEngineUi("mediaelement");
    audio.src = url;
    audio.load();
    if (!mediaElementWrapper) {
      try {
        // MediaElementPlayer builds the recognizable control bar; the plain
        // MediaElement core would only wrap the element without any UI.
        const PlayerClass = window.MediaElementPlayer || window.MediaElement;
        mediaElementWrapper = new PlayerClass(audio, {
          features: ["playpause", "current", "progress", "duration", "volume"],
        });
      } catch {
        mediaElementWrapper = null;
      }
    }
    if (!mediaElementWrapper) {
      fallbackToHtml5();
      notify("engine");
      return false;
    }
    const host = $("labMediaElement");
    const container = mediaElementWrapper.container
      || (audio.parentElement && audio.parentElement !== bar ? audio.parentElement : null);
    if (host && container && host.firstElementChild !== container) host.replaceChildren(container);
    if (startAt) setTime(startAt);
    if (autoplay) attemptPlay();
    return true;
  }

  /* AmplitudeJS keeps its own private Audio for event wiring, but after init
     its config points at the shared element. That lets Amplitude issue the
     play/pause commands without its internal "next song" handlers touching
     our queue. */
  async function createAmplitude(url, startAt, autoplay) {
    try { await loadAmplitudeScript(); } catch {
      fallbackToHtml5();
      notify("engine");
      return false;
    }
    if (!window.Amplitude) {
      fallbackToHtml5();
      notify("engine");
      return false;
    }

    showEngineUi("amplitude");
    try {
      window.Amplitude.init({
        songs: [{ name: state.current?.title || "zqwy", artist: "zqwy", url }],
        continue_next: false,
        volume: Math.round(state.volume * 100),
        debug: false,
      });
      const config = window.Amplitude.getConfig();
      config.audio = audio;
      if (config.songs?.[0]) config.active_metadata = config.songs[0];
    } catch {
      fallbackToHtml5();
      notify("engine");
      return false;
    }
    audio.src = url;
    audio.load();
    if (startAt) setTime(startAt);
    if (autoplay) attemptPlay();
    return true;
  }

  function engineHost(id) {
    let host = document.getElementById(id);
    if (!host) {
      host = document.createElement("div");
      host.id = id;
      host.setAttribute("aria-hidden", "true");
      host.style.cssText = "position:absolute;left:-99999px;top:0;width:320px;height:120px;visibility:hidden;pointer-events:none;";
      document.body.appendChild(host);
    }
    return host;
  }

  function aplayerTrack(url) {
    return {
      name: state.current?.title || "zqwy",
      artist: "zqwy",
      url,
      cover: state.current?.cover ? assetUrl(state.current.cover) : undefined,
    };
  }

  /* APlayer normally owns a hidden <audio>. Creating it while
     document.createElement('audio') returns our shared element makes APlayer
     the component driving that element instead. */
  async function createAPlayer(url, startAt, autoplay) {
    try { await loadAPlayerScript(); } catch {
      fallbackToHtml5();
      notify("engine");
      return false;
    }
    if (!window.APlayer) {
      fallbackToHtml5();
      notify("engine");
      return false;
    }

    showEngineUi("aplayer");
    const track = aplayerTrack(url);
    try {
      if (!aplayer) {
        // Render APlayer's own UI in the player's seek row. It still receives
        // the shared <audio> via the createElement shim, so its controls drive
        // the real playback.
        aplayerHost = $("labAPlayer") || engineHost("zqwy-aplayer-host");
        const position = rememberAudioDom();
        aplayer = withSharedAudioElement(() => new window.APlayer({
          container: aplayerHost,
          audio: [track],
          autoplay: false,
          theme: "#ffffff",
          loop: "none",
          order: "none",
          // Auto preload lets the shared element report real progress to the
          // loading indicator even when the track isn't auto-playing.
          preload: "auto",
          listFolded: true,
        }));
        restoreAudioDom(position);
      } else {
        aplayer.list.audios = [track];
        aplayer.setAudio(track);
      }
      aplayer.volume(state.volume, true);
    } catch {
      aplayer = null;
      fallbackToHtml5();
      notify("engine");
      return false;
    }
    if (startAt) setTime(startAt);
    if (autoplay) attemptPlay();
    return true;
  }

  /* jPlayer is loaded lazily together with its pinned jQuery dependency. The
     same createElement shim hands it the shared audio element. */
  async function createJPlayer(url, startAt, autoplay) {
    try { await loadJPlayerScript(); } catch {
      fallbackToHtml5();
      notify("engine");
      return false;
    }
    if (!window.jQuery?.fn?.jPlayer) {
      fallbackToHtml5();
      notify("engine");
      return false;
    }

    showEngineUi("jplayer");
    try {
      const media = $("labJPlayerMedia");
      jplayerHost = $("labJPlayer");
      if (media && !media.dataset.jplayerReady) {
        const position = rememberAudioDom();
        withSharedAudioElement(() => {
          window.jQuery(media).jPlayer({
            supplied: "mp3",
            preload: "auto",
            loop: false,
            cssSelectorAncestor: "#jp_container_1",
            errorAlerts: false,
            warningAlerts: false,
          });
        });
        media.dataset.jplayerReady = "true";
        restoreAudioDom(position);
      }
      window.jQuery(media).jPlayer("setMedia", { mp3: url });
    } catch {
      fallbackToHtml5();
      notify("engine");
      return false;
    }
    if (startAt) setTime(startAt);
    if (autoplay) attemptPlay();
    return true;
  }

  function loadEngine(url, startAt, autoplay) {
    setLoading(true, 0);
    switch (state.engine) {
      case "wavesurfer": return createWaveSurfer(url, startAt, autoplay);
      case "peaks": return createPeaks(url, startAt, autoplay);
      case "howler": return createHowler(url, startAt, autoplay);
      case "waviz": return createWaviz(url, startAt, autoplay);
      case "mediaelement": return createMediaElement(url, startAt, autoplay);
      case "amplitude": return createAmplitude(url, startAt, autoplay);
      case "aplayer": return createAPlayer(url, startAt, autoplay);
      case "jplayer": return createJPlayer(url, startAt, autoplay);
      default:
        hideWaveMode();
        audio.src = url;
        audio.load();
        if (autoplay) attemptPlay();
        return Promise.resolve(true);
    }
  }

  function setEngine(name) {
    if (!ENGINES.includes(name)) return;
    if (name === state.engine) {
      // Selecting the engine that is already active is still an explicit
      // choice — e.g. confirming HTML5 after the default engine failed.
      if (!state.engineExplicit) {
        state.engineExplicit = true;
        saveState();
        notify("settings");
      }
      return;
    }
    const wasPlaying = !audio.paused;
    const time = audio.currentTime || state.time || 0;

    destroyWaveforms();
    state.engine = name;
    state.engineExplicit = true;

    if (state.current) loadCurrent({ autoplay: wasPlaying, startTime: time, fadeIn: false });
    else { hideWaveMode(); cancelPreload(); }
    syncSettingsUI();
    saveState();
    notify("engine");
  }

  /* ---------- next-track preload ---------- */

  // Shuffle must choose the next index once and remember it: otherwise the
  // preloaded file and the file next() actually picks would be different.
  function pickShuffleIndex() {
    const tracks = state.context?.tracks;
    const length = tracks?.length || 0;
    if (!length) return null;
    if (shufflePick == null || shufflePick < 0 || shufflePick >= length
      || (state.current && shufflePick === state.current.index)) {
      if (length === 1) shufflePick = 0;
      else {
        do { shufflePick = Math.floor(Math.random() * length); }
        while (shufflePick === state.current?.index);
      }
    }
    return shufflePick;
  }

  function upcomingTrack() {
    if (state.queue.length) return state.queue[0];
    const tracks = state.context?.tracks;
    if (!state.current || !tracks?.length) return null;
    if (state.shuffle) {
      const index = pickShuffleIndex();
      return index == null ? null : tracks[index];
    }
    const nextIndex = state.current.index + 1;
    if (nextIndex < tracks.length) return tracks[nextIndex];
    // Manual "next" and repeat/auto-next wrap to the first track.
    if (state.repeat === "all" || state.autoNext) return tracks[0];
    return null;
  }

  function cancelPreload() {
    if (preloadTimer) { window.clearTimeout(preloadTimer); preloadTimer = 0; }
    preloadUrl = "";
    if (!preloadAudio) return;
    try { preloadAudio.pause(); } catch {}
    try { preloadAudio.removeAttribute("src"); preloadAudio.load(); } catch {}
  }

  function schedulePreload(delay = 300) {
    if (preloadTimer) window.clearTimeout(preloadTimer);
    if (!state.current || !preloadAudio) { cancelPreload(); return; }
    preloadTimer = window.setTimeout(updatePreload, delay);
  }

  function updatePreload() {
    preloadTimer = 0;
    const upcoming = upcomingTrack();
    if (!upcoming) { cancelPreload(); return; }
    const apply = () => {
      if (upcomingTrack() !== upcoming) return;
      const url = playableUrl(upcoming);
      if (!url || url === preloadUrl || url === playableUrl(state.current)) return;
      preloadUrl = url;
      try {
        preloadAudio.src = url;
        preloadAudio.load();
      } catch {
        preloadUrl = "";
      }
    };
    // Bake the upcoming track ahead of time: the actual switch then reuses the
    // blob instead of making the listener wait for an OfflineAudioContext pass.
    if (anyFxEnabled() && !isTrackRendered(upcoming)) {
      ensureRenderedTrack(upcoming).then(apply, apply);
      return;
    }
    apply();
  }

  /* ---------- playback core ---------- */

  function showBar() {
    bar.hidden = false;
    document.body.classList.add("has-player");
    if (hideTimer) { window.clearTimeout(hideTimer); hideTimer = 0; }
    void bar.offsetHeight;
    bar.classList.add("is-visible");
  }

  function hideBar(immediate = false) {
    bar.classList.remove("is-visible");
    const finish = () => {
      bar.hidden = true;
      document.body.classList.remove("has-player");
      hideTimer = 0;
    };
    if (immediate) finish();
    else hideTimer = window.setTimeout(finish, 300);
  }

  function attemptPlay() {
    if (state.engine === "howler" && howl) {
      try { howl.play(); return; } catch {}
    }
    if (state.engine === "amplitude" && window.Amplitude) {
      try { window.Amplitude.play(); return; } catch {}
    }
    if (state.engine === "aplayer" && aplayer) {
      try { aplayer.play(); return; } catch {}
    }
    if (state.engine === "jplayer" && jplayerHost && window.jQuery) {
      try { window.jQuery($("labJPlayerMedia")).jPlayer("play"); return; } catch {}
    }
    let result;
    if (state.engine === "mediaelement" && mediaElementWrapper) {
      try { result = mediaElementWrapper.play(); } catch {}
    }
    if (!result) result = audio.play();
    if (result && typeof result.catch === "function") result.catch(() => {});
  }

  function pauseAudio() {
    // A user-initiated pause must silence the fading copy of the previous
    // track too — otherwise it would keep playing until its timer runs out.
    stopFades();
    if (state.engine === "howler" && howl) {
      try { howl.pause(); return; } catch {}
    }
    if (state.engine === "amplitude" && window.Amplitude) {
      try { window.Amplitude.pause(); return; } catch {}
    }
    if (state.engine === "aplayer" && aplayer) {
      try { aplayer.pause(); return; } catch {}
    }
    if (state.engine === "jplayer" && jplayerHost && window.jQuery) {
      try { window.jQuery($("labJPlayerMedia")).jPlayer("pause"); return; } catch {}
    }
    if (state.engine === "mediaelement" && mediaElementWrapper) {
      try { mediaElementWrapper.pause(); return; } catch {}
    }
    audio.pause();
  }

  /* ---------- smooth track switching ----------
   * The outgoing track is copied into a detached <audio> and faded with a Web
   * Audio GainNode: sample-accurate, no stepped "zipper" noise. We wait until
   * that copy is really playing before replacing the shared element's src, so
   * there is no silence gap and no wrong-offset overlap of the old track. The
   * incoming track gets a configurable fade-in on the shared main gain.
   */
  function cleanupFade(fade) {
    if (!fade || fade.done) return;
    fade.done = true;
    if (fade.interval) window.clearInterval(fade.interval);
    if (fade.timeout) window.clearTimeout(fade.timeout);
    if (fade.startTimer) window.clearTimeout(fade.startTimer);
    if (fade.playTimer) window.clearTimeout(fade.playTimer);
    activeFades.delete(fade);
    const disconnect = () => {
      try { fade.source?.disconnect(); } catch {}
      try { fade.gain?.disconnect(); } catch {}
      fade.source = null;
      fade.gain = null;
      const element = fade.element;
      if (!element) return;
      try { element.pause(); } catch {}
      try { element.removeAttribute("src"); element.load(); } catch {}
    };
    // Avoid click on abrupt stop: short ramp down before disconnecting.
    if (fade.gain?.gain && audioContext) {
      try {
        const t = audioContext.currentTime;
        fade.gain.gain.cancelScheduledValues(t);
        fade.gain.gain.setValueAtTime(Math.max(0.0001, fade.gain.gain.value || 0.0001), t);
        fade.gain.gain.linearRampToValueAtTime(0.0001, t + 0.02);
      } catch {}
      window.setTimeout(disconnect, 30);
      return;
    }
    disconnect();
  }

  // `commit: false` is used only by stop(), where a pending switch must be
  // discarded instead of starting a new track after the player was closed.
  function stopFades(options = {}) {
    const commit = options.commit !== false;
    for (const fade of [...activeFades]) {
      if (commit && !fade.committed) {
        fade.committed = true;
        fade.commitNow();
      }
      cleanupFade(fade);
    }
  }

  function startFadeAutomation(fade) {
    if (fade.started || fade.done) return;
    fade.started = true;
    fade.startedAt = performance.now();
    const duration = Math.max(0, fade.duration);
    if (duration <= 0) { cleanupFade(fade); return; }

    const context = sharedAudioContext();
    if (context) {
      try {
        ensureLimiter();
        const source = context.createMediaElementSource(fade.element);
        const gain = context.createGain();
        const now = context.currentTime;
        // Equal-power fade-out: smooth, no perceived dip when mixed with fade-in.
        gain.gain.setValueAtTime(1, now);
        gain.gain.setValueCurveAtTime(
          Float32Array.from({ length: 65 }, (_, i) => Math.cos((i / 64) * Math.PI * 0.5)),
          now,
          duration / 1000,
        );
        source.connect(gain);
        gain.connect(outputDestination() || context.destination);
        fade.source = source;
        fade.gain = gain;
        fade.timeout = window.setTimeout(() => cleanupFade(fade), duration + 300);
        return;
      } catch {}
    }
    // No Web Audio available: ramp element.volume instead of cutting it.
    fade.interval = window.setInterval(() => {
      if (fade.done) return;
      const progress = Math.min(1, (performance.now() - fade.startedAt) / duration);
      fade.element.volume = Math.max(0, fade.from * Math.cos(progress * Math.PI * 0.5));
      if (progress >= 1) cleanupFade(fade);
    }, 20);
    fade.timeout = window.setTimeout(() => cleanupFade(fade), duration + 300);
  }

  function beginCrossfade(nextTrack, commit) {
    const proceed = () => { if (typeof commit === "function") commit(); };
    if (!state.crossfade || !state.fadeOutEnabled || !state.current || audio.paused || audio.ended) { proceed(); return; }

    const start = () => {
    const absoluteUrl = (value) => {
      try { return new URL(value, document.baseURI).href; } catch { return value; }
    };
    const fromUrl = absoluteUrl(audio.currentSrc || audio.src || playableUrl(state.current));
    const toUrl = nextTrack ? absoluteUrl(playableUrl(nextTrack)) : "";
    // Restarting the very same file (deep link / queue edge case) would only
    // create a phasing copy of itself — nothing to smooth there.
    if (!fromUrl || fromUrl === toUrl) { proceed(); return; }
    const fromVolume = audio.muted ? 0 : Math.max(0, Math.min(1, audio.volume));
    if (fromVolume <= 0) { proceed(); return; }
    const fromTime = Number.isFinite(audio.currentTime) ? audio.currentTime : 0;
    const duration = Math.max(0, Number(state.fadeOutMs) || 0);
    if (duration <= 0) { proceed(); return; }

    // A rapid next/next chain must not leave several overlapping ghosts.
    stopFades({ commit: true });

    const element = document.createElement("audio");
    element.preload = "auto";
    element.src = fromUrl;
    element.volume = fromVolume; // gain node only shapes 1 → 0 on top of this

    const fade = {
      element,
      source: null,
      gain: null,
      interval: 0,
      timeout: 0,
      startTimer: 0,
      playTimer: 0,
      committed: false,
      started: false,
      startedAt: 0,
      done: false,
      from: fromVolume,
      duration,
      commitNow: null,
    };
    activeFades.add(fade);

    const commitOnce = () => {
      if (fade.committed || fade.done) return;
      fade.committed = true;
      if (fade.startTimer) { window.clearTimeout(fade.startTimer); fade.startTimer = 0; }
      if (fade.playTimer) { window.clearTimeout(fade.playTimer); fade.playTimer = 0; }
      proceed();
    };
    fade.commitNow = commitOnce;

    element.addEventListener("playing", () => {
      if (fade.done) return;
      startFadeAutomation(fade);
      commitOnce();
    }, { once: true });

    const startPlayback = () => {
      if (fade.done) return;
      // Seek only after metadata exists: setting currentTime on a fresh
      // HAVE_NOTHING element is unreliable and can restart the old intro.
      try { element.currentTime = fromTime; } catch {}
      const attempt = element.play();
      if (attempt && typeof attempt.catch === "function") {
        attempt.catch(() => { startFadeAutomation(fade); commitOnce(); });
      }
      // If `playing` never fires, switch anyway instead of freezing the UI.
      fade.playTimer = window.setTimeout(() => {
        startFadeAutomation(fade);
        commitOnce();
      }, 160);
    };

    if (element.readyState >= 1) startPlayback();
    else {
      element.addEventListener("loadedmetadata", startPlayback, { once: true });
      fade.startTimer = window.setTimeout(() => {
        if (fade.committed || fade.done) return;
        fade.committed = true;
        cleanupFade(fade);
        proceed();
      }, 240);
    }
    };

    // Do not start the outgoing ghost before the incoming baked file exists:
    // otherwise the fade ends in silence while the next track is still rendering.
    if (nextTrack && anyFxEnabled() && !isTrackRendered(nextTrack)) {
      ensureRenderedTrack(nextTrack).then(start, start);
      return;
    }
    start();
  }

  /* Fade-in on the incoming track. Uses Web Audio GainNode for sample-accurate,
   * click-free ramps when available; falls back to audio.volume ramp. A short
   * minimum ramp is always applied on switches to avoid sample-start clicks. */
  function runIncomingFade(target, fadeInMs) {
    const token = ++incomingFadeToken;
    incomingFadeActive = token;
    const requested = Math.max(0, Number(fadeInMs) || 0);
    // 0 = no audible fade-in, but keep a tiny anti-click ramp.
    const duration = requested <= 0 ? 15 : requested;
    const useGain = ensureMainGain();

    // Always restore target volume; gain envelope handles the fade shape.
    audio.volume = target;

    const clearActive = () => { if (incomingFadeActive === token) incomingFadeActive = 0; };

    if (useGain) {
      const { context, gain } = useGain;
      const applyCurve = () => {
        if (token !== incomingFadeToken) return;
        const now = context.currentTime;
        try {
          gain.gain.cancelScheduledValues(now);
          gain.gain.setValueAtTime(0.0001, now);
          gain.gain.setValueCurveAtTime(
            Float32Array.from({ length: 65 }, (_, i) => Math.sin((i / 64) * Math.PI * 0.5)),
            now,
            duration / 1000,
          );
          gain.gain.setValueAtTime(1, now + duration / 1000);
        } catch {
          try { gain.gain.setValueAtTime(1, context.currentTime); } catch {}
        }
        window.setTimeout(() => {
          if (token !== incomingFadeToken) return;
          try {
            const t = context.currentTime;
            gain.gain.cancelScheduledValues(t);
            gain.gain.setValueAtTime(1, t);
          } catch {}
          clearActive();
        }, duration + 250);
      };

      // If playback hasn't started yet, schedule when it actually plays so the
      // fade isn't consumed during load/buffer silence.
      if (audio.paused) {
        try {
          gain.gain.cancelScheduledValues(context.currentTime);
          gain.gain.setValueAtTime(0.0001, context.currentTime);
        } catch {}
        const onPlay = () => { audio.removeEventListener("playing", onPlay); applyCurve(); };
        audio.addEventListener("playing", onPlay);
        // Safety if play never happens.
        window.setTimeout(() => {
          if (token !== incomingFadeToken) return;
          audio.removeEventListener("playing", onPlay);
          applyCurve();
        }, 1500);
      } else {
        applyCurve();
      }
      return;
    }

    // Fallback: ramp audio.volume (less precise, but better than a hard cut).
    const startRamp = () => {
      if (token !== incomingFadeToken) return;
      const started = performance.now();
      let frame = 0;
      const finish = () => {
        if (token !== incomingFadeToken) return;
        if (frame) window.cancelAnimationFrame(frame);
        frame = 0;
        audio.volume = target;
        clearActive();
      };
      const step = () => {
        if (token !== incomingFadeToken) return;
        const progress = Math.min(1, (performance.now() - started) / duration);
        audio.volume = target * Math.sin(progress * Math.PI * 0.5);
        if (progress < 1) frame = window.requestAnimationFrame(step);
        else finish();
      };
      audio.volume = 0;
      frame = window.requestAnimationFrame(step);
      window.setTimeout(finish, duration + 150);
    };
    if (audio.paused) audio.addEventListener("playing", startRamp, { once: true });
    else startRamp();
  }

  function loadCurrent(options = {}) {
    if (!state.current) return Promise.resolve(false);
    const track = state.current;
    const token = ++loadToken;
    const start = Number(options.startTime) || 0;
    const needsRender = anyFxEnabled() && !isTrackRendered(track);

    const apply = () => {
      if (token !== loadToken || state.current !== track) return false;
      // An explicit saved position always wins. A fresh start asks the detector
      // for the real end of the initial silence instead of jumping a fixed 12s.
      pendingStart = start;
      pendingAutoplay = options.autoplay !== false;
      // Use the saved volume, not audio.volume: a previous anti-click ramp may
      // still be in progress and would otherwise become the new ramp's target.
      const incomingTarget = !state.muted && !audio.muted
        ? Math.max(0, Math.min(1, state.volume))
        : 0;
      const fadeInEnabled = state.crossfade && state.fadeInEnabled && options.fadeIn !== false;
      const fadeInMs = fadeInEnabled ? (Number(options.fadeInMs ?? state.fadeInMs) || 0) : 0;

      // Mute main gain before src/load swap to prevent click/pop on the shared
      // element. runIncomingFade will ramp it back up.
      const preGain = ensureMainGain();
      if (preGain) {
        try {
          const t = preGain.context.currentTime;
          preGain.gain.cancelScheduledValues(t);
          preGain.gain.setValueAtTime(0.0001, t);
        } catch {}
      }

      const url = playableUrl(track);
      // A baked blob already contains the effects; the live preview must be
      // bypassed, but the original file still needs it while a render is due.
      syncLiveFx();
      destroyWaveforms();
      if (!start && state.skipIntro) prepareIntro(url);
      else {
        introToken++;
        introUserSeeked = false;
      }
      loadEngine(url, pendingStart, pendingAutoplay);
      applyPlaybackRate();
      // Warm the next file while the current one starts, so switching tracks
      // doesn't feel like waiting for a fresh network request.
      schedulePreload();
      if (incomingTarget > 0) {
        runIncomingFade(incomingTarget, fadeInMs);
      } else {
        // Ensure gain is not stuck low from a previous fade.
        if (preGain) {
          try { const t = preGain.context.currentTime; preGain.gain.cancelScheduledValues(t); preGain.gain.setValueAtTime(1, t); } catch {}
        } else {
          const g = ensureMainGain();
          if (g) { try { const t = g.context.currentTime; g.gain.cancelScheduledValues(t); g.gain.setValueAtTime(1, t); } catch {} }
        }
      }
      return true;
    };

    if (!needsRender) return Promise.resolve(apply());
    // The first switch to an unbaked track waits for its one-time render. All
    // later switches reuse the cached blob with no delay.
    setLoading(true, 10);
    return ensureRenderedTrack(track).then((baked) => {
      setFxRendering(false, !baked);
      return apply();
    }, () => {
      setFxRendering(false, true);
      return apply();
    });
  }

  function renderMetadata() {
    if (!state.current) return;
    const title = state.current.title || "";
    const albumTitle = state.context?.title || "";
    // Size the text block to the visible name length so the player has as
    // little empty space as possible next to the centred controls, while still
    // giving long album names room before truncating.
    const textEl = $("playerTitle").parentElement;
    if (textEl) {
      const chars = Math.max(title.length, albumTitle.length);
      textEl.style.setProperty("--title-chars", String(Math.min(72, Math.max(10, chars))));
    }
    $("playerTitle").textContent = title;
    $("playerAlbum").textContent = albumTitle;

    const image = $("playerCover");
    const letter = $("playerCoverLetter");
    if (state.current.cover) {
      image.src = assetUrl(state.current.cover);
      image.hidden = false;
      letter.hidden = true;
    } else {
      image.removeAttribute("src");
      image.hidden = true;
      letter.hidden = false;
      letter.textContent = (state.context?.title || "♪").replace(/^!/, "").charAt(0);
    }

    if ("mediaSession" in navigator && window.MediaMetadata) {
      try {
        navigator.mediaSession.metadata = new MediaMetadata({
          title: state.current.title || "",
          artist: "zqwy",
          album: state.context?.title || "",
          artwork: state.current.cover ? [{ src: assetUrl(state.current.cover), sizes: "512x512" }] : [],
        });
      } catch {}
    }
    updateMediaSessionState();
  }

  function updateMediaSessionState() {
    if (!("mediaSession" in navigator)) return;
    try { navigator.mediaSession.playbackState = audio.paused ? "paused" : "playing"; } catch {}
  }

  function playTrack(album, index, options = {}) {
    if (programLocked && !options.fromProgram) return;
    if (!album || !album.tracks || !album.tracks[index]) return;
    const track = album.tracks[index];
    const commit = () => {
      state.context = {
        albumId: album.id,
        title: album.title,
        cover: album.cover || null,
        tracks: album.tracks.map((item) => ({ title: item.title, path: item.path, formats: item.formats })),
      };
      state.current = {
        albumId: album.id,
        index,
        title: track.title,
        path: track.path,
        formats: track.formats,
        cover: album.cover || null,
      };
      state.time = 0;
      showBar();
      renderMetadata();
      loadCurrent({
        autoplay: options.autoplay !== false,
        startTime: options.startTime || 0,
        fadeIn: options.autoplay !== false,
      });
      saveState();
      notify("track");
    };
    if (options.autoplay !== false) beginCrossfade(track, commit);
    else commit();
  }

  function setContext(album) {
    if (programLocked || !album) return;
    const sameAlbum = state.context && state.context.albumId === album.id;
    if (!sameAlbum) {
      state.context = {
        albumId: album.id,
        title: album.title,
        cover: album.cover || null,
        tracks: album.tracks.map((item) => ({ title: item.title, path: item.path, formats: item.formats })),
      };
      saveState();
      // A new album invalidates the old album's "up next" file. Wait for an
      // explicit playTrack() before warming anything from the new context.
      cancelPreload();
    }
  }

  function selectByIndex(index, autoplay = true) {
    if (programLocked) return;
    const tracks = state.context?.tracks;
    if (!tracks || !tracks.length) return;
    const wrapped = ((index % tracks.length) + tracks.length) % tracks.length;
    const item = tracks[wrapped];
    const commit = () => {
      state.current = {
        albumId: state.context.albumId,
        index: wrapped,
        title: item.title,
        path: item.path,
        formats: item.formats,
        cover: state.context.cover,
      };
      state.time = 0;
      showBar();
      renderMetadata();
      loadCurrent({ autoplay, startTime: 0, fadeIn: autoplay });
      saveState();
      notify("track");
    };
    if (autoplay) beginCrossfade(item, commit);
    else commit();
  }

  function next(manual = false) {
    if (programLocked) return; // the radio advances strictly by the clock
    // An explicit queue always wins over the album's own order: these are the
    // tracks the visitor deliberately marked as "up next".
    if (state.queue.length) { playQueued(0); return; }
    if (!state.current || !state.context?.tracks?.length) return;
    const length = state.context.tracks.length;
    if (state.shuffle && length > 1) {
      const target = pickShuffleIndex();
      shufflePick = null; // the preloaded pick has been consumed
      selectByIndex(target ?? state.current.index + 1);
      return;
    }
    if (state.current.index + 1 < length) selectByIndex(state.current.index + 1);
    else if (manual || state.repeat === "all" || state.autoNext) selectByIndex(0);
    else pauseAudio();
  }

  function previous() {
    if (programLocked || !state.current) return;
    if (audio.currentTime > 3) { setTime(0); return; }
    selectByIndex(state.current.index - 1);
  }

  function handleEnded() {
    if (programLocked) return; // radio tick selects the next scheduled file
    if (state.repeat === "one") { setTime(0); attemptPlay(); return; }
    next(false);
  }

  function setTime(seconds, fromProgram = false) {
    if (programLocked && !fromProgram) return;
    if (!Number.isFinite(seconds)) return;
    const duration = Number.isFinite(audio.duration) ? audio.duration : seconds;
    audio.currentTime = Math.max(0, Math.min(seconds, duration));
  }

  function toggle() {
    if (!state.current) return;
    if (audio.paused) attemptPlay();
    else pauseAudio();
  }

  function stop() {
    // Closing the player must not let a pending crossfade commit a new track.
    stopFades({ commit: false });
    incomingFadeToken++;
    incomingFadeActive = 0;
    if (mainGainNode) {
      try {
        const t = audioContext.currentTime;
        mainGainNode.gain.cancelScheduledValues(t);
        mainGainNode.gain.setValueAtTime(1, t);
      } catch { mainGainNode.gain.value = 1; }
    }
    pauseAudio();
    audio.removeAttribute("src");
    audio.load();
    cancelPreload();
    setLoading(false);
    destroyWaveforms();
    setWaveMode(false);
    closeSettings();
    state.current = null;
    state.time = 0;
    hideBar();
    $("playerTitle").textContent = pt("nothingPlaying");
    $("playerAlbum").textContent = "";
    updateTime();
    saveState();
    notify("stop");
  }

  /* ---------- UI ---------- */

  function pulseElement(el, className = "is-pulsing") {
    if (!el || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    el.classList.remove(className);
    void el.offsetWidth; // restart the animation even on a rapid second click
    el.classList.add(className);
    const done = () => {
      el.classList.remove(className);
      el.removeEventListener("animationend", done);
    };
    el.addEventListener("animationend", done);
  }

  function updatePlayState() {
    const playing = !!(state.current && !audio.paused && !audio.ended);
    bar.classList.toggle("is-playing", playing);
    const playButton = $("playerPlay");
    playButton.setAttribute("aria-label", playing ? pt("pause") : pt("play"));
    pulseElement(playButton);
    updateMediaSessionState();
    notify("playstate");
  }

  function updateMuteState() {
    const muted = audio.muted || state.volume === 0;
    bar.classList.toggle("is-muted", muted);
    $("playerMute").setAttribute("aria-label", muted ? pt("muteOn") : pt("muteOff"));
    $("playerMute").setAttribute("aria-pressed", String(muted));
    notify("volume");
  }

  function updateTime() {
    const duration = Number.isFinite(audio.duration) ? audio.duration : 0;
    const current = Number.isFinite(audio.currentTime) ? audio.currentTime : 0;
    seek.value = duration ? String(Math.round((current / duration) * 1000)) : "0";
    $("playerCurrent").textContent = formatTime(current);
    $("playerDuration").textContent = formatTime(duration);
  }

  function applyShuffle() {
    $("playerShuffle").setAttribute("aria-pressed", String(state.shuffle));
    $("playerShuffle").setAttribute("aria-label", state.shuffle ? pt("shuffleOn") : pt("shuffleOff"));
  }

  function applyRepeat() {
    const button = $("playerRepeat");
    button.dataset.repeat = state.repeat;
    button.setAttribute("aria-pressed", String(state.repeat !== "off"));
    button.setAttribute("aria-label", {
      off: pt("repeatOff"), all: pt("repeatAll"), one: pt("repeatOne"),
    }[state.repeat]);
  }

  /* ---------- settings ---------- */

  function settingsFormHtml() {
    return `
<div class="player-settings-body">
  <p class="player-settings-hint" data-player-i18n="settingsHint">${pt("settingsHint")}</p>
  <div class="settings-field share-setting">
    <span class="settings-label" data-player-i18n="share">${pt("share")}</span>
    <p class="player-settings-hint" data-player-i18n="shareHint">${pt("shareHint")}</p>
    <div class="share-actions">
      <button class="player-share-btn" type="button" data-player-share data-player-i18n="shareCopy">${pt("shareCopy")}</button>
      <span class="player-share-status" data-share-status role="status" aria-live="polite"></span>
    </div>
    <input class="share-url-input" data-share-url type="text" readonly hidden aria-label="${pt("share")}" data-player-i18n-aria-label="share">
  </div>
  <div class="settings-field">
    <label class="settings-label" for="playerEngineSelect" data-player-i18n="engine">${pt("engine")}</label>
    <select class="settings-select" id="playerEngineSelect" data-player-setting="engine">
      <option value="html5" data-player-i18n="engineHtml5">${pt("engineHtml5")}</option>
      <option value="wavesurfer" data-player-i18n="engineWavesurfer">${pt("engineWavesurfer")}</option>
      <option value="peaks" data-player-i18n="enginePeaks">${pt("enginePeaks")}</option>
      <option value="howler" data-player-i18n="engineHowler">${pt("engineHowler")}</option>
      <option value="waviz" data-player-i18n="engineWaviz">${pt("engineWaviz")}</option>
      <option value="mediaelement" data-player-i18n="engineMediaelement">${pt("engineMediaelement")}</option>
      <option value="amplitude" data-player-i18n="engineAmplitude">${pt("engineAmplitude")}</option>
      <option value="aplayer" data-player-i18n="engineAplayer">${pt("engineAplayer")}</option>
      <option value="jplayer" data-player-i18n="engineJplayer">${pt("engineJplayer")}</option>
    </select>
    <p class="player-settings-hint" data-player-i18n="engineDefaultHint">${pt("engineDefaultHint")}</p>
    <p class="player-settings-hint" data-player-i18n="engineUiHint">${pt("engineUiHint")}</p>
  </div>
  <div class="settings-field">
    <label class="settings-label" for="playerFormatSelect" data-player-i18n="format">${pt("format")}</label>
    <select class="settings-select" id="playerFormatSelect" data-player-setting="format">
      <option value="opus">.opus</option>
      <option value="mp3">.mp3</option>
      <option value="wav">.wav</option>
      <option value="flac">.flac</option>
    </select>
  </div>
  <fieldset class="settings-group">
    <legend data-player-i18n="behavior">${pt("behavior")}</legend>
    <label><input type="checkbox" data-player-setting="autoNext"><span data-player-i18n="autoNext">${pt("autoNext")}</span></label>
    <label><input type="checkbox" data-player-setting="rememberPosition"><span data-player-i18n="rememberPosition">${pt("rememberPosition")}</span></label>
    <label><input type="checkbox" data-player-setting="crossfade"><span data-player-i18n="crossfade">${pt("crossfade")}</span></label>
    <label><input type="checkbox" data-player-setting="skipIntro"><span data-player-i18n="skipIntroAuto">${pt("skipIntroAuto")}</span></label>
  </fieldset>
  <div class="settings-field speed-setting" data-speed-setting>
    <div class="fade-setting-head">
      <label class="settings-label" for="playerPlaybackRate" data-player-i18n="playbackRate">${pt("playbackRate")}</label>
      <span class="fade-setting-value" id="playerPlaybackRateValue">1x</span>
    </div>
    <input class="fade-range" id="playerPlaybackRate" type="range" min="${PLAYBACK_RATE_MIN}" max="${PLAYBACK_RATE_MAX}" step="${PLAYBACK_RATE_STEP}" value="1" data-player-setting="playbackRate">
    <label class="settings-label" for="playerPlaybackMode" data-player-i18n="playbackMode">${pt("playbackMode")}</label>
    <select class="settings-select" id="playerPlaybackMode" data-player-setting="playbackMode">
      <option value="normal">${pt("modeNormal")}</option>
      <option value="slow025">${pt("modeSlow025")}</option>
      <option value="slow05">${pt("modeSlow05")}</option>
      <option value="slow075">${pt("modeSlow075")}</option>
      <option value="fast125">${pt("modeFast125")}</option>
      <option value="fast15">${pt("modeFast15")}</option>
      <option value="fast2">${pt("modeFast2")}</option>
      <option value="fast3">${pt("modeFast3")}</option>
      <option value="custom">${pt("modeCustom")}</option>
    </select>
    <label class="settings-label" for="playerPitchMode" data-player-i18n="pitchMode">${pt("pitchMode")}</label>
    <select class="settings-select" id="playerPitchMode" data-player-setting="pitchMode">
      <option value="preserve">${pt("pitchPreserve")}</option>
      <option value="vinyl">${pt("pitchVinyl")}</option>
      <option value="tape">${pt("pitchTape")}</option>
    </select>
    <p class="player-settings-hint" data-player-i18n="playbackRateHint">${pt("playbackRateHint")}</p>
  </div>
  <div class="settings-field intro-setting" data-intro-setting>
    <label class="intro-control" for="playerSilenceDb">
      <span class="intro-control-row">
        <span data-player-i18n="silenceThreshold">${pt("silenceThreshold")}</span>
        <span class="intro-control-value" id="playerSilenceDbValue"></span>
      </span>
      <input class="intro-range" id="playerSilenceDb" type="range" min="-60" max="-12" step="1" data-player-setting="silenceDb">
    </label>
    <label class="intro-control" for="playerIntroMaxSec">
      <span class="intro-control-row">
        <span data-player-i18n="introMax">${pt("introMax")}</span>
        <span class="intro-control-value" id="playerIntroMaxValue"></span>
      </span>
      <input class="intro-range" id="playerIntroMaxSec" type="range" min="5" max="120" step="1" data-player-setting="introMaxSec">
    </label>
    <p class="player-settings-hint" data-player-i18n="thresholdHint">${pt("thresholdHint")}</p>
    <p class="player-settings-hint" data-player-i18n="introMaxHint">${pt("introMaxHint")}</p>
  </div>
  <div class="settings-field fade-setting" data-fade-setting>
    <div class="fade-setting-head">
      <span class="settings-label" data-player-i18n="fadeLabel">${pt("fadeLabel")}</span>
      <span class="fade-setting-value" id="playerFadeSummary"></span>
    </div>
    <div class="fade-visual-wrap">
      <canvas class="fade-envelope-canvas" id="playerFadeCanvas" width="640" height="160" aria-label="Fade envelope"></canvas>
      <div class="fade-visual-labels">
        <span data-player-i18n="fadeIn">${pt("fadeIn")}</span>
        <span data-player-i18n="fadeOut">${pt("fadeOut")}</span>
      </div>
    </div>
    <div class="fade-controls">
      <div class="fade-control" data-fade-control="in">
        <span class="fade-control-row">
          <label class="fade-toggle"><input type="checkbox" data-player-setting="fadeInEnabled"><span data-player-i18n="fadeInEnable">${pt("fadeInEnable")}</span></label>
          <span class="fade-control-value" id="playerFadeInValue"></span>
        </span>
        <label class="visually-hidden" for="playerFadeInMs" data-player-i18n="fadeIn">${pt("fadeIn")}</label>
        <input class="fade-range" id="playerFadeInMs" type="range" min="0" max="3000" step="50" data-player-setting="fadeInMs">
      </div>
      <div class="fade-control" data-fade-control="out">
        <span class="fade-control-row">
          <label class="fade-toggle"><input type="checkbox" data-player-setting="fadeOutEnabled"><span data-player-i18n="fadeOutEnable">${pt("fadeOutEnable")}</span></label>
          <span class="fade-control-value" id="playerFadeOutValue"></span>
        </span>
        <label class="visually-hidden" for="playerFadeOutMs" data-player-i18n="fadeOut">${pt("fadeOut")}</label>
        <input class="fade-range" id="playerFadeOutMs" type="range" min="0" max="3000" step="50" data-player-setting="fadeOutMs">
      </div>
    </div>
    <p class="player-settings-hint" data-player-i18n="fadeHint">${pt("fadeHint")}</p>
  </div>
  <h3 class="settings-section-title fx-intro" data-player-i18n="effects">${pt("effects")}</h3>
  <p class="player-settings-hint fx-intro" data-player-i18n="effectsHint">${pt("effectsHint")}</p>
  <div class="settings-field fx-bake-setting fx-intro" data-fx-bake-setting>
    <span class="settings-label" data-player-i18n="fxBakeDelay">${pt("fxBakeDelay")}</span>
    <input class="fx-range" id="playerFxBakeDelay" type="range" min="${FX_BAKE_DELAY_MIN_MS}" max="${FX_BAKE_DELAY_MAX_MS}" step="1000" data-player-setting="fxBakeDelayMs">
    <p class="player-settings-hint" data-player-i18n="fxBakeDelayHint">${pt("fxBakeDelayHint")}</p>
  </div>
  <div class="fx-setting" data-fx-setting="distortion">
    <div class="fx-head">
      <label class="eq-toggle"><input type="checkbox" data-player-setting="distortionEnabled"><span data-player-i18n="distortionEnable">${pt("distortionEnable")}</span></label>
      <span class="fx-value" id="playerDistortionSummary"></span>
    </div>
    <p class="player-settings-hint" data-player-i18n="distortionHint">${pt("distortionHint")}</p>
    <canvas class="fx-visual" id="playerDistortionCanvas" width="640" height="120" aria-label="Distortion curve"></canvas>
    <div class="fx-controls">
      <label class="fx-control"><span data-player-i18n="drive">${pt("drive")}</span><input class="fx-range" type="range" min="0" max="1" step="0.01" data-player-setting="distortionDrive"></label>
      <label class="fx-control"><span data-player-i18n="tone">${pt("tone")}</span><input class="fx-range" type="range" min="0" max="1" step="0.01" data-player-setting="distortionTone"></label>
      <label class="fx-control"><span data-player-i18n="mix">${pt("mix")}</span><input class="fx-range" type="range" min="0" max="1" step="0.01" data-player-setting="distortionMix"></label>
    </div>
    <p class="player-settings-hint fx-canvas-hint" data-player-i18n="fxCanvasDistortionHint">${pt("fxCanvasDistortionHint")}</p>
  </div>
  <div class="fx-setting" data-fx-setting="chorus">
    <div class="fx-head">
      <label class="eq-toggle"><input type="checkbox" data-player-setting="chorusEnabled"><span data-player-i18n="chorusEnable">${pt("chorusEnable")}</span></label>
      <span class="fx-value" id="playerChorusSummary"></span>
    </div>
    <p class="player-settings-hint" data-player-i18n="chorusHint">${pt("chorusHint")}</p>
    <canvas class="fx-visual" id="playerChorusCanvas" width="640" height="120" aria-label="Chorus modulation"></canvas>
    <div class="fx-controls">
      <label class="fx-control"><span data-player-i18n="rate">${pt("rate")}</span><input class="fx-range" type="range" min="0.1" max="5" step="0.05" data-player-setting="chorusRate"></label>
      <label class="fx-control"><span data-player-i18n="depth">${pt("depth")}</span><input class="fx-range" type="range" min="0" max="1" step="0.01" data-player-setting="chorusDepth"></label>
      <label class="fx-control"><span data-player-i18n="mix">${pt("mix")}</span><input class="fx-range" type="range" min="0" max="1" step="0.01" data-player-setting="chorusMix"></label>
    </div>
    <p class="player-settings-hint fx-canvas-hint" data-player-i18n="fxCanvasChorusHint">${pt("fxCanvasChorusHint")}</p>
  </div>
  <div class="fx-setting" data-fx-setting="reverb">
    <div class="fx-head">
      <label class="eq-toggle"><input type="checkbox" data-player-setting="reverbEnabled"><span data-player-i18n="reverbEnable">${pt("reverbEnable")}</span></label>
      <span class="fx-value" id="playerReverbSummary"></span>
    </div>
    <p class="player-settings-hint" data-player-i18n="reverbHint">${pt("reverbHint")}</p>
    <canvas class="fx-visual" id="playerReverbCanvas" width="640" height="120" aria-label="Reverb decay"></canvas>
    <div class="fx-controls">
      <label class="fx-control"><span data-player-i18n="decay">${pt("decay")}</span><input class="fx-range" type="range" min="0.4" max="4" step="0.1" data-player-setting="reverbDecay"></label>
      <label class="fx-control"><span data-player-i18n="mix">${pt("mix")}</span><input class="fx-range" type="range" min="0" max="1" step="0.01" data-player-setting="reverbMix"></label>
    </div>
    <p class="player-settings-hint fx-canvas-hint" data-player-i18n="fxCanvasReverbHint">${pt("fxCanvasReverbHint")}</p>
  </div>
  <div class="fx-setting" data-fx-setting="flanger">
    <div class="fx-head">
      <label class="eq-toggle"><input type="checkbox" data-player-setting="flangerEnabled"><span data-player-i18n="flangerEnable">${pt("flangerEnable")}</span></label>
      <span class="fx-value" id="playerFlangerSummary"></span>
    </div>
    <p class="player-settings-hint" data-player-i18n="flangerHint">${pt("flangerHint")}</p>
    <canvas class="fx-visual" id="playerFlangerCanvas" width="640" height="120" aria-label="Flanger modulation"></canvas>
    <div class="fx-controls">
      <label class="fx-control"><span data-player-i18n="rate">${pt("rate")}</span><input class="fx-range" type="range" min="${FX_RANGES.flangerRate.min}" max="${FX_RANGES.flangerRate.max}" step="${FX_RANGES.flangerRate.step}" data-player-setting="flangerRate"></label>
      <label class="fx-control"><span data-player-i18n="depth">${pt("depth")}</span><input class="fx-range" type="range" min="${FX_RANGES.flangerDepth.min}" max="${FX_RANGES.flangerDepth.max}" step="${FX_RANGES.flangerDepth.step}" data-player-setting="flangerDepth"></label>
      <label class="fx-control"><span data-player-i18n="mix">${pt("mix")}</span><input class="fx-range" type="range" min="${FX_RANGES.flangerMix.min}" max="${FX_RANGES.flangerMix.max}" step="${FX_RANGES.flangerMix.step}" data-player-setting="flangerMix"></label>
    </div>
    <p class="player-settings-hint fx-canvas-hint" data-player-i18n="fxCanvasFlangerHint">${pt("fxCanvasFlangerHint")}</p>
  </div>
  <div class="fx-setting" data-fx-setting="delay">
    <div class="fx-head">
      <label class="eq-toggle"><input type="checkbox" data-player-setting="delayEnabled"><span data-player-i18n="delayEnable">${pt("delayEnable")}</span></label>
      <span class="fx-value" id="playerDelaySummary"></span>
    </div>
    <p class="player-settings-hint" data-player-i18n="delayHint">${pt("delayHint")}</p>
    <canvas class="fx-visual" id="playerDelayCanvas" width="640" height="120" aria-label="Delay repeats"></canvas>
    <div class="fx-controls">
      <label class="fx-control"><span data-player-i18n="delayTime">${pt("delayTime")}</span><input class="fx-range" type="range" min="${FX_RANGES.delayTime.min}" max="${FX_RANGES.delayTime.max}" step="${FX_RANGES.delayTime.step}" data-player-setting="delayTime"></label>
      <label class="fx-control"><span data-player-i18n="feedback">${pt("feedback")}</span><input class="fx-range" type="range" min="${FX_RANGES.delayFeedback.min}" max="${FX_RANGES.delayFeedback.max}" step="${FX_RANGES.delayFeedback.step}" data-player-setting="delayFeedback"></label>
      <label class="fx-control"><span data-player-i18n="mix">${pt("mix")}</span><input class="fx-range" type="range" min="${FX_RANGES.delayMix.min}" max="${FX_RANGES.delayMix.max}" step="${FX_RANGES.delayMix.step}" data-player-setting="delayMix"></label>
    </div>
    <p class="player-settings-hint fx-canvas-hint" data-player-i18n="fxCanvasDelayHint">${pt("fxCanvasDelayHint")}</p>
  </div>
  <h3 class="settings-section-title remix-intro" data-player-i18n="remixSection">${pt("remixSection")}</h3>
  <div class="settings-field remix-setting remix-intro" data-remix-setting>
    <p class="player-settings-hint" data-player-i18n="remixHint">${pt("remixHint")}</p>
    <div class="remix-actions">
      <button type="button" class="player-queue-text-btn" data-remix-action="create" data-player-i18n="createRemix">${pt("createRemix")}</button>
      <button type="button" class="player-queue-text-btn" data-remix-action="save" data-player-i18n="saveRemix">${pt("saveRemix")}</button>
      <button type="button" class="player-queue-text-btn" data-remix-action="load" data-player-i18n="loadRemix">${pt("loadRemix")}</button>
    </div>
    <label class="settings-label remix-format-label">
      <span data-player-i18n="remixFormat">${pt("remixFormat")}</span>
      <select class="settings-select" data-player-setting="remixFormat">
        ${REMIX_FORMATS.map((fmt) => `<option value="${fmt}">${fmt.toUpperCase()}</option>`).join("")}
      </select>
    </label>
    <p class="remix-message" data-remix-message role="status" aria-live="polite"></p>
    <input class="visually-hidden" type="file" data-remix-file accept=".wav,.flac,.mp3,.opus,.ogg,audio/*" aria-label="${pt("loadRemix")}">
  </div>
  <h3 class="settings-section-title eq-intro eq-section-title" data-player-i18n="equalizer">${pt("equalizer")}</h3>
  <div class="settings-field eq-setting" data-eq-setting>
    <div class="eq-setting-head">
      <label class="eq-toggle"><input type="checkbox" data-player-setting="eqEnabled"><span data-player-i18n="eqEnable">${pt("eqEnable")}</span></label>
      <div class="eq-head-actions">
        <button type="button" class="player-queue-text-btn" id="playerEqAdd" data-player-i18n="eqAdd">${pt("eqAdd")}</button>
        <button type="button" class="player-queue-text-btn eq-reset-btn" id="playerEqReset" data-player-i18n="eqReset">${pt("eqReset")}</button>
      </div>
    </div>
    <p class="player-settings-hint" data-player-i18n="eqHint">${pt("eqHint")}</p>
    <div class="eq-visual-wrap">
      <canvas class="eq-visual" id="playerEqCanvas" width="640" height="180" aria-label="Parametric EQ curve"></canvas>
      <p class="player-settings-hint eq-canvas-hint" data-player-i18n="eqCanvasHint">${pt("eqCanvasHint")}</p>
    </div>
    <div class="eq-filters" id="playerEqFilters"></div>
  </div>
  <div class="settings-field limiter-setting" data-limiter-setting>
    <label class="eq-toggle limiter-toggle"><input type="checkbox" data-player-setting="limiterEnabled"><span data-player-i18n="limiter">${pt("limiter")}</span></label>
    <label class="settings-label limiter-mode-label">
      <span data-player-i18n="limiterMode">${pt("limiterMode")}</span>
      <select class="settings-select" data-player-setting="limiterMode">
        <option value="dbfs" data-player-i18n="limiterDbfs">${pt("limiterDbfs")}</option>
        <option value="truepeak" data-player-i18n="limiterTruePeak">${pt("limiterTruePeak")}</option>
        <option value="softclip" data-player-i18n="limiterSoftClip">${pt("limiterSoftClip")}</option>
        <option value="hardclip" data-player-i18n="limiterHardClip">${pt("limiterHardClip")}</option>
      </select>
    </label>
    <p class="player-settings-hint" data-player-i18n="limiterHint">${pt("limiterHint")}</p>
    <p class="player-settings-hint" data-player-i18n="limiterModeHint">${pt("limiterModeHint")}</p>
    <div class="limiter-meter" data-limiter-meter>
      <div class="limiter-meter-head">
        <span class="settings-label" data-player-i18n="limiterMeter">${pt("limiterMeter")}</span>
        <span class="limiter-meter-value" id="playerLimiterValue">-∞ dBFS</span>
      </div>
      <div class="limiter-meter-track" aria-hidden="true">
        <div class="limiter-meter-fill" id="playerLimiterFill"></div>
        <div class="limiter-meter-hold" id="playerLimiterHold"></div>
        <div class="limiter-meter-mark"></div>
      </div>
    </div>
  </div>
</div>`;
  }

  function mountSettings() {
    document.querySelectorAll("[data-player-settings-mount]").forEach((mount) => {
      if (!mount.querySelector("[data-player-setting]")) mount.innerHTML = settingsFormHtml();
    });
    syncProgramLockUi();
    syncSettingsUI();
  }

  function formatFadeMs(ms) {
    const value = Math.max(0, Number(ms) || 0);
    if (value === 0) return pt("off");
    if (value < 1000) return `${value} ${pt("ms")}`;
    const seconds = value / 1000;
    return `${seconds % 1 === 0 ? seconds.toFixed(0) : seconds.toFixed(1)} ${pt("s")}`;
  }

  const fadeDrag = { type: null, pointerId: null, offsetIn: 0, offsetOut: 0 };

  function drawFadeEnvelope() {
    document.querySelectorAll("#playerFadeCanvas").forEach((canvas) => {
      if (!(canvas instanceof HTMLCanvasElement)) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const w = canvas.width, h = canvas.height;
      const padX = 22, padTop = 18, padBottom = 14;
      const innerW = w - padX * 2, innerH = h - padTop - padBottom;
      const inMs = clamp(Number(state.fadeInMs) || 0, 0, CROSSFADE_MAX_MS);
      const outMs = clamp(Number(state.fadeOutMs) || 0, 0, CROSSFADE_MAX_MS);
      const bg = cssVar("--bg-elevated-2") || "#141414";
      const border = cssVar("--border") || "#2a2a2a";
      const text = cssVar("--text") || "#fff";
      const muted = cssVar("--muted") || "#a3a3a3";
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = border; ctx.lineWidth = 1;
      ctx.strokeRect(padX, padTop, innerW, innerH);
      ctx.beginPath(); ctx.moveTo(padX, padTop + innerH); ctx.lineTo(padX + innerW, padTop + innerH); ctx.stroke();

      const xForMs = (ms) => padX + (clamp(ms, 0, CROSSFADE_MAX_MS) / CROSSFADE_MAX_MS) * innerW;
      const inX = xForMs(inMs);
      const outX = padX + innerW - (clamp(outMs, 0, CROSSFADE_MAX_MS) / CROSSFADE_MAX_MS) * innerW;
      const topY = padTop;
      const botY = padTop + innerH;
      const active = state.crossfade;

      // The whole ramp — not just the handle — shows whether a fade is live.
      // Disabled fades stay visible as a faint dashed guide.
      const drawRamp = (enabled, path) => {
        ctx.save();
        ctx.globalAlpha = active ? (enabled ? 1 : 0.3) : 0.18;
        path();
        ctx.fillStyle = "rgba(127,127,127,0.14)";
        ctx.fill();
        ctx.strokeStyle = enabled ? text : muted;
        ctx.lineWidth = enabled ? 2 : 1.2;
        ctx.setLineDash(enabled ? [] : [5, 5]);
        ctx.stroke();
        ctx.restore();
      };

      drawRamp(state.fadeInEnabled, () => {
        ctx.beginPath();
        ctx.moveTo(padX, botY);
        if (inMs <= 0) ctx.lineTo(padX, topY);
        else ctx.bezierCurveTo(padX + (inX - padX) * 0.25, botY, padX + (inX - padX) * 0.55, topY, inX, topY);
        ctx.lineTo(inX, botY);
        ctx.closePath();
      });
      drawRamp(state.fadeOutEnabled, () => {
        ctx.beginPath();
        ctx.moveTo(outX, topY);
        if (outMs <= 0) ctx.lineTo(padX + innerW, topY);
        else ctx.bezierCurveTo(outX + (padX + innerW - outX) * 0.45, topY, outX + (padX + innerW - outX) * 0.75, botY, padX + innerW, botY);
        ctx.lineTo(padX + innerW, topY);
        ctx.closePath();
      });

      const drawHandle = (x, type, enabled) => {
        const isActive = fadeDrag.type === type;
        const r = isActive ? 8 : 6;
        ctx.save();
        ctx.globalAlpha = active ? (enabled ? 1 : 0.45) : 0.25;
        const color = enabled ? text : muted;
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(x, topY); ctx.lineTo(x, botY); ctx.stroke();
        ctx.beginPath(); ctx.arc(x, topY, r, 0, Math.PI * 2);
        ctx.fillStyle = color; ctx.fill();
        ctx.strokeStyle = bg; ctx.lineWidth = 2; ctx.stroke();
        ctx.fillStyle = bg;
        ctx.fillRect(x - 3, topY - 2, 6, 4);
        ctx.restore();
      };
      drawHandle(inX, "in", state.fadeInEnabled);
      drawHandle(outX, "out", state.fadeOutEnabled);
      if (!state.fadeInEnabled || !state.fadeOutEnabled) {
        ctx.save();
        ctx.fillStyle = muted;
        ctx.font = "10px sans-serif";
        ctx.textAlign = "center";
        if (!state.fadeInEnabled) ctx.fillText(pt("off"), padX + (inX - padX) / 2, botY - 8);
        if (!state.fadeOutEnabled) ctx.fillText(pt("off"), (outX + padX + innerW) / 2, botY - 8);
        ctx.restore();
      }
    });
  }

  function bindFadeCanvasInteractions() {
    document.querySelectorAll("#playerFadeCanvas").forEach((canvas) => {
      if (!(canvas instanceof HTMLCanvasElement) || canvas.dataset.fadeBound === "1") return;
      canvas.dataset.fadeBound = "1";
      canvas.style.touchAction = "none";
      const toMs = (ev) => {
        const rect = canvas.getBoundingClientRect();
        const x = ((ev.clientX - rect.left) / rect.width) * canvas.width;
        const padX = 22, innerW = canvas.width - padX * 2;
        return clamp(Math.round((clamp(x - padX, 0, innerW) / innerW) * CROSSFADE_MAX_MS / 50) * 50, 0, CROSSFADE_MAX_MS);
      };
      const pick = (ev) => {
        const rect = canvas.getBoundingClientRect();
        const x = ((ev.clientX - rect.left) / rect.width) * canvas.width;
        const padX = 22, innerW = canvas.width - padX * 2;
        const inX = padX + (clamp(state.fadeInMs, 0, CROSSFADE_MAX_MS) / CROSSFADE_MAX_MS) * innerW;
        const outX = padX + innerW - (clamp(state.fadeOutMs, 0, CROSSFADE_MAX_MS) / CROSSFADE_MAX_MS) * innerW;
        const inDist = Math.abs(x - inX);
        const outDist = Math.abs(x - outX);
        if (Math.min(inDist, outDist) > 28) return inDist <= outDist ? "in" : "out";
        return inDist <= outDist ? "in" : "out";
      };
      const rawForType = (type, ev) => {
        const ms = toMs(ev);
        return type === "out" ? CROSSFADE_MAX_MS - ms : ms;
      };
      const applyDrag = (ev) => {
        const raw = rawForType(fadeDrag.type, ev);
        const offset = fadeDrag.type === "in" ? fadeDrag.offsetIn : fadeDrag.offsetOut;
        const ms = clamp(raw + offset, 0, CROSSFADE_MAX_MS);
        if (fadeDrag.type === "in") state.fadeInMs = ms; else state.fadeOutMs = ms;
        syncFadeVisual(); syncSettingsUI(); saveState(); notify("settings");
      };
      canvas.addEventListener("pointerdown", (ev) => {
        if (!state.crossfade) return;
        fadeDrag.type = pick(ev);
        fadeDrag.pointerId = ev.pointerId;
        // Keep the grab point on the handle. Without this offset a click
        // anywhere on the canvas snapped the chosen point to the cursor.
        const raw = rawForType(fadeDrag.type, ev);
        fadeDrag.offsetIn = fadeDrag.type === "in" ? clamp(state.fadeInMs, 0, CROSSFADE_MAX_MS) - raw : 0;
        fadeDrag.offsetOut = fadeDrag.type === "out" ? clamp(state.fadeOutMs, 0, CROSSFADE_MAX_MS) - raw : 0;
        canvas.setPointerCapture?.(ev.pointerId);
        applyDrag(ev);
      });
      canvas.addEventListener("pointermove", (ev) => {
        if (fadeDrag.pointerId !== ev.pointerId || !fadeDrag.type) return;
        applyDrag(ev);
      });
      const end = (ev) => {
        if (fadeDrag.pointerId !== ev.pointerId) return;
        fadeDrag.type = null; fadeDrag.pointerId = null;
        fadeDrag.offsetIn = 0; fadeDrag.offsetOut = 0;
        drawFadeEnvelope();
      };
      canvas.addEventListener("pointerup", end);
      canvas.addEventListener("pointercancel", end);
    });
  }

  function syncFadeVisual() {
    // Visual order follows the setting order: fade-in first (left), fade-out
    // last (right). The actual crossfade still overlaps both curves in time.
    const inMs = clamp(Number(state.fadeInMs) || 0, 0, CROSSFADE_MAX_MS);
    const outMs = clamp(Number(state.fadeOutMs) || 0, 0, CROSSFADE_MAX_MS);
    document.querySelectorAll("#playerFadeSummary").forEach((el) => { el.textContent = `${formatFadeMs(inMs)} / ${formatFadeMs(outMs)}`; });
    document.querySelectorAll("#playerFadeOutValue").forEach((el) => { el.textContent = formatFadeMs(outMs); });
    document.querySelectorAll("#playerFadeInValue").forEach((el) => { el.textContent = formatFadeMs(inMs); });
    bindFadeCanvasInteractions();
    drawFadeEnvelope();

    document.querySelectorAll("[data-fade-setting]").forEach((el) => {
      el.classList.toggle("is-disabled", !state.crossfade);
      el.querySelectorAll("input[data-player-setting='fadeInMs'], input[data-player-setting='fadeOutMs']").forEach((input) => {
        input.disabled = !state.crossfade;
      });
    });
    document.querySelectorAll("[data-fade-control]").forEach((el) => {
      const name = el.dataset.fadeControl === "in" ? "fadeInEnabled" : "fadeOutEnabled";
      el.classList.toggle("is-off", !state.crossfade || !state[name]);
      const range = el.querySelector("input[type='range']");
      if (range) range.disabled = !state.crossfade || !state[name];
    });
  }

  function syncIntroVisual() {
    document.querySelectorAll("#playerSilenceDbValue").forEach((el) => {
      el.textContent = `${state.silenceDb} ${pt("db")}`;
    });
    document.querySelectorAll("#playerIntroMaxValue").forEach((el) => {
      el.textContent = `${state.introMaxSec} ${pt("s")}`;
    });
    document.querySelectorAll("[data-intro-setting]").forEach((el) => {
      el.classList.toggle("is-disabled", !state.skipIntro);
      el.querySelectorAll("input").forEach((input) => { input.disabled = !state.skipIntro; });
    });
  }

  function syncPlaybackVisual() {
    document.querySelectorAll("#playerPlaybackRateValue").forEach((el) => {
      const v = clampPlaybackRate(state.playbackRate);
      el.textContent = `${Number.isInteger(v) ? v.toFixed(0) : v.toFixed(2).replace(/0+$/, "").replace(/\.$/, "")}x`;
    });
  }

  function eqResponseAt(freq, cfg) {
    const f = clamp(freq, EQ_MIN_FREQ, EQ_MAX_FREQ);
    const f0 = clamp(cfg.freq, EQ_MIN_FREQ, EQ_MAX_FREQ);
    const Q = clamp(cfg.q || 1, EQ_MIN_Q, EQ_MAX_Q);
    const gain = clamp(cfg.gain || 0, EQ_MIN_GAIN, EQ_MAX_GAIN);
    const w0 = f / f0;
    switch (cfg.type) {
      case "lowshelf": {
        const g = Math.pow(10, gain / 40);
        const x = Math.log2(Math.max(w0, 0.001));
        const k = 1 / (1 + Math.exp(x * 4));
        return 20 * Math.log10(1 + (g - 1) * k);
      }
      case "highshelf": {
        const g = Math.pow(10, gain / 40);
        const x = Math.log2(Math.max(w0, 0.001));
        const k = 1 / (1 + Math.exp(-x * 4));
        return 20 * Math.log10(1 + (g - 1) * k);
      }
      case "lowpass": {
        const d = Math.pow(w0, 2) - 1;
        const b = w0 / Q;
        return 20 * Math.log10(1 / Math.sqrt(d * d + b * b));
      }
      case "highpass": {
        const d = 1 - Math.pow(w0, 2);
        const b = w0 / Q;
        return 20 * Math.log10((w0 * w0) / Math.sqrt(d * d + b * b));
      }
      case "notch": {
        const d = 1 - Math.pow(w0, 2);
        const b = w0 / Q;
        return 20 * Math.log10(Math.abs(d) / Math.sqrt(d * d + b * b));
      }
      default: { // peaking
        const A = Math.pow(10, gain / 40);
        const d = 1 - Math.pow(w0, 2);
        const b = w0 / Q;
        const num = Math.sqrt(Math.pow(d, 2) + Math.pow(A * b, 2));
        const den = Math.sqrt(Math.pow(d, 2) + Math.pow(b / A, 2));
        return 20 * Math.log10(num / den);
      }
    }
  }

  function eqCanvasMetrics(canvas) {
    const w = canvas.width, h = canvas.height;
    const padX = 28, padY = 14;
    const innerW = w - padX * 2, innerH = h - padY * 2;
    const dbToY = (db) => padY + innerH * (1 - (db - EQ_MIN_GAIN) / (EQ_MAX_GAIN - EQ_MIN_GAIN));
    const yToDb = (y) => EQ_MIN_GAIN + (1 - (clamp(y, padY, h - padY) - padY) / innerH) * (EQ_MAX_GAIN - EQ_MIN_GAIN);
    const freqToX = (f) => padX + innerW * (Math.log10(clamp(f, EQ_MIN_FREQ, EQ_MAX_FREQ) / EQ_MIN_FREQ) / Math.log10(EQ_MAX_FREQ / EQ_MIN_FREQ));
    const xToFreq = (x) => EQ_MIN_FREQ * Math.pow(EQ_MAX_FREQ / EQ_MIN_FREQ, clamp(x - padX, 0, innerW) / innerW);
    return { w, h, padX, padY, innerW, innerH, dbToY, yToDb, freqToX, xToFreq };
  }

  function drawEqCurve() {
    document.querySelectorAll("#playerEqCanvas").forEach((canvas) => {
      if (!(canvas instanceof HTMLCanvasElement)) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const m = eqCanvasMetrics(canvas);
      const { w, h, padX, padY, dbToY, freqToX } = m;
      ctx.clearRect(0, 0, w, h);
      const bg = cssVar("--bg-elevated-2") || "#141414";
      const border = cssVar("--border") || "#2a2a2a";
      const text = cssVar("--text") || "#ffffff";
      const muted = cssVar("--muted") || "#a3a3a3";
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);

      ctx.strokeStyle = border;
      ctx.lineWidth = 1;
      [-36, -24, -12, 0, 12, 24, 36].forEach((db) => {
        const y = dbToY(db);
        ctx.beginPath(); ctx.moveTo(padX, y); ctx.lineTo(w - padX, y); ctx.stroke();
      });
      [31, 62, 125, 250, 500, 1000, 2000, 4000, 8000, 16000].forEach((f) => {
        const x = freqToX(f);
        ctx.beginPath(); ctx.moveTo(x, padY); ctx.lineTo(x, h - padY); ctx.stroke();
      });
      ctx.fillStyle = muted;
      ctx.font = "10px system-ui, sans-serif";
      ctx.textAlign = "right";
      [36, 24, 12, 0, -12, -24, -36].forEach((db) => ctx.fillText(`${db}`, padX - 4, dbToY(db) + 3));

      const filters = (state.eqFilters || []).filter((f) => f && f.enabled);
      const points = [];
      for (let i = 0; i <= m.innerW; i++) {
        const f = EQ_MIN_FREQ * Math.pow(EQ_MAX_FREQ / EQ_MIN_FREQ, i / m.innerW);
        let db = 0;
        for (const cfg of filters) db += eqResponseAt(f, cfg);
        db = clamp(db, EQ_MIN_GAIN - 6, EQ_MAX_GAIN + 6);
        points.push({ x: padX + i, y: dbToY(db) });
      }

      ctx.beginPath();
      points.forEach((p, i) => { if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y); });
      ctx.strokeStyle = state.eqEnabled ? text : muted;
      ctx.lineWidth = 2;
      ctx.stroke();
      const zeroY = dbToY(0);
      ctx.lineTo(w - padX, zeroY); ctx.lineTo(padX, zeroY); ctx.closePath();
      ctx.fillStyle = state.eqEnabled ? "rgba(255,255,255,0.08)" : "rgba(163,163,163,0.06)";
      ctx.fill();

      (state.eqFilters || []).forEach((cfg, index) => {
        let db = 0;
        for (const c of filters) db += eqResponseAt(cfg.freq, c);
        const x = freqToX(cfg.freq);
        const y = dbToY(clamp(db, EQ_MIN_GAIN - 6, EQ_MAX_GAIN + 6));
        ctx.beginPath();
        ctx.arc(x, y, eqDrag.index === index ? 6 : 4.5, 0, Math.PI * 2);
        ctx.fillStyle = !state.eqEnabled || !cfg.enabled ? muted : text;
        ctx.fill();
        ctx.strokeStyle = bg;
        ctx.lineWidth = 1.5;
        ctx.stroke();
      });
    });
  }

  const eqDrag = { index: -1, pointerId: null };
  function eqCanvasPoint(canvas, ev) {
    const rect = canvas.getBoundingClientRect();
    const x = ((ev.clientX - rect.left) / rect.width) * canvas.width;
    const y = ((ev.clientY - rect.top) / rect.height) * canvas.height;
    return { x, y };
  }
  function eqHitTest(canvas, ev) {
    const p = eqCanvasPoint(canvas, ev);
    const m = eqCanvasMetrics(canvas);
    let best = -1, bestDist = Infinity;
    (state.eqFilters || []).forEach((cfg, index) => {
      const filters = (state.eqFilters || []).filter((f) => f && f.enabled);
      let db = 0;
      for (const c of filters) db += eqResponseAt(cfg.freq, c);
      const x = m.freqToX(cfg.freq);
      const y = m.dbToY(clamp(db, EQ_MIN_GAIN - 6, EQ_MAX_GAIN + 6));
      const dist = Math.hypot(p.x - x, p.y - y);
      if (dist < 14 && dist < bestDist) { best = index; bestDist = dist; }
    });
    return best;
  }
  function applyEqCanvasDrag(canvas, ev) {
    if (eqDrag.index < 0) return;
    const cfg = state.eqFilters[eqDrag.index];
    if (!cfg) return;
    const p = eqCanvasPoint(canvas, ev);
    const m = eqCanvasMetrics(canvas);
    const freq = clamp(Math.round(m.xToFreq(p.x)), EQ_MIN_FREQ, EQ_MAX_FREQ);
    const gain = clamp(Math.round(m.yToDb(p.y)), EQ_MIN_GAIN, EQ_MAX_GAIN);
    cfg.freq = freq;
    if (cfg.type !== "lowpass" && cfg.type !== "highpass" && cfg.type !== "notch") cfg.gain = gain;
    state.eqFilters[eqDrag.index] = normalizeEqFilter(cfg, eqDrag.index);
    if (state.eqEnabled) ensureEqChain();
    applyEqState();
    syncSettingsUI();
    saveState();
    notify("settings");
  }

  function bindEqCanvasInteractions() {
    document.querySelectorAll("#playerEqCanvas").forEach((canvas) => {
      if (!(canvas instanceof HTMLCanvasElement) || canvas.dataset.eqBound === "1") return;
      canvas.dataset.eqBound = "1";
      canvas.style.touchAction = "none";
      canvas.addEventListener("pointerdown", (ev) => {
        if (!state.eqEnabled) return;
        const idx = eqHitTest(canvas, ev);
        if (idx < 0) return;
        eqDrag.index = idx; eqDrag.pointerId = ev.pointerId;
        canvas.setPointerCapture?.(ev.pointerId);
        applyEqCanvasDrag(canvas, ev);
      });
      canvas.addEventListener("pointermove", (ev) => {
        if (eqDrag.pointerId !== ev.pointerId || eqDrag.index < 0) return;
        applyEqCanvasDrag(canvas, ev);
      });
      const end = (ev) => {
        if (eqDrag.pointerId !== ev.pointerId) return;
        eqDrag.index = -1; eqDrag.pointerId = null;
        drawEqCurve();
      };
      canvas.addEventListener("pointerup", end);
      canvas.addEventListener("pointercancel", end);
    });
  }

  function renderEqFilters() {
    document.querySelectorAll("#playerEqFilters").forEach((container) => {
      container.replaceChildren();
      state.eqFilters.forEach((cfg, index) => {
        const row = document.createElement("div");
        row.className = "eq-filter";
        row.dataset.eqIndex = String(index);
        row.innerHTML = `
          <div class="eq-filter-head">
            <label class="eq-toggle"><input type="checkbox" data-eq-field="enabled" ${cfg.enabled ? "checked" : ""}><span>${cfg.type} #${index + 1}</span></label>
            <button type="button" class="player-queue-text-btn" data-eq-remove="${index}">${pt("eqRemove")}</button>
          </div>
          <div class="eq-filter-grid">
            <label class="eq-field"><span>${pt("eqType")}</span>
              <select class="settings-select" data-eq-field="type">
                ${["peaking","lowshelf","highshelf","lowpass","highpass","notch"].map((t) => `<option value="${t}" ${cfg.type===t?"selected":""}>${t}</option>`).join("")}
              </select>
            </label>
            <label class="eq-field"><span>${pt("eqFreq")}</span><input class="settings-select" type="number" min="${EQ_MIN_FREQ}" max="${EQ_MAX_FREQ}" step="1" value="${cfg.freq}" data-eq-field="freq"></label>
            <label class="eq-field"><span>${pt("eqGain")}</span><input class="settings-select" type="number" min="${EQ_MIN_GAIN}" max="${EQ_MAX_GAIN}" step="1" value="${cfg.gain}" data-eq-field="gain"></label>
            <label class="eq-field"><span>${pt("eqQ")}</span><input class="settings-select" type="number" min="${EQ_MIN_Q}" max="${EQ_MAX_Q}" step="0.1" value="${cfg.q}" data-eq-field="q"></label>
          </div>`;
        container.appendChild(row);
      });
    });
  }

  function syncEqVisual() {
    renderEqFilters();
    bindEqCanvasInteractions();
    drawEqCurve();
    document.querySelectorAll("[data-eq-setting]").forEach((root) => {
      root.classList.toggle("is-disabled", !state.eqEnabled);
      root.querySelectorAll("input,select,button").forEach((el) => {
        if (el.id === "playerEqAdd" || el.id === "playerEqReset" || el.closest(".eq-toggle")) return;
        if (el.dataset.playerSetting === "eqEnabled") return;
        el.disabled = !state.eqEnabled;
      });
    });
  }

  function fxPercent(value) {
    return `${Math.round(clamp(Number(value) || 0, 0, 1) * 100)}%`;
  }

  function drawFxCanvas(canvas, draw) {
    if (!(canvas instanceof HTMLCanvasElement)) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const w = canvas.width, h = canvas.height;
    const bg = cssVar("--bg-elevated-2") || "#141414";
    const border = cssVar("--border") || "#2a2a2a";
    const text = cssVar("--text") || "#ffffff";
    const muted = cssVar("--muted") || "#a3a3a3";
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = border;
    ctx.lineWidth = 1;
    for (let i = 1; i < 4; i++) {
      const x = (w * i) / 4;
      const y = (h * i) / 4;
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
    }
    draw(ctx, { w, h, bg, border, text, muted });
  }

  function drawFxVisuals() {
    document.querySelectorAll("#playerDistortionCanvas").forEach((canvas) => {
      drawFxCanvas(canvas, (ctx, m) => {
        const pad = 12;
        const innerW = m.w - pad * 2, innerH = m.h - pad * 2;
        ctx.strokeStyle = m.border;
        ctx.beginPath(); ctx.moveTo(pad, pad + innerH / 2); ctx.lineTo(m.w - pad, pad + innerH / 2); ctx.stroke();
        ctx.beginPath();
        for (let i = 0; i <= innerW; i++) {
          const input = (i / innerW) * 2 - 1;
          const output = distortionCurveAt(input, state.distortionDrive);
          const x = pad + i;
          const y = pad + (innerH * (1 - output)) / 2;
          if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.strokeStyle = state.distortionEnabled ? m.text : m.muted;
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(pad + clamp(state.distortionTone, 0, 1) * innerW, pad + innerH / 2, 5, 0, Math.PI * 2);
        ctx.fillStyle = state.distortionEnabled ? m.text : m.muted;
        ctx.fill();
      });
    });

    document.querySelectorAll("#playerChorusCanvas").forEach((canvas) => {
      drawFxCanvas(canvas, (ctx, m) => {
        const pad = 12;
        const innerW = m.w - pad * 2, innerH = m.h - pad * 2;
        const center = pad + innerH / 2;
        const cycles = 1 + (clamp(state.chorusRate, FX_RANGES.chorusRate.min, FX_RANGES.chorusRate.max) / FX_RANGES.chorusRate.max) * 5;
        const amplitude = innerH * (0.12 + clamp(state.chorusDepth, 0, 1) * 0.34);
        ctx.strokeStyle = m.border;
        ctx.beginPath(); ctx.moveTo(pad, center); ctx.lineTo(m.w - pad, center); ctx.stroke();
        ctx.beginPath();
        for (let i = 0; i <= innerW; i++) {
          const x = pad + i;
          const y = center - Math.sin((i / innerW) * Math.PI * 2 * cycles) * amplitude;
          if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.strokeStyle = state.chorusEnabled ? m.text : m.muted;
        ctx.lineWidth = 2;
        ctx.stroke();
        const handleX = pad + ((state.chorusRate - FX_RANGES.chorusRate.min) / (FX_RANGES.chorusRate.max - FX_RANGES.chorusRate.min)) * innerW;
        const handleY = center - amplitude;
        ctx.beginPath(); ctx.arc(handleX, handleY, 5, 0, Math.PI * 2);
        ctx.fillStyle = state.chorusEnabled ? m.text : m.muted;
        ctx.fill();
      });
    });

    document.querySelectorAll("#playerFlangerCanvas").forEach((canvas) => {
      drawFxCanvas(canvas, (ctx, m) => {
        const pad = 12;
        const innerW = m.w - pad * 2, innerH = m.h - pad * 2;
        const center = pad + innerH / 2;
        const rate = clamp(state.flangerRate, FX_RANGES.flangerRate.min, FX_RANGES.flangerRate.max);
        const depth = clamp(state.flangerDepth, FX_RANGES.flangerDepth.min, FX_RANGES.flangerDepth.max);
        const cycles = 1 + (rate / FX_RANGES.flangerRate.max) * 8;
        const amplitude = innerH * (0.1 + depth * 0.38);
        ctx.strokeStyle = m.border;
        ctx.beginPath(); ctx.moveTo(pad, center); ctx.lineTo(m.w - pad, center); ctx.stroke();
        ctx.beginPath();
        for (let i = 0; i <= innerW; i++) {
          const x = pad + i;
          const y = center - Math.sin((i / innerW) * Math.PI * 2 * cycles) * amplitude;
          if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.strokeStyle = state.flangerEnabled ? m.text : m.muted;
        ctx.lineWidth = 2;
        ctx.stroke();
        const handleX = pad + ((rate - FX_RANGES.flangerRate.min) / (FX_RANGES.flangerRate.max - FX_RANGES.flangerRate.min)) * innerW;
        const handleY = center - amplitude;
        ctx.beginPath(); ctx.arc(handleX, handleY, 5, 0, Math.PI * 2);
        ctx.fillStyle = state.flangerEnabled ? m.text : m.muted;
        ctx.fill();
      });
    });

    document.querySelectorAll("#playerDelayCanvas").forEach((canvas) => {
      drawFxCanvas(canvas, (ctx, m) => {
        const pad = 12;
        const innerW = m.w - pad * 2, innerH = m.h - pad * 2;
        const time = clamp(state.delayTime, FX_RANGES.delayTime.min, FX_RANGES.delayTime.max);
        const feedback = clamp(state.delayFeedback, FX_RANGES.delayFeedback.min, FX_RANGES.delayFeedback.max);
        const spacing = (time / FX_RANGES.delayTime.max) * (innerW / 6);
        ctx.strokeStyle = m.border;
        ctx.beginPath(); ctx.moveTo(pad, pad + innerH); ctx.lineTo(m.w - pad, pad + innerH); ctx.stroke();
        for (let i = 0; i < 7; i++) {
          const level = Math.pow(feedback / FX_RANGES.delayFeedback.max, i);
          const x = pad + i * spacing;
          const height = innerH * (0.18 + level * 0.72);
          ctx.strokeStyle = state.delayEnabled ? m.text : m.muted;
          ctx.globalAlpha = 0.25 + level * 0.75;
          ctx.lineWidth = 2;
          ctx.beginPath(); ctx.moveTo(x, pad + innerH); ctx.lineTo(x, pad + innerH - height); ctx.stroke();
        }
        ctx.globalAlpha = 1;
      });
    });

    document.querySelectorAll("#playerReverbCanvas").forEach((canvas) => {
      drawFxCanvas(canvas, (ctx, m) => {
        const pad = 12;
        const innerW = m.w - pad * 2, innerH = m.h - pad * 2;
        const center = pad + innerH / 2;
        const decayNorm = (clamp(state.reverbDecay, FX_RANGES.reverbDecay.min, FX_RANGES.reverbDecay.max) - FX_RANGES.reverbDecay.min) / (FX_RANGES.reverbDecay.max - FX_RANGES.reverbDecay.min);
        const stretch = 0.25 + decayNorm * 0.75;
        const top = [], bottom = [];
        for (let i = 0; i <= innerW; i++) {
          const t = i / innerW;
          const envelope = Math.exp((-5 * t) / stretch) * innerH * 0.45;
          top.push({ x: pad + i, y: center - envelope });
          bottom.push({ x: pad + i, y: center + envelope });
        }
        ctx.beginPath();
        top.forEach((p, i) => { if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y); });
        for (let i = bottom.length - 1; i >= 0; i--) ctx.lineTo(bottom[i].x, bottom[i].y);
        ctx.closePath();
        ctx.fillStyle = state.reverbEnabled ? "rgba(255,255,255,0.12)" : "rgba(163,163,163,0.08)";
        ctx.fill();
        ctx.beginPath();
        top.forEach((p, i) => { if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y); });
        ctx.strokeStyle = state.reverbEnabled ? m.text : m.muted;
        ctx.lineWidth = 2;
        ctx.stroke();
        const handleX = pad + decayNorm * innerW;
        const handleY = pad + innerH * (1 - clamp(state.reverbMix, 0, 1));
        ctx.beginPath(); ctx.arc(handleX, handleY, 5, 0, Math.PI * 2);
        ctx.fillStyle = state.reverbEnabled ? m.text : m.muted;
        ctx.fill();
      });
    });
  }

  const fxDrag = { kind: null, pointerId: null };
  function fxCanvasPoint(canvas, ev) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: clamp((ev.clientX - rect.left) / rect.width, 0, 1),
      y: clamp((ev.clientY - rect.top) / rect.height, 0, 1),
    };
  }
  function applyFxCanvasDrag(canvas, ev) {
    if (!fxDrag.kind) return;
    const p = fxCanvasPoint(canvas, ev);
    const round = (v) => Math.round(v * 100) / 100;
    if (fxDrag.kind === "distortion") {
      state.distortionTone = round(p.x);
      state.distortionDrive = round(1 - p.y);
    } else if (fxDrag.kind === "chorus") {
      state.chorusRate = round(FX_RANGES.chorusRate.min + p.x * (FX_RANGES.chorusRate.max - FX_RANGES.chorusRate.min));
      state.chorusDepth = round(1 - p.y);
    } else if (fxDrag.kind === "flanger") {
      state.flangerRate = round(FX_RANGES.flangerRate.min + p.x * (FX_RANGES.flangerRate.max - FX_RANGES.flangerRate.min));
      state.flangerDepth = round(1 - p.y);
    } else if (fxDrag.kind === "delay") {
      state.delayTime = round(FX_RANGES.delayTime.min + p.x * (FX_RANGES.delayTime.max - FX_RANGES.delayTime.min));
      state.delayFeedback = round(p.y * FX_RANGES.delayFeedback.max);
    } else if (fxDrag.kind === "reverb") {
      state.reverbDecay = round(FX_RANGES.reverbDecay.min + p.x * (FX_RANGES.reverbDecay.max - FX_RANGES.reverbDecay.min));
      state.reverbMix = round(1 - p.y);
    }
    applyFxState();
    syncSettingsUI();
    saveState();
    notify("settings");
  }
  function bindFxCanvasInteractions() {
    document.querySelectorAll(".fx-visual").forEach((canvas) => {
      if (!(canvas instanceof HTMLCanvasElement) || canvas.dataset.fxBound === "1") return;
      canvas.dataset.fxBound = "1";
      canvas.style.touchAction = "none";
      const kind = String(canvas.id || "").replace(/^player/, "").replace(/Canvas$/, "").toLowerCase();
      canvas.addEventListener("pointerdown", (ev) => {
        if (!FX_KINDS.includes(kind)) return;
        state[`${kind}Enabled`] = true;
        fxDrag.kind = kind;
        fxDrag.pointerId = ev.pointerId;
        try { canvas.setPointerCapture?.(ev.pointerId); } catch {}
        applyFxCanvasDrag(canvas, ev);
      });
      canvas.addEventListener("pointermove", (ev) => {
        if (fxDrag.pointerId !== ev.pointerId || fxDrag.kind !== kind) return;
        applyFxCanvasDrag(canvas, ev);
      });
      const end = (ev) => {
        if (fxDrag.pointerId !== ev.pointerId) return;
        fxDrag.kind = null;
        fxDrag.pointerId = null;
        drawFxVisuals();
      };
      canvas.addEventListener("pointerup", end);
      canvas.addEventListener("pointercancel", end);
    });
  }

  function syncFxVisual() {
    bindFxCanvasInteractions();
    drawFxVisuals();
    document.querySelectorAll("#playerDistortionSummary").forEach((el) => {
      el.textContent = `${fxPercent(state.distortionDrive)} / ${fxPercent(state.distortionTone)}`;
    });
    document.querySelectorAll("#playerChorusSummary").forEach((el) => {
      el.textContent = `${state.chorusRate.toFixed(1)} Hz / ${fxPercent(state.chorusDepth)}`;
    });
    document.querySelectorAll("#playerFlangerSummary").forEach((el) => {
      el.textContent = `${Number(state.flangerRate).toFixed(2)} Hz / ${fxPercent(state.flangerDepth)}`;
    });
    document.querySelectorAll("#playerDelaySummary").forEach((el) => {
      el.textContent = `${Math.round(Number(state.delayTime) * 1000)} ${pt("ms")} / ${fxPercent(state.delayFeedback)}`;
    });
    document.querySelectorAll("#playerReverbSummary").forEach((el) => {
      el.textContent = `${Number(state.reverbDecay).toFixed(1)} s / ${fxPercent(state.reverbMix)}`;
    });
    document.querySelectorAll("[data-fx-setting]").forEach((root) => {
      const kind = root.dataset.fxSetting;
      if (!FX_KINDS.includes(kind)) return;
      const enabled = !!state[`${kind}Enabled`];
      root.classList.toggle("is-disabled", !enabled);
      root.querySelectorAll("input,select,button").forEach((el) => {
        if (el.dataset.playerSetting === `${kind}Enabled` || el.closest(".eq-toggle")) return;
        el.disabled = !enabled;
      });
    });
  }

  function updateLimiterMeter() {
    const meter = limiterEnabled ? ensureLimiterMeter() : null;
    let db = -Infinity;
    if (meter) {
      const buf = new Uint8Array(meter.fftSize);
      meter.getByteTimeDomainData(buf);
      let peak = 0;
      for (let i = 0; i < buf.length; i++) {
        const s = Math.abs((buf[i] - 128) / 128);
        if (s > peak) peak = s;
      }
      limiterPeak = peak;
      db = peak > 0 ? 20 * Math.log10(peak) : -Infinity;
      const now = performance.now();
      if (db >= limiterPeakHold || now - limiterPeakHoldAt > 1200) {
        limiterPeakHold = db;
        limiterPeakHoldAt = now;
      }
    } else {
      limiterPeak = 0;
      limiterPeakHold = -Infinity;
    }

    const pct = (value) => {
      if (!Number.isFinite(value)) return 0;
      return clamp(((value + 60) / 60) * 100, 0, 100);
    };
    const dbText = Number.isFinite(db) ? `${db.toFixed(1)} dBFS` : "-∞ dBFS";
    document.querySelectorAll("#playerLimiterValue").forEach((el) => { el.textContent = dbText; });
    document.querySelectorAll("#playerLimiterFill").forEach((el) => { el.style.width = `${pct(db)}%`; });
    document.querySelectorAll("#playerLimiterHold").forEach((el) => { el.style.left = `${pct(limiterPeakHold)}%`; });

    if (!settingsPanel || settingsPanel.hidden) {
      limiterMeterRaf = 0;
      return;
    }
    limiterMeterRaf = window.requestAnimationFrame(updateLimiterMeter);
  }

  function startLimiterMeter() {
    if (limiterMeterRaf) return;
    limiterMeterRaf = window.requestAnimationFrame(updateLimiterMeter);
  }

  function stopLimiterMeter() {
    if (limiterMeterRaf) {
      window.cancelAnimationFrame(limiterMeterRaf);
      limiterMeterRaf = 0;
    }
  }

  function syncSettingsUI() {
    document.querySelectorAll("[data-player-setting]").forEach((input) => {
      const key = input.dataset.playerSetting;
      if (key === "engine" || key === "format" || key === "playbackMode" || key === "pitchMode"
        || key === "limiterMode" || key === "remixFormat") {
        if (input instanceof HTMLSelectElement) input.value = String(state[key]);
        else input.checked = String(input.value) === String(state[key]);
      }
      else if (key === "fxBakeDelayMs") input.value = String(bakeDelayMs());
      else if (key === "playbackRate") input.value = String(clampPlaybackRate(state.playbackRate));
      else if (key === "fadeOutMs") input.value = String(state.fadeOutMs);
      else if (key === "fadeInMs") input.value = String(state.fadeInMs);
      else if (key === "silenceDb") input.value = String(state.silenceDb);
      else if (key === "introMaxSec") input.value = String(state.introMaxSec);
      else if (FX_RANGES[key]) input.value = String(state[key]);
      else if (key === "autoNext" || key === "rememberPosition" || key === "crossfade" || key === "fadeInEnabled" || key === "fadeOutEnabled"
        || key === "skipIntro" || key === "eqEnabled" || key === "limiterEnabled"
        || FX_KINDS.some((kind) => key === `${kind}Enabled`)) {
        input.checked = !!state[key];
      }
    });
    syncFadeVisual();
    syncIntroVisual();
    syncPlaybackVisual();
    syncEqVisual();
    syncFxVisual();
  }

  function openSettings() {
    if (settingsTimer) { window.clearTimeout(settingsTimer); settingsTimer = 0; }
    if (queuePanel && !queuePanel.hidden) closeQueue();
    settingsPanel.hidden = false;
    document.body.classList.add("player-settings-open");
    settingsToggle.setAttribute("aria-expanded", "true");
    mountSettings();
    // Restart the transition even if the panel was still closing.
    void settingsPanel.offsetWidth;
    settingsPanel.classList.add("is-open");
    startLimiterMeter();
    const first = settingsPanel.querySelector("select, input");
    if (first) first.focus({ preventScroll: true });
  }

  function closeSettings() {
    if (settingsPanel.hidden) return;
    settingsToggle.setAttribute("aria-expanded", "false");
    settingsPanel.classList.remove("is-open");
    if (settingsTimer) window.clearTimeout(settingsTimer);
    stopLimiterMeter();
    // Keep the panel in the DOM until its fade/slide-out has finished.
    settingsTimer = window.setTimeout(() => {
      if (!settingsPanel.classList.contains("is-open")) {
        settingsPanel.hidden = true;
        document.body.classList.remove("player-settings-open");
      }
      settingsTimer = 0;
    }, 260);
  }

  /* ---------- remix create / save / load ---------- */

  function showRemixMessage(message) {
    document.querySelectorAll("[data-remix-message]").forEach((el) => { el.textContent = message || ""; });
    if (remixMessageTimer) window.clearTimeout(remixMessageTimer);
    remixMessageTimer = window.setTimeout(() => {
      document.querySelectorAll("[data-remix-message]").forEach((el) => { el.textContent = ""; });
      remixMessageTimer = 0;
    }, 5000);
  }

  function rememberRemixUrl(url) {
    if (loadedRemixUrl) window.setTimeout(() => URL.revokeObjectURL(loadedRemixUrl), 8000);
    loadedRemixUrl = url || "";
  }

  function remixBaseName() {
    const source = sourceTrackPath(state.current) || "remix";
    return String(state.current?.title || source)
      .replace(/\.[^.]+$/, "")
      .replace(/[\\/:*?"<>|]+/g, "_") || "track";
  }

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 10000);
  }

  async function bakeRemixNow() {
    if (!state.current) { showRemixMessage(pt("remixNoTrack")); return; }
    if (!anyFxEnabled()) { showRemixMessage(pt("remixNoFx")); return; }
    if (fxRenderTimer) window.clearTimeout(fxRenderTimer);
    fxRenderTimer = 0;
    fxRenderDeadline = 0;
    stopFxCountdown();
    fxRenderToken++;
    const token = fxRenderToken;
    const track = state.current;
    const wasPlaying = !audio.paused;
    const position = audio.currentTime || 0;
    setFxRendering(true);
    const baked = await ensureRenderedTrack(track);
    if (token !== fxRenderToken || state.current !== track) return;
    setFxRendering(false, !baked);
    if (!baked) { showRemixMessage(pt("remixError")); return; }
    loadCurrent({ autoplay: wasPlaying, startTime: position, fadeIn: false });
    showRemixMessage(pt("remixCreated"));
  }

  function remixExtension(blob, format) {
    const mime = String(blob.type || "");
    if (format === "ogg" || mime.includes("ogg")) return "ogg";
    if (format === "mp3" || mime.includes("mpeg")) return "mp3";
    if (mime.includes("webm")) return "webm";
    return format === "opus" ? "opus" : format;
  }

  async function saveRemix(format) {
    if (!state.current) { showRemixMessage(pt("remixNoTrack")); return; }
    const fmt = REMIX_FORMATS.includes(format) ? format
      : (REMIX_FORMATS.includes(state.remixFormat) ? state.remixFormat : "wav");
    try {
      if (fmt !== "wav" && fmt !== "flac" && !recorderMime(fmt)) {
        showRemixMessage(pt("remixUnsupported", { format: fmt.toUpperCase() }));
        return;
      }
      const track = state.current;
      let url = sourceUrl(track);
      if (anyFxEnabled()) {
        const baked = await ensureRenderedTrack(track);
        if (!baked) throw new Error("render failed");
        url = resolveTrackPath(track);
      }
      showRemixMessage(pt("remixEncoding", { format: fmt.toUpperCase() }));
      const buffer = await decodeUrlToBuffer(url);
      if (!buffer) throw new Error("decode failed");
      const blob = fmt === "wav" ? encodeWav(buffer)
        : fmt === "flac" ? encodeFlac(buffer)
          : await encodeWithMediaRecorder(buffer, fmt);
      downloadBlob(blob, `${remixBaseName()}-remix.${remixExtension(blob, fmt)}`);
      showRemixMessage(pt("remixSaved"));
    } catch {
      showRemixMessage(pt("remixError"));
    }
  }

  function loadRemixFile(file) {
    if (programLocked || !file) return;
    try {
      const url = URL.createObjectURL(file);
      rememberRemixUrl(url);
      const title = `${state.current?.title || file.name} — ${pt("loadRemix")}`;
      playTrack({
        id: `remix-${Date.now()}`,
        title: pt("loadRemix"),
        cover: state.current?.cover || null,
        tracks: [{ title, path: url, formats: {} }],
      }, 0, { autoplay: true });
      showRemixMessage(pt("remixLoaded"));
    } catch {
      showRemixMessage(pt("remixError"));
    }
  }

  /* ---------- events ---------- */

  $("playerPlay").addEventListener("click", () => {
    if (!state.current) {
      if (state.context?.tracks?.length) selectByIndex(0);
      return;
    }
    toggle();
  });
  $("playerPrev").addEventListener("click", previous);
  $("playerNext").addEventListener("click", () => next(true));
  $("playerClose").addEventListener("click", stop);

  seek.addEventListener("input", () => {
    introUserSeeked = true;
    setTime((Number(seek.value) / 1000) * (audio.duration || 0));
  });

  volume.addEventListener("input", () => {
    const value = Math.min(1, Math.max(0, Number(volume.value)));
    state.volume = value;
    audio.volume = value;
    audio.muted = value === 0;
    state.muted = audio.muted;
    // If user changes volume during fade-in, don't let fade override it later.
    if (incomingFadeActive) {
      incomingFadeToken++;
      incomingFadeActive = 0;
      if (mainGainNode) {
        try { const t = audioContext.currentTime; mainGainNode.gain.cancelScheduledValues(t); mainGainNode.gain.setValueAtTime(1, t); } catch {}
      }
    }
    try { howl?.volume(value); howl?.mute(audio.muted); } catch {}
    updateMuteState();
    saveState();
  });

  $("playerMute").addEventListener("click", () => {
    audio.muted = !audio.muted;
    state.muted = audio.muted;
    try { howl?.mute(audio.muted); } catch {}
    updateMuteState();
    saveState();
  });

  $("playerShuffle").addEventListener("click", () => {
    state.shuffle = !state.shuffle;
    shufflePick = null;
    applyShuffle();
    saveState();
    notify("settings");
    schedulePreload();
  });

  $("playerRepeat").addEventListener("click", () => {
    const modes = ["off", "all", "one"];
    state.repeat = modes[(modes.indexOf(state.repeat) + 1) % modes.length];
    applyRepeat();
    saveState();
    notify("settings");
    schedulePreload();
  });

  settingsToggle.addEventListener("click", () => {
    settingsPanel.hidden ? openSettings() : closeSettings();
  });
  $("playerSettingsClose").addEventListener("click", closeSettings);
  document.addEventListener("click", (ev) => {
    const target = ev.target instanceof Element ? ev.target : null;
    const button = target?.closest("[data-remix-action]");
    if (!button) return;
    const action = button.dataset.remixAction;
    if (action === "create") { bakeRemixNow(); return; }
    if (action === "save") {
      const format = button.closest("[data-player-settings-mount]")
        ?.querySelector("[data-player-setting='remixFormat']")?.value || state.remixFormat;
      saveRemix(format);
      return;
    }
    if (action === "load") {
      button.closest("[data-player-settings-mount]")
        ?.querySelector("[data-remix-file]")?.click();
    }
  });
  document.addEventListener("change", (ev) => {
    const input = ev.target instanceof Element ? ev.target.closest("[data-remix-file]") : null;
    if (!input || !(input instanceof HTMLInputElement)) return;
    loadRemixFile(input.files?.[0]);
    input.value = "";
  });
  queueToggle?.addEventListener("click", toggleQueue);
  $("playerQueueClose")?.addEventListener("click", closeQueue);
  $("playerQueueClear")?.addEventListener("click", clearQueue);
  queuePanel?.addEventListener("click", (ev) => {
    const target = ev.target instanceof Element ? ev.target : null;
    if (!target) return;
    const remove = target.closest("[data-queue-remove]");
    if (remove) { removeFromQueue(Number(remove.dataset.queueRemove)); return; }
    const play = target.closest("[data-queue-play]");
    if (play) playQueued(Number(play.dataset.queuePlay));
  });
  document.addEventListener("keydown", (ev) => {
    if (ev.key !== "Escape") return;
    if (settingsPanel && !settingsPanel.hidden) closeSettings();
    else if (queuePanel && !queuePanel.hidden) closeQueue();
  });

  document.addEventListener("click", (ev) => {
    const target = ev.target instanceof Element ? ev.target : null;
    if (!target) return;
    const share = target.closest("[data-player-share]");
    if (share) { shareSettings(share); return; }
    if (target.closest("#playerEqReset")) resetEq();
  });

  function applyFadeSetting(key, rawValue) {
    const clampFade = (value, fallback) => {
      const n = Number(value);
      return Number.isFinite(n) ? Math.min(CROSSFADE_MAX_MS, Math.max(CROSSFADE_MIN_MS, Math.round(n))) : fallback;
    };
    if (key === "fadeOutMs") state.fadeOutMs = clampFade(rawValue, DEFAULT_FADE_OUT_MS);
    if (key === "fadeInMs") state.fadeInMs = clampFade(rawValue, DEFAULT_FADE_IN_MS);
    syncSettingsUI();
    saveState();
    notify("settings");
  }

  function applyIntroSetting(key, rawValue) {
    const n = Number(rawValue);
    if (!Number.isFinite(n)) return;
    if (key === "silenceDb") {
      state.silenceDb = Math.min(-12, Math.max(-60, Math.round(n)));
    } else if (key === "introMaxSec") {
      state.introMaxSec = Math.min(INTRO_SCAN_MAX_SEC, Math.max(5, Math.round(n)));
    }
    // Threshold changes make every cached result stale.
    introCache.clear();
    syncSettingsUI();
    saveState();
    notify("settings");
  }

  document.addEventListener("change", (ev) => {
    const target = ev.target instanceof Element ? ev.target : null;
    if (!target) return;
    if (target.id === "playerEqReset") { resetEq(); return; }
    if (target.id === "playerEqAdd") { addEqFilter(); return; }
    const eqRemove = target.closest("[data-eq-remove]");
    if (eqRemove) { removeEqFilter(Number(eqRemove.dataset.eqRemove)); return; }

    const eqField = target.closest("[data-eq-field]");
    if (eqField) {
      const row = target.closest("[data-eq-index]");
      const index = Number(row?.dataset.eqIndex);
      const field = eqField.dataset.eqField;
      const value = eqField.type === "checkbox" ? eqField.checked : eqField.value;
      if (Number.isInteger(index) && field) setEqParam(index, field, value);
      return;
    }

    const input = target.closest("[data-player-setting]");
    if (!input) return;
    const key = input.dataset.playerSetting;
    if (key === "engine") setEngine(input.value);
    else if (key === "format") setFormat(input.value);
    else if (key === "playbackRate") setPlaybackRate(input.value);
    else if (key === "playbackMode") setPlaybackMode(input.value);
    else if (key === "pitchMode") setPitchMode(input.value);
    else if (key === "fadeOutMs" || key === "fadeInMs") applyFadeSetting(key, input.value);
    else if (key === "silenceDb" || key === "introMaxSec") applyIntroSetting(key, input.value);
    else if (key === "eqEnabled") setEqEnabled(input.checked);
    else if (FX_KINDS.some((kind) => key === `${kind}Enabled`)) setFxEnabled(key.replace(/Enabled$/, ""), input.checked);
    else if (key === "limiterMode") setLimiterMode(input.value);
    else if (key === "fxBakeDelayMs") applyBakeDelay(input.value);
    else if (key === "remixFormat" && REMIX_FORMATS.includes(input.value)) {
      state.remixFormat = input.value;
      syncSettingsUI();
      saveState();
      notify("settings");
    }
    else if (key === "limiterEnabled") {
      state.limiterEnabled = !!input.checked;
      limiterEnabled = state.limiterEnabled;
      ensureMasterOutput();
      wireMasterOutput();
      connectMainOutput();
      syncSettingsUI();
      saveState();
      notify("settings");
    }
    else if (key === "autoNext" || key === "rememberPosition" || key === "crossfade"
      || key === "fadeInEnabled" || key === "fadeOutEnabled" || key === "skipIntro") {
      state[key] = !!input.checked;
      if (key === "crossfade" && !state.crossfade) stopFades();
      if (key === "fadeOutEnabled" && !state.fadeOutEnabled) stopFades();
      if (key === "crossfade" || key === "fadeInEnabled" || key === "fadeOutEnabled") incomingFadeToken++;
      syncSettingsUI();
      saveState();
      notify("settings");
    }
  });

  document.addEventListener("input", (ev) => {
    const target = ev.target instanceof Element ? ev.target : null;
    if (!target) return;
    const eqField = target.closest("[data-eq-field]");
    if (eqField) {
      const row = target.closest("[data-eq-index]");
      const index = Number(row?.dataset.eqIndex);
      const field = eqField.dataset.eqField;
      const value = eqField.type === "checkbox" ? eqField.checked : eqField.value;
      if (Number.isInteger(index) && field) setEqParam(index, field, value);
      return;
    }
    const input = target.closest("[data-player-setting]");
    if (!input) return;
    const key = input.dataset.playerSetting;
    if (key === "fadeOutMs" || key === "fadeInMs") applyFadeSetting(key, input.value);
    else if (key === "silenceDb" || key === "introMaxSec") applyIntroSetting(key, input.value);
    else if (key === "fxBakeDelayMs") applyBakeDelay(input.value);
    else if (key === "playbackRate") setPlaybackRate(input.value);
    else if (FX_RANGES[key]) applyFxSetting(key, input.value);
  });

  audio.addEventListener("loadedmetadata", () => {
    if (pendingStart != null && pendingStart > 0) {
      try { audio.currentTime = pendingStart; } catch {}
    }
    pendingStart = null;
    updateTime();
    if (usesNativeProgress() && loadingEl && !loadingEl.hidden) {
      setLoadingProgress(Math.max(bufferedPercent(), 20));
    }
  });
  audio.addEventListener("progress", () => {
    if (usesNativeProgress() && loadingEl && !loadingEl.hidden) setLoadingProgress(bufferedPercent());
  });
  audio.addEventListener("loadeddata", () => {
    if (usesNativeProgress() && loadingEl && !loadingEl.hidden) {
      setLoadingProgress(Math.max(bufferedPercent(), 45));
    }
  });
  audio.addEventListener("canplay", () => { if (usesNativeProgress()) finishLoading(); });
  audio.addEventListener("playing", finishLoading);
  audio.addEventListener("timeupdate", () => { updateTime(); saveStateSoon(); });
  audio.addEventListener("play", updatePlayState);
  audio.addEventListener("pause", () => { updatePlayState(); saveStateSoon(); });
  audio.addEventListener("volumechange", updateMuteState);
  audio.addEventListener("ended", handleEnded);
  audio.addEventListener("error", () => { setLoading(false); });
  // A failed prefetch should not block the next attempt forever.
  preloadAudio?.addEventListener("error", () => { preloadUrl = ""; });

  document.addEventListener("keydown", (ev) => {
    const target = ev.target;
    if (target instanceof Element && target.closest("input, textarea, select, [contenteditable='true']")) return;
    if (ev.metaKey || ev.ctrlKey || ev.altKey) return;
    if (ev.code === "Space" && state.current) { ev.preventDefault(); toggle(); }
    else if (ev.key === "ArrowRight" && state.current) { ev.preventDefault(); introUserSeeked = true; setTime(audio.currentTime + 5); }
    else if (ev.key === "ArrowLeft" && state.current) { ev.preventDefault(); introUserSeeked = true; setTime(audio.currentTime - 5); }
    else if (ev.key.toLowerCase() === "m" && state.current) {
      audio.muted = !audio.muted;
      state.muted = audio.muted;
      try { howl?.mute(audio.muted); } catch {}
      updateMuteState();
      saveState();
    }
  });

  window.addEventListener("zqwy:languagechange", (event) => {
    setPlayerLanguage(event?.detail?.language);
  });

  window.addEventListener("zqwy:themechange", () => {
    const colors = waveformColors();
    drawEqCurve();
    drawFadeEnvelope();
    if (waveSurfer && typeof waveSurfer.setOptions === "function") {
      try {
        waveSurfer.setOptions({
          waveColor: colors.waveColor,
          progressColor: colors.progressColor,
          cursorColor: colors.cursorColor,
        });
      } catch {}
    }
    if (peaks) {
      try {
        const view = peaks.views.getView("zoomview");
        if (view) {
          view.setWaveformColor(colors.waveColor);
          view.setPlayedWaveformColor(colors.progressColor);
          view.setPlayheadColor?.(colors.cursorColor);
        }
      } catch {}
    }
    if (state.engine === "waviz" && waviz && !audio.paused) {
      try { waviz.stop(); waviz.simpleLine(colors.progressColor).catch(() => {}); } catch {}
    }
  });

  window.addEventListener("zqwy:pagechange", () => {
    applySharedSettings();
    mountSettings();
    updateTime();
  });

  window.addEventListener("pagehide", saveState);
  document.addEventListener("visibilitychange", () => { if (document.hidden) saveState(); });

  if ("mediaSession" in navigator) {
    const handlers = {
      play: () => { if (state.current) attemptPlay(); },
      pause: pauseAudio,
      previoustrack: previous,
      nexttrack: () => next(true),
      seekbackward: () => { introUserSeeked = true; setTime(audio.currentTime - 10); },
      seekforward: () => { introUserSeeked = true; setTime(audio.currentTime + 10); },
      seekto: (details) => { if (Number.isFinite(details.seekTime)) { introUserSeeked = true; setTime(details.seekTime); } },
    };
    for (const [action, handler] of Object.entries(handlers)) {
      try { navigator.mediaSession.setActionHandler(action, handler); } catch {}
    }
  }

  /* ---------- init ---------- */

  function applySettingsFrom(saved) {
    state.volume = typeof saved.volume === "number" ? Math.min(1, Math.max(0, saved.volume)) : 1;
    state.muted = saved.muted === true;
    state.shuffle = saved.shuffle === true;
    state.repeat = ["off", "all", "one"].includes(saved.repeat) ? saved.repeat : "off";
    // Explicit choice always wins. Older saves have no flag: a non-HTML5
    // engine was a real choice, while the old built-in default moves to the
    // new JS-capable default (WaveSurfer).
    const savedEngine = ENGINES.includes(saved.engine) ? saved.engine : null;
    const explicit = !!savedEngine && (saved.engineExplicit === true || savedEngine !== "html5");
    state.engine = explicit ? savedEngine : detectDefaultEngine();
    state.engineExplicit = explicit;
    shufflePick = null;
    state.format = FORMATS.includes(saved.format) ? saved.format : "opus";
    state.autoNext = saved.autoNext !== false;
    state.rememberPosition = saved.rememberPosition !== false;
    state.crossfade = saved.crossfade !== false;
    const clampFade = (value, fallback) => {
      const n = Number(value);
      return Number.isFinite(n) ? Math.min(CROSSFADE_MAX_MS, Math.max(CROSSFADE_MIN_MS, Math.round(n))) : fallback;
    };
    // Migrate legacy single crossfadeMs setting.
    const legacy = clampFade(saved.crossfadeMs, DEFAULT_FADE_OUT_MS);
    state.fadeOutMs = saved.fadeOutMs == null ? legacy : clampFade(saved.fadeOutMs, DEFAULT_FADE_OUT_MS);
    state.fadeInMs = clampFade(saved.fadeInMs, DEFAULT_FADE_IN_MS);
    // New toggles default to on, including for older saves written before
    // these keys existed. The single persisted state is the only source of
    // truth for both the checkboxes and the audible envelopes.
    state.fadeOutEnabled = saved.fadeOutEnabled !== false;
    state.fadeInEnabled = saved.fadeInEnabled !== false;
    state.skipIntro = !!saved.skipIntro;
    const clampDb = (value, fallback) => {
      const n = Number(value);
      return Number.isFinite(n) ? Math.min(-12, Math.max(-60, Math.round(n))) : fallback;
    };
    const clampIntroMax = (value, fallback) => {
      const n = Number(value);
      return Number.isFinite(n) ? Math.min(INTRO_SCAN_MAX_SEC, Math.max(5, Math.round(n))) : fallback;
    };
    state.silenceDb = clampDb(saved.silenceDb, DEFAULT_SILENCE_DB);
    state.introMaxSec = clampIntroMax(saved.introMaxSec, DEFAULT_INTRO_MAX_SEC);
    state.playbackRate = clampPlaybackRate(saved.playbackRate);
    state.pitchMode = normalizePitchMode(saved.pitchMode || (saved.preservePitch === false ? "vinyl" : "preserve"));
    const modeIds = new Set(PLAYBACK_RATE_MODES.map((m) => m.id).concat(["custom"]));
    state.playbackMode = modeIds.has(saved.playbackMode) ? saved.playbackMode : "custom";
    const matchMode = PLAYBACK_RATE_MODES.find((m) => m.rate === state.playbackRate);
    if (matchMode && state.playbackMode === "custom") state.playbackMode = matchMode.id;
    state.preservePitch = state.pitchMode !== "vinyl";

    state.eqEnabled = saved.eqEnabled === true;
    state.limiterEnabled = saved.limiterEnabled !== false;
    state.limiterMode = LIMITER_MODES.includes(saved.limiterMode) ? saved.limiterMode : "dbfs";
    state.fxBakeDelayMs = normalizeBakeDelay(saved.fxBakeDelayMs);
    state.remixFormat = REMIX_FORMATS.includes(saved.remixFormat) ? saved.remixFormat : "wav";
    limiterEnabled = state.limiterEnabled;
    FX_KINDS.forEach((kind) => { state[`${kind}Enabled`] = saved[`${kind}Enabled`] === true; });
    Object.keys(FX_RANGES).forEach((key) => {
      const range = FX_RANGES[key];
      const value = Number(saved[key]);
      state[key] = Number.isFinite(value) ? clamp(value, range.min, range.max) : range.fallback;
    });
    const savedFilters = Array.isArray(saved.eqFilters) ? saved.eqFilters : null;
    if (savedFilters && savedFilters.length) {
      state.eqFilters = savedFilters.slice(0, 8).map((f, i) => normalizeEqFilter(f, i));
    } else {
      const savedGains = saved.eqGains && typeof saved.eqGains === "object" ? saved.eqGains : {};
      const migrated = [60,170,310,600,1000,3000,6000,12000,14000,16000]
        .map((freq, i) => ({ id: `m${freq}`, type: "peaking", freq, gain: Number(savedGains[String(freq)]) || 0, q: 1.1, enabled: true }))
        .filter((f) => f.gain !== 0);
      state.eqFilters = migrated.length ? migrated : DEFAULT_EQ_FILTERS.map((f) => ({ ...f }));
    }
    state.queue = Array.isArray(saved.queue)
      ? saved.queue.filter((item) => item && item.path && Array.isArray(item.tracks)).slice(0, 100)
      : [];

    audio.volume = state.volume;
    audio.muted = state.muted;
    volume.value = String(state.volume);

    applyShuffle();
    applyRepeat();
    updateMuteState();
    renderQueue();
    mountSettings();
    applyPlaybackRate();
    ensureMasterOutput();
    // A shared link can change the limiter mode after the context already
    // exists; drop the old graph so the restored mode is the audible one.
    if (audioContext) rebuildLimiter();
    ensureMainGain();
    if (state.eqEnabled) ensureEqChain();
    applyEqState();
    // The UI and the baked audio are both built from this restored state.
    applyFxState();
  }

  function restore() {
    const shared = readSharedSettings();
    const timeParam = readTimeParam();
    const saved = shared ? { ...loadSaved(), ...shared } : loadSaved();
    state.context = saved.context || null;
    state.current = saved.current || null;
    state.time = typeof saved.time === "number" ? saved.time : 0;
    // A link's timecode wins over the locally remembered position. The music
    // page will later select the shared album/track and apply it there too.
    if (timeParam !== null) state.time = timeParam;
    restoring = true;
    try { applySettingsFrom(saved); } finally { restoring = false; }
    if (shared) {
      saveState();
      clearShareParam();
      notify("settings");
    }
    if (!state.current || !state.current.path) return;
    showBar();
    renderMetadata();
    loadCurrent({ autoplay: false, startTime: timeParam !== null ? timeParam : (state.rememberPosition ? state.time : 0) });
  }

  // Shared links can also be opened through the site's SPA navigation, where
  // player.js is not re-executed. Apply the same settings without reloading
  // the page (and without touching the track that is currently playing).
  function applySharedSettings() {
    const shared = readSharedSettings();
    if (!shared) return false;
    // Engine/format changes must also re-init the active track, exactly as
    // they do when the visitor changes the selects in the settings form.
    if (shared.engine && shared.engine !== state.engine) setEngine(shared.engine);
    if (shared.format && shared.format !== state.format) setFormat(shared.format);
    const current = {
      ...loadSaved(),
      ...Object.fromEntries(SHARE_KEYS.map((key) => [key, state[key]])),
      context: state.context,
      current: state.current,
      time: state.time,
      queue: getQueue(),
      volume: state.volume,
      muted: state.muted,
      shuffle: state.shuffle,
      repeat: state.repeat,
      ...shared,
    };
    applySettingsFrom(current);
    saveState();
    clearShareParam();
    notify("settings");
    return true;
  }

  window.zqwyPlayer = {
    playTrack, setContext, toggle, play: attemptPlay, pause: pauseAudio,
    next, previous, stop, seek: setTime, seekProgram, setProgramLock,
    getState, setEngine, setFormat, openSettings,
    enqueue, removeFromQueue, clearQueue, getQueue, openQueue, closeQueue,
    on(event, handler) {
      if (typeof handler !== "function") return;
      listeners.set(event, handler);
    },
  };

  restore();
})();
