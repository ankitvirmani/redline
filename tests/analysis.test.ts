import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
  analyse,
  defectsRecorded,
  forgetDefects,
  locateSpan,
  type DocumentAnalysis,
  type Flag,
} from "@/src/analysis";
import { CLAUSE_TYPE_SLUGS, clauseType, type SeverityBand } from "@/src/domain/clause-types";
import { extract, type ExtractedDocument } from "@/src/extraction";
import {
  changeSpan,
  FABRICATED_SENTENCE,
  fixturePayload,
  stubModelClient,
  withChangedSpans,
  type SpanChange,
} from "@/src/model/stub";

/**
 * The analysis seam. Deterministic: the model client is the stub built from the
 * fixture sidecars, so there is no key, no network and no inference cost, and the
 * same document always reads the same way.
 *
 * What these tests assert is what a reader would observe. That every quote on their
 * screen is in the document they pasted, in those exact characters. That a sentence
 * the document does not contain never reaches the screen at all. That two renewal
 * clauses with different cancellation windows are not called equally severe.
 *
 * Flags are unordered at this seam, so nothing here asserts a position in the list.
 * Ticket 06 adds the order and the tests that hold it.
 */

// ── the suite makes no network call ────────────────────────────────────────────
//
// Asserted rather than assumed. `fetch` is replaced for the whole file with
// something that counts the attempt and then fails, so a call would both be visible
// and break the test that made it. The count is checked at the end of the file.

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

beforeEach(() => {
  forgetDefects();
});

// ── the fixtures ──────────────────────────────────────────────────────────────

const FIXTURES = new URL("./fixtures/", import.meta.url);

function fixture(name: string): string {
  return readFileSync(fileURLToPath(new URL(name, FIXTURES)), "utf8");
}

type PlantedClause = {
  readonly id: string;
  readonly clauseType: string;
  readonly sourceSentence: string;
  readonly expectedSeverityBand: SeverityBand;
  readonly confidence: number;
  readonly exit: { readonly text: string; readonly sourceSentence: string } | null;
};

type Sidecar = {
  readonly document: string;
  readonly summary: string;
  readonly checkedClauseTypes: readonly string[];
  readonly plantedClauses: readonly PlantedClause[];
};

/**
 * Every sidecar that plants clauses, read from the directory rather than named here,
 * so that a fixture added later is covered without anybody editing this file. The
 * questions sidecar names a document and plants nothing, so it falls out.
 */
const SIDECARS: readonly Sidecar[] = readdirSync(fileURLToPath(FIXTURES))
  .filter((name) => name.endsWith(".json"))
  .sort()
  .map((name) => JSON.parse(fixture(name)) as Partial<Sidecar>)
  .filter((sidecar): sidecar is Sidecar => Array.isArray(sidecar.plantedClauses));

const ADHESION = fixture("adhesion-contract.txt");

// ── helpers ───────────────────────────────────────────────────────────────────

async function documentOf(text: string): Promise<ExtractedDocument> {
  const extraction = await extract({ kind: "pasted-text", text });
  if (extraction.outcome !== "extracted") throw new Error("The fixture did not extract.");
  return extraction.document;
}

/** Runs the seam over a document, with the faithful stub unless given an answer. */
async function analysisOf(text: string, answer?: unknown): Promise<DocumentAnalysis> {
  const result = await analyse({
    document: await documentOf(text),
    model: stubModelClient(answer === undefined ? {} : { answer }),
  });
  if (result.outcome !== "analysed") throw new Error(`Analysis failed: ${result.reason}.`);
  return result.analysis;
}

/** The payload for one planted clause, on its own. */
function onlyFlag(text: string, pick: (sentence: string) => boolean) {
  const payload = fixturePayload(text);
  const flag = payload.flags.find((candidate) => pick(candidate.sourceSentence));
  if (flag === undefined) throw new Error("No planted clause matched.");
  return { ...payload, flags: [flag] };
}

function flagCiting(flags: readonly Flag[], opening: string): Flag {
  const flag = flags.find((candidate) => candidate.sourceSentence.text.startsWith(opening));
  if (flag === undefined) throw new Error(`No flag cites a sentence opening "${opening}".`);
  return flag;
}

// ── every flag can show its source sentence ───────────────────────────────────

describe("every flag's source sentence is in the document, character for character", () => {
  for (const sidecar of SIDECARS) {
    it(`holds for ${sidecar.document}`, async () => {
      const text = fixture(sidecar.document);
      const analysis = await analysisOf(text);

      expect(analysis.flags).toHaveLength(sidecar.plantedClauses.length);

      for (const flag of analysis.flags) {
        // The quote a reader sees is in the document they pasted.
        expect(text).toContain(flag.sourceSentence.text);
        // And the offsets the screen marks it with land on those same characters.
        const { start, end } = flag.sourceSentence.at;
        expect(text.slice(start, end)).toBe(flag.sourceSentence.text);
        expect(flag.sourceSentence.occurrences).toBeGreaterThanOrEqual(1);

        // The way out the document grants is a claim of its own, and it cites too.
        if (flag.exit !== null) {
          expect(text).toContain(flag.exit.sourceSentence.text);
          const at = flag.exit.sourceSentence.at;
          expect(text.slice(at.start, at.end)).toBe(flag.exit.sourceSentence.text);
        }
      }

      expect(analysis.defects).toHaveLength(0);
    });
  }

  it("reports the seven clause types it checked, whatever the document says", async () => {
    for (const sidecar of SIDECARS) {
      const analysis = await analysisOf(fixture(sidecar.document));
      expect(analysis.checkedClauseTypes).toEqual(sidecar.checkedClauseTypes);
    }
  });

  it("reads a document with none of the seven as having no flags", async () => {
    const analysis = await analysisOf(fixture("clean-document.txt"));
    expect(analysis.flags).toEqual([]);
    expect(analysis.checkedClauseTypes).toHaveLength(7);
    expect(analysis.summary.text.length).toBeGreaterThan(0);
  });
});

// ── a span the document does not contain never reaches a reader ───────────────

describe("a flag whose span is not in the document is dropped", () => {
  it("produces no flags at all when no span matches, and records a defect for each", async () => {
    const fabricated = withChangedSpans(fixturePayload(ADHESION), "not-in-the-document");
    const planted = fixturePayload(ADHESION).flags.length;

    // The precondition the test rests on: that sentence really is not in there.
    expect(ADHESION).not.toContain(fabricated.flags[0]?.sourceSentence);

    const analysis = await analysisOf(ADHESION, fabricated);

    expect(analysis.flags).toEqual([]);
    expect(analysis.defects).toHaveLength(planted);
    expect(analysis.defects.every((defect) => defect.code === "source-sentence-not-found")).toBe(true);
    expect(defectsRecorded()).toHaveLength(planted);
    // The log counts the drop and holds nothing of the document or the span.
    for (const defect of defectsRecorded()) {
      expect(Object.values(defect).some((value) => typeof value === "string" && value.includes(" "))).toBe(false);
    }
  });

  it("returns the matchable spans and only those", async () => {
    const faithful = fixturePayload(ADHESION);
    const mixed = withChangedSpans(faithful, "not-in-the-document", (index) => index % 2 === 0);
    const broken = faithful.flags.filter((_, index) => index % 2 === 0).length;
    const intact = faithful.flags.length - broken;

    const analysis = await analysisOf(ADHESION, mixed);

    expect(analysis.flags).toHaveLength(intact);
    expect(analysis.defects).toHaveLength(broken);
    for (const flag of analysis.flags) {
      expect(ADHESION).toContain(flag.sourceSentence.text);
    }
  });

  it("drops a flag whose sentence was invented outright", async () => {
    const payload = onlyFlag(ADHESION, (sentence) => sentence.startsWith("Any dispute, claim"));
    const flag = payload.flags[0];
    if (flag === undefined) throw new Error("That clause is planted.");
    expect(ADHESION).not.toContain(FABRICATED_SENTENCE);

    const analysis = await analysisOf(ADHESION, {
      ...payload,
      flags: [{ ...flag, sourceSentence: FABRICATED_SENTENCE, exit: null }],
    });

    expect(analysis.flags).toEqual([]);
    expect(analysis.defects).toHaveLength(1);
    expect(analysis.defects[0]?.code).toBe("source-sentence-not-found");
  });

  const NEAR_MISSES: readonly { readonly change: SpanChange; readonly opening: string }[] = [
    { change: "one-character", opening: "At the end of the initial term" },
    { change: "one-curly-quote", opening: "Meridian’s total liability" },
    { change: "one-space", opening: "At the end of the initial term" },
  ];

  for (const { change, opening } of NEAR_MISSES) {
    it(`drops a flag whose span differs by ${change.replace(/-/g, " ")}`, async () => {
      const payload = onlyFlag(ADHESION, (sentence) => sentence.startsWith(opening));
      const original = payload.flags[0]?.sourceSentence ?? "";
      const changed = changeSpan(original, change);

      // Nothing fuzzy: the original matches and the near miss does not.
      expect(ADHESION).toContain(original);
      expect(ADHESION).not.toContain(changed);

      const analysis = await analysisOf(ADHESION, withChangedSpans(payload, change));

      expect(analysis.flags).toEqual([]);
      expect(analysis.defects).toHaveLength(1);
      expect(analysis.defects[0]?.code).toBe("source-sentence-not-found");
    });
  }

  it("keeps the flag and drops the exit when only the exit's sentence is unmatchable", async () => {
    const payload = onlyFlag(ADHESION, (sentence) => sentence.startsWith("At the end of the initial term"));
    const flag = payload.flags[0];
    if (flag?.exit === null || flag?.exit === undefined) throw new Error("That clause has an exit.");
    const withBadExit = {
      ...payload,
      flags: [{ ...flag, exit: { ...flag.exit, sourceSentence: changeSpan(flag.exit.sourceSentence, "one-space") } }],
    };

    const analysis = await analysisOf(ADHESION, withBadExit);

    expect(analysis.flags).toHaveLength(1);
    expect(analysis.flags[0]?.exit).toBeNull();
    expect(analysis.defects[0]?.code).toBe("exit-sentence-not-found");
  });

  it("refuses a model answer that is not in the shape it was asked for", async () => {
    const result = await analyse({
      document: await documentOf(ADHESION),
      model: stubModelClient({ answer: { summary: "fine", flags: "not a list" } }),
    });

    expect(result).toEqual({ outcome: "failed", reason: "model-response-rejected" });
    expect(defectsRecorded()[0]?.code).toBe("model-response-rejected");
  });

  it("says so when there is no model to call", async () => {
    const result = await analyse({
      document: await documentOf(ADHESION),
      model: stubModelClient({ fail: "not-configured" }),
    });

    expect(result).toEqual({ outcome: "failed", reason: "model-not-configured" });
  });
});

// ── a sentence that appears twice ─────────────────────────────────────────────

describe("a span the document contains more than once", () => {
  it("is located at its first occurrence, counted, and still flagged", async () => {
    const payload = onlyFlag(ADHESION, (sentence) => sentence.startsWith("Program enrolment renews"));
    const sentence = payload.flags[0]?.sourceSentence ?? "";
    const doubled = `PREAMBLE\n\n${sentence}\n\nMIDDLE\n\n${sentence}\n\nSigned by the Member.`;

    const analysis = await analysisOf(doubled, payload);

    const flag = analysis.flags[0];
    expect(flag?.sourceSentence.occurrences).toBe(2);
    expect(flag?.sourceSentence.at.start).toBe(doubled.indexOf(sentence));
    expect(doubled.slice(flag?.sourceSentence.at.start, flag?.sourceSentence.at.end)).toBe(sentence);
  });

  it("finds nothing for an empty span", () => {
    expect(locateSpan(ADHESION, "")).toEqual({ outcome: "not-found", failure: "empty-span" });
  });
});

// ── severity comes from the terms, not the category ───────────────────────────

describe("severity responds to the terms of the clause", () => {
  for (const sidecar of SIDECARS) {
    it(`lands every planted clause of ${sidecar.document} in the band the sidecar expects`, async () => {
      const text = fixture(sidecar.document);
      const analysis = await analysisOf(text);

      for (const planted of sidecar.plantedClauses) {
        const flag = analysis.flags.find(
          (candidate) => candidate.sourceSentence.text === planted.sourceSentence,
        );
        expect(flag, `${planted.id} came through`).toBeDefined();
        expect(flag?.severity.band, `${planted.id}`).toBe(planted.expectedSeverityBand);
      }
    });
  }

  it("puts two renewal clauses in different bands, on their windows rather than their type", async () => {
    const analysis = await analysisOf(ADHESION);

    const threeDays = flagCiting(analysis.flags, "At the end of the initial term");
    const ninetyDays = flagCiting(analysis.flags, "Program enrolment renews");

    // Same clause type, so the type cannot be what separated them.
    expect(threeDays.clauseType).toBe("auto-renewal");
    expect(ninetyDays.clauseType).toBe("auto-renewal");
    expect(threeDays.severity.baselineBand).toBe(ninetyDays.severity.baselineBand);

    // Different bands, and the reader is told so in the word.
    expect(threeDays.severity.band).toBe("high");
    expect(ninetyDays.severity.band).toBe("moderate");
    expect(threeDays.severity.band).not.toBe(ninetyDays.severity.band);

    // And it was the window that did it.
    expect(threeDays.terms.windowToAct?.days).toBe(3);
    expect(ninetyDays.terms.windowToAct?.days).toBe(90);
    expect(threeDays.severity.movements).toEqual([]);
    expect(ninetyDays.severity.movements).toEqual([
      { code: "a-window-the-reader-can-use", direction: "toward-moderate", bands: 1 },
    ]);
  });

  it("does not lower the band for a window that expires at signing", async () => {
    const payload = onlyFlag(ADHESION, (sentence) => sentence.startsWith("Program enrolment renews"));
    const flag = payload.flags[0];
    if (flag === undefined) throw new Error("That clause is planted.");
    const oneChance = {
      ...payload,
      flags: [{ ...flag, windowToAct: { days: 90, runsAgainst: "once-at-the-start" as const } }],
    };

    const analysis = await analysisOf(ADHESION, oneChance);

    expect(analysis.flags[0]?.severity.band).toBe("high");
    expect(analysis.flags[0]?.severity.movements).toEqual([]);
  });

  it("does not lower the band for a window the document does not state", async () => {
    const payload = onlyFlag(ADHESION, (sentence) => sentence.startsWith("Program enrolment renews"));
    const flag = payload.flags[0];
    if (flag === undefined) throw new Error("That clause is planted.");
    const unstated = {
      ...payload,
      flags: [{ ...flag, windowToAct: { days: 45, runsAgainst: "each-time-the-clause-bites" as const } }],
    };

    const analysis = await analysisOf(ADHESION, unstated);

    expect(analysis.flags[0]?.terms.windowToAct?.statedInTheDocument).toBe(false);
    expect(analysis.flags[0]?.severity.band).toBe("high");
  });
});

// ── all seven types come through ──────────────────────────────────────────────

describe("all seven clause types", () => {
  it("come through the seam as flags, each showing its own sentence", async () => {
    const analysis = await analysisOf(ADHESION);

    const throughTheSeam = new Set(analysis.flags.map((flag) => flag.clauseType));
    for (const slug of CLAUSE_TYPE_SLUGS) {
      expect(throughTheSeam, slug).toContain(slug);
      const flag = analysis.flags.find((candidate) => candidate.clauseType === slug);
      expect(ADHESION).toContain(flag?.sourceSentence.text ?? "");
      expect(flag?.confidence).toBeGreaterThan(0);
      expect(flag?.consequence.fromTheDocument.length ?? 0).toBeGreaterThan(0);

      // The second tier of the consequence, filled by ticket 08 from the curated
      // store. The four types resting on federal regulatory measurement carry a fact
      // with a source; the three resting on weaker evidence carry none, and null there
      // is the store being honest rather than a field nobody filled.
      const outside = flag?.consequence.externalContext ?? null;
      if (clauseType(slug).evidence === "regulator-evidenced") {
        expect(outside?.fact.length ?? 0, slug).toBeGreaterThan(0);
        expect(outside?.source.title.length ?? 0, slug).toBeGreaterThan(0);
        expect(outside?.source.url ?? "", slug).toMatch(/^https:\/\//u);
        // Two fields, never one string. Nothing folded the fact into the claim the
        // source sentence backs (ADR 0007).
        expect(flag?.consequence.fromTheDocument, slug).not.toContain(outside?.fact ?? "");
      } else {
        expect(outside, slug).toBeNull();
      }
    }
  });

  it("gives every flag its own code, and the code does not rank it", async () => {
    const analysis = await analysisOf(ADHESION);
    const codes = analysis.flags.map((flag) => flag.code);
    expect(new Set(codes).size).toBe(codes.length);
    expect(codes[0]).toBe("F-01");
  });
});

// ── the suite made no network call ────────────────────────────────────────────

describe("the deterministic suite", () => {
  it("made no network call", () => {
    expect(fetchAttempts).toBe(0);
  });
});
