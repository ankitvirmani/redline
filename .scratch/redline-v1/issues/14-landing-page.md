# 14. Landing page: say what Redline does, hand the reader to the paste box

**What to build:** A reader who has never used Redline arrives, understands
within seconds what it does and why it is different from pasting their document
into a chatbot, and reaches the paste box in one step.

The page claims the mechanism, which is that every flag quotes the sentence it
came from and the quote is checked in code before it is shown. It does not claim
accuracy. Redline has no measured accuracy: the recall and precision thresholds
in `PRD.md` §4 are proposed and uncalibrated, and the suite that would produce
real numbers is ticket 13 and has not run.

Every sentence on the page must trace to an entry in the landing-page claims list
in `PRODUCT.md` under Evidence on Hand. That list is the authority, not taste. It
enumerates the mechanisms the product performs, the external facts and their
citations, and what may never be said. A sentence that traces to no entry needs a
decision before it ships.

The page may compare against a general chatbot at mechanism level: what each tool
structurally can and cannot do. A chatbot cannot show the sentence a claim came
from, and Redline cannot show a flag unless it can. It may not say Redline is more
accurate, more reliable, or better, because nothing has measured that. "Better
than a chatbot" is the same untested capability claim as a number, without the
number.

The absences in `PRODUCT.md` must not be filled in with invention: no readers, no
testimonials, no customers, no reviews, no benchmark.

This is the one surface in the product whose job is persuasion rather than
analysis, which makes it the easiest place to breach the rule the rest of it is
built on. An untested capability claim is the specific thing the FTC fined
DoNotPay $193,000 for, and `PRD.md` cites that three times.

The page owns the root route. Ticket 01 put the paste box there; moving it to its
own route is part of this ticket.

The page touches no seam of its own: no model call, no storage, no auth, no
analysis state. It blocks on ticket 08 anyway, because the strongest thing it can
do is show a real flag with its source sentence, and showing a mockup instead
would breach the rule the product rests on.

All copy runs through the humanizer skill before it is committed (`CLAUDE.md`
standing rule). The glossary in `CONTEXT.md` governs every word, avoid-lists
included: reader, not user.

**Blocked by:** 01, 08.

**Status:** ready-for-agent

- [ ] A reader who has never used Redline can tell what it does from the first viewport.
- [ ] The page states what makes Redline different from pasting a document into a chatbot, at mechanism level only, with no claim of being more accurate, more reliable, or better.
- [ ] The paste box is reachable in one step from the page.
- [ ] Every sentence on the page traces to an entry in the `PRODUCT.md` landing-page claims list.
- [ ] Every external claim carries a citation that resolves to a real source stating that fact.
- [ ] No accuracy figure, success rate, or performance benchmark appears anywhere in the copy.
- [ ] No testimonial, customer name, user count, review, or case study appears, because none exist.
- [ ] Product imagery shows real rendered output from ticket 08, never a mockup.
- [ ] The landing page is served at the root route and the paste box has moved to its own.
- [ ] The page states that Redline does not give legal advice and does not account for where the reader lives.
- [ ] The page never tells a reader whether to sign, in words or by implication.
- [ ] The page renders with no model call, no call to the analysis path, and no auth requirement.
- [ ] Copy has been run through the humanizer skill before commit.
- [ ] Meets WCAG 2.2 AA.
