/**
 * The action that keeps a document in the reader's library.
 *
 * A document is kept because the reader pressed this, and not otherwise. Redline
 * holding a copy of a contract by default is not a thing to decide on someone's
 * behalf, and the paste box says as much before they paste.
 *
 * What is sent is the extracted text, the completeness reading and the analysis.
 * Never a file: the browser parses a PDF and only the text it read comes out of it,
 * so there is nothing else here to send (`CLAUDE.md`).
 *
 * It imports no Supabase client. The route it posts to reads the session from the
 * cookie, which is what lets the whole reading surface stay free of one.
 */

"use client";

import { useRef, useState } from "react";

import type { AccountState } from "@/src/account/state";
import type { DocumentAnalysis } from "@/src/analysis";
import type { ExtractedDocument } from "@/src/extraction";

import "./keep-in-library.css";

/** What has happened to this document so far. */
type Kept =
  | { readonly kind: "not-yet" }
  | { readonly kind: "keeping" }
  | { readonly kind: "kept" }
  | { readonly kind: "not-kept" };

const NOT_KEPT_SAYS =
  "Redline could not put this in your library. Your document is still on the screen, so try again.";

export default function KeepInLibrary({
  document: read,
  analysis,
  account,
}: {
  document: ExtractedDocument;
  analysis: DocumentAnalysis;
  account: AccountState | null;
}) {
  const [kept, setKept] = useState<Kept>({ kind: "not-yet" });
  // Whether a request is already on its way. A ref rather than the state above,
  // because two presses in the same tick both read the same state and would both
  // post, and a reader who double-clicked would find the document twice in their
  // library. There is no disabled button here: DESIGN.md records that a disabled
  // state is not in this build and is not to be invented in passing, so the state is
  // carried by the label and by aria-busy, as every other state in this product is
  // carried by words.
  const keeping = useRef(false);

  // Nothing to offer yet, or nothing to offer at all. A build with no project has no
  // library to put a document in, and the rail already says so; repeating it here
  // would put the same sentence twice on a screen about someone's contract.
  if (account === null || account.kind === "no-project") return null;

  if (account.kind === "signed-out") {
    return (
      <p className="keep__say">
        Sign in and Redline can keep this document, so you can come back to this
        reading. It keeps the text it read and never the file.{" "}
        <a className="keep__link" href="/sign-in">Sign in</a>
      </p>
    );
  }

  async function keep() {
    if (keeping.current) return;
    keeping.current = true;
    setKept({ kind: "keeping" });
    try {
      const response = await fetch("/api/library", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: read.text,
          characterCount: read.characterCount,
          sourceKind: read.sourceKind,
          completeness: read.completeness,
          analysis,
        }),
      });
      const answer = (await response.json()) as { readonly outcome?: string };
      setKept({ kind: answer.outcome === "kept" ? "kept" : "not-kept" });
    } catch {
      setKept({ kind: "not-kept" });
    } finally {
      keeping.current = false;
    }
  }

  if (kept.kind === "kept") {
    return (
      <p className="said said--done">
        <span>
          This document is in your library.{" "}
          <a className="keep__link" href="/library">Open your library</a>
        </span>
      </p>
    );
  }

  return (
    <div className="keep">
      <button
        className="btn btn--primary keep__btn"
        type="button"
        onClick={() => void keep()}
        aria-busy={kept.kind === "keeping"}
      >
        <span>{kept.kind === "keeping" ? "Keeping it" : "Keep this document"}</span>
      </button>
      {kept.kind === "not-kept" ? (
        <p className="said">
          <span>{NOT_KEPT_SAYS}</span>
        </p>
      ) : (
        <p className="keep__say">
          Redline keeps the text it read and this reading of it. It never keeps the
          file you started with.
        </p>
      )}
    </div>
  );
}
