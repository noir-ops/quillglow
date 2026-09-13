-- The disconnect this fixes: the guardian portal wrote goals and action
-- plans into mentor_notes, a table quillglow-main has never read. The
-- student's actual daily goals live in `tasks` (007), which the guardian
-- portal never touched. Two parallel systems, zero overlap — a parent
-- could set a goal and the student would never see it anywhere.
--
-- Rather than have the guardian portal write directly into `tasks` (which
-- would make an adult's goal indistinguishable from the student's own,
-- and un-attributable), mentor_notes stays the system of record for
-- adult-authored guidance and a trigger MIRRORS goal/action_plan rows
-- into tasks. The student sees them in their normal daily flow; the
-- attribution and the adult's editing surface stay intact.

-- Provenance on tasks: who created it, and from which mentor_note. Null
-- for everything the student creates themselves, so existing rows and
-- normal student behaviour are completely unaffected.
alter table public.tasks
  add column if not exists created_by_user_id uuid references auth.users(id) on delete set null,
  add column if not exists source_mentor_note_id uuid references public.mentor_notes(id) on delete cascade,
  add column if not exists source_link_type text check (source_link_type in ('family', 'mentor'));

create index if not exists tasks_source_note_idx on public.tasks (source_mentor_note_id) where source_mentor_note_id is not null;

/**
 * Mirrors an adult-authored goal or action plan into the student's task
 * list. Only 'goal' and 'action_plan' mirror — 'progress_review' and
 * 'note' are the adult's own record-keeping, not something the student
 * should find sitting in their daily to-dos.
 */
create or replace function public.sync_mentor_note_to_task()
returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_link_type text;
begin
  if new.note_type not in ('goal', 'action_plan') then
    return new;
  end if;

  select gl.link_type into v_link_type
  from public.guardian_links gl
  where gl.id = new.guardian_link_id;

  if tg_op = 'INSERT' then
    insert into public.tasks (
      user_id, title, description, priority, completed, due_date,
      created_by_user_id, source_mentor_note_id, source_link_type
    ) values (
      new.student_user_id,
      coalesce(new.title, case new.note_type when 'goal' then 'Goal from your mentor' else 'Action plan' end),
      new.content,
      'medium',
      false,
      -- Dated to today deliberately. quillglow-main's dashboard shows
      -- "Today's Tasks" by filtering due_date to the current day — a
      -- mirrored goal with a null due_date would exist in the planner but
      -- never appear in the student's daily view, which is precisely
      -- where an adult setting a goal expects it to land.
      date_trunc('day', now()) + interval '12 hours',
      new.adult_user_id,
      new.id,
      v_link_type
    );
  elsif tg_op = 'UPDATE' then
    -- Keep the mirrored task in step with edits, but never silently
    -- un-complete something the student already finished.
    update public.tasks
    set title = coalesce(new.title, title),
        description = new.content,
        updated_at = now()
    where source_mentor_note_id = new.id;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_sync_mentor_note_to_task on public.mentor_notes;
create trigger trg_sync_mentor_note_to_task
  after insert or update on public.mentor_notes
  for each row execute function public.sync_mentor_note_to_task();

/**
 * The reverse direction: when a student completes a mirrored task, the
 * originating mentor_note moves to 'completed' so the adult sees progress
 * in their own workspace without needing a separate check-in. Without
 * this the mirror is one-way and the adult never learns the goal was met.
 */
create or replace function public.sync_task_completion_to_mentor_note()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.source_mentor_note_id is null then
    return new;
  end if;
  if new.completed is distinct from old.completed then
    update public.mentor_notes
    set status = case when new.completed then 'completed' else 'open' end,
        updated_at = now()
    where id = new.source_mentor_note_id;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_sync_task_completion on public.tasks;
create trigger trg_sync_task_completion
  after update on public.tasks
  for each row execute function public.sync_task_completion_to_mentor_note();

-- Deleting the adult's note removes the mirrored task automatically via
-- the ON DELETE CASCADE on source_mentor_note_id — no trigger needed.

/**
 * Guardian alerts were equally disconnected: guardian_alerts is written
 * for the ADULT, but nothing ever notified the STUDENT that an adult had
 * set them a goal. This mirrors adult-authored goals into the student's
 * existing notifications table (024) so it shows up where students
 * already look.
 */
create or replace function public.notify_student_of_mentor_note()
returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_adult_name text;
begin
  if new.note_type not in ('goal', 'action_plan') then
    return new;
  end if;

  select ta.full_name into v_adult_name
  from public.trusted_adults ta
  where ta.user_id = new.adult_user_id;

  insert into public.notifications (user_id, category, title, body, action_url, metadata)
  values (
    new.student_user_id,
    'learning',
    coalesce(v_adult_name, 'Your mentor') || ' set you a new ' ||
      case new.note_type when 'goal' then 'goal' else 'action plan' end,
    coalesce(new.title, left(new.content, 120)),
    -- /mentor, not /planner — that page shows the goal WITH who set it
    -- and why (via the Goals & plans tab), not just as a bare task.
    '/mentor',
    jsonb_build_object('mentor_note_id', new.id, 'note_type', new.note_type)
  );

  return new;
end;
$$;

drop trigger if exists trg_notify_student_of_mentor_note on public.mentor_notes;
create trigger trg_notify_student_of_mentor_note
  after insert on public.mentor_notes
  for each row execute function public.notify_student_of_mentor_note();

/**
 * Same problem for messages: guardian_messages (045) had no reader on the
 * student side at all — quillglow-main has no guardian-messaging UI, so a
 * parent or mentor could write and the student would never know. Until
 * that UI exists, route the message into the student's existing
 * notification bell so it at least reaches them.
 */
create or replace function public.notify_student_of_guardian_message()
returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_link record;
  v_sender_name text;
  v_recipient uuid;
begin
  select * into v_link from public.guardian_links gl where gl.id = new.guardian_link_id;
  if not found then
    return new;
  end if;

  -- Only notify when the ADULT is the sender; a student messaging their
  -- own guardian shouldn't generate a notification back to themselves.
  if new.sender_user_id <> v_link.adult_user_id then
    return new;
  end if;

  v_recipient := v_link.student_user_id;

  select ta.full_name into v_sender_name
  from public.trusted_adults ta
  where ta.user_id = new.sender_user_id;

  insert into public.notifications (user_id, category, title, body, action_url, metadata)
  values (
    v_recipient,
    'system',
    'New message from ' || coalesce(v_sender_name, 'your mentor'),
    left(new.body, 140),
    '/mentor',
    jsonb_build_object('guardian_link_id', new.guardian_link_id, 'message_id', new.id)
  );

  return new;
end;
$$;

drop trigger if exists trg_notify_student_of_guardian_message on public.guardian_messages;
create trigger trg_notify_student_of_guardian_message
  after insert on public.guardian_messages
  for each row execute function public.notify_student_of_guardian_message();
