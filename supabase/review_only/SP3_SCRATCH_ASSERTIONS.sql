-- Disposable PostgreSQL 16 SP3 security and invariants test suite.
-- Run only after SP3_SCRATCH_SETUP.sql and SP3_ONE_TIME_CAMP_DUE_REVIEW_ONLY.sql.
-- All actor IDs are synthetic fixture UUIDs.

CREATE OR REPLACE FUNCTION pg_temp.expect_denied(p_sql text, p_message text)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER AS $$
DECLARE v_message text;
BEGIN
  BEGIN
    EXECUTE p_sql;
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_message = MESSAGE_TEXT;
    IF pg_catalog.position(p_message IN v_message) > 0 THEN RETURN; END IF;
    RAISE EXCEPTION 'Expected error containing %, got %', p_message, v_message;
  END;
  RAISE EXCEPTION 'Expected error containing %, but statement succeeded', p_message;
END;
$$;

SET ROLE authenticated;
SET request.jwt.claim.sub = '00000000-0000-0000-0000-000000000001';

DO $sp3_test_owner$
DECLARE result jsonb;
BEGIN
  result := public.create_one_time_camp_due(
    '50000000-0000-0000-0000-000000000001'::uuid
  );
  IF result->>'created' IS DISTINCT FROM 'true'
     OR result->>'due_type' IS DISTINCT FROM 'one_time'
     OR (result->>'total_amount')::numeric <> 3000.00
     OR result->>'due_date' <> '2027-05-12'
     OR result->>'due_status' <> 'pending'
     OR (result->>'remaining_amount')::numeric <> 3000.00
  THEN
    RAISE EXCEPTION 'SP3 Owner first charge content failed: %',result;
  END IF;

  result := public.create_one_time_camp_due(
    '50000000-0000-0000-0000-000000000001'::uuid
  );
  IF result->>'created' IS DISTINCT FROM 'false'
    OR (SELECT count(*) FROM public.payment_dues
        WHERE due_type='one_time'
          AND player_id='20000000-0000-0000-0000-000000000001'::uuid) <> 1
  THEN
    RAISE EXCEPTION 'SP3 repeat click did not return same due without a duplicate';
  END IF;
END;
$sp3_test_owner$;

SELECT pg_temp.expect_denied(
  'SELECT public.create_one_time_camp_due(''50000000-0000-0000-0000-000000000004''::uuid)',
  'under another enrollment'
);

-- Do not misbill a camp as monthly/registration by direct table insert.
SELECT pg_temp.expect_denied(
  'INSERT INTO public.payment_dues(player_id,subscription_id,due_type,due_date,total_amount)
   VALUES(''20000000-0000-0000-0000-000000000001'',''50000000-0000-0000-0000-000000000004'',''monthly'',''2027-05-12'',3000)',
  'must not be billed'
);
SELECT pg_temp.expect_denied(
  'INSERT INTO public.payment_dues(player_id,subscription_id,due_type,due_date,total_amount)
   VALUES(''20000000-0000-0000-0000-000000000001'',''50000000-0000-0000-0000-000000000004'',''registration'',''2027-05-12'',3000)',
  'must not be billed'
);
SELECT pg_temp.expect_denied(
  'INSERT INTO public.payment_dues(player_id,subscription_id,due_type,due_date,total_amount)
   VALUES(''20000000-0000-0000-0000-000000000001'',''50000000-0000-0000-0000-000000000002'',''one_time'',''2027-05-12'',1500)',
  'require a One-time plan'
);

-- Server-calculated charge cannot be replaced with an invented price or date.
SELECT pg_temp.expect_denied(
  'INSERT INTO public.payment_dues(player_id,subscription_id,due_type,due_date,total_amount)
   VALUES(''20000000-0000-0000-0000-000000000003'',''50000000-0000-0000-0000-000000000007'',''one_time'',''2027-05-12'',100)',
  'differs from the enrollment'
);
SELECT pg_temp.expect_denied(
  'INSERT INTO public.payment_dues(player_id,subscription_id,due_type,due_date,total_amount)
   VALUES(''20000000-0000-0000-0000-000000000003'',''50000000-0000-0000-0000-000000000007'',''one_time'',''2027-06-12'',3000)',
  'differs from the enrollment'
);

-- Direct valid charge is only one per player/camp plan; DB unique index,
-- not JavaScript duplicate checks, rejects another enrollment/charge.
SELECT pg_temp.expect_denied(
  'INSERT INTO public.payment_dues(player_id,subscription_id,due_type,due_date,total_amount)
   VALUES(''20000000-0000-0000-0000-000000000001'',''50000000-0000-0000-0000-000000000004'',''one_time'',''2027-05-12'',3000)',
  'duplicate key'
);
SELECT pg_temp.expect_denied(
  'SELECT public.create_one_time_camp_due(''50000000-0000-0000-0000-000000000002''::uuid)',
  'not eligible'
);
SELECT pg_temp.expect_denied(
  'SELECT public.create_one_time_camp_due(''50000000-0000-0000-0000-000000000005''::uuid)',
  'zero separate registration fee'
);
SELECT pg_temp.expect_denied(
  'SELECT public.create_one_time_camp_due(''50000000-0000-0000-0000-000000000006''::uuid)',
  'not eligible'
);
SELECT pg_temp.expect_denied(
  'SELECT public.create_one_time_camp_due(''50000000-0000-0000-0000-000000000003''::uuid)',
  'not found or not accessible'
);

-- Camp charge identity cannot be edited or deleted even by the owning AO.
SELECT pg_temp.expect_denied(
  'UPDATE public.payment_dues SET due_date=''2027-06-01''
   WHERE player_id=''20000000-0000-0000-0000-000000000001''
     AND due_type=''one_time''',
  'identity and amount cannot be edited'
);
SELECT pg_temp.expect_denied(
  'DELETE FROM public.payment_dues
   WHERE player_id=''20000000-0000-0000-0000-000000000001''
     AND due_type=''one_time''',
  'cannot be deleted'
);

-- Existing authorized collection RPC updates paid_amount/remaining_amount,
-- while identity/due_type/date/total remain unchanged.
BEGIN;
SELECT pg_catalog.set_config('acadpro.payment_write_operation','collect',true);
UPDATE public.payment_dues SET paid_amount=1000
 WHERE player_id='20000000-0000-0000-0000-000000000001'
   AND due_type='one_time';
DO $sp3_partial$
BEGIN
  IF (SELECT count(*) FROM public.payment_dues WHERE due_type='one_time'
    AND paid_amount=1000 AND remaining_amount=2000 AND due_status='partial')<>1
  THEN RAISE EXCEPTION 'SP3 partial collection compatibility failed'; END IF;
END;
$sp3_partial$;
COMMIT;

-- Non-camp monthly dues remain valid, without a camp identity.
INSERT INTO public.payment_dues(player_id,subscription_id,due_type,due_date,total_amount)
VALUES ('20000000-0000-0000-0000-000000000001',
        '50000000-0000-0000-0000-000000000002',
        'monthly','2027-05-01',1500);
DO $sp3_monthly$
BEGIN
  IF (SELECT count(*) FROM public.payment_dues
      WHERE due_type='monthly' AND one_time_plan_id IS NULL)<>1
  THEN RAISE EXCEPTION 'SP3 changed the existing monthly due path'; END IF;
END;
$sp3_monthly$;

-- Parent, Coach, unmapped signed JWT and foreign academy Owner
-- have no permission to generate a camp charge.
SET request.jwt.claim.sub = '00000000-0000-0000-0000-000000000004';
SELECT pg_temp.expect_denied(
 'SELECT public.create_one_time_camp_due(''50000000-0000-0000-0000-000000000007''::uuid)',
 'Only Academy Owner or Super Admin'
);
SET request.jwt.claim.sub = '00000000-0000-0000-0000-000000000005';
SELECT pg_temp.expect_denied(
 'SELECT public.create_one_time_camp_due(''50000000-0000-0000-0000-000000000007''::uuid)',
 'Only Academy Owner or Super Admin'
);
SET request.jwt.claim.sub = '00000000-0000-0000-0000-000000000006';
SELECT pg_temp.expect_denied(
 'SELECT public.create_one_time_camp_due(''50000000-0000-0000-0000-000000000007''::uuid)',
 'Only Academy Owner or Super Admin'
);
SET request.jwt.claim.sub = '00000000-0000-0000-0000-000000000002';
SELECT pg_temp.expect_denied(
 'SELECT public.create_one_time_camp_due(''50000000-0000-0000-0000-000000000007''::uuid)',
 'not found or not accessible'
);

-- Foreign Owner *can* create a valid camp due inside their OWN academy.
DO $sp3_second_owner$
DECLARE v_result jsonb;
BEGIN
 v_result:=public.create_one_time_camp_due('50000000-0000-0000-0000-000000000003'::uuid);
 IF v_result->>'created'<>'true' OR (v_result->>'total_amount')::numeric<>3000
 THEN RAISE EXCEPTION 'Second academy owner valid One-time charge rejected: %',v_result; END IF;
END;
$sp3_second_owner$;

SET request.jwt.claim.sub = '00000000-0000-0000-0000-000000000003';
DO $sp3_admin$
DECLARE v_result jsonb;
BEGIN
 v_result:=public.create_one_time_camp_due('50000000-0000-0000-0000-000000000007'::uuid);
 IF v_result->>'created'<>'true' THEN
  RAISE EXCEPTION 'Super Admin authorized camp charge failed: %',v_result;
 END IF;
END;
$sp3_admin$;

-- All invoice logic is independent of payment ledger: this script inserts
-- no payments or receipts, and cannot produce fake payment confirmations.
RESET ROLE;
SELECT 'SP3 SCRATCH TESTS PASSED: Owner, Super Admin, Parent, Coach, unmapped, second academy, repeat-click, cross-enrollment, immutable due and recurring regression' AS result;
