// Pure roadmap derivation (PRD §6a). No Supabase import — tests load this directly.

export const STAGES = [
  'Created',
  'Availability collected',
  'Time voted',
  'Confirmed',
] as const;

export type Stage = (typeof STAGES)[number];
export type StageState = 'done' | 'current' | 'pending';

export type RoadmapInput = {
  attendeeCount: number;
  /** Distinct attendees who have saved at least one availability block. */
  availabilityCount: number;
  timePoll: { status: 'open' | 'closed'; voteCount: number } | null;
  confirmed: boolean;
};

export type RoadmapStep = { stage: Stage; state: StageState; blocker?: string };

function waiting(done: number, total: number, what: string) {
  const left = Math.max(total - done, 0);
  return `waiting on ${left}/${total} to ${what}`;
}

/**
  * Walks the four stages in order and stops at the first unfinished one, which
 * becomes `current` and carries the blocker text. Everything before it is done,
 * everything after is pending.
 */
export function deriveRoadmap(input: RoadmapInput): RoadmapStep[] {
  const { attendeeCount, availabilityCount, timePoll, confirmed } = input;

  const availabilityDone = attendeeCount > 0 && availabilityCount >= attendeeCount;
  const timeDone = timePoll?.status === 'closed';

  const done: Record<Stage, boolean> = {
    Created: true,
    'Availability collected': availabilityDone,
    'Time voted': timeDone,
    Confirmed: confirmed,
  };

  const blockers: Partial<Record<Stage, string>> = {
    'Availability collected': waiting(availabilityCount, attendeeCount, 'mark availability'),
    'Time voted': timePoll
      ? waiting(timePoll.voteCount, attendeeCount, 'vote on time')
      : 'time poll opens once everyone has marked availability',
    Confirmed: 'confirming…',
  };

  let foundCurrent = false;
  return STAGES.map((stage) => {
    if (done[stage] && !foundCurrent) return { stage, state: 'done' as const };
    if (!foundCurrent) {
      foundCurrent = true;
      return { stage, state: 'current' as const, blocker: blockers[stage] };
    }
    return { stage, state: 'pending' as const };
  });
}
