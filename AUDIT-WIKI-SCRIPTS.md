# Аудит скриптов генерации wiki-треков

- **Дата:** 2026-11-17
- **Область:** `/home/zqwy/smb/sda/apps/tiddlywiki/tiddlywiki-data`
- **Режим:** только чтение. Генераторы страниц **не запускались**, чтобы не
  перезаписать `files/dev/pages`. Отбор страниц проверен программно через
  импорт функций из `scripts/templater_page.js`.
- **Задача:** отделить актуальные скрипты от устаревших и понять, что имеет
  смысл переносить в `zqwy`.

---

## Кратко

1. **Актуальная генерация страниц — это 5 файлов кода + 2 шаблона:**
   `build-albums.js`, `build-singles.js`, `templater_page.js`,
   `builder/markdown.js`, `backend/templater/releases.json`,
   `templates/template.html`, `templates/menu.html`.
2. **Остальной `scripts/builder/`** — это проверки, предпросмотр и
   неиспользуемая параллельная ветка рендера. Для основной сборки он не нужен.
3. **Главная проблема не в коде, а в данных.** Поле `music.releaseSize`
   заполнено только у 10 записей из 73 (после дедупликации — 2 альбома и
   3 сингла). Остальные 63 релиза страниц не создают.
4. **`buildPages()` не чистит каталог вывода.** Сейчас в `files/dev/pages`
   39 страниц, а текущий `releases.json` даёт 28. 11 старых страниц
   (`new_tablet`, `the_remaining_one`) остаются навсегда.
5. **`validate-releases.mjs` красный:** 386 замечаний, exit code 1. Это не
   гейт сборки, но и не зелёная проверка.
6. **Документация местами устарела:** README ссылается на константу
   `EXPECTED_RELEASES=17` и на несуществующее упоминание `scripts/build.sh`,
   а в порядке сборки пропущен шаг генерации страниц.

---

## 1. Два уровня пайплайна

Слово «генерация wiki-треков» здесь означает два разных слоя. Их важно не
смешивать: первый готовит данные, второй рисует HTML.

```
RPP ──Reaper──▶ WAV
        │
        ▼
analyzer/*.mjs ──▶ projects.json, tracks.json, output/index.json
        │
        ▼
build-releases.mjs ──▶ backend/templater/releases.json
        │
        ▼
build-albums.js / build-singles.js
        │  (templater_page.js + builder/markdown.js)
        ▼
files/dev/pages/*.html
        │
        ▼
build_dist.sh ──▶ files/dist/
```

- **Слой данных:** Reaper → анализатор → `output/index.json` →
  `releases.json`. Здесь живут метаданные, теги, ISRC, длительности, URL.
- **Слой страниц:** `releases.json` + шаблоны → HTML → минификация.
  Именно этот слой обычно и называют «генерацией wiki-страниц».

---

## 2. Актуальная цепочка

### 2.1. Генерация страниц (ядро)

| Шаг | Команда | Файлы | Состояние | Замечание |
|---|---|---|---|---|
| Альбомы | `node scripts/build-albums.js` | `build-albums.js`, `templater_page.js`, `builder/markdown.js`, `template.html`, `menu.html` | работает | отбирает записи с `releaseSize === "album"`; пишет одну страницу альбома + страницу на каждый трек в `pages/<album>/` |
| Синглы | `node scripts/build-singles.js` | те же | работает | отбирает `releaseSize === "single"`; пишет `pages/<name>.html` |
| Движок | — | `scripts/templater_page.js` (909 строк) | актуален | `readJson`, `readTemplate`, `buildPages`, `getReleaseType`, `getFileName`, `collectAlbumPages`; импортирует только `builder/markdown.js` |
| Markdown | — | `scripts/builder/markdown.js` | актуален | `marked` + `sanitize-html`, единственный модуль из `builder/`, который реально нужен генераторам |
| Данные | — | `scripts/backend/templater/releases.json` | актуален | 73 релиза, 563 трека; единственный источник истины для страниц |
| Шаблоны | — | `files/dev/templates/template.html`, `menu.html` | актуальны | контракт проверен: 9 переменных у `template.html` |
| Минификация | `bash scripts/build_dist.sh` | `scripts/build_dist.sh` | работает | `files/dev` → `files/dist`, `rm -rf dist`, затем `terser`, `clean-css-cli`, `html-minifier-terser` |

### 2.2. Зависимости

| Где | Что | Зачем |
|---|---|---|
| `scripts/package.json` | `marked ^18`, `sanitize-html ^2.17` | нужны `builder/markdown.js`; лежат в `scripts/node_modules` |
| корневой `package.json` | `terser`, `clean-css-cli`, `html-minifier-terser` | нужны `build_dist.sh` |
| корневой `package.json` | `express`, `serve-index` | только для `fileserver.js`, к страницам отношения не имеют |

### 2.3. Данные (upstream, актуально, но не обязательно для рендера)

| Скрипт | Что делает | Когда нужен |
|---|---|---|
| `backend/analyzer/render-rpp.mjs --render` | рендер `.RPP` через Reaper, правки копии проекта | если появляются новые/изменённые треки |
| `backend/analyzer/metadata-audit.mjs --gaps` | отчёт о заполненности метаданных | диагностика |
| `backend/analyzer/tracks-scanner.mjs` | `tracks.json` | обновление технических полей |
| `backend/analyzer/summary-scanner.mjs` | сводка по коллекции | диагностика |
| `backend/templater/build-releases.mjs` | собирает `releases.json` из `output/index.json` + `projects.json` + `tracks.json` | если меняются вики-описания или коллекция |
| `catalog_analyzer/daemon.mjs` + `content.json` | вики-источник описаний (54 релиза) | обновление редакционных текстов |

Все они работают с внешней коллекцией (`CATEGORY_ROOT`), а не с `files/`.
Без них можно пересобрать страницы из уже готового `releases.json`.

### 2.4. Проверки

| Скрипт | Результат на 2026-11-17 | Вывод |
|---|---|---|
| `builder/check-templates.mjs` | **exit 0** | 118 файлов, `dev`/`dist` согласованы, контракт шаблон ↔ рендерер зелёный; `templates/player.html` пустой |
| `backend/templater/validate-releases.mjs` | **exit 1**, 386 замечаний | красный; см. раздел 5 |
| `builder/check_node.sh` | не запускался | ручной `node --check` по файлам `builder/` |

---

## 3. Актуально, но не входит в сборку (ручное / вспомогательное)

| Файл | Что делает | Почему не в сборке |
|---|---|---|
| `scripts/templater_background.mjs` | генерирует `files/dev/styles/backgrounds/*_background.css` из `templates/styles/background.css` | вызывается вручную; `build-albums`/`build-singles` его не вызывают. Шаблон и готовые фоны существуют, `template.html` на них ссылается |
| `scripts/builder/build-preview.mjs` | предпросмотр трековых страниц в `files/dist/pages-preview` | отдельный ручной прогон; использует `track.html` и `track-page-renderer.js` |
| `scripts/builder/check-templates.mjs` | проверка шаблонов и `dev`/`dist` | полезная проверка, но не часть `build_dist.sh` |
| `scripts/catalog_analyzer/` | вики-источник и демон обновления | upstream данных |
| `scripts/backend/analyzer/*` | анализ аудио, ISRC, loudness, ffprobe | upstream метаданных |
| `scripts/backend/templater/build-pond5.mjs`, `gen-pond5-listings.mjs`, `pond5-*.mjs` | листинги Pond5 | дистрибуция, не страницы |
| `scripts/backend/templater/genre-tag-report.mjs` | сверка жанров анализатора и тегов | отчёт |
| `scripts/builder/master-delivery.sh` | нормализация аудио под Pond5 | аудио, не HTML |
| `scripts/builder/readfiles.sh` | вспомогательный вывод файлов | ad-hoc |
| `scripts/build-context.sh` | `output/project-context.txt` из `files/dist` | вспомогательный, но содержит устаревшую ссылку (см. раздел 4) |

---

## 4. Устаревшее, сломанное и неиспользуемое

| Файл | Вердикт | Доказательство |
|---|---|---|
| `scripts/backend/templater/validate-releases.mjs` | **красный, но рабочий** | exit 1, 386 замечаний; проверяет `output/index.json` + `analyzer/projects.json`/`tracks.json` |
| `scripts/backend/templater/audit-audio-layout.mjs` | **сломан** | ссылается на `scripts/backend/templater/normalize-audio-layout.mjs`, файла нет (строки 6 и 501) |
| `scripts/build-context.sh` | **устаревшая ссылка** | в ошибке предлагает `$PROJECT_DIR/scripts/build.sh`; такого файла нет, актуальный — `scripts/build_dist.sh` |
| `scripts/.old/build.sh` | **устаревший дубль** | 154 строки против 225 у `build_dist.sh`; никем не вызывается |
| `scripts/normalize.mjs` | **legacy / reference-only** | нигде не импортируется; его поведение перенесено в `build-releases.mjs` (комментарии там это фиксируют) |
| `scripts/builder/index.js` | **неиспользуемый barrel** | никто не импортирует `builder/index`; экспортирует `build-pages`, `page-renderer`, `io` |
| `scripts/builder/build-pages.js`, `album-pages.js` | **мёртвая ветка** | доступны только через неиспользуемый `index.js`; основная сборка использует `buildPages` из `templater_page.js` |
| `scripts/builder/page-renderer.js` | **не для основной сборки** | используется только `check-templates.mjs` |
| `files/dev/templates/track.html` | **только preview/check** | `build-albums`/`build-singles` его не читают; нужен `build-preview.mjs` и проверке контракта |
| `files/dev/templates/player.html` | **пустой** | 0 байт; `check-templates.mjs` честно печатает «ПУСТЫЕ В DEV» |
| `scripts/backend/templater/check-render-identity.mjs`, `render-baseline.json` | **историческая сверка** | сравнивает HTML из `releases.json` с HTML из старого `music.json`; для текущей генерации не нужен |
| `scripts/rpp-tags-report.json`, `*.stale`, `projects.json`, `tracks.json` | **артефакты/кэши** | результат прогонов анализатора, не код |
| `scripts/backend/templater/RPP/.venv/`, `demucs-env/`, `node_modules/` | **окружение** | не переносить |

### Расхождения в документации

| Где | Что написано | Как на самом деле |
|---|---|---|
| `README.md:139` | `validate-releases.mjs` падает на `EXPECTED_RELEASES=17` | константа теперь `EXPECTED_RAW_MUSIC_RECORDS = 20` (строка 47); README устарел |
| `README.md:140` | `build_dist.sh` упоминает несуществующий `scripts/build.sh` | текущий `build_dist.sh` такого упоминания не содержит; проблема переехала в `build-context.sh` |
| `README.md:112-130` | «Порядок сборки»: metadata → `build-releases` → `build_dist` | пропущен шаг `build-albums.js` / `build-singles.js`; без него страницы не обновятся |
| `README.md:89-92` | «Прочее»: `build-albums`, `build-singles`, `normalize`, `build-context` | не упомянут главный движок `templater_page.js` |
| `PIPELINE.md:206` | `templater_background.mjs` — «фоновая отрисовка страниц» | на самом деле генерирует CSS-фоны, а не HTML-страницы |
| `builder/build-preview.mjs:8` | «Пишет в `files/preview/`» | фактический путь — `files/dist/pages-preview` (строка 39); README и PIPELINE описывают его верно |

---

## 5. Состояние данных и почему вывод устарел

### 5.1. `releases.json`

| Показатель | Значение |
|---|---:|
| релизов | 73 |
| треков в `trackList` | 563 |
| записей в `output/index.json` (music) | 20 (ожидается `EXPECTED_RAW_MUSIC_RECORDS = 20`) |
| проектов анализатора | 81 |
| **с `releaseSize`** | **10 записей** |
| — album | 4 записи → **2 уникальных** (`kuzya`, `someone`) |
| — single | 6 записей → **3 уникальных** (`algiz`, `biela`, `joker`) |
| **без `releaseSize`** | **63 релиза** |

`getReleaseType()` возвращает `null`, если `music.releaseSize` — не строка
`"album"`/`"single"`. Такие релизы молча пропускаются обоими генераторами.

### 5.2. Что будет сгенерировано сейчас

Расчёт через `collectAlbumPages()` и `getFileName()`:

| Группа | Уникальных файлов |
|---|---:|
| `kuzya/` (альбом + 15 треков) | 16 |
| `someone/` (альбом + 9 треков, один файл совпадает с названием альбома) | 9 |
| `algiz.html`, `biela.html`, `joker.html` | 3 |
| **Итого** | **28** |

### 5.3. Что лежит в `files/dev/pages`

| Каталог | Файлов | Дата |
|---|---:|---|
| `kuzya/` | 16 | 2026-11-17 00:02 |
| `someone/` | 9 | 2026-11-17 00:02 |
| корень (`algiz`, `biela`, `joker`) | 3 | 2026-11-17 00:02 |
| `new_tablet/` | 6 | 2026-10-16 00:01 |
| `the_remaining_one/` | 5 | 2026-10-05 00:01 |
| **Итого** | **39** | |

**11 файлов из `new_tablet` и `the_remaining_one` — стale.** Они не
попадают в текущий отбор (у этих релизов нет `releaseSize`), но и не
удаляются: `buildPages()` только пишет файлы и пропускает уже созданные
пути через `createdPaths`, каталог вывода не очищается. `build_dist.sh`
удаляет `files/dist`, но не `files/dev/pages`, поэтому мусор попадает и в
`dist`.

`files/dev/pages` и `files/dist/pages` сейчас согласованы (по 39 файлов) —
то есть старые страницы уже уехали в сборку.

### 5.4. `validate-releases.mjs`

- exit code **1**, **386** замечаний.
- Статусы связи: `candidate` 60, `track-only` 2, `unmatched` 10,
  `unresolved` 1.
- Первое замечание: «БЕЗ releaseSize (страница не создастся): 63».
- В отчёте «создают страницу: 10» — это записи, а не уникальные страницы;
  дубликаты (`algiz`, `biela`, `Джокер`, `kuzya`, `someone` по два раза)
  видны прямо в списке.
- Скрипт полезен как диагностика, но **не должен быть гейтом**, пока
  данные не приведены в порядок.

### 5.5. `check-templates.mjs`

Зелёный: 118 файлов, `dev`/`dist` согласованы, минифицированные файлы
целы, контракт шаблон ↔ рендерер выполнен. Единственное замечание —
пустой `templates/player.html`, который при этом не ломает проверку.

---

## 6. Что переносить в `zqwy`

### 6.1. Минимальный набор для генерации страниц

Порядок — от обязательного к дополнительному.

| № | Что | Откуда | Куда (предложение) |
|---|---|---|---|
| 1 | `build-albums.js`, `build-singles.js` | `scripts/` | `zqwy/scripts/wiki/` |
| 2 | `templater_page.js` | `scripts/` | `zqwy/scripts/wiki/` |
| 3 | `builder/markdown.js` | `scripts/builder/` | `zqwy/scripts/wiki/builder/` |
| 4 | `releases.json` | `scripts/backend/templater/` | `zqwy/data/wiki/` |
| 5 | `template.html`, `menu.html` | `files/dev/templates/` | `zqwy/dev/templates/wiki/` |
| 6 | `scripts/package.json` → `marked`, `sanitize-html` | `scripts/` | отдельный `package.json` или зависимости в корне |
| 7 | `build_dist.sh` | `scripts/` | адаптировать под `dev/`/`dist/` |
| 8 | Ассеты, на которые ссылается `template.html` | `files/dev/styles/`, `files/dev/scripts/containers/`, `files/src/` | `zqwy/dev/` |

Минимально необходимые ассеты страницы (из `template.html`):

- стили: `styles/style.css`, `styles/selection.css`, `styles/fonts/font.css`,
  `styles/containers/{cover,markdown,menu,player,tags,tracklist}/…`,
  `styles/backgrounds/<release>_background.css`;
- скрипты: `scripts/containers/menu/menu.js`,
  `scripts/containers/player/player_mini.js`,
  `scripts/containers/player/player_switcher.js`,
  `scripts/containers/tracklist/tracklist.js`,
  `scripts/containers/markdown/markdown_images.js`;
- медиа: `files/src/tracks/`, `files/src/covers/`, `files/src/icons/`,
  `files/src/fonts/`.

**Важно:** `zqwy` — это портал, а не музыкальный каталог. Перенос
потребует отдельного решения, куда класть страницы (`/music/`?) и как
связать их с порталом. В рамках аудита ничего не копировалось.

### 6.2. Что не переносить

- `scripts/backend/analyzer/**` — нужен только для пересборки
  `releases.json` из внешней коллекции; для рендера страниц не требуется.
- `scripts/backend/templater/build-*.mjs`, `pond5-*.mjs`,
  `genre-tag-report.mjs` — дистрибуция и отчёты.
- `scripts/normalize.mjs`, `scripts/.old/build.sh` — legacy.
- `scripts/builder/index.js`, `build-pages.js`, `album-pages.js` —
  неиспользуемая ветка.
- `validate-releases.mjs` — пока красный; сначала данные, потом проверка.
- `build-preview.mjs`, `track.html` — только если нужен предпросмотр
  трековых страниц.

---

## 7. Рекомендуемый порядок исправлений (не выполнено)

1. **Решить судьбу `releaseSize`.** Либо заполнить его для 63 релизов,
   либо добавить в генераторы правило «нет `releaseSize` → страница не
   создаётся» с явным отчётом и удалением старых файлов.
2. **Добавить очистку вывода.** Либо `rm -rf files/dev/pages` перед
   генерацией, либо манифест созданных файлов и удаление всего, чего нет в
   манифесте. Иначе `new_tablet` и `the_remaining_one` останутся в сборке.
3. **Разобраться с `validate-releases.mjs`.** Обновить константы и
   документацию, решить, какие 386 замечаний реальные, и только потом
   делать проверку гейтом.
4. **Починить/убрать устаревшие ссылки:** `build-context.sh` →
   `build_dist.sh`; `audit-audio-layout.mjs` → либо реализовать
   `normalize-audio-layout.mjs`, либо убрать обещание из скрипта.
5. **Обновить README.md и PIPELINE.md** по списку из раздела 4.
6. **Удалить/архивировать** `scripts/.old/build.sh` и неиспользуемый
   `builder/index.js`, если они не нужны как история.
7. **Только после этого** переносить минимальный набор в `zqwy` и
   адаптировать пути.

---

## Приложение. Чем проверено

Только чтение, без запуска генераторов:

```bash
# синтаксис и импорты
node --check scripts/build-albums.js
node --check scripts/build-singles.js
node --check scripts/templater_page.js   # импорт также подтверждает marked/sanitize-html

# отбор страниц (импорт функций, без записи)
# getReleaseType: album 4, single 6, null 63
# collectAlbumPages + getFileName: 28 уникальных файлов
# существующих: 39; лишних: 11 (new_tablet 6, the_remaining_one 5)

# проверки
node scripts/builder/check-templates.mjs          # exit 0
node scripts/backend/templater/validate-releases.mjs  # exit 1, 386 замечаний
```

Ключевые файлы, на которые опирается отчёт:

- `scripts/build-albums.js`, `scripts/build-singles.js`
- `scripts/templater_page.js` (строки 55-100 — `getReleaseType`, 560-909 —
  `buildPages`)
- `scripts/builder/markdown.js`
- `scripts/backend/templater/releases.json`
- `scripts/backend/templater/build-releases.mjs`
- `scripts/build_dist.sh`, `scripts/.old/build.sh`
- `files/dev/templates/{template,menu,track,player}.html`
- `README.md`, `PIPELINE.md`
