-- B2.9 disposable-only PostgreSQL test assertions.
-- This SQL is NEVER executed on the connected/live Supabase database.
DO $verify$
DECLARE count_fns int;
BEGIN
 SELECT COUNT(*) INTO count_fns
 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname='private' AND p.proname=ANY(ARRAY[
 'batch_academy_id','can_access_batch','can_access_center','can_access_coach',
 'can_access_coach_batch','current_academy_id','current_user_role','is_academy_owner',
 'is_coach','is_coach_assigned_to_batch','is_super_admin']);
 IF count_fns <> 11 THEN RAISE EXCEPTION 'Found % foundational helpers, expected 11',count_fns; END IF;
 IF has_schema_privilege('anon','private','USAGE') OR has_schema_privilege('service_role','private','USAGE')
    OR NOT has_schema_privilege('authenticated','private','USAGE') THEN
   RAISE EXCEPTION 'Wrong private schema usage grants';
 END IF;
 IF (SELECT COUNT(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
   WHERE n.nspname='private' AND p.proname=ANY(ARRAY[
 'batch_academy_id','can_access_batch','can_access_center','can_access_coach',
 'can_access_coach_batch','current_academy_id','current_user_role','is_academy_owner',
 'is_coach','is_coach_assigned_to_batch','is_super_admin'])
 AND p.prosecdef AND p.provolatile='s' AND pg_get_userbyid(p.proowner)='postgres'
 AND p.proconfig IS NOT NULL) <> 11 THEN
   RAISE EXCEPTION 'Fixture helper ownership/security mode differs';
 END IF;
 IF (SELECT COUNT(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
   WHERE n.nspname='private' AND p.proname IN
   ('can_access_batch','can_access_center','can_access_coach','can_access_coach_batch',
   'is_academy_owner','is_coach','is_coach_assigned_to_batch')
   AND has_function_privilege('anon',p.oid,'EXECUTE')
   AND has_function_privilege('service_role',p.oid,'EXECUTE'))<>7 THEN
   RAISE EXCEPTION 'Seven PUBLIC-granted helpers do not match snapshot';
 END IF;
 IF (SELECT COUNT(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
   WHERE n.nspname='private' AND p.proname IN
   ('batch_academy_id','current_academy_id','current_user_role','is_super_admin')
   AND NOT has_function_privilege('anon',p.oid,'EXECUTE')
   AND NOT has_function_privilege('service_role',p.oid,'EXECUTE'))<>4 THEN
   RAISE EXCEPTION 'Four restricted helpers do not match snapshot';
 END IF;
END $verify$;

SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',false);
DO $verify$
BEGIN
 IF private.current_user_role() <> 'super_admin' OR NOT private.is_super_admin()
    OR private.is_academy_owner() OR private.is_coach() THEN
   RAISE EXCEPTION 'Synthetic super-admin role checks failed';
 END IF;
END $verify$;

SELECT set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000002',false);
DO $verify$
BEGIN
 IF private.current_user_role() <> 'academy_owner' OR NOT private.is_academy_owner()
    OR private.is_super_admin() OR private.is_coach()
    OR private.current_academy_id() <> 'a0000000-0000-4000-8000-000000000001'::uuid THEN
   RAISE EXCEPTION 'Synthetic academy owner role and academy scope failed';
 END IF;
END $verify$;

SELECT set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000003',false);
DO $verify$
BEGIN
 IF private.current_user_role() <> 'coach' OR NOT private.is_coach()
    OR private.is_super_admin() OR private.is_academy_owner() THEN
   RAISE EXCEPTION 'Synthetic coach role checks failed';
 END IF;
 IF NOT private.can_access_batch('b0000000-0000-4000-8000-000000000001'::uuid)
   OR private.can_access_batch('b0000000-0000-4000-8000-000000000002'::uuid)
   OR NOT private.can_access_center('c0000000-0000-4000-8000-000000000001'::uuid)
   OR private.can_access_center('c0000000-0000-4000-8000-000000000002'::uuid)
   OR NOT private.can_access_coach('d0000000-0000-4000-8000-000000000001'::uuid)
   OR private.can_access_coach('d0000000-0000-4000-8000-000000000002'::uuid)
   OR NOT private.can_access_coach_batch('e0000000-0000-4000-8000-000000000001'::uuid)
   OR private.can_access_coach_batch('e0000000-0000-4000-8000-000000000002'::uuid)
   OR NOT private.is_coach_assigned_to_batch('b0000000-0000-4000-8000-000000000001'::uuid)
   OR private.is_coach_assigned_to_batch('b0000000-0000-4000-8000-000000000002'::uuid) THEN
   RAISE EXCEPTION 'Synthetic coach scope positive/negative checks failed';
 END IF;
END $verify$;

SELECT set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000004',false);
DO $verify$
BEGIN
 IF private.can_access_batch('b0000000-0000-4000-8000-000000000001'::uuid)
 OR private.can_access_center('c0000000-0000-4000-8000-000000000001'::uuid)
 OR private.can_access_coach('d0000000-0000-4000-8000-000000000001'::uuid)
 OR private.is_coach_assigned_to_batch('b0000000-0000-4000-8000-000000000001'::uuid)
 OR private.is_coach_assigned_to_batch('b0000000-0000-4000-8000-000000000002'::uuid) THEN
   RAISE EXCEPTION 'Foreign-academy coach isolation check failed';
 END IF;
END $verify$;

SELECT set_config('request.jwt.claim.sub','',false);
DO $verify$
BEGIN
 IF private.current_user_role() IS NOT NULL
   OR private.current_academy_id() IS NOT NULL
   OR private.is_super_admin()
   OR private.is_academy_owner()
   OR private.is_coach()
   OR private.can_access_batch('b0000000-0000-4000-8000-000000000001'::uuid) THEN
   RAISE EXCEPTION 'Unauthenticated context has unexpected helper access';
 END IF;
END $verify$;
RESET ROLE;
-- No hosted RLS, migration parity, or subscription billing integration is tested here.
