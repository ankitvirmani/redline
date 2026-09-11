# 04. Analysis seam: flags whose source sentence is verified in code

**What to build:** A reader submits a document and sees the clauses that could
hurt them, each showing the exact sentence it was drawn from, quoted verbatim,
with a severity and a confidence. Flags are unordered at this stage; ordering is
ticket 06.

The model returns spans. Code checks each span against the stored extracted text.
A flag whose span does not match verbatim is dropped before analysis returns and
logged as a defect. No render path can display an unverifiable flag because one
never leaves the seam. Verification is code, not prompting, so it cannot degrade
when the model or the prompt changes (ADR 0001).

Severity is assigned here rather than at ranking, because it is a property of the
clause as written. The clause type sets a baseline band and the instance's own
terms move it: a seven-day cancellation window and a ninety-day one are the same
type at different severities. Assigning it here is what lets ranking stay
model-free.

The model client is injected so tests supply a stub. The model identifier is read
from one environment variable and never hardcoded.

**Blocked by:** 02.

**Status:** ready-for-agent

- [ ] Analysis returns an unordered set of flags, each carrying a source sentence, clause type, severity and confidence.
- [ ] Every returned flag's source sentence appears verbatim in the extracted text, asserted programmatically over every fixture rather than sampled.
- [ ] A stubbed model returning an unmatchable span produces zero flags and a logged defect.
- [ ] Severity responds to the terms of the clause instance, not only to its type.
- [ ] The model client is injected; the deterministic suite uses a stub and makes no network call.
- [ ] The model identifier is read from a single environment variable and appears nowhere in committed source.
- [ ] All seven clause types from the brief can be represented.
