# syntax=docker/dockerfile:1

# Пайплайн: зависимости -> тесты -> полная сборка dist (включая граф заметок)
# -> проверка артефактов -> runtime. dist, собранный в образе, отдаётся по
# умолчанию; bind-mount ./dist в docker-compose.yaml можно включить, если
# нужна хостовая сборка.

FROM node:24-bookworm-slim AS deps

WORKDIR /src

# .dockerignore исключает node_modules, dist и .git, поэтому в контекст попадают
# только исходники. npm ci даёт воспроизводимый набор инструментов минификации.
COPY package.json package-lock.json ./
RUN npm ci


FROM deps AS test

# Тесты чистого слоя данных графа (извлечение ссылок, series, TF-IDF).
# Падают -> сборка образа останавливается до генерации страниц.
COPY scripts ./scripts
RUN npm test


FROM test AS build

# Исходники сайта. src/ нужен целиком: src/notes — источник заметок и графа,
# src/tracks — каталог музыки. Новые файлы графа не игнорируются .gitignore.
COPY dev ./dev
COPY src ./src

# BUILD_NUMBER можно передать снаружи, чтобы не менять счётчик в образе:
#   docker compose build --build-arg BUILD_NUMBER=42
ARG BUILD_NUMBER=1
ENV BUILD_NUMBER=${BUILD_NUMBER}

# npm run build -> scripts/build_dist.sh:
#   каталог музыки -> заметки + dev/data/note-graph.json -> версия ->
#   поисковый индекс -> копирование dev/ в dist/ -> минификация.
# build_dist.sh сам проверяет данные графа; здесь проверяем готовый dist.
RUN npm run build \
 && node scripts/verify_graph.mjs dist


FROM node:24-bookworm-slim AS runtime

WORKDIR /app

RUN npm install -g serve@14

COPY --from=build /src/dist ./dist

ENV PORT=3000
EXPOSE 3000

CMD ["sh", "-c", "serve dist -l ${PORT} -n"]
