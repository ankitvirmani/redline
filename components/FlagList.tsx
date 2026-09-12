"use client";

import { SEVERITY_BAND_READING, clauseTypeLabel } from "@/src/domain/clause-types";
import { countInWords, timesInWords } from "@/src/domain/text";
import type { RankedFlag } from "@/src/ranking";

import { flagIds, inkFor } from "./flag-view";
import "./flags.css";

/**
 * The flags, each with the sentence it was drawn from.
 *
 * Severity is the word on the bar, never the colour: the ink says which flag this is
 * and nothing else (DESIGN.md, The Identity-Not-Severity Rule). Confidence is a
 * separate signal and is deliberately set as plain small prose rather than as
 * anything a reader could mistake for severity.
 *
 * Nothing is sorted here. The flags arrive ranked from the ranking seam and are
 * rendered in that order, with each one carrying the number the seam gave it. The
 * order is not decoration: colour identifies a flag and never ranks it (DESIGN.md,
 * The Identity-Not-Severity Rule), so the severity word and this order are the whole
 * of how severity reaches the reader.
 *
 * Selecting a flag marks its sentence in the document rather than opening a panel
 * over it, which is the one idea this surface has.
 */
export default function FlagList({
  flags,
  checkedCount,
  selected,
  onSelect,
  base,
}: {
  flags: readonly RankedFlag[];
  checkedCount: number;
  selected: string | null;
  onSelect: (code: string | null) => void;
  base: string;
}) {
  if (flags.length === 0) {
    return (
      <p className="flags__none">
        Redline checked this document for all {countInWords(checkedCount)} kinds of
        clause and found none of them.
      </p>
    );
  }

  return (
    <ol className="flags">
      {flags.map(({ rank, flag }, position) => {
        const ids = flagIds(base, flag.code);
        const isSelected = selected === flag.code;
        const band = SEVERITY_BAND_READING[flag.severity.band];

        return (
          <li className="flags__item" key={flag.code}>
            <article
              className="flag"
              id={ids.flag}
              data-ink={inkFor(position)}
              data-selected={isSelected ? "" : undefined}
              aria-labelledby={ids.heading}
            >
              <h3 className="flag__h" id={ids.heading}>
                <button
                  type="button"
                  className="flag__bar"
                  id={ids.bar}
                  aria-pressed={isSelected}
                  aria-controls={ids.sentence}
                  onClick={() => onSelect(isSelected ? null : flag.code)}
                >
                  <span className="flag__rank">
                    <span className="flag__ranked">Ranked </span>
                    {rank}
                  </span>
                  <span className="flag__code">{flag.code}</span>
                  <span className="flag__sev">{band.word}</span>
                  <span className="flag__type">{clauseTypeLabel(flag.clauseType)}</span>
                </button>
              </h3>

              <div className="flag__body">
                <p className="flag__consequence">{flag.consequence.fromTheDocument}</p>

                <figure className="flag__src">
                  <figcaption className="flag__k">The sentence it came from</figcaption>
                  <blockquote className="flag__quote">
                    <p>{flag.sourceSentence.text}</p>
                  </blockquote>
                </figure>

                {flag.sourceSentence.occurrences > 1 ? (
                  <p className="flag__again">
                    This sentence appears {timesInWords(flag.sourceSentence.occurrences)}{" "}
                    in your document. The mark is on the first one.
                  </p>
                ) : null}

                <p className="flag__conf">
                  <span className="flag__k">Confidence</span>
                  Redline is {Math.round(flag.confidence * 100)}% sure it read this
                  clause for what it is. That is a different question from what the
                  clause costs you.
                </p>
              </div>
            </article>
          </li>
        );
      })}
    </ol>
  );
}
