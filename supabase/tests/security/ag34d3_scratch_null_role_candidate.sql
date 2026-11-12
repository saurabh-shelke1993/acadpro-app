-- AG34-HIGH-002 candidate: ONLY scratch null-role denial, never hosted migration.
-- Requires source-attested D3 exact live function deployed in disposable stack.
BEGIN;
DO $guard$
BEGIN
 IF current_database()<>'postgres' OR current_user<>'postgres'
    OR session_user<>'postgres'
    OR (SELECT count(*) FROM auth.users)<>23
    OR md5(pg_get_functiondef('public.collect_payment(uuid,numeric,text,text)'::regprocedure))
       <>'fcc5610c509392caf81ffa99b82051a9'
 THEN RAISE EXCEPTION 'AG34-HIGH-002 scratch-only null role patch guard failed'; END IF;
END $guard$;
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
DO $assert$
BEGIN
 IF position('if v_role is null or v_role not in' in
             lower(pg_get_functiondef('public.collect_payment(uuid,numeric,text,text)'::regprocedure)))=0
 OR has_function_privilege('anon','public.collect_payment(uuid,numeric,text,text)','EXECUTE')
 THEN RAISE EXCEPTION 'AG34-HIGH-002 candidate guard not effective'; END IF;
END $assert$;
NOTIFY pgrst,'reload schema';
COMMIT;
SELECT 'AG34-HIGH-002 NULL ROLE CANDIDATE INSTALLED IN SCRATCH' AS checkpoint;
