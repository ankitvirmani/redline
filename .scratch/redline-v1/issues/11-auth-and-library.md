# 11. Sign in, and the library of past documents

**What to build:** The reader signs in, their documents persist, and they can
return to what they agreed to.

Only extracted text is stored. The uploaded file never is.

**Stop and ask whether a Supabase project exists before writing any code.**
`CLAUDE.md` marks this undecided and forbids scaffolding a throwaway project or
mocking auth to get past a missing key. Settle one other thing in the same
conversation: whether a signed-out reader can still paste and analyse, with only
persistence behind an account. The spec does not decide it.

**Blocked by:** 07.

**Status:** ready-for-agent

- [ ] The owner has confirmed the Supabase situation before implementation starts.
- [ ] The reader can sign in and sign out.
- [ ] An analysed document is saved to a library belonging to that reader.
- [ ] The library lists past documents, and each can be reopened with its analysis.
- [ ] Only extracted text is stored; no original file, ever.
- [ ] A reader's documents are visible only to them; no sharing between readers.
- [ ] The signed-out behaviour matches whatever the owner settled.
