import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { REFUSAL_SAYS } from "@/components/refusal-view";
import {
  EXTRACTION_REJECTION_REASONS,
  extract,
  type ExtractedDocument,
  type Extraction,
  type ExtractionRejectionReason,
} from "@/src/extraction";

/**
 * A PDF through the extraction seam: the text layer read out of it, and the typed
 * refusal of a document there is nothing to read in.
 *
 * No network and no key. The parser runs in this process, on bytes read off disk.
 *
 * The fixtures under `tests/fixtures/pdf/` are hand-built PDFs, laid down byte by
 * byte by `scripts/make-pdf-fixtures.mjs`: numbered objects, a real cross-reference
 * table, and a content stream of text-showing operators. Nothing generated them and
 * nothing but the specification decided their contents, which is the only way the
 * expected text below can be known character for character.
 *
 * The expectation is written out here as its own literal, in this file, with every
 * awkward character as an escape so that no editor or formatter can quietly repair
 * the corpus and leave the test passing on text that is no longer awkward. It does
 * not import anything from the script that wrote the bytes. If the two ever
 * disagree, this fails, and that is the check worth having.
 */

// ── the suite makes no network call ───────────────────────────────────────────

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

// ── the characters that decide whether a citation holds ───────────────────────

const EM_DASH = "—";
const CURLY_OPEN = "“";
const CURLY_CLOSE = "”";
const APOSTROPHE = "’";
const LIGATURE_FI = "ﬁ";
const LIGATURE_FL = "ﬂ";
const NBSP = " ";

/**
 * The offer letter's first page, exactly as its text layer carries it, except for
 * one character: the text layer has a non-breaking space between "within" and "30",
 * and PDF.js hands back a plain space there. The block on whitespace, below, asserts
 * that on its own.
 */
const PAGE_ONE = [
  `MERIDIAN LABS ${EM_DASH} OFFER OF EMPLOYMENT`,
  "This letter sets out the terms on which Meridian Labs offers you",
  "employment. The offer stands for five business days from the date",
  "above and is withdrawn after that without further notice.",
  "Your salary is 74,000 dollars a year, paid monthly. Meridian may",
  "change the figure at any time on thirty days written notice, and",
  "your continued work after that notice is your acceptance of it.",
  `${CURLY_OPEN}Confidential Information${CURLY_CLOSE} means anything you learn here that`,
  "is not public, and the obligation does not end when your",
  `employment does. Indemni${LIGATURE_FI}cation survives termination, and you`,
  `will cover Meridian${APOSTROPHE}s costs in any claim brought by a third`,
  "party arising from your work. Notice of resignation is due",
  "within 30 days of the date you intend to leave.",
] as const;

/** Its second page, ending in the signature block a whole document ends in. */
const PAGE_TWO = [
  "Any dispute about this letter goes to binding arbitration in San",
  "Mateo County, and you give up the right to bring or join a class",
  "action. Meridian may amend the employee handbook, which forms",
  "part of these terms, at any time and without asking you first.",
  `Con${LIGATURE_FL}ict of interest rules apply for the whole of your employment`,
  "and for twelve months after it ends. Nothing in this letter is a",
  "promise of employment for any fixed term.",
  "ACCEPTED AND AGREED",
  // The text layer has two spaces before "Date". PDF.js collapses a run of
  // whitespace glyphs to one, which the next block asserts on its own.
  "Signature: ______________________________ Date: ______________",
  "Print name: __________________________________________________",
] as const;

/**
 * What extraction should hand back for the whole document.
 *
 * A page break is one newline, which is the rule `src/extraction/pdf.ts` states: a
 * PDF's text layer has no lines in it, only glyphs at coordinates, so every newline
 * here was put there by that rule and none of it was read out of the document.
 */
const OFFER_LETTER = [...PAGE_ONE, ...PAGE_TWO].join("\n");

// ── reading the fixtures ──────────────────────────────────────────────────────

function fixtureBytes(name: string): Uint8Array {
  const path = fileURLToPath(new URL(`./fixtures/pdf/${name}`, import.meta.url));
  return new Uint8Array(readFileSync(path));
}

async function readPdf(name: string): Promise<Extraction> {
  return extract({ kind: "pdf", bytes: fixtureBytes(name) });
}

async function documentFrom(name: string): Promise<ExtractedDocument> {
  const result = await readPdf(name);
  if (result.outcome !== "extracted") {
    throw new Error(`expected a document from ${name}, got: ${result.reason}`);
  }
  return result.document;
}

async function refusalFor(name: string): Promise<ExtractionRejectionReason> {
  const result = await readPdf(name);
  if (result.outcome !== "rejected") {
    throw new Error(`expected ${name} to be refused, and it was read instead`);
  }
  return result.reason;
}

function firedCodes(document: ExtractedDocument): readonly string[] {
  return document.completeness.signals.filter((signal) => signal.fired).map((s) => s.code);
}

// ── a text layer comes back character for character ───────────────────────────

describe("a PDF with a text layer comes back as the text in it", () => {
  it("hands back the whole document, character for character, against a known string", async () => {
    const document = await documentFrom("text-layer-offer-letter.pdf");

    expect(document.text).toBe(OFFER_LETTER);
    expect(document.text.split("\n")).toEqual([...PAGE_ONE, ...PAGE_TWO]);
  });

  it("keeps an em dash, curly quotation marks, a curly apostrophe and two ligatures", async () => {
    // The failure this is here for: the most common way a citation breaks in this
    // product is a character retyped instead of copied, and a PDF text layer is
    // where those characters come from. A parser that folded any of these would
    // break every flag in the document silently (ADR 0001).
    const { text } = await documentFrom("text-layer-offer-letter.pdf");

    for (const character of [
      EM_DASH,
      CURLY_OPEN,
      CURLY_CLOSE,
      APOSTROPHE,
      LIGATURE_FI,
      LIGATURE_FL,
    ]) {
      expect(text, JSON.stringify(character)).toContain(character);
    }

    expect(text).toContain(`Indemni${LIGATURE_FI}cation`);
    expect(text).toContain(`Con${LIGATURE_FL}ict`);
  });

  it("leaves the text in the Unicode form the text layer had it in", async () => {
    // Normalising would expand both ligatures, and every source sentence checked
    // against this text would stop matching. This asserts it did not happen by
    // showing the text is not already in the normalised form.
    const { text } = await documentFrom("text-layer-offer-letter.pdf");

    expect(text.normalize("NFKC")).not.toBe(text);
    expect(text.normalize("NFKC")).toContain("Indemnification");
    expect(text).not.toContain("Indemnification");
  });

  it("says the text came off a PDF, and counts the characters a reader can see", async () => {
    const document = await documentFrom("text-layer-offer-letter.pdf");

    expect(document.sourceKind).toBe("pdf");
    expect(document.characterCount).toBe(Array.from(OFFER_LETTER).length);
  });

  it("reads a page break as one line break and invents no blank line or trailing newline", async () => {
    const { text } = await documentFrom("text-layer-offer-letter.pdf");

    expect(text).toContain(`${PAGE_ONE[12]}\n${PAGE_TWO[0]}`);
    expect(text).not.toContain("\n\n");
    expect(text.endsWith("\n")).toBe(false);
    expect(text.startsWith("\n")).toBe(false);
  });
});

// ── the one character the parser will not hand over ───────────────────────────

describe("the whitespace PDF.js will not hand back, which is the parser and not this seam", () => {
  it("declares a non-breaking space in the fixture's text layer", () => {
    // Asserted against the bytes rather than taken on trust: this is the /ToUnicode
    // entry that says the glyph at code 3 is U+00A0 and not a space.
    const bytes = Buffer.from(fixtureBytes("text-layer-offer-letter.pdf"));
    expect(bytes.toString("latin1")).toContain("<03> <00A0>");
  });

  it("hands it back as a plain space, which is PDF.js and not this seam", async () => {
    // PDF.js replaces every whitespace glyph with U+0020 inside the worker, before
    // an item reaches the public API, and its `keepWhiteSpace` option is not
    // reachable through `getTextContent`. Recorded here rather than worked around,
    // so that the day it changes is a failing test and not a silent change of the
    // text every citation in the product is checked against.
    const { text } = await documentFrom("text-layer-offer-letter.pdf");

    expect(text).not.toContain(NBSP);
    expect(text).toContain("within 30 days");
  });

  it("collapses a run of spaces in the text layer to one, for the same reason", async () => {
    // The content stream is uncompressed, so the two spaces can be read straight
    // out of the fixture's bytes rather than taken on trust. PDF.js emits at most
    // one space before the next glyph however many whitespace glyphs it passed, and
    // emits none at all where no glyph follows, so a trailing space on a line does
    // not survive either. This is the whole of what the seam cannot preserve.
    const bytes = Buffer.from(fixtureBytes("text-layer-offer-letter.pdf")).toString("latin1");
    expect(bytes).toContain("______  Date:");

    const { text } = await documentFrom("text-layer-offer-letter.pdf");
    expect(text).toContain("______ Date:");
    expect(text).not.toContain("______  Date:");
  });
});

// ── a refusal, never a document of nothing ────────────────────────────────────

describe("a PDF there is nothing to read in is refused, and says why", () => {
  it("refuses a PDF with no text layer rather than returning empty text", async () => {
    const result = await readPdf("no-text-layer.pdf");

    expect(result.outcome).toBe("rejected");
    expect(result).toEqual({ outcome: "rejected", reason: "pdf-has-no-text-layer" });
    // Said the other way round too, because this is the failure that matters: a
    // document of empty text would be summarised, read as clean, and shown to a
    // reader with nothing to tell them there was never anything there.
    if (result.outcome === "extracted") {
      expect.unreachable("a PDF with no text layer was read as a document");
    }
  });

  it("refuses a PDF whose pages are images, with its own reason", async () => {
    expect(await refusalFor("pages-are-images.pdf")).toBe("pdf-is-images");
  });

  it("tells a scan apart from a PDF that simply has no text in it", async () => {
    // Two reasons, not one, because they are two different things to be told and
    // the parser can actually tell them apart: a page that paints an image and
    // gave up no text is a photograph, and a page that paints nothing is empty.
    expect(await refusalFor("pages-are-images.pdf")).not.toBe(
      await refusalFor("no-text-layer.pdf"),
    );
  });

  it("refuses a locked PDF for being locked rather than for being unreadable", async () => {
    expect(await refusalFor("locked.pdf")).toBe("pdf-needs-a-password");
  });

  it("refuses something that is not a PDF at all", async () => {
    expect(await refusalFor("not-a-pdf.pdf")).toBe("pdf-unreadable");
  });

  it("refuses an empty selection the same way, without throwing", async () => {
    expect(await extract({ kind: "pdf", bytes: new Uint8Array() })).toEqual({
      outcome: "rejected",
      reason: "pdf-unreadable",
    });
  });
});

// ── every reason a machine can branch on has a sentence a reader can read ─────

describe("the reasons are machine-readable, and every one of them has copy", () => {
  it("carries a reader-facing sentence for every reason the union declares", () => {
    // The point of the loop: a new reason code cannot ship without copy. The
    // assertions above are on the code and never on the message, which is what
    // makes the message free to be rewritten.
    for (const reason of EXTRACTION_REJECTION_REASONS) {
      const says = REFUSAL_SAYS[reason];
      expect(typeof says, reason).toBe("string");
      expect(says.trim().length, reason).toBeGreaterThan(0);
    }
  });

  it("carries copy for nothing else, so a retired reason leaves no orphan", () => {
    expect(Object.keys(REFUSAL_SAYS).sort()).toEqual([...EXTRACTION_REJECTION_REASONS].sort());
  });

  it("says what the reader can do, and never says what Redline might do later", () => {
    for (const reason of EXTRACTION_REJECTION_REASONS) {
      const says = REFUSAL_SAYS[reason];
      // OCR is excluded on purpose (ADR 0006), and "not yet" would imply a plan
      // that does not exist.
      expect(says.toLowerCase(), reason).not.toContain("not yet");
      expect(says.toLowerCase(), reason).not.toContain("coming soon");
      expect(says.toLowerCase(), reason).not.toContain("sorry");
      expect(says.toLowerCase(), reason).not.toContain("error");
      // `CONTEXT.md` is binding: document, never file or upload.
      expect(says.toLowerCase(), reason).not.toMatch(/\bfiles?\b/u);
      expect(says.toLowerCase(), reason).not.toMatch(/\buploads?\b/u);
    }
  });
});

// ── completeness comes out the way it does for pasted text ────────────────────

describe("a PDF gets its completeness reading from the same assessor", () => {
  it("reads the same text the same way whether it was pasted or came off a PDF", async () => {
    const fromPdf = await documentFrom("text-layer-offer-letter.pdf");

    const pasted = await extract({ kind: "pasted-text", text: fromPdf.text });
    if (pasted.outcome !== "extracted") throw new Error("the text did not extract");

    // The three signals that read the text are the same three, with the same
    // findings, because there is one assessor and the PDF path calls it.
    const textSignals = fromPdf.completeness.signals.filter(
      (signal) => signal.code !== "pages-without-text",
    );
    expect(textSignals).toEqual(pasted.document.completeness.signals);
    expect(fromPdf.completeness.level).toBe(pasted.document.completeness.level);
    expect(fromPdf.completeness.level).toBe("whole");
  });

  it("weighs the pages as well, because a PDF has pages and a paste does not", async () => {
    const fromPdf = await documentFrom("text-layer-offer-letter.pdf");
    const pasted = await extract({ kind: "pasted-text", text: "x" });
    if (pasted.outcome !== "extracted") throw new Error("the text did not extract");

    expect(fromPdf.completeness.signals.map((signal) => signal.code)).toEqual([
      "ends-mid-sentence",
      "no-closing-block",
      "implausibly-short",
      "pages-without-text",
    ]);
    expect(pasted.document.completeness.signals.map((signal) => signal.code)).toEqual([
      "ends-mid-sentence",
      "no-closing-block",
      "implausibly-short",
    ]);
  });

  it("says so when a page of a typed document gave up no text", async () => {
    // The case that is neither a scan nor a clean text layer: a typed first page
    // and a photographed second one. There is text, so it is read, and the page
    // Redline could not read is reported rather than passed over. This is the cut a
    // reader cannot see, because the text that came back reads as continuous prose.
    const document = await documentFrom("one-page-without-text.pdf");

    expect(document.text).toBe(PAGE_ONE.join("\n"));
    expect(firedCodes(document)).toContain("pages-without-text");
    expect(document.completeness.level).not.toBe("whole");
  });

  it("stays quiet about pages when every page of the PDF held text", async () => {
    const document = await documentFrom("text-layer-offer-letter.pdf");
    expect(firedCodes(document)).toEqual([]);
  });
});

// ── the path pasted text takes is untouched ───────────────────────────────────

describe("pasted text still behaves the way it did before PDFs existed", () => {
  it("still reports exactly the three signals that read text", async () => {
    const pasted = await extract({ kind: "pasted-text", text: "A document of some length." });
    if (pasted.outcome !== "extracted") throw new Error("the text did not extract");

    expect(pasted.document.sourceKind).toBe("pasted");
    expect(pasted.document.completeness.signals).toHaveLength(3);
  });

  it("still refuses an empty box with the reason it always did", async () => {
    expect(await extract({ kind: "pasted-text", text: "   \n  " })).toEqual({
      outcome: "rejected",
      reason: "nothing-to-read",
    });
  });
});

describe("the deterministic suite", () => {
  it("made no network call reading any of these documents", () => {
    expect(fetchAttempts).toBe(0);
  });
});
