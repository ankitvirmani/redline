import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import {
  extract,
  type CompletenessSignalCode,
  type ExtractedDocument,
} from "@/src/extraction";

/**
 * The extraction seam. No model call, no network, no key: the seam has none, and
 * these tests read the fixture documents from disk and build the rest by hand.
 *
 * Following the convention `tests/text-fidelity.test.ts` set, every assertion
 * here is something a reader would observe: their document coming back with not
 * one character moved, and the completeness reading the screen shows them. The
 * awkward characters are written as escapes so that no editor or formatter can
 * quietly repair the corpus and leave the test passing on text that is no longer
 * awkward.
 */

const CURLY_OPEN = "“";
const CURLY_CLOSE = "”";
const APOSTROPHE = "’";
const NBSP = " ";
const LIGATURE_FI = "ﬁ";
const LIGATURE_FL = "ﬂ";
const EM_DASH = "—";
const ASTRAL = "\u{1D400}"; // MATHEMATICAL BOLD CAPITAL A, outside the BMP

const AWKWARD_DOCUMENT = [
  `${CURLY_OPEN}Facility${CURLY_CLOSE} means the premises the Member${APOSTROPHE}s dues pay for.`,
  `Notice is due within${NBSP}30 days of the renewal date.`,
  `Fees are  adjusted annually${EM_DASH}see the schedule.`,
  `\tIndemni${LIGATURE_FI}cation survives termination.`,
  `Con${LIGATURE_FL}ict of interest applies to both parties.   `,
  `Signed ${ASTRAL} by the Member.`,
].join("\n");

function fixture(name: string): string {
  return readFileSync(fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url)), "utf8");
}

/** A gym membership agreement, whole, ending in a real signature block. */
const ADHESION = fixture("adhesion-contract.txt");

/** A garden plot licence, whole, ending in a signature block worded differently. */
const CLEAN = fixture("clean-document.txt");

/** The adhesion contract cut off part way, the way a reader copying a page cuts one. */
function truncatedTo(share: number): string {
  const characters = Array.from(ADHESION);
  return characters.slice(0, Math.floor(characters.length * share)).join("");
}

/**
 * Terms of service pasted whole from a web page: long, finished, and with no
 * signature block, because nobody signs one. Built to trip that signal alone.
 */
const WEB_TERMS = [
  "PARALLAX TRANSIT: RIDER TERMS",
  "",
  ...Array.from(
    { length: 6 },
    (_unused, index) =>
      `${index + 1}. Section ${index + 1}. These terms apply to every ride you book through the Parallax application, and you accept them when you book. Fares are quoted before you confirm and are charged to the payment method on your account when the ride ends. A ride cancelled more than two minutes after a driver accepts it is charged at the cancellation rate published in the fare table. You may close your account at any time from the account screen, and closing it ends these terms except for amounts already owed.`,
  ),
].join("\n");

/** The same document, given the closing block the web terms have not got. */
const WEB_TERMS_WITH_CLOSING = `${WEB_TERMS}\n\nACCEPTED AND AGREED\n\nSignature:\t_______________________________\tDate: ______________`;

/** Two sentences: what a reader pastes when they meant to paste a page. */
const A_PARAGRAPH =
  "You agree that any dispute will be resolved by binding arbitration. You waive any right to participate in a class action.";

async function extracted(text: string): Promise<ExtractedDocument> {
  const result = await extract({ kind: "pasted-text", text });
  if (result.outcome !== "extracted") {
    throw new Error(`expected a document, got a rejection: ${result.reason}`);
  }
  return result.document;
}

async function reading(text: string): Promise<string> {
  return (await extracted(text)).completeness.level;
}

async function fired(text: string): Promise<readonly CompletenessSignalCode[]> {
  const { completeness } = await extracted(text);
  return completeness.signals.filter((signal) => signal.fired).map((signal) => signal.code);
}

function linesWithTrailingWhitespace(text: string): readonly string[] {
  return text.split("\n").filter((line) => line !== line.replace(/\s+$/u, ""));
}

describe("a document comes back through extraction character for character", () => {
  it("returns the fixture document on disk with nothing moved", async () => {
    const document = await extracted(ADHESION);
    expect(document.text).toBe(ADHESION);
    expect(document.text.split("\n")).toEqual(ADHESION.split("\n"));
    expect(linesWithTrailingWhitespace(document.text)).toEqual(
      linesWithTrailingWhitespace(ADHESION),
    );
  });

  it("keeps curly quotes, a ligature, a non-breaking space, a tab, a double space, trailing whitespace and an astral character", async () => {
    const document = await extracted(AWKWARD_DOCUMENT);
    expect(document.text).toBe(AWKWARD_DOCUMENT);
    for (const character of [
      CURLY_OPEN,
      CURLY_CLOSE,
      APOSTROPHE,
      NBSP,
      LIGATURE_FI,
      LIGATURE_FL,
      EM_DASH,
      ASTRAL,
      "\t",
      "  ",
    ]) {
      expect(document.text).toContain(character);
    }
    expect(linesWithTrailingWhitespace(document.text).length).toBeGreaterThan(0);
  });

  it("leaves the text in the Unicode form it arrived in", async () => {
    // Normalising would expand the ligature and fold the non-breaking space,
    // and every source sentence checked against this text would stop matching.
    const document = await extracted(AWKWARD_DOCUMENT);
    expect(document.text).not.toBe(AWKWARD_DOCUMENT.normalize("NFKC"));
    expect(document.text.normalize("NFKC")).not.toBe(document.text);
  });

  it("says where the text came from and counts the characters a reader can see", async () => {
    const document = await extracted(AWKWARD_DOCUMENT);
    expect(document.sourceKind).toBe("pasted");
    expect(document.characterCount).toBe(Array.from(AWKWARD_DOCUMENT).length);
    expect(document.characterCount).toBeLessThan(AWKWARD_DOCUMENT.length); // the astral pair
  });
});

describe("the awkward edges of what a reader can paste", () => {
  it("keeps a document with no trailing newline exactly as it is", async () => {
    const withoutNewline = `${ADHESION.trimEnd()}`;
    expect(withoutNewline.endsWith("\n")).toBe(false);
    expect((await extracted(withoutNewline)).text).toBe(withoutNewline);
  });

  it("keeps a leading newline rather than tidying the top of the document", async () => {
    const withLeadingNewline = `\n${ADHESION}`;
    expect((await extracted(withLeadingNewline)).text).toBe(withLeadingNewline);
  });

  it("refuses an empty box instead of returning a document of nothing", async () => {
    expect(await extract({ kind: "pasted-text", text: "" })).toEqual({
      outcome: "rejected",
      reason: "nothing-to-read",
    });
  });

  it("refuses a box holding only whitespace, which is an empty box", async () => {
    for (const nothing of [" ", "\n\n", "\t\t", `\t${NBSP} \n `, "   \n   \n"]) {
      expect(await extract({ kind: "pasted-text", text: nothing })).toEqual({
        outcome: "rejected",
        reason: "nothing-to-read",
      });
    }
  });

  it("treats a single visible character as a document, with the reading that earns", async () => {
    const document = await extracted(".");
    expect(document.text).toBe(".");
    expect(document.completeness.level).toBe("partial");
  });
});

describe("the reading a reader sees on a document that was cut off", () => {
  it("reads the whole contract as whole", async () => {
    expect(await reading(ADHESION)).toBe("whole");
  });

  it("reads the same contract cut at 40% differently", async () => {
    const cut = truncatedTo(0.4);
    expect(await reading(cut)).not.toBe(await reading(ADHESION));
    expect(await reading(cut)).toBe("partial");
  });

  it("names what made it think so rather than only giving a verdict", async () => {
    expect(await fired(truncatedTo(0.4))).toEqual(["ends-mid-sentence", "no-closing-block"]);
    expect(await fired(ADHESION)).toEqual([]);
  });

  it("reports every signal it weighed, fired or not", async () => {
    const { completeness } = await extracted(ADHESION);
    expect(completeness.signals.map((signal) => signal.code)).toEqual([
      "ends-mid-sentence",
      "no-closing-block",
      "implausibly-short",
    ]);
    expect(completeness.signals.every((signal) => signal.fired === false)).toBe(true);
  });
});

describe("each structural signal, on a document built to trip it and one built not to", () => {
  it("fires on text that stops part way through a sentence", async () => {
    const cut = truncatedTo(0.4);
    expect(cut.endsWith("Yo")).toBe(true); // mid word, which is mid sentence
    expect(await fired(cut)).toContain("ends-mid-sentence");
  });

  it("stays quiet on a document whose last line is a signature field, not prose", async () => {
    expect(await fired(ADHESION)).not.toContain("ends-mid-sentence");
    expect(await fired(CLEAN)).not.toContain("ends-mid-sentence");
    expect(await fired(WEB_TERMS)).not.toContain("ends-mid-sentence");
  });

  it("fires when nothing at the end of the document asks for a signature", async () => {
    expect(await fired(WEB_TERMS)).toContain("no-closing-block");
  });

  it("stays quiet on both fixture documents, which close in different words", async () => {
    expect(ADHESION).toContain("ACCEPTED AND AGREED");
    expect(CLEAN).not.toContain("ACCEPTED AND AGREED");
    expect(await fired(ADHESION)).not.toContain("no-closing-block");
    expect(await fired(CLEAN)).not.toContain("no-closing-block");
    expect(await fired(WEB_TERMS_WITH_CLOSING)).not.toContain("no-closing-block");
  });

  it("fires on a length no whole document of this kind has", async () => {
    expect(await fired(A_PARAGRAPH)).toContain("implausibly-short");
  });

  it("stays quiet on the shorter fixture document, which is whole at 4,000 characters", async () => {
    expect(Array.from(CLEAN).length).toBeLessThan(Array.from(ADHESION).length);
    expect(await fired(CLEAN)).not.toContain("implausibly-short");
    expect(await fired(ADHESION)).not.toContain("implausibly-short");
    expect(await fired(truncatedTo(0.4))).not.toContain("implausibly-short");
  });

  it("reads a whole document with no signature block as uncertain, not as a fragment", async () => {
    // Terms of service are complete and nobody signs them. One signal on its own
    // is not evidence of a cut, which is why the reading has a middle.
    expect(await fired(WEB_TERMS)).toEqual(["no-closing-block"]);
    expect(await reading(WEB_TERMS)).toBe("uncertain");
  });
});

describe("a low reading blocks nothing and hides nothing", () => {
  it("hands back the whole of a badly cut document rather than a rejection", async () => {
    const cut = truncatedTo(0.1);
    const result = await extract({ kind: "pasted-text", text: cut });
    expect(result.outcome).toBe("extracted");

    const document = await extracted(cut);
    expect(document.completeness.level).toBe("partial");
    expect(document.text).toBe(cut);
    expect(document.characterCount).toBe(Array.from(cut).length);
    expect(document.text).toContain("MERIDIAN ATHLETIC CLUB");
  });

  it("returns a usable document for a paste of two sentences", async () => {
    const document = await extracted(A_PARAGRAPH);
    expect(document.completeness.level).toBe("partial");
    expect(document.text).toBe(A_PARAGRAPH);
    expect(document.sourceKind).toBe("pasted");
  });
});
