import { clauseTypeLabel } from "@/src/domain/clause-types";
import { countInWords } from "@/src/domain/text";
import type { CleanDocumentReading } from "@/src/ranking";

import "./clean-document.css";

/**
 * The clean document: no flag met the bar, reported with the list of what was checked.
 *
 * This is a designed state and not an absence. It takes the place a flag list would
 * have taken, in the same column, at the same weight, because a reader who finds an
 * empty panel there cannot tell a clean document from a reading that fell over
 * (ADR 0004, `PRODUCT.md` principle 5).
 *
 * The list is the evidence that work happened, so it is a real list of named things
 * and it comes off the ranking seam, which got it from analysis. Nothing here holds
 * its own copy of the seven.
 *
 * What this state refuses, from `DESIGN.md`: no green, which is a fourth identity slot
 * and never means safe; no tick and no icon; no badge and no card; no reassuring
 * colour field. The reading is two words a screen reader reads out, not a shape. What
 * carries it instead is the tab-bar motif, the 2px ink keyline, the label register for
 * the two keys, and the rail list item's small ink marker for each name.
 *
 * It says nothing about whether the document is fine to sign, which is the verdict
 * ADR 0007 rejects and which would arrive through this state first if it arrived at
 * all.
 *
 * No number in the copy is written by hand either. The sentence counts the list it is
 * standing next to, so a shorter list cannot leave the word "seven" on screen beside
 * four names.
 */

/** The kinds of clause, counted off the list rather than from a number typed here. */
function kindsOfClause(count: number): string {
  return count === 1 ? "one kind of clause" : `${countInWords(count)} kinds of clause`;
}

export default function CleanDocument({
  reading,
  headingId,
}: {
  reading: CleanDocumentReading;
  headingId: string;
}) {
  const listLabelId = `${headingId}-checked`;

  return (
    <div className="clean">
      <div className="clean__head">
        <p className="clean__k">Reading</p>
        <p className="clean__v">Clean document</p>
      </div>

      <p className="clean__say">
        Redline looked through your text for the{" "}
        {kindsOfClause(reading.checkedClauseTypes.length)} listed below. Nothing in it
        met the bar for a flag.
      </p>

      <p className="clean__limit">
        Redline does not tell you whether to sign, and a document can cost you in ways
        none of these cover.
      </p>

      <h3 className="clean__sub" id={listLabelId}>
        What Redline checked
      </h3>
      <ul className="clean__list" aria-labelledby={listLabelId}>
        {reading.checkedClauseTypes.map((slug) => (
          <li className="clean__item" key={slug}>
            {clauseTypeLabel(slug)}
          </li>
        ))}
      </ul>
    </div>
  );
}
