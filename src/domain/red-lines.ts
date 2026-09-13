/**
 * A red line: a condition the reader has declared unacceptable in advance.
 *
 * What is settled and is not reopened here (ADR 0008): a red line promotes matching
 * flags and marks them. It never removes, hides or vetoes a flag, and it never
 * produces a walk-away recommendation. Ranking is the only seam a red line reaches,
 * and promotion is an ordering key rather than a filter.
 *
 * ## What a red line is made of, and why
 *
 * Two parts, and the split is the whole design. A red line carries the reader's own
 * words, which is what the mark on a promoted flag shows them, and the clause types
 * those words are about, which is what the matching runs on.
 *
 * Matching on the clause types rather than on the words is a decision with a reason.
 * A red line is free text, a flag is a clause type with a consequence and a source
 * sentence, and every way of matching one against the other by reading the words is
 * either a model call, which would put a model in front of the order and make it
 * unassertable, or a keyword rule that fails silently: a reader who wrote "I will not
 * be locked in for a year" would never learn that nothing was ever checked for it.
 * A red line that silently never fires is worse than no red line at all. So the
 * reader says which of the seven kinds of clause their condition is about, in the
 * same words Redline uses for them elsewhere, and the screen that took the red line
 * says what will be checked. Nothing is guessed and nothing is hidden.
 *
 * `clauseTypes` holds one or more, because one condition can be about more than one
 * kind of clause: "I am not giving up the right to sue" is arbitration and it is also
 * limitation of liability, and a reader should not have to write the same sentence
 * twice to say so.
 *
 * This file is pure and imports nothing but the clause types. The rule for what may
 * be written lives here rather than in the screen or the route, because the screen,
 * the route and the store all have to agree on it, and three copies of a rule is
 * three chances to disagree about someone's contract.
 */

import { CLAUSE_TYPE_SLUGS, type ClauseTypeSlug } from "./clause-types";

export type RedLine = {
  /** Identity, so a mark on a flag can name the red line it hit. */
  readonly id: string;
  /** The condition, in the reader's own words. What the mark shows. */
  readonly text: string;
  /**
   * The kinds of clause this condition is about. What the matching runs on.
   *
   * One or more. Empty means this red line checks nothing, which the reader is told
   * rather than left to discover: see `checksNothing`.
   */
  readonly clauseTypes: readonly ClauseTypeSlug[];
};

/**
 * How long a red line's words may run.
 *
 * A red line is a condition, not a paragraph. The limit is here rather than in the
 * field's markup so that the field, the route and the store all hold to the same
 * number.
 */
export const RED_LINE_LIMIT = 240;

/**
 * A red line as a reader wrote it, held to the rule: their words, and the clause types
 * Redline checks them against.
 *
 * Only `redLineWritten` builds one, which is what makes the type worth having: a value
 * of this shape has been trimmed, has words in it, and names at least one clause type
 * Redline actually checks.
 */
export type RedLineWriting = {
  readonly text: string;
  readonly clauseTypes: readonly ClauseTypeSlug[];
};

/** What a reader, a form or a route body offers as a red line, before it is checked. */
export type RedLineAsked = {
  readonly text: string;
  readonly clauseTypes: readonly string[];
};

/**
 * Whether what the reader wrote can be kept, and what is wrong with it when it
 * cannot.
 *
 * Each refusal names one thing that is missing, because the screen says which. None
 * of them is an error state in the design sense: a reader who pressed the button
 * with an empty field is told what the field wants.
 */
export type RedLineWritten =
  | { readonly outcome: "written"; readonly writing: RedLineWriting }
  | { readonly outcome: "no-words" }
  | { readonly outcome: "nothing-to-check" }
  | { readonly outcome: "too-long"; readonly limit: number };

/**
 * What the reader wrote, ready to be kept, or the reason it is not.
 *
 * The words are trimmed at the ends and otherwise left exactly as written: a red
 * line is the reader's sentence and Redline does not rewrite it.
 *
 * The clause types are reduced to the ones Redline actually checks, each once, in
 * the order Redline lists them. Ordering them here means a red line reads in the
 * same order everywhere it is shown, whichever order the boxes were ticked in.
 */
export function redLineWritten(asked: RedLineAsked): RedLineWritten {
  const text = asked.text.trim();
  if (text.length === 0) return { outcome: "no-words" };
  if (text.length > RED_LINE_LIMIT) return { outcome: "too-long", limit: RED_LINE_LIMIT };

  const clauseTypes = CLAUSE_TYPE_SLUGS.filter((slug) => asked.clauseTypes.includes(slug));
  if (clauseTypes.length === 0) return { outcome: "nothing-to-check" };

  return { outcome: "written", writing: { text, clauseTypes } };
}

/**
 * The clause types on a red line that Redline checks for, in Redline's own order.
 *
 * Used when a red line is read back rather than written: a row carrying a slug this
 * build does not know, because it was written by a later build or edited by hand, is
 * read as a red line that checks fewer things rather than as one that cannot be
 * shown. The reader keeps their words either way.
 */
export function checkedClauseTypesOf(values: readonly string[]): readonly ClauseTypeSlug[] {
  return CLAUSE_TYPE_SLUGS.filter((slug) => values.includes(slug));
}

/**
 * Whether this red line checks nothing at all.
 *
 * True of a red line with no words, which has nothing to mark a flag with, and of
 * one with no clause type, which has nothing to match. Neither can be written
 * through the screen or the route, and a row like it can only arrive from a hand
 * edit or a build older than this one. It is carried as a state rather than dropped
 * because the reader has to be told: a red line sitting in their list that nothing
 * is ever checked against is the failure this whole design is arranged to avoid.
 */
export function checksNothing(redLine: RedLine): boolean {
  return redLine.text.trim().length === 0 || redLine.clauseTypes.length === 0;
}
