/**
 * The real client's own behaviour, with the network replaced at the boundary.
 *
 * What is under test here is what the client sends and what it does with what comes
 * back. The network is the boundary of that, not the thing being tested, so `fetch` is
 * replaced and the request is read out of the call. That is the opposite of mocking the
 * thing under test: nothing here stubs the client, and every assertion is about a
 * decision the client made.
 *
 * The request shape is pinned rather than merely plausible. `allow_fallbacks: false` and
 * `require_parameters: true` are what make OpenRouter refuse a request it cannot serve
 * exactly as asked, instead of rerouting to a provider that ignores the response format
 * and answers in prose. A run that failed because of them is the behaviour the product
 * wants; a later change that relaxed them to get a green run would be the silent
 * degradation ADR 0001 exists to prevent, and would pass every other test in the suite.
 *
 * The last group is a search of the committed source tree. It protects the criterion
 * most likely to be broken by a careless later change: the model id is read from one
 * environment variable, and appears in no file that is checked in. Nothing else in the
 * suite can catch that, because a hardcoded model id works.
 */

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { afterEach, beforeEach, describe, expect, test } from "vitest";

import { FAILURE_OF, MODEL_FAULTS, ModelCallError, type ModelClient } from "@/src/model/client";
import { PROVIDER, REASONING, openRouterClient } from "@/src/model/openrouter";

const ROOT = fileURLToPath(new URL("../", import.meta.url));

// A model id shaped like OpenRouter's and belonging to nobody. It is made up on purpose:
// asserting that this string reaches the request body is what proves the id is read out
// of the environment rather than written into the client.
const MADE_UP_MODEL = "nobody/nothing-at-all";
const MADE_UP_KEY = "sk-or-v1-not-a-key";

const A_SCHEMA = { name: "a_shape", json: { type: "object" } };

const A_REQUEST = {
  purpose: "analysis",
  instructions: "Read this.",
  input: "A document.",
  schema: A_SCHEMA,
} as const;

// ── the boundary ──────────────────────────────────────────────────────────────

type Call = { readonly url: string; readonly init: RequestInit };

let calls: Call[] = [];
const REAL_MODEL = process.env.OPENROUTER_MODEL;
const REAL_KEY = process.env.OPENROUTER_API_KEY;

/**
 * The real `fetch`, wrapped in a counter and put back at the end of the file.
 *
 * The wrapper is what the counter counts: if anything in this file reached the network
 * instead of the replacement below, `networkAttempts` would not be zero and the last
 * test in the file fails. The whole suite is meant to need no key and open no socket,
 * and this is the file where that would be easiest to lose.
 */
let networkAttempts = 0;
const REAL_FETCH = globalThis.fetch;
const COUNTED_REAL_FETCH = ((...args: Parameters<typeof fetch>) => {
  networkAttempts += 1;
  return REAL_FETCH(...args);
}) as typeof fetch;

/** How many requests the replacement answered across the whole file. Never reset. */
let requestsAnswered = 0;

/** Replaces `fetch` with something that records the call and answers as told. */
function answering(answer: () => Promise<Response> | Response): void {
  globalThis.fetch = ((url: string, init: RequestInit) => {
    requestsAnswered += 1;
    calls.push({ url, init });
    return Promise.resolve(answer());
  }) as unknown as typeof fetch;
}

/** A 200 carrying a chat completion whose content is the given JSON. */
function completionOf(content: unknown): Response {
  return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(content) } }] }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

/** The body of the one call that was made, parsed. */
function bodySent(): Record<string, unknown> {
  const call = calls[0];
  if (call === undefined) throw new Error("Nothing was sent.");
  return JSON.parse(String(call.init.body)) as Record<string, unknown>;
}

/** The error a call raised, or a failure saying it did not raise one. */
async function faultOf(client: ModelClient): Promise<string> {
  try {
    await client.complete(A_REQUEST);
  } catch (error) {
    if (error instanceof ModelCallError) return error.fault;
    throw error;
  }
  throw new Error("The call succeeded where it should have failed.");
}

beforeEach(() => {
  calls = [];
  process.env.OPENROUTER_MODEL = MADE_UP_MODEL;
  process.env.OPENROUTER_API_KEY = MADE_UP_KEY;
  answering(() => completionOf({ anything: true }));
});

afterEach(() => {
  globalThis.fetch = COUNTED_REAL_FETCH;
  if (REAL_MODEL === undefined) delete process.env.OPENROUTER_MODEL;
  else process.env.OPENROUTER_MODEL = REAL_MODEL;
  if (REAL_KEY === undefined) delete process.env.OPENROUTER_API_KEY;
  else process.env.OPENROUTER_API_KEY = REAL_KEY;
});

// ── what it sends ─────────────────────────────────────────────────────────────

describe("the request the client sends", () => {
  test("carries the model the environment names, so the id is read and not written in", async () => {
    await openRouterClient().complete(A_REQUEST);

    expect(bodySent().model).toBe(MADE_UP_MODEL);
  });

  test("pins the provider so a request that cannot be served as asked is refused", async () => {
    await openRouterClient().complete(A_REQUEST);

    expect(bodySent().provider).toEqual({
      order: ["fireworks"],
      allow_fallbacks: false,
      require_parameters: true,
    });
    // The same object the client exports, so a drifted copy fails here too.
    expect(bodySent().provider).toEqual(PROVIDER);
  });

  test("asks for low reasoning effort", async () => {
    await openRouterClient().complete(A_REQUEST);

    expect(bodySent().reasoning).toEqual({ effort: "low" });
    expect(bodySent().reasoning).toEqual(REASONING);
  });

  test("sends the caller's schema as a strict json_schema response format", async () => {
    await openRouterClient().complete(A_REQUEST);

    expect(bodySent().response_format).toEqual({
      type: "json_schema",
      json_schema: { name: "a_shape", strict: true, schema: { type: "object" } },
    });
  });

  test("puts the instructions in the system message and the document in the user message", async () => {
    await openRouterClient().complete(A_REQUEST);

    expect(bodySent().messages).toEqual([
      { role: "system", content: "Read this." },
      { role: "user", content: "A document." },
    ]);
  });

  test("goes to OpenRouter's chat completions endpoint and signs the request", async () => {
    await openRouterClient().complete(A_REQUEST);

    const call = calls[0];
    expect(call?.url).toBe("https://openrouter.ai/api/v1/chat/completions");
    expect(call?.init.method).toBe("POST");
    expect((call?.init.headers as Record<string, string>).Authorization).toBe(`Bearer ${MADE_UP_KEY}`);
  });

  test("hands back the parsed content, untouched and untrusted", async () => {
    answering(() => completionOf({ summary: "Anything at all.", flags: [] }));

    const reply = await openRouterClient().complete(A_REQUEST);

    expect(reply.json).toEqual({ summary: "Anything at all.", flags: [] });
  });
});

// ── what is missing ───────────────────────────────────────────────────────────

describe("a variable that is not set", () => {
  test("a missing model is its own fault, raised before anything is sent", async () => {
    delete process.env.OPENROUTER_MODEL;

    expect(await faultOf(openRouterClient())).toBe("no-model-configured");
    expect(calls).toHaveLength(0);
  });

  test("a missing key is its own fault, raised before anything is sent", async () => {
    delete process.env.OPENROUTER_API_KEY;

    expect(await faultOf(openRouterClient())).toBe("no-key-configured");
    expect(calls).toHaveLength(0);
  });

  test("an empty variable counts as missing rather than as a model called the empty string", async () => {
    process.env.OPENROUTER_MODEL = "";

    expect(await faultOf(openRouterClient())).toBe("no-model-configured");
    expect(calls).toHaveLength(0);
  });

  test("both missing reports the model first, because that is the variable to set first", async () => {
    delete process.env.OPENROUTER_MODEL;
    delete process.env.OPENROUTER_API_KEY;

    expect(await faultOf(openRouterClient())).toBe("no-model-configured");
  });

  test("either one leaves the reader in the state the seams have copy for", () => {
    expect(FAILURE_OF["no-model-configured"]).toBe("not-configured");
    expect(FAILURE_OF["no-key-configured"]).toBe("not-configured");
  });
});

// ── what comes back ───────────────────────────────────────────────────────────

describe("a reply the client cannot use", () => {
  test("a body that is not JSON is its own fault", async () => {
    answering(() => new Response("<html>Bad gateway</html>", { status: 200 }));

    expect(await faultOf(openRouterClient())).toBe("reply-not-json");
  });

  test("a body that is JSON and is not a chat completion is its own fault", async () => {
    answering(() => new Response(JSON.stringify({ choices: [] }), { status: 200 }));

    expect(await faultOf(openRouterClient())).toBe("reply-off-schema");
  });

  test("a completion whose content is not JSON is its own fault, and no second call is made", async () => {
    answering(
      () => new Response(JSON.stringify({ choices: [{ message: { content: "Here is what I think." } }] }), { status: 200 }),
    );

    expect(await faultOf(openRouterClient())).toBe("content-not-json");
    // The schema went out as a strict response format, so a reply that ignored it is a
    // fault and not something to ask for again with the constraint dropped.
    expect(calls).toHaveLength(1);
  });

  test("a completion with no content at all is rejected rather than read as an empty answer", async () => {
    answering(() => new Response(JSON.stringify({ choices: [{ message: {} }] }), { status: 200 }));

    expect(await faultOf(openRouterClient())).toBe("reply-off-schema");
  });

  test("a 200 carrying an error envelope is not read for choices it does not have", async () => {
    answering(
      () => new Response(JSON.stringify({ error: { code: 429, message: "Slow down." } }), { status: 200 }),
    );

    expect(await faultOf(openRouterClient())).toBe("rate-limited");
  });
});

describe("a service that says no", () => {
  test("a 429 is a rate limit and is not retried", async () => {
    answering(() => new Response(JSON.stringify({ error: { code: 429 } }), { status: 429 }));

    expect(await faultOf(openRouterClient())).toBe("rate-limited");
    expect(calls).toHaveLength(1);
  });

  test("a 503 is the pinned provider refusing rather than rerouting", async () => {
    answering(
      () =>
        new Response(JSON.stringify({ error: { code: 503, message: "No available model provider" } }), {
          status: 503,
        }),
    );

    expect(await faultOf(openRouterClient())).toBe("provider-refused");
    expect(calls).toHaveLength(1);
  });

  test("a 404 is a provider refusal too, because the answer is the same sentence about endpoints", async () => {
    answering(() => new Response(JSON.stringify({ error: { code: 404 } }), { status: 404 }));

    expect(await faultOf(openRouterClient())).toBe("provider-refused");
  });

  test("a 401 is a key that was refused, which is not the same as a key that is missing", async () => {
    answering(() => new Response(JSON.stringify({ error: { code: 401 } }), { status: 401 }));

    expect(await faultOf(openRouterClient())).toBe("key-rejected");
  });

  test("any other status is a service error rather than one of the named faults", async () => {
    answering(() => new Response(JSON.stringify({ error: { code: 500 } }), { status: 500 }));

    expect(await faultOf(openRouterClient())).toBe("service-error");
  });

  test("a timeout is its own fault, told apart from a socket that never opened", async () => {
    answering(() => {
      throw new DOMException("The operation timed out.", "TimeoutError");
    });

    expect(await faultOf(openRouterClient())).toBe("timed-out");
  });

  test("a network error that is not a timeout is unreachable", async () => {
    answering(() => {
      throw new TypeError("fetch failed");
    });

    expect(await faultOf(openRouterClient())).toBe("unreachable");
  });

  test("no error message carries the key, the model id or the document", async () => {
    answering(() => new Response("<html>Bad gateway</html>", { status: 502 }));

    try {
      await openRouterClient().complete(A_REQUEST);
      throw new Error("The call succeeded where it should have failed.");
    } catch (error) {
      expect(error).toBeInstanceOf(ModelCallError);
      const message = (error as ModelCallError).message;
      expect(message).not.toContain(MADE_UP_KEY);
      expect(message).not.toContain(MADE_UP_MODEL);
      expect(message).not.toContain(A_REQUEST.input);
    }
  });

  test("every fault the client can raise lands in a state a seam has copy for", () => {
    for (const fault of MODEL_FAULTS) {
      expect(["not-configured", "unavailable", "unreadable-reply"]).toContain(FAILURE_OF[fault]);
    }
  });
});

// ── the committed source tree ─────────────────────────────────────────────────

/**
 * Every file a push would make public: what git already tracks, plus what is sitting in
 * the working tree waiting to be added. Everything `.gitignore` covers, `.env.local`
 * among them, falls out by construction rather than by a list kept here, and a file
 * written this afternoon is checked before it is committed rather than after.
 */
function filesThatWouldBePushed(): readonly string[] {
  return execFileSync("git", ["ls-files", "-z", "--cached", "--others", "--exclude-standard"], {
    cwd: ROOT,
    encoding: "utf8",
  })
    .split("\0")
    .filter((path) => path.length > 0);
}

/** One of those files, read. */
function contentsOf(path: string): Buffer {
  return readFileSync(new URL(path, new URL("../", import.meta.url)));
}

/** The source files among them. */
function sourceFiles(): readonly string[] {
  return filesThatWouldBePushed().filter((path) => path.endsWith(".ts") || path.endsWith(".tsx"));
}

/** The value of one variable in `.env.local`, or null when there is no such file. */
function fromEnvLocal(name: string): string | null {
  const path = new URL(".env.local", new URL("../", import.meta.url));
  if (!existsSync(fileURLToPath(path))) return null;

  for (const line of readFileSync(fileURLToPath(path), "utf8").split("\n")) {
    const at = line.indexOf("=");
    if (at === -1 || line.trimStart().startsWith("#")) continue;
    if (line.slice(0, at).trim() !== name) continue;
    return line
      .slice(at + 1)
      .trim()
      .replace(/^["']|["']$/gu, "");
  }
  return null;
}

describe("what the public repository holds", () => {
  test("one file reads the model id and the key, and it reads them from the environment", () => {
    // A tripwire rather than a tidiness check. A second call site with a default of its
    // own would work, so nothing else in the suite would catch it; if another file starts
    // reading either variable, this fails and somebody looks at why.
    //
    //   src/model/openrouter.ts     the one reader: the value goes into the request
    //   this file                   sets both to made-up values and puts them back
    const reading = sourceFiles().filter((path) =>
      contentsOf(path).includes("process.env.OPENROUTER_"),
    );

    expect([...reading].sort()).toEqual(["src/model/openrouter.ts", "tests/openrouter-client.test.ts"]);
  });

  test("the model id in .env.local appears in no file that is checked in", () => {
    const model = fromEnvLocal("OPENROUTER_MODEL");
    // No `.env.local` on this machine means nothing to search for, and the test above
    // still holds the line. Reported rather than silently skipped.
    if (model === null || model.length === 0) {
      expect(model).toBeNull();
      return;
    }

    // The value is never put in a message. A failure names the file and nothing else,
    // because the message of a failing test is the thing that gets pasted into a chat.
    const holding = filesThatWouldBePushed().filter((path) => contentsOf(path).includes(model));

    expect(holding).toEqual([]);
  });

  test("the key in .env.local appears in no file that is checked in", () => {
    const key = fromEnvLocal("OPENROUTER_API_KEY");
    if (key === null || key.length === 0) {
      expect(key).toBeNull();
      return;
    }

    const holding = filesThatWouldBePushed().filter((path) => contentsOf(path).includes(key));

    expect(holding).toEqual([]);
  });

  test(".env.local is gitignored, so a key in it was never pushed and never will be", () => {
    expect(filesThatWouldBePushed()).not.toContain(".env.local");
  });

  test("no OpenRouter model slug is written into source", () => {
    // OpenRouter names a model `vendor/model`. A hardcoded id would work, which is why
    // nothing else in the suite would catch one, and why this looks for the shape rather
    // than for a particular id. The vendors are the ones OpenRouter routes to; a vendor
    // added later needs adding here, and the test above covers whatever id is in use now.
    const vendors = [
      "ai21/",
      "amazon/",
      "anthropic/",
      "baidu/",
      "cohere/",
      "deepseek/",
      "google/",
      "inflection/",
      "liquid/",
      "meta-llama/",
      "microsoft/",
      "minimax/",
      "mistralai/",
      "moonshotai/",
      "nousresearch/",
      "nvidia/",
      "openai/",
      "perplexity/",
      "qwen/",
      "stepfun-ai/",
      "thudm/",
      "x-ai/",
      "z-ai/",
    ];

    const holding = sourceFiles()
      // This file names the vendors in order to look for them.
      .filter((path) => path !== "tests/openrouter-client.test.ts")
      .filter((path) => vendors.some((vendor) => contentsOf(path).includes(vendor)));

    expect(holding).toEqual([]);
  });

  test("the key never reaches the browser, because only the server imports the client", () => {
    // The module throws on import in a browser, which catches it at run time. This
    // catches it now: nothing but the two route handlers and the two scripts that run
    // deliberately against a real model may name the file, so a client component that
    // reaches for it fails the suite rather than the reader.
    //
    // The list is the whole of the rule, so an entry added to it is a decision. Ticket
    // 13's `scripts/eval.ts` is on it for the same reason `scripts/smoke.ts` is: it runs
    // from a terminal, on command, and its whole job is to call the real model.
    const allowed = [
      "app/api/analyse/route.ts",
      "app/api/ask/route.ts",
      "scripts/smoke.ts",
      "scripts/eval.ts",
      "src/model/openrouter.ts",
    ];

    const importing = sourceFiles()
      .filter((path) => path !== "tests/openrouter-client.test.ts")
      .filter((path) => !allowed.includes(path))
      .filter((path) => contentsOf(path).includes("model/openrouter"));

    expect(importing).toEqual([]);
  });
});

// ── the suite itself ──────────────────────────────────────────────────────────

test("this file made no network call", () => {
  // Zero, and the tests above did send requests, so the boundary was genuinely
  // exercised and every one of those requests went to the replacement rather than out.
  expect(networkAttempts).toBe(0);
  expect(requestsAnswered).toBeGreaterThan(0);
});
