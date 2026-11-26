# `scripts/menu.js` → `scripts/menu/`

Логотип-меню, растущий поиск, темы, язык, настройки и подсказки поиска.

`scripts/menu.js` — тонкая точка входа с `type="module"`; весь код лежит здесь.
Все слушатели ставятся один раз на `document`; на `zqwy:pagechange` только
перехватываются ссылки на свежие DOM-элементы (`initPage()` → `refresh()`).

| Файл | Что внутри |
| --- | --- |
| `context.js` | `P` с бывшими верхнеуровневыми переменными; `I18N`, ключ настроек, URL индекса и build-info |
| `i18n.js` | `t()`, `applyLanguage()` и событие `zqwy:languagechange` |
| `search.js` | нормализация, синонимы, расстояние Левенштейна, подсказки, результаты поиска, загрузка индекса |
| `ui.js` | `refresh()`, открытие/закрытие меню, размеры поиска |
| `theme.js` | применение и предпросмотр темы/языка |
| `settings.js` | чтение/сохранение `zqwy.site.settings.v1`, сообщение «Сохранено» |
| `build-info.js` | загрузка `data/build-info.json` и ссылка на заметки о сборке |
| `init.js` | `initPage()` — привязка к элементам новой страницы |
| `events.js` | делегированные обработчики кликов, ввода, `submit`, клавиатуры и `zqwy:pagechange` |

Пути сайта (`SITE_ROOT`, `INDEX_URL`, `BUILD_INFO_URL`) считаются от
`import.meta.url`, а не от `document.currentScript` (в модуле он `null`) и не от
`document.baseURI` (он меняется при SPA-переходах). Поэтому поиск и ссылка на
build-info работают и на вторичных страницах, и на GitHub Pages с подпутью.
