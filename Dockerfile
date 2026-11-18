# syntax=docker/dockerfile:1

## Runtime image only. The site is provided by docker-compose.yaml as a read-only
## bind mount at /app/dist, so the image intentionally contains no baked dist/.
FROM node:24-bookworm-slim AS runtime

WORKDIR /app

RUN npm install -g serve@14

ENV PORT=3000
EXPOSE 3000

CMD ["sh", "-c", "serve dist -l ${PORT} -n"]
