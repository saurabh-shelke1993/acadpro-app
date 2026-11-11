-- Kheltriva B2.9-C3.3A: disposable native-Supabase schema prerequisites ONLY.
-- NEVER apply on hosted Supabase; NEVER move to canonical migrations.
-- This is a NONHISTORICAL, synthetic-only layout, not the Kheltriva schema.
-- Apply solely inside container supabase_db_kheltriva-b29-disposable.
-- Native Supabase auth.uid(), auth.users, anon/authenticated/service_role
-- MUST already exist; this file never modifies the native Auth objects.
BEGIN;

DO $guard$
BEGIN
  IF current_database() <> 'postgres' OR session_user <> 'postgres'
     OR to_regclass('auth.users') IS NULL
     OR to_regprocedure('auth.uid()') IS NULL
     OR to_regrole('anon') IS NULL
     OR to_regrole('authenticated') IS NULL
     OR to_regrole('service_role') IS NULL THEN
    RAISE EXCEPTION 'B2.9-C3 native Supabase prerequisites missing; abort';
  END IF;
  IF EXISTS (SELECT 1 FROM auth.users) THEN
    RAISE EXCEPTION 'B2.9-C3 requires a disposable instance with zero Auth users';
  END IF;
  IF to_regclass('public.players') IS NOT NULL
     OR to_regclass('public.payment_dues') IS NOT NULL
     OR to_regclass('public.users') IS NOT NULL
     OR to_regclass('public.batches') IS NOT NULL
     OR to_regclass('public.coaches') IS NOT NULL
     OR to_regclass('public.coach_batches') IS NOT NULL
     OR to_regclass('public.coach_batch_assignments') IS NOT NULL
     OR to_regnamespace('private') IS NOT NULL THEN
    RAISE EXCEPTION 'B2.9-C3 target contains existing application objects; abort';
  END IF;
END
$guard$;

-- Minimal, synthetic app layout sufficient to COMPILE the eleven B2.9 helpers.
-- Auth.user IDs are populated later via REAL local Auth sessions, not now.
CREATE TABLE public.users (
  id uuid PRIMARY KEY REFERENCES auth.users(id),
  academy_id uuid,
  role text NOT NULL CHECK (role IN ('super_admin','academy_owner','coach','parent'))
);
CREATE TABLE public.batches (
  id uuid PRIMARY KEY,
  center_id uuid NOT NULL,
  academy_id uuid NOT NULL
);
CREATE TABLE public.coaches (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id)
);
CREATE TABLE public.coach_batches (
  id uuid PRIMARY KEY,
  batch_id uuid NOT NULL REFERENCES public.batches(id),
  coach_id uuid NOT NULL REFERENCES public.coaches(id),
  UNIQUE(batch_id,coach_id)
);
CREATE TABLE public.coach_batch_assignments (
  batch_id uuid NOT NULL REFERENCES public.batches(id),
  coach_id uuid NOT NULL REFERENCES public.coaches(id),
  is_active boolean NOT NULL DEFAULT false,
  PRIMARY KEY(batch_id,coach_id)
);

-- Two invented academy/batch records, no actual user, coach or financial data.
INSERT INTO public.batches (id,center_id,academy_id) VALUES
('b0000000-0000-4000-8000-000000000001',
 'c0000000-0000-4000-8000-000000000001',
 'a0000000-0000-4000-8000-000000000001'),
('b0000000-0000-4000-8000-000000000002',
 'c0000000-0000-4000-8000-000000000002',
 'a0000000-0000-4000-8000-000000000002');

-- Every synthetic table is in public, therefore enable RLS and deny client
-- grants until dedicated positive/negative Auth policies are reviewed later.
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coaches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coach_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coach_batch_assignments ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE
  public.users,
  public.batches,
  public.coaches,
  public.coach_batches,
  public.coach_batch_assignments
FROM PUBLIC, anon, authenticated, service_role;

-- Verify only the intended five synthetic structures were constructed.
DO $verify$
DECLARE secured_count integer;
BEGIN
  SELECT count(*) INTO secured_count
  FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
  WHERE n.nspname='public'
    AND c.relname IN (
      'users','batches','coaches','coach_batches','coach_batch_assignments'
    )
    AND c.relkind='r' AND c.relrowsecurity;
  IF secured_count <> 5
     OR (SELECT count(*) FROM public.batches) <> 2
     OR (SELECT count(*) FROM public.users) <> 0
     OR (SELECT count(*) FROM public.coaches) <> 0
     OR EXISTS (SELECT 1 FROM auth.users)
     OR has_table_privilege('authenticated','public.users','SELECT')
     OR has_table_privilege('anon','public.batches','SELECT')
  THEN
     RAISE EXCEPTION 'B2.9-C3 synthetic schema postconditions failed; rollback';
  END IF;
END
$verify$;
COMMIT;

-- Stop here. Do not run 82 historical migrations or apply helper definitions
-- until the synthetic schema result is reviewed separately.
