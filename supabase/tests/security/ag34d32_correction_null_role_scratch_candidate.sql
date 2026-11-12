-- AG34-HIGH-002 payment correction scratch-only candidate: never deploy without migration approval.
-- Applies only after signed JWT exploit probes of the exact source. No hosted project.
BEGIN;
DO $guard$
BEGIN
 IF current_database()<>'postgres' OR current_user<>'postgres' OR session_user<>'postgres'
 OR (SELECT count(*) FROM auth.users)<>29 OR (SELECT count(*) FROM public.users)<>26
 OR (SELECT count(*) FROM public.payment_corrections)<2
 OR md5(pg_get_functiondef('public.request_payment_correction(uuid,numeric,text)'::regprocedure))<>'9e2900dd0a7c960554896e0e51b23075'
 OR md5(pg_get_functiondef('public.approve_payment_correction(uuid)'::regprocedure))<>'adfb6a80c05255e6d250207ae1e3ae1d'
 OR md5(pg_get_functiondef('public.reject_payment_correction(uuid,text)'::regprocedure))<>'c21c953c1ac3e9afa201e5ec7c28c4e5'
 THEN RAISE EXCEPTION 'AG34-HIGH-002 correction candidate refuses non-source-attested scratch'; END IF;
END $guard$;
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

  if v_role is null or v_role not in ('super_admin', 'academy_owner') then
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

  if v_role is null or v_role not in ('super_admin', 'academy_owner') then
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

  if v_role is null or v_role not in ('super_admin', 'academy_owner') then
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

DO $verify$
BEGIN
 IF (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON p.pronamespace=n.oid
 WHERE n.nspname='public' AND p.proname IN ('approve_payment_correction','reject_payment_correction','request_payment_correction')
 AND position('if v_role is null or v_role not in' in lower(pg_get_functiondef(p.oid)))>0)<>3
 OR has_function_privilege('anon','public.approve_payment_correction(uuid)','EXECUTE')
 OR has_function_privilege('anon','public.reject_payment_correction(uuid,text)','EXECUTE')
 OR has_function_privilege('anon','public.request_payment_correction(uuid,numeric,text)','EXECUTE')
 THEN RAISE EXCEPTION 'AG34-HIGH-002 correction candidate null-role denial not installed'; END IF;
END $verify$;
NOTIFY pgrst,'reload schema';
COMMIT;
SELECT 'AG34-HIGH-002 SCRATCH CORRECTION NULL ROLE CANDIDATE INSTALLED' AS checkpoint;
