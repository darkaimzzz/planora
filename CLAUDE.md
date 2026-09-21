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

- **2026-09-20 — Middle path: the creator proposes places, the group votes.**
  Restores the vote the previous change removed, keeping the Maps integration.
  - `0003_venue_proposals.sql`: `poll_options` carries place data
    (name/address/place_id/lat/lng), and `propose_venues(plan_id, jsonb)` is a
    SECURITY DEFINER RPC — the one sanctioned way for a client to create a
    poll. It enforces creator-only, two-or-three options, and refuses to swap
    options once anyone has voted (silently discarding votes would be worse
    than an error).
  - `components/VenueSection.tsx`: search, shortlist up to three, then "Put N
    places to a vote". Adding exactly one sets the location directly and skips
    the vote — so a group that already knows where it's going isn't forced
    through a pointless poll.
  - Edge Function: after the time poll closes it waits for the venue vote; the
    winning option's place data is copied onto the plan, so the confirmed plan
    has a real address and map link. A plan with a single set location and no
    venue poll confirms as before.
  - Roadmap is five stages again. "Venue decided" finishes either by a closed
    venue vote or by a location being set, and names the right blocker — the
    organiser when nothing has been proposed, the group when a vote is running.
  - Verified live: **14 assertions, 0 failures** — all three RPC guards
    (non-creator, one place, four places), option swapping before votes,
    options locked after votes, the plan refusing to confirm while the venue
    vote is open, the voted place becoming the location with its address, and
    the single-location path still confirming.
  - Fixed while testing: the agreed time was only written at final
    confirmation, so between the two votes the UI showed "Time voted ✓" with no
    time anywhere. It is now written the moment the time poll closes.

- **2026-09-20 — Local test server.** `npm run dev` (Metro on 8085),
  `npm run dev:web`, `npm run seed`, `npm run reset`, `npm run check`,
  `npm run deploy:function`.
  - `scripts/env.mjs` reads `.env.local` with no dependency, so the secret key
    is never hardcoded into a committed file.
  - `seed` resets first, then builds two accounts and three plans — one at each
    stage (collecting / time poll open / venue vote open) — using dates
    relative to today so the fixture never goes stale.
  - `reset` only deletes accounts on the `planora.test` domain, so a real
    account can't be caught by it.
  - `deploy:function` replaces the hand-rolled curl; it derives the project ref
    from the Supabase URL and ships `lib/availability.ts` alongside the
    function, keeping one source of truth for the tie-break.
  - Port is pinned to 8085 everywhere. Expo in non-interactive mode gives up
    rather than offering another port, which is what "the server won't start"
    looked like earlier.

- **2026-09-20 — Missing-profile bug, and a proper design system.**
  - **Bug:** `xanderkamixd@gmail.com` signed up four minutes before the schema
    was applied, so the signup trigger didn't exist and no `profiles` row was
    created. `plans.created_by` references `profiles(id)`, so every plan insert
    failed on the foreign key with an opaque error. `0004_backfill_profiles.sql`
    backfills anyone in that state and adds `ensure_profile()`; the auth layer
    now calls it whenever it finds a session with no profile, so no cause of a
    missing row can strand a user again.
  - **Design system.** Three base colours, each with a job, in `lib/theme.ts`:
    indigo (brand, primary actions), grass (progress, anything settled),
    sunbeam (attention, what's waiting on you). Each has a `deep` shade for
    button edges and a `wash` for tinted panels. Nothing else introduces a hue.
  - Apple side: `type` is the HIG scale, cards are inset-grouped with generous
    radii, large titles, all-caps section labels, real safe areas.
  - Duolingo side: `PushButton` is a slab on a darker edge that physically
    drops when pressed — the single thing that makes the app feel tactile, so
    every real action uses it. Plus `ProgressBar`, emoji `EmptyState`s, chunky
    `Chip`s and `Badge`s, and spring entrances.
  - Home leads with three stat tiles (one per colour); the roadmap has a
    progress bar and colour-codes stages green/amber/grey.
  - Verified: `npm run check` clean, and every rebuilt screen was loaded in the
    browser against seeded data.

- **2026-09-20 — Three bugs found by driving the app in Chrome end to end.**
  1. **Availability grid crashed on open.** `onLayout` used `e.target.measure`,
     which is undefined on web. Now a ref plus `measureInWindow`, re-measured
     on layout, on both scroll views' scroll, and at the start of each drag —
     the grid sits inside two scroll views, so a stale origin would paint the
     wrong cells.
  2. **The grid started on the wrong day.** `gridDays` built dates with
     `toISOString()`, so east of Greenwich local midnight is still yesterday in
     UTC: every column was labelled a day early and availability was stored
     against the wrong dates. Built from local parts now, with tests covering
     month and year rollover under two timezones.
  3. **Every Edge Function call from the browser was blocked by CORS.** The
     function sent no CORS headers, so on web the poll never opened. It now
     answers the preflight and sets the headers on every response. Invisible on
     native, fatal on web — which is where the app is being tested.
  - Also fixed while testing: `npm run seed` recreates accounts with new ids, so
    a browser holding the old JWT hits a foreign-key error on insert. Signing
    out and in clears it; `ensure_profile` was verified to return 200 and
    rebuild a genuinely missing profile row.
  - **Whole flow driven through Chrome and verified:** create plan → drag the
    grid (4 hours) → save → time poll opens with exactly those hours → vote →
    closes → propose two places → vote → confirms → AI message posts to chat →
    roadmap reads 5 of 5 → Home shows it under "Locked in" with the right date.

- **2026-09-20 — Tab bar labels were clipped.** Both bars set a fixed height
  with no bottom safe-area inset, so on a device with a home indicator the
  labels sat under it, and the inner content box was too short for a 24px icon
  plus a label even without an inset. Both now use `useSafeAreaInsets()` and
  share `TAB_BAR_HEIGHT` from the app-level layout, with room for the label.
  Measured in the browser rather than eyeballed: labels' bottom edge is 864px
  in an 896px viewport, comfortably inside the bar.

- **2026-09-20 — Driven end to end through the Chrome extension.** Sign in →
  create plan → drag the grid → save → time poll → vote → close all worked.
  Bugs found and fixed:
  1. **A quick drag skipped cells.** Pointer move events are sparse, so
     dragging 6pm→9pm painted 6, 7 and 9 but not 8. The grid now paints the
     rectangle between the drag's anchor and the current cell, recomputed from
     a snapshot taken at grant — so the result depends on where the finger is,
     not on how many events happened to fire. Verified: 4 contiguous hours.
  2. **Any failed load left a screen spinning forever.** `usePlanData` only
     cleared `loading` on the success path, and returned early without
     clearing it when the plan id was missing. It now always clears in a
     `finally`, records the error, and the screens show a retry instead of a
     dead spinner.
  3. **Per-plan screens could lose the plan id.** They read
     `useLocalSearchParams`, which doesn't carry the parent `[id]` segment when
     a nested tab is focused; now `useGlobalSearchParams`.
  4. **Realtime channels collided.** Roadmap, Voting and Details each ran
     `usePlanData`, all subscribing to `plan-<id>`, so one unmounting removed
     the channel another had just created. Each instance now has its own.

  **Known issue, not fixed:** on web, pressing a tab in the per-plan bar
  often doesn't switch screens — nested `Tabs` inside a dynamic Stack route.
  Direct URLs and the app-level tabs work. Worth replacing the inner navigator
  with a segmented control on one screen, which is also closer to Apple's
  pattern for a detail view. Native is likely unaffected but untested.

- **2026-09-20 — Per-plan sections are a segmented control, not nested tabs.**
  The nested `Tabs` inside `plan/[id]` was the cause of the dead tab presses on
  web. It is gone: `plan/[id]/index.tsx` is one screen with an iOS-style
  segmented control (Plan / Vote / Chat / Details), and the four former screens
  are panels in `components/plan/` that take the plan id as a prop — so there is
  no route lookup to lose and only one navigator in play. `availability` stays a
  route of its own and got the back button the old tab layout used to provide.
  - `Tappable` wraps its child in a `Pressable`, which does not inherit a flex
    passed through `style`; the segments are wrapped in a flexed `View` so they
    share the width evenly.
  - **Full flow re-driven through the Chrome extension, all passing:** sign in →
    create plan → rename via Edit title & type → shortlist two places → put them
    to a vote → mark availability by dragging (4 contiguous hours) → save → time
    poll opens with exactly those hours → vote → both polls close with the right
    winners → confirmation posts to Chat → roadmap 5 of 5 → Home shows it under
    "Locked in" with the correct date and venue. Section switching is instant
    with no spinner.

- **2026-09-20 — Invite sharing made actually usable.**
  The invite link existed but was half-built for real sharing:
  - `Share.share()` rejects on desktop web (React Native Web forwards to
    `navigator.share`, which most desktop browsers lack), so the button did
    nothing and the rejection went unhandled. `lib/invite.ts` now offers the
    share sheet only where one exists and falls back to the clipboard, and the
    card leads with an explicit **Copy link** button — the dependable action
    everywhere — with "Copied ✓" feedback.
  - The URL came from `Linking.createURL`, i.e. `planora://join/…` on a device
    and `localhost` in development: useless pasted into a chat. `inviteUrl()`
    uses `EXPO_PUBLIC_APP_URL` when set, and the card says plainly when the
    link is local-only so it can't be mistaken for a sendable one.
  - **Join verified end to end:** a third account with no plans opened an
    invite link, was auto-joined, landed in the plan, and the attendee count
    went 2 → 3.
  - Noted: the Chrome extension tab degraded repeatedly during this session
    (typing and clicks intermittently not reaching React, screenshot timeouts).
    The join check was run with Playwright instead; the main flow earlier was
    driven through the extension.

- **2026-09-21 — Segmented control fixed on device, and dark mode.**
  - **The top bar was empty on a real phone.** The segments used `Tappable`,
    which puts its `style` on an inner animated view, so `flex: 1` never
    reached the pressable. On web the row still gave them width; on native they
    collapsed to nothing. They are plain `Pressable`s with `flex: 1` now, and
    the inner view needs no flex — a View's children stretch to its width by
    default. Same trap caught the earlier bunched-up segments; worth
    remembering that `Tappable`'s style does *not* size the touch target.
  - **Dark mode.** `lib/theme.ts` holds `lightPalette` and `darkPalette` and a
    mutable `brand` that `AppearanceProvider` swaps in place. Chosen over a
    `useBrand()` hook because ~205 call sites across twenty files read
    `brand.x` directly; mutating one object avoided rewriting all of them. The
    rule it depends on — never capture `brand.x` at module scope — meant
    removing every baked colour: the nine `styled()` defaults in `ui.tsx` are
    plain components now, `TONES` became a function, and the two
    `StyleSheet.create` blocks are built per render.
  - Dark is designed, not inverted: surfaces lift as they come forward, the
    three hues brighten to hold up against a dark ground, and the washes are
    dim tints rather than pastels. `Palette.isDark` lets a component pick the
    shade that reads — badges use the bright hue on dark, the deep one on light.
  - Appearance picker in Profile: System / Light / Dark, persisted to
    AsyncStorage, defaulting to the device.
  - **React Navigation memoises screen options**, so the tab bar kept its light
    colours when everything else changed. The tabs layout now reads the
    appearance context and is keyed on the scheme.
  - Verified in the browser: Profile, Home and the tab bar all render dark.

- **2026-09-21 — No web app: a static link handler instead.**
  The Expo web build was only ever a test harness (no simulator on Windows),
  but invite links still need an `https://` home. `landing/` is now a static
  site with no app code:
  - `index.html` — a plain "what Planora is" page.
  - `join.html` — reads the token from the path, fetches the plan title through
    `plan_preview`, offers "Open in Planora" (the `planora://` deep link) and
    store links, and shows a clear expired state for a dead token.
  - `.well-known/apple-app-site-association` and `assetlinks.json` — what makes
    the link open the app rather than the browser. Both carry placeholders:
    Apple Team ID, the domain, and the Android signing fingerprint from
    `eas credentials`.
  - `vercel.json` now deploys `landing/` with no build step at all, rewrites
    `/join/:token`, and forces `application/json` on the association files —
    iOS rejects the AASA otherwise.
  - `app.json` gained `ios.associatedDomains` and an Android intent filter
    (domain placeholder), and lost `expo.web` — the app is native-only.
  - `0005_public_plan_preview.sql` grants `plan_preview` to `anon` so a
    logged-out visitor sees which plan they were invited to. Verified the split
    holds: anon **can** preview, **cannot** join. `join_plan_by_token` now says
    "sign in to join a plan" instead of failing on a NOT NULL violation.
  - Verified locally against the real database: a valid token renders
    "Badminton on Thursday · 2 going" with the right deep link; an invalid one
    renders the expired state. Native bundle still exports.

- **2026-09-21 — Landing page live, Maps key moved server-side.**
  - Deployed to **https://planorafun.vercel.app** from `landing/`,
    no build step. `/join/<token>` renders the real plan title from the live
    database; an unknown token renders the expired state. Both verified in a
    browser against production, not just by status code.
  - `cleanUrls` had to go: it rewrites `/join.html` away, which made the
    rewrite's own destination a 404.
  - `app.json` (`associatedDomains`, Android intent filter), `.env.local`
    (`EXPO_PUBLIC_APP_URL`) and Supabase (`site_url`, allow-list) all point at
    that domain now.
  - **Place search no longer uses an `EXPO_PUBLIC_` key.** A key in the bundle
    can be extracted and Google's web-service APIs can't be restricted per app,
    so it lives as a `GOOGLE_MAPS_API_KEY` secret behind the `places-search`
    Edge Function. Until that secret exists the function answers
    `configured: false` and the UI falls back to a plain text field.
  - **`verify_jwt` does not mean "signed in".** The publishable key satisfies
    it, and that key ships in the app bundle and the landing page. The function
    resolves the caller to a real user itself; verified publishable-key-only
    → 401, user token → 200.
  - Still placeholders: Apple Team ID in the AASA, and the Android SHA-256 in
    `assetlinks.json` — the latter only exists after the first EAS Android
    build, so the order is build → `eas credentials` → paste → redeploy.

- **2026-09-21 — One-tap theme toggle on Home.** The System/Light/Dark control
  in Profile was there but nobody found it, so Home's header now has a
  sun/moon button beside the avatar that flips straight between light and dark
  (Profile keeps the three-way control, including "System"). Verified by
  tapping it in a browser: the icon and the whole screen flip.

- **2026-09-21 — Place search works for free.** Google Maps requires a billing
  card even for its free allowance, so it is no longer the default:
  `places-search` uses **Photon** (OpenStreetMap) when `GOOGLE_MAPS_API_KEY` is
  absent, and Google when it is present. Photon needs no key, no card and no
  account. Nominatim was the other OSM option but its usage policy explicitly
  forbids type-ahead; Photon is built for it.
  - Verified live: "Blue Tokai Bengaluru" and "Starbucks London" both return
    six results with real addresses and coordinates.
  - Photon returns OSM ids, which mean nothing to Google Maps. `mapsUrl` now
    skips `query_place_id` for an `osm:` id and uses the coordinates, with a
    regression test both ways.
  - The search input is debounced (350ms) and ignores a response that arrives
    after the query moved on. It was firing a request per keystroke, which
    wastes any provider's quota and costs real money on Google.
  - Google Sign-In stays free and needs no card — only Maps did.

- **2026-09-22 — Full end-to-end pass, and two deployment bugs found.**
  Google Sign-In is configured and correct: Supabase has the provider enabled,
  and `/auth/v1/authorize?provider=google` redirects to Google's real sign-in
  page with the right client id, callback and `email profile` scope — no
  `redirect_uri_mismatch`, no `access_blocked`. (Completing an actual Google
  login needs the user's own Google account, so that last hop is unverified.)
  - **The invite domain was not stable.** `planora-olive-delta.vercel.app` was
    a transient alias; it started returning `DEPLOYMENT_NOT_FOUND`, which would
    have broken every invite link already sent. The project's real production
    aliases are `planorafun.vercel.app` (now used everywhere),
    `planora-mentary` and `planora-git-main-mentary`.
  - **Vercel Deployment Protection was on** (`ssoProtection:
    all_except_custom_domains`), so every landing URL redirected to a Vercel
    SSO login — an invite link would have shown a login wall to anyone who
    wasn't on the Vercel team. Disabled; verified 200 anonymously.
  - Everything repointed at `planorafun.vercel.app`: `app.json`, `.env.local`,
    Supabase `site_url` and allow-list.
  - **Full flow re-verified:** sign in → create plan → search real places via
    Photon (returned six Blue Tokai branches with Bengaluru addresses) →
    shortlist two → put to a vote → drag availability (4 contiguous hours) →
    save → time poll opens → vote → both polls close → "It's official — Full
    E2E: Tuesday 22 Sept, 7 pm at Blue Tokai" posts to chat → roadmap 5 of 5 →
    Home shows it under Locked in → theme toggle flips the app → the live
    landing page renders that plan by name.
  - Note: the Chrome extension could not be used — Chrome reported its tab as
    `visibilityState: hidden`, which throttles rAF so entrance animations never
    advance and the UI appears blank. Not an app bug (a real foreground tab is
    fine), but it makes the extension unusable for this unless its window is in
    the foreground.

- **2026-09-22 — Account deletion, and a handoff document.**
  - `0006_delete_account.sql`: `delete_own_account()` and
    `account_deletion_impact()`. Deleting the auth user cascades to the
    profile, their plans, attendance, availability and votes. Their **messages
    are deleted explicitly first** — `messages.user_id` is ON DELETE SET NULL
    and a null author is how the app marks the AI confirmation message, so a
    deleted person's chat would otherwise reappear as system announcements.
  - The confirmation names what it destroys for other people, because deleting
    a creator deletes their plans for everyone in them. Two steps, no native
    `Alert` (inconsistent across platforms, unstyleable, untestable).
  - Verified live, **12 assertions**: anonymous callers refused, the auth user
    and profile gone, her plan gone, *someone else's plan survives*, attendance
    and messages gone, and the null-author count in the other plan unchanged —
    proving her messages did not become system messages. UI flow verified too.
  - `HANDOFF.md` written for an external reviewer: architecture, what is
    verified and how, what is explicitly **not** verified (no device build, the
    guessed Jev API, Claude never run with a key), the known weak points, and
    the traps already hit so they aren't re-derived.

- **2026-09-22 — Privacy policy, published.** `landing/privacy.html`, live at
  `https://planorafun.vercel.app/privacy` — the URL both stores ask for.
  - Written from the code, not from a template: the "what we collect" table is
    the actual column list, the provider table names Supabase/AWS (Japan),
    Vercel, Google (only on "Continue with Google"), Photon/OpenStreetMap and
    Anthropic, and the local-storage section lists exactly the three keys the
    app writes (session, appearance, pending invite). No analytics, no cookies,
    no beacons — because there are none.
  - Anthropic is disclosed ahead of the key being set, so enabling
    `ANTHROPIC_API_KEY` doesn't need a policy change.
  - Contact address is `xanderkamixd@gmail.com`; change it in
    `landing/privacy.html` (two `mailto:` links) if a support address appears.
  - `/privacy` rewrite added to `vercel.json`, linked from the landing page and
    the invite page. Verified live: `/privacy`, `/privacy.html`, `/` and
    `/join/<token>` all 200, no login wall.

- **2026-09-22 — Real app icon, every size, from the supplied artwork.**
  Source was a 784x1168 JPEG: a rounded coral tile on a white page with a
  watermark in the corner. Shipping that as-is would have been wrong three
  ways, so it was rebuilt rather than resized.
  - **The rounded corners are gone.** Both platforms mask the icon themselves;
    a pre-rounded source gets rounded twice and shows a corner inside a corner.
    `icon.png` is full-bleed coral to the edge.
  - **The colours are snapped, not resampled.** It is a two-colour design, so
    every pixel is re-derived as a blend of the two exact flats
    (tile `#FE5E4D`, glyph `#042E68`, both measured from the source rather than
    eyeballed) weighted by distance. That kills the JPEG ringing, the white
    page and the watermark in one pass, and keeps clean antialiasing.
  - **`icon.png` has no alpha channel** (PNG colour type 2) — Apple rejects an
    icon with one.
  - Android adaptive layers regenerated properly: `foreground` is the glyph
    alone on transparency at 58% of the canvas so nothing clips inside the 66%
    safe circle, `background` is a solid coral plate, `monochrome` is the same
    art as a pure alpha mask (Android supplies the colour). `adaptiveIcon
    .backgroundColor` was still the Expo default `#E6F4FE` and now matches.
  - `assets/favicon.png` and `landing/favicon.ico` (PNG-in-ICO, 64px) too, so
    the invite and privacy pages stop serving the placeholder mark.
  - Added `expo-splash-screen` and configured it — the launch screen was the
    bare default. `splash-icon.png` is the glyph on the coral background.
  - **`userInterfaceStyle` was still `"light"`**, which pins the OS-level
    appearance regardless of the in-app dark mode. Now `"automatic"`.
  - Generator was a throwaway `System.Drawing` script, not committed: no
    ImageMagick or sharp on this machine and neither is worth a dependency for
    one icon. Re-run means redoing it from the artwork.
  - Verified: `npm run check` clean, `expo config` resolves every path, and
    each output was opened and looked at.

- **2026-09-22 — Hardening pass: ten real defects closed, then a download site.**
  A second reviewer (Codex) found four problems; checking them independently
  confirmed all four, made two of them worse than reported, and turned up two
  more it hadn't headlined. Everything below was reproduced against the live
  project before being fixed, and is now covered by `npm run audit`.

  **Security**
  - **Anyone could create a venue poll on any plan with no login.**
    `propose_venues` guarded with `if v_creator <> auth.uid()`. For an
    anonymous caller `auth.uid()` is NULL, `x <> NULL` is NULL rather than
    TRUE, and the guard never fired. Postgres also grants EXECUTE to PUBLIC by
    default, so naming `authenticated` in a grant kept nobody out. **Any
    authorisation that compares against `auth.uid()` must reject a NULL uid
    first, explicitly** — `0004`–`0006` already did; `0003` was the one that
    didn't.
  - **Any signed-in user could dump every email in the database.**
    `profiles_read` was `using (true)` and `email` is a column. RLS is
    row-level, so the fix is column privileges: `revoke select on profiles`,
    re-grant the safe columns, and match emails inside a `search_people()`
    definer RPC that returns only id/name/colour. Invite-by-email still works;
    no address leaves the database. The app reads your own email from the
    session now, not from the table.
  - **0007's revokes silently did nothing.** Supabase's default privileges
    GRANT EXECUTE to `anon` explicitly, so revoking from PUBLIC leaves that
    grant in place — `has_function_privilege('anon', …)` was still true for
    every function afterwards. `0008` revokes from the named roles *and*
    PUBLIC, and sets `alter default privileges … revoke execute … from anon`
    so the next function added doesn't reopen it.

  **Data integrity**
  - **Concurrent calls created duplicate polls.** Codex saw 2 from 4 requests;
    8 parallel calls across 6 rounds gave 6, 7, 7, 6, **8** and 6 time polls on
    one plan. `step()` reads "is there a poll?" then inserts, and the client
    fires `advance-plan` after every action, so two people saving availability
    at the same moment is enough. Fixed in the only place it can be: a unique
    index on `(plan_id, poll_type)`. The losing racers now get a violation and
    bail out.
  - **An interrupted run confirmed a plan with no time — and announced it.**
    A crash between `closePoll()` and the `confirmed_start` write left the plan
    `decided`, absent from every calendar, with a chat message reading "at *the
    agreed time*". Step 4 now recovers the time from the winning option, and
    refuses to confirm without one.
  - **A crash after the status flip meant the message was never posted.**
    `step()` returned early on `decided`, so no sweep could ever fix it. It now
    checks for the missing confirmation and posts it, idempotently.
  - A plan could be **INSERTed already `decided`** with a fabricated time and
    venue — the freeze trigger was BEFORE UPDATE only.
  - The creator could **rewrite the location after the venue vote closed**,
    against the locked "no vote override, ever".
  - A vote could **reference another poll's option** (independent FKs, nothing
    tying them); now a composite FK makes it unrepresentable.
  - Votes stayed **deletable after the poll closed**; the policy checked only
    ownership. Split into insert/update/delete policies that all require an
    open poll.
  - `topSlots` could **offer a slot in the past** from stale client input.

  **Operations**
  - **The 24h cap had no scheduler at all** — `pg_cron` wasn't installed, so it
    only fired when someone opened the app. Now a 15-minute `cron.schedule`
    sweep via `pg_net` (moved out of `public`).
  - `expo-doctor` was failing: **`react-native-worklets` and `expo-font` were
    missing peers** — Reanimated and every icon in the app — which its own
    output says "may crash outside of Expo Go". Exactly the class of bug a
    browser harness cannot see. Plus `newArchEnabled` is no longer a valid
    config field. 21/21 checks pass now.
  - Advisors: 24 security notices → 10, 18 performance → 8. The remainder are
    the definer RPCs the app is built on (by design) and unused-index notices
    on an empty database. `auth_leaked_password_protection` needs a paid plan
    (HTTP 402), so it stays off.
  - `userInterfaceStyle` was still `"light"`, pinning the OS appearance against
    the app's own dark mode.

  **`npm run audit`** — 42 assertions, all from the attacker's side, covering
  every one of the above plus the full happy path. It is the regression net:
  if a policy loosens, it fails.

- **2026-09-22 — No store: the app is downloaded from its own site.**
  Play Store distribution is dropped. `landing/` is now a real product page
  rather than a link handler.
  - **`npm run build:apk`** (EAS, `apk` profile — a plain installable APK, not
    an `.aab`), then **`npm run release`**, which finds the finished build,
    downloads the artifact to `landing/planora.apk`, computes its SHA-256 and
    size, writes `landing/release.json`, and fills `assetlinks.json` with the
    signing fingerprint read out of the APK's own v1 signature block (no
    keytool on this machine). Then `npx vercel deploy --prod`.
  - The APK is **gitignored** — it is uploaded from disk at deploy time, so a
    ~60 MB binary never enters the repository.
  - The page reads `release.json` at runtime for version/size/date/checksum, so
    shipping a new build is a file swap, not an edit. The download button is a
    plain `<a>` and works with JavaScript off.
  - Sideloading is explained honestly, including the browser warning everyone
    gets on an APK, and the checksum is published so the file can be verified.
  - **The app now checks for updates itself** (`lib/updates.ts`): it compares
    its version against `release.json` and shows a banner on Home. Losing the
    store means losing the only thing that tells anyone a new version exists.
    `isNewer` is a pure function with asserts — 1.10.0 is after 1.9.0.
  - `lib/updates.ts` must not import `expo-constants`: the caller passes its
    own version in. **That rule broke `npm test` again during this change** —
    third time. Pure modules stay pure.
  - Privacy policy gained a section on direct distribution: no store account,
    no install telemetry, and no automatic updates.
  - `join.html` points at the download page instead of dead store links, and
    says something honest on iOS rather than showing a button that does nothing.

- **2026-09-22 — v1.0.0 is downloadable.** `planorafun.vercel.app` serves a real
  APK, verified by downloading it back off the live URL and comparing bytes.
  - **97.0 MB → 56.8 MB (41% smaller).** A universal APK carries native
    libraries for all four ABIs, and two of them — `x86`, `x86_64` — exist only
    for emulators. `gradleCommand: ':app:assembleRelease
    -PreactNativeArchitectures=arm64-v8a,armeabi-v7a'` in the `apk` profile
    drops them; confirmed by listing the `lib/` entries in the shipped zip.
    R8/ProGuard would shave more but can break React Native through reflection,
    and there is no device here to prove otherwise — that waits for a real
    install.
  - **EAS signs v2/v3 only**, so there is no `META-INF/*.RSA` in the APK and
    the fingerprint could not be read out of it. `release.mjs` now asks the
    Expo GraphQL API for the keystore's `sha256CertificateFingerprint` and
    formats it colon-separated, with the APK scan kept as a fallback. Without
    this, `assetlinks.json` stayed a placeholder and Android App Links never
    verified.
  - First build 26 min (7 queued, 19 compiling, 260/260 cache misses); the
    second 11 min with a warm cache.
  - Live checks: `Content-Type: application/vnd.android.package-archive`,
    byte count and SHA-256 both match `release.json`, zip magic intact,
    `assetlinks.json` served as `application/json`.

- **2026-09-22 — The site's spacing was a specificity bug, not taste.**
  `.wrap { padding: 0 24px }` and `section { padding: 66px 0 }` fought over the
  same shorthand, and a class beats an element selector — so **every section's
  vertical padding computed to 0** and the whole page ran together. The two
  rules now own separate axes: `.wrap` sets `padding-inline`, `section` sets
  `padding-block`. Worth remembering whenever a layout looks "cramped for no
  reason": check the computed value before touching the design.
  - Same class of bug: `ol.steps b { display: block }` caught a `<b>` used
    mid-sentence, pushing "Download anyway" onto its own line and orphaning the
    full stop. Scoped to `li > div > b`.
  - `scroll-margin-top` on sections so the nav's anchor links don't park a
    heading under the sticky bar.

- **2026-09-22 — `npm run reset` had never worked on Windows.** The
  direct-invocation guard compared `import.meta.url` against
  `` `file://${process.argv[1].replace(/\/g,'/')}` ``, which on Windows gives
  `file://C:/…` while Node produces `file:///C:/…` — three slashes. The
  comparison never matched, so running the script did nothing and exited 0,
  reporting success. `seed` was unaffected because it imports `reset()`
  directly. Now built with `pathToFileURL(process.argv[1]).href`.
  Confirmed by running it: removed both `@planora.test` accounts and left the
  real account and its three plans alone.
