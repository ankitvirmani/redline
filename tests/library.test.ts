import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import LibraryList, { EMPTY_LIBRARY_KEY } from "@/components/LibraryList";
import Reading from "@/components/Reading";
import { analyse, type DocumentAnalysis } from "@/src/analysis";
import { extract, type ExtractedDocument } from "@/src/extraction";
import {
  documentTitle,
  keptOn,
  libraryEntry,
  libraryReading,
  type LibraryRow,
} from "@/src/library/entry";
import {
  keptDocumentInsert,
  readKeptDocument,
  reverifiedAnalysis,
  type KeptDocumentRow,
} from "@/src/library/stored";
import { stubModelClient } from "@/src/model/stub";

/**
 * The library: what is stored, what is not, what a stored row looks like when it
 * comes back, and what an empty library says.
 *
 * No Supabase project exists, so nothing here talks to one and nothing here pretends
 * to. What is tested is every rule that can be tested without one, which is most of
 * them, because the rules live in pure functions and only the four calls in
 * `src/library/store.ts` need a database.
 *
 * What is deliberately not tested, because it cannot honestly be: that sign-in works,
 * that a policy denies another reader, that an insert and a select round trip through
 * Postgres. There is no mock of the Supabase client in this file. A test that mocked
 * the client and then asserted the mock was called would prove that this file calls a
 * function, which is not a thing worth knowing.
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
  expect(fetchAttempts).toBe(0);
});

// ── one document, read the way the screen reads it ────────────────────────────

const ROOT = new URL("../", import.meta.url);

function repositoryFile(name: string): string {
  return readFileSync(fileURLToPath(new URL(name, ROOT)), "utf8");
}

const READER = "11111111-2222-3333-4444-555555555555";

let document: ExtractedDocument;
let analysis: DocumentAnalysis;

beforeAll(async () => {
  const extraction = await extract({
    kind: "pasted-text",
    text: repositoryFile("tests/fixtures/adhesion-contract.txt"),
  });
  if (extraction.outcome !== "extracted") throw new Error("The fixture did not extract.");
  document = extraction.document;

  const read = await analyse({ document, model: stubModelClient() });
  if (read.outcome !== "analysed") throw new Error(`The fixture did not analyse: ${read.reason}.`);
  analysis = read.analysis;
});

/** The row the insert would become, as the table would hand it back. */
function rowFor(
  text: string,
  kept: DocumentAnalysis,
  at = "2026-09-12T09:30:00+00:00",
): KeptDocumentRow {
  const insert = keptDocumentInsert(READER, {
    document: { ...document, text, characterCount: [...text].length },
    analysis: kept,
  });

  return {
    id: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
    extracted_text: insert.extracted_text,
    character_count: insert.character_count,
    source_kind: insert.source_kind,
    completeness: insert.completeness,
    // The one thing the database does to it: json in, json out. Round-tripping it
    // here is what makes this a test of the reader rather than of object identity.
    analysis: JSON.parse(JSON.stringify(insert.analysis)) as unknown,
    kept_at: at,
  };
}

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

// ── what a stored row looks like in the list ──────────────────────────────────

describe("a stored row as a line in the library", () => {
  const row: LibraryRow = {
    id: "0198f0b6-1111-4222-8333-444444444444",
    opening: "SUBSCRIPTION TERMS OF SERVICE\n\nThese terms apply to your account.",
    character_count: 4210,
    kept_at: "2026-09-12T09:30:00+00:00",
  };

  it("takes its title from the document's own opening line", () => {
    expect(libraryEntry(row).title).toBe("SUBSCRIPTION TERMS OF SERVICE");
  });

  it("links to the document, and says the day it was kept", () => {
    const entry = libraryEntry(row);
    expect(entry.href).toBe(`/library/${row.id}`);
    expect(entry.keptOn).toBe("12 September 2026");
    expect(entry.characterCount).toBe(4210);
  });

  it("skips blank lines to find the heading a reader would read", () => {
    expect(documentTitle("\n\n   \nMEMBERSHIP AGREEMENT\nClause 1.")).toBe("MEMBERSHIP AGREEMENT");
  });

  it("cuts a long opening line at a word, and says it was cut", () => {
    const long =
      "This agreement is made between the company and the subscriber and sets out every term that applies to the service";
    const title = documentTitle(long) ?? "";

    expect(title.length).toBeLessThan(long.length);
    expect(title.endsWith("…")).toBe(true);
    expect(long.startsWith(title.slice(0, -1))).toBe(true);
    // Cut at a space, so the last word on screen is a whole word: the character the
    // original has where the title stops is the space the cut was made at.
    const kept = title.slice(0, -1);
    expect(kept.endsWith(" ")).toBe(false);
    expect(long[kept.length]).toBe(" ");
  });

  it("names a document whose opening carries no words by the day it was kept", () => {
    expect(documentTitle("   \n\n \t ")).toBeNull();
    expect(libraryEntry({ ...row, opening: "   \n\n" }).title).toBe(
      "A document kept on 12 September 2026",
    );
  });

  it("says nothing about a timestamp it cannot read", () => {
    expect(keptOn("not a date")).toBe("");
  });
});

// ── the order the reader reads them in ────────────────────────────────────────

describe("the order of the list", () => {
  const of = (id: string, keptAt: string): LibraryRow => ({
    id,
    opening: `Document ${id}`,
    character_count: 2000,
    kept_at: keptAt,
  });

  it("puts the document kept most recently first, whatever order the rows arrive in", () => {
    const reading = libraryReading([
      of("older", "2026-08-01T12:00:00+00:00"),
      of("newest", "2026-09-12T08:00:00+00:00"),
      of("oldest", "2026-01-15T23:59:00+00:00"),
      of("newer", "2026-09-01T00:00:00+00:00"),
    ]);

    expect(reading.entries.map((entry) => entry.id)).toEqual([
      "newest",
      "newer",
      "older",
      "oldest",
    ]);
    expect(reading.empty).toBe(false);
  });

  it("reads two documents kept in the same second as a list, not as an error", () => {
    const reading = libraryReading([
      of("one", "2026-09-12T08:00:00+00:00"),
      of("two", "2026-09-12T08:00:00+00:00"),
    ]);
    expect(reading.entries).toHaveLength(2);
  });
});

// ── the empty library ────────────────────────────────────────────────────────

describe("a library with nothing in it", () => {
  it("reads as empty rather than as a list of nothing", () => {
    const reading = libraryReading([]);
    expect(reading.empty).toBe(true);
    expect(reading.entries).toHaveLength(0);
  });

  it("says what the library is for, and not just that it is empty", () => {
    const screen = asText(
      renderToStaticMarkup(
        createElement(LibraryList, { reading: libraryReading([]), headingId: "h" }),
      ),
    );

    expect(screen).toContain(EMPTY_LIBRARY_KEY);
    // What it holds, and the thing a reader would want to know before keeping a
    // contract anywhere: that the file itself is not kept.
    expect(screen).toContain("quoting the sentence it came from");
    expect(screen).toContain("never keeps the file you started with");
    // An empty library is not an empty list on the screen.
    expect(screen).not.toContain("<ul");
  });

  it("lists the documents when there are some", () => {
    const screen = asText(
      renderToStaticMarkup(
        createElement(LibraryList, {
          reading: libraryReading([
            {
              id: "0198f0b6-1111-4222-8333-444444444444",
              opening: "GYM MEMBERSHIP AGREEMENT",
              character_count: 5000,
              kept_at: "2026-09-12T09:30:00+00:00",
            },
          ]),
          headingId: "h",
        }),
      ),
    );

    expect(screen).toContain("<ul");
    expect(screen).toContain("GYM MEMBERSHIP AGREEMENT");
    expect(screen).toContain("Kept 12 September 2026");
    expect(screen).toContain("/library/0198f0b6-1111-4222-8333-444444444444");
  });
});

// ── only extracted text is stored ─────────────────────────────────────────────

/**
 * The case a PDF produces, built here because the PDF path is ticket 03's and
 * extraction has one source kind today. What matters is the case rather than the
 * label: in this test the file bytes exist, the text was read out of them, and the
 * row that goes to Supabase has to contain the text and nothing of the file.
 */
const PDF_BYTES = new TextEncoder().encode(
  [
    "%PDF-1.7",
    "1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj",
    "4 0 obj << /Length 84 >> stream",
    "BT /F1 11 Tf (MEMBERSHIP AGREEMENT) Tj ET",
    "endstream endobj",
    "trailer << /Root 1 0 R >>",
    "%%EOF",
  ].join("\n"),
);

/** Everything the row is made of, as a list of what each value is. */
function valuesIn(value: unknown, at = "row"): readonly { readonly at: string; readonly value: unknown }[] {
  if (value === null || typeof value !== "object") return [{ at, value }];
  if (Array.isArray(value)) return value.flatMap((item, index) => valuesIn(item, `${at}[${index}]`));
  return Object.entries(value).flatMap(([key, item]) => valuesIn(item, `${at}.${key}`));
}

function keysIn(value: unknown): readonly string[] {
  if (value === null || typeof value !== "object") return [];
  if (Array.isArray(value)) return value.flatMap((item) => keysIn(item));
  return Object.entries(value).flatMap(([key, item]) => [key, ...keysIn(item)]);
}

describe("what is sent to Supabase when a document is kept", () => {
  const text = "MEMBERSHIP AGREEMENT\n\nThe member waives any right to bring a claim in court.";

  const insert = keptDocumentInsert(READER, {
    document: {
      text,
      characterCount: [...text].length,
      sourceKind: "pasted",
      completeness: { level: "partial", signals: [{ code: "implausibly-short", fired: true }] },
    },
    analysis: { summary: { text: "A membership." }, checkedClauseTypes: [], flags: [], defects: [] },
  });

  it("carries the extracted text, character for character", () => {
    expect(insert.extracted_text).toBe(text);
    expect(insert.character_count).toBe([...text].length);
  });

  it("carries no file: nothing binary, and no field that could hold one", () => {
    for (const { at, value } of valuesIn(insert)) {
      expect(
        value === null ||
          typeof value === "string" ||
          typeof value === "number" ||
          typeof value === "boolean",
        `${at} is ${typeof value}`,
      ).toBe(true);
      expect(value instanceof Uint8Array, at).toBe(false);
      expect(value instanceof ArrayBuffer, at).toBe(false);
    }

    for (const key of keysIn(insert)) {
      expect(key, `the row has a field called ${key}`).not.toMatch(
        /file|blob|bytes|binary|base64|upload|attachment|storage|data_url/iu,
      );
    }
  });

  it("carries nothing of the PDF the text was read out of", () => {
    const sent = JSON.stringify(insert);

    for (const marker of ["%PDF", "endstream", "/Type /Catalog", "%%EOF"]) {
      expect(sent, `the row carries ${marker}`).not.toContain(marker);
    }
    expect(sent).not.toContain(Buffer.from(PDF_BYTES).toString("base64"));
    expect(sent).not.toContain(Buffer.from(PDF_BYTES).toString("latin1"));

    // And the thing that should be there, is.
    expect(sent).toContain("The member waives any right to bring a claim in court.");
  });

  it("names the reader it belongs to, which is what the insert policy checks", () => {
    expect(insert.reader_id).toBe(READER);
  });
});

// ── a kept document, read back ───────────────────────────────────────────────

describe("a document reopened from the library", () => {
  it("comes back as the reading the reader was shown", () => {
    const reading = readKeptDocument(rowFor(document.text, analysis));
    expect(reading.outcome).toBe("reopened");
    if (reading.outcome !== "reopened") return;

    expect(reading.document.text).toBe(document.text);
    expect(reading.document.completeness.level).toBe(document.completeness.level);
    expect(reading.analysis.summary.text).toBe(analysis.summary.text);
    expect(reading.analysis.flags).toHaveLength(analysis.flags.length);
    expect(reading.flagsDropped).toBe(0);
    expect(reading.keptAt).toBe("2026-09-12T09:30:00+00:00");
  });

  it("renders with every flag still quoting a sentence from the stored text", () => {
    const reading = readKeptDocument(rowFor(document.text, analysis));
    if (reading.outcome !== "reopened") throw new Error("The row did not reopen.");

    const screen = asText(
      renderToStaticMarkup(
        createElement(Reading, { document: reading.document, analysis: reading.analysis }),
      ),
    );

    expect(reading.analysis.flags.length).toBeGreaterThan(0);
    for (const flag of reading.analysis.flags) {
      expect(screen, flag.code).toContain(flag.sourceSentence.text);
      expect(reading.document.text).toContain(flag.sourceSentence.text);
    }
    expect(screen).toContain(reading.analysis.summary.text);
  });

  it("drops a flag whose sentence is not in the stored text, rather than showing it", () => {
    const first = analysis.flags[0];
    if (first === undefined) throw new Error("The fixture has no flags.");

    // The text stored without the sentence one flag cites, which is the shape of the
    // disagreement this check exists for: a row whose analysis and whose text no
    // longer say the same thing.
    const without = document.text.replace(first.sourceSentence.text, "");
    const reading = readKeptDocument(rowFor(without, analysis));
    if (reading.outcome !== "reopened") throw new Error("The row did not reopen.");

    expect(reading.flagsDropped).toBe(1);
    expect(reading.analysis.flags.map((flag) => flag.code)).not.toContain(first.code);
    for (const flag of reading.analysis.flags) {
      expect(without, flag.code).toContain(flag.sourceSentence.text);
    }
  });

  it("locates every sentence in the text it is about, not in the text it was stored with", () => {
    const first = analysis.flags[0];
    if (first === undefined) throw new Error("The fixture has no flags.");

    // The same document with something added in front of it. Every span moves, and a
    // screen drawing a mark from a stored index would mark the wrong words.
    const moved = `A COVER PAGE\n\n${document.text}`;
    const reading = readKeptDocument(rowFor(moved, analysis));
    if (reading.outcome !== "reopened") throw new Error("The row did not reopen.");

    for (const flag of reading.analysis.flags) {
      expect(moved.slice(flag.sourceSentence.at.start, flag.sourceSentence.at.end)).toBe(
        flag.sourceSentence.text,
      );
    }
  });

  it("refuses a row whose analysis is not one, rather than showing part of it", () => {
    const row = rowFor(document.text, analysis);

    expect(readKeptDocument({ ...row, analysis: { summary: "a string" } }).outcome).toBe(
      "unreadable",
    );
    expect(readKeptDocument({ ...row, analysis: null }).outcome).toBe("unreadable");
    expect(readKeptDocument({ ...row, completeness: { level: "mostly" } }).outcome).toBe(
      "unreadable",
    );
    expect(readKeptDocument({ ...row, extracted_text: "" }).outcome).toBe("unreadable");
  });

  it("keeps a row written by a later build, carrying what this build understands", () => {
    const row = rowFor(document.text, analysis);
    const later = {
      ...(row.analysis as Record<string, unknown>),
      somethingTicketFifteenAdded: { whatever: true },
    };

    const reading = readKeptDocument({ ...row, analysis: later });
    expect(reading.outcome).toBe("reopened");
  });
});

// ── the same check, on the way in ────────────────────────────────────────────

describe("what the keep route checks before it stores anything", () => {
  it("drops a flag whose sentence is not in the text being stored", () => {
    const first = analysis.flags[0];
    if (first === undefined) throw new Error("The fixture has no flags.");

    const held = reverifiedAnalysis(document.text.replace(first.sourceSentence.text, ""), analysis);

    expect(held.flagsDropped).toBe(1);
    expect(held.analysis.flags.map((flag) => flag.code)).not.toContain(first.code);
  });

  it("keeps every flag when the text is the text they were drawn from", () => {
    const held = reverifiedAnalysis(document.text, analysis);
    expect(held.flagsDropped).toBe(0);
    expect(held.analysis.flags).toHaveLength(analysis.flags.length);
  });
});
