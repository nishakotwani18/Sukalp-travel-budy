/**
 * Airtable catalogue loader & webhook forwarder for SUKALP AI Buddy
 * Base ID: applFLKlGXGMP5D8U
 *
 * Exact field schemas matching Airtable:
 * Destinations (57 valid rows, skipping 4 blank rows)
 * Hotels (166 total rows, 118 domestic)
 * Reviews (118 total rows)
 */

export interface DestinationRecord {
  id: string; // Airtable record ID
  destination_id: string; // e.g. D01, D28
  destination_name: string;
  location?: string;
  state: string;
  zone: string;
  destination_description?: string;
  travel_information?: string;
  safety_information?: string;
  cleanliness_information?: string;
  crowd_information?: string;
  vegetarian_information?: string;
  cost_information?: string;
  evidence_source?: string;
  typical_travel_time?: string;
  budget_min_inr_pp_3n?: number;
  budget_max_inr_pp_3n?: number;
  popularity_tier?: 'popular' | 'known' | 'offbeat' | string;
  crowd_level?: 'Low' | 'Medium' | 'High' | string;
  reel_buzz?: string;
  season?: string;
  best_months?: string;
  hub_city?: string;
  nearest_airport?: string;
  variability_factors?: string;
  Hotels?: string[]; // linked record IDs
}

export interface HotelRecord {
  id: string; // Airtable record ID
  hotel_id: string; // e.g. H001, H047
  destination_id?: string[]; // linked record IDs
  name: string;
  category?: 'budget' | 'mid' | 'premium' | string;
  price_per_night_inr?: number;
  rating_overall?: number;
  review_count_total?: number;
  recent_review_count_90d?: number;
  recent_avg_rating_90d?: number;
  older_avg_rating?: number;
  review_signal?: string;
  cleanliness_rating?: number;
  location?: string;
  safety_note?: string;
  food_veg_note?: string;
  vegetarian_friendly?: string;
  accessibility?: string;
  elder_friendly?: string;
  data_disclaimer?: string;
}

export interface ReviewRecord {
  id: string; // Airtable record ID
  review_id: string; // e.g. R0001
  hotel_id?: string[]; // linked record IDs
  destination_id?: string[]; // linked record IDs
  review_date?: string;
  rating?: number;
  review_text: string;
  topics_categories?: string;
  polarity?: string;
}

export interface CatalogueCache {
  destinations: DestinationRecord[];
  hotels: HotelRecord[];
  reviews: ReviewRecord[];
  lastFetched: number;
  source: 'airtable_live';
}

const BASE_ID = 'applFLKlGXGMP5D8U';
const CACHE_TTL_MS = 5 * 60 * 1000; // Exactly 5 minutes cache (300 seconds)

let catalogueCache: CatalogueCache | null = null;
let inFlightPromise: Promise<CatalogueCache> | null = null;

async function fetchAllAirtableRecords(tableId: string, pat: string): Promise<any[]> {
  const allRecords: any[] = [];
  let offset: string | undefined = undefined;

  do {
    const url = new URL(`https://api.airtable.com/v0/${BASE_ID}/${encodeURIComponent(tableId)}`);
    if (offset) {
      url.searchParams.set('offset', offset);
    }

    const response = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${pat}`
      }
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Airtable error fetching ${tableId} (${response.status}): ${errText}`);
    }

    const data = await response.json();
    if (Array.isArray(data.records)) {
      allRecords.push(...data.records);
    }
    offset = data.offset;
  } while (offset);

  return allRecords;
}

function parseNumber(val: any): number | undefined {
  if (typeof val === 'number' && !isNaN(val)) return val;
  if (typeof val === 'string' && val.trim().length > 0) {
    const parsed = Number(val);
    if (!isNaN(parsed)) return parsed;
  }
  return undefined;
}

export async function getCatalogueData(): Promise<CatalogueCache> {
  const now = Date.now();
  if (catalogueCache && (now - catalogueCache.lastFetched) < CACHE_TTL_MS) {
    return catalogueCache;
  }

  if (inFlightPromise) {
    return inFlightPromise;
  }

  inFlightPromise = (async () => {
    try {
      const pat = process.env.AIRTABLE_PAT;
      if (!pat) {
        throw new Error('AIRTABLE_PAT environment variable is not configured');
      }

      // Log only when cache is refreshed
      console.log('[Catalogue] Refreshing cache: fetching all pages from Airtable base:', BASE_ID);
      const [destRecords, hotelRecords, reviewRecords] = await Promise.all([
        fetchAllAirtableRecords('tblRVuEcBmxfiqTgj', pat),
        fetchAllAirtableRecords('tbljuiwQzo85MAtAF', pat),
        fetchAllAirtableRecords('tblHsb86cAucrZX6T', pat)
      ]);

      // Drop blank rows for Destinations (4 blank placeholder rows exist in Airtable)
      const destinations: DestinationRecord[] = destRecords
        .filter((r: any) => {
          const id = r.fields?.destination_id;
          const state = r.fields?.state;
          const name = r.fields?.destination_name;
          return id && String(id).trim().length > 0 && state && String(state).trim().length > 0 && name && String(name).trim().length > 0;
        })
        .map((r: any) => ({
        id: r.id,
        destination_id: String(r.fields.destination_id).trim(),
        destination_name: String(r.fields.destination_name || '').trim(),
        location: r.fields.location ? String(r.fields.location).trim() : undefined,
        state: String(r.fields.state).trim(),
        zone: String(r.fields.zone || '').trim(),
        destination_description: r.fields.destination_description ? String(r.fields.destination_description).trim() : undefined,
        travel_information: r.fields.travel_information ? String(r.fields.travel_information).trim() : undefined,
        safety_information: r.fields.safety_information ? String(r.fields.safety_information).trim() : undefined,
        cleanliness_information: r.fields.cleanliness_information ? String(r.fields.cleanliness_information).trim() : undefined,
        crowd_information: r.fields.crowd_information ? String(r.fields.crowd_information).trim() : undefined,
        vegetarian_information: r.fields.vegetarian_information ? String(r.fields.vegetarian_information).trim() : undefined,
        cost_information: r.fields.cost_information ? String(r.fields.cost_information).trim() : undefined,
        evidence_source: r.fields.evidence_source ? String(r.fields.evidence_source).trim() : undefined,
        typical_travel_time: r.fields.typical_travel_time ? String(r.fields.typical_travel_time).trim() : undefined,
        budget_min_inr_pp_3n: parseNumber(r.fields.budget_min_inr_pp_3n),
        budget_max_inr_pp_3n: parseNumber(r.fields.budget_max_inr_pp_3n),
        popularity_tier: r.fields.popularity_tier ? String(r.fields.popularity_tier).trim().toLowerCase() : undefined,
        crowd_level: r.fields.crowd_level ? String(r.fields.crowd_level).trim() : undefined,
        reel_buzz: r.fields.reel_buzz ? String(r.fields.reel_buzz).trim() : undefined,
        season: r.fields.season ? String(r.fields.season).trim() : undefined,
        best_months: r.fields.best_months ? String(r.fields.best_months).trim() : undefined,
        hub_city: r.fields.hub_city ? String(r.fields.hub_city).trim() : undefined,
        nearest_airport: r.fields.nearest_airport ? String(r.fields.nearest_airport).trim() : undefined,
        variability_factors: r.fields.variability_factors ? String(r.fields.variability_factors).trim() : undefined,
        Hotels: Array.isArray(r.fields.Hotels) ? r.fields.Hotels : []
      }));

    // All catalogue hotels with an ID and a name (domestic and international)
    const hotels: HotelRecord[] = hotelRecords
      .filter((r: any) => {
        const id = r.fields?.hotel_id;
        const name = r.fields?.name;
        return id && String(id).trim().length > 0 && name && String(name).trim().length > 0;
      })
      .map((r: any) => ({
        id: r.id,
        hotel_id: String(r.fields.hotel_id || '').trim(),
        destination_id: Array.isArray(r.fields.destination_id) ? r.fields.destination_id : [],
        name: String(r.fields.name || '').trim(),
        category: r.fields.category ? String(r.fields.category).trim().toLowerCase() : undefined,
        price_per_night_inr: parseNumber(r.fields.price_per_night_inr),
        rating_overall: parseNumber(r.fields.rating_overall),
        review_count_total: parseNumber(r.fields.review_count_total),
        recent_review_count_90d: parseNumber(r.fields.recent_review_count_90d),
        recent_avg_rating_90d: parseNumber(r.fields.recent_avg_rating_90d),
        older_avg_rating: parseNumber(r.fields.older_avg_rating),
        review_signal: r.fields.review_signal ? String(r.fields.review_signal).trim() : undefined,
        cleanliness_rating: parseNumber(r.fields.cleanliness_rating),
        location: r.fields.location ? String(r.fields.location).trim() : undefined,
        safety_note: r.fields.safety_note ? String(r.fields.safety_note).trim() : undefined,
        food_veg_note: r.fields.food_veg_note ? String(r.fields.food_veg_note).trim() : undefined,
        vegetarian_friendly: r.fields.vegetarian_friendly ? String(r.fields.vegetarian_friendly).trim() : undefined,
        accessibility: r.fields.accessibility ? String(r.fields.accessibility).trim() : undefined,
        elder_friendly: r.fields.elder_friendly ? String(r.fields.elder_friendly).trim().toLowerCase() : undefined,
        data_disclaimer: r.fields.data_disclaimer ? String(r.fields.data_disclaimer).trim() : undefined
      }));

    // Drop blank rows for Reviews
    const reviews: ReviewRecord[] = reviewRecords
      .filter((r: any) => {
        const id = r.fields?.review_id;
        const text = r.fields?.review_text;
        return id && String(id).trim().length > 0 && text && String(text).trim().length > 0;
      })
      .map((r: any) => ({
        id: r.id,
        review_id: String(r.fields.review_id || '').trim(),
        hotel_id: Array.isArray(r.fields.hotel_id) ? r.fields.hotel_id : [],
        destination_id: Array.isArray(r.fields.destination_id) ? r.fields.destination_id : [],
        review_date: r.fields.review_date ? String(r.fields.review_date).trim() : undefined,
        rating: parseNumber(r.fields.rating),
        review_text: String(r.fields.review_text || '').trim(),
        topics_categories: r.fields.topics_categories ? String(r.fields.topics_categories).trim() : undefined,
        polarity: r.fields.polarity ? String(r.fields.polarity).trim() : undefined
      }));

    catalogueCache = {
      destinations,
      hotels,
      reviews,
      lastFetched: Date.now(),
      source: 'airtable_live'
    };

    console.log(`[Catalogue] Loaded ${destinations.length} destinations, ${hotels.length} hotels, ${reviews.length} reviews`);
    return catalogueCache;
  } finally {
    inFlightPromise = null;
  }
})();

  return inFlightPromise;
}

export const ITINERARY_LOG_TABLE_ID = 'tbl60eR9auEDeZhpO';

// Exact field IDs specified for Itinerary_Log
export const ITINERARY_LOG_FIELD_IDS = {
  trip_request: 'fldYO230Eu2tUrTJz',
  generated_recommendation: 'fld1CeJWa4xjNIaXK',
  evidence_source_reviews: 'fldIkVCNu0zc72vCT',
  estimated_cost: 'fldvy195gpbe47AQz',
  estimated_travel_time: 'fldSHOjmXBpvfEdG2',
  assumptions: 'fldwzOY7vSn2Di184',
  alternatives: 'fldxBPvyuFvWu30Wt',
  safety_notes: 'fldFf3HGXHGdjDrm7',
  cleanliness_notes: 'fldpR5FrlxB3ysr4x',
  vegetarian_notes: 'fldDdF5xGLRvMT0AH',
  review_status: 'fldMqJSnTeEVbJoel',
  run_timestamp: 'fldrXpNwhXWZZLOFO',
  user_id: 'fld4DG4f6NcfFDadG',
  itinerary_summary: 'fldRvwVkOXWsXic1J',
  ai_explanation: 'fld4MbcdSl2a0duWF',
  persona: 'fldjIin3SlrzGCLq1'
} as const;

export interface WriteItineraryLogPayload {
  trip_request: string;
  generated_recommendation: string;
  evidence_source_reviews?: string;
  estimated_cost: number;
  estimated_travel_time?: string;
  assumptions?: string;
  alternatives?: string;
  safety_notes?: string;
  cleanliness_notes?: string;
  vegetarian_notes?: string;
  user_id: string;
  itinerary_summary?: string;
  ai_explanation?: string;
  persona?: string[];
  traveller_type?: string;
  profile_traveller_type?: string;
  destination_name?: string;
  accessibility_need?: string;
}

/**
 * Single writer: the app is the ONLY writer to Itinerary_Log (table tbl60eR9auEDeZhpO).
 * Writes ONLY the 16 exact field IDs. Does NOT write request_text, response_text, destination_ids,
 * created_at, user_email or any other field.
 * Any second write path (including direct n8n Airtable writes) is removed.
 * If n8n explanation step is configured, it returns the explanation to the app, and the app updates its own row.
 * New itineraries are always written with review_status = 'Pending'.
 */
export async function writeItineraryLogToAirtable(
  payload: WriteItineraryLogPayload
): Promise<{ recordId: string; success: boolean }> {
  const pat = process.env.AIRTABLE_PAT;
  if (!pat) {
    throw new Error('AIRTABLE_PAT environment variable is not configured');
  }

  // Persona record IDs in base:
  // recXixwqDTS2cWLT8 = Anita — Family / Elder-Friendly Planner
  // rec4IqzI0niI5AzrK = Prerna — Practical Couple Traveller
  const personaIds = payload.persona && payload.persona.length > 0
    ? payload.persona
    : (payload.traveller_type === 'family' ? ['recXixwqDTS2cWLT8'] : ['rec4IqzI0niI5AzrK']);

  // Write ONLY the 16 exact fields, using these exact field IDs.
  // Do NOT write request_text, response_text, destination_ids, created_at, user_email or any other field.
  const fields: Record<string, any> = {
    [ITINERARY_LOG_FIELD_IDS.trip_request]: String(payload.trip_request || ''),
    [ITINERARY_LOG_FIELD_IDS.generated_recommendation]: String(payload.generated_recommendation || ''),
    [ITINERARY_LOG_FIELD_IDS.evidence_source_reviews]: String(payload.evidence_source_reviews || ''),
    [ITINERARY_LOG_FIELD_IDS.estimated_cost]: typeof payload.estimated_cost === 'number' && !isNaN(payload.estimated_cost)
      ? payload.estimated_cost
      : 0,
    [ITINERARY_LOG_FIELD_IDS.estimated_travel_time]: String(payload.estimated_travel_time || ''),
    [ITINERARY_LOG_FIELD_IDS.assumptions]: String(payload.assumptions || ''),
    [ITINERARY_LOG_FIELD_IDS.alternatives]: String(payload.alternatives || ''),
    [ITINERARY_LOG_FIELD_IDS.safety_notes]: String(payload.safety_notes || ''),
    [ITINERARY_LOG_FIELD_IDS.cleanliness_notes]: String(payload.cleanliness_notes || ''),
    [ITINERARY_LOG_FIELD_IDS.vegetarian_notes]: String(payload.vegetarian_notes || ''),
    [ITINERARY_LOG_FIELD_IDS.review_status]: 'Pending', // New itineraries always Pending
    [ITINERARY_LOG_FIELD_IDS.run_timestamp]: new Date().toISOString().slice(0, 10),
    [ITINERARY_LOG_FIELD_IDS.user_id]: String(payload.user_id || ''),
    [ITINERARY_LOG_FIELD_IDS.itinerary_summary]: String(payload.itinerary_summary || ''),
    [ITINERARY_LOG_FIELD_IDS.ai_explanation]: String(payload.ai_explanation || ''),
    [ITINERARY_LOG_FIELD_IDS.persona]: personaIds
  };

  const response = await fetch(`https://api.airtable.com/v0/${BASE_ID}/${ITINERARY_LOG_TABLE_ID}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${pat}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ fields })
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error(`[Airtable Log] Error writing to Itinerary_Log (${response.status}):`, errText);
    throw new Error(`Airtable error logging itinerary (${response.status}): ${errText}`);
  }

  const createdData = await response.json();
  const recordId = createdData.id;
  console.log('[Airtable Log] Successfully wrote itinerary row as single writer:', recordId);

  // Single writer: the app is the ONLY writer to Itinerary_Log.
  // The n8n explanation step returns the explanation to the app, and the app updates its own row.
  const webhookUrl = process.env.N8N_WEBHOOK_URL;
  const webhookSecret = process.env.N8N_WEBHOOK_SECRET;

  if (webhookUrl && webhookSecret) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const n8nRes = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-sukalp-secret': webhookSecret
        },
        body: JSON.stringify({
          event: 'saved',
          itinerary_id: recordId,
          user_id: payload.user_id,
          trip_request: payload.trip_request,
          itinerary_text: payload.generated_recommendation,
          total_inr: payload.estimated_cost,
          destination_name: payload.destination_name || (payload.itinerary_summary ? payload.itinerary_summary.split(' · ')[0] : ''),
          traveller_type: payload.traveller_type,
          profile_traveller_type: payload.profile_traveller_type || payload.traveller_type,
          accessibility_need: payload.accessibility_need || 'none',
          itinerary_summary: payload.itinerary_summary
        }),
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (n8nRes.ok) {
        const n8nData: any = await n8nRes.json().catch(() => null);
        const explanation = n8nData?.explanation || n8nData?.ai_explanation;
        if (explanation && typeof explanation === 'string') {
          // App updates its own row with the returned explanation
          await fetch(`https://api.airtable.com/v0/${BASE_ID}/${ITINERARY_LOG_TABLE_ID}/${recordId}`, {
            method: 'PATCH',
            headers: {
              Authorization: `Bearer ${pat}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              fields: {
                [ITINERARY_LOG_FIELD_IDS.ai_explanation]: explanation
              }
            })
          });
          console.log('[Airtable Log] Updated own row with n8n explanation');
        }
      }
    } catch (n8nErr: any) {
      console.warn('[Airtable Log] n8n explanation step non-blocking notice:', n8nErr.message);
    }
  }

  return { recordId, success: true };
}

export async function forwardItineraryToN8n(payload: {
  event?: 'generated' | 'saved';
  itinerary_id?: string;
  trip_request: string;
  generated_recommendation: string;
  evidence_source_reviews?: string;
  estimated_cost?: number;
  estimated_travel_time?: string;
  assumptions?: string;
  alternatives?: string;
  safety_notes?: string;
  cleanliness_notes?: string;
  vegetarian_notes?: string;
  user_id: string;
  itinerary_summary?: string;
  ai_explanation?: string;
  traveller_type?: string;
  profile_traveller_type?: string;
  accessibility_need?: string;
  destination_name?: string;
}): Promise<boolean> {
  const webhookUrl = process.env.N8N_WEBHOOK_URL;
  if (!webhookUrl) {
    console.warn('[n8n] N8N_WEBHOOK_URL not set — itinerary not forwarded.');
    return false;
  }
  const webhookSecret = process.env.N8N_WEBHOOK_SECRET;
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };
    if (webhookSecret) {
      headers['x-sukalp-secret'] = webhookSecret;
    }
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        event: payload.event || 'saved',
        ...payload
      }),
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    if (!res.ok) {
      console.error(`[n8n] Webhook responded ${res.status}`);
      return false;
    }
    console.log(`[n8n] Itinerary forwarded successfully (event: ${payload.event || 'saved'})`);
    return true;
  } catch (err: any) {
    console.error('[n8n] Failed to forward itinerary:', err.message);
    return false;
  }
}

/**
 * Logs a newly GENERATED itinerary to Airtable Itinerary_Log straight away (before any Save click).
 * The row is created with Review Status = Pending and an empty AI Explanation.
 * The app does NOT call n8n: an Airtable automation on "record created" in Itinerary_Log
 * sends the new row to the n8n webhook, and n8n writes the AI Explanation back to this row.
 * Name = the itinerary id the app later uses as the Firestore saved-trip id, so My Saved Trips
 * can look up the review status and approved explanation.
 */
export async function logGeneratedItinerary(payload: {
  itinerary_id: string;
  user_id: string;
  trip_request: string;
  generated_recommendation: string;
  destination_name: string;
  nights?: number | null;
  traveller_type: string;
  accessibility_need?: string;
  estimated_cost: number;
  evidence_source_reviews?: string;
  assumptions?: string;
  alternatives?: string;
  safety_notes?: string;
  vegetarian_notes?: string;
}): Promise<string | null> {
  const pat = process.env.AIRTABLE_PAT;
  if (!pat) {
    console.warn('[Airtable Log] AIRTABLE_PAT not set — generated itinerary not logged.');
    return null;
  }

  // Persona routing: only the two target personas get a link; solo/group trips stay unlinked.
  const PRERNA = 'rec4IqzI0niI5AzrK';
  const ANITA = 'recXixwqDTS2cWLT8';
  const tt = String(payload.traveller_type || '').toLowerCase();
  const cues = `${tt} ${payload.accessibility_need || ''} ${payload.trip_request || ''}`.toLowerCase();
  let persona: string[] = [];
  if (tt === 'family' || /elder|parent|senior|wheelchair|limited walking|limited_walking/.test(cues)) persona = [ANITA];
  else if (tt === 'couple') persona = [PRERNA];

  const total = Number(payload.estimated_cost) || 0;
  const summary =
    `${payload.destination_name || 'Custom Getaway'}` +
    `${payload.nights ? ` · ${payload.nights} nights` : ''}` +
    `${total ? ` · ₹${total.toLocaleString('en-IN')} total` : ''}` +
    ` · ${tt || 'traveller'}`;

  const fields: Record<string, any> = {
    fldLd8VQHcYI1UEMA: payload.itinerary_id, // Name
    [ITINERARY_LOG_FIELD_IDS.run_timestamp]: new Date().toISOString(), // Timestamp (SLA clock starts here)
    [ITINERARY_LOG_FIELD_IDS.user_id]: String(payload.user_id || ''),
    [ITINERARY_LOG_FIELD_IDS.trip_request]: String(payload.trip_request || '').slice(0, 5000),
    [ITINERARY_LOG_FIELD_IDS.generated_recommendation]: String(payload.generated_recommendation || ''),
    [ITINERARY_LOG_FIELD_IDS.estimated_cost]: total,
    [ITINERARY_LOG_FIELD_IDS.itinerary_summary]: summary,
    [ITINERARY_LOG_FIELD_IDS.evidence_source_reviews]: String(payload.evidence_source_reviews || ''),
    [ITINERARY_LOG_FIELD_IDS.assumptions]: String(payload.assumptions || ''),
    [ITINERARY_LOG_FIELD_IDS.alternatives]: String(payload.alternatives || ''),
    [ITINERARY_LOG_FIELD_IDS.safety_notes]: String(payload.safety_notes || ''),
    [ITINERARY_LOG_FIELD_IDS.vegetarian_notes]: String(payload.vegetarian_notes || ''),
    [ITINERARY_LOG_FIELD_IDS.review_status]: 'Pending'
  };
  if (persona.length) fields[ITINERARY_LOG_FIELD_IDS.persona] = persona;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(`https://api.airtable.com/v0/${BASE_ID}/${ITINERARY_LOG_TABLE_ID}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${pat}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ typecast: true, records: [{ fields }] }),
      signal: controller.signal
    });
    if (!res.ok) {
      console.error('[Airtable Log] create failed', res.status, await res.text());
      return null;
    }
    const data: any = await res.json();
    const recordId = data?.records?.[0]?.id || null;
    console.log('[Airtable Log] generated itinerary logged:', payload.itinerary_id, recordId);
    return recordId;
  } catch (err: any) {
    console.error('[Airtable Log] create error:', err?.message);
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}
