-- AcadPro: simplify payment responsibility to administration roles only.
-- Coaches do not collect, view payment ledgers, or request payment corrections.
-- Academy Owner and Super Admin remain the financial operators.

-- =====================================================
-- 1. Restrict atomic payment collection to administration
-- =====================================================

create or replace function public.collect_payment(
  p_due_id uuid,
  p_amount numeric,
  p_payment_mode text,
  p_remarks text default null
)
returns table (
  payment_id uuid,
  due_id uuid,
  transaction_reference text,
  receipt_number text,
  payment_date timestamptz,
  amount_paid numeric,
  payment_mode text,
  remaining_amount numeric,
  due_status text
)
language plpgsql
security definer
set search_path = ''
as $$
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

  if v_role not in ('super_admin', 'academy_owner') then
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
     and not private.is_payment_due_in_current_academy(v_due.player_id) then
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
$$;

revoke execute on function public.collect_payment(uuid, numeric, text, text) from public, anon;
grant execute on function public.collect_payment(uuid, numeric, text, text) to authenticated;

-- =====================================================
-- 2. Restrict correction requests to administration
-- =====================================================

create or replace function public.request_payment_correction(
  p_payment_id uuid,
  p_corrected_amount numeric,
  p_reason text
)
returns public.payment_corrections
language plpgsql
security definer
set search_path = ''
as $$
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
$$;

revoke execute on function public.request_payment_correction(uuid, numeric, text) from public, anon;
grant execute on function public.request_payment_correction(uuid, numeric, text) to authenticated;

-- =====================================================
-- 3. Remove Coach payment read/correction access
-- =====================================================

drop policy if exists payments_coach_select on public.payments;
drop policy if exists payment_dues_coach_select on public.payment_dues;
drop policy if exists payment_corrections_coach_select on public.payment_corrections;

-- The helper was only used by the Coach payment policies and
-- Coach payment authorization branches, which are now removed.
drop function if exists private.is_coach_payment_player(uuid);
