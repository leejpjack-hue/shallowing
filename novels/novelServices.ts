/**
 * Standalone services for the Novel Shadowing page.
 *
 * All Gemini calls go through the server-side proxy (/api/novels/*) — NO API
 * key is shipped to the browser. TTS strategy: Gemini (via server) is primary;
 * when it is out of quota / unavailable we fall back to the browser's
 * speechSynthesis (Web Speech API). Reference audio is cached in IndexedDB so
 * repeat visits cost zero quota.
 */
import { blobToBase64 } from "../utils/audioUtils";
import { getCachedAudio, cacheAudio } from "../utils/db";

export type NovelLang = "french" | "japanese";
export type TtsEnginePref = "auto" | "gemini" | "browser";
export type TtsEngineActual = "gemini" | "browser";

/* --------------------------- server API helper -------------------------- */

async function apiBuffer(path: string, body: unknown): Promise<Blob> {
  const r = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) {
    const t = await r.text().catch(() => "");
    throw new Error(`${r.status} ${t.slice(0, 160)}`);
  }
  return r.blob();
}
async function apiJson<T>(path: string, body: unknown): Promise<T> {
  const r = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) {
    const t = await r.text().catch(() => "");
    throw new Error(`${r.status} ${t.slice(0, 160)}`);
  }
  return r.json() as Promise<T>;
}

/* ----------------------------- Gemini TTS ----------------------------- */

/** Generate a single high-quality reference audio for a full passage. */
export async function geminiReferenceAudio(text: string, lang: NovelLang): Promise<Blob> {
  return apiBuffer("/api/novels/tts-reference", { text, lang });
}

/** Cumulative shadowing chunks with pauses (built server-side). */
export async function geminiTeacherAudio(text: string, lang: NovelLang): Promise<Blob> {
  return apiBuffer("/api/novels/tts-teacher", { text, lang });
}

/** Get (cache-backed) Gemini reference audio for a novel day. */
export async function getCachedGeminiReference(
  cacheKey: string, text: string, lang: NovelLang
): Promise<Blob> {
  const cached = await getCachedAudio(cacheKey);
  if (cached) return cached;
  const blob = await geminiReferenceAudio(text, lang);
  await cacheAudio(cacheKey, blob);
  return blob;
}

/** Get (cache-backed) Gemini teacher audio for a novel day. */
export async function getCachedGeminiTeacher(
  cacheKey: string, text: string, lang: NovelLang
): Promise<Blob> {
  const cached = await getCachedAudio(cacheKey);
  if (cached) return cached;
  const blob = await geminiTeacherAudio(text, lang);
  await cacheAudio(cacheKey, blob);
  return blob;
}

/* --------------------------- Browser TTS ------------------------------ */

export type SpeakLang = NovelLang | "en";

export function browserTtsSupported(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

/** Known FEMALE voice names per language (Apple / Google / Microsoft neural voices). */
const FEMALE: Record<SpeakLang, string[]> = {
  french: [
    "amelie", "amélie", "marie", "céline", "celine", "aurelie", "aurélie", "julie",
    "virginie", "audrey", "pauline", "hortense", "josephine", "nathalie", "charlotte",
    "google français", "google french", "médée", "denise", "sylvie",
  ],
  japanese: [
    "kyoko", "hattori", "rini", "nanami", "aoi", "sakura", "misaki", "sayaka", "haruka",
    "yuri", "google 日本語", "google japanese", "ayumi", "mei", "moé", "moe", "shiori",
  ],
  en: [
    "samantha", "sara", "karen", "moira", "tessa", "fiona", "veena", "allison", "ava",
    "serena", "susan", "victoria", "zoe", "kate", "google us english", "google uk english female",
    "microsoft aria", "microsoft jenny", "microsoft zira", "libby", "sonia",
  ],
};
const MALE: Record<SpeakLang, string[]> = {
  french: ["thomas", "nicolas", "henri", "remy", "rémi", "jorge", "paul", "pierre", "olivier"],
  japanese: ["otoya", "oren", "keita", "takumi", "itcho", "kyosuke", "naoki", "shouta", "souta"],
  en: ["daniel", "alex", "fred", "arthur", "oliver", "ralph", "rishi", "google uk english male", "microsoft guy"],
};
/** Quality markers that indicate a high-fidelity (premium/enhanced/cloud) voice. */
const QUALITY = ["google", "premium", "enhanced", " plus", "(premium", "(enhanced", "neural", "natural", "siri", "高品質"];

function scoreVoice(v: SpeechSynthesisVoice, lang: SpeakLang): number {
  const name = (v.name || "").toLowerCase();
  const vlang = (v.lang || "").toLowerCase();
  let score = 0;
  if (FEMALE[lang].some((n) => name.includes(n))) score += 1000;
  if (MALE[lang].some((n) => name.includes(n))) score -= 1000;
  if (QUALITY.some((q) => name.includes(q))) score += 120;
  if (name.includes("compact")) score -= 40;
  if (v.localService === false) score += 80;
  const want = lang === "french" ? "fr-fr" : lang === "japanese" ? "ja-jp" : lang === "en" ? (vlang.startsWith("en") ? "en" : "") : "";
  if (want && vlang.startsWith(want)) score += 40;
  if (lang === "en" && vlang.startsWith("en")) score += 40;
  if (v.default) score += 8;
  return score;
}

/** Voices can populate asynchronously; wait for them (with a timeout). */
async function loadVoices(): Promise<SpeechSynthesisVoice[]> {
  const synth = window.speechSynthesis;
  let voices = synth.getVoices();
  if (voices.length) return voices;
  await new Promise<void>((resolve) => {
    let done = false;
    const finish = () => { if (!done) { done = true; resolve(); } };
    synth.onvoiceschanged = finish;
    setTimeout(finish, 1500);
  });
  return synth.getVoices();
}

async function pickVoice(lang: SpeakLang): Promise<SpeechSynthesisVoice | null> {
  const voices = await loadVoices();
  if (!voices.length) return null;
  const code = lang === "french" ? "fr" : lang === "japanese" ? "ja" : "en";
  const matching = voices.filter((v) => (v.lang || "").toLowerCase().startsWith(code));
  const pool = matching.length ? matching : voices;
  let best: SpeechSynthesisVoice | null = null;
  let bestScore = -Infinity;
  for (const v of pool) {
    const s = scoreVoice(v, lang);
    if (s > bestScore) { bestScore = s; best = v; }
  }
  return best;
}

export interface BrowserSpeakHandle {
  stop: () => void;
}

/** Speak text with the best available high-quality female browser voice for `lang`. */
export async function browserSpeak(
  text: string,
  lang: SpeakLang,
  opts: { rate?: number; onBoundary?: (charIndex: number) => void } = {}
): Promise<{ promise: Promise<void>; stop: () => void }> {
  let resolveFn: () => void;
  const promise = new Promise<void>((res) => { resolveFn = res; });
  if (!browserTtsSupported() || !text.trim()) {
    setTimeout(resolveFn!, 0);
    return { promise, stop: () => {} };
  }
  const synth = window.speechSynthesis;
  synth.cancel();
  const v = await pickVoice(lang);
  const u = new SpeechSynthesisUtterance(text);
  if (v) u.voice = v;
  u.lang = lang === "french" ? "fr-FR" : lang === "japanese" ? "ja-JP" : "en-US";
  u.rate = opts.rate ?? 0.92;
  u.pitch = 1.0;
  u.volume = 1.0;
  u.onend = () => resolveFn!();
  u.onerror = () => resolveFn!();
  if (opts.onBoundary) u.onboundary = (ev) => opts.onBoundary!(ev.charIndex);
  synth.speak(u);
  return { promise, stop: () => synth.cancel() };
}

/** Sentence boundaries for the browser teacher drill. */
export function splitSentences(text: string, lang: NovelLang): string[] {
  const sep = lang === "japanese" ? /(?<=[。！？」』])/ : /(?<=[.!?])/;
  return text.split(sep).map((s) => s.trim()).filter(Boolean);
}

/* --------------------- Pronunciation analysis ------------------------- */

export interface AnalysisResult {
  score: number;
  feedback: string;
  wordsToImprove: string[];
}

export async function analyzePronunciation(
  userAudioBlob: Blob, referenceText: string, lang: NovelLang
): Promise<AnalysisResult> {
  try {
    const base64Audio = await blobToBase64(userAudioBlob);
    const mimeType = userAudioBlob.type || "audio/webm";
    return await apiJson<AnalysisResult>("/api/novels/analyze", {
      audioBase64: base64Audio, mimeType, text: referenceText, lang,
    });
  } catch (e) {
    console.error("analyzePronunciation failed", e);
    return {
      score: 0,
      feedback: "Pronunciation analysis is unavailable right now (API quota may be exhausted). Try the shadowing drill again later.",
      wordsToImprove: [],
    };
  }
}

/* ------------------- On-demand translation / vocab ------------------- */

export interface DayMeta {
  translation: string;
  vocabulary: { word: string; phonetic: string; translation: string }[];
  title: string;
}

const META_STORE = "novel_meta";

// Lightweight separate IndexedDB store for translations/vocab (object values).
function metaDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open("LumiereNovelMeta", 1);
    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(META_STORE)) db.createObjectStore(META_STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function getCachedMeta(key: string): Promise<DayMeta | null> {
  try {
    const db = await metaDB();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(META_STORE, "readonly");
      const req = tx.objectStore(META_STORE).get(key);
      req.onsuccess = () => resolve((req.result as DayMeta) || null);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return null;
  }
}

export async function setCachedMeta(key: string, meta: DayMeta): Promise<void> {
  try {
    const db = await metaDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(META_STORE, "readwrite");
      tx.objectStore(META_STORE).put(meta, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    /* ignore */
  }
}

export async function generateDayMeta(
  day: number, text: string, lang: NovelLang, novelTitle: string
): Promise<DayMeta> {
  const parsed = await apiJson<DayMeta>("/api/novels/meta", { day, text, lang, novelTitle });
  await setCachedMeta(`${lang}_${day}`, parsed);
  return parsed;
}
