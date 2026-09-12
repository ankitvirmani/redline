/**
 * A red line: a condition the reader has declared unacceptable in advance.
 *
 * This file holds only what ranking needs in order to take red lines as an
 * argument today. Ticket 12 owns red lines outright: where they are stored, how a
 * reader writes one, and how one is matched against a flag. It will grow this type
 * rather than replace it.
 *
 * What is already settled and is not ticket 12's to reopen (ADR 0008): a red line
 * promotes matching flags and marks them. It never removes, hides or vetoes a flag,
 * and it never produces a walk-away recommendation. Ranking is therefore the only
 * seam a red line reaches, and promotion is an ordering key rather than a filter.
 */

export type RedLine = {
  /** Identity, so a mark on a flag can name the red line it hit. */
  readonly id: string;
  /** The condition, in the reader's own words. */
  readonly text: string;
};
