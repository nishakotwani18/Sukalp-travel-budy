import React, { useState } from 'react';
import { Compass, ShieldCheck, MapPin, Sparkles, CheckCircle2, AlertCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';

export const SignInView: React.FC = () => {
  const { signInWithGoogle } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGoogleSignIn = async () => {
    try {
      setLoading(true);
      setError(null);
      await signInWithGoogle();
    } catch (err: any) {
      console.error('Sign-in error:', err);
      // If popup was blocked or iframe restriction
      if (err.code === 'auth/popup-blocked') {
        setError('Popup was blocked by your browser. Please allow popups to sign in with Google.');
      } else if (err.code === 'auth/cancelled-popup-request' || err.code === 'auth/popup-closed-by-user') {
        setError('Sign-in popup was closed. Please try again.');
      } else {
        setError(err.message || 'Unable to complete Google sign-in. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50/70 via-slate-50 to-white flex flex-col justify-center items-center px-4 py-8">
      <div className="w-full max-w-md bg-white border border-slate-200/80 rounded-2xl p-6 sm:p-8 shadow-xl shadow-blue-900/5">
        {/* Brand Icon & Heading */}
        <div className="flex flex-col items-center text-center mb-6">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-blue-700 to-sky-500 flex items-center justify-center text-white shadow-md shadow-blue-500/25 mb-4">
            <Compass className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">SUKALP AI Buddy</h1>
          <p className="text-sm font-semibold text-blue-600 mt-0.5">Plan less. Experience more.</p>
          <p className="text-xs text-slate-500 mt-2 max-w-xs leading-relaxed">
            Your conversational travel assistant that helps you plan less and experience more with verified stays and honest insights.
          </p>
        </div>

        {/* Feature Pills */}
        <div className="space-y-2.5 mb-7 bg-slate-50 border border-slate-100 rounded-xl p-3.5 text-xs text-slate-700">
          <div className="flex items-center gap-2.5">
            <MapPin className="w-4 h-4 text-blue-600 shrink-0" />
            <span>Verified destinations, hotels & real traveler feedback</span>
          </div>
          <div className="flex items-center gap-2.5">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>10 formatted evidence cards with safety verification</span>
          </div>
          <div className="flex items-center gap-2.5">
            <Sparkles className="w-4 h-4 text-amber-500 shrink-0" />
            <span>Personalized to your budget, food preferences & accessibility</span>
          </div>
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-sky-600 shrink-0" />
            <span>Save and view your customized itineraries anytime</span>
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mb-5 p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
            <div className="flex-1">
              <span>{error}</span>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="space-y-3">
          <button
            onClick={handleGoogleSignIn}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-xl shadow-sm shadow-blue-600/30 transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-60 cursor-pointer"
          >
            <svg className="w-4 h-4 bg-white rounded-full p-0.5" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
            <span className="text-sm font-semibold">
              {loading ? 'Connecting...' : 'Sign in with Google'}
            </span>
          </button>
        </div>

        <p className="text-[11px] text-slate-400 text-center mt-5">
          By signing in, you agree to access itineraries tailored to your profile.
        </p>
      </div>
    </div>
  );
};
