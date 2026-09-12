/**
 * Seam 1: extraction.
 *
 * One function out of this file, plus the types. Call `extract`, get back either
 * a document, with its text, its source kind and its completeness reading, or
 * the reason there is no document to read. Nothing downstream branches on how
 * the text arrived; that is what `sourceKind` is for.
 *
 * Losslessness is the load-bearing property here. The text that comes out is
 * character-identical to the text that went in: no trim, not even of the edges,
 * no whitespace collapse, no smart-quote, ligature or dash normalisation, no
 * line-ending rewrite, and no `normalize()` of any form. Everything downstream
 * compares a model's spans against this text, so any normalisation breaks every
 * citation silently (ADR 0001). That is the failure this seam exists to prevent.
 *
 * `extract` is asynchronous because ticket 03 parses PDFs behind this same seam
 * and parsing a PDF is asynchronous. Making it so now means ticket 03 adds a
 * member to `ExtractionInput` rather than changing the signature of every caller.
 */

import { readBackPastedText } from "@/src/domain/text";

import { assessCompleteness } from "./completeness";
import type { Extraction, ExtractionInput } from "./types";

export type {
  CompletenessAssessment,
  CompletenessLevel,
  CompletenessSignal,
  CompletenessSignalCode,
  ExtractedDocument,
  Extraction,
  ExtractionInput,
  ExtractionRejectionReason,
  SourceKind,
} from "./types";

/**
 * Pasted text in, a document out.
 *
 * An empty box, or a box holding only whitespace, is refused rather than passed
 * on as a document with empty text. A document of nothing would be analysed,
 * summarised and read as clean, and the reader would have no way to see that
 * there was never anything there. Whitespace inside a document, including the
 * trailing kind, is part of the document and survives untouched; a box that is
 * nothing but whitespace is an empty box.
 */
function extractPastedText(text: string): Extraction {
  const readBack = readBackPastedText(text);
  if (readBack.kind === "nothing-pasted") {
    return { outcome: "rejected", reason: "nothing-to-read" };
  }
  return {
    outcome: "extracted",
    document: {
      text: readBack.document.text,
      characterCount: readBack.document.characterCount,
      sourceKind: "pasted",
      completeness: assessCompleteness(readBack.document.text),
    },
  };
}

/** The seam. Everything that needs a document's text goes through here. */
export async function extract(input: ExtractionInput): Promise<Extraction> {
  switch (input.kind) {
    case "pasted-text":
      return extractPastedText(input.text);
  }
}
