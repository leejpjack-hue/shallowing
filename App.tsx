
import React, { useState, useEffect, Component, ErrorInfo, ReactNode } from 'react';
import { AppState, Story, User, Language } from './types';
import { STORIES } from './constants';
import StoryList from './components/StoryList';
import PracticeSession from './components/PracticeSession';
import WritingSession from './components/WritingSession';
import ConversationSession from './components/ConversationSession';
import LoginScreen from './components/LoginScreen';
import { Mic, LogOut, AlertCircle, BookOpen } from 'lucide-react';
import { testConnection } from './services/firebaseService';
import { auth } from './firebase';
import { onAuthStateChanged, signInAnonymously } from 'firebase/auth';

class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean, error: Error | null }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
          <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8 text-center">
            <h2 className="text-2xl font-bold text-red-600 mb-4">Something went wrong</h2>
            <p className="text-slate-600 mb-6">
              {this.state.error?.message.startsWith('{') 
                ? "A database error occurred. Please try again later."
                : this.state.error?.message || "An unexpected error occurred."}
            </p>
            <button 
              onClick={() => window.location.reload()}
              className="px-6 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors"
            >
              Reload Application
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default function App() {
  const [appState, setAppState] = useState<AppState>(AppState.LOGIN);
  const [currentStory, setCurrentStory] = useState<Story | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [currentLanguage, setCurrentLanguage] = useState<Language>('french');
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    testConnection();
    
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        setIsAuthReady(true);
        setAuthError(null);
      } else {
        setIsAuthReady(true);
      }
    });

    return () => unsubscribe();
  }, []);

  const handleLoginSuccess = (loggedInUser: User) => {
    setUser(loggedInUser);
    setAppState(AppState.MENU);
  };

  const handleLogout = async () => {
    try {
      await auth.signOut();
      setUser(null);
      setAppState(AppState.LOGIN);
      setCurrentStory(null);
      if (window.google) {
        window.google.accounts.id.disableAutoSelect();
      }
    } catch (err) {
      console.error("Logout failed", err);
    }
  };

  const handleSelectStory = (story: Story) => {
    setCurrentStory(story);
    setAppState(AppState.PRACTICE);
  };

  const handleWriteStory = (story: Story) => {
    setCurrentStory(story);
    setAppState(AppState.WRITING);
  };

  const handleChatStory = (story: Story) => {
    setCurrentStory(story);
    setAppState(AppState.CONVERSATION);
  };

  const handleBackToMenu = () => {
    setAppState(AppState.MENU);
    setCurrentStory(null);
  };

  const filteredStories = STORIES.filter(s => s.language === currentLanguage);

  // If in Login State, show Login Screen
  if (appState === AppState.LOGIN) {
    return <LoginScreen onLoginSuccess={handleLoginSuccess} />;
  }

  const isFrench = currentLanguage === 'french';

  return (
    <ErrorBoundary>
      <div className={`min-h-screen flex flex-col font-sans bg-slate-50 ${isFrench ? 'selection:bg-french-blue/20' : 'selection:bg-japanese-red/20'}`}>
        {/* Header */}
        <header className="bg-white border-b border-slate-200 sticky top-0 z-10 shadow-sm">
          <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
            <div 
              className="flex items-center gap-2 cursor-pointer"
              onClick={appState === AppState.PRACTICE ? handleBackToMenu : undefined}
            >
              <div className={`text-white p-2 rounded-lg transition-colors ${isFrench ? 'bg-french-blue' : 'bg-japanese-red'}`}>
                <Mic size={20} />
              </div>
              <h1 className="text-xl font-serif font-semibold tracking-tight">
                Lumière <span className="text-slate-400 font-sans font-normal text-sm ml-1 hidden sm:inline">Shadowing</span>
              </h1>
            </div>
            
            <div className="flex items-center gap-4">
               {/* Language Toggle */}
              {appState === AppState.MENU && (
                 <div className="flex bg-slate-100 rounded-lg p-1 mr-2">
                   <button
                     onClick={() => setCurrentLanguage('french')}
                     className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                       isFrench ? 'bg-white text-french-blue shadow-sm' : 'text-slate-500 hover:text-slate-700'
                     }`}
                   >
                     FR
                   </button>
                   <button
                     onClick={() => setCurrentLanguage('japanese')}
                     className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                       !isFrench ? 'bg-white text-japanese-red shadow-sm' : 'text-slate-500 hover:text-slate-700'
                     }`}
                   >
                     JP
                   </button>
                 </div>
              )}

              {appState === AppState.MENU && (
                <a
                  href="/novels.html"
                  className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-900 text-white hover:bg-slate-800 transition-colors mr-1"
                  title="Read & shadow famous novels, one passage a day for 100 days"
                >
                  <BookOpen size={14} />
                  Novels · 100 Days
                </a>
              )}

              <div className="hidden md:flex flex-col items-end mr-2">
                <span className="text-xs font-semibold text-slate-700">{user?.name}</span>
              </div>
              {user?.picture ? (
                 <img src={user.picture} alt="Profile" className="w-8 h-8 rounded-full border border-slate-200" />
              ) : (
                 <div className="w-8 h-8 rounded-full bg-slate-200"></div>
              )}
              <button 
                onClick={handleLogout}
                className="text-slate-400 hover:text-slate-800 transition-colors ml-1"
                title="Sign Out"
              >
                <LogOut size={18} />
              </button>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 max-w-4xl mx-auto w-full p-4 md:p-6">
          {authError && (
            <div className="bg-amber-50 border-l-4 border-amber-400 p-4 mb-6 rounded-r-xl animate-fade-in">
              <div className="flex">
                <div className="flex-shrink-0">
                  <AlertCircle className="h-5 w-5 text-amber-400" />
                </div>
                <div className="ml-3">
                  <p className="text-sm text-amber-700 font-medium">
                    {authError}
                  </p>
                </div>
              </div>
            </div>
          )}

          {appState === AppState.MENU && (
            <div className="animate-fade-in">
              <div className="mb-8 text-center space-y-2">
                <h2 className="text-3xl font-serif font-bold text-slate-900">
                  {isFrench ? `Bienvenue, ${user?.name?.split(' ')[0]}` : `ようこそ, ${user?.name?.split(' ')[0]}`}
                </h2>
                <p className="text-slate-500">
                  {isFrench ? 'Select a story to begin your shadowing practice.' : 'シャドーイングの練習を始めましょう。'}
                </p>
              </div>
              <StoryList 
              stories={filteredStories} 
              onSelect={handleSelectStory} 
              onWrite={handleWriteStory}
              onChat={handleChatStory}
            />
            </div>
          )}

          {appState === AppState.PRACTICE && currentStory && (
            <div className="animate-slide-up">
              <PracticeSession 
                story={currentStory} 
                onBack={handleBackToMenu} 
              />
            </div>
          )}

          {appState === AppState.WRITING && currentStory && (
            <div className="animate-slide-up">
              <WritingSession 
                story={currentStory} 
                onBack={handleBackToMenu} 
              />
            </div>
          )}

          {appState === AppState.CONVERSATION && currentStory && (
            <div className="animate-slide-up">
              <ConversationSession 
                story={currentStory} 
                onBack={handleBackToMenu} 
              />
            </div>
          )}
        </main>

        {/* Footer */}
        <footer className="border-t border-slate-200 bg-white py-6 mt-auto">
          <div className="max-w-4xl mx-auto px-4 text-center text-sm text-slate-400">
            <p>© {new Date().getFullYear()} Lumière App. Powered by Google Gemini.</p>
          </div>
        </footer>
      </div>
    </ErrorBoundary>
  );
}
