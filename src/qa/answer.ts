/**
 * Turning an answer payload into a grounded answer, or into a refusal.
 *
 * Pure: text and payload in, a reading and any defects out. It calls no model, touches
 * no log and reads no clock, which is what lets the behaviour that matters most on this
 * path be read in one file and tested directly.
 *
 * The rule, in the order it runs:
 *
 * 1. The model said it could not ground an answer. That is a refusal and the ordinary
 *    case. Nothing else is looked at, because there is nothing else in the payload.
 * 2. The answer is usable at all. Whitespace with a length, or something far longer
 *    than an answer, is not an answer. It is not shown, and it is not called a refusal
 *    either: the document has not been shown to be silent.
 * 3. The answer says nothing about a law or a right (`src/domain/wording.ts`, ADR 0005).
 *    An answer that does is not shown.
 * 4. The sentence is held against the document. Not found, character for character,
 *    means the answer is discarded and the question is refused. Nothing is repaired,
 *    re-anchored or searched for nearby.
 *
 * Step 4 is the one the ticket rests on, and the order it sits in is deliberate: the
 * model's claim that it found an answer is checked by code, and where the two disagree
 * the code wins. A model can say `grounded: true` and name a sentence it composed; the
 * reader is told their document does not answer the question, because as far as anything
 * checkable goes, it does not.
 *
 * Why an unverifiable sentence refuses rather than failing, where a wording claim fails
 * rather than refusing. A refusal says something about the document: nothing in it
 * answers this. An invented sentence is evidence for exactly that, and the brief for
 * this seam requires it. An answer thrown away for claiming a law is not: the document
 * may well answer the question, and the model simply wrapped the answer in a claim the
 * product does not make. Telling the reader their document is silent then would be a
 * false statement about the thing they are about to sign.
 */

import type { DefectReport } from "@/src/domain/defects";
import { verifiedSentence } from "@/src/domain/verify";
import { statutoryLanguageIn } from "@/src/domain/wording";

import type { ModelAnswerPayload } from "./schema";
import type { QuestionReading } from "./types";

/** Longer than this is not an answer to a question, it is a second document. */
export const ANSWER_CHARACTER_LIMIT = 1200;

/** What came of reading one payload against one document. */
export type AnswerReading = {
  readonly reading: QuestionReading;
  readonly defects: readonly DefectReport[];
};

/**
 * The question as it will be asked, or null where nothing was asked.
 *
 * Trimmed, because a question is prose a reader typed and the trailing newline a
 * keyboard leaves is not part of it. This is the one place in the product where text is
 * trimmed on the way to a model, and it is safe here because the question is never
 * verified against anything: the document is what has to stay untouched.
 */
export function questionAsked(question: string): string | null {
  const trimmed = question.trim();
  return trimmed.length === 0 ? null : trimmed;
}

/** One payload, read against one document. */
export function readAnswer(
  documentText: string,
  documentCharacterCount: number,
  payload: ModelAnswerPayload,
): AnswerReading {
  if (!payload.grounded || payload.answer === null || payload.sourceSentence === null) {
    return {
      reading: { outcome: "refused", refusal: "the-document-does-not-address-it" },
      defects: [],
    };
  }

  const answer = payload.answer.trim();
  if (answer.length === 0 || answer.length > ANSWER_CHARACTER_LIMIT) {
    return {
      reading: { outcome: "failed", reason: "model-response-rejected" },
      defects: [
        {
          code: "answer-unusable",
          clauseType: null,
          spanCharacterCount: Array.from(payload.answer).length,
          documentCharacterCount,
        },
      ],
    };
  }

  if (statutoryLanguageIn(answer).length > 0) {
    return {
      reading: { outcome: "failed", reason: "model-response-rejected" },
      defects: [
        {
          code: "answer-claims-a-law-or-a-right",
          clauseType: null,
          spanCharacterCount: Array.from(answer).length,
          documentCharacterCount,
        },
      ],
    };
  }

  const sourceSentence = verifiedSentence(documentText, payload.sourceSentence);
  if (sourceSentence === null) {
    return {
      reading: { outcome: "refused", refusal: "the-sentence-is-not-in-the-document" },
      defects: [
        {
          code:
            payload.sourceSentence.length === 0
              ? "answer-sentence-missing"
              : "answer-sentence-not-found",
          clauseType: null,
          spanCharacterCount: Array.from(payload.sourceSentence).length,
          documentCharacterCount,
        },
      ],
    };
  }

  return {
    reading: { outcome: "answered", answer: { text: answer, sourceSentence } },
    defects: [],
  };
}
