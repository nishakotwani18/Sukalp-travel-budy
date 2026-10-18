/**
 * SUKALP AI Buddy – Plan less. Experience more.
 * Conversational travel assistant powered by live Airtable catalogue data & Gemini 2.0 Flash
 */

import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext.tsx';

import { Header } from './components/Header.tsx';
import { BottomNav } from './components/BottomNav.tsx';
import { SignInView } from './views/SignInView.tsx';
import { ChatView } from './views/ChatView.tsx';
import { MyTripsView } from './views/MyTripsView.tsx';
import { ProfileView } from './views/ProfileView.tsx';
import { SharedItineraryView } from './views/SharedItineraryView.tsx';
import { CatalogueStatus } from './types.ts';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from './firebase.ts';
import { Compass } from 'lucide-react';

function MainApp() {
  const { user, loading } = useAuth();
  const [activeTab, setActiveTab] = useState<'chat' | 'trips' | 'profile'>('chat');
  const [catalogueStatus, setCatalogueStatus] = useState<CatalogueStatus | null>(null);
  const [savedTripsCount, setSavedTripsCount] = useState(0);
  const [sharedId, setSharedId] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      return params.get('share');
    }
    return null;
  });

  // Fetch catalogue health and status
  useEffect(() => {
    const fetchHealth = async () => {
      try {
        const res = await fetch('/api/health');
        if (res.ok) {
          try {
            const data = await res.json();
            setCatalogueStatus(data);
          } catch {
            console.warn('Catalogue health response was not valid JSON');
          }
        }
      } catch (err) {
        console.warn('Catalogue health check error:', err);
      }
    };

    fetchHealth();
    // Refresh catalogue health every 2 minutes
    const interval = setInterval(fetchHealth, 120000);
    return () => clearInterval(interval);
  }, []);

  // Monitor saved trips count for badge
  useEffect(() => {
    if (!user) {
      setSavedTripsCount(0);
      return;
    }

    const q = query(
      collection(db, 'saved_itineraries'),
      where('user_id', '==', user.uid)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        setSavedTripsCount(snapshot.size);
      },
      (err) => {
        console.warn('Saved trips listener count err:', err);
      }
    );

    return () => unsubscribe();
  }, [user]);

  // If user opened a public shared link, render read-only view directly
  if (sharedId) {
    return (
      <SharedItineraryView
        shareId={sharedId}
        onExploreApp={() => {
          setSharedId(null);
          if (typeof window !== 'undefined') {
            window.history.pushState({}, '', window.location.pathname);
          }
        }}
      />
    );
  }

  // Loading spinner during auth initialization
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-blue-700 to-sky-500 flex items-center justify-center text-white shadow-md shadow-blue-500/20 animate-bounce mb-3">
          <Compass className="w-6 h-6" />
        </div>
        <p className="text-sm font-bold text-slate-800">SUKALP AI Buddy</p>
        <p className="text-xs text-slate-500 mt-1">Initializing secure travel session...</p>
      </div>
    );
  }

  // If unauthenticated, show Sign In View (Auth requirement)
  if (!user) {
    return <SignInView />;
  }

  return (
    <div className="min-h-screen bg-slate-50/60 text-slate-900 flex flex-col font-sans">
     

      {/* 2. Sticky Header */}
      <Header activeTab={activeTab} setActiveTab={setActiveTab} />

      {/* 3. Main Views */}
      {/* 3. Main Views */}
      <main className="flex-1">
        <div className={activeTab === 'chat' ? 'block' : 'hidden'}>
          <ChatView onSavedItinerary={() => setActiveTab('trips')} />
        </div>
        <div className={activeTab === 'trips' ? 'block' : 'hidden'}>
          <MyTripsView onStartNewChat={() => setActiveTab('chat')} />
        </div>
        <div className={activeTab === 'profile' ? 'block' : 'hidden'}>
          <ProfileView />
        </div>
      </main>

      {/* 4. Sticky Bottom Navigation Bar */}
      <BottomNav
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        savedTripsCount={savedTripsCount}
      />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <MainApp />
    </AuthProvider>
  );
}
