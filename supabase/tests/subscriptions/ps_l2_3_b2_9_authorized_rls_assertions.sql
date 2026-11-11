-- Kheltriva B2.9-C1: AUTHORIZED DISPOSABLE-ONLY RLS exercise.
-- NONHISTORICAL. NEVER apply to hosted Supabase or canonical migrations.
-- Dependencies: synthetic_preconditions.sql then verified live_helper_snapshot.sql.
-- auth.uid() below is a deliberately spoofable synthetic GUC-based TEST DOUBLE;
-- these tests DO NOT prove real Supabase Auth/JWT, Storage or historical migration parity.
CREATE TABLE public.b29_synthetic_batch_roster (
  id integer PRIMARY KEY,
  academy_id uuid NOT NULL,
  batch_id uuid NOT NULL,
  fixture_label text NOT NULL
);
INSERT INTO public.b29_synthetic_batch_roster(id,academy_id,batch_id,fixture_label) VALUES
 (1,'a0000000-0000-4000-8000-000000000001','b0000000-0000-4000-8000-000000000001','Synthetic Academy A'),
 (2,'a0000000-0000-4000-8000-000000000002','b0000000-0000-4000-8000-000000000002','Synthetic Academy B');
INSERT INTO public.users(id,academy_id,role) VALUES
 ('10000000-0000-4000-8000-000000000005','a0000000-0000-4000-8000-000000000001','parent');

REVOKE ALL ON TABLE public.b29_synthetic_batch_roster FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON TABLE public.b29_synthetic_batch_roster TO authenticated;
ALTER TABLE public.b29_synthetic_batch_roster ENABLE ROW LEVEL SECURITY;
CREATE POLICY b29_synthetic_roster_read ON public.b29_synthetic_batch_roster
 FOR SELECT TO authenticated
 USING (
    private.is_super_admin()
    OR (private.is_academy_owner() AND academy_id = private.current_academy_id())
    OR (private.is_coach()
      AND private.is_coach_assigned_to_batch(batch_id)
      AND academy_id = private.batch_academy_id(batch_id))
 );

-- Before assuming any actor privileges, verify policy status and that all
-- mutations are impossible through the synthetic client role.
DO $assert$
BEGIN
 IF NOT (SELECT c.relrowsecurity FROM pg_class c
         WHERE c.oid='public.b29_synthetic_batch_roster'::regclass) THEN
   RAISE EXCEPTION 'Synthetic roster RLS disabled';
 END IF;
 IF has_table_privilege('anon','public.b29_synthetic_batch_roster','SELECT')
   OR has_table_privilege('authenticated','public.b29_synthetic_batch_roster','INSERT')
   OR has_table_privilege('authenticated','public.b29_synthetic_batch_roster','UPDATE')
   OR has_table_privilege('authenticated','public.b29_synthetic_batch_roster','DELETE')
   OR has_table_privilege('service_role','public.b29_synthetic_batch_roster','SELECT')
 THEN RAISE EXCEPTION 'Synthetic roster client grants are too broad'; END IF;
 IF has_schema_privilege('anon','private','USAGE')
   OR has_schema_privilege('service_role','private','USAGE')
   OR NOT has_schema_privilege('authenticated','private','USAGE')
 THEN RAISE EXCEPTION 'Synthetic private schema USAGE differs from B2.9 snapshot'; END IF;
END $assert$;

SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',false);
DO $assert$
BEGIN
 IF (SELECT count(*) FROM public.b29_synthetic_batch_roster) <> 2
 THEN RAISE EXCEPTION 'Super Admin synthetic roster read mismatch'; END IF;
END $assert$;

SELECT set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000002',false);
DO $assert$
BEGIN
 IF (SELECT count(*) FROM public.b29_synthetic_batch_roster) <> 1
    OR (SELECT min(id) FROM public.b29_synthetic_batch_roster) <> 1
 THEN RAISE EXCEPTION 'Academy Owner crossed synthetic academy boundary'; END IF;
END $assert$;

SELECT set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000003',false);
DO $assert$
BEGIN
 IF (SELECT count(*) FROM public.b29_synthetic_batch_roster) <> 1
    OR (SELECT min(id) FROM public.b29_synthetic_batch_roster) <> 1
 THEN RAISE EXCEPTION 'Assigned Coach synthetic RLS mismatch'; END IF;
END $assert$;

-- The B2.9 can_access_batch helper checks coach_batches, while the distinct
-- is_coach_assigned_to_batch helper checks active assignments. This deliberately
-- requires the latter for our constructed synthetic RLS policy.
SELECT set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000004',false);
DO $assert$
BEGIN
 IF private.can_access_batch('b0000000-0000-4000-8000-000000000002'::uuid) IS DISTINCT FROM TRUE
 OR private.is_coach_assigned_to_batch('b0000000-0000-4000-8000-000000000002'::uuid) IS DISTINCT FROM FALSE
 THEN RAISE EXCEPTION 'Synthetic inactive Coach mapping prerequisites changed'; END IF;
 IF (SELECT count(*) FROM public.b29_synthetic_batch_roster) <> 0
 THEN RAISE EXCEPTION 'Inactive Coach unexpectedly read synthetic roster'; END IF;
END $assert$;

SELECT set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000005',false);
DO $assert$
BEGIN
 IF (SELECT count(*) FROM public.b29_synthetic_batch_roster) <> 0
 THEN RAISE EXCEPTION 'Parent unexpectedly has synthetic management roster SELECT'; END IF;
END $assert$;

SELECT set_config('request.jwt.claim.sub','',false);
DO $assert$
BEGIN
 IF (SELECT count(*) FROM public.b29_synthetic_batch_roster) <> 0
 THEN RAISE EXCEPTION 'Missing synthetic identity unexpectedly read roster'; END IF;
END $assert$;
RESET ROLE;

-- Anonymous SQL role has no table SELECT grant. Catch the expected
-- insufficient_privilege from an actual attempt rather than treating only
-- metadata as an execution test.
SET ROLE anon;
DO $assert$
DECLARE found_rows integer;
BEGIN
 BEGIN
   EXECUTE 'SELECT count(*) FROM public.b29_synthetic_batch_roster'
       INTO found_rows;
   RAISE EXCEPTION 'Anonymous SQL role was unexpectedly allowed to read roster';
 EXCEPTION WHEN insufficient_privilege THEN
   NULL; -- Expected privilege denial on the disposable database only.
 END;
END $assert$;
RESET ROLE;
-- End of disposable synthetic RLS test. NOT a Supabase/JWT parity certificate.
