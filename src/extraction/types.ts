/**
 * The extraction seam: what goes in, and what comes out.
 *
 * This is the first of the four seams in the spec. Input goes in; the extracted
 * text, the kind of source it came from, and a completeness assessment come
 * out. Nothing downstream needs to know how the text arrived beyond
 * `sourceKind`.
 *
 * Two things about these types were deliberate, because ticket 03 added PDF input
 * behind this same seam without breaking them:
 *
 * 1. `Extraction` is a discriminated union with a rejection arm from the start.
 *    A PDF that is a scan, or has no text layer, is refused with a
 *    machine-readable reason rather than returning empty text.
 * 2. `SourceKind`, `ExtractionInput` and `ExtractionRejectionReason` are unions
 *    meant to gain members, not to be replaced. All three have now gained one.
 */

import type { CompletenessAssessment } from "./completeness";

/**
 * Where a document's text came from. The one thing about extraction that anything
 * downstream is allowed to learn.
 */
export type SourceKind = "pasted" | "pdf";

/**
 * What the seam was handed.
 *
 * The PDF arm carries bytes, not a `File` and not a path, because the seam has no
 * business knowing where the bytes came from and because a `File` would tie the
 * seam to a browser. Whoever holds the bytes read them; the seam reads the text.
 */
export type ExtractionInput =
  | {
      readonly kind: "pasted-text";
      /** Exactly what the reader pasted. Never normalised on the way in or out. */
      readonly text: string;
    }
  | {
      readonly kind: "pdf";
      /** The PDF, byte for byte. Read in the browser; never sent anywhere. */
      readonly bytes: Uint8Array;
    };

/**
 * Why the seam had nothing to hand on. A reason a machine can branch on, and every
 * one of them has a sentence a reader can read in `components/refusal-view.ts`.
 *
 * Written as an array as well as a union so that the copy for a new reason cannot
 * be forgotten: the test walks this list and fails if any code has no sentence.
 *
 * - `nothing-to-read`: the paste box held no text, or held only whitespace.
 *   Returning a document with empty text would mean every screen downstream
 *   renders an empty analysis of nothing, so the seam says so instead.
 * - `pdf-unreadable`: the bytes are not a PDF, or are damaged past reading.
 * - `pdf-needs-a-password`: the PDF is locked, and Redline has no password to
 *   try. The parser says this one apart from every other failure itself.
 * - `pdf-has-no-text-layer`: the PDF read cleanly and no page gave up any text,
 *   and no page paints an image either. There is nothing in it to read.
 * - `pdf-is-images`: no page gave up any text and at least one page paints an
 *   image. A scan or a photograph. See `src/extraction/pdf.ts` for what this
 *   signal can and cannot tell apart.
 */
export const EXTRACTION_REJECTION_REASONS = [
  "nothing-to-read",
  "pdf-unreadable",
  "pdf-needs-a-password",
  "pdf-has-no-text-layer",
  "pdf-is-images",
] as const;

export type ExtractionRejectionReason = (typeof EXTRACTION_REJECTION_REASONS)[number];

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
