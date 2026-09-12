// Checks the external-context citations against the live web.
//
// Run with: npm run check:citations
//
// Deliberately separate from `npm test`, and deliberately not run in CI. The
// deterministic suite makes no network call, so `tests/flag-content.test.ts` can only
// check what is checkable offline: that a URL is well formed and recorded in `PRD.md`,
// that the source is named, and that the wording a reader sees carries no figure the
// sourced wording does not. Whether the page is still there, and whether it still says
// what we say it says, needs the network and a person reading the output.
//
// For each entry in `src/analysis/external-context.ts` it reports:
//   1. the HTTP status of the URL
//   2. whether each figure the reader is shown appears in the page's own text
//
// Point 2 is a reading aid, not a verdict. A page that renders its numbers with
// JavaScript, writes 30 million as 30,000,000, or moves the figure into a linked PDF
// will come back missing without being wrong. A miss means go and read the page.
//
// Exits non-zero when any URL does not answer with a 2xx, so a dead citation is a
// failure rather than a line in the output somebody skims past.

import { EXTERNAL_CONTEXT } from "../src/analysis/external-context.ts";

const UNSTYLED = /<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi;

/** The page's visible-ish text, which is enough to look for a figure in. */
function textOf(html) {
  return html
    .replace(UNSTYLED, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ");
}

/** Every figure the reader is shown, as the fact writes it. */
function figuresIn(fact) {
  return fact.match(/\d[\d,]*(?:\.\d+)?/g) ?? [];
}

let failures = 0;

for (const entry of EXTERNAL_CONTEXT) {
  console.log(`\n${entry.source.title}`);
  console.log(`  ${entry.source.url}`);
  console.log(`  fact: ${entry.fact}`);

  let response;
  try {
    response = await fetch(entry.source.url, {
      redirect: "follow",
      headers: { "User-Agent": "Redline citation check (one request per citation)" },
    });
  } catch (error) {
    failures += 1;
    console.log(`  FAIL  the request did not complete: ${error.message}`);
    continue;
  }

  if (!response.ok) {
    failures += 1;
    console.log(`  FAIL  HTTP ${response.status}`);
    continue;
  }
  console.log(`  ok    HTTP ${response.status}`);

  const text = textOf(await response.text());
  for (const figure of figuresIn(entry.fact)) {
    const found = text.includes(figure);
    console.log(`  ${found ? "ok   " : "read "} ${figure}${found ? " is on the page" : " is not in the page text, go and read the page"}`);
  }
}

console.log(
  failures === 0
    ? `\n${EXTERNAL_CONTEXT.length} citations answered. Figures marked "read" still need a person.`
    : `\n${failures} of ${EXTERNAL_CONTEXT.length} citations did not answer.`,
);

process.exit(failures === 0 ? 0 : 1);
