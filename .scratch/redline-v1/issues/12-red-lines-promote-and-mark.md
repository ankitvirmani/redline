# 12. Red lines: an editable list that promotes and marks, and never hides

**What to build:** The reader records conditions they will not accept. Clauses
matching one are promoted to the top of the ranking and marked as hitting
something the reader named, so they see their own concerns first.

Red lines change what the reader sees first and nothing else. They do not block,
veto, or produce a walk-away recommendation. Red lines were conceived for
documents you can negotiate; against an adhesion contract there is nothing to push
against, so changing the order is their only honest job. Turning them into "this
document breaks two of your red lines, do not sign" would reintroduce the verdict
rejected in ADR 0007 by another route (ADR 0008).

Red lines change presentation, not detection. A reader who sets none gets exactly
the same clauses found, so the feature costs nothing to skip.

**Blocked by:** 11, 06.

**Status:** done

- [x] The reader can add, edit and remove red lines, and they persist with their account. Built and typechecked. Persistence is unverified: no Supabase project exists, so no write has run.
- [x] A flag matching a red line is promoted to the top of the ranking.
- [x] A promoted flag is marked as matching a red line the reader named.
- [x] No red line removes, hides or suppresses a flag.
- [x] A reader with no red lines gets an identical flag set to a reader with them, asserted in a test.
- [x] No walk-away recommendation or verdict is produced from red-line matches.
- [x] Promotion is tested as a pure function over fixed flag sets and fixed red lines.
