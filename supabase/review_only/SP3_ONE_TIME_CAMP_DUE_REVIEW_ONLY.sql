-- SP3 2026-11-13 | REVIEW ONLY | DO NOT EXECUTE ON HOSTED SUPABASE
-- IMPORTANT: the live migration ledger contains versions missing from this repository.
-- Create an approved, versioned migration with the installed Supabase CLI only AFTER
-- operator backup/restore verification, security review, scratch proof and Owner consent.
-- This script is tested only on disposable PostgreSQL in CI.
-- Scope: ONE One-time camp due per player per camp plan, no recurring billing.
BEGIN;

-- Existing One-time dues were absent at the original read-only preflight.
-- Refuse automatic interpretation/backfill if a different operator created them later.
DO $sp3_preflight$
BEGIN
  IF EXISTS (SELECT 1 FROM public.payment_dues WHERE due_type = 'one_time') THEN
    RAISE EXCEPTION 'SP3 review requires reconciliation of existing one_time dues before deployment';
  END IF;
END;
$sp3_preflight$;

-- Materialize the server-verified camp plan as an immutable due snapshot identity.
-- Unlike unique(subscription_id), this prevents duplicate charges even when two
-- separate enrollment records refer to the same player and the same camp plan.
ALTER TABLE public.payment_dues
  ADD COLUMN IF NOT EXISTS one_time_plan_id uuid
  REFERENCES public.subscription_plans(id) ON DELETE RESTRICT;

CREATE UNIQUE INDEX IF NOT EXISTS payment_dues_one_time_player_plan_unique_idx
  ON public.payment_dues (player_id, one_time_plan_id)
  WHERE due_type = 'one_time';

-- Trigger is private; direct authenticated clients cannot invoke it as an RPC.
-- Financial state changes to paid_amount/due_status remain owned by the existing
-- private.enforce_payment_due_financial_state + collect_payment workflow.
CREATE OR REPLACE FUNCTION private.enforce_one_time_camp_due()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $sp3_trigger$
DECLARE
  v_enrollment record;
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.due_type = 'one_time' THEN
      RAISE EXCEPTION 'One-time camp dues cannot be deleted. Use the audited correction process.';
    END IF;
    RETURN OLD;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF OLD.due_type = 'one_time' OR NEW.due_type = 'one_time' THEN
      IF OLD.due_type IS DISTINCT FROM NEW.due_type
        OR OLD.player_id IS DISTINCT FROM NEW.player_id
        OR OLD.subscription_id IS DISTINCT FROM NEW.subscription_id
        OR OLD.one_time_plan_id IS DISTINCT FROM NEW.one_time_plan_id
        OR OLD.due_date IS DISTINCT FROM NEW.due_date
        OR OLD.total_amount IS DISTINCT FROM NEW.total_amount
        OR OLD.remarks IS DISTINCT FROM NEW.remarks
      THEN
        RAISE EXCEPTION 'One-time camp charge identity and amount cannot be edited.';
      END IF;
    END IF;
    RETURN NEW;
  END IF;

  -- INSERT only: require correct plan/billing type even for direct table inserts.
  IF NEW.subscription_id IS NULL THEN
    IF NEW.due_type = 'one_time' OR NEW.one_time_plan_id IS NOT NULL THEN
      RAISE EXCEPTION 'One-time camp due requires a linked enrollment';
    END IF;
    RETURN NEW;
  END IF;

  SELECT
    ps.player_id, ps.status, ps.start_date, ps.end_date,
    sp.id AS plan_id, sp.billing_cycle, sp.amount AS plan_amount,
    sp.registration_fee, sp.academy_id AS plan_academy_id,
    sp.center_id AS plan_center_id, sp.is_active AS plan_active,
    p.academy_id AS player_academy_id, p.center_id AS player_center_id
  INTO v_enrollment
  FROM public.player_subscriptions ps
  JOIN public.subscription_plans sp ON sp.id = ps.subscription_plan_id
  JOIN public.players p ON p.id = ps.player_id
  WHERE ps.id = NEW.subscription_id;

  IF NOT FOUND THEN
    IF NEW.due_type = 'one_time' OR NEW.one_time_plan_id IS NOT NULL THEN
      RAISE EXCEPTION 'One-time camp due requires a valid enrollment and plan';
    END IF;
    RETURN NEW;
  END IF;

  IF v_enrollment.billing_cycle IS DISTINCT FROM 'one_time' THEN
    IF NEW.due_type = 'one_time' OR NEW.one_time_plan_id IS NOT NULL THEN
      RAISE EXCEPTION 'One-time dues require a One-time plan';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.due_type IS DISTINCT FROM 'one_time' THEN
    RAISE EXCEPTION 'A One-time camp must not be billed as Monthly, Quarterly or Registration';
  END IF;

  IF NEW.player_id IS DISTINCT FROM v_enrollment.player_id
    OR v_enrollment.plan_academy_id IS NULL
    OR v_enrollment.player_academy_id IS DISTINCT FROM v_enrollment.plan_academy_id
    OR (v_enrollment.plan_center_id IS NOT NULL
       AND v_enrollment.plan_center_id IS DISTINCT FROM v_enrollment.player_center_id)
  THEN
    RAISE EXCEPTION 'One-time camp due has an invalid player, academy or center';
  END IF;

  IF v_enrollment.status IS DISTINCT FROM 'active'
    OR v_enrollment.plan_active IS DISTINCT FROM true
    OR v_enrollment.start_date IS NULL
    OR v_enrollment.end_date IS NULL
    OR v_enrollment.end_date < v_enrollment.start_date
  THEN
    RAISE EXCEPTION 'One-time camp enrollment must be active and have valid camp dates';
  END IF;

  IF v_enrollment.plan_amount IS NULL
    OR v_enrollment.plan_amount <= 0
    OR v_enrollment.plan_amount > 99999999.99
    OR v_enrollment.plan_amount <> pg_catalog.round(v_enrollment.plan_amount, 2)
    OR coalesce(v_enrollment.registration_fee, 0) <> 0
  THEN
    RAISE EXCEPTION 'One-time camp requires a valid positive plan amount and zero separate registration fee';
  END IF;

  IF NEW.due_date IS DISTINCT FROM v_enrollment.start_date
    OR NEW.total_amount IS DISTINCT FROM v_enrollment.plan_amount
    OR coalesce(NEW.paid_amount, 0) <> 0
  THEN
    RAISE EXCEPTION 'One-time camp due date, initial paid amount or price differs from the enrollment';
  END IF;

  IF NEW.one_time_plan_id IS NOT NULL
    AND NEW.one_time_plan_id IS DISTINCT FROM v_enrollment.plan_id
  THEN
    RAISE EXCEPTION 'One-time camp identity cannot be supplied by the caller';
  END IF;

  NEW.one_time_plan_id := v_enrollment.plan_id;
  RETURN NEW;
END;
$sp3_trigger$;

REVOKE ALL ON FUNCTION private.enforce_one_time_camp_due()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS sp3_one_time_camp_due_guard ON public.payment_dues;
CREATE TRIGGER sp3_one_time_camp_due_guard
BEFORE INSERT OR UPDATE OR DELETE ON public.payment_dues
FOR EACH ROW EXECUTE FUNCTION private.enforce_one_time_camp_due();

-- SECURITY INVOKER is deliberate: the caller must pass existing payment_dues
-- RLS (plus SELECT policies). No SECURITY DEFINER shortcut or user_metadata.
-- No user-supplied amount/date/type: the server reads them from the camp plan.
CREATE OR REPLACE FUNCTION public.create_one_time_camp_due(p_subscription_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $sp3_create$
DECLARE
  v_role text;
  v_enrollment record;
  v_due public.payment_dues%ROWTYPE;
  v_new_id uuid;
  v_created boolean := false;
BEGIN
  IF (SELECT auth.uid()) IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  v_role := private.current_user_role();
  IF v_role IS NULL OR v_role NOT IN ('academy_owner', 'super_admin') THEN
    RAISE EXCEPTION 'Only Academy Owner or Super Admin can create One-time camp dues';
  END IF;

  IF p_subscription_id IS NULL THEN
    RAISE EXCEPTION 'One-time camp enrollment is required';
  END IF;

  SELECT
    ps.id AS enrollment_id, ps.player_id, ps.status,
    ps.start_date, ps.end_date,
    sp.id AS plan_id, sp.plan_name, sp.billing_cycle, sp.amount,
    sp.registration_fee, sp.academy_id AS plan_academy_id,
    sp.center_id AS plan_center_id, sp.is_active AS plan_active,
    p.academy_id AS player_academy_id, p.center_id AS player_center_id
  INTO v_enrollment
  FROM public.player_subscriptions ps
  JOIN public.players p ON p.id = ps.player_id
  JOIN public.subscription_plans sp ON sp.id = ps.subscription_plan_id
  WHERE ps.id = p_subscription_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Camp enrollment not found or not accessible';
  END IF;

  IF v_enrollment.billing_cycle IS DISTINCT FROM 'one_time'
    OR v_enrollment.status IS DISTINCT FROM 'active'
    OR v_enrollment.plan_active IS DISTINCT FROM true
    OR v_enrollment.start_date IS NULL
    OR v_enrollment.end_date IS NULL
    OR v_enrollment.end_date < v_enrollment.start_date
  THEN
    RAISE EXCEPTION 'One-time camp enrollment is not eligible for a new due';
  END IF;

  IF v_enrollment.plan_academy_id IS NULL
    OR v_enrollment.player_academy_id IS DISTINCT FROM v_enrollment.plan_academy_id
    OR (v_enrollment.plan_center_id IS NOT NULL
        AND v_enrollment.plan_center_id IS DISTINCT FROM v_enrollment.player_center_id)
  THEN
    RAISE EXCEPTION 'Camp plan and player must belong to the same academy and center';
  END IF;

  IF v_role = 'academy_owner'
    AND v_enrollment.player_academy_id IS DISTINCT FROM private.current_academy_id()
  THEN
    RAISE EXCEPTION 'Academy Owner cannot create dues for another academy';
  END IF;

  IF v_enrollment.amount IS NULL
    OR v_enrollment.amount <= 0
    OR v_enrollment.amount > 99999999.99
    OR v_enrollment.amount <> pg_catalog.round(v_enrollment.amount, 2)
    OR coalesce(v_enrollment.registration_fee, 0) <> 0
  THEN
    RAISE EXCEPTION 'Camp plan needs a positive amount and zero separate registration fee';
  END IF;

  -- The trigger assigns one_time_plan_id from the authoritative enrollment,
  -- and the UNIQUE (player_id, one_time_plan_id) index serializes competing
  -- browsers and even separate active rows for the same player/camp plan.
  INSERT INTO public.payment_dues (
    player_id, subscription_id, due_type, due_date,
    total_amount, paid_amount, due_status, remarks
  )
  VALUES (
    v_enrollment.player_id, v_enrollment.enrollment_id,
    'one_time', v_enrollment.start_date, v_enrollment.amount, 0, 'pending',
    'One-time camp: ' || v_enrollment.plan_name ||
    ' (' || v_enrollment.start_date::text || ' to ' ||
    v_enrollment.end_date::text || '). One camp plan, one fee.'
  )
  ON CONFLICT (player_id, one_time_plan_id) WHERE due_type = 'one_time'
  DO NOTHING
  RETURNING id INTO v_new_id;

  v_created := v_new_id IS NOT NULL;

  SELECT * INTO v_due
  FROM public.payment_dues d
  WHERE d.player_id = v_enrollment.player_id
    AND d.one_time_plan_id = v_enrollment.plan_id
    AND d.due_type = 'one_time';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'One-time camp due could not be confirmed';
  END IF;

  -- Do not represent a charge on a different enrollment as this enrollment's
  -- idempotent retry. The duplicate is blocked and must be reviewed.
  IF v_due.subscription_id IS DISTINCT FROM v_enrollment.enrollment_id THEN
    RAISE EXCEPTION 'This player already has a One-time due for the camp plan under another enrollment';
  END IF;

  RETURN pg_catalog.jsonb_build_object(
    'id', v_due.id,
    'created', v_created,
    'due_type', v_due.due_type,
    'due_date', v_due.due_date,
    'total_amount', v_due.total_amount,
    'paid_amount', v_due.paid_amount,
    'remaining_amount', v_due.remaining_amount,
    'due_status', v_due.due_status
  );
END;
$sp3_create$;

-- RPC is explicitly invoker-only and callable by authenticated roles.
-- All role and academy assertions are repeated server-side before INSERT.
REVOKE ALL ON FUNCTION public.create_one_time_camp_due(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_one_time_camp_due(uuid) TO authenticated;

COMMIT;
