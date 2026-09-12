/**
 * What a flag and a summary may not say, in one list.
 *
 * Two tickets need the same judgement. A summary must not tell the reader whether to
 * sign or claim something about the law (ticket 05, `summary.ts`), and neither must a
 * flag's consequence, its exit or the external fact beneath it (ticket 08, ADR 0005
 * and ADR 0007). Two lists would drift, and the one nobody watches is the one that
 * fails, so there is one list here and both callers read it.
 *
 * What this is, exactly: a list of wordings. It catches wordings. It cannot catch a
 * verdict carried by emphasis, by ordering, or by what the text leaves out, and it
 * cannot tell a sentence that reports the document from a sentence that judges it
 * except where the words themselves differ. Every entry is either unambiguously an
 * evaluation ("aggressive", "predatory") or scoped to a phrase, because single words a
 * document itself uses cannot be banned from a description of that document.
 * "reasonable" is out for exactly that reason: the fixture contract says "including
 * reasonable legal fees", and a faithful consequence is allowed to say what the
 * document says.
 *
 * Where each caller runs it. The summary runs it at analysis time and refuses the whole
 * reading when it fires (`summary.ts`), because a summary carrying a verdict poisons
 * everything under it and there is a designed state to show instead. A flag does not:
 * the consequence and the exit are held to this list by the prompt and by
 * `tests/flag-content.test.ts` over both fixtures, and nothing drops a flag at runtime
 * for a wording. That is a deliberate limit rather than an oversight. Dropping a
 * verified flag over a word match would trade a visible false positive for an invisible
 * false negative, which `PRODUCT.md` principle 4 calls the worse failure, and the same
 * check that would catch "you still have a right to cancel under state law" would also
 * catch a document that grants a right to cancel in those words. Closing that gap needs
 * a decision about which way to fail, and it is recorded here rather than guessed.
 *
 * The statutory half deserves its own note, because it is the half that is easiest to
 * get wrong in the honest direction. It looks for a claim about what the law is or
 * what the reader is entitled to: a statute, a cooling-off period, a right to cancel,
 * an enforceability judgement, a sentence about where the reader lives. It does not
 * look for the name of a regulator or of a rule, because a regulator measuring what
 * happens to people is not a statement about what the reader may do, and external
 * context is built out of exactly those measurements (`external-context.ts`).
 */

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

/** The wordings a summary is refused for, and a flag is checked against. */
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
  return findWordings(text, ALL_PATTERNS);
}

/** One pass over a list of wordings, lowercased once. */
function findWordings(
  text: string,
  patterns: readonly VerdictPattern[],
): readonly VerdictFinding[] {
  const lowered = text.toLowerCase();
  const found: VerdictFinding[] = [];
  for (const { kind, pattern } of patterns) {
    const match = pattern.exec(lowered);
    if (match !== null) found.push({ kind, matched: match[0] });
  }
  return found;
}

/**
 * Wordings that claim a right or a law, added for flags (ticket 08).
 *
 * They sit in the same kind as the summary's own law-and-rights patterns, so
 * `statutoryLanguageIn` and `verdictLanguageIn` both see them and neither has a list
 * the other lacks.
 */
const STATUTORY_PATTERNS: readonly VerdictPattern[] = [
  { kind: "claims-a-law-or-a-right", pattern: /\bcooling[-\s]off\b/u },
  { kind: "claims-a-law-or-a-right", pattern: /\brescis(?:sion|ind|inded)\b/u },
  { kind: "claims-a-law-or-a-right", pattern: /\bright\s+(?:to|of)\s+(?:cancel|cancellation|rescind|rescission|sue|refund|a refund|withdraw|withdrawal|return)\b/u },
  { kind: "claims-a-law-or-a-right", pattern: /\byou\s+(?:still\s+)?(?:have|retain|keep|hold)\s+(?:a|the|your)\s+right\b/u },
  { kind: "claims-a-law-or-a-right", pattern: /\bmay\s+still\s+(?:have|be able to|be entitled)\b/u },
  { kind: "claims-a-law-or-a-right", pattern: /\b(?:are|is|you're|you are)\s+entitled\s+to\b/u },
  { kind: "claims-a-law-or-a-right", pattern: /\bconsumer protection\b/u },
  { kind: "claims-a-law-or-a-right", pattern: /\b(?:state|federal|local)\s+(?:statutes?|regulations?|rules?)\b/u },
  { kind: "claims-a-law-or-a-right", pattern: /\bcannot\s+be\s+waived\b/u },
  { kind: "claims-a-law-or-a-right", pattern: /\bno matter what\s+(?:the|this)\s+(?:agreement|contract|document|clause)\s+says\b/u },
  { kind: "claims-a-law-or-a-right", pattern: /\bregardless of what\s+(?:the|this)\s+(?:agreement|contract|document|clause)\s+says\b/u },
  { kind: "claims-a-law-or-a-right", pattern: /\bin your (?:state|country|jurisdiction)\b/u },
];

/** Every wording the list holds, the summary's and the flag's together. */
const ALL_PATTERNS: readonly VerdictPattern[] = [...VERDICT_PATTERNS, ...STATUTORY_PATTERNS];

/**
 * The wordings in a piece of text that claim a law or a right.
 *
 * The narrow door, for a flag's consequence, its exit and its external context. No
 * statutory right appears anywhere in a flag, even where the reader holds one, because
 * asserting one moves the liability for it onto us and breaks the rule that Redline
 * states only what the document says (ADR 0005, ADR 0007).
 */
export function statutoryLanguageIn(text: string): readonly VerdictFinding[] {
  return findWordings(text, STATUTORY_PATTERNS.concat(
    VERDICT_PATTERNS.filter((held) => held.kind === "claims-a-law-or-a-right"),
  ));
}
