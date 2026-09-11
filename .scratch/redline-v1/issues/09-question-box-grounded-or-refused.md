# 09. Question box: an answer grounded in the document, or a refusal

**What to build:** The reader asks a question about the document in their own
words and pursues what worries them rather than what was flagged. An answerable
question returns an answer with the sentence it came from, quoted verbatim, so
answers are as checkable as flags. A question the document cannot answer is
refused, not guessed at.

The answer's source sentence runs through the same verification code as a flag's.
An answer to an ungrounded question is a defect of the same class as a missing
citation, not a quality shortfall.

**Blocked by:** 04.

**Status:** ready-for-agent

- [ ] The reader can ask a free-text question about the analysed document.
- [ ] An answerable question returns an answer plus its source sentence, quoted verbatim.
- [ ] The answer's source sentence is verified against the stored text by the same code path a flag uses; an unverifiable answer is not shown.
- [ ] A question the document cannot answer is refused, and the refusal says the document does not address it.
- [ ] No answer draws on anything outside the document.
- [ ] Both the answer path and the refusal path are covered by deterministic tests with a stubbed client.
