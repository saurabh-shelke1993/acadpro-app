-- AG3.4D3.2: exactly deployed correction RPCs, scratch-only real-JWT reproduction.
-- REQUIRES fresh unlinked native Supabase, full C2 > D1 > D3.1 tested fixtures.
-- No customer rows, migration ledger, hosted RPC call or production modification.
BEGIN;
DO $guard$
BEGIN
 IF current_database()<>'postgres' OR session_user<>'postgres' OR current_user<>'postgres'
  OR to_regclass('auth.users') IS NULL OR to_regclass('public.payment_corrections') IS NOT NULL
  OR (SELECT count(*) FROM auth.users)<>29
  OR (SELECT count(*) FROM public.users)<>21
  OR (SELECT count(*) FROM public.payment_dues)<>5
  OR (SELECT count(*) FROM public.payments WHERE due_id IS NOT NULL)<6
  OR (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON p.pronamespace=n.oid WHERE n.nspname='private')<>20
  OR to_regprocedure('public.approve_payment_correction(uuid)') IS NOT NULL
  OR to_regprocedure('public.reject_payment_correction(uuid,text)') IS NOT NULL
  OR to_regprocedure('public.request_payment_correction(uuid,numeric,text)') IS NOT NULL
  OR position('v_role is null or' IN lower(pg_get_functiondef('public.collect_payment(uuid,numeric,text,text)'::regprocedure)))=0
 THEN RAISE EXCEPTION 'AG3.4D3.2 refuses non-disposable or drifted native JWT baseline'; END IF;
END $guard$;
-- Six genuine, newly issued GoTrue JWTs; the unmapped JWT intentionally has no public.users row.
INSERT INTO public.users(id,academy_id,role) VALUES
 (:'owner_a_uuid'::uuid,'a0000000-0000-4000-8000-000000000001','academy_owner'),
 (:'owner_b_uuid'::uuid,'a0000000-0000-4000-8000-000000000002','academy_owner'),
 (:'coach_uuid'::uuid,'a0000000-0000-4000-8000-000000000001','coach'),
 (:'parent_uuid'::uuid,'a0000000-0000-4000-8000-000000000001','parent'),
 (:'super_admin_uuid'::uuid,NULL,'super_admin');

-- Minimal source-required mutation columns only; not full application migrations.
ALTER TABLE public.payments ADD COLUMN related_payment_id uuid REFERENCES public.payments(id);
CREATE TABLE public.payment_corrections (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 payment_id uuid NOT NULL REFERENCES public.payments(id),
 due_id uuid NOT NULL REFERENCES public.payment_dues(id),
 player_id uuid NOT NULL REFERENCES public.players(id),
 original_amount numeric NOT NULL,
 corrected_amount numeric NOT NULL,
 adjustment_amount numeric NOT NULL,
 reason text NOT NULL,
 status text NOT NULL DEFAULT 'pending',
 requested_by uuid NOT NULL,
 rejection_reason text,
 approved_by uuid,
 approved_at timestamptz,
 requested_at timestamptz NOT NULL DEFAULT now(),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.payment_corrections ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.payment_corrections FROM PUBLIC,anon,authenticated;
-- Force an exception after private payment number generation to verify transaction rollback.
CREATE TABLE public.ag34d32_fault_switch (enabled boolean NOT NULL);
INSERT INTO public.ag34d32_fault_switch VALUES (false);
ALTER TABLE public.ag34d32_fault_switch ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ag34d32_fault_switch FROM PUBLIC,anon,authenticated;
CREATE FUNCTION private.ag34d32_fail_late() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $fault$
BEGIN
 IF NEW.payment_entry_type='adjustment'
   AND EXISTS (SELECT 1 FROM public.ag34d32_fault_switch WHERE enabled)
 THEN RAISE EXCEPTION 'AG34D32 synthetic adjustment rollback'; END IF;
 RETURN NEW;
END $fault$;
CREATE TRIGGER ag34d32_fail_adjustment BEFORE INSERT ON public.payments
 FOR EACH ROW EXECUTE FUNCTION private.ag34d32_fail_late();
-- The original deployed pg_get_functiondef sources follow verbatim.
CREATE OR REPLACE FUNCTION public.approve_payment_correction(p_correction_id uuid)
 RETURNS TABLE(correction_id uuid, adjustment_payment_id uuid, transaction_reference text, receipt_number text, adjustment_amount numeric, remaining_amount numeric, due_status text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_correction public.payment_corrections%rowtype;
  v_due public.payment_dues%rowtype;
  v_role text;
  v_user_id uuid;
  v_new_paid numeric;
  v_remaining numeric;
  v_status text;
  v_txn_ref text;
  v_receipt text;
  v_adjustment_payment_id uuid;
  v_payment_date timestamptz := now();
begin
  v_user_id := auth.uid();
  v_role := private.current_user_role();

  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  if v_role not in ('super_admin', 'academy_owner') then
    raise exception 'Only Academy Owner or Super Admin can approve corrections';
  end if;

  select *
  into v_correction
  from public.payment_corrections
  where id = p_correction_id
  for update;

  if not found then
    raise exception 'Payment correction not found';
  end if;

  if v_correction.status <> 'pending' then
    raise exception 'Only pending corrections can be approved';
  end if;

  if v_role = 'academy_owner'
     and not private.is_payment_player_in_current_academy(v_correction.player_id) then
    raise exception 'You are not authorized to approve this correction';
  end if;

  select *
  into v_due
  from public.payment_dues
  where id = v_correction.due_id
  for update;

  if not found then
    raise exception 'Payment due not found';
  end if;

  v_new_paid :=
    coalesce(v_due.paid_amount, 0)
    + v_correction.adjustment_amount;

  if v_new_paid < 0 then
    raise exception 'Correction would make paid amount negative';
  end if;

  if v_new_paid > v_due.total_amount then
    raise exception 'Correction would overpay the payment due';
  end if;

  v_remaining := v_due.total_amount - v_new_paid;

  v_status :=
    case
      when v_new_paid = 0 then 'pending'
      when v_new_paid = v_due.total_amount then 'paid'
      else 'partial'
    end;

  v_txn_ref :=
    private.next_payment_number(
      'transaction',
      v_payment_date::date
    );

  v_receipt :=
    private.next_payment_number(
      'receipt',
      v_payment_date::date
    );

  insert into public.payments (
    due_id,
    player_id,
    payment_date,
    amount_paid,
    payment_mode,
    transaction_reference,
    collected_by,
    collected_by_user_id,
    payment_entry_type,
    related_payment_id,
    remarks,
    receipt_number
  )
  values (
    v_correction.due_id,
    v_correction.player_id,
    v_payment_date,
    v_correction.adjustment_amount,
    'adjustment',
    v_txn_ref,
    null,
    v_user_id,
    'adjustment',
    v_correction.payment_id,
    'Payment correction adjustment',
    v_receipt
  )
  returning id into v_adjustment_payment_id;

  perform set_config(
    'acadpro.payment_write_operation',
    'adjustment',
    true
  );

  update public.payment_dues
  set
    paid_amount = v_new_paid,
    due_status = v_status
  where id = v_due.id;

  update public.payment_corrections
  set
    status = 'approved',
    approved_by = v_user_id,
    approved_at = v_payment_date,
    updated_at = v_payment_date
  where id = v_correction.id;

  return query
  select
    v_correction.id,
    v_adjustment_payment_id,
    v_txn_ref,
    v_receipt,
    v_correction.adjustment_amount,
    v_remaining,
    v_status;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.reject_payment_correction(p_correction_id uuid, p_rejection_reason text)
 RETURNS payment_corrections
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_correction public.payment_corrections%rowtype;
  v_role text;
  v_user_id uuid;
begin
  v_user_id := auth.uid();
  v_role := private.current_user_role();

  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  if v_role not in ('super_admin', 'academy_owner') then
    raise exception 'Only Academy Owner or Super Admin can reject corrections';
  end if;

  if p_rejection_reason is null or length(btrim(p_rejection_reason)) < 5 then
    raise exception 'A rejection reason of at least 5 characters is required';
  end if;

  select *
  into v_correction
  from public.payment_corrections
  where id = p_correction_id
  for update;

  if not found then
    raise exception 'Payment correction not found';
  end if;

  if v_correction.status <> 'pending' then
    raise exception 'Only pending corrections can be rejected';
  end if;

  if v_role = 'academy_owner'
     and not private.is_payment_player_in_current_academy(v_correction.player_id) then
    raise exception 'You are not authorized to reject this correction';
  end if;

  update public.payment_corrections
  set
    status = 'rejected',
    rejection_reason = btrim(p_rejection_reason),
    approved_by = v_user_id,
    approved_at = now(),
    updated_at = now()
  where id = v_correction.id
  returning * into v_correction;

  return v_correction;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.request_payment_correction(p_payment_id uuid, p_corrected_amount numeric, p_reason text)
 RETURNS payment_corrections
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_payment public.payments%rowtype;
  v_correction public.payment_corrections%rowtype;
  v_role text;
  v_user_id uuid;
begin
  v_user_id := auth.uid();
  v_role := private.current_user_role();

  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  if v_role not in ('super_admin', 'academy_owner') then
    raise exception 'Only Academy Owner or Super Admin can request payment corrections';
  end if;

  if p_payment_id is null then
    raise exception 'Payment is required';
  end if;

  if p_corrected_amount is null or p_corrected_amount <= 0 then
    raise exception 'Corrected amount must be greater than zero';
  end if;

  if p_reason is null or length(btrim(p_reason)) < 5 then
    raise exception 'A correction reason of at least 5 characters is required';
  end if;

  select *
  into v_payment
  from public.payments
  where id = p_payment_id
    and payment_entry_type = 'payment'
  for update;

  if not found then
    raise exception 'Original payment not found';
  end if;

  if v_role = 'academy_owner'
     and not private.is_payment_player_in_current_academy(v_payment.player_id) then
    raise exception 'You are not authorized to correct this payment';
  end if;

  if p_corrected_amount = v_payment.amount_paid then
    raise exception 'Corrected amount must differ from the original amount';
  end if;

  if exists (
    select 1
    from public.payment_corrections pc
    where pc.payment_id = v_payment.id
      and pc.status = 'pending'
  ) then
    raise exception 'A correction is already pending for this payment';
  end if;

  insert into public.payment_corrections (
    payment_id,
    due_id,
    player_id,
    original_amount,
    corrected_amount,
    adjustment_amount,
    reason,
    status,
    requested_by
  )
  values (
    v_payment.id,
    v_payment.due_id,
    v_payment.player_id,
    v_payment.amount_paid,
    p_corrected_amount,
    p_corrected_amount - v_payment.amount_paid,
    btrim(p_reason),
    'pending',
    v_user_id
  )
  returning * into v_correction;

  return v_correction;
end;
$function$
;
REVOKE ALL ON FUNCTION public.approve_payment_correction(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.approve_payment_correction(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.reject_payment_correction(uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reject_payment_correction(uuid,text) TO authenticated;
REVOKE ALL ON FUNCTION public.request_payment_correction(uuid,numeric,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.request_payment_correction(uuid,numeric,text) TO authenticated;

DO $verify$
BEGIN
 IF (SELECT count(*) FROM public.users)<>26
 OR (SELECT count(*) FROM public.payment_corrections)<>0
 OR (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='private')<>21
 OR md5(pg_get_functiondef('public.request_payment_correction(uuid,numeric,text)'::regprocedure))<>'9e2900dd0a7c960554896e0e51b23075'
 OR md5(pg_get_functiondef('public.approve_payment_correction(uuid)'::regprocedure))<>'adfb6a80c05255e6d250207ae1e3ae1d'
 OR md5(pg_get_functiondef('public.reject_payment_correction(uuid,text)'::regprocedure))<>'c21c953c1ac3e9afa201e5ec7c28c4e5'
 OR has_table_privilege('authenticated','public.payment_corrections','INSERT')
 OR has_table_privilege('authenticated','public.payment_corrections','UPDATE')
 OR has_table_privilege('anon','public.payment_corrections','SELECT')
 OR NOT has_function_privilege('authenticated','public.request_payment_correction(uuid,numeric,text)','EXECUTE')
 OR NOT has_function_privilege('authenticated','public.approve_payment_correction(uuid)','EXECUTE')
 OR NOT has_function_privilege('authenticated','public.reject_payment_correction(uuid,text)','EXECUTE')
 OR has_function_privilege('anon','public.request_payment_correction(uuid,numeric,text)','EXECUTE')
 OR has_function_privilege('anon','public.approve_payment_correction(uuid)','EXECUTE')
 OR has_function_privilege('anon','public.reject_payment_correction(uuid,text)','EXECUTE')
 THEN RAISE EXCEPTION 'AG3.4D3.2 exact-source checksum or privileges differ'; END IF;
END $verify$;
NOTIFY pgrst,'reload schema';
COMMIT;
SELECT 'AG3.4D3.2 ORIGINAL CORRECTION RPCS SOURCE MATCHED IN SCRATCH' AS checkpoint;
