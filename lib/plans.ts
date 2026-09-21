// Pure plan shapes and grouping logic — no Supabase import here, so the
// assert checks in tests/ can load it under plain node.

export type PlanStatus = 'collecting' | 'voting' | 'decided';

/** Purely a label; it gives the venue suggester context (PRD §7.1). */
export const PLAN_TYPES = ['dinner', 'hangout', 'trip'] as const;
export type PlanType = (typeof PLAN_TYPES)[number];

export type Plan = {
  id: string;
  title: string;
  type: string;
  status: PlanStatus;
  created_by: string;
  invite_token: string;
  confirmed_start: string | null;
  confirmed_end: string | null;
  confirmed_venue: string | null;
  location_name: string | null;
  location_address: string | null;
  location_place_id: string | null;
  location_lat: number | null;
  location_lng: number | null;
  created_at: string;
};


/**
 * Home groups plans the way the PRD's status list does. A decided plan whose
 * slot has passed moves to Past; a decided plan still ahead is Scheduled.
 */
export function bucketPlans(plans: Plan[], now = new Date()) {
  const votingOpen: Plan[] = [];
  const scheduled: Plan[] = [];
  const past: Plan[] = [];

  for (const p of plans) {
    if (p.status !== 'decided') {
      votingOpen.push(p);
    } else if (p.confirmed_start && new Date(p.confirmed_start) < now) {
      past.push(p);
    } else {
      scheduled.push(p);
    }
  }
  return { votingOpen, scheduled, past };
}

/**
 * Slots are wall-clock times: the hour someone dragged on the grid is the hour
 * everyone should see, whatever timezone their phone is in. The server builds
 * them in UTC, so they are read back in UTC rather than converted to local —
 * otherwise "7 pm" becomes "12:30 am the next day" east of Greenwich.
 */
export const SLOT_TZ = 'UTC';

export function formatSlot(iso: string, opts: Intl.DateTimeFormatOptions = {}) {
  return new Date(iso).toLocaleString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    timeZone: SLOT_TZ,
    ...opts,
  });
}

/** The calendar day a slot belongs to, in the same wall-clock terms. */
export function slotDay(iso: string): string {
  return new Date(iso).toISOString().slice(0, 10);
}

/** A link that opens the place in whatever maps app the device has. */
export function mapsUrl(plan: {
  location_name: string | null;
  location_place_id: string | null;
  location_lat: number | null;
  location_lng: number | null;
}): string | null {
  if (!plan.location_name) return null;
  // `osm:` ids come from the free OpenStreetMap provider and mean nothing to
  // Google — feeding one to query_place_id lands on the wrong place, so fall
  // through to coordinates instead.
  if (plan.location_place_id && !plan.location_place_id.startsWith('osm:')) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
      plan.location_name,
    )}&query_place_id=${plan.location_place_id}`;
  }
  if (plan.location_lat != null && plan.location_lng != null) {
    return `https://www.google.com/maps/search/?api=1&query=${plan.location_lat},${plan.location_lng}`;
  }
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(plan.location_name)}`;
}
