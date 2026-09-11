# 06. Ranking seam: order by leverage lost, with no model call

**What to build:** Flags arrive unordered and leave ordered by how much leverage
the clause takes from the reader: their ability to sue, to leave, or to refuse a
change. A standard-but-harmful clause therefore outranks a rare-but-trivial one.

Ubiquity is not safety. Arbitration clauses appear in nearly every consumer
contract and rank first here; ordering by how unusual a clause is would bury them
and surface harmless oddities instead (ADR 0003).

Ranking consumes severity, it does not compute it. It contains no model call, no
network and no database, which is what makes ordering deterministic and cheap to
assert.

Confidence is a separate signal carried on the flag. How sure we are that a
clause is what we think it is, is a different question from how much it costs, so
it does not move the order.

**Blocked by:** 04.

**Status:** ready-for-agent

- [ ] Ranking is a pure function over flags, with no model call, network call or database access.
- [ ] In a document containing both, arbitration outranks a merely unusual clause.
- [ ] Ties break on leverage lost.
- [ ] Confidence does not affect order.
- [ ] The reader sees flags in ranked order.
- [ ] Tested as pure-function tests over fixed flag sets.
