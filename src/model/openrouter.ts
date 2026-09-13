/**
 * The real client: OpenRouter's OpenAI-compatible chat completions endpoint.
 *
 * Ticket 10 is the one that runs this against a real model. Nothing in the
 * deterministic suite calls it over a socket, nothing imports it from the browser, and
 * it is reachable only from a route handler under `app/api/` and from
 * `scripts/smoke.ts`, because the key must never reach a reader's browser. The guard
 * at the bottom of this comment's file is what makes that a property rather than a
 * habit.
 *
 * The model id and the key are read from the environment at call time and appear
 * nowhere else: not in source, not in a test, not in a comment, not as a default
 * value, not in a thrown error, not in a log line. Reading them at call time rather
 * than at import time is deliberate, so that a missing variable is a state the
 * product reports rather than a crash at boot.
 *
 * What this file does not do:
 *
 * - It does not retry. Not on a rate limit, not on a timeout, and above all not on a
 *   schema failure with a loosened schema, which would be exactly the silent
 *   degradation the product exists to avoid. A caller that wants a second attempt can
 *   make one knowing the first failed.
 * - It does not repair a reply. A body that is JSON and is not a chat completion is a
 *   fault, not something to read fields out of hopefully.
 * - It does not know what a flag is. The caller owns the payload schema and the trust
 *   decision, because the caller is the one that has to drop a flag.
 */

import { z } from "zod";

import { ModelCallError, type ModelClient, type ModelReply, type ModelRequest } from "./client";

/**
 * A browser must never load this module, because loading it is one step from calling
 * it and calling it needs the key. The check runs at import, so a client component
 * that reaches for it fails on the import rather than at whatever hour someone first
 * clicks the button. `server-only`, which Next uses for this and which would turn it
 * into a build error, is not an approved dependency here; the deterministic suite
 * carries `tests/openrouter-client.test.ts` instead, which fails if anything outside
 * `app/api/` or `scripts/` imports this file.
 */
if (typeof window !== "undefined") {
  throw new Error(
    "src/model/openrouter.ts is server-only. It holds the OpenRouter key, so no client component may import it.",
  );
}

const ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";

/**
 * How long to wait. A reader is standing in front of a document they are about to
 * accept, and a request that never returns is worse than one that says it failed.
 */
export const TIMEOUT_MS = 90_000;

/**
 * The provider block, pinned. Fallbacks are off and parameters are required, so a
 * request that cannot be served exactly as asked fails instead of quietly landing
 * somewhere that ignores the response format and returns prose.
 *
 * Exported so a test can assert the request carries this object and not a copy of it
 * that has drifted. Relaxing either flag to get a run to succeed is the one change
 * this file must not accept.
 */
export const PROVIDER = {
  order: ["fireworks"],
  allow_fallbacks: false,
  require_parameters: true,
} as const;

/** Reasoning effort, pinned with the provider block for the same reason. */
export const REASONING = { effort: "low" } as const;

/**
 * The reply shape, checked before a single field is read.
 *
 * Loose about what else is in there and strict about what is needed: providers add
 * fields (a reasoning trace, a refusal, usage) and a client that rejected a reply for
 * carrying more than it was asked for would break on someone else's release note.
 * What it will not do is accept a completion with no content, because reading
 * `choices?.[0]?.message?.content` off an error object and finding undefined is how a
 * caller ends up being handed `undefined` as though it were an answer.
 */
const CHAT_COMPLETION = z.object({
  choices: z
    .array(z.object({ message: z.object({ content: z.string().min(1) }) }))
    .min(1),
});

/**
 * The error envelope OpenRouter returns, which it can do with a 200 as well as with a
 * status of its own. Read for its code only; the message is not forwarded anywhere,
 * because a provider error message can quote the request and the request carries the
 * reader's document.
 */
const SERVICE_ERROR = z.object({
  error: z.object({ code: z.union([z.number(), z.string()]).optional() }),
});

/**
 * The fault a status code means.
 *
 * OpenRouter documents these, and they are worth keeping apart because the fix differs
 * every time: 401 is a key to rotate, 408 and 429 are worth trying again, 404, 502 and
 * 503 are the pinned provider block doing its job and refusing rather than rerouting.
 */
function faultForStatus(status: number): ModelCallError["fault"] {
  switch (status) {
    case 401:
    case 403:
      return "key-rejected";
    case 404:
    case 502:
    case 503:
      return "provider-refused";
    case 408:
      return "timed-out";
    case 429:
      return "rate-limited";
    default:
      return "service-error";
  }
}

/**
 * Which variable the client needs and does not have, or null when it has both.
 *
 * Exported so that `scripts/smoke.ts` can say so plainly and stop, rather than reading
 * the environment for itself. This file is the only place in the product that reads
 * either value, and keeping it that way is the criterion the suite protects: one
 * variable, one reader, no second call site with a default of its own.
 *
 * It reports the name of the variable and never its value. Naming it is not leaking it,
 * and which of the two is absent is the whole of the fix.
 */
export function notConfigured(): "OPENROUTER_MODEL" | "OPENROUTER_API_KEY" | null {
  const model = process.env.OPENROUTER_MODEL;
  if (model === undefined || model.length === 0) return "OPENROUTER_MODEL";

  const key = process.env.OPENROUTER_API_KEY;
  if (key === undefined || key.length === 0) return "OPENROUTER_API_KEY";

  return null;
}

/** The two variables, read at call time, or the fault that there is nothing to call. */
function environment(): { readonly model: string; readonly key: string } {
  const missing = notConfigured();
  if (missing === "OPENROUTER_MODEL") {
    throw new ModelCallError("no-model-configured", "The model variable is not set.");
  }
  if (missing === "OPENROUTER_API_KEY") {
    throw new ModelCallError("no-key-configured", "The key variable is not set.");
  }

  // Both are set, which `notConfigured` has just established. Read again rather than
  // returned from there, so that no function in this file hands a key to its caller.
  return { model: process.env.OPENROUTER_MODEL ?? "", key: process.env.OPENROUTER_API_KEY ?? "" };
}

/** The request body, as one function, so a test can read the shape in one place. */
function bodyFor(model: string, request: ModelRequest): unknown {
  return {
    model,
    provider: PROVIDER,
    reasoning: REASONING,
    response_format: {
      type: "json_schema",
      json_schema: { name: request.schema.name, strict: true, schema: request.schema.json },
    },
    messages: [
      { role: "system", content: request.instructions },
      { role: "user", content: request.input },
    ],
  };
}

/** The real client. One call, JSON in, parsed JSON out, no retry. */
export function openRouterClient(): ModelClient {
  return {
    async complete(request: ModelRequest): Promise<ModelReply> {
      const { model, key } = environment();

      let response: Response;
      try {
        response = await fetch(ENDPOINT, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${key}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(bodyFor(model, request)),
          signal: AbortSignal.timeout(TIMEOUT_MS),
        });
      } catch (error) {
        // The cause is swallowed on purpose: a network error's message can carry the
        // request, and the request carries the reader's document. Only the name is
        // read, and only to tell a clock that ran out from a socket that never opened.
        const name = error instanceof Error ? error.name : "";
        if (name === "TimeoutError" || name === "AbortError") {
          throw new ModelCallError("timed-out", "The model did not answer in time.");
        }
        throw new ModelCallError("unreachable", "The model could not be reached.");
      }

      // A body is read once. Read as text first so that a non-JSON error page is a
      // fault of its own rather than a parse failure wearing the wrong name.
      const raw = await response.text().catch(() => "");

      let parsed: unknown;
      let isJson = true;
      try {
        parsed = JSON.parse(raw) as unknown;
      } catch {
        isJson = false;
      }

      if (!response.ok) {
        // The status leads, and the envelope's own code is read only when the status
        // did not say. Some gateways answer 200 with an error body; that case is below.
        throw new ModelCallError(
          faultForStatus(response.status),
          `The model service answered ${response.status}.`,
        );
      }

      if (!isJson) {
        throw new ModelCallError("reply-not-json", "The model service did not return JSON.");
      }

      // A 200 carrying an error envelope. Rare, and it happens, and reading
      // `choices[0]` off it would hand the caller nothing while calling it an answer.
      const asError = SERVICE_ERROR.safeParse(parsed);
      if (asError.success) {
        const code = Number(asError.data.error.code);
        throw new ModelCallError(
          Number.isFinite(code) ? faultForStatus(code) : "service-error",
          "The model service answered with an error.",
        );
      }

      const completion = CHAT_COMPLETION.safeParse(parsed);
      if (!completion.success) {
        throw new ModelCallError(
          "reply-off-schema",
          "The model service's reply was not a chat completion.",
        );
      }

      const content = completion.data.choices[0]?.message.content ?? "";
      try {
        return { json: JSON.parse(content) as unknown };
      } catch {
        // The schema was sent as a strict `json_schema` response format, so this is a
        // provider that did not honour it. Asking again without the constraint is the
        // silent degradation the product is built to avoid, so it is a fault and the
        // call ends here.
        throw new ModelCallError("content-not-json", "The model's content was not JSON.");
      }
    },
  };
}
