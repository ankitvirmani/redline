# 05. Plain-English summary of what accepting the document commits the reader to

**What to build:** Above the flags, the reader gets a plain-English account of
what the document is and what accepting it commits them to, so they can orient
before reading detail.

It states only what the document supports. It does not tell the reader whether to
sign, in words or by implication. That verdict is out of scope on purpose: it is
not in the document, and it is the shape of claim the FTC fined DoNotPay for
(ADR 0007).

**Blocked by:** 04.

**Status:** done

- [x] Every analysis returns a summary of what the document is and what accepting it commits the reader to.
- [~] The summary states only what the document supports. Prompt-constrained, plus a code check that every figure it states appears in the document. Groundedness of the prose itself is not checkable the way a flag's span is, and is not claimed.
- [~] No sign or don't-sign recommendation appears, explicit or implied. Explicit wording is blocked in code by 44 patterns in four kinds, and a hit fails the analysis. Implied verdicts, reached through emphasis, ordering, omission or an unlisted phrasing, are not blocked. Recorded rather than claimed.
- [x] The summary is shown above the flags.
- [x] Covered by tests against a stubbed model.
