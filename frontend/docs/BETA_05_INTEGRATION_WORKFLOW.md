# BETA-05 — Beta Integration Workspace, Workflow and Evidence Contract

- **Project:** Kheltriva multi-tenant football academy SaaS
- **Milestone:** BETA-05 — Integration Workspace and Tracking Foundation
- **Prepared:** 21 November 2026 (IST), BETA-05.2 documentation task
- **Architecture review:** BETA-05.1 findings and proposed workflow accepted at architecture-review level by ChatGPT on 21 November 2026
- **Milestone acceptance:** APPROVED by Product Owner (21 November 2026; workspace/process scope only). Tracker evidence and updated assertions are recorded in the separately reviewed closure change.
- **Production:** NO-GO. No release date, production deployment, database migration or automatic billing is approved.

## 1. Authority and baseline

- [BETA Launch Tracker](BETA_LAUNCH_TRACKER.md) and frontend/src/data/betaTrackerData.js are the authoritative roadmap and derived milestone-status source. Do not separately hard-code completed statuses in reports.
- Approved development baseline: payment-module-finalization at 62e54bef15aafffe0810b9c64e8ce1ed81d5b250.
- Controlled integration branch: beta-launch-integration. Verified HEAD for BETA-05.1: 6bf98fd8624671f4328a552f3a361db066111af2. The branch was 28 commits ahead / 0 behind the approved baseline when independently checked on GitHub on 21 November.
- Isolated local beta worktree: C:\Users\Sankita\Documents\acadpro-app\logs\beta-01-t-worktree. The original C:\Users\Sankita\Documents\acadpro-app worktree is on ps-r6a4-integrated-subscription-regression and holds unfinished uncommitted P3 work. Do not change or switch that original worktree during beta integration.
- BETA-05.2 documentation changes are prepared on isolated branch beta-05-2-integration-workflow, not merged into beta-launch-integration or main. The authorized branch change alone is not Product Owner milestone acceptance.
- BETA-01 through BETA-04 are formally approved. BETA-06 through BETA-19 remain PLANNED; do not start implementation until BETA-05 acceptance.

Source contracts: [BETA-03 approved dashboard design](BETA_03_ACADEMY_OWNER_DESIGN_CONTRACT.md), [BETA-04 approved pilot scope](BETA_04_BETA_SCOPE_FREEZE.md), [ROLE_MATRIX](ROLE_MATRIX.md), [PROJECT_ARCHITECTURE](PROJECT_ARCHITECTURE.md), [PROJECT_STATUS](PROJECT_STATUS.md) and [PRODUCT_BACKLOG](PRODUCT_BACKLOG.md). Check current code and actual database schema when a document conflicts with implementation; report rather than silently assume a relationship or permission.

## 2. BETA-05.1 evidence — validated isolated worktree

**Evidence provenance:** Codex local execution summary supplied for review on 21 November 2026. These are reported local results at beta-launch-integration HEAD 6bf98fd, not an independently rerun CI job or verification of the later documentation commit. Raw terminal logs were not added to GitHub.

| Check | Reported result |
| --- | --- |
| Branch / HEAD | beta-launch-integration / 6bf98fd8624671f4328a552f3a361db066111af2 |
| Initial/final git status | Clean, including untracked files |
| Approved baseline ancestry | Exit 0, confirmed |
| Original tracker implementation ancestry | 9423acc present, confirmed |
| Original P3 worktree | Listed at 55cd869; no commands or edits |
| git diff --check | Exit 0 |
| Focused Jest | 6 suites passed; 65 tests passed; 0 failures; 0 snapshots |
| Jest duration / exit | 43.528 seconds / exit 0 |
| React production build | Compiled successfully / exit 0 |
| Build gzip advisories | Main JS 533.37 kB; CSS 72.63 kB; async JS 1.76 kB |
| Changed files | None |

Commands were executed from the isolated worktree's frontend directory:

    $env:CI = 'true'
    npm.cmd test -- --watchAll=false --runInBand --runTestsByPath src/data/betaTrackerData.test.js src/pages/BetaTracker.test.js src/routes/BetaTracker.access.test.js src/components/Sidebar.test.js src/components/Sidebar.accessibility.test.js src/components/ProtectedRoute.accessibility.test.js
    npm.cmd run build
    git diff --check

Non-failing advisories: React Router future flags, stale Browserslist data and bundle size. These do not block BETA-05 workspace acceptance, but should be tracked in later technical review.

**Explicitly unverified:** Full frontend suite, actual signed-in browser sessions across four roles, second Academy Owner tenant, hosted SPA direct-route refresh, live Supabase RLS authorization and migrations. Mocked route tests do not replace real JWT/browser/tenant gates. Older tests cannot be called tests of BETA-05.2 docs.

## 3. Controlled development and integration workflow

1. **Authorize a scoped milestone:** Record objective, starting accepted integration SHA, approved dependencies, permitted files and database objects, explicitly prohibited changes, tests, responsive/accessibility expectations and completion rule. Do not treat BETA-03/04 decisions as permission for unreviewed implementation or migration.
2. **Isolate the branch:** Start an approved feature branch/worktree from the recorded beta-launch-integration SHA, e.g. beta-06-owner-preview. Verify branch, parent ancestry and clean status. Never touch the uncommitted P3 checkout. Do not silently incorporate older UI, PS, payment or security branches in full.
3. **Inspect before editing:** Review the current application implementation, related services, permission utilities, database contract and tests. Verify relationship existence in the active test Supabase schema using read-only inspection; identify discrepancies in the review.
4. **Implement minimum scope:** Keep existing working functionality; split independent UI, financial-backend and security changes into reviewable checkpoints. Retain existing route/RBAC/RLS contract. Use no shared/global design changes or unrelated refactoring absent approval.
5. **Run targeted validation:** Run affected unit/integration tests plus six tracker-focused suites, production build and git diff --check. For later full release validation, run the complete frontend suite with known baseline failures distinguished from new regressions. Financial/security work also requires isolated database tests and real JWT role/tenant, concurrency and rollback checks.
6. **Review source diff and implications:** Inspect git status, changed files and diff. Compare the feature branch to its accepted base; examine metrics, tenant scope, effect on existing data, database dependencies, warnings and rollback strategy. Do not claim completion on the strength of mocked tests or a green build alone.
7. **Integrate only after approval:** Obtain review/merge authorization and use a controlled PR or reviewed change set. Avoid wholesale branch merges. Revalidate the resulting integration SHA. Committing/pushing/merging/deploying follows authorized workflow; never reset, rebase, revert, amend, force-push or delete history without explicit permission.
8. **Capture acceptance separately:** Product Owner performs manual business/UI and role tests; record evidence before setting acceptance to APPROVED. Deployment and production release require independent, explicit authorization and their own verification. Production remains NO-GO in the absence of all gates.

## 4. Workstream order, boundaries and dependent gates

| Milestone | Implementation boundary | Non-negotiable verification |
| --- | --- | --- |
| BETA-06 — Owner dashboard | Selectively adapt UI-C2.10 Pitchside Emerald; preserve current dashboardService metrics, role routing, sidebar and shared styles | Preserve canonical attendance view=mark links, group by stable centerId, label mark-exists (not session-complete), test UTC/IST date/month boundaries; financial parity; mobile and browser acceptance |
| BETA-07 — subscriptions | Verify current assignment/edit/deactivation before approved monthly owner-initiated batch renewal | Original agreement ID and locked price; verified periods; exactly one Pending due per successful player-period; reconcile legacy anomalies; trusted transaction, idempotency, concurrency, rollback and tenant authorization |
| BETA-08 — payments | Integrate renewed Pending dues with manual dues/collections/receipts and approved UPI display/verification | No duplicate billing, implicit payment, excess payment, broken receipts or altered financial history; HIGH-002 boundary addressed |
| BETA-09 — Coach | Assigned-batch dashboard, profile, schedule and attendance UX | Seven-day attendance edit rule, assigned-scope tests and financial/action denials |
| BETA-10 — Parent | Linked-player portal, profiles, fee/receipt visibility and responsive UX | Own linked players only; cross-parent and management denials |
| BETA-11 — shared UX | Shared responsive, accessibility, loading/error and navigation consistency | Full frontend regression, desktop/mobile/zoom/keyboard checks, documented pre-existing failures |
| BETA-12 — security | Final disposition of critical functional and tenant/RPC security defects | HIGH-001/HIGH-002, actual four-role/two-owner-tenant access and financial attack/rollback cases |

Security analysis must start before BETA-07 financial code. BETA-12 is closure, **not** permission to defer design-stage authorization review. Later BETA-13–19 handle reproducible production database, new production infrastructure, Auth/RLS/Storage, Vercel configuration, E2E release acceptance and pilot onboarding under separate approval.

**Manual renewal remains PLANNED:** No deployed subscription-period ledger or renewal RPC has been accepted. Hold legacy-ambiguous price/end-date/ownership records instead of guessing. Pending decision: batch-wide all-or-nothing vs per-player continuation, to be explicitly approved before database implementation. No scheduler, automatic payment collection, gateway, silent repricing, due backfill or production migration. Staged one-time camp dues remain feature-flagged OFF absent authorization.

## 5. Source-controlled evidence and sign-off contract

Maintain separate fields in frontend/src/data/betaTrackerData.js. Do not promote a milestone solely because its code, tests or documentation exist.

| Dimension | Evidence to preserve | Completion interpretation |
| --- | --- | --- |
| Implementation | Precise branch/commit, changed files and delivered scope, exclusions and dependencies | IMPLEMENTED only for actual code; not Product Owner approval |
| Automated tests | Exact commands, commit SHA, environment, exit codes/counts, failures and dated logs/sanitized summaries | PASSED only for the exact tested code/environment |
| Manual acceptance | Browser/device/role matrix, screenshots without private data, decisions, reviewer and date | Only explicit Product Owner APPROVED contributes to COMPLETE |
| Deployment | Environment, deployed commit, configuration/recovery evidence, observed runtime checks and date | Independent of implementation and acceptance |

Reports must explicitly state what was **not** tested. No credentials, private endpoints, personal data, raw financial exports or database secrets in Git history. Link milestone-specific reports from tracker documentation and preserve truthful historical checkpoint records. Use short feature-scoped commits and review diff/status/build before any authorized integration.

## 6. Remaining blockers and acceptance checklist

Known unresolved release dependencies: HIGH-001 Coach cross-tenant mappings; HIGH-002 financial collection/correction RPC authorization; legacy agreement reconciliation; renewal period/transaction foundation and per-player-vs-batch rollback decision; historical migration provenance and recovery; date-boundary and large-query correctness; genuine signed-in four-role/two-tenant testing and hosted refresh.

- [x] BETA-05.1 correct branch, HEAD, clean worktree and ancestry verified by Codex.
- [x] Tracker milestone statuses (19; 4 Approved, 1 In Progress, 14 Planned) and production NO-GO verified.
- [x] BETA-03 and BETA-04 approved contracts reviewed.
- [x] Six focused suites (65 tests) and React build reported PASS at 6bf98fd.
- [x] Workstream ordering, source boundaries and unresolved gates identified.
- [x] Proposed workflow accepted at ChatGPT architecture-review level on 21 November 2026.
- [x] BETA-05.2 documentation reviewed and integrated via GitHub PR #35; five Markdown files only, merge c7b9cc31.
- [x] Product Owner authorized merging/closing BETA-05 and proceeding to BETA-06 after reviewing the reported gates (21 November 2026).

**Current status:** BETA-05 workspace/process acceptance APPROVED by Product Owner; the closure evidence changes still require their own validation. No production release or beta feature implementation is authorized by this approval.
