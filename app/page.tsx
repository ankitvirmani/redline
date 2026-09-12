"use client";

// The paste box lives at the root until ticket 14 gives the root to the landing
// page and moves this surface to /analyse.

import { useId, useRef, useState, type FormEvent } from "react";

import { formatCharacterCount, readBackPastedText, type ReadBack } from "@/src/domain/text";
import "./analyse.css";

export default function PastePage() {
  const fieldId = useId();
  const noteId = useId();
  const headingId = useId();
  const field = useRef<HTMLTextAreaElement>(null);

  // The pasted text lives here and nowhere else: no localStorage, no
  // sessionStorage, no cookie, no request, no log line. Reload and it is gone.
  const [pasted, setPasted] = useState("");
  const [readBack, setReadBack] = useState<ReadBack | null>(null);

  const read = readBack?.kind === "document" ? readBack.document : null;

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = readBackPastedText(pasted);
    setReadBack(result);
    if (result.kind === "nothing-pasted") field.current?.focus();
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
            So far this page does one thing. It reads your document back to you
            character for character, and keeps no copy of it anywhere.
          </p>

          <form className="paste__form" onSubmit={onSubmit} noValidate>
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
                <span>Read it back</span>
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
                Your document stays in this browser tab. Closing the tab is the
                end of it.
              </p>
            </div>
          </form>

          <p className="said" role="status">
            {readBack === null
              ? ""
              : readBack.kind === "document"
                ? "Your document is below, exactly as you pasted it."
                : "The box is empty. Paste a document first."}
          </p>
        </section>

        <section className="read" aria-labelledby={headingId}>
          <div className="read__head">
            <h2 className="read__label" id={headingId}>What you pasted</h2>
            {read ? (
              <p className="read__count">{formatCharacterCount(read.characterCount)}</p>
            ) : null}
          </div>

          {read ? (
            <div className="read__doc">{read.text}</div>
          ) : (
            <p className="read__empty">
              Nothing here yet. Paste a document above and it comes back exactly
              as you left it.
            </p>
          )}
        </section>
      </main>
    </>
  );
}
