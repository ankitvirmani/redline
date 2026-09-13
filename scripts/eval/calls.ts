/**
 * The model client the eval run holds: the real one, with a retry and a cache.
 *
 * Three things are wrapped around `openRouterClient()` and nothing else changes. The
 * pinned provider block, the reasoning effort and the strict response format are the
 * real client's and are not touched here. Relaxing any of them to get a run to finish
 * is the one change this file must not make.
 *
 * **A retry on a rate limit.** Ticket 10's run found nine of twelve attempts answered
 * with a refusal that came from the shared upstream pool being full. A corpus pass
 * makes many more calls than that run did, so losing the pass to one full pool is not
 * an acceptable outcome. The real client does not retry, deliberately, and it should
 * not: a reader standing in front of a document wants to be told the service is busy,
 * not held for two minutes. A corpus pass is the opposite case, so the retry lives
 * here, where it belongs to the harness and not to the product.
 *
 * The retry is only for a call that did not complete. A reply that arrived and could
 * not be read is a result, and asking again for a better one would be the eval quietly
 * improving its own numbers.
 *
 * **A cache, so a pass is resumable.** Every successful reply is written to disk under
 * a digest of exactly what was asked. A pass interrupted by a full pool, a stopped
 * process or a closed laptop picks up where it stopped rather than paying again for the
 * calls that already worked. The cache holds the model's reply and nothing about the
 * key or the model id. It is not committed.
 *
 * **A ledger.** How many calls a pass needs, how many attempts it took, how many came
 * from the cache, and what went wrong on each attempt. The owner pays for the next
 * pass, so the number of attempts is a number the report has to carry.
 */

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { ModelCallError, type ModelClient, type ModelReply, type ModelRequest } from "@/src/model/client";

/**
 * Where cached replies go. Outside `tests/` and gitignored: a reply is a reading of a
 * document rather than a fact about the product, and a committed one would let a stale
 * reply stand in for a run nobody made.
 */
export const CACHE_DIRECTORY = new URL("../../.eval-cache/", import.meta.url);

/** How many times one call is attempted before the pass gives up on it. */
export const MAX_ATTEMPTS = 10;

/** The wait before attempt n, in milliseconds, doubling and capped. */
export function backoffFor(attempt: number): number {
  const base = Math.min(60_000, 3_000 * 2 ** (attempt - 1));
  // Jitter, so two calls that were rate limited together do not come back together.
  return Math.round(base * (0.75 + Math.random() * 0.5));
}

/** What happened on one attempt, at the grain the owner debugs at. */
export type AttemptRecord = {
  readonly purpose: string;
  readonly attempt: number;
  readonly outcome: "answered" | "from-cache" | "failed";
  /** The client's fault name, where the attempt failed. Never a message from a service. */
  readonly fault: string | null;
};

export type CallLedger = {
  /** Distinct calls the pass asked for. */
  calls: number;
  /** Attempts made over the wire, retries included. What a pass actually costs. */
  attempts: number;
  /** Calls answered from the cache, which cost nothing. */
  fromCache: number;
  /** Calls that ran out of attempts. */
  gaveUp: number;
  readonly faults: Record<string, number>;
  readonly log: AttemptRecord[];
};

export function emptyLedger(): CallLedger {
  return { calls: 0, attempts: 0, fromCache: 0, gaveUp: 0, faults: {}, log: [] };
}

/** The digest of exactly what is being asked. Nothing else is in the key. */
function digestOf(request: ModelRequest): string {
  return createHash("sha256")
    .update(
      JSON.stringify({
        purpose: request.purpose,
        schema: request.schema.name,
        instructions: request.instructions,
        input: request.input,
      }),
    )
    .digest("hex")
    .slice(0, 32);
}

function cachePath(digest: string): string {
  return fileURLToPath(new URL(`${digest}.json`, CACHE_DIRECTORY));
}

/** Waits, so the next attempt lands after the pool has moved on. */
function wait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export type EvalClientOptions = {
  /** False ignores anything on disk and calls for every request. */
  readonly useCache: boolean;
  /** Called before each wait, so a long pass says why it is quiet. */
  readonly onWait?: (attempt: number, ms: number, fault: string) => void;
};

/**
 * The real client with the retry, the cache and the ledger around it.
 *
 * Throws the client's own `ModelCallError` when a call runs out of attempts, untouched,
 * so the seam above still turns it into the state a reader would meet.
 */
export function evalClient(
  underlying: ModelClient,
  options: EvalClientOptions,
): { readonly client: ModelClient; readonly ledger: CallLedger } {
  const ledger = emptyLedger();
  mkdirSync(fileURLToPath(CACHE_DIRECTORY), { recursive: true });

  const client: ModelClient = {
    async complete(request: ModelRequest): Promise<ModelReply> {
      ledger.calls += 1;
      const digest = digestOf(request);
      const path = cachePath(digest);

      if (options.useCache && existsSync(path)) {
        ledger.fromCache += 1;
        ledger.log.push({ purpose: request.purpose, attempt: 0, outcome: "from-cache", fault: null });
        return JSON.parse(readFileSync(path, "utf8")) as ModelReply;
      }

      let lastError: unknown;
      for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
        ledger.attempts += 1;
        try {
          const reply = await underlying.complete(request);
          ledger.log.push({ purpose: request.purpose, attempt, outcome: "answered", fault: null });
          writeFileSync(path, JSON.stringify(reply), "utf8");
          return reply;
        } catch (error) {
          lastError = error;
          const fault = error instanceof ModelCallError ? error.fault : "unknown";
          ledger.faults[fault] = (ledger.faults[fault] ?? 0) + 1;
          ledger.log.push({ purpose: request.purpose, attempt, outcome: "failed", fault });

          // A reply that arrived and could not be read is a result. A call that never
          // completed is worth asking again. Anything about configuration is worth
          // asking about nowhere: there is no key, and waiting will not produce one.
          const worthRetrying =
            error instanceof ModelCallError && error.failure === "unavailable";
          if (!worthRetrying || attempt === MAX_ATTEMPTS) break;

          const ms = backoffFor(attempt);
          options.onWait?.(attempt, ms, fault);
          await wait(ms);
        }
      }

      ledger.gaveUp += 1;
      throw lastError;
    },
  };

  return { client, ledger };
}
