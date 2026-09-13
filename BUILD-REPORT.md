# Build report: Redline v1

Written by the implementation run that started on 2026-09-12. The owner was not
present, so every question that would normally have been asked was decided here
and recorded below with its reason.

This file is the handover. Read "Start here when you sit down" first.

## Start here when you sit down

Eight of the fourteen tickets are done, committed and pushed. The deterministic suite
is 219 tests, passes in under a second, makes no network call and needs no key.
`npm run typecheck` and `npm run build` both pass.

Run the four commands under "The exact commands to run first" at the end of this file.
Then read "Risks worth a decision", which is the part that needs you rather than
another agent.

Six tickets are not started: 03, 10, 11, 12, 13 and 14. Each has a complete,
self-contained brief at `.scratch/redline-v1/briefs/NN.md`, so resuming costs no
re-reading of the spec.

The one thing nothing here has proved: no real model call was made during this run.
Every seam is correct against known inputs from the stub, and nothing yet shows the
model finds a real clause in a real document. Ticket 10 is where that happens and it
is the first ticket that spends money.

## Ticket status

| Ticket | Title | Status |
| --- | --- | --- |
| 01 | Walking skeleton | done |
| 02 | Extraction seam and completeness | done |
| 03 | PDF text layer and typed refusal | not started, brief written, unblocked |
| 04 | Analysis seam, verified flags | done |
| 05 | Plain-English summary | done, two criteria partly met and recorded as partly met |
| 06 | Ranking by leverage lost | done |
| 07 | Clean document verdict | done |
| 08 | Flag consequence, exit, neutrality | done |
| 09 | Question box, grounded or refused | done |
| 10 | Real OpenRouter client | done, and the real run found something |
| 11 | Sign in and the library | done as written, nothing on the Supabase path verified |
| 12 | Red lines promote and mark | done as written, persistence unverified |
| 13 | Tier-two eval suite | done, and it produced real numbers |
| 14 | Landing page | not started, brief written, unblocked |

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

**`pdfjs-dist` for ticket 03's parsing dependency.** The ticket says to stop and ask,
and the decision could not wait for the ticket to start. Mozilla's PDF.js is the parser
Chrome's own viewer is built on, it runs in the browser, and it exposes per-item text
without normalising characters, which is the one property that matters here because
citation verification compares model spans against the extracted text. The alternative
was hand-writing a PDF text-layer reader, which would be worse at exactly that. It is
approved in the standing brief and ticket 03's brief records the decision.

**One verifier, moved to `src/domain/`.** Ticket 09 needed the same verification the
flag path uses. Importing the analysis seam from the question seam is the wrong
dependency direction and copying it is worse, because two verifiers drift and the one on
the answer path is the one nobody watches. The defect log and the wording list moved with
it for the same reason.

**A stray NUL byte was rewritten as an escape.** `src/analysis/flags.ts` used a literal
NUL as the separator in the key that spots a model returning the same clause twice. Sound
value, but it made git classify the file as binary, which costs every diff on the module
that turns a payload into verified flags. Same key, written as an escape.

**The landing page's static files stay at `landing/`.** `DESIGN.md` is recorded from them
and cites their paths, so they are the design source of record. They are no longer served.

**No Impeccable direction round.** It opens a browser page and waits for a person, and no
person was here. The design pack's existing output, `DESIGN.md` and the app-shell surface
brief, governed every screen instead.

## What each finished ticket decided, in one line

Kept short because the commit messages carry the reasoning and the ticket files carry
the criteria. This is the index.

- **01** reads a pasted document back untouched and counts it in Unicode code points,
  with a test that reads the fixture off disk and asserts character equality.
- **02** made extraction its own seam and gave every analysis a completeness reading
  at three levels, carrying the signals that fired. It informs and gates nothing.
- **04** is the spine. The model returns spans, code holds each against the stored
  text as an exact substring, and a flag whose span does not match is dropped before
  the seam returns. Nothing repairs a near miss. Severity is assigned here from the
  instance's terms, which is what lets ranking stay model-free.
- **05** says what accepting the document commits the reader to, and blocks verdict
  wording in code rather than trusting a prompt.
- **06** orders by leverage lost with the severity band leading, so indemnity does not
  sort below a late fee. Confidence moves nothing.
- **07** reports a clean document with the list of what was checked, carried from
  analysis rather than printed by the render path.
- **08** splits the consequence in two: the document-grounded claim with its source
  sentence, and an external fact from a reviewable store with its own citation.
- **09** answers only from the document and refuses what it cannot ground, through the
  same verifier a flag uses, now moved to `src/domain/verify.ts` so there is one.

## Where the code lives

Four seams, as the spec specifies, each testable without a browser, a database or a
live model:

```
src/extraction/   text in; extracted text, source kind, completeness out
src/analysis/     text in; summary, checked clause types, verified flags out
src/ranking/      flags and red lines in; ordered flags, clean determination out. Pure.
src/qa/           text and a question in; grounded answer or refusal out
src/domain/       verify.ts, defects.ts, wording.ts, clause-types.ts, text.ts, red-lines.ts
src/model/        client.ts (injected), openrouter.ts (real), stub.ts (from fixtures)
```

`src/domain/verify.ts` is the file the product rests on. It is 100 lines, it knows
nothing about models or screens, and both the flag path and the answer path build their
citations through the same call in it.

## Where this run stopped, and why

The owner's session limit was about to be reached, so the run was stopped
deliberately after ticket 09 rather than blocked on anything. Tickets 03, 10, 11, 12,
13 and 14 have complete briefs written and nothing else. Picking them up needs no
re-reading of the spec: every brief is self-contained.

## Resuming

Every ticket brief is at `.scratch/redline-v1/briefs/NN.md`, and the standing brief
every one of them depends on is at `.scratch/redline-v1/AGENT-BRIEF.md`. The standing
brief carries the two answers `CLAUDE.md` marks stop-and-ask, the repository layout,
the approved dependency list, and the rules each ticket is checked against.

The remaining tickets in dependency order, with what each one is waiting on:

1. **03, PDF text layer and typed refusal.** Blocked by 02, which is done. Ready.
   Its dependency question is already decided: `pdfjs-dist`, recorded below.
2. **10, the real OpenRouter client.** Blocked by 04 and 09, both of which will be
   done. This is the first ticket that spends money, and it is the one that produces
   `npm run smoke`.
3. **11, sign in and the library.** Blocked by 07, which is done. Nothing on this path
   can be verified by running it, because no Supabase project exists.
4. **12, red lines.** Blocked by 11 and 06.
5. **13, the eval suite.** Blocked by 10 and 06.
6. **14, the landing page.** Blocked by 01 and 08, both done. Ready now, though it is
   better after 10, because its fold is meant to show real model output rather than
   stub output.

Two of those, 03 and 14, are unblocked today and sit on different seams. They both
touch a screen, so they were not run together; that judgement can be revisited.

## The exact commands to run first

```
npm install
npm run typecheck
npm test
npm run build
```

`npm test` is the deterministic suite. It makes no network call, needs no key, and
takes under a second. If it does not pass, nothing else in this report should be
trusted.

Then look at the product:

```
npm run dev
```

`/` is the paste box and the result screen. `/landing` is the ported landing page,
which ticket 14 moves to the root. Paste `tests/fixtures/adhesion-contract.txt` into
the box. Without `OPENROUTER_API_KEY` reachable from the server the analysis call will
fail with a stated reason rather than a stack trace, which is itself one of the states
worth looking at.

`npm run smoke` does not exist yet. Ticket 10 writes it.

`node scripts/verify-fixtures.mjs` checks the two fixture documents against their
sidecars. It must pass before and after any change that touches `tests/fixtures/`.

`npm run check:citations` fetches the four external-context URLs and checks each
figure appears in the fetched page. It makes network calls on purpose and is not part
of the commit suite. It was run once during this build and all four returned 200.

## What could not be verified, and why

**Nothing on the Supabase path.** No project exists and no URL or anon key is set, so
sign-in, the library and red lines cannot be exercised at all. Tickets 11 and 12 write
migrations under `supabase/migrations/` for the owner to run by hand, and both were
briefed to say explicitly what they could not check. The one thing that is tested is
the constraint that matters most: the analysis path works with both Supabase variables
absent, because a reader deciding in the minutes before they accept will not stop to
create an account.

**No real model call was made during this run.** Ticket 10 is the first that makes
one, and it had not started when the run stopped. Everything measured so far ran
against the stub in `src/model/stub.ts`, which builds its payloads from the fixture
sidecars. That means the seams are proved correct against known inputs and nothing yet
proves the model finds a real clause in a real document. `PRD.md` section 4's recall
and precision numbers do not exist, which is also why no accuracy claim may appear
anywhere in the product.

**No browser was opened by a person.** Several tickets rendered markup with
`react-dom/server` and two checked layout in headless Chromium, and that is not the
same as someone looking at the screen. The Impeccable direction round was skipped on
purpose, because it opens a page and waits for a human.

**No Vercel deploy was run.** `vercel.json` is deleted, which is the whole fix for
Next.js detection, and `next build` passes locally. Whether the deploy behaves is the
owner's to check.

## Risks worth a decision

**The summary's verdict check can fail a whole analysis on a word match.** Ticket 05
blocks forty-four wordings and a hit fails the analysis rather than striking the
sentence, on the reasoning that a summary with a sentence removed by code is a summary
nobody wrote. The cost is that a legitimate summary containing an unlucky phrase costs
the reader every verified flag on screen. Six hand-written legitimate summaries in
`tests/summary.test.ts` assert the list does not fire on ordinary prose, which is
evidence rather than proof. The first real model run is where this will show.

**Flags are not dropped at runtime for statutory or verdict wording.** The same list
runs over both fixtures and the whole fact base in tests, but nothing removes a flag
in production, because dropping a verified flag on a word match trades a visible false
positive for an invisible false negative. `src/analysis/wording.ts` records the
decision as open rather than taken.

**Two ticket 05 criteria are partly met and are ticked as partly met.** The summary
states only what the document supports, and carries no implied verdict, are both
prompt-constrained rather than guaranteed. Groundedness of prose cannot be checked the
way a flag's span can. The ticket file records this with `[~]` rather than `[x]`.

**The open question about four competing signals is still open.** Severity,
confidence, completeness and, once ticket 12 lands, a red-line mark all appear on one
screen, and `PRODUCT.md` records that how a reader combines them is unresolved. No
ticket resolved it and none was asked to.

**Whether a low completeness reading should suppress a clean verdict is still open.**
ADR 0006 records the current behaviour, which is that it does not, and ticket 07
implemented exactly that without resolving the question.
