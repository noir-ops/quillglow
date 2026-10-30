# Before deploying the latest QuillGlow updates

## Required now

1. **Shared Supabase database**
   - Both hosting projects must point to the same production Supabase project.
   - If the AI settings table/open-source columns are missing, run main-app migrations `014_create_ai_provider_settings.sql` then `056_add_opensource_ai_provider.sql`.
   - Run main-app `069_notification_email_delivery.sql` (requires the existing `024_wallet_notifications.sql` schema), then **`070_store_launch_notifications.sql`**. Both are safe to rerun and neither sends old notifications/Store launch announcements.

2. **Hosting environment variables**
   - BOTH apps: keep `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and server-only `SUPABASE_SERVICE_ROLE_KEY` correctly configured. Add server-only `OPEN_SOURCE_MODEL_API_KEY` if your selected endpoint requires a key. Keep all existing OpenAI/Gemini, Google OAuth, billing and other working settings.
   - MAIN app: `MAILERSEND_API_KEY`, verified `MAILERSEND_FROM_EMAIL`, `MAILERSEND_FROM_NAME=QuillGlow`, canonical `NEXT_PUBLIC_APP_URL`, and a long random server-only `CRON_SECRET`.
   - ADMIN app: the MailerSend API key/sender/name for the admin self-test, and correct `ADMIN_EMAILS` or a trusted admin role assignment.
   - Do not prefix service-role, provider, MailerSend, or cron secrets with `NEXT_PUBLIC_`.

3. **Open-source endpoint**
   - Use an OpenAI-compatible API base URL reachable from BOTH deployed apps. A laptop's localhost URL will not work from hosting.
   - Admin → APIs: enter the URL and exact served model ID, Test connection, then select Open-source and Save. Settings take effect within the existing 30-second cache window.
   - Confirm chat, streamed responses, JSON generation, and image input if used are supported by the model/server. This selection does not replace separate embedding, speech, or audio APIs.

4. **Supabase Auth settings and SMTP**
   - Keep Email/password and Confirm Email enabled. Keep Google OAuth settings.
   - Set Site URL to your actual main-app origin. Allow `/auth/callback`, `/auth/callback?next=/auth/reset-password`, `/auth/callback?next=/settings`, and `/auth/confirm` on that origin. Keep old URLs allowed while existing links expire.
   - Enable custom SMTP using the host and SMTP username/password provided by MailerSend for your verified domain, with TLS port 587. SMTP credentials differ from the HTTP API token in the app.
   - Paste the main app's `email-templates/confirm-signup.html`, `reset-password.html`, and `change-email.html` into the matching Supabase Auth templates. Disable click tracking/link rewriting for Auth mail. Review SMTP/Auth quotas and rate limits.

5. **Email DNS and delivery**
   - Verify your MailerSend sending domain with the exact issued SPF and DKIM records. Publish DMARC for the From domain; start with monitoring if your existing senders have not been audited.
   - Keep one SPF policy per domain; merge includes rather than adding conflicting policies.
   - Use a verified domain sender. App notifications and Auth SMTP both need correct configuration. Inbox placement must be tested; code alone cannot guarantee it.

6. **Notification scheduler**
   - A daily 04:00 UTC backstop is included. For timely email when users are offline, configure a supported hosting cron plan or external scheduler to GET `/api/cron/notification-emails` every 1–5 minutes, sending `Authorization: Bearer <CRON_SECRET>`.
   - The worker processes at most 5 queued emails per cron call. Existing cron schedules are retained. Active users also trigger small delivery batches through notification polling.

7. **Deploy and verify**
   - Deploy both updated apps after migrations/environment configuration.
   - Test Admin → APIs connection and email self-test. The latter tests admin MailerSend delivery, not Auth SMTP.
   - Use Gmail AND Outlook/Yahoo/custom-domain test accounts for signup, resend, code/link verification, password reset and email changes.
   - Verify a test notification appears in-app and is accepted by MailerSend; check provider Activity and inbox/spam. Test opt-out.
   - Open `/store` and `/shop`: both should show coming soon. Sign in with a verified account, opt in, refresh, then cancel and refresh. Check Admin → Store Notifications.
   - Verify existing orders/payment confirmations still work and new Store checkout attempts are blocked. No extra mailing-list service/key is needed.

## Later, when the overhauled Store is live

Change `STORE_COMING_SOON` to false in `lib/store-status.ts`, complete/deploy the overhaul, then run `select public.announce_store_launch('/store');` from a trusted Supabase SQL session. Do not run this announcement before the Store launches. It queues one launch notice per enrolled account; the configured worker handles email delivery. Users can cancel from the coming-soon page, and queued sends recheck that consent.

## Validation and remaining limitations

Both updated production builds and focused regression tests passed. The original codebases have unrelated TypeScript errors, and their original Next configurations skip type errors during builds. No live deployment credentials, Supabase project settings, DNS, provider endpoint, or inbox delivery were available to verify. A fuller explanation is in `SETUP_FIXES.md` inside both ZIPs.
