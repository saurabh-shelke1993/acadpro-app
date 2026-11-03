# Kheltriva — Development Continuity

**Updated:** 2026-11-03 (Asia/Kolkata)  
**Project:** Kheltriva (formerly AcadPro) — multi-tenant football academy SaaS  
**Repository:** https://github.com/saurabh-shelke1993/acadpro-app  
**Working branch:** `payment-module-finalization`  
**Original branch baseline (before this file was created):** `0bfc71099ed14cdada08022320a72c378e9da5f7`. Subsequent CMA commits exist; recheck current branch HEAD before development.  
**Purpose:** Stable, handoff-friendly checkpoint between ChatGPT conversations. This document is NOT a substitute for inspecting live code, the current database, or current tests.

## 1. How to resume in the next chat

1. Read **this file** first. Then read `frontend/docs/PROJECT_ARCHITECTURE.md`, `frontend/docs/PROJECT_STATUS.md`, `frontend/docs/ROLE_MATRIX.md`, and `frontend/docs/PRODUCT_BACKLOG.md`.
2. Inspect the **latest** `payment-module-finalization` branch HEAD, changed files and most recent commits. Do not assume the recorded SHA is still current.
3. Inspect the actual affected code and dependencies. Where database behavior matters, inspect the **active** Supabase project's schema, RPC definitions, grants and migration ledger before proposing changes.
4. Reconcile conflicts between this checkpoint, older docs, live code and database. Mark uncertainties explicitly.
5. Identify the exact next task and distinguish `planned`, `implemented`, `automated-tested`, `browser-accepted` and `deferred`.
6. Continue the development routine: understand requirement → inspect → propose small scope → implement → run available checks → user manual testing → update docs → inspect Git diff/status → commit. Include commit SHA/link and local pull command.
7. Do not reconstruct the app or repeat completed changes. Do not reset/revert/amend Git history or modify live business records without express approval.

**Suggested first message for a new chat:**

> We are continuing Kheltriva (formerly AcadPro) development from the previous AcadPro Development Status chat. Read `DEVELOPMENT_CONTINUITY.md` in the repository root and the four core documents in `frontend/docs/`. Inspect the latest `payment-module-finalization` branch and active Supabase migration state. Distinguish implemented, tested, accepted and pending work, then resume the next development task. Follow our existing small-phase workflow; inspect before editing and preserve RBAC/multi-tenancy.

## 2. Architecture and operational guardrails

- **Product:** Kheltriva; football academy management for multiple academies.
- **Stack:** React/JavaScript/React Router frontend in `frontend/`; Supabase Auth, PostgreSQL, Row Level Security, Storage and secured RPCs; GitHub; Vercel.
- **Active Supabase project:** `acadpro-db`, project ref `ulyealhkmlorsbdiknrh`. Historical project `borsjaktqcuicmuiuldc` is **inactive**: do not use it by assumption.
- **Roles:** `super_admin` (platform), `academy_owner` (own academy), `coach` (assigned scope), `parent` (linked children). Database/RLS/RPC authorization is authoritative; UI visibility alone is not security.
- **Entity hierarchy:** Academy → Center → Batch → Player; parent connection through `players.parent_id → parents.id`. Preserve the existing `player_batches` integrity contract.
- **Production/deployment:** check Vercel's actual branch/deployment configuration and target for each release; a preview or a GitHub commit does not mean production has been verified.
- **Brand direction:** consult root `README.md` and `frontend/src/styles/design-system.css` for approved Kheltriva navy/blue/lime design tokens; avoid hard-coded replacement colours.
- **Security and data safety:** avoid test enquiries, conversions, payments or player rows in live Supabase; isolated fixtures are required for destructive/rollback/concurrency tests. Never rewrite already-applied migrations.
- **Owner role:** user decides product scope and performs manual UI/business acceptance. **ChatGPT:** architecture, focused GitHub changes, review and documentation. **Codex:** larger implementation work after inspecting repository; no unrelated edits.
- **UX preferences:** compact headings, minimal unused vertical space, responsive/mobile-first layouts; avoid horizontal mobile table scroll where feasible; simple filter toolbars, visible actions and module-specific pagination.

## 3. Source-of-truth notes and documentation drift

Primary reference files (all currently located in `frontend/docs/`):
- `PROJECT_ARCHITECTURE.md`
- `PROJECT_STATUS.md`
- `ROLE_MATRIX.md`
- `PRODUCT_BACKLOG.md`

These project files were last materially updated in **September–October 2026** and contain historical checkpoints that **predate recent UI phases**. For instance, `PROJECT_STATUS.md` still discusses Enquiries R3 as a next step despite the later R3–R6 implementation. `ROLE_MATRIX.md` describes `inquiries` as an unused legacy table, which conflicts with the current active Enquiries module. Do not use these outdated lines as evidence of current behavior; reconcile and update the appropriate documents in a scoped documentation task.

Additional focused reference: `frontend/docs/ENQUIRIES_E5_VALIDATION_CHECKPOINT_20261101.md` and `frontend/docs/ENQUIRIES_R6_REGRESSION_RELEASE_CHECKLIST.md`. Older checklists contain historical test passes for older commit SHAs; do not roll them forward to current HEAD.

**Current state must be validated against latest source and, when relevant, actual database catalog/migration history.** When a gap is found, record it instead of inventing a completion date or passing test.

## 4. Current development focus and module checkpoint

**Development mode:** active feature/UI improvement. The user decided on 2026-11-01 to **defer full E5 regression and formal release readiness** while continuing development. Small change-level checks still matter. Do not describe the application as production-release-ready.

| Workstream | Current checkpoint | Evidence / follow-up |
| --- | --- | --- |
| Academy Owner dashboard / analytics | Substantial dashboard and analytics work exists, including an Academy Owner Analytics V2 effort. | Inspect latest components and current analytics contract before resuming; older roadmap docs may not reflect work completed in later chats. |
| Players | Recent Players UI simplification removed redundant list-heading/page-summary block. | Commit `c64e663b3a947380fa1c9c8218bbb744cee113c4`. Later browser/regression acceptance not recorded here. |
| Batches | Recent Create Batch form compacted; action footer moved below full 30/70 form layout for far-right alignment. | Commits `2aa894be8e620315d98fd6ee6297eeeb00eaaa26`, `6432d05d3d8fdd7b1d70b89f8c08d04d577bbc66`. Verify current UI if revisiting. |
| Enquiries — E1 | Compact header and filter toolbar, converted-row actions column alignment. | **User accepted** E1 in browser. |
| Enquiries — E2 | Academy Owner action dropdown; Coach retains a direct Update Status button; converted records have no actions. | Implemented; full role acceptance pending. |
| Enquiries — E3 | 10-row client-side filtered pagination; mobile expandable details. | Implemented; full mobile/browser acceptance pending. |
| Enquiries — E4 | Compact Create, Edit and Conversion forms; existing validation and conversion RPC preserved. | Implemented; full form/browser acceptance pending. |
| Enquiries — status dialog refinement | Replaced space-consuming inline status editor with compact modal. | Implemented; browser regression pending. |
| Enquiries — E5.1 | Deleted-enquiry RPC security: `delete_inquiry(uuid)` now requires Academy Owner and denies anon EXECUTE. | **Applied to active database** and verified via metadata; authenticated role-by-role negative path tests pending. |
| Enquiries — E5.2 | Code + migration review and test command preparation. | Source audit recorded, **current-HEAD Jest/build NOT executed**. |
| Enquiries — E5.3/E5.4 | Full role, conversion, cross-tenant, UI regression and release sign-off. | **Deferred** during active development; release gate still open. |
| Coaches / Coach Batch Mapping | **CMA1–CMA4 + CMA6 implemented**: shared workspace, Parent Portal-style two-card selection navigation, compact directory/assignment forms, responsive session chips and mobile actions. **CMA5 review/test authoring documented**. | Current-head build/Jest and browser acceptance **pending**; mapping lifecycle issues remain tracked separately in `frontend/docs/COACHES_CMA5_REGRESSION_AND_ISSUES_20261103.md`. |
| Coach Profile | **CP1–CP4 implemented:** compact identity; independent-height Personal Details and Training + Certifications; collapsed certification editor; keyboard focus/labels and 320–700px responsive polish. **CP5 expanded existing Jest suite to 12 tests and recorded regression matrix**. | Source reviewed, tests **authored but not executed**; build and Owner/Coach/Parent browser acceptance pending. See `frontend/docs/COACH_PROFILE_CP4_CP5_20261103.md`. |
| Attendance / Attendance History | Existing operational functionality, session-aware attendance and coach edit rules. | Further UX polish and final regression pending. |
| Parent Portal, payments, dues, UPI | Multiple implemented workflows including Parent Portal, UPI QR/manual verification and financial modules. | Preserve business/RBAC invariants. Pending acceptance must be checked in focused docs; Razorpay remains future work. |
| Notifications | Prior exploration/preflight/design work exists. | No new notification migration should be assumed applied without verifying live migration ledger. |
| Product-level release QA and hardening | Deferred full cross-role testing, production verification, security advisor clean-up, and documentation reconciliation. | Revisit before pilot/production launch. |

## 5. Enquiries detail — latest focused work

The current Enquiries component is `frontend/src/pages/Enquiries.js`, service `frontend/src/services/enquiriesService.js`, styles `frontend/src/pages/Enquiries.css`.

**Recent UI commits (GitHub branch):**
- E1: `a702f5db81120556670e67820236eb7806c7c5cc` and `d6ed06749b24f228a2a84634ed4b7b20614e0f62`.
- E2: `d5696b85587cf255ed0f5b6968f04aed487162c3` and `23f17038d534a72bb7d640a5fb4990992bc85652`.
- E3/E4: `50e1a6f090c811e1cea6e26047260c49672a6088`, `b9fbc491947e5e59d882cc0ff730ad9b7c382a9c`, `813c9203a2e5eef75fe44f36b2dd027ddec46600`.
- Status dialog refinement: `95107a29a43509275b24d44879c6700415b53f2a` and `3c856d3716833098421b3ba0675d33fc25822262`.
- E5 security checkpoint: `84e53aab58a4afe88c81cbba8ee18dc73971faf9`.
- E5.1 security migration: `ea7345666116d66379bc92e781a9ff6848f4ff52`.
- E5.1 checkpoint update: `e84250dbcc4e67fc9e99958bb3afdcb0158c184d`.
- E5.2 partial validation checkpoint: `0bfc71099ed14cdada08022320a72c378e9da5f7`.

**Database migration:** `supabase/migrations/20261101082001_enquiries_e5_1_owner_only_delete.sql`; active Supabase migration ledger contains version `20261101082001`. After application, catalog verification reported Owner-only role check in the function; EXECUTE anon = false, authenticated = true, PUBLIC = false. The function retains academy check and converted-record rejection. No synthetic records were inserted or deleted for the review.

**Important outstanding tests:** owner/coach/super-admin/parent/anonymous authorization (including direct RPC), trial-date validation, Lost/Converted restrictions, pagination reset, status modal, mobile expansion, duplicate warnings, and isolated conversion rollback/concurrency. Do not run destructive tests against live business data.

**Historical evidence limitation:** Enquiries R6 checklist records 101 Jest tests and production build passing for `fa87d7d79152a3807f7c86e070d4b3be9ec97b50` (2026-10-13). This is **not** evidence that E1–E4/latest branch passed current build/tests. Last E5.2 review did not execute Jest or build.

## 6. Current owner decision and next task

- The owner chose to **continue development** instead of completing full Enquiries E5.2–E5.4 immediately.
- The owner approved **Coaches & Assignments** as one user-facing workspace, implemented incrementally with shared navigation while preserving the two existing underlying components and routes.
- **CMA1 IMPLEMENTED — acceptance pending:** added `frontend/src/components/CoachWorkspaceTabs.js` and `.css`; both `Coaches.js` and `CoachBatchMapping.js` render these route-based tabs. Sidebar now shows one `Coaches` entry, active on either `/coaches` or `/coach-batch-mapping`. Both routes remain protected for Super Admin and Academy Owner; Coach Profile routes unchanged. **No DB or RPC changes.**
- CMA1 implementation commits: `4eb22a468b80725f8c16da487df7c9db87e78275`, `23caf4e119866b584e361736225a04b7cebc9cc0`, `2ae3a3016313b452b3bf86e940f3e3a61cb583e1`, `1c514ac24e68be34d17ca2d3f1c9b3111fd4eedd`, `6c80375bbc791058afb57d93e95a809e9728608d`.
- CMA1 acceptance: Academy Owner and Super Admin navigate tabs in both directions; sidebar Coaches stays highlighted; direct mapping URL and existing profile links work; mobile tabs don't overflow; Create/Edit Coach and batch-session assignments behave as before. Full build/Jest and browser tests **not run** by GitHub-file connector.
- **CMA2 IMPLEMENTED — acceptance pending:** Coach Directory now starts with the existing table visible; `+ Add Coach` opens the unchanged form; Edit opens it prepopulated; Save/Cancel closes it. Removed duplicated page/list headings, moved count, filters and create action into a compact toolbar. Coach CRUD calls, filters, pagination and profile routes retained.
- **CMA3 IMPLEMENTED — acceptance pending:** Batch Assignments shows a compact academy/count toolbar and `+ Assign Coach`; the mapping form opens on demand and edit reopens it. Existing batch/session selection, save/update/deactivate/delete routines retained. Removed duplicate headings and page-count repetition, with mobile-responsive toolbar styling.
- CMA2/CMA3 files: `frontend/src/pages/Coaches.js`, `Coaches.css`, `CoachBatchMapping.js`, `CoachBatchMapping.css`; shared `frontend/src/components/CoachWorkspaceTabs.js` and `.css` updated to provide a semantic page heading. **No database/RPC/migration or route changes.**
- CMA2/CMA3 commits: `16485a320e1d2855a8d41da4b131fab9b7902761`, `ecc2529f56f6cdd715a829ec819b454673e46155`, `b6c78626409de037a32de9c929584ee75fed6c67`, `e0307ddac1ec567783b074461fbe0e66074c66f3`, `cf5eeeedcc08adefcf800b0aa80bceb4fd2db198`, `c91c9461ae66cf106e532eea1a19c20a17c086c9`, `d4f98e4e69dd9049c957a3afb4b5a094c8270cb4`.
- **CMA4 IMPLEMENTED — acceptance pending:** session cards restyled as compact chips, assignment footer right-aligned; form-local Close replaces top Close while editing; required-session legend reflects whether sessions exist. Mapping empty state offers correct next action; explicit mobile Actions/Hide actions disclosure is now available to Super Admin and Owner. Coach status toggle icon accurately indicates activate/deactivate and no longer resembles delete. Keyboard row event handling avoids intercepting child control keys. No business mutation rules, RLS, database or route changes.
- CMA4 commits: `c4a46e1571854b74318ba82a53ffe92c32169209`, `51f57a9e7513b5834eea6a2027c78da5fcc8911b`, `f1e721fb222d5b3bfd9251f4403cdcdf94df999a`, `e41d314cc8db7a809e12aa0ad1a296c3638488da`, `49b1f53312fd1dc4b48a7cc3e9dc937c6768f82d`, `a06ba5c7a9092397dbdc9f353a3d4a5879016a1f`.
- **CMA5 DOCUMENTED + TEST AUTHORED — runtime validation pending:** new focused tab-route test `frontend/src/components/CoachWorkspaceTabs.test.js` (commit `2216a660d9f0c2c82a56e9e3374d82fed6400c9d`), and detailed role/viewport regression matrix plus issue register `frontend/docs/COACHES_CMA5_REGRESSION_AND_ISSUES_20261103.md` (commit `1d62a58d19a939c80b196a28933a16809ae11e4f`). **No current-HEAD build/Jest or browser test results have been observed; do not call the feature fully tested.**
- **CMA6 IMPLEMENTED — acceptance pending:** Replaced the small Coach Directory / Batch Assignments top-right tabs with two full-width, equal-size selection cards based on the Parent Portal children's selector. Each card has a circular letter avatar, name, description, blue outline/background and a Selected badge when active. Navigation remains route-based via `/coaches` and `/coach-batch-mapping`, with React Router `aria-current` for accessibility. Two columns on desktop, stacked on narrow screens; the underlying coach and mapping components, permissions and Supabase calls are unchanged.
- CMA6 files/commits: `frontend/src/components/CoachWorkspaceTabs.js` — `283fa84274c14a6727d1c3ee6bf1708aaab8a456`; `CoachWorkspaceTabs.css` — `822ef23c0e3bed8ef650feeef490837d5f3eedd2`; focused `CoachWorkspaceTabs.test.js` — `1f421e831bc8bb2c6532006dee7bef1b8048efc8`. Tests authored, **not executed**.
- **CURRENT NEXT:** run exact-current-head `CI=true npm test -- --watchAll=false` and `npm run build`, check the two cards and their selected indicators at desktop/mobile widths and for both authorized management roles, and confirm direct route navigation. User acceptance is pending. Afterwards choose next work or separately scope the two mapping lifecycle issues.
- **COACH PROFILE CP1–CP3 IMPLEMENTED — acceptance pending (2026-11-03):** `CoachProfile.js` and `CoachProfile.css` now display a compact coach header, status and contextual training summary; Personal Details stays on the left and the right column stacks Centers & Batches above Certifications without stretching shorter cards; Parent remains a full-width personal-details view with no Training Scope or Certifications. Authorized Add/Edit Certification expands the editor; successful Save or Cancel collapses it. Service, RBAC, RLS and DB are unchanged. Source commits: `ccb6117c80e167c90536793f175afb439f37edb1`, `c609ef7dea8162b41f519882474565fafd5d657f`, `acf72a131f92010d895b0d01bdf6b643cc90b640`, `0e803cdc8bba50af6cb19c9817a6cd6bea3da611`, `f4530f714f106ae932494b81bdf89a380e45c139`. Focused checklist: `frontend/docs/COACH_PROFILE_CP1_CP3_20261103.md`. CP4 and CP5 work subsequently implemented (see below); **no current-HEAD test/build or browser PASS claimed.**
- **COACH PROFILE CP4 IMPLEMENTED — acceptance pending (2026-11-03):** scoped focus-visible controls, section/form accessibility labels, initial focus when editing profile/certificate, focus restoration to certificate disclosure after save/cancel, responsive personal-details columns at 481–700px and compact one-column mobile layout at ≤480px, wrapping/overflow support. Commits `7dd8d09f38a1364ab88166982d8191c5a2d0cc50`, `97866f17e1e9c29aa24a87273878338dabe3095a`. No service, DB or RBAC changes.
- **COACH PROFILE CP5 TESTS + REVIEW DOCUMENTED — execution pending:** updated existing `CoachProfile.test.js` to 12 authored tests, including CP1–CP3 changed header/closed-form expectations, certification focus/cancel/success/error, owner/admin/coach/parent access checks. Commits `37f0eb7bef7345e7d7496a05a766154de55f9987`, `d8c7fb722ba03229a2fabfc2e8cae9057f3c57f9`. Regression document `frontend/docs/COACH_PROFILE_CP4_CP5_20261103.md` at commit `c388493a548e8a9f990e9a4fbf7846b5c5076dee`; canonical `frontend/docs/PROJECT_STATUS.md` updated at `71a1e59879ec6d01aa7bb910a8c9b0e0f16cfdae`. **Unit/Jest/build and manual browser runs NOT claimed passed**.
- **CURRENT DEV FOCUS:** owner will review CP1–CP5 together later. The next feature may proceed independently, but before release verify the exact-current-HEAD tests/build and Owner/Coach/Parent mobile/desktop behavior. Coaches & Assignments CMA5 and separate assignment lifecycle issues remain open.
- **Open business-rule issues remain separate:** ISSUE-COACH-01: reactivation rejects another active coach on the same batch despite multi-coach support; ISSUE-COACH-02: coach profile deactivation does not itself update mapping/session status. Current access impact still needs database and role tests. The focused CMA5 document includes source evidence, decisions required, and controlled test scenarios. An additional non-atomic mapping/session mutation risk is noted for later analysis.
- If the owner chooses a different task, update only the changed priority; do not assume the previously proposed page is mandatory.

## 7. Local validation and Git practice

From the working repository checkout:

```bash
git status --short
git branch --show-current
git pull origin payment-module-finalization
git rev-parse HEAD
cd frontend
CI=true npm test -- --watchAll=false
npm run build
```

Only pull when local work is safe to integrate; **do not discard uncommitted changes**. Record exact tested SHA and results. When directly editing through GitHub, state that the connector committed the change, but do not claim local build or browser tests unless actually run. The owner manually accepts UI behavior across authorized roles. After implementation, provide clickable commit link(s) and a small role-specific test checklist.

## 8. Update this file at each milestone

1. Update **Updated** date and verified working branch/revision.
2. Replace superseded **current checkpoint** statements; avoid infinite append-only history.
3. For each completed change record: scope, changed files, commit SHA, DB migration if any, **implementation / automated validation / manual acceptance** status, and remaining defects.
4. Keep the next development action explicit and narrow.
5. Update canonical docs where behavior truly changed; don't rewrite unrelated history.
6. Before opening a new ChatGPT conversation, review this file against latest branch and active Supabase state.

**Handoff principle:** GitHub code + live authorized database metadata are the implementation truth. This continuity document is an index of decisions and evidence, not a claim that all prior work was tested or released.
