#!/bin/sh

set -eu

WIKI_DIR="/var/lib/tiddlywiki"

if [ ! -f "$WIKI_DIR/tiddlywiki.info" ]; then
    echo "Wiki is not initialized. Initializing server edition..."
    tiddlywiki "$WIKI_DIR" --init server
fi

exec tiddlywiki "$WIKI_DIR" \
    --listen \
    "host=0.0.0.0" \
    "port=${TW_PORT:-1112}" \
    "username=${TW_USERNAME}" \
    "password=${TW_PASSWORD}"
