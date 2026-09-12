import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { Flag } from "@/src/analysis";
import { clauseType, type ClauseTypeSlug, type Lever } from "@/src/domain/clause-types";
import type { RedLine } from "@/src/domain/red-lines";
import { rank } from "@/src/ranking";

/**
 * The ranking seam. Pure-function tests over flag sets built here in the file, so
 * each test reads as the claim it is making: no fixture, no model, no network, no
 * store.
 *
 * What these assert is what a reader would observe. That arbitration is at the top of
 * their list and a late-fee clause is not. That the list does not shuffle itself
 * between two readings of the same document. That nothing Redline found goes missing
 * on the way to the screen.
 */

// ── the suite makes no network call ────────────────────────────────────────────
//
// Asserted rather than assumed, the same way the analysis suite does it. `fetch` is
// replaced for the whole file with something that counts the attempt and then fails,
// so a call would both break the test that made it and show up in the count at the
// end of the file.

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

// ── flags, built by hand ──────────────────────────────────────────────────────

/**
 * One flag, as analysis would have handed it over.
 *
 * Severity and leverage default to what the clause type carries, because that is
 * where they come from in the product, and either can be overridden to build the
 * instance a test is about.
 */
function flag(
  code: string,
  slug: ClauseTypeSlug,
  over: {
    readonly band?: Flag["severity"]["band"];
    readonly leversRemoved?: readonly Lever[];
    readonly confidence?: number;
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
    confidence: over.confidence ?? 0.9,
    consequence: { fromTheDocument: `What ${code} does to you.`, externalContext: null },
    exit: null,
    terms: { windowToAct: null },
    leverage: { leversRemoved: over.leversRemoved ?? type.leversRemoved },
  };
}

/** The codes, top of the list first. What a reader reads down the column. */
function codesInOrder(flags: readonly Flag[], redLines?: readonly RedLine[]): readonly string[] {
  return rank({ flags, redLines }).flags.map((ranked) => ranked.flag.code);
}

/** A fixed shuffle, so a failure is reproducible rather than occasional. */
function shuffled<T>(items: readonly T[]): readonly T[] {
  const out = [...items];
  let seed = 20260912;
  for (let at = out.length - 1; at > 0; at -= 1) {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    const swap = seed % (at + 1);
    const held = out[at] as T;
    out[at] = out[swap] as T;
    out[swap] = held;
  }
  return out;
}

// ── the order ─────────────────────────────────────────────────────────────────

describe("a standard clause outranks a merely unusual one", () => {
  it("puts arbitration above a late-fee clause, wherever each one sits in the document", () => {
    // The late fee comes first in the document and is the odder thing to find in a
    // gym membership. It still reads second, because what arbitration takes is the
    // reader's ability to sue and what a late fee takes is money.
    const lateFees = flag("F-01", "fee-escalators-and-late-fees", { start: 100 });
    const arbitration = flag("F-02", "arbitration-and-class-action-waiver", { start: 4000 });

    expect(codesInOrder([lateFees, arbitration])).toEqual(["F-02", "F-01"]);
  });

  it("keeps a clause that takes no lever above a cheaper one that takes none either", () => {
    // Indemnification removes no lever and is banded high on what it can cost, so
    // an order that led with the count of levers removed would drop it below a late
    // fee. The band leads, and this is the test that says so.
    const lateFees = flag("F-01", "fee-escalators-and-late-fees");
    const indemnity = flag("F-02", "indemnification");

    expect(codesInOrder([lateFees, indemnity])).toEqual(["F-02", "F-01"]);
  });

  it("reads the whole seven worst first, with the critical three at the top", () => {
    const flags = [
      flag("F-01", "fee-escalators-and-late-fees", { start: 10 }),
      flag("F-02", "indemnification", { start: 20 }),
      flag("F-03", "limitation-of-liability", { start: 30 }),
      flag("F-04", "auto-renewal", { start: 40 }),
      flag("F-05", "non-compete", { start: 50 }),
      flag("F-06", "unilateral-modification", { start: 60 }),
      flag("F-07", "arbitration-and-class-action-waiver", { start: 70 }),
    ];

    const bands = rank({ flags }).flags.map((ranked) => ranked.flag.severity.band);
    expect(bands).toEqual(["critical", "critical", "critical", "high", "high", "high", "moderate"]);
  });
});

describe("ties break on leverage lost", () => {
  it("puts the clause that takes a lever above the one that takes none, in the same band", () => {
    // Both sit in high. Auto-renewal takes the reader's ability to leave;
    // indemnification takes no lever and costs money.
    const indemnity = flag("F-01", "indemnification", { start: 10 });
    const autoRenewal = flag("F-02", "auto-renewal", { start: 900 });

    const ranked = rank({ flags: [indemnity, autoRenewal] }).flags;
    expect(ranked.map((one) => one.flag.severity.band)).toEqual(["high", "high"]);
    expect(ranked.map((one) => one.flag.code)).toEqual(["F-02", "F-01"]);
  });

  it("puts the clause that takes two levers above the one that takes one", () => {
    const takesOne = flag("F-01", "arbitration-and-class-action-waiver", {
      leversRemoved: ["sue"],
      start: 10,
    });
    const takesTwo = flag("F-02", "arbitration-and-class-action-waiver", {
      leversRemoved: ["sue", "refuse-a-change"],
      start: 900,
    });

    expect(codesInOrder([takesOne, takesTwo])).toEqual(["F-02", "F-01"]);
  });

  it("does not let leverage lost lift a clause out of its band", () => {
    const takesTwoAndCostsMoney = flag("F-01", "fee-escalators-and-late-fees", {
      leversRemoved: ["sue", "leave"],
      start: 900,
    });
    const takesNoneAndIsCritical = flag("F-02", "unilateral-modification", {
      leversRemoved: [],
      start: 10,
    });

    expect(codesInOrder([takesTwoAndCostsMoney, takesNoneAndIsCritical])).toEqual(["F-02", "F-01"]);
  });
});

describe("within a band and a lever count, the document decides", () => {
  it("reads the earlier sentence first", () => {
    const later = flag("F-01", "unilateral-modification", { start: 8000 });
    const earlier = flag("F-02", "unilateral-modification", { start: 120 });

    expect(codesInOrder([later, earlier])).toEqual(["F-02", "F-01"]);
  });
});

// ── confidence ────────────────────────────────────────────────────────────────

describe("confidence does not move the order", () => {
  it("reads the same list after every confidence value is rewritten against it", () => {
    const flags = [
      flag("F-01", "arbitration-and-class-action-waiver", { confidence: 0.99, start: 10 }),
      flag("F-02", "auto-renewal", { confidence: 0.95, start: 20 }),
      flag("F-03", "non-compete", { confidence: 0.9, start: 30 }),
      flag("F-04", "fee-escalators-and-late-fees", { confidence: 0.85, start: 40 }),
      flag("F-05", "indemnification", { confidence: 0.8, start: 50 }),
    ];

    const before = codesInOrder(flags);

    // The adversarial arrangement: the flag at the top of the list is made the one
    // Redline is least sure of, and the flag at the bottom the one it is surest of.
    // If confidence were reachable from the order, this would reverse it.
    const ranked = rank({ flags }).flags;
    const adversarial = ranked.map((one, position) => ({
      ...one.flag,
      confidence: (position + 1) / (ranked.length + 1),
    }));

    expect(codesInOrder(adversarial)).toEqual(before);
    expect(new Set(adversarial.map((one) => one.confidence)).size).toBe(flags.length);
  });
});

// ── total and stable ──────────────────────────────────────────────────────────

describe("the order is total and stable", () => {
  const flags = [
    flag("F-01", "arbitration-and-class-action-waiver", { start: 400 }),
    flag("F-02", "unilateral-modification", { start: 80 }),
    flag("F-03", "non-compete", { start: 2000 }),
    flag("F-04", "auto-renewal", { start: 60 }),
    flag("F-05", "limitation-of-liability", { start: 1200 }),
    flag("F-06", "indemnification", { start: 30 }),
    flag("F-07", "fee-escalators-and-late-fees", { start: 900 }),
  ];

  it("reads the same twice over, and the same again from a shuffled copy", () => {
    const once = codesInOrder(flags);
    const twice = codesInOrder(flags);
    const fromShuffled = codesInOrder(shuffled(flags));

    expect(twice).toEqual(once);
    expect(fromShuffled).toEqual(once);
  });

  it("decides every pair, so no two flags are left level", () => {
    // Ten shuffles of the same set. A key that left a pair undecided would let the
    // engine's own sort settle it and the list would move between readings.
    const once = codesInOrder(flags);
    for (let attempt = 0; attempt < 10; attempt += 1) {
      expect(codesInOrder(shuffled(shuffled(flags)))).toEqual(once);
    }
  });

  it("numbers the flags from one, without a gap", () => {
    const ranks = rank({ flags }).flags.map((one) => one.rank);
    expect(ranks).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });
});

// ── purity ────────────────────────────────────────────────────────────────────

describe("ranking is pure", () => {
  it("returns the same order for the same input and leaves the input as it found it", () => {
    const flags = [
      flag("F-01", "fee-escalators-and-late-fees", { start: 10 }),
      flag("F-02", "arbitration-and-class-action-waiver", { start: 20 }),
      flag("F-03", "auto-renewal", { start: 30 }),
    ];
    const asHandedIn = structuredClone(flags);

    const first = rank({ flags });
    const second = rank({ flags });

    expect(second).toEqual(first);
    expect(flags).toEqual(asHandedIn);
    expect(flags.map((one) => one.code)).toEqual(["F-01", "F-02", "F-03"]);
  });

  it("carries each flag across untouched rather than rebuilding it", () => {
    const arbitration = flag("F-01", "arbitration-and-class-action-waiver");
    const ranked = rank({ flags: [arbitration] }).flags;
    expect(ranked[0]?.flag).toBe(arbitration);
  });
});

// ── nothing is dropped ────────────────────────────────────────────────────────

describe("every flag that went in comes out", () => {
  it("returns all seven, none missing and none invented", () => {
    const flags = [
      flag("F-01", "arbitration-and-class-action-waiver", { start: 10 }),
      flag("F-02", "unilateral-modification", { start: 20 }),
      flag("F-03", "non-compete", { start: 30 }),
      flag("F-04", "auto-renewal", { start: 40 }),
      flag("F-05", "limitation-of-liability", { start: 50 }),
      flag("F-06", "indemnification", { start: 60 }),
      flag("F-07", "fee-escalators-and-late-fees", { start: 70 }),
    ];

    const ranked = rank({ flags }).flags;
    expect(ranked).toHaveLength(flags.length);
    expect(new Set(ranked.map((one) => one.flag.code))).toEqual(
      new Set(flags.map((one) => one.code)),
    );
  });

  it("returns nothing for nothing", () => {
    expect(rank({ flags: [] }).flags).toEqual([]);
  });
});

// ── red lines ─────────────────────────────────────────────────────────────────

describe("the seam takes red lines", () => {
  const flags = [
    flag("F-01", "fee-escalators-and-late-fees", { start: 10 }),
    flag("F-02", "arbitration-and-class-action-waiver", { start: 20 }),
  ];

  it("reads an empty list exactly as it reads being given none", () => {
    expect(rank({ flags, redLines: [] })).toEqual(rank({ flags }));
  });

  it("marks no flag until matching is built", () => {
    // Ticket 12 owns matching. Until it lands, every flag comes back marked against
    // nothing, which is honest: no red line matched, rather than none was checked.
    const marks = rank({ flags, redLines: [] }).flags.map((one) => one.matchedRedLines);
    expect(marks).toEqual([[], []]);
  });

  it("leaves the clean-document determination unmade", () => {
    // Ticket 07 fills this. Null is not a verdict either way.
    expect(rank({ flags }).cleanDocument).toBeNull();
    expect(rank({ flags: [] }).cleanDocument).toBeNull();
  });
});

// ── no network ────────────────────────────────────────────────────────────────

describe("the ranking seam", () => {
  it("made no network call", () => {
    expect(fetchAttempts).toBe(0);
  });
});
