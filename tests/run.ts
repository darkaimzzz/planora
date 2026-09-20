// Plain assert checks. Run with: npm test
import assert from 'node:assert/strict';
import { bucketPlans, type Plan } from '../lib/plans';
import { deriveRoadmap } from '../lib/roadmap';

function plan(p: Partial<Plan>): Plan {
  return {
    id: Math.random().toString(36).slice(2),
    title: 'Dinner',
    type: 'dinner',
    status: 'collecting',
    created_by: 'u1',
    invite_token: 't',
    confirmed_start: null,
    confirmed_end: null,
    confirmed_venue: null,
    created_at: '2026-01-01T00:00:00Z',
    ...p,
  };
}

const now = new Date('2026-06-15T12:00:00Z');

{
  const { votingOpen, scheduled, past } = bucketPlans(
    [
      plan({ status: 'collecting' }),
      plan({ status: 'voting' }),
      plan({ status: 'decided', confirmed_start: '2026-06-20T18:00:00Z' }),
      plan({ status: 'decided', confirmed_start: '2026-06-01T18:00:00Z' }),
    ],
    now,
  );
  assert.equal(votingOpen.length, 2, 'collecting and voting both count as voting-open');
  assert.equal(scheduled.length, 1, 'a decided plan in the future is scheduled');
  assert.equal(past.length, 1, 'a decided plan in the past is past');
}

{
  // Decided but with no time on it yet shouldn't silently fall into Past.
  const { scheduled, past } = bucketPlans([plan({ status: 'decided' })], now);
  assert.equal(scheduled.length, 1);
  assert.equal(past.length, 0);
}


// ---------------------------------------------------------------- roadmap
{


  // Fresh plan: availability is the live stage, and it names who's missing.
  const fresh = deriveRoadmap({
    attendeeCount: 5,
    availabilityCount: 3,
    timePoll: null,
    venuePoll: null,
    confirmed: false,
  });
  assert.equal(fresh[0].state, 'done');
  assert.equal(fresh[1].state, 'current');
  assert.match(fresh[1].blocker!, /waiting on 2\/5/);
  assert.equal(fresh[2].state, 'pending');

  // Availability in, time poll running: current stage moves on.
  const voting = deriveRoadmap({
    attendeeCount: 2,
    availabilityCount: 2,
    timePoll: { status: 'open', voteCount: 1 },
    venuePoll: null,
    confirmed: false,
  });
  assert.equal(voting[1].state, 'done');
  assert.equal(voting[2].state, 'current');
  assert.match(voting[2].blocker!, /waiting on 1\/2 to vote on time/);

  // Everything closed and confirmed: no stage is left current.
  const done = deriveRoadmap({
    attendeeCount: 2,
    availabilityCount: 2,
    timePoll: { status: 'closed', voteCount: 2 },
    venuePoll: { status: 'closed', voteCount: 2 },
    confirmed: true,
  });
  assert.ok(done.every((s) => s.state === 'done'), 'a confirmed plan has every stage done');

  // A plan with no attendees must not read as "availability collected".
  const empty = deriveRoadmap({
    attendeeCount: 0,
    availabilityCount: 0,
    timePoll: null,
    venuePoll: null,
    confirmed: false,
  });
  assert.equal(empty[1].state, 'current');
}

console.log('ok');
