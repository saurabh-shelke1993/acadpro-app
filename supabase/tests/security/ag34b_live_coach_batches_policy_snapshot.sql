-- AG3.4B exact current live policy predicate snapshot, *scratch-only*.
-- Collected read-only from active acadpro-db pg_policies on 2026-11-11.
-- Preserve these 4 predicates verbatim; no hosted application or migrations.
-- Execute only against AG3.3 9-identity local GoTrue fixture.
BEGIN;
DO $guard$
BEGIN
 IF current_database()<>'postgres' OR session_user<>'postgres'
   OR current_user<>'postgres'
   OR to_regclass('auth.users') IS NULL
   OR to_regclass('public.payment_dues') IS NOT NULL
   OR to_regclass('public.players') IS NULL
   OR to_regclass('public.parents') IS NULL
   OR to_regclass('public.coach_batches') IS NULL
   OR (SELECT count(*) FROM auth.users)<>9
   OR (SELECT count(*) FROM public.users)<>8
   OR (SELECT count(*) FROM public.coach_batches)<>3
   OR (SELECT count(*) FROM public.players)<>3
   OR (SELECT count(*) FROM pg_policies
       WHERE schemaname='public' AND tablename='coach_batches')<>0
 THEN RAISE EXCEPTION 'AG3.4B requires disposable AG3.3 baseline'; END IF;
END $guard$;

-- Additional exact live dependency: the legacy SELECT predicate directly
-- queries public.coaches under caller RLS. The AG2 synthetic coaches table
-- omitted its live academy_id, which is needed for the real coaches_select
-- predicate. Reconstruct only this verified column and policy.
ALTER TABLE public.coaches ADD COLUMN academy_id uuid;
UPDATE public.coaches c SET academy_id=u.academy_id
 FROM public.users u WHERE u.id=c.user_id;
ALTER TABLE public.coaches ALTER COLUMN academy_id SET NOT NULL;
GRANT SELECT ON public.coaches TO authenticated;
CREATE POLICY coaches_select ON public.coaches FOR SELECT TO authenticated
USING (private.is_super_admin() OR (private.is_academy_owner() AND (academy_id = private.current_academy_id())) OR ((private.current_user_role() = 'coach'::text) AND (user_id = auth.uid())));

-- Live authenticated CRUD GRANT also exists; simulate explicitly.
-- The live table's anon SELECT GRANT is also mirrored; RLS TO authenticated
-- should still deny anon rows even if REST returns empty successfully.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.coach_batches TO authenticated;
GRANT SELECT ON public.coach_batches TO anon;

-- EXACT SQL expressions from the four current pg_policies.qual/with_check.
CREATE POLICY coach_batches_delete ON public.coach_batches
FOR DELETE TO authenticated
USING (private.is_super_admin() OR (EXISTS ( SELECT 1
   FROM batches b
  WHERE ((b.id = coach_batches.batch_id) AND (b.academy_id = private.current_academy_id())))))
;

CREATE POLICY coach_batches_insert ON public.coach_batches
FOR INSERT TO authenticated

WITH CHECK (private.is_super_admin() OR (EXISTS ( SELECT 1
   FROM batches b
  WHERE ((b.id = coach_batches.batch_id) AND (b.academy_id = private.current_academy_id())))));

CREATE POLICY coach_batches_select ON public.coach_batches
FOR SELECT TO authenticated
USING (private.is_super_admin() OR (private.batch_academy_id(batch_id) = private.current_academy_id()) OR (EXISTS ( SELECT 1
   FROM coaches c
  WHERE ((c.id = coach_batches.coach_id) AND (c.user_id = auth.uid())))))
;

CREATE POLICY coach_batches_update ON public.coach_batches
FOR UPDATE TO authenticated
USING (private.is_super_admin() OR (EXISTS ( SELECT 1
   FROM batches b
  WHERE ((b.id = coach_batches.batch_id) AND (b.academy_id = private.current_academy_id())))))
WITH CHECK (private.is_super_admin() OR (EXISTS ( SELECT 1
   FROM batches b
  WHERE ((b.id = coach_batches.batch_id) AND (b.academy_id = private.current_academy_id())))));

DO $verify$
BEGIN
 IF (SELECT count(*) FROM pg_policies WHERE schemaname='public'
       AND tablename='coaches' AND policyname='coaches_select'
       AND md5(coalesce(qual,'')||chr(31)||coalesce(with_check,''))='a8dcb3c1805bd633cb234706ce4aed3c')<>1
 THEN RAISE EXCEPTION 'AG3.4B live Coach dependency checksum mismatch'; END IF;
 IF (SELECT count(*) FROM pg_policies WHERE schemaname='public'
       AND tablename='coach_batches' AND
       ((policyname='coach_batches_select' AND md5(coalesce(qual,'')||chr(31)||coalesce(with_check,''))='cd4193d15352dcfb25a4b3835e8850a4')
       OR (policyname='coach_batches_insert' AND md5(coalesce(qual,'')||chr(31)||coalesce(with_check,''))='957ab744836d9772e4258c85504827c0')
       OR (policyname='coach_batches_update' AND md5(coalesce(qual,'')||chr(31)||coalesce(with_check,''))='7a3ff298bc791c74727729a21549b844')
       OR (policyname='coach_batches_delete' AND md5(coalesce(qual,'')||chr(31)||coalesce(with_check,''))='f82e68e0224f4417a0e0e7a0897be20e')))<>4
 THEN RAISE EXCEPTION 'AG3.4B live predicate checksum parity mismatch'; END IF;
 IF (SELECT count(*) FROM pg_policies WHERE schemaname='public'
       AND tablename='coach_batches')<>4
    OR NOT has_table_privilege('authenticated','public.coach_batches','INSERT')
    OR NOT has_table_privilege('authenticated','public.coach_batches','UPDATE')
    OR NOT has_table_privilege('authenticated','public.coach_batches','DELETE')
    OR NOT has_table_privilege('authenticated','public.coach_batches','SELECT')
    OR NOT has_table_privilege('anon','public.coach_batches','SELECT')
    OR (SELECT count(*) FROM public.coach_batches)<>3
 THEN RAISE EXCEPTION 'AG3.4B live predicate clone is inconsistent'; END IF;
END $verify$;
NOTIFY pgrst, 'reload schema';
COMMIT;
SELECT 'AG3.4B LIVE POLICY PREDICATES INSTALLED IN SCRATCH' AS checkpoint;
