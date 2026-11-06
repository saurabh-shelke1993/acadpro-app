-- PS-L2.3 isolated Postgres 17 tests. Runs ONLY against disposable fixture.
-- Real Supabase Auth/RLS/payment trigger and financial business acceptance
-- require separate staging integration tests before any live migration.
\echo 'PS-L2.3: verify legacy HOLD and additive preservation'
DO $$
BEGIN
 IF (SELECT count(*) FROM public.player_subscriptions WHERE renewal_eligibility='legacy_hold' AND end_date IS NULL) <> 3
 THEN RAISE EXCEPTION 'Existing subscriptions did not remain HOLD'; END IF;
 IF (SELECT count(*) FROM public.payment_dues WHERE subscription_period_id IS NULL) <> 1
 THEN RAISE EXCEPTION 'Existing due was unexpectedly linked'; END IF;
 IF (SELECT count(*) FROM public.payments) <> 1
 THEN RAISE EXCEPTION 'Historical payment was modified'; END IF;
 IF EXISTS (SELECT 1 FROM public.subscription_periods) OR EXISTS (SELECT 1 FROM public.subscription_lifecycle_events)
 THEN RAISE EXCEPTION 'Candidate created historical periods/events'; END IF;
 IF to_regclass('public.camp_programs') IS NOT NULL
 THEN RAISE EXCEPTION 'Camp module included in tuition scope'; END IF;
END $$;
\echo 'PS-L2.3: ensure old contract editor cannot authorize renewals'
DO $$
BEGIN
 BEGIN
  UPDATE public.player_subscriptions SET renewal_eligibility='eligible'
   WHERE id='40000000-0000-4000-8000-000000000001';
  RAISE EXCEPTION 'Legacy activation incorrectly succeeded';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
 BEGIN
  INSERT INTO public.subscription_periods (
    id,agreement_id,academy_id,player_id,period_sequence,period_origin,
    period_start,original_end,effective_end,cycle_snapshot,monthly_alignment_snapshot,
    contracted_rate_paise,billed_tuition_paise
  ) VALUES (
    '70000000-0000-4000-8000-000000000001',
    '40000000-0000-4000-8000-000000000001',
    'a0000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000001',
    1,'prospective_opening','2026-11-01','2026-11-30','2026-11-30',
    'monthly','fixed_calendar_month',150000,150000
  );
  RAISE EXCEPTION 'Legacy HOLD allowed period';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
END $$;

-- Ephemeral-only fixture technique: this is NOT production activation. The
-- future Owner-audited activation RPC has not been implemented or authorized.
ALTER TABLE public.player_subscriptions DISABLE TRIGGER ps_l2_3_guard_contract_metadata;
UPDATE public.player_subscriptions SET
  academy_id='a0000000-0000-4000-8000-000000000001',
  contracted_rate_paise=150000,currency_code='INR',
  contracted_cycle='monthly',monthly_alignment='fixed_calendar_month',
  renewal_eligibility='eligible',first_prospective_renewal='2026-11-01'
WHERE id='40000000-0000-4000-8000-000000000001';
UPDATE public.player_subscriptions SET
  academy_id='a0000000-0000-4000-8000-000000000001',
  contracted_rate_paise=450000,currency_code='INR',
  contracted_cycle='quarterly',renewal_eligibility='eligible',
  first_prospective_renewal='2026-11-01'
WHERE id='40000000-0000-4000-8000-000000000002';
UPDATE public.player_subscriptions SET
  academy_id='a0000000-0000-4000-8000-000000000002',
  contracted_rate_paise=130000,currency_code='INR',
  contracted_cycle='monthly',monthly_alignment='fixed_calendar_month',
  renewal_eligibility='eligible',first_prospective_renewal='2026-11-01'
WHERE id='40000000-0000-4000-8000-000000000003';
ALTER TABLE public.player_subscriptions ENABLE TRIGGER ps_l2_3_guard_contract_metadata;

\echo 'PS-L2.3: prove cross-agreement and per-academy tuition period isolation'
INSERT INTO public.subscription_periods (
 id,agreement_id,academy_id,player_id,period_sequence,period_origin,
 period_start,original_end,effective_end,cycle_snapshot,monthly_alignment_snapshot,
 contracted_rate_paise,billed_tuition_paise
) VALUES
 ('70000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001',
 'a0000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001',
 1,'initial','2026-11-01','2026-11-30','2026-11-30','monthly','fixed_calendar_month',150000,150000),
 ('70000000-0000-4000-8000-000000000003','40000000-0000-4000-8000-000000000003',
 'a0000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000002',
 1,'initial','2026-11-01','2026-11-30','2026-11-30','monthly','fixed_calendar_month',130000,130000);
DO $$
BEGIN
 BEGIN
  INSERT INTO public.subscription_periods (
    id,agreement_id,academy_id,player_id,period_sequence,period_origin,
    period_start,original_end,effective_end,cycle_snapshot,
    contracted_rate_paise,billed_tuition_paise
  ) VALUES (
    '70000000-0000-4000-8000-000000000002','40000000-0000-4000-8000-000000000002',
    'a0000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001',
    1,'renewal','2026-11-15','2027-02-14','2027-02-14','quarterly',450000,450000
  );
  RAISE EXCEPTION 'Overlapping monthly and quarterly periods accepted';
 EXCEPTION WHEN exclusion_violation THEN NULL;
 END;
 IF (SELECT count(*) FROM public.subscription_periods) <> 2
 THEN RAISE EXCEPTION 'Overlapping period caused a partial write'; END IF;
END $$;

-- Adjacent future plan transition is valid (Nov 30 end => Dec 1 start).
INSERT INTO public.subscription_periods (
 id,agreement_id,academy_id,player_id,period_sequence,period_origin,
 period_start,original_end,effective_end,cycle_snapshot,
 contracted_rate_paise,billed_tuition_paise
) VALUES (
 '70000000-0000-4000-8000-000000000002','40000000-0000-4000-8000-000000000002',
 'a0000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001',
 1,'renewal','2026-12-01','2027-02-28','2027-02-28','quarterly',450000,450000
);

DO $$
BEGIN
 BEGIN
  INSERT INTO public.subscription_periods (
    agreement_id,academy_id,player_id,period_sequence,period_origin,
    period_start,original_end,effective_end,cycle_snapshot,monthly_alignment_snapshot,
    contracted_rate_paise,billed_tuition_paise
  ) VALUES (
    '40000000-0000-4000-8000-000000000001',
    'a0000000-0000-4000-8000-000000000002',
    '20000000-0000-4000-8000-000000000002',
    2,'renewal','2027-03-01','2027-03-31','2027-03-31',
    'monthly','fixed_calendar_month',150000,150000
  );
  RAISE EXCEPTION 'Cross-academy/child period accepted';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
 BEGIN
  UPDATE public.subscription_periods SET billed_tuition_paise=100
   WHERE id='70000000-0000-4000-8000-000000000001';
  RAISE EXCEPTION 'Issued period price could be rewritten';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
END $$;

\echo 'PS-L2.3: period-to-due exact ownership and uniqueness'
INSERT INTO public.payment_dues (
 id,player_id,subscription_id,subscription_period_id,due_type,due_date,
 total_amount,paid_amount,remaining_amount,due_status
) VALUES (
 '50000000-0000-4000-8000-000000000002',
 '20000000-0000-4000-8000-000000000001',
 '40000000-0000-4000-8000-000000000001',
 '70000000-0000-4000-8000-000000000001',
 'monthly','2026-11-01',1500,0,1500,'pending'
);
DO $$
BEGIN
 BEGIN
  INSERT INTO public.payment_dues(
   id,player_id,subscription_id,subscription_period_id,due_type,due_date,total_amount
  ) VALUES(
   '50000000-0000-4000-8000-000000000003',
   '20000000-0000-4000-8000-000000000001',
   '40000000-0000-4000-8000-000000000001',
   '70000000-0000-4000-8000-000000000001','monthly','2026-11-02',1500
  );
  RAISE EXCEPTION 'Duplicate pending due accepted';
 EXCEPTION WHEN unique_violation THEN NULL;
 END;
 BEGIN
  INSERT INTO public.payment_dues(
   id,player_id,subscription_id,subscription_period_id,due_type,due_date,total_amount
  ) VALUES(
   '50000000-0000-4000-8000-000000000004',
   '20000000-0000-4000-8000-000000000002',
   '40000000-0000-4000-8000-000000000003',
   '70000000-0000-4000-8000-000000000002','quarterly','2026-12-01',4500
  );
  RAISE EXCEPTION 'Wrong-player period due accepted';
 EXCEPTION WHEN foreign_key_violation THEN NULL;
 END;
 IF (SELECT count(*) FROM public.payment_dues) <> 2
 THEN RAISE EXCEPTION 'Rejected dues left partial history'; END IF;
END $$;

\echo 'PS-L2.3: append-only events and duplicate action protection'
INSERT INTO public.subscription_lifecycle_events(
 id,academy_id,agreement_id,period_id,event_type,idempotency_key,
 actor_user_id,actor_kind,reason
) VALUES (
 '80000000-0000-4000-8000-000000000001',
 'a0000000-0000-4000-8000-000000000001',
 '40000000-0000-4000-8000-000000000001',
 '70000000-0000-4000-8000-000000000001',
 'initial','90000000-0000-4000-8000-000000000001',
 '10000000-0000-4000-8000-000000000001','academy_owner','Disposable test initial');
DO $$
BEGIN
 BEGIN
  UPDATE public.subscription_lifecycle_events SET reason='Altered'
   WHERE id='80000000-0000-4000-8000-000000000001';
  RAISE EXCEPTION 'Lifecycle event was mutable';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
 BEGIN
  INSERT INTO public.subscription_lifecycle_events(
    academy_id,agreement_id,period_id,event_type,idempotency_key,
    actor_kind,reason
  ) VALUES (
    'a0000000-0000-4000-8000-000000000001',
    '40000000-0000-4000-8000-000000000001',
    '70000000-0000-4000-8000-000000000001',
    'renew','90000000-0000-4000-8000-000000000001',
    'system','Retry fixture'
  );
  RAISE EXCEPTION 'Duplicate idempotency key accepted';
 EXCEPTION WHEN unique_violation THEN NULL;
 END;
END $$;

\echo 'PS-L2.3: event academy and period/contract scope'
DO $$
BEGIN
 BEGIN
  INSERT INTO public.subscription_lifecycle_events (
    academy_id,agreement_id,period_id,event_type,idempotency_key,
    actor_kind,reason
  ) VALUES (
    'a0000000-0000-4000-8000-000000000002',
    '40000000-0000-4000-8000-000000000001',
    '70000000-0000-4000-8000-000000000001',
    'renew','90000000-0000-4000-8000-000000000008',
    'academy_owner','Attempt forged academy in lifecycle event'
  );
  RAISE EXCEPTION 'Cross-academy lifecycle event accepted';
 EXCEPTION WHEN foreign_key_violation THEN NULL;
 END;
 BEGIN
  INSERT INTO public.subscription_lifecycle_events (
    academy_id,agreement_id,period_id,event_type,idempotency_key,
    actor_kind,reason
  ) VALUES (
    'a0000000-0000-4000-8000-000000000001',
    '40000000-0000-4000-8000-000000000002',
    '70000000-0000-4000-8000-000000000001',
    'renew','90000000-0000-4000-8000-000000000009',
    'academy_owner','Attempt wrong contract period link'
  );
  RAISE EXCEPTION 'Wrong agreement for lifecycle period accepted';
 EXCEPTION WHEN foreign_key_violation THEN NULL;
 END;
 IF (SELECT count(*) FROM public.subscription_lifecycle_events) <> 1
 THEN RAISE EXCEPTION 'Rejected event left a row'; END IF;
END $$;
\echo 'PS-L2.3: actual Postgres grants + RLS negative-role checks'
DO $$
BEGIN
 IF has_table_privilege('anon','public.subscription_periods','SELECT')
    OR has_table_privilege('authenticated','public.subscription_periods','INSERT')
    OR has_table_privilege('authenticated','public.subscription_periods','UPDATE')
    OR has_table_privilege('authenticated','public.subscription_lifecycle_events','DELETE')
 THEN RAISE EXCEPTION 'Unapproved direct ledger privileges'; END IF;
 IF NOT has_table_privilege('authenticated','public.subscription_periods','SELECT')
 THEN RAISE EXCEPTION 'Scoped period SELECT missing'; END IF;
 IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid='public.subscription_periods'::regclass)
 THEN RAISE EXCEPTION 'Missing RLS'; END IF;
END $$;
SET ROLE authenticated;
SET app.fixture_role = 'academy_owner';
SET app.fixture_academy = 'a0000000-0000-4000-8000-000000000001';
DO $$
BEGIN
 IF (SELECT count(*) FROM public.subscription_periods) <> 2
 THEN RAISE EXCEPTION 'Academy Owner A scope violation'; END IF;
 IF (SELECT count(*) FROM public.subscription_lifecycle_events) <> 1
 THEN RAISE EXCEPTION 'Academy Owner event scope violation'; END IF;
END $$;
SET app.fixture_academy = 'a0000000-0000-4000-8000-000000000002';
DO $$
BEGIN
 IF (SELECT count(*) FROM public.subscription_periods) <> 1
 THEN RAISE EXCEPTION 'Academy Owner B scope violation'; END IF;
END $$;
SET app.fixture_role = 'coach';
DO $$
BEGIN
 IF (SELECT count(*) FROM public.subscription_periods) <> 0
 THEN RAISE EXCEPTION 'Coach financial ledger exposed'; END IF;
END $$;
SET app.fixture_role = 'parent';
SET app.fixture_parent_player = '20000000-0000-4000-8000-000000000001';
DO $$
BEGIN
 IF (SELECT count(*) FROM public.subscription_periods) <> 2
    OR (SELECT count(*) FROM public.subscription_lifecycle_events) <> 0
 THEN RAISE EXCEPTION 'Parent linked-child period / event isolation failed'; END IF;
END $$;
RESET ROLE;
SET ROLE anon;
DO $$
BEGIN
 BEGIN
  PERFORM count(*) FROM public.subscription_periods;
  RAISE EXCEPTION 'Anonymous SELECT of period permitted';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
END $$;
RESET ROLE;
\echo 'PS-L2.3 PASS: isolated candidate schema, tuition exclusivity, history, RLS and due keys'
