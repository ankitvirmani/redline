/**
 * The eval suite's arithmetic, checked against inputs whose answers were worked out by
 * hand.
 *
 * This is the part of ticket 13 that runs on every commit. The rest of the suite runs
 * only when someone types `npm run eval` and pays for it, which means the recall
 * calculation, the matching rule, the precision calculation and the per-type split get
 * exercised over a real corpus once in a while and over these inputs constantly. That
 * is the right way round: a wrong measurement is worse than no measurement, because the
 * owner is going to calibrate `PRD.md` section 4's thresholds against whatever these
 * functions say.
 *
 * The hand corpus is deliberately awkward. It carries a flag that quotes the right
 * sentence under the wrong clause type, a flag that quotes a sentence nobody planted,
 * two flags that quote the same planted clause, three clause types with no instances at
 * all, and it is run once with no flags in it. Every one of those is a case where an
 * obvious implementation returns something confidently wrong, and the worst of them is
 * the type with no instances: 0/0 is not a recall of zero, and a suite that reported one
 * would tell the owner a type had failed completely when nothing had tested it.
 */

import { describe, expect, it } from "vitest";

import {
  arbitrationOutranksTheMerelyUnusual,
  asPercentage,
  flagKey,
  matchFlags,
  plantedKey,
  precisionAtTopBand,
  recallByClauseType,
  recallByEvidence,
  spansOverlap,
  tallyQuestions,
  type PlantedClause,
  type RankedForCheck,
  type ReturnedFlag,
} from "@/scripts/eval/metrics";

// ── the hand corpus ───────────────────────────────────────────────────────────
//
// Two documents. Four planted clauses. Spans are made up and never overlap each
// other, exactly as sentences in a document do not.

const PLANTED: readonly PlantedClause[] = [
  {
    documentId: "d1",
    id: "P-01",
    clauseType: "arbitration-and-class-action-waiver",
    at: { start: 100, end: 200 },
    expectedSeverityBand: "critical",
  },
  {
    documentId: "d1",
    id: "P-02",
    clauseType: "auto-renewal",
    at: { start: 300, end: 400 },
    expectedSeverityBand: "high",
  },
  {
    documentId: "d1",
    id: "P-03",
    clauseType: "fee-escalators-and-late-fees",
    at: { start: 500, end: 600 },
    expectedSeverityBand: "moderate",
  },
  {
    documentId: "d2",
    id: "P-01",
    clauseType: "non-compete",
    at: { start: 50, end: 150 },
    expectedSeverityBand: "critical",
  },
];

function flag(
  documentId: string,
  code: string,
  clauseType: ReturnedFlag["clauseType"],
  start: number,
  end: number,
  band: ReturnedFlag["band"],
): ReturnedFlag {
  return { documentId, code, clauseType, at: { start, end }, band, sourceSentence: `${code} text` };
}

/**
 * The flags, and what each one is here to prove.
 *
 * F-1  quotes P-01's sentence under P-01's type. The straightforward find.
 * F-2  quotes part of the same sentence under the same type. A second flag on one
 *      planted clause, which must raise recall no further and must be counted.
 * F-3  quotes P-02's sentence and calls it indemnification. Right sentence, wrong
 *      type: P-02 is a strict miss, and the run should be able to say the sentence was
 *      read rather than missed.
 * F-4  quotes a stretch of d1 nobody planted, under a type that is planted elsewhere in
 *      d1. It finds nothing strictly and still satisfies the looser by-type rule for
 *      P-03, which is exactly the gap the two rules exist to show.
 * F-5  quotes a stretch of d2 nobody planted, under d2's own planted type. Same shape
 *      as F-4 and at the top band, so precision has something to fail on.
 */
const FLAGS: readonly ReturnedFlag[] = [
  flag("d1", "F-1", "arbitration-and-class-action-waiver", 100, 200, "critical"),
  flag("d1", "F-2", "arbitration-and-class-action-waiver", 120, 180, "critical"),
  flag("d1", "F-3", "indemnification", 300, 400, "high"),
  flag("d1", "F-4", "fee-escalators-and-late-fees", 700, 800, "moderate"),
  flag("d2", "F-5", "non-compete", 900, 1000, "critical"),
];

const key = (documentId: string, id: string): string => `${documentId}#${id}`;

describe("spansOverlap", () => {
  it("is true when the spans share a character", () => {
    expect(spansOverlap({ start: 100, end: 200 }, { start: 150, end: 250 })).toBe(true);
  });

  it("is false when one span ends exactly where the next begins", () => {
    // Two sentences that touch are two sentences. A rule that called this an overlap
    // would let a flag on the following sentence count as finding this one.
    expect(spansOverlap({ start: 100, end: 200 }, { start: 200, end: 300 })).toBe(false);
  });

  it("is false when the spans are far apart", () => {
    expect(spansOverlap({ start: 100, end: 200 }, { start: 700, end: 800 })).toBe(false);
  });

  it("is true when one span is wholly inside the other", () => {
    // A model that quotes the clause and stops one subordinate clause early has found
    // the clause. Where a sentence ends is a judgement call; which clause it is, is not.
    expect(spansOverlap({ start: 100, end: 200 }, { start: 120, end: 180 })).toBe(true);
  });
});

describe("keys", () => {
  it("names a planted clause by its document and its sidecar id", () => {
    expect(plantedKey(PLANTED[0]!)).toBe("d1#P-01");
  });

  it("names a flag by its document and its code, so two documents can share a code", () => {
    expect(flagKey(FLAGS[0]!)).toBe("d1#F-1");
    expect(flagKey(FLAGS[4]!)).toBe("d2#F-5");
  });
});

describe("matchFlags over the hand corpus", () => {
  const matches = matchFlags(PLANTED, FLAGS);

  it("finds d1 P-01 strictly, and nothing else strictly", () => {
    expect([...matches.strict].sort()).toEqual([key("d1", "P-01")]);
  });

  it("finds three of the four by type", () => {
    // P-01 through F-1, P-03 through F-4's type, d2 P-01 through F-5's type. P-02's
    // type never appeared as a flag in d1 at all.
    expect([...matches.byType].sort()).toEqual([
      key("d1", "P-01"),
      key("d1", "P-03"),
      key("d2", "P-01"),
    ]);
  });

  it("records that P-02's sentence was quoted under another type", () => {
    expect([...matches.sentenceOnly]).toEqual([key("d1", "P-02")]);
  });

  it("maps both arbitration flags onto the one planted clause they found", () => {
    expect(matches.strictMatchOf.get("d1#F-1")).toBe(key("d1", "P-01"));
    expect(matches.strictMatchOf.get("d1#F-2")).toBe(key("d1", "P-01"));
    expect(matches.strictMatchOf.size).toBe(2);
  });

  it("counts the second flag on one planted clause as a duplicate, not as a second find", () => {
    expect(matches.duplicateFlags).toBe(1);
  });

  it("leaves the three flags that found no planted clause unmatched", () => {
    expect([...matches.unmatchedFlags].sort()).toEqual(["d1#F-3", "d1#F-4", "d2#F-5"]);
  });
});

describe("recallByClauseType over the hand corpus", () => {
  const rows = recallByClauseType(PLANTED, FLAGS);
  const row = (slug: string) => rows.find((entry) => entry.clauseType === slug)!;

  it("reports all seven types whether or not the corpus holds one", () => {
    expect(rows).toHaveLength(7);
  });

  it("gives arbitration 1 of 1 under both rules", () => {
    expect(row("arbitration-and-class-action-waiver").strict).toEqual({
      found: 1,
      instances: 1,
      rate: 1,
    });
    expect(row("arbitration-and-class-action-waiver").byType.rate).toBe(1);
  });

  it("gives auto-renewal 0 of 1 under both rules, and names the sentence read as another type", () => {
    const autoRenewal = row("auto-renewal");
    expect(autoRenewal.strict).toEqual({ found: 0, instances: 1, rate: 0 });
    expect(autoRenewal.byType).toEqual({ found: 0, instances: 1, rate: 0 });
    expect(autoRenewal.sentenceCitedUnderAnotherType).toBe(1);
  });

  it("gives fee escalators 0 strict and 1 by type, which is the gap between the rules", () => {
    expect(row("fee-escalators-and-late-fees").strict.rate).toBe(0);
    expect(row("fee-escalators-and-late-fees").byType.rate).toBe(1);
  });

  it("gives non-compete 0 strict and 1 by type across a second document", () => {
    expect(row("non-compete").strict).toEqual({ found: 0, instances: 1, rate: 0 });
    expect(row("non-compete").byType).toEqual({ found: 1, instances: 1, rate: 1 });
  });

  it("reports no rate at all for a type the corpus holds no instance of", () => {
    // This is the division by zero the owner would meet at the worst moment. A recall
    // of 0 here would read as a type that failed completely rather than one nobody
    // tested.
    for (const slug of ["unilateral-modification", "limitation-of-liability", "indemnification"]) {
      expect(row(slug).strict).toEqual({ found: 0, instances: 0, rate: null });
      expect(row(slug).byType.rate).toBeNull();
    }
  });

  it("carries the evidence group off the clause type data rather than a list of its own", () => {
    expect(row("arbitration-and-class-action-waiver").evidence).toBe("regulator-evidenced");
    expect(row("indemnification").evidence).toBe("weaker-evidence");
  });
});

describe("recallByEvidence over the hand corpus", () => {
  const rows = recallByEvidence(PLANTED, FLAGS);
  const group = (name: string) => rows.find((entry) => entry.evidence === name)!;

  it("puts all four planted clauses in the regulator-evidenced group", () => {
    // Arbitration, non-compete, auto-renewal and fee escalators are the four. Every
    // planted clause in the hand corpus is one of them, which is why the other group is
    // empty and is the case worth having here.
    expect(group("regulator-evidenced").strict).toEqual({ found: 1, instances: 4, rate: 0.25 });
    expect(group("regulator-evidenced").byType).toEqual({ found: 3, instances: 4, rate: 0.75 });
  });

  it("reports no rate for the group with no instances", () => {
    expect(group("weaker-evidence").strict).toEqual({ found: 0, instances: 0, rate: null });
    expect(group("weaker-evidence").byType.rate).toBeNull();
  });

  it("names the clause types in each group", () => {
    expect(group("weaker-evidence").clauseTypes).toEqual([
      "unilateral-modification",
      "limitation-of-liability",
      "indemnification",
    ]);
  });
});

describe("an empty result set", () => {
  it("is a recall of zero over the instances there were, and not a division by zero", () => {
    const rows = recallByClauseType(PLANTED, []);
    const arbitration = rows.find(
      (row) => row.clauseType === "arbitration-and-class-action-waiver",
    )!;
    expect(arbitration.strict).toEqual({ found: 0, instances: 1, rate: 0 });
    const indemnity = rows.find((row) => row.clauseType === "indemnification")!;
    expect(indemnity.strict).toEqual({ found: 0, instances: 0, rate: null });
  });

  it("matches nothing and records no duplicate", () => {
    const matches = matchFlags(PLANTED, []);
    expect(matches.strict.size).toBe(0);
    expect(matches.byType.size).toBe(0);
    expect(matches.unmatchedFlags).toEqual([]);
    expect(matches.duplicateFlags).toBe(0);
  });

  it("leaves precision at the top band with no number, because there is nothing to divide", () => {
    const precision = precisionAtTopBand(PLANTED, []);
    expect(precision.topBandFlags).toBe(0);
    expect(precision.precision).toBeNull();
    expect(precision.precisionAgainstAnyPlantedClause).toBeNull();
  });
});

describe("a corpus with nothing planted in it", () => {
  it("leaves every flag unmatched and every recall without a number", () => {
    const matches = matchFlags([], FLAGS);
    expect(matches.unmatchedFlags).toHaveLength(FLAGS.length);
    for (const row of recallByClauseType([], FLAGS)) {
      expect(row.strict.rate).toBeNull();
      expect(row.byType.rate).toBeNull();
    }
  });
});

describe("precisionAtTopBand", () => {
  it("counts a top-band flag that found a planted clause the corpus banded at the top", () => {
    const precision = precisionAtTopBand(PLANTED, [
      flag("d1", "F-1", "arbitration-and-class-action-waiver", 100, 200, "critical"),
    ]);
    expect(precision).toMatchObject({
      topBandFlags: 1,
      foundACriticalPlantedClause: 1,
      foundALowerBandedPlantedClause: 0,
      foundNothingPlanted: 0,
      precision: 1,
    });
  });

  it("keeps a severity disagreement apart from a flag that found nothing", () => {
    // Both would read as a false flag to a reviewer counting only the headline number,
    // and they are two different findings: the first is the band being argued about,
    // the second is a clause the corpus says is not there.
    const precision = precisionAtTopBand(PLANTED, [
      // Found P-02, which the corpus bands high, and rendered it at the top band.
      flag("d1", "F-6", "auto-renewal", 300, 400, "critical"),
      // Found nothing planted.
      flag("d2", "F-5", "non-compete", 900, 1000, "critical"),
    ]);
    expect(precision).toMatchObject({
      topBandFlags: 2,
      foundACriticalPlantedClause: 0,
      foundALowerBandedPlantedClause: 1,
      foundNothingPlanted: 1,
      precision: 0,
      precisionAgainstAnyPlantedClause: 0.5,
    });
  });

  it("ignores flags below the top band entirely", () => {
    const precision = precisionAtTopBand(PLANTED, [
      flag("d1", "F-7", "fee-escalators-and-late-fees", 500, 600, "moderate"),
      flag("d1", "F-8", "auto-renewal", 300, 400, "high"),
    ]);
    expect(precision.topBandFlags).toBe(0);
    expect(precision.precision).toBeNull();
  });

  it("counts two flags on one planted clause twice, because a reader reads two flags", () => {
    const precision = precisionAtTopBand(PLANTED, [
      flag("d1", "F-1", "arbitration-and-class-action-waiver", 100, 200, "critical"),
      flag("d1", "F-2", "arbitration-and-class-action-waiver", 120, 180, "critical"),
    ]);
    expect(precision.topBandFlags).toBe(2);
    expect(precision.foundACriticalPlantedClause).toBe(2);
  });

  it("can be asked about a band other than the top one", () => {
    const precision = precisionAtTopBand(
      PLANTED,
      [flag("d1", "F-8", "auto-renewal", 300, 400, "high")],
      "high",
    );
    expect(precision).toMatchObject({ band: "high", topBandFlags: 1, foundACriticalPlantedClause: 1 });
  });
});

describe("arbitrationOutranksTheMerelyUnusual", () => {
  const ranked = (
    entries: readonly [string, RankedForCheck["clauseType"], RankedForCheck["band"]][],
  ): readonly RankedForCheck[] =>
    entries.map(([code, clauseType, band], index) => ({ code, clauseType, band, rank: index + 1 }));

  it("holds when arbitration leads and a moderate clause follows", () => {
    const check = arbitrationOutranksTheMerelyUnusual(
      ranked([
        ["F-1", "arbitration-and-class-action-waiver", "critical"],
        ["F-2", "indemnification", "high"],
        ["F-3", "fee-escalators-and-late-fees", "moderate"],
      ]),
    );
    expect(check).toEqual({ outcome: "held", arbitrationRank: 1, comparedWith: 2 });
  });

  it("is broken when a clause below the top band is read first", () => {
    // This is the ranking a deviation-from-norm order would produce: the odd clause
    // leads and the ubiquitous one that costs the reader their remedy is buried.
    const check = arbitrationOutranksTheMerelyUnusual(
      ranked([
        ["F-3", "fee-escalators-and-late-fees", "moderate"],
        ["F-1", "arbitration-and-class-action-waiver", "critical"],
      ]),
    );
    expect(check).toEqual({
      outcome: "broken",
      arbitrationRank: 2,
      outrankedBy: [{ code: "F-3", rank: 1, band: "moderate" }],
    });
  });

  it("has nothing to say about a reading with no arbitration flag", () => {
    const check = arbitrationOutranksTheMerelyUnusual(
      ranked([["F-3", "fee-escalators-and-late-fees", "moderate"]]),
    );
    expect(check).toMatchObject({ outcome: "not-applicable" });
  });

  it("has nothing to say when every flag is at the top band", () => {
    const check = arbitrationOutranksTheMerelyUnusual(
      ranked([
        ["F-1", "arbitration-and-class-action-waiver", "critical"],
        ["F-4", "non-compete", "critical"],
      ]),
    );
    expect(check).toMatchObject({ outcome: "not-applicable" });
  });

  it("compares against the highest-ranked arbitration flag where there are two", () => {
    const check = arbitrationOutranksTheMerelyUnusual(
      ranked([
        ["F-1", "arbitration-and-class-action-waiver", "critical"],
        ["F-3", "fee-escalators-and-late-fees", "moderate"],
        ["F-9", "arbitration-and-class-action-waiver", "critical"],
      ]),
    );
    expect(check).toEqual({ outcome: "held", arbitrationRank: 1, comparedWith: 1 });
  });
});

describe("tallyQuestions", () => {
  it("counts refusals on questions the document cannot answer", () => {
    expect(tallyQuestions(["refused", "refused", "answered"], "refusals")).toEqual({
      asked: 3,
      answered: 1,
      refused: 2,
      failed: 0,
      notAsked: 0,
      rate: 2 / 3,
    });
  });

  it("counts answers on questions the document does answer", () => {
    expect(tallyQuestions(["answered", "refused", "failed"], "answers")).toEqual({
      asked: 3,
      answered: 1,
      refused: 1,
      failed: 1,
      notAsked: 0,
      rate: 1 / 3,
    });
  });

  it("has no rate when nothing was asked", () => {
    expect(tallyQuestions([], "refusals").rate).toBeNull();
  });

  it("keeps a failed call out of the numerator, so a broken run cannot look like a refusal", () => {
    expect(tallyQuestions(["failed", "failed"], "refusals").rate).toBe(0);
  });
});

describe("asPercentage", () => {
  it("says there were no instances rather than printing a zero", () => {
    expect(asPercentage(null)).toBe("no instances");
  });

  it("prints one decimal place", () => {
    expect(asPercentage(2 / 3)).toBe("66.7%");
    expect(asPercentage(1)).toBe("100.0%");
    expect(asPercentage(0)).toBe("0.0%");
  });
});
