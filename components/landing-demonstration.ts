/**
 * The fold's demonstration: one real reading of the example document, recorded.
 *
 * Every string in this file came out of the product. The document extracts are
 * verbatim slices of `tests/fixtures/adhesion-contract.txt`, and the flags, their
 * severity words, their confidences, their consequences, their source sentences and
 * the two questions are what the four seams returned when that fixture went through
 * them against the real model on 12 September 2026, by the path `npm run smoke`
 * runs: extract, then analyse with verification inside it, then rank, then
 * answerQuestion. Nothing here was written by hand and nothing was tidied up. The
 * awkward phrase, the missing exit and the two clause types that come back twice are
 * all what the reading actually said.
 *
 * What the run did, in full, because the fold says so and the claim has to be true:
 * the model claimed nine flags, eight had a source sentence that matched the document
 * character for character, and one did not and was dropped inside the analysis seam
 * before anything could render it. The dropped one was the liability cap in Section 6,
 * whose sentence carries two em dashes, a curly apostrophe and a non-breaking space;
 * the model retyped it instead of copying it. `src/domain/verify.ts` caught that, and
 * the fold is where the product says so out loud.
 *
 * It is data, not behaviour, and it deliberately imports nothing: the landing page
 * touches no seam (spec.md), and a page that imported the analysis types to describe
 * a recording would acquire a dependency on analysis behaviour for no gain.
 * `tests/landing.test.ts` holds it to the fixture instead, which is the only check
 * worth anything here.
 *
 * Two characters are written as escapes rather than typed, because both are invisible
 * or near enough in a code editor and both are load-bearing: U+00A0, the non-breaking
 * space the fixture carries, and U+FB01, its `fi` ligature. The fixture is
 * never normalised (ADR 0001), so a source sentence that lost either one would stop
 * matching the document and the test would fail, which is the behaviour the whole
 * product rests on.
 */

/** The three inks the fold hands out, in order. Identity, never severity. */
export type DemonstrationInk = "magenta" | "cyan" | "yellow";

/** One flag as the reading returned it, with the fold slot that shows it. */
export type DemonstrationFlag = {
  /** The fold's slot, which the stylesheet and the keyline runtime bind on. */
  readonly slot: string;
  /** Where ranking put it. Rank 1 is the worst, by leverage lost. */
  readonly rank: number;
  /** The flag's own code, handed out in the order the verified flags came back. */
  readonly code: string;
  readonly ink: DemonstrationInk;
  /** The severity word a reader reads. Severity is never carried by the ink. */
  readonly severityWord: string;
  readonly clauseTypeLabel: string;
  /** As the reading returned it, 0 to 1. Shown as a percentage, as the app shows it. */
  readonly confidence: number;
  readonly consequence: string;
  /** Verbatim from the document, and verified against it before it was returned. */
  readonly sourceSentence: string;
  /** A fact from outside the document, carrying its own source. Null where there is none. */
  readonly external: {
    readonly fact: string;
    readonly source: { readonly title: string; readonly url: string };
  } | null;
  /** A way out the document itself grants. Null where the reading returned none. */
  readonly exit: { readonly text: string; readonly sourceSentence: string } | null;
};

/**
 * What the reading did, as numbers. The fold quotes these, so they are recorded here
 * beside the flags they describe rather than typed into the copy twice.
 */
export const THE_RUN = {
  /** The example document: the fixture the deterministic suite reads too. */
  document: "adhesion-contract.txt",
  /** How much of the document the extraction seam believed it received. */
  completeness: "whole",
  characterCount: 9713,
  /** Flags the model claimed. */
  claimed: 9,
  /** Flags whose source sentence matched the document, and so were shown. */
  verified: 8,
  /** Flags dropped because their sentence did not appear in the document. */
  dropped: 1,
  /** The clause type of the dropped one, as a reader would read it. */
  droppedClauseTypeLabel: "Limitation of liability",
  /** How many of the eight the fold has room for. */
  shown: 3,
  /** The seven clause types the reading checked. */
  clauseTypesChecked: 7,
} as const;

/** The three worst flags of the eight, in rank order. */
export const DEMONSTRATION_FLAGS: readonly DemonstrationFlag[] = [
  {
    slot: "01",
    rank: 1,
    code: "F-02",
    ink: "magenta",
    severityWord: "Critical",
    clauseTypeLabel: "Unilateral modification",
    confidence: 0.97,
    consequence: "Meridian can change the rules, fees, hours, timetable and the terms of this Agreement at any time by posting the amended version at the club or on its website. The amended version applies to you from the date it is posted, and your continued use of any facility after that counts as your acceptance of it.",
    sourceSentence: "Meridian may amend the Club Rules, the Schedule of Fees, the hours of operation, the class timetable and the terms of this Agreement at any time by posting the amended version at the club or on the Meridian website, and the amended version applies to you from the date it is posted.",
    external: null,
    exit: null,
  },
  {
    slot: "02",
    rank: 2,
    code: "F-03",
    ink: "cyan",
    severityWord: "Critical",
    clauseTypeLabel: "Non-compete and restrictive covenants",
    confidence: 0.96,
    consequence: "For twelve months after your Program candidacy ends for any reason, you cannot teach, coach or deliver group fitness instruction or personal training, as an employee, contractor or on your own account, within fifteen miles of a Meridian location where you taught or trained. You also cannot solicit any Meridian member or candidate for instruction outside a Meridian location during that period.",
    sourceSentence: "For twelve (12) months after your Program candidacy ends for any reason, you will not teach, coach or deliver group \uFB01tness instruction or personal training, whether as an employee, as a contractor or on your own account, at any facility within \uFB01fteen (15) miles of a Meridian location at which you taught or trained.",
    external: {
      fact: "The Federal Trade Commission estimated that its 2024 rule on non-competes would have covered roughly 30 million workers, about 18% of everyone working in the United States.",
      source: { title: "Federal Trade Commission", url: "https://www.ftc.gov/news-events/news/press-releases/2024/04/ftc-announces-rule-banning-noncompetes" },
    },
    exit: null,
  },
  {
    slot: "03",
    rank: 3,
    code: "F-01",
    ink: "yellow",
    severityWord: "Critical",
    clauseTypeLabel: "Arbitration and class-action waiver",
    confidence: 0.98,
    consequence: "Disputes between you and Meridian are resolved by binding arbitration rather than a court, and you give up any right to a jury trial. You also give up the right to bring or take part in a class, collective or representative action. The arbitrator's decision is final and can be entered as a judgment.",
    sourceSentence: "Any dispute, claim or controversy between you and Meridian arising out of or relating to this Agreement, your membership or the Program will be resolved by \uFB01nal and binding arbitration administered by a nationally recognised arbitration provider under its consumer arbitration rules, and you and Meridian each waive any right to a trial by jury and any right to bring or participate in a class, collective or representative action.",
    external: {
      fact: "Consumers win 9% of the disputes they bring to arbitration. When the company counterclaims it wins relief 93% of the time, and the consumer ends up owing an average of $7,725.",
      source: { title: "Center for Justice & Democracy", url: "https://centerjd.org/content/fact-sheet-forced-arbitration-clauses-and-class-actions-waivers-numbers" },
    },
    exit: null,
  },];

/**
 * The parts of the document the fold shows, in the order they appear in it.
 *
 * Three sections of the fourteen, each a contiguous slice of the fixture with nothing
 * removed from the middle: `before` and `after` are the sentences that sit around the
 * one a flag was drawn from, kept so the source sentence is read in its own context
 * rather than lifted out of it.
 */
export type DocumentExtract = {
  /** The section number the document gives it. */
  readonly section: string;
  /** The fold slot whose flag quotes the marked sentence. */
  readonly slot: string;
  readonly before: string;
  /** The source sentence of this slot's flag, marked in the document. */
  readonly marked: string;
  readonly after: string;
};

/** The document's own title line, verbatim. */
export const DOCUMENT_TITLE =
  "MERIDIAN ATHLETIC CLUB — MEMBER SERVICES AND INSTRUCTOR CERTIFICATION AGREEMENT";

export const DOCUMENT_EXTRACTS: readonly DocumentExtract[] = [
  {
    section: "4.",
    slot: "01",
    before: "You agree to observe the rules posted at each location and in the Meridian mobile application (the “Club Rules”), which cover equipment use, reservation and cancellation of studio sessions, conduct towards staff and other members, and the sessions the timetable marks ‘members only’. ",
    marked: "Meridian may amend the Club Rules, the Schedule of Fees, the hours of operation, the class timetable and the terms of this Agreement at any time by posting the amended version at the club or on the Meridian website, and the amended version applies to you from the date it is posted.",
    after: " Your continued use of any facility after an amended version is posted is your acceptance of it.",
  },
  {
    section: "9.",
    slot: "02",
    before: "",
    marked: "For twelve (12) months after your Program candidacy ends for any reason, you will not teach, coach or deliver group \uFB01tness instruction or personal training, whether as an employee, as a contractor or on your own account, at any facility within \uFB01fteen (15) miles of a Meridian location at which you taught or trained.",
    after: " You will not, during that period, solicit any Meridian member or candidate for instruction outside a Meridian location. You will return the coaching manual and any Meridian teaching materials in your possession within fourteen (14) days of the end of your candidacy.",
  },
  {
    section: "12.",
    slot: "03",
    before: "",
    marked: "Any dispute, claim or controversy between you and Meridian arising out of or relating to this Agreement, your membership or the Program will be resolved by \uFB01nal and binding arbitration administered by a nationally recognised arbitration provider under its consumer arbitration rules, and you and Meridian each waive any right to a trial by jury and any right to bring or participate in a class, collective or representative action.",
    after: " You may opt out of this Section 12 by delivering written notice to the address in Section 11 within thirty\u00A0(30) days after you \uFB01rst accept this Agreement, and opting out will not affect your membership or your standing in the Program. Arbitration is conducted by a single arbitrator, the arbitrator decides the scope of this Section, and the award is \uFB01nal and may be entered as a judgment.",
  },];

/**
 * Two questions put to the same document, and what came back.
 *
 * The first was answered with the sentence it came from. The second was refused, and
 * the refusal is the sentence `components/question-view.ts` shows a reader, kept here
 * as a literal rather than imported, because importing it would reach the question
 * seam through a type and this page reaches no seam at all.
 */
export type DemonstrationQuestion = {
  readonly question: string;
  readonly answered: boolean;
  readonly says: string;
  /** Verbatim from the document, on an answer. Null on a refusal, which has none. */
  readonly sourceSentence: string | null;
};

export const DEMONSTRATION_QUESTIONS: readonly DemonstrationQuestion[] = [
  {
    question: "If I forget to cancel, am I on the hook for another whole year?",
    answered: true,
    says: "Yes, if your cancellation notice is late the document makes you liable for the next full term. It says that notice delivered less than three days before the renewal date takes effect at the end of the following twelve-month term, and that the dues for that intervening term remain payable in full.",
    sourceSentence:
      "Notice delivered after that day takes effect at the end of the term that follows, and the dues for the intervening term remain payable in full.",
  },
  {
    question: "Which state's law applies to this agreement?",
    answered: false,
    says: "Your document does not answer this. Redline answers from the text you pasted and from nothing else, so there is nothing here to show you.",
    sourceSentence: null,
  },
];
