#!/bin/bash
# Generate/refresh BOTH translations (gen_meta) and enrichment — furigana,
# grammar, examples, paragraphs (enrich_meta) — then rebuild + redeploy if
# anything progressed. Both are resumable (skip done days) and self-lock.
# Provider: Gemini primary, GLM glm-4.5-flash backup (so we never block on quota).
cd /home/jack/french-shadowing || exit 1

count() { python3 -c "import json,os;f='novels/_raw/$1';print(len(json.load(open(f))) if os.path.exists(f) else 0)" 2>/dev/null; }
before=$(($(count fr_meta.json)+$(count jp_meta.json)+$(count fr_enrich.json)+$(count jp_enrich.json)))
echo "[fill] before totals: meta $(($(count fr_meta.json)+$(count jp_meta.json))) enrich $(($(count fr_enrich.json)+$(count jp_enrich.json)))"

rm -f /tmp/gen_cap.txt /tmp/gen_provider.txt
timeout 560 node novels/gen_meta.mjs   > /tmp/fill_gen.log   2>&1
timeout 560 node novels/enrich_meta.mjs > /tmp/fill_enrich.log 2>&1
rm -f /tmp/gen_cap.txt /tmp/gen_provider.txt

after=$(($(count fr_meta.json)+$(count jp_meta.json)+$(count fr_enrich.json)+$(count jp_enrich.json)))
echo "[fill] after totals:  meta $(($(count fr_meta.json)+$(count jp_meta.json))) enrich $(($(count fr_enrich.json)+$(count jp_enrich.json)))"

if [ "$after" -gt "$before" ]; then
  echo "[fill] progress -> rebuilding + deploying"
  node novels/build_data.mjs > /tmp/fill_build.log 2>&1
  npx vite build > /tmp/fill_vite.log 2>&1
  echo "[fill] deployed"
else
  echo "[fill] no progress this run"
fi
