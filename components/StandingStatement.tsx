"use client";

import { useId } from "react";

import { STANDING_STATEMENT } from "./standing-statement";
import "./standing-statement.css";

/**
 * What Redline does not tell the reader, said once on every analysis.
 *
 * Two statements, both of them commitments rather than small print. Redline does not
 * account for where the reader lives and never says whether a clause holds up there
 * (ADR 0005), and Redline describes documents rather than giving legal advice
 * (`PRODUCT.md`, Brand Commitments). Silence on either invites a reader to assume a
 * flag is legally operative where they live, which is the failure ADR 0005 exists to
 * prevent.
 *
 * Where it sits, and why. At the head of the flags, above the first flag, on the way
 * in rather than in a footer: a reader who reads the flags meets it without going
 * looking, which is the whole of what "not buried" means. It is said once per analysis
 * rather than on every flag. Repeated nine times down a column it would read as
 * boilerplate the eye learns to skip, and it would compete for attention with the
 * source sentences, which are the thing on this screen a reader has to actually read.
 *
 * A real `aside` with a real heading, so a screen reader announces it as its own
 * region and can skip it or come back to it. It carries no flag ink: it identifies
 * nothing and ranks nothing.
 */
export default function StandingStatement() {
  const headingId = useId();

  return (
    <aside className="standing" aria-labelledby={headingId}>
      <h3 className="standing__k" id={headingId}>
        {STANDING_STATEMENT.heading}
      </h3>
      <p className="standing__say">{STANDING_STATEMENT.jurisdiction}</p>
      <p className="standing__say">{STANDING_STATEMENT.legalAdvice}</p>
    </aside>
  );
}
