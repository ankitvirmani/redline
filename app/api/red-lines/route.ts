/**
 * The reader's red lines: read them, write one, change one, remove one.
 *
 * Two callers, for the same reason the account route has one. The red-lines screen
 * posts here so that the list on the screen is the list in the table after every
 * change. The reading surface reads here because it must not import a Supabase client:
 * a document is read by people who have no account at all, and one import of a client
 * into that bundle would break the surface for them.
 *
 * The session comes from the cookie on this side. A reader who is not signed in gets
 * `no-account`, which is a state with copy rather than a status code to interpret, and
 * a build with no project gets `no-project`.
 *
 * What arrives is held to the rule in `src/domain/red-lines.ts` before it reaches the
 * store. The same rule runs in the field as the reader types, and the column checks in
 * migrations 0002 and 0003 say it again in the database, because this is the one list
 * whose contents decide what a reader sees first about a contract.
 *
 * No caching. The answer is about this request's cookies and nothing else.
 */

import { NextResponse } from "next/server";
import { z } from "zod";

import { redLineWritten } from "@/src/domain/red-lines";
import {
  changeRedLine,
  redLinesOf,
  removeRedLine,
  writeRedLine,
} from "@/src/red-lines/store";
import type { RedLinesReply } from "@/src/red-lines/written";
import { accountState } from "@/src/supabase/server";

export const dynamic = "force-dynamic";

const NO_STORE = { headers: { "cache-control": "no-store" } } as const;

const WRITING = z.object({
  text: z.string(),
  clauseTypes: z.array(z.string()),
});

const CHANGE = z.object({
  id: z.string().min(1),
  text: z.string(),
  clauseTypes: z.array(z.string()),
});

const REMOVAL = z.object({ id: z.string().min(1) });

function said(reply: RedLinesReply) {
  return NextResponse.json(reply, NO_STORE);
}

/** Who is asking, or what to say instead. */
async function asking(): Promise<
  { readonly reader: string } | { readonly instead: RedLinesReply }
> {
  const account = await accountState();
  if (account.kind === "no-project") return { instead: { outcome: "no-project" } };
  if (account.kind === "signed-out") return { instead: { outcome: "no-account" } };
  return { reader: account.reader.id };
}

export async function GET() {
  const who = await asking();
  if ("instead" in who) return said(who.instead);
  return said(await redLinesOf(who.reader));
}

export async function POST(request: Request) {
  const who = await asking();
  if ("instead" in who) return said(who.instead);

  const body = WRITING.safeParse(await request.json().catch(() => null));
  if (!body.success) return said({ outcome: "not-written" });

  // The rule keeps only the clause types Redline checks, so a body naming something
  // else names one fewer thing, and a body naming nothing Redline checks comes back as
  // `nothing-to-check`: the same answer the screen gives when no box is ticked.
  const written = redLineWritten(body.data);
  if (written.outcome !== "written") return said(written);

  return said(await writeRedLine(who.reader, written.writing));
}

export async function PUT(request: Request) {
  const who = await asking();
  if ("instead" in who) return said(who.instead);

  const body = CHANGE.safeParse(await request.json().catch(() => null));
  if (!body.success) return said({ outcome: "not-written" });

  // The rule keeps only the clause types Redline checks, so a body naming something
  // else names one fewer thing, and a body naming nothing Redline checks comes back as
  // `nothing-to-check`: the same answer the screen gives when no box is ticked.
  const written = redLineWritten(body.data);
  if (written.outcome !== "written") return said(written);

  return said(await changeRedLine(who.reader, body.data.id, written.writing));
}

export async function DELETE(request: Request) {
  const who = await asking();
  if ("instead" in who) return said(who.instead);

  const body = REMOVAL.safeParse(await request.json().catch(() => null));
  if (!body.success) return said({ outcome: "not-found" });

  return said(await removeRedLine(who.reader, body.data.id));
}
