import { useCallback, useEffect, useState } from 'react';
import { supabase } from './supabase';
import { fetchAttendees, fetchPlan, type Attendee } from './planQueries';
import type { Plan } from './plans';
import type { RoadmapInput } from './roadmap';

export type PollSummary = { id: string; status: 'open' | 'closed'; voteCount: number };

export type PlanData = {
  plan: Plan | null;
  attendees: Attendee[];
  roadmap: RoadmapInput;
  loading: boolean;
  reload: () => Promise<void>;
};

/**
 * Everything the per-plan tabs need, in one round of queries. Realtime pokes it
 * to reload rather than patching state in place — plans are small, and a reload
 * can't drift out of sync with the database the way incremental patching can.
 */
export function usePlanData(planId: string | undefined): PlanData {
  const [plan, setPlan] = useState<Plan | null>(null);
  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [availabilityCount, setAvailabilityCount] = useState(0);
  const [timePoll, setTimePoll] = useState<PollSummary | null>(null);
  const [venuePoll, setVenuePoll] = useState<PollSummary | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    if (!planId) return;

    const [planRow, attendeeRows, availabilityRows, pollRows] = await Promise.all([
      fetchPlan(planId),
      fetchAttendees(planId),
      supabase.from('availability').select('user_id').eq('plan_id', planId),
      supabase.from('polls').select('id, poll_type, status').eq('plan_id', planId),
    ]);

    setPlan(planRow);
    setAttendees(attendeeRows);
    setAvailabilityCount(new Set((availabilityRows.data ?? []).map((r) => r.user_id)).size);

    const polls = (pollRows.data ?? []) as { id: string; poll_type: string; status: 'open' | 'closed' }[];
    const summarise = async (pollType: string): Promise<PollSummary | null> => {
      const row = polls.find((p) => p.poll_type === pollType);
      if (!row) return null;
      const { count } = await supabase
        .from('votes')
        .select('id', { count: 'exact', head: true })
        .eq('poll_id', row.id);
      return { id: row.id, status: row.status, voteCount: count ?? 0 };
    };
    setTimePoll(await summarise('time'));
    setVenuePoll(await summarise('venue'));
    setLoading(false);
  }, [planId]);

  useEffect(() => {
    reload();
    if (!planId) return;

    const channel = supabase
      .channel(`plan-${planId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'polls', filter: `plan_id=eq.${planId}` }, reload)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'votes' }, reload)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'plan_attendees', filter: `plan_id=eq.${planId}` }, reload)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [planId, reload]);

  return {
    plan,
    attendees,
    loading,
    reload,
    roadmap: {
      attendeeCount: attendees.length,
      availabilityCount,
      timePoll,
      venuePoll,
      hasLocation: !!plan?.location_name,
      confirmed: plan?.status === 'decided',
    },
  };
}
