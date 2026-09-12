/**
 * The extraction seam: what goes in, and what comes out.
 *
 * This is the first of the four seams in the spec. Input goes in; the extracted
 * text, the kind of source it came from, and a completeness assessment come
 * out. Nothing downstream needs to know how the text arrived beyond
 * `sourceKind`.
 *
 * Two things about these types are deliberate, because ticket 03 adds PDF input
 * behind this same seam and must not have to break them:
 *
 * 1. `Extraction` is a discriminated union with a rejection arm from the start.
 *    A PDF that is a scan, or has no text layer, is refused with a
 *    machine-readable reason rather than returning empty text. The reason codes
 *    that refusal needs are ticket 03's to add.
 * 2. `SourceKind`, `ExtractionInput` and `ExtractionRejectionReason` are unions
 *    meant to gain members, not to be replaced.
 */

import type { CompletenessAssessment } from "./completeness";

/** Where a document's text came from. Ticket 03 adds its PDF member here. */
export type SourceKind = "pasted";

/** What the seam was handed. Ticket 03 adds its PDF member here. */
export type ExtractionInput = {
  readonly kind: "pasted-text";
  /** Exactly what the reader pasted. Never normalised on the way in or out. */
  readonly text: string;
};

/**
 * Why the seam had nothing to hand on.
 *
 * `nothing-to-read` is the only reason pasted text can produce: the box held
 * no text, or held only whitespace. Returning a document with empty text would
 * mean every screen downstream renders an empty analysis of nothing, so the
 * seam says so instead. Ticket 03 adds the reasons a PDF can be refused for.
 */
export type ExtractionRejectionReason = "nothing-to-read";

/** A document that came through extraction, with what is known about it. */
export type ExtractedDocument = {
  /** The extracted text, character for character as it arrived. */
  readonly text: string;
  /** Unicode code points in `text`, which is what a reader counts. */
  readonly characterCount: number;
  readonly sourceKind: SourceKind;
  readonly completeness: CompletenessAssessment;
};

/** What extraction returns: a document, or the reason there is none. */
export type Extraction =
  | { readonly outcome: "extracted"; readonly document: ExtractedDocument }
  | { readonly outcome: "rejected"; readonly reason: ExtractionRejectionReason };

export type {
  CompletenessAssessment,
  CompletenessLevel,
  CompletenessSignal,
  CompletenessSignalCode,
} from "./completeness";
