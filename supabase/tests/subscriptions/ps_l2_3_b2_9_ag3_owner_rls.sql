-- AG3: strictly disposable CI-only RLS fixture for the five synthetic B2.9 tables.
-- NEVER place in canonical migrations or apply to hosted Supabase.
-- This is a test of the pinned current-state owner helpers, not proof that
-- the complete production Kheltriva application policies match this fixture.
DO $ag3_before$
DECLARE policy_count integer;
BEGIN
  IF current_database() <> 'postgres' OR current_user <> 'postgres'
    OR session_user <> 'postgres'
    OR to_regclass('auth.users') IS NULL
    OR to_regprocedure('auth.uid()') IS NULL
    OR to_regnamespace('private') IS NULL
    OR to_regclass('public.players') IS NOT NULL
    OR to_regclass('public.payment_dues') IS NOT NULL
  THEN RAISE EXCEPTION 'AG3: expected disposable native Supabase schema only'; END IF;

  IF (SELECT count(*) FROM auth.users) <> 3
    OR (SELECT count(*) FROM public.users) <> 2
    OR (SELECT count(*) FROM public.batches) <> 2
    OR (SELECT count(*) FROM public.coaches) <> 0
    OR (SELECT count(*) FROM public.coach_batches) <> 0
    OR (SELECT count(*) FROM public.coach_batch_assignments) <> 0
    OR (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
        WHERE n.nspname='private') <> 11
  THEN RAISE EXCEPTION 'AG3: unexpected owner/fixture/helper preconditions'; END IF;

  IF (SELECT count(*) FROM public.users WHERE role='academy_owner'
      AND academy_id='a0000000-0000-4000-8000-000000000001'::uuid) <> 1
    OR (SELECT count(*) FROM public.users WHERE role='academy_owner'
      AND academy_id='a0000000-0000-4000-8000-000000000002'::uuid) <> 1
    OR (SELECT count(*) FROM public.batches WHERE
      (id='b0000000-0000-4000-8000-000000000001'::uuid AND
       academy_id='a0000000-0000-4000-8000-000000000001'::uuid) OR
      (id='b0000000-0000-4000-8000-000000000002'::uuid AND
       academy_id='a0000000-0000-4000-8000-000000000002'::uuid)) <> 2
  THEN RAISE EXCEPTION 'AG3: synthetic academy mapping incorrect'; END IF;

  SELECT count(*) INTO policy_count FROM pg_policy p
  JOIN pg_class c ON c.oid=p.polrelid
  JOIN pg_namespace n ON n.oid=c.relnamespace
  WHERE n.nspname='public' AND c.relname IN
    ('users','batches','coaches','coach_batches','coach_batch_assignments');
  IF policy_count <> 0
    OR NOT (SELECT bool_and(c.relrowsecurity) FROM pg_class c
      WHERE c.oid IN ('public.users'::regclass, 'public.batches'::regclass,
        'public.coaches'::regclass, 'public.coach_batches'::regclass,
        'public.coach_batch_assignments'::regclass))
    OR has_table_privilege('anon','public.batches','SELECT')
    OR has_table_privilege('authenticated','public.batches','SELECT')
    OR has_table_privilege('authenticated','public.users','SELECT')
  THEN RAISE EXCEPTION 'AG3: unexpected synthetic RLS policy/grant state'; END IF;
END $ag3_before$;

-- Narrow synthetic read-only client grant. RLS filters eligible rows.
GRANT SELECT ON TABLE public.batches TO authenticated;
CREATE POLICY ag3_test_owner_scoped_batches_select
  ON public.batches
  FOR SELECT TO authenticated
  USING (
    (SELECT private.is_academy_owner())
    AND academy_id = (SELECT private.current_academy_id())
  );

DO $ag3_after$
DECLARE policy_count integer;
BEGIN
  SELECT count(*) INTO policy_count
  FROM pg_policy p
  WHERE p.polrelid='public.batches'::regclass
    AND p.polname='ag3_test_owner_scoped_batches_select'
    AND p.polcmd='r'
    AND p.polroles=ARRAY[(SELECT oid FROM pg_roles WHERE rolname='authenticated')]::oid[]
    AND pg_get_expr(p.polqual,p.polrelid) LIKE '%is_academy_owner%'
    AND pg_get_expr(p.polqual,p.polrelid) LIKE '%current_academy_id%';

  IF policy_count <> 1
    OR (SELECT count(*) FROM pg_policy p WHERE p.polrelid='public.batches'::regclass) <> 1
    OR NOT has_table_privilege('authenticated','public.batches','SELECT')
    OR has_table_privilege('anon','public.batches','SELECT')
    OR has_table_privilege('authenticated','public.batches','INSERT')
    OR has_table_privilege('authenticated','public.batches','UPDATE')
    OR has_table_privilege('authenticated','public.batches','DELETE')
    OR has_table_privilege('authenticated','public.users','SELECT')
    OR (SELECT count(*) FROM public.users) <> 2
    OR (SELECT count(*) FROM auth.users) <> 3
  THEN RAISE EXCEPTION 'AG3: test-only policy/grant postconditions failed'; END IF;
END $ag3_after$;

-- PostgREST started before fixture DDL and needs to discover public.batches.
NOTIFY pgrst, 'reload schema';
SELECT 'AG3 OWNER RLS POLICY VERIFIED' AS checkpoint;
