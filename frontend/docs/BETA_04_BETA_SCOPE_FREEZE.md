# BETA-04 — Approved First-Pilot Beta Feature Scope Freeze

**Product:** Kheltriva football academy SaaS  
**Decision:** **APPROVED — SCOPE FREEZE** by Product Owner, 21 November 2026 (IST)  
**Development baseline:** `payment-module-finalization` @ `62e54bef15aafffe0810b9c64e8ce1ed81d5b250`  
**Integration branch:** `beta-launch-integration`  
**Production:** NO-GO. No beta release date has been approved.  
**Scope inclusion is NOT evidence of implementation, successful tests, deployment, or production authorization.**

## 1. Product Owner decision

The Product Owner approved the previously proposed initial beta scope, with one explicit addition:

> Academy Owner can manually renew **eligible monthly player subscriptions by batch** for the upcoming calendar month; a successful renewal creates **exactly one Pending payment due per renewed player/period**, without collecting any money automatically. Preserve history and enforce transactional integrity, idempotency, pricing accuracy and multi-tenant RBAC.

This is the **only additional beta product feature** requested at scope freeze. Do not expand into an automatic billing/renewal engine or modify existing behavior outside approved milestones.

## 2. Frozen first-pilot inclusions

| Pilot capability | Milestone for completion/verification | Boundary |
| --- | --- | --- |
| Super Admin, Academy Owner, Coach and Parent authentication and existing RBAC | BETA-12/15/17 | Preserve actual database RLS and tenant boundaries; UI hiding is not authorization. |
| Academy, center and batch management | BETA-11/12/17 | Preserve current workflows, assignments and links. |
| Players, parent linkage and coach assignments | BETA-09/10/12/17 | Preserve correct academy/center/batch/linked-player visibility. |
| Scheduled training, Coach dashboard, marking and attendance history | BETA-09/11/12/17 | Keep accepted date/session, edit-window and soft-delete semantics. |
| Player subscriptions and plans | **BETA-07** | Verify existing assignment, edit, deactivation and lifecycle behavior. |
| **Manual monthly Batch Subscription Renewal + one Pending due per player and next period** | **BETA-07** (feature), BETA-08 (due/collection compatibility), BETA-12 (security), BETA-17 (release acceptance) | Requires a separately reviewed transactional database implementation and safeguards in Section 3. **Not implemented/deployed at scope freeze.** |
| Payment dues, manual collections and receipt history | BETA-08/12/17 | Reuse existing ledgers and manual collections; no implicit settlement on renewal. HIGH-002 must be resolved before release. |
| Existing manual UPI QR payment display/owner verification where approved | BETA-08/10/12/17 | No payment gateway or auto-verification. |
| Academy Owner dashboard with approved Pitchside Emerald design | BETA-06/11/17 | Follow BETA-03 contract and four mandatory corrections; do not change data semantics merely for visuals. |
| Parent Portal and Player/Coach profiles | BETA-09/10/11/17 | Keep established scopes and user journeys. |
| Enquiries, scoped operations and other already functioning pilot-critical workspaces | BETA-11/12/17 | Verification/hardening, not feature expansion. |
| Responsive UX, loading/error states, critical functional and security remediation | BETA-11/12/15/17 | Real role/tenant test and accessibility gates. |
| Production blueprint, dedicated environment, Vercel and first pilot academy onboarding | BETA-13 through BETA-19 | Separate authorizations, reproducible database deployment and release decision. |

All inclusions are **scope goals** until their milestone tests and Product Owner acceptance pass.

## 3. Manual batch renewal — frozen business contract

**Owner experience (proposed UI):** Within Player Subscriptions, Academy Owner selects their center and batch, chooses the **upcoming calendar month**, and clicks **Renew batch**. Before committing, show the target dates, eligible player count, blocked/skipped players with explicit reasons, effective agreed monthly amounts, and total prospective Pending dues. Require an explicit confirmation. Show an auditable per-player result afterward. Prevent a second click from double billing.

**Eligibility:** Only active players genuinely assigned to the selected batch in the signed-in Owner's academy; only active, eligible **monthly** agreements with a single consistent ownership/plan/period relationship; only a verified paid-through/end-date and approved/locked recurring price. If any of these are missing, overlapping, legacy-ambiguous, paused/inactive, mismatched or already renewed/billed for the target period, **skip/hold the individual player with a reason**. Do not silently create another Active agreement, infer an original agreement price from today's plan catalog amount, backfill unknown end dates, auto-reactivate inactive subscriptions or alter historical dues. Duplicate player assignment or multiple batches must not create duplicate tuition periods/dues.

**Persistence:** Renew under the **existing** subscription agreement ID, preserving historical coverage, agreed price, previous dues/payments and receipts. Establish the next calendar-month period according to the separately reviewed subscription lifecycle policy and preserve date-only semantics. Successful renewal creates **exactly one new Pending payment due** (not Paid/Partial) for that player/agreement/period with an authoritative amount and due date. No automatic payment, receipt, bank collection, UPI claim approval, gateway call, reminder or scheduled background job.

**Authoritative transaction/security:** Browser checks and preview counts are advisory only. Backend must independently derive eligible cohort, academy/center/batch membership, prior periods/dues, price and trusted role. Use a reviewed database transaction/RPC or equivalent safe server-side operation with properly scoped authenticated Academy Owner authorization, tenant/row isolation, race-safe locking/idempotency and unique constraints. Create the period and due **atomically for each successful player**; a partial failure must not leave an extended agreement without its intended due, or an orphan due without the renewal record. Record audit provenance. Retry/concurrent repeat must result in one period and one due, not duplicate records; clearly report successes, skipped and failed rows. Batch-wide all-or-nothing versus per-player continuation requires explicit implementation review before rollout.

**Security and financial blockers:** `player_subscriptions` currently has no deployed subscription-period ledger or renewal RPC in the active test Supabase project; PS-L2.3 has unresolved legacy reconciliation/security/migration prerequisites. HIGH-002 payment RPC authorization remains a beta release blocker. Do not apply schema changes, generate dues for existing legacy records, run Supabase migrations, or turn on automated billing without separate reviewed authorization. Real JWT tests across all four roles and two distinct Academy Owner tenants, cross-academy/mismatched assignments, duplicate execution/concurrency, month-end/leap-year, pricing invariants, cancellation/rollback and dues/receipt compatibility must pass before BETA-07 feature acceptance.

**Acceptance tests required for BETA-07/08/12/17:**
- Owner can preview monthly renewals for own batch, confirm the upcoming month and see exact included/held counts and amounts.
- Same player/period cannot be billed twice, including retry, double-click, concurrent calls and a player appearing in more than one batch.
- Renewal period and Pending due are created together; deliberately failed transaction leaves neither half-applied.
- Preserve agreement ID, original recurring price, historic dues/payments and receipts; no silent plan repricing.
- Block one-time, quarterly/half-yearly/yearly, inactive, paused, legacy unknown-end, duplicate/overlap and cross-academy records unless separately reconciled.
- Coach, Parent and unauthenticated callers cannot execute renewal; Academy Owner B cannot renew Academy Owner A's batch; Super Admin behavior remains separately scoped by ROLE_MATRIX.
- No automatic money movement, notification, payment gateway or background renewal is triggered.
- Browser checks confirm readable preview/confirmation/failure summary at desktop/mobile; server logs/audits and release checklist match actual outcomes.

## 4. Explicit deferrals / exclusions from first pilot

- Automatic scheduled renewal and periodic billing jobs, nightly CRON and autopay; renewal is **Owner-initiated only**.
- Razorpay/other payment-gateway charges, recurring mandates, automated UPI verification or direct bank settlement.
- WhatsApp/email automation, scheduled fee reminders and unapproved notification infrastructure.
- Proration, automatic discount/sibling pricing, complicated pause/resume and vacation corrections, bulk repricing, prospective contracted-price changes without independent acceptance.
- One-time camp renewal and automatic camp dues; staged SP3 one-time billing remains independently gated/off by default.
- Additional sports, new RBAC roles, large redesign of shared components, analytics historical/snapshot architecture expansion and other optional backlog enhancements.
- Any new feature outside this contract without an explicit Product Owner scope-change approval.

Existing functioning features remain protected; the deferral list limits **new work** rather than removing already accepted workflows.

## 5. Verification and release gates

1. BETA-05: approve isolated integration workspace, source-controlled evidence workflow and safe feature-branch strategy.
2. BETA-06: integrate Pitchside Emerald selectively; address all four BETA-03 corrections and prove metric parity.
3. BETA-07: complete subscription verification **and** guarded manual batch renewal; do not call it complete simply because UI/RPC was written.
4. BETA-08: prove one Pending due per renewed period integrates with current dues/collections/receipts, no overpayment and no automatic collection.
5. BETA-09/10/11: manual Coach/Parent journeys and responsive/keyboard acceptance.
6. BETA-12: remediate HIGH-001/HIGH-002 and other release-blocking RBAC, multi-tenant, financial and functional findings; verify negative tests.
7. BETA-13/14/15: authoritative production database blueprint and authorized production setup; reconcile historical migrations and verify Auth/RLS/Storage/restore.
8. BETA-16/17: authorized Vercel configuration, full regression, hosted route refresh, real-role browser acceptance, final Product Owner **GO/NO-GO**.
9. BETA-18/19: explicit pilot onboarding and stabilization/wider-rollout decisions.

**Status at scope freeze:** BETA-01 through BETA-04 accepted as planning/architecture milestones; BETA-05 next. No production deployment date approved. BETA-07 manual renewal remains **PLANNED**, not implemented/tested/approved.

## Source of truth and related documents

- `frontend/src/data/betaTrackerData.js`: canonical milestone status source.
- `frontend/docs/BETA_03_ACADEMY_OWNER_DESIGN_CONTRACT.md`: approved dashboard design contract.
- `frontend/docs/PLAYER_SUBSCRIPTIONS_LIFECYCLE_CONTRACT_20261106.md` and `frontend/src/utils/subscriptionLifecycleDates.js`: prior lifecycle rules and pure date logic, **not** a deployed renewal engine.
- `frontend/docs/PROJECT_STATUS.md`, `PRODUCT_BACKLOG.md`, `PROJECT_ARCHITECTURE.md`, `ROLE_MATRIX.md`.
- Live Supabase **read-only** inspection on 21 November 2026 confirmed current `player_subscriptions` dates/status, `player_batches` membership, existing dues/plans and **no subscription period table or public renewal RPC** in the connected active test project. This does not authorize mutation.
