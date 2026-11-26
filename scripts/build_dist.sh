#!/usr/bin/env bash

set -Eeuo pipefail

# Директория, в которой находится этот скрипт
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"

# Корневая директория проекта
PROJECT_DIR="$(cd -- "$SCRIPT_DIR/.." && pwd)"

# Директории проекта
SRC_DIR="$PROJECT_DIR/dev"
DIST_DIR="$PROJECT_DIR/dist"

# Локальные npm-инструменты
BIN_DIR="$PROJECT_DIR/node_modules/.bin"

# На SMB-разделе символьные ссылки не поддерживаются, поэтому npm кладёт в .bin
# копии файлов пакетов вместо ссылок. Копия ломается: относительные require и
# import внутри неё считаются от .bin, а не от каталога пакета. Поэтому инструмент
# берём из пакета — там путь правильный, — а PATH используем как запасной вариант.
resolve_tool() {
    local bin_name="$1"
    local package_dir="$2"
    local entry="$3"
    local package_entry="$PROJECT_DIR/node_modules/$package_dir/$entry"

    if [[ -f "$package_entry" ]]; then
        printf '%s' "$package_entry"
    elif [[ -x "$BIN_DIR/$bin_name" ]]; then
        printf '%s' "$BIN_DIR/$bin_name"
    else
        command -v "$bin_name" 2>/dev/null || true
    fi
}

TERSER="$(resolve_tool terser terser bin/terser)"
CLEANCSS="$(resolve_tool cleancss clean-css-cli bin/cleancss)"
HTML_MINIFIER="$(resolve_tool html-minifier-terser html-minifier-terser cli.js)"

# Точки входа пакетов — JS-файлы; запускаем их через node, чтобы не зависеть
# от бита исполнения, который на SMB может потеряться.
run_js_tool() {
    local tool="$1"
    shift

    if [[ "$tool" == "$PROJECT_DIR"/node_modules/* || "$tool" == "$BIN_DIR"/* ]]; then
        node "$tool" "$@"
    else
        "$tool" "$@"
    fi
}

# Проверка исходной директории
if [[ ! -d "$SRC_DIR" ]]; then
    echo "Ошибка: директория с исходниками не найдена:"
    echo "  $SRC_DIR"
    exit 1
fi

# Проверка инструментов
missing=0
for name in TERSER CLEANCSS HTML_MINIFIER; do
    tool="${!name}"
    if [[ -z "$tool" || ! -f "$tool" ]]; then
        echo "Ошибка: инструмент не найден: ${name,,}"
        missing=1
    fi
done
if (( missing )); then
    echo
    echo "Выполните:"
    echo "  cd \"$PROJECT_DIR\""
    echo "  npm install"
    exit 1
fi

echo "Проект:      $PROJECT_DIR"
echo "Исходники:   $SRC_DIR"
echo "Результат:   $DIST_DIR"
echo

# Обложки — генерируются только при сборке, если указаны оригиналы (путь не хранится в приложении после сборки).
# Укажите каталог оригиналов: export COVERS_ORIGINALS=/путь/к/оригиналам_обложек
if [[ -f "$PROJECT_DIR/scripts/build_covers.py" ]]; then
    if [[ -n "${COVERS_ORIGINALS:-}" ]]; then
        if [[ -d "$COVERS_ORIGINALS" ]]; then
            echo "Обновление обложек (WebP) из оригиналов: $COVERS_ORIGINALS"
            python3 "$PROJECT_DIR/scripts/build_covers.py" --originals "$COVERS_ORIGINALS"
            echo
        else
            echo "Предупреждение: COVERS_ORIGINALS задан, но каталог не найден: $COVERS_ORIGINALS (шаг пропущен)."
            echo "В приложении используются уже собранные .webp из src/covers (если они есть)."
            echo
        fi
    else
        echo "Пропуск генерации обложек: не задан COVERS_ORIGINALS (путь к оригиналам указывается только при сборке)."
        echo "В сборку попадают готовые файлы из src/covers/, если они присутствуют в репозитории/контексте."
        echo
    fi
fi

# Каталог музыки — производный от src/tracks файл, поэтому обновляем его
# перед копированием исходников. Если src/tracks нет (например, сборка без
# контекста с аудио), используем готовый dev/data/music-catalog.json.
if [[ -f "$PROJECT_DIR/scripts/build_music_catalog.mjs" ]]; then
    if [[ -d "$PROJECT_DIR/src/tracks" ]]; then
        echo "Обновление каталога музыки..."
        node "$PROJECT_DIR/scripts/build_music_catalog.mjs"
    else
        echo "Пропуск каталога музыки: нет $PROJECT_DIR/src/tracks (используется готовый dev/data/music-catalog.json)."
    fi
    echo
fi

# Заметки из src/notes/ — источник для режима wiki/zqwy. Генерируем их перед
# индексом поиска: индекс подхватывает метаданные заметок. TXT и текстовые
# файлы без расширения нормализуются в .md внутри генератора. Если src/notes
# отсутствует, оставляем готовые файлы в dev/.
if [[ -f "$PROJECT_DIR/scripts/build_wiki_notes.mjs" ]]; then
    if [[ -d "$PROJECT_DIR/src/notes" ]]; then
        echo "Обновление заметок wiki (zqwy)..."
        node "$PROJECT_DIR/scripts/build_wiki_notes.mjs"
    else
        echo "Пропуск заметок wiki: нет $PROJECT_DIR/src/notes (используются готовые dev/wiki/zqwy и dev/data/wiki-notes.json)."
    fi
    echo
fi

# Граф заметок строится тем же генератором (dev/data/note-graph.json).
# Проверяем сразу, чтобы сборка не продолжалась с пустыми/битыми данными.
if [[ -f "$PROJECT_DIR/scripts/verify_graph.mjs" ]]; then
    echo "Проверка данных графа заметок..."
    node "$PROJECT_DIR/scripts/verify_graph.mjs" dev "$PROJECT_DIR"
    echo
fi

# Версия сборки показывается в панели настроек. Генерируем её до копирования
# исходников, чтобы dist/data/build-info.json всегда соответствовал сборке.
if [[ -f "$PROJECT_DIR/scripts/build_version.mjs" ]]; then
    echo "Обновление информации о сборке..."
    node "$PROJECT_DIR/scripts/build_version.mjs"
    echo
fi

# Индекс поиска зависит и от ссылок, и от свежего каталога музыки.
if [[ -f "$PROJECT_DIR/scripts/build_search_index.mjs" ]]; then
    echo "Обновление индекса поиска..."
    node "$PROJECT_DIR/scripts/build_search_index.mjs"
    echo
fi

echo "Очистка директории сборки..."
# Не удаляем сам каталог dist/: он часто смонтирован в Docker-контейнер
# (./dist:/app/dist). Пересоздание каталога ломает bind mount, из-за чего
# после сборки приходится пересоздавать контейнер. Очищаем только содержимое.
mkdir -p -- "$DIST_DIR"
find "$DIST_DIR" -mindepth 1 -delete 2>/dev/null || true
# На SMB некоторые старые каталоги нельзя удалить на месте, хотя их можно
# переименовать. Выносим их за пределы dist/, чтобы сборка не падала и чтобы
# не расклеивать сам каталог dist/ (он может быть смонтирован в контейнер).
if [[ -n "$(find "$DIST_DIR" -mindepth 1 -maxdepth 1 -print -quit)" ]]; then
    stale_dir="$PROJECT_DIR/.dist-stale-$(date +%s)"
    mkdir -p -- "$stale_dir"
    echo "Предупреждение: часть dist/ не удалилась на месте, перенос в $stale_dir"
    for entry in "$DIST_DIR"/* "$DIST_DIR"/.[!.]* "$DIST_DIR"/..?*; do
        [[ -e "$entry" ]] || continue
        mv -- "$entry" "$stale_dir"/ || {
            echo "Ошибка: не удалось перенести $entry"
            exit 1
        }
    done
fi

echo "Копирование исходных файлов..."
cp -a -- "$SRC_DIR"/. "$DIST_DIR"/

# Аудио и обложки должны быть доступны собранному сайту. На SMB работают
# жёсткие ссылки (символьные — нет), поэтому src/ публикуется ими: 546 МБ
# треков не дублируются на диске. Если ссылки невозможны — обычное копирование.
if [[ -d "$PROJECT_DIR/src" ]]; then
    echo "Публикация src/ (жёсткие ссылки)..."
    # cp -al может прерваться на другой файловой системе, оставив частично
    # созданный dist/src. Если после этого вызвать cp -a с тем же адресом, он
    # скопирует src ВНУТРЬ dist/src и обложки окажутся по dist/src/src/covers —
    # отсюда все 404. Перед каждым вариантом удаляем приёмник.
    rm -rf -- "$DIST_DIR/src"
    if ! cp -al -- "$PROJECT_DIR/src" "$DIST_DIR/src" 2>/dev/null; then
        echo "  Жёсткие ссылки недоступны — копируем src/ обычным копированием."
        rm -rf -- "$DIST_DIR/src"
        cp -a -- "$PROJECT_DIR/src" "$DIST_DIR/src"
    fi
fi

# Некоторые игры лежат во вложенных папках (the_remaining_one/beat) и ищут
# музыку по ../../src/tracks. Для них дублируем архив треков жёсткими
# ссылками внутри game/ — дополнительного места на диске это не занимает.
if [[ -d "$DIST_DIR/game" && -d "$DIST_DIR/src/tracks" ]]; then
    echo "Публикация src/tracks для вложенных игр..."
    mkdir -p -- "$DIST_DIR/game/src"
    rm -rf -- "$DIST_DIR/game/src/tracks"
    if ! cp -al -- "$DIST_DIR/src/tracks" "$DIST_DIR/game/src/tracks" 2>/dev/null; then
        rm -rf -- "$DIST_DIR/game/src/tracks"
        cp -a -- "$DIST_DIR/src/tracks" "$DIST_DIR/game/src/tracks"
    fi
fi


echo
echo "Минификация файлов..."

# Сначала полностью собираем список файлов.
# Это предотвращает захват stdin html-minifier-terser.
mapfile -d '' -t files < <(
    find "$DIST_DIR" \
        -type f \
        \( \
            -name '*.js' \
            -o -name '*.css' \
            -o -name '*.html' \
            -o -name '*.htm' \
        \) \
        -print0
)

# Общая статистика строк
total_before_lines=0
total_after_lines=0
total_reduced_lines=0
processed_files=0

for file in "${files[@]}"; do
    relative_path="${file#"$DIST_DIR"/}"
    temporary_file="${file}.min.tmp"

    # Количество строк до минификации
    before_lines=$(wc -l < "$file")

    # Игры — самостоятельные статические приложения. Минификация ломает
    # шаблонные строки, инлайн-скрипты и шейдеры, поэтому копируем их как есть.
    if [[ "$relative_path" == game/* ]]; then
        echo "ПРОПУСК (игры): $relative_path"
        total_before_lines=$((total_before_lines + before_lines))
        total_after_lines=$((total_after_lines + before_lines))
        processed_files=$((processed_files + 1))
        continue
    fi

    # Если файл пустой, оставляем его пустым
    if [[ ! -s "$file" ]]; then
        echo "ПУСТОЙ: $relative_path — пропуск минификации"

        total_before_lines=$((total_before_lines + before_lines))
        total_after_lines=$((total_after_lines + before_lines))
        processed_files=$((processed_files + 1))

        continue
    fi

    # На случай старого временного файла
    rm -f -- "$temporary_file"

    case "$file" in
        *.js)
            echo "JS:   $relative_path"

            run_js_tool "$TERSER" \
                "$file" \
                --compress \
                --mangle \
                --format comments=false \
                --output "$temporary_file"
            ;;

        *.css)
            echo "CSS:  $relative_path"

            run_js_tool "$CLEANCSS" \
                -O2 \
                -o "$temporary_file" \
                "$file"
            ;;

        *.html|*.htm)
            echo "HTML: $relative_path"

            run_js_tool "$HTML_MINIFIER" \
                --collapse-whitespace \
                --remove-comments \
                --remove-redundant-attributes \
                --remove-empty-attributes \
                --use-short-doctype \
                "$file" \
                -o "$temporary_file"
            ;;
    esac

    # Минификатор не должен создавать пустой файл из непустого исходника
    if [[ ! -s "$temporary_file" ]]; then
        echo
        echo "Ошибка: временный файл не создан или пуст:"
        echo "  $temporary_file"
        echo
        echo "Исходный файл:"
        echo "  $file"

        rm -f -- "$temporary_file"
        exit 1
    fi

    # Заменяем исходный файл минифицированным
    mv -- "$temporary_file" "$file"

    # Количество строк после минификации
    after_lines=$(wc -l < "$file")
    reduced_lines=$((before_lines - after_lines))

    # Обновляем общую статистику
    total_before_lines=$((total_before_lines + before_lines))
    total_after_lines=$((total_after_lines + after_lines))
    total_reduced_lines=$((total_reduced_lines + reduced_lines))
    processed_files=$((processed_files + 1))

    printf '      Строк: %d → %d, уменьшено: %d\n' \
        "$before_lines" \
        "$after_lines" \
        "$reduced_lines"
done

echo
echo "Сборка завершена успешно."
echo

echo "Статистика строк:"
echo "  Обработано файлов:     $processed_files"
echo "  Строк до минификации:  $total_before_lines"
echo "  Строк после:           $total_after_lines"
echo "  Уменьшено строк:       $total_reduced_lines"

if (( total_before_lines > 0 )); then
    reduction_percent=$(
        awk \
            -v before="$total_before_lines" \
            -v reduced="$total_reduced_lines" \
            'BEGIN {
                printf "%.2f", reduced / before * 100
            }'
    )

    echo "  Процент уменьшения:    ${reduction_percent}%"
fi

# Корневой index.html для GitHub Pages (Deploy from branch, folder / root).
# Пересобирается при каждой сборке, чтобы / вёл на актуальный dist/.
echo
echo "Генерация корневого index.html для GitHub Pages..."
cat > "$PROJECT_DIR/index.html" << 'HTML'
<!doctype html>
<html lang="ru">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>zqwy</title>
  <meta http-equiv="refresh" content="0; url=./dist/">
  <link rel="canonical" href="./dist/">
  <script>location.replace("./dist/" + location.search + location.hash);</script>
</head>
<body>
  <p>Redirecting to <a href="./dist/">./dist/</a>...</p>
</body>
</html>
HTML

echo
echo "Готовый проект находится здесь:"
echo "  $DIST_DIR"

echo
echo "Размеры:"
du -sh -- "$SRC_DIR" "$DIST_DIR"
