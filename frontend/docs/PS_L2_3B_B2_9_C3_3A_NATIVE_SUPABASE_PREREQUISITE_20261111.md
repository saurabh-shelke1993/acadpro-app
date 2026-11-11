# Kheltriva — B2.9-C3.3A Real Local Supabase Prerequisite Fixture

**11 November 2026 · Source branch payment-module-finalization · NONHISTORICAL · SCRATCH ONLY**

## Confirmed owner environment

Owner's isolated scratch folder `kheltriva-b29-disposable` started local Supabase CLI 3.0.0 with optional services excluded for Windows memory limits. Actual local PostgreSQL and Auth checks returned `postgres|t|t`, Auth HTTP 200, and then **six true flags**: native `auth.uid()`, `authenticated` role, no existing `public.users`, `batches`, `coaches` or `private` schema. These were owner-reported **read-only local checks**; the model did not execute them.

## C3.3A synthetic table fixture

`supabase/tests/subscriptions/ps_l2_3_b2_9_c3_native_schema.sql` is strictly separate from the older PostgreSQL 17 preconditions that redefine `auth.uid()` and database roles. It requires native Supabase `auth.users`, `auth.uid()`, and roles, verifies **zero** users and no application tables, and executes within a transaction. It creates exactly five simplified public tables needed by the 11 B2.9 helpers, inserts **two synthetic batch records**, enables RLS on all five, and explicitly revokes ordinary client table access. **No Auth users, real academy/player/financial records, canonical migrations, helper functions, or billing objects are modified.**

The SQL fixture is not authentic historical schema, nor a full-production-schema replacement. Do not execute it on any remote/linked database, through Supabase Dashboard, or on another local project. Only target `supabase_db_kheltriva-b29-disposable` via Docker's `exec`.

## Execution and verification boundaries

1. Confirm the local database container is healthy, the scratch folder is active, and no original SQL migrations were copied.
2. Run the C3.3A fixture **once only**. Its SQL guards will reject a reused/nonempty database.
3. Verify five RLS-enabled synthetic public tables, two batches, zero public users/coaches, and native Auth table unchanged. Stop for review.
4. **C3.3B later:** Separately apply the 11 B2.9 live helper snapshot only after table results are accepted. Do not run old `ps_l2_3_b2_9_synthetic_preconditions.sql`, as it attempts to re-create native roles/`auth.uid()`.
5. **C3.4 later:** Create synthetic local Auth accounts through GoTrue/Auth API; only then link their generated auth.users UUIDs to synthetic Kheltriva app users and coaches, and test actual JWT-backed access. No artificial JWT-sub manipulation counts as real Auth testing.
6. Full historical migration replay, Storage, 35 B3.6 runtime scenarios, finance/B4 integration and production remain **blocked**.

**Validation:** Offline static guard and original isolated PostgreSQL synthetic tests run on GitHub Actions. Their results do not imply the new native Supabase fixture has been executed. Record actual local output as a separate Owner-run checkpoint.
