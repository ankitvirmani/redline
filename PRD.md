# Redline — Product Brief (v1)

Status: draft, 2026-08-29. Derived from `research/summary.md` and ADRs 0001–0008.
Where this brief and an ADR disagree, the ADR wins and this file is wrong.

---

## 1. Who this is for

**An individual reading a take-it-or-leave-it document, in the minutes before they
accept it.** Concretely: a terms of service, a subscription agreement, a gym
membership, an employment offer letter. They are not a lawyer. They have no
counsel and will not hire one for this document. They can accept the terms or walk
away; they cannot change a word.

Deliberately not served in v1 (ADR 0002): freelancers, small business owners,
startup founders, and tenants. Each has a stronger claim on willingness to pay —
small businesses run $2,000–$13,300/yr legal budgets, and a competitor already
sells $99 flat-fee review to freelancers and SMBs — and each is set aside anyway,
because their documents are negotiable and the harm evidence is thinner. See §6.

### What they do today instead

**Nothing, mostly.** They click accept. This is the actual competitor and it is
free, instant, and socially normal.

**Paste it into ChatGPT.** The real incumbent product. Free, available now, and
already good enough to feel sufficient. It is also the bar Redline must visibly
clear: a Stanford-affiliated study found LLMs deviate from established legal facts
69–88% of the time on legal queries
([arXiv 2304.14347](https://arxiv.org/pdf/2304.14347)). A general chatbot offers no
severity ranking, no guaranteed source sentence, and no way to tell a confident
error from a correct answer.

**ToS;DR**, for the platform-terms subset. Free, volunteer-graded, genuinely good,
and structurally incomplete — many services lack enough volunteer analysis to
carry a grade, and it covers no personal contract, offer letter, or gym membership
([tosdr.org](https://tosdr.org/en)).

**Hire a lawyer.** $100–$750/hr for contract review, typically $150–$500
([UpCounsel](https://www.upcounsel.com/contract-review-attorney-fee)). Nobody pays
$300 to have a $40/month gym contract explained. The cost is not merely high; it
is disproportionate to the document, which is why this segment has no professional
option at all.

---

## 2. The problem

People do not know what is in the documents they have already agreed to, and they
find out when it is too late to matter.

The CFPB measured this directly: **"Over three quarters acknowledged they did not
know whether their credit card agreement contained an arbitration clause,"** and
fewer than 7% of those who had one understood it meant they could not sue in court
([CFPB 2015 Arbitration Study](https://www.consumerfinance.gov/about-us/newsroom/cfpb-study-finds-that-arbitration-agreements-limit-relief-for-consumers/)).

What that ignorance is worth: 56.2% of private-sector nonunion employees — over 60
million workers — are subject to forced arbitration; consumers win 9% of
arbitration disputes, while companies win relief 93% of the time when they
counterclaim, leaving consumers owing an average of $7,725
([Center for Justice & Democracy](https://centerjd.org/content/fact-sheet-forced-arbitration-clauses-and-class-actions-waivers-numbers)).

The reader's own voice, from someone with every advantage — a software
professional, evaluating a major-tech offer, who read the document:

> "Noticed my Google offer letter has an arbitration clause. From reading through
> it, it seems like it is basically signing away my right to a trial / legal
> processes vs Google. This made me pretty uncomfortable..."
>
> — [Blind](https://www.teamblind.com/post/arbitration-clause-in-google-offer-aykxed3z)

This is the shape of the problem worth solving. He read the contract. He found the
clause. He still needed help understanding what it did to him. The failure is not
that people don't read; it is that reading is insufficient.

Second, and separately measured: getting out is harder than getting in. FTC
complaints about negative-option and subscription billing rose from 42 per day in
2021 to nearly 70 per day in 2024, which drove the federal click-to-cancel
rulemaking
([FTC via Consumer Finance Monitor](https://www.consumerfinancemonitor.com/2024/10/22/ftc-issues-final-click-to-cancel-rule-to-make-it-easier-for-consumers-to-cancel-enrollment-in-negative-option-programs/)).

---

## 3. What the first version does

1. **Accepts a document as pasted text or a PDF with a text layer.** Parsed in the
   browser; only the extracted text is stored. Photographs and scans are refused,
   with the reason shown, not silently failed (ADR 0006).
2. **Reports completeness on every analysis** — how much of a document the system
   believes it received.
3. **Produces a plain-English summary** of what the document is and what accepting
   it commits the reader to.
4. **Flags seven clause types** (§5), each carrying: the exact source sentence
   quoted verbatim, a severity, a confidence, a consequence, and any exit or
   opt-out the document itself grants.
5. **States consequences in two tiers.** The document-grounded claim leads and
   carries its source sentence. External context — a regulator's finding, a
   statistic — sits beneath it, marked as outside the document, with its own
   citation (ADR 0007).
6. **Ranks flags by leverage lost** — how much of the reader's ability to sue, to
   leave, or to refuse a change the clause removes (ADR 0003).
7. **Accepts an editable list of the reader's red lines**, which promote matching
   clauses in the ranking and mark them as hitting something the reader named. Red
   lines rank; they do not block or veto (ADR 0008).
8. **Answers questions about the document, from the document only**, with the same
   source-sentence citation as any flag. A question the document cannot answer is
   refused, not guessed at.
9. **Reports genuinely clean documents as clean**, together with the list of what
   was checked. An empty result is indistinguishable from a failed parse, so the
   checked-list is what makes "clean" mean anything (ADR 0004).
10. **Saves past documents to a library** the reader can return to.
11. **States that it is jurisdiction-neutral.** It describes what a clause says and
    does; it never asserts whether the clause is enforceable where the reader lives
    (ADR 0005).

Nothing beyond this list. See §7.

---

## 4. What good looks like

The analysis is only worth building if it can be shown to be trustworthy. These
are the tests. Thresholds marked *(proposed)* need calibrating against a real
corpus before they mean anything; the test shapes do not.

**Citation integrity — pass/fail, no threshold.**
Every rendered flag's quoted sentence appears verbatim in the stored text. This is
checked in code against the stored text before render, not asked of the model
(ADR 0001). A single flag that cannot show its source sentence is a bug that
blocks release, not a quality metric.

**Recall on planted clauses.** Against a labelled corpus of real documents with a
known clause inventory, what fraction of the seven types does the system find?
Recall matters more than precision here, because the error bias is deliberately
toward over-flagging (ADR 0004). *(Proposed: ≥95% recall on the four
regulator-evidenced types; ≥80% on the other three.)*

**Precision at high severity.** Over-flagging is acceptable only if the excess
lands low. Of flags rendered at the top severity band, what fraction survive
review by someone reading the source sentence? *(Proposed: ≥90%.)*

**Ranking behaves as specified.** On a document containing both an arbitration
clause and a merely unusual one, arbitration ranks higher. This is the
leverage-lost criterion made testable, and it is the specific thing a
deviation-from-norm ranking would get wrong (ADR 0003).

**Clean documents stay clean.** Against a benign corpus, the system produces a
clean verdict with a checked-list, and zero high-severity flags. A tool that
manufactures a low-severity finding to look useful has failed this test even
though nothing it said was false.

**Truncation is detected.** A document truncated at 40% produces a completeness
reading that visibly differs from the same document intact. This is the failure a
reader cannot see for themselves, so it is the one the system must catch.

**Q&A refuses what it cannot ground.** Against a set of questions whose answers
are absent from the document, the system declines rather than answers.
*(Proposed: 100% refusal; any answer to an ungrounded question is a defect of the
same class as a missing citation.)*

**External context resolves.** Every external claim rendered under a consequence
carries a citation that resolves to a real source stating that fact. We own this
accuracy in a way we do not own the document's (ADR 0007).

---

## 5. Which clauses are flagged, how severely, and why

Seven types (ADR 0004). Severity runs on leverage lost: how much of the reader's
ability to sue, to leave, or to refuse a change the clause takes away (ADR 0003).

**The type sets a baseline band; the instance's actual terms move it.** A
seven-day cancellation window and a ninety-day one are the same clause type at
different severities. This matters for testing: severity is a property of the
clause as written, not a lookup on its category.

### Critical — removes a lever outright

**Mandatory arbitration and class-action waiver.** You keep the contract and lose
the remedy. Ranks first not because it is unusual but because it is ubiquitous and
still costs you everything: consumers win 9% of arbitrations, and three quarters
of people don't know they have one. Ubiquity is not safety — a ranking based on
how unusual a clause is would bury this, which is precisely why we don't use one.

**Unilateral modification.** They may change the terms later without your
agreement. This is the clause that makes every other clause provisional: the
document you read is not the document you are bound by. Ranked here on reasoning
rather than on complaint volume — the research measured auto-renewal and
arbitration directly, but not this.

**Non-compete and restrictive covenants.** Takes your ability to earn in your
field after you leave. The FTC estimated its 2024 rule would affect ~30 million
workers, about 18% of the US workforce; a federal court blocked that rule in
August 2024, so the clause remains largely unregulated federally
([FTC](https://www.ftc.gov/news-events/news/press-releases/2024/04/ftc-announces-rule-banning-noncompetes)).
In this segment it appears in offer letters, and it is rarely labelled
"non-compete" — usually folded into "Restrictive Covenants" or "Post-Termination
Obligations," with scope defined in a cross-referenced exhibit.

### High — removes a lever, with a deadline or a cost attached

**Auto-renewal and negative-option billing.** You can leave, but only if you act
inside a window you probably didn't see. The cancellation trigger is typically one
date-math sentence in a "Billing" or "Term" section, and the mechanism is often
deferred to a portal the contract doesn't describe. Complaint volume rose 67% in
three years and produced multi-state settlements (HelloFresh $7.5M; TFG Holding
$4.8M across 33 states).

**Limitation of liability.** They owe you almost nothing when they fail. Caps are
usually expressed by cross-reference — "fees paid in the preceding 12 months" —
rather than as a number, so the reader cannot see the size of what they gave up
without doing arithmetic.

**Indemnification.** You may owe them for claims brought by third parties. Rarely
triggered for a consumer and catastrophic when it is. Whether the obligation is
mutual, and whether carve-outs exist, requires a market baseline a non-lawyer does
not have.

### Moderate — costs money, lever intact

**Fee escalators and late fees.** You can still leave; you just pay more than you
expected to. Credit card late fees alone run $14 billion a year across more than
45 million people
([CFPB](https://www.consumerfinance.gov/about-us/newsroom/cfpb-bans-excessive-credit-card-late-fees-lowers-typical-fee-from-32-to-8/)).
The figure is often cross-referenced to a separate fee schedule, and escalator
language requires multi-year compounding to see the real cost.

**Evidence quality is not uniform across these seven.** Arbitration, auto-renewal,
fee escalators and non-competes rest on federal regulatory measurement. Limitation
of liability and indemnity rest on WorldCC data measuring how often *lawyers*
negotiate a term — a proxy for commercial friction, not for consumer harm.
Unilateral modification rests on reasoning alone. Flag quality should be expected
to track this, and §4's recall targets are set accordingly.

---

## 6. The calls made, and what was given up

| Choice | Chosen against | Who is worse off |
|---|---|---|
| Consumers on adhesion contracts (ADR 0002) | Freelancers and small businesses | Freelancers and SMBs — the segments with the only real willingness-to-pay evidence — get nothing. Counter-offer drafting died with this choice. |
| Adhesion documents only (ADR 0002) | Negotiable contracts | Anyone holding a document they could actually change. We serve the reader who has the least power and therefore the fewest options. |
| Before signing (ADR 0002) | After signing | Everyone who already signed — a far larger group, and the source of most of the vivid pain in the research, including the timeshare buyer sued after cancelling within 12 hours. |
| All seven clause types (ADR 0004) | The four with regulator evidence | Nobody directly, but flag quality is uneven and three types carry weaker backing. A reader cannot tell which is which. |
| Over-flag, excess at low severity (ADR 0004) | Under-flagging | Readers who skim. Lists get longer, and a long list trains people to stop reading it — the same failure that makes a document unread in the first place. |
| Rank by leverage lost (ADR 0003) | Rank by deviation from norm | Readers who want to know "is this contract weird?" They get standard-but-harmful clauses at the top instead, which will read as noise to some. |
| Confidence score, no verdict (ADR 0007) | An explicit sign/don't-sign call | Readers who want to be told what to do — probably the majority. They now hold four signals (severity, confidence, completeness, red-line match) with no stated rule for combining them. |
| Jurisdiction-neutral (ADR 0005) | State-aware analysis | A reader in California gets a non-compete flagged at critical severity when it may bind nobody. The cost lands at the exact point readers most want an answer. |
| Paste and text-layer PDF only (ADR 0006) | Photos, OCR, URL fetch | Anyone handed paper at a gym counter — a document type central to the segment we chose. The refusal reaches them at the moment they most need help. |
| Completeness shown, not enforced (ADR 0006) | Withholding the clean verdict on partial text | Readers who paste half a document and receive a clean verdict sitting next to a low completeness reading. The indicator is passive; it informs, it does not prevent. |
| Red lines rank (ADR 0008) | Red lines block | Readers who wanted a hard stop on terms they declared unacceptable. |
| Two-tier consequences (ADR 0007) | Blending document and external facts into one voice | Nobody, in output quality. It costs interface complexity, and it makes the accuracy of every external fact our liability rather than the document's. |

---

## 7. What we are not building, and why

**Counter-offer drafting.** Cut. You cannot counter-offer a gym membership. The
feature assumed a negotiation that does not exist for this reader (ADR 0002).

**A sign/don't-sign verdict.** The most useful thing we could say, and not in the
document. It is also the exact shape of claim the FTC fined DoNotPay $193,000 for
making — the company never tested whether its output matched a lawyer's and never
retained attorneys to verify quality
([FTC](https://www.ftc.gov/news-events/news/press-releases/2025/02/ftc-finalizes-order-donotpay-prohibits-deceptive-ai-lawyer-claims-imposes-monetary-relief-requires)).

**OCR and photographed documents.** A citation into misread text is worse than no
citation, because it looks identical to a correct one. Excluded on purpose;
excluding it is what makes the citation guarantee meaningful.

**Any claim about enforceability.** Not in the document, varies by state, and
asserting it moves liability from the document onto us (ADR 0005).

**Statutory exit rights.** Same reason. We report the deadlines and opt-outs the
document grants; we do not tell a Californian about California's cancellation law,
even though they have it (ADR 0007).

**Payments, billing, and sharing a document between users.** From `CLAUDE.md`.
This version exists to establish that the analysis can be trusted, and none of
these make it more trustworthy.

**DOCX.** Not settled as needed. Adding it is a dependency decision, not a
formality.

---

## 8. What the research could not tell us

These are gaps, not findings. Each is a reason to be less confident, and none of
them were resolved by choosing a direction.

**Nobody was found who would pay for this.** Four targeted searches produced no
verbatim statement from any consumer about what they would pay, or what they
consider too expensive, for having a document explained. Every price in the
research is *revealed from the supply side* — what vendors charge — never stated
from the demand side. Specifically: no source showed a consumer paying to have a
terms of service explained. This is the single largest unknown in the brief, and
it sits underneath the segment we chose.

**The pain evidence is the weakest leg.** Reddit — the primary source class the
research was directed at, and where this pain is most likely discussed — was
hard-blocked at the tool level for every agent that tried it. Five of Agent 1's
seven findings trace to a single vendor marketing blog with a commercial interest
in the conclusion. What we have is strong *regulatory* evidence that the harm
exists at scale, and weak *first-person* evidence that people experience it as a
problem they want solved. Those are different claims and only one of them is
established.

**Two clause types have no supporting evidence at all.** IP assignment /
work-for-hire and personal guarantees produced no sourced frequency or harm data
within budget. Both are plausible; neither is evidenced. Exclusivity, data
licensing in ToS, and unilateral modification outside auto-renewal were not
searched. Unilateral modification is nonetheless ranked Critical in §5 on reasoning
alone — that is a judgement, and it is flagged as one.

**"Nobody has built this" rests on partial coverage.** Ironclad, Evisort, Harvey,
DocJuris, Diligen and Lexion were named but never individually verified inside the
search budget. No product reviewed markets exact-source-sentence citation as a
named feature, which is the most defensible thing in this concept — but absence of
evidence here is not evidence of absence.

**Free incumbents may make pricing impossible.** Rocket Lawyer's AI contract review
is free and exists to sell a subscription. LegalZoom bundles two free reviews into
its base plan. ToS;DR is free for platform terms. ChatGPT is free. When
well-capitalised incumbents treat this as customer acquisition, standalone pricing
is hard — and no evidence was found that this segment pays for anything adjacent.

### Open questions this brief does not resolve

- **How a lay reader combines four signals.** Severity, confidence, completeness,
  and red-line match all compete for the same attention with no stated hierarchy
  (ADRs 0003, 0006, 0007).
- **Whether low completeness should suppress the clean verdict.** Currently it does
  not. This is the failure a reader cannot detect for themselves (ADR 0006).
- **Which OpenRouter model, and whether a Supabase project exists.** Both still
  marked stop-and-ask in `CLAUDE.md`.
