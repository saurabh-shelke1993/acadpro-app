# Kheltriva — Player Subscription Lifecycle Contract v1.8

**Date:** 6 November 2026  
**Latest decision:** Original recurring price locked for existing subscribers until explicit Academy Owner approval of a future-only change. **PS-L1 pure date calculator implemented and focused-CI validated**. PS-L0B Owner row-level activation decisions pending.  
**Branch inspected:** `payment-module-finalization` at `cdd029deba64334aebf2c7db2d0cbd4d2fce0014`  
**Status:** Lifecycle/locked-price and both monthly billing alignments approved. PS-L1 and PS-L1P1 pure calculators plus PS-L1P2 **read-only form preview** implemented/targeted CI tested. No saved academy setting, contracted-price/period ledger, due or payment integration. No SQL migration, financial data change, RLS or scheduler activation.

## 1. Approved product decisions

1. Calculate each plan's **inclusive start and end dates** using calendar-month periods: monthly (1), quarterly (3), half-yearly (6), yearly (12).
2. An Academy Owner may approve **free calendar-day extensions** for vacations; the effective end date and next renewal move accordingly, with an auditable reason.
3. **Renew automatically** from the calendar day immediately following the effective end date and create **exactly one pending subscription payment due for the new period**. No automated collection, receipt, or payment-status mutation is implied. Renewal does not depend on the previous period being paid.
4. **Pause** suspends future renewals and due generation; record unused paid calendar days and **resume** by applying those days from the approved resumption date.
5. Keep a paused player **on the current batch and attendance roster**, visibly labelled Paused. Preserve existing attendance marking permissions; do not force present/absent or exclude the player.
6. Reconcile existing legacy subscriptions and associated payments first; start new billing periods **prospectively**, with **no retroactive automatic payment dues or fabricated historical periods**.

### PS-L2.2 Owner-approved product decisions

**Owner D1–D7 APPROVED 6 November 2026:** Only one date-effective **regular tuition** entitlement per player/academy, regardless of whether a monthly/quarterly period belongs to a different subscription agreement. Special camps (e.g., Diwali) may run simultaneously as **separate nonrecurring programme enrolments**, optionally linked to the existing agreement; Academy Owner-approved **per-camp** pricing may be free, included in regular tuition or separately chargeable; the camp module remains a future separate feature. Scheduled-session proration is academy default with calendar-day option; only Owner-approved holidays/cancellations affect session counts; existing agreement prices/cycles/alignment stay fixed except prospective Owner change; zero-eligible-session fee deferred/manual exception; Coach Paused roster-only; financial cascade/privilege fixes independently approved for execution. **Business rules approved, no SQL/app migration authorized.** See `PLAYER_SUBSCRIPTIONS_PS_L2_2_OWNER_DECISIONS_20261106.md`.

### PS-L2.3 unapplied schema + isolated testing checkpoint

The proposed foundation SQL is source-controlled at `supabase/proposals/subscriptions/ps_l2_3_foundation.sql`; PostgreSQL 17 isolated CI **passed** on `5afae2a` ([run 42195789707](https://github.com/saurabh-shelke1993/acadpro-app/actions/runs/42195789707)). It is **NOT** applied to Supabase, does not add running lifecycle RPCs, and does not charge dues. Future regular tuition periods must exclude overlaps per player/academy even across different agreements. New immutable agreement fields remain locked with default `legacy_hold` pending Owner-authorized activation. Full report: `PLAYER_SUBSCRIPTIONS_PS_L2_3_ISOLATED_CANDIDATE_20261106.md`.

## 2. Date-only calendar rules (technical contract)

- Use ISO `YYYY-MM-DD` date values and **Asia/Kolkata academy-local calendar days for the initial India deployment**. Do not calculate validity by adding fixed 30/90/180/365-day durations or by mutating a JavaScript timestamp in UTC. Support academy-specific time zones later without rewriting the domain logic.
- The subscription has a **billing anniversary day** (1..31); the initial anniversary is its original start-day. At each subsequent target month, use that day or the month's final valid calendar day, whichever is earlier. **Recalculate from the anniversary anchor**, not from February's clamped date, avoiding permanent month-end drift.
- An unadjusted billing period is `[startDate, nextAnniversaryDate - 1 calendar day]`, both endpoints inclusive. The next period starts `effectiveEndDate + 1 calendar day`; periods must neither overlap nor leave unintended gaps.
- Example: start 2026-11-05, monthly → end 2026-12-04; renewal starts 2026-12-05 → end 2027-01-04.
- Example: start 2027-01-31, monthly and anchor 31 → first period ends 2027-02-27; next starts 2027-02-28, next ends 2027-03-30; then start 2027-03-31. Leap years clamp February to 29 when applicable.
- On an approved vacation extension or pause/resume, delay the next renewal to one day after the **revised effective end** and **rebase the future anniversary** to that actual next start; never silently backdate billing.
- **PS-L1 IMPLEMENTED:** Pure `frontend/src/utils/subscriptionLifecycleDates.js` date-only helper with **86 passing Jest tests**, covering Feb 29, month-end 29/30/31, short months, year transitions, 1/3/6/12-month cycles, continuous anniversary preservation, vacation extension, verified paid-day pause and resumed anniversary rebasing. Not yet imported into subscription forms or renewal/payment services. See `PLAYER_SUBSCRIPTIONS_PS_L1_CALCULATOR_20261106.md`.

## 2A. Approved PS-L1P alignment + implemented pure proration (not integrated)

**Approved by Owner (6 November 2026):** Support **both fixed-calendar-month and anniversary-month monthly billing**, configurable by academy. For a first partial fixed calendar month, tuition is eligible for proration. Anniversary-based periods cover a full rolling month and do not automatically prorate. Future full renewals use the original locked agreed amount.

**Implemented in PS-L1P1:** Pure `frontend/src/utils/subscriptionProration.js` handles inclusive calendar-day and actual scheduled-session calculations with strict ISO dates, trusted-input assumptions, enrollment windows, optional session exclusions, and half-up rounding in integer paise. A fixed-month quote **requires explicit method selection**; academy-wide default proration method is **not yet approved**. The utility returns an advisory `requiresReview` flag if no eligible sessions remain and never generates a due.

**Automated validated:** 61 new tests + 86 prior PS-L1 + 45 Subscriptions/Sidebar = **192/192 focused tests, production React build PASS** at `00eb8d3`, [CI run 42167075145](https://github.com/saurabh-shelke1993/acadpro-app/actions/runs/42167075145). **No UI integration, academy setting storage, schedule authorization service, schema migration or financial record modification.** See `PLAYER_SUBSCRIPTIONS_PS_L1P1_PRORATION_20261106.md`.

### PS-L1P2 estimate-only UI (implemented, not authoritative billing)

- Academy Owner and Super Admin can view a non-persisted first-month estimate after selecting a player and monthly plan in `PlayerSubscriptions.js`. Fixed-month vs anniversary and day vs scheduled-session methods are selected **explicitly for that preview only**, not stored as academy billing policy.
- A scoped, active player schedule read via existing `playerScheduleService` supports session estimates. Missing/inactive/denied schedules fail closed; no holiday exceptions applied and no staff attendance history is treated as fee entitlement. Academy mismatch between player and plan blocks estimation.
- Preview uses `subscription_plans.amount` as a provisional input **only**; this is not historical locked contract-price evidence. Browser message explicitly states that creating a subscription **does not** save any estimated end date, model, discount or due. Financial writes, automatic renewal and lifecycle database migration remain **unimplemented**.
- Focused tests **203/203 PASS and React build PASS** at `7e0ddb4` (CI 42169267470); manual Owner/SA/browser acceptance pending. See `PLAYER_SUBSCRIPTIONS_PS_L1P2_PREVIEW_20261106.md`.

### Previous proposal and accounting examples

The Owner requested reduced charges for a child joining mid-January, ideally based on the actual Mon/Wed/Fri sessions remaining. This request requires an explicit alignment decision: the existing PS-L1 rolling anniversary month 15 Jan–14 Feb is a full monthly entitlement, but a **fixed calendar-month** first period 15–31 Jan can be prorated. Two future calculations are proposed: actual authorized **scheduled sessions** remaining / actual sessions in the full calendar month (preferred for coaching), or inclusive eligible **calendar days** / full calendar days. Count distinct schedule occurrences, not assumed 12/month or attendance marks. At INR 1,500 in January 2027 Mon/Wed/Fri there are 13 sessions, seven from January 15: INR 807.69. Calendar days: 17/31 = INR 822.58. Only an initial partial period should be discounted; later full periods renew at the agreed locked price.

**Updated status:** Both alignments approved and the read-only preview UI is implemented. **Not approved:** saved academy billing default/method or holiday/cancellation data policy. No holiday ledger, authoritative billing UI, generated dues or migration. Do not change existing PS-L1 anniversary behavior. Detailed proposal: `PLAYER_SUBSCRIPTIONS_PRORATION_PROPOSAL_20261106.md`.

### PS-L2.1 actual schema and architecture checkpoint (planning only)

Verified live Postgres schema, grants, RLS and financial/UPI dependencies. Recommended durable existing subscription agreement -> proposed period ledger -> one linked new tuition due per period; snapshot original contracted rate separately from first prorated amount; immutable Owner lifecycle events; and academy-configurable alignment/settings. For an existing Active subscription, **Renew**, not Create, is the intended future action.

Current subscription->due and due->payment FK deletion is CASCADE. Grants are broader than RLS use, including TRUNCATE, and must be reviewed before new billing. Prior PS-L0B showed 4 mismatched academy plans; fresh read-only SQL shows 3, so legacy audit must be rerun. **No migration or actual financial lifecycle behavior was implemented.** See PLAYER_SUBSCRIPTIONS_PS_L2_1_ARCHITECTURE_REVIEW_20261106.md.

### PS-L2.2 detailed security/transaction proposal (NOT approved or applied)

A separately reviewed design specifies versioned academy billing policies, frozen contracted recurring paise and legacy HOLD on stable agreements, dated priced periods and append-only events, and nullable period-linked future tuition dues protected by database uniqueness. A single authenticated/authorized database transaction would lock the agreement, verify player/plan/tenant/date/rate, create one period and one pending due, then append a non-rewriteable idempotent audit event. Pauses/resumes/free extensions and repricing have separate guarded future workflows. Existing dues/payments/receipts and legacy history remain untouched.

Future financial RLS/GRANT permissions, current TRUNCATE and ON DELETE CASCADE risks, 4 dual-Active player groups, current 3 academy mismatches and legacy Owner paid-through evidence are mandatory gates. **No schema, payment, UI or scheduler implementation yet.** Full proposal: `PLAYER_SUBSCRIPTIONS_PS_L2_2_SCHEMA_SECURITY_TRANSACTIONS_20261106.md`.

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
| PS-L1 | **Implemented** standalone date-only calendar and pause/resume calculator with 86 Jest tests; no UI/DB wiring | None | **Automated tested:** Subscriptions CI 42163864483 PASSED (131 total targeted tests + React build). Owner business examples accepted in v1.1 contract; live lifecycle acceptance deferred. |
| PS-L2 | Proposed schema/RLS/migration SQL and test plan, initially un-applied | None until explicitly authorized | Review data model, unique constraints, grants, Parent/Coach reads |
| PS-L3 | Apply approved schema + add Owner extension/pause/resume controls | **Controlled migration** | Staging/isolated tests + Owner acceptance, no live blanket mutation |
| PS-L4 | New period + payment due idempotent transaction, dry-run/backfill eligibility and scheduled job **disabled by default** | Controlled transactional writes after approval | Repeated-run/concurrency and cross-tenant negative tests |
| PS-L5 | Prospective per-subscription activation and scheduler rollout | Approved future-period writes only | Manual acceptance, operational monitoring, rollback and payment regression |
| PS-L6 | Docs, Git and release sign-off | None outside approved phases | Exact-HEAD tests, production review, no unapproved changes |

**PS-L1 source + focused automated tests complete.** Next isolated phase: **PS-L2 proposal-only subscription periods/events schema, price snapshots, RLS and idempotent due-link contract**. Do not apply migrations, wire forms, add renewal jobs or create dues without explicit schema/security approval and per-row Owner legacy reconciliation. PS-L0B approval remains outstanding.

## 9. Implementation-state checklist

- [x] Six lifecycle rules explicitly decided by Product Owner
- [x] Original recurring price lock explicitly approved; only Owner-approved prospective repricing allowed
- [x] Existing Github branch/source and Supabase schema reviewed
- [x] Reconciliation risks identified at aggregate level
- [x] Per-subscription pseudonymized **read-only** reconciliation matrix created; **Owner activation/price/paid-through decisions outstanding**
- [x] **PS-L1 source and unit tests passed** (86/86); **real browser/ledger integration not implemented**
- [x] PS-L1P1 pure first-period proration calculator (61 passing tests), not integrated into billing
- [ ] Database schema/security migration reviewed and approved
- [ ] Automated renewal/billing code and scheduler created
- [ ] Manual browser/role/tenant regression and production sign-off

**End of contract. PS-L1 and PS-L1P1 are pure implemented/tested helpers. Academy settings, lifecycle UI/database and automatic billing are still planned, not deployed.**
