#!/usr/bin/env node
/*
 * Собирает единый индекс поиска для site-поиска.
 *
 * Источники:
 *   dev/links/index.html        — карточки ссылок (соцсети и площадки)
 *   dev/game/index.html         — карточки игр и игровых проектов
 *   dev/data/music-catalog.json — релизы и треки (создаётся build_music_catalog.mjs)
 *   dev/data/wiki-notes.json  — заметки из src/notes/ (build_wiki_notes.mjs)
 *   dev/data/search-synonyms.json — пары слов RU/EN для поиска «tiktok = тикток»
 *
 * Результат: dev/data/search-index.json в формате
 *   { generatedAt, synonyms, phrases, items: [{title, path, text, tags, category, type, keywords}] }
 *
 * Запускается автоматически из scripts/build_dist.sh и вручную:
 *   node scripts/build_search_index.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PROJECT = path.resolve(HERE, "..");
const DEV = path.join(PROJECT, "dev");
const LINKS_FILE = path.join(DEV, "links", "index.html");
const GAMES_FILE = path.join(DEV, "game", "index.html");
const CATALOG_FILE = path.join(DEV, "data", "music-catalog.json");
const NOTES_FILE = path.join(DEV, "data", "wiki-notes.json");
const SYNONYMS_FILE = path.join(DEV, "data", "search-synonyms.json");
const OUT_FILE = path.join(DEV, "data", "search-index.json");

function stripTags(value) {
  return String(value || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function decodeAttr(value) {
  return stripTags(value);
}

/* ---------- поиск треков на RU и EN ---------- */

/*
 * Названия треков в коллекции в основном английские. Чтобы трек находился
 * и по-русски, для каждого слова добавляем два вида ключевых слов:
 *   1)translation — человеческий перевод (`forest` → `лес`);
 *   2)транслитерацию (`agony` → `агони`), она покрывает названия вроде
 *     `Lilith`/`Agonia`, когда пользователь вводит их кириллицей.
 * Словарь ниже покрывает часто встречающиеся слова; для остальных
 * работает транслитерация.
 */
const TRACK_WORD_RU = {
  alone: ["один", "одинокий"], agonia: ["агония"], agnosia: ["агнозия"],
  aleph: ["алеф"], algiz: ["алгиз"], all: ["всё"], and: ["и"],
  anti: ["анти"], apart: ["врозь"], aperture: ["диафрагма"],
  appendix: ["аппендикс"], arche: ["архе"], are: ["есть"],
  baby: ["малыш"], basis: ["основа"], beat: ["бит", "удар"],
  biela: ["белый"], bird: ["птица"], black: ["чёрный"],
  bladder: ["мочевой пузырь"], blizko: ["близко"], boha: ["бога"],
  bridge: ["мост"], broken: ["сломанный"], butterfly: ["бабочка"],
  candles: ["свечи"], cardiogram: ["кардиограмма"], change: ["перемена"],
  chemical: ["химический"], clovek: ["человек"], cluster: ["кластер"],
  codex: ["кодекс"], collapse: ["коллапс"], coma: ["кома"],
  compare: ["сравнение"], config: ["конфиг", "настройка"],
  conquest: ["завоевание"], cool: ["прохлада", "круто"],
  dark: ["тёмный", "тьма"], death: ["смерть"], defense: ["защита"],
  decomposition: ["разложение"], diaphragm: ["диафрагма"],
  digital: ["цифровой"], dino: ["динозавр"], disk: ["диск"],
  dream: ["сон", "мечта"], dreidel: ["дрейдель"], drill: ["дрель", "бур"],
  dusa: ["душа"], eight: ["восемь"], emotions: ["эмоции"],
  end: ["конец"], endorphin: ["эндорфин"], energy: ["энергия"],
  entity: ["сущность"], entrophy: ["энтропия"], esophagus: ["пищевод"],
  everything: ["всё"], exodus: ["исход"], forest: ["лес"],
  freedom: ["свобода"], from: ["из", "от"], fun: ["веселье"],
  functions: ["функции"], gall: ["желчь"], generator: ["генератор"],
  genome: ["геном"], get: ["получить"], glioma: ["глиома"],
  good: ["хороший"], heart: ["сердце"], hierarchy: ["иерархия"],
  hope: ["надежда"], horizons: ["горизонты"], horse: ["лошадь"],
  hours: ["часы"], human: ["человек"], hybrid: ["гибрид"],
  infinity: ["бесконечность"], information: ["информация"],
  instument: ["инструмент"], internet: ["интернет"], invasion: ["вторжение"],
  joker: ["джокер"], jupiter: ["юпитер"], kernel: ["ядро"],
  kidneys: ["почки"], last: ["последний"], level: ["уровень"],
  life: ["жизнь"], light: ["свет"], lilith: ["лилит"],
  liver: ["печень"], logical: ["логический"], lost: ["потерянный"],
  love: ["любовь"], lungs: ["лёгкие"], magpie: ["сорока"],
  meat: ["мясо"], meduzy: ["медузы"], mind: ["разум", "ум"],
  morning: ["утро"], motor: ["мотор"], nebesny: ["небесный"],
  neighbor: ["сосед"], networks: ["сети"], never: ["никогда"],
  night: ["ночь"], null: ["ноль", "пусто"], oil: ["нефть"],
  old: ["старый"], opinion: ["мнение"], organisation: ["организация"],
  other: ["другой"], out: ["outside", "выход"], ozone: ["озон"],
  pain: ["боль"], pancreas: ["поджелудочная"], panic: ["паника"],
  parasite: ["паразит"], petroleum: ["нефть"], piano: ["пианино"],
  plasma: ["плазма"], posledny: ["последний"], post: ["пост"],
  potato: ["картошка"], principle: ["принцип"], private: ["приватный"],
  proxy: ["прокси"], purim: ["пурим"], real: ["реальный"],
  realism: ["реализм"], rectum: ["прямая кишка"], research: ["исследование"],
  resistance: ["сопротивление"], rider: ["всадник"], road: ["дорога"],
  rock: ["скала", "рок"], rotten: ["гнилой"], ruins: ["руины"],
  saints: ["святые"], sand: ["песок"], second: ["второй"],
  shabbat: ["шаббат"], shifting: ["сдвиг"], shiny: ["блестящий"],
  skeleton: ["скелет"], small: ["маленький"], social: ["социальный"],
  space: ["космос", "пространство"], sphere: ["сфера"],
  spirituality: ["духовность"], spleen: ["селезёнка"],
  statement: ["утверждение"], stomach: ["желудок"], strike: ["удар"],
  sublime: ["возвышенное"], sugar: ["сахар"], sun: ["солнце"],
  survivor: ["выживший"], synthetic: ["синтетический"],
  tablet: ["таблетка", "скрижаль"], talking: ["разговор"],
  temple: ["храм"], tent: ["палатка"], textures: ["текстуры"],
  the: ["этот"], time: ["время"], token: ["токен"],
  traces: ["следы"], trachea: ["трахея"], trance: ["транс"],
  twelve: ["двенадцать"], umbrella: ["зонт"], urban: ["городской"],
  vector: ["вектор"], vein: ["вена"], vessel: ["сосуд"],
  video: ["видео"], virtual: ["виртуальный"], virus: ["вирус"],
  vojna: ["война"], mir: ["мир"], mier: ["мир"], walk: ["прогулка"], wall: ["стена"],
  warlock: ["колдун", "варлок"], whisper: ["шёпот"], winter: ["зима"],
  wither: ["увядание"], word: ["слово"], wrangle: ["борьба"],
  zemic: ["земик"], zqwy: ["зкуи", "зквай"],
};

/*
 * Фразы, которые скалькированы с других языков и не выводятся по слову.
 * `vojna a mier` — это «Война и мир»: отдельно `mier` не переводится, а
 * транслитерация даёт «миер», поэтому целую фразу нужно задавать целиком.
 * Группы не попадают в `synonyms` (счётчик групп остаётся прежним), но
 * публикуются в индексе как `phrases`, чтобы поиск мог распознавать такую
 * фразу внутри более длинного предложения.
 */
const PHRASE_ALIASES = [
  {
    phrases: ["vojna a mier", "vojna i mir", "война и мир", "войну и мир", "war and peace"],
    keywords: ["vojna a mier", "vojna i mir", "война и мир", "войну и мир", "war and peace"],
  },
];

const LATIN_TO_CYRILLIC = [
  ["shch", "щ"], ["sch", "щ"], ["sh", "ш"], ["ch", "ч"], ["zh", "ж"],
  ["dz", "дз"], ["ai", "ай"], ["ei", "ей"], ["oo", "у"], ["ee", "и"],
  ["au", "ау"], ["ou", "у"], ["th", "т"], ["ph", "ф"],
  ["a", "а"], ["b", "б"], ["c", "к"], ["d", "д"], ["e", "е"], ["f", "ф"],
  ["g", "г"], ["h", "х"], ["i", "и"], ["j", "дж"], ["k", "к"], ["l", "л"],
  ["m", "м"], ["n", "н"], ["o", "о"], ["p", "п"], ["q", "к"], ["r", "р"],
  ["s", "с"], ["t", "т"], ["u", "у"], ["v", "в"], ["w", "в"], ["x", "кс"],
  ["y", "й"], ["z", "з"],
];

function normalizeWord(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[^a-zа-я0-9]+/gi, " ")
    .trim();
}

function transliterate(word) {
  let rest = String(word || "").toLowerCase();
  let result = "";
  while (rest) {
    const pair = LATIN_TO_CYRILLIC.find(([latin]) => rest.startsWith(latin));
    if (pair) {
      result += pair[1];
      rest = rest.slice(pair[0].length);
      continue;
    }
    if (/[0-9]/.test(rest[0])) { result += rest[0]; rest = rest.slice(1); continue; }
    result += rest[0];
    rest = rest.slice(1);
  }
  return result;
}

function musicKeywords(text) {
  const words = normalizeWord(text).split(/\s+/).filter(Boolean);
  const result = new Set();
  for (const word of words) {
    if (/^[a-z]+$/.test(word)) {
      result.add(transliterate(word));
      for (const ru of TRACK_WORD_RU[word] || []) result.add(normalizeWord(ru));
    } else {
      result.add(word);
    }
  }
  result.add(words.map((word) => (/^[a-z]+$/.test(word) ? transliterate(word) : word)).join(" "));
  const phrase = normalizeWord(text);
  for (const group of PHRASE_ALIASES) {
    if (!group.phrases.some((value) => normalizeWord(value) === phrase)) continue;
    for (const keyword of group.keywords) result.add(normalizeWord(keyword));
  }
  return [...result].filter(Boolean);
}

/* ---------- ссылки со страницы /links/ ---------- */

function collectLinks() {
  const html = fs.readFileSync(LINKS_FILE, "utf8");
  const items = [];
  const sectionRe = /<section class="links-section" id="([^"]+)"[^>]*>([\s\S]*?)<\/section>/g;
  let section;
  while ((section = sectionRe.exec(html))) {
    const sectionId = section[1];
    const sectionBody = section[2];
    const titleMatch = sectionBody.match(/<h2[^>]*>([\s\S]*?)<\/h2>/);
    const sectionTitle = stripTags(titleMatch ? titleMatch[1] : sectionId);
    const cardRe = /<a\s+class="link-card"\s+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g;
    let card;
    while ((card = cardRe.exec(sectionBody))) {
      const href = decodeAttr(card[1]);
      const body = card[2];
      const nameMatch = body.match(/<span class="link-name">([\s\S]*?)<\/span>/);
      const name = stripTags(nameMatch ? nameMatch[1] : href);
      const host = (() => {
        try { return new URL(href).hostname; } catch { return ""; }
      })();
      items.push({
        title: name,
        path: href,
        text: `${sectionTitle} ${name} ${href}`,
        tags: [sectionId, host].filter(Boolean),
        category: "Ссылки",
        type: "link",
        keywords: [name, host, sectionTitle].filter(Boolean),
      });
    }
  }
  return items;
}

/* ---------- игры со страницы /game/ ---------- */

function collectGames() {
  if (!fs.existsSync(GAMES_FILE)) return [];
  const html = fs.readFileSync(GAMES_FILE, "utf8");
  const items = [];
  const sectionRe = /<section class="links-section" id="([^"]+)"[^>]*>([\s\S]*?)<\/section>/g;
  let section;
  while ((section = sectionRe.exec(html))) {
    const sectionId = section[1];
    const sectionBody = section[2];
    const titleMatch = sectionBody.match(/<h2[^>]*>([\s\S]*?)<\/h2>/);
    const sectionTitle = stripTags(titleMatch ? titleMatch[1] : sectionId);
    const cardRe = /<a\s+class="game-card"\s+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g;
    let card;
    while ((card = cardRe.exec(sectionBody))) {
      const href = decodeAttr(card[1]);
      // href is relative to /game/, but search results are opened from the
      // root, so make the path root-relative for the whole site.
      const rootPath = /^(?:https?:|mailto:|\/)/i.test(href)
        ? href
        : `./game/${href.replace(/^\.\//, "")}`;
      const body = card[2];
      const titleMatch = body.match(/<span class="game-card-title">([\s\S]*?)<\/span>/);
      const descMatch = body.match(/<span class="game-card-desc">([\s\S]*?)<\/span>/);
      const title = stripTags(titleMatch ? titleMatch[1] : href);
      const description = stripTags(descMatch ? descMatch[1] : "");
      items.push({
        title,
        path: rootPath,
        text: `${sectionTitle} ${title} ${description}`,
        tags: ["игры", sectionId, "game"],
        category: "Игры",
        type: "game",
        keywords: [title, description, sectionTitle],
      });
    }
  }
  return items;
}

/* ---------- релизы и треки ---------- */

function collectTracks() {
  if (!fs.existsSync(CATALOG_FILE)) return [];
  const catalog = JSON.parse(fs.readFileSync(CATALOG_FILE, "utf8"));
  const items = [];
  for (const album of catalog.albums || []) {
    // сам релиз тоже должен находиться по названию
    items.push({
      title: album.title,
      path: `./music/#${encodeURIComponent(album.id)}`,
      text: `Релиз ${album.title} ${album.id}. ${album.tracks.length} треков.`,
      tags: ["музыка", "альбом", "релиз"],
      category: "Музыка",
      type: "album",
      keywords: [album.title, album.id, ...musicKeywords(album.title)],
    });
    album.tracks.forEach((track, index) => {
      items.push({
        title: track.title,
        path: `./music/?album=${encodeURIComponent(album.id)}&track=${index}#${encodeURIComponent(album.id)}`,
        text: `${track.title} — ${album.title} (zqwy)`,
        tags: ["музыка", "трек", "песня", album.title],
        category: "Музыка",
        type: "track",
        keywords: [
          track.title, album.title, album.id,
          ...musicKeywords(track.title),
          ...musicKeywords(album.title),
        ],
      });
    });
  }
  return items;
}

/* ---------- заметки из src/notes/ ---------- */

function collectNotes() {
  if (!fs.existsSync(NOTES_FILE)) return [];
  try {
    const data = JSON.parse(fs.readFileSync(NOTES_FILE, "utf8"));
    return Array.isArray(data?.notes) ? data.notes : [];
  } catch { return []; }
}

/* ---------- страницы каталога ---------- */

const PAGES = [
  { title: "Главная", path: "./", text: "Поиск по моим данным, каталог, настройки", tags: ["главная", "поиск"], keywords: ["home", "главная", "поиск", "search"] },
  { title: "Музыка", path: "./music/", text: "Релизы и универсальный музыкальный плеер", tags: ["музыка", "плеер"], keywords: ["music", "музыка", "плеер", "player", "альбомы", "треки"] },
  { title: "Ссылки", path: "./links/", text: "Все ссылки: соцсети, музыкальные площадки", tags: ["ссылки", "контакты"], keywords: ["links", "ссылки", "соцсети", "платформы"] },
  { title: "Wiki", path: "./wiki/tiddlywiki/", text: "Текстовая информация в формате markdown", tags: ["вики", "текст"], keywords: ["wiki", "вики", "markdown", "tiddlywiki"] },
  { title: "ZQWY notes", path: "./wiki/zqwy/", text: "Заметки zqwy в формате markdown из src/notes/", tags: ["заметки", "вики"], keywords: ["zqwy", "заметки", "notes", "markdown"] },
  { title: "TiddlyWiki", path: "./wiki/tiddlywiki/", text: "База знаний TiddlyWiki", tags: ["вики"], keywords: ["tiddlywiki", "тиддливики"] },
  { title: "Obsidian", path: "./wiki/obsidian/", text: "База знаний Obsidian", tags: ["вики"], keywords: ["obsidian", "обсидиан"] },
  { title: "Logseq", path: "./wiki/logseq/", text: "База знаний Logseq", tags: ["вики"], keywords: ["logseq", "логсек"] },
  { title: "Quartz", path: "./wiki/quartz/", text: "База знаний Quartz", tags: ["вики"], keywords: ["quartz", "кварц"] },
  { title: "Game", path: "./game/", text: "Игры и игровые проекты", tags: ["игры"], keywords: ["game", "игры", "игра"] },
  { title: "Photo", path: "./photo/", text: "Фотографии", tags: ["фото"], keywords: ["photo", "фото", "фотографии"] },
];

/* ---------- сборка ---------- */

if (!fs.existsSync(LINKS_FILE)) {
  console.error(`Нет страницы со ссылками: ${LINKS_FILE}`);
  process.exit(1);
}
if (!fs.existsSync(GAMES_FILE)) {
  console.error(`Нет страницы с играми: ${GAMES_FILE}`);
  process.exit(1);
}

const synonyms = fs.existsSync(SYNONYMS_FILE)
  ? JSON.parse(fs.readFileSync(SYNONYMS_FILE, "utf8"))
  : [];

const items = [
  ...PAGES.map((item) => ({ ...item, category: "Страницы", type: "page" })),
  ...collectNotes(),
  ...collectLinks(),
  ...collectGames(),
  ...collectTracks(),
];

const payload = {
  generatedAt: new Date().toISOString(),
  synonymGroups: synonyms.length,
  itemCount: items.length,
  synonyms,
  phrases: PHRASE_ALIASES.map((group) => group.phrases),
  items,
};

fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });
fs.writeFileSync(OUT_FILE, `${JSON.stringify(payload)}\n`, "utf8");

const sizeKb = Math.round(fs.statSync(OUT_FILE).size / 1024);
console.log(`Индекс поиска: ${items.length} записей, ${synonyms.length} групп синонимов`);
console.log(`Записано: ${path.relative(PROJECT, OUT_FILE)} (${sizeKb} КБ)`);
