/**
 * Signing out. A form posts here, so it works with no JavaScript running.
 *
 * The redirect is a 303 so that the browser follows it with a GET and the reader does
 * not have a POST in their history to re-send. They land on the paste box, which is
 * where signing out leaves them able to do everything except read their library.
 */

import { NextResponse } from "next/server";

import { serverClient } from "@/src/supabase/server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const client = await serverClient();
  if (client.outcome === "client") await client.supabase.auth.signOut();

  return NextResponse.redirect(new URL("/", request.url), { status: 303 });
}
