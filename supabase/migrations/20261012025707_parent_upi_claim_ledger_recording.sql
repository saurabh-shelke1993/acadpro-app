-- P1.5: atomically record an accepted parent UPI claim in the payment ledger.
-- The existing collect_payment RPC remains the sole creator of payments and fee balance updates.

ALTER TABLE public.parent_payment_submissions
  ADD COLUMN payment_id uuid,
  ADD COLUMN recorded_by_user_id uuid REFERENCES public.users(id) ON DELETE RESTRICT,
  ADD COLUMN recorded_at timestamptz;

ALTER TABLE public.parent_payment_submissions
  ADD CONSTRAINT parent_payment_submissions_payment_id_fkey
    FOREIGN KEY (payment_id) REFERENCES public.payments(id) ON DELETE RESTRICT,
  ADD CONSTRAINT parent_payment_submissions_record_state
    CHECK (
      (status = 'recorded' AND payment_id IS NOT NULL AND recorded_by_user_id IS NOT NULL AND recorded_at IS NOT NULL)
      OR
      (status <> 'recorded' AND payment_id IS NULL AND recorded_by_user_id IS NULL AND recorded_at IS NULL)
    );

ALTER TABLE public.parent_payment_submissions
  DROP CONSTRAINT IF EXISTS parent_payment_submissions_status_check;
ALTER TABLE public.parent_payment_submissions
  ADD CONSTRAINT parent_payment_submissions_status_check
    CHECK (status IN ('pending', 'accepted', 'rejected', 'recorded'));

ALTER TABLE public.parent_payment_submissions
  DROP CONSTRAINT IF EXISTS parent_payment_submissions_review_state;
ALTER TABLE public.parent_payment_submissions
  ADD CONSTRAINT parent_payment_submissions_review_state
    CHECK (
      (status = 'pending' AND reviewed_by_user_id IS NULL AND reviewed_at IS NULL)
      OR
      (status IN ('accepted', 'rejected', 'recorded') AND reviewed_by_user_id IS NOT NULL AND reviewed_at IS NOT NULL)
    );

CREATE UNIQUE INDEX parent_payment_submissions_payment_id_unique_idx
  ON public.parent_payment_submissions (payment_id)
  WHERE payment_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.record_accepted_parent_upi_submission(
  p_submission_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_role text;
  v_submission public.parent_payment_submissions%rowtype;
  v_due public.payment_dues%rowtype;
  v_collection record;
  v_remarks text;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  v_role := private.current_user_role();
  IF v_role <> 'academy_owner' THEN
    RAISE EXCEPTION 'Only the Academy Owner can record an accepted parent UPI claim';
  END IF;

  IF p_submission_id IS NULL THEN
    RAISE EXCEPTION 'Payment claim is required';
  END IF;

  SELECT *
  INTO v_submission
  FROM public.parent_payment_submissions
  WHERE id = p_submission_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payment claim not found';
  END IF;

  IF v_submission.academy_id IS DISTINCT FROM (SELECT private.current_academy_id()) THEN
    RAISE EXCEPTION 'You are not authorized to record this academy payment claim';
  END IF;

  IF v_submission.status = 'recorded' OR v_submission.payment_id IS NOT NULL THEN
    RAISE EXCEPTION 'This payment claim has already been recorded';
  END IF;

  IF v_submission.status <> 'accepted' THEN
    RAISE EXCEPTION 'Only accepted payment claims can be recorded';
  END IF;

  SELECT *
  INTO v_due
  FROM public.payment_dues
  WHERE id = v_submission.due_id
  FOR UPDATE;

  IF NOT FOUND OR v_due.player_id IS DISTINCT FROM v_submission.player_id THEN
    RAISE EXCEPTION 'The fee due associated with this claim is no longer valid';
  END IF;

  IF v_due.due_status = 'paid'
     OR v_submission.amount > (v_due.total_amount - COALESCE(v_due.paid_amount, 0)) THEN
    RAISE EXCEPTION 'The claim cannot be recorded because the current remaining due is %',
      (v_due.total_amount - COALESCE(v_due.paid_amount, 0));
  END IF;

  v_remarks := 'Parent UPI claim ' || v_submission.id::text
    || '; parent-reported payment date: ' || v_submission.payment_date::text;
  IF NULLIF(pg_catalog.btrim(v_submission.parent_note), '') IS NOT NULL THEN
    v_remarks := v_remarks || '; parent note: ' || pg_catalog.btrim(v_submission.parent_note);
  END IF;

  -- Existing secured RPC performs the payment INSERT, receipt generation and due update
  -- atomically. This wrapper transaction also updates the external UPI reference and claim.
  SELECT *
  INTO v_collection
  FROM public.collect_payment(
    v_submission.due_id,
    v_submission.amount,
    'upi',
    v_remarks
  );

  IF v_collection.payment_id IS NULL OR v_collection.receipt_number IS NULL THEN
    RAISE EXCEPTION 'Payment collection did not return a payment and receipt';
  END IF;

  UPDATE public.payments
  SET external_transaction_reference = v_submission.transaction_reference
  WHERE id = v_collection.payment_id;

  UPDATE public.parent_payment_submissions
  SET status = 'recorded',
      payment_id = v_collection.payment_id,
      recorded_by_user_id = v_user_id,
      recorded_at = pg_catalog.now(),
      updated_at = pg_catalog.now()
  WHERE id = v_submission.id;

  RETURN pg_catalog.jsonb_build_object(
    'submission_id', v_submission.id,
    'payment_id', v_collection.payment_id,
    'receipt_number', v_collection.receipt_number,
    'transaction_reference', v_collection.transaction_reference,
    'external_transaction_reference', v_submission.transaction_reference,
    'amount_paid', v_collection.amount_paid,
    'payment_date', v_collection.payment_date,
    'remaining_amount', v_collection.remaining_amount,
    'due_status', v_collection.due_status,
    'status', 'recorded'
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.record_accepted_parent_upi_submission(uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_accepted_parent_upi_submission(uuid)
  TO authenticated;
