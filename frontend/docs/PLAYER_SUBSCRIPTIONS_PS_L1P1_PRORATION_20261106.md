# Kheltriva — PS-L1P1 Pure Monthly Proration

**Date:** 6 November 2026  
**Branch:** `payment-module-finalization`  
**Validated source SHA:** `00eb8d365b4bd6c9dc7d0abc8c5c81b56bf6239f`  
**State:** Implemented and unit/CI tested; **not integrated into academy settings, forms, invoices or payment dues**.

## Approved rules and intentionally pending decisions

Owner approved two future academy-level monthly alignments: `fixed_calendar_month` and `anniversary_month`. The initial fixed-calendar partial period is eligible for proration. An anniversary subscription joining January 15 covers January 15–February 14 at the full agreed recurring amount. For fixed-month subscriptions, the method **must be explicitly specified** (`calendar_days` or `scheduled_sessions`); no academy-wide method/default or holiday policy is yet approved.

Original recurring price stays locked after the one-time initial discount. Proration never alters registration fees, existing dues, payments, receipts or past periods.

## Implemented pure API

- `frontend/src/utils/subscriptionProration.js` imports only the PS-L1 calendar date helper; **no React, Supabase, network, clock, database or side effects**.
- `calculateInitialMonthlyProration({billingAlignment,joinDate,agreedAmountPaise,prorationMethod,sessionSlots,excludedOccurrences})`.
- `agreedAmountPaise` is a nonnegative safe integer; fractional pricing uses `BigInt` intermediate arithmetic with final **half-up** paisa rounding.
- Fixed-month output exposes whole-month boundaries, joining date, first-period end, renewal on the next calendar month's first day, `eligibleCount`, `totalCount`, `firstPeriodAmountPaise`, `agreedAmountPaise`, `discountPaise`, selected schedule IDs and `requiresReview`.
- Session inputs are **trusted authorized schedule/enrollment snapshots from a future caller**, with distinct `scheduleId`, ISO `dayOfWeek` (Mon=1..Sun=7), `enrolledFrom`, optional `enrolledUntil`; multiple same-day slots count independently. Optional exact `{scheduleId,date}` exclusions represent approved cancellations; no holiday/cancellation table currently exists.
- Schedule validation rejects missing, inactive, duplicate and malformed entries; invalid exclusion dates/IDs/days fail closed. No eligible sessions results in **zero quote + `requiresReview=true`**, **not** a license to generate a zero-value due. Full-month denominator zero throws.

## Calculation examples (₹1,500 recurring rate)

| Billing alignment/method | First-period coverage | Eligible / total | First-period fee |
|---|---|---:|---:|
| Fixed, Mon/Wed/Fri sessions | 15–31 Jan 2027 | 7 / 13 sessions | **₹807.69** |
| Fixed, calendar days | 15–31 Jan 2027 | 17 / 31 days | **₹822.58** |
| Anniversary | 15 Jan–14 Feb 2027 | Full rolling month | **₹1,500.00** |
| Fixed, Wednesday-only | 15–31 Jan | 2 / 4 slots | ₹750.00 |
| Fixed, Mon/Wed/Fri plus second Friday slot | 15–31 Jan | 10 / 18 slots | ₹833.33 |

Initial prorated prices are **not** automatically carried into renewals; future full periods use the original locked contractual rate.

## Validation and implementation evidence

- Source commits: [`3a0f406`](https://github.com/saurabh-shelke1993/acadpro-app/commit/3a0f40649c53e23b1e42d31145b98c111e9db017), [`03fa4ee`](https://github.com/saurabh-shelke1993/acadpro-app/commit/03fa4eea1bcdc520529d53df2a59274ceb0ef952), [`a0bc1ee`](https://github.com/saurabh-shelke1993/acadpro-app/commit/a0bc1eebf8a268c493681b46af460306a5de685f), [`00eb8d3`](https://github.com/saurabh-shelke1993/acadpro-app/commit/00eb8d365b4bd6c9dc7d0abc8c5c81b56bf6239f).
- [Subscriptions validation run 42167075145](https://github.com/saurabh-shelke1993/acadpro-app/actions/runs/42167075145): **61/61 PS-L1P1, 86/86 PS-L1, 45/45 existing Subscriptions/Sidebar tests; 192/192 targeted Jest tests and React production build PASSED.**
- Full frontend [run 42167075109](https://github.com/saurabh-shelke1993/acadpro-app/actions/runs/42167075109) still **fails 16 of 479 tests in four unrelated Coach Profile/Player Performance suites**.
- No schema, migration, RPC, RLS, Cron, subscription update, payment due, collection, receipt or academy-settings change; no live UI acceptance needed for this utility-only phase.

## Next gates

**PS-L1P2:** Plan an Academy Owner **read-only quote preview** using validated scopes and clear numerator/denominator; no due creation. Resolve academy proration-method/default and holiday/cancellation policy before connecting UI.

**PS-L2:** Propose (do not apply) academy billing-alignment configuration, immutable period price/method/schedule snapshot, linked due uniqueness, RLS and idempotency. All 22 PS-L0B legacy agreements still require Owner paid-through and rate reconciliation before any automatic renewal.
