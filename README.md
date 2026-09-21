# Planora

Turn "we should hang out sometime" into an actual confirmed plan.

Planora is a mobile app for groups of friends. You create a plan, invite people,
everyone marks when they're free — and then the group votes. The time is decided
by vote, and so is the place: the organiser shortlists two or three spots and
everyone picks. Once the votes land, the app writes the confirmation message
itself and drops the plan onto everyone's calendar.

## Why not Doodle / When2meet / Calendly?

Those tools stop at *"here's the best time."* Then you're back in the group chat
arguing about where to go. Planora carries the group all the way through venue
selection and confirmation — and treats each step as a vote rather than a poll
someone has to interpret.

## How it works

```
Created → Availability collected → Time voted → Venue decided → Confirmed
```

1. **Create a plan** — title + type (dinner / hangout / trip).
2. **Invite** — search existing users, or share a link that deep-links straight
   into the plan. New users sign up and get auto-added to that plan.
3. **Mark availability** — drag-select on a time grid, When2meet style.
4. **Time poll** — the app computes the top 3 overlapping slots and opens a vote.
5. **Venue** — the organiser shortlists two or three real places and the group
   votes. Shortlist just one and it's set directly, with no pointless poll.
6. **Confirmed** — an AI-drafted confirmation message posts to the group chat,
   and the plan appears on every attendee's calendar.

Polls close early once the outcome is clearly decided, with a hard 24-hour cap.
Ties break on availability count first, then earliest slot.

## Stack

| Layer | Choice |
|---|---|
| Client | Expo + React Native + TypeScript |
| UI | Tamagui + Moti |
| Backend | Supabase — Postgres, Auth, Realtime, Edge Functions |
| Auth | Email/password **and** Google OAuth |
| Invites | Expo Router deep links |
| Places | Google Places (optional — free text without a key) |
| Prose AI | Claude API — the confirmation message |
| Decision AI | Jev (TypeSafe AI) — typed "has this poll resolved?" checks |

Claude writes anything a human reads. Jev returns typed decisions from structured
state and never generates text. The two roles stay separate.

All AI calls run in Supabase Edge Functions — keys never reach the app bundle.

## Running it locally

```bash
npm install
cp .env.example .env.local   # fill in your Supabase project values
npm run seed                 # two test accounts, three plans, one per stage
npm run dev                  # Metro on http://localhost:8085
```

Then scan the QR code with Expo Go, press `a` / `i` for an emulator, or run
`npm run dev:web` to open it in a browser.

Sign in with either seeded account — both use `Password123!`:

| Account | Who |
|---|---|
| `demo@planora.test` | the organiser |
| `sam@planora.test` | the friend |

Open the two in separate browser profiles to be both people at once and watch
votes and chat update live.

### Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Metro on port 8085 |
| `npm run dev:web` | the same in a browser — a test harness, not a product |
| `npm run dev:clear` | same, clearing the bundler cache first |
| `npm run seed` | resets, then creates the test accounts and plans |
| `npm run reset` | deletes every `@planora.test` account and its data |
| `npm run check` | typecheck and run the assertions |
| `npm test` | assertions only |
| `npm run deploy:function` | pushes the Edge Function to Supabase |

`seed` and `reset` only ever touch accounts on the `planora.test` domain, so a
real account is never caught up in them.

### Environment

`.env.local` holds everything. Only `EXPO_PUBLIC_*` values reach the app bundle;
the rest stay on your machine and in Supabase.

| Variable | Needed for |
|---|---|
| `EXPO_PUBLIC_SUPABASE_URL` | everything |
| `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | everything |
| `SUPABASE_SECRET_KEY` | `seed` / `reset` only |
| `SUPABASE_ACCESS_TOKEN` | `deploy:function` only |
| `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` | optional — turns on place search |
| `ANTHROPIC_API_KEY` | set as an Edge Function secret, not here |

### The landing page

Planora is a native app; there is no web version. But an invite link has to be
an  URL a friend can tap, so  is a static page — no build
step, no app code — that shows which plan you were invited to and hands off to
the app. It also serves the Apple and Android association files that let the
link open the app directly instead of the browser.

Deployed to Vercel from  (see ). Fill in the store URLs
in  once the app is live, and replace the placeholders in
 and  with your Apple Team ID, domain and Android
signing fingerprint.

### Database

The schema lives in `supabase/migrations/`. With the CLI linked,
`npx supabase db push` applies it; otherwise run the files in order from the
dashboard's SQL editor.

## Project layout

- `PRD.md` — the full product spec
- `CLAUDE.md` — working context: locked decisions, build order, conventions
- `app/` — screens (Expo Router)
- `components/` — the shared UI kit
- `lib/` — pure logic (overlap, tie-breaks, roadmap, calendar) and queries
- `supabase/migrations/` — schema and RLS
- `supabase/functions/` — the poll-closing and confirmation logic
- `tests/run.ts` — assertions over the pure logic, run with `npm test`

## Status

Early build, but the whole flow works end to end against a real project: sign
up, invite by link, mark availability, vote on time, vote on the place, and see
the confirmation land in chat and on both calendars. Push notifications, real
venue booking, and payment splitting are out of scope.
