// Plain assert checks. Run with: npm test
import assert from 'node:assert/strict';
import { bucketPlans, type Plan } from '../lib/plans';
import { deriveRoadmap } from '../lib/roadmap';
import {
  cellsToRows,
  pickWinner,
  rowsToCells,
  topSlots,
  type AvailabilityRow,
  type Cell,
} from '../lib/availability';
import { monthGrid, plansByDay, weekGrid } from '../lib/calendar';

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


// ----------------------------------------------------------- availability
{
  const rows = (
    [
      // Two people free Mon evening, one of them also Tue.
      { user_id: 'a', day: '2026-09-21', start_time: '18:00:00', end_time: '21:00:00' },
      { user_id: 'b', day: '2026-09-21', start_time: '19:00:00', end_time: '21:00:00' },
      { user_id: 'a', day: '2026-09-22', start_time: '10:00:00', end_time: '11:00:00' },
    ]
  ) as AvailabilityRow[];

  const top = topSlots(rows, 3);
  assert.equal(top[0].availabilityCount, 2, 'the best slot is the one both are free for');
  assert.equal(top[0].hour, 19, 'earliest of the two equally-popular hours wins');
  assert.equal(top[1].hour, 20);
  assert.equal(top.length, 3);

  // Round-tripping a selection must not change it, and contiguous hours
  // collapse into a single row rather than one row per hour.
  const cells = rowsToCells(rows.filter((r) => r.user_id === 'a'));
  assert.equal(cells.size, 4);
  const collapsed = cellsToRows(cells);
  assert.equal(collapsed.length, 2, 'Mon 18-21 is one row, Tue 10-11 another');
  assert.deepEqual(
    rowsToCells(collapsed.map((r) => ({ ...r, user_id: 'a' }))),
    cells,
    'cells -> rows -> cells is lossless',
  );

  // A gap must not be merged across.
  const gapped = cellsToRows(new Set(['2026-09-21|18', '2026-09-21|20'] as Cell[]));
  assert.equal(gapped.length, 2, 'a missing hour splits the run');
}

// ------------------------------------------------------------- tie-breaks
{
  // Votes decide first.
  assert.equal(
    pickWinner([
      { optionId: 'x', votes: 1, availabilityCount: 9, startsAt: '2026-09-21T20:00:00Z' },
      { optionId: 'y', votes: 2, availabilityCount: 1, startsAt: '2026-09-21T21:00:00Z' },
    ])!.optionId,
    'y',
  );

  // Tied votes -> more availability marks wins (PRD §9).
  assert.equal(
    pickWinner([
      { optionId: 'x', votes: 2, availabilityCount: 3, startsAt: '2026-09-21T21:00:00Z' },
      { optionId: 'y', votes: 2, availabilityCount: 5, startsAt: '2026-09-21T22:00:00Z' },
    ])!.optionId,
    'y',
  );

  // Tied on both -> earliest slot wins.
  assert.equal(
    pickWinner([
      { optionId: 'late', votes: 2, availabilityCount: 3, startsAt: '2026-09-21T22:00:00Z' },
      { optionId: 'early', votes: 2, availabilityCount: 3, startsAt: '2026-09-21T19:00:00Z' },
    ])!.optionId,
    'early',
  );

  assert.equal(pickWinner([]), null);
}


// ---------------------------------------------------------------- calendar
{
  const confirmed = plan({
    status: 'decided',
    title: 'Ramen',
    confirmed_start: '2026-06-17T19:00:00',
  });
  const unconfirmed = plan({ status: 'voting' });

  const grid = monthGrid(new Date('2026-06-15T12:00:00'), [confirmed, unconfirmed], now);
  assert.equal(grid.length, 42, 'a month is always six rows, so the layout never jumps');
  assert.equal(grid[0].date, '2026-06-01', 'June 2026 starts on a Monday, so no leading spill');

  const withPlan = grid.find((d) => d.date === '2026-06-17')!;
  assert.equal(withPlan.plans.length, 1);
  assert.equal(withPlan.plans[0].title, 'Ramen');
  assert.equal(
    grid.reduce((n, d) => n + d.plans.length, 0),
    1,
    'a plan with no confirmed time is on no day at all',
  );

  assert.equal(grid.find((d) => d.date === '2026-06-15')!.isToday, true);
  assert.equal(grid.find((d) => d.date === '2026-07-02')!.inCurrentPeriod, false);

  // A week always starts on the Monday of the anchor's week.
  const week = weekGrid(new Date('2026-06-17T12:00:00'), [confirmed], now);
  assert.equal(week.length, 7);
  assert.equal(week[0].date, '2026-06-15');
  assert.equal(week[2].plans.length, 1);

  // An evening plan must not slide to the next day via a UTC conversion.
  const late = plan({ status: 'decided', confirmed_start: '2026-06-17T23:30:00' });
  assert.equal([...plansByDay([late]).keys()][0], '2026-06-17');
}

console.log('ok');
