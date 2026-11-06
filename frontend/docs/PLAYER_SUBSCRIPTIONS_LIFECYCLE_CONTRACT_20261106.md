# Kheltriva — Player Subscription Lifecycle Contract v1.1

**Date:** 6 November 2026  
**Latest decision:** Original recurring price locked for existing subscribers until an explicit Academy Owner-approved change. PS-L0B read-only audit completed; Owner row-level activation decisions pending.  
**Branch inspected:** `payment-module-finalization` at `cdd029deba64334aebf2c7db2d0cbd4d2fce0014`  
**Status:** Six product requirements approved. Technical safeguards and phased plan documented. **No application code, SQL migration, database records, scheduler, or RLS policy changed in this checkpoint.**

## 1. Approved product decisions

1. Calculate each plan's **inclusive start and end dates** using calendar-month periods: monthly (1), quarterly (3), half-yearly (6), yearly (12).
2. An Academy Owner may approve **free calendar-day extensions** for vacations; the effective end date and next renewal move accordingly, with an auditable reason.
3. **Renew automatically** from the calendar day immediately following the effective end date and create **exactly one pending subscription payment due for the new period**. No automated collection, receipt, or payment-status mutation is implied. Renewal does not depend on the previous period being paid.
4. **Pause** suspends future renewals and due generation; record unused paid calendar days and **resume** by applying those days from the approved resumption date.
5. Keep a paused player **on the current batch and attendance roster**, visibly labelled Paused. Preserve existing attendance marking permissions; do not force present/absent or exclude the player.
6. Reconcile existing legacy subscriptions and associated payments first; start new billing periods **prospectively**, with **no retroactive automatic payment dues or fabricated historical periods**.

## 2. Date-only calendar rules (technical contract)

- Use ISO `YYYY-MM-DD` date values and **Asia/Kolkata academy-local calendar days for the initial India deployment**. Do not calculate validity by adding fixed 30/90/180/365-day durations or by mutating a JavaScript timestamp in UTC. Support academy-specific time zones later without rewriting the domain logic.
- The subscription has a **billing anniversary day** (1..31); the initial anniversary is its original start-day. At each subsequent target month, use that day or the month's final valid calendar day, whichever is earlier. **Recalculate from the anniversary anchor**, not from February's clamped date, avoiding permanent month-end drift.
- An unadjusted billing period is `[startDate, nextAnniversaryDate - 1 calendar day]`, both endpoints inclusive. The next period starts `effectiveEndDate + 1 calendar day`; periods must neither overlap nor leave unintended gaps.
- Example: start 2026-11-05, monthly → end 2026-12-04; renewal starts 2026-12-05 → end 2027-01-04.
- Example: start 2027-01-31, monthly and anchor 31 → first period ends 2027-02-27; next starts 2027-02-28, next ends 2027-03-30; then start 2027-03-31. Leap years clamp February to 29 when applicable.
- On an approved vacation extension or pause/resume, delay the next renewal to one day after the **revised effective end** and **rebase the future anniversary** to that actual next start; never silently backdate billing.
- Validity calculator must be a **pure, separately tested function** before enabling any database write or scheduler; include Feb 29, 30th/31st, year boundaries, quarterly/six-month/yearly, and successive renewals.

## 3. Domain model proposed for later migration (not implemented)

- Retain existing `player_subscriptions.id` as the stable **agreement/subscription identity** referenced by existing `payment_dues.subscription_id`. Never delete/reinsert this row during renewal.
- Introduce a separate **subscription_periods** ledger: subscription, academy, period start, original end, effective end, billing anniversary, cycle snapshot, contracted amount snapshot, state, created reason and timestamps. Only one current period per agreement, no overlapping periods.
- Introduce **subscription_lifecycle_events** (or equivalently immutable adjustment and pause records) recording old/new effective end dates, days granted or frozen, Owner actor, reason, approved date and timestamps. Any correction needs an explicit audited action.
- Link each newly generated **payment due** to its specific period through a unique period association while **preserving** the existing subscription FK and every preexisting due/payment/receipt.
- Add database guards to prevent duplicate active agreements, overlapping periods and duplicate renewal dues. Enforce integrity **at the database transaction boundary**, not only by the current frontend duplicate-active check.
- Distinguish agreement states `active`, `paused`, `inactive` from payment states `pending`, `partial`, `paid`. **Paused is not Inactive**. Preserve existing reads and display behavior until a compatibility migration has passed regression.
- **No scheduler is presently enabled.** Supabase Cron uses `pg_cron`; activation and any required extension must be a separately reviewed and approved step.

## 4. Renewal operation: safety and accounting

- One atomic, server-controlled and **idempotent** operation determines eligible agreements, creates a new period and a pending `payment_dues` row. A rerun, network retry, concurrent invocation or delayed scheduler must not produce duplicates.
- Eligibility: approved legacy migration/activation checkpoint, active agreement, current player remains active, plan association matches the academy and plan is valid, subscription not paused/inactive, current period actually expired, no already-generated successor period/due.
- Create new period and one corresponding **subscription fee due** with `due_date` equal to that period's start date. Due amount comes from the agreed subscription price snapshot. No implicit registration-fee repetition and no new payment/receipt rows.
- Existing pending/partial/paid dues remain unchanged; unpaid prior dues do **not** block renewal because the Owner explicitly approved automatic renewal, but must remain visible as outstanding balances.
- `monthly`, `quarterly`, `half_yearly`, `yearly` mapping must be supported consistently by Subscription Plans, Player Subscriptions, Payment Dues and parent-facing finance. Currently the Plans form offers monthly/quarterly/half_yearly and Payment Dues manual form offers monthly/quarterly/registration: **yearly support is not yet implemented**.
- Renewal scheduler must be time-zone-aware, observable, retry-safe and disabled until reviewed, role/RLS tested and manually accepted. A dry-run report is mandatory before creating any due.
- **APPROVED PRICING RULE (6 November 2026):** An existing subscriber retains their **originally agreed recurring price**, even if the Academy Owner later edits the Subscription Plan's default amount. Only an explicit, authorized Owner price-change action may alter that agreement's **future** billing periods. Each period must store an immutable contracted-price snapshot; previous periods, dues, collections and receipts are never retroactively repriced.
- **Legacy pricing evidence limitation:** Existing `player_subscriptions` records contain no enrolled-rate snapshot. Current plan amounts and historical due amounts are **not sufficient proof** of the original agreement. **Every legacy subscription requires explicit contracted-price confirmation** before activation. A price change action must record old/new rates, actor, reason, approval date and first affected future period; it must never silently change already-generated dues.
- **No approval for backfilling prices from today's plan rate:** any initial price snapshot for legacy rows requires a separately reviewed Owner-approved reconciliation result.

## 5. Vacation extensions, pause/resume and exceptions

- Owner-approved vacation extension adds a positive integer number of **free calendar days** to the currently open period's effective end. Require a reason, preview and audit; no new due is generated for the free interval.
- No overlapping or retroactively changed periods. If the next period/due has already been created, **do not silently move dates or rewrite the due**: block the ordinary extension and use a separately reviewed correction workflow.
- Pause effective on date D while a paid period remains: freeze inclusive unused entitlement `[D, effectiveEndDate]`; e.g. 15 days remaining. Record `paused_at`, reason, remaining paid days. There is no new due for the paused gap and no automatic status change to existing dues.
- Resume on approved date R: remaining entitlement covers `[R, R + remainingDays - 1 day]`; only after that effective end does the next paid renewal begin. Require approval and audit, avoid double-applying unused days, and rebase the renewal anniversary after resumption.
- Pending dues created **before pause** remain outstanding, not erased, paid or refunded automatically. Hold changes to previously paid periods unless a separate accounting correction has been approved.
- Coach attendance continues to show the roster entry with **Paused** indicator; attendance marking retains existing permissions and has no forced present/absent value.
- Deactivated players must not renew automatically even if a legacy subscription says active; an administrator must resolve the mismatch first.

## 6. Current database and legacy reconciliation (read-only baseline)

- Inspected `player_subscriptions`, `subscription_plans`, `payment_dues` columns, relationships and RLS. Existing `player_subscriptions` has nullable `end_date`, `status`, and the stable FK from `payment_dues.subscription_id`.
- As of 2026-11-06: **22 active player subscriptions, all 22 without an end date**; **4 subscriptions link a player to a plan in another academy**, with **6 associated dues, 5 paid or partially paid**; **1 active subscription references a player marked inactive**. These groups may overlap.
- `subscription_plans` currently holds monthly and quarterly plans only in live data. There are existing historical payment dues; do not rebuild or relink them automatically.
- PS-L0B **read-only pseudonymized reconciliation matrix is complete** at `PLAYER_SUBSCRIPTIONS_PS_L0B_RECONCILIATION_20261106.md`. No names, raw UUIDs or amounts are committed. It records per-subscription academy matching, player activity, multiple active agreements, plan cycle, dues and payment evidence. **Owner decisions on paid-through date, locked recurring price and prospective activation date are still pending.**
- Every existing row starts **`renewal_eligible = false` by policy** until reviewed. Owner approves its future paid-through/end date and first prospective renewal anchor; if evidence is insufficient, keep it quarantined rather than guessing or back-billing.
- **No blanket UPDATE/INSERT**, retroactive period backfill, repairs to paid dues or archive/deactivation of the four mismatches without explicit, case-by-case approval and verifiable rollback plan.

## 7. Roles and data isolation

- Super Admin: platform-scope oversight and lifecycle management according to existing Role Matrix. Academy Owner: manage only own-academy subscriptions and events. Coach: assigned-scope read only, see Paused badge in roster. Parent: linked-child read-only in Parent Portal.
- Use existing RLS/data-scope protections, enforce matching player/plan academy IDs **server-side** and avoid any service-role credential in the React client. Any future scheduler/RPC must have reviewed EXECUTE privileges, trusted actor controls, schema-qualified objects and deterministic audit logs.
- Preserve existing dues, payment collection/correction, receipt, attendance, analytics and Parent Portal behavior. No migration touching these paths without explicit regression and negative cross-tenant tests.

## 8. Controlled implementation phases

| Phase | Deliverable | Database effects | Approval/test gate |
|---|---|---|---|
| PS-L0A | Freeze lifecycle contract + read-only schema and row audit | None | **This checkpoint: approved six rules, written contract** |
| PS-L0B | Pseudonymized reconciliation matrix for 22 subscriptions and all 26 dues, including 4 academy mismatches, 4 players with two active subscriptions, 1 inactive player and payment evidence gaps | **SELECT only; audited** | **Audit complete; Owner row-level decisions pending** |
| PS-L1 | Standalone date-only calendar and pause-day calculator with exhaustive Jest edge tests | None | Build and deterministic unit tests, owner review of month-end cases |
| PS-L2 | Proposed schema/RLS/migration SQL and test plan, initially un-applied | None until explicitly authorized | Review data model, unique constraints, grants, Parent/Coach reads |
| PS-L3 | Apply approved schema + add Owner extension/pause/resume controls | **Controlled migration** | Staging/isolated tests + Owner acceptance, no live blanket mutation |
| PS-L4 | New period + payment due idempotent transaction, dry-run/backfill eligibility and scheduled job **disabled by default** | Controlled transactional writes after approval | Repeated-run/concurrency and cross-tenant negative tests |
| PS-L5 | Prospective per-subscription activation and scheduler rollout | Approved future-period writes only | Manual acceptance, operational monitoring, rollback and payment regression |
| PS-L6 | Docs, Git and release sign-off | None outside approved phases | Exact-HEAD tests, production review, no unapproved changes |

**PS-L0B audit complete (SELECT only).** Next safe implementation: PS-L1 pure date/extension/pause calculator and deterministic unit tests. In parallel, Owner reviews PS-L0B flagged records, confirms paid-through and contract price, and approves prospective activation dates. **No migrations or scheduler activation permitted until reconciliation acceptance and separate migration review.**

## 9. Implementation-state checklist

- [x] Six lifecycle rules explicitly decided by Product Owner
- [x] Original recurring price lock explicitly approved; only Owner-approved prospective repricing allowed
- [x] Existing Github branch/source and Supabase schema reviewed
- [x] Reconciliation risks identified at aggregate level
- [x] Per-subscription pseudonymized **read-only** reconciliation matrix created; **Owner activation/price/paid-through decisions outstanding**
- [ ] Calendar/extension/pause calculator and tests
- [ ] Database schema/security migration reviewed and approved
- [ ] Automated renewal/billing code and scheduler created
- [ ] Manual browser/role/tenant regression and production sign-off

**End of contract. This document is planning only, not evidence of a deployed feature or migration.**
