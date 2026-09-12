/**
 * Seam 2: analysis.
 *
 * One function out of this file, plus the types. Call `analyse` with an extracted
 * document and a model client, get back the summary, the clause types that were
 * checked, and the flags that can show the sentence they came from, or the reason
 * there is no analysis.
 *
 * The load-bearing property here is that an unverifiable flag never leaves. The
 * model returns spans, `verify.ts` holds each one against the stored extracted text,
 * and a span that does not appear verbatim means the flag is dropped and the drop is
 * recorded as a defect. No render path can display a flag that cannot show its
 * source sentence, because one never gets out of this function (ADR 0001).
 *
 * Flags come back unordered. Ranking is seam 3 and it consumes severity rather than
 * computing it, which is what keeps it model-free.
 */

import { CLAUSE_TYPE_SLUGS } from "@/src/domain/clause-types";
import { ModelCallError, type ModelClient } from "@/src/model/client";

import { recordDefect, type Defect } from "./defects";
import { verifiedFlags } from "./flags";
import { ANALYSIS_INSTRUCTIONS } from "./prompt";
import {
  MODEL_ANALYSIS_SCHEMA_NAME,
  modelAnalysisJsonSchema,
  readModelAnalysis,
} from "./schema";
import type { Analysis, AnalysisFailureReason, AnalysisRequest } from "./types";

export type {
  Analysis,
  AnalysisFailureReason,
  AnalysisRequest,
  ClauseTypeSlug,
  Consequence,
  Defect,
  DocumentAnalysis,
  DocumentGrantedExit,
  ExternalContext,
  Flag,
  Lever,
  Leverage,
  Severity,
  SeverityBand,
  SeverityMovement,
  SourceSentence,
  SpanLocation,
  Summary,
  ClauseTerms,
  WindowToAct,
} from "./types";
export { ANALYSIS_FAILURE_REASONS } from "./types";
export { appearsVerbatim, locateSpan } from "./verify";
export { defectsRecorded, defectsRecordedCount, forgetDefects } from "./defects";
export { assignSeverity, WINDOW_A_READER_CAN_USE_DAYS } from "./severity";
export { verifiedFlags } from "./flags";

/** A model failure, as a state the shell has copy for. */
function failureFor(error: unknown): AnalysisFailureReason {
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

/** The seam. Everything that needs a document read goes through here. */
export async function analyse(request: AnalysisRequest): Promise<Analysis> {
  const { document, model } = request;

  let json: unknown;
  try {
    const reply = await model.complete({
      purpose: "analysis",
      instructions: ANALYSIS_INSTRUCTIONS,
      input: document.text,
      schema: { name: MODEL_ANALYSIS_SCHEMA_NAME, json: modelAnalysisJsonSchema() },
    });
    json = reply.json;
  } catch (error) {
    return { outcome: "failed", reason: failureFor(error) };
  }

  const read = readModelAnalysis(json);
  if (!read.ok) {
    // The shape was wrong, so nothing inside it is trusted, not even the parts that
    // look right. Patching a payload field by field is how a citation that was never
    // checked reaches a reader.
    recordDefect({
      code: "model-response-rejected",
      clauseType: null,
      spanCharacterCount: null,
      documentCharacterCount: document.characterCount,
    });
    return { outcome: "failed", reason: "model-response-rejected" };
  }

  const reading = verifiedFlags(document.text, read.payload);
  const defects: Defect[] = reading.defects.map((defect) => recordDefect(defect));

  return {
    outcome: "analysed",
    analysis: {
      summary: { text: read.payload.summary },
      checkedClauseTypes: CLAUSE_TYPE_SLUGS,
      flags: reading.flags,
      defects,
    },
  };
}
