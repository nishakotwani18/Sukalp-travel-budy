import React, { useState, useEffect } from 'react';
import { 
  User, 
  IndianRupee, 
  Utensils, 
  Accessibility, 
  Check, 
  AlertCircle, 
  Save
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';

const TRAVELLER_TYPES = [
  'Solo Explorer',
  'Couple',
  'Family with Kids',
  'Group of Friends',
  'Senior Citizens',
  'Workation / Digital Nomad'
];

const BUDGET_OPTIONS = [
  'Budget (< ₹2,500/day)',
  'Moderate (₹2,500 – ₹5,000/day)',
  'Comfort (₹5,000 – ₹8,000/day)',
  'Luxury (> ₹8,000/day)'
];

const FOOD_PREFERENCES = [
  'Any / Local Delicacies',
  '100% Pure Vegetarian',
  'Jain (No Root Veggies / Onion / Garlic)',
  'Vegan / Plant-Based',
  'Fresh Coastal & Seafood',
  'Halal Friendly'
];

const ACCESSIBILITY_OPTIONS = [
  'None / Standard Walking',
  'Wheelchair Friendly & Elevators',
  'Ground Floor Rooms Preferred',
  'Minimal Walking / Easy Staircase',
  'Near 24/7 Medical Clinic'
];

export const ProfileView: React.FC = () => {
  const { user, profile, saveProfile } = useAuth();
  
  const [travellerType, setTravellerType] = useState('');
  const [budgetInr, setBudgetInr] = useState('Moderate (₹2,500 – ₹5,000/day)');
  const [foodPreference, setFoodPreference] = useState('Any / Local Delicacies');
  const [accessibilityNeed, setAccessibilityNeed] = useState('None / Standard Walking');
  const [consentAccepted, setConsentAccepted] = useState(true);

  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (profile) {
      setTravellerType(profile.traveller_type || '');
      if (profile.budget_inr) setBudgetInr(profile.budget_inr);
      if (profile.food_preference) setFoodPreference(profile.food_preference);
      if (profile.accessibility_need) setAccessibilityNeed(profile.accessibility_need);
      if (profile.consent_status) setConsentAccepted(profile.consent_status === 'accepted');
    }
  }, [profile]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaveError(null);
    setSaveSuccess(false);

    try {
      await saveProfile({
        traveller_type: travellerType,
        budget_inr: budgetInr,
        food_preference: foodPreference,
        accessibility_need: accessibilityNeed,
        consent_status: consentAccepted ? 'accepted' : 'declined'
      });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: any) {
      console.error('Failed to save profile:', err);
      setSaveError(err.message || 'Error saving profile to Firestore.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 pb-24">
      {/* Title */}
      <div className="mb-6">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center">
            <User className="w-4 h-4" />
          </div>
          <h2 className="text-xl font-bold text-slate-900">Travel Preferences</h2>
        </div>
        <p className="text-xs text-slate-500 mt-1">
          SUKALP AI Buddy uses these settings to calculate precise budget evidence cards and dining suggestions.
        </p>
      </div>

      <form onSubmit={handleSave} className="space-y-5 bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
        {/* User Account Info */}
        <div className="pb-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Account</span>
            <p className="text-xs font-semibold text-slate-800">{user?.email || 'Anonymous Traveler'}</p>
          </div>
          <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-medium">
            UID: {user?.uid.slice(0, 8)}...
          </span>
        </div>

        {/* 1. Traveller Type */}
        <div>
          <label className="block text-xs font-bold text-slate-800 mb-1.5 flex items-center gap-1.5">
            <User className="w-3.5 h-3.5 text-blue-600" />
            <span>Traveller Type</span>
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {TRAVELLER_TYPES.map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => setTravellerType(travellerType === type ? '' : type)}
                className={`py-2 px-2.5 rounded-xl text-xs font-medium border text-left transition-all ${
                  travellerType === type
                    ? 'border-blue-600 bg-blue-50 text-blue-700 shadow-2xs font-semibold'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                {type}
              </button>
            ))}
          </div>
        </div>

        {/* 2. Budget INR */}
        <div>
          <label className="block text-xs font-bold text-slate-800 mb-1.5 flex items-center gap-1.5">
            <IndianRupee className="w-3.5 h-3.5 text-blue-600" />
            <span>Daily Budget (INR)</span>
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {BUDGET_OPTIONS.map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => setBudgetInr(opt)}
                className={`py-2 px-3 rounded-xl text-xs font-medium border text-left transition-all ${
                  budgetInr === opt
                    ? 'border-blue-600 bg-blue-50 text-blue-700 shadow-2xs font-semibold'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                {opt}
              </button>
            ))}
          </div>
        </div>

        {/* 3. Food Preference */}
        <div>
          <label className="block text-xs font-bold text-slate-800 mb-1.5 flex items-center gap-1.5">
            <Utensils className="w-3.5 h-3.5 text-blue-600" />
            <span>Food & Dietary Preference</span>
          </label>
          <select
            value={foodPreference}
            onChange={(e) => setFoodPreference(e.target.value)}
            className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-slate-800 focus:outline-blue-500 focus:bg-white"
          >
            {FOOD_PREFERENCES.map((food) => (
              <option key={food} value={food}>{food}</option>
            ))}
          </select>
        </div>

        {/* 4. Accessibility Need */}
        <div>
          <label className="block text-xs font-bold text-slate-800 mb-1.5 flex items-center gap-1.5">
            <Accessibility className="w-3.5 h-3.5 text-blue-600" />
            <span>Accessibility & Mobility Need</span>
          </label>
          <select
            value={accessibilityNeed}
            onChange={(e) => setAccessibilityNeed(e.target.value)}
            className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-slate-800 focus:outline-blue-500 focus:bg-white"
          >
            {ACCESSIBILITY_OPTIONS.map((acc) => (
              <option key={acc} value={acc}>{acc}</option>
            ))}
          </select>
        </div>

        {/* 5. Consent */}
        <div className="pt-2">
          <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-700">
            <input
              type="checkbox"
              checked={consentAccepted}
              onChange={(e) => setConsentAccepted(e.target.checked)}
              className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
            />
            <span>I agree to allow SUKALP AI Buddy to personalize my travel responses.</span>
          </label>
        </div>

        {/* Status Messages */}
        {saveError && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
            <span>{saveError}</span>
          </div>
        )}

        {saveSuccess && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center gap-2">
            <Check className="w-4 h-4 shrink-0 text-emerald-600" />
            <span>Preferences saved successfully to Firestore!</span>
          </div>
        )}

        {/* Save Button */}
        <button
          type="submit"
          disabled={saving}
          className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl text-xs flex items-center justify-center gap-2 transition-all shadow-sm shadow-blue-600/30 disabled:opacity-50 cursor-pointer"
        >
          <Save className="w-4 h-4" />
          <span>{saving ? 'Saving to Firestore...' : 'Save Preferences'}</span>
        </button>
      </form>
    </div>
  );
};
