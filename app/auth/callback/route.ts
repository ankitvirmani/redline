/**
 * The other end of a magic link.
 *
 * The sign-in form asked Supabase to email a link; this is where the link lands. The
 * code in it is exchanged for a session, and `@supabase/ssr` writes the session
 * cookies on the way out, which is why the exchange happens here on the server rather
 * than in the browser that started it.
 *
 * Two shapes are handled, because which one arrives depends on the project's email
 * template. `code` is what the default template sends, and what the PKCE flow the
 * browser client started expects. `token_hash` with a `type` is what a template
 * written against `{{ .TokenHash }}` sends, and verifying it needs no verifier.
 *
 * A link that does not work sends the reader back to the sign-in screen, which says so
 * in its own copy. There is nothing for them to fix here and nothing worth showing
 * them about it: they need another link, and that screen is where one is asked for.
 */

import { NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";

import { serverClient } from "@/src/supabase/server";

export const dynamic = "force-dynamic";

/** Where the reader is sent once they are signed in. Their library, which is what an account is for. */
const SIGNED_IN = "/library";

/** The sign-in screen, told that the link it sent did not work. */
const LINK_FAILED = "/sign-in?link=did-not-work";

export async function GET(request: Request) {
  const asked = new URL(request.url);
  const code = asked.searchParams.get("code");
  const tokenHash = asked.searchParams.get("token_hash");
  const type = asked.searchParams.get("type");

  const client = await serverClient();
  if (client.outcome === "no-project") {
    return NextResponse.redirect(new URL("/sign-in", asked.origin));
  }

  const signedIn = await (async () => {
    if (code !== null) {
      const { error } = await client.supabase.auth.exchangeCodeForSession(code);
      return error === null;
    }
    if (tokenHash !== null && type !== null) {
      const { error } = await client.supabase.auth.verifyOtp({
        token_hash: tokenHash,
        type: type as EmailOtpType,
      });
      return error === null;
    }
    return false;
  })();

  return NextResponse.redirect(new URL(signedIn ? SIGNED_IN : LINK_FAILED, asked.origin));
}
