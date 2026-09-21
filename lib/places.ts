import { supabase } from './supabase';

// Place lookup and map links. Invite-link helpers live in lib/invite.ts.

const PUBLIC_BASE = process.env.EXPO_PUBLIC_APP_URL?.replace(/\/$/, '');

export type PlaceResult = {
  name: string;
  address: string | null;
  placeId: string | null;
  lat: number | null;
  lng: number | null;
};

/**
 * Search for a place.
 *
 * Goes through the `places-search` Edge Function rather than calling Google
 * directly: the API key would otherwise ship inside the app bundle, where it
 * can be extracted, and Google's web-service APIs can't be restricted per app.
 *
 * `configured` is false when the server has no Google key, which is the
 * caller's cue to offer a plain text field instead of pretending search works.
 */
export async function searchPlaces(
  query: string,
): Promise<{ places: PlaceResult[]; configured: boolean }> {
  const q = query.trim();
  if (q.length < 3) return { places: [], configured: true };

  try {
    const { data, error } = await supabase.functions.invoke('places-search', {
      body: { query: q },
    });
    if (error) throw error;
    return {
      places: (data?.places ?? []) as PlaceResult[],
      configured: data?.configured !== false,
    };
  } catch (err) {
    console.warn('place search unavailable; falling back to free text', err);
    return { places: [], configured: false };
  }
}

/** A link that opens the place in whatever maps app the device has. */
export function mapsUrl(plan: {
  location_name: string | null;
  location_place_id: string | null;
  location_lat: number | null;
  location_lng: number | null;
}): string | null {
  if (!plan.location_name) return null;
  if (plan.location_place_id) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
      plan.location_name,
    )}&query_place_id=${plan.location_place_id}`;
  }
  if (plan.location_lat != null && plan.location_lng != null) {
    return `https://www.google.com/maps/search/?api=1&query=${plan.location_lat},${plan.location_lng}`;
  }
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(plan.location_name)}`;
}

