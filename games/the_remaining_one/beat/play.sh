#!/usr/bin/env bash
# ОСТАВШИЙСЯ — запуск игры с локального HTTP-сервера.
# Нужен HTTP (а не file://) и Range-запросы, иначе браузер не откроет Opus.
set -euo pipefail

cd "$(dirname "$0")"

if ! command -v python3 >/dev/null 2>&1; then
  echo "Нужен python3 (3.9+)." >&2
  exit 1
fi

OPEN_FLAG="--open"
if [ "${NO_OPEN:-0}" = "1" ] || [ -n "${CI:-}" ]; then
  OPEN_FLAG=""
fi

exec python3 tools/serve.py $OPEN_FLAG "$@"
