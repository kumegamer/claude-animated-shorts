"""Make a Layang-Layang Pulang soundtrack from the original score, bridge synths, and local speech."""
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
from sfx_gen import breeze, clink, flag_flutter, stroll_step, whoosh

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

CONTINUITY_LINES = [
    (.36, 2.72, "Sore itu, Nara membawa layangan."),
    (3.10, 6.45, "Angin menarik talinya. Gulungannya lepas!"),
    (6.86, 8.78, "Bu Mira menangkap gulungannya."),
    (9.25, 10.82, "Nara memegangnya erat."),
    (12.07, 14.82, "Kali ini, angin jadi temannya."),
]
CONTINUITY_MELODY = [
    (.13, 72), (.57, 76), (1.02, 79), (1.44, 76), (1.93, 74), (2.46, 72),
    (2.98, 76), (3.29, 79), (3.56, 83), (3.91, 81), (4.18, 79), (4.46, 76),
    (4.73, 74), (5.04, 71), (5.41, 74), (5.76, 76), (6.16, 74), (6.55, 77),
    (6.88, 84), (7.31, 79), (7.94, 76), (8.60, 74), (9.23, 76), (9.88, 79),
    (10.66, 79), (11.11, 84), (11.54, 86), (12.07, 88),
    (12.66, 86), (13.16, 84), (13.80, 79), (14.35, 84),
]
CONTINUITY_CHORDS = [
    (0, [48, 55]), (1.62, [53, 60]), (2.91, [45, 52]), (4.21, [43, 50]),
    (5.46, [45, 52]), (6.86, [48, 55]), (8.12, [53, 60]), (9.23, [55, 62]),
    (10.83, [48, 55, 60]), (12.39, [53, 60]), (13.81, [48, 55, 64]),
]


def empty(duration=DURATION):
    return np.zeros((2, ns(duration)))


def make_voice(args, duration, lines, speed):
    voice = empty(duration)
    active = np.zeros(voice.shape[1])
    if args.no_voice:
        return voice, active
    for i, (start, end, words) in enumerate(lines, start=1):
        path = args.output / f"voice-{i}.wav"
        cmd = [args.espeak]
        if args.voice_data_parent:
            cmd += [f"--path={args.voice_data_parent}"]
        cmd += ["-v", "id", "-s", str(speed), "-p", "46", "-w", str(path), words]
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


def score(random, continuity):
    music = empty(15 if continuity else DURATION)
    melody = CONTINUITY_MELODY if continuity else MELODY
    for i, (at, note) in enumerate(melody):
        place(music, pan(vibes(m2f(note), .72, random, dur=.9, damp=.40), .17 * (-1) ** i), at, .126)
    previous_chords = [
        (0, [48, 55]), (1.20, [53, 60]), (2.22, [45, 52]), (3.50, [43, 50]),
        (4.95, [48, 55]), (6.15, [53, 60]), (7.31, [43, 55]), (8.78, [48, 55, 60]),
    ]
    for at, chord in CONTINUITY_CHORDS if continuity else previous_chords:
        for i, pitch in enumerate(chord):
            place(music, pan(pluck(m2f(pitch), .7, random, dur=1.25), -.22), at + .10 * i, .21)
    place(music, pan(glock(m2f(91), .65, random, dur=.70), .32), 14.31 if continuity else 9.22, .095)
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


def continuity_effects(random):
    fx = empty(15)
    place(fx, breeze(15, random, level=.038), 0)
    # Contacts are read from the displacement-driven gait at 120 Hz.
    for i, at in enumerate([.82, 1.66, 2.49, 3.31, 4.03, 4.43, 4.78, 5.12, 5.47, 5.85, 6.31]):
        place(fx, pan(stroll_step(random, .60), -.38 + .022 * i), at, .082 if at < 4 else .126)
    for at in [5.88, 6.47]:
        place(fx, pan(stroll_step(random, .32), .33), at, .115)
    place(fx, pan(whoosh(1.47, random, peak=.51, f_hi=2700), -.18), 2.78, .57)
    place(fx, pan(fades(flag_flutter(1.65, random), .08, .30), .14), 3.53, .115)
    place(fx, pan(clink(random, f0=708, dur=.14, bright=.37), .34), 6.87, .11)
    place(fx, pan(clink(random, f0=560, dur=.11, bright=.28), .02), 9.23, .068)
    place(fx, pan(whoosh(1.52, random, peak=.46, f_hi=1900), .26), 10.89, .36)
    place(fx, pan(fades(flag_flutter(1.15, random), .15, .30), .30), 11.44, .10)
    return fades(fx, .08, .61)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("output", type=Path)
    parser.add_argument("--espeak", default="espeak-ng")
    parser.add_argument("--voice-data-parent", type=Path)
    parser.add_argument("--no-voice", action="store_true")
    parser.add_argument("--continuity", action="store_true")
    args = parser.parse_args()
    args.output.mkdir(parents=True, exist_ok=True)
    duration = 15 if args.continuity else DURATION
    lines = CONTINUITY_LINES if args.continuity else LINES
    voice, duck = make_voice(args, duration, lines, 171 if args.continuity else 182)
    music = score(rng(391), args.continuity)
    fx = (continuity_effects if args.continuity else effects)(rng(237))
    mix = voice + music * (1 - .48 * duck) + fx * (1 - .26 * duck)
    mix = norm_to(mix, -16, mode="integrated")
    mix *= min(1, .87 / np.max(np.abs(mix)))
    for name, track in [("mix", mix), ("voice", voice), ("music", music), ("effects", fx)]:
        write_wav(str(args.output / f"{name}.wav"), track)
    print(f"Mix: {duration}s, 48 kHz stereo, {integrated(mix):.1f} LUFS")


if __name__ == "__main__":
    main()
