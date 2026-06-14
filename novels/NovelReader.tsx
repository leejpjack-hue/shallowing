import React, { useState, useEffect, useRef, useCallback } from "react";
import { Novel, NovelDay, VocabItem } from "./novelData";
import Passage from "./Passage";
import { useShadowingAudio } from "./useShadowingAudio";
import {
  analyzePronunciation,
  AnalysisResult,
  generateDayMeta,
  getCachedMeta,
  browserTtsSupported,
  browserSpeak,
} from "./novelServices";
import {
  Play, Pause, Mic, Square, ArrowLeft, ArrowRight, Loader2, Volume2,
  BookA, Check, Globe, GraduationCap, Sparkles, AlertTriangle, CheckCircle2,
  Lightbulb, Highlighter, Type, VolumeX,
} from "lucide-react";
import { RadialBarChart, RadialBar, PolarAngleAxis, ResponsiveContainer } from "recharts";

type RecordingState = "IDLE" | "RECORDING" | "PROCESSING" | "ANALYZED";

interface Props {
  novel: Novel;
  day: NovelDay;
  completed: boolean;
  onBack: () => void;
  onPrev: () => void;
  onNext: () => void;
  onComplete: (day: number) => void;
}

const NovelReader: React.FC<Props> = ({ novel, day, completed, onBack, onPrev, onNext, onComplete }) => {
  const lang = novel.language;
  const isFr = lang === "french";

  const [translation, setTranslation] = useState<string | null>(day.translation);
  const [vocabulary, setVocabulary] = useState<VocabItem[] | null>(day.vocabulary);
  const [grammar, setGrammar] = useState(day.grammar);
  const [showTranslation, setShowTranslation] = useState(false);
  const [furigana, setFurigana] = useState<boolean>(() => localStorage.getItem("novel_furigana") === "1");
  const [highlight, setHighlight] = useState<boolean>(() => localStorage.getItem("novel_highlight") !== "0");
  const [metaLoading, setMetaLoading] = useState(false);
  const [metaError, setMetaError] = useState<string | null>(null);
  const [speakingKey, setSpeakingKey] = useState<string | null>(null);
  const speakStopRef = useRef<(() => void) | null>(null);

  const [recordingState, setRecordingState] = useState<RecordingState>("IDLE");
  const [userAudioUrl, setUserAudioUrl] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const userAudioElRef = useRef<HTMLAudioElement | null>(null);

  const audio = useShadowingAudio({
    text: day.text, lang, novelId: novel.id, day: day.day, vocab: vocabulary || [],
  });

  useEffect(() => {
    setTranslation(day.translation);
    setVocabulary(day.vocabulary);
    setGrammar(day.grammar);
    setShowTranslation(false);
    setMetaError(null);
    setAnalysis(null);
    setRecordingState("IDLE");
    setUserAudioUrl(null);
    if (!day.translation) {
      getCachedMeta(`${lang}_${day.day}`).then((m) => { if (m) { setTranslation(m.translation); setVocabulary(m.vocabulary); } });
    }
  }, [day.day, lang]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    localStorage.setItem("novel_furigana", furigana ? "1" : "0");
  }, [furigana]);
  useEffect(() => {
    localStorage.setItem("novel_highlight", highlight ? "1" : "0");
  }, [highlight]);

  const ensureTranslation = async () => {
    if (translation) { setShowTranslation((s) => !s); return; }
    setMetaLoading(true); setMetaError(null);
    try {
      const m = await generateDayMeta(day.day, day.text, lang, novel.title);
      setTranslation(m.translation); setVocabulary(m.vocabulary); setShowTranslation(true);
    } catch {
      setMetaError("Translation unavailable right now. Try again later.");
    } finally { setMetaLoading(false); }
  };

  const speakOneOff = useCallback(async (key: string, text: string, lng: typeof lang | "en") => {
    if (!browserTtsSupported() || !text.trim()) return;
    if (speakingKey === key) { speakStopRef.current?.(); setSpeakingKey(null); return; }
    speakStopRef.current?.();
    setSpeakingKey(key);
    const { promise, stop } = await browserSpeak(text, lng, { rate: 0.9 });
    speakStopRef.current = stop;
    await promise;
    setSpeakingKey((cur) => (cur === key ? null : cur));
  }, [speakingKey]);

  // --- Recording ---
  const startRecording = async () => {
    setAnalysis(null); chunksRef.current = []; audio.stop();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, sampleRate: 16000, echoCancellation: true, noiseSuppression: true },
      });
      let options: MediaRecorderOptions = { mimeType: "audio/webm;codecs=opus" };
      if (!MediaRecorder.isTypeSupported("audio/webm;codecs=opus")) {
        options = MediaRecorder.isTypeSupported("audio/webm") ? { mimeType: "audio/webm" } : {};
      }
      options.audioBitsPerSecond = 24000;
      const rec = new MediaRecorder(stream, options);
      mediaRecorderRef.current = rec;
      rec.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      rec.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: rec.mimeType || "audio/webm" });
        if (userAudioUrl) URL.revokeObjectURL(userAudioUrl);
        setUserAudioUrl(URL.createObjectURL(blob));
        setRecordingState("PROCESSING");
        const result = await analyzePronunciation(blob, day.text, lang);
        setAnalysis(result); setRecordingState("ANALYZED");
      };
      rec.start(); setRecordingState("RECORDING");
    } catch { setRecordingState("IDLE"); }
  };
  const stopRecording = () => {
    const rec = mediaRecorderRef.current;
    if (rec && rec.state === "recording") { rec.stop(); rec.stream.getTracks().forEach((t) => t.stop()); }
  };

  const accentText = isFr ? "text-french-blue" : "text-japanese-red";
  const accentBg = isFr ? "bg-french-blue" : "bg-japanese-red";
  const wordCount = day.text.split(/\s+/).filter(Boolean).length;
  const charCount = day.text.replace(/\s/g, "").length;
  const hasFurigana = !isFr ? false : !!day.furiganaParagraphs;

  const Pill: React.FC<{ active: boolean; onClick: () => void; icon: React.ReactNode; children: React.ReactNode; disabled?: boolean }> =
    ({ active, onClick, icon, children, disabled }) => (
      <button
        onClick={onClick} disabled={disabled}
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
          active ? `${accentBg} text-white border-transparent shadow-sm` : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
        }`}
      >{icon}{children}</button>
    );

  return (
    <div className="space-y-6 pb-24">
      {/* Top nav */}
      <div className="flex items-center justify-between">
        <button onClick={onBack} className="flex items-center text-sm font-medium text-slate-500 hover:text-slate-800 transition-colors">
          <ArrowLeft size={16} className="mr-1" /> Calendar
        </button>
        <div className="flex items-center gap-2">
          <button onClick={onPrev} className="p-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600"><ArrowLeft size={16} /></button>
          <span className="text-sm font-semibold text-slate-700 tabular-nums">Day {day.day} / 100</span>
          <button onClick={onNext} className="p-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600"><ArrowRight size={16} /></button>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="p-6 md:p-8 border-b border-slate-100">
          <div className="flex items-center gap-2 mb-2">
            <span className={`px-2.5 py-0.5 rounded text-xs font-semibold uppercase tracking-wide ${isFr ? "bg-blue-50 text-french-blue" : "bg-red-50 text-japanese-red"}`}>{novel.theme}</span>
            {completed && <span className="px-2.5 py-0.5 rounded text-xs font-semibold uppercase tracking-wide bg-green-50 text-green-700 inline-flex items-center gap-1"><Check size={12} /> Done</span>}
          </div>
          <h2 className={`text-2xl md:text-3xl font-serif font-bold text-slate-900 mb-1 ${!isFr ? "font-jp" : ""}`}>{day.title}</h2>
          <p className="text-sm text-slate-500">
            {novel.title}{novel.titleEn ? ` · ${novel.titleEn}` : ""} — {novel.author}
            <span className="mx-2 text-slate-300">·</span>{isFr ? `${wordCount} words` : `${charCount} characters`}
          </p>
        </div>

        {/* Toolbar */}
        <div className="px-6 md:px-8 py-3 bg-slate-50/70 border-b border-slate-100 flex flex-wrap items-center gap-2">
          <Pill active={highlight} onClick={() => setHighlight((v) => !v)} icon={<Highlighter size={13} />}>Highlight</Pill>
          <Pill active={furigana} onClick={() => setFurigana((v) => !v)} disabled={!hasFurigana} icon={<Type size={13} />}>Furigana</Pill>
          <Pill active={showTranslation} onClick={ensureTranslation} icon={<Globe size={13} />}>
            {metaLoading ? <Loader2 size={13} className="animate-spin" /> : null}
            {translation ? (showTranslation ? "Hide translation" : "Show translation") : "Load translation"}
          </Pill>
          <span className="ml-auto text-[11px] text-slate-400 hidden sm:inline">Tap a word card ▸ to hear it</span>
        </div>
        {metaError && <div className="px-6 md:px-8 pt-3"><p className="text-xs text-amber-700 inline-flex items-center gap-1"><AlertTriangle size={12} />{metaError}</p></div>}

        {/* READ */}
        <div className="p-6 md:p-8 border-b border-slate-100">
          <SectionTitle icon={<Play size={14} className={accentText} />}>Read &amp; listen</SectionTitle>
          <div className="prose prose-lg max-w-none">
            <Passage day={day} isJapanese={!isFr} furigana={furigana} highlight={highlight} />
          </div>
          {showTranslation && translation && (
            <div className="mt-5 bg-slate-50 rounded-lg p-4 text-slate-600 italic font-serif border border-slate-100 animate-fade-in">
              {translation}
            </div>
          )}
        </div>

        {/* VOCABULARY */}
        {vocabulary && vocabulary.length > 0 && (
          <div className="p-6 md:p-8 border-b border-slate-100">
            <SectionTitle icon={<BookA size={14} className={accentText} />}>Vocabulary <span className="text-slate-400 font-normal">· tap to hear &amp; see usage</span></SectionTitle>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              {vocabulary.map((v, i) => (
                <div key={i} className="p-4 rounded-xl border border-slate-100 bg-white shadow-sm hover:border-slate-200 transition-colors">
                  <div className="flex items-baseline justify-between gap-2 mb-1">
                    <button onClick={() => speakOneOff(`w${i}`, v.word, lang)} className={`font-semibold text-lg text-slate-900 ${!isFr ? "font-jp" : ""} hover:underline inline-flex items-center gap-1.5`}>
                      <Volume2 size={14} className={speakingKey === `w${i}` ? accentText : "text-slate-400"} />
                      {v.word}
                    </button>
                    <span className={`text-xs font-mono px-1.5 py-0.5 rounded ${isFr ? "text-french-blue bg-blue-50" : "text-japanese-red bg-red-50"}`}>{v.phonetic}</span>
                  </div>
                  <p className="text-sm text-slate-600 mb-2">{v.translation}</p>
                  {v.example && (
                    <div className="bg-slate-50 rounded-lg p-2.5 text-sm">
                      <p className={`text-slate-700 ${!isFr ? "font-jp" : ""}`}>“{v.example}”</p>
                      {v.exampleTranslation && <p className="text-slate-400 italic mt-0.5">{v.exampleTranslation}</p>}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* GRAMMAR */}
        {grammar && grammar.length > 0 && (
          <div className="p-6 md:p-8 border-b border-slate-100">
            <SectionTitle icon={<Lightbulb size={14} className={accentText} />}>Grammar points</SectionTitle>
            <div className="space-y-3">
              {grammar.map((g, i) => (
                <div key={i} className="p-4 rounded-xl bg-amber-50/60 border border-amber-100">
                  <p className={`font-semibold text-slate-900 mb-1 ${!isFr ? "font-jp" : ""}`}>{g.point}</p>
                  <p className="text-sm text-slate-600 leading-relaxed">{g.explanation}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* AUDIO */}
        <div className="p-6 bg-slate-50 border-b border-slate-100">
          <div className="flex flex-col sm:flex-row gap-3 mb-4">
            <div className="flex bg-white rounded-lg p-1 border border-slate-200">
              {(["auto", "gemini", "browser"] as const).map((e) => (
                <button key={e} onClick={() => audio.setEnginePref(e)}
                  className={`px-3 py-1.5 rounded-md text-xs font-semibold capitalize transition-all ${audio.enginePref === e ? `${accentBg} text-white shadow-sm` : "text-slate-500 hover:text-slate-700"}`}>
                  {e === "auto" ? "Auto" : e === "gemini" ? "Gemini" : "Browser"}
                </button>
              ))}
            </div>
            <div className="flex bg-white rounded-lg p-1 border border-slate-200 flex-1">
              <button onClick={() => audio.setMode("reference")}
                className={`flex-1 py-1.5 rounded-md text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${audio.mode === "reference" ? `${accentBg} text-white shadow-sm` : "text-slate-500 hover:text-slate-700"}`}>
                <Volume2 size={14} /> Reference
              </button>
              <button onClick={() => audio.setMode("teacher")}
                className={`flex-1 py-1.5 rounded-md text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${audio.mode === "teacher" ? `${accentBg} text-white shadow-sm` : "text-slate-500 hover:text-slate-700"}`}>
                <GraduationCap size={14} /> Teacher lesson
              </button>
            </div>
          </div>

          {audio.geminiExhausted && (
            <div className="mb-4 p-3 rounded-lg bg-amber-50 border border-amber-200 flex items-start gap-2">
              <AlertTriangle size={16} className="text-amber-600 mt-0.5 flex-shrink-0" />
              <div className="flex-1 text-xs text-amber-800">Gemini audio quota reached — using the <strong>browser voice</strong>.
                <button onClick={audio.retryGemini} className="ml-2 underline font-semibold hover:text-amber-900">Retry Gemini</button>
              </div>
            </div>
          )}
          {!browserTtsSupported() && audio.mode === "teacher" && (
            <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 flex items-start gap-2">
              <VolumeX size={16} className="text-red-600 mt-0.5 flex-shrink-0" />
              <div className="text-xs text-red-800">The guided lesson needs a browser speech voice, which isn't available on this device. Use Reference mode.</div>
            </div>
          )}

          <div className="flex items-center gap-4">
            <button onClick={audio.toggle} disabled={audio.isGenerating}
              className={`h-14 w-14 rounded-full flex items-center justify-center transition-all shadow-sm flex-shrink-0 ${audio.isGenerating ? "bg-slate-200 cursor-wait" : `${accentBg} text-white hover:scale-105`}`}>
              {audio.isGenerating ? <Loader2 size={24} className="animate-spin text-slate-500" />
                : audio.isPlaying ? <Pause size={24} fill="currentColor" />
                : <Play size={24} fill="currentColor" className="ml-1" />}
            </button>
            <div className="flex flex-col min-w-0">
              <span className="text-sm font-semibold text-slate-900">{audio.mode === "reference" ? "Reference audio" : "Teacher lesson"}</span>
              <span className="text-xs text-slate-500 truncate">
                {audio.statusText || (audio.mode === "reference" ? "Natural native pronunciation" : "Teaches key words first, then each phrase")}
              </span>
            </div>
            {recordingState === "RECORDING" && (
              <div className="flex items-center gap-2 text-red-500 font-medium animate-pulse ml-auto"><span className="h-2 w-2 rounded-full bg-red-500" />Recording…</div>
            )}
          </div>
        </div>

        {/* RECORD */}
        <div className="p-6 flex flex-col items-center gap-3">
          {recordingState === "IDLE" || recordingState === "ANALYZED" ? (
            <button onClick={startRecording} className="group flex items-center gap-3 px-7 py-3.5 bg-slate-900 text-white rounded-full font-semibold shadow-lg hover:shadow-xl hover:bg-slate-800 transition-all active:scale-95">
              <div className="bg-white/20 p-2 rounded-full group-hover:bg-white/30"><Mic size={22} /></div>
              {recordingState === "ANALYZED" ? "Record again" : "Record yourself"}
            </button>
          ) : recordingState === "RECORDING" ? (
            <button onClick={stopRecording} className="flex items-center gap-3 px-7 py-3.5 bg-red-500 text-white rounded-full font-semibold shadow-lg hover:bg-red-600 transition-all active:scale-95">
              <Square size={22} fill="currentColor" /> Stop &amp; analyze
            </button>
          ) : (
            <div className="flex items-center gap-3 px-7 py-3.5 bg-slate-100 text-slate-500 rounded-full font-medium"><Loader2 size={22} className="animate-spin" /> Analyzing your pronunciation…</div>
          )}
          <p className="text-xs text-slate-400 text-center max-w-md">Listen to the reference first, then record yourself reading the passage aloud.</p>
        </div>
      </div>

      {/* Analysis */}
      {recordingState === "ANALYZED" && analysis && (
        <div className="animate-slide-up bg-white rounded-2xl shadow-sm border border-slate-200 p-6 md:p-8">
          <div className="flex flex-col md:flex-row gap-8">
            <div className="flex-shrink-0 flex flex-col items-center justify-center">
              <div className="relative w-32 h-32">
                <ResponsiveContainer width="100%" height="100%">
                  <RadialBarChart innerRadius="80%" outerRadius="100%" barSize={10}
                    data={[{ value: analysis.score, fill: analysis.score > 80 ? "#22c55e" : analysis.score > 50 ? "#f59e0b" : "#ef4444" }]}
                    startAngle={90} endAngle={-270}>
                    <PolarAngleAxis type="number" domain={[0, 100]} angleAxisId={0} tick={false} />
                    <RadialBar background dataKey="value" cornerRadius={30} />
                  </RadialBarChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-3xl font-bold text-slate-900">{analysis.score}</span>
                  <span className="text-xs text-slate-400 uppercase">Score</span>
                </div>
              </div>
            </div>
            <div className="flex-1 space-y-4">
              <div>
                <h3 className="text-lg font-semibold text-slate-900 mb-1 flex items-center gap-2">
                  {analysis.score === 0 ? <AlertTriangle size={18} className="text-amber-500" /> : <Sparkles size={18} className={accentText} />}Feedback
                </h3>
                <p className="text-slate-600 leading-relaxed">{analysis.feedback}</p>
              </div>
              {analysis.wordsToImprove.length > 0 ? (
                <div>
                  <h4 className="text-sm font-semibold text-slate-900 mb-2 uppercase tracking-wide">Words to improve</h4>
                  <div className="flex flex-wrap gap-2">
                    {analysis.wordsToImprove.map((w, i) => (
                      <button key={i} onClick={() => speakOneOff(`a${i}`, w, lang)} className="px-3 py-1 bg-red-50 text-red-600 rounded-full text-sm font-medium border border-red-100 inline-flex items-center gap-1 hover:bg-red-100">
                        <Volume2 size={12} />{w}
                      </button>
                    ))}
                  </div>
                </div>
              ) : analysis.score > 0 && (
                <div className="p-3 bg-green-50 text-green-700 rounded-lg text-sm border border-green-100 inline-flex items-center gap-2"><CheckCircle2 size={16} />Excellent pronunciation — no issues detected.</div>
              )}
              {userAudioUrl && (
                <div className="pt-4 border-t border-slate-100 mt-4 flex items-center gap-3">
                  <button onClick={() => userAudioElRef.current?.play()} className="p-2 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700"><Volume2 size={18} /></button>
                  <span className="text-sm text-slate-500">Listen to your recording</span>
                  <audio ref={userAudioElRef} src={userAudioUrl} />
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Footer nav */}
      <div className="flex items-center justify-between">
        <button onClick={onPrev} className="text-sm font-medium text-slate-500 hover:text-slate-800 flex items-center gap-1"><ArrowLeft size={15} /> Previous</button>
        <button onClick={() => onComplete(day.day)} className={`px-5 py-2.5 rounded-full text-sm font-semibold transition-all ${completed ? "bg-green-100 text-green-700" : `${accentBg} text-white hover:scale-105 shadow-md`}`}>
          {completed ? <span className="inline-flex items-center gap-1.5"><Check size={15} /> Completed</span> : "Mark day complete"}
        </button>
        <button onClick={onNext} className="text-sm font-medium text-slate-500 hover:text-slate-800 flex items-center gap-1">Next <ArrowRight size={15} /></button>
      </div>
    </div>
  );
};

const SectionTitle: React.FC<{ icon: React.ReactNode; children: React.ReactNode }> = ({ icon, children }) => (
  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">{icon}<span>{children}</span></h3>
);

export default NovelReader;
