/**
 * The question seam: what goes in, and what comes out.
 *
 * Seam four of the four in the spec. Extracted text and a question in; an answer with
 * the sentence it came from, or a refusal, out.
 *
 * The union has four arms and they are four different things, because a consumer has
 * to be able to tell them apart without reading a word of copy:
 *
 * - `answered`. There is an answer and it can show the sentence it came from.
 * - `refused`. The document does not answer the question. This is not an error and
 *   not an empty answer: it is the product working. A reader asked a fair question
 *   and the text is silent, and saying so is the whole point of the seam.
 * - `not-asked`. Nothing was asked, so nothing was read and no model was called.
 * - `failed`. Something went wrong: no model configured, the model unreachable, or an
 *   answer that could not be shown. The shell has copy for each.
 *
 * Why `refused` and `failed` are separate arms rather than one with a reason field.
 * They are different claims about the world. A refusal says something true about the
 * document. A failure says nothing about the document at all, and a reader who is told
 * their contract is silent when in fact the model was down has been misled about the
 * thing they are about to sign. Collapsing the two would make that one field lookup
 * away from happening, and `PRD.md` section 4 puts an answer to an ungrounded question
 * in the same class as a missing citation.
 */

import type { SourceSentence } from "@/src/domain/verify";
import type { ExtractedDocument } from "@/src/extraction";
import type { ModelClient } from "@/src/model/client";

export type { SourceSentence } from "@/src/domain/verify";

/**
 * An answer, and the sentence in the document it came from.
 *
 * `sourceSentence` is a `SourceSentence`, which is the same type a flag carries and is
 * built by the same verifier (`src/domain/verify.ts`). Holding one means the sentence
 * has already been found in the stored text character for character, so no render path
 * can show an answer whose citation was never checked.
 */
export type GroundedAnswer = {
  /** What the document says, in answer to what was asked. */
  readonly text: string;
  readonly sourceSentence: SourceSentence;
};

/**
 * Why there is no answer from the document. Both mean the same thing to a reader and
 * are kept apart for the eval suite, which counts refusals the model declared
 * separately from refusals the code imposed over the model's claim.
 */
export const QUESTION_REFUSAL_REASONS = [
  /** The model reported that the document does not answer the question. */
  "the-document-does-not-address-it",
  /**
   * The model claimed an answer and named a sentence the document does not contain,
   * so the claim was discarded. The code's judgement beats the model's claim, which is
   * why this is a refusal rather than an answer with a missing quote (ADR 0001).
   */
  "the-sentence-is-not-in-the-document",
] as const;

export type QuestionRefusalReason = (typeof QUESTION_REFUSAL_REASONS)[number];

/** Why the seam had nothing to read. Meant to gain members. */
export const QUESTION_REJECTION_REASONS = [
  /** The box held no question, or held only whitespace. */
  "nothing-asked",
] as const;

export type QuestionRejectionReason = (typeof QUESTION_REJECTION_REASONS)[number];

/**
 * Why there is no reading of the question. Every one is a state the shell has copy
 * for, not error chrome. The three match the analysis seam's on purpose: the reader
 * meets one sentence for a model that is not configured, wherever they met it.
 */
export const QUESTION_FAILURE_REASONS = [
  "model-not-configured",
  "model-unavailable",
  /**
   * What came back could not be shown. The shape was wrong, the answer was empty or
   * far longer than an answer, or the answer claimed a law or a right (ADR 0005).
   * Deliberately not a refusal: a refusal asserts the document is silent, and an answer
   * that was thrown away for its wording is no evidence of that.
   */
  "model-response-rejected",
] as const;

export type QuestionFailureReason = (typeof QUESTION_FAILURE_REASONS)[number];

/** What the seam returns. */
export type QuestionReading =
  | { readonly outcome: "answered"; readonly answer: GroundedAnswer }
  | { readonly outcome: "refused"; readonly refusal: QuestionRefusalReason }
  | { readonly outcome: "not-asked"; readonly reason: QuestionRejectionReason }
  | { readonly outcome: "failed"; readonly reason: QuestionFailureReason };

/**
 * What the seam is handed. The whole extracted document rather than its text, so that
 * verification runs against the same characters extraction stored, exactly as at the
 * analysis seam. The model client is injected, which is what lets the deterministic
 * suite run with no key and no network.
 */
export type QuestionRequest = {
  readonly document: ExtractedDocument;
  /** What the reader typed, as they typed it. */
  readonly question: string;
  readonly model: ModelClient;
};
