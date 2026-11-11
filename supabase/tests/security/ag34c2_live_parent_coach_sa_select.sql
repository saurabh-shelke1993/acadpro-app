-- AG3.4C2: source-attested deployed six Parent/Coach/SA read-predicates.
-- Never run outside fresh unlinked disposable CI. No hosted SQL migration.
BEGIN;
DO $guard$
BEGIN
 IF current_database()<>'postgres' OR current_user<>'postgres' OR session_user<>'postgres'
 OR to_regclass('auth.users') IS NULL OR to_regclass('public.payment_dues') IS NOT NULL
 OR to_regclass('public.subscription_periods') IS NOT NULL
 OR to_regclass('public.parents') IS NULL OR to_regclass('public.players') IS NULL
 OR (SELECT count(*) FROM auth.users)<>9 OR (SELECT count(*) FROM public.users)<>8
 OR (SELECT count(*) FROM public.parents)<>3 OR (SELECT count(*) FROM public.players)<>3
 OR (SELECT count(*) FROM pg_policies WHERE schemaname='public' AND tablename='batches')<>7
 OR (SELECT count(*) FROM pg_policies WHERE schemaname='public' AND tablename='parents')<>1
 OR (SELECT count(*) FROM pg_policies WHERE schemaname='public' AND tablename='players')<>1
 OR (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='private')<>11
 OR EXISTS(SELECT 1 FROM information_schema.columns
           WHERE table_schema='public' AND table_name='parents' AND column_name='is_active')
 THEN RAISE EXCEPTION 'AG3.4C2 refuses non-disposable or changed synthetic baseline'; END IF;
END $guard$;
ALTER TABLE public.parents ADD COLUMN is_active boolean NOT NULL DEFAULT true;
-- Source from live private.current_parent_id() pg_get_functiondef, copied exactly.
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
$function$;

-- AG3.3 synthetic SELECT conditions are removed to prevent permissive OR bypass.
DROP POLICY ag3_synthetic_owner_batch_read ON public.batches;
DROP POLICY ag32_synthetic_coach_batch_read ON public.batches;
DROP POLICY ag33_synthetic_parent_batch_read ON public.batches;
DROP POLICY ag33_synthetic_super_admin_batch_read ON public.batches;
DROP POLICY ag33_synthetic_parent_record_read ON public.parents;
DROP POLICY ag33_synthetic_linked_player_read ON public.players;
-- Exact current pg_policies.qual expressions; no reinterpretation of roles.
CREATE POLICY batches_parent_select ON public.batches
FOR SELECT TO authenticated
USING ((( SELECT private.current_user_role() AS current_user_role) = 'parent'::text) AND (EXISTS ( SELECT 1
   FROM players p
  WHERE ((p.batch_id = batches.id) AND (p.parent_id = ( SELECT private.current_parent_id() AS current_parent_id))))));

CREATE POLICY batches_select ON public.batches
FOR SELECT TO authenticated
USING (private.is_super_admin() OR (private.is_academy_owner() AND (academy_id = private.current_academy_id())) OR private.is_coach_assigned_to_batch(id));

CREATE POLICY parents_parent_select ON public.parents
FOR SELECT TO authenticated
USING ((private.current_user_role() = 'parent'::text) AND (id = private.current_parent_id()));

CREATE POLICY parents_select ON public.parents
FOR SELECT TO authenticated
USING (private.is_super_admin() OR (private.is_academy_owner() AND (academy_id = private.current_academy_id())) OR ((private.current_user_role() = 'coach'::text) AND (EXISTS ( SELECT 1
   FROM players p
  WHERE ((p.parent_id = parents.id) AND private.is_coach_assigned_to_batch(p.batch_id))))));

CREATE POLICY players_parent_select ON public.players
FOR SELECT TO authenticated
USING ((private.current_user_role() = 'parent'::text) AND (parent_id = private.current_parent_id()));

CREATE POLICY players_select ON public.players
FOR SELECT TO authenticated
USING (private.is_super_admin() OR (private.is_academy_owner() AND (academy_id = private.current_academy_id())) OR ((private.current_user_role() = 'coach'::text) AND private.is_coach_assigned_to_batch(batch_id)));
DO $verify$
DECLARE actual_count int;
BEGIN
 IF md5(pg_get_functiondef('private.current_parent_id()'::regprocedure))<>'5cd00d89a1a947ad5b9ee315bba211e2'
 THEN RAISE EXCEPTION 'AG3.4C2 source helper checksum mismatch'; END IF;
 SELECT count(*) INTO actual_count FROM pg_policies p JOIN
 (VALUES
 ('batches','batches_parent_select','7fa1a5d0550c9c2ffa87a02fb037fbd6'),
 ('batches','batches_select','cf0a63eba1272ab66cb4766b37057151'),
 ('parents','parents_parent_select','b865353d9d2219422abfc5728d5c96d5'),
 ('parents','parents_select','373e2e1995e7ab9e1b3500ed71da9e26'),
 ('players','players_parent_select','4727910545b4a4237a003ba156af09de'),
 ('players','players_select','0a877b1bd82f622f005c45fd9fd98cf5')
 ) AS expected(tablename,policyname,predicate_md5)
 ON p.tablename=expected.tablename AND p.policyname=expected.policyname
 WHERE p.schemaname='public' AND p.cmd='SELECT'
 AND p.roles='{authenticated}'::name[]
 AND md5(coalesce(p.qual,'')||chr(31)||coalesce(p.with_check,''))=expected.predicate_md5;
 IF actual_count<>6 OR
 (SELECT count(*) FROM pg_policies WHERE schemaname='public' AND tablename='batches')<>5 OR
 (SELECT count(*) FROM pg_policies WHERE schemaname='public' AND tablename='parents')<>2 OR
 (SELECT count(*) FROM pg_policies WHERE schemaname='public' AND tablename='players')<>2 OR
 (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='private')<>12
 OR (SELECT count(*) FROM public.parents WHERE is_active=true)<>3
 OR NOT has_table_privilege('authenticated','public.parents','SELECT')
 OR NOT has_table_privilege('authenticated','public.players','SELECT')
 OR has_table_privilege('anon','public.parents','SELECT')
 THEN RAISE EXCEPTION 'AG3.4C2 exact live policy checksum or ACL drift'; END IF;
END $verify$;
NOTIFY pgrst, 'reload schema';
COMMIT;
SELECT 'AG3.4C2 EXACT LIVE PARENT COACH SA SELECT POLICY PARITY INSTALLED' AS checkpoint;
