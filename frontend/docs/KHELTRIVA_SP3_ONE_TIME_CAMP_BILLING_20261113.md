# Kheltriva SP3 — One-time camp due and existing financial workflows

**Date:** 13 November 2026 (IST)
**PR:** https://github.com/saurabh-shelke1993/acadpro-app/pull/33
**Status:** IMPLEMENTED IN DEVELOPMENT AND TESTED ON DISPOSABLE DATABASE ONLY. LIVE DATABASE UNCHANGED; CAMP BILLING FLAG DEFAULTS OFF; MANUAL OWNER ACCEPTANCE PENDING.

## 1. Exact scope

SP1 creates an academy One-time plan. SP2 enrolls the player with manually entered inclusive Start and End dates. SP3 stages the one-time charge and integrates existing collection/receipt and Parent Financial Overview display.

- One camp plan amount per player and camp plan (no recurring billing); dedicated due_type = one_time.
- Due date = saved camp start date. Fee amount = stored plan amount. Existing subscription and plan prices are not overwritten.
- Separate registration_fee MUST be zero for camp plans. Nonzero registration_fee is refused until a separate business contract is approved.
- A new due starts Pending, Paid ₹0. Money is **not** collected when a due is created.
- No automatic renewal, expired status, re-enrollment, data backfill, subscription change or existing historic due adjustment.
- The same camp plan cannot generate multiple separate fees for a player, even if separate active enrollment rows were created. A separate camp event needs a distinct plan or an approved future event model.

## 2. Backend security — REVIEW ONLY, NOT DEPLOYED

SQL is staged in **supabase/review_only/SP3_ONE_TIME_CAMP_DUE_REVIEW_ONLY.sql**, expressly NOT in the migrations directory. **Never run this script directly on live Supabase; do not run normal db push.**

- Adds a nullable one_time_plan_id foreign key on payment_dues, and a partial UNIQUE index (player_id, one_time_plan_id) where due_type is one_time. This is the transaction-level safeguard against concurrent duplicate charges.
- Private trigger validates actual linked enrollment, same academy/center, active saved dates, amount, cycle and registration fee. Direct API attempts to bill a camp as Monthly or Registration, forge an amount/date or create mismatched fee are blocked after this migration is applied.
- Charged camp dues cannot be edited/deleted, and a charged camp enrollment or plan cannot have its identity or charge terms silently rewritten.
- New public.create_one_time_camp_due RPC is SECURITY INVOKER (not definer). Requires authenticated Owner or Super Admin, NULL-safe role checking, authorized academy access and existing RLS; derives date, price and due type on the server, returning created true/false when called repeatedly.
- Existing private financial-state trigger, Payment Collections RPC, receipts and balances remain the original mechanism.

**IMPORTANT:** The current live collect_payment/corrections RPC authorization defect (HIGH-002) remains unresolved. SP3 does not fix it, nor other Parent UPI privileged RPC risks. External payment use remains **NO-GO** until remediated.

**Operational migration constraints:** Live migration ledger is incomplete relative to checked-in sources (82 applied versions versus ~41 repository migrations). Requires verified restore rehearsal and Owner-authorized migration packaging, isolated staging, real signed-JWT authorization/tenant tests and exact SQL review before any live deployment. The code is not a certified live database migration.

## 3. Frontend and parent integration

- **oneTimeCampDueService.js:** Feature flag REACT_APP_ENABLE_SP3_ONE_TIME_DUES must equal true to enable billing UI; default OFF, including local builds. This is public presentation config and is NOT the authorization boundary. Sends only enrollment ID to the secure RPC; detects missing backend and rejects unexpected RPC responses.
- **PaymentDues.js:** selecting a One-time camp locks Due Type to One-time and Due Date to saved camp start date; shows plan amount preview. With flag OFF, displays a warning and disabled Generate Due. Once separately enabled following approved backend rollout, confirmation calls server RPC and either creates one charge or reports already existing. One-time due Edit/Delete are hidden and handler-blocked; database trigger is the real enforcement.
- **PaymentCollections.js:** not rewritten. Generic pending-due selection, existing collect_payment ledger, partial/full status and receipt printing can consume correctly created One-time dues, but MUST NOT be exposed to external beta until HIGH-002 is fixed.
- **parentPortalService.js:** includes joined camp plan name in authorized child dues and receipt history. **ParentFinancialOverview.js** displays named camp fee and printable receipt fee identity; **ParentUpiPaymentSubmission.js** shows named camp in existing claim dropdown. Parent financial records remain scoped through RLS.
- No live financial records, deployment to main, Vercel, migrations or real receipts were created.

## 4. Focused validation

[SP3 GitHub Actions 43299940829](https://github.com/saurabh-shelke1993/acadpro-app/actions/runs/43299940829) passed on source SHA f4abad11757f387ad398df959c51c88e05903d16:

- Disposable PostgreSQL 16: schema + reviewed SQL applied, Owner/SA creation allowed, foreign academy / Parent / Coach / signed-unmapped role denied, forged amounts/dates denied, misbilled monthly/registration denied, repeat call and separate-enrollment duplicates blocked, immutable charged plan/enrollment/due enforced, partial collection trigger and existing monthly due regression verified.
- Frontend Jest: 8 new service tests + 11 Payment Dues tests + 2 Parent service tests + 1 Parent Financial Overview test = **22 PASS**; React production build **PASS**.
- No live Supabase data or actual money was used. Real signed JWT, two-browser concurrency, deployed SQL and full integrated collection tests remain pending.

## 5. Your exact UI acceptance checklist

**SP3-A — On local development branch, feature flag OFF (safe checks now):**

1. Academy Owner → Finance → Subscriptions → Player Subscriptions. Select a disposable One-time camp enrollment and verify its Start and End dates remain as saved. Do not change real paid subscriptions.
2. Finance → Payment Dues → + Generate Due. Choose academy, center, batch, a disposable test player, then a One-time camp enrollment. Expected: Due Type reads One-time, read-only; Due Date equals saved camp start, read-only; Amount preview equals plan amount.
3. Expected notice: **One-time camp payment dues are not enabled yet.** Generate Due button disabled. No fee inserted. Do not work around the notice by choosing Monthly or Registration.
4. Choose an existing monthly test subscription. Its original standard amount and RC1.2 first-month adjustment options (where eligible) remain available. Do not create a real paid due solely for UI testing.
5. Check mobile (375px and 430px), Super Admin academy selection, and Coach/Parent lack of Generate Due access. Existing dues list and filters remain usable.

**SP3-B — Only after separately authorized disposable staging rollout of the exact backend and enabling the flag there:**

6. Academy Owner, disposable Summer Camp U12, plan Amount ₹3,000, registration fee ₹0, Start 12 May 2027 and End 25 May 2027. Confirm once: exactly one pending One-time due, ₹3,000, due date 12 May, Paid ₹0, Remaining ₹3,000. Subscription and plan unaffected.
7. Repeat Generate, including from second session; one camp charge only. Camp due Edit and Delete unavailable; direct API attempts to duplicate, misbill as Monthly, forge price/date or mutate charged plan/enrollment rejected.
8. Coach, Parent, unmapped signed token and other academy Owner cannot generate One-time charges (including direct RPC). Super Admin can only use valid same-academy player+plan pairs.
9. **After HIGH-002 security remediation and explicit isolated-test approval:** Collect a partial payment and final payment; verify correct balance/status, legitimate receipts and payment history. Existing monthly dues must still work.
10. Parent Portal → Financial Overview: linked parent sees named camp fee, outstanding/partial/paid and payment history. Receipt displays Summer Camp U12. Parent from another academy cannot see these records. UPI claim workflow is optional and requires its own RPC security gate.

Report PASS/FAIL for every applicable item. Passing local tests does not authorize enabling live camp billing.

## 6. Remaining launch gates

- **Not done:** live SQL deployment, migration ledger/restore review, real JWT security approval, concurrency reproduction on deployed SQL, Owner UI PASS, collection RPC HIGH-002 correction and full-system QA.
- Other 16 known failures in four Coach/Player Performance Jest suites remain a separate release item.
- SP3 is **implemented + focused tested + default disabled**, NOT live-deployed, NOT manually accepted and NOT beta-ready.
