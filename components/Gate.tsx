/**
 * What an account-gated screen says when it cannot show what the reader came for.
 *
 * Two states, and neither is an error.
 *
 * A build with no Supabase project is the first of them, and it is the state the
 * owner meets before the project exists. It says so in product copy and names the two
 * variables that are unset, because the person reading it is the person who can set
 * them. The reading surface is untouched by it: a document still goes in and a reading
 * still comes back.
 *
 * A reader who is not signed in is the second. Only the library and the red lines ask
 * for an account, so this says what sits behind it and says that the paste box does
 * not.
 */

import type { AccountState } from "@/src/account/state";

import "./gate.css";

export type GateState = Extract<
  AccountState,
  { readonly kind: "no-project" } | { readonly kind: "signed-out" }
>;

export const NO_PROJECT_KEY = "No project configured";
export const SIGN_IN_KEY = "Sign in first";

export default function Gate({
  account,
  heading,
  what,
}: {
  account: GateState;
  /** The screen's own heading, so the reader knows where they are. */
  heading: string;
  /** What needs the account, as the subject of a sentence: "Your library". */
  what: string;
}) {
  return (
    <section className="gate">
      <h1 className="gate__h">{heading}</h1>

      {account.kind === "no-project" ? (
        <div className="gate__body">
          <p className="gate__k">{NO_PROJECT_KEY}</p>
          <p className="gate__say">
            {what} needs a Supabase project to sit in, and this build has none yet.
            Reading a document needs no project at all, so the paste box still works.
          </p>
          <p className="gate__note">
            Set{" "}
            {account.missing.map((name, index) => (
              <span key={name}>
                {index === 0 ? "" : " and "}
                <code>{name}</code>
              </span>
            ))}{" "}
            in <code>.env.local</code>, run the migrations in{" "}
            <code>supabase/migrations</code>, and this page opens.
          </p>
          <a className="btn btn--primary btn--lg btn--inline" href="/analyse">
            <span>Read a document</span>
          </a>
        </div>
      ) : (
        <div className="gate__body">
          <p className="gate__k">{SIGN_IN_KEY}</p>
          <p className="gate__say">
            {what} is yours alone, so it sits behind an account. The paste box asks for
            nothing, so you can read a document either way.
          </p>
          <a className="btn btn--primary btn--lg btn--inline" href="/sign-in">
            <span>Sign in</span>
          </a>
        </div>
      )}
    </section>
  );
}
