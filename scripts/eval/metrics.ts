/**
 * The eval suite's arithmetic, as pure functions over a corpus and a result set.
 *
 * Everything in this file is a function of its arguments: no clock, no model, no
 * network, no disk. That is deliberate, because these numbers are the thing the owner
 * is going to calibrate `PRD.md` section 4's proposed thresholds against, and a
 * measurement that cannot be checked is worth no more than a guess.
 * `tests/eval-metrics.test.ts` runs every function here against hand-built inputs with
 * the answers worked out by hand, and it runs on every commit while the rest of the
 * suite runs only on command.
 *
 * ## The matching rule, which is the whole measurement
 *
 * Recall asks what fraction of planted clauses the system found, and that needs a rule
 * for when a returned flag counts as having found one. Two rules are computed here and
 * both are reported, because the gap between them says something the owner needs.
 *
 * **Strict.** A flag finds a planted clause when the flag names the same clause type
 * and the flag's source sentence overlaps the planted sentence in the document. This
 * is the primary number. Overlap rather than string equality, because where a sentence
 * begins and ends is a judgement call: a model that quotes the same clause and stops
 * one subordinate clause earlier has found it, and a model that quotes a different
 * sentence somewhere else in the document has not. Overlap is measured on the located
 * spans, so it cannot be satisfied by a sentence that happens to look similar.
 *
 * **By type.** A planted clause counts found when the document produced any verified
 * flag of the same clause type, wherever it was cited. This is the looser number and
 * it answers a different question: whether the model found the right category even
 * when it cited the wrong clause of that category.
 *
 * A third figure is carried for diagnosis rather than reporting as recall: a planted
 * clause whose sentence a flag overlapped while naming a different type. That flag
 * read the right sentence and called it something else.
 *
 * ## Division by zero
 *
 * A clause type with no instances in the corpus has no recall, and 0/0 is not zero.
 * Every rate in this file is `number | null`, and null means there was nothing to
 * measure. A recall of 0 over no instances would read as a total failure of a type
 * nobody tested.
 */

import {
  CLAUSE_TYPE_SLUGS,
  clauseType,
  EVIDENCE_BASES,
  type ClauseTypeSlug,
  type EvidenceBase,
  type SeverityBand,
} from "@/src/domain/clause-types";
import type { SpanLocation } from "@/src/domain/verify";

/**
 * One clause the corpus says is in a document, with where its sentence sits.
 *
 * The span is carried rather than derived so this file never touches a document.
 * `scripts/eval/corpus.ts` locates every planted sentence with the product's own
 * verifier and refuses to load a corpus where one cannot be found.
 */
export type PlantedClause = {
  readonly documentId: string;
  /** The sidecar's own id, P-01 upward within its document. */
  readonly id: string;
  readonly clauseType: ClauseTypeSlug;
  readonly at: SpanLocation;
  readonly expectedSeverityBand: SeverityBand;
};

/** One flag that survived verification and reached the reader's order. */
export type ReturnedFlag = {
  readonly documentId: string;
  /** The flag's code, unique within its document's reading. */
  readonly code: string;
  readonly clauseType: ClauseTypeSlug;
  readonly at: SpanLocation;
  readonly band: SeverityBand;
  /** The verified sentence, carried so the report can print it for a human review. */
  readonly sourceSentence: string;
};

/** `documentId#id`, the key a planted clause is counted under. */
export function plantedKey(planted: PlantedClause): string {
  return `${planted.documentId}#${planted.id}`;
}

/** `documentId#code`, the key a flag is counted under. */
export function flagKey(flag: ReturnedFlag): string {
  return `${flag.documentId}#${flag.code}`;
}

/** Whether two located spans share at least one character. */
export function spansOverlap(left: SpanLocation, right: SpanLocation): boolean {
  return left.start < right.end && right.start < left.end;
}

/**
 * Which flags found which planted clauses, under both rules at once.
 *
 * Computed in one pass so that the strict set, the by-type set and the unmatched flags
 * cannot disagree with each other about the same pair.
 */
export type MatchSet = {
  /** Planted keys a flag found under the strict rule. */
  readonly strict: ReadonlySet<string>;
  /** Planted keys whose type turned up as a flag somewhere in the same document. */
  readonly byType: ReadonlySet<string>;
  /**
   * Planted keys a flag's sentence overlapped while naming a different clause type.
   * Diagnosis, not recall: the flag read the right sentence and called it something
   * else.
   */
  readonly sentenceOnly: ReadonlySet<string>;
  /** For each flag key, the planted key it found under the strict rule. */
  readonly strictMatchOf: ReadonlyMap<string, string>;
  /**
   * Flag keys that found no planted clause under the strict rule. Over-flagging, which
   * ADR 0004 accepts, and the denominator half of precision at the top band.
   */
  readonly unmatchedFlags: readonly string[];
  /**
   * How many flags beyond the first found the same planted clause. A corpus where the
   * model splits one clause across two flags inflates a flag count and not a recall.
   */
  readonly duplicateFlags: number;
};

export function matchFlags(
  planted: readonly PlantedClause[],
  flags: readonly ReturnedFlag[],
): MatchSet {
  const strict = new Set<string>();
  const byType = new Set<string>();
  const sentenceOnly = new Set<string>();
  const strictMatchOf = new Map<string, string>();
  const unmatchedFlags: string[] = [];
  const timesFound = new Map<string, number>();

  for (const clause of planted) {
    const key = plantedKey(clause);
    const inSameDocument = flags.filter((flag) => flag.documentId === clause.documentId);
    if (inSameDocument.some((flag) => flag.clauseType === clause.clauseType)) byType.add(key);
    if (
      inSameDocument.some(
        (flag) => flag.clauseType !== clause.clauseType && spansOverlap(flag.at, clause.at),
      )
    ) {
      sentenceOnly.add(key);
    }
  }

  for (const flag of flags) {
    const found = planted.find(
      (clause) =>
        clause.documentId === flag.documentId &&
        clause.clauseType === flag.clauseType &&
        spansOverlap(clause.at, flag.at),
    );
    if (found === undefined) {
      unmatchedFlags.push(flagKey(flag));
      continue;
    }
    const key = plantedKey(found);
    strict.add(key);
    strictMatchOf.set(flagKey(flag), key);
    timesFound.set(key, (timesFound.get(key) ?? 0) + 1);
  }

  let duplicateFlags = 0;
  for (const times of timesFound.values()) duplicateFlags += times - 1;

  return { strict, byType, sentenceOnly, strictMatchOf, unmatchedFlags, duplicateFlags };
}

/** A rate with the counts behind it. Null where there was nothing to divide by. */
export type Rate = {
  readonly found: number;
  readonly instances: number;
  readonly rate: number | null;
};

function rateOf(found: number, instances: number): Rate {
  return { found, instances, rate: instances === 0 ? null : found / instances };
}

/** What one clause type scored, under both rules, with the counts. */
export type ClauseTypeRecall = {
  readonly clauseType: ClauseTypeSlug;
  readonly evidence: EvidenceBase;
  readonly strict: Rate;
  readonly byType: Rate;
  /** Planted clauses whose sentence was cited under a different type. */
  readonly sentenceCitedUnderAnotherType: number;
};

/** Recall per clause type, all seven always present, even at zero instances. */
export function recallByClauseType(
  planted: readonly PlantedClause[],
  flags: readonly ReturnedFlag[],
  matches: MatchSet = matchFlags(planted, flags),
): readonly ClauseTypeRecall[] {
  return CLAUSE_TYPE_SLUGS.map((slug) => {
    const instances = planted.filter((clause) => clause.clauseType === slug);
    const keys = instances.map(plantedKey);
    return {
      clauseType: slug,
      evidence: clauseType(slug).evidence,
      strict: rateOf(keys.filter((key) => matches.strict.has(key)).length, keys.length),
      byType: rateOf(keys.filter((key) => matches.byType.has(key)).length, keys.length),
      sentenceCitedUnderAnotherType: keys.filter(
        (key) => !matches.strict.has(key) && matches.sentenceOnly.has(key),
      ).length,
    };
  });
}

/** What one evidence group scored. `PRD.md` section 4 proposes a figure for each. */
export type EvidenceRecall = {
  readonly evidence: EvidenceBase;
  readonly clauseTypes: readonly ClauseTypeSlug[];
  readonly strict: Rate;
  readonly byType: Rate;
};

/**
 * Recall split the way `PRD.md` section 4 asks for it: the four types resting on
 * federal regulatory measurement apart from the three resting on weaker ground. The
 * split comes off `src/domain/clause-types.ts` rather than a list written out here.
 */
export function recallByEvidence(
  planted: readonly PlantedClause[],
  flags: readonly ReturnedFlag[],
  matches: MatchSet = matchFlags(planted, flags),
): readonly EvidenceRecall[] {
  return EVIDENCE_BASES.map((evidence) => {
    const slugs = CLAUSE_TYPE_SLUGS.filter((slug) => clauseType(slug).evidence === evidence);
    const keys = planted
      .filter((clause) => slugs.includes(clause.clauseType))
      .map(plantedKey);
    return {
      evidence,
      clauseTypes: slugs,
      strict: rateOf(keys.filter((key) => matches.strict.has(key)).length, keys.length),
      byType: rateOf(keys.filter((key) => matches.byType.has(key)).length, keys.length),
    };
  });
}

/**
 * Precision at the top severity band, as far as a run without a person in it can
 * compute it.
 *
 * `PRD.md` section 4 asks what fraction of top-band flags survive review by someone
 * reading the source sentence. That review is human and does not happen in a run, so
 * this is the proxy the ticket names: the fraction of top-band flags that found a
 * planted clause the corpus labelled critical. It is not the measurement, and the
 * report says so. The two looser figures are carried beside it because the gap tells
 * the owner which way the proxy is wrong: a top-band flag can find a planted clause
 * the corpus banded lower, which is a severity disagreement rather than a false flag,
 * and it can find nothing planted at all, which is the over-flagging ADR 0004 accepts
 * and the only case a human reviewer would call an error.
 */
export type TopBandPrecision = {
  readonly band: SeverityBand;
  readonly topBandFlags: number;
  /** Top-band flags that found a planted clause the corpus banded at the top. */
  readonly foundACriticalPlantedClause: number;
  /** Top-band flags that found a planted clause the corpus banded lower. */
  readonly foundALowerBandedPlantedClause: number;
  /** Top-band flags that found no planted clause at all. */
  readonly foundNothingPlanted: number;
  /** foundACriticalPlantedClause / topBandFlags, or null with no top-band flags. */
  readonly precision: number | null;
  /** Every top-band flag that found a planted clause, at either band. */
  readonly precisionAgainstAnyPlantedClause: number | null;
};

export function precisionAtTopBand(
  planted: readonly PlantedClause[],
  flags: readonly ReturnedFlag[],
  band: SeverityBand = "critical",
  matches: MatchSet = matchFlags(planted, flags),
): TopBandPrecision {
  const byKey = new Map(planted.map((clause) => [plantedKey(clause), clause]));
  const topBand = flags.filter((flag) => flag.band === band);

  let critical = 0;
  let lower = 0;
  let nothing = 0;
  for (const flag of topBand) {
    const matched = matches.strictMatchOf.get(flagKey(flag));
    const clause = matched === undefined ? undefined : byKey.get(matched);
    if (clause === undefined) {
      nothing += 1;
      continue;
    }
    if (clause.expectedSeverityBand === band) critical += 1;
    else lower += 1;
  }

  return {
    band,
    topBandFlags: topBand.length,
    foundACriticalPlantedClause: critical,
    foundALowerBandedPlantedClause: lower,
    foundNothingPlanted: nothing,
    precision: topBand.length === 0 ? null : critical / topBand.length,
    precisionAgainstAnyPlantedClause:
      topBand.length === 0 ? null : (critical + lower) / topBand.length,
  };
}

/**
 * Whether arbitration outranks a merely unusual clause, in one document's reading.
 *
 * `PRD.md` section 4 makes this a specified behaviour rather than a measurement: an
 * order driven by how unusual a clause is would bury the clause that costs the reader
 * most, and this is the assertion that catches it. It is checked as a rank comparison
 * over the flags a document actually produced, so a document whose arbitration clause
 * the model missed has nothing to say here and reports `not-applicable` rather than a
 * pass.
 *
 * The comparison is against every flag banded below the top, which is what a "merely
 * unusual" clause looks like once it has been flagged: it costs money, or it costs a
 * deadline, and it does not take a lever outright.
 */
export type RankingCheck =
  | { readonly outcome: "held"; readonly arbitrationRank: number; readonly comparedWith: number }
  | { readonly outcome: "not-applicable"; readonly why: string }
  | {
      readonly outcome: "broken";
      readonly arbitrationRank: number;
      readonly outrankedBy: readonly { readonly code: string; readonly rank: number; readonly band: SeverityBand }[];
    };

/** One flag in the order the reader reads it. Rank is 1 upward and contiguous. */
export type RankedForCheck = {
  readonly code: string;
  readonly clauseType: ClauseTypeSlug;
  readonly band: SeverityBand;
  readonly rank: number;
};

export function arbitrationOutranksTheMerelyUnusual(
  ranked: readonly RankedForCheck[],
): RankingCheck {
  const arbitration = ranked.filter(
    (flag) => flag.clauseType === "arbitration-and-class-action-waiver",
  );
  if (arbitration.length === 0) {
    return { outcome: "not-applicable", why: "no arbitration flag in this reading" };
  }
  const best = arbitration.reduce((at, flag) => (flag.rank < at.rank ? flag : at));

  const merelyUnusual = ranked.filter((flag) => flag.band !== "critical");
  if (merelyUnusual.length === 0) {
    return { outcome: "not-applicable", why: "no flag below the top band to compare against" };
  }

  const outrankedBy = merelyUnusual
    .filter((flag) => flag.rank < best.rank)
    .map((flag) => ({ code: flag.code, rank: flag.rank, band: flag.band }));

  if (outrankedBy.length > 0) {
    return { outcome: "broken", arbitrationRank: best.rank, outrankedBy };
  }
  return { outcome: "held", arbitrationRank: best.rank, comparedWith: merelyUnusual.length };
}

/**
 * Refusal on questions the document cannot answer, and answering on questions it can.
 *
 * Both halves are counted, because a product that refused everything would score 100
 * percent refusal and be useless. The refusal figure means nothing without the
 * answered figure beside it.
 */
export type QuestionOutcome = "answered" | "refused" | "not-asked" | "failed";

export type QuestionTally = {
  readonly asked: number;
  readonly answered: number;
  readonly refused: number;
  readonly failed: number;
  readonly notAsked: number;
  /** refused / asked for ungrounded questions, answered / asked for grounded ones. */
  readonly rate: number | null;
};

export function tallyQuestions(
  outcomes: readonly QuestionOutcome[],
  counting: "refusals" | "answers",
): QuestionTally {
  const answered = outcomes.filter((outcome) => outcome === "answered").length;
  const refused = outcomes.filter((outcome) => outcome === "refused").length;
  const failed = outcomes.filter((outcome) => outcome === "failed").length;
  const notAsked = outcomes.filter((outcome) => outcome === "not-asked").length;
  const wanted = counting === "refusals" ? refused : answered;
  return {
    asked: outcomes.length,
    answered,
    refused,
    failed,
    notAsked,
    rate: outcomes.length === 0 ? null : wanted / outcomes.length,
  };
}

/** A rate as a percentage to one decimal place, or the reason there is no number. */
export function asPercentage(rate: number | null): string {
  return rate === null ? "no instances" : `${(rate * 100).toFixed(1)}%`;
}
