# Kheltriva — PS-L0B Legacy Subscription Reconciliation (read-only)

**Date:** 6 November 2026  
**Source:** Active Supabase `acadpro-db` (`ulyealhkmlorsbdiknrh`)  
**Code baseline:** `payment-module-finalization` at `d7a7f72de74ed89b48f0397ae128f7a36508815f`  
**Status:** **SELECT-only audit complete; Owner review and activation approval pending.** No subscriptions, payment dues, collections, plan rates, migrations, RLS policies or Cron jobs were modified.

## Financial policy confirmed

**Existing subscribers keep the originally agreed recurring price until the Academy Owner explicitly approves a prospective change.** A change of the template `subscription_plans.amount` must not update an already enrolled subscriber's contracted rate. New periods require an agreed-price snapshot and any subsequent price change requires an Owner approval/audit record. The current schema has **no original contracted-rate snapshot**, so no legacy price can be accepted by inference from current plan amount or dues alone.

## Scope and data-handling

This audit used read-only SQL on `public.player_subscriptions`, `players`, `subscription_plans`, `payment_dues` and `payments`. Identifiers below are **pseudonymized hashes of subscription/player UUIDs**, not anonymous in the strict sense. Raw IDs, parent/player names, phone numbers, transaction references, receipt numbers and monetary amounts are intentionally excluded from GitHub. Do not publish a name-to-reference mapping. Queries reflect one database snapshot and must be rerun before activation.

No evidence in the current schema identifies the original subscription period's contractual **paid-through end date**. `payment_dues.due_date` is the due date, **not** the subscription period end date; the latest Paid due cannot be treated as the paid-through boundary.

## Aggregate checks

| Measure | Verified value |
|---|---:|
| Total subscriptions / status Active | 22 / 22 |
| Missing end dates | 22 |
| Monthly / Quarterly plans | 18 / 4 |
| Total linked dues | 26 (all dues linked to a subscription) |
| Paid / Partial / Pending dues | 19 / 4 / 3 |
| Subscription records linked to another academy's plan | 4 |
| Distinct players with two simultaneously Active subscriptions | 4 players / 8 subscription rows; **plans differ** in each group |
| Active subscription assigned to an inactive player | 1 |
| Subscriptions with no linked dues | 5 |
| Due records marked Paid without a directly linked `payments` row | 10 — **investigate, not proof of unpaid fees** |
| Due records whose `due_type` conflicts with their plan's billing cycle | 0 |
| Due records whose associated player ID differs from the subscription's player ID | 0 |
| Duplicate/overlapping periods | **Cannot assess**: no recorded historical periods or end dates |
| Legacy subscriptions verified for automatic renewal | **0** |

The 26 due amounts currently match their linked plan's **current** price; this does **not** establish the originally agreed recurring rate. Payment collections may include manual postings and correction history, so ledger evidence must be interpreted carefully and never overwritten.

## Triage — mutually exclusive review tiers

- **P0 integrity: 10 subscriptions.** At least one academy mismatch (`X`), inactive player (`I`) or more than one Active subscription for the same player (`M`). Review these first. Multiple active plans might be intentional, but require explicit confirmation before deciding renewal eligibility.
- **P1 missing due evidence only: 1 subscription.** No linked dues (`N`), without those P0 integrity issues. This is missing ledger evidence, not proof no payment occurred.
- **P2 standard financial review: 11 subscriptions.** No detected P0 conflict and at least one due, but end date and original contracted price remain unknown. Not authorized for activation.
- These tiers are **not activation status**. **All 22 subscriptions remain renewal-ineligible pending Owner review**.

**Flag legend:** `X` = player/plan academies differ; `I` = linked player inactive; `M` = player has two active subscriptions; `N` = no subscription-linked due; `E` = one or more dues marked Paid lack a directly linked payment row. Flags can overlap. Pseudonymous `P-...` references identify the same player in rows with multiple active subscriptions.

## Per-subscription reconciliation matrix (all 22 records)

| Ref (pseudonymous) | Shared-player group | Start | Plan cycle | Flags | Dues (Paid / Partial / Pending) | Tier |
|---|---|---|---|---|---|---|
| `S-6f8a747b07` | `P-69352140` | 2026-06-01 | monthly | XME | 4 (3/0/1) | **P0** |
| `S-65722f80bf` | `P-a64970e3` | 2026-06-01 | monthly | ME | 2 (2/0/0) | **P0** |
| `S-e19cfc1265` | `P-a64970e3` | 2026-06-19 | quarterly | XMN | 0 (0/0/0) | **P0** |
| `S-3656888302` | `P-69352140` | 2026-06-20 | quarterly | ME | 1 (1/0/0) | **P0** |
| `S-6fe0192341` | `P-f891c976` | 2026-06-25 | quarterly | MN | 0 (0/0/0) | **P0** |
| `S-971e67acb2` | — | 2026-06-30 | monthly | XE | 1 (1/0/0) | **P0** |
| `S-89d5dfd936` | — | 2026-07-01 | monthly | I | 1 (1/0/0) | **P0** |
| `S-6676bd9271` | `P-0599615b` | 2026-07-01 | monthly | XM | 1 (1/0/0) | **P0** |
| `S-2f03a8e646` | `P-f891c976` | 2026-08-08 | monthly | MN | 0 (0/0/0) | **P0** |
| `S-3586d4d8b1` | `P-0599615b` | 2026-10-02 | quarterly | MN | 0 (0/0/0) | **P0** |
| `S-9c37a39b2c` | — | 2026-06-19 | monthly | N | 0 (0/0/0) | **P1** |
| `S-1afb4da83a` | — | 2026-06-01 | monthly | E | 3 (1/0/2) | **P2** |
| `S-b22fe0dc43` | — | 2026-06-01 | monthly | — | 1 (1/0/0) | **P2** |
| `S-86e64af858` | — | 2026-06-19 | monthly | — | 1 (1/0/0) | **P2** |
| `S-b5366021ca` | — | 2026-06-20 | monthly | E | 3 (2/1/0) | **P2** |
| `S-5702a9971c` | — | 2026-06-26 | monthly | — | 1 (0/1/0) | **P2** |
| `S-b6384a36d5` | — | 2026-07-01 | monthly | E | 1 (1/0/0) | **P2** |
| `S-eff288d61f` | — | 2026-07-01 | monthly | E | 1 (1/0/0) | **P2** |
| `S-5af2822597` | — | 2026-07-01 | monthly | — | 2 (1/1/0) | **P2** |
| `S-3a0895d4b3` | — | 2026-08-01 | monthly | — | 1 (0/1/0) | **P2** |
| `S-67e46b08d4` | — | 2026-08-11 | monthly | — | 1 (1/0/0) | **P2** |
| `S-53e8c184d0` | — | 2026-08-12 | monthly | — | 1 (1/0/0) | **P2** |

**Interpretation:** Every row is Active and currently lacks an `end_date`. Due totals are counts, not money; `P` means Paid, `Pt` Partial and `Pd` Pending. Records are grouped by triage tier and original start date. No classification means the subscription or a due should be changed automatically.

## How the Academy Owner can reconcile without disclosing personal data in GitHub

The following is a **SELECT-only private lookup**. Run using authorized access in the Supabase SQL editor, keep its player names and IDs out of committed reports, and cross-check the application records.

```sql
SELECT
    'S-' || substr(md5(ps.id::text), 1, 10) AS audit_ref,
    p.full_name AS player_name,
    pa.academy_name AS player_academy,
    sa.academy_name AS plan_academy,
    sp.plan_name,
    sp.billing_cycle,
    ps.start_date,
    ps.end_date,
    ps.status
FROM public.player_subscriptions ps
LEFT JOIN public.players p ON p.id = ps.player_id
LEFT JOIN public.subscription_plans sp ON sp.id = ps.subscription_plan_id
LEFT JOIN public.academies pa ON pa.id = p.academy_id
LEFT JOIN public.academies sa ON sa.id = sp.academy_id
ORDER BY audit_ref;
```

For each subscription, obtain **all** of the following via actual owner-approved records: (1) correct player academy and plan; (2) whether multiple active plans for the same player are legitimate; (3) player activity/returning status; (4) earliest agreed start and proven currently paid-through end date; (5) the **original contracted recurring rate**; (6) whether historic dues and payments are correct, including corrections/paid-without-linked-payment evidence; (7) prospectively approved renewal activation date. Prefer explicit “Unknown — hold” over a guessed value.

### Owner review decision template (not filled)

| Field per audit reference | Required decision |
|---|---|
| Subscription reference | `S-...` from the matrix (avoid names in repository) |
| Agreement status | Keep / correct plan association / pause / retire after review |
| Contracted monthly/quarterly recurring price | **Owner-confirmed**; evidence source, no inference from current plan amount |
| Paid-through effective end date | **Owner-confirmed**, or Unknown / Hold |
| Existing dues and receipts | Preserve; flag any correction for separate authorized financial workflow |
| First prospective renewal date | **Owner-approved**; must be after confirmed paid-through date |
| Renewal eligible? | Initially **NO** for every legacy subscription |
| Approval trace | Owner actor/date, rationale; preserve original record and payment history |

## Release and security restrictions

1. Do not mass-update `end_date`, `subscription_plan_id`, `status`, plan rates, dues or payments based on this report.
2. Do not activate scheduled automatic billing or create new dues during reconciliation. A refund/credit for historical billing requires a separately reviewed financial correction.
3. Distinguish a `payment_dues` row marked Paid from documented `payments` rows: ten Paid dues currently have none linked. This may be legacy migration/manual marking; review sources before drawing conclusions.
4. Preserve tenant RLS and the live `payment_dues.subscription_id` FK; the future lifecycle must maintain stable agreement IDs and transaction-level uniqueness.
5. Any eventual reconciliation write needs a reviewed per-row proposal, Owner authorization, a test/rollback plan and evidence of RLS/negative-tenant testing.

## Completion state

- [x] **PS-L0B read-only inventory completed** (all 22 subscriptions and 26 linked dues)
- [x] Stable pseudonymous record references and priority classification prepared
- [x] Source relationship, date/price evidence gaps and risk categories documented
- [ ] **Owner case-by-case sign-off**, especially ten P0 integrity rows
- [ ] Contract price, paid-through date and prospective renewal eligibility confirmed
- [ ] PS-L1 pure date calculator tests
- [ ] Any schema migration, UI lifecycle mutation, scheduler or automatic billing

**Next technical task:** PS-L1 pure date-only calendar, extension and pause/resume calculator with deterministic tests; this does not modify subscriptions or the database. **Next business task:** Owner-led PS-L0B reconciliation decisions before any renewal activation.
