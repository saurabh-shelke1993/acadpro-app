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
      "Integration validation and manual negative-role acceptance remain pending.",
      "Verify the beta-launch-integration branch, rerun focused tests/build, and obtain Product Owner signoff."),
    workStatus: "IN_PROGRESS",
    implementation: {
      status: "IN_PROGRESS",
      evidence: [
        "Original tracker implementation committed on beta-01-t-super-admin-tracker @ 9423acc4f3f908c8d4d64e5a2af65e8b13f08ff9.",
        "The tracker branch descended directly from approved payment-module-finalization baseline 62e54bef.",
        "Super Admin tracker layout reviewed and accepted locally by Product Owner.",
      ],
    },
    automatedTests: {
      status: "PARTIAL",
      evidence: [
        "Before the milestone-status update, 50/50 focused Jest tests passed and the React production build compiled successfully.",
        "Post-update targeted tests/build and actual negative-role browser acceptance remain pending.",
      ],
    },
    acceptance: { status: "PENDING", evidence: ["Tracker UI accepted; BETA-02 integration has not yet received final Product Owner acceptance."] },
    deployment: { status: "NOT_DEPLOYED", evidence: ["No beta integration commit has been promoted to Vercel Production."] },
    branchReference: "beta-launch-integration (created from 9423acc; status update pending validation)",
    notes: [
      "Preserve ps-r6a4-integrated-subscription-regression and its uncommitted work.",
      "main, payment-module-finalization and the hosted Supabase projects are unchanged.",
    ],
    lastVerifiedOn: "2026-11-20",
  },
  plannedTask("BETA-03", "Approve Academy Owner Design Standard", "phase-1",
    "Design standard approval is pending; Pitchside Emerald is on a separate branch.",
    "Review UI-C2.10 against the selected baseline and record Product Owner design acceptance."),
  plannedTask("BETA-04", "Freeze Beta Feature Scope", "phase-1",
    "Depends on baseline and design decisions in BETA-02 and BETA-03.",
    "Agree beta inclusions, exclusions and acceptance criteria with the Product Owner."),
  plannedTask("BETA-05", "Integration Workspace and Tracking Foundation", "phase-1",
    "Depends on an approved baseline and frozen beta scope.",
    "Review the isolated tracker and approve the integration workspace and evidence workflow."),
  plannedTask("BETA-06", "Academy Owner Dashboard Integration", "phase-2",
    "Depends on BETA-03 design approval and BETA-05 workspace acceptance.",
    "Compare the approved dashboard design with the baseline and define the integration diff."),
  plannedTask("BETA-07", "Subscription Workspace Verification", "phase-2",
    "Requires selected-baseline subscription, billing and role evidence; prior discovery is not milestone acceptance.",
    "Review subscription flows and gather automated and manual acceptance evidence on the approved baseline."),
  plannedTask("BETA-08", "Unified Payments Workspace", "phase-2",
    "Depends on BETA-04 scope and payment integrity/security review with BETA-12.",
    "Define the unified payment flows and verify dues, collections, receipts and role boundaries."),
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
    "Triage critical findings and verify each scoped remediation before release acceptance."),
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
    "Execute the approved end-to-end release checklist and record explicit release acceptance."),
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
