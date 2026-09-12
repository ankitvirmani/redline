/**
 * Turning a model payload into verified flags, or into nothing.
 *
 * Pure: text and payload in, flags and defects out. It calls no model, touches no
 * log and reads no clock, which is what lets the drop behaviour be tested directly
 * and what keeps the one rule the product rests on somewhere it can be read in full.
 *
 * The rule, in the order it runs:
 *
 * 1. The flag's span is held against the document. Not found, character for
 *    character, means the flag is dropped and a defect is raised. Nothing is
 *    repaired, re-anchored or searched for nearby.
 * 2. An exit's span is held against the document too. An exit that cannot show its
 *    sentence is dropped and a defect raised, and the flag survives without it:
 *    the flag's own citation is intact, and the exit is a separate claim that is
 *    simply not made.
 * 3. Severity is assigned from the type's baseline and the instance's terms.
 * 4. The external fact for the clause type, where the store holds one, is attached as
 *    its own field beside the consequence rather than folded into it.
 * 5. The flag is given its code, in the order the verified flags came back.
 *
 * Flags come out unordered. Ticket 06 orders them.
 */

import { clauseType } from "@/src/domain/clause-types";
import type { DefectReport } from "@/src/domain/defects";
import { verifiedSentence, type SourceSentence } from "@/src/domain/verify";

import { externalContextFor } from "./external-context";
import type { ModelAnalysisPayload, ModelFlagPayload } from "./schema";
import { assignSeverity, readClauseTerms } from "./severity";
import type { Flag } from "./types";

/** What came of reading one payload against one document. */
export type FlagReading = {
  readonly flags: readonly Flag[];
  readonly defects: readonly DefectReport[];
};

/** `F-01`, `F-02`. Identity, not rank. Two digits, so a long list stays aligned. */
function codeFor(position: number): string {
  return `F-${String(position).padStart(2, "0")}`;
}

/**
 * One flag from one payload entry, or the defect that stopped it.
 *
 * `position` is only the code's number, so it says nothing about how bad the flag
 * is.
 */
function readFlag(
  text: string,
  documentCharacterCount: number,
  reported: ModelFlagPayload,
  position: number,
): { readonly flag: Flag; readonly defects: readonly DefectReport[] } | { readonly defect: DefectReport } {
  const sourceSentence = verifiedSentence(text, reported.sourceSentence);
  if (sourceSentence === null) {
    return {
      defect: {
        code: reported.sourceSentence.length === 0 ? "source-sentence-missing" : "source-sentence-not-found",
        clauseType: reported.clauseType,
        spanCharacterCount: Array.from(reported.sourceSentence).length,
        documentCharacterCount,
      },
    };
  }

  const defects: DefectReport[] = [];

  let exit: Flag["exit"] = null;
  if (reported.exit !== null) {
    const exitSentence = verifiedSentence(text, reported.exit.sourceSentence);
    if (exitSentence === null) {
      defects.push({
        code: "exit-sentence-not-found",
        clauseType: reported.clauseType,
        spanCharacterCount: Array.from(reported.exit.sourceSentence).length,
        documentCharacterCount,
      });
    } else {
      exit = { text: reported.exit.text, sourceSentence: exitSentence };
    }
  }

  // The sentences this flag cites, which is where a term that moves severity has
  // to be written. An exit that failed verification is not among them.
  const cited = [sourceSentence.text, ...(exit === null ? [] : [exit.sourceSentence.text])];
  const terms = readClauseTerms(reported.windowToAct, cited);

  return {
    flag: {
      code: codeFor(position),
      clauseType: reported.clauseType,
      sourceSentence,
      severity: assignSeverity(reported.clauseType, terms),
      confidence: reported.confidence,
      consequence: {
        fromTheDocument: reported.consequence,
        // The two tiers, filled from two different places on purpose. What the clause
        // does to the reader comes from the model reading this document, bound to the
        // sentence above. The fact underneath it comes from the curated store, keyed on
        // the clause type, because its accuracy is ours rather than the document's and
        // it is reviewed rather than generated (ADR 0007, `external-context.ts`). Most
        // types have no fact, and null is the ordinary answer rather than a gap.
        externalContext: externalContextFor(reported.clauseType),
      },
      exit,
      terms,
      leverage: { leversRemoved: clauseType(reported.clauseType).leversRemoved },
    },
    defects,
  };
}

/**
 * Every flag in the payload that can show its source sentence, and every defect
 * raised getting there.
 *
 * One payload entry repeated, meaning the same clause type citing the same
 * sentence, is kept once. That is the same risk twice rather than a risk dropped,
 * so nothing is logged and nothing is lost.
 */
export function verifiedFlags(text: string, payload: ModelAnalysisPayload): FlagReading {
  const documentCharacterCount = Array.from(text).length;
  const flags: Flag[] = [];
  const defects: DefectReport[] = [];
  const seen = new Set<string>();

  for (const reported of payload.flags) {
    const already = `${reported.clauseType}\u0000${reported.sourceSentence}`;
    if (seen.has(already)) continue;
    seen.add(already);

    const read = readFlag(text, documentCharacterCount, reported, flags.length + 1);
    if ("defect" in read) {
      defects.push(read.defect);
      continue;
    }
    flags.push(read.flag);
    defects.push(...read.defects);
  }

  return { flags, defects };
}
