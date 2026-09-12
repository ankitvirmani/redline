/**
 * The ranking seam: what goes in, and what comes out.
 *
 * Seam three of the four. Flags and red lines in; the flags in the order the reader
 * reads them, the red lines each one hit, and the clean-document determination out.
 * No model call, no network call, no database access, which is what makes the order
 * deterministic and cheap to assert.
 *
 * Written for the two tickets that land in this same seam:
 *
 * - Ticket 07 fills `Ranking.cleanDocument`. The field is carried here and null.
 * - Ticket 12 fills `RankedFlag.matchedRedLines` and adds promotion, which is one
 *   more ordering key in front of the band rather than a filter (ADR 0008).
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
   * The reader's red lines this flag hit. Always empty here: matching is ticket 12's
   * and this seam is given no way to decide it yet. Empty means none matched, never
   * that nothing was checked.
   */
  readonly matchedRedLines: readonly RedLine[];
};

/**
 * A document in which no flag met the bar, reported together with what was checked.
 * Never an empty result, which reads to a reader as a failure (`CONTEXT.md`).
 *
 * Ticket 07 owns this. Deciding it needs the list of clause types that were
 * checked, which this seam is not handed today, so ticket 07 adds that to
 * `RankingRequest` and fills this in one place.
 */
export type CleanDocumentReading = {
  readonly checkedClauseTypes: readonly ClauseTypeSlug[];
};

/** What the seam hands on. */
export type Ranking = {
  /** Every flag that went in, worst first. Ranking never drops one. */
  readonly flags: readonly RankedFlag[];
  /**
   * Null means the determination has not been made yet, not that the document is
   * unclean. Ticket 07 fills it; until then no screen may read this field as a
   * verdict either way.
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
};
