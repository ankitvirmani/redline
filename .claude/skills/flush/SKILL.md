---
name: flush
description: Files what is durable from the current working session into the right place in this repo — decisions, tickets, glossary terms, research findings — and reports what it deliberately did not keep. Use this whenever the user says "flush", "capture this session", "save what we decided", "write this down before I go", or otherwise asks to preserve the session's outcomes before stopping. Do not use it for ordinary documentation the user asked for directly, for routine file edits, for committing or pushing, or for recalling earlier context — it only writes at the end of a session, and only when asked.
---

# flush

At the end of a session, some of what happened is durable and most of it is not.
Without a deliberate pass, the durable part is lost when the conversation ends,
and the next session rediscovers it the expensive way — or worse, contradicts it.

Your job is to find that small durable part, put each piece where it belongs, and
say plainly what you left behind. Writing nothing is a normal outcome. Most
sessions produce no durable artifact, and a flush that always finds something to
file is padding, which is how these files stop being read.

## Step 1 — Survey before writing

Look at what this repo actually has before deciding anything. Check for:

- a decisions folder — `docs/adr/`
- a glossary — `CONTEXT.md` at the root (or `CONTEXT-MAP.md` for multi-context repos)
- an issue tracker — read `docs/agents/issue-tracker.md` if present; it names the convention
- a session log directory — `sessions/`, `logs/`, or whatever the repo already uses
- a research folder — `research/`

Route only to what exists. When something you need is missing, do not create it as
a side effect of filing. Name what you would create and why, and ask. An empty
`docs/adr/` holding one stub, or a `CONTEXT.md` with two terms nobody agreed on,
looks like a convention the project follows and doesn't — that costs more than the
note was worth.

## Step 2 — Apply the bar

For each candidate, ask one question: **would a future session get this wrong
without it?**

If a session would proceed correctly regardless, it is not durable. True but inert
notes are the failure mode here, not missing ones.

Things that usually pass: a decision that closed off alternatives, a constraint
discovered the hard way, a term the project now uses in a specific sense, work
identified but not done, a sourced finding that took effort to get.

Things that usually fail: what the code already says, what git history already
records, a summary of what you did, anything that only mattered inside this
conversation.

## Step 3 — Route it

| What it is | Where it goes |
|---|---|
| Settled decision, scope boundary, standing rule | `CLAUDE.md` — **propose only, see Step 5** |
| A decision that closed off real alternatives | new `docs/adr/NNNN-<slug>.md` |
| Work identified but not done | the repo's issue tracker convention |
| A term the project uses in a specific sense | `CONTEXT.md` |
| Sourced external findings | `research/` |
| Durable, but fits none of the above | one review file — see below |

Number a new ADR by scanning `docs/adr/` for the highest existing number and
adding one. Reserve ADRs for decisions that ruled something out; a choice with no
rejected alternative is a note, not a decision record.

**Do not invent a destination.** When something is durable but fits no existing
slot, write it to a single review file (`.scratch/flush-<YYYY-MM-DD>.md`, or the
repo's own scratch location) with a line naming where it *would* go. Creating
`NOTES.md` or `DECISIONS.md` because nothing fit is how a repo ends up with four
competing memory files nobody reads. If the scratch location doesn't exist either,
report the residue in the conversation and ask before creating it.

This skill writes to the repo only. If something belongs in the user's personal
or cross-project memory, say so and leave it — the repo serves whoever builds this
codebase next, and mixing the two produces drifting duplicates of the same fact.

## Step 4 — What not to write

**No credentials.** Never write an API key, token, password, or the contents of a
`.env` file into any repo file, including the review file. If a secret is what
makes a note make sense, write the note without it.

**Nothing the user did not affirm.** Over a long session you propose things the
user never responds to. At flush time "we decided X" and "I suggested X and nobody
objected" look identical, and writing the second one into `CLAUDE.md` launders a
suggestion into a constraint that binds every future session. Before recording
anything as decided, find the user's own words agreeing to it. If you cannot point
to them, it is not a decision — at most it goes in the review file, labelled as
unconfirmed.

**Append only.** Add to existing files; do not edit or delete lines that are
already there. A flush that rewrites is a flush that can quietly reverse a
decision made weeks ago, and the file still reads as coherent afterwards, so
nobody notices.

**No git.** Do not stage, commit, or push. Leave a dirty tree for the user to
inspect. Anything you wrote is one command away from permanent, and that command
is theirs.

## Step 5 — CLAUDE.md is proposed, never written

`CLAUDE.md` steers every future session in this repo, so it changes only with the
user's explicit agreement. Show the exact lines you would add, in context, and
wait for a yes. Do not write the file and offer to revert.

## Step 6 — Report

Report both halves. The rejected list is what makes an empty flush legible rather
than suspicious — it shows you looked.

```
## Filed
- <path> — <one line: what and why it's durable>

## Proposed for CLAUDE.md (awaiting your yes)
<the exact lines, in context>

## Considered and not kept
- <thing> — <why it didn't meet the bar>

## Would need a new location
- <thing> — would go in <path>, which doesn't exist. Create it?
```

When nothing durable happened, say so and write nothing:

> Nothing durable this session. Considered: <list>. All of it is either already in
> the code, already in git history, or was scoped to this conversation.
