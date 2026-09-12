/**
 * The summary, and what code can check about it before a reader sees it.
 *
 * The summary is the one thing the model returns that is not a span. A flag is held
 * against the document character for character and dropped when it does not match
 * (`verify.ts`), and that mechanism cannot reach prose: there is nothing to hold a
 * paraphrase against. So the checks here are narrower than the citation rule, and
 * this file says exactly how far each one goes. What it does not do is pretend the
 * prompt is a guarantee.
 *
 * Three checks, two of them blocking:
 *
 * 1. Usable at all. Whitespace with a length, or something far longer than a
 *    summary, is not a summary. Blocking.
 * 2. No verdict. A recommendation about signing, a judgement of the document's
 *    character, a reassurance, or a claim about the law is refused, and the whole
 *    analysis fails rather than rendering without a summary. This is a list of
 *    wordings, so it catches wordings. It cannot catch a verdict carried by
 *    emphasis, by ordering, or by what the summary leaves out. Blocking.
 * 3. Figures. A number the summary states has to appear in the document, as digits
 *    or in words. Advisory: it records a defect and the summary still renders,
 *    because the check cannot tell a fabricated figure from a lawful rewording
 *    ("once a year" for "annually"), and refusing on that would cost the reader
 *    every verified flag on the screen.
 *
 * Why refusing rather than trimming, for the two blocking checks. There is no
 * honest way to edit a verdict out of a paragraph in code: strike the sentence and
 * what is left is a summary nobody wrote. A reader is better served by the state
 * the shell already has copy for than by a summary that has been quietly cut.
 */

import type { Summary } from "./types";

/** Why a summary cannot be shown. */
export const SUMMARY_REFUSALS = ["unusable", "carries-a-verdict"] as const;

export type SummaryRefusal = (typeof SUMMARY_REFUSALS)[number];

/** Longer than this is not a summary of a document, it is a second document. */
export const SUMMARY_CHARACTER_LIMIT = 1600;

/** The kinds of verdict the wording check looks for. */
export const VERDICT_KINDS = [
  /** Tells the reader what to do about the document. */
  "tells-the-reader-what-to-do",
  /** Judges the document's character rather than reporting its terms. */
  "judges-the-document",
  /** Reassures the reader, which is a verdict that reads as a kindness. */
  "reassures-the-reader",
  /** Claims something about the law, a right, or where the reader lives (ADR 0005). */
  "claims-a-law-or-a-right",
] as const;

export type VerdictKind = (typeof VERDICT_KINDS)[number];

/** One thing the check found, and the words it found. */
export type VerdictFinding = {
  readonly kind: VerdictKind;
  /** The matched words, lowercased. Used by tests and never logged. */
  readonly matched: string;
};

type VerdictPattern = { readonly kind: VerdictKind; readonly pattern: RegExp };

/**
 * The wordings.
 *
 * Every entry is either unambiguously an evaluation ("aggressive", "predatory") or
 * scoped to a phrase, because single words a document itself uses cannot be banned
 * from a summary of that document. "reasonable" is out for exactly that reason: the
 * fixture contract says "including reasonable legal fees", and a faithful summary is
 * allowed to say what the document says.
 */
const VERDICT_PATTERNS: readonly VerdictPattern[] = [
  // ── tells the reader what to do ─────────────────────────────────────────────
  { kind: "tells-the-reader-what-to-do", pattern: /\b(?:do not|don't|never|shouldn't|should not)\s+(?:sign|accept|agree to)\b/u },
  { kind: "tells-the-reader-what-to-do", pattern: /\byou\s+(?:should|shouldn't|ought to|may want to|might want to|will want to|would be wise to)\b/u },
  { kind: "tells-the-reader-what-to-do", pattern: /\b(?:we|redline|i)\s+(?:recommend|advise|suggest|would suggest|would recommend)\b/u },
  { kind: "tells-the-reader-what-to-do", pattern: /\b(?:recommend|advise|suggest)(?:s|ed|ing)?\s+(?:that\s+)?(?:you|against|signing|not signing)\b/u },
  { kind: "tells-the-reader-what-to-do", pattern: /\b(?:think|read|consider|proceed|tread)\s+(?:carefully|closely|twice|cautiously)\b/u },
  { kind: "tells-the-reader-what-to-do", pattern: /\bwith caution\b/u },
  { kind: "tells-the-reader-what-to-do", pattern: /\bbe\s+(?:careful|wary|cautious|aware)\b/u },
  { kind: "tells-the-reader-what-to-do", pattern: /\b(?:walk away|steer clear|shop around|look elsewhere|push back)\b/u },
  { kind: "tells-the-reader-what-to-do", pattern: /\bnegotiat(?:e|ing)\b/u },
  { kind: "tells-the-reader-what-to-do", pattern: /\bask\s+(?:them|the club|the company|the employer)\s+to\s+(?:change|remove|strike|drop)\b/u },
  { kind: "tells-the-reader-what-to-do", pattern: /\b(?:seek|get)\s+(?:legal\s+)?advice\b/u },
  { kind: "tells-the-reader-what-to-do", pattern: /\b(?:consult|talk to|speak to|see)\s+(?:a|an|your)\s+(?:lawyer|attorney|solicitor)\b/u },
  { kind: "tells-the-reader-what-to-do", pattern: /\bmake sure you\b/u },
  { kind: "tells-the-reader-what-to-do", pattern: /\byour\s+(?:best|only)\s+(?:option|bet|choice)\b/u },
  { kind: "tells-the-reader-what-to-do", pattern: /\b(?:worth|not worth)\s+(?:signing|accepting|the risk)\b/u },

  // ── judges the document ─────────────────────────────────────────────────────
  { kind: "judges-the-document", pattern: /\b(?:aggressive(?:ly)?|one-sided|lopsided|onerous|draconian|predatory|egregious|unconscionable|exploitative|abusive|oppressive|harsh|brutal|punishing|sweeping|far-reaching|burdensome)\b/u },
  { kind: "judges-the-document", pattern: /\b(?:unfair|inequitable|not fair)\b/u },
  { kind: "judges-the-document", pattern: /\b(?:risky|dangerous|concerning|troubling|alarming|worrying|worrisome|ominous)\b/u },
  { kind: "judges-the-document", pattern: /\bred flags?\b/u },
  { kind: "judges-the-document", pattern: /\b(?:unusual|unusually|remarkable|extraordinary|extreme)\b/u },
  { kind: "judges-the-document", pattern: /\b(?:fairly|pretty|quite|entirely|fully|reasonably|largely)\s+standard\b/u },
  { kind: "judges-the-document", pattern: /\bstandard\s+(?:agreement|contract|terms|language|clause|practice|for)\b/u },
  { kind: "judges-the-document", pattern: /\b(?:industry standard|boilerplate|run of the mill)\b/u },
  { kind: "judges-the-document", pattern: /\btypical\s+(?:of|for)\b/u },
  { kind: "judges-the-document", pattern: /\b(?:not uncommon|common in|as you would expect|as you'd expect|out of the ordinary)\b/u },
  { kind: "judges-the-document", pattern: /\bfavou?r(?:s|able|ably|ing)\b/u },
  { kind: "judges-the-document", pattern: /\bin\s+(?:their|its|the club's|the company's|meridian's)\s+favou?r\b/u },
  { kind: "judges-the-document", pattern: /\b(?:stacked|weighted|tilted)\s+(?:against|toward|towards|in)\b/u },
  { kind: "judges-the-document", pattern: /\ball\s+the\s+(?:power|leverage|rights|cards)\b/u },
  { kind: "judges-the-document", pattern: /\blittle\s+(?:in return|recourse|protection)\b/u },

  // ── reassures the reader ────────────────────────────────────────────────────
  { kind: "reassures-the-reader", pattern: /\bnothing\s+(?:to worry about|untoward|alarming|surprising|here to)\b/u },
  { kind: "reassures-the-reader", pattern: /\bno\s+(?:cause|reason)\s+for\s+concern\b/u },
  { kind: "reassures-the-reader", pattern: /\b(?:no need to worry|don't worry|rest assured|no surprises|good news)\b/u },
  { kind: "reassures-the-reader", pattern: /\byou(?:\s+are|'re)\s+(?:protected|covered|fine|safe)\b/u },
  { kind: "reassures-the-reader", pattern: /\bsafe\s+to\s+(?:sign|accept|agree)\b/u },
  { kind: "reassures-the-reader", pattern: /\b(?:harmless|benign|innocuous)\b/u },

  // ── claims a law or a right ─────────────────────────────────────────────────
  { kind: "claims-a-law-or-a-right", pattern: /\b(?:un)?enforceable\b/u },
  { kind: "claims-a-law-or-a-right", pattern: /\b(?:is|are|would be|may be|probably)\s+(?:legally\s+)?(?:void|invalid|illegal|unlawful|legal|lawful)\b/u },
  { kind: "claims-a-law-or-a-right", pattern: /\bstatut(?:e|es|ory)\b/u },
  { kind: "claims-a-law-or-a-right", pattern: /\b(?:state|federal|local|consumer protection)\s+law\b/u },
  { kind: "claims-a-law-or-a-right", pattern: /\bthe law\s+(?:in|where)\b/u },
  { kind: "claims-a-law-or-a-right", pattern: /\b(?:where you live|your state|your jurisdiction|in most states)\b/u },
  { kind: "claims-a-law-or-a-right", pattern: /\b(?:statutory|legal)\s+rights?\b/u },
  { kind: "claims-a-law-or-a-right", pattern: /\bcourts?\s+(?:have|has|will|would|often|usually|generally)\b/u },
];

/**
 * Every verdict wording in a piece of text, in the order the patterns run.
 *
 * Exported so that the check can be read and tested on its own, and so that a test
 * can state both what it catches and what it does not.
 */
export function verdictLanguageIn(text: string): readonly VerdictFinding[] {
  const lowered = text.toLowerCase();
  const found: VerdictFinding[] = [];
  for (const { kind, pattern } of VERDICT_PATTERNS) {
    const match = pattern.exec(lowered);
    if (match !== null) found.push({ kind, matched: match[0] });
  }
  return found;
}

// ── figures ───────────────────────────────────────────────────────────────────

const ONES = [
  "zero",
  "one",
  "two",
  "three",
  "four",
  "five",
  "six",
  "seven",
  "eight",
  "nine",
  "ten",
  "eleven",
  "twelve",
  "thirteen",
  "fourteen",
  "fifteen",
  "sixteen",
  "seventeen",
  "eighteen",
  "nineteen",
] as const;

const TENS = ["twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"] as const;

/** The English for a whole number under a hundred, or null above it. */
function spell(value: number): readonly string[] {
  if (value < 20) {
    const word = ONES[value];
    return word === undefined ? [] : [word];
  }
  if (value > 99) return [];
  const ten = TENS[Math.floor(value / 10) - 2];
  if (ten === undefined) return [];
  const unit = value % 10;
  if (unit === 0) return [ten];
  const one = ONES[unit];
  return one === undefined ? [] : [`${ten}-${one}`, `${ten} ${one}`];
}

const SPELLED_VALUES = new Map<string, number>();
for (const [value, word] of ONES.entries()) SPELLED_VALUES.set(word, value);
for (const [index, word] of TENS.entries()) {
  const ten = (index + 2) * 10;
  SPELLED_VALUES.set(word, ten);
  for (const [unit, one] of ONES.entries()) {
    if (unit === 0) continue;
    SPELLED_VALUES.set(`${word}-${one}`, ten + unit);
    SPELLED_VALUES.set(`${word} ${one}`, ten + unit);
  }
}

const SPELLED_NUMBER =
  /\b(?:twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety)(?:[- ](?:one|two|three|four|five|six|seven|eight|nine))?\b|\b(?:two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen)\b/gu;

/** A number the summary states, as it was written and as a value. */
export type Figure = {
  /** The words or digits as the summary wrote them. */
  readonly written: string;
  readonly value: number;
};

/**
 * The figures a piece of text states.
 *
 * Two things are deliberately left out. "One" and "a", because a single unit is
 * ordinary English rather than a figure read off the document ("one arbitrator
 * instead of a court"), and treating it as a figure would put the check at the mercy
 * of a document that happens never to write the digit. And anything followed by
 * hundred, thousand or million, because this reads numbers rather than parses them,
 * and a figure it cannot read reliably is one it must not judge.
 */
export function figuresIn(text: string): readonly Figure[] {
  const figures: Figure[] = [];
  const seen = new Set<number>();

  const add = (written: string, value: number) => {
    if (!Number.isFinite(value) || seen.has(value)) return;
    seen.add(value);
    figures.push({ written, value });
  };

  for (const match of text.matchAll(/\d[\d,]*(?:\.\d+)?/gu)) {
    const written = match[0];
    const ends = (match.index ?? 0) + written.length;
    const after = text.slice(ends, ends + 12).toLowerCase();
    if (/^\s*(?:hundred|thousand|million|billion)\b/u.test(after)) continue;
    add(written, Number(written.replace(/,/gu, "")));
  }

  const lowered = text.toLowerCase();
  for (const match of lowered.matchAll(SPELLED_NUMBER)) {
    const written = match[0];
    const ends = (match.index ?? 0) + written.length;
    const after = lowered.slice(ends, ends + 12);
    if (/^[\s-]*(?:hundred|thousand|million|billion)\b/u.test(after)) continue;
    const value = SPELLED_VALUES.get(written);
    if (value !== undefined) add(written, value);
  }

  return figures;
}

/** Whether a whole number appears in a piece of text, as digits or in words. */
function appearsAsANumber(text: string, value: number): boolean {
  const digits = String(value);
  const grouped = value >= 1000 ? value.toLocaleString("en-US") : null;
  const lowered = text.toLowerCase();

  const asDigits = new RegExp(`(?<!\\d)${digits}(?!\\d)`, "u");
  if (asDigits.test(text)) return true;
  if (grouped !== null && text.includes(grouped)) return true;

  return spell(value).some((word) => new RegExp(`\\b${word.replace(/[- ]/gu, "[- ]")}\\b`, "u").test(lowered));
}

/**
 * The figures a summary states that the document does not, as the summary wrote
 * them. Empty means every figure in the summary is somewhere in the document.
 *
 * This is not the citation rule. It says a number is present, not that it is used
 * for what the document uses it for: a summary that reads the twelve month renewal
 * as a twelve month notice period passes this check and is still wrong.
 */
export function figuresNotInTheDocument(
  documentText: string,
  summaryText: string,
): readonly string[] {
  return figuresIn(summaryText)
    .filter((figure) => !appearsAsANumber(documentText, figure.value))
    .map((figure) => figure.written);
}

// ── the door ──────────────────────────────────────────────────────────────────

/** What came of reading one summary against one document. */
export type SummaryReading =
  | {
      readonly ok: true;
      readonly summary: Summary;
      /** Figures the document does not contain. Recorded, not refused. */
      readonly ungroundedFigures: readonly string[];
    }
  | { readonly ok: false; readonly refusal: SummaryRefusal };

/**
 * The summary, checked. The only way a `Summary` is built, so no render path can
 * hold one that skipped the checks.
 */
export function readSummary(documentText: string, text: string): SummaryReading {
  const trimmed = text.trim();
  if (trimmed.length === 0 || trimmed.length > SUMMARY_CHARACTER_LIMIT) {
    return { ok: false, refusal: "unusable" };
  }
  if (verdictLanguageIn(trimmed).length > 0) {
    return { ok: false, refusal: "carries-a-verdict" };
  }
  return {
    ok: true,
    summary: { text: trimmed },
    ungroundedFigures: figuresNotInTheDocument(documentText, trimmed),
  };
}
