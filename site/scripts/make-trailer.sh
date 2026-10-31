#!/bin/zsh
# Compresses the trailer for the site, with its poster. GitHub refuses files over 100 MB and warns from 50 MB.
# Usage: zsh scripts/make-trailer.sh "<trailer render>"
set -e
SRC=$1
OUT="${0:A:h}/../public/videos"
COMMON=(-pix_fmt yuv420p -c:a aac -b:a 192k -movflags +faststart)

# Chosen by VMAF against the render, over the whole trailer: 95.5 on average for AV1, 92.1 for H.264.
ffmpeg -v error -y -i "$SRC" -c:v libsvtav1 -preset 5 -crf 42 -svtav1-params tune=0 "${COMMON[@]}" "$OUT/trailer-av1.mp4"
ffmpeg -v error -y -i "$SRC" -c:v libx264 -preset veryslow -crf 27 -x264-params aq-mode=3 "${COMMON[@]}" "$OUT/trailer.mp4"
# The title card, once "The biggest update TypeR has ever had" has appeared.
ffmpeg -v error -y -ss 15.5 -i "$SRC" -frames:v 1 -q:v 4 "$OUT/trailer.jpg"
