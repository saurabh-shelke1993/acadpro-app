-- PS-L2.3 TEST-ONLY historical bootstrap. NEVER migrate to a hosted project.
-- An old repository migration snapshot omitted the live private role helper
-- definitions; this file reconstructs the minimal known definitions from
-- READ-ONLY inspection of the active database on 6 November 2026.
-- ONLY copied into supabase/migrations inside disposable GitHub CI checkout.
-- Not proof that the full historical migration chain matches production.
-- First remote schema snapshot predates parents.user_id, so disable SQL body
-- checking *only while reconstructing functions in this disposable checkout*.
-- The real body will be checked when invoked after all migrations are replayed.
SET check_function_bodies = off;
CREATE SCHEMA IF NOT EXISTS private;
CREATE OR REPLACE FUNCTION private.current_user_role()
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = 'public','private'
AS $f$
 SELECT u.role FROM public.users u WHERE u.id = auth.uid() LIMIT 1;
$f$;
CREATE OR REPLACE FUNCTION private.is_super_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = 'public','pg_catalog'
AS $f$
 SELECT EXISTS (
  SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'super_admin'
 );
$f$;
CREATE OR REPLACE FUNCTION private.is_academy_owner()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = 'public','private'
AS $f$
 SELECT COALESCE(private.current_user_role() = 'academy_owner', false);
$f$;
CREATE OR REPLACE FUNCTION private.current_academy_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = 'public','pg_catalog'
AS $f$
 SELECT academy_id FROM public.users WHERE id = auth.uid() LIMIT 1;
$f$;
CREATE OR REPLACE FUNCTION private.current_parent_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = 'public','private','pg_catalog'
AS $f$
 SELECT p.id
 FROM public.parents p JOIN public.users u ON u.id=p.user_id
 WHERE p.user_id=auth.uid()
   AND lower(coalesce(u.role,''))='parent' AND p.is_active=true
 LIMIT 1;
$f$;
CREATE OR REPLACE FUNCTION private.can_manage_academy(p_academy_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $f$
 SELECT COALESCE(
  private.is_super_admin() OR
  (private.is_academy_owner() AND
   p_academy_id=private.current_academy_id()),false
 );
$f$;
CREATE OR REPLACE FUNCTION private.is_parent_of_player(p_player_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = 'public','private','pg_catalog'
AS $f$
 SELECT EXISTS (
  SELECT 1 FROM public.players p
  WHERE p.id=p_player_id AND p.parent_id=private.current_parent_id()
 );
$f$;
-- Test database access, not production access: private helpers are only
-- invoked by a signed-in role via RLS. No anon EXECUTE.
REVOKE ALL ON SCHEMA private FROM PUBLIC,anon;
GRANT USAGE ON SCHEMA private TO authenticated;
REVOKE ALL ON FUNCTION
 private.current_user_role(), private.is_super_admin(),
 private.is_academy_owner(), private.current_academy_id(),
 private.current_parent_id(), private.can_manage_academy(uuid),
 private.is_parent_of_player(uuid)
 FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION
 private.current_user_role(), private.is_super_admin(),
 private.is_academy_owner(), private.current_academy_id(),
 private.current_parent_id(), private.can_manage_academy(uuid),
 private.is_parent_of_player(uuid)
 TO authenticated;

SET check_function_bodies = on;
