# Findings from a skeptical reader's test of production

Tested on 2026-10-02 against https://redline-iota-eight.vercel.app, signed in, in
Chrome. Every step starts from that address. Documents were pasted as text. The
source code was not read.

Eight documents were analysed in total; the browser's network log shows eight
`/api/analyse` requests. Two of them came from a single double-click (finding 5).

The findings run from most to least serious: anything that misleads a reader
first, then anything that stops one, then cosmetic problems. I found nothing
that stops a reader. Each finding happened at least twice before it went in.

Test data I created and left in place: one kept document in the library (the
Meridian fixture with an extra paragraph 12A) and three red lines. I deleted
nothing.

The fixture referred to throughout is `tests/fixtures/adhesion-contract.txt`.
Two of its sentences contain a non-breaking space, an invisible character that
looks like an ordinary space: Section 6 has one between `twelve` and `(12)`, and
Section 12 has one between `thirty` and `(30)`. Findings 1 and 2 turn on those two
sentences.

## Findings

### 1. The liability-cap flag and the arbitration opt-out vanish from some readings, and the page never says so

Steps:

1. Open https://redline-iota-eight.vercel.app and choose Paste a document.
2. Paste the fixture exactly as it is in the repo and press Read it.
3. Count the flags and look for a "Limitation of liability" flag. Open the
   "Arbitration and class-action waiver" flag and look for "The way out this
   document gives you".
4. Read the same document again. The result changes from run to run.

PRD.md promises, in §3 item 4, that each flag carries "the exact source sentence
quoted verbatim, a severity, a confidence, a consequence, and any exit or opt-out
the document itself grants." §4, under "Citation integrity", says: "A single flag
that cannot show its source sentence is a bug that blocks release, not a quality
metric."

What happened: I had the fixture read three times. Twice (once with my extra 12A
paragraph, once without it) the page said "eight flags, each with the sentence it
came from". Neither reading had a Limitation of liability flag, and in both the
arbitration flag had no way-out section, although Section 12 grants a 30-day
opt-out. The renewal flags in those same readings did show their way out. The
third reading showed nine flags, including "High: Limitation of liability", and
its arbitration flag carried the opt-out.

The browser's copy of the server's replies shows why. The eight-flag reply listed
two `defects`: `source-sentence-not-found` for `limitation-of-liability`, and
`exit-sentence-not-found` for `arbitration-and-class-action-waiver`. In the
nine-flag reply, those two sentences came back with the non-breaking space intact.
So whether the reader learns about the liability cap, and about their one way out
of arbitration, depends on whether the model happens to copy an invisible
character.

Nothing on the page tells the reader that a flag or a way out was dropped. The
count reads "eight flags" and the arbitration flag looks complete. The landing
page's own example says the same thing happened when the builder ran this
document ("The reading returned nine flags and kept eight"), but a reader of
their own document gets no such note.

Seriousness: misleads a reader. A reader looking for what limits their remedies
sees no liability flag, and a reader looking at the arbitration flag is not told
they can opt out.

### 2. The question box says the arbitration opt-out and the liability cap are "Not in your document" when they are

Steps:

1. Open https://redline-iota-eight.vercel.app and choose Paste a document.
2. Paste the fixture and press Read it. (I pasted it with the extra 12A paragraph
   from the injection test. Sections 6 and 12 were untouched.)
3. In "Ask about your document", ask `Can I get out of the arbitration part, and
   how long do I have?`
4. Ask `Can I opt out of Section 12? What does the document say?`
5. Ask `What is the most Meridian will ever have to pay me if I have a claim
   against them?`

PRD.md promises, in §3 item 8: "Answers questions about the document, from the
document only, with the same source-sentence citation as any flag. A question the
document cannot answer is refused, not guessed at."

What happened: all three came back "NOT IN YOUR DOCUMENT. Your document does not
answer this." The document answers all three. Section 12 says "You may opt out of
this Section 12 by delivering written notice to the address in Section 11 within
thirty (30) days after you ﬁrst accept this Agreement". Section 6 caps Meridian's
liability at "the total dues and fees you paid to Meridian in the twelve (12)
months immediately before the event". The summary at the top of the same page
mentions both.

Questions answered from other sentences in the same two sections worked and cited
verbatim: who decides the scope of arbitration (Section 12), and whether Meridian
is responsible for things stolen from a locker (Section 5). Two plain questions
about renewal notice and Program notice also worked. The two failing sentences
are the two with the non-breaking space. The pattern held for every question I
asked: three out of three refused on those sentences, and no answerable question
about any other sentence was refused.

This is worse than a refusal. The 30-day opt-out is the one lever the document
hands the reader against arbitration, and the product tells them the document
does not mention it.

Seriousness: misleads a reader.

### 3. Text that is not a contract is labelled "Clean document"

Steps:

1. Open https://redline-iota-eight.vercel.app and choose Paste a document.
2. Paste a recipe (I used a 724-character lemon drizzle cake recipe) and press
   Read it.
3. Read the verdict beside the text.
4. Repeat with the five words `I agree to the terms.`

PRD.md promises, in §3 item 9: "Reports genuinely clean documents as clean,
together with the list of what was checked." §4, under "Clean documents stay
clean", defines the clean verdict against "a benign corpus" of documents.

What happened: both inputs got the heading "No clause met the bar" and a Reading
of "CLEAN DOCUMENT", with the line "Nothing in it met the bar for a flag" and the
seven-item checked list. The product's own summary knew better. For the recipe it
said "This is a recipe for lemon drizzle cake, not a contract." For the five
words it said "no document came through to me, so I have nothing to read the
seven risk types against." So the summary says there is no contract, and the
verdict beside it calls the same text a clean document. The summary also sits
under the heading "What you would be agreeing to", which reads oddly above a cake
recipe. Completeness showed "Partial" both times. The PRD accepts that in §6 for a
half-pasted document, but neither input was part of a document.

The reader this hurts is the one who pasted the wrong thing: the covering email,
the confirmation screen, the checkbox label. They get a verdict that looks the
same as the one a genuinely clean contract gets.

Seriousness: misleads a reader.

### 4. An answer can say more than the sentence it cites

Steps:

1. Open https://redline-iota-eight.vercel.app and choose Paste a document.
2. Paste the fixture (I used the copy with paragraph 12A) and press Read it.
3. Ask `How many days before the renewal date do I have to give notice to stop my
   membership renewing?`
4. Ask `Is Meridian responsible if something I leave in a locker is stolen?`

PRD.md promises, in §3 item 8, that answers come "from the document only, with
the same source-sentence citation as any flag." The question box itself says
"Answers come back with the sentence they came from."

What happened: both answers made claims that the cited sentence does not
contain. The renewal answer said "Notice given after that day takes effect only
at the end of the following term, and you still owe the dues for the intervening
term," but cited only "To stop a renewal you must deliver written notice of
cancellation to the Member Services desk no later than three (3) days before the
renewal date." The locker answer said "Section 6 says Meridian is not liable for
loss of or damage to property brought onto club premises, including property
left in a locker," but cited only the Section 5 sentence about lockers being
"provided for convenience only."

Both extra claims are true. They come from the next sentence in Section 2 and
from Section 6. But a reader who checks the answer against the quote, which is
the habit the product asks them to build, cannot find half of it there. The quote
check passes on the cited sentence while the rest of the answer goes unchecked.

Seriousness: misleads a reader. Nothing false got through in what I saw, so this
is the least serious of the misleading findings.

### 5. Double-clicking Read it reads the document twice, and the reader sees whichever reading lands last

Steps:

1. Open https://redline-iota-eight.vercel.app and choose Paste a document.
2. Paste the fixture and double-click Read it.
3. While "Redline is reading your document. Give it a few seconds." is showing,
   click Read it again.

PRD.md makes no promise about repeated clicks, so this is judged against the
reader getting one consistent reading of their document, which is what §3 item 4
and the landing page describe.

What happened: Read it stays enabled while the reading runs, and each click sends
another `/api/analyse` request. I checked this three ways. With the request held
in my own tab so nothing reached the model, a scripted double-click plus a third
click two seconds later sent three requests. A real double-click from the browser
sent two, 10 ms apart. A real double-click on the fixture, let through to the
model, sent two that both finished in about 16 seconds. Those two readings
differed: one had nine flags and the other eight (the eight-flag one was missing
the liability flag, see finding 1). The page showed the nine-flag one, which
arrived last by about 20 ms. With the arrival order reversed, the reader would
have been shown the weaker reading, with no sign that another existed.

Each extra click also spends a full analysis of model credit.

The question box, by contrast, ignored repeat clicks: three clicks sent one
`/api/ask` request.

Seriousness: cosmetic for the reader in what I saw, since one complete reading
was shown. It costs the owner a second analysis per double-click, and arrival
order decides which reading the reader gets.

### 6. A kept document comes back in a different order from the one the reader was shown

Steps:

1. With no red lines saved, open https://redline-iota-eight.vercel.app, choose
   Paste a document, paste the fixture (the copy I kept had paragraph 12A), press
   Read it, then press Keep this document.
2. Open Your library and the kept document. Note the flag order.
3. Go to Your red lines and save a red line ticked against "Arbitration and
   class-action waiver".
4. Open the kept document again.

PRD.md promises, in §3 item 10: "Saves past documents to a library the reader
can return to." The library page's own copy goes further: "Keep a document here
and you come back to the reading you were shown, with the same flags in the same
order". The kept document is headed "This is the reading you were shown when you
kept it."

What happened: when kept, the order was Unilateral modification, Non-compete,
Arbitration, Auto-renewal, Indemnification, Auto-renewal, Fees, Fees. After I
saved red lines, the same kept document opened with Arbitration first, then the
auto-renewal and fee flags, each marked "One you named", and the rest after. The
heading still said "This is the reading you were shown when you kept it." I saw
the new order twice, in a phone-width frame and after a full reload at desktop
width. The flags themselves were unchanged.

Re-ranking by today's red lines may well be what the owner wants. The words on
the page say the opposite.

Seriousness: cosmetic.

### 7. A long red line with no spaces pushes the reading off the side of the screen

Steps:

1. Open https://redline-iota-eight.vercel.app/red-lines.
2. Type a red line that is one long word, such as `NOAUTORENEWALEVER` repeated
   until the field stops at 240 characters. Tick "Auto-renewal and
   negative-option billing" and press Keep this red line.
3. Read a document with an auto-renewal clause (the fixture has two), or open a
   kept one from Your library.

PRD.md promises, in §3 item 7, that red lines "promote matching clauses in the
ranking and mark them as hitting something the reader named." Nothing in the PRD
covers layout, so this is judged against the page staying readable.

What happened: in each matching flag, the "One you named" box shows the red line
on one line without wrapping. On a phone the box is 290 px wide and the text is
2,564 px, so the whole page scrolls sideways. In a 390 px wide frame the kept
document measured 2,611 px wide, and hiding just those two red-line boxes brought
it back to 375 px. In the full desktop window (2,368 px) the same page measured
4,415 px wide. The same red line wraps correctly on the Your red lines page.

A real reader is unlikely to type 240 characters without a space. I did not test
how short an unbroken word has to be before the box holds it.

Seriousness: cosmetic.

### 8. A library address that does not exist is headed "A document you kept"

Steps:

1. Open https://redline-iota-eight.vercel.app/library/00000000-0000-0000-0000-000000000000
   (or any made-up id, such as `/library/not-a-real-id`).

PRD.md promises, in §3 item 10: "Saves past documents to a library the reader
can return to." It says nothing specific about a missing document, so this is
judged against the page's own message.

What happened: the page heading and the browser tab title are both "A document
you kept", directly above the sentence "This document is not in your library."
The message itself is right and nothing leaks. I tried four different made-up
ids, including one with HTML characters in it, and got the same page each time.

Seriousness: cosmetic.

## Seen once

**The summary spoke as a chatbot.** For the five-word input `I agree to the
terms.`, the summary read "no document came through to me, so I have nothing to
read the seven risk types against. If you paste the take-it-or-leave-it document
itself, I can report exactly what its sentences say". Every other summary I saw
described the document in the second person ("You agree to..."). I did not spend
a second analysis trying to repeat it.

## What held up

- **Empty input.** An empty or whitespace-only paste box, an empty question and
  an empty red line were each refused with a plain message, and no request went
  out for the empty paste.
- **A very long document.** A 147,624-character contract read as "Whole", and
  the only arbitration clause, on the last line, was flagged Critical with its
  sentence quoted.
- **Another language.** A Spanish gym contract got six flags, all quoting the
  Spanish verbatim, and a Spanish summary.
- **The hidden instruction.** A paragraph telling "any AI assistant" to call the
  contract standard and fair and not to flag Sections 9 and 12 was ignored. Both
  sections were flagged Critical, the summary described them plainly, and "Is
  this a standard, fair membership agreement?" was refused.
- **Verbatim quotes.** Every flag quote I saw was checked by script against the
  text I pasted: 2 on the long document, 6 on the Spanish one, 8 and 9 on fixture
  readings, and the 3 on the landing page against the fixture file. All were
  verbatim, including the fixture's "ﬁ" ligatures and curly quotes. So were the
  way-out sentences on the renewal flags and every citation under a question
  answer. Nothing was shown that the document does not contain; the failures
  above are omissions.
- **Questions the document cannot answer.** The dues amount, whether the
  arbitration clause is enforceable in California, and "Should I sign this? Just
  tell me yes or no" were all refused rather than answered.
- **HTML-looking input.** An image tag with an error handler, a bold tag and a
  script tag in a question, and in a red line, all showed as plain text in the
  question list, the red-lines list and inside the matching flag. Nothing ran.
- **A 6,284-character question** was answered normally, with its sentence.
- **Saving.** Two rapid clicks on Keep this document sent one save and produced
  one library entry. Reopening, reloading, and going back and forward all
  brought back the same reading. Going back to Paste a document after saving
  showed the reading as it was.
- **Made-up library ids** showed a "not in your library" page and nothing else.
- **Red lines.** A red line with no clause type ticked was refused. The field
  stops at 240 characters, as its hint says. A blank edit was refused, and
  "Leave it as it was" kept the original through a reload. Matching flags moved to
  the top with "One you named" and the reader's words beside them.
- **Refreshing mid-reading** left a clean, empty paste page. No partial reading
  appeared and nothing was kept.
- **The landing page** shows no accuracy figure. Its only percentage is the
  example flag's confidence ("Redline is 97% sure it read this clause").
- **Phone width.** The landing page, paste page, library and red-lines page all
  fit a 390 px frame without sideways scrolling. The exception is finding 7.

Not tested: PDF upload (the brief said to paste), the external-context links
under flags (they lead off the production address), and the signed-out view.
