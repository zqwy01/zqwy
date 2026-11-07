#!/usr/bin/env python3
"""Build the playable catalogue from the whole zqwy music collection.

The game does not copy the ~800 MB of source audio. This script only scans
``files/src/tracks`` and writes a small manifest with paths, durations and
stable ids. The tracks themselves are streamed from their original place by
the local server.

Usage:
    python3 tools/build_catalog.py [--root PATH] [--out PATH]
"""
from __future__ import annotations

import argparse
import json
import re
import subprocess
import unicodedata
from pathlib import Path

GAME_DIR = Path(__file__).resolve().parent.parent
DEFAULT_ROOT = GAME_DIR.parent.parent
DEFAULT_TRACKS = DEFAULT_ROOT / "src" / "tracks"
DEFAULT_OUT = GAME_DIR / "data" / "catalog.js"

AUDIO_EXT = {".opus", ".ogg", ".m4a", ".mp3", ".wav", ".flac"}
SKIP_DIRS = {"stems"}

# Human titles for the collection folders. Unknown folders get a readable
# title generated from the folder name, so adding a new album never breaks
# the catalogue.
ALBUM_TITLES = {
    "008008008": "008008008",
    "algiz": "Algiz",
    "alone": "Alone",
    "axs": "AXS",
    "backers": "Backers",
    "be_simpler": "Be Simpler",
    "biela": "Biela",
    "blizko_boha": "Blizko Boha",
    "broken_space": "Broken Space",
    "cyber_absolutus": "Cyber Absolutus",
    "cyber_logos": "Cyber Logos",
    "cybernetic_lifeform": "Cybernetic Lifeform",
    "death_to_capital": "Death to Capital",
    "dystopian_future": "Dystopian Future",
    "endorphin": "Endorphin",
    "everyday": "Everyday",
    "forty_hours": "Forty Hours",
    "glioma": "Glioma",
    "hurting_other_people": "Hurting Other People",
    "in_forest": "In Forest",
    "its_a_tablet": "It's a Tablet",
    "joker": "Joker",
    "kuzya": "Kuzya",
    "mannequins": "Mannequins",
    "mice_inside": "Mice Inside",
    "must_all_things_end": "Must All Things End",
    "my_tablet": "My Tablet",
    "na_hrane": "Na Hrane",
    "new_adventure": "New Adventure",
    "new_tablet": "New Tablet",
    "not_diverse": "Not Diverse",
    "not_sorted": "Unsorted",
    "petunia": "Petunia",
    "rastignac": "Rastignac",
    "runner": "Runner",
    "someone": "Someone",
    "the_remaining_one": "The Remaining One",
    "voidstorm": "Voidstorm",
}

# Small words that should stay lowercase in generated track titles.
SMALL = {"a", "an", "and", "at", "by", "for", "from", "in", "of", "on", "or",
         "the", "to", "with", "vs", "via"}


def slugify(text: str) -> str:
    text = unicodedata.normalize("NFKD", text)
    text = text.encode("ascii", "ignore").decode("ascii")
    text = re.sub(r"[^a-zA-Z0-9]+", "-", text).strip("-").lower()
    return text or "track"


def natural_key(text: str):
    return [int(p) if p.isdigit() else p.lower() for p in re.split(r"(\d+)", text)]


def album_theme(folder: str) -> str:
    key = folder[1:] if folder.startswith("!") else folder
    return slugify(key)


def album_title(folder: str) -> str:
    key = folder[1:] if folder.startswith("!") else folder
    if key in ALBUM_TITLES:
        return ALBUM_TITLES[key]
    return " ".join(w.capitalize() for w in re.split(r"[_-]+", key) if w)


def pretty_title(stem: str) -> str:
    s = stem
    s = re.sub(r"^\d+_zqwy_", "", s, flags=re.I)
    s = re.sub(r"[_-]master$", "", s, flags=re.I)
    s = re.sub(r"[_-](?:24|32)bit$", "", s, flags=re.I)
    s = s.replace("_", " ").replace("-", " ")
    s = re.sub(r"\s+", " ", s).strip()
    if not s:
        return stem
    words = []
    for i, word in enumerate(s.split(" ")):
        low = word.lower()
        if i and low in SMALL:
            words.append(low)
        elif word.isupper() and len(word) <= 5:
            words.append(word)
        else:
            words.append(word[:1].upper() + word[1:])
    return " ".join(words)


def probe_duration(path: Path) -> float:
    try:
        out = subprocess.check_output(
            [
                "ffprobe", "-v", "error", "-show_entries", "format=duration",
                "-of", "default=noprint_wrappers=1:nokey=1", str(path),
            ],
            stderr=subprocess.DEVNULL,
            timeout=30,
        )
        return round(float(out.decode().strip() or 0), 3)
    except Exception:
        return 0.0


def probe_chart_meta(track_id: str) -> dict:
    """Reuse the tempo and section count written by the chart generator."""
    try:
        chart = json.loads((GAME_DIR / "data" / "charts" / f"{track_id}.json").read_text(encoding="utf-8"))
    except Exception:
        return {}
    meta: dict = {}
    try:
        bpm = round(float(chart.get("bpm") or 0), 2)
        if bpm > 0:
            meta["bpm"] = bpm
    except (TypeError, ValueError):
        pass
    sections = chart.get("sections")
    if isinstance(sections, list) and sections:
        meta["sections"] = len(sections)
    return meta


def collect(tracks_dir: Path) -> list[dict]:
    audio: list[Path] = []
    for path in tracks_dir.rglob("*"):
        if not path.is_file() or path.suffix.lower() not in AUDIO_EXT:
            continue
        parts = path.relative_to(tracks_dir).parts
        if any(p.lower() in SKIP_DIRS for p in parts[:-1]):
            continue
        if path.stem.lower().startswith("compare"):
            continue
        audio.append(path)

    # Prefer opus over an equivalent m4a in the same folder.
    stems: dict[tuple[str, str], set[str]] = {}
    for path in audio:
        stems.setdefault((str(path.parent), path.stem), set()).add(path.suffix.lower())

    # Some albums keep a duplicate master in the album root *and* in a
    # per-track folder. Keep the deeper, curated copy.
    deeper: set[tuple[str, str]] = set()
    for path in audio:
        parts = path.relative_to(tracks_dir).parts
        if len(parts) >= 3:
            deeper.add((parts[0], path.stem.lower()))

    selected: list[Path] = []
    for path in audio:
        parts = path.relative_to(tracks_dir).parts
        if len(parts) < 2:
            continue
        folder = parts[0]
        ext = path.suffix.lower()
        if ext == ".m4a" and ".opus" in stems.get((str(path.parent), path.stem), set()):
            continue
        if re.search(r"[_-]24bit$", path.stem, re.I):
            base = re.sub(r"[_-]24bit$", "", path.stem, flags=re.I)
            if (path.parent / (base + ".opus")).is_file():
                continue
        if len(parts) == 2 and (folder, path.stem.lower()) in deeper:
            continue
        selected.append(path)

    selected.sort(key=lambda p: (p.relative_to(tracks_dir).parts[0].lower(),
                                 natural_key(str(p.relative_to(tracks_dir)))))

    albums: dict[str, list[Path]] = {}
    for path in selected:
        folder = path.relative_to(tracks_dir).parts[0]
        albums.setdefault(folder, []).append(path)

    out: list[dict] = []
    used_ids: set[str] = set()
    for folder in sorted(albums, key=album_sort_key):
        entries = []
        for path in albums[folder]:
            rel = path.relative_to(tracks_dir)
            base = path.stem
            track_id = slugify(f"{album_theme(folder)}-{base}")
            if track_id in used_ids:
                n = 2
                while f"{track_id}-{n}" in used_ids:
                    n += 1
                track_id = f"{track_id}-{n}"
            used_ids.add(track_id)
            entry = {
                "id": track_id,
                "title": pretty_title(base),
                "file": base,
                "path": "../../src/tracks/" + rel.as_posix(),
                "duration": probe_duration(path),
                "bytes": path.stat().st_size,
                "chart": f"data/charts/{track_id}.json",
                "seed": int.from_bytes(track_id.encode("utf-8")[:8].ljust(8, b"\0"), "little"),
            }
            entry.update(probe_chart_meta(track_id))
            entries.append(entry)
        entries.sort(key=lambda t: natural_key(t["file"]))
        out.append({
            "id": album_theme(folder),
            "title": album_title(folder),
            "folder": folder,
            "tracks": entries,
        })
    return out


def album_sort_key(folder: str):
    # The original album stays first, the unsorted drawer stays last.
    if folder == "backers":
        return (0, "")
    if folder.startswith("!"):
        return (9, folder.lower())
    return (1, folder.lower())


def main() -> int:
    ap = argparse.ArgumentParser(description="Scan the zqwy music collection into a game catalogue.")
    ap.add_argument("--root", type=Path, default=DEFAULT_ROOT)
    ap.add_argument("--tracks", type=Path, default=None)
    ap.add_argument("--out", type=Path, default=DEFAULT_OUT)
    args = ap.parse_args()

    tracks_dir = args.tracks or (args.root / "src" / "tracks")
    if not tracks_dir.is_dir():
        raise SystemExit(f"Не вижу коллекцию треков: {tracks_dir}")

    albums = collect(tracks_dir)
    total = sum(len(a["tracks"]) for a in albums)
    payload = {
        "version": 1,
        "artist": "zqwy",
        "title": "РИТМ-КАТАЛОГ",
        "albums": albums,
        "stats": {"albums": len(albums), "tracks": total},
    }
    args.out.parent.mkdir(parents=True, exist_ok=True)
    json_path = args.out.with_suffix(".json")
    text = json.dumps(payload, ensure_ascii=False, separators=(",", ":"))
    json_path.write_text(text, encoding="utf-8")
    args.out.write_text(
        "/* Generated by tools/build_catalog.py — do not hand-edit. */\n"
        "window.RHYTHM_CATALOG = " + text + ";\n",
        encoding="utf-8",
    )
    print(f"albums={len(albums)} tracks={total}")
    for a in albums:
        print(f"  {len(a['tracks']):3d}  {a['id']:22s} {a['title']}")
    print(f"wrote {args.out} ({args.out.stat().st_size / 1024:.1f} KiB)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
