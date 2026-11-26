/* Общий контекст radio.js: бывшие верхнеуровневые
 * переменные. Инициализируется до обработчиков событий. */
export const P = {};

export function initContext(P) {

  "use strict";

  // Anchor site data to this module, not document.baseURI: SPA navigation and
  // direct loads of /radio/ would otherwise resolve ../../data/ to the server
  // root instead of the site root (and break on GitHub Pages subpaths).
  P.SITE_ROOT = new URL("../../", import.meta.url).href;
  P.CATALOG_URL = new URL("data/music-catalog.json", P.SITE_ROOT).href;
  P.STORAGE_ACTIVE = "zqwy.radio.active.v1";
  P.STORAGE_SETTINGS = "zqwy.radio.settings.v1";
  P.EPOCH_MS = Date.UTC(2020, 0, 1);
  P.CYCLE_MS = 24 * 60 * 60 * 1000;
  P.BLOCK_MS = 4 * 60 * 60 * 1000;
  P.BLOCKS_PER_DAY = P.CYCLE_MS / P.BLOCK_MS;
  P.TICK_MS = 1000;
  // Do not fight the audio clock every second: a small correction sounds like
  // a rewind. Correct only a substantial drift, only forward, and rarely.
  // Both values are editable in the radio settings and persisted locally.
  P.DEFAULT_RESYNC_MS = 20000;
  P.DEFAULT_RESYNC_INTERVAL_MS = 30000;
  P.MAX_CACHED_PROGRAMS = 3;

  P.TEXT = {
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
      syncDone: "Время синхронизировано", syncDrift: "Расхождение",
      syncNoTrack: "Нет текущего трека для синхронизации", syncUnavailable: "Каталог недоступен",
      syncAhead: "Вперёд", syncBehind: "Отставание",
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
      syncDone: "Time synchronized", syncDrift: "Drift",
      syncNoTrack: "No current track to synchronize", syncUnavailable: "Catalog unavailable",
      syncAhead: "Ahead", syncBehind: "Lag",
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

  P.state = {
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
    autoSync: true,
    resyncMs: P.DEFAULT_RESYNC_MS,
    resyncIntervalMs: P.DEFAULT_RESYNC_INTERVAL_MS,
  };

  P.ui = {};}
