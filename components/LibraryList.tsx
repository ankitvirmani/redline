/**
 * The documents a reader has kept, listed most recently kept first.
 *
 * A list of links and nothing else. What a row shows is the document's own opening
 * line, the day it was kept and how long it is: no flag count, no severity, no score.
 * A number about a contract standing where the contract is not is the shape this
 * product refuses, and the reader opens the document to read what it costs them.
 *
 * The order and the mapping from a stored row to a row here are decided in
 * `src/library/entry.ts`, which is pure, so both are asserted directly in
 * `tests/library.test.ts` rather than through a screen.
 *
 * An empty library is a designed state. A reader reaching it has kept nothing yet, so
 * it says what the library holds and what it does not.
 */

import { formatCharacterCount } from "@/src/domain/text";
import type { LibraryReading } from "@/src/library/entry";

import "./library.css";

export const EMPTY_LIBRARY_KEY = "Nothing kept yet";

export default function LibraryList({
  reading,
  headingId,
}: {
  reading: LibraryReading;
  headingId: string;
}) {
  if (reading.empty) {
    return (
      <div className="lib-empty">
        <p className="lib-empty__k">{EMPTY_LIBRARY_KEY}</p>
        <p className="lib-empty__say">
          Keep a document here and you come back to the reading you were shown, with
          the same flags in the same order, each still quoting the sentence it came
          from.
        </p>
        <p className="lib-empty__note">
          Redline keeps the text it read and this reading of it. It never keeps the
          file you started with, and nobody but you can read what is here.
        </p>
        <a className="btn btn--primary btn--lg btn--inline" href="/analyse">
          <span>Read a document</span>
        </a>
      </div>
    );
  }

  return (
    <ul className="lib-list" aria-labelledby={headingId}>
      {reading.entries.map((entry) => (
        <li key={entry.id}>
          <a className="lib-row" href={entry.href}>
            <h2 className="lib-row__title">{entry.title}</h2>
            <p className="lib-row__kept">Kept {entry.keptOn}</p>
            <p className="lib-row__size">{formatCharacterCount(entry.characterCount)}</p>
          </a>
        </li>
      ))}
    </ul>
  );
}
