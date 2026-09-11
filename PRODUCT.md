# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Next.js, Supabase for auth and database, deployed on Vercel. Model calls go
through OpenRouter. Documents are parsed in the browser; only the extracted text
is stored. Recorded in `CLAUDE.md` under "Settled, do not reopen" and confirmed
by the owner, so this is not an open stack question.

Which OpenRouter model is undecided and is marked stop-and-ask. The model id is
read from one environment variable and is never hardcoded.

## Users

A reader deciding whether to accept an adhesion contract, in the minutes before
they accept it. Concretely: a terms of service, a subscription agreement, a gym
membership, an employment offer letter.

They are not a lawyer. They have no counsel and will not hire any for this
document, because a $150 to $500 review is out of proportion to a $40 per month
gym contract. They can accept the terms or walk away; they cannot change a word.

"Reader" is the project's word for this person. `CONTEXT.md` rules out user,
customer, client and consumer.

Deliberately not served in v1 (ADR 0002): freelancers, small business owners,
startup founders, and tenants. Each has stronger willingness-to-pay evidence and
each was set aside anyway, because their documents are negotiable and the harm
evidence is thinner.

## Product Purpose

Redline reads a document someone is about to sign and tells them what signing
costs them.

Success for v1 is not revenue or retention. This version exists to establish that
the analysis can be trusted. Every capability that does not make the analysis more
trustworthy was cut on those grounds.

The problem is not that people fail to read. The Blind poster quoted in `PRD.md`
§2 read his offer letter, found the arbitration clause, and still needed help
understanding what it did to him. Reading is insufficient.

## Positioning

Every risk flag carries the exact sentence it came from, quoted verbatim, and the
match is verified in code against the stored text before render rather than asked
of the model. A flag whose source sentence cannot be shown is dropped before it
reaches the screen and logged as a defect.

That is the claim a neighboring product cannot truthfully copy without building
the same verification. A general chatbot offers no severity ordering, no
guaranteed source sentence, and no way to tell a confident error from a correct
answer. Ranking by leverage lost rather than by how unusual a clause is, is the
second half of the position: ubiquity is not safety, and arbitration clauses rank
first precisely because they are everywhere.

## Operating Context

What the reader does today instead, in order of how often:

- Clicks accept. This is the real competitor. It is free, instant, and socially
  normal.
- Pastes the document into a general chatbot. The actual incumbent product, free
  and already good enough to feel sufficient.
- Checks ToS;DR, for the platform-terms subset only. Free, volunteer-graded,
  structurally incomplete, and covering no personal contract, offer letter, or
  gym membership.
- Hires a lawyer. $100 to $750 per hour. Nobody pays $300 to have a $40 per month
  gym contract explained.

The documents arrive in incompatible shapes, and this constrains input directly:
terms of service are web pages, subscription terms arrive in email, gym contracts
are handed over on paper, and only offer letters reliably arrive as files.

The reader is deciding under time pressure, on the accept screen or at a counter,
and is reading dense legal prose they did not choose.

## Capabilities and Constraints

Confirmed for v1, from `PRD.md` §3 and the spec at `.scratch/redline-v1/spec.md`:

- Accepts pasted text or a text-layer PDF, parsed in the browser. Scans and PDFs
  with no text layer are refused with the reason shown, never analysed as empty.
- Reports a completeness reading on every analysis, assessed from structural
  signals. Completeness informs; it does not gate.
- Produces a plain-English summary of what accepting the document commits the
  reader to.
- Flags seven clause types: arbitration and class-action waiver, unilateral
  modification, non-compete, auto-renewal, limitation of liability,
  indemnification, fee escalators and late fees. Each flag carries a source
  sentence, severity, confidence, consequence, and any document-granted exit.
- States consequences in two tiers. The document-grounded claim leads with its
  source sentence; external context sits beneath it, marked as outside the
  document, carrying its own citation.
- Ranks by leverage lost: the reader's ability to sue, to leave, or to refuse a
  change. Ranking contains no model call.
- Accepts an editable list of the reader's red lines, which promote and mark
  matching clauses. Red lines rank; they never block, veto, or hide.
- Answers questions from the document only, with the same source-sentence
  citation as a flag. An ungrounded question is refused, not guessed at.
- Reports genuinely clean documents as clean, together with the list of what was
  checked. An empty screen is indistinguishable from a failed parse.
- Analyses a document for a signed-out reader. An account is needed only for the
  library and for red lines. Confirmed by the owner on 2026-09-11, because the
  reader is deciding in the minutes before they accept and will not stop to create
  an account first.
- Saves past documents to a library, which requires auth.
- A landing page, which owns the root route and hands the reader to the paste box
  on its own route. Confirmed in scope by the owner on 2026-09-11, after `PRD.md`
  §3 and the first thirteen tickets were written without one. It is ticket 14 and
  is blocked on the flag rendering, so that it shows real output rather than a
  mockup.

Excluded on purpose, not deferred: counter-offer drafting, any sign/don't-sign
verdict, OCR and photographed documents, any claim about enforceability, any
statutory right, payments and billing, sharing a document between readers, DOCX,
negotiable documents, and readers who have already signed.

Vocabulary is binding. `CONTEXT.md` is the glossary and carries an avoid-list per
term: reader not user, flag not issue or finding, source sentence not citation or
excerpt, red line not preference or filter, severity not priority, clean document
not safe or passed, consequence not impact.

Undecided, and not to be resolved by guessing:

- Which OpenRouter model. Stop and ask.
- Whether a Supabase project exists. Stop and ask. Do not scaffold a throwaway
  project or mock auth to get past a missing key.
- How a reader is meant to combine four competing signals on one screen:
  severity, confidence, completeness, and red-line match.
- Whether a low completeness reading should suppress the clean verdict. Today it
  does not, and that is the failure a reader cannot detect for themselves.

## Brand Commitments

- Name: Redline. No logo, wordmark, or visual asset exists in the repository.
- The glossary in `CONTEXT.md` governs every word a reader sees, avoid-lists
  included.
- All copy a reader sees, meaning the landing page, UI labels, error messages and
  empty states, runs through the humanizer skill before it is committed. Copy that
  reads as though a model wrote it is a defect, not a matter of taste.
  (`CLAUDE.md` standing rule, added 2026-09-11.)
- Redline states prominently that it does not account for where the reader lives
  and never says whether a clause is enforceable there (ADR 0005).
- Every analysis carries a standing statement that Redline describes documents and
  does not give legal advice. Confirmed by the owner on 2026-09-11.
- Redline never tells a reader whether to sign, in words or by implication.
- The refusal message shown for a scanned document is product copy, not an error
  state.

## Evidence on Hand

Real, cited, and usable. Full URLs are in `PRD.md`:

- CFPB 2015 Arbitration Study: over three quarters of consumers did not know
  whether their credit card agreement contained an arbitration clause, and fewer
  than 7% of those who had one understood it meant they could not sue.
- Center for Justice & Democracy: 56.2% of private-sector nonunion employees are
  subject to forced arbitration; consumers win 9% of arbitration disputes;
  companies win relief 93% of the time when they counterclaim, leaving consumers
  owing an average of $7,725.
- FTC: negative-option complaints rose from 42 per day in 2021 to nearly 70 per
  day in 2024, driving the click-to-cancel rulemaking. Multi-state settlements
  include HelloFresh at $7.5M and TFG Holding at $4.8M across 33 states.
- FTC: the 2024 non-compete rule would have affected roughly 30 million workers,
  about 18% of the US workforce, and was blocked by a federal court in August 2024.
- CFPB: credit card late fees run $14 billion a year across more than 45 million
  people.
- FTC: DoNotPay fined $193,000 for AI lawyer claims it never tested.
- Stanford-affiliated study (arXiv 2304.14347): LLMs deviate from established
  legal facts 69% to 88% of the time on legal queries.
- One first-person account, quoted in `PRD.md` §2, from a software professional
  who found an arbitration clause in a Google offer letter.
- Four research reports plus a summary in `research/`.

Absences future work must not fabricate:

- **No evidence exists that any consumer would pay for this.** Four targeted
  searches produced no verbatim statement from any consumer about price. Every
  price in the research is revealed from the supply side, never stated from the
  demand side.
- First-person pain evidence is weak. Reddit was hard-blocked at the tool level
  for every research agent, and five of Agent 1's seven findings trace to a single
  vendor marketing blog with a commercial interest in the conclusion.
- Redline has never been run on a real document by a real reader. There are no
  users, no testimonials, no customers, no reviews, and no case studies.
- Redline has no measured accuracy. The recall and precision thresholds in
  `PRD.md` §4 are proposed and uncalibrated; the eval suite that would produce
  real numbers is ticket 13 and has not run. No marketing claim may state or imply
  an accuracy figure.
- Two clause types, IP assignment and personal guarantees, produced no sourced
  frequency or harm data and are not in the seven.
- "Nobody has built this" rests on partial competitor coverage. Ironclad, Evisort,
  Harvey, DocJuris, Diligen and Lexion were named but never individually verified.
- Nothing is known about how anyone reaches a landing page for this: how they
  arrive, what they searched for, or what they were doing beforehand. The research
  describes a reader already holding a document. Confirmed by the owner on
  2026-09-11 that the page is written for that reader and this gap stays recorded
  rather than filled in with a guess.

### Landing-page claims list

Every sentence on the landing page must trace to an entry below. Anything not on
this list needs a decision before it ships. This is the marketing counterpart of
the curated external fact base that ADR 0007 requires for external context, and it
exists because the landing page is the one surface whose job is persuasion, which
makes it the easiest place to breach the rule the rest of the product is built on.

**Mechanisms the product performs, claimable once built:**

- Every flag quotes the exact sentence it came from, and the quote is checked in
  code against the stored text before it is shown.
- A flag whose source sentence cannot be shown is never displayed at all.
- Flags are ordered by how much leverage the clause takes away, not by how
  unusual it is.
- The question box answers only from the document, and refuses a question the
  document cannot answer.
- Documents are parsed in the browser. Only the extracted text is stored, never
  the file.
- Scanned and photographed documents are refused with the reason, not analysed.
- Every analysis reports how much of the document Redline believes it received.
- Seven clause types are checked, and a clean document is reported together with
  the list of what was checked.
- Each flag carries a confidence: how sure Redline is that the clause was
  correctly identified, which is a separate question from how much it costs.
- Redline never says whether to sign, and never says whether a clause is
  enforceable where the reader lives.

**The chatbot comparison, at mechanism level only.** Confirmed by the owner on
2026-09-11. The page may say what each tool structurally can and cannot do: a
general chatbot cannot show the sentence a claim came from, and Redline cannot
show a flag unless it can. It may not say Redline is more accurate, more reliable,
or better, because nothing has measured that.

**External facts, each carrying its own citation**, drawn only from the sourced
list above.

**Never, until something changes:**

- Any accuracy, recall, precision, success rate or benchmark figure. Not until
  `PRD.md` §4 has been calibrated against a real corpus.
- Any testimonial, customer name, reader count, review, or case study. None exist.
- Any comparative quality claim against a named or unnamed product.
- Any price, plan, or availability claim. Payments are out of scope.
- Legal advice, a verdict, or an enforceability claim.

## Product Principles

1. **The reader can check everything they are told.** Every claim drawn from the
   document is bound to the sentence that produced it, and the binding is verified
   in code before render.
2. **State only what the document says.** Anything from outside it is marked as
   outside it and carries its own source. Where the text does not support a claim,
   the product does not make it.
3. **Describe, never advise.** No verdict on whether to sign, no claim about
   enforceability, no statutory right. The moment Redline tells a reader what to
   do, it is making a claim it cannot ground in their document.
4. **Miss nothing rather than say nothing, and put the excess at the bottom.** A
   false positive is visible and checkable and costs a little credibility. A false
   negative is invisible forever.
5. **Never let an empty result pass for an answer.** A clean document names what
   was checked, a partial document shows its completeness, and an ungrounded
   question is refused. Silence and a clean bill of health must never look alike.

## Accessibility & Inclusion

WCAG 2.2 AA, confirmed by the owner on 2026-09-11.

The audience is the general public rather than a self-selected technical one:
anyone handed a contract. Source sentences are verbatim legal prose read under
time pressure, which makes text contrast, resize behaviour, focus order and
screen-reader handling of long quoted passages load-bearing rather than
decorative. Severity must never be carried by color alone.
