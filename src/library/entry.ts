/**
 * The library list: a stored row in, a line the reader can read out.
 *
 * Pure, and the reason the list is worth testing without a project. The mapping
 * from a row to an entry, the order the entries come in, and what an empty library
 * is are all decided here, so all three can be asserted directly.
 *
 * A document has no name here, and that is deliberate rather than unfinished. Only
 * the extracted text is stored, never the file, so there is no file name to show;
 * the title is the document's own first line, which is the heading the reader wrote
 * or accepted. A document whose opening carries no words is listed by the day it was
 * kept rather than by a placeholder that says nothing.
 */

/**
 * One row as the list reads it.
 *
 * `opening` is the generated column from migration 0001, which holds the first 240
 * characters of the text. The list never selects the document itself: a library of
 * contracts is a lot of text to move in order to print one line of each.
 */
export type LibraryRow = {
  readonly id: string;
  readonly opening: string;
  readonly character_count: number;
  readonly kept_at: string;
};

/** One document as the reader sees it in their library. */
export type LibraryEntry = {
  readonly id: string;
  /** The document's own opening line, or the day it was kept when it has none. */
  readonly title: string;
  /** Where the reader goes to open it again. */
  readonly href: string;
  /** The day it was kept, written out. */
  readonly keptOn: string;
  /** The moment it was kept, as stored, which is what the order is built on. */
  readonly keptAt: string;
  readonly characterCount: number;
};

/** The whole list, in the order it is read. */
export type LibraryReading = {
  readonly entries: readonly LibraryEntry[];
  /**
   * Whether the library is empty. Carried rather than left to a caller counting the
   * list, because an empty library is a state with its own copy and a caller that
   * rendered an empty list instead would show the reader nothing at all.
   */
  readonly empty: boolean;
};

/** How long a title runs before it is cut. Long enough for a real heading. */
const TITLE_CHARACTERS = 72;

/**
 * The day a document was kept, written out.
 *
 * One locale and one time zone, named rather than inherited, so that the date a
 * reader sees does not depend on which machine rendered it. UTC means a document
 * kept late in the evening can be listed under the following day, which is a cost
 * worth paying for a date that reads the same everywhere.
 */
const DAY = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

/**
 * The day a timestamp falls on, written out, or an empty string when the timestamp
 * cannot be read. Exported because the screen that reopens one document says when it
 * was kept in the same words the list does.
 */
export function keptOn(keptAt: string): string {
  const at = new Date(keptAt);
  return Number.isNaN(at.getTime()) ? "" : DAY.format(at);
}

/**
 * The document's title: its first line with words in it, cut at a word boundary.
 *
 * Cut rather than reflowed, and cut at a space so that a heading does not end mid
 * word. The line is trimmed for display only; nothing here touches the stored text,
 * which every source sentence is still checked against character for character.
 */
export function documentTitle(opening: string): string | null {
  const line = opening
    .split(/\r?\n/)
    .map((candidate) => candidate.trim())
    .find((candidate) => candidate.length > 0);
  if (line === undefined) return null;

  if (line.length <= TITLE_CHARACTERS) return line;

  const cut = line.slice(0, TITLE_CHARACTERS);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > TITLE_CHARACTERS / 2 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}

/**
 * When a document was kept, as a number to order on. A row whose timestamp cannot be
 * read sorts to the end rather than throwing the whole list into an arbitrary order.
 */
function momentOf(keptAt: string): number {
  const at = Date.parse(keptAt);
  return Number.isNaN(at) ? 0 : at;
}

/** One row as one line in the library. */
export function libraryEntry(row: LibraryRow): LibraryEntry {
  const day = keptOn(row.kept_at);
  const title = documentTitle(row.opening);

  return {
    id: row.id,
    title: title ?? (day === "" ? "A document with no opening line" : `A document kept on ${day}`),
    href: `/library/${row.id}`,
    keptOn: day,
    keptAt: row.kept_at,
    characterCount: row.character_count,
  };
}

/**
 * The rows as the library reads: the document kept most recently first.
 *
 * Ordered here as well as in the query. The query asks the database for this order
 * because that is what an index is for, and this function does not trust it to have
 * arrived, because the list a reader reads top down should not be able to come out
 * backwards on the strength of a clause in a select somebody edited.
 */
export function libraryReading(rows: readonly LibraryRow[]): LibraryReading {
  const entries = rows
    .map(libraryEntry)
    .sort((one, other) => momentOf(other.keptAt) - momentOf(one.keptAt));

  return { entries, empty: entries.length === 0 };
}
