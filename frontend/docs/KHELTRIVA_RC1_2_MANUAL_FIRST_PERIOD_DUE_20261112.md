# Kheltriva RC1.2 — Owner-entered first-period adjusted payment due

**Date:** 12 November 2026
**Branch:** `rc1-2-first-period-manual-fee`, from accepted RC0/RC1.1 development branch `payment-module-finalization`.
**Status:** **IMPLEMENTED IN DEVELOPMENT PR ONLY; CI and manual Owner/browser testing are not established at document creation.**
**Production/release:** NOT deployed; AG3.4E remains NO-GO. No hosted DDL/DML, new migration, financial data mutation or automatic renewal.

## Original problem

Player Subscriptions displays an advisory first-period fee quote, but its Create and Edit handlers save only agreement player/plan/start_date. In `PaymentDues.js`, the Generate Due handler has always copied the **catalog plan amount** into `payment_dues.total_amount`. For a ₹1,500 monthly plan and a manually checked first period of ₹1,269.23, the due would otherwise be ₹1,500. The preview alone is NOT a billed or saved price.

RC1.1 provided **Edit existing subscription** instead of a duplicate Create path. RC1.1 Owner UI acceptance still requires explicit reporting.

## Agreed narrow RC1.2 beta behavior

1. Keep the standard Generate Due workflow and amount unchanged by default.
2. For an **active**, **same-academy** monthly subscription with **due type Monthly** and **due date exactly the subscription's saved start_date**, show a separate **Use an Owner-approved first-period amount** checkbox.
3. When enabled, request a **manually entered INR amount** and a required reason of 8–180 characters. Require **₹0.01 or greater and less than the current catalog plan amount**; accept at most two decimal places and stay within `numeric(10,2)`.
4. Show exact entered amount in the preview, and require a separate explicit confirmation that the new due is a *one-time* reduced first-period charge. **No fee from the advisory calculator is silently transferred.** The Owner must independently verify eligible session/day counts and any approved holidays/cancellations.
5. Immediately before a manual adjusted due is written, re-fetch the active subscription, its current catalog price, its player academy and plan academy under existing RLS. Refuse stale, unauthorized, invalid-month or cross-academy inputs.
6. Refuse a manually adjusted first-period due if **any prior monthly due** exists for that subscription; also preserve the existing same subscription + due-date duplicate read. Any historical due with a payment must be handled by a separately reviewed financial correction (not rewritten by this workflow).
7. On Owner confirmation and passing checks, call the **existing** `createPaymentDueService` for **one new pending due** with an adjusted `total_amount`, `paid_amount=0`, `due_status='pending'`, and explanation in `remarks`. Do not update `subscription_plans.amount`, `player_subscriptions`, existing dues, payments, receipts or renewal terms.
8. Hide manual adjustment for Coach/Parent roles; preserve live Academy Owner/Super Admin RLS as the enforcement authority.
9. Reset manual entry whenever the selected subscription, date, due type or modal changes. Disable Generate while in flight and when same-date duplicate is found.
10. Mobile controls remain single-column at narrow widths.

**Financial boundary:** `remarks` provides an operational explanation but **is not a tamper-proof or immutable approval record**. This is manual beta-only billing, not the PS-L2 automated lifecycle. Future recurring fees remain an Owner-approved business contract *not persisted or automatically charged by this step*.

**Concurrency limitation:** Live `payment_dues` has no unique index on `(subscription_id,due_date)`. Existing same-date and existing-monthly-due checks prevent ordinary duplicate workflows but do **not** prevent two simultaneous independent sessions from posting duplicates. A separate, reviewed database-enforced uniqueness/idempotency solution is still required as a release risk; no safety claim is made here.

## Source/database reviewed

- `PaymentDues.js` and `paymentService.js`; PlayerSubscriptions preview and date/proration utilities.
- Existing live database schema: `payment_dues.total_amount numeric(10,2)`, `remarks text`, RLS Owner and Super Admin authorization, correct player/subscription linkage.
- `private.enforce_payment_due_financial_state` trigger rejects negative totals and overpaid rows, manages due status, and restricts post-insert edits of financial fields to authorized financial operations. RC1.2 does **not** bypass this trigger.
- Previous inventory: 22 active open-ended legacy agreements, three academy/plan mismatches, four player groups with multiple active agreements. No automatic reconciliation of these records.

## Automated test plan

- Price ₹1,500 and manually approved first-month fee ₹1,269.23 recorded as a **pending due**, with reason and unchanged full plan price.
- Full-price existing Generate Due remains unchanged when manual checkbox is off.
- Reject negative, zero, full-rate, higher-rate, 3-decimal, scientific-notation and oversized amounts; reject absent/too-short/too-long reasons.
- Restrict to active matched-academy monthly subscription and exact start date; reject old-month/manual period alterations.
- Reject when a monthly due already exists; preserve same-date duplicate protection, and no paid/settled adjustments.
- Coach cannot access Generate Due.
- React production build, owner desktop/mobile acceptance. **Exact PR CI outcome to be recorded after execution.**

## Owner UI acceptance — test only on RC1.2 local branch or approved preview

**Role: Academy Owner. Menu: Finance → Payment Dues → + Generate Due.**

1. Choose an academy, center, batch, test player and an **active monthly subscription with no linked monthly dues**. Choose **Due Type = Monthly**, **Due Date = subscription start date**. Expect to see **Use an Owner-approved first-period amount**.
2. Check it. Enter an amount lower than the standard plan, such as **₹1,269.23** for a ₹1,500 plan, and a reason like **Joined mid-month; 11 of 13 scheduled sessions**. Expect the due preview to show the entered amount; no amount is automatically copied from the subscription calculator.
3. Click **Generate Due**. Expect a confirmation showing both **₹1,269.23** and **₹1,500.00**. **Use a disposable test academy/subscription or test environment for the actual Confirm/save; do not generate a new due against real paid player records.** Confirm on a disposable fixture; expect one Pending due with Total ₹1,269.23, Paid ₹0, Remaining ₹1,269.23, and an explanation in Remarks.
4. Select an amount above ₹1,500 or ₹0, or enter a reason shorter than eight characters. Expect rejection; no due inserted.
5. Change Due Type to Registration or change Due Date away from the subscription start date. Expect manual adjustment controls to disappear and the ordinary form to remain unchanged.
6. Try a subscription that already has a monthly due. Expect manual insertion to be rejected; existing payment history unchanged.
7. Test the default (checkbox off) Generate Due with **a separate disposable subscription**. Expect full plan price and existing behavior.
8. Check 375px and 430px mobile widths; ensure inputs, note and confirmation work without overflow. Verify Super Admin scope and Coach/Parent cannot generate dues.

**If you are working against the live Supabase database, do not press Confirm on any actual financial record without a separate controlled fixture/approval.** Screenshot or report only synthetic data and PASS/FAIL outcomes.

## Deferred to future phases

- Automatic due creation directly on subscription creation or renewal, scheduled billing, persisted proration model, approved holiday/cancellation ledger, immutable rate/period snapshots, and changing existing paid/partial due amounts.
- Backend transactional/idempotent creation and durable approval event log; migration history replay remains blocked by the existing 82-entry live vs incomplete local migration source discrepancy.
- Production release and high-severity security fixes HIGH-001/HIGH-002 remain separate release blockers.

## Completion gates

- **Implemented (code):** manual amount, reason, recheck, limited duplicate safeguards, UI warnings and tests, within a development PR.
- **Automated tested:** PENDING exact PR head CI.
- **Manually tested:** PENDING Owner review.
- **Deployed:** NO.
- **Financial/RBAC security acceptance:** NOT COMPLETE.
- **Release gate:** NO-GO unchanged.
