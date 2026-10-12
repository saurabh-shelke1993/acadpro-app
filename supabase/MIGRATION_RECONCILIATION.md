# Supabase Migration Reconciliation — Phase 7.4

## Scope and safety rule

Compared the live Supabase migration ledger with the migration files in
`supabase/migrations/` on branch `payment-module-finalization`.

- Live migration ledger: 64 entries.
- Repository SQL files: 24.
- The comparison is based on version prefixes and migration names, then checked
  against selected live function definitions, grants, table constraints, and
  current data invariants.
- **Do not replay missing migrations or delete/insert rows in
  `supabase_migrations.schema_migrations` merely to align counts.** Some
  migrations contain data mutations or one-off cleanup.

## Findings and classification

| Area | Live ledger | Repository state | Classification | Action |
|---|---|---|---|---|
| Baseline schema | `20260823093317_remote_schema` | Matching `20260823093317_remote_schema.sql` | Exact version/name match | Keep as baseline snapshot; not a substitute for the full historical chain |
| Early RBAC/security (Sep 3–15) | 13 entries covering assignment isolation, parent read isolation, subscription/payment security, parent linking, attendance, performance assessment security | No one-file-per-migration equivalents | **Remote-applied, historical source files missing** | Do not reconstruct from names alone; recover original SQL from repository history/backups if available |
| Bulk player import (Sep 19) | Five entries: bulk import transaction, player ID fix, phone normalization, anonymous revoke, execute restriction | `20260919130000_player_bulk_import_transaction.sql` | **Divergent/merged history; not proven equivalent** | Compare the deployed function and grants to this file; retain the remote ledger |
| Player/batch invariant (Sep 20) | Transactional writes, invariant enforcement, active-player scope, mapping reconciliation, Pratik mapping repair, single mapping, execute restrictions, constraint timing, RPC-safe variants, regression trigger/cleanup, duplicate-parent cleanup, execute restriction | Several matching early files plus local `20260920050000_fix_player_batch_constraint_timing.sql` and `20260920051000_make_player_batch_invariant_rpc_safe.sql` with different version prefixes | **Partial overlap and version/name drift** | Verify current constraints, trigger definitions, RPC bodies/grants and data state before deciding whether any source file needs restoring |
| Multiple active coaches (Sep 25) | `20260925063432` | Local file uses the same version prefix; remote name includes the local timestamp in its name | **Version match; name differs** | No replay needed |
| Payment foundation and corrections (Sep 26) | Remote entries for financial foundation, receipt backfill, generated due updates, coach payment helper grant, overpayment formatting, admin-only payment operations, legacy overpayment reconciliation | Local files exist for the same themes but several use later timestamps; local `20260926133000` files split or combine concerns that appear as separate remote migrations | **Divergent/merged history; not byte-equivalent by filename** | Keep remote history. Compare live RPCs, trigger, indexes, grants, receipts, and the four reconciled dues against intended state. Never replay receipt backfill or reconciliation blindly |
| Academy logo and coach profile/storage (Sep 30–Oct 8) | Four remote entries | No corresponding standalone local SQL files in current tree | **Remote-applied, historical source files missing** | Recover original SQL if possible; verify live policies/storage configuration separately |
| Schedule foundation (Oct 10) | Eleven schedule/attendance schema and trigger migrations | Current repository has no matching individual SQL files for these entries | **Remote-applied, historical source files missing** | Live schedule tables, triggers, constraints, RLS and function definitions are the current runtime reference; recover original SQL rather than regenerate speculative history |
| Schedule attendance fixes (Oct 11) | `20261011083110`, `20261011083351` | Local files `20261011090000_allow_batch_enrolled_players_in_coach_attendance.sql` and `20261011093000_allow_coach_retroactive_attendance_and_block_future_dates.sql` | **Same functional area, timestamp drift**; current live helper definitions match the reviewed behavior | Preserve both local files and remote ledger; do not replay |
| Phase 7 hardening (Oct 11) | `20261011105104` | Matching `20261011105104_phase_7_harden_rpc_grants_and_schedule_search_paths.sql` | **Exact version/name match** | Already applied; verified grants and search-path settings |

## P1.2 Academy UPI Settings (12 October 2026)

The following new migrations are aligned between the repository and live ledger:

| Feature | Live version/name | Repository file | Status |
|---|---|---|---|
| Academy UPI settings foundation | `20261012013143` / `academy_upi_settings_foundation` | `20261012013143_academy_upi_settings_foundation.sql` | Applied and recorded |
| Academy UPI policy tuning | `20261012013320` / `academy_upi_settings_policy_tuning` | `20261012013320_academy_upi_settings_policy_tuning.sql` | Applied and recorded |
| Academy UPI redundant-index cleanup | `20261012013452` / `academy_upi_settings_remove_redundant_index` | `20261012013452_academy_upi_settings_remove_redundant_index.sql` | Applied and recorded |

These are new migrations only. Existing historical drift was not modified, replayed or reconciled as part of P1.2.

## P1.4 Parent UPI Submission and Review (12 October 2026)

| Feature | Live version/name | Repository file | Status |
|---|---|---|---|
| Parent UPI submission/review foundation | `20261012023354_parent_upi_payment_submissions` | `20261012023354_parent_upi_payment_submissions.sql` | Applied; live ledger version aligned; grants and RLS verified |
| Active-claim and review-time invariants | `20261012023526_parent_upi_submission_invariants` | `20261012023526_parent_upi_submission_invariants.sql` | Applied; live ledger version aligned; active-claim index and review function verified |

These are additive migrations. They do not write to `public.payments` or mutate `public.payment_dues`. Historical migration drift remains untouched.

## Current-state checks already performed

- Seven academy consistency checks returned zero mismatches for player/batch,
  player-batch mappings, coach assignments, schedules, schedule enrollments,
  and active attendance.
- Six simulated authenticated roles returned zero foreign-academy rows for
  players, batches, attendance, payment dues, and payments.
- Cross-academy owner collection and coach/parent payment collection attempts
  were rejected; the test due remained pending and payment count was unchanged.
- Phase 7 hardening migration is recorded in the live ledger and its resulting
  grants/function settings were verified.

These checks validate selected current behavior. They do not prove that all
historical migrations are present in source control or that every historical
SQL statement is reproduced exactly.

## Reconciliation decision

**Do not change the remote migration ledger to match repository filenames.**
Do not rename historical files to remote version numbers until their SQL
contents are proven equivalent. Do not recreate missing migrations from names
or current schema alone.

Recommended source-of-truth recovery order:

1. Search all repository branches, tags, commits and deployment artifacts for
   the missing historical SQL.
2. For each candidate, compare the original SQL with the deployed function
   definitions, policies, constraints, indexes, triggers and grants.
3. Recover exact originals when available; otherwise add a clearly named
   *state reconciliation* migration only when a specific live-state defect is
   proven. A reconciliation migration should be idempotent where feasible and
   must not replay one-off data cleanup.
4. Keep the current remote migration ledger unchanged throughout this process.
5. Once source recovery is complete, run the app tests/build and deployment
   regression as Phase 7.5–7.6.

## Status

Phase 7.4 audit is documented. Historical migration source reconciliation is
**not fully resolved** because the current repository does not contain the
original SQL for many remote-applied migrations. No migration was replayed,
no migration-ledger rows were edited, and no business data was changed as part
of this reconciliation audit.


## P1.5 parent UPI claim ledger recording (12 October 2026)

- Live ledger entry: `20261012025707 / parent_upi_claim_ledger_recording`.
- Repository migration: `supabase/migrations/20261012025707_parent_upi_claim_ledger_recording.sql`.
- Applied to the active `acadpro-db` project after the P1.5 source was committed.
- Verified live: `payment_id`, `recorded_by_user_id`, and `recorded_at` columns exist; the unique payment-link index exists; `record_accepted_parent_upi_submission(uuid)` exists as SECURITY DEFINER with an empty search path, denies anon execution, and grants authenticated execution.
- The wrapper calls the existing secured `collect_payment` RPC; no live test payment was created as part of migration verification.
- Browser acceptance remains pending. Do not replay this migration or create test ledger entries against real financial records merely to prove idempotency; use controlled test claims and inspect the resulting ledger state.


## P1.6 expense occurrence recording (12 October 2026)

- Live ledger entry: `20261012031132 / expense_occurrence_recording`.
- Repository migration: `supabase/migrations/20261012031132_expense_occurrence_recording.sql`.
- Applied to the active `acadpro-db` project.
- Verified live: `record_expense_occurrence(...)` exists as SECURITY DEFINER with an empty search path; anon execution is denied and authenticated execution is granted. The `expenses_insert_owner` policy requires `reminder_id IS NULL`, and the `expenses_prevent_reminder_relink` trigger is present.
- No expense transaction was inserted as part of migration verification. Browser acceptance must test the RPC with a controlled test reminder and confirm the expense insert and next due date update succeed or roll back together.
