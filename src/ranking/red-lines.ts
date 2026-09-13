/**
 * Which of the reader's red lines a flag hits.
 *
 * Pure, and the only thing in this seam that knows a red line exists. No model call,
 * no network, no store: a flag and a list of red lines in, the red lines that flag
 * hits out, the same answer every time. That is what lets the order a reader sees be
 * asserted with nothing stubbed, and it is why matching is not a model's job (ADR
 * 0008 needs promotion to be cheap and decidable, not clever).
 *
 * **The rule is one line: a flag hits a red line when the red line names the flag's
 * clause type.** The reader chose those clause types themselves when they wrote the
 * red line, from the same seven names Redline uses everywhere else, so they know
 * before a document is ever pasted what will be checked. Nothing here reads the
 * reader's words, and nothing guesses.
 *
 * Two failure modes this is arranged against:
 *
 * - **Silent non-matching.** A red line that never fires and never says so is worse
 *   than no red line. Matching cannot silently fail here, because what is matched on
 *   is exactly what the reader ticked; the one case where a red line checks nothing
 *   is a red line carrying no clause type, and `checksNothing` in the domain is what
 *   the screen uses to tell the reader so.
 * - **Overmatching.** A rule that promoted everything would be a rule that ordered
 *   nothing. The clause type is the narrowest honest thing to match on: a reader with
 *   one red line about auto-renewal promotes auto-renewal flags and leaves the other
 *   six kinds exactly where severity put them.
 *
 * Nothing in this file removes, hides, counts or scores anything. It returns the red
 * lines a flag hit, and hitting none is an empty list rather than a judgement.
 */

import type { Flag } from "@/src/analysis";
import { checksNothing, type RedLine } from "@/src/domain/red-lines";

/**
 * The red lines this flag hits, in the order the reader wrote them.
 *
 * The red lines come back as they went in, so the mark on a flag shows the reader
 * their own sentence rather than a restatement of it.
 *
 * A red line that checks nothing is skipped: with no words it has nothing to mark a
 * flag with, and with no clause type it has nothing to match. Neither can be written
 * through the screen, and the screen says so about a row that arrived any other way.
 *
 * Two red lines carrying the same words count once. The reader's list is theirs to
 * keep as they like, and a flag marked twice with one sentence would read as the
 * document hitting it twice, which is a count, and a count is the thing red lines do
 * not produce. The first wording the reader wrote is the one that shows.
 */
export function redLinesHitBy(
  flag: Flag,
  redLines: readonly RedLine[],
): readonly RedLine[] {
  const hit: RedLine[] = [];
  const named = new Set<string>();

  for (const redLine of redLines) {
    if (checksNothing(redLine)) continue;
    if (!redLine.clauseTypes.includes(flag.clauseType)) continue;

    const words = redLine.text.trim().toLowerCase();
    if (named.has(words)) continue;
    named.add(words);
    hit.push(redLine);
  }

  return hit;
}

/**
 * Every flag in the reading, with the red lines it hits.
 *
 * Keyed by the flag itself rather than by its code. The seam carries each flag across
 * untouched, so identity is the surest key there is, and it cannot be confused by two
 * flags that somehow share a code.
 *
 * Worked out once per reading rather than inside the comparison, because a comparison
 * is asked O(n log n) times and the answer for a flag never changes while the list is
 * being ordered.
 */
export function redLinesHit(
  flags: readonly Flag[],
  redLines: readonly RedLine[],
): ReadonlyMap<Flag, readonly RedLine[]> {
  const hits = new Map<Flag, readonly RedLine[]>();
  for (const flag of flags) hits.set(flag, redLinesHitBy(flag, redLines));
  return hits;
}
