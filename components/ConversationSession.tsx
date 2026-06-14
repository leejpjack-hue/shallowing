
import React, { useState, useEffect, useRef } from 'react';
import { Story, ChatMessage } from '../types';
import { startTeacherChat, generateConversationFeedback } from '../services/geminiService';
import { ArrowLeft, Send, Loader2, User, Bot, GraduationCap, CheckCircle2 } from 'lucide-react';

interface ConversationSessionProps {
  story: Story;
  onBack: () => void;
}

const ConversationSession: React.FC<ConversationSessionProps> = ({ story, onBack }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [userInput, setUserInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [chat, setChat] = useState<any>(null);
  const [feedback, setFeedback] = useState<{ score: number; feedback: string } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const themeColor = story.language === 'french' ? 'text-french-blue' : 'text-japanese-red';
  const bgColor = story.language === 'french' ? 'bg-french-blue' : 'bg-japanese-red';
  const lightBgColor = story.language === 'french' ? 'bg-blue-50' : 'bg-red-50';

  useEffect(() => {
    const newChat = startTeacherChat(story.content, story.language);
    setChat(newChat);
    
    // Initial greeting
    const initialGreeting = async () => {
      setIsLoading(true);
      try {
        const response = await newChat.sendMessage({ message: "Hello teacher, I just finished reading the story. Can we talk about it?" });
        setMessages([{ role: 'model', text: response.text }]);
      } catch (error) {
        console.error("Failed to start chat", error);
      } finally {
        setIsLoading(false);
      }
    };
    
    initialGreeting();
  }, [story.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!userInput.trim() || isLoading || feedback) return;

    const userMessage: ChatMessage = { role: 'user', text: userInput };
    setMessages(prev => [...prev, userMessage]);
    setUserInput('');
    setIsLoading(true);

    try {
      const response = await chat.sendMessage({ message: userInput });
      setMessages(prev => [...prev, { role: 'model', text: response.text }]);
    } catch (error) {
      console.error("Failed to send message", error);
      setMessages(prev => [...prev, { role: 'model', text: "I'm sorry, I'm having trouble connecting. Could you try again?" }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFinish = async () => {
    setIsLoading(true);
    try {
      const result = await generateConversationFeedback(messages, story.language);
      setFeedback(result);
    } catch (error) {
      console.error("Failed to get feedback", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-12rem)] max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <button 
          onClick={onBack}
          className="flex items-center text-sm font-medium text-slate-500 hover:text-slate-800 transition-colors"
        >
          <ArrowLeft size={16} className="mr-1" /> Back to Stories
        </button>
        <div className="flex items-center gap-2">
          <GraduationCap className={themeColor} size={20} />
          <span className="font-serif font-bold text-slate-900">AI Teacher Session</span>
        </div>
      </div>

      <div className="flex-1 bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
        {/* Chat Area */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4">
          {messages.map((msg, idx) => (
            <div 
              key={idx} 
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-fade-in`}
            >
              <div className={`flex gap-3 max-w-[80%] ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                  msg.role === 'user' ? 'bg-slate-200 text-slate-600' : `${bgColor} text-white`
                }`}>
                  {msg.role === 'user' ? <User size={16} /> : <Bot size={16} />}
                </div>
                <div className={`p-4 rounded-2xl text-sm leading-relaxed ${
                  msg.role === 'user' 
                    ? 'bg-slate-900 text-white rounded-tr-none' 
                    : 'bg-slate-100 text-slate-800 rounded-tl-none'
                }`}>
                  {msg.text}
                </div>
              </div>
            </div>
          ))}
          {isLoading && !feedback && (
            <div className="flex justify-start animate-fade-in">
              <div className="flex gap-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${bgColor} text-white`}>
                  <Bot size={16} />
                </div>
                <div className="bg-slate-100 p-4 rounded-2xl rounded-tl-none">
                  <Loader2 size={16} className="animate-spin text-slate-400" />
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Feedback Display */}
        {feedback && (
          <div className="p-6 bg-slate-50 border-t border-slate-200 animate-slide-up">
            <div className="flex items-center gap-2 text-green-600 font-bold mb-4">
              <CheckCircle2 size={24} />
              Session Feedback
            </div>
            <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-100 mb-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-400 uppercase">Proficiency Score</span>
                <span className={`text-xl font-bold ${themeColor}`}>{feedback.score}%</span>
              </div>
              <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                <div 
                  className={`h-full ${bgColor} transition-all duration-1000`} 
                  style={{ width: `${feedback.score}%` }}
                ></div>
              </div>
            </div>
            <p className="text-slate-700 leading-relaxed italic">{feedback.feedback}</p>
            <button
              onClick={onBack}
              className="w-full mt-6 py-3 rounded-xl bg-slate-900 text-white font-bold hover:bg-slate-800 transition-all"
            >
              Return to Menu
            </button>
          </div>
        )}

        {/* Input Area */}
        {!feedback && (
          <div className="p-4 border-t border-slate-100 bg-white">
            <div className="flex gap-2">
              <input
                type="text"
                value={userInput}
                onChange={(e) => setUserInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSend()}
                placeholder={`Type your message in ${story.language}...`}
                className="flex-1 p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-slate-900 focus:border-transparent transition-all outline-none"
                disabled={isLoading}
              />
              <button
                onClick={handleSend}
                disabled={isLoading || !userInput.trim()}
                className={`p-3 rounded-xl transition-all ${
                  userInput.trim() ? `${bgColor} text-white shadow-md hover:opacity-90` : 'bg-slate-100 text-slate-400'
                }`}
              >
                <Send size={20} />
              </button>
            </div>
            <div className="mt-3 flex justify-center">
              <button
                onClick={handleFinish}
                disabled={messages.length < 3 || isLoading}
                className="text-xs font-bold text-slate-400 hover:text-slate-600 transition-colors uppercase tracking-wider"
              >
                Finish Session & Get Feedback
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ConversationSession;
