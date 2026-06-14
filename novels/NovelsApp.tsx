import React, { useEffect, useMemo, useState } from "react";
import { NOVELS, Novel } from "./novelData";
import NovelReader from "./NovelReader";
import {
  Mic, BookOpen, ArrowLeft, Check, Flame, ChevronRight, Calendar as CalIcon,
} from "lucide-react";

type Lang = "french" | "japanese";

const LS_DONE = (lang: Lang) => `novel_done_${lang}`;
const LS_LAST = (lang: Lang) => `novel_last_${lang}`;

function loadDone(lang: Lang): Set<number> {
  try {
    const raw = localStorage.getItem(LS_DONE(lang));
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}
function saveDone(lang: Lang, s: Set<number>) {
  localStorage.setItem(LS_DONE(lang), JSON.stringify([...s]));
}

export default function NovelsApp() {
  const [lang, setLang] = useState<Lang>(() => (localStorage.getItem("novel_lang") as Lang) || "french");
  const [view, setView] = useState<"calendar" | "reader">("calendar");
  const [selectedDay, setSelectedDay] = useState<number>(1);
  const [done, setDone] = useState<Record<Lang, Set<number>>>({
    french: loadDone("french"),
    japanese: loadDone("japanese"),
  });

  // Pre-warm browser speech voices (some browsers populate lazily).
  useEffect(() => {
    if ("speechSynthesis" in window) {
      window.speechSynthesis.getVoices();
      window.speechSynthesis.onvoiceschanged = () => window.speechSynthesis.getVoices();
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("novel_lang", lang);
  }, [lang]);

  const novel: Novel = useMemo(() => NOVELS.find((n) => n.language === lang) || NOVELS[0], [lang]);

  const lastDay = useMemo(() => {
    const v = parseInt(localStorage.getItem(LS_LAST(lang)) || "1", 10);
    return Number.isFinite(v) && v >= 1 && v <= 100 ? v : 1;
  }, [lang, done]);

  const completedCount = done[lang].size;
  const streakHint = completedCount;

  const openDay = (d: number) => {
    setSelectedDay(d);
    localStorage.setItem(LS_LAST(lang), String(d));
    setView("reader");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const markComplete = (d: number) => {
    setDone((prev) => {
      const next = { ...prev, [lang]: new Set(prev[lang]) };
      if (next[lang].has(d)) next[lang].delete(d);
      else next[lang].add(d);
      saveDone(lang, next[lang]);
      return next;
    });
  };

  const isFr = lang === "french";

  return (
    <div className={`min-h-screen flex flex-col font-sans bg-slate-50 ${isFr ? "selection:bg-french-blue/20" : "selection:bg-japanese-red/20"}`}>
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <a href="/" className="text-slate-400 hover:text-slate-700 transition-colors" title="Back to Lumière">
              <ArrowLeft size={18} />
            </a>
            <div className={`text-white p-2 rounded-lg ${isFr ? "bg-french-blue" : "bg-japanese-red"}`}>
              <BookOpen size={20} />
            </div>
            <div className="leading-tight">
              <h1 className="text-lg font-serif font-semibold tracking-tight">Novel Shadowing</h1>
              <p className="text-[11px] text-slate-400 -mt-0.5">100-day reading & speaking journey</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Progress chip */}
            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-100 text-xs font-semibold text-slate-600">
              <Flame size={13} className="text-orange-500" />
              {completedCount}/100 days
            </div>
            {/* Language toggle */}
            <div className="flex bg-slate-100 rounded-lg p-1">
              <button
                onClick={() => setLang("french")}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                  isFr ? "bg-white text-french-blue shadow-sm" : "text-slate-500 hover:text-slate-700"
                }`}
              >
                FR · Manon
              </button>
              <button
                onClick={() => setLang("japanese")}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                  !isFr ? "bg-white text-japanese-red shadow-sm" : "text-slate-500 hover:text-slate-700"
                }`}
              >
                JP · 銀河鉄道
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-5xl mx-auto w-full p-4 md:p-6">
        {view === "calendar" && (
          <CalendarView
            novel={novel}
            done={done[lang]}
            lastDay={lastDay}
            streakHint={streakHint}
            onOpen={openDay}
          />
        )}
        {view === "reader" && (
          <NovelReader
            novel={novel}
            day={novel.days[selectedDay - 1]}
            completed={done[lang].has(selectedDay)}
            onBack={() => setView("calendar")}
            onPrev={() => selectedDay > 1 && openDay(selectedDay - 1)}
            onNext={() => selectedDay < 100 && openDay(selectedDay + 1)}
            onComplete={markComplete}
          />
        )}
      </main>

      <footer className="border-t border-slate-200 bg-white py-5 mt-auto">
        <div className="max-w-5xl mx-auto px-4 text-center text-xs text-slate-400 space-y-1">
          <p>
            Passages from public-domain literature — {novel.source}. TTS via Gemini with automatic browser-voice fallback.
          </p>
          <p>
            <a href="/" className="underline hover:text-slate-600">← Back to Lumière Shadowing</a>
          </p>
        </div>
      </footer>
    </div>
  );
}

/* ----------------------------- Calendar ----------------------------- */

interface CalProps {
  novel: Novel;
  done: Set<number>;
  lastDay: number;
  streakHint: number;
  onOpen: (d: number) => void;
}

const CalendarView: React.FC<CalProps> = ({ novel, done, lastDay, streakHint, onOpen }) => {
  const isFr = novel.language === "french";
  const accentText = isFr ? "text-french-blue" : "text-japanese-red";
  const accentBg = isFr ? "bg-french-blue" : "bg-japanese-red";

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Hero */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className={`p-6 md:p-8 ${isFr ? "bg-gradient-to-br from-blue-50 to-white" : "bg-gradient-to-br from-rose-50 to-white"}`}>
          <div className="flex items-center gap-2 mb-2">
            <span className={`px-2.5 py-0.5 rounded text-xs font-semibold uppercase tracking-wide ${isFr ? "bg-blue-100 text-french-blue" : "bg-red-100 text-japanese-red"}`}>
              {novel.theme}
            </span>
          </div>
          <h2 className={`text-2xl md:text-3xl font-serif font-bold text-slate-900 ${!isFr ? "font-jp" : ""}`}>
            {novel.title}
          </h2>
          {novel.titleEn && <p className="text-slate-500 font-medium mt-0.5">{novel.titleEn}</p>}
          <p className="text-sm text-slate-500 mt-1">{novel.author}</p>
          <p className="text-sm text-slate-600 mt-3 leading-relaxed max-w-2xl">{novel.blurb}</p>
          <div className="mt-4 flex items-center gap-2 text-xs text-slate-400">
            <CalIcon size={13} /> {done.size}/100 days complete
            <span className="mx-1">·</span>
            Continue at <span className={`font-semibold ${accentText}`}>Day {lastDay}</span>
          </div>
          <button
            onClick={() => onOpen(lastDay)}
            className={`mt-4 inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-semibold text-white shadow-md hover:scale-105 transition-all ${accentBg}`}
          >
            <Mic size={16} /> {done.size === 0 ? "Start Day 1" : `Continue · Day ${lastDay}`}
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {/* Grid */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 md:p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wide">100-Day Path</h3>
          <span className="text-xs text-slate-400">Each day ≈ 200–300 words</span>
        </div>
        <div className="grid grid-cols-5 sm:grid-cols-8 md:grid-cols-10 gap-2">
          {novel.days.map((d) => {
            const isDone = done.has(d.day);
            const isLast = d.day === lastDay;
            return (
              <button
                key={d.day}
                onClick={() => onOpen(d.day)}
                title={`Day ${d.day} · ${d.title}`}
                className={`relative aspect-square rounded-lg flex flex-col items-center justify-center text-xs font-semibold transition-all border ${
                  isDone
                    ? "bg-green-500 text-white border-green-500 hover:bg-green-600"
                    : isLast
                    ? `${accentBg} text-white border-transparent hover:scale-105 shadow-md`
                    : "bg-white text-slate-600 border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                }`}
              >
                {isDone ? <Check size={15} /> : <span className="tabular-nums">{d.day}</span>}
                {isLast && !isDone && (
                  <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-orange-400 border-2 border-white" />
                )}
              </button>
            );
          })}
        </div>
        <div className="mt-4 flex items-center gap-4 text-[11px] text-slate-400">
          <span className="inline-flex items-center gap-1"><span className="h-3 w-3 rounded bg-green-500 inline-block" /> Complete</span>
          <span className="inline-flex items-center gap-1"><span className={`h-3 w-3 rounded ${accentBg} inline-block`} /> Current</span>
          <span className="inline-flex items-center gap-1"><span className="h-3 w-3 rounded bg-white border border-slate-300 inline-block" /> Available</span>
        </div>
      </div>
    </div>
  );
};
