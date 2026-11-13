#!/bin/zsh
# Cuts the story clips and their posters from the trailer recordings (1920x1080).
# Usage: zsh scripts/make-clips.sh "<recordings folder>"
set -e
SRC=$1
OUT="${0:A:h}/../public/videos"
mkdir -p "$OUT"

# The crop leaves out the menu bar, Photoshop's title and options bars, the empty left side and the Dock.
VF="crop=1720:926:200:92,scale=1440:-2,fps=30,format=yuv420p"
# The web version was filmed wider, in a browser: this crop leaves out its tabs and bookmarks.
VF_WEB="crop=1872:988:296:92,scale=1440:-2,fps=30,format=yuv420p"
# Holds the last frame before the loop, so the result can be read.
HOLD="tpad=stop_mode=clone:stop_duration=1.2"
ENC=(-an -c:v libx264 -preset slow -crf 28 -movflags +faststart)

# name, recording, speed, then the kept segments as start:end in seconds
clip() {
  local name=$1 src=$2 speed=$3; shift 3
  local fc="" labels="" i=0
  for seg in "$@"; do
    fc+="[0:v]trim=${seg%%:*}:${seg##*:},setpts=PTS-STARTPTS[s$i];"
    labels+="[s$i]"; i=$((i+1))
  done
  fc+="${labels}concat=n=$i:v=1:a=0,setpts=PTS/${speed},${CLIP_VF:-$VF},${HOLD}[v]"
  ffmpeg -v error -y -i "$SRC/$src" -filter_complex "$fc" -map "[v]" "${ENC[@]}" "$OUT/$name.mp4"
  local duration=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$OUT/$name.mp4")
  ffmpeg -v error -y -ss $((duration-0.3)) -i "$OUT/$name.mp4" -frames:v 1 -q:v 5 "$OUT/$name.jpg"
}

clip click-paste "click paste.mp4" 1.5 2:27.5
clip bubbles "triple bubble + center double bubble.mp4" 1.25 0.5:15
clip textshaper "textshaper.mp4" 1.2 0:13.5
# The gaps skip the macOS file dialog, which shows personal files, and the pages flicking by during the scan.
clip fonts "font findr and font scanr.mp4" 1.6 6:8 15.4:25.5 72:80
clip tabs "tab.mp4" 1.15 0:6.6 10.2:12.5

# The news post. The learning clip stops before the macOS file dialog of the export.
mkdir -p "$OUT/news"
clip news/textshaper-learning "textshaper learning and export learning.mp4" 1.25 0:8
CLIP_VF=$VF_WEB clip news/web "TypeR web.mp4" 1.2 0:12.5
