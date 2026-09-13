/**
 * Keeping a document in the reader's library.
 *
 * The reading surface posts here rather than talking to Supabase itself, which is what
 * keeps a client out of the browser bundle that reads a document. The session comes
 * from the cookie on this side.
 *
 * What is accepted is the extracted text, its completeness reading and the analysis.
 * There is no field for a file and nothing here would store one: the browser parses a
 * PDF and only the text comes out of it (`CLAUDE.md`).
 *
 * Every source sentence in the analysis is held against the text again before anything
 * is written. The browser is not trusted to have kept the seam's promise, and a flag
 * whose sentence is not in the text being stored is dropped here exactly as it would
 * have been dropped at the analysis seam. A citation that was never rechecked is a
 * citation on trust.
 */

import { NextResponse } from "next/server";
import { z } from "zod";

import { keepDocument } from "@/src/library/store";
import {
  analysisToKeep,
  completenessToKeep,
  reverifiedAnalysis,
} from "@/src/library/stored";
import { accountState } from "@/src/supabase/server";

export const dynamic = "force-dynamic";

const KEEP = z.object({
  text: z.string().min(1),
  characterCount: z.number().int().positive(),
  sourceKind: z.string().min(1),
  completeness: z.unknown(),
  analysis: z.unknown(),
});

export async function POST(request: Request) {
  const account = await accountState();
  if (account.kind === "no-project") return NextResponse.json({ outcome: "no-project" });
  if (account.kind === "signed-out") return NextResponse.json({ outcome: "no-account" });

  const asked = KEEP.safeParse(await request.json().catch(() => null));
  if (!asked.success) return NextResponse.json({ outcome: "not-kept" });

  const completeness = completenessToKeep(asked.data.completeness);
  const analysis = analysisToKeep(asked.data.analysis);
  if (completeness === null || analysis === null) {
    return NextResponse.json({ outcome: "not-kept" });
  }

  const held = reverifiedAnalysis(asked.data.text, analysis);

  const kept = await keepDocument(account.reader.id, {
    document: {
      text: asked.data.text,
      characterCount: asked.data.characterCount,
      sourceKind: asked.data.sourceKind as "pasted",
      completeness,
    },
    analysis: held.analysis,
  });

  return NextResponse.json(kept);
}
