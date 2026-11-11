# AG3.4B — Real-JWT replay of deployed legacy Coach mapping policies

**Status:** implemented and native scratch GoTrue/JWT/PostgREST CI PASS; high-priority authorization gap confirmed under replayed deployed predicates. No live migration or production database operation.

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

## Final native CI outcome — 11 November 2026

[Successful run 43046427442](https://github.com/saurabh-shelke1993/acadpro-app/actions/runs/43046427442) passed **10/10 pure security tests**, real native Auth/PostgREST, all four live predicate checksums, and after-fix positive/negative role regressions. CI logs explicitly record:

- `AG3.4B PARENT_MAPPING_INSERT ALLOWED_IN_SCRATCH`
- `AG3.4B COACH_MAPPING_INSERT ALLOWED_IN_SCRATCH`
- Successful removal of both injected cross-academy Coach→Batch rows.
- Role-gated scratch candidate denies Parent mapping reads/writes, limits Coach reads to own active assignment, blocks Owner cross-academy Coach reassignment and retains Owner/SA permitted mapping management.

**Risk classification:** Confirmed unsafe authorization **in an exact-predicate, source-attested disposable reconstruction**; HIGH priority for controlled migration design and live-rollout authorization. No claim that any hosted customer record was exploited or changed.

Earlier GitHub CI runs failed on static-test wording or an incomplete scratch `coaches_select` dependency. The final successful run includes the source-matched extra live `coaches_select` RLS policy (its predicate checksum), `coaches.academy_id`, live matching grants and exact legacy `coach_batches` RLS, including nested batch RLS visibility.

**Release status:** Role-gated fix exists only as `supabase/tests/security/ag34b_scratch_role_gated_candidate.sql`; it is **NOT a canonical migration and NOT deployed**. Historical migration drift, full RPC/Storage regression, and dedicated hosted-release safeguards remain hard blockers. Do not interpret PR merge as hosted remediation.
