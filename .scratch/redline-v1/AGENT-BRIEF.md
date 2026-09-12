# Standing brief for every Redline v1 implementation agent

Read this file in full before you write a line. It carries the answers to the two
questions `CLAUDE.md` marks stop-and-ask, the repository layout every ticket
shares, and the rules your work is checked against. Your ticket brief adds only
what is specific to your ticket.

## The two answers (do not ask, these are decided)

**1. The model.** Read the model id from `process.env.OPENROUTER_MODEL`. Never
write a model id into source, a test, a comment or a default. Call OpenRouter's
OpenAI-compatible endpoint, `https://openrouter.ai/api/v1/chat/completions`, with
`Authorization: Bearer ${process.env.OPENROUTER_API_KEY}`. Every request body
carries:

```
model: process.env.OPENROUTER_MODEL,
provider: { order: ["fireworks"], allow_fallbacks: false, require_parameters: true },
reasoning: { effort: "low" },
response_format: { type: "json_schema", json_schema: { name, strict: true, schema } }
```

Both variables already exist in `.env.local`, which is gitignored. Never print,
log, commit or echo either value. Model calls happen server-side only, in a route
handler under `app/api/`, because the key must never reach the browser.

**2. Supabase.** No project exists. Build sign-in, the library and red lines
against `@supabase/supabase-js`, reading `NEXT_PUBLIC_SUPABASE_URL` and
`NEXT_PUBLIC_SUPABASE_ANON_KEY`. Write every table, index and RLS policy as a
migration file under `supabase/migrations/`, named `NNNN_description.sql`; the
owner runs them by hand. **The app must start, and must analyse a pasted document,
with both Supabase variables absent.** Only the library and red lines need an
account. Never mock auth in the product. Where a Supabase variable is missing, the
account-gated surfaces say so in product copy and the analysis path is untouched.

## Repository layout

The repo root is the Next.js app root. Do not create a nested app directory.

```
app/
  layout.tsx              root layout, imports app/globals.css
  globals.css             the :root token block and shared primitives
  page.tsx                paste box (ticket 01) -> landing page (ticket 14)
  analyse/page.tsx        paste box from ticket 14 onward
  landing/page.tsx        landing page before ticket 14 moves it to the root
  library/page.tsx        ticket 11
  red-lines/page.tsx      ticket 12
  api/analyse/route.ts    ticket 04, server-side model call
  api/ask/route.ts        ticket 09, server-side model call
src/
  extraction/             seam 1: text in, extracted text + source kind + completeness out
  analysis/               seam 2: text in, summary + checked types + verified flags out
  ranking/                seam 3: pure, no model, no network, no database
  qa/                     seam 4: text + question in, grounded answer or refusal out
  model/
    client.ts             the injected ModelClient interface
    openrouter.ts         the real client
    stub.ts               the test stub, built from fixture sidecars
  domain/                 clause types, severity bands, shared types
  supabase/               browser and server clients
components/               React components, one file per component
tests/
  fixtures/               the two fixture documents and their sidecars
  *.test.ts               deterministic suite
supabase/migrations/      SQL the owner runs by hand
scripts/smoke.ts          npm run smoke
landing/                  the original static landing page. DESIGN.md is recorded
                          from it and cites its paths. Leave these files in place
                          as the design source of record; they are not served.
```

Commands: `npm run dev`, `npm run build`, `npm test` (deterministic, no network),
`npm run typecheck`, `npm run smoke`, `npm run eval` (ticket 13 only).

## Dependencies: already decided, do not add more

Approved: `next`, `react`, `react-dom`, `typescript`, `@types/*`, `vitest`,
`pdfjs-dist`, `zod`, `@supabase/supabase-js`, `@supabase/ssr`. Anything else needs
a decision that is not yours to make. If you believe you need another package,
implement without it and say so in your report instead.

No CSS framework. No component library. No icon font. Styling is handwritten CSS,
using the token block in `app/globals.css`, which is copied from
`landing/styles.css`.

## The rules your work is checked against

**Citation integrity is the product.** Every flag carries the exact sentence it
came from. The model returns spans; **code** checks each span against the stored
extracted text; a span that does not match verbatim means the flag is dropped
before the seam returns, and the drop is logged as a defect. Verification lives in
code, never in a prompt. See ADR 0001.

**Extraction is lossless.** No trimming, no whitespace collapsing, no smart-quote
or ligature normalisation, no line-ending rewriting. Verification downstream
compares model spans against this text; any normalisation breaks every citation
silently.

**State only what the document says.** Anything from outside the document is a
separate field carrying its own citation, rendered visibly apart. No
enforceability claim, no statutory right, no jurisdiction assertion, no sign or
don't-sign verdict, anywhere, in any copy.

**None of these counts as done.** A function that returns a fixed value. A `TODO`
or a "not implemented" throw. A test that asserts a file exists or a function is
defined. A test that mocks the thing it is meant to test. If you cannot finish a
criterion honestly, leave it unfinished and say so in your report. A stub that
makes a test pass is worse than a failure, because it hides.

**A good test asserts what a reader would observe.** That a rendered quote appears
in their document. That arbitration outranks an oddity. That a clean document
reads as clean. Never assert prompt contents, model call counts, or internal
function shapes.

**The deterministic suite makes no network call and needs no key.** The model
client is injected at the analysis and question-answering seams. Tests supply the
stub in `src/model/stub.ts`, which builds its payloads from the fixture sidecars
under `tests/fixtures/`.

## Vocabulary is binding

`CONTEXT.md` is the glossary and carries an avoid-list per term. It governs every
word a reader sees, and every identifier you write. Reader, not user. Flag, not
issue or finding. Source sentence, not citation or excerpt. Red line, not
preference or filter. Severity, not priority. Clean document, not safe or passed.
Consequence, not impact. Completeness, not coverage.

## Design

Every screen obeys `DESIGN.md`, `PRODUCT.md`, and
`.impeccable/surfaces/app-shell.md`. Read all three before styling anything.

The short version, which does not replace reading them: zero corner radius
anywhere. Two border weights only, a 2px ink keyline for structure and a 1px grey
hairline for separation. No shadow, no gradient, no tint ramp, no glass, no
elevation, no card on a background. Colour identifies a flag and never ranks it;
severity is carried by the word and by list order. Black text on cyan, magenta,
yellow, green, cool grey and white; white text only on ink black. One typeface,
Archivo, in two registers with the middle empty. Quoted document text is held at a
26rem measure, justified and hyphenated above 520px. Full-bleed sections, a change
of field colour or a 2px keyline to change subject. Inside the app shell motion is
150 to 250ms and conveys state only; the landing page's load-time snap does not
come inside. WCAG 2.2 AA, and severity never carried by colour alone.

Do not start an Impeccable direction round. It opens a browser and waits for a
person, and no person is here.

## Copy

All copy a reader sees runs through the `humanizer` skill before you finish: the
landing page, UI labels, button text, empty states, refusal messages, error
messages. Invoke the skill, apply it to every string you wrote, and say in your
report that you did. Copy that reads as though a model wrote it is a defect here.

No em dashes and no en dashes in copy or in any markdown file you write.

The refusal message for a scanned document is product copy, not error chrome.

## What to report back

Keep it short and factual. Which criteria you completed and which you did not and
why. Every decision you made that the ticket did not settle, with its reason. Files
you created or changed. The exact output of `npm run typecheck` and `npm test`.
Anything you could not verify and the reason. Do not claim a criterion passes
without having run something that proves it.
