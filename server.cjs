const express = require("express");
const path = require("path");
const app = express();
const PORT = process.env.PORT || 3002;

app.use(express.json({ limit: "12mb" }));
// HTML must never be cached (it points at content-hashed bundles); assets can cache.
app.use(express.static(path.join(__dirname, "dist"), {
  setHeaders: (res, filepath) => {
    if (filepath.endsWith(".html")) {
      res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
      res.setHeader("Pragma", "no-cache");
    }
  },
}));

// Lazily import the ESM server-side Gemini module (key stays on the server).
let _geminiPromise = null;
const gemini = () => (_geminiPromise = _geminiPromise || import("./server-gemini.mjs"));

function jsonError(res, status, message) {
  res.status(status).json({ error: message });
}

/* ------------------------------ NOVELS API ------------------------------ */
app.post("/api/novels/tts-reference", async (req, res) => {
  try {
    const { text, lang } = req.body || {};
    const voice = lang === "french" ? "Kore" : "Puck";
    const buf = await (await gemini()).referenceAudio(text, lang, voice);
    res.set("Content-Type", "audio/wav"); res.send(buf);
  } catch (e) { jsonError(res, 503, (e.message || "").slice(0, 200)); }
});

app.post("/api/novels/tts-teacher", async (req, res) => {
  try {
    const { text, lang } = req.body || {};
    const buf = await (await gemini()).teacherAudio(text, lang);
    res.set("Content-Type", "audio/wav"); res.send(buf);
  } catch (e) { jsonError(res, 503, (e.message || "").slice(0, 200)); }
});

app.post("/api/novels/analyze", async (req, res) => {
  try {
    const { audioBase64, mimeType, text, lang } = req.body || {};
    const out = await (await gemini()).analyze({ audioBase64, mimeType, text, lang });
    res.json(out);
  } catch (e) { jsonError(res, 503, (e.message || "").slice(0, 200)); }
});

app.post("/api/novels/meta", async (req, res) => {
  try {
    const { day, text, lang, novelTitle } = req.body || {};
    const out = await (await gemini()).meta({ day, text, lang, novelTitle });
    res.json(out);
  } catch (e) { jsonError(res, 503, (e.message || "").slice(0, 200)); }
});

/* ----------------------------- ORIGINAL APP ----------------------------- */
app.post("/api/orig/reference", async (req, res) => {
  try {
    const { text, lang } = req.body || {};
    const buf = await (await gemini()).referenceAudio(text, lang, "Kore");
    res.set("Content-Type", "audio/wav"); res.send(buf);
  } catch (e) { jsonError(res, 503, (e.message || "").slice(0, 200)); }
});

app.post("/api/orig/teacher", async (req, res) => {
  try {
    const { text, lang } = req.body || {};
    const buf = await (await gemini()).teacherAudio(text, lang);
    res.set("Content-Type", "audio/wav"); res.send(buf);
  } catch (e) { jsonError(res, 503, (e.message || "").slice(0, 200)); }
});

app.post("/api/orig/analyze", async (req, res) => {
  try {
    const { audioBase64, mimeType, text, lang } = req.body || {};
    const out = await (await gemini()).analyze({ audioBase64, mimeType, text, lang });
    res.json(out);
  } catch (e) { jsonError(res, 503, (e.message || "").slice(0, 200)); }
});

app.post("/api/orig/writing-prompt", async (req, res) => {
  try { res.json(await (await gemini()).writingPrompt(req.body || {})); }
  catch (e) { jsonError(res, 503, (e.message || "").slice(0, 200)); }
});

app.post("/api/orig/correct", async (req, res) => {
  try { res.json(await (await gemini()).correctAndImprove(req.body || {})); }
  catch (e) { jsonError(res, 503, (e.message || "").slice(0, 200)); }
});

app.post("/api/orig/conv-feedback", async (req, res) => {
  try { res.json(await (await gemini()).conversationFeedback(req.body || {})); }
  catch (e) { jsonError(res, 503, (e.message || "").slice(0, 200)); }
});

app.post("/api/orig/chat", async (req, res) => {
  try { res.json(await (await gemini()).chat(req.body || {})); }
  catch (e) { jsonError(res, 503, (e.message || "").slice(0, 200)); }
});

app.post("/api/orig/image", async (req, res) => {
  try { res.json(await (await gemini()).storyImage(req.body || {})); }
  catch (e) { jsonError(res, 503, (e.message || "").slice(0, 200)); }
});

// SPA fallback (middleware, no path — Express 5 rejects bare "*"). Must be last.
app.use((_req, res) => res.sendFile(path.join(__dirname, "dist", "index.html")));

app.listen(PORT, () => console.log(`Lumière serving on port ${PORT} (static + /api Gemini proxy)`));
