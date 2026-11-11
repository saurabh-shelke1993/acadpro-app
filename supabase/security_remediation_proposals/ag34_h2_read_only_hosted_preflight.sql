-- AG34-H2 HOSTED PRECHECK. READ-ONLY. Capture the output immediately before
-- a separately approved production release. A "STOP" means do not deploy.
-- This does not perform, authorize, or apply any schema changes.
WITH policy_state AS (
  SELECT policyname,cmd,roles,md5(coalesce(qual,'')||chr(31)||coalesce(with_check,'')) AS digest
  FROM pg_policies WHERE schemaname='public' AND tablename='coach_batches'
), checks AS (
 SELECT
  (SELECT count(*) FROM public.coach_batches)=0 AS legacy_table_empty,
  (SELECT relrowsecurity FROM pg_class WHERE oid='public.coach_batches'::regclass) AS rls_enabled,
  (SELECT count(*) FROM policy_state)=4 AS exactly_four_policies,
  (SELECT count(*) FROM policy_state WHERE
    (policyname='coach_batches_select' AND cmd='SELECT' AND roles='{authenticated}'::name[] AND digest='cd4193d15352dcfb25a4b3835e8850a4')
    OR (policyname='coach_batches_insert' AND cmd='INSERT' AND roles='{authenticated}'::name[] AND digest='957ab744836d9772e4258c85504827c0')
    OR (policyname='coach_batches_update' AND cmd='UPDATE' AND roles='{authenticated}'::name[] AND digest='7a3ff298bc791c74727729a21549b844')
    OR (policyname='coach_batches_delete' AND cmd='DELETE' AND roles='{authenticated}'::name[] AND digest='f82e68e0224f4417a0e0e7a0897be20e')
  )=4 AS original_policy_source_attested,
  has_table_privilege('authenticated','public.coach_batches','SELECT')
   AND has_table_privilege('authenticated','public.coach_batches','INSERT')
   AND has_table_privilege('authenticated','public.coach_batches','UPDATE')
   AND has_table_privilege('authenticated','public.coach_batches','DELETE')
   AND has_table_privilege('anon','public.coach_batches','SELECT') AS expected_old_grants,
  (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
   WHERE n.nspname='private' AND
     ((p.oid::regprocedure::text='private.can_access_batch(uuid)' AND md5(pg_get_functiondef(p.oid))='904f63449638d7d62256cd6c646024eb')
     OR (p.oid::regprocedure::text='private.can_access_center(uuid)' AND md5(pg_get_functiondef(p.oid))='6fa7c6666752421100f54806a3dc8605')
     OR (p.oid::regprocedure::text='private.can_access_coach_batch(uuid)' AND md5(pg_get_functiondef(p.oid))='dade30c21e9d96cf284dc7e028d3eeb6'))) = 3 AS three_legacy_helpers_attested,
  (SELECT relrowsecurity FROM pg_class WHERE oid='public.coach_batch_assignments'::regclass)
     AS modern_assignment_rls_enabled,
  (SELECT count(*) FROM public.coach_batch_assignments) AS modern_assignment_rows
)
SELECT
 CASE WHEN legacy_table_empty AND rls_enabled AND exactly_four_policies
  AND original_policy_source_attested AND expected_old_grants
  AND three_legacy_helpers_attested AND modern_assignment_rls_enabled
 THEN 'READY_FOR_SEPARATE_PRODUCTION_APPROVAL' ELSE 'STOP_DO_NOT_DEPLOY' END AS decision,
 * FROM checks;
