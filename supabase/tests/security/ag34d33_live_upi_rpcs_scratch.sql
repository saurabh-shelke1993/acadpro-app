-- AG3.4D3.3: exact hosted UPI RPC bodies replayed ONLY into disposable signed-JWT CI.
-- Depends on passing C2 > D1 > D3.1 > D3.2 in a fresh, UNLINKED native Supabase.
-- Production project, customer claims, original migrations, and ledger are never touched.
BEGIN;
DO $guard$
BEGIN
 IF current_database()<>'postgres' OR session_user<>'postgres' OR current_user<>'postgres'
 OR to_regclass('auth.users') IS NULL
 OR (SELECT count(*) FROM auth.users)<>36
 OR (SELECT count(*) FROM public.users)<>26
 OR (SELECT count(*) FROM public.parents)<>3
 OR (SELECT count(*) FROM public.players)<>3
 OR (SELECT count(*) FROM public.parent_payment_submissions)<>3
 OR (SELECT count(*) FROM public.payment_dues)<>5
 OR (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='private')<>21
 OR to_regprocedure('public.submit_parent_upi_payment(uuid,numeric,text,date,text)') IS NOT NULL
 OR to_regprocedure('public.review_parent_upi_payment(uuid,text,text)') IS NOT NULL
 OR to_regprocedure('public.record_accepted_parent_upi_submission(uuid)') IS NOT NULL
 OR (SELECT count(*) FROM information_schema.columns
     WHERE table_schema='public' AND table_name='parent_payment_submissions' AND column_name='due_id')<>0
 OR NOT has_function_privilege('authenticated','public.collect_payment(uuid,numeric,text,text)','EXECUTE')
 OR position('v_role is null or' IN lower(pg_get_functiondef('public.collect_payment(uuid,numeric,text,text)'::regprocedure)))=0
 THEN RAISE EXCEPTION 'AG3.4D3.3 refuses non-disposable or drifted original JWT baseline'; END IF;
END $guard$;

-- Seven genuinely signed new Auth identities. Unmapped one deliberately has no public.users row.
INSERT INTO public.users(id,academy_id,role) VALUES
 (:'owner_a_uuid'::uuid,'a0000000-0000-4000-8000-000000000001','academy_owner'),
 (:'owner_b_uuid'::uuid,'a0000000-0000-4000-8000-000000000002','academy_owner'),
 (:'coach_uuid'::uuid,'a0000000-0000-4000-8000-000000000001','coach'),
 (:'parent_a_uuid'::uuid,'a0000000-0000-4000-8000-000000000001','parent'),
 (:'parent_b_uuid'::uuid,'a0000000-0000-4000-8000-000000000002','parent'),
 (:'super_admin_uuid'::uuid,NULL,'super_admin');
-- Reassign only the disposable Parent A1 and B identities to these fresh signed sessions.
UPDATE public.parents SET user_id=:'parent_a_uuid'::uuid WHERE id='d0000000-0000-4000-8000-000000000011'::uuid;
UPDATE public.parents SET user_id=:'parent_b_uuid'::uuid WHERE id='d0000000-0000-4000-8000-000000000013'::uuid;

-- Eight invented fresh dues provide independent positive, negative, stale and concurrency paths.
INSERT INTO public.payment_dues(id,player_id,total_amount) VALUES
 ('d2000000-0000-4000-8000-000000000031','f1000000-0000-4000-8000-000000000011',100),
 ('d2000000-0000-4000-8000-000000000032','f1000000-0000-4000-8000-000000000011',100),
 ('d2000000-0000-4000-8000-000000000033','f1000000-0000-4000-8000-000000000013',100),
 ('d2000000-0000-4000-8000-000000000034','f1000000-0000-4000-8000-000000000011',100),
 ('d2000000-0000-4000-8000-000000000035','f1000000-0000-4000-8000-000000000011',100),
 ('d2000000-0000-4000-8000-000000000036','f1000000-0000-4000-8000-000000000011',100),
 ('d2000000-0000-4000-8000-000000000037','f1000000-0000-4000-8000-000000000012',100),
 ('d2000000-0000-4000-8000-000000000038','f1000000-0000-4000-8000-000000000013',100);

-- Extend the D1 policy-parity table with only the source-required P1.4/P1.5 contract;
-- pre-existing three D1 read rows become reviewed/rejected synthetic history.
ALTER TABLE public.parent_payment_submissions
 ADD COLUMN due_id uuid REFERENCES public.payment_dues(id),
 ADD COLUMN submitted_by_user_id uuid REFERENCES public.users(id),
 ADD COLUMN amount numeric(12,2),
 ADD COLUMN transaction_reference text,
 ADD COLUMN payment_date date,
 ADD COLUMN parent_note text,
 ADD COLUMN status text NOT NULL DEFAULT 'rejected',
 ADD COLUMN reviewed_by_user_id uuid REFERENCES public.users(id),
 ADD COLUMN reviewed_at timestamptz,
 ADD COLUMN review_note text,
 ADD COLUMN created_at timestamptz NOT NULL DEFAULT now(),
 ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now(),
 ADD COLUMN payment_id uuid REFERENCES public.payments(id),
 ADD COLUMN recorded_by_user_id uuid REFERENCES public.users(id),
 ADD COLUMN recorded_at timestamptz;
UPDATE public.parent_payment_submissions s
 SET due_id=(SELECT d.id FROM public.payment_dues d WHERE d.player_id=s.player_id ORDER BY id LIMIT 1),
     submitted_by_user_id=(SELECT p.user_id FROM public.parents p WHERE p.id=s.parent_id),
     amount=1,
     transaction_reference='AG34D33-OLD-'||s.id::text,
     payment_date=current_date,
     reviewed_by_user_id=(SELECT u.id FROM public.users u WHERE u.role='academy_owner'
                          AND u.academy_id=s.academy_id ORDER BY u.id LIMIT 1),
     reviewed_at=now();
ALTER TABLE public.parent_payment_submissions
 ALTER COLUMN due_id SET NOT NULL,
 ALTER COLUMN submitted_by_user_id SET NOT NULL,
 ALTER COLUMN amount SET NOT NULL,
 ALTER COLUMN transaction_reference SET NOT NULL,
 ALTER COLUMN payment_date SET NOT NULL,
 ADD CONSTRAINT ag34d33_amount_positive CHECK (amount>0),
 ADD CONSTRAINT ag34d33_status_valid CHECK (status IN ('pending','accepted','rejected','recorded')),
 ADD CONSTRAINT ag34d33_parent_note_length CHECK (parent_note IS NULL OR length(parent_note)<=500),
 ADD CONSTRAINT ag34d33_review_note_length CHECK (review_note IS NULL OR length(review_note)<=500),
 ADD CONSTRAINT ag34d33_utr_length CHECK (length(btrim(transaction_reference)) BETWEEN 3 AND 120),
 ADD CONSTRAINT ag34d33_review_state CHECK (
   (status='pending' AND reviewed_by_user_id IS NULL AND reviewed_at IS NULL)
   OR (status IN ('accepted','rejected','recorded') AND reviewed_by_user_id IS NOT NULL AND reviewed_at IS NOT NULL)),
 ADD CONSTRAINT ag34d33_record_state CHECK (
   (status='recorded' AND payment_id IS NOT NULL AND recorded_by_user_id IS NOT NULL AND recorded_at IS NOT NULL)
   OR (status<>'recorded' AND payment_id IS NULL AND recorded_by_user_id IS NULL AND recorded_at IS NULL));
CREATE UNIQUE INDEX ag34d33_academy_utr_unique
 ON public.parent_payment_submissions (academy_id,lower(btrim(transaction_reference)));
CREATE UNIQUE INDEX ag34d33_active_due_unique
 ON public.parent_payment_submissions (due_id) WHERE status IN ('pending','accepted');
CREATE UNIQUE INDEX ag34d33_payment_link_unique
 ON public.parent_payment_submissions (payment_id) WHERE payment_id IS NOT NULL;
ALTER TABLE public.payments ADD COLUMN external_transaction_reference text;

-- Trigger exists ONLY in scratch to force failure after receipt-number allocation.
CREATE FUNCTION private.ag34d33_fail_utr_write() RETURNS trigger
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $trap$
BEGIN
 IF NEW.external_transaction_reference='AG34D33-FORCE-ROLLBACK'
 THEN RAISE EXCEPTION 'AG34D33 synthetic recording rollback'; END IF;
 RETURN NEW;
END $trap$;
CREATE TRIGGER ag34d33_fail_reference BEFORE UPDATE OF external_transaction_reference ON public.payments
 FOR EACH ROW EXECUTE FUNCTION private.ag34d33_fail_utr_write();

-- Following THREE definitions are copied byte-for-byte from hosted pg_get_functiondef;
-- expected MD5s independently checked below, not inferred from the historical migrations.
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

REVOKE ALL ON FUNCTION public.submit_parent_upi_payment(uuid,numeric,text,date,text) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.review_parent_upi_payment(uuid,text,text) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.record_accepted_parent_upi_submission(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.submit_parent_upi_payment(uuid,numeric,text,date,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.review_parent_upi_payment(uuid,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_accepted_parent_upi_submission(uuid) TO authenticated;

DO $verify$
BEGIN
 IF md5(pg_get_functiondef('public.submit_parent_upi_payment(uuid,numeric,text,date,text)'::regprocedure))<>'d3788514af85e404504861936cfef20e'
 OR md5(pg_get_functiondef('public.review_parent_upi_payment(uuid,text,text)'::regprocedure))<>'33852ded2505672448ed44ccf46a43e2'
 OR md5(pg_get_functiondef('public.record_accepted_parent_upi_submission(uuid)'::regprocedure))<>'ff98c595f28944f33b7a8f50b4177722'
 OR (SELECT count(*) FROM auth.users)<>36
 OR (SELECT count(*) FROM public.users)<>32
 OR (SELECT count(*) FROM public.payment_dues)<>13
 OR (SELECT count(*) FROM public.parent_payment_submissions)<>3
 OR (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='private')<>22
 OR (SELECT count(*) FROM pg_policies WHERE schemaname='public' AND tablename='parent_payment_submissions')<>3
 OR has_table_privilege('authenticated','public.parent_payment_submissions','INSERT')
 OR has_table_privilege('authenticated','public.parent_payment_submissions','UPDATE')
 OR has_function_privilege('anon','public.submit_parent_upi_payment(uuid,numeric,text,date,text)','EXECUTE')
 OR has_function_privilege('anon','public.review_parent_upi_payment(uuid,text,text)','EXECUTE')
 OR has_function_privilege('anon','public.record_accepted_parent_upi_submission(uuid)','EXECUTE')
 OR NOT has_function_privilege('authenticated','public.submit_parent_upi_payment(uuid,numeric,text,date,text)','EXECUTE')
 OR NOT has_function_privilege('authenticated','public.review_parent_upi_payment(uuid,text,text)','EXECUTE')
 OR NOT has_function_privilege('authenticated','public.record_accepted_parent_upi_submission(uuid)','EXECUTE')
 THEN RAISE EXCEPTION 'AG3.4D3.3 original UPI source/parity/ACL gate FAILED'; END IF;
END $verify$;
NOTIFY pgrst,'reload schema';
COMMIT;
SELECT 'AG3.4D3.3 EXACT UPI ORIGINAL RPC SOURCES MATCHED IN SCRATCH' AS checkpoint;
