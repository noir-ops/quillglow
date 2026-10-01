-- Second half of the guardian/student disconnect: the guardian portal's
-- Learning and Analytics pages only ever read opportunity_applications —
-- scholarship activity — and showed "not connected yet" for everything
-- academic. The actual study data (tasks, pomodoro_sessions, flashcards)
-- was unreachable, because those tables are RLS-locked to the student.
--
-- Same approach as 046: grant exactly the reads the specified capability
-- ("view_learning_progress", a default on BOTH family and mentor links)
-- requires, gated by an active guardian_links row. Nothing broader, and
-- no write access of any kind — an adult can see study activity, never
-- alter it. The one exception is the goal-mirroring in 048, which writes
-- through a trigger under a controlled shape, not direct table access.

-- tasks: 007 created these policies with USING (auth.uid() = user_id).
-- A second permissive SELECT policy is OR'd with the existing one, so
-- students keep full access to their own rows exactly as before.
drop policy if exists "guardian reads linked tasks" on public.tasks;
create policy "guardian reads linked tasks" on public.tasks
  for select to authenticated using (
    public.has_guardian_permission(user_id, 'view_learning_progress')
  );

drop policy if exists "guardian reads linked pomodoro sessions" on public.pomodoro_sessions;
create policy "guardian reads linked pomodoro sessions" on public.pomodoro_sessions
  for select to authenticated using (
    public.has_guardian_permission(user_id, 'view_learning_progress')
  );

drop policy if exists "guardian reads linked flashcard decks" on public.flashcard_decks;
create policy "guardian reads linked flashcard decks" on public.flashcard_decks
  for select to authenticated using (
    public.has_guardian_permission(user_id, 'view_learning_progress')
  );

-- Deliberately NOT granted: notes and mood_logs. Both are personal
-- reflective content — a student's private notes and their mood history
-- are not "learning progress" in the sense the permission describes, and
-- silently exposing them to a parent under a progress-viewing flag would
-- be a meaningful privacy breach the student never agreed to. If that
-- access is ever wanted it should be its own explicit, separately
-- consented permission, not folded into this one.
