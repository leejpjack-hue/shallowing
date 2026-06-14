
import React, { useState, useEffect } from 'react';
import { Story, WritingMode, WritingResult } from '../types';
import { generateWritingPrompt, correctAndImproveStory } from '../services/geminiService';
import { ArrowLeft, Loader2, Send, CheckCircle2, Sparkles, PenTool, Type as TypeIcon } from 'lucide-react';

interface WritingSessionProps {
  story: Story;
  onBack: () => void;
}

const WritingSession: React.FC<WritingSessionProps> = ({ story, onBack }) => {
  const [mode, setMode] = useState<WritingMode>('fill-in-the-blank');
  const [prompt, setPrompt] = useState<string>('');
  const [solution, setSolution] = useState<string>('');
  const [userInput, setUserInput] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [result, setResult] = useState<WritingResult | null>(null);

  const themeColor = story.language === 'french' ? 'text-french-blue' : 'text-japanese-red';
  const bgColor = story.language === 'french' ? 'bg-french-blue' : 'bg-japanese-red';
  const lightBgColor = story.language === 'french' ? 'bg-blue-50' : 'bg-red-50';

  useEffect(() => {
    loadPrompt();
  }, [mode, story.id]);

  const loadPrompt = async () => {
    setIsLoading(true);
    setResult(null);
    setUserInput('');
    try {
      const data = await generateWritingPrompt(story.content, story.language, mode);
      setPrompt(data.prompt);
      if (data.solution) setSolution(data.solution);
    } catch (error) {
      console.error("Failed to load prompt", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!userInput.trim()) return;
    setIsLoading(true);
    try {
      const data = await correctAndImproveStory(userInput, story.language, story.content);
      setResult(data);
    } catch (error) {
      console.error("Failed to submit writing", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6 pb-20">
      <button 
        onClick={onBack}
        className="flex items-center text-sm font-medium text-slate-500 hover:text-slate-800 transition-colors"
      >
        <ArrowLeft size={16} className="mr-1" /> Back to Stories
      </button>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-6 md:p-8 border-b border-slate-100">
          <h2 className="text-2xl font-serif font-bold text-slate-900 mb-2">Writing Practice</h2>
          <p className="text-slate-500 mb-6">Based on: <span className="font-semibold">{story.title}</span></p>

          <div className="flex gap-2 mb-8">
            <button
              onClick={() => setMode('fill-in-the-blank')}
              className={`flex-1 py-3 px-4 rounded-xl flex items-center justify-center gap-2 text-sm font-medium transition-all ${
                mode === 'fill-in-the-blank' 
                  ? `${bgColor} text-white shadow-md` 
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <PenTool size={18} />
              Fill in the Blank
            </button>
            <button
              onClick={() => setMode('full-story')}
              className={`flex-1 py-3 px-4 rounded-xl flex items-center justify-center gap-2 text-sm font-medium transition-all ${
                mode === 'full-story' 
                  ? `${bgColor} text-white shadow-md` 
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <TypeIcon size={18} />
              Full Story
            </button>
          </div>

          {isLoading && !result ? (
            <div className="flex flex-col items-center justify-center py-12 space-y-4">
              <Loader2 size={40} className={`animate-spin ${themeColor}`} />
              <p className="text-slate-500 animate-pulse">Preparing your exercise...</p>
            </div>
          ) : (
            <div className="space-y-6">
              <div className={`p-6 rounded-xl ${lightBgColor} border border-current border-opacity-10`} style={{ borderColor: 'transparent' }}>
                <h3 className={`text-xs font-bold ${themeColor} uppercase tracking-wider mb-3`}>
                  {mode === 'fill-in-the-blank' ? 'Complete the text' : 'Writing Prompt'}
                </h3>
                <p className={`text-lg leading-relaxed text-slate-800 ${story.language === 'japanese' ? 'font-jp' : 'font-serif'}`}>
                  {prompt}
                </p>
              </div>

              <div className="space-y-4">
                <textarea
                  value={userInput}
                  onChange={(e) => setUserInput(e.target.value)}
                  placeholder={mode === 'fill-in-the-blank' ? "Type the full text here..." : "Write your story here..."}
                  className="w-full h-40 p-4 rounded-xl border border-slate-200 focus:ring-2 focus:ring-slate-900 focus:border-transparent transition-all resize-none font-sans"
                  disabled={isLoading || !!result}
                />
                
                {!result && (
                  <button
                    onClick={handleSubmit}
                    disabled={isLoading || !userInput.trim()}
                    className={`w-full py-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-all ${
                      userInput.trim() ? 'bg-slate-900 text-white hover:bg-slate-800 shadow-lg' : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                    }`}
                  >
                    {isLoading ? <Loader2 size={20} className="animate-spin" /> : <Send size={20} />}
                    Submit for Correction
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {result && (
          <div className="p-6 md:p-8 bg-slate-50 animate-slide-up space-y-8">
            <div className="flex items-center gap-2 text-green-600 font-bold">
              <CheckCircle2 size={24} />
              AI Feedback & Correction
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-100">
                  <h4 className="text-xs font-bold text-slate-400 uppercase mb-2">Your Version (Corrected)</h4>
                  <p className="text-slate-800 leading-relaxed">{result.corrected}</p>
                </div>
                <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-100">
                  <h4 className="text-xs font-bold text-slate-400 uppercase mb-2">AI Feedback</h4>
                  <p className="text-slate-600 italic">{result.feedback}</p>
                </div>
              </div>

              <div className="space-y-4">
                <div className={`p-5 rounded-xl shadow-md border border-current border-opacity-10 bg-white`} style={{ borderColor: 'transparent' }}>
                  <div className="flex items-center justify-between mb-2">
                    <h4 className={`text-xs font-bold ${themeColor} uppercase`}>Improved Version</h4>
                    <Sparkles size={16} className="text-amber-500" />
                  </div>
                  <p className={`text-lg leading-relaxed text-slate-900 mb-4 ${story.language === 'japanese' ? 'font-jp' : 'font-serif'}`}>
                    {result.improved}
                  </p>
                  <div className="pt-4 border-t border-slate-100">
                    <h5 className="text-[10px] font-bold text-slate-400 uppercase mb-1">Pronunciation (Phonetic)</h5>
                    <p className="text-sm font-mono text-slate-500">{result.phonetic}</p>
                  </div>
                </div>
              </div>
            </div>

            <button
              onClick={loadPrompt}
              className="w-full py-3 rounded-xl border-2 border-slate-200 text-slate-600 font-bold hover:bg-white transition-all"
            >
              Try Another Exercise
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default WritingSession;
