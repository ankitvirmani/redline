"use client";

import { SEVERITY_BAND_READING, clauseTypeLabel } from "@/src/domain/clause-types";
import { timesInWords } from "@/src/domain/text";
import type { RankedFlag } from "@/src/ranking";

import RedLineMark from "./RedLineMark";
import StandingStatement from "./StandingStatement";
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
 *
 * A flag's body holds four related pieces of text and they are four different kinds of
 * claim, so they are kept apart in the markup as well as on the screen (ADR 0007):
 *
 * 1. The consequence, drawn from the clause's own words. It leads.
 * 2. The source sentence it is bound to, quoted verbatim, which is the thing the reader
 *    can hold against their own document.
 * 3. External context, where the curated store has a fact for this clause type. Its own
 *    region, an inset cool-grey block with no border (DESIGN.md, Cards / Containers),
 *    named in words as not coming from the document and carrying its own source. Most
 *    flags have none, and a flag without one is complete rather than short of something.
 * 4. The way out, where the document itself grants one, with the sentence that grants
 *    it. It takes the tab-bar motif, the small ink tab that says this line belongs to
 *    the clause above it.
 *
 * The order is the ADR's and not a layout preference: what the document says leads, and
 * anything from outside it sits beneath. Each block is a real region with a real
 * heading, so a screen reader says which is which rather than reading four paragraphs
 * in a row.
 *
 * A flag that hit one of the reader's red lines carries a fifth thing, above those
 * four: the mark saying which red line, in the words the reader wrote it in. It is not
 * a severity signal and does not restyle anything that is: red lines change what the
 * reader sees first and nothing else (ADR 0008), so the mark explains the flag's place
 * in the list and says nothing about what the clause costs.
 *
 * The standing statement sits above the first flag, once for the whole analysis. See
 * `StandingStatement.tsx` for why there and not on every flag.
 *
 * There is no empty state here. A document where no flag met the bar is a clean
 * document, which is a state of its own with the list of what was checked on it
 * (ADR 0004), and `components/CleanDocument.tsx` renders it in this column instead.
 * An empty list rendered with nothing in it is the failure that state exists to
 * prevent.
 */
export default function FlagList({
  flags,
  selected,
  onSelect,
  base,
}: {
  flags: readonly RankedFlag[];
  selected: string | null;
  onSelect: (code: string | null) => void;
  base: string;
}) {
  return (
    <>
      <StandingStatement />

      <ol className="flags">
        {flags.map(({ rank, flag, matchedRedLines }, position) => {
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
                  {/* The mark, where this flag hit one of the reader's red lines. It
                      leads the body because it is why the flag is where it is, and it
                      is deliberately quieter than the severity word on the bar: a flag
                      that hits a red line is the same clause read sooner, not a worse
                      one. See `RedLineMark.tsx`. */}
                  <RedLineMark redLines={matchedRedLines} headingId={ids.named} />

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

                  {flag.consequence.externalContext === null ? null : (
                    <aside className="flag__ext" aria-labelledby={ids.external}>
                      <h4 className="flag__k" id={ids.external}>External context</h4>
                      <p className="flag__extfact">{flag.consequence.externalContext.fact}</p>
                      <p className="flag__extsrc">
                        Your document does not say this. It comes from{" "}
                        <a
                          className="flag__extlink"
                          href={flag.consequence.externalContext.source.url}
                          target="_blank"
                          rel="noreferrer"
                        >
                          {flag.consequence.externalContext.source.title}
                          <span className="flag__away"> Opens in a new tab.</span>
                        </a>
                        .
                      </p>
                    </aside>
                  )}

                  {flag.exit === null ? null : (
                    <section className="flag__exit" aria-labelledby={ids.exit}>
                      <h4 className="flag__k" id={ids.exit}>The way out this document gives you</h4>
                      <p className="flag__exitsay">{flag.exit.text}</p>
                      <figure className="flag__src flag__src--exit">
                        <figcaption className="flag__k">The sentence that grants it</figcaption>
                        <blockquote className="flag__quote">
                          <p>{flag.exit.sourceSentence.text}</p>
                        </blockquote>
                      </figure>
                    </section>
                  )}

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
    </>
  );
}
