# Redline

A web app where someone uploads a contract, lease, freelance agreement, or terms
of service and finds out what they are actually signing.

## What it does

- Plain-English summary of the document.
- Clauses that could hurt them, ranked by severity, each showing its exact source sentence.
- A drafted counter-offer for each flagged clause.
- A question box that answers only from the document.
- An editable list of the user's own red lines, which drives the analysis.
- A saved library of their past documents.

## Settled — do not reopen

- Next.js, Supabase for auth and database, deployed on Vercel.
- Model calls go through OpenRouter.
- The uploaded file is parsed in the browser. Only the extracted text is stored.

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
- Which formats parse in the browser (paste, PDF, DOCX). Settles during the PRD.
- Whether a Supabase project exists yet. Do not scaffold a throwaway project or
  mock auth to get past a missing key.

## Standing rules

- Keep credentials in `.env.local`, which is gitignored. Never commit a secret.
  The GitHub repo is public, so a key is exposed the moment it is pushed and has
  to be rotated.
- Ask before adding a dependency.

## Read when they matter

- `research/summary.md` — the user research, including evidence that contradicts
  the original hypothesis. Read before deciding what the product should do.
- `PRD.md` — the brief, once it exists. Read before building.
