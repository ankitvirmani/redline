# 10. Real OpenRouter client behind the injected seam

**What to build:** The first time a reader's document reaches a real model.
Analysis and question answering run against OpenRouter instead of a stub, and the
product works end to end on a real adhesion contract.

**Stop and ask which model before writing any code.** `CLAUDE.md` marks this
undecided and forbids picking one to stay unblocked. The model identifier is read
from one environment variable and never hardcoded.

Credentials live in `.env.local`, which is gitignored. The GitHub repo is public,
so a key is exposed the moment it is pushed and has to be rotated.

**Blocked by:** 04, 09.

**Status:** ready-for-agent

- [ ] The owner has named the model before implementation starts.
- [ ] The model identifier is read from a single environment variable at every call site.
- [ ] No model identifier and no credential appears in committed source.
- [ ] A real run over a real adhesion contract produces flags whose source sentences all verify.
- [ ] A real run of the question box answers a grounded question and refuses an ungrounded one.
- [ ] The deterministic suite still passes with the stub and still makes no network call.
