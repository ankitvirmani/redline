/**
 * The model client, as an interface.
 *
 * One method, injected at the seams that need a model. Analysis (ticket 04) and
 * question answering (ticket 09) both call it, the real implementation lives in
 * `openrouter.ts`, the test stub in `stub.ts`, and neither seam can tell which one
 * it holds. That is what lets the deterministic suite run with no key and no
 * network while the product runs against a real model through the same call.
 *
 * The client's job is narrow on purpose: send a request, hand back parsed JSON.
 * It does not know what a flag is, does not validate the shape of what came back,
 * and does not decide what to do when a field is wrong. Its caller owns the schema
 * and the trust decision, because the caller is the one that has to drop a flag.
 */

/** What the model is being asked to do. Ticket 09 adds its own member. */
export type ModelPurpose = "analysis";

/**
 * One request. `schema` is the caller's JSON Schema, which the real client sends
 * as a strict `json_schema` response format so the model has to answer in shape.
 */
export type ModelRequest = {
  readonly purpose: ModelPurpose;
  /** How the model is to behave. The system message. */
  readonly instructions: string;
  /** What it is to read. The user message. */
  readonly input: string;
  readonly schema: {
    /** A short name for the shape, which the API requires. */
    readonly name: string;
    readonly json: unknown;
  };
};

/**
 * What came back. `json` is parsed and entirely untrusted: it is `unknown` because
 * nothing has checked it yet, and the caller validates before reading a field.
 */
export type ModelReply = {
  readonly json: unknown;
};

/** Why a call could not produce parsed JSON. */
export const MODEL_FAILURES = [
  /** No model id or no key in the environment, so there was nothing to call. */
  "not-configured",
  /** The call did not complete, or the service refused it. */
  "unavailable",
  /** The call completed and what came back was not JSON. */
  "unreadable-reply",
] as const;

export type ModelFailure = (typeof MODEL_FAILURES)[number];

/**
 * The error a client throws. Carries a machine-readable reason so a seam can turn
 * it into a state a reader sees, and never carries a key, a model id, a document or
 * a response body.
 */
export class ModelCallError extends Error {
  readonly failure: ModelFailure;

  constructor(failure: ModelFailure, message: string) {
    super(message);
    this.name = "ModelCallError";
    this.failure = failure;
  }
}

export type ModelClient = {
  complete(request: ModelRequest): Promise<ModelReply>;
};
