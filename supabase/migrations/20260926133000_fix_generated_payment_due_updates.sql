-- AcadPro: fix payment collection writes for generated remaining_amount.
-- payment_dues.remaining_amount is GENERATED ALWAYS AS (total_amount - paid_amount).
-- It must never be assigned by UPDATE statements or accessed through NEW in a BEFORE trigger.

create or replace function private.enforce_payment_due_financial_state()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_operation text;
begin
  if new.total_amount < 0 then
    raise exception 'Payment due total amount cannot be negative';
  end if;

  if coalesce(new.paid_amount, 0) < 0 then
    raise exception 'Payment due paid amount cannot be negative';
  end if;

  if coalesce(new.paid_amount, 0) > new.total_amount then
    raise exception 'Payment due cannot be overpaid';
  end if;

  if tg_op = 'UPDATE' then
    if (
      old.total_amount is distinct from new.total_amount
      or old.paid_amount is distinct from new.paid_amount
      or old.due_status is distinct from new.due_status
    ) then
      v_operation := current_setting(
        'acadpro.payment_write_operation',
        true
      );

      if v_operation not in ('collect', 'adjustment') then
        raise exception
          'Payment due financial fields are system-managed';
      end if;
    end if;
  end if;

  new.paid_amount := coalesce(new.paid_amount, 0);
  new.due_status :=
    case
      when new.paid_amount = 0 then 'pending'
      when new.paid_amount = new.total_amount then 'paid'
      else 'partial'
    end;

  new.updated_at := now();

  return new;
end;
$$;

revoke execute on function private.enforce_payment_due_financial_state() from public, anon, authenticated;

drop trigger if exists payment_due_financial_state_trigger on public.payment_dues;

create trigger payment_due_financial_state_trigger
before insert or update
on public.payment_dues
for each row
execute function private.enforce_payment_due_financial_state();

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

  if v_role not in ('super_admin', 'academy_owner', 'coach') then
    raise exception 'You are not authorized to collect payments';
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

  if v_role = 'coach'
     and not private.is_coach_payment_player(v_due.player_id) then
    raise exception 'You are not authorized to collect this payment';
  end if;

  if v_role = 'super_admin' then
    null;
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

create or replace function public.approve_payment_correction(
  p_correction_id uuid
)
returns table (
  correction_id uuid,
  adjustment_payment_id uuid,
  transaction_reference text,
  receipt_number text,
  adjustment_amount numeric,
  remaining_amount numeric,
  due_status text
)
language plpgsql
security definer
set search_path = ''
as $$
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
$$;

revoke execute on function public.approve_payment_correction(uuid) from public, anon;
grant execute on function public.approve_payment_correction(uuid) to authenticated;
