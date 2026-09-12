# 08. What a flag says: two-tier consequence, document-granted exit, neutrality

**What to build:** Each flag tells the reader what the clause does to them, in
plain terms drawn from the clause's own text and bound to its source sentence.
Beneath that, where we have one, sits a fact from outside the document, marked as
external and carrying its own citation, so the reader can tell what their contract
says apart from what is known about clauses like it. The flag also surfaces any
deadline or opt-out the document itself grants, so the reader can act inside a
window they would otherwise miss.

"You cannot join a class action against them" is in the document. "Consumers win
only 9% of arbitrations" is CFPB data. The second is what makes the first land,
and presenting them in one voice would breach the rule the product rests on. They
are two different fields, not one string with a formatting convention (ADR 0007).

External context comes from a curated, sourced fact base we can review, not from
model recall, because its accuracy is ours rather than the document's.

Exit information covers only what the document states. Statutory rights go
unmentioned even where the reader holds them (ADR 0005).

Redline states plainly, where the reader will see it, that it does not account for
where they live and never says whether a clause is enforceable there. Silence
invites the reader to assume the flag is legally operative.

**Blocked by:** 04.

**Status:** done

- [x] Each flag carries a document-grounded consequence bound to its source sentence.
- [x] External context is a separate field with its own citation, rendered visibly apart from the document-grounded claim.
- [x] Every external citation resolves to a real source stating that fact. Checked offline against the wording recorded in the repository; a separate deliberate script checks the URLs are live and was run once, all four returning 200.
- [x] External facts come from a reviewable store, not from per-request model recall.
- [x] Exit information covers only deadlines and opt-outs the document states, each with a source sentence.
- [x] No statutory right is mentioned anywhere in a flag. Asserted over both fixtures and the whole fact base. Not enforced at runtime: dropping a verified flag on a word match would trade a visible false positive for an invisible false negative, and the decision on which way to fail is recorded in src/analysis/wording.ts rather than taken here.
- [x] Jurisdiction neutrality is stated where the reader will see it, not buried.
- [x] No sign or don't-sign verdict appears in a flag.
