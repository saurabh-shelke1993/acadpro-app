# Notifications Infrastructure — Final Migration Review Plan

**Status:** Review preparation only. No SQL in this document is applied. Do not merge or apply a migration until the final SQL has been reviewed and explicitly approved.

## Confirmed environment

- Supabase project: `acadpro-db` (`ulyealhkmlorsbdiknrh`).
- Live migration history currently ends at `20261021052601` (`private_player_photo_storage`).
- Repository root contains `backend/`, `frontend/`, and `docs/`; no checked-in `supabase/migrations/` directory or complete local migration history was found in the inspected root listing.
- Existing SQL draft is under `docs/NOTIFICATIONS_MIGRATION_DRAFT.sql`, intentionally not in an executable migration directory.
- Existing payment and enquiry RPCs have authorization checks and transactional boundaries. Their complete definitions must be preserved if adding in-function fan-out.
- `pg_cron` is available in the extension catalog but was not installed at the last check; `cron.job` was absent.
- No notification/announcement schema, RLS, Realtime publication, or retention job was created by this review.

## Migration workflow decision

Do not treat the current database migration history as reproducible from the repository. Before adopting a canonical migration folder, reconcile a schema baseline or confirm the team's intended Supabase CLI workflow. A timestamped file in `supabase/migrations/` alone is not sufficient if earlier migrations are missing from the repository: a fresh database could not reconstruct the live schema.

The first notifications migration should be created only after the repository's migration-source strategy is agreed. For this review branch, keep all artifacts in `docs/` and do not make them automatically executable.

## Conservative first-release product defaults

1. In-app notifications only; Realtime enabled after RLS/publication review.
2. Retention period: 12 months. Scheduler choice is still pending; do not install or configure a scheduler implicitly.
3. Announcement authoring/publishing is Academy Owner only, scoped to their own academy.
4. Audience `all_academy` includes the Academy Owner, active Coaches, and eligible Parents; `coaches` includes active Coaches only; `parents` includes eligible Parents only.
5. Super Admin is excluded from academy inboxes and announcement audiences by default.
6. Parent audience membership must be resolved through an active parent profile and verified academy/linked-child relationship. Do not rely solely on `private.current_academy_id()` for parent scope.
7. Coach audience membership must use the coach profile's academy and active status. Do not infer schedule-level audience from batch-level assignments.
8. Do not send a notification to the actor for their own action by default.
9. Payment claim submission is not a recorded payment. A payment-recorded event is emitted only after the authoritative ledger transaction succeeds.
10. Do not notify on generic inquiry edits; trial-scheduled notifications require a defined state transition and idempotency rule.
11. Defer schedule-change fan-out until old/new affected coach assignments and linked player schedule enrollments are safely calculated.
12. Editing a published announcement does not fan out duplicate notifications; publish is an explicit controlled lifecycle action.

## Required SQL contents before final review

- `public.notifications`: recipient ownership, academy scope, event metadata, priority, deduplication key, timestamps/read state, indexes and 12-month cleanup compatibility.
- `public.announcements`: academy, author, audience, lifecycle status, publication timestamps, and updated timestamp management.
- RLS enabled on both tables; no client insert/delete for notifications; announcement owner management scoped to their academy; published audience feed scoped per role and academy.
- Narrow `SECURITY DEFINER` RPCs with `SET search_path = ''`, qualified references, explicit auth checks, and minimum execute grants.
- Controlled announcement publish RPC which validates owner scope and audience and fans out one idempotent notification per eligible recipient.
- Event fan-out at verified success boundaries for: UPI claim submitted, claim accepted/rejected, payment recorded, inquiry created. Avoid duplicating payment notifications across wrapper and lower-level `collect_payment`.
- Idempotency keys unique per recipient and authoritative event.
- Realtime publication membership, checked against current publication metadata before alteration.
- Retention function and scheduler only after a supported scheduling mechanism is selected and verified.
- Regression SQL/tests covering role isolation, cross-academy access, parent linked-child scope, owner mutation restrictions, duplicate delivery, mark-read isolation, announcement lifecycle, and rollback behavior.

## Explicitly out of scope for this migration

- Email, WhatsApp, SMS, push delivery, and scheduled reminders.
- Automatic Super Admin copies of academy notifications.
- Schedule-change fan-out until affected-recipient resolution is proven.
- Changes to existing helper functions or unrelated grants.
- Replacing payment/enquiry RPCs with partial or reconstructed definitions.

## Final checkpoint

Before application:
1. Inspect and validate the full SQL against live schema and function signatures.
2. Run it against a disposable Supabase branch/database if available; do not create a billable branch without cost approval.
3. Confirm no changes to existing financial invariants, RLS, or RPC grants beyond the reviewed additions.
4. Present the exact SQL and test results to the user.
5. Wait for explicit approval to apply it to the target Supabase project.
