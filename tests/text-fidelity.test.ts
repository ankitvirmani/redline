import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import {
  countCharacters,
  formatCharacterCount,
  readBackPastedText,
  type PastedDocument,
} from "@/src/domain/text";

/**
 * The convention these tests set, for every ticket after this one: assert what a
 * reader would observe. Here that is the document coming back with not one
 * character moved, and a count that matches what they can see. Nothing asserts
 * the shape of a function or the contents of a prompt.
 *
 * The awkward characters are written as escapes on purpose, so that no editor,
 * formatter or copy-paste can quietly repair the corpus and leave the test
 * passing on text that is no longer awkward.
 */

const CURLY_OPEN = "“";
const CURLY_CLOSE = "”";
const APOSTROPHE = "’";
const NBSP = " ";
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

const FIXTURE_TEXT = readFileSync(
  fileURLToPath(new URL("./fixtures/adhesion-contract.txt", import.meta.url)),
  "utf8",
);

const FIXTURE_SIDECAR = JSON.parse(
  readFileSync(
    fileURLToPath(new URL("./fixtures/adhesion-contract.json", import.meta.url)),
    "utf8",
  ),
) as {
  plantedClauses: ReadonlyArray<{
    id: string;
    sourceSentence: string;
    exit: { sourceSentence: string } | null;
  }>;
};

/** The document the page would render, or a failure if the page showed nothing. */
function readBack(pasted: string): PastedDocument {
  const result = readBackPastedText(pasted);
  if (result.kind !== "document") {
    throw new Error(`expected a document to read back, got ${result.kind}`);
  }
  return result.document;
}

function linesWithTrailingWhitespace(text: string): readonly string[] {
  return text.split("\n").filter((line) => line !== line.replace(/\s+$/u, ""));
}

describe("the corpus these tests rest on", () => {
  it("still carries every character that makes the test worth running", () => {
    for (const character of [
      CURLY_OPEN,
      CURLY_CLOSE,
      APOSTROPHE,
      NBSP,
      LIGATURE_FI,
      LIGATURE_FL,
      ASTRAL,
      "\t",
      "  ",
    ]) {
      expect(AWKWARD_DOCUMENT).toContain(character);
    }
    expect(linesWithTrailingWhitespace(AWKWARD_DOCUMENT).length).toBeGreaterThan(0);
  });

  it("finds the same characters in the fixture document on disk", () => {
    for (const character of [
      CURLY_OPEN,
      CURLY_CLOSE,
      APOSTROPHE,
      NBSP,
      LIGATURE_FI,
      LIGATURE_FL,
      "\t",
      "  ",
    ]) {
      expect(FIXTURE_TEXT).toContain(character);
    }
    expect(linesWithTrailingWhitespace(FIXTURE_TEXT).length).toBeGreaterThan(0);
    expect(FIXTURE_TEXT).not.toContain("\r");
    expect(FIXTURE_TEXT.startsWith("﻿")).toBe(false);
  });
});

describe("a reader pastes a document and reads it back", () => {
  it("gets curly quotes, ligatures, tabs, runs of spaces and an astral character back untouched", () => {
    expect(readBack(AWKWARD_DOCUMENT).text).toBe(AWKWARD_DOCUMENT);
  });

  it("keeps the whitespace nobody can see", () => {
    const shown = readBack(AWKWARD_DOCUMENT).text;
    expect(linesWithTrailingWhitespace(shown)).toEqual(
      linesWithTrailingWhitespace(AWKWARD_DOCUMENT),
    );
    expect(shown.split("\n")).toEqual(AWKWARD_DOCUMENT.split("\n"));
  });

  it("keeps a leading and trailing blank line rather than tidying the edges", () => {
    const padded = `\n\n  ${AWKWARD_DOCUMENT}  \n\n`;
    expect(readBack(padded).text).toBe(padded);
  });

  it("reads the whole fixture document back character for character", () => {
    expect(readBack(FIXTURE_TEXT).text).toBe(FIXTURE_TEXT);
  });

  it("shows every planted source sentence verbatim in what the reader reads back", () => {
    const shown = readBack(FIXTURE_TEXT).text;
    expect(FIXTURE_SIDECAR.plantedClauses.length).toBeGreaterThan(0);
    for (const clause of FIXTURE_SIDECAR.plantedClauses) {
      expect(shown, `${clause.id} source sentence`).toContain(clause.sourceSentence);
      if (clause.exit) {
        expect(shown, `${clause.id} exit source sentence`).toContain(
          clause.exit.sourceSentence,
        );
      }
    }
  });
});

describe("the count beside the document", () => {
  it("counts characters a reader can see, not UTF-16 code units", () => {
    const withAstral = `a${ASTRAL}b`;
    expect(withAstral.length).toBe(4); // what .length would have reported
    expect(countCharacters(withAstral)).toBe(3);
    expect(readBack(withAstral).characterCount).toBe(3);
  });

  it("counts one astral character as one", () => {
    expect(countCharacters(ASTRAL)).toBe(1);
  });

  it("counts a ligature glyph as the single character it is", () => {
    expect(countCharacters(`Indemni${LIGATURE_FI}cation`)).toBe(14);
    expect(countCharacters("Indemnification")).toBe(15);
  });

  it("counts every character of the awkward document, whitespace included", () => {
    expect(readBack(AWKWARD_DOCUMENT).characterCount).toBe(
      Array.from(AWKWARD_DOCUMENT).length,
    );
  });

  it("counts the fixture document the same way", () => {
    expect(readBack(FIXTURE_TEXT).characterCount).toBe(Array.from(FIXTURE_TEXT).length);
  });

  it("reads as a sentence, with the singular where the singular belongs", () => {
    expect(formatCharacterCount(1)).toBe("1 character");
    expect(formatCharacterCount(2)).toBe("2 characters");
    expect(formatCharacterCount(9713)).toBe("9,713 characters");
    expect(formatCharacterCount(1234567)).toBe("1,234,567 characters");
  });
});

describe("a reader submits nothing", () => {
  it("is told there is nothing to read back rather than shown an empty document", () => {
    for (const nothing of ["", " ", "\n\n", `\t${NBSP} \n `]) {
      expect(readBackPastedText(nothing)).toEqual({ kind: "nothing-pasted" });
    }
  });

  it("treats a single visible character as a document", () => {
    expect(readBackPastedText(".")).toEqual({
      kind: "document",
      document: { text: ".", characterCount: 1 },
    });
  });
});
