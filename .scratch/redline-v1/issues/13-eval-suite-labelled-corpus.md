# 13. Tier-two eval suite over a labelled corpus

**What to build:** The suite `PRD.md` §4 was written to be measured by. It runs
deliberately against a real model over a labelled corpus of real documents with a
known clause inventory, and reports recall on planted clauses and precision at top
severity. It stays separate from the deterministic suite so every commit is
checked without paying for inference.

Recall matters more than precision here, because the error bias is deliberately
toward over-flagging. Report recall separately for the four regulator-evidenced
clause types and the other three, whose evidence is weaker and whose flag quality
should not be expected to match.

The thresholds in `PRD.md` §4 are proposed and mean nothing until calibrated
against the corpus. Report the numbers. Do not treat the proposed figures as
pass/fail yet.

**Blocked by:** 10, 06.

**Status:** done

- [x] A labelled corpus exists, with a known clause inventory per document. Nine documents, forty planted clauses. Seven were written for this suite rather than collected, each manifest entry carries its provenance, and the recall figures should be read as an upper bound.
- [x] The suite reports recall per clause type, separating the four regulator-evidenced types from the other three.
- [x] The suite reports precision at the top severity band, labelled as a proxy for the human review PRD.md describes rather than as that review. Every top-band flag is printed with its source sentence so the real review can be done by reading the output.
- [x] The suite runs on command and never as part of the commit suite.
- [x] Citation integrity is checked across the whole corpus as pass/fail: every rendered quote appears verbatim, and any failure blocks release.
- [x] Ranking is asserted across the corpus: arbitration outranks a merely unusual clause.
- [x] Q&A refusal is measured against a set of questions whose answers are absent from the document.
- [x] Results are recorded so the proposed thresholds can be calibrated.
