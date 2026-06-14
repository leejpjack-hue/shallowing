# Lumière · French & Japanese Shadowing

A self-study language app for **shadowing** (listen → repeat → get feedback) in French
and Japanese. Built with React + Vite + Tailwind, Google Gemini (TTS / pronunciation
analysis) and a browser-voice fallback.

## Two apps in one build

| Route | App |
|---|---|
| `/` | **Lumière** — the original short-story shadowing app (Firebase-auth-gated): reference audio, teacher drill, writing & conversation practice. |
| `/novels.html` | **Novel Shadowing · 100 Days** — read & shadow famous public-domain novels, one ~200–300 word passage a day for 100 days. |

### Novel Shadowing page (self-learning focused)

- 🇫🇷 **French** — *Manon Lescaut* (Abbé Prévost, public domain) — a classic love story.
- 🇯🇵 **Japanese** — *銀河鉄道の夜 / Night on the Galactic Railroad* (Miyazawa Kenji, public domain) — a dreamlike journey to another world (the literary root of "isekai").
- **Furigana** (toggle) — ruby readings above every kanji (Japanese).
- **Grammar points** — 2–4 explained per day.
- **Vocabulary** — key words with IPA/romaji, meaning, **and an example sentence** (tap a card to hear it).
- **Formatted passage** — paragraph layout with **keyword highlighting** (toggle).
- **Translation** (toggle) — full English translation per day.
- **Teacher lesson** — a guided mode that *teaches like a teacher*: introduces the difficult words first (word + meaning), then reads the passage phrase by phrase with echo pauses.
- **Reference audio** — full-passage native pronunciation.
- **Record & analyze** — record yourself and get a pronunciation score + word-level feedback.
- **TTS engine** — Auto (Gemini → browser fallback), Gemini, or Browser. When Gemini's quota runs out it automatically switches to the device's high-quality **female** browser voice (Amelie / Kyoko / Google voices on Mac & iPhone).

## Content pipeline (`novels/`)

The novel text is real public-domain text, chunked into 100 daily passages. Translations,
furigana, grammar and examples are generated and embedded; the rest fill on demand (cached).

```
novels/_raw/{fr,jp}_chunks.json   # 100 daily passages from public-domain novels
novels/_raw/{fr,jp}_meta.json      # translations + vocabulary (Gemini/GLM)
novels/_raw/{fr,jp}_enrich.json    # furigana, grammar, examples, paragraphs
novels/gen_meta.mjs                # generate translations (Gemini -> GLM backup, resumable)
novels/enrich_meta.mjs             # generate furigana/grammar/examples (resumable)
novels/build_data.mjs              # merge -> novels/novelData.ts
novels/fill.sh                     # probe + generate + redeploy helper
novels/_keys.mjs                   # loads keys from .env.local (gitignored)
```

Provider strategy: try Gemini `gemini-2.5-flash-lite`; when its free-tier quota
(~5 RPM) is exhausted, fall back to **GLM `glm-4.5-flash`** (Zhipu, OpenAI-compatible)
so bulk generation never blocks. Keys live in `.env.local` (gitignored) — no secrets
in source.

## Run locally

**Prerequisites:** Node.js

```bash
npm install
# .env.local:  GEMINI_API_KEY=...   GLM_API_KEY=...
npm run dev          # http://localhost:3002  (original app)
# Novel page:  http://localhost:3002/novels.html
```

## Build & deploy

```bash
npm run build        # multi-page build -> dist/ (index.html + novels.html)
```

The live app is served by `server.cjs` (Express static on port 3002) behind a reverse
proxy. Rebuilding `dist/` deploys immediately (no restart needed).
