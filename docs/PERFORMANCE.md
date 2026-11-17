# Supabase request and write optimization — 1.8.0

This release reduces avoidable backend work without changing the interface, academic calculations, account permissions or storage format. It does not establish a production CPU reduction.

## Changes

- Initialize one Supabase client and Auth listener. Share concurrent profile/workspace reads per authenticated owner.
- Cache profiles for 60 seconds with invalidation on identity changes, saves, account changes and profile Realtime updates. Workspace reads remain fresh.
- Ignore redundant same-account sign-in/token events after initialization. Use complete authenticated workspace Realtime payloads without an extra SELECT; retain revision/conflict protection.
- Close Realtime subscriptions after 60 seconds hidden; reconnect and catch up once on return. Clean up on page exit.
- Skip hidden-page notice polling and limit repeated notification-history refreshes.
- Avoid unchanged push subscription writes and batch delivery receipt reads once per job rather than per device.
- Skip unchanged pending/retry reminder job UPDATEs. Changed deadlines/payloads still update; terminal jobs remain terminal.

## Database deployment

Apply `supabase/migrations/202611160001_reminder_noop_updates.sql` once through SQL Editor or your normal migration workflow. It replaces only the body of the existing scheduling function, retaining its signature and permissions. It changes no tables, RLS policies, grants or student records. Deploy the two changed academic Edge Functions using the existing authentication settings and secrets. Do not disable authentication or expose service keys.

## Controlled measurements

These are instrumented tests of the actual application code and isolated PostgreSQL, not production CPU measurements.

| Scenario | Before | After |
| --- | ---: | ---: |
| Three concurrent profile consumers: database reads | 3 | 1 |
| Ten redundant same-account SIGNED_IN events: profile refreshes | 10 | 0 |
| Complete workspace Realtime event: additional SELECTs | 1 | 0 |
| 120 unchanged scheduling calls: actual row UPDATEs | 120 | 0 |

## Validation and limits

117 Node tests and three Deno security tests passed. Additional isolated DOM/PostgreSQL checks covered course CRUD, grade/GPA calculations, history, import/export, attendance, signup profile creation, two-device revision saves, stale-write rejection, account isolation and disposable account cascade deletion. No production account was deleted. Production Auth and cross-device writes could not be verified while the project Data API was unhealthy.

## Verify production performance

After Supabase services are healthy, compare Database CPU over equal 15–30 minute windows with comparable active users and workload. Record elapsed-time-normalized query calls and execution times from pg_stat_statements; cumulative historical totals alone cannot diagnose current load. In browser Network tools, verify repeated navigation does not reload the workspace, concurrent profile consumers share a read, and a hidden tab disconnects Realtime after one minute. Check edits on two devices using a disposable account; verify conflict handling and profile updates. Preserve RLS and never reset student data to benchmark performance.

If CPU remains high with low application query rates, inspect active queries, waits, connections and platform service health, then contact Supabase support with private diagnostics. Do not publish JWT headers, user records or service credentials.
