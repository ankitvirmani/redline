/**
 * The analysis seam: what goes in, and what comes out.
 *
 * Seam two of the four in the spec. Extracted text in; a plain-English summary,
 * the set of clause types checked, and the verified flags out. Every flag carries
 * the exact sentence it was drawn from, a severity, a confidence, a consequence
 * and any exit the document itself grants.
 *
 * Written to be extended rather than replaced, because six later tickets build on
 * it:
 *
 * - Ticket 05 fills `Summary`. The field is carried here and its content is 05's.
 * - Ticket 06 ranks. It consumes `Flag.severity.band` and `Flag.leverage`, and it
 *   adds the order. Flags come out of here unordered on purpose: returning them in
 *   an order that looked right would hide whether ranking works.
 * - Ticket 07 renders what was checked, from `DocumentAnalysis.checkedClauseTypes`
 *   rather than from a constant in a component.
 * - Ticket 08 fills `Consequence.externalContext` from the curated fact base, and
 *   renders `Flag.exit`. Both fields are carried here and neither is filled here.
 * - Ticket 09 reuses `SourceSentence` and the verifier for answers.
 * - Ticket 13 counts `DocumentAnalysis.defects`.
 *
 * Nothing on a flag is optional. A field a later ticket fills is present and null,
 * so that adding the content changes one producer rather than every consumer.
 */

import type {
  ClauseTypeSlug,
  Lever,
  SeverityBand,
} from "@/src/domain/clause-types";
import type { ExtractedDocument } from "@/src/extraction";
import type { ModelClient } from "@/src/model/client";

import type { Defect } from "./defects";
import type { SpanLocation } from "./verify";

export type { ClauseTypeSlug, Lever, SeverityBand };
export type { Defect } from "./defects";
export type { SpanLocation } from "./verify";

/**
 * A sentence from the document, quoted verbatim, with where it was found.
 *
 * Nothing constructs one of these except verification. That is what makes the
 * type worth having: a `SourceSentence` in hand is a sentence that has already
 * been held against the document character for character.
 */
export type SourceSentence = {
  /** The sentence, exactly as it appears in the document. */
  readonly text: string;
  /** Where it sits, in UTF-16 code units. See `SpanLocation`. */
  readonly at: SpanLocation;
  /** How many times the sentence appears in the document. Usually one. */
  readonly occurrences: number;
};

/** The terms of the clause that can move its band. Reported by the model. */
export type ClauseTerms = {
  /**
   * The window the document gives the reader to act before this clause bites,
   * where the document states one. Null when it states none.
   */
  readonly windowToAct: WindowToAct | null;
};

export type WindowToAct = {
  /** How many days the document gives. */
  readonly days: number;
  /**
   * What the window runs against. A window before every renewal is one the reader
   * can still use; a single window at signing has expired long before the risk
   * exists, which is why the two cannot be treated alike.
   */
  readonly runsAgainst: WindowRunsAgainst;
  /**
   * Whether the day count appears as digits in one of the sentences this flag
   * cites. Set by code, never by the model: a term that moves severity is checked
   * against the document the same way a source sentence is, and a term that cannot
   * be checked does not move the band.
   */
  readonly statedInTheDocument: boolean;
};

export const WINDOW_RUNS_AGAINST = ["each-time-the-clause-bites", "once-at-the-start"] as const;

export type WindowRunsAgainst = (typeof WINDOW_RUNS_AGAINST)[number];

/** Every way the instance's terms can move a band. Meant to gain members. */
export const SEVERITY_MOVEMENT_CODES = ["a-window-the-reader-can-use"] as const;

export type SeverityMovementCode = (typeof SEVERITY_MOVEMENT_CODES)[number];

/**
 * One movement applied to the baseline, and which way it went. Kept as data
 * rather than as a sentence so that a screen, the eval suite and a reviewer can
 * each word it for themselves.
 */
export type SeverityMovement = {
  readonly code: SeverityMovementCode;
  readonly direction: "toward-critical" | "toward-moderate";
  readonly bands: number;
};

/**
 * A flag's severity: where it landed, where its type alone would have put it, and
 * what the instance's own terms did in between.
 *
 * The baseline and the movements are carried, not just the result, so that two
 * flags of one type landing in different bands can be seen to have done it on
 * their terms rather than on their type.
 */
export type Severity = {
  readonly band: SeverityBand;
  readonly baselineBand: SeverityBand;
  readonly movements: readonly SeverityMovement[];
};

/** What a reader loses. Ticket 06 orders on this and the band leads. */
export type Leverage = {
  /** Which of sue, leave and refuse-a-change this clause takes. May be empty. */
  readonly leversRemoved: readonly Lever[];
};

/** A fact from outside the document, with its own source. Ticket 08 fills these. */
export type ExternalContext = {
  readonly fact: string;
  readonly source: { readonly title: string; readonly url: string };
};

/**
 * What the clause does to the reader. Two tiers, never one string: the claim from
 * the document leads, and anything from outside it is a separate field carrying its
 * own source (ADR 0007). `externalContext` is null here; ticket 08 fills it from
 * the curated fact base.
 */
export type Consequence = {
  readonly fromTheDocument: string;
  readonly externalContext: ExternalContext | null;
};

/**
 * A way out the document itself grants, with the sentence that grants it. Document
 * sourced only: no statutory right, no cooling-off period we happen to know about
 * (ADR 0005). Ticket 08 renders it.
 */
export type DocumentGrantedExit = {
  readonly text: string;
  readonly sourceSentence: SourceSentence;
};

/**
 * One flag: a clause that could hurt the reader, and the sentence it came from.
 *
 * A `Flag` cannot be built without a verified source sentence, so no render path
 * can display an unverifiable one; one never leaves the seam.
 */
export type Flag = {
  /**
   * The flag's code, as the chip in the document shows it. It identifies a flag
   * and does not rank it: codes run in the order the model returned verified
   * flags, and ticket 06 adds rank beside the code without renumbering.
   */
  readonly code: string;
  readonly clauseType: ClauseTypeSlug;
  readonly sourceSentence: SourceSentence;
  readonly severity: Severity;
  /** How sure the analysis is the clause is what it says, from 0 to 1. Not severity. */
  readonly confidence: number;
  readonly consequence: Consequence;
  readonly exit: DocumentGrantedExit | null;
  readonly terms: ClauseTerms;
  readonly leverage: Leverage;
};

/** The document in a few plain sentences. Ticket 05 owns what it says. */
export type Summary = {
  readonly text: string;
};

/** What the seam hands on. */
export type DocumentAnalysis = {
  readonly summary: Summary;
  /** The seven types, from data, so a screen never prints its own list. */
  readonly checkedClauseTypes: readonly ClauseTypeSlug[];
  /** Verified and unordered. Ticket 06 orders them; do not sort them before it. */
  readonly flags: readonly Flag[];
  /** What was dropped reading this document, and why. Ticket 13 counts these. */
  readonly defects: readonly Defect[];
};

/**
 * Why there is no analysis. Both are states the shell designs copy for, not error
 * chrome: the model could not be reached, or it answered with something that did
 * not match the schema and so could not be trusted a field at a time.
 */
export const ANALYSIS_FAILURE_REASONS = [
  "model-not-configured",
  "model-unavailable",
  "model-response-rejected",
] as const;

export type AnalysisFailureReason = (typeof ANALYSIS_FAILURE_REASONS)[number];

/** What analysis returns: a reading of the document, or the reason there is none. */
export type Analysis =
  | { readonly outcome: "analysed"; readonly analysis: DocumentAnalysis }
  | { readonly outcome: "failed"; readonly reason: AnalysisFailureReason };

/**
 * What the seam is handed. The whole extracted document rather than its text, so
 * that verification runs against the same characters extraction stored and nothing
 * downstream is tempted to re-derive them. The model client is injected, which is
 * what lets the deterministic suite run with no key and no network.
 */
export type AnalysisRequest = {
  readonly document: ExtractedDocument;
  readonly model: ModelClient;
};
