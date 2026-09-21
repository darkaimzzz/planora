# Planora — handoff for review

Written for a reviewer coming to this cold, with no history of how it was
built. Read this, then `CLAUDE.md` (the running build log, newest entries at
the bottom) and `PRD.md` (the original spec).

---

## What it is

A React Native (Expo) app where a group of friends turns "we should hang out"
into a confirmed plan. Create a plan → invite by link → everyone drags their
availability on a week grid → the app computes the top three overlapping
slots and opens a vote → the organiser shortlists two or three real places and
the group votes on those → the plan confirms itself and posts a message to the
group chat.

Backend is Supabase: Postgres with RLS, Auth, Realtime, and two Edge
Functions. There is no custom server.

## Architecture in one pass

| Layer | Where | Notes |
|---|---|---|
| Screens | `app/` | Expo Router. `app/(tabs)` = Home/Plans/Profile; `app/plan/[id]` = one plan |
| Plan sections | `components/plan/*Panel.tsx` | Roadmap / Voting / Chat / Details — **not** routes, see below |
| UI kit | `components/ui.tsx` | Every shared primitive. `PushButton` is the signature control |
| Pure logic | `lib/plans.ts`, `availability.ts`, `roadmap.ts`, `calendar.ts` | **No Supabase imports** — `tests/run.ts` loads these directly in node |
| Queries | `lib/planQueries.ts`, `usePlanData.ts` | Everything that touches the network |
| Schema | `supabase/migrations/*.sql` | Applied in order. 0001 is the bulk |
| Server logic | `supabase/functions/` | `advance-plan` (the state machine), `places-search` (proxy) |
| Landing page | `landing/` | Static invite handler. Not the app — see below |

### The one non-obvious rule

**`lib/plans.ts` and friends must never import `lib/supabase.ts`.** The test
runner loads them under plain node; a Supabase import drags React Native in and
`npm test` dies with an esbuild error about `typeof`. This has broken twice.
If you add a helper that needs the network, it goes in `planQueries.ts`.

### The state machine

`supabase/functions/advance-plan/index.ts` is the only thing that moves a plan
forward. It is **idempotent and re-entrant**: every caller just says "this plan
may have moved" and the function decides what, if anything, is next. It is
called after any user action, and by cron with no body to sweep overdue polls.

Transitions: open the time poll once everyone has marked availability → close
it (early via Jev, or the hard 24h cap) → wait for the venue vote if one
exists → confirm and post the message. Each step is separate on purpose, so an
interrupted run resumes rather than stranding a plan. That bug happened; see
CLAUDE.md, 2026-09-20.

## Running it

```bash
npm install
npm run seed     # two accounts, three plans, one per stage
npm run dev      # Metro on 8085
npm run check    # typecheck + assertions
```

Seeded accounts: `demo@planora.test` / `sam@planora.test`, both
`Password123!`. `seed` and `reset` only ever touch `@planora.test` accounts.

`npm run dev:web` exists **only as a test harness** — there is no web product.
It was the only way to click through the app from a Windows machine with no
simulator.

## What is verified, and how

Everything below was run against the live Supabase project, not mocked:

- **34 assertions** on schema and RLS, probing every boundary from the wrong
  side: a non-attendee can't read a plan, vote, post, or write availability as
  someone else; the creator can't force `status`; no client can create a poll.
- **14 assertions** on the venue proposal RPC and its guards.
- **12 assertions** on account deletion.
- The **full flow end to end in a browser**, repeatedly: create → search real
  places → shortlist → vote → drag availability → save → time poll → vote →
  confirm → chat message → calendar.
- `tests/run.ts` covers the pure logic and runs under two timezones.

## What is NOT verified — start here

1. **Nothing has run on a real device.** No iOS or Android build exists. The
   invite deep link between two phones — the PRD's own acceptance bar — has
   never been tested.
2. **Google Sign-In**'s final hop. Configuration is verified (Google serves its
   real consent page, correct client id and callback, no `redirect_uri_mismatch`),
   but nobody has completed an actual Google login.
3. **The Jev integration is written against a guessed API.** No public docs
   were found, so `pollHasResolved` in `advance-plan` posts to a plausible
   endpoint and falls back to a deterministic rule on any error. **Treat the
   request/response shape as unverified.** The fallback means polls still
   close correctly without it.
4. **Claude's confirmation message** has only ever run in its no-key fallback
   (templated text). `ANTHROPIC_API_KEY` has never been set.
5. **Push notifications do not exist.** Deliberate (PRD non-goal), but it means
   nobody learns a poll opened, which is the biggest gap between "works" and
   "people use it".

## Known weak points worth your attention

- **`advance-plan` is a public endpoint** (`verify_jwt: false`, because cron
  calls it without a session). It's idempotent and can't corrupt a plan, but
  anyone who knows a plan UUID can hammer it. A shared secret for the cron path
  would close this.
- **`verify_jwt` does not mean "signed in."** The publishable key satisfies it,
  and that key ships in the app bundle and the landing page. `places-search`
  resolves the caller to a real user itself; anything new must do the same.
- **The palette is a mutable module object** (`lib/theme.ts`). ~200 call sites
  read `brand.x` directly and `AppearanceProvider` swaps its contents for dark
  mode. This works only because nothing captures a colour at module load —
  **no `StyleSheet.create` colours, no `styled()` colour defaults.** Adding one
  will silently break dark mode on that component.
- **Slot granularity is one hour, unmerged.** A group free all evening is
  offered three adjacent hours rather than one block. Marked `ponytail:` in
  `topSlots`.
- **No rate limiting anywhere**, no error monitoring, no backups (Supabase free
  tier, which also pauses after ~7 days idle).
- **Availability is fixed** to the next 7 days, 08:00–23:00.

## Traps already hit — don't re-derive these

Each of these cost real time and is easy to reintroduce:

- `Tappable` puts its `style` on an inner animated view, **not** the pressable.
  `flex: 1` passed to it does nothing, and the touch target collapses on native
  while looking fine on web.
- Timezones: availability is **wall-clock**. `formatSlot`/`slotDay` read slots
  in UTC deliberately. Using local time slid a 7pm slot to 12:30am the next day
  in IST, and `toISOString()` in `gridDays` made the grid start a day early.
- Edge Functions send **no CORS headers** by default. Invisible on native,
  fatal on web.
- A `SUPABASE_*` prefixed secret cannot be set — the prefix is reserved.
- Nested `Tabs` inside a dynamic route breaks navigation on web. That's why the
  plan screen is one screen with a segmented control.
- Entrance animations mean content is invisible until they run. In a hidden
  browser tab rAF is throttled and the UI appears blank — that's the harness,
  not a bug, but it makes the Chrome extension unusable unless its window is
  in the foreground.

## Deploy / operate

```bash
npm run deploy:function              # both Edge Functions
npm run deploy:function places-search
```

Migrations: `npx supabase db push` if the CLI is linked, otherwise paste each
file in order into the dashboard SQL editor. The CLI is **not** linked here —
the project's direct DB host is IPv6-only and this machine has no IPv6 route,
so everything was done through the Management API.

Landing page: `npx vercel deploy --prod` (config in `vercel.json`, serves
`landing/` with no build step).

## Secrets

Nothing sensitive is committed; `.env.local` is gitignored. Keys pasted into
the build conversation **should be treated as compromised and rotated**: the
Supabase secret key, and the first personal access token.

`GOOGLE_MAPS_API_KEY` and `ANTHROPIC_API_KEY` are **Edge Function secrets**,
never app variables — an `EXPO_PUBLIC_` key ships inside the bundle where it
can be extracted, and Google's web-service APIs can't be restricted per app.

## Before release

Blocking both stores: an app icon (still the Expo default), a privacy policy
URL, screenshots. iOS additionally needs **Sign in with Apple** (guideline 4.8,
triggered by offering Google login) — not built. Play needs $25, identity
verification, and for a personal account **12 testers × 14 days** of closed
testing before production access.

Placeholders still to fill: Apple Team ID in
`landing/.well-known/apple-app-site-association`, and the Android SHA-256 in
`assetlinks.json` — the latter only exists after the first EAS Android build.

## Where the real risk is

If you have limited review time, spend it here, in order:

1. **RLS.** It is the only thing between users' data and each other. The tests
   probe it, but a fresh adversarial pass is worth more than anything else.
2. **`advance-plan`'s re-entrancy.** It is called concurrently from several
   clients and from cron. Two clients voting at once, or a cron sweep landing
   mid-vote, is the scenario most likely to hide a bug.
3. **The mutable-palette trick** in `lib/theme.ts` — unusual, and it fails
   silently and partially rather than loudly.
