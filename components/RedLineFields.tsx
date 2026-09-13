"use client";

import { useId } from "react";

import { CLAUSE_TYPES, type ClauseTypeSlug } from "@/src/domain/clause-types";
import { RED_LINE_LIMIT, type RedLineAsked } from "@/src/domain/red-lines";

/**
 * The two fields a red line is made of: the reader's words, and the kinds of clause
 * those words are about.
 *
 * One component, used to add a red line and to edit one, because they are the same two
 * fields and a second copy of them would be a second chance for the add form and the
 * edit form to disagree about what a red line is.
 *
 * The clause types are here rather than hidden behind a guess at what the reader meant.
 * A red line is free text and a flag is a clause type, and every way of matching one to
 * the other by reading the words either calls a model, which would put a model in front
 * of the order, or quietly fails: a reader who wrote "I will not be locked in for a
 * year" would never learn that nothing was ever checked for it. So the reader says which
 * kinds of clause their condition is about, in the same seven names Redline uses on every
 * flag, and the field above the boxes says what the boxes do.
 *
 * DESIGN.md has no field and no checkbox in it, and records that a disabled state is not
 * in this build. So: white field with the 2px ink keyline, the label register above it,
 * the global focus ring, and a box that is the bar motif at its smallest, a square of
 * ink inside an ink keyline. Nothing is greyed out and nothing is turned off; a button
 * that cannot do its job yet says so in words when it is pressed.
 */
export default function RedLineFields({
  values,
  onChange,
}: {
  values: RedLineAsked;
  onChange: (values: RedLineAsked) => void;
}) {
  const fieldId = useId();
  const countId = useId();
  const legendId = useId();

  const chosen = new Set(values.clauseTypes);

  function toggle(slug: ClauseTypeSlug) {
    const next = new Set(chosen);
    if (next.has(slug)) next.delete(slug);
    else next.add(slug);
    onChange({ ...values, clauseTypes: [...next] });
  }

  return (
    <>
      <label className="rl__label" htmlFor={fieldId}>
        What you will not accept
      </label>
      <input
        className="rl__field"
        id={fieldId}
        type="text"
        value={values.text}
        onChange={(event) => onChange({ ...values, text: event.target.value })}
        placeholder="I am not giving up the right to take them to court."
        maxLength={RED_LINE_LIMIT}
        aria-describedby={countId}
        autoComplete="off"
        spellCheck
      />
      <p className="rl__count" id={countId}>
        One condition, up to {RED_LINE_LIMIT} characters. Write it the way you would say
        it out loud.
      </p>

      <fieldset className="rl__types" aria-describedby={legendId}>
        <legend className="rl__label rl__legend">What Redline checks it against</legend>
        <p className="rl__note" id={legendId}>
          Redline reads every document for all seven of these. Tick the ones your condition
          is about, and those are the clauses that move to the top.
        </p>

        <ul className="rl-types">
          {CLAUSE_TYPES.map((type) => (
            <li key={type.slug}>
              <label className="rl-type">
                <input
                  type="checkbox"
                  checked={chosen.has(type.slug)}
                  onChange={() => toggle(type.slug)}
                />
                <span>{type.label}</span>
              </label>
            </li>
          ))}
        </ul>
      </fieldset>
    </>
  );
}
