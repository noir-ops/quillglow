-- Scholarship application form + application dashboard.
--
-- Until now an application row could only hold `notes` (one essay box) and
-- `documents` — there was nowhere to store the applicant's personal,
-- academic, financial, activity or reference details, so a learner could
-- not actually submit a real application. This adds:
--
--   form_data    — all seven form sections as JSON (see lib/applications/form.ts)
--   screened_at  — when the application reached the "Screen" stage
--   decided_at   — when a final decision (awarded / rejected) was made
--   archived_at  — learner-controlled "Archived" tab on the dashboard
--
-- The dashboard's four-step tracker (In-Progress → Submitted → Screen →
-- Decision) reads created_at / submitted_at / screened_at / decided_at.

alter table public.opportunity_applications
  add column if not exists form_data jsonb not null default '{}'::jsonb,
  add column if not exists screened_at timestamptz,
  add column if not exists decided_at timestamptz,
  add column if not exists archived_at timestamptz;

-- Backfill stage dates for applications already reviewed before this existed.
update public.opportunity_applications
  set screened_at = coalesce(screened_at, updated_at)
  where status = 'shortlisted' and screened_at is null;
update public.opportunity_applications
  set decided_at = coalesce(decided_at, updated_at)
  where status in ('awarded', 'rejected') and decided_at is null;

-- ── Stage dates are set by the database, not by callers ──────────────────
-- Whichever path changes the status (admin panel, Impact Partner app, any
-- future one), the tracker dates stay correct.
create or replace function public.set_application_stage_dates()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.status is distinct from old.status then
    if new.status = 'shortlisted' then
      new.screened_at := coalesce(new.screened_at, now());
    elsif new.status in ('awarded', 'rejected') then
      new.decided_at := coalesce(new.decided_at, now());
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_set_application_stage_dates on public.opportunity_applications;
-- Named "trg_set_..." so it fires after the "trg_guard_..." triggers
-- (Postgres runs same-timing triggers in name order).
create trigger trg_set_application_stage_dates
before update on public.opportunity_applications
for each row execute function public.set_application_stage_dates();

-- ── Student write guard (033), extended ──────────────────────────────────
-- Identical to 033 plus two additions:
--  * screened_at / decided_at are review fields — a learner must never be
--    able to mark their own application as screened or decided.
--  * form_data is frozen once submitted. The API already blocks editing a
--    submitted application; this enforces it at the database too.
create or replace function public.guard_student_application_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_is_owner boolean;
begin
  v_is_owner := (auth.uid() is not null and old.user_id = auth.uid());

  if v_is_owner then
    if new.status not in ('saved', 'in_progress', 'submitted', 'withdrawn')
       and new.status is distinct from old.status then
      new.status := old.status;
    end if;

    new.award_amount     := old.award_amount;
    new.payment_status   := old.payment_status;
    new.paid_amount      := old.paid_amount;
    new.paid_at          := old.paid_at;

    -- NEW (064)
    new.screened_at      := old.screened_at;
    new.decided_at       := old.decided_at;
    if old.status not in ('saved', 'in_progress') then
      new.form_data := old.form_data;
    end if;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

create index if not exists opportunity_applications_user_archived_idx
  on public.opportunity_applications (user_id, archived_at);
