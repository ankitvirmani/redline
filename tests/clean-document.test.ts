import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { analyse, type Flag } from "@/src/analysis";
import {
  CLAUSE_TYPE_SLUGS,
  SEVERITY_BANDS,
  clauseType,
  type ClauseTypeSlug,
} from "@/src/domain/clause-types";
import { extract, type ExtractedDocument } from "@/src/extraction";
import { stubModelClient } from "@/src/model/stub";
import { rank } from "@/src/ranking";

/**
 * The clean document: a document in which no flag met the bar, reported with the list
 * of what was checked.
 *
 * The determination is made in the ranking seam and every test here is a pure-function
 * test over it, plus two that run the seam end to end against the benign fixture
 * through the stub model client. No model, no network, no store.
 *
 * What these assert is what a reader would observe. That a document with nothing in it
 * never comes back as a blank screen. That the seven names they read are the seven
 * names the analysis says it looked for, and not a list the screen keeps for itself.
 * That a low completeness reading is still on screen beside a clean verdict, which is
 * the behaviour ADR 0006 records and leaves open.
 */

// ── the suite makes no network call ────────────────────────────────────────────

let fetchAttempts = 0;
const REAL_FETCH = globalThis.fetch;

beforeAll(() => {
  globalThis.fetch = ((...args: unknown[]) => {
    fetchAttempts += 1;
    void args;
    throw new Error("The deterministic suite makes no network call.");
  }) as unknown as typeof fetch;
});

afterAll(() => {
  globalThis.fetch = REAL_FETCH;
});

// ── fixtures and helpers ──────────────────────────────────────────────────────

const FIXTURES = new URL("./fixtures/", import.meta.url);

function fixture(name: string): string {
  return readFileSync(fileURLToPath(new URL(name, FIXTURES)), "utf8");
}

const CLEAN = fixture("clean-document.txt");

/** The seven, written out here so the assertion is on names and never on a count. */
const THE_SEVEN: readonly ClauseTypeSlug[] = [
  "arbitration-and-class-action-waiver",
  "unilateral-modification",
  "non-compete",
  "auto-renewal",
  "limitation-of-liability",
  "indemnification",
  "fee-escalators-and-late-fees",
];

/** One flag, as analysis would have handed it over. */
function flag(code: string, slug: ClauseTypeSlug): Flag {
  const type = clauseType(slug);
  return {
    code,
    clauseType: slug,
    sourceSentence: {
      text: `The sentence ${code} was drawn from.`,
      at: { start: 0, end: 40 },
      occurrences: 1,
    },
    severity: { band: type.baselineBand, baselineBand: type.baselineBand, movements: [] },
    confidence: 0.9,
    consequence: { fromTheDocument: `What ${code} does to you.`, externalContext: null },
    exit: null,
    terms: { windowToAct: null },
    leverage: { leversRemoved: type.leversRemoved },
  };
}

async function documentOf(text: string): Promise<ExtractedDocument> {
  const extraction = await extract({ kind: "pasted-text", text });
  if (extraction.outcome !== "extracted") throw new Error("That text did not extract.");
  return extraction.document;
}

// ── an empty flag set is never an empty result ─────────────────────────────────

describe("a document where nothing met the bar reads as clean", () => {
  it("reports a clean document carrying the list of what was checked", () => {
    const ranking = rank({ flags: [], checkedClauseTypes: THE_SEVEN });

    expect(ranking.flags).toEqual([]);
    expect(ranking.cleanDocument).not.toBeNull();
    // The names, not the number. A count tells a reader nothing about what was done.
    expect(ranking.cleanDocument?.checkedClauseTypes).toEqual([
      "arbitration-and-class-action-waiver",
      "unilateral-modification",
      "non-compete",
      "auto-renewal",
      "limitation-of-liability",
      "indemnification",
      "fee-escalators-and-late-fees",
    ]);
  });

  it("does not read as clean when one moderate flag met the bar", () => {
    // The bar is that no flag met it, so the mildest flag anywhere is enough. A
    // clause that only costs money is still a clause the reader has to be told about.
    const lateFees = flag("F-01", "fee-escalators-and-late-fees");
    expect(lateFees.severity.band).toBe("moderate");

    const ranking = rank({ flags: [lateFees], checkedClauseTypes: THE_SEVEN });

    expect(ranking.cleanDocument).toBeNull();
    expect(ranking.flags).toHaveLength(1);
  });
});

// ── the checked list is carried, not kept by the render path ──────────────────

describe("the checked list comes from the analysis", () => {
  it("hands back the list it was given, however short", () => {
    // Two names in, two names out. A seam that held its own constant of seven would
    // fail here, and the screen would then be printing a list nothing checked.
    const checked: readonly ClauseTypeSlug[] = ["arbitration-and-class-action-waiver", "auto-renewal"];

    const ranking = rank({ flags: [], checkedClauseTypes: checked });

    expect(ranking.cleanDocument?.checkedClauseTypes).toEqual([
      "arbitration-and-class-action-waiver",
      "auto-renewal",
    ]);
    expect(ranking.cleanDocument?.checkedClauseTypes).not.toEqual(CLAUSE_TYPE_SLUGS);
  });

  it("makes no determination when it is told nothing about what was checked", () => {
    // Null is not a verdict either way. A clean document is only reportable with the
    // names of what was looked for, so with no list there is nothing to report.
    expect(rank({ flags: [] }).cleanDocument).toBeNull();
    expect(rank({ flags: [], checkedClauseTypes: [] }).cleanDocument).toBeNull();
  });
});

// ── completeness sits beside the verdict and suppresses nothing ───────────────

describe("a low completeness reading does not suppress the clean verdict", () => {
  it("still reports the clean document, with the completeness reading still on the result", async () => {
    // Part of a page: it stops mid sentence, nothing at the end asks for a signature,
    // and it is far shorter than these agreements run. Three signals, so the reading
    // is partial. ADR 0006 records that this sits beside the verdict rather than
    // replacing it, and that whether it should is open.
    const partial = "The Association licenses one numbered plot for the season. The plot holder agrees to keep the paths";
    const document = await documentOf(partial);
    expect(document.completeness.level).toBe("partial");

    const read = await analyse({
      document,
      model: stubModelClient({ answer: { summary: "Part of a plot licence.", flags: [] } }),
    });
    if (read.outcome !== "analysed") throw new Error(`Analysis failed: ${read.reason}.`);

    const ranking = rank({
      flags: read.analysis.flags,
      checkedClauseTypes: read.analysis.checkedClauseTypes,
    });

    // The verdict is made, and the reading a screen renders beside it is still there.
    expect(ranking.cleanDocument?.checkedClauseTypes).toEqual(THE_SEVEN);
    expect(document.completeness.level).toBe("partial");
    expect(document.completeness.signals.filter((signal) => signal.fired).length).toBeGreaterThan(1);
  });
});

// ── the benign fixture, end to end through the stub ───────────────────────────

describe("the benign document, read end to end", () => {
  it("invents no flag at any band, and reads clean with the list of what was checked", async () => {
    const document = await documentOf(CLEAN);
    const read = await analyse({ document, model: stubModelClient() });
    if (read.outcome !== "analysed") throw new Error(`Analysis failed: ${read.reason}.`);

    // Zero at every band, not zero at the top. A tool that reached for a low-severity
    // finding on a benign document has failed even though nothing it said was false.
    for (const band of SEVERITY_BANDS) {
      expect(read.analysis.flags.filter((one) => one.severity.band === band)).toEqual([]);
    }
    expect(read.analysis.flags).toEqual([]);
    // And nothing was dropped on the way, so the empty list is the reading rather
    // than the wreckage of one.
    expect(read.analysis.defects).toEqual([]);

    const ranking = rank({
      flags: read.analysis.flags,
      checkedClauseTypes: read.analysis.checkedClauseTypes,
    });

    expect(ranking.flags).toEqual([]);
    expect(ranking.cleanDocument?.checkedClauseTypes).toEqual(THE_SEVEN);
  });
});

// ── clean, refused and failed are three different things ─────────────────────

describe("clean, refused and failed are told apart in the data", () => {
  it("gives a consumer three different discriminants, with no copy to read", async () => {
    // Refused: extraction had nothing to hand on. The reason is machine readable.
    const refused = await extract({ kind: "pasted-text", text: "   \n  " });
    expect(refused.outcome).toBe("rejected");
    expect(refused.outcome === "rejected" ? refused.reason : null).toBe("nothing-to-read");

    // Failed: the document extracted and the reading did not come back.
    const document = await documentOf(CLEAN);
    const failed = await analyse({ document, model: stubModelClient({ fail: "unavailable" }) });
    expect(failed.outcome).toBe("failed");
    expect(failed.outcome === "failed" ? failed.reason : null).toBe("model-unavailable");
    // There is no analysis to rank, so nothing can read a verdict off this one.
    expect("analysis" in failed).toBe(false);

    // Clean: the document extracted, the reading came back, and nothing met the bar.
    const read = await analyse({ document, model: stubModelClient() });
    if (read.outcome !== "analysed") throw new Error(`Analysis failed: ${read.reason}.`);
    const ranking = rank({
      flags: read.analysis.flags,
      checkedClauseTypes: read.analysis.checkedClauseTypes,
    });
    expect(ranking.cleanDocument).not.toBeNull();

    // Three outcomes, three values, none of them a message.
    expect(new Set([refused.outcome, failed.outcome, read.outcome]).size).toBe(3);
  });

  it("is not the same as an analysis that came back with flags", async () => {
    const document = await documentOf(fixture("adhesion-contract.txt"));
    const read = await analyse({ document, model: stubModelClient() });
    if (read.outcome !== "analysed") throw new Error(`Analysis failed: ${read.reason}.`);

    const ranking = rank({
      flags: read.analysis.flags,
      checkedClauseTypes: read.analysis.checkedClauseTypes,
    });

    expect(ranking.flags.length).toBeGreaterThan(0);
    expect(ranking.cleanDocument).toBeNull();
  });
});

// ── no network ────────────────────────────────────────────────────────────────

describe("the clean-document determination", () => {
  it("made no network call", () => {
    expect(fetchAttempts).toBe(0);
  });
});
