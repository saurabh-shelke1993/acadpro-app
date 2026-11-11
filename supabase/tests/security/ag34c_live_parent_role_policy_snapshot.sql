-- AG3.4C: exact deployed Parent current_parent_id() plus 5 SELECT predicates.
-- Live sources captured from active acadpro-db on 2026-11-11.
-- Scratch-only CI, NOT a canonical migration, not full production schema.
BEGIN;
DO $guard$
BEGIN
 IF current_database()<>'postgres' OR current_user<>'postgres'
    OR session_user<>'postgres'
    OR to_regclass('public.payment_dues') IS NOT NULL
    OR to_regclass('public.parents') IS NULL
    OR to_regclass('public.players') IS NULL
    OR (SELECT count(*) FROM auth.users)<>9
    OR (SELECT count(*) FROM public.users)<>8
    OR (SELECT count(*) FROM public.parents)<>3
    OR (SELECT count(*) FROM public.players)<>3
    OR to_regprocedure('private.current_parent_id()') IS NOT NULL
    OR (SELECT count(*) FROM pg_proc p JOIN pg_namespace n
        ON n.oid=p.pronamespace WHERE n.nspname='private')<>11
 THEN RAISE EXCEPTION 'AG3.4C requires clean disposable AG3.3 baseline'; END IF;
END $guard$;

-- The real parents table has is_active; the minimal AG3.3 fixture did not.
ALTER TABLE public.parents ADD COLUMN is_active boolean NOT NULL DEFAULT true;

-- Exact function text from read-only live pg_get_functiondef.
CREATE OR REPLACE FUNCTION private.current_parent_id()
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'private', 'pg_catalog'
AS $function$
  SELECT p.id
  FROM public.parents AS p
  JOIN public.users AS u
    ON u.id = p.user_id
  WHERE p.user_id = auth.uid()
    AND lower(coalesce(u.role, '')) = 'parent'
    AND p.is_active = true
  LIMIT 1;
$function$

REVOKE ALL ON FUNCTION private.current_parent_id() FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION private.current_parent_id() TO authenticated;

-- Drop ONLY the three AG3.3 synthetic Parent read policies in scratch.
DROP POLICY ag33_synthetic_parent_record_read ON public.parents;
DROP POLICY ag33_synthetic_linked_player_read ON public.players;
DROP POLICY ag33_synthetic_parent_batch_read ON public.batches;

-- Deploy verbatim expressions captured from five live policies into CI only.
CREATE POLICY batches_parent_select ON public.batches FOR SELECT TO authenticated
USING ((( SELECT private.current_user_role() AS current_user_role) = 'parent'::text) AND (EXISTS ( SELECT 1
   FROM players p
  WHERE ((p.batch_id = batches.id) AND (p.parent_id = ( SELECT private.current_parent_id() AS current_parent_id))))));

CREATE POLICY parents_parent_select ON public.parents FOR SELECT TO authenticated
USING ((private.current_user_role() = 'parent'::text) AND (id = private.current_parent_id()));

CREATE POLICY parents_select ON public.parents FOR SELECT TO authenticated
USING (private.is_super_admin() OR (private.is_academy_owner() AND (academy_id = private.current_academy_id())) OR ((private.current_user_role() = 'coach'::text) AND (EXISTS ( SELECT 1
   FROM players p
  WHERE ((p.parent_id = parents.id) AND private.is_coach_assigned_to_batch(p.batch_id))))));

CREATE POLICY players_parent_select ON public.players FOR SELECT TO authenticated
USING ((private.current_user_role() = 'parent'::text) AND (parent_id = private.current_parent_id()));

CREATE POLICY players_select ON public.players FOR SELECT TO authenticated
USING (private.is_super_admin() OR (private.is_academy_owner() AND (academy_id = private.current_academy_id())) OR ((private.current_user_role() = 'coach'::text) AND private.is_coach_assigned_to_batch(batch_id)));

DO $verify$
BEGIN
 IF (SELECT count(*) FROM pg_policies WHERE schemaname='public'
       AND ((tablename='batches' AND policyname='batches_parent_select' AND md5(coalesce(qual,'')||chr(31)||coalesce(with_check,''))='7fa1a5d0550c9c2ffa87a02fb037fbd6')
 OR (tablename='parents' AND policyname='parents_parent_select' AND md5(coalesce(qual,'')||chr(31)||coalesce(with_check,''))='b865353d9d2219422abfc5728d5c96d5')
 OR (tablename='parents' AND policyname='parents_select' AND md5(coalesce(qual,'')||chr(31)||coalesce(with_check,''))='373e2e1995e7ab9e1b3500ed71da9e26')
 OR (tablename='players' AND policyname='players_parent_select' AND md5(coalesce(qual,'')||chr(31)||coalesce(with_check,''))='4727910545b4a4237a003ba156af09de')
 OR (tablename='players' AND policyname='players_select' AND md5(coalesce(qual,'')||chr(31)||coalesce(with_check,''))='0a877b1bd82f622f005c45fd9fd98cf5')))<>5
 THEN RAISE EXCEPTION 'AG3.4C exact deployed Parent policy checksum mismatch'; END IF;
 IF md5(pg_get_functiondef('private.current_parent_id()'::regprocedure))<>'5cd00d89a1a947ad5b9ee315bba211e2'
 THEN RAISE EXCEPTION 'AG3.4C current_parent_id source digest mismatch'; END IF;
 IF (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
     WHERE n.nspname='private')<>12
 OR (SELECT count(*) FROM pg_policies WHERE schemaname='public' AND tablename='parents')<>2
 OR (SELECT count(*) FROM pg_policies WHERE schemaname='public' AND tablename='players')<>2
 OR (SELECT count(*) FROM pg_policies WHERE schemaname='public' AND tablename='batches')<>7
 OR NOT has_function_privilege('authenticated','private.current_parent_id()','EXECUTE')
 OR has_function_privilege('anon','private.current_parent_id()','EXECUTE')
 THEN RAISE EXCEPTION 'AG3.4C parent policy grants/counts unexpected'; END IF;
END $verify$;
NOTIFY pgrst,'reload schema';
COMMIT;
SELECT 'AG3.4C EXACT PARENT POLICY AND HELPER SNAPSHOT VERIFIED' AS checkpoint;
