/**
 * What Redline says when it has no document to read.
 *
 * Product copy, not error chrome (ADR 0006). Nothing here is red, nothing carries a
 * warning mark, and nothing calls itself an error. A reader whose offer letter is a
 * photograph did nothing wrong; they were sent a photograph.
 *
 * Every sentence does the same three jobs: what happened, why Redline stops there,
 * and what the reader can do now, which is paste the text if they have it. None of
 * them promises OCR. OCR is excluded on purpose, and "not supported yet" would
 * imply a plan that does not exist.
 *
 * A `Record` keyed by the reason code, so a reason with no sentence is a type error
 * rather than a screen that says nothing. `tests/pdf-extraction.test.ts` walks
 * `EXTRACTION_REJECTION_REASONS` and checks this covers all of it.
 *
 * Vocabulary is `CONTEXT.md`: document, never file or upload.
 */

import type { ExtractionRejectionReason } from "@/src/extraction";

export const REFUSAL_SAYS: Readonly<Record<ExtractionRejectionReason, string>> = {
  "nothing-to-read": "The box is empty. Paste a document first.",

  "pdf-unreadable":
    "Redline could not open that PDF. It is either damaged or not a PDF at all. Paste the text into the box if you can get at it.",

  "pdf-needs-a-password":
    "That PDF is locked, and Redline has no password to open it with. Open it yourself, then paste the text into the box.",

  "pdf-has-no-text-layer":
    "There is no text in that PDF for Redline to read, only blank pages. If you can see the words somewhere on screen, paste them into the box and Redline will read those.",

  "pdf-is-images":
    "That document is a picture of a page, not text. Every flag Redline raises quotes the sentence it came from, and there is nothing here it could quote. It will not make one up, so it has stopped. Paste the text in if you can get at it.",
};
