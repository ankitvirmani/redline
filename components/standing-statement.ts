/**
 * The two things Redline says about itself on every analysis.
 *
 * Kept out of the component for the same reason `flag-view.ts` and `summary-view.ts`
 * are: what a reader ends up seeing can then be held against the wording checks in
 * `src/analysis/wording.ts` without a browser, and the copy has one home rather than
 * being retyped wherever the statement is placed.
 *
 * Neither statement may drift into the thing it is warning about. Saying Redline does
 * not know whether a clause holds up where the reader lives is a statement about
 * Redline. Saying a clause is void in California would be a statement about the law,
 * and it would breach ADR 0005 in the middle of the sentence promising not to.
 *
 * This is the one place in the product allowed to say "where you live", and the flag
 * check in `wording.ts` catches that wording everywhere else. The exemption is narrow
 * and deliberate: a warning that Redline does not account for the reader's
 * jurisdiction cannot be written without naming it. `tests/flag-content.test.ts` holds
 * these lines to the other three kinds of verdict, so the exemption buys nothing else.
 */

export const STANDING_STATEMENT = {
  heading: "What Redline does not tell you",
  jurisdiction:
    "Redline reads what a clause says and what it does. It does not know where you live, and it never tells you whether a clause holds up there. Where you live can change what a clause does to you, and Redline does not take that into account.",
  legalAdvice: "Redline describes documents. It does not give legal advice.",
} as const;

/** Both statements, for a check that has to run over every word a reader is shown. */
export const STANDING_STATEMENT_LINES: readonly string[] = [
  STANDING_STATEMENT.heading,
  STANDING_STATEMENT.jurisdiction,
  STANDING_STATEMENT.legalAdvice,
];
