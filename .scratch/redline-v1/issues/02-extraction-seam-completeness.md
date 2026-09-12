# 02. Extraction seam: pasted text with a completeness reading

**What to build:** Pasted text now passes through the extraction seam instead of
going straight to the screen. The seam returns the extracted text, the kind of
source it came from, and a completeness assessment: how much of the document the
system believes it received. The reader sees that reading on every analysis, so
they can tell a thorough result from one run on a fragment.

Completeness is assessed from structural signals only: text ending mid-sentence,
no closing or signature block, implausible length. Type-relative plausibility is
deferred, because it needs a document type that only analysis determines, and the
structural signals already catch the case that matters, a reader pasting part of
a page.

Completeness informs, it does not gate. A low reading sits beside the result and
suppresses nothing. That is a recorded gap under ADR 0006, not an oversight.

Extraction must be lossy-free. Everything downstream compares model-returned
spans against this text, so any normalisation breaks every citation silently.

**Blocked by:** 01.

**Status:** done

- [x] Extraction returns extracted text, source kind, and a completeness assessment.
- [x] Extracted text is character-identical to the input, with no normalisation of whitespace, quotes, ligatures or line breaks.
- [x] A document truncated at 40% produces a visibly different completeness reading from the same document intact.
- [x] The completeness reading is shown to the reader on every analysis.
- [x] A low completeness reading blocks and hides nothing.
- [x] Fidelity and truncation detection are covered by tests that make no model call.
