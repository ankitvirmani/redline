/**
 * Seam 4: question answering.
 *
 * One function out of this file, plus the types. Call `answerQuestion` with an extracted
 * document, a question and a model client, and get back an answer with the sentence it
 * came from, a refusal, or the reason there is neither.
 *
 * The load-bearing property is the same one the analysis seam has, enforced by the same
 * code: an answer whose source sentence is not in the document never leaves. It runs
 * through `src/domain/verify.ts`, which is the verifier a flag's citation runs through,
 * moved out of the analysis seam so that both read one file. There is no second verifier
 * on this path and no relaxed version of the first, because the verifier on the answer
 * path is the one nobody watches (ADR 0001).
 *
 * The second property is the refusal, and it is a typed outcome rather than prose a
 * consumer classifies. The model says whether it can ground an answer in a field
 * (`schema.ts`); code can turn its yes into a refusal and never its no into an answer
 * (`answer.ts`). `PRD.md` section 4 proposes 100% refusal on ungrounded questions and
 * puts an answer to one in the same class as a missing citation.
 *
 * Nothing on this path reaches outside the document. There is no external fact base
 * here, unlike a flag's consequence, and there is not meant to be one: a fact beside a
 * flag carries its own citation and is rendered visibly apart, and an answer has no such
 * shape to put one in (ADR 0007).
 */

import { recordDefect } from "@/src/domain/defects";
import { ModelCallError, type ModelClient } from "@/src/model/client";

import { questionAsked, readAnswer } from "./answer";
import { ANSWER_INSTRUCTIONS, questionInput } from "./prompt";
import { MODEL_ANSWER_SCHEMA_NAME, modelAnswerJsonSchema, readModelAnswer } from "./schema";
import type { QuestionFailureReason, QuestionReading, QuestionRequest } from "./types";

export type {
  GroundedAnswer,
  QuestionFailureReason,
  QuestionReading,
  QuestionRefusalReason,
  QuestionRejectionReason,
  QuestionRequest,
  SourceSentence,
} from "./types";
export {
  QUESTION_FAILURE_REASONS,
  QUESTION_REFUSAL_REASONS,
  QUESTION_REJECTION_REASONS,
} from "./types";
export { ANSWER_CHARACTER_LIMIT, questionAsked, readAnswer } from "./answer";
export type { AnswerReading } from "./answer";
export { MODEL_ANSWER_SCHEMA_NAME, modelAnswerJsonSchema, readModelAnswer } from "./schema";
export type { ModelAnswerPayload } from "./schema";
export { ANSWER_INSTRUCTIONS, questionInput, readQuestionInput } from "./prompt";

/** A model failure, as a state the shell has copy for. Matches the analysis seam's. */
function failureFor(error: unknown): QuestionFailureReason {
  if (!(error instanceof ModelCallError)) return "model-unavailable";
  switch (error.failure) {
    case "not-configured":
      return "model-not-configured";
    case "unreadable-reply":
      return "model-response-rejected";
    case "unavailable":
      return "model-unavailable";
  }
}

/** The seam. Every question a reader asks goes through here. */
export async function answerQuestion(request: QuestionRequest): Promise<QuestionReading> {
  const { document, model } = request;

  // An empty question does not reach the model. There is nothing to answer, so there is
  // nothing to spend a call on and nothing true to say about the document, and calling
  // it a refusal would tell the reader their document is silent about a question they
  // never asked. It is its own outcome for that reason.
  const question = questionAsked(request.question);
  if (question === null) return { outcome: "not-asked", reason: "nothing-asked" };

  let json: unknown;
  try {
    const reply = await model.complete({
      purpose: "question",
      instructions: ANSWER_INSTRUCTIONS,
      input: questionInput(document.text, question),
      schema: { name: MODEL_ANSWER_SCHEMA_NAME, json: modelAnswerJsonSchema() },
    });
    json = reply.json;
  } catch (error) {
    return { outcome: "failed", reason: failureFor(error) };
  }

  const read = readModelAnswer(json);
  if (!read.ok) {
    // The shape was wrong, so nothing inside it is trusted, not even the parts that look
    // right. A payload that said it was ungrounded while carrying an answer lands here
    // too, and that is the point of failing it whole rather than reading down to the
    // field that is right.
    recordDefect({
      code: "model-response-rejected",
      clauseType: null,
      spanCharacterCount: null,
      documentCharacterCount: document.characterCount,
    });
    return { outcome: "failed", reason: "model-response-rejected" };
  }

  const answer = readAnswer(document.text, document.characterCount, read.payload);

  // The defects go to the log and not into the reading. A reader's refusal has nothing
  // to hang them on, and ticket 13 counts them from the log across a whole corpus rather
  // than one answer at a time.
  for (const defect of answer.defects) recordDefect(defect);

  return answer.reading;
}
