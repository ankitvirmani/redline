/**
 * The labelled corpus: what is in it, and the refusal to load one that is broken.
 *
 * Reads `tests/corpus/manifest.json` and everything it names, and locates every
 * planted sentence in its document with the product's own verifier. A corpus whose
 * sidecar names a sentence the document does not contain is not a weaker corpus, it is
 * a corpus that would report a recall miss the model never made, so this file refuses
 * to hand one over. `tests/eval-corpus.test.ts` runs that refusal on every commit, with
 * no model and no network, which is why a broken corpus is caught before anyone pays
 * for inference over it.
 *
 * It reads no environment variable and makes no call. The only thing it knows about a
 * model is that the eval suite has one.
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import {
  CLAUSE_TYPE_SLUGS,
  SEVERITY_BANDS,
  type ClauseTypeSlug,
  type SeverityBand,
} from "@/src/domain/clause-types";
import { locateSpan, type SpanLocation } from "@/src/domain/verify";

/** Where the corpus lives. One place, so nothing else guesses at a path. */
export const CORPUS_DIRECTORY = new URL("../../tests/corpus/", import.meta.url);

/** One clause the corpus says is in a document, with where it was found. */
export type CorpusPlantedClause = {
  readonly id: string;
  readonly clauseType: ClauseTypeSlug;
  readonly sourceSentence: string;
  readonly at: SpanLocation;
  readonly expectedSeverityBand: SeverityBand;
  readonly consequence: string;
  readonly why: string;
  readonly exit: { readonly text: string; readonly sourceSentence: string } | null;
};

/** A question the document answers, and the sentence the corpus says answers it. */
export type GroundedQuestion = {
  readonly question: string;
  readonly expectedSourceSentence: string;
};

/** A question the document cannot answer, and why it cannot. */
export type UngroundedQuestion = {
  readonly question: string;
  readonly why: string;
};

export type CorpusQuestions = {
  readonly grounded: readonly GroundedQuestion[];
  readonly ungrounded: readonly UngroundedQuestion[];
};

export type CorpusDocument = {
  readonly id: string;
  readonly title: string;
  readonly text: string;
  readonly characterCount: number;
  /** Where the document came from. Every entry says so, and none says the world. */
  readonly provenance: string;
  /** True when the corpus says none of the seven types is in it. */
  readonly benign: boolean;
  readonly summary: string;
  readonly checkedClauseTypes: readonly ClauseTypeSlug[];
  readonly planted: readonly CorpusPlantedClause[];
  /**
   * Sentences that are odd, or specific, or the sort of thing a reader would notice,
   * and that take no lever and cost nothing. They are not planted clauses and a flag
   * on one is an over-flag. They exist so that "arbitration outranks a merely unusual
   * clause" has something in the corpus to be true about.
   */
  readonly unusualButHarmless: readonly string[];
  readonly questions: CorpusQuestions | null;
};

export type Corpus = {
  readonly name: string;
  readonly version: number;
  readonly whatThisIs: string;
  readonly documents: readonly CorpusDocument[];
};

/** What went wrong loading the corpus. Every one blocks the run. */
export class CorpusError extends Error {
  readonly problems: readonly string[];

  constructor(problems: readonly string[]) {
    super(`The corpus is not loadable:\n  ${problems.join("\n  ")}`);
    this.name = "CorpusError";
    this.problems = problems;
  }
}

type ManifestEntry = {
  readonly id: string;
  readonly document: string;
  readonly sidecar: string;
  readonly questions?: string;
  readonly provenance: string;
  readonly benign: boolean;
  readonly unusualButHarmless: readonly string[];
};

type Manifest = {
  readonly corpus: string;
  readonly version: number;
  readonly whatThisIs: string;
  readonly documents: readonly ManifestEntry[];
};

type Sidecar = {
  readonly document: string;
  readonly title: string;
  readonly summary: string;
  readonly checkedClauseTypes: readonly string[];
  readonly plantedClauses: readonly {
    readonly id: string;
    readonly clauseType: string;
    readonly sourceSentence: string;
    readonly expectedSeverityBand: string;
    readonly consequence: string;
    readonly why: string;
    readonly exit: { readonly text: string; readonly sourceSentence: string } | null;
  }[];
};

function read(relative: string): string {
  return readFileSync(fileURLToPath(new URL(relative, CORPUS_DIRECTORY)), "utf8");
}

function isSlug(value: string): value is ClauseTypeSlug {
  return (CLAUSE_TYPE_SLUGS as readonly string[]).includes(value);
}

function isBand(value: string): value is SeverityBand {
  return (SEVERITY_BANDS as readonly string[]).includes(value);
}

/**
 * The corpus, or a `CorpusError` listing everything wrong with it.
 *
 * Every problem is collected rather than thrown on the first one, because someone
 * fixing a corpus wants the whole list and not one line of it per run.
 */
export function loadCorpus(): Corpus {
  const manifest = JSON.parse(read("manifest.json")) as Manifest;
  const problems: string[] = [];
  const documents: CorpusDocument[] = [];

  for (const entry of manifest.documents) {
    const text = read(entry.document);
    const sidecar = JSON.parse(read(entry.sidecar)) as Sidecar;

    if (!text.includes(sidecar.title)) {
      problems.push(`${entry.id}: the sidecar's title is not in the document`);
    }

    const missingTypes = CLAUSE_TYPE_SLUGS.filter(
      (slug) => !sidecar.checkedClauseTypes.includes(slug),
    );
    if (missingTypes.length > 0) {
      problems.push(`${entry.id}: checkedClauseTypes is missing ${missingTypes.join(", ")}`);
    }

    const planted: CorpusPlantedClause[] = [];
    let previousStart = -1;
    for (const clause of sidecar.plantedClauses) {
      const where = `${entry.id} ${clause.id}`;
      if (!isSlug(clause.clauseType)) {
        problems.push(`${where}: ${clause.clauseType} is not one of the seven clause types`);
        continue;
      }
      if (!isBand(clause.expectedSeverityBand)) {
        problems.push(`${where}: ${clause.expectedSeverityBand} is not a severity band`);
        continue;
      }
      const located = locateSpan(text, clause.sourceSentence);
      if (located.outcome !== "found") {
        problems.push(`${where}: its source sentence is not in the document verbatim`);
        continue;
      }
      if (located.occurrences !== 1) {
        problems.push(
          `${where}: its source sentence appears ${located.occurrences} times, so a citation to it is ambiguous`,
        );
        continue;
      }
      if (located.at.start < previousStart) {
        problems.push(`${where}: planted clauses are not listed in document order`);
      }
      previousStart = located.at.start;

      if (clause.exit !== null && !text.includes(clause.exit.sourceSentence)) {
        problems.push(`${where}: its exit's source sentence is not in the document verbatim`);
      }

      planted.push({
        id: clause.id,
        clauseType: clause.clauseType,
        sourceSentence: clause.sourceSentence,
        at: located.at,
        expectedSeverityBand: clause.expectedSeverityBand,
        consequence: clause.consequence,
        why: clause.why,
        exit: clause.exit,
      });
    }

    if (entry.benign && planted.length > 0) {
      problems.push(`${entry.id}: the manifest calls it benign and its sidecar plants ${planted.length} clauses`);
    }
    if (!entry.benign && planted.length === 0) {
      problems.push(`${entry.id}: the manifest does not call it benign and its sidecar plants nothing`);
    }

    for (const sentence of entry.unusualButHarmless) {
      if (!text.includes(sentence)) {
        problems.push(`${entry.id}: an unusualButHarmless sentence is not in the document verbatim`);
      }
    }

    let questions: CorpusQuestions | null = null;
    if (entry.questions !== undefined) {
      const parsed = JSON.parse(read(entry.questions)) as CorpusQuestions;
      for (const grounded of parsed.grounded) {
        if (!text.includes(grounded.expectedSourceSentence)) {
          problems.push(
            `${entry.id}: a grounded question's expected source sentence is not in the document verbatim`,
          );
        }
      }
      questions = parsed;
    }

    documents.push({
      id: entry.id,
      title: sidecar.title,
      text,
      characterCount: [...text].length,
      provenance: entry.provenance,
      benign: entry.benign,
      summary: sidecar.summary,
      checkedClauseTypes: sidecar.checkedClauseTypes.filter(isSlug),
      planted,
      unusualButHarmless: entry.unusualButHarmless,
      questions,
    });
  }

  if (problems.length > 0) throw new CorpusError(problems);

  return {
    name: manifest.corpus,
    version: manifest.version,
    whatThisIs: manifest.whatThisIs,
    documents,
  };
}

/** How many instances of each clause type the corpus holds. */
export function inventory(corpus: Corpus): Readonly<Record<ClauseTypeSlug, number>> {
  const counts = Object.fromEntries(CLAUSE_TYPE_SLUGS.map((slug) => [slug, 0])) as Record<
    ClauseTypeSlug,
    number
  >;
  for (const document of corpus.documents) {
    for (const clause of document.planted) counts[clause.clauseType] += 1;
  }
  return counts;
}

/**
 * Which characters in a sentence are the ones a model retypes instead of copying.
 *
 * The ticket 10 run dropped the same flag on every attempt: a sentence carrying an em
 * dash, a curly apostrophe and a non-breaking space. Recording the character classes
 * per sentence lets the run report the drop rate split by whether the sentence carried
 * one, which turns a mysterious miss into a measurement.
 */
export const TYPOGRAPHY_AT_RISK: Readonly<Record<string, RegExp>> = {
  "em-dash": /—/u,
  "en-dash": /–/u,
  "curly-apostrophe": /’/u,
  "curly-quotes": /[“”]/u,
  "non-breaking-space": / /u,
  ligature: /[ﬀ-ﬆ]/u,
  tab: /\t/u,
  "double-space": / {2}/u,
};

/** The at-risk character classes a sentence carries, in a stable order. */
export function typographyIn(sentence: string): readonly string[] {
  return Object.entries(TYPOGRAPHY_AT_RISK)
    .filter(([, pattern]) => pattern.test(sentence))
    .map(([name]) => name);
}
