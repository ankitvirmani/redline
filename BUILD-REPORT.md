# Build report: Redline v1

Written by the implementation run that started on 2026-09-12. The owner was not
present, so every question that would normally have been asked was decided here
and recorded below with its reason.

This file is the handover. Read "Start here when you sit down" first.

## Start here when you sit down

**All fourteen tickets are done, committed and pushed.** The deterministic suite is 559
tests, passes in under a second, makes no network call and needs no key. `npm run
typecheck` and `npm run build` both pass.

Run the four commands under "The exact commands to run first" at the end of this file.
Then read "What the eval suite measured" and "Risks worth a decision", which are the
parts that need you rather than another agent.

Two things are done as written and verified only as far as they can be. Nothing on the
Supabase path has run, because no project exists: sign-in, the library and red lines are
built, typechecked and unexercised, and `supabase/README.md` carries the order to check
them in once the migrations run. And three of ticket 11's criteria plus one of ticket
12's are marked in their ticket files as written rather than verified, for the same
reason.

The product does work end to end against a real model. `npm run smoke` puts the fixture
contract through all four seams and prints every flag with its source sentence.
`npm run eval` measures a labelled corpus and produced the numbers in the next section.

## Ticket status

| Ticket | Title | Status |
| --- | --- | --- |
| 01 | Walking skeleton | done |
| 02 | Extraction seam and completeness | done |
| 03 | PDF text layer and typed refusal | done |
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
| 14 | Landing page | done |

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

**Route order during the build.** Ticket 01 wanted the paste box at the root and
ticket 14 later took the root for the landing page. The ported landing page lived at
`/landing` for two commits until ticket 14 moved it to `/` and moved the paste box to
`/analyse`. Neither ticket had to be rewritten to accommodate the other. `/landing` is
gone with no redirect, because it was never linked and never deployed under that name.

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
- **10** runs a real document through a real model with the provider pinned, and the run
  dropped a flag whose sentence the model retyped rather than copied.
- **11** lets a reader keep a document and rechecks every citation against the stored text
  on the way in and the way out, so a kept analysis cannot show a quote its own text no
  longer contains.
- **12** promotes a matching clause with one more comparator in front of the severity band,
  and produces no count, no score and no verdict.
- **13** measures the model over a labelled corpus, reports rather than gates, and turned
  the character-fidelity anecdote into a number.
- **14** gave the landing page the root route and replaced its invented demonstration with
  a real run, then cut the three sentences that traced to no claim.
- **03** reads a PDF text layer in the browser with normalisation switched off, and refuses
  a picture of a page with the reason shown.

## What the eval suite measured

`npm run eval` ran twice against the real model over a labelled corpus of nine documents
carrying forty planted clauses. Both passes exited zero, every blocking check held, and
the numbers were byte-identical between them. Recorded in `eval-runs/`.

**Pass or fail, and all of it passed.** Citation integrity: 41 flags claimed, 39 shown,
and zero quotes reaching a reader that failed to appear in their document. Ungrounded
questions: 13 of 13 refused. Ranking: arbitration above a lower-banded clause in all five
readings that had both. Clean documents: all three benign documents produced no flags at
any band and no invented finding.

**Measured and reported, not gated, because the thresholds in `PRD.md` section 4 are
proposed and mean nothing until calibrated.** Strict recall 35 of 40, matching a flag to a
planted clause by type plus span overlap. By-type recall 39 of 40. Proxy precision at the
top band 93.3%, labelled a proxy because the real measurement is a human reading source
sentences and that is yours to do; the run prints all fifteen top-band flags for it.

**The finding worth acting on is about characters, not clauses.** Split by typography,
recall on planted sentences carrying an em dash, a curly apostrophe, a non-breaking space
or a ligature glyph is 7 of 10. On sentences carrying none it is 28 of 30. The model
retypes those characters instead of copying them, the span fails the substring check, and
the verifier drops the flag. The rule is working exactly as designed and it costs real
recall that nobody had priced. Ticket 10 found this as an anecdote about one flag; the eval
suite turned it into a measurement; ticket 03 then found that a PDF text layer is where
those characters come from in the real world.

**One flag needs your eye.** In the phone-plan document the model rendered a sentence
about raising two billing charges at critical severity, labelled non-compete. The citation
is honest and the severity is wrong, so a reader would see the product's strongest band on
a clause that takes no lever. One flag in 39, it did not block the run, and it is precisely
what precision at high severity exists to catch.

**The recall split runs opposite to what `PRD.md` predicts**, and it is not a real
contradiction. The regulator-evidenced group scores 20 of 24 strict against the weaker
group's 15 of 16, because that group carries all nine fee-escalator instances and fee
escalators is the type the model kept finding and naming wrong. By-type recall there is 9
of 9.

**Read every recall figure as an upper bound.** Seven of the nine corpus documents were
written for the suite rather than collected from the world, each manifest entry records its
provenance, and a test asserts none claims otherwise. A sentence written to read like an
arbitration clause is a sentence a model is likely to recognise as one. Non-compete and
limitation of liability have four instances each and the run says so beside them.

A cold pass is 35 model calls and took 42 attempts, because a rate limit from the pinned
provider's shared pool arrives as a refusal rather than a reroute. Replies cache to disk,
so a re-run is free.

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

`src/domain/verify.ts` is the file the product rests on. It knows nothing about models or
screens, and the flag path, the answer path and the library's recheck on reopen all build
their citations through the same call in it. If you change one thing in this repository by
accident, let it not be that file.

Nothing on the reading path imports a Supabase client, and a test walks the import graph
from the paste box, the layout, the renderer, the shell and all four seams to prove it,
printing the chain if it ever does. The same discipline applies to the model client: a test
fails if any file outside the two route handlers, the smoke script and the eval script
imports it.

## How the run went

Fourteen tickets, one commit each, written to say why rather than what. Every ticket was
handed to a subagent with a self-contained brief, and each one's work was checked here
against the typecheck, its own tests, the full suite and a diff read before it was
committed. No ticket was sent back twice and none was blocked.

The briefs are at `.scratch/redline-v1/briefs/NN.md` and the standing brief every one of
them depends on is at `.scratch/redline-v1/AGENT-BRIEF.md`. They are worth keeping,
because they record what each ticket was told, which is the only way to tell a decision
from a guess after the fact.

Two pairs ran in parallel, with a hard file split rather than a hope. Ticket 10 owned the
model client and the smoke script while 11 owned the screens; 13 owned the corpus and the
eval harness while 12 owned ranking and the red-lines screen. Both pairs sat on different
seams. Nothing collided, and the one test that broke mid-flight was a file one of the pair
owned and fixed itself.

The suite grew to 559 tests purely by addition. No ticket weakened an earlier one's
assertion, which was a standing instruction in every brief, because the cheapest way to
make a hard criterion pass is to loosen the test that checks it.

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

`/` is the landing page. `/analyse` is the paste box and the result screen. Paste
`tests/fixtures/adhesion-contract.txt` into the box, or pick
`tests/fixtures/pdf/text-layer-offer-letter.pdf` to watch a PDF parse in the browser, or
`tests/fixtures/pdf/pages-are-images.pdf` to see a scan refused. `/library`, `/sign-in`
and `/red-lines` all render their no-project state, which is what you will see until the
migrations run.

Then the two deliberate scripts:

```
npm run smoke
npm run eval
```

`npm run smoke` puts the fixture contract through all four seams against the real model
and prints every flag with its source sentence in full, plus how many were dropped. It
needs `OPENROUTER_API_KEY` and says so and exits non-zero without it, rather than falling
back to the stub.

`npm run eval` measures the labelled corpus. A cold pass is 35 model calls; replies cache
to disk so a re-run is free. Read `eval-runs/README.md` first, and the two recorded passes
are already in that directory, so you do not have to pay to see the numbers.

Then the migrations, which is the work only you can do:

```
supabase/README.md
```

It carries the order to run `supabase/migrations/0001` through `0003` and the numbered
list of what to check afterwards. The most important check is that a row-level-security
policy actually denies another reader, because nothing here has shown that.

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

**The accuracy numbers now exist, and they still may not be claimed anywhere in the
product.** The eval suite produced real figures over a corpus seven ninths of which was
written for the suite rather than collected from the world. `PRD.md` section 4 says no
accuracy figure appears in copy until this section has been calibrated against a real
corpus, and a corpus of documents written to be measured is not that. The landing page
carries no figure and a test enforces it.

**Precision at the top severity band is a proxy, not the measurement.** The real one is a
person reading each top-band flag's source sentence and judging whether it survives review.
The run prints all fifteen of them so you can do it.

**No browser was opened by a person.** Several tickets rendered markup with
`react-dom/server` and several drove headless Chromium, including a full contrast pass over
every text element on the landing page and a real check that the PDF worker starts and the
document never leaves the browser. None of that is the same as someone looking at the
screen. The Impeccable direction round was skipped on purpose, because it opens a page and
waits for a human.

**No Vercel deploy was run.** `vercel.json` is deleted, which is the whole fix for
Next.js detection, and `next build` passes locally. Whether the deploy behaves is the
owner's to check.

## Risks worth a decision

**One top-band flag in the eval run is wrong in the way that matters most.** A sentence
about raising two billing charges came back as a non-compete at critical severity. Honest
citation, wrong severity, strongest band in the product. Worth deciding whether the
severity path needs a guard when the clause type and the cited sentence disagree that
badly.

**A scan already put through OCR elsewhere is read rather than refused.** It arrives with a
text layer full of misread words and nothing distinguishes it from a real one. ADR 0006
excludes OCR precisely to avoid citations into misread text, and this is that failure
arriving from outside the product. There may be no honest detection for it, which is itself
worth recording as a decision rather than a gap.

**PDF extraction loses three kinds of whitespace, and it is not our code doing it.** Inside
the worker, PDF.js drops whitespace glyphs and emits a single space, so a non-breaking space
becomes a plain space, a run of spaces becomes one, and trailing whitespace disappears. Its
`keepWhiteSpace` option is not forwarded by the public API, so changing this means forking
the parser. Verification is unaffected, since the extracted text is the only thing a span is
held against, but a quoted sentence can differ from the PDF by a space. All three are
asserted as tests so the day any of them changes is a failure rather than a silent shift.

**A picked PDF is read into memory whole, with no size guard.** A very large scan would be
slow before being refused. Not in any ticket.

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
