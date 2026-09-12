"use client";

// The paste box and the reading it produces. This lives at the root until ticket 14
// gives the root to the landing page and moves this surface to /analyse.
//
// Pasted text goes through the extraction seam, which hands back the text untouched,
// and then to the analysis route, which is the only place a model is called, because
// the key must never reach this browser. What comes back is flags that have already
// been checked against the document: every one of them can show the sentence it was
// drawn from, because a flag that could not never left the seam. It also comes back
// with a summary of what the document is and what accepting it commits the reader to,
// which the seam has already held to describing the document rather than judging it.
//
// Those flags arrive unordered and go through the ranking seam here, which calls
// nothing and needs no key, so the order is decided in the browser from the flags
// alone. Ranking is where the reader's red lines will be applied too, which is the
// other reason it runs here rather than in the route: the route has no reader.

import { useId, useMemo, useRef, useState, type FormEvent } from "react";

import CleanDocument from "@/components/CleanDocument";
import CompletenessReading from "@/components/CompletenessReading";
import DocumentReading from "@/components/DocumentReading";
import DocumentSummary from "@/components/DocumentSummary";
import FlagList from "@/components/FlagList";
import type { AnalysisFailureReason, DocumentAnalysis } from "@/src/analysis";
import { countInWords, formatCharacterCount } from "@/src/domain/text";
import { extract, type ExtractedDocument } from "@/src/extraction";
import { rank } from "@/src/ranking";
import "./analyse.css";

/** What the screen is showing. */
type Screen =
  | { readonly kind: "waiting" }
  | { readonly kind: "nothing-pasted" }
  | { readonly kind: "reading"; readonly document: ExtractedDocument }
  | {
      readonly kind: "read";
      readonly document: ExtractedDocument;
      readonly analysis: DocumentAnalysis;
    }
  | {
      readonly kind: "failed";
      readonly document: ExtractedDocument;
      readonly reason: AnalysisFailureReason;
    };

/** What Redline says when a reading could not happen. Each one is a designed state. */
const FAILURE_SAYS: Readonly<Record<AnalysisFailureReason, string>> = {
  "model-not-configured":
    "Redline has no model set up to read with, so it has not read your document. What you pasted is still in the box above.",
  "model-unavailable":
    "The reading did not come back. Redline kept nothing, so ask again.",
  "model-response-rejected":
    "What came back did not hold up, and Redline will not show you a flag it cannot stand behind. Ask again.",
};

type AnalysisAnswer =
  | { readonly outcome: "analysed"; readonly analysis: DocumentAnalysis }
  | { readonly outcome: "failed"; readonly reason: AnalysisFailureReason };

/**
 * Asks the route to read the document. Anything that comes back in a shape this does
 * not recognise is treated as the model being unavailable, because the one thing that
 * must not happen is showing a reader something unchecked.
 */
async function askForAnalysis(text: string): Promise<AnalysisAnswer> {
  try {
    const response = await fetch("/api/analyse", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    const answer = (await response.json()) as AnalysisAnswer;
    if (answer.outcome === "analysed" || answer.outcome === "failed") return answer;
    return { outcome: "failed", reason: "model-unavailable" };
  } catch {
    return { outcome: "failed", reason: "model-unavailable" };
  }
}

function flagCount(count: number): string {
  return count === 1
    ? "One flag, with the sentence it came from."
    : `${countInWords(count)} flags, each with the sentence it came from.`;
}

export default function PastePage() {
  const fieldId = useId();
  const noteId = useId();
  const docHeadingId = useId();
  const flagsHeadingId = useId();
  const hintId = useId();
  const base = useId();
  const field = useRef<HTMLTextAreaElement>(null);

  // The pasted text lives here and nowhere else: no localStorage, no
  // sessionStorage, no cookie. It is sent to the analysis route and the route keeps
  // nothing. Reload and it is gone.
  const [pasted, setPasted] = useState("");
  const [screen, setScreen] = useState<Screen>({ kind: "waiting" });
  const [selected, setSelected] = useState<string | null>(null);

  const openDocument = screen.kind === "waiting" || screen.kind === "nothing-pasted" ? null : screen.document;
  const analysis = screen.kind === "read" ? screen.analysis : null;

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

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSelected(null);

    const extraction = await extract({ kind: "pasted-text", text: pasted });
    if (extraction.outcome === "rejected") {
      setScreen({ kind: "nothing-pasted" });
      field.current?.focus();
      return;
    }

    const document = extraction.document;
    setScreen({ kind: "reading", document });

    const answer = await askForAnalysis(document.text);
    setScreen(
      answer.outcome === "analysed"
        ? { kind: "read", document, analysis: answer.analysis }
        : { kind: "failed", document, reason: answer.reason },
    );
  }

  return (
    <>
      <a className="skip" href="#paste">Skip to the paste box</a>

      <header className="mast">
        <p className="mark">
          <span className="mark__box" aria-hidden="true">R</span>
          <span className="mark__word">REDLINE</span>
        </p>
      </header>

      <main>
        <section className="paste" id="paste">
          <h1 className="paste__h">Paste a document</h1>
          <p className="paste__lede">
            Redline reads it back character for character and flags the clauses that
            could cost you. Every flag shows the sentence it came from, so you can hold
            each one against your own document.
          </p>

          <form className="paste__form" onSubmit={(event) => void onSubmit(event)} noValidate>
            <label className="paste__label" htmlFor={fieldId}>Your document</label>
            <textarea
              className="paste__area"
              id={fieldId}
              ref={field}
              rows={12}
              value={pasted}
              onChange={(event) => setPasted(event.target.value)}
              placeholder="Paste the agreement you were asked to accept."
              aria-describedby={noteId}
              spellCheck={false}
            />

            <div className="paste__foot">
              <button className="btn btn--primary" type="submit">
                <span>Read it</span>
                <svg className="btn__arrow" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                  <path
                    d="M4 12h14m0 0-5.5-5.5M18 12l-5.5 5.5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinecap="square"
                  />
                </svg>
              </button>
              <p className="paste__note" id={noteId}>
                Redline saves nothing. Your document goes to the model that reads it
                and comes straight back.
              </p>
            </div>
          </form>

          <p className="said" role="status">
            {screen.kind === "nothing-pasted"
              ? "The box is empty. Paste a document first."
              : screen.kind === "reading"
                ? "Redline is reading your document. Give it a few seconds."
                : screen.kind === "failed"
                  ? FAILURE_SAYS[screen.reason]
                  : ""}
          </p>
        </section>

        <section className="read" aria-labelledby={docHeadingId}>
          <div className="read__head">
            <h2 className="read__label" id={docHeadingId}>Your document</h2>
            {openDocument ? (
              <p className="read__count">{formatCharacterCount(openDocument.characterCount)}</p>
            ) : null}
          </div>

          {openDocument ? (
            <>
              <CompletenessReading assessment={openDocument.completeness} />

              {/* The summary comes before the flags here as well as on the screen, so a
                  reader meets what the document is before they meet what it costs them.
                  A reading that failed shows its own line above and no summary slot,
                  because there is no summary coming. */}
              {analysis ? (
                <DocumentSummary state={{ kind: "read", summary: analysis.summary }} />
              ) : screen.kind === "reading" ? (
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
                    text={openDocument.text}
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
                      <CleanDocument reading={clean} headingId={flagsHeadingId} />
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
            </>
          ) : (
            <p className="read__empty">
              Nothing here yet. Paste a document above and it comes back exactly as you
              left it, with what it costs you beside it.
            </p>
          )}
        </section>
      </main>
    </>
  );
}
