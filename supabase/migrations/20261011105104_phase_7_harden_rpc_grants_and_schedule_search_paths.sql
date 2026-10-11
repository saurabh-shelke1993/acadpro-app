-- Phase 7: harden parent-only RPC grants and schedule trigger search paths.
-- Keep authenticated execution for parent portal usage; remove anonymous/default-public access.
REVOKE EXECUTE ON FUNCTION public.get_parent_coach_profiles() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_parent_coach_profiles() FROM anon;
GRANT EXECUTE ON FUNCTION public.get_parent_coach_profiles() TO authenticated;

-- These are trigger functions; application clients do not need direct execution privileges.
REVOKE EXECUTE ON FUNCTION private.validate_batch_schedule_consistency() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION private.validate_player_batch_schedule_enrollment() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION private.validate_coach_batch_schedule_assignment() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION private.validate_batch_schedule_change_consistency() FROM PUBLIC;

-- All referenced application objects are schema-qualified; pg_catalog remains implicitly searched.
ALTER FUNCTION private.validate_batch_schedule_consistency() SET search_path = '';
ALTER FUNCTION private.validate_player_batch_schedule_enrollment() SET search_path = '';
ALTER FUNCTION private.validate_coach_batch_schedule_assignment() SET search_path = '';
ALTER FUNCTION private.validate_batch_schedule_change_consistency() SET search_path = '';
