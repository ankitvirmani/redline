/**
 * Signing in.
 *
 * Rendered on the server so that a reader who is already signed in is told so rather
 * than shown a form they do not need. Which state the screen is in is decided here;
 * the form itself is the one client component in the product that builds a Supabase
 * client, because the browser has to start the exchange the callback route finishes.
 */

import Gate from "@/components/Gate";
import Shell from "@/components/Shell";
import SignInForm from "@/components/SignInForm";
import { accountState } from "@/src/supabase/server";

import "@/components/sign-in.css";

export const metadata = { title: "Sign in to Redline" };

/** What the screen says when the link it sent did not work. */
const LINK_DID_NOT_WORK =
  "That link did not sign you in. It may have been used already, or it may have expired. Send another one.";

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ readonly link?: string }>;
}) {
  const account = await accountState();
  const { link } = await searchParams;

  if (account.kind === "no-project") {
    return (
      <Shell place="elsewhere" account={account}>
        <Gate account={account} heading="Sign in" what="Signing in" />
      </Shell>
    );
  }

  if (account.kind === "signed-in") {
    return (
      <Shell place="elsewhere" account={account}>
        <section className="in">
          <h1 className="in__h">You are signed in</h1>
          <p className="in__lede">
            {account.reader.email === null
              ? "Your library holds the documents you keep."
              : `You are signed in as ${account.reader.email}. Your library holds the documents you keep.`}
          </p>
          <a className="btn btn--primary btn--lg btn--inline" href="/library">
            <span>Open your library</span>
          </a>
        </section>
      </Shell>
    );
  }

  return (
    <Shell place="elsewhere" account={account}>
      <section className="in">
        <h1 className="in__h">Sign in</h1>
        <p className="in__lede">
          An account holds two things: the documents you keep, and the red lines you
          check them against. Reading a document needs neither.
        </p>

        {link === undefined ? null : (
          <p className="said">
            <span>{LINK_DID_NOT_WORK}</span>
          </p>
        )}

        <SignInForm />
      </section>
    </Shell>
  );
}
