# Claude Animated Shorts

The free Claude skill from the video **"How to Make Viral Animated Shorts Using Claude (Full Workflow)"**.

It makes 55-70 s vertical animated story shorts: 2D characters in a colourful 3D world, with ink outlines, a painted town, lens blur, gliding cameras, a march score and sound effects. Everything is rendered with three.js inside Remotion on your own PC, with no AI video generator.

Proven on **The Bridge That Fell for a Song**, a 67 s short about the 1831 Broughton bridge.

## What's inside
| Path | What it is |
|---|---|
| `SKILL.md` | The skill: the full pipeline, every rule, every fix, and the final look values |
| `templates/bridge/` | The full source of the bridge short: world, characters, ink, lens blur, grade, story/camera |
| `templates/audio/` | The synthesized sound: SFX, march music, the mix with ducking and loudness |
| `templates/scripts/` | Stills, side-by-side sheets, shot merge and frame-by-frame QA helpers |
| `references/STYLE_BIBLE.md` | The script and visual formula measured from 20 reference shorts |
| `references/reports/` | Seven measured reports: motion, depth, textures, characters, lighting, outlines, grade |
| `references/frames/` | 38 full-size reference frames (540x960) to compare your frames against |
| `references/sheets/` | 20 contact sheets, one per reference short, 60 frames each (1,200 frames) |

## Run the Remotion app

From the repository root, use Node.js 24 and npm:

```sh
npm ci
npm run typecheck
npm run studio
```

Studio lists `BridgeShort` and `PocketEclipse`. The runtime uses the bridge scene modules directly from `templates/bridge/` and adds its canvas startup handling in `src/`. The original templates, audio tools, and skill are available in their original locations.

Render the five-second, 540 × 960 `PocketEclipse` smoke test:

```sh
npm run render:smoke
```

The script writes `out/pocket-eclipse.mp4` and uses SwiftShader through ANGLE for software WebGL. It uses Remotion's browser by default. To use the existing Chromium installation in the cloud environment:

```sh
npm run render:smoke -- --browser-executable=/usr/bin/chromium
```

To verify the bridge startup in a short render, pass the installed Chromium path as above or omit that option to use Remotion's browser:

```sh
npx remotion render src/index.tsx BridgeShort out/bridge-opening-check.mp4 \
  --frames=0-2 --scale=0.5 --props='{"post":{"dpr":0.5}}' \
  --gl=swangle --concurrency=1 --browser-executable=/usr/bin/chromium
```

Both compositions run from a clean checkout. BridgeShort uses procedural scenery when the optional Kenney models are absent. If you already have the model kit, place its GLB files in `public/bridge/kenney/` to enable those assets. The original skill documents the separate narration and audio-mixing workflow.

## Layang-Layang Pulang

A gust takes Nara's kite down a painted town street. Bu Mira catches it, returns it, and watches Nara send it up again. The 10-second composition runs at 540 × 960 and 30 fps. Its own story and street layout use the bridge template's painted houses, cobbles and vegetation, walking and facial animation, lit 2D cards, ink pass, lens blur, and grade. The town uses procedural assets and runs without a model download.

With the app dependencies installed, render the picture:

```sh
npm run render:kite
```

On the cloud machine, append `-- --browser-executable=/usr/bin/chromium` to use its installed browser. The software renderer uses SwiftShader through ANGLE.

Install `espeak-ng` with its Indonesian (`id`) voice and have FFmpeg on your path. In a Python 3.12 environment, generate the stereo mix and mux it with the picture:

```sh
python -m pip install -r src/videos/kite/requirements.txt
python src/videos/kite/sound.py out/kite/audio
ffmpeg -i out/kite/picture.mp4 -i out/kite/audio/mix.wav \
  -map 0:v:0 -map 1:a:0 -c:v copy -c:a aac -b:a 192k -movflags +faststart \
  out/kite/layang-layang-pulang.mp4
```

The sound script uses the bridge template's instrument and effects synthesizers with an original score and synchronized cues. It accepts `--espeak` and `--voice-data-parent` for a user-local eSpeak NG installation, or `--no-voice` for music and effects alone.

### 15-second continuity edit

The `LayangLayangPulang15` composition shares the painted street, light rig, character face library and post effects with the original. The original 10-second composition keeps its own story and audio settings.

| Time | Shot | Action |
| --- | --- | --- |
| 0:00–0:02.80 | Wide establishing | Nara walks through the street and flies the kite. |
| 0:02.80–0:07.70 | Character tracking | The gust pulls the reel loose. Nara runs after it and Bu Mira catches it. |
| 0:07.70–0:10.80 | Handoff close-up | Nara relaxes and takes the reel back from Bu Mira. |
| 0:10.80–0:15.00 | Final two-shot | The kite rises under tension while both watch. |

The new gait fixes each stance foot's horizontal position until the next swing. Walking and running differ in stance time, lift, arm swing and lean. The reel follows the drawn grip or its free-flight path. The kite uses a fixed 120 Hz damped simulation with gusts and a maximum tether length. Wind also moves the street pennants.

Use the same dependencies as the 10-second version:

```sh
npm ci
npm run typecheck
npm run render:kite:continuity
python -m pip install -r src/videos/kite/requirements.txt
python src/videos/kite/sound.py out/kite-continuity/audio --continuity
ffmpeg -i out/kite-continuity/picture.mp4 -i out/kite-continuity/audio/mix.wav \
  -map 0:v:0 -map 1:a:0 -c:v copy -c:a aac -b:a 192k -movflags +faststart \
  out/kite-continuity/layang-layang-pulang-15s.mp4
```

This render uses 540 × 960 at 30 fps and SwiftShader. The soundtrack uses local eSpeak NG with the Indonesian voice and a synthesized score, footsteps, gusts and reel sounds. Browser and eSpeak override options are the same as for the 10-second version.

## Install
1. Copy this folder to `~/.claude/skills/cartoon-3d-short/` (clone it there, or download the ZIP).
2. You need [Remotion](https://www.remotion.dev/) with `@remotion/three`, plus Node, Python 3 and ffmpeg.
3. In Claude Code, say: *"Use the cartoon short skill and make a short about …"*.

Claude then follows `SKILL.md`: topic and facts, then script, then voice, then the shot plan in `story.ts`, then stills, then renders. Agents check your frames against the reports and the frames, and you get the final 2K render and sound mix.

## Notes
- Set `REMOTION_TMP` to a folder on a big drive. Every Remotion bundle copies `public/` (~1.3 GB) into the temp folder.
- Story, characters and voice should always be your own. Use the references for the look, not the content.

## License
The code and docs are MIT (see `LICENSE`). The reference frames are included for style study only.
