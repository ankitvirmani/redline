"use client";

import { useId } from "react";

import type { Summary } from "@/src/analysis";

import { summaryParagraphs } from "./summary-view";
import "./document-summary.css";

/**
 * The summary: what the document is, and what accepting it commits the reader to.
 *
 * It sits above the flags, in the DOM as well as on the screen, so a reader arriving
 * by keyboard or with a screen reader meets it before the detail. That is the whole
 * point of it: orientation first, then the clauses.
 *
 * Prose, not a card. Body register at 400, held under 74ch, on the white reading
 * field with a 2px ink keyline down its left edge, which is the tab-bar motif at
 * paragraph scale (DESIGN.md). No flag ink: the summary ranks nothing and identifies
 * nothing, so it borrows no colour from severity.
 *
 * What it says is the model's, checked in `src/analysis/summary.ts` before it gets
 * here. A summary that said whether to sign never reaches this component, because
 * the analysis it belonged to failed.
 */

/** Whether there is a summary yet. Reading is a state a reader sees, not a spinner. */
export type SummaryState =
  | { readonly kind: "reading" }
  | { readonly kind: "read"; readonly summary: Summary };

export default function DocumentSummary({ state }: { state: SummaryState }) {
  const keyId = useId();
  const paragraphs = state.kind === "read" ? summaryParagraphs(state.summary.text) : [];

  return (
    <section className="sum" aria-labelledby={keyId}>
      <h2 className="sum__k" id={keyId}>
        What you would be agreeing to
      </h2>

      {state.kind === "reading" ? (
        <p className="sum__waiting">Redline is still reading. The summary shows up here.</p>
      ) : (
        paragraphs.map((paragraph, index) => (
          <p className="sum__say" key={index}>
            {paragraph}
          </p>
        ))
      )}
    </section>
  );
}
