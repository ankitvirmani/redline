/**
 * What is written to the library, and what is read back out of it.
 *
 * Pure. No client, no network, no cookies: a row in, a document out, or a document
 * in, a row out. `src/library/store.ts` does the talking to Supabase and owns none
 * of the rules, so everything that could be wrong about a kept document can be
 * tested without a project existing.
 *
 * Two rules live here.
 *
 * **Only extracted text is stored.** The row carries the text extraction read, the
 * completeness reading, and the analysis. It carries no file: no bytes, no base64,
 * no name, no type, no size. There is no field for one, and `tests/library.test.ts`
 * walks the row a PDF would produce to prove there is nothing binary in it.
 *
 * **A stored citation is held to the same rule as a fresh one.** Every source
 * sentence in a reopened analysis is located in the stored text again before the
 * reader sees it, and a flag whose sentence is no longer there is dropped, exactly
 * as it would have been dropped at the analysis seam. A citation nobody rechecked is
 * a citation on trust, and trust is the thing this product does not ask for.
 */

import type { DocumentAnalysis, Flag } from "@/src/analysis";
import { verifiedSentence } from "@/src/domain/verify";
import { SEVERITY_MOVEMENT_CODES, WINDOW_RUNS_AGAINST } from "@/src/analysis/types";
import { CLAUSE_TYPE_SLUGS, LEVERS, SEVERITY_BANDS } from "@/src/domain/clause-types";
import { DEFECT_CODES } from "@/src/domain/defects";
import {
  COMPLETENESS_LEVELS,
  COMPLETENESS_SIGNAL_CODES,
} from "@/src/extraction/completeness";
import type { ExtractedDocument } from "@/src/extraction";
import { z } from "zod";

// ── what goes in ──────────────────────────────────────────────────────────────

/**
 * The row as it is inserted. Every field is text, a number, or plain json, and the
 * shape is the whole of what leaves this process for the database.
 *
 * `reader_id` is written explicitly even though the column defaults to the
 * requesting reader, because the insert policy checks the value and a row that says
 * whose it is can be read by a person looking at the table.
 */
export type KeptDocumentInsert = {
  readonly reader_id: string;
  readonly extracted_text: string;
  readonly character_count: number;
  readonly source_kind: string;
  readonly completeness: unknown;
  readonly analysis: unknown;
};

/** What is kept: one document, and the reading Redline made of it. */
export type DocumentToKeep = {
  readonly document: ExtractedDocument;
  readonly analysis: DocumentAnalysis;
};

/**
 * The row for a document a reader is keeping.
 *
 * Built field by field rather than by spreading the document, so that a field added
 * to `ExtractedDocument` later, by the PDF path or anything else, cannot arrive in
 * the database because somebody spread an object. Anything new is stored when this
 * function is changed to store it, and not before.
 */
export function keptDocumentInsert(
  readerId: string,
  { document, analysis }: DocumentToKeep,
): KeptDocumentInsert {
  return {
    reader_id: readerId,
    extracted_text: document.text,
    character_count: document.characterCount,
    source_kind: document.sourceKind,
    completeness: { level: document.completeness.level, signals: document.completeness.signals },
    analysis,
  };
}

// ── what comes back ───────────────────────────────────────────────────────────

/**
 * The stored shapes, checked rather than cast.
 *
 * Json out of a database is input, however it got there. A row written by an older
 * build, edited by hand in the table editor, or half-written by a failed migration
 * has to come back as "this document cannot be read" rather than as a reading with
 * holes in it, because every hole would be something a reader was told about a
 * contract.
 *
 * Unknown fields are dropped rather than rejected, so that a row written by a later
 * build than the one reading it still opens, carrying what this build understands.
 */
const SPAN_LOCATION = z.object({
  start: z.number().int().nonnegative(),
  end: z.number().int().nonnegative(),
});

const SOURCE_SENTENCE = z.object({
  text: z.string().min(1),
  at: SPAN_LOCATION,
  occurrences: z.number().int().positive(),
});

const FLAG = z.object({
  code: z.string().min(1),
  clauseType: z.enum(CLAUSE_TYPE_SLUGS),
  sourceSentence: SOURCE_SENTENCE,
  severity: z.object({
    band: z.enum(SEVERITY_BANDS),
    baselineBand: z.enum(SEVERITY_BANDS),
    movements: z.array(
      z.object({
        code: z.enum(SEVERITY_MOVEMENT_CODES),
        direction: z.enum(["toward-critical", "toward-moderate"]),
        bands: z.number().int(),
      }),
    ),
  }),
  confidence: z.number().min(0).max(1),
  consequence: z.object({
    fromTheDocument: z.string().min(1),
    externalContext: z
      .object({
        fact: z.string().min(1),
        source: z.object({ title: z.string().min(1), url: z.string().min(1) }),
      })
      .nullable(),
  }),
  exit: z.object({ text: z.string().min(1), sourceSentence: SOURCE_SENTENCE }).nullable(),
  terms: z.object({
    windowToAct: z
      .object({
        days: z.number().int(),
        runsAgainst: z.enum(WINDOW_RUNS_AGAINST),
        statedInTheDocument: z.boolean(),
      })
      .nullable(),
  }),
  leverage: z.object({ leversRemoved: z.array(z.enum(LEVERS)) }),
});

const ANALYSIS = z.object({
  summary: z.object({ text: z.string() }),
  checkedClauseTypes: z.array(z.enum(CLAUSE_TYPE_SLUGS)),
  flags: z.array(FLAG),
  defects: z.array(
    z.object({
      code: z.enum(DEFECT_CODES),
      clauseType: z.enum(CLAUSE_TYPE_SLUGS).nullable(),
      spanCharacterCount: z.number().int().nullable(),
      documentCharacterCount: z.number().int(),
      at: z.string(),
    }),
  ),
});

const COMPLETENESS = z.object({
  level: z.enum(COMPLETENESS_LEVELS),
  signals: z.array(
    z.object({ code: z.enum(COMPLETENESS_SIGNAL_CODES), fired: z.boolean() }),
  ),
});

/** One row as the documents table hands it back. */
export type KeptDocumentRow = {
  readonly id: string;
  readonly extracted_text: string;
  readonly character_count: number;
  readonly source_kind: string;
  readonly completeness: unknown;
  readonly analysis: unknown;
  readonly kept_at: string;
};

/**
 * A document reopened from the library, or the reason it could not be.
 *
 * `flagsDropped` is how many flags cited a sentence the stored text no longer
 * contains. It is zero for every document this build wrote and read back, and the
 * number exists so that the screen can say something true rather than quietly
 * showing a shorter list than the reader remembers.
 */
export type KeptDocumentReading =
  | {
      readonly outcome: "reopened";
      readonly document: ExtractedDocument;
      readonly analysis: DocumentAnalysis;
      readonly flagsDropped: number;
      /** When the reader kept it, as stored. */
      readonly keptAt: string;
    }
  | { readonly outcome: "unreadable" };

/**
 * Holds one stored flag against the stored text again.
 *
 * The sentence is located afresh, so the span on the flag the reader sees was found
 * in the text the reader is looking at rather than carried over from the row. An
 * exit that cites a sentence the text does not contain loses the exit and keeps the
 * flag, which is what the analysis seam does with the same failure.
 *
 * No defect is recorded here. The defect log counts what the model got wrong; a
 * stored analysis disagreeing with its own stored text is this table going wrong,
 * and counting it as a model failure would put a number nobody can act on into the
 * one place that measures the model.
 */
function reverifiedFlag(text: string, flag: Flag): Flag | null {
  const sentence = verifiedSentence(text, flag.sourceSentence.text);
  if (sentence === null) return null;

  const exit =
    flag.exit === null
      ? null
      : (() => {
          const exitSentence = verifiedSentence(text, flag.exit.sourceSentence.text);
          return exitSentence === null
            ? null
            : { text: flag.exit.text, sourceSentence: exitSentence };
        })();

  return { ...flag, sourceSentence: sentence, exit };
}

/**
 * A whole analysis held against a text again: the flags whose sentence is still
 * there, and how many were dropped.
 *
 * Used on the way out as well as on the way back. The route that keeps a document is
 * handed an analysis by a browser, so it checks every citation against the text it is
 * about to store rather than storing a claim nobody held to the rule.
 */
export function reverifiedAnalysis(
  text: string,
  analysis: DocumentAnalysis,
): { readonly analysis: DocumentAnalysis; readonly flagsDropped: number } {
  const flags = analysis.flags
    .map((flag) => reverifiedFlag(text, flag))
    .filter((flag): flag is Flag => flag !== null);

  return {
    analysis: { ...analysis, flags },
    flagsDropped: analysis.flags.length - flags.length,
  };
}

/** The row as a document and a reading of it, with every citation checked again. */
export function readKeptDocument(row: KeptDocumentRow): KeptDocumentReading {
  const completeness = COMPLETENESS.safeParse(row.completeness);
  const analysis = ANALYSIS.safeParse(row.analysis);
  if (!completeness.success || !analysis.success) return { outcome: "unreadable" };
  if (row.extracted_text.length === 0) return { outcome: "unreadable" };

  const held = reverifiedAnalysis(row.extracted_text, {
    summary: analysis.data.summary,
    checkedClauseTypes: analysis.data.checkedClauseTypes,
    flags: analysis.data.flags,
    defects: analysis.data.defects,
  });

  return {
    outcome: "reopened",
    document: {
      text: row.extracted_text,
      characterCount: row.character_count,
      // The stored kind, as extraction reported it. Cast because the column is text
      // and extraction owns the vocabulary; a kind this build does not know changes
      // nothing a screen does with the document.
      sourceKind: row.source_kind as ExtractedDocument["sourceKind"],
      completeness: completeness.data,
    },
    analysis: held.analysis,
    flagsDropped: held.flagsDropped,
    keptAt: row.kept_at,
  };
}

/** The analysis as it is sent to be kept, checked on the way out. */
export function analysisToKeep(analysis: unknown): DocumentAnalysis | null {
  const read = ANALYSIS.safeParse(analysis);
  return read.success ? read.data : null;
}

/** The completeness reading as it arrives from a browser, checked. */
export function completenessToKeep(
  completeness: unknown,
): ExtractedDocument["completeness"] | null {
  const read = COMPLETENESS.safeParse(completeness);
  return read.success ? read.data : null;
}
