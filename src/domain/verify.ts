/**
 * Verification. The one rule the product rests on, in code.
 *
 * A model returns a span it says came from the document. This file checks that
 * claim against the stored extracted text and reports where the span sits. It
 * knows nothing about models, prompts, flags or screens: text in, span in, found
 * or not found out. That is deliberate, because verification that lives in a
 * prompt degrades silently the moment the prompt or the model changes (ADR 0001).
 *
 * It sits in `src/domain/` because two seams rest on it and neither owns it. Ticket
 * 04 wrote it at the analysis seam; ticket 09 needs the identical check for an
 * answer's source sentence, and an answer's verifier is the one nobody watches, so
 * a second copy of these rules would drift exactly where it matters most. It moved
 * here rather than being imported across the seams or written twice. The rules are
 * unchanged by the move.
 *
 * Verbatim means exact substring. No trim before comparison, no whitespace
 * collapse, no quote folding, no case folding, no `normalize()`, no dash or
 * ligature repair. A span that differs from the document by one curly quote does
 * not match, and the flag carrying it is dropped. That is the correct behaviour
 * and it is the whole point: a fabricated risk has no matching sentence, so the
 * check catches it before display rather than after someone acts on it.
 *
 * Nothing here repairs a near miss. No fuzzy match, no closest-sentence search,
 * no re-anchoring on the longest common run. A repaired span is a citation the
 * reader cannot trust, which is exactly the silent degradation ADR 0001 exists to
 * prevent.
 */

/**
 * Where a span sits in the text.
 *
 * `start` and `end` are indexes into the extracted text as JavaScript indexes it,
 * meaning UTF-16 code units, so that `text.slice(start, end) === span` holds and a
 * DOM `Range` built from them lands on the same characters. They are therefore not
 * the same units as `ExtractedDocument.characterCount`, which counts code points
 * because that is what a reader counts. Anything marking the sentence inside the
 * rendered document wants these; anything shown to a reader wants that.
 */
export type SpanLocation = {
  readonly start: number;
  readonly end: number;
};

/** Why a span could not be located. Both are defects, not rough edges. */
export type SpanFailure = "not-found" | "empty-span";

/**
 * The result of holding one span against the document.
 *
 * `occurrences` is how many times the span appears in the whole text. It is
 * carried rather than collapsed because a sentence that appears twice is still
 * quoted honestly and still worth flagging, while the question of which one to
 * mark in the rendered document is a rendering question. See `locateSpan`.
 */
export type SpanVerification =
  | { readonly outcome: "found"; readonly at: SpanLocation; readonly occurrences: number }
  | { readonly outcome: "not-found"; readonly failure: SpanFailure };

/**
 * Counts how many times `span` appears in `text`, without overlapping itself.
 * Non-overlapping is the right count here because a source sentence repeating
 * inside itself is not a thing a document does, and the count exists to tell a
 * reader's screen whether the sentence turns up in more than one place.
 */
function countOccurrences(text: string, span: string): number {
  let found = 0;
  let from = 0;
  for (;;) {
    const at = text.indexOf(span, from);
    if (at === -1) return found;
    found += 1;
    from = at + span.length;
  }
}

/**
 * Holds one span against the document text and says where it is.
 *
 * An empty span fails rather than matching at index 0. Every string contains the
 * empty string, so treating it as found would let a flag with no source sentence
 * through the one check that exists to stop exactly that.
 *
 * When a span appears more than once, the first occurrence is returned and the
 * count comes with it. Dropping the flag instead would cost a real risk over a
 * question about where to draw a mark: the quoted words are verbatim either way,
 * so the citation is honest, and a false negative is the failure a reader never
 * finds out about (ADR 0004). The screen marks the occurrence returned here and
 * can say the sentence appears more than once, which the count is for.
 */
export function locateSpan(text: string, span: string): SpanVerification {
  if (span.length === 0) return { outcome: "not-found", failure: "empty-span" };

  const start = text.indexOf(span);
  if (start === -1) return { outcome: "not-found", failure: "not-found" };

  return {
    outcome: "found",
    at: { start, end: start + span.length },
    occurrences: countOccurrences(text, span),
  };
}

/**
 * The same check as a question, for a caller that only wants the answer. Reads as
 * the rule itself: this sentence is in that document, character for character.
 */
export function appearsVerbatim(text: string, span: string): boolean {
  return locateSpan(text, span).outcome === "found";
}

/**
 * A sentence from the document, quoted verbatim, with where it was found.
 *
 * Nothing constructs one of these except verification. That is what makes the type
 * worth having: a `SourceSentence` in hand is a sentence that has already been held
 * against the document character for character, whether it reached the reader as a
 * flag's citation or as the sentence an answer came from.
 */
export type SourceSentence = {
  /** The sentence, exactly as it appears in the document. */
  readonly text: string;
  /** Where it sits, in UTF-16 code units. See `SpanLocation`. */
  readonly at: SpanLocation;
  /** How many times the sentence appears in the document. Usually one. */
  readonly occurrences: number;
};

/**
 * The span as a `SourceSentence`, or null when the document does not contain it.
 *
 * The only constructor. A flag's citation and an answer's citation are built by this
 * one call, so there is no path on which one of them is held to a looser rule than
 * the other.
 */
export function verifiedSentence(text: string, span: string): SourceSentence | null {
  const located = locateSpan(text, span);
  if (located.outcome !== "found") return null;
  return { text: span, at: located.at, occurrences: located.occurrences };
}
