# Build report: Redline v1

Written by the implementation run that started on 2026-09-12. The owner was not
present, so every question that would normally have been asked was decided here
and recorded below with its reason.

This file is the handover. Read "Start here when you sit down" first.

## Start here when you sit down

Commands are listed at the end of this file, under "The exact commands to run
first". Nothing above that section is urgent.

## Ticket status

| Ticket | Title | Status |
| --- | --- | --- |
| 01 | Walking skeleton | done |
| 02 | Extraction seam and completeness | done |
| 03 | PDF text layer and typed refusal | not started |
| 04 | Analysis seam, verified flags | done |
| 05 | Plain-English summary | done, with two criteria partly met and recorded |
| 06 | Ranking by leverage lost | done |
| 07 | Clean document verdict | done |
| 08 | Flag consequence, exit, neutrality | not started |
| 09 | Question box, grounded or refused | not started |
| 10 | Real OpenRouter client | not started |
| 11 | Sign in and the library | not started |
| 12 | Red lines promote and mark | not started |
| 13 | Tier-two eval suite | not started |
| 14 | Landing page | not started |

## Decisions made in the owner's absence

Each of these would normally have been a question. The owner's run instruction
was to decide, record the reason, and keep going.

### The two answers the owner supplied

These came with the run instruction rather than being decided here, and they are
repeated because every subagent brief carried them and the code depends on them.

**The model.** Read from `OPENROUTER_MODEL`, called through OpenRouter's
OpenAI-compatible endpoint with `OPENROUTER_API_KEY`. The provider is pinned:
`order: ["fireworks"]`, `allow_fallbacks: false`, `require_parameters: true`.
Reasoning effort low. Structured JSON output on every analysis and answer call. No
model id appears in source.

**Supabase.** No project exists. Auth, the library and red lines are built against
`@supabase/supabase-js`, reading `NEXT_PUBLIC_SUPABASE_URL` and
`NEXT_PUBLIC_SUPABASE_ANON_KEY`. Every table and policy is a migration file under
`supabase/migrations/` for the owner to run by hand. The app starts and analyses a
pasted document with both variables absent.

### Decided here

**Dependencies.** `CLAUDE.md` requires asking before adding one. The approved list
was fixed up front and no agent was allowed to extend it: `next`, `react`,
`react-dom`, `typescript`, `@types/*`, `vitest`, `pdfjs-dist`, `zod`,
`@supabase/supabase-js`, `@supabase/ssr`. Reasons, one line each.

- `vitest`: the deterministic suite needs a runner that takes TypeScript and ESM
  without a build step. Ticket 01 has to wire one, and there is no prior art in the
  repo to follow.
- `pdfjs-dist`: ticket 03 needs a browser PDF parser that preserves exact
  characters, because citation verification compares model spans against the
  extracted text. Mozilla's PDF.js is the parser Chrome's own viewer is built on,
  it runs in the browser, and it exposes per-item text with no normalisation. The
  alternative was writing a PDF text-layer reader by hand, which would be worse at
  exactly the thing that matters.
- `zod`: the model returns JSON that has to be validated before a single field is
  trusted. Hand-rolled validators over seven clause types and nested consequence
  and exit fields would be more code and less certain.
- `@supabase/supabase-js` and `@supabase/ssr`: the stack is settled in `CLAUDE.md`
  and these are the client libraries for it.

No CSS framework, no component library, no icon font. `DESIGN.md` is recorded from
handwritten CSS and the tokens come from `landing/styles.css`.

**The repository root is the Next.js app root.** No nested app directory. The
landing page's static files stay at `landing/` untouched, because `DESIGN.md` is
recorded from them and cites their paths, and they are the design source of record.
They are no longer served.

**Route order during the build.** Ticket 01 wants the paste box at the root and
ticket 14 later takes the root for the landing page. So the ported landing page
lives at `/landing` until ticket 14, which moves it to `/` and moves the paste box
to its own route. Neither ticket had to be rewritten to accommodate the other.

**Working directly on `main`.** The repository has no branch but `main` and every
prior commit is on it. A long unattended run on a feature branch would leave the
owner with a merge to do before they could run anything.

**Committing per ticket.** One commit per ticket, written to say why rather than
what, after the typecheck, that ticket's tests and the full suite have passed here.
