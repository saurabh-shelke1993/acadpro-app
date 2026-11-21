# Kheltriva Beta Launch Tracker

The internal, read-only `/beta-tracker` page uses the existing Layout, Sidebar and ProtectedRoute. Only `super_admin` is allowed. Academy Owner, Coach, Parent and unauthenticated direct entry or refresh follow the existing redirect to `/login`. The sidebar uses the existing `isSuperAdmin` helper under Internal. Authentication, role semantics, database permissions and global design styles are unchanged.

This is a static frontend roadmap, not a confidential document store. Bundled JavaScript can be downloaded regardless of route visibility. Keep credentials, personal data, private endpoints and sensitive operational details out of it. There are no tracker network requests, database tables, migrations or write controls. The shared Layout retains its existing behavior.

## Single source and schema

`src/data/betaTrackerData.js` owns phase definitions, launch metadata and all task records. Its JSDoc is the schema contract. Stable `BETA-01` through `BETA-19` IDs must not be renumbered or reused. `BETA-01-T` is this implementation task, not an extra twentieth roadmap milestone.

Each task has an ID, name, phase ID and `workStatus` (`PLANNED`, `IN_PROGRESS`, `BLOCKED`). Evidence dimensions are independent objects:

| Field | Allowed status values | Evidence requirement |
| --- | --- | --- |
| `implementation` | `NOT_STARTED`, `IN_PROGRESS`, `IMPLEMENTED` | Branch/commit and exact delivered scope, with known limitations |
| `automatedTests` | `NOT_RUN`, `PARTIAL`, `PASSED`, `FAILED` | Commands, baseline/commit, date, results and retained report/log references |
| `acceptance` | `NOT_REVIEWED`, `PENDING`, `REJECTED`, `APPROVED` | Manual checklist, named authorized reviewer, approval date and decision reference |
| `deployment` | `NOT_VERIFIED`, `NOT_DEPLOYED`, `DEPLOYED` | Actual environment and deployed commit, verification date and report reference |

Each dimension accepts an optional `evidence` array of plain text references. Acceptance also accepts `approvedBy` and `approvedOn` (ISO date). Optional `branchReference`, `blocker`, `nextAction`, `notes` and `lastVerifiedOn` provide context. Omitted or empty fields display an explicit unknown/not-recorded fallback. Missing evidence is never inferred to pass. `lastVerifiedOn` records actual evidence review, not an automatic page-render date. Record the date's scope in notes when only part of the task has been verified.

`getBetaTaskStatus` derives `COMPLETE` only from the exact value `acceptance.status === "APPROVED"`. Completion cannot be set through `workStatus`. `getBetaSummary` calculates the global and per-phase counts from those derived statuses. Phase completion is approved tasks / phase tasks; code and test progress never inflate it. The active milestone is the first in-progress record in registry order, then the first blocked record, then the first planned record; when all tasks are approved it is empty. Filters affect the task workspace only, so summary totals remain stable.

## Updating accepted statuses

1. Review the intended milestone criteria against the selected branch and commit. Preserve the ID and phase relationship.
2. Update implementation and test dimensions only to the extent supported by retained evidence. Name the commands and limitations. Prior discovery or tests on another branch are notes until verified for this milestone.
3. Attach the manual acceptance decision, reviewer and date. Set `acceptance.status` to `APPROVED` only after explicit authorized acceptance; implementation, a green build or architecture review alone does not grant Product Owner approval.
4. Record deployment separately after the actual environment has been verified. An approved task may still be undeployed. Deployment never approves a task or authorizes a beta release.
5. Update dependencies, next action and evidence verification date. Rerun the focused tests and build. Review the source diff and references together. Update assertions that intentionally pin the initial registry when an authorized roadmap decision changes it; retain the approval-only calculation tests.

Keep detailed reports in source-controlled documentation and link them from the data record using plain text repository paths/commit references. Make the data change and its supporting report part of the same reviewed Git change. Never keep a second hand-maintained task status table in documentation. A branch-plus-base reference can identify an uncommitted candidate; after an authorized commit, use that commit in a subsequent evidence update rather than inventing a self-referential commit hash. Committing, publishing and deploying require their separately authorized workflow.

Release date stays empty until explicitly approved. Production remains NO-GO until separate beta release gates pass. Approval of this tracker does not approve the branch audit, integration foundation, production database, hosting or release.

## Evidence provenance

The task brief supplied the historical 43-branch inventory, the leading payment baseline candidate, diverged main/payment histories, the separate UI-C2.10 Pitchside Emerald design branch, and pending local reconciliation/final baseline approval. These are attributed discovery notes in the audit record, not a declaration that the audit is complete. The candidate-ref check is separately dated. Locally preserving a P3 checkout does not reconcile its work into the beta baseline.

## Validation and manual browser review

From the isolated worktree's `frontend` directory, with its normal public development configuration:

```powershell
$env:CI = 'true'
npm.cmd test -- --watchAll=false --runInBand --runTestsByPath src/data/betaTrackerData.test.js src/pages/BetaTracker.test.js src/routes/BetaTracker.access.test.js src/components/Sidebar.test.js src/components/Sidebar.accessibility.test.js src/components/ProtectedRoute.accessibility.test.js
npm.cmd run build
git diff --check
```

The route integration tests mount the real AppRoutes, ProtectedRoute, Layout, Sidebar and tracker with mocked authentication/external I/O and unrelated destinations. Refresh coverage is an unmount/remount at the direct URL; it does not prove a production host's SPA fallback. Component tests cover labels, focus order, native disclosure, filters and missing evidence. JSDOM does not measure responsive geometry or replace signed-in browser acceptance.

For manual review, run `npm.cmd start` in this worktree with an approved development configuration and sign in using existing test accounts. Capture screenshots at desktop (1440×900), tablet (768×1024) and mobile (390×844 and 320×800):

- Super Admin: open Internal → Beta Launch Tracker, then refresh `/beta-tracker`. Verify the summary, 5/7/7 phase groups, conservative evidence and no approved release date.
- Change both filters, including an empty intersection. Global counters must stay constant. Expand the audit and a planned task. Verify evidence, missing-field fallbacks and readable long branch references.
- Use Tab/Shift+Tab, Enter/Space on task summaries, and the skip link. On mobile open/close navigation, check Escape and focus return; check content at 200% zoom for clipping or horizontal overflow.
- Academy Owner, Coach and Parent: confirm the Internal tracker link is absent, then paste `/beta-tracker` and refresh. Each must follow the existing `/login` redirect with no tracker content. Repeat signed out.

Capture screenshots without user data or credentials. Report actual session/browser/viewport and results. Screenshots from a mocked/static harness are layout evidence only. Product Owner manual acceptance and ChatGPT architecture review remain required after implementation and focused testing.

## Approved BETA-01 and active BETA-02 — 20 November 2026

**BETA-01: APPROVED COMPLETE.** The Product Owner explicitly approved `payment-module-finalization` @ `62e54bef15aafffe0810b9c64e8ce1ed81d5b250` as the development baseline. GitHub audit counted 43 remote branches (32 histories contained in payment, 10 with unique commits, plus the payment branch itself). Source comparison retained newer payment-branch operational screens; Vercel Production was shown on `main` @ `3218b657`. Approval does not authorize deployment or blanket merging.

**BETA-02: IN PROGRESS.** The tracker was committed at `9423acc4f3f908c8d4d64e5a2af65e8b13f08ff9`; its original focused tests passed 50/50 and the local React build passed. Product Owner accepted its Super Admin layout. Status-update tests/build, actual negative-role manual verification and final integration acceptance are still pending. The derived completion formula is unchanged.

**Release state:** Production NO-GO. No release date. The separate P3 working tree, `main`, and `payment-module-finalization` remain unchanged.

References: [tracker commit](https://github.com/saurabh-shelke1993/acadpro-app/commit/9423acc4f3f908c8d4d64e5a2af65e8b13f08ff9), [approved baseline](https://github.com/saurabh-shelke1993/acadpro-app/commit/62e54bef15aafffe0810b9c64e8ce1ed81d5b250).

## BETA-02 accepted, BETA-03 started — 21 November 2026

**BETA-02: APPROVED COMPLETE.** On 21 November 2026 the Product Owner expressly approved closing BETA-02 and continuing to BETA-03. The beta integration branch was based on approved `payment-module-finalization` @ `62e54bef` with the isolated Super Admin tracker implementation @ `9423acc`. Codex BETA-02.1 reported 65/65 focused tests across six suites PASS, local React production build PASS and a clean worktree on `0149d421`. GitHub ancestry and tracker state were independently checked. Mocked role route tests passed. Real signed-in negative-role tests, complete application regression and hosted refresh are not claimed as performed. No production deployment is approved.

**BETA-03: IN PROGRESS.** Establish the Academy Owner dashboard design contract from the selected UI-C2.10 Pitchside Emerald preview at `ui-c2-5-owner-dashboard-validation`: layout hierarchy, colors, responsive screens, financial and attendance metric semantics, accessibility and role-scoped navigation. Final Product Owner design approval is still pending. No full branch merge, existing `/dashboard` replacement or global palette rollout is authorized by this status change; those are scoped for BETA-06 and later.

**Unchanged:** Beta launch NO-GO with no release date, 19 milestone IDs, separate P3 worktree and unchanged `main`, `payment-module-finalization` and hosted Supabase.

## BETA-03 design approval and BETA-04 scope start — 21 November 2026

**BETA-03 — Approved Complete:** Product Owner approved the final scoped Academy Owner **UI-C2.10 Pitchside Emerald** design contract on 21 November 2026. The binding specification is [BETA_03_ACADEMY_OWNER_DESIGN_CONTRACT.md](BETA_03_ACADEMY_OWNER_DESIGN_CONTRACT.md), including four BETA-06 corrections: attendance `view=mark` link, center-ID grouping, truthful batch/date mark status, and IST/UTC date-boundary validation. No dashboard code, global colors, Supabase or production changes have been made.

**BETA-04 — In Progress:** Prepare the beta feature-scope freeze with explicit in-scope workflows, deferred features and acceptance/security gates. Product Owner scope approval is pending; this is not a feature implementation task.

The approval is **design-contract-only**. BETA-06 implementation and browser acceptance are separate milestones. The historical UI branch remains isolated, and production is still NO-GO without an approved date. The tracker remains the canonical milestone status source.

## BETA-04 scope approved; BETA-05 workspace foundation active — 21 November 2026

**BETA-04 — Approved Complete:** Product Owner approved the initial pilot beta scope on 21 November 2026, including **manual Academy Owner-initiated monthly batch subscription renewal** with exactly one **Pending** due per eligible player/agreement/period, no automatic collection and strict price, eligibility, transaction, idempotency, audit, RLS/tenant safeguards. Approved scope/exclusions: [BETA_04_BETA_SCOPE_FREEZE.md](BETA_04_BETA_SCOPE_FREEZE.md). Renewal is **PLANNED for BETA-07**, not implemented, migrated or tested.

**BETA-05 — In Progress:** Validate the isolated beta integration worktree, feature-branch/review protocol and source-controlled evidence workflow, then seek separate Product Owner workspace acceptance. Production remains NO-GO.

No beta feature was implemented, no Supabase migrations/data changes were authorized, and no production release was approved by the scope freeze. BETA-07/08/12/17 still require separate implementation, tests, manual acceptance and release gates.
