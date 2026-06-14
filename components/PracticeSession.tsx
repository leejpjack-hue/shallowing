
import React, { useState, useEffect, useRef } from 'react';
import { Story, RecordingState, AnalysisResult } from '../types';
import { generateReferenceAudio, generateTeacherAudio, analyzePronunciation } from '../services/geminiService';
import { getCachedAudio, cacheAudio } from '../utils/db';
import { saveReferenceAudio, getReferenceAudioForStory } from '../services/firebaseService';
import { blobToBase64, decodeBase64 } from '../utils/audioUtils';
import { Play, Pause, Mic, Square, ArrowLeft, Loader2, Volume2, Sparkles, BookA, GraduationCap, Music, Cloud, Info, ExternalLink, Image as ImageIcon } from 'lucide-react';
import { RadialBarChart, RadialBar, PolarAngleAxis, ResponsiveContainer } from 'recharts';
import StoryVisualizer from './StoryVisualizer';

interface PracticeSessionProps {
  story: Story;
  onBack: () => void;
}

const PracticeSession: React.FC<PracticeSessionProps> = ({ story, onBack }) => {
  // Mode State
  const [audioMode, setAudioMode] = useState<'standard' | 'teacher'>('standard');

  // Audio URL States
  const [refAudioUrl, setRefAudioUrl] = useState<string | null>(null);
  const [teacherAudioUrl, setTeacherAudioUrl] = useState<string | null>(null);
  
  // Playback States
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoadingAudio, setIsLoadingAudio] = useState(false);
  const [loadingSource, setLoadingSource] = useState<'cache' | 'api' | null>(null);

  // Recording & Analysis States
  const [recordingState, setRecordingState] = useState<RecordingState>(RecordingState.IDLE);
  const [userAudioBlob, setUserAudioBlob] = useState<Blob | null>(null);
  const [userAudioUrl, setUserAudioUrl] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [showVisualizer, setShowVisualizer] = useState(false);

  // Refs
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);
  const userAudioElement = useRef<HTMLAudioElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);

  // Theme colors based on language
  const themeColor = story.language === 'french' ? 'text-french-blue' : 'text-japanese-red';
  const ringColor = story.language === 'french' ? 'ring-french-blue/10' : 'ring-japanese-red/10';
  const bgColor = story.language === 'french' ? 'bg-french-blue' : 'bg-japanese-red';
  const hoverBgColor = story.language === 'french' ? 'hover:bg-blue-700' : 'hover:bg-red-700';

  // Cleanup URLs on unmount
  useEffect(() => {
    return () => {
      if (refAudioUrl) URL.revokeObjectURL(refAudioUrl);
      if (teacherAudioUrl) URL.revokeObjectURL(teacherAudioUrl);
      if (userAudioUrl) URL.revokeObjectURL(userAudioUrl);
    };
  }, []);

  // Force reload of user audio element when URL changes
  useEffect(() => {
    if (userAudioElement.current && userAudioUrl) {
      userAudioElement.current.load();
    }
  }, [userAudioUrl]);

  // Effect: Handle Mode Switching or Initial Load with Caching
  useEffect(() => {
    // Reset playback when switching modes
    if (audioPlayerRef.current) {
      audioPlayerRef.current.pause();
      audioPlayerRef.current.currentTime = 0;
    }
    setIsPlaying(false);

    const loadAudioForMode = async () => {
      // Key format: storyId_mode
      const cacheKey = `${story.id}_${audioMode}`;
      
      // Check if we already have it in state (prevent re-fetch on simple renders)
      if (audioMode === 'standard' && refAudioUrl) return;
      if (audioMode === 'teacher' && teacherAudioUrl) return;

      setIsLoadingAudio(true);
      setLoadingSource('cache');

      try {
        // 1. Try Local Cache (IndexedDB)
        const cachedBlob = await getCachedAudio(cacheKey);
        
        if (cachedBlob) {
          const url = URL.createObjectURL(cachedBlob);
          if (audioMode === 'standard') setRefAudioUrl(url);
          else setTeacherAudioUrl(url);
          setLoadingSource(null);
          setIsLoadingAudio(false);
          return;
        }

        // 2. Try Cloud Database (Firestore)
        try {
          setLoadingSource('api'); // Reusing api label for external fetch
          const cloudAudios = await getReferenceAudioForStory(`${story.id}_${audioMode}`);
          if (cloudAudios.length > 0) {
            const cloudAudio = cloudAudios[0];
            const audioBytes = decodeBase64(cloudAudio.audioData);
            const blob = new Blob([audioBytes], { type: 'audio/wav' });
            const url = URL.createObjectURL(blob);
            
            if (audioMode === 'standard') setRefAudioUrl(url);
            else setTeacherAudioUrl(url);
            
            // Save to local cache for next time
            await cacheAudio(cacheKey, blob);
            
            setLoadingSource(null);
            setIsLoadingAudio(false);
            return;
          }
        } catch (cloudError) {
          console.warn("Cloud audio fetch failed", cloudError);
          // Fall through to Gemini API generation
        }

        // 3. Not in Cache or Cloud, Generate via Gemini API
        let blob: Blob;
        if (audioMode === 'standard') {
          blob = await generateReferenceAudio(story.content, story.language);
          setRefAudioUrl(URL.createObjectURL(blob));
        } else {
          blob = await generateTeacherAudio(story.content, story.language);
          setTeacherAudioUrl(URL.createObjectURL(blob));
        }

        // 4. Save to Local Cache
        await cacheAudio(cacheKey, blob);

        // 5. Save to Cloud Database
        const base64 = await blobToBase64(blob);
        await saveReferenceAudio({
          storyId: `${story.id}_${audioMode}`,
          audioData: base64,
          language: story.language
        });

      } catch (e) {
        console.error(`Failed to load ${audioMode} audio`, e);
      } finally {
        setIsLoadingAudio(false);
        setLoadingSource(null);
      }
    };

    loadAudioForMode();
  }, [audioMode, story.id, story.content, story.language]); 

  // Handle Play/Pause
  const toggleAudio = () => {
    if (!audioPlayerRef.current) return;
    
    if (isPlaying) {
      audioPlayerRef.current.pause();
    } else {
      audioPlayerRef.current.play().catch(e => console.error("Playback error", e));
    }
    setIsPlaying(!isPlaying);
  };

  const handleAudioEnded = () => setIsPlaying(false);

  // Recording Logic
  const startRecording = async () => {
    setAnalysis(null);
    setUserAudioBlob(null);
    chunksRef.current = [];
    
    // Pause any playing audio
    if (isPlaying && audioPlayerRef.current) {
      audioPlayerRef.current.pause();
      setIsPlaying(false);
    }
    
    try {
      // Optimize audio constraints for speech (lower bandwidth = faster upload)
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          channelCount: 1, // Mono
          sampleRate: 16000, // 16kHz is sufficient for speech analysis
          echoCancellation: true,
          noiseSuppression: true,
        } 
      });

      // Try to use a specific MIME type for better compression
      let options: MediaRecorderOptions = { mimeType: 'audio/webm;codecs=opus' };
      if (!MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
         options = { mimeType: 'audio/webm' }; // Fallback
         if (!MediaRecorder.isTypeSupported('audio/webm')) {
            options = {}; // Browser default
         }
      }
      
      // Set low bitrate to keep file size small
      options.audioBitsPerSecond = 24000; 

      const mediaRecorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        // Create blob with the correct type
        const mimeType = mediaRecorder.mimeType || 'audio/webm';
        const blob = new Blob(chunksRef.current, { type: mimeType });
        
        setUserAudioBlob(blob);
        const url = URL.createObjectURL(blob);
        setUserAudioUrl(url);
        
        // Auto analyze after stop
        setRecordingState(RecordingState.PROCESSING);
        const result = await analyzePronunciation(blob, story.content, story.language);
        setAnalysis(result);
        setRecordingState(RecordingState.ANALYZED);
      };

      mediaRecorder.start();
      setRecordingState(RecordingState.RECORDING);
    } catch (err) {
      console.error("Error accessing microphone:", err);
      alert("Microphone access denied or not available.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
    }
  };

  // Highlighting Logic
  const renderHighlightedText = () => {
    if (!analysis || !analysis.wordsToImprove || analysis.wordsToImprove.length === 0) {
      return story.content;
    }
    
    // Simple space splitting for French/English. 
    // For Japanese, we return text as is for now as client-side tokenization is heavy.
    if (story.language === 'japanese') {
       return story.content; 
    }

    const words = story.content.split(' ');
    return words.map((word, index) => {
      const cleanWord = word.replace(/[.,/#!$%^&*;:{}=\-_`~()]/g, "").toLowerCase();
      const isProblematic = analysis.wordsToImprove.some(w => w.toLowerCase() === cleanWord);
      
      if (isProblematic) {
        return <span key={index} className="text-red-600 bg-red-100 px-0.5 rounded font-semibold">{word} </span>;
      }
      return <span key={index}>{word} </span>;
    });
  };

  const currentAudioSrc = audioMode === 'standard' ? refAudioUrl : teacherAudioUrl;

  return (
    <div className="space-y-6 pb-20">
      {/* Navigation */}
      <div className="flex items-center justify-between mb-6">
        <button 
          onClick={onBack}
          className="flex items-center text-sm font-medium text-slate-500 hover:text-slate-800 transition-colors"
        >
          <ArrowLeft size={16} className="mr-1" /> Back to Stories
        </button>
        <button
          onClick={() => setShowVisualizer(true)}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold bg-white text-slate-600 border border-slate-200 hover:bg-slate-50 transition-all shadow-sm`}
        >
          <ImageIcon size={16} />
          Visualize Story
        </button>
      </div>

      {showVisualizer && (
        <StoryVisualizer 
          story={story} 
          onClose={() => setShowVisualizer(false)} 
        />
      )}

      {/* Main Card */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        
        {/* Story Display */}
        <div className="p-6 md:p-10 border-b border-slate-100">
          <h2 className="text-2xl font-serif font-bold text-slate-900 mb-6">{story.title}</h2>
          
          <div className="prose prose-lg max-w-none mb-6">
            <p className={`text-xl md:text-2xl leading-relaxed text-slate-800 ${story.language === 'japanese' ? 'font-jp font-medium' : 'font-serif'}`}>
              {recordingState === RecordingState.ANALYZED ? renderHighlightedText() : story.content}
            </p>
          </div>

          <div className="bg-slate-50 rounded-lg p-4 text-slate-600 italic font-serif border border-slate-100 mb-8">
            {story.translation}
          </div>

          {/* Key Vocabulary & Phonetics */}
          <div className="animate-fade-in">
             <h3 className={`text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2`}>
                <BookA size={14} className={themeColor} />
                Key Vocabulary & Phonetics
             </h3>
             <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
               {story.vocabulary.map((item, idx) => (
                 <div key={idx} className="flex flex-col p-3 rounded-lg border border-slate-100 bg-white hover:border-current transition-colors shadow-sm hover:text-slate-900" style={{ borderColor: 'transparent' }}>
                   <div className="flex items-baseline justify-between mb-1">
                     <span className={`font-medium text-slate-800 ${story.language === 'japanese' ? 'font-jp' : ''}`}>{item.word}</span>
                     <span className={`text-xs font-mono px-1.5 py-0.5 rounded ml-2 ${story.language === 'french' ? 'text-french-blue bg-blue-50' : 'text-japanese-red bg-red-50'}`}>
                       {item.phonetic}
                     </span>
                   </div>
                   <span className="text-xs text-slate-500">{item.translation}</span>
                 </div>
               ))}
             </div>
          </div>

          {/* Japanese Pronunciation Guidance */}
          {story.language === 'japanese' && (
            <div className="mt-8 animate-fade-in p-5 rounded-xl bg-japanese-light border border-japanese-red/10">
              <h3 className="text-sm font-bold text-japanese-red uppercase tracking-wider mb-4 flex items-center gap-2">
                <Info size={16} />
                Japanese Pronunciation Guide
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-slate-500 uppercase">Vowels (Boin)</h4>
                  <p className="text-sm text-slate-700 leading-relaxed">
                    Japanese has 5 pure vowels: <span className="font-bold text-japanese-red">A, I, U, E, O</span>. 
                    They are always short and consistent. Avoid "gliding" between sounds.
                  </p>
                </div>
                
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-slate-500 uppercase">Pitch Accent</h4>
                  <p className="text-sm text-slate-700 leading-relaxed">
                    Unlike English stress, Japanese uses <span className="font-bold text-japanese-red">Pitch</span> (High vs Low). 
                    Listen carefully to where the voice rises or falls in each word.
                  </p>
                </div>

                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-slate-500 uppercase">Consonants</h4>
                  <p className="text-sm text-slate-700 leading-relaxed">
                    The Japanese <span className="font-bold text-japanese-red">'R'</span> is a flap (like the 'tt' in "better"). 
                    Double consonants (っ) indicate a tiny pause or "stop".
                  </p>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-japanese-red/10 flex flex-wrap gap-4">
                <a 
                  href="https://www.nhk.or.jp/lesson/english/learn/pronunciation/" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-xs font-medium text-japanese-red hover:underline flex items-center gap-1"
                >
                  NHK Pronunciation Lessons <ExternalLink size={12} />
                </a>
                <a 
                  href="https://www.tofugu.com/japanese/japanese-pronunciation/" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-xs font-medium text-japanese-red hover:underline flex items-center gap-1"
                >
                  Tofugu Guide <ExternalLink size={12} />
                </a>
              </div>
            </div>
          )}
        </div>

        {/* Audio Controls */}
        <div className="p-6 bg-slate-50 border-b border-slate-100">
          
          {/* Mode Toggles */}
          <div className="flex gap-2 mb-6">
            <button
              onClick={() => setAudioMode('standard')}
              className={`flex-1 py-2 px-4 rounded-lg flex items-center justify-center gap-2 text-sm font-medium transition-all ${
                audioMode === 'standard' 
                  ? `bg-white shadow-sm ${themeColor} ring-1 ${ringColor}` 
                  : 'text-slate-500 hover:bg-white/50'
              }`}
            >
              <Music size={16} />
              Standard Audio
            </button>
            <button
              onClick={() => setAudioMode('teacher')}
              className={`flex-1 py-2 px-4 rounded-lg flex items-center justify-center gap-2 text-sm font-medium transition-all ${
                audioMode === 'teacher' 
                  ? `bg-white shadow-sm ${themeColor} ring-1 ${ringColor}` 
                  : 'text-slate-500 hover:bg-white/50'
              }`}
            >
              <GraduationCap size={16} />
              Teacher Mode
            </button>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            {/* Player Controls */}
            <div className="flex items-center gap-4 w-full sm:w-auto">
              <button
                onClick={toggleAudio}
                disabled={isLoadingAudio || !currentAudioSrc}
                className={`
                  h-14 w-14 rounded-full flex items-center justify-center transition-all shadow-sm flex-shrink-0
                  ${isLoadingAudio ? 'bg-slate-200 cursor-wait' : `${bgColor} text-white ${hoverBgColor} hover:scale-105`}
                `}
              >
                {isLoadingAudio ? (
                  <Loader2 size={24} className="animate-spin text-slate-500" />
                ) : isPlaying ? (
                  <Pause size={24} fill="currentColor" />
                ) : (
                  <Play size={24} fill="currentColor" className="ml-1" />
                )}
              </button>
              
              <div className="flex flex-col">
                <span className="text-sm font-semibold text-slate-900">
                  {audioMode === 'standard' ? 'Reference Audio' : 'Shadowing Coach'}
                </span>
                <span className="text-xs text-slate-500 flex items-center gap-1">
                  {isLoadingAudio ? (
                    loadingSource === 'cache' ? 'Checking cache...' : 'Fetching from cloud...'
                  ) : (
                     audioMode === 'standard' 
                    ? 'Natural native pronunciation' 
                    : 'Step-by-step breakdown with pauses'
                  )}
                  {!isLoadingAudio && <Cloud size={10} className="text-blue-400"/>}
                </span>
              </div>
              
              <audio 
                ref={audioPlayerRef} 
                src={currentAudioSrc || undefined} 
                onEnded={handleAudioEnded}
              />
            </div>

            {/* Recording Status */}
            {recordingState === RecordingState.RECORDING && (
              <div className="flex items-center gap-2 text-red-500 font-medium animate-pulse">
                  <span className="h-2 w-2 rounded-full bg-red-500"></span>
                  Recording...
              </div>
            )}
          </div>
        </div>

        {/* Action Bar */}
        <div className="p-6 flex flex-col items-center justify-center gap-4">
            
          {recordingState === RecordingState.IDLE || recordingState === RecordingState.ANALYZED ? (
            <button
              onClick={startRecording}
              className="group flex items-center gap-3 px-8 py-4 bg-slate-900 text-white rounded-full font-semibold shadow-lg hover:shadow-xl hover:bg-slate-800 transition-all active:scale-95"
            >
              <div className="bg-white/20 p-2 rounded-full group-hover:bg-white/30 transition-colors">
                 <Mic size={24} />
              </div>
              {recordingState === RecordingState.ANALYZED ? 'Try Again' : 'Start Recording'}
            </button>
          ) : recordingState === RecordingState.RECORDING ? (
            <button
              onClick={stopRecording}
              className="flex items-center gap-3 px-8 py-4 bg-red-500 text-white rounded-full font-semibold shadow-lg hover:bg-red-600 transition-all active:scale-95"
            >
               <Square size={24} fill="currentColor" />
               Stop & Analyze
            </button>
          ) : (
             <div className="flex items-center gap-3 px-8 py-4 bg-slate-100 text-slate-500 rounded-full font-medium">
               <Loader2 size={24} className="animate-spin" />
               Analyzing your voice...
             </div>
          )}

          <p className="text-xs text-slate-400">
            Listen to the reference first, then record yourself repeating it.
          </p>
        </div>
      </div>

      {/* Analysis Results */}
      {recordingState === RecordingState.ANALYZED && analysis && (
        <div className="animate-slide-up bg-white rounded-2xl shadow-sm border border-slate-200 p-6 md:p-8">
           <div className="flex flex-col md:flex-row gap-8">
             
             {/* Score Chart */}
             <div className="flex-shrink-0 flex flex-col items-center justify-center">
                <div className="relative w-32 h-32">
                   <ResponsiveContainer width="100%" height="100%">
                    <RadialBarChart 
                      innerRadius="80%" 
                      outerRadius="100%" 
                      barSize={10} 
                      data={[{ value: analysis.score, fill: analysis.score > 80 ? '#22c55e' : analysis.score > 50 ? '#f59e0b' : '#ef4444' }]} 
                      startAngle={90} 
                      endAngle={-270}
                    >
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

             {/* Feedback Text */}
             <div className="flex-1 space-y-4">
               <div>
                 <h3 className="text-lg font-semibold text-slate-900 mb-1">Feedback</h3>
                 <p className="text-slate-600 leading-relaxed">{analysis.feedback}</p>
               </div>
               
               {analysis.wordsToImprove.length > 0 ? (
                 <div>
                   <h4 className="text-sm font-semibold text-slate-900 mb-2 uppercase tracking-wide">Words to Improve</h4>
                   <div className="flex flex-wrap gap-2">
                     {analysis.wordsToImprove.map((word, i) => (
                       <span key={i} className="px-3 py-1 bg-red-50 text-red-600 rounded-full text-sm font-medium border border-red-100">
                         {word}
                       </span>
                     ))}
                   </div>
                 </div>
               ) : (
                  <div className="p-3 bg-green-50 text-green-700 rounded-lg text-sm border border-green-100 inline-block">
                    Excellent pronunciation! No errors detected.
                  </div>
               )}

               {/* User Recording Playback */}
               {userAudioUrl && (
                 <div className="pt-4 border-t border-slate-100 mt-4">
                   <div className="flex items-center gap-3">
                     <button 
                       onClick={() => userAudioElement.current?.play()}
                       className="p-2 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
                     >
                       <Volume2 size={18} />
                     </button>
                     <span className="text-sm text-slate-500">Listen to your recording</span>
                     <audio ref={userAudioElement} src={userAudioUrl} />
                   </div>
                 </div>
               )}
             </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default PracticeSession;
