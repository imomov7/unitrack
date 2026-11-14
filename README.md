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
