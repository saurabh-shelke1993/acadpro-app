-- AG3.1: CI-only synthetic Academy Owner RLS against real signed JWTs.
-- NEVER run against hosted Supabase, canonical migrations, or Owner's laptop DB.
-- The real product's full RLS schema and policy timing are NOT verified here.
-- Run with psql --single-transaction -v ON_ERROR_STOP=1 in AG3 CI ONLY.
DO $guard$
DECLARE n integer;
BEGIN
  IF current_database() <> 'postgres' OR current_user <> 'postgres'
     OR session_user <> 'postgres'
     OR to_regclass('auth.users') IS NULL
     OR to_regprocedure('auth.uid()') IS NULL
     OR to_regnamespace('private') IS NULL
     OR to_regclass('public.players') IS NOT NULL
     OR to_regclass('public.payment_dues') IS NOT NULL
  THEN RAISE EXCEPTION 'AG3: not disposable synthetic Supabase; refuse'; END IF;
  IF (SELECT count(*) FROM auth.users) <> 3
     OR (SELECT count(*) FROM public.users) <> 2
     OR (SELECT count(*) FROM public.batches) <> 2
     OR (SELECT count(*) FROM public.coaches) <> 0
     OR (SELECT count(*) FROM public.coach_batches) <> 0
     OR (SELECT count(*) FROM public.coach_batch_assignments) <> 0
  THEN RAISE EXCEPTION 'AG3: unexpected prerequisite synthetic counts'; END IF;
  IF (SELECT count(*) FROM public.users
      WHERE role='academy_owner' AND academy_id='a0000000-0000-4000-8000-000000000001'::uuid)<>1
     OR (SELECT count(*) FROM public.users
      WHERE role='academy_owner' AND academy_id='a0000000-0000-4000-8000-000000000002'::uuid)<>1
     OR (SELECT count(*) FROM public.batches
      WHERE academy_id IN ('a0000000-0000-4000-8000-000000000001'::uuid,
                           'a0000000-0000-4000-8000-000000000002'::uuid))<>2
  THEN RAISE EXCEPTION 'AG3: Academy A/B synthetic roles or rows wrong'; END IF;
  SELECT count(*) INTO n FROM pg_proc p JOIN pg_namespace ns ON ns.oid=p.pronamespace
   WHERE ns.nspname='private';
  IF n <> 11
     OR NOT has_schema_privilege('authenticated','private','USAGE')
     OR has_schema_privilege('anon','private','USAGE')
     OR NOT has_function_privilege('authenticated',
           'private.current_academy_id()','EXECUTE')
     OR NOT has_function_privilege('authenticated',
           'private.is_academy_owner()','EXECUTE')
  THEN RAISE EXCEPTION 'AG3: pinned helper/ACL preconditions failed'; END IF;
  SELECT count(*) INTO n FROM pg_class c JOIN pg_namespace ns ON ns.oid=c.relnamespace
   WHERE ns.nspname='public' AND c.relkind='r' AND c.relrowsecurity
   AND c.relname IN ('users','batches','coaches','coach_batches','coach_batch_assignments');
  IF n <> 5
     OR EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='batches')
     OR has_table_privilege('authenticated','public.batches','SELECT')
     OR has_table_privilege('anon','public.batches','SELECT')
  THEN RAISE EXCEPTION 'AG3: RLS baseline or client grants wrong'; END IF;
END $guard$;

-- ONLY grant this one synthetic table read access so PostgREST invokes RLS.
-- All other table privileges and write operations remain unchanged/denied.
GRANT SELECT ON TABLE public.batches TO authenticated;

CREATE POLICY ag3_synthetic_owner_batch_read
ON public.batches
FOR SELECT TO authenticated
USING (
    (SELECT private.is_academy_owner())
    AND academy_id = (SELECT private.current_academy_id())
);

DO $postcheck$
DECLARE n integer;
BEGIN
  SELECT count(*) INTO n FROM pg_policies
    WHERE schemaname='public' AND tablename='batches'
      AND policyname='ag3_synthetic_owner_batch_read'
      AND cmd='SELECT' AND permissive='PERMISSIVE';
  IF n<>1
     OR (SELECT count(*) FROM pg_policies
         WHERE schemaname='public' AND tablename='batches')<>1
     OR NOT has_table_privilege('authenticated','public.batches','SELECT')
     OR has_table_privilege('anon','public.batches','SELECT')
     OR has_table_privilege('authenticated','public.batches','INSERT')
     OR has_table_privilege('authenticated','public.batches','UPDATE')
     OR has_table_privilege('authenticated','public.batches','DELETE')
     OR has_table_privilege('authenticated','public.users','SELECT')
     OR (SELECT count(*) FROM public.batches)<>2
  THEN RAISE EXCEPTION 'AG3: synthetic read-only policy check failed'; END IF;
END $postcheck$;

-- PostgREST may have loaded its schema cache before the synthetic tables existed.
NOTIFY pgrst, 'reload schema';
SELECT 'AG3 SYNTHETIC OWNER RLS POLICY VERIFIED' AS checkpoint;
