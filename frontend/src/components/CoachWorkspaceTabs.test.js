import { fireEvent, render, screen } from "@testing-library/react";
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
  expect(directory.getAttribute("aria-current")).toBe("page");
  expect(screen.getAllByText("Selected")).toHaveLength(1);
});

test("Batch Assignments is active at the existing direct mapping route", () => {
  renderWorkspaceTabs("/coach-batch-mapping");

  const directory = screen.getByRole("link", { name: "Coach Directory" });
  const assignments = screen.getByRole("link", { name: "Batch Assignments" });

  expect(directory.classList.contains("coach-workspace-tab-active")).toBe(false);
  expect(assignments.classList.contains("coach-workspace-tab-active")).toBe(true);
  expect(assignments.getAttribute("aria-current")).toBe("page");
  expect(screen.getAllByText("Selected")).toHaveLength(1);
  expect(screen.getByRole("heading", { level: 1, name: "Coaches & Assignments" })).toBeTruthy();
});

test("Selecting a card navigates and transfers the selected state", () => {
  renderWorkspaceTabs("/coaches");

  const directory = screen.getByRole("link", { name: "Coach Directory" });
  const assignments = screen.getByRole("link", { name: "Batch Assignments" });

  fireEvent.click(assignments);
  expect(assignments.getAttribute("aria-current")).toBe("page");
  expect(assignments.classList.contains("coach-workspace-tab-active")).toBe(true);
  expect(directory.classList.contains("coach-workspace-tab-active")).toBe(false);
  expect(screen.getAllByText("Selected")).toHaveLength(1);

  fireEvent.click(directory);
  expect(directory.getAttribute("aria-current")).toBe("page");
  expect(assignments.classList.contains("coach-workspace-tab-active")).toBe(false);
  expect(screen.getAllByText("Selected")).toHaveLength(1);
});
