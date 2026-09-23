# Planora: agent instructions

**Read [`CLAUDE.md`](./CLAUDE.md).** It is the spec, the locked decisions and
the running build log, and it is the only copy.

This file exists because some tools look for `AGENTS.md` by name. It
deliberately holds no content of its own: an earlier copy here was a
find-and-replaced duplicate of `CLAUDE.md` that had renamed the Anthropic API
to something else, which is wrong, `supabase/functions/advance-plan` really
does call Claude, and the Claude/Jev split in `CLAUDE.md` is a hard rule.

Two documents that disagree are worse than one that is occasionally out of
date.

Also worth reading before changing anything:

- [`HANDOFF.md`](./HANDOFF.md): architecture, what is and isn't verified, and
  the traps that have already cost time.
- [`PRD.md`](./PRD.md): the original spec.

Before you push: `npm run check` (typecheck + pure-logic asserts) and
`npm run audit` (42 live assertions against the real project, from the
attacker's side).
