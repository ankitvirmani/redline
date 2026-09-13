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

/**
 * What the model is being asked to do. Meant to gain members.
 *
 * The client does not read it. It is carried so that a stub can answer one purpose
 * differently from another, and so that a reader of a request can see which of the
 * two seams made it without inspecting the schema name.
 */
export const MODEL_PURPOSES = ["analysis", "question"] as const;

export type ModelPurpose = (typeof MODEL_PURPOSES)[number];

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

/**
 * Why a call could not produce parsed JSON, at the grain a reader meets.
 *
 * Three, because three is how many different things there are to tell someone
 * standing in front of a document: the product is not set up to read it, the service
 * that reads it could not be reached, or it answered with something that could not be
 * trusted. Both seams switch on this to pick the state they return, and those states
 * are their public surface.
 *
 * What went wrong underneath is `ModelFault` below, which is finer. The two grains are
 * kept apart on purpose: collapsing them would either flatten the owner's debugging
 * down to three words or push a dozen states onto a screen that has copy for three.
 */
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
 * What actually went wrong, at the grain the owner debugs at.
 *
 * A rate limit and a timeout are one state to a reader and two different afternoons to
 * whoever has to fix them, which is why they are separate here and not there. Every
 * fault belongs to exactly one failure, and `FAILURE_OF` below is the whole mapping, so
 * a fault added later cannot be left without a state for a reader.
 *
 * The three coarse names are faults in their own right, meaning that family with the
 * cause unstated. The test stub raises those, because a stub asked to fail has no cause
 * to report and inventing one would be a lie about where the failure came from.
 */
export const MODEL_FAULTS = [
  // ── not-configured ──────────────────────────────────────────────────────────
  /** The family, cause unstated. */
  "not-configured",
  /** `OPENROUTER_MODEL` is not set, so there is no model to call. */
  "no-model-configured",
  /** `OPENROUTER_API_KEY` is not set, so the call could not be signed. */
  "no-key-configured",
  /**
   * The key was sent and refused. Different from missing, and the difference is the
   * whole fix: a missing key is a variable to set, a refused one is a key to rotate.
   */
  "key-rejected",

  // ── unavailable ─────────────────────────────────────────────────────────────
  /** The family, cause unstated. */
  "unavailable",
  /** The request never reached the service: DNS, socket, offline. */
  "unreachable",
  /** The request was still open when the clock ran out. */
  "timed-out",
  /** The service said too many requests. Trying again later is the fix. */
  "rate-limited",
  /**
   * No provider would serve the request as it was asked. With `allow_fallbacks` off and
   * `require_parameters` on, a provider that cannot honour the structured-output
   * parameters is a refusal rather than a quiet reroute, and that is deliberate: the
   * reroute would return prose where the product expects a shape. A model id the
   * service does not recognise arrives here too, because the answer is the same
   * sentence about endpoints either way.
   */
  "provider-refused",
  /** The service answered with some other error of its own. */
  "service-error",

  // ── unreadable-reply ────────────────────────────────────────────────────────
  /** The family, cause unstated. */
  "unreadable-reply",
  /** The HTTP body was not JSON at all. */
  "reply-not-json",
  /** The body was JSON and was not a chat completion carrying content. */
  "reply-off-schema",
  /** The completion arrived and the content inside it was not JSON. */
  "content-not-json",
] as const;

export type ModelFault = (typeof MODEL_FAULTS)[number];

/**
 * Which state a reader meets for each fault. Total, and checked to be: a fault with no
 * entry here is a type error rather than a screen with nothing on it.
 */
export const FAILURE_OF: Readonly<Record<ModelFault, ModelFailure>> = {
  "not-configured": "not-configured",
  "no-model-configured": "not-configured",
  "no-key-configured": "not-configured",
  "key-rejected": "not-configured",
  unavailable: "unavailable",
  unreachable: "unavailable",
  "timed-out": "unavailable",
  "rate-limited": "unavailable",
  "provider-refused": "unavailable",
  "service-error": "unavailable",
  "unreadable-reply": "unreadable-reply",
  "reply-not-json": "unreadable-reply",
  "reply-off-schema": "unreadable-reply",
  "content-not-json": "unreadable-reply",
};

/**
 * The error a client throws. Carries both grains: `failure` is the state a seam turns
 * into copy, `fault` is what went wrong. It never carries a key, a model id, a
 * document, a question or a response body, because an error is the one thing in this
 * product that gets copied into a bug report.
 */
export class ModelCallError extends Error {
  readonly failure: ModelFailure;
  readonly fault: ModelFault;

  constructor(fault: ModelFault, message: string) {
    super(message);
    this.name = "ModelCallError";
    this.fault = fault;
    this.failure = FAILURE_OF[fault];
  }
}

export type ModelClient = {
  complete(request: ModelRequest): Promise<ModelReply>;
};
