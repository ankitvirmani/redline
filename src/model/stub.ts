/**
 * The stub model client, built from the fixture sidecars.
 *
 * The deterministic suite runs with no key and no network, so it needs something
 * that answers like a model without being one. This reads the sidecars under
 * `tests/fixtures/`, which are the labelled truth about those two documents, and
 * returns them in the shape the real model is required to answer in. A test that
 * wants a different answer, including a wrong one, hands in its own payload.
 *
 * The sidecars carry no window-to-act field, and this file does not invent one: it
 * reads the day count out of the sentence the sidecar names as the exit, the way a
 * model reading the document would. So the severity test is not handed the answer
 * it is checking; it is handed a sentence, and the terms come out of the sentence.
 *
 * Nothing in the product imports this file. It reads from disk and it knows about
 * test fixtures, and both are reasons it stays out of the app.
 */

import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import type { ModelAnalysisPayload, ModelFlagPayload } from "@/src/analysis/schema";
import type { WindowRunsAgainst } from "@/src/analysis/types";
import { isClauseTypeSlug } from "@/src/domain/clause-types";

import { ModelCallError, type ModelClient, type ModelFailure, type ModelRequest } from "./client";

const FIXTURES = new URL("../../tests/fixtures/", import.meta.url);

function fixture(name: string): string {
  return readFileSync(fileURLToPath(new URL(name, FIXTURES)), "utf8");
}

/** The sidecar shape, as far as the stub needs it. */
type Sidecar = {
  readonly document: string;
  readonly summary?: string;
  readonly plantedClauses?: readonly {
    readonly id: string;
    readonly clauseType: string;
    readonly sourceSentence: string;
    readonly confidence: number;
    readonly consequence: string;
    readonly exit: { readonly text: string; readonly sourceSentence: string } | null;
  }[];
};

/**
 * Every sidecar in the fixtures directory that describes planted clauses, read from
 * the directory rather than from a list here, so that a fixture added later is
 * answered for without anybody remembering to come back to this file. The questions
 * sidecar names a document and plants no clauses, so it falls out.
 */
export function analysisSidecars(): readonly Sidecar[] {
  return readdirSync(fileURLToPath(FIXTURES))
    .filter((name) => name.endsWith(".json"))
    .sort()
    .map((name) => JSON.parse(fixture(name)) as Sidecar)
    .filter((sidecar) => Array.isArray(sidecar.plantedClauses));
}

/**
 * Reads a window to act out of the sentence that grants it.
 *
 * These documents write a period twice, in words and in figures, so the figure is
 * what to read: "no later than three (3) days", "at least ninety (90) days". What
 * the window runs against is in the preposition that follows it. "Three days before
 * the renewal date" comes round every term and is a window the reader can use;
 * "thirty days after you first accept this Agreement" is one chance at the start and
 * has expired long before a dispute exists.
 */
function windowIn(sentence: string): { readonly days: number; readonly runsAgainst: WindowRunsAgainst } | null {
  const figure = /\((\d+)\)\s*(?:calendar\s+)?days?/u.exec(sentence) ?? /(\d+)\s*(?:calendar\s+)?days?/u.exec(sentence);
  if (figure === null) return null;
  const days = Number(figure[1]);
  if (!Number.isFinite(days)) return null;

  const after = sentence.slice(figure.index + figure[0].length);
  if (/\bbefore\b/u.test(after)) return { days, runsAgainst: "each-time-the-clause-bites" };
  if (/\bafter\b/u.test(after)) return { days, runsAgainst: "once-at-the-start" };
  return null;
}

/** One sidecar clause, in the shape the model has to answer in. */
function asModelFlag(planted: NonNullable<Sidecar["plantedClauses"]>[number]): ModelFlagPayload {
  if (!isClauseTypeSlug(planted.clauseType)) {
    throw new Error(`The sidecar names a clause type that is not one of the seven: ${planted.id}.`);
  }
  return {
    clauseType: planted.clauseType,
    sourceSentence: planted.sourceSentence,
    consequence: planted.consequence,
    confidence: planted.confidence,
    exit: planted.exit === null ? null : { text: planted.exit.text, sourceSentence: planted.exit.sourceSentence },
    windowToAct: planted.exit === null ? null : windowIn(planted.exit.sourceSentence),
  };
}

/** The payload for one sidecar, in the order the clauses were planted. */
export function payloadFor(sidecar: Sidecar): ModelAnalysisPayload {
  if (sidecar.summary === undefined || sidecar.summary.trim().length === 0) {
    throw new Error(`The sidecar for ${sidecar.document} carries no summary to answer with.`);
  }
  return {
    summary: sidecar.summary,
    flags: (sidecar.plantedClauses ?? []).map(asModelFlag),
  };
}

/** The document text a sidecar names. */
export function documentFor(sidecar: Sidecar): string {
  return fixture(sidecar.document);
}

/** The faithful payload for a document the sidecars describe, to hand back or bend. */
export function fixturePayload(documentText: string): ModelAnalysisPayload {
  for (const sidecar of analysisSidecars()) {
    if (documentFor(sidecar) === documentText) return payloadFor(sidecar);
  }
  throw new Error("The stub was handed a document no fixture sidecar describes.");
}

/** Ways a model can hand back a span that is not what the document says. */
export const SPAN_CHANGES = [
  /** One letter different, the way a retyped sentence goes wrong. */
  "one-character",
  /** A curly quotation mark straightened. */
  "one-curly-quote",
  /** One space doubled. */
  "one-space",
  /** A claim the document does not make, tacked on to the sentence it should have quoted. */
  "not-in-the-document",
] as const;

export type SpanChange = (typeof SPAN_CHANGES)[number];

/** A sentence no fixture document contains. Nothing here is a real clause. */
export const FABRICATED_SENTENCE =
  "The Member agrees to forfeit every right under this Agreement without notice.";

/**
 * The same span with one thing about it changed. Throws rather than returning the
 * span untouched, so a test cannot pass because nothing actually changed.
 */
export function changeSpan(span: string, change: SpanChange): string {
  switch (change) {
    case "not-in-the-document":
      // A real sentence with an invented one joined to it, which is a failure the
      // instructions name and a model still makes. Built from the span so that two
      // fabrications stay two things rather than collapsing into one.
      return `${span} ${FABRICATED_SENTENCE}`;
    case "one-space": {
      const at = span.indexOf(" ");
      if (at === -1) throw new Error("That span has no space to double.");
      return `${span.slice(0, at)} ${span.slice(at)}`;
    }
    case "one-curly-quote": {
      const straightened = span.replace(/[‘’]/u, "'").replace(/[“”]/u, '"');
      if (straightened === span) throw new Error("That span has no curly quotation mark to straighten.");
      return straightened;
    }
    case "one-character": {
      // Far enough in that the change lands inside a word rather than on the first
      // letter of the sentence.
      const at = span.slice(10).search(/[a-z]/u);
      if (at === -1) throw new Error("That span has no lowercase letter to change.");
      const index = at + 10;
      const letter = span[index] === "e" ? "a" : "e";
      return `${span.slice(0, index)}${letter}${span.slice(index + 1)}`;
    }
  }
}

/** The same payload with the spans of the chosen flags changed. */
export function withChangedSpans(
  payload: ModelAnalysisPayload,
  change: SpanChange,
  chosen: (index: number) => boolean = () => true,
): ModelAnalysisPayload {
  return {
    ...payload,
    flags: payload.flags.map((flag, index) =>
      chosen(index) ? { ...flag, sourceSentence: changeSpan(flag.sourceSentence, change) } : flag,
    ),
  };
}

/**
 * The same payload with a different summary, the way the span helpers above hand back
 * the same payload with a different span. The flags are untouched, so a test can see
 * what one bad summary does to an otherwise sound answer.
 */
export function withSummary(payload: ModelAnalysisPayload, summary: string): ModelAnalysisPayload {
  return { ...payload, summary };
}

/**
 * Summaries that say whether to sign, one per way of saying it.
 *
 * Written here rather than in a test because they are example model output, which is
 * what this file is for. Every one of them is about the gym membership fixture and
 * every one of them is a summary the product must not show: the first two say it
 * outright, the third and fourth judge the document's character, the fifth reassures,
 * which is the worst of them because it reads as a kindness, and the sixth answers a
 * question about the law that the document cannot answer (ADR 0005).
 */
export const SUMMARIES_THAT_CARRY_A_VERDICT = [
  "This is a twelve-month gym membership that renews on its own. You should not sign it without getting the renewal window changed first.",
  "This is a twelve-month gym membership with an instructor track. We recommend you think carefully before accepting it.",
  "This is a twelve-month gym membership. The agreement is unusually aggressive about what it takes from you and what it gives back.",
  "This is a twelve-month gym membership. It is a standard agreement of the kind clubs have used for years.",
  "This is a twelve-month gym membership that renews for a further twelve months. There is nothing here to worry about.",
  "This is a twelve-month gym membership with an arbitration clause and a fifteen mile teaching restriction. The teaching restriction is unenforceable in most states.",
] as const;

/**
 * A summary of the gym membership with a figure the document does not contain. The
 * document has no eighty-eight of anything, which is what makes it a fabrication
 * rather than a rewording.
 */
export const SUMMARY_WITH_A_FIGURE_THE_DOCUMENT_DOES_NOT_HAVE =
  "This is a twelve-month gym membership at Meridian Athletic Club. Dues run to eighty-eight dollars a month and the membership renews for another twelve months unless you cancel three days ahead.";

export type StubOptions = {
  /**
   * What to answer with. A value, or a function of the document text. Untyped on
   * purpose: a test needs to be able to hand back something malformed and see it
   * rejected.
   */
  readonly answer?: unknown | ((documentText: string) => unknown);
  /** Fail the call instead of answering it. */
  readonly fail?: ModelFailure;
};

/**
 * A model client that answers from the fixture sidecars, or with whatever a test
 * hands it. It makes no network call, because there is nothing in it that could.
 */
export function stubModelClient(options: StubOptions = {}): ModelClient {
  return {
    async complete(request: ModelRequest) {
      if (options.fail !== undefined) {
        throw new ModelCallError(options.fail, "The stub was asked to fail.");
      }
      if (options.answer !== undefined) {
        const answer =
          typeof options.answer === "function"
            ? (options.answer as (documentText: string) => unknown)(request.input)
            : options.answer;
        return { json: answer };
      }
      return { json: fixturePayload(request.input) };
    },
  };
}
