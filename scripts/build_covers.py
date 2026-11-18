#!/usr/bin/env python3
"""
Генератор компактных обложек для сайта.

Оригиналы (только читаются, никогда не меняются):
    /home/zqwy/smb/sda/content/category/photo/sound_cover/<album>/...

Результат (только сжатые веб-обложки):
    <project>/src/covers/<album>/<album>.webp

Для каждого релиза выбирается наиболее подходящий исходник (предпочтительно
уже подготовленный для сайта *_site.webp, затем обложка в webp/jpg/png),
уменьшается до 512 px по длинной стороне и сохраняется в WebP. Пиксельные
обложки уменьшаются без сглаживания и сохраняются lossless.

Повторный запуск ничего не переделывает, если исходник не менялся.
Запуск:
    python3 scripts/build_covers.py
    npm run covers
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
from pathlib import Path

try:
    from PIL import Image, ImageOps
except ImportError:
    sys.exit("Нужен Pillow: python3 -m pip install Pillow")

HERE = Path(__file__).resolve().parent
PROJECT = HERE.parent
DEFAULT_ORIGINALS = Path("/covers-originals-placeholder")  # задайте реальный путь через --originals или COVERS_ORIGINALS при сборке
DEFAULT_OUTPUT = PROJECT / "src" / "covers"
MANIFEST_FILE = HERE / ".covers-manifest.json"

GENERATOR_VERSION = 1
IMAGE_EXT = {".png", ".jpg", ".jpeg", ".webp", ".gif", ".avif", ".bmp", ".tif", ".tiff"}
# Файлы с такими именами — баннеры, варианты для других форматов и т.п.
NOT_A_COVER = re.compile(r"banner|bandcamp|[1-9]x[246]|imaget?oimage|digital_\d+", re.I)


def source_score(path: Path, album_id: str, originals: Path) -> float:
    """Чем выше балл, тем вероятнее это обложка релиза, а не баннер/черновик."""
    name = path.name.lower()
    rel = path.relative_to(originals).as_posix().lower()
    score = 0.0

    if "_site" in name:                 # уже подготовленная для сайта версия
        score += 100
    if "cover" in name:
        score += 40

    compact_album = re.sub(r"[^a-z0-9]", "", album_id.lower())
    if compact_album and compact_album in re.sub(r"[^a-z0-9]", "", name):
        score += 15

    score += {".webp": 20, ".jpg": 10, ".jpeg": 10}.get(path.suffix.lower(), 0)

    if "/original/" in rel:             # preferences: compressed/ → covers/ → original/
        score -= 10
    if "archive" in name:
        score -= 40
    if "orig" in name:                  # но "оригинал" в имени — это каноничный вариант
        score += 8

    try:
        with Image.open(path) as image:
            width, height = image.size
        ratio = min(width, height) / max(width, height)
        if ratio >= 0.8:                # обложка почти квадратная
            score += 15
        elif ratio < 0.5:               # вытянутый баннер/арт
            score -= 20
    except Exception:
        score -= 1000

    # Примерно равные кандидаты: берём меньший файл, его быстрее декодировать.
    score -= min(20.0, path.stat().st_size / (1024 * 1024) / 2)
    return score


def choose_source(album_dir: Path, album_id: str, originals: Path) -> Path | None:
    candidates: list[tuple[float, str, Path]] = []
    for path in album_dir.rglob("*"):
        if not path.is_file() or path.suffix.lower() not in IMAGE_EXT:
            continue
        rel = path.relative_to(album_dir).as_posix().lower()
        if rel.startswith("tracks/") or "/tracks/" in rel:
            continue
        if NOT_A_COVER.search(path.name):
            continue
        candidates.append((source_score(path, album_id, originals), path.name.lower(), path))

    if not candidates:
        return None
    candidates.sort(key=lambda item: (-item[0], item[1], str(item[2]).lower()))
    return candidates[0][2]


def is_pixel_art(image: Image.Image) -> bool:
    """Малое число цветов на уменьшенной копии означает пиксельную графику."""
    scale = min(1.0, 256 / max(image.size))
    sample = image.resize(
        (max(1, int(image.width * scale)), max(1, int(image.height * scale))),
        Image.Resampling.NEAREST,
    )
    colors = sample.convert("RGB").getcolors(maxcolors=257)
    return colors is not None and len(colors) <= 128


def render(source: Path, destination: Path, max_size: int, quality: int, method: int):
    with Image.open(source) as opened:
        image = ImageOps.exif_transpose(opened)
        image.load()
        pixel = is_pixel_art(image)

        if max(image.size) > max_size:
            resample = Image.Resampling.NEAREST if pixel else Image.Resampling.LANCZOS
            image.thumbnail((max_size, max_size), resample)

        # WEBP без альфы весит меньше; альфу сохраняем только если она есть.
        image = image.convert("RGBA" if "A" in image.getbands() else "RGB")

        destination.parent.mkdir(parents=True, exist_ok=True)
        temporary = destination.with_name(destination.name + ".tmp")
        options = {"format": "WEBP", "method": method}
        if pixel:
            options["lossless"] = True
        else:
            options["quality"] = quality
        image.save(temporary, **options)
        os.replace(temporary, destination)
        return image.size, destination.stat().st_size, pixel


def load_manifest() -> dict:
    try:
        data = json.loads(MANIFEST_FILE.read_text(encoding="utf-8"))
        return data if isinstance(data, dict) else {}
    except (OSError, ValueError):
        return {}


def save_manifest(manifest: dict) -> None:
    temporary = MANIFEST_FILE.with_name(MANIFEST_FILE.name + ".tmp")
    temporary.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    os.replace(temporary, MANIFEST_FILE)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--originals", type=Path, default=DEFAULT_ORIGINALS,
                        help="каталог с оригиналами (по умолчанию: %(default)s)")
    parser.add_argument("--out", type=Path, default=DEFAULT_OUTPUT,
                        help="куда писать .webp (по умолчанию: %(default)s)")
    parser.add_argument("--max-size", type=int, default=512,
                        help="максимальная сторона обложки в пикселях (по умолчанию: 512)")
    parser.add_argument("--quality", type=int, default=78,
                        help="качество lossy WebP (по умолчанию: 78)")
    parser.add_argument("--method", type=int, default=6,
                        help="степень сжатия WebP 0..6 (по умолчанию: 6)")
    parser.add_argument("--force", action="store_true",
                        help="пересоздать все обложки, даже если исходники не менялись")
    parser.add_argument("--no-clean", action="store_true",
                        help="не удалять старые файлы из каталога обложек")
    args = parser.parse_args()

    originals: Path = args.originals.expanduser().resolve()
    output: Path = args.out.expanduser().resolve()

    if not originals.is_dir():
        print(f"Нет каталога с оригиналами обложек: {originals}", file=sys.stderr)
        print("Укажите путь к оригиналам при сборке: python3 scripts/build_covers.py --originals /путь/к/оригиналам", file=sys.stderr)
        print("(переменная COVERS_ORIGINALS используется в build_dist.sh). После сборки приложения этот путь не нужен — в dist используются готовые .webp.", file=sys.stderr)
        return 1

    output.mkdir(parents=True, exist_ok=True)
    settings = {"maxSize": args.max_size, "quality": args.quality, "method": args.method}
    manifest = load_manifest()
    previous = manifest.get("outputs", {}) if manifest.get("version") == GENERATOR_VERSION \
        and manifest.get("settings") == settings else {}
    generated: dict[str, dict] = {}
    expected: set[Path] = set()
    made = 0
    reused = 0
    total_bytes = 0

    for album_dir in sorted(p for p in originals.iterdir() if p.is_dir()):
        album_id = album_dir.name
        source = choose_source(album_dir, album_id, originals)
        if source is None:
            print(f"пропуск {album_id}: нет подходящего изображения")
            continue

        stat = source.stat()
        entry = {
            "source": source.relative_to(originals).as_posix(),
            "size": stat.st_size,
            "mtimeNs": stat.st_mtime_ns,
        }
        destination = output / album_id / f"{album_id}.webp"
        expected.add(destination)

        unchanged = (
            not args.force
            and destination.is_file()
            and previous.get(album_id) == entry
        )
        if unchanged:
            reused += 1
            size = destination.stat().st_size
            total_bytes += size
            print(f"без изменений {album_id}: {destination.name} ({size // 1024} КБ)")
        else:
            try:
                dimensions, size, pixel = render(
                    source, destination, args.max_size, args.quality, args.method
                )
            except Exception as error:
                print(f"ошибка {album_id}: {source.name}: {error}", file=sys.stderr)
                continue
            made += 1
            total_bytes += size
            kind = "пиксельная, lossless" if pixel else "фото, lossy"
            print(
                f"создан {album_id}: {entry['source']} → "
                f"{destination.relative_to(PROJECT)} "
                f"({dimensions[0]}x{dimensions[1]}, {size // 1024} КБ, {kind})"
            )

        generated[album_id] = entry

    if not args.no_clean:
        for path in sorted(output.rglob("*"), key=lambda p: len(p.parts), reverse=True):
            if path.is_file() and path not in expected:
                print(f"удалён старый файл: {path.relative_to(PROJECT)}")
                path.unlink()
        for directory in sorted((p for p in output.rglob("*") if p.is_dir()),
                                key=lambda p: len(p.parts), reverse=True):
            try:
                directory.rmdir()
            except OSError:
                pass

    save_manifest({
        "version": GENERATOR_VERSION,
        "settings": settings,
        "outputs": generated,
    })

    print()
    print(f"Обложек: {len(generated)} (создано {made}, без изменений {reused}), "
          f"итого {total_bytes / (1024 * 1024):.2f} МБ")
    print(f"Каталог: {output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
