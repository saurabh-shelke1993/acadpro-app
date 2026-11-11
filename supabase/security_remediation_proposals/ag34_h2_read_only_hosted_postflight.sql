-- AG34-H2 HOSTED POSTCHECK. READ-ONLY. Run only AFTER a separately approved
-- migration has been executed and after manual role checks are arranged.
-- Do not run mutating probes against hosted customer records.
WITH state AS (
 SELECT
  (SELECT count(*) FROM public.coach_batches)=0 AS legacy_table_empty,
  (SELECT relrowsecurity FROM pg_class WHERE oid='public.coach_batches'::regclass) AS rls_enabled,
  (SELECT count(*) FROM pg_policies WHERE schemaname='public' AND tablename='coach_batches')=5 AS five_policies,
  (SELECT count(*) FROM pg_policies WHERE schemaname='public' AND tablename='coach_batches'
      AND policyname='coach_batches_legacy_closed' AND permissive='RESTRICTIVE'
      AND cmd='ALL' AND roles='{authenticated}'::name[]
      AND qual='false' AND with_check='false')=1 AS restrictive_deny_all,
  NOT has_table_privilege('authenticated','public.coach_batches','SELECT')
    AND NOT has_table_privilege('authenticated','public.coach_batches','INSERT')
    AND NOT has_table_privilege('authenticated','public.coach_batches','UPDATE')
    AND NOT has_table_privilege('authenticated','public.coach_batches','DELETE')
    AND NOT has_table_privilege('anon','public.coach_batches','SELECT')
    AND NOT has_table_privilege('anon','public.coach_batches','INSERT')
    AND NOT has_table_privilege('anon','public.coach_batches','UPDATE')
    AND NOT has_table_privilege('anon','public.coach_batches','DELETE') AS all_client_grants_denied,
  (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
   WHERE n.nspname='private' AND
     ((p.oid::regprocedure::text='private.can_access_batch(uuid)' AND md5(pg_get_functiondef(p.oid))='904f63449638d7d62256cd6c646024eb')
     OR (p.oid::regprocedure::text='private.can_access_center(uuid)' AND md5(pg_get_functiondef(p.oid))='6fa7c6666752421100f54806a3dc8605')
     OR (p.oid::regprocedure::text='private.can_access_coach_batch(uuid)' AND md5(pg_get_functiondef(p.oid))='dade30c21e9d96cf284dc7e028d3eeb6'))) = 3 AS three_legacy_helpers_unchanged,
  (SELECT relrowsecurity FROM pg_class WHERE oid='public.coach_batch_assignments'::regclass) AS modern_assignment_rls_enabled,
  (SELECT count(*) FROM public.coach_batch_assignments) AS modern_assignment_rows
)
SELECT CASE WHEN legacy_table_empty AND rls_enabled AND five_policies
  AND restrictive_deny_all AND all_client_grants_denied AND three_legacy_helpers_unchanged
  AND modern_assignment_rls_enabled THEN 'PASS_POLICY_LOCKDOWN'
  ELSE 'STOP_INVESTIGATE_NO_REGRANTS' END AS decision, * FROM state;
