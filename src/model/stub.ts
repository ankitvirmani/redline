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
  return {
    summary: sidecar.summary ?? "",
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
