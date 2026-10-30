-- Deploy BOTH updated applications before running this script.
-- Only these three tables are changed; no row data is deleted or rewritten.
begin;
set local lock_timeout = '5s';
alter table public.ambassadors enable row level security;
alter table public.ambassador_rewards enable row level security;
alter table public.ambassador_certificates enable row level security;

alter policy "Service can manage all ambassadors" on public.ambassadors to service_role;
alter policy "Service can manage all rewards" on public.ambassador_rewards to service_role;
alter policy "Service can manage all certificates" on public.ambassador_certificates to service_role;

revoke all privileges on table public.ambassadors,
  public.ambassador_rewards, public.ambassador_certificates
from public, anon, authenticated;

-- Table-level REVOKE alone does not remove separately granted column privileges.
do $$
declare t text; cols text;
begin
  foreach t in array array['ambassadors','ambassador_rewards','ambassador_certificates'] loop
    select string_agg(quote_ident(attname), ', ' order by attnum) into cols
    from pg_attribute where attrelid=format('public.%I',t)::regclass
      and attnum>0 and not attisdropped;
    execute format('revoke select (%s), insert (%s), update (%s), references (%s) on table public.%I from public, anon, authenticated', cols,cols,cols,cols,t);
  end loop;
end $$;

grant select, insert, update, delete on table public.ambassadors,
  public.ambassador_rewards, public.ambassador_certificates to service_role;
notify pgrst, 'reload schema';
commit;
