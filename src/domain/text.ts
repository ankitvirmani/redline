/**
 * Reading a pasted document back, unchanged.
 *
 * Everything downstream of this file compares a model's spans against the
 * document text character for character (ADR 0001), so nothing here is allowed
 * to touch that text. No trim, no whitespace collapse, no smart-quote or
 * ligature normalisation, no line-ending rewrite. The only thing measured is
 * the length, and the only thing decided is whether the reader pasted anything
 * at all.
 */

/** A document the reader pasted, held exactly as they pasted it. */
export type PastedDocument = {
  /** The pasted text, byte for byte as it arrived. Never normalised. */
  readonly text: string;
  /** Unicode code points in `text`. See `countCharacters`. */
  readonly characterCount: number;
};

/** What came back from a submit: either a document, or nothing to read. */
export type ReadBack =
  | { readonly kind: "nothing-pasted" }
  | { readonly kind: "document"; readonly document: PastedDocument };

/**
 * Counts the characters a reader can see, meaning Unicode code points, not
 * UTF-16 code units. `text.length` reports code units, so an astral character
 * such as an emoji or a mathematical letter counts twice under it. A reader
 * looking at a count wants the number of characters in front of them.
 *
 * A code point is still not a grapheme: a flag emoji or an accent written as a
 * combining mark counts as more than one. Nothing in this build depends on
 * that distinction yet.
 */
export function countCharacters(text: string): number {
  return Array.from(text).length;
}

/**
 * The submit path. Takes whatever sits in the paste box and returns either the
 * document, unchanged, with its count, or the fact that there was nothing to
 * read back.
 *
 * Text that is only whitespace counts as nothing pasted. Whitespace inside a
 * document, including the trailing kind, is part of the document and survives.
 */
export function readBackPastedText(pasted: string): ReadBack {
  if (pasted.trim().length === 0) return { kind: "nothing-pasted" };
  return {
    kind: "document",
    document: { text: pasted, characterCount: countCharacters(pasted) },
  };
}

/**
 * The count as the reader sees it: grouped in thousands, with the word.
 * Grouped by hand rather than through `Intl`, so the string is the same on the
 * server and in the browser and React does not report a hydration mismatch.
 */
export function formatCharacterCount(count: number): string {
  const grouped = String(count).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${grouped} ${count === 1 ? "character" : "characters"}`;
}
