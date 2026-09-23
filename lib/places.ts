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
): Promise<{ places: PlaceResult[]; configured: boolean; error?: string }> {
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
    // Falling back to a plain text field is right, but doing it silently meant
    // a broken search looked identical to a working one with no results, and
    // left nothing to diagnose from a phone. Say what happened.
    const message = err instanceof Error ? err.message : String(err);
    console.warn('place search unavailable; falling back to free text', err);
    return { places: [], configured: false, error: message };
  }
}
