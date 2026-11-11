# Kheltriva DevBot AG3.3 — Parent linked-player and Super Admin JWT/RLS

**11 November 2026 — implemented and real GoTrue/JWT/PostgREST native CI PASS on review branch; Product Owner acceptance and merge pending.**

## Objective

Extend the validated AG1 → AG2 → AG3.1 → AG3.2 disposable-Supabase approach to **Parent** and **Super Admin** role authorization. All role testing uses real local GoTrue signups and authentic JWTs sent through PostgREST, never simulated request.jwt.claim SQL variables. No hosted Supabase project connection, paid infrastructure, production data, historic migrations, or default-branch deployment.

## Verified current live data model (read-only catalog)

- `public.users.id → auth.users.id`.
- `public.parents.user_id → public.users.id`, `public.players.parent_id → public.parents.id`, and `public.players.batch_id → public.batches.id`.
- Current hosted `batches_parent_select` uses `private.current_user_role() = 'parent'` and `private.current_parent_id()` to constrain batches through the player's linked parent.
- Hosted `batches_select` already includes `private.is_super_admin()`. Current hosted policies include Super Admin batch CREATE/UPDATE/DELETE and per-role restrictions.
- AG2's **pinned eleven current-state helpers** contain `current_user_role()` and `is_super_admin()`, but **not** `current_parent_id()`. AG3.3 therefore uses the verified FK relationship and `auth.uid()` in a **new, test-only synthetic policy**, without inventing a replacement `SECURITY DEFINER` or claiming deployed policy parity.

## Synthetic fixture (never a production migration)

1. Rebuild AG2 native five-table scratch schema, pinned eleven helpers, and three original real Auth sessions; install and verify AG3.1 Owner RLS.
2. Provision two real Coach identities, repeat the approved AG3.2 active/inactive mappings and synthetic policy.
3. Provision three *new* Parent JWT accounts: Parent A1 and Parent A2 in the **same academy**, Parent B in another. Provision one Super Admin JWT with no academy restriction. `auth.users` has nine synthetic identities total.
4. Add minimal RLS-enabled `public.parents` (Auth user mapping) and `public.players` (linked parent and batch) with three invented parent/child records, one per existing batch. Grant SELECT to authenticated, with test-only Parent-own-or-Super-Admin policies; writes stay denied.
5. Add a new Parent SELECT policy on `public.batches` requiring the authenticated user's own `parents.user_id` linked via `players.parent_id`; add a separate Super Admin global SELECT policy using pinned `private.is_super_admin()`.
6. Add **synthetic Super Admin-only** INSERT/UPDATE/DELETE policies on `public.batches` and minimal `authenticated` grants so PostgREST exercises actual RLS permissions, rather than merely the absence of a SQL GRANT. Super Admin tests create a disposable batch, reassign its academy, then delete it. Denied mutations from other roles must leave existing batches unchanged.

## Positive/negative test contract

- Parents A1, A2, B may read their own Parent record, own child, and linked training batch; not another Parent's row, child, or batch, **including A1 versus A2 in the same academy**.
- Super Admin can read all three parents, players, and batches across academies; the synthetic batch CRUD cycle succeeds and leaves the baseline unchanged.
- Unmapped signed-in Auth account reads nothing. Anonymous/forged bearer requests are denied. Forging `x-user-id` and `x-academy-id` cannot expand parent visibility.
- Parent/Coach direct batch INSERT/UPDATE/DELETE are denied by SA-only RLS. Parent/Coach and previous Owner/Coach positive and negative SELECT access are rechecked after adding policies.
- Final fresh SQL checks the nine Auth users, eight app users, three parents, three players, three batches, seven RLS-enabled synthetic tables, seven batch policies, two additional read policies and eleven unchanged helpers; no direct `anon` access.

## Important boundaries

This validates **scratch-only nonhistorical** policies created in the test fixture, **not** the real production policy implementations or their full history. The generated `public.parents`/`public.players` structures reflect a small verified relation chain only. The Super Admin mutation behavior is demonstrated on scratch batches, not on hosted Kheltriva data. Real Parent Portal service/RPC coverage, financial data, Storage, 82-version history, complete matrix and policy equivalence remain AG3.4/B3 release blockers. The Owner's local Windows C3.4B2 persistence check is separate.

No source under `supabase/migrations`, no actual application source code or UI, no hosted database grants, no `main` or Vercel deployment, no Auth secrets or tokens in logs.

## Implementation files

- `.github/workflows/devbot-ag3-3-parent-sa-jwt-rls.yml`
- `scripts/devbot/ag3_3_parent_sa_jwt_rls_ci.py`
- `scripts/devbot/test_ag3_3_parent_sa_jwt_rls_ci.py`
- `supabase/tests/subscriptions/ps_l2_3_b2_9_ag33_parent_sa_rls.sql`

**Validation evidence:** [Native GitHub Actions run 43039558349](https://github.com/saurabh-shelke1993/acadpro-app/actions/runs/43039558349) **PASS**: 14/14 pure safety tests; real ephemeral Supabase 3.0.0 native GoTrue, PostgREST and actual JWT positive/negative Parent/SA checks; synthetic Super Admin CRUD; previous Owner/Coach regression; postflight SQL and no-backup cleanup all passed. First run 43039312329 failed one pure test due report capitalization and did not start native Supabase; fixed in commit `ea564729`. The successful native run tested unchanged SQL/driver sources after that correction.

**Review gate:** [PR #7](https://github.com/saurabh-shelke1993/acadpro-app/pull/7) targets `payment-module-finalization` only and remains **OPEN**. Explicit Product Owner manual acceptance and merge are still pending. Real production-schema parity, Parent Portal/RPCs and B4 release are NOT complete.
