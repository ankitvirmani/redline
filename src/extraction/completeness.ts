/**
 * How much of a document extraction believes it received.
 *
 * Structural signals only, per the spec: the text ends mid sentence, there is no
 * closing or signature block, the length is implausible. No model call, no
 * network, no randomness. The same text always reads the same way.
 *
 * Type-relative plausibility is deferred on purpose. It needs a document type
 * that only analysis determines, and these three signals already catch the case
 * that matters, which is a reader pasting part of a page.
 *
 * The assessment informs and it gates nothing. A low reading sits beside the
 * result, suppresses nothing and blocks no submission (ADR 0006).
 *
 * PDF input comes through here too. `src/extraction/pdf.ts` calls
 * `assessCompleteness` on the text it extracted rather than writing its own
 * assessor, and hands in what it knows about the pages it read as a second
 * argument. Adding a signal means adding a code and a test function to one of the
 * two lists below; nothing else in the shape has to move.
 */

/**
 * The signals that read the text itself. Every document gets all of them, however
 * its text arrived, in the order the reader sees them.
 */
export const TEXT_COMPLETENESS_SIGNAL_CODES = [
  "ends-mid-sentence",
  "no-closing-block",
  "implausibly-short",
] as const;

/**
 * The signals that read the pages the text came off, which only a document with
 * pages has. A pasted document is not weighed against these, and does not report
 * them: a signal nobody could look at is not a signal that was weighed, and a
 * reader shown a page check on text they pasted out of an email would rightly
 * wonder what pages Redline thought it had.
 */
export const PAGE_COMPLETENESS_SIGNAL_CODES = ["pages-without-text"] as const;

/**
 * Every code either list can produce. This is the list to validate a stored
 * reading against, because a document kept in the library may have come from
 * either kind of source.
 */
export const COMPLETENESS_SIGNAL_CODES = [
  ...TEXT_COMPLETENESS_SIGNAL_CODES,
  ...PAGE_COMPLETENESS_SIGNAL_CODES,
] as const;

export type TextCompletenessSignalCode = (typeof TEXT_COMPLETENESS_SIGNAL_CODES)[number];
export type PageCompletenessSignalCode = (typeof PAGE_COMPLETENESS_SIGNAL_CODES)[number];
export type CompletenessSignalCode = (typeof COMPLETENESS_SIGNAL_CODES)[number];

/**
 * What the pages of a paginated document gave up, for the signals that read pages
 * rather than text. Counts only: nothing here carries page content, because the
 * document's text is the document and there is only one of it.
 */
export type PagesRead = {
  /** How many pages the parser found. */
  readonly pages: number;
  /** How many of them gave up text that is not only whitespace. */
  readonly pagesWithText: number;
};

/**
 * One signal and what it found. Every signal is reported, fired or not, because
 * a reader told the analysis may have received part of a document deserves to
 * know what made Redline think so, and a reader told it received the whole thing
 * deserves to know what was looked at.
 */
export type CompletenessSignal = {
  readonly code: CompletenessSignalCode;
  readonly fired: boolean;
};

/**
 * The reading, weakest evidence of a cut first. This is the field the screen
 * renders and the field to assert on: it is what a reader sees.
 */
export const COMPLETENESS_LEVELS = ["whole", "uncertain", "partial"] as const;

export type CompletenessLevel = (typeof COMPLETENESS_LEVELS)[number];

export type CompletenessAssessment = {
  readonly level: CompletenessLevel;
  readonly signals: readonly CompletenessSignal[];
};

/**
 * Below this many characters the text is too short to be a whole document of
 * the kind this product reads. A take-it-or-leave-it document names the parties,
 * the term, the money and the way out, and does not fit in a couple of
 * paragraphs. The two fixture documents are 4,000 and 9,700 characters; the
 * threshold sits well under both so that a short but whole document is not
 * called a fragment.
 *
 * Only a floor. There is no ceiling, because a genuinely long set of terms is
 * ordinary and nothing here can tell it from a doubled extraction.
 */
const IMPLAUSIBLY_SHORT_CHARACTERS = 1200;

/**
 * How much of the tail is read when looking for a closing block. Small enough
 * that the word "signed" in the body of a document cannot pass for a signature
 * block, large enough to hold a real one: a closing line, the parties, and a
 * rule to sign on.
 */
const CLOSING_WINDOW_SHARE = 0.08;
const CLOSING_WINDOW_MIN_CHARACTERS = 400;
const CLOSING_WINDOW_MAX_CHARACTERS = 1500;

/** A sentence that finished, including one that closes with a quote or bracket. */
const ENDS_A_SENTENCE = /[.!?…][)\]"'”’]*$/u;

/** Three or more underscores: a rule on a form, meant to be written on. */
const FORM_RULE = /_{3,}/u;

/** A heading, in the capitals every one of these documents sets them in. */
const HAS_LOWERCASE = /\p{Ll}/u;
const HAS_UPPERCASE = /\p{Lu}/u;

/** A field and its value: "Print name:", "Date:", "Name and title:". */
const FIELD_LABEL = /^[^:\n]{1,40}:\s/u;

/** What the end of a document looks like when the reader is meant to sign it. */
const CLOSING_CUES: readonly RegExp[] = [
  /\bin witness whereof\b/iu,
  /\baccepted and agreed\b/iu,
  /\bagreed and accepted\b/iu,
  /\bsignature\b/iu,
  /\bsigned\b/iu,
  /\bsign here\b/iu,
  /\bprint name\b/iu,
  /\bauthoris(?:ed|ing) signator/iu,
  /\bauthoriz(?:ed|ing) signator/iu,
  /\bexecuted as\b/iu,
  /_{6,}/u,
];

function lastLineWithWords(text: string): string | null {
  const lines = text.split("\n");
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    const line = lines[index] ?? "";
    if (line.trim().length > 0) return line.replace(/\s+$/u, "");
  }
  return null;
}

function readsAsHeading(line: string): boolean {
  return !HAS_LOWERCASE.test(line) && HAS_UPPERCASE.test(line);
}

function readsAsStructure(line: string): boolean {
  return FORM_RULE.test(line) || readsAsHeading(line) || FIELD_LABEL.test(line);
}

/**
 * The text stops part way through a sentence. A signature line, a heading and a
 * form field all end without a full stop and none of them is a cut, so a line
 * that reads as structure rather than prose does not fire this.
 */
function endsMidSentence(text: string): boolean {
  const last = lastLineWithWords(text);
  if (last === null) return false;
  if (ENDS_A_SENTENCE.test(last)) return false;
  return !readsAsStructure(last);
}

/** Nothing at the end of the text says a reader was meant to sign it. */
function hasNoClosingBlock(text: string): boolean {
  const window = Math.min(
    CLOSING_WINDOW_MAX_CHARACTERS,
    Math.max(CLOSING_WINDOW_MIN_CHARACTERS, Math.round(text.length * CLOSING_WINDOW_SHARE)),
  );
  const tail = text.slice(-window);
  return !CLOSING_CUES.some((cue) => cue.test(tail));
}

/** Too short to be a whole document of the kind this product reads. */
function isImplausiblyShort(text: string): boolean {
  return Array.from(text).length < IMPLAUSIBLY_SHORT_CHARACTERS;
}

const SIGNAL_TESTS: Readonly<
  Record<TextCompletenessSignalCode, (text: string) => boolean>
> = {
  "ends-mid-sentence": endsMidSentence,
  "no-closing-block": hasNoClosingBlock,
  "implausibly-short": isImplausiblyShort,
};

/**
 * A page that gave up no text is a page Redline did not read. In a PDF that is
 * usually a scanned insert or a photographed page in an otherwise typed document,
 * and it is exactly the cut a reader cannot see: the text reads as continuous
 * prose and a whole clause is simply absent from it.
 */
function hasPagesWithoutText(pages: PagesRead): boolean {
  return pages.pages > 0 && pages.pagesWithText < pages.pages;
}

const PAGE_SIGNAL_TESTS: Readonly<
  Record<PageCompletenessSignalCode, (pages: PagesRead) => boolean>
> = {
  "pages-without-text": hasPagesWithoutText,
};

/**
 * One signal is something a whole document can trip on its own: plenty of terms
 * of service are complete and have no signature block. Two at once is evidence
 * of a cut rather than of a document written that way, which is why the reading
 * has a middle and is not a boolean.
 */
function levelFor(signals: readonly CompletenessSignal[]): CompletenessLevel {
  const fired = signals.filter((signal) => signal.fired).length;
  if (fired === 0) return "whole";
  if (fired === 1) return "uncertain";
  return "partial";
}

/**
 * Reads the text and returns the assessment. Pure: the text is only measured,
 * never changed, and nothing outside this function is touched.
 *
 * `pages` is for text that came off pages, which today means a PDF. Leave it out
 * and the page signals are not weighed and not reported, which is the truth for
 * text a reader pasted.
 */
export function assessCompleteness(
  text: string,
  pages?: PagesRead,
): CompletenessAssessment {
  const signals: CompletenessSignal[] = TEXT_COMPLETENESS_SIGNAL_CODES.map((code) => ({
    code,
    fired: SIGNAL_TESTS[code](text),
  }));

  if (pages !== undefined) {
    for (const code of PAGE_COMPLETENESS_SIGNAL_CODES) {
      signals.push({ code, fired: PAGE_SIGNAL_TESTS[code](pages) });
    }
  }

  return { level: levelFor(signals), signals };
}
