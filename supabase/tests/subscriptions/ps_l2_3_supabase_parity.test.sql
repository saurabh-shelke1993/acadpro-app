-- PS-L2.3 local Supabase schema parity gate.
-- Tests genuine repository migrations and actual Supabase Auth/RLS helpers.
-- Stays inside disposable Supabase local Postgres, never remote.
BEGIN;
DO $ps$
BEGIN
 IF to_regclass('auth.users') IS NULL
   OR to_regclass('public.parent_payment_submissions') IS NULL
   OR to_regclass('public.payment_corrections') IS NULL
   OR to_regprocedure('private.can_manage_academy(uuid)') IS NULL
   OR to_regclass('public.subscription_periods') IS NULL
 THEN RAISE EXCEPTION 'Missing real migrated Supabase schema or proposal'; END IF;
 IF EXISTS (SELECT 1 FROM public.subscription_periods) THEN
   RAISE EXCEPTION 'Proposal must not pre-create period records'; END IF;
 IF EXISTS (SELECT 1 FROM public.subscription_lifecycle_events) THEN
   RAISE EXCEPTION 'Proposal must not pre-create lifecycle events'; END IF;
 IF EXISTS (SELECT 1 FROM public.player_subscriptions WHERE renewal_eligibility <> 'legacy_hold') THEN
   RAISE EXCEPTION 'Legacy active agreement was auto-activated'; END IF;
 IF EXISTS (SELECT 1 FROM public.payment_dues WHERE subscription_period_id IS NOT NULL) THEN
   RAISE EXCEPTION 'Legacy or manual dues were retroactively linked'; END IF;
 IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid='public.subscription_periods'::regclass)
 THEN RAISE EXCEPTION 'RLS disabled on new periods'; END IF;
 IF has_table_privilege('anon','public.subscription_periods','SELECT')
 OR has_table_privilege('authenticated','public.subscription_periods','INSERT')
 OR has_table_privilege('authenticated','public.subscription_lifecycle_events','DELETE')
 THEN RAISE EXCEPTION 'Unsafe public or client-side mutation grants'; END IF;
END $ps$;
ROLLBACK;
\echo 'PS-L2.3 local Supabase: migration parity and read-only schema invariants PASS'
