-- AcadPro: backfill receipt numbers only for legacy payments that never had one.

do $$
declare
  v_payment record;
begin
  for v_payment in
    select id, coalesce(payment_date, created_at, now())::date as payment_day
    from public.payments
    where receipt_number is null
    order by coalesce(payment_date, created_at, now()), id
  loop
    update public.payments
    set receipt_number =
      private.next_payment_number('receipt', v_payment.payment_day)
    where id = v_payment.id;
  end loop;
end;
$$;
