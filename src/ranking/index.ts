/**
 * Seam 3: ranking.
 *
 * One function out of this file, plus the types. Hand `rank` the flags analysis
 * returned and the reader's red lines, get back the flags in the order the reader
 * reads them.
 *
 * The property worth having here is that this seam is pure. It calls no model, opens
 * no socket and touches no store, so the order a reader sees is decided by the flags
 * alone and can be asserted in a test with nothing stubbed. Severity arrives already
 * assigned, because it is a property of the clause as written; recomputing it here
 * would put a model back in front of the order.
 *
 * Every flag that goes in comes out. Ranking orders, and ordering is all it does:
 * red lines promote and mark (ticket 12), and neither of those removes a flag
 * either (ADR 0008).
 */

import { compareFlags, leversRemovedCount, RANKING_KEYS } from "./order";
import type { RankedFlag, Ranking, RankingRequest } from "./types";

export type {
  CleanDocumentReading,
  RankedFlag,
  Ranking,
  RankingRequest,
  RedLine,
} from "./types";
export { compareFlags, leversRemovedCount, RANKING_KEYS };
export type { FlagOrdering } from "./order";

/**
 * The seam. Flags in any order in, the reader's order out.
 *
 * The input is copied before it is sorted, so the array handed in is left as it was
 * found, and each flag is carried across untouched rather than rebuilt.
 */
export function rank(request: RankingRequest): Ranking {
  const inTheReadersOrder = [...request.flags].sort(compareFlags);

  const flags: readonly RankedFlag[] = inTheReadersOrder.map((flag, position) => ({
    rank: position + 1,
    flag,
    matchedRedLines: [],
  }));

  return { flags, cleanDocument: null };
}
