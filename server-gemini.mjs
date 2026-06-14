// Server-side Gemini proxy. All Google AI calls happen here (key never reaches
// the browser). Imported dynamically by server.cjs (CommonJS). Key is read from
// gitignored .env.local via novels/_keys.mjs.
import { GoogleGenAI, Modality, Type } from "@google/genai";
import { GEMINI_KEY } from "./novels/_keys.mjs";

const ai = new GoogleGenAI({ apiKey: GEMINI_KEY });
if (!GEMINI_KEY) console.warn("[server-gemini] WARNING: GEMINI_API_KEY missing — API routes will fail.");

const TTS_MODEL = "gemini-2.5-flash-preview-tts";
const TEXT_MODEL = "gemini-2.5-flash";
const LITE_MODEL = "gemini-2.5-flash-lite";
const IMAGE_MODEL = "gemini-2.5-flash-image";
const CHAT_MODEL = "gemini-3-flash-preview";

/* ----------------------------- audio helpers ----------------------------- */
function decodeBase64(base64) {
  const bin = atob(base64);
  const len = bin.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}
function base64ToInt16(base64) {
  const raw = decodeBase64(base64);
  return new Int16Array(raw.buffer, raw.byteOffset, raw.byteLength / 2);
}
function createSilence(seconds, sampleRate = 24000) {
  return new Int16Array(Math.floor(seconds * sampleRate));
}
function concatenateBuffers(buffers) {
  const total = buffers.reduce((a, b) => a + b.length, 0);
  const out = new Int16Array(total);
  let off = 0;
  for (const b of buffers) { out.set(b, off); off += b.length; }
  return out;
}
function pcmToWav(pcm, sampleRate = 24000) {
  const data = pcm instanceof Float32Array
    ? (() => { const d = new Int16Array(pcm.length); for (let i = 0; i < pcm.length; i++) { let s = Math.max(-1, Math.min(1, pcm[i])); d[i] = s < 0 ? s * 0x8000 : s * 0x7fff; } return d; })()
    : pcm;
  const numChannels = 1, bitsPerSample = 16;
  const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;
  const blockAlign = (numChannels * bitsPerSample) / 8;
  const subChunk2Size = data.length * (bitsPerSample / 8);
  const buffer = new ArrayBuffer(44 + subChunk2Size);
  const view = new DataView(buffer);
  const w = (o, s) => { for (let i = 0; i < s.length; i++) view.setUint8(o + i, s.charCodeAt(i)); };
  w(0, "RIFF"); view.setUint32(4, 36 + subChunk2Size, true); w(8, "WAVE");
  w(12, "fmt "); view.setUint32(16, 16, true); view.setUint16(20, 1, true);
  view.setUint16(22, numChannels, true); view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true); view.setUint16(32, blockAlign, true); view.setUint16(34, bitsPerSample, true);
  w(36, "data"); view.setUint32(40, subChunk2Size, true);
  for (let i = 0; i < data.length; i++) view.setInt16(44 + i * 2, data[i], true);
  return Buffer.from(view.buffer);
}
function processAudioResponse(base64) {
  const raw = decodeBase64(base64);
  const int16 = new Int16Array(raw.buffer, raw.byteOffset, raw.byteLength / 2);
  return pcmToWav(int16, 24000);
}

/* ------------------------------- TTS ------------------------------------- */
export async function referenceAudio(text, lang, voice = "Kore") {
  const r = await ai.models.generateContent({
    model: TTS_MODEL,
    contents: [{ parts: [{ text }] }],
    config: { responseModalities: [Modality.AUDIO], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } } },
  });
  const b64 = r.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  if (!b64) throw new Error("No audio data returned from Gemini TTS.");
  return processAudioResponse(b64);
}

export async function teacherAudio(text, lang) {
  const sep = lang === "japanese" ? /[。！？]/ : /[.!?]/;
  const sentences = text.split(sep).map((s) => s.trim()).filter(Boolean);
  const SAMPLE_RATE = 24000;
  const out = [];
  for (let i = 0; i < sentences.length; i++) {
    const phrase = sentences.slice(0, i + 1).join(lang === "japanese" ? "" : ". ") + (lang === "japanese" ? "。" : ".");
    try {
      const r = await ai.models.generateContent({
        model: TTS_MODEL,
        contents: [{ parts: [{ text: phrase }] }],
        config: { responseModalities: [Modality.AUDIO], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: "Zephyr" } } } },
      });
      const b64 = r.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (b64) {
        const audio = base64ToInt16(b64);
        const dur = audio.length / SAMPLE_RATE;
        const wait = Math.min(5, Math.max(1.4, dur * 1.3));
        out.push(audio, createSilence(wait, SAMPLE_RATE));
      }
    } catch { /* skip phrase */ }
  }
  if (!out.length) throw new Error("No teacher audio generated.");
  return pcmToWav(concatenateBuffers(out), SAMPLE_RATE);
}

/* ----------------------------- analysis ---------------------------------- */
export async function analyze({ audioBase64, mimeType, text, lang }) {
  const model = LITE_MODEL;
  const r = await ai.models.generateContent({
    model,
    contents: { parts: [
      { text: `Analyze this ${lang} learner's pronunciation of the passage:\n"""${text}"""\nReturn JSON: {"score":0-100,"feedback":"concise (max 2 sentences)","wordsToImprove":["mispronounced words"]}` },
      { inlineData: { mimeType: mimeType || "audio/webm", data: audioBase64 } },
    ] },
    config: { responseMimeType: "application/json", responseSchema: {
      type: Type.OBJECT, properties: {
        score: { type: Type.INTEGER }, feedback: { type: Type.STRING },
        wordsToImprove: { type: Type.ARRAY, items: { type: Type.STRING } },
      } } },
  });
  return JSON.parse(r.text);
}

/* --------------------- on-demand translation / vocab --------------------- */
export async function meta({ day, text, lang, novelTitle }) {
  const isFr = lang === "french";
  const prompt = `You are a meticulous literary translator and language teacher.
Below is Day ${day} of the ${isFr ? "French" : "Japanese"} novel "${novelTitle}".
Translate it into natural, faithful English, give it a short (3-6 word) English title, and pick 5-6 key vocabulary items for a learner. phonetic MUST be ${isFr ? "IPA (e.g. /ʁe.vɛj/)" : "Hepburn romaji"}.

Passage:
"""
${text}
"""
Respond strictly as JSON: { "title": string, "translation": string, "vocabulary": [{ "word": string, "phonetic": string, "translation": string }] }`;
  const r = await ai.models.generateContent({
    model: LITE_MODEL, contents: [{ parts: [{ text: prompt }] }],
    config: { responseMimeType: "application/json", responseSchema: {
      type: Type.OBJECT, properties: {
        title: { type: Type.STRING }, translation: { type: Type.STRING },
        vocabulary: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: {
          word: { type: Type.STRING }, phonetic: { type: Type.STRING }, translation: { type: Type.STRING } },
          required: ["word", "phonetic", "translation"] } } },
      required: ["title", "translation", "vocabulary"] } },
  });
  return JSON.parse(r.text);
}

/* ----------------------- original app: writing --------------------------- */
export async function writingPrompt({ storyContent, lang, mode }) {
  const prompt = mode === "fill-in-the-blank"
    ? `Based on this ${lang} story: "${storyContent}", create a fill-in-the-blank exercise. Replace 3-5 key words with "____". Return JSON: { "prompt": "The text with blanks", "solution": "The full original text" }`
    : `Based on this ${lang} story: "${storyContent}", give the user a prompt to write a similar story. The prompt should be in ${lang} and English. Return JSON: { "prompt": "The writing prompt" }`;
  const r = await ai.models.generateContent({
    model: TEXT_MODEL, contents: [{ parts: [{ text: prompt }] }],
    config: { responseMimeType: "application/json", responseSchema: {
      type: Type.OBJECT, properties: { prompt: { type: Type.STRING }, solution: { type: Type.STRING } } } },
  });
  return JSON.parse(r.text);
}

export async function correctAndImprove({ userInput, lang, contextStory }) {
  const prompt = `The user is learning ${lang}. They wrote this based on the story: "${contextStory}".
User Input: "${userInput}"
Please:
1. Correct any grammatical errors in the user's input.
2. Provide a "better" version (more natural, more advanced vocabulary).
3. Provide a brief feedback in English.
4. Provide phonetic transcription (IPA for French, Romaji for Japanese) for the "better" version.
Return JSON:
{ "original": "${userInput}", "corrected": "...", "improved": "...", "feedback": "...", "phonetic": "..." }`;
  const r = await ai.models.generateContent({
    model: TEXT_MODEL, contents: [{ parts: [{ text: prompt }] }],
    config: { responseMimeType: "application/json", responseSchema: {
      type: Type.OBJECT, properties: {
        original: { type: Type.STRING }, corrected: { type: Type.STRING }, improved: { type: Type.STRING },
        feedback: { type: Type.STRING }, phonetic: { type: Type.STRING } } } },
  });
  return JSON.parse(r.text);
}

export async function conversationFeedback({ history, lang }) {
  const prompt = `Review this conversation between a ${lang} student and a teacher.
Conversation:
${history.map((m) => `${m.role}: ${m.text}`).join("\n")}
Provide a score (0-100) and constructive feedback. Return JSON: { "score": number, "feedback": "string" }`;
  const r = await ai.models.generateContent({
    model: TEXT_MODEL, contents: [{ parts: [{ text: prompt }] }],
    config: { responseMimeType: "application/json", responseSchema: {
      type: Type.OBJECT, properties: { score: { type: Type.NUMBER }, feedback: { type: Type.STRING } } } },
  });
  return JSON.parse(r.text);
}

/* ------------------------- original app: chat ---------------------------- */
export async function chat({ systemInstruction, history, message }) {
  // Stateless: rebuild context each turn from the client-maintained history.
  const contents = (history || []).map((m) => ({ role: m.role === "user" ? "user" : "model", parts: [{ text: m.text }] }));
  contents.push({ role: "user", parts: [{ text: message }] });
  const r = await ai.models.generateContent({
    model: CHAT_MODEL,
    contents,
    config: { systemInstruction: systemInstruction || "You are a friendly language teacher." },
  });
  return { reply: r.text || "" };
}

/* ------------------------- original app: image --------------------------- */
export async function storyImage({ storyContent, vocabulary, lang }) {
  const imageResponse = await ai.models.generateContent({
    model: IMAGE_MODEL,
    contents: { parts: [{ text: `Create a vibrant, detailed illustration for this ${lang} story: "${storyContent}". The style should be clean and educational.` }] },
  });
  let base64Image = "";
  for (const part of imageResponse.candidates[0].content.parts) {
    if (part.inlineData) { base64Image = part.inlineData.data; break; }
  }
  if (!base64Image) throw new Error("Failed to generate image.");
  const coordPrompt = `I just generated an image for this story: "${storyContent}".
For each of these vocabulary words: ${(vocabulary || []).join(", ")}, estimate their (x, y) coordinates in a 100x100 grid where (0,0) is top-left.
Return JSON: { "labels": [{ "word": "string", "x": number, "y": number }] }`;
  const coordResponse = await ai.models.generateContent({
    model: TEXT_MODEL, contents: [{ parts: [{ text: coordPrompt }] }],
    config: { responseMimeType: "application/json", responseSchema: {
      type: Type.OBJECT, properties: { labels: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: {
        word: { type: Type.STRING }, x: { type: Type.NUMBER }, y: { type: Type.NUMBER } } } } } } },
  });
  return { imageUrl: `data:image/png;base64,${base64Image}`, labels: JSON.parse(coordResponse.text).labels };
}
