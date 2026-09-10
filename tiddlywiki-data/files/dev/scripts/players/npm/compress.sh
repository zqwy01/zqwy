#!/usr/bin/env bash

set -e

INPUT="$1"
OUTPUT="$2"

if [ -z "$INPUT" ]; then
    echo "Использование: $0 input.js [output.js]"
    exit 1
fi

if [ ! -f "$INPUT" ]; then
    echo "Файл не найден: $INPUT"
    exit 1
fi

if [ -z "$OUTPUT" ]; then
    DIR="$(dirname "$INPUT")"
    FILE="$(basename "$INPUT" .js)"
    OUTPUT="$DIR/${FILE}.readable.js"
fi

npx terser "$INPUT" \
    --module \
    --compress \
    --format beautify=true,indent_level=2 \
    --output "$OUTPUT"

echo "Готово: $OUTPUT"
