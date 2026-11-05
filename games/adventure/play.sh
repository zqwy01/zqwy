#!/usr/bin/env bash
# Запускает «Клетчатый лист» через локальный HTTP-сервер.
set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$DIR"

PORT="${PORT:-8123}"

if ! command -v python3 >/dev/null 2>&1; then
  echo "Не найден python3. Откройте index.html напрямую или запустите любой статический сервер." >&2
  exit 1
fi

if ! python3 - "$PORT" <<'PY'
import socket, sys
s = socket.socket()
try:
    s.bind(("127.0.0.1", int(sys.argv[1])))
except OSError:
    sys.exit(1)
finally:
    s.close()
PY
then
  echo "Порт $PORT уже занят. Укажите другой: PORT=9000 ./play.sh" >&2
  exit 1
fi

python3 -m http.server "$PORT" --bind 127.0.0.1 >/dev/null 2>&1 &
SERVER_PID=$!

cleanup() {
  kill "$SERVER_PID" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

sleep 0.4
URL="http://127.0.0.1:$PORT/"

echo "Клетчатый лист: $URL"
echo "Нажмите Ctrl+C, чтобы остановить сервер."

if command -v xdg-open >/dev/null 2>&1; then
  xdg-open "$URL" >/dev/null 2>&1 || true
elif command -v open >/dev/null 2>&1; then
  open "$URL" >/dev/null 2>&1 || true
fi

wait "$SERVER_PID"
