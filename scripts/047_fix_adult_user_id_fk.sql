-- Fixes the same class of bug as the student_user_id -> profiles fix in
-- 044: guardian_links.adult_user_id originally referenced auth.users(id)
-- directly. Both that and trusted_adults(user_id) enforce identical
-- integrity (trusted_adults.user_id is itself a FK to auth.users), but
-- only a DIRECT FK lets PostgREST resolve an embedded
-- `trusted_adults:adult_user_id(full_name)` select — quillglow-main's
-- /api/guardian-links (student-side "who's linked to me" list) needs
-- exactly that embed to show the adult's name.
--
-- Safe to run whether or not 044 already created guardian_links with the
-- old FK — drops the old constraint only if it's there, then adds the
-- correct one. If you're running 044 fresh (with this fix already in it),
-- this migration is a no-op.

do $$
declare
  v_old_constraint text;
begin
  select conname into v_old_constraint
  from pg_constraint
  where conrelid = 'public.guardian_links'::regclass
    and confrelid = 'auth.users'::regclass
    and conname like '%adult_user_id%';

  if v_old_constraint is not null then
    execute format('alter table public.guardian_links drop constraint %I', v_old_constraint);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.guardian_links'::regclass
      and confrelid = 'public.trusted_adults'::regclass
      and conname = 'guardian_links_adult_user_id_fkey'
  ) then
    alter table public.guardian_links
      add constraint guardian_links_adult_user_id_fkey
      foreign key (adult_user_id) references public.trusted_adults(user_id) on delete cascade;
  end if;
end $$;
