-- AcadPro: Payment Module P1 financial foundation
-- Establishes immutable payment events, atomic collection/correction workflows,
-- database-generated references, and coach payment read/collect scope.

-- =====================================================
-- 1. Preserve legacy manually-entered transaction refs
-- =====================================================

alter table public.payments
  add column if not exists external_transaction_reference text;

update public.payments
set external_transaction_reference = transaction_reference
where transaction_reference is not null
  and btrim(transaction_reference) <> ''
  and external_transaction_reference is null;

-- transaction_reference becomes AcadPro's internal, system-generated reference.

alter table public.payments
  add column if not exists collected_by_user_id uuid references public.users(id) on delete set null;

update public.payments p
set collected_by_user_id = c.user_id
from public.coaches c
where p.collected_by = c.id
  and p.collected_by_user_id is null;

alter table public.payments
  add column if not exists payment_entry_type text not null default 'payment';

alter table public.payments
  add column if not exists related_payment_id uuid references public.payments(id) on delete restrict;

-- =====================================================
-- 2. Payment event invariants
-- =====================================================

alter table public.payments
  drop constraint if exists payments_amount_positive_check;

alter table public.payments
  add constraint payments_amount_by_entry_type_check
  check (
    (payment_entry_type = 'payment' and amount_paid > 0)
    or
    (payment_entry_type = 'adjustment' and amount_paid <> 0)
  );

alter table public.payments
  drop constraint if exists payments_entry_type_check;

alter table public.payments
  add constraint payments_entry_type_check
  check (payment_entry_type in ('payment', 'adjustment'));

-- =====================================================
-- 3. Number counter table
-- =====================================================

create table if not exists public.payment_number_counters (
  counter_date date not null,
  number_type text not null,
  next_value bigint not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (counter_date, number_type),
  constraint payment_number_counters_type_check
    check (number_type in ('transaction', 'receipt')),
  constraint payment_number_counters_next_value_check
    check (next_value >= 1)
);

alter table public.payment_number_counters enable row level security;

revoke all on table public.payment_number_counters from anon, authenticated;

-- =====================================================
-- 4. Internal number generator
-- =====================================================

create or replace function private.next_payment_number(
  p_number_type text,
  p_date date
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sequence bigint;
  v_prefix text;
begin
  if p_number_type not in ('transaction', 'receipt') then
    raise exception 'Unsupported payment number type';
  end if;

  insert into public.payment_number_counters (
    counter_date,
    number_type,
    next_value
  )
  values (
    p_date,
    p_number_type,
    2
  )
  on conflict (counter_date, number_type)
  do update
  set
    next_value = public.payment_number_counters.next_value + 1,
    updated_at = pg_catalog.now()
  returning next_value - 1
  into v_sequence;

  v_prefix :=
    case
      when p_number_type = 'transaction' then 'TXN-'
      else 'RCPT-'
    end
    || pg_catalog.to_char(p_date, 'YYYYMMDD');

  return v_prefix || '-' || pg_catalog.lpad(v_sequence::text, 5, '0');
end;
$$;

revoke execute on function private.next_payment_number(text, date) from public, anon, authenticated;

-- =====================================================
-- 5. Backfill internal transaction references
-- =====================================================

do $$
declare
  v_payment record;
begin
  for v_payment in
    select id, coalesce(payment_date, created_at, now())::date as payment_day
    from public.payments
    order by coalesce(payment_date, created_at, now()), id
  loop
    update public.payments
    set transaction_reference =
      private.next_payment_number('transaction', v_payment.payment_day)
    where id = v_payment.id;
  end loop;
end;
$$;

-- Preserve existing receipt numbers and seed the receipt counters from them.
insert into public.payment_number_counters (
  counter_date,
  number_type,
  next_value
)
select
  coalesce(payment_date, created_at, now())::date,
  'receipt',
  max(pg_catalog.split_part(receipt_number, '-', 3)::bigint) + 1
from public.payments
where receipt_number ~ '^RCPT-[0-9]{8}-[0-9]{5}$'
group by coalesce(payment_date, created_at, now())::date
on conflict (counter_date, number_type)
do update
set
  next_value = greatest(
    public.payment_number_counters.next_value,
    excluded.next_value
  ),
  updated_at = pg_catalog.now();

create unique index if not exists payments_transaction_reference_unique_idx
  on public.payments (transaction_reference)
  where transaction_reference is not null;

create unique index if not exists payments_receipt_number_unique_idx
  on public.payments (receipt_number)
  where receipt_number is not null;

-- =====================================================
-- 6. Correction workflow table
-- =====================================================

create table if not exists public.payment_corrections (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references public.payments(id) on delete restrict,
  due_id uuid not null references public.payment_dues(id) on delete restrict,
  player_id uuid not null references public.players(id) on delete restrict,

  original_amount numeric not null,
  corrected_amount numeric not null,
  adjustment_amount numeric not null,

  reason text not null,

  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected', 'cancelled')),

  requested_by uuid not null references public.users(id) on delete restrict,
  requested_at timestamptz not null default now(),

  approved_by uuid references public.users(id) on delete restrict,
  approved_at timestamptz,

  rejection_reason text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint payment_corrections_amounts_check
    check (
      original_amount > 0
      and corrected_amount > 0
      and adjustment_amount = corrected_amount - original_amount
      and adjustment_amount <> 0
    )
);

alter table public.payment_corrections enable row level security;

revoke all on table public.payment_corrections from anon, authenticated;
grant select on table public.payment_corrections to authenticated;

create index if not exists payment_corrections_payment_idx
  on public.payment_corrections (payment_id);

create index if not exists payment_corrections_due_idx
  on public.payment_corrections (due_id);

create index if not exists payment_corrections_player_idx
  on public.payment_corrections (player_id);

create index if not exists payment_corrections_status_idx
  on public.payment_corrections (status);

create unique index if not exists payment_corrections_one_pending_per_payment_idx
  on public.payment_corrections (payment_id)
  where status = 'pending';

-- =====================================================
-- 7. Coach payment scope helper
-- =====================================================

create or replace function private.is_coach_payment_player(
  p_player_id uuid
)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (
    select 1
    from public.players p
    join public.coaches c
      on c.user_id = (select auth.uid())
     and c.id = c.id
     and c.is_active = true
    join public.coach_batch_assignments cba
      on cba.coach_id = c.id
     and cba.batch_id = p.batch_id
     and cba.academy_id = p.academy_id
     and cba.is_active = true
    where p.id = p_player_id
      and p.batch_id is not null
  );
$$;

revoke execute on function private.is_coach_payment_player(uuid) from public, anon, authenticated;

-- =====================================================
-- 8. Payment RLS: immutable ledger
-- =====================================================

drop policy if exists payments_academy_owner_delete on public.payments;
drop policy if exists payments_academy_owner_insert on public.payments;
drop policy if exists payments_academy_owner_update on public.payments;
drop policy if exists payments_super_admin_all on public.payments;

create policy payments_super_admin_select
on public.payments
for select
to authenticated
using ((select private.is_super_admin()));

create policy payments_coach_select
on public.payments
for select
to authenticated
using (
  (select private.current_user_role()) = 'coach'
  and (select private.is_coach_payment_player(player_id))
);

-- Existing Academy Owner and Parent SELECT policies remain in place.

-- No direct INSERT/UPDATE/DELETE policy is created for authenticated users.
-- Payment writes must use the controlled SECURITY DEFINER functions below.

-- =====================================================
-- 9. Payment Due RLS: Coach read-only
-- =====================================================

create policy payment_dues_coach_select
on public.payment_dues
for select
to authenticated
using (
  (select private.current_user_role()) = 'coach'
  and (select private.is_coach_payment_player(player_id))
);

-- =====================================================
-- 10. Protect payment_due financial state
-- =====================================================

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
      or old.remaining_amount is distinct from new.remaining_amount
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
  new.remaining_amount := new.total_amount - new.paid_amount;

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

-- =====================================================
-- 11. Atomic payment collection
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
    remaining_amount = v_remaining,
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
-- 12. Request correction
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

  if v_role not in ('super_admin', 'academy_owner', 'coach') then
    raise exception 'You are not authorized to request payment corrections';
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

  if v_role = 'coach'
     and not private.is_coach_payment_player(v_payment.player_id) then
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
-- 13. Approve correction and apply adjustment atomically
-- =====================================================

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
    remaining_amount = v_remaining,
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

-- =====================================================
-- 14. Reject correction
-- =====================================================

create or replace function public.reject_payment_correction(
  p_correction_id uuid,
  p_rejection_reason text
)
returns public.payment_corrections
language plpgsql
security definer
set search_path = ''
as $$
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
$$;

revoke execute on function public.reject_payment_correction(uuid, text) from public, anon;
grant execute on function public.reject_payment_correction(uuid, text) to authenticated;

-- =====================================================
-- 15. Correction SELECT policies
-- =====================================================

create policy payment_corrections_super_admin_select
on public.payment_corrections
for select
to authenticated
using ((select private.is_super_admin()));

create policy payment_corrections_academy_owner_select
on public.payment_corrections
for select
to authenticated
using (
  (select private.is_academy_owner())
  and private.is_payment_player_in_current_academy(player_id)
);

create policy payment_corrections_coach_select
on public.payment_corrections
for select
to authenticated
using (
  (select private.current_user_role()) = 'coach'
  and private.is_coach_payment_player(player_id)
);

-- =====================================================
-- 16. Indexes for payment scope and history
-- =====================================================

create index if not exists payments_player_id_idx
  on public.payments (player_id);

create index if not exists payments_due_id_idx
  on public.payments (due_id);

create index if not exists payments_collected_by_user_id_idx
  on public.payments (collected_by_user_id);

create index if not exists payment_dues_player_id_idx
  on public.payment_dues (player_id);

create index if not exists coach_batch_assignments_coach_batch_active_idx
  on public.coach_batch_assignments (coach_id, batch_id)
  where is_active = true;
