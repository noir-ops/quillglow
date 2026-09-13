# 021_benefactor_accounts.sql — owned by the Benefactor Portal app

This migration now lives with **quillglow_benefactor-main**, which owns the
`benefactors` table and the submission/review workflow.

It is kept here as a copy because **QuillGlow depends on one part of it**: it
replaces the student-facing RLS policy on `opportunities` so that students only
see rows that are `status = 'active'` **AND** `review_status = 'approved'`.

Without that policy change, unreviewed benefactor submissions would be visible
to students the moment the benefactor portal goes live.

Run it once against the shared database — from either project, not both.
