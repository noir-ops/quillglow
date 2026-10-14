-- Run after 069_notification_email_delivery.sql. No emails are sent by this migration.
begin;
create table if not exists public.store_launch_subscriptions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  subscribed boolean not null default true,
  subscribed_at timestamptz not null default now(),
  unsubscribed_at timestamptz,
  launch_notified_at timestamptz
);
alter table public.store_launch_subscriptions enable row level security;
revoke all on public.store_launch_subscriptions from anon, authenticated;
grant select on public.store_launch_subscriptions to authenticated;
grant all on public.store_launch_subscriptions to service_role;
drop policy if exists "read own Store signup" on public.store_launch_subscriptions;
create policy "read own Store signup" on public.store_launch_subscriptions
  for select to authenticated using (auth.uid() = user_id);

create or replace function public.set_store_launch_subscription(p_user_id uuid, p_subscribed boolean)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  insert into public.store_launch_subscriptions(user_id,subscribed,unsubscribed_at)
    values(p_user_id,p_subscribed,case when p_subscribed then null else now() end)
  on conflict(user_id) do update set
    subscribed=excluded.subscribed,
    subscribed_at=case when excluded.subscribed and not store_launch_subscriptions.subscribed
      then now() else store_launch_subscriptions.subscribed_at end,
    unsubscribed_at=excluded.unsubscribed_at;
  return p_subscribed;
end;
$$;
revoke all on function public.set_store_launch_subscription(uuid,boolean) from public, anon, authenticated;
grant execute on function public.set_store_launch_subscription(uuid,boolean) to service_role;

-- Store launch is a separate, explicit opt-in. Cancelling it also suppresses
-- queued mail. Other notification categories retain their existing settings.
create or replace function public.notification_email_allowed(p_user_id uuid,p_category text,p_metadata jsonb default '{}'::jsonb)
returns boolean language sql stable security definer set search_path = public as $$
  select case when p_metadata->>'kind' = 'store_launch' then
    coalesce((select s.subscribed from public.store_launch_subscriptions s where s.user_id=p_user_id),false)
  else coalesce((select np.email_enabled and
    case p_category when 'scholarship' then np.email_scholarship
      when 'learning' then np.email_learning when 'marketplace' then np.email_marketplace else true end
    and case coalesce(p_metadata->>'kind','') when 'study_reminder' then np.study_reminders
      when 'weekly_report' then np.weekly_report else true end
    from public.notification_preferences np where np.user_id=p_user_id),
    p_category <> 'marketplace' and coalesce(p_metadata->>'kind','') <> 'weekly_report') end
$$;
revoke all on function public.notification_email_allowed(uuid,text,jsonb) from public, anon, authenticated;
grant execute on function public.notification_email_allowed(uuid,text,jsonb) to service_role;

-- Invoke ONLY when the overhauled Store is actually live. Repeating is safe:
-- one launch notice per account, sent through the existing notification queue.
create or replace function public.announce_store_launch(p_action_url text default '/store')
returns int language plpgsql security definer set search_path = public as $$
declare v_count int;
begin
  if p_action_url is null or p_action_url !~ '^/[^/]' or position(chr(92) in p_action_url)>0 then
    raise exception 'Use an application path for the Store launch link';
  end if;
  with recipients as (
    update public.store_launch_subscriptions set launch_notified_at=now()
    where subscribed and launch_notified_at is null returning user_id
  )
  insert into public.notifications(user_id,channel,category,title,body,action_url,metadata)
    select user_id,'in_app','system','The QuillGlow Store is open',
      'You asked us to let you know when the new Store launches. It is ready to explore.',
      p_action_url,'{"kind":"store_launch"}'::jsonb from recipients;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;
revoke all on function public.announce_store_launch(text) from public, anon, authenticated;
grant execute on function public.announce_store_launch(text) to service_role;
commit;
