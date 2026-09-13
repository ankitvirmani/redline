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
 * red lines promote and mark, and neither of those removes a flag either (ADR 0008).
 * There is no field on the way out that could carry a count of red lines hit, a
 * score, or a recommendation, and that is deliberate.
 *
 * The one thing it decides beyond the order is whether this is a clean document,
 * which is the same judgement seen from the other side: the seam holds the whole flag
 * set, so it is the only place that can say nothing in it met the bar, and it says so
 * with the list of what was checked attached. See `clean.ts`.
 */

import { cleanDocumentFor } from "./clean";
import {
  byRedLinesHit,
  compareFlags,
  compareFlagsBy,
  leversRemovedCount,
  RANKING_KEYS,
  rankingKeysFor,
} from "./order";
import { redLinesHit, redLinesHitBy } from "./red-lines";
import type { RankedFlag, Ranking, RankingRequest } from "./types";

export type {
  CleanDocumentReading,
  RankedFlag,
  Ranking,
  RankingRequest,
  RedLine,
} from "./types";
export {
  byRedLinesHit,
  compareFlags,
  compareFlagsBy,
  leversRemovedCount,
  RANKING_KEYS,
  rankingKeysFor,
};
export { redLinesHit, redLinesHitBy };
export { cleanDocumentFor };
export type { FlagOrdering } from "./order";

/**
 * The seam. Flags in any order in, the reader's order out and the clean-document
 * reading beside it.
 *
 * The input is copied before it is sorted, so the array handed in is left as it was
 * found, and each flag is carried across untouched rather than rebuilt.
 *
 * Red lines do two things here and nothing else. A flag that hits one is promoted,
 * which is the first key the comparison asks, and it is marked with the red lines it
 * hit, which is what the screen shows the reader in their own words. Every flag that
 * went in still comes out, and a reader with no red lines takes this same path with a
 * predicate that is false for every flag, so what was found does not depend on what
 * they declared (ADR 0008).
 */
export function rank(request: RankingRequest): Ranking {
  const hits = redLinesHit(request.flags, request.redLines ?? []);
  const hit = (flag: RankedFlag["flag"]) => (hits.get(flag) ?? []).length > 0;

  const inTheReadersOrder = [...request.flags].sort(compareFlagsBy(rankingKeysFor(hit)));

  const flags: readonly RankedFlag[] = inTheReadersOrder.map((flag, position) => ({
    rank: position + 1,
    flag,
    matchedRedLines: hits.get(flag) ?? [],
  }));

  return {
    flags,
    cleanDocument: cleanDocumentFor(request.flags, request.checkedClauseTypes),
  };
}
