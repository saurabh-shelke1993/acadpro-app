# Kheltriva DevBot AG3.1 — Real signed-JWT cross-academy batch RLS

**11 November 2026 — implemented in isolated feature branch; real CI and owner approval pending.**

## Scope and method

The Owner-approved AG3 stage validates one minimal **nonhistorical synthetic policy**, built on top of AG2's real GoTrue and eleven pinned current-state private authorization helpers. It deliberately does NOT install the historical app schema or treat a fabricated Auth claims session as evidence. This is the first tested policy fixture in AG3; broader role/RLS matrices are separate future checkpoints.

1. Create a fresh UNLINKED `kheltriva-ag3-ci` Supabase CLI 3.0.0 stack on a standard GitHub Linux runner, with no historical migrations, production keys or hosted project.
2. Create the original five-table synthetic schema and unchanged eleven private helpers, with atomic source/hash/ACL guards.
3. Sign up three invented accounts through **real local GoTrue**, verify their issued bearer sessions via `/auth/v1/user`, and FK-map two Academy Owner UUIDs to separate synthetic academies using the existing guarded mapping SQL. The third account has no application role.
4. Apply one **strictly scratch-only** SELECT grant on `public.batches` to `authenticated` and one explicit SELECT RLS policy using existing `private.is_academy_owner()` and `private.current_academy_id()`. Anon and writes remain denied.
5. Send **actual Auth-issued JWTs to local PostgREST**. Owner A can list/read Batch A only; Owner B can list/read Batch B only. Direct foreign-batch ID reads return zero rows. An unmapped signed-in user gets zero rows. Anonymous and invalid bearer requests receive 401/403. Forged x-academy-id and x-user-id headers cannot expand access. INSERT/PATCH/DELETE are denied. Verify final DB rows/grants unchanged.
6. Publish a **safe** GitHub Actions Summary with individual PASS/FAIL checkpoints. Secrets and response bodies are not included; the stack is discarded.

## Precise security caveat

- This **does test real JWT-based PostgREST RLS evaluation** on a representative synthetic Academy Owner read policy. It does **not verify existing production RLS policy text** or sign off the complete Academy Owner CRUD, Coach assigned-batch access, Parent linked-player access, Super Admin management, payment/finance, historical schema or Storage.
- These additional roles and mutations must be separate AG3.2+ work, grounded in verified actual table relationships. No fake `request.jwt.claim.sub` SQL sessions are used.
- Historical migration replay remains BLOCKED. The Owner's previously failed local C3.4B2 script must not be rerun blindly; that Windows database remains untouched by cloud CI.

## Cost, mobile, deployment

One standard GitHub Linux job, 20-minute limit, cancellation of superseded runs, read-only GitHub token, no uploaded artifacts, no paid AI API and no hosted Supabase project. The owner can inspect the GitHub Actions Summary on a phone. Workflow manual dispatch requires the file on the default branch, which is not being changed here. No Vercel/main deployment.

## Checkpoint status

AG2: Merged by Owner approval, post-merge real Auth CI PASS (run 43023539387).
AG3.1: Implemented in feature branch; first real CI pending.
AG3.2+: Coach/Parent/SA, actual app RLS policy coverage pending.
Production/B4: NO-GO / untouched.
