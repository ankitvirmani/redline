# 07. Clean document reported clean, with the list of what was checked

**What to build:** A document where no flag met the bar reads as clean, together
with the list of clause types that were checked. An empty screen is
indistinguishable from a failed parse, so the checked-list is the thing that makes
"clean" mean anything (ADR 0004).

Nothing is invented to look useful. A tool that manufactures a low-severity
finding on a benign document has failed even though nothing it said was false.

A low completeness reading is shown next to a clean result and does not suppress
it. Whether it should is open and recorded under ADR 0006; this ticket implements
the recorded behaviour, it does not resolve the question.

**Blocked by:** 06.

**Status:** ready-for-agent

- [ ] An empty flag set yields a clean-document determination, never a blank result.
- [ ] The clean result names every clause type that was checked.
- [ ] A benign corpus fixture produces zero flags at top severity and no invented finding.
- [ ] A clean result is visibly distinguishable from a refused or failed analysis.
- [ ] A low completeness reading appears beside a clean result without suppressing it.
- [ ] The determination is made in the ranking seam, model-free, and tested there.
