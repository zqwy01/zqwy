/* Общий контекст menu.js: бывшие верхнеуровневые
 * переменные. Инициализируется до обработчиков событий. */
export const P = {};

export function initContext(P) {

  "use strict";

  P.SETTINGS_KEY = "zqwy.site.settings.v1";
  P.INDEX_FILE = "./data/search-index.json";
  // Modules have no document.currentScript, and SPA navigation rewrites
  // document.baseURI. Anchor every site-wide URL to this module's own URL so
  // search suggestions and build-info links work on secondary pages and on
  // GitHub Pages subpaths.
  P.SITE_ROOT = new URL("../../", import.meta.url).href;
  P.SCRIPT_URL = new URL("../menu.js", import.meta.url).href;
  P.INDEX_URL = new URL(P.INDEX_FILE, P.SITE_ROOT).href;
  P.BUILD_INFO_URL = new URL("data/build-info.json", P.SITE_ROOT).href;
  P.baseRelativeUrl = (path) => new URL(path, P.SITE_ROOT).href;
  P.systemQuery = window.matchMedia ? window.matchMedia("(prefers-color-scheme: light)") : null;

  /* Site chrome is bilingual. Search data stays bilingual regardless of this
     setting — the switch only translates the interface, not the index. */
  P.I18N = {
    ru: {
      menuOpen: "Открыть меню", menuClose: "Закрыть меню",
      siteSearch: "Поиск", siteSearchLabel: "Общий поиск сайта",
      searchPlaceholder: "Поиск", searchTitle: "Общий поиск сайта (Ctrl+F)",
      homeHeading: "Поиск по моим данным. Откройте меню (логотип) для каталога и настроек.",
      searchResults: "Результаты поиска", suggestions: "Подсказки поиска",
      siteMenu: "Меню сайта", mainMenu: "Основное меню",
      catalog: "Каталог", back: "Назад",
      catalogWiki: "вики", catalogGame: "игры", catalogMusic: "музыка",
      catalogPhoto: "фото", catalogLinks: "ссылки", catalogSettings: "настройки",
      homeGame: "игры", homeMusic: "музыка", homeLinks: "ссылки",
      catalogMusicPlayer: "плеер", catalogMusicRadio: "радио",
      musicHeading: "Все релизы zqwy. Выберите альбом и слушайте.",
      radioService: "радио", radioHeading: "Круглосуточный эфир",
      radioHint: "Непрерывная программа идёт от фиксированной точки 2020-01-01 UTC. Треки следуют строго один за другим; загрузка сайта не сбрасывает эфир.",
      radioPlay: "Включить эфир", radioPause: "Пауза эфира",
      radioOnAir: "В эфире", radioPaused: "Эфир на паузе", radioOffAir: "Эфир выключен",
      radioSchedule: "Программа дня", radioNow: "Сейчас", radioNextTrack: "Далее",
      radioProgramNav: "Навигация по программе", radioEarlier: "← Раньше", radioToLive: "К эфиру", radioLater: "Позже →",
      radioSettings: "Настройки радио", radioSyncTip: "Если эфир ушёл вперёд или отстал по времени, синхронизируйте его вручную или настройте автоподстройку в «Настройках радио» ниже.",
      radioSettingsHint: "Ручная синхронизация перематывает текущий трек к времени эфира. Автоподстройка работает только при большом отставании и не отматывает назад.",
      radioSyncNow: "Синхронизировать время", radioAutoSync: "Автосинхронизация при отставании",
      radioSyncThreshold: "Порог отставания", radioSyncInterval: "Минимальный интервал",
      radioLocked: "Плеер закреплён за эфиром",
      radioEmpty: "Нет доступных треков", radioUnavailable: "Каталог недоступен",
      notesHeading: "Заметки в формате markdown, собранные из src/notes/.",
      notesBack: "Назад к заметкам",
      notesGraphLink: "Граф заметок",
      graphHeading: "Связи между заметками. Тяните узлы, фильтры — по вкусу.",
      graphHint: "Двойной клик по заметке — открыть. Пробел — пауза, F — вписать, / — поиск.",
      graphEngines: "Движок", graphFilter: "Фильтр", graphSearch: "Поиск по графу", graphActions: "Действия",
      graphFit: "Вписать", graphPause: "Пауза", graphPlay: "Движение", graphWalk: "Прогулка",
      graphReset: "Сброс", graphFullscreen: "Полный экран", graphOpen: "Открыть заметку", graphNeighbours: "Связанные заметки",
      graphStats: "узлов", graphLinks: "связей", graphSelected: "выбрано",
      blogHeading: "Блог · хронология",
      blogHint: "Записи расположены по датам — от новых к старым.",
      linksHeading: "Все мои ссылки в одном месте.",
      linksNavSections: "Разделы ссылок",
      linksNavSocial: "Соцсети и контент", linksNavMusic: "Музыкальные площадки",
      linksNavStocks: "Стоки",
      linksSectionSocial: "Соцсети и контент", linksSectionMusic: "Музыкальные площадки",
      linksSectionStocks: "Стоки",
      notesEmpty: "Заметки пока не добавлены. Положите .md-файлы в src/notes/.",
      wikiHint: "Хранение текстовой информации. Формат: markdown (преобразуется в HTML выбранным движком).",
      settingsHint: "Настройки касаются всего веб-сайта.",
      playerSettings: "Настройки плеера",
      theme: "Тема", themeDark: "Тёмная", themeLight: "Светлая", themeSystem: "Системная",
      search: "Поиск", rememberQuery: "Запоминать последний запрос",
      language: "Язык", languageRu: "Русский", languageEn: "English",
      reset: "Сбросить", save: "Сохранить",
      searching: "Поиск: «{query}»…", found: "Найдено: {count}",
      matchProgress: "Совпадение {current} из {total} · Enter — дальше",
      enterNext: "Enter — перейти к совпадениям",
      noResults: "Ничего не найдено. Попробуйте слово на другом языке.",
      onPage: "На странице",
      indexUnavailable: "Индекс поиска недоступен (data/search-index.json).",
      build: "Версия сборки", buildNumber: "сборка", buildUnavailable: "недоступна",
      updateNote: "Что нового",
      themePreview: "Предпросмотр темы — нажмите «Сохранить».",
      languagePreview: "Предпросмотр языка — нажмите «Сохранить».",
      saved: "Сохранено.", resetDone: "Сброшено.", enterQuery: "Введите запрос для поиска.",
    },
    en: {
      menuOpen: "Open menu", menuClose: "Close menu",
      siteSearch: "Search", siteSearchLabel: "Site-wide search",
      searchPlaceholder: "Search", searchTitle: "Site-wide search (Ctrl+F)",
      homeHeading: "Search across my data. Open the menu (logo) for the catalog and settings.",
      searchResults: "Search results", suggestions: "Search suggestions",
      siteMenu: "Site menu", mainMenu: "Main menu",
      catalog: "Catalog", back: "Back",
      catalogWiki: "wiki", catalogGame: "games", catalogMusic: "music",
      catalogPhoto: "photo", catalogLinks: "links", catalogSettings: "settings",
      homeGame: "games", homeMusic: "music", homeLinks: "links",
      catalogMusicPlayer: "player", catalogMusicRadio: "radio",
      musicHeading: "All zqwy releases. Pick an album and listen.",
      radioService: "radio", radioHeading: "24/7 broadcast",
      radioHint: "One continuous program runs from the fixed 2020-01-01 UTC epoch. Tracks follow one another strictly; site updates never reset the air.",
      radioPlay: "Start broadcast", radioPause: "Pause broadcast",
      radioOnAir: "On air", radioPaused: "Broadcast paused", radioOffAir: "Broadcast off",
      radioSchedule: "Day program", radioNow: "Now", radioNextTrack: "Next",
      radioProgramNav: "Program navigation", radioEarlier: "← Earlier", radioToLive: "To live", radioLater: "Later →",
      radioSettings: "Radio settings", radioSyncTip: "If the broadcast has drifted ahead or behind, sync it manually or adjust automatic resync in “Radio settings” below.",
      radioSettingsHint: "Manual sync seeks the current track to the broadcast time. Automatic resync only reacts to a large lag and never seeks backwards.",
      radioSyncNow: "Synchronize time", radioAutoSync: "Automatic resync on lag",
      radioSyncThreshold: "Lag threshold", radioSyncInterval: "Minimum interval",
      radioLocked: "Player locked to the broadcast",
      radioEmpty: "No tracks available", radioUnavailable: "Catalog unavailable",
      notesHeading: "Markdown notes collected from src/notes/.",
      notesBack: "Back to notes",
      notesGraphLink: "Notes graph",
      graphHeading: "Connections between notes. Drag the nodes; tune the filters to taste.",
      graphHint: "Double-click a note to open it. Space — pause, F — fit, / — search.",
      graphEngines: "Engine", graphFilter: "Filter", graphSearch: "Search the graph", graphActions: "Actions",
      graphFit: "Fit", graphPause: "Pause", graphPlay: "Motion", graphWalk: "Stroll",
      graphReset: "Reset", graphFullscreen: "Full screen", graphOpen: "Open note", graphNeighbours: "Connected notes",
      graphStats: "nodes", graphLinks: "links", graphSelected: "selected",
      blogHeading: "Blog · timeline",
      blogHint: "Entries follow dates — newest first.",
      linksHeading: "All my links in one place.",
      linksNavSections: "Link sections",
      linksNavSocial: "Social & content", linksNavMusic: "Music platforms",
      linksNavStocks: "Stocks",
      linksSectionSocial: "Social & content", linksSectionMusic: "Music platforms",
      linksSectionStocks: "Stocks",
      notesEmpty: "No notes yet. Put .md files into src/notes/.",
      wikiHint: "Text storage. Format: markdown (converted to HTML by the selected engine).",
      settingsHint: "Settings apply to the whole site.",
      playerSettings: "Player settings",
      theme: "Theme", themeDark: "Dark", themeLight: "Light", themeSystem: "System",
      search: "Search", rememberQuery: "Remember last query",
      language: "Language", languageRu: "Russian", languageEn: "English",
      reset: "Reset", save: "Save",
      searching: "Searching: “{query}”…", found: "Found: {count}",
      matchProgress: "Match {current} of {total} · Enter — next",
      enterNext: "Enter — jump to matches",
      noResults: "Nothing found. Try a word in another language.",
      onPage: "On this page",
      indexUnavailable: "Search index unavailable (data/search-index.json).",
      build: "Build version", buildNumber: "build", buildUnavailable: "unavailable",
      updateNote: "What's new",
      themePreview: "Theme preview — click “Save” to keep it.",
      languagePreview: "Language preview — click “Save” to keep it.",
      saved: "Saved.", resetDone: "Reset.", enterQuery: "Enter a query to search.",
    },
  };
  P.language = "ru";
  // A theme chosen in the settings form is only a preview until Save is pressed.
  // It lives in memory so a reload falls back to the last saved choice.
  P.previewTheme = null;
  P.previewLanguage = null;
  P.themeAnimTimer = 0;
  P.langAnimTimer = 0;
  P.savedTimer = 0;
  P.buildInfoCache = null;

  P.els = {};
  P.closing = false;
  P.closeTimer = null;
  P.lastFocus = null;
  P.prevOverflow = "";
  P.indexCache = null;
  P.suggestionCache = null;
  P.currentSuggestions = [];
  P.activeSuggestion = -1;
  P.suggestionSeq = 0;
  P.suggestionBlurTimer = 0;
  P.pageMatches = [];
  // Word-level marks survive until the next search so Enter can walk through
  // every match instead of re-running the same query.
  P.wordHighlights = [];
  P.activeWordIndex = -1;
  P.lastSearchQuery = "";
  P.lastResultCount = 0;
  P.lastIndexError = false;
  P.blockGlowTimer = 0;
  P.activeGlowTimer = 0;
  P.MAX_WORD_HIGHLIGHTS = 200;

  P.TYPE_ICON = {
    link: "🔗",
    track: "♪",
    album: "▣",
    game: "🎮",
    page: "▤",
    onpage: "⌕",
  };}
