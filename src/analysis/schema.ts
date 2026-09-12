/**
 * The shape the model has to answer in, and the check that it did.
 *
 * One declaration, two uses. The zod schema validates what came back before a
 * single field is trusted, and the same schema is emitted as JSON Schema and sent
 * with the request as a strict `json_schema` response format. Writing it once is
 * the point: a hand-kept second copy drifts, and the drift shows up as a model
 * answering in a shape the validator rejects.
 *
 * A response that fails this check is a defect. It is not patched up field by
 * field and no part of it is kept, because a payload that got the shape wrong has
 * given no reason to believe the sentences inside it.
 *
 * Note what the model is not asked for. It is not asked for a severity band: the
 * band is assigned in code from the type's baseline and the instance's terms, so
 * that severity cannot be talked into changing. It is not asked which clause types
 * were checked, because that is data the product holds. It is not asked for
 * anything from outside the document.
 */

import { z } from "zod";

import { CLAUSE_TYPE_SLUGS } from "@/src/domain/clause-types";

import { WINDOW_RUNS_AGAINST } from "./types";

/** A span the model says it copied out of the document. Checked in code, not here. */
const sourceSentence = z.string().min(1);

const windowToAct = z
  .strictObject({
    days: z.number().int().min(0).max(3650),
    runsAgainst: z.enum(WINDOW_RUNS_AGAINST),
  })
  .nullable();

const exit = z
  .strictObject({
    text: z.string().min(1),
    sourceSentence,
  })
  .nullable();

const modelFlag = z.strictObject({
  clauseType: z.enum(CLAUSE_TYPE_SLUGS),
  sourceSentence,
  consequence: z.string().min(1),
  confidence: z.number().min(0).max(1),
  exit,
  windowToAct,
});

export const MODEL_ANALYSIS_SCHEMA = z.strictObject({
  summary: z.string(),
  flags: z.array(modelFlag),
});

/** What a valid model payload looks like once it has been checked. */
export type ModelAnalysisPayload = z.infer<typeof MODEL_ANALYSIS_SCHEMA>;
export type ModelFlagPayload = z.infer<typeof modelFlag>;

/** The name the API wants for the shape. */
export const MODEL_ANALYSIS_SCHEMA_NAME = "redline_analysis";

/**
 * The same shape as JSON Schema, for the request's `response_format`. `$schema` is
 * dropped because the API wants the schema itself, not a document describing one.
 */
export function modelAnalysisJsonSchema(): unknown {
  const emitted = z.toJSONSchema(MODEL_ANALYSIS_SCHEMA, { target: "draft-7" }) as Record<
    string,
    unknown
  >;
  const { $schema: _dropped, ...schema } = emitted;
  return schema;
}

/** Checks a reply. Either the payload, in shape, or the fact that it was not. */
export function readModelAnalysis(
  json: unknown,
): { readonly ok: true; readonly payload: ModelAnalysisPayload } | { readonly ok: false } {
  const parsed = MODEL_ANALYSIS_SCHEMA.safeParse(json);
  return parsed.success ? { ok: true, payload: parsed.data } : { ok: false };
}
