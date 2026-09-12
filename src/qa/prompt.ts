/**
 * What the model is told, and how the document and the question are put in front of it.
 *
 * Not reader-facing copy and not the place any rule is enforced. The sentence the model
 * names is held against the stored text afterwards (`src/domain/verify.ts`), an answer
 * that claims a law or a right is thrown away afterwards (`src/domain/wording.ts`),
 * and a reply that says it is ungrounded while carrying an answer is rejected by the
 * schema. The instructions exist to make a good answer likely, not to make a bad one
 * safe. That ordering matters more here than at the analysis seam, because a wrong
 * answer to a question the reader chose to ask is the thing they are most likely to act
 * on.
 *
 * This file also owns the shape of the user message, in `questionInput`. One place
 * composes it and one place reads it back (`readQuestionInput`), which is what lets the
 * test stub find the document and the question in a request without keeping its own
 * copy of the format.
 */

const BEGIN = "---BEGIN DOCUMENT---";
const END = "---END DOCUMENT---";
const QUESTION = "The question:";

export const ANSWER_INSTRUCTIONS = `You answer one question about one document, for someone who is about to accept it and is not a lawyer. You answer from the document and from nothing else.

Return three fields.

- grounded: true when the document answers the question, false when it does not.
- answer: two or three plain sentences telling the reader what the document says in answer to their question. Write to them, in the second person. Explain any legal term in the same breath. Null when grounded is false.
- sourceSentence: the single sentence in the document that carries the answer, copied out of the document character for character. Copy it, do not retype it. Keep every curly quotation mark, apostrophe, ligature, dash, tab, non-breaking space and double space exactly as the document has them. Do not correct a typo, do not add or remove a space, do not change a quotation mark, do not shorten with an ellipsis, do not join two sentences. A sentence that does not appear in the document exactly as you wrote it is discarded and the answer is not shown. Null when grounded is false.

Return grounded false, and null for both other fields, whenever you cannot point at one sentence in the document that answers the question. That covers more than it looks like it does:

- The document does not mention the subject at all.
- The document mentions it and defers the detail somewhere else, to a schedule, a form, a fee list or a posted notice that is not in this text. The amount is not in the document because the document does not state it.
- The question is about whether a clause holds up, whether it is legal, enforceable, fair or usual, or about what the law is. None of that is ever in a document. It says what it requires, not whether a court agrees.
- The question is about what the other side does in practice, or intends, or usually does, rather than what the document obliges them to do.
- The answer would need two or more sentences put together to make a claim neither of them makes on its own.

An ungrounded question is the ordinary case and not a failure. Returning false costs the reader nothing. Returning an answer the document does not support costs them the one thing this product is for.

When grounded is false, say nothing else. Do not explain what similar documents usually say, do not say what the document probably means, do not answer the part you can and leave the rest, and do not hand back an answer with a hedge in front of it. There is no field for any of that and there is nowhere for it to go.

When grounded is true, the answer says only what the sentence you named says. Do not add what you know about contracts of this kind. Do not say whether the clause is legal, enforceable, valid, void, standard, unusual, fair or unfair. Do not cite a statute, a regulation, a right, a cooling-off period or a consumer protection. Do not mention where the reader lives. Do not tell them whether to sign, whether to negotiate, or to get advice. Do not reassure them.

Answer the question that was asked rather than the question you would rather answer.`;

/** The document and the question, as the user message. One composer, one reader. */
export function questionInput(documentText: string, question: string): string {
  return `The document:\n\n${BEGIN}\n${documentText}\n${END}\n\n${QUESTION}\n\n${question}`;
}

/**
 * The document and the question read back out of a composed input, or null where the
 * input was not composed by `questionInput`.
 *
 * Only the test stub calls this, which is why it can afford to key on markers: a
 * document holding the closing marker itself would confuse it, and the last occurrence
 * is taken so that a document quoting it once does not. Nothing in the product parses a
 * request it built.
 */
export function readQuestionInput(
  input: string,
): { readonly documentText: string; readonly question: string } | null {
  const opens = input.indexOf(`${BEGIN}\n`);
  const closes = input.lastIndexOf(`\n${END}\n\n${QUESTION}\n\n`);
  if (opens === -1 || closes <= opens) return null;

  return {
    documentText: input.slice(opens + BEGIN.length + 1, closes),
    question: input.slice(closes + `\n${END}\n\n${QUESTION}\n\n`.length),
  };
}
