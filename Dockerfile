# syntax=docker/dockerfile:1

## Build stage (Node.js + Python/ffmpeg for build scripts)
FROM node:24-bookworm-slim AS build

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    bash \
    ca-certificates \
    ffmpeg \
    python3 \
    python3-pip \
  && rm -rf /var/lib/apt/lists/*

# Pillow for scripts/build_covers.py (if covers are generated in build)
RUN pip install --no-cache-dir --break-system-packages Pillow

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Обложки: оригиналы указываются ТОЛЬКО при сборке через COVERS_ORIGINALS (путь к каталогу оригиналов).
# После сборки этот путь не используется приложением (в dist попадают только собранные .webp из src/covers).
RUN mkdir -p /covers-originals-placeholder

RUN npm run build


## Runtime stage (Node.js static server)
FROM node:24-bookworm-slim AS runtime

WORKDIR /app

RUN npm install -g serve@14

COPY --from=build /app/dist ./dist

ENV PORT=3000
EXPOSE 3000

CMD ["sh", "-c", "serve dist -l ${PORT} -n"]
