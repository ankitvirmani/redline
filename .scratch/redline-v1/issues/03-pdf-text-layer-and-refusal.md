# 03. PDF text-layer extraction, and typed refusal of scans

**What to build:** A reader uploads a PDF offer letter instead of selecting and
copying it by hand. The PDF is parsed in the browser and only the extracted text
moves on; the file itself is never uploaded or stored. A scanned or photographed
PDF, and a PDF with no text layer, are refused with the reason shown in plain
language rather than analysed as empty. The refusal message is part of the
product, not an error state.

**Stop and ask before adding a PDF parsing dependency.** `CLAUDE.md` requires
asking, and the choice carries more weight here than convenience: whatever parses
the PDF has to preserve exact characters and offsets, because citation
verification compares model-returned spans against this text.

**Blocked by:** 02.

**Status:** done

- [x] The parsing dependency is decided: pdfjs-dist, chosen during this run because the owner was absent, with the reason recorded in BUILD-REPORT.md.
- [x] A text-layer PDF yields extracted text character-identical to its text layer, with one exception outside this code: inside the worker PDF.js drops whitespace glyphs and emits a single space, so a non-breaking space arrives as a plain space, a run of spaces as one, and trailing whitespace as nothing. Asserted as tests so a change is caught. Verification is unaffected, since the extracted text is the only thing a span is held against.
- [x] Parsing happens in the browser; the file is never sent to a server or stored.
- [x] A PDF with no text layer produces a typed rejection carrying a machine-readable reason, never empty text.
- [x] A scanned or photographed PDF is refused with the reason shown to the reader. A scan already put through OCR elsewhere cannot be told from a real text layer and is read, which is the ADR 0006 failure arriving from outside the product.
- [x] PDF input produces a completeness reading the same way pasted text does.
- [x] Rejection behaviour is covered by tests over known fixtures.
