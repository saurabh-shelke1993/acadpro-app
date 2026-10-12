-- P1.4 follow-up invariants: one active claim per due and revalidate at review time.
-- This additive migration does not touch payments or payment_dues balances.

CREATE UNIQUE INDEX parent_payment_submissions_one_active_claim_per_due_idx
  ON public.parent_payment_submissions (due_id)
  WHERE status IN ('pending', 'accepted');

CREATE OR REPLACE FUNCTION public.review_parent_upi_payment(
  p_submission_id uuid,
  p_decision text,
  p_review_note text DEFAULT NULL
)
RETURNS public.parent_payment_submissions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
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
  IF v_role <> 'academy_owner' THEN
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

REVOKE ALL ON FUNCTION public.review_parent_upi_payment(uuid, text, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.review_parent_upi_payment(uuid, text, text)
  TO authenticated;
