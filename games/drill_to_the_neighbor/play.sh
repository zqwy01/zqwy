#!/usr/bin/env bash
# БУР ДРУИДА. Запуск игры в локальном сервере.
set -euo pipefail

cd "$(dirname "$0")"

PORT="${PORT:-8080}"
URL="http://localhost:${PORT}/"

has() { command -v "$1" >/dev/null 2>&1; }

open_url() {
  if has xdg-open; then
    xdg-open "$URL" >/dev/null 2>&1 &
  elif has firefox; then
    firefox "$URL" >/dev/null 2>&1 &
  elif has open; then
    open "$URL" >/dev/null 2>&1 &
  else
    echo "Открой вручную: $URL"
  fi
}

serve() {
  if has python3; then
    python3 -m http.server "$PORT" --bind 127.0.0.1
  elif has npx; then
    npx --yes serve -l "$PORT" .
  else
    echo "Нужен python3 или npx. Можно открыть index.html напрямую,"
    echo "но тогда браузер может не дать загрузить аудио (file://)."
    exit 1
  fi
}

echo "БУР ДРУИДА — $URL"
echo "Ctrl+C — остановить сервер."

serve &
SERVER_PID=$!
trap 'kill "$SERVER_PID" 2>/dev/null || true' EXIT INT TERM

sleep 0.7
open_url
wait "$SERVER_PID"
