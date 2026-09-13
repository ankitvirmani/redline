/**
 * The library's one conversation with Supabase: keep a document, list a reader's
 * documents, open one of them.
 *
 * Every rule lives next door in `entry.ts` and `stored.ts`, which are pure. This file
 * holds only the calls, so that what cannot be tested without a project is as small
 * as it can be made. Nothing here is reachable from the analysis path.
 *
 * Three things are true of every function here:
 *
 * - No project and no reader are outcomes, not exceptions. Each one has copy on the
 *   screen that asked.
 * - Row-level security is the enforcement, not this file. Each query also names the
 *   reader, which is what the index on (reader_id, kept_at desc) is for, but a policy
 *   in migration 0001 is what makes another reader's document unreachable.
 * - What comes back is checked before it is used. A row is json until something reads
 *   it, however it got into the table.
 */

import { z } from "zod";

import { serverClient } from "@/src/supabase/server";

import { libraryReading, type LibraryReading } from "./entry";
import {
  keptDocumentInsert,
  readKeptDocument,
  type DocumentToKeep,
  type KeptDocumentReading,
} from "./stored";

/** The table. Named once. */
const DOCUMENTS = "documents";

/** How many documents the library lists. A reader with more scrolls a shorter list. */
const LISTED = 200;

const LIBRARY_ROW = z.object({
  id: z.string().min(1),
  opening: z.string(),
  character_count: z.number().int(),
  kept_at: z.string(),
});

const KEPT_ROW = z.object({
  id: z.string().min(1),
  extracted_text: z.string(),
  character_count: z.number().int(),
  source_kind: z.string(),
  completeness: z.unknown(),
  analysis: z.unknown(),
  kept_at: z.string(),
});

/** What keeping a document came to. */
export type KeepResult =
  | { readonly outcome: "kept"; readonly id: string }
  | { readonly outcome: "no-project" }
  | { readonly outcome: "not-kept" };

/** What asking for the library came to. */
export type LibraryResult =
  | { readonly outcome: "listed"; readonly reading: LibraryReading }
  | { readonly outcome: "no-project" }
  | { readonly outcome: "not-listed" };

/** What asking for one kept document came to. */
export type KeptDocumentResult =
  | { readonly outcome: "reopened"; readonly reading: KeptDocumentReading }
  | { readonly outcome: "no-project" }
  | { readonly outcome: "not-found" };

/**
 * Keeps one document in the reader's library, and says which row it became.
 *
 * The reader is passed in rather than looked up here, so that a caller who has already
 * established who is asking does not ask the auth server a second time. The policies
 * in migration 0001 are what make the id binding: a row claiming another reader is
 * refused by the database, not by this line.
 */
export async function keepDocument(
  readerId: string,
  toKeep: DocumentToKeep,
): Promise<KeepResult> {
  const client = await serverClient();
  if (client.outcome === "no-project") return { outcome: "no-project" };

  const { data, error } = await client.supabase
    .from(DOCUMENTS)
    .insert(keptDocumentInsert(readerId, toKeep))
    .select("id")
    .single();

  if (error !== null) return { outcome: "not-kept" };

  const row = z.object({ id: z.string().min(1) }).safeParse(data);
  return row.success ? { outcome: "kept", id: row.data.id } : { outcome: "not-kept" };
}

/** The reader's documents, most recently kept first. */
export async function libraryOf(readerId: string): Promise<LibraryResult> {
  const client = await serverClient();
  if (client.outcome === "no-project") return { outcome: "no-project" };

  const { data, error } = await client.supabase
    .from(DOCUMENTS)
    .select("id, opening, character_count, kept_at")
    .eq("reader_id", readerId)
    .order("kept_at", { ascending: false })
    .limit(LISTED);

  if (error !== null) return { outcome: "not-listed" };

  const rows = z.array(LIBRARY_ROW).safeParse(data);
  if (!rows.success) return { outcome: "not-listed" };

  return { outcome: "listed", reading: libraryReading(rows.data) };
}

/** One kept document, with every citation in it held against the stored text again. */
export async function keptDocument(
  readerId: string,
  id: string,
): Promise<KeptDocumentResult> {
  const client = await serverClient();
  if (client.outcome === "no-project") return { outcome: "no-project" };

  const { data, error } = await client.supabase
    .from(DOCUMENTS)
    .select("id, extracted_text, character_count, source_kind, completeness, analysis, kept_at")
    .eq("reader_id", readerId)
    .eq("id", id)
    .maybeSingle();

  if (error !== null || data === null) return { outcome: "not-found" };

  const row = KEPT_ROW.safeParse(data);
  if (!row.success) return { outcome: "not-found" };

  return { outcome: "reopened", reading: readKeptDocument(row.data) };
}
