/**
 * One document, reopened from the library.
 *
 * The reader sees the reading they were shown when they kept it: the same summary, the
 * same completeness reading, the same flags in the same order. That is the point of
 * storing the analysis rather than running a new one. A document they decided about
 * last month should not come back with a different set of flags because the model
 * changed underneath them, and the whole promise of this product is that they can hold
 * what they were told against the document.
 *
 * Every source sentence is located in the stored text again before it reaches this
 * screen (`src/library/stored.ts`). A flag whose sentence is no longer there is dropped
 * and the screen says how many, because a stored citation nobody rechecked is a
 * citation on trust.
 *
 * The question box works here too, and it answers from the stored text, which is the
 * same text every flag on the screen was checked against.
 *
 * What is not stored with the document is the reader's red lines. Those are read fresh,
 * because they are the reader's as they stand today rather than as they stood when the
 * document was kept, and all they do is decide what is read first. The flags, their
 * severity and their source sentences are the stored reading, untouched.
 */

import Gate from "@/components/Gate";
import Reading from "@/components/Reading";
import Shell from "@/components/Shell";
import { keptOn } from "@/src/library/entry";
import { keptDocument } from "@/src/library/store";
import { redLinesOf } from "@/src/red-lines/store";
import { accountState } from "@/src/supabase/server";

import "@/components/library.css";

export const metadata = { title: "A document you kept: Redline" };

/** The document belongs to the reader asking for it, so it is never a cached page. */
export const dynamic = "force-dynamic";

const NOT_FOUND =
  "This document is not in your library. It may have been deleted, or the address may belong to someone else's library, which you cannot read.";

const UNREADABLE =
  "Redline cannot read this document back. What is stored does not match what a reading is made of, so there is nothing here Redline can honestly show you.";

function dropped(count: number): string {
  return count === 1
    ? "One flag from this reading is missing. The sentence it quoted is not in the stored text, so Redline dropped it rather than show a flag with nothing behind it."
    : `${count} flags from this reading are missing. The sentences they quoted are not in the stored text, so Redline dropped them rather than show flags with nothing behind them.`;
}

export default async function KeptDocumentPage({
  params,
}: {
  params: Promise<{ readonly id: string }>;
}) {
  const account = await accountState();

  if (account.kind !== "signed-in") {
    return (
      <Shell place="library" account={account}>
        <Gate account={account} heading="A document you kept" what="A document you kept" />
      </Shell>
    );
  }

  const { id } = await params;
  const kept = await keptDocument(account.reader.id, id);

  if (kept.outcome !== "reopened" || kept.reading.outcome === "unreadable") {
    return (
      <Shell place="library" account={account}>
        <section className="lib">
          <h1 className="lib__h">A document you kept</h1>
          <p className="said">
            <span>{kept.outcome === "reopened" ? UNREADABLE : NOT_FOUND}</span>
          </p>
          <a className="btn btn--primary btn--lg btn--inline lib__back" href="/library">
            <span>Back to your library</span>
          </a>
        </section>
      </Shell>
    );
  }

  // The reader's red lines, read here rather than in the browser, because this screen is
  // already on the server with the session cookie. They promote and mark, so a document
  // reopened from the library reads in the same order a fresh one does. A reader whose
  // red lines could not be read gets the reading with none, which is the same reading
  // with a different order at the top and nothing missing from it (ADR 0008).
  const listed = await redLinesOf(account.reader.id);
  const redLines = listed.outcome === "listed" ? listed.redLines : [];

  const reading = kept.reading;
  const day = keptOn(reading.keptAt);

  return (
    <Shell place="library" account={account}>
      <section className="lib lib--kept">
        <h1 className="lib__h">A document you kept</h1>
        <p className="lib__lede">
          {day === ""
            ? "This is the reading you were shown when you kept it."
            : `Kept ${day}. This is the reading you were shown when you kept it.`}
        </p>
        <a className="btn btn--ghost btn--inline lib__back" href="/library">
          <span>Back to your library</span>
        </a>
      </section>

      <Reading
        document={reading.document}
        analysis={reading.analysis}
        redLines={redLines}
        aside={
          reading.flagsDropped > 0 ? (
            <p className="said">
              <span>{dropped(reading.flagsDropped)}</span>
            </p>
          ) : null
        }
      />
    </Shell>
  );
}
