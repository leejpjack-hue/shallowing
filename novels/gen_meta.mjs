// Pre-generate translations, vocabulary and day titles for each chunk.
// Provider strategy: try Gemini flash-lite; if its (very tight) free-tier quota
// is exhausted, fall back to GLM glm-4.5-flash (Zhipu, OpenAI-compatible) so we
// never block on Google. Resumable; writes incrementally; skips done days.
import { GoogleGenAI, Type } from "@google/genai";
import { readFileSync, writeFileSync, existsSync, unlinkSync } from "fs";
import { GEMINI_KEY, GLM_KEY } from "./_keys.mjs";

// Guard against concurrent runs (they'd corrupt the shared _raw JSON).
const LOCK = "/tmp/gen_meta.lock";
if (existsSync(LOCK)) {
  console.log("Another gen run is in progress (lock exists). Exiting.");
  try { process.exit(0); } catch {}
}
writeFileSync(LOCK, String(Date.now()));
const releaseLock = () => { try { unlinkSync(LOCK); } catch {} };

const ai = new GoogleGenAI({ apiKey: GEMINI_KEY });
const GEMINI_MODEL = "gemini-2.5-flash-lite";

const GLM_URL = "https://open.bigmodel.cn/api/paas/v4/chat/completions";
const GLM_MODEL = "glm-4.5-flash";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const RAW = "/home/jack/french-shadowing/novels/_raw";

// Provider can be forced via /tmp/gen_provider.txt: 'glm' | 'gemini' | 'auto'
let provider = (() => {
  try { return (readFileSync("/tmp/gen_provider.txt", "utf-8").trim() || "auto"); }
  catch { return "auto"; }
})();

function loadChunks(file) { return JSON.parse(readFileSync(file, "utf-8")); }
function loadMeta(file) {
  if (!existsSync(file)) return {};
  try { return JSON.parse(readFileSync(file, "utf-8")); } catch { return {}; }
}

function buildPrompt(chunk, novel) {
  const isFr = novel.language === "french";
  const phonInstruction = isFr ? "phonetic MUST be IPA notation (e.g. /ʁe.vɛj/)" : "phonetic MUST be Hepburn romaji";
  return `You are a meticulous literary translator and language teacher.
Below is Day ${chunk.day} of the famous ${isFr ? "French" : "Japanese"} novel "${novel.title}" (${novel.author}).
Translate the passage into natural, faithful English, give it a short descriptive English title (3-6 words), and pick 5-6 key vocabulary items useful for a learner. ${phonInstruction}.

Passage (Day ${chunk.day}):
"""
${chunk.text}
"""

Respond strictly as JSON with exactly these fields:
{"dayTitle": string, "translation": string, "vocabulary": [{"word": string, "phonetic": string, "translation": string}]}`;
}

const VOCAB_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    dayTitle: { type: Type.STRING },
    translation: { type: Type.STRING },
    vocabulary: {
      type: Type.ARRAY,
      items: { type: Type.OBJECT, properties: {
        word: { type: Type.STRING }, phonetic: { type: Type.STRING }, translation: { type: Type.STRING } },
        required: ["word", "phonetic", "translation"] }
    }
  },
  required: ["dayTitle", "translation", "vocabulary"]
};

function parseResult(txt) {
  if (!txt) throw new Error("empty response");
  // strip code fences if present
  const m = txt.match(/\{[\s\S]*\}/);
  const obj = JSON.parse(m ? m[0] : txt);
  if (!obj || !obj.translation || !Array.isArray(obj.vocabulary)) throw new Error("bad shape");
  return obj;
}

async function genGemini(chunk, novel) {
  const resp = await ai.models.generateContent({
    model: GEMINI_MODEL,
    contents: [{ parts: [{ text: buildPrompt(chunk, novel) }] }],
    config: { responseMimeType: "application/json", responseSchema: VOCAB_SCHEMA },
  });
  return parseResult(resp.text);
}

async function genGLM(chunk, novel) {
  const r = await fetch(GLM_URL, {
    method: "POST",
    headers: { "Authorization": `Bearer ${GLM_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: GLM_MODEL,
      messages: [{ role: "user", content: buildPrompt(chunk, novel) }],
      response_format: { type: "json_object" },
      temperature: 0.2,
    }),
  });
  if (!r.ok) {
    const t = await r.text().catch(() => "");
    throw new Error(`GLM HTTP ${r.status}: ${t.slice(0, 160)}`);
  }
  const data = await r.json();
  const content = data?.choices?.[0]?.message?.content;
  return parseResult(content);
}

function isQuotaError(e) {
  const m = (e.message || "").toLowerCase();
  return /429|resource_exhausted|quota|rate limit|1113|余额|exceeded/i.test(m);
}

/** Dispatch with provider fallback. Flips `provider` to 'glm' on Gemini quota. */
async function dispatch(chunk, novel) {
  if (provider === "glm") return genGLM(chunk, novel);
  if (provider === "gemini") return genGemini(chunk, novel);
  // auto
  try {
    return await genGemini(chunk, novel);
  } catch (e) {
    if (isQuotaError(e)) {
      console.log("  (Gemini quota exhausted — switching to GLM for the rest of this run)");
      provider = "glm";
      return genGLM(chunk, novel);
    }
    throw e;
  }
}

async function probeGemini() {
  try {
    await ai.models.generateContent({ model: GEMINI_MODEL, contents: "ok" });
    return true;
  } catch (e) {
    return !isQuotaError(e); // non-quota error: assume available; quota: unavailable
  }
}

async function process(novelFile, metaFile, label) {
  const data = loadChunks(`${RAW}/${novelFile}`);
  const novel = data.novel;
  const meta = loadMeta(`${RAW}/${metaFile}`);
  const chunks = data.chunks;
  const MAX_PER_RUN = (() => { try { return parseInt(readFileSync("/tmp/gen_cap.txt", "utf-8").trim() || "0", 10); } catch { return 0; } })();

  let pending = chunks.filter((c) => !meta[String(c.day)]);
  if (MAX_PER_RUN) pending = pending.slice(0, MAX_PER_RUN);
  if (pending.length === 0) { console.log(`[${label}] nothing pending (${Object.keys(meta).length}/${chunks.length} done)`); return; }

  // Decide provider up-front when auto: probe Gemini once.
  if (provider === "auto") {
    const ok = await probeGemini();
    provider = ok ? "gemini" : "glm";
    console.log(`[${label}] provider=${provider} (auto-probed)`);
  }
  const CONC = provider === "glm" ? 2 : 1;        // GLM rate-limits; keep concurrency modest
  const GAP = provider === "glm" ? 1500 : 12500;  // GLM light throttle; Gemini under 5/min

  let idx = 0, produced = 0, failed = 0;
  const save = () => writeFileSync(`${RAW}/${metaFile}`, JSON.stringify(meta, null, 1));

  async function worker() {
    while (idx < pending.length) {
      const my = idx++;
      const c = pending[my];
      let lastErr;
      for (let attempt = 0; attempt < 4; attempt++) {
        try {
          const r = await dispatch(c, novel);
          meta[String(c.day)] = { day: c.day, ...r };
          produced++;
          if (produced % 5 === 0) { save(); console.log(`[${label}] +${produced}/${pending.length} this run`); }
          lastErr = null;
          break;
        } catch (e) {
          lastErr = e;
          const msg = (e.message || "");
          if (/1302|429|rate|速率|limit/i.test(msg)) {
            await sleep(20000); // back off on rate-limit, then retry this chunk
          } else {
            await sleep(3000);
            break; // non-rate-limit error: give up on this chunk (resumable later)
          }
        }
      }
      if (lastErr) { failed++; console.error(`[${label}] Day ${c.day} FAILED: ${(lastErr.message || "").slice(0, 140)}`); }
      if (GAP) await sleep(GAP);
    }
  }
  await Promise.all(Array.from({ length: CONC }, () => worker()));
  save();
  console.log(`[${label}] DONE +${produced} (${failed} failed) -> ${Object.keys(meta).length}/${chunks.length} total`);
}

(async () => {
  try {
    await process("fr_chunks.json", "fr_meta.json", "FR");
    await process("jp_chunks.json", "jp_meta.json", "JP");
    console.log("ALL DONE");
  } catch (e) {
    console.error("FATAL", e);
  } finally {
    releaseLock();
    try { process.exit(0); } catch {}
  }
})();
