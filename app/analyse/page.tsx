"use client";

// The paste box and the reading it produces. It lives at /analyse. Ticket 14 gave the
// root to the landing page and moved this surface here, one click from the landing
// page's primary action and from the mark in its rail.
//
// Two ways a document gets in, and pasting is the primary one, because terms of
// service are web pages and subscription terms arrive in email (ADR 0006). A PDF
// covers the case pasting cannot, which is the offer letter somebody was sent as a
// document of its own. That PDF is opened and parsed in this browser and goes
// nowhere: only the text in it crosses to the server, and only when the reading
// runs. A PDF that is a scan, or that has no text layer at all, is refused with the
// reason in plain words rather than read as a document of nothing.
//
// Either way the text goes through the extraction seam, which hands it back
// untouched, and then to the analysis route, which is the only place a model is
// called, because the key must never reach this browser. What comes back is flags
// that have already been checked against the document: every one of them can show the
// sentence it was drawn from, because a flag that could not never left the seam. It
// also comes back with a summary of what the document is and what accepting it
// commits the reader to, which the seam has already held to describing the document
// rather than judging it.
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

import { useId, useRef, useState, type ChangeEvent, type FormEvent } from "react";

import KeepInLibrary from "@/components/KeepInLibrary";
import Reading from "@/components/Reading";
import { REFUSAL_SAYS } from "@/components/refusal-view";
import Shell from "@/components/Shell";
import { useAccount } from "@/components/use-account";
import { useRedLines } from "@/components/use-red-lines";
import type { AnalysisFailureReason, DocumentAnalysis } from "@/src/analysis";
import {
  extract,
  type ExtractedDocument,
  type ExtractionRejectionReason,
} from "@/src/extraction";
import "../analyse.css";

/** What the screen is showing. */
type Screen =
  | { readonly kind: "waiting" }
  /** There is no document to read, and this is why. Product copy, not an error state. */
  | { readonly kind: "refused"; readonly reason: ExtractionRejectionReason }
  /** A PDF is being read, here, in this browser. */
  | { readonly kind: "opening-pdf" }
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

/** What Redline says while it is getting the text out of a PDF, here, in this browser. */
const OPENING_PDF_SAYS =
  "Redline is reading the PDF in your browser. Nothing has gone anywhere yet.";

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
  const pdfId = useId();
  const pdfNoteId = useId();
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
    screen.kind === "reading" || screen.kind === "read" || screen.kind === "failed"
      ? screen.document
      : null;
  const analysis = screen.kind === "read" ? screen.analysis : null;

  /**
   * The rest of the way, once there is a document: one path, whichever way the text
   * arrived. Ranking, rendering and the question box know only the document.
   */
  async function read(document: ExtractedDocument) {
    setOpened((before) => before + 1);
    setScreen({ kind: "reading", document });

    const answer = await askForAnalysis(document.text);
    setScreen(
      answer.outcome === "analysed"
        ? { kind: "read", document, analysis: answer.analysis }
        : { kind: "failed", document, reason: answer.reason },
    );
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const extraction = await extract({ kind: "pasted-text", text: pasted });
    if (extraction.outcome === "rejected") {
      setScreen({ kind: "refused", reason: extraction.reason });
      field.current?.focus();
      return;
    }

    await read(extraction.document);
  }

  /**
   * A PDF the reader picked. It is read into memory here and parsed here; there is no
   * upload, no route, no temporary file, and nothing keeps it. The control is cleared
   * straight away so that picking the same document a second time is still a change
   * the browser reports, which matters after a refusal.
   */
  async function onPdfPicked(event: ChangeEvent<HTMLInputElement>) {
    const picked = event.target.files?.[0];
    event.target.value = "";
    if (picked === undefined) return;

    setScreen({ kind: "opening-pdf" });

    const extraction = await extract({
      kind: "pdf",
      bytes: new Uint8Array(await picked.arrayBuffer()),
    });
    if (extraction.outcome === "rejected") {
      setScreen({ kind: "refused", reason: extraction.reason });
      return;
    }

    await read(extraction.document);
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

        {/* The other way in. A plain file input, styled to match, rather than a drop
            zone: the browser already gives it a keyboard, a screen reader and the
            operating system's own picker, and none of that is worth rebuilding. It
            starts the reading on its own, because picking a document is not an
            ambiguous thing to have done. */}
        <div className="paste__pdf">
          <label className="paste__label" htmlFor={pdfId}>Or a PDF of it</label>
          <input
            className="paste__file"
            id={pdfId}
            type="file"
            accept="application/pdf,.pdf"
            onChange={(event) => void onPdfPicked(event)}
            aria-describedby={pdfNoteId}
          />
          <p className="paste__note" id={pdfNoteId}>
            Redline opens the PDF in your browser and reads the text out of it. The PDF
            itself never leaves your machine. A photograph of a page has no text in it,
            and Redline will tell you that rather than guess at the words.
          </p>
        </div>

        <p className="said" role="status">
          {screen.kind === "refused"
            ? REFUSAL_SAYS[screen.reason]
            : screen.kind === "opening-pdf"
              ? OPENING_PDF_SAYS
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
