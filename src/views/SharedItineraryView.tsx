import React, { useEffect, useState } from 'react';
import { 
  Compass, 
  Clock, 
  MapPin, 
  CheckCircle2, 
  AlertTriangle, 
  FileDown, 
  Share2, 
  Check, 
  ArrowRight, 
  Sparkles,
  AlertCircle
} from 'lucide-react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase.ts';
import { SavedItinerary } from '../types.ts';
import { EvidenceCardViewer } from '../components/EvidenceCardViewer.tsx';
import { exportItineraryToPdf } from '../utils/pdfExport.ts';

interface SharedItineraryViewProps {
  shareId: string;
  onExploreApp: () => void;
}

export const SharedItineraryView: React.FC<SharedItineraryViewProps> = ({ shareId, onExploreApp }) => {
  const [itinerary, setItinerary] = useState<SavedItinerary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    const fetchSharedItinerary = async () => {
      try {
        setLoading(true);
        setError(null);
        const docRef = doc(db, 'saved_itineraries', shareId);
        const docSnap = await getDoc(docRef);

        if (!docSnap.exists()) {
          setError('This shared itinerary could not be found or may have been removed.');
          setLoading(false);
          return;
        }

        const data = docSnap.data() as SavedItinerary;
        setItinerary({
          ...data,
          id: docSnap.id
        });
      } catch (err: any) {
        console.error('Error fetching shared itinerary:', err);
        setError('Unable to load this shared trip. Please check your link or network.');
      } finally {
        setLoading(false);
      }
    };

    if (shareId) {
      fetchSharedItinerary();
    }
  }, [shareId]);

  const handleCopyLink = () => {
    const shareUrl = `${window.location.origin}${window.location.pathname}?share=${shareId}`;
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleDownloadPdf = () => {
    if (!itinerary) return;
    try {
      setExporting(true);
      exportItineraryToPdf(itinerary);
    } catch (err) {
      console.error('PDF Export error:', err);
    } finally {
      setTimeout(() => setExporting(false), 1000);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-blue-700 to-sky-500 flex items-center justify-center text-white shadow-md shadow-blue-500/20 animate-bounce mb-3">
          <Compass className="w-6 h-6" />
        </div>
        <p className="text-sm font-bold text-slate-800">SUKALP AI Buddy</p>
        <p className="text-xs text-slate-500 mt-1">Loading shared travel itinerary...</p>
      </div>
    );
  }

  if (error || !itinerary) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <div className="max-w-md w-full bg-white border border-slate-200 rounded-2xl p-6 text-center shadow-md">
          <div className="w-12 h-12 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center mx-auto mb-3">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h2 className="text-base font-bold text-slate-900 mb-1">Itinerary Unavailable</h2>
          <p className="text-xs text-slate-500 mb-5 leading-relaxed">{error || 'Trip plan not found.'}</p>
          <button
            onClick={onExploreApp}
            className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all shadow-xs"
          >
            <span>Plan a New Trip with SUKALP</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    );
  }

  const isApproved = itinerary.review_status === 'Auto-checked (no flags)' || itinerary.review_status === 'Auto-approved (no flags)';
  const formattedDate = new Date(itinerary.created_at).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });

  return (
    <div className="min-h-screen bg-slate-50/70 text-slate-900 pb-16">
      {/* Top Banner */}
      <div className="bg-blue-900 text-blue-100 text-xs px-4 py-2 flex items-center justify-between border-b border-blue-800 sticky top-0 z-50">
        <div className="flex items-center gap-2">
          <Sparkles className="w-3.5 h-3.5 text-sky-400 shrink-0" />
          <span className="font-medium">Shared Travel Itinerary • Read-Only View</span>
        </div>
        <button
          onClick={onExploreApp}
          className="bg-blue-800 hover:bg-blue-700 text-white text-[11px] font-semibold px-2.5 py-1 rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
        >
          <span>Plan Your Own</span>
          <ArrowRight className="w-3 h-3" />
        </button>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-6">
        {/* Main Card */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-5 sm:p-6 shadow-sm mb-6">
          {/* Header & Badges */}
          <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-100">
            <div className="flex items-center gap-2 flex-wrap">
              {isApproved ? (
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-0.5 rounded-full">
                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                  <span>Verified Stays</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200 px-2.5 py-0.5 rounded-full">
                  <AlertTriangle className="w-3 h-3 text-amber-600" />
                  <span>Pending Review</span>
                </span>
              )}

              <span className="text-[11px] text-slate-400 flex items-center gap-1">
                <Clock className="w-3 h-3" />
                <span>Created {formattedDate}</span>
              </span>

              {itinerary.destination_ids && (
                <span className="text-[10px] bg-blue-50 text-blue-700 px-2 py-0.5 rounded-md font-mono">
                  {itinerary.destination_ids}
                </span>
              )}
            </div>

            {/* Top Action buttons */}
            <div className="flex items-center gap-2">
              <button
                onClick={handleCopyLink}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-all cursor-pointer border border-slate-200"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Share2 className="w-3.5 h-3.5 text-blue-600" />}
                <span>{copied ? 'Link Copied!' : 'Copy Link'}</span>
              </button>

              <button
                onClick={handleDownloadPdf}
                disabled={exporting}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl transition-all shadow-xs cursor-pointer"
              >
                <FileDown className="w-3.5 h-3.5" />
                <span>{exporting ? 'Exporting...' : 'Export PDF'}</span>
              </button>
            </div>
          </div>

          {/* Inquiry Title */}
          <div className="my-4">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
              Destination Inquiry
            </span>
            <h1 className="text-lg sm:text-xl font-bold text-slate-900 leading-snug">
              "{itinerary.request_text}"
            </h1>
          </div>

          {/* Formatted Evidence Cards */}
          <div className="mt-5 pt-4 border-t border-slate-100">
            <EvidenceCardViewer text={itinerary.response_text} />
          </div>
        </div>

        {/* Call to action card */}
        <div className="bg-gradient-to-tr from-blue-700 to-sky-600 text-white rounded-2xl p-6 text-center shadow-md">
          <h3 className="text-base font-bold mb-1">Want personalized travel recommendations?</h3>
          <p className="text-xs text-blue-100 mb-4 max-w-md mx-auto leading-relaxed">
            SUKALP AI Buddy plans honest, verified experiences tailored to your budget, diet, and travel pace.
          </p>
          <button
            onClick={onExploreApp}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-white text-blue-700 hover:bg-blue-50 font-bold text-xs rounded-xl shadow-xs transition-all cursor-pointer"
          >
            <span>Start Planning with SUKALP AI Buddy</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
