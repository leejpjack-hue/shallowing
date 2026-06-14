import { useState, useRef, useEffect, useCallback } from "react";
import {
  NovelLang,
  TtsEnginePref,
  TtsEngineActual,
  getCachedGeminiReference,
  getCachedGeminiTeacher,
  browserSpeak,
  browserTtsSupported,
  splitSentences,
} from "./novelServices";

type Mode = "reference" | "teacher";

interface UseShadowingArgs {
  text: string;
  lang: NovelLang;
  novelId: string;
  day: number;
  vocab?: { word: string; translation: string }[];
}

function isQuotaError(e: unknown): boolean {
  const m = (e instanceof Error ? e.message : String(e)).toLowerCase();
  return /429|resource_exhausted|quota|rate limit|permission|api key|invalid|forbidden|403/.test(m);
}

export function useShadowingAudio({ text, lang, novelId, day, vocab }: UseShadowingArgs) {
  const [enginePref, setEnginePrefState] = useState<TtsEnginePref>(
    () => (localStorage.getItem("novel_tts_engine") as TtsEnginePref) || "auto"
  );
  const [mode, setMode] = useState<Mode>("reference");
  const [isPlaying, setIsPlaying] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [statusText, setStatusText] = useState<string>("");
  const [geminiExhausted, setGeminiExhausted] = useState(false);
  const [activeEngine, setActiveEngine] = useState<TtsEngineActual | null>(null);
  const [error, setError] = useState<string | null>(null);

  const audioElRef = useRef<HTMLAudioElement | null>(null);
  const browserStopRef = useRef<(() => void) | null>(null);
  const teacherAbortRef = useRef<boolean>(false);
  const geminiKeyRef = useRef<string>("");

  // Reset everything when the day/text changes.
  useEffect(() => {
    stop();
    setStatusText("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [day, novelId]);

  useEffect(() => {
    return () => {
      try { stop(); } catch { /* noop */ }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setEnginePref = useCallback((p: TtsEnginePref) => {
    setEnginePrefState(p);
    localStorage.setItem("novel_tts_engine", p);
    if (p !== "auto") setGeminiExhausted(false);
  }, []);

  /** Retry Gemini after it was marked exhausted. */
  const retryGemini = useCallback(() => {
    setGeminiExhausted(false);
    setError(null);
  }, []);

  const stopBrowser = useCallback(() => {
    if (browserStopRef.current) {
      browserStopRef.current();
      browserStopRef.current = null;
    }
  }, []);

  const stopAudioEl = useCallback(() => {
    const el = audioElRef.current;
    if (el) {
      el.pause();
      el.currentTime = 0;
      el.src = "";
    }
  }, []);

  const stop = useCallback(() => {
    teacherAbortRef.current = true;
    stopBrowser();
    stopAudioEl();
    if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
    setIsPlaying(false);
  }, [stopBrowser, stopAudioEl]);

  /** Play using the BROWSER engine.
   *  - reference: whole passage at natural pace.
   *  - teacher: a GUIDED LESSON — (1) introduce each difficult word (say it, then
   *    its English meaning), then (2) read the passage sentence by sentence with
   *    echo pauses, so the learner can repeat after the teacher. */
  const playBrowser = useCallback(async () => {
    setActiveEngine("browser");
    setIsPlaying(true);
    if (mode === "teacher") {
      teacherAbortRef.current = false;
      // Phase 1 — key words first.
      const words = (vocab || []).filter((v) => v && v.word).slice(0, 6);
      if (words.length) {
        setStatusText("Lesson · key words");
        await new Promise((r) => setTimeout(r, 500));
        for (let i = 0; i < words.length; i++) {
          if (teacherAbortRef.current) break;
          const w = words[i];
          setStatusText(`Word ${i + 1}/${words.length}: ${w.word} — ${w.translation}`);
          const w1 = await browserSpeak(w.word, lang, { rate: 0.82 });
          browserStopRef.current = w1.stop;
          await w1.promise;
          if (teacherAbortRef.current) break;
          await new Promise((r) => setTimeout(r, 350));
          if (w.translation) {
            const w2 = await browserSpeak(w.translation, "en", { rate: 0.95 });
            browserStopRef.current = w2.stop;
            await w2.promise;
          }
          if (teacherAbortRef.current) break;
          await new Promise((r) => setTimeout(r, 700));
        }
      }
      // Phase 2 — full passage, sentence by sentence.
      if (!teacherAbortRef.current) {
        const sentences = splitSentences(text, lang);
        setStatusText("Lesson · read each phrase, then echo");
        await new Promise((r) => setTimeout(r, 400));
        for (let i = 0; i < sentences.length; i++) {
          if (teacherAbortRef.current) break;
          setStatusText(`Phrase ${i + 1}/${sentences.length} — listen, then repeat`);
          const s = await browserSpeak(sentences[i], lang, { rate: 0.88 });
          browserStopRef.current = s.stop;
          await s.promise;
          if (teacherAbortRef.current) break;
          const pauseMs = Math.min(6000, Math.max(2000, sentences[i].length * 60));
          await new Promise((r) => setTimeout(r, pauseMs));
        }
      }
      setIsPlaying(false);
      setStatusText("Lesson complete. Nice work!");
    } else {
      setStatusText("Playing (browser voice)…");
      const { promise, stop } = await browserSpeak(text, lang, { rate: 0.95 });
      browserStopRef.current = stop;
      await promise;
      setIsPlaying(false);
      setStatusText("");
    }
  }, [mode, text, lang, vocab]);

  /** Play using GEMINI (with IndexedDB cache). Falls back to browser on quota error. */
  const playGemini = useCallback(async () => {
    const cacheKey = `${novelId}_day${day}_${mode}`;
    geminiKeyRef.current = cacheKey;
    setIsGenerating(true);
    setStatusText(mode === "teacher" ? "Building shadowing coach (Gemini)…" : "Loading reference audio (Gemini)…");
    setError(null);
    try {
      const blob =
        mode === "reference"
          ? await getCachedGeminiReference(cacheKey, text, lang)
          : await getCachedGeminiTeacher(cacheKey, text, lang);
      if (geminiKeyRef.current !== cacheKey) return; // superseded
      setIsGenerating(false);
      setActiveEngine("gemini");
      setIsPlaying(true);
      setStatusText(mode === "teacher" ? "Shadowing coach (Gemini) — echo each phrase" : "Reference audio (Gemini)");
      const url = URL.createObjectURL(blob);
      await new Promise<void>((resolve) => {
        const el = new Audio(url);
        audioElRef.current = el;
        el.onended = () => {
          URL.revokeObjectURL(url);
          setIsPlaying(false);
          setStatusText("");
          resolve();
        };
        el.onerror = () => {
          URL.revokeObjectURL(url);
          setIsPlaying(false);
          setStatusText("");
          resolve();
        };
        el.play().catch(() => {
          URL.revokeObjectURL(url);
          setIsPlaying(false);
          resolve();
        });
      });
    } catch (e) {
      if (geminiKeyRef.current !== cacheKey) return;
      setIsGenerating(false);
      setIsPlaying(false);
      if (isQuotaError(e)) {
        setGeminiExhausted(true);
        setStatusText("Gemini quota reached — switching to the browser voice.");
        // Auto-fallback to browser immediately (the requirement).
        setTimeout(() => playBrowser().catch(() => {}), 250);
      } else {
        setError("Audio generation failed. Try the browser voice.");
        setStatusText("Could not generate Gemini audio.");
      }
    }
  }, [mode, novelId, day, text, lang, playBrowser]);

  const play = useCallback(() => {
    if (isPlaying || isGenerating) {
      stop();
      return;
    }
    // Teacher mode = guided lesson (word-by-word then sentence-by-sentence). This
    // needs many short bilingual calls, so it ALWAYS uses the browser voice.
    if (mode === "teacher") {
      if (browserTtsSupported()) playBrowser().catch(() => setIsPlaying(false));
      else {
        setError("The guided lesson needs your browser's speech voice. Try Reference mode for Gemini audio.");
        setStatusText("No browser voice available.");
      }
      return;
    }
    // Reference mode respects the engine preference.
    const useBrowser = enginePref === "browser" || (enginePref === "auto" && geminiExhausted);
    if (useBrowser && browserTtsSupported()) {
      playBrowser().catch(() => setIsPlaying(false));
    } else if (!browserTtsSupported() && useBrowser) {
      setError("Your browser/device has no speech synthesis voice. Switch to Gemini.");
      setStatusText("No browser voice available.");
    } else {
      playGemini().catch(() => setIsPlaying(false));
    }
  }, [isPlaying, isGenerating, mode, enginePref, geminiExhausted, playBrowser, playGemini, stop]);

  const toggle = play; // alias for a play/pause button

  return {
    enginePref,
    setEnginePref,
    mode,
    setMode,
    isPlaying,
    isGenerating,
    statusText,
    activeEngine,
    geminiExhausted,
    error,
    play,
    toggle,
    stop,
    retryGemini,
  };
}
