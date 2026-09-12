/**
 * The real client: OpenRouter's OpenAI-compatible chat completions endpoint.
 *
 * Ticket 10 is the one that runs this against a real model. Nothing in the
 * deterministic suite calls it, nothing imports it from the browser, and it is
 * reachable only from a route handler under `app/api/`, because the key must never
 * reach a reader's browser.
 *
 * The model id and the key are read from the environment at call time and appear
 * nowhere else: not in source, not in a test, not in a comment, not as a default
 * value, not in a thrown error, not in a log line. Reading them at call time rather
 * than at import time is deliberate, so that a missing variable is a state the
 * product reports rather than a crash at boot.
 */

import { ModelCallError, type ModelClient, type ModelReply, type ModelRequest } from "./client";

const ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";

/**
 * How long to wait. A reader is standing in front of a document they are about to
 * accept, and a request that never returns is worse than one that says it failed.
 */
const TIMEOUT_MS = 90_000;

/**
 * The provider block, pinned. Fallbacks are off and parameters are required, so a
 * request that cannot be served exactly as asked fails instead of quietly landing
 * somewhere that ignores the response format and returns prose.
 */
const PROVIDER = {
  order: ["fireworks"],
  allow_fallbacks: false,
  require_parameters: true,
} as const;

type ChatCompletion = {
  readonly choices?: readonly { readonly message?: { readonly content?: unknown } }[];
};

/** Reads the two variables, or says which kind of failure the absence is. */
function environment(): { readonly model: string; readonly key: string } {
  const model = process.env.OPENROUTER_MODEL;
  const key = process.env.OPENROUTER_API_KEY;
  if (!model || !key) {
    // Names only. Never the values, and never which of the two was missing in a
    // way that leaks one of them.
    throw new ModelCallError(
      "not-configured",
      "OPENROUTER_MODEL and OPENROUTER_API_KEY must both be set for a model call.",
    );
  }
  return { model, key };
}

/** The real client. One call, JSON in, parsed JSON out, no retry. */
export function openRouterClient(): ModelClient {
  return {
    async complete(request: ModelRequest): Promise<ModelReply> {
      const { model, key } = environment();

      const body = {
        model,
        provider: PROVIDER,
        reasoning: { effort: "low" },
        response_format: {
          type: "json_schema",
          json_schema: { name: request.schema.name, strict: true, schema: request.schema.json },
        },
        messages: [
          { role: "system", content: request.instructions },
          { role: "user", content: request.input },
        ],
      };

      let response: Response;
      try {
        response = await fetch(ENDPOINT, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${key}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(TIMEOUT_MS),
        });
      } catch {
        // The cause is swallowed on purpose: a network error's message can carry
        // the request, and the request carries the reader's document.
        throw new ModelCallError("unavailable", "The model could not be reached.");
      }

      if (!response.ok) {
        throw new ModelCallError("unavailable", `The model service answered ${response.status}.`);
      }

      let completion: ChatCompletion;
      try {
        completion = (await response.json()) as ChatCompletion;
      } catch {
        throw new ModelCallError("unreadable-reply", "The model service did not return JSON.");
      }

      const content = completion.choices?.[0]?.message?.content;
      if (typeof content !== "string" || content.length === 0) {
        throw new ModelCallError("unreadable-reply", "The model returned no content.");
      }

      try {
        return { json: JSON.parse(content) as unknown };
      } catch {
        throw new ModelCallError("unreadable-reply", "The model's content was not JSON.");
      }
    },
  };
}
