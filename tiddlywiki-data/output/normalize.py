#!/usr/bin/env python3

import json
import sys
from datetime import datetime


def empty_to_none(value):
    """Заменяет пустые строки на null."""
    if value == "":
        return None
    return value


def parse_tiddlywiki_date(value):
    """
    Преобразует дату TiddlyWiki:

    20260813103541682

    в:

    2026-08-13T10:35:41.682Z
    """
    if not value:
        return None

    value = str(value)

    try:
        date = datetime.strptime(value, "%Y%m%d%H%M%S%f")
        return date.isoformat(timespec="milliseconds") + "Z"
    except ValueError:
        # Если дата уже в другом формате, оставляем её как есть
        return value


def parse_int(value):
    """Преобразует строку в целое число."""
    if value in ("", None):
        return None

    try:
        return int(value)
    except (TypeError, ValueError):
        return value


def parse_float(value):
    """Преобразует строку в число с плавающей точкой."""
    if value in ("", None):
        return None

    try:
        return float(value)
    except (TypeError, ValueError):
        return value


def parse_tags(value):
    """
    Преобразует строку тегов в массив.

    Например:
    "музыка эмбиент пианино"
    превращается в:
    ["музыка", "эмбиент", "пианино"]
    """
    if not value:
        return []

    return value.split()


def parse_edges(value):
    """
    Преобразует tmap.edges из JSON-строки
    в настоящий JSON-объект.
    """
    if not value:
        return {}

    if isinstance(value, dict):
        return value

    try:
        return json.loads(value)
    except (TypeError, json.JSONDecodeError):
        return {}


def detect_content_format(item):
    """Определяет формат текста записи."""
    content_type = item.get("type")

    formats = {
        "text/markdown": "markdown",
        "text/vnd.tiddlywiki": "tiddlywiki",
        "text/html": "html",
        "text/plain": "plain"
    }

    return formats.get(content_type, content_type or None)


def normalize_tiddler(item):
    return {
        # Если обычного id нет, используется tmap.id
        "id": item.get("id") or item.get("tmap.id"),

        "title": item.get("title"),

        "alias": empty_to_none(item.get("alias")),

        # Например: music
        "category": empty_to_none(item.get("type_content")),

        "content": {
            # markdown, html, tiddlywiki и т. д.
            "format": detect_content_format(item),

            # Сам текст записи
            "text": item.get("text") or None
        },

        "dates": {
            "created": parse_tiddlywiki_date(item.get("created")),
            "modified": parse_tiddlywiki_date(item.get("modified")),

            # Дата релиза обычно уже имеет вид 2024-11-03
            "release": empty_to_none(item.get("date"))
        },

        "media": {
            "cover": empty_to_none(item.get("cover")),
            "archive": empty_to_none(item.get("url_archive")),
            "mp3": empty_to_none(item.get("url_download_mp3")),
            "wav": empty_to_none(item.get("url_download_wav"))
        },

        "music": {
            "author": empty_to_none(item.get("author")),
            "distributor": empty_to_none(item.get("distributor")),

            "tags": parse_tags(item.get("tags")),
            "instruments": parse_tags(item.get("instruments")),

            "bpm": parse_float(item.get("track_bpm")),
            "key": empty_to_none(item.get("track_init_key")),
            "trackNumber": parse_int(item.get("track_number")),

            "isrc": empty_to_none(item.get("isrc")),
            "upc": empty_to_none(item.get("upc")),

            "albumSize": parse_int(item.get("size_album")),
            "releaseSize": parse_int(item.get("size_release"))
        },

        "map": {
            "id": empty_to_none(item.get("tmap.id")),
            "edges": parse_edges(item.get("tmap.edges")),
            "style": empty_to_none(item.get("tmap.style"))
        },

        "emoji": empty_to_none(item.get("emoji")),

        "worldEpoch": parse_int(item.get("epocha")),

        "version": empty_to_none(item.get("version"))
    }


def main():
    # Можно передать путь к файлу:
    # python3 normalize.py music.raw.json
    #
    # Или читать JSON из stdin:
    # cat music.raw.json | python3 normalize.py
    input_file = sys.argv[1] if len(sys.argv) > 1 else "-"

    if input_file == "-":
        data = json.load(sys.stdin)
    else:
        with open(input_file, "r", encoding="utf-8") as file:
            data = json.load(file)

    normalized_data = [
        normalize_tiddler(item)
        for item in data
        if item.get("type_content") == "music"
    ]

    json.dump(
        normalized_data,
        sys.stdout,
        ensure_ascii=False,
        indent=2
    )

    sys.stdout.write("\n")


if __name__ == "__main__":
    main()
