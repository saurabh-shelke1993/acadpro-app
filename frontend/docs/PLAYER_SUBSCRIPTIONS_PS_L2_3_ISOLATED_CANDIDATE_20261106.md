# Kheltriva — PS-L2.3 Unapplied Tuition Schema Candidate and Isolated SQL Validation

**Date:** 6 November 2026 (Asia/Kolkata)
**Branch:** `payment-module-finalization`
**Validated source HEAD:** `5afae2a9e7b292da472525701edfdcef8d92431c`
**CI:** [PS-L2.3 disposable PostgreSQL validation — PASS](https://github.com/saurabh-shelke1993/acadpro-app/actions/runs/42195789707)
**State:** **Candidate written and tested on disposable PostgreSQL 17. NOT APPLIED to live Supabase.** No subscription renewal/financial lifecycle feature or camp module is operational.

## 1. Owner-approved camp pricing (separate future product module)

For **each individual special camp**, the Academy Owner can select exactly one of three pricing modes:

| Camp mode | Intended fee rule |
|---|---|
| `free` | No participation fee charged |
| `included_in_tuition` | No incremental camp charge for eligible players with qualifying regular tuition; eligibility/offer rules to be designed |
| `separately_chargeable` | One-time camp-specific charge at an Owner-configured amount, independent of the recurring tuition rate and renewal schedule |

A Diwali camp, clinic or special workshop is **not a second recurring tuition subscription**. Camp session dates do not alter tuition period entitlement, recurring plan pricing, or default tuition proration denominators. Camp programme, registration, capacity, pricing, separate one-off due integration, Parent/Coach RBAC and eligibility are **planned separately**, not added in PS-L2.3. There is currently no camp module in the repo. This business decision is approved, but **no camp settings form or database table is implemented**.

## 2. Changed source files and activation safety

| Repository file | Purpose |
|---|---|
| `supabase/proposals/subscriptions/ps_l2_3_foundation.sql` | **Unapplied schema proposal**, deliberately **outside** `supabase/migrations/` |
| `supabase/tests/subscriptions/ps_l2_3_bootstrap.sql` | Disposable PostgreSQL synthetic legacy schema and **test-only** permission helpers |
| `supabase/tests/subscriptions/ps_l2_3_foundation.test.sql` | SQL assertions: legacy HOLD, overlap rejection, period/due/event keys, tenant identity and RLS |
| `.github/workflows/subscriptions-ps-l2-3-isolated.yml` | GitHub Actions **PostgreSQL 17 service container**, applies proposal only to ephemeral DB and runs assertions |

**Never execute these SQL files in the live Supabase SQL Editor.** The proposed file is **not a production migration** and is intentionally absent from the CLI-discovered migration folder. To prepare an eventual actual migration, re-review against latest remote schema, generate a correctly named migration via `supabase migration new`, build a staging copy, test actual Supabase RLS/RPC behavior, and obtain separate Owner authorization before any live apply.

## 3. Candidate structures — implemented as SQL proposal only

- `academy_subscription_billing_policies`: versioned, Owner-sourced alignment, session-based proration **default** and calendar-day alternative, India-local billing timezone. **No policy rows seeded**.
- Existing `player_subscriptions`: additive **nullable** academy/rate/cycle/alignment/paid-through/policy columns with `renewal_eligibility='legacy_hold'` default. Defensive trigger blocks modifying or inserting active pricing/eligibility fields until a future audited activation RPC is explicitly implemented. **Existing create/edit/deactivate on old columns remains in place**.
- `subscription_periods`: agreement and tenant/player IDs; unique period sequence/start; original/effective entitlement dates; full contracted recurring rate and actually billed amount as integer paise; approved first-period unit counts and immutable pricing evidence. **Cross-agreement** GiST exclusion on `(academy_id, player_id, daterange(period_start,effective_end))` prevents one child's monthly and quarterly regular tuition entitlements from overlapping, including across different agreements. Adjacent dates and a different academy/player are valid. Requires `btree_gist` extension, presently absent from live project.
- `subscription_lifecycle_events`: append-only type, idempotency UUID, actor, justification and before/after evidence; composite FKs enforce **same academy and same agreement** for referenced periods. UPDATE/DELETE blocked.
- `payment_dues.subscription_period_id`: **nullable** new FK for future dues only, with one-due-per-period UNIQUE and composite FK matching the due's player/contract to the period. Historical dues remain unlinked and preserved.
- New `public` tables enable RLS; `authenticated` receives SELECT only with academy-owner/Super Admin or linked-child scope on periods; lifecycle events and policy versions remain manager-readable. No direct INSERT/UPDATE/DELETE grants or policies for client roles. No Coach financial access. Does **not** modify existing financial-table grants/RLS/DELETE foreign keys in this phase.
- **No** create/renew/pause/resume/extend/reprice RPC, automatic due generator, Cron extension/job, camp programme table or data backfill created.

## 4. Test evidence and limits

[GitHub Actions run 42195789707](https://github.com/saurabh-shelke1993/acadpro-app/actions/runs/42195789707) on exact source `5afae2a` **PASSED** using a disposable PostgreSQL 17 service, with no live Supabase credentials. The candidate was installed in the disposable DB and SQL assertions passed for:

- Old Active agreements default to renewal HOLD; old end dates remain NULL; old paid due and payment remain linked.
- Current React-style direct subscription updates cannot alter new contracted rate or activate renewal; legacy-HOLD period creation is denied.
- A monthly November period blocks a **different agreement's** overlapping quarterly November period for the same player/academy; a subsequent December plan transition is accepted; other academy/players are unaffected.
- Reject wrong player/academy period, alteration of issued period amount, duplicate period-linked dues, wrong-player due FKs, modified lifecycle events, reused idempotency keys, and cross-academy/contract event references.
- New-table permissions deny direct anonymous SELECT and authenticated INSERT/UPDATE/DELETE; RLS allows Owner own academy, Parent linked-child periods only, and denies Coach financial records/events.

**Limitations:** This is **synthetic Postgres isolation**, not a replica of the actual Supabase Auth roles, existing financial-state triggers, full production migration history or real payment RPCs. It does not establish real multi-session concurrency success, transaction-level renewal/due rollback, scheduled billing, proration's authorized holiday source, or production RLS acceptance. Those require PS-L3/PS-L4 and a staging Supabase environment with stricter test fixtures. No frontend Jest/build was run for this schema-only change.

### Live Supabase non-mutation verification

After source commits, a fresh **read-only** live query returned **22 existing subscriptions, 26 payment dues, 42 payment rows**, **zero** new `subscription_periods`, `subscription_lifecycle_events` or `academy_subscription_billing_policies` tables, and **no** `payment_dues.subscription_period_id` column. These are current counts, not evidence that any concurrent unrelated user activity was absent.

## 5. Required gates before production

1. **Schema/RLS audit:** Owner reviews candidate after latest real schema drift check. `btree_gist` extension impact, existing RLS/grants, calendar handling, record locks, composite FKs and migration history must be validated against a real isolated Supabase clone.
2. **Legacy reconciliation:** Case-by-case Owner approval for all **22** existing agreements' academy, plan, locked price, verified paid-through and first prospective period; old four-dual-Active and three current academy-mismatch findings remain unresolved. No bulk activation, historic backfill or retroactive dues.
3. **Financial ancestry hardening:** Current subscription→due→payment cascade deletion and broad financial TRUNCATE grants require independent, authorized, regression-tested remediation *before the eventual live billing cutover*. This candidate does **not** fix them.
4. **Runtime writers:** Implement audited, truly atomic and idempotent Create/Renew/Extension/Pause/Resume/Price-change functions in separately approved phases; cover concurrent cross-agreement attempts and failed due insert rollback. Lock recurring price and trust only database-authorized session/holiday records.
5. **Manual due collision:** Prevent current manual Payment Dues UI from creating duplicate tuition dues outside period ledger for future activated agreements. Preserve existing collection/receipt/adjustment/UPI paths and verify exact cents/paise.
6. **Camp module:** Implement future camp pricing per camp (free/included/separately chargeable), programme enrolment and separate optional one-time collection workflow, with independent product/UX approval; do not mix with recurring tuition entitlement.
7. **Release:** Full frontend tests, React build, SA/Owner A-B/Coach/Parent negative RLS, financial and mobile browser regression, production advisor review, manual Owner acceptance, followed by separately approved **live** schema changes.

## 6. Phase classification

| Workstream | Classification |
|---|---|
| Camp three-way pricing rule | **Owner-approved business policy**, not implemented in UI/DB |
| PS-L2.3 SQL foundation | **Source candidate authored**, unapplied |
| PS-L2.3 disposable PostgreSQL tests | **Passed at 5afae2a** |
| Actual Supabase migration and future writer RPCs | **Not applied / not implemented** |
| PS-L0B per-row activation | **Pending Owner approvals** |
| PS-L1P2 browser acceptance | **Pending** |
| Historical payments/dues/reconciliation repair | **No changes** |

**Next safe task:** PS-L2.3 staging-readiness review / isolated Supabase environment parity and secure lifecycle RPC design; **not** a live migration or actual financial charging.
