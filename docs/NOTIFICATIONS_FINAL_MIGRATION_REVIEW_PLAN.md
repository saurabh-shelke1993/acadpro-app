# Notifications Infrastructure — Final Migration Review Plan

**Status:** SQL review proposal authored; not yet approved or executable. No SQL has been applied. Do not merge or apply a migration until the migration workflow is resolved, the proposal is tested against a disposable matching database, and the user explicitly approves the final SQL.

## Confirmed environment

- Supabase project: `acadpro-db` (`ulyealhkmlorsbdiknrh`).
- Live migration history currently ends at `20261021052601` (`private_player_photo_storage`).
- Repository root contains `backend/`, `frontend/`, and `docs/`; no checked-in `supabase/migrations/` directory or complete local migration history was found in the inspected root listing.
- `frontend/package.json` contains only React build/start/test scripts; `backend/package.json` contains only a Node server start script and a placeholder failing test script. No Supabase CLI migration script was found in these package manifests.
- Notification artifacts are intentionally under `docs/`, not in an executable migration directory.
- Existing payment and enquiry RPCs have authorization checks and transactional boundaries. Their definitions are not replaced by the review proposal.
- A read-only query returned no rows for the current `supabase_realtime` publication table listing. This needs a more targeted permissions/publication check before any Realtime publication change.
- `pg_cron` was available in the extension catalog but not installed at the last confirmed check; `cron.job` was absent.
- No notification/announcement schema, RLS, Realtime publication, or retention job was created by this review.

## Migration workflow decision

Do not treat the current database migration history as reproducible from the repository. Before adopting a canonical migration folder, reconcile a schema baseline or confirm the team's intended Supabase CLI workflow. A timestamped file in `supabase/migrations/` alone is not sufficient if earlier migrations are missing from the repository: a fresh database could not reconstruct the live schema.

For this review branch, keep proposal artifacts in `docs/` and do not make them automatically executable.

## Conservative first-release product defaults

1. In-app notifications only; Realtime enabled after RLS/publication review.
2. Retention period: 12 months. Scheduler choice is still pending; do not install or configure a scheduler implicitly.
3. Announcement authoring/publishing is Academy Owner only, scoped to their own academy.
4. Audience `all_academy` includes eligible Coaches and Parents; `coaches` includes active Coaches only; `parents` includes eligible Parents only. The publishing owner is excluded from self-notifications.
5. Super Admin is excluded from academy inboxes and announcement audiences by default.
6. Parent audience membership must be resolved through an active parent profile and verified linked-child academy relationship. Do not rely solely on `private.current_academy_id()` for parent scope.
7. Coach audience membership uses the coach profile's academy and active status. Do not infer schedule-level audience from batch-level assignments.
8. Do not send a notification to the actor for their own action by default.
9. Payment claim submission is not a recorded payment. A payment-recorded event is emitted only after the authoritative ledger transaction succeeds.
10. Do not notify on generic inquiry edits; trial-scheduled notifications require a defined state transition and idempotency rule.
11. Defer schedule-change fan-out until old/new affected coach assignments and linked player schedule enrollments are safely calculated.
12. Editing a published announcement does not fan out duplicate notifications; publish is an explicit controlled lifecycle action.

## Proposal artifact

- [Final migration review SQL proposal](./NOTIFICATIONS_FINAL_MIGRATION_REVIEW.sql) — schema, RLS, mark-read RPCs, owner announcement publish/archive RPCs, idempotent notification insertion, triggers for verified UPI submission/review/recorded transitions and enquiry creation, and a 12-month cleanup routine without scheduling.
- [Original migration sketch](./NOTIFICATIONS_MIGRATION_DRAFT.sql) — retained for comparison; do not apply.
- [SQL/RLS review notes](./NOTIFICATIONS_SQL_RLS_REVIEW_DRAFT.md) — read-only schema, helper, policy and event-boundary findings.

The proposal has been authored but has **not** been parsed or executed against a disposable database. It is not certified safe to apply. The Realtime publication is intentionally not altered, and the cleanup routine is not scheduled.

## Required review fixes/checks before approval

1. Reconcile the repository's migration-history/baseline strategy.
2. Validate the proposal against the current live table definitions, foreign keys, grants, helper signatures and trigger definitions.
3. Test the exact proposal in a disposable database/branch with matching schema; do not create a billable Supabase branch without cost approval.
4. Review direct table privileges and default privileges. Confirm only intended roles can execute the notification helpers/RPCs.
5. Verify owner announcement lifecycle, draft editing, publish/archive, audience feed RLS, multi-child parent scope, inactive coach/parent behavior, and cross-academy denial.
6. Verify trigger syntax and trigger behavior for UPI status transitions; ensure a recorded-payment notification cannot duplicate through `collect_payment` and its wrapper.
7. Test idempotency, transaction rollback, recipient-only reads, mark-read isolation, and role isolation.
8. Re-query Realtime publication metadata with a targeted check and decide the approved publication change.
9. Choose and verify the 12-month retention scheduler before scheduling the cleanup routine.

## Explicitly out of scope

- Email, WhatsApp, SMS, push delivery, and scheduled reminders.
- Automatic Super Admin copies of academy notifications.
- Schedule-change and trial-scheduled fan-out until recipient resolution and transition rules are verified.
- Changes to existing helper functions or unrelated grants.
- Replacing payment/enquiry RPCs with partial or reconstructed definitions.
- Applying this SQL to live Supabase before explicit user approval.

## Final checkpoint

Before application:
1. Resolve the migration workflow and required review fixes above.
2. Present the exact revised SQL and real test results to the user.
3. Wait for explicit approval to apply it to the target Supabase project.
