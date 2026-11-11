-- AG34-H2 EMERGENCY DOWNSHIFT, SCRATCH-REHEARSED ONLY. NOT A MIGRATION.
-- SAFETY: This NEVER restores authenticated/anon grants or legacy table API use.
-- It removes only the new restrictive RLS policy, leaving client access revoked.
-- Requires separately approved incident response before any hosted execution.
-- NOT a normal rollback to known-vulnerable permissions.
BEGIN;
SET LOCAL lock_timeout = '5s';
LOCK TABLE public.coach_batches IN ACCESS EXCLUSIVE MODE;

DO $ag34_h2_guard$
BEGIN
 IF (SELECT count(*) FROM public.coach_batches) <> 0
    OR NOT (SELECT relrowsecurity FROM pg_class WHERE oid='public.coach_batches'::regclass)
    OR (SELECT count(*) FROM pg_policies WHERE schemaname='public' AND tablename='coach_batches') <> 5
    OR (SELECT count(*) FROM pg_policies
         WHERE schemaname='public' AND tablename='coach_batches'
         AND policyname='coach_batches_legacy_closed'
         AND permissive='RESTRICTIVE' AND cmd='ALL'
         AND roles='{authenticated}'::name[]
         AND qual='false' AND with_check='false') <> 1
    OR has_table_privilege('authenticated','public.coach_batches','SELECT')
    OR has_table_privilege('authenticated','public.coach_batches','INSERT')
    OR has_table_privilege('authenticated','public.coach_batches','UPDATE')
    OR has_table_privilege('authenticated','public.coach_batches','DELETE')
    OR has_table_privilege('anon','public.coach_batches','SELECT')
 THEN RAISE EXCEPTION 'AG34-H2 emergency downshift refused: unexpected state'; END IF;
END $ag34_h2_guard$;

DROP POLICY coach_batches_legacy_closed ON public.coach_batches;

DO $ag34_h2_postflight$
BEGIN
 IF (SELECT count(*) FROM public.coach_batches)<>0
    OR (SELECT count(*) FROM pg_policies WHERE schemaname='public' AND tablename='coach_batches')<>4
    OR has_table_privilege('authenticated','public.coach_batches','SELECT')
    OR has_table_privilege('authenticated','public.coach_batches','INSERT')
    OR has_table_privilege('authenticated','public.coach_batches','UPDATE')
    OR has_table_privilege('authenticated','public.coach_batches','DELETE')
    OR has_table_privilege('anon','public.coach_batches','SELECT')
 THEN RAISE EXCEPTION 'AG34-H2 emergency downshift postflight failed'; END IF;
END $ag34_h2_postflight$;

NOTIFY pgrst, 'reload schema';
COMMIT;
SELECT 'AG34-H2 EMERGENCY GRANTS-STILL-REVOKED VERIFIED' AS checkpoint;
