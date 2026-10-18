import React from 'react';
import { Compass, LogOut, User as UserIcon } from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';

interface HeaderProps {
  activeTab: 'chat' | 'trips' | 'profile';
  setActiveTab: (tab: 'chat' | 'trips' | 'profile') => void;
}

export const Header: React.FC<HeaderProps> = ({ activeTab, setActiveTab }) => {
  const { user, signOutUser, profile } = useAuth();

  return (
    <header className="bg-white border-b border-slate-200 sticky top-7 z-40 shadow-xs">
      <div className="max-w-4xl mx-auto px-4 py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-2.5 cursor-pointer" onClick={() => setActiveTab('chat')}>
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-700 to-sky-500 flex items-center justify-center text-white shadow-sm shadow-blue-500/20">
            <Compass className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h1 className="text-base font-bold text-slate-900 tracking-tight leading-none">SUKALP AI Buddy</h1>
              <span className="text-[10px] font-semibold bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full">Beta</span>
            </div>
            <p className="text-xs text-slate-500 font-medium leading-tight mt-0.5">Plan less. Experience more.</p>
          </div>
        </div>

        {user && (
          <div className="flex items-center gap-3">
            <button
              onClick={() => setActiveTab('profile')}
              className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg border transition-all text-xs font-medium ${
                activeTab === 'profile'
                  ? 'border-blue-500 bg-blue-50 text-blue-700 font-semibold'
                  : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
              }`}
            >
              {user.photoURL ? (
                <img src={user.photoURL} alt="Avatar" className="w-5 h-5 rounded-full object-cover" />
              ) : (
                <UserIcon className="w-4 h-4 text-slate-500" />
              )}
              <span className="hidden sm:inline max-w-[120px] truncate">
                {user.displayName || user.email?.split('@')[0] || 'My Profile'}
              </span>
              {profile?.traveller_type && (
                <span className="hidden md:inline text-[10px] bg-white border border-slate-200 px-1.5 py-0.2 rounded text-slate-600">
                  {profile.traveller_type}
                </span>
              )}
            </button>

            <button
              onClick={() => signOutUser()}
              title="Sign Out"
              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors border border-transparent hover:border-rose-100"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </header>
  );
};
