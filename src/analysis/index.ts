/**
 * Seam 2: analysis.
 *
 * One function out of this file, plus the types. Call `analyse` with an extracted
 * document and a model client, get back the summary, the clause types that were
 * checked, and the flags that can show the sentence they came from, or the reason
 * there is no analysis.
 *
 * The load-bearing property here is that an unverifiable flag never leaves. The
 * model returns spans, `src/domain/verify.ts` holds each one against the stored text,
 * and a span that does not appear verbatim means the flag is dropped and the drop is
 * recorded as a defect. No render path can display a flag that cannot show its
 * source sentence, because one never gets out of this function (ADR 0001).
 *
 * Flags come back unordered. Ranking is seam 3 and it consumes severity rather than
 * computing it, which is what keeps it model-free.
 */

import { CLAUSE_TYPE_SLUGS } from "@/src/domain/clause-types";
import { recordDefect, type Defect } from "@/src/domain/defects";
import { ModelCallError, type ModelClient } from "@/src/model/client";

import { verifiedFlags } from "./flags";
import { ANALYSIS_INSTRUCTIONS } from "./prompt";
import {
  MODEL_ANALYSIS_SCHEMA_NAME,
  modelAnalysisJsonSchema,
  readModelAnalysis,
} from "./schema";
import { readSummary } from "./summary";
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
export { appearsVerbatim, locateSpan, verifiedSentence } from "@/src/domain/verify";
export { defectsRecorded, defectsRecordedCount, forgetDefects } from "@/src/domain/defects";
export { assignSeverity, WINDOW_A_READER_CAN_USE_DAYS } from "./severity";
export { verifiedFlags } from "./flags";
export {
  figuresIn,
  figuresNotInTheDocument,
  readSummary,
  SUMMARY_CHARACTER_LIMIT,
  SUMMARY_REFUSALS,
} from "./summary";
export type { Figure, SummaryReading, SummaryRefusal } from "./summary";
export { statutoryLanguageIn, VERDICT_KINDS, verdictLanguageIn } from "@/src/domain/wording";
export type { VerdictFinding, VerdictKind } from "@/src/domain/wording";
export { EXTERNAL_CONTEXT, externalContextFor, SOURCED_FILES } from "./external-context";
export type { ExternalContextEntry, SourcedFile } from "./external-context";

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

  // The summary is prose, so the citation rule cannot reach it. What code can check
  // about it is in `summary.ts`, along with what it cannot. A summary that says
  // whether to sign, or that is not a summary at all, takes the whole analysis down
  // rather than leaving the screen with verified flags and no summary above them:
  // there is nothing to show in its place, and editing a verdict out of a paragraph
  // in code would hand the reader a summary nobody wrote.
  const summary = readSummary(document.text, read.payload.summary);
  if (!summary.ok) {
    recordDefect({
      code: summary.refusal === "carries-a-verdict" ? "summary-carries-a-verdict" : "summary-unusable",
      clauseType: null,
      spanCharacterCount: read.payload.summary.length,
      documentCharacterCount: document.characterCount,
    });
    return { outcome: "failed", reason: "model-response-rejected" };
  }

  const reading = verifiedFlags(document.text, read.payload);
  const defects: Defect[] = reading.defects.map((defect) => recordDefect(defect));

  // A figure the document does not contain is recorded and the summary still shows.
  // The check cannot tell a fabricated number from a lawful rewording, and refusing
  // on that would cost a reader every verified flag on the screen.
  for (const figure of summary.ungroundedFigures) {
    defects.push(
      recordDefect({
        code: "summary-figure-not-found",
        clauseType: null,
        spanCharacterCount: figure.length,
        documentCharacterCount: document.characterCount,
      }),
    );
  }

  return {
    outcome: "analysed",
    analysis: {
      summary: summary.summary,
      checkedClauseTypes: CLAUSE_TYPE_SLUGS,
      flags: reading.flags,
      defects,
    },
  };
}
