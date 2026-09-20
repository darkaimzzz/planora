import { supabase } from './supabase';
import type { Plan, PlanType } from './plans';

/** Every plan the signed-in user attends, newest first. RLS does the filtering. */
export async function fetchMyPlans(): Promise<Plan[]> {
  const { data, error } = await supabase
    .from('plans')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as Plan[];
}

export async function fetchPlan(planId: string): Promise<Plan> {
  const { data, error } = await supabase.from('plans').select('*').eq('id', planId).single();
  if (error) throw error;
  return data as Plan;
}

export async function createPlan(title: string, type: PlanType, userId: string): Promise<Plan> {
  const { data, error } = await supabase
    .from('plans')
    .insert({ title, type, created_by: userId })
    .select()
    .single();
  if (error) throw error;
  return data as Plan;
}

/** Creator-only, and the DB trigger enforces that nothing else can be changed. */
export async function updatePlanDetails(planId: string, title: string, type: PlanType) {
  const { error } = await supabase.from('plans').update({ title, type }).eq('id', planId);
  if (error) throw error;
}

export type Attendee = {
  user_id: string;
  joined_at: string;
  profiles: { display_name: string; avatar_color: string } | null;
};

export async function fetchAttendees(planId: string): Promise<Attendee[]> {
  const { data, error } = await supabase
    .from('plan_attendees')
    .select('user_id, joined_at, profiles(display_name, avatar_color)')
    .eq('plan_id', planId)
    .order('joined_at');
  if (error) throw error;
  return (data ?? []) as unknown as Attendee[];
}

/** Search people to invite, by display name or email. */
export async function searchProfiles(query: string, excludeIds: string[]) {
  const q = query.trim();
  if (q.length < 2) return [];
  const { data, error } = await supabase
    .from('profiles')
    .select('id, display_name, avatar_color')
    .or(`display_name.ilike.%${q}%,email.ilike.%${q}%`)
    .limit(10);
  if (error) throw error;
  return (data ?? []).filter((p) => !excludeIds.includes(p.id)) as {
    id: string;
    display_name: string;
    avatar_color: string;
  }[];
}

export async function addAttendee(planId: string, userId: string) {
  const { error } = await supabase.from('plan_attendees').insert({ plan_id: planId, user_id: userId });
  // Re-adding someone already in the plan isn't an error worth surfacing.
  if (error && !error.message.includes('duplicate')) throw error;
}

export async function joinPlanByToken(token: string): Promise<string> {
  const { data, error } = await supabase.rpc('join_plan_by_token', { p_token: token });
  if (error) throw error;
  return data as string;
}

export async function previewPlan(token: string) {
  const { data, error } = await supabase.rpc('plan_preview', { p_token: token });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  return (row ?? null) as { id: string; title: string; type: string; attendee_count: number } | null;
}

/** Creator-only: set (or clear) the plan's one location. */
export async function updatePlanLocation(
  planId: string,
  place: { name: string; address?: string | null; placeId?: string | null; lat?: number | null; lng?: number | null } | null,
) {
  const { error } = await supabase
    .from('plans')
    .update({
      location_name: place?.name ?? null,
      location_address: place?.address ?? null,
      location_place_id: place?.placeId ?? null,
      location_lat: place?.lat ?? null,
      location_lng: place?.lng ?? null,
    })
    .eq('id', planId);
  if (error) throw error;
}

/**
 * Creator-only: put two or three places to a vote. Replaces any existing
 * options, and the database refuses once anyone has voted.
 */
export async function proposeVenues(planId: string, places: PlaceLike[]) {
  const { error } = await supabase.rpc('propose_venues', {
    p_plan_id: planId,
    p_places: places.map((p) => ({
      name: p.name,
      address: p.address ?? null,
      placeId: p.placeId ?? null,
      lat: p.lat ?? null,
      lng: p.lng ?? null,
    })),
  });
  if (error) throw error;
}

export type PlaceLike = {
  name: string;
  address?: string | null;
  placeId?: string | null;
  lat?: number | null;
  lng?: number | null;
};
