# AG3.4B — Real-JWT replay of deployed legacy Coach mapping policies

**Status:** implementation written on `devbot-ag3-4b-live-coach-mapping-parity`; native Supabase CI validation pending. No live migration or production database operation.

## Source and reproducibility

A read-only `pg_policies` query on active `acadpro-db` (`ulyealhkmlorsbdiknrh`) captured all four `public.coach_batches` policy expressions for SELECT, INSERT, UPDATE and DELETE, including both UPDATE `USING` and `WITH CHECK`. The scratch-only file `supabase/tests/security/ag34b_live_coach_batches_policy_snapshot.sql` contains verbatim policy predicates and the checked live table grants. Its postflight compares four canonical predicate checksums against the live `pg_policies` catalog. Source changes must invalidate the checksum; **do not silently fix snapshots to pass**.

AG3.4B rebuilds AG2, AG3.1, AG3.2 and AG3.3 into an unlinked Supabase CLI 3.0.0 environment, using nine real GoTrue-issued JWTs and three linked Player/Parent fixtures across two academies. That context matters because the legacy policy’s `EXISTS (SELECT FROM batches)` is subject to the caller’s batch RLS, while `private.batch_academy_id()` is security-definer.

## Test questions

1. Can Parent A1 or A2 read `coach_batches` belonging to the *other* parent’s batch within the same academy?
2. Can Coach A read inactive `coach_batches` membership?
3. Can Parent A1 or Coach A insert a Coach-B cross-tenant mapping into an academy-A batch visible to them through existing batch policies? If yes, can they delete the injected row? **Only test on disposable invented rows.**
4. Can forged tenant/user headers widen access? Are foreign-academy direct-ID reads filtered?
5. After replacing only those four policies with **scratch-only** role gates, do Parent writes and mapping reads deny, Coach A see only own active membership, and Owner A/Super Admin retain intended operations and row integrity?

The test-only candidate in `ag34b_scratch_role_gated_candidate.sql` is a controlled hypothesis. It adds explicit `is_academy_owner()` to academy branches, active-Coach/self constraints to reads, and Coach/Batch academy consistency to Owner INSERT/UPDATE. It **must not** be applied directly to the hosted instance; historical migration source drift, frontend dependencies and complete policy provenance remain blockers to safe production deployment.

## Limitations

Even if source expressions match live `pg_policies`, this is a minimized seven-table synthetic schema with existing pinned helper definitions, **not a replay of 82 historical migrations**, and not a proof that other triggers, Supabase Storage, Auth or RPC layers exactly match the hosted app. A confirmed unexpected positive result in this disposable reconstruction is a strong authorization signal, not a claim that real customer records were changed or that a hosted exploit occurred.

## Exit criteria

- Pure safety tests and real native JWT/PostgREST CI both PASS.
- All four live predicates match read-only source-derived checksums.
- Before/after tests distinguish legacy scope from proposed role-gated candidate.
- Real app still needs targeted manual validation, an authored audited migration, and separate production rollout approval before policies can be hardened.
- Merge only into `payment-module-finalization` after successful CI under the Product Owner’s standing AG3.4 PR approvals.
