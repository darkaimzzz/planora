// Fills the dev database with two accounts and three plans, one at each stage
// of the flow, so every screen has something real to show.
//
//   npm run seed
//
// Safe to re-run: `reset` runs first, so you always get the same fixture.
import { api, testUser, BASE, PUBLISHABLE, TEST_PASSWORD } from './env.mjs';
import { reset } from './reset.mjs';

const advance = (planId) =>
  fetch(`${BASE}/functions/v1/advance-plan`, {
    method: 'POST',
    headers: { apikey: PUBLISHABLE, 'content-type': 'application/json' },
    body: JSON.stringify({ plan_id: planId }),
  }).then((r) => r.json());

/** Days relative to today, so seeded plans never go stale. */
function day(offset) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
}

async function newPlan(creator, friend, title, type) {
  const plan = (
    await api('/rest/v1/plans', {
      token: creator.token,
      method: 'POST',
      prefer: 'return=representation',
      body: { title, type, created_by: creator.id },
    })
  )[0];
  await api('/rest/v1/rpc/join_plan_by_token', {
    token: friend.token,
    method: 'POST',
    body: { p_token: plan.invite_token },
  });
  return plan;
}

async function markAvailable(plan, users, dayOffset, from, to) {
  for (const u of users) {
    await api('/rest/v1/availability', {
      token: u.token,
      method: 'POST',
      body: [{ plan_id: plan.id, user_id: u.id, day: day(dayOffset), start_time: from, end_time: to }],
    });
  }
}

async function timePollOf(plan, user) {
  const poll = (await api(`/rest/v1/polls?plan_id=eq.${plan.id}&poll_type=eq.time&select=id`, { token: user.token }))[0];
  const options = await api(`/rest/v1/poll_options?poll_id=eq.${poll.id}&select=id&order=starts_at`, { token: user.token });
  return { poll, options };
}

const vote = (user, pollId, optionId) =>
  api('/rest/v1/votes', {
    token: user.token,
    method: 'POST',
    body: { poll_id: pollId, option_id: optionId, user_id: user.id },
  });

async function main() {
  await reset({ quiet: true });

  const me = await testUser(`demo@planora.test`, 'Demo', '#8b5cf6');
  const sam = await testUser(`sam@planora.test`, 'Sam', '#14b8a6');

  // 1. Collecting availability, nobody has marked anything yet.
  await newPlan(me, sam, 'Badminton on Thursday', 'hangout');

  // 2. Time poll open, one of two has voted.
  const voting = await newPlan(me, sam, 'Weekend trip', 'trip');
  await markAvailable(voting, [me, sam], 10, '09:00:00', '13:00:00');
  await advance(voting.id);
  const t = await timePollOf(voting, me);
  await vote(sam, t.poll.id, t.options[1].id);

  // 3. Time settled, venue vote running on three real-looking places.
  const venue = await newPlan(me, sam, 'Sunday roast', 'dinner');
  await api('/rest/v1/rpc/propose_venues', {
    token: me.token,
    method: 'POST',
    body: {
      p_plan_id: venue.id,
      p_places: [
        { name: 'Dosa Corner', address: '12 Main Street, Bengaluru', placeId: 'seed-1' },
        { name: 'Blue Tokai', address: '4 MG Road, Bengaluru', placeId: 'seed-2' },
        { name: 'Third Wave', address: '9 Church Street, Bengaluru', placeId: 'seed-3' },
      ],
    },
  });
  await markAvailable(venue, [me, sam], 5, '18:00:00', '21:00:00');
  await advance(venue.id);
  const t2 = await timePollOf(venue, me);
  for (const u of [me, sam]) await vote(u, t2.poll.id, t2.options[1].id);
  await advance(venue.id);
  const venuePoll = (await api(`/rest/v1/polls?plan_id=eq.${venue.id}&poll_type=eq.venue&select=id`, { token: me.token }))[0];
  const venueOptions = await api(`/rest/v1/poll_options?poll_id=eq.${venuePoll.id}&select=id&order=label`, { token: me.token });
  await vote(sam, venuePoll.id, venueOptions[0].id);
  await api('/rest/v1/messages', {
    token: sam.token,
    method: 'POST',
    body: { plan_id: venue.id, user_id: sam.id, content: 'dosa corner gets my vote' },
  });

  console.log(`
Seeded three plans, one per stage:
  · Badminton on Thursday , collecting availability
  · Weekend trip          , time poll open (1/2 voted)
  · Sunday roast          , time settled, venue vote open (1/2 voted)

Sign in with either account (same password):
  demo@planora.test  /  ${TEST_PASSWORD}
  sam@planora.test   /  ${TEST_PASSWORD}

Use two browser profiles (or a private window) to be both people at once
and watch the realtime updates land.
`);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
