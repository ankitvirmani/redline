/**
 * The ranking seam: what goes in, and what comes out.
 *
 * Seam three of the four. Flags, red lines and the list of clause types analysis
 * checked go in; the flags in the order the reader reads them, the red lines each one
 * hit, and the clean-document determination come out. No model call, no network call,
 * no database access, which is what makes all three cheap to assert.
 *
 * Red lines reach this seam and no other. They promote a matching flag, which is one
 * more ordering key in front of the band, and they mark it with the reader's own
 * words. They are never a filter, and nothing on the way out can carry a count, a
 * score or a recommendation (ADR 0008).
 *
 * Ranking consumes severity and leverage; it computes neither. Both are properties
 * of the clause as written and were assigned during analysis, which is the whole
 * reason this seam can stay model-free.
 */

import type { Flag } from "@/src/analysis";
import type { ClauseTypeSlug } from "@/src/domain/clause-types";
import type { RedLine } from "@/src/domain/red-lines";

export type { RedLine } from "@/src/domain/red-lines";

/**
 * One flag in its place, wrapped rather than rewritten.
 *
 * The flag is carried untouched, so nothing here can quietly restate a severity or
 * a source sentence that analysis already checked. Rank sits beside it because rank
 * is a property of the list, not of the clause: the same clause in a worse document
 * ranks lower without changing.
 */
export type RankedFlag = {
  /** Where the reader sees it, from 1. Contiguous, and the badge on the bar. */
  readonly rank: number;
  readonly flag: Flag;
  /**
   * The reader's red lines this flag hit, in the order they wrote them.
   *
   * This is the mark, and it is the whole of what a red line adds to a flag: the
   * reader's own words back, so the screen can say which one they named. Empty means
   * none hit, never that nothing was checked, and a reader who set none gets an empty
   * list on every flag, exactly as one whose red lines missed everything does.
   *
   * There is no count and no score beside it on purpose. How many red lines a
   * document hit is not a thing this seam says, in any field, because saying it
   * would be the verdict ADR 0007 refuses arriving as a number (ADR 0008).
   */
  readonly matchedRedLines: readonly RedLine[];
};

/**
 * A document in which no flag met the bar, reported together with what was checked.
 * Never an empty result, which reads to a reader as a failure (`CONTEXT.md`).
 *
 * The list is carried rather than looked up, and it is the list analysis reports it
 * checked. A screen that printed the seven types from `clause-types.ts` instead would
 * go on printing seven whatever analysis did.
 */
export type CleanDocumentReading = {
  readonly checkedClauseTypes: readonly ClauseTypeSlug[];
};

/** What the seam hands on. */
export type Ranking = {
  /** Every flag that went in, worst first. Ranking never drops one. */
  readonly flags: readonly RankedFlag[];
  /**
   * The clean-document reading, or null where it was not determined. Null is never
   * "not clean": it is what comes back when a flag met the bar, and also when no
   * checked list was handed in, because a clean document is only reportable
   * together with the names of what was looked for. The unclean case is the flags.
   */
  readonly cleanDocument: CleanDocumentReading | null;
};

/**
 * What the seam is handed.
 *
 * `redLines` is optional and an empty list behaves exactly as omitting it does, so
 * that a signed-out reader, a reader who has set none, and a reader whose red lines
 * have not loaded all take the same path through here.
 */
export type RankingRequest = {
  /** Unordered, as analysis returns them. */
  readonly flags: readonly Flag[];
  readonly redLines?: readonly RedLine[];
  /**
   * What analysis reports it checked, straight off `DocumentAnalysis`.
   *
   * The seam cannot work this out from the flags: a document with no flags is
   * exactly the document whose flags say nothing about what was looked for, which is
   * why the clean verdict needs this list handed to it. Omitted means the caller is
   * not in a position to say, and `cleanDocument` comes back null rather than
   * guessing at seven names.
   */
  readonly checkedClauseTypes?: readonly ClauseTypeSlug[];
};
