"use client";

/**
 * The reader's red lines: the list, and the three things they can do to it.
 *
 * The list arrives from the server, where the session cookie already is, and every
 * change goes through `/api/red-lines` and comes back as the whole list. So what is on
 * the screen is what is in the table, rather than a copy of it that drifted on the first
 * request that did not land. This is the list a reader will hold a contract against;
 * being nearly right about it is not good enough.
 *
 * What a red line does, and the copy says so before the field does: it moves a matching
 * clause to the top of the list on a document. It does not stop anything, refuse
 * anything, or decide anything (ADR 0008). There is no count on this screen and no count
 * on a reading, because "this document breaks two of your red lines" is the verdict this
 * product refuses, arriving as a number.
 *
 * Removing is one press and there is no dialog in front of it. What makes that safe is
 * that the red line comes back from the route when it goes, so the line under the list
 * offers to put it back, in the reader's own words. A browser `confirm()` is not in this
 * world and a modal would be the first one in the product.
 *
 * DESIGN.md records that a disabled state is not in this build, so nothing here is
 * greyed out. A request in flight is carried on the label and by `aria-busy`, as it is
 * on the action that keeps a document, and a form pressed with nothing in it says what
 * is missing instead of being unpressable.
 */

import { useId, useRef, useState } from "react";

import { clauseTypeLabel } from "@/src/domain/clause-types";
import {
  checksNothing,
  redLineWritten,
  type RedLine,
  type RedLineAsked,
} from "@/src/domain/red-lines";
import { readRedLinesReply, type RedLinesReply } from "@/src/red-lines/written";

import RedLineFields from "./RedLineFields";
import "./red-lines.css";

const NOTHING_WRITTEN =
  "There is nothing in the field yet. Write the condition you will not accept.";

const NOTHING_TICKED =
  "Tick at least one kind of clause. Redline has to know what to check your condition against, and it will not guess.";

const TOO_LONG =
  "That is too long for one red line. Cut it to a single condition and Redline will keep it.";

const DID_NOT_SAVE =
  "Redline did not save that. Your red lines are as they were, so try it again.";

const GONE = "That red line is not there any more. Reload the page to see the list as it stands.";

const NO_ACCOUNT =
  "You have been signed out. Sign in and your red lines are all still here.";

const NO_PROJECT =
  "There is no Supabase project set up here, so Redline has nowhere to keep a red line.";

/** What Redline says back about a reply that was not the list. */
function saidAbout(reply: RedLinesReply | null): string {
  if (reply === null) return DID_NOT_SAVE;
  switch (reply.outcome) {
    case "no-words":
      return NOTHING_WRITTEN;
    case "nothing-to-check":
      return NOTHING_TICKED;
    case "too-long":
      return TOO_LONG;
    case "not-found":
      return GONE;
    case "no-account":
      return NO_ACCOUNT;
    case "no-project":
      return NO_PROJECT;
    default:
      return DID_NOT_SAVE;
  }
}

/** An empty red line, for the add form and for the start of an edit. */
const NOTHING_YET: RedLineAsked = { text: "", clauseTypes: [] };

/** What the reader is in the middle of. One at a time, so nothing is half-saved twice. */
type Doing =
  | { readonly kind: "nothing" }
  | { readonly kind: "adding" }
  | { readonly kind: "saving"; readonly id: string }
  | { readonly kind: "removing"; readonly id: string };

/** What just happened, as a line under the list. */
type Said =
  | { readonly kind: "nothing" }
  | { readonly kind: "said"; readonly says: string }
  | { readonly kind: "removed"; readonly redLine: RedLine };

export default function RedLines({ redLines: kept }: { redLines: readonly RedLine[] }) {
  const listId = useId();
  const [redLines, setRedLines] = useState<readonly RedLine[]>(kept);
  const [adding, setAdding] = useState<RedLineAsked>(NOTHING_YET);
  const [editing, setEditing] = useState<{
    readonly id: string;
    readonly values: RedLineAsked;
  } | null>(null);
  const [doing, setDoing] = useState<Doing>({ kind: "nothing" });
  const [said, setSaid] = useState<Said>({ kind: "nothing" });

  // Whether a request is already on its way. A ref rather than the state above, because
  // two presses in the same tick both read the same state and would both post, and a
  // reader who double-clicked would find the same red line twice in their list.
  const sending = useRef(false);

  async function ask(
    method: "POST" | "PUT" | "DELETE",
    body: unknown,
    was: Doing,
  ): Promise<RedLinesReply | null> {
    sending.current = true;
    setDoing(was);
    try {
      const response = await fetch("/api/red-lines", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        cache: "no-store",
      });
      return readRedLinesReply(await response.json());
    } catch {
      return null;
    } finally {
      sending.current = false;
      setDoing({ kind: "nothing" });
    }
  }

  async function add(values: RedLineAsked) {
    if (sending.current) return;
    // The same rule the route runs and the same rule the column holds to. It is asked
    // here as well so that a field with nothing in it is answered without a round trip.
    const written = redLineWritten(values);
    if (written.outcome !== "written") {
      setSaid({ kind: "said", says: saidAbout(written) });
      return;
    }

    const reply = await ask("POST", written.writing, { kind: "adding" });
    if (reply?.outcome !== "listed") {
      setSaid({ kind: "said", says: saidAbout(reply) });
      return;
    }

    setRedLines(reply.redLines);
    setAdding(NOTHING_YET);
    setSaid({ kind: "nothing" });
  }

  async function save(id: string, values: RedLineAsked) {
    if (sending.current) return;
    const written = redLineWritten(values);
    if (written.outcome !== "written") {
      setSaid({ kind: "said", says: saidAbout(written) });
      return;
    }

    const reply = await ask("PUT", { id, ...written.writing }, { kind: "saving", id });
    if (reply?.outcome !== "listed") {
      setSaid({ kind: "said", says: saidAbout(reply) });
      return;
    }

    setRedLines(reply.redLines);
    setEditing(null);
    setSaid({ kind: "nothing" });
  }

  async function remove(redLine: RedLine) {
    if (sending.current) return;
    const reply = await ask("DELETE", { id: redLine.id }, { kind: "removing", id: redLine.id });
    if (reply?.outcome !== "removed") {
      setSaid({ kind: "said", says: saidAbout(reply) });
      return;
    }

    setRedLines(reply.redLines);
    if (editing?.id === redLine.id) setEditing(null);
    setSaid({ kind: "removed", redLine: reply.removed });
  }

  /**
   * Putting back the red line that was just removed, in the words it was written in.
   *
   * It comes back as a new row, so it joins the end of the list rather than the place it
   * held. The list is in the order the reader wrote them and that is now true again; what
   * is not recovered is its old position. The offer lasts as long as the screen does,
   * which is the same as the line that makes it.
   */
  async function putBack(redLine: RedLine) {
    if (sending.current) return;
    const reply = await ask(
      "POST",
      { text: redLine.text, clauseTypes: redLine.clauseTypes },
      { kind: "adding" },
    );
    if (reply?.outcome !== "listed") {
      setSaid({ kind: "said", says: saidAbout(reply) });
      return;
    }
    setRedLines(reply.redLines);
    setSaid({ kind: "nothing" });
  }

  return (
    <>
      {redLines.length === 0 ? (
        <div className="rl-none">
          <p className="rl-none__k">Nothing named yet</p>
          <p className="rl-none__say">
            Name what you will not accept, and Redline puts that kind of clause first the
            next time it reads a document for you, with your own words next to it. Nothing
            else about the reading changes, so naming none costs you nothing.
          </p>
          <p className="rl-none__note">
            Your red lines are yours. Nobody else can read them, and Redline does nothing
            with them but decide what you see first.
          </p>
        </div>
      ) : (
        <>
        <h2 className="rl__k" id={listId}>In the order you named them</h2>
        <ul className="rl-list" aria-labelledby={listId}>
          {redLines.map((redLine) => {
            const edit = editing !== null && editing.id === redLine.id ? editing : null;
            const saving = doing.kind === "saving" && doing.id === redLine.id;
            const removing = doing.kind === "removing" && doing.id === redLine.id;

            return (
              <li className="rl-list__item" key={redLine.id}>
                {edit !== null ? (
                  <form
                    className="rl-edit"
                    onSubmit={(event) => {
                      event.preventDefault();
                      void save(redLine.id, edit.values);
                    }}
                  >
                    <RedLineFields
                      values={edit.values}
                      onChange={(values) => setEditing({ id: redLine.id, values })}
                    />
                    <div className="rl-edit__do">
                      <button className="btn btn--primary" type="submit" aria-busy={saving}>
                        <span>{saving ? "Saving it" : "Save this red line"}</span>
                      </button>
                      <button
                        className="btn btn--ghost"
                        type="button"
                        onClick={() => {
                          setEditing(null);
                          setSaid({ kind: "nothing" });
                        }}
                      >
                        <span>Leave it as it was</span>
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className="rl-row">
                    <p className="rl-row__says">{redLine.text}</p>

                    {checksNothing(redLine) ? (
                      <p className="rl-row__nothing">
                        Redline checks nothing against this one. Edit it and name at least
                        one kind of clause.
                      </p>
                    ) : (
                      <p className="rl-row__against">
                        <span className="rl-row__k">Checked against</span>
                        {redLine.clauseTypes.map(clauseTypeLabel).join(", ")}
                      </p>
                    )}

                    <div className="rl-row__do">
                      <button
                        className="btn btn--ghost rl-row__btn"
                        type="button"
                        onClick={() => {
                          setEditing({
                            id: redLine.id,
                            values: { text: redLine.text, clauseTypes: redLine.clauseTypes },
                          });
                          setSaid({ kind: "nothing" });
                        }}
                      >
                        <span>Edit</span>
                        <span className="rl-which"> the red line: {redLine.text}</span>
                      </button>
                      <button
                        className="btn btn--ghost rl-row__btn"
                        type="button"
                        onClick={() => void remove(redLine)}
                        aria-busy={removing}
                      >
                        <span>{removing ? "Removing" : "Remove"}</span>
                        <span className="rl-which"> the red line: {redLine.text}</span>
                      </button>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
        </>
      )}

      <div className="rl-said" role="status">
        {said.kind === "said" ? (
          <p className="said">
            <span>{said.says}</span>
          </p>
        ) : said.kind === "removed" ? (
          <p className="said said--done">
            <span>
              That red line is off your list.{" "}
              <button
                className="rl-undo"
                type="button"
                onClick={() => void putBack(said.redLine)}
              >
                Put it back
                <span className="rl-which">: {said.redLine.text}</span>
              </button>
            </span>
          </p>
        ) : null}
      </div>

      <form
        className="rl-add"
        onSubmit={(event) => {
          event.preventDefault();
          void add(adding);
        }}
        noValidate
      >
        <h2 className="rl-add__h">
          {redLines.length === 0 ? "Name your first red line" : "Name another red line"}
        </h2>
        <RedLineFields values={adding} onChange={setAdding} />
        <button
          className="btn btn--primary btn--lg rl-add__go"
          type="submit"
          aria-busy={doing.kind === "adding"}
        >
          <span>{doing.kind === "adding" ? "Keeping it" : "Keep this red line"}</span>
        </button>
      </form>
    </>
  );
}
