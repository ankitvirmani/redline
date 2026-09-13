# Eval runs

Every `npm run eval` pass writes two files here, both named for the moment it started:

- `<timestamp>.txt` is exactly what the terminal showed.
- `<timestamp>.json` is the same numbers in a shape something can read later.

Runs accumulate. Nothing here is overwritten, so a pass after a prompt change sits beside
the pass before it and the two can be compared. That is the point of the directory: the
proposed thresholds in `PRD.md` section 4 need calibrating against a handful of passes,
and a single pass is not a calibration.

## What is not in a run record

**The model id.** It comes from `OPENROUTER_MODEL`, and writing it into a committed file
would put it in source. Each record says a model was read from the variable and stops
there. The owner knows what they set, and a run whose model they cannot remember is a run
they should do again rather than one the record should have guessed at.

**The key.** Nothing in this repo prints it, logs it or writes it.

## What is in a run record

The corpus's identity and its per-type inventory, so a number can be read against what it
divided by. Every recall figure with its counts, split per clause type and per evidence
group, under both matching rules. Precision at the top band with the three ways a
top-band flag can land. Every top-band flag with its source sentence, which is the list a
person reads to do the half of precision a run cannot do. The ranking check per document.
Every question with its outcome. How many calls the pass asked for, how many attempts
they took, and what went wrong on each one.

The record also carries each document's summary and every verified flag's source
sentence, so a later reader can see what the model actually said rather than only what it
scored.

## Reading one

Start with the `Verdict` section of the `.txt`. It says which blocking checks held.
Nothing else in the file changes the exit code, and no figure in it is measured against a
proposed threshold.
