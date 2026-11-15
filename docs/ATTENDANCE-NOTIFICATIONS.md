# Attendance and academic notifications — Acadely 1.6.0

## What students can use

Attendance is a new sidebar page. It reads existing courses and recurring timetable classes (legacy name-only schedules are resolved only by a unique exact course name/code match, without rewriting saved data), respects semester dates and cancelled dates, and shows pending confirmations without marking anyone absent. Students can confirm Present, Absent, Late, Excused or Pending, edit a record/notes, add a missed record manually, filter history and set each course's attendance target. Manual entries matching a scheduled class open its existing record instead of creating a duplicate. Future attendance cannot be confirmed. Scheduled times are snapshots; manual entries can have their date/time corrected.

Percentage = `(Present + Late) / (confirmed held classes - Excused) * 100`. Pending/future classes are excluded. An empty denominator displays an em dash, not a fake percentage. The default target is an editable 75%, not a claim about any university's rules. At Risk means below target; Warning means within five percentage points above target; Good means at least five points above target (or 100%). Overall percentage weights actual class counts, not averages of course percentages.

Attendance is stored in the existing private workspace JSON (`attendance`) and follows existing LocalStorage, account-cache, optimistic cloud-revision, import/export and RLS behavior. The legacy `unitrack-data-v1` key is unchanged. Course/class deletion and semester transitions retain attendance snapshots, including held classes still pending; they do not cascade-delete attendance history. Archived course names/codes remain available in the history filter. No grade/GPA calculations change.

The bell opens a notification center with unread state, timestamps, category, course/task context, links, read-all/read-one and removal. Removal is a retained tombstone, preventing the same reminder from reappearing. Offline read/removal edits retry against the server. Notification preferences are saved per account in the existing workspace settings. Academic reminders start disabled until the student opts in; browser permission is never requested automatically.

## Reminder rules

- Attendance confirmation: at actual class start, with one optional follow-up (0 disables). No response remains Pending. No automatic absence marking.
- Optional class lead reminder: configurable 0–1440 minutes. A zero-minute lead is combined with the attendance prompt instead of creating two class-start messages.
- Assignments: default 1440, 60 and 0 minutes before deadline; configurable comma-separated minutes, 0–10080. `dueTime` is optional. Existing date-only assignments use an explicit 23:59 cutoff in the student's configured reminder timezone; their saved date is not rewritten.
- Exams: 24 hours and 1 hour before a known start time. Without a start time, only a 09:00 reminder on the previous day is scheduled; no exam start time is invented.
- Quizzes: Calendar's Quiz category, controlled separately. Other calendar/academic reminders and low-attendance warnings are optional. Low-attendance warnings are capped at one per course per local day.
- The shared browser/server rule engine uses an IANA timezone. Overnight classes retain their start-date identity and end the next day. For ambiguous DST clocks it uses the first valid occurrence; nonexistent local times are skipped rather than guessed.
- Quiet hours suppress OS push delivery; notices still enter the private inbox. Recurrence, cancellations, changed/deleted classes, completed assignments, changed deadlines and disabled preferences are rechecked immediately before delivery.
- Offline attendance or assignment-completion edits stop server reminders after cloud synchronization completes. Cron runs each minute. Provider delivery, offline devices, focus/battery settings and OS scheduling can delay or suppress visible notifications. This is not an exact-to-the-second alarm service.

## Backend architecture and deployment status

The additive migration `supabase/migrations/202611150001_academic_reminders.sql` was applied successfully to the existing Supabase project `qmbxadvkvrvkrtansink`. It adds only:

- `acadely_push_subscriptions`: private per-user device endpoints/keys and pause state.
- `acadely_reminder_jobs`: user-scoped idempotency keys, due/expiry times, attempts and leases.
- `acadely_notifications`: private server inbox, read/removal timestamps.
- `acadely_push_deliveries`: successful delivery receipts per job/device.
- `acadely_push_runtime`: scheduler heartbeat/readiness.
- Service-role-only `acadely_schedule_reminders` and `acadely_claim_reminders` functions. The latter uses `FOR UPDATE SKIP LOCKED`, leases and lease recovery.

RLS is enabled on every new table. Browser roles cannot read subscriptions or run scheduler RPCs. Authenticated users may read only their own inbox. The authenticated API derives identity using Supabase Auth `getUser`, ignoring any caller-supplied user ID. Existing profile/workspace tables, account deletion, grade functions and authentication configuration were not replaced.

Both new functions are deployed: `academic-api` (status/subscription/inbox/user actions) and `academic-dispatch` (secret-gated backend worker). Neither source contains private credentials. The dispatcher authenticates its own private `x-acadely-cron` header before database access; the new dispatcher's legacy JWT gate was switched off with the owner's explicit approval after its private cron-secret authentication was configured. The API retains both its gateway gate and its explicit authenticated-user check.

**Server push credentials and the one-minute Cron scheduler are configured and active. An authenticated dispatcher request returned HTTP 200, and Cron heartbeat/success timestamps were verified. Actual OS delivery still requires device opt-in and a successful test notification.** `js/push-config.js` enables read-only backend discovery. The Settings status endpoint keeps Enable Push disabled unless keys, schema and a recent scheduler heartbeat are all present. Do not describe the system as delivering closed-app notifications until a real subscription/test has succeeded.

The dispatcher regenerates candidates from current private workspaces, refreshes pending schedules, cancels outdated jobs at send time, stores one inbox row per idempotency key, retries temporary delivery failures with bounded backoff, records per-device receipts, and removes expired 404/410 endpoints. It does not log private payloads or subscription keys. One malformed workspace is isolated from other students. Normal logout retains the browser subscription, clears its active account context and prevents another account's academic details from being displayed; explicit Pause persists per device/user across reloads. Pending notification actions use an atomic IndexedDB queue with account checks. Unsupported notification action buttons fall back to opening the correct attendance confirmation screen after sign-in.

## Activation and future setup reference

Steps 1–5 were completed with the project owner's explicit approval. The commands remain documented for maintenance; do not regenerate working credentials. Steps 6–7 are the student/device opt-in flow.

1. Generate credentials once with `node scripts/generate-push-credentials.mjs --write`. This creates an owner-only `~/.config/acadely/push.env` outside the repository and refuses to overwrite an existing file. It prints the path, never the values. Keep these keys stable; changing VAPID keys requires device resubscription.
2. In this project's Edge Function Secrets configure `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` (the HTTPS Acadely site URL is valid), and `ACADELY_CRON_SECRET` (random 32+ characters). Supabase provides `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` to the server automatically. Never copy service-role/private keys into browser JavaScript, public files, logs, screenshots or Git.
3. Configure the **new dispatcher only** to use its private header-secret authentication instead of the legacy JWT gateway (`verify_jwt=false`, as in `supabase/config.toml`). Keep the API's user-session validation. Without this change, Cron's header-secret request is rejected at the gateway.
4. In Supabase Vault add `acadely_dispatch_url` with the project dispatcher URL and `acadely_cron_secret` with the same random cron secret. Values stay in Vault; the schedule stores only named secret lookups.
5. Run `supabase/setup-academic-cron.sql`. It checks the named Vault secrets before creating/updating only `acadely-academic-reminders`, enables `pg_cron`/`pg_net` where needed and schedules the dispatcher once per minute. No student attendance or academic data is rewritten.
6. Use **Check server setup** in Settings. It should report Push server connected after a recent heartbeat. Enable academic reminders, review timezone and category choices, and save preferences.
7. On a supported device tap **Enable push on this device**, grant permission, then **Send test notification**. Verify actual arrival before claiming delivery works. Pause is per device; notification preferences are per account.

For CLI-based future deployments, deploy the canonical `supabase/functions/academic-api/index.ts` and `academic-dispatch/index.ts` with the project ref. For the dashboard editor, `node scripts/build-push-functions.mjs /tmp/acadely-push-functions` generates two self-contained upload sources from the same tested engine/helpers; generated bundles contain no secrets. Do not hand-edit generated files. `supabase/config.toml` applies only to these two new functions.

## Device testing

- **iPhone/iPad:** Safari → Share → Add to Home Screen → open the installed Acadely app. Use a supported iOS/iPadOS version (16.4+), sign in, then Settings → Enable push. Notification buttons vary by browser; tapping the notification opens confirmation. No App Store is involved.
- **Android:** use a Web Push-capable browser such as Chrome. Open/sign in, optionally install, enable push from Settings and allow the browser prompt.
- **Mac:** use a supported current Chrome/Firefox/Edge or Safari version. **Windows:** use supported Chrome/Edge/Firefox. Grant site notifications and check system notification/focus settings.
- Send a synthetic test notice, close all Acadely windows/tabs, and confirm the server-delivered notice arrives. Then test a disposable scheduled class, confirm Present/Absent and verify its single attendance record after reopening. Change/cancel the disposable class and complete a disposable assignment to verify stale reminders do not arrive.
- Test quiet hours, one follow-up, per-device Pause, normal sign-out/sign-in and device restart. Never modify real academic records merely to test delivery.

## Validation and limits

- Node suite: `node --test tests/*.test.*` (91 tests).
- Backend security: `deno test --allow-env=ECE_KEYLOG,DEBUG,NODE_DEBUG --node-modules-dir=none --no-lock supabase/tests/academic-security.test.ts` (3 tests). These are dependency debug flags only; do not enable key-logging in production.
- Canonical and generated Edge Function sources passed Deno type checks.
- Isolated PostgreSQL tests applied the migration twice and verified idempotency, atomic claims/lease recovery, terminal jobs, inbox RLS and denial of browser-role scheduler/subscription access.
- Actual Web Push encryption was exercised with disposable in-memory keys: AES-128-GCM ciphertext, VAPID authorization and successful device-side payload decryption. This was not an actual network delivery test.
- Actual IndexedDB transaction code was exercised with concurrent intents, deduplication, per-account selection and exact-action removal.
- Actual application DOM tests covered attendance CRUD/corrections, future/duplicate rejection, pending/excused calculation, targets, notification preferences, exact deadlines, exact-item notice links, inbox operations, archived pending retention, JSON/reload persistence and unchanged grades/timetable.
- Browser checks used disposable local data at 375×812, 390×844 and 430×932: Attendance navigation, saving/corrections, refresh persistence, bell/modal controls, English/Russian/Arabic RTL and no document overflow or captured JavaScript console errors.
- Live backend preflight reached `academic-api` (204); unauthenticated requests to both new functions were denied (401). Existing user academic records were not used as test fixtures.
- Physical phones, real OS permission/subscription delivery, closed-app delivery and cross-device production writes remain untested until a device opts in. The server activation is complete; this is not a claim of verified OS delivery. The pre-existing workspace limit is 1 MiB; attendance/notification history remains subject to that existing cloud limit. No automatic deletion of attendance is used to hide it.

Official references: [Supabase scheduled functions](https://supabase.com/docs/guides/functions/schedule-functions), [Supabase function authorization](https://supabase.com/docs/guides/functions/auth-headers), [Web Push encryption/VAPID library](https://github.com/web-push-libs/web-push), [Apple Web Push requirements](https://developer.apple.com/documentation/usernotifications/sending-web-push-notifications-in-web-apps-and-browsers).

## Files added or changed

Frontend: `index.html`, `css/style.css`, `js/app.js`, `js/academic-ui.js`, `js/account-cloud.js`, `js/attendance-core.js`, `js/attendance-ui.js`, `js/push-store.js`, `js/push-config.js`, `service-worker.js`, `locales/ar.js`, `locales/ru.js`.

Backend/setup: `supabase/config.toml`, `supabase/migrations/202611150001_academic_reminders.sql`, `supabase/setup-academic-cron.sql`, `supabase/functions/_shared/academic.ts`, `supabase/functions/academic-api/index.ts`, `supabase/functions/academic-dispatch/index.ts`, `scripts/build-push-functions.mjs`, `scripts/generate-push-credentials.mjs`, `.gitignore`.

Validation/documentation: `tests/attendance-notifications.test.cjs`, `tests/startup-language-navigation.test.mjs` (new dependency stubs; existing assertions retained), `supabase/tests/academic-security.test.ts`, `README.md`, and this guide. Temporary test tools and private credentials are outside the project and are not published.
