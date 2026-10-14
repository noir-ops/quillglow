# QuillGlow setup fixes — deployment guide

The supplied ZIPs are updated source code. No live deployment, database, API credentials, DNS records, or Supabase project settings were changed. Do the activation steps below against the shared production Supabase project and your two hosting projects. Keep Google OAuth, existing billing, and existing OpenAI/Gemini environment routing settings.

## 1. Shared database

If not already applied, run the main app's `scripts/014_create_ai_provider_settings.sql`, then `scripts/056_add_opensource_ai_provider.sql`. The admin equivalents are `005_create_ai_provider_settings.sql` and `006_add_opensource_ai_provider.sql`; these are the same shared table, so do not create separate databases.

Run **`scripts/069_notification_email_delivery.sql` from the main app** after the existing `024_wallet_notifications.sql`. It is transactional and safe to rerun. It adds notification preferences, an email outbox, an insert trigger, and service-role-only queue functions. Existing in-app notifications remain intact. Existing notifications are deliberately not bulk-emailed.

The existing admin access policy still applies: use `ADMIN_EMAILS` or a trusted `user_roles` admin assignment. Merely being signed in does not grant API access.

## 2. Open-source API in Admin → APIs

1. Host or obtain an **OpenAI-compatible chat-completions** endpoint. Supply its API base URL, usually ending in `/v1` (not `/chat/completions`). It must be reachable from BOTH deployed apps; `localhost` on Vercel points to Vercel, not your laptop. A self-hosted service needs a reachable authenticated gateway for production.
2. Set `OPEN_SOURCE_MODEL_API_KEY` as a **server-only variable in BOTH apps** if the endpoint requires authentication. The DB and browser never receive this key. Unauthenticated private endpoints are supported without a key.
3. In Admin → APIs, enter the base URL, click Fetch models, select or type the exact served model ID, and click Test connection. Model listing is optional; manual entry remains available even when a list exists. Test connection validates nonempty assistant output, not just HTTP 200.
4. Select Open-source model and Save. Both apps must share the same Supabase project/service role. Settings propagate within the existing 30-second cache window.
5. Test QuillGlow chat, flashcards/JSON generation, and a streamed tutor request. All three routes now honor the open-source selection. Existing OpenAI/Gemini layer routing remains as before when open-source is inactive.

Your endpoint/model must support the request features you use: chat completions, `stream: true` SSE for tutor chat, `response_format: {type: "json_object"}` for structured generation, and image content for image flashcards. Choose a multimodal model if learners use images. A text-only model does not gain vision through this integration. Embeddings, speech recognition, and audio synthesis retain their existing separate integrations; this setting selects the chat/generation LLM.

## 3. Email/password login for every email provider

The existing password login is not restricted to Gmail. Two different delivery systems need configuring: **Supabase Auth SMTP** for signup/recovery/email-change, and the **MailerSend HTTP API** for application notifications/support. Configuring one does not configure the other.

### Supabase Authentication

1. Keep Email/password provider enabled and Confirm Email enabled. Keep Google OAuth settings unchanged.
2. Set Site URL to your canonical production main-app origin, for example `https://quillglow.com` (use your actual domain). Add these exact allowed redirect URLs for production and any intended development origin:
   - `/auth/callback`
   - `/auth/callback?next=/auth/reset-password`
   - `/auth/callback?next=/settings`
   - `/auth/confirm`
   - Keep old login/reset URLs allowed while previously issued links expire.
3. Enable **custom SMTP** using MailerSend's SMTP credentials for your verified sending domain. Use the host displayed by MailerSend, TLS on port 587, and that domain's SMTP username/password. SMTP credentials are not the MailerSend HTTP API token. Set the sender name to QuillGlow and sender email to your verified address.
4. Paste `email-templates/confirm-signup.html`, `reset-password.html`, and `change-email.html` from the main app into the corresponding Supabase email templates. These token-hash links work across browsers/devices without a PKCE verifier. Signup also includes the OTP code that users can enter on the verification page. Review your project's OTP expiry/length; the UI accepts the configured code length.
5. Disable click tracking/link rewriting for Auth mail. Security scanners can consume single-use links; the signup OTP provides an alternative when that happens. Do not disable email verification to work around delivery problems.
6. Set appropriate Auth email rate limits for your SMTP quota. The resend UI has a 60-second cooldown; Supabase remains the authoritative server-side rate limit. Existing unconfirmed users should use Resend verification email rather than create another account.

Supabase's default sender is for testing and restricts recipients to project team members. That can explain missing mail even when the app code is correct, but the uploaded source alone cannot establish your current SMTP settings.

### Domain authentication and spam

Verify the MailerSend sending domain with the exact provider-issued SPF and DKIM records. Publish DMARC for the From domain, starting in monitoring mode if you have not audited all senders. Merge SPF includes into one SPF policy rather than adding conflicting records. Use a verified domain sender, not an arbitrary Gmail/Yahoo address. Check MailerSend Activity and Supabase Auth logs for rejected/bounced messages, and inspect a received email's headers for SPF/DKIM/DMARC alignment. These changes improve delivery; no code change can guarantee inbox placement.

Official references:
- https://supabase.com/docs/guides/auth/auth-smtp
- https://supabase.com/docs/guides/auth/server-side/creating-a-client
- https://developers.mailersend.com/api/v1/email/smtp-relay
- https://www.mailersend.com/help/how-to-verify-and-authenticate-a-sending-domain

## 4. Application notification delivery

Set these server/hosting variables on the **main app**:

```env
MAILERSEND_API_KEY=<email API token>
MAILERSEND_FROM_EMAIL=<verified sender>
MAILERSEND_FROM_NAME=QuillGlow
NEXT_PUBLIC_APP_URL=https://your-canonical-main-domain
CRON_SECRET=<long random secret>
```

Set `MAILERSEND_API_KEY`, `MAILERSEND_FROM_EMAIL`, and `MAILERSEND_FROM_NAME` on the **admin** app too for the delivery status/self-test in Admin → APIs. The admin test sends only to the current verified admin's address; no live messages were sent while implementing these changes. It checks the admin deployment's API, not Supabase Auth SMTP or the main deployment's variables.

New in-app/email notification records enqueue eligible emails transactionally. The worker rechecks current opt-outs and requires a confirmed current recipient email. The email switches in Settings now persist. Scholarship and learning emails default on; marketplace/report mail defaults off. Auth confirmation/recovery emails are handled independently by Supabase.

`metadata.kind: "study_reminder"` and `"weekly_report"` obey their dedicated toggles. The original archives contain no reminder scheduler or weekly report generator. These preferences now work for notifications with those tags; this patch does not introduce unsolicited reminder/report generation.

Active users' existing `/api/notifications` polling delivers small batches after the response. A daily `04:00 UTC` cron was added without changing the existing cron schedules. **For timely mail while users are offline, configure an external scheduler (or supported hosting cron plan) to call `/api/cron/notification-emails` every 1–5 minutes with `Authorization: Bearer <CRON_SECRET>`.** The default daily schedule is a backstop, not immediate offline delivery. The worker claims at most 5 messages per cron invocation; increase scheduler frequency for volume.

A 202 response means accepted/queued by MailerSend, not delivered to the inbox. Outbox `status='sent'` likewise records provider acceptance and retains `provider_message_id` for provider Activity lookup. Check failed queue items in the admin status card and provider logs. HTTP 429/5xx/network failures retry with backoff, bounded at 5 attempts; nonretryable failures remain failed. Leases prevent simultaneous workers from sending the same row. A crash/timeout after provider acceptance may still cause duplicate delivery on recovery because MailerSend acceptance and database acknowledgement are not one atomic transaction. Consult provider Activity before manually replaying ambiguous items.

## 5. Study Together

The toggle moved from Dashboard to Settings. Study Together stays under Resources on desktop and mobile (it was already grouped there in the supplied archive). Changes save the same profile preference and immediately update navigation without a full reload. A failed save rolls back and displays an error. No study rooms, links, chat flows, or other dashboard features were removed.

## 6. Release checks

- Run `node scripts/test-setup.cjs` in the main app after `npm ci`.
- Optional PostgreSQL-compatible queue test: temporarily install `@electric-sql/pglite` without saving to package.json and run `node scripts/test-email-queue.cjs` in the main app.
- Run `node scripts/test-api-setup.cjs` in the admin app after installing its original dependencies.
- Sign up using Outlook/Yahoo/custom-domain and Gmail addresses. Receive confirmation, use a link in another browser and use the code, then log in with the password.
- Resend an expired confirmation; confirm that rate limits show an error rather than false success.
- Recover a password and change an email using the supplied templates.
- Trigger a real scholarship status/payment notification in a test account. Confirm the in-app item and accepted email record. Opt out and verify subsequent emails are skipped while in-app records still appear.
- Check Study Together on desktop/mobile, disable/enable in Settings, and refresh to verify persistence.
- Select open-source, exercise JSON and streamed requests; switch back and check existing provider operation.

## Validation performed on these archives

Both production builds completed with placeholder Supabase values. The main build required `NEXT_TURBOPACK_EXPERIMENTAL_USE_SYSTEM_TLS_CERTS=1` in this environment to fetch the existing Google fonts; no font or app build configuration was changed. Builds already skip TypeScript errors in their supplied Next configuration, so this is not a claim of type-clean code. Full TypeScript checks found existing errors in unrelated code (77 diagnostics in the main app, 20 in admin); comparing original code found no new diagnostic file/code combinations from this patch.

Mocked regression tests passed for direct, task-routed, JSON, image, and SSE open-source requests; preserved OpenAI routing; admin authorization; malformed endpoint/body handling; safe auth redirect paths; verified email recipients; opt-outs; escaping; and retry limits. An isolated PostgreSQL-compatible engine also ran the original notification schema and new migration twice and passed queue/default/preference/lease/permission checks. No live model response, external SMTP/DNS, real inbox placement, or deployed database was tested.

Browser interaction testing was unavailable because this environment could not download a runnable Chromium binary. The live email/model activation checks above must be completed after configuration.

## 7. Store coming soon and launch notification signup

Both `/store` and `/shop` now redirect to `/store/coming-soon`. Store navigation links use `/store`. New Polar and family-wallet Store checkout requests are paused on the server as well. Existing `/shop/orders`, `/shop/success`, payment verification, and subscription billing remain accessible. The previous storefront is retained in `components/store/storefront.tsx` for the overhaul.

Run **`scripts/070_store_launch_notifications.sql` from the main app AFTER 069**. This adds the opt-in table and service-only signup/announcement functions; it sends no emails. Notification signup uses each signed-in user's current verified QuillGlow account email. Visitors can sign in or create a free account, then return to Store to opt in. No anonymous mailing list or third-party newsletter service is required. Repeated signup is safe; users can cancel from the coming-soon page. Admin → Store Notifications shows the latest 100 active signups and the total count.

This Store launch signup is separate explicit consent: opting in authorizes the Store launch email even if general email notifications are off. Cancelling it before queued delivery suppresses that email. The worker still requires the account's current email to be verified. No signup email or launch email has been sent during this implementation.

**When the overhaul is finished (not before this deployment):**

1. Set `STORE_COMING_SOON = false` in `lib/store-status.ts`, complete the new storefront, and deploy it. This reopens the new-checkout paths as well.
2. Only after the Store is actually live, run `select public.announce_store_launch('/store');` in the trusted Supabase SQL editor, or call that function with a service-role server process. It creates the in-app launch notices and queues email through the existing worker. It is idempotent for each enrolled account, so repeated execution does not resend the same launch notice.
3. Verify the worker runs, and inspect the accepted-message queue/provider Activity. `launch_notified_at` means the notice was queued; it does not prove inbox delivery.

Additional checks passed: Store redirects; unauthenticated/unverified signup handling; server-controlled account identity; explicit opt-in/cancellation; new-checkout guards; migration run twice; idempotent signup and announcement; and cancellation of queued Store emails. Run `node scripts/test-store-setup.cjs` for the route/payment checks. The optional PostgreSQL-compatible test is `scripts/test-store-notifications.cjs` (requires a temporary `@electric-sql/pglite` install). Both production builds completed again after the Store changes; there were no new TypeScript diagnostic file/code combinations.
