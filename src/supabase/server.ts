/**
 * The Supabase client for code running on the server: the route handlers and the
 * screens behind sign-in.
 *
 * Two things about this file are load-bearing.
 *
 * It returns null rather than throwing when there is no project. Every caller has
 * something to say to the reader in that case, and a screen that threw would turn a
 * state the owner is going to meet on their first run into a stack trace.
 *
 * It reads the session out of cookies, which is what `@supabase/ssr` is for. The
 * session never has to be handed to the browser bundle of the reading surface, so
 * nothing on the analysis path needs a client at all.
 *
 * Nothing on the analysis path imports this file, and `tests/signed-out.test.ts`
 * walks the import graph to keep that true.
 */

import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

import type { AccountState, Reader } from "@/src/account/state";

import { configuredSupabase, type SupabaseVariable } from "./configuration";

/**
 * A client, or the reason there is none. A union rather than a nullable client, so
 * that a caller reporting "no project configured" to the reader has the names of the
 * missing variables in hand and nothing has to ask the environment twice.
 */
export type ServerSupabase =
  | { readonly outcome: "no-project"; readonly missing: readonly SupabaseVariable[] }
  | { readonly outcome: "client"; readonly supabase: SupabaseClient };

/**
 * A client carrying this request's session, or the reason this build has no project.
 *
 * `setAll` is wrapped because a server component is not allowed to write a cookie.
 * Supabase calls it when it refreshes a token, and in a component the refreshed
 * token is simply not written down: the request still holds a valid session, and the
 * next route handler or middleware writes it. Letting the throw out would break a
 * screen over a cookie.
 */
export async function serverClient(): Promise<ServerSupabase> {
  const configuration = configuredSupabase();
  if (configuration.kind === "no-project") {
    return { outcome: "no-project", missing: configuration.missing };
  }

  const jar = await cookies();

  const supabase = createServerClient(configuration.url, configuration.anonKey, {
    cookies: {
      getAll: () => jar.getAll(),
      setAll: (written) => {
        try {
          for (const { name, value, options } of written) jar.set(name, value, options);
        } catch {
          // A server component cannot write cookies. See above.
        }
      },
    },
  });

  return { outcome: "client", supabase };
}

/**
 * The reader this request belongs to, or null when nobody is signed in.
 *
 * `getUser` rather than `getSession`, because it asks the auth server whether the
 * token is good instead of believing a cookie. This decides whether Redline offers
 * to keep someone's contract, so it is worth the round trip.
 *
 * It takes the client rather than making one, so that a caller doing something with
 * the reader's rows asks who they are on the same client it then uses.
 */
export async function readerOf(supabase: SupabaseClient): Promise<Reader | null> {
  const { data, error } = await supabase.auth.getUser();
  if (error !== null || data.user === null) return null;
  return { id: data.user.id, email: data.user.email ?? null };
}

/** Who is signed in, as one value the screens and the rail can render. */
export async function accountState(): Promise<AccountState> {
  const client = await serverClient();
  if (client.outcome === "no-project") {
    return { kind: "no-project", missing: client.missing };
  }

  const reader = await readerOf(client.supabase);
  return reader === null ? { kind: "signed-out" } : { kind: "signed-in", reader };
}
