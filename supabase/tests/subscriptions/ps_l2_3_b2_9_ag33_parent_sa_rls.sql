-- AG3.3: disposable-only Parent linked-player + Super Admin role RLS fixture.
-- NEW nonhistorical synthetic policies, NOT production-policy parity.
-- NEVER run against hosted Supabase, Owner laptop, or canonical migrations.
-- Requires AG3.2 scratch state and 4 actual GoTrue-issued Auth UUIDs.
-- Run via psql --single-transaction -v ON_ERROR_STOP=1.
CREATE TEMP TABLE ag33_auth_targets ON COMMIT DROP AS
SELECT :'parent_a1_uuid'::uuid AS parent_a1,
       :'parent_a2_uuid'::uuid AS parent_a2,
       :'parent_b_uuid'::uuid AS parent_b,
       :'super_admin_uuid'::uuid AS super_admin;

DO $guard$
DECLARE helper_count integer;
BEGIN
 IF current_database()<>'postgres' OR current_user<>'postgres'
    OR session_user<>'postgres' OR to_regclass('auth.users') IS NULL
    OR to_regprocedure('auth.uid()') IS NULL
    OR to_regnamespace('private') IS NULL
    OR to_regclass('public.parents') IS NOT NULL
    OR to_regclass('public.players') IS NOT NULL
    OR to_regclass('public.payment_dues') IS NOT NULL
    OR to_regclass('public.subscription_periods') IS NOT NULL
 THEN RAISE EXCEPTION 'AG3.3: non-disposable schema; stop'; END IF;

 IF (SELECT count(DISTINCT u) FROM (
       SELECT parent_a1 AS u FROM pg_temp.ag33_auth_targets UNION ALL
       SELECT parent_a2 FROM pg_temp.ag33_auth_targets UNION ALL
       SELECT parent_b FROM pg_temp.ag33_auth_targets UNION ALL
       SELECT super_admin FROM pg_temp.ag33_auth_targets
     ) s)<>4
    OR (SELECT count(*) FROM auth.users)<>9
    OR (SELECT count(*) FROM public.users)<>4
    OR (SELECT count(*) FROM public.users WHERE role='academy_owner')<>2
    OR (SELECT count(*) FROM public.users WHERE role='coach')<>2
    OR (SELECT count(*) FROM public.batches)<>3
    OR (SELECT count(*) FROM public.coaches)<>2
    OR (SELECT count(*) FROM public.coach_batches)<>3
    OR (SELECT count(*) FROM public.coach_batch_assignments)<>3
    OR (SELECT count(*) FROM pg_policies WHERE schemaname='public' AND tablename='batches')<>2
    OR NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public'
         AND tablename='batches' AND policyname='ag3_synthetic_owner_batch_read')
    OR NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public'
         AND tablename='batches' AND policyname='ag32_synthetic_coach_batch_read')
 THEN RAISE EXCEPTION 'AG3.3: expected AG3.2 synthetic baseline absent'; END IF;

 IF (SELECT count(*) FROM auth.users a JOIN pg_temp.ag33_auth_targets x
       ON a.id=x.parent_a1 WHERE a.email LIKE 'b29-ag33-parent-a1-%@example.test')<>1
    OR (SELECT count(*) FROM auth.users a JOIN pg_temp.ag33_auth_targets x
       ON a.id=x.parent_a2 WHERE a.email LIKE 'b29-ag33-parent-a2-%@example.test')<>1
    OR (SELECT count(*) FROM auth.users a JOIN pg_temp.ag33_auth_targets x
       ON a.id=x.parent_b WHERE a.email LIKE 'b29-ag33-parent-b-%@example.test')<>1
    OR (SELECT count(*) FROM auth.users a JOIN pg_temp.ag33_auth_targets x
       ON a.id=x.super_admin WHERE a.email LIKE 'b29-ag33-super-admin-%@example.test')<>1
 THEN RAISE EXCEPTION 'AG3.3: real Auth identities do not match approved labels'; END IF;

 SELECT count(*) INTO helper_count FROM pg_proc p
   JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='private';
 IF helper_count<>11
    OR NOT has_schema_privilege('authenticated','private','USAGE')
    OR has_schema_privilege('anon','private','USAGE')
    OR NOT has_function_privilege('authenticated','private.is_super_admin()','EXECUTE')
    OR NOT has_function_privilege('authenticated','private.current_user_role()','EXECUTE')
    OR NOT has_table_privilege('authenticated','public.batches','SELECT')
    OR has_table_privilege('anon','public.batches','SELECT')
    OR has_table_privilege('authenticated','public.batches','INSERT')
    OR has_table_privilege('authenticated','public.batches','UPDATE')
    OR has_table_privilege('authenticated','public.batches','DELETE')
 THEN RAISE EXCEPTION 'AG3.3: pinned helper/client GRANT drift'; END IF;
END $guard$;

-- Four additional real GoTrue UUIDs mapped to application roles (scratch only).
INSERT INTO public.users(id,academy_id,role)
SELECT parent_a1,'a0000000-0000-4000-8000-000000000001'::uuid,'parent'
FROM pg_temp.ag33_auth_targets
UNION ALL
SELECT parent_a2,'a0000000-0000-4000-8000-000000000001'::uuid,'parent'
FROM pg_temp.ag33_auth_targets
UNION ALL
SELECT parent_b,'a0000000-0000-4000-8000-000000000002'::uuid,'parent'
FROM pg_temp.ag33_auth_targets
UNION ALL
SELECT super_admin,NULL::uuid,'super_admin'
FROM pg_temp.ag33_auth_targets;

-- Reflect the verified *relation chain*, not the complete hosted schema.
CREATE TABLE public.parents (
 id uuid PRIMARY KEY,
 user_id uuid NOT NULL UNIQUE REFERENCES public.users(id),
 academy_id uuid NOT NULL
);
CREATE TABLE public.players (
 id uuid PRIMARY KEY,
 parent_id uuid NOT NULL REFERENCES public.parents(id),
 batch_id uuid NOT NULL REFERENCES public.batches(id),
 academy_id uuid NOT NULL
);
ALTER TABLE public.parents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.parents,public.players
 FROM PUBLIC,anon,authenticated,service_role;

INSERT INTO public.parents(id,user_id,academy_id)
SELECT 'd0000000-0000-4000-8000-000000000011'::uuid,parent_a1,
       'a0000000-0000-4000-8000-000000000001'::uuid
FROM pg_temp.ag33_auth_targets
UNION ALL
SELECT 'd0000000-0000-4000-8000-000000000012'::uuid,parent_a2,
       'a0000000-0000-4000-8000-000000000001'::uuid
FROM pg_temp.ag33_auth_targets
UNION ALL
SELECT 'd0000000-0000-4000-8000-000000000013'::uuid,parent_b,
       'a0000000-0000-4000-8000-000000000002'::uuid
FROM pg_temp.ag33_auth_targets;

INSERT INTO public.players(id,parent_id,batch_id,academy_id) VALUES
('f1000000-0000-4000-8000-000000000011',
 'd0000000-0000-4000-8000-000000000011',
 'b0000000-0000-4000-8000-000000000001',
 'a0000000-0000-4000-8000-000000000001'),
('f1000000-0000-4000-8000-000000000012',
 'd0000000-0000-4000-8000-000000000012',
 'b0000000-0000-4000-8000-000000000003',
 'a0000000-0000-4000-8000-000000000001'),
('f1000000-0000-4000-8000-000000000013',
 'd0000000-0000-4000-8000-000000000013',
 'b0000000-0000-4000-8000-000000000002',
 'a0000000-0000-4000-8000-000000000002');

-- New minimal SELECT surfaces for linked parent and SA (RLS is mandatory).
GRANT SELECT ON TABLE public.parents,public.players TO authenticated;
CREATE POLICY ag33_synthetic_parent_record_read
 ON public.parents FOR SELECT TO authenticated
 USING ((SELECT private.is_super_admin())
        OR ((SELECT private.current_user_role())='parent'
            AND user_id=(SELECT auth.uid())));
CREATE POLICY ag33_synthetic_linked_player_read
 ON public.players FOR SELECT TO authenticated
 USING ((SELECT private.is_super_admin())
        OR ((SELECT private.current_user_role())='parent'
            AND EXISTS (SELECT 1 FROM public.parents pr
                WHERE pr.id=players.parent_id AND pr.user_id=(SELECT auth.uid()))));

CREATE POLICY ag33_synthetic_parent_batch_read
 ON public.batches FOR SELECT TO authenticated
 USING ((SELECT private.current_user_role())='parent'
        AND EXISTS (SELECT 1 FROM public.players p
             JOIN public.parents pr ON pr.id=p.parent_id
             WHERE p.batch_id=batches.id AND pr.user_id=(SELECT auth.uid())));
CREATE POLICY ag33_synthetic_super_admin_batch_read
 ON public.batches FOR SELECT TO authenticated
 USING ((SELECT private.is_super_admin()));

-- Test-only Authenticated table GRANT is always controlled by SA-only RLS.
-- This validates actual SA CRUD and non-SA write denial by RLS, not missing GRANT.
GRANT INSERT,UPDATE,DELETE ON TABLE public.batches TO authenticated;
CREATE POLICY ag33_synthetic_super_admin_batch_insert
 ON public.batches FOR INSERT TO authenticated
 WITH CHECK ((SELECT private.is_super_admin()));
CREATE POLICY ag33_synthetic_super_admin_batch_update
 ON public.batches FOR UPDATE TO authenticated
 USING ((SELECT private.is_super_admin()))
 WITH CHECK ((SELECT private.is_super_admin()));
CREATE POLICY ag33_synthetic_super_admin_batch_delete
 ON public.batches FOR DELETE TO authenticated
 USING ((SELECT private.is_super_admin()));

DO $verify$
DECLARE n integer;
BEGIN
 IF (SELECT count(*) FROM auth.users)<>9
    OR (SELECT count(*) FROM public.users)<>8
    OR (SELECT count(*) FROM public.users WHERE role='parent')<>3
    OR (SELECT count(*) FROM public.users WHERE role='super_admin')<>1
    OR (SELECT count(*) FROM public.parents)<>3
    OR (SELECT count(*) FROM public.players)<>3
    OR (SELECT count(*) FROM public.batches)<>3
    OR (SELECT count(*) FROM pg_policies WHERE schemaname='public'
        AND tablename='batches')<>7
    OR (SELECT count(*) FROM pg_policies WHERE schemaname='public'
        AND tablename='parents')<>1
    OR (SELECT count(*) FROM pg_policies WHERE schemaname='public'
        AND tablename='players')<>1
    OR NOT has_table_privilege('authenticated','public.parents','SELECT')
    OR NOT has_table_privilege('authenticated','public.players','SELECT')
    OR NOT has_table_privilege('authenticated','public.batches','INSERT')
    OR NOT has_table_privilege('authenticated','public.batches','UPDATE')
    OR NOT has_table_privilege('authenticated','public.batches','DELETE')
    OR has_table_privilege('authenticated','public.players','INSERT')
    OR has_table_privilege('authenticated','public.players','UPDATE')
    OR has_table_privilege('authenticated','public.parents','DELETE')
    OR has_table_privilege('anon','public.parents','SELECT')
    OR has_table_privilege('anon','public.players','SELECT')
    OR has_table_privilege('anon','public.batches','SELECT')
 THEN RAISE EXCEPTION 'AG3.3: role, row, policy or GRANT postflight mismatch'; END IF;
 SELECT count(*) INTO n FROM pg_class c JOIN pg_namespace ns
 ON ns.oid=c.relnamespace WHERE ns.nspname='public' AND c.relkind='r'
 AND c.relrowsecurity AND c.relname IN
 ('users','batches','coaches','coach_batches','coach_batch_assignments',
  'parents','players');
 IF n<>7 THEN RAISE EXCEPTION 'AG3.3: seven synthetic app tables must use RLS'; END IF;
 SELECT count(*) INTO n FROM pg_proc p JOIN pg_namespace ns
 ON ns.oid=p.pronamespace WHERE ns.nspname='private';
 IF n<>11 THEN RAISE EXCEPTION 'AG3.3: pinned private helpers changed'; END IF;
END $verify$;
NOTIFY pgrst, 'reload schema';
SELECT 'AG3.3 SYNTHETIC PARENT AND SUPER ADMIN SCOPE VERIFIED' AS checkpoint;
