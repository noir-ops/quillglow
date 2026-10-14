-- Companion tables for the Mentoring and Activity (Messages/Alerts)
-- sections of the trusted-adult portal. Kept separate from 044 (the
-- identity/relationship/permission core) since these are content tables,
-- not part of the account model itself.

-- ── Mentoring: goals, action plans, progress reviews, notes ─────────────
-- One table, distinguished by note_type, rather than four separate
-- tables — the fields listed in the spec (student goals, action plans,
-- progress reviews, notes) share the same shape (who wrote it, about
-- which student, what it says, when).
create table if not exists public.mentor_notes (
  id uuid primary key default gen_random_uuid(),
  guardian_link_id uuid not null references public.guardian_links(id) on delete cascade,
  adult_user_id uuid not null references auth.users(id) on delete cascade,
  student_user_id uuid not null references auth.users(id) on delete cascade,
  note_type text not null check (note_type in ('goal', 'action_plan', 'progress_review', 'note')),
  title text,
  content text not null,
  status text default 'open' check (status in ('open', 'in_progress', 'completed', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists mentor_notes_student_idx on public.mentor_notes (student_user_id, created_at desc);
create index if not exists mentor_notes_adult_idx on public.mentor_notes (adult_user_id, created_at desc);

alter table public.mentor_notes enable row level security;

drop policy if exists "adult manages own mentor notes" on public.mentor_notes;
create policy "adult manages own mentor notes" on public.mentor_notes
  for all to authenticated using (auth.uid() = adult_user_id) with check (auth.uid() = adult_user_id);

drop policy if exists "student reads notes about them" on public.mentor_notes;
create policy "student reads notes about them" on public.mentor_notes
  for select to authenticated using (auth.uid() = student_user_id);

-- ── Messages: one thread per guardian_link ───────────────────────────────
create table if not exists public.guardian_messages (
  id uuid primary key default gen_random_uuid(),
  guardian_link_id uuid not null references public.guardian_links(id) on delete cascade,
  sender_user_id uuid not null references auth.users(id) on delete cascade,
  body text not null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists guardian_messages_link_idx on public.guardian_messages (guardian_link_id, created_at);

alter table public.guardian_messages enable row level security;

drop policy if exists "link participants read messages" on public.guardian_messages;
create policy "link participants read messages" on public.guardian_messages
  for select to authenticated using (
    exists (
      select 1 from public.guardian_links gl
      where gl.id = guardian_link_id
        and (gl.adult_user_id = auth.uid() or gl.student_user_id = auth.uid())
    )
  );

drop policy if exists "link participants send messages" on public.guardian_messages;
create policy "link participants send messages" on public.guardian_messages
  for insert to authenticated with check (
    auth.uid() = sender_user_id
    and exists (
      select 1 from public.guardian_links gl
      where gl.id = guardian_link_id
        and gl.status = 'active'
        and (gl.adult_user_id = auth.uid() or gl.student_user_id = auth.uid())
    )
  );

-- ── Alerts: system-generated, per trusted adult ──────────────────────────
create table if not exists public.guardian_alerts (
  id uuid primary key default gen_random_uuid(),
  adult_user_id uuid not null references auth.users(id) on delete cascade,
  guardian_link_id uuid references public.guardian_links(id) on delete cascade,
  alert_type text not null,
    -- e.g. 'scholarship_deadline','missing_document','exam_approaching',
    -- 'student_falling_behind','new_opportunity','funding_released',
    -- 'payment_issue','mentor_review_required'
  title text not null,
  body text,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists guardian_alerts_adult_idx on public.guardian_alerts (adult_user_id, created_at desc) where not is_read;

alter table public.guardian_alerts enable row level security;

drop policy if exists "adult reads own alerts" on public.guardian_alerts;
create policy "adult reads own alerts" on public.guardian_alerts
  for select to authenticated using (auth.uid() = adult_user_id);

drop policy if exists "adult marks own alerts read" on public.guardian_alerts;
create policy "adult marks own alerts read" on public.guardian_alerts
  for update to authenticated using (auth.uid() = adult_user_id) with check (auth.uid() = adult_user_id);
-- No client insert policy — alerts are system-generated (service role) only.
