-- 0001_documents.sql
--
-- The library: the documents a reader has kept, and the rule that only they can
-- see them.
--
-- Run it in the SQL editor of the Supabase project, or with `supabase db push`.
-- Running it twice is safe: every statement is `if not exists`, `create or
-- replace`, or a `drop ... if exists` in front of a create.
--
-- What this table holds is the extracted text of a document and the reading
-- Redline made from it. What it never holds is the file the reader started with:
-- no bytes, no base64, no file name, no storage bucket. `CLAUDE.md` is explicit
-- about that, and this schema has nowhere to put one.

-- gen_random_uuid() lives here. Supabase enables it on a new project already;
-- this line makes the file stand on its own.
create extension if not exists pgcrypto;

create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),

  -- Whose document this is. It defaults to the requesting reader, so a row cannot
  -- be written without an owner even if an insert forgets to name one, and the
  -- policies below check it as well.
  reader_id uuid not null default auth.uid()
    references auth.users (id) on delete cascade,

  -- The document as extraction read it, character for character. Every source
  -- sentence inside `analysis` is held against this text again when the document
  -- is reopened, so these two columns travel together or not at all.
  extracted_text text not null check (length(extracted_text) > 0),

  -- Code points, which is what a reader counts. `ExtractedDocument.characterCount`.
  character_count integer not null check (character_count > 0),

  -- Where the text came from: `ExtractedDocument.sourceKind`. Left unconstrained on
  -- purpose. Extraction owns that vocabulary and it gains members, so a check
  -- constraint here would be a second list to keep in step.
  source_kind text not null,

  -- `CompletenessAssessment` and `DocumentAnalysis`, held as json rather than spread
  -- across tables. The shape of a flag belongs to the analysis seam; giving each
  -- field a column would make this schema a second definition of it, to be migrated
  -- every time the seam grows one. Both are read back through a schema in
  -- `src/library/stored.ts`, and json that does not match it is not shown to anyone.
  completeness jsonb not null,
  analysis jsonb not null,

  -- The opening of the document, so that the library list can take a title from it
  -- without selecting a whole contract to print one line of it. Generated, so there
  -- is no second copy of the text to keep in step with the first.
  opening text generated always as (left(extracted_text, 240)) stored,

  kept_at timestamptz not null default now()
);

comment on table public.documents is
  'Documents a reader kept: the extracted text, and the reading Redline made from it. Never the original file.';

comment on column public.documents.extracted_text is
  'The document as extraction read it. Source sentences are verified against this text on reopen.';

-- The library reads a reader's own documents newest first, and that is the only way
-- it is ever read.
create index if not exists documents_reader_kept_at_idx
  on public.documents (reader_id, kept_at desc);

alter table public.documents enable row level security;

-- A signed-out visitor has no business in this table at all. Analysis works signed
-- out and touches nothing here.
revoke all on public.documents from anon;

-- Each policy below enforces one sentence, and the sentence is its name.

-- A reader sees their own documents and nobody else's.
drop policy if exists "A reader sees only their own documents" on public.documents;
create policy "A reader sees only their own documents"
  on public.documents
  for select
  to authenticated
  using (reader_id = auth.uid());

-- A reader keeps a document only under their own name, never under someone else's.
drop policy if exists "A reader keeps a document only as themselves" on public.documents;
create policy "A reader keeps a document only as themselves"
  on public.documents
  for insert
  to authenticated
  with check (reader_id = auth.uid());

-- A reader changes only their own document, and cannot hand it to another reader:
-- `using` decides which rows they may touch, `with check` decides what the row is
-- allowed to look like afterwards, so both name the same owner.
drop policy if exists "A reader changes only their own document" on public.documents;
create policy "A reader changes only their own document"
  on public.documents
  for update
  to authenticated
  using (reader_id = auth.uid())
  with check (reader_id = auth.uid());

-- A reader deletes only their own document.
drop policy if exists "A reader deletes only their own document" on public.documents;
create policy "A reader deletes only their own document"
  on public.documents
  for delete
  to authenticated
  using (reader_id = auth.uid());

-- There is deliberately no policy granting anyone access to a row they do not own.
-- Sharing a document between readers is out of scope for v1, so it is not possible
-- here rather than merely absent from the screens.
