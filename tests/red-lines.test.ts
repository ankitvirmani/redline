import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import FlagList from "@/components/FlagList";
import { NAMED_KEY } from "@/components/RedLineMark";
import RedLines from "@/components/RedLines";
import type { Flag } from "@/src/analysis";
import { clauseType, type ClauseTypeSlug, type Lever } from "@/src/domain/clause-types";
import {
  checksNothing,
  redLineWritten,
  RED_LINE_LIMIT,
  type RedLine,
} from "@/src/domain/red-lines";
import { rank, redLinesHitBy } from "@/src/ranking";
import {
  readRedLinesReply,
  redLinesReading,
  type RedLineRow,
} from "@/src/red-lines/written";

/**
 * Red lines: they promote and they mark, and they never hide.
 *
 * Pure-function tests over flag sets and red lines built here in the file. No model, no
 * network, no database, no project. What is asserted is what a reader would observe:
 * that the condition they named is at the top of their list, in their own words, and
 * that nothing Redline found has gone missing because they named it.
 *
 * The rule under test is ADR 0008. A red line changes what the reader sees first and
 * nothing else. It does not block, veto, remove, hide, suppress, collapse, count or
 * score, and no walk-away recommendation comes out of one. Several tests here exist to
 * catch that rule being broken by a side door, which is the way it would be broken: a
 * count of how many red lines a document hit is the verdict ADR 0007 refuses, arriving
 * as a number.
 */

// ── the suite makes no network call ────────────────────────────────────────────

let fetchAttempts = 0;
const REAL_FETCH = globalThis.fetch;

beforeAll(() => {
  globalThis.fetch = ((...args: unknown[]) => {
    fetchAttempts += 1;
    void args;
    throw new Error("The deterministic suite makes no network call.");
  }) as unknown as typeof fetch;
});

afterAll(() => {
  globalThis.fetch = REAL_FETCH;
});

// ── flags and red lines, built by hand ────────────────────────────────────────

/** One flag, as analysis would have handed it over. */
function flag(
  code: string,
  slug: ClauseTypeSlug,
  over: {
    readonly band?: Flag["severity"]["band"];
    readonly leversRemoved?: readonly Lever[];
    readonly start?: number;
  } = {},
): Flag {
  const type = clauseType(slug);
  const start = over.start ?? 0;

  return {
    code,
    clauseType: slug,
    sourceSentence: {
      text: `The sentence ${code} was drawn from.`,
      at: { start, end: start + 40 },
      occurrences: 1,
    },
    severity: {
      band: over.band ?? type.baselineBand,
      baselineBand: type.baselineBand,
      movements: [],
    },
    confidence: 0.9,
    consequence: { fromTheDocument: `What ${code} does to you.`, externalContext: null },
    exit: null,
    terms: { windowToAct: null },
    leverage: { leversRemoved: over.leversRemoved ?? type.leversRemoved },
  };
}

/** One red line: the reader's words, and the clause types they are about. */
function redLine(
  id: string,
  text: string,
  clauseTypes: readonly ClauseTypeSlug[],
): RedLine {
  return { id, text, clauseTypes };
}

/** The codes, top of the list first. What a reader reads down the column. */
function codesInOrder(flags: readonly Flag[], redLines?: readonly RedLine[]): readonly string[] {
  return rank({ flags, redLines }).flags.map((ranked) => ranked.flag.code);
}

/** The set of codes that came out, which is what "nothing was hidden" is about. */
function codesPresent(flags: readonly Flag[], redLines?: readonly RedLine[]): ReadonlySet<string> {
  return new Set(rank({ flags, redLines }).flags.map((ranked) => ranked.flag.code));
}

/** The seven clause types, one flag each, in document order. */
const SEVEN: readonly Flag[] = [
  flag("F-01", "arbitration-and-class-action-waiver", { start: 100 }),
  flag("F-02", "unilateral-modification", { start: 200 }),
  flag("F-03", "non-compete", { start: 300 }),
  flag("F-04", "auto-renewal", { start: 400 }),
  flag("F-05", "limitation-of-liability", { start: 500 }),
  flag("F-06", "indemnification", { start: 600 }),
  flag("F-07", "fee-escalators-and-late-fees", { start: 700 }),
];

const NO_LOCK_IN = redLine("r-1", "I am not being locked in for a year.", ["auto-renewal"]);
const KEEP_MY_DAY_IN_COURT = redLine("r-2", "I keep the right to take them to court.", [
  "arbitration-and-class-action-waiver",
  "limitation-of-liability",
]);
const NOTHING_ABOUT_FEES = redLine("r-3", "No fee going up without my say.", [
  "fee-escalators-and-late-fees",
]);

// ── promotion ─────────────────────────────────────────────────────────────────

describe("a flag that hits a red line is read first", () => {
  it("lifts the reader's own concern above three critical clauses", () => {
    // Auto-renewal is banded high and sits behind three critical clauses for every
    // reader who has named nothing. This reader named it, so it reads first.
    expect(codesInOrder(SEVEN)[0]).toBe("F-01");
    expect(codesInOrder(SEVEN, [NO_LOCK_IN])[0]).toBe("F-04");
  });

  it("lifts the cheapest clause in the document when that is what the reader named", () => {
    // A late fee is the last thing on the list by severity, and the whole point of a
    // red line is that it is the reader's list and not only Redline's.
    const ranked = rank({ flags: SEVEN, redLines: [NOTHING_ABOUT_FEES] }).flags;
    expect(ranked[0]?.flag.code).toBe("F-07");
    expect(ranked[0]?.flag.severity.band).toBe("moderate");
    // And the rest of the list is untouched below it.
    expect(ranked.slice(1).map((one) => one.flag.code)).toEqual([
      "F-01",
      "F-02",
      "F-03",
      "F-04",
      "F-05",
      "F-06",
    ]);
  });

  it("promotes every flag of a kind the reader named, not only the first", () => {
    const flags = [
      flag("F-01", "arbitration-and-class-action-waiver", { start: 100 }),
      flag("F-02", "auto-renewal", { start: 200 }),
      flag("F-03", "auto-renewal", { start: 900 }),
    ];

    expect(codesInOrder(flags, [NO_LOCK_IN])).toEqual(["F-02", "F-03", "F-01"]);
  });

  it("numbers the list from one either way, so the badge still counts the column", () => {
    const ranks = rank({ flags: SEVEN, redLines: [NO_LOCK_IN] }).flags.map((one) => one.rank);
    expect(ranks).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });
});

// ── the order inside the promoted group ───────────────────────────────────────

describe("several promoted flags read worst first, on the same principle as the rest", () => {
  it("orders the promoted group by band, then by leverage lost, then by the document", () => {
    // The documented decision: promotion is one more key in front of the five that
    // order every reading, so the promoted group is ordered by exactly those five.
    // One principle rather than two, and no second notion of severity for red lines.
    const everything = redLine("r-all", "None of this.", [
      "arbitration-and-class-action-waiver",
      "auto-renewal",
      "indemnification",
      "fee-escalators-and-late-fees",
    ]);

    const flags = [
      flag("F-01", "fee-escalators-and-late-fees", { start: 100 }),
      flag("F-02", "indemnification", { start: 200 }),
      flag("F-03", "auto-renewal", { start: 300 }),
      flag("F-04", "arbitration-and-class-action-waiver", { start: 400 }),
    ];

    // Critical first, then the two high clauses with the one that takes a lever in
    // front of the one that takes none, then the moderate clause. The same order the
    // unpromoted list comes out in.
    expect(codesInOrder(flags, [everything])).toEqual(["F-04", "F-03", "F-02", "F-01"]);
    expect(codesInOrder(flags)).toEqual(codesInOrder(flags, [everything]));
  });

  it("does not order the promoted group by how many red lines each flag hit", () => {
    // The side door. Sorting by the number of red lines hit would be a count deciding
    // the order, and a count is a verdict in numeric form (ADR 0008). Arbitration hits
    // two of these and the late fee hits one; arbitration is first because it is
    // critical, and the late fee is last for the same reason it always is.
    const twoAboutCourt = [
      redLine("r-a", "I keep the right to sue.", ["arbitration-and-class-action-waiver"]),
      redLine("r-b", "No class-action waiver.", ["arbitration-and-class-action-waiver"]),
      NOTHING_ABOUT_FEES,
    ];

    const flags = [
      flag("F-01", "fee-escalators-and-late-fees", { start: 100 }),
      flag("F-02", "arbitration-and-class-action-waiver", { start: 200 }),
    ];

    const ranked = rank({ flags, redLines: twoAboutCourt }).flags;
    expect(ranked.map((one) => one.flag.code)).toEqual(["F-02", "F-01"]);
    expect(ranked.map((one) => one.matchedRedLines.length)).toEqual([2, 1]);

    // And with the hit counts the other way round, the order does not move either.
    const twoAboutFees = [
      redLine("r-c", "No fee going up.", ["fee-escalators-and-late-fees"]),
      redLine("r-d", "No late fee at all.", ["fee-escalators-and-late-fees"]),
      redLine("r-e", "I keep the right to sue.", ["arbitration-and-class-action-waiver"]),
    ];
    expect(codesInOrder(flags, twoAboutFees)).toEqual(["F-02", "F-01"]);
  });
});

// ── the mark ──────────────────────────────────────────────────────────────────

describe("a promoted flag is marked with the red line it hit", () => {
  it("names the red line in the reader's own words", () => {
    const ranked = rank({ flags: SEVEN, redLines: [NO_LOCK_IN] }).flags;
    const promoted = ranked[0];

    expect(promoted?.flag.code).toBe("F-04");
    expect(promoted?.matchedRedLines.map((one) => one.text)).toEqual([NO_LOCK_IN.text]);
    // The red line is carried across rather than restated, so what a reader is shown is
    // the sentence they wrote.
    expect(promoted?.matchedRedLines[0]).toBe(NO_LOCK_IN);
  });

  it("marks a flag with every red line it hit, in the order the reader wrote them", () => {
    const first = redLine("r-1", "I keep the right to sue.", [
      "arbitration-and-class-action-waiver",
    ]);
    const second = redLine("r-2", "No waiving a class action.", [
      "arbitration-and-class-action-waiver",
    ]);

    const ranked = rank({
      flags: [flag("F-01", "arbitration-and-class-action-waiver")],
      redLines: [first, second],
    }).flags;

    expect(ranked[0]?.matchedRedLines.map((one) => one.id)).toEqual(["r-1", "r-2"]);
  });

  it("marks nothing on a flag of a kind the reader did not name", () => {
    const ranked = rank({ flags: SEVEN, redLines: [NO_LOCK_IN] }).flags;
    const others = ranked.filter((one) => one.flag.code !== "F-04");

    expect(others).toHaveLength(6);
    for (const one of others) expect(one.matchedRedLines).toEqual([]);
  });

  it("marks nothing at all when the reader has named nothing", () => {
    const marks = rank({ flags: SEVEN }).flags.map((one) => one.matchedRedLines);
    expect(marks).toEqual([[], [], [], [], [], [], []]);
  });
});

// ── nothing is hidden ─────────────────────────────────────────────────────────

describe("no red line removes, hides or suppresses a flag", () => {
  const CONFIGURATIONS: readonly { readonly says: string; readonly redLines: readonly RedLine[] }[] =
    [
      { says: "no red lines at all", redLines: [] },
      { says: "one red line", redLines: [NO_LOCK_IN] },
      { says: "several red lines", redLines: [NO_LOCK_IN, KEEP_MY_DAY_IN_COURT, NOTHING_ABOUT_FEES] },
      {
        says: "a red line that hits every flag",
        redLines: [
          redLine("r-everything", "None of the seven.", [
            "arbitration-and-class-action-waiver",
            "unilateral-modification",
            "non-compete",
            "auto-renewal",
            "limitation-of-liability",
            "indemnification",
            "fee-escalators-and-late-fees",
          ]),
        ],
      },
      {
        says: "a red line that hits nothing in this document",
        redLines: [redLine("r-none", "No non-compete.", ["non-compete"])],
      },
    ];

  const WITHOUT_A_NON_COMPETE = SEVEN.filter((one) => one.clauseType !== "non-compete");
  const EVERY_CODE = new Set(WITHOUT_A_NON_COMPETE.map((one) => one.code));

  for (const { says, redLines } of CONFIGURATIONS) {
    it(`returns every flag with ${says}`, () => {
      const ranked = rank({ flags: WITHOUT_A_NON_COMPETE, redLines }).flags;

      expect(ranked).toHaveLength(WITHOUT_A_NON_COMPETE.length);
      expect(new Set(ranked.map((one) => one.flag.code))).toEqual(EVERY_CODE);
      // Contiguous from one, so nothing was dropped and a gap left where it was.
      expect(ranked.map((one) => one.rank)).toEqual([1, 2, 3, 4, 5, 6]);
    });
  }

  it("gives a reader with no red lines the same flags as a reader with a full set", () => {
    // The criterion the ticket names explicitly. Red lines change presentation, not
    // detection: the same clauses are found either way, so naming none costs nothing.
    const withNone = codesPresent(SEVEN);
    const withEvery = codesPresent(SEVEN, [
      NO_LOCK_IN,
      KEEP_MY_DAY_IN_COURT,
      NOTHING_ABOUT_FEES,
    ]);

    expect(withEvery).toEqual(withNone);
    expect(withNone.size).toBe(SEVEN.length);
  });

  it("changes only the order and the marks, and never the flags themselves", () => {
    const withNone = rank({ flags: SEVEN }).flags;
    const withRedLines = rank({ flags: SEVEN, redLines: [NO_LOCK_IN] }).flags;

    // Every flag object is the same object in both readings, so no severity, no
    // consequence and no source sentence can have been rewritten by a red line.
    for (const one of withRedLines) {
      const same = withNone.find((other) => other.flag.code === one.flag.code);
      expect(same?.flag).toBe(one.flag);
    }

    // And the order did move, so this test is not passing by nothing having happened.
    expect(withRedLines.map((one) => one.flag.code)).not.toEqual(
      withNone.map((one) => one.flag.code),
    );
  });
});

// ── no verdict, no count, no score ────────────────────────────────────────────

describe("nothing that looks like a verdict comes out of a red line", () => {
  it("returns a shape with nowhere to put one", () => {
    const ranking = rank({
      flags: SEVEN,
      redLines: [NO_LOCK_IN, KEEP_MY_DAY_IN_COURT],
      checkedClauseTypes: ["auto-renewal"],
    });

    // Two fields out of the seam, and neither is a judgement about the document: the
    // flags in the reader's order, and the clean-document reading.
    expect(Object.keys(ranking).sort()).toEqual(["cleanDocument", "flags"]);

    // Three fields on a ranked flag. No count of red lines hit, no score, no
    // recommendation, no "walk away", and no boolean standing in for one.
    for (const one of ranking.flags) {
      expect(Object.keys(one).sort()).toEqual(["flag", "matchedRedLines", "rank"]);
    }
  });

  it("says nothing about the document as a whole, however many red lines were hit", () => {
    const everything = redLine("r-all", "None of the seven.", [
      "arbitration-and-class-action-waiver",
      "unilateral-modification",
      "non-compete",
      "auto-renewal",
      "limitation-of-liability",
      "indemnification",
      "fee-escalators-and-late-fees",
    ]);

    const hitEverything = rank({ flags: SEVEN, redLines: [everything] });
    const hitNothing = rank({ flags: SEVEN, redLines: [] });

    // A document that hits all seven red lines and a document that hits none produce
    // the same two fields, the same flags, and the same clean-document reading. The
    // difference is per flag and is the reader's own words. Nothing here adds up.
    expect(Object.keys(hitEverything).sort()).toEqual(Object.keys(hitNothing).sort());
    expect(hitEverything.cleanDocument).toEqual(hitNothing.cleanDocument);
    expect(hitEverything.flags.map((one) => one.flag.code).sort()).toEqual(
      hitNothing.flags.map((one) => one.flag.code).sort(),
    );
  });

  it("does not turn a red line into a clean-document verdict either way", () => {
    // A document with no flags is clean whatever the reader named, and a document with
    // one is not, whatever they named. Red lines reach neither.
    const checked: readonly ClauseTypeSlug[] = ["auto-renewal"];
    const redLines = [NO_LOCK_IN];

    expect(rank({ flags: [], redLines, checkedClauseTypes: checked }).cleanDocument).toEqual({
      checkedClauseTypes: checked,
    });
    expect(
      rank({ flags: SEVEN, redLines, checkedClauseTypes: checked }).cleanDocument,
    ).toBeNull();
  });
});

// ── what the reader sees on a promoted flag ───────────────────────────────────

describe("the mark on the screen", () => {
  /** React escapes five characters. Undo that before matching against copy. */
  function asText(html: string): string {
    return html
      .replace(/&quot;/gu, '"')
      .replace(/&#x27;/gu, "'")
      .replace(/&#39;/gu, "'")
      .replace(/&lt;/gu, "<")
      .replace(/&gt;/gu, ">")
      .replace(/&amp;/gu, "&");
  }

  function screenFor(redLines: readonly RedLine[]): string {
    return asText(
      renderToStaticMarkup(
        createElement(FlagList, {
          flags: rank({ flags: SEVEN, redLines }).flags,
          selected: null,
          onSelect: () => undefined,
          base: "t",
        }),
      ),
    );
  }

  it("says in words which red line the flag hit", () => {
    const screen = screenFor([NO_LOCK_IN]);

    expect(screen).toContain(NAMED_KEY);
    expect(screen).toContain(NO_LOCK_IN.text);
  });

  it("says nothing about red lines to a reader who has named none", () => {
    const screen = screenFor([]);

    expect(screen).not.toContain(NAMED_KEY);
    expect(screen).toContain("Critical");
  });

  it("counts nothing, anywhere on the screen", () => {
    // The side door in its most likely form: "2 red lines hit" as a heading. Any
    // number standing next to the words "red line" is the verdict this product
    // refuses (ADR 0007, ADR 0008).
    const screen = screenFor([NO_LOCK_IN, KEEP_MY_DAY_IN_COURT, NOTHING_ABOUT_FEES]);

    expect(screen).not.toMatch(/\d+\s*red\s*lines?/iu);
    expect(screen).not.toMatch(/red\s*lines?\s*(hit|broken|matched|failed)/iu);
    expect(screen).not.toMatch(/walk\s*away|do not sign|don't sign/iu);
  });

  it("leaves the severity word where it was, on every flag", () => {
    const withNone = screenFor([]);
    const withRedLines = screenFor([NO_LOCK_IN]);

    for (const word of ["Critical", "High", "Moderate"]) {
      expect(withRedLines.includes(word)).toBe(withNone.includes(word));
    }
  });
});

// ── the reader's own list on the screen ───────────────────────────────────────

describe("the list a reader edits", () => {
  function listFor(redLines: readonly RedLine[]): string {
    return renderToStaticMarkup(createElement(RedLines, { redLines }))
      .replace(/&quot;/gu, '"')
      .replace(/&#x27;/gu, "'")
      .replace(/&#39;/gu, "'")
      .replace(/&amp;/gu, "&");
  }

  it("tells a reader with none what naming one does, and what it does not do", () => {
    const screen = listFor([]);

    expect(screen).toContain("Nothing named yet");
    // The limit, which is the part a reader has no way to guess (ADR 0008).
    expect(screen).toContain("Nothing else about the reading changes");
    // And it does not promise anything it cannot do.
    expect(screen).not.toMatch(/walk\s*away|do not sign|don't sign|block|refuse to/iu);
  });

  it("shows each red line in the reader's words, with what it is checked against", () => {
    const screen = listFor([NO_LOCK_IN, KEEP_MY_DAY_IN_COURT]);

    expect(screen).toContain(NO_LOCK_IN.text);
    expect(screen).toContain(KEEP_MY_DAY_IN_COURT.text);
    // Named in the same words Redline uses on a flag, which is what makes the matching
    // something the reader can predict.
    expect(screen).toContain("Auto-renewal and negative-option billing");
    expect(screen).toContain("Arbitration and class-action waiver");
    expect(screen).toContain("Limitation of liability");
  });

  it("gives edit and remove an accessible name that says which red line they act on", () => {
    const screen = listFor([NO_LOCK_IN]);

    // The visible label is one word; the rest of the name is read aloud and not seen.
    expect(screen).toContain(`Edit</span><span class="rl-which"> the red line: ${NO_LOCK_IN.text}`);
    expect(screen).toContain(
      `Remove</span><span class="rl-which"> the red line: ${NO_LOCK_IN.text}`,
    );
  });

  it("says of a red line that checks nothing that nothing is checked against it", () => {
    const screen = listFor([redLine("r-x", "I will not accept any of this.", [])]);

    expect(screen).toContain("Redline checks nothing against this one");
  });

  it("counts nothing on this screen either", () => {
    const screen = listFor([NO_LOCK_IN, KEEP_MY_DAY_IN_COURT, NOTHING_ABOUT_FEES]);

    expect(screen).not.toMatch(/\d+\s*red\s*lines?/iu);
    expect(screen).not.toMatch(/\bscore\b|\bverdict\b/iu);
  });
});

// ── the awkward red lines ─────────────────────────────────────────────────────

describe("a red line that is not much of one", () => {
  const arbitration = flag("F-01", "arbitration-and-class-action-waiver");

  it("does not promote or mark on a red line with no words", () => {
    // The words are what the mark shows, so a red line with none has nothing to say to
    // the reader about why a flag moved. The field refuses one, the column refuses one,
    // and this is what happens to one that arrived any other way.
    const blank = redLine("r-blank", "", ["arbitration-and-class-action-waiver"]);
    const whitespace = redLine("r-space", "   \n\t ", [
      "arbitration-and-class-action-waiver",
    ]);

    for (const one of [blank, whitespace]) {
      expect(checksNothing(one)).toBe(true);
      expect(redLinesHitBy(arbitration, [one])).toEqual([]);
    }

    // And the flag is still there, which is the part that matters.
    expect(codesInOrder([arbitration], [blank])).toEqual(["F-01"]);
  });

  it("does not promote or mark on a red line that names no clause type", () => {
    const nothingChecked = redLine("r-empty", "I will not accept any of this.", []);

    expect(checksNothing(nothingChecked)).toBe(true);
    expect(redLinesHitBy(arbitration, [nothingChecked])).toEqual([]);
  });

  it("marks a flag once when the same red line was written twice", () => {
    const once = redLine("r-1", "I keep the right to sue.", [
      "arbitration-and-class-action-waiver",
    ]);
    const again = redLine("r-2", "  I keep the right to sue.  ", [
      "arbitration-and-class-action-waiver",
    ]);
    const shouted = redLine("r-3", "I KEEP THE RIGHT TO SUE.", [
      "arbitration-and-class-action-waiver",
    ]);

    // One sentence, one mark. A flag marked three times with the same words would read
    // as the document hitting it three times, which is a count.
    const hit = redLinesHitBy(arbitration, [once, again, shouted]);
    expect(hit.map((one) => one.id)).toEqual(["r-1"]);

    // The duplicate still promotes, and still promotes once: the arbitration flag is
    // above the auto-renewal flag it would otherwise sit behind, and no further.
    const ranked = rank({
      flags: [flag("F-02", "auto-renewal", { start: 10 }), arbitration],
      redLines: [once, again],
    }).flags;
    expect(ranked.map((one) => one.flag.code)).toEqual(["F-01", "F-02"]);
    expect(ranked[0]?.matchedRedLines.map((one) => one.id)).toEqual(["r-1"]);
  });

  it("promotes a flag once however many red lines it hit", () => {
    // Three red lines about one kind of clause do not lift it three times, because
    // promotion is a key with two values and not a score.
    const flags = [flag("F-02", "auto-renewal", { start: 10 }), arbitration];
    const three = [
      redLine("r-1", "I keep the right to sue.", ["arbitration-and-class-action-waiver"]),
      redLine("r-2", "No forced arbitration.", ["arbitration-and-class-action-waiver"]),
      redLine("r-3", "No class-action waiver.", ["arbitration-and-class-action-waiver"]),
    ];

    const ranked = rank({ flags, redLines: three }).flags;
    expect(ranked.map((one) => one.flag.code)).toEqual(["F-01", "F-02"]);
    expect(ranked[0]?.matchedRedLines).toHaveLength(3);
  });
});

// ── purity ────────────────────────────────────────────────────────────────────

describe("ranking with red lines is still pure", () => {
  it("returns the same reading twice and leaves both inputs as it found them", () => {
    const flags = [
      flag("F-01", "fee-escalators-and-late-fees", { start: 10 }),
      flag("F-02", "arbitration-and-class-action-waiver", { start: 20 }),
      flag("F-03", "auto-renewal", { start: 30 }),
    ];
    const redLines = [NO_LOCK_IN, KEEP_MY_DAY_IN_COURT];

    const flagsAsHandedIn = structuredClone(flags);
    const redLinesAsHandedIn = structuredClone(redLines);

    const first = rank({ flags, redLines });
    const second = rank({ flags, redLines });

    expect(second).toEqual(first);
    expect(flags).toEqual(flagsAsHandedIn);
    expect(redLines).toEqual(redLinesAsHandedIn);
    expect(flags.map((one) => one.code)).toEqual(["F-01", "F-02", "F-03"]);
  });

  it("reads an empty list of red lines exactly as it reads being given none", () => {
    expect(rank({ flags: SEVEN, redLines: [] })).toEqual(rank({ flags: SEVEN }));
  });

  it("comes out the same from a shuffled copy of the same flags", () => {
    const shuffled = [SEVEN[3], SEVEN[6], SEVEN[0], SEVEN[5], SEVEN[2], SEVEN[4], SEVEN[1]].filter(
      (one): one is Flag => one !== undefined,
    );

    expect(codesInOrder(shuffled, [NO_LOCK_IN, NOTHING_ABOUT_FEES])).toEqual(
      codesInOrder(SEVEN, [NO_LOCK_IN, NOTHING_ABOUT_FEES]),
    );
  });
});

// ── what a reader may write ───────────────────────────────────────────────────

describe("what a red line may be", () => {
  it("keeps the reader's words, trimmed at the ends and otherwise untouched", () => {
    const written = redLineWritten({
      text: "  I am not giving up the right to sue.  ",
      clauseTypes: ["arbitration-and-class-action-waiver"],
    });

    expect(written.outcome).toBe("written");
    if (written.outcome !== "written") return;
    expect(written.writing.text).toBe("I am not giving up the right to sue.");
  });

  it("refuses one with no words, because the mark would have nothing to show", () => {
    expect(redLineWritten({ text: "", clauseTypes: ["non-compete"] }).outcome).toBe("no-words");
    expect(redLineWritten({ text: "   ", clauseTypes: ["non-compete"] }).outcome).toBe(
      "no-words",
    );
  });

  it("refuses one that names nothing to check, rather than guessing at the words", () => {
    expect(redLineWritten({ text: "No lock-in.", clauseTypes: [] }).outcome).toBe(
      "nothing-to-check",
    );
    // A clause type Redline does not check is the same as naming none: nothing here
    // invents a match, and the reader is told rather than left with a red line that
    // never fires.
    expect(
      redLineWritten({ text: "No lock-in.", clauseTypes: ["something-else-entirely"] }).outcome,
    ).toBe("nothing-to-check");
  });

  it("refuses a paragraph", () => {
    const written = redLineWritten({
      text: "x".repeat(RED_LINE_LIMIT + 1),
      clauseTypes: ["non-compete"],
    });

    expect(written.outcome).toBe("too-long");
    expect(redLineWritten({ text: "x".repeat(RED_LINE_LIMIT), clauseTypes: ["non-compete"] }).outcome).toBe(
      "written",
    );
  });

  it("puts the clause types in Redline's own order, each of them once", () => {
    const written = redLineWritten({
      text: "None of this.",
      clauseTypes: [
        "fee-escalators-and-late-fees",
        "arbitration-and-class-action-waiver",
        "fee-escalators-and-late-fees",
        "not-a-clause-type",
      ],
    });

    expect(written.outcome).toBe("written");
    if (written.outcome !== "written") return;
    expect(written.writing.clauseTypes).toEqual([
      "arbitration-and-class-action-waiver",
      "fee-escalators-and-late-fees",
    ]);
  });
});

// ── what comes back out of the table ──────────────────────────────────────────

describe("a reader's list as it is read back", () => {
  function row(
    id: string,
    text: string,
    clauseTypes: readonly string[] | null,
    writtenAt: string,
  ): RedLineRow {
    return {
      id,
      text,
      clause_types: clauseTypes === null ? null : [...clauseTypes],
      written_at: writtenAt,
    };
  }

  it("reads in the order the reader wrote them, whatever order the rows arrive in", () => {
    const reading = redLinesReading([
      row("r-3", "Third.", ["non-compete"], "2026-03-01T00:00:00Z"),
      row("r-1", "First.", ["auto-renewal"], "2026-01-01T00:00:00Z"),
      row("r-2", "Second.", ["indemnification"], "2026-02-01T00:00:00Z"),
    ]);

    expect(reading.redLines.map((one) => one.id)).toEqual(["r-1", "r-2", "r-3"]);
    expect(reading.empty).toBe(false);
  });

  it("says when the list is empty, rather than leaving a caller to count it", () => {
    expect(redLinesReading([])).toEqual({ redLines: [], empty: true });
  });

  it("keeps the words of a row whose clause types it cannot use, and checks nothing", () => {
    // A row from a later build, or one edited by hand. The reader keeps their sentence
    // and the screen says that nothing is checked against it, which is the one thing
    // that must never happen silently.
    const reading = redLinesReading([
      row("r-1", "No lock-in.", ["something-a-later-build-checks"], "2026-01-01T00:00:00Z"),
      row("r-2", "No non-compete.", null, "2026-01-02T00:00:00Z"),
    ]);

    expect(reading.redLines.map((one) => one.text)).toEqual(["No lock-in.", "No non-compete."]);
    for (const one of reading.redLines) {
      expect(one.clauseTypes).toEqual([]);
      expect(checksNothing(one)).toBe(true);
    }
  });
});

describe("the route's reply, as a screen reads it", () => {
  it("reads a list back", () => {
    const reply = readRedLinesReply({
      outcome: "listed",
      redLines: [{ id: "r-1", text: "No lock-in.", clauseTypes: ["auto-renewal"] }],
    });

    expect(reply?.outcome).toBe("listed");
    if (reply?.outcome !== "listed") return;
    expect(reply.redLines).toEqual([
      { id: "r-1", text: "No lock-in.", clauseTypes: ["auto-renewal"] },
    ]);
  });

  it("reads nothing out of a reply it does not recognise", () => {
    // A reply nobody could read must not become a list of red lines a reader believes
    // their documents are checked against.
    expect(readRedLinesReply(null)).toBeNull();
    expect(readRedLinesReply({ outcome: "something-else" })).toBeNull();
    expect(readRedLinesReply({ outcome: "listed" })).toBeNull();
    expect(readRedLinesReply({ outcome: "listed", redLines: [{ id: "r-1" }] })).toBeNull();
  });
});

// ── no network ────────────────────────────────────────────────────────────────

describe("red lines in the ranking seam", () => {
  it("made no network call and touched no database", () => {
    expect(fetchAttempts).toBe(0);
  });
});
