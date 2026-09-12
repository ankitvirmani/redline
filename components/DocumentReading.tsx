"use client";

import type { Flag } from "@/src/analysis";

import { documentSegments, flagIds, inkFor } from "./flag-view";
import "./document-reading.css";

/**
 * The reader's document, with the flagged sentences marked in it.
 *
 * The text is rendered character for character, whitespace included, because this is
 * the document they pasted and nothing here is allowed to tidy it. A marked sentence
 * carries the change bar: the underline in its flag's ink, the ink tab down the left
 * edge of every line it wraps onto, and the code chip. At rest the underline sits at
 * a mix into white so the document does not shout; the selected one goes to full
 * saturation.
 *
 * A marked sentence is a button, so it works from the keyboard and reads as something
 * that does something. Selecting it selects the flag and moves focus there, which is
 * the second half of the two-way binding: a flag opens its sentence, and a sentence
 * opens its flag.
 */
export default function DocumentReading({
  text,
  flags,
  selected,
  onSelect,
  base,
  hintId,
}: {
  text: string;
  flags: readonly Flag[];
  selected: string | null;
  onSelect: (code: string) => void;
  base: string;
  hintId?: string;
}) {
  const segments = documentSegments(text, flags);

  return (
    <div className="read__doc">
      {segments.map((segment, index) => {
        if (segment.kind === "plain") return <span key={index}>{segment.text}</span>;

        const ids = flagIds(base, segment.flag.code);
        const isSelected = selected === segment.flag.code;

        return (
          <button
            type="button"
            className="src"
            key={index}
            id={ids.sentence}
            data-ink={inkFor(segment.position)}
            data-code={segment.flag.code}
            data-selected={isSelected ? "" : undefined}
            aria-pressed={isSelected}
            aria-controls={ids.flag}
            aria-describedby={hintId}
            onClick={() => {
              onSelect(segment.flag.code);
              document.getElementById(ids.bar)?.focus();
            }}
          >
            {segment.text}
          </button>
        );
      })}
    </div>
  );
}
