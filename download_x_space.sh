#!/bin/bash
# download_x_space.sh
#
# Download an X Space as an MP3 using yt-dlp.
#
# Usage:
#   chmod +x download_x_space.sh
#   ./download_x_space.sh "https://x.com/basilthegreat/status/..."
#
# One-liner alternative:
#   yt-dlp -x --audio-format mp3 "YOUR_URL_HERE"
#
# Notes:
#   - Install yt-dlp with: pip install yt-dlp  or  brew install yt-dlp
#   - Some Spaces require login — add --cookies-from-browser chrome (or firefox, safari)
#   - Spaces are only available while live or during the replay window (~30 days)
#   - Run yt-dlp -U to update if you hit errors

URL="$1"

if [ -z "$URL" ]; then
  echo "Usage: $0 <url>"
  exit 1
fi

yt-dlp \
  --extract-audio \
  --audio-format mp3 \
  --audio-quality 0 \
  --output "%(title)s.%(ext)s" \
  "$URL"
