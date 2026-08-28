# 1. Every flag cites its source

## Decision

Every risk flag carries the exact sentence that produced it, quoted verbatim and
shown to the reader — as do counter-offers and question-box answers. A flag whose
source cannot be shown is dropped before render and logged as a bug.

## Alternatives

- **Describe risks in the model's own words, quoting nothing.** Cheapest, reads
  best. Rejected: nothing for the reader to check; a confident error looks real.
- **Cite clause numbers ("see §7.2").** Rejected: contracts arrive unnumbered or
  misnumbered, and it sends the reader hunting through the document for us.
- **Store a character range, display no text.** Rejected: nobody can verify what
  they cannot see.
- **Quote the whole clause.** Rejected as default: length hides which words create
  the risk. Expanding to clause context on request stays compatible.

## Why

A reader who knows no law can hold the flag against the sentence and judge it in
seconds. It bounds the worst failure too: a fabricated risk has no matching
sentence, so the check catches it before display rather than after someone acts on
it. That is the visible difference from a general chatbot (69–88% deviation from
established legal facts, per a Stanford-affiliated study) and from DoNotPay, fined
$193,000 by the FTC for capability claims it never tested.

## Consequences

- We cannot flag what the document does not say: missing terms (no late-fee clause,
  no kill fee) have nothing to cite. Separate treatment or out of scope — per PRD.
- Verification is code, not prompting: the model returns spans, each checked
  against the stored text before render.
- Browser parsing must preserve exact characters and offsets; lossy normalisation
  breaks verification silently, and this reinforces excluding OCR.
- Tests assert every rendered quote appears verbatim in source. "Flags were
  produced" is not a passing test.
- Costs recall: multi-clause risk may go unflagged for want of one citable sentence.
