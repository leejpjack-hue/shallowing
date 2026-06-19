# CLAUDE.md — Lumière Shadowing (French & Japanese)

Guidance for Claude Code working in this repo. Read this first.

## What this is
A self-study language app for **shadowing** (listen → repeat → get pronunciation feedback) in French and Japanese. Two apps share one Vite build:

- `/` — **Lumière**: the original short-story shadowing app (Firebase-auth-gated: Google sign-in or Guest). Reference/teacher audio, writing practice, conversation practice, story images.
- `/novels.html` — **Novel Shadowing · 100 Days**: read & shadow famous public-domain novels, one ~200–300 word passage a day for 100 days. **No auth.** 🇫🇷 *Manon Lescaut* (love), 🇯🇵 *銀河鉄道の夜 / Night on the Galactic Railroad* (isekai/other-world).

## Stack
React 19 + Vite 6 + Tailwind (via CDN in the HTML files, **not** a build step) + Firebase (Auth + Firestore) + recharts + lucide-react. Node/Express 5 server (`server.cjs`). TypeScript, but type errors in `App.tsx`/`constants.ts`/`novels.tsx` (class-component `state`/`props`, `N3` level) are **pre-existing** and don't break the esbuild-based `vite build` — don't "fix" them unless asked.

## Architecture (important)
**No API key ships to the browser.** All Gemini calls go through a server-side proxy:
- `server.cjs` (CommonJS, run by **PM2** as `french-shadowing` on port 3002) serves `dist` **and** exposes `POST /api/novels/*` and `/api/orig/*` routes.
- `server-gemini.mjs` (ESM, dynamically imported by server.cjs) does every Gemini call (TTS reference/teacher, analysis, translation/vocab, writing, correction, conversation feedback, chat, image). It reads `GEMINI_API_KEY` from **`.env.local` (gitignored)** via `novels/_keys.mjs`.
- Client services `novels/novelServices.ts` and `services/geminiService.ts` only `fetch('/api/...')` — never import `@google/genai`, never reference `process.env.API_KEY`.
- `vite.config.ts` has **no `define`** for `API_KEY` (build-time inlining was removed). Dev proxies `/api` → `:3003`.
- `.env.local` holds `GEMINI_API_KEY` and `GLM_API_KEY`. Never commit it (`.gitignore` `*.local` covers it). The PAT for the GitHub remote is **not** stored anywhere — pass it in the push URL only.

## Build & deploy
- **Code (client)**: `npm run build` → `dist`. PM2 serves it at request time, so a rebuild deploys immediately (no restart).
- **Server changes** (`server.cjs` / `server-gemini.mjs`): `pm2 restart french-shadowing`.
- `vite.config.ts` sets `build.emptyOutDir: false` so mid-session rebuilds don't 404 cached asset hashes. To wipe stale (possibly key-bearing) assets, run `rm -rf dist && npm run build`.
- Multi-page build: inputs are `index.html` + `novels.html`.
- Verify a change server-side: `curl -s -X POST http://localhost:3002/api/novels/meta -H 'Content-Type: application/json' -d '{"day":1,"text":"Bonjour.","lang":"french","novelTitle":"T"}'`.
- Always SSR-verify new React code before deploying (see bottom).

## Novel content pipeline (`novels/`)
Real public-domain text, chunked into 100 daily passages. Translations/grammar/examples generated; furigana is **deterministic** (kuroshiro).
- `_raw/{fr,jp}_chunks.json` — 100 daily passages (source of truth).
- `_raw/{fr,jp}_meta.json` — translations + vocabulary (Gemini→GLM).
- `_raw/{fr,jp}_enrich.json` — paragraphs, grammar, vocabulary-with-examples, furiganaParagraphs.
- `gen_meta.mjs` — translations/vocab (Gemini primary, GLM `glm-4.5-flash` backup; resumable; self-locks `/tmp/gen_meta.lock`).
- `enrich_meta.mjs` — grammar/vocab-examples/paragraphs from the LLM **+ furigana from kuroshiro** (not the LLM). Self-locks `/tmp/enrich_meta.lock`. A day is "pending" if it lacks grammar OR vocabulary.
- `kuroshiro_helper.cjs` — deterministic furigana → `漢字[かんじ]` for **every** kanji (GLM misses ~25%).
- `gen_furigana.cjs` — one-off: regenerate furiganaParagraphs (+ paragraphs) for all JP days.
- `build_data.mjs` — merge `_raw` → `novels/novelData.ts` (run after any `_raw` change, before `vite build`).
- `fill.sh` — `gen_meta` + `enrich_meta` + rebuild + redeploy (the recurring task uses this).

## TTS strategy (a core requirement)
Gemini TTS is primary; on any quota/error the novels page auto-falls-back to the browser `speechSynthesis` voice and sets a session `geminiExhausted` flag. Toggle: Auto / Gemini / Browser. **Teacher mode always uses the browser voice** (it's many short bilingual calls — word, then English meaning, then sentences). Browser voice picker (`novelServices.ts scoreVoice`) prefers **high-quality female** voices (FR: Amelie/Marie/Google français; JP: Kyoko/Hattori/Google 日本語) — user is on Mac/iPhone and wants a lady's voice.

## Quota reality
Gemini free tier ≈ **5 RPM** (both `gemini-2.5-flash` and `-flash-lite`). GLM `glm-4.5-flash` has its own rate limit (error **1302**) but is more generous. For bulk generation use GLM (`/tmp/gen_provider.txt` = `glm`) with concurrency ~2–3; never assume Gemini has capacity. `npm audit` will flag vuln deps — not a blocker.

## Working in this repo — do / don't
- **Do** keep all Gemini calls behind `/api`. **Don't** re-introduce `new GoogleGenAI` or `process.env.API_KEY` in client code.
- **Do** run `node novels/build_data.mjs` after editing `_raw`, then `npm run build`.
- **Do** SSR-verify React changes: bundle with `esbuild --platform=node --define:process.env.API_KEY='"x"'` and `renderToString` (shim `localStorage`, `window.speechSynthesis`, `navigator.mediaDevices`).
- **Don't** run `gen_meta.mjs` and `enrich_meta.mjs` at once (different locks, but they share `_raw` JSON writes). The locks prevent same-script concurrency.
- Background `node` in this sandbox sometimes dies with exit **144**; prefer `nohup … &` inside a normal Bash call or the harness `run_in_background`, or batched foreground runs. `process.env`/`process.argv` are **undefined** in this sandbox's Node — read config from files (`/tmp/*`) and keys from `.env.local`.
- Secrets: never hard-code keys in committed source. They live in `.env.local`.

## GitHub
Remote: `https://github.com/leejpjack-hue/shallowing.git` (branch `main`). Push with the PAT in the URL (don't store it): `git push https://ghp_…@github.com/leejpjack-hue/shallowing.git HEAD:main`. Commit messages end with `Co-Authored-By: Claude <noreply@anthropic.com>`.
