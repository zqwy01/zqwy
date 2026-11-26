# `scripts/transition.js` → `scripts/transition/`

SPA-навигация: анимация ухода/прихода страницы, лоадер, подгрузка стилей и
скриптов новой страницы, `zqwy:pagechange`.

`scripts/transition.js` — тонкая точка входа:

```html
<script src="../scripts/transition.js" type="module"></script>
```

| Файл | Что внутри |
| --- | --- |
| `context.js` | бывшие верхнеуровневые переменные (`root`, тайминги, состояние навигации) |
| `motion.js` | `playPageEnter()` — анимация появления `.page-content` |
| `loader.js` | создание/показ/скрытие отложенного лоадера |
| `preload.js` | `isInternal`, `samePath`, `preloadStyles`, `preloadScripts`, `waitForFonts` |
| `navigation.js` | `navigate()` — fetch HTML, замена `.page-content`, `pushState`, событие `zqwy:pagechange` |
| `events.js` | разовая установка обработчиков на `document` (`popstate`, клики по ссылкам, `DOMContentLoaded`) |

Важно: `preloadScripts()` копирует с исходного тега `type="module"`. Все
страничные скрипты теперь модули, поэтому без этого браузер выполнил бы их
как обычные скрипты и упал бы на `import`/`import.meta`.

Модуль загружается один раз; при повторных переходах `window.zqwyNavigate`,
глобальный плеер и слушатели остаются теми же — пересоздаётся только
`.page-content`.
