# Hand labels for ten flags

A page for labelling ten flags from an eval run by hand, PASS or FAIL, with one
sentence on why. The labels belong to the person doing the labelling. Nothing in this
directory suggests one.

## Which run

`eval-runs/2026-10-30T17-01-09-190Z.json`, the newest record in `eval-runs/` when the
flags were picked. That pass made no calls over the wire: all 35 replies came from
`.eval-cache`, so its flags are the ones the model returned for the 2026-09-13 passes.
The model id is not recorded anywhere, by design (see `eval-runs/README.md`).

## How the ten were picked

1. **Only flags a reader would be shown.** That means the verified flags in the run
   record, each held against its document again: the text at the flag's recorded
   offsets has to equal its quoted sentence character for character. All 39 passed,
   so none was left out.
2. **Matching follows the eval.** The record keeps only a count of unmatched flags, so
   matching was redone with the rule in `scripts/eval/metrics.ts` (`matchFlags`). A
   flag matches a planted clause when the document and the clause type agree and the
   flag's span shares at least one character with the planted sentence, located in the
   document with `indexOf` as `locateSpan` does. The planted clauses come from
   `tests/corpus/manifest.json` and the sidecars it names.
3. **Picked in this order, stopping at ten:**
   - every flag that matched no planted clause, including any on the three documents
     that should come back clean;
   - every flag whose sentence overlaps a planted clause while naming a different
     clause type;
   - then flags from the critical band, always taken from the document with the fewest
     flags picked so far, so the ten spread across as many documents as possible. The
     high band would have come next if critical had run out. It did not.
4. **Sorted by document id, then by position in the document,** and numbered 1 to 10.

How many flags came from each group is left out on purpose, so a count can't hint at
which flags they are. `flags.json` does not say either.

## What `flags.json` holds

For each flag: its number, its id in the run (`document#code`), the document id and
title, the clause type and its display name, the severity band, the quoted sentence
copied from the run record, and the paragraph around it copied from the document. A
paragraph is the text between two blank lines.

## The rule

PASS if the quoted sentence really is the kind of clause the flag names and really
costs the reader something. Otherwise FAIL.

The page also carries `PRD.md` sections 4 and 5, read from `PRD.md` every time the
page loads, in a panel at the top.

## Opening the page again

```sh
npm run label
```

The server listens on 127.0.0.1, on port 4317 or the next free one, and prints the
address. Open it. The page picks up whatever `labels.json` already holds and opens on
the first flag still missing a label.

- Every change saves to `eval/labels/labels.json` straight away. A note saves half a
  second after you stop typing.
- Changing a label you already gave keeps the old one, with the time you changed it,
  in that flag's `history`. `changesOfMind` counts those entries.
- The browser keeps its own copy. If the server stops, the page says so and offers a
  button that copies your labels to the clipboard. When the server comes back, the
  page sends them across.
- Notes are optional. Once all ten have a label, a line to paste into the chat appears
  at the top. The Finish page has a box for what changed in how you judge.
- If `labels.json` was written for a different run, the page will not save over it.
  Move it aside and reload.
