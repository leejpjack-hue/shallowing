
import React from 'react';
import { Story } from '../types';
import { BookOpen, ChevronRight, PenTool, MessageSquare } from 'lucide-react';

interface StoryListProps {
  stories: Story[];
  onSelect: (story: Story) => void;
  onWrite: (story: Story) => void;
  onChat: (story: Story) => void;
}

const StoryList: React.FC<StoryListProps> = ({ stories, onSelect, onWrite, onChat }) => {
  const getBadgeColor = (level: string) => {
    switch (level) {
      case 'A1': return 'bg-green-100 text-green-700';
      case 'A2': return 'bg-amber-100 text-amber-700';
      case 'N5': return 'bg-blue-100 text-blue-700';
      case 'N4': return 'bg-purple-100 text-purple-700';
      default: return 'bg-slate-100 text-slate-700';
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {stories.map((story) => (
        <div
          key={story.id}
          onClick={() => onSelect(story)}
          className="group relative bg-white rounded-xl p-5 border border-slate-200 hover:border-current hover:shadow-md transition-all duration-300 cursor-pointer overflow-hidden"
          style={{ borderColor: '' }}
        >
           {/* Dynamic Border Color on Hover based on Language */}
          <div className={`absolute inset-0 border-2 border-transparent transition-colors pointer-events-none rounded-xl
            ${story.language === 'french' ? 'group-hover:border-french-blue/50' : 'group-hover:border-japanese-red/50'}
          `}></div>

          <div className="absolute top-0 right-0 p-4 opacity-0 group-hover:opacity-100 transition-opacity">
            <ChevronRight className={story.language === 'french' ? 'text-french-blue' : 'text-japanese-red'} />
          </div>
          
          <div className="flex items-start justify-between mb-3">
            <span className={`px-2.5 py-0.5 rounded text-xs font-semibold uppercase tracking-wide ${getBadgeColor(story.level)}`}>
              {story.level}
            </span>
          </div>

          <h3 className={`text-lg font-serif font-semibold text-slate-900 mb-2 transition-colors ${story.language === 'french' ? 'group-hover:text-french-blue' : 'group-hover:text-japanese-red'}`}>
            {story.title}
          </h3>
          
          <p className={`text-sm text-slate-500 line-clamp-2 leading-relaxed ${story.language === 'japanese' ? 'font-jp' : ''}`}>
            {story.content}
          </p>
          
          <div className="mt-4 flex items-center justify-between">
            <div 
              onClick={(e) => { e.stopPropagation(); onSelect(story); }}
              className="flex items-center gap-2 text-xs font-medium text-slate-400 hover:text-slate-900 transition-colors"
            >
              <BookOpen size={14} />
              <span>Shadowing</span>
            </div>
            <div 
              onClick={(e) => { e.stopPropagation(); onWrite(story); }}
              className={`flex items-center gap-2 text-xs font-medium px-3 py-1 rounded-full bg-slate-100 transition-colors
                ${story.language === 'french' ? 'hover:bg-french-blue hover:text-white' : 'hover:bg-japanese-red hover:text-white'}
              `}
            >
              <PenTool size={14} />
              <span>Write</span>
            </div>
            <div 
              onClick={(e) => { e.stopPropagation(); onChat(story); }}
              className={`flex items-center gap-2 text-xs font-medium px-3 py-1 rounded-full bg-slate-100 transition-colors
                ${story.language === 'french' ? 'hover:bg-french-blue hover:text-white' : 'hover:bg-japanese-red hover:text-white'}
              `}
            >
              <MessageSquare size={14} />
              <span>Chat</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default StoryList;
