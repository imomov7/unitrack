# Cloud sync recovery — 1.7.1

The reported failure was reproduced: Supabase's API logs showed repeated HTTP 504 responses for reads of `student_workspaces`. A read-only API request also timed out. Database inspection found three small workspaces and the expected per-user RLS policies. A separate Desktop JSON backup of the affected device's pending workspace was exported before any repair. It is outside the project and must never be published.

The existing Supabase project was restarted to recover stalled backend services. This does not rotate credentials, alter account access or rewrite records. Backend recovery must be verified separately; frontend retries do not make an unhealthy service healthy.

Previously, failed initial cloud loading could leave the application using its private local cache until the user clicked Retry or the browser fired an online event. A server outage can occur while the browser stays online, so that event might never fire.

The application now uses at most three spaced recovery attempts, reads the latest cloud revision first, and saves only when the expected revision still matches. Pending local edits remain on this device when a newer cloud revision exists. An unchanged cache may catch up without creating a false conflict. Duplicate Retry clicks and overlapping writes are guarded. A response for a signed-out account is ignored. LocalStorage key `unitrack-data-v1`, the per-account cache format and existing conflict/export controls are preserved.

Validation: 111 automated tests pass, including seven new recovery tests for timeouts/backoff, confirmed recovery writes, revision conflicts, unchanged-cache catch-up, duplicate requests, account switching and edits during a read. Provider-side recovery still requires an actual successful live retry; no saved record is silently replaced to dismiss the banner.

Changed files: `js/app.js`, `index.html`, `service-worker.js`, `tests/cloud-recovery.test.cjs`, `README.md`, and this guide. Static cache version: 22.
