-- P1.4 Parent UPI payment submissions and Academy Owner review queue.
-- Claims are kept separate from the immutable payments ledger. Acceptance does not
-- create a payment, issue a receipt, or update payment_dues.

CREATE TABLE public.parent_payment_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  academy_id uuid NOT NULL REFERENCES public.academies(id) ON DELETE RESTRICT,
  parent_id uuid NOT NULL REFERENCES public.parents(id) ON DELETE RESTRICT,
  player_id uuid NOT NULL REFERENCES public.players(id) ON DELETE RESTRICT,
  due_id uuid NOT NULL REFERENCES public.payment_dues(id) ON DELETE RESTRICT,
  submitted_by_user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  amount numeric(12,2) NOT NULL CHECK (amount > 0),
  transaction_reference text NOT NULL,
  payment_date date NOT NULL,
  parent_note text,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'rejected')),
  reviewed_by_user_id uuid REFERENCES public.users(id) ON DELETE RESTRICT,
  reviewed_at timestamptz,
  review_note text,
  created_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  updated_at timestamptz NOT NULL DEFAULT pg_catalog.now(),

  CONSTRAINT parent_payment_submissions_reference_not_blank
    CHECK (length(btrim(transaction_reference)) BETWEEN 3 AND 120),
  CONSTRAINT parent_payment_submissions_parent_note_length
    CHECK (parent_note IS NULL OR length(parent_note) <= 500),
  CONSTRAINT parent_payment_submissions_review_note_length
    CHECK (review_note IS NULL OR length(review_note) <= 500),
  CONSTRAINT parent_payment_submissions_review_state
    CHECK (
      (status = 'pending' AND reviewed_by_user_id IS NULL AND reviewed_at IS NULL)
      OR
      (status IN ('accepted', 'rejected') AND reviewed_by_user_id IS NOT NULL AND reviewed_at IS NOT NULL)
    )
);

CREATE INDEX parent_payment_submissions_parent_created_idx
  ON public.parent_payment_submissions (parent_id, created_at DESC);
CREATE INDEX parent_payment_submissions_academy_status_created_idx
  ON public.parent_payment_submissions (academy_id, status, created_at DESC);
CREATE INDEX parent_payment_submissions_player_due_idx
  ON public.parent_payment_submissions (player_id, due_id);

-- A UTR/reference cannot be submitted twice for the same academy, even if a prior
-- claim was rejected. This prevents a rejected claim being resubmitted as new.
CREATE UNIQUE INDEX parent_payment_submissions_academy_reference_unique_idx
  ON public.parent_payment_submissions (academy_id, pg_catalog.lower(pg_catalog.btrim(transaction_reference)));

ALTER TABLE public.parent_payment_submissions ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.parent_payment_submissions FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.parent_payment_submissions TO authenticated;
GRANT ALL ON TABLE public.parent_payment_submissions TO service_role;

CREATE POLICY parent_payment_submissions_select_parent
  ON public.parent_payment_submissions
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.parents AS parent_record
      WHERE parent_record.id = parent_payment_submissions.parent_id
        AND parent_record.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY parent_payment_submissions_select_academy_owner
  ON public.parent_payment_submissions
  FOR SELECT TO authenticated
  USING (
    (SELECT private.is_academy_owner())
    AND academy_id = (SELECT private.current_academy_id())
  );

CREATE POLICY parent_payment_submissions_select_super_admin
  ON public.parent_payment_submissions
  FOR SELECT TO authenticated
  USING ((SELECT private.is_super_admin()));

CREATE OR REPLACE FUNCTION public.submit_parent_upi_payment(
  p_due_id uuid,
  p_amount numeric,
  p_transaction_reference text,
  p_payment_date date,
  p_parent_note text DEFAULT NULL
)
RETURNS public.parent_payment_submissions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
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

  IF private.current_user_role() <> 'parent' THEN
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
  IF p_payment_date IS NULL OR p_payment_date > pg_catalog.current_date THEN
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

REVOKE ALL ON FUNCTION public.submit_parent_upi_payment(uuid, numeric, text, date, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_parent_upi_payment(uuid, numeric, text, date, text)
  TO authenticated;

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
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  v_role := private.current_user_role();
  IF v_role <> 'academy_owner' THEN
    RAISE EXCEPTION 'Only the Academy Owner can review UPI payment claims';
  END IF;

  IF p_submission_id IS NULL OR p_decision NOT IN ('accepted', 'rejected') THEN
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
