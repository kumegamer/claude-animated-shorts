#!/usr/bin/env bash
# Render 45 frames (1.5 seconds) from the 15-second kite composition with its local soundtrack.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."

output=out/kite-smoke
mkdir -p "$output"
render_args=()
voice_args=()
if [[ -n "${BROWSER_EXECUTABLE:-}" ]]; then
  render_args+=(--browser-executable="$BROWSER_EXECUTABLE")
fi
if [[ -n "${ESPEAK_NG:-}" ]]; then
  voice_args+=(--espeak "$ESPEAK_NG")
fi
if [[ -n "${ESPEAK_DATA_PARENT:-}" ]]; then
  voice_args+=(--voice-data-parent "$ESPEAK_DATA_PARENT")
fi

./node_modules/.bin/remotion render src/index.tsx LayangLayangPulang15 "$output/picture.mp4" \
  --frames=0-44 --codec=h264 --crf=18 --pixel-format=yuv420p --gl=swangle \
  --concurrency=2 --timeout=120000 "${render_args[@]}"
"${PYTHON:-python3}" src/videos/kite/sound.py "$output/audio" --continuity "${voice_args[@]}"
ffmpeg -nostdin -loglevel error -y -i "$output/picture.mp4" -i "$output/audio/mix.wav" \
  -map 0:v:0 -map 1:a:0 -t 1.5 -c:v copy -c:a aac -b:a 192k -movflags +faststart \
  "$output/layang-layang-pulang-smoke.mp4"
ffprobe -v error -show_entries \
  stream=codec_type,codec_name,width,height,r_frame_rate,nb_frames,sample_rate,channels:format=duration \
  -of json "$output/layang-layang-pulang-smoke.mp4"
