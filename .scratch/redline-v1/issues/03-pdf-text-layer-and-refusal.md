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

**Status:** ready-for-agent

- [ ] The owner has approved the parsing dependency before it is added.
- [ ] A text-layer PDF yields extracted text character-identical to its text layer.
- [ ] Parsing happens in the browser; the file is never sent to a server or stored.
- [ ] A PDF with no text layer produces a typed rejection carrying a machine-readable reason, never empty text.
- [ ] A scanned or photographed PDF is refused with the reason shown to the reader.
- [ ] PDF input produces a completeness reading the same way pasted text does.
- [ ] Rejection behaviour is covered by tests over known fixtures.
