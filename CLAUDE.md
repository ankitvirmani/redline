# Redline

A web app where someone reading a take-it-or-leave-it document — terms of
service, a subscription, a gym membership, an offer letter — finds out what
signing costs them.

## What it does

- Plain-English summary of the document.
- Clauses that could hurt them, ranked by severity, each showing its exact source sentence.
- A question box that answers only from the document.
- An editable list of the reader's red lines, which promote matching clauses.
- A saved library of their past documents.
- A landing page that says what Redline does and hands the reader to the paste box.

## Settled — do not reopen

- Next.js, Supabase for auth and database, deployed on Vercel.
- Model calls go through OpenRouter.
- Documents are parsed in the browser. Only the extracted text is stored.

## The rule the product rests on

Every risk flag cites the exact sentence it came from. A flag whose source
sentence cannot be shown is a bug, not a rough edge.

State only what the document says. Where the text does not support a claim, the
product does not make it.

## Scope

Build the capabilities listed above and stop there. When something looks like the
obvious next step and is not on that list, ask first.

Excluded on purpose: payments and billing, OCR for scanned documents, sharing a
document between users. This version exists to prove the analysis can be trusted,
and none of those make it more trustworthy. OCR would actively undermine it,
because a citation is worthless when the text it points at was misread.

## Undecided — stop and ask, do not pick one to stay unblocked

- Which OpenRouter model. Read it from one env var; never hardcode a model id.
- Whether a Supabase project exists yet. Do not scaffold a throwaway project or
  mock auth to get past a missing key.

Settled: input is pasted text and text-layer PDFs only (ADR 0006). No DOCX, no OCR.

## Standing rules

- Keep credentials in `.env.local`, which is gitignored. Never commit a secret.
  The GitHub repo is public, so a key is exposed the moment it is pushed and has
  to be rotated.
- Ask before adding a dependency.
- When grilling (`/mattpocock-skills:grilling`), put every question as
  selectable options with a recommendation. Never make me type free text.
- All copy a user reads in this product, meaning the landing page, UI labels,
  error messages and empty states, has to be run through the humanizer skill
  before it is committed. Copy that reads as though a model wrote it is a
  defect, not a matter of taste.

## Read when they matter

- `research/summary.md` — the user research, including evidence that contradicts
  the original hypothesis. Read before deciding what the product should do.
- `PRD.md` — the brief, once it exists. Read before building.
