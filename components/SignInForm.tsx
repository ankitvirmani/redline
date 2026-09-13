/**
 * Signing in: one address, one link in an email.
 *
 * There is no password here on purpose. A password would mean holding one, resetting
 * one, and being the reason someone's reused password matters, for a product whose
 * whole job is reading documents people are about to sign. A link in an email needs
 * none of that. It does need the project to be able to send mail, which is written
 * down in `supabase/README.md`.
 *
 * The form sends the address to Supabase from the browser, which is what puts the
 * PKCE verifier in a cookie where `/auth/callback` can finish the sign-in on the
 * server. This is the only screen in the product that builds a client in the browser.
 *
 * A sign-in that did not go through is product copy tied to the field it is about,
 * not error chrome. DESIGN.md records that error states are not in the build and are
 * not to be invented in passing, so this one is the tab-bar motif every other state
 * uses: a bar, then the sentence.
 */

"use client";

import { useId, useState, type FormEvent } from "react";

import { browserClient } from "@/src/supabase/browser";

import "./sign-in.css";

/** Where the form has got to. */
type Sending =
  | { readonly kind: "not-yet" }
  | { readonly kind: "sending" }
  | { readonly kind: "sent"; readonly to: string }
  | { readonly kind: "refused"; readonly says: string };

const NOT_AN_ADDRESS = "That does not look like an email address. Check it and send again.";

const NO_CLIENT =
  "Redline has no Supabase project set up, so it cannot send you a link. Reading a document still works.";

const DID_NOT_SEND =
  "The link did not go out. Nothing happened to your account, so send it again.";

export default function SignInForm() {
  const fieldId = useId();
  const saidId = useId();
  const noteId = useId();

  const [address, setAddress] = useState("");
  const [sending, setSending] = useState<Sending>({ kind: "not-yet" });

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (sending.kind === "sending") return;

    const written = address.trim();
    // The one check made here. Anything more would be a guess at what an address may
    // look like, and the project itself is the thing that knows whether mail arrives.
    if (written.length === 0 || !written.includes("@")) {
      setSending({ kind: "refused", says: NOT_AN_ADDRESS });
      return;
    }

    const supabase = browserClient();
    if (supabase === null) {
      setSending({ kind: "refused", says: NO_CLIENT });
      return;
    }

    setSending({ kind: "sending" });

    const { error } = await supabase.auth.signInWithOtp({
      email: written,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });

    setSending(
      error === null ? { kind: "sent", to: written } : { kind: "refused", says: DID_NOT_SEND },
    );
  }

  if (sending.kind === "sent") {
    return (
      <div className="in__sent">
        <p className="said said--done" role="status">
          <span>
            A link is on its way to {sending.to}. Open it and you are signed in. It
            works once, and there is no password to remember.
          </span>
        </p>
        <p className="in__note">
          Open it in this browser. The sign-in starts here and finishes here, so a
          link opened somewhere else will ask you for a new one.
        </p>
      </div>
    );
  }

  const refused = sending.kind === "refused";

  return (
    <form className="in__form" onSubmit={(event) => void onSubmit(event)} noValidate>
      <label className="in__label" htmlFor={fieldId}>Your email address</label>
      <input
        className="in__field"
        id={fieldId}
        type="email"
        name="email"
        value={address}
        onChange={(event) => setAddress(event.target.value)}
        placeholder="you@example.com"
        autoComplete="email"
        aria-describedby={refused ? `${saidId} ${noteId}` : noteId}
        aria-invalid={refused ? true : undefined}
      />

      <button className="btn btn--primary btn--lg in__go" type="submit" aria-busy={sending.kind === "sending"}>
        <span>{sending.kind === "sending" ? "Sending the link" : "Send me a link"}</span>
      </button>

      {refused ? (
        <p className="said" id={saidId} role="alert">
          <span>{sending.says}</span>
        </p>
      ) : null}

      <p className="in__note" id={noteId}>
        Redline emails you a link instead of asking for a password. Your address is
        what your library and your red lines belong to, and Redline does nothing else
        with it.
      </p>
    </form>
  );
}
