// Place search, proxied.
//
// The obvious thing is to call Google Places straight from the app with an
// EXPO_PUBLIC_ key — but a key in a mobile bundle can be extracted, and
// Google's web-service APIs can only be restricted by IP, not by app. An
// extracted key is therefore an open tab on your billing account. Keeping it
// here means it never ships to a device, which is the same rule the Claude and
// Jev keys already follow.
//
// `verify_jwt` alone is NOT enough to mean "signed in": the publishable key
// satisfies it, and that key ships in every app bundle and in the landing
// page. So the function resolves the caller's token to an actual user and
// refuses anonymous callers itself.

import { createClient } from 'jsr:@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

type PlaceResult = {
  name: string;
  address: string | null;
  placeId: string | null;
  lat: number | null;
  lng: number | null;
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  // Reject anyone who isn't a signed-in user, so a scraped publishable key
  // can't be pointed at this to burn Google quota.
  const authHeader = req.headers.get('Authorization') ?? '';
  const jwt = authHeader.replace(/^Bearer\s+/i, '');
  const db = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: `Bearer ${jwt}` } } },
  );
  const { data: userData } = await db.auth.getUser();
  if (!userData?.user) {
    return Response.json({ error: 'sign in to search places' }, { status: 401, headers: CORS });
  }

  const key = Deno.env.get('GOOGLE_MAPS_API_KEY');

  try {
    const { query } = (await req.json().catch(() => ({}))) as { query?: string };
    const q = (query ?? '').trim();

    // `configured: false` is how the app knows to fall back to a plain text
    // field rather than pretending search is broken.
    if (!key) return Response.json({ configured: false, places: [] }, { headers: CORS });
    if (q.length < 3) return Response.json({ configured: true, places: [] }, { headers: CORS });

    const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'X-Goog-Api-Key': key,
        'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.location',
      },
      body: JSON.stringify({ textQuery: q, maxResultCount: 6 }),
    });

    if (!res.ok) {
      console.error('places lookup failed', res.status, (await res.text()).slice(0, 300));
      return Response.json({ configured: true, places: [] }, { headers: CORS });
    }

    const json = (await res.json()) as {
      places?: {
        id: string;
        displayName?: { text: string };
        formattedAddress?: string;
        location?: { latitude: number; longitude: number };
      }[];
    };

    const places: PlaceResult[] = (json.places ?? []).map((p) => ({
      name: p.displayName?.text ?? 'Unnamed place',
      address: p.formattedAddress ?? null,
      placeId: p.id,
      lat: p.location?.latitude ?? null,
      lng: p.location?.longitude ?? null,
    }));

    return Response.json({ configured: true, places }, { headers: CORS });
  } catch (err) {
    console.error(err);
    // A search failure must never block the flow — the caller falls back to
    // typing a place name by hand.
    return Response.json({ configured: true, places: [] }, { headers: CORS });
  }
});
