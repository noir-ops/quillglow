-- Chat history retention.
--
-- The source architecture document is explicit: "Do not store entire
-- conversations indefinitely, store useful structured information." Two
-- tables currently violate this — `sprout_chat_sessions` and `tutor_sessions`
-- both keep every raw message forever, with no expiry or pruning.
--
-- The structured side (learning_events, student_concept_mastery) already does
-- the right thing — it's append-only by design and that's intentional (see
-- 016_learning_graph.sql). This migration brings the RAW CHAT LOGS in line
-- with the same principle: keep enough recent context for a student to
-- resume a conversation, prune everything older, and never let a single
-- session grow unbounded even within the retention window.
--
-- Two independent limits, whichever keeps MORE:
--   1. messages within the last N days (default 90)
--   2. the most recent M messages regardless of age (default 10)
-- A returning student six months later still sees their last few exchanges
-- rather than a jarring blank slate, while nothing grows forever.

create or replace function public.prune_chat_history(
  p_retention_days int default 90,
  p_min_keep int default 10,
  p_hard_cap int default 200
)
returns table (session_id uuid, table_name text, messages_before int, messages_after int)
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  v_kept jsonb;
  v_total int;
  v_kept_count int;
begin
  -- ── sprout_chat_sessions ───────────────────────────────────────────────
  for r in
    select id, messages from public.sprout_chat_sessions
    where jsonb_array_length(messages) > p_min_keep
  loop
    v_total := jsonb_array_length(r.messages);

    select coalesce(jsonb_agg(elem order by ord), '[]'::jsonb) into v_kept
    from (
      select elem, ord
      from jsonb_array_elements(r.messages) with ordinality as t(elem, ord)
      where (elem ->> 'created_at')::timestamptz >= now() - make_interval(days => p_retention_days)
         or ord > v_total - p_min_keep
      order by ord desc
      limit p_hard_cap
    ) sub;

    v_kept_count := jsonb_array_length(v_kept);

    if v_kept_count < v_total then
      -- jsonb_agg above pulled newest-first (for the hard cap to bite on the
      -- right end); restore chronological order before writing back.
      select jsonb_agg(elem order by (elem ->> 'created_at')::timestamptz) into v_kept
      from jsonb_array_elements(v_kept) as elem;

      update public.sprout_chat_sessions
      set messages = v_kept, message_count = v_kept_count
      where id = r.id;

      session_id := r.id;
      table_name := 'sprout_chat_sessions';
      messages_before := v_total;
      messages_after := v_kept_count;
      return next;
    end if;
  end loop;

  -- ── tutor_sessions ───────────────────────────────────────────────────────
  -- Pre-existing table with no dedicated migration in this repo; columns
  -- referenced here (id, messages) are the ones the app already reads/writes.
  -- Messages here don't carry a per-item timestamp the way sprout's do, so
  -- pruning is purely by count (hard cap only) rather than by age.
  for r in
    select id, messages from public.tutor_sessions
    where jsonb_array_length(messages) > p_hard_cap
  loop
    v_total := jsonb_array_length(r.messages);

    select jsonb_agg(elem order by ord) into v_kept
    from (
      select elem, ord
      from jsonb_array_elements(r.messages) with ordinality as t(elem, ord)
      where ord > v_total - p_hard_cap
    ) sub;

    v_kept_count := jsonb_array_length(v_kept);

    update public.tutor_sessions
    set messages = v_kept
    where id = r.id;

    session_id := r.id;
    table_name := 'tutor_sessions';
    messages_before := v_total;
    messages_after := v_kept_count;
    return next;
  end loop;
end;
$$;
