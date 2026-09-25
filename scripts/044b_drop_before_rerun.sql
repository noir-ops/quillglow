-- Run this BEFORE re-running 044_trusted_adult_accounts.sql.
-- Both functions had their OUT-parameter names changed (invite_code ->
-- out_invite_code, link_type -> out_link_type) to fix the "column
-- reference is ambiguous" bug — Postgres treats that as a return-type
-- change, which CREATE OR REPLACE FUNCTION is not allowed to do.

drop function if exists public.create_guardian_link_invite(text, text);
drop function if exists public.accept_guardian_link_invite(text);
