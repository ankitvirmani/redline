/**
 * How the summary is broken up for the screen.
 *
 * The model answers with one string. Where it leaves a blank line, the reader gets a
 * paragraph break; where it puts a single line break, that becomes a space, because a
 * hard wrap the model happened to write is not a paragraph. No word is changed,
 * dropped or reordered: the whole summary reaches the screen in the order it came
 * back, or this would be a second place the product edits prose.
 *
 * Not a component, so that what a reader ends up seeing can be tested without a
 * browser. `flag-view.ts` is next door for the same reason.
 */

/** The summary as paragraphs, in order. */
export function summaryParagraphs(text: string): readonly string[] {
  return text
    .split(/\n{2,}/u)
    .map((paragraph) => paragraph.replace(/\s*\n\s*/gu, " ").trim())
    .filter((paragraph) => paragraph.length > 0);
}
