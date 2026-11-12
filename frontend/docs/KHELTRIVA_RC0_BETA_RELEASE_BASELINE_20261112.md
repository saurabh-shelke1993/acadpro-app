# Kheltriva RC0 — Beta Release Baseline and Scope Freeze

**Prepared:** 12 November 2026
**Status:** PROPOSED FOR PRODUCT OWNER ACCEPTANCE — documentation-only checkpoint, NOT a release authorization
**Proposed beta target:** 15 December 2026; small pilot cohort (approximately 2–3 academies), then 16 December 2026–15 January 2027 for feedback and issue triage
**Inspected baseline:** `saurabh-shelke1993/acadpro-app`, `payment-module-finalization` at `22d5f1664b59f0ad557de92cbe2c59c12ba598b2`
**Active Supabase project:** `ulyealhkmlorsbdiknrh` (`acadpro-db`)
**RC0 change scope:** release inventory, beta scope, blockers and next investigation only; no frontend/backend SQL, policy, migration, payment-data, `main`, Vercel or live database changes

## 1. Decision and non-negotiable rules

RC0 proposes a limited **Kheltriva V1.0 beta**, not a general production release or subscription automation launch. Focus on existing academy operations, the manually managed subscription/dues workflow, security remediation, test repairs, supported data handling and academy onboarding. Automatic renewal, saved proration/period billing and other PS-L2/B4 features remain **not implemented/deferred**, not silently accepted as released.

**Current release verdict: NO-GO.** A date is a planning target, never authority to deploy. Known HIGH authorization gaps must be remediated before real external beta users can reach affected endpoints. Disabling a menu or hiding an action is not a database-side security fix.

**Change control:** do not reset/revert/amend history; do not delete/replay/edit existing migration ledger entries or issue customer-data mutations without a separate, explicitly approved plan. Test security changes in disposable environments first. Capture safe/restorable backups and obtain explicit hosted-DDL authorization before applying a reviewed change. Document tested-versus-manually-accepted separately. Each implementation is one independently reviewed and testable task.

## 2. Verified checkpoint and evidence

| Area | Evidence observed on 12 Nov 2026 | Honest status |
| --- | --- | --- |
| Development HEAD | `payment-module-finalization` = `22d5f166`; merge of AG3.4D3.2 PR #24 | Git branch verified, NOT beta accepted |
| Production integration | GitHub compare `main...payment-module-finalization` reports divergence (ahead 2184, behind 15; large diff) | **Independent integration and deploy review required**; do not bulk-merge without inspection |
| Latest head CI | Phase 7.5 Jest step failed on run `43160993841`; isolated AG3.4D3.2 and H1/H2/H3 security test workflows passed | **Full frontend gate FAIL**; a green NO-GO workflow indicates enforcement, NOT clearance |
| Frontend failures | Prior full suite had 16/490 failures in four Coach Profile/Performance suites (see AG3.4E review); latest run's Jest step failed | Reproduce and independently identify actual current root causes |
| Live migration history | 82 applied; local `supabase/migrations` lists 41 SQL files; `20261111165330` Coach lockdown version absent | Historical provenance unresolved; **no normal `db push`** |
| Live reference counts | 5 academies; 51 players; 22 active subscriptions, all 22 without `end_date`; 3 mismatched player/plan academy subscription rows; 4 players with multiple active rows; 26 dues; 42 payment entries | Aggregate read-only snapshot, **not** reconciliation or approval to edit data |
| Finance ledger exceptions | 31 Oct Finance Analytics acceptance audit lists 11 due/linked-payment mismatches | Historical audit pending evidence-based disposition; **not revalidated here** |
| Existing UPI claim workflow | P1.4/P1.5 migration versions `20261012023354`, `20261012023526`, `20261012025707` applied | Implemented, browser/security acceptance pending |
| Open security draft work | AG3.4D3.3 PR #25 and PR #26 are **both open drafts**, not merged | Hold parallel drafts for review; do not merge either as RC0 |
| Production approval | `frontend/docs/KHELTRIVA_DEVBOT_AG3_4E_FINAL_SECURITY_RELEASE_REVIEW.md` is NO-GO | **NO-GO unchanged** |

Source documents: root `DEVELOPMENT_CONTINUITY.md`, `frontend/docs/PROJECT_STATUS.md`, `frontend/docs/PROJECT_ARCHITECTURE.md`, `frontend/docs/ROLE_MATRIX.md`, `frontend/docs/PRODUCT_BACKLOG.md`, `frontend/docs/P1.6_UPI_RELEASE_CHECKLIST.md`, `frontend/docs/PLAYER_SUBSCRIPTIONS_PS_L1P2_PREVIEW_20261106.md`, `frontend/docs/PLAYER_SUBSCRIPTIONS_PS_L0B_RECONCILIATION_20261106.md`, `FINANCE_ANALYTICS_ACCEPTANCE.md`, and AG3.4E release review. Older status tables within append-only documents can be stale; use later checkpoints and actual source/live catalog when they differ.

## 3. Scope freeze (proposed)

### A. Required beta workflows — only once tested and accepted

1. Supabase Auth and session handling for **Super Admin, Academy Owner, Coach and Parent**, including route access and cross-academy/parent-child isolation.
2. Academy, center, batch, coach assignments and player CRUD using existing implemented paths.
3. Coach and Owner attendance marking/history with existing assigned-batch, session, edit-window and Super Admin history-only restrictions.
4. Parent linked-child schedule, attendance, dues and payment/receipt read access.
5. Subscription plan management and **existing manual player subscription assignment/edit/deactivation**, with financial terms made clear and no automatic generation implied.
6. Manual payment dues, approved payment collections, receipts and correction workflows **only after confirmed authorization vulnerabilities are fixed**.
7. Basic owner/platform dashboards using verified metrics, clear empty/error states and explicit exclusions where historical finance data is incomplete.
8. Basic responsive operation, user-facing errors, onboarding and support/issue intake.

### B. Conditional — must pass separate security and browser acceptance or remain unavailable

- Academy UPI settings and Parent QR/WhatsApp instructions: run owner/parent, tenant and Storage-object checks.
- Parent UPI submission / owner review / accepted-claim ledger recording: P1.4–P1.6 plus AG3.4D3.3 source-matched real-JWT proof, backend role isolation and ledger invariants. Do not enable external access solely because the UI is hidden or automated tests on old heads passed.
- Enquiries and financial analytics: release only verified paths and reports, with source-data limitations stated. Do not present 11 historic ledger exceptions as resolved without evidence.

### C. Deferred to post-beta, not accidentally committed as beta promises

- PS-L2/B4 automatic renewal, expiry/period ledger, automated due generator, scheduled billing, pause/resume and free extension writes, saved or default proration policy.
- Razorpay/live online payment processing, automated WhatsApp/email reminders, expanded notifications and optional reporting modules.
- Broad UI redesign, speculative database refactors, unrelated feature improvements and silent migration-history rewriting.
- New paid subscriptions for the **Kheltriva SaaS service** until pilot feedback and commercial readiness review.

### Subscription clarity for beta

`frontend/src/pages/PlayerSubscriptions.js` currently creates/updates `player_subscriptions` using player, plan and start-date fields; it does **not** save the simulated prorated amount, save a computed end date or create a matching payment due. `SubscriptionFeePreview` is explicit **read-only advisory UI** for a new monthly subscription. It is not rendered for edits and is not authoritative billing.

The original customer problem must be reproduced with controlled data in RC1. Define and obtain Owner acceptance of the minimum safe V1 behavior: either a **clearly separated, manual, correctly auditable charge/due workflow** or a separately approved trusted transactional billing change. Do not auto-write a preview fee, modify historic dues or activate B4 as a shortcut. If current UI misleads users that a preview will be saved, correct its language or interaction during RC1 with targeted tests.

## 4. Blocker register — ordered by beta risk

| ID | Priority | Issue / scope | Exit evidence required | Current status |
| --- | --- | --- | --- | --- |
| RC0-P0-01 | P0 | **HIGH-002:** NULL-role privileges in payment collection and correction RPCs (confirmed against original deployed source in disposable signed-JWT tests) | Reviewed hosted fix, controlled migration, negative/positive JWT, no cross-academy changes, ledger/rollback regression | **OPEN, NOT DEPLOYED** |
| RC0-P0-02 | P0 | **HIGH-001:** unused legacy `coach_batches` exposes inappropriate role operations | Protected H2 versioned migration `20261111165330` approved/applied via isolated one-version procedure, postflight, four-role tests, no active Coach assignment regression | **OPEN, STAGED ONLY** |
| RC0-P0-03 | P0 | Parent UPI / other privileged RPCs and Storage permissions not fully runtime-tested | Complete prioritized tests; remediate confirmed defects; explicitly decide on unavailable optional features without relying on UI-only hiding | **PENDING** |
| RC0-P0-04 | P0 | Actual restore readiness unverified on Supabase Free plan | H5.1 private hash/roles checks, H5.2 isolated restore, Storage object recovery and migration rollback drill before hosted changes | **PENDING** |
| RC0-P0-05 | P0 | Latest full frontend Jest run fails | Source/root-cause fix, full Jest + production build PASS on exact release candidate SHA | **FAILED** |
| RC0-P0-06 | P0 | No audited main/release-candidate integration; NO-GO security evidence gate | Approved release baseline, reviewed branch diff, exact-SHA CI, deployment runbook, live smoke/postflight, formal release sign-off | **PENDING** |
| RC0-P1-01 | P1 | Original subscription modification/proration expectation not met | Reproduce, freeze expected V1 contract, implement smallest safe path, targeted + Owner acceptance | **NEXT: RC1** |
| RC0-P1-02 | P1 | 22 open-ended active agreements, 3 cross-academy plan mismatches, 4 players with overlapping active agreements | Itemized Owner review; prevent unsupported renewals/duplicate creation; no unaudited bulk rewrite | **PENDING** |
| RC0-P1-03 | P1 | Finance historical due/ledger discrepancies from 31 Oct audit | Evidence-based reconciliation or exclude/label unverified KPIs before customer reporting | **PENDING** |
| RC0-P1-04 | P1 | Four-role browser, responsive, login persistence and operational smoke tests | Owner-signed scenarios at mobile and desktop; negative tenant/linked-player tests | **PENDING** |
| RC0-P1-05 | P1 | Academy onboarding, initial support and privacy practices | Pilot academy rehearsal, issue intake, backup/retention and privacy notice review | **PENDING** |

**P0 means beta release blocked**, not permission to bypass the existing AG3.4E NO-GO gate. Some P1s may escalate if they risk user funds, data exposure or irrecoverable records. All confirmed severe security vulnerabilities in reachable production functions must be remediated before external access.

### Release-gate design caveat

The existing AG3.4E strict gate also depends on historical B3 replay and B4 subscription automation acceptance. RC0 proposes deferring B4 *functionality* for a manual-workflow beta. A **separate, reviewed, explicit beta release gate** is required to reconcile that product-scope decision with the current strict NO-GO evidence contract. Do **not** set existing evidence booleans to true, weaken safety requirements or silently pronounce the existing gate green. No customer beta is authorized by this document.

## 5. Target milestones (planning, not promises)

| Window | Workstream | Completion evidence |
| --- | --- | --- |
| 12–15 Nov | **RC0:** baseline, scope, blocker register and Owner acceptance | Draft reviewed; scope decision recorded |
| 16–22 Nov | **RC1:** original subscription issue, targeted fixes and regression | Controlled scenario and role/tenant acceptance |
| 23–30 Nov | **RC2:** critical hosted payment/legacy-role security fixes and recovery | Verified backup + explicit DDL approval + postflight JWT checks |
| 1–6 Dec | **RC3:** full Jest/build, cross-role browser and responsive QA | Exact-SHA full pass and signed negative tests |
| 7–11 Dec | **RC4:** release candidate, onboarding, documentation and operational drill | Environment and main integration review, recovery runbook |
| 12–15 Dec | **RC5:** go/no-go decision and small-cohort beta only if gates pass | Product Owner explicit release approval |
| 16 Dec–15 Jan | **Post-launch pilot:** collect academy issues and usage evidence | Weekly feedback triage and release patches |
| Late Jan / Feb | Paid-plan strategy and conditional monetization | Pilot value, support effort, terms and pricing accepted |

RC1 can be investigated while RC2 security remediation is planned, but **no hosted release may proceed while P0 is open**. If P0 persists near 15 December, limit activity to internal demos with synthetic data and reschedule external beta.

## 6. Formal release acceptance checklist

- [ ] Owner approves RC0 scope freeze and names beta pilot academies.
- [ ] All confirmed HIGH-001/HIGH-002 and reachable unauthorized payment/Storage paths closed in the hosted environment.
- [ ] No customer-facing unreviewed privileged RPC or unsafe direct-table grant exposed.
- [ ] Backup integrity plus an isolated restore actually verified; change recovery runbook available.
- [ ] Latest full frontend Jest and React production build pass on the exact candidate SHA.
- [ ] Existing subscription workflow and fee/due accounting manually accepted without claiming saved proration/auto-renewal.
- [ ] Real Owner/Coach/Parent/Super Admin sessions pass functional, direct-ID negative and tenant-isolation tests.
- [ ] Payment collection, corrections, dues, UPI (if enabled), receipts and critical ledger invariants accepted.
- [ ] Finance reporting discrepancies reconciled or made explicitly unavailable/clearly qualified.
- [ ] Reviewed development-to-main integration, production environment, HTTPS/domain, privacy/support and onboarding.
- [ ] Current AG3.4E NO-GO contract and any proposed separate beta-specific decision reconciled through an auditable security review.
- [ ] Product Owner provides **fresh explicit release authorization** and freeze SHA is recorded.

No check is complete because code exists, an isolated CI job passed or a PR was merged. Record tester, date, environment, commit SHA, scenario and evidence for each.

## 7. Next controlled task: RC1 — original Player Subscriptions issue

**First action after RC0 acceptance: INSPECT ONLY.** Reopen the exact scenario with test records and review:
- `frontend/src/pages/PlayerSubscriptions.js` create/update, edit restrictions and preview render conditions;
- `frontend/src/components/SubscriptionFeePreview.js`, `frontend/src/utils/subscriptionProration.js` and schedule reads;
- active `player_subscriptions`, `subscription_plans`, `payment_dues`, `payments` columns, FKs, triggers, RLS and finance dependencies;
- the 22 legacy agreements, academy mismatches/active duplicates, and historical paid-through/contracted-rate limitations.

**Deliverable before coding:** a one-page RC1 behavior contract distinguishing (a) manually changing a player's plan/start date, (b) saving a negotiated/prorated charge, (c) creating or updating a due, and (d) future automated renewal. Only the minimum Owner-approved option proceeds to code. All modifications must use controlled fixtures, preserve settled ledger rows and pass negative tenant/RBAC tests.

## 8. RC0 validation and approval status

- **Implemented in this task:** this source-linked document proposal only.
- **Tested:** read-only GitHub branch/release/CI and active Supabase aggregate/migration checks; no app execution or browser testing in RC0.
- **Not tested:** full frontend, hosted remediation, restore, production deploy or manual acceptance.
- **Pending:** Product Owner review/acceptance, merge of this documentation-only PR to `payment-module-finalization`, then RC1 inspection.
- **Unchanged:** existing application code, production database, migrations, payment records, `main`, Vercel and AG3.4E NO-GO.

This freeze can be revised only through a clearly scoped Owner-approved decision, with the release register updated to show the change.
