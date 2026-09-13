/**
 * Who is signed in, for the one screen that has to ask from the browser.
 *
 * The paste surface imports no Supabase client, so it cannot read the session cookie
 * itself. It asks here instead, and gets back one of three answers: no project, nobody
 * signed in, or a reader. That is the whole of what it does with the reply: decide
 * whether to offer to keep the document.
 *
 * No caching. The answer is about this request's cookies and nothing else.
 */

import { NextResponse } from "next/server";

import { accountState } from "@/src/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(await accountState(), {
    headers: { "cache-control": "no-store" },
  });
}
