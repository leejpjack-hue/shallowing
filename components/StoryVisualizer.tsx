
import React, { useState, useEffect } from 'react';
import { Story, StoryImage } from '../types';
import { generateStoryImage } from '../services/geminiService';
import { saveStoryImage, getStoryImages } from '../services/firebaseService';
import { Loader2, Image as ImageIcon, Tag, X, AlertCircle } from 'lucide-react';

interface StoryVisualizerProps {
  story: Story;
  onClose: () => void;
}

const StoryVisualizer: React.FC<StoryVisualizerProps> = ({ story, onClose }) => {
  const [storyImage, setStoryImage] = useState<StoryImage | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showLabels, setShowLabels] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const themeColor = story.language === 'french' ? 'text-french-blue' : 'text-japanese-red';
  const bgColor = story.language === 'french' ? 'bg-french-blue' : 'bg-japanese-red';

  useEffect(() => {
    loadExistingImage();
  }, [story.id]);

  const loadExistingImage = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const existing = await getStoryImages(story.id);
      if (existing.length > 0) {
        setStoryImage(existing[0]);
      } else {
        await handleGenerate();
      }
    } catch (err: any) {
      console.error("Failed to load image", err);
      if (err.message?.includes('Missing or insufficient permissions')) {
        setError("Cloud storage access denied. Please ensure Anonymous Sign-in is enabled in Firebase.");
      } else {
        setError("Failed to load image from cloud.");
      }
      // If load fails, we can still try to generate locally if it's a permission issue on read
      if (!storyImage) await handleGenerate();
    } finally {
      setIsLoading(false);
    }
  };

  const handleGenerate = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const vocab = story.vocabulary.map(v => v.word);
      const generated = await generateStoryImage(story.content, vocab, story.language);
      const newImage: StoryImage = { ...generated, storyId: story.id };
      
      try {
        const id = await saveStoryImage(newImage);
        setStoryImage({ ...newImage, id });
      } catch (saveErr: any) {
        console.warn("Failed to save image to cloud", saveErr);
        // Still show the image even if saving fails
        setStoryImage(newImage);
        if (saveErr.message?.includes('exceeds the maximum allowed size')) {
          setError("Image too large to save to cloud, but you can still view it now.");
        } else if (saveErr.message?.includes('Missing or insufficient permissions')) {
          setError("Could not save to cloud (permissions).");
        }
      }
    } catch (err) {
      console.error("Failed to generate image", err);
      setError("AI generation failed. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-3xl w-full max-w-4xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ImageIcon className={themeColor} size={20} />
            <h3 className="font-serif font-bold text-slate-900">Story Visualization</h3>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
            <X size={20} className="text-slate-400" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {error && (
            <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-center gap-3 text-amber-700 text-sm">
              <AlertCircle size={18} />
              {error}
            </div>
          )}

          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-20 space-y-4">
              <Loader2 size={48} className={`animate-spin ${themeColor}`} />
              <p className="text-slate-500 animate-pulse font-medium">AI is painting your story...</p>
            </div>
          ) : storyImage ? (
            <div className="space-y-6">
              <div className="relative rounded-2xl overflow-hidden shadow-lg bg-slate-100 aspect-video">
                <img 
                  src={storyImage.imageUrl} 
                  alt={story.title} 
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
                
                {showLabels && storyImage.labels.map((label, idx) => (
                  <div 
                    key={idx}
                    className="absolute group"
                    style={{ left: `${label.x}%`, top: `${label.y}%` }}
                  >
                    <div className={`w-3 h-3 rounded-full ${bgColor} border-2 border-white shadow-sm cursor-help animate-pulse`} />
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                      <div className="bg-slate-900 text-white text-[10px] font-bold px-2 py-1 rounded whitespace-nowrap shadow-lg">
                        {label.word}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between">
                <div className="flex gap-4">
                  <button
                    onClick={() => setShowLabels(!showLabels)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all ${
                      showLabels ? `${bgColor} text-white` : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    <Tag size={16} />
                    {showLabels ? 'Hide Labels' : 'Show Labels'}
                  </button>
                </div>
                <button
                  onClick={handleGenerate}
                  className="text-sm font-bold text-slate-400 hover:text-slate-600 transition-colors"
                >
                  Regenerate Image
                </button>
              </div>

              <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                <h4 className="text-xs font-bold text-slate-400 uppercase mb-2">Vocabulary in this scene</h4>
                <div className="flex flex-wrap gap-2">
                  {storyImage.labels.map((label, idx) => (
                    <span key={idx} className="bg-white px-3 py-1 rounded-full text-xs font-medium text-slate-600 border border-slate-200">
                      {label.word}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-20">
              <p className="text-slate-500">Failed to load image. Please try again.</p>
              <button onClick={handleGenerate} className={`mt-4 px-6 py-2 rounded-xl ${bgColor} text-white font-bold`}>
                Retry Generation
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default StoryVisualizer;
