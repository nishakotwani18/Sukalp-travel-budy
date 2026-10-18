import { IncomingMessage, ServerResponse } from 'http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getCatalogueData, forwardItineraryToN8n } from './airtable.ts';
import { processChatWithGemini } from './gemini.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const configPath = path.resolve(__dirname, '../firebase-applet-config.json');

let firebaseConfig: { apiKey: string; projectId: string; firestoreDatabaseId: string } = {
  apiKey: '',
  projectId: '',
  firestoreDatabaseId: ''
};

try {
  if (fs.existsSync(configPath)) {
    firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  }
} catch (e) {
  console.warn('[Server] Could not load firebase-applet-config.json:', e);
}

const MAX_BODY_BYTES = 64 * 1024;
const CHAT_LIMIT_PER_MINUTE = 20;
const SAVE_LIMIT_PER_MINUTE = 30;
const ITINERARY_ID_PATTERN = /^itin_[A-Za-z0-9_]{1,80}$/;

// Simple per-user sliding-window rate limiter (in-memory; resets on server restart)
const rateBuckets = new Map<string, number[]>();

function allowRequest(key: string, limit: number): boolean {
  const now = Date.now();
  const recent = (rateBuckets.get(key) || []).filter((t) => now - t < 60000);
  if (rateBuckets.size > 10000) rateBuckets.clear();
  if (recent.length >= limit) {
    rateBuckets.set(key, recent);
    return false;
  }
  recent.push(now);
  rateBuckets.set(key, recent);
  return true;
}

function sendJson(res: ServerResponse, status: number, data: any) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

function parseJsonBody(req: IncomingMessage): Promise<{ body: any; tooLarge: boolean; invalid: boolean }> {
  return new Promise((resolve) => {
    let data = '';
    let size = 0;
    let tooLarge = false;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        tooLarge = true;
        return;
      }
      data += chunk;
    });
    req.on('end', () => {
      if (tooLarge) return resolve({ body: null, tooLarge: true, invalid: false });
      if (!data) return resolve({ body: {}, tooLarge: false, invalid: false });
      try {
        resolve({ body: JSON.parse(data), tooLarge: false, invalid: false });
      } catch {
        resolve({ body: null, tooLarge: false, invalid: true });
      }
    });
    req.on('error', () => resolve({ body: null, tooLarge: false, invalid: true }));
  });
}

// Verifies a Firebase ID token server-side using the Identity Toolkit lookup endpoint.
// Returns the verified uid, or null when the token is missing, expired or invalid.
async function verifyIdToken(req: IncomingMessage): Promise<{ uid: string; idToken: string } | null> {
  const header = String(req.headers['authorization'] || '');
  const match = /^Bearer\s+(\S+)$/i.exec(header);
  if (!match) return null;
  const idToken = match[1];
  try {
    const res = await fetch('https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=' + encodeURIComponent(firebaseConfig.apiKey), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken })
    });
    if (!res.ok) return null;
    const data: any = await res.json();
    const uid = data && data.users && data.users[0] && data.users[0].localId;
    return uid ? { uid: String(uid), idToken } : null;
  } catch (err: any) {
    console.warn('[Auth] token check failed:', err && err.message ? err.message : err);
    return null;
  }
}

// Reads the saved itinerary with the caller's own token, so Firestore rules decide access.
// Returns null when the document does not exist or does not belong to this user.
async function fetchOwnedItineraryFields(itineraryId: string, idToken: string): Promise<any | null> {
  const url = 'https://firestore.googleapis.com/v1/projects/' + encodeURIComponent(firebaseConfig.projectId) +
    '/databases/' + encodeURIComponent(firebaseConfig.firestoreDatabaseId) +
    '/documents/saved_itineraries/' + encodeURIComponent(itineraryId);
  try {
    const res = await fetch(url, { headers: { Authorization: 'Bearer ' + idToken } });
    if (!res.ok) return null;
    const doc: any = await res.json();
    return doc && doc.fields ? doc.fields : null;
  } catch (err: any) {
    console.warn('[Save] Firestore read failed:', err && err.message ? err.message : err);
    return null;
  }
}

function fieldString(fields: any, key: string): string {
  const value = fields && fields[key];
  return value && typeof value.stringValue === 'string' ? value.stringValue : '';
}

export async function handleApiRequest(
  req: IncomingMessage,
  res: ServerResponse,
  next?: () => void
): Promise<boolean> {
  const url = req.url || '';
  const rawPath = url.split('?')[0];
  // Normalize path whether mounted with or without /api prefix
  const pathname = rawPath.startsWith('/api') ? rawPath.slice(4) : rawPath;

  try {
    // 1. GET /health
    if (pathname === '/health' && req.method === 'GET') {
      const catalogue = await getCatalogueData();
      sendJson(res, 200, {
        status: 'ok',
        airtable_pat_configured: Boolean(process.env.AIRTABLE_PAT),
        gemini_api_key_configured: Boolean(process.env.GEMINI_API_KEY),
        n8n_webhook_configured: Boolean(process.env.N8N_WEBHOOK_URL && process.env.N8N_WEBHOOK_SECRET),
        catalogue_source: catalogue.source,
        destinations_count: catalogue.destinations.length,
        hotels_count: catalogue.hotels.length,
        reviews_count: catalogue.reviews.length,
        cache_age_seconds: Math.floor((Date.now() - catalogue.lastFetched) / 1000)
      });
      return true;
    }

    // 2. GET /catalogue (public product data only)
    if (pathname === '/catalogue' && req.method === 'GET') {
      const catalogue = await getCatalogueData();
      sendJson(res, 200, {
        destinations: catalogue.destinations,
        hotels: catalogue.hotels,
        reviews: catalogue.reviews,
        source: catalogue.source,
        lastFetched: catalogue.lastFetched
      });
      return true;
    }

    // 3. POST /chat (signed-in users only, rate limited)
    if (pathname === '/chat' && req.method === 'POST') {
      const auth = await verifyIdToken(req);
      if (!auth) {
        sendJson(res, 401, { error: 'Please sign in to use the planner.' });
        return true;
      }
      if (!allowRequest('chat:' + auth.uid, CHAT_LIMIT_PER_MINUTE)) {
        sendJson(res, 429, { error: 'Too many requests. Please wait a minute and try again.' });
        return true;
      }
      const parsed = await parseJsonBody(req);
      if (parsed.tooLarge) {
        sendJson(res, 413, { error: 'Request is too large.' });
        return true;
      }
      if (parsed.invalid) {
        sendJson(res, 400, { error: 'Invalid JSON body.' });
        return true;
      }
      const { message, userProfile } = parsed.body || {};

      if (!message || typeof message !== 'string' || message.length > 2000) {
        sendJson(res, 400, { error: 'Message is required (maximum 2000 characters).' });
        return true;
      }

      // Requirement 6: Never send user's email or display name to Gemini
      const sanitizedProfile = userProfile ? {
        traveller_type: userProfile.traveller_type,
        budget_inr: userProfile.budget_inr,
        food_preference: userProfile.food_preference,
        accessibility_need: userProfile.accessibility_need
      } : undefined;

      const result = await processChatWithGemini(message, sanitizedProfile);

      // Requirement 6: Webhook to n8n fires after every successful generation (fire-and-forget, 5s timeout)
      const humanDestName = result.itineraryJson?.destination_name || result.matchedDestinations?.[0]?.destination_name || 'Lansdowne';
      const slotsTravellerType = result.slots?.traveller_type || 'couple';
      const profileTravellerType = sanitizedProfile?.traveller_type || slotsTravellerType;
      const accessibilityNeed = result.slots?.accessibility || sanitizedProfile?.accessibility_need || 'none';
      const totalCost = result.itineraryJson?.cost?.total_inr || 0;

      forwardItineraryToN8n({
        event: 'generated',
        trip_request: message,
        generated_recommendation: result.responseText,
        destination_name: humanDestName,
        traveller_type: slotsTravellerType,
        profile_traveller_type: profileTravellerType,
        accessibility_need: accessibilityNeed,
        estimated_cost: totalCost,
        user_id: auth.uid,
        itinerary_summary: `${humanDestName} · ₹${totalCost.toLocaleString('en-IN')} total · ${slotsTravellerType}`,
        ai_explanation: '',
        evidence_source_reviews: (result.itineraryJson?.evidence || []).map(e => e.review_id).join(', '),
        safety_notes: result.itineraryJson?.safety_notes || '',
        cleanliness_notes: '',
        vegetarian_notes: result.itineraryJson?.food_notes || '',
        assumptions: (result.itineraryJson?.assumptions || []).join('; '),
        alternatives: (result.itineraryJson?.alternatives || []).map(a => a.destination_name).join(', ')
      }).catch(err => {
        console.warn('[n8n generation webhook notice]:', err?.message);
      });

      sendJson(res, 200, result);
      return true;
    }

    // 4. POST /save-itinerary-airtable (signed-in owner of a saved itinerary only)
    if (pathname === '/save-itinerary-airtable' && req.method === 'POST') {
      const auth = await verifyIdToken(req);
      if (!auth) {
        sendJson(res, 401, { error: 'Please sign in to save trips.' });
        return true;
      }
      if (!allowRequest('save:' + auth.uid, SAVE_LIMIT_PER_MINUTE)) {
        sendJson(res, 429, { error: 'Too many requests. Please wait a minute and try again.' });
        return true;
      }
      const parsed = await parseJsonBody(req);
      if (parsed.tooLarge) {
        sendJson(res, 413, { error: 'Request is too large.' });
        return true;
      }
      if (parsed.invalid) {
        sendJson(res, 400, { error: 'Invalid JSON body.' });
        return true;
      }
      const body = parsed.body || {};
      const itineraryId = String(body.itinerary_id || '');
      if (!ITINERARY_ID_PATTERN.test(itineraryId)) {
        sendJson(res, 400, { error: 'Invalid itinerary_id.' });
        return true;
      }

      const fields = await fetchOwnedItineraryFields(itineraryId, auth.idToken);
      if (!fields) {
        sendJson(res, 404, { error: 'Saved itinerary not found for this account.' });
        return true;
      }

      const evidence = pickEvidence(body);
      const tripRequest = fieldString(fields, 'request_text') || String(body.trip_request || '');
      const itineraryText = fieldString(fields, 'response_text') || String(body.itinerary_text || '');
      const totalInr = Number(body.total_inr) || 0;
      const travellerType = String(body.traveller_type || 'traveller').slice(0, 30);

      // Requirement 6: destination_name must be the human name, NOT IDs like "D11, D06, D07"
      let destName = String(body.destination_name || fieldString(fields, 'destination_name') || '');
      if (!destName || /^D\d+/.test(destName) || destName === 'verified_catalogue_spots') {
        const destMatch = itineraryText.match(/### 1\. Trip Overview:\s*([^\n\r]+)/) ||
                          itineraryText.match(/\*\s*\*\*Destination:\*\*\s*\*\*([^*]+)\*\*/);
        destName = destMatch ? destMatch[1].trim() : (fieldString(fields, 'destination_ids') || 'Custom Getaway');
      }

      const summary = `${destName} · ₹${totalInr.toLocaleString('en-IN')} total · ${travellerType}`;

      const queued = await forwardItineraryToN8n({
        event: 'saved',
        itinerary_id: itineraryId,
        trip_request: tripRequest,
        generated_recommendation: itineraryText,
        evidence_source_reviews: evidence.evidence_source_reviews || '',
        estimated_cost: totalInr,
        estimated_travel_time: evidence.estimated_travel_time || '',
        assumptions: evidence.assumptions || '',
        alternatives: evidence.alternatives || '',
        safety_notes: evidence.safety_notes || '',
        cleanliness_notes: evidence.cleanliness_notes || '',
        vegetarian_notes: evidence.vegetarian_notes || '',
        user_id: auth.uid,
        itinerary_summary: summary,
        ai_explanation: '',
        traveller_type: travellerType,
        profile_traveller_type: travellerType,
        destination_name: destName,
        accessibility_need: String(body.accessibility_need || '')
      });

      if (!queued) {
        sendJson(res, 503, { error: 'n8n webhook is not configured' });
        return true;
      }

      sendJson(res, 202, { status: 'queued' });
      return true;
    }

    // 5. GET /api/review-status?ids=itin_...,itin_... (Requirement 8)
    // Signed-in owners only. Returns each saved trip's human-review status from Airtable
    // Itinerary_Log and, ONLY when a reviewer has set Review Status = Approved, the approved
    // "why this itinerary" text (final_approved_output). Unreviewed AI text is never returned.
    if (pathname === '/review-status' && req.method === 'GET') {
      const auth = await verifyIdToken(req);
      if (!auth) {
        sendJson(res, 401, { error: 'Please sign in to view review status.' });
        return true;
      }
      const parsedUrl = new URL(url, 'http://localhost');
      const rawIds = parsedUrl.searchParams.get('ids') || '';
      const idList = rawIds.split(',').map(s => s.trim()).filter(id => ITINERARY_ID_PATTERN.test(id)).slice(0, 50);

      if (idList.length === 0) {
        sendJson(res, 200, { statuses: {}, explanations: {} });
        return true;
      }

      const pat = process.env.AIRTABLE_PAT;
      if (!pat) {
        sendJson(res, 200, { statuses: {}, explanations: {} });
        return true;
      }

      try {
        const nameClauses = idList.map(id => `{Name} = '${id}'`);
        const nameMatch = nameClauses.length === 1 ? nameClauses[0] : `OR(${nameClauses.join(', ')})`;
        // Owner check: only rows logged for this signed-in user's uid are returned.
        const formula = `AND(${nameMatch}, {user_id} = '${auth.uid.replace(/'/g, "\\'")}')`;
        const params = new URLSearchParams();
        params.set('filterByFormula', formula);
        params.append('fields[]', 'Name');
        params.append('fields[]', 'Review Status');
        params.append('fields[]', 'final_approved_output');
        const airtableUrl = `https://api.airtable.com/v0/applFLKlGXGMP5D8U/tbl60eR9auEDeZhpO?${params.toString()}`;

        const atRes = await fetch(airtableUrl, {
          headers: { Authorization: `Bearer ${pat}` }
        });

        const statuses: Record<string, string> = {};
        const explanations: Record<string, string> = {};
        if (atRes.ok) {
          const atData: any = await atRes.json();
          for (const rec of (atData.records || [])) {
            const name = rec.fields?.Name;
            const rawStatus = rec.fields?.['Review Status'];
            const revStatus = typeof rawStatus === 'string' ? rawStatus : rawStatus?.name;
            if (!name || !revStatus) continue;
            statuses[name] = revStatus;
            const approvedText = rec.fields?.final_approved_output;
            if (revStatus === 'Approved' && typeof approvedText === 'string' && approvedText.trim()) {
              explanations[name] = approvedText.trim();
            }
          }
        } else {
          console.warn('[Review Status] Airtable responded', atRes.status);
        }

        sendJson(res, 200, { statuses, explanations });
        return true;
      } catch (err: any) {
        console.error('[Review Status Fetch Error]:', err?.message);
        sendJson(res, 200, { statuses: {}, explanations: {} });
        return true;
      }
    }

    sendJson(res, 404, { error: 'Not found: ' + rawPath });
    return true;
  } catch (err: any) {
    const primaryStatus = err?.primary_error_status !== undefined ? err.primary_error_status : null;
    console.error('[API Failure 502]:', err && err.message ? err.message : err, 'primary_error_status:', primaryStatus);
    const rawError = String(err && err.message ? err.message : 'Service failure');
    // Requirement 10: Quota message. If Gemini returns 429 or RESOURCE_EXHAUSTED, show:
    // "Our trip planner is busy right now — please try again in a few minutes." Never show raw Gemini or API error text to users; log it server-side instead.
    const isQuota = primaryStatus === 429 ||
                    rawError.includes('429') ||
                    rawError.includes('RESOURCE_EXHAUSTED') ||
                    rawError.toLowerCase().includes('quota') ||
                    rawError.toLowerCase().includes('rate-limit') ||
                    rawError.toLowerCase().includes('rate limit');
    const userMessage = isQuota
      ? 'Our trip planner is busy right now — please try again in a few minutes.'
      : 'Our trip planner is temporarily unavailable — please try again in a moment.';

    if (!res.headersSent) {
      sendJson(res, 502, {
        error: userMessage,
        primary_error_status: primaryStatus
      });
    } else {
      res.end();
    }
    return true;
  }
}

export default handleApiRequest;

// Evidence fields the n8n workflow writes to Airtable
function pickEvidence(body: any): Record<string, string> {
  const keys = ['estimated_travel_time', 'safety_notes', 'cleanliness_notes', 'vegetarian_notes', 'evidence_source_reviews', 'assumptions', 'alternatives'];
  const out: Record<string, string> = {};
  for (const k of keys) out[k] = String(body?.[k] ?? '').slice(0, 2000);
  return out;
}
