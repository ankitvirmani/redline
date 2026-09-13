# What building Redline v1 taught us

Written 2026-09-13, at the end of the unattended implementation run that took the
fourteen tickets in `.scratch/redline-v1/issues/` from an empty repository to a working
product.

`BUILD-REPORT.md` is the handover: what got done, what did not, and what to run first.
This file is the other half. It records what we learned that is not obvious from the
code, will not be recoverable from git history in six months, and would cost real time
to rediscover.

Two kinds of learning are mixed here on purpose, because they turned out to be
connected. The first kind is about this product and the models behind it. The second is
about running a long build through agents. Keeping them apart would hide the fact that
the process choices are what made the product findings visible.

---

# Part one: what we learned about the product

## The dominant failure mode is characters, not reasoning

This is the finding worth the whole run.

Redline's rule is that every flag quotes the exact sentence it came from, checked in
code against the stored text as an exact substring before anything reaches a reader
(ADR 0001). The question nobody had asked was: when that check fails, why does it fail?

It is not because the model hallucinates a clause. Over a labelled corpus of nine
documents carrying forty planted clauses, the eval suite measured this:

| Planted sentences | Recall |
| --- | --- |
| Carrying an em dash, curly apostrophe, non-breaking space or ligature glyph | 7 of 10 |
| Carrying none of those | 28 of 30 |

**The model retypes those characters instead of copying them.** It reproduces a
sentence that is semantically identical and byte-different, the substring check fails,
and the verifier drops a flag that had correctly identified a real risk.

We found this three times, in three different ways, and each one made it more concrete:

1. **Ticket 10, as an anecdote.** The first real model run over the fixture contract
   claimed nine flags and kept eight. The dropped one was the same on every run:
   limitation of liability, whose sentence carries two em dashes, a curly apostrophe and
   a non-breaking space in `twelve (12)`.
2. **Ticket 13, as a measurement.** The eval suite split recall by typography and
   produced the table above. What had been one flag became a rate.
3. **Ticket 03, as a cause.** A PDF text layer is where those characters come from in
   the real world, because PDF producers emit ligatures as single glyphs and use
   non-breaking spaces freely. So the input path most likely to carry poisoned
   characters is the one a reader uses for the document type they are least able to
   paste: an offer letter.

### What this means

The rule is working exactly as designed. Zero unverifiable quotes reached a reader
across 39 flags and every answer. That is the product's central promise, held.

But the cost was never priced. Strict verification converts a class of model
imprecision into **false negatives**, and ADR 0004 is explicit that a false negative is
the invisible failure, the one a reader never learns about. We chose over-flagging as
the error bias and then built a mechanism that silently biases the other way on exactly
the sentences most likely to matter, because a liability cap or an arbitration clause
is exactly the kind of clause a careful drafter sets in typographically careful prose.

### What we did not do about it, and why

Nothing. Every option we could see is worse than the problem:

- **Normalise before comparison.** This is the obvious fix and it is the one thing
  ADR 0001 rules out, because the reader is shown the quote and must be able to hold it
  against their own document. A normalised match means the quote on screen is not the
  sentence in the contract.
- **Fuzzy match, or repair a near miss.** Ruled out for the same reason, and worse: a
  repaired span is a citation the reader cannot trust, and the repair is precisely the
  silent degradation the code-level check exists to prevent.
- **Ask the model to copy more carefully.** A prompt is not a guarantee. We proved that
  in a different context on ticket 05 and the reasoning transfers.

The honest options we did not have time to try, recorded for whoever picks this up:

- **Return offsets instead of text.** Ask the model for a character range and take the
  sentence from the stored text ourselves. The model then cannot retype anything,
  because it never hands us prose. The risk moves to the model miscounting, which is a
  different and possibly worse failure, and it needs measuring rather than assuming.
- **Anchor on a distinctive substring.** Have the model quote a short fragment it is
  likely to get right, locate that, then expand to sentence boundaries in code. Halves
  the number of characters that can go wrong without loosening what is displayed.
- **Report the drop to the reader.** Today a dropped flag is invisible to them. Saying
  "one clause was found and could not be quoted" would be honest, and it is also
  exactly the kind of sentence that erodes confidence in everything else on the page.
  A real product decision, not a technical one.

## A citation failure quietly cost a severity adjustment

Worth reading twice, because it is the kind of coupling nobody designs and everybody
inherits.

Severity is assigned during analysis from the clause instance's own terms, not from a
lookup on its type (ADR 0003, and ticket 04 built it that way). The one movement rule
that shipped is: a window the reader can actually use, meaning a period the document
states, running each time the clause bites, at least thirty days long, moves the band
one step toward moderate. And the day count has to appear in a sentence the flag cites,
so that a term which moves severity is itself checked against the document.

That last clause is the right design. It is also a dependency.

In the real run, the arbitration flag's exit was a thirty-day opt-out. The model
retyped the non-breaking space in that sentence, so the exit was dropped by the
verifier. With the exit gone, the digits `30` appeared in no sentence the flag cited.
The severity logic saw no usable window and left the band where the type put it.

Nothing malfunctioned. Every piece did what it was designed to do. But a character
fidelity problem in one sentence propagated into a severity outcome two seams away, and
no test anywhere asserted the connection because no test knew it existed. We only saw
it because the smoke script printed enough to notice.

**The general lesson: when a verification gate feeds a derived value, a verification
failure is also a silent input change.** Write that down wherever the gate is, because
the code reads as two independent correct behaviours.

## Recall has to be measured two ways, and the gap is the interesting number

Our first instinct was to score recall by matching a returned flag's source sentence
against the sidecar's expected sentence. That instinct is wrong, and the real model
showed us why within one run.

Asked "if I forget to cancel, am I on the hook for another whole year?", the model
cited *"Notice delivered after that day takes effect at the end of the term that
follows, and the dues for the intervening term remain payable in full."* Our label
named the renewal sentence. Both are real, both answer the question, and the model's
choice is arguably the better one.

An exact-sentence rule would have scored that as a miss. So ticket 13 reports two
numbers:

- **Strict:** the flag names the planted clause's type AND its verified span overlaps
  the planted sentence's span. Overlap rather than equality, because where a sentence
  ends is a judgement call and a model that quotes the same clause one subordinate
  clause short has found it.
- **By type:** the document produced any flag of that type, cited anywhere.

Measured: strict 35 of 40, by type 39 of 40.

**The gap between those columns is where the model finds the right clause and names it
wrong**, and that turned out to be almost entirely fee escalators, at 6 of 9 strict
against 9 of 9 by type.

That one type also produces a result which looks like a contradiction and is not. The
regulator-evidenced group scored 20 of 24 strict, *below* the weaker-evidence group's 15
of 16, which inverts what `PRD.md` predicts about evidence quality tracking flag
quality. It does not falsify the prediction. The regulator group carries all nine
fee-escalator instances, and that is the type the model kept misnaming. **A per-group
average hid a per-type effect.** Report both, always.

## The residual risk is severity, not citation

We spent the build defending against fabricated citations, and got it: zero unverifiable
quotes reached a reader.

The flag that should worry you is a different shape. In the phone-plan corpus document
the model rendered a sentence about raising two billing charges at **critical** severity,
labelled **non-compete**. The citation is honest. The sentence is real and quoted
correctly. The severity is the strongest band the product has, attached to a clause that
removes no lever at all.

A reader cannot catch that by reading the source sentence, which is the one defence the
whole product is built around. They would have to know that a fee change is not a
non-compete, and the entire premise (ADR 0002) is that they do not.

It was one flag in 39 and it did not block the run. It is also the most dangerous single
output the build produced, and it is exactly what "precision at high severity" exists to
catch. Worth considering a guard for the case where the clause type and the cited
sentence disagree badly, though what that guard looks like without a second model call
is an open question.

## Provider pinning converts a silent reroute into a visible refusal

`provider: { order: ["fireworks"], allow_fallbacks: false, require_parameters: true }`
is in every request. The practical consequence is not what you would guess from reading
it.

Nine of twelve smoke attempts, and 7 retries inside one eval call, failed with a 429
from Fireworks' shared upstream pool. With fallbacks allowed, OpenRouter would have
quietly routed to another provider, possibly one that does not honour strict structured
output, and the request would have succeeded with a response shape we did not ask for.
With them off, we get an error we can see.

**A visible refusal is the correct outcome and it looks like a bug.** Both agents that
hit it wanted to relax the pin, and both were told not to. The right response to a
shared-pool rate limit is backoff and a reply cache, which is what ticket 13 built: a
cold eval pass is 35 calls and took 42 attempts, and a re-run is free.

One detail worth keeping: the real 429 body contained the model id in plain text. The
client reads status and code only and never forwards a provider's error message, which
turned out to matter for a rule we adopted for a different reason.

## A word list blocks explicit wording and cannot block an implied verdict

Ticket 05 has to guarantee that the plain-English summary never tells a reader whether
to sign. A prompt cannot guarantee that, so the check runs in code: 44 patterns in four
kinds, and a hit fails the whole analysis rather than striking the sentence, because a
summary with a sentence removed by code is a summary nobody wrote.

It works, as far as it goes. What it catches is wordings. What it misses is a verdict
reached through emphasis, through ordering, through what the summary leaves out, or
through a phrasing nobody listed. Six hand-written legitimate summaries assert the list
does not fire on ordinary prose, which is evidence and not proof.

Two things follow, and both generalise beyond this product.

**Mark the criterion honestly.** Ticket 05's criteria are `[~]` in the ticket file, not
`[x]`, with the gap written out. Ticking them plain would have handed the next person a
guarantee nobody built, and they would have relied on it.

**A blocking word list has a cost that lands on the reader.** A legitimate summary
containing an unlucky phrase fails the entire analysis, so the reader loses every
verified flag on screen over a phrasing. It never fired in three completed real runs,
which is reassuring and not conclusive. If it starts firing, the fix is probably to
narrow the patterns rather than to change what happens on a hit.

The same tension appears at the flag level and was resolved the other way. Ticket 08
runs the same shared list over flag consequences in tests but **does not drop a flag at
runtime for a wording**, because dropping a verified flag on a word match trades a
visible false positive for an invisible false negative. The decision is recorded as open
in `src/domain/wording.ts`. Two seams, same list, opposite failure direction, both
deliberate.

## Storing an analysis obliges you to recheck it

The library stores the analysis beside the extracted text rather than recomputing on
reopen. The reason is the product's promise: a document someone decided about last month
has to come back with the flags they were shown, not a fresh reading from a changed
model or a changed prompt.

The cost of that choice is a citation nobody rechecked. So ticket 11 closed it: every
source sentence is located again in the stored text on the way in and on the way out,
the span is rebuilt from the text being displayed rather than carried over from the row,
a flag whose sentence is gone is dropped, and the screen says how many.

The subtlety worth recording is that those drops record **no defect**. The defect log
measures the model. A stored row disagreeing with its own stored text is storage going
wrong, and mixing the two would corrupt the one number the eval suite reads.

## Third-party parsers normalise, and they do it where you cannot see

PDF.js runs an NFKC-style pass by default and `disableNormalization: true` is
load-bearing. Without it the ligature glyph arrives as two letters and every downstream
citation against a PDF is quietly wrong. A test asserts the extracted text is not
already in NFKC form, so the flag cannot be dropped silently.

That much we anticipated. What we did not anticipate is a second normalisation we cannot
switch off. **Inside the worker, before an item reaches the public API, PDF.js drops
every whitespace glyph and emits a single U+0020 before the next real glyph.** So a
non-breaking space arrives as a plain space, a run of spaces arrives as one, and trailing
whitespace arrives as nothing. Its `keepWhiteSpace` option exists and `getTextContent`
does not forward it, so this is unreachable without forking the parser.

It does not break verification, because the extracted text is the only thing a span is
ever held against, so reader, model and verifier all see the same plain space. What it
does mean is that **a quoted sentence can differ from the source PDF by a space
character**, and anyone comparing Redline's output against the original file by eye will
eventually notice.

All three losses are asserted as tests. That is the move worth copying: when a dependency
does something to your data that you cannot prevent and cannot afford to have change,
assert the current behaviour so the day it changes is a test failure rather than a silent
shift in the thing every citation is measured against.

## Detection honesty beats detection coverage

A scan already put through OCR somewhere else arrives with a text layer full of misread
words, and nothing distinguishes it from a real one. ADR 0006 excludes OCR precisely to
avoid citations into misread text, and this is that exact failure arriving from outside
the product. We have no detection for it.

The useful part is how ticket 03 handled the cases it *could* distinguish. Four reason
codes, each with its own detection: a password exception, an unreadable document, no text
anywhere plus a page that paints an image, and no text anywhere with no image either. Not
one guess wearing four labels.

**A reason code that claims more certainty than its detection provides is worse than a
general one**, because the reader believes it. The cases that cannot be told apart are
named in the ticket file rather than papered over, including the scan-from-a-photograph
case, where the copy says "a picture of a page" rather than asserting which kind.

---

# Part two: what we learned about running the build

The product findings above are only visible because of some of these. That is the
argument for writing them down.

## Fixtures before code, built by construction and verified by script

The first thing built after the app scaffold was two fixture documents and their
sidecars: an adhesion contract carrying a planted instance of all seven clause types,
and a genuinely clean document carrying none. Everything downstream was measured against
them.

Three details did the work:

**The contract was written to be hostile.** Curly quotes, a ligature glyph, a
non-breaking space, tabs, double spaces, a line ending in three trailing spaces, an em
dash. Not decoration. Every one of those is a character that defeats a fidelity
guarantee written carelessly, and the whole character-fidelity finding in part one exists
because the fixture carried them. **A fixture that only contains easy text certifies
nothing.**

**Sidecar sentences were generated from shared constants, not transcribed.** The
verbatim property holds by construction rather than by someone copying carefully. A
transcription would have drifted on the first edit.

**`scripts/verify-fixtures.mjs` is stricter than asked.** It fails on a sentence
appearing zero times *or more than once*, because a duplicated sentence makes a citation
ambiguous and would let a wrong flag pass verification. It runs before any paid work.

Two omissions in the fixture are load-bearing and were recorded as such: no governing-law
clause and no privacy clause, which is what makes "whose law applies" and "does Meridian
share my details" genuinely unanswerable. Ticket 13 measures refusal at 100%, and a
question answerable by implication would have made that measurement a lie. **When a
corpus asserts that something is absent, the absence needs the same care as the
presence.**

## The anti-stub rule, stated as a rule

Every brief carried this, verbatim:

> None of these counts as done, and a ticket that contains one is still open: a function
> that returns a fixed value; a TODO or a "not implemented" error; a test that checks a
> file exists or a function is defined; a test that mocks the thing it is meant to test.
> A build told only to make the tests pass will do exactly that, with stubs.

It was paired with a second standing instruction: **never weaken an earlier ticket's
assertion; the suite grows purely by addition.** The cheapest way to make a hard
criterion pass is to loosen the test that checks it, and an agent under instruction to
finish will find that path.

The suite went from 0 to 559 tests across fourteen tickets and no ticket weakened an
earlier one's assertion. Two tickets touched an existing test file and both reported it
unprompted with the reasoning: ticket 11 repointed a DOM-order assertion at the file the
rendering had moved to and added an assertion rather than removing one, and ticket 13
added an entry to an allowlist of files permitted to import the real model client. Both
were the right call and both were legible because the rule made them worth mentioning.

Worth being honest about the limit: the rule catches lazy stubs. It does not catch a test
that asserts something true and uninteresting. Reading the test names was still necessary.

## Briefs written before any code, and self-contained

All fourteen ticket briefs were written up front, before the first line of
implementation, against one reading of the spec and the ADRs. Each names the files to
read in order, restates the ticket's criteria, and lists what is explicitly out of
bounds.

Three things this bought:

**Consistency.** A brief written when its turn came would have been written against
whatever was freshest, not against the spec.

**Scope containment.** The most expensive failure in a long unattended run is an agent
helpfully building the next ticket's work on top of a seam that has not settled. The
"out of bounds" section was in every brief and it held. Ticket 04 carried a field for the
two-tier consequence and left it null for ticket 08 rather than filling it in.

**An audit trail.** The briefs record what each ticket was told, which is the only way to
tell a decision from a guess after the fact.

The briefs are checked in at `.scratch/redline-v1/briefs/`. Keep them.

## Downstream notes, written by the ticket that will be built on

This emerged during the run rather than being planned, and it is the single most useful
process discovery.

Every agent was asked, in its report, to say what the tickets depending on it would need
from its types. Those notes then went into the next brief verbatim. Some examples of what
that prevented:

- Ticket 02 made `extract()` async before anything needed it to be, precisely so ticket
  03 could add PDF parsing by adding one case to a switch rather than changing every
  caller.
- Ticket 06 left `cleanDocument` on its return type as `CleanDocumentReading | null`,
  documented as "not determined" rather than "not clean", and said plainly that ticket 07
  would have to add `checkedClauseTypes` to the request because the seam genuinely could
  not derive it. Ticket 07 did exactly that.
- Ticket 06 also warned ticket 12 that promotion goes in front of the severity comparator
  as one more key and never as a filter, and pointed at the note explaining that
  indemnity removes no lever and is banded high on cost, so leading with the lever count
  would sort it below a late fee. Ticket 12 got the comparator right first time.
- Ticket 04 flagged that its verifier was built to be shared. Ticket 09 moved it to
  `src/domain/verify.ts` rather than importing across seams or copying it, on the
  reasoning that two verifiers drift and the one on the answer path is the one nobody
  watches.

**An agent that knows who reads its output next designs differently.** That costs one
paragraph in a brief and one paragraph in a report.

## Parallelism needs a file split, not an intention

Two pairs ran concurrently: 10 with 11, and 13 with 12. Both were given an explicit,
named division of ownership.

> Ticket 10 owns `src/model/`, `scripts/smoke.ts` and the route handlers. Ticket 11 owns
> `app/page.tsx`, every component and every `.css` file. Do not cross.

Nothing collided. One test did fail mid-flight, and it was a file ticket 11 owned and
fixed itself, which is the system working rather than failing.

The rules that made it safe:

- **Name the owner of every file that both could plausibly touch**, especially the shared
  screen and `package.json`.
- **Parallelise different seams, not different features.** Two agents on one screen
  collide regardless of instructions.
- **Expect `package.json` to need untangling.** Both agents in each pair added to it. The
  fix was to stage a hand-built slice for the first commit and restore the full file for
  the second, which is fiddly and took a minute. Worth it for the isolation.

## Orchestrator context discipline

The orchestrator's context has to last for hours, which changes what it is allowed to do.

The discipline: read the plan, the spec, the ADRs and the design system once at the
start. After that, read agent reports, `git status`, `git diff --stat`, test output and
targeted greps. Never read a whole source file that a subagent wrote.

What the orchestrator did read directly, and should:

- Every agent report in full.
- `src/domain/verify.ts`, because it is the file the product rests on and a mistake there
  is invisible in a passing suite.
- The severity assignment logic, specifically to check it was reading the instance's
  terms rather than looking up the fixture's expected answer, which would have been a
  stub dressed as a feature.
- The comparator key order in ranking, because the ADR's wording and the correct
  implementation differ in a way that is easy to get backwards.
- Targeted greps for the things the rules forbid: model ids, credentials, `TODO`,
  `normalize(`, a hardcoded seven.

That last set is worth generalising. **Verify the properties that a passing test suite
cannot show you**, and accept the report for the rest.

## Commit per ticket, message says why

One commit per ticket, after the typecheck, that ticket's tests, the full suite and a
diff read all passed. Messages state the reasoning rather than the change list, because
the change list is in the diff and the reasoning is nowhere else.

The concrete payoff: the character-fidelity finding, the severity coupling it caused, and
the reason recall is measured two ways are all in commit messages. Six months from now
they are recoverable without this file existing.

## Two incidents worth remembering

**A stray NUL byte made a source file binary to git.** Ticket 04 used a literal NUL as
the separator in a composite dedup key. Sound choice of value, since a NUL cannot occur
in a clause type or a source sentence. But written as a raw byte it made git classify
`src/analysis/flags.ts` as binary, which costs every future diff and review on the module
that turns a model payload into verified flags. Caught because `git show --stat` printed
`Bin` instead of a line count. Fixed by writing it as a unicode escape: same key, same
behaviour, reviewable file. **Read the commit stat, not just the test output.**

**An expired API key looked like it could have been a code fault.** The owner rotated the
key mid-run. Ticket 10's agent was told immediately, and told to report both attempts if
it had already tried the old one rather than only the run that worked. It turned out no
authentication failure had occurred at all and the rotation was not implicated, which is
only knowable because the instruction asked for the full history rather than the outcome.
**Ask for every attempt, not the successful one.** An agent optimising for a clean report
will show you the clean run.

## Marking a criterion as partly met

Four criteria across two tickets are `[~]` rather than `[x]`, each with the gap written
out beside it:

- Ticket 05, twice: the summary states only what the document supports, and carries no
  implied verdict. Both are prompt-constrained rather than guaranteed.
- Ticket 11, three criteria, and ticket 12, one: written and typechecked against Supabase,
  unverified because no project exists. Sign-in has signed nobody in, no insert has run,
  and no row-level-security policy has denied anybody.

This was the highest-value reporting decision in the run. A ticked box is read as a
guarantee and relied on. **An admitted gap is worth more than a confident summary**,
because the person reading it next makes a different decision.

## What the process did not cover

Recorded so the gaps are not mistaken for coverage.

**No person looked at the screens.** Several tickets rendered markup with
`react-dom/server` and several drove headless Chromium, including a full contrast pass
over every text element on the landing page and a real check that the PDF worker starts
and the document never leaves the browser. None of that is somebody looking at the
product. The Impeccable direction round was skipped deliberately, because it opens a page
and waits for a human, and no human was there.

**Nothing on the Supabase path ran.** See above.

**The eval corpus is not real contracts.** Seven of nine documents were written for the
suite. Every manifest entry records its provenance and a test asserts none claims
otherwise. A sentence written to read like an arbitration clause is a sentence a model is
likely to recognise as one, so **every recall figure is an upper bound.** Two clause
types have only four instances each and the run says so beside their numbers.

**Precision at the top severity band is a proxy.** The real measurement is a person
reading each top-band flag's source sentence and judging whether it survives review. The
run prints all fifteen so it can be done.

---

# The three things to carry into the next build

**Build the hostile fixture first, and make it hostile on the axis the product actually
depends on.** Everything useful this run found came from a contract that carried a
non-breaking space on purpose.

**Ask each ticket what the next one needs from it.** One paragraph, and it removed almost
all the integration friction that normally arrives at the end.

**Report the gap, not the green.** The most valuable lines in `BUILD-REPORT.md` are the
ones saying something was not verified and why.
