import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { summaryParagraphs } from "@/components/summary-view";
import {
  analyse,
  defectsRecorded,
  figuresNotInTheDocument,
  forgetDefects,
  readSummary,
  SUMMARY_CHARACTER_LIMIT,
  verdictLanguageIn,
  type DocumentAnalysis,
} from "@/src/analysis";
import { extract, type ExtractedDocument } from "@/src/extraction";
import {
  fixturePayload,
  stubModelClient,
  SUMMARIES_THAT_CARRY_A_VERDICT,
  SUMMARY_WITH_A_FIGURE_THE_DOCUMENT_DOES_NOT_HAVE,
  withSummary,
} from "@/src/model/stub";

/**
 * The summary: what the document is and what accepting it commits the reader to.
 *
 * Deterministic. The model client is the stub built from the fixture sidecars, whose
 * `summary` fields are real example output of the right shape, so every summary these
 * tests accept or refuse is a summary something could plausibly have written.
 *
 * The hard part of this ticket is a negative: no sign or don't-sign recommendation,
 * explicit or implied. That cannot be proved by a test and it is not claimed here.
 * What is tested is the code check that stands between the model and the reader: the
 * wordings it catches, the wordings it deliberately leaves alone, and what happens to
 * an analysis whose summary it refuses. Each test's name says which of those it is.
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

beforeEach(() => {
  forgetDefects();
});

// ── fixtures and helpers ──────────────────────────────────────────────────────

const FIXTURES = new URL("./fixtures/", import.meta.url);

function fixture(name: string): string {
  return readFileSync(fileURLToPath(new URL(name, FIXTURES)), "utf8");
}

type Sidecar = {
  readonly document: string;
  readonly summary: string;
  readonly plantedClauses: readonly unknown[];
};

const SIDECARS: readonly Sidecar[] = readdirSync(fileURLToPath(FIXTURES))
  .filter((name) => name.endsWith(".json"))
  .sort()
  .map((name) => JSON.parse(fixture(name)) as Partial<Sidecar>)
  .filter((sidecar): sidecar is Sidecar => Array.isArray(sidecar.plantedClauses));

const ADHESION = fixture("adhesion-contract.txt");
const CLEAN = fixture("clean-document.txt");

async function documentOf(text: string): Promise<ExtractedDocument> {
  const extraction = await extract({ kind: "pasted-text", text });
  if (extraction.outcome !== "extracted") throw new Error("The fixture did not extract.");
  return extraction.document;
}

async function analysisOf(text: string, answer?: unknown): Promise<DocumentAnalysis> {
  const result = await analyse({
    document: await documentOf(text),
    model: stubModelClient(answer === undefined ? {} : { answer }),
  });
  if (result.outcome !== "analysed") throw new Error(`Analysis failed: ${result.reason}.`);
  return result.analysis;
}

/** Runs the seam and hands back whichever way it went, for the refusals. */
async function outcomeOf(text: string, answer: unknown) {
  return analyse({ document: await documentOf(text), model: stubModelClient({ answer }) });
}

// ── every analysis comes back with a summary ───────────────────────────────────

describe("every analysis returns a summary", () => {
  for (const sidecar of SIDECARS) {
    it(`reads ${sidecar.document} back with one`, async () => {
      const analysis = await analysisOf(fixture(sidecar.document));

      expect(analysis.summary.text.trim()).not.toBe("");
      // What the reader sees is what came back, not a trimmed or padded version of it.
      expect(analysis.summary.text).toBe(sidecar.summary.trim());
    });
  }

  it("gives the clean document a summary of what accepting it commits the reader to, with no flags to draw it from", async () => {
    const analysis = await analysisOf(CLEAN);

    // Nothing met the bar, so there is nothing here the summary could be restating.
    expect(analysis.flags).toEqual([]);

    const summary = analysis.summary.text;
    expect(summary.trim()).not.toBe("");
    // It says what the reader takes on, which is the thing a clean document still has.
    expect(summary).toMatch(/\b(?:agrees|agree|must|pays|paid|commits|ends|notice)\b/u);
    // And every figure in it is in the document. That is groundedness as far as code
    // can check it: a number present, not a number used for what the document uses it
    // for.
    expect(figuresNotInTheDocument(CLEAN, summary)).toEqual([]);
  });

  it("does not restate the flags: no consequence and no source sentence appears in the summary", async () => {
    const analysis = await analysisOf(ADHESION);
    const summary = analysis.summary.text;

    expect(analysis.flags.length).toBeGreaterThan(0);
    for (const flag of analysis.flags) {
      expect(summary).not.toContain(flag.consequence.fromTheDocument);
      expect(summary).not.toContain(flag.sourceSentence.text);
    }
  });

  it("states no figure the document does not contain, over both fixtures", async () => {
    for (const sidecar of SIDECARS) {
      const text = fixture(sidecar.document);
      const analysis = await analysisOf(text);
      expect(figuresNotInTheDocument(text, analysis.summary.text), sidecar.document).toEqual([]);
    }
  });
});

// ── the verdict check: what it catches ────────────────────────────────────────

describe("the verdict check catches the wordings it lists, and proves nothing about wordings it does not", () => {
  for (const [index, summary] of SUMMARIES_THAT_CARRY_A_VERDICT.entries()) {
    it(`refuses example verdict summary ${index + 1}`, () => {
      const found = verdictLanguageIn(summary);
      expect(found.length, summary).toBeGreaterThan(0);

      const reading = readSummary(ADHESION, summary);
      expect(reading.ok).toBe(false);
      if (!reading.ok) expect(reading.refusal).toBe("carries-a-verdict");
    });
  }

  it("catches each of the four kinds of verdict at least once across those examples", () => {
    const kinds = new Set(
      SUMMARIES_THAT_CARRY_A_VERDICT.flatMap((summary) =>
        verdictLanguageIn(summary).map((finding) => finding.kind),
      ),
    );

    expect(kinds).toContain("tells-the-reader-what-to-do");
    expect(kinds).toContain("judges-the-document");
    expect(kinds).toContain("reassures-the-reader");
    expect(kinds).toContain("claims-a-law-or-a-right");
  });

  it("catches a sentence written to slip past the obvious words by advising without the word sign", () => {
    const sly =
      "This is a twelve-month gym membership with an arbitration clause. Before you put your name to it, be careful about the renewal window.";
    expect(verdictLanguageIn(sly).length).toBeGreaterThan(0);
  });
});

// ── the verdict check: what it leaves alone ───────────────────────────────────

describe("the verdict check leaves a summary that only reports the document alone", () => {
  for (const sidecar of SIDECARS) {
    it(`says nothing about the hand-written summary in ${sidecar.document}`, () => {
      // Real example output, written for these fixtures and not for this test.
      expect(verdictLanguageIn(sidecar.summary)).toEqual([]);
      expect(readSummary(fixture(sidecar.document), sidecar.summary).ok).toBe(true);
    });
  }

  /**
   * Wordings that look like the check's targets and are not. Each one reports a term
   * of the document, which is exactly what a summary is for, and a check that refused
   * these would refuse the product.
   */
  const LEGITIMATE = [
    "This is a twelve-month gym membership. Dues not received within ten days of the draw date incur a late charge set out in a separate schedule of fees.",
    "Meridian can amend the club rules, the fees and the terms of this agreement at any time by posting a new version at the club.",
    "If you sue and lose, you pay Meridian's legal fees, including reasonable legal fees its insurers incur.",
    "You must give written notice three days before the renewal date to stop the membership renewing for another twelve months.",
    "What Meridian can owe you is capped at the dues you paid over the previous twelve months, whatever the claim is.",
    "The plot licence ends on 30 November and does not renew, so next season means applying again.",
  ] as const;

  for (const [index, summary] of LEGITIMATE.entries()) {
    it(`says nothing about legitimate summary ${index + 1}`, () => {
      expect(verdictLanguageIn(summary), summary).toEqual([]);
    });
  }
});

// ── what a refused summary does to the analysis ───────────────────────────────

describe("a summary the check refuses takes the whole analysis with it", () => {
  it("returns no analysis at all when the summary says whether to sign, so no half-built result renders", async () => {
    const verdict = SUMMARIES_THAT_CARRY_A_VERDICT[0];
    if (verdict === undefined) throw new Error("There is at least one example.");
    const payload = withSummary(fixturePayload(ADHESION), verdict);

    // The flags in that payload are the faithful ones, so nothing but the summary is wrong.
    expect(payload.flags.length).toBeGreaterThan(0);

    const result = await outcomeOf(ADHESION, payload);

    expect(result).toEqual({ outcome: "failed", reason: "model-response-rejected" });
    expect(defectsRecorded()[0]?.code).toBe("summary-carries-a-verdict");
    // The log holds the length and nothing of the summary itself.
    for (const defect of defectsRecorded()) {
      expect(Object.values(defect).some((value) => typeof value === "string" && value.includes(" "))).toBe(false);
    }
  });

  it("returns no analysis when the summary is whitespace with a length", async () => {
    const result = await outcomeOf(ADHESION, withSummary(fixturePayload(ADHESION), "   \n  \t "));

    expect(result).toEqual({ outcome: "failed", reason: "model-response-rejected" });
    expect(defectsRecorded()[0]?.code).toBe("summary-unusable");
  });

  it("returns no analysis when the summary runs on far past the length of a summary", async () => {
    const sentence = "The membership renews for another twelve months unless you cancel. ";
    const runaway = sentence.repeat(Math.ceil((SUMMARY_CHARACTER_LIMIT + 200) / sentence.length));
    expect(runaway.length).toBeGreaterThan(SUMMARY_CHARACTER_LIMIT);

    const result = await outcomeOf(ADHESION, withSummary(fixturePayload(ADHESION), runaway));

    expect(result).toEqual({ outcome: "failed", reason: "model-response-rejected" });
    expect(defectsRecorded()[0]?.code).toBe("summary-unusable");
  });

  it("returns no analysis when the summary field is missing", async () => {
    const { summary: _dropped, ...withoutSummary } = fixturePayload(ADHESION);

    const result = await outcomeOf(ADHESION, withoutSummary);

    expect(result).toEqual({ outcome: "failed", reason: "model-response-rejected" });
    expect(defectsRecorded()[0]?.code).toBe("model-response-rejected");
  });

  it("returns no analysis when the summary is empty, or is not text at all", async () => {
    for (const malformed of ["", 42, null, ["two", "sentences"]]) {
      forgetDefects();
      const result = await outcomeOf(ADHESION, { ...fixturePayload(ADHESION), summary: malformed });

      expect(result, JSON.stringify(malformed)).toEqual({
        outcome: "failed",
        reason: "model-response-rejected",
      });
      expect(defectsRecorded()[0]?.code).toBe("model-response-rejected");
    }
  });
});

// ── the figure check records rather than refuses ──────────────────────────────

describe("a figure the document does not contain is recorded, and the summary still shows", () => {
  it("names the figure the document does not have", () => {
    expect(ADHESION).not.toMatch(/(?<!\d)88(?!\d)/u);
    expect(ADHESION.toLowerCase()).not.toContain("eighty-eight");

    expect(figuresNotInTheDocument(ADHESION, SUMMARY_WITH_A_FIGURE_THE_DOCUMENT_DOES_NOT_HAVE)).toEqual([
      "eighty-eight",
    ]);
  });

  it("keeps the analysis, because the check cannot tell a fabricated figure from a lawful rewording", async () => {
    const analysis = await analysisOf(
      ADHESION,
      withSummary(fixturePayload(ADHESION), SUMMARY_WITH_A_FIGURE_THE_DOCUMENT_DOES_NOT_HAVE),
    );

    expect(analysis.summary.text).toBe(SUMMARY_WITH_A_FIGURE_THE_DOCUMENT_DOES_NOT_HAVE);
    expect(analysis.defects.some((defect) => defect.code === "summary-figure-not-found")).toBe(true);
    expect(defectsRecorded().some((defect) => defect.code === "summary-figure-not-found")).toBe(true);
  });

  it("reads a figure written in words as the same figure written in digits", () => {
    // The document says "three (3) days"; a summary may say either.
    expect(figuresNotInTheDocument(ADHESION, "You get three days to cancel.")).toEqual([]);
    expect(figuresNotInTheDocument(ADHESION, "You get 3 days to cancel.")).toEqual([]);
    // And the document says "$45.00" nowhere, so a dues figure of that size is caught.
    expect(figuresNotInTheDocument(ADHESION, "Dues run to seventy-seven dollars.")).toEqual([
      "seventy-seven",
    ]);
  });
});

// ── what the reader sees on the screen ────────────────────────────────────────

describe("the summary as the screen breaks it up", () => {
  it("keeps every word, in order, as one paragraph when the model sends one", () => {
    const text = SIDECARS[0]?.summary ?? "";
    expect(summaryParagraphs(text)).toEqual([text.trim()]);
  });

  it("makes a paragraph of each block the model separated with a blank line", () => {
    expect(summaryParagraphs("What it is.\n\nWhat it costs you.")).toEqual([
      "What it is.",
      "What it costs you.",
    ]);
  });

  it("treats a single line break inside a block as a space rather than a paragraph", () => {
    expect(summaryParagraphs("This is a gym membership\nthat renews on its own.")).toEqual([
      "This is a gym membership that renews on its own.",
    ]);
  });

  it("is above the flags in the page's markup, so a screen reader meets it first", () => {
    // What this proves: the DOM order on the result screen. What it does not prove:
    // anything about the rendered layout, which no test here can see.
    //
    // The result screen is `components/Reading.tsx` as of ticket 11, because the
    // library reopens a document into the same markup the paste box produces. The
    // assertion is unchanged; it reads the file that now holds the markup, and also
    // checks that the paste screen is still composed of it.
    const source = (name: string): string =>
      readFileSync(fileURLToPath(new URL(`../${name}`, import.meta.url)), "utf8");

    const reading = source("components/Reading.tsx");
    const summaryAt = reading.indexOf("<DocumentSummary");
    const flagsAt = reading.indexOf("<FlagList");

    expect(summaryAt).toBeGreaterThan(-1);
    expect(flagsAt).toBeGreaterThan(-1);
    expect(summaryAt).toBeLessThan(flagsAt);

    expect(source("app/page.tsx")).toContain("<Reading");
  });
});

// ── the suite made no network call ────────────────────────────────────────────

describe("the deterministic suite", () => {
  it("made no network call", () => {
    expect(fetchAttempts).toBe(0);
  });
});
