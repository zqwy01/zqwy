# syntax=docker/dockerfile:1

## Build static site (dev -> dist) automatically, then serve the generated dist.
## docker-compose.yaml may still bind-mount ./dist over /app/dist for local dev.
FROM node:24-bookworm-slim AS build

WORKDIR /src

COPY package.json package-lock.json ./
RUN npm ci

COPY dev ./dev
COPY scripts ./scripts
# The full src/ tree is needed: src/notes is the source for wiki/zqwy, and
# src/tracks provides the audio referenced by the music catalog. With src/
# present the build rescans both on every Docker build instead of shipping a
# stale catalog with missing files.
COPY src ./src

RUN bash scripts/build_dist.sh


FROM node:24-bookworm-slim AS runtime

WORKDIR /app

RUN npm install -g serve@14

COPY --from=build /src/dist ./dist

ENV PORT=3000
EXPOSE 3000

CMD ["sh", "-c", "serve dist -l ${PORT} -n"]
