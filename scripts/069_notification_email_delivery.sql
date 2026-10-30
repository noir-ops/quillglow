-- Run after 024_wallet_notifications.sql. Additive; does not mail old notifications.
begin;
alter table public.notification_preferences
  add column if not exists email_enabled boolean not null default true,
  add column if not exists study_reminders boolean not null default true,
  add column if not exists weekly_report boolean not null default false;

create table if not exists public.notification_email_outbox (
  id bigint generated always as identity primary key,
  notification_id bigint not null unique references public.notifications(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  category text not null, title text not null, body text, action_url text, metadata jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (status in ('pending','processing','sent','skipped','failed')),
  attempts int not null default 0,
  available_at timestamptz not null default now(),
  locked_at timestamptz, lock_token uuid,
  provider_message_id text, last_error text, sent_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists notification_email_pending_idx on public.notification_email_outbox(status, available_at);
alter table public.notification_email_outbox enable row level security;
revoke all on public.notification_email_outbox from anon, authenticated;
grant all on public.notification_email_outbox to service_role;
grant usage, select on sequence public.notification_email_outbox_id_seq to service_role;

create or replace function public.notification_email_allowed(p_user_id uuid, p_category text, p_metadata jsonb default '{}'::jsonb)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select np.email_enabled and
    case p_category when 'scholarship' then np.email_scholarship
      when 'learning' then np.email_learning when 'marketplace' then np.email_marketplace else true end
    and case coalesce(p_metadata->>'kind','') when 'study_reminder' then np.study_reminders
      when 'weekly_report' then np.weekly_report else true end
    from public.notification_preferences np where np.user_id = p_user_id),
    p_category <> 'marketplace' and coalesce(p_metadata->>'kind','') <> 'weekly_report')
$$;
revoke all on function public.notification_email_allowed(uuid,text,jsonb) from public, anon, authenticated;
grant execute on function public.notification_email_allowed(uuid,text,jsonb) to service_role;

create or replace function public.enqueue_notification_email()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.channel in ('in_app','email') and public.notification_email_allowed(new.user_id,new.category,new.metadata) then
    insert into public.notification_email_outbox(notification_id,user_id,category,title,body,action_url,metadata)
      values(new.id,new.user_id,new.category,new.title,new.body,new.action_url,new.metadata)
      on conflict(notification_id) do nothing;
  end if;
  return new;
end;
$$;
revoke all on function public.enqueue_notification_email() from public, anon, authenticated;
drop trigger if exists notification_email_enqueue on public.notifications;
create trigger notification_email_enqueue after insert on public.notifications
  for each row execute function public.enqueue_notification_email();

-- One batch is leased atomically so cron and active-user delivery can run together.
create or replace function public.claim_notification_emails(p_limit int default 20, p_user_id uuid default null)
returns setof public.notification_email_outbox
language plpgsql security definer set search_path = public as $$
begin
  update public.notification_email_outbox
    set status='failed', locked_at=null, lock_token=null, last_error='Worker lease expired after final attempt'
    where status='processing' and locked_at < now() - interval '10 minutes' and attempts >= 5;
  return query
    with candidates as (
      select o.id from public.notification_email_outbox o
      where ((o.status = 'pending' and o.available_at <= now())
        or (o.status = 'processing' and o.locked_at < now() - interval '10 minutes'))
        and o.attempts < 5
        and (p_user_id is null or o.user_id = p_user_id)
      order by o.available_at, o.id limit greatest(1,least(p_limit,50)) for update skip locked
    )
    update public.notification_email_outbox o
      set status='processing', locked_at=now(), lock_token=gen_random_uuid(), attempts=o.attempts+1
      from candidates c where c.id=o.id returning o.*;
end;
$$;
revoke all on function public.claim_notification_emails(int,uuid) from public, anon, authenticated;
grant execute on function public.claim_notification_emails(int,uuid) to service_role;
-- The existing privileged function is called by trusted DB workflows and server code only.
revoke all on function public.send_notification(uuid,text,text,text,text,text,jsonb) from public, anon, authenticated;
grant execute on function public.send_notification(uuid,text,text,text,text,text,jsonb) to service_role;
commit;
