-- AG3.2: scratch-only Coach JWT/RLS test policy and invented assignments.
-- NEVER execute against hosted Supabase, Owner laptop, or historical migrations.
-- Requires real local GoTrue Coach A/B UUIDs and the approved AG3.1 policy.
-- Execute with psql --single-transaction -v ON_ERROR_STOP=1.
CREATE TEMP TABLE ag32_coach_targets ON COMMIT DROP AS
SELECT :'coach_a_uuid'::uuid AS coach_a, :'coach_b_uuid'::uuid AS coach_b;

DO $guard$
DECLARE n integer;
BEGIN
  IF current_database()<>'postgres' OR current_user<>'postgres'
     OR session_user<>'postgres' OR to_regclass('auth.users') IS NULL
     OR to_regnamespace('private') IS NULL
     OR to_regclass('public.players') IS NOT NULL
     OR to_regclass('public.payment_dues') IS NOT NULL
     OR to_regclass('public.subscription_periods') IS NOT NULL
  THEN RAISE EXCEPTION 'AG3.2: scratch-only Supabase guard failed'; END IF;
  IF (SELECT count(*) FROM pg_temp.ag32_coach_targets)<>1
     OR EXISTS (SELECT 1 FROM pg_temp.ag32_coach_targets WHERE coach_a=coach_b)
     OR (SELECT count(*) FROM auth.users)<>5
     OR (SELECT count(*) FROM public.users)<>2
     OR (SELECT count(*) FROM public.users WHERE role='academy_owner')<>2
     OR (SELECT count(*) FROM public.batches)<>2
     OR EXISTS (SELECT 1 FROM public.coaches)
     OR EXISTS (SELECT 1 FROM public.coach_batches)
     OR EXISTS (SELECT 1 FROM public.coach_batch_assignments)
     OR (SELECT count(*) FROM auth.users a JOIN pg_temp.ag32_coach_targets t
            ON a.id=t.coach_a WHERE a.email LIKE 'b29-ag32-coach-a-%@example.test')<>1
     OR (SELECT count(*) FROM auth.users a JOIN pg_temp.ag32_coach_targets t
            ON a.id=t.coach_b WHERE a.email LIKE 'b29-ag32-coach-b-%@example.test')<>1
  THEN RAISE EXCEPTION 'AG3.2: wrong synthetic identity or mapping baseline'; END IF;
  SELECT count(*) INTO n FROM pg_proc p
    JOIN pg_namespace ns ON ns.oid=p.pronamespace WHERE ns.nspname='private';
  IF n<>11 OR NOT has_schema_privilege('authenticated','private','USAGE')
     OR has_schema_privilege('anon','private','USAGE')
     OR NOT has_function_privilege('authenticated',
                  'private.is_coach_assigned_to_batch(uuid)','EXECUTE')
     OR NOT has_function_privilege('authenticated','private.is_coach()','EXECUTE')
     OR (SELECT count(*) FROM pg_policies
         WHERE schemaname='public' AND tablename='batches')<>1
     OR NOT EXISTS (SELECT 1 FROM pg_policies
         WHERE schemaname='public' AND tablename='batches'
           AND policyname='ag3_synthetic_owner_batch_read')
     OR NOT has_table_privilege('authenticated','public.batches','SELECT')
     OR has_table_privilege('anon','public.batches','SELECT')
     OR has_table_privilege('authenticated','public.coaches','SELECT')
     OR has_table_privilege('authenticated','public.coach_batches','SELECT')
     OR has_table_privilege('authenticated','public.coach_batch_assignments','SELECT')
  THEN RAISE EXCEPTION 'AG3.2: helper, RLS, or GRANT baseline changed'; END IF;
  SELECT count(*) INTO n FROM pg_class c JOIN pg_namespace ns ON ns.oid=c.relnamespace
    WHERE ns.nspname='public' AND c.relkind='r' AND c.relrowsecurity
      AND c.relname IN ('users','batches','coaches','coach_batches','coach_batch_assignments');
  IF n<>5 THEN RAISE EXCEPTION 'AG3.2: five synthetic tables must have RLS'; END IF;
END $guard$;

-- Additional batch in Academy A: Coach A has a legacy mapping, but it is INACTIVE.
INSERT INTO public.batches(id,center_id,academy_id)
VALUES ('b0000000-0000-4000-8000-000000000003',
        'c0000000-0000-4000-8000-000000000001',
        'a0000000-0000-4000-8000-000000000001');

INSERT INTO public.users(id,academy_id,role)
SELECT coach_a, 'a0000000-0000-4000-8000-000000000001'::uuid, 'coach'
  FROM pg_temp.ag32_coach_targets
UNION ALL
SELECT coach_b, 'a0000000-0000-4000-8000-000000000002'::uuid, 'coach'
  FROM pg_temp.ag32_coach_targets;

INSERT INTO public.coaches(id,user_id)
SELECT 'e0000000-0000-4000-8000-000000000001'::uuid, coach_a FROM pg_temp.ag32_coach_targets
UNION ALL
SELECT 'e0000000-0000-4000-8000-000000000002'::uuid, coach_b FROM pg_temp.ag32_coach_targets;

INSERT INTO public.coach_batches(id,coach_id,batch_id) VALUES
('f0000000-0000-4000-8000-000000000001',
 'e0000000-0000-4000-8000-000000000001',
 'b0000000-0000-4000-8000-000000000001'),
('f0000000-0000-4000-8000-000000000002',
 'e0000000-0000-4000-8000-000000000001',
 'b0000000-0000-4000-8000-000000000003'),
('f0000000-0000-4000-8000-000000000003',
 'e0000000-0000-4000-8000-000000000002',
 'b0000000-0000-4000-8000-000000000002');

INSERT INTO public.coach_batch_assignments(coach_id,batch_id,is_active) VALUES
('e0000000-0000-4000-8000-000000000001',
 'b0000000-0000-4000-8000-000000000001',true),
('e0000000-0000-4000-8000-000000000001',
 'b0000000-0000-4000-8000-000000000003',false),
('e0000000-0000-4000-8000-000000000002',
 'b0000000-0000-4000-8000-000000000002',true);

-- The existing AG3.1 SELECT grant remains limited to batches. No new table GRANT.
-- Pinned current helper checks coach identity AND active assignment. The added
-- academy predicate is test-only defense in depth, not a claim about live policy.
CREATE POLICY ag32_synthetic_coach_batch_read
ON public.batches FOR SELECT TO authenticated
USING (
   (SELECT private.is_coach())
   AND academy_id=(SELECT private.current_academy_id())
   AND private.is_coach_assigned_to_batch(id)
);

DO $verify$
DECLARE n integer;
BEGIN
  IF (SELECT count(*) FROM auth.users)<>5
     OR (SELECT count(*) FROM public.users)<>4
     OR (SELECT count(*) FROM public.users WHERE role='coach')<>2
     OR (SELECT count(*) FROM public.batches)<>3
     OR (SELECT count(*) FROM public.coaches)<>2
     OR (SELECT count(*) FROM public.coach_batches)<>3
     OR (SELECT count(*) FROM public.coach_batch_assignments)<>3
     OR (SELECT count(*) FROM public.coach_batch_assignments WHERE is_active)<>2
     OR (SELECT count(*) FROM pg_policies WHERE schemaname='public'
         AND tablename='batches')<>2
     OR (SELECT count(*) FROM pg_policies WHERE schemaname='public'
         AND tablename='batches'
         AND policyname='ag32_synthetic_coach_batch_read' AND cmd='SELECT')<>1
     OR has_table_privilege('anon','public.batches','SELECT')
     OR has_table_privilege('authenticated','public.batches','INSERT')
     OR has_table_privilege('authenticated','public.batches','UPDATE')
     OR has_table_privilege('authenticated','public.batches','DELETE')
     OR has_table_privilege('authenticated','public.coach_batches','SELECT')
     OR has_table_privilege('authenticated','public.coach_batch_assignments','SELECT')
     OR has_table_privilege('authenticated','public.users','SELECT')
  THEN RAISE EXCEPTION 'AG3.2: postflight count, policy, or GRANT failure'; END IF;
  SELECT count(*) INTO n FROM pg_proc p JOIN pg_namespace ns
  ON ns.oid=p.pronamespace WHERE ns.nspname='private';
  IF n<>11 THEN RAISE EXCEPTION 'AG3.2: pinned helpers changed'; END IF;
END $verify$;

NOTIFY pgrst, 'reload schema';
SELECT 'AG3.2 SYNTHETIC COACH SCOPE VERIFIED' AS checkpoint;
