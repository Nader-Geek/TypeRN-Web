#!/bin/zsh
# Compresses the trailer for the site, with its poster. GitHub refuses files over 100 MB and warns from 50 MB.
# Usage: zsh scripts/make-trailer.sh "<trailer render>" "<first frame image, 1920x1080>"
set -e
SRC=$1
IMG=$2
OUT="${0:A:h}/../public/videos"
TMP=$(mktemp -d)
COMMON=(-pix_fmt yuv420p -c:a aac -b:a 192k -movflags +faststart)
AV1=(-c:v libsvtav1 -preset 5 -svtav1-params tune=0 -colorspace bt709 -color_range tv -video_track_timescale 15360 -an)

# Chosen by VMAF against the render, over the whole trailer: 95.5 on average for AV1, 92.1 for H.264.
ffmpeg -v error -y -i "$SRC" -crf 42 "${AV1[@]}" "$TMP/main.mp4"
# The image comes first, for one frame: it's the thumbnail of Discord's embed. The audio waits for it.
ffmpeg -v error -y -loop 1 -framerate 60 -i "$IMG" -frames:v 1 -vf "scale=out_color_matrix=bt709:out_range=tv,format=yuv420p" -crf 22 "${AV1[@]}" "$TMP/first.mp4"
printf "file 'first.mp4'\nfile 'main.mp4'\n" > "$TMP/list.txt"
ffmpeg -v error -y -f concat -safe 0 -i "$TMP/list.txt" -c copy "$TMP/video.mp4"
ffmpeg -v error -y -i "$TMP/video.mp4" -i "$SRC" -map 0:v -map 1:a -af adelay=17:all=1 -c:v copy -c:a aac -b:a 192k -movflags +faststart "$OUT/trailer-av1.mp4"
rm -rf "$TMP"

ffmpeg -v error -y -i "$SRC" -c:v libx264 -preset veryslow -crf 27 -x264-params aq-mode=3 "${COMMON[@]}" "$OUT/trailer.mp4"
# The title card, once "The biggest update TypeR has ever had" has appeared.
ffmpeg -v error -y -ss 15.5 -i "$SRC" -frames:v 1 -q:v 4 "$OUT/trailer.jpg"
