# Kheltriva — Mid-cycle Player Subscription Proration (PS-L1P proposal)

**Date:** 6 November 2026  
**Source branch inspected:** `payment-module-finalization` at `ce2b51080e8d8d14a5d52c6224add9023ba94f4c`  
**State:** Billing alignment APPROVED; PS-L1P1 pure calculator implemented and focused-tested. No live UI, academy setting, database migration, payment due or data change.

## 1. Incoming requirement

A player joining an academy **partway through January** should not automatically be charged a full fixed-calendar-month recurring fee when they have fewer training opportunities in the remainder of that billing period. For a Monday/Wednesday/Friday batch the fee may be based on the actual number of scheduled sessions remaining, rather than an assumed 12 per month.

**Do not confuse** the proposed fixed-calendar-month first period `15 Jan–31 Jan` with the already-approved PS-L1 rolling anniversary month `15 Jan–14 Feb`. The latter covers a full calendar month of entitlement and ordinarily bills full price. **Owner decision (6 November 2026):** support both fixed-calendar-month and rolling-anniversary monthly alignment as academy-configurable options. Do not silently change PS-L1 existing anniversary contract.

## 2. Two calculation modes (proposed)

### A. Calendar-day ratio

`firstPeriodFee = roundToPaisa(lockedRecurringFee * inclusiveEligibleCalendarDays / inclusiveCalendarDaysInFullFixedPeriod)`.

Example **January 2027**: INR 1,500 recurring amount, join `2027-01-15`, first partial period ends `2027-01-31`. **17 / 31 days** = **INR 822.58** after final rounding. Under the approved fixed-calendar alignment, the next full INR 1,500 renewal would begin on 1 February.

### B. Scheduled training-session ratio (preferred operational default, subject to approval)

`firstPeriodFee = roundToPaisa(lockedRecurringFee * scheduledEligibleSessionsFromJoinDate / scheduledSessionsInFullFixedPeriod)`.

Use **actual authorized scheduled session occurrences** on the selected player's enrollment in their batch, with ISO weekday `1=Monday..7=Sunday` and start date inclusive. Do not use an approximate `3 x 4 = 12` session denominator, and do not base charges on post-join **attendance**, which may penalize absences retrospectively.

Read-only SQL for Mon/Wed/Fri in **January 2027** verified: **13 occurrences overall, 7 from Jan 15 onward**. At INR 1,500 the proposed session-based fee is **INR 807.69**. Other calendar months may have different counts. If the academy cancels sessions/declares holidays, the fee quotation must use an explicitly approved cancellation/holiday schedule snapshot; this does **not** exist in the current database.

If a particular authorized batch has multiple sessions on a weekday, count each distinct scheduled session occurrence once; do not conflate sessions with unique training days.

### Amount and consistency rules

- Calculate in **integer paise** (or server-side exact NUMERIC with a single documented final rounding rule) and round **half-up** at final invoice creation; do not accumulate floating-point fractions across renewals.
- Proration applies **only to recurring tuition for the initial partial fixed billing period**, not to registration fees unless independently approved.
- Snapshot recurring contracted rate, calculation method, full period dates, join/eligible date, scheduled/eligible counts, schedule IDs/versions, cancellations applied, rounded initial amount and actor/time as part of later billing-period ledger.
- Future full periods use the **locked enrolled recurring price**, never permanently reduce the agreement rate. Any future Owner-approved changes only affect future period snapshots.
- An approved vacation extension and pause/resume are **separate** from first-period proration. Never automatically refund absences, retroactively revise Paid dues or charge twice for a partial period.
- When there are **no scheduled sessions remaining**, avoid generating a zero-value pending subscription due automatically; propose joining at the next period or a separately approved manual exception.
- The quote is a server-validated, idempotent first-period price determination. No customer manipulation of academy, batch, player, enrolled schedules, rate or ratio can override trusted data scopes.

## 3. Existing implementation and database review

- `PlayerSubscriptions.js` currently inserts `player_id`, `subscription_plan_id` and `start_date`; it does not apply proration, snapshot fee or populate end date. Original page/filters and data-scope helpers must be preserved.
- `SubscriptionPlans.js` stores the plan's default recurring `amount`, `billing_cycle`, `registration_fee`. The original contracted recurring price is NOT separately stored in `player_subscriptions`; legacy contracts still require Owner reconciliation.
- `PaymentDues.js` currently uses `subscription_plans.amount` when creating a due, so plugging in a prorated price **only in the subscription form** would not be sufficient to protect the ledger. PS-L2 should capture immutable per-period billed amount and its relationship to the due before enabling writes.
- Active `batch_schedules`: 29 rows across 10 batches (the live snapshot); each row has weekday, times, `academy_id`, `batch_id` and `is_active`.
- `player_batch_schedules` has player-level enrollment, active flag and `enrolled_from`/`enrolled_until` dates; live 19 active mappings across seven players. Batch schedule day counts are **not** by themselves proof of a specific player's entitlement.
- No dedicated academy holiday, cancelled-session or reschedule table was located by read-only schema inspection. Any initially proposed exact session-based quote must disclose this limitation and allow a controlled, auditable override/holiday-exclusion strategy.
- Existing `player_subscriptions`, `subscription_plans` and `payment_dues` RLS policies remain authoritative. **No schema migrations** were applied in this design task.

## 4. Proposed phased implementation before PS-L2

| Phase | Work | Approval / safety gate |
|---|---|---|
| PS-L1P0 — Design | Compare fixed-calendar vs anniversary model, actual session denominator, cancellation policies, locked price | **Alignment approved: both models; proration method/default still pending** |
| PS-L1P1 — Pure proration utility | **Implemented:** calendar-day/session calculations, enrollment, exclusions, rounding and validation | **61/61 tests PASS, no SQL/UI/billing writes** |
| PS-L1P2 — Owner preview | First-month quote shows Start/End, nominal rate, sessions/days total and eligible, discount and first-period fee; no automatic charge | Alignment approved; requires proration method/default and preview data-scope decision |
| PS-L2 — Model design | Proposed optional billing alignment, initial method, immutable period amount and basis, schedule snapshot, due linkage, adjustment audit and RLS | **Review-only migration design**; none applied |
| Later PS-L3/PS-L4 | Persist first period through an authorized transaction, create exactly one due, renew at full locked rate | Reconciliation + owner acceptance + RBAC/financial regression + idempotency |

## 5. Owner decision recorded — 6 November 2026

**Approved:** Both fixed-calendar-month and anniversary-based monthly billing will be configurable by academy. Fixed-calendar mid-month admissions may be prorated; anniversary months retain the full rolling-month charge.

**PS-L1P1 implemented:** `frontend/src/utils/subscriptionProration.js` and `subscriptionProration.test.js`; explicit method `calendar_days` or `scheduled_sessions` is required for a fixed-calendar quote. This is a calculation library, **not a saved academy configuration or financial workflow**.

**CI:** [Run 42167075145](https://github.com/saurabh-shelke1993/acadpro-app/actions/runs/42167075145) at `00eb8d3` — 61 new tests, 192/192 total targeted tests and React production build passed. See `PLAYER_SUBSCRIPTIONS_PS_L1P1_PRORATION_20261106.md`.

**Still pending:** Academy-wide method/default, holiday policy, preview UI, authorized schedule/price snapshot, financial ledger/RLS migration and any due generation. No billing or database data changed.
