/**
 * The seven clause types Redline flags, and the severity band each one starts at.
 *
 * Data, not behaviour. `PRD.md` section 5 is the source: the seven types, the
 * three bands, and the rule that the type sets a baseline band and the instance's
 * own terms move it. Nothing in this file looks at a document; it holds what is
 * true of a type before any particular clause is read.
 *
 * Two groupings are load-bearing and are recorded here rather than repeated:
 *
 * 1. `evidence`. Four of the seven rest on federal regulatory measurement and
 *    three rest on weaker ground (`ADR 0004`, `PRD.md` section 5). Ticket 13
 *    reports recall separately for the two groups, so the split is data here
 *    rather than a list written out again in the eval suite.
 * 2. `leversRemoved`. Severity runs on leverage lost (`ADR 0003`): what the reader
 *    would otherwise be able to do, meaning sue, leave, or refuse a change.
 *    Ranking (ticket 06) orders on it and breaks ties with it, and the band leads.
 *    Two types remove no lever and still carry a band above the floor, because
 *    what they take is money; an empty list is not a harmless clause.
 */

/** The three bands, worst first. Order is meaningful: index is distance from calm. */
export const SEVERITY_BANDS = ["critical", "high", "moderate"] as const;

export type SeverityBand = (typeof SEVERITY_BANDS)[number];

/**
 * What each band means, in `PRD.md`'s own terms, and the word the reader sees.
 *
 * The word is how severity is carried on screen. Colour identifies a flag and
 * never ranks it (DESIGN.md, The Identity-Not-Severity Rule), so this word and
 * the list order are the whole of it.
 */
export const SEVERITY_BAND_READING: Readonly<
  Record<SeverityBand, { readonly word: string; readonly says: string }>
> = {
  critical: { word: "Critical", says: "Removes a lever outright" },
  high: { word: "High", says: "Removes a lever, with a deadline or a cost attached" },
  moderate: { word: "Moderate", says: "Costs money, lever intact" },
};

/**
 * What a reader would otherwise be able to do, from `CONTEXT.md`: sue, leave, or
 * refuse a change. A clause that takes one of these takes leverage.
 */
export const LEVERS = ["sue", "leave", "refuse-a-change"] as const;

export type Lever = (typeof LEVERS)[number];

/**
 * How well measured the harm from a type is.
 *
 * `regulator-evidenced`: arbitration, auto-renewal, fee escalators and
 * non-competes, each resting on federal regulatory measurement.
 * `weaker-evidence`: limitation of liability and indemnification rest on WorldCC
 * data about how often lawyers negotiate a term, which is a proxy for commercial
 * friction rather than for consumer harm, and unilateral modification rests on
 * reasoning alone. Flag quality should be expected to track this.
 */
export const EVIDENCE_BASES = ["regulator-evidenced", "weaker-evidence"] as const;

export type EvidenceBase = (typeof EVIDENCE_BASES)[number];

/** One of the seven types. The slug is what crosses the model boundary. */
export type ClauseType = {
  readonly slug: ClauseTypeSlug;
  /** The name a reader reads, on a flag and in the list of what was checked. */
  readonly label: string;
  /** Where severity starts before the instance's terms are read. */
  readonly baselineBand: SeverityBand;
  readonly leversRemoved: readonly Lever[];
  readonly evidence: EvidenceBase;
};

/**
 * The seven slugs, in the order the fixtures and `scripts/verify-fixtures.mjs`
 * already use. That order is also the order a reader sees the checked list in.
 */
export const CLAUSE_TYPE_SLUGS = [
  "arbitration-and-class-action-waiver",
  "unilateral-modification",
  "non-compete",
  "auto-renewal",
  "limitation-of-liability",
  "indemnification",
  "fee-escalators-and-late-fees",
] as const;

export type ClauseTypeSlug = (typeof CLAUSE_TYPE_SLUGS)[number];

const BY_SLUG: Readonly<Record<ClauseTypeSlug, ClauseType>> = {
  "arbitration-and-class-action-waiver": {
    slug: "arbitration-and-class-action-waiver",
    label: "Arbitration and class-action waiver",
    baselineBand: "critical",
    // You keep the contract and lose the remedy.
    leversRemoved: ["sue"],
    evidence: "regulator-evidenced",
  },
  "unilateral-modification": {
    slug: "unilateral-modification",
    label: "Unilateral modification",
    baselineBand: "critical",
    // The document you read is not the document you are bound by.
    leversRemoved: ["refuse-a-change"],
    evidence: "weaker-evidence",
  },
  "non-compete": {
    slug: "non-compete",
    label: "Non-compete and restrictive covenants",
    baselineBand: "critical",
    // Walking away is still allowed and is priced at a year out of the field the
    // reader earns in, which is why this counts against leaving.
    leversRemoved: ["leave"],
    evidence: "regulator-evidenced",
  },
  "auto-renewal": {
    slug: "auto-renewal",
    label: "Auto-renewal and negative-option billing",
    baselineBand: "high",
    leversRemoved: ["leave"],
    evidence: "regulator-evidenced",
  },
  "limitation-of-liability": {
    slug: "limitation-of-liability",
    label: "Limitation of liability",
    baselineBand: "high",
    // The claim survives and the recovery does not, so what it takes is the remedy.
    leversRemoved: ["sue"],
    evidence: "weaker-evidence",
  },
  "indemnification": {
    slug: "indemnification",
    label: "Indemnification",
    baselineBand: "high",
    // Takes no lever. It is banded high on what it can cost, per PRD.md section 5,
    // so nothing downstream may read the empty list as a harmless clause.
    leversRemoved: [],
    evidence: "weaker-evidence",
  },
  "fee-escalators-and-late-fees": {
    slug: "fee-escalators-and-late-fees",
    label: "Fee escalators and late fees",
    baselineBand: "moderate",
    // Costs money, lever intact.
    leversRemoved: [],
    evidence: "regulator-evidenced",
  },
};

/** The seven, in reading order. This is the list of what Redline checks. */
export const CLAUSE_TYPES: readonly ClauseType[] = CLAUSE_TYPE_SLUGS.map((slug) => BY_SLUG[slug]);

/** True when a slug is one of the seven. Used before a model's word is trusted. */
export function isClauseTypeSlug(value: string): value is ClauseTypeSlug {
  return (CLAUSE_TYPE_SLUGS as readonly string[]).includes(value);
}

/** The type behind a slug. */
export function clauseType(slug: ClauseTypeSlug): ClauseType {
  return BY_SLUG[slug];
}

/** The name a reader reads for a slug. */
export function clauseTypeLabel(slug: ClauseTypeSlug): string {
  return BY_SLUG[slug].label;
}

/**
 * Moves a band by whole bands, stopping at the ends. `steps` is positive toward
 * `moderate` and negative toward `critical`, because `SEVERITY_BANDS` runs worst
 * first. Nothing outside severity assignment should need this.
 */
export function shiftBand(band: SeverityBand, steps: number): SeverityBand {
  const at = SEVERITY_BANDS.indexOf(band);
  const moved = Math.min(SEVERITY_BANDS.length - 1, Math.max(0, at + steps));
  return SEVERITY_BANDS[moved] ?? band;
}
