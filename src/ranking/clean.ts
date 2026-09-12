/**
 * The clean-document determination.
 *
 * A document in which no flag met the bar, reported together with the list of what
 * was checked (`CONTEXT.md`, ADR 0004). The list is the whole point: an empty screen
 * is indistinguishable from a failed parse, so "nothing met the bar" only means
 * something next to the names of the things that were looked for.
 *
 * Pure, and it belongs in this seam rather than in a component, for two reasons.
 * Ranking is the one place that already holds the whole flag set, and a render path
 * that decided this for itself would be deciding it from `flags.length === 0`, which
 * is the same information with none of the checked list attached.
 *
 * **The checked list is carried in, never assembled here.** `checkedClauseTypes`
 * comes off `DocumentAnalysis`, which is what analysis actually looked for. Reading
 * `CLAUSE_TYPE_SLUGS` in this file instead would produce a list that stayed at seven
 * names whatever analysis did, and the first time the two diverged the screen would
 * print the wrong one confidently. So the seam is handed the list and passes it on.
 */

import type { Flag } from "@/src/analysis";
import type { ClauseTypeSlug } from "@/src/domain/clause-types";

import type { CleanDocumentReading } from "./types";

/**
 * Whether this is a clean document, and null where that cannot be said.
 *
 * Null is "not determined", never "not clean". Three different things produce it:
 * a flag met the bar, so the document is not clean; no checked list was handed in,
 * so there is nothing to report a clean document with; or the checked list is empty,
 * which would make a clean verdict a claim about nothing. A consumer that wants the
 * negative verdict reads the flags, which is where it lives.
 */
export function cleanDocumentFor(
  flags: readonly Flag[],
  checkedClauseTypes: readonly ClauseTypeSlug[] | undefined,
): CleanDocumentReading | null {
  if (flags.length > 0) return null;
  if (checkedClauseTypes === undefined || checkedClauseTypes.length === 0) return null;
  return { checkedClauseTypes };
}
