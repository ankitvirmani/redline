/**
 * The Supabase client for code running in the browser.
 *
 * One screen imports it: the sign-in form, which asks Supabase to email a link.
 * Nothing else in the browser needs a client, because the library and the reader's
 * red lines are read on the server where the session cookie already is.
 *
 * It returns null rather than throwing when there is no project, for the same reason
 * the server client does: the screen has something to say about that, and it is not
 * an exception.
 *
 * `createBrowserClient` writes the PKCE verifier to a cookie rather than to browser
 * storage, which is how the callback route on the server can finish a sign-in the
 * browser started.
 */

"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

import { configuredSupabase } from "./configuration";

/** One client per page load, built the first time it is asked for. */
let built: SupabaseClient | null = null;

/** A client, or null when this build has no project. */
export function browserClient(): SupabaseClient | null {
  if (built !== null) return built;

  const configuration = configuredSupabase();
  if (configuration.kind === "no-project") return null;

  built = createBrowserClient(configuration.url, configuration.anonKey);
  return built;
}
