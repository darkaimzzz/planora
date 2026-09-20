# Planora — Product Requirements Document (MVP)

## 1. Overview

Planora is a mobile app (React Native) that helps groups of friends turn "we should hang out sometime" into an actual confirmed plan, without endless back-and-forth in a group chat. Users create a plan, invite people into it, mark their availability, and every meaningful decision (time, venue, anything else) is resolved by group vote rather than one person deciding. Once decisions are made, the app auto-generates a confirmation message and keeps a running calendar of everyone's plans so people can visually avoid double-booking themselves.

The differentiator versus existing scheduling tools (When2meet, Doodle, Calendly group polls) is that Planora doesn't stop at "here's the best time" — it carries the group all the way through venue selection and confirmation, and it treats every decision point as a vote rather than requiring an organizer to make the call.

## 2. Goals

- Let a group go from "let's plan something" to a confirmed time + venue with minimal manual coordination.
- Make every decision (time, venue, any ad-hoc question) resolve by vote — no single organizer override.
- Give each user a single dashboard where all their plans (across every group) are visible on one calendar, so they can plan around existing commitments.
- Use AI for what it's good at: drafting natural-language messages and venue suggestions (Claude), and fast structured decisions like "has this poll effectively resolved?" (Jev) — keep these two roles cleanly separated.

## 3. Non-Goals (explicitly out of scope for this build)

- No push notifications — in-app and Realtime updates only.
- No real venue booking or reservation API — venue suggestions are AI-generated text only, no live availability/booking.
- No payment splitting or expense tracking.
- No offline support.
- No organizer override of votes — the creator can only edit the plan's title/type; every other decision is vote-governed.
- No cross-platform chat import (WhatsApp/iMessage) — Planora's group chat is its own, self-contained.

## 4. Tech Stack

| Layer | Choice | Notes |
|---|---|---|
| Client | React Native (Expo) + TypeScript | Fastest path to a runnable app on iOS/Android |
| Backend / DB | Supabase (Postgres) | |
| Auth | Supabase Auth — email/password **and** Google OAuth | Offer both at sign-in; don't force one |
| Realtime | Supabase Realtime | Powers group chat and live poll updates |
| Deep linking | Expo deep links / Supabase dynamic links pattern | Invite links open directly into the relevant plan |
| Natural-language AI | Claude API (Anthropic) | Drafts confirmation messages, venue suggestion copy |
| Structured decision AI | Jev (TypeSafe AI), via Vercel AI Gateway or direct API | Typed Choice/Score/Boolean answers for routing/closing logic — no prose generation |

**Division of AI responsibilities (important — do not blur this):**
- **Claude** is used anywhere the app needs to *generate written language a human will read*: the confirmation message posted to group chat, and the venue suggestion text.
- **Jev** is used anywhere the app needs a *fast typed decision, not prose*: e.g. a Boolean check for "has this poll effectively resolved and can it close early?" Jev takes structured state (vote counts, participant count, time elapsed) and returns a typed answer with a probability — it should never be asked to write text.

## 5. Auth Requirements

- Sign-up/sign-in screen offers:
  - Email + password (Supabase Auth native flow)
  - "Continue with Google" (Supabase OAuth provider)
- On first login, prompt for: display name (required), avatar color (pick from a palette — no photo upload in MVP).
- Session persists via Supabase client session storage; no manual token handling needed.

## 6. Information Architecture / Navigation

**App-level bottom tabs:**
1. **Home** — calendar (month/week toggle) overlaying all of the current user's plans (see Section 9 for the overlap-visibility decision), plus a list of plans grouped by status: Voting Open / Scheduled / Past.
2. **Plans** — full list of all plans the user is part of; tapping one opens that plan's own tab set (Section 6a).
3. **Profile** — display name, avatar color, sign out.

**Per-plan tabs (inside a single Plan, separate from the app-level tabs):**
1. **Roadmap** — vertical status tracker: `Created → Availability collected → Time voted → Venue voted → Confirmed`. Shows current stage and what's blocking progress (e.g. "waiting on 2/5 to vote on time").
2. **Voting** — every poll for this plan lives here (time-slot poll, venue poll, any ad-hoc polls). This is the *only* place decisions get made.
3. **Group Chat** — plain conversational thread, Supabase Realtime-backed. No polls or decision UI here — text only, except that the AI-drafted confirmation message auto-posts here once voting resolves (a normal chat event, not a decision itself).
4. **Attendees & Details** — plan title, type, creator, and attendee list with join status. Creator can edit title/type only; nothing else is editable outside the vote flow.

## 7. Core User Flow

1. **Create plan** — any user taps "New Plan," enters a title and a type (dinner / hangout / trip — a simple label used later for venue-suggestion context), and adds attendees either by searching existing Planora users or generating a shareable invite link.
2. **Join via invite link** — the link deep-links directly into the app. If the recipient isn't signed up yet, it routes them through sign-up first, then auto-tags them as an attendee of that specific plan once authenticated.
3. **Availability round** — each attendee opens the plan and marks their availability on a time-slot grid (drag-select across days/times, similar to When2meet).
4. **Time poll** — once availability is collected, the app computes the top 3 overlapping slots and posts them as a poll in the Voting tab. Attendees vote for their preferred slot.
   - **Poll resolution logic:** periodically (e.g. every time a new vote comes in), call Jev with a Boolean question — "has this poll effectively resolved given current votes, participant count, and time elapsed?" — to allow early closing once a clear winner emerges, rather than always waiting for 100% turnout.
   - **Hard fallback:** regardless of Jev's answer, the poll auto-closes after 24 hours.
   - **Tie-break rule:** if votes are tied, the slot with the most total "available" marks from the earlier availability step wins; if still tied, the earliest slot wins.
5. **Venue poll** — once the time poll closes, Claude generates 2-3 venue suggestions (text) based on the plan's title and type. These become the venue poll in the Voting tab, using the same Jev-based early-close logic and the same tie-break rule.
6. **Confirmation** — once both polls close, Claude drafts a short confirmation message (e.g. "It's official — Sat 7pm at [venue]! See you there 🎉"), which auto-posts to the Group Chat tab. A "add to calendar" action writes the confirmed plan into the user's Home dashboard calendar.
7. **Roadmap updates** throughout — each stage transition updates the plan's Roadmap tab automatically.

## 8. Data Model

```
User
  id
  email
  display_name
  avatar_color
  auth_provider        -- 'password' | 'google'
  created_at

Plan
  id
  title
  type                 -- 'dinner' | 'hangout' | 'trip' | ...
  created_by            -- User.id
  status                -- 'collecting' | 'voting' | 'decided'
  created_at

PlanAttendee
  id
  plan_id
  user_id
  joined_at

Availability
  id
  plan_id
  user_id
  day
  start_time
  end_time

Poll
  id
  plan_id
  poll_type            -- 'time' | 'venue' | 'adhoc'
  status                -- 'open' | 'closed'
  created_at
  closed_at

PollOption
  id
  poll_id
  label
  proposed_by           -- User.id

Vote
  id
  poll_id
  option_id
  user_id

Message
  id
  plan_id
  user_id               -- nullable for system/AI-generated messages
  content
  created_at
```

## 9. Decisions on Previously Open Questions

- **Auth:** both email/password and Google OAuth are offered — user's choice, not either/or.
- **Home calendar overlap visibility:** *(decide before/while building — recommended default if not otherwise specified: show only the current user's own confirmed and pending plans on their Home calendar, not other attendees' busy times, to avoid a privacy/scope creep issue. If cross-user busy-time visibility is wanted later, it should be scoped as a v2 feature with explicit consent from each user about what's shared.)*
- **Poll closing:** hybrid of Jev-based early resolution + 24-hour hard cap, not a fixed timer alone.
- **Tie-breaks:** availability-count wins first, earliest slot wins second.
- **Organizer power:** limited strictly to editing title/type; every other decision is vote-governed, with no override.

## 10. Definition of "75% Working" (MVP Acceptance Bar)

Two real users should be able to:
1. Sign up (via password or Google) and log in.
2. Have one user create a plan and invite the other via a deep link that lands them directly in the app, auto-tagged as an attendee.
3. Both mark availability on the time-slot grid.
4. See a time poll automatically appear in the Voting tab and resolve (either via Jev's early-close logic or the 24-hour fallback).
5. See a venue poll follow the same pattern after the time poll resolves.
6. See a Claude-drafted confirmation message auto-post to the Group Chat tab once both polls close.
7. See the confirmed plan correctly reflected on both users' Home dashboard calendars.

Push notifications, real venue booking, payment splitting, and UI polish are explicitly deferred beyond this bar.
