/* Shared context for the universal player.
 *
 * The old player was one giant IIFE: every helper could see every variable.
 * The split keeps that visibility, but makes it explicit: all state lives on
 * this object, and all modules read/write it through P.
 */
export const P = {};

export function initContext(P) {
  // Derived from this module's URL: document.currentScript is null in modules.
  const MODULE_URL = import.meta.url;
  P.VENDOR_BASE = new URL("../../../vendor/", MODULE_URL).href;
  P.SITE_ROOT = new URL("../", P.VENDOR_BASE).href;


  P.STORAGE_STATE = "zqwy.player.state.v1";
  P.STORAGE_SETTINGS = "zqwy.player.settings.v1";
  P.STORAGE_ALBUM = "zqwy.player.album.v1";
  // A settings link carries compact JSON in ?player=<base64url>. Only the keys
  // listed below are accepted: playback position, queue and the current track
  // are intentionally personal and are never shared.
  P.SHARE_PARAM = "player";
  P.TIME_PARAM = "t";
  P.ENGINES = [
    "html5", "wavesurfer", "peaks", "howler", "waviz",
    "mediaelement", "amplitude", "aplayer", "jplayer",
  ];
  P.FORMATS = ["opus", "mp3", "wav", "flac"];
  P.REMIX_FORMATS = ["wav", "flac", "mp3", "opus", "ogg"];
  P.LIMITER_MODES = ["dbfs", "truepeak", "softclip", "hardclip"];
  // When JavaScript and the APIs WaveSurfer needs are available, the waveform
  // player is the default. The explicit user choice (or a legacy non-HTML5
  // engine) always wins; see detectDefaultEngine()/restore().
  P.DEFAULT_ENGINE = "wavesurfer";
  P.CROSSFADE_MIN_MS = 0;
  P.CROSSFADE_MAX_MS = 3000;
  P.DEFAULT_FADE_OUT_MS = 700;
  P.DEFAULT_FADE_IN_MS = 500;
  // Effects are audible immediately through a live Web Audio chain. After a
  // configurable pause without knob movement the current track is baked once
  // into a static WAV, and playback switches to that baked waveform.
  P.DEFAULT_FX_BAKE_DELAY_MS = 10000;
  P.FX_BAKE_DELAY_MIN_MS = 1000;
  P.FX_BAKE_DELAY_MAX_MS = 60000;
  // Intro detection replaces the old fixed "skip the first 12 seconds" hack.
  // These are safety limits, not the offset we always jump to: the real skip
  // point is the first sustained sound after the initial quiet run.
  P.INTRO_SCAN_MAX_SEC = 90;
  P.INTRO_WINDOW_SEC = 0.02;
  P.INTRO_MIN_QUIET_SEC = 1;
  P.INTRO_MIN_SOUND_SEC = 0.24;
  P.INTRO_LEAD_SEC = 0.1;
  // Conservative defaults: quiet music should not be mistaken for silence.
  P.DEFAULT_SILENCE_DB = -38;
  P.DEFAULT_INTRO_MAX_SEC = 45;

  /* The player used to be the only untranslated part of the site. Keep its
     wording here (and mirror the site's RU/EN switch) instead of baking one
     language into the injected markup. */
  P.PLAYER_I18N = {
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
      effectsHint: "Цепочка: дисторшн → сатурация → фейзер → тремоло → вибрато → ринг-модулятор → хорус → флейзер → дилей → реверб. Изменения слышны сразу через живую обработку; после паузы в настройках эффект запекается в звуковую волну. Холсты интерактивны: перетаскивайте их или используйте ползунки.",
      fxDocs: "Подробное описание эффектов в заметках",
      fxBakeDelay: "Ожидание до запекания", fxBakeDelayHint: "Секунд бездействия после последнего изменения эффекта, прежде чем начать запекание.",
      effectRendering: "Запекаю эффекты в трек…", effectReady: "Эффекты запечены в звуковую волну",
      effectCountdown: "Живой эффект · запекание через {s} с",
      effectLive: "Живой эффект · запекание после {s} с бездействия",
      effectUnavailable: "Не удалось запечь эффекты — играет оригинальный файл",
      distortion: "Дисторшн", distortionEnable: "Включить дисторшн",
      distortionHint: "Нелинейное искажение с мягким фильтром тона после формы сигнала.",
      drive: "Степень", tone: "Тон", mix: "Смесь",
      saturation: "Сатурация", saturationEnable: "Включить сатурацию",
      saturationHint: "Мягкое аналоговое насыщение: тёплые гармоники и ламповый/ленточный характер без резкого перегруза.",
      phaser: "Фейзер", phaserEnable: "Включить фейзер",
      phaserHint: "Каскад allpass-фильтров с LFO создаёт круговое, пульсирующее сканирование спектра.",
      tremolo: "Тремоло", tremoloEnable: "Включить тремоло",
      tremoloHint: "Периодическое изменение громкости: пульсация амплитуды по скорости и глубине LFO.",
      vibrato: "Вибрато", vibratoEnable: "Включить вибрато",
      vibratoHint: "Периодическое изменение высоты тона через модуляцию небольшой задержки — дрожащий, колеблющийся звук.",
      ringmod: "Ринг-модулятор", ringmodEnable: "Включить ринг-модулятор",
      ringmodHint: "Перемножение сигнала и несущего генератора даёт металлические, диссонирующие тембры.",
      rateHz: "Частота LFO", carrierFreq: "Частота несущей",
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
      fxCanvasSaturationHint: "Горизонталь — тон, вертикаль — мягкость насыщения.",
      fxCanvasPhaserHint: "Горизонталь — скорость LFO, вертикаль — глубина.",
      fxCanvasTremoloHint: "Горизонталь — скорость LFO, вертикаль — глубина.",
      fxCanvasVibratoHint: "Горизонталь — скорость LFO, вертикаль — глубина.",
      fxCanvasRingmodHint: "Горизонталь — частота несущей, вертикаль — глубина.",
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
      effectsHint: "Chain: distortion → saturation → phaser → tremolo → vibrato → ring modulator → chorus → flanger → delay → reverb. Changes are audible immediately through live processing; after a pause the effect is baked into the waveform. The canvases are interactive: drag them or use the sliders.",
      fxDocs: "Detailed effect descriptions in the notes",
      fxBakeDelay: "Bake delay", fxBakeDelayHint: "Seconds of inactivity after the last effect change before baking starts.",
      effectRendering: "Baking effects into the track…", effectReady: "Effects baked into the waveform",
      effectCountdown: "Live effect · baking in {s} s",
      effectLive: "Live effect · bakes after {s} s of inactivity",
      effectUnavailable: "Could not bake effects — playing the original file",
      distortion: "Distortion", distortionEnable: "Enable distortion",
      distortionHint: "Non-linear shaping with a gentle tone filter after the waveshaper.",
      drive: "Drive", tone: "Tone", mix: "Mix",
      saturation: "Saturation", saturationEnable: "Enable saturation",
      saturationHint: "Warm analogue-style saturation: smooth harmonics and tape/tube character without harsh overdrive.",
      phaser: "Phaser", phaserEnable: "Enable phaser",
      phaserHint: "A cascade of allpass filters with an LFO creates a circular, sweeping spectrum.",
      tremolo: "Tremolo", tremoloEnable: "Enable tremolo",
      tremoloHint: "Regular amplitude modulation: pulsing volume controlled by LFO rate and depth.",
      vibrato: "Vibrato", vibratoEnable: "Enable vibrato",
      vibratoHint: "Regular pitch modulation through a small modulated delay — a wobbling, breathing tone.",
      ringmod: "Ring modulator", ringmodEnable: "Enable ring modulator",
      ringmodHint: "Multiplying the signal by a carrier oscillator produces metallic, dissonant timbres.",
      rateHz: "LFO rate", carrierFreq: "Carrier frequency",
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
      fxCanvasSaturationHint: "Horizontal — tone, vertical — warmth.",
      fxCanvasPhaserHint: "Horizontal — LFO rate, vertical — depth.",
      fxCanvasTremoloHint: "Horizontal — LFO rate, vertical — depth.",
      fxCanvasVibratoHint: "Horizontal — LFO rate, vertical — depth.",
      fxCanvasRingmodHint: "Horizontal — carrier frequency, vertical — depth.",
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
    de: {
      nothingPlaying: "Nichts wird abgespielt",
      prev: "Vorheriger Titel", play: "Abspielen", pause: "Pause", next: "Nächster Titel",
      queue: "Titelwarteschlange", clearQueue: "Leeren", closeQueue: "Warteschlange schließen",
      queueEmpty: "Die Warteschlange ist leer. Füge Titel mit der „+“-Taste im Katalog hinzu.",
      shuffleOn: "Zufallswiedergabe an", shuffleOff: "Zufallswiedergabe aus",
      repeatOff: "Wiederholung: aus", repeatAll: "Wiederholung: ganzes Album", repeatOne: "Wiederholung: ein Titel",
      muteOn: "Ton einschalten", muteOff: "Ton ausschalten",
      settings: "Player-Einstellungen", closeSettings: "Einstellungen schließen",
      share: "Einstellungen teilen",
      shareHint: "Der Link öffnet den Player mit deinen Einstellungen: Engine, Format, Geschwindigkeit, Equalizer und Effekte.",
      shareCopy: "Link kopieren", shareCopied: "Link kopiert",
      shareManual: "Link bereit — kopiere ihn aus dem Feld",
      close: "Player anhalten und schließen", loading: "Titel wird geladen",
      createRemix: "Remix erstellen", saveRemix: "Remix speichern", loadRemix: "Remix laden",
      remixSection: "Remix",
      remixHint: "„Remix erstellen“ backt die aktuellen Effekte sofort ein. „Remix speichern“ lädt das Ergebnis im gewählten Format herunter. Quelldateien werden nie überschrieben.",
      remixFormat: "Remix-Dateiformat",
      remixSaved: "Remix gespeichert", remixLoaded: "Remix geladen — die Quelldatei wurde nicht verändert",
      remixCreated: "Remix erstellt und in die Wellenform gebacken", remixEncoding: "Kodiere {format}…",
      remixNoTrack: "Starte zuerst einen Titel", remixNoFx: "Aktiviere mindestens einen Effekt",
      remixError: "Der Remix konnte nicht verarbeitet werden",
      remixUnsupported: "Das Format {format} ist in diesem Browser nicht verfügbar — wähle WAV oder FLAC",
      position: "Titelposition", volume: "Lautstärke", engineUi: "Position (AmplitudeJS)",
      playPause: "Abspielen/Pause", amplitudeVolume: "Lautstärke (AmplitudeJS)",
      settingsHint: "Der Player ist universell: Engine und Verhalten werden hier gewählt und siteweit gespeichert.",
      engine: "Wiedergabe-Engine",
      engineHtml5: "HTML5 (im Browser eingebaut)", engineWavesurfer: "WaveSurfer.js (Wellenform)",
      enginePeaks: "Peaks.js (Wellenform)", engineHowler: "Howler.js (Audio + Livesignal)",
      engineWaviz: "Waviz (Visualisierung)", engineMediaelement: "MediaElement.js (Oberfläche)",
      engineAmplitude: "AmplitudeJS (Oberfläche)", engineAplayer: "APlayer (Oberfläche)",
      engineJplayer: "jPlayer (Oberfläche)",
      engineDefaultHint: "Standardmäßig wird WaveSurfer.js verwendet, wenn JavaScript und die nötigen Browser-APIs verfügbar sind; bei einem Ladefehler übernimmt HTML5. Eine hier getroffene Wahl wird gespeichert.",
      engineUiHint: "Die Bedienelemente der gewählten Bibliothek erscheinen direkt in der Playerleiste — ein eigenes Fenster gibt es nicht mehr.",
      format: "Audioformat", behavior: "Verhalten",
      autoNext: "Nächsten Titel automatisch abspielen",
      rememberPosition: "Titelposition merken",
      crossfade: "Sanfter Übergang zwischen Titeln",
      skipIntroAuto: "Anfängliche Stille automatisch überspringen",
      silenceThreshold: "Stilleschwelle", introMax: "Intro-Limit",
      thresholdHint: "Alles Leisere gilt als Stille. Niedrigere Werte überspringen weniger.",
      introMaxHint: "Die Introsuche endet hier, damit die Musik selbst nie übersprungen wird.",
      fadeLabel: "Einblenden / Ausblenden", fadeIn: "Einblenden", fadeOut: "Ausblenden",
      fadeInEnable: "Einblenden aktivieren", fadeOutEnable: "Ausblenden aktivieren",
      fadeHint: "Ein- und Ausblenden werden getrennt geschaltet. Die Dauern sind unabhängig; die Überblendung zwischen Titeln wird oben eingestellt.",
      playbackRate: "Wiedergabegeschwindigkeit",
      playbackRateHint: "Der Regler ändert das Tempo von 0,1x bis 10x. Der Geschwindigkeitsmodus legt ein Tempopreset fest, der Tonhöhenmodus den Wiedergabestil.",
      playbackMode: "Geschwindigkeitsmodus",
      pitchMode: "Tonhöhenmodus",
      modeNormal: "Normal (1x)", modeSlow025: "0,25x", modeSlow05: "0,5x", modeSlow075: "0,75x",
      modeFast125: "1,25x", modeFast15: "1,5x", modeFast2: "2x", modeFast3: "3x", modeCustom: "Eigene",
      pitchPreserve: "Tonhöhe beibehalten",
      pitchVinyl: "Vinyl/Band (Tonhöhe ändert sich)",
      pitchTape: "Tonal (stabile Tonhöhe)",
      equalizer: "Parametrischer Equalizer",
      eqEnable: "Equalizer aktivieren",
      eqHint: "Die Kurve zeigt die Gesamtreaktion. Füge Filter hinzu und passe Typ, Frequenz, Verstärkung und Q an.",
      eqCanvasHint: "Ziehe Punkte auf der Kurve: waagerecht die Frequenz, senkrecht die Verstärkung.",
      limiter: "0-dBFS-Limiter",
      limiterMode: "Limitermodus",
      limiterModeHint: "dBFS — Spitzenlimiter; true peak — 4× Oversampling mit Reserve für Samplespitzen; soft clip — sanfte Sättigung; hard clip — harte digitale Begrenzung.",
      limiterDbfs: "dBFS (Spitze)", limiterTruePeak: "True peak (4×)",
      limiterSoftClip: "Soft clip", limiterHardClip: "Hard clip",
      limiterHint: "Begrenzt den Ausgang nach dem Equalizer im gewählten Modus.",
      limiterMeter: "Spitze nach dem Limiter",
      effects: "Effekte",
      effectsHint: "Kette: Verzerrung → Sättigung → Phaser → Tremolo → Vibrato → Ringmodulator → Chorus → Flanger → Delay → Reverb. Änderungen sind sofort über Live-Verarbeitung hörbar; nach einer Pause wird der Effekt in die Wellenform gebacken. Die Canvases sind interaktiv: ziehe sie oder nutze die Regler.",
      fxDocs: "Ausführliche Effektbeschreibungen in den Notizen",
      fxBakeDelay: "Verzögerung vor dem Backen", fxBakeDelayHint: "Sekunden ohne Aktivität nach der letzten Effektänderung, bevor das Backen beginnt.",
      effectRendering: "Effekte werden in den Titel gebacken…", effectReady: "Effekte in die Wellenform gebacken",
      effectCountdown: "Live-Effekt · Backen in {s} s",
      effectLive: "Live-Effekt · wird nach {s} s ohne Aktivität gebacken",
      effectUnavailable: "Effekte konnten nicht gebacken werden — die Originaldatei wird abgespielt",
      distortion: "Verzerrung", distortionEnable: "Verzerrung aktivieren",
      distortionHint: "Nichtlineare Formung mit einem sanften Tonfilter nach der Wellenformung.",
      drive: "Antrieb", tone: "Ton", mix: "Mix",
      saturation: "Sättigung", saturationEnable: "Sättigung aktivieren",
      saturationHint: "Sanfte analoge Sättigung: warme Oberwellen und Band-/Röhrencharakter ohne harten Overdrive.",
      phaser: "Phaser", phaserEnable: "Phaser aktivieren",
      phaserHint: "Eine Kaskade von Allpass-Filtern mit LFO erzeugt ein kreisendes, fegendes Spektrum.",
      tremolo: "Tremolo", tremoloEnable: "Tremolo aktivieren",
      tremoloHint: "Regelmäßige Amplitudenmodulation: pulsierende Lautstärke nach LFO-Rate und -Tiefe.",
      vibrato: "Vibrato", vibratoEnable: "Vibrato aktivieren",
      vibratoHint: "Regelmäßige Tonhöhenmodulation durch eine kleine modulierte Verzögerung — ein schwankender, atmender Ton.",
      ringmod: "Ringmodulator", ringmodEnable: "Ringmodulator aktivieren",
      ringmodHint: "Die Multiplikation des Signals mit einem Trägeroszillator erzeugt metallische, dissonante Klangfarben.",
      rateHz: "LFO-Rate", carrierFreq: "Trägerfrequenz",
      chorus: "Chorus", chorusEnable: "Chorus aktivieren",
      chorusHint: "Modulierte Verzögerung erzeugt einen Chor-/Bandvibrato-Effekt.",
      rate: "LFO-Rate", depth: "Tiefe",
      flanger: "Flanger", flangerEnable: "Flanger aktivieren",
      flangerHint: "Eine kurze modulierte Verzögerung mit Rückkopplung erzeugt einen metallischen Sweep und ein wanderndes Spektrum.",
      delay: "Delay", delayEnable: "Delay aktivieren",
      delayHint: "Abklingende Wiederholungen: Verzögerungszeit, Rückkopplung und Mix mit dem Original.",
      delayTime: "Zeit", feedback: "Rückkopplung",
      reverb: "Reverb", reverbEnable: "Reverb aktivieren",
      reverbHint: "Synthetische Impulsantwort mit einstellbarer Nachhallzeit.",
      decay: "Abklingen",
      fxCanvasDistortionHint: "Waagerecht — Ton, senkrecht — Antrieb.",
      fxCanvasSaturationHint: "Waagerecht — Ton, senkrecht — Wärme.",
      fxCanvasPhaserHint: "Waagerecht — LFO-Rate, senkrecht — Tiefe.",
      fxCanvasTremoloHint: "Waagerecht — LFO-Rate, senkrecht — Tiefe.",
      fxCanvasVibratoHint: "Waagerecht — LFO-Rate, senkrecht — Tiefe.",
      fxCanvasRingmodHint: "Waagerecht — Trägerfrequenz, senkrecht — Tiefe.",
      fxCanvasChorusHint: "Waagerecht — LFO-Rate, senkrecht — Tiefe.",
      fxCanvasFlangerHint: "Waagerecht — LFO-Rate, senkrecht — Tiefe.",
      fxCanvasDelayHint: "Waagerecht — Verzögerungszeit, senkrecht — Rückkopplung.",
      fxCanvasReverbHint: "Waagerecht — Abklingen, senkrecht — Mix.",
      eqAdd: "Filter hinzufügen",
      eqReset: "Equalizer zurücksetzen",
      eqFreq: "Frequenz", eqGain: "Verstärkung", eqQ: "Q", eqType: "Typ", eqRemove: "Entfernen",
      off: "aus", ms: "ms", s: "s", db: "dB",
      playNext: "Als Nächstes spielen: {title}", removeQueue: "Aus der Warteschlange entfernen: {title}",
    },
  };
  const initialLanguage = document.documentElement.lang;
  P.playerLanguage = ["ru", "en", "de"].includes(initialLanguage) ? initialLanguage : "ru";

  P.BAR_HTML = `
<div class="player-bar" id="playerBar" hidden>
  <div class="player-queue" id="playerQueuePanel" hidden role="dialog" aria-modal="true" aria-labelledby="playerQueueTitle">
    <div class="player-queue-head">
      <strong id="playerQueueTitle" data-player-i18n="queue">${P.pt("queue")}</strong>
      <div class="player-queue-actions">
        <button type="button" id="playerQueueClear" class="player-queue-text-btn" data-player-i18n="clearQueue">${P.pt("clearQueue")}</button>
        <button class="player-btn player-queue-close" id="playerQueueClose" type="button" aria-label="${P.pt("closeQueue")}" data-player-i18n-aria-label="closeQueue">×</button>
      </div>
    </div>
    <ol class="player-queue-list" id="playerQueueList"></ol>
    <p class="player-queue-empty" id="playerQueueEmpty" data-player-i18n="queueEmpty">${P.pt("queueEmpty")}</p>
  </div>
  <div class="player-inner">
    <div class="player-now">
      <div class="player-cover">
        <img id="playerCover" alt="" hidden>
        <span class="player-cover-letter" id="playerCoverLetter" aria-hidden="true">♪</span>
      </div>
      <div class="player-text">
        <span class="player-title" id="playerTitle">${P.pt("nothingPlaying")}</span>
        <span class="player-album" id="playerAlbum"></span>
      </div>
    </div>

    <div class="player-controls">
      <button class="player-btn player-prev" id="playerPrev" type="button" aria-label="${P.pt("prev")}" data-player-i18n-aria-label="prev">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 5h2v14H6zM20 5v14L9 12z"/></svg>
      </button>
      <button class="player-btn player-play" id="playerPlay" type="button" aria-label="${P.pt("play")}" data-player-i18n-aria-label="play">
        <svg class="icon-play" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>
        <svg class="icon-pause" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 5h4v14H7zM13 5h4v14h-4z"/></svg>
      </button>
      <button class="player-btn player-next" id="playerNext" type="button" aria-label="${P.pt("next")}" data-player-i18n-aria-label="next">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M16 5h2v14h-2zM4 5v14l11-7z"/></svg>
      </button>
    </div>

    <div class="player-seek">
      <span class="player-time" id="playerCurrent">0:00</span>
      <input class="player-range player-progress" id="playerSeek" type="range" min="0" max="1000" step="1" value="0" aria-label="${P.pt("position")}" data-player-i18n-aria-label="position">
      <div class="player-waveform-stack">
        <div class="player-waveform" id="playerWaveform" hidden></div>
        <p class="fx-render-status" data-fx-status hidden>${P.pt("effectReady")}</p>
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
            <input class="amplitude-song-slider" type="range" min="0" max="100" value="0" aria-label="${P.pt("engineUi")}" data-player-i18n-aria-label="engineUi">
            <button class="amplitude-play-pause lab-amplitude-play" type="button" aria-label="${P.pt("playPause")}" data-player-i18n-aria-label="playPause">▶</button>
            <span class="amplitude-current-time">0:00</span>
            <span class="lab-amplitude-sep">/</span>
            <span class="amplitude-duration-time">0:00</span>
            <input class="amplitude-volume-slider" type="range" min="0" max="100" value="100" aria-label="${P.pt("amplitudeVolume")}" data-player-i18n-aria-label="amplitudeVolume">
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
      <button class="player-btn player-queue-toggle" id="playerQueueToggle" type="button" aria-label="${P.pt("queue")}" aria-expanded="false" aria-controls="playerQueuePanel" title="${P.pt("queue")}" data-player-i18n-aria-label="queue" data-player-i18n-title="queue">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h11v2H4zM4 11h11v2H4zM4 16h7v2H4zM17 8l5 4-5 4V8z"/></svg>
        <span class="player-queue-count" id="playerQueueCount" hidden>0</span>
      </button>
      <button class="player-btn player-toggle" id="playerShuffle" type="button" aria-label="${P.pt("shuffleOff")}" aria-pressed="false" data-player-i18n-aria-label="shuffleOff">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10.6 9.2 5.4 4 4 5.4l5.2 5.2 1.4-1.4zm3.8-5.2 2 2L4.1 18.6 5.5 20 17.9 7.7l2 2V4h-5.5zm-.3 9.4-1.4 1.4 3.1 3.1-3.1 3.1 1.4 1.4 3.1-3.1V20H20v-4h-2.8l-3.1-3.1z"/></svg>
      </button>
      <button class="player-btn player-toggle" id="playerRepeat" type="button" aria-label="${P.pt("repeatOff")}" aria-pressed="false" data-player-i18n-aria-label="repeatOff">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 7h10v3l4-4-4-4v3H5v6h2V7zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2v4z"/></svg>
        <span class="player-repeat-one" aria-hidden="true">1</span>
      </button>
      <button class="player-btn player-mute" id="playerMute" type="button" aria-label="${P.pt("muteOff")}" data-player-i18n-aria-label="muteOff">
        <svg class="icon-volume" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9H4zm12.5 3a4.5 4.5 0 0 1-2.5 4v-8a4.5 4.5 0 0 1 2.5 4z"/></svg>
        <svg class="icon-muted" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9H4zm12.6 1.1 1.4-1.4 4.4 4.4-1.4 1.4-4.4-4.4zm5.8 0-4.4 4.4-1.4-1.4 4.4-4.4 1.4 1.4z"/></svg>
      </button>
      <input class="player-range player-volume" id="playerVolume" type="range" min="0" max="1" step="0.01" value="1" aria-label="${P.pt("volume")}" data-player-i18n-aria-label="volume">
      <button class="player-btn player-settings-toggle" id="playerSettingsToggle" type="button" aria-label="${P.pt("settings")}" aria-expanded="false" aria-controls="playerSettings" data-player-i18n-aria-label="settings">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19.14 12.94a7.6 7.6 0 0 0 .05-1.88l2.03-1.58a.5.5 0 0 0 .12-.64l-1.92-3.32a.5.5 0 0 0-.6-.22l-2.39.96a7.3 7.3 0 0 0-1.63-.94l-.36-2.54a.5.5 0 0 0-.5-.42h-3.84a.5.5 0 0 0-.5.42l-.36 2.54a7.3 7.3 0 0 0-1.63.94l-2.39-.96a.5.5 0 0 0-.6.22L2.7 8.84a.5.5 0 0 0 .12.64l2.03 1.58a7.6 7.6 0 0 0 0 1.88L2.82 14.5a.5.5 0 0 0-.12.64l1.92 3.32a.5.5 0 0 0 .6.22l2.39-.96a7.3 7.3 0 0 0 1.63.94l.36 2.54a.5.5 0 0 0 .5.42h3.84a.5.5 0 0 0 .5-.42l.36-2.54a7.3 7.3 0 0 0 1.63-.94l2.39.96a.5.5 0 0 0 .6-.22l1.92-3.32a.5.5 0 0 0-.12-.64l-2.03-1.58zM12 15.5a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7z"/></svg>
      </button>
    </div>

    <button class="player-btn player-close" id="playerClose" type="button" aria-label="${P.pt("close")}" data-player-i18n-aria-label="close">
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.4 5 5 6.4 10.6 12 5 17.6 6.4 19l5.6-5.6 5.6 5.6 1.4-1.4L13.4 12 19 6.4 17.6 5 12 10.6z"/></svg>
    </button>
    </div>

    <!-- Loading state sits over the seek/waveform row in every engine, so the
         percentage is visible even when a library renders its own controls. -->
    <div class="player-loading" id="playerLoading" hidden role="status" aria-live="polite">
      <span class="player-loading-ring" aria-hidden="true"></span>
      <span class="player-loading-text">${P.pt("loading")}</span>
      <span class="player-loading-percent" id="playerLoadingPercent">0%</span>
      <span class="player-loading-track" aria-hidden="true">
        <span class="player-loading-fill" id="playerLoadingFill"></span>
      </span>
    </div>
  </div>

  <div class="player-settings" id="playerSettings" role="dialog" aria-labelledby="playerSettingsTitle" hidden>
    <div class="player-settings-head">
      <strong id="playerSettingsTitle" data-player-i18n="settings">${P.pt("settings")}</strong>
      <button class="player-btn player-settings-close" id="playerSettingsClose" type="button" aria-label="${P.pt("closeSettings")}" data-player-i18n-aria-label="closeSettings">×</button>
    </div>
    <div class="player-settings-mount" data-player-settings-mount></div>
  </div>



  <audio id="audio" preload="metadata"></audio>
  <!-- Warms the HTTP cache for the upcoming track. It never plays and never
       touches the shared audio element (Web Audio needs one source per node). -->
  <audio id="preloadAudio" preload="auto" aria-hidden="true" tabindex="-1"></audio>
</div>`;

  P.$ = (id) => document.getElementById(id);

  P.PLAYBACK_RATE_MIN = 0.1;
  P.PLAYBACK_RATE_MAX = 10;
  P.PLAYBACK_RATE_STEP = 0.05;
  P.PLAYBACK_RATE_MODES = [
    { id: "normal", rate: 1, preservePitch: true },
    { id: "slow025", rate: 0.25, preservePitch: true },
    { id: "slow05", rate: 0.5, preservePitch: true },
    { id: "slow075", rate: 0.75, preservePitch: true },
    { id: "fast125", rate: 1.25, preservePitch: true },
    { id: "fast15", rate: 1.5, preservePitch: true },
    { id: "fast2", rate: 2, preservePitch: true },
    { id: "fast3", rate: 3, preservePitch: true },
  ];
  P.PLAYBACK_PITCH_MODES = [
    { id: "preserve", preservePitch: true, labelKey: "pitchPreserve" },
    { id: "vinyl", preservePitch: false, labelKey: "pitchVinyl" },
    { id: "tape", preservePitch: true, labelKey: "pitchTape" }, // UI mode; browser fallback uses preservePitch
  ];
  P.EQ_MIN_GAIN = -36;
  P.EQ_MAX_GAIN = 36;
  P.EQ_MIN_FREQ = 31;
  P.EQ_MAX_FREQ = 16000;
  P.EQ_MIN_Q = 0.4;
  P.EQ_MAX_Q = 18;
  P.DEFAULT_EQ_FILTERS = [
    { id: "low", type: "lowshelf", freq: 120, gain: 0, q: 0.7, enabled: true },
    { id: "mid", type: "peaking", freq: 1000, gain: 0, q: 1, enabled: true },
    { id: "high", type: "highshelf", freq: 8000, gain: 0, q: 0.7, enabled: true },
  ];
  P.FX_RANGES = {
    distortionDrive: { min: 0, max: 1, step: 0.01, fallback: 0.35 },
    distortionTone: { min: 0, max: 1, step: 0.01, fallback: 0.55 },
    distortionMix: { min: 0, max: 1, step: 0.01, fallback: 0.35 },
    saturationDrive: { min: 0, max: 1, step: 0.01, fallback: 0.3 },
    saturationTone: { min: 0, max: 1, step: 0.01, fallback: 0.7 },
    saturationMix: { min: 0, max: 1, step: 0.01, fallback: 0.35 },
    phaserRate: { min: 0.05, max: 5, step: 0.05, fallback: 0.8 },
    phaserDepth: { min: 0, max: 1, step: 0.01, fallback: 0.5 },
    phaserFeedback: { min: 0, max: 0.85, step: 0.01, fallback: 0.2 },
    phaserMix: { min: 0, max: 1, step: 0.01, fallback: 0.35 },
    tremoloRate: { min: 0.1, max: 12, step: 0.1, fallback: 4 },
    tremoloDepth: { min: 0, max: 1, step: 0.01, fallback: 0.5 },
    tremoloMix: { min: 0, max: 1, step: 0.01, fallback: 0.6 },
    vibratoRate: { min: 0.1, max: 8, step: 0.05, fallback: 5 },
    vibratoDepth: { min: 0, max: 1, step: 0.01, fallback: 0.2 },
    vibratoMix: { min: 0, max: 1, step: 0.01, fallback: 0.5 },
    ringmodFreq: { min: 20, max: 2000, step: 1, fallback: 440 },
    ringmodDepth: { min: 0, max: 1, step: 0.01, fallback: 0.5 },
    ringmodMix: { min: 0, max: 1, step: 0.01, fallback: 0.35 },
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
  P.FX_KINDS = [
    "distortion", "saturation", "phaser", "tremolo", "vibrato", "ringmod",
    "chorus", "flanger", "delay", "reverb",
  ];
  P.FX_NOTES_URL = P.SITE_ROOT ? new URL("wiki/zqwy/music-effects.html", P.SITE_ROOT).href : "../wiki/zqwy/music-effects.html";
  P.SHARE_KEYS = [
    "engine", "format", "autoNext", "rememberPosition", "crossfade",
    "fadeOutMs", "fadeInMs", "fadeOutEnabled", "fadeInEnabled",
    "skipIntro", "silenceDb", "introMaxSec",
    "playbackRate", "playbackMode", "pitchMode",
    "eqEnabled", "eqFilters", "limiterEnabled", "limiterMode", "fxBakeDelayMs",
    ...P.FX_KINDS.map((kind) => `${kind}Enabled`),
    ...Object.keys(P.FX_RANGES),
  ];

  P.listeners = new Map();
  P.state = {
    context: null,   // { albumId, title, cover, tracks: [{ title, path }] }
    current: null,   // { albumId, index, title, path, cover }
    time: 0,
    volume: 1,
    muted: false,
    shuffle: false,
    repeat: "off",
    engine: P.DEFAULT_ENGINE,
    engineExplicit: false, // true only after the visitor picks an engine manually
    format: "opus",
    autoNext: true,
    rememberPosition: true,
    crossfade: true,          // overlap the outgoing and incoming tracks
    fadeOutMs: P.DEFAULT_FADE_OUT_MS,
    fadeInMs: P.DEFAULT_FADE_IN_MS,
    fadeOutEnabled: true,     // outgoing track fade envelope
    fadeInEnabled: true,      // incoming track fade envelope
    skipIntro: false,         // skip detected initial silence on a fresh track
    silenceDb: P.DEFAULT_SILENCE_DB,
    introMaxSec: P.DEFAULT_INTRO_MAX_SEC,
    playbackRate: 1,
    preservePitch: true,
    playbackMode: "normal",
    pitchMode: "preserve",
    eqEnabled: false,
    eqFilters: P.DEFAULT_EQ_FILTERS.map((f) => ({ ...f })),
    limiterEnabled: true,
    limiterMode: "dbfs",
    distortionEnabled: false,
    distortionDrive: P.FX_RANGES.distortionDrive.fallback,
    distortionTone: P.FX_RANGES.distortionTone.fallback,
    distortionMix: P.FX_RANGES.distortionMix.fallback,
    saturationEnabled: false,
    saturationDrive: P.FX_RANGES.saturationDrive.fallback,
    saturationTone: P.FX_RANGES.saturationTone.fallback,
    saturationMix: P.FX_RANGES.saturationMix.fallback,
    phaserEnabled: false,
    phaserRate: P.FX_RANGES.phaserRate.fallback,
    phaserDepth: P.FX_RANGES.phaserDepth.fallback,
    phaserFeedback: P.FX_RANGES.phaserFeedback.fallback,
    phaserMix: P.FX_RANGES.phaserMix.fallback,
    tremoloEnabled: false,
    tremoloRate: P.FX_RANGES.tremoloRate.fallback,
    tremoloDepth: P.FX_RANGES.tremoloDepth.fallback,
    tremoloMix: P.FX_RANGES.tremoloMix.fallback,
    vibratoEnabled: false,
    vibratoRate: P.FX_RANGES.vibratoRate.fallback,
    vibratoDepth: P.FX_RANGES.vibratoDepth.fallback,
    vibratoMix: P.FX_RANGES.vibratoMix.fallback,
    ringmodEnabled: false,
    ringmodFreq: P.FX_RANGES.ringmodFreq.fallback,
    ringmodDepth: P.FX_RANGES.ringmodDepth.fallback,
    ringmodMix: P.FX_RANGES.ringmodMix.fallback,
    chorusEnabled: false,
    chorusRate: P.FX_RANGES.chorusRate.fallback,
    chorusDepth: P.FX_RANGES.chorusDepth.fallback,
    chorusMix: P.FX_RANGES.chorusMix.fallback,
    flangerEnabled: false,
    flangerRate: P.FX_RANGES.flangerRate.fallback,
    flangerDepth: P.FX_RANGES.flangerDepth.fallback,
    flangerMix: P.FX_RANGES.flangerMix.fallback,
    delayEnabled: false,
    delayTime: P.FX_RANGES.delayTime.fallback,
    delayFeedback: P.FX_RANGES.delayFeedback.fallback,
    delayMix: P.FX_RANGES.delayMix.fallback,
    reverbEnabled: false,
    reverbDecay: P.FX_RANGES.reverbDecay.fallback,
    reverbMix: P.FX_RANGES.reverbMix.fallback,
    fxBakeDelayMs: P.DEFAULT_FX_BAKE_DELAY_MS,
    remixFormat: "wav",
    queue: [],   // upcoming tracks added from the music catalog
  };

  P.waveSurfer = null;
  P.peaks = null;
  P.howl = null;
  P.waviz = null;
  P.mediaElementWrapper = null;
  P.aplayer = null;
  P.aplayerHost = null;
  P.jplayerHost = null;
  P.wavizCanvas = null;
  P.wavizPlayHandler = null;
  P.wavizPauseHandler = null;
  P.audioContext = null;
  P.mediaSourceNode = null;
  P.mainGainNode = null;
  P.eqInputNode = null;
  P.eqFilters = [];
  // Effects are offline-rendered into WAV blobs. Caches are keyed by the
  // original track URL; the rendered URL is only used while its settings key
  // still matches, so a half-finished render can never reach playback.
  P.decodedTrackCache = new Map();
  P.renderedTrackCache = new Map();
  P.renderRequests = new Map();
  P.MAX_DECODED_TRACKS = 4;
  P.MAX_RENDERED_TRACKS = 6;
  P.decodeContext = null;
  P.programLocked = false;   // radio owns the program: no manual track changes
  P.loadedRemixUrl = "";     // object URL of an imported remix, revoked on replace
  P.remixMessageTimer = 0;
  P.fxRenderTimer = 0;
  P.fxRenderToken = 0;
  P.fxRenderDeadline = 0;
  P.fxRenderFailed = false;
  P.fxStatusTick = 0;
  P.liveFxInputNode = null;
  P.liveFxOutputNode = null;
  P.liveFxOscillators = [];
  P.liveFxSignature = "";
  P.restoring = false;
  P.loadToken = 0;
  P.masterOutputNode = null;
  P.limiterNode = null;
  P.limiterInputNode = null;
  P.limiterOutputNode = null;
  P.limiterChainNodes = [];
  P.limiterEnabled = true;
  P.limiterMeterNode = null;
  P.limiterMeterRaf = 0;
  P.limiterPeak = 0;
  P.limiterPeakHold = 0;
  P.limiterPeakHoldAt = 0;
  P.pendingStart = null;
  P.pendingAutoplay = false;
  // Intro analysis is cached per URL + threshold so scrubbing back and
  // replaying a track never decodes the same file twice.
  P.introCache = new Map();
  P.introToken = 0;
  P.introUserSeeked = false;
  P.saveTimer = 0;
  P.hideTimer = 0;
  P.settingsTimer = 0;
  P.queueTimer = 0;
  P.loadHideTimer = 0;
  P.loadFallbackTimer = 0;
  P.preloadTimer = 0;
  P.preloadUrl = "";
  P.shufflePick = null;
  P.scriptPromise = null;
  P.peaksScriptPromise = null;
  P.howlerScriptPromise = null;
  P.wavizScriptPromise = null;
  P.mediaElementScriptPromise = null;
  P.amplitudeScriptPromise = null;
  P.aplayerScriptPromise = null;
  P.jqueryScriptPromise = null;
  P.jplayerScriptPromise = null;
  P.loadedEngineCss = new Set();
  P.labRaf = 0;
  P.labNode = null;
  P.labGain = null;
  P.activeFades = new Set(); // temporary <audio> elements fading out after a track switch
  P.incomingFadeToken = 0;     // invalidates an older anti-click ramp on rapid switches
  P.incomingFadeActive = 0;

  /* ---------- engine-owned UI inside the player ----------
   * MediaElement.js, AmplitudeJS, APlayer and jPlayer render their own controls.
   * Those controls are placed in the same seek row as WaveSurfer's waveform —
   * there is no second floating interface above the main player. Howler has no
   * DOM UI of its own, so its live analyser uses that same slot.
   */

  P.ENGINE_UI = new Set(["howler", "mediaelement", "amplitude", "aplayer", "jplayer"]);

  P.shareStatusTimers = new WeakMap();

  P.RECORDER_MIMES = {
    mp3: ["audio/mpeg", "audio/webm;codecs=mp3"],
    opus: ["audio/ogg;codecs=opus", "audio/opus", "audio/webm;codecs=opus"],
    ogg: ["audio/ogg;codecs=opus", "audio/ogg;codecs=vorbis", "audio/ogg"],
  };

  P.fadeDrag = { type: null, pointerId: null, offsetIn: 0, offsetOut: 0 };

  P.eqDrag = { index: -1, pointerId: null };

  P.fxDrag = { kind: null, pointerId: null };}

// These elements exist only after the player markup is injected.
export function initDom(P) {

  P.audio = P.$("audio");
  P.preloadAudio = P.$("preloadAudio");
  P.loadingEl = P.$("playerLoading");
  P.loadingPercentEl = P.$("playerLoadingPercent");
  P.loadingFillEl = P.$("playerLoadingFill");
  P.bar = P.$("playerBar");
  P.seek = P.$("playerSeek");
  P.waveform = P.$("playerWaveform");
  P.volume = P.$("playerVolume");
  P.settingsPanel = P.$("playerSettings");
  P.queuePanel = P.$("playerQueuePanel");
  P.settingsToggle = P.$("playerSettingsToggle");
  P.queueToggle = P.$("playerQueueToggle");
  P.engineUi = P.$("playerEngineUi");}
