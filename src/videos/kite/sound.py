"""Make the 10-second soundtrack from the original score, bridge synths, and local speech."""
import argparse
from math import gcd
from pathlib import Path
import subprocess
import sys

import numpy as np
from scipy import signal

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "templates" / "audio"))
from dsp import SR, fades, hp, integrated, norm_to, ns, pan, place, read_wav, rng, write_wav
from instruments import glock, m2f, pluck, vibes
from sfx_gen import breeze, flag_flutter, stroll_step, whoosh

DURATION = 10
LINES = [
    (0.28, 2.07, "Ini layangan Nara."),
    (2.18, 4.76, "Wus! Layangannya lepas!"),
    (4.97, 7.25, "Bu Mira menangkapnya."),
    (7.44, 9.92, "Terbang lagi. Pegang erat!"),
]
MELODY = [
    (.12, 72), (.52, 76), (.89, 79), (1.29, 76), (1.65, 74),
    (2.18, 81), (2.52, 79), (2.85, 76), (3.18, 74), (3.53, 71),
    (4.06, 74), (4.40, 76), (4.72, 74), (5.02, 79), (5.34, 84),
    (5.96, 81), (6.32, 79), (6.68, 76), (7.04, 74), (7.44, 76),
    (7.79, 79), (8.13, 84), (8.48, 86), (8.91, 88), (9.27, 84),
]


def empty():
    return np.zeros((2, ns(DURATION)))


def make_voice(args):
    voice = empty()
    active = np.zeros(voice.shape[1])
    if args.no_voice:
        return voice, active
    for i, (start, end, words) in enumerate(LINES, start=1):
        path = args.output / f"voice-{i}.wav"
        cmd = [args.espeak]
        if args.voice_data_parent:
            cmd += [f"--path={args.voice_data_parent}"]
        cmd += ["-v", "id", "-s", "182", "-p", "46", "-w", str(path), words]
        subprocess.run(cmd, check=True)
        pcm, source_rate = read_wav(str(path))
        common = gcd(source_rate, SR)
        pcm = signal.resample_poly(pcm[0], SR // common, source_rate // common)
        occupied = np.flatnonzero(np.abs(pcm) > .004)
        if not len(occupied):
            raise ValueError(f"eSpeak produced silence for line {i}")
        pcm = pcm[max(0, occupied[0] - ns(.012)):occupied[-1] + ns(.045)]
        if start + len(pcm) / SR > end:
            raise ValueError(f"Line {i} exceeds its story cue")
        pcm = fades(hp(pcm, 105), .012, .036)
        peak = np.max(np.abs(pcm))
        place(voice, pcm * (.57 / peak), start)
        active[max(0, ns(start - .07)):min(len(active), ns(start) + len(pcm) + ns(.10))] = 1
        print(f"Indonesian line {i}: {start:.2f}s–{start + len(pcm) / SR:.2f}s")
    kernel = signal.windows.hann(ns(.20))
    duck = signal.fftconvolve(active, kernel / kernel.sum(), mode="same")
    return voice, np.clip(duck, 0, 1)


def score(random):
    music = empty()
    for i, (at, note) in enumerate(MELODY):
        place(music, pan(vibes(m2f(note), .72, random, dur=.9, damp=.40), .17 * (-1) ** i), at, .126)
    for at, chord in [
        (0, [48, 55]), (1.20, [53, 60]), (2.22, [45, 52]), (3.50, [43, 50]),
        (4.95, [48, 55]), (6.15, [53, 60]), (7.31, [43, 55]), (8.78, [48, 55, 60]),
    ]:
        for i, pitch in enumerate(chord):
            place(music, pan(pluck(m2f(pitch), .7, random, dur=1.25), -.22), at + .10 * i, .21)
    place(music, pan(glock(m2f(91), .65, random, dur=.70), .32), 9.22, .095)
    return fades(music, .025, .27)


def effects(random):
    fx = empty()
    place(fx, breeze(DURATION, random, level=.035), 0)
    for i, at in enumerate([.36, .95, 1.58, 2.17, 2.67, 3.19, 3.72, 4.23, 4.76, 5.30, 6.01]):
        place(fx, pan(stroll_step(random, .45), -.34 + .05 * i), at, .092)
    place(fx, pan(whoosh(1.28, random, peak=.28, f_hi=2550), -.23), 1.94, .54)
    place(fx, pan(fades(flag_flutter(.63, random), .06, .18), .29), 4.77, .16)
    place(fx, pan(whoosh(1.16, random, peak=.33, f_hi=1800), .18), 7.30, .31)
    return fades(fx, .075, .34)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("output", type=Path)
    parser.add_argument("--espeak", default="espeak-ng")
    parser.add_argument("--voice-data-parent", type=Path)
    parser.add_argument("--no-voice", action="store_true")
    args = parser.parse_args()
    args.output.mkdir(parents=True, exist_ok=True)
    voice, duck = make_voice(args)
    music = score(rng(391))
    fx = effects(rng(237))
    mix = voice + music * (1 - .48 * duck) + fx * (1 - .26 * duck)
    mix = norm_to(mix, -16, mode="integrated")
    mix *= min(1, .87 / np.max(np.abs(mix)))
    for name, track in [("mix", mix), ("voice", voice), ("music", music), ("effects", fx)]:
        write_wav(str(args.output / f"{name}.wav"), track)
    print(f"Mix: {DURATION}s, 48 kHz stereo, {integrated(mix):.1f} LUFS")


if __name__ == "__main__":
    main()
