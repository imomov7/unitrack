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
- Existing local data is kept in `unitrack-data-v1`. When a student first signs in, Acadely previews record counts and asks whether to merge the browser data. The original key is not deleted; cloud data is cached separately per signed-in account.

Calendar assignments, exams, classes, and semester dates are derived from existing records. Passwords are handled by Supabase Auth and are never written into Acadely's workspace data. The frontend must only contain the public Supabase publishable key (or legacy anon key); never place a service-role/secret key in website files.

## Supabase setup for accounts and cloud sync

Cloud accounts remain disabled until the project has been created, configured, and the values below are filled in. Until then, Acadely continues to work in local-storage mode.

1. Create a Supabase project and wait until its database is ready.
2. In the Supabase Dashboard, open **SQL Editor → New query**, paste and run [`supabase/schema.sql`](supabase/schema.sql). It creates private account/workspace tables, Row Level Security policies, a profile trigger, an optimistic revision-save function, and the workspace Realtime publication.
3. In **Authentication → URL Configuration**, set the Site URL to `https://imomov7.github.io/unitrack/` and add that same URL under Redirect URLs. Acadely uses it for email verification and password-reset links.
4. In **Authentication → Sign In / Providers**, enable Email and Password. Choose whether to require email confirmation. Configure a production SMTP provider before relying on confirmation email delivery at scale; default project email is for development and may have sending limits.
5. In **Project Settings → API Keys**, copy the project URL and the **publishable** key (or legacy anon key). Put them in `js/supabase-config.js` as the `acadelySupabaseUrl` and `acadelySupabasePublishableKey` values. Never copy a `secret` or `service_role` key into this file.
6. For in-app account deletion, deploy the server-side Edge Function from the repository root with Supabase CLI: `supabase login`, `supabase link --project-ref YOUR_PROJECT_REF`, then `supabase functions deploy delete-account`. The function validates the current user's JWT and uses the Supabase service-role key only inside the hosted function to delete that user's Auth account; PostgreSQL cascades delete their profile and workspace. The key is not included in the frontend.
7. Commit and push the changed project files to the GitHub Pages branch. After Pages publishes, open the site, create a test account, verify its email if required, and test sign-in on a second device.

The database stores the existing ACADELY workspace shape (profile, settings, courses, assignments, exams, grades, timetable, study sessions, and custom events) as one JSONB document per authenticated user. A compare-and-swap revision RPC refuses stale writes. Acadely keeps the local copy during outages, displays sync failure, and listens only to that user's workspace row for Realtime updates. If two devices edit at once, the newer cloud revision is not silently replaced; the local copy stays available to export before loading the cloud version.

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

Run the existing calculation suite with `node --test tests/grade-math.test.js`. Supabase SQL/auth, email delivery, multi-user RLS, Edge Function deployment, realtime behavior, and cross-device tests require a configured Supabase project and must be completed before calling production authentication verified.
