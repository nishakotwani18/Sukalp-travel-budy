import React from 'react';
import { MessageSquare, BookmarkCheck, User } from 'lucide-react';

interface BottomNavProps {
  activeTab: 'chat' | 'trips' | 'profile';
  setActiveTab: (tab: 'chat' | 'trips' | 'profile') => void;
  savedTripsCount?: number;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  activeTab,
  setActiveTab,
  savedTripsCount = 0
}) => {
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-slate-200 z-40 py-1.5 px-6 shadow-lg shadow-slate-900/5">
      <div className="max-w-md mx-auto flex items-center justify-around">
        <button
          onClick={() => setActiveTab('chat')}
          className={`flex flex-col items-center py-1 px-4 rounded-xl transition-all ${
            activeTab === 'chat'
              ? 'text-blue-600 font-semibold'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <div className={`p-1 rounded-lg ${activeTab === 'chat' ? 'bg-blue-100 text-blue-600' : ''}`}>
            <MessageSquare className="w-5 h-5" />
          </div>
          <span className="text-[11px] mt-0.5">Chat</span>
        </button>

        <button
          onClick={() => setActiveTab('trips')}
          className={`relative flex flex-col items-center py-1 px-4 rounded-xl transition-all ${
            activeTab === 'trips'
              ? 'text-blue-600 font-semibold'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <div className={`p-1 rounded-lg ${activeTab === 'trips' ? 'bg-blue-100 text-blue-600' : ''}`}>
            <BookmarkCheck className="w-5 h-5" />
          </div>
          <span className="text-[11px] mt-0.5">My Saved Trips</span>
          {savedTripsCount > 0 && (
            <span className="absolute top-0.5 right-3 bg-blue-600 text-white text-[10px] font-bold px-1.5 py-0.2 rounded-full min-w-[16px] text-center">
              {savedTripsCount}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('profile')}
          className={`flex flex-col items-center py-1 px-4 rounded-xl transition-all ${
            activeTab === 'profile'
              ? 'text-blue-600 font-semibold'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <div className={`p-1 rounded-lg ${activeTab === 'profile' ? 'bg-blue-100 text-blue-600' : ''}`}>
            <User className="w-5 h-5" />
          </div>
          <span className="text-[11px] mt-0.5">Profile</span>
        </button>
      </div>
    </nav>
  );
};
