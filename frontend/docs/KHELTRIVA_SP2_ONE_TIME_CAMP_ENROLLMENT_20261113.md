# Kheltriva SP2 — One-time camp player assignment with explicit dates

**Date:** 13 November 2026 (IST)
**Branch:** `sp2-one-time-camp-enrollment-dates` targeting `payment-module-finalization`
**Product phase:** SP2 only (after SP1 plan-definition implementation)
**Status:** CODE IMPLEMENTED IN ISOLATED DEVELOPMENT BRANCH. Focused CI PASS (253 subscriptions tests + 27 payment-related tests, both React builds) at source SHA `6143d82`; Product Owner UI acceptance and integration still pending; no production release authorization.

## Accepted scope and behavior

1. A subscription plan created in SP1 with `subscription_plans.billing_cycle = 'one_time'` is selectable under **Finance → Subscriptions → Player Subscriptions**.
2. On a **new** One-time assignment, the existing Start date becomes the camp's explicit first day and **End date becomes editable and required**, with a minimum equal to Start. There is no inferred calendar-month or quarterly end. An inclusive one-day camp is valid.
3. Validate real, strict Gregorian YYYY-MM-DD dates using existing date-only calendar utilities, reject empty/invalid end date or end before start; keep the form value until changed. Switching the selected plan clears the manually entered camp end so dates do not leak across plans.
4. A new One-time enrollment writes one row to existing `player_subscriptions` with `player_id`, `subscription_plan_id`, `start_date`, `end_date` and `status = 'active'`, using the original existing RLS-enforced insert path. The UI checks the selected player's academy matches the plan academy before posting, but **RLS is authoritative**.
5. A player may be assigned a One-time camp **while retaining a separate regular Monthly subscription**. The existing duplicate active player + same plan check remains; repeat enrollment on the same active One-time plan is blocked until a future verified process. There is no per-camp-period idempotency constraint.
6. On the Edit form, existing recorded end dates are displayed **read-only**. SP2 does not amend or backfill prior periods; switching an existing undated subscription into a One-time camp is blocked. The existing recorded-period edit safety rule remains.
7. Existing Monthly, Quarterly, Half Yearly and supported recurring calendar date calculation, advisory monthly fee preview, 7-item pagination, Parent/Coach navigation/RLS and Super Admin multi-academy filters are unchanged.
8. One-time plan display uses `one-time` wording rather than a recurring per-month rate. The assignment confirmation states **no payment due was generated**.

## Safety exception: temporary Payment Dues guard

The existing Payment Dues Generate form previously allowed a Monthly or Registration due for any subscription. SP2 prevents misclassification for One-time camp subscriptions **until SP3**:
- The selected One-time camp displays an explicit unavailable warning.
- Generate Due button is disabled even if Monthly or Registration is selected.
- The click handler also returns before posting, as a defense against a stale UI.
- Existing Monthly/Quarterly generation remains untouched. One-time receipts, corrections and backend idempotent charging are **not implemented** here.

**Important:** these are FRONTEND protections, not a new trusted financial authorization boundary. Direct clients may still call existing endpoints with unsupported combinations. This must be addressed by SP3 and the existing financial security work before real external beta users can access the workflows.

## Database and role evidence

- Live `public.player_subscriptions` already has nullable `start_date`/`end_date` columns, no new schema objects needed for explicitly dated One-time enrollment.
- Live `subscription_plans.billing_cycle` is TEXT with `one_time` accepted for plan definitions (SP1).
- Academy Owner `player_subscriptions` INSERT RLS checks current academy player and same-academy plan; Super Admin is separately scoped. No policy changes or bypass introduced.
- No hosted data write/test, SQL DDL, migrations, payment mutations, `main` deployment or automatic renewal/expiration scheduler.
- Old open-ended and inconsistent legacy subscriptions stay as-is. Existing HIGH-001 / HIGH-002 and beta security NO-GO remain open.

## Tests and validations

- [x] Pure One-time camp date validation: summer/winter spans, single-day, invalid Feb/ISO, reversed periods, missing end.
- [x] UI: One-time plan enables End date, requires manual value, doesn't display monthly fee preview, clears manually entered end on plan switch.
- [x] UI: valid One-time creation preserves exactly the two dates in `player_subscriptions`; no `payment_dues`, `payments` or renewal call.
- [x] UI: existing separate Monthly plan does not block camp assignment; duplicate ACTIVE same camp plan still blocked.
- [x] UI: Super Admin cannot pair foreign-academy player and plan; legacy edit dates not silently rewritten.
- [x] UI: Payment Dues explicitly refuses One-time misbilling before SP3.
- [x] Existing Subscriptions and RC1.2 Payment Dues scoped tests + React production build on source SHA `6143d82`: [subscriptions run 43294033296](https://github.com/saurabh-shelke1993/acadpro-app/actions/runs/43294033296), [payment dues run 43294033154](https://github.com/saurabh-shelke1993/acadpro-app/actions/runs/43294033154). Final docs-only head validation remains separate.
- [ ] Product Owner manual desktop/mobile checks — see below.

## Product Owner UI acceptance checklist — local SP2 branch or merged development branch

**Role:** Academy Owner, using a disposable test player/plan only.

1. **Finance → Subscriptions → Subscription Plans:** Ensure a **One-time** test plan exists for the correct academy. If there isn't one, you can review the SP2 form using a prepared safe test fixture; do not create paid records solely for testing on a real player's account.
2. **Finance → Subscriptions → Player Subscriptions:** Select Center, Batch, an eligible test player and a One-time plan. **End date should be empty and editable**, unlike monthly plans; note states end must be entered and **no due, renewal or auto-expiry** is generated.
3. Set **Start = 12 May 2027**, **End = 25 May 2027**. Expected dates remain exactly as entered; no computed 31 May. Changing One-time to Monthly should compute **31 May 2027**, make End read-only and clear the previous manual camp end.
4. With no End, or with End before Start, attempt Create only in a safe test environment. Expected inline error; nothing is written. Then enter correct dates.
5. For an approved disposable test player with no duplicate active camp plan, click **Create subscription**. Expected a single One-time row with **12 May–25 May 2027**, unchanged separate Monthly enrollment, no payment due or collection added. Do not use a real paid player for this write test.
6. Re-select the same player + camp plan. Expected **Active subscription already assigned**; Create disabled and Edit shortcut available. Edit shows saved camp dates but End read-only. **Do not change/save paid or historical records to test editing**.
7. **Finance → Payment Dues → Generate Due:** select the camp subscription. Expected warning that One-time dues aren't available until SP3. Generate Due remains disabled for Monthly or Registration; this does not mean the backend is secure yet.
8. **Super Admin:** academy filter remains available and another academy's plan cannot be assigned to a foreign player. Coach/Parent do not gain management access.
9. **Mobile:** test approximately 375px width; Center, Batch, Player, Plan, Start, End and button fit with no horizontal overflow.

Send PASS/FAIL for each numbered step. Keep RC1.3 / SP1 Owner UI acceptance separate from SP2.

## SP3 and release blockers

**SP3 remains PENDING:** server-authoritative single camp charge creation, correct `one_time` due type, transactionally idempotent duplicate prevention, review of `registration_fee` semantics, payment collection and receipt, Parent Portal visibility, direct API negative/JWT tests and audit trail. Any camp re-enrollment or expiry automation must be a separate Owner-approved decision. **Do not** infer payment/renewal/expiry from a stored end date; status remains manually controlled.

**Release verdict:** Existing security NO-GO unchanged, even if focused tests pass.
