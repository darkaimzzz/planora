// Plain assert checks. Run with: npm test
import assert from 'node:assert/strict';
import { bucketPlans, type Plan } from '../lib/plans';

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

console.log('ok');
