/**
 * The rail: the navigation for every screen behind the paste box.
 *
 * It carries the mark, the places a reader can go, and who is signed in. DESIGN.md
 * records the composition and the rule that there is no horizontal nav, no dropdown
 * and no mobile menu: at 860px the rail becomes a static top band and stays fully
 * visible.
 *
 * It takes the account as a value and holds no state of its own, which is what keeps
 * a Supabase client out of the reading surface's browser bundle. The paste screen
 * asks a route who is signed in; the library and sign-in screens are rendered on the
 * server and already know. Both hand the answer here.
 *
 * `account` is null while the paste screen is still asking. The block says nothing
 * in that moment rather than guessing, because guessing means either offering to
 * keep a document Redline cannot keep or telling a signed-in reader to sign in.
 */

import type { AccountState } from "@/src/account/state";

import "./rail.css";

/**
 * Where in the product the reader is. One of these per screen, and "elsewhere" for a
 * screen the rail does not list, so that no row is marked as the current page when
 * none of them is.
 */
export type RailPlace = "paste" | "library" | "red-lines" | "elsewhere";

type Place = { readonly place: RailPlace; readonly href: string; readonly label: string };

/**
 * The places, in the order a reader meets them: they arrive with a document, what
 * they keep is next, and the red lines they check documents against are last.
 *
 * The paste box sits at `/analyse`; the root belongs to the landing page, which the
 * mark above leads back to (ticket 14).
 */
const PLACES: readonly Place[] = [
  { place: "paste", href: "/analyse", label: "Paste a document" },
  { place: "library", href: "/library", label: "Your library" },
  { place: "red-lines", href: "/red-lines", label: "Your red lines" },
];

export default function Rail({
  current,
  account,
}: {
  current: RailPlace;
  account: AccountState | null;
}) {
  return (
    <header className="rail">
      <div className="rail__top">
        <a className="mark" href="/" aria-label="Redline, home">
          <span className="mark__box" aria-hidden="true">R</span>
          <span className="mark__word">REDLINE</span>
        </a>

        <nav aria-label="Redline">
          <ul className="rail-nav">
            {PLACES.map(({ place, href, label }) => (
              <li key={place}>
                <a href={href} aria-current={place === current ? "page" : undefined}>
                  {label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </div>

      <div className="rail__foot">
        {account === null ? null : account.kind === "signed-in" ? (
          <>
            <p className="rail__who">{account.reader.email ?? "Signed in"}</p>
            <form className="rail__out" method="post" action="/auth/sign-out">
              <button className="rail__link" type="submit">Sign out</button>
            </form>
          </>
        ) : account.kind === "signed-out" ? (
          <>
            <p className="rail__note">
              Your library and your red lines sit behind an account. Reading a document
              works without one.
            </p>
            <a className="rail__link" href="/sign-in">Sign in</a>
          </>
        ) : (
          <>
            <p className="rail__note">
              There is no Supabase project set up here, so Redline has nowhere to keep
              a document. Reading one still works.
            </p>
            <p className="rail__note">
              Set {account.missing.join(" and ")} and the library opens.
            </p>
          </>
        )}
      </div>
    </header>
  );
}
