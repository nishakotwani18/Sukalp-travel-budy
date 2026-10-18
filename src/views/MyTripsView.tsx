import React, { useEffect, useState } from 'react';
import { 
  BookmarkCheck, 
  Clock, 
  Trash2, 
  ChevronDown, 
  ChevronUp, 
  Sparkles, 
  MapPin, 
  CheckCircle2, 
  AlertTriangle, 
  ArrowRight, 
  FileDown, 
  Check,
  Share2
} from 'lucide-react';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  deleteDoc, 
  doc,
  updateDoc
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase.ts';
import { useAuth } from '../context/AuthContext.tsx';
import { SavedItinerary } from '../types.ts';
import { EvidenceCardViewer } from '../components/EvidenceCardViewer.tsx';
import { exportItineraryToPdf } from '../utils/pdfExport.ts';

interface MyTripsViewProps {
  onStartNewChat: () => void;
}

function formatTripTitle(item: SavedItinerary): string {
  let destName = item.destination_name;
  let nights = item.nights;

  if (!destName && item.itinerary_json?.destination_name) {
    destName = item.itinerary_json.destination_name;
  }
  if (!nights && item.itinerary_json?.dates?.nights) {
    nights = item.itinerary_json.dates.nights;
  }

  if (item.response_text) {
    if (!destName || /^D\d+/.test(destName) || destName === 'verified_catalogue_spots' || destName.includes(',')) {
      const match = item.response_text.match(/### 1\. Trip Overview:\s*([^\n\r]+)/) ||
                    item.response_text.match(/\*\s*\*\*Destination:\*\*\s*\*\*([^*]+)\*\*/);
      if (match) destName = match[1].trim();
    }
    if (!nights) {
      const match = item.response_text.match(/\((\d+)\s*[Nn]ights?\)/) ||
                    item.response_text.match(/\b(\d+)\s*[Nn]ights?\b/);
      if (match) nights = parseInt(match[1], 10);
    }
  }

  if ((!destName || /^D\d+/.test(destName) || destName === 'verified_catalogue_spots' || destName.includes(',')) &&
      item.destination_ids && !/^D\d+/.test(item.destination_ids) && item.destination_ids !== 'verified_catalogue_spots' && !item.destination_ids.includes(',')) {
    destName = item.destination_ids;
  }

  // Fallback if destination was an ID or placeholder
  if (!destName || /^D\d+/.test(destName) || destName === 'verified_catalogue_spots') {
    destName = 'Custom Getaway';
  }

  const finalNights = nights || 3;
  return `${destName} · ${finalNights} nights`;
}

export const MyTripsView: React.FC<MyTripsViewProps> = ({ onStartNewChat }) => {
  const { user } = useAuth();
  const [itineraries, setItineraries] = useState<SavedItinerary[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'approved' | 'pending'>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [exportingId, setExportingId] = useState<string | null>(null);
  const [pdfSuccessId, setPdfSuccessId] = useState<string | null>(null);
  const [sharedToastId, setSharedToastId] = useState<string | null>(null);
  const [airtableStatuses, setAirtableStatuses] = useState<Record<string, string>>({});
  // Approved "why this itinerary" text per saved trip. Only ever filled for Approved rows.
  const [approvedExplanations, setApprovedExplanations] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!user) {
      setItineraries([]);
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, 'saved_itineraries'),
      where('user_id', '==', user.uid)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const items: SavedItinerary[] = [];
        snapshot.forEach((docSnap) => {
          items.push({
            id: docSnap.id,
            ...(docSnap.data() as Omit<SavedItinerary, 'id'>)
          });
        });
        // Sort descending by created_at
        items.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        setItineraries(items);
        setLoading(false);
      },
      (error) => {
        console.error('Error fetching saved itineraries:', error);
        setLoading(false);
        handleFirestoreError(error, OperationType.LIST, 'saved_itineraries');
      }
    );

    return () => unsubscribe();
  }, [user]);

  // Itineraries logged in Airtable Itinerary_Log for this user (generated, saved or not),
  // with each one's review status and, only when Approved, the approved explanation.
  const [logItems, setLogItems] = useState<SavedItinerary[]>([]);
  useEffect(() => {
    if (!user) { setLogItems([]); return; }
    let cancelled = false;
    const load = async () => {
      try {
        const idToken = await user.getIdToken();
        const r = await fetch('/api/my-itineraries', { headers: { Authorization: 'Bearer ' + idToken } });
        if (!r.ok) return;
        const data = await r.json();
        if (cancelled || !Array.isArray(data?.items)) return;
        const statuses: Record<string, string> = {};
        const explanations: Record<string, string> = {};
        const items: SavedItinerary[] = data.items.map((it: any) => {
          statuses[it.id] = it.status;
          if (it.approved_explanation) explanations[it.id] = it.approved_explanation;
          const parts = String(it.summary || '').split(' · ');
          const nightsMatch = String(it.summary || '').match(/(\d+)\s*nights?/i);
          return {
            id: it.id,
            user_id: user.uid,
            request_text: it.request_text,
            response_text: it.response_text,
            destination_ids: parts[0] || '',
            destination_name: parts[0] || 'Custom Getaway',
            nights: nightsMatch ? parseInt(nightsMatch[1], 10) : undefined,
            review_status: it.status,
            created_at: it.created_at,
            source: 'log'
          } as SavedItinerary;
        });
        setAirtableStatuses(statuses);
        setApprovedExplanations(explanations);
        setLogItems(items);
      } catch (err: any) {
        console.warn('[My Itineraries Fetch Notice]:', err?.message);
      }
    };
    load();
    const timer = setInterval(load, 60000); // refresh review status every minute
    return () => { cancelled = true; clearInterval(timer); };
  }, [user, itineraries.length]);

  // Saved trips (Firestore) first-class; add Airtable-logged itineraries that were never saved.
  const savedIds = new Set(itineraries.map(i => i.id));
  const allItems: SavedItinerary[] = [
    ...itineraries.map(i => ({ ...i, source: 'saved' as const })),
    ...logItems.filter(i => !savedIds.has(i.id))
  ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm('Remove this saved itinerary?')) return;
    try {
      await deleteDoc(doc(db, 'saved_itineraries', id));
    } catch (err: any) {
      console.error('Delete error:', err);
      handleFirestoreError(err, OperationType.DELETE, `saved_itineraries/${id}`);
    }
  };

  const handleExportPdf = (item: SavedItinerary, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      setExportingId(item.id);
      exportItineraryToPdf(item);
      setPdfSuccessId(item.id);
      setTimeout(() => setPdfSuccessId(null), 3000);
    } catch (err) {
      console.error('PDF export error:', err);
    } finally {
      setExportingId(null);
    }
  };

  const handleShareItinerary = async (item: SavedItinerary, e: React.MouseEvent) => {
    e.stopPropagation();
    // Bias kill switch (Part 4, 4.5 Contain): plans flagged at generation cannot be shared.
    if (item.share_disabled) return;
    try {
      if (!item.is_public) {
        await updateDoc(doc(db, 'saved_itineraries', item.id), {
          is_public: true
        });
      }
      const shareUrl = `${window.location.origin}${window.location.pathname}?share=${item.id}`;
      await navigator.clipboard.writeText(shareUrl);
      setSharedToastId(item.id);
      setTimeout(() => setSharedToastId(null), 3000);
    } catch (err) {
      console.error('Share error:', err);
      // Fallback clipboard write
      const shareUrl = `${window.location.origin}${window.location.pathname}?share=${item.id}`;
      await navigator.clipboard.writeText(shareUrl);
      setSharedToastId(item.id);
      setTimeout(() => setSharedToastId(null), 3000);
    }
  };

  const filteredItems = allItems.filter((item) => {
    const atStatus = airtableStatuses[item.id];
    const isApproved = atStatus === 'Approved' || atStatus === 'Reviewed' || item.review_status === 'Auto-checked (no flags)' || item.review_status === 'Auto-approved (no flags)';
    if (filter === 'approved') return isApproved;
    if (filter === 'pending') return !isApproved;
    return true;
  });

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 pb-24">
      {/* Toast alert for copied share link */}
      {sharedToastId && (
        <div className="fixed top-14 left-1/2 -translate-x-1/2 bg-slate-900 text-white px-4 py-2.5 rounded-xl shadow-lg z-50 flex items-center gap-2 text-xs animate-in fade-in slide-in-from-top duration-200">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>Public read-only link copied to clipboard! Share it with friends.</span>
        </div>
      )}

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center">
              <BookmarkCheck className="w-4 h-4" />
            </div>
            <h2 className="text-xl font-bold text-slate-900">My Saved Trips</h2>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Every itinerary planned for you, with its human-review status. Saved trips can also be shared or deleted.
          </p>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl text-xs font-medium self-start sm:self-auto">
          <button
            onClick={() => setFilter('all')}
            className={`px-3 py-1 rounded-lg transition-all ${
              filter === 'all' ? 'bg-white text-slate-900 shadow-2xs font-semibold' : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            All ({allItems.length})
          </button>
          <button
            onClick={() => setFilter('approved')}
            className={`px-3 py-1 rounded-lg transition-all ${
              filter === 'approved' ? 'bg-white text-emerald-700 shadow-2xs font-semibold' : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            Approved
          </button>
          <button
            onClick={() => setFilter('pending')}
            className={`px-3 py-1 rounded-lg transition-all ${
              filter === 'pending' ? 'bg-white text-amber-700 shadow-2xs font-semibold' : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            Pending
          </button>
        </div>
      </div>

      {/* Loading state */}
      {loading && (
        <div className="text-center py-12">
          <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-xs text-slate-500">Loading your saved itineraries from Firestore...</p>
        </div>
      )}

      {/* Empty State */}
      {!loading && filteredItems.length === 0 && (
        <div className="text-center py-12 px-4 bg-white border border-dashed border-slate-200 rounded-2xl">
          <div className="w-12 h-12 bg-blue-50 text-blue-500 rounded-2xl flex items-center justify-center mx-auto mb-3">
            <Sparkles className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-bold text-slate-800">No saved itineraries found</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 mb-4 leading-relaxed">
            {filter === 'all'
              ? 'Start a chat with SUKALP AI Buddy and tap "Save this itinerary" to bookmark tailor-made trips here.'
              : `No itineraries found matching the "${filter}" filter.`}
          </p>
          <button
            onClick={onStartNewChat}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl shadow-xs transition-all cursor-pointer"
          >
            <span>Plan an Experience Now</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Itinerary List */}
      <div className="space-y-3.5">
        {filteredItems.map((item) => {
          const isExpanded = expandedId === item.id;
          const atStatus = airtableStatuses[item.id];
          const isReviewedApproved = atStatus === 'Approved' || atStatus === 'Reviewed';
          const isPendingOrFlagged = !isReviewedApproved && (
            atStatus === 'Pending' ||
            item.review_status === 'Pending' ||
            item.review_status === 'Pending review' ||
            item.review_status === 'Flagged – pending review' ||
            item.review_status === 'Flagged'
          );
          const formattedDate = new Date(item.created_at).toLocaleDateString('en-IN', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          });

          return (
            <div
              key={item.id}
              className="bg-white border border-slate-200 rounded-2xl overflow-hidden transition-all hover:border-slate-300 shadow-2xs"
            >
              {/* Header card summary */}
              <div
                onClick={() => setExpandedId(isExpanded ? null : item.id)}
                className="p-4 cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/50 transition-colors"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                    {/* Status Badge (Requirement 8) */}
                    {isReviewedApproved ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-0.5 rounded-full">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                        <span>Reviewed ✓</span>
                      </span>
                    ) : atStatus === 'Rejected' ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-rose-50 text-rose-700 border border-rose-200 px-2.5 py-0.5 rounded-full">
                        <AlertTriangle className="w-3 h-3 text-rose-600" />
                        <span>Not approved by reviewer</span>
                      </span>
                    ) : isPendingOrFlagged || item.source === 'log' ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200 px-2.5 py-0.5 rounded-full">
                        <Clock className="w-3 h-3 text-amber-600" />
                        <span>Awaiting human review</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-0.5 rounded-full">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                        <span>Auto-checked (no flags)</span>
                      </span>
                    )}

                    {item.source === 'log' && (
                      <span className="inline-flex items-center text-[11px] font-medium bg-slate-100 text-slate-600 border border-slate-200 px-2 py-0.5 rounded-full">
                        Not saved
                      </span>
                    )}

                    {/* Date */}
                    <span className="text-[11px] text-slate-400 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      <span>{formattedDate}</span>
                    </span>
                  </div>

                  {/* Title with Destination name & nights (Requirement 7) */}
                  <h3 className="text-sm font-bold text-slate-900 leading-snug line-clamp-1">
                    {formatTripTitle(item)}
                  </h3>
                  <p className="text-xs text-slate-500 line-clamp-1 mt-0.5">
                    "{item.request_text}"
                  </p>
                </div>

                <div className="flex items-center gap-1.5 sm:gap-2 self-end sm:self-center shrink-0">
                  {/* Share Public Read-Only Link (saved trips only) */}
                  {item.source !== 'log' && !item.share_disabled && (
                  <button
                    onClick={(e) => handleShareItinerary(item, e)}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold transition-all border shadow-2xs cursor-pointer ${
                      sharedToastId === item.id
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : 'bg-slate-50 hover:bg-slate-100 text-slate-700 hover:text-slate-900 border-slate-200 hover:border-slate-300'
                    }`}
                    title="Generate public read-only link to share with friends"
                  >
                    {sharedToastId === item.id ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                        <span className="hidden sm:inline">Copied!</span>
                      </>
                    ) : (
                      <>
                        <Share2 className="w-3.5 h-3.5 text-blue-600" />
                        <span className="hidden sm:inline">Share</span>
                      </>
                    )}
                  </button>
                  )}

                  {/* Export PDF */}
                  <button
                    onClick={(e) => handleExportPdf(item, e)}
                    disabled={exportingId === item.id}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold transition-all border shadow-2xs cursor-pointer ${
                      pdfSuccessId === item.id
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : 'bg-blue-50 hover:bg-blue-100 text-blue-700 hover:text-blue-800 border-blue-200 hover:border-blue-300'
                    }`}
                    title="Export itinerary to PDF for offline travel"
                  >
                    {pdfSuccessId === item.id ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                        <span className="hidden sm:inline">Downloaded</span>
                      </>
                    ) : (
                      <>
                        <FileDown className="w-3.5 h-3.5 text-blue-600" />
                        <span className="hidden sm:inline">
                          {exportingId === item.id ? 'Saving...' : 'Export to PDF'}
                        </span>
                        <span className="sm:hidden">PDF</span>
                      </>
                    )}
                  </button>

                  {item.source !== 'log' && (
                  <button
                    onClick={(e) => handleDelete(item.id, e)}
                    className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                    title="Delete saved itinerary"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                  )}

                  <div className="p-1 text-slate-400">
                    {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                  </div>
                </div>
              </div>

              {/* Expanded details: Formatted Evidence Cards */}
              {isExpanded && (
                <div className="px-4 pb-5 pt-2 border-t border-slate-100 bg-slate-50/40">
                  <div className="mb-3 flex items-center justify-between flex-wrap gap-2">
                    <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                      Verified AI Response
                    </span>
                    <div className="flex items-center gap-2">
                      {!item.share_disabled && (
                      <button
                        onClick={(e) => handleShareItinerary(item, e)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-semibold border border-slate-200 shadow-2xs transition-all cursor-pointer"
                      >
                        {sharedToastId === item.id ? (
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                        ) : (
                          <Share2 className="w-3.5 h-3.5 text-blue-600" />
                        )}
                        <span>{sharedToastId === item.id ? 'Public Link Copied!' : 'Share Read-Only Link'}</span>
                      </button>
                      )}

                      <button
                        onClick={(e) => handleExportPdf(item, e)}
                        disabled={exportingId === item.id}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-xs transition-all cursor-pointer"
                      >
                        <FileDown className="w-3.5 h-3.5" />
                        <span>{exportingId === item.id ? 'Generating PDF...' : 'Download PDF (Offline)'}</span>
                      </button>
                    </div>
                  </div>
                  {/* "Why this itinerary": shown only after a human reviewer approves it */}
                  <div className={`mb-4 rounded-xl border px-4 py-3 ${approvedExplanations[item.id] ? 'border-emerald-200 bg-emerald-50/60' : 'border-amber-200 bg-amber-50/60'}`}>
                    <div className={`text-[11px] font-semibold uppercase tracking-wide mb-1 ${approvedExplanations[item.id] ? 'text-emerald-700' : 'text-amber-700'}`}>
                      Why this itinerary
                    </div>
                    {approvedExplanations[item.id] ? (
                      <>
                        <p className="text-sm text-slate-800 leading-relaxed">{approvedExplanations[item.id]}</p>
                        <p className="mt-1 text-[11px] text-emerald-700 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>Reviewed and approved by our team</span>
                        </p>
                      </>
                    ) : (
                      <p className="text-sm text-amber-800 flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5" />
                        <span>Explanation under review. It will appear here once a reviewer approves it.</span>
                      </p>
                    )}
                  </div>
                  <EvidenceCardViewer
                    text={item.response_text}
                    reviewStatus={approvedExplanations[item.id] ? 'Approved' : (airtableStatuses[item.id] || item.review_status)}
                    explanation={approvedExplanations[item.id]}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
