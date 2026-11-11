-- AG3.4B proposed *test-only* tightened policies. NEVER deploy blindly.
-- Replaces LIVE-cloned policies *inside an unlinked disposable CI instance*.
-- Role gate Owner/SA writes; Coaches read only own ACTIVE assignments.
-- Explicit coach AND batch academy consistency prevents cross-tenant link writes.
BEGIN;
DO $guard$
BEGIN
 IF current_database()<>'postgres' OR current_user<>'postgres'
    OR session_user<>'postgres'
    OR to_regclass('public.players') IS NULL
    OR to_regclass('public.payment_dues') IS NOT NULL
    OR (SELECT count(*) FROM auth.users)<>9
    OR (SELECT count(*) FROM public.coach_batches)<>3
    OR (SELECT count(*) FROM pg_policies
        WHERE schemaname='public' AND tablename='coach_batches')<>4
 THEN RAISE EXCEPTION 'AG3.4B remediation target is not isolated fixture'; END IF;
END $guard$;

ALTER POLICY coach_batches_select ON public.coach_batches TO authenticated
USING (
 private.is_super_admin()
 OR (private.is_academy_owner()
     AND private.batch_academy_id(batch_id)=private.current_academy_id())
 OR (private.is_coach()
     AND private.is_coach_assigned_to_batch(batch_id)
     AND EXISTS (SELECT 1 FROM public.coaches c
                 WHERE c.id=coach_batches.coach_id AND c.user_id=auth.uid()))
);

ALTER POLICY coach_batches_insert ON public.coach_batches TO authenticated
WITH CHECK (
 private.is_super_admin()
 OR (private.is_academy_owner()
     AND EXISTS (SELECT 1 FROM public.batches b
                 JOIN public.coaches c ON c.id=coach_batches.coach_id
                 WHERE b.id=coach_batches.batch_id
                   AND b.academy_id=private.current_academy_id()
                   AND c.academy_id=private.current_academy_id()))
);

ALTER POLICY coach_batches_update ON public.coach_batches TO authenticated
USING (
 private.is_super_admin()
 OR (private.is_academy_owner()
     AND EXISTS (SELECT 1 FROM public.batches b
                 WHERE b.id=coach_batches.batch_id
                   AND b.academy_id=private.current_academy_id()))
)
WITH CHECK (
 private.is_super_admin()
 OR (private.is_academy_owner()
     AND EXISTS (SELECT 1 FROM public.batches b
                 JOIN public.coaches c ON c.id=coach_batches.coach_id
                 WHERE b.id=coach_batches.batch_id
                   AND b.academy_id=private.current_academy_id()
                   AND c.academy_id=private.current_academy_id()))
);

ALTER POLICY coach_batches_delete ON public.coach_batches TO authenticated
USING (
 private.is_super_admin()
 OR (private.is_academy_owner()
     AND EXISTS (SELECT 1 FROM public.batches b
                 WHERE b.id=coach_batches.batch_id
                   AND b.academy_id=private.current_academy_id()))
);

DO $verify$
BEGIN
 IF (SELECT count(*) FROM pg_policies
    WHERE schemaname='public' AND tablename='coach_batches')<>4
 OR (SELECT count(*) FROM public.coach_batches)<>3
 THEN RAISE EXCEPTION 'AG3.4B candidate policy count changed'; END IF;
END $verify$;
NOTIFY pgrst, 'reload schema';
COMMIT;
SELECT 'AG3.4B SCRATCH ROLE-GATED CANDIDATE INSTALLED' AS checkpoint;
