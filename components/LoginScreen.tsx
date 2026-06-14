
import React, { useState } from 'react';
import { Mic, Lock, AlertCircle, User as UserIcon } from 'lucide-react';
import { User } from '../types';
import { auth } from '../firebase';
import { GoogleAuthProvider, signInWithPopup, signInAnonymously } from 'firebase/auth';

interface LoginScreenProps {
  onLoginSuccess: (user: User) => void;
}

const ALLOWED_EMAILS = ["leejpjack@gmail.com", "hontiffany@gmail.com"];

const LoginScreen: React.FC<LoginScreenProps> = ({ onLoginSuccess }) => {
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const user = result.user;
      
      if (user.email && ALLOWED_EMAILS.includes(user.email)) {
        onLoginSuccess({
          email: user.email,
          name: user.displayName || 'User',
          picture: user.photoURL || ''
        });
      } else {
        await auth.signOut();
        setError(`Access denied for ${user.email}. You are not authorized to use this app.`);
      }
    } catch (err: any) {
      console.error("Google sign-in failed", err);
      // Ignore popup closed by user error
      if (err.code !== 'auth/popup-closed-by-user') {
        setError("Sign-in failed: " + err.message);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleGuestLogin = async () => {
    setIsLoading(true);
    setError(null);
    try {
      await signInAnonymously(auth);
      onLoginSuccess({
        email: 'guest@example.com',
        name: 'Guest User',
        picture: ''
      });
    } catch (err: any) {
      setError("Guest login failed: " + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <div className="bg-white max-w-md w-full rounded-2xl shadow-xl border border-slate-100 overflow-hidden">
        <div className="bg-french-blue p-8 text-center">
          <div className="mx-auto bg-white/20 w-16 h-16 rounded-full flex items-center justify-center mb-4 backdrop-blur-sm">
            <Mic className="text-white" size={32} />
          </div>
          <h1 className="text-3xl font-serif font-bold text-white mb-2">Lumière</h1>
          <p className="text-blue-100 text-sm font-medium">French Shadowing Mastery</p>
        </div>

        <div className="p-8">
          <div className="text-center mb-8">
            <h2 className="text-xl font-semibold text-slate-800 mb-2">Welcome Back</h2>
            <p className="text-slate-500 text-sm">Please sign in to access your practice sessions.</p>
          </div>

          <div className="flex flex-col items-center space-y-4">
            <button
              onClick={handleGoogleLogin}
              disabled={isLoading}
              className="flex items-center justify-center gap-3 w-full max-w-[280px] bg-white border border-slate-300 text-slate-700 font-medium py-2.5 px-4 rounded-lg hover:bg-slate-50 transition-colors shadow-sm disabled:opacity-50"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              Sign in with Google
            </button>

            <button 
              onClick={handleGuestLogin}
              disabled={isLoading}
              className="flex items-center gap-2 text-slate-400 hover:text-slate-600 transition-colors text-xs font-medium mt-2 disabled:opacity-50"
            >
              <UserIcon size={14} />
              Continue as Guest
            </button>

            {error && (
              <div className="flex items-start gap-2 bg-red-50 text-red-600 p-3 rounded-lg text-xs md:text-sm mt-4 w-full border border-red-100 animate-slide-up">
                <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}
            
            <div className="flex items-center gap-1.5 text-xs text-slate-400 mt-4">
              <Lock size={12} />
              <span>Private Access Only</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginScreen;
