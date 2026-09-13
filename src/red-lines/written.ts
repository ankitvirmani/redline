/**
 * What a red line looks like in the table, and what the screens read back.
 *
 * Pure. A row in, a red line out, or a red line in, a row out. `store.ts` next door
 * does the talking to Supabase and owns none of the rules, so everything that could
 * be wrong about a reader's red lines can be tested without a project existing.
 *
 * Two things live here rather than in a screen or a route.
 *
 * **The order.** A reader's red lines read in the order they wrote them. Their list is
 * not ranked, scored or sorted by how often a red line fires: it is theirs, in the
 * order it grew.
 *
 * **What comes back is checked, not cast.** A row is json until something reads it,
 * however it got into the table. A row carrying a clause type this build does not know
 * comes back as a red line that checks fewer kinds of clause rather than as one that
 * cannot be shown, and a reader whose red line checks nothing is told so on the
 * screen. What must never happen is a red line sitting in someone's list that nothing
 * is ever checked against, with nothing on the screen saying so.
 */

import { z } from "zod";

import {
  checkedClauseTypesOf,
  type RedLine,
  type RedLineWriting,
} from "@/src/domain/red-lines";

/** The row as it is written. `reader_id` is named even though the column defaults
 * to the requesting reader, because the insert policy checks the value and a row that
 * says whose it is can be read by a person looking at the table. */
export type RedLineInsert = {
  readonly reader_id: string;
  readonly text: string;
  readonly clause_types: readonly string[];
};

/** The reader's whole list, as a screen renders it. */
export type RedLinesReading = {
  /** In the order the reader wrote them. */
  readonly redLines: readonly RedLine[];
  /**
   * Whether the list is empty. Carried rather than left to a caller counting the
   * list, because a reader with no red lines is a designed state with its own copy,
   * and a caller that rendered an empty list would show them nothing at all.
   */
  readonly empty: boolean;
};

export const RED_LINE_ROW = z.object({
  id: z.string().min(1),
  text: z.string(),
  // `null` rather than an empty array is what a nullable array column can hand back, and
  // a column added by a later migration can be null in a row written before it.
  clause_types: z.array(z.string()).nullable(),
  written_at: z.string(),
});

/** One row as the list reads it. The schema above is the one definition of it. */
export type RedLineRow = z.infer<typeof RED_LINE_ROW>;

/** One row as a red line. Unknown clause types are dropped, the words are kept. */
export function redLineOf(row: RedLineRow): RedLine {
  return {
    id: row.id,
    text: row.text,
    clauseTypes: checkedClauseTypesOf(row.clause_types ?? []),
  };
}

/** When a red line was written, as a number to order on. */
function momentOf(writtenAt: string): number {
  const at = Date.parse(writtenAt);
  return Number.isNaN(at) ? 0 : at;
}

/**
 * The rows as the reader's list: the red line they wrote first at the top.
 *
 * Ordered here as well as in the query. The query asks the database for this order
 * because that is what the index is for, and this does not trust it to have arrived,
 * because a list somebody reads top down should not be able to come out backwards on
 * the strength of a clause in a select.
 */
export function redLinesReading(rows: readonly RedLineRow[]): RedLinesReading {
  const ordered = [...rows].sort(
    (one, other) => momentOf(one.written_at) - momentOf(other.written_at),
  );
  const redLines = ordered.map(redLineOf);
  return { redLines, empty: redLines.length === 0 };
}

/** The row for a red line the reader is writing. */
export function redLineInsert(readerId: string, writing: RedLineWriting): RedLineInsert {
  return {
    reader_id: readerId,
    text: writing.text,
    clause_types: [...writing.clauseTypes],
  };
}

// ── what the route says, and what the browser reads back ──────────────────────

/**
 * Everything asking about red lines can come to.
 *
 * One union for listing, writing, changing and removing, because every one of them
 * ends by handing back the reader's list as the database now holds it. A screen that
 * patched its own copy of the list instead would drift from the table on the first
 * request that did not land, and this is a list a reader will check a contract
 * against.
 *
 * None of the refusals is an error page. `no-project` is the state the owner meets
 * before the project exists, `no-account` is a reader who has not signed in, and the
 * three writing refusals are what the field wants said back.
 */
export type RedLinesReply =
  | { readonly outcome: "listed"; readonly redLines: readonly RedLine[] }
  | {
      readonly outcome: "removed";
      readonly redLines: readonly RedLine[];
      /** The red line that was removed, so the reader can put it back. */
      readonly removed: RedLine;
    }
  | { readonly outcome: "no-project" }
  | { readonly outcome: "no-account" }
  | { readonly outcome: "no-words" }
  | { readonly outcome: "nothing-to-check" }
  | { readonly outcome: "too-long"; readonly limit: number }
  | { readonly outcome: "not-listed" }
  | { readonly outcome: "not-written" }
  | { readonly outcome: "not-found" };

const RED_LINE = z.object({
  id: z.string().min(1),
  text: z.string(),
  clauseTypes: z.array(z.string()),
});

/** A red line as the browser reads it back: the words, and what is checked. */
function asRedLine(read: z.infer<typeof RED_LINE>): RedLine {
  return { id: read.id, text: read.text, clauseTypes: checkedClauseTypesOf(read.clauseTypes) };
}

const REPLY = z.discriminatedUnion("outcome", [
  z.object({ outcome: z.literal("listed"), redLines: z.array(RED_LINE) }),
  z.object({
    outcome: z.literal("removed"),
    redLines: z.array(RED_LINE),
    removed: RED_LINE,
  }),
  z.object({ outcome: z.literal("no-project") }),
  z.object({ outcome: z.literal("no-account") }),
  z.object({ outcome: z.literal("no-words") }),
  z.object({ outcome: z.literal("nothing-to-check") }),
  z.object({ outcome: z.literal("too-long"), limit: z.number().int().positive() }),
  z.object({ outcome: z.literal("not-listed") }),
  z.object({ outcome: z.literal("not-written") }),
  z.object({ outcome: z.literal("not-found") }),
]);

/**
 * The route's reply as something a screen can use, or null when it was not one.
 *
 * Checked rather than cast, on the same principle as the account reply: a reply
 * nobody could read must not become a list of red lines a reader believes their
 * documents are being checked against.
 */
export function readRedLinesReply(reply: unknown): RedLinesReply | null {
  const read = REPLY.safeParse(reply);
  if (!read.success) return null;

  const answer = read.data;
  if (answer.outcome === "listed") {
    return { outcome: "listed", redLines: answer.redLines.map(asRedLine) };
  }
  if (answer.outcome === "removed") {
    return {
      outcome: "removed",
      redLines: answer.redLines.map(asRedLine),
      removed: asRedLine(answer.removed),
    };
  }
  return answer;
}
