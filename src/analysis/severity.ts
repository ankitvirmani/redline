/**
 * Severity, assigned from the clause as written.
 *
 * The type sets a baseline band and the instance's own terms move it (`PRD.md`
 * section 5). Severity is assigned here, at analysis, rather than at ranking,
 * because it is a property of the clause in front of the reader rather than of its
 * category, and because assigning it here is what lets ranking stay model-free.
 *
 * The division of labour is deliberate. The model reports the terms: how long a
 * window the document gives, and what that window runs against. Code holds the
 * baselines and the rules, so severity cannot be talked up or down by a model
 * having a bad day, and the rules can be read and argued with.
 *
 * One rule ships here, and it is the one the fixtures prove:
 *
 *   A window the reader can use moves the band one step toward moderate.
 *
 * The bands are statements about leverage (ADR 0003): critical removes a lever
 * outright, high removes a lever with a deadline or a cost attached, moderate costs
 * money with the lever intact. A window long enough to act in is exactly what moves
 * a clause from the second of those to the third, because the reader can still
 * leave. A three day window does not, because the reader has to already know the
 * clause exists to meet it.
 *
 * Two conditions keep the rule honest, and both come from the fixture sidecar's own
 * reasoning:
 *
 * 1. The window has to run against the moment the clause bites. An opt-out that
 *    expires thirty days after signing has gone long before a dispute exists, so it
 *    is recorded as an exit the document grants and moves nothing.
 * 2. The day count has to appear in one of the sentences the flag cites. A term
 *    that moves severity is checked against the document, like everything else
 *    here; an unchecked term holds the band where the type put it. That fails
 *    toward the higher band, which is the direction ADR 0004 prefers.
 */

import {
  clauseType,
  shiftBand,
  type ClauseTypeSlug,
  type SeverityBand,
} from "@/src/domain/clause-types";

import type { ClauseTerms, Severity, SeverityMovement, WindowToAct } from "./types";

/**
 * The shortest window that counts as one a reader can use, in days.
 *
 * Thirty days is the month's notice these documents are written around: long
 * enough that a reader who reads the renewal notice can still act on it, and the
 * span the fixture pair sits either side of. Shorter than that and meeting the
 * deadline depends on having found the clause in advance, which is the failure this
 * product exists because of.
 */
export const WINDOW_A_READER_CAN_USE_DAYS = 30;

/**
 * Whether the day count the model reported is written in the document, as digits,
 * in one of the sentences this flag cites.
 *
 * Digits only. These documents write a period twice, as words and as a figure,
 * "ninety (90) days", so the figure is there to be found; matching the words as
 * well would mean parsing English numerals to decide a severity, which is a great
 * deal of machinery for a check whose job is to be conservative.
 */
export function windowIsStatedIn(citedSentences: readonly string[], days: number): boolean {
  const asDigits = new RegExp(`(?<!\\d)${days}(?!\\d)`, "u");
  return citedSentences.some((sentence) => asDigits.test(sentence));
}

/**
 * Reads the terms of one instance: what the model reported, checked against the
 * sentences the flag cites.
 */
export function readClauseTerms(
  reported: { readonly days: number; readonly runsAgainst: WindowToAct["runsAgainst"] } | null,
  citedSentences: readonly string[],
): ClauseTerms {
  if (reported === null) return { windowToAct: null };
  return {
    windowToAct: {
      days: reported.days,
      runsAgainst: reported.runsAgainst,
      statedInTheDocument: windowIsStatedIn(citedSentences, reported.days),
    },
  };
}

/** Whether this window is one the reader can actually use. */
function isAWindowTheReaderCanUse(window: WindowToAct | null): boolean {
  if (window === null) return false;
  if (window.runsAgainst !== "each-time-the-clause-bites") return false;
  if (!window.statedInTheDocument) return false;
  return window.days >= WINDOW_A_READER_CAN_USE_DAYS;
}

/**
 * The severity of one clause: where its type starts, what its terms did, and where
 * it landed.
 */
export function assignSeverity(slug: ClauseTypeSlug, terms: ClauseTerms): Severity {
  const baselineBand: SeverityBand = clauseType(slug).baselineBand;
  const movements: SeverityMovement[] = [];

  if (isAWindowTheReaderCanUse(terms.windowToAct)) {
    movements.push({
      code: "a-window-the-reader-can-use",
      direction: "toward-moderate",
      bands: 1,
    });
  }

  const band = movements.reduce(
    (at, movement) =>
      shiftBand(at, movement.direction === "toward-moderate" ? movement.bands : -movement.bands),
    baselineBand,
  );

  return { band, baselineBand, movements };
}
