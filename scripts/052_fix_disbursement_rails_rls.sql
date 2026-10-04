-- Full-scan finding: disbursement_rails (038) is the only table across
-- the entire migration history (001-051) with no RLS enabled at all.
-- Its sibling table, disbursement_providers, has been service-role-only
-- since it was created — disbursement_rails should match. Without RLS,
-- Supabase's default PostgREST grants mean any authenticated (and
-- possibly anon) caller across any of the four apps could not just read
-- but potentially write to this table, since RLS is the only gate table
-- privileges don't already close. Low content-risk (it's just rail
-- names/purposes, not money or personal data) but a real integrity gap —
-- this is platform configuration, and only admins should ever change it.

alter table public.disbursement_rails enable row level security;
-- No client policies at all — same lockdown as disbursement_providers.
-- Only the service role (admin panel writes, quillglow-main's registry
-- reads via the admin client) can touch this table.
