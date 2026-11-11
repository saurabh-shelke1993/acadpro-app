# Kheltriva DevBot AG3.2 — Real Coach JWT assigned-batch RLS

**11 November 2026 — code implemented in isolated review branch; native CI and Owner acceptance pending.**

## Goal

Verify real signed GoTrue Coach sessions read only batches to which the Coach has an **active** assigned-batch mapping, including direct-ID and multi-academy negative tests. This is a minimal nonhistorical test policy, **not** a certification of Kheltriva's hosted production policies.

## Verified source relationships

- Live `coaches.user_id → auth.users.id`; synthetic prerequisite `public.coaches.user_id` has the same Auth FK.
- `coach_batches` links Coach and Batch but does **not** itself encode assignment activity in the original B2.9 synthetic schema.
- `coach_batch_assignments` has `coach_id`, `batch_id`, `is_active`, and the pinned `private.is_coach_assigned_to_batch(uuid)` checks **active** assignment and `auth.uid()`.
- The pinned `private.can_access_batch(uuid)` reads `coach_batches` without an active-assignment condition. **Do not substitute it** for `is_coach_assigned_to_batch` in this AG3.2 policy. Evaluate any use of this helper against real policy semantics separately in AG3.4.
- Live `batches_select` currently includes `private.is_coach_assigned_to_batch(id)`. The test-only policy additionally enforces Coach role and matching `public.users.academy_id`; this additional predicate is a **synthetic defense** and does not establish live text parity.

## Deliberately narrow CI scope

1. New unlinked GitHub Linux Supabase CLI 3.0.0 instance; no hosted project, historical migration, production credentials or secrets.
2. Reuse exactly AG2's five scratch RLS tables, eleven pinned current-state helpers, authentic GoTrue Owner A/B mappings, and AG3.1's approved Owner read policy.
3. Create **two more real signed-in GoTrue identities**, Coach A and Coach B. Map their Auth UUIDs with one guarded atomic SQL fixture. Coach A belongs to invented Academy A; Coach B to Academy B.
4. Coach A has one active Academy A assignment plus one **inactive, same-academy** membership; Coach B has one active Academy B assignment. All three `coach_batches` mappings exist, but active status is authoritative for batch read tests.
5. Create just one Coach SELECT policy on `public.batches` using the pinned `private.is_coach()`, `private.current_academy_id()` and `private.is_coach_assigned_to_batch(id)`. Preserve AG3.1 policy and existing read-only grant; do **not** grant Coach direct access to `coaches`, `coach_batches` or `coach_batch_assignments`.
6. Send actual JWT-backed PostgREST HTTP requests: two positive assigned reads; direct foreign-academy and inactive same-academy ID reads denied (zero rows); identity/header tampering denied; unmapped identity, anonymous and invalid bearer denied; writes and direct mapping-table reads denied.
7. Recheck Owner A/B original behavior after Coach policy installation, and verify database row/policy/grant counts via a fresh psql connection. Emit redacted GitHub Actions Summary.

## Strict limits

- **Scope of success:** The *new synthetic policy*, pinned current-state helpers, GoTrue and PostgREST work together for those exact Coach cases only.
- **Not tested:** Existing complete hosted Coach policies, player/update rules, attendance recording/editing, historical migration replay, Parent or Super Admin, Storage, finance, webhook/payment lifecycle or B4.
- `main`/Vercel remain untouched; no migration or schema change in hosted Supabase; no paid infrastructure or external AI.
- The owner's prior Windows C3.4B2 local persistence incident is independent and not repaired/reset.
- A failed CI run is a failure, not acceptance. Fix only the scoped test harness and rerun, then obtain Owner manual acceptance before merging.

## Files

- `.github/workflows/devbot-ag3-2-coach-jwt-rls.yml`
- `scripts/devbot/ag3_2_coach_jwt_rls_ci.py`
- `scripts/devbot/test_ag3_2_coach_jwt_rls_ci.py`
- `supabase/tests/subscriptions/ps_l2_3_b2_9_ag32_coach_batch_rls.sql`

**Stage:** implementation completed in separate branch; CI and Owner review/merge gate pending. Do not mark AG3.2 accepted until CI PASS and approved PR.
