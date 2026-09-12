"use client";

import { useId, useRef, useState, type FormEvent } from "react";

import { questionAsked } from "@/src/qa";

import {
  ANSWER_KEY,
  ASKING_SAYS,
  exchangeIds,
  FAILURE_SAYS,
  NOTHING_ASKED_SAYS,
  NOTHING_ASKED_YET_SAYS,
  REFUSAL_KEY,
  REFUSAL_SAYS,
  SOURCE_SENTENCE_KEY,
  type Exchange,
} from "./question-view";
import "./question-box.css";

/**
 * The question box: what the reader wants to know, answered from their document or refused.
 *
 * It is anchored where the document ends rather than floating over it
 * (`.impeccable/surfaces/app-shell.md`). That is deliberate and not a layout preference: a
 * panel over the document hides the thing the reader is checking the answer against, and
 * checking it is the whole point.
 *
 * Each question carries the 2.75rem by 0.5rem ink tab above it, which is the tab-bar motif
 * (DESIGN.md), and a cited answer's source sentence sits in a cool-grey blockquote with a
 * 0.5rem ink underline beneath it. The field is the paste field's sibling: white, 2px ink
 * keyline, zero radius, cyan caret, a 3px cyan outline on focus with the field's own edge
 * unmoved, and a visible label above it in the label register.
 *
 * A refusal is a designed state and not error chrome. It gets the refusals bar from the
 * landing page at this register's scale, in ink. No red, no warning triangle, no icon: the
 * reader asked a fair question and their document is silent, which is information.
 *
 * What a screen reader gets. The list of exchanges is a polite live region, so an answer
 * announces itself when it arrives. Each exchange is an article labelled by its question,
 * and an answer's source sentence sits in a figure with a caption naming it, so the tie
 * between the answer and the sentence it came from is a real relationship in the markup
 * rather than proximity on the screen. An answer and a refusal each open with a key that
 * names the state in words, so which one arrived is the first thing read out.
 *
 * The empty box is checked here with `questionAsked`, the same function the seam uses, so
 * the browser saves a round trip without a second idea of what counts as a question. The
 * seam checks it again, because the route is reachable without this screen.
 */
export default function QuestionBox({
  exchanges,
  onAsk,
}: {
  exchanges: readonly Exchange[];
  /** Called with a question that has words in it. Never with an empty one. */
  onAsk: (question: string) => void;
}) {
  const base = useId();
  const fieldId = useId();
  const headingId = useId();
  const field = useRef<HTMLTextAreaElement>(null);

  const [typed, setTyped] = useState("");
  const [nothingAsked, setNothingAsked] = useState(false);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const asked = questionAsked(typed);
    if (asked === null) {
      setNothingAsked(true);
      field.current?.focus();
      return;
    }

    setNothingAsked(false);
    setTyped("");
    onAsk(asked);
  }

  return (
    <section className="qbox" aria-labelledby={headingId}>
      <h2 className="qbox__h" id={headingId}>Ask about your document</h2>
      <p className="qbox__lede">
        Ask anything about the document above. Answers come back with the sentence they came
        from, and questions your document does not answer come back refused.
      </p>

      <form className="qbox__form" onSubmit={onSubmit} noValidate>
        <label className="qbox__label" htmlFor={fieldId}>Your question</label>
        <textarea
          className="qbox__area"
          id={fieldId}
          ref={field}
          rows={2}
          value={typed}
          onChange={(event) => setTyped(event.target.value)}
          placeholder="Can they put my price up while I am a member?"
          spellCheck={false}
        />
        <div className="qbox__foot">
          <button className="qbox__btn" type="submit">
            <span>Ask</span>
            <svg className="qbox__arrow" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              <path
                d="M4 12h14m0 0-5.5-5.5M18 12l-5.5 5.5"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="square"
              />
            </svg>
          </button>
          <p className="qbox__said" role="status">
            {nothingAsked ? NOTHING_ASKED_SAYS : ""}
          </p>
        </div>
      </form>

      {exchanges.length === 0 ? (
        <p className="qbox__empty">{NOTHING_ASKED_YET_SAYS}</p>
      ) : (
        <ol className="qbox__list" aria-live="polite">
          {exchanges.map((exchange) => {
            const ids = exchangeIds(base, exchange.id);

            return (
              <li className="qbox__item" key={exchange.id}>
                <article className="qbox__row" aria-labelledby={ids.question}>
                  <h3 className="qbox__q" id={ids.question}>{exchange.question}</h3>

                  {exchange.state.kind === "asking" ? (
                    <p className="qbox__waiting">{ASKING_SAYS}</p>
                  ) : exchange.state.kind === "answered" ? (
                    <div className="qbox__a">
                      <p className="qbox__k" id={ids.key}>{ANSWER_KEY}</p>
                      <p className="qbox__say">{exchange.state.answer.text}</p>
                      <figure className="qbox__src" aria-labelledby={ids.sentence}>
                        <figcaption className="qbox__k" id={ids.sentence}>
                          {SOURCE_SENTENCE_KEY}
                        </figcaption>
                        <blockquote className="qbox__quote">
                          <p>{exchange.state.answer.sourceSentence.text}</p>
                        </blockquote>
                      </figure>
                    </div>
                  ) : exchange.state.kind === "refused" ? (
                    <div className="qbox__a qbox__a--refused">
                      <p className="qbox__k" id={ids.key}>{REFUSAL_KEY}</p>
                      <p className="qbox__refusal">
                        <span className="qbox__bar" aria-hidden="true" />
                        <span>{REFUSAL_SAYS}</span>
                      </p>
                    </div>
                  ) : (
                    <div className="qbox__a">
                      <p className="qbox__failed">{FAILURE_SAYS[exchange.state.reason]}</p>
                    </div>
                  )}
                </article>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
