# Kheltriva — PS-L1 Subscription Lifecycle Calendar Calculator

**Date:** 6 November 2026  
**Branch:** `payment-module-finalization`  
**Implementation commit:** [`387e1210b3ec462dc41fd6d91fa2f1c534ae2276`](https://github.com/saurabh-shelke1993/acadpro-app/commit/387e1210b3ec462dc41fd6d91fa2f1c534ae2276)  
**Status:** **Implemented and focused-CI tested.** No business-UI wiring, Supabase/SQL/migration/renewal/due creation. The legacy 22 subscriptions remain on hold pending Owner PS-L0B reconciliation.

## Scope

- Source: `frontend/src/utils/subscriptionLifecycleDates.js` (pure calendar module).
- Tests: `frontend/src/utils/subscriptionLifecycleDates.test.js` (86 focused cases).
- CI: `.github/workflows/subscriptions-merge-validation.yml` runs lifecycle tests separately after existing workspace/Sidebar/Player Subscriptions suites and before React production build.
- Read-only and data-independent: no React, Supabase, HTTP, clock, `Date` mutation or time-zone reads; only strict ISO YYYY-MM-DD proleptic Gregorian calendar arithmetic. No database was queried or written as part of calculator execution.

## Public helper API

| Export | Purpose / key inputs | Output |
|---|---|---|
| `SUBSCRIPTION_CYCLE_MONTHS` | Mapping: monthly=1, quarterly=3, half_yearly=6, yearly=12 | Frozen mapping |
| `isLeapYear(year)` | Gregorian century/leap check | Boolean |
| `addSubscriptionCalendarDays(date,dayOffset)` | ISO date and signed whole number of days | ISO date; bounds 0001–9999 |
| `calculateSubscriptionPeriod({anchorStartDate,billingCycle,periodIndex=0})` | Original agreement anchor and 0-based period index | Start, original/effective inclusive end, next renewal, anniversary day and cycle |
| `calculateRebasedSubscriptionPeriod({effectiveEndDate,billingCycle})` | Effective end after Owner-approved extension/pause | New regular period starting next day; **new anniversary day** |
| `calculateVacationExtension({effectiveEndDate,extensionDays,successorPeriodExists=false,successorDueExists=false})` | Positive whole-day extension; provisional successor presence flags | Original/effective end, extension days and next renewal |
| `calculatePauseEntitlement({periodStartDate,effectiveEndDate,verifiedPaidThroughDate,pauseDate})` | Pause inside a **verified fully paid** period | Paused date, prior effective end and inclusive unused paid days |
| `calculateResumeEntitlement({pausedAt,resumeDate,remainingPaidDays})` | Resume strictly after pause; positive integer frozen days | Resume date, resumed effective end and next renewal |

### Calendar examples: exact expected results

| Case | Period start | Inclusive effective end | Next renewal |
|---|---|---|---|
| Monthly | 2026-11-05 | 2026-12-04 | 2026-12-05 |
| Quarterly | 2026-11-05 | 2027-02-04 | 2027-02-05 |
| Half-yearly | 2026-11-05 | 2027-05-04 | 2027-05-05 |
| Yearly | 2026-11-05 | 2027-11-04 | 2027-11-05 |
| 31 Jan 2027, monthly period 0 | 2027-01-31 | 2027-02-27 | 2027-02-28 |
| Same anchor, period 1 | 2027-02-28 | 2027-03-30 | 2027-03-31 |
| Same anchor, period 2 | 2027-03-31 | 2027-04-29 | 2027-04-30 |
| 29 Feb 2024, annual period 0 | 2024-02-29 | 2025-02-27 | 2025-02-28 |

### Adjusted-period examples

- Initial monthly period `2026-11-05`–`2026-12-04`, Owner-approved **10 free calendar days** → new effective end `2026-12-14`, next renewal `2026-12-15`. The next regular monthly period rebases to `2026-12-15`–`2027-01-14`.
- Paid period `2026-11-05`–`2026-12-04`: pause effective `2026-11-20` freezes **15 inclusive unused days**, provided verified paid-through is at least `2026-12-04`. Resume `2027-01-10` → entitlement through `2027-01-24`, next renewal `2027-01-25`.
- **Normal renewals must use the same original `anchorStartDate` and increasing `periodIndex`.** Rebase only after a verified Owner-approved extension or pause/resume; otherwise month-end anniversaries can drift.

## Safety limits and intentionally deferred responsibilities

1. **Pure preview, not authorization:** The calculator does not verify Academy Owner permissions, payment receipts or plan/academy linkage. In a later phase, authoritative server-side/RLS controls must verify the Owner actor and tenant before writing.
2. **Verified paid-through required:** `calculatePauseEntitlement` throws if a verified paid-through date does not cover the full effective period, avoiding accidental granting of unpaid free training days. It cannot infer paid-through from current due/payment records.
3. **Successor presence is advisory here:** `successorPeriodExists` and `successorDueExists` are caller inputs; future transactional implementation must recheck both in the database under concurrency and audit the approved extension.
4. **No double consumption protection in pure helper:** Persisted pause event state, audit, idempotency, overlap prevention and reactivation constraints belong to PS-L2/PS-L3 transactional design.
5. **Calendar, not scheduler:** The calculator never checks current date/time, triggers renewals, writes `end_date`, creates dues, changes contracted price or touches historical payments.
6. **No UI/manual browser gate for PS-L1:** The helper is not imported into current player subscription forms; business acceptance applies when integrated in a later approved phase.

## Automated validation

GitHub Actions [Subscriptions run 42163864483](https://github.com/saurabh-shelke1993/acadpro-app/actions/runs/42163864483) on **exact source SHA `387e1210b3ec462dc41fd6d91fa2f1c534ae2276`**:

| Validation | Result |
|---|---|
| New PS-L1 calendar Jest | **86/86 PASS** |
| Existing Subscriptions workspace | **18/18 PASS** |
| Existing Sidebar suites | **24/24 PASS** |
| Existing Player Subscriptions page | **3/3 PASS** |
| **Total targeted tests** | **131/131 PASS** |
| React production build | **PASS — compiled successfully** |
| Full-app Phase 7.5 Jest | **FAIL 16/418**, four suites: Coach Profile and Player Performance (tracked independently) |
| User live UI acceptance | **Not applicable in this phase** |
| Live payment/renewal integration | **Not implemented or tested** |

## Phase status and next action

- **PS-L1:** source implemented, deterministic unit tests passed and GitHub commit recorded. No database migration or live record change.
- **PS-L0B:** anonymized read-only legacy inventory complete; all 22 rows **renewal-ineligible pending Owner confirmation** of original recurring price, paid-through and first prospective renewal date.
- **PS-L2 next:** *design-only* period/event/price snapshot schema, academy-safe RLS and idempotent period-to-due association, with migrations **unapplied** until Owner approval. Existing Subscription Plans UX redesign and Player Subscriptions PS2 mobile improvements stay separately scoped.

**Release boundary:** This checkpoint is not automatic renewal functionality and does not imply new end dates are visible in the UI.
