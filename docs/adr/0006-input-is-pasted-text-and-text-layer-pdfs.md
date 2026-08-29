# 6. v1 accepts pasted text and text-layer PDFs only

A reader can paste text or upload a PDF that has a text layer. Photographs and
scanned documents are refused, with the reason given. Every analysis reports a
completeness indicator.

## Why

Choosing consumer adhesion contracts (ADR 0002) broke the original input model:
terms of service are web pages, subscription terms arrive in email, and gym
contracts are paper. Only offer letters reliably arrive as files. Pasting covers
the web and email cases with exact characters preserved, which is what ADR 0001's
verification depends on; a text-layer PDF covers the rest. OCR stays excluded
because a citation into misread text is worse than no citation.

## Consequences

- Paper contracts are out of scope, though they are central to the chosen segment.
  The refusal message is part of the product, not an error state.
- Completeness is a third signal alongside severity and confidence.
- **The indicator is passive.** It does not by itself prevent a clean verdict from
  being shown over partial text — it sits beside it. Whether low completeness
  should suppress the clean verdict is open, and the brief must resolve it.
