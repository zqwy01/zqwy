#!/usr/bin/env python3
"""Build the playable beat chart for DRILL TO THE NEIGHBOR.

The source track has no MIDI. Everything here is measured from the audio:
a 90 BPM quarter-note grid is fitted to the kick/onset envelope, then the
same audio is sampled around every beat to describe loudness and accents.

Usage:
  python3 tools/build_chart.py [--source PATH] [--out PATH]
"""
from __future__ import annotations

import argparse
import json
import subprocess
import tempfile
from pathlib import Path

import numpy as np
from scipy.signal import stft

SR = 22050
NFFT = 2048
HOP = 512
BPM = 90.0
BEAT_PERIOD = 60.0 / BPM
GAME_END = 155.1  # last audible hit is ~154.6 s; the file has a silent tail

DEFAULT_SOURCE = Path(
    "/home/zqwy/smb/content/category/sound/music/original/voidstorm/tracks/"
    "8_zqwy_drill_to_the_neighbor/8_zqwy_drill_to_the_neighbor.wav"
)
DEFAULT_OUT = Path(__file__).resolve().parent.parent / "js" / "chart.js"

SECTIONS = [
    # start/end are measured in the source audio; names are game-side.
    ("silence", "ТИШИНА КУРГАНА", 0.0, 6.305),
    ("wake", "ПРОБУЖДЕНИЕ КОРНЕЙ", 6.305, 36.0),
    ("tide", "ПРИЛИВ", 36.0, 44.0),
    ("deep", "ГЛУБОКИЙ ХОД", 44.0, 108.0),
    ("heart", "СЕРДЦЕ КУРГАНА", 108.0, 112.0),
    ("road", "ДОРОГА К СОСЕДУ", 112.0, 148.0),
    ("threshold", "ПОРОГ", 148.0, 155.1),
]


def decode(source: Path, target: Path) -> None:
    subprocess.run(
        [
            "ffmpeg", "-v", "error", "-y",
            "-i", str(source), "-map", "0:a:0",
            "-ac", "1", "-ar", str(SR), "-f", "f32le", str(target),
        ],
        check=True,
    )


def normalise(a: np.ndarray) -> np.ndarray:
    a = np.maximum(a, 0.0)
    a = a - np.percentile(a, 20)
    a = np.maximum(a, 0.0)
    top = np.percentile(a, 95)
    return a / top if top else a


def analyse(source: Path) -> dict:
    with tempfile.TemporaryDirectory(prefix="drill-chart-") as tmp:
        raw = Path(tmp) / "mono.f32"
        decode(source, raw)
        x = np.fromfile(raw, dtype="<f4").astype(np.float64)

    duration = len(x) / SR
    f, _, z = stft(
        x, fs=SR, window="hann", nperseg=NFFT, noverlap=NFFT - HOP,
        nfft=NFFT, boundary=None, padded=False,
    )
    mag = np.abs(z)
    fps = SR / HOP
    logmag = np.log1p(20 * mag)

    def flux(lo: float, hi: float) -> np.ndarray:
        mask = (f >= lo) & (f <= hi)
        a = np.sum(np.maximum(0, np.diff(logmag[mask], axis=1)), axis=0)
        a = np.concatenate([[0.0], a])
        return normalise(a)

    low = flux(25, 160)
    mid = flux(160, 4000)
    high = flux(4000, 11000)

    # Fit a 90 BPM quarter-note grid to the low-frequency pulse. The track
    # has a kick/onset roughly every eighth note (0.333 s), so every second
    # pulse is a quarter beat.
    period_frames = BEAT_PERIOD * fps
    best_score, best_phase_frames = -1.0, 0.0
    fit_lo, fit_hi = int(8.0 * fps), int(150.0 * fps)
    for phase in np.linspace(0.0, period_frames, 2400, endpoint=False):
        idx = np.rint(np.arange(phase, len(low), period_frames)).astype(int)
        idx = idx[(idx >= fit_lo) & (idx < fit_hi)]
        score = float(low[idx].mean())
        if score > best_score:
            best_score, best_phase_frames = score, phase
    phase = best_phase_frames / fps

    # Per-beat features. A beat's low/mid/high value is the local maximum of
    # that band's onset envelope around the grid point.
    beats = []
    n = 0
    while True:
        t = phase + n * BEAT_PERIOD
        if t >= GAME_END:
            break
        if t < 6.0:
            n += 1
            continue
        i0 = max(0, int((t - 0.065) * fps))
        i1 = min(len(low), int((t + 0.065) * fps) + 1)
        if i1 <= i0:
            i0, i1 = max(0, int(t * fps)), min(len(low), int(t * fps) + 1)
        a0 = max(0, int((t - 0.16) * SR))
        a1 = min(len(x), int((t + 0.16) * SR))
        seg = x[a0:a1]
        rms = float(np.sqrt(np.mean(seg * seg))) if len(seg) else 0.0
        beats.append({
            "t": round(t, 3),
            "n": n,
            "low": round(float(np.max(low[i0:i1])), 3),
            "mid": round(float(np.max(mid[i0:i1])), 3),
            "high": round(float(np.max(high[i0:i1])), 3),
            "rms": round(rms, 3),
        })
        n += 1

    lows = np.array([b["low"] for b in beats])
    strong_cut = float(np.percentile(lows, 72))
    for i, b in enumerate(beats):
        b["bar"] = int((b["n"] - 9) // 4)
        b["inBar"] = int((b["n"] - 9) % 4)
        b["accent"] = bool(b["inBar"] == 0)
        b["strong"] = bool(b["low"] >= strong_cut)
        b["str"] = round(min(1.5, max(b["low"], b["mid"])), 3)

    # Section measurements (loudness and band activity over the whole span).
    sections = []
    for sid, name, start, end in SECTIONS:
        a0 = max(0, int(start * SR))
        a1 = min(len(x), int(end * SR))
        seg = x[a0:a1]
        section_rms = float(np.sqrt(np.mean(seg * seg))) if len(seg) else 0.0
        i0 = max(0, int(start * fps))
        i1 = min(len(low), int(end * fps))
        sections.append({
            "id": sid,
            "name": name,
            "start": round(start, 3),
            "end": round(end, 3),
            "rms": round(section_rms, 3),
            "low": round(float(low[i0:i1].mean()) if i1 > i0 else 0.0, 3),
            "mid": round(float(mid[i0:i1].mean()) if i1 > i0 else 0.0, 3),
            "high": round(float(high[i0:i1].mean()) if i1 > i0 else 0.0, 3),
        })

    return {
        "duration": round(duration, 3),
        "phase": round(phase, 4),
        "beats": beats,
        "sections": sections,
        "filesize": source.stat().st_size,
        "strongCut": round(strong_cut, 3),
    }


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--source", type=Path, default=DEFAULT_SOURCE)
    ap.add_argument("--out", type=Path, default=DEFAULT_OUT)
    args = ap.parse_args()

    data = analyse(args.source)
    beats = data["beats"]
    meta = {
        "title": "drill_to_the_neighbor",
        "artist": "zqwy",
        "album": "voidstorm",
        "duration": data["duration"],
        "playableEnd": GAME_END,
        "musicEnd": round(beats[-1]["t"] + BEAT_PERIOD, 3),
        "bpmTag": 90,
        "beatPeriod": round(BEAT_PERIOD, 6),
        "beatPhase": data["phase"],
        "eighthPulse": round(BEAT_PERIOD / 2, 6),
        "firstBeat": beats[0]["t"],
        "lastBeat": beats[-1]["t"],
        "beatCount": len(beats),
        "analyser": "numpy/scipy spectral-flux onset envelope + 90 BPM grid fit",
        "note": "Сетка построена по ударам в аудио; MIDI-партитуры у трека нет.",
    }
    payload = {"meta": meta, "sections": data["sections"], "beats": beats}
    js = (
        "/* Generated by tools/build_chart.py — do not hand-edit. */\n"
        "window.DRILL_CHART = "
        + json.dumps(payload, ensure_ascii=False, separators=(",", ":"))
        + ";\n"
    )
    args.out.write_text(js, encoding="utf-8")
    print(f"wrote {args.out} ({args.out.stat().st_size} bytes)")
    print(f"duration={data['duration']}s phase={data['phase']}s beats={len(beats)}")
    print("sections:")
    for s in data["sections"]:
        print(f"  {s['start']:7.2f}-{s['end']:7.2f}  rms={s['rms']:.3f}  {s['name']}")


if __name__ == "__main__":
    main()
