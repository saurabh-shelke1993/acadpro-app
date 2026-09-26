-- AcadPro: reconcile four legacy payment_dues rows created before
-- the immutable payment ledger / overpayment guardrail was introduced.
--
-- These rows had aggregate paid_amount values exactly ₹100 above total_amount,
-- but no corresponding payment ledger rows. We therefore normalize the due
-- aggregate to "paid" without inventing payment events in public.payments.
--
-- This migration is intentionally scoped to the four audited legacy IDs.

do $$
declare
  v_expected integer := 4;
  v_actual integer;
begin
  select count(*)
    into v_actual
  from public.payment_dues
  where id in (
    '9b1403b3-aa87-410b-97d5-250d21063116'::uuid,
    'f7e8280c-429e-4f39-9053-64be13e54f93'::uuid,
    '60062666-16e1-4890-b1c0-8b8952b1b360'::uuid,
    '363b517d-a398-4931-9ed3-c513ea1c0f86'::uuid
  )
  and total_amount = paid_amount - 100
  and remaining_amount = -100
  and due_status = 'paid';

  if v_actual <> v_expected then
    raise exception
      'Legacy payment reconciliation aborted: expected % exact anomalies, found %',
      v_expected,
      v_actual;
  end if;
end;
$$;

update public.payment_dues
set
  paid_amount = total_amount,
  due_status = 'paid',
  updated_at = now()
where id in (
  '9b1403b3-aa87-410b-97d5-250d21063116'::uuid,
  'f7e8280c-429e-4f39-9053-64be13e54f93'::uuid,
  '60062666-16e1-4890-b1c0-8b8952b1b360'::uuid,
  '363b517d-a398-4931-9ed3-c513ea1c0f86'::uuid
)
and total_amount = paid_amount - 100
and remaining_amount = -100
and due_status = 'paid';

do $$
declare
  v_remaining integer;
begin
  select count(*)
    into v_remaining
  from public.payment_dues
  where id in (
    '9b1403b3-aa87-410b-97d5-250d21063116'::uuid,
    'f7e8280c-429e-4f39-9053-64be13e54f93'::uuid,
    '60062666-16e1-4890-b1c0-8b8952b1b360'::uuid,
    '363b517d-a398-4931-9ed3-c513ea1c0f86'::uuid
  )
  and (
    paid_amount <> total_amount
    or remaining_amount <> 0
    or due_status <> 'paid'
  );

  if v_remaining <> 0 then
    raise exception
      'Legacy payment reconciliation verification failed: % rows remain inconsistent',
      v_remaining;
  end if;
end;
$$;
