# syntax=docker/dockerfile:1

## Build static site (dev -> dist) automatically, then serve the generated dist.
## docker-compose.yaml may still bind-mount ./dist over /app/dist for local dev.
FROM node:24-bookworm-slim AS build

WORKDIR /src

COPY dev ./dev
COPY scripts ./scripts

RUN bash scripts/build_dist.sh


FROM node:24-bookworm-slim AS runtime

WORKDIR /app

RUN npm install -g serve@14

COPY --from=build /src/dist ./dist

ENV PORT=3000
EXPOSE 3000

CMD ["sh", "-c", "serve dist -l ${PORT} -n"]
