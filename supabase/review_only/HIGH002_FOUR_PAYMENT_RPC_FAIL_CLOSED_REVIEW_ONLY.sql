-- KHELTRIVA HIGH-002 | SEC-2 REVIEW ONLY | 2026-11-13
-- DO NOT EXECUTE ON HOSTED SUPABASE. NOT A MIGRATION OR RELEASE APPROVAL.
-- Generated from the 4 exact pg_get_functiondef() bodies read from the
-- active hosted database on 2026-11-13; guard replacements are the ONLY
-- functional modifications. NO payment/due data DML, table, policy or grant change.
--
-- Deployment, if authorized LATER: approved backup and restore rehearsal,
-- controlled isolated application, real signed-JWT positive/negative testing,
-- and original-source checksum comparison. No supabase db push.
BEGIN;
SET LOCAL search_path TO public, pg_catalog;
DO $high002_source_preflight$
DECLARE
  v_name text;
  v_expected_md5 text;
  v_expected_signature text;
  v_current_md5 text;
  v_current_signature text;
  v_current_owner text;
  v_definer boolean;
BEGIN
  FOR v_name,v_expected_md5,v_expected_signature IN
    SELECT * FROM (VALUES
      ('approve_payment_correction', 'adfb6a80c05255e6d250207ae1e3ae1d', 'p_correction_id uuid'),
      ('collect_payment', 'fcc5610c509392caf81ffa99b82051a9', 'p_due_id uuid, p_amount numeric, p_payment_mode text, p_remarks text'),
      ('reject_payment_correction', 'c21c953c1ac3e9afa201e5ec7c28c4e5', 'p_correction_id uuid, p_rejection_reason text'),
      ('request_payment_correction', '9e2900dd0a7c960554896e0e51b23075', 'p_payment_id uuid, p_corrected_amount numeric, p_reason text')
    ) AS expected(function_name,source_md5,signature)
  LOOP
    SELECT md5(pg_get_functiondef(p.oid)),
           pg_get_function_identity_arguments(p.oid),
           pg_get_userbyid(p.proowner),
           p.prosecdef
    INTO v_current_md5, v_current_signature, v_current_owner, v_definer
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.proname=v_name;

    IF v_current_md5 IS DISTINCT FROM v_expected_md5
       OR v_current_signature IS DISTINCT FROM v_expected_signature
       OR v_current_owner IS DISTINCT FROM 'postgres'
       OR v_definer IS DISTINCT FROM true THEN
      RAISE EXCEPTION 'HIGH-002 source or metadata drift in %. Stop and review.',v_name;
    END IF;
  END LOOP;
END;
$high002_source_preflight$;

-- approve_payment_correction | original md5(pg_get_functiondef)=adfb6a80c05255e6d250207ae1e3ae1d
-- ONLY change #1: reject unmapped/NULL role.
-- ONLY change #2: reject false OR NULL academy-membership helper.
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
     and private.is_payment_player_in_current_academy(v_correction.player_id) is not true then
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
$function$;
 
-- collect_payment | original md5(pg_get_functiondef)=fcc5610c509392caf81ffa99b82051a9
-- ONLY change #1: reject unmapped/NULL role.
-- ONLY change #2: reject false OR NULL academy-membership helper.
CREATE OR REPLACE FUNCTION public.collect_payment(p_due_id uuid, p_amount numeric, p_payment_mode text, p_remarks text DEFAULT NULL::text)
 RETURNS TABLE(payment_id uuid, due_id uuid, transaction_reference text, receipt_number text, payment_date timestamp with time zone, amount_paid numeric, payment_mode text, remaining_amount numeric, due_status text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_due public.payment_dues%rowtype;
  v_role text;
  v_user_id uuid;
  v_new_paid numeric;
  v_remaining numeric;
  v_status text;
  v_payment_id uuid;
  v_txn_ref text;
  v_receipt text;
  v_payment_date timestamptz := now();
begin
  v_user_id := auth.uid();
  v_role := private.current_user_role();

  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  if v_role is null or v_role not in ('super_admin', 'academy_owner') then
    raise exception 'Only Academy Owner or Super Admin can collect payments';
  end if;

  if p_due_id is null then
    raise exception 'Payment due is required';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'Payment amount must be greater than zero';
  end if;

  if p_payment_mode not in ('cash', 'upi', 'bank_transfer') then
    raise exception 'Unsupported payment mode';
  end if;

  select *
  into v_due
  from public.payment_dues
  where id = p_due_id
  for update;

  if not found then
    raise exception 'Payment due not found';
  end if;

  if v_role = 'academy_owner'
     and private.is_payment_due_in_current_academy(v_due.player_id) is not true then
    raise exception 'You are not authorized to collect this payment';
  end if;

  if v_due.due_status = 'paid' then
    raise exception 'This payment due is already fully paid';
  end if;

  v_new_paid := coalesce(v_due.paid_amount, 0) + p_amount;

  if v_new_paid > v_due.total_amount then
    raise exception
      'Payment exceeds the remaining due amount of ₹%s',
      (v_due.total_amount - coalesce(v_due.paid_amount, 0));
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
    remarks,
    receipt_number
  )
  values (
    v_due.id,
    v_due.player_id,
    v_payment_date,
    p_amount,
    p_payment_mode,
    v_txn_ref,
    null,
    v_user_id,
    'payment',
    p_remarks,
    v_receipt
  )
  returning id into v_payment_id;

  perform set_config(
    'acadpro.payment_write_operation',
    'collect',
    true
  );

  update public.payment_dues
  set
    paid_amount = v_new_paid,
    due_status = v_status
  where id = v_due.id;

  return query
  select
    v_payment_id,
    v_due.id,
    v_txn_ref,
    v_receipt,
    v_payment_date,
    p_amount,
    p_payment_mode,
    v_remaining,
    v_status;
end;
$function$;
 
-- reject_payment_correction | original md5(pg_get_functiondef)=c21c953c1ac3e9afa201e5ec7c28c4e5
-- ONLY change #1: reject unmapped/NULL role.
-- ONLY change #2: reject false OR NULL academy-membership helper.
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
     and private.is_payment_player_in_current_academy(v_correction.player_id) is not true then
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
$function$;
 
-- request_payment_correction | original md5(pg_get_functiondef)=9e2900dd0a7c960554896e0e51b23075
-- ONLY change #1: reject unmapped/NULL role.
-- ONLY change #2: reject false OR NULL academy-membership helper.
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
     and private.is_payment_player_in_current_academy(v_payment.player_id) is not true then
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
$function$;
 
-- No DML. No ACL/policy/table change. CREATE OR REPLACE retains existing
-- function identities and grants, and preserves their current SECURITY DEFINER,
-- empty search_path, arguments, return types and financial business logic.
-- SEC-3 must prove real signed-JWT negative cases before ANY hosted execution.
COMMIT;
