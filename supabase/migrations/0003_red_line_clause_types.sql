-- 0003_red_line_clause_types.sql
--
-- What each red line is checked against.
--
-- Migration 0002 gave a red line the reader's own words. This adds the other half:
-- the kinds of clause those words are about. A red line matches a flag when it names
-- the flag's clause type, and the reader picks those types themselves when they write
-- the red line, from the same seven names Redline uses everywhere else. So the reader
-- knows before they paste a document what will be checked, and a red line cannot
-- quietly fail to fire.
--
-- 0002 is left as it was, because the owner may already have run it. This is written
-- as a separate file for that reason and is safe to run twice.

alter table public.red_lines
  add column if not exists clause_types text[] not null default '{}';

comment on column public.red_lines.clause_types is
  'The clause types this red line is checked against, as ClauseTypeSlug values. A flag hits this red line when its clause type is in here. Never empty for a row written by Redline.';

-- A red line that names no clause type is checked against nothing, so the table
-- refuses one rather than leaving the reader a condition nothing is ever held to.
--
-- `not valid` so that the constraint applies to everything written from now on
-- without the migration failing on a row that predates it. There should be no such
-- row: nothing before this build could write a red line, because the screen that
-- writes them arrives with it. If one exists, it opens in the reader's list saying
-- that it checks nothing, which is the honest thing to do with it.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'red_lines_clause_types_not_empty'
  ) then
    alter table public.red_lines
      add constraint red_lines_clause_types_not_empty
      check (array_length(clause_types, 1) >= 1) not valid;
  end if;
end $$;

-- The seven slugs are not enumerated here on purpose. The clause types belong to
-- `src/domain/clause-types.ts`, which is where they are read and where they may gain
-- a member; a list of them in SQL would be a second definition to migrate every time
-- the first one changed, and the day the two disagreed the database would refuse a
-- red line about a clause type the product checks. What comes out of this column is
-- held against the seven in code, both when it is written and when it is read, and a
-- value the build does not know is dropped rather than shown as something checked.
--
-- The policies in 0002 already cover this column: they are table-wide, and a reader
-- sees, writes, edits and deletes only their own red lines.
