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
