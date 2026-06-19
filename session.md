# session.md — what changed & what's next

Running log of work on Lumière Shadowing. Newest first. Update this when you make changes.

## Current state (2026-06-19)
- **Two apps**, one Vite build: `/` (original Lumière, Firebase-auth-gated) and `/novels.html` (100-day Novel Shadowing, no auth).
- **Deployed live** at `app4.teqcon.uk`, served by PM2 (`french-shadowing`, `server.cjs`, port 3002).
- **Pushed to GitHub** `main`: https://github.com/leejpjack-hue/shallowing
- **Gemini key is NOT in the browser bundle** — all calls go through `/api` → `server-gemini.mjs` (key in gitignored `.env.local`). Verified: `grep -rl AIzaSy dist/` → nothing.

### Novel content data (`novels/_raw/`)
| | translations | grammar+vocab | furigana (every kanji) |
|---|---|---|---|
| 🇫🇷 FR (Manon Lescaut) | 100/100 | 100/100 | n/a |
| 🇯🇵 JP (銀河鉄道の夜) | 100/100 | ~84/100 *(still filling)* | 100/100 ✅ |

Furigana is **deterministic** (kuroshiro) and complete on all 100 JP days; furigana toggle defaults ON.

## What was built (this work stream)
1. **Novel Shadowing page** (`/novels.html`): 100 daily passages × 2 novels from public-domain text. Calendar (progress in localStorage), day reader.
2. **Self-learning features**: furigana (ruby, kuroshiro), grammar points, vocabulary with example sentences (tap to hear), formatted paragraphs + keyword highlighting, translation toggle, **guided Teacher lesson** (teaches key words first, then phrases), record & analyze pronunciation.
3. **TTS with browser fallback**: Auto→Gemini→browser `speechSynthesis`; high-quality **female** voice selection (Mac/iPhone). Teacher mode always browser.
4. **Server-side Gemini proxy** (`server-gemini.mjs` + `/api` routes in `server.cjs`) — removed the key from the client bundle entirely.
5. **Content pipeline** (`novels/`): `gen_meta` (translations, Gemini→GLM backup), `enrich_meta` (grammar/vocab/paragraphs + kuroshiro furigana), `build_data` (merge → `novelData.ts`), `fill.sh`, `kuroshiro_helper.cjs`, `gen_furigana.cjs`.
6. **Adversarial code review** run (workflow) → fixed: stale-audio-after-navigation, MediaRecorder/stream/speech leaks on unmount, recording-analysis landing on wrong day, Pill remounts, mode persistence, a11y labels.

## To finish JP enrichment (grammar/vocab on last ~16 days)
The recurring task (session-only cron, every ~13 min) runs `novels/fill.sh` until JP grammar hits 100/100. To do it manually / on a fresh session:
```bash
cd /home/jack/french-shadowing
rm -f /tmp/enrich_meta.lock
bash novels/fill.sh          # gen_meta + enrich_meta + rebuild + redeploy
# repeat until "JP grammar 100/100"; then push:
git add -A && git commit -m "enrich: JP complete" && \
  git push https://ghp_…@github.com/leejpjack-hue/shallowing.git HEAD:main
```
Status check:
```bash
python3 -c "import json;e=json.load(open('novels/_raw/jp_enrich.json'));print(sum(1 for d in e.values() if d.get('grammar')),'/100 JP grammar')"
```

## Known follow-ups / ideas
- `/api/*` routes are **not auth-gated** (same exposure shape as the old in-browser key). Could add Firebase-session checks or rate limiting.
- `npm audit` reports dependency vulns (dev-only / not blocking).
- Original app's `generateStoryImage` no longer client-side-compresses before Firestore (1 MB limit) — image gen is rarely used & quota-limited; low priority.
- The novels page has no auth; if it should be private, gate it like Lumière.

## Key files
- `App.tsx` — original app shell (login → menu → practice/writing/conversation).
- `novels/NovelsApp.tsx`, `novels/NovelReader.tsx`, `novels/Passage.tsx`, `novels/useShadowingAudio.ts`, `novels/novelServices.ts`, `novels/novelData.ts` (generated).
- `services/geminiService.ts` (original app, now fetches `/api/orig/*`), `novels/novelServices.ts` (novels, fetches `/api/novels/*`).
- `server.cjs` + `server-gemini.mjs` — the API proxy.
- `novels/_keys.mjs` — loads keys from `.env.local` for server-side scripts.
