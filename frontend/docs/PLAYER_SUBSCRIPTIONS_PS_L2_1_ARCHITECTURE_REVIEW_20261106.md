# Kheltriva — PS-L2.1 Subscription Lifecycle Database and Architecture Review

**Date:** 6 November 2026 (Asia/Kolkata)
**Source branch and revision:** payment-module-finalization, 6dda6fa6d2d7837164daa1ac3b2d301f3360c635
**Live project:** Supabase ulyealhkmlorsbdiknrh
**Status:** READ-ONLY REVIEW COMPLETE. This is a design proposal, NOT an approved/applied migration. No subscription, due, payment, RLS, grants, UI, RPC or scheduler changes were made.

## 1. Problem and approved policy

When an existing Active subscription is selected for the same player and plan, **Create subscription** is blocked by the UI's duplicate protection. This is expected and should be preserved. **Renew** is a separate operation that should create the next billing period under the existing subscription ID rather than creating another Active agreement. Editing a historic start date must not be used as a substitute for period renewal.

Approved: calendar-based monthly/quarterly/half-yearly/yearly validity, future contiguous automatic renewal, exactly one pending recurring due for each new billable period, free Owner-approved vacation extensions, pause/resume that freezes verified unused paid days, Paused badge without removing the player from the roster, locked original recurring rate unless explicit Owner future-only reprice, academy-configurable fixed-calendar-month or anniversary-month alignment, and proration of initial partial fixed-month fees where approved. All legacy agreements require Owner reconciliation before prospective-only activation; no back-billing.

**Open product policy:** academy default proration method; session cancellation/holiday exclusions and approvals; whether simultaneous separate tuition products are legitimate. Do not guess these settings during a database migration.

## 2. What exists in live Postgres and React (verified with SELECT only)

| Object | Current facts | Missing for lifecycle |
|---|---|---|
| **subscription_plans** | Academy-scoped mutable catalog, numeric recurring amount, cycle, registration fee and active flag; plan FK deletion uses SET NULL | Locked per-player contract price, historical plan snapshots |
| **player_subscriptions** | Stable UUID, player_id, subscription_plan_id, start_date, nullable end_date, Active/Inactive status; no persisted academy_id or contracted rate | Period ledger, pause, renewal, academy alignment and audit |
| **payment_dues** | Player/subscription FK, due_type, due_date, numeric total/paid/remaining, due_status; current manual UI uses current plan amount | Period FK, one-tuition-due-per-period uniqueness, saved proration basis |
| **payments** | Due FK, amount, payment/adjustment type, receipt and transaction history | No replacement needed; retain all existing payments |
| **payment_corrections / parent_payment_submissions** | RESTRICT FKs into due/payment records | Full regression for corrections and Parent UPI before changing FKs |
| **batch_schedules / player_batch_schedules** | Active scheduled weekdays and player's enrollment dates | Immutable snapshot of priced training occurrences and approved cancellations |
| **academies** | No persisted subscription billing alignment or proration preference | Separate academy-level billing policy setting |

**Existing deletion risks:** the agreement -> payment_dues FK uses ON DELETE CASCADE; payment_dues -> payments also uses ON DELETE CASCADE. These can affect financial ancestry and must be reviewed along with restrictive correction/Parent UPI references. No FK changes are applied here.

**Existing financial code:** public.collect_payment is an authorized SECURITY DEFINER RPC that locks the due FOR UPDATE, validates the user's role, tenant scope and overpayment, then records a payment/receipt. A private BEFORE INSERT/UPDATE due trigger enforces nonnegative totals and computes pending/partial/paid status, protecting paid fields from unauthorized direct UPDATE. The new renewal writer should reuse this financial model rather than bypassing it. Current Payment Dues UI checks duplicates by subscription_id + due_date client-side, not via a unique constraint.

**Tenant policies:** RLS is enabled for the subscription, plan, dues, payments and schedule tables. Live player_subscriptions policies allow Super Admin ALL, Academy Owner scoped management, Parent linked-child SELECT; **no Coach SELECT policy**, whereas the Role Matrix describes assigned-scope read. This discrepancy should be reconciled in PS-L2.2; do not grant Coaches fee-ledger access merely to display a Paused badge.

**Table grants:** information_schema reports broad ANON and AUTHENTICATED grants including TRUNCATE, on the current subscription, plan, dues and payment tables. TRUNCATE is not row-limited by RLS. Standard application routes do not expose it and this is NOT proof of a remotely exploitable UI path; it is a **least-privilege hardening gate** before financial migrations. Do not revoke privileges without an isolated impact/RPC review.

**Legacy data:** 22 Active subscription rows, all NULL end dates; four players with two Active subscriptions, five subscriptions without linked dues, one Active subscription referencing an inactive player, and 26 linked payment dues. The earlier PS-L0B report recorded **4** academy-mismatched agreements; a fresh read-only query now returns **3**, and previously reported pseudonymous reference S-e19cfc1265 has a changed start date and matching academy/plan. Treat the older reconciliation matrix as historical, not a current activation authorization. Re-run owner reconciliation before any write.

**No pg_cron extension is currently enabled.** Do not turn on scheduled billing during design.

## 3. Recommended relationship model — NO TABLES DEPLOYED

### A. Agreement — preserve player_subscriptions.id

Keep the existing UUID and historical payment_dues.subscription_id links. After case-by-case legacy reconciliation, propose a verified agreement academy_id, contracted_rate_paise, currency INR, billing_cycle_snapshot, billing_alignment snapshot, optional approved proration method, anniversary anchor, lifecycle status (Active/Paused/Inactive), and a separate renewal-eligibility/HOLD state. Existing Active is NOT proof of paid-through entitlement. No blanket price backfill from mutable plan.amount.

### B. Academy-level billing policy (proposed new academy_subscription_billing_settings)

One row per academy, alignment fixed_calendar_month or anniversary_month; method calendar_days or scheduled_sessions only when the academy explicitly chooses one; effective-dated/versioned changes. Future agreements use settings chosen at enrollment. Do not silently change existing subscribers' alignment, locked rate or historic periods when catalog plans or academy defaults change.

### C. Subscription periods (proposed new subscription_periods)

One row per dated billing installment:
- period ID, stable agreement FK, academy/player IDs validated against agreement, period_sequence and source/type;
- inclusive period_start, original_end, effective_end, original anniversary anchor and cycle/alignment snapshots;
- original contracted recurring rate in integer paise, **this period's actual billed amount** in paise, currency and method;
- for prorated periods: original full-period bounds, joining/enrollment date, eligible and total scheduled-session/day counts, approved exclusion occurrence snapshot and rounding basis;
- period status and created/approved timestamps; no overlaps with other billable periods of the same agreement.
Use unique agreement + sequence/idempotency keys and transactional row locking. A database overlap exclusion constraint is an option, requiring extension/impact review. Do not reconstruct unverified historical periods or bill unknown legacy periods.

### D. Immutable lifecycle events (proposed new subscription_lifecycle_events)

Record Renew, approved Extension, Pause, Resume, future-only Reprice, and manual Correction as separate auditable events. Preserve actor/role/time/reason, the affected agreement/period, old/new dates/rates, frozen verified paid days and idempotency reference. Change audit history by appending a correcting event rather than deleting or silently overwriting paid periods.

### E. Link future dues to periods, preserve existing due IDs

Recommend nullable payment_dues.subscription_period_id for newly generated dues only, with a restrictive FK and at most **one recurring tuition due per period** (registration/one-time charges remain separate). Keep existing subscription_id pointing to the same stable agreement. Legacy dues retain NULL period ID until explicitly verified, not a guessed mapping. Existing payments/receipts/corrections/Parent UPI rows are preserved. Consider preventing or replacing destructive cascade FK paths with RESTRICT as a separately authorized migration, alongside soft-deactivation.

### Proposed topology (not live)

    Academy
      ├── Subscription billing policy (future)
      └── Player
           └── Existing Player Subscription = durable Agreement
                ├── Contracted recurring price and billing alignment (future)
                ├── Period 1 ── Tuition Due 1 ── Payment/Receipt
                ├── Period 2 ── Tuition Due 2 ── Payment/Receipt
                ├── Period N...
                └── Immutable lifecycle events: Extend / Pause / Resume / Reprice

## 4. Lifecycle transaction semantics (to be implemented later)

**New assignment:** For an eligible player with no duplicate active tuition agreement, authorized server checks player/plan/academy, future billing settings, contracted rate and proration. It must atomically create the durable agreement, first period and one pending tuition due only once. PS-L1P2 is simulation-only, NOT authorization to charge.

**Renew existing agreement (Arjun scenario):** UI would route to Renew on the existing agreement. Secure server operation locks the agreement, confirms the last effective end, prospective date and no successor/due, creates exactly one next period and pending due, and returns existing results on retry/concurrency. **Do not modify historical dues or require outstanding old dues to be Paid**, per approved renewal policy. For fixed alignment, next first-of-month boundary; for anniversary, next approved anchor; after extension/resume use the adjusted anchor.

**Extend:** Owner approves positive free calendar days; audit old/new effective end and reason, rebase next renewal date; reject when successor already billed without a separately approved correction.

**Pause:** Status Paused; no new future periods/dues, record remaining VERIFIED paid calendar days inclusive of pause date; retain all prior pending/partial/paid dues and player's attendance roster entry.

**Resume:** Owner approves later date, restores exactly frozen days without double consumption, shifts effective end and future renewal anchor, records immutable event. Attendance shows Paused until resumed.

**Reprice:** Owner approves future-only contracted rate change; existing periods, dues, collection history and receipts remain unchanged. Plan catalog edits do not silently affect enrolled rates.

**Scheduled engine:** Later only, disabled by default; idempotent transactional renewal, explicit job identity/permission, dry-run, retry, observability, timezone and failure alerts. Do not expose service credentials to the React frontend or enable cron yet.

## 5. Security/invariants required before any financial migration

1. Academy Owner: own-academy management; Super Admin platform management; Parent linked-child subscription/finance read; Coach only assigned-scope nonfinancial status (if separately approved) and no payment operations.
2. Enforce player/plan/academy relationship with authoritative database checks, including cases where client passes a forged UUID. Separate RLS SELECT and mutation tests plus grant review.
3. New public tables: enable RLS and specify least privilege. Some ledger/audit writes should be transaction-only. Privileged routines require explicit EXECUTE grants, actor/tenant checks and fixed search_path; SECURITY DEFINER is exceptional.
4. Unique agreement/period sequence and period/due association; block overlapping billable periods. Do not rely on the existing UI duplicate check or payment due date alone.
5. **Do not enforce one active agreement per player prematurely**: existing four dual-active players have different plans. Decide whether concurrent different tuition products are valid, then design uniqueness around the approved primary tuition/service scope.
6. Protect financial ancestry from DELETE; test existing correction/Parent UPI constraints and payment RPCs before changing cascade behaviors. Audit broad ANON/AUTHENTICATED TRUNCATE grants without assuming the Data API exposes that SQL statement.
7. Keep amounts exact: new integer paise snapshots convert to existing NUMERIC due amounts exactly; trigger controls financial due status. Test partial, paid, adjustment, refunds/claims and idempotent rollback.
8. Coordinate yearly billing-cycle and half-yearly due-type support with Subscription Plans and Payment Dues forms; they are not live for all cycles today.

See current Supabase RLS guidance (https://supabase.com/docs/guides/database/postgres/row-level-security) and Cron overview (https://supabase.com/docs/guides/cron).

## 6. Staged development plan and decisions

| Phase | Deliverable | Status / gate |
|---|---|---|
| **PS-L2.1** | Live schema, dependencies, constraints/RLS/grants review; proposed agreement/period/due model | **REVIEW DONE, DOCUMENTED; no code or schema changes** |
| **PS-L2.2** | Proposed actual columns, FKs, constraints, RLS grants and secure functions; delete-cascade and rollback strategy | **NEXT, review/approval before migration** |
| **PS-L2.3** | Source-controlled migration candidate and isolated legacy/tenant fixtures, NOT applied live | After explicit PS-L2.2 approval |
| **PS-L3** | Owner New/Renew/Extend/Pause/Resume UI and DB transactions | After schema/security test gates |
| **PS-L4** | First-period proration and renewal due integration; idempotent/concurrency tests | After locked price/holiday/method and due-design approval |
| **PS-L5** | Case-by-case legacy prospective activation; monitored scheduler release | After PS-L0B Owner approvals; no back-billing |
| **PS-L6** | Full financial, role, browser, build/CI, production QA and docs sign-off | Separate release gate |

**Open Owner decisions for later phases:** (a) one primary tuition agreement per player or multiple legitimate concurrent tuition products; (b) default method and holiday exclusion treatment; (c) existing agreements retain their original alignment when academy default changes (recommended YES); (d) no eligible session first month: defer vs manually approve (recommended defer); (e) authorize per-legacy contracted price/paid-through and future start date; (f) Super Admin overrides and approval trace.

## 7. Completion and release boundary

- [x] Current branch and five source-of-truth docs checked
- [x] Live SELECT-only schema, FKs, indexes, triggers, payment RPC, RLS, grants and data-quality review
- [x] Reviewed existing React subscription create/edit/deactivation, dues and scoped session preview
- [x] Identified Parent UPI/corrections, delete-cascade and legacy reconciliation dependencies
- [x] Proposed durable Agreement -> Period -> Due model with rate and audit snapshots
- [ ] Owner architecture/design approval
- [ ] PS-L2.2 detailed SQL/RLS/transaction and rollback design
- [ ] PS-L0B Owner case approvals / prospective activation
- [ ] Migration, renewal, billing, end-date persistence, pause/resume and scheduler implementation
- [ ] Targeted/full authenticated security testing and manual production acceptance

**No UI testing required for PS-L2.1: this was a read-only analysis/documentation phase.**
