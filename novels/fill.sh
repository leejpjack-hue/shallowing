#!/bin/bash
# Generate more novel translations (Gemini primary, GLM glm-4.5-flash backup so we
# never block on Google quota) and redeploy if progress was made.
# gen_meta.mjs is resumable (skips done days) and self-locks against concurrent runs.
cd /home/jack/french-shadowing || exit 1

count() { python3 -c "import json,os;f='novels/_raw/$1';print(len(json.load(open(f))) if os.path.exists(f) else 0)" 2>/dev/null; }

FR0=$(count fr_meta.json); JP0=$(count jp_meta.json)
echo "[fill] before: FR=$FR0 JP=$JP0"

# Optional cap via /tmp/gen_cap.txt (absent = unlimited). Provider via /tmp/gen_provider.txt (absent = auto).
timeout 540 node novels/gen_meta.mjs > /tmp/fill_run.log 2>&1
rm -f /tmp/gen_cap.txt /tmp/gen_provider.txt

FR1=$(count fr_meta.json); JP1=$(count jp_meta.json)
echo "[fill] after:  FR=$FR1 JP=$JP1"

if [ "$FR1" -gt "$FR0" ] || [ "$JP1" -gt "$JP0" ]; then
  echo "[fill] progress -> rebuilding data + deploying"
  node novels/build_data.mjs > /tmp/fill_build.log 2>&1
  npx vite build > /tmp/fill_vite.log 2>&1
  echo "[fill] deployed FR=$FR1/100 JP=$JP1/100"
else
  echo "[fill] no progress"
fi
