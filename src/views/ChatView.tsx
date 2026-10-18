import React, { useState, useRef, useEffect } from 'react';
import { 
  Send, 
  Sparkles, 
  Bookmark, 
  Check, 
  AlertOctagon, 
  CheckCircle2, 
  MapPin, 
  Bot, 
  User as UserIcon, 
  Compass, 
  ExternalLink,
  ShieldCheck,
  RefreshCw,
  FileDown,
  RotateCcw,
  Clock
} from 'lucide-react';
import { doc, setDoc, addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase.ts';
import { useAuth } from '../context/AuthContext.tsx';
import { ChatMessage, SavedItinerary } from '../types.ts';
import { EvidenceCardViewer } from '../components/EvidenceCardViewer.tsx';
import { exportItineraryToPdf } from '../utils/pdfExport.ts';

interface ChatViewProps {
  onSavedItinerary?: () => void;
}

const DEFAULT_WELCOME_MESSAGE: ChatMessage = {
  id: 'welcome_msg',
  sender: 'assistant',
  text: `Welcome to **SUKALP AI Buddy**! 🌟
Your conversational travel companion designed to help you **plan less and experience more**.

Here is how I make your trip planning effortless:
✨ **Verified Stays & Spots** — Recommendations backed by genuine traveler feedback and real attributes.
💰 **Realistic Cost Breakdowns** — Accurate budget estimates for hotels, dining, and local travel tailored to your preferences.
🛡️ **10-Point Evidence Insights** — Deep-dives into safety, cleanliness, transit times, regional food options, and honest trade-offs.
📌 **Save Any Itinerary** — Bookmark custom itineraries to your account with a single tap.

Where are you dreaming of going, or what vibe do you have in mind? (e.g., tranquil beaches, misty hill retreats, romantic palace views, or adventure treks)`,
  timestamp: 'Just now',
  reviewStatus: 'Auto-checked (no flags)'
};

const getChatStorageKey = (uid?: string) => uid ? `sukalp_chat_session_${uid}` : null;

function readMessagesFromStorage(uid?: string): ChatMessage[] | null {
  if (typeof window === 'undefined' || !uid) return null;
  const key = `sukalp_chat_session_${uid}`;
  try {
    const raw = localStorage.getItem(key) || sessionStorage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (err) {
    console.warn('Failed to parse stored chat session:', err);
  }
  return null;
}

function getStoredMessages(uid?: string): ChatMessage[] {
  if (!uid) {
    return [DEFAULT_WELCOME_MESSAGE];
  }
  const stored = readMessagesFromStorage(uid);
  if (stored && stored.length > 0) return stored;
  return [DEFAULT_WELCOME_MESSAGE];
}

const PROMPT_CHIPS = [
  '🏖️ Low crowd beach trip for couple under ₹4,000/day',
  '🏔️ Offbeat mountain stay in Manali with peaceful vibes',
  '🫖 Munnar tea gardens retreat with accessibility',
  '🏰 Romantic Udaipur lakefront with vegetarian dining',
  '🌊 Gokarna cliffside trek with budget beach cottages'
];

export const ChatView: React.FC<ChatViewProps> = ({ onSavedItinerary }) => {
  const { user, profile } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>(() => getStoredMessages(user?.uid));
  const activeUidRef = useRef<string | undefined>(user?.uid);

  // Requirement 11: Clear in-memory state on sign-out event
  useEffect(() => {
    const handleSignOutEvent = () => {
      setMessages([DEFAULT_WELCOME_MESSAGE]);
      activeUidRef.current = undefined;
    };
    window.addEventListener('sukalp_chat_signout', handleSignOutEvent);
    return () => window.removeEventListener('sukalp_chat_signout', handleSignOutEvent);
  }, []);

  // Requirement 11: When user signs out or switches, reset in-memory chat state or restore current user's uid history
  useEffect(() => {
    const prevUid = activeUidRef.current;
    activeUidRef.current = user?.uid;

    if (!user?.uid) {
      // User signed out: reset in-memory chat state to welcome message
      setMessages([DEFAULT_WELCOME_MESSAGE]);
      return;
    }

    // Only restore if user changed or was just logged in
    if (user.uid !== prevUid) {
      const stored = getStoredMessages(user.uid);
      setMessages(stored);
    }
  }, [user?.uid]);

  // Persist messages in storage ONLY under the signed-in user's uid
  useEffect(() => {
    try {
      if (!user) return;
      const key = `sukalp_chat_session_${user.uid}`;
      const data = JSON.stringify(messages);
      localStorage.setItem(key, data);
      sessionStorage.setItem(key, data);
    } catch (err) {
      console.warn('Could not store chat session:', err);
    }
  }, [messages, user?.uid]);

  // Sync across browser tabs for the same signed-in user
  useEffect(() => {
    if (!user) return;
    const activeKey = `sukalp_chat_session_${user.uid}`;

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === activeKey && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setMessages(parsed);
          }
        } catch (err) {
          console.warn('Error syncing storage across tabs:', err);
        }
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        const stored = readMessagesFromStorage(user.uid);
        if (stored && stored.length >= messages.length) {
          setMessages(stored);
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [user?.uid, messages.length]);

  const handleStartNewChat = () => {
    const freshWelcome: ChatMessage = {
      ...DEFAULT_WELCOME_MESSAGE,
      id: `welcome_${Date.now()}`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    setMessages([freshWelcome]);
    try {
      if (user) {
        const key = `sukalp_chat_session_${user.uid}`;
        localStorage.removeItem(key);
        sessionStorage.removeItem(key);
      }
      localStorage.removeItem('sukalp_chat_session_active');
    } catch (e) {}
  };

  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [activeSaveToast, setActiveSaveToast] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  const handleSendMessage = async (textToSend?: string) => {
    const query = (textToSend || input).trim();
    if (!query || loading) return;

    setInput('');

    // Add user message to UI immediately
    const userMsgId = `user_${Date.now()}`;
    const userMsg: ChatMessage = {
      id: userMsgId,
      sender: 'user',
      text: query,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages(prev => [...prev, userMsg]);
    setLoading(true);

    try {
      // Call server-side chat endpoint (requires a signed-in Firebase ID token)
      const idToken = user ? await user.getIdToken() : null;
      if (!idToken) throw new Error('Please sign in to continue.');
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + idToken },
        body: JSON.stringify({
          message: query,
          userProfile: profile,
          history: messages.slice(-4).map(m => ({
            role: m.sender === 'user' ? 'user' : 'model',
            text: m.text
          }))
        })
      });

      let data: any;
      try {
        const cloned = response.clone();
        try {
          data = await response.json();
        } catch {
          // Handle text responses gracefully when server returns HTTP 200 with non-JSON body
          const rawText = await cloned.text();
          data = {
            responseText: rawText || 'Received empty response from server.',
            destinationIds: [],
            reviewStatus: 'Auto-checked (no flags)',
            flaggedHotels: [],
            matchedDestinations: [],
            matchedHotels: []
          };
        }
      } catch {
        data = {
          responseText: 'Received non-JSON response from server.',
          destinationIds: [],
          reviewStatus: 'Auto-checked (no flags)',
          flaggedHotels: [],
          matchedDestinations: [],
          matchedHotels: []
        };
      }

      if (!response.ok || data?.error) {
        throw new Error(data?.error || `Server error (HTTP ${response.status})`);
      }

      if (!data?.itineraryJson && (!data?.responseText || data.responseText.startsWith('Our trip planner') || data.responseText.startsWith('Gemini API error'))) {
        throw new Error(data?.responseText || 'Unable to plan itinerary right now.');
      }

      const botMsg: ChatMessage = {
        id: `ai_${Date.now()}`,
        sender: 'assistant',
        text: data?.responseText || (typeof data === 'string' ? data : ''),
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        destinationIds: data?.destinationIds || [],
        reviewStatus: data?.reviewStatus || 'Auto-checked (no flags)',
        flaggedHotels: data?.flaggedHotels || [],
        matchedDestinations: data?.matchedDestinations || [],
        matchedHotels: data?.matchedHotels || [],
        saved: false,
        itineraryJson: data?.itineraryJson || null,
        badges: data?.badges || []
      };

      setMessages(prev => [...prev, botMsg]);
    } catch (err: any) {
      console.error('Chat error:', err);
      const rawError = String(err?.message || '');
      const isQuota = rawError.includes('429') ||
                      rawError.includes('RESOURCE_EXHAUSTED') ||
                      rawError.toLowerCase().includes('quota') ||
                      rawError.toLowerCase().includes('rate-limit') ||
                      rawError.toLowerCase().includes('rate limit') ||
                      rawError.toLowerCase().includes('busy right now') ||
                      err?.status === 429;
      // Requirement 10: Friendly quota message without raw API text
      const userFriendlyText = isQuota
        ? 'Our trip planner is busy right now — please try again in a few minutes.'
        : 'Our trip planner is temporarily unavailable — please try again in a moment.';

      // Requirement 9: Error responses must not look like itineraries
      const errorMsg: ChatMessage = {
        id: `err_${Date.now()}`,
        sender: 'assistant',
        text: userFriendlyText,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        isError: true,
        retryPrompt: query
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  };

  const viewedItineraryIds = useRef<Set<string>>(new Set());

  const logEvent = async (event: string, itineraryId: string) => {
    if (!user) return;
    try {
      await addDoc(collection(db, 'events'), {
        user_id: user.uid,
        event,
        itinerary_id: itineraryId,
        timestamp: serverTimestamp()
      });
    } catch (e) {
      console.warn('Event log failed (non-blocking):', e);
    }
  };

  const handleReportResult = async (message: ChatMessage) => {
    if (!user) return;
    const reason = window.prompt('What was wrong with this result?');
    if (!reason || !reason.trim()) return;
    try {
      await addDoc(collection(db, 'reports'), {
        user_id: user.uid,
        itinerary_id: message.id,
        reason: reason.trim().slice(0, 1000),
        timestamp: serverTimestamp()
      });
      setActiveSaveToast('Thanks, your report was sent.');
      setTimeout(() => setActiveSaveToast(null), 3000);
    } catch (e) {
      console.error('Report save failed:', e);
    }
  };

  useEffect(() => {
    messages.forEach(m => {
      if (m.id !== 'welcome_msg' && m.reviewStatus && !viewedItineraryIds.current.has(m.id)) {
        viewedItineraryIds.current.add(m.id);
        logEvent('itinerary_viewed', m.id);
      }
    });
  }, [messages]);

  const handleSaveItinerary = async (message: ChatMessage) => {
    if (!user || message.saved || message.isSaving || !message.itineraryJson) return;
    logEvent('itinerary_saved_or_booking_started', message.id);

    // Set saving state in message
    setMessages(prev =>
      prev.map(m => (m.id === message.id ? { ...m, isSaving: true } : m))
    );

    const itineraryId = `itin_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    const humanDestName = message.itineraryJson?.destination_name ||
      message.matchedDestinations?.[0]?.name ||
      message.matchedDestinations?.[0]?.destination_name ||
      message.text.match(/### 1\. Trip Overview:\s*([^\n\r]+)/)?.[1]?.trim() ||
      'Custom Getaway';
    const nightsVal = message.itineraryJson?.dates?.nights ||
      (message.text.match(/\((\d+)\s*[Nn]ights?\)/) ? parseInt(message.text.match(/\((\d+)\s*[Nn]ights?\)/)![1], 10) : 3);
    const destinationIdsStr = humanDestName;
    const createdAtIso = new Date().toISOString();
    const reviewStatusVal = message.reviewStatus || 'Auto-checked (no flags)';

    // 1. Save to Firestore `saved_itineraries` collection
    const firestorePath = `saved_itineraries/${itineraryId}`;
    const mostRecentUserMsg = [...messages].reverse().find(m => m.sender === 'user')?.text || 'Travel inquiry';
    const firestoreData: SavedItinerary = {
      id: itineraryId,
      user_id: user.uid,
      request_text: mostRecentUserMsg,
      response_text: message.text,
      destination_ids: destinationIdsStr,
      destination_name: humanDestName,
      nights: nightsVal,
      review_status: reviewStatusVal,
      created_at: createdAtIso,
      itinerary_json: message.itineraryJson || null
    };

    try {
      await setDoc(doc(db, 'saved_itineraries', itineraryId), firestoreData);
      
      // 2. Also forward itinerary log via server
      try {
        const saveToken = await user.getIdToken();
        await fetch('/api/save-itinerary-airtable', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + saveToken },
          body: JSON.stringify({
            itinerary_id: itineraryId,
            user_id: user.uid,
            traveller_type: profile?.traveller_type || 'traveller',
            trip_request: firestoreData.request_text,
            itinerary_text: firestoreData.response_text,
            destination_name: humanDestName,
            total_inr: message.itineraryJson?.cost?.total_inr || 0,
            review_status: firestoreData.review_status,
            accessibility_need: profile?.accessibility_need || '',
            ...buildEvidenceFields(message)
          })
        });
      } catch (airtableErr) {
        console.warn('Note: Log forward encountered an issue, but Firestore save succeeded:', airtableErr);
      }

      // Update message state in UI
      setMessages(prev =>
        prev.map(m => (m.id === message.id ? { ...m, isSaving: false, saved: true } : m))
      );

      setActiveSaveToast('Itinerary saved to My Saved Trips!');
      setTimeout(() => setActiveSaveToast(null), 3500);

      if (onSavedItinerary) {
        onSavedItinerary();
      }
    } catch (firestoreErr: any) {
      console.error('Firestore save failed:', firestoreErr);
      setMessages(prev =>
        prev.map(m => (m.id === message.id ? { ...m, isSaving: false } : m))
      );
      handleFirestoreError(firestoreErr, OperationType.CREATE, firestorePath);
    }
  };

  const handleExportDirectPdf = (message: ChatMessage) => {
    try {
      const userPrompt = messages.find(m => m.sender === 'user')?.text || 'Travel Itinerary';
      exportItineraryToPdf({
        id: message.id,
        user_id: user?.uid || 'guest',
        request_text: userPrompt,
        response_text: message.text,
        destination_ids: (message.destinationIds || []).join(', '),
        review_status: message.reviewStatus || 'Auto-checked (no flags)',
        created_at: new Date().toISOString()
      });
      setActiveSaveToast('Itinerary exported to PDF!');
      setTimeout(() => setActiveSaveToast(null), 3000);
    } catch (err) {
      console.error('Direct PDF export error:', err);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-7.5rem)] max-w-4xl mx-auto px-2 sm:px-4">
      {/* Toast alert */}
      {activeSaveToast && (
        <div className="fixed top-14 left-1/2 -translate-x-1/2 bg-slate-900 text-white px-4 py-2.5 rounded-xl shadow-lg z-50 flex items-center gap-2 text-xs animate-in fade-in slide-in-from-top duration-200">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{activeSaveToast}</span>
        </div>
      )}

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto py-4 space-y-4 pr-1">
        {/* Quick prompt suggestion chips */}
        <div className="pb-1">
          <div className="flex items-center justify-between gap-1.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
            <div className="flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-blue-500" />
              <span>Suggested Inquiries</span>
            </div>
            {messages.length > 1 && (
              <button
                onClick={handleStartNewChat}
                className="flex items-center gap-1 text-[11px] font-semibold text-slate-500 hover:text-blue-600 transition-colors cursor-pointer capitalize"
                title="Start a fresh trip inquiry"
              >
                <RotateCcw className="w-3 h-3" />
                <span>New Inquiry</span>
              </button>
            )}
          </div>
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none">
            {PROMPT_CHIPS.map((chip, idx) => (
              <button
                key={idx}
                onClick={() => handleSendMessage(chip)}
                className="shrink-0 bg-white hover:bg-blue-50 border border-slate-200 hover:border-blue-300 text-slate-700 text-xs px-3 py-1.5 rounded-xl transition-all shadow-2xs hover:shadow-xs text-left"
              >
                {chip}
              </button>
            ))}
          </div>
        </div>

        {/* Message items */}
        {messages.map((message) => {
          const isUser = message.sender === 'user';
          const isFlagged = message.reviewStatus === 'Flagged – pending review' || message.reviewStatus === 'Pending review' || message.reviewStatus === 'Awaiting human review';
          const isApproved = message.reviewStatus === 'Auto-checked (no flags)' || message.reviewStatus === 'Auto-approved (no flags)';

          return (
            <div
              key={message.id}
              className={`flex items-start gap-2.5 sm:gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}
            >
              {/* Avatar */}
              <div
                className={`w-8 h-8 rounded-xl shrink-0 flex items-center justify-center text-xs font-bold ${
                  isUser
                    ? 'bg-blue-600 text-white shadow-2xs'
                    : 'bg-gradient-to-tr from-blue-700 to-sky-500 text-white shadow-2xs'
                }`}
              >
                {isUser ? <UserIcon className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
              </div>

              {/* Message Bubble Container */}
              <div
                className={`max-w-[92%] sm:max-w-[85%] rounded-2xl ${
                  isUser
                    ? 'bg-blue-600 text-white p-3.5 rounded-tr-xs shadow-xs'
                    : 'bg-white border border-slate-200/90 rounded-tl-xs p-4 shadow-2xs text-slate-900 w-full'
                }`}
              >
                {isUser ? (
                  <p className="text-xs sm:text-sm whitespace-pre-wrap leading-relaxed">
                    {message.text}
                  </p>
                ) : (
                  <div>
                    {/* VERIFIED STATUS BADGE (Only show on successful itinerary responses, not errors) */}
                    {message.id !== 'welcome_msg' && !message.isError && Boolean(message.itineraryJson) && (
                      <div className="mb-3.5">
                        {isFlagged ? (
                          <div className="bg-amber-50/90 border border-amber-200 rounded-xl px-3 py-1.5 flex items-center justify-between text-xs text-amber-900">
                            <div className="flex items-center gap-1.5">
                              <Clock className="w-4 h-4 text-amber-600 shrink-0" />
                              <span className="font-semibold text-[11px] text-amber-800">
                                Awaiting human review
                              </span>
                            </div>
                            <span className="text-[10px] text-amber-700 bg-white/70 px-2 py-0.5 rounded-full border border-amber-100">
                              Pending verification
                            </span>
                          </div>
                        ) : (
                          <div className="bg-emerald-50/80 border border-emerald-200 rounded-xl px-3 py-1.5 flex items-center justify-between text-xs text-emerald-900">
                            <div className="flex items-center gap-1.5">
                              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                              <span className="font-semibold text-[11px] text-emerald-800">
                                Auto-checked (no flags)
                              </span>
                            </div>
                            <span className="text-[10px] text-emerald-700 bg-white/70 px-2 py-0.5 rounded-full border border-emerald-100">
                              Verified stays & genuine reviews
                            </span>
                          </div>
                        )}

                        {/* Additional Safety & Budget Badges */}
                        {message.badges && message.badges.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mt-2">
                            {message.badges.map((badge, bIdx) => (
                              <span key={bIdx} className="inline-flex items-center gap-1 text-[11px] font-medium bg-amber-50 text-amber-900 border border-amber-200/80 px-2.5 py-1 rounded-lg shadow-2xs">
                                <AlertOctagon className="w-3 h-3 text-amber-600 shrink-0" />
                                <span>{badge}</span>
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Message Body */}
                    {message.id === 'welcome_msg' ? (
                      <div className="space-y-3 text-xs sm:text-sm text-slate-800 leading-relaxed">
                        <div>
                          <p className="font-bold text-slate-900 text-sm sm:text-base flex items-center gap-1.5">
                            <span>Welcome to SUKALP AI Buddy!</span>
                            <span>🌟</span>
                          </p>
                          <p className="text-slate-600 mt-1">
                            Your conversational travel companion designed to help you <strong className="text-blue-700">plan less and experience more</strong>.
                          </p>
                        </div>

                        <div className="bg-slate-50/80 border border-slate-200/80 rounded-xl p-3.5 space-y-2">
                          <p className="font-semibold text-slate-800 text-xs">Here is how I make your trip planning effortless:</p>
                          <div className="space-y-1.5 text-xs text-slate-700">
                            <div className="flex items-start gap-2">
                              <span className="shrink-0 text-amber-500">✨</span>
                              <p><strong className="text-slate-900">Verified Stays & Spots</strong> — Recommendations backed by genuine traveler feedback and real attributes.</p>
                            </div>
                            <div className="flex items-start gap-2">
                              <span className="shrink-0 text-emerald-600">💰</span>
                              <p><strong className="text-slate-900">Realistic Cost Breakdowns</strong> — Accurate budget estimates for hotels, dining, and local travel tailored to your preferences.</p>
                            </div>
                            <div className="flex items-start gap-2">
                              <span className="shrink-0 text-blue-600">🛡️</span>
                              <p><strong className="text-slate-900">10-Point Evidence Insights</strong> — Deep-dives into safety, cleanliness, transit times, regional food options, and honest trade-offs.</p>
                            </div>
                            <div className="flex items-start gap-2">
                              <span className="shrink-0 text-rose-500">📌</span>
                              <p><strong className="text-slate-900">Save Any Itinerary</strong> — Bookmark custom itineraries to your account with a single tap.</p>
                            </div>
                          </div>
                        </div>

                        <p className="text-slate-700 text-xs sm:text-sm">
                          Where are you dreaming of going, or what vibe do you have in mind? <span className="text-slate-500">(e.g., tranquil beaches, misty hill retreats, romantic palace views, or adventure treks)</span>
                        </p>
                      </div>
                    ) : message.isError ? (
                      /* Requirement 9: Neutral error bubble with a Try again button */
                      <div className="py-1">
                        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-slate-700 text-xs sm:text-sm">
                          <p className="leading-relaxed font-medium text-slate-800">{message.text}</p>
                          {message.retryPrompt && (
                            <div className="mt-3 pt-2.5 border-t border-slate-200">
                              <button
                                onClick={() => handleSendMessage(message.retryPrompt)}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-800 text-xs font-semibold rounded-lg border border-slate-300 shadow-2xs hover:shadow-xs transition-all cursor-pointer"
                              >
                                <RotateCcw className="w-3.5 h-3.5 text-slate-600" />
                                <span>Try again</span>
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    ) : (
                      /* Formatted Evidence Cards View for AI itinerary answers */
                      <EvidenceCardViewer text={message.text} reviewStatus={message.reviewStatus} explanation={message.ai_explanation} />
                    )}

                    {/* Matched Dest & Hotel Pills if available */}
                    {!message.isError && Boolean(message.itineraryJson) && message.matchedDestinations && message.matchedDestinations.length > 0 && (
                      <div className="mt-3.5 pt-3 border-t border-slate-100 flex flex-wrap items-center gap-1.5">
                        <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                          Recommended Spots:
                        </span>
                        {message.matchedDestinations.map(d => (
                          <span
                            key={d.id}
                            className="inline-flex items-center gap-1 text-[11px] bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-lg"
                          >
                            <MapPin className="w-3 h-3 text-blue-500" />
                            <span>{d.name}</span>
                          </span>
                        ))}
                      </div>
                    )}

                    {/* ACTION BUTTONS: EXPORT PDF & SAVE THIS ITINERARY (Requirement 9: Hidden on error responses) */}
                    {message.id !== 'welcome_msg' && !message.isError && Boolean(message.itineraryJson) && (
                      <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between flex-wrap gap-2">
                        <div className="text-[10px] text-slate-400">
                          {message.timestamp}
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleExportDirectPdf(message)}
                            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-all border border-slate-200 cursor-pointer shadow-2xs"
                            title="Export to PDF for offline use"
                          >
                            <FileDown className="w-3.5 h-3.5 text-blue-600" />
                            <span>Export PDF</span>
                          </button>

                          <button
                            onClick={() => handleSaveItinerary(message)}
                            disabled={message.saved || message.isSaving || !message.itineraryJson}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                              message.saved
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                : message.isSaving
                                ? 'bg-slate-100 text-slate-500 border border-slate-200'
                                : 'bg-blue-600 hover:bg-blue-700 text-white shadow-xs hover:shadow-sm'
                            }`}
                          >
                            {message.saved ? (
                              <>
                                <Check className="w-3.5 h-3.5 text-emerald-700" />
                                <span>Saved to My Trips</span>
                              </>
                            ) : message.isSaving ? (
                              <>
                                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                <span>Saving your trip...</span>
                              </>
                            ) : (
                              <>
                                <Bookmark className="w-3.5 h-3.5" />
                                <span>Save this itinerary</span>
                              </>
                            )}
                          </button>

                          <button
                            onClick={() => handleReportResult(message)}
                            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-white hover:bg-slate-50 text-slate-600 transition-all border border-slate-200 cursor-pointer"
                            title="Tell us what was wrong with this result"
                          >
                            <span>Report this result</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* User message timestamp */}
                {isUser && (
                  <div className="text-[10px] text-blue-200 text-right mt-1.5">
                    {message.timestamp}
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {/* Loading Indicator */}
        {loading && (
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-blue-700 to-sky-500 text-white flex items-center justify-center shrink-0">
              <Bot className="w-4 h-4" />
            </div>
            <div className="bg-white border border-slate-200 rounded-2xl rounded-tl-xs p-4 shadow-2xs max-w-sm">
              <div className="flex items-center gap-2 mb-2">
                <span className="w-2 h-2 rounded-full bg-blue-600 animate-ping" />
                <span className="text-xs font-semibold text-slate-700">
                  Planning your experience...
                </span>
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Finding verified destinations and matching stays with real reviews...
              </p>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Form Bar */}
      <div className="py-2.5 pb-20 bg-transparent">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage();
          }}
          className="relative flex items-center bg-white border border-slate-300 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-100 rounded-2xl shadow-sm transition-all"
        >
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask anything (e.g., 'Offbeat mountain getaway for couple with vegetarian food')..."
            rows={1}
            className="w-full py-3 pl-4 pr-12 text-xs sm:text-sm bg-transparent resize-none focus:outline-hidden max-h-32 text-slate-800 placeholder-slate-400"
          />

          <button
            type="submit"
            disabled={!input.trim() || loading}
            className="absolute right-2 p-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl disabled:opacity-40 transition-all cursor-pointer shadow-xs disabled:cursor-not-allowed"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
        <p className="text-[10px] text-slate-400 text-center mt-1.5">
          Personalized recommendations grounded in verified travel data & safety standards.
        </p>
      </div>
    </div>
  );
};

function buildEvidenceFields(message: any): Record<string, string> {
  const dest: any = (message.matchedDestinations || [])[0] || {};
  const it: any = message.itineraryJson || {};
  return {
    estimated_travel_time: String(dest.typical_travel_time || ''),
    safety_notes: String(dest.safety_information || it.safety_notes || ''),
    cleanliness_notes: String(dest.cleanliness_information || ''),
    vegetarian_notes: String(dest.vegetarian_information || it.food_notes || ''),
    evidence_source_reviews: (it.evidence || []).map((e: any) => e.review_id + ': ' + e.quote).join(' | '),
    assumptions: (it.assumptions || []).join('; '),
    alternatives: (it.alternatives || []).map((a: any) => a.destination_name + ' (' + a.popularity_tier + '): ' + a.why).join('; ')
  };
}
