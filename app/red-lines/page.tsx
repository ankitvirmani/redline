/**
 * The reader's red lines: the conditions they have declared unacceptable in advance.
 *
 * Rendered on the server, where the session cookie already is, so the browser needs no
 * Supabase client to read someone's list. What comes back is limited by the policies in
 * migration 0002 before it is limited by anything here. The list is then handed to a
 * client component, because adding, editing and removing happen without leaving the
 * page.
 *
 * Three states other than a list, none of them an error page: this build has no project,
 * nobody is signed in, and the list could not be read. A reader with no red lines is a
 * fourth and it lives in `components/RedLines.tsx`, because it is a state of the list
 * rather than of the screen.
 *
 * The whole of what this screen changes is what a reader sees first on a document. It
 * says so at the top, including the limit, because a reader meeting the idea here has no
 * way to know that naming a condition does not stop anything (ADR 0008).
 */

import Gate from "@/components/Gate";
import RedLines from "@/components/RedLines";
import Shell from "@/components/Shell";
import { redLinesOf } from "@/src/red-lines/store";
import { accountState } from "@/src/supabase/server";

import "@/components/red-lines.css";

export const metadata = { title: "Your red lines: Redline" };

/** The list is about this reader's cookies, so it is never a cached page. */
export const dynamic = "force-dynamic";

const COULD_NOT_LIST =
  "Redline could not read your red lines just now. Nothing has happened to them. Reload the page and they should be here.";

export default async function RedLinesPage() {
  const account = await accountState();

  if (account.kind !== "signed-in") {
    return (
      <Shell place="red-lines" account={account}>
        {/* `what` is the subject of Gate's own sentences, so it is the singular phrase
            that reads in them: "Your list of red lines needs a Supabase project". */}
        <Gate account={account} heading="Your red lines" what="Your list of red lines" />
      </Shell>
    );
  }

  const listed = await redLinesOf(account.reader.id);

  return (
    <Shell place="red-lines" account={account}>
      <section className="rl">
        <h1 className="rl__h">Your red lines</h1>
        <p className="rl__lede">
          A red line is a condition you will not accept. Name one and a clause of that kind
          is the first thing you read when Redline goes through a document for you, with
          your own words beside it.
        </p>
        <p className="rl__limit">
          Moving a clause up the list is all a red line does. Redline finds the same clauses
          whether you have named any or not. It cannot stop you signing anything, and it
          will not tell you whether to sign.
        </p>

        {listed.outcome === "listed" ? (
          <RedLines redLines={listed.redLines} />
        ) : (
          <p className="said">
            <span>{COULD_NOT_LIST}</span>
          </p>
        )}
      </section>
    </Shell>
  );
}
