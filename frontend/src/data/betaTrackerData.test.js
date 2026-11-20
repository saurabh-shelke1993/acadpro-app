import {
  betaLaunch, betaPhases, betaTasks, getBetaSummary, getBetaTaskStatus,
} from "./betaTrackerData";

test("registers exactly 19 stable sequential IDs across the three roadmap phases", () => {
  expect(betaTasks.map((task) => task.id)).toEqual(
    Array.from({ length: 19 }, (_, index) => `BETA-${String(index + 1).padStart(2, "0")}`)
  );
  expect(betaPhases.map((phase) => ({
    number: phase.number,
    count: betaTasks.filter((task) => task.phaseId === phase.id).length,
  }))).toEqual([{ number: 1, count: 5 }, { number: 2, count: 7 }, { number: 3, count: 7 }]);
  expect(betaTasks.every((task) => betaPhases.some((phase) => phase.id === task.phaseId))).toBe(true);
});

test("starts with only the audit in progress, no approved completion and no deployment claims", () => {
  expect(betaTasks.map(getBetaTaskStatus)).toEqual(["IN_PROGRESS", ...Array(18).fill("PLANNED")]);
  expect(getBetaSummary()).toMatchObject({ total: 19, completed: 0, inProgress: 1, blocked: 0 });
  expect(getBetaSummary().activeMilestone.id).toBe("BETA-01");
  expect(betaTasks.every((task) => task.acceptance.status === "NOT_REVIEWED")).toBe(true);
  expect(betaTasks.every((task) => task.automatedTests.status === "NOT_RUN")).toBe(true);
  expect(betaTasks.every((task) => task.deployment.status === "NOT_VERIFIED")).toBe(true);
  expect(betaLaunch).toEqual({ productionDecision: "NO-GO", releaseDate: null });
});

test("retains the supplied discovery evidence without claiming the branch audit is complete", () => {
  const audit = betaTasks[0];
  const evidence = audit.implementation.evidence.join(" ");
  for (const expected of ["43 remote GitHub branches", "payment-module-finalization", "diverged", "UI-C2.10 Pitchside Emerald"]) {
    expect(evidence).toContain(expected);
  }
  expect(audit.blocker).toMatch(/reconciliation.*approval.*pending/i);
  expect(getBetaTaskStatus(audit)).toBe("IN_PROGRESS");
});

test.each([undefined, "NOT_REVIEWED", "PENDING", "REJECTED", "approved"])(
  "implemented and tested work with acceptance %s never counts as complete", (status) => {
    const task = {
      workStatus: "IN_PROGRESS",
      implementation: { status: "IMPLEMENTED" },
      automatedTests: { status: "PASSED" },
      deployment: { status: "DEPLOYED" },
      acceptance: status ? { status } : undefined,
    };
    expect(getBetaSummary([task]).completed).toBe(0);
    expect(getBetaTaskStatus(task)).toBe("IN_PROGRESS");
  }
);

test("only explicit approval contributes to total and phase completion", () => {
  const tasks = [
    { ...betaTasks[0], acceptance: { status: "APPROVED", approvedBy: "Test reviewer", approvedOn: "2026-11-20", evidence: ["Test fixture only"] } },
    { ...betaTasks[1], workStatus: "BLOCKED" },
    { ...betaTasks[2], workStatus: "IN_PROGRESS", implementation: { status: "IMPLEMENTED" }, automatedTests: { status: "PASSED" } },
  ];
  expect(getBetaSummary(tasks)).toMatchObject({ total: 3, completed: 1, inProgress: 1, blocked: 1 });
  expect(getBetaSummary(tasks).activeMilestone.id).toBe("BETA-03");
  expect(getBetaSummary(tasks.filter((task) => task.phaseId === "phase-1")).completed).toBe(1);
  expect(getBetaSummary().completed).toBe(0);
});

test("rejects a bare COMPLETE work status as proof of acceptance", () => {
  expect(getBetaTaskStatus({ workStatus: "COMPLETE" })).toBe("PLANNED");
});

test("handles an empty registry and missing optional evidence", () => {
  expect(getBetaSummary([])).toEqual({ total: 0, completed: 0, inProgress: 0, blocked: 0, activeMilestone: null });
  expect(getBetaTaskStatus({})).toBe("PLANNED");
  expect(getBetaSummary([{ workStatus: "BLOCKED" }]).activeMilestone.workStatus).toBe("BLOCKED");
  expect(getBetaSummary([{ workStatus: "PLANNED" }]).activeMilestone.workStatus).toBe("PLANNED");
});
