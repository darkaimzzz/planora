---
description: Build the next Planora milestone end to end (or the one named in $ARGUMENTS)
---

Read `CLAUDE.md` and `PRD.md`. They are the spec — the locked decisions table is settled,
do not reopen it or ask about it.

Target: **$ARGUMENTS** — if empty, figure out the next unfinished step in CLAUDE.md's
build order by looking at what's actually in the repo, and do that one.

Rules for this run:

1. Do not ask clarifying questions about anything the PRD or CLAUDE.md already answers.
   Anything genuinely undecided: pick the obvious default, build it, and note the choice
   in one line at the end.
2. Build the whole milestone — schema, server, and UI — so it actually runs. Not a stub,
   not a plan.
3. Claude API = prose only. Jev = typed decisions only. AI keys server-side, in Supabase
   Edge Functions, never the client.
4. Laziest thing that works (ponytail). No abstraction until a second caller exists.
   Expo/Supabase built-ins over hand-rolled code.
5. Leave one runnable check behind for non-trivial logic (overlap computation, tie-break,
   poll close). A small `test_*.ts`/assert-based check, no framework setup.
6. Append what you completed to a `## Progress` section at the bottom of CLAUDE.md so the
   next `/goal` knows where it left off.

Finish with: what shipped, how to run it, what's next. Three lines, no essay.
