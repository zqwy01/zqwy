#!/usr/bin/env bash
# РИТМ-КАТАЛОГ — запуск ритм-игры по всей коллекции zqwy.
set -euo pipefail

cd "$(dirname "$0")"

PORT="${PORT:-8080}"
export PORT

if ! command -v python3 >/dev/null 2>&1; then
  echo "Нужен python3: он раздаёт файлы с поддержкой HTTP Range для стриминга аудио."
  exit 1
fi

echo "РИТМ-КАТАЛОГ — запускаем локальный сервер…"
echo "Ctrl+C — остановить сервер."

python3 tools/serve.py --port "$PORT" --open &
SERVER_PID=$!
trap 'kill "$SERVER_PID" 2>/dev/null || true' EXIT INT TERM

wait "$SERVER_PID"
