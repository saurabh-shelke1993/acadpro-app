-- AG3.4D1: exact live financial SELECT/ALL policy predicates (scratch-only).
-- Requires successful AG3.4C2 real GoTrue source-aligned role bootstrap, plus
-- eight NEW GoTrue IDs for separate finance role sessions.
-- NO hosted Supabase, no original migrations, no billing/payment side-effects.
BEGIN;
DO $guard$
BEGIN
 IF current_database()<>'postgres' OR current_user<>'postgres' OR session_user<>'postgres'
    OR to_regclass('auth.users') IS NULL OR to_regclass('public.payments') IS NOT NULL
    OR to_regclass('public.payment_dues') IS NOT NULL
    OR to_regclass('public.parent_payment_submissions') IS NOT NULL
    OR to_regclass('public.subscription_periods') IS NOT NULL
    OR (SELECT count(*) FROM auth.users)<>17
    OR (SELECT count(*) FROM public.users)<>8
    OR (SELECT count(*) FROM public.parents)<>3
    OR (SELECT count(*) FROM public.players)<>3
    OR (SELECT count(*) FROM pg_policies WHERE schemaname='public' AND tablename='parents')<>2
    OR (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='private')<>12
 THEN RAISE EXCEPTION 'AG3.4D1 refuses non-disposable or unexpected role baseline'; END IF;
END $guard$;

-- Exact verified foreign-key-shaped reference columns only, NOT full hosted schema.
CREATE TABLE public.payment_dues(id uuid PRIMARY KEY,player_id uuid NOT NULL REFERENCES public.players(id));
CREATE TABLE public.payments(id uuid PRIMARY KEY,player_id uuid NOT NULL REFERENCES public.players(id));
CREATE TABLE public.parent_payment_submissions(
 id uuid PRIMARY KEY, academy_id uuid NOT NULL, parent_id uuid NOT NULL REFERENCES public.parents(id),
 player_id uuid NOT NULL REFERENCES public.players(id));
ALTER TABLE public.payment_dues ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parent_payment_submissions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.payment_dues,public.payments,public.parent_payment_submissions
 FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT ON public.payment_dues,public.payments,public.parent_payment_submissions TO authenticated;

-- New signed Auth accounts are mapped *in scratch only*.
INSERT INTO public.users(id,academy_id,role)
VALUES
(:'parent_a1_uuid'::uuid,'a0000000-0000-4000-8000-000000000001','parent'),
(:'parent_a2_uuid'::uuid,'a0000000-0000-4000-8000-000000000001','parent'),
(:'parent_b_uuid'::uuid,'a0000000-0000-4000-8000-000000000002','parent'),
(:'owner_a_uuid'::uuid,'a0000000-0000-4000-8000-000000000001','academy_owner'),
(:'owner_b_uuid'::uuid,'a0000000-0000-4000-8000-000000000002','academy_owner'),
(:'coach_a_uuid'::uuid,'a0000000-0000-4000-8000-000000000001','coach'),
(:'coach_b_uuid'::uuid,'a0000000-0000-4000-8000-000000000002','coach'),
(:'super_admin_uuid'::uuid,NULL,'super_admin');

UPDATE public.parents SET user_id=CASE id
 WHEN 'd0000000-0000-4000-8000-000000000011'::uuid THEN :'parent_a1_uuid'::uuid
 WHEN 'd0000000-0000-4000-8000-000000000012'::uuid THEN :'parent_a2_uuid'::uuid
 WHEN 'd0000000-0000-4000-8000-000000000013'::uuid THEN :'parent_b_uuid'::uuid
 ELSE user_id END;

INSERT INTO public.payment_dues(id,player_id) VALUES
('d2000000-0000-4000-8000-000000000011','f1000000-0000-4000-8000-000000000011'),
('d2000000-0000-4000-8000-000000000012','f1000000-0000-4000-8000-000000000012'),
('d2000000-0000-4000-8000-000000000013','f1000000-0000-4000-8000-000000000013');
INSERT INTO public.payments(id,player_id) VALUES
('d3000000-0000-4000-8000-000000000011','f1000000-0000-4000-8000-000000000011'),
('d3000000-0000-4000-8000-000000000012','f1000000-0000-4000-8000-000000000012'),
('d3000000-0000-4000-8000-000000000013','f1000000-0000-4000-8000-000000000013');
INSERT INTO public.parent_payment_submissions(id,academy_id,parent_id,player_id) VALUES
('d4000000-0000-4000-8000-000000000011','a0000000-0000-4000-8000-000000000001',
 'd0000000-0000-4000-8000-000000000011','f1000000-0000-4000-8000-000000000011'),
('d4000000-0000-4000-8000-000000000012','a0000000-0000-4000-8000-000000000001',
 'd0000000-0000-4000-8000-000000000012','f1000000-0000-4000-8000-000000000012'),
('d4000000-0000-4000-8000-000000000013','a0000000-0000-4000-8000-000000000002',
 'd0000000-0000-4000-8000-000000000013','f1000000-0000-4000-8000-000000000013');

-- Additional functions copied from deployed pg_get_functiondef. Count and MD5 pinned.
CREATE OR REPLACE FUNCTION private.is_parent_of_player(p_player_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'private', 'pg_catalog'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.players p
    WHERE p.id = p_player_id
      AND p.parent_id = private.current_parent_id()
  );
$function$;

CREATE OR REPLACE FUNCTION private.is_parent_payment_due(p_player_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'private', 'pg_catalog'
AS $function$
  SELECT private.is_parent_of_player(p_player_id);
$function$;

CREATE OR REPLACE FUNCTION private.is_parent_payment_player(p_player_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'private', 'pg_catalog'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.players p
    WHERE p.id = p_player_id
      AND p.parent_id = private.current_parent_id()
  );
$function$;

CREATE OR REPLACE FUNCTION private.is_player_in_current_academy(p_player_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'private', 'pg_catalog'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.players p
    WHERE p.id = p_player_id
      AND p.academy_id = private.current_academy_id()
  );
$function$;

CREATE OR REPLACE FUNCTION private.is_payment_due_in_current_academy(p_player_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'private', 'pg_catalog'
AS $function$
  SELECT private.is_player_in_current_academy(p_player_id);
$function$;

CREATE OR REPLACE FUNCTION private.is_payment_player_in_current_academy(p_player_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'private', 'pg_catalog'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.players p
    WHERE p.id = p_player_id
      AND p.academy_id = private.current_academy_id()
  );
$function$;

-- Exact hosted pg_policies.qual/with_check. SQL parentheses wrap expressions for CREATE POLICY grammar.
CREATE POLICY parent_payment_submissions_select_academy_owner ON public.parent_payment_submissions
FOR SELECT TO authenticated
USING ((( SELECT private.is_academy_owner() AS is_academy_owner) AND (academy_id = ( SELECT private.current_academy_id() AS current_academy_id))));

CREATE POLICY parent_payment_submissions_select_parent ON public.parent_payment_submissions
FOR SELECT TO authenticated
USING ((EXISTS ( SELECT 1
   FROM parents parent_record
  WHERE ((parent_record.id = parent_payment_submissions.parent_id) AND (parent_record.user_id = ( SELECT auth.uid() AS uid))))));

CREATE POLICY parent_payment_submissions_select_super_admin ON public.parent_payment_submissions
FOR SELECT TO authenticated
USING (( SELECT private.is_super_admin() AS is_super_admin));

CREATE POLICY payment_dues_academy_owner_select ON public.payment_dues
FOR SELECT TO authenticated
USING ((private.is_academy_owner() AND private.is_payment_due_in_current_academy(player_id)));

CREATE POLICY payment_dues_parent_select ON public.payment_dues
FOR SELECT TO authenticated
USING (((private.current_user_role() = 'parent'::text) AND private.is_parent_payment_due(player_id)));

CREATE POLICY payment_dues_super_admin_all ON public.payment_dues
FOR ALL TO authenticated
USING (private.is_super_admin())
WITH CHECK (private.is_super_admin());

CREATE POLICY payments_academy_owner_select ON public.payments
FOR SELECT TO authenticated
USING ((private.is_academy_owner() AND private.is_payment_player_in_current_academy(player_id)));

CREATE POLICY payments_parent_select ON public.payments
FOR SELECT TO authenticated
USING (((private.current_user_role() = 'parent'::text) AND private.is_parent_payment_player(player_id)));

CREATE POLICY payments_super_admin_select ON public.payments
FOR SELECT TO authenticated
USING (( SELECT private.is_super_admin() AS is_super_admin));

DO $verify$
DECLARE np int; nf int;
BEGIN
 SELECT count(*) INTO np FROM pg_policies p JOIN (VALUES
 ('parent_payment_submissions','parent_payment_submissions_select_academy_owner','22c3ede2ee614dd71b4881495daec65c'),
 ('parent_payment_submissions','parent_payment_submissions_select_parent','13dc64c608b5bede6583fd67f446b7a2'),
 ('parent_payment_submissions','parent_payment_submissions_select_super_admin','7c4a8160490ebda235f853ef8ff0ac96'),
 ('payment_dues','payment_dues_academy_owner_select','1259fd984f591d423b30cd6314b2e500'),
 ('payment_dues','payment_dues_parent_select','78a18a3f86c931b83952357bb42c2698'),
 ('payment_dues','payment_dues_super_admin_all','9f20ef9d8679e2dc9f5e9f526acb160d'),
 ('payments','payments_academy_owner_select','74bd51c145bf8bd19242ce9a8cf50b7a'),
 ('payments','payments_parent_select','e782c7c9df39c1d97fa58fcf234c42d0'),
 ('payments','payments_super_admin_select','7c4a8160490ebda235f853ef8ff0ac96')
 ) AS desired(table_name,policy_name,policy_md5)
 ON p.tablename=desired.table_name AND p.policyname=desired.policy_name
 WHERE p.schemaname='public'
 AND md5(coalesce(p.qual,'')||chr(31)||coalesce(p.with_check,''))=desired.policy_md5;
 SELECT count(*) INTO nf FROM pg_proc fn
 JOIN pg_namespace nsp ON nsp.oid=fn.pronamespace AND nsp.nspname='private'
 JOIN (VALUES
 ('private.is_parent_of_player(uuid)','dbab5d5bf4fb58c7990b7135e4cf8e9d'),
 ('private.is_parent_payment_due(uuid)','d4f7787396135c9fadaea1fb89036b33'),
 ('private.is_parent_payment_player(uuid)','a9e2986ca1e2fab5289a1c76ea4b44a1'),
 ('private.is_payment_due_in_current_academy(uuid)','5d0c0cdff8aecf9f409bb2713e6533c9'),
 ('private.is_payment_player_in_current_academy(uuid)','1a5dd4089ff771eccec5e0a27d6d2f0e'),
 ('private.is_player_in_current_academy(uuid)','29469e670d9e7610a67603c1245eed91')
 ) AS desired(signature,definition_md5)
 ON fn.oid::regprocedure::text=desired.signature
 WHERE md5(pg_get_functiondef(fn.oid))=desired.definition_md5;
 IF np<>9 OR nf<>6 OR
 (SELECT count(*) FROM pg_proc fn JOIN pg_namespace n ON n.oid=fn.pronamespace WHERE n.nspname='private')<>18
 OR (SELECT count(*) FROM auth.users)<>17 OR (SELECT count(*) FROM public.users)<>16
 OR (SELECT count(*) FROM public.payment_dues)<>3
 OR (SELECT count(*) FROM public.payments)<>3
 OR (SELECT count(*) FROM public.parent_payment_submissions)<>3
 OR (SELECT count(*) FROM pg_policies WHERE schemaname='public' AND tablename='payment_dues')<>3
 OR (SELECT count(*) FROM pg_policies WHERE schemaname='public' AND tablename='payments')<>3
 OR (SELECT count(*) FROM pg_policies WHERE schemaname='public' AND tablename='parent_payment_submissions')<>3
 OR has_table_privilege('authenticated','public.payments','INSERT')
 OR has_table_privilege('authenticated','public.payment_dues','UPDATE')
 OR has_table_privilege('anon','public.payments','SELECT')
 THEN RAISE EXCEPTION 'AG3.4D1 live finance source checksum/ACL mismatch'; END IF;
END $verify$;
NOTIFY pgrst, 'reload schema';
COMMIT;
SELECT 'AG3.4D1 REAL FINANCE SELECT POLICY PARITY INSTALLED IN SCRATCH' AS checkpoint;
