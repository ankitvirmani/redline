/**
 * The defect log: a counter of times the product's rule caught something.
 *
 * A flag whose span does not appear in the document is dropped before the
 * analysis seam returns, and the drop is recorded here. Ticket 13 counts these to
 * report how often the model claimed a sentence the document does not contain, and
 * the deterministic suite reads the same log to prove a drop happened rather than
 * assuming it.
 *
 * Two seams write to it. Analysis records a dropped flag; question answering records
 * a refused answer. It sits in `src/domain/` for that reason: ticket 13 counts one
 * number across the whole product, and a second log at the question seam would be a
 * second number nobody adds up.
 *
 * What it records is codes, types and lengths. What it never records is the
 * document text, the span, the summary, a consequence, a question or an answer. This
 * is a defect counter, not a store of someone's contract, and it is the only thing on
 * either path that keeps anything after a request ends.
 *
 * The log lives in module state, which means one process, in memory, lost on
 * restart. That is all a counter needs, and a counter that survived a restart
 * would be a store of someone's document by another name.
 */

import type { ClauseTypeSlug } from "@/src/domain/clause-types";

/** Every kind of defect the product can record. Meant to gain members. */
export const DEFECT_CODES = [
  /** The model's span does not appear in the document, so the flag was dropped. */
  "source-sentence-not-found",
  /** The model returned a flag with no span at all, so the flag was dropped. */
  "source-sentence-missing",
  /** A flag's exit cites a sentence the document does not contain, so the exit was dropped. */
  "exit-sentence-not-found",
  /** The model's JSON did not match the schema, so nothing was trusted from it. */
  "model-response-rejected",
  /** The summary said whether to sign, or judged the document, so there is no analysis. */
  "summary-carries-a-verdict",
  /** The summary came back as whitespace, or far longer than a summary, so there is no analysis. */
  "summary-unusable",
  /** The summary stated a figure the document does not contain. Recorded, and the summary still shows. */
  "summary-figure-not-found",
  /**
   * An answer claimed a sentence the document does not contain, so the question was
   * refused. The same failure as `source-sentence-not-found` on the answer path, kept
   * as its own code because ticket 13 measures the two paths separately.
   */
  "answer-sentence-not-found",
  /** An answer claimed to be grounded and carried no sentence at all, so it was refused. */
  "answer-sentence-missing",
  /** An answer claimed a law or a right, so it was not shown (ADR 0005). */
  "answer-claims-a-law-or-a-right",
  /** An answer came back as whitespace, or far longer than an answer, so it was not shown. */
  "answer-unusable",
] as const;

export type DefectCode = (typeof DEFECT_CODES)[number];

/** One recorded defect. Nothing here can be read back into a reader's document. */
export type Defect = {
  readonly code: DefectCode;
  /** The type the dropped flag claimed to be, where the model named a legal one. */
  readonly clauseType: ClauseTypeSlug | null;
  /**
   * How long the rejected span was, in characters, or the summary or answer where the
   * defect is theirs. Never the span, the summary or the answer itself.
   */
  readonly spanCharacterCount: number | null;
  /** How long the document was, for context on a drop. Never the document. */
  readonly documentCharacterCount: number;
  /** When it happened, to the millisecond. */
  readonly at: string;
};

/**
 * How many defects are kept. A long run over a corpus can raise thousands, and
 * ticket 13 needs the count rather than every record, so the oldest fall off.
 */
const KEEP = 500;

let recorded: Defect[] = [];
let total = 0;

/** What a caller hands in. The timestamp is ours, so it cannot be faked. */
export type DefectReport = Omit<Defect, "at">;

/**
 * Records one defect. The single door in, so that ticket 13 and the eval suite
 * have one thing to count and nothing anywhere else needs its own log line.
 */
export function recordDefect(report: DefectReport): Defect {
  const defect: Defect = { ...report, at: new Date().toISOString() };
  recorded.push(defect);
  if (recorded.length > KEEP) recorded = recorded.slice(-KEEP);
  total += 1;
  return defect;
}

/** The defects still held, oldest first. */
export function defectsRecorded(): readonly Defect[] {
  return recorded;
}

/** How many defects have been recorded since the process started, including any dropped from the tail. */
export function defectsRecordedCount(): number {
  return total;
}

/** Empties the log. For a test that wants to read its own drop, and nothing else. */
export function forgetDefects(): void {
  recorded = [];
  total = 0;
}
