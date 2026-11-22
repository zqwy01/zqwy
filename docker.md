# Docker

Кратко о том, как в проекте собирается и запускается контейнер.

## Что делает

- Собирает статический сайт (`dev/` → `dist/`) и отдаёт его через `serve` на порту `3000`.
- В `docker-compose` итоговый сайт берётся с хоста из `./dist` (bind-mount), а не из `dist`, запечённого в образ.

## `Dockerfile` (multi-stage)

1. **`build`** (`node:24-bookworm-slim`, `WORKDIR /src`)
   - `COPY package.json package-lock.json` + `RUN npm ci` — установка зависимостей для минификации (`terser`, `clean-css-cli`, `html-minifier-terser`).
   - `COPY dev ./dev`, `COPY scripts ./scripts` и `COPY src ./src`.
   - `RUN bash scripts/build_dist.sh` — сборка в `/src/dist`.
   - Весь `src/` копируется в образ: `src/notes` — источник заметок, `src/tracks` — аудио для плеера. Поэтому `build_music_catalog.mjs`, `build_wiki_notes.mjs` и индекс поиска пересоздаются при каждом Docker-сборке, а треки физически присутствуют в `dist/src/tracks` и отдаются сайтом (иначе каталог есть, а файлы — 404).

2. **`runtime`** (`node:24-bookworm-slim`, `WORKDIR /app`)
   - `npm install -g serve@14`.
   - `COPY --from=build /src/dist ./dist` — кладёт собранный `dist` в образ.
   - `CMD serve dist -l ${PORT} -n` (по умолчанию `PORT=3000`).

## `docker-compose.yaml`

- Сервис `zqwy_web`, сборка из локального `Dockerfile`.
- `pull_policy: build` — при `docker compose up` образ пересобирается.
- Переменные: `TZ=Europe/Moscow`, `PORT=3000`.
- По умолчанию контейнер отдаёт `dist`, собранный внутри образа (включая сгенерированные каталог/заметки и аудио из `src/`) — это гарантирует свежую сборку при каждом `docker compose up --build`.
- Опционально можно раскомментировать том `./dist:/app/dist:ro`, чтобы отдавать хостовую сборку. В этом режиме содержимое образного `dist` игнорируется, поэтому актуальность заметок зависит от локального `npm run build` на хосте.
- Сеть: внешняя `zqwy_reverse_proxy` (должна существовать заранее).

## `.dockerignore`

Исключает из контекста сборки `.git`, `node_modules`, `dist/`, логи и `.env*`, чтобы контекст был меньше, а зависимости ставились внутри образа через `npm ci`.

## Запуск

```bash
docker compose up --build
```

Так как контейнер отдаёт смонтированный `./dist`, перед запуском обычно нужна актуальная сборка на хосте (особенно если нужны ресурсы из `src/`):

```bash
npm ci
npm run build
```
