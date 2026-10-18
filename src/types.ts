export interface UserProfile {
  user_id: string;
  traveller_type: string;
  budget_inr: string;
  food_preference: string;
  accessibility_need: string;
  consent_status: string;
  updated_at?: string;
}

export interface SavedItinerary {
  id: string;
  user_id: string;
  request_text: string;
  response_text: string;
  destination_ids: string;
  destination_name?: string;
  nights?: number;
  review_status: 'Auto-checked (no flags)' | 'Flagged – pending review' | 'Awaiting human review' | 'Reviewed ✓' | string;
  created_at: string;
  is_public?: boolean;
  itinerary_json?: any;
  ai_explanation?: string;
  // 'log' = shown from Airtable Itinerary_Log (generated, not saved to My Saved Trips in Firestore)
  source?: 'saved' | 'log';
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: string;
  destinationIds?: string[];
  reviewStatus?: 'Auto-checked (no flags)' | 'Flagged – pending review' | string;
  flaggedHotels?: string[];
  matchedDestinations?: Array<{
    id: string;
    destination_id?: string;
    destination_name?: string;
    name?: string;
    state?: string;
    zone?: string;
    crowd_level?: string;
  }>;
  matchedHotels?: Array<{
    id: string;
    hotel_id?: string;
    name: string;
    category?: string;
    rating?: number;
    price_per_night_inr?: number;
  }>;
  isSaving?: boolean;
  saved?: boolean;
  itineraryJson?: any;
  ai_explanation?: string;
  itineraryLogId?: string;
  isError?: boolean;
  retryPrompt?: string;
  badges?: string[];
}

export interface CatalogueStatus {
  status: string;
  airtable_pat_configured: boolean;
  gemini_api_key_configured: boolean;
  catalogue_source: 'airtable_live';
  destinations_count: number;
  hotels_count: number;
  reviews_count: number;
  cache_age_seconds: number;
}
