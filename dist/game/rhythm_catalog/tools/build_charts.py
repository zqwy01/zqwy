#!/usr/bin/env python3
"""Analyse every track in the catalogue and generate rhythm charts.

The analysis is deliberately self-contained: the game only stores small JSON
files with onset times, lane assignments, section markers and a coarse
atmosphere envelope. The music itself stays in ``src/tracks``.

Usage:
    python3 tools/build_charts.py             # missing charts only
    python3 tools/build_charts.py --force     # rebuild everything
    python3 tools/build_charts.py --only umbrella
    python3 tools/build_charts.py --limit 5
"""
from __future__ import annotations

import argparse
import json
import math
import subprocess
import sys
from pathlib import Path

import numpy as np
from scipy.ndimage import median_filter
from scipy.signal import find_peaks, stft

GAME_DIR = Path(__file__).resolve().parent.parent
DEFAULT_CATALOG = GAME_DIR / "data" / "catalog.json"
DEFAULT_OUT = GAME_DIR / "data" / "charts"

SR = 22050
NPERSEG = 1024
HOP = 512
ENV_HZ = 5.0
MAX_NOTES_PER_SEC = 3.2
MIN_NOTE_GAP = 0.115

SECTION_TEXT = {
    "intro": ("ВСТУПЛЕНИЕ", "Первый вдох трека."),
    "build": ("РАЗГОН", "Рисунок набирает силу."),
    "theme": ("ОСНОВНАЯ ТЕМА", "Держи пульс."),
    "drop": ("УДАР", "Низ пробивает пол."),
    "break": ("ПЕРЕДЫШКА", "Свет становится тише."),
    "climax": ("КУЛЬМИНАЦИЯ", "Всё звучит сразу."),
    "outro": ("ФИНАЛ", "Последний такт."),
}

ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"]


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


def hex_rows(values: np.ndarray) -> list[str]:
    rows = []
    for row in values:
        rows.append("".join(f"{int(v) & 255:02x}" for v in row))
    return rows


def analyse(path: Path) -> dict:
    y = decode(path)
    duration = len(y) / SR
    if len(y) < NPERSEG:
        raise RuntimeError(f"слишком короткий трек: {path}")

    freqs, _, z = stft(
        y, fs=SR, window="hann", nperseg=NPERSEG,
        noverlap=NPERSEG - HOP, nfft=NPERSEG, boundary=None, padded=False,
    )
    mag = np.abs(z).astype(np.float32)
    fps = SR / HOP
    logmag = np.log1p(20.0 * mag)

    bands = [(30.0, 170.0), (170.0, 650.0), (650.0, 2400.0), (2400.0, 9000.0)]
    band_flux = []
    for lo, hi in bands:
        mask = (freqs >= lo) & (freqs < hi)
        d = np.maximum(0.0, np.diff(logmag[mask], axis=1)).sum(axis=0)
        d = np.concatenate([[0.0], d])
        ref = float(np.percentile(d, 95)) + 1e-9
        band_flux.append(d / ref)
    band_flux = np.asarray(band_flux, dtype=np.float32)

    onset = band_flux.sum(axis=0)
    onset = smooth(onset, 3)
    local = median_filter(onset, size=max(3, int(0.9 * fps)), mode="nearest")
    threshold = local * 1.28 + 0.045
    peaks, props = find_peaks(
        onset, height=threshold, distance=max(2, int(0.10 * fps)),
        prominence=0.022,
    )

    # Keep the strongest onsets, but enforce a playable minimum gap and a
    # per-track note budget so dense mixes do not turn into noise.
    strengths = props["peak_heights"].astype(np.float32)
    times_all = peaks.astype(np.float64) / fps
    budget = max(24, int(duration * MAX_NOTES_PER_SEC))
    keep_times: list[float] = []
    keep_idx: list[int] = []
    for idx in np.argsort(-strengths):
        t = float(times_all[idx])
        if any(abs(t - other) < MIN_NOTE_GAP for other in keep_times):
            continue
        keep_times.append(t)
        keep_idx.append(int(idx))
        if len(keep_idx) >= budget:
            break
    keep_idx.sort(key=lambda i: times_all[i])
    if keep_idx:
        peaks = peaks[keep_idx]
        strengths = strengths[keep_idx]
        times_all = times_all[keep_idx]
    else:
        peaks = np.array([], dtype=int)
        strengths = np.array([], dtype=np.float32)
        times_all = np.array([], dtype=np.float64)

    # Spectral centre at each onset: low transients land on the left lane,
    # airy hits on the right. Quartiles keep all four lanes useful.
    energy = mag.sum(axis=0) + 1e-9
    centroid = (freqs[:, None] * mag).sum(axis=0) / energy
    if len(peaks):
        cent = centroid[peaks]
        edges = np.percentile(cent, [25, 50, 75])
        lanes = np.digitize(cent, edges)
        lanes = np.clip(lanes, 0, 3)
        smax = float(strengths.max()) or 1.0
        vel = np.clip((strengths / smax) ** 0.72, 0.18, 1.0)
    else:
        lanes = np.array([], dtype=int)
        vel = np.array([], dtype=np.float32)

    # A very sparse ambient track still needs a playable pulse. Add beat-grid
    # notes only where the onset detector found almost nothing.
    bpm, beat_phase = estimate_tempo(onset, fps)
    beat = 60.0 / bpm
    if len(times_all) < max(18, duration * 0.55):
        extra_t: list[float] = []
        extra_l: list[int] = []
        t = beat_phase
        lane = 0
        while t < duration - 0.4:
            if all(abs(t - old) >= 0.25 for old in times_all) and all(abs(t - old) >= 0.25 for old in extra_t):
                # pick the loudest band near the grid point
                i = min(len(onset) - 1, max(0, int(t * fps)))
                b0, b1 = max(0, i - 2), min(band_flux.shape[1], i + 3)
                lane = int(np.argmax(band_flux[:, b0:b1].sum(axis=1)))
                extra_t.append(round(float(t), 3))
                extra_l.append(lane)
            t += beat / 2 if (len(times_all) + len(extra_t)) % 4 else beat
        if extra_t:
            merged = [(float(t), int(l), 0.42) for t, l in zip(times_all, lanes)]
            merged += [(t, l, 0.34) for t, l in zip(extra_t, extra_l)]
            merged.sort()
            times_all = np.array([m[0] for m in merged])
            lanes = np.array([m[1] for m in merged])
            vel = np.array([m[2] for m in merged], dtype=np.float32)

    notes = [
        [round(float(t), 3), int(l), round(float(v), 3)]
        for t, l, v in zip(times_all, lanes, vel)
    ]

    # ---- atmosphere envelope (5 Hz, four bytes per row) ----------------
    env_frames = max(1, int(math.ceil(duration * ENV_HZ)))
    block = max(1, int(round(fps / ENV_HZ)))
    env = np.zeros((env_frames, 4), dtype=np.float32)
    level = np.zeros(env_frames, dtype=np.float32)
    for k in range(env_frames):
        a = k * block
        b = min(mag.shape[1], a + block)
        if b <= a:
            continue
        seg = mag[:, a:b]
        level[k] = float(np.sqrt(np.mean(seg * seg)))
        for bi, (lo, hi) in enumerate(bands):
            mask = (freqs >= lo) & (freqs < hi)
            env[k, bi] = float(seg[mask].mean()) if np.any(mask) else 0.0
    for col in range(4):
        ref = float(np.percentile(env[:, col], 96)) + 1e-9
        env[:, col] = np.clip(env[:, col] / ref, 0, 1)
    ref = float(np.percentile(level, 96)) + 1e-9
    level = np.clip(level / ref, 0, 1)
    env_q = np.round(env * 255).astype(int)

    # ---- playable end: trim long silent tails --------------------------
    loud = np.where(level > max(0.02, float(np.percentile(level, 55)) * 0.24))[0]
    if len(loud):
        last_t = (loud[-1] + 1) / ENV_HZ
        playable_end = min(duration, max(18.0, last_t + 2.6))
    else:
        playable_end = duration
    if playable_end > duration - 1.0:
        playable_end = duration

    # ---- sections -------------------------------------------------------
    sections = build_sections(level, playable_end, duration)
    density = len(notes) / max(1.0, playable_end)
    difficulty = int(np.clip(round(1.0 + density * 2.15 + max(0, bpm - 70) / 55), 1, 10))

    return {
        "duration": round(duration, 3),
        "playableEnd": round(playable_end, 3),
        "bpm": int(round(bpm)),
        "beat": round(beat, 6),
        "beatPhase": round(beat_phase, 4),
        "notes": notes,
        "sections": sections,
        "envHz": ENV_HZ,
        "env": hex_rows(env_q),
        "counts": [int((lanes == i).sum()) for i in range(4)],
        "density": round(density, 3),
        "difficulty": difficulty,
        "analyser": "numpy/scipy spectral flux + spectral-centre lanes",
    }


def estimate_tempo(onset: np.ndarray, fps: float) -> tuple[float, float]:
    x = onset.astype(np.float64)
    x = x - x.mean()
    if len(x) < 64:
        return 100.0, 0.0
    # autocorrelation through FFT
    n = 1 << (2 * len(x) - 1).bit_length()
    f = np.fft.rfft(x, n)
    ac = np.fft.irfft(f * np.conj(f), n)[:len(x)]
    ac /= (ac[0] + 1e-9)
    lo = int(0.30 * fps)
    hi = min(len(ac) - 1, int(1.30 * fps))
    if hi <= lo:
        return 100.0, 0.0
    lags = np.arange(lo, hi + 1)
    bpm_guess = 60.0 * fps / lags
    prior = np.exp(-0.5 * ((bpm_guess - 112.0) / 58.0) ** 2)
    score = ac[lags] * (0.82 + 0.18 * prior)
    best = int(lags[int(np.argmax(score))])
    bpm = 60.0 * fps / max(1, best)
    while bpm < 70.0:
        bpm *= 2.0
    while bpm > 185.0:
        bpm /= 2.0
    bpm = float(np.clip(bpm, 60.0, 200.0))

    period = 60.0 / bpm * fps
    grid_env = smooth(onset, 2)
    best_phase, best_score = 0.0, -1.0
    for phase in np.arange(0.0, period, 0.25):
        idx = np.rint(np.arange(phase, len(grid_env), period)).astype(int)
        idx = idx[(idx >= 0) & (idx < len(grid_env))]
        if not len(idx):
            continue
        sc = float(grid_env[idx].mean())
        if sc > best_score:
            best_score, best_phase = sc, float(phase)
    return bpm, best_phase / fps


def build_sections(level: np.ndarray, playable_end: float, duration: float) -> list[dict]:
    count = int(np.clip(round(playable_end / 27.0), 4, 10))
    count = min(count, len(level))
    if count < 1:
        return []
    step = playable_end / count
    ref = float(np.percentile(level, 92)) + 1e-9
    energies = []
    for i in range(count):
        a = int(i * step * ENV_HZ)
        b = int(min(len(level), (i + 1) * step * ENV_HZ))
        energies.append(float(level[a:b].mean() / ref) if b > a else 0.0)
    loudest = int(np.argmax(energies))
    sections = []
    for i, e in enumerate(energies):
        if i == 0 and e < 0.48:
            tag = "intro"
        elif i == count - 1:
            tag = "outro"
        elif i == loudest:
            tag = "climax"
        elif e > 0.72:
            tag = "drop"
        elif e < 0.34:
            tag = "break"
        elif i < count / 2:
            tag = "build"
        else:
            tag = "theme"
        name, sub = SECTION_TEXT[tag]
        sections.append({
            "t0": round(i * step, 3),
            "t1": round(min(duration, (i + 1) * step), 3),
            "num": ROMAN[i] if i < len(ROMAN) else str(i + 1),
            "name": name,
            "sub": sub,
            "tag": tag,
        })
    return sections


def main() -> int:
    ap = argparse.ArgumentParser(description="Generate compact rhythm charts for the catalogue.")
    ap.add_argument("--catalog", type=Path, default=DEFAULT_CATALOG)
    ap.add_argument("--out", type=Path, default=DEFAULT_OUT)
    ap.add_argument("--only", default="", help="substring of id/album")
    ap.add_argument("--limit", type=int, default=0)
    ap.add_argument("--force", action="store_true")
    args = ap.parse_args()

    if not args.catalog.is_file():
        raise SystemExit(f"Нет каталога: {args.catalog}\nСначала запусти tools/build_catalog.py")
    payload = json.loads(args.catalog.read_text(encoding="utf-8"))
    args.out.mkdir(parents=True, exist_ok=True)

    tracks = []
    for album in payload["albums"]:
        for track in album["tracks"]:
            if args.only and args.only.lower() not in (album["id"] + "/" + track["id"]).lower():
                continue
            tracks.append((album, track))

    if args.limit:
        tracks = tracks[:args.limit]

    done = 0
    for album, track in tracks:
        out_path = GAME_DIR / track["chart"]
        src = GAME_DIR / track["path"]
        if out_path.is_file() and not args.force:
            done += 1
            continue
        if not src.is_file():
            print(f"  ! missing {src}", file=sys.stderr)
            continue
        try:
            data = analyse(src)
        except Exception as exc:
            print(f"  ! {track['id']}: {exc}", file=sys.stderr)
            continue
        data.update({
            "id": track["id"],
            "title": track["title"],
            "album": album["id"],
            "albumTitle": album["title"],
        })
        out_path.write_text(
            json.dumps(data, ensure_ascii=False, separators=(",", ":")),
            encoding="utf-8",
        )
        track["notes"] = len(data["notes"])
        track["density"] = data["density"]
        track["difficulty"] = data["difficulty"]
        track["playableEnd"] = data["playableEnd"]
        done += 1
        print(
            f"[{done}/{len(tracks)}] {track['id']}: "
            f"{data['duration']:.0f}s  {len(data['notes'])} notes  "
            f"{data['bpm']} BPM  diff={data['difficulty']}",
            flush=True,
        )

    # Keep the catalogue in sync with chart metadata.
    text = json.dumps(payload, ensure_ascii=False, separators=(",", ":"))
    args.catalog.write_text(text, encoding="utf-8")
    (GAME_DIR / "data" / "catalog.js").write_text(
        "/* Generated by tools/build_catalog.py — do not hand-edit. */\n"
        "window.RHYTHM_CATALOG = " + text + ";\n",
        encoding="utf-8",
    )
    print(f"ready: {done} chart(s)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
