import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import PerformanceWorkspaceTabs from "./PerformanceWorkspaceTabs";

const renderTabs = (route, role = "academy_owner") =>
  render(
    <MemoryRouter initialEntries={[route]}>
      <PerformanceWorkspaceTabs role={role} />
    </MemoryRouter>
  );

test.each(["super_admin", "academy_owner", "coach"])(
  "%s sees the report and assessment cards, with report selected by default",
  (role) => {
    renderTabs("/player-performance-report", role);

    const report = screen.getByRole("link", { name: "Performance Report" });
    const assessments = screen.getByRole("link", { name: "Performance Assessments" });

    expect(screen.getByRole("heading", { level: 1, name: "Player Performance" })).toBeInTheDocument();
    expect(report).toHaveAttribute("href", "/player-performance-report");
    expect(assessments).toHaveAttribute("href", "/coach-performance-assessments");
    expect(report).toHaveAttribute("aria-current", "page");
    expect(report).toHaveClass("performance-workspace-tab-active");
    expect(assessments).not.toHaveClass("performance-workspace-tab-active");
    expect(screen.getAllByText("Selected")).toHaveLength(1);
  }
);

test("assessment direct route marks assessment card as selected", () => {
  renderTabs("/coach-performance-assessments", "coach");

  const report = screen.getByRole("link", { name: "Performance Report" });
  const assessments = screen.getByRole("link", { name: "Performance Assessments" });

  expect(report).not.toHaveClass("performance-workspace-tab-active");
  expect(assessments).toHaveClass("performance-workspace-tab-active");
  expect(assessments).toHaveAttribute("aria-current", "page");
  expect(screen.getAllByText("Selected")).toHaveLength(1);
});

test("clicking selection cards updates active route state in both directions", () => {
  renderTabs("/player-performance-report");

  const report = screen.getByRole("link", { name: "Performance Report" });
  const assessments = screen.getByRole("link", { name: "Performance Assessments" });

  fireEvent.click(assessments);
  expect(assessments).toHaveAttribute("aria-current", "page");
  expect(report).not.toHaveClass("performance-workspace-tab-active");
  expect(screen.getAllByText("Selected")).toHaveLength(1);

  fireEvent.click(report);
  expect(report).toHaveAttribute("aria-current", "page");
  expect(assessments).not.toHaveClass("performance-workspace-tab-active");
  expect(screen.getAllByText("Selected")).toHaveLength(1);
});

test.each(["parent", undefined, "unknown_role"])(
  "does not expose performance workspace management navigation for role %s",
  (role) => {
    renderTabs("/player-performance-report", role);

    expect(screen.queryByRole("navigation", { name: "Player performance views" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Performance Assessments" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Player Performance" })).not.toBeInTheDocument();
  }
);
