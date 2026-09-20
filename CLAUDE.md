# Planora

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

- **2026-09-20 — Milestone 8: Home calendar.** Done. Build order complete.
  - `lib/calendar.ts` — pure month/week grid. Month is always six rows so the
    layout never jumps; dates are built from local components, because
    `toISOString()` slides a late-evening plan into the next day.
  - `app/(tabs)/index.tsx` — month/week toggle, prev/next navigation, confirmed
    plans marked and tappable. Own plans only, per the locked decision; an
    unconfirmed plan appears in the status lists but on no calendar day.
  - Verified: `npm test` passes, `npx tsc --noEmit` clean, `npx expo export` bundles.
  - No new dependency: a month grid is ~40 lines of pure code, cheaper than
    pulling in a calendar library.

  **All eight build-order items are written. None has ever run against the
  database.** Next session's first job is the live pass, not new features.

- **2026-09-20 — Live pass. The whole flow works against the real project.**
  - Migration applied to `tnjgqoznxgeymipbxqqs`: 8 tables, RLS on all of them,
    15 policies, 6 functions.
  - `advance-plan` deployed and ACTIVE.
  - **34 live assertions passed, 0 failed**, driven as two real signed-in users:
    signup trigger, invite join (and re-join idempotency), preview before
    joining, availability, voting, vote-changing, the full
    time-poll → venue-poll → confirmation chain, and the AI message landing in
    chat. Every RLS boundary was probed from the wrong side and held: a
    non-attendee can't read the plan, vote, post, or write availability as
    someone else; the creator can't force `status`; no client can create a poll.
    A deliberate 1–1 tie resolved by availability count, as the PRD requires.
  - Bugs found and fixed by running it:
    - `react-native-web` missing — web wouldn't boot at all.
    - 8 dependency versions behind the SDK (`expo install --fix`).
    - The SDK's zod helper has no resolvable subpath in the edge runtime and
      crashed the function on boot; venue suggestions now parse one-per-line.
    - A custom `SUPABASE_*` secret can't be set (reserved prefix); the function
      uses the auto-injected `SUPABASE_SERVICE_ROLE_KEY`.
    - Slot labels read "19" instead of "7 pm" (missing `hour12`).
  - Test data was deleted afterwards; the database is empty.

  **Deploying the function** (the CLI isn't linked; this needs only the PAT):
  ```
  curl -X POST "https://api.supabase.com/v1/projects/<ref>/functions/deploy?slug=advance-plan" \
    -H "Authorization: Bearer <sbp_ token>" \
    -F 'metadata={"entrypoint_path":"supabase/functions/advance-plan/index.ts","name":"advance-plan","verify_jwt":false};type=application/json' \
    -F "file=@supabase/functions/advance-plan/index.ts;filename=supabase/functions/advance-plan/index.ts" \
    -F "file=@lib/availability.ts;filename=lib/availability.ts"
  ```

  Remaining, all needing the user: `ANTHROPIC_API_KEY` as a function secret
  (venue text and the confirmation are placeholders without it), Google OAuth
  provider config, a cron schedule calling `advance-plan` with no body for the
  24h cap, and a two-phone test of the invite deep link.

- **2026-09-20 — Rebrand to Planora, Tamagui UI, creator-set location.**
  - Renamed throughout: app name, slug, deep-link scheme (`planora://`), bundle
    IDs, storage keys, docs. GitHub repo is still `plan`.
  - **Scope change made by the user, overriding the PRD:** the venue is no
    longer voted on. The creator sets one location on the plan (Google Places
    when `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` is set, free text + maps link
    otherwise). Only the time is still a vote. This drops the "every decision
    by vote" differentiator from PRD §1 — recorded here so it isn't mistaken
    for drift. `0002_location.sql` adds the location columns and lets the
    freeze trigger allow them; the venue poll is gone from the flow and from
    the roadmap, which is now four stages.
  - UI rebuilt on **Tamagui** + Moti + expo-linear-gradient, with a shared kit
    in `components/ui.tsx` (Screen/Card/GradientButton/Chip/Avatar/FadeIn).
    Brand palette in `lib/theme.ts` from the logo: indigo `#4f52d1`, navy
    `#1b2a5e`, warm off-white `#fbfaf8`.
  - Tamagui config relaxes two v4 defaults (`onlyAllowShorthands: false`,
    `allowedStyleValues: 'somewhat-strict'`) so React Native longhand props
    keep working; brand hex values are cast to `ColorTokens` once in
    `lib/theme.ts` rather than at every call site.
  - Bugs found by running it, all fixed:
    - **Confirmation could strand a plan forever.** It ran inside the
      close-the-poll branch, so an interrupted run left a closed poll on a
      non-decided plan with nothing to finish it. Confirmation is now its own
      step and the cron sweep looks for that state too — verified by rescuing a
      genuinely stuck plan with a no-body sweep.
    - **Slots drifted a day east of Greenwich.** Availability hours are
      wall-clock, but were read back in device-local time, so a 7 pm slot
      showed as 12:30 am the next day in IST and landed on the wrong calendar
      square. `formatSlot`/`slotDay` in `lib/plans.ts` read them in UTC;
      regression tests pass under `TZ=Asia/Kolkata` and `TZ=America/Los_Angeles`.
    - `babel-preset-expo` had to become a direct dependency once a
      `babel.config.js` existed.
  - Verified: `npm test` passes (two timezones), `npx tsc --noEmit` clean,
    `npx expo export` bundles, and the flow was re-run end to end against the
    real project through the new UI.

  Still needs the user: `ANTHROPIC_API_KEY` as a function secret, the cron
  schedule, Google Maps key (optional), Google OAuth, two-phone deep-link test.
