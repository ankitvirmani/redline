# 01. Walking skeleton: paste a document, see it back verbatim

**What to build:** A reader opens the app, pastes a document into a box, submits,
and sees exactly what they pasted rendered back, character for character, with a
count. Nothing is analysed and nothing is stored.

This is the first code in the repo. Its real job is to stand the app up and set
the testing convention every later ticket follows, so the round-trip fidelity
test matters more than the page does.

Runs locally only. Deploying to Vercel is the owner's call and is deliberately
not part of this ticket.

Put the paste box at the root for now. Ticket 14 later takes the root route for
the landing page and moves this page to its own; that move is 14's work, not
this ticket's.

**Blocked by:** None. Can start immediately.

**Status:** ready-for-agent

- [ ] The app runs locally with one page holding a paste box and a submit action.
- [ ] Submitting renders the pasted text back character for character, including whitespace, smart quotes, ligatures and line breaks.
- [ ] A character count is shown alongside the text.
- [ ] A test runner is wired, with one command that runs the suite.
- [ ] At least one test asserts round-trip fidelity of text containing smart quotes, ligatures and irregular whitespace.
- [ ] No document text is persisted anywhere.
