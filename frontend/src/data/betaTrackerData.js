/**
 * Source of truth for the read-only beta roadmap. Stable IDs must not be reused.
 *
 * BetaTask schema:
 * id/name/phaseId: required strings; phaseId references betaPhases.
 * workStatus: PLANNED | IN_PROGRESS | BLOCKED (never a completion claim).
 * implementation: { status: NOT_STARTED | IN_PROGRESS | IMPLEMENTED, evidence?: string[] }.
 * automatedTests: { status: NOT_RUN | PARTIAL | PASSED | FAILED, evidence?: string[] }.
 * acceptance: { status: NOT_REVIEWED | PENDING | REJECTED | APPROVED,
 *   approvedBy?: string, approvedOn?: YYYY-MM-DD, evidence?: string[] }.
 * deployment: { status: NOT_VERIFIED | NOT_DEPLOYED | DEPLOYED, evidence?: string[] }.
 * branchReference/blocker/nextAction: optional plain text; notes?: string[].
 * lastVerifiedOn: optional YYYY-MM-DD, only for the evidence actually reviewed.
 * Omitted/empty optional evidence means unknown, never success.
 * COMPLETE is derived exclusively from acceptance.status === APPROVED.
 * See frontend/docs/BETA_LAUNCH_TRACKER.md for the evidence/update contract.
 */

export const betaPhases = [
  { id: "phase-1", name: "Foundation & Consolidation", number: 1 },
  { id: "phase-2", name: "Product Completion", number: 2 },
  { id: "phase-3", name: "Production & Beta Launch", number: 3 },
];

export const betaStatusLabels = {
  PLANNED: "Planned",
  IN_PROGRESS: "In progress",
  BLOCKED: "Blocked",
  COMPLETE: "Approved complete",
};

export const betaLaunch = {
  productionDecision: "NO-GO",
  releaseDate: null,
};

const plannedTask = (id, name, phaseId, blocker, nextAction) => ({
  id, name, phaseId, workStatus: "PLANNED",
  implementation: { status: "NOT_STARTED" },
  automatedTests: { status: "NOT_RUN" },
  acceptance: { status: "NOT_REVIEWED" },
  deployment: { status: "NOT_VERIFIED" },
  blocker, nextAction,
  lastVerifiedOn: null,
});

export const betaTasks = [
  {
    ...plannedTask("BETA-01", "Branch and Baseline Audit", "phase-1", null,
      "Proceed with BETA-02 integration and preservation checks."),
    workStatus: "IN_PROGRESS",
    implementation: {
      status: "IMPLEMENTED",
      evidence: [
        "43 remote GitHub branches audited on 2026-11-20: 32 contained in payment, 10 with unique commits, and the payment branch itself.",
        "main and payment-module-finalization diverged; attendance, attendance history, dashboard and player-profile source differences were reviewed.",
        "UI-C2.10 Pitchside Emerald remains the separate preferred design reference, not integrated into this baseline.",
        "Vercel Production showed main @ 3218b657 as Ready in the 2026-11-20 Product Owner screenshot.",
        "payment-module-finalization @ 62e54bef15aafffe0810b9c64e8ce1ed81d5b250 was explicitly selected as the beta development baseline.",
      ],
    },
    automatedTests: { status: "NOT_RUN", evidence: ["Read-only branch/source/deployment audit; no executable test suite required for this decision."] },
    acceptance: {
      status: "APPROVED",
      approvedBy: "Product Owner",
      approvedOn: "2026-11-20",
      evidence: [
        "Product Owner explicitly approved payment-module-finalization (62e54bef) as the official beta development baseline.",
        "GitHub branch comparisons, source reconciliation and Vercel Production screenshot reviewed in BETA-01-C/D.",
      ],
    },
    deployment: { status: "NOT_DEPLOYED", evidence: ["A baseline decision does not authorize production deployment."] },
    branchReference: "payment-module-finalization @ 62e54bef15aafffe0810b9c64e8ce1ed81d5b250 (approved baseline)",
    blocker: null,
    notes: [
      "Main-only notification draft work is deferred; no wholesale merge of older screens, UI or security branches.",
      "Player-profile attendance soft-delete NULL behavior was reviewed against the testing database and is not a current baseline blocker.",
      "Unfinished P3 checkout remains separate and unchanged; production remains NO-GO.",
    ],
    lastVerifiedOn: "2026-11-20",
  },
  {
    ...plannedTask("BETA-02", "Select Consolidated Application Baseline", "phase-1",
      null,
      "Proceed with BETA-03 Academy Owner Design Standard review."),
    workStatus: "IN_PROGRESS",
    implementation: {
      status: "IMPLEMENTED",
      evidence: [
        "Original tracker implementation committed on beta-01-t-super-admin-tracker @ 9423acc4f3f908c8d4d64e5a2af65e8b13f08ff9.",
        "Integration branch beta-launch-integration validated with clean worktree and approved baseline ancestry.",
        "The tracker branch descended directly from approved payment-module-finalization baseline 62e54bef.",
        "Super Admin tracker layout reviewed and accepted locally by Product Owner.",
      ],
    },
    automatedTests: {
      status: "PASSED",
      evidence: [
        "Before the milestone-status update, 50/50 focused Jest tests passed and the React production build compiled successfully.",
        "Codex verified 65/65 focused tests across six suites and a successful React build on beta-launch-integration @ 0149d421; mocked role redirect tests passed. Full-suite regression, real signed-in negative-role checks and hosted refresh remain unverified.",
      ],
    },
    acceptance: { status: "APPROVED", approvedBy: "Product Owner", approvedOn: "2026-11-21", evidence: ["On 2026-11-21 the Product Owner reviewed BETA-02 and explicitly approved closing it and advancing to BETA-03.", "Approval covers the consolidated development baseline, not production release or unverified real signed-in role scenarios."] },
    deployment: { status: "NOT_DEPLOYED", evidence: ["No beta integration commit has been promoted to Vercel Production."] },
    branchReference: "beta-launch-integration @ 0149d42173e6e4bfefb2b447a21ea42a41847b3f (validated development integration)",
    notes: [
      "Preserve ps-r6a4-integrated-subscription-regression and its uncommitted work.",
      "Focused test pass does not imply complete application regression, true signed-in role checks or production deployment.",
      "main, payment-module-finalization and the hosted Supabase projects are unchanged.",
    ],
    lastVerifiedOn: "2026-11-21",
  },
  {
    ...plannedTask("BETA-03", "Approve Academy Owner Design Standard", "phase-1",
      null,
      "Carry the approved design contract into BETA-06 after beta scope and workspace approvals."),
    workStatus: "IN_PROGRESS",
    implementation: {
      status: "IMPLEMENTED",
      evidence: [
        "Academy Owner UI-C2.10 Pitchside Emerald visual, layout and metric-display standards approved and documented in frontend/docs/BETA_03_ACADEMY_OWNER_DESIGN_CONTRACT.md.",
        "Reviewed baseline dashboardService.js, selected C27/C30 preview source and adapter; no UI branch merge or production dashboard replacement.",
        "Four required BETA-06 corrections documented: canonical attendance view=mark navigation; stable centerId grouping; truthful batch/date attendance labels; IST/UTC boundary verification.",
        "Product Owner confirmed that BETA-03 is design-contract approval, with actual integration deferred to BETA-06.",
      ],
    },
    automatedTests: {
      status: "NOT_RUN",
      evidence: [
        "BETA-03 is a design contract, not an implemented beta dashboard change. Codex BETA-03.1 baseline validation reported six tracker-focused suites, 65/65 tests PASS and React build PASS on integration SHA 136ca880; historical UI-C2.10 preview reported 56/56 focused tests PASS. Neither validates future BETA-06 implementation.",
      ],
    },
    acceptance: {
      status: "APPROVED",
      approvedBy: "Product Owner",
      approvedOn: "2026-11-21",
      evidence: [
        "Product Owner explicitly approved Pitchside Emerald as final Academy Owner dashboard design standard for BETA-03, including four implementation corrections, on 2026-11-21.",
        "Authoritative design contract: frontend/docs/BETA_03_ACADEMY_OWNER_DESIGN_CONTRACT.md; this acceptance does not authorize production rollout, global styles or replacing /dashboard.",
      ],
    },
    deployment: { status: "NOT_DEPLOYED", evidence: ["Approved design is not integrated into beta /dashboard and has not been deployed."] },
    branchReference: "UI-C2.10 design reference @ 3756914ca6624bb07839b6aca81ecb1dcb9da065; beta-launch-integration (design contract only)",
    blocker: null,
    notes: [
      "The historical preview branch remains isolated. Dashboard implementation and acceptance belong to BETA-06.",
      "Preserve finance/attendance data semantics, Supabase RBAC/RLS and academy tenant isolation.",
      "Pending full frontend regression and actual browser testing are release/integration gates, not a reason to misrepresent design approval.",
    ],
    lastVerifiedOn: "2026-11-21",
  },
  {
    ...plannedTask("BETA-04", "Freeze Beta Feature Scope", "phase-1",
      null,
      "Enforce the frozen beta scope while planning BETA-05 integration and subsequent product milestones."),
    workStatus: "IN_PROGRESS",
    implementation: {
      status: "IMPLEMENTED",
      evidence: [
        "Product Owner approved the first-pilot feature inclusions/exclusions and acceptance gates on 2026-11-21; authoritative scope is frontend/docs/BETA_04_BETA_SCOPE_FREEZE.md.",
        "Single newly requested inclusion: Owner-initiated monthly batch subscription renewal for eligible players, creating exactly one Pending due per successfully renewed player/period, without automatic collection.",
        "Feature work explicitly deferred: automated scheduled renewals, gateway/autopay, new roles/sports, unapproved proration, reminder automation and noncritical enhancements.",
        "Existing financial, lifecycle, RBAC and multi-tenant acceptance gates preserved; pending renewal implementation assigned to BETA-07 with dues compatibility in BETA-08 and security tests in BETA-12.",
      ],
    },
    automatedTests: {
      status: "NOT_RUN",
      evidence: ["BETA-04 freezes business scope; no renewal implementation or functional tests performed. Updated Beta Tracker tests require an additional local run."],
    },
    acceptance: {
      status: "APPROVED",
      approvedBy: "Product Owner",
      approvedOn: "2026-11-21",
      evidence: [
        "Product Owner explicitly approved manual batch renewal for eligible monthly subscriptions with one Pending due per renewed player/period, no automatic collection, and all discussed safety rules.",
        "Product Owner stated the previously proposed beta scope was otherwise acceptable and requested the BETA-04 scope freeze.",
        "Decision record: frontend/docs/BETA_04_BETA_SCOPE_FREEZE.md.",
      ],
    },
    deployment: {
      status: "NOT_DEPLOYED",
      evidence: ["The scope freeze is planning/authorization only; no batch-renewal code, database changes, payment dues or production deployment was performed."],
    },
    branchReference: "beta-launch-integration (approved BETA-04 scope documentation; renewal implementation pending)",
    blocker: null,
    notes: [
      "All inclusions are target capabilities, not claims of implemented or release-tested features.",
      "Batch renewal requires separately reviewed server-side transaction, agreement-price verification, unique period/due guard, legacy holds and true four-role/two-tenant validation.",
      "Production remains NO-GO and the launch date remains unapproved.",
    ],
    lastVerifiedOn: "2026-11-21",
  },
  {
    ...plannedTask("BETA-05", "Integration Workspace and Tracking Foundation", "phase-1",
      "Integration workspace acceptance, release evidence workflow, and active-branch validation remain pending.",
      "Verify beta-launch-integration clean ancestry and isolation; define feature branch/review rules and source-controlled evidence; obtain Product Owner approval for the workspace."),
    workStatus: "IN_PROGRESS",
    implementation: {
      status: "IN_PROGRESS",
      evidence: [
        "BETA-01 development baseline, BETA-03 design standard and BETA-04 frozen feature scope are approved.",
        "beta-launch-integration already hosts the read-only Super Admin tracker and approved scope/design documents; BETA-05 integration/acceptance checklist remains to be completed.",
      ],
    },
    automatedTests: {
      status: "NOT_RUN",
      evidence: ["After scope-freeze tracker changes, local focused tests/build and current branch/worktree review are still required."],
    },
    acceptance: { status: "NOT_REVIEWED" },
    deployment: { status: "NOT_VERIFIED" },
    branchReference: "beta-launch-integration (workspace review pending)",
    notes: [
      "Do not merge the separate UI/security branches or the original uncommitted P3 worktree into the baseline without a reviewed integration plan.",
      "Preserve release NO-GO, historical migrations and hosted Supabase unchanged.",
    ],
    lastVerifiedOn: "2026-11-21",
  },
  plannedTask("BETA-06", "Academy Owner Dashboard Integration", "phase-2",
    "Depends on BETA-03 design approval and BETA-05 workspace acceptance.",
    "Compare the approved dashboard design with the baseline and define the integration diff."),
  plannedTask("BETA-07", "Subscription Workspace Verification", "phase-2",
    "Requires selected-baseline subscription, billing and role evidence; prior discovery is not milestone acceptance.",
    "Verify existing subscription flows and implement the approved guarded manual monthly batch renewal with exactly one Pending due per eligible player/period; collect automated and Owner acceptance evidence."),
  plannedTask("BETA-08", "Unified Payments Workspace", "phase-2",
    "Depends on BETA-04 scope and payment integrity/security review with BETA-12.",
    "Define unified payment flows; verify renewed-period Pending dues, duplicate prevention, collections, receipts and role boundaries without automatic payment."),
  plannedTask("BETA-09", "Coach Dashboard and Profile UX", "phase-2",
    "Depends on approved beta scope and shared design conventions.",
    "Review Coach dashboard/profile journeys, assigned scope and responsive acceptance."),
  plannedTask("BETA-10", "Parent Portal and Profile UX", "phase-2",
    "Depends on approved beta scope and linked-player financial visibility decisions.",
    "Review Parent portal/profile journeys and verify linked-player visibility and responsive behavior."),
  plannedTask("BETA-11", "Shared UI and Responsive Consistency", "phase-2",
    "Depends on BETA-06 through BETA-10 workspace decisions.",
    "Audit shared UI, keyboard access and narrow-screen layouts across the accepted beta journeys."),
  plannedTask("BETA-12", "Critical Security and Functional Remediation", "phase-2",
    "Requires authoritative defect inventory and actual role/tenant acceptance evidence.",
    "Triage critical findings, including payment RPC authorization and batch-renewal concurrency, idempotency, exact price, cross-tenant access and transaction rollback, before release acceptance."),
  plannedTask("BETA-13", "Authoritative Production Database Blueprint", "phase-3",
    "Depends on accepted product scope and security findings; historical migrations are not a verified blueprint.",
    "Reconcile schema, functions, policies and recovery requirements into a reviewed production blueprint."),
  plannedTask("BETA-14", "Production Supabase Project Setup", "phase-3",
    "Depends on BETA-13 blueprint approval and separate production authorization.",
    "Prepare a reviewed project setup checklist and obtain the required production approvals."),
  plannedTask("BETA-15", "Database, Auth, Storage and Security Validation", "phase-3",
    "Depends on BETA-12 remediation and BETA-14 setup acceptance.",
    "Collect actual environment, role/tenant, auth, storage and recovery validation evidence."),
  plannedTask("BETA-16", "Vercel Production Configuration", "phase-3",
    "Depends on the approved production environment and public configuration contract.",
    "Review hosting, environment variables, route refresh and deployment verification requirements."),
  plannedTask("BETA-17", "End-to-End Release Acceptance", "phase-3",
    "Depends on BETA-06 through BETA-16 acceptance and all release gates.",
    "Run the approved end-to-end checklist including Owner batch renewal and a single Pending due per eligible player/period, then record explicit separate release acceptance."),
  plannedTask("BETA-18", "First Pilot Academy Onboarding", "phase-3",
    "Depends on BETA-17 release approval and a separately approved pilot plan.",
    "Confirm pilot readiness, onboarding ownership, support and acceptance criteria."),
  plannedTask("BETA-19", "Pilot Stabilization and Wider Rollout", "phase-3",
    "Depends on BETA-18 pilot evidence and separate wider-rollout approval.",
    "Review pilot feedback, resolve release-blocking issues and propose the next rollout decision."),
];

export const getBetaTaskStatus = (task) => {
  if (task.acceptance?.status === "APPROVED") return "COMPLETE";
  return ["PLANNED", "IN_PROGRESS", "BLOCKED"].includes(task.workStatus)
    ? task.workStatus : "PLANNED";
};

export const getBetaSummary = (tasks = betaTasks) => ({
  total: tasks.length,
  completed: tasks.filter((task) => getBetaTaskStatus(task) === "COMPLETE").length,
  inProgress: tasks.filter((task) => getBetaTaskStatus(task) === "IN_PROGRESS").length,
  blocked: tasks.filter((task) => getBetaTaskStatus(task) === "BLOCKED").length,
  activeMilestone: tasks.find((task) => getBetaTaskStatus(task) === "IN_PROGRESS")
    || tasks.find((task) => getBetaTaskStatus(task) === "BLOCKED")
    || tasks.find((task) => getBetaTaskStatus(task) === "PLANNED")
    || null,
});
