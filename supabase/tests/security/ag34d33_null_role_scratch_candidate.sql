-- AG3.4D3.3 NULL-safe role candidates. ONLY after original-source JWT probes in scratch.
BEGIN;
DO $guard$
BEGIN
 IF current_database()<>'postgres' OR current_user<>'postgres' OR session_user<>'postgres'
 OR (SELECT count(*) FROM auth.users)<>36
 OR md5(pg_get_functiondef('public.submit_parent_upi_payment(uuid,numeric,text,date,text)'::regprocedure))<>'d3788514af85e404504861936cfef20e'
 OR md5(pg_get_functiondef('public.review_parent_upi_payment(uuid,text,text)'::regprocedure))<>'33852ded2505672448ed44ccf46a43e2'
 OR md5(pg_get_functiondef('public.record_accepted_parent_upi_submission(uuid)'::regprocedure))<>'ff98c595f28944f33b7a8f50b4177722'
 OR (SELECT count(*) FROM public.parent_payment_submissions)<4
 THEN RAISE EXCEPTION 'AG3.4D3.3 candidate refuses non-original or untested scratch source'; END IF;
END $guard$;
CREATE OR REPLACE FUNCTION public.record_accepted_parent_upi_submission(p_submission_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
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
  IF v_role IS DISTINCT FROM 'academy_owner' THEN
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

CREATE OR REPLACE FUNCTION public.review_parent_upi_payment(p_submission_id uuid, p_decision text, p_review_note text DEFAULT NULL::text)
 RETURNS parent_payment_submissions
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_role text;
  v_submission public.parent_payment_submissions%rowtype;
  v_due public.payment_dues%rowtype;
  v_remaining numeric;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  v_role := private.current_user_role();
  IF v_role IS DISTINCT FROM 'academy_owner' THEN
    RAISE EXCEPTION 'Only the Academy Owner can review UPI payment claims';
  END IF;

  IF p_submission_id IS NULL OR p_decision IS NULL OR p_decision NOT IN ('accepted', 'rejected') THEN
    RAISE EXCEPTION 'Choose a valid review decision';
  END IF;
  IF p_decision = 'rejected'
     AND (p_review_note IS NULL OR length(btrim(p_review_note)) < 3) THEN
    RAISE EXCEPTION 'Provide a reason of at least 3 characters when rejecting a claim';
  END IF;
  IF p_review_note IS NOT NULL AND length(p_review_note) > 500 THEN
    RAISE EXCEPTION 'Review note must be 500 characters or fewer';
  END IF;

  SELECT *
  INTO v_submission
  FROM public.parent_payment_submissions
  WHERE id = p_submission_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payment claim not found';
  END IF;

  IF v_submission.academy_id <> (SELECT private.current_academy_id()) THEN
    RAISE EXCEPTION 'You are not authorized to review this academy payment claim';
  END IF;
  IF v_submission.status <> 'pending' THEN
    RAISE EXCEPTION 'This payment claim has already been reviewed';
  END IF;

  IF p_decision = 'accepted' THEN
    SELECT *
    INTO v_due
    FROM public.payment_dues
    WHERE id = v_submission.due_id
    FOR UPDATE;

    IF NOT FOUND OR v_due.player_id IS DISTINCT FROM v_submission.player_id THEN
      RAISE EXCEPTION 'The fee due associated with this claim is no longer valid';
    END IF;

    v_remaining := v_due.total_amount - COALESCE(v_due.paid_amount, 0);
    IF v_remaining <= 0 OR v_submission.amount > v_remaining THEN
      RAISE EXCEPTION 'The claim cannot be accepted because the current remaining due is %', v_remaining;
    END IF;
  END IF;

  UPDATE public.parent_payment_submissions
  SET status = p_decision,
      reviewed_by_user_id = v_user_id,
      reviewed_at = pg_catalog.now(),
      review_note = NULLIF(pg_catalog.btrim(p_review_note), ''),
      updated_at = pg_catalog.now()
  WHERE id = p_submission_id
  RETURNING * INTO v_submission;

  -- Intentionally do not write to public.payments or update public.payment_dues.
  RETURN v_submission;
END;
$function$;

CREATE OR REPLACE FUNCTION public.submit_parent_upi_payment(p_due_id uuid, p_amount numeric, p_transaction_reference text, p_payment_date date, p_parent_note text DEFAULT NULL::text)
 RETURNS parent_payment_submissions
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_parent public.parents%rowtype;
  v_player public.players%rowtype;
  v_due public.payment_dues%rowtype;
  v_submission public.parent_payment_submissions%rowtype;
  v_remaining numeric;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF private.current_user_role() IS DISTINCT FROM 'parent' THEN
    RAISE EXCEPTION 'Only a parent can submit a UPI payment claim';
  END IF;

  IF p_due_id IS NULL THEN
    RAISE EXCEPTION 'Select a fee due';
  END IF;
  IF p_amount IS NULL OR p_amount <= 0 OR p_amount > 9999999999 THEN
    RAISE EXCEPTION 'Enter a valid payment amount greater than zero';
  END IF;
  IF p_transaction_reference IS NULL
     OR length(btrim(p_transaction_reference)) NOT BETWEEN 3 AND 120 THEN
    RAISE EXCEPTION 'Enter a valid UPI transaction reference';
  END IF;
  IF p_payment_date IS NULL OR p_payment_date > CURRENT_DATE THEN
    RAISE EXCEPTION 'Payment date cannot be in the future';
  END IF;
  IF p_parent_note IS NOT NULL AND length(p_parent_note) > 500 THEN
    RAISE EXCEPTION 'Note must be 500 characters or fewer';
  END IF;

  SELECT *
  INTO v_parent
  FROM public.parents
  WHERE user_id = v_user_id
  FOR SHARE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Parent profile not found';
  END IF;

  SELECT *
  INTO v_due
  FROM public.payment_dues
  WHERE id = p_due_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Fee due not found';
  END IF;

  SELECT *
  INTO v_player
  FROM public.players
  WHERE id = v_due.player_id;

  IF NOT FOUND OR v_player.parent_id IS DISTINCT FROM v_parent.id THEN
    RAISE EXCEPTION 'You are not authorized to submit a claim for this player';
  END IF;

  IF v_player.academy_id IS NULL THEN
    RAISE EXCEPTION 'The player is not linked to an academy';
  END IF;

  v_remaining := v_due.total_amount - COALESCE(v_due.paid_amount, 0);
  IF v_remaining <= 0 OR v_due.due_status = 'paid' THEN
    RAISE EXCEPTION 'This fee due has no remaining balance';
  END IF;
  IF p_amount > v_remaining THEN
    RAISE EXCEPTION 'Claim amount cannot exceed the remaining due of %', v_remaining;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.parent_payment_submissions existing_claim
    WHERE existing_claim.academy_id = v_player.academy_id
      AND pg_catalog.lower(pg_catalog.btrim(existing_claim.transaction_reference))
        = pg_catalog.lower(pg_catalog.btrim(p_transaction_reference))
  ) THEN
    RAISE EXCEPTION 'This UPI transaction reference has already been submitted';
  END IF;

  INSERT INTO public.parent_payment_submissions (
    academy_id, parent_id, player_id, due_id, submitted_by_user_id,
    amount, transaction_reference, payment_date, parent_note
  )
  VALUES (
    v_player.academy_id, v_parent.id, v_player.id, v_due.id, v_user_id,
    p_amount, pg_catalog.btrim(p_transaction_reference), p_payment_date,
    NULLIF(pg_catalog.btrim(p_parent_note), '')
  )
  RETURNING * INTO v_submission;

  RETURN v_submission;
END;
$function$;

DO $verify$
BEGIN
 IF (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
     WHERE n.nspname='public' AND p.proname IN
     ('submit_parent_upi_payment','review_parent_upi_payment','record_accepted_parent_upi_submission')
     AND position('IS DISTINCT FROM' in pg_get_functiondef(p.oid))>0)<>3
 OR has_table_privilege('authenticated','public.parent_payment_submissions','INSERT')
 OR has_function_privilege('anon','public.review_parent_upi_payment(uuid,text,text)','EXECUTE')
 THEN RAISE EXCEPTION 'AG3.4D3.3 scratch candidate NULL-safe role gate FAILED'; END IF;
END $verify$;
NOTIFY pgrst,'reload schema';
COMMIT;
SELECT 'AG3.4D3.3 SCRATCH ONLY NULL ROLE CANDIDATES INSTALLED' AS checkpoint;
