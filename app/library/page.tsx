/**
 * The library: the documents this reader has kept.
 *
 * Rendered on the server, where the session cookie already is, so the browser needs no
 * Supabase client to read a list of someone's documents. What comes back is limited by
 * the policies in migration 0001 before it is limited by anything here.
 *
 * Three states other than a list, none of them an error page: this build has no
 * project, nobody is signed in, and the list could not be read. The empty library is a
 * fourth and it lives in `components/LibraryList.tsx`, because it is a state of the
 * list rather than a state of the screen.
 */

import Gate from "@/components/Gate";
import LibraryList from "@/components/LibraryList";
import Shell from "@/components/Shell";
import { libraryOf } from "@/src/library/store";
import { accountState } from "@/src/supabase/server";

import "@/components/library.css";

export const metadata = { title: "Your library: Redline" };

/** The list is about this reader's cookies, so it is never a cached page. */
export const dynamic = "force-dynamic";

const COULD_NOT_LIST =
  "Redline could not read your library just now. Nothing has happened to what is in it. Reload the page and it should be here.";

const HEADING_ID = "library-heading";

export default async function LibraryPage() {
  const account = await accountState();

  if (account.kind !== "signed-in") {
    return (
      <Shell place="library" account={account}>
        <Gate account={account} heading="Your library" what="Your library" />
      </Shell>
    );
  }

  const library = await libraryOf(account.reader.id);

  return (
    <Shell place="library" account={account}>
      <section className="lib">
        <h1 className="lib__h" id={HEADING_ID}>Your library</h1>
        <p className="lib__lede">
          Every document here comes back with the reading you were shown. Redline keeps
          the text it read and never the file it came out of.
        </p>

        {library.outcome === "listed" ? (
          <LibraryList reading={library.reading} headingId={HEADING_ID} />
        ) : (
          <p className="said">
            <span>{COULD_NOT_LIST}</span>
          </p>
        )}
      </section>
    </Shell>
  );
}
