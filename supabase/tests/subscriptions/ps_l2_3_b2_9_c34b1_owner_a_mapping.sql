-- B2.9-C3.4B1 Owner A mapping: disposable LOCAL Supabase only.
-- Run only in the pinned scratch database using psql -v owner_uuid=<UUID> -1.
-- This NEVER creates Auth users; GoTrue has already created this test UUID.
-- This never grants client access, creates an RLS policy, or touches production.
CREATE TEMP TABLE b29_c34b1_target ON COMMIT DROP AS
SELECT :'owner_uuid'::uuid AS id,
       'a0000000-0000-4000-8000-000000000001'::uuid AS academy_id;
DO $preflight$
DECLARE n integer;
BEGIN
  IF current_database()<>'postgres' OR current_user<>'postgres'
     OR session_user<>'postgres' OR to_regprocedure('auth.uid()') IS NULL
     OR to_regnamespace('private') IS NULL
     OR to_regclass('public.players') IS NOT NULL
     OR to_regclass('public.payment_dues') IS NOT NULL
  THEN RAISE EXCEPTION 'C3.4B1: unexpected database; abort'; END IF;
  IF (SELECT count(*) FROM pg_temp.b29_c34b1_target)<>1
     OR (SELECT count(*) FROM auth.users)<>2
     OR (SELECT count(*) FROM auth.users WHERE email LIKE 'b29-c34a-%@example.test')<>1
     OR (SELECT count(*) FROM auth.users au JOIN pg_temp.b29_c34b1_target x ON x.id=au.id
         WHERE au.email LIKE 'b29-c34b1-ao-a-%@example.test')<>1
  THEN RAISE EXCEPTION 'C3.4B1: expected two invented local Auth users only'; END IF;
  IF EXISTS(SELECT 1 FROM public.users)
     OR EXISTS(SELECT 1 FROM public.coaches)
     OR EXISTS(SELECT 1 FROM public.coach_batches)
     OR EXISTS(SELECT 1 FROM public.coach_batch_assignments)
  THEN RAISE EXCEPTION 'C3.4B1: application rows already exist; abort'; END IF;
  IF (SELECT count(*) FROM public.batches)<>2
     OR NOT EXISTS (
       SELECT 1 FROM public.batches b JOIN pg_temp.b29_c34b1_target x
         ON b.academy_id=x.academy_id
       WHERE b.id='b0000000-0000-4000-8000-000000000001'::uuid
     )
  THEN RAISE EXCEPTION 'C3.4B1: Academy A batch precondition failed'; END IF;
  SELECT count(*) INTO n FROM pg_proc p
  JOIN pg_namespace ns ON ns.oid=p.pronamespace WHERE ns.nspname='private';
  IF n<>11 THEN RAISE EXCEPTION 'C3.4B1: expected exactly eleven private helpers'; END IF;
  SELECT count(*) INTO n FROM pg_class c JOIN pg_namespace ns ON ns.oid=c.relnamespace
  WHERE ns.nspname='public' AND c.relkind='r' AND c.relrowsecurity
    AND c.relname IN ('users','batches','coaches',
                      'coach_batches','coach_batch_assignments');
  IF n<>5 OR has_table_privilege('anon','public.users','SELECT')
    OR has_table_privilege('authenticated','public.users','SELECT')
    OR has_table_privilege('authenticated','public.batches','SELECT')
  THEN RAISE EXCEPTION 'C3.4B1: RLS or table grants unexpectedly changed'; END IF;
END $preflight$;

INSERT INTO public.users(id,academy_id,role)
SELECT id,academy_id,'academy_owner' FROM pg_temp.b29_c34b1_target;

DO $postflight$
DECLARE n integer;
BEGIN
 IF (SELECT count(*) FROM public.users)<>1
    OR (SELECT count(*) FROM auth.users)<>2
    OR (SELECT count(*) FROM public.users u JOIN pg_temp.b29_c34b1_target x
        ON u.id=x.id AND u.academy_id=x.academy_id
        WHERE u.role='academy_owner')<>1
    OR (SELECT count(*) FROM public.batches)<>2
    OR (SELECT count(*) FROM pg_proc p JOIN pg_namespace ns ON ns.oid=p.pronamespace
        WHERE ns.nspname='private')<>11
    OR has_table_privilege('authenticated','public.users','SELECT')
    OR EXISTS(SELECT 1 FROM public.coaches)
 THEN RAISE EXCEPTION 'C3.4B1: local mapping or RLS postcheck failed; rollback'; END IF;
END $postflight$;

SELECT 'B2.9-C3.4B1 OWNER A MAPPING VERIFIED' AS checkpoint,
 (SELECT count(*) FROM auth.users) AS native_auth_users,
 (SELECT count(*) FROM public.users) AS synthetic_app_users,
 (SELECT count(*) FROM public.batches) AS synthetic_batches,
 (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='private') AS helper_count;
