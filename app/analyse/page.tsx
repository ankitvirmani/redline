"use client";

// The paste box and the reading it produces. It lives at /analyse. Ticket 14 gave the
// root to the landing page and moved this surface here, one click from the landing
// page's primary action and from the mark in its rail.
//
// Pasted text goes through the extraction seam, which hands back the text untouched,
// and then to the analysis route, which is the only place a model is called, because
// the key must never reach this browser. What comes back is flags that have already
// been checked against the document: every one of them can show the sentence it was
// drawn from, because a flag that could not never left the seam. It also comes back
// with a summary of what the document is and what accepting it commits the reader to,
// which the seam has already held to describing the document rather than judging it.
//
// The reading itself is rendered by `components/Reading.tsx`, which is the same
// component the library uses to reopen a document. Ranking happens there, in the
// browser, because it calls nothing and needs no key.
//
// Nothing on this screen imports a Supabase client, and that is the constraint the
// whole surface is built around: the reader is deciding in the minutes before they
// accept and will not stop to make an account, so a document is read whether or not
// this build has a project at all. Whether anyone is signed in comes from a route,
// the same way the analysis does, and it decides one thing only: whether Redline
// offers to keep the document. `tests/signed-out.test.ts` walks the import graph of
// this file to keep it that way.

import { useId, useRef, useState, type FormEvent } from "react";

import KeepInLibrary from "@/components/KeepInLibrary";
import Reading from "@/components/Reading";
import Shell from "@/components/Shell";
import { useAccount } from "@/components/use-account";
import { useRedLines } from "@/components/use-red-lines";
import type { AnalysisFailureReason, DocumentAnalysis } from "@/src/analysis";
import { extract, type ExtractedDocument } from "@/src/extraction";
import "../analyse.css";

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

export default function PastePage() {
  const fieldId = useId();
  const noteId = useId();
  const field = useRef<HTMLTextAreaElement>(null);

  // The pasted text lives here and nowhere else: no localStorage, no
  // sessionStorage, no cookie. It is sent to the analysis route and the route keeps
  // nothing. Reload and it is gone. A document is kept only when the reader asks for
  // it to be, and only then does it leave this browser for anywhere but the model.
  const [pasted, setPasted] = useState("");
  const [screen, setScreen] = useState<Screen>({ kind: "waiting" });
  // One number per document read in this session. It is the reading's key, so a second
  // document gets a new one rather than inheriting the questions asked about the first.
  const [opened, setOpened] = useState(0);

  const account = useAccount();
  // The reader's red lines, which decide what they read first and nothing else. An
  // empty list until the account is known, and an empty list for a reader who has
  // none, which is the same path through ranking (ADR 0008).
  const redLines = useRedLines(account);

  const openDocument =
    screen.kind === "waiting" || screen.kind === "nothing-pasted" ? null : screen.document;
  const analysis = screen.kind === "read" ? screen.analysis : null;

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const extraction = await extract({ kind: "pasted-text", text: pasted });
    if (extraction.outcome === "rejected") {
      setScreen({ kind: "nothing-pasted" });
      field.current?.focus();
      return;
    }

    const document = extraction.document;
    setOpened((before) => before + 1);
    setScreen({ kind: "reading", document });

    const answer = await askForAnalysis(document.text);
    setScreen(
      answer.outcome === "analysed"
        ? { kind: "read", document, analysis: answer.analysis }
        : { kind: "failed", document, reason: answer.reason },
    );
  }

  return (
    <Shell
      place="paste"
      account={account}
      skip={{ href: "#paste", says: "Skip to the paste box" }}
    >
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
            <button className="btn btn--primary btn--lg" type="submit">
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
              Your document goes to the model that reads it and comes straight back.
              Redline keeps nothing unless you ask it to.
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

      {openDocument === null ? (
        <section className="waiting">
          <p className="waiting__k">Your document</p>
          <p className="waiting__say">
            Nothing here yet. Paste a document above and it comes back exactly as you
            left it, with what it costs you beside it.
          </p>
        </section>
      ) : (
        <Reading
          key={opened}
          document={openDocument}
          analysis={analysis}
          redLines={redLines}
          waiting={screen.kind === "reading"}
          aside={
            analysis === null ? null : (
              <KeepInLibrary document={openDocument} analysis={analysis} account={account} />
            )
          }
        />
      )}
    </Shell>
  );
}
