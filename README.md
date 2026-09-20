# Planora

Turn "we should hang out sometime" into an actual confirmed plan.

Planora is a mobile app for groups of friends. You create a plan, invite people,
everyone marks when they're free — and then **every decision is a vote**. Time,
venue, anything else. No organizer picks for the group, and nobody has override
power. Once the votes land, the app writes the confirmation message itself and
drops the plan onto everyone's calendar.

## Why not Doodle / When2meet / Calendly?

Those tools stop at *"here's the best time."* Then you're back in the group chat
arguing about where to go. Planora carries the group all the way through venue
selection and confirmation — and treats each step as a vote rather than a poll
someone has to interpret.

## How it works

```
Created → Availability collected → Time voted → Venue voted → Confirmed
```

1. **Create a plan** — title + type (dinner / hangout / trip).
2. **Invite** — search existing users, or share a link that deep-links straight
   into the plan. New users sign up and get auto-added to that plan.
3. **Mark availability** — drag-select on a time grid, When2meet style.
4. **Time poll** — the app computes the top 3 overlapping slots and opens a vote.
5. **Venue poll** — AI suggests 2–3 venues based on the plan; the group votes.
6. **Confirmed** — an AI-drafted confirmation message posts to the group chat,
   and the plan appears on every attendee's calendar.

Polls close early once the outcome is clearly decided, with a hard 24-hour cap.
Ties break on availability count first, then earliest slot.

## Stack

| Layer | Choice |
|---|---|
| Client | Expo + React Native + TypeScript |
| Backend | Supabase — Postgres, Auth, Realtime |
| Auth | Email/password **and** Google OAuth |
| Invites | Expo Router deep links |
| Prose AI | Claude API — confirmation messages, venue copy |
| Decision AI | Jev (TypeSafe AI) — typed "has this poll resolved?" checks |

Claude writes anything a human reads. Jev returns typed decisions from structured
state and never generates text. The two roles stay separate.

All AI calls run in Supabase Edge Functions — keys never reach the app bundle.

## Running it

```bash
npm install
cp .env.example .env.local   # fill in your Supabase project values
npx expo start
```

You'll need a Supabase project (`npx supabase link`, then `npx supabase db push`
to apply the schema).

## Project layout

- `PRD.md` — the full product spec
- `CLAUDE.md` — working context: locked decisions, build order, conventions
- `supabase/migrations/` — schema and RLS
- `supabase/functions/` — server-side AI and poll-closing logic

## Status

Early build. The bar for "working" is two real people completing the whole flow
end to end — sign up, invite, vote, confirm, see it on both calendars. Push
notifications, real venue booking, and payment splitting are out of scope.
