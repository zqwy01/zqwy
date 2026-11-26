#!/usr/bin/env python3
"""PWA-иконки из favicon.ico (пиксельная графика 32x32).

Иконки — first-party runtime assets: они лежат в dev/assets/icons/ и
попадают в dist/ обычной сборкой. Перегенерировать: npm run icons.
"""

from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "dev" / "assets" / "icons" / "favicon.ico"
OUTPUT = ROOT / "dev" / "assets" / "icons"


def upscale(size: int) -> Image.Image:
    # nearest сохраняет чёткость исходной пиксельной графики
    return Image.open(SOURCE).convert("RGB").resize((size, size), Image.Resampling.NEAREST)


def main() -> None:
    if not SOURCE.is_file():
        raise SystemExit(f"Не найден источник иконок: {SOURCE}")

    OUTPUT.mkdir(parents=True, exist_ok=True)
    upscale(512).save(OUTPUT / "icon-512.png")
    upscale(192).save(OUTPUT / "icon-192.png")
    upscale(180).save(OUTPUT / "apple-touch-icon.png")

    # Maskable: логотип занимает ~75% площади, чтобы не обрезаться маской
    maskable = Image.new("RGB", (512, 512), "white")
    glyph = upscale(384)
    maskable.paste(glyph, ((512 - 384) // 2, (512 - 384) // 2))
    maskable.save(OUTPUT / "icon-maskable-512.png")

    print("PWA-иконки обновлены в dev/assets/icons/")


if __name__ == "__main__":
    main()
