import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import QuestionBox from "@/components/QuestionBox";
import {
  ANSWER_KEY,
  REFUSAL_KEY,
  REFUSAL_SAYS,
  SOURCE_SENTENCE_KEY,
  type Exchange,
} from "@/components/question-view";
import { defectsRecorded, forgetDefects } from "@/src/analysis";
import { appearsVerbatim } from "@/src/domain/verify";
import { extract, type ExtractedDocument } from "@/src/extraction";
import type { ModelClient } from "@/src/model/client";
import {
  answerClaimingASentenceTheDocumentDoesNotHave,
  answerPayloadFor,
  ANSWERS_THAT_CLAIM_A_LAW_OR_A_RIGHT,
  changeSpan,
  FABRICATED_SENTENCE,
  groundedAnswer,
  groundedQuestions,
  questionsDocument,
  stubModelClient,
  ungroundedQuestions,
  withAnswer,
  withChangedAnswerSpan,
} from "@/src/model/stub";
import { answerQuestion, readQuestionInput, type QuestionReading } from "@/src/qa";

/**
 * The question box: an answer grounded in the document, or a refusal.
 *
 * Deterministic. The model client is the stub, which answers questions out of
 * `tests/fixtures/questions.json`: ten questions the gym membership answers, each with
 * the sentence its answer has to cite, and eight it does not, each with the reason it
 * cannot. The ungrounded eight were chosen to sound answerable. Two of them are
 * unanswerable because the fixture contract has no governing law clause and no privacy
 * clause, and it stays that way.
 *
 * What these tests assert is what a reader would observe. That every answer on their
 * screen quotes a sentence that is in the document they pasted, in those exact
 * characters. That a question their document does not answer comes back refused rather
 * than answered around. And that a model claiming an answer it cannot cite loses to the
 * code, which is the one property this seam exists for.
 *
 * The hard part of the ticket is a negative and it is not claimed here. No test can prove
 * the seam refuses every ungrounded question a reader could think of; ticket 13 measures
 * that against a corpus. What is tested is the code standing between the model and the
 * reader, and each test's name says which part of it.
 */

// ── the suite makes no network call ────────────────────────────────────────────
//
// Asserted rather than assumed. `fetch` is replaced for the whole file with something
// that counts the attempt and then fails, so a call would both be visible and break the
// test that made it. The count is checked at the end of the file.

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

beforeEach(() => {
  forgetDefects();
});

// ── the document, and asking about it ─────────────────────────────────────────

const DOCUMENT_TEXT = questionsDocument();

async function documentOf(text: string): Promise<ExtractedDocument> {
  const extraction = await extract({ kind: "pasted-text", text });
  if (extraction.outcome !== "extracted") throw new Error("The fixture did not extract.");
  return extraction.document;
}

const DOCUMENT = await documentOf(DOCUMENT_TEXT);

/** Asks one question, against the faithful stub or against a payload a test hands in. */
async function ask(question: string, answer?: unknown): Promise<QuestionReading> {
  return answerQuestion({
    document: DOCUMENT,
    question,
    model: stubModelClient(answer === undefined ? {} : { answer }),
  });
}

/** A client that counts the calls made to it and answers nothing. */
function countingClient(): { readonly client: ModelClient; calls(): number } {
  let calls = 0;
  return {
    client: {
      async complete() {
        calls += 1;
        throw new Error("The stub should not have been called.");
      },
    },
    calls: () => calls,
  };
}

// ── an answerable question is answered, and quotes the document ───────────────

describe("a question the document answers", () => {
  for (const { question, expectedSourceSentence } of groundedQuestions()) {
    describe(question, () => {
      it("comes back answered, with a source sentence that is in the document", async () => {
        const reading = await ask(question);

        expect(reading.outcome).toBe("answered");
        if (reading.outcome !== "answered") return;

        expect(reading.answer.text.trim().length).toBeGreaterThan(0);
        // The rule the product rests on, on the answer path: the quote a reader is shown
        // is in the document they pasted, character for character.
        expect(appearsVerbatim(DOCUMENT.text, reading.answer.sourceSentence.text)).toBe(true);
        expect(DOCUMENT.text.slice(
          reading.answer.sourceSentence.at.start,
          reading.answer.sourceSentence.at.end,
        )).toBe(reading.answer.sourceSentence.text);
        expect(reading.answer.sourceSentence.text).toBe(expectedSourceSentence);
      });
    });
  }

  it("raises no defect on any of them", async () => {
    for (const { question } of groundedQuestions()) await ask(question);
    expect(defectsRecorded()).toEqual([]);
  });
});

// ── a question the document cannot answer is refused ──────────────────────────

describe("a question the document does not answer", () => {
  // Every one of the eight, not a proportion of them. `PRD.md` section 4 proposes 100%
  // refusal and puts an answer to an ungrounded question in the same class as a missing
  // citation, so a test that passed at seven out of eight would be measuring the wrong
  // thing.
  for (const { question, why } of ungroundedQuestions()) {
    describe(question, () => {
      it(`is refused, because ${why}`, async () => {
        const reading = await ask(question);

        expect(reading.outcome).toBe("refused");
        if (reading.outcome !== "refused") return;
        expect(reading.refusal).toBe("the-document-does-not-address-it");
        // Nothing to render as an answer, so nothing a screen could render by mistake.
        expect("answer" in reading).toBe(false);
      });
    });
  }
});

// ── the code's judgement beats the model's claim ──────────────────────────────

describe("a model that claims an answer it cannot cite", () => {
  const question = groundedQuestions()[0]?.question ?? "";

  it("is refused rather than answered, when the sentence is not in the document", async () => {
    const reading = await ask(question, answerClaimingASentenceTheDocumentDoesNotHave());

    expect(reading.outcome).toBe("refused");
    if (reading.outcome !== "refused") return;
    expect(reading.refusal).toBe("the-sentence-is-not-in-the-document");
  });

  it("never reaches the reader with the sentence it invented", async () => {
    const reading = await ask(question, answerClaimingASentenceTheDocumentDoesNotHave());
    expect(JSON.stringify(reading)).not.toContain(FABRICATED_SENTENCE);
  });

  it("has the drop recorded, so a corpus run can count it", async () => {
    await ask(question, answerClaimingASentenceTheDocumentDoesNotHave());

    const codes = defectsRecorded().map((defect) => defect.code);
    expect(codes).toContain("answer-sentence-not-found");
  });

  it("is refused when it claims an answer and cites nothing at all", async () => {
    const reading = await ask(question, groundedAnswer(""));

    expect(reading.outcome).toBe("refused");
    expect(defectsRecorded().map((defect) => defect.code)).toContain("answer-sentence-missing");
  });
});

// ── the same strictness as a flag, proved here on the answer path ─────────────

describe("a source sentence that differs from the document by one character", () => {
  // Proved separately from the analysis seam's version of this test on purpose. Both
  // paths run the same verifier now, and this is what would catch it if one day they did
  // not: a relaxation on the answer path is the one nobody would notice.
  const withACurlyQuote = groundedQuestions().find((entry) =>
    /[‘’“”]/u.test(entry.expectedSourceSentence),
  );

  it("has a fixture question whose sentence carries a curly quotation mark", () => {
    expect(withACurlyQuote).toBeDefined();
  });

  it("is refused when one curly quotation mark is straightened", async () => {
    if (withACurlyQuote === undefined) return;
    const faithful = answerPayloadFor(DOCUMENT_TEXT, withACurlyQuote.question);
    const reading = await ask(
      withACurlyQuote.question,
      withChangedAnswerSpan(faithful, "one-curly-quote"),
    );

    expect(reading.outcome).toBe("refused");
    if (reading.outcome !== "refused") return;
    expect(reading.refusal).toBe("the-sentence-is-not-in-the-document");
  });

  for (const change of ["one-space", "one-character", "not-in-the-document"] as const) {
    it(`is refused when the sentence differs by ${change}`, async () => {
      const question = groundedQuestions()[0]?.question ?? "";
      const faithful = answerPayloadFor(DOCUMENT_TEXT, question);
      const reading = await ask(question, withChangedAnswerSpan(faithful, change));

      expect(reading.outcome).toBe("refused");
    });
  }

  it("answers the same question when the sentence is left alone", async () => {
    const question = groundedQuestions()[0]?.question ?? "";
    const faithful = answerPayloadFor(DOCUMENT_TEXT, question);

    // The control for the four above: the only difference between this and a refusal is
    // the one character, so the refusals are not passing for some other reason.
    expect(changeSpan(faithful.sourceSentence ?? "", "one-space")).not.toBe(
      faithful.sourceSentence,
    );
    expect((await ask(question, faithful)).outcome).toBe("answered");
  });
});

// ── a refusal is not an error, and not an empty answer ────────────────────────

describe("telling a refusal apart from everything else", () => {
  const question = groundedQuestions()[0]?.question ?? "";
  const ungrounded = ungroundedQuestions()[0]?.question ?? "";

  it("gives a refusal and a failure different outcomes, so no consumer matches on copy", async () => {
    const refused = await ask(ungrounded);
    const failed = await answerQuestion({
      document: DOCUMENT,
      question,
      model: stubModelClient({ fail: "unavailable" }),
    });

    expect(refused.outcome).toBe("refused");
    expect(failed.outcome).toBe("failed");
    expect(refused.outcome).not.toBe(failed.outcome);
  });

  it("reports a model that is not configured as a failure and not as a silent document", async () => {
    const reading = await answerQuestion({
      document: DOCUMENT,
      question,
      model: stubModelClient({ fail: "not-configured" }),
    });

    expect(reading).toEqual({ outcome: "failed", reason: "model-not-configured" });
  });

  it("treats an empty answer as a failure rather than as a refusal", async () => {
    // An answer that came back blank says nothing about the document, so calling it a
    // refusal would tell the reader their contract is silent on evidence that it is not.
    const reading = await ask(question, withAnswer(answerPayloadFor(DOCUMENT_TEXT, question), ""));

    expect(reading.outcome).toBe("failed");
    expect(defectsRecorded().map((defect) => defect.code)).toContain("answer-unusable");
  });

  it("treats a whitespace answer the same way", async () => {
    const reading = await ask(
      question,
      withAnswer(answerPayloadFor(DOCUMENT_TEXT, question), "   \n  "),
    );

    expect(reading.outcome).toBe("failed");
  });

  it("rejects a reply that says it is ungrounded while carrying an answer", async () => {
    // The one shape that would look like a refusal to a consumer switching on the field
    // and like an answer to one reading the answer. It is thrown out whole.
    const reading = await ask(question, {
      grounded: false,
      answer: "Your document says you may cancel at any time.",
      sourceSentence: null,
    });

    expect(reading).toEqual({ outcome: "failed", reason: "model-response-rejected" });
  });

  it("rejects a reply that is not in the shape at all", async () => {
    expect((await ask(question, { answer: "Yes." })).outcome).toBe("failed");
    expect((await ask(question, "Your document does not say.")).outcome).toBe("failed");
  });
});

// ── no answer draws on anything outside the document ──────────────────────────

describe("an answer that reaches outside the document", () => {
  const question = groundedQuestions()[0]?.question ?? "";

  for (const [index, answer] of ANSWERS_THAT_CLAIM_A_LAW_OR_A_RIGHT.entries()) {
    it(`is not shown when it claims a law or a right, wording ${index + 1}`, async () => {
      const reading = await ask(
        question,
        withAnswer(answerPayloadFor(DOCUMENT_TEXT, question), answer),
      );

      // Not a refusal: the document may well answer the question, and the model wrapped
      // the answer in a claim the product does not make. Saying the document is silent
      // would be a false statement about the thing the reader is about to sign.
      expect(reading.outcome).toBe("failed");
      expect(defectsRecorded().map((defect) => defect.code)).toContain(
        "answer-claims-a-law-or-a-right",
      );
    });
  }

  it("still shows an answer that only reports the document", async () => {
    expect((await ask(question)).outcome).toBe("answered");
  });
});

// ── an empty question does not reach the model ────────────────────────────────

describe("a question box submitted with nothing in it", () => {
  for (const [name, question] of [
    ["empty", ""],
    ["a single space", " "],
    ["whitespace and newlines", "   \n\t  \n "],
  ] as const) {
    it(`does not reach the model when the question is ${name}`, async () => {
      const counting = countingClient();
      const reading = await answerQuestion({
        document: DOCUMENT,
        question,
        model: counting.client,
      });

      // Its own outcome rather than a refusal. Nothing was asked, so there is nothing
      // true to say about the document, and a refusal would say something about it.
      expect(reading).toEqual({ outcome: "not-asked", reason: "nothing-asked" });
      expect(counting.calls()).toBe(0);
      expect(defectsRecorded()).toEqual([]);
    });
  }

  it("asks the model once a question has words in it", async () => {
    const counting = countingClient();
    await answerQuestion({
      document: DOCUMENT,
      question: "  Can they put my price up?  ",
      model: counting.client,
    });

    expect(counting.calls()).toBe(1);
  });
});

// ── the request the model is handed ───────────────────────────────────────────

describe("the request the seam composes", () => {
  it("carries the document unchanged and the question beside it", async () => {
    let seen = "";
    const question = "Can they change the rules after I have signed?";
    await answerQuestion({
      document: DOCUMENT,
      question,
      model: {
        async complete(request) {
          seen = request.input;
          return { json: answerPayloadFor(DOCUMENT_TEXT, question) };
        },
      },
    });

    const read = readQuestionInput(seen);
    expect(read).not.toBeNull();
    // The document reaches the model character for character. Verification compares the
    // model's sentence against these same characters, so anything normalising here would
    // break every citation on this path silently.
    expect(read?.documentText).toBe(DOCUMENT.text);
    expect(read?.question).toBe(question);
  });
});

// ── the screen ────────────────────────────────────────────────────────────────

/** Entity references back to characters, so an assertion reads what a reader reads. */
function asText(html: string): string {
  return html
    .replace(/&quot;/gu, '"')
    .replace(/&#x27;/gu, "'")
    .replace(/&#39;/gu, "'")
    .replace(/&lt;/gu, "<")
    .replace(/&gt;/gu, ">")
    .replace(/&amp;/gu, "&");
}

/** The question box as a reader gets it. */
function rendered(exchanges: readonly Exchange[]): string {
  return asText(
    renderToStaticMarkup(createElement(QuestionBox, { exchanges, onAsk: () => {} })),
  );
}

describe("the question box on the screen", () => {
  const question = groundedQuestions()[0]?.question ?? "";

  it("shows an answer with the sentence it came from, quoted out of the document", async () => {
    const reading = await ask(question);
    if (reading.outcome !== "answered") throw new Error("The fixture question was not answered.");

    const html = rendered([{ id: "1", question, state: { kind: "answered", answer: reading.answer } }]);

    expect(html).toContain(question);
    expect(html).toContain(reading.answer.text);
    // The rule the product rests on, at the last place it can break: what is on the
    // screen is in the document, character for character.
    expect(html).toContain(reading.answer.sourceSentence.text);
    expect(appearsVerbatim(DOCUMENT.text, reading.answer.sourceSentence.text)).toBe(true);
    // The tie between the answer and its sentence is markup, not proximity.
    expect(html).toContain(SOURCE_SENTENCE_KEY);
    expect(html).toContain("<figure");
    expect(html).toContain("<blockquote");
    expect(html).toContain(ANSWER_KEY);
  });

  it("shows a refusal that names the state in words and says the document does not answer it", async () => {
    const ungrounded = ungroundedQuestions()[0]?.question ?? "";
    const reading = await ask(ungrounded);
    expect(reading.outcome).toBe("refused");

    const html = rendered([{ id: "1", question: ungrounded, state: { kind: "refused" } }]);

    // Read aloud, the state comes before the sentence, so an answer and a refusal are
    // told apart on the first words rather than on the tone of the paragraph.
    expect(html.indexOf(REFUSAL_KEY)).toBeGreaterThan(-1);
    expect(html.indexOf(REFUSAL_KEY)).toBeLessThan(html.indexOf(REFUSAL_SAYS));
    expect(html).toContain(REFUSAL_SAYS);
    expect(html).toContain("does not answer this");
  });

  it("styles a refusal as a designed state and not as error chrome", async () => {
    const ungrounded = ungroundedQuestions()[0]?.question ?? "";
    const html = rendered([{ id: "1", question: ungrounded, state: { kind: "refused" } }]);

    // No alert role, no warning word, no icon. The reader asked a fair question and their
    // document is silent, which is information rather than a fault.
    expect(html).not.toContain('role="alert"');
    expect(html.toLowerCase()).not.toContain("error");
    expect(html.toLowerCase()).not.toContain("warning");
    expect(html.toLowerCase()).not.toContain("sorry");
    expect(html.toLowerCase()).not.toContain("failed");
    // The bar in front of it is the refusals device, and it is hidden from a screen
    // reader because it identifies the line and says nothing the words do not.
    expect(html).toContain('class="qbox__bar"');
  });

  it("hints at no answer in the refusal and sends the reader to nobody", async () => {
    const html = rendered([{ id: "1", question: "x", state: { kind: "refused" } }]);

    for (const forbidden of ["lawyer", "attorney", "probably", "usually", "typically", "likely", "might mean"]) {
      expect(html.toLowerCase()).not.toContain(forbidden);
    }
  });

  it("tells the reader a failure apart from a refusal without repeating the refusal", () => {
    const html = rendered([
      { id: "1", question: "x", state: { kind: "failed", reason: "model-unavailable" } },
    ]);

    expect(html).not.toContain(REFUSAL_SAYS);
    expect(html).not.toContain(REFUSAL_KEY);
  });

  it("says something before a reader has asked anything, rather than showing an empty list", () => {
    const html = rendered([]);

    expect(html).toContain("Nothing asked yet");
    expect(html).not.toContain("<ol");
  });

  it("announces an answer when it arrives", async () => {
    const reading = await ask(question);
    if (reading.outcome !== "answered") throw new Error("The fixture question was not answered.");

    const html = rendered([{ id: "1", question, state: { kind: "answered", answer: reading.answer } }]);

    expect(html).toContain('aria-live="polite"');
  });
});

// ── the promise this file makes about itself ──────────────────────────────────

describe("the deterministic suite", () => {
  it("made no network call", () => {
    expect(fetchAttempts).toBe(0);
  });
});
