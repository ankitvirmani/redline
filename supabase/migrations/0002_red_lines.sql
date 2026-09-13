-- 0002_red_lines.sql
--
-- The reader's red lines: the conditions they have declared unacceptable in
-- advance, which ranking checks each document against.
--
-- Ticket 12 owns red lines: how a reader writes one, and how one is matched
-- against a flag. This file is only the table and the rule that a reader's red
-- lines are their own, written here because the library migration is already being
-- written and the two tables carry the same rule. Ticket 12 may add columns to it
-- in a later migration; it does not need to change this one.
--
-- Running it twice is safe, on the same terms as 0001.

create extension if not exists pgcrypto;

create table if not exists public.red_lines (
  id uuid primary key default gen_random_uuid(),

  -- Whose red line this is. Defaults to the requesting reader, as in 0001.
  reader_id uuid not null default auth.uid()
    references auth.users (id) on delete cascade,

  -- The condition, in the reader's own words. `RedLine.text`. A red line made of
  -- whitespace is nothing a document can be checked against, so the column refuses
  -- one rather than leaving a blank row in the list.
  text text not null check (length(btrim(text)) > 0),

  written_at timestamptz not null default now()
);

comment on table public.red_lines is
  'Conditions a reader has declared unacceptable in advance. A red line promotes and marks matching flags; it never hides one.';

-- The list is read in the order the reader wrote it, for one reader at a time.
create index if not exists red_lines_reader_written_at_idx
  on public.red_lines (reader_id, written_at);

alter table public.red_lines enable row level security;

-- A signed-out visitor has no business in this table. Analysis works signed out and
-- treats a reader with no red lines the same as a reader who has set none.
revoke all on public.red_lines from anon;

-- A reader sees their own red lines and nobody else's.
drop policy if exists "A reader sees only their own red lines" on public.red_lines;
create policy "A reader sees only their own red lines"
  on public.red_lines
  for select
  to authenticated
  using (reader_id = auth.uid());

-- A reader writes a red line only under their own name.
drop policy if exists "A reader writes a red line only as themselves" on public.red_lines;
create policy "A reader writes a red line only as themselves"
  on public.red_lines
  for insert
  to authenticated
  with check (reader_id = auth.uid());

-- A reader edits only their own red line, and cannot hand it to another reader.
drop policy if exists "A reader edits only their own red line" on public.red_lines;
create policy "A reader edits only their own red line"
  on public.red_lines
  for update
  to authenticated
  using (reader_id = auth.uid())
  with check (reader_id = auth.uid());

-- A reader deletes only their own red line.
drop policy if exists "A reader deletes only their own red line" on public.red_lines;
create policy "A reader deletes only their own red line"
  on public.red_lines
  for delete
  to authenticated
  using (reader_id = auth.uid());
