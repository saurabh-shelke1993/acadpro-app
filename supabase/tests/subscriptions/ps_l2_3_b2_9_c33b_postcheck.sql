-- B2.9-C3.3B: local-disposable-only current-source and ACL audit.
DO $verify$
DECLARE mismatches integer;
BEGIN
 IF (SELECT count(*) FROM pg_temp.b29_native_auth_guard)<>1 OR EXISTS (
    SELECT 1 FROM pg_temp.b29_native_auth_guard g
    WHERE g.oid IS DISTINCT FROM to_regprocedure('auth.uid()')::oid
      OR g.sha IS DISTINCT FROM (
        SELECT encode(pg_catalog.sha256(convert_to(pg_get_functiondef(p.oid),'UTF8')),'hex')
        FROM pg_proc p WHERE p.oid=to_regprocedure('auth.uid()')::oid
      )
 ) THEN RAISE EXCEPTION 'C3.3B: native auth.uid changed, rollback'; END IF;
 IF NOT has_schema_privilege('authenticated','private','USAGE')
 OR has_schema_privilege('anon','private','USAGE')
 OR has_schema_privilege('service_role','private','USAGE')
 THEN RAISE EXCEPTION 'C3.3B: private schema grant mismatch, rollback'; END IF;
 IF (SELECT count(*) FROM pg_proc p JOIN pg_namespace ns ON ns.oid=p.pronamespace
     WHERE ns.nspname='private')<>11
 THEN RAISE EXCEPTION 'C3.3B: expected exactly 11 private helpers'; END IF;
 WITH expected(name,sha,anon_exec,auth_exec,service_exec,public_exec,config) AS (
 VALUES
  ('batch_academy_id','6b8486e76ae56f94eba6789d5647eec5ec234a0e381616d1160d4e4b9cd0d0f8',false,true,false,false,'search_path=public, private'),
  ('can_access_batch','d4ac81a958778d242ad971818d622e79d6eabf5eea8a3e6c0600e22827331b66',true,true,true,true,'search_path=public, private'),
  ('can_access_center','4d0c556a60dfbdff7636b1ed8e1bdd53597e01ebdb96c9f351e4be70fe506270',true,true,true,true,'search_path=public, private'),
  ('can_access_coach','364df38dad34f66080ba6c852257ffae87e449299daf55ce065f6ce6f68751e4',true,true,true,true,'search_path=public, private'),
  ('can_access_coach_batch','af11997f83895cbe71846dd086cbe60d5b647529eeb9b8abb5d7fe30604959a1',true,true,true,true,'search_path=public, private'),
  ('current_academy_id','9811951339849bf17c049a950da050ad25a0057effab940118e80a16b4818c62',false,true,false,false,'search_path=public, pg_catalog'),
  ('current_user_role','04a3fdd43ae2e79009b1f7e2ebafcd465099911c126d6dbe17c27ff99364afa9',false,true,false,false,'search_path=public, private'),
  ('is_super_admin','ccd74e3bef0154c8159204a291be77ed68491a73b0927138de6daea47ba20103',false,true,false,false,'search_path=public, pg_catalog'),
  ('is_academy_owner','27b439a6914a9301980a109fac7c4a817cb8e006196cfc6974a585234a762423',true,true,true,true,'search_path=public, private'),
  ('is_coach','8f1d18d5cd46478632c1d2edc3aa00ae6077c74b63884d9f6e5d5ece0931b83c',true,true,true,true,'search_path=public, private'),
  ('is_coach_assigned_to_batch','961a62883dbcd3e5cdc3eeeb6479257031d620d6be8453ec501632c075ed7d0a',true,true,true,true,'search_path=public, private')
 ), observed AS (
 SELECT p.proname AS name,
 encode(pg_catalog.sha256(convert_to(pg_get_functiondef(p.oid),'UTF8')),'hex') AS sha,
 pg_get_userbyid(p.proowner) AS owner,
 p.prosecdef,p.provolatile,p.proconfig,
 has_function_privilege('anon',p.oid,'EXECUTE') AS anon_exec,
 has_function_privilege('authenticated',p.oid,'EXECUTE') AS auth_exec,
 has_function_privilege('service_role',p.oid,'EXECUTE') AS service_exec,
 has_function_privilege('public',p.oid,'EXECUTE') AS public_exec
 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname='private'
 )
 SELECT count(*) INTO mismatches FROM expected e LEFT JOIN observed o USING(name)
 WHERE o.name IS NULL OR o.sha IS DISTINCT FROM e.sha
 OR o.owner IS DISTINCT FROM 'postgres'
 OR o.prosecdef IS DISTINCT FROM TRUE
 OR o.provolatile IS DISTINCT FROM 's'
 OR o.proconfig IS DISTINCT FROM ARRAY[e.config]::text[]
 OR o.anon_exec IS DISTINCT FROM e.anon_exec
 OR o.auth_exec IS DISTINCT FROM e.auth_exec
 OR o.service_exec IS DISTINCT FROM e.service_exec
 OR o.public_exec IS DISTINCT FROM e.public_exec;
 IF mismatches<>0 THEN
    RAISE EXCEPTION 'C3.3B: % functions fail pinned source/ACL checks',mismatches;
 END IF;
 IF EXISTS(SELECT 1 FROM auth.users)
    OR (SELECT count(*) FROM public.batches)<>2
    OR (SELECT count(*) FROM public.users)<>0
 THEN RAISE EXCEPTION 'C3.3B: synthetic data changed, rollback'; END IF;
END $verify$;
SET ROLE authenticated;
DO $verify$
BEGIN
 IF auth.uid() IS NOT NULL
    OR private.current_user_role() IS NOT NULL
    OR private.current_academy_id() IS NOT NULL
    OR private.is_super_admin() IS DISTINCT FROM FALSE
    OR private.is_academy_owner() IS DISTINCT FROM FALSE
    OR private.is_coach() IS DISTINCT FROM FALSE
    OR private.can_access_batch('b0000000-0000-4000-8000-000000000001'::uuid)
       IS DISTINCT FROM FALSE
 THEN RAISE EXCEPTION 'C3.3B: missing JWT identity unexpectedly authorized'; END IF;
END $verify$;
RESET ROLE;
SELECT 'C3.3B CURRENT HELPERS VERIFIED' AS checkpoint,
11 AS helper_count, (SELECT count(*) FROM public.batches) AS batch_count,
(SELECT count(*) FROM auth.users) AS native_auth_users,
(to_regprocedure('auth.uid()') IS NOT NULL) AS native_auth_retained;
