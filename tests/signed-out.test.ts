import { readdirSync, readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import Gate, { NO_PROJECT_KEY } from "@/components/Gate";
import { NOTHING_ASKED_YET_SAYS } from "@/components/question-view";
import Rail from "@/components/Rail";
import { NAMED_KEY } from "@/components/RedLineMark";
import Reading from "@/components/Reading";
import type { AccountState } from "@/src/account/state";
import { analyse, type DocumentAnalysis } from "@/src/analysis";
import { extract, type ExtractedDocument } from "@/src/extraction";
import { stubModelClient } from "@/src/model/stub";
import {
  configuredSupabase,
  readSupabaseConfiguration,
  SUPABASE_VARIABLES,
} from "@/src/supabase/configuration";

/**
 * The constraint the whole product rests on: a reader who is not signed in, using a
 * build with no Supabase project at all, pastes a document and reads everything it
 * costs them.
 *
 * This is the test most likely to rot, which is why it is written down rather than
 * assumed. The reader is deciding in the minutes before they accept and will not stop
 * to create an account, so a signup wall in front of the paste box would cost the
 * product its own use case. Every later change that adds a layout, a shell or a
 * header could quietly import a Supabase client into the reading surface and break it
 * without breaking anything else, and the import-graph test at the end of this file is
 * what catches that.
 *
 * Both variables are deleted from the environment for the whole file, which is also the
 * state of `.env.local` today. Nothing here needs a key, a network call or a project.
 */

// ── no project, for the whole file ────────────────────────────────────────────

const WAS: Partial<Record<(typeof SUPABASE_VARIABLES)[number], string | undefined>> = {};

// ── the suite makes no network call ────────────────────────────────────────────

let fetchAttempts = 0;
const REAL_FETCH = globalThis.fetch;

beforeAll(() => {
  for (const name of SUPABASE_VARIABLES) {
    WAS[name] = process.env[name];
    delete process.env[name];
  }

  globalThis.fetch = ((...args: unknown[]) => {
    fetchAttempts += 1;
    void args;
    throw new Error("The deterministic suite makes no network call.");
  }) as unknown as typeof fetch;
});

afterAll(() => {
  for (const name of SUPABASE_VARIABLES) {
    const was = WAS[name];
    if (was === undefined) delete process.env[name];
    else process.env[name] = was;
  }

  globalThis.fetch = REAL_FETCH;
});

// ── the document, read end to end with no project ─────────────────────────────

const ROOT = new URL("../", import.meta.url);

function repositoryFile(name: string): string {
  return readFileSync(fileURLToPath(new URL(name, ROOT)), "utf8");
}

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

/** The level word a reader reads, as `components/CompletenessReading.tsx` writes it. */
const LEVEL_WORD = { whole: "Whole", uncertain: "Uncertain", partial: "Partial" } as const;

let document: ExtractedDocument;
let analysis: DocumentAnalysis;
let screen = "";

beforeAll(async () => {
  const extraction = await extract({
    kind: "pasted-text",
    text: repositoryFile("tests/fixtures/adhesion-contract.txt"),
  });
  if (extraction.outcome !== "extracted") throw new Error("The fixture did not extract.");
  document = extraction.document;

  const read = await analyse({ document, model: stubModelClient() });
  if (read.outcome !== "analysed") throw new Error(`The fixture did not analyse: ${read.reason}.`);
  analysis = read.analysis;

  screen = asText(
    renderToStaticMarkup(createElement(Reading, { document, analysis })),
  );
});

describe("a reader with no account and no project reads the whole thing", () => {
  it("has no Supabase project to read with", () => {
    const configuration = configuredSupabase();
    expect(configuration.kind).toBe("no-project");
    if (configuration.kind === "no-project") {
      expect([...configuration.missing]).toEqual([...SUPABASE_VARIABLES]);
    }
  });

  it("reads the summary of what the document commits them to", () => {
    expect(analysis.summary.text.length).toBeGreaterThan(0);
    expect(screen).toContain(analysis.summary.text);
  });

  it("reads the completeness reading beside it", () => {
    expect(screen).toContain("Completeness");
    expect(screen).toContain(LEVEL_WORD[document.completeness.level]);
  });

  it("reads every flag, with the sentence it came from", () => {
    expect(analysis.flags.length).toBeGreaterThan(0);

    for (const flag of analysis.flags) {
      expect(screen, `the source sentence of ${flag.code}`).toContain(flag.sourceSentence.text);
      expect(screen, `the consequence of ${flag.code}`).toContain(flag.consequence.fromTheDocument);
    }
  });

  it("reads the external context and the exit on the flags that carry them", () => {
    const withContext = analysis.flags.filter((flag) => flag.consequence.externalContext !== null);
    const withExit = analysis.flags.filter((flag) => flag.exit !== null);

    // Both are asserted only over the flags that have one, and both lists are checked
    // to be non-empty, so this cannot pass by there being nothing to show.
    expect(withContext.length).toBeGreaterThan(0);
    expect(withExit.length).toBeGreaterThan(0);

    for (const flag of withContext) {
      expect(screen).toContain(flag.consequence.externalContext?.fact);
    }
    for (const flag of withExit) {
      expect(screen).toContain(flag.exit?.text);
    }
  });

  it("gets the question box, and it is asking about their document", () => {
    expect(screen).toContain("Ask about your document");
    expect(screen).toContain(NOTHING_ASKED_YET_SAYS);
  });

  it("reads the same thing with no red lines as with an empty list of them", () => {
    // A reader with no account has no red lines, and the reading must not notice. Both
    // ways through the seam are one path, so the screen comes out character for
    // character the same (ADR 0008).
    const withNone = renderToStaticMarkup(
      createElement(Reading, { document, analysis, redLines: [] }),
    );
    const withoutTheProp = renderToStaticMarkup(
      createElement(Reading, { document, analysis }),
    );

    expect(withNone).toBe(withoutTheProp);
    expect(asText(withNone)).not.toContain(NAMED_KEY);
  });

  it("made no network call to do any of it", () => {
    expect(fetchAttempts).toBe(0);
  });
});

// ── what the account-gated surfaces say instead of throwing ───────────────────

describe("with no project, the account-gated surfaces say so", () => {
  const account: AccountState = (() => {
    const configuration = configuredSupabase();
    if (configuration.kind !== "no-project") throw new Error("This file deleted both variables.");
    return { kind: "no-project", missing: configuration.missing };
  })();

  it("names the state and the two variables that are unset", () => {
    const gate = asText(
      renderToStaticMarkup(
        createElement(Gate, { account, heading: "Your library", what: "Your library" }),
      ),
    );

    expect(gate).toContain(NO_PROJECT_KEY);
    for (const name of SUPABASE_VARIABLES) expect(gate).toContain(name);
    // And it says the thing a reader on this screen most needs to know.
    expect(gate).toContain("Reading a document");
  });

  it("says the same about the red lines, which need an account for the same reason", () => {
    const gate = asText(
      renderToStaticMarkup(
        createElement(Gate, { account, heading: "Your red lines", what: "Your red lines" }),
      ),
    );

    expect(gate).toContain(NO_PROJECT_KEY);
    expect(gate).toContain("Your red lines");
    expect(gate).toContain("Reading a document");
  });

  it("says it in the rail too, beside the library the reader cannot open yet", () => {
    const rail = asText(
      renderToStaticMarkup(createElement(Rail, { current: "library", account })),
    );

    expect(rail).toContain("no Supabase project");
    expect(rail).toContain("Your library");
  });

  it("says nothing about an account while the answer is still coming", () => {
    // Null is "not known yet". A rail that guessed would either tell a signed-in
    // reader to sign in or offer a library this build has not got.
    const rail = asText(renderToStaticMarkup(createElement(Rail, { current: "paste", account: null })));

    expect(rail).not.toContain("Sign in");
    expect(rail).not.toContain("Sign out");
    expect(rail).toContain("Paste a document");
  });

  it("reads an unset variable and a whitespace one the same way", () => {
    expect(readSupabaseConfiguration({}).kind).toBe("no-project");
    expect(
      readSupabaseConfiguration({
        NEXT_PUBLIC_SUPABASE_URL: "   ",
        NEXT_PUBLIC_SUPABASE_ANON_KEY: "   ",
      }).kind,
    ).toBe("no-project");

    // Only names, never values: this is the one place in the suite that hands over
    // something shaped like a key, and it is two words nobody could authenticate with.
    expect(
      readSupabaseConfiguration({
        NEXT_PUBLIC_SUPABASE_URL: "https://example.invalid",
        NEXT_PUBLIC_SUPABASE_ANON_KEY: "not-a-key",
      }).kind,
    ).toBe("configured");
  });

  it("names one variable when only one is missing", () => {
    const one = readSupabaseConfiguration({ NEXT_PUBLIC_SUPABASE_URL: "https://example.invalid" });
    expect(one.kind).toBe("no-project");
    if (one.kind === "no-project") {
      expect([...one.missing]).toEqual(["NEXT_PUBLIC_SUPABASE_ANON_KEY"]);
    }
  });
});

// ── nothing on the analysis path imports a Supabase client ────────────────────

/**
 * What this protects, said plainly.
 *
 * The reading surface must work with no Supabase project, and the failure it is
 * exposed to is not a missing screen: it is a module. One `import` of a client in a
 * layout, a header, a shell or a hook puts `@supabase/supabase-js` into the browser
 * bundle that reads a document, and the first thing a client does with no URL and no
 * key is throw. The screen would go blank for a reader who never wanted an account,
 * and every other test in this suite would still pass, because they render components
 * rather than load the page.
 *
 * So this walks the import graph from the screens and seams on the analysis path and
 * asserts that it reaches neither Supabase package and neither client module. It
 * follows every `import` and `export ... from` in the files it reaches, including
 * type-only ones, which is stricter than the runtime needs and cheaper to trust:
 * `src/supabase/configuration.ts` imports nothing, so a type imported from it can
 * never drag a package in behind it.
 *
 * What it does not catch: a client reached by `require`, by a dynamic `import()` with
 * a computed specifier, or by a package this file does not name. Those are worth
 * knowing about, and none of them is how this breaks by accident.
 */

const FORBIDDEN_PACKAGES = ["@supabase/supabase-js", "@supabase/ssr"] as const;
const FORBIDDEN_MODULES = ["src/supabase/browser", "src/supabase/server"] as const;

/** The files the analysis path starts from: the screen, its reading, and the four seams. */
const ANALYSIS_PATH = [
  // The paste box, which ticket 14 moved to `/analyse` when the landing page took the
  // root. The root is seeded too: the landing page must not reach a client either, and
  // it is the first page a reader loads.
  "app/analyse/page.tsx",
  "app/page.tsx",
  "app/layout.tsx",
  "components/Reading.tsx",
  "components/Shell.tsx",
  // The reading surface asks a route for the reader's red lines rather than reading
  // them itself, for exactly the reason this file exists. Seeded as well as reached, so
  // the rule still holds if the paste screen ever stops importing it.
  "components/use-red-lines.ts",
  "src/extraction/index.ts",
  "src/analysis/index.ts",
  "src/ranking/index.ts",
  "src/qa/index.ts",
] as const;

const SPECIFIER = /(?:import|export)[\s\S]*?from\s*["']([^"']+)["']|import\s*["']([^"']+)["']/gu;

function specifiersIn(source: string): readonly string[] {
  const found: string[] = [];
  for (const match of source.matchAll(SPECIFIER)) {
    const specifier = match[1] ?? match[2];
    if (specifier !== undefined) found.push(specifier);
  }
  return found;
}

const EXTENSIONS = ["", ".ts", ".tsx", ".js", ".jsx"] as const;

/** A specifier as a path in this repository, or null when it is not a file here. */
function resolve(from: string, specifier: string): string | null {
  const root = fileURLToPath(ROOT);

  const asked = specifier.startsWith("@/")
    ? `${root}${specifier.slice(2)}`
    : specifier.startsWith(".")
      ? fileURLToPath(new URL(specifier, new URL(from, ROOT)))
      : null;
  if (asked === null) return null;

  for (const extension of EXTENSIONS) {
    const candidate = `${asked}${extension}`;
    try {
      if (statSync(candidate).isFile()) return candidate.slice(root.length);
    } catch {
      // Not that one.
    }
  }
  for (const index of ["/index.ts", "/index.tsx"]) {
    try {
      const candidate = `${asked}${index}`;
      if (statSync(candidate).isFile()) return candidate.slice(root.length);
    } catch {
      // Not that one either.
    }
  }
  return null;
}

/** Every file the analysis path reaches, with the chain that reached it. */
function reachable(): ReadonlyMap<string, readonly string[]> {
  const root = fileURLToPath(ROOT);
  const chains = new Map<string, readonly string[]>();
  const queue: string[] = [];

  for (const seed of ANALYSIS_PATH) {
    chains.set(seed, [seed]);
    queue.push(seed);
  }

  while (queue.length > 0) {
    const file = queue.shift();
    if (file === undefined) continue;
    const chain = chains.get(file) ?? [file];
    if (file.endsWith(".css")) continue;

    const source = readFileSync(`${root}${file}`, "utf8");
    for (const specifier of specifiersIn(source)) {
      const next = resolve(file, specifier);
      const key = next ?? `package:${specifier}`;
      if (chains.has(key)) continue;
      chains.set(key, [...chain, key]);
      if (next !== null) queue.push(next);
    }
  }

  return chains;
}

describe("the analysis path imports no Supabase client", () => {
  const chains = reachable();

  it("starts from files that exist, so the walk is walking something", () => {
    for (const seed of ANALYSIS_PATH) expect(chains.has(seed)).toBe(true);
    // A sanity check on the walker itself: the paste screen at `/analyse` reaches the
    // extraction seam, which it does through two imports and a re-export.
    expect(chains.has("src/domain/verify.ts")).toBe(true);
    expect(chains.size).toBeGreaterThan(ANALYSIS_PATH.length);
  });

  it("reaches neither Supabase package", () => {
    for (const name of FORBIDDEN_PACKAGES) {
      const chain = chains.get(`package:${name}`);
      expect(chain, chain === undefined ? "" : `reached by ${chain.join(" -> ")}`).toBeUndefined();
    }
  });

  it("reaches neither client module", () => {
    for (const module of FORBIDDEN_MODULES) {
      for (const extension of [".ts", ".tsx"]) {
        const chain = chains.get(`${module}${extension}`);
        expect(chain, chain === undefined ? "" : `reached by ${chain.join(" -> ")}`).toBeUndefined();
      }
    }
  });

  it("names the client modules that do exist, so the rule is about something", () => {
    // If both files were renamed, the two assertions above would pass by vacuum.
    const clients = readdirSync(`${fileURLToPath(ROOT)}src/supabase`);
    expect(clients).toContain("browser.ts");
    expect(clients).toContain("server.ts");
  });
});

// ── the screens themselves load with no project ───────────────────────────────

describe("every screen loads with both variables unset", () => {
  it("loads the paste screen, which is the one that must never need a project", async () => {
    const module = await import("@/app/analyse/page");
    expect(typeof module.default).toBe("function");
  });

  it("loads the landing page at the root, which needs no project either", async () => {
    const module = (await import("@/app/page")) as { readonly default?: unknown };
    expect(typeof module.default).toBe("function");
  });

  it("loads the screens behind sign-in, which say so rather than failing to load", async () => {
    for (const screen of ["@/app/library/page", "@/app/red-lines/page", "@/app/sign-in/page"]) {
      const module = (await import(screen)) as { readonly default?: unknown };
      expect(typeof module.default, screen).toBe("function");
    }
  });

  it("loads the routes the account path is built on", async () => {
    const account = (await import("@/app/api/account/route")) as { readonly GET?: unknown };
    const library = (await import("@/app/api/library/route")) as { readonly POST?: unknown };
    expect(typeof account.GET).toBe("function");
    expect(typeof library.POST).toBe("function");
  });

  it("loads the red-lines route, which the reading surface asks and the screen writes to", async () => {
    const redLines = (await import("@/app/api/red-lines/route")) as {
      readonly GET?: unknown;
      readonly POST?: unknown;
      readonly PUT?: unknown;
      readonly DELETE?: unknown;
    };

    for (const [name, handler] of Object.entries(redLines)) {
      if (["GET", "POST", "PUT", "DELETE"].includes(name)) {
        expect(typeof handler, name).toBe("function");
      }
    }
    expect(typeof redLines.GET).toBe("function");
    expect(typeof redLines.DELETE).toBe("function");
  });
});
