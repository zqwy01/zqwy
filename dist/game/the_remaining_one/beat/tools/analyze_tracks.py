#!/usr/bin/env python3
"""Build rhythm charts and atmosphere envelopes from the album.

The game does not ship the music: it reads the original Opus files from
../../src/tracks/the_remaining_one/tracks/. This script only extracts timing
data (onsets, spectral centroid and a coarse energy envelope) and writes it to
js/charts.js.

Usage:
    python3 tools/analyze_tracks.py
"""
from __future__ import annotations

import json
import math
import subprocess
import sys
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT.parent.parent / "src" / "tracks" / "the_remaining_one" / "tracks"
OUT = ROOT / "js" / "charts.js"

# chapter slug, folder, title, bpm/key from the album metadata
TRACKS = [
    ("barchans", "1_zqwy_barchans", "1_zqwy_barchans", 80, "G"),
    ("shiny-sand", "2_zqwy_shiny_sand", "2_zqwy_shiny_sand", 111, "Em"),
    ("adaptation", "3_zqwy_adaptation", "3_zqwy_adaptation", 100, "Fm"),
    ("noah", "4_zqwy_everything_noah_does_is_me", "4_zqwy_everything_noah_does_is_me", 91, "Em"),
    ("time-shifting", "5_zqwy_time_shifting", "5_zqwy_time_shifting", 159, "Em"),
    ("aleppo", "6_zqwy_aleppo_codex", "6_zqwy_aleppo_codex", 166, "Em"),
    ("shhhhhh", "7_zqwy_shhhhhh", "7_zqwy_shhhhhh", 176, "Am"),
    ("atomic", "8_zqwy_from_atomic", "8_zqwy_from_atomic", 84, "Dm"),
    ("neverborne", "9_zqwy_never_neverborne", "9_zqwy_never_neverborne", 100, "Fm"),
]

SR = 22050
FRAME = 1024
HOP = 256
ENV_HZ = 5.0
MAX_NOTES_PER_SEC = 3.6


def decode(path: Path) -> np.ndarray:
    cmd = [
        "ffmpeg", "-v", "error", "-i", str(path), "-f", "f32le",
        "-ac", "1", "-ar", str(SR), "-",
    ]
    raw = subprocess.check_output(cmd)
    return np.frombuffer(raw, dtype="<f4").astype(np.float32)


def smooth(x: np.ndarray, n: int) -> np.ndarray:
    if n <= 1:
        return x
    k = np.ones(n, dtype=np.float32) / n
    return np.convolve(x, k, mode="same")


def analyse(path: Path, bpm: int) -> dict:
    y = decode(path)
    duration = len(y) / SR
    if len(y) < FRAME:
        raise RuntimeError(f"too short: {path}")

    n_frames = 1 + (len(y) - FRAME) // HOP
    window = np.hanning(FRAME).astype(np.float32)
    freqs = np.fft.rfftfreq(FRAME, 1.0 / SR)

    # Band masks. The four lanes follow the spectral centre of each hit.
    bands = [
        (30.0, 170.0),
        (170.0, 650.0),
        (650.0, 2400.0),
        (2400.0, 9000.0),
    ]
    band_masks = [(freqs >= lo) & (freqs < hi) for lo, hi in bands]
    all_mask = (freqs >= 30) & (freqs < 9000)

    flux = np.zeros(n_frames, dtype=np.float32)
    band_flux = np.zeros((n_frames, len(bands)), dtype=np.float32)
    rms = np.zeros(n_frames, dtype=np.float32)
    centroid = np.zeros(n_frames, dtype=np.float32)
    low_rms = np.zeros(n_frames, dtype=np.float32)

    prev = np.zeros(len(freqs), dtype=np.float32)
    for i in range(n_frames):
        chunk = y[i * HOP: i * HOP + FRAME] * window
        mag = np.abs(np.fft.rfft(chunk)).astype(np.float32)
        if i == 0:
            prev = mag
        d = np.maximum(0.0, mag - prev)
        prev = mag
        flux[i] = float(d[all_mask].sum())
        for bi, mask in enumerate(band_masks):
            band_flux[i, bi] = float(d[mask].sum())
        rms[i] = float(np.sqrt(np.mean(chunk * chunk)))
        low_rms[i] = float(np.sqrt(np.mean(chunk * chunk)))
        denom = float(mag[all_mask].sum()) + 1e-9
        centroid[i] = float((freqs[all_mask] * mag[all_mask]).sum() / denom)

    # Normalised full-band flux (so thresholds are track independent).
    flux_n = flux / (float(np.percentile(flux, 95)) + 1e-9)
    flux_s = smooth(flux_n, 3)
    # Adaptive threshold: a local median with a small absolute floor.
    from scipy.ndimage import median_filter
    local = median_filter(flux_s, size=max(3, int(1.1 * SR / HOP)), mode="nearest")
    thr = local * 1.35 + 0.035

    from scipy.signal import find_peaks
    min_dist = max(2, int(0.095 * SR / HOP))
    peaks, props = find_peaks(
        flux_s, height=thr, distance=min_dist, prominence=0.025,
    )

    # Keep the strongest onsets, but never more than ~3.6 per second.
    times = peaks.astype(np.float64) * HOP / SR
    strengths = props["peak_heights"].astype(np.float32)
    order = np.argsort(-strengths)
    budget = int(duration * MAX_NOTES_PER_SEC)
    keep = np.zeros(len(peaks), dtype=bool)
    kept_times: list[float] = []
    min_gap = 0.115
    for idx in order:
        t = float(times[idx])
        if all(abs(t - k) >= min_gap for k in kept_times[-8:]):
            keep[idx] = True
            kept_times.append(t)
            if keep.sum() >= budget:
                break
    keep &= strengths >= np.percentile(strengths, 12)
    times = times[keep]
    strengths = strengths[keep]
    peaks = peaks[keep]

    # Lane assignment by spectral centroid percentile: low hits left, air right.
    cent = centroid[peaks]
    edges = np.percentile(cent, [25, 50, 75]) if len(cent) else [0, 0, 0]
    lanes = np.digitize(cent, edges)
    lanes = np.clip(lanes, 0, 3)

    # Quantise strength to 1..99 for a compact file.
    smax = float(strengths.max()) if len(strengths) else 1.0
    strengths_q = np.clip(np.round(strengths / smax * 98) + 1, 1, 99).astype(int)

    notes = [
        [int(round(t * 1000)), int(lane), int(s)]
        for t, lane, s in sorted(zip(times, lanes, strengths_q))
    ]

    # ---- coarse atmosphere envelope (5 Hz) ----
    env_frames = max(1, int(math.ceil(duration * ENV_HZ)))
    idx = np.linspace(0, len(y) - 1, env_frames * int(SR / ENV_HZ) + 1).astype(int)
    # rms of non-overlapping ~200 ms blocks
    block = int(SR / ENV_HZ)
    env = np.zeros((env_frames, 4), dtype=np.float32)
    for k in range(env_frames):
        seg = y[k * block: (k + 1) * block]
        if len(seg) == 0:
            continue
        spec = np.abs(np.fft.rfft(seg * np.hanning(len(seg))))
        f = np.fft.rfftfreq(len(seg), 1.0 / SR)
        lo = spec[(f >= 30) & (f < 170)].mean() if np.any((f >= 30) & (f < 170)) else 0
        mi = spec[(f >= 170) & (f < 2400)].mean() if np.any((f >= 170) & (f < 2400)) else 0
        hi = spec[(f >= 2400) & (f < 9000)].mean() if np.any((f >= 2400) & (f < 9000)) else 0
        env[k, 0] = np.sqrt(np.mean(seg * seg))
        env[k, 1] = lo
        env[k, 2] = mi
        env[k, 3] = hi
    for col in range(4):
        ref = float(np.percentile(env[:, col], 96)) + 1e-9
        env[:, col] = np.clip(env[:, col] / ref, 0, 1)
    env_q = np.round(env * 255).astype(int)

    # One value per 0.2 s is more than enough for atmosphere and section cues.
    env_rows = ["".join(f"{v:02x}" for v in row) for row in env_q]

    return {
        "duration": round(duration, 3),
        "bpm": bpm,
        "notes": notes,
        "envHz": ENV_HZ,
        "env": env_rows,
        "counts": [int((lanes == i).sum()) for i in range(4)],
    }


def main() -> int:
    result: dict[str, dict] = {}
    for slug, folder, base, bpm, key in TRACKS:
        path = SRC / folder / f"{base}.opus"
        if not path.exists():
            print(f"missing: {path}", file=sys.stderr)
            return 1
        print(f"analysing {slug} ...", flush=True)
        data = analyse(path, bpm)
        data.update({
            "slug": slug,
            "key": key,
            "file": f"../../src/tracks/the_remaining_one/tracks/{folder}/{base}.opus",
        })
        result[slug] = data
        print(
            f"  {data['duration']:.1f}s  {len(data['notes'])} notes  "
            f"lanes={data['counts']}  {len(data['notes']) / data['duration']:.2f} n/s",
            flush=True,
        )

    OUT.parent.mkdir(parents=True, exist_ok=True)
    payload = json.dumps(result, ensure_ascii=False, separators=(",", ":"))
    OUT.write_text(
        "/* generated by tools/analyze_tracks.py — do not edit by hand */\n"
        "window.TRO_CHARTS = " + payload + ";\n",
        encoding="utf-8",
    )
    print(f"wrote {OUT} ({OUT.stat().st_size / 1024:.1f} KiB)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
