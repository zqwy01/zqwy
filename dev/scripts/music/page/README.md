# `scripts/music.js` → `scripts/music/page/`

Страница каталога музыки: релизы, треки, три режима просмотра, лайтбокс
обложки, deep-link `?album=&track=` и синхронизация с глобальным плеером.

| Файл | Что внутри |
| --- | --- |
| `context.js` | состояние каталога, ключи `zqwy.music.view.v1` / `zqwy.player.album.v1`, ссылки на DOM |
| `utils.js` | `player()`, `assetUrl()`, `formatTime()`, `plural()` |
| `covers.js` | лайтбокс обложки и буквенный фолбэк, если картинки нет |
| `view.js` | режимы `list`/`cards`/`large`, fullscreen, collapsed, измерение ширины колонки |
| `catalog.js` | рендер релизов и треков, выбор альбома, play/pause, очередь, FLIP-анимация |
| `init.js` | загрузка каталога и первичный рендер |
| `events.js` | обработчики кликов, лайтбокса, `hashchange`, `zqwy:playerstate` |

`assetUrl()` считает пути от `import.meta.url` этого модуля (`../../../src/...`),
а не от `document.baseURI`. Это сохраняет корректные URL обложек и треков и при
SPA-переходах, и при прямом открытии `/music/`, и на GitHub Pages с подпутью.
