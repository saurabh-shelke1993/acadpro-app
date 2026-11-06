# Kheltriva — PS-L2.2 Detailed Subscription Schema, RLS and Finance Transaction Contract

**Review date:** 6 November 2026 (Asia/Kolkata)
**Baseline:** `payment-module-finalization` at `c310f8a6ac7fca1e38d0cbd228bae32c3c530ebf`
**Live project inspected:** `ulyealhkmlorsbdiknrh` — read-only
**Status:** **PROPOSED / NOT APPROVED / NOT IMPLEMENTED.** No SQL migration file, DDL, RLS, GRANT, RPC, Cron, source-code change or financial-data mutation occurred. PS-L2.3, after Owner approval, is a separate **unapplied** migration/testing task.

## 1. Verified baseline and required behavior

- `player_subscriptions` is currently an agreement (id, player_id, subscription_plan_id, start_date, nullable end_date, status) with **no academy_id, contracted price or period history**. The Owner page's duplicate-active guard and direct editing of old start dates are not a renewal facility.
- `subscription_plans` is a mutable catalog with numeric `amount`; current UI offers monthly/quarterly/half_yearly, not yearly. Existing `PaymentDues.js` inserts a due using **current plan.amount** and a client-side same-subscription/due-date lookup; neither gives a locked recurring price or race-proof billing.
- `payment_dues` already references `player_subscriptions.id`. `payments`/receipts, `payment_corrections` and `parent_payment_submissions` must retain their historical links. Existing `public.collect_payment` locks a due `FOR UPDATE`; existing due trigger validates money and computes pending/partial/paid status.
- Financial ancestry has dangerous **ON DELETE CASCADE** along subscription → dues and dues → payments, plus cascades through players. The correction and UPI tables use RESTRICT references. Do not delete financial ancestry.
- RLS exists on subscriptions, dues, plans and payments. Existing Coach subscription SELECT is **not** granted in RLS although ROLE_MATRIX.md describes read-only assigned scope. Do not grant Coaches financial access to show a Paused roster badge.
- ANON/AUTHENTICATED table grants for subscription/plan/due/payment tables include **TRUNCATE**, which RLS cannot row-filter. This is a least-privilege remediation issue, not proof of a usable TRUNCATE endpoint in the current application.
- Current aggregate snapshot: **22 Active agreements, 22 NULL end dates, 26 dues, 4 players with two Active different-plan agreements, 3 cross-academy plan/player mismatches**. Historical PS-L0B reported 4 mismatches. Treat PS-L0B as a historical snapshot; re-run before any activation. No legacy row is approved for renewal.
- PostgreSQL 17.6, DB timezone UTC; `pg_cron` and `btree_gist` are absent. Date-only validity must observe initial India academy-local **Asia/Kolkata** policy; do not derive anniversaries by adding UTC timestamps.

Approved Owner rules: 1/3/6/12 calendar months; original recurring price locked until explicit future-only Owner repricing; free extensions; pause/resume preserving **verified** unused paid days; future renewal creates exactly one new pending tuition due without requiring prior period payment; both academy-configurable fixed-calendar and anniversary monthly billing; partial first fixed-calendar period may be prorated; no back-billing.

**Open decisions:** simultaneous separate tuition products; academy default calendar-day versus scheduled-session prorating; holiday/cancellation handling; no-eligible-session policy; approval of each legacy agreement.

## 2. Proposed schema (field-level, no DDL)

### 2A — `academy_subscription_billing_policies` (NEW public table, versioned and append-only)

| Column | Type / constraints | Purpose |
|---|---|---|
| id | uuid PK default gen_random_uuid() | Immutable policy version |
| academy_id | uuid NOT NULL FK academies(id) ON DELETE RESTRICT | Tenant |
| version | integer NOT NULL CHECK > 0 | UNIQUE (academy_id,version) |
| effective_from | date NOT NULL | UNIQUE (academy_id,effective_from); new enrollments only |
| monthly_alignment | text NOT NULL CHECK fixed_calendar_month / anniversary_month | Both Owner-approved models |
| first_period_method | text NULL CHECK calendar_days / scheduled_sessions | **No default until approved**, never silently choose |
| timezone_name | text NOT NULL, initially 'Asia/Kolkata' | Local civil-day semantics |
| created_by, created_at, reason | uuid FK users RESTRICT, timestamptz, text NOT NULL | Actor and reason |

New agreements snapshot the selected policy ID and alignment. Academy setting changes are prospective; existing agreements retain original contract unless individually amended. The policy history is append-only.

### 2B — Add nullable/guarded attributes to existing `player_subscriptions`

| Proposed field | Type / initial rule |
|---|---|
| academy_id | uuid NULL FK academies RESTRICT; verified against player and plan |
| contracted_rate_paise | bigint NULL CHECK >= 0; **must never backfill from today's plan.amount without Owner evidence** |
| currency_code | char(3) NULL CHECK = 'INR' |
| contracted_cycle | text NULL CHECK monthly/quarterly/half_yearly/yearly |
| monthly_alignment | text NULL CHECK fixed_calendar_month/anniversary_month, for monthly contracts only |
| proration_method | text NULL CHECK calendar_days/scheduled_sessions, for approved initial partial periods |
| billing_policy_id | uuid NULL FK billing policy version RESTRICT |
| original_anniversary_day | smallint NULL CHECK 1..31 |
| renewal_eligibility | text NOT NULL default 'legacy_hold', CHECK legacy_hold/eligible/blocked |
| verified_paid_through | date NULL; never infer from due_date |
| first_prospective_renewal | date NULL, requires Owner approval and documented paid-through |
| agreement_version | bigint NOT NULL default 1 CHECK > 0 |
| activated_by, activated_at | uuid NULL FK users RESTRICT, timestamptz NULL |

Retain existing agreement UUID, `status`, `start_date` and nullable `end_date`. Existing end_date is *not* authoritative historic period evidence. All 22 legacy rows default to HOLD and remain ineligible even if status='active'. A later safe application cutover must prevent direct client edits of activated agreement rate/plan/start/status, using guarded RPCs and audits; do **not** break the current form during additive schema rollout.

Future integrity: UNIQUE (id,academy_id,player_id) supports tenant-safe period composite FK; server must also verify subscription_plan.academy_id and player.academy_id. Do not enforce global NOT NULL or cross-table integrity on unreconciled mismatched legacy rows.

### 2C — `subscription_periods` (NEW public table; authoritative dated ledger)

| Column | Type / check | Meaning |
|---|---|---|
| id | uuid PK default gen_random_uuid() | Durable period |
| agreement_id | uuid NOT NULL FK player_subscriptions RESTRICT | Preserve existing agreement |
| academy_id, player_id | uuid NOT NULL | Must equal authorized agreement and player |
| period_sequence | integer NOT NULL CHECK > 0; UNIQUE (agreement_id,period_sequence) | Consecutive installments |
| period_origin | text CHECK initial / renewal / prospective_opening | No invented historical opening |
| period_start, original_end, effective_end | date NOT NULL; CHECK period_start <= original_end <= effective_end | Inclusive date-only entitlement |
| cycle_snapshot | text NOT NULL CHECK monthly/quarterly/half_yearly/yearly | Contract at issuance |
| monthly_alignment_snapshot | text NULL CHECK fixed_calendar_month/anniversary_month | Monthly policy |
| anniversary_anchor_day | smallint NULL CHECK 1..31 | Month-end preservation/rebase |
| contracted_rate_paise | bigint NOT NULL CHECK >= 0 | Frozen full recurring price for this period |
| billed_tuition_paise | bigint NOT NULL CHECK >= 0 | Prorated initial or full recurring charge |
| currency_code | char(3) NOT NULL CHECK = 'INR' | Money |
| proration_method | text NULL CHECK calendar_days/scheduled_sessions | First partial fixed period only |
| eligible_units, total_units | integer NULL; if proration then 0 <= eligible <= total and total > 0 | Fee basis |
| full_billing_start, full_billing_end | date NULL | Denominator period bounds for initial fixed month |
| pricing_basis | jsonb NOT NULL default '{}' | Frozen enrollment/session occurrences, exclusions, rounding, approval |
| created_by, created_at | uuid NULL FK users RESTRICT, timestamptz NOT NULL | Owner/system audit |
| revised_at, period_version | timestamptz NULL, bigint NOT NULL default 1 | Audited extension/resume concurrency |

Additional UNIQUE (agreement_id,period_start). After validated agreement academy scope, add tenant/player composite FK; matching due↔period/player identities must also be enforced. Rate/billed money and original end are immutable after issuance; only effective_end and version can change in an approved, audited operation. Do not store "paid" on period; dues/payments own that accounting state.

**No overlap:** recommend exclusion constraint on (agreement_id WITH =, daterange(period_start,effective_end,'[]') WITH &&) after reviewed `btree_gist` installation; it is currently absent. Until approved, enforce strictly inside a serialized agreement-row-locking RPC and block direct period writes. UNIQUE sequence alone does not prove no interval overlap.

### 2D — `subscription_lifecycle_events` (NEW public table, append-only)

| Column | Type / check | Meaning |
|---|---|---|
| id | uuid PK | Event |
| academy_id, agreement_id | uuid NOT NULL with checked tenant relationship | Parent scope |
| period_id | uuid NULL FK subscription_periods RESTRICT | Affected period |
| event_type | text CHECK activate/initial/renew/extend/pause/resume/reprice/correct/block | Operation |
| idempotency_key | uuid NOT NULL; UNIQUE (academy_id,idempotency_key) | Retry/concurrency protection |
| actor_user_id | uuid NULL FK users RESTRICT | NULL only for separately authorized system job |
| actor_kind | text CHECK academy_owner/super_admin/system | Audit role |
| occurred_at, effective_on | timestamptz NOT NULL; date NULL | Time and date |
| reason | text NOT NULL | Approval/billing justification |
| before_snapshot, after_snapshot | jsonb NOT NULL | Unmodified evidence of prior/new dates and price |
| verified_frozen_paid_days | integer NULL CHECK >= 0 | Pause and one-time resume entitlement |
| authorization_evidence | jsonb NOT NULL default '{}' | Owner-approved legacy evidence, approval source |

Events may only be INSERTed through trusted operations and may never be UPDATEd or DELETEd. Parent/Coach are not granted raw event visibility (reasons and price evidence may be sensitive). A future separate, sanitized child-status read model may surface Paused.

### 2E — Link **future** `payment_dues` to periods (additive)

Propose **nullable `subscription_period_id uuid`** FK → subscription_periods(id) ON DELETE RESTRICT and UNIQUE(subscription_period_id). Multiple preexisting NULL values remain valid; all 26 legacy dues keep NULL and existing subscription_id. Require subscription_id and player_id non-null whenever period_id is non-null; match both to that period with a composite FK or validated trigger. No duplicate recurring tuition due per period, regardless of due_date or retried request.

The new period writer inserts existing `payment_dues` with exact `total_amount = billed_tuition_paise / 100` as NUMERIC, `paid_amount=0`; the existing financial-state trigger computes pending/remaining. The due date is the billing deadline, **not** the entitlement end. Registration fees/other one-time dues are separate. When no training sessions remain, a flagged ₹0 quote must not silently become a pending due before the Owner policy is approved.

**Critical collision guard:** after cutover, the manual Payment Dues form must not generate a second subscription tuition due for an activated agreement *outside* the period writer. Retain unaffected legacy/one-time workflows until explicitly migrated.

## 3. Proposed role-based RLS + grants (not applied)

| Object | Super Admin | Academy Owner | Coach | Parent | Anonymous |
|---|---|---|---|---|---|
| Billing policies | SELECT all; guarded approve/change | SELECT own; guarded policy change | None | None | None |
| Agreement | Existing platform-scope read; guarded mutations | Own academy; guarded mutations | **No direct priced rows** (Role Matrix discrepancy tracked) | Linked child read-only where permitted | None |
| Periods | SELECT all | SELECT own academy | No financial table SELECT | Linked-child SELECT | None |
| Lifecycle events | SELECT all | SELECT own academy | None | None; optional sanitized summary later | None |
| Dues/payments | Existing SA finance role/RPC | Existing own-academy finance/RPC | None | Linked-child read-only | None |
| Paused roster indicator | Scope as authorized | Own roster | Assigned player/batch **status only** | Linked child if approved | None |

Suggested period read policy (illustration, **NOT executable migration**):

```sql
-- Proposed RLS expression after server-side tenant FK validation:
TO authenticated
USING (
  private.can_manage_academy(academy_id)
  OR (
    private.current_user_role() = 'parent'
    AND private.is_parent_of_player(player_id)
  )
);
-- Events: SELECT only when private.can_manage_academy(academy_id)
-- No direct INSERT/UPDATE/DELETE policies on ledger/events.
```

Grant minimal SELECT for approved readers and enable RLS on all new exposed public tables before exposure. No direct mutating grants to ANON or AUTHENTICATED on new ledger/event tables. Mutations go through separately audited RPCs with trusted identity and tenant scope. RLS alone cannot protect immutable **columns** if broad UPDATE is granted: use column-level controls/triggers and restricted write paths in future migration.

**SECURITY DEFINER gate:** New public RPCs require REVOKE EXECUTE FROM PUBLIC/anon, GRANT to authenticated only when a true Owner/SA check exists inside the function. Use fixed empty search_path and fully qualified object names. Do not accept caller-supplied tenant/role/rate/payment amounts as truth. Service-role/API secrets never enter React. Scheduled actors require separate authenticated worker permissions, not a general browser "system=true" override.

**Current excess privileges:** ANON/AUTHENTICATED grants on subscription, plan, dues and payment tables include TRUNCATE, which RLS does not filter. Design separate phased privilege hardening (REVOKE TRUNCATE/TRIGGER/REFERENCES and unnecessary direct DML only after isolated dependent-flow tests). This is an authorization risk review, **not** a claim users can execute it through the current Data API.

**Coach Role Matrix:** currently states assigned-scope read-only player subscriptions, while the live subscription RLS has no Coach SELECT. Recommendation is a narrow roster Paused indicator, not direct agreement/period/price access. Do not silently edit the Role Matrix without Owner approval.

## 4. Atomic financial operations and idempotency (not yet coded)

**Proposed RPC entrypoints** (names/signatures subject to PS-L2.3 review):
- `create_subscription_agreement(player_id,plan_id,join_date,alignment,method,request_id)`
- `renew_subscription_period(agreement_id,expected_predecessor_period_id,request_id)`
- `extend_subscription_period(period_id,extra_calendar_days,reason,request_id)`
- `pause_subscription_agreement(agreement_id,pause_date,reason,request_id)`
- `resume_subscription_agreement(agreement_id,resume_date,reason,request_id)`
- `approve_subscription_reprice(agreement_id,new_rate_paise,effective_sequence,reason,request_id)`

Client is allowed to request a **scenario**, not provide trusted academy_id, price, paid-through, entitlement counts, due amount or actor. Server revalidates schedule/holiday/contract snapshots and recomputes exact paise. PS-L1 and PS-L1P1 JS utility tests must be cross-checked against DB-calculator fixtures; a browser quote is not proof of an approved bill.

**Renewal transaction (single PostgreSQL RPC; no REST multi-insert):**

```text
BEGIN (implicit transaction of one database RPC)
  1) Resolve auth.uid() and trusted role/academy from DB.
     Reject Parent, Coach and cross-academy manipulation.
  2) SELECT agreement FOR UPDATE.
     Require active, not paused, renewal_eligibility = eligible,
     confirmed contracted rate, academy-player-plan consistency.
     Legacy HOLD is never eligible.
  3) Check idempotency request and expected predecessor. If identical
     successful request already exists, return the SAME period/due IDs.
     Conflicting same-key payload fails closed.
  4) Read latest effective_end; compute next start = effective_end + 1 day,
     approved anniversary/fixed alignment, full contracted rate.
     Reject backdated auto-renewals, overlap and an existing successor.
  5) INSERT one new subscription_periods with unique sequence and price.
     INSERT one payment_dues using exactly this period ID and amount.
     Existing trigger computes financial state; no payment/receipt update.
  6) INSERT append-only lifecycle event with actor, reason, before/after
     snapshots and request idempotency key.
  7) COMMIT all three; if any INSERT/constraint/audit step fails,
     ROLLBACK ALL (no period without its due).
END
```

**Concurrency:** serialize on the agreement with `FOR UPDATE`; UNIQUE(agreement_id,sequence), UNIQUE(payment_dues.subscription_period_id), UNIQUE(academy_id,idempotency_key) independently protect against race/retry. A conflicting retry returns a typed error; a truly identical retry returns existing result. A scheduled worker must also use these keys. Current manual Due UI lacks such guarantees; guard/route it before activation.

**New agreement:** ensure allowed product/academy/player and no equivalent Active tuition agreement (after product rule decided), lock a deterministic player/service scope, freeze the agreed recurring rate, create the initial period, due and event in one transaction. Initial fixed-calendar proration uses **actual** approved numerator/denominator and session snapshots; anniversary monthly enrollment pays full rolling-month rate.

**Extension:** Owner-approved free calendar days shifts effective_end/renewal but does not bill; reject if successor is already created unless a separate correction is approved. Append event, update controlled effective_end/version only.

**Pause:** stop new renewal/dues immediately. Only freeze paid days with evidence covering the currently effective end; otherwise pause may stop billing but cannot grant an unverified free paid entitlement. Keep player on roster, preserve old pending/partial/paid dues.

**Resume:** restore saved days once, shift future renewal and anniversary anchor, append event. No double-use of frozen days or retroactive due edits.

**Reprice:** Owner-only future-effective price update with old/new rate audit; old periods, dues, payments and receipts remain immutable. Do not use mutable plan.amount to silently reprice subscribers.

**Scheduler:** disabled by default. Live pg_cron extension is absent. Configure only after isolation/locking/retry/dry-run, scoped job credentials, audit logs and monitored Owner-approved legacy cohort. Renewal does not automatically collect money.

## 5. Constraint sketches (illustrative, DO NOT RUN)

```sql
-- Not a migration, intentionally incomplete:
UNIQUE (agreement_id,period_sequence);    -- one period ordinal
UNIQUE (agreement_id,period_start);       -- distinct starts
UNIQUE (academy_id,idempotency_key);      -- one lifecycle action key
UNIQUE (subscription_period_id);          -- NULL allowed for legacy dues
CHECK (period_start <= original_end AND original_end <= effective_end);
CHECK (contracted_rate_paise >= 0 AND billed_tuition_paise >= 0);
CHECK (proration_method IS NULL
   OR (total_units > 0 AND eligible_units BETWEEN 0 AND total_units));
-- Optional after btree_gist approval and safety test:
EXCLUDE USING gist
 (agreement_id WITH =, daterange(period_start,effective_end,'[]') WITH &&);
```

Use tenant/player composite FK validations only after clean agreement academy data; do not use blanket NOT NULL, UNIQUE(player_id) or EXCLUDE on dirty historical rows without proving an isolated migration path. Postgres permits staged NOT VALID CHECK/FK but not a NOT VALID UNIQUE constraint.

## 6. Migration / regression / rollback sequence

| Step | Deliverable | Strict gate |
|---|---|---|
| M0 — snapshot | Re-audit 22 agreements and financial ancestry; owner confirms locked rate, paid-through, matching academy and prospective activation | No inferred legacy periods or rate from latest plan |
| M1 — expand only | New empty versioned policy/period/event tables, initial RLS/grants and nullable agreement/period_due columns; legacy_hold default | Existing UI/financial RPCs/Parent UPI unaffected |
| M2 — hardening | Tenant composite FKs, unique/overlap constraints, non-destructive FK DELETE safeguards, targeted grant revocation | Isolated schema/role/financial tests and Owner security sign-off |
| M3 — guarded billing | Trusted Create/Renew/Extend/Pause/Resume and charge RPC, UI cutover; old manual tuition path blocked for activated agreements | Race/retry/failed-due atomic rollback and paid/partial/UPI/receipt tests |
| M4 — controlled release | Case-by-case Owner activation, prospective-only first renewal and monitored worker | Negative tenant/RLS, QA, Vercel and production approval |

**Rollback:** Before any new due/period, feature-flag off and retain empty additive tables or drop only if proven empty/unreferenced. **After any period or due is issued**, no destructive rollback: disable writers/worker and perform forward recovery or approved financial corrections, retaining period/due/payment/receipt linkages. A test rollback and staged restore rehearsal must precede live DDL.

**Required isolated test matrix:** SA and Owners A/B, Coach/Parent/anonymous and forged UUIDs; conflicting concurrent requests; same request repeated; interrupted due insertion / event write; current player-plan mismatch and legitimate multiple products; Jan 29–31/leap/1–3–6–12-month dates; 7/13 session and 17/31 calendar proration; enrollment + holiday exclusions; zero sessions; exact paisa rounding; overdue/partial/paid/correction/UPI/receipts; end-date extension with successor; pause after paid and unpaid periods; ledger overlapping; existing direct-Due action blocked at activated cutover; no TRUNCATE privilege for anon/auth after reviewed grant remediation; full frontend and mobile/browser QA.

## 7. Decisions requiring Owner sign-off before PS-L2.3

1. Can a player legitimately hold **multiple concurrent tuition products**, or exactly one primary tuition agreement? Four players currently have two Active different-plan rows; **do not** add `UNIQUE(player_id) WHERE active` yet.
2. Which fixed-month first-period method should be academy default? How will academy holidays/cancelled occurrences be recorded and approved?
3. Should agreements retain their original alignment when the academy changes default? **Recommend yes**, future-only explicit amendments.
4. When no sessions remain, defer first tuition due to next cycle instead of generating ₹0? **Recommend defer/manual exception**.
5. How will Owner attest each legacy contracted price, paid-through and first prospective date? Until attested, HOLD.
6. Confirm Coach roster-only Paused visibility without direct financial subscription SELECT; reconcile the Role Matrix through explicit approval.
7. Authorize financial cascade and least-privilege remediation as separately reviewed DB changes, not silently combined with billing.

## 8. Formal phase status

**PS-L2.2:** Design written / source-reviewed only, **no schema migration and no code/financial data mutation**. Database table definitions, constraints and RLS are proposed, **not executed or automatically tested**. PS-L2.3 is restricted to an Owner-approved, unapplied migration candidate + isolated tests; live DDL requires later explicit authorization. Existing PS-L1P2 Owner UI acceptance and PS-L0B Owner reconciliation remain pending.

Supabase references: RLS https://supabase.com/docs/guides/database/postgres/row-level-security ; API security https://supabase.com/docs/guides/api/securing-your-api ; local DB tests https://supabase.com/docs/guides/local-development/testing/overview .
