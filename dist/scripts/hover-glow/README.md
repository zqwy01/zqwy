# `scripts/hover-glow.js` → `scripts/hover-glow/`

Акцентная подсветка карточек на страницах `links`/`game` и строк
`.music-track`: цвет берётся из названия, курсор подсвечивает ближайшую
карточку.

| Файл | Что внутри |
| --- | --- |
| `context.js` | `DEFAULT`, таблица `ACCENTS`, состояние и DOM-ссылки |
| `accents.js` | `cardFrom()`, `applyAccents()` |
| `events.js` | разовые слушатели `zqwy:pagechange` и движения мыши |

Как и остальные страничные скрипты, подключается с `type="module"`; точка входа
`scripts/hover-glow.js` лишь импортирует `hover-glow/index.js`.
