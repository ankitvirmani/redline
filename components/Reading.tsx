/**
 * A document read back, with what it costs beside it.
 *
 * Everything a reader is shown about one document: the completeness reading, the
 * summary, the document itself with its flagged sentences marked, the flags in the
 * order ranking puts them in, and the question box anchored where the document ends.
 *
 * It is one component because there is one reading. A document pasted a second ago
 * and a document reopened from the library are the same thing on the screen, and a
 * second renderer for the second case would be a second place for the product's rule
 * to stop being true. The library screen hands over a stored analysis whose every
 * source sentence was located in the stored text again before it got here.
 *
 * Ranking runs here rather than at either caller, and it runs in the browser: it
 * calls nothing and needs no key, so the order is decided from the flags alone. It is
 * also where the reader's red lines will be applied, which is ticket 12's.
 *
 * The questions live in this component's state and nowhere else: no storage, no
 * cookie. A new document gets a new instance, because an answer about one document
 * means nothing under another.
 */

"use client";

import { useId, useMemo, useRef, useState, type ReactNode } from "react";

import CleanDocument from "@/components/CleanDocument";
import CompletenessReading from "@/components/CompletenessReading";
import DocumentReading from "@/components/DocumentReading";
import DocumentSummary from "@/components/DocumentSummary";
import FlagList from "@/components/FlagList";
import QuestionBox from "@/components/QuestionBox";
import type { Exchange } from "@/components/question-view";
import StandingStatement from "@/components/StandingStatement";
import type { DocumentAnalysis } from "@/src/analysis";
import { countInWords, formatCharacterCount } from "@/src/domain/text";
import type { ExtractedDocument } from "@/src/extraction";
import type { QuestionReading } from "@/src/qa";
import { rank } from "@/src/ranking";

import "./reading.css";

/**
 * Asks the route one question about the open document. Anything that comes back in a
 * shape this does not recognise is treated as the model being unavailable, never as a
 * refusal: a refusal says something true about the reader's document, and saying it on
 * the strength of a reply nobody could read would be a claim about the thing they are
 * about to sign.
 */
async function askAQuestion(text: string, question: string): Promise<QuestionReading> {
  try {
    const response = await fetch("/api/ask", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, question }),
    });
    const reading = (await response.json()) as QuestionReading;
    if (
      reading.outcome === "answered" ||
      reading.outcome === "refused" ||
      reading.outcome === "not-asked" ||
      reading.outcome === "failed"
    ) {
      return reading;
    }
    return { outcome: "failed", reason: "model-unavailable" };
  } catch {
    return { outcome: "failed", reason: "model-unavailable" };
  }
}

/** What one reading looks like as an exchange on the screen. */
function stateOf(reading: QuestionReading): Exchange["state"] {
  switch (reading.outcome) {
    case "answered":
      return { kind: "answered", answer: reading.answer };
    case "refused":
      return { kind: "refused" };
    // A question with nothing in it never reaches the route, because the question box
    // checks it with the seam's own function first. If one arrives here anyway, it is
    // something going wrong rather than the document being silent.
    case "not-asked":
      return { kind: "failed", reason: "model-response-rejected" };
    case "failed":
      return { kind: "failed", reason: reading.reason };
  }
}

function flagCount(count: number): string {
  return count === 1
    ? "One flag, with the sentence it came from."
    : `${countInWords(count)} flags, each with the sentence it came from.`;
}

export default function Reading({
  document: read,
  analysis,
  waiting = false,
  aside,
}: {
  document: ExtractedDocument;
  /** The reading, or null while it is on its way or after it did not arrive. */
  analysis: DocumentAnalysis | null;
  /** Whether a reading is still coming, so the summary can say so. */
  waiting?: boolean;
  /** What the screen wants beside the document: the action that keeps it, usually. */
  aside?: ReactNode;
}) {
  const docHeadingId = useId();
  const flagsHeadingId = useId();
  const hintId = useId();
  const base = useId();
  // One number per question asked about this document, so an exchange keeps its
  // identity while its answer arrives and React does not rebuild the list around it.
  const asked = useRef(1);

  const [selected, setSelected] = useState<string | null>(null);
  const [exchanges, setExchanges] = useState<readonly Exchange[]>([]);

  // The order the reader reads the flags in, and whether this is a clean document.
  // Red lines are ticket 12's and there are none to give the seam yet, which it takes
  // as the reader having set none. The document is marked from the same ordered list,
  // so the ink on a bar is the ink its sentence lights up in.
  //
  // The clean verdict comes back from the seam and is not worked out here. The screen
  // hands over the clause types analysis says it checked and reads the answer back, so
  // the names a clean document shows are the ones analysis looked for rather than a
  // list this file keeps.
  const reading = useMemo(() => {
    if (analysis === null) return null;
    const ranking = rank({
      flags: analysis.flags,
      checkedClauseTypes: analysis.checkedClauseTypes,
    });
    return {
      ranked: ranking.flags,
      ordered: ranking.flags.map(({ flag }) => flag),
      clean: ranking.cleanDocument,
    };
  }, [analysis]);
  const rankedFlags = reading?.ranked ?? [];
  const orderedFlags = reading?.ordered ?? [];
  const clean = reading?.clean ?? null;

  async function onAsk(question: string) {
    const id = `${asked.current++}`;
    setExchanges((before) => [...before, { id, question, state: { kind: "asking" } }]);

    const answer = await askAQuestion(read.text, question);
    setExchanges((before) =>
      before.map((exchange) =>
        exchange.id === id ? { ...exchange, state: stateOf(answer) } : exchange,
      ),
    );
  }

  return (
    <>
      <section className="read" aria-labelledby={docHeadingId}>
        <div className="read__head">
          <h2 className="read__label" id={docHeadingId}>Your document</h2>
          <p className="read__count">{formatCharacterCount(read.characterCount)}</p>
        </div>

        {aside ? <div className="read__aside">{aside}</div> : null}

        <CompletenessReading assessment={read.completeness} />

        {/* The summary comes before the flags here as well as on the screen, so a
            reader meets what the document is before they meet what it costs them.
            A reading that failed shows its own line on the screen above and no
            summary slot, because there is no summary coming. */}
        {analysis ? (
          <DocumentSummary state={{ kind: "read", summary: analysis.summary }} />
        ) : waiting ? (
          <DocumentSummary state={{ kind: "reading" }} />
        ) : null}

        {analysis && analysis.flags.length > 0 ? (
          <p className="read__how" id={hintId}>
            The underlined sentences are the ones a flag came from. Choose an
            underlined sentence to go to its flag. Choose a flag to mark its
            sentence here.
          </p>
        ) : null}

        <div className="stage">
          <div className="stage__doc">
            <DocumentReading
              text={read.text}
              flags={orderedFlags}
              selected={selected}
              onSelect={setSelected}
              base={base}
              hintId={hintId}
            />
          </div>

          {analysis ? (
            <section className="stage__flags" aria-labelledby={flagsHeadingId}>
              <h2 className="stage__h" id={flagsHeadingId}>
                {clean ? "No clause met the bar" : "What signing costs you"}
              </h2>
              {clean ? (
                // The clean document takes the flag list's place in this column,
                // at the same weight, rather than leaving the column empty.
                //
                // The standing statement is rendered here because the flag list is
                // not: every analysis carries it once (`PRODUCT.md`, Brand
                // Commitments), the flag list carries it for a document with flags,
                // and these two states never appear together.
                <>
                  <StandingStatement />
                  <CleanDocument reading={clean} headingId={flagsHeadingId} />
                </>
              ) : (
                <>
                  {analysis.flags.length > 0 ? (
                    <p className="stage__count">{flagCount(analysis.flags.length)}</p>
                  ) : null}
                  <FlagList
                    flags={rankedFlags}
                    selected={selected}
                    onSelect={setSelected}
                    base={base}
                  />
                </>
              )}
            </section>
          ) : null}
        </div>
      </section>

      {/* Anchored where the document ends, in the DOM as well as on the screen, so a
          reader arriving by keyboard meets the document and its flags before the box
          that asks about them. It is here as soon as there is a document to ask
          about: a reading that failed still leaves the reader holding their text, and
          a question about it is still answerable. */}
      <QuestionBox exchanges={exchanges} onAsk={(question) => void onAsk(question)} />
    </>
  );
}
