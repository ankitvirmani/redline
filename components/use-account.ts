/**
 * Whether anyone is signed in, asked from the browser.
 *
 * The paste screen is the one surface that has to ask. Everything else behind sign-in
 * is rendered on the server, where the session cookie already is. Asking a route
 * rather than building a client here is what keeps `@supabase/supabase-js` out of the
 * reading surface's bundle, on the same principle as the model: the analysis path
 * talks to routes and imports no client.
 *
 * Null means not known yet, and null is also what a reply nobody could read comes back
 * as. A screen that guessed would either offer to keep a document Redline cannot keep
 * or tell a signed-in reader to sign in, so the account block and the action that
 * keeps a document both say nothing until this returns something.
 */

"use client";

import { useEffect, useState } from "react";

import { readAccountState, type AccountState } from "@/src/account/state";

export function useAccount(): AccountState | null {
  const [account, setAccount] = useState<AccountState | null>(null);

  useEffect(() => {
    let listening = true;

    void (async () => {
      try {
        const response = await fetch("/api/account", { cache: "no-store" });
        const state = readAccountState(await response.json());
        if (listening) setAccount(state);
      } catch {
        // Not known, which is what the screen already shows.
      }
    })();

    return () => {
      listening = false;
    };
  }, []);

  return account;
}
