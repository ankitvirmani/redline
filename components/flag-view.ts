/**
 * What the flag list and the document have to agree on.
 *
 * A flag and its source sentence are the same thing in two places, so the ink, the
 * ids and the marking up of the text are decided once here and read by both
 * components. If they disagreed, a reader would select a magenta bar and watch a
 * cyan sentence light up.
 */

import type { Flag } from "@/src/analysis";

/**
 * The four inks, in the order they are handed out.
 *
 * Colour identifies a flag and never ranks it (DESIGN.md, The Identity-Not-Severity
 * Rule). Severity is carried by the word on the bar. There are four inks and a
 * document can hold more than four flags, so the inks repeat; the code chip is what
 * makes a flag unique, and recolouring every bar at random would leave the reading
 * intact, which is the audit that rule asks for.
 */
export const FLAG_INKS = ["magenta", "cyan", "yellow", "green"] as const;

export type FlagInk = (typeof FLAG_INKS)[number];

export function inkFor(position: number): FlagInk {
  return FLAG_INKS[position % FLAG_INKS.length] ?? "magenta";
}

/**
 * The ids that bind a flag to its sentence, both ways, and the ids that name the
 * blocks inside a flag's body.
 *
 * `external` and `exit` are here rather than generated in the component because they
 * label two regions a screen reader has to be able to tell apart from the consequence
 * and from each other: the fact from outside the document, and the way out the document
 * grants. Four related pieces of text in one flag, each announced as what it is.
 */
export function flagIds(base: string, code: string) {
  return {
    flag: `${base}-flag-${code}`,
    bar: `${base}-bar-${code}`,
    heading: `${base}-heading-${code}`,
    sentence: `${base}-sentence-${code}`,
    external: `${base}-external-${code}`,
    exit: `${base}-exit-${code}`,
  };
}

/** A run of the document: plain, or the source sentence of one flag. */
export type DocumentSegment =
  | { readonly kind: "plain"; readonly text: string }
  | { readonly kind: "marked"; readonly text: string; readonly flag: Flag; readonly position: number };

/**
 * The document text, cut into the runs the reading field renders.
 *
 * Marks are laid down in the order they appear in the text, not in the order the
 * flags arrived, because the document reads front to back. Where two flags cite
 * overlapping text only the first can be marked; the second still shows its
 * sentence on its own flag, which is what the rule requires, and a mark that
 * straddled another would leave the reader unable to tell which sentence was whose.
 */
export function documentSegments(text: string, flags: readonly Flag[]): readonly DocumentSegment[] {
  const marks = flags
    .map((flag, position) => ({ flag, position }))
    .sort((left, right) => left.flag.sourceSentence.at.start - right.flag.sourceSentence.at.start);

  const segments: DocumentSegment[] = [];
  let at = 0;

  for (const { flag, position } of marks) {
    const { start, end } = flag.sourceSentence.at;
    if (start < at) continue;
    if (start > at) segments.push({ kind: "plain", text: text.slice(at, start) });
    segments.push({ kind: "marked", text: text.slice(start, end), flag, position });
    at = end;
  }

  if (at < text.length) segments.push({ kind: "plain", text: text.slice(at) });
  return segments;
}
