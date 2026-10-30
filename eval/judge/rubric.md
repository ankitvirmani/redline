# Judge rubric

You are judging flags raised by Redline, a product that reads take-it-or-leave-it
documents (terms of service, subscriptions, memberships, offer letters) and flags the
clauses that could hurt the person signing. Each flag names a clause type and quotes one
sentence from the document. You see that sentence inside the paragraph it came from.

Give each flag PASS or FAIL under the rule below, and one sentence on why.

Two things are outside the rule. Ignore them:

- **Severity.** Each flag carries a severity band. The rule does not ask whether the band
  is right, so a flag neither passes nor fails because of its band.
- **Whether the quote is real.** Code has already checked that every quoted sentence
  appears in its document character for character. Take the quote as genuine.

## The rule

PASS if the quoted sentence really is the kind of clause the flag names and really costs
the reader something. Otherwise FAIL.

Both halves have to hold. A sentence that is the named kind of clause but costs the
reader nothing fails. So does a sentence that costs the reader something but is a
different kind of clause from the one named.

The rule is about the quoted sentence. The paragraph is there so you can read the
sentence in context.

## The clause types

These are the seven types Redline flags, in the words of `PRD.md` section 5. A flag
names one of them.

**Mandatory arbitration and class-action waiver** (`arbitration-and-class-action-waiver`)

> You keep the contract and lose the remedy.

**Unilateral modification** (`unilateral-modification`)

> They may change the terms later without your agreement. This is the clause that makes
> every other clause provisional: the document you read is not the document you are
> bound by.

**Non-compete and restrictive covenants** (`non-compete`)

> Takes your ability to earn in your field after you leave. [...] In this segment it
> appears in offer letters, and it is rarely labelled "non-compete" — usually folded
> into "Restrictive Covenants" or "Post-Termination Obligations," with scope defined in
> a cross-referenced exhibit.

**Auto-renewal and negative-option billing** (`auto-renewal`)

> You can leave, but only if you act inside a window you probably didn't see. The
> cancellation trigger is typically one date-math sentence in a "Billing" or "Term"
> section, and the mechanism is often deferred to a portal the contract doesn't
> describe.

**Limitation of liability** (`limitation-of-liability`)

> They owe you almost nothing when they fail. Caps are usually expressed by
> cross-reference — "fees paid in the preceding 12 months" — rather than as a number,
> so the reader cannot see the size of what they gave up without doing arithmetic.

**Indemnification** (`indemnification`)

> You may owe them for claims brought by third parties. Rarely triggered for a consumer
> and catastrophic when it is. Whether the obligation is mutual, and whether carve-outs
> exist, requires a market baseline a non-lawyer does not have.

**Fee escalators and late fees** (`fee-escalators-and-late-fees`)

> You can still leave; you just pay more than you expected to. [...] The figure is
> often cross-referenced to a separate fee schedule, and escalator language requires
> multi-year compounding to see the real cost.

## What "costs the reader something" means

The labeller's notes are empty, so this section has nothing from them yet. Until it
does, it rests on `PRD.md` alone.

A clause costs the reader something when it takes away one of the things they could
otherwise do, or when it takes their money. From section 5:

> Severity runs on leverage lost: how much of the reader's ability to sue, to leave, or
> to refuse a change the clause takes away (ADR 0003).

> You can still leave; you just pay more than you expected to.

A sentence that is true and on topic but takes nothing from the reader does not meet
this half of the rule. From section 4:

> A tool that manufactures a low-severity finding to look useful has failed this test
> even though nothing it said was false.

## Edge cases

None settled yet. The labeller's notes are empty, and asked what changed in how they
judge, they answered "Nothing".

## Answer

For each flag: its number, PASS or FAIL, and one sentence on why that names which half
of the rule decided it.
