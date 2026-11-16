# ACADELY

ACADELY is a student productivity workspace built with HTML, CSS, and vanilla JavaScript. It can run locally with browser storage or connect to Supabase Authentication and PostgreSQL for private multi-device accounts. There is no application server to maintain; GitHub Pages serves the frontend and Supabase provides the account backend.

## Features

- Assignments, courses, assessments, weekly classes, and exams.
- Configurable university and semester details, grade boundaries, GPA scale, and daily study availability.
- What-if grade predictions, semester overview, and rule-based study planning.
- Monthly, weekly, and daily academic calendar views.
- Student profile and public creator information kept separate.
- Safe JSON import validation and JSON export.
- Optional Supabase registration, sign-in, email verification, password recovery, account settings, and device-to-device workspace sync.
- Account-backed student profiles with Auth-sourced name/email and private optional student details and profile pictures.
- Existing local data is kept in `unitrack-data-v1`. When a student first signs in, Acadely previews record counts and asks whether to merge the browser data. The original key is not deleted; cloud data is cached separately per signed-in account.

Calendar assignments, exams, classes, and semester dates are derived from existing records. Passwords are handled by Supabase Auth and are never written into Acadely's workspace data. The frontend must only contain the public Supabase publishable key (or legacy anon key); never place a service-role/secret key in website files.

## Supabase setup for accounts and cloud sync

Cloud accounts remain disabled until the project has been created, configured, and the values below are filled in. Until then, Acadely continues to work in local-storage mode.

1. Create a Supabase project and wait until its database is ready.
2. In the Supabase Dashboard, open **SQL Editor → New query**, paste and run [`supabase/schema.sql`](supabase/schema.sql). It creates private account/workspace tables, Row Level Security policies, a profile trigger, an optimistic revision-save function, and Realtime publication. It is safe to run again after updates; it adds profile email and student detail columns without replacing existing profile rows.
3. In **Authentication → URL Configuration**, set the Site URL to `https://imomov7.github.io/unitrack/` and add that same URL under Redirect URLs. Acadely uses it for email verification and password-reset links.
4. In **Authentication → Sign In / Providers**, enable Email and Password. Choose whether to require email confirmation. Configure a production SMTP provider before relying on confirmation email delivery at scale; default project email is for development and may have sending limits.
5. The project URL and public **publishable** key are connected in `js/supabase-config.js`. If you replace either value later, use only the publishable key (or legacy anon key). Never copy a `secret` or `service_role` key into this file.
6. For in-app account deletion, deploy the server-side Edge Function from the repository root with Supabase CLI: `supabase login`, `supabase link --project-ref YOUR_PROJECT_REF`, then `supabase functions deploy delete-account`. The function validates the current user's JWT and uses the Supabase service-role key only inside the hosted function to delete that user's Auth account; PostgreSQL cascades delete their profile and workspace. The key is not included in the frontend.
7. Commit and push the changed project files to the GitHub Pages branch. After Pages publishes, open the site, create a test account, verify its email if required, and test sign-in on a second device.

Confirmation links created from a local `file://` copy redirect to the published GitHub Pages URL. The sign-in screen can resend a confirmation email if the first link expired or was already used.

The database stores the existing ACADELY workspace shape (profile, settings, courses, assignments, exams, grades, timetable, study sessions, and custom events) as one JSONB document per authenticated user. Each Auth user also has one private profile row keyed by their Auth ID. New signup metadata seeds its name and email; sign-in safely fills a missing row without replacing an existing name. Profile edits update Auth metadata, the profile row, and the existing synced workspace. A compare-and-swap revision RPC refuses stale writes. Acadely keeps the local copy during outages, displays sync failure, and listens only to that user's workspace and profile rows for Realtime updates. If two devices edit at once, the newer cloud revision is not silently replaced; the local copy stays available to export before loading the cloud version.

The Edge Function uses the platform-provided `SUPABASE_SERVICE_ROLE_KEY` and `SUPABASE_ANON_KEY` environment variables. If the project uses only new-format keys and those legacy variables are unavailable, add the matching server-side values through **Edge Functions → Secrets**; never add them to `js/supabase-config.js`.

## Run locally

Open `index.html` for local-only use. Authentication requires the HTTPS Supabase project URL and network access; for testing email redirects and the PWA, use a local HTTPS/HTTP development server rather than `file://`. Export a JSON backup from Settings before moving data between browsers.

## Install Acadely as an app

The GitHub Pages site is configured as a Progressive Web App under the `/unitrack/` path. After these files are deployed, open [https://imomov7.github.io/unitrack/](https://imomov7.github.io/unitrack/) over HTTPS. On Android, use **Install Acadely** when Chrome offers it, or choose **Install app** / **Add to Home screen** in the browser menu. On iPhone or iPad, open the site in Safari, tap **Share → Add to Home Screen → Add**. The service worker caches the app shell and static assets, never private cloud records.

When the service worker changes, bump `CACHE_NAME` in `service-worker.js`. An available update waits until the student taps **Reload to update** and does not clear LocalStorage.

## Main files

- `index.html` defines the page shell and PWA/account metadata.
- `css/style.css` contains the responsive theme and account styles.
- `js/app.js` contains existing pages, local data migration, rendering, and application interactions.
- `js/account-cloud.js` wraps Supabase Auth, the private workspace RPC, and Realtime subscription.
- `js/supabase-config.js` contains public project configuration only.
- `supabase/schema.sql` defines database tables, RLS, and safe revision writes.
- `supabase/functions/delete-account/index.ts` performs privileged account deletion server-side.
- `sources/` is synced project reference material and must remain unchanged.

## Calculations and tests

Assessment grades use `sum(weight × score ÷ maximum) ÷ sum(weight)`. GPA uses `sum(course GPA points × course credits) ÷ sum(graded course credits)`. The study planner is a rule-based deadline sorter, not an AI system.

Run local suites with `node --test tests/grade-math.test.js tests/supabase-config.test.mjs tests/account-profile.test.mjs`. Supabase SQL/auth, email delivery, multi-user RLS, Edge Function deployment, realtime behavior, and cross-device tests require a configured Supabase project and must be completed before calling production authentication verified.

## University and semester planning

Choose your university and campus in **Student Profile**. Set semester dates in **Calendar**. Search and manage current courses in **My Courses**, with future plans under **Plan next semester**. Open **Grades → Academic history** for prior semesters. University/campus, semester history, plans, and degree requirements live inside the existing workspace document and use its private cloud sync and JSON export. `unitrack-data-v1` remains the local-only storage key.

Classes accept multiple weekdays. Calendar occurrences are derived from those schedules, bounded by current semester dates, and can be cancelled individually from calendar details. Legacy single-day classes are still supported. Changing a schedule does not create copies of its events.

Completed semesters store independent copies of course codes, credits, transcript grades, GPA points, and the semester's maximum GPA. Missing grades do not count as zero. Cumulative GPA is credit weighted across all recorded attempts and is withheld for mixed GPA scales. Mark successful completion according to your transcript to make prerequisites eligible. Starting a planned semester preserves the old workspace in an exportable history snapshot before replacing current courses and events. Existing history grades are never automatically rewritten.

Course recommendations use student-entered degree requirements with a source URL and explicitly checked prerequisites; uncertain courses are shown for adviser review without an automatic add button. Course availability and campus equivalency still require university confirmation. The initial sourced course catalogue is a small RIT sample; other schools use manual course entry. See `assets/data/README.md` for sources and expansion instructions.

Local verification includes pure recurrence/GPA/recommendation tests and DOM integration tests for search, course addition, editing/cancellation, history, semester transitions, JSON import validation, and persistence. Physical mobile devices and live multi-device authenticated sync require separate checks with signed-in accounts.


## Simple workspace navigation (1.4)

The main navigation is Dashboard, My Courses, Calendar, Assignments, Grades, and Student Profile. Study plan and Settings remain available in the sidebar. Class schedules and exams are inside Calendar; marks/targets, semester GPA, history, and progress are inside Grades. The former `#academics` link safely resolves to Profile. Related features keep their existing data and route compatibility.

Adding a course opens a search dialog with explicitly limited catalogue coverage, an already-added state, and manual entry. Course cards show saved name/code, credits, semester, optional professor, schedule, and current grade, with working edit/remove/schedule/mark controls. The bundled university directory is checked for nonempty data and provides manual entry when loading fails or no result matches. Campus saves in the existing private profile student_data JSON, so no schema change is required for this redesign.

Fixes include duplicate route renders that could steal input focus, disabled sign-in retry buttons, signed-in account isolation from legacy local-storage events, and preservation of unsynced account edits in account-specific caches. Dirty caches are restored on login, and differing cloud revisions require explicit conflict resolution. Completed semesters and all existing calculations are preserved.

Run all automated checks with `node --test tests/*.test.*`. Browser checks use a separate localhost fixture with disposable academic data; live production data is never modified by these tests.

## Reliability update (1.4.1)

Profile now offers searchable major suggestions with manual entry. University search uses the existing 10,254-entry community directory, with explicit coverage limits. Course search accepts code punctuation variants and multiple keywords; manual credits must be supplied by the student. Grades & GPA includes a direct GPA Calculator action and separate current-semester and completed-semester cumulative results.

Startup HTML displays loading/failure guidance instead of obsolete zero-value statistics. Directory loading has a timeout and retry fallback. Profile saves prevent duplicate submissions and stale background responses overwriting edits; account identity is checked before profile mutations. The local key `unitrack-data-v1` and existing academic schemas are unchanged. Cache v9 includes startup and major assets.

The existing own-account deletion Edge Function was deployed to Supabase on 2026-11-14, with gateway JWT verification retained. OPTIONS and unauthenticated rejection are checked; actual destructive deletion and authenticated cross-device flows require a disposable signed-in test account.

## Academic automation and Arabic (1.5.0)

- Student Profile reuses saved university/major and offers general or selected-university degree suggestions. All fields remain editable.
- My Courses searches the selected institution's sourced subjects and fills factual codes, names and source credit units. Manual entry and duplicate protection remain available. See `assets/data/README.md` for exact coverage and refresh commands.
- Calendar → Edit semester offers Fall, Spring, Summer, or Other / Custom and the term's start year. Existing custom names and dates are preserved. Verified RIT Rochester suggestions require review. Switching a named term uses an in-page confirmation and preserves the entire prior workspace snapshot in Academic history before opening a separate term. Starting a planned term keeps its own planned courses; switching directly opens an empty term.
- Settings → Language switches between English (default) and Arabic. Arabic sets `lang=ar`, `dir=rtl`, and localizes the interface, dates, controls and messages. `locales/ar.js` is the editable translation catalogue; `js/i18n.js` translates text nodes and accessible labels without rebuilding controls or mutating stored academic values. Official names, codes and user-entered content remain unchanged. Language is a device preference in `acadely-language-v1`, independent of the preserved `unitrack-data-v1` workspace key.
- Static shell cache v10 includes the language and automation assets. No schema or authentication changes are required.

Validation includes all automated tests, the existing form integration harness, English/Arabic rendering and a local disposable-data browser preview at 375×812, 390×844, and 430×932. Real iPhone/Android and authenticated multi-device flows still require physical-device and disposable-account verification.

## Vercel production hosting

The same static app supports `https://myacadely.vercel.app/` at the domain root and the existing GitHub Pages `/unitrack/` path. Import `imomov7/unitrack`, select Other, root `./`, no build/install command, and name the project `myacadely`. Manifest and service-worker URLs remain relative. Auth callbacks use an explicit list of production origins; unrecognized origins use the Vercel production root.

Supabase Authentication → URL Configuration must include `https://myacadely.vercel.app/` in allowed redirect URLs, retaining the GitHub Pages URL for existing links. The account-deletion Edge Function allows the exact Vercel origin in addition to the existing origins; redeploy the function when updating this file. Existing browser-local data belongs to its original origin: export/import JSON to move local-only records between domains. Signed-in cloud data continues to use the same Supabase project.

## Startup, Russian and top navigation (1.5.1)

The workspace is hidden in initial HTML, with a critical inline hidden rule before external CSS, until local startup or the authenticated session is ready. A separate loading/error fallback remains visible if app assets fail. This prevents the full workspace from flashing before the sign-in screen. The saved theme and supported language direction are applied before paint. No session or student data is stored in the startup markup.

Settings → Language now offers English, Arabic and Russian. `locales/ru.js` covers the existing interface catalogue, including messages and forms; dynamic statuses and date formatting follow the selected language. Russian and English use LTR; Arabic uses RTL. Official names, codes and student-entered values remain unchanged. The `acadely-language-v1` preference and `unitrack-data-v1` data key are preserved.

The top Dashboard breadcrumb is an internal `#dashboard` link. It returns to the dashboard without reloading, clearing the session or leaving the app. Cache v12 includes Russian translations. Validation includes automated regressions, a DOM integration check with delayed authentication, the existing forms/data integration checks, and mobile browser language/navigation checks.

Static assets now use network-first loading with the installed static cache as an offline fallback, preventing stale app code from being combined with new HTML. An inline startup compatibility guard also supports visitors whose previous worker is still active during the update.

A relative URL bug in static cache writes was corrected, and cache-write failures no longer discard fresh network responses. The existing update notice is available on the sign-in screen too, so installed clients can apply a waiting worker without first signing in.

## Global language options (1.5.2)

English, العربية and Русский buttons are available in a compact top bar on every page, including sign-in, registration, password recovery and loading screens. They reuse the same language preference as Settings, update the current interface in place, and keep entered form values. The active button and Settings selector stay synchronized. The existing data and auth session are unchanged. Cache v13 includes this UI update.

## Compact language menu (1.5.3)

The separate language toolbar has been removed. A translation icon beside the existing theme control opens English / العربية / Русский. Account screens place the same compact controls beside the logo. Selection persists and shares the Settings preference; outside click and Escape dismiss the menu, with keyboard focus and arrow-key support. No extra page/header layer or toolbar spacing is retained.

### 1.5.4 — targeted data and presentation fixes
- Existing 10,253-university bundled directory retained; search additionally matches derived abbreviations/domain labels and deduplicates suggestions. Directory failure retains manual entry. Source and license remain in `assets/data/README.md`.
- Three RIT titles and the refresh importer corrected against the official curriculum. No other catalogue records changed.
- About retains creator/contact content, with “Acadely contact — not configured yet” until a dedicated public business email is set in `ACADELY_CONTACT_EMAIL` in `js/app.js`. No personal email is bundled as public contact. Signed-in account emails remain private account information.
- Semester / known RIT spelling correction and short course-label capitalization are presentation-only helpers. Saved values, editable inputs, university matching, history, GPA and sync continue using original data. Short one-character course names carry a review hint; their real identity is not guessed.
- Static cache version 15 and asset revision updated to deliver the fixes. No storage migration, data reset or database changes.

### 1.5.5 — verification and planner reliability
A full verification pass found repeatable study suggestions and past-dated overdue sessions. Suggestions now subtract saved/completed workload, respect each date’s booked hours, schedule overdue work today, and are rechecked when clicked. Existing records and calculations are preserved. See `AUDIT-2026-11-15.md` for the checked flows and explicit testing limits. Automated suite: 65 passing tests.

### 1.5.6 — readable calendar event cards
Calendar entries remain colored, labeled boxes in month, week, day and selected-date agendas, including on phones. Class cards are green and show the current course name/code, time range and room. Exams, assignments and personal events show their own type, title and available details. No event entries are reduced to dots, hidden titles or a three-event cutoff. The month grid scrolls inside its panel on smaller screens, with a visible hint; week/day views provide wider lists. Existing records are unchanged. Optional exam times/location and personal-event location reuse the existing save/sync/JSON flow. Missing metadata is labeled rather than invented. English, Arabic and Russian labels are included. Automated suite: 68 passing tests; browser checks at 375, 390 and 430 CSS pixels confirm visible titles, contained scrolling and working detail dialogs. Static cache: version 17.

### 1.6.0 — Attendance and academic notifications
Attendance adds per-course targets, transparent percentages, pending confirmations, editable/manual records, history filters and archived snapshots. The bell and Settings add an inbox, category/interval/timezone/quiet-hour controls and explicitly gated Web Push enrollment. Existing academic data, account behavior, grade/GPA math and LocalStorage keys are preserved. The additive notification schema and two authenticated server functions are deployed; private push credentials and the one-minute Cron scheduler are configured. Students still opt in per device and should verify a test notification. See `docs/ATTENDANCE-NOTIFICATIONS.md` for the architecture, applied migration, files, activation checklist, security and device testing. Static cache advances to version 18.

### 1.6.1 — device notification setup repair
The master reminder switch now saves immediately. Enable Push also validates and saves the currently checked preference form before requesting browser permission in the original tap. Send Test remains actionable before enrollment and confirms the server subscription before every real server test, including cached devices. Progress/error messages, bounded worker/network waits, one-minute delivery guidance and duplicate-tap protection replace silent/disabled dead ends. No academic records, server credentials, grade calculations or LocalStorage keys change. Automated enrollment tests use mocked browser permission and subscriptions; real phone delivery still requires device permission and confirmation. Static cache advances to version 19.
