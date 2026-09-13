import { readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import LandingPage from "@/app/page";
import {
  DEMONSTRATION_FLAGS,
  DEMONSTRATION_QUESTIONS,
  DOCUMENT_EXTRACTS,
  DOCUMENT_TITLE,
  THE_RUN,
} from "@/components/landing-demonstration";

/**
 * The landing page, which is the one surface whose job is persuasion.
 *
 * The most valuable test in this file is the first one: every sentence the page quotes
 * from a document appears in that document character for character. This is the page's
 * version of ADR 0001. A landing page showing a quote the document does not contain is
 * the marketing equivalent of a flag that cannot show its source sentence, and the
 * fixture is exactly the kind of document that catches it: tabs, non-breaking spaces, a
 * `fi` ligature and a line that ends in trailing whitespace, none of it normalised.
 *
 * The rest holds the page to the claims list in `PRODUCT.md`: no accuracy figure, no
 * model call, no auth, the two statements the product must always make, and the paste
 * box one click away.
 */

const ROOT = new URL("../", import.meta.url);

function repositoryFile(name: string): string {
  return readFileSync(fileURLToPath(new URL(name, ROOT)), "utf8");
}

const FIXTURE = repositoryFile("tests/fixtures/adhesion-contract.txt");

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

/** The words on the page, with the markup taken out and the entities put back. */
function visibleText(html: string): string {
  return asText(
    html
      .replace(/<(script|style)\b[\s\S]*?<\/\1>/gu, " ")
      .replace(/<!--[\s\S]*?-->/gu, "")
      .replace(/<[^>]+>/gu, ""),
  );
}

// ── the page renders with no network and no key ────────────────────────────────

let fetchAttempts = 0;
const REAL_FETCH = globalThis.fetch;

beforeAll(() => {
  globalThis.fetch = ((...args: unknown[]) => {
    fetchAttempts += 1;
    void args;
    throw new Error("The landing page makes no network call.");
  }) as unknown as typeof fetch;
});

afterAll(() => {
  globalThis.fetch = REAL_FETCH;
});

const html = renderToStaticMarkup(createElement(LandingPage));
const text = visibleText(html);

// ── every quoted sentence is really in the document ───────────────────────────

describe("every sentence the page quotes is in the document, character for character", () => {
  it("renders a document extract, so there is something to check", () => {
    expect(DOCUMENT_EXTRACTS.length).toBeGreaterThan(0);
    expect(DEMONSTRATION_FLAGS.length).toBeGreaterThan(0);
  });

  it("quotes the document's own title line", () => {
    expect(FIXTURE).toContain(DOCUMENT_TITLE);
    expect(text).toContain(DOCUMENT_TITLE);
  });

  it("shows each extract as one unbroken run of the document", () => {
    for (const extract of DOCUMENT_EXTRACTS) {
      const whole = `${extract.before}${extract.marked}${extract.after}`;
      expect(FIXTURE, `section ${extract.section} of the document`).toContain(whole);
      expect(text, `section ${extract.section} on the page`).toContain(whole);
    }
  });

  it("marks a source sentence that appears verbatim in the document", () => {
    for (const flag of DEMONSTRATION_FLAGS) {
      expect(FIXTURE, `the source sentence of ${flag.code}`).toContain(flag.sourceSentence);
      expect(text, `the source sentence of ${flag.code}, on the page`).toContain(
        flag.sourceSentence,
      );
    }
  });

  it("marks the same sentence in the document that the flag quotes", () => {
    // The mark in the document and the flag beside it are the same sentence in two
    // places. If they drifted, a reader would select a bar and watch a different
    // sentence light up, which is the failure the change bar exists to make impossible.
    for (const flag of DEMONSTRATION_FLAGS) {
      const extract = DOCUMENT_EXTRACTS.find((each) => each.slot === flag.slot);
      expect(extract, `an extract holding ${flag.code}`).toBeDefined();
      expect(extract?.marked).toBe(flag.sourceSentence);
    }
  });

  it("quotes the answered question's source sentence from the same document", () => {
    const answered = DEMONSTRATION_QUESTIONS.filter((asked) => asked.sourceSentence !== null);
    expect(answered.length).toBeGreaterThan(0);

    for (const asked of answered) {
      const sentence = asked.sourceSentence ?? "";
      expect(FIXTURE, `the sentence behind "${asked.question}"`).toContain(sentence);
      expect(text).toContain(sentence);
    }
  });

  it("shows no quotation from a document that is not this one", () => {
    // Every blockquote and every mark on the page is document text, so each one has to
    // be in the fixture. This is the assertion that would have caught the shipped
    // page's invented subscription agreement.
    const quoted = [
      ...html.matchAll(/<blockquote\b[^>]*>([\s\S]*?)<\/blockquote>/gu),
      ...html.matchAll(/<mark\b[^>]*>([\s\S]*?)<\/mark>/gu),
    ].map((match) => asText(match[1] ?? "").trim());

    expect(quoted.length).toBeGreaterThan(0);
    for (const passage of quoted) {
      expect(FIXTURE, `a quoted passage: ${passage.slice(0, 60)}`).toContain(passage);
    }
  });

  it("leaves the fixture alone", () => {
    // The fixture's oddities are the point of it, and this page reads it rather than
    // reaching for a tidier copy. Recorded here so a later edit to it fails loudly.
    expect(FIXTURE).toContain("\t");
    expect(FIXTURE).toContain("\u00A0");
    expect(FIXTURE).toContain("\uFB01");
    expect(FIXTURE.length).toBe(THE_RUN.characterCount);
  });
});

// ── no accuracy figure, anywhere ───────────────────────────────────────────────

/**
 * What this catches and what it misses, said plainly, because a check nobody can defend
 * is worse than none.
 *
 * It catches the vocabulary of a measured claim: accuracy, accurate, precision, recall,
 * benchmark, success or hit or error rate, F1, and the shapes a number arrives in, which
 * are percentages, `x out of y`, `9 in 10`, and a figure followed by the things this
 * product would be tempted to count. It runs over the page's own voice: the words the
 * page writes about itself.
 *
 * It deliberately does not run over the document extracts, which are somebody's contract
 * and carry their own figures, or over the external-context facts, which carry a
 * citation, which is the whole rule for a fact from outside the document (ADR 0007). The
 * figures in those two places are checked differently: the extracts have to be verbatim
 * document text, and each external fact's source has to resolve and be recorded in
 * `PRD.md`. Both are asserted elsewhere in this file.
 *
 * What it would miss: an accuracy claim made in words with no number and none of this
 * vocabulary, such as "Redline rarely misses a clause" or "it finds what a lawyer
 * would". Nothing mechanical catches that one, and it is the reason the sentence-level
 * audit against the claims list in `PRODUCT.md` is done by a person reading the page
 * rather than by this test. It also cannot see an image, and the page has none.
 */
const MEASURED_CLAIM =
  /\b(accuracy|accurate|accurately|precision|recall|benchmark|f1|success rate|hit rate|error rate|state of the art|industry[- ]leading)\b/iu;

const A_FIGURE = /\d+(?:\.\d+)?\s*(?:%|percent)|\b\d+\s*(?:out of|in)\s*\d+\b/iu;

/** The page's own voice: everything it says that is not quoted document text or a cited fact. */
function pageVoice(): string {
  let left = html;
  // The document, quoted.
  left = left.replace(/<article class="doc"[\s\S]*?<\/article>/u, " ");
  // The facts from outside the document, each carrying its own citation.
  left = left.replace(/<p class="flag__ext">[\s\S]*?<\/p>/gu, " ");
  // The answered question's source sentence.
  left = left.replace(/<blockquote[\s\S]*?<\/blockquote>/gu, " ");
  return visibleText(left);
}

describe("the page states no accuracy figure", () => {
  const voice = pageVoice();

  it("removed the places a figure is allowed, and kept the rest of the page", () => {
    // A vacuum check on the filter above: if it stripped everything, the two assertions
    // below would pass by having nothing to read.
    expect(voice).toContain("Redline");
    expect(voice.length).toBeGreaterThan(2000);
    expect(voice).not.toContain(DOCUMENT_TITLE);
  });

  it("uses none of the vocabulary of a measured claim", () => {
    const found = MEASURED_CLAIM.exec(voice);
    expect(found?.[0] ?? null, `the page says "${found?.[0] ?? ""}"`).toBeNull();
  });

  it("states no percentage or ratio in its own voice, except a flag's confidence", () => {
    // Confidence is a claims-list entry and is the reading's own number about one
    // clause, not a claim about how often Redline is right. It is allowed, named, and
    // checked against the recording rather than waved through.
    const withoutConfidence = voice.replace(
      /Redline is \d+% sure it read this clause for what it is\./gu,
      " ",
    );
    const found = A_FIGURE.exec(withoutConfidence);
    expect(found?.[0] ?? null, `the page states the figure "${found?.[0] ?? ""}"`).toBeNull();

    for (const flag of DEMONSTRATION_FLAGS) {
      expect(voice).toContain(`Redline is ${Math.round(flag.confidence * 100)}% sure`);
    }
  });

  it("names no reader, customer, review or case study, because none exist", () => {
    for (const word of [
      "testimonial",
      "case study",
      "our customers",
      "readers trust",
      "join thousands",
      "trusted by",
      "reviews",
      "5 stars",
    ]) {
      expect(voice.toLowerCase(), `the page says "${word}"`).not.toContain(word);
    }
  });

  it("makes no comparative quality claim, and keeps the chatbot comparison to mechanism", () => {
    for (const phrase of [
      "better than",
      "more accurate",
      "more reliable",
      "smarter than",
      "unlike other",
      "the best",
    ]) {
      expect(voice.toLowerCase(), `the page says "${phrase}"`).not.toContain(phrase);
    }

    // What it may say about a chatbot is what each tool structurally can and cannot do.
    expect(voice).toContain("chatbot");
    expect(voice).toContain("it cannot show you the sentence the answer came from");
  });

  it("claims no price, plan or availability", () => {
    for (const word of ["free trial", "per month", "pricing", "subscribe", "$"]) {
      expect(voice.toLowerCase(), `the page says "${word}"`).not.toContain(word);
    }
  });
});

// ── the two statements the product always makes ───────────────────────────────

describe("the page says what Redline will not do", () => {
  it("states that it does not give legal advice", () => {
    expect(text).toContain("It does not give legal advice");
    expect(text).toContain("does not give legal advice, and it never tells you whether to sign");
  });

  it("states that it does not account for where the reader lives", () => {
    expect(text).toContain("It does not account for where you live");
    expect(text).toContain("It will not tell you whether a clause holds where you live.");
  });

  it("never tells the reader whether to sign", () => {
    for (const phrase of [
      "do not sign",
      "don't sign",
      "walk away",
      "you should sign",
      "safe to sign",
      "we recommend",
      "you should not",
    ]) {
      expect(text.toLowerCase(), `the page says "${phrase}"`).not.toContain(phrase);
    }
  });

  it("says a flag it cannot quote is never shown, and shows that it happened", () => {
    expect(text).toContain("It will not show you a flag it cannot quote.");
    expect(text).toContain("The reading returned nine flags and kept eight.");
    expect(THE_RUN.claimed - THE_RUN.dropped).toBe(THE_RUN.verified);
  });
});

// ── the recording is the real thing, and the page shows what it says it shows ──

describe("the fold shows the reading it says it shows", () => {
  it("shows three flags of the eight, worst first", () => {
    expect(DEMONSTRATION_FLAGS.length).toBe(THE_RUN.shown);
    expect(DEMONSTRATION_FLAGS.map((flag) => flag.rank)).toEqual([1, 2, 3]);
    expect(text).toContain("The three worst of the eight flags");
  });

  it("gives each flag its severity word, its type and its confidence in words", () => {
    for (const flag of DEMONSTRATION_FLAGS) {
      expect(text, flag.code).toContain(flag.severityWord);
      expect(text, flag.code).toContain(flag.clauseTypeLabel);
      expect(text, flag.code).toContain(flag.consequence);
      expect(flag.confidence).toBeGreaterThan(0);
      expect(flag.confidence).toBeLessThanOrEqual(1);
    }
  });

  it("carries severity in the word and the order, never in the ink alone", () => {
    // The identity-not-severity rule, as a test: the three inks are all different and
    // the three severity words are readable on their own.
    const inks = DEMONSTRATION_FLAGS.map((flag) => flag.ink);
    expect(new Set(inks).size).toBe(inks.length);
    for (const flag of DEMONSTRATION_FLAGS) expect(flag.severityWord.length).toBeGreaterThan(0);
    expect(text).toContain("Colour tells one flag from another.");
  });

  it("gives every external fact its own source, recorded in PRD.md", () => {
    const prd = repositoryFile("PRD.md");
    const external = DEMONSTRATION_FLAGS.flatMap((flag) =>
      flag.external === null ? [] : [flag.external],
    );
    expect(external.length).toBeGreaterThan(0);

    for (const fact of external) {
      expect(text).toContain(fact.fact);
      expect(text).toContain(fact.source.title);
      expect(html).toContain(fact.source.url);
      expect(new URL(fact.source.url).protocol).toBe("https:");
      expect(prd, `${fact.source.url} is not recorded in PRD.md`).toContain(fact.source.url);
    }
  });

  it("marks the decoration as decoration", () => {
    // The scattered fragments and the runtime keyline carry no meaning, so a screen
    // reader is never handed them. DESIGN.md records both as aria-hidden.
    expect(html).toContain('<div class="chips" aria-hidden="true">');
    expect(html).toContain('<svg class="stage__wires" id="wires" aria-hidden="true"');
    for (const bar of ["magenta", "cyan", "yellow", "green", "white"]) {
      expect(html).toContain(`<span class="refusals__bar refusals__bar--${bar}" aria-hidden="true">`);
    }
  });
});

// ── no model, no seam, no auth ────────────────────────────────────────────────

describe("the page renders with no model call, no analysis and no account", () => {
  it("rendered the whole page without one network call", () => {
    expect(html.length).toBeGreaterThan(5000);
    expect(fetchAttempts).toBe(0);
  });

  it("renders whole on the server, so nothing waits on script", () => {
    // The default state is the resting state (DESIGN.md): the first flag is open, its
    // sentence is marked, and the page reads with JavaScript off.
    expect(html).toContain('class="flag flag--magenta is-open"');
    expect(html).toContain('aria-expanded="true"');
    expect(text).toContain(DEMONSTRATION_FLAGS[0]?.consequence ?? "");
  });

  /**
   * Nothing on this page reaches a seam, a model client or a Supabase client.
   *
   * The same walk as `tests/signed-out.test.ts`, pointed the other way: there, the
   * reading surface must not reach Supabase; here, the landing page must not reach
   * anything at all. It follows every import, including type-only ones, which is
   * stricter than the runtime needs and is the point: a type imported from a seam is a
   * dependency on analysis behaviour, and marketing copy acquiring one is exactly what
   * keeping this page outside the four seams prevents (spec.md).
   *
   * What it does not catch: a `require`, a dynamic `import()` with a computed
   * specifier, or a module this file does not name.
   */
  const FORBIDDEN = [
    "src/analysis",
    "src/extraction",
    "src/qa",
    "src/ranking",
    "src/model",
    "src/supabase",
    "src/library",
    "src/red-lines",
    "src/account",
  ] as const;

  const FORBIDDEN_PACKAGES = ["@supabase/supabase-js", "@supabase/ssr"] as const;

  const SPECIFIER =
    /(?:import|export)[\s\S]*?from\s*["']([^"']+)["']|import\s*["']([^"']+)["']/gu;
  const EXTENSIONS = ["", ".ts", ".tsx", ".js", ".jsx"] as const;

  function resolve(from: string, specifier: string): string | null {
    const root = fileURLToPath(ROOT);
    const asked = specifier.startsWith("@/")
      ? `${root}${specifier.slice(2)}`
      : specifier.startsWith(".")
        ? fileURLToPath(new URL(specifier, new URL(from, ROOT)))
        : null;
    if (asked === null) return null;

    for (const extension of EXTENSIONS) {
      try {
        if (statSync(`${asked}${extension}`).isFile()) {
          return `${asked}${extension}`.slice(root.length);
        }
      } catch {
        // Not that one.
      }
    }
    for (const index of ["/index.ts", "/index.tsx"]) {
      try {
        if (statSync(`${asked}${index}`).isFile()) return `${asked}${index}`.slice(root.length);
      } catch {
        // Not that one either.
      }
    }
    return null;
  }

  /** Every file the landing page reaches, with the chain that reached it. */
  function reachable(): ReadonlyMap<string, readonly string[]> {
    const root = fileURLToPath(ROOT);
    const chains = new Map<string, readonly string[]>([["app/page.tsx", ["app/page.tsx"]]]);
    const queue = ["app/page.tsx"];

    while (queue.length > 0) {
      const file = queue.shift();
      if (file === undefined || file.endsWith(".css")) continue;
      const chain = chains.get(file) ?? [file];

      for (const match of readFileSync(`${root}${file}`, "utf8").matchAll(SPECIFIER)) {
        const specifier = match[1] ?? match[2];
        if (specifier === undefined) continue;
        const next = resolve(file, specifier);
        const key = next ?? `package:${specifier}`;
        if (chains.has(key)) continue;
        chains.set(key, [...chain, key]);
        if (next !== null) queue.push(next);
      }
    }

    return chains;
  }

  const chains = reachable();

  it("walked something, so the rule is about something", () => {
    expect(chains.has("components/LandingRuntime.tsx")).toBe(true);
    expect(chains.has("components/landing-demonstration.ts")).toBe(true);
  });

  it("reaches no seam, no model client and no Supabase client", () => {
    for (const [file, chain] of chains) {
      for (const forbidden of FORBIDDEN) {
        expect(
          file.startsWith(forbidden),
          `${file} is reached by ${chain.join(" -> ")}`,
        ).toBe(false);
      }
    }
    for (const name of FORBIDDEN_PACKAGES) {
      expect(chains.get(`package:${name}`)).toBeUndefined();
    }
  });

  it("calls no route, from anywhere on the page", () => {
    for (const file of chains.keys()) {
      if (file.startsWith("package:") || file.endsWith(".css")) continue;
      const source = readFileSync(`${fileURLToPath(ROOT)}${file}`, "utf8");
      expect(source, `${file} calls fetch`).not.toMatch(/\bfetch\s*\(/u);
      expect(source, `${file} names an api route`).not.toContain("/api/");
    }
  });
});

// ── the routes, and the one step to the paste box ─────────────────────────────

describe("the landing page owns the root and the paste box has its own route", () => {
  function isFile(name: string): boolean {
    try {
      return statSync(fileURLToPath(new URL(name, ROOT))).isFile();
    } catch {
      return false;
    }
  }

  it("serves the landing page at the root", async () => {
    expect(isFile("app/page.tsx")).toBe(true);
    const module = (await import("@/app/page")) as { readonly default?: unknown };
    expect(typeof module.default).toBe("function");
    // The root is the landing page and not the paste box: it renders the
    // demonstration and has no field to paste into.
    expect(text).toContain("Skip to the demonstration");
    expect(html).not.toContain("<textarea");
  });

  it("serves the paste box at /analyse, and nowhere else", async () => {
    expect(isFile("app/analyse/page.tsx")).toBe(true);
    const module = (await import("@/app/analyse/page")) as { readonly default?: unknown };
    expect(typeof module.default).toBe("function");
    expect(readFileSync(fileURLToPath(new URL("app/analyse/page.tsx", ROOT)), "utf8")).toContain(
      "<textarea",
    );
  });

  it("no longer serves the landing page at /landing", () => {
    expect(isFile("app/landing/page.tsx")).toBe(false);
  });

  it("puts the paste box one click from the primary action", () => {
    // One step, from the action the page leads with: an anchor to the paste box's own
    // route, with nothing in between.
    const actions = [...html.matchAll(/<a class="btn btn--primary[^"]*" href="([^"]+)"/gu)].map(
      (match) => match[1],
    );
    expect(actions.length).toBeGreaterThan(0);
    for (const href of actions) expect(href).toBe("/analyse");
  });

  it("sends every other screen's paste link to the same place", () => {
    for (const file of [
      "components/Rail.tsx",
      "components/Gate.tsx",
      "components/LibraryList.tsx",
    ]) {
      const source = repositoryFile(file);
      expect(source, `${file} still links the paste box at the root`).not.toMatch(
        /href="\/"[\s\S]{0,80}(Paste a document|Read a document)/u,
      );
      expect(source, `${file} does not link /analyse`).toContain("/analyse");
    }
  });
});
