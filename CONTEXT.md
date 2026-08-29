# Redline

Redline reads a document someone is about to sign and tells them what signing
costs them. This file is the project's glossary — the words we use and the ones
we deliberately avoid. It holds no implementation detail.

## Language

**Document**:
The contract, lease, agreement, or terms of service a reader uploads for analysis.
_Avoid_: file, upload, contract (too narrow — a ToS is not a contract in casual speech)

**Adhesion contract**:
A document offered take-it-or-leave-it, where the reader may accept or walk away
but cannot change the terms. v1 reads only these.
_Avoid_: standard contract, boilerplate, consumer contract

**Reader**:
The person who uploads a document and is deciding whether to sign it. Not a lawyer.
_Avoid_: user, customer, client, consumer

**Flag**:
One identified risk in a document, carrying a severity and the source sentence it
was drawn from.
_Avoid_: issue, finding, alert, risk (unqualified)

**Source sentence**:
The exact sentence from the document that a flag was drawn from, quoted verbatim.
A flag that cannot show one is a bug, not a formatting gap (ADR 0001).
_Avoid_: citation, excerpt, quote, reference

**Red line**:
A condition the reader has declared unacceptable in advance, which the analysis
checks each document against.
_Avoid_: preference, rule, filter, criterion

**Severity**:
A flag's position in the ranking, set by how much leverage the clause removes.
_Avoid_: priority, risk level, importance

**Leverage**:
What a reader would otherwise be able to do — sue, leave, or refuse a change.
Its loss is what makes a clause dangerous rather than merely unusual.
_Avoid_: power, rights, protection

**Confidence**:
How sure the analysis is that a flag is correctly identified. Distinct from
severity: how sure we are, versus how much it costs.
_Avoid_: certainty, accuracy, score

**Completeness**:
How much of a document the analysis believes it received. Shown on every
analysis, because a clean result over partial text is the failure a reader
cannot see.
_Avoid_: coverage, quality, parse rate

**Clean document**:
A document in which no flag met the bar. Reported together with the list of what
was checked — never as an empty result, which reads as a failure.
_Avoid_: safe, passed, no issues

**Consequence**:
What a flagged clause does to the reader, stated from the clause's own text.
_Avoid_: impact, effect, risk, implication

**External context**:
A fact from outside the document — a regulator's finding, a statistic — shown
beneath a consequence, marked as outside it and carrying its own source.
_Avoid_: background, supporting evidence, research
