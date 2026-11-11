-- AG34-HIGH-001: PROPOSED LEGACY COACH-BATCH DIRECT API LOCKDOWN.
-- Source-attested on 2026-11-11; NOT A CANONICAL MIGRATION AND NOT DEPLOYED.
-- Requires separate Owner production rollout approval and an official CLI-created
-- migration once provenance/deployment plan is approved.
--
-- Why: public.coach_batches is empty in the live inspected project; active
-- Coach Batch Mapping uses public.coach_batch_assignments. The four legacy
-- policies expose same-academy Coach/Parent SELECT/INSERT/UPDATE/DELETE.
-- Preserves all existing policies, the legacy table and three private helper
-- dependencies. Revoke client grants AND apply restrictive RLS defense in depth.
-- Explicitly abort on non-empty legacy data, source drift or repeat execution.
BEGIN;

DO $ag34_h1_preflight$
BEGIN
 IF to_regclass('public.coach_batches') IS NULL
    OR NOT (SELECT c.relrowsecurity FROM pg_class c
            WHERE c.oid='public.coach_batches'::regclass)
    OR (SELECT count(*) FROM public.coach_batches)<>0
    OR (SELECT count(*) FROM pg_policies
        WHERE schemaname='public' AND tablename='coach_batches')<>4
    OR NOT has_table_privilege('authenticated','public.coach_batches','SELECT')
    OR NOT has_table_privilege('authenticated','public.coach_batches','INSERT')
    OR NOT has_table_privilege('authenticated','public.coach_batches','UPDATE')
    OR NOT has_table_privilege('authenticated','public.coach_batches','DELETE')
    OR NOT has_table_privilege('anon','public.coach_batches','SELECT')
 THEN RAISE EXCEPTION 'AG34-H1 preflight failed: schema, row count or grants drift'; END IF;

 IF (SELECT count(*) FROM pg_policies
     WHERE schemaname='public' AND tablename='coach_batches'
       AND roles='{authenticated}'::name[]
       AND ((policyname='coach_batches_select' AND cmd='SELECT'
             AND md5(coalesce(qual,'')||chr(31)||coalesce(with_check,''))='cd4193d15352dcfb25a4b3835e8850a4')
         OR (policyname='coach_batches_insert' AND cmd='INSERT'
             AND md5(coalesce(qual,'')||chr(31)||coalesce(with_check,''))='957ab744836d9772e4258c85504827c0')
         OR (policyname='coach_batches_update' AND cmd='UPDATE'
             AND md5(coalesce(qual,'')||chr(31)||coalesce(with_check,''))='7a3ff298bc791c74727729a21549b844')
         OR (policyname='coach_batches_delete' AND cmd='DELETE'
             AND md5(coalesce(qual,'')||chr(31)||coalesce(with_check,''))='f82e68e0224f4417a0e0e7a0897be20e')))<>4
 THEN RAISE EXCEPTION 'AG34-H1 preflight failed: exact deployed policy drift'; END IF;
END $ag34_h1_preflight$;

-- No direct client API access, even if future logic accidentally becomes permissive.
REVOKE ALL PRIVILEGES ON TABLE public.coach_batches
  FROM PUBLIC, anon, authenticated;

-- Defense in depth if privileges are inadvertently regranted in the future:
-- restrictive policy is AND-ed with existing permissive policies.
CREATE POLICY coach_batches_legacy_closed
 ON public.coach_batches
 AS RESTRICTIVE
 FOR ALL TO authenticated
 USING (false) WITH CHECK (false);

DO $ag34_h1_postflight$
BEGIN
 IF (SELECT count(*) FROM public.coach_batches)<>0
    OR (SELECT count(*) FROM pg_policies
        WHERE schemaname='public' AND tablename='coach_batches')<>5
    OR (SELECT count(*) FROM pg_policies
        WHERE schemaname='public' AND tablename='coach_batches'
          AND policyname='coach_batches_legacy_closed'
          AND permissive='RESTRICTIVE' AND cmd='ALL'
          AND roles='{authenticated}'::name[]
          AND qual='false' AND with_check='false')<>1
    OR has_table_privilege('authenticated','public.coach_batches','SELECT')
    OR has_table_privilege('authenticated','public.coach_batches','INSERT')
    OR has_table_privilege('authenticated','public.coach_batches','UPDATE')
    OR has_table_privilege('authenticated','public.coach_batches','DELETE')
    OR has_table_privilege('anon','public.coach_batches','SELECT')
    OR has_table_privilege('anon','public.coach_batches','INSERT')
    OR has_table_privilege('anon','public.coach_batches','UPDATE')
    OR has_table_privilege('anon','public.coach_batches','DELETE')
 THEN RAISE EXCEPTION 'AG34-H1 postflight failed: legacy direct access is not denied'; END IF;
END $ag34_h1_postflight$;

NOTIFY pgrst, 'reload schema';
COMMIT;
SELECT 'AG34-H1 LEGACY COACH MAPPING CLIENT LOCKDOWN VERIFIED' AS checkpoint;
