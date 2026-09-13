# Supabase: what the owner has to do by hand

Nothing in this directory has been run. No project existed when it was written, so
every line of it is unverified against a live database. What follows is the whole
list of what has to happen for sign-in, the library and the red lines to work.

## 1. Create the project and set two variables

In `.env.local`, which is gitignored and must stay that way:

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

Both come from the project's API settings. Until they are set, the app runs, reads
a pasted document and answers questions about it; the library, the red lines and
the sign-in screen say there is no project, which is a designed state rather than a
failure.

The anon key is the only Supabase key this app uses. There is no service-role key
anywhere in the code, and there should not be: every query runs as the signed-in
reader so that the policies below are what decides what they can read.

## 2. Run the migrations, in order

```
supabase/migrations/0001_documents.sql
supabase/migrations/0002_red_lines.sql
supabase/migrations/0003_red_line_clause_types.sql
```

Paste each into the SQL editor, or run `supabase db push` against the project.
All three are safe to run twice, and 0003 is safe to run against a `red_lines`
table that 0002 already created.

Check afterwards, in the table editor:

- `public.documents` and `public.red_lines` exist, with RLS enabled on both.
- Each table has four policies, named after the sentence each enforces.
- `documents.opening` is a generated column. The library list reads it instead of
  selecting whole contracts.
- `red_lines.clause_types` is a `text[]` column. It holds the kinds of clause each
  red line is checked against, and the app never writes an empty one.

## 3. Turn on email sign-in

Sign-in is a link in an email. There is no password anywhere in this product, so
there is no password to store, reset, or be the reason someone's reused password
matters.

In Authentication, Providers, Email:

- Enable the email provider.
- Enable "Email OTP" / magic link. A password is not needed and nothing asks for one.
- "Confirm email" can stay on. A magic link confirms the address by being opened.

In Authentication, URL Configuration:

- Site URL: the deployed origin, for example `https://redline.vercel.app`.
- Redirect URLs: add `http://localhost:3000/auth/callback` and
  `<deployed origin>/auth/callback`. The sign-in form asks Supabase to send the
  reader to `/auth/callback` on the origin they signed in from, and Supabase refuses
  a redirect that is not on this list.

**Email delivery is the part that will bite.** Supabase's built-in SMTP is rate
limited to a few messages an hour and, on a new project, will only deliver to
addresses on the project's own team. It is enough to test a sign-in with the
owner's own address and not enough for anyone else. Before a second person signs
in, set custom SMTP under Authentication, Emails.

The default email template sends the reader to the redirect URL with a `code`
parameter, which `app/auth/callback/route.ts` exchanges for a session. A template
rewritten to send `token_hash` and `type` also works; the route handles both.

## 4. What to check first, in this order

1. `/library` signed out says "Sign in first" and does not throw.
2. The sign-in form sends a link, and the link signs you in and lands on `/library`.
3. `/library` is empty and says what the library is for.
4. Read a document, press "Keep this document", and it appears in the library.
5. Open it again: the same summary, the same completeness reading, the same flags in
   the same order, each still showing its source sentence.
6. In the SQL editor, `select * from public.documents` as a second reader returns
   nothing of the first reader's. This is the one thing no test in this repository
   can prove.
