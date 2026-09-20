# PlanBot

Group planning app. Friends go from "we should hang out" → confirmed time + venue,
every decision by vote. Full spec: `PRD.md` — read it before building anything.

## Stack (fixed, do not substitute)

- Expo + React Native + TypeScript
- Supabase: Postgres, Auth (email/password **and** Google OAuth), Realtime
- Expo Router + deep links for invites
- Claude API — prose only (confirmation message, venue suggestion text)
- Jev (TypeSafe AI) — typed decisions only (Boolean "has this poll resolved?"). Never prose.

Never blur the Claude/Jev split. Claude writes what a human reads; Jev returns a typed
answer + probability from structured state.

## Locked decisions (settled — don't reopen)

| Question | Decision |
|---|---|
| Auth | Both email/password and Google. Not either/or. |
| Home calendar | Shows **only the current user's own** plans. No cross-user busy times (v2, needs consent). |
| Poll closing | Jev early-close + hard 24h auto-close fallback. Fallback always wins. |
| Tie-break | Most availability marks → then earliest slot. |
| Organizer power | Creator edits title/type only. No vote override, ever. |
| Notifications | None. Realtime + in-app only. |

## Structure

- Bottom tabs: Home (calendar + plans by status) / Plans / Profile
- Per-plan tabs: Roadmap / Voting / Group Chat / Attendees & Details
- Voting tab is the **only** place decisions happen. Chat is text-only (plus the auto-posted
  confirmation message, which is a chat event, not a decision).

## Build order

1. Supabase schema + RLS (PRD §8) → `supabase/migrations/`
2. Auth + first-login profile (display name, avatar color from palette)
3. Plan create + invite link + deep-link join (sign-up → auto-attend that plan)
4. Availability grid (drag-select)
5. Time poll: top-3 overlap → vote → Jev close check on each vote + 24h cap
6. Venue poll: Claude suggestions → same close logic
7. Confirmation: Claude message auto-posts to chat; plan lands on both users' Home calendars
8. Roadmap reflects stage transitions automatically

Ship each step runnable before starting the next.

## Conventions

- Secrets in `.env` (`EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`).
  AI keys stay **server-side** — Claude/Jev calls go through Supabase Edge Functions,
  never from the client.
- Poll close logic runs server-side (Edge Function) so the 24h cap holds with no app open.
- Types generated from Supabase, not hand-written.
- Lazy by default: no abstraction until a second caller exists.

## Done bar

PRD §10. Two real users complete the whole flow end to end. Polish is explicitly deferred.

## Progress

- **2026-09-20 — Milestone 1+2: schema + scaffold + auth.** Done.
  - `supabase/migrations/0001_init.sql` — full PRD §8 schema, RLS scoped to plan
    attendance, `is_attendee()` SECURITY DEFINER helper (avoids policy recursion),
    invite-token RPCs (`plan_preview`, `join_plan_by_token`), signup and
    creator-attendee triggers, a trigger freezing every plan column except
    title/type against client edits, realtime publication.
  - Expo Router app: `_layout` auth gate, `sign-in` (email/password + Google
    OAuth), `onboarding` (display name + colour), tabs Home / Plans / Profile.
  - `lib/plans.ts` is pure (no Supabase import) so `npm test` loads it in node;
    queries live in `lib/planQueries.ts`.
  - Verified: `npm test` passes, `npx tsc --noEmit` clean, `npx expo export` bundles.
  - **Migrations are NOT applied yet** — the project's direct DB host is IPv6-only
    and this network has no IPv6 route; the pooler rejected every region guessed.
    Needs the session-mode pooler string from Dashboard → Connect, or
    `npx supabase login && npx supabase link`.

  Next: plan create + invite link + deep-link join (`app/join/[token].tsx`,
  which the auth gate already leaves alone).

- **2026-09-20 — Milestone 3: plan create, invites, deep-link join, plan shell.** Done.
  - `app/new-plan.tsx` — title + type, lands you in the new plan.
  - `app/join/[token].tsx` — invite landing. Signed in, it joins and redirects
    without a tap; signed out, it parks the token (`lib/pendingInvite.ts`) and
    the root layout redeems it after sign-up, so a cold invite still ends in the
    right plan.
  - `app/plan/[id]/` — per-plan tabs: Roadmap (derived, live), Voting
    (placeholder until polls exist), Chat (Supabase Realtime, AI messages render
    as centred system bubbles), Details (invite link, user search, attendee
    list, creator-only title/type edit).
  - `lib/roadmap.ts` is pure and covered by asserts; `lib/usePlanData.ts` holds
    the per-plan queries plus a realtime subscription that reloads rather than
    patching state in place.
  - Verified: `npm test` passes, `npx tsc --noEmit` clean, `npx expo export` bundles.

  Next: availability grid, then the time poll.

- **2026-09-20 — Milestones 4–7: availability, both polls, confirmation.** Code done,
  unverified against a live DB.
  - `lib/availability.ts` — pure grid/overlap/tie-break logic, covered by asserts:
    cells↔rows round-trip, top-3 overlap, and all three tie-break tiers.
  - `app/plan/[id]/availability.tsx` — drag-select grid (7 days × 08:00–23:00).
    The first cell of a drag decides paint vs erase. Saving replaces your rows
    and nudges the server.
  - `supabase/functions/advance-plan/index.ts` — **the whole vote flow in one
    idempotent entry point**: open time poll → close (Jev + 24h cap) → lock the
    slot → Claude venue suggestions → close → confirm + post the AI message.
    Called by the client after any action, and with no body it sweeps every
    overdue poll for cron. Imports the same pure logic the app uses, so the
    tie-break can't drift between client and server.
  - `app/plan/[id]/voting.tsx` — live poll UI with vote bars, realtime updates,
    and vote-changing via upsert.
  - Verified: `npm test` passes, `npx tsc --noEmit` clean, `npx expo export` bundles.
  - Choices made without asking: one-hour slot granularity (marked `ponytail:`
    in `topSlots`); Jev falls back to "leader unbeatable AND half have voted"
    when `JEV_API_KEY` is absent; Claude calls use `claude-opus-5` and degrade
    to placeholder text without `ANTHROPIC_API_KEY`.

  Next: Home calendar (last build-order item), then a live pass once the DB is
  reachable.
