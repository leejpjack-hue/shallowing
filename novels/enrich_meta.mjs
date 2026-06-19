// Enrich each day with self-study aids: furigana (JP, via deterministic
// kuroshiro — EVERY kanji annotated), grammar points, vocabulary with example
// sentences, and paragraph segmentation. Reads existing translations from
// _raw/*_meta.json for context. Provider: Gemini -> GLM backup.
// Resumable; writes _raw/{fr,jp}_enrich.json incrementally; self-locks.
import { GoogleGenAI, Type } from "@google/genai";
import { readFileSync, writeFileSync, existsSync, unlinkSync } from "fs";
import { createRequire } from "module";
import { GEMINI_KEY, GLM_KEY } from "./_keys.mjs";

// kuroshiro is CommonJS; import its helper for deterministic furigana.
const require = createRequire(import.meta.url);
const { toFurigana } = require("./kuroshiro_helper.cjs");

const LOCK = "/tmp/enrich_meta.lock";
if (existsSync(LOCK)) { console.log("Enrich already running. Exiting."); try { process.exit(0); } catch {} }
writeFileSync(LOCK, String(Date.now()));
const releaseLock = () => { try { unlinkSync(LOCK); } catch {} };

const ai = new GoogleGenAI({ apiKey: GEMINI_KEY });
const GEMINI_MODEL = "gemini-2.5-flash-lite";
const GLM_URL = "https://open.bigmodel.cn/api/paas/v4/chat/completions";
const GLM_MODEL = "glm-4.5-flash";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const RAW = "/home/jack/french-shadowing/novels/_raw";

// Default to GLM for bulk enrichment: Gemini's free-tier quota (5 RPM) can't
// sustain a 200-call job. Override via /tmp/gen_provider.txt ("auto"|"gemini"|"glm").
let provider = (() => { try { return readFileSync("/tmp/gen_provider.txt", "utf-8").trim() || "glm"; } catch { return "glm"; } })();

function loadJSON(file, fallback) { try { return JSON.parse(readFileSync(file, "utf-8")); } catch { return fallback; } }

function buildPrompt(chunk, novel, translation) {
  const isFr = novel.language === "french";
  const langName = isFr ? "French" : "Japanese";
  const phonRule = isFr ? "IPA notation (e.g. /ʁe.vɛj/)" : "Hepburn romaji";
  return `You are an expert ${langName} language teacher preparing a self-study lesson for Day ${chunk.day} of the novel "${novel.title}".

Passage:
"""
${chunk.text}
"""
English translation (for your reference):
"""
${translation || "(n/a)"}
"""

Produce a JSON object with EXACTLY these fields:
{
  "paragraphs": [the passage split into 2-4 natural paragraphs; joining them in order must reproduce the original passage faithfully],
  "grammar": [2 to 4 grammar points that appear in this passage; each {"point": "the pattern as it appears (e.g. ${isFr ? "il faut que + subjonctif" : "〜てしまう"} )", "explanation": "a clear, concise explanation in English for a self-learner"}],
  "vocabulary": [5 to 6 key or difficult words FROM this passage; each {"word": "...", "phonetic": "${phonRule}", "translation": "concise English meaning", "example": "a NEW short ${langName} example sentence that uses this word naturally", "exampleTranslation": "English translation of the example"}]
}

Return STRICT JSON only. No markdown, no commentary.`;
}

function parseResult(txt) {
  if (!txt) throw new Error("empty response");
  const m = txt.match(/\{[\s\S]*\}/);
  const obj = JSON.parse(m ? m[0] : txt);
  if (!obj || !Array.isArray(obj.paragraphs) || !Array.isArray(obj.grammar) || !Array.isArray(obj.vocabulary))
    throw new Error("bad shape");
  return obj;
}

const ENRICH_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    paragraphs: { type: Type.ARRAY, items: { type: Type.STRING } },
    grammar: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: {
      point: { type: Type.STRING }, explanation: { type: Type.STRING } }, required: ["point", "explanation"] } },
    vocabulary: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: {
      word: { type: Type.STRING }, phonetic: { type: Type.STRING }, translation: { type: Type.STRING },
      example: { type: Type.STRING }, exampleTranslation: { type: Type.STRING } },
      required: ["word", "phonetic", "translation", "example", "exampleTranslation"] } },
  },
  required: ["paragraphs", "grammar", "vocabulary"],
};

async function genGemini(chunk, novel, tr) {
  const r = await ai.models.generateContent({ model: GEMINI_MODEL, contents: [{ parts: [{ text: buildPrompt(chunk, novel, tr) }] }],
    config: { responseMimeType: "application/json", responseSchema: ENRICH_SCHEMA } });
  return parseResult(r.text);
}
async function genGLM(chunk, novel, tr) {
  const r = await fetch(GLM_URL, { method: "POST", headers: { Authorization: `Bearer ${GLM_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: GLM_MODEL, messages: [{ role: "user", content: buildPrompt(chunk, novel, tr) }], response_format: { type: "json_object" }, temperature: 0.3 }) });
  if (!r.ok) { const t = await r.text().catch(() => ""); throw new Error(`GLM HTTP ${r.status}: ${t.slice(0, 140)}`); }
  const d = await r.json();
  return parseResult(d?.choices?.[0]?.message?.content);
}
function isQuota(e) { return /429|resource_exhausted|quota|rate limit|1113|1302|余额|速率|exceeded/i.test((e.message || "")); }

async function dispatch(chunk, novel, tr) {
  if (provider === "glm") return genGLM(chunk, novel, tr);
  // provider is "gemini" or "auto" — try Gemini, fall back to GLM on quota.
  try { return await genGemini(chunk, novel, tr); }
  catch (e) { if (isQuota(e)) { console.log("  (Gemini quota -> GLM)"); provider = "glm"; return genGLM(chunk, novel, tr); } throw e; }
}
async function probeGemini() { try { await ai.models.generateContent({ model: GEMINI_MODEL, contents: "ok" }); return true; } catch (e) { return !isQuota(e); } }

async function process(novelFile, metaFile, enrichFile, label) {
  const data = loadJSON(`${RAW}/${novelFile}`, null);
  const novel = data.novel;
  const meta = loadJSON(`${RAW}/${metaFile}`, {});
  const enrich = loadJSON(`${RAW}/${enrichFile}`, {});
  const chunks = data.chunks;
  const MAX = (() => { try { return parseInt(readFileSync("/tmp/enrich_cap.txt", "utf-8").trim() || "0", 10); } catch { return 0; } })();
  // A day is pending if it has no entry OR is missing grammar/vocabulary
  // (gen_furigana may have added paragraphs+furigana without grammar/vocab).
  const hasGrammarVocab = (e) => Array.isArray(e?.grammar) && e.grammar.length && Array.isArray(e?.vocabulary) && e.vocabulary.length;
  let pending = chunks.filter((c) => !hasGrammarVocab(enrich[String(c.day)]));
  if (MAX) pending = pending.slice(0, MAX);
  if (!pending.length) { console.log(`[${label}] nothing to enrich (${Object.keys(enrich).length}/${chunks.length})`); return; }
  if (provider === "auto") { provider = (await probeGemini()) ? "gemini" : "glm"; console.log(`[${label}] provider=${provider}`); }
  const CONC = provider === "glm" ? 3 : 1;
  const GAP = provider === "glm" ? 1200 : 12500;
  let idx = 0, produced = 0, failed = 0;
  const save = () => writeFileSync(`${RAW}/${enrichFile}`, JSON.stringify(enrich, null, 1));
  async function worker() {
    while (idx < pending.length) {
      const c = pending[idx++];
      let lastErr;
      for (let a = 0; a < 4; a++) {
        try {
          const r = await dispatch(c, novel, meta[String(c.day)]?.translation);
          // Furigana is computed deterministically via kuroshiro (every kanji),
          // not by the LLM. Japanese only; French gets an empty array.
          if (novel.language === "japanese") {
            r.furiganaParagraphs = await Promise.all(
              (r.paragraphs || []).map((p) => toFurigana(p).catch(() => p))
            );
          } else {
            r.furiganaParagraphs = [];
          }
          enrich[String(c.day)] = { day: c.day, ...r };
          produced++;
          if (produced % 5 === 0) { save(); console.log(`[${label}] +${produced}/${pending.length}`); }
          lastErr = null; break;
        } catch (e) {
          lastErr = e;
          if (isQuota(e)) await sleep(20000); else { await sleep(3000); break; }
        }
      }
      if (lastErr) { failed++; console.error(`[${label}] Day ${c.day} FAILED: ${(lastErr.message || "").slice(0, 140)}`); }
      if (GAP) await sleep(GAP);
    }
  }
  await Promise.all(Array.from({ length: CONC }, () => worker()));
  save();
  console.log(`[${label}] DONE +${produced} (${failed} failed) -> ${Object.keys(enrich).length}/${chunks.length}`);
}

(async () => {
  try {
    await process("fr_chunks.json", "fr_meta.json", "fr_enrich.json", "FR");
    await process("jp_chunks.json", "jp_meta.json", "jp_enrich.json", "JP");
    console.log("ENRICH ALL DONE");
  } catch (e) { console.error("FATAL", e); }
  finally { releaseLock(); try { process.exit(0); } catch {} }
})();
