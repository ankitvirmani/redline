# 5. v1 is jurisdiction-neutral

Redline describes what a clause says and what it does. It does not state whether
the clause is enforceable where the reader lives, and it says openly that it does
not.

## Why

Enforceability is not in the document, and ADR 0001 commits us to stating only
what the document supports. The variation is not marginal: non-competes are void
in California and enforced in Florida, the FTC's non-compete rule was blocked in
August 2024 so there is no federal baseline, and auto-renewal statutes differ by
state. A correctly cited sentence can still produce a wrong consequence once
jurisdiction is asserted.

## Consequences

- A reader in California gets a non-compete flagged at full severity when it may
  bind nobody. This is the cost, and it lands at the exact point readers most want
  an answer.
- Redline must state its neutrality prominently. Silence invites the reader to
  assume the flag is legally operative where they live.
