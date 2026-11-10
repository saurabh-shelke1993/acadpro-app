-- KHELTRIVA PS-L2.3B B2.9: DISPOSABLE-ONLY current-state authorization snapshot.
-- This is NOT original historical migration SQL. NEVER apply to hosted Supabase.
-- NEVER copy into canonical supabase/migrations or production workflows.
-- Current live definitions verified against SHA-256 read-only inventory on 2026-11-11.
-- The creation order is for synthetic PostgreSQL 17 tests after required public tables/auth.uid exist.
-- For legacy migration replay, timing and SQL dependencies remain separately BLOCKED.
CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon;
GRANT USAGE ON SCHEMA private TO authenticated;

-- LIVE SNAPSHOT batch_academy_id(p_batch_id uuid): sha256 6b8486e76ae56f94eba6789d5647eec5ec234a0e381616d1160d4e4b9cd0d0f8
CREATE OR REPLACE FUNCTION private.batch_academy_id(p_batch_id uuid)
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
    SELECT b.academy_id
    FROM public.batches AS b
    WHERE b.id = p_batch_id
    LIMIT 1;
$function$;

-- LIVE SNAPSHOT can_access_batch(p_batch_id uuid): sha256 d4ac81a958778d242ad971818d622e79d6eabf5eea8a3e6c0600e22827331b66
CREATE OR REPLACE FUNCTION private.can_access_batch(p_batch_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
    SELECT EXISTS (
        SELECT 1
        FROM public.coach_batches cb
        JOIN public.coaches c
          ON c.id = cb.coach_id
        WHERE cb.batch_id = p_batch_id
          AND c.user_id = auth.uid()
    );
$function$;

-- LIVE SNAPSHOT can_access_center(p_center_id uuid): sha256 4d0c556a60dfbdff7636b1ed8e1bdd53597e01ebdb96c9f351e4be70fe506270
CREATE OR REPLACE FUNCTION private.can_access_center(p_center_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
    SELECT EXISTS (
        SELECT 1
        FROM public.coach_batches cb
        JOIN public.coaches c
          ON c.id = cb.coach_id
        JOIN public.batches b
          ON b.id = cb.batch_id
        WHERE b.center_id = p_center_id
          AND c.user_id = auth.uid()
    );
$function$;

-- LIVE SNAPSHOT can_access_coach(p_coach_id uuid): sha256 364df38dad34f66080ba6c852257ffae87e449299daf55ce065f6ce6f68751e4
CREATE OR REPLACE FUNCTION private.can_access_coach(p_coach_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
    SELECT EXISTS (
        SELECT 1
        FROM public.coaches c
        WHERE c.id = p_coach_id
          AND c.user_id = auth.uid()
    );
$function$;

-- LIVE SNAPSHOT can_access_coach_batch(p_coach_batch_id uuid): sha256 af11997f83895cbe71846dd086cbe60d5b647529eeb9b8abb5d7fe30604959a1
CREATE OR REPLACE FUNCTION private.can_access_coach_batch(p_coach_batch_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
    SELECT EXISTS (
        SELECT 1
        FROM public.coach_batches cb
        JOIN public.coaches c
          ON c.id = cb.coach_id
        WHERE cb.id = p_coach_batch_id
          AND c.user_id = auth.uid()
    );
$function$;

-- LIVE SNAPSHOT current_academy_id(): sha256 9811951339849bf17c049a950da050ad25a0057effab940118e80a16b4818c62
CREATE OR REPLACE FUNCTION private.current_academy_id()
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_catalog'
AS $function$
    SELECT academy_id
    FROM public.users
    WHERE id = auth.uid()
    LIMIT 1;
$function$;

-- LIVE SNAPSHOT current_user_role(): sha256 04a3fdd43ae2e79009b1f7e2ebafcd465099911c126d6dbe17c27ff99364afa9
CREATE OR REPLACE FUNCTION private.current_user_role()
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
    SELECT u.role
    FROM public.users u
    WHERE u.id = auth.uid()
    LIMIT 1;
$function$;

-- LIVE SNAPSHOT is_super_admin(): sha256 ccd74e3bef0154c8159204a291be77ed68491a73b0927138de6daea47ba20103
CREATE OR REPLACE FUNCTION private.is_super_admin()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_catalog'
AS $function$
    SELECT EXISTS (
        SELECT 1
        FROM public.users
        WHERE id = auth.uid()
          AND role = 'super_admin'
    );
$function$;

-- LIVE SNAPSHOT is_academy_owner(): sha256 27b439a6914a9301980a109fac7c4a817cb8e006196cfc6974a585234a762423
CREATE OR REPLACE FUNCTION private.is_academy_owner()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
    SELECT COALESCE(private.current_user_role() = 'academy_owner', false);
$function$;

-- LIVE SNAPSHOT is_coach(): sha256 8f1d18d5cd46478632c1d2edc3aa00ae6077c74b63884d9f6e5d5ece0931b83c
CREATE OR REPLACE FUNCTION private.is_coach()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
    SELECT COALESCE(private.current_user_role() = 'coach', false);
$function$;

-- LIVE SNAPSHOT is_coach_assigned_to_batch(p_batch_id uuid): sha256 961a62883dbcd3e5cdc3eeeb6479257031d620d6be8453ec501632c075ed7d0a
CREATE OR REPLACE FUNCTION private.is_coach_assigned_to_batch(p_batch_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
    SELECT EXISTS (
        SELECT 1
        FROM public.coaches c
        JOIN public.coach_batch_assignments cba
          ON cba.coach_id = c.id
        WHERE c.user_id = auth.uid()
          AND cba.batch_id = p_batch_id
          AND cba.is_active = true
    );
$function$;

-- Recreate explicit function privileges, not broader implicit defaults.
REVOKE ALL ON FUNCTION private.batch_academy_id(uuid), private.can_access_batch(uuid), private.can_access_center(uuid), private.can_access_coach(uuid), private.can_access_coach_batch(uuid), private.current_academy_id(), private.current_user_role(), private.is_super_admin(), private.is_academy_owner(), private.is_coach(), private.is_coach_assigned_to_batch(uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.batch_academy_id(uuid), private.can_access_batch(uuid), private.can_access_center(uuid), private.can_access_coach(uuid), private.can_access_coach_batch(uuid), private.current_academy_id(), private.current_user_role(), private.is_super_admin(), private.is_academy_owner(), private.is_coach(), private.is_coach_assigned_to_batch(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION private.can_access_batch(uuid), private.can_access_center(uuid), private.can_access_coach(uuid), private.can_access_coach_batch(uuid), private.is_academy_owner(), private.is_coach(), private.is_coach_assigned_to_batch(uuid) TO PUBLIC;
-- Live PRIVATE schema has no USAGE for anon/service_role even where PUBLIC has function EXECUTE.
-- No other grants, DDL or data modifications are authorized by this fixture.
