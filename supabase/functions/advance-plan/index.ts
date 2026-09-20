// The whole flow lives here: open the time poll, close it (Jev early close +
// 24h hard cap), then confirm with the creator's chosen location and post
// Claude's confirmation message. Called by the client after a vote or an
// availability save, and by cron so the 24h cap fires with nobody's app open.
//
// The venue is deliberately not a poll: the creator sets one location on the
// plan. Only the time is voted on.
//
// It is one idempotent entry point on purpose: every caller just says "this
// plan may have moved", and the function works out what, if anything, is next.

import { createClient } from 'jsr:@supabase/supabase-js@2';
import Anthropic from 'npm:@anthropic-ai/sdk@0.69.0';

// Pure logic shared with the app — no imports of its own, so both Metro and
// Deno can load it.
import { pickWinner, topSlots, type AvailabilityRow, type Tally } from '../../../lib/availability.ts';

const db = createClient(
  Deno.env.get('SUPABASE_URL')!,
  // Auto-injected by Supabase. Bypasses RLS, which is why poll and
  // system-message writes have no client-side insert policy.
  // (A custom SUPABASE_* secret can't be set — the prefix is reserved.)
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY');
const anthropic = anthropicKey ? new Anthropic({ apiKey: anthropicKey }) : null;

// ---------------------------------------------------------------- Jev

/**
 * Typed Boolean decision: "has this poll effectively resolved?" Jev gets
 * structured state and returns a typed answer with a probability — never prose.
 *
 * ponytail: with no JEV_API_KEY we fall back to a deterministic rule (a
 * majority has voted and the leader is unbeatable by the remaining voters).
 * The 24h cap below means the worst case of a wrong answer is a slower close,
 * never a stuck plan.
 */
async function pollHasResolved(state: {
  votesCast: number;
  participantCount: number;
  leaderVotes: number;
  runnerUpVotes: number;
  minutesElapsed: number;
}): Promise<boolean> {
  const remaining = state.participantCount - state.votesCast;
  const unbeatable = state.leaderVotes > state.runnerUpVotes + remaining;

  const jevKey = Deno.env.get('JEV_API_KEY');
  if (!jevKey) return unbeatable && state.votesCast * 2 >= state.participantCount;

  try {
    const res = await fetch(Deno.env.get('JEV_API_URL') ?? 'https://api.jev.ai/v1/decide', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${jevKey}` },
      body: JSON.stringify({
        type: 'boolean',
        question: 'Has this poll effectively resolved, so it can close early?',
        state,
      }),
    });
    if (!res.ok) throw new Error(`jev ${res.status}`);
    const out = (await res.json()) as { answer: boolean; probability: number };
    return out.answer === true && out.probability >= 0.8;
  } catch (err) {
    console.error('jev unavailable, using fallback rule', err);
    return unbeatable && state.votesCast * 2 >= state.participantCount;
  }
}

// ------------------------------------------------------------- Claude

async function draftConfirmation(title: string, when: string, venue: string): Promise<string> {
  if (!anthropic) return `It's official — ${title}: ${when} at ${venue}. See you there!`;

  const response = await anthropic.messages.create({
    model: 'claude-opus-5',
    max_tokens: 200,
    system:
      'You write one short, warm confirmation message for a group chat. One sentence, ' +
      'an emoji is fine. Output only the message.',
    messages: [
      { role: 'user', content: `Plan "${title}" is confirmed for ${when} at ${venue}.` },
    ],
  });
  const text = response.content.find((b) => b.type === 'text');
  return text && text.type === 'text'
    ? text.text.trim()
    : `It's official — ${title}: ${when} at ${venue}!`;
}

// ------------------------------------------------------------ helpers

async function tallies(pollId: string): Promise<Tally[]> {
  const [{ data: options }, { data: votes }] = await Promise.all([
    db.from('poll_options').select('id, starts_at, availability_count').eq('poll_id', pollId),
    db.from('votes').select('option_id').eq('poll_id', pollId),
  ]);
  const counts = new Map<string, number>();
  for (const v of votes ?? []) counts.set(v.option_id, (counts.get(v.option_id) ?? 0) + 1);

  return (options ?? []).map((o) => ({
    optionId: o.id,
    votes: counts.get(o.id) ?? 0,
    availabilityCount: o.availability_count,
    startsAt: o.starts_at,
  }));
}

async function shouldClose(
  poll: { id: string; deadline: string },
  attendeeCount: number,
): Promise<boolean> {
  // The hard cap wins over everything, including Jev (PRD §7.4).
  if (new Date(poll.deadline) <= new Date()) return true;

  const rows = await tallies(poll.id);
  const votesCast = rows.reduce((n, r) => n + r.votes, 0);
  if (votesCast === 0) return false;
  if (votesCast >= attendeeCount) return true;

  const sorted = [...rows].sort((a, b) => b.votes - a.votes);
  return pollHasResolved({
    votesCast,
    participantCount: attendeeCount,
    leaderVotes: sorted[0]?.votes ?? 0,
    runnerUpVotes: sorted[1]?.votes ?? 0,
    minutesElapsed: Math.round(
      (Date.now() - new Date(poll.deadline).getTime() + 24 * 60 * 60 * 1000) / 60000,
    ),
  });
}

async function closePoll(pollId: string): Promise<Tally | null> {
  const winner = pickWinner(await tallies(pollId));
  await db
    .from('polls')
    .update({
      status: 'closed',
      closed_at: new Date().toISOString(),
      winning_option_id: winner?.optionId ?? null,
    })
    .eq('id', pollId);
  return winner;
}

// -------------------------------------------------------- the machine

/** Performs at most one transition. Returns true if the plan moved. */
async function step(planId: string): Promise<boolean> {
  const { data: plan } = await db.from('plans').select('*').eq('id', planId).single();
  if (!plan || plan.status === 'decided') return false;

  const { data: attendees } = await db.from('plan_attendees').select('user_id').eq('plan_id', planId);
  const attendeeCount = attendees?.length ?? 0;
  if (attendeeCount === 0) return false;

  const { data: polls } = await db.from('polls').select('*').eq('plan_id', planId);
  const timePoll = polls?.find((p) => p.poll_type === 'time');

  // 1. Everyone's availability is in -> open the time poll.
  if (!timePoll) {
    const { data: rows } = await db
      .from('availability')
      .select('user_id, day, start_time, end_time')
      .eq('plan_id', planId);

    const marked = new Set((rows ?? []).map((r) => r.user_id)).size;
    if (marked < attendeeCount) return false;

    const slots = topSlots((rows ?? []) as AvailabilityRow[], 3);
    if (slots.length === 0) return false;

    const { data: poll } = await db
      .from('polls')
      .insert({ plan_id: planId, poll_type: 'time' })
      .select()
      .single();

    await db.from('poll_options').insert(
      slots.map((s) => {
        const startsAt = new Date(`${s.day}T${String(s.hour).padStart(2, '0')}:00:00`);
        const endsAt = new Date(startsAt.getTime() + 60 * 60 * 1000);
        return {
          poll_id: poll!.id,
          label: startsAt.toLocaleString('en-GB', {
            weekday: 'short',
            day: 'numeric',
            month: 'short',
            hour: 'numeric',
            hour12: true,
          }),
          starts_at: startsAt.toISOString(),
          ends_at: endsAt.toISOString(),
          availability_count: s.availabilityCount,
        };
      }),
    );

    await db.from('plans').update({ status: 'voting' }).eq('id', planId);
    return true;
  }

  // 2. Time poll running -> close it once resolved. Confirmation is step 3, not
  //    part of this step: if the run dies between the two, the next invocation
  //    still finishes the job instead of leaving the plan stuck on a closed poll.
  if (timePoll.status === 'open') {
    if (!(await shouldClose(timePoll, attendeeCount))) return false;
    await closePoll(timePoll.id);
    return true;
  }

  // 3. Time poll closed but the plan isn't decided -> confirm it. The venue is
  //    not voted on: the creator sets one location on the plan.
  {
    let startsAt: string | null = null;
    let endsAt: string | null = null;
    if (timePoll.winning_option_id) {
      const { data: option } = await db
        .from('poll_options')
        .select('starts_at, ends_at')
        .eq('id', timePoll.winning_option_id)
        .single();
      startsAt = option?.starts_at ?? null;
      endsAt = option?.ends_at ?? null;
    }

    const venueLabel = plan.location_name ?? 'a place to be confirmed';

    await db
      .from('plans')
      .update({
        confirmed_start: startsAt,
        confirmed_end: endsAt,
        confirmed_venue: venueLabel,
        status: 'decided',
      })
      .eq('id', planId);

    const when = startsAt
      ? new Date(startsAt).toLocaleString('en-GB', {
          weekday: 'long',
          day: 'numeric',
          month: 'short',
          hour: 'numeric',
          hour12: true,
        })
      : 'the agreed time';

    // user_id null marks it as the AI message; the chat renders those centred.
    await db.from('messages').insert({
      plan_id: planId,
      user_id: null,
      content: await draftConfirmation(plan.title, when, venueLabel),
    });
    return true;
  }

  return false;
}

Deno.serve(async (req) => {
  try {
    const body = await req.json().catch(() => ({}));

    // No plan_id: the cron sweep. Two kinds of plan need picking up —
    // one whose poll has run past its 24h cap, and one left mid-flow by an
    // interrupted run (poll closed, plan not yet decided).
    let planIds: string[];
    if (body.plan_id) {
      planIds = [body.plan_id];
    } else {
      const [overdue, unfinished] = await Promise.all([
        db.from('polls').select('plan_id').eq('status', 'open').lte('deadline', new Date().toISOString()),
        db.from('polls').select('plan_id, plans!inner(status)').eq('status', 'closed').neq('plans.status', 'decided'),
      ]);
      planIds = [
        ...new Set([
          ...(overdue.data?.map((p) => p.plan_id) ?? []),
          ...(unfinished.data?.map((p) => p.plan_id) ?? []),
        ]),
      ];
    }

    for (const planId of planIds) {
      // Each transition can unlock the next (closing the poll enables the
      // confirmation), so keep stepping until the plan settles. Bounded
      // because there are only three transitions in the whole flow.
      for (let i = 0; i < 5 && (await step(planId)); i++);
    }

    return Response.json({ ok: true, advanced: planIds.length });
  } catch (err) {
    console.error(err);
    return Response.json({ ok: false, error: String(err) }, { status: 500 });
  }
});
