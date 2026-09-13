/**
 * The reader's red lines, asked for from the browser.
 *
 * The paste surface is the one place that has to ask this way. Everything else that
 * shows a reading is rendered on the server, where the session cookie already is.
 * Asking a route rather than building a client here is what keeps
 * `@supabase/supabase-js` out of the bundle that reads a document, on the same
 * principle as the model and the account: the analysis path talks to routes and imports
 * no client. `tests/signed-out.test.ts` walks the import graph to keep it true.
 *
 * An empty list is what a reader who is not signed in gets, what a build with no project
 * gets, and what a reader who has named none gets. All three are the same to ranking,
 * which is the point of ADR 0008: red lines change what a reader sees first and nothing
 * else, so not having them costs nothing and never has to be handled as a failure. A
 * reply nobody could read is an empty list too, because the alternative is showing
 * somebody a mark claiming they named something.
 */

"use client";

import { useEffect, useState } from "react";

import type { AccountState } from "@/src/account/state";
import type { RedLine } from "@/src/domain/red-lines";
import { readRedLinesReply } from "@/src/red-lines/written";

/** No red lines. One frozen value, so a render with none is the same value every time. */
const NONE: readonly RedLine[] = [];

export function useRedLines(account: AccountState | null): readonly RedLine[] {
  const [redLines, setRedLines] = useState<readonly RedLine[]>(NONE);
  const readerId = account?.kind === "signed-in" ? account.reader.id : null;

  useEffect(() => {
    // Nobody signed in, or the answer about that is still coming. Red lines belong to an
    // account, so there is nothing to ask for and nothing to wait for.
    if (readerId === null) {
      setRedLines(NONE);
      return;
    }

    let listening = true;

    void (async () => {
      try {
        const response = await fetch("/api/red-lines", { cache: "no-store" });
        const reply = readRedLinesReply(await response.json());
        if (listening && reply?.outcome === "listed") setRedLines(reply.redLines);
      } catch {
        // No red lines, which is what the reading already has.
      }
    })();

    return () => {
      listening = false;
    };
  }, [readerId]);

  return redLines;
}
