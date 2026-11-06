-- PS-L2.3 isolation fixture, POSTGRES 17 disposable service only.
-- Uses simplified table/role/auth shapes (NOT a production schema dump).
-- NEVER run against the live Supabase project.
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN;
CREATE SCHEMA IF NOT EXISTS private;
CREATE SCHEMA IF NOT EXISTS auth;
CREATE TABLE public.academies (id uuid PRIMARY KEY, academy_name text);
CREATE TABLE public.users (id uuid PRIMARY KEY, academy_id uuid REFERENCES public.academies(id), role text);
CREATE TABLE public.players (id uuid PRIMARY KEY, academy_id uuid REFERENCES public.academies(id), full_name text);
CREATE TABLE public.subscription_plans (
 id uuid PRIMARY KEY, academy_id uuid REFERENCES public.academies(id),
 plan_name text NOT NULL, billing_cycle text NOT NULL, amount numeric NOT NULL
);
CREATE TABLE public.player_subscriptions (
 id uuid PRIMARY KEY, player_id uuid REFERENCES public.players(id),
 subscription_plan_id uuid REFERENCES public.subscription_plans(id),
 start_date date NOT NULL, end_date date, status text DEFAULT 'active'
);
CREATE TABLE public.payment_dues (
 id uuid PRIMARY KEY, player_id uuid REFERENCES public.players(id),
 subscription_id uuid REFERENCES public.player_subscriptions(id),
 due_type text NOT NULL, due_date date NOT NULL, total_amount numeric NOT NULL,
 paid_amount numeric DEFAULT 0, remaining_amount numeric, due_status text DEFAULT 'pending'
);
CREATE TABLE public.payments (id uuid PRIMARY KEY, due_id uuid REFERENCES public.payment_dues(id), amount_paid numeric);

-- Local test doubles ONLY: this GUC authorization is intentionally not secure
-- and MUST NOT be deployed as Supabase role-checking functions.
CREATE FUNCTION private.can_manage_academy(p_academy_id uuid) RETURNS boolean
  LANGUAGE sql STABLE AS $$
  SELECT current_setting('app.fixture_role',true) = 'super_admin' OR
    (current_setting('app.fixture_role',true) = 'academy_owner' AND
    current_setting('app.fixture_academy',true) = p_academy_id::text);
  $$;
CREATE FUNCTION private.current_user_role() RETURNS text
  LANGUAGE sql STABLE AS $$ SELECT current_setting('app.fixture_role',true) $$;
CREATE FUNCTION private.is_parent_of_player(p_player_id uuid) RETURNS boolean
  LANGUAGE sql STABLE AS $$ SELECT current_setting('app.fixture_parent_player',true) = p_player_id::text $$;
GRANT USAGE ON SCHEMA public,private TO authenticated,anon;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA private TO authenticated;
INSERT INTO public.academies VALUES
 ('a0000000-0000-4000-8000-000000000001','PS-L2.3 Academy A'),
 ('a0000000-0000-4000-8000-000000000002','PS-L2.3 Academy B');
INSERT INTO public.users VALUES
 ('10000000-0000-4000-8000-000000000001','a0000000-0000-4000-8000-000000000001','academy_owner');
INSERT INTO public.players VALUES
 ('20000000-0000-4000-8000-000000000001','a0000000-0000-4000-8000-000000000001','PS-L2.3 Player A'),
 ('20000000-0000-4000-8000-000000000002','a0000000-0000-4000-8000-000000000002','PS-L2.3 Player B');
INSERT INTO public.subscription_plans VALUES
 ('30000000-0000-4000-8000-000000000001','a0000000-0000-4000-8000-000000000001','Monthly A','monthly',1500),
 ('30000000-0000-4000-8000-000000000002','a0000000-0000-4000-8000-000000000001','Quarterly A','quarterly',4500),
 ('30000000-0000-4000-8000-000000000003','a0000000-0000-4000-8000-000000000002','Monthly B','monthly',1300);
-- These are intentional legacy rows, inserted BEFORE the proposal runs.
INSERT INTO public.player_subscriptions VALUES
 ('40000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001','2026-10-01',NULL,'active'),
 ('40000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000002','2026-10-01',NULL,'active'),
 ('40000000-0000-4000-8000-000000000003','20000000-0000-4000-8000-000000000002','30000000-0000-4000-8000-000000000003','2026-10-01',NULL,'active');
INSERT INTO public.payment_dues VALUES
 ('50000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001','monthly','2026-10-01',1500,1500,0,'paid');
INSERT INTO public.payments VALUES
 ('60000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000001',1500);
