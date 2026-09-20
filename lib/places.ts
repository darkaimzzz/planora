// Google Places lookup for the plan's location.
//
// Without EXPO_PUBLIC_GOOGLE_MAPS_API_KEY the app still works: the creator
// types a place name and it's saved as free text with a maps search link.
// Set the key and autocomplete with real addresses switches on by itself.

export const GOOGLE_MAPS_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;
export const placesEnabled = !!GOOGLE_MAPS_KEY;

export type PlaceResult = {
  name: string;
  address: string | null;
  placeId: string | null;
  lat: number | null;
  lng: number | null;
};

/**
 * Places API (New) text search. Returns [] when no key is configured, which is
 * the caller's cue to fall back to a plain text field.
 */
export async function searchPlaces(query: string): Promise<PlaceResult[]> {
  const q = query.trim();
  if (!placesEnabled || q.length < 3) return [];

  try {
    const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'X-Goog-Api-Key': GOOGLE_MAPS_KEY!,
        'X-Goog-FieldMask':
          'places.id,places.displayName,places.formattedAddress,places.location',
      },
      body: JSON.stringify({ textQuery: q, maxResultCount: 6 }),
    });
    if (!res.ok) throw new Error(`places ${res.status}`);
    const json = (await res.json()) as {
      places?: {
        id: string;
        displayName?: { text: string };
        formattedAddress?: string;
        location?: { latitude: number; longitude: number };
      }[];
    };
    return (json.places ?? []).map((p) => ({
      name: p.displayName?.text ?? 'Unnamed place',
      address: p.formattedAddress ?? null,
      placeId: p.id,
      lat: p.location?.latitude ?? null,
      lng: p.location?.longitude ?? null,
    }));
  } catch (err) {
    console.warn('places lookup failed; falling back to free text', err);
    return [];
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
