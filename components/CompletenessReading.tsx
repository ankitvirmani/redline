"use client";

import { useId } from "react";

import type {
  CompletenessAssessment,
  CompletenessLevel,
  CompletenessSignalCode,
} from "@/src/extraction";

import "./completeness-reading.css";

/**
 * The completeness reading: how much of a document Redline believes it received.
 *
 * Shown on every analysis, not only on a low one. A reading that turns up only on
 * bad documents teaches a reader nothing on good ones and looks like an error the
 * first time they see it.
 *
 * It informs and it gates nothing. Nothing here suppresses a result, hides a
 * flag or blocks a submission, which is the behaviour ADR 0006 records as a known
 * gap rather than an oversight.
 *
 * Completeness is not a flag, so it carries no flag ink: ink black type, a grey
 * hairline, and the tab-bar motif at two sizes. Severity and completeness must not
 * look like each other. Nothing here depends on colour either, because each signal
 * has its own sentence for the state it is in.
 */

const LEVEL_WORD: Readonly<Record<CompletenessLevel, string>> = {
  whole: "Whole",
  uncertain: "Uncertain",
  partial: "Partial",
};

const LEVEL_SAYS: Readonly<Record<CompletenessLevel, string>> = {
  whole: "Redline read this as a whole document. Nothing in the text says it stops early.",
  uncertain:
    "One check came back the way a cut off document would. Whole documents do that too, so read the list and decide for yourself.",
  partial: "This reads like part of a document. Redline works only from the text it has.",
};

const SIGNAL_SAYS: Readonly<
  Record<CompletenessSignalCode, { readonly fired: string; readonly quiet: string }>
> = {
  "ends-mid-sentence": {
    fired: "The text stops in the middle of a sentence.",
    quiet: "The text ends on a finished sentence.",
  },
  "no-closing-block": {
    fired: "Nothing at the end asks for a signature.",
    quiet: "It ends with a closing or signature block.",
  },
  "implausibly-short": {
    fired: "It is shorter than these agreements usually run.",
    quiet: "It is about as long as these agreements usually run.",
  },
  "pages-without-text": {
    fired: "Redline found no text on one of the PDF's pages.",
    quiet: "Redline found text on every page of the PDF.",
  },
};

export default function CompletenessReading({
  assessment,
}: {
  assessment: CompletenessAssessment;
}) {
  const keyId = useId();
  const subId = useId();

  return (
    <section className="cmpl" aria-labelledby={keyId}>
      <div className="cmpl__head">
        <h2 className="cmpl__k" id={keyId}>
          Completeness
        </h2>
        <p className="cmpl__v">{LEVEL_WORD[assessment.level]}</p>
      </div>

      <p className="cmpl__say">{LEVEL_SAYS[assessment.level]}</p>

      <h3 className="cmpl__sub" id={subId}>
        What Redline looked at
      </h3>
      <ul className="cmpl__list" aria-labelledby={subId}>
        {assessment.signals.map((signal) => (
          <li
            className={signal.fired ? "cmpl__s cmpl__s--fired" : "cmpl__s"}
            key={signal.code}
          >
            <span className="cmpl__mark" aria-hidden="true" />
            <span>
              {signal.fired
                ? SIGNAL_SAYS[signal.code].fired
                : SIGNAL_SAYS[signal.code].quiet}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
