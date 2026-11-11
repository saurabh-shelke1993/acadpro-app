-- B2.9-C3.3B: local-disposable-only, precondition check. Never hosted.
-- Execute with the pinned helper SQL and postcheck in ONE psql -1 transaction.
DO $guard$
DECLARE n integer;
BEGIN
 IF current_database()<>'postgres' OR session_user<>'postgres'
    OR current_user<>'postgres' OR to_regclass('auth.users') IS NULL
    OR to_regprocedure('auth.uid()') IS NULL
    OR to_regnamespace('private') IS NOT NULL
    OR to_regclass('public.players') IS NOT NULL
    OR to_regclass('public.payment_dues') IS NOT NULL
 THEN RAISE EXCEPTION 'C3.3B: wrong database/schema, abort'; END IF;
 IF EXISTS(SELECT 1 FROM auth.users)
    OR EXISTS(SELECT 1 FROM public.users)
    OR EXISTS(SELECT 1 FROM public.coaches)
    OR EXISTS(SELECT 1 FROM public.coach_batches)
    OR EXISTS(SELECT 1 FROM public.coach_batch_assignments)
    OR (SELECT count(*) FROM public.batches)<>2
 THEN RAISE EXCEPTION 'C3.3B: fixture not pristine, abort'; END IF;
 SELECT count(*) INTO n FROM pg_class c
 JOIN pg_namespace ns ON ns.oid=c.relnamespace
 WHERE ns.nspname='public' AND c.relkind='r' AND c.relrowsecurity
 AND c.relname IN ('users','batches','coaches',
                    'coach_batches','coach_batch_assignments');
 IF n<>5 OR has_table_privilege('authenticated','public.users','SELECT')
    OR has_table_privilege('anon','public.batches','SELECT')
 THEN RAISE EXCEPTION 'C3.3B: synthetic RLS/grant mismatch, abort'; END IF;
END $guard$;
-- Transaction-local check that native auth.uid stays bit-for-bit unchanged.
CREATE TEMP TABLE b29_native_auth_guard ON COMMIT DROP AS
SELECT p.oid, encode(pg_catalog.sha256(convert_to(pg_get_functiondef(p.oid),'UTF8')),'hex') AS sha
FROM pg_proc p WHERE p.oid=to_regprocedure('auth.uid()')::oid;
