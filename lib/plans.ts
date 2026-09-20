// Pure plan shapes and grouping logic — no Supabase import here, so the
// assert checks in tests/ can load it under plain node.

export type PlanStatus = 'collecting' | 'voting' | 'decided';

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
