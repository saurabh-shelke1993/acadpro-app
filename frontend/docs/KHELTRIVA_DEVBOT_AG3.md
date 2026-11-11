# Kheltriva DevBot AG3.1 — Real JWT-based cross-academy RLS

**11 November 2026 — IMPLEMENTED IN ISOLATED REVIEW BRANCH / CI RUN PENDING**

## Verified prerequisite

AG2 PR #4 merged into payment-module-finalization at `97b7d267`. Post-merge real native GoTrue job and AG1 static CI completed successfully. AG2 CI validates authentication and foreign-key role mappings, not actual RLS tenant isolation.

## AG3.1 single controlled objective

Demonstrate that **real native GoTrue-issued JWTs**, passed through the local Kong/PostgREST Data API, enforce a **test-only read policy** on two synthetic academy batches. The workflow starts from the already validated AG2 scratch Supabase CLI v3.0.0 bootstrap, with a fresh unlinked GitHub runner. It restores only the pinned synthetic five-table schema, unchanged 11-function helper snapshot and actual GoTrue-created Auth accounts for an unmapped user plus Academy Owners A and B.

The new SQL fixture `ps_l2_3_b2_9_ag3_owner_rls.sql` lives under tests, NOT canonical migrations. Its preflight verifies three real Auth users and correct two owner mappings, zero existing synthetic policies, five RLS-enabled tables and no ordinary client read privilege. It then grants **SELECT only on synthetic public.batches to authenticated** and installs exactly one policy: Owner role from `private.is_academy_owner()` AND batch academy equals `private.current_academy_id()`. Postflight verifies one policy, denied anon SELECT and no INSERT/UPDATE/DELETE permission. After notifying PostgREST to reload its schema, the real JWT tests run:

1. Owner A reads precisely Academy A's batch; explicit query for Academy B returns zero.
2. Owner B reads precisely Academy B's batch; explicit query for Academy A returns zero.
3. An actual signed-in but **unmapped** GoTrue user gets an empty list.
4. Anonymous Data API query is denied.
5. A tampered Auth-issued JWT is rejected by the actual REST API.
6. Owner A cannot PATCH an Academy B batch; Owner B cannot POST a new cross-academy batch.
7. Fresh SQL verifies unchanged batch/owner counts, exact one policy, and no write privileges.

The report shows each expected allowed/denied result. Tests fail closed; passwords, publishable key and JWT values are never printed. The job uses the existing public-repository standard Linux runner, no paid AI or hosted Supabase, no artifact uploads and a 20-minute timeout.

## Important limitations

**AG3.1 only covers Academy Owner read isolation in the NONHISTORICAL synthetic schema.** It does NOT assert production RLS parity, Coach/Parent/Super Admin authorization, historical migration replay, financial tables or production readiness. Those require separately scoped AG3 follow-on work and a verified schema/policy inventory; do not mark the full security audit complete.

The previous Windows C3.4B2 local environment remains separate and unresolved; no access, reset, duplicate signup or cleanup is performed there.

**Status:** IMPLEMENTED; GitHub CI NOT YET RUN; Owner approval/merge pending. No production/Main deployment changes.
