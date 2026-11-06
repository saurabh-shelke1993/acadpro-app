-- Kheltriva PS-L2.3 — UNAPPLIED PROPOSAL, regular tuition foundation only.
-- NOT IN supabase/migrations. DO NOT EXECUTE against the live project.
-- Review/convert with "supabase migration new" only after separate approval.
-- Existing player_subscriptions/dues/payments remain unchanged except nullable
-- additive columns. No period/event/dues rows are inserted by this file.
-- No billing RPC, Cron, camp module, historical correction or activation.
BEGIN;
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE SCHEMA IF NOT EXISTS private;
CREATE EXTENSION IF NOT EXISTS btree_gist WITH SCHEMA extensions;
SET LOCAL search_path = pg_catalog, public, extensions;

CREATE TABLE public.academy_subscription_billing_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  academy_id uuid NOT NULL REFERENCES public.academies(id) ON DELETE RESTRICT,
  version integer NOT NULL CHECK (version > 0),
  effective_from date NOT NULL,
  monthly_alignment text NOT NULL CHECK (monthly_alignment IN ('fixed_calendar_month','anniversary_month')),
  first_period_method text NOT NULL DEFAULT 'scheduled_sessions'
    CHECK (first_period_method IN ('scheduled_sessions','calendar_days')),
  timezone_name text NOT NULL DEFAULT 'Asia/Kolkata' CHECK (timezone_name = 'Asia/Kolkata'),
  created_by uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  reason text NOT NULL CHECK (length(btrim(reason)) > 0),
  UNIQUE (academy_id,version),
  UNIQUE (academy_id,effective_from)
);

ALTER TABLE public.player_subscriptions
  ADD COLUMN academy_id uuid REFERENCES public.academies(id) ON DELETE RESTRICT,
  ADD COLUMN contracted_rate_paise bigint CHECK (contracted_rate_paise >= 0),
  ADD COLUMN currency_code text CHECK (currency_code = 'INR'),
  ADD COLUMN contracted_cycle text CHECK (contracted_cycle IN ('monthly','quarterly','half_yearly','yearly')),
  ADD COLUMN monthly_alignment text CHECK (monthly_alignment IN ('fixed_calendar_month','anniversary_month')),
  ADD COLUMN proration_method text CHECK (proration_method IN ('scheduled_sessions','calendar_days')),
  ADD COLUMN billing_policy_id uuid REFERENCES public.academy_subscription_billing_policies(id) ON DELETE RESTRICT,
  ADD COLUMN original_anniversary_day smallint CHECK (original_anniversary_day BETWEEN 1 AND 31),
  ADD COLUMN renewal_eligibility text NOT NULL DEFAULT 'legacy_hold'
    CHECK (renewal_eligibility IN ('legacy_hold','eligible','blocked')),
  ADD COLUMN verified_paid_through date,
  ADD COLUMN first_prospective_renewal date,
  ADD COLUMN agreement_version bigint NOT NULL DEFAULT 1 CHECK (agreement_version > 0),
  ADD COLUMN activated_by uuid REFERENCES public.users(id) ON DELETE RESTRICT,
  ADD COLUMN activated_at timestamptz;

-- Write-lock new contract metadata until an audited activation RPC is built.
-- Existing create/edit/deactivate forms still work on their original columns.
CREATE FUNCTION private.ps_l2_3_guard_contract_metadata()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.academy_id IS NOT NULL
       OR NEW.contracted_rate_paise IS NOT NULL
       OR NEW.currency_code IS NOT NULL
       OR NEW.contracted_cycle IS NOT NULL
       OR NEW.monthly_alignment IS NOT NULL
       OR NEW.proration_method IS NOT NULL
       OR NEW.billing_policy_id IS NOT NULL
       OR NEW.original_anniversary_day IS NOT NULL
       OR NEW.renewal_eligibility <> 'legacy_hold'
       OR NEW.verified_paid_through IS NOT NULL
       OR NEW.first_prospective_renewal IS NOT NULL
       OR NEW.activated_by IS NOT NULL
       OR NEW.activated_at IS NOT NULL
       OR NEW.agreement_version <> 1
    THEN
      RAISE EXCEPTION 'PS-L2.3 contract activation is disabled' USING ERRCODE='42501';
    END IF;
  ELSE
    IF ROW(
       NEW.academy_id, NEW.contracted_rate_paise, NEW.currency_code,
       NEW.contracted_cycle, NEW.monthly_alignment, NEW.proration_method,
       NEW.billing_policy_id, NEW.original_anniversary_day,
       NEW.renewal_eligibility, NEW.verified_paid_through,
       NEW.first_prospective_renewal, NEW.agreement_version,
       NEW.activated_by, NEW.activated_at
    ) IS DISTINCT FROM ROW(
       OLD.academy_id, OLD.contracted_rate_paise, OLD.currency_code,
       OLD.contracted_cycle, OLD.monthly_alignment, OLD.proration_method,
       OLD.billing_policy_id, OLD.original_anniversary_day,
       OLD.renewal_eligibility, OLD.verified_paid_through,
       OLD.first_prospective_renewal, OLD.agreement_version,
       OLD.activated_by, OLD.activated_at
    ) THEN
      RAISE EXCEPTION 'PS-L2.3 contract metadata is locked' USING ERRCODE='42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION private.ps_l2_3_guard_contract_metadata() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER ps_l2_3_guard_contract_metadata
  BEFORE INSERT OR UPDATE ON public.player_subscriptions
  FOR EACH ROW EXECUTE FUNCTION private.ps_l2_3_guard_contract_metadata();

CREATE TABLE public.subscription_periods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agreement_id uuid NOT NULL REFERENCES public.player_subscriptions(id) ON DELETE RESTRICT,
  academy_id uuid NOT NULL REFERENCES public.academies(id) ON DELETE RESTRICT,
  player_id uuid NOT NULL REFERENCES public.players(id) ON DELETE RESTRICT,
  period_sequence integer NOT NULL CHECK (period_sequence > 0),
  period_origin text NOT NULL CHECK (period_origin IN ('initial','renewal','prospective_opening')),
  period_start date NOT NULL,
  original_end date NOT NULL,
  effective_end date NOT NULL,
  cycle_snapshot text NOT NULL CHECK (cycle_snapshot IN ('monthly','quarterly','half_yearly','yearly')),
  monthly_alignment_snapshot text CHECK (monthly_alignment_snapshot IN ('fixed_calendar_month','anniversary_month')),
  anniversary_anchor_day smallint CHECK (anniversary_anchor_day BETWEEN 1 AND 31),
  contracted_rate_paise bigint NOT NULL CHECK (contracted_rate_paise >= 0),
  billed_tuition_paise bigint NOT NULL CHECK (billed_tuition_paise >= 0),
  currency_code text NOT NULL DEFAULT 'INR' CHECK (currency_code = 'INR'),
  proration_method text CHECK (proration_method IN ('scheduled_sessions','calendar_days')),
  eligible_units integer,
  total_units integer,
  full_billing_start date,
  full_billing_end date,
  pricing_basis jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(pricing_basis) = 'object'),
  created_by uuid REFERENCES public.users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  revised_at timestamptz,
  period_version bigint NOT NULL DEFAULT 1 CHECK (period_version > 0),
  CONSTRAINT ps_l2_3_period_dates CHECK (period_start <= original_end AND original_end <= effective_end),
  CONSTRAINT ps_l2_3_proration_basis CHECK (
    (proration_method IS NULL AND eligible_units IS NULL AND total_units IS NULL
      AND billed_tuition_paise = contracted_rate_paise)
    OR
    (proration_method IS NOT NULL AND total_units > 0 AND eligible_units > 0
      AND eligible_units <= total_units AND billed_tuition_paise <= contracted_rate_paise
      AND full_billing_start IS NOT NULL AND full_billing_end IS NOT NULL
      AND full_billing_start <= period_start AND full_billing_end >= period_start)
  ),
  CONSTRAINT ps_l2_3_monthly_alignment CHECK (
    (cycle_snapshot = 'monthly' AND monthly_alignment_snapshot IS NOT NULL)
    OR (cycle_snapshot <> 'monthly' AND monthly_alignment_snapshot IS NULL)
  ),
  UNIQUE (agreement_id,period_sequence),
  UNIQUE (agreement_id,period_start),
  UNIQUE (id,agreement_id,player_id),
  -- CRITICAL: exclusion covers two different agreement IDs for the same
  -- academy/player, not just overlaps within one agreement.
  CONSTRAINT ps_l2_3_no_concurrent_regular_tuition
    EXCLUDE USING gist (
      academy_id WITH =, player_id WITH =,
      daterange(period_start,effective_end,'[]') WITH &&
    )
);

-- Defense in depth: old agreements have NULL academy/rate and remain HOLD.
-- No INSERT/UPDATE role grants exist on this ledger, but privileged writes
-- must still match academy/player/plan/approved contract when RPCs are added.
CREATE FUNCTION private.ps_l2_3_check_period_agreement()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  a record;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF (pg_catalog.to_jsonb(NEW) - ARRAY['effective_end','period_version','revised_at'])
       IS DISTINCT FROM
       (pg_catalog.to_jsonb(OLD) - ARRAY['effective_end','period_version','revised_at'])
       OR NEW.effective_end < OLD.effective_end
       OR NEW.period_version <> OLD.period_version + 1
       OR NEW.revised_at IS NULL
    THEN
      RAISE EXCEPTION 'PS-L2.3 issued period fields are immutable' USING ERRCODE='42501';
    END IF;
  END IF;
  SELECT ps.player_id, ps.academy_id, ps.subscription_plan_id,
         ps.status, ps.renewal_eligibility, ps.contracted_rate_paise,
         ps.contracted_cycle, ps.monthly_alignment, ps.first_prospective_renewal,
         p.academy_id AS player_academy, sp.academy_id AS plan_academy
    INTO a
    FROM public.player_subscriptions ps
    LEFT JOIN public.players p ON p.id = ps.player_id
    LEFT JOIN public.subscription_plans sp ON sp.id = ps.subscription_plan_id
   WHERE ps.id = NEW.agreement_id
   FOR UPDATE OF ps;
  IF NOT FOUND OR a.player_id IS DISTINCT FROM NEW.player_id
     OR a.academy_id IS DISTINCT FROM NEW.academy_id
     OR a.player_academy IS DISTINCT FROM NEW.academy_id
     OR a.plan_academy IS DISTINCT FROM NEW.academy_id
     OR a.status IS DISTINCT FROM 'active'
     OR a.renewal_eligibility IS DISTINCT FROM 'eligible'
     OR a.contracted_rate_paise IS NULL
     OR a.contracted_rate_paise IS DISTINCT FROM NEW.contracted_rate_paise
     OR a.contracted_cycle IS DISTINCT FROM NEW.cycle_snapshot
     OR (NEW.cycle_snapshot = 'monthly' AND
         a.monthly_alignment IS DISTINCT FROM NEW.monthly_alignment_snapshot)
     OR a.first_prospective_renewal IS NULL
     OR NEW.period_start < a.first_prospective_renewal
  THEN
    RAISE EXCEPTION 'PS-L2.3 period agreement/academy/legacy eligibility mismatch'
      USING ERRCODE='42501';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION private.ps_l2_3_check_period_agreement() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER ps_l2_3_check_period_agreement
  BEFORE INSERT OR UPDATE ON public.subscription_periods
  FOR EACH ROW EXECUTE FUNCTION private.ps_l2_3_check_period_agreement();

CREATE TABLE public.subscription_lifecycle_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  academy_id uuid NOT NULL REFERENCES public.academies(id) ON DELETE RESTRICT,
  agreement_id uuid NOT NULL REFERENCES public.player_subscriptions(id) ON DELETE RESTRICT,
  period_id uuid REFERENCES public.subscription_periods(id) ON DELETE RESTRICT,
  event_type text NOT NULL CHECK (event_type IN
    ('activate','initial','renew','extend','pause','resume','reprice','correct','block')),
  idempotency_key uuid NOT NULL,
  actor_user_id uuid REFERENCES public.users(id) ON DELETE RESTRICT,
  actor_kind text NOT NULL CHECK (actor_kind IN ('academy_owner','super_admin','system')),
  occurred_at timestamptz NOT NULL DEFAULT now(),
  effective_on date,
  reason text NOT NULL CHECK (length(btrim(reason)) > 0),
  before_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  after_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  verified_frozen_paid_days integer CHECK (verified_frozen_paid_days >= 0),
  authorization_evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (academy_id,idempotency_key)
);

CREATE FUNCTION private.ps_l2_3_block_event_mutation()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  RAISE EXCEPTION 'PS-L2.3 lifecycle events are append-only' USING ERRCODE='42501';
END;
$$;
REVOKE ALL ON FUNCTION private.ps_l2_3_block_event_mutation() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER ps_l2_3_block_event_mutation
  BEFORE UPDATE OR DELETE ON public.subscription_lifecycle_events
  FOR EACH ROW EXECUTE FUNCTION private.ps_l2_3_block_event_mutation();

ALTER TABLE public.payment_dues
  ADD COLUMN subscription_period_id uuid,
  ADD CONSTRAINT ps_l2_3_due_period_required_refs
    CHECK (subscription_period_id IS NULL OR
      (subscription_id IS NOT NULL AND player_id IS NOT NULL)),
  ADD CONSTRAINT ps_l2_3_due_period_fk
    FOREIGN KEY (subscription_period_id) REFERENCES public.subscription_periods(id) ON DELETE RESTRICT,
  ADD CONSTRAINT ps_l2_3_due_period_identity_fk
    FOREIGN KEY (subscription_period_id,subscription_id,player_id)
    REFERENCES public.subscription_periods(id,agreement_id,player_id)
    ON DELETE RESTRICT,
  ADD CONSTRAINT ps_l2_3_one_due_per_period UNIQUE (subscription_period_id);

-- New public objects are readable only via scoped policies, never directly
-- writable by clients. No activation RPC is created in PS-L2.3.
ALTER TABLE public.academy_subscription_billing_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_lifecycle_events ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.academy_subscription_billing_policies FROM PUBLIC,anon,authenticated;
REVOKE ALL ON TABLE public.subscription_periods FROM PUBLIC,anon,authenticated;
REVOKE ALL ON TABLE public.subscription_lifecycle_events FROM PUBLIC,anon,authenticated;
GRANT SELECT ON TABLE public.academy_subscription_billing_policies TO authenticated;
GRANT SELECT ON TABLE public.subscription_periods TO authenticated;
GRANT SELECT ON TABLE public.subscription_lifecycle_events TO authenticated;

CREATE POLICY ps_l2_3_policy_read_managers
  ON public.academy_subscription_billing_policies FOR SELECT TO authenticated
  USING (private.can_manage_academy(academy_id));

CREATE POLICY ps_l2_3_period_read_scoped
  ON public.subscription_periods FOR SELECT TO authenticated
  USING (private.can_manage_academy(academy_id)
      OR (private.current_user_role() = 'parent'
          AND private.is_parent_of_player(player_id)));

CREATE POLICY ps_l2_3_event_read_managers
  ON public.subscription_lifecycle_events FOR SELECT TO authenticated
  USING (private.can_manage_academy(academy_id));

-- No financial data, recurring dues, historical rows or Cron modified.
COMMIT;
