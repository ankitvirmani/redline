/**
 * The frame every screen sits in: the rail, and the reading field beside it.
 *
 * One component so that the shell is the same shape on every screen and the rail
 * cannot quietly differ between them. It holds no state and reads nothing: the account
 * comes in as a value, which is what keeps a Supabase client out of the reading
 * surface's bundle.
 */

import Rail, { type RailPlace } from "@/components/Rail";
import type { AccountState } from "@/src/account/state";

import type { ReactNode } from "react";

export default function Shell({
  place,
  account,
  skip,
  children,
}: {
  place: RailPlace;
  account: AccountState | null;
  /** Where the skip link goes, when a screen has somewhere better than its start. */
  skip?: { readonly href: string; readonly says: string };
  children: ReactNode;
}) {
  const to = skip ?? { href: "#main", says: "Skip to the main content" };

  return (
    <>
      <a className="skip" href={to.href}>{to.says}</a>

      <div className="shell">
        <Rail current={place} account={account} />
        <main className="main" id="main">
          {children}
        </main>
      </div>
    </>
  );
}
