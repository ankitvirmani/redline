/**
 * External context: the facts from outside the document, and where each one comes
 * from.
 *
 * A flag states what the clause does to the reader, drawn from the clause's own
 * words. That claim is bound to a sentence the reader can hold against their own
 * document. A fact about clauses like it, from a regulator, is a different kind of
 * claim: its accuracy is ours rather than the document's, so it is a separate field
 * with its own source and it is marked as coming from outside (ADR 0007).
 *
 * Which is why this is a store and not a prompt. Nothing here is generated per
 * request and nothing is recalled by a model. Every entry was copied by hand from the
 * sourced list in `PRODUCT.md` under "Evidence on Hand" and the citations in `PRD.md`
 * section 5, and every entry carries the wording those files record alongside the
 * wording a reader sees, so a test can hold one against the other without a network
 * call and a person can review the whole store in one sitting.
 *
 * Three rules govern what may be added.
 *
 * 1. **Sourced by us, in this repository.** A fact that is true and is not in
 *    `PRODUCT.md` or `PRD.md` does not belong here, because the review that makes
 *    this store trustworthy has not happened for it.
 * 2. **The citation states the fact.** Not the neighbourhood of the fact. Where the
 *    repository records two things under one URL and the page behind it carries only
 *    one of them, only that one is written down here. The non-compete entry is that
 *    case: `PRD.md` records both the FTC's own estimate and a court blocking the rule
 *    in August 2024 under a single FTC link, and only the estimate is here, because
 *    citing an April press release for an August ruling is the defect this file
 *    exists to prevent.
 * 3. **No statutory right, anywhere.** Not a cancellation law, not a cooling-off
 *    period, not a right to sue, not "you may still have rights where you live"
 *    (ADR 0005). A regulator's measurement of what happens to people is not a
 *    statement about what the reader is entitled to, and the line between the two is
 *    checked in `src/domain/wording.ts` rather than trusted.
 *
 * Most clause types have no entry, and that is the ordinary case rather than a gap to
 * fill. The four that have one are the four resting on federal regulatory
 * measurement, read from `clauseType(slug).evidence` rather than listed again here:
 * the other three rest on lawyers' negotiating data or on reasoning, and there is no
 * regulator's figure to put under them.
 */

import type { ClauseTypeSlug } from "@/src/domain/clause-types";
import type { ExternalContext } from "./types";

// Both imports are type-only, so this file has no runtime dependency on anything. That
// is what lets `scripts/check-citations.mjs` load the store directly and check the URLs
// against the live web without pulling the app in with it.

/** Where a fact's wording was copied from, so a test can go and read it. */
export const SOURCED_FILES = ["PRODUCT.md", "PRD.md"] as const;

export type SourcedFile = (typeof SOURCED_FILES)[number];

/**
 * One fact, the source that states it, and the clause types it belongs under.
 *
 * `recorded` is the fact as `recordedIn` writes it, kept verbatim so that the wording
 * a reader sees can be checked against the wording we sourced. `fact` is the reader's
 * version: the same figures, in a sentence a worried non-lawyer can read at speed.
 * Nothing may appear in `fact` that `recorded` does not carry.
 */
export type ExternalContextEntry = {
  /** The fact as the reader reads it, on the flag. */
  readonly fact: string;
  /** The source, named where the reader can see it. */
  readonly source: { readonly title: string; readonly url: string };
  /** Which of the seven this fact sits under. */
  readonly clauseTypes: readonly ClauseTypeSlug[];
  /** The wording the repository records, copied verbatim. */
  readonly recorded: string;
  readonly recordedIn: SourcedFile;
};

/**
 * The store, in the order the accessor reads it.
 *
 * One entry per clause type today. A flag carries one external context, so a second
 * entry for a type would sit here unread; when a type earns two, the accessor is
 * where that choice gets made and it has to be made deliberately.
 */
export const EXTERNAL_CONTEXT: readonly ExternalContextEntry[] = [
  {
    clauseTypes: ["arbitration-and-class-action-waiver"],
    fact: "Consumers win 9% of the disputes they bring to arbitration. When the company counterclaims it wins relief 93% of the time, and the consumer ends up owing an average of $7,725.",
    source: {
      title: "Center for Justice & Democracy",
      url: "https://centerjd.org/content/fact-sheet-forced-arbitration-clauses-and-class-actions-waivers-numbers",
    },
    recorded:
      "Center for Justice & Democracy: 56.2% of private-sector nonunion employees are subject to forced arbitration; consumers win 9% of arbitration disputes; companies win relief 93% of the time when they counterclaim, leaving consumers owing an average of $7,725.",
    recordedIn: "PRODUCT.md",
  },
  {
    clauseTypes: ["auto-renewal"],
    fact: "Complaints to the Federal Trade Commission about subscriptions that keep billing went from 42 a day in 2021 to nearly 70 a day in 2024.",
    source: {
      title: "Federal Trade Commission figures, reported by Consumer Finance Monitor",
      url: "https://www.consumerfinancemonitor.com/2024/10/22/ftc-issues-final-click-to-cancel-rule-to-make-it-easier-for-consumers-to-cancel-enrollment-in-negative-option-programs/",
    },
    recorded:
      "FTC: negative-option complaints rose from 42 per day in 2021 to nearly 70 per day in 2024, driving the click-to-cancel rulemaking.",
    recordedIn: "PRODUCT.md",
  },
  {
    clauseTypes: ["non-compete"],
    fact: "The Federal Trade Commission estimated that its 2024 rule on non-competes would have covered roughly 30 million workers, about 18% of everyone working in the United States.",
    source: {
      title: "Federal Trade Commission",
      url: "https://www.ftc.gov/news-events/news/press-releases/2024/04/ftc-announces-rule-banning-noncompetes",
    },
    recorded:
      "FTC: the 2024 non-compete rule would have affected roughly 30 million workers, about 18% of the US workforce",
    recordedIn: "PRODUCT.md",
  },
  {
    clauseTypes: ["fee-escalators-and-late-fees"],
    fact: "Late fees on credit cards alone come to $14 billion a year, paid by more than 45 million people.",
    source: {
      title: "Consumer Financial Protection Bureau",
      url: "https://www.consumerfinance.gov/about-us/newsroom/cfpb-bans-excessive-credit-card-late-fees-lowers-typical-fee-from-32-to-8/",
    },
    recorded: "CFPB: credit card late fees run $14 billion a year across more than 45 million people.",
    recordedIn: "PRODUCT.md",
  },
];

/**
 * The fact that sits under a flag of this clause type, or null.
 *
 * Null is the common answer and it is not a missing value: three of the seven types
 * have no regulator's figure behind them, and a flag that shows only what the
 * document says is the whole product working. The first matching entry wins, which is
 * why the store's order is part of the store.
 */
export function externalContextFor(slug: ClauseTypeSlug): ExternalContext | null {
  const entry = EXTERNAL_CONTEXT.find((held) => held.clauseTypes.includes(slug));
  if (entry === undefined) return null;
  return { fact: entry.fact, source: entry.source };
}
