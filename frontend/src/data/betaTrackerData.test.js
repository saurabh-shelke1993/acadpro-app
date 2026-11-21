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

test("records five approved milestones and BETA-06 next with production NO-GO", () => {
  expect(betaTasks.map(getBetaTaskStatus)).toEqual([...Array(5).fill("COMPLETE"), ...Array(14).fill("PLANNED")]);
  expect(getBetaSummary()).toMatchObject({ total: 19, completed: 5, inProgress: 0, blocked: 0 });
  expect(getBetaSummary().activeMilestone.id).toBe("BETA-06");
  expect(betaTasks[0].acceptance).toMatchObject({ status: "APPROVED", approvedBy: "Product Owner", approvedOn: "2026-11-20" });
  expect(betaTasks[1].acceptance).toMatchObject({ status: "APPROVED", approvedBy: "Product Owner", approvedOn: "2026-11-21" });
  expect(betaTasks[2].acceptance).toMatchObject({ status: "APPROVED", approvedBy: "Product Owner", approvedOn: "2026-11-21" });
  expect(betaTasks[3].acceptance).toMatchObject({ status: "APPROVED", approvedBy: "Product Owner", approvedOn: "2026-11-21" });
  expect(betaTasks[4].acceptance).toMatchObject({ status: "APPROVED", approvedBy: "Product Owner", approvedOn: "2026-11-21" });
  expect(betaTasks.slice(5).every((task) => task.acceptance.status === "NOT_REVIEWED")).toBe(true);
  expect(betaTasks[1].automatedTests.status).toBe("PASSED");
  expect(betaTasks[2].automatedTests.status).toBe("NOT_RUN");
  expect(betaTasks[3].automatedTests.status).toBe("NOT_RUN");
  expect(betaTasks[4].implementation.status).toBe("IMPLEMENTED");
  expect(betaTasks[4].automatedTests.status).toBe("PASSED");
  expect(betaTasks[4].automatedTests.evidence.join(" ")).toMatch(/predate the documentation-only/i);
  expect(getBetaTaskStatus(betaTasks[4])).toBe("COMPLETE");
  expect(betaTasks[6].nextAction).toMatch(/manual monthly batch renewal/i);
  expect(betaTasks[6].nextAction).toMatch(/Pending due/i);
  expect(betaTasks.every((task) => task.deployment.status !== "DEPLOYED")).toBe(true);
  expect(betaLaunch).toEqual({ productionDecision: "NO-GO", releaseDate: null });
});

test("retains audited branch evidence with approved baseline decision", () => {
  const audit = betaTasks[0];
  const evidence = audit.implementation.evidence.join(" ");
  for (const expected of ["43 remote GitHub branches", "payment-module-finalization", "diverged", "UI-C2.10 Pitchside Emerald"]) {
    expect(evidence).toContain(expected);
  }
  expect(audit.blocker).toBeNull();
  expect(audit.branchReference).toContain("(approved baseline)");
  expect(getBetaTaskStatus(audit)).toBe("COMPLETE");
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
    { ...betaTasks[1], workStatus: "BLOCKED", acceptance: { status: "PENDING" } },
    { ...betaTasks[2], workStatus: "IN_PROGRESS", implementation: { status: "IMPLEMENTED" }, automatedTests: { status: "PASSED" }, acceptance: { status: "PENDING" } },
  ];
  expect(getBetaSummary(tasks)).toMatchObject({ total: 3, completed: 1, inProgress: 1, blocked: 1 });
  expect(getBetaSummary(tasks).activeMilestone.id).toBe("BETA-03");
  expect(getBetaSummary(tasks.filter((task) => task.phaseId === "phase-1")).completed).toBe(1);
  expect(getBetaSummary().completed).toBe(5);
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
