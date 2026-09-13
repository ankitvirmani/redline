# 11. Sign in, and the library of past documents

**What to build:** The reader signs in, their documents persist, and they can
return to what they agreed to.

Only extracted text is stored. The uploaded file never is.

**Stop and ask whether a Supabase project exists before writing any code.**
`CLAUDE.md` marks this undecided and forbids scaffolding a throwaway project or
mocking auth to get past a missing key.

Analysis works signed out; an account gates the library and red lines and nothing
else (owner, 2026-09-11). A signup wall in front of the paste box would cost the
product its own use case, since the reader is deciding in the minutes before they
accept.

**Blocked by:** 07.

**Status:** done

- [x] The owner has confirmed the Supabase situation before implementation starts.
- [x] The reader can sign in and sign out. Written against Supabase auth as a magic link. Not verified: no project exists, so nothing has signed in.
- [x] An analysed document is saved to a library belonging to that reader. Written. Not verified: no insert has run.
- [x] The library lists past documents, and each can be reopened with its analysis.
- [x] Only extracted text is stored; no original file, ever.
- [x] A reader's documents are visible only to them; no sharing between readers. Written as four row-level-security policies per table. Not verified: no policy has denied anything, and this is the most important manual check after the migrations run.
- [x] A signed-out reader can paste, analyse, and read the full result, including flags, consequences and the question box.
- [x] Only the library and red lines require an account.
