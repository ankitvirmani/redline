/**
 * The order the reader reads the flags in.
 *
 * Pure comparison over flags. It reads five things off a flag and nothing else: the
 * severity band, the levers the clause removes, where the cited sentence sits in the
 * document, the clause type, and the flag's code. It reads no clock, no model, no
 * network and no store, so the same set of flags always comes out in the same order.
 *
 * **One key sits in front of those five, and only when the reader has red lines.** A
 * flag that hits a red line the reader named is read first (ADR 0008). It is a key
 * like the others and never a filter, so it moves a flag up the list and can do
 * nothing else to it. See `byRedLinesHit` and `rankingKeysFor` at the foot of the
 * file.
 *
 * **The band leads.** Severity is a property of the clause as written and was
 * assigned during analysis (`PRD.md` section 5). Leverage lost breaks ties inside a
 * band; it does not outrank the band. That ordering is load-bearing rather than
 * stylistic: indemnification removes no lever at all and is banded high on what it
 * can cost, so a comparison that led with the count of levers removed would drop it
 * below a late-fee clause. See the note beside its `leversRemoved` in
 * `src/domain/clause-types.ts`.
 *
 * **Ubiquity is not safety.** Nothing here reads how common, how unusual, how novel
 * or how far from a market norm a clause is. An arbitration clause is in nearly
 * every consumer contract and comes first here; an order driven by rarity would bury
 * it and lead with oddities, which is the ranking this product exists in opposition
 * to (ADR 0003).
 *
 * **Confidence is not consulted.** How sure the analysis is that a clause is what it
 * says is a different question from what the clause costs. Confidence is carried on
 * the flag and shown separately, and no key below touches it.
 */

import type { Flag } from "@/src/analysis";
import {
  CLAUSE_TYPE_SLUGS,
  SEVERITY_BANDS,
  type Lever,
} from "@/src/domain/clause-types";

/** Negative puts `left` first. The shape `Array.prototype.sort` wants. */
export type FlagOrdering = (left: Flag, right: Flag) => number;

/** How far from calm the band is. `SEVERITY_BANDS` runs worst first. */
function distanceFromCalm(flag: Flag): number {
  const at = SEVERITY_BANDS.indexOf(flag.severity.band);
  return at === -1 ? SEVERITY_BANDS.length : at;
}

/**
 * How much leverage the clause takes: the number of distinct levers it removes.
 *
 * Read off the flag, not looked up here. Analysis fills `Flag.leverage` from the
 * per-type `leversRemoved` in `src/domain/clause-types.ts`, which is where the
 * knowledge belongs, because what a kind of clause takes away is a fact about the
 * kind of clause rather than about ordering. Counting distinct levers means an
 * instance-level source can report the same lever twice later without the count
 * drifting.
 *
 * Zero is not harmless. Two of the seven types remove no lever and still sit above
 * the floor, because what they take is money. The band is what carries that, which
 * is why the band is the first key and this is the second.
 */
export function leversRemovedCount(flag: Flag): number {
  return new Set<Lever>(flag.leverage.leversRemoved).size;
}

/** Worst band first. */
const BY_SEVERITY_BAND: FlagOrdering = (left, right) =>
  distanceFromCalm(left) - distanceFromCalm(right);

/** Inside a band, the clause that takes more leverage first. */
const BY_LEVERAGE_LOST: FlagOrdering = (left, right) =>
  leversRemovedCount(right) - leversRemovedCount(left);

/**
 * The earlier sentence in the document first.
 *
 * This is the final tiebreaker a reader would recognise: two clauses that cost the
 * same and take the same leverage come in the order they appear in the document in
 * front of them. It is fixed by the document rather than by the model, so it does
 * not move between two readings of the same text.
 */
const BY_PLACE_IN_THE_DOCUMENT: FlagOrdering = (left, right) =>
  left.sourceSentence.at.start - right.sourceSentence.at.start ||
  left.sourceSentence.at.end - right.sourceSentence.at.end;

/** The order Redline lists the types it checks in. Reached only by a shared span. */
const BY_CLAUSE_TYPE: FlagOrdering = (left, right) =>
  CLAUSE_TYPE_SLUGS.indexOf(left.clauseType) - CLAUSE_TYPE_SLUGS.indexOf(right.clauseType);

/**
 * The code, so the order is total rather than merely mostly decided.
 *
 * A code is unique within one reading, so no pair of flags can tie on every key and
 * leave `sort` to settle it. It is last on purpose: codes are handed out in the
 * order verified flags came back from the model, which is not stable across
 * readings, and every key above is. Two flags reach this key only when they share a
 * band, a lever count, a span and a clause type, which analysis already folds into
 * one flag.
 */
const BY_CODE: FlagOrdering = (left, right) =>
  left.code < right.code ? -1 : left.code > right.code ? 1 : 0;

/**
 * The keys every reading is ordered by, in the order they are asked.
 *
 * These five read a flag and nothing else, so they are the same for every reader.
 * Promotion is the one key that is not: it depends on the red lines the reader wrote,
 * so it cannot be a constant in this list and is built per reading by
 * `rankingKeysFor`, which puts it in front of `BY_SEVERITY_BAND`.
 */
export const RANKING_KEYS: readonly FlagOrdering[] = [
  BY_SEVERITY_BAND,
  BY_LEVERAGE_LOST,
  BY_PLACE_IN_THE_DOCUMENT,
  BY_CLAUSE_TYPE,
  BY_CODE,
];

/**
 * Promotion: a flag that hits a red line the reader named is read first.
 *
 * A key, and nowhere a filter. It decides which of two flags comes first and can do
 * nothing else: it cannot drop a flag, cannot hide one, cannot collapse one, and
 * cannot produce a number about the document, because an ordering returns -1, 0 or 1
 * and there is nowhere in that to put a verdict (ADR 0008).
 *
 * It is asked first, so a promoted flag is above every flag that is not, whatever
 * either one's band. Two promoted flags tie here and fall through to the keys below,
 * which means the promoted group reads worst first on exactly the principle the rest
 * of the list reads on: the band, then leverage lost, then the document. One ordering
 * principle rather than two, and the reader's own concerns lifted to the top of it.
 */
export function byRedLinesHit(hit: (flag: Flag) => boolean): FlagOrdering {
  return (left, right) => Number(hit(right)) - Number(hit(left));
}

/**
 * The keys for one reading: promotion, then the five that read the flag alone.
 *
 * A reader who has set no red lines hands in a predicate that is false for every
 * flag, the first key decides nothing, and the order is the one every reader gets.
 * That is the same code path rather than a special case, which is why red lines
 * cannot change what a reader without them is shown.
 */
export function rankingKeysFor(hit: (flag: Flag) => boolean): readonly FlagOrdering[] {
  return [byRedLinesHit(hit), ...RANKING_KEYS];
}

/** Which of two flags the reader reads first, asking the given keys in order. */
export function compareFlagsBy(keys: readonly FlagOrdering[]): FlagOrdering {
  return (left, right) => {
    for (const key of keys) {
      const decided = key(left, right);
      if (decided !== 0) return decided;
    }
    return 0;
  };
}

/** Which of two flags the reader reads first, before any red line is considered. */
export const compareFlags: FlagOrdering = compareFlagsBy(RANKING_KEYS);
