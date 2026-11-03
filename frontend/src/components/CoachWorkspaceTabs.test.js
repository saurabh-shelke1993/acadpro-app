import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import CoachWorkspaceTabs from "./CoachWorkspaceTabs";

const renderWorkspaceTabs = (route) =>
  render(
    <MemoryRouter initialEntries={[route]}>
      <CoachWorkspaceTabs />
    </MemoryRouter>
  );

test("Coach Directory is active at /coaches and keeps the assignment link", () => {
  renderWorkspaceTabs("/coaches");

  const directory = screen.getByRole("link", { name: "Coach Directory" });
  const assignments = screen.getByRole("link", { name: "Batch Assignments" });

  expect(directory.getAttribute("href")).toBe("/coaches");
  expect(directory.classList.contains("coach-workspace-tab-active")).toBe(true);
  expect(assignments.getAttribute("href")).toBe("/coach-batch-mapping");
  expect(assignments.classList.contains("coach-workspace-tab-active")).toBe(false);
});

test("Batch Assignments is active at the existing direct mapping route", () => {
  renderWorkspaceTabs("/coach-batch-mapping");

  const directory = screen.getByRole("link", { name: "Coach Directory" });
  const assignments = screen.getByRole("link", { name: "Batch Assignments" });

  expect(directory.classList.contains("coach-workspace-tab-active")).toBe(false);
  expect(assignments.classList.contains("coach-workspace-tab-active")).toBe(true);
  expect(screen.getByRole("heading", { level: 1, name: "Coaches & Assignments" })).toBeTruthy();
});
