/**
 * What the question box shows, and the words it shows it in.
 *
 * Not a component, so that what a reader ends up seeing can be tested without a browser.
 * `flag-view.ts` and `summary-view.ts` are next door for the same reason.
 *
 * Every string here has been through the `humanizer` skill. The refusal is the one that
 * had the most attention: it says the document does not answer the question and stops
 * there. It does not apologise, it does not suggest the reader asked the wrong thing, it
 * does not hint at what the answer might be, and it does not tell them to ask a lawyer,
 * which would be advice. A refusal is the product working, not a fault, and the copy is
 * written as information.
 *
 * Both refusal reasons the seam returns say the same thing to a reader. One is the model
 * reporting it cannot ground an answer and the other is the verifier overruling a model
 * that said it could, and in both cases the only honest thing to tell the reader is that
 * nothing in their document answers this. The distinction is for the defect log and the
 * eval suite, which is where it is kept.
 */

import type { GroundedAnswer, QuestionFailureReason } from "@/src/qa";

/**
 * One question and what came back.
 *
 * `asking` is a state a reader sees rather than a spinner, and it carries the question so
 * the question stays on the screen while the answer is coming.
 */
export type Exchange = {
  /** Stable for the life of the exchange, so the list does not rebuild while it updates. */
  readonly id: string;
  /** What the reader asked, as they asked it. */
  readonly question: string;
  readonly state:
    | { readonly kind: "asking" }
    | { readonly kind: "answered"; readonly answer: GroundedAnswer }
    | { readonly kind: "refused" }
    | { readonly kind: "failed"; readonly reason: QuestionFailureReason };
};

/** The key above an answer, and the key above a refusal. Each names the state in words. */
export const ANSWER_KEY = "From your document";
export const REFUSAL_KEY = "Not in your document";

/** The sentence the answer was drawn from. The same words a flag uses for the same thing. */
export const SOURCE_SENTENCE_KEY = "The sentence it came from";

/** What Redline says when the document does not answer the question. */
export const REFUSAL_SAYS =
  "Your document does not answer this. Redline answers from the text you pasted and from nothing else, so there is nothing here to show you.";

/** What Redline says while the answer is coming. */
export const ASKING_SAYS = "Redline is looking through your document. Give it a few seconds.";

/** What Redline says when the box was submitted with nothing in it. */
export const NOTHING_ASKED_SAYS = "The box is empty. Type a question first.";

/** What Redline says before a reader has asked anything. */
export const NOTHING_ASKED_YET_SAYS =
  "Nothing asked yet. Ask above, and the answer comes back with the sentence it came from.";

/**
 * What Redline says when there is no answer and the document is not the reason. Each one
 * is a designed state, and each says the same thing as its twin on the analysis path, so
 * a reader meets one sentence for a model that is not configured wherever they meet it.
 */
export const FAILURE_SAYS: Readonly<Record<QuestionFailureReason, string>> = {
  "model-not-configured":
    "Redline has no model set up to read with, so it has not answered your question.",
  "model-unavailable": "The answer did not come back. Redline kept nothing, so ask again.",
  "model-response-rejected":
    "What came back did not hold up, and Redline will not show you an answer it cannot stand behind. Ask again.",
};

/** The ids one exchange needs, so the markup's relationships are real ones. */
export function exchangeIds(base: string, id: string): {
  readonly question: string;
  readonly key: string;
  readonly sentence: string;
} {
  return {
    question: `${base}-q-${id}`,
    key: `${base}-k-${id}`,
    sentence: `${base}-s-${id}`,
  };
}
