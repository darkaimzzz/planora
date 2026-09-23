// Pure roadmap derivation (PRD §6a). No Supabase import, tests load this directly.

export const STAGES = [
  'Created',
  'Availability collected',
  'Time voted',
  'Venue decided',
  'Confirmed',
] as const;

export type Stage = (typeof STAGES)[number];
export type StageState = 'done' | 'current' | 'pending';

export type PollState = { status: 'open' | 'closed'; voteCount: number };

export type RoadmapInput = {
  attendeeCount: number;
  /** Distinct attendees who have saved at least one availability block. */
  availabilityCount: number;
  timePoll: PollState | null;
  /** Null when the creator hasn't put places to a vote. */
  venuePoll: PollState | null;
  /** True once the plan has a location, however it was decided. */
  hasLocation: boolean;
  confirmed: boolean;
};

export type RoadmapStep = { stage: Stage; state: StageState; blocker?: string };

function waiting(done: number, total: number, what: string) {
  const left = Math.max(total - done, 0);
  return `waiting on ${left}/${total} to ${what}`;
}

/**
 * Walks the stages in order and stops at the first unfinished one, which
 * becomes `current` and carries the blocker text. Everything before it is done,
 * everything after is pending.
 *
 * The venue stage has two ways to finish: the group votes on the places the
 * creator proposed, or the creator sets a single location and there is nothing
 * to vote on.
 */
export function deriveRoadmap(input: RoadmapInput): RoadmapStep[] {
  const { attendeeCount, availabilityCount, timePoll, venuePoll, hasLocation, confirmed } = input;

  const availabilityDone = attendeeCount > 0 && availabilityCount >= attendeeCount;
  const timeDone = timePoll?.status === 'closed';
  const venueDone = venuePoll ? venuePoll.status === 'closed' : hasLocation;

  const done: Record<Stage, boolean> = {
    Created: true,
    'Availability collected': availabilityDone,
    'Time voted': timeDone,
    'Venue decided': venueDone,
    Confirmed: confirmed,
  };

  const blockers: Partial<Record<Stage, string>> = {
    'Availability collected': waiting(availabilityCount, attendeeCount, 'mark availability'),
    'Time voted': timePoll
      ? waiting(timePoll.voteCount, attendeeCount, 'vote on time')
      : 'the time poll opens once everyone has marked availability',
    'Venue decided': venuePoll
      ? waiting(venuePoll.voteCount, attendeeCount, 'vote on the place')
      : 'waiting on the organiser to propose places',
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
