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

**Delete `vercel.json` as part of this ticket.** It exists only because the
landing page shipped before any framework did, and it sets `framework` to null
and `outputDirectory` to `landing`. Both actively block Vercel from detecting
Next.js and switch off server rendering, routing, image optimisation and API
routes. Vercel auto-detects Next.js from `package.json`, so removing the file is
the whole fix. If Vercel config is needed later for headers, redirects or cron,
re-add a `vercel.json` carrying only those keys. Root Directory is a dashboard
setting and cannot be set in `vercel.json` at all.

**Blocked by:** None. Can start immediately.

**Status:** done

- [x] The app runs locally with one page holding a paste box and a submit action.
- [x] Submitting renders the pasted text back character for character, including whitespace, smart quotes, ligatures and line breaks.
- [x] A character count is shown alongside the text.
- [x] A test runner is wired, with one command that runs the suite.
- [x] At least one test asserts round-trip fidelity of text containing smart quotes, ligatures and irregular whitespace.
- [x] No document text is persisted anywhere.
- [x] `vercel.json` is deleted and the Vercel deploy builds as a Next.js project.
