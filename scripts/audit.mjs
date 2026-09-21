// Adversarial audit against the live project. Run with: npm run audit
//
// Every check here is a defect that was once real, probed from the attacker's
// side. It exists so a regression shows up as a failure rather than as a
// quiet hole. Fixtures are isolated @planora.test accounts, deleted at the
// end; nothing here touches seeded or real data.
import { BASE, PUBLISHABLE, SECRET, api, testUser, required } from './env.mjs';

const tag = Date.now();
const users = [];
let pass = 0;
const failures = [];

function check(name, ok, detail) {
  if (ok) {
    pass++;
    console.log(`  ok    ${name}`);
  } else {
    failures.push({ name, detail });
    console.log(`  FAIL  ${name}  ${JSON.stringify(detail)}`);
  }
}

/** Raw request, so we control exactly which credentials go on the wire. */
async function call(path, { body, token, method = 'POST' } = {}) {
  const headers = { apikey: PUBLISHABLE, 'content-type': 'application/json', Prefer: 'return=representation' };
  if (token) headers.authorization = `Bearer ${token}`;
  const res = await fetch(BASE + path, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  return { status: res.status, data, ok: res.status < 300 };
}

const sql = async (query) => {
  const pat = required('SUPABASE_ACCESS_TOKEN');
  const ref = new URL(BASE).hostname.split('.')[0];
  const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: 'POST',
    headers: { authorization: `Bearer ${pat}`, 'content-type': 'application/json' },
    body: JSON.stringify({ query }),
  });
  return { status: res.status, data: await res.json().catch(() => null) };
};

try {
  const creator = await testUser(`audit-${tag}-creator@planora.test`, 'Audit Creator', '#5B5BD6');
  const guest = await testUser(`audit-${tag}-guest@planora.test`, 'Audit Guest', '#5B5BD6');
  const outsider = await testUser(`audit-${tag}-outsider@planora.test`, 'Audit Outsider', '#5B5BD6');
  users.push(creator, guest, outsider);

  const newPlan = async (title, extra = {}) =>
    (
      await api('/rest/v1/plans', {
        method: 'POST',
        token: creator.token,
        prefer: 'return=representation',
        body: { title: `AUDIT ${tag} ${title}`, created_by: creator.id, ...extra },
      })
    )[0];

  const plan = await newPlan('main');
  await call('/rest/v1/rpc/join_plan_by_token', { token: guest.token, body: { p_token: plan.invite_token } });

  // ------------------------------------------------------------- 1. access
  console.log('\nplan access');
  const anonRead = await call(`/rest/v1/plans?id=eq.${plan.id}`, { method: 'GET' });
  check('anonymous cannot read a plan', (anonRead.data ?? []).length === 0, anonRead);
  const outRead = await call(`/rest/v1/plans?id=eq.${plan.id}`, { token: outsider.token, method: 'GET' });
  check('a non-attendee cannot read a plan', (outRead.data ?? []).length === 0, outRead);
  const selfJoin = await call('/rest/v1/plan_attendees', {
    token: outsider.token,
    body: { plan_id: plan.id, user_id: outsider.id },
  });
  check('a stranger cannot add themselves to a plan', !selfJoin.ok, selfJoin.status);
  const asOther = await call('/rest/v1/availability', {
    token: outsider.token,
    body: { plan_id: plan.id, user_id: creator.id, day: '2030-01-01', start_time: '18:00', end_time: '19:00' },
  });
  check('nobody can write availability as someone else', !asOther.ok, asOther.status);

  // ------------------------------------------------- 2. propose_venues auth
  console.log('\nvenue proposals');
  const anonPropose = await call('/rest/v1/rpc/propose_venues', {
    body: { p_plan_id: plan.id, p_places: [{ name: 'X' }, { name: 'Y' }] },
  });
  check('anonymous cannot propose venues', !anonPropose.ok, anonPropose);
  const guestPropose = await call('/rest/v1/rpc/propose_venues', {
    token: guest.token,
    body: { p_plan_id: plan.id, p_places: [{ name: 'X' }, { name: 'Y' }] },
  });
  check('a non-creator attendee cannot propose venues', !guestPropose.ok, guestPropose.status);
  const onePlace = await call('/rest/v1/rpc/propose_venues', {
    token: creator.token,
    body: { p_plan_id: plan.id, p_places: [{ name: 'Only one' }] },
  });
  check('one place is refused (that path sets the location instead)', !onePlace.ok, onePlace.status);
  const proposed = await call('/rest/v1/rpc/propose_venues', {
    token: creator.token,
    body: { p_plan_id: plan.id, p_places: [{ name: 'Cafe A' }, { name: 'Cafe B' }] },
  });
  check('the creator can propose venues', proposed.ok, proposed.status);

  // --------------------------------------------------------- 3. email leak
  console.log('\nemail exposure');
  const readEmail = await call(`/rest/v1/profiles?id=eq.${creator.id}&select=id,email`, {
    token: outsider.token,
    method: 'GET',
  });
  check('emails are not selectable at all', !readEmail.ok, readEmail.status);
  const dump = await call('/rest/v1/profiles?select=email', { token: outsider.token, method: 'GET' });
  check('the profiles table cannot be dumped for emails', !dump.ok, dump.status);
  const names = await call('/rest/v1/profiles?select=id,display_name,avatar_color', {
    token: outsider.token,
    method: 'GET',
  });
  check('display names are still readable (attendee lists need them)', names.ok, names.status);
  const found = await call('/rest/v1/rpc/search_people', {
    token: outsider.token,
    body: { p_query: `audit-${tag}-creator@planora.test` },
  });
  const hit = (found.data ?? [])[0];
  check('you can still find someone by their email', hit?.id === creator.id, found.data);
  check('but the search never returns an address', hit !== undefined && !('email' in hit), hit);
  const anonSearch = await call('/rest/v1/rpc/search_people', { body: { p_query: 'audit' } });
  check('anonymous cannot search people', !anonSearch.ok, anonSearch.status);

  // ------------------------------------------------------- 4. forged plans
  console.log('\nforged decisions');
  const forged = await call('/rest/v1/plans', {
    token: creator.token,
    body: {
      title: `AUDIT ${tag} forged`,
      created_by: creator.id,
      status: 'decided',
      confirmed_start: '2030-01-01T19:00:00Z',
      confirmed_venue: 'Never voted on',
    },
  });
  check('a plan cannot be created already decided', !forged.ok, forged.status);
  const flip = await call(`/rest/v1/plans?id=eq.${plan.id}`, {
    token: creator.token,
    method: 'PATCH',
    body: { status: 'decided' },
  });
  check('the creator cannot force a plan to decided', !flip.ok, flip.status);
  const retitle = await call(`/rest/v1/plans?id=eq.${plan.id}`, {
    token: creator.token,
    method: 'PATCH',
    body: { title: `AUDIT ${tag} renamed` },
  });
  check('the creator can still rename their plan', retitle.ok, retitle.status);
  const overrideLocation = await call(`/rest/v1/plans?id=eq.${plan.id}`, {
    token: creator.token,
    method: 'PATCH',
    body: { location_name: 'Somewhere nobody voted for' },
  });
  check('the creator cannot override a running venue vote', !overrideLocation.ok, overrideLocation.status);

  // ------------------------------------------------------- 5. poll writing
  console.log('\npolls and votes');
  const clientPoll = await call('/rest/v1/polls', {
    token: creator.token,
    body: { plan_id: plan.id, poll_type: 'time' },
  });
  check('no client can create a poll directly', !clientPoll.ok, clientPoll.status);

  const day = new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10);
  for (const u of [creator, guest]) {
    await api('/rest/v1/availability', {
      token: u.token,
      method: 'POST',
      body: { plan_id: plan.id, user_id: u.id, day, start_time: '18:00', end_time: '21:00' },
    });
  }
  // Fire a burst: this is what several people saving at once looks like.
  await Promise.all(Array.from({ length: 8 }, () => call('/functions/v1/advance-plan', { body: { plan_id: plan.id } })));
  const polls = await api(`/rest/v1/polls?plan_id=eq.${plan.id}`, { token: SECRET });
  const timePolls = polls.filter((p) => p.poll_type === 'time');
  check('8 concurrent advances create exactly one time poll', timePolls.length === 1, {
    timePolls: timePolls.length,
  });
  const timePoll = timePolls[0];
  const venuePoll = polls.find((p) => p.poll_type === 'venue');
  const options = await api(`/rest/v1/poll_options?poll_id=in.(${timePoll.id},${venuePoll.id})`, { token: SECRET });
  const timeOption = options.find((o) => o.poll_id === timePoll.id);
  const venueOption = options.find((o) => o.poll_id === venuePoll.id);
  check('the time poll has options', !!timeOption, options.length);
  check('no slot in the past is ever offered', options.every((o) => !o.starts_at || o.starts_at > new Date().toISOString()), options.map((o) => o.starts_at));

  const crossPoll = await call('/rest/v1/votes', {
    token: creator.token,
    body: { poll_id: timePoll.id, option_id: venueOption.id, user_id: creator.id },
  });
  check("a vote cannot point at another poll's option", !crossPoll.ok, crossPoll.status);
  const voteAsOther = await call('/rest/v1/votes', {
    token: guest.token,
    body: { poll_id: timePoll.id, option_id: timeOption.id, user_id: creator.id },
  });
  check('nobody can vote as someone else', !voteAsOther.ok, voteAsOther.status);
  const outsiderVote = await call('/rest/v1/votes', {
    token: outsider.token,
    body: { poll_id: timePoll.id, option_id: timeOption.id, user_id: outsider.id },
  });
  check('a non-attendee cannot vote', !outsiderVote.ok, outsiderVote.status);

  // --------------------------------------------------------- 6. full flow
  console.log('\nthe flow still works end to end');
  for (const u of [creator, guest]) {
    for (const [poll, option] of [
      [timePoll, timeOption],
      [venuePoll, venueOption],
    ]) {
      await api('/rest/v1/votes', {
        token: u.token,
        method: 'POST',
        body: { poll_id: poll.id, option_id: option.id, user_id: u.id },
      });
    }
  }
  await call('/functions/v1/advance-plan', { token: creator.token, body: { plan_id: plan.id } });
  await call('/functions/v1/advance-plan', { token: creator.token, body: { plan_id: plan.id } });
  const done = (await api(`/rest/v1/plans?id=eq.${plan.id}`, { token: guest.token }))[0];
  check('the plan confirms', done.status === 'decided', done.status);
  check('with the voted time on it', !!done.confirmed_start, done.confirmed_start);
  check('and the voted place', done.confirmed_venue === venueOption.place_name, done.confirmed_venue);
  const messages = await api(`/rest/v1/messages?plan_id=eq.${plan.id}`, { token: guest.token });
  check('the confirmation message is posted once', messages.filter((m) => m.user_id === null).length === 1, messages.length);

  const lateVote = await call(`/rest/v1/votes?poll_id=eq.${timePoll.id}&user_id=eq.${creator.id}`, {
    token: creator.token,
    method: 'DELETE',
  });
  const stillThere = await api(`/rest/v1/votes?poll_id=eq.${timePoll.id}&user_id=eq.${creator.id}`, { token: SECRET });
  check('a vote cannot be deleted after the poll closes', stillThere.length === 1, {
    status: lateVote.status,
    remaining: stillThere.length,
  });

  // ------------------------------------------------ 7. interrupted runs
  console.log('\nrecovery from a half-finished run');
  const admin = (path, method = 'GET', body) =>
    api('/rest/v1/' + path, { token: SECRET, method, body, prefer: 'return=representation' });

  // A run that died between closing the time poll and writing the time.
  const halfway = (await admin('plans', 'POST', { created_by: creator.id, title: `AUDIT ${tag} halfway` }))[0];
  const hp = (await admin('polls', 'POST', { plan_id: halfway.id, poll_type: 'time' }))[0];
  const ho = (
    await admin('poll_options', 'POST', {
      poll_id: hp.id,
      label: 'Thu 7 pm',
      starts_at: '2030-01-03T19:00:00Z',
      ends_at: '2030-01-03T20:00:00Z',
    })
  )[0];
  await admin(`polls?id=eq.${hp.id}`, 'PATCH', { status: 'closed', winning_option_id: ho.id });
  await admin(`plans?id=eq.${halfway.id}`, 'PATCH', { status: 'voting', location_name: 'A real place' });
  await call('/functions/v1/advance-plan', { body: { plan_id: halfway.id } });
  const rescued = (await admin(`plans?id=eq.${halfway.id}`))[0];
  check('a plan is never confirmed without a time', !(rescued.status === 'decided' && !rescued.confirmed_start), {
    status: rescued.status,
    confirmed_start: rescued.confirmed_start,
  });
  check('the time is recovered from the winning option', rescued.confirmed_start === ho.starts_at, rescued.confirmed_start);

  // A run that died between deciding and announcing it.
  const silent = (
    await admin('plans', 'POST', {
      created_by: creator.id,
      title: `AUDIT ${tag} silent`,
      status: 'decided',
      confirmed_start: '2030-01-03T19:00:00Z',
      confirmed_venue: 'A real place',
      location_name: 'A real place',
    })
  )[0];
  await call('/functions/v1/advance-plan', { body: { plan_id: silent.id } });
  const rescuedMsgs = await admin(`messages?plan_id=eq.${silent.id}`);
  check('a missing confirmation message is posted by a later sweep', rescuedMsgs.length === 1, rescuedMsgs.length);
  await call('/functions/v1/advance-plan', { body: { plan_id: silent.id } });
  const afterTwice = await admin(`messages?plan_id=eq.${silent.id}`);
  check('and not posted twice', afterTwice.length === 1, afterTwice.length);

  // ------------------------------------------------------- 8. the outside
  console.log('\nedge functions and scheduling');
  const anonPlaces = await call('/functions/v1/places-search', { body: { query: 'London' } });
  check('place search rejects a caller with no session', anonPlaces.status === 401, anonPlaces.status);
  const authPlaces = await call('/functions/v1/places-search', { token: creator.token, body: { query: 'Blue Tokai' } });
  check('place search works for a signed-in user', authPlaces.ok && authPlaces.data.places?.length > 0, authPlaces.status);

  const cron = await sql("select jobname, schedule, active from cron.job where jobname = 'planora-advance-sweep'");
  const job = (cron.data ?? [])[0];
  check('the 24h cap has a scheduler behind it', job?.active === true, cron.data);

  // ---------------------------------------------------- 9. deleting an account
  console.log('\naccount deletion');
  const doomed = await testUser(`audit-${tag}-doomed@planora.test`, 'Audit Doomed', '#5B5BD6');
  users.push(doomed);
  await call('/rest/v1/rpc/join_plan_by_token', { token: doomed.token, body: { p_token: plan.invite_token } });
  await api('/rest/v1/messages', {
    token: doomed.token,
    method: 'POST',
    body: { plan_id: plan.id, user_id: doomed.id, content: 'Audit message' },
  });
  const anonDelete = await call('/rest/v1/rpc/delete_own_account', {});
  check('anonymous cannot call the delete RPC', !anonDelete.ok, anonDelete.status);
  await call('/rest/v1/rpc/delete_own_account', { token: doomed.token, body: {} });
  const gone = await api(`/rest/v1/profiles?id=eq.${doomed.id}`, { token: SECRET });
  const theirMessages = await api(`/rest/v1/messages?user_id=eq.${doomed.id}`, { token: SECRET });
  const systemMessages = await api(`/rest/v1/messages?plan_id=eq.${plan.id}&user_id=is.null`, { token: SECRET });
  check('their profile is gone', gone.length === 0, gone.length);
  check('their messages are gone', theirMessages.length === 0, theirMessages.length);
  check('their messages did not become system announcements', systemMessages.length === 1, systemMessages.length);
  check("someone else's plan survives", (await api(`/rest/v1/plans?id=eq.${plan.id}`, { token: SECRET })).length === 1);
} catch (err) {
  failures.push({ name: 'execution error', detail: String(err) });
  console.error(err);
} finally {
  for (const u of users) {
    await api(`/auth/v1/admin/users/${u.id}`, { token: SECRET, method: 'DELETE' }).catch(() => {});
  }
  console.log(`\n${pass} passed, ${failures.length} failed`);
  if (failures.length) {
    for (const f of failures) console.log(`  FAIL ${f.name}: ${JSON.stringify(f.detail)}`);
    process.exit(1);
  }
}
