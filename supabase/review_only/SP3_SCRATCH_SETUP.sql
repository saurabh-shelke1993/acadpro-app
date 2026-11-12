-- SP3 disposable PostgreSQL 16 fixture. NO real academy or live Supabase data.
-- Run as the postgres superuser in an ephemeral CI service only.
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE anon NOLOGIN;
CREATE SCHEMA auth;
CREATE SCHEMA private;
GRANT USAGE ON SCHEMA auth, private TO authenticated;
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid
LANGUAGE sql STABLE
AS $$ SELECT nullif(pg_catalog.current_setting('request.jwt.claim.sub', true), '')::uuid $$;
GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated;

CREATE TABLE public.users (
  id uuid PRIMARY KEY, role text, academy_id uuid
);
CREATE TABLE public.players (
  id uuid PRIMARY KEY, academy_id uuid, center_id uuid
);
CREATE TABLE public.subscription_plans (
  id uuid PRIMARY KEY, plan_name text NOT NULL, academy_id uuid, center_id uuid,
  billing_cycle text NOT NULL, amount numeric(10,2) NOT NULL,
  registration_fee numeric(10,2) DEFAULT 0, is_active boolean DEFAULT true
);
CREATE TABLE public.player_subscriptions (
  id uuid PRIMARY KEY, player_id uuid REFERENCES public.players(id),
  subscription_plan_id uuid REFERENCES public.subscription_plans(id),
  start_date date NOT NULL, end_date date,
  status text DEFAULT 'active'
);
CREATE TABLE public.payment_dues (
  id uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
  player_id uuid REFERENCES public.players(id),
  subscription_id uuid REFERENCES public.player_subscriptions(id),
  due_type text NOT NULL,
  due_date date NOT NULL,
  total_amount numeric(10,2) NOT NULL,
  paid_amount numeric(10,2) DEFAULT 0,
  remaining_amount numeric(10,2) GENERATED ALWAYS AS (total_amount - paid_amount) STORED,
  due_status text DEFAULT 'pending',
  remarks text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE OR REPLACE FUNCTION private.current_user_role() RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=''
AS $$ SELECT u.role FROM public.users u WHERE u.id = auth.uid() LIMIT 1 $$;
CREATE OR REPLACE FUNCTION private.current_academy_id() RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=''
AS $$ SELECT u.academy_id FROM public.users u WHERE u.id = auth.uid() LIMIT 1 $$;
GRANT EXECUTE ON FUNCTION private.current_user_role() TO authenticated;
GRANT EXECUTE ON FUNCTION private.current_academy_id() TO authenticated;

CREATE OR REPLACE FUNCTION private.enforce_payment_due_financial_state() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
BEGIN
  IF NEW.total_amount < 0 OR coalesce(NEW.paid_amount, 0) < 0 OR
     coalesce(NEW.paid_amount, 0) > NEW.total_amount THEN
    RAISE EXCEPTION 'Invalid financial due';
  END IF;
  IF TG_OP = 'UPDATE' AND
    (OLD.total_amount IS DISTINCT FROM NEW.total_amount OR
     OLD.paid_amount IS DISTINCT FROM NEW.paid_amount) AND
     pg_catalog.current_setting('acadpro.payment_write_operation', true) IS DISTINCT FROM 'collect' THEN
    RAISE EXCEPTION 'Financial due amount is system managed';
  END IF;
  NEW.paid_amount := coalesce(NEW.paid_amount, 0);
  NEW.due_status := CASE WHEN NEW.paid_amount = 0 THEN 'pending'
    WHEN NEW.paid_amount = NEW.total_amount THEN 'paid' ELSE 'partial' END;
  RETURN NEW;
END;
$$;
CREATE TRIGGER payment_due_financial_state_trigger BEFORE INSERT OR UPDATE
ON public.payment_dues FOR EACH ROW
EXECUTE FUNCTION private.enforce_payment_due_financial_state();

INSERT INTO public.users VALUES
  ('00000000-0000-0000-0000-000000000001','academy_owner','10000000-0000-0000-0000-000000000001'),
  ('00000000-0000-0000-0000-000000000002','academy_owner','10000000-0000-0000-0000-000000000002'),
  ('00000000-0000-0000-0000-000000000003','super_admin',NULL),
  ('00000000-0000-0000-0000-000000000004','parent','10000000-0000-0000-0000-000000000001'),
  ('00000000-0000-0000-0000-000000000005','coach','10000000-0000-0000-0000-000000000001');
INSERT INTO public.players VALUES
  ('20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001'),
  ('20000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000002','30000000-0000-0000-0000-000000000002'),
  ('20000000-0000-0000-0000-000000000003','10000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001');
INSERT INTO public.subscription_plans VALUES
  ('40000000-0000-0000-0000-000000000001','Summer Camp U12','10000000-0000-0000-0000-000000000001',NULL,'one_time',3000,0,true),
  ('40000000-0000-0000-0000-000000000002','Monthly','10000000-0000-0000-0000-000000000001',NULL,'monthly',1500,0,true),
  ('40000000-0000-0000-0000-000000000003','Summer Camp Foreign','10000000-0000-0000-0000-000000000002',NULL,'one_time',3000,0,true),
  ('40000000-0000-0000-0000-000000000004','Camp Registration Extra','10000000-0000-0000-0000-000000000001',NULL,'one_time',3000,500,true),
  ('40000000-0000-0000-0000-000000000005','Camp Separate','10000000-0000-0000-0000-000000000001',NULL,'one_time',3500,0,true);
INSERT INTO public.player_subscriptions VALUES
  ('50000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000001','2027-05-12','2027-05-25','active'),
  ('50000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000002','2027-05-01','2027-05-31','active'),
  ('50000000-0000-0000-0000-000000000003','20000000-0000-0000-0000-000000000002','40000000-0000-0000-0000-000000000003','2027-05-11','2027-05-22','active'),
  ('50000000-0000-0000-0000-000000000004','20000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000001','2027-05-12','2027-05-25','active'),
  ('50000000-0000-0000-0000-000000000005','20000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000004','2027-05-12','2027-05-25','active'),
  ('50000000-0000-0000-0000-000000000006','20000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000005','2027-05-12','2027-05-25','inactive'),
  ('50000000-0000-0000-0000-000000000007','20000000-0000-0000-0000-000000000003','40000000-0000-0000-0000-000000000001','2027-05-12','2027-05-25','active');

ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_dues ENABLE ROW LEVEL SECURITY;

CREATE POLICY sp3_player_view ON public.players FOR SELECT TO authenticated
USING (
 private.current_user_role()='super_admin'
 OR (private.current_user_role()='academy_owner' AND academy_id=private.current_academy_id())
 OR (private.current_user_role()='parent' AND id='20000000-0000-0000-0000-000000000001'::uuid)
);
CREATE POLICY sp3_plan_view ON public.subscription_plans FOR SELECT TO authenticated
USING (
 private.current_user_role()='super_admin'
 OR (private.current_user_role()='academy_owner' AND academy_id=private.current_academy_id())
 OR (private.current_user_role()='parent' AND academy_id=private.current_academy_id())
);
CREATE POLICY sp3_sub_view ON public.player_subscriptions FOR SELECT TO authenticated
USING (
 private.current_user_role()='super_admin'
 OR EXISTS (SELECT 1 FROM public.players p WHERE p.id=player_id)
);
CREATE POLICY sp3_due_view ON public.payment_dues FOR SELECT TO authenticated
USING (
 private.current_user_role()='super_admin'
 OR EXISTS (SELECT 1 FROM public.players p WHERE p.id=player_id)
);
CREATE POLICY sp3_due_write ON public.payment_dues FOR INSERT TO authenticated
WITH CHECK (
 private.current_user_role()='super_admin'
 OR (private.current_user_role()='academy_owner' AND EXISTS (
   SELECT 1 FROM public.players p WHERE p.id=player_id AND p.academy_id=private.current_academy_id()
 ))
);
CREATE POLICY sp3_due_update ON public.payment_dues FOR UPDATE TO authenticated
USING (private.current_user_role()='super_admin' OR
  (private.current_user_role()='academy_owner' AND EXISTS (
   SELECT 1 FROM public.players p WHERE p.id=player_id AND p.academy_id=private.current_academy_id()
  )))
WITH CHECK (private.current_user_role()='super_admin' OR
  (private.current_user_role()='academy_owner' AND EXISTS (
   SELECT 1 FROM public.players p WHERE p.id=player_id AND p.academy_id=private.current_academy_id()
  )));
CREATE POLICY sp3_due_delete ON public.payment_dues FOR DELETE TO authenticated
USING (private.current_user_role()='super_admin' OR
  (private.current_user_role()='academy_owner' AND EXISTS (
   SELECT 1 FROM public.players p WHERE p.id=player_id AND p.academy_id=private.current_academy_id()
  )));

GRANT SELECT ON public.users TO authenticated;
GRANT SELECT ON public.players,public.subscription_plans,public.player_subscriptions TO authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.payment_dues TO authenticated;
