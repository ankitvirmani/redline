/**
 * The mark on a flag that hit one of the reader's red lines.
 *
 * It says one thing: this is a kind of clause you named, in the words you named it in.
 * "You named this" is the whole value of a red line, and a generic badge would not
 * deliver it, so the reader's own sentence is what the mark shows.
 *
 * What it is careful not to be:
 *
 * - **Not a severity signal.** Severity is the word on the bar and the flag's place in
 *   the list, and the Identity-Not-Severity Rule already forbids colour from carrying
 *   it. This mark takes no ink of its own: it is the tab-bar motif, a label-register
 *   key and a line of the reader's text, sitting inside the flag's body under the bar.
 *   It does not restyle the bar, does not touch the severity word, and is quieter than
 *   it on purpose. A flag that hits a red line is not a worse clause than it was; it is
 *   the same clause, read sooner.
 * - **Not a count and not a verdict.** It never says how many red lines the document
 *   hit, and there is nowhere in it for a number. Where a flag hit more than one, they
 *   are listed as sentences the reader wrote, not counted (ADR 0008).
 *
 * This is the fourth signal on a flag that already carries three, and how a reader is
 * meant to weigh severity, confidence, completeness and this one is open in
 * `PRODUCT.md`. Nothing here pretends to have settled it: the mark is one small block
 * in its own words, in the register the other subordinate blocks in a flag's body use,
 * and it leaves the other three exactly as they were.
 */

import type { RedLine } from "@/src/domain/red-lines";

import "./red-line-mark.css";

export const NAMED_KEY = "One you named";

export default function RedLineMark({
  redLines,
  headingId,
}: {
  /** The red lines this flag hit. Rendered only when there is at least one. */
  redLines: readonly RedLine[];
  headingId: string;
}) {
  if (redLines.length === 0) return null;

  return (
    <section className="named" aria-labelledby={headingId}>
      <h4 className="named__k" id={headingId}>{NAMED_KEY}</h4>
      <p className="named__say">
        You named this kind of clause, so it is at the top of your list:
      </p>
      <ul className="named__list">
        {redLines.map((redLine) => (
          <li className="named__one" key={redLine.id}>{redLine.text}</li>
        ))}
      </ul>
    </section>
  );
}
