// Place search, proxied.
//
// The obvious thing is to call Google Places straight from the app with an
// EXPO_PUBLIC_ key, but a key in a mobile bundle can be extracted, and
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

/** Google Places (New), used only when a key is configured. */
async function searchGoogle(q: string, key: string): Promise<PlaceResult[]> {
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
    console.error('google places failed', res.status, (await res.text()).slice(0, 300));
    return [];
  }
  const json = await res.json();
  return (json.places ?? []).map((p: any) => ({
    name: p.displayName?.text ?? 'Unnamed place',
    address: p.formattedAddress ?? null,
    placeId: p.id ?? null,
    lat: p.location?.latitude ?? null,
    lng: p.location?.longitude ?? null,
  }));
}

/**
 * Photon, the free default. No key, no card, no billing account.
 *
 * Nominatim would be the other obvious OSM option, but its usage policy
 * explicitly rules out type-ahead; Photon is built for exactly that.
 */
async function searchPhoton(q: string): Promise<PlaceResult[]> {
  const url = 'https://photon.komoot.io/api/?limit=6&q=' + encodeURIComponent(q);
  const res = await fetch(url, { headers: { 'User-Agent': 'Planora/1.0 (group planning app)' } });
  if (!res.ok) {
    console.error('photon failed', res.status);
    return [];
  }
  const json = await res.json();
  return (json.features ?? []).map((f: any) => {
    const p = f.properties ?? {};
    // Photon returns address parts, not a formatted line, assemble one.
    const address = [
      [p.housenumber, p.street].filter(Boolean).join(' '),
      p.city ?? p.district,
      p.state,
      p.country,
    ]
      .filter(Boolean)
      .join(', ');
    return {
      name: p.name ?? p.street ?? 'Unnamed place',
      address: address || null,
      // OSM ids are stable enough to identify the place again later.
      placeId: p.osm_type && p.osm_id ? `osm:${p.osm_type}${p.osm_id}` : null,
      lat: f.geometry?.coordinates?.[1] ?? null,
      lng: f.geometry?.coordinates?.[0] ?? null,
    };
  });
}

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
    if (q.length < 3) return Response.json({ configured: true, places: [] }, { headers: CORS });

    // Google needs a billing card even for its free allowance. Photon is
    // OpenStreetMap-backed, needs no key and no card, and is built for
    // type-ahead, so search works out of the box and only gets better (and
    // more accurate on small businesses) if a Google key is ever added.
    const places = key ? await searchGoogle(q, key) : await searchPhoton(q);
    return Response.json({ configured: true, places }, { headers: CORS });
  } catch (err) {
    console.error(err);
    // A search failure must never block the flow, the caller falls back to
    // typing a place name by hand.
    return Response.json({ configured: true, places: [] }, { headers: CORS });
  }
});
