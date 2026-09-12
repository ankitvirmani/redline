import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import FlagList from "@/components/FlagList";
import { STANDING_STATEMENT, STANDING_STATEMENT_LINES } from "@/components/standing-statement";
import {
  analyse,
  appearsVerbatim,
  EXTERNAL_CONTEXT,
  externalContextFor,
  forgetDefects,
  statutoryLanguageIn,
  verdictLanguageIn,
  type DocumentAnalysis,
  type Flag,
} from "@/src/analysis";
import { CLAUSE_TYPE_SLUGS, clauseType } from "@/src/domain/clause-types";
import { extract } from "@/src/extraction";
import { stubModelClient } from "@/src/model/stub";
import { rank, type RankedFlag } from "@/src/ranking";

/**
 * What a flag says: the consequence and the sentence it is bound to, the fact from
 * outside the document, the way out the document grants, and the two things Redline
 * says about itself on every analysis.
 *
 * Deterministic. The model client is the stub built from the fixture sidecars, and the
 * screen is rendered to static markup, so every assertion here is about what a reader
 * would see. No model, no network, no browser.
 *
 * Three of these tests are negatives, and a negative proved by a list of wordings is
 * worth only as much as the list. Each one says in its own comment what it catches and
 * what it does not, because a reader of this file should not come away believing more
 * has been proved than has been.
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

// ── the two documents, read end to end through the stub ───────────────────────

const ROOT = new URL("../", import.meta.url);

function repositoryFile(name: string): string {
  return readFileSync(fileURLToPath(new URL(name, ROOT)), "utf8");
}

const FIXTURE_NAMES = ["tests/fixtures/adhesion-contract.txt", "tests/fixtures/clean-document.txt"] as const;

type Reading = {
  readonly name: string;
  readonly text: string;
  readonly analysis: DocumentAnalysis;
  readonly ranked: readonly RankedFlag[];
};

/** One document, read the way the screen reads it: extract, analyse, rank. */
async function readingOf(name: string): Promise<Reading> {
  const text = repositoryFile(name);
  const extraction = await extract({ kind: "pasted-text", text });
  if (extraction.outcome !== "extracted") throw new Error(`${name} did not extract.`);

  const read = await analyse({ document: extraction.document, model: stubModelClient() });
  if (read.outcome !== "analysed") throw new Error(`${name} did not analyse: ${read.reason}.`);

  const ranking = rank({
    flags: read.analysis.flags,
    checkedClauseTypes: read.analysis.checkedClauseTypes,
  });
  return { name, text, analysis: read.analysis, ranked: ranking.flags };
}

let readings: readonly Reading[] = [];

beforeAll(async () => {
  readings = await Promise.all(FIXTURE_NAMES.map((name) => readingOf(name)));
});

/** Every flag from both fixtures, with the document it came out of. */
function everyFlag(): readonly { readonly name: string; readonly text: string; readonly flag: Flag }[] {
  return readings.flatMap((reading) =>
    reading.analysis.flags.map((flag) => ({ name: reading.name, text: reading.text, flag })),
  );
}

/** The document with flags in it. The benign fixture has none, which is its job. */
function adhesion(): Reading {
  const reading = readings[0];
  if (reading === undefined || reading.analysis.flags.length === 0) {
    throw new Error("The adhesion fixture is the one with flags in it.");
  }
  return reading;
}

// ── the screen, rendered ──────────────────────────────────────────────────────

/** React escapes five characters. Undo that before matching against copy. */
function asText(html: string): string {
  return html
    .replace(/&quot;/gu, '"')
    .replace(/&#x27;/gu, "'")
    .replace(/&#39;/gu, "'")
    .replace(/&lt;/gu, "<")
    .replace(/&gt;/gu, ">")
    .replace(/&amp;/gu, "&");
}

/** The flag column as a reader gets it, with nothing selected. */
function renderedFlags(ranked: readonly RankedFlag[]): string {
  return asText(
    renderToStaticMarkup(
      createElement(FlagList, {
        flags: ranked,
        selected: null,
        onSelect: () => {},
        base: "r",
      }),
    ),
  );
}

/** One flag's own markup, so an assertion about one flag cannot pass on another. */
function renderedFlag(html: string, code: string): string {
  const parts = html.split('<li class="flags__item"');
  const mine = parts.find((part) => part.includes(`>${code}<`));
  if (mine === undefined) throw new Error(`${code} is not in the rendered column.`);
  return mine;
}

// ── 1. a consequence, bound to the sentence it came from ──────────────────────

describe("every flag carries a consequence bound to its source sentence", () => {
  it("states what the clause does, and the sentence it is bound to is in the document", () => {
    const flags = everyFlag();
    expect(flags.length).toBeGreaterThan(0);

    for (const { name, text, flag } of flags) {
      expect(flag.consequence.fromTheDocument.trim().length, `${name} ${flag.code}`).toBeGreaterThan(0);

      // The binding, not the presence. The sentence is in the document, and it is at
      // the offsets the flag carries, so what the screen marks is what the flag quotes.
      expect(appearsVerbatim(text, flag.sourceSentence.text), `${name} ${flag.code}`).toBe(true);
      expect(text.slice(flag.sourceSentence.at.start, flag.sourceSentence.at.end)).toBe(
        flag.sourceSentence.text,
      );
    }
  });

  it("shows both of them on the screen, the consequence first", () => {
    const reading = adhesion();
    const html = renderedFlags(reading.ranked);

    for (const { flag } of reading.ranked) {
      const mine = renderedFlag(html, flag.code);
      expect(mine).toContain(flag.consequence.fromTheDocument);
      expect(mine).toContain(flag.sourceSentence.text);
      expect(mine.indexOf(flag.consequence.fromTheDocument)).toBeLessThan(
        mine.indexOf(flag.sourceSentence.text),
      );
    }
  });
});

// ── 2. external context is a separate field, rendered apart ───────────────────

describe("external context is a separate field with its own citation", () => {
  it("is never folded into the consequence", () => {
    const withContext = everyFlag().filter(({ flag }) => flag.consequence.externalContext !== null);
    expect(withContext.length).toBeGreaterThan(0);

    for (const { name, flag } of withContext) {
      const outside = flag.consequence.externalContext;
      if (outside === null) throw new Error("Filtered above.");

      expect(outside.source.title.trim().length, `${name} ${flag.code}`).toBeGreaterThan(0);
      expect(outside.fact.trim().length, `${name} ${flag.code}`).toBeGreaterThan(0);

      // Two fields, not one string with a formatting convention (ADR 0007). Neither
      // string contains the other, so no render path can have concatenated them.
      expect(flag.consequence.fromTheDocument, `${name} ${flag.code}`).not.toContain(outside.fact);
      expect(outside.fact, `${name} ${flag.code}`).not.toContain(flag.consequence.fromTheDocument);
    }
  });

  it("renders beneath the consequence, marked as outside the document and naming its source", () => {
    const reading = adhesion();
    const html = renderedFlags(reading.ranked);

    const shown = reading.ranked.filter(({ flag }) => flag.consequence.externalContext !== null);
    expect(shown.length).toBeGreaterThan(0);

    for (const { flag } of shown) {
      const outside = flag.consequence.externalContext;
      if (outside === null) throw new Error("Filtered above.");
      const mine = renderedFlag(html, flag.code);

      // Marked in words, not only by the grey field, because colour and fill cannot
      // carry meaning alone and a reader who skims must not read a regulator's figure
      // as something their contract says.
      expect(mine).toContain("External context");
      expect(mine).toContain("Your document does not say this.");
      expect(mine).toContain(outside.fact);
      expect(mine).toContain(outside.source.title);
      expect(mine).toContain(`href="${outside.source.url}"`);

      // The document-grounded claim leads and the fact sits beneath it.
      expect(mine.indexOf(flag.consequence.fromTheDocument)).toBeLessThan(mine.indexOf(outside.fact));
      expect(mine.indexOf(flag.sourceSentence.text)).toBeLessThan(mine.indexOf(outside.fact));
    }

    // Nothing renders an empty block: as many labelled blocks as there are facts.
    const labels = html.split("External context").length - 1;
    expect(labels).toBe(shown.length);
  });
});

// ── 3. what "resolves" means, over the whole store ────────────────────────────

/**
 * Every citation in the store, checked without a network call.
 *
 * What is checked: the URL parses, is https, and appears in `PRD.md`, which is where
 * the repository keeps the URLs. The source is named. The wording the entry says it was
 * taken from appears verbatim in the file it names, once that file's line wrapping is
 * collapsed. Every figure the reader is shown appears in that recorded wording.
 *
 * What is not checked, and is not claimed: that the URL is live, that the page behind it
 * still says what it said, or that the source is right. A deterministic suite makes no
 * network call, so it cannot know. `scripts/check-citations.mjs` fetches them and is run
 * by hand.
 */
describe("every external citation resolves to a source the repository records", () => {
  const SOURCED = {
    "PRODUCT.md": repositoryFile("PRODUCT.md"),
    "PRD.md": repositoryFile("PRD.md"),
  } as const;

  /** One long line, so a sentence wrapped across three lines still matches. */
  function collapsed(text: string): string {
    return text.replace(/\s+/gu, " ");
  }

  it("holds at least one fact and names a file for each", () => {
    expect(EXTERNAL_CONTEXT.length).toBeGreaterThan(0);
  });

  for (const entry of EXTERNAL_CONTEXT) {
    describe(entry.source.title, () => {
      it("has a well formed https URL that PRD.md records", () => {
        const url = new URL(entry.source.url);
        expect(url.protocol).toBe("https:");
        expect(url.hostname.length).toBeGreaterThan(3);
        expect(SOURCED["PRD.md"]).toContain(entry.source.url);
      });

      it("has a named source and a fact a reader can read", () => {
        expect(entry.source.title.trim()).toBe(entry.source.title);
        expect(entry.source.title.length).toBeGreaterThan(2);
        expect(entry.fact.trim()).toBe(entry.fact);
        expect(entry.fact.length).toBeGreaterThan(20);
      });

      it("matches the wording recorded in the file it names", () => {
        expect(collapsed(SOURCED[entry.recordedIn])).toContain(collapsed(entry.recorded));
      });

      it("shows the reader no figure the recorded wording does not carry", () => {
        // Its own scan rather than `figuresIn`, which skips anything followed by
        // million or billion, and two of these facts are counted in billions.
        const figures = entry.fact.match(/\d[\d,]*(?:\.\d+)?/gu) ?? [];
        expect(figures.length).toBeGreaterThan(0);
        for (const figure of figures) {
          const at = new RegExp(`(?<!\\d)${figure.replace(/[.]/gu, "\\.")}(?!\\d)`, "u");
          expect(at.test(entry.recorded), `${figure} in ${entry.recordedIn}`).toBe(true);
        }
      });

      it("sits under clause types that rest on regulatory measurement", () => {
        expect(entry.clauseTypes.length).toBeGreaterThan(0);
        for (const slug of entry.clauseTypes) {
          expect(CLAUSE_TYPE_SLUGS).toContain(slug);
          expect(clauseType(slug).evidence, slug).toBe("regulator-evidenced");
        }
      });
    });
  }

  it("holds one fact per clause type, so the accessor hides no second one", () => {
    const attached = EXTERNAL_CONTEXT.flatMap((entry) => entry.clauseTypes);
    expect(new Set(attached).size).toBe(attached.length);
  });

  it("leaves the types with no sourced figure without one", () => {
    const without = CLAUSE_TYPE_SLUGS.filter((slug) => externalContextFor(slug) === null);

    // Three of the seven, and the three are the ones resting on lawyers' negotiating
    // data or on reasoning alone. A flag with no external context is the common case.
    expect(without).toEqual(["unilateral-modification", "limitation-of-liability", "indemnification"]);
    for (const slug of without) {
      expect(clauseType(slug).evidence, slug).toBe("weaker-evidence");
    }
  });
});

// ── 4. an exit shows the sentence that grants it ──────────────────────────────

describe("every exit carries a source sentence that verifies verbatim", () => {
  it("is in the document at the offsets it carries, the same check a flag's sentence goes through", () => {
    const exits = everyFlag().filter(({ flag }) => flag.exit !== null);

    // Three in the fixture: two cancellation deadlines and one arbitration opt-out.
    expect(exits.length).toBeGreaterThanOrEqual(3);

    for (const { name, text, flag } of exits) {
      const exit = flag.exit;
      if (exit === null) throw new Error("Filtered above.");

      expect(exit.text.trim().length, `${name} ${flag.code}`).toBeGreaterThan(0);
      expect(appearsVerbatim(text, exit.sourceSentence.text), `${name} ${flag.code}`).toBe(true);
      expect(text.slice(exit.sourceSentence.at.start, exit.sourceSentence.at.end)).toBe(
        exit.sourceSentence.text,
      );
    }
  });

  it("carries the arbitration opt-out the fixture grants, with its own sentence", () => {
    const reading = adhesion();
    const arbitration = reading.analysis.flags.find(
      (flag) => flag.clauseType === "arbitration-and-class-action-waiver",
    );
    const exit = arbitration?.exit ?? null;
    if (arbitration === undefined || exit === null) {
      throw new Error("The arbitration clause in the fixture grants an opt-out.");
    }

    // The thirty-day window, with the non-breaking space the document writes it with
    // and nothing normalised on the way through. That character is the reason the
    // verbatim check is worth having.
    expect(exit.sourceSentence.text).toContain("thirty\u00a0(30) days");
    expect(reading.text).toContain(exit.sourceSentence.text);

    // On the screen, under its own heading, with the sentence that grants it.
    const mine = renderedFlag(renderedFlags(reading.ranked), arbitration.code);
    expect(mine).toContain("The way out this document gives you");
    expect(mine).toContain(exit.text);
    expect(mine).toContain("The sentence that grants it");
    expect(mine).toContain(exit.sourceSentence.text);
  });

  it("renders no exit block on a flag the document gives no way out of", () => {
    const reading = adhesion();
    const html = renderedFlags(reading.ranked);
    const without = reading.ranked.filter(({ flag }) => flag.exit === null);
    expect(without.length).toBeGreaterThan(0);

    for (const { flag } of without) {
      expect(renderedFlag(html, flag.code)).not.toContain("The way out this document gives you");
    }
  });
});

// ── 5. no statutory right, anywhere in a flag ─────────────────────────────────

/**
 * What this check catches: a wording that claims a law, a right the reader holds, or an
 * enforceability judgement. A statute by name, a cooling-off period, a right to cancel
 * or to sue, "unenforceable", "void", "consumer protection", "state law", "you may still
 * have", "where you live", a sentence about what courts do (`src/domain/wording.ts`).
 *
 * What it misses. It reads words, so a statutory right described without any of those
 * words gets through: "you can take this to the county clerk within three days anyway"
 * names no law and asserts one. It cannot tell a document's own sentence from ours, so a
 * clause that quotes a statute would be caught even though quoting it is correct. It
 * does not catch a right implied by what a consequence leaves out. And it does not look
 * for a regulator's name or a rule's name on purpose, because external context is built
 * out of regulators' measurements: the non-compete fact names an FTC rule and asserts
 * nothing about what the reader may do, and a check that could not tell those apart
 * would have to lose the fact base.
 */
describe("no statutory right appears anywhere in a flag", () => {
  it("says nothing about the law in any consequence or exit, over both fixtures", () => {
    for (const { name, flag } of everyFlag()) {
      expect(statutoryLanguageIn(flag.consequence.fromTheDocument), `${name} ${flag.code}`).toEqual([]);
      if (flag.exit !== null) {
        expect(statutoryLanguageIn(flag.exit.text), `${name} ${flag.code} exit`).toEqual([]);
      }
    }
  });

  it("says nothing about the law anywhere in the fact base", () => {
    for (const entry of EXTERNAL_CONTEXT) {
      expect(statutoryLanguageIn(entry.fact), entry.source.title).toEqual([]);
      expect(statutoryLanguageIn(entry.source.title), entry.source.title).toEqual([]);
    }
  });

  it("catches the wordings a flag would most plausibly reach for", () => {
    const WOULD_BE_CAUGHT = [
      "You may still have a right to cancel under state law.",
      "Most states give you a three-day cooling-off period after signing.",
      "A clause this broad is unenforceable in your state.",
      "You are entitled to a refund whatever this says.",
      "Consumer protection rules override this clause.",
      "Courts usually refuse to enforce a restriction this wide.",
      "This is probably void where you live.",
      "You keep the right to sue no matter what the agreement says.",
    ] as const;

    for (const line of WOULD_BE_CAUGHT) {
      expect(statutoryLanguageIn(line).length, line).toBeGreaterThan(0);
    }
  });

  it("leaves a sentence that only reports the document alone", () => {
    // Each of these is what a flag is for. A check that refused them would refuse the
    // product: they describe the document's own terms and claim nothing about the law.
    const LEFT_ALONE = [
      "A dispute with Meridian goes to one arbitrator instead of a court, with no jury.",
      "Take written cancellation to the Member Services desk more than three days before your renewal date.",
      "Write to the Member Services address in Section 11 within thirty days of first accepting the agreement.",
      "For a year after your candidacy ends, you cannot teach group fitness within fifteen miles of a Meridian club.",
      "You pay Meridian's costs and legal fees, including reasonable legal fees, when a third party brings a claim.",
    ] as const;

    for (const line of LEFT_ALONE) {
      expect(statutoryLanguageIn(line), line).toEqual([]);
    }
  });
});

// ── 6. no verdict, anywhere in a flag ─────────────────────────────────────────

/**
 * The same list, read whole rather than by its statutory half. It catches a
 * recommendation about signing, a judgement of the document's character, a reassurance
 * and a claim about the law. It does not catch a verdict carried by emphasis, by
 * ordering, or by which flag is put first, and it never will: those are not wordings.
 * Ranking is tested in `tests/ranking.test.ts` and says nothing about signing either.
 */
describe("no sign or don't-sign verdict appears in a flag", () => {
  it("is absent from every field a reader reads on a flag, over both fixtures", () => {
    for (const { name, flag } of everyFlag()) {
      const fields = [
        flag.consequence.fromTheDocument,
        flag.consequence.externalContext?.fact ?? "",
        flag.consequence.externalContext?.source.title ?? "",
        flag.exit?.text ?? "",
      ];
      for (const field of fields) {
        if (field.length === 0) continue;
        expect(verdictLanguageIn(field), `${name} ${flag.code}: ${field}`).toEqual([]);
      }
    }
  });

  it("is absent from the fact base, read as the reader reads it", () => {
    for (const entry of EXTERNAL_CONTEXT) {
      expect(verdictLanguageIn(entry.fact), entry.source.title).toEqual([]);
    }
  });
});

// ── 7. the standing statement, on a rendered analysis ─────────────────────────

describe("jurisdiction neutrality and the legal-advice statement are where the reader will see them", () => {
  it("are on the rendered analysis, above the first flag", () => {
    const reading = adhesion();
    const html = renderedFlags(reading.ranked);

    expect(html).toContain(STANDING_STATEMENT.heading);
    expect(html).toContain(STANDING_STATEMENT.jurisdiction);
    expect(html).toContain(STANDING_STATEMENT.legalAdvice);

    // Not buried: before the list of flags, so a reader who reads the flags meets it
    // without going looking.
    expect(html.indexOf(STANDING_STATEMENT.jurisdiction)).toBeLessThan(html.indexOf('class="flags"'));
    expect(html.indexOf(STANDING_STATEMENT.legalAdvice)).toBeLessThan(html.indexOf('class="flags"'));
  });

  it("says it once for the analysis rather than once per flag", () => {
    const reading = adhesion();
    const html = renderedFlags(reading.ranked);

    expect(reading.ranked.length).toBeGreaterThan(1);
    expect(html.split(STANDING_STATEMENT.legalAdvice).length - 1).toBe(1);
    expect(html.split(STANDING_STATEMENT.jurisdiction).length - 1).toBe(1);
  });

  it("is announced as its own region with a real heading", () => {
    const html = renderedFlags(adhesion().ranked);
    const aside = html.slice(html.indexOf("<aside"), html.indexOf("</aside>"));

    expect(aside).toContain("aria-labelledby");
    expect(aside).toContain("<h3");
    expect(aside).toContain(STANDING_STATEMENT.heading);
  });

  it("warns without becoming the thing it warns about", () => {
    // The one place allowed to say where the reader lives, because a warning that
    // Redline does not account for it cannot be written without naming it. Every other
    // kind of verdict is still refused here, so the exemption buys nothing else.
    for (const line of STANDING_STATEMENT_LINES) {
      const kinds = verdictLanguageIn(line).map((finding) => finding.kind);
      expect(kinds.filter((kind) => kind !== "claims-a-law-or-a-right"), line).toEqual([]);
    }

    // And it is specific enough to warn: it says what Redline does not do, in words a
    // worried reader can act on, rather than only that it is not legal advice.
    expect(STANDING_STATEMENT.jurisdiction).toContain("where you live");
    expect(STANDING_STATEMENT.legalAdvice).toContain("does not give legal advice");
  });
});

// ── 8. a flag with no external context is complete ────────────────────────────

describe("a flag with no external context is not treated as incomplete", () => {
  it("renders its consequence and its sentence with nothing standing in for the missing fact", () => {
    const reading = adhesion();
    const html = renderedFlags(reading.ranked);

    const without = reading.ranked.filter(({ flag }) => flag.consequence.externalContext === null);
    expect(without.length).toBeGreaterThan(0);

    for (const { flag } of without) {
      const mine = renderedFlag(html, flag.code);

      // Everything a flag is for is on the screen.
      expect(mine).toContain(flag.consequence.fromTheDocument);
      expect(mine).toContain(flag.sourceSentence.text);
      expect(mine).toContain("The sentence it came from");

      // And nothing says a fact is missing: no label, no empty block, no placeholder.
      expect(mine).not.toContain("External context");
      expect(mine).not.toContain("Your document does not say this.");
      expect(mine).not.toContain("flag__ext");
    }
  });

  it("was not recorded as a defect by the seam", () => {
    // A type with no sourced figure is the store being honest. It is not a drop, so
    // nothing about it is logged, and ticket 13 counts no defects for it.
    const reading = adhesion();
    expect(reading.analysis.defects).toEqual([]);
    expect(externalContextFor("indemnification")).toBeNull();
  });
});

// ── no network ────────────────────────────────────────────────────────────────

describe("reading what a flag says", () => {
  it("made no network call", () => {
    expect(fetchAttempts).toBe(0);
  });
});
