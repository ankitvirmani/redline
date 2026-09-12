/**
 * The shape an answer has to come back in, and the check that it did.
 *
 * One declaration, two uses, the same arrangement as `src/analysis/schema.ts`: the zod
 * schema validates the reply before a single field is trusted, and the same schema is
 * emitted as JSON Schema and sent with the request as a strict `json_schema` response
 * format. A hand-kept second copy would drift.
 *
 * The load-bearing decision here is that the refusal is a field and not a sentence.
 * The model says whether it can ground an answer in `grounded`, and an ungrounded
 * reply carries no answer and no sentence at all: both are null, and a payload that
 * says `grounded: false` while carrying an answer is rejected rather than read. That
 * is the difference between a refusal a consumer can switch on and a refusal somebody
 * has to find by grepping "I cannot" out of prose, which is a classifier, and a
 * classifier on this path is a place an ungrounded answer gets through.
 *
 * Nullable fields rather than two alternative object shapes, because a strict
 * `json_schema` response format is sent with `additionalProperties: false` and every
 * property required, and `src/analysis/schema.ts` already sends nullable fields to the
 * same endpoint. The pairing rules that a union would carry in its shape are carried
 * here by the refinement below, which is checked on the way in.
 *
 * Note what the model is not asked for. It is not asked whether it is confident, it is
 * not asked for a span offset, and it is not asked to say how it knows. The offsets
 * come from the verifier, which finds the sentence itself, so a model that reports the
 * wrong place cannot move a citation.
 */

import { z } from "zod";

export const MODEL_ANSWER_SCHEMA = z
  .strictObject({
    /**
     * Whether the document answers the question. The model's claim, not the product's
     * finding: `src/qa/index.ts` can turn a true here into a refusal and never the
     * other way round.
     */
    grounded: z.boolean(),
    /** The answer, or null where the document does not answer the question. */
    answer: z.string().nullable(),
    /**
     * The one sentence in the document the answer came from, copied out character for
     * character, or null. Checked in code, not here.
     */
    sourceSentence: z.string().nullable(),
  })
  .refine(
    (payload) =>
      payload.grounded
        ? payload.answer !== null && payload.sourceSentence !== null
        : payload.answer === null && payload.sourceSentence === null,
    {
      // An ungrounded reply that carries an answer anyway is the failure this seam
      // exists to stop, arriving in the one shape that would look like a refusal to a
      // consumer switching on `grounded`. It is rejected whole rather than read down to
      // the field that is right.
      message: "An answer is grounded and carries both fields, or is not and carries neither.",
    },
  );

/** What a valid answer payload looks like once it has been checked. */
export type ModelAnswerPayload = z.infer<typeof MODEL_ANSWER_SCHEMA>;

/** The name the API wants for the shape. */
export const MODEL_ANSWER_SCHEMA_NAME = "redline_answer";

/**
 * The same shape as JSON Schema, for the request's `response_format`. `$schema` is
 * dropped because the API wants the schema itself, not a document describing one. The
 * refinement does not survive the emit, which is why it is enforced on the way in as
 * well as asked for in the prompt.
 */
export function modelAnswerJsonSchema(): unknown {
  const emitted = z.toJSONSchema(MODEL_ANSWER_SCHEMA, {
    target: "draft-7",
    io: "input",
  }) as Record<string, unknown>;
  const { $schema: _dropped, ...schema } = emitted;
  return schema;
}

/** Checks a reply. Either the payload, in shape, or the fact that it was not. */
export function readModelAnswer(
  json: unknown,
): { readonly ok: true; readonly payload: ModelAnswerPayload } | { readonly ok: false } {
  const parsed = MODEL_ANSWER_SCHEMA.safeParse(json);
  return parsed.success ? { ok: true, payload: parsed.data } : { ok: false };
}
