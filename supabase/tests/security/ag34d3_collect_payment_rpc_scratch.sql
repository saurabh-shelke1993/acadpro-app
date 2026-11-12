-- AG3.4D3.1: Source-attested live collect_payment + next_payment_number.
-- ONLY disposable, unlinked native GoTrue/PostgREST; no hosted DDL or migrations.
-- Requires AG3.4C2 then AG3.4D1 green role fixture, plus 6 new GoTrue sessions.
BEGIN;
DO $guard$
BEGIN
 IF current_database()<>'postgres' OR current_user<>'postgres' OR session_user<>'postgres'
 OR (SELECT count(*) FROM auth.users)<>23
 OR (SELECT count(*) FROM public.users)<>16
 OR (SELECT count(*) FROM public.payment_dues)<>3
 OR (SELECT count(*) FROM public.payments)<>3
 OR (SELECT count(*) FROM public.parent_payment_submissions)<>3
 OR (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='private')<>18
 OR to_regclass('public.payment_number_counters') IS NOT NULL
 OR to_regprocedure('public.collect_payment(uuid,numeric,text,text)') IS NOT NULL
 OR EXISTS (SELECT 1 FROM information_schema.columns
   WHERE table_schema='public' AND table_name='payment_dues' AND column_name='total_amount')
 THEN RAISE EXCEPTION 'AG3.4D3 refuses non-disposable or drifted finance baseline'; END IF;
END $guard$;

INSERT INTO public.users (id,academy_id,role) VALUES
 (:'owner_a_uuid'::uuid, 'a0000000-0000-4000-8000-000000000001','academy_owner'),
 (:'owner_b_uuid'::uuid, 'a0000000-0000-4000-8000-000000000002','academy_owner'),
 (:'coach_uuid'::uuid, 'a0000000-0000-4000-8000-000000000001','coach'),
 (:'parent_uuid'::uuid, 'a0000000-0000-4000-8000-000000000001','parent'),
 (:'super_admin_uuid'::uuid, NULL,'super_admin');

-- Minimal, explicit scratch-only mutation schema. No claim of full hosted schema parity.
ALTER TABLE public.payment_dues
 ADD COLUMN total_amount numeric NOT NULL DEFAULT 100,
 ADD COLUMN paid_amount numeric NOT NULL DEFAULT 0,
 ADD COLUMN due_status text NOT NULL DEFAULT 'pending';

ALTER TABLE public.payments
 ALTER COLUMN id SET DEFAULT gen_random_uuid(),
 ADD COLUMN due_id uuid REFERENCES public.payment_dues(id),
 ADD COLUMN payment_date timestamptz DEFAULT now(),
 ADD COLUMN amount_paid numeric NOT NULL DEFAULT 0,
 ADD COLUMN payment_mode text,
 ADD COLUMN transaction_reference text,
 ADD COLUMN collected_by uuid,
 ADD COLUMN collected_by_user_id uuid,
 ADD COLUMN payment_entry_type text NOT NULL DEFAULT 'payment',
 ADD COLUMN remarks text,
 ADD COLUMN receipt_number text;

CREATE TABLE public.payment_number_counters (
 counter_date date NOT NULL, number_type text NOT NULL,
 next_value bigint NOT NULL DEFAULT 1,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY (counter_date,number_type)
);
ALTER TABLE public.payment_number_counters ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.payment_number_counters FROM PUBLIC, anon, authenticated;

-- Exact deployed source, captured read-only from pg_get_functiondef().
CREATE OR REPLACE FUNCTION private.next_payment_number(p_number_type text, p_date date)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
$function$
;

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
$function$
;

REVOKE ALL ON FUNCTION public.collect_payment(uuid,numeric,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.collect_payment(uuid,numeric,text,text) TO authenticated;
REVOKE ALL ON FUNCTION private.next_payment_number(text,date) FROM PUBLIC,anon,authenticated;

-- Controlled, scratch-only late-stage failure injection: checks atomic rollback.
CREATE FUNCTION private.ag34d3_abort_if_marked() RETURNS trigger LANGUAGE plpgsql
 SECURITY DEFINER SET search_path TO '' AS $trap$
BEGIN
 IF NEW.remarks='AG34D3_ABORT' THEN RAISE EXCEPTION 'AG34D3 scratch transaction abort'; END IF;
 RETURN NEW;
END $trap$;
CREATE TRIGGER ag34d3_abort_payment BEFORE INSERT ON public.payments
 FOR EACH ROW EXECUTE FUNCTION private.ag34d3_abort_if_marked();

DO $verify$
BEGIN
 IF md5(pg_get_functiondef('public.collect_payment(uuid,numeric,text,text)'::regprocedure))
      <>'fcc5610c509392caf81ffa99b82051a9'
 OR md5(pg_get_functiondef('private.next_payment_number(text,date)'::regprocedure))
      <>'b5b81f242c8378bf91cbbfcf458ce5cb'
 OR (SELECT count(*) FROM public.users)<>21
 OR (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='private')<>20
 OR NOT has_function_privilege('authenticated','public.collect_payment(uuid,numeric,text,text)','EXECUTE')
 OR has_function_privilege('anon','public.collect_payment(uuid,numeric,text,text)','EXECUTE')
 OR has_table_privilege('authenticated','public.payments','INSERT')
 OR has_table_privilege('authenticated','public.payment_dues','UPDATE')
 OR has_table_privilege('authenticated','public.payment_number_counters','SELECT')
 THEN RAISE EXCEPTION 'AG3.4D3 source identity or privileges diverged'; END IF;
END $verify$;
NOTIFY pgrst, 'reload schema';
COMMIT;
SELECT 'AG3.4D3 COLLECT PAYMENT SOURCE REPLAY INSTALLED ONLY IN SCRATCH' AS checkpoint;
