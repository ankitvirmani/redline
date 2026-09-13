/**
 * The red lines' one conversation with Supabase: list them, write one, change one,
 * remove one.
 *
 * Every rule lives next door in `written.ts`, which is pure. This file holds only the
 * calls, so that what cannot be tested without a project is as small as it can be
 * made. Nothing here is reachable from the analysis path: the reading surface asks a
 * route, the same way it asks who is signed in.
 *
 * Three things are true of every function here, on the same terms as the library's
 * store:
 *
 * - No project and no reader are outcomes, not exceptions. Each one has copy on the
 *   screen that asked.
 * - Row-level security is the enforcement, not this file. Each query also names the
 *   reader, which is what the index on (reader_id, written_at) is for, but the
 *   policies in migration 0002 are what make another reader's red lines unreachable.
 * - What comes back is checked before it is used.
 *
 * Every write ends by reading the list back, so what a screen holds is what the table
 * holds rather than a guess about it.
 */

import { z } from "zod";

import type { RedLineWriting } from "@/src/domain/red-lines";
import { serverClient } from "@/src/supabase/server";

import {
  RED_LINE_ROW,
  redLineInsert,
  redLineOf,
  redLinesReading,
  type RedLinesReply,
} from "./written";

/** The table. Named once. */
const RED_LINES = "red_lines";

/** The columns every read asks for. Named once, so four queries cannot drift. */
const COLUMNS = "id, text, clause_types, written_at";

/**
 * How many red lines are listed. A reader with more than this many conditions has a
 * different problem from the one this product solves, and the limit stops one list
 * from becoming a page nobody can read.
 */
const LISTED = 200;

/** What the store can come to. The account states are the route's to add. */
export type StoreReply = Exclude<RedLinesReply, { readonly outcome: "no-account" }>;

/** The reader's red lines, in the order they wrote them. */
export async function redLinesOf(readerId: string): Promise<StoreReply> {
  const client = await serverClient();
  if (client.outcome === "no-project") return { outcome: "no-project" };

  const { data, error } = await client.supabase
    .from(RED_LINES)
    .select(COLUMNS)
    .eq("reader_id", readerId)
    .order("written_at", { ascending: true })
    .limit(LISTED);

  if (error !== null) return { outcome: "not-listed" };

  const rows = z.array(RED_LINE_ROW).safeParse(data);
  if (!rows.success) return { outcome: "not-listed" };

  return { outcome: "listed", redLines: redLinesReading(rows.data).redLines };
}

/**
 * Writes one red line and hands back the list it joined.
 *
 * The words and the clause types arrive already held to the rule in
 * `src/domain/red-lines.ts`. The column checks say the same thing in the database,
 * which is what keeps a row written any other way out of the table.
 */
export async function writeRedLine(
  readerId: string,
  writing: RedLineWriting,
): Promise<StoreReply> {
  const client = await serverClient();
  if (client.outcome === "no-project") return { outcome: "no-project" };

  const { error } = await client.supabase
    .from(RED_LINES)
    .insert(redLineInsert(readerId, writing));

  if (error !== null) return { outcome: "not-written" };

  return redLinesOf(readerId);
}

/**
 * Changes one red line's words or what it checks, and hands back the list.
 *
 * `reader_id` is not in the update. A reader cannot hand a red line to somebody else,
 * and the update policy would refuse it, but the column is also simply never written
 * here.
 */
export async function changeRedLine(
  readerId: string,
  id: string,
  writing: RedLineWriting,
): Promise<StoreReply> {
  const client = await serverClient();
  if (client.outcome === "no-project") return { outcome: "no-project" };

  const { data, error } = await client.supabase
    .from(RED_LINES)
    .update({ text: writing.text, clause_types: [...writing.clauseTypes] })
    .eq("reader_id", readerId)
    .eq("id", id)
    .select(COLUMNS)
    .maybeSingle();

  if (error !== null) return { outcome: "not-written" };
  if (data === null) return { outcome: "not-found" };

  return redLinesOf(readerId);
}

/**
 * Removes one red line, and hands back both the list and the red line that left it.
 *
 * The removed row comes back so the screen can offer to put it back. Removing is one
 * press and there is no confirmation step in front of it; what makes that safe is
 * that the reader's own words are still in hand afterwards.
 */
export async function removeRedLine(readerId: string, id: string): Promise<StoreReply> {
  const client = await serverClient();
  if (client.outcome === "no-project") return { outcome: "no-project" };

  const { data, error } = await client.supabase
    .from(RED_LINES)
    .delete()
    .eq("reader_id", readerId)
    .eq("id", id)
    .select(COLUMNS)
    .maybeSingle();

  if (error !== null) return { outcome: "not-written" };
  if (data === null) return { outcome: "not-found" };

  const row = RED_LINE_ROW.safeParse(data);
  if (!row.success) return { outcome: "not-written" };

  const after = await redLinesOf(readerId);
  if (after.outcome !== "listed") return after;

  return { outcome: "removed", redLines: after.redLines, removed: redLineOf(row.data) };
}
